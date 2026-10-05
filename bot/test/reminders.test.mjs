import test from 'node:test';
import assert from 'node:assert/strict';
import { sendDueReminders } from '../src/reminders.mjs';
import { DAY } from '../src/identity.mjs';
import { fixture, BASE } from './helpers.mjs';

test('a failed or ambiguous Telegram send is not retried within 24h', async (t) => {
  const { store, start } = fixture(t);
  start('100');
  let sends = 0;
  const api = { sendMessage: async () => { sends++; throw new Error('Connection lost after send'); } };
  await sendDueReminders({ store, api, gameUrl: 'https://example.com/', now: BASE + DAY });
  await sendDueReminders({ store, api, gameUrl: 'https://example.com/', now: BASE + DAY + 1 });
  assert.equal(sends, 1);
});

test('blocked players are excluded after a Telegram 403', async (t) => {
  const { store, start } = fixture(t);
  start('100');
  const api = { sendMessage: async () => { throw Object.assign(new Error('blocked'), { error_code: 403 }); } };
  await sendDueReminders({ store, api, gameUrl: 'https://example.com/', now: BASE + DAY });
  assert.equal(store.getPlayer('100').blocked, 1);
  assert.deepEqual(store.dueReminderIds(BASE + 2 * DAY), []);
});
