import type { BoonDef } from '../types'

// 数值（hp/atk/def/spd）为百分比加成
export const BOONS: BoonDef[] = [
  { id: 'atk', name: 'War Cry', desc: 'Attack +18%', icon: 'i-mdi-sword-cross', apply: { hp: 0, atk: 18, def: 0, spd: 0 } },
  { id: 'hp', name: 'Bulwark', desc: 'Max HP +22%', icon: 'i-mdi-heart-outline', apply: { hp: 22, atk: 0, def: 0, spd: 0 } },
  { id: 'def', name: 'Ironhide', desc: 'Defense +30%', icon: 'i-mdi-shield-crown-outline', apply: { hp: 0, atk: 0, def: 30, spd: 0 } },
  { id: 'spd', name: 'Gale', desc: 'Speed +20%', icon: 'i-mdi-weather-windy', apply: { hp: 0, atk: 0, def: 0, spd: 20 } },
  { id: 'crit', name: 'Lethal', desc: 'Crit +15%', icon: 'i-mdi-crosshairs-gps', apply: { hp: 0, atk: 0, def: 0, spd: 0, crit: 0.15 } },
  { id: 'ls', name: 'Bloodthirst', desc: 'Gain 12% lifesteal', icon: 'i-mdi-water-plus-outline', apply: { hp: 0, atk: 0, def: 0, spd: 0, lifesteal: 0.12 } },
  { id: 'double', name: 'Twin Strike', desc: '20% chance to hit twice', icon: 'i-mdi-flash-outline', apply: { hp: 0, atk: 0, def: 0, spd: 0, doubleHit: 0.2 } },
  { id: 'regen', name: 'Mend', desc: 'Regenerate 4% HP each turn', icon: 'i-mdi-heart-plus-outline', apply: { hp: 0, atk: 0, def: 0, spd: 0, regen: 0.04 } },
  { id: 'pet', name: 'Flightlord', desc: 'Flight stats +25%', icon: 'i-mdi-paw', apply: { hp: 0, atk: 0, def: 0, spd: 0, petBonus: 25 } },
  { id: 'gold', name: 'Greed', desc: 'Gold +40%', icon: 'i-mdi-cash-multiple', apply: { hp: 0, atk: 0, def: 0, spd: 0, goldBonus: 40 } },
  { id: 'drop', name: 'Fortune', desc: 'Drop rate +15%', icon: 'i-mdi-clover', apply: { hp: 0, atk: 0, def: 0, spd: 0, dropBonus: 15 } },
]

export function getBoon(id: string): BoonDef {
  return BOONS.find(b => b.id === id) ?? BOONS[0]
}
