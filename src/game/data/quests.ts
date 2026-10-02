import type { QuestDef } from '../types'

export const QUESTS: QuestDef[] = [
  // 日常
  {
    id: 'daily_battle', name: 'Hunt', desc: 'Finish 5 auto-battles', target: 5, event: 'battle', daily: true,
    rewards: { gold: 120, exp: 60, stone: 2 },
  },
  {
    id: 'daily_enhance', name: 'Forge Apprentice', desc: 'Enhance gear once', target: 1, event: 'enhance', daily: true,
    rewards: { gold: 80, stone: 1 },
  },
  {
    id: 'daily_buy', name: 'Patron', desc: 'Buy 2 things from the market', target: 2, event: 'shopBuy', daily: true,
    rewards: { gold: 100, exp: 50 },
  },
  {
    id: 'daily_dungeon', name: 'Realm Walker', desc: 'Clear any realm once', target: 1, event: 'dungeonClear', daily: true,
    rewards: { gold: 200, stone: 2, exp: 120 },
  },
  // 成就
  {
    id: 'ach_floor10', name: 'First Ascent', desc: 'Reach tower floor 10', target: 10, event: 'floor', daily: false,
    rewards: { gold: 500, soul: 5 },
  },
  {
    id: 'ach_floor20', name: 'Tower Breaker', desc: 'Reach tower floor 20', target: 20, event: 'floor', daily: false,
    rewards: { gold: 1500, soul: 15, stone: 10 },
  },
  {
    id: 'ach_pets3', name: 'Small Flight', desc: 'Own 3 dragons at once', target: 3, event: 'petGain', daily: false,
    rewards: { gold: 600, exp: 200 },
  },
  {
    id: 'ach_epic', name: 'Epic Armament', desc: 'Equip an epic or better item', target: 1, event: 'equipEpic', daily: false,
    rewards: { gold: 800, soul: 8 },
  },
  {
    id: 'ach_level10', name: 'Blooded', desc: 'Reach dragon level 10', target: 10, event: 'level', daily: false,
    rewards: { gold: 1000, stone: 8 },
  },
  {
    id: 'ach_recycle', name: 'Salvage Cycle', desc: 'Salvage 10 items', target: 10, event: 'recycle', daily: false,
    rewards: { gold: 300, soul: 20 },
  },
  {
    id: 'ach_floor50', name: 'Climber', desc: 'Reach tower floor 50', target: 50, event: 'floor', daily: false,
    rewards: { gold: 5000, soul: 30, stone: 20 },
  },
  {
    id: 'ach_floor100', name: 'Hundred Floors', desc: 'Reach tower floor 100', target: 100, event: 'floor', daily: false,
    rewards: { gold: 15000, soul: 80, stone: 50 },
  },
  {
    id: 'ach_floor200', name: 'Tower Lord', desc: 'Reach tower floor 200', target: 200, event: 'floor', daily: false,
    rewards: { gold: 50000, soul: 200, stone: 120 },
  },
  {
    id: 'ach_floor500', name: 'Apex', desc: 'Reach tower floor 500', target: 500, event: 'floor', daily: false,
    rewards: { gold: 200000, soul: 500, stone: 300 },
  },
  {
    id: 'ach_floor1000', name: 'Thousandfold', desc: 'Reach tower floor 1000', target: 1000, event: 'floor', daily: false,
    rewards: { gold: 1000000, soul: 1500, stone: 800 },
  },
  {
    id: 'ach_level30', name: 'Rising', desc: 'Reach dragon level 30', target: 30, event: 'level', daily: false,
    rewards: { gold: 3000, stone: 15 },
  },
  {
    id: 'ach_level50', name: 'Veteran', desc: 'Reach dragon level 50', target: 50, event: 'level', daily: false,
    rewards: { gold: 8000, soul: 30, stone: 30 },
  },
  {
    id: 'ach_level100', name: 'Warlord', desc: 'Reach dragon level 100', target: 100, event: 'level', daily: false,
    rewards: { gold: 30000, soul: 100, stone: 80 },
  },
  {
    id: 'ach_dungeon5', name: 'Realm Regular', desc: 'Clear realms 5 times', target: 5, event: 'dungeonClear', daily: false,
    rewards: { gold: 1500, stone: 10 },
  },
  {
    id: 'ach_dungeon20', name: 'Realm Master', desc: 'Clear realms 20 times', target: 20, event: 'dungeonClear', daily: false,
    rewards: { gold: 8000, soul: 40 },
  },
  {
    id: 'ach_pets5', name: 'Hoard Keeper', desc: 'Own 5 dragons at once', target: 5, event: 'petGain', daily: false,
    rewards: { gold: 1500, exp: 500 },
  },
  {
    id: 'ach_shop10', name: 'Market Hand', desc: 'Buy 10 things from the market', target: 10, event: 'shopBuy', daily: false,
    rewards: { gold: 1000, stone: 5 },
  },
]

export const DAILY_QUESTS = QUESTS.filter(q => q.daily)
export const ACHIEVEMENTS = QUESTS.filter(q => !q.daily)
