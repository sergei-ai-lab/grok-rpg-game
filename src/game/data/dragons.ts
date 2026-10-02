/** Canon DragonVerse species. Sprites are temporary CC0 tile stand-ins. */
export interface CanonDragon {
  id: string
  name: string
  /** Filename stem inside src/assets/monster (CC0 Dungeon Crawl tiles). */
  sprite: string
  element: string
}

export const CANON_DRAGONS: CanonDragon[] = [
  { id: 'vorathion', name: 'Vorathion', sprite: '火龙神兽', element: 'Fire' },
  { id: 'kaelith', name: 'Kaelith', sprite: '冰霜巨龙', element: 'Frost' },
  { id: 'verdraxis', name: 'Verdraxis', sprite: '风暴龙', element: 'Storm' },
  { id: 'nyxarion', name: 'Nyxarion', sprite: '龙的影子', element: 'Void' },
  { id: 'aurion', name: 'Aurion', sprite: '圣龙', element: 'Light' },
  { id: 'umbraxis', name: 'Umbraxis', sprite: '黑底龙', element: 'Shadow' },
]

/** Copies required to leave this rank. Rank 10 needs nothing. */
const COPIES_TO_NEXT = [0, 1, 2, 2, 3, 3, 4, 4, 5, 6]

export const BOND_MAX = 10

export function canonById(id: string): CanonDragon | undefined {
  return CANON_DRAGONS.find(d => d.id === id)
}

export function speciesFromName(name: string): string | undefined {
  return CANON_DRAGONS.find(d => d.id === name || d.name === name || d.sprite === name)?.id
}

export function copiesToNext(rank: number): number {
  if (rank < 1 || rank >= BOND_MAX)
    return 0
  return COPIES_TO_NEXT[rank] ?? 0
}
