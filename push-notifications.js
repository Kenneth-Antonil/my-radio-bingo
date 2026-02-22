// ============================================================
// push-notifications.js
// I-INCLUDE ito sa index.html bago mag-close ng </body>:
//   <script src="push-notifications.js"></script>
// ============================================================

const PushNotif = (() => {

  // ⚠️ I-PASTE ang VAPID key mo dito:
  // Firebase Console → Project Settings → Cloud Messaging
  // → Web configuration → Generate key pair → i-copy
  const VAPID_KEY = 'BKaRv3bFBjqNJ7zdJnUyH7g0bw0TX-7rbxNDQng8yW5JPX1Ha8jA6E_9R3vjlIU80XZjM7BNIuR2m80VDlvlepk';

  const messaging = firebase.messaging();
  let initialized = false;

  // ----------------------------------------------------------
  // INIT — tawagin pagkatapos mag-login ang user
  // ----------------------------------------------------------
  async function init() {
    if (initialized) return;
    initialized = true;

    try {
      // Huwag mag-prompt agad — hintayin ang user interaction
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        await saveToken();
        listenForeground();
        console.log('[PushNotif] Ready ✅');
      } else {
        console.log('[PushNotif] Permission denied');
      }
    } catch (err) {
      console.error('[PushNotif] Init error:', err);
    }
  }

  // ----------------------------------------------------------
  // SAVE FCM TOKEN SA FIRESTORE
  // ----------------------------------------------------------
  async function saveToken() {
    try {
      const token = await messaging.getToken({ vapidKey: VAPID_KEY });
      if (!token) return;

      const user = firebase.auth().currentUser;
      if (!user) return;

      await firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
          lastSeen:  firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      console.log('[PushNotif] Token saved:', token.substring(0, 20) + '...');
    } catch (err) {
      console.error('[PushNotif] Token error:', err);
    }
  }

  // ----------------------------------------------------------
  // FOREGROUND NOTIFICATION (app bukas)
  // Kapag bukas ang app, hindi auto-show ang native notification
  // kaya gagawa tayo ng in-app toast
  // ----------------------------------------------------------
  function listenForeground() {
    messaging.onMessage((payload) => {
      console.log('[PushNotif] Foreground message:', payload);
      showToast(payload);
    });
  }

  // ----------------------------------------------------------
  // IN-APP TOAST NOTIFICATION
  // ----------------------------------------------------------
  function showToast(payload) {
    const notif  = payload.notification || {};
    const data   = payload.data || {};
    const title  = notif.title || 'Radio Bingo';
    const body   = notif.body  || '';
    const url    = data.url    || '/';
    const type   = data.type   || 'general';
    const icon   = getTypeIcon(type);

    // Remove existing toast of same type
    const existing = document.querySelector(`.rb-toast[data-type="${type}"]`);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'rb-toast';
    toast.setAttribute('data-type', type);
    toast.innerHTML = `
      <div class="rb-toast-icon">${icon}</div>
      <div class="rb-toast-content">
        <div class="rb-toast-title">${escHtml(title)}</div>
        <div class="rb-toast-body">${escHtml(body)}</div>
      </div>
      <button class="rb-toast-close" onclick="this.closest('.rb-toast').remove()">✕</button>
    `;

    // Navigate on click
    toast.addEventListener('click', (e) => {
      if (e.target.classList.contains('rb-toast-close')) return;
      toast.remove();
      if (url && url !== '/') window.location.href = url;
    });

    // Inject styles if not yet injected
    injectStyles();

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('rb-toast--visible'));

    // Auto-remove after 6 seconds
    setTimeout(() => {
      toast.classList.remove('rb-toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 6000);
  }

  // ----------------------------------------------------------
  // HELPER: icon base sa type
  // ----------------------------------------------------------
  function getTypeIcon(type) {
    const icons = {
      draw_reminder: '🎯',
      new_message:   '💬',
      comment:       '🗨️',
      reaction:      '❤️',
      friend_request:'👥',
      friend_accepted:'✅',
      win:           '🎉',
      verification:  '☑️',
      general:       '📣'
    };
    return icons[type] || icons.general;
  }

  // ----------------------------------------------------------
  // INJECT TOAST CSS (isang beses lang)
  // ----------------------------------------------------------
  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .rb-toast {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #1e1b4b;
        border: 1px solid #4f46e5;
        color: #fff;
        padding: 12px 14px;
        border-radius: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-width: 320px;
        width: calc(100vw - 32px);
        cursor: pointer;
        opacity: 0;
        transform: translateY(-20px) scale(0.96);
        transition: opacity 0.35s ease, transform 0.35s ease;
        user-select: none;
      }
      .rb-toast--visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .rb-toast-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      .rb-toast-content {
        flex: 1;
        min-width: 0;
      }
      .rb-toast-title {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rb-toast-body {
        font-size: 12px;
        color: #a5b4fc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rb-toast-close {
        background: none;
        border: none;
        color: #6b7280;
        font-size: 14px;
        cursor: pointer;
        padding: 0 4px;
        flex-shrink: 0;
        line-height: 1;
      }
      .rb-toast-close:hover { color: #fff; }

      @media (max-width: 480px) {
        .rb-toast { top: 8px; right: 8px; max-width: calc(100vw - 16px); }
      }
    `;
    document.head.appendChild(style);
  }

  // ----------------------------------------------------------
  // ESCAPE HTML para safe
  // ----------------------------------------------------------
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------
  return { init, saveToken };

})();

// ----------------------------------------------------------
// AUTO-INIT pagkatapos mag-login
// ----------------------------------------------------------
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // Slight delay para matapos muna mag-load ang app
    setTimeout(() => PushNotif.init(), 2000);
  }
});
