<template>
  <div v-if="pf" class="battle-shell flex h-full min-h-0 flex-col bg-[#090e14]">
    <TopBar />

    <div class="battle-layout min-h-0 flex-1">
    <!-- ===== 敌方状态栏 ===== -->
    <aside class="battle-side battle-side--enemy">
      <ZoneTag :text="t('battle.enemyArea')" color="red" />
      <div class="pointer-events-none absolute inset-0 opacity-[0.07]" style="background-image: radial-gradient(circle at 20% 30%, #ef4444 0, transparent 40%), radial-gradient(circle at 80% 60%, #ef4444 0, transparent 35%)" />

      <div class="battle-side__summary relative z-1">
        <div class="battle-side__count">{{ enemies.length }}</div>
        <div class="battle-side__label">{{ tr('ENEMIES', 'ВРАГИ') }}</div>
        <div v-for="u in enemies" :key="`enemy-status-${u.id}`" class="battle-side__unit-name">
          {{ u.name }} <span>Lv{{ u.level }}</span>
        </div>
      </div>
    </aside>

    <main class="battle-arena">
      <div class="battle-arena__caption">{{ tr('AUTO COMBAT', 'АВТОБОЙ') }} <span>/</span> {{ run.mode === 'dungeon' ? dungeonLabel(run.dungeonDefId) : `${tr('B', 'Э')}${run.floor}` }}</div>
      <div class="battle-arena__enemy relative z-1 flex max-w-full items-end justify-center gap-2 px-2 sm:gap-4">
        <UnitCard v-for="u in enemies" :key="`arena-${u.id}`" :unit="u" :floats="run.floats" />
      </div>
      <div class="battle-arena__divider"><span>VS</span></div>
      <div class="battle-arena__allies relative z-1 flex w-full max-w-full flex-wrap items-end justify-around gap-1 px-2 sm:gap-3">
        <UnitCard v-for="u in allies" :key="`arena-${u.id}`" :unit="u" :floats="run.floats" />
      </div>
    </main>

    <aside class="battle-side battle-side--log">
      <div class="battle-side__title">{{ tr('COMBAT LOG', 'ЖУРНАЛ БОЯ') }}</div>
      <div class="log-scroll h-full w-full overflow-y-auto p-2 text-10px leading-4">
        <div
          v-for="line in [...run.logs].reverse()"
          :key="`side-${line.id}`"
          class="mb-0.5"
          :class="{
            'text-red-300': line.type === 'hit',
            'text-yellow-300 font-bold': line.type === 'crit',
            'text-red-400 font-bold': line.type === 'kill',
            'text-primary': line.type === 'reward',
            'text-green-300': line.type === 'heal',
            'text-white/60': line.type === 'sys',
          }"
        >{{ localizeLog(line.text) }}</div>
      </div>
    </aside>
    </div>

    <!-- ===== 中间状态条 ===== -->
    <div class="battle-toolbar flex min-h-10 shrink-0 items-center justify-between gap-1 border-y border-white/10 bg-[#0e141b] px-2 text-12px shadow-[0_0_18px_rgb(0_0_0/0.2)]">
      <!-- 左侧：层数 / 回合 -->
      <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span class="game-chip shrink-0">
          <span v-if="run.mode === 'dungeon'">{{ dungeonLabel(run.dungeonDefId) }} {{ run.dungeonWave + 1 }}/{{ store.dungeonDef(run.dungeonDefId).waves }}</span>
          <span v-else>{{ tr('B', 'Э') }}{{ run.floor }}{{ isBossFloor ? ` ${tr('BOSS', 'БОСС')}` : '' }}</span>
        </span>
        <span class="game-chip shrink-0"><span class="i-mdi-swap-horizontal-circle-outline" />{{ t('battle.round') }} {{ run.round }}</span>
      </div>

      <!-- 右侧：自动战斗状态 + 技能 + 倍速 + 暂停 + 药水（固定靠右，避免抖动） -->
      <div class="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <!-- 自动战斗状态 -->
        <span v-if="run.status === 'fighting' && !paused" class="hidden items-center gap-1.5 text-red-300 sm:flex">
          <span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />{{ t('battle.autoFighting') }}
        </span>
        <span v-else-if="run.status === 'fighting'" class="text-amber-300">{{ t('battle.paused') }}</span>

        <!-- 主动技能 -->
        <button
          class="skill-btn"
          :class="{ 'skill-ready': skillReady, 'skill-cooldown': skillCd > 0 }"
          :disabled="!skillReady"
          :title="`${skillLabel(activeSkill)}：${skillDesc(activeSkill)}`"
          @click="store.castSkill()"
        >
          <span :class="activeSkill.icon" class="text-16px" />
          <span class="hidden text-11px font-semibold sm:inline">{{ skillLabel(activeSkill) }}</span>
          <span class="inline-block w-3 text-center text-11px font-bold text-red-300">{{ skillCd > 0 ? skillCd : '' }}</span>
        </button>

        <!-- 倍速（下拉选择） -->
        <div class="speed-select-wrap">
          <span class="i-mdi-play-speed text-14px" />
          <GameSelect
            v-model="speed"
            :options="speedOptions"
            aria-label="Battle speed"
            placement="top"
          />
        </div>

        <button class="icon-mini" @click="paused = !paused">
          <span :class="paused ? 'i-mdi-play' : 'i-mdi-pause'" />
        </button>
      </div>
    </div>

    <!-- ===== 底部功能导航 ===== -->
    <nav class="safe-bottom flex min-h-14 shrink-0 items-stretch justify-around border-t border-white/10 bg-[#0e141b] shadow-[0_-8px_22px_rgb(0_0_0/0.2)]">
      <button
        v-for="n in navs"
        :key="n.key"
        class="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-white/60 transition active:bg-white/10 hover:bg-white/5 hover:text-white"
        @click="openPanel(n.key)"
      >
        <span :class="n.icon" class="text-20px sm:text-22px" />
        <span class="text-10px sm:text-11px">{{ t(n.label) }}</span>
        <span
          v-if="n.key === 'quest' && claimable"
          class="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0e141b]"
        />
      </button>
    </nav>

    <!-- ===== 功能面板 ===== -->
    <BagPanel v-if="store.activePanel.value === 'bag'" @close="store.activePanel.value = ''" />
    <ShopPanel v-else-if="store.activePanel.value === 'shop'" @close="store.activePanel.value = ''" />
    <PetPanel v-else-if="store.activePanel.value === 'pet'" @close="store.activePanel.value = ''" />
    <DungeonPanel v-else-if="store.activePanel.value === 'dungeon'" @close="store.activePanel.value = ''" />
    <QuestPanel v-else-if="store.activePanel.value === 'quest'" @close="store.activePanel.value = ''" />

    <!-- ===== Roguelike 祝福三选一 ===== -->
    <Teleport to="body">
      <div v-if="run.status === 'boon'" class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-6">
        <h2 class="mb-1 text-24px font-black text-white">{{ t('battle.boonTitle') }}</h2>
        <p class="mb-4 text-13px text-white/50">{{ t('battle.boonSubtitle') }}</p>
        <div class="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            v-for="id in run.boonOffer"
            :key="id"
            class="group flex flex-col items-center rounded-2xl border border-purple-400/30 bg-purple-500/10 p-6 transition-all hover:scale-105 hover:border-purple-400 hover:bg-purple-500/20"
            @click="store.chooseBoon(id)"
          >
            <span :class="getBoon(id).icon" class="mb-3 text-44px text-purple-300 transition-transform group-hover:scale-110" />
            <span class="mb-1 text-18px font-bold text-white">{{ tx(`boon.${id}`, getBoon(id).name) }}</span>
            <span class="text-13px text-purple-200/80">{{ tx(`boon.${id}.desc`, getBoon(id).desc) }}</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- ===== 层间奖励：副本 + 塔 ===== -->
    <Teleport to="body">
      <div v-if="run.status === 'waveClear'" class="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
        <div class="panel-in w-full max-w-sm rounded-2xl border border-white/10 bg-[#161e29] p-6 text-center">
          <div class="mb-1 text-18px font-bold text-primary">{{ t('battle.victory') }}</div>
          <template v-if="run.mode === 'dungeon'">
            <div class="mb-4 text-12px text-white/50">{{ t('battle.waves') }} {{ run.dungeonWave + 1 }}/{{ store.dungeonDef(run.dungeonDefId).waves }}</div>
            <button class="game-btn w-full py-2" @click="store.nextDungeonWave()">
              {{ t('common.next') }} <span class="i-mdi-arrow-right" />
            </button>
          </template>
          <template v-else>
            <div v-if="run.lastReward" class="mb-4 space-y-1 text-13px text-white/75">
              <div>+{{ run.lastReward.gold }} {{ tr('gold', 'золота') }}</div>
              <div v-if="run.lastReward.copyOf">{{ tr(`${dragonName(run.lastReward.copyOf)} copy +1`, `${dragonName(run.lastReward.copyOf)}: копия +1`) }}</div>
              <div v-if="run.lastReward.extraCopy" class="text-amber-200">{{ tr(`${dragonName(run.lastReward.extraCopy)} also answered the summon`, `${dragonName(run.lastReward.extraCopy)} тоже откликнулся`) }}</div>
              <div v-if="leadBond" class="text-white/50">{{ tr(`Lv${leadBond.rank} · ${leadBond.copies} copies spare`, `Ур.${leadBond.rank} · копий в запасе: ${leadBond.copies}`) }}</div>
            </div>
            <button
              v-if="leadBond && leadBond.rank < 10"
              class="game-btn-ghost mb-2 w-full py-2"
              :disabled="leadBond.copies < leadNeed"
              @click="raiseLead"
            >
              {{ tr(`Raise to Lv${leadBond.rank + 1} · ${leadBond.copies}/${leadNeed}`, `Поднять до ур.${leadBond.rank + 1} · ${leadBond.copies}/${leadNeed}`) }}
            </button>
            <button class="game-btn w-full py-2" @click="goNextFloor">
              {{ run.floor >= store.TOWER_MAX_FLOOR ? tr('Finish Tower', 'Завершить башню') : tr('Next battle', 'Следующий бой') }}
              <span class="i-mdi-arrow-right" />
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- ===== 副本通关 ===== -->
    <Teleport to="body">
      <div v-if="run.status === 'dungeonClear'" class="fixed inset-0 z-[55] flex items-center justify-center bg-black/75">
        <div class="panel-in w-80 rounded-2xl border border-yellow-400/30 bg-[#161e29] p-6 text-center">
          <span class="i-mdi-trophy-award mb-2 text-48px text-yellow-400" />
          <div class="mb-3 text-20px font-black text-yellow-300">{{ t('battle.dungeonClear') }}</div>
          <div v-if="run.lastReward" class="mb-4 space-y-1 text-13px text-white/70">
            <div>+{{ run.lastReward.gold }} {{ t('common.gold') }}</div>
            <div>+{{ run.lastReward.exp }} {{ tr('EXP', 'опыта') }}</div>
            <div v-if="run.lastReward.stone">+{{ run.lastReward.stone }} {{ t('common.stone') }}</div>
            <div v-if="run.lastReward.egg" class="text-pink-300"><span class="i-mdi-egg-outline mr-1" />{{ t('pet.egg') }} x1</div>
          </div>
          <button class="game-btn w-full py-2" @click="store.exitToTower()">{{ t('common.back') }}</button>
        </div>
      </div>
    </Teleport>

    <!-- ===== 失败结算 ===== -->
    <Teleport to="body">
      <div v-if="run.status === 'runOver' || run.status === 'dungeonLost'" class="fixed inset-0 z-[55] flex items-center justify-center bg-black/80">
        <div class="panel-in w-80 rounded-2xl border border-red-400/30 bg-[#1b1416] p-6 text-center">
          <span class="i-mdi-emoticon-dead-outline mb-2 text-48px text-red-400" />
          <div class="mb-1 text-20px font-black text-red-300">
            {{ run.status === 'runOver' ? t('battle.runOver') : t('battle.defeat') }}
          </div>
          <div class="mb-4 text-13px text-white/55">
            <template v-if="run.status === 'runOver'">
              {{ t('battle.reachedFloor') }}：{{ run.floor }} <span class="text-white/35">/</span> {{ t('common.gold') }} +{{ run.goldGained }}
            </template>
            <template v-else>{{ dungeonLabel(run.dungeonDefId) }}</template>
          </div>
          <div class="space-y-2">
            <button v-if="run.status === 'runOver'" class="game-btn w-full py-2" @click="store.startRun()">
              <span class="i-mdi-restart mr-1" />{{ t('battle.restartRun') }}
            </button>
            <button class="game-btn-ghost w-full py-2" @click="run.status === 'dungeonLost' ? store.exitToTower() : goHome()">
              {{ run.status === 'dungeonLost' ? t('common.back') : t('common.back') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useGlobalState } from '@/store'
import { getBoon } from '@/game/data/boons'
import { getHero } from '@/game/data/heroes'
import { CANON_DRAGONS, copiesToNext } from '@/game/data/dragons'
import { tr, tx, localizeLog } from '@/locales/text'
import TopBar from '@/components/TopBar.vue'
import UnitCard from '@/components/UnitCard.vue'
import BagPanel from '@/components/BagPanel.vue'
import ShopPanel from '@/components/ShopPanel.vue'
import PetPanel from '@/components/PetPanel.vue'
import DungeonPanel from '@/components/DungeonPanel.vue'
import QuestPanel from '@/components/QuestPanel.vue'
import ZoneTag from '@/components/ZoneTag.vue'
import GameSelect from '@/components/GameSelect.vue'

const { t } = useI18n()
const router = useRouter()
const store = useGlobalState()
const { run } = store
const pf = store.profile

const paused = ref(false)
const speed = ref(1)

const SPEEDS = [1, 3, 5, 8, 10, 15]
const speedOptions = SPEEDS.map(value => ({ label: `${value}x`, value }))

onMounted(() => {
  if (!store.hasSave.value) {
    router.replace('/')
    return
  }
  if (!run.started || run.status === 'idle') {
    // 刷新页面：若存档中保存了层数（>1），则恢复；否则从第 1 层开始
    const savedFloor = pf.value!.runFloor ?? 1
    if (savedFloor > 1)
      store.continueRun()
    else
      store.startRun()
  }
})

// 自动战斗心跳（倍速控制间隔）
const baseInterval = 520
useIntervalFn(() => {
  if (run.status !== 'fighting' || paused.value || store.interactionPaused.value || store.activePanel.value)
    return
  // 技能就绪时自动释放
  const hero = run.units.find(u => u.side === 'hero')
  if (hero && (!hero.skillCd || hero.skillCd <= 0))
    store.castSkill()
  store.battleTick()
}, () => Math.max(60, Math.round(baseInterval / speed.value)))

function goNextFloor() {
  store.nextTowerFloor()
}
function raiseLead() {
  if (!pf.value)
    return
  store.raiseBond(pf.value.heroId)
}

function onVisibilityChange() {
  if (document.hidden)
    paused.value = true
}
onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))

const enemies = computed(() => run.units.filter(u => u.side === 'enemy'))
const allies = computed(() => run.units.filter(u => u.side !== 'enemy'))
const isBossFloor = computed(() => run.floor % 5 === 0)
const claimable = computed(() => store.claimableCount() > 0)

// 主动技能
const activeSkill = computed(() => getHero(pf.value!.heroId).active)
const skillCd = computed(() => {
  const hero = run.units.find(u => u.side === 'hero')
  return hero?.skillCd ?? 0
})
const skillReady = computed(() =>
  run.status === 'fighting'
  && !paused.value
  && !store.interactionPaused.value
  && !store.activePanel.value
  && skillCd.value <= 0,
)

const leadBond = computed(() => pf.value ? pf.value.bonds?.[pf.value.heroId] : undefined)
const leadNeed = computed(() => copiesToNext(leadBond.value?.rank ?? 1))
function dragonName(id: string) {
  return CANON_DRAGONS.find(d => d.id === id)?.name ?? 'Dragon'
}
function dungeonLabel(id: string) {
  const def = store.dungeonDef(id)
  return tx(`dungeon.${def.id}`, def.name)
}
function skillLabel(skill: { name: string }) {
  const id = pf.value?.heroId
  return id ? tx(`hero.${id}.active`, skill.name) : skill.name
}
function skillDesc(skill: { desc: string }) {
  const id = pf.value?.heroId
  return id ? tx(`hero.${id}.activeDesc`, skill.desc) : skill.desc
}

const moreOpen = ref(false)
const navs = computed(() => {
  const flight = { key: 'pet', icon: 'i-mdi-fire', label: 'nav.pet' }
  const summon = { key: 'summon', icon: 'i-mdi-plus', label: 'nav.summon' }
  const more = { key: 'more', icon: 'i-mdi-chevron-down', label: 'nav.more' }
  const rest = [
    { key: 'bag', icon: 'i-mdi-bag-personal-outline', label: 'nav.bag' },
    { key: 'shop', icon: 'i-mdi-store-outline', label: 'nav.shop' },
    { key: 'dungeon', icon: 'i-mdi-treasure-chest-outline', label: 'nav.dungeon' },
    { key: 'quest', icon: 'i-mdi-clipboard-list-outline', label: 'nav.quest' },
  ]
  return moreOpen.value ? [flight, ...rest, more] : [flight, summon, more]
})

function goHome() {
  router.push('/')
}

async function openPanel(key: string) {
  if (key === 'summon') {
    const ok = await store.confirm(
      tr(
        `Spend ${store.SUMMON_COST} gold: unlock one of the six dragons or gain +1 copy. While species remain locked, there is a 70% chance to draw from the locked pool.`,
        `Потратить ${store.SUMMON_COST} золота: открыть одного из шести драконов или получить +1 копию. Пока есть закрытые виды, шанс выбора из них — 70%.`,
      ),
      tr('Summon dragon', 'Призвать дракона'),
    )
    if (ok)
      store.summonDragon()
    return
  }
  if (key === 'more') {
    moreOpen.value = !moreOpen.value
    return
  }
  store.activePanel.value = key as typeof store.activePanel.value
}
</script>

<style scoped>
.icon-mini {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 6px;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  color: rgb(255 255 255 / 65%);
  transition: transform 160ms ease, background-color 160ms ease, color 160ms ease;
}
.icon-mini:hover {
  background: rgb(255 255 255 / 10%);
  color: white;
}
.icon-mini:active { transform: translateY(1px) scale(.96); }

/* 倍速选择器 */
.speed-select-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 6px;
  padding: 1px 4px 1px 6px;
  background: rgb(255 255 255 / 6%);
  color: rgb(255 255 255 / 70%);
}

/* 主动技能按钮 */
.skill-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 6px;
  padding: 4px 10px;
  min-height: 44px;
  border: 1px solid transparent;
  transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  will-change: transform;
}
.skill-btn.skill-ready {
  border-color: #fbbf24;
  background: rgb(251 191 36 / 15%);
  color: #fde68a;
  box-shadow: 0 0 6px rgb(251 191 36 / 35%);
}
.skill-btn.skill-ready:hover {
  background: rgb(251 191 36 / 28%);
  transform: scale(1.04);
}
.skill-btn.skill-cooldown {
  background: rgb(255 255 255 / 6%);
  color: rgb(255 255 255 / 40%);
  cursor: not-allowed;
}
.skill-btn:disabled {
  opacity: 0.55;
}

@media (max-width: 420px) {
  .battle-toolbar { font-size: 11px; }
  .speed-select-wrap { padding-inline: 3px; }
  .skill-btn { padding-inline: 5px; }
  .skill-btn .text-11px { display: none; }
}
</style>
