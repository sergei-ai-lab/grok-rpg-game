import { computed, reactive, ref, watch } from 'vue'
import { createGlobalState, useStorage } from '@vueuse/core'
import type {
  AutoHandleCfg, BagItem, BattleUnit, DungeonDef, FloatText, LogLine, Pet, Profile,
} from '@/game/types'
import { CANON_DRAGONS, copiesToNext, speciesFromName, BOND_MAX } from '@/game/data/dragons'
import { i18n, type AppLocale } from '@/locales'
import { tr, tx } from '@/locales/text'
import { spriteByName } from '@/game/assets'
import { DUNGEONS } from '@/game/data/dungeons'
import { QUESTS } from '@/game/data/quests'
import { getHero } from '@/game/data/heroes'
import { getConsumableDef, getMaterialDef } from '@/game/data/catalog'
import { RARITY_META, RARITY_ORDER, UPGRADE_GOLD_COST, UPGRADE_SOUL_COST, boonsToBonus, enhanceCost, expNeed, petExpNeed, recycleGain, sellPrice } from '@/game/engine/stats'
import {
  BAG_CAP, genPet, genShopStock, rollDrop, shopSlotPrice, stackIntoBag, todayStr,
} from '@/game/engine/loot'
import { castHeroSkill, createHeroUnits, stepRound } from '@/game/engine/battle'
import { genBoonOffer, genDungeonWave, genTowerWave, TOWER_MAX_FLOOR } from '@/game/engine/run'
import { chance, uid } from '@/game/engine/rng'

function txName(id: string, en: string) {
  return tx(`dungeon.${id}`, en)
}

export interface Toast {
  id: number
  text: string
  type: 'info' | 'success' | 'error'
}

export interface ConfirmState {
  open: boolean
  title: string
  message: string
  /** 自动确认倒计时（秒），-1 表示不自动确认 */
  countdown: number
  resolve?: (value: boolean) => void
}

export interface RewardInfo {
  gold: number
  exp: number
  drops: BagItem[]
  stone: number
  egg?: boolean
  copyOf?: string
  extraCopy?: string
}

export type RunStatus =
  | 'idle' | 'fighting' | 'waveClear' | 'boon'
  | 'runOver' | 'dungeonClear' | 'dungeonLost'

export interface RunState {
  started: boolean
  mode: 'tower' | 'dungeon'
  status: RunStatus
  floor: number
  units: BattleUnit[]
  round: number
  logs: LogLine[]
  floats: FloatText[]
  boonOffer: string[]
  dungeonDefId: string
  dungeonWave: number
  lastReward: RewardInfo | null
  goldGained: number
}

interface RunSnapshot {
  profileCreatedAt: number
  run: RunState
}

function emptyBonds() {
  const bonds: Profile['bonds'] = {}
  for (const dragon of CANON_DRAGONS)
    bonds[dragon.id] = { rank: 0, copies: 0 }
  return bonds
}

function defaultProfile(heroId: string): Profile {
  const bonds = emptyBonds()
  bonds[heroId] = { rank: 1, copies: 0 }
  const starter = genPet(1, 'rare', heroId)
  starter.species = heroId
  starter.deployed = false
  const initialShop = genShopStock(1)
  return {
    heroId,
    level: 1,
    exp: 0,
    gold: 200,
    soul: 0,
    stone: 5,
    bag: [],
    equipped: {},
    slotEnhance: { weapon: 0, armor: 0, accessory: 0 },
    pets: [starter],
    bonds,
    bestFloor: 0,
    lastBoonFloor: 0,
    boons: [],
    runFloor: 1,
    runMode: 'tower',
    runDungeonDefId: '',
    runDungeonWave: 0,
    bagCap: 30,
    shop: { stock: initialShop, sold: initialShop.map(() => false), refreshCount: 0 },
    daily: { date: todayStr(), progress: {}, claimed: {}, refreshCount: 0 },
    achievements: { progress: {}, claimed: {} },
    stats: {},
    stamina: 1000,
    staminaAt: Date.now(),
    dungeonCount: {},
    autoRecycleCfg: { enabled: false, minLevel: 1, maxLevel: 999, rarities: ['common'] },
    autoSellCfg: { enabled: false, minLevel: 1, maxLevel: 999, rarities: ['common'] },
    createdAt: Date.now(),
  }
}

const STAMINA_MAX = 1000
const STAMINA_REGEN_MS = 30_000
/** 每次购买体力恢复量 */
const STAMINA_BUY_AMOUNT = 100
/** 购买体力基础金币消耗 */
const STAMINA_BUY_COST = 50

export const useGlobalState = createGlobalState(() => {
  // 注意：默认值为 null 时 VueUse 会推断为 any 序列化器（String(v)），
  // 导致对象被存成 "[object Object]"，必须显式指定 JSON 序列化
  const profile = useStorage<Profile | null>(
    'dragonverse-profile',
    null,
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (v: string) => {
          if (!v)
            return null
          try {
            return JSON.parse(v) as Profile
          }
          catch {
            return null
          }
        },
        write: (v: Profile | null) => (v ? JSON.stringify(v) : ''),
      },
    },
  )
  const lang = useStorage<AppLocale>('dragonverse-lang', 'en-US')
  if (lang.value !== 'ru' && lang.value !== 'en-US')
    lang.value = 'en-US'
  i18n.global.locale.value = lang.value

  // 损坏/过旧存档直接废弃；旧存档迁移：背包中的强化石材料合并为货币
  if (profile.value && (!profile.value.heroId || !Array.isArray(profile.value.bag))) {
    profile.value = null
  }
  if (profile.value) {
    const pf = profile.value
    let merged = 0
    pf.bag = pf.bag.filter((b) => {
      if (b.kind === 'material' && b.defId === 'stone') {
        merged += b.count
        return false
      }
      return true
    })
    if (merged)
      pf.stone = (pf.stone ?? 0) + merged
    // 旧存档迁移：补充新增字段
    const anyPf = pf as any
    if (!pf.slotEnhance)
      pf.slotEnhance = { weapon: 0, armor: 0, accessory: 0 }
    if (!Array.isArray(pf.pets))
      pf.pets = []
    if (!pf.daily)
      pf.daily = { date: todayStr(), progress: {}, claimed: {}, refreshCount: 0 }
    pf.daily.progress ??= {}
    pf.daily.claimed ??= {}
    pf.daily.refreshCount ??= 0
    if (!pf.achievements)
      pf.achievements = { progress: {}, claimed: {} }
    pf.achievements.progress ??= {}
    pf.achievements.claimed ??= {}
    pf.dungeonCount ??= {}
    pf.stats ??= {}
    if (!pf.shop) {
      const stock = genShopStock(pf.level ?? 1)
      pf.shop = { stock, sold: stock.map(() => false), refreshCount: 0 }
    }
    pf.shop.stock ??= []
    pf.shop.sold = pf.shop.stock.map((_, i) => !!pf.shop.sold?.[i])
    pf.shop.refreshCount ??= 0
    if (pf.autoRecycleCfg === undefined) {
      // 兼容旧的 autoRecycle 布尔字段
      const oldRecycle = anyPf.autoRecycle === true
      pf.autoRecycleCfg = { enabled: oldRecycle, minLevel: 1, maxLevel: 999, rarities: ['common'] }
    }
    if (pf.autoSellCfg === undefined)
      pf.autoSellCfg = { enabled: false, minLevel: 1, maxLevel: 999, rarities: ['common'] }
    if (pf.bagCap === undefined)
      pf.bagCap = BAG_CAP
    if (!pf.bonds) {
      pf.bonds = emptyBonds()
      pf.bonds[pf.heroId] = { rank: 1, copies: 0 }
    }
    for (const dragon of CANON_DRAGONS) {
      if (!pf.bonds[dragon.id])
        pf.bonds[dragon.id] = { rank: 0, copies: 0 }
    }
    for (const pet of pf.pets) {
      const species = pet.species || speciesFromName(pet.name)
      if (!species)
        continue
      pet.species = species
      if ((pf.bonds[species]?.rank ?? 0) < 1)
        pf.bonds[species] = { rank: 1, copies: pf.bonds[species]?.copies ?? 0 }
    }
    if (pf.lastBoonFloor === undefined)
      pf.lastBoonFloor = 0
    if (pf.runFloor === undefined)
      pf.runFloor = 1
    pf.runFloor = Math.min(TOWER_MAX_FLOOR, Math.max(1, pf.runFloor))
    if (pf.runMode === undefined)
      pf.runMode = 'tower'
    if (pf.runDungeonDefId === undefined)
      pf.runDungeonDefId = ''
    if (pf.runDungeonWave === undefined)
      pf.runDungeonWave = 0
  }

  const toasts = ref<Toast[]>([])
  let toastId = 1
  function toast(text: string, type: Toast['type'] = 'info') {
    const id = toastId++
    toasts.value.push({ id, text, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 2200)
  }

  // ---------------- Explicit global confirmation ----------------
  const interactionPaused = ref(false)
  const confirmDialog = reactive<ConfirmState>({
    open: false,
    title: '',
    message: '',
    countdown: -1,
  })

  function confirm(message: string, title = 'Confirm'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      resolveConfirm(false)
      confirmDialog.title = title
      confirmDialog.message = message
      confirmDialog.countdown = -1
      confirmDialog.resolve = resolve
      confirmDialog.open = true
      interactionPaused.value = true
    })
  }

  function resolveConfirm(value: boolean) {
    const resolve = confirmDialog.resolve
    confirmDialog.open = false
    confirmDialog.resolve = undefined
    confirmDialog.countdown = -1
    interactionPaused.value = false
    resolve?.(value)
  }

  const run = reactive<RunState>({
    started: false,
    mode: 'tower',
    status: 'idle',
    floor: 1,
    units: [],
    round: 0,
    logs: [],
    floats: [],
    boonOffer: [],
    dungeonDefId: '',
    dungeonWave: 0,
    lastReward: null,
    goldGained: 0,
  })

  const runSnapshot = useStorage<RunSnapshot | null>(
    'dragonverse-run',
    null,
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (v: string) => {
          if (!v)
            return null
          try {
            return JSON.parse(v) as RunSnapshot
          }
          catch {
            return null
          }
        },
        write: (v: RunSnapshot | null) => (v ? JSON.stringify(v) : ''),
      },
    },
  )

  function clearRunSnapshot() {
    runSnapshot.value = null
  }

  function persistRunSnapshot() {
    if (!profile.value || !run.started) {
      clearRunSnapshot()
      return
    }
    runSnapshot.value = {
      profileCreatedAt: profile.value.createdAt,
      run: JSON.parse(JSON.stringify(run)) as RunState,
    }
  }

  if (!profile.value || (runSnapshot.value && runSnapshot.value.profileCreatedAt !== profile.value.createdAt))
    clearRunSnapshot()

  watch(run, persistRunSnapshot, { deep: true, flush: 'sync' })

  const activePanel = ref<'' | 'bag' | 'shop' | 'pet' | 'dungeon' | 'quest'>('')

  const hasSave = computed(() => !!profile.value && !!profile.value.heroId)
  const p = () => profile.value!

  // ---------------- 存档 ----------------
  function createSave(heroId: string) {
    clearRunSnapshot()
    profile.value = defaultProfile(heroId)
    startRun()
  }
  function deleteSave() {
    clearRunSnapshot()
    profile.value = null
    run.started = false
    run.status = 'idle'
    run.units = []
    interactionPaused.value = false
  }
  function setLang(next: 'en-US' | 'ru') {
    lang.value = next
    i18n.global.locale.value = next
  }
  function toggleLang() {
    setLang(lang.value === 'ru' ? 'en-US' : 'ru')
  }
  function toggleAutoRecycle() {
    const pf = p()
    pf.autoRecycleCfg.enabled = !pf.autoRecycleCfg.enabled
    toast(tr(pf.autoRecycleCfg.enabled ? 'Auto-salvage on' : 'Auto-salvage off', pf.autoRecycleCfg.enabled ? 'Авторазбор включён' : 'Авторазбор выключен'), pf.autoRecycleCfg.enabled ? 'success' : 'info')
  }
  function toggleAutoSell() {
    const pf = p()
    pf.autoSellCfg.enabled = !pf.autoSellCfg.enabled
    toast(tr(pf.autoSellCfg.enabled ? 'Auto-sell on' : 'Auto-sell off', pf.autoSellCfg.enabled ? 'Автопродажа включена' : 'Автопродажа выключена'), pf.autoSellCfg.enabled ? 'success' : 'info')
  }
  function updateAutoCfg(kind: 'recycle' | 'sell', patch: Partial<AutoHandleCfg>) {
    const pf = p()
    const cfg = kind === 'recycle' ? pf.autoRecycleCfg : pf.autoSellCfg
    Object.assign(cfg, patch)
  }

  // ---------------- 刷新日常任务 ----------------
  const DAILY_REFRESH_COST = 100
  function refreshDaily(): boolean {
    toast(tr('Paid daily refresh is disabled', 'Платное обновление ежедневных заданий отключено'), 'info')
    return false
  }

  // ---------------- 任务事件 ----------------
  function ensureDaily() {
    const pf = p()
    if (pf.daily.date !== todayStr()) {
      pf.daily = { date: todayStr(), progress: {}, claimed: {}, refreshCount: 0 }
    }
  }
  function track(event: string, value = 1, mode: 'inc' | 'max' = 'inc') {
    ensureDaily()
    const pf = p()
    if (mode === 'max') {
      pf.daily.progress[event] = Math.max(pf.daily.progress[event] ?? 0, value)
      pf.achievements.progress[event] = Math.max(pf.achievements.progress[event] ?? 0, value)
    }
    else {
      pf.daily.progress[event] = (pf.daily.progress[event] ?? 0) + value
      pf.achievements.progress[event] = (pf.achievements.progress[event] ?? 0) + value
    }
  }

  function questProgress(qid: string): { current: number, claimable: boolean, claimed: boolean } {
    const def = QUESTS.find(q => q.id === qid)!
    if (def.daily)
      ensureDaily()
    const pf = p()
    const store = def.daily ? pf.daily : pf.achievements
    const current = store.progress[def.event] ?? 0
    const claimed = !!store.claimed[qid]
    return { current: Math.min(current, def.target), claimable: current >= def.target && !claimed, claimed }
  }
  function claimableCount(): number {
    return QUESTS.reduce((n, q) => n + (questProgress(q.id).claimable ? 1 : 0), 0)
  }
  function claimQuest(qid: string) {
    const def = QUESTS.find(q => q.id === qid)!
    const info = questProgress(qid)
    if (!info.claimable)
      return
    const pf = p()
    const store = def.daily ? pf.daily : pf.achievements
    store.claimed[qid] = true
    if (def.rewards.gold)
      pf.gold += def.rewards.gold
    if (def.rewards.stone)
      pf.stone += def.rewards.stone
    if (def.rewards.soul)
      pf.soul += def.rewards.soul
    if (def.rewards.exp)
      gainExp(def.rewards.exp)
    if (def.rewards.item) {
      stackIntoBag(pf.bag, {
        uid: uid('it'),
        kind: 'consumable',
        defId: def.rewards.item.defId,
        count: def.rewards.item.count,
      }, pf.bagCap)
    }
    toast(tr('Quest reward claimed', 'Награда квеста получена'), 'success')
  }

  // ---------------- 体力 ----------------
  function syncStamina() {
    if (!profile.value)
      return
    const pf = profile.value
    if (pf.stamina >= STAMINA_MAX) {
      pf.staminaAt = Date.now()
      return
    }
    const gain = Math.floor((Date.now() - pf.staminaAt) / STAMINA_REGEN_MS)
    if (gain > 0) {
      pf.stamina = Math.min(STAMINA_MAX, pf.stamina + gain)
      pf.staminaAt += gain * STAMINA_REGEN_MS
      if (pf.stamina >= STAMINA_MAX)
        pf.staminaAt = Date.now()
    }
  }

  /** 花金币购买体力 */
  function buyStamina(): boolean {
    toast(tr('Stamina refill is disabled', 'Покупка выносливости отключена'), 'info')
    return false
  }

  // ---------------- 经验 / 物品 ----------------
  const MAX_LEVEL = 999
  function gainExp(amount: number) {
    const pf = p()
    if (pf.level >= MAX_LEVEL) {
      pf.exp = 0
      return
    }
    pf.exp += amount
    while (pf.exp >= expNeed(pf.level) && pf.level < MAX_LEVEL) {
      pf.exp -= expNeed(pf.level)
      pf.level += 1
      track('level', pf.level, 'max')
      toast(tr(`Dragon reached level ${pf.level}`, `Дракон достиг уровня ${pf.level}`), 'success')
    }
    if (pf.level >= MAX_LEVEL)
      pf.exp = 0
  }

  // 判断装备是否命中自动处理配置
  function matchAutoCfg(item: BagItem, cfg: AutoHandleCfg): boolean {
    if (!cfg.enabled || item.kind !== 'equip')
      return false
    const lv = item.itemLevel ?? 1
    if (lv < cfg.minLevel || lv > cfg.maxLevel)
      return false
    return cfg.rarities.includes(item.rarity ?? 'common')
  }

  function addItem(item: BagItem): { added: boolean, autoSold: number, autoRecycled: boolean } {
    const pf = p()
    if (stackIntoBag(pf.bag, item, pf.bagCap))
      return { added: true, autoSold: 0, autoRecycled: false }
    // 背包满：自动回收优先
    if (matchAutoCfg(item, pf.autoRecycleCfg)) {
      const gain = recycleGain(item)
      pf.stone += gain.stone
      pf.soul += gain.soul
      return { added: false, autoSold: 0, autoRecycled: true }
    }
    if (matchAutoCfg(item, pf.autoSellCfg)) {
      const gold = sellPrice(item)
      pf.gold += gold
      return { added: false, autoSold: gold, autoRecycled: false }
    }
    // 新装备不在清理范围时，优先替换背包内命中的旧装备
    if (item.kind === 'equip') {
      const oldIdx = pf.bag.findIndex(b => matchAutoCfg(b, pf.autoRecycleCfg))
      if (oldIdx !== -1) {
        const [old] = pf.bag.splice(oldIdx, 1)
        const gain = recycleGain(old)
        pf.stone += gain.stone
        pf.soul += gain.soul
        pf.bag.push(item)
        return { added: true, autoSold: 0, autoRecycled: false }
      }
      const sellIdx = pf.bag.findIndex(b => matchAutoCfg(b, pf.autoSellCfg))
      if (sellIdx !== -1) {
        const [old] = pf.bag.splice(sellIdx, 1)
        pf.gold += sellPrice(old)
        pf.bag.push(item)
        return { added: true, autoSold: 0, autoRecycled: false }
      }
    }
    // 背包满：装备自动出售，其余丢弃
    const gold = item.kind === 'equip' ? sellPrice(item) : 0
    pf.gold += gold
    return { added: false, autoSold: gold, autoRecycled: false }
  }

  function addPet(pet: Pet) {
    const pf = p()
    const species = pet.species || speciesFromName(pet.name)
    if (species) {
      pet.species = species
      const bond = pf.bonds[species] ?? { rank: 0, copies: 0 }
      if (bond.rank < 1)
        bond.rank = 1
      pf.bonds[species] = bond
    }
    pf.pets.push(pet)
    track('petGain', pf.pets.length, 'max')
  }

  // ---------------- 背包：整理 / 出售 / 回收 / 使用 ----------------
  const SORT_ORDER = { equip: 0, consumable: 1, material: 2 }
  function sortBag() {
    const pf = p()
    pf.bag.sort((a, b) => {
      const sa = SORT_ORDER[a.kind] - SORT_ORDER[b.kind]
      if (sa !== 0)
        return sa
      if (a.kind === 'equip') {
        const ri = RARITY_ORDER.indexOf(b.rarity ?? 'common') - RARITY_ORDER.indexOf(a.rarity ?? 'common')
        if (ri !== 0)
          return ri
        return (b.enhance ?? 0) - (a.enhance ?? 0)
      }
      return a.defId.localeCompare(b.defId)
    })
    toast(i18n.global.t('bag.sortDone'), 'success')
  }

  function sellItem(itemUid: string) {
    const pf = p()
    // 先查背包
    const idx = pf.bag.findIndex(b => b.uid === itemUid)
    if (idx !== -1) {
      const [item] = pf.bag.splice(idx, 1)
      if (item.kind === 'equip') {
        pf.gold += sellPrice(item)
        toast(tr(`+${sellPrice(item)} gold`, `+${sellPrice(item)} золота`), 'success')
      }
      else {
        const def = item.kind === 'consumable' ? getConsumableDef(item.defId) : getMaterialDef(item.defId)
        const price = def?.price ?? 10
        const total = price * item.count
        pf.gold += total
        toast(tr(`+${total} gold`, `+${total} золота`), 'success')
      }
      return
    }
    // 再查装备栏位：卖出后强化保留在栏位上
    for (const slot of ['weapon', 'armor', 'accessory'] as const) {
      const item = pf.equipped[slot]
      if (item && item.uid === itemUid) {
        pf.gold += sellPrice(item)
        pf.equipped[slot] = undefined
        // slotEnhance 保留，不重置
        toast(tr(`+${sellPrice(item)} gold (enhancement kept)`, `+${sellPrice(item)} золота (усиление сохранено)`), 'success')
        return
      }
    }
  }

  function recycleItem(itemUid: string) {
    const pf = p()
    const idx = pf.bag.findIndex(b => b.uid === itemUid)
    if (idx === -1)
      return
    const [item] = pf.bag.splice(idx, 1)
    if (item.kind !== 'equip') {
      pf.bag.splice(idx, 0, item)
      toast(tr('Only gear can be salvaged', 'Разобрать можно только снаряжение'), 'error')
      return
    }
    const gain = recycleGain(item)
    pf.stone += gain.stone
    pf.soul += gain.soul
    track('recycle', 1)
    toast(tr(`Salvage: ${gain.stone} stones, ${gain.soul} crystals`, `Разбор: ${gain.stone} камней, ${gain.soul} кристаллов`), 'success')
  }

  /** 判断装备是否命中自动处理配置（仅等级+品阶，不受 enabled 开关影响，供一键出售/回收使用） */
  function matchAutoCfgRange(item: BagItem, cfg: AutoHandleCfg): boolean {
    if (item.kind !== 'equip')
      return false
    const lv = item.itemLevel ?? 1
    if (lv < cfg.minLevel || lv > cfg.maxLevel)
      return false
    return cfg.rarities.includes(item.rarity ?? 'common')
  }

  /** 一键出售背包中命中自动出售配置的装备 */
  function sellAllEquips() {
    const pf = p()
    const before = pf.bag.length
    let gold = 0
    let cnt = 0
    pf.bag = pf.bag.filter((it) => {
      if (it.kind === 'equip' && matchAutoCfgRange(it, pf.autoSellCfg)) {
        gold += sellPrice(it)
        cnt += 1
        return false
      }
      return true
    })
    pf.gold += gold
    if (cnt > 0)
      toast(tr(`Sold ${cnt} items, +${gold} gold`, `Продано ${cnt}, +${gold} золота`), 'success')
    else
      toast(tr('Nothing matched auto-sell', 'Автопродаже нечего продавать'), 'info')
  }

  /** 一键回收背包中命中自动回收配置的装备 */
  function recycleAllEquips() {
    const pf = p()
    let stone = 0
    let soul = 0
    let cnt = 0
    pf.bag = pf.bag.filter((it) => {
      if (it.kind === 'equip' && matchAutoCfgRange(it, pf.autoRecycleCfg)) {
        const g = recycleGain(it)
        stone += g.stone
        soul += g.soul
        cnt += 1
        return false
      }
      return true
    })
    pf.stone += stone
    pf.soul += soul
    if (cnt > 0) {
      track('recycle', cnt)
      toast(tr(`Salvaged ${cnt}: +${stone} stones, +${soul} crystals`, `Разобрано ${cnt}: +${stone} камней, +${soul} кристаллов`), 'success')
    }
    else {
      toast(tr('Nothing matched auto-salvage', 'Авторазбору нечего разбирать'), 'info')
    }
  }

  /** 购买背包容量：每次 +5 格，价格递增 */
  const BAG_SLOT_STEP = 5
  const BAG_MAX_CAP = 200
  function bagSlotCost(): number {
    const pf = p()
    const steps = Math.floor((pf.bagCap - BAG_CAP) / BAG_SLOT_STEP)
    return Math.round(200 * (1 + steps * 0.5))
  }
  function buyBagSlot(): boolean {
    const pf = p()
    if (pf.bagCap >= BAG_MAX_CAP) {
      toast(tr('Bag is at max capacity', 'Сумка уже максимальная'), 'error')
      return false
    }
    const cost = bagSlotCost()
    if (pf.gold < cost) {
      toast(tr(`Not enough gold (need ${cost})`, `Не хватает золота (нужно ${cost})`), 'error')
      return false
    }
    pf.gold -= cost
    pf.bagCap = Math.min(BAG_MAX_CAP, pf.bagCap + BAG_SLOT_STEP)
    toast(tr(`Bag capacity is now ${pf.bagCap}`, `Вместимость сумки: ${pf.bagCap}`), 'success')
    return true
  }

  // ---------------- 装备：穿戴 / 卸下 / 强化 / 升级 ----------------
  function equipItem(itemUid: string) {
    const pf = p()
    const idx = pf.bag.findIndex(b => b.uid === itemUid)
    if (idx === -1)
      return
    const item = pf.bag[idx]
    if (item.kind !== 'equip')
      return
    pf.bag.splice(idx, 1)
    // 借助装备 defId 首字母查槽位（w/a/c）
    const slot = (() => {
      const m = item.defId[0]
      return m === 'w' ? 'weapon' : m === 'a' ? 'armor' : 'accessory'
    })()
    const old = pf.equipped[slot]
    // Equipped gear receives the permanent slot bonus; bag items never carry it away.
    item.enhance = pf.slotEnhance[slot]
    pf.equipped[slot] = item
    if (old) {
      old.enhance = 0
      pf.bag.push(old)
    }
    if ((item.rarity ?? 'common') !== 'common' && (item.rarity ?? 'common') !== 'rare')
      track('equipEpic', 1, 'max')
    toast(tr('Equipped', 'Надето'), 'success')
  }

  function unequipItem(slot: 'weapon' | 'armor' | 'accessory') {
    const pf = p()
    const item = pf.equipped[slot]
    if (!item)
      return
    if (pf.bag.length >= pf.bagCap) {
      toast(i18n.global.t('bag.bagFull'), 'error')
      return
    }
    item.enhance = 0
    pf.bag.push(item)
    pf.equipped[slot] = undefined
  }

  const MAX_ENHANCE = 99
  function enhanceItem(slot: 'weapon' | 'armor' | 'accessory') {
    const pf = p()
    const item = pf.equipped[slot]
    if (!item)
      return
    const e = pf.slotEnhance[slot]
    if (e >= MAX_ENHANCE) {
      toast(i18n.global.t('bag.enhanceMax'), 'error')
      return
    }
    const rIdx = RARITY_ORDER.indexOf(item.rarity ?? 'common')
    const cost = enhanceCost(rIdx, e)
    if (pf.gold < cost.gold) {
      toast(i18n.global.t('bag.goldLack'), 'error')
      return
    }
    if (pf.stone < cost.stone) {
      toast(i18n.global.t('bag.materialLack'), 'error')
      return
    }
    pf.gold -= cost.gold
    pf.stone -= cost.stone
    track('enhance', 1)
    if (chance(cost.rate)) {
      pf.slotEnhance[slot] = e + 1
      item.enhance = e + 1
      toast(`${i18n.global.t('bag.enhanceSuccess')} +${pf.slotEnhance[slot]}`, 'success')
    }
    else {
      toast(i18n.global.t('bag.enhanceFail'), 'error')
    }
  }

  function upgradeItem(slot: 'weapon' | 'armor' | 'accessory') {
    const pf = p()
    const item = pf.equipped[slot]
    if (!item)
      return
    const r = item.rarity ?? 'common'
    const next = RARITY_META[r].next
    if (!next) {
      toast(tr('Highest rarity reached', 'Редкость уже максимальная'), 'error')
      return
    }
    if (pf.slotEnhance[slot] < 5) {
      toast(tr('Needs enhancement +5', 'Нужно усиление +5'), 'error')
      return
    }
    const idx = RARITY_ORDER.indexOf(r)
    const soulCost = UPGRADE_SOUL_COST[idx]
    const goldCost = UPGRADE_GOLD_COST[idx]
    if (pf.soul < soulCost || pf.gold < goldCost) {
      toast(i18n.global.t('bag.materialLack'), 'error')
      return
    }
    pf.soul -= soulCost
    pf.gold -= goldCost
    item.rarity = next
    pf.slotEnhance[slot] = Math.max(0, pf.slotEnhance[slot] - 5)
    item.enhance = pf.slotEnhance[slot]
    toast(i18n.global.t('bag.upgradeSuccess'), 'success')
  }

  // ---------------- 商店 ----------------
  const SHOP_REFRESH_COST = 1000
  function refreshShop() {
    const pf = p()
    if (pf.gold < SHOP_REFRESH_COST) {
      toast(i18n.global.t('bag.goldLack'), 'error')
      return
    }
    pf.gold -= SHOP_REFRESH_COST
    pf.shop.refreshCount += 1
    pf.shop.stock = genShopStock(pf.level)
    pf.shop.sold = pf.shop.stock.map(() => false)
    toast(i18n.global.t('shop.refreshed'), 'success')
  }

  /** Rare-hunt spending is hidden until the acquisition system is rebuilt in Stage 3. */
  function refreshShopToGoldOrRed(): { ok: boolean, spent: number, tries: number } {
    toast(tr('Rare hunt is disabled', 'Поиск редких временно отключён'), 'info')
    return { ok: false, spent: 0, tries: 0 }
  }

  function buyShop(index: number) {
    const pf = p()
    const slot = pf.shop.stock[index]
    if (!slot || pf.shop.sold[index])
      return
    const price = shopSlotPrice(slot)
    if (pf.gold < price) {
      toast(i18n.global.t('bag.goldLack'), 'error')
      return
    }
    if (slot.kind === 'pet') {
      toast(tr('Market dragon offers are disabled until their rules are rebuilt', 'Рыночные призывы драконов временно отключены'), 'info')
      return
    }
    if (slot.kind === 'equip') {
      if (!slot.equip) {
        toast(tr('Invalid offer', 'Предложение недействительно'), 'error')
        return
      }
      slot.equip.rarity = slot.rarity ?? slot.equip.rarity
      if (!stackIntoBag(pf.bag, slot.equip, pf.bagCap)) {
        toast(tr('Bag is full', 'Сумка полна'), 'error')
        return
      }
      pf.gold -= price
    }
    else if (slot.kind === 'material') {
      pf.gold -= price
      pf.stone += 1
    }
    else {
      if (!stackIntoBag(pf.bag, { uid: uid('it'), kind: slot.kind, defId: slot.defId!, count: 1 }, pf.bagCap)) {
        toast(tr('Bag is full', 'Сумка полна'), 'error')
        return
      }
      pf.gold -= price
    }
    pf.shop.sold[index] = true
    track('shopBuy', 1)
    toast(i18n.global.t('shop.bought'), 'success')
  }

  const SUMMON_COST = 40

  function ensureSpeciesPet(speciesId: string) {
    const pf = p()
    if (pf.pets.some(pet => (pet.species || speciesFromName(pet.name)) === speciesId))
      return
    const pet = genPet(1, 'rare', speciesId)
    pet.species = speciesId
    pet.deployed = false
    addPet(pet)
  }

  /** Unlock the species, or add a spare copy if it is already in the flight. */
  function grantCopy(speciesId: string): 'unlock' | 'copy' {
    const pf = p()
    const bond = pf.bonds[speciesId] ?? { rank: 0, copies: 0 }
    if (bond.rank < 1) {
      bond.rank = 1
      bond.copies = 0
      pf.bonds[speciesId] = bond
      ensureSpeciesPet(speciesId)
      return 'unlock'
    }
    bond.copies += 1
    pf.bonds[speciesId] = bond
    return 'copy'
  }

  function raiseBond(speciesId: string): boolean {
    const pf = p()
    const bond = pf.bonds[speciesId]
    if (!bond || bond.rank < 1 || bond.rank >= BOND_MAX) {
      toast(bond && bond.rank >= BOND_MAX ? tr('Already level 10', 'Уже 10 уровень') : tr('Summon this dragon first', 'Сначала призови этого дракона'), 'error')
      return false
    }
    const cost = copiesToNext(bond.rank)
    if (bond.copies < cost) {
      toast(tr(`Need ${cost} copies (have ${bond.copies})`, `Нужно копий: ${cost} (есть ${bond.copies})`), 'error')
      return false
    }
    bond.copies -= cost
    bond.rank += 1
    const name = CANON_DRAGONS.find(d => d.id === speciesId)?.name ?? 'Dragon'
    toast(tr(`${name} is now level ${bond.rank}`, `${name} теперь уровня ${bond.rank}`), 'success')
    return true
  }

  function summonDragon(): boolean {
    const pf = p()
    if (pf.gold < SUMMON_COST) {
      toast(tr(`Not enough gold (need ${SUMMON_COST})`, `Не хватает золота (нужно ${SUMMON_COST})`), 'error')
      return false
    }
    pf.gold -= SUMMON_COST
    const locked = CANON_DRAGONS.filter(d => (pf.bonds[d.id]?.rank ?? 0) < 1)
    const pool = locked.length && Math.random() < 0.7 ? locked : CANON_DRAGONS
    const dragon = pool[Math.floor(Math.random() * pool.length)]
    const kind = grantCopy(dragon.id)
    toast(kind === 'unlock' ? tr(`${dragon.name} joined the flight`, `${dragon.name} вступил в полёт`) : tr(`${dragon.name} copy +1`, `${dragon.name}: копия +1`), 'success')
    track('petGain', 1)
    return true
  }

  function setLead(heroId: string) {
    const bond = p().bonds[heroId]
    if (!bond || bond.rank < 1)
      return false
    clearRunSnapshot()
    p().heroId = heroId
    return true
  }

  // ---------------- 宠物：出战 / 训练 / 出售 / 回收 ----------------
  function deployPet(petUid: string) {
    const pf = p()
    const count = pf.pets.filter(x => x.deployed).length
    if (count >= 5) {
      toast(i18n.global.t('pet.deployLimit', { n: 5 }), 'error')
      return
    }
    const pet = pf.pets.find(x => x.uid === petUid)
    if (pet)
      pet.deployed = true
  }
  function withdrawPet(petUid: string) {
    const pet = p().pets.find(x => x.uid === petUid)
    if (pet)
      pet.deployed = false
  }
  function trainPet(petUid: string) {
    const pf = p()
    const pet = pf.pets.find(x => x.uid === petUid)
    if (!pet)
      return
    if (pet.train >= 10) {
      toast(i18n.global.t('pet.trainMax'), 'error')
      return
    }
    const cost = 60 * pet.level * (pet.train + 1)
    if (pf.gold < cost) {
      toast(i18n.global.t('bag.goldLack'), 'error')
      return
    }
    pf.gold -= cost
    pet.train += 1
    toast(tr('Training complete', 'Тренировка завершена'), 'success')
  }
  function petSellPrice(pet: Pet): number {
    return Math.round(50 * pet.level ** 1.1 * RARITY_META[pet.rarity].mul)
  }
  function sellPet(petUid: string) {
    const pf = p()
    const idx = pf.pets.findIndex(x => x.uid === petUid)
    if (idx === -1)
      return
    const [pet] = pf.pets.splice(idx, 1)
    pf.gold += petSellPrice(pet)
    toast(tr(`+${petSellPrice(pet)} gold`, `+${petSellPrice(pet)} золота`), 'success')
  }
  function recyclePet(petUid: string) {
    const pf = p()
    const idx = pf.pets.findIndex(x => x.uid === petUid)
    if (idx === -1)
      return
    const [pet] = pf.pets.splice(idx, 1)
    const soulTable = [3, 7, 18, 40, 90]
    const soul = soulTable[RARITY_ORDER.indexOf(pet.rarity)] ?? 3
    pf.soul += soul
    track('recycle', 1)
    toast(tr(`Salvage: ${soul} crystals`, `Разбор: ${soul} кристаллов`), 'success')
  }

  /** 宠物品阶升级消耗（按当前品阶） */
  function petUpgradeCost(pet: Pet): { gold: number, soul: number } | null {
    const next = RARITY_META[pet.rarity].next
    if (!next)
      return null
    const idx = RARITY_ORDER.indexOf(pet.rarity)
    const goldTable = [200, 800, 3000, 12000]
    const soulTable = [8, 25, 70, 200]
    return { gold: goldTable[idx] ?? 99999, soul: soulTable[idx] ?? 999 }
  }
  function upgradePetRarity(_petUid: string): boolean {
    toast(tr('Dragon rarity upgrade is disabled until it has a real combat effect', 'Повышение редкости дракона отключено до переработки эффекта'), 'info')
    return false
  }

  // ---------------- 副本 ----------------
  function dungeonDef(id: string): DungeonDef {
    return DUNGEONS.find(d => d.id === id) ?? DUNGEONS[0]
  }
  function enterDungeon(id: string) {
    syncStamina()
    const pf = p()
    const def = dungeonDef(id)
    if (pf.level < def.needLevel) {
      toast(i18n.global.t('common.locked'), 'error')
      return
    }
    if (pf.stamina < def.cost) {
      toast(i18n.global.t('dungeon.staminaLack'), 'error')
      return
    }
    pf.stamina -= def.cost
    pf.staminaAt = Date.now()
    run.mode = 'dungeon'
    run.dungeonDefId = id
    run.dungeonWave = 0
    pf.runMode = 'dungeon'
    pf.runDungeonDefId = id
    pf.runDungeonWave = 0
    activePanel.value = ''
    loadDungeonWave()
  }
  // Sweep is hidden until the reward/stamina economy is rebuilt.
  function sweepDungeon(_id: string): boolean {
    toast(tr('Realm sweep is disabled', 'Зачистка царств отключена'), 'info')
    return false
  }
  function loadDungeonWave() {
    const def = dungeonDef(run.dungeonDefId)
    run.units = [...createHeroUnits(p()), ...genDungeonWave(def, run.dungeonWave)]
    run.round = 0
    run.status = 'fighting'
    run.floats = []
    const pf = p()
    pf.runMode = 'dungeon'
    pf.runDungeonDefId = run.dungeonDefId
    pf.runDungeonWave = run.dungeonWave
  }
  function nextDungeonWave(): boolean {
    if (run.mode !== 'dungeon' || run.status !== 'waveClear')
      return false
    const def = dungeonDef(run.dungeonDefId)
    if (run.dungeonWave >= def.waves - 1)
      return false
    run.dungeonWave += 1
    loadDungeonWave()
    return true
  }
  function abandonDungeon() {
    exitToTower()
  }
  function exitToTower() {
    run.mode = 'tower'
    run.dungeonDefId = ''
    run.dungeonWave = 0
    loadTowerWave()
  }

  // ---------------- 无尽魔塔 / 战斗 ----------------
  function pushLog(text: string, type: LogLine['type'] = 'sys') {
    run.logs.push({ id: Date.now() + Math.random(), text, type })
    if (run.logs.length > 80)
      run.logs.shift()
  }

  function loadTowerWave() {
    run.units = [...createHeroUnits(p()), ...genTowerWave(run.floor)]
    run.round = 0
    run.status = 'fighting'
    run.floats = []
    p().runFloor = run.floor
    p().runMode = 'tower'
    p().runDungeonDefId = ''
    p().runDungeonWave = 0
  }

  function startRun() {
    const pf = p()
    // 主动/死亡重开：从第 1 层开始，但祝福等永久成长保留
    pf.runFloor = 1
    pf.runMode = 'tower'
    pf.runDungeonDefId = ''
    pf.runDungeonWave = 0
    run.started = true
    run.mode = 'tower'
    run.floor = 1
    run.dungeonDefId = ''
    run.dungeonWave = 0
    run.goldGained = 0
    run.logs = []
    run.boonOffer = []
    loadTowerWave()
    pushLog(tr('The hunt begins. Tower floor 1.', 'Охота началась. Этаж башни 1.'), 'sys')
  }

  /** Resume the exact persisted encounter/choice state when available. */
  function continueRun() {
    const pf = p()
    const saved = runSnapshot.value
    if (saved && saved.profileCreatedAt === pf.createdAt) {
      Object.assign(run, JSON.parse(JSON.stringify(saved.run)) as RunState)
      run.floor = Math.min(TOWER_MAX_FLOOR, Math.max(1, run.floor))
      return
    }

    run.started = true
    run.mode = pf.runMode
    run.floor = Math.min(TOWER_MAX_FLOOR, Math.max(1, pf.runFloor))
    run.dungeonDefId = pf.runDungeonDefId
    run.dungeonWave = pf.runDungeonWave
    run.goldGained = 0
    run.logs = []
    run.boonOffer = []
    if (run.mode === 'dungeon' && run.dungeonDefId)
      loadDungeonWave()
    else
      loadTowerWave()
    pushLog(run.mode === 'dungeon' ? tr(`Resume ${dungeonDef(run.dungeonDefId).name}`, `Снова: ${txName(dungeonDef(run.dungeonDefId).id, dungeonDef(run.dungeonDefId).name)}`) : tr(`The hunt continues. Floor ${run.floor}.`, `Охота продолжается. Этаж ${run.floor}.`), 'sys')
  }

  function nextTowerFloor(): boolean {
    if (run.mode !== 'tower' || (run.status !== 'waveClear' && run.status !== 'boon'))
      return false
    if (run.floor >= TOWER_MAX_FLOOR) {
      run.status = 'runOver'
      run.boonOffer = []
      pushLog(tr('Tower floor 40 cleared.', 'Башня пройдена до 40 этажа.'), 'reward')
      return false
    }
    run.floor += 1
    loadTowerWave()
    pushLog(tr(`Floor ${run.floor}`, `Этаж ${run.floor}`), 'sys')
    return true
  }

  function chooseBoon(boonId: string): boolean {
    if (run.status !== 'boon' || !run.boonOffer.includes(boonId))
      return false
    const pf = p()
    pf.boons.push(boonId)
    pf.lastBoonFloor = Math.max(pf.lastBoonFloor, run.floor)
    run.boonOffer = []
    nextTowerFloor()
    return true
  }

  function settleTowerVictory(): RewardInfo {
    const pf = p()
    const bonus = boonsToBonus(pf.boons)
    const boss = run.floor % 5 === 0
    const gold = Math.round((12 + run.floor * 4) * (boss ? 3 : 1) * (1 + bonus.goldBonus / 100))
    const exp = Math.round((12 + run.floor * 4) * (boss ? 2.5 : 1))
    pf.gold += gold
    run.goldGained += gold
    gainExp(exp)
    const drop = rollDrop(run.floor, bonus.dropBonus / 100, boss)
    const drops: BagItem[] = []
    let stone = 0
    if (drop) {
      if (drop.kind === 'equip') {
        const r = addItem(drop)
        if (r.added)
          drops.push(drop)
        else if (r.autoRecycled)
          toast(tr('Bag full — common gear auto-salvaged', 'Сумка полна — обычное снаряжение разобрано'), 'info')
        else
          toast(`${i18n.global.t('bag.bagFull')} (+${r.autoSold})`, 'info')
      }
      else if (drop.kind === 'material') {
        pf.stone += drop.count
        stone = drop.count
      }
      else {
        addItem(drop)
        drops.push(drop)
      }
    }
    // 出战宠物获得经验
    for (const pet of pf.pets.filter(x => x.deployed)) {
      pet.xp += Math.round(exp * 0.6)
      while (pet.xp >= petExpNeed(pet.level)) {
        pet.xp -= petExpNeed(pet.level)
        pet.level += 1
      }
    }
    pf.bestFloor = Math.max(pf.bestFloor, run.floor)
    track('battle', 1)
    track('floor', run.floor, 'max')
    const copyKind = grantCopy(pf.heroId)
    let extraCopy: string | undefined
    if (run.floor % 3 === 0) {
      const others = CANON_DRAGONS.filter(d => d.id !== pf.heroId)
      const extra = others[Math.floor(Math.random() * others.length)]
      grantCopy(extra.id)
      extraCopy = extra.id
    }
    if (copyKind === 'unlock')
      pushLog(tr(`${CANON_DRAGONS.find(d => d.id === pf.heroId)?.name} joined the flight`, `${CANON_DRAGONS.find(d => d.id === pf.heroId)?.name} вступил в полёт`), 'reward')
    return { gold, exp, drops, stone, copyOf: pf.heroId, extraCopy }
  }

  function settleDungeonVictory() {
    const pf = p()
    const def = dungeonDef(run.dungeonDefId)
    pf.gold += def.rewards.gold
    run.goldGained += def.rewards.gold
    gainExp(def.rewards.exp)
    for (const item of def.rewards.items) {
      if (item.defId === 'stone')
        pf.stone += item.count
      else
        addItem({ uid: uid('it'), kind: 'consumable', defId: item.defId, count: item.count })
    }
    if (def.rewards.egg) {
      const pet = genPet(def.level, undefined)
      addPet(pet)
    }
    pf.dungeonCount[def.id] = (pf.dungeonCount[def.id] ?? 0) + 1
    track('dungeonClear', 1)
    run.lastReward = {
      gold: def.rewards.gold,
      exp: def.rewards.exp,
      drops: [],
      stone: def.rewards.items.filter(i => i.defId === 'stone').reduce((sum, i) => sum + i.count, 0),
      egg: def.rewards.egg,
    }
  }

  function battleTick() {
    if (run.status !== 'fighting' || !run.units.length)
      return
    run.round += 1
    const result = stepRound(run.units, { logs: run.logs, floats: run.floats })
    if (result === 'fighting')
      return
    if (result === 'lost') {
      pushLog(tr('Your dragon fell. This run is over.', 'Твой дракон пал. Забег окончен.'), 'kill')
      run.status = run.mode === 'tower' ? 'runOver' : 'dungeonLost'
      return
    }
    // 胜利
    if (run.mode === 'tower') {
      const reward = settleTowerVictory()
      run.lastReward = reward
      pushLog(tr(`Floor ${run.floor} cleared. +${reward.gold} gold, +${reward.exp} XP`, `Этаж ${run.floor} пройден. +${reward.gold} золота, +${reward.exp} опыта`), 'reward')
      // 每 5 层首领层可领取祝福，但已领取过的层数不再重复领取
      if (run.floor % 5 === 0 && run.floor > p().lastBoonFloor) {
        run.boonOffer = genBoonOffer(p().boons)
        run.status = 'boon'
      }
      else {
        run.status = 'waveClear'
      }
    }
    else {
      const def = dungeonDef(run.dungeonDefId)
      if (run.dungeonWave === def.waves - 1) {
        settleDungeonVictory()
        pushLog(tr(`${def.name} cleared.`, `${txName(def.id, def.name)} пройдено.`), 'reward')
        run.status = 'dungeonClear'
      }
      else {
        run.status = 'waveClear'
      }
    }
  }

  /** 释放英雄主动技能 */
  function castSkill(): boolean {
    if (run.status !== 'fighting')
      return false
    const pf = p()
    const ok = castHeroSkill(run.units, pf.heroId, { logs: run.logs, floats: run.floats })
    if (!ok) {
      toast(tr('Skill is cooling down', 'Умение ещё остывает'), 'error')
      return false
    }
    // 技能可能直接清场，立即结算
    const enemyAlive = run.units.some(u => u.side === 'enemy' && u.alive)
    if (!enemyAlive)
      battleTick()
    return true
  }

  /** 当前英雄的主动技能定义（供 UI 展示） */
  function heroActiveSkill() {
    const pf = p()
    return getHero(pf.heroId).active
  }
  /** 当前英雄单位技能剩余冷却 */
  function heroSkillCd(): number {
    const hero = run.units.find(u => u.side === 'hero')
    return hero?.skillCd ?? 0
  }

  /** 自动补满宠物精灵 url（旧存档容错） */
  function fixPetSprites() {
    if (!profile.value)
      return
    for (const pet of profile.value.pets) {
      if (!pet.sprite)
        pet.sprite = spriteByName(pet.name)?.url ?? ''
    }
  }
  fixPetSprites()

  return {
    profile, lang, toasts, toast, run, activePanel, hasSave, interactionPaused,
    confirmDialog, confirm, resolveConfirm,
    createSave, deleteSave, toggleLang, setLang, toggleAutoRecycle, toggleAutoSell, updateAutoCfg, refreshDaily, DAILY_REFRESH_COST,
    questProgress, claimableCount, claimQuest,
    syncStamina, buyStamina, STAMINA_BUY_COST, STAMINA_BUY_AMOUNT, gainExp, addItem, addPet,
    sortBag, sellItem, recycleItem, sellAllEquips, recycleAllEquips, buyBagSlot, bagSlotCost, BAG_MAX_CAP,
    equipItem, unequipItem, enhanceItem, upgradeItem, MAX_ENHANCE,
    refreshShop, refreshShopToGoldOrRed, SHOP_REFRESH_COST, buyShop,
    deployPet, withdrawPet, trainPet, petSellPrice, sellPet, recyclePet, petUpgradeCost, upgradePetRarity,
    summonDragon, raiseBond, setLead, SUMMON_COST,
    dungeonDef, enterDungeon, sweepDungeon, nextDungeonWave, abandonDungeon, exitToTower,
    startRun, continueRun, nextTowerFloor, chooseBoon, battleTick,
    castSkill, heroActiveSkill, heroSkillCd,
    track, STAMINA_MAX,
  }
})
