import { createMatch } from './match.js?v=5c6e62ac7cc8';
export const ENCOUNTERS = [
  ['Ember Nest', 'cinder', 1], ['Bloom Trail', 'sylvara', 1], ['Lava Crossing', 'vorathion', 2],
  ['Golden Gate', 'aurion', 3], ['Ash Canyon', 'cinder', 4], ['Living Woods', 'sylvara', 5],
  ['Molten Ridge', 'vorathion', 6], ['Sun Citadel', 'aurion', 7], ['Flame Summit', 'cinder', 8],
  ['Aurion · Sun Sovereign', 'aurion', 10],
].map(([name, family, level], index) => ({ name, family, level, boss: index === 9 }));
export function campaignTeam(profile) {
  return profile.team.map(id => ({ id, rune: profile.cards[id].rune, level: profile.cards[id].level, ...(id === profile.starter ? { nickname: profile.name } : {}) }));
}
export const DIFFICULTY = [
  [.72, .7], [.8, .75], [.85, .8], [.95, .85], [1, .9], [1.05, .95], [1.1, 1], [1, .9], [1.1, 1], [1, .85],
];
export function campaignMatch(profile, index, mode, seed, difficulty = DIFFICULTY) {
  const encounter = ENCOUNTERS[index]; if (!encounter) throw Error('Unknown encounter');
  let state = seed >>> 0; const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const pool = ['vorathion', 'sylvara', 'cinder', 'aurion'].filter(id => id !== encounter.family);
  const first = Math.floor(random() * 3), second = (first + 1 + Math.floor(random() * 2)) % 3;
  const enemyTeam = [encounter.family, pool[first], pool[second]].map((id, i) => ({ id, rune: id === 'aurion' ? 'ward' : ['fury', 'life', 'ward'][Math.floor(random() * 3)], level: Math.max(1, encounter.level - (i ? 1 : 0)) }));
  const [hp, attack] = difficulty[index], variation = .84 + random() * .32;
  return createMatch(mode, seed, campaignTeam(profile), { enemyTeam, enemyHP: hp * variation, enemyAttack: attack * variation });
}
export function recordCampaign(profile, index, won, seconds) {
  const p = structuredClone(profile);
  if (index < 0 || index > p.campaign.cleared || !ENCOUNTERS[index]) return p;
  p.campaign.attempts++; p.campaign.seconds += Math.max(0, Math.min(3600, Math.round(seconds) || 0));
  if (won && index === p.campaign.cleared) p.campaign.cleared++;
  return p;
}
