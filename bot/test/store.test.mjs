import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY } from '../src/identity.mjs';
import { IncubatorStore } from '../src/store.mjs';
import { fixture, BASE, CATALOG } from './helpers.mjs';

test('first-touch source and dragon persist across repeat starts, catalog growth and restart', (t) => {
  const { store, dir, start } = fixture(t);
  assert.equal(start('100', 'tiktok').created, true);
  const dragon = store.getPlayer('100').dragon;
  assert.equal(start('100', 'insta', BASE + DAY).created, false);
  assert.equal(store.getPlayer('100').source, 'tiktok');
  store.close();
  const reopened = new IncubatorStore(dir);
  t.after(() => reopened.close());
  reopened.start({ id: '100', payload: 'ref_200', catalog: [...CATALOG, { id: 'new', art: ['img/new-1.webp'] }], key: 'reopened', now: BASE + 2 * DAY });
  assert.deepEqual(reopened.getPlayer('100').dragon, dragon);
  assert.equal(reopened.stats(BASE + 3 * DAY).events.hatch, 1);
});

test('same Telegram start update is replayed without a second hatch or referral reward', (t) => {
  const { store, start } = fixture(t);
  start('100');
  const first = start('200', 'ref_100', BASE, 'telegram-update-42');
  assert.equal(first.rewardedReferrer, '100');
  assert.equal(start('200', 'ref_100', BASE + DAY, 'telegram-update-42').replayed, true);
  assert.equal(store.getPlayer('100').bonus_food, 1);
  assert.equal(store.stats().events.referral, 1);
});

test('self referrals, existing players and unknown referrers grant no food', (t) => {
  const { store, start } = fixture(t);
  assert.equal(start('100', 'ref_100').rewardedReferrer, null);
  start('200');
  assert.equal(start('200', 'ref_100', BASE + DAY).rewardedReferrer, null);
  assert.equal(start('300', 'ref_999').rewardedReferrer, null);
  assert.equal(store.getPlayer('100').bonus_food, 0);
  assert.equal(store.stats().events.referral || 0, 0);
});

test('one invitee cannot reward two referrers across two SQLite connections', (t) => {
  const { store, dir, start } = fixture(t);
  start('100'); start('200');
  const second = new IncubatorStore(dir);
  t.after(() => second.close());
  start('300', 'ref_100');
  second.start({ id: '300', payload: 'ref_200', catalog: CATALOG, key: 'second-connection', now: BASE });
  assert.equal(store.getPlayer('100').bonus_food, 1);
  assert.equal(store.getPlayer('200').bonus_food, 0);
});

test('feeding enforces rolling 24 hours including midnight, exact boundary and delayed return', (t) => {
  const { store, start } = fixture(t);
  start('100');
  const beforeMidnight = Date.UTC(2026, 9, 1, 23, 59);
  assert.equal(store.feed('100', 'feed-1', beforeMidnight).ok, true);
  assert.equal(store.feed('100', 'feed-2', beforeMidnight + 120_000).reason, 'cooldown');
  assert.equal(store.feed('100', 'feed-3', beforeMidnight + DAY - 1).reason, 'cooldown');
  assert.equal(store.feed('100', 'feed-4', beforeMidnight + DAY).ok, true);
  assert.equal(store.feed('100', 'feed-5', beforeMidnight + 10 * DAY).feedings, 3);
});

test('replayed feeding update never grants growth, even after another day', (t) => {
  const { store, start } = fixture(t);
  start('100');
  store.feed('100', 'same-update', BASE);
  assert.equal(store.feed('100', 'same-update', BASE + DAY).replayed, true);
  assert.equal(store.getPlayer('100').feedings, 1);
});

test('evolutions happen once at the third and seventh feeding; titan feeding is disabled', (t) => {
  const { store, start } = fixture(t);
  start('100');
  for (let n = 1; n <= 7; n++) {
    const result = store.feed('100', `meal-${n}`, BASE + (n - 1) * DAY);
    assert.equal(result.stage, n >= 7 ? 3 : n >= 3 ? 2 : 1);
    assert.equal(result.evolved, n === 3 || n === 7);
  }
  assert.equal(store.feed('100', 'extra-meal', BASE + 7 * DAY).reason, 'grown');
  const stats = store.stats();
  assert.equal(stats.events.evolution_2, 1);
  assert.equal(stats.events.evolution_3, 1);
  assert.equal(store.getPlayer('100').feedings, 7);
});

test('referral food adds visible glow but cannot bypass cooldown or the 3/7 milestones', (t) => {
  const { store, start } = fixture(t);
  start('100'); start('200', 'ref_100');
  const feed = store.feed('100', 'meal', BASE);
  assert.equal(feed.usedBonus, true);
  assert.equal(feed.feedings, 1);
  assert.equal(store.getPlayer('100').bonus_food, 0);
  assert.equal(store.getPlayer('100').glow, 1);
  assert.equal(store.feed('100', 'rapid', BASE + 1).reason, 'cooldown');
});

test('retention uses real activity in D1/D3/D7 windows and completed cohorts only', (t) => {
  const { store, start } = fixture(t);
  start('100', 'tiktok'); start('200', 'insta');
  store.visit('100', BASE + DAY + 1);
  store.visit('100', BASE + DAY + 2);
  store.visit('200', BASE + 3 * DAY + 1);
  store.visit('100', BASE + 7 * DAY + 1);
  start('300', '', BASE + 8 * DAY);
  const rows = store.stats(BASE + 9 * DAY).retention;
  assert.deepEqual(rows.map((row) => [row.day, row.returned, row.eligible]), [[1, 1, 2], [3, 1, 2], [7, 1, 2]]);
  assert.equal(store.stats(BASE + DAY).retention[0].eligible, 0);
});

test('share counters deduplicate the same confirmed inline message', (t) => {
  const { store, start } = fixture(t);
  start('100');
  store.event('intent:1', '100', 'share_intent', BASE);
  store.event('sent:same-message', '100', 'share_sent', BASE);
  store.event('sent:same-message', '100', 'share_sent', BASE + 1);
  assert.equal(store.stats().events.share_sent, 1);
  assert.equal(store.stats().events.share_intent, 1);
});

test('failed hatch rolls back without creating an operation or a player', (t) => {
  const { store } = fixture(t);
  assert.throws(() => store.start({ id: '100', catalog: [], key: 'bad', now: BASE }));
  assert.equal(store.getPlayer('100'), null);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM operations').get().n, 0);
});

test('reminder claim survives restart and respects opt-out, blocks and titan stage', (t) => {
  const { store, dir, start } = fixture(t);
  start('100'); start('200'); start('300'); start('400');
  store.setReminders('200', false); store.setBlocked('300', true);
  for (let n = 0; n < 7; n++) store.feed('400', `meal-${n}`, BASE + n * DAY);
  assert.deepEqual(store.dueReminderIds(BASE + 8 * DAY), ['100']);
  assert.equal(store.claimReminder('100', BASE + 8 * DAY), true);
  store.close();
  const reopened = new IncubatorStore(dir);
  t.after(() => reopened.close());
  assert.equal(reopened.claimReminder('100', BASE + 9 * DAY - 1), false);
  assert.equal(reopened.claimReminder('100', BASE + 9 * DAY), true);
});
