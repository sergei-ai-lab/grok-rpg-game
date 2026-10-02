import type { BagItem } from '../types'
import { getConsumableDef, getEquipDef, getMaterialDef } from '../data/catalog'
import { equipStats } from './stats'
import { tx } from '@/locales/text'

export function itemName(item: BagItem): string {
  if (item.kind === 'equip')
    return tx(`item.${item.defId}`, getEquipDef(item.defId).name)
  if (item.kind === 'consumable')
    return tx(`item.${item.defId}`, getConsumableDef(item.defId)?.name ?? 'Consumable')
  return tx(`item.${item.defId}`, getMaterialDef(item.defId).name)
}

export function itemIcon(item: BagItem): string {
  if (item.kind === 'equip') {
    const slot = getEquipDef(item.defId).slot
    return slot === 'weapon' ? 'i-mdi-sword' : slot === 'armor' ? 'i-mdi-shield' : 'i-mdi-diamond-outline'
  }
  if (item.kind === 'consumable')
    return getConsumableDef(item.defId)?.icon ?? 'i-mdi-bottle-outline'
  return getMaterialDef(item.defId).icon
}

export function itemDesc(item: BagItem): string {
  if (item.kind === 'equip') {
    const s = equipStats(item)
    const parts: string[] = []
    if (s.hp)
      parts.push(`HP +${s.hp}`)
    if (s.atk)
      parts.push(`ATK +${s.atk}`)
    if (s.def)
      parts.push(`DEF +${s.def}`)
    if (s.spd)
      parts.push(`SPD +${s.spd}`)
    return parts.join('  ')
  }
  if (item.kind === 'consumable')
    return getConsumableDef(item.defId)?.desc ?? ''
  return tx(`item.${item.defId}.desc`, getMaterialDef(item.defId).desc)
}

export function itemSlot(item: BagItem): string {
  if (item.kind !== 'equip')
    return ''
  return getEquipDef(item.defId).slot
}
