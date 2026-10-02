import { fresh } from './helpers.mjs'
import { markRaw, toRaw } from 'vue'

// An audit experiment using the real store + engine. Timing approximates the
// existing BattleView loop; it is not a forecast of human retention or economy.
const { game, state } = await fresh()
const horizons = [600000, 1800000, 3600000]
const seeds = Array.from({ length: 20 }, (_, i) => i + 1)
const originalRandom = Math.random
const originalNow = Date.now
const epoch = Date.UTC(2026, 9, 2, 8)
let elapsed = 0
const runtimeErrors = []

function snapshot(counters) {
  const p = state.profile.value
  return {
    ...counters,
    floor: state.run.floor,
    bestFloor: p.bestFloor,
    level: p.level,
    exp: p.exp,
    gold: p.gold,
    stone: p.stone,
    soul: p.soul,
    bond: p.bonds[p.heroId].rank,
    spareCopies: Object.values(p.bonds).reduce((n, b) => n + b.copies, 0),
    owned: Object.values(p.bonds).filter(b => b.rank > 0).length,
    boons: p.boons.length,
    bag: p.bag.length,
    stamina: p.stamina,
  }
}

function caretaker() {
  const p = state.profile.value
  // Fixed audit policy: summon until the six are owned; raise any affordable
  // duplicate ranks; deploy up to five pets; equip best power per slot; salvage
  // leftovers; enhance equipped slots to +5; claim earned quests. No upgrades,
  // training, shop, realm sweeps or daily refresh arbitrage in this scenario.
  while (p.gold >= state.SUMMON_COST && Object.values(p.bonds).some(b => b.rank === 0)) state.summonDragon()
  for (const d of game.CANON_DRAGONS) {
    const b = p.bonds[d.id]
    while (b.rank > 0 && b.rank < 10 && b.copies >= game.copiesToNext(b.rank)) state.raiseBond(d.id)
  }
  for (const pet of p.pets) {
    if (p.pets.filter(x => x.deployed).length >= 5) break
    if (!pet.deployed) state.deployPet(pet.uid)
  }
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const candidates = p.bag.filter(it => it.kind === 'equip' && game.getEquipDef(it.defId).slot === slot)
    candidates.sort((a, b) => game.powerOf(game.equipStats(b)) - game.powerOf(game.equipStats(a)))
    const best = candidates[0]
    const current = p.equipped[slot]
    if (best) {
      const preview = { ...best, enhance: p.slotEnhance[slot] }
      if (!current || game.powerOf(game.equipStats(preview)) > game.powerOf(game.equipStats(current))) state.equipItem(best.uid)
    }
  }
  for (const it of [...p.bag]) if (it.kind === 'equip') state.recycleItem(it.uid)
  for (const slot of ['weapon', 'armor', 'accessory']) {
    while (p.equipped[slot] && p.slotEnhance[slot] < 5) {
      const item = p.equipped[slot]
      const cost = game.enhanceCost(game.RARITY_ORDER.indexOf(item.rarity), p.slotEnhance[slot])
      if (p.gold < cost.gold || p.stone < cost.stone) break
      state.enhanceItem(slot)
    }
  }
  for (const q of game.QUESTS) if (state.questProgress(q.id).claimable) state.claimQuest(q.id)
}

function trajectory(heroId, seed, policy, speed) {
  elapsed = 0
  Math.random = game.mulberry(seed)
  Date.now = () => epoch + elapsed
  state.createSave(heroId)
  // No DOM is present in this audit. Preserve the exact game data/actions while
  // avoiding UI proxy tracking on every hit in millions of simulated rounds.
  state.profile.value = markRaw(JSON.parse(JSON.stringify(state.profile.value)))
  state.toasts.value = markRaw([])
  const counters = { wins: 0, deaths: 0, totalGoldEarned: 0, totalLeadCopies: 0, totalExtraGrants: 0, crashed: 0, crashAtFloor: 0 }
  if (policy === 'caretaker') {
    caretaker()
    state.continueRun() // Apply prep to the units at the start of floor 1.
  }
  const result = []
  let target = 0
  while (elapsed < horizons[2]) {
    if (counters.crashed) {
      elapsed = horizons[target]
    }
    else {
    try {
    const previous = state.run.status
    if (previous === 'fighting') {
      state.run.units = markRaw(toRaw(state.run.units))
      state.run.logs = markRaw(toRaw(state.run.logs))
      state.run.floats = markRaw(toRaw(state.run.floats))
      elapsed += Math.max(60, Math.round(520 / speed))
      const lead = state.run.units.find(u => u.side === 'hero')
      if (lead && (!lead.skillCd || lead.skillCd <= 0)) state.castSkill()
      state.battleTick()
      if (state.run.status === 'runOver') counters.deaths++
      if (['waveClear', 'boon'].includes(state.run.status)) {
        counters.wins++
        counters.totalGoldEarned += state.run.lastReward.gold
        counters.totalLeadCopies++
        if (state.run.lastReward.extraCopy) counters.totalExtraGrants++
      }
    }
    else if (previous === 'runOver') {
      if (policy === 'passive') elapsed = horizons[target]
      else { elapsed += 2000; caretaker(); state.startRun() }
    }
    else if (previous === 'boon') {
      elapsed += 5000
      if (policy === 'caretaker') caretaker()
      const preference = ['atk', 'hp', 'pet', 'ls', 'double', 'crit', 'def', 'regen', 'spd', 'gold', 'drop']
      const offer = state.run.boonOffer
      const boon = policy === 'caretaker'
        ? preference.find(id => offer.includes(id))
        : offer[Math.floor(Math.random() * offer.length)]
      state.chooseBoon(boon)
    }
    else if (previous === 'waveClear') {
      elapsed += policy === 'caretaker' ? 2000 : 12000
      if (policy === 'caretaker') caretaker()
      state.nextTowerFloor()
    }
    else throw new Error(`Unexpected simulation status: ${previous}`)
    }
    catch (error) {
      counters.crashed = 1
      counters.crashAtFloor = state.run.floor
      runtimeErrors.push({ policy, speed, hero: heroId, seed, floor: state.run.floor, elapsedMs: elapsed, error: error.message })
    }
    }
    while (target < horizons.length && elapsed >= horizons[target]) {
      result.push({ minutes: horizons[target] / 60000, ...snapshot(counters) })
      target++
    }
  }
  return result
}

function percentile(values, pct) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * pct)]
}
const simulations = []
try {
  for (const [policy, speed] of [['passive', 1], ['caretaker', 1], ['caretaker', 15]]) {
    for (const hero of game.HEROES) {
      console.error(`Simulating ${policy} ${speed}x ${hero.id}, seeds 1..20`)
      const runs = seeds.map(seed => trajectory(hero.id, seed, policy, speed))
      for (const [i, minutes] of [10, 30, 60].entries()) {
        const stats = {}
        for (const field of Object.keys(runs[0][i]).filter(k => k !== 'minutes')) {
          const values = runs.map(r => r[i][field])
          stats[field] = { min: Math.min(...values), median: percentile(values, 0.5), max: Math.max(...values) }
        }
        simulations.push({ policy, speed, hero: hero.id, minutes, seeds: seeds.length, stats })
      }
    }
  }
  // Exact conditional settlement ledger for clearing floors 1..20. It does not
  // assume a fresh player can defeat those floors in a single run.
  let gold = 0, xp = 0, copies = 0, extra = 0, bosses = 0
  const first20 = []
  for (let floor = 1; floor <= 20; floor++) {
    const boss = floor % 5 === 0
    const g = Math.round((12 + floor * 4) * (boss ? 3 : 1))
    const e = Math.round((12 + floor * 4) * (boss ? 2.5 : 1))
    gold += g; xp += e; copies++; extra += Number(floor % 3 === 0); bosses += Number(boss)
    first20.push({ floor, gold: g, xp: e, cumulativeGold: gold, cumulativeXP: xp, leadCopies: copies, extraGrants: extra, bosses })
  }
  console.log(JSON.stringify({
    baseline: '2931ea69bfbf653c105f145520d41747c85f4f07',
    seedRange: [1, 20],
    assumptions: {
      engine: 'real store and battle engine; current auto-skill order',
      timing: '520ms round / speed, min 60ms; passive next 12s; caretaker next/restart 2s; boon 5s',
      passive: 'no summons, equipment, pets, quests, bond upgrades or restarts after death',
      caretaker: 'summon to six; raise affordable bonds; five pets; best gear by power; salvage leftovers; enhance to +5; claim quests; restart after death',
      exclusions: 'no training, shop, upgrades, dungeons, sweeps, daily refresh, latency or time spent navigating menus',
      clocks: 'deterministic simulated elapsed time; no waiting; saves are reset between runs',
    },
    simulations,
    runtimeErrors,
    first20,
  }, null, 2))
}
finally {
  Math.random = originalRandom
  Date.now = originalNow
}
