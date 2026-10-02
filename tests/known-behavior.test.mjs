import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, withRandom, forceVictory } from './helpers.mjs'

test('Stage 1: legacy Tower ends safely on floor 40', async () => {
  const { game, state } = await fresh()
  withRandom(0.5, () => {
    const floor40 = game.genTowerWave(40)
    assert.equal(floor40.length, 1)
    assert.equal(floor40[0].boss, true)
    assert.deepEqual(game.genTowerWave(41), [])
    assert.deepEqual(game.genTowerWave(45), [])
  })
  state.run.floor = 40
  state.run.status = 'waveClear'
  assert.equal(state.nextTowerFloor(), false)
  assert.equal(state.run.floor, 40)
  assert.equal(state.run.status, 'towerClear')
})

test('Stage 1: ineffective pet rarity upgrade cannot spend resources', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  const pet = p.pets[0]
  p.gold = 10000
  p.soul = 1000
  const beforeStats = game.petCombatStats(pet, game.boonsToBonus([]))
  const before = [p.gold, p.soul, pet.rarity]
  assert.equal(state.upgradePetRarity(pet.uid), false)
  assert.deepEqual([p.gold, p.soul, pet.rarity], before)
  assert.deepEqual(game.petCombatStats(pet, game.boonsToBonus([])), beforeStats)
})

test('Stage 1: misleading market dragon offer cannot spend or mark sold', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  p.gold = 100000
  p.shop.stock = [{ kind: 'pet', level: 20, rarity: 'red' }]
  p.shop.sold = [false]
  state.buyShop(0)
  assert.equal(p.gold, 100000)
  assert.equal(p.shop.sold[0], false)
  assert.equal(p.pets.length, 1)
  assert.equal(p.achievements.progress.shopBuy ?? 0, 0)
})

test('Stage 1: damaging active skills respect shield and Thunder Feast heals 50% of actual damage', async () => {
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
  assert.deepEqual([enemy.hp, enemy.shield, hero.hp], [1000, 950, 26])
})

test('AUDIT LIMIT: copies still accumulate at rank 10 until Stage 3 conversion', async () => {
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

test('Stage 1: realm reward receipt reports the full stone payout', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  p.level = 2
  p.stamina = 1000
  const beforeStone = p.stone
  state.enterDungeon('forest')
  for (let i = 0; i < game.DUNGEONS[0].waves; i++) {
    withRandom(0.5, () => forceVictory(state))
    if (i < game.DUNGEONS[0].waves - 1)
      state.nextDungeonWave()
  }
  assert.equal(p.stone - beforeStone, 3)
  assert.equal(state.run.lastReward.stone, 3)
})

test('Stage 1: dungeon egg unlocks its species bond immediately', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  p.level = 14
  p.stamina = 1000
  state.enterDungeon('hell')
  for (let i = 0; i < game.DUNGEONS[2].waves; i++) {
    withRandom(0.2, () => forceVictory(state))
    if (i < game.DUNGEONS[2].waves - 1)
      state.nextDungeonWave()
  }
  const added = p.pets.find(pet => pet.uid !== p.pets[0].uid)
  assert.ok(added?.species)
  assert.equal(p.bonds[added.species].rank, 1)
})
