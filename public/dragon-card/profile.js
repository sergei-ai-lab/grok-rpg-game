import { DRAGONS, stageForLevel } from './match.js?v=2349f3449164';
export const FAMILIES = ['vorathion', 'aurion', 'sylvara', 'cinder'];
export const STARTERS = ['vorathion', 'sylvara', 'cinder'];
export const PROFILE_KEY = 'dragon-journey-v1';
const count = value => Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0;
const nameFor = id => DRAGONS.find(d => d.id === id)?.name || 'Dragon';
export function newProfile() {
  return { version: 1, starter: null, name: '', team: [], cards: Object.fromEntries(FAMILIES.map(id => [id, { level: 1, xp: 0, copies: 0, owned: false, rune: id === 'aurion' ? 'ward' : id === 'sylvara' ? 'life' : 'fury' }])), wins: 0, battles: 0, campaign: { cleared: 0, attempts: 0, seconds: 0 }, daily: { date: '', played: 0, claws: 0, wins: 0, claimed: false }, seenResults: [] };
}
export function adoptProfile(id, name) {
  if (!STARTERS.includes(id)) throw Error('Choose a starter');
  const p = newProfile(); p.starter = id;
  p.name = String(name || nameFor(id)).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20) || nameFor(id);
  for (const family of STARTERS) p.cards[family].owned = true;
  p.team = [id, ...STARTERS.filter(family => family !== id)];
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
    if (Array.isArray(raw.team)) p.team = [...new Set(raw.team)].filter(id => FAMILIES.includes(id) && p.cards[id].owned).slice(0, 3);
    p.campaign = { cleared: Math.min(10, count(raw.campaign?.cleared)), attempts: count(raw.campaign?.attempts), seconds: count(raw.campaign?.seconds) };
    if (typeof raw.daily?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.daily.date)) p.daily = { date: raw.daily.date, played: Math.min(2, count(raw.daily.played)), claws: Math.min(3, count(raw.daily.claws)), wins: Math.min(1, count(raw.daily.wins)), claimed: raw.daily.claimed === true };
    p.seenResults = Array.isArray(raw.seenResults) ? raw.seenResults.filter(id => typeof id === 'string').slice(-50) : [];
    return p;
  } catch { return newProfile(); }
}
export function saveProfile(p, storage) {
  try { storage.setItem(PROFILE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
export function upgradeCost(profile, id) {
  const card = profile.cards[id];
  if (!card?.owned || card.level >= 10) return null;
  return { xp: 20 + (card.level - 1) * 5, copies: card.level < 5 ? 1 : card.level < 9 ? 2 : 3 };
}
export function canUpgrade(profile, id) { const cost = upgradeCost(profile, id), c = profile.cards[id]; return !!cost && c.xp >= cost.xp && c.copies >= cost.copies; }
export function upgradeDragon(profile, id) {
  if (!canUpgrade(profile, id)) return null;
  const p = structuredClone(profile), cost = upgradeCost(p, id), c = p.cards[id], before = stageForLevel(c.level);
  c.xp -= cost.xp; c.copies -= cost.copies; c.level++;
  return { profile: p, evolved: stageForLevel(c.level) !== before, stage: stageForLevel(c.level), id };
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
