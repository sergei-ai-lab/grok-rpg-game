import test from 'node:test';
import assert from 'node:assert/strict';
import { hatchDragon, RARITIES, rarityForRoll, telegramId, attribution } from '../src/identity.mjs';
import { CATALOG } from './helpers.mjs';

test('hatch identity is deterministic, independent of catalog order, and unique per player', () => {
  const first = hatchDragon(123456789, CATALOG);
  assert.deepEqual(first, hatchDragon('123456789', [...CATALOG].reverse()));
  const second = hatchDragon(123456790, CATALOG);
  assert.notEqual(first.dragonId, second.dragonId);
  assert.notEqual(first.serial, second.serial);
  assert.notEqual(first.hue, second.hue);
  assert.equal(first.legend.length, 2);
  assert.ok(first.hue >= 0 && first.hue < 360);
});

test('rarity boundaries implement exactly 60 / 25 / 12 / 3 percent', () => {
  for (const [roll, expected] of [[0, 'common'], [.599999, 'common'], [.6, 'rare'], [.849999, 'rare'], [.85, 'epic'], [.969999, 'epic'], [.97, 'legendary'], [.999999, 'legendary']]) {
    assert.equal(rarityForRoll(roll), expected);
  }
  assert.equal(RARITIES.reduce((sum, row) => sum + row.chance, 0), 100);
  assert.throws(() => rarityForRoll(1));
  assert.throws(() => rarityForRoll(-1));
});

test('20,000 deterministic player IDs follow the requested rarity distribution', () => {
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (let id = 1; id <= 20_000; id++) counts[hatchDragon(id, CATALOG).rarity]++;
  for (const row of RARITIES) assert.ok(Math.abs(counts[row.id] / 200 - row.chance) < 1, `${row.id}: ${counts[row.id]}`);
});

test('IDs and attribution reject self referrals, malformed IDs and arbitrary sources', () => {
  assert.equal(telegramId(1234), '1234');
  for (const id of [0, -1, 'abc', '01', '9007199254740992']) assert.throws(() => telegramId(id));
  assert.deepEqual(attribution('ref_1234', '1234'), { source: 'direct', referrerId: null });
  assert.deepEqual(attribution('ref_9999', '1234'), { source: 'ref', referrerId: '9999' });
  assert.equal(attribution('tiktok', '1234').source, 'tiktok');
  assert.equal(attribution('insta', '1234').source, 'insta');
  assert.equal(attribution('ref_01', '1234').source, 'direct');
  assert.equal(attribution('<script>', '1234').source, 'direct');
});
