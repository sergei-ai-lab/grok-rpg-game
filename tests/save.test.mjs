import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, gear } from './helpers.mjs'

test('current profile round-trips as JSON and preserves RU/EN and progress', async () => {
  for (const lang of ['ru', 'en-US']) {
    const first = await fresh({ lang })
    const p = first.state.profile.value
    p.gold = 1234
    p.level = 30
    p.runFloor = 17
    p.bonds.vorathion = { rank: 7, copies: 3 }
    p.bag.push(gear('kept'))
    first.state.setLang(lang)
    await first.flush()
    const raw = first.storage.getItem('dragonverse-profile')
    assert.equal(JSON.parse(raw).gold, 1234)
    assert.notEqual(raw, '[object Object]')
    const second = await fresh({ save: raw, lang, create: false })
    assert.deepEqual(JSON.parse(JSON.stringify(second.state.profile.value)), JSON.parse(raw))
    assert.equal(second.state.lang.value, lang)
    assert.equal(second.game.i18n.global.locale.value, lang)
    assert.equal(second.storage.getItem('dragonverse-lang'), lang)
    second.state.continueRun()
    assert.equal(second.state.run.floor, 17)
    assert.equal(second.state.profile.value.level, 30)
    assert.equal(second.state.run.units.find(u => u.side === 'hero').hp, second.state.run.units.find(u => u.side === 'hero').maxHp)
  }
})

test('supported older profile adds fields, merges bag stones and retains inventory and language', async () => {
  const base = await fresh({ lang: 'ru' })
  const old = JSON.parse(JSON.stringify(base.state.profile.value))
  old.bag = [gear('old-item'), { uid: 'stones', kind: 'material', defId: 'stone', count: 7 }]
  old.gold = 777
  old.level = 12
  old.autoRecycle = true
  for (const field of ['slotEnhance', 'autoRecycleCfg', 'autoSellCfg', 'bagCap', 'bonds', 'lastBoonFloor', 'runFloor', 'runMode', 'runDungeonDefId', 'runDungeonWave']) delete old[field]
  delete old.daily.refreshCount
  delete old.pets[0].species
  const result = await fresh({ save: old, lang: 'ru', create: false })
  const p = result.state.profile.value
  assert.deepEqual([p.gold, p.level, p.stone, p.bag.length, p.bag[0].uid], [777, 12, 12, 1, 'old-item'])
  assert.deepEqual({ ...p.slotEnhance }, { weapon: 0, armor: 0, accessory: 0 })
  assert.equal(p.autoRecycleCfg.enabled, true)
  assert.equal(p.autoSellCfg.enabled, false)
  assert.equal(p.bagCap, 30)
  assert.equal(p.daily.refreshCount, 0)
  assert.equal(p.bonds.vorathion.rank, 1)
  assert.equal(Object.keys(p.bonds).length, 6)
  assert.equal(p.pets[0].species, 'vorathion')
  assert.deepEqual([p.lastBoonFloor, p.runFloor, p.runMode, p.runDungeonDefId, p.runDungeonWave], [0, 1, 'tower', '', 0])
  assert.equal(result.state.lang.value, 'ru')
  await result.flush()
  const again = await fresh({ save: result.storage.getItem('dragonverse-profile'), lang: 'ru', create: false })
  assert.equal(again.state.profile.value.stone, 12) // Idempotent: no double conversion.
})

test('invalid locale normalizes to EN; explicit language changes persist', async () => {
  const { game, state, storage, flush } = await fresh({ lang: 'zh-CN' })
  assert.equal(state.lang.value, 'en-US')
  state.toggleLang()
  await flush()
  assert.equal(storage.getItem('dragonverse-lang'), 'ru')
  assert.equal(game.i18n.global.locale.value, 'ru')
  state.toggleLang()
  await flush()
  assert.equal(storage.getItem('dragonverse-lang'), 'en-US')
})

test('explicit delete removes the one save slot; empty/corrupt JSON does not invent a profile', async () => {
  const { state, storage, flush } = await fresh()
  state.deleteSave()
  await flush()
  assert.equal(storage.getItem('dragonverse-profile'), null)
  assert.equal(state.hasSave.value, false)
  assert.equal(state.run.started, false)
  for (const save of ['', '{bad-json']) {
    const loaded = await fresh({ save, create: false })
    assert.equal(loaded.state.hasSave.value, false)
  }
})


test('Stage 1: exact battle state survives reload without free heal or cooldown reset', async () => {
  const first = await fresh()
  const hero = first.state.run.units.find(u => u.side === 'hero')
  hero.hp = Math.max(1, hero.maxHp - 37)
  hero.skillCd = 2
  first.state.run.round = 7
  await first.flush()

  const profileRaw = first.storage.getItem('dragonverse-profile')
  const runRaw = first.storage.getItem('dragonverse-run')
  assert.ok(profileRaw)
  assert.ok(runRaw)

  const second = await fresh({ save: profileRaw, runSave: runRaw, create: false })
  second.state.continueRun()
  const restored = second.state.run.units.find(u => u.side === 'hero')
  assert.deepEqual(
    [second.state.run.status, second.state.run.round, restored.hp, restored.maxHp, restored.skillCd],
    ['fighting', 7, hero.hp, hero.maxHp, 2],
  )
})

test('Stage 1: reloading a settled reward cannot pay the same encounter twice', async () => {
  const first = await fresh()
  const p = first.state.profile.value
  const { forceVictory, withRandom } = await import('./helpers.mjs')
  withRandom(0.99, () => forceVictory(first.state))
  const paid = [p.gold, p.exp, p.bonds.vorathion.copies]
  assert.equal(first.state.run.status, 'waveClear')
  await first.flush()

  const second = await fresh({
    save: first.storage.getItem('dragonverse-profile'),
    runSave: first.storage.getItem('dragonverse-run'),
    create: false,
  })
  second.state.continueRun()
  assert.equal(second.state.run.status, 'waveClear')
  second.state.battleTick()
  assert.deepEqual(
    [second.state.profile.value.gold, second.state.profile.value.exp, second.state.profile.value.bonds.vorathion.copies],
    paid,
  )
})

test('Stage 1: sparse old save receives safe defaults instead of crashing migration', async () => {
  const base = await fresh()
  const old = JSON.parse(JSON.stringify(base.state.profile.value))
  delete old.daily
  delete old.achievements
  delete old.pets
  delete old.dungeonCount
  delete old.stats
  delete old.createdAt
  delete old.shop
  old.runFloor = 99

  const loaded = await fresh({ save: old, create: false })
  const p = loaded.state.profile.value
  assert.ok(Array.isArray(p.pets))
  assert.ok(p.daily && p.achievements && p.shop)
  assert.equal(p.runFloor, 40)
  assert.ok(p.createdAt)
})

test('Stage 1: confirmation never auto-accepts destructive actions', async () => {
  const { state } = await fresh()
  const pending = state.confirm('Delete save?')
  assert.equal(state.confirmDialog.open, true)
  assert.equal(state.confirmDialog.countdown, -1)
  assert.equal(state.interactionPaused.value, true)
  assert.equal(state.hasSave.value, true)
  state.resolveConfirm(false)
  assert.equal(await pending, false)
  assert.equal(state.hasSave.value, true)
  assert.equal(state.interactionPaused.value, false)
})


test('Stage 1: reselecting the current lead cannot refresh the active encounter', async () => {
  const { state } = await fresh()
  const hero = state.run.units.find(u => u.side === 'hero')
  hero.hp = Math.max(1, hero.maxHp - 25)
  const damaged = hero.hp
  assert.equal(state.setLead(state.profile.value.heroId), true)
  state.continueRun()
  const resumed = state.run.units.find(u => u.side === 'hero')
  assert.equal(resumed.hp, damaged)
})
