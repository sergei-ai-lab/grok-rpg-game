import { createMatch } from './match.js';
export const ENCOUNTERS = [
  ['Ember Nest', 'cinder', 1], ['Bloom Trail', 'sylvara', 1], ['Lava Crossing', 'vorathion', 2],
  ['Golden Gate', 'aurion', 3], ['Ash Canyon', 'cinder', 4], ['Living Woods', 'sylvara', 5],
  ['Molten Ridge', 'vorathion', 6], ['Sun Citadel', 'aurion', 7], ['Flame Summit', 'cinder', 8],
  ['Aurion · Sun Sovereign', 'aurion', 10],
].map(([name, family, level], index) => ({ name, family, level, boss: index === 9 }));
export function campaignTeam(profile) {
  return profile.team.map(id => ({ id, rune: profile.cards[id].rune, level: profile.cards[id].level, ...(id === profile.starter ? { nickname: profile.name } : {}) }));
}
export function campaignMatch(profile, index, mode, seed) {
  const encounter = ENCOUNTERS[index]; if (!encounter) throw Error('Unknown encounter');
  const pool = ['vorathion', 'sylvara', 'cinder', 'aurion'].filter(id => id !== encounter.family);
  const allies = [pool[(seed >>> 0) % 3], pool[((seed >>> 0) + 1) % 3]];
  const enemyTeam = [encounter.family, ...allies].map((id, i) => ({ id, rune: id === 'aurion' ? 'ward' : ['fury', 'life', 'ward'][((seed + i) >>> 0) % 3] || 'fury', level: Math.max(1, encounter.level - (i ? 1 : 0)) }));
  return createMatch(mode, seed, campaignTeam(profile), { enemyTeam, enemyHP: index < 3 ? .72 : 1, enemyAttack: index < 3 ? .7 : 1 });
}
export function recordCampaign(profile, index, won, seconds) {
  const p = structuredClone(profile);
  if (index < 0 || index > p.campaign.cleared || !ENCOUNTERS[index]) return p;
  p.campaign.attempts++; p.campaign.seconds += Math.max(0, Math.min(3600, Math.round(seconds) || 0));
  if (won && index === p.campaign.cleared) p.campaign.cleared++;
  return p;
}
