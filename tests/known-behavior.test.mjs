import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, withRandom, forceVictory } from './helpers.mjs'

// Characterization of confirmed baseline inconsistencies, NOT desired design.
// Update these assertions only after the corresponding Stage 1 change is approved.
test('AUDIT BLOCKER: tower floors 41..44 have no foes and floor 45 crashes on empty sprite pool', async () => {
  const { game } = await fresh()
  assert.equal(Math.max(...game.SPRITES.map(s => s.tier)), 5)
  for (const floor of [41, 42, 43, 44]) assert.equal(game.genTowerWave(floor).length, 0)
  assert.throws(() => game.genTowerWave(45), TypeError)
})

test('AUDIT BUG: pet rarity upgrade changes its label and price but not combat stats', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  const pet = p.pets[0]
  p.gold = 10000
  p.soul = 1000
  const before = game.petCombatStats(pet, game.boonsToBonus([]))
  assert.equal(state.upgradePetRarity(pet.uid), true)
  assert.equal(pet.rarity, 'epic')
  assert.deepEqual(game.petCombatStats(pet, game.boonsToBonus([])), before)
})

test('AUDIT BUG: shop rarity/level summon collapses to rare level-1 pet or one bond copy', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.gold = 100000
  p.shop.stock = [{ kind: 'pet', level: 20, rarity: 'red' }]
  p.shop.sold = [false]
  withRandom(0.2, () => state.buyShop(0))
  const pet = p.pets.find(pet => pet.species === 'kaelith')
  assert.equal(pet.rarity, 'rare')
  assert.equal(pet.level, 1)
  assert.deepEqual({ ...p.bonds.kaelith }, { rank: 1, copies: 0 })
  assert.equal(p.achievements.progress.shopBuy ?? 0, 0)
})

test('AUDIT BUG: damaging active skills bypass enemy shield; lifesteal heals 125%, not 50%', async () => {
  const { game, state } = await fresh({ heroId: 'verdraxis' })
  const hero = state.run.units.find(u => u.side === 'hero')
  const enemy = state.run.units.find(u => u.side === 'enemy')
  hero.atk = 20
  hero.maxHp = 1000
  hero.hp = 1
  enemy.hp = enemy.maxHp = 1000
  enemy.shield = 1000
  enemy.def = 0
  game.castHeroSkill([hero, enemy], 'verdraxis', { logs: [], floats: [] })
  assert.deepEqual([enemy.hp, enemy.shield, hero.hp], [950, 1000, 64])
})

test('AUDIT LIMIT: copies continue to accumulate at rank 10 with no conversion', async () => {
  const { state } = await fresh()
  const bond = state.profile.value.bonds.vorathion
  bond.rank = 10
  withRandom(0.99, () => forceVictory(state))
  assert.equal(bond.copies, 1)
  assert.equal(state.raiseBond('vorathion'), false)
  assert.equal(bond.copies, 1)
})

test('AUDIT LIMIT: XP level achievements target profile level rather than bond rank', async () => {
  const { state } = await fresh()
  state.profile.value.bonds.vorathion.rank = 10
  assert.equal(state.questProgress('ach_level30').current, 0)
  state.gainExp(20000)
  assert.ok(state.profile.value.level >= 30)
  assert.equal(state.questProgress('ach_level30').claimable, true)
})

test('AUDIT BUG: multiple stone entries are paid in full but reward popup reports the first only', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.dungeonCount.forest = 1
  state.sweepDungeon('forest')
  assert.equal(p.stone, 8)
  assert.equal(state.run.lastReward.stone, 2)
})

test('AUDIT BUG: dungeon egg bypasses bonds until the profile is loaded again', async () => {
  const { state, storage, flush } = await fresh()
  const p = state.profile.value
  p.dungeonCount.hell = 1
  withRandom(0.2, () => state.sweepDungeon('hell'))
  assert.ok(p.pets.some(pet => pet.species === 'kaelith'))
  assert.equal(p.bonds.kaelith.rank, 0)
  await flush()
  const loaded = await fresh({ save: storage.getItem('dragonverse-profile'), create: false })
  assert.equal(loaded.state.profile.value.bonds.kaelith.rank, 1)
})
