import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncubatorBot } from '../src/telegram.mjs';
import { DEFAULT_FLOCK_DIR, DEFAULT_GAME_URL } from '../src/config.mjs';
import { DAY } from '../src/identity.mjs';
import { fixture, BASE, CATALOG } from './helpers.mjs';

function setup(t, inline = true) {
  const data = fixture(t);
  const calls = [];
  let now = BASE;
  const bot = createIncubatorBot({ store: data.store, catalog: () => CATALOG, clock: () => now, eggDelayMs: 0,
    config: { token: '777:fake-test-token', ownerId: '100', flockDir: DEFAULT_FLOCK_DIR, gameUrl: DEFAULT_GAME_URL },
    botInfo: { id: 777, is_bot: true, first_name: 'DragonVerse', username: 'DragonVerseBot', supports_inline_queries: inline },
  });
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload });
    if (['answerCallbackQuery', 'answerInlineQuery'].includes(method)) return { ok: true, result: true };
    const result = { message_id: calls.length, date: 1, chat: { id: Number(payload.chat_id), type: 'private' } };
    if (method === 'sendPhoto') result.photo = [{ file_id: `photo-${calls.length}`, width: 900, height: 1340 }];
    return { ok: true, result };
  });
  function command(updateId, id, text, chatType = 'private') {
    return bot.handleUpdate({ update_id: updateId, message: { message_id: updateId, date: 1,
      from: { id, is_bot: false, first_name: 'Player' }, chat: { id: chatType === 'private' ? id : -999, type: chatType }, text,
      entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } });
  }
  function callback(updateId, id, action) {
    return bot.handleUpdate({ update_id: updateId, callback_query: { id: `cb-${updateId}`, chat_instance: 'test', data: action,
      from: { id, is_bot: false, first_name: 'Player' },
      message: { message_id: updateId, date: 1, chat: { id, type: 'private' } } } });
  }
  return { ...data, bot, calls, command, callback, advance: (days) => { now += days * DAY; } };
}

test('/start delivers egg then personal dragon, with Mini App and referral link', async (t) => {
  const { command, calls, store } = setup(t);
  await command(1, 100, '/start tiktok');
  const photos = calls.filter((call) => call.method === 'sendPhoto');
  assert.equal(photos.length, 2);
  assert.match(photos[0].payload.caption, /яйцо/);
  assert.match(photos[1].payload.caption, /start=ref_100/);
  assert.equal(photos[1].payload.reply_markup.inline_keyboard[2][0].web_app.url, DEFAULT_GAME_URL);
  assert.equal(store.getPlayer('100').source, 'tiktok');
  await command(2, 100, '/start insta');
  assert.equal(store.stats().events.hatch, 1);
});

test('owner-only stats does not disclose metrics to another user or group', async (t) => {
  const { command, calls } = setup(t);
  await command(1, 200, '/stats');
  assert.equal(calls.at(-1).payload.text, 'Статистика доступна только владельцу.');
  await command(2, 100, '/stats');
  assert.match(calls.at(-1).payload.text, /Игроков: 0/);
  const count = calls.length;
  await command(3, 100, '/stats', 'group');
  assert.equal(calls.length, count);
});

test('feed callback is idempotent and evolution sends a new card', async (t) => {
  const { command, callback, advance, store, calls } = setup(t);
  await command(1, 100, '/start');
  await callback(2, 100, 'feed');
  await callback(2, 100, 'feed');
  assert.equal(store.getPlayer('100').feedings, 1);
  await callback(3, 100, 'feed');
  assert.equal(store.getPlayer('100').feedings, 1);
  advance(1); await callback(4, 100, 'feed');
  advance(1); await callback(5, 100, 'feed');
  assert.equal(store.getPlayer('100').stage, 2);
  assert.match(calls.filter((call) => call.method === 'sendPhoto').at(-1).payload.caption, /Эволюция/);
});

test('share sends cached card via inline, records confirmed sends and rejects other IDs', async (t) => {
  const { command, callback, calls, bot, store } = setup(t);
  await command(1, 100, '/start');
  await callback(2, 100, 'share');
  const share = calls.filter((call) => call.method === 'sendPhoto').at(-1);
  assert.equal(share.payload.reply_markup.inline_keyboard[0][0].switch_inline_query, 'dragon_100');
  await bot.handleUpdate({ update_id: 3, inline_query: { id: 'inline-3', query: 'dragon_100', offset: '', from: { id: 100, is_bot: false, first_name: 'Player' } } });
  const result = calls.at(-1).payload.results[0];
  assert.equal(result.type, 'photo');
  assert.ok(result.photo_file_id);
  assert.match(result.caption, /start=ref_100/);
  for (const updateId of [4, 5]) await bot.handleUpdate({ update_id: updateId, chosen_inline_result: {
    result_id: result.id, inline_message_id: 'unique-sent-message', query: 'dragon_100', from: { id: 100, is_bot: false, first_name: 'Player' },
  } });
  assert.equal(store.stats().events.share_sent, 1);
  await bot.handleUpdate({ update_id: 6, inline_query: { id: 'inline-6', query: 'dragon_200', offset: '', from: { id: 100, is_bot: false, first_name: 'Player' } } });
  assert.deepEqual(calls.at(-1).payload.results, []);
});

test('without inline mode a card with referral caption and sharing fallback is still delivered', async (t) => {
  const { command, callback, calls } = setup(t, false);
  await command(1, 100, '/start');
  await callback(2, 100, 'share');
  const card = calls.filter((call) => call.method === 'sendPhoto').at(-1);
  assert.match(card.payload.caption, /Переслать/);
  assert.match(card.payload.reply_markup.inline_keyboard[0][0].url, /t\.me\/share\/url/);
});

test('/quiet and /remind persist reminder preferences', async (t) => {
  const { command, store } = setup(t);
  await command(1, 100, '/start');
  await command(2, 100, '/quiet');
  assert.equal(store.getPlayer('100').reminders, 0);
  await command(3, 100, '/remind');
  assert.equal(store.getPlayer('100').reminders, 1);
});
