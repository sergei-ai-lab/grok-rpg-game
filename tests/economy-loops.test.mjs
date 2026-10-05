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

test('Stage 1: paid daily refresh is disabled and cannot repeat claimed rewards', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  for (let i = 0; i < 5; i++) {
    state.startRun()
    withRandom(0.99, () => forceVictory(state))
  }
  state.claimQuest('daily_battle')
  const afterClaim = p.gold
  assert.equal(state.refreshDaily(), false)
  assert.equal(p.gold, afterClaim)
  assert.equal(state.questProgress('daily_battle').claimed, true)
  state.claimQuest('daily_battle')
  assert.equal(p.gold, afterClaim)
})

test('Stage 1: retained slot enhancement cannot create resale profit', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.gold = 10000
  p.slotEnhance = { weapon: 99, armor: 99, accessory: 99 }
  const stone = p.stone
  const soul = p.soul
  const before = p.gold
  withRandom(0.5, () => state.refreshShop())
  for (let i = 0; i < 4; i++) {
    const uid = p.shop.stock[i].equip.uid
    state.buyShop(i)
    state.equipItem(uid)
    state.sellItem(uid)
  }
  assert.ok(p.gold < before)
  assert.deepEqual([p.stone, p.soul], [stone, soul])
})
