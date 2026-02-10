let userData = {}; let cardNumbers = []; let marks = [12]; let gameDrawn = []; let currentPattern = "Normal Bingo"; let lastNotifiedDraw = ""; let selectedReplyId = null;
let currentJackpotAmount = 500; let isJackpotActive = false;

// === NOTIFICATION BLOCKER LOGIC ===
window.addEventListener('load', () => { setTimeout(hideSplash, 2000); checkNotifGate(); checkInstallGate(); initBannerListener(); loadSocialFeed(); loadPYMK(); loadCustomSkin(); });
setTimeout(hideSplash, 5000);
function hideSplash() { const ss = document.getElementById('splash-screen'); if(ss && ss.style.display !== 'none') { ss.style.opacity = '0'; setTimeout(() => ss.style.display = 'none', 800); } }

function checkNotifGate() {
    const blocker = document.getElementById('notifBlocker');
    const help = document.getElementById('blockedHelp');
    if (!("Notification" in window)) { showToast("Notifications not supported on this device."); blocker.style.display = 'none'; return; }
    if (Notification.permission === "granted") { blocker.style.display = 'none'; } else if (Notification.permission === "denied") { blocker.style.display = 'flex'; help.style.display = 'block'; } else { blocker.style.display = 'flex'; help.style.display = 'none'; }
}
function requestGatePermission() { Notification.requestPermission().then(permission => { if (permission === "granted") { checkNotifGate(); requestNotifyPermission(); } else { checkNotifGate(); } }); }
function showToast(msg) { const toast = document.getElementById('customToast'); document.getElementById('toastMsg').innerText = msg; toast.classList.add('show'); playSound('click'); setTimeout(() => { toast.classList.remove('show'); }, 3000); }

let confirmCallback = null;
function showCustomConfirm(title, msg, onYes) { document.getElementById('confTitle').innerText = title; document.getElementById('confMsg').innerText = msg; document.getElementById('customConfirmModal').style.display = 'flex'; confirmCallback = onYes; playSound('click'); }
function closeCustomConfirm() { document.getElementById('customConfirmModal').style.display = 'none'; confirmCallback = null; }
document.getElementById('confYesBtn').addEventListener('click', () => { if(confirmCallback) confirmCallback(); closeCustomConfirm(); });

let notifiedFiveMins = false; let lastCheckedSchedule = null;
function checkFiveMinuteNotification(timeInput) { if(notifiedFiveMins && lastCheckedSchedule === timeInput) return; let drawTime = isNaN(timeInput) ? 0 : parseInt(timeInput); if(drawTime > 0) { const diff = drawTime - Date.now(); const mins = Math.floor(diff / 60000); if(mins === 5) { if(Notification.permission === "granted") { new Notification("RB LIVE BINGO", { body: "Dali! 5 minutes na lang bola na! Buksan na ang app." }); } showToast("⚠️ 5 minutes na lang, bola na!"); notifiedFiveMins = true; lastCheckedSchedule = timeInput; } if(mins > 5) notifiedFiveMins = false; } }

let deferredPrompt;
const bottomBanner = document.getElementById('pwaInstallBanner');
const bottomBtn = document.getElementById('pwaBottomBtn');

function checkInstallGate() {
    const gate = document.getElementById('installGate');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) { gate.style.display = 'none'; } else { gate.style.display = 'flex'; const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; if(isIOS) { document.getElementById('gateInstallBtn').style.display = 'none'; document.getElementById('gateIosNote').style.display = 'block'; } }
    checkInstallState();
}
function checkInstallState() { if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) { if(bottomBanner) bottomBanner.style.display = 'none'; } }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(bottomBanner && document.getElementById('installGate').style.display === 'none') { bottomBanner.style.display = 'flex'; } });
function triggerInstall() { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then((choiceResult) => { if (choiceResult.outcome === 'accepted') { if(bottomBanner) bottomBanner.style.display = 'none'; } deferredPrompt = null; }); } else { document.getElementById('installGuideModal').style.display = 'flex'; const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; if (isIOS) { showGuide('ios'); } else { showGuide('android'); } } if(bottomBanner) bottomBanner.style.display = 'none'; }
function showGuide(os) { document.querySelectorAll('.install-tab-btn').forEach(b => b.classList.remove('active')); if(os === 'android') { document.getElementById('tabAndroid').classList.add('active'); document.getElementById('guideAndroidContent').style.display = 'block'; document.getElementById('guideIOSContent').style.display = 'none'; } else { document.getElementById('tabIOS').classList.add('active'); document.getElementById('guideAndroidContent').style.display = 'none'; document.getElementById('guideIOSContent').style.display = 'block'; } }
if(bottomBtn) bottomBtn.addEventListener('click', triggerInstall);

lucide.createIcons();

const sounds = { click: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_2731885542.mp3'), newBall: new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3'), pop: new Audio('https://cdn.freesound.org/previews/536/536108_1415754-lq.mp3'), win: new Audio('https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3'), lose: new Audio('https://cdn.freesound.org/previews/76/76376_877451-lq.mp3'), spin: new Audio('https://cdn.freesound.org/previews/413/413203_5121236-lq.mp3'), cardFlip: new Audio('https://cdn.freesound.org/previews/240/240776_4107740-lq.mp3'), stop: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3'), tumble: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3'), drop: new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3') };
function playSound(type) { if(sounds[type]) { sounds[type].currentTime = 0; if(type === 'drop') sounds[type].volume = 0.3; else sounds[type].volume = 1.0; sounds[type].play().catch(e => console.log("Audio play error", e)); } }
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => { }).catch(err => console.log('SW Failed:', err)); }); }
function requestNotifyPermission() { if ("Notification" in window) { Notification.requestPermission().then(permission => { if (permission === "granted" && messaging) { messaging.getToken().then((currentToken) => { if (currentToken && auth.currentUser) db.ref('users/' + auth.currentUser.uid).update({ fcmToken: currentToken }); }).catch((err) => console.log('Err token', err)); } }); } }

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('view-home').style.display = 'none';
    document.getElementById('view-bingo').style.display = 'none';
    
    if(tab === 'home') {
        document.getElementById('view-home').style.display = 'block';
        document.getElementById('nav-home').classList.add('active');
        loadSocialFeed();
        loadPYMK();
    } else if(tab === 'bingo') {
        document.getElementById('view-bingo').style.display = 'block';
        document.getElementById('nav-bingo').classList.add('active');
    }
    playSound('click');
}

function openPostCreator() {
    switchTab('home');
    document.getElementById('postInput').focus();
}

function switchStoreTab(tab) {
    document.querySelectorAll('.store-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('storeSection-cashout').style.display = 'none';
    document.getElementById('storeSection-skins').style.display = 'none';
    document.getElementById('storeSection-earn').style.display = 'none';
    if(tab === 'cashout') { document.getElementById('tabBtnCash').classList.add('active'); document.getElementById('storeSection-cashout').style.display = 'block'; } 
    else if(tab === 'skins') { document.getElementById('tabBtnSkins').classList.add('active'); document.getElementById('storeSection-skins').style.display = 'block'; updateSkinButtons(); } 
    else if(tab === 'earn') { document.getElementById('tabBtnEarn').classList.add('active'); document.getElementById('storeSection-earn').style.display = 'block'; }
    playSound('click');
}

function fixDate(timestamp) { if(!timestamp) return "No Date"; const d = new Date(parseInt(timestamp)); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + " " + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); }
function login() { playSound('click'); auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(() => { requestNotifyPermission(); checkNotifGate(); }); }

auth.onAuthStateChanged(u => {
    if(u) {
        if(messaging) { messaging.getToken().then((token) => { if(token) db.ref('users/' + u.uid).update({ fcmToken: token }); }).catch((err)=>console.log(err)); messaging.onMessage((payload) => { const title = payload.notification ? payload.notification.title : "Notification"; const body = payload.notification ? payload.notification.body : "New message"; showToast(title + ": " + body); playSound('pop'); }); }
        document.getElementById('loginOverlay').style.display = 'none'; document.getElementById('userPanel').style.display = 'flex';
        document.getElementById('userImg').src = u.photoURL; document.getElementById('profileImgLarge').src = u.photoURL;
        document.getElementById('profileUidDisplay').innerText = "ID: " + u.uid.substring(0,8);
        
        const userRef = db.ref('users/'+u.uid);
        userRef.once('value', snapshot => { 
            if (!snapshot.exists()) { 
                // New User
                const newRefCode = Math.random().toString(36).substring(2, 8).toUpperCase(); 
                const urlParams = new URLSearchParams(window.location.search); 
                const referredBy = urlParams.get('ref'); 
                userRef.set({ name: u.displayName, photo: u.photoURL, points: 500, refCode: newRefCode, referredBy: referredBy || null, last_seen: Date.now(), cardTimestamp: Date.now(), lastLoginDate: new Date().toDateString(), hasWonBringMeThisRound: false, ownedSkins: ['default'], equippedSkin: 'default' }); 
                if (referredBy) { db.ref('users').orderByChild('refCode').equalTo(referredBy).once('value', refSnap => { if (refSnap.exists()) { const referrerUid = Object.keys(refSnap.val())[0]; db.ref('users/' + referrerUid + '/points').transaction(p => (p || 0) + 1000); } }); } 
            } else { 
                // Existing User
                const data = snapshot.val(); 
                const updates = { last_seen: Date.now() }; 
                // Only update name/photo from Google if NOT set in DB (to respect edits)
                if (!data.name) updates.name = u.displayName;
                if (!data.photo) updates.photo = u.photoURL;
                
                const today = new Date().toDateString(); 
                if (data.lastLoginDate !== today) { updates.points = (data.points || 0) + 200; updates.lastLoginDate = today; showToast("🎁 Daily Bonus! +200 RB Coins."); playSound('win'); } 
                if (!data.refCode) updates.refCode = Math.random().toString(36).substring(2, 8).toUpperCase(); 
                if(!data.ownedSkins) updates.ownedSkins = ['default']; 
                if(!data.equippedSkin) updates.equippedSkin = 'default'; 
                userRef.update(updates); 
            } 
        });
        userRef.on('value', s => { 
            if(s.exists()){ 
                userData = s.val(); userData.uid = u.uid; 
                document.getElementById('userPoints').innerText = (userData.points || 0).toLocaleString(); 
                document.getElementById('storePoints').innerText = (userData.points || 0).toLocaleString(); 
                document.getElementById('refLink').value = window.location.origin + window.location.pathname + "?ref=" + (userData.refCode || ""); 
                if(userData.referredBy) document.getElementById('referralInputSection').style.display = 'none'; 
                if(userData.gcash) document.getElementById('gcashInput').value = userData.gcash; 
                if (userData.currentCard) { cardNumbers = userData.currentCard; renderCard(); } else { generateNewCard(); } 
                
                // Priority: DB Name > Google Name
                const displayName = userData.name || u.displayName;
                const displayPhoto = userData.photo || u.photoURL;
                
                updatePresenceData(u.uid, displayName, userData.points, displayPhoto); checkLateJoiner();
                applySkin(userData.equippedSkin || 'default'); updateSkinButtons();
                
                // Update profile badge display in header and menu
                const badgeHtml = getBadgeHtml(userData.points || 0);
                document.getElementById('profileNameDisplay').innerHTML = `${displayName} ${badgeHtml}`;
                document.getElementById('userImg').src = displayPhoto;
                document.getElementById('profileImgLarge').src = displayPhoto;
            } 
        });
        initBingo(); setupChat(); listenForNextDraw(); setupPresence(u.uid); listenJackpot(); listenNotifications(u.uid); listenPrivateMessages(u.uid); listenVideoUpdate();
        initSocialSystem(u.uid);
        loadPYMK();
    } else { document.getElementById('loginOverlay').style.display = 'flex'; }
});

// === BADGE LOGIC ===
function getBadgeHtml(points) {
    let tierClass = "tier-bronze";
    if(points >= 100000) tierClass = "tier-diamond";
    else if(points >= 50000) tierClass = "tier-platinum";
    else if(points >= 25000) tierClass = "tier-gold";
    else if(points >= 10000) tierClass = "tier-silver";
    return `<span class="badge-tier ${tierClass}"><i data-lucide="badge-check" class="badge-icon"></i></span>`;
}

// === UTILITY: IMAGE COMPRESSION ===
function compressImage(file, maxWidth, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

// === PYMK LOGIC ===
function loadPYMK() {
    if(!auth.currentUser) return;
    const list = document.getElementById('pymkList');
    const container = document.getElementById('pymkSection');
    
    db.ref('users').limitToLast(20).once('value', s => {
        db.ref('friends/' + auth.currentUser.uid).once('value', fSnap => {
            const friends = fSnap.exists() ? Object.keys(fSnap.val()) : [];
            friends.push(auth.currentUser.uid); // Exclude self
            
            const candidates = [];
            s.forEach(uSnap => {
                if(!friends.includes(uSnap.key)) {
                    candidates.push({ uid: uSnap.key, ...uSnap.val() });
                }
            });
            
            // Shuffle and pick 5
            const shuffled = candidates.sort(() => 0.5 - Math.random()).slice(0, 5);
            
            if(shuffled.length > 0) {
                list.innerHTML = "";
                shuffled.forEach(u => {
                    const div = document.createElement('div');
                    div.className = 'pymk-card';
                    div.innerHTML = `
                        <img src="${u.photo || 'https://via.placeholder.com/60'}" class="pymk-img" onclick="openUserProfile('${u.uid}')">
                        <div class="pymk-name">${u.name}</div>
                        <button class="btn-add-friend-sm" onclick="sendFriendReqPYMK('${u.uid}')">ADD</button>
                    `;
                    list.appendChild(div);
                });
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        });
    });
}

function sendFriendReqPYMK(uid) {
    db.ref('friendRequests/' + uid + '/' + auth.currentUser.uid).set(true);
    showToast("Request Sent!");
    loadPYMK(); 
}

let bannerTargetUrl = "";
function initBannerListener() { if(sessionStorage.getItem('bannerSeen')) return; db.ref('gameState/bannerSettings').once('value', s => { const d = s.val(); if(d && d.active && d.imageUrl) { document.getElementById('customBannerImg').src = d.imageUrl; bannerTargetUrl = d.targetUrl; document.getElementById('customPopupBanner').style.display = 'flex'; sessionStorage.setItem('bannerSeen', 'true'); playSound('pop'); } }); }
function closeCustomBanner() { document.getElementById('customPopupBanner').style.display = 'none'; }
function clickCustomBanner() { if(bannerTargetUrl) window.open(bannerTargetUrl, '_blank'); }

// === SKIN LOGIC (UPDATED WITH CUSTOM & NEW THEMES) ===
function applySkin(skinId) { 
    const card = document.getElementById('bingoCardContainer'); 
    card.classList.remove('card-skin-neon', 'card-skin-gold', 'card-skin-pink', 'card-skin-matrix', 'card-skin-kitty', 'card-skin-doraemon', 'card-skin-spongebob', 'card-skin-kuromi', 'card-skin-custom'); 
    card.style.backgroundImage = 'none'; // Reset Custom

    if(skinId === 'neon') card.classList.add('card-skin-neon'); 
    if(skinId === 'gold') card.classList.add('card-skin-gold'); 
    if(skinId === 'pink') card.classList.add('card-skin-pink'); 
    if(skinId === 'matrix') card.classList.add('card-skin-matrix'); 
    if(skinId === 'kitty') card.classList.add('card-skin-kitty');
    if(skinId === 'doraemon') card.classList.add('card-skin-doraemon');
    if(skinId === 'spongebob') card.classList.add('card-skin-spongebob');
    if(skinId === 'kuromi') card.classList.add('card-skin-kuromi');
    
    if(skinId === 'custom') {
        card.classList.add('card-skin-custom');
        const storedBG = localStorage.getItem('customSkinBG');
        if(storedBG) {
            card.style.backgroundImage = `url('${storedBG}')`;
        }
    }
}

function updateSkinButtons() { 
    if(!userData.ownedSkins) return; 
    ['default', 'neon', 'gold', 'pink', 'kitty', 'doraemon', 'spongebob', 'kuromi', 'custom'].forEach(skin => { 
        const btn = document.getElementById('btn-skin-' + skin); 
        if(!btn) return; 
        if(userData.equippedSkin === skin) { 
            btn.innerText = "EQUIPPED"; 
            btn.className = "btn-buy-skin owned"; 
            btn.onclick = null; 
        } else if(userData.ownedSkins.includes(skin)) { 
            btn.innerText = "EQUIP"; 
            btn.className = "btn-buy-skin equip"; 
            btn.onclick = () => equipSkin(skin); 
        } 
    }); 
    
    // Show custom slot if uploaded
    if(localStorage.getItem('customSkinBG')) {
        document.getElementById('customSkinSlot').style.display = 'block';
        document.getElementById('customSkinPreview').style.backgroundImage = `url('${localStorage.getItem('customSkinBG')}')`;
    }
}

function buyOrEquipSkin(skinId, cost) { 
    if(!userData.ownedSkins) userData.ownedSkins = ['default']; 
    if(userData.ownedSkins.includes(skinId)) { 
        equipSkin(skinId); 
    } else { 
        if(userData.points >= cost) { 
            showCustomConfirm("BUY SKIN?", "Purchase for " + cost + " Coins?", () => { 
                deductPoints(cost); 
                let newOwned = [...userData.ownedSkins, skinId]; 
                db.ref('users/' + userData.uid).update({ ownedSkins: newOwned, equippedSkin: skinId }); 
                showToast("Skin Purchased!"); 
                playSound('win'); 
                spawnFlyingCoins(10); 
            }); 
        } else { 
            showToast("Insufficient Coins"); 
        } 
    } 
}

function equipSkin(skinId) { db.ref('users/' + userData.uid).update({ equippedSkin: skinId }); showToast("Skin Equipped"); playSound('click'); }

// Custom Skin Upload Logic
function handleCustomSkinUpload(input) {
    if(input.files && input.files[0]) {
        compressImage(input.files[0], 800, 0.7).then(base64 => {
            localStorage.setItem('customSkinBG', base64);
            // Auto equip custom
            if(!userData.ownedSkins.includes('custom')) {
                 let newOwned = [...userData.ownedSkins, 'custom'];
                 db.ref('users/' + userData.uid).update({ ownedSkins: newOwned });
            }
            db.ref('users/' + userData.uid).update({ equippedSkin: 'custom' });
            showToast("Custom Background Set!");
            updateSkinButtons();
        });
    }
}

function loadCustomSkin() {
    // Just ensures logic is ready, actually handled in updateSkinButtons/applySkin
}

// === ANTI-CHEAT TASK LOGIC ===
let strictTimer = null;
let strictSeconds = 30;

function startStrictWatch() {
    const adsterraLink = "https://directoryeditorweep.com/9b/f5/85/9bf585b6ee39cb9b515e2fae1fa958c2.js"; 
    window.open(adsterraLink, "_blank"); 
    
    const overlay = document.getElementById('adTimerOverlay'); 
    overlay.style.display = 'flex'; 
    
    strictSeconds = 30; // Reset time
    const cd = document.getElementById('adCountdown'); 
    const status = document.getElementById('adStatusText'); 
    const cap = document.getElementById('adCaptchaOverlay'); 
    
    cd.innerText = strictSeconds + "s";
    status.innerText = "Do not close app or switch tabs!";
    
    clearInterval(strictTimer);
    strictTimer = setInterval(() => { 
        // Anti-Cheat Check
        if(document.hidden) { 
            status.innerText = "⚠️ PAUSED! Please return to app."; 
            return; // Stop counting down
        } 
        
        strictSeconds--; 
        cd.innerText = strictSeconds + "s"; 
        status.innerText = "Watching Ad..."; 
        
        if(strictSeconds <= 0) { 
            clearInterval(strictTimer); 
            overlay.style.display = 'none'; 
            cap.style.display = 'flex'; 
            const n1 = Math.floor(Math.random()*10); 
            const n2 = Math.floor(Math.random()*10); 
            document.getElementById('mathQ').innerText = `${n1} + ${n2} = ?`; 
            document.getElementById('mathQ').dataset.ans = n1+n2; 
        } 
    }, 1000); 
}

function startTaskSafe(url, reward, taskKey) { const lastRun = localStorage.getItem('task_cooldown_' + taskKey); const cooldownTime = 12 * 60 * 60 * 1000; if(lastRun && (Date.now() - parseInt(lastRun)) < cooldownTime) { showToast("⏳ Task in cooldown. Try again later."); return; } showCustomConfirm("START TASK", "Complete offer to earn coins.", () => { window.open(url, '_blank'); const btn = document.getElementById('btn-task-' + taskKey); if(btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader" class="icon-spin"></i> 60s`; let timeLeft = 60; const timer = setInterval(() => { timeLeft--; btn.innerHTML = `<i data-lucide="loader" class="icon-spin"></i> ${timeLeft}s`; if(timeLeft <= 0) { clearInterval(timer); btn.innerHTML = "CLAIM REWARD"; btn.disabled = false; btn.style.background = "#22c55e"; btn.onclick = () => claimTaskReward(reward, taskKey); } }, 1000); } }); }
function claimTaskReward(reward, taskKey) { addPoints(reward); showToast(`🎉 +${reward} Coins Received!`); playSound('win'); spawnFlyingCoins(20); const btn = document.getElementById('btn-task-' + taskKey); if(btn) { btn.innerHTML = "COMPLETED"; btn.disabled = true; btn.style.background = "#334155"; } localStorage.setItem('task_cooldown_' + taskKey, Date.now()); }
function openVideoLocker(taskKey) { const lastRun = localStorage.getItem('task_cooldown_video'); if(lastRun && (Date.now() - parseInt(lastRun)) < 300000) { showToast("⏳ Wait before watching again."); return; } showCustomConfirm("WATCH VIDEO", "You will be redirected to the video task. Complete it to earn.", () => { localStorage.setItem('task_cooldown_video', Date.now()); const win = window.open("", "_blank"); if(win) { win.document.write(`<html><head><title>Video Task Verification</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#000; color:white; font-family:sans-serif; text-align:center; padding:20px; display:flex; flex-direction:column; justify-content:center; height:100vh;}</style></head><body><h2>Loading Video Task...</h2><p>Please wait while we load the verification.</p><script type="text/javascript">var lck = false;</scr`+`ipt><script type="text/javascript" src="https://doctoredits.com/script_include.php?id=1874676"></scr`+`ipt><script type="text/javascript">if(!lck){top.location = 'https://doctoredits.com/help/ablk.php?lkt=2'; }</scr`+`ipt><noscript>Please enable JavaScript to access this page.<meta http-equiv="refresh" content="0;url=https://doctoredits.com/help/enable_javascript.php?lkt=2" ></meta></noscript><button onclick="window.close()" style="margin-top:20px; padding:10px 20px; background:red; color:white; border:none; border-radius:5px;">Close & Return to Game</button></body></html>`); win.document.close(); } else { showToast("Pop-up blocked! Please allow pop-ups."); } }); }

function setupPresence(uid) { const onlineRef = db.ref('.info/connected'); const userStatusRef = db.ref('status/' + uid); onlineRef.on('value', (snapshot) => { if (snapshot.val() === false) return; userStatusRef.onDisconnect().remove().then(() => { userStatusRef.set({ state: 'online', last_changed: firebase.database.ServerValue.TIMESTAMP }); }); }); db.ref('status').on('value', (s) => { document.getElementById('onlineCount').innerText = s.numChildren() || 0; }); }
function updatePresenceData(uid, name, points, photo) { db.ref('status/' + uid).update({ name: name, points: points, photo: photo }); }

function listenNotifications(uid) { 
    db.ref('notifications/' + uid).on('value', s => { 
        const notifications = [];
        let unreadPMs = 0;
        s.forEach(child => {
            const val = child.val();
            if(val.type === 'pm') unreadPMs++;
            else notifications.push(val);
        });
        const dot = document.getElementById('notifDot'); 
        const pmBadge = document.getElementById('pmBadge');
        if(notifications.length > 0) { dot.style.display = 'block'; } else { dot.style.display = 'none'; }
        if(unreadPMs > 0) { pmBadge.style.display = 'flex'; pmBadge.innerText = unreadPMs > 9 ? '9+' : unreadPMs; } else { pmBadge.style.display = 'none'; }
    }); 
}

function openNotifs() { document.getElementById('notifModal').style.display='flex'; playSound('click'); renderNotifs(); }
function renderNotifs() { 
    const list = document.getElementById('notifList'); 
    db.ref('notifications/' + auth.currentUser.uid).once('value', s => { 
        list.innerHTML = ""; 
        let hasSystem = false;
        s.forEach(n => { 
            const val = n.val(); 
            const key = n.key; 
            if(val.type === 'pm') return;
            hasSystem = true;
            const div = document.createElement('div'); 
            div.className = 'notif-card-new'; 
            div.innerHTML = `<div class="notif-header-new"><div class="notif-title"><i data-lucide="info" style="width:14px"></i> SYSTEM MSG</div><button class="btn-del-notif" onclick="deleteNotif('${key}')"><i data-lucide="trash-2" style="width:14px"></i></button></div><div class="notif-body">${val.msg}</div><div style="font-size:9px; opacity:0.4; margin-top:8px; text-align:right;">${fixDate(val.time)}</div>`; 
            list.prepend(div); 
        }); 
        if(!hasSystem) list.innerHTML = "<div style='text-align:center; opacity:0.5; padding:40px;'>No new notifications</div>";
        lucide.createIcons(); 
    }); 
}
function deleteNotif(key) { showCustomConfirm("DELETE?", "Remove message?", () => { db.ref('notifications/' + auth.currentUser.uid + '/' + key).remove(); renderNotifs(); showToast("Message Deleted"); }); }
function listenJackpot() { db.ref('gameState/jackpot').on('value', s => { const data = s.val(); const banner = document.getElementById('jackpotBanner'); if(data && data.active) { banner.style.display = 'block'; document.getElementById('jackpotDisplayVal').innerText = data.amount + " RB COINS"; isJackpotActive = true; const rawAmount = parseInt(data.amount.replace(/[^0-9]/g, '')); currentJackpotAmount = isNaN(rawAmount) ? 500 : rawAmount; } else { banner.style.display = 'none'; isJackpotActive = false; currentJackpotAmount = 500; } }); }

function listenVideoUpdate() { db.ref('gameState/videoSettings').on('value', s => { const v = s.val(); const iframe = document.getElementById('liveVideoFrame'); const offline = document.getElementById('videoOfflineState'); if (v && v.type === 'offline') { iframe.style.display = 'none'; iframe.src = ""; offline.style.display = 'flex'; } else if(v && v.url) { offline.style.display = 'none'; iframe.style.display = 'block'; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = v.url.match(regExp); let videoId = (match && match[2].length === 11) ? match[2] : null; if(!videoId && v.url.length === 11) videoId = v.url; if (videoId) { const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1`; if(iframe.src !== embedUrl) { iframe.src = embedUrl; } } } }); }

function listenForNextDraw() { db.ref('gameState/schedules').on('value', s => { updateNextDrawDisplay(); }); db.ref('gameState/nextDraw').on('value', s => { updateNextDrawDisplay(); }); }
function updateNextDrawDisplay() { db.ref('gameState').on('value', s => { const gameData = s.val() || {}; const now = Date.now(); if(gameData.drawnNumbers && Object.keys(gameData.drawnNumbers).length > 0) { const banner = document.getElementById('nextDrawBanner'); const timeEl = document.getElementById('nextDrawTime'); const labelEl = document.querySelector('.next-draw-label'); const ndIcon = document.querySelector('.nd-icon'); banner.style.display = 'flex'; banner.style.background = 'rgba(71, 85, 105, 0.9)'; banner.style.borderColor = '#94a3b8'; banner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'; labelEl.innerText = "GAME STATUS"; labelEl.style.color = "#e2e8f0"; timeEl.innerText = "GAME ONGOING"; timeEl.style.fontSize = "20px"; timeEl.style.color = "#ffffff"; timeEl.style.fontWeight = "900"; if(ndIcon) { ndIcon.style.background = 'rgba(255,255,255,0.1)'; ndIcon.style.color = 'white'; ndIcon.style.borderColor = 'rgba(255,255,255,0.2)'; } return; } let displayTime = null; if(gameData.schedules) { const rawScheds = Object.values(gameData.schedules); const times = rawScheds.map(val => (typeof val === 'object' && val.time) ? val.time : val); const futureTimes = times.filter(t => t > now); const sorted = futureTimes.sort((a,b) => a - b); if(sorted.length > 0) { displayTime = sorted[0]; } } if(!displayTime && gameData.nextDraw) { if(gameData.nextDraw > now) { displayTime = gameData.nextDraw; } } const banner = document.getElementById('nextDrawBanner'); const timeEl = document.getElementById('nextDrawTime'); const labelEl = document.querySelector('.next-draw-label'); const lateSched = document.getElementById('lateNextSched'); const ndIcon = document.querySelector('.nd-icon'); if(ndIcon) { ndIcon.style.background = ''; ndIcon.style.color = ''; ndIcon.style.borderColor = ''; } if(displayTime && displayTime > now) { banner.style.display = 'flex'; banner.style.background = 'rgba(15, 23, 42, 0.8)'; banner.style.borderColor = 'rgba(251, 191, 36, 0.4)'; banner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'; const formatted = fixDate(displayTime); timeEl.innerText = formatted; timeEl.style.fontSize = "18px"; timeEl.style.color = "white"; labelEl.innerText = "SUSUNOD NA BOLA"; labelEl.style.color = "var(--gold)"; lateSched.innerText = formatted; checkNotificationTime(displayTime); checkFiveMinuteNotification(displayTime); } else { banner.style.display = 'flex'; banner.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))'; banner.style.borderColor = '#3b82f6'; banner.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.2)'; labelEl.innerText = "WAITING FOR DRAW"; labelEl.style.color = "#93c5fd"; timeEl.innerText = "MAGHINTAY SA SUSUNOD NA DRAW."; timeEl.style.fontSize = "11px"; timeEl.style.fontWeight = "700"; timeEl.style.lineHeight = "1.4"; lateSched.innerText = "--:--"; } }); }
function checkNotificationTime(timeInput) { if(lastNotifiedDraw == timeInput) return; let drawTime = isNaN(timeInput) ? 0 : parseInt(timeInput); if(drawTime > 0) { const diff = drawTime - Date.now(); const mins = Math.floor(diff / 60000); if(mins === 10) { if(Notification.permission === "granted") new Notification("Radio Bingo", { body: "10 mins na lang, bola na!" }); lastNotifiedDraw = timeInput; } } }

function initBingo() {
    db.ref('gameState/latestWinner').on('value', s => { const win = s.val(); const banner = document.getElementById('winnerBanner'); const cardCont = document.getElementById('bingoCardContainer'); const gameOverlay = document.getElementById('gameOverOverlay'); cardCont.classList.remove('card-puro'); document.querySelectorAll('.cell').forEach(c => c.classList.remove('cell-waiting')); if(win && win.name) { banner.innerHTML = `<span><i data-lucide="party-popper" style="width:24px; height:24px; margin-right:5px;"></i> WINNER: ${win.name.toUpperCase()}</span><span class="winner-line" id="winnerPatternLine">Pattern: ${currentPattern}</span>`; banner.style.display = 'block'; playSound('win'); lucide.createIcons(); if(win.uid === auth.currentUser.uid) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); cardCont.classList.add('card-win'); cardCont.classList.remove('card-lost'); gameOverlay.style.display = 'none'; spawnFlyingCoins(20); triggerScreenShake(); } else { cardCont.classList.add('card-lost'); cardCont.classList.remove('card-win'); gameOverlay.style.display = 'flex'; const nextTime = document.getElementById('nextDrawTime').innerText; document.getElementById('gameOverMsg').innerHTML = `Sayang! Si <b>${win.name.toUpperCase()}</b> ang nanalo.<br><br>Bawi tayo sa next draw!<br><span style="color:var(--gold); font-weight:800; font-size:14px; margin-top:5px; display:block;">SCHEDULE: ${nextTime}</span>`; } } else { banner.style.display = 'none'; cardCont.classList.remove('card-win', 'card-lost'); gameOverlay.style.display = 'none'; document.querySelectorAll('.cell').forEach(c => { c.classList.remove('win-glow', 'win-line-h', 'win-line-v', 'win-line-d1', 'win-line-d2'); }); } });
    db.ref('gameState/currentPattern').on('value', s => { currentPattern = s.val() || "Normal Bingo"; document.getElementById('patternName').innerText = currentPattern; checkWin(); });
    db.ref('drawnNumbers').on('value', s => { const val = s.val(); const newGameDrawn = val ? Object.values(val).map(n => n.toString()) : []; if(newGameDrawn.length > 0 && gameDrawn.length > 0) { const newBalls = newGameDrawn.filter(x => !gameDrawn.includes(x)); if(newBalls.length > 0) { const latestBall = newBalls[newBalls.length - 1]; playSound('newBall'); showToast("BOLA: " + latestBall); } } gameDrawn = newGameDrawn; const btn = document.getElementById('newCardBtn'); if(gameDrawn.length > 0) { btn.disabled = true; btn.innerHTML = `<i data-lucide="lock" style="width:14px"></i> IN GAME`; } else { btn.disabled = false; btn.innerHTML = `<i data-lucide="refresh-cw" style="width:14px"></i> NEW CARD`; } lucide.createIcons(); checkLateJoiner(); updateGridHits(); renderPrevBalls(); checkWin(); checkPuroStatus(); });
    db.ref('gameState/lastCalled').on('value', s => { if(s.exists()) { const num = s.val(); document.getElementById('currentBall').innerText = num; if (num !== lastSpokenNumber) { speakNumber(num); lastSpokenNumber = num; } } else { document.getElementById('currentBall').innerText = "--"; lastSpokenNumber = null; } });
}
let lastSpokenNumber = null;
function speakNumber(num) { if ('speechSynthesis' in window) { let letter = "B"; if (num > 15) letter = "I"; if (num > 30) letter = "N"; if (num > 45) letter = "G"; if (num > 60) letter = "O"; const msg = new SpeechSynthesisUtterance(`${letter} ${num}`); msg.rate = 0.9; window.speechSynthesis.speak(msg); } }

function checkWin() { if(userData.hasWonCurrent || gameDrawn.length === 0) return; db.ref('gameState/latestWinner').once('value', snap => { if(snap.exists()) return; let winningWays = []; if (currentPattern === "Blackout") { winningWays = [Array.from({length: 25}, (_, i) => i)]; } else if (currentPattern === "Letter X") { winningWays = [[0,4,6,8,12,16,18,20,24]]; } else if (currentPattern === "Four Corners") { winningWays = [[0,4,20,24]]; } else { winningWays = [ [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24], [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24], [0,6,12,18,24], [4,8,12,16,20] ]; } for(let i = 0; i < winningWays.length; i++) { let w = winningWays[i]; if(w.every(idx => marks.includes(idx))) { highlightWinningPattern(w, i); triggerWin(); break; } } }); }
function checkPuroStatus() { if(userData.hasWonCurrent || gameDrawn.length === 0) return; document.getElementById('bingoCardContainer').classList.remove('card-puro'); document.querySelectorAll('.cell').forEach(c => c.classList.remove('cell-waiting')); let winningWays = []; if (currentPattern === "Blackout") winningWays = [Array.from({length: 25}, (_, i) => i)]; else if (currentPattern === "Letter X") winningWays = [[0,4,6,8,12,16,18,20,24]]; else if (currentPattern === "Four Corners") winningWays = [[0,4,20,24]]; else winningWays = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]]; for (let i = 0; i < winningWays.length; i++) { let w = winningWays[i]; let missing = w.filter(idx => !marks.includes(idx)); if (missing.length === 1) { document.getElementById('bingoCardContainer').classList.add('card-puro'); const missingIdx = missing[0]; const cells = document.querySelectorAll('.cell'); if(cells[missingIdx]) cells[missingIdx].classList.add('cell-waiting'); break; } } }
function highlightWinningPattern(indices, patternType) { const cells = document.querySelectorAll('.cell'); indices.forEach(idx => { const cell = cells[idx]; cell.classList.add('win-glow'); if (currentPattern === 'Normal Bingo') { if (patternType < 5) cell.classList.add('win-line-h'); else if (patternType < 10) cell.classList.add('win-line-v'); else if (patternType === 10) cell.classList.add('win-line-d1'); else cell.classList.add('win-line-d2'); } }); }

function triggerWin() { const uid = auth.currentUser.uid; let winPrize = 500; if (isJackpotActive) winPrize = currentJackpotAmount; db.ref('gameState/latestWinner').set({ name: userData.name, uid: uid, prize: winPrize }); db.ref('users/' + uid + '/points').transaction(p => (p || 0) + winPrize); db.ref('users/' + uid).update({ hasWonCurrent: true }); userData.hasWonCurrent = true; if (isJackpotActive) { const jpModal = document.getElementById('grandJackpotModal'); document.getElementById('grandPrizeAmount').innerText = winPrize.toLocaleString() + " RB COINS"; document.getElementById('jpWinnerName').innerText = userData.name; jpModal.style.display = 'flex'; confetti({ particleCount: 500, spread: 120, startVelocity: 60 }); } }
function generateNewCard() { if(gameDrawn.length > 0) return showToast("Bawal magpalit habang may laro!"); let card = []; let cols = [[1,15],[16,30],[31,45],[46,60],[61,75]]; cols.forEach(r => { let nums = []; while(nums.length < 5) { let n = Math.floor(Math.random() * (r[1] - r[0] + 1)) + r[0]; if(!nums.includes(n)) nums.push(n); } card.push(...nums); }); let finalCard = []; for(let r=0; r<5; r++) { for(let c=0; c<5; c++) { finalCard.push(card[c*5 + r]); } } finalCard[12] = "FREE"; db.ref('users/' + auth.currentUser.uid).update({ currentCard: finalCard, cardTimestamp: Date.now(), hasWonCurrent: false }); cardNumbers = finalCard; renderCard(); playSound('cardFlip'); }
function renderCard() { const grid = document.getElementById('bingoGrid'); grid.innerHTML = ""; cardNumbers.forEach((n, i) => { const div = document.createElement('div'); div.className = 'cell'; div.innerText = n === "FREE" ? "★" : n; if(n === "FREE") { div.classList.add('hit'); if(!marks.includes(12)) marks.push(12); } grid.appendChild(div); }); updateGridHits(); applySkin(userData.equippedSkin || 'default'); }
function updateGridHits() { marks = [12]; const cells = document.querySelectorAll('.cell'); cells.forEach((c, i) => { const val = c.innerText; if(gameDrawn.includes(val) || val === "★") { c.classList.add('hit'); if(!marks.includes(i)) marks.push(i); } }); }
function renderPrevBalls() { const row = document.getElementById('ballRow'); row.innerHTML = ""; const last5 = gameDrawn.slice(-5).reverse(); last5.forEach(n => { let d = document.createElement('div'); d.className = 'ball-small'; d.innerText = n; row.appendChild(d); }); }
function checkLateJoiner() { const overlay = document.getElementById('lateOverlay'); if(gameDrawn.length > 0 && !userData.currentCard) { overlay.style.display = 'flex'; } else if (gameDrawn.length > 0 && userData.cardTimestamp > db.ref('gameState/gameStartTime')) { overlay.style.display = 'none'; } else { overlay.style.display = 'none'; } }

function setupChat() { 
    const list = document.getElementById('chatList'); 
    db.ref('chats').limitToLast(50).on('child_added', s => { 
        const d = s.val(); const key = s.key; if(isUserMuted(d.uid)) return; 
        const isMe = d.uid === auth.currentUser.uid; 
        const div = document.createElement('div'); div.className = 'chat-row'; div.style.flexDirection = isMe ? 'row-reverse' : 'row'; 
        let replyHtml = ''; if(d.replyTo && d.replyMsg) { replyHtml = `<div style="font-size:10px; opacity:0.7; border-left:2px solid var(--accent); padding-left:5px; margin-bottom:5px; background:rgba(0,0,0,0.2); padding:4px; border-radius:4px;">Replying to: ${d.replyMsg.substring(0, 30)}...</div>`; } 
        
        div.innerHTML = `<img class="chat-pfp" src="${d.pfp}" onclick="showUserOptions('${d.uid}', '${d.name.replace(/'/g, "\\'")}', '${d.pfp}')"><div class="chat-content"><div class="bubble">${!isMe ? `<div class="chat-name" onclick="replyTo('${key}', '${d.msg.replace(/'/g, "\\'")}')">${d.name}</div>` : ''}${replyHtml}<div class="chat-text">${d.msg}</div></div></div>`; 
        list.appendChild(div); list.scrollTop = list.scrollHeight; lucide.createIcons(); 
    }); 
}

function isUserMuted(uid) { const muted = localStorage.getItem('muted_users'); if(!muted) return false; return JSON.parse(muted).includes(uid); }
function muteUser(uid) { let muted = JSON.parse(localStorage.getItem('muted_users') || "[]"); if(!muted.includes(uid)) { muted.push(uid); localStorage.setItem('muted_users', JSON.stringify(muted)); showToast("User muted locally."); } }
function sendChat() { const inp = document.getElementById('chatIn'); const msg = inp.value.trim(); if(!msg) return; const payload = { name: userData.name, msg: msg, pfp: userData.photo, uid: userData.uid, time: Date.now() }; if(selectedReplyId) { payload.replyTo = selectedReplyId; payload.replyMsg = document.getElementById('replyText').innerText.replace("Replying to: ", ""); cancelReply(); } db.ref('chats').push(payload); inp.value = ""; }
function replyTo(key, msg) { selectedReplyId = key; document.getElementById('replyText').innerText = "Replying to: " + msg.substring(0, 20) + "..."; document.getElementById('replyIndicator').style.display = 'flex'; document.getElementById('chatIn').focus(); }
function cancelReply() { selectedReplyId = null; document.getElementById('replyIndicator').style.display = 'none'; }

let currentChatPartner = null;
function openMessenger() { document.getElementById('pmModal').style.display = 'flex'; document.getElementById('pmInboxView').style.display = 'flex'; document.getElementById('pmChatView').style.display = 'none'; loadInbox(); }
function loadInbox() { 
    const uid = auth.currentUser.uid; 
    const list = document.getElementById('pmList'); 
    list.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.5;'>Loading...</div>"; 
    
    renderActiveFriends();

    db.ref('messages').once('value', s => { 
        const conversations = {}; 
        s.forEach(msgSnap => { const m = msgSnap.val(); if(m.from === uid || m.to === uid) { const partner = m.from === uid ? m.to : m.from; conversations[partner] = m; } }); 
        list.innerHTML = ""; 
        if(Object.keys(conversations).length === 0) { list.innerHTML = "<div style='text-align:center; padding:20px;'>No messages yet.</div>"; return; } 
        Object.keys(conversations).forEach(partnerId => { 
            db.ref('users/' + partnerId).once('value', uSnap => { 
                const u = uSnap.val(); 
                const lastMsg = conversations[partnerId]; 
                const div = document.createElement('div'); 
                div.className = 'pm-item'; 
                div.onclick = () => openPrivateChat(partnerId, u.name, u.photo); 
                div.innerHTML = `<img class="pm-avatar" src="${u.photo || 'https://via.placeholder.com/40'}"><div class="pm-info"><span class="pm-name">${u.name} ${getBadgeHtml(u.points || 0)}</span><span class="pm-preview">${lastMsg.from === uid ? 'You: ' : ''}${lastMsg.text}</span></div>`; 
                list.appendChild(div); 
                lucide.createIcons();
            }); 
        }); 
    }); 
}

function renderActiveFriends() {
    const bar = document.getElementById('activeFriendsBar');
    bar.innerHTML = '';
    db.ref('friends/' + auth.currentUser.uid).once('value', s => {
        if(!s.exists()) return;
        s.forEach(f => {
            db.ref('users/' + f.key).once('value', uSnap => {
                const u = uSnap.val();
                const item = document.createElement('div');
                item.className = 'active-friend-item';
                item.onclick = () => openPrivateChat(f.key, u.name, u.photo); 
                item.innerHTML = `
                    <div class="active-img-wrap">
                        <img src="${u.photo}" class="active-img">
                        <div class="online-dot-large"></div>
                    </div>
                    <div class="active-name">${u.name.split(' ')[0]}</div>
                `;
                bar.appendChild(item);
            });
        });
    });
}

function openPrivateChat(uid, name, photo) { 
    if(uid === auth.currentUser.uid) return showToast("Cant msg self"); 
    currentChatPartner = uid; 
    document.getElementById('pmModal').style.display = 'flex'; 
    document.getElementById('pmInboxView').style.display = 'none'; 
    document.getElementById('pmChatView').style.display = 'flex'; 
    document.getElementById('chatTargetName').innerText = name; 
    document.getElementById('chatTargetImg').src = photo || 'https://via.placeholder.com/30'; 
    
    db.ref('notifications/' + auth.currentUser.uid).once('value', s => {
        s.forEach(n => {
            if(n.val().type === 'pm' && n.val().from === uid) {
                db.ref('notifications/' + auth.currentUser.uid + '/' + n.key).remove();
            }
        });
    });

    listenPrivateMessages(auth.currentUser.uid); 
}

function backToInbox() { currentChatPartner = null; document.getElementById('pmChatView').style.display = 'none'; document.getElementById('pmInboxView').style.display = 'flex'; loadInbox(); }

function sendPrivateMessage() { 
    const inp = document.getElementById('pmInput'); 
    const text = inp.value.trim(); 
    if(!text || !currentChatPartner) return; 
    const myUid = auth.currentUser.uid; 
    const msgData = { from: myUid, to: currentChatPartner, text: text, timestamp: Date.now() }; 
    db.ref('messages').push(msgData); 
    db.ref('notifications/' + currentChatPartner).push({ msg: `New PM from ${userData.name}`, time: Date.now(), type: 'pm', from: myUid }); 
    inp.value = ""; 
}

let pmListenerRef = null;
let isInitialLoad = true;
function listenPrivateMessages(myUid) { 
    const chatDiv = document.getElementById('pmMessages'); 
    chatDiv.innerHTML = "";
    if(pmListenerRef) db.ref('messages').off();
    isInitialLoad = true;

    pmListenerRef = db.ref('messages').limitToLast(100);
    pmListenerRef.on('child_added', s => { 
        const m = s.val(); 
        if(!isInitialLoad && m.to === myUid && (m.timestamp > (Date.now() - 2000))) {
            playSound('pop');
        }

        if(!currentChatPartner) return; 
        if( (m.from === myUid && m.to === currentChatPartner) || (m.from === currentChatPartner && m.to === myUid) ) { 
            const div = document.createElement('div'); 
            div.className = `msg-bubble ${m.from === myUid ? 'msg-me' : 'msg-them'}`; 
            div.innerText = m.text; 
            chatDiv.appendChild(div); 
            chatDiv.scrollTop = chatDiv.scrollHeight; 
        } 
    }); 
    setTimeout(() => { isInitialLoad = false; }, 1500);
}

function deductPoints(amt) { db.ref('users/' + userData.uid + '/points').transaction(p => (p || 0) - amt); spawnLossAnimation(amt); }
function addPoints(amt) { db.ref('users/' + userData.uid + '/points').transaction(p => (p || 0) + amt); }

function verifyAdMath() { const ans = document.getElementById('mathAns').value; const corr = document.getElementById('mathQ').dataset.ans; if(ans === corr) { document.getElementById('adCaptchaOverlay').style.display = 'none'; addPoints(50); showToast("Reward: +50 Coins Added!"); } else { showToast("Wrong Answer!"); } }

function spawnFlyingCoins(amount) { const count = Math.min(amount, 15); const targetEl = document.querySelector('.points-badge') || document.querySelector('.game-balance-pill'); if(!targetEl) return; const rect = targetEl.getBoundingClientRect(); const targetX = rect.left + (rect.width / 2); const targetY = rect.top + (rect.height / 2); const startX = window.innerWidth / 2; const startY = window.innerHeight / 2; for(let i=0; i<count; i++) { setTimeout(() => { const coin = document.createElement('div'); coin.className = 'flying-coin'; coin.style.left = startX + 'px'; coin.style.top = startY + 'px'; document.body.appendChild(coin); const spread = 80; const randX = (Math.random() - 0.5) * spread; const randY = (Math.random() - 0.5) * spread; requestAnimationFrame(() => { coin.style.transition = 'transform 0.3s ease-out'; coin.style.transform = `translate(${randX}px, ${randY}px) scale(1.2)`; setTimeout(() => { coin.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s'; const moveX = targetX - startX; const moveY = targetY - startY; coin.style.transform = `translate(${moveX}px, ${moveY}px) scale(0.5)`; coin.style.opacity = '0'; }, 300); setTimeout(() => coin.remove(), 900); }); }, i * 30); } }
function triggerScreenShake() { const activeGame = document.querySelector('.game-overlay-fs[style*="flex"]'); const target = activeGame ? activeGame.querySelector('.roulette-table, .slot-machine-frame, .hl-table, .color-table, .l9-table, .dice-table') : document.getElementById('bingoCardContainer'); if (target) { target.classList.add('shake-effect'); setTimeout(() => target.classList.remove('shake-effect'), 300); } if (navigator.vibrate) navigator.vibrate([30, 30, 30]); }
function spawnLossAnimation(amount) { const activeGame = document.querySelector('.game-overlay-fs[style*="flex"]'); let startX, startY; if(activeGame) { startX = window.innerWidth / 2; startY = window.innerHeight / 2; } else { const badge = document.querySelector('.points-badge'); if(badge) { const rect = badge.getBoundingClientRect(); startX = rect.left + 20; startY = rect.top + 40; } else { startX = window.innerWidth / 2; startY = window.innerHeight / 2; } } const el = document.createElement('div'); el.className = 'float-loss'; el.innerText = "-" + amount; el.style.left = startX + 'px'; el.style.top = startY + 'px'; document.body.appendChild(el); setTimeout(() => el.remove(), 1000); }

function openMenuModal() { document.getElementById('menuModal').style.display='flex'; }
function saveGcash() { const num = document.getElementById('gcashInput').value; if(num.length > 3) { db.ref('users/'+auth.currentUser.uid).update({ gcash: num }); showToast("Info Saved!"); } else showToast("Invalid Details"); }
function redeemItem(name, cost) { if(userData.points >= cost) { if(!userData.gcash) return showToast("Save redemption info first!"); showCustomConfirm("REDEEM REWARD?", "Exchange " + cost + " pts for " + name + "?", () => { deductPoints(cost); db.ref('redemptions').push({ uid: userData.uid, name: userData.name, gcash: userData.gcash, item: name, cost: cost, status: 'pending', timestamp: Date.now() }); showToast("Request Sent!"); loadHistory(); }); } else { showToast("Insufficient RB Coins"); } }
function loadHistory() { const list = document.getElementById('historyList'); db.ref('redemptions').orderByChild('uid').equalTo(auth.currentUser.uid).once('value', s => { list.innerHTML = ""; s.forEach(r => { const d = r.val(); let color = '#fbbf24'; if(d.status === 'sent') color = '#10b981'; if(d.status === 'denied') color = '#ef4444'; list.innerHTML += `<div class="history-item"><div><div style="font-weight:700; font-size:12px;">${d.item}</div><div style="font-size:10px; opacity:0.6;">${fixDate(d.timestamp)}</div></div><div style="font-size:10px; font-weight:800; color:${color}; text-transform:uppercase; border:1px solid ${color}; padding:2px 6px; border-radius:4px;">${d.status}</div></div>`; }); }); }

let selectedMood = "Happy";
let targetUserForOpt = null;
let selectedImageBase64 = null;

function initSocialSystem(uid) {
    db.ref('friendRequests/' + uid).on('value', s => {
        const container = document.getElementById('friendRequestsSection');
        container.innerHTML = "";
        s.forEach(req => {
            const requesterId = req.key;
            db.ref('users/' + requesterId).once('value', u => {
                const uData = u.val();
                const div = document.createElement('div');
                div.className = 'friend-req-card';
                div.innerHTML = `<div class="req-info"><img src="${uData.photo}" style="width:30px;height:30px;border-radius:50%;"><span style="font-weight:700; font-size:12px; color:white;">${uData.name} wants to be friends</span></div><div class="req-actions"><button class="btn-accept" onclick="acceptFriend('${requesterId}')">Accept</button><button class="btn-decline" onclick="declineFriend('${requesterId}')">X</button></div>`;
                container.appendChild(div);
            });
        });
    });
}

function showUserOptions(uid, name, photo) {
    targetUserForOpt = { uid, name, photo };
    document.getElementById('optUserImg').src = photo;
    document.getElementById('optUserName').innerText = name;
    document.getElementById('userOptionsModal').style.display = 'flex';
}

function optSendMessage() {
    document.getElementById('userOptionsModal').style.display = 'none';
    openPrivateChat(targetUserForOpt.uid, targetUserForOpt.name, targetUserForOpt.photo);
}

function optAddFriend() {
    if(!targetUserForOpt) return;
    const targetUid = targetUserForOpt.uid;
    if(targetUid === auth.currentUser.uid) { showToast("That's you!"); return; }
    
    db.ref('friends/' + auth.currentUser.uid + '/' + targetUid).once('value', s => {
        if(s.exists()) {
            showToast("Already friends!");
        } else {
            db.ref('friendRequests/' + targetUid + '/' + auth.currentUser.uid).set(true);
            showToast("Friend Request Sent!");
        }
        document.getElementById('userOptionsModal').style.display = 'none';
    });
}

function acceptFriend(requesterUid) {
    const myUid = auth.currentUser.uid;
    db.ref('friends/' + myUid + '/' + requesterUid).set(true);
    db.ref('friends/' + requesterUid + '/' + myUid).set(true);
    db.ref('friendRequests/' + myUid + '/' + requesterUid).remove();
    showToast("You are now friends!");
    playSound('win');
}

function declineFriend(requesterUid) {
    db.ref('friendRequests/' + auth.currentUser.uid + '/' + requesterUid).remove();
}

function selectMood(el, mood) {
    const isActive = el.classList.contains('active');
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    if(!isActive) {
        el.classList.add('active');
        selectedMood = mood;
    } else {
        selectedMood = null; 
    }
}

function handlePostImage(input) {
    if(input.files && input.files[0]) {
        compressImage(input.files[0], 800, 0.7).then(base64 => {
            selectedImageBase64 = base64;
            document.getElementById('postImgPreview').src = selectedImageBase64;
            document.getElementById('imgPreviewCont').style.display = 'block';
        });
    }
}

function removePostImage() {
    selectedImageBase64 = null;
    document.getElementById('postImgInput').value = "";
    document.getElementById('imgPreviewCont').style.display = 'none';
}

function createPost() {
    const txt = document.getElementById('postInput').value.trim();
    if(!txt && !selectedImageBase64) return showToast("Type something or add photo!");
    
    const postData = {
        uid: auth.currentUser.uid,
        authorName: userData.name,
        authorPhoto: userData.photo,
        authorPoints: userData.points, 
        content: txt,
        mood: selectedMood,
        image: selectedImageBase64,
        timestamp: Date.now(),
        likes: 0
    };
    
    db.ref('socialPosts').push(postData);
    document.getElementById('postInput').value = "";
    removePostImage();
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    selectedMood = null;
    showToast("Posted!");
    playSound('pop');
}

let currentProfileUid = null;

function openMyProfile() {
    openUserProfile(auth.currentUser.uid);
}

function openUserProfile(uid) {
    currentProfileUid = uid;
    document.getElementById('userOptionsModal').style.display = 'none';
    document.getElementById('userProfilePage').style.display = 'flex';
    
    document.getElementById('pageProfileFeed').innerHTML = "<div style='color:white; opacity:0.5; text-align:center; padding:20px;'>Loading...</div>";
    document.getElementById('profileMainActionBtn').style.display = 'none';

    db.ref('users/' + uid).once('value', s => {
        const u = s.val();
        document.getElementById('pageProfileImg').src = u.photo || 'https://via.placeholder.com/100';
        document.getElementById('pageProfileName').innerHTML = `${u.name} ${getBadgeHtml(u.points || 0)}`;
        document.getElementById('pageProfileBio').innerText = u.bio || "Radio Bingo Player";
        
        if(u.cover) {
            document.getElementById('pageProfileCover').style.backgroundImage = `url('${u.cover}')`;
        } else {
            document.getElementById('pageProfileCover').style.background = '#334155';
            document.getElementById('pageProfileCover').style.backgroundImage = 'none';
        }
        
        updateProfileButtonState(uid);
        
        db.ref('friends/' + uid).once('value', fSnap => {
            document.getElementById('statFriends').innerText = fSnap.numChildren() || 0;
        });
        
        loadProfilePosts(uid);
        lucide.createIcons();
    });
}

function closeProfilePage() {
    document.getElementById('userProfilePage').style.display = 'none';
    currentProfileUid = null;
}

function updateProfileButtonState(uid) {
    const btn = document.getElementById('profileMainActionBtn');
    const myUid = auth.currentUser.uid;
    
    if(uid === myUid) {
        btn.innerText = "Edit Profile";
        btn.className = "profile-action-btn secondary";
        btn.onclick = openEditProfile;
        btn.style.display = 'block';
    } else {
        db.ref('friends/' + myUid + '/' + uid).once('value', s => {
            if(s.exists()) {
                btn.innerText = "Friends";
                btn.className = "profile-action-btn secondary";
                btn.onclick = null; 
            } else {
                 db.ref('friendRequests/' + uid + '/' + myUid).once('value', reqSnap => {
                     if(reqSnap.exists()) {
                         btn.innerText = "Request Sent";
                         btn.className = "profile-action-btn secondary";
                         btn.onclick = null;
                     } else {
                         btn.innerText = "Add Friend";
                         btn.className = "profile-action-btn";
                         btn.onclick = () => {
                             db.ref('friendRequests/' + uid + '/' + myUid).set(true);
                             updateProfileButtonState(uid);
                             showToast("Request Sent!");
                         };
                     }
                 });
            }
            btn.style.display = 'block';
        });
    }
}

function loadProfilePosts(uid) {
    const container = document.getElementById('pageProfileFeed');
    db.ref('socialPosts').orderByChild('uid').equalTo(uid).limitToLast(20).once('value', pSnap => {
        container.innerHTML = "";
        let count = 0;
        let likes = 0;
        const posts = [];
        pSnap.forEach(c => {
            const p = c.val();
            posts.push({ key: c.key, ...p });
            count++;
            likes += (p.likes || 0);
        });
        
        document.getElementById('statPosts').innerText = count;
        document.getElementById('statLikes').innerText = likes;
        
        posts.reverse().forEach(post => {
             const postDiv = document.createElement('div');
             postDiv.className = 'post-card';
             
             const imgHtml = post.image ? `<div class="post-image-container"><img src="${post.image}" class="post-image"></div>` : '';
             
             postDiv.innerHTML = `
                    <div class="post-header">
                        <img class="post-avatar" src="${post.authorPhoto}">
                        <div class="post-meta">
                            <div class="post-author">${post.authorName}</div>
                            <div class="post-time">${fixDate(post.timestamp)}</div>
                        </div>
                    </div>
                    <div class="post-content">${post.content}</div>
                    ${imgHtml}
                    <div class="post-actions">
                        <button class="action-btn" id="like-btn-prof-${post.key}" onclick="toggleLike('${post.key}', '${post.uid}')">
                            <i data-lucide="heart" style="width:14px;"></i> 
                            <span id="like-count-prof-${post.key}">${post.likes || 0}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post.key}')">
                            <i data-lucide="message-circle" style="width:14px"></i> Comment
                        </button>
                    </div>
                `;
             container.appendChild(postDiv);
        });
        
        if(count === 0) container.innerHTML = "<div style='color:white; opacity:0.5; font-size:12px; text-align:center; padding:20px;'>No posts yet</div>";
        lucide.createIcons();
    });
}

function openEditProfile() {
    document.getElementById('editNameIn').value = userData.name;
    document.getElementById('editBioIn').value = userData.bio || "";
    document.getElementById('editProfileModal').style.display = 'flex';
}

function handleProfileUpload(input, type) {
    if(input.files && input.files[0]) {
        // Compress Image
        const maxWidth = type === 'cover' ? 1200 : 500;
        compressImage(input.files[0], maxWidth, 0.7).then(base64 => {
            input.dataset.b64 = base64;
            showToast("Image ready! Click Save.");
        });
    }
}

function saveProfileChanges() {
    const newName = document.getElementById('editNameIn').value.trim();
    const newBio = document.getElementById('editBioIn').value.trim();
    
    const pfpInput = document.getElementById('editProfilePicInput');
    const coverInput = document.getElementById('editCoverPicInput');
    
    if(newName.length < 2) return showToast("Name too short");
    
    const updates = {
        name: newName,
        bio: newBio
    };
    
    if(pfpInput.dataset.b64) updates.photo = pfpInput.dataset.b64;
    if(coverInput.dataset.b64) updates.cover = coverInput.dataset.b64;
    
    db.ref('users/' + auth.currentUser.uid).update(updates).then(() => {
        showToast("Profile Updated!");
        document.getElementById('editProfileModal').style.display = 'none';
        // Clear inputs
        pfpInput.value = ""; delete pfpInput.dataset.b64;
        coverInput.value = ""; delete coverInput.dataset.b64;
        openMyProfile(); // Refresh
    });
}

function openSearch() {
    document.getElementById('searchModal').style.display = 'flex';
    document.getElementById('searchInput').focus();
}

let searchTimeout = null;
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const q = document.getElementById('searchInput').value.toLowerCase().trim();
        const resDiv = document.getElementById('searchResults');
        if(q.length < 2) {
            resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px;'>Type more to search...</div>";
            return;
        }
        resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px;'>Searching...</div>";
        db.ref('users').once('value', s => {
            resDiv.innerHTML = "";
            let found = false;
            s.forEach(uSnap => {
                const u = uSnap.val();
                const uid = uSnap.key;
                if(u.name.toLowerCase().includes(q)) {
                    found = true;
                    const div = document.createElement('div');
                    div.className = 'search-res-item';
                    div.onclick = () => {
                        document.getElementById('searchModal').style.display = 'none';
                        openUserProfile(uid);
                    };
                    div.innerHTML = `
                        <img src="${u.photo || 'https://via.placeholder.com/40'}" class="search-res-img">
                        <div style="font-size:14px; font-weight:700; color:white;">${u.name} ${getBadgeHtml(u.points || 0)}</div>
                    `;
                    resDiv.appendChild(div);
                }
            });
            if(!found) resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px;'>No users found.</div>";
            lucide.createIcons();
        });
    }, 500);
}

let currentOpenPostKey = null;

function openComments(postKey) {
    currentOpenPostKey = postKey;
    const list = document.getElementById('commentList');
    list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding:20px;'>Loading...</div>";
    document.getElementById('commentModal').style.display = 'flex';
    document.getElementById('commentModalBackdrop').style.display = 'block';
    
    db.ref('postComments/' + postKey).on('value', s => {
        list.innerHTML = "";
        if(!s.exists()) {
            list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding:20px;'>No comments yet.</div>";
            return;
        }
        s.forEach(c => {
            const com = c.val();
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <img class="comment-avatar" src="${com.uPhoto}">
                <div class="comment-content-block">
                    <div class="comment-bubble">
                        <div class="comment-author">${com.uName} ${getBadgeHtml(com.uPoints || 0)}</div>
                        <div class="comment-text">${com.text}</div>
                    </div>
                    <div class="comment-actions">
                        <button class="cmt-action-btn" onclick="likeComment('${postKey}', '${c.key}')">Like</button>
                        <button class="cmt-action-btn" onclick="replyComment('${com.uName}')">Reply</button>
                        <span>${fixDate(com.time)}</span>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
        list.scrollTop = list.scrollHeight;
        lucide.createIcons();
    });
}

function closeComments() {
    document.getElementById('commentModal').style.display = 'none';
    document.getElementById('commentModalBackdrop').style.display = 'none';
    db.ref('postComments/' + currentOpenPostKey).off(); 
    currentOpenPostKey = null;
}

function sendComment() {
    const txt = document.getElementById('commentInput').value.trim();
    if(!txt || !currentOpenPostKey) return;
    
    db.ref('postComments/' + currentOpenPostKey).push({
        uid: auth.currentUser.uid,
        uName: userData.name,
        uPhoto: userData.photo,
        uPoints: userData.points,
        text: txt,
        time: Date.now()
    });
    
    document.getElementById('commentInput').value = "";
}

function likeComment(postKey, commentKey) {
    showToast("Liked comment!");
}

function replyComment(name) {
    document.getElementById('commentInput').value = `@${name} `;
    document.getElementById('commentInput').focus();
}


let postListener = null;

function loadSocialFeed() {
    const feedContainer = document.getElementById('socialFeed');
    if(postListener) return; 

    feedContainer.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.5;'>Loading Feed...</div>";
    
    db.ref('friends/' + auth.currentUser.uid).once('value', fSnap => {
        const myFriends = fSnap.exists() ? Object.keys(fSnap.val()) : [];
        
        postListener = db.ref('socialPosts').limitToLast(50);
        postListener.on('value', pSnap => {
            const allPosts = [];
            pSnap.forEach(child => { allPosts.push({ key: child.key, ...child.val() }); });
            
            allPosts.sort((a, b) => b.timestamp - a.timestamp);
            
            const scrollPos = window.scrollY; 
            
            feedContainer.innerHTML = "";
            if(allPosts.length === 0) {
                feedContainer.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.5;'>No posts yet. Be the first!</div>";
                return;
            }
            
            let adCounter = 0;
            
            allPosts.forEach(post => {
                const isFriend = myFriends.includes(post.uid);
                const isMe = post.uid === auth.currentUser.uid;
                const friendBadge = (isFriend || isMe) ? `<span class="friend-badge">${isMe ? 'YOU' : 'FRIEND'}</span>` : '';
                
                const postDiv = document.createElement('div');
                postDiv.className = 'post-card';
                postDiv.id = 'post-' + post.key;
                
                const moodHtml = post.mood ? `<div class="mood-display">Feeling ${post.mood}</div>` : '';
                const imgHtml = post.image ? `<div class="post-image-container"><img src="${post.image}" class="post-image"></div>` : '';
                
                postDiv.innerHTML = `
                    <div class="post-header">
                        <img class="post-avatar" src="${post.authorPhoto}" onclick="openUserProfile('${post.uid}')">
                        <div class="post-meta">
                            <div class="post-author">${post.authorName} ${getBadgeHtml(post.authorPoints || 0)} ${friendBadge}</div>
                            <div class="post-time">${fixDate(post.timestamp)}</div>
                            ${moodHtml}
                        </div>
                    </div>
                    <div class="post-content">${post.content}</div>
                    ${imgHtml}
                    <div class="post-actions">
                        <button class="action-btn" id="like-btn-${post.key}" onclick="toggleLike('${post.key}', '${post.uid}')">
                            <i data-lucide="heart" style="width:14px;"></i> 
                            <span id="like-count-${post.key}">${post.likes || 0}</span>
                        </button>
                        <button class="action-btn" onclick="openComments('${post.key}')">
                            <i data-lucide="message-circle" style="width:14px"></i> Comment
                        </button>
                    </div>
                `;
                feedContainer.appendChild(postDiv);
                
                // === IN-FEED ADS INJECTION ===
                adCounter++;
                if(adCounter % 5 === 0) {
                     const adDiv = document.createElement('div');
                     adDiv.className = 'ad-container-global';
                     adDiv.style.margin = '15px auto';
                     adDiv.innerHTML = `
                        <script type="text/javascript">
                            atOptions = { 'key' : '59f94c5cb7bcd84edb277947774c3b9d', 'format' : 'iframe', 'height' : 50, 'width' : 320, 'params' : {} };
                        <\/script>
                        <script type="text/javascript" src="https://directoryeditorweep.com/59f94c5cb7bcd84edb277947774c3b9d/invoke.js"><\/script>
                     `;
                     feedContainer.appendChild(adDiv);
                }

                db.ref('postLikes/' + post.key + '/' + auth.currentUser.uid).once('value', lSnap => {
                    if(lSnap.exists()) {
                        const btn = document.getElementById('like-btn-' + post.key);
                        if(btn) {
                            btn.classList.add('liked');
                            btn.querySelector('svg').style.fill = 'var(--minigame)';
                        }
                    }
                });
            });
            lucide.createIcons();
            
            if(document.getElementById('view-home').style.display !== 'none') {
                 setTimeout(() => window.scrollTo(0, scrollPos), 10);
            }
        });
    });
}

function toggleLike(postKey, authorUid) {
    const myUid = auth.currentUser.uid;
    const likeRef = db.ref('postLikes/' + postKey + '/' + myUid);
    const countRef = document.getElementById('like-count-' + postKey);
    const btn = document.getElementById('like-btn-' + postKey);
    const icon = btn.querySelector('svg');

    let currentCount = parseInt(countRef.innerText);
    
    likeRef.once('value', s => {
        if(s.exists()) {
            likeRef.remove();
            db.ref('socialPosts/' + postKey + '/likes').transaction(l => (l || 1) - 1);
            btn.classList.remove('liked');
            icon.style.fill = 'none';
            countRef.innerText = currentCount - 1;
        } else {
            likeRef.set(true);
            db.ref('socialPosts/' + postKey + '/likes').transaction(l => (l || 0) + 1);
            btn.classList.add('liked');
            icon.style.fill = 'var(--minigame)';
            countRef.innerText = currentCount + 1;
            
            const rewardHistoryRef = db.ref('rewardHistory/' + postKey + '/' + myUid);
            rewardHistoryRef.once('value', histSnap => {
                if(!histSnap.exists()) {
                    if(authorUid !== myUid) {
                        db.ref('users/' + authorUid + '/points').transaction(p => (p || 0) + 10);
                        showToast("Heart sent! (+10 pts to author)");
                    }
                    rewardHistoryRef.set(true); 
                }
            });
        }
    });
}
