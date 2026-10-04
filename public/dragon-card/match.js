export const DRAGONS = [
  { id: 'vorathion', name: 'Vorathion', hp: 150, damage: 25, guard: 0, art: 'vorathion', skill: 'Tyrant Flame' },
  { id: 'aurion', name: 'Aurion', hp: 185, damage: 18, guard: 4, art: 'aurion', skill: 'Golden Aegis' },
  { id: 'sylvara', name: 'Sylvara', hp: 140, damage: 27, guard: 0, art: 'sylvara', skill: 'Bloomguard' },
  { id: 'nyx', name: 'Nyx', hp: 160, damage: 22, guard: 2, art: 'vorathion', skill: 'Eclipse Maw' },
  { id: 'cinder', name: 'Cinder', hp: 145, damage: 26, guard: 0, art: 'cinder', skill: 'Cinder Storm' },
  { id: 'glacier', name: 'Glacier', hp: 175, damage: 19, guard: 4, art: 'aurion', skill: 'Glacier Fall' },
  { id: 'volt', name: 'Volt', hp: 145, damage: 25, guard: 1, art: 'sylvara', skill: 'Arc Flash' },
  { id: 'umbra', name: 'Umbra', hp: 155, damage: 23, guard: 2, art: 'vorathion', skill: 'Shadow Breath' },
  { id: 'obsidian', name: 'Obsidian', hp: 180, damage: 20, guard: 3, art: 'aurion', skill: 'Obsidian Crush' },
  { id: 'solaris', name: 'Solaris', hp: 155, damage: 24, guard: 1, art: 'cinder', skill: 'Solar Flare' },
];
export const RUNES = {
  fury: { name: 'Fury', role: 'Striker', hp: -10, damage: 8, guard: 0, heal: 0 },
  ward: { name: 'Ward', role: 'Tank', hp: 30, damage: -6, guard: 5, heal: 0 },
  life: { name: 'Life', role: 'Sustain', hp: 10, damage: -4, guard: 0, heal: 8 },
};
export const ATTACKS = { strike: { name: 'Claw', cost: 0, bonus: 0 }, power: { name: 'Breath', cost: 2, bonus: 18 }, burst: { name: 'Ultimate', cost: 3, bonus: 36 } };
export const ABILITIES = {
  vorathion: ['Molten Breath · Breath +6 damage', 'Tyrant Flame · Ultimate +12 damage'],
  aurion: ['Golden Aegis · +3 block', 'Golden Heart · Claw heals 8 HP'],
  sylvara: ['Bloomguard · Breath heals 12 HP', 'Living Grove · attacks heal reserves 8 HP'],
  cinder: ['Flare Claw · Claw gives +2 resource', 'Flame Heart · Breath refunds 1 resource'],
};
export const stageForLevel = level => level >= 10 ? 3 : level >= 5 ? 2 : 1;
function random(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function dragon(id, rune, uid, level = 1) {
  const base = DRAGONS.find(d => d.id === id), r = RUNES[rune];
  if (!base || !r) throw new Error('Unknown dragon or rune');
  level = Math.max(1, Math.min(10, Number.isFinite(level) ? Math.floor(level) : 1)); const stage = stageForLevel(level), hp = base.hp + r.hp + (level - 1) * 7;
  return { ...base, uid, rune, level, stage, hp, maxHp: hp, damage: base.damage + r.damage + (level - 1) * 2, guard: base.guard + r.guard + (base.art === 'aurion' && stage >= 2 ? 3 : 0), heal: r.heal, energy: 0, fused: false };
}
export const previewDragon = (id, rune, level = 1) => dragon(id, rune, 'preview', level);
export const attackResourceGain = (a, type) => type === 'strike' ? a.art === 'cinder' && a.stage >= 2 ? 2 : 1 : a.art === 'cinder' && a.stage >= 3 && type === 'power' ? 1 : 0;
export function createMatch(mode = 'charge', seed = Date.now(), team = DRAGONS.slice(0, 5).map((d, i) => ({ id: d.id, rune: ['fury', 'ward', 'life'][i % 3] })), options = {}) {
  if (!['charge', 'energy'].includes(mode) || team.length < 3 || team.length > 5 || new Set(team.map(d => d.id)).size !== team.length) throw new Error('Choose three to five different dragons and a resource mode');
  const rng = random(seed), enemies = DRAGONS.filter(d => !options.pool || options.pool.includes(d.id));
  for (let i = enemies.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [enemies[i], enemies[j]] = [enemies[j], enemies[i]]; }
  const make = (loadout, side) => {
    const cards = loadout.map((d, i) => ({ ...dragon(d.id, d.rune, `${side}-${i}`, d.level), ...(d.nickname ? { name: String(d.nickname).slice(0, 20) } : {}) }));
    return { field: cards.slice(0, 3), hand: cards.slice(3), charge: 1, kos: 0, attached: false, switched: false, fusionUsed: false };
  };
  const match = { mode, seed, players: [make(team, 0), make(options.enemyTeam || enemies.slice(0, team.length).map((d, i) => ({ id: d.id, rune: ['ward', 'life', 'fury'][i % 3] })), 1)], actor: 0, turn: 1, winner: null, log: [], actions: 0 };
  beginTurn(match);
  return match;
}
function beginTurn(m) {
  const p = m.players[m.actor]; p.attached = false; p.switched = false;
  if (m.mode === 'charge') p.charge = Math.min(4, p.charge + 1);
}
export function resource(m, side = m.actor, card = m.players[side].field[0]) { return m.mode === 'charge' ? m.players[side].charge : card?.energy || 0; }
function spend(m, amount) { const p = m.players[m.actor]; if (m.mode === 'charge') p.charge -= amount; else p.field[0].energy -= amount; }
export function attackDamage(attacker, defender, type) {
  const evolved = attacker.art === 'vorathion' ? type === 'power' && attacker.stage >= 2 ? 6 : type === 'burst' && attacker.stage >= 3 ? 12 : 0 : 0;
  return Math.max(5, attacker.damage + ATTACKS[type].bonus + evolved - defender.guard);
}
export function legalActions(m) {
  if (m.winner !== null) return [];
  const p = m.players[m.actor], a = p.field[0], actions = [];
  if (m.mode === 'energy' && !p.attached) p.field.forEach((d, index) => { if (d.energy < 4) actions.push({ type: 'attach', index }); });
  if (p.field.length < 4) p.hand.forEach((_, index) => actions.push({ type: 'deploy', index }));
  p.field.slice(1).forEach((b, i) => {
    const index = i + 1;
    if (!p.switched && resource(m) >= 1) actions.push({ type: 'switch', index });
    if (!p.fusionUsed && (m.mode === 'charge' ? p.charge : a.energy + b.energy) >= 2) actions.push({ type: 'fuse', index });
  });
  for (const [attack, spec] of Object.entries(ATTACKS)) if (resource(m) >= spec.cost) actions.push({ type: 'attack', attack });
  return actions;
}
function note(m, message) { m.log.push(message); m.log = m.log.slice(-12); }
export function act(m, action) {
  const legal = legalActions(m).some(a => a.type === action.type && a.index === action.index && a.attack === action.attack);
  if (!legal) return false;
  const p = m.players[m.actor], enemy = m.players[1 - m.actor], a = p.field[0]; m.actions++;
  if (action.type === 'attach') {
    p.field[action.index].energy++; p.attached = true;
    note(m, `${p.field[action.index].name} gains 1 Energy.`);
  } else if (action.type === 'deploy') {
    const [card] = p.hand.splice(action.index, 1); p.field.push(card); note(m, `${card.name} joins the bench.`);
  } else if (action.type === 'switch') {
    spend(m, 1); [p.field[0], p.field[action.index]] = [p.field[action.index], a]; p.switched = true;
    note(m, `${p.field[0].name} takes the front. Switch costs 1.`);
  } else if (action.type === 'fuse') {
    const [b] = p.field.splice(action.index, 1);
    if (m.mode === 'energy') a.energy = Math.min(4, a.energy + b.energy - 2); else spend(m, 2);
    a.name = `${a.name} + ${b.name}`; a.maxHp += 35; a.hp += 35; a.damage += 12; a.guard += 2; a.fused = true; p.fusionUsed = true;
    note(m, `Fusion: ${a.name}. +35 HP, +12 damage. ${b.name} consumed.`);
  } else if (action.type === 'attack') {
    const target = enemy.field[0], spec = ATTACKS[action.attack], damage = attackDamage(a, target, action.attack);
    spend(m, spec.cost); target.hp = Math.max(0, target.hp - damage); a.hp = Math.min(a.maxHp, a.hp + a.heal);
    const healing = (a.art === 'aurion' && a.stage >= 3 && action.attack === 'strike' ? 8 : 0) + (a.art === 'sylvara' && a.stage >= 2 && action.attack === 'power' ? 12 : 0);
    a.hp = Math.min(a.maxHp, a.hp + healing);
    if (a.art === 'sylvara' && a.stage >= 3) for (const reserve of p.field.slice(1)) reserve.hp = Math.min(reserve.maxHp, reserve.hp + 8);
    const gain = attackResourceGain(a, action.attack);
    if (m.mode === 'charge') p.charge = Math.min(4, p.charge + gain); else a.energy = Math.min(4, a.energy + gain);
    note(m, `${a.name}: ${action.attack === 'burst' ? a.skill : spec.name} hits ${target.name} for ${damage}.${a.heal ? ` Heals ${a.heal} HP.` : ''}`);
    if (target.hp === 0) {
      enemy.field.shift(); p.kos++; note(m, `${target.name} defeated. ${m.actor === 0 ? 'You' : 'AI'}: ${p.kos}/3.`);
      if (!enemy.field.length && enemy.hand.length) enemy.field.push(enemy.hand.shift());
      if (p.kos >= 3 || !enemy.field.length) { m.winner = m.actor; return true; }
      note(m, `${enemy.field[0].name} takes the front.`);
    }
    m.actor = 1 - m.actor; m.turn++; beginTurn(m);
  }
  return true;
}
export function chooseAI(m) {
  const actions = legalActions(m), p = m.players[m.actor], a = p.field[0], target = m.players[1 - m.actor].field[0];
  const deploy = actions.find(x => x.type === 'deploy'); if (deploy) return deploy;
  const attach = actions.filter(x => x.type === 'attach');
  if (attach.length) return attach.find(x => x.index === 0) || attach[0];
  const fusion = actions.find(x => x.type === 'fuse');
  if (fusion && (a.hp < a.maxHp * .65 || (m.seed + m.actor) % 3 === 0)) return fusion;
  const swap = actions.filter(x => x.type === 'switch').find(x => p.field[x.index].hp > a.hp + 45);
  if (swap && a.hp < 45) return swap;
  const attacks = actions.filter(x => x.type === 'attack');
  return attacks.find(x => attackDamage(a, target, x.attack) >= target.hp) || attacks.at(-1);
}
