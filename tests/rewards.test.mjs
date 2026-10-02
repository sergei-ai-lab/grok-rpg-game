import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, forceVictory, withRandom } from './helpers.mjs'

test('tower victory awards gold/XP/lead copy and every third floor an extra species', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  withRandom(0.99, () => forceVictory(state))
  assert.deepEqual([p.gold, p.exp, p.bonds.vorathion.copies], [216, 16, 1])
  assert.equal(state.run.lastReward.copyOf, 'vorathion')
  state.nextTowerFloor()
  state.nextTowerFloor()
  withRandom(0.99, () => forceVictory(state))
  assert.deepEqual([p.gold, p.exp, p.bonds.vorathion.copies], [240, 40, 2])
  assert.equal(state.run.lastReward.extraCopy, 'umbraxis')
  assert.equal(p.bonds.umbraxis.rank, 1)
  assert.equal(p.pets.length, 2)
})

test('first boss pays triple gold, 2.5x XP, guaranteed gear and one boon offer', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  state.run.floor = 5
  state.continueRun() // Restore from save rather than trust a transient floor.
  p.runFloor = 5
  state.continueRun()
  withRandom(0.5, () => forceVictory(state))
  assert.equal(p.gold, 296)
  assert.equal(p.level, 2)
  assert.equal(p.exp, 0)
  assert.equal(p.bag.length, 1)
  assert.equal(p.bag[0].kind, 'equip')
  assert.equal(state.run.status, 'boon')
  assert.equal(new Set(state.run.boonOffer).size, 3)
  const boon = state.run.boonOffer[0]
  state.chooseBoon(boon)
  assert.equal(p.boons[0], boon)
  assert.deepEqual([p.lastBoonFloor, state.run.floor], [5, 6])
  state.startRun()
  assert.equal(p.boons[0], boon)
  p.runFloor = 5
  state.continueRun()
  withRandom(0.99, () => forceVictory(state))
  assert.equal(state.run.status, 'waveClear')
  assert.equal(p.boons.length, 1)
})

test('ordinary drop branches distinguish gear, direct stone currency and no drop', async () => {
  for (const [random, expected] of [[0, 'equip'], [0.3, 'stone'], [0.9, 'none']]) {
    const { state } = await fresh()
    const p = state.profile.value
    withRandom(random, () => forceVictory(state))
    assert.equal(p.bag.length, expected === 'equip' ? 1 : 0)
    assert.equal(p.stone > 5, expected === 'stone')
  }
})

test('realm gates level/stamina, final victory pays all stones, sweep requires prior clear', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  state.enterDungeon('forest')
  assert.equal(state.run.mode, 'tower')
  p.level = 2
  p.stamina = 0
  p.staminaAt = Date.now()
  state.enterDungeon('forest')
  assert.equal(state.run.mode, 'tower')
  p.stamina = 1000
  state.sweepDungeon('forest')
  assert.equal(p.stamina, 1000)
  state.enterDungeon('forest')
  assert.equal(p.stamina, 990)
  const before = { gold: p.gold, exp: p.exp, stone: p.stone }
  for (let i = 0; i < game.DUNGEONS[0].waves; i++) {
    withRandom(0.5, () => forceVictory(state))
    if (i < game.DUNGEONS[0].waves - 1) state.nextDungeonWave()
  }
  assert.equal(state.run.status, 'dungeonClear')
  assert.deepEqual([p.gold - before.gold, p.exp - before.exp, p.stone - before.stone], [120, 90, 3])
  assert.equal(p.dungeonCount.forest, 1)
  assert.equal(p.bonds.vorathion.copies, 0)
  state.sweepDungeon('forest')
  assert.equal(p.stamina, 970)
  assert.equal(p.dungeonCount.forest, 2)
  assert.equal(p.gold, before.gold + 240)
})

test('quest rewards are single-claim until paid daily refresh; achievements remain claimed', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  state.track('battle', 5)
  assert.equal(state.questProgress('daily_battle').claimable, true)
  state.claimQuest('daily_battle')
  assert.deepEqual([p.gold, p.exp, p.stone], [320, 60, 7])
  state.claimQuest('daily_battle')
  assert.equal(p.gold, 320)
  state.track('floor', 10, 'max')
  state.claimQuest('ach_floor10')
  assert.equal(p.soul, 5)
  assert.equal(state.refreshDaily(), true)
  assert.equal(p.gold, 720)
  assert.equal(state.questProgress('daily_battle').current, 0)
  assert.equal(state.questProgress('ach_floor10').claimed, true)
  state.track('battle', 5)
  assert.equal(state.questProgress('daily_battle').claimable, true)
})

test('stamina regenerates one point per 30 seconds, caps at 1000; purchase costs 50 for 100', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  const now = Date.now
  try {
    Date.now = () => 1000000
    p.stamina = 990
    p.staminaAt = 940000
    state.syncStamina()
    assert.deepEqual([p.stamina, p.staminaAt], [992, 1000000])
    p.staminaAt = 100000
    state.syncStamina()
    assert.equal(p.stamina, 1000)
    assert.equal(state.buyStamina(), false)
    p.stamina = 850
    assert.equal(state.buyStamina(), true)
    assert.deepEqual([p.stamina, p.gold], [950, 150])
  }
  finally { Date.now = now }
})
