import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, forceVictory, withRandom } from './helpers.mjs'

test('duplicate progression spends exactly 1,2,2,3,3,4,4,5,6 copies through rank 10', async () => {
  const { game, state } = await fresh()
  assert.equal(game.BOND_MAX, 10)
  const costs = [1, 2, 2, 3, 3, 4, 4, 5, 6]
  const bond = state.profile.value.bonds.vorathion
  for (const [i, cost] of costs.entries()) {
    assert.equal(bond.rank, i + 1)
    assert.equal(game.copiesToNext(bond.rank), cost)
    bond.copies = cost - 1
    assert.equal(state.raiseBond('vorathion'), false)
    assert.equal(bond.rank, i + 1)
    assert.equal(bond.copies, cost - 1)
    bond.copies = cost
    assert.equal(state.raiseBond('vorathion'), true)
    assert.equal(bond.rank, i + 2)
    assert.equal(bond.copies, 0)
  }
  bond.copies = 9
  assert.equal(state.raiseBond('vorathion'), false)
  assert.deepEqual({ ...bond }, { rank: 10, copies: 9 })
  assert.equal(game.copiesToNext(0), 0)
  assert.equal(game.copiesToNext(10), 0)
  assert.equal(state.raiseBond('kaelith'), false)
})

test('summon unlocks a new species without spending its first copy on rank', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  assert.equal(withRandom(0, () => state.summonDragon()), true)
  assert.equal(p.gold, 160)
  assert.deepEqual({ ...p.bonds.kaelith }, { rank: 1, copies: 0 })
  assert.equal(p.pets.filter(pet => pet.species === 'kaelith').length, 1)
  assert.equal(state.setLead('kaelith'), true)
  assert.equal(state.setLead('nyxarion'), false)
})

test('duplicate summon adds a spare copy and does not create a duplicate pet', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  for (const dragon of game.CANON_DRAGONS) p.bonds[dragon.id].rank = 1
  const count = p.pets.length
  withRandom(0, () => state.summonDragon())
  assert.equal(p.bonds.vorathion.copies, 1)
  assert.equal(p.bonds.vorathion.rank, 1)
  assert.equal(p.pets.length, count)
  p.gold = 39
  const before = JSON.stringify(p)
  assert.equal(state.summonDragon(), false)
  assert.equal(JSON.stringify(p), before)
})

test('XP levels persist through restart, use expNeed and stop at 999', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  state.gainExp(79)
  assert.deepEqual([p.level, p.exp], [1, 79])
  state.gainExp(1)
  assert.deepEqual([p.level, p.exp], [2, 0])
  state.gainExp(110)
  assert.deepEqual([p.level, p.exp], [3, 0])
  state.startRun()
  assert.equal(p.level, 3)
  p.level = 998
  state.gainExp(50 + 998 * 30 + 500)
  assert.deepEqual([p.level, p.exp], [999, 0])
  state.gainExp(1e9)
  assert.deepEqual([p.level, p.exp], [999, 0])
})

test('training charges the current level cost and stops at 10', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  const pet = p.pets[0]
  p.gold = 10000
  const base = game.petCombatStats(pet, game.boonsToBonus([]))
  state.trainPet(pet.uid)
  assert.deepEqual([pet.train, p.gold], [1, 9940])
  assert.ok(game.petCombatStats(pet, game.boonsToBonus([])).hp > base.hp)
  pet.train = 10
  state.trainPet(pet.uid)
  assert.deepEqual([pet.train, p.gold], [10, 9940])
})

test('deployed pets earn tower XP; undeployed pets do not; five-member cap holds', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  for (let i = 0; i < 5; i++) state.addPet(game.genPet(1, 'rare', 'kaelith'))
  for (const pet of p.pets) state.deployPet(pet.uid)
  assert.equal(p.pets.filter(pet => pet.deployed).length, 5)
  withRandom(0.99, () => forceVictory(state))
  assert.equal(p.pets[0].xp, 10)
  assert.equal(p.pets[5].xp, 0)
  p.pets[0].xp = 69
  state.nextTowerFloor()
  withRandom(0.99, () => forceVictory(state))
  assert.deepEqual([p.pets[0].level, p.pets[0].xp], [2, 11])
  state.withdrawPet(p.pets[0].uid)
  assert.equal(p.pets[0].deployed, false)
})

test('bond rank modifies lead HP/ATK/DEF; lead switching retains profile XP level', async () => {
  const { game, state } = await fresh()
  const p = state.profile.value
  const before = game.createHeroUnits(p)[0]
  p.bonds.vorathion.rank = 10
  const after = game.createHeroUnits(p)[0]
  assert.deepEqual([after.hp, after.atk, after.def, after.spd], [226, 47, 11, before.spd])
  withRandom(0, () => state.summonDragon())
  p.level = 30
  state.setLead('kaelith')
  assert.equal(game.createHeroUnits(p)[0].level, 30)
})
