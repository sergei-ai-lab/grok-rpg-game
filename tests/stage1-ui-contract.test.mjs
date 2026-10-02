import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Stage 1 UI: reward and boon choices never auto-advance', async () => {
  const battle = await source('src/views/BattleView.vue')
  assert.equal(battle.includes('setTimeout(goNextFloor'), false)
  assert.equal(battle.includes('boonTimer'), false)
  assert.equal(battle.includes('Auto-pick in'), false)
  assert.ok(battle.includes('@click="goNextFloor"'))
  assert.ok(battle.includes('@click="store.chooseBoon(id)"'))
})

test('Stage 1 UI: misleading spend paths are hidden', async () => {
  const [quest, dungeon, top, pets, shop] = await Promise.all([
    source('src/components/QuestPanel.vue'),
    source('src/components/DungeonPanel.vue'),
    source('src/components/TopBar.vue'),
    source('src/components/PetPanel.vue'),
    source('src/components/ShopPanel.vue'),
  ])
  assert.equal(quest.includes('@click="store.refreshDaily()"'), false)
  assert.equal(dungeon.includes('@click="store.sweepDungeon'), false)
  assert.equal(top.includes('@click="store.buyStamina()'), false)
  assert.equal(pets.includes('@click="store.upgradePetRarity'), false)
  assert.ok(shop.includes("filter(entry => entry.slot.kind !== 'pet')"))
})

test('Stage 1 UI: summon spend requires explicit confirmation and Home identifies the build', async () => {
  const [battle, home, confirm] = await Promise.all([
    source('src/views/BattleView.vue'),
    source('src/views/HomeView.vue'),
    source('src/components/ConfirmDialog.vue'),
  ])
  assert.ok(battle.includes('await store.confirm('))
  assert.ok(battle.includes('store.SUMMON_COST'))
  assert.ok(home.includes('BUILD STAGE 1'))
  assert.equal(confirm.includes('autoConfirm'), false)
  assert.equal(confirm.includes('countdown }}s'), false)
})
