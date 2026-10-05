import { createServer } from 'node:http';
import { readConfig } from './config.mjs';
import { IncubatorStore } from './store.mjs';
import { createCatalogReader } from './catalog.mjs';
import { createIncubatorBot } from './telegram.mjs';
import { sendDueReminders } from './reminders.mjs';

const log = (event) => console.log(JSON.stringify(event));

async function main() {
  const config = readConfig();
  const catalog = createCatalogReader(config.flockDir);
  const available = catalog();
  if (!available.length) throw new Error('No hatchling art available');
  const store = new IncubatorStore(config.dataDir);
  const bot = createIncubatorBot({ config, store, catalog, log });
  const abort = new AbortController();
  let ready = false;
  let stopping = false;
  let reminderTask = null;
  let pollingTask = null;
  let shutdownTask = null;
  let interval;
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/healthz') { res.writeHead(404).end(); return; }
    res.writeHead(ready && !stopping ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: ready && !stopping }));
  });
  function shutdown() {
    if (shutdownTask) return shutdownTask;
    stopping = true;
    ready = false;
    clearInterval(interval);
    abort.abort();
    shutdownTask = (async () => {
      if (bot.isRunning()) await bot.stop();
      // grammY stop() cancels polling but does not await active middleware.
      // Drain start() before closing SQLite so an in-flight card handler can finish.
      if (pollingTask) await pollingTask.catch(() => {});
      if (reminderTask) await reminderTask;
      await new Promise((resolve) => server.close(resolve));
      store.close();
      log({ event: 'stopped' });
    })();
    return shutdownTask;
  }
  const onSignal = () => {
    const deadline = setTimeout(() => process.exit(1), 15_000);
    deadline.unref();
    void shutdown().then(() => { clearTimeout(deadline); process.exit(0); });
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, '0.0.0.0', resolve);
    });
    await bot.init();
    const webhook = await bot.api.getWebhookInfo();
    if (webhook.url) {
      log({ event: 'startup_blocked', reason: 'existing_webhook', action: 'Claude must remove the old webhook before enabling polling' });
      throw new Error('Existing webhook must be removed by the deployer');
    }
    await bot.api.setMyCommands([
      { command: 'start', description: 'Вылупить личного дракона' },
      { command: 'dragon', description: 'Карточка твоего дракона' },
      { command: 'feed', description: 'Покормить раз в 24 часа' },
      { command: 'play', description: 'Играть в FLOCK' },
      { command: 'quiet', description: 'Выключить напоминания' },
      { command: 'remind', description: 'Включить напоминания' },
    ]);
    const remind = () => {
      if (reminderTask || stopping) return;
      reminderTask = sendDueReminders({ store, api: bot.api, gameUrl: config.gameUrl, log, signal: abort.signal })
        .catch(() => log({ event: 'reminder_tick_failed' })).finally(() => { reminderTask = null; });
    };
    pollingTask = bot.start({
      allowed_updates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result', 'my_chat_member'],
      drop_pending_updates: false,
      onStart: (me) => {
        ready = true;
        log({ event: 'started', username: me.username, hatchlingSpecies: available.length,
          inlineEnabled: !!me.supports_inline_queries });
        interval = setInterval(remind, 60_000);
        remind();
      },
    });
    await pollingTask;
  } finally {
    await shutdown();
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
  }
}

main().catch((error) => {
  // Only configuration messages (never Telegram errors/URLs) are printed.
  const configError = /^(BOT_TOKEN|OWNER_TELEGRAM_ID|DATA_DIR|GAME_URL|Invalid PORT|No hatchling art|catalog\.json|Existing webhook)/.test(error.message);
  log({ event: 'startup_failed', reason: configError ? error.message : 'Check bot configuration, writable DATA_DIR and Telegram connectivity', code: error.error_code || null });
  process.exitCode = 1;
});
