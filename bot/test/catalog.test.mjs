import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCatalog, createCatalogReader, localArtPath, resolveDragonArt } from '../src/catalog.mjs';
import { hatchDragon } from '../src/identity.mjs';
import { CATALOG } from './helpers.mjs';
import { DEFAULT_FLOCK_DIR, readConfig } from '../src/config.mjs';

function artFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dv-art-'));
  mkdirSync(join(root, 'img'));
  writeFileSync(join(root, 'img/test-1.webp'), 'first stage');
  writeFileSync(join(root, 'img/test-2.webp'), 'first stage');
  writeFileSync(join(root, 'img/test-3.webp'), 'third stage');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('legacy folder reads hatchlings and refuses copied evolution stages', (t) => {
  const root = artFixture(t);
  assert.ok(CATALOG.length >= 1);
  assert.deepEqual(loadCatalog(root)[0].art, ['img/test-1.webp', null, 'img/test-3.webp']);
  const dragon = hatchDragon('100', CATALOG);
  const art = resolveDragonArt(DEFAULT_FLOCK_DIR, dragon, 3, CATALOG);
  assert.ok(art.local.endsWith('.webp'));
  assert.equal(art.provisional, art.actualStage !== 3);
});

test('catalog.json appearing later is read in the art pipeline schema', (t) => {
  const root = artFixture(t);
  const read = createCatalogReader(root);
  assert.equal(read()[0].name, 'Test');
  writeFileSync(join(root, 'catalog.json'), JSON.stringify({ dragons: [{ id: 'test', name: 'Тестовый', family: 'ice',
    legend: 'Он родился во льдах. Он хранит стаю.', stages: {
      hatchling: { art: { status: 'ready', path: 'img/test-1.webp' } },
      adult: { art: { status: 'ready', path: 'img/test-2.webp' } },
      titan: { art: { status: 'ready', path: 'img/test-3.webp' } },
    } }] }));
  const catalog = read();
  assert.equal(catalog[0].name, 'Тестовый');
  assert.deepEqual(catalog[0].legend, ['Он родился во льдах.', 'Он хранит стаю.']);
  assert.equal(catalog[0].art[1], null);
  assert.equal(catalog[0].art[2], 'img/test-3.webp');
});

test('missing status, missing files and remote/traversal/symlink paths are unusable', (t) => {
  const root = artFixture(t);
  for (const path of ['../outside.webp', 'https://example.com/file.webp', 'img/nope.webp', 'img/../test-1.webp']) {
    assert.equal(localArtPath(root, path), null);
  }
  const outside = join(root, 'outside.webp');
  writeFileSync(outside, 'outside');
  const elsewhere = mkdtempSync(join(tmpdir(), 'dv-outside-'));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));
  writeFileSync(join(elsewhere, 'image.webp'), 'escaped');
  symlinkSync(join(elsewhere, 'image.webp'), join(root, 'img/escape.webp'));
  assert.equal(localArtPath(root, 'img/escape.webp'), null);
  writeFileSync(join(root, 'catalog.json'), JSON.stringify({ dragons: [{ id: 'test', stages: {
    hatchling: { art: { status: 'missing', path: 'img/test-1.webp' } },
  } }] }));
  assert.throws(() => loadCatalog(root), /no usable hatchling/);
});

test('a newly supplied evolution image updates an existing dragon without rerolling', (t) => {
  const root = artFixture(t);
  const catalog = loadCatalog(root);
  const dragon = hatchDragon('100', catalog);
  assert.equal(resolveDragonArt(root, dragon, 2, catalog).provisional, true);
  writeFileSync(join(root, 'img/test-2.webp'), 'genuine adult');
  const updated = loadCatalog(root);
  assert.equal(resolveDragonArt(root, dragon, 2, updated).actualStage, 2);
  assert.equal(dragon.art[1], null);
});

test('config requires an env token, owner ID, absolute volume path and HTTPS Mini App URL', () => {
  const env = { BOT_TOKEN: '123:fake-token', OWNER_TELEGRAM_ID: '100', DATA_DIR: '/tmp/incubator' };
  assert.equal(readConfig(env).ownerId, '100');
  for (const change of [{ BOT_TOKEN: '' }, { OWNER_TELEGRAM_ID: '' }, { DATA_DIR: 'data' }, { GAME_URL: 'http://example.com/' }]) {
    assert.throws(() => readConfig({ ...env, ...change }));
  }
});
