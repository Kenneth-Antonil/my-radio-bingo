if (window.location.pathname.endsWith("index.html")) {
    var newPath = window.location.pathname.replace(/index\.html$/, "");
    window.history.replaceState({}, document.title, newPath);
}

    // === NOTIFICATION BLOCKER LOGIC ===
    window.addEventListener('load', () => { 
        setTimeout(hideSplash, 1500); // Reduced from 2000ms to 1500ms
        checkNotifGate(); 
        checkInstallGate(); 
        initBannerListener(); 
        loadSocialFeed(); 
        loadPYMK(); 
        loadCustomSkin(); 
    });
    
    // Backup splash hide - ensure it disappears even if load event doesn't fire
    setTimeout(hideSplash, 3000); // Reduced from 5000ms to 3000ms
    
    function hideSplash() { 
        const ss = document.getElementById('splash-screen'); 
        if(ss && ss.style.display !== 'none') { 
            ss.style.opacity = '0'; 
            setTimeout(() => {
                ss.style.display = 'none';
                ss.remove(); // Completely remove from DOM
            }, 800); 
        } 
    }
    
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
            // Hide splash screen when authenticated
            hideSplash();
            
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
                    document.getElementById('storePoints').innerText = (userData.points || 0).toLocaleString(); 
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
                    document.getElementById('userImgContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(displayPhoto), userData.bingoWins || 0, 45, u.uid);
                    document.getElementById('menuAvatarContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(displayPhoto), userData.bingoWins || 0, 70, u.uid);
                } 
            });
            initBingo(); setupChat(); listenForNextDraw(); setupPresence(u.uid); listenJackpot(); listenNotifications(u.uid); listenPrivateMessages(u.uid); listenVideoUpdate();
            initSocialSystem(u.uid);
            loadPYMK();
        } else { 
            // Hide splash and show login screen
            hideSplash();
            document.getElementById('loginOverlay').style.display = 'flex'; 
        }
    });
    // === BADGE & AVATAR SYSTEM ===
    function renderAvatarWithBadge(photoUrl, wins, size, uid = null) {
        let tierClass = "tier-bronze-bg";
        let tierIcon = ""; // Default empty
        if(wins >= 30) { tierClass = "tier-diamond-bg"; tierIcon = '<i data-lucide="diamond" style="width:50%; height:50%;"></i>'; }
        else if(wins >= 15) { tierClass = "tier-platinum-bg"; tierIcon = '<i data-lucide="shield" style="width:50%; height:50%;"></i>'; }
        else if(wins >= 5) { tierClass = "tier-gold-bg"; tierIcon = '<i data-lucide="crown" style="width:50%; height:50%;"></i>'; }
        else if(wins >= 1) { tierClass = "tier-silver-bg"; tierIcon = '<i data-lucide="star" style="width:50%; height:50%;"></i>'; }
        else { tierIcon = '<i data-lucide="circle-dot" style="width:50%; height:50%;"></i>'; }

        // Data attribute for online status updates - only if uid is provided
        const uidAttr = uid ? `data-uid="${uid}"` : '';
        
        // Check if user is online - only show indicator if they are active
        const isOnline = uid && onlineUsers[uid];
        const onlineClass = isOnline ? 'is-online' : '';

        setTimeout(() => lucide.createIcons(), 50);

        return `
            <div class="avatar-frame" style="width:${size}px; height:${size}px;" ${uidAttr}>
                <img src="${photoUrl}" style="width:100%; height:100%; border-radius:50%; border:2px solid var(--glass-border); object-fit:cover;">
                <div class="avatar-badge-icon ${tierClass}">
                    ${tierIcon}
                </div>
                <div class="online-indicator ${onlineClass}"></div>
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

    // Helper to get simple HTML badge string for text
    function getBadgeHtml(wins) {
        // Just returns empty or simple icon for text-flow
        if(wins >= 30) return `<i data-lucide="diamond" style="width:12px; height:12px; fill:#06b6d4; color:#06b6d4; margin-left:4px;"></i>`;
        if(wins >= 5) return `<i data-lucide="crown" style="width:12px; height:12px; fill:#fbbf24; color:#fbbf24; margin-left:4px;"></i>`;
        return ""; 
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
    }
    
    function updatePresenceData(uid, name, points, photo) { db.ref('status/' + uid).update({ name: name, points: points, photo: photo }); }
    
    // === UPDATED NOTIFICATION LOGIC (With Delete & Nav) ===
    function listenNotifications(uid) { 
        db.ref('notifications/' + uid).on('value', s => { 
            let unreadPMs = 0;
            let count = 0;
            s.forEach(child => {
                const val = child.val();
                if(val.type === 'pm') unreadPMs++;
                else count++;
            });
            const dot = document.getElementById('notifDot'); 
            const pmBadge = document.getElementById('pmBadge');
            if(count > 0) { dot.style.display = 'block'; } else { dot.style.display = 'none'; }
            if(unreadPMs > 0) { pmBadge.style.display = 'flex'; pmBadge.innerText = unreadPMs > 9 ? '9+' : unreadPMs; } else { pmBadge.style.display = 'none'; }
        }); 
    }
    
    function openNotifs() { document.getElementById('notifModal').style.display='flex'; playSound('click'); renderNotifs(); }
    
    function renderNotifs() { 
        const list = document.getElementById('notifList'); 
        db.ref('notifications/' + auth.currentUser.uid).once('value', s => { 
            list.innerHTML = ""; 
            const notifs = [];
            s.forEach(n => { if(n.val().type !== 'pm') notifs.push({ key: n.key, ...n.val() }); });
            
            notifs.sort((a,b) => b.time - a.time);

            if(notifs.length === 0) {
                list.innerHTML = "<div style='text-align:center; opacity:0.5; padding:40px;'>No new notifications</div>";
                return;
            }

            notifs.forEach(val => {
                const div = document.createElement('div');
                div.className = 'notif-card-grouped';
                
                let iconOrImg = `<i data-lucide="info" style="color:#64748b;"></i>`;
                if(val.image) {
                    iconOrImg = `<img src="${val.image}" class="notif-img">`;
                }
                
                div.innerHTML = `
                    ${iconOrImg}
                    <div class="notif-content-wrap">
                        <div style="font-size:13px; color:white;">${val.msg}</div>
                        <div style="font-size:10px; opacity:0.5; margin-top:5px;">${fixDate(val.time)}</div>
                    </div>
                    <button class="btn-delete-notif" onclick="deleteNotif('${val.key}', event)"><i data-lucide="x" style="width:14px;"></i></button>
                `;
                
                // Click Nav Logic
                div.onclick = (e) => {
                    if(e.target.closest('.btn-delete-notif')) return; 
                    if(val.postId) {
                        document.getElementById('notifModal').style.display='none';
                        // Switch to home and find post or open comments
                        switchTab('home');
                        const postEl = document.getElementById('post-' + val.postId);
                        if(postEl) postEl.scrollIntoView({behavior: "smooth"});
                        else openComments(val.postId);
                    }
                };
                
                list.appendChild(div);
            });
            lucide.createIcons();
        }); 
    }

    function deleteNotif(key, event) { 
        event.stopPropagation();
        db.ref('notifications/' + auth.currentUser.uid + '/' + key).remove(); 
        renderNotifs(); 
        showToast("Notification Deleted"); 
    }
    
    function listenJackpot() { db.ref('gameState/jackpot').on('value', s => { const data = s.val(); const banner = document.getElementById('jackpotBanner'); if(data && data.active) { banner.style.display = 'block'; document.getElementById('jackpotDisplayVal').innerText = data.amount + " RB COINS"; isJackpotActive = true; const rawAmount = parseInt(data.amount.replace(/[^0-9]/g, '')); currentJackpotAmount = isNaN(rawAmount) ? 500 : rawAmount; } else { banner.style.display = 'none'; isJackpotActive = false; currentJackpotAmount = 500; } }); }

    function listenVideoUpdate() { db.ref('gameState/videoSettings').on('value', s => { const v = s.val(); const iframe = document.getElementById('liveVideoFrame'); const offline = document.getElementById('videoOfflineState'); if (v && v.type === 'offline') { iframe.style.display = 'none'; iframe.src = ""; offline.style.display = 'flex'; } else if(v && v.url) { offline.style.display = 'none'; iframe.style.display = 'block'; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = v.url.match(regExp); let videoId = (match && match[2].length === 11) ? match[2] : null; if(!videoId && v.url.length === 11) videoId = v.url; if (videoId) { const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1`; if(iframe.src !== embedUrl) { iframe.src = embedUrl; } } } }); }

    function listenForForNextDraw() { db.ref('gameState/schedules').on('value', s => { updateNextDrawDisplay(); }); db.ref('gameState/nextDraw').on('value', s => { updateNextDrawDisplay(); }); }
    function listenForNextDraw() { db.ref('gameState').on('value', s => { updateNextDrawDisplay(); }); }

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

    function triggerWin() { const uid = auth.currentUser.uid; let winPrize = 500; if (isJackpotActive) winPrize = currentJackpotAmount; db.ref('gameState/latestWinner').set({ name: userData.name, uid: uid, prize: winPrize }); db.ref('users/' + uid + '/points').transaction(p => (p || 0) + winPrize); db.ref('users/' + uid + '/bingoWins').transaction(w => (w || 0) + 1); db.ref('users/' + uid).update({ hasWonCurrent: true }); userData.hasWonCurrent = true; if (isJackpotActive) { const jpModal = document.getElementById('grandJackpotModal'); document.getElementById('grandPrizeAmount').innerText = winPrize.toLocaleString() + " RB COINS"; document.getElementById('jpWinnerName').innerText = userData.name; jpModal.style.display = 'flex'; confetti({ particleCount: 500, spread: 120, startVelocity: 60 }); } }
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
    let isGroupChat = false;

    function openMessenger() { document.getElementById('pmModal').style.display = 'flex'; document.getElementById('pmInboxView').style.display = 'flex'; document.getElementById('pmChatView').style.display = 'none'; loadInbox(); }
    function loadInbox() { 
        const uid = auth.currentUser.uid; 
        const list = document.getElementById('pmList'); 
        list.innerHTML = "<div style='text-align:center; padding: var(--spacing-lg); opacity:0.5;'>Loading...</div>"; 
        
        renderActiveFriends();

        // Load Groups
        db.ref('groupMembers/' + uid).once('value', gSnap => {
            const myGroups = gSnap.exists() ? Object.keys(gSnap.val()) : [];
            
            // Load PMs
            db.ref('messages').once('value', s => { 
                const conversations = {}; 
                s.forEach(msgSnap => { const m = msgSnap.val(); if(m.from === uid || m.to === uid) { const partner = m.from === uid ? m.to : m.from; conversations[partner] = m; } }); 
                
                list.innerHTML = ""; 
                
                // Render Groups First
                myGroups.forEach(groupId => {
                    db.ref('groups/' + groupId).once('value', groupSnap => {
                        const grp = groupSnap.val();
                        if(!grp) return;
                        const div = document.createElement('div');
                        div.className = 'pm-item';
                        div.onclick = () => openGroupChat(groupId, grp.name);
                        div.innerHTML = `
                            <div style="width:55px; height:55px; border-radius:50%; background:#1e293b; display:flex; align-items:center; justify-content:center; color:white; border:1px solid rgba(255,255,255,0.1);"><i data-lucide="users"></i></div>
                            <div class="pm-info"><span class="pm-name">${grp.name}</span><span class="pm-preview">Group Chat</span></div>
                        `;
                        list.appendChild(div);
                        lucide.createIcons();
                    });
                });

                if(Object.keys(conversations).length === 0 && myGroups.length === 0) { list.innerHTML = "<div style='text-align:center; padding: var(--spacing-lg);'>No messages yet.</div>"; return; } 
                
                Object.keys(conversations).forEach(partnerId => { 
                    db.ref('users/' + partnerId).once('value', uSnap => { 
                        const u = uSnap.val(); 
                        const lastMsg = conversations[partnerId]; 
                        const div = document.createElement('div'); 
                        div.className = 'pm-item'; 
                        div.onclick = () => openPrivateChat(partnerId, u.name, u.photo); 
                        const previewText = lastMsg.image ? 'Sent a photo' : lastMsg.text;
                        div.innerHTML = `<img class="pm-avatar" src="${u.photo || 'https://via.placeholder.com/40'}"><div class="pm-info"><span class="pm-name">${u.name} ${getBadgeHtml(u.bingoWins || 0)}</span><span class="pm-preview">${lastMsg.from === uid ? 'You: ' : ''}${previewText}</span></div>`; 
                        list.appendChild(div); 
                        lucide.createIcons();
                    }); 
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

    // === GROUP CHAT LOGIC ===
    function startCreateGroup() {
        document.getElementById('pmInboxView').style.display = 'none';
        document.getElementById('pmCreateGroupView').style.display = 'flex';
        const container = document.getElementById('friendSelectContainer');
        container.innerHTML = "Loading friends...";
        
        db.ref('friends/' + auth.currentUser.uid).once('value', s => {
            container.innerHTML = "";
            if(!s.exists()) { container.innerHTML = "No friends found."; return; }
            s.forEach(f => {
                 db.ref('users/' + f.key).once('value', uSnap => {
                     const u = uSnap.val();
                     const div = document.createElement('div');
                     div.className = 'friend-select-item';
                     div.onclick = () => { div.classList.toggle('selected'); };
                     div.dataset.uid = f.key;
                     div.innerHTML = `
                        <div style="display:flex; align-items:center; gap: var(--spacing-sm);">
                            <img src="${u.photo}" style="width:40px; height:40px; border-radius:50%;">
                            <span>${u.name}</span>
                        </div>
                        <div class="checkbox-circle"><i data-lucide="check" style="width:12px;"></i></div>
                     `;
                     container.appendChild(div);
                     lucide.createIcons();
                 });
            });
        });
    }

    function cancelCreateGroup() {
        document.getElementById('pmCreateGroupView').style.display = 'none';
        document.getElementById('pmInboxView').style.display = 'flex';
    }

    function finalizeCreateGroup() {
        const name = document.getElementById('newGroupName').value.trim();
        if(!name) return showToast("Enter Group Name");
        
        const selected = document.querySelectorAll('.friend-select-item.selected');
        if(selected.length === 0) return showToast("Select at least 1 friend");
        
        const members = { [auth.currentUser.uid]: true };
        selected.forEach(el => members[el.dataset.uid] = true);
        
        const groupRef = db.ref('groups').push();
        groupRef.set({
            name: name,
            createdBy: auth.currentUser.uid,
            members: members
        }).then(() => {
            // Index for each member
            Object.keys(members).forEach(uid => {
                db.ref('groupMembers/' + uid + '/' + groupRef.key).set(true);
            });
            showToast("Group Created!");
            cancelCreateGroup();
            loadInbox();
        });
    }

    function openGroupChat(groupId, groupName) {
        currentChatPartner = groupId;
        isGroupChat = true;
        document.getElementById('pmInboxView').style.display = 'none'; 
        document.getElementById('pmChatView').style.display = 'flex'; 
        document.getElementById('chatTargetName').innerText = groupName; 
        document.getElementById('chatTargetStatus').innerText = "Group Chat";
        document.getElementById('chatTargetAvatarCont').innerHTML = `<div style="width:100%; height:100%; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center;"><i data-lucide="users"></i></div>`;
        lucide.createIcons();
        
        listenGroupMessages(groupId);
    }
    
    function listenGroupMessages(groupId) {
        const chatDiv = document.getElementById('pmMessages'); 
        chatDiv.innerHTML = "";
        if(pmListenerRef) db.ref('groupMessages').off(); // Clear old listener location logic if slightly diff

        const gRef = db.ref('groupMessages/' + groupId).limitToLast(100);
        gRef.on('child_added', s => {
             const m = s.val();
             const div = document.createElement('div'); 
             div.className = `msg-bubble ${m.from === auth.currentUser.uid ? 'msg-me' : 'msg-them'}`;
             let contentHtml = m.text;
             if(m.image) contentHtml += `<br><img src="${m.image}" class="msg-image-preview">`;
             
             // Show name in group
             if(m.from !== auth.currentUser.uid) {
                 contentHtml = `<span style="font-size:9px; color:#94a3b8; display:block; margin-bottom:2px;">${m.senderName}</span>` + contentHtml;
             }

             div.innerHTML = contentHtml;
             chatDiv.appendChild(div); 
             chatDiv.scrollTop = chatDiv.scrollHeight; 
        });
        pmListenerRef = gRef; // Hacky reference store
    }

    function openPrivateChat(uid, name, photo) { 
        if(uid === auth.currentUser.uid) return showToast("Cant msg self"); 
        currentChatPartner = uid; 
        isGroupChat = false;
        document.getElementById('pmModal').style.display = 'flex'; 
        document.getElementById('pmInboxView').style.display = 'none'; 
        document.getElementById('pmChatView').style.display = 'flex'; 
        document.getElementById('chatTargetName').innerText = name; 
        document.getElementById('chatTargetStatus').innerText = "Active now";
        document.getElementById('chatTargetAvatarCont').innerHTML = `<img src="${photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        
        db.ref('notifications/' + auth.currentUser.uid).once('value', s => {
            s.forEach(n => {
                if(n.val().type === 'pm' && n.val().from === uid) {
                    db.ref('notifications/' + auth.currentUser.uid + '/' + n.key).remove();
                }
            });
        });

        listenPrivateMessages(auth.currentUser.uid); 
    }
    
    function backToInbox() { 
        currentChatPartner = null; 
        isGroupChat = false;
        document.getElementById('pmChatView').style.display = 'none'; 
        document.getElementById('pmInboxView').style.display = 'flex'; 
        if(pmListenerRef) pmListenerRef.off();
        loadInbox(); 
    }
    
    let pmImageBase64 = null;
    function handlePmImage(input) {
        if(input.files && input.files[0]) {
            compressImage(input.files[0], 500, 0.7).then(base64 => {
                pmImageBase64 = base64;
                document.getElementById('pmImgPreviewCont').style.display = 'block';
            });
        }
    }

    function sendPrivateMessage() { 
        const inp = document.getElementById('pmInput'); 
        const text = inp.value.trim(); 
        if((!text && !pmImageBase64) || !currentChatPartner) return; 
        const myUid = auth.currentUser.uid; 
        
        if(isGroupChat) {
            const msgData = { from: myUid, senderName: userData.name, text: text, image: pmImageBase64, timestamp: Date.now() };
            db.ref('groupMessages/' + currentChatPartner).push(msgData);
        } else {
            const msgData = { from: myUid, to: currentChatPartner, text: text, image: pmImageBase64, timestamp: Date.now() }; 
            db.ref('messages').push(msgData); 
            const notifMsg = pmImageBase64 ? 'Sent a photo' : `New PM from ${userData.name}`;
            db.ref('notifications/' + currentChatPartner).push({ msg: notifMsg, time: Date.now(), type: 'pm', from: myUid }); 
        }

        inp.value = ""; 
        pmImageBase64 = null;
        document.getElementById('pmImgInput').value = "";
        document.getElementById('pmImgPreviewCont').style.display = 'none';
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
            const key = s.key;
            
            // Play sound for new incoming messages when not in initial load
            if(!isInitialLoad && m.to === myUid && (m.timestamp > (Date.now() - 2000))) {
                playSound('pop');
                
                // Show toast notification if PM modal is closed or chat is with different user
                const pmModal = document.getElementById('pmModal');
                const isPMModalClosed = pmModal.style.display === 'none' || !pmModal.style.display;
                const isDifferentChat = currentChatPartner !== m.from;
                
                if(isPMModalClosed || isDifferentChat) {
                    // Get sender name
                    db.ref('users/' + m.from).once('value', uSnap => {
                        const sender = uSnap.val();
                        if(sender) {
                            const messagePreview = m.image ? '📷 Photo' : (m.text.length > 30 ? m.text.substring(0, 30) + '...' : m.text);
                            const sanitizedName = escapeHtml(sender.name);
                            const sanitizedPreview = escapeHtml(messagePreview);
                            showToast(`💬 ${sanitizedName}: ${sanitizedPreview}`);
                        }
                    });
                }
            }

            if(!currentChatPartner) return; 
            if( (m.from === myUid && m.to === currentChatPartner) || (m.from === currentChatPartner && m.to === myUid) ) { 
                const div = document.createElement('div'); 
                div.className = `msg-bubble ${m.from === myUid ? 'msg-me' : 'msg-them'}`; 
                
                let contentHtml = m.text;
                if(m.image) {
                    contentHtml += `<br><img src="${m.image}" class="msg-image-preview">`;
                }
                
                // Heart logic
                let heartHtml = '';
                if(m.hearted) {
                    heartHtml = `<div class="msg-heart-reaction">❤️</div>`;
                }

                div.innerHTML = `${contentHtml}${heartHtml}`; 
                
                // Double click to heart
                div.ondblclick = () => {
                    if(!m.hearted) {
                        db.ref('messages/' + key).update({ hearted: true });
                        showToast("Message hearted");
                    }
                };

                chatDiv.appendChild(div); 
                chatDiv.scrollTop = chatDiv.scrollHeight; 
            } 
        }); 
        
        // Listen for changes (hearts)
        pmListenerRef.on('child_changed', s => {
             // In real app, find specific bubble and update. Here we just re-render or let it slide for simplicity in one-file
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

    // === SUPPORT CONTACT FUNCTIONS ===
    function openSupportModal() {
        document.getElementById('menuModal').style.display = 'none';
        document.getElementById('supportModal').style.display = 'flex';
        loadMyTickets(); // Load user's tickets when opening modal
        setTimeout(() => lucide.createIcons(), 50);
    }

    function submitSupportRequest() {
        const subject = document.getElementById('supportSubject').value.trim();
        const message = document.getElementById('supportMessage').value.trim();
        
        if(!subject || !message) {
            showToast("Please fill in all fields");
            return;
        }
        
        if(message.length < 10) {
            showToast("Message too short. Please provide more details.");
            return;
        }
        
        // Save to Firebase
        db.ref('supportMessages').push({
            uid: auth.currentUser.uid,
            userName: userData.name,
            userEmail: userData.gcash || 'Not provided',
            userPhoto: userData.photo,
            subject: subject,
            message: message,
            timestamp: Date.now(),
            status: 'open'
        });
        
        showToast("Message sent! We'll respond soon.");
        playSound('pop');
        
        // Clear form and refresh ticket list
        document.getElementById('supportSubject').value = '';
        document.getElementById('supportMessage').value = '';
        loadMyTickets();
    }
    
    function loadMyTickets() {
        const ticketsList = document.getElementById('ticketsList');
        ticketsList.innerHTML = '<div style="text-align:center; padding: var(--spacing-md); opacity:0.5; font-size:11px;">Loading tickets...</div>';
        
        db.ref('supportMessages').orderByChild('uid').equalTo(auth.currentUser.uid).once('value', s => {
            ticketsList.innerHTML = '';
            
            if(!s.exists()) {
                ticketsList.innerHTML = '<div style="text-align:center; padding: var(--spacing-md); opacity:0.5; font-size:11px;">No tickets yet</div>';
                return;
            }
            
            const tickets = [];
            s.forEach(child => {
                tickets.push({ key: child.key, ...child.val() });
            });
            
            // Sort by timestamp descending
            tickets.sort((a, b) => b.timestamp - a.timestamp);
            
            tickets.forEach(ticket => {
                // Count replies
                db.ref('supportTicketReplies/' + ticket.key).once('value', rSnap => {
                    const replyCount = rSnap.numChildren();
                    
                    const ticketDiv = document.createElement('div');
                    ticketDiv.className = 'ticket-item';
                    ticketDiv.onclick = () => openTicketDetail(ticket.key);
                    
                    ticketDiv.innerHTML = `
                        <div class="ticket-item-header">
                            <div class="ticket-subject">${escapeHtml(ticket.subject)}</div>
                            <div class="ticket-status ${ticket.status}">${ticket.status}</div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="ticket-time">${fixDate(ticket.timestamp)}</div>
                            ${replyCount > 0 ? `<div class="ticket-reply-count"><i data-lucide="message-circle" style="width:12px;"></i> ${replyCount}</div>` : ''}
                        </div>
                    `;
                    
                    ticketsList.appendChild(ticketDiv);
                    lucide.createIcons();
                });
            });
        });
    }
    
    let currentTicketKey = null;
    
    function openTicketDetail(ticketKey) {
        currentTicketKey = ticketKey;
        
        db.ref('supportMessages/' + ticketKey).once('value', s => {
            const ticket = s.val();
            if(!ticket) return;
            
            document.getElementById('ticketDetailSubject').innerText = ticket.subject;
            document.getElementById('ticketDetailStatus').innerText = ticket.status.toUpperCase();
            document.getElementById('ticketDetailStatus').style.color = ticket.status === 'open' ? 'var(--gold)' : '#94a3b8';
            
            const repliesContainer = document.getElementById('ticketRepliesContainer');
            repliesContainer.innerHTML = `
                <div class="ticket-original-message">
                    <div class="ticket-original-label">Original Message</div>
                    <div class="ticket-reply-content">${escapeHtml(ticket.message)}</div>
                    <div class="ticket-reply-time" style="margin-top:8px;">${fixDate(ticket.timestamp)}</div>
                </div>
            `;
            
            // Load replies
            db.ref('supportTicketReplies/' + ticketKey).orderByChild('timestamp').once('value', rSnap => {
                // Clear only replies, keep original message
                const existingOriginal = repliesContainer.querySelector('.ticket-original-message');
                repliesContainer.innerHTML = '';
                if(existingOriginal) {
                    repliesContainer.appendChild(existingOriginal);
                }
                
                if(!rSnap.exists()) {
                    repliesContainer.innerHTML += '<div style="text-align:center; padding: var(--spacing-lg); opacity:0.5; font-size:11px;">No replies yet</div>';
                } else {
                    rSnap.forEach(child => {
                        const reply = child.val();
                        const isAdmin = reply.isAdmin || false;
                        const adminBadge = isAdmin ? '<span class="ticket-reply-admin-badge">Support Team</span>' : '';
                        
                        const replyDiv = document.createElement('div');
                        replyDiv.className = 'ticket-reply-item';
                        replyDiv.innerHTML = `
                            <div class="ticket-reply-header">
                                <img src="${reply.authorPhoto}" class="ticket-reply-avatar">
                                <div>
                                    <div class="ticket-reply-author">${escapeHtml(reply.authorName)} ${adminBadge}</div>
                                </div>
                                <div class="ticket-reply-time">${fixDate(reply.timestamp)}</div>
                            </div>
                            <div class="ticket-reply-content">${escapeHtml(reply.message)}</div>
                        `;
                        repliesContainer.appendChild(replyDiv);
                    });
                    lucide.createIcons();
                }
            });
            
            document.getElementById('ticketDetailModal').style.display = 'flex';
            setTimeout(() => lucide.createIcons(), 50);
        });
    }
    
    function closeTicketDetail() {
        document.getElementById('ticketDetailModal').style.display = 'none';
        currentTicketKey = null;
    }
    
    function submitTicketReply() {
        if(!currentTicketKey) return;
        
        const replyText = document.getElementById('ticketReplyInput').value.trim();
        
        if(!replyText) {
            showToast("Please enter a reply");
            return;
        }
        
        if(replyText.length < 5) {
            showToast("Reply too short");
            return;
        }
        
        // Add reply to Firebase
        db.ref('supportTicketReplies/' + currentTicketKey).push({
            uid: auth.currentUser.uid,
            authorName: userData.name,
            authorPhoto: userData.photo,
            message: replyText,
            timestamp: Date.now(),
            isAdmin: false
        }).then(() => {
            // Reload ticket detail to show new reply
            openTicketDetail(currentTicketKey);
            
            // Clear input
            document.getElementById('ticketReplyInput').value = '';
            showToast("Reply sent!");
            playSound('pop');
        });
        
        // Get ticket owner to send notification
        // Note: In a production environment, verify isAdmin flag before sending admin notifications
        db.ref('supportMessages/' + currentTicketKey).once('value', ticketSnap => {
            const ticket = ticketSnap.val();
            if(ticket && ticket.uid !== auth.currentUser.uid) {
                // Another user (likely admin/support) is replying, notify the ticket owner
                db.ref('notifications/' + ticket.uid).push({
                    msg: `Support replied to your ticket: ${ticket.subject}`,
                    time: Date.now(),
                    type: 'support_reply',
                    from: auth.currentUser.uid,
                    ticketId: currentTicketKey,
                    image: userData.photo
                });
            }
        });
        
        // Update ticket status to open if it was closed
        db.ref('supportMessages/' + currentTicketKey + '/status').set('open');
    }

    let selectedMood = null; // UPDATED DEFAULT
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
        document.getElementById('optUserAvatarCont').innerHTML = `<img src="${photo}" style="width:60px; height:60px; border-radius:50%; border:2px solid var(--accent); object-fit:cover;">`;
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
    
    // UNFRIEND LOGIC (Modern)
    function unfriendUser() {
        if(!currentProfileUid) return;
        showCustomConfirm("Unfriend?", "Are you sure you want to remove this friend?", () => {
             const myUid = auth.currentUser.uid;
             db.ref('friends/' + myUid + '/' + currentProfileUid).remove();
             db.ref('friends/' + currentProfileUid + '/' + myUid).remove();
             showToast("Unfriended successfully.");
             updateProfileButtonState(currentProfileUid);
        });
    }

    function selectMood(el, mood) {
        const isActive = el.classList.contains('active');
        document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
        if(!isActive) { el.classList.add('active'); selectedMood = mood; } else { selectedMood = null; }
    }
    
    function toggleVisibilityDropdown() {
        const menu = document.getElementById('visibilityMenu');
        menu.classList.toggle('show');
    }
    
    function selectVisibility(value, icon, text) {
        // Update hidden input
        document.getElementById('postVisibility').value = value;
        
        // Update trigger button
        document.getElementById('visibilityIcon').setAttribute('data-lucide', icon);
        document.getElementById('visibilityText').textContent = text;
        
        // Update selected state in menu
        document.querySelectorAll('.visibility-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-value') === value) {
                opt.classList.add('selected');
            }
        });
        
        // Close dropdown
        document.getElementById('visibilityMenu').classList.remove('show');
        
        // Re-render icons
        lucide.createIcons();
    }
    
    // Close dropdown when clicking outside
    (function() {
        const dropdown = document.querySelector('.custom-visibility-dropdown');
        const menu = document.getElementById('visibilityMenu');
        if (dropdown && menu) {
            document.addEventListener('click', function(event) {
                if (!dropdown.contains(event.target)) {
                    menu.classList.remove('show');
                }
            });
        }
    })();
    
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
        
        const visibility = document.getElementById('postVisibility').value || 'public';
        
        const postData = {
            uid: auth.currentUser.uid,
            authorName: userData.name,
            authorPhoto: userData.photo,
            authorPoints: userData.points,
            authorWins: userData.bingoWins || 0,
            content: txt,
            mood: selectedMood,
            image: selectedImageBase64,
            timestamp: Date.now(),
            likes: 0,
            visibility: visibility
        };
        
        db.ref('socialPosts').push(postData);
        document.getElementById('postInput').value = "";
        
        // Reset custom visibility dropdown to Public
        selectVisibility('public', 'globe', 'Public');
        
        removePostImage();
        document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
        selectedMood = null;
        showToast("Posted!");
        playSound('pop');
    }

    function togglePostMenu(postKey) {
        const menu = document.getElementById('post-menu-' + postKey);
        if (!menu) return;
        
        // Close all other menus
        document.querySelectorAll('.post-overflow-menu').forEach(m => {
            if (m.id !== 'post-menu-' + postKey) {
                m.classList.remove('show');
            }
        });
        
        // Toggle current menu
        menu.classList.toggle('show');
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.post-overflow-btn') && !e.target.closest('.post-overflow-menu')) {
            document.querySelectorAll('.post-overflow-menu').forEach(m => {
                m.classList.remove('show');
            });
        }
    });

    function deletePost(postKey) {
        // Close the overflow menu
        const menu = document.getElementById('post-menu-' + postKey);
        if (menu) menu.classList.remove('show');
        
        if(!confirm("Are you sure you want to delete this post?")) {
            return;
        }
        
        const ANIMATION_DURATION = 300;
        
        // Soft delete: mark as deleted instead of removing
        // Note: Firebase security rules should verify that auth.uid matches the post author's uid
        db.ref('socialPosts/' + postKey).update({
            deleted: true,
            deletedAt: Date.now()
        }).then(() => {
            // Remove from DOM immediately
            const postElement = document.getElementById('post-' + postKey);
            if(postElement) {
                postElement.style.transition = `opacity ${ANIMATION_DURATION}ms ease`;
                postElement.style.opacity = '0';
                setTimeout(() => postElement.remove(), ANIMATION_DURATION);
            }
            showToast("Post deleted");
            playSound('pop');
        }).catch(err => {
            console.error("Error deleting post:", err);
            showToast("Failed to delete post");
        });
    }

    let currentProfileUid = null;

    function openMyProfile() {
        openUserProfile(auth.currentUser.uid);
    }

    function openUserProfile(uid) {
        currentProfileUid = uid;
        document.getElementById('userOptionsModal').style.display = 'none';
        document.getElementById('userProfilePage').style.display = 'flex';
        
        document.getElementById('pageProfileFeed').innerHTML = "<div style='color:white; opacity:0.5; text-align:center; padding: var(--spacing-lg);'>Loading...</div>";
        document.getElementById('profileMainActionBtn').style.display = 'none';
        document.getElementById('unfriendBtn').style.display = 'none';

        db.ref('users/' + uid).once('value', s => {
            const u = s.val();
            // Inject avatar with badge
            document.getElementById('pageProfileAvatarContainer').innerHTML = renderAvatarWithBadge(sanitizeUrl(u.photo || 'https://via.placeholder.com/100'), u.bingoWins || 0, 140, uid);
            
            document.getElementById('pageProfileName').textContent = u.name;
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
        const unfriendBtn = document.getElementById('unfriendBtn');
        const giftSkinBtn = document.getElementById('giftSkinBtn');
        const myUid = auth.currentUser.uid;
        
        unfriendBtn.style.display = 'none';
        giftSkinBtn.style.display = 'none';
        
        if(uid === myUid) {
            btn.innerText = "Edit Profile";
            btn.className = "profile-action-btn secondary";
            btn.onclick = openEditProfile;
            btn.style.display = 'block';
        } else {
            // Show Gift Skin button for other users
            giftSkinBtn.style.display = 'block';
            giftSkinBtn.onclick = () => openGiftModal(uid);
            
            db.ref('friends/' + myUid + '/' + uid).once('value', s => {
                if(s.exists()) {
                    btn.innerText = "Message";
                    btn.className = "profile-action-btn";
                    btn.onclick = () => openPrivateChat(uid, document.getElementById('pageProfileName').innerText, document.getElementById('pageProfileImg').src); 
                    unfriendBtn.style.display = 'flex'; // Show modern unfriend
                } else {
                     db.ref('friendRequests/' + uid + '/' + myUid).once('value', reqSnap => {
                         if(reqSnap.exists()) {
                             btn.innerText = "Cancel Request";
                             btn.className = "profile-action-btn secondary";
                             btn.onclick = () => {
                                 db.ref('friendRequests/' + uid + '/' + myUid).remove();
                                 updateProfileButtonState(uid);
                                 showToast("Request Cancelled");
                             };
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
                if(!p.deleted) {
                    posts.push({ key: c.key, ...p });
                    count++;
                    likes += (p.likes || 0);
                }
            });
            
            document.getElementById('statPosts').innerText = count;
            document.getElementById('statLikes').innerText = likes;
            
            posts.reverse().forEach(post => {
                const div = createPostElement(post, false);
                container.appendChild(div);
                loadCommentPreview(post.key);
                loadReactionSummary(post.key);
            });
            
            if(count === 0) container.innerHTML = "<div style='color:white; opacity:0.5; font-size:12px; text-align:center; padding: var(--spacing-lg);'>No posts yet</div>";
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

    // === GIFT SKIN FUNCTIONS ===
    function openGiftModal(recipientId) {
        // Fetch recipient data first
        db.ref('users/' + recipientId).once('value', recipientSnap => {
            const recipient = recipientSnap.val();
            if(!recipient) {
                showToast("User not found");
                return;
            }
            
            const recipientOwnedSkins = recipient.ownedSkins || ['default'];
            const recipientName = recipient.name;
            
            // Update modal title
            document.getElementById('giftModalTitle').innerText = `Gift a Skin to ${recipientName}`;
            
            // Populate skins list
            const skinsList = document.getElementById('giftableSkinsList');
            skinsList.innerHTML = '';
            
            Object.entries(skinShop).forEach(([skinId, skin]) => {
                const div = document.createElement('div');
                div.className = 'skin-item';
                
                const isOwned = recipientOwnedSkins.includes(skinId);
                
                div.innerHTML = `
                    <div class="skin-preview" style="${skin.preview}">B</div>
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-cost">${skin.cost.toLocaleString()} Coins</div>
                    <button class="btn-buy-skin ${isOwned ? 'owned' : 'buy'}" ${isOwned ? 'disabled' : ''}>
                        ${isOwned ? 'Already Owned' : 'GIFT'}
                    </button>
                `;
                
                if(!isOwned) {
                    const btn = div.querySelector('button');
                    btn.onclick = () => confirmSkinGift(recipientId, skinId, recipientName);
                }
                
                skinsList.appendChild(div);
            });
            
            // Show modal
            document.getElementById('giftSkinModal').style.display = 'flex';
            lucide.createIcons();
        });
    }
    
    function confirmSkinGift(recipientId, skinId, recipientName) {
        const skin = skinShop[skinId];
        if(!skin) {
            showToast("Skin not found");
            return;
        }
        
        // Check if sender has enough points
        if(userData.points < skin.cost) {
            showToast("Insufficient Coins");
            return;
        }
        
        // Show confirmation dialog
        showCustomConfirm(
            "GIFT SKIN?",
            `Gift the ${skin.name} skin to ${recipientName} for ${skin.cost.toLocaleString()} Coins?`,
            () => executeSkinGift(recipientId, skinId)
        );
    }
    
    function executeSkinGift(recipientId, skinId) {
        const skin = skinShop[skinId];
        if(!skin) {
            showToast("Skin not found");
            return;
        }
        
        const senderId = auth.currentUser.uid;
        const senderName = userData.name;
        
        // 1. Deduct points from sender using transaction
        db.ref('users/' + senderId + '/points').transaction(currentPoints => {
            const points = currentPoints || 0;
            if(points >= skin.cost) {
                return points - skin.cost;
            } else {
                return undefined; // Abort transaction explicitly
            }
        }, (error, committed, snapshot) => {
            if(error) {
                showToast("Transaction failed");
                console.error(error);
                return;
            }
            
            if(!committed) {
                showToast("Insufficient Coins");
                return;
            }
            
            // 2. Add skin to recipient's ownedSkins array
            db.ref('users/' + recipientId + '/ownedSkins').transaction(currentSkins => {
                const skins = currentSkins || ['default'];
                if(!skins.includes(skinId)) {
                    skins.push(skinId);
                }
                return skins;
            }, (error2, committed2) => {
                if(error2 || !committed2) {
                    console.error("Failed to add skin to recipient:", error2);
                    showToast("Gift failed! Contact support.");
                    // Note: In production, implement compensating transaction to refund sender
                    return;
                }
                
                // 3. Create notification for recipient (only after successful skin transfer)
                db.ref('notifications/' + recipientId).push({
                    msg: `${senderName} gifted you the ${skin.name} skin!`,
                    type: 'gift',
                    from: senderId,
                    time: Date.now()
                });
                
                // 4. Log the transaction (only after successful completion)
                db.ref('giftLogs').push({
                    from: senderId,
                    to: recipientId,
                    skinId: skinId,
                    cost: skin.cost,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                
                // 5. UI Feedback
                document.getElementById('giftSkinModal').style.display = 'none';
                showToast("Gift sent successfully!");
                spawnFlyingCoins(10);
                playSound('win');
            });
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
                resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding: var(--spacing-lg);'>Type more to search...</div>";
                return;
            }
            resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding: var(--spacing-lg);'>Searching...</div>";
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
                            <div style="font-size:14px; font-weight:700; color:white;">${u.name} ${getBadgeHtml(u.bingoWins || 0)}</div>
                        `;
                        resDiv.appendChild(div);
                    }
                });
                if(!found) resDiv.innerHTML = "<div style='text-align:center; opacity:0.5; padding: var(--spacing-lg);'>No users found.</div>";
                lucide.createIcons();
            });
        }, 500);
    }

    let currentOpenPostKey = null;

    function openComments(postKey) {
        currentOpenPostKey = postKey;
        const list = document.getElementById('commentList');
        list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding: var(--spacing-lg);'>Loading...</div>";
        document.getElementById('commentModal').style.display = 'flex';
        document.getElementById('commentModalBackdrop').style.display = 'block';
        
        db.ref('postComments/' + postKey).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) {
                list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding: var(--spacing-lg);'>No comments yet.</div>";
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
                            <div class="comment-author">${com.uName} ${getBadgeHtml(com.uWins || 0)}</div>
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
        document.getElementById('commentInput').value = '';
        updateCommentPreview(); // Clear preview
    }

    function sendComment() {
        const txt = document.getElementById('commentInput').value.trim();
        if(!txt || !currentOpenPostKey) return;
        
        db.ref('postComments/' + currentOpenPostKey).push({
            uid: auth.currentUser.uid,
            uName: userData.name,
            uPhoto: userData.photo,
            uPoints: userData.points,
            uWins: userData.bingoWins || 0,
            text: txt,
            time: Date.now()
        });
        
        // Notify Author (Grouped logic handled in render but we push individual here)
        db.ref('socialPosts/' + currentOpenPostKey).once('value', s => {
             const p = s.val();
             if(p.uid !== auth.currentUser.uid) {
                 db.ref('notifications/' + p.uid).push({
                     msg: `${userData.name} commented on your post`,
                     time: Date.now(),
                     type: 'comment',
                     from: auth.currentUser.uid,
                     postId: currentOpenPostKey, // Link to post
                     image: userData.photo
                 });
             }
        });

        document.getElementById('commentInput').value = "";
        updateCommentPreview(); // Clear preview
    }
    
    function updateCommentPreview() {
        const input = document.getElementById('commentInput');
        const previewBox = document.getElementById('commentPreviewBox');
        const previewText = document.getElementById('commentPreviewText');
        const previewAvatar = document.getElementById('commentPreviewAvatar');
        
        const txt = input.value.trim();
        
        if(txt && userData) {
            previewBox.style.display = 'block';
            previewText.textContent = txt;
            previewAvatar.src = userData.photo || 'https://via.placeholder.com/40';
        } else {
            previewBox.style.display = 'none';
            previewText.textContent = '';
        }
    }
    
    function likeComment(postKey, commentKey) {
        showToast("Liked comment!");
    }
    
    function replyComment(name) {
        document.getElementById('commentInput').value = `@${name} `;
        document.getElementById('commentInput').focus();
        updateCommentPreview(); // Show preview for reply
    }

    function loadCommentPreview(postKey) {
        const previewContainer = document.getElementById('comment-preview-' + postKey);
        const previewList = document.getElementById('preview-list-' + postKey);
        
        if(!previewContainer || !previewList) return;
        
        db.ref('postComments/' + postKey).limitToLast(2).once('value', s => {
            if(!s.exists()) {
                previewContainer.style.display = 'none';
                return;
            }
            
            previewContainer.style.display = 'block';
            previewList.innerHTML = '';
            
            const comments = [];
            s.forEach(c => {
                comments.push({ key: c.key, ...c.val() });
            });
            
            comments.forEach(com => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.style.marginBottom = '5px';
                
                const truncatedText = com.text.length > 50 ? com.text.substring(0, 50) + '...' : com.text;
                const sanitizedText = escapeHtml(truncatedText);
                const sanitizedName = escapeHtml(com.uName);
                
                div.innerHTML = `
                    <button class="preview-user" onclick="openUserProfile('${com.uid}')" style="background:none; border:none; padding:0; font:inherit; cursor:pointer;" aria-label="View ${sanitizedName}'s profile">${sanitizedName}</button>
                    <span class="preview-text">${sanitizedText}</span>
                `;
                
                previewList.appendChild(div);
            });
        });
    }


    // === SHARE POST FUNCTIONS ===
    let currentSharePostKey = null;

    function openShareModal(postKey) {
        currentSharePostKey = postKey;
        
        // Check if Web Share API is available
        const nativeShareBtn = document.getElementById('nativeShareBtn');
        const copyLinkBtn = document.getElementById('copyLinkBtn');
        
        if (navigator.share) {
            nativeShareBtn.style.display = 'flex';
            copyLinkBtn.style.display = 'none';
        } else {
            nativeShareBtn.style.display = 'none';
            copyLinkBtn.style.display = 'flex';
        }
        
        // Get post data to show preview
        db.ref('socialPosts/' + postKey).once('value', s => {
            const post = s.val();
            if(!post) return;
            
            const sanitizedAuthor = escapeHtml(post.authorName);
            const sanitizedContent = escapeHtml(post.content || '');
            const truncatedContent = sanitizedContent.length > 100 ? sanitizedContent.substring(0, 100) + '...' : sanitizedContent;
            
            document.getElementById('sharePreview').innerHTML = `
                <div class="share-post-preview-author">${sanitizedAuthor}</div>
                <div class="share-post-preview-content">${truncatedContent}</div>
            `;
            
            document.getElementById('shareModal').style.display = 'flex';
            document.getElementById('shareModalBackdrop').style.display = 'block';
            setTimeout(() => lucide.createIcons(), 50);
        });
    }

    function closeShareModal() {
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('shareModalBackdrop').style.display = 'none';
        currentSharePostKey = null;
    }

    function shareToOwnProfile() {
        if(!currentSharePostKey) return;
        
        db.ref('socialPosts/' + currentSharePostKey).once('value', s => {
            const originalPost = s.val();
            if(!originalPost) return;
            
            // Create a new post that references the original
            const shareData = {
                uid: auth.currentUser.uid,
                authorName: userData.name,
                authorPhoto: userData.photo,
                authorPoints: userData.points,
                authorWins: userData.bingoWins || 0,
                content: '', // Empty content for pure share
                timestamp: Date.now(),
                likes: 0,
                visibility: 'public', // Shared posts default to public
                isShared: true,
                sharedPostKey: currentSharePostKey,
                sharedFrom: originalPost.uid,
                sharedFromName: originalPost.authorName,
                sharedFromPhoto: originalPost.authorPhoto,
                sharedContent: originalPost.content,
                sharedImage: originalPost.image,
                sharedMood: originalPost.mood
            };
            
            db.ref('socialPosts').push(shareData);
            
            // Notify original author
            if(originalPost.uid !== auth.currentUser.uid) {
                db.ref('notifications/' + originalPost.uid).push({
                    msg: `${userData.name} shared your post`,
                    time: Date.now(),
                    type: 'share',
                    from: auth.currentUser.uid,
                    postId: currentSharePostKey,
                    image: userData.photo
                });
            }
            
            showToast("Post shared!");
            playSound('pop');
            closeShareModal();
        });
    }

    function shareViaWebShare() {
        if(!currentSharePostKey) return;
        
        db.ref('socialPosts/' + currentSharePostKey).once('value', s => {
            const post = s.val();
            if(!post) return;
            
            const shareData = {
                title: 'Check out this post!',
                text: `${post.authorName}: ${post.content || 'Shared a post'}`,
                url: window.location.origin + '/?post=' + currentSharePostKey
            };
            
            if (navigator.share) {
                navigator.share(shareData)
                    .then(() => {
                        showToast("Shared successfully!");
                        playSound('pop');
                        closeShareModal();
                    })
                    .catch((error) => {
                        // Ignore user cancellations (AbortError, NotAllowedError)
                        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
                            console.error('Error sharing:', error);
                            showToast("Failed to share");
                        }
                    });
            } else {
                showToast("Sharing not supported");
            }
        });
    }

    function copyPostLink() {
        if(!currentSharePostKey) return;
        
        const postUrl = window.location.origin + '/?post=' + currentSharePostKey;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(postUrl)
                .then(() => {
                    showToast("Link copied to clipboard!");
                    playSound('pop');
                    closeShareModal();
                })
                .catch((error) => {
                    console.error('Error copying to clipboard:', error);
                    fallbackCopyToClipboard(postUrl);
                });
        } else {
            fallbackCopyToClipboard(postUrl);
        }
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            // Last-resort fallback using deprecated document.execCommand
            // Required for Internet Explorer and Safari versions prior to 13.1
            // This is only called after modern Clipboard API fails or is unavailable
            document.execCommand('copy');
            showToast("Link copied to clipboard!");
            playSound('pop');
            closeShareModal();
        } catch (error) {
            console.error('Fallback copy failed:', error);
            showToast("Failed to copy link");
        }
        
        document.body.removeChild(textArea);
    }


    let postListener = null;
    let feedSortMethod = 'hype';

    function toggleFeedSort(method) {
        feedSortMethod = method;
        document.getElementById('sort-hype').classList.remove('active');
        document.getElementById('sort-new').classList.remove('active');
        document.getElementById('sort-' + method).classList.add('active');
        loadSocialFeed(); // Reload with new sort
    }

    function loadSocialFeed() {
        const feedContainer = document.getElementById('socialFeed');
        if(postListener) db.ref('socialPosts').off(); // Clear old listener

        feedContainer.innerHTML = "<div style='text-align:center; padding: var(--spacing-lg); opacity:0.5;'>Loading Feed...</div>";
        
        db.ref('friends/' + auth.currentUser.uid).once('value', fSnap => {
            const myFriends = fSnap.exists() ? Object.keys(fSnap.val()) : [];
            
            postListener = db.ref('socialPosts').limitToLast(50);
            postListener.on('value', pSnap => {
                const allPosts = [];
                pSnap.forEach(child => { 
                    const val = child.val();
                    if(typeof val === 'object' && val !== null && !val.deleted) {
                        // === RANKING ALGORITHM ===
                        // Hype Score = (Time Recency) + (Likes * Weight)
                        // Time is normalized to hours since epoch to keep numbers manageable, then small weight
                        // Actually easier: Score = Time + (Likes * 1000 * 60 * 60) -> 1 Like = 1 Hour of freshness
                        const likeCount = val.likes || 0;
                        const score = val.timestamp + (likeCount * 3600000); // Each like pushes it '1 hour' forward in timeline logic
                        
                        allPosts.push({ key: child.key, hypeScore: score, ...val }); 
                    }
                });
                
                if(feedSortMethod === 'hype') {
                    allPosts.sort((a, b) => b.hypeScore - a.hypeScore);
                } else {
                    allPosts.sort((a, b) => b.timestamp - a.timestamp);
                }
                
                const scrollPos = window.scrollY; 
                
                feedContainer.innerHTML = "";
                if(allPosts.length === 0) {
                    feedContainer.innerHTML = "<div style='text-align:center; padding: var(--spacing-lg); opacity:0.5;'>No posts yet. Be the first!</div>";
                    return;
                }
                
                let adCounter = 0;
                
                allPosts.forEach(post => {
                    const isFriend = myFriends.includes(post.uid);
                    const isMe = post.uid === auth.currentUser.uid;
                    
                    // === VISIBILITY FILTERING ===
                    const visibility = post.visibility || 'public'; // Default to public for old posts
                    
                    // Only Me: only author can see
                    if(visibility === 'private' && !isMe) return;
                    
                    // Friends Only: only friends and author can see
                    if(visibility === 'friends' && !isMe && !isFriend) return;
                    
                    // Public: everyone can see (no filtering needed)
                    
                    const div = createPostElement(post, isFriend || isMe);
                    feedContainer.appendChild(div);
                    loadCommentPreview(post.key);
                    loadReactionSummary(post.key);
                    
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
                });
                lucide.createIcons();
                
                if(document.getElementById('view-home').style.display !== 'none' && window.scrollY > 200) {
                     // Only restore scroll if we are down the page
                     setTimeout(() => window.scrollTo(0, scrollPos), 10);
                }
            });
        });
    }

    function createPostElement(post, isFriend) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-card';
        postDiv.id = 'post-' + post.key;
        
        const friendBadge = isFriend ? `<span class="friend-badge">${post.uid === auth.currentUser.uid ? 'YOU' : 'FRIEND'}</span>` : '';
        const moodHtml = post.mood ? `<div class="mood-display">Feeling ${post.mood}</div>` : '';
        const imgHtml = post.image ? `<div class="post-image-container"><img src="${post.image}" class="post-image"></div>` : '';
        
        // Visibility indicator
        const visibility = post.visibility || 'public';
        let visibilityIconName = 'globe'; // public
        let visibilityText = 'Public';
        if(visibility === 'friends') {
            visibilityIconName = 'users';
            visibilityText = 'Friends';
        } else if(visibility === 'private') {
            visibilityIconName = 'lock';
            visibilityText = 'Only Me';
        }
        const visibilityBadge = `<span class="visibility-badge" title="${visibilityText}"><i data-lucide="${visibilityIconName}" style="width:10px; height:10px;"></i></span>`;
        
        // Check if this is a shared post
        let sharedPostHtml = '';
        if(post.isShared && post.sharedContent !== undefined) {
            const sharedImgHtml = post.sharedImage ? `<div class="post-image-container"><img src="${post.sharedImage}" class="post-image"></div>` : '';
            const sharedMoodHtml = post.sharedMood ? `<div class="mood-display">Feeling ${post.sharedMood}</div>` : '';
            sharedPostHtml = `
                <div class="shared-post-container">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom: var(--spacing-xs); display:flex; align-items:center; gap:5px;">
                        <i data-lucide="share-2" style="width:12px;"></i>
                        <span>Shared from ${escapeHtml(post.sharedFromName)}</span>
                    </div>
                    <div style="display:flex; gap: var(--spacing-sm); align-items:flex-start;">
                        <img src="${post.sharedFromPhoto}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;" onclick="openUserProfile('${post.sharedFrom}')">
                        <div style="flex:1;">
                            <div style="font-weight:700; font-size:11px; color:white; margin-bottom:3px;">${escapeHtml(post.sharedFromName)}</div>
                            ${sharedMoodHtml}
                            <div style="font-size:12px; color:#cbd5e1; margin-top:5px;">${escapeHtml(post.sharedContent || '')}</div>
                            ${sharedImgHtml}
                        </div>
                    </div>
                </div>
            `;
        }
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img class="post-avatar" src="${post.authorPhoto}" onclick="openUserProfile('${post.uid}')">
                <div class="post-meta">
                    <div class="post-author">${post.authorName} ${getBadgeHtml(post.authorWins || 0)} ${friendBadge}</div>
                    <div class="post-time">${fixDate(post.timestamp)} ${visibilityBadge}</div>
                    ${moodHtml}
                </div>
                ${post.uid === auth.currentUser.uid ? `
                <div style="position: relative;">
                    <button class="post-overflow-btn" onclick="togglePostMenu('${post.key}')" aria-label="Post options">
                        <i data-lucide="more-vertical" style="width:18px; height:18px;"></i>
                    </button>
                    <div class="post-overflow-menu" id="post-menu-${post.key}">
                        <button class="overflow-menu-item delete-item" onclick="deletePost('${post.key}')">
                            <i data-lucide="trash-2" style="width:14px;"></i>
                            Delete Post
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>
            <div class="post-content">${escapeHtml(post.content || '')}</div>
            ${imgHtml}
            ${sharedPostHtml}
            <div class="reaction-summary-bar" id="reaction-summary-${post.key}" onclick="openReactionViewer('${post.key}')"></div>
            <div class="post-actions" style="position:relative;">
                <button class="action-btn" id="like-btn-${post.key}" onclick="showReactionPopup('${post.key}')">
                    <i data-lucide="heart" id="like-icon-${post.key}" style="width:14px;"></i> 
                    <span id="like-count-wrapper-${post.key}" onclick="event.stopPropagation(); openReactionViewer('${post.key}')" onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openReactionViewer('${post.key}')}" role="button" tabindex="0" style="cursor:pointer; margin-left:4px;" aria-label="View who reacted to this post">
                        <span id="like-count-${post.key}">${post.likes || 0}</span>
                    </span>
                </button>
                <div id="react-pop-${post.key}" class="reaction-popup" onmouseleave="this.style.display='none'">
                    <span class="reaction-emoji" onclick="submitReaction('${post.key}', '${post.uid}', '❤️')">❤️</span>
                    <span class="reaction-emoji" onclick="submitReaction('${post.key}', '${post.uid}', '😂')">😂</span>
                    <span class="reaction-emoji" onclick="submitReaction('${post.key}', '${post.uid}', '😮')">😮</span>
                    <span class="reaction-emoji" onclick="submitReaction('${post.key}', '${post.uid}', '😢')">😢</span>
                </div>
                <button class="action-btn" onclick="openComments('${post.key}')">
                    <i data-lucide="message-circle" style="width:14px"></i> Comment
                </button>
                <button class="action-btn" onclick="openShareModal('${post.key}')">
                    <i data-lucide="share-2" style="width:14px"></i> Share
                </button>
            </div>
            <div id="comment-preview-${post.key}" class="comment-preview-area" style="display:none;">
                <div id="preview-list-${post.key}" style="margin-bottom: var(--spacing-xs);"></div>
                <button onclick="openComments('${post.key}')" style="background:none; border:none; color:var(--accent); font-size:11px; font-weight:700; cursor:pointer; padding:0;" aria-label="View all comments for this post">View all comments</button>
            </div>
        `;
        
        // Load initial state (simple check if liked)
        db.ref('postLikes/' + post.key + '/' + auth.currentUser.uid).once('value', lSnap => {
            if(lSnap.exists()) {
                const btn = postDiv.querySelector('#like-btn-' + post.key);
                const reaction = lSnap.val(); // Get stored emoji
                const sanitizedReaction = reaction === true ? '❤️' : escapeHtml(reaction);
                if(btn) {
                    btn.classList.add('liked');
                    btn.innerHTML = `<span style="font-size:16px;">${sanitizedReaction}</span> <span id="like-count-wrapper-${post.key}" onclick="event.stopPropagation(); openReactionViewer('${post.key}')" onkeypress="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openReactionViewer('${post.key}')}" role="button" tabindex="0" style="cursor:pointer; margin-left:4px;" aria-label="View who reacted to this post"><span id="like-count-${post.key}">${post.likes || 0}</span></span>`;
                }
            }
        });
        
        return postDiv;
    }

    function loadReactionSummary(postKey) {
        db.ref('postLikes/' + postKey).on('value', s => {
            const bar = document.getElementById('reaction-summary-' + postKey);
            if (!bar) return;
            bar.innerHTML = '';
            if (!s.exists()) return;

            const counts = {};
            s.forEach(child => {
                let emoji = child.val();
                // Legacy compatibility: old reactions stored as boolean true, convert to heart emoji
                if (emoji === true) emoji = '❤️';
                counts[emoji] = (counts[emoji] || 0) + 1;
            });

            // Sort by count descending
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            sorted.forEach(([emoji, count]) => {
                const span = document.createElement('span');
                span.className = 'reaction-summary-item';
                span.innerHTML = emoji + ' ' + count;
                bar.appendChild(span);
            });
        });
    }

    function showReactionPopup(postKey) {
        const pop = document.getElementById('react-pop-' + postKey);
        // Toggle
        if(pop.style.display === 'flex') pop.style.display = 'none';
        else {
            pop.style.display = 'flex';
            setTimeout(() => { 
                document.addEventListener('click', function close(e) {
                    if(!e.target.closest('#like-btn-'+postKey) && !e.target.closest('#react-pop-'+postKey)) {
                        pop.style.display = 'none';
                        document.removeEventListener('click', close);
                    }
                });
            }, 100);
        }
    }

    function submitReaction(postKey, authorUid, emoji) {
        const myUid = auth.currentUser.uid;
        const likeRef = db.ref('postLikes/' + postKey + '/' + myUid);
        const pop = document.getElementById('react-pop-' + postKey);
        
        pop.style.display = 'none'; // Hide popup

        likeRef.once('value', s => {
            if(s.exists() && s.val() === emoji) {
                // Remove reaction if same clicked
                likeRef.remove();
                db.ref('socialPosts/' + postKey + '/likes').transaction(l => (l || 1) - 1);
            } else {
                // New or Change reaction
                if(!s.exists()) {
                    db.ref('socialPosts/' + postKey + '/likes').transaction(l => (l || 0) + 1);
                     // Reward only on first interaction
                    const rewardHistoryRef = db.ref('rewardHistory/' + postKey + '/' + myUid);
                    rewardHistoryRef.once('value', histSnap => {
                        if(!histSnap.exists()) {
                            if(authorUid !== myUid) {
                                db.ref('users/' + authorUid + '/points').transaction(p => (p || 0) + 10);
                                db.ref('notifications/' + authorUid).push({
                                    msg: `${userData.name} reacted ${emoji} to your post`,
                                    time: Date.now(),
                                    type: 'like',
                                    from: myUid,
                                    postId: postKey,
                                    image: userData.photo
                                });
                            }
                            rewardHistoryRef.set(true); 
                        }
                    });
                }
                likeRef.set(emoji);
            }
        });
    }

    let currentReactionPostKey = null;

    function openReactionViewer(postKey) {
        currentReactionPostKey = postKey;
        const modal = document.getElementById('reactionViewerModal');
        const backdrop = document.getElementById('reactionViewerBackdrop');
        const list = document.getElementById('reactionViewerList');
        
        modal.style.display = 'flex';
        backdrop.style.display = 'block';
        list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding: var(--spacing-lg);'>Loading...</div>";
        
        // Fetch all reactions for this post
        db.ref('postLikes/' + postKey).once('value', s => {
            list.innerHTML = "";
            
            if(!s.exists()) {
                list.innerHTML = "<div style='text-align:center; color:white; opacity:0.5; padding: var(--spacing-lg);'>No reactions yet</div>";
                return;
            }
            
            const reactions = [];
            s.forEach(child => {
                reactions.push({
                    uid: child.key,
                    emoji: child.val()
                });
            });
            
            // Fetch user details for each reactor
            let processed = 0;
            reactions.forEach(reaction => {
                db.ref('users/' + reaction.uid).once('value', uSnap => {
                    const user = uSnap.val();
                    if(user) {
                        const div = document.createElement('div');
                        div.className = 'reaction-viewer-item';
                        div.onclick = () => {
                            closeReactionViewer();
                            openUserProfile(reaction.uid);
                        };
                        div.setAttribute('role', 'button');
                        div.setAttribute('tabindex', '0');
                        div.onkeypress = (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                closeReactionViewer();
                                openUserProfile(reaction.uid);
                            }
                        };
                        
                        const sanitizedName = escapeHtml(user.name);
                        const sanitizedPhoto = sanitizeUrl(user.photo || 'https://via.placeholder.com/40');
                        
                        div.innerHTML = `
                            <img class="reaction-viewer-avatar" src="${sanitizedPhoto}" alt="${sanitizedName}'s profile picture">
                            <div class="reaction-viewer-info">
                                <div class="reaction-viewer-name">${sanitizedName}</div>
                            </div>
                            <div class="reaction-viewer-emoji">${reaction.emoji === true ? '❤️' : escapeHtml(reaction.emoji)}</div>
                        `;
                        
                        list.appendChild(div);
                    }
                    
                    processed++;
                    if(processed === reactions.length) {
                        lucide.createIcons();
                    }
                });
            });
        });
    }


    function closeReactionViewer() {
        document.getElementById('reactionViewerModal').style.display = 'none';
        document.getElementById('reactionViewerBackdrop').style.display = 'none';
        currentReactionPostKey = null;
    }
    
    // === SOCIAL MEDIA SHARE FUNCTIONS ===
    function getShareUrl() {
        if(!currentSharePostKey) return window.location.origin;
        const baseUrl = window.location.origin + window.location.pathname;
        return baseUrl + '?post=' + currentSharePostKey;
    }
    
    function getShareText(postData) {
        if(!postData) return 'Check out this post on Radio Bingo Live!';
        const author = postData.authorName || 'Someone';
        const content = postData.content || 'this post';
        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        return `${author} shared: "${preview}" - Radio Bingo Live`;
    }
    
    function shareViaFacebook() {
        if(!currentSharePostKey) return;
        const url = encodeURIComponent(getShareUrl());
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        window.open(shareUrl, '_blank', 'width=600,height=400');
        closeShareModal();
        showToast('✓ Shared to Facebook!');
    }
    
    function shareViaTwitter() {
        if(!currentSharePostKey) return;
        db.ref('socialPosts/' + currentSharePostKey).once('value', s => {
            const post = s.val();
            const url = encodeURIComponent(getShareUrl());
            const text = encodeURIComponent(getShareText(post));
            const shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
            window.open(shareUrl, '_blank', 'width=600,height=400');
            closeShareModal();
            showToast('✓ Shared to Twitter!');
        });
    }
    
    function shareViaWhatsApp() {
        if(!currentSharePostKey) return;
        db.ref('socialPosts/' + currentSharePostKey).once('value', s => {
            const post = s.val();
            const url = encodeURIComponent(getShareUrl());
            const text = encodeURIComponent(getShareText(post) + ' ');
            const shareUrl = `https://wa.me/?text=${text}${url}`;
            window.open(shareUrl, '_blank');
            closeShareModal();
            showToast('✓ Shared to WhatsApp!');
        });
    }
    
    function shareViaTelegram() {
        if(!currentSharePostKey) return;
        db.ref('socialPosts/' + currentSharePostKey).once('value', s => {
            const post = s.val();
            const url = encodeURIComponent(getShareUrl());
            const text = encodeURIComponent(getShareText(post));
            const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
            window.open(shareUrl, '_blank');
            closeShareModal();
            showToast('✓ Shared to Telegram!');
        });
    }
    
    function shareViaMessenger() {
        if(!currentSharePostKey) return;
        const url = encodeURIComponent(getShareUrl());
        const isMobile = /mobile/i.test(navigator.userAgent);
        
        if(isMobile) {
            window.location.href = `fb-messenger://share/?link=${url}`;
        } else {
            const shareUrl = `https://www.facebook.com/dialog/send?link=${url}&redirect_uri=${url}`;
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
        
        closeShareModal();
        showToast('✓ Shared to Messenger!');
    }
