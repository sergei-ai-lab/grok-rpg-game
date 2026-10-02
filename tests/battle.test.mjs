import test from 'node:test'
import assert from 'node:assert/strict'
import { fresh, unit, withRandom } from './helpers.mjs'

const events = () => ({ logs: [], floats: [] })

test('deterministic victory and defeat clamp HP; fallen lead loses even with living pets', async () => {
  const { game } = await fresh()
  const hero = unit('hero', { atk: 1000 })
  const enemy = unit('enemy')
  assert.equal(withRandom(0.5, () => game.stepRound([hero, enemy], events())), 'won')
  assert.deepEqual([enemy.hp, enemy.alive], [0, false])
  const lead = unit('hero', { hp: 1, atk: 1, spd: 1 })
  const boss = unit('enemy', { atk: 1000, boss: true })
  const pet = unit('pet', { atk: 1, spd: 0 })
  assert.equal(withRandom(0, () => game.stepRound([lead, boss, pet], events())), 'lost')
  assert.equal(pet.alive, true)
})

test('basic attack consumes shield before HP; enemy shield regeneration runs on its turn', async () => {
  const { game } = await fresh()
  const hero = unit('hero', { atk: 20 })
  const enemy = unit('enemy', { shield: 30, shieldRegen: 5, atk: 1 })
  assert.equal(withRandom(0.5, () => game.stepRound([hero, enemy], events())), 'fighting')
  assert.deepEqual([enemy.hp, enemy.shield], [100, 15])
  withRandom(0.5, () => game.stepRound([hero, enemy], events()))
  assert.deepEqual([enemy.hp, enemy.shield], [95, 5])
})

test('active burst and AoE kill foes; cooldown blocks recast and decrements per round', async () => {
  const { game } = await fresh()
  const hero = unit('hero', { atk: 10 })
  const enemy = unit('enemy', { hp: 1000, maxHp: 1000, atk: 1 })
  const ev = events()
  assert.equal(game.castHeroSkill([hero, enemy], 'vorathion', ev), true)
  assert.deepEqual([enemy.hp, hero.skillCd], [968, 3])
  assert.equal(game.castHeroSkill([hero, enemy], 'vorathion', ev), false)
  for (let i = 0; i < 3; i++) withRandom(0.5, () => game.stepRound([hero, enemy], ev))
  assert.equal(hero.skillCd, 0)
  hero.atk = 1000
  const enemies = [unit('enemy'), unit('enemy', { id: 'other' })]
  assert.equal(game.castHeroSkill([hero, ...enemies], 'kaelith', ev), true)
  assert.ok(enemies.every(e => !e.alive && e.hp === 0))
  hero.alive = false
  assert.equal(game.castHeroSkill([hero, unit('enemy')], 'vorathion', ev), false)
})

test('heal active respects healing reduction; regeneration respects reduction and expires', async () => {
  const { game } = await fresh()
  const hero = unit('hero', { hp: 10, healReduce: 0.5, healReduceTurns: 1, regen: 0.1 })
  const enemy = unit('enemy', { atk: 1 })
  game.castHeroSkill([hero, enemy], 'aurion', events())
  assert.equal(hero.hp, 33)
  withRandom(0.5, () => game.stepRound([hero, enemy], events()))
  assert.deepEqual([hero.hp, hero.healReduce, hero.healReduceTurns], [37, 0, 0])
})

test('crit, double hit and passive lifesteal use the current deterministic formulas', async () => {
  const { game } = await fresh()
  const hero = unit('hero', { hp: 20, crit: 1, doubleHit: 1, lifesteal: 0.5 })
  const enemy = unit('enemy', { hp: 100, atk: 1 })
  const ev = events()
  withRandom(0.5, () => game.stepRound([hero, enemy], ev))
  assert.equal(enemy.hp, 71) // 16 crit damage, then 13 at 80%.
  assert.equal(hero.hp, 34) // 8 + 7 healing, then 1 enemy damage.
  assert.equal(ev.logs.filter(l => l.type === 'crit').length, 2)
})

test('bosses occur every five tower floors and have shields; dungeon last wave has a boss', async () => {
  const { game } = await fresh()
  withRandom(0.5, () => {
    assert.equal(game.genTowerWave(1).length, 1)
    assert.equal(game.genTowerWave(6).length, 2)
    assert.equal(game.genTowerWave(11).length, 3)
    const boss = game.genTowerWave(5)[0]
    assert.equal(boss.boss, true)
    assert.equal(boss.level, 6)
    assert.ok(boss.shield > 0 && boss.shieldRegen > 0)
    assert.ok(game.genDungeonWave(game.DUNGEONS[0], 2).some(u => u.boss))
  })
})

test('store settles active-skill victory once and rejects actions after the battle ends', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  const hero = state.run.units.find(u => u.side === 'hero')
  hero.atk = 10000
  withRandom(0.99, () => assert.equal(state.castSkill(), true))
  assert.equal(state.run.status, 'waveClear')
  assert.equal(p.gold, 216)
  assert.equal(p.bonds.vorathion.copies, 1)
  state.battleTick()
  assert.equal(state.castSkill(), false)
  assert.equal(p.gold, 216)
})

test('tower and dungeon defeat grant no victory resources', async () => {
  const { state } = await fresh()
  const p = state.profile.value
  for (const mode of ['tower', 'dungeon']) {
    state.run.mode = mode
    state.run.status = 'fighting'
    state.run.units = [unit('hero', { hp: 0, alive: false }), unit('enemy')]
    const before = [p.gold, p.exp, p.bonds.vorathion.copies]
    state.battleTick()
    assert.equal(state.run.status, mode === 'tower' ? 'runOver' : 'dungeonLost')
    assert.deepEqual([p.gold, p.exp, p.bonds.vorathion.copies], before)
  }
})
