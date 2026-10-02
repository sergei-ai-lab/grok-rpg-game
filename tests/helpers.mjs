import { setSSRHandler } from '@vueuse/core'
import { nextTick } from 'vue'

let instance = 0
// Toast timers do not need to keep Node alive after the assertions finish.
const nativeTimeout = globalThis.setTimeout
globalThis.setTimeout = (...args) => {
  const timer = nativeTimeout(...args)
  timer.unref()
  return timer
}

export async function fresh({ save, runSave, lang = 'en-US', create = true, heroId = 'vorathion' } = {}) {
  const values = new Map([['dragonverse-lang', lang]])
  if (save !== undefined)
    values.set('dragonverse-profile', typeof save === 'string' ? save : JSON.stringify(save))
  if (runSave !== undefined)
    values.set('dragonverse-run', typeof runSave === 'string' ? runSave : JSON.stringify(runSave))
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
  // VueUse's documented SSR storage adapter exercises its real serializer and
  // deep watch. No replacement of useStorage or the game store is involved.
  setSSRHandler('getDefaultStorage', () => storage)
  const game = await import(`${process.env.STAGE0_SUBJECT_URL}?instance=${++instance}`)
  const state = game.useGlobalState()
  if (create && save === undefined)
    withRandom(0.5, () => state.createSave(heroId))
  await nextTick()
  return { game, state, storage, flush: nextTick }
}

export function withRandom(value, fn) {
  const previous = Math.random
  Math.random = typeof value === 'function' ? value : () => value
  try { return fn() }
  finally { Math.random = previous }
}

export function unit(side, patch = {}) {
  return {
    id: side, name: side, sprite: '', side, level: 1,
    hp: 100, maxHp: 100, atk: 10, def: 0, spd: side === 'hero' ? 20 : 10,
    crit: 0, critMul: 1.6, lifesteal: 0, doubleHit: 0, regen: 0,
    boss: false, alive: true, skillCd: 0, ...patch,
  }
}

export function forceVictory(state) {
  for (const enemy of state.run.units.filter(u => u.side === 'enemy')) {
    enemy.hp = 0
    enemy.alive = false
  }
  state.battleTick()
}

export function gear(uid = 'gear', patch = {}) {
  return { uid, kind: 'equip', defId: 'w1', rarity: 'common', enhance: 0, itemLevel: 1, count: 1, ...patch }
}
