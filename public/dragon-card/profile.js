import { DRAGONS } from './match.js';
export const FAMILIES = ['vorathion', 'aurion', 'sylvara', 'cinder'];
export const STARTERS = ['vorathion', 'sylvara', 'cinder'];
export const PROFILE_KEY = 'dragon-journey-v1';
const count = value => Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0;
const nameFor = id => DRAGONS.find(d => d.id === id)?.name || 'Dragon';
export function newProfile() {
  return { version: 1, starter: null, name: '', cards: Object.fromEntries(FAMILIES.map(id => [id, { level: 1, xp: 0, copies: 0, owned: false, rune: id === 'aurion' ? 'ward' : id === 'sylvara' ? 'life' : 'fury' }])), wins: 0, battles: 0, seenResults: [] };
}
export function adoptProfile(id, name) {
  if (!STARTERS.includes(id)) throw Error('Choose a starter');
  const p = newProfile(); p.starter = id;
  p.name = String(name || nameFor(id)).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20) || nameFor(id);
  for (const family of STARTERS) p.cards[family].owned = true;
  return p;
}
export function loadProfile(storage) {
  try {
    const raw = JSON.parse(storage.getItem(PROFILE_KEY));
    if (raw?.version !== 1 || !STARTERS.includes(raw.starter)) return newProfile();
    const p = adoptProfile(raw.starter, raw.name); p.wins = count(raw.wins); p.battles = count(raw.battles);
    for (const id of FAMILIES) {
      const c = raw.cards?.[id]; if (!c) continue;
      p.cards[id] = { ...p.cards[id], level: Math.max(1, Math.min(10, count(c.level))), xp: count(c.xp), copies: count(c.copies), owned: STARTERS.includes(id) || c.owned === true, rune: ['fury', 'ward', 'life'].includes(c.rune) ? c.rune : p.cards[id].rune };
    }
    p.seenResults = Array.isArray(raw.seenResults) ? raw.seenResults.filter(id => typeof id === 'string').slice(-50) : [];
    return p;
  } catch { return newProfile(); }
}
export function saveProfile(p, storage) {
  try { storage.setItem(PROFILE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
export function awardBattle(profile, battleId, won) {
  if (!profile.starter || !battleId || profile.seenResults.includes(battleId)) return { profile, reward: null };
  const p = structuredClone(profile), xp = won ? 60 : 15;
  p.battles++; if (won) p.wins++;
  for (const id of FAMILIES) if (p.cards[id].owned) {
    p.cards[id].xp += xp;
    if (won) p.cards[id].copies += id === p.starter ? 2 : 1;
  }
  const unlocked = won && p.wins >= 3 && !p.cards.aurion.owned;
  if (unlocked) p.cards.aurion.owned = true;
  p.seenResults = [...p.seenResults, battleId].slice(-50);
  return { profile: p, reward: { xp, copies: won ? 2 : 0, unlocked: unlocked ? 'Aurion' : null } };
}
