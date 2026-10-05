import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import '../public/flock/catalog-runtime.js'

const catalog = JSON.parse(readFileSync(new URL('../public/flock/catalog.json', import.meta.url)))
const { buildRoster, artFor, reconcileSave } = globalThis.FlockCatalog

test('FLOCK catalog has eight families, four unique dragons per family and three stages', () => {
  assert.equal(catalog.dragons.length, 32)
  assert.equal(new Set(catalog.dragons.map(d => d.id)).size, 32)
  assert.deepEqual(catalog.families.map(f => f.id).sort(), ['cosmic', 'crystal', 'fire', 'gold', 'ice', 'nature', 'shadow', 'storm'])
  for (const family of catalog.families) assert.equal(catalog.dragons.filter(d => d.family === family.id).length, 4)
  for (const d of catalog.dragons) {
    assert.equal(d.abilities.length, 2)
    assert.equal(d.legend.split('.').filter(s => s.trim()).length, 2)
    assert.deepEqual(Object.keys(d.stages), ['hatchling', 'adult', 'titan'])
    for (const [stage, row] of Object.entries(d.stages)) {
      assert.ok(row.prompt.includes('2:3') && row.prompt.includes('No text'), `${d.id}/${stage}: prompt constraints`)
      assert.ok(['missing', 'ready'].includes(row.art.status))
      if (row.art.status === 'missing') assert.equal(row.art.path, null)
    }
  }
})

test('every ready portrait is a real unique WebP within the 200 KB budget', () => {
  const hashes = new Set()
  for (const d of catalog.dragons) for (const [stage, row] of Object.entries(d.stages)) {
    if (row.art.status !== 'ready') continue
    const bytes = readFileSync(new URL(`../public/flock/${row.art.path}`, import.meta.url))
    assert.ok(bytes.length <= 200000, `${d.id}/${stage}: budget`)
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP')
    const digest = createHash('sha256').update(bytes).digest('hex')
    assert.ok(!hashes.has(digest), `${d.id}/${stage}: duplicate stage/dragon art`)
    hashes.add(digest)
    if (row.art.sha256) assert.equal(row.art.sha256, digest)
  }
})

test('a missing adult is excluded from roster, reward mapping and art lookup without using a ghost', () => {
  const changed = structuredClone(catalog)
  const kaelith = changed.dragons.find(d => d.id === 'kaelith')
  kaelith.stages.adult.art = { status: 'missing', path: null }
  const roster = buildRoster(changed)
  assert.ok(!roster.species.some(d => d.id === 'kaelith'))
  assert.ok(!Object.values(roster.unlockAt).includes('kaelith'))
  assert.throws(() => artFor(roster.by, 'kaelith', 1), /artwork/)
})

test('stage lookup uses the catalog at level 1, 5 and 10', () => {
  const { by } = buildRoster(catalog)
  for (const d of Object.values(by)) for (const [i, level] of [1, 5, 10].entries()) {
    assert.equal(artFor(by, d.id, level).src, d.artPaths[i])
    assert.equal(artFor(by, d.id, level).provisional, false)
  }
})

test('temporarily hidden partner ownership and custom name return when its art is ready', () => {
  const ready = buildRoster(catalog)
  const changed = structuredClone(catalog)
  changed.dragons.find(d => d.id === 'kaelith').stages.adult.art = { status: 'missing', path: null }
  const hidden = buildRoster(changed)
  const owned = { kaelith: { level: 9, xp: 77, rune: 'ward', copies: 6 }, verdraxis: { level: 5, xp: 10, rune: 'ward', copies: 2 } }
  const state = { partnerId: 'kaelith', partnerName: 'Серый', wins: 7, squad: ['kaelith', 'verdraxis'], owned: structuredClone(owned) }
  reconcileSave(state, hidden)
  assert.equal(state.partnerId, 'verdraxis')
  assert.deepEqual(state.owned, owned)
  assert.equal(state.wins, 7)
  reconcileSave(state, ready)
  assert.equal(state.partnerId, 'kaelith')
  assert.equal(state.partnerName, 'Серый')
  assert.deepEqual(state.owned, owned)
})

test('wrong ready file name cannot expose another dragon as a replacement', () => {
  const changed = structuredClone(catalog)
  changed.dragons.find(d => d.id === 'kaelith').stages.hatchling.art.path = 'img/verdraxis-1.webp'
  assert.ok(!buildRoster(changed).by.kaelith)
})
