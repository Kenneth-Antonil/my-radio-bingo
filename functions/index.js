/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        RADIO BINGO — FIREBASE CLOUD DRAW ENGINE             ║
 * ║                                                              ║
 * ║  Handles ALL automatic draws server-side.                   ║
 * ║  No browser needs to be open. Balls run 24/7.               ║
 * ║                                                              ║
 * ║  SETUP:                                                      ║
 * ║    1. cd functions && npm install                            ║
 * ║    2. firebase deploy --only functions                       ║
 * ║                                                              ║
 * ║  REQUIRES: Firebase Blaze (pay-as-you-go) plan              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { onSchedule }     = require("firebase-functions/v2/scheduler");
const { onValueWritten } = require("firebase-functions/v2/database");
const { logger }         = require("firebase-functions");
const admin              = require("firebase-admin");

admin.initializeApp();
const db = admin.database();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PATTERNS = [
  "Normal Bingo", "Normal Bingo", "Normal Bingo",
  "Four Corners", "Letter X", "Letter T",
  "Letter L", "Letter C", "Plus Sign",
];
function randomPattern(forceBlackout) {
  if (forceBlackout) return "Blackout";
  return PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
}

async function resetHasWon() {
  const snap = await db.ref("users").once("value");
  const updates = {};
  snap.forEach(u => { updates[u.key + "/hasWonCurrent"] = false; });
  if (Object.keys(updates).length) await db.ref("users").update(updates);
}

// ─── MAIN SCHEDULED FUNCTION ──────────────────────────────────────────────────
// Runs every minute. Manages schedule detection + actual ball drawing.

exports.cloudDrawEngine = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Manila",
    region: "asia-southeast1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const now = Date.now();
    logger.info("☁️  Cloud Draw Engine tick:", new Date(now).toISOString());

    try {
      // Step 1 — Try to start any scheduled games
      await checkAndStartScheduledGames(now);

      // Step 2 — Continue drawing if game is active and no client has the draw lock
      await continueCloudDraw(now);
    } catch (err) {
      logger.error("Cloud Draw Engine error:", err);
    }
  }
);

// ─── STEP 1: CHECK SCHEDULES ──────────────────────────────────────────────────

async function checkAndStartScheduledGames(now) {
  const schedSnap  = await db.ref("gameState/schedules").once("value");
  const schedules  = schedSnap.val() || {};
  const speedSnap  = await db.ref("gameState/drawConfig/speed").once("value");
  const speed      = (speedSnap.val() && speedSnap.val() > 0) ? speedSnap.val() : 8000;

  for (const [key, val] of Object.entries(schedules)) {
    const schedTime = typeof val === "object" ? val.time : val;
    const isJP      = typeof val === "object" && !!val.isJackpot;
    const jpAmt     = typeof val === "object" ? (val.jackpotAmount || null) : null;

    if (typeof schedTime !== "number") continue;

    // Within a 2-minute activation window (handles slight CF delays)
    if (now < schedTime || now >= schedTime + 120000) continue;

    // Remove this schedule first — prevents double-fire
    await db.ref("gameState/schedules/" + key).remove();

    // Skip if a game is already running
    const statusSnap = await db.ref("gameState/status").once("value");
    if (statusSnap.val() === "playing") {
      logger.info("Schedule hit but game already playing, skipping.");
      continue;
    }

    // Try to atomically claim the cloud draw lock
    const lockTxn = await db.ref("gameState/cloudDrawLock").transaction(cur => {
      if (cur !== null) return; // someone else (another CF instance) already claimed it
      return { by: "cloud-function", at: now, expiresAt: now + 3600000 };
    });
    if (!lockTxn.committed) {
      logger.info("Lock already held, skipping schedule start.");
      continue;
    }

    // Configure and start the game
    const pattern = randomPattern(isJP);
    await db.ref("gameState/currentPattern").set(pattern);

    if (isJP && jpAmt) {
      await db.ref("gameState/jackpot").set({ amount: jpAmt, active: true });
    } else {
      await db.ref("gameState/jackpot/active").set(false);
    }

    await db.ref("gameState").update({
      status: "playing",
      gameStartTime: now,
    });

    // Set draw config so the draw loop knows to proceed
    await db.ref("gameState/drawConfig").update({
      cloudEnabled: true,
      startedAt: now,
      lastDrawAt: now,          // first ball drawn immediately next tick
      speed: speed,
    });

    logger.info(`✅ Scheduled game started. Pattern: ${pattern}, JP: ${isJP}`);
  }
}

// ─── STEP 2: DRAW BALLS ───────────────────────────────────────────────────────

async function continueCloudDraw(now) {
  // Check if cloud draw is enabled
  const configSnap = await db.ref("gameState/drawConfig").once("value");
  const config     = configSnap.val() || {};
  if (!config.cloudEnabled) return;

  // Don't draw if a client (player tab / dashboard) already holds the draw lock
  const clientLockSnap = await db.ref("gameState/drawLock").once("value");
  if (clientLockSnap.exists()) {
    logger.info("Client holds drawLock — skipping cloud draw tick.");
    return;
  }

  // Verify game is playing
  const statusSnap = await db.ref("gameState/status").once("value");
  if (statusSnap.val() !== "playing") return;

  // Check for winner — trigger auto-reset
  const winnerSnap = await db.ref("gameState/latestWinner").once("value");
  if (winnerSnap.exists()) {
    logger.info("Winner detected — triggering auto-reset.");
    await cloudAutoReset("May BINGO winner!");
    return;
  }

  const speed      = config.speed || 8000;
  const lastDrawAt = config.lastDrawAt || now;
  const elapsed    = now - lastDrawAt;

  // Not enough time has passed yet
  if (elapsed < speed) {
    logger.info(`Waiting… elapsed: ${elapsed}ms / speed: ${speed}ms`);
    return;
  }

  // How many balls can we draw within ~55-second safe budget?
  // First ball is drawn immediately (time already elapsed).
  // Each subsequent ball requires `speed` ms wait.
  const budgetMs   = 55000;
  const maxBalls   = Math.max(1, Math.min(
    Math.floor(budgetMs / speed),   // budget limit
    Math.floor(elapsed / speed),    // catch-up limit
    75                              // absolute limit
  ));

  // Get current drawn numbers
  const drawnSnap = await db.ref("drawnNumbers").once("value");
  const drawnData = drawnSnap.val() || {};
  let drawnNums   = Object.values(drawnData).map(Number);

  let ballsDrawn   = 0;
  let newLastDraw  = lastDrawAt;

  for (let i = 0; i < maxBalls; i++) {
    // Re-check winner each ball
    const wSnap = await db.ref("gameState/latestWinner").once("value");
    if (wSnap.exists()) {
      await cloudAutoReset("May BINGO winner!");
      return;
    }

    if (drawnNums.length >= 75) {
      await cloudAutoReset("Lahat ng 75 balls na-draw!");
      return;
    }

    // Build available pool
    const available = [];
    for (let n = 1; n <= 75; n++) {
      if (!drawnNums.includes(n)) available.push(n);
    }
    if (!available.length) {
      await cloudAutoReset("Lahat ng 75 balls na-draw!");
      return;
    }

    const nextNum = available[Math.floor(Math.random() * available.length)];

    // Write ball to database — all listening clients will update live
    await db.ref("drawnNumbers/" + nextNum).set(nextNum);
    await db.ref("gameState/lastCalled").set(nextNum);

    // Ensure gameStartTime is set
    const gstSnap = await db.ref("gameState/gameStartTime").once("value");
    if (!gstSnap.exists()) await db.ref("gameState/gameStartTime").set(Date.now());

    drawnNums.push(nextNum);
    newLastDraw += speed;
    ballsDrawn++;

    logger.info(`🎱 Ball drawn: ${nextNum} (${drawnNums.length}/75)`);

    // Wait before next ball (except after the last one)
    if (i < maxBalls - 1) {
      await sleep(speed);
    }
  }

  // Persist the updated lastDrawAt
  if (ballsDrawn > 0) {
    await db.ref("gameState/drawConfig/lastDrawAt").set(newLastDraw);
  }
}

// ─── AUTO RESET ───────────────────────────────────────────────────────────────

async function cloudAutoReset(reason) {
  logger.info("🔄 Auto-reset:", reason);

  await db.ref("drawnNumbers").remove();
  await db.ref("gameState/latestWinner").remove();
  await db.ref("gameState/winners").remove();
  await db.ref("gameState/gameStartTime").remove();
  await db.ref("gameState/lastCalled").remove();
  await db.ref("gameState").update({ status: "waiting" });
  await db.ref("gameState/drawConfig").update({
    cloudEnabled: false,
    lastDrawAt: null,
    startedAt: null,
  });
  await db.ref("gameState/cloudDrawLock").remove();
  await db.ref("gameState/drawLock").remove();

  await resetHasWon();

  logger.info("✅ Game reset complete. Waiting for next schedule.");
}

// ─── ONWRITE: WINNER DETECTED ─────────────────────────────────────────────────
// Triggers immediately when a winner is written — doesn't wait for the next
// scheduled minute. Handles the 5-second winner display then resets.

exports.onWinnerDetected = onValueWritten(
  {
    ref: "gameState/latestWinner",
    instance: "radiobingo-9ac29-default-rtdb",
    region: "asia-southeast1",
  },
  async (event) => {
    const newData = event.data.after.val();
    if (!newData) return; // winner was removed (reset already happened)

    // Only act if cloud draw was responsible
    const configSnap = await db.ref("gameState/drawConfig/cloudEnabled").once("value");
    if (!configSnap.val()) return;

    logger.info("🏆 Winner detected via onWrite trigger — resetting in 5 seconds.");
    await sleep(5000);
    await cloudAutoReset("May BINGO winner! (instant trigger)");
  }
);

// ─── ONWRITE: DRAWLOCK RELEASED ───────────────────────────────────────────────
// When a client releases the drawLock, the cloud engine may need to resume.
// No action needed here — the next scheduled tick (within 1 min) will resume.
// This trigger just logs for diagnostics.

exports.onDrawLockReleased = onValueWritten(
  {
    ref: "gameState/drawLock",
    instance: "radiobingo-9ac29-default-rtdb",
    region: "asia-southeast1",
  },
  async (event) => {
    const before = event.data.before.val();
    const after  = event.data.after.val();
    if (before && !after) {
      logger.info("🔓 Client drawLock released. Cloud engine will resume on next tick.");
    }
  }
);
