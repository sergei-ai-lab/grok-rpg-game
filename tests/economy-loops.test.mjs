import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, forceVictory, withRandom } from './helpers.mjs'

test('AUDIT ECONOMY: restart floor 1 can repeatedly farm gold, XP and lead copies without stamina', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  for (let i = 0; i < 30; i++) {
    state.startRun()
    withRandom(0.99, () => forceVictory(state))
    const bond = p.bonds.vorathion
    while (bond.rank < 10 && bond.copies > 0 && state.raiseBond('vorathion')) {}
  }
  assert.deepEqual([p.gold, p.bonds.vorathion.rank, p.bonds.vorathion.copies, p.stamina], [680, 10, 0, 1000])
  assert.equal(p.bestFloor, 1)
  assert.ok(p.level > 1)
})

test('AUDIT ECONOMY: paid daily refresh allows repeat Hunt rewards with positive net gold', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  for (let cycle = 0; cycle < 3; cycle++) {
    if (cycle > 0) state.refreshDaily()
    for (let i = 0; i < 5; i++) {
      state.startRun()
      withRandom(0.99, () => forceVictory(state))
    }
    state.claimQuest('daily_battle')
  }
  assert.equal(p.gold, 600) // 200 initial + 240 combat + 360 quests - 200 refresh.
  assert.equal(p.bonds.vorathion.copies, 15)
  assert.equal(p.stamina, 1000)
})

test('AUDIT ECONOMY: retained +99 slots make buy/equip/sell/refresh a repeatable profitable cycle', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  // Late-game fixture, not a claim that +99 is accessible in the first hour.
  p.gold = 10000
  p.slotEnhance = { weapon: 99, armor: 99, accessory: 99 }
  const stone = p.stone
  const soul = p.soul
  for (let cycle = 0; cycle < 3; cycle++) {
    const before = p.gold
    withRandom(0.5, () => state.refreshShop())
    for (let i = 0; i < 4; i++) {
      const uid = p.shop.stock[i].equip.uid
      state.buyShop(i)
      state.equipItem(uid)
      state.sellItem(uid)
    }
    assert.equal(p.gold - before, 1136)
  }
  assert.deepEqual([p.gold, p.stone, p.soul], [13408, stone, soul])
})
