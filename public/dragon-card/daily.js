import { FAMILIES } from './profile.js?v=2349f3449164';
export const QUESTS = [
  { id: 'played', name: 'Play 2 battles', goal: 2 },
  { id: 'claws', name: 'Use Claw 3 times', goal: 3 },
  { id: 'wins', name: 'Win a battle', goal: 1 },
];
export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function refreshDaily(profile, day = localDay()) {
  if (profile.daily?.date === day) return profile;
  const p = structuredClone(profile); p.daily = { date: day, played: 0, claws: 0, wins: 0, claimed: false }; return p;
}
export function awardDaily(profile, won, claws, day = localDay()) {
  const p = structuredClone(refreshDaily(profile, day));
  p.daily.played = Math.min(2, p.daily.played + 1); p.daily.wins = Math.min(1, p.daily.wins + (won ? 1 : 0));
  p.daily.claws = Math.min(3, p.daily.claws + Math.max(0, Math.floor(claws) || 0)); return p;
}
export function chestReady(profile, day = localDay()) {
  const d = refreshDaily(profile, day).daily; return !d.claimed && QUESTS.every(q => d[q.id] >= q.goal);
}
export function claimChest(profile, day = localDay()) {
  if (!chestReady(profile, day)) return null;
  const p = structuredClone(profile); p.daily.claimed = true;
  for (const id of FAMILIES) if (p.cards[id].owned) { p.cards[id].xp += 50; p.cards[id].copies += id === p.starter ? 3 : 1; }
  return { profile: p, xp: 50, copies: 3 };
}
