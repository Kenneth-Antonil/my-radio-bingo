// main.js - Shared Logic
let userData = {};

// 1. Auth Listener (Runs on ALL pages)
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("User logged in:", user.uid);
        // Update Header UI if elements exist
        if(document.getElementById('userImg')) document.getElementById('userImg').src = user.photoURL;
        
        // Fetch User Data
        db.ref('users/' + user.uid).on('value', s => {
            userData = s.val();
            userData.uid = user.uid;
            if(document.getElementById('userPoints')) document.getElementById('userPoints').innerText = (userData.points || 0).toLocaleString();
            
            // PAGE SPECIFIC LOADERS
            if (window.location.pathname.includes('bingo.html')) {
                loadBingoPage();
            }
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                loadHomePage();
            }
        });
    } else {
        // Redirect to login if needed, or show login overlay
        // document.getElementById('loginOverlay').style.display = 'flex';
    }
});

function login() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
}

// 2. Home Page Logic
function loadHomePage() {
    const feed = document.getElementById('socialFeed');
    if(!feed) return;
    
    feed.innerHTML = "Loading posts...";
    db.ref('socialPosts').limitToLast(20).on('value', s => {
        feed.innerHTML = "";
        s.forEach(postSnap => {
            const p = postSnap.val();
            const div = document.createElement('div');
            div.className = 'post-card';
            div.innerHTML = `
                <div class="post-header">
                    <img class="post-avatar" src="${p.authorPhoto}">
                    <div><b>${p.authorName}</b></div>
                </div>
                <div>${p.content}</div>
            `;
            feed.prepend(div);
        });
    });
}

// 3. Bingo Page Logic
function loadBingoPage() {
    const grid = document.getElementById('bingoGrid');
    if(!grid) return;
    
    // Draw Card
    let card = userData.currentCard || [];
    if(card.length === 0) card = Array(25).fill("?");
    
    grid.innerHTML = "";
    card.forEach((num, i) => {
        const div = document.createElement('div');
        div.className = 'cell';
        div.innerText = num === "FREE" ? "★" : num;
        
        // Check hits (Dummy check for now)
        db.ref('drawnNumbers').on('value', s => {
            const drawn = s.val() ? Object.values(s.val()) : [];
            if(drawn.includes(num) || num === "FREE") div.classList.add('hit');
        });
        
        grid.appendChild(div);
    });

    // Listen for current ball
    db.ref('gameState/lastCalled').on('value', s => {
        if(document.getElementById('currentBall')) document.getElementById('currentBall').innerText = s.val() || "--";
    });
}