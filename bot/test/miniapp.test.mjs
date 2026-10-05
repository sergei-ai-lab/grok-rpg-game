import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const bridge = readFileSync(new URL('../../public/flock/telegram-bridge.js', import.meta.url), 'utf8');

function page({ hash = '', version = '8.0', withSdk = false } = {}) {
  const calls = [], scripts = [], listeners = {};
  const badge = { hidden: true, textContent: '' };
  const props = {};
  const body = { classList: { add: (name) => calls.push(['class', name]) }, style: { setProperty: (key, value) => { props[key] = value; } } };
  const app = {
    initData: 'signed-telegram-data', initDataUnsafe: { user: { first_name: '<img src=x>', last_name: 'Игрок' } },
    viewportStableHeight: 800, contentSafeAreaInset: { top: 44, bottom: 0 }, safeAreaInset: { top: 20, bottom: 18 },
    isVersionAtLeast: (minimum) => +version >= +minimum,
    ready: () => calls.push(['ready']), expand: () => calls.push(['expand']), requestFullscreen: () => calls.push(['fullscreen']),
    setHeaderColor: () => {}, setBackgroundColor: () => {}, onEvent: (name, fn) => { listeners[name] = fn; },
    HapticFeedback: { impactOccurred: (kind) => calls.push(['impact', kind]), notificationOccurred: (kind) => calls.push(['notification', kind]) },
  };
  const window = { location: { hash } };
  if (withSdk) window.Telegram = { WebApp: app };
  const document = { body, head: { appendChild: (script) => scripts.push(script) },
    getElementById: () => badge, createElement: () => ({}), addEventListener: (name, fn) => { listeners[name] = fn; } };
  vm.runInNewContext(bridge, { window, document });
  return { window, app, body, props, badge, scripts, calls, listeners };
}

test('outside Telegram there is no SDK request or game/display mutation', () => {
  const result = page();
  assert.equal(result.scripts.length, 0);
  assert.equal(result.badge.hidden, true);
  assert.equal(result.window.FlockTelegram, undefined);
  assert.equal(result.calls.length, 0);
});

test('inside Telegram name is plain text, fullscreen/safe areas and haptics are enabled', () => {
  const result = page({ withSdk: true });
  assert.equal(result.badge.textContent, '<img src=x> Игрок · FLOCK');
  assert.equal(result.badge.hidden, false);
  assert.ok(result.calls.some(([name]) => name === 'fullscreen'));
  assert.equal(result.props['--tg-safe-top'], '44px');
  assert.equal(result.props['--tg-safe-bottom'], '18px');
  assert.equal(result.window.FlockTelegram.haptic([10, 20, 30]), true);
  assert.ok(result.calls.some(([name]) => name === 'impact'));
  result.window.FlockTelegram.haptic([10, 20, 30, 20, 10]);
  assert.ok(result.calls.some(([name]) => name === 'notification'));
});

test('old Telegram clients skip unsupported fullscreen and haptics', () => {
  const result = page({ withSdk: true, version: '6.0' });
  assert.ok(!result.calls.some(([name]) => name === 'fullscreen'));
  assert.equal(result.window.FlockTelegram.haptic(8), false);
});

test('Telegram hash loads SDK asynchronously and an SDK failure leaves the game alone', () => {
  const result = page({ hash: '#tgWebAppVersion=8.0' });
  assert.equal(result.scripts[0].src, 'https://telegram.org/js/telegram-web-app.js');
  assert.equal(result.scripts[0].async, true);
  result.scripts[0].onerror();
  assert.equal(result.badge.hidden, true);
  assert.equal(result.window.FlockTelegram, undefined);
});
