/* Telegram is a display/input adapter. No account auth or rewards use initDataUnsafe. */
(function () {
  'use strict';
  const inTelegram = /(?:^|[&#])tgWebApp(?:Data|Version|Platform)=/.test(window.location.hash)
    || !!window.Telegram?.WebApp?.initData;
  if (!inTelegram) return;

  function connect() {
    const app = window.Telegram?.WebApp;
    if (!app || !app.initData) return;
    const user = app.initDataUnsafe?.user;
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').slice(0, 80) || 'Игрок';
    const badge = document.getElementById('tg-player');
    if (!badge) return;
    badge.textContent = name + ' · FLOCK';
    badge.hidden = false;
    document.body.classList.add('tg-mini-app');
    const safely = (fn) => { try { fn(); } catch { /* Optional Telegram capability. */ } };
    const supported = (version) => typeof app.isVersionAtLeast === 'function' && app.isVersionAtLeast(version);
    function viewport() {
      const top = Math.max(app.safeAreaInset?.top || 0, app.contentSafeAreaInset?.top || 0);
      const bottom = Math.max(app.safeAreaInset?.bottom || 0, app.contentSafeAreaInset?.bottom || 0);
      document.body.style.setProperty('--tg-safe-top', top + 'px');
      document.body.style.setProperty('--tg-safe-bottom', bottom + 'px');
      if (app.viewportStableHeight > 0) document.body.style.height = app.viewportStableHeight + 'px';
    }
    window.FlockTelegram = {
      active: true, playerName: name,
      haptic(pattern) {
        if (!supported('6.1') || !app.HapticFeedback) return false;
        safely(() => {
          if (Array.isArray(pattern) && pattern.length >= 5) app.HapticFeedback.notificationOccurred('success');
          else app.HapticFeedback.impactOccurred(Array.isArray(pattern) && pattern.length > 2 ? 'medium' : 'light');
        });
        return true;
      },
    };
    safely(() => app.ready());
    safely(() => app.expand());
    safely(() => app.setHeaderColor('#0e0c0b'));
    safely(() => app.setBackgroundColor('#0e0c0b'));
    if (supported('8.0') && typeof app.requestFullscreen === 'function') safely(() => app.requestFullscreen());
    ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged'].forEach((event) => {
      safely(() => app.onEvent(event, viewport));
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('button:not(:disabled)')) window.FlockTelegram.haptic(8);
    });
    viewport();
  }

  if (window.Telegram?.WebApp) connect();
  else {
    const sdk = document.createElement('script');
    sdk.src = 'https://telegram.org/js/telegram-web-app.js';
    sdk.async = true;
    sdk.onload = connect;
    sdk.onerror = function () { /* The game stays usable if Telegram's SDK fails. */ };
    document.head.appendChild(sdk);
  }
}());
