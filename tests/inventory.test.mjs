import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, gear, withRandom } from './helpers.mjs'

test('equip/swap/unequip uses the correct slots and preserves slot enhancement', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.slotEnhance.weapon = 4
  p.bag = [gear('one'), gear('two', { defId: 'w2' }), gear('armor', { defId: 'a1' })]
  state.equipItem('one')
  assert.equal(p.equipped.weapon.uid, 'one')
  assert.equal(p.equipped.weapon.enhance, 4)
  state.equipItem('two')
  assert.equal(p.equipped.weapon.uid, 'two')
  assert.ok(p.bag.some(i => i.uid === 'one'))
  state.equipItem('armor')
  assert.equal(p.equipped.armor.uid, 'armor')
  state.unequipItem('weapon')
  assert.equal(p.equipped.weapon, undefined)
  assert.equal(p.slotEnhance.weapon, 4)
})

test('selling and salvaging remove items once and give exact resource rewards', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.bag = [gear('sold'), gear('salvaged', { rarity: 'epic', enhance: 5 })]
  state.sellItem('sold')
  assert.equal(p.gold, 224)
  state.sellItem('sold')
  assert.equal(p.gold, 224)
  state.recycleItem('salvaged')
  assert.deepEqual([p.stone, p.soul, p.bag.length], [9, 13, 0])
  state.recycleItem('salvaged')
  assert.equal(p.soul, 13)
})

test('enhancement charges success and failure, caps at 99 and rejects missing resources', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.bag = [gear()]
  state.equipItem('gear')
  withRandom(0, () => state.enhanceItem('weapon'))
  assert.deepEqual([p.slotEnhance.weapon, p.gold, p.stone], [1, 160, 4])
  withRandom(0.999, () => state.enhanceItem('weapon'))
  assert.deepEqual([p.slotEnhance.weapon, p.gold, p.stone], [1, 80, 3])
  p.gold = 0
  state.enhanceItem('weapon')
  assert.equal(p.slotEnhance.weapon, 1)
  p.slotEnhance.weapon = 99
  p.gold = 100000
  state.enhanceItem('weapon')
  assert.equal(p.gold, 100000)
})

test('gear rarity upgrade requires +5, spends crystals/gold, consumes five slot ranks', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.bag = [gear()]
  state.equipItem('gear')
  p.gold = 1000
  p.soul = 20
  state.upgradeItem('weapon')
  assert.equal(p.equipped.weapon.rarity, 'common')
  p.slotEnhance.weapon = 5
  p.equipped.weapon.enhance = 5
  state.upgradeItem('weapon')
  assert.deepEqual([p.equipped.weapon.rarity, p.slotEnhance.weapon, p.gold, p.soul], ['rare', 0, 700, 14])
  assert.equal(p.equipped.weapon.enhance, 0)
})

test('capacity accepts stacks at cap, auto-sells excess gear and blocks full-bag unequip', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  p.bagCap = 1
  p.bag = [{ uid: 'stone', kind: 'material', defId: 'stone', count: 1 }]
  assert.equal(game.stackIntoBag(p.bag, { uid: 'more', kind: 'material', defId: 'stone', count: 3 }, 1), true)
  assert.equal(p.bag[0].count, 4)
  assert.deepEqual(state.addItem(gear()), { added: false, autoSold: 24, autoRecycled: false })
  assert.equal(p.gold, 224)
  p.equipped.weapon = gear('equipped')
  state.unequipItem('weapon')
  assert.equal(p.equipped.weapon.uid, 'equipped')
  p.bagCap = 30
  assert.equal(state.buyBagSlot(), true)
  assert.deepEqual([p.bagCap, p.gold, state.bagSlotCost()], [35, 24, 300])
  p.bagCap = 200
  assert.equal(state.buyBagSlot(), false)
})

test('full bag prefers configured salvage over sale, otherwise replaces a matching old item', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.bagCap = 1
  p.bag = [gear('old')]
  p.autoRecycleCfg.enabled = true
  p.autoSellCfg.enabled = true
  assert.deepEqual(state.addItem(gear('new')), { added: false, autoSold: 0, autoRecycled: true })
  assert.deepEqual([p.stone, p.soul, p.gold], [6, 1, 200])
  assert.equal(state.addItem(gear('epic', { rarity: 'epic' })).added, true)
  assert.equal(p.bag[0].uid, 'epic')
  assert.deepEqual([p.stone, p.soul], [7, 2])
})

test('shop gear purchase cannot spend twice; full bag and insufficient gold do not spend', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.shop.stock = [{ kind: 'equip', level: 1, rarity: 'common', equip: gear('shop') }]
  p.shop.sold = [false]
  p.gold = 1000
  state.buyShop(0)
  const gold = p.gold
  assert.equal(p.bag[0].uid, 'shop')
  state.buyShop(0)
  assert.equal(p.gold, gold)
  p.shop.sold = [false]
  p.bagCap = 1
  state.buyShop(0)
  assert.equal(p.gold, gold)
  p.bag = []
  p.gold = 0
  state.buyShop(0)
  assert.equal(p.gold, 0)
  assert.equal(p.bag.length, 0)
})
