import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cardDescriptor, renderCard, renderEgg, escapeXml } from '../src/cards.mjs';
import { hatchDragon } from '../src/identity.mjs';
import { DEFAULT_FLOCK_DIR } from '../src/config.mjs';
import { CATALOG } from './helpers.mjs';

test('server generates a real egg JPEG and three distinct, Telegram-sized card images', async () => {
  const egg = await renderEgg();
  assert.equal((await sharp(egg).metadata()).format, 'jpeg');
  const dragon = hatchDragon('123456789', CATALOG);
  const images = [];
  for (const [stage, feedings] of [[1, 0], [2, 3], [3, 7]]) {
    const player = { dragon, stage, feedings, glow: 0 };
    const descriptor = cardDescriptor(DEFAULT_FLOCK_DIR, player, CATALOG);
    const card = await renderCard(player, descriptor);
    const metadata = await sharp(card).metadata();
    assert.equal(metadata.width, 900);
    assert.equal(metadata.height, 1340);
    assert.equal(metadata.format, 'jpeg');
    assert.ok(card.length < 2_000_000);
    images.push(card);
  }
  assert.ok(!images[0].equals(images[1]));
  assert.ok(!images[1].equals(images[2]));
});

test('card content safely escapes XML and hue produces a different personal portrait', async () => {
  assert.equal(escapeXml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
  const dragon = { ...hatchDragon('100', CATALOG), name: '<Dragon & Friends>' };
  const player = { dragon, stage: 1, feedings: 0, glow: 0 };
  const descriptor = cardDescriptor(DEFAULT_FLOCK_DIR, player, CATALOG);
  const first = await renderCard(player, descriptor);
  const second = await renderCard({ ...player, dragon: { ...dragon, hue: (dragon.hue + 150) % 360 } }, descriptor);
  assert.ok(!first.equals(second));
});
