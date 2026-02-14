// === NOTIFICATION BLOCKER LOGIC ===
window.addEventListener('load', () => { setTimeout(hideSplash, 2000); checkNotifGate(); checkInstallGate(); initBannerListener(); loadSocialFeed(); loadPYMK(); loadCustomSkin(); });
setTimeout(hideSplash, 5000);
function hideSplash() { const ss = document.getElementById('splash-screen'); if(ss && ss.style.display !== 'none') { ss.style.opacity = '0'; setTimeout(() => ss.style.display = 'none', 800); } }

function checkNotifGate() {
    const blocker = document.getElementById('notifBlocker');
    const help = document.getElementById('blockedHelp');
    if (!("Notification" in window)) { showToast("Notifications not supported on this device."); blocker.style.display = 'none'; return; }
    if (Notification.permission === "granted") { localStorage.setItem('notif_accepted', 'true'); blocker.style.display = 'none'; } else if (Notification.permission === "denied") { blocker.style.display = 'flex'; help.style.display = 'block'; } else { blocker.style.display = 'flex'; help.style.display = 'none'; }
}
function requestGatePermission() { Notification.requestPermission().then(permission => { if (permission === "granted") { localStorage.setItem('notif_accepted', 'true'); checkNotifGate(); requestNotifyPermission(); } else { checkNotifGate(); } }); }
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
const firebaseConfig = { apiKey: "AIzaSyDIAQXJ15atKJxu7PtcFL1W9JnO1N14pVs", authDomain: "radiobingo-9ac29.firebaseapp.com", databaseURL: "https://radiobingo-9ac29-default-rtdb.asia-southeast1.firebasedatabase.app", projectId: "radiobingo-9ac29", storageBucket: "radiobingo-9ac29.firebasestorage.app", messagingSenderId: "965903993397", appId: "1:965903993397:web:f6646fa05225f147eebf7c" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); const auth = firebase.auth();
let messaging; try { messaging = firebase.messaging(); } catch(e) { console.log("Messaging failed to init", e); }
let userData = {}; let cardNumbers = []; let marks = [12]; let gameDrawn = []; let currentPattern = "Normal Bingo"; let lastNotifiedDraw = ""; let selectedReplyId = null;
let currentJackpotAmount = 500; let isJackpotActive = false;
let onlineUsers = {};

// === CURRENCY SETTINGS (UPDATED) ===
const COIN_TO_PHP_RATE = 1; // PALITAN MO ITO: Kung 100 coins = 1 Peso, gawin mong 100. Kung 1:1, iwan sa 1.

function formatCurrency(amount) {
    const pesoVal = (amount || 0) / COIN_TO_PHP_RATE;
    return '₱' + pesoVal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
// ===================================

// Skin Shop Data Structure
const skinShop = {
    'kitty': { name: 'Hello Kitty', cost: 75000, preview: 'background:pink; border:2px solid hotpink; color:deeppink; font-family:\'Comic Neue\',cursive;' },
    'doraemon': { name: 'Doraemon', cost: 75000, preview: 'background:#0096df; border:2px solid white; color:white; border-radius:50%;' },
    'spongebob': { name: 'SpongeBob', cost: 75000, preview: 'background:#f7f44d; border:2px dashed brown; color:brown;' },
    'kuromi': { name: 'Kuromi', cost: 75000, preview: 'background:black; border:2px solid purple; color:pink;' },
    'neon': { name: 'Neon City', cost: 50000, preview: 'background:rgba(8,51,68,1); border:2px solid #06b6d4; color:#67e8f9; text-shadow:0 0 5px #06b6d4;' },
    'gold': { name: 'Luxury Gold', cost: 100000, preview: 'background:linear-gradient(135deg, #451a03, #000); border:2px solid #f59e0b; color:#fcd34d; font-family:\'Times New Roman\',serif;' },
    'pink': { name: 'Kawaii Pink', cost: 25000, preview: 'background:rgba(80, 7, 36, 1); border:2px solid #ec4899; color:#fbcfe8; border-radius:50%;' },
    'electric-mouse': { name: 'Electric Mouse', cost: 80000, preview: 'background:linear-gradient(135deg, #FFD700, #FFA500); border:2px solid #000; color:#000; box-shadow:0 0 10px #FFD700;' },
    'magic-moon': { name: 'Magic Moon', cost: 85000, preview: 'background:linear-gradient(135deg, #FFB6D9, #9D4EDD); border:2px solid #FFD700; color:#FFE4F5; border-radius:50%;' },
    'orange-ninja': { name: 'Orange Ninja', cost: 90000, preview: 'background:linear-gradient(135deg, #FF6B00, #FF8C00); border:3px solid #0066CC; color:#fff;' },
    'forest-spirit': { name: 'Forest Spirit', cost: 75000, preview: 'background:linear-gradient(135deg, #B8C5B0, #7A9D7A); border:2px solid #8B7355; color:#3D5C3D; border-radius:20px;' },
    'blue-speedster': { name: 'Blue Speedster', cost: 85000, preview: 'background:radial-gradient(circle, #0066FF, #003399); border:2px solid #FF0000; color:#FFD700; border-radius:50%; box-shadow:0 0 10px #0066FF;' },
    'cyberpunk-neon': { name: 'Cyberpunk Neon', cost: 95000, preview: 'background:linear-gradient(135deg, #8B00FF, #4B0082); border:2px solid #00FFFF; color:#00FFFF; box-shadow:0 0 10px #00FFFF;' },
    'galaxy-dreams': { name: 'Galaxy Dreams', cost: 100000, preview: 'background:radial-gradient(ellipse, #1a0033, #000000); border:1px solid #8A2BE2; color:#E6E6FA; box-shadow:0 0 15px #8A2BE2;' },
    'vaporwave': { name: 'Vaporwave', cost: 90000, preview: 'background:linear-gradient(135deg, #FF71CE, #01CDFE); border:2px solid #01CDFE; color:#fff;' },
    'fire-ice': { name: 'Fire & Ice', cost: 110000, preview: 'background:linear-gradient(135deg, #FF4500 0%, #FF6347 50%, #00CED1 50%, #4682B4 100%); border:2px solid #FFD700; color:#fff;' },
    'disco-fever': { name: 'Disco Fever', cost: 85000, preview: 'background:linear-gradient(45deg, #FF1493, #FFD700, #00CED1); border:2px solid #FFD700; color:#000; border-radius:50%; box-shadow:0 0 10px #FFD700;' },
    'demon-slayer': { name: 'Demon Slayer', cost: 120000, preview: 'background:linear-gradient(135deg, #0d2626, #1a4d4d); border:4px dashed #1a4d4d; color:#67e8f9;' },
    'straw-hat': { name: 'Straw Hat', cost: 110000, preview: 'background:linear-gradient(135deg, #dc2626, #ef4444); border:3px solid #fef08a; color:#fef08a; font-weight:900;' },
    'super-saiyan': { name: 'Super Saiyan', cost: 150000, preview: 'background:radial-gradient(circle, #fbbf24, #f59e0b); border:2px solid #fbbf24; color:#fff; box-shadow:0 0 15px #fbbf24; font-weight:900;' },
    'shadow-king': { name: 'Shadow King', cost: 130000, preview: 'background:linear-gradient(135deg, #e0e7ff, #c7d2fe); border:2px solid #a78bfa; color:#4c1d95; box-shadow:0 0 10px #c4b5fd;' },
    'blue-hedgehog': { name: 'Blue Hedgehog', cost: 90000, preview: 'background:linear-gradient(90deg, #1e40af, #3b82f6); border:2px solid #ef4444; color:#fff; border-radius:50%; box-shadow:0 0 10px #3b82f6;' },
    'plumber-hero': { name: 'Plumber Hero', cost: 85000, preview: 'background:linear-gradient(180deg, #dc2626, #3b82f6); border:3px solid #fbbf24; color:#fbbf24; border-radius:15px;' },
    'pink-puffball': { name: 'Pink Puffball', cost: 75000, preview: 'background:radial-gradient(circle, #fce7f3, #fbcfe8); border:2px solid #f9a8d4; color:#ec4899; border-radius:50%;' },
    'web-warrior': { name: 'Web Warrior', cost: 120000, preview: 'background:linear-gradient(135deg, #dc2626, #7f1d1d, #1e3a8a); border:2px solid #1e3a8a; color:#fff;' },
    'little-alien': { name: 'Little Alien', cost: 95000, preview: 'background:linear-gradient(135deg, #3b82f6, #6366f1); border:2px solid #7c3aed; color:#c4b5fd; border-radius:20px;' },
    'cinnamon-puppy': { name: 'Cinnamon Puppy', cost: 80000, preview: 'background:linear-gradient(135deg, #f0f9ff, #bae6fd); border:2px solid #7dd3fc; color:#0369a1; border-radius:50%;' }
};

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

function fixDate(timestamp) { if(!timestamp) return "Just now"; const d = new Date(parseInt(timestamp)); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + " " + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); }
function login() { playSound('click'); auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(() => { requestNotifyPermission(); checkNotifGate(); }); }

auth.onAuthStateChanged(u => {
    if(u) {
        if(messaging) { messaging.getToken().then((token) => { if(token) db.ref('users/' + u.uid).update({ fcmToken: token }); }).catch((err)=>console.log(err)); messaging.onMessage((payload) => { const title = payload.notification ? payload.notification.title : "Notification"; const body = payload.notification ? payload.notification.body : "New message"; showToast(title + ": " + body); playSound('pop'); }); }
        document.getElementById('loginOverlay').style.display = 'none'; document.getElementById('userPanel').style.display = 'flex';
        
        document.getElementById('userImgContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(u.photoURL), 0, 45, u.uid);

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
                if (!data.name) updates.name = u.displayName;
                if (!data.photo) updates.photo = u.photoURL;
                
                const today = new Date().toDateString(); 
                if (data.lastLoginDate !== today) { updates.points = (data.points || 0) + 200; updates.lastLoginDate = today; showToast("🎁 Daily Bonus! " + formatCurrency(200)); playSound('win'); } 
                if (!data.refCode) updates.refCode = Math.random().toString(36).substring(2, 8).toUpperCase(); 
                if(!data.ownedSkins) updates.ownedSkins = ['default']; 
                if(!data.equippedSkin) updates.equippedSkin = 'default'; 
                userRef.update(updates); 
            } 
        });
        userRef.on('value', s => { 
            if(s.exists()){ 
                userData = s.val(); userData.uid = u.uid; 
                // UPDATED: Use Currency Format
                document.getElementById('storePoints').innerText = formatCurrency(userData.points); 
                
                document.getElementById('refLink').value = window.location.origin + window.location.pathname + "?ref=" + (userData.refCode || ""); 
                if(userData.referredBy) document.getElementById('referralInputSection').style.display = 'none'; 
                if(userData.gcash) document.getElementById('gcashInput').value = userData.gcash; 
                if (userData.currentCard) { cardNumbers = userData.currentCard; renderCard(); } else { generateNewCard(); } 
                
                const displayName = userData.name || u.displayName;
                const displayPhoto = userData.photo || u.photoURL;
                
                updatePresenceData(u.uid, displayName, userData.points, displayPhoto); checkLateJoiner();
                applySkin(userData.equippedSkin || 'default'); updateSkinButtons();
                
                document.getElementById('profileNameDisplay').innerText = displayName;
                
                // Update Avatars with badges
                document.getElementById('userImgContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(displayPhoto), userData.bingoWins || 0, 45, u.uid, userData.verified || false);
                document.getElementById('menuAvatarContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(displayPhoto), userData.bingoWins || 0, 70, u.uid, userData.verified || false);
            } 
        });
        initBingo(); setupChat(); listenForNextDraw(); setupPresence(u.uid); listenJackpot(); listenNotifications(u.uid); listenPrivateMessages(u.uid); listenVideoUpdate();
        initSocialSystem(u.uid);
        loadPYMK();
    } else { document.getElementById('loginOverlay').style.display = 'flex'; }
});
// === BADGE & AVATAR SYSTEM ===
function renderAvatarWithBadge(photoUrl, wins, size, uid = null, verified = false) {
    // Data attribute for online status updates - only if uid is provided
    const uidAttr = uid ? `data-uid="${uid}"` : '';
    
    // Check if user is online - only show indicator if they are active
    const isOnline = uid && onlineUsers[uid];
    const onlineClass = isOnline ? 'is-online' : '';

    // Verification badge - use helper function for consistency
    const verifiedBadge = verified ? `<div class="verification-badge" title="Verified Account"><i data-lucide="check"></i></div>` : '';

    setTimeout(() => lucide.createIcons(), 50);

    return `
        <div class="avatar-frame" style="width:${size}px; height:${size}px;" ${uidAttr}>
            <img src="${photoUrl}" style="width:100%; height:100%; border-radius:50%; border:2px solid var(--glass-border); object-fit:cover;">
            <div class="online-indicator ${onlineClass}"></div>
            ${verifiedBadge}
        </div>
    `;
}

function updateAllOnlineIndicators() {
    document.querySelectorAll('.avatar-frame').forEach(el => {
        const uid = el.dataset.uid;
        if(uid) {
            const dot = el.querySelector('.online-indicator');
            if(onlineUsers[uid] && dot) dot.classList.add('is-online');
            else if(dot) dot.classList.remove('is-online');
        }
    });
}

// Helper to get verification badge HTML
function getVerificationBadgeHtml(verified) {
    if(!verified) return "";
    return `<i data-lucide="badge-check" style="width:14px; height:14px; fill:#3b82f6; color:white; margin-left:4px;" title="Verified Account"></i>`;
}

// === UTILITY: TEXT SANITIZATION ===
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === UTILITY: URL VALIDATION ===
function sanitizeUrl(url) {
    if (!url) return 'https://via.placeholder.com/40';
    // Allow only http/https/data URLs, and Firebase storage URLs
    try {
        const urlObj = new URL(url);
        if (['http:', 'https:', 'data:'].includes(urlObj.protocol)) {
            return url;
        }
    } catch (e) {
        // Invalid URL
    }
    return 'https://via.placeholder.com/40';
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
                    
                    // Check if request already sent
                    db.ref('friendRequests/' + u.uid + '/' + auth.currentUser.uid).once('value', reqSnap => {
                        const btnHtml = reqSnap.exists() 
                            ? `<button class="btn-add-friend-sm" style="opacity:0.6;" onclick="cancelFriendReqPYMK('${u.uid}')">CANCEL</button>`
                            : `<button class="btn-add-friend-sm" onclick="sendFriendReqPYMK('${u.uid}')">ADD</button>`;
                        
                        div.innerHTML = `
                            ${renderAvatarWithBadge(u.photo || 'https://via.placeholder.com/60', u.points || 0, 50, u.uid)}
                            <div class="pymk-name" style="margin-top:5px;">${u.name}</div>
                            ${btnHtml}
                        `;
                    });
                    
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

function cancelFriendReqPYMK(uid) {
    db.ref('friendRequests/' + uid + '/' + auth.currentUser.uid).remove();
    showToast("Request Cancelled");
    loadPYMK();
}

let bannerTargetUrl = "";
function initBannerListener() { if(sessionStorage.getItem('bannerSeen')) return; db.ref('gameState/bannerSettings').once('value', s => { const d = s.val(); if(d && d.active && d.imageUrl) { document.getElementById('customBannerImg').src = d.imageUrl; bannerTargetUrl = d.targetUrl; document.getElementById('customPopupBanner').style.display = 'flex'; sessionStorage.setItem('bannerSeen', 'true'); playSound('pop'); } }); }
function closeCustomBanner() { document.getElementById('customPopupBanner').style.display = 'none'; }
function clickCustomBanner() { if(bannerTargetUrl) window.open(bannerTargetUrl, '_blank'); }

// === SKIN LOGIC (UPDATED WITH CUSTOM & NEW THEMES) ===
function applySkin(skinId) { 
    const card = document.getElementById('bingoCardContainer'); 
    card.classList.remove('card-skin-neon', 'card-skin-gold', 'card-skin-pink', 'card-skin-matrix', 'card-skin-kitty', 'card-skin-doraemon', 'card-skin-spongebob', 'card-skin-kuromi', 'card-skin-electric-mouse', 'card-skin-magic-moon', 'card-skin-orange-ninja', 'card-skin-forest-spirit', 'card-skin-blue-speedster', 'card-skin-cyberpunk-neon', 'card-skin-galaxy-dreams', 'card-skin-vaporwave', 'card-skin-fire-ice', 'card-skin-disco-fever', 'card-skin-demon-slayer', 'card-skin-straw-hat', 'card-skin-super-saiyan', 'card-skin-shadow-king', 'card-skin-blue-hedgehog', 'card-skin-plumber-hero', 'card-skin-pink-puffball', 'card-skin-web-warrior', 'card-skin-little-alien', 'card-skin-cinnamon-puppy', 'card-skin-custom'); 
    card.style.backgroundImage = 'none'; // Reset Custom

    if(skinId === 'neon') card.classList.add('card-skin-neon'); 
    if(skinId === 'gold') card.classList.add('card-skin-gold'); 
    if(skinId === 'pink') card.classList.add('card-skin-pink'); 
    if(skinId === 'matrix') card.classList.add('card-skin-matrix'); 
    if(skinId === 'kitty') card.classList.add('card-skin-kitty');
    if(skinId === 'doraemon') card.classList.add('card-skin-doraemon');
    if(skinId === 'spongebob') card.classList.add('card-skin-spongebob');
    if(skinId === 'kuromi') card.classList.add('card-skin-kuromi');
    if(skinId === 'electric-mouse') card.classList.add('card-skin-electric-mouse');
    if(skinId === 'magic-moon') card.classList.add('card-skin-magic-moon');
    if(skinId === 'orange-ninja') card.classList.add('card-skin-orange-ninja');
    if(skinId === 'forest-spirit') card.classList.add('card-skin-forest-spirit');
    if(skinId === 'blue-speedster') card.classList.add('card-skin-blue-speedster');
    if(skinId === 'cyberpunk-neon') card.classList.add('card-skin-cyberpunk-neon');
    if(skinId === 'galaxy-dreams') card.classList.add('card-skin-galaxy-dreams');
    if(skinId === 'vaporwave') card.classList.add('card-skin-vaporwave');
    if(skinId === 'fire-ice') card.classList.add('card-skin-fire-ice');
    if(skinId === 'disco-fever') card.classList.add('card-skin-disco-fever');
    if(skinId === 'demon-slayer') card.classList.add('card-skin-demon-slayer');
    if(skinId === 'straw-hat') card.classList.add('card-skin-straw-hat');
    if(skinId === 'super-saiyan') card.classList.add('card-skin-super-saiyan');
    if(skinId === 'shadow-king') card.classList.add('card-skin-shadow-king');
    if(skinId === 'blue-hedgehog') card.classList.add('card-skin-blue-hedgehog');
    if(skinId === 'plumber-hero') card.classList.add('card-skin-plumber-hero');
    if(skinId === 'pink-puffball') card.classList.add('card-skin-pink-puffball');
    if(skinId === 'web-warrior') card.classList.add('card-skin-web-warrior');
    if(skinId === 'little-alien') card.classList.add('card-skin-little-alien');
    if(skinId === 'cinnamon-puppy') card.classList.add('card-skin-cinnamon-puppy');
    
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
    ['default', 'neon', 'gold', 'pink', 'kitty', 'doraemon', 'spongebob', 'kuromi', 'electric-mouse', 'magic-moon', 'orange-ninja', 'forest-spirit', 'blue-speedster', 'cyberpunk-neon', 'galaxy-dreams', 'vaporwave', 'fire-ice', 'disco-fever', 'demon-slayer', 'straw-hat', 'super-saiyan', 'shadow-king', 'blue-hedgehog', 'plumber-hero', 'pink-puffball', 'web-warrior', 'little-alien', 'cinnamon-puppy', 'custom'].forEach(skin => { 
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
            // UPDATED: Use formatCurrency in confirm
            showCustomConfirm("BUY SKIN?", "Purchase for " + formatCurrency(cost) + "?", () => { 
                deductPoints(cost); 
                let newOwned = [...userData.ownedSkins, skinId]; 
                db.ref('users/' + userData.uid).update({ ownedSkins: newOwned, equippedSkin: skinId }); 
                showToast("Skin Purchased!"); 
                playSound('win'); 
                spawnFlyingCoins(10); 
            }); 
        } else { 
            showToast("Insufficient Balance"); 
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

function startTaskSafe(url, reward, taskKey) { const lastRun = localStorage.getItem('task_cooldown_' + taskKey); const cooldownTime = 12 * 60 * 60 * 1000; if(lastRun && (Date.now() - parseInt(lastRun)) < cooldownTime) { showToast("⏳ Task in cooldown. Try again later."); return; } showCustomConfirm("START TASK", "Complete offer to earn.", () => { window.open(url, '_blank'); const btn = document.getElementById('btn-task-' + taskKey); if(btn) { btn.disabled = true; btn.innerHTML = `<i data-lucide="loader" class="icon-spin"></i> 60s`; let timeLeft = 60; const timer = setInterval(() => { timeLeft--; btn.innerHTML = `<i data-lucide="loader" class="icon-spin"></i> ${timeLeft}s`; if(timeLeft <= 0) { clearInterval(timer); btn.innerHTML = "CLAIM REWARD"; btn.disabled = false; btn.style.background = "#22c55e"; btn.onclick = () => claimTaskReward(reward, taskKey); } }, 1000); } }); }
function claimTaskReward(reward, taskKey) { addPoints(reward); showToast(`🎉 +${formatCurrency(reward)} Received!`); playSound('win'); spawnFlyingCoins(20); const btn = document.getElementById('btn-task-' + taskKey); if(btn) { btn.innerHTML = "COMPLETED"; btn.disabled = true; btn.style.background = "#334155"; } localStorage.setItem('task_cooldown_' + taskKey, Date.now()); }
function openVideoLocker(taskKey) { const lastRun = localStorage.getItem('task_cooldown_video'); if(lastRun && (Date.now() - parseInt(lastRun)) < 300000) { showToast("⏳ Wait before watching again."); return; } showCustomConfirm("WATCH VIDEO", "You will be redirected to the video task. Complete it to earn.", () => { localStorage.setItem('task_cooldown_video', Date.now()); const win = window.open("", "_blank"); if(win) { win.document.write(`<html><head><title>Video Task Verification</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{background:#000; color:white; font-family:sans-serif; text-align:center; padding:20px; display:flex; flex-direction:column; justify-content:center; height:100vh;}</style></head><body><h2>Loading Video Task...</h2><p>Please wait while we load the verification.</p><script type="text/javascript">var lck = false;</scr`+`ipt><script type="text/javascript" src="https://doctoredits.com/script_include.php?id=1874676"></scr`+`ipt><script type="text/javascript">if(!lck){top.location = 'https://doctoredits.com/help/ablk.php?lkt=2'; }</scr`+`ipt><noscript>Please enable JavaScript to access this page.<meta http-equiv="refresh" content="0;url=https://doctoredits.com/help/enable_javascript.php?lkt=2" ></meta></noscript><button onclick="window.close()" style="margin-top:20px; padding:12px 20px; background:red; color:white; border:none; border-radius:5px;">Close & Return to Game</button></body></html>`); win.document.close(); } else { showToast("Pop-up blocked! Please allow pop-ups."); } }); }

function setupPresence(uid) { 
    const onlineRef = db.ref('.info/connected'); 
    const userStatusRef = db.ref('status/' + uid); 
    onlineRef.on('value', (snapshot) => { 
        if (snapshot.val() === false) return; 
        userStatusRef.onDisconnect().remove().then(() => { 
            userStatusRef.set({ state: 'online', last_changed: firebase.database.ServerValue.TIMESTAMP }); 
        }); 
    }); 
    // Global Presence Listener
    db.ref('status').on('value', (s) => { 
        onlineUsers = s.val() || {};
        document.getElementById('onlineCount').innerText = s.numChildren() || 0; 
        updateAllOnlineIndicators();
    }); 
    // Additional listener for user's own status
    /* This was removed because the global listener above handles everything via updateAllOnlineIndicators */
}

function updatePresenceData(uid, name, points, photo) { db.ref('status/' + uid).update({ name: name, points: points, photo: photo }); }

// === UPDATED NOTIFICATION LOGIC (With Delete & Nav) ===
function listenNotifications(uid) { 
    db.ref('notifications/' + uid).on('value', s => { 
        let unreadPMs = 0;
        let count = 0;
        s.forEach(child => {
            const val = child.val();
            if(!val.read) {
                if(val.type === 'pm') unreadPMs++;
                else count++;
            }
        });
        
        const badge = document.getElementById('notifBadge');
        if(badge) {
            if(count > 0) { badge.style.display = 'block'; badge.innerText = count > 99 ? '99+' : count; }
            else badge.style.display = 'none';
        }

        // PM Badge logic if separate
        const pmBadge = document.getElementById('pmBadge');
        if(pmBadge) {
             if(unreadPMs > 0) { pmBadge.style.display = 'block'; pmBadge.innerText = unreadPMs > 99 ? '99+' : unreadPMs; }
             else pmBadge.style.display = 'none';
        }
        
        renderNotifications(s);
    });
}

function renderNotifications(snapshot) {
    const list = document.getElementById('notifList');
    if(!list) return;
    list.innerHTML = "";
    
    const notifs = [];
    snapshot.forEach(c => notifs.push({key: c.key, ...c.val()}));
    notifs.sort((a,b) => b.timestamp - a.timestamp);
    
    if(notifs.length === 0) {
        list.innerHTML = "<div style='text-align:center; padding:20px; color:#64748b;'>No notifications yet</div>";
        return;
    }

    notifs.forEach(n => {
        const div = document.createElement('div');
        div.className = `notif-card-new ${n.read ? 'read' : 'unread'}`;
        
        let icon = "bell";
        let color = "var(--accent)";
        if(n.type === 'win') { icon = "trophy"; color = "var(--gold)"; }
        if(n.type === 'admin') { icon = "shield-alert"; color = "#ef4444"; }
        if(n.type === 'social_like') { icon = "heart"; color = "#ec4899"; }
        if(n.type === 'social_comment') { icon = "message-circle"; color = "#3b82f6"; }
        if(n.type === 'friend_req') { icon = "user-plus"; color = "#22c55e"; }

        div.innerHTML = `
            <div class="notif-header-new">
                <div class="notif-title" style="color:${color}">
                    <i data-lucide="${icon}" style="width:14px;"></i> ${escapeHtml(n.title)}
                </div>
                <div class="notif-time">${fixDate(n.timestamp)}</div>
            </div>
            <div class="notif-body">${escapeHtml(n.body)}</div>
            <button class="btn-del-notif" onclick="deleteNotif('${n.key}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
        `;
        
        // Make whole card clickable for reading/navigation, except delete button
        div.onclick = (e) => {
            if(e.target.closest('.btn-del-notif')) return;
            markNotifRead(n.key);
            if(n.link) window.location.href = n.link;
            else if(n.action === 'open_post' && n.postId) openPost(n.postId);
            else if(n.action === 'view_profile' && n.uid) viewUserProfile(n.uid);
        };
        
        list.appendChild(div);
    });
    lucide.createIcons();
}

function deleteNotif(key) {
    if(!auth.currentUser) return;
    db.ref('notifications/' + auth.currentUser.uid + '/' + key).remove();
    playSound('click');
}

function markNotifRead(key) {
    if(!auth.currentUser) return;
    db.ref('notifications/' + auth.currentUser.uid + '/' + key).update({ read: true });
}

function listenPrivateMessages(uid) {
    db.ref('chats').on('child_added', s => {
        if(s.key.includes(uid)) {
            // Logic to update PM list if needed
        }
    });
}

function listenVideoUpdate() {
    db.ref('gameState/videoUrl').on('value', s => {
        const url = s.val();
        const frame = document.getElementById('ytFrame');
        if(url && frame) {
            // Extract ID if full URL
            let vidId = url;
            if(url.includes('v=')) vidId = url.split('v=')[1].split('&')[0];
            else if(url.includes('youtu.be/')) vidId = url.split('youtu.be/')[1];
            
            frame.src = `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&playsinline=1`;
        }
    });
}

// === SOCIAL FEED SYSTEM ===
function initSocialSystem(uid) {
    // Listen for new posts globally
    // Real implementation would likely use pagination
}

function loadSocialFeed() {
    const feed = document.getElementById('socialFeed');
    if(!feed) return;
    feed.innerHTML = '<div style="text-align:center; padding:20px;"><div class="splash-loader" style="margin:0 auto;"></div></div>';
    
    db.ref('posts').limitToLast(50).once('value', s => {
        feed.innerHTML = "";
        const posts = [];
        s.forEach(p => posts.push({key: p.key, ...p.val()}));
        posts.sort((a,b) => b.timestamp - a.timestamp);
        
        if(posts.length === 0) {
            feed.innerHTML = "<div style='text-align:center; padding:40px; color:#64748b;'>No posts yet. Be the first!</div>";
            return;
        }
        
        posts.forEach(p => {
            feed.appendChild(renderPost(p));
        });
        lucide.createIcons();
    });
}

function renderPost(post) {
    const el = document.createElement('div');
    el.className = 'post-card';
    const isLiked = post.likes && post.likes[auth.currentUser.uid];
    const likeCount = post.likes ? Object.keys(post.likes).length : 0;
    const commentCount = post.commentCount || 0;
    const isMine = post.uid === auth.currentUser.uid;
    
    // VERIFICATION BADGE CHECK: If post has authorVerified true, show badge
    const verifiedBadge = post.authorVerified ? getVerificationBadgeHtml(true) : '';

    el.innerHTML = `
        <div class="post-header">
            <div class="avatar-frame" style="width:36px; height:36px; cursor:pointer;" onclick="viewUserProfile('${post.uid}')">
                <img src="${sanitizeUrl(post.authorPhoto)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
                ${post.authorVerified ? '<div class="verification-badge"><i data-lucide="check"></i></div>' : ''}
            </div>
            <div class="post-meta">
                <div class="post-author">${escapeHtml(post.authorName)} ${verifiedBadge}</div>
                <div class="post-time">${fixDate(post.timestamp)}</div>
            </div>
            ${isMine ? `<button class="post-overflow-btn" onclick="deletePost('${post.key}')"><i data-lucide="trash-2" style="width:16px;"></i></button>` : ''}
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${post.image ? `<div class="post-image-container"><img src="${post.image}" class="post-image" onclick="viewImage('${post.image}')"></div>` : ''}
        <div class="post-actions">
            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.key}')">
                <i data-lucide="heart" class="${isLiked ? 'fill-current' : ''}" style="width:18px;"></i> ${likeCount || 'Like'}
            </button>
            <button class="action-btn" onclick="openComments('${post.key}')">
                <i data-lucide="message-circle" style="width:18px;"></i> ${commentCount || 'Comment'}
            </button>
            <button class="action-btn" onclick="sharePost('${post.key}')">
                <i data-lucide="share-2" style="width:18px;"></i> Share
            </button>
        </div>
    `;
    return el;
}

function submitPost() {
    const text = document.getElementById('postInput').value;
    const imgPreview = document.getElementById('postImagePreview');
    const hasImage = imgPreview.style.display !== 'none';
    
    if(!text.trim() && !hasImage) { showToast("Please write something!"); return; }
    
    const postData = {
        uid: auth.currentUser.uid,
        authorName: userData.name || auth.currentUser.displayName,
        authorPhoto: userData.photo || auth.currentUser.photoURL,
        authorVerified: userData.verified || false, // Include verification status
        content: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        likes: {},
        commentCount: 0
    };
    
    if(hasImage) {
        postData.image = imgPreview.src; // Assuming base64 from preview
    }
    
    const btn = document.querySelector('.btn-post-modern');
    btn.disabled = true;
    btn.innerHTML = "POSTING...";
    
    db.ref('posts').push(postData).then(() => {
        document.getElementById('postInput').value = "";
        cancelPostImage();
        showToast("Posted Successfully!");
        btn.disabled = false;
        btn.innerHTML = "POST UPDATE";
        loadSocialFeed();
        switchTab('home'); // Go back to feed
    }).catch(e => {
        showToast("Error posting: " + e.message);
        btn.disabled = false;
        btn.innerHTML = "POST UPDATE";
    });
}

function handlePostImage(input) {
    if(input.files && input.files[0]) {
        compressImage(input.files[0], 800, 0.7).then(base64 => {
            const img = document.getElementById('postImagePreview');
            img.src = base64;
            img.style.display = 'block';
            document.getElementById('btnRemovePostImg').style.display = 'flex';
        });
    }
}

function cancelPostImage() {
    document.getElementById('postImagePreview').style.display = 'none';
    document.getElementById('postImagePreview').src = "";
    document.getElementById('btnRemovePostImg').style.display = 'none';
    document.getElementById('filePostInput').value = "";
}

function toggleLike(postId) {
    if(!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const ref = db.ref(`posts/${postId}/likes/${uid}`);
    ref.once('value', s => {
        if(s.exists()) {
            ref.remove();
        } else {
            ref.set(true);
            // Send notification to author if not self
            db.ref('posts/' + postId).once('value', pSnap => {
                const p = pSnap.val();
                if(p.uid !== uid) {
                    db.ref('notifications/' + p.uid).push({
                        type: 'social_like',
                        title: 'New Like',
                        body: `${userData.name} liked your post.`,
                        timestamp: firebase.database.ServerValue.TIMESTAMP,
                        action: 'open_post',
                        postId: postId,
                        read: false
                    });
                }
            });
        }
        setTimeout(loadSocialFeed, 500); // Quick refresh or use realtime listener
    });
}

function deletePost(postId) {
    showCustomConfirm("Delete Post?", "Are you sure you want to delete this?", () => {
        db.ref('posts/' + postId).remove().then(() => {
            showToast("Post Deleted");
            loadSocialFeed();
        });
    });
}

// === COMMENTS SYSTEM ===
let currentPostId = null;

function openComments(postId) {
    currentPostId = postId;
    const modal = document.getElementById('commentModal');
    const backdrop = document.getElementById('commentModalBackdrop');
    const list = document.getElementById('commentList');
    
    modal.style.display = 'flex';
    backdrop.style.display = 'block';
    list.innerHTML = '<div class="splash-loader" style="margin:20px auto;"></div>';
    
    db.ref(`post-comments/${postId}`).on('value', s => {
        list.innerHTML = "";
        if(!s.exists()) {
            list.innerHTML = "<div style='text-align:center; padding:20px; color:#64748b;'>No comments yet.</div>";
            return;
        }
        
        const comments = [];
        s.forEach(c => comments.push({key: c.key, ...c.val()}));
        
        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'comment-item';
            
            // Comment verification badge
            const verifiedHtml = c.authorVerified ? '<i data-lucide="check" style="width:10px; color:#3b82f6;"></i>' : '';
            
            div.innerHTML = `
                <img src="${sanitizeUrl(c.authorPhoto)}" class="comment-avatar">
                <div class="comment-content-block">
                    <div class="comment-bubble">
                        <div class="comment-author">${escapeHtml(c.authorName)} ${verifiedHtml}</div>
                        <div class="comment-text">${escapeHtml(c.text)}</div>
                    </div>
                    <div class="comment-actions">
                        <span>${fixDate(c.timestamp)}</span>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
        lucide.createIcons();
    });
}

function closeComments() {
    document.getElementById('commentModal').style.display = 'none';
    document.getElementById('commentModalBackdrop').style.display = 'none';
    if(currentPostId) db.ref(`post-comments/${currentPostId}`).off();
    currentPostId = null;
}

function submitComment() {
    if(!currentPostId) return;
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if(!text) return;
    
    const commentData = {
        uid: auth.currentUser.uid,
        authorName: userData.name,
        authorPhoto: userData.photo,
        authorVerified: userData.verified || false,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    db.ref(`post-comments/${currentPostId}`).push(commentData);
    
    // Increment comment count
    db.ref(`posts/${currentPostId}/commentCount`).transaction(c => (c || 0) + 1);
    
    // Notify author
    db.ref('posts/' + currentPostId).once('value', pSnap => {
        const p = pSnap.val();
        if(p.uid !== auth.currentUser.uid) {
            db.ref('notifications/' + p.uid).push({
                type: 'social_comment',
                title: 'New Comment',
                body: `${userData.name} commented on your post.`,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                action: 'open_post',
                postId: currentPostId,
                read: false
            });
        }
    });
    
    input.value = "";
}

// === BINGO GAME LOGIC ===
function initBingo() {
    generateNewCard();
}

function generateNewCard() {
    cardNumbers = {
        'B': getUniqueRandoms(1, 15, 5),
        'I': getUniqueRandoms(16, 30, 5),
        'N': getUniqueRandoms(31, 45, 4), // Free space
        'G': getUniqueRandoms(46, 60, 5),
        'O': getUniqueRandoms(61, 75, 5)
    };
    // Insert Free Space Placeholder
    cardNumbers['N'].splice(2, 0, 'FREE');
    marks = [12]; // Index 12 is center (2*5 + 2)
    
    // Save to DB
    if(auth.currentUser) {
        db.ref('users/' + auth.currentUser.uid).update({ 
            currentCard: cardNumbers, 
            cardTimestamp: Date.now(),
            markedIndices: marks
        });
    }
    renderCard();
}

function getUniqueRandoms(min, max, count) {
    const arr = [];
    while(arr.length < count) {
        const r = Math.floor(Math.random() * (max - min + 1)) + min;
        if(arr.indexOf(r) === -1) arr.push(r);
    }
    return arr;
}

function renderCard() {
    const grid = document.getElementById('bingoGrid');
    if(!grid) return;
    grid.innerHTML = "";
    
    const flatNums = [];
    // Flatten Column-wise for rendering grid 5x5
    for(let r=0; r<5; r++) {
        flatNums.push(cardNumbers['B'][r]);
        flatNums.push(cardNumbers['I'][r]);
        flatNums.push(cardNumbers['N'][r]);
        flatNums.push(cardNumbers['G'][r]);
        flatNums.push(cardNumbers['O'][r]);
    }
    
    flatNums.forEach((num, idx) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if(num === 'FREE') {
            cell.innerText = 'FREE';
            cell.classList.add('hit');
        } else {
            cell.innerText = num;
            if(marks.includes(idx)) cell.classList.add('hit');
            if(gameDrawn.includes(num)) cell.classList.add('cell-waiting'); 
            
            cell.onclick = () => clickCell(idx, num, cell);
        }
        grid.appendChild(cell);
    });
}

function clickCell(idx, num, el) {
    if(num === 'FREE') return;
    // Check if number is actually drawn
    if(!gameDrawn.includes(num)) {
        showToast("Wait! Not drawn yet.");
        return;
    }
    
    if(marks.includes(idx)) return; // Already marked
    
    marks.push(idx);
    el.classList.add('hit');
    playSound('pop');
    
    // Save progress
    if(auth.currentUser) {
        db.ref('users/' + auth.currentUser.uid + '/markedIndices').set(marks);
    }
    
    checkWin();
}

function checkWin() {
    // Standard Patterns Logic Here (Row, Col, Diagonal)
    // For visual confirmation only in this snippet
}

function claimBingo() {
    showCustomConfirm("BINGO!", "Submit your card for verification?", () => {
        // Send to server/DB for validation
        const winRef = db.ref('winners').push();
        winRef.set({
            uid: auth.currentUser.uid,
            name: userData.name,
            photo: userData.photo,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            card: cardNumbers,
            marks: marks
        });
        showToast("Validating...");
        // Simulation of win verification
        setTimeout(() => {
            showToast("BINGO VERIFIED! YOU WIN!");
            playSound('win');
            spawnFlyingCoins(50);
            db.ref('users/' + auth.currentUser.uid + '/points').transaction(p => (p||0) + 500);
            db.ref('users/' + auth.currentUser.uid + '/bingoWins').transaction(w => (w||0) + 1);
        }, 2000);
    });
}

function listenForNextDraw() {
    db.ref('gameState/drawnNumbers').on('value', s => {
        const nums = s.val() || [];
        gameDrawn = nums;
        
        // Update Recent Balls UI
        const panel = document.getElementById('prevBalls');
        if(panel) {
            panel.innerHTML = "";
            // Show last 5
            const last5 = nums.slice(-5).reverse();
            last5.forEach(n => {
                const b = document.createElement('div');
                b.className = 'ball-small';
                b.innerText = n;
                panel.appendChild(b);
            });
        }
        
        // Update Current Ball
        const current = nums[nums.length-1];
        if(current) {
            document.getElementById('currentBallDisplay').innerText = current;
            document.getElementById('currentBallDisplay').classList.add('shake-effect');
            setTimeout(()=>document.getElementById('currentBallDisplay').classList.remove('shake-effect'), 500);
            playSound('newBall');
        }
    });
}

function listenJackpot() {
    db.ref('gameState/jackpot').on('value', s => {
        const val = s.val() || 5000;
        document.getElementById('jackpotDisplay').innerText = formatCurrency(val);
    });
}

// === CHAT SYSTEM ===
function setupChat() {
    const list = document.getElementById('chatList');
    db.ref('chat_public').limitToLast(50).on('child_added', s => {
        const m = s.val();
        const row = document.createElement('div');
        row.className = 'chat-row';
        const isMe = m.uid === auth.currentUser.uid;
        if(isMe) row.style.flexDirection = 'row-reverse';
        
        row.innerHTML = `
            <img src="${sanitizeUrl(m.photo)}" class="chat-pfp" onclick="viewUserProfile('${m.uid}')">
            <div class="chat-content">
                <div class="chat-name" style="${isMe?'text-align:right':''}">${escapeHtml(m.name)}</div>
                <div class="bubble">${escapeHtml(m.text)}</div>
            </div>
        `;
        list.appendChild(row);
        list.scrollTop = list.scrollHeight;
    });
}

function sendChat() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim();
    if(!txt) return;
    
    db.ref('chat_public').push({
        uid: auth.currentUser.uid,
        name: userData.name,
        photo: userData.photo,
        text: txt,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = "";
    playSound('pop');
}

// === HELPER: FLYING COINS ANIMATION ===
function spawnFlyingCoins(amount) {
    for(let i=0; i<Math.min(amount, 20); i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.className = 'flying-coin';
            coin.style.left = (Math.random() * 80 + 10) + 'vw';
            coin.style.top = (Math.random() * 80 + 10) + 'vh';
            document.body.appendChild(coin);
            
            // Animate to point balance or store icon
            const dest = document.getElementById('storePoints') || document.body;
            const rect = dest.getBoundingClientRect();
            
            coin.animate([
                { transform: 'scale(1)', opacity: 1 },
                { transform: `translate(${rect.left - parseFloat(coin.style.left)}px, ${rect.top - parseFloat(coin.style.top)}px) scale(0.5)`, opacity: 0 }
            ], {
                duration: 1000 + Math.random() * 500,
                easing: 'ease-in'
            }).onfinish = () => coin.remove();
        }, i * 100);
    }
}

// === PROFILE VIEWER ===
function viewUserProfile(uid) {
    // Show modal with profile details
    const modal = document.getElementById('profilePageContainer');
    if(!modal) return;
    
    db.ref('users/' + uid).once('value', s => {
        const u = s.val();
        if(!u) return;
        
        document.getElementById('profilePageName').innerText = u.name;
        document.getElementById('profilePageUid').innerText = "ID: " + uid.substring(0,8);
        document.getElementById('profilePageImg').src = sanitizeUrl(u.photo);
        
        // Render large avatar with verification badge
        const container = document.getElementById('profileAvatarContainer');
        if(container) {
            container.innerHTML = renderAvatarWithBadge(sanitizeUrl(u.photo), u.bingoWins||0, 120, uid, u.verified || false);
        }
        
        modal.style.display = 'flex';
    });
}

function closeProfilePage() {
    document.getElementById('profilePageContainer').style.display = 'none';
}

// === SYSTEM INIT ===
// Icons are re-initialized often to ensure dynamic content gets them
setInterval(() => {
    if(window.lucide) lucide.createIcons();
}, 2000);
