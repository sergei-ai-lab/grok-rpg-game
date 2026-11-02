import {
  HEROES, ENEMIES, MARKS, STATUS, levelMul,
  createBattle, beginTurn, act, aiChoose, usableSkills, legalTargets, previewOrder, round, stars, starFlags, starRules,
  side, allUnits, CHAPTERS, PER, rngOf, stageDef, STAGE_COUNT, RAR_MUL, RARITY, scaleSkill, runAuto, DIFFS, DIFF_ORDER,
} from './engine.mjs?v=1793605992';

// ======================= assets & data =======================
const FIG = (k) => `fig/${k}.webp`;
const CARD = (k) => `card/${k}.webp`;
const PTK = (k) => `pt/${k}.webp`;
const ASSET_URL = (p) => p;
const ANIM = (k) => `anim/${k}.webp`;
const ICON = (k) => `icon/${k}.webp`;
const PT_SET = new Set(["aur1", "aur2", "aur3", "cinder1", "cinder2", "cinder3", "drake", "drake2", "f_baby", "f_juv", "fire_big", "fire_front", "fire_roar2", "infernal", "moss_a", "moss_b", "moss_c", "pyro", "side_gray", "syl1", "syl2", "syl3", "syl_baby", "syl_fly", "syl_queen", "venom1", "venom_front", "vf1", "vf2", "vf3", "vf3x", "vf_atk", "vor1", "vor2", "vor3", "vorathion"]);
const ANIM_META = {"vf_atk": {"n": 34, "impact": 19, "fps": 8}, "vf_cast": {"n": 35, "impact": 11, "fps": 8}, "vf_ult": {"n": 39, "impact": 22, "fps": 8}, "vf_hit": {"n": 30, "impact": 1, "fps": 8}};
const app = document.getElementById('app');
// ---------- Telegram Mini App ----------
const TG = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp : null;
if (TG) {
  try {
    TG.ready(); TG.expand();
    TG.disableVerticalSwipes && TG.disableVerticalSwipes();
    TG.setHeaderColor && TG.setHeaderColor('#000000'); TG.setBackgroundColor && TG.setBackgroundColor('#000000');
    if (TG.isVersionAtLeast && TG.isVersionAtLeast('8.0') && TG.requestFullscreen) TG.requestFullscreen();
    TG.enableClosingConfirmation && TG.enableClosingConfirmation();
  } catch { /* old client */ }
}
const haptic = (kind) => { try { if (!TG || !TG.HapticFeedback) return; if (kind === 'ok') TG.HapticFeedback.notificationOccurred('success'); else TG.HapticFeedback.impactOccurred(kind); } catch { /* */ } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : String(Math.round(n)));

const RAR = { R: { label: 'RARE', color: '#4fa8ff', stars: 1 }, E: { label: 'EPIC', color: '#b46cff', stars: 2 }, L: { label: 'LEGENDARY', color: '#ffb43c', stars: 3 } };
const MARK_BG = { red: '#5a1a08', blue: '#0b2a4a', green: '#163d12', force: '#4a3a0a' };
const FX_COLOR = { red: ['#ff6a1f', '#ffd36b'], blue: ['#5fc8ff', '#e6f7ff'], green: ['#7dff4a', '#e6ffb0'], force: ['#ffd76a', '#fff6cf'] };
const BLUE = 'hue-rotate(185deg) saturate(1.3) brightness(1.2)';

// forms: Lv1 / Lv15 / Lv30 evolution art. face: where the art looks (L/R/C).
const VIS = {
  vorathion: { r: 'L', forms: ['vor1', 'vor2', 'vorathion'], face: ['L', 'R', 'R'], poses: { atk: 'vorathion_atk', cast: 'vorathion_cast', ult: 'vorathion_ult' }, fx: '#ff7a2f' },
  sylvara: { r: 'L', forms: ['syl_baby', 'syl_fly', 'syl_queen'], face: ['C', 'R', 'C'], fx: '#ffd76a' },
  stormcaller: { r: 'L', forms: ['vor2', 'vor3', 'fire_big'], face: ['R', 'R', 'L'], filter: 'hue-rotate(205deg) saturate(1.8) brightness(1.25)', fx: '#6fb8ff' },
  nyxar: { r: 'L', forms: ['vor1', 'drake', 'fire_front'], face: ['L', 'L', 'C'], filter: 'hue-rotate(255deg) saturate(1.5) brightness(1.15)', fx: '#c07bff' },
  cinderwing: { r: 'E', forms: ['f_baby', 'f_juv', 'pyro'], face: ['L', 'L', 'L'], card: [null, null, 'c_pyro'], fx: '#ff6a1f' },
  tidecoil: { r: 'L', forms: ['vf2', 'vf3', 'vf3x'], face: ['R', 'R', 'R'], anims: { atk: 'vf_atk', cast: 'vf_cast', ult: 'vf_ult', hit: 'vf_hit' }, idle: 'vf_idle', animScale: 1.3, icons: { basic: 'vf_basic', s1: 'vf_s1', s2: 'vf_s2', p: 'vf_p', p2: 'vf_p' }, card: ['c_vf1', 'c_vf2', 'c_vf3'], fx: '#8dff3a' },
  frostmaw: { r: 'E', forms: ['drake', 'drake2', 'fire_roar2'], face: ['L', 'L', 'R'], filter: BLUE, card: [null, null, 'c_ice'], fx: '#7fd8ff' },
  solgarde: { r: 'E', forms: ['aur1', 'aur3', 'side_gray'], face: ['R', 'L', 'L'], filter: 'sepia(1) saturate(2.4) hue-rotate(5deg) brightness(1.2)', fx: '#ffe28a' },
  aurion: { r: 'R', forms: ['aur1', 'aur2', 'moss_c'], face: ['R', 'L', 'L'], fx: '#a8ff5a' },
  emberfang: { r: 'R', forms: ['cinder1', 'cinder2', 'cinder3'], face: ['L', 'R', 'C'], fx: '#ff8a3c' },
  goldleaf: { r: 'R', forms: ['syl1', 'syl2', 'syl3'], face: ['C', 'R', 'C'], filter: 'saturate(1.25) brightness(1.1)', fx: '#ffd76a' },
  mossback: { r: 'R', forms: ['moss_a', 'moss_a', 'moss_b'], face: ['L', 'L', 'L'], scale: [0.85, 1, 1.05], fx: '#9dff5a' },
};
const EVIS = {
  whelp_fire: { fig: 'f_baby', face: 'L', scale: 0.72 }, whelp_shadow: { fig: 'vor1', face: 'L', scale: 0.75 },
  whelp_moss: { fig: 'aur1', face: 'R', scale: 0.78 }, whelp_gold: { fig: 'syl_baby', face: 'C', scale: 0.72 },
  whelp_frost: { fig: 'cinder1', face: 'L', scale: 0.72, filter: BLUE }, whelp_venom: { fig: 'venom1', face: 'L', scale: 0.8, filter: 'brightness(1.4) hue-rotate(20deg)' },
  drake_fire: { fig: 'drake2', face: 'L', scale: 0.9 },
  thornmother: { fig: 'moss_b', face: 'L', scale: 1.5, filter: 'saturate(1.5) brightness(1.1)' },
  colossus: { fig: 'fire_front', face: 'C', scale: 1.5, filter: 'grayscale(.85) contrast(1.25)' },
  tyrant: { fig: 'fire_big', face: 'L', scale: 1.55, filter: BLUE }, infernal: { fig: 'infernal', face: 'C', scale: 1.6, filter: 'brightness(1.25) contrast(1.1)' },
  cinderbrute: { fig: 'drake', face: 'L', scale: 1.45, filter: 'saturate(1.4) brightness(1.15) contrast(1.15)' },
  venomqueen: { fig: 'venom_front', face: 'C', scale: 1.6, filter: 'brightness(1.5) contrast(1.1)' },
};
const FORM_LV = [1, 15, 30];
const formOf = (lv) => (lv >= FORM_LV[2] ? 2 : lv >= FORM_LV[1] ? 1 : 0);
const capOf = (st, aw = 0) => 20 + st * 10 + aw * 10;
const starCost = (st) => st; // copies needed for next star
const lvCost = (lv) => ({ gold: 30 * lv + 20, ess: 12 + lv * 9 });



// ======================= save =======================
const KEY = 'dv-imr-v3';
const SAVE_VER = 3;
function fresh() {
  const heroes = {};
  for (const k of ['aurion', 'emberfang', 'cinderwing', 'goldleaf']) heroes[k] = { lv: 1, st: RAR[VIS[k].r].stars, copies: 0 };
  return { ver: SAVE_VER, ts: 0, gold: 2000, ess: 600, gems: 300, runes: 10, heroes, team: ['aurion', 'emberfang', 'cinderwing', 'goldleaf'], cleared: 0, stars: {}, idleAt: Date.now() - 2 * 3600e3, pulls: 0, mute: false, auto: false, speed: 1, seen: {}, gear: [], gearSeq: 1, chapters: {} };
}
function migrate(x) {
  x = { ...fresh(), ...x };
  if ((x.ver || 2) < 3) { // 8 stages per chapter -> 10
    const c = x.cleared || 0; x.cleared = Math.floor(c / 8) * 10 + (c % 8);
    const st = {}; for (const [k, v] of Object.entries(x.stars || {})) { const o = +k.slice(1); st['g' + (Math.floor(o / 8) * 10 + (o % 8))] = v; } x.stars = st;
    x.ver = 3;
  }
  for (const h of Object.values(x.heroes)) h.gear = h.gear || {};
  x.dung = x.dung || {}; x.arena = x.arena || { pts: 800, wins: 0, seed: 1 }; x.ach = x.ach || {};
  if (!x.arena.v2) { x.arena.pts = Math.max(800, x.arena.pts - 200); x.arena.v2 = 1; }
  x.arts = x.arts || []; x.dust = x.dust ?? 0; x.miles = x.miles || {};
  for (const h of Object.values(x.heroes)) h.art = h.art || {};
  x.clD = x.clD || {}; x.defense = x.defense || null; x.alog = x.alog || []; x.lastDef = x.lastDef || Date.now();
  x.tomes = x.tomes ?? 10; x.petLv = x.petLv || 1; x.eyes = x.eyes ?? 0;
  for (const h of Object.values(x.heroes)) { h.aw = h.aw || 0; h.sk = h.sk || { basic: 1, s1: 1, s2: 1, p: 1 }; h.ex = h.ex || 0; h.xp = h.xp || 0; }
  return x;
}
let S;
try { S = migrate(JSON.parse(localStorage.getItem(KEY)) || {}); } catch { S = migrate({}); }
let CLOUD = null; let cloudTimer = 0;
const save = () => {
  S.ts = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
  if (CLOUD) { clearTimeout(cloudTimer); cloudTimer = setTimeout(() => CLOUD.set({ save: JSON.stringify(S), ts: S.ts }).catch(() => {}), 600); }
  if (TG && TG.CloudStorage) { clearTimeout(save._t); save._t = setTimeout(tgSave, 1500); }
};
const TG_CHUNK = 3800;
function tgSave() {
  try {
    const s = JSON.stringify(S); const n = Math.ceil(s.length / TG_CHUNK);
    for (let i = 0; i < n; i++) TG.CloudStorage.setItem('dv' + i, s.slice(i * TG_CHUNK, (i + 1) * TG_CHUNK));
    TG.CloudStorage.setItem('dvmeta', JSON.stringify({ n, ts: S.ts }));
  } catch { /* */ }
}
function tgLoad() {
  if (!TG || !TG.CloudStorage || !TG.isVersionAtLeast || !TG.isVersionAtLeast('6.9')) return;
  TG.CloudStorage.getItem('dvmeta', (err, meta) => {
    if (err || !meta) { tgSave(); return; }
    let m; try { m = JSON.parse(meta); } catch { return; }
    if ((m.ts || 0) <= (S.ts || 0)) return;
    const keys = Array.from({ length: m.n }, (_, i) => 'dv' + i);
    TG.CloudStorage.getItems(keys, (e2, vals) => {
      if (e2 || !vals) return;
      try { S = migrate(JSON.parse(keys.map((k) => vals[k] || '').join(''))); localStorage.setItem(KEY, JSON.stringify(S)); toast('☁ Progress loaded'); if (!document.getElementById('bt')) home(); } catch { /* corrupt */ }
    });
  });
}
(async () => { // cloud save tied to the player's Claude account
  try {
    if (!window.claude || !window.claude.use) return;
    const db = await window.claude.use('db'); const user = await window.claude.use('user');
    if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    const ref = db.doc(`data/users/${id}/save3`);
    let snap = null; try { snap = await ref.get(); } catch { snap = null; }
    const data = snap && typeof snap.data === 'function' ? snap.data() : snap && snap.data !== undefined ? snap.data : snap;
    CLOUD = ref;
    if (data && data.save && (data.ts || 0) > (S.ts || 0)) { S = migrate(JSON.parse(data.save)); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* */ } toast('☁ Progress loaded'); if (!document.getElementById('bt')) home(); }
    else save();
  } catch { /* offline: local save only */ }
})();

// ======================= gear =======================
const SLOTS = { weapon: { ic: '🗡️', lb: 'Weapon', main: 'atk', base: { R: 40, E: 75, L: 125 } }, armor: { ic: '🛡️', lb: 'Armor', main: 'hp', base: { R: 450, E: 850, L: 1400 } },
  boots: { ic: '👢', lb: 'Boots', main: 'spd', base: { R: 12, E: 22, L: 35 } }, amulet: { ic: '📿', lb: 'Amulet', main: 'def', base: { R: 40, E: 75, L: 125 } } };
const SETS = {
  fury: { lb: 'Fury', col: '#ff5a3c', b2: { atkPct: 0.15 }, b4: { critDmg: 0.35 }, d2: '+15% ATK', d4: '+35% Crit DMG' },
  guard: { lb: 'Guardian', col: '#4fa8ff', b2: { hpPct: 0.2 }, b4: { defPct: 0.3 }, d2: '+20% HP', d4: '+30% DEF' },
  swift: { lb: 'Swift', col: '#5be37d', b2: { spdPct: 0.08 }, b4: { spdPct: 0.12 }, d2: '+8% SPD', d4: '+12% more SPD' },
  vamp: { lb: 'Vampire', col: '#c45cff', b2: { lifesteal: 0.1 }, b4: { lifesteal: 0.15, crit: 0.1 }, d2: '+10% Lifesteal', d4: '+15% Lifesteal, +10% Crit' },
};
const SUBS = [['atkPct', 'ATK', 0.06], ['hpPct', 'HP', 0.06], ['defPct', 'DEF', 0.08], ['crit', 'Crit', 0.05], ['critDmg', 'Crit DMG', 0.1]];
const GR = { R: 1, E: 1.6, L: 2.5 };
const gearMain = (it) => Math.round(SLOTS[it.slot].base[it.r] * (1 + (it.slot === 'boots' ? 0.07 : 0.15) * it.lv));
const gearCost = (it) => Math.round(250 * (it.lv + 1) * GR[it.r]);
function makeGear(r, chapter, slot) {
  const sets = chapter === 0 ? ['fury', 'swift'] : chapter === 1 ? ['vamp', 'guard'] : Object.keys(SETS);
  const sub = SUBS[Math.floor(Math.random() * SUBS.length)];
  return { id: S.gearSeq++, slot: slot || Object.keys(SLOTS)[Math.floor(Math.random() * 4)], set: sets[Math.floor(Math.random() * sets.length)], r, lv: 0, sub: [sub[0], +(sub[2] * GR[r]).toFixed(3)] };
}
const gearById = (id) => S.gear.find((x) => x.id === id);
const ownerOf = (id) => Object.keys(S.heroes).find((k) => Object.values(S.heroes[k].gear || {}).includes(id));
function gearBonus(k) {
  const h = H(k); const b = {}; const add = (key, v) => { b[key] = (b[key] || 0) + v; };
  const cnt = {};
  for (const id of Object.values(h.gear || {})) { const it = gearById(id); if (!it) continue; add(SLOTS[it.slot].main, gearMain(it)); add(it.sub[0], it.sub[1] * (1 + 0.1 * it.lv)); cnt[it.set] = (cnt[it.set] || 0) + 1; }
  for (const [s, n] of Object.entries(cnt)) { if (n >= 2) for (const [kk, v] of Object.entries(SETS[s].b2)) add(kk, v); if (n >= 4) for (const [kk, v] of Object.entries(SETS[s].b4)) add(kk, v); }
  for (const id of Object.values(h.art || {})) { const a = artById(id); if (!a || !artFits(k, a)) continue; add(ART_BASE[a.slot][a.type][0], artVal(a)); }
  b.sets = cnt; return b;
}
const ART_SLOTS = { cls: { lb: 'Class', ic: '🏺' }, mark: { lb: 'Mark', ic: '🔮' }, fac: { lb: 'Faction', ic: '📯' } };
const ART_BASE = { cls: { Attack: ['atkPct', 0.08], Defense: ['defPct', 0.1], Support: ['hpPct', 0.1] }, mark: { red: ['critDmg', 0.1], blue: ['spdPct', 0.04], green: ['hpPct', 0.08], force: ['crit', 0.05] }, fac: { ember: ['atkPct', 0.08], verdant: ['hpPct', 0.1], storm: ['spdPct', 0.04], radiant: ['defPct', 0.1] } };
const ART_NAMES = { cls: { Attack: 'Warblade Relic', Defense: 'Bulwark Relic', Support: 'Sage Relic' }, mark: { red: 'Ember Orb', blue: 'Frost Orb', green: 'Wild Orb', force: 'Star Orb' }, fac: { ember: 'Ember Banner', verdant: 'Verdant Banner', storm: 'Storm Banner', radiant: 'Radiant Banner' } };
const ART_R = { R: 1, E: 1.7, L: 2.8 };
function makeArtifact(r, slot) {
  const opts = Object.keys(ART_BASE[slot]); const type = opts[Math.floor(Math.random() * opts.length)];
  return { id: S.gearSeq++, slot, type, r, lv: 0 };
}
const artVal = (a) => ART_BASE[a.slot][a.type][1] * ART_R[a.r] * (1 + 0.12 * a.lv) * (a.lv >= 10 ? 1.3 : a.lv >= 5 ? 1.15 : 1);
const artFits = (k, a) => a.slot === 'cls' ? classOfRole(HEROES[k].role) === a.type : a.slot === 'mark' ? HEROES[k].mark === a.type : factionOf(k) === a.type;
const artCost = (a) => ({ gold: Math.round(3000 * (a.lv + 1) * ART_R[a.r]), dust: Math.round(10 * (a.lv + 1) * ART_R[a.r]) });
const artById = (id) => S.arts.find((x) => x.id === id);
const artOwner = (id) => Object.keys(S.heroes).find((k) => Object.values(S.heroes[k].art || {}).includes(id));
const gearLabel = (key, v) => ({ atk: `ATK +${v}`, hp: `HP +${v}`, spd: `SPD +${v}`, def: `DEF +${v}` })[key] || `${(SUBS.find((s) => s[0] === key) || [0, key])[1]} +${Math.round(v * 100)}%`;
function daily() {
  const day = new Date().toDateString();
  if (!S.daily || S.daily.day !== day) { S.daily = { day, c: {}, claimed: {} }; S.keys = Math.max(S.keys || 0, 6); S.tickets = Math.max(S.tickets || 0, 6); }
  return S.daily;
}
const bump = (k, n = 1) => { const d = daily(); d.c[k] = (d.c[k] || 0) + n; };
const FACTIONS = {
  ember: { lb: 'Ember Clan', ic: '🔥', col: '#ff6a3c', m: ['vorathion', 'cinderwing', 'emberfang'], b2: { atkPct: 0.1 }, b3: { atkPct: 0.2, critDmg: 0.2 }, d: 'ATK +10% / +20% & Crit DMG +20%' },
  verdant: { lb: 'Verdant Circle', ic: '🌿', col: '#5be37d', m: ['sylvara', 'aurion', 'mossback'], b2: { hpPct: 0.12 }, b3: { hpPct: 0.25, defPct: 0.1 }, d: 'HP +12% / +25% & DEF +10%' },
  storm: { lb: 'Storm Court', ic: '⚡', col: '#58b6ff', m: ['stormcaller', 'frostmaw', 'tidecoil'], b2: { spdPct: 0.06 }, b3: { spdPct: 0.12, crit: 0.1 }, d: 'SPD +6% / +12% & Crit +10%' },
  radiant: { lb: 'Radiant Order', ic: '☀️', col: '#ffd23a', m: ['goldleaf', 'solgarde', 'nyxar'], b2: { defPct: 0.12 }, b3: { defPct: 0.2, hpPct: 0.12 }, d: 'DEF +12% / +20% & HP +12%' },
};
const factionOf = (k) => Object.keys(FACTIONS).find((f) => FACTIONS[f].m.includes(k));
function factionBonus(team) {
  const cnt = {}; for (const k of team) { const f = factionOf(k); cnt[f] = (cnt[f] || 0) + 1; }
  const b = {}; const act = [];
  for (const [f, n] of Object.entries(cnt)) { if (n < 2) continue; act.push([f, n]); for (const [kk, v] of Object.entries(n >= 3 ? FACTIONS[f].b3 : FACTIONS[f].b2)) b[kk] = (b[kk] || 0) + v; }
  return { b, act };
}
const clr = (d = 'easy') => d === 'easy' ? S.cleared : (S.clD[d] || 0);
const setClr = (d, v) => { if (d === 'easy') S.cleared = v; else S.clD[d] = v; };
const diffOpen = (d, ch = 0) => { const i = DIFF_ORDER.indexOf(d); return i === 0 || clr(DIFF_ORDER[i - 1]) >= (ch + 1) * PER; };
let viewDiff = 'easy';
const owned = (k) => !!S.heroes[k];
const classOfRole = (role) => ({ Tank: 'Defense', Shielder: 'Defense', Bruiser: 'Defense', Healer: 'Support', Support: 'Support', Control: 'Support', Debuffer: 'Support', Breaker: 'Support' })[role] || 'Attack';
const H = (k) => { const h = S.heroes[k]; if (h && !h.art) h.art = {}; if (h && h.copies == null) h.copies = 0; if (h && !h.sk) { h.aw = h.aw || 0; h.sk = { basic: 1, s1: 1, s2: 1, p: 1 }; h.ex = h.ex || 0; h.xp = h.xp || 0; h.gear = h.gear || {}; } return h; };
function heroMul(k) { const h = H(k); return RAR_MUL[VIS[k].r] * (1 + 0.12 * (h.st - 1)) * (1 + 0.1 * (h.aw || 0)) * (1 + 0.08 * formOf(h.lv)) * (1 + 0.03 * (((h.sk || {}).p || 1) - 1)); }
function heroStats(k) {
  const t = HEROES[k], h = H(k) || { lv: 1, st: RAR[VIS[k].r].stars, gear: {} };
  const m = levelMul(h.lv) * (H(k) ? heroMul(k) : RAR_MUL[VIS[k].r]);
  const b = H(k) ? gearBonus(k) : {}; const su = (t.passive2 && t.passive2.statUp) || {};
  return { hp: Math.round(t.hp * m * (1 + (b.hpPct || 0)) + (b.hp || 0)), atk: Math.round(t.atk * m * (1 + (b.atkPct || 0)) + (b.atk || 0)), def: Math.round(t.def * m * (1 + (b.defPct || 0)) + (b.def || 0)),
    spd: Math.round((t.spd + (su.spd || 0)) * (1 + (b.spdPct || 0)) + (b.spd || 0)), crit: (t.crit ?? 0.15) + (su.crit || 0) + (b.crit || 0) };
}
const powerOf = (s) => Math.round((s.hp / 8 + s.atk * 3 + s.def * 1.5 + s.spd / 3) * (1 + (s.crit || 0)));
const heroPower = (k) => powerOf(heroStats(k));
function enemyPower(st) {
  if (st.power) return st.power;
  let p = 0;
  for (const w of st.waves) for (const k of w) { const t = ENEMIES[k]; const m = levelMul(st.level) * (st.mul || 1) * (k.startsWith('elite_') ? 0.9 : 1); p += powerOf({ hp: t.hp * m, atk: t.atk * m, def: t.def * m, spd: t.spd }); }
  return Math.round(p / st.waves.length);
}
const teamPower = () => S.team.filter(owned).reduce((a, k) => a + heroPower(k), 0);
function figOf(k, lv) { const v = VIS[k]; const f = formOf(lv); return { src: FIG(v.forms[f]), face: v.face[f], filter: v.filter || '', scale: (v.scale || [])[f] || 1 }; }
function cardArt(k, lv) { const v = VIS[k]; const c = v.card && v.card[formOf(lv)]; return c ? CARD(c) : null; }

// ======================= audio =======================
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
document.addEventListener('pointerdown', audio, { once: true });
function tone({ f = 200, f2 = f, d = 0.15, type = 'sine', v = 0.2, noise = false, delay = 0 }) {
  if (S.mute) return; const ac = AC; if (!ac) return;
  const t = ac.currentTime + delay; const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); g.connect(ac.destination);
  if (noise) {
    const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + d); s.connect(fl); fl.connect(g); s.start(t);
  } else { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d); o.connect(g); o.start(t); o.stop(t + d); }
}
const SFX = {
  win: () => { haptic('ok'); [523, 659, 784, 1046].forEach((f, i) => tone({ f, f2: f, d: 0.35, type: 'triangle', v: 0.15, delay: i * 0.12 })); },
  hit: () => { haptic('light'); tone({ f: 1800, f2: 200, d: 0.12, noise: true, v: 0.35 }); tone({ f: 140, f2: 60, d: 0.12, type: 'sine', v: 0.3 }); },
  crit: () => { haptic('heavy'); tone({ f: 3000, f2: 300, d: 0.2, noise: true, v: 0.45 }); tone({ f: 90, f2: 40, d: 0.25, type: 'square', v: 0.15 }); },
  whoosh: () => tone({ f: 600, f2: 3000, d: 0.18, noise: true, v: 0.18 }),
  heal: () => { tone({ f: 660, f2: 990, d: 0.25, type: 'triangle', v: 0.12 }); tone({ f: 990, f2: 1320, d: 0.3, type: 'triangle', v: 0.08, delay: 0.08 }); },
  ult: () => { tone({ f: 80, f2: 400, d: 0.6, type: 'sawtooth', v: 0.12 }); tone({ f: 4000, f2: 200, d: 0.7, noise: true, v: 0.25 }); },
  boom: () => { tone({ f: 900, f2: 60, d: 0.45, noise: true, v: 0.5 }); tone({ f: 60, f2: 30, d: 0.4, type: 'sine', v: 0.4 }); },
  click: () => tone({ f: 900, f2: 600, d: 0.05, type: 'square', v: 0.06 }),
  coin: () => { tone({ f: 1200, f2: 1250, d: 0.08, type: 'square', v: 0.07 }); tone({ f: 1800, f2: 1850, d: 0.12, type: 'square', v: 0.07, delay: 0.07 }); },
  lose: () => [392, 330, 262].forEach((f, i) => tone({ f, f2: f * 0.97, d: 0.4, type: 'sawtooth', v: 0.07, delay: i * 0.18 })),
  summon: () => { tone({ f: 100, f2: 1600, d: 1.2, type: 'sawtooth', v: 0.08 }); tone({ f: 200, f2: 6000, d: 1.3, noise: true, v: 0.15 }); },
  legend: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ f, f2: f, d: 0.6, type: 'triangle', v: 0.14, delay: i * 0.09 })),
};

// ======================= UI helpers =======================

// ======================= landscape fit =======================
const BASE_H = 390;
function fit() {
  let top = 0;
  if (TG) { const a = TG.safeAreaInset || {}, b = TG.contentSafeAreaInset || {}; top = (a.top || 0) + (b.top || 0); }
  app.style.top = top + 'px';
  const vw = window.innerWidth, vh = window.innerHeight - top;
  const portrait = vh > vw;
  const W = portrait ? vh : vw, Hh = portrait ? vw : vh;
  app.style.width = W + 'px'; app.style.height = Hh + 'px';
  app.style.transform = portrait ? `translateX(${vw}px) rotate(90deg)` : 'none';
  if (portrait && TG) app.style.top = '0px';
  app.style.setProperty('--fs', Math.max(9, Math.min(16, Hh / BASE_H * 13, W / 844 * 13)) + 'px');
}
window.addEventListener('resize', () => { fit(); });
if (TG && TG.onEvent) for (const ev of ['fullscreenChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged']) TG.onEvent(ev, () => fit());
fit();

// ======================= UI helpers =======================
const MARK_GLYPH = { red: '✸', blue: '◎', green: '▲', force: '✦' };
const mk = (m) => `<span class="mk ${m}">${MARK_GLYPH[m]}</span>`;
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; app.appendChild(d); setTimeout(() => d.remove(), 1900); }
function resBar(items = ['gold', 'ess', 'gems', 'runes']) {
  const I = { gold: ['🪙', S.gold], ess: ['🔮', S.ess], gems: ['💎', S.gems], runes: ['📜', S.runes], tomes: ['📘', S.tomes] };
  return `<div class="res">${items.map((k) => `<div class="p"><i>${I[k][0]}</i><b>${fmt(I[k][1])}</b><span class="pl">+</span></div>`).join('')}</div>`;
}
function navBtns(title = '', back = 'home') {
  return `<div class="navbtns"><button data-back="${back}">◄</button><button data-nav="home">🏰</button>${title ? `<span class="ttl t-outline">${title}</span>` : ''}</div>`;
}
function wire(root = app) {
  root.querySelectorAll('[data-nav]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); SFX.click(); go(b.dataset.nav); });
  root.querySelectorAll('[data-back]').forEach((b) => b.onclick = () => { SFX.click(); go(b.dataset.back); });
  root.querySelectorAll('[data-mute]').forEach((b) => b.onclick = () => { S.mute = !S.mute; save(); b.textContent = S.mute ? '🔇' : '🔊'; });
}
function go(id, arg) { ({ home, dragons, summon, team: () => formation(null), campaign, detail, dungeons, arena })[id](arg); }
const awStr = (a) => a ? `<span style="color:#d77bff;text-shadow:0 0 .3em #b04cff">${'★'.repeat(a)}</span>` : '';
const starStr = (n, max = 5) => '★'.repeat(n) + `<span style="opacity:.25">${'★'.repeat(Math.max(0, max - n))}</span>`;
// head-crop portrait from a full-body figure, IMR-style card
function photo(src, face, filter = '', full = false) {
  if (full) return `<div class="ph cover" style="background-image:url(${src});filter:${filter}"></div>`;
  const pos = face === 'L' ? '4% 6%' : face === 'R' ? '96% 6%' : '50% 2%';
  return `<div class="ph" style="background-image:url(${src});background-size:210%;background-position:${pos};filter:${filter}"></div>`;
}
function photoFig(key, face, filter = '') { return PT_SET.has(key) ? `<div class="ph cover" style="background-image:url(${PTK(key)});background-position:50% 40%;filter:${filter}"></div>` : photo(FIG(key), face, filter); }
function heroPhoto(k, lv) { const v = VIS[k]; const f = formOf(lv); return photoFig(v.forms[f], v.face[f], v.filter || ''); }
function pcard(k, { locked = false, extra = '', name = false, cls = '' } = {}) {
  const v = VIS[k], t = HEROES[k], h = H(k) || { lv: 1, st: RAR[v.r].stars };
  return `<div class="pc ${v.r} ${locked ? 'gray' : ''} ${cls}">${heroPhoto(k, h.lv)}${mk(t.mark)}${locked ? '' : `<span class="lv">${h.lv}</span><span class="st" style="${h.aw ? 'background:radial-gradient(#ff8ad6,#b0247a)' : ''}">${h.aw ? 'A' + h.aw : h.st}</span><span class="fac">${FACTIONS[factionOf(k)].ic}</span>`}${name ? `<span class="nm">${esc(t.name)}</span>` : ''}${extra}</div>`;
}
function unitCard(u) {
  const v = unitVis(u);
  return `<div class="pc ${u.boss ? 'L' : 'R'}">${v.key ? photoFig(v.key, v.face, v.filter) : photo(v.src, v.face, v.filter)}${mk(u.mark)}<span class="lv">${u.lv}</span></div>`;
}
function popup(html, onWire) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="pop panel"><button class="x">✕</button>${html}</div>`;
  (document.querySelector('.scr') || app).appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('.x').onclick = close;
  onWire && onWire(ov, close);
  return ov;
}

// ======================= HOME (city) =======================
function idleState() {
  const mins = Math.min(8 * 60, (Date.now() - S.idleAt) / 60000);
  const g = Math.max(0, S.cleared);
  return { mins, gold: Math.floor(mins * (12 + g * 6)), ess: Math.floor(mins * (4 + g * 1.6)) };
}
function home() {
  const leader = S.team.find(owned) || Object.keys(S.heroes)[0];
  const fg = figOf(leader, H(leader).lv);
  const idle = idleState();
  const st = stageDef(Math.min(S.cleared, STAGE_COUNT - 1));
  const B_ = [
    { x: 17, y: 30, ic: '✨', lb: 'Altar of Wishes', nav: 'summon', dot: S.runes > 0 },
    { x: 28, y: 56, ic: '🐉', lb: 'Dragon Lair', nav: 'dragons', dot: Object.keys(S.heroes).some(canUpgrade) },
    { x: 70, y: 56, ic: '⚔️', lb: 'War Camp', nav: 'team' },
    { x: 62, y: 28, ic: '🏟️', lb: 'Arena', nav: 'arena', dot: (daily(), S.tickets > 0) },
    { x: 38, y: 26, ic: '🗝️', lb: 'Dungeon Gates', nav: 'dungeons', dot: S.keys > 0 },
    { x: 50, y: 50, ic: '🐲', lb: 'Dragon Spirit', act: 'spirit' },
  ];
  app.innerHTML = `<div class="scr hub"><div class="bg" style="background-image:url(${CARD('bg_hub')})"></div><div class="vig"></div>
    <div class="leader" id="leader"><img src="${fg.src}" style="${fg.face === 'L' ? '' : 'transform:scaleX(-1);'}filter:${fg.filter} drop-shadow(0 0 1.5em rgba(255,140,40,.4))"></div>
    ${B_.map((b) => `<button class="bld ${b.lock ? 'lock' : ''}" style="left:${b.x}%;top:${b.y}%" ${b.nav ? `data-nav="${b.nav}"` : b.act ? `data-act="${b.act}"` : `data-lock="${b.lock}"`}><span class="ic">${b.ic}</span><span class="lb t-outline">${b.lb}</span>${b.dot ? '<span class="dot"></span>' : ''}</button>`).join('')}
    <div class="avatar"><div class="pic" style="background-image:url(${fg.src});background-position:${fg.face === 'L' ? '5% 8%' : '95% 8%'}"><b>${1 + Math.floor(S.cleared / 2)}</b></div><div class="pw t-outline">✊ ${fmt(teamPower())}</div></div>
    ${resBar(['gold', 'ess', 'gems'])}
    <div class="lcol"><button>💬</button><button>🔔</button><button data-mute>${S.mute ? '🔇' : '🔊'}</button></div>
    <div class="rgrid">
      <button id="daily"><span class="e"><span>🎁</span></span><small class="t-outline">Daily Login</small>${S.dailyDay !== new Date().toDateString() ? '<span class="dotr"></span>' : ''}</button>
      <button data-nav="summon"><span class="e"><span>📜</span></span><small class="t-outline">Summon</small>${S.runes ? '<span class="dotr"></span>' : ''}</button>
      <button data-nav="dragons"><span class="e"><span>⬆️</span></span><small class="t-outline">Level Up</small></button>
    </div>
    <div class="quest t-outline"><span class="sc">📜</span>${S.cleared >= STAGE_COUNT ? 'All chapters cleared!' : `Clear stage ${st.name}: ${esc(st.boss ? ENEMIES[st.boss].name : CHAPTERS[st.ch].name)}`}</div>
    <button class="idle ${idle.mins >= 10 ? 'full' : ''}" id="idle"><span class="ch">💰</span><span class="t-outline">${Math.floor(idle.mins / 60)}h ${Math.floor(idle.mins % 60)}m</span></button>
    <div class="botbar">
      <button class="bigl t-outline" data-nav="dungeons"><span class="em"><span>💀</span></span>Dungeon</button>
      <div class="icorow">
        <button data-nav="team"><span class="c">⚔️</span><span class="t-outline">Team</span></button>
        <button data-nav="dragons"><span class="c">🐉</span><span class="t-outline">Dragons</span></button>
        <button data-nav="summon"><span class="c">✨</span><span class="t-outline">Summon</span></button>
        <button id="tasks"><span class="c">📋</span><span class="t-outline">Tasks</span>${taskDot() ? '<span class="dotr"></span>' : ''}</button>
      </div>
      <button class="bigr t-outline" id="camp">Campaign<span class="em"><span>⚔</span></span></button>
    </div></div>`;
  wire();
  app.querySelectorAll('[data-lock]').forEach((b) => b.onclick = () => toast(b.dataset.lock));
  app.querySelectorAll('[data-act="spirit"]').forEach((b) => b.onclick = spirit);
  app.querySelector('#camp').onclick = () => { SFX.click(); campaign(); };
  app.querySelector('#leader').onclick = () => detail(leader);
  app.querySelector('#tasks').onclick = () => tasks();
  app.querySelector('#daily').onclick = dailyLogin;
  app.querySelector('#idle').onclick = () => {
    const s = idleState(); if (s.mins < 1) return toast('The chest is still empty');
    S.gold += s.gold; S.ess += s.ess; S.idleAt = Date.now(); save(); SFX.coin();
    popup(`<h3 class="serif">Idle Rewards</h3><div class="sep"></div><div style="color:var(--dim);margin-bottom:.6em">Your dragons hunted for ${Math.floor(s.mins / 60)}h ${Math.floor(s.mins % 60)}m (max 8h).</div>
      <div style="display:flex;gap:.6em;justify-content:center"><span class="itm">🪙<b>${fmt(s.gold)}</b></span><span class="itm pu">🔮<b>${fmt(s.ess)}</b></span></div>
      <div style="text-align:center;margin-top:1em"><button class="gold" id="ok">Collect</button></div>`, (ov, close) => { ov.querySelector('#ok').onclick = () => { close(); home(); }; });
  };
  if (!S.seen.intro) {
    S.seen.intro = 1; save();
    popup(`<h3 class="serif">Welcome, Dragon Keeper</h3><div class="sep"></div><p style="line-height:1.5;margin:.4em 0 1em">Collect dragons, evolve them through three forms and build a team of five to beat every boss.<br>You have <b style="color:var(--gold)">10 summon scrolls</b> — visit the Altar of Wishes first!</p>
      <div style="text-align:center"><button class="gold" id="go">✨ Summon now</button></div>`, (ov, close) => { ov.querySelector('#go').onclick = () => { close(); summon(); }; });
  }
}
function dailyLogin() {
  const today = new Date().toDateString(); const can = S.dailyDay !== today; const day = (S.dailyN || 0) % 7;
  const R = [['📜', 2, ''], ['🔮', 600, 'pu'], ['🪙', 3000, ''], ['💎', 100, 'bl'], ['📜', 3, ''], ['🔮', 1500, 'pu'], ['💎', 300, 'bl']];
  popup(`<h3 class="serif">Daily Login</h3><div style="color:var(--dim)">Log in every day for rewards!</div><div class="sep"></div>
    <div style="display:flex;gap:.5em">${R.map((r, i) => `<div style="text-align:center;padding:.4em;border-radius:.3em;background:${i === day && can ? 'rgba(255,200,80,.25)' : 'rgba(255,255,255,.05)'};border:1px solid ${i === day && can ? 'var(--gold)' : 'transparent'};opacity:${i < day || (i === day && !can) ? .4 : 1}"><div style="font-weight:900;font-size:.85em;margin-bottom:.3em">Day ${i + 1}</div><span class="itm ${r[2]}">${r[0]}<b>${fmt(r[1])}</b></span><div style="font-size:.8em;margin-top:.2em">${i < day || (i === day && !can) ? '✅' : i === day ? '' : '🔒'}</div></div>`).join('')}</div>
    <div style="text-align:center;margin-top:.8em"><button class="gold" id="cl" ${can ? '' : 'disabled'}>${can ? 'Claim' : 'Come back tomorrow'}</button></div>`, (ov, close) => {
    ov.querySelector('#cl').onclick = () => { const r = R[day]; const key = { '📜': 'runes', '🔮': 'ess', '🪙': 'gold', '💎': 'gems' }[r[0]]; S[key] += r[1]; S.dailyDay = today; S.dailyN = (S.dailyN || 0) + 1; save(); SFX.coin(); close(); home(); toast(`+${fmt(r[1])} ${r[0]}`); };
  });
}

// ======================= DRAGONS (collection) =======================
let collFilter = 'all';
function canUpgrade(k) { const h = H(k); if (!h) return false; if (h.copies >= starCost(h.st) && h.st < 5) return true; const c = lvCost(h.lv); return h.lv < capOf(h.st) && S.gold >= c.gold && S.ess >= c.ess; }
function dragons() {
  const all = Object.keys(VIS).filter((k) => collFilter === 'all' || HEROES[k].mark === collFilter);
  const mine = all.filter(owned).sort((a, b) => heroPower(b) - heroPower(a));
  const rest = all.filter((k) => !owned(k));
  const tabs = [['all', 'All Dragons'], ['red', '✸ Fire'], ['blue', '◎ Frost'], ['green', '▲ Wild'], ['force', '✦ Force']];
  app.innerHTML = `<div class="scr"><div class="coll"></div>${navBtns()}${resBar(['gold', 'ess'])}
    <div class="ctabs">${tabs.map(([id, lb]) => `<button data-f="${id}" class="${collFilter === id ? 'on' : ''}">${lb}</button>`).join('')}
      <div style="margin-top:1em;text-align:center;color:var(--dim);font-weight:800">${Object.keys(S.heroes).length}/${Object.keys(VIS).length} collected</div></div>
    <div class="cgrid">${mine.map((k) => `<button data-d="${k}">${pcard(k, { name: true, extra: canUpgrade(k) ? '<span class="dotr"></span>' : '' })}</button>`).join('')}
      ${rest.map((k) => `<button data-l="${k}">${pcard(k, { locked: true, name: true })}</button>`).join('')}</div></div>`;
  wire();
  app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { collFilter = b.dataset.f; dragons(); });
  app.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { SFX.click(); detail(b.dataset.d); });
  app.querySelectorAll('[data-l]').forEach((b) => b.onclick = () => toast(`Summon to unlock this ${RAR[VIS[b.dataset.l].r].label} dragon`));
}
const skillIcon = (sk) => sk.id === 'basic' ? '⚔️' : sk.heal ? '✚' : sk.shield ? '🛡️' : (sk.effects || []).some((e) => e.status === 'taunt') ? '🎯' : !sk.hits ? '⬆️'
  : (sk.effects || []).some((e) => ['stun', 'freeze'].includes(e.status)) ? '💫' : (sk.effects || []).some((e) => ['poison', 'burn'].includes(e.status)) ? '🔥' : sk.target === 'enemies' ? '💥' : '🗡️';
const skIco = (k, id, fallback) => { const ic = k && VIS[k] && VIS[k].icons && VIS[k].icons[id]; return ic ? `<img class="skimg" src="${ICON(ic)}">` : fallback; };
const skillDesc = (sk) => sk.desc || (sk.hits ? `Deals ${Math.round(sk.hits[0] * 100)}% ATK damage to ${sk.target === 'enemies' ? 'all enemies' : 'one enemy'}.` : '');
const skillKind = (sk) => sk.id === 'basic' ? 'Basic' : sk.id === 's1' ? `Skill · CD ${sk.cd}` : `Ultimate · CD ${sk.cd}`;
const SK_NAMES = { basic: 'Basic attack', s1: 'Active skill', s2: 'Active skill', p: 'Passive skill' };
const skCost = (lv) => ({ tomes: lv * 2, gold: 2000 * lv * lv });
function skillPopup(t, sk, second, k) {
  const h = k ? H(k) : null;
  const id = second ? 'p' : sk ? sk.id : 'p';
  const lv = h ? (h.sk[id] || 1) : 1;
  const name = second ? t.passive2.name : sk ? sk.name : t.passive.name;
  const desc = second ? t.passive2.desc : sk ? skillDesc(scaleSkill(sk, lv)) : t.passive.desc;
  const ic = skIco(k, second ? 'p2' : sk ? sk.id : 'p', second ? '✦' : sk ? skillIcon(sk) : '◈');
  const lines = id === 'p' || second ? [2, 3, 4, 5].map((l) => `Lv.${l}: all stats +3%`) : [2, 3, 4, 5].map((l) => l === 5 && sk.cd ? `Lv.5: power +10%, cooldown −1` : `Lv.${l}: skill power +10%`);
  const pid = second ? 'p' : id; const c = skCost(lv);
  popup(`<div class="skinfo" style="position:static;width:auto;margin:0;border:0;padding:0;background:none"><span class="si" style="background:radial-gradient(circle at 50% 30%,#d07a2a,#4a2008)"><b>${ic}</b><i>${lv}</i></span><span class="nm">${esc(name)}</span>
    <span class="tg"><span>${sk && !second ? (sk.id === 'basic' ? 'Basic attack' : 'Active skill') : 'Passive skill'}</span>${sk && !second && sk.cd ? `<span class="c">⟳ ${lv >= 5 ? Math.max(1, sk.cd - 1) : sk.cd}</span>` : ''}</span></div>
    <p style="margin:.6em 0;font-weight:700;color:#8fb2ff;line-height:1.4">${esc(desc)}</p><div class="sep"></div>
    ${lines.map((l, i) => `<div style="font-weight:800;font-size:.9em;opacity:${i + 2 <= lv ? 1 : .45}">${i + 2 <= lv ? '✅' : '▫️'} ${l}</div>`).join('')}
    ${h && !(second && false) ? `<div style="text-align:center;margin-top:.7em">${lv >= 5 ? '<b style="color:var(--gold)">MAX LEVEL</b>' : `<button class="gold" id="skup" ${S.tomes < c.tomes || S.gold < c.gold ? 'disabled' : ''}>Upgrade to Lv.${lv + 1} · 📘${c.tomes} 🪙${fmt(c.gold)}</button><div style="font-size:.8em;color:var(--dim);margin-top:.3em">You have 📘 ${S.tomes} skill tomes</div>`}</div>` : ''}`, (ov, close) => {
    ov.querySelector('#skup')?.addEventListener('click', () => { if (S.tomes < c.tomes || S.gold < c.gold) return; S.tomes -= c.tomes; S.gold -= c.gold; h.sk[pid] = lv + 1; bump('lvup'); save(); SFX.legend(); close(); detail(k); skillPopup(t, sk, second, k); });
  });
}
function detail(k) {
  if (!owned(k)) return;
  const v = VIS[k], t = HEROES[k], h = H(k), st = heroStats(k), cap = capOf(h.st, h.aw), f = formOf(h.lv); const F = FACTIONS[factionOf(k)];
  const awCost = { copies: 2, ess: 6000 * ((h.aw || 0) + 1) }; const exCost = { eyes: (h.ex || 0) + 1, gold: 20000 * ((h.ex || 0) + 1) };
  const fg = figOf(k, h.lv), c = lvCost(h.lv), need = starCost(h.st);
  const RT = { R: ['Rare', '#2e7fd1'], E: ['Epic', '#8a3fd8'], L: ['Legendary', '#d08a12'] }[v.r];
  app.innerHTML = `<div class="scr"><div class="temple">${[4, 16, 62, 74].map((x) => `<div class="col" style="left:${x}%"></div>`).join('')}</div><div class="dais"></div>
 <div class="hero3d"><img src="${formOf(h.lv) === 2 && v.idle ? ANIM(v.idle) : fg.src}" style="${fg.face === 'L' ? 'transform:scaleX(-1);' : ''}filter:${fg.filter} drop-shadow(0 0 1.2em rgba(0,0,0,.7))"></div>
    ${navBtns('', 'dragons')}${resBar(['gold', 'ess', 'tomes'])}
    <div class="droster">${Object.keys(S.heroes).sort((a, b) => heroPower(b) - heroPower(a)).map((kk) => `<button data-hk="${kk}">${pcard(kk, { cls: kk === k ? 'sel' : '' })}</button>`).join('')}</div>
    <div class="dpow t-outline">Power<b>${fmt(heroPower(k))}</b></div>
    <div class="hpanel">
      <div class="stars">${starStr(h.st)} ${awStr(h.aw)}</div>
      <h2 class="t-outline serif">${esc(t.name)}</h2>
      <div style="display:flex;align-items:center;gap:.5em"><span class="rtag" style="background:${RT[1]}">${RT[0]}</span>${mk(t.mark)}<span style="font-weight:800">${esc(t.role)}</span><span style="font-weight:800;color:${F.col}">${F.ic} ${F.lb}</span><span style="margin-left:auto;font-weight:900">✊ ${fmt(heroPower(k))}</span></div>
      <div style="font-weight:900;font-size:1.2em">Lv.${h.lv}/${cap}</div><div class="bar"><i style="width:${100 * h.lv / cap}%"></i></div>
      <div class="statl"><i>❤️</i><span>Health</span><span>${fmt(st.hp)}</span><i>🗡️</i><span>Attack</span><span>${st.atk}</span><i>🛡️</i><span>Defense</span><span>${st.def}</span><i>💨</i><span>Speed</span><span>${st.spd}</span></div>
      <div class="skc">${t.skills.map((sk, i) => `<button data-sk="${i}" class="${sk.id === 's2' ? 'ult' : ''}">${skIco(k, sk.id, skillIcon(sk))}<span class="sl">${h.sk[sk.id] || 1}</span></button>`).join('')}<button data-sk="p">${skIco(k, 'p', '◈')}<span class="p">P</span><span class="sl">${h.sk.p || 1}</span></button>${t.passive2 ? `<button data-sk="p2">${skIco(k, 'p2', '✦')}<span class="p">P</span><span class="sl">${h.sk.p || 1}</span></button>` : ''}</div>
      <div class="gslots">${Object.entries(SLOTS).map(([s, d]) => { const it = gearById((h.gear || {})[s]); return `<button class="gs ${it ? it.r : ''}" data-gs="${s}" style="${it ? `--sc:${SETS[it.set].col}` : ''}">${it ? `<span class="gi">${d.ic}</span><b>+${it.lv}</b><i style="background:${SETS[it.set].col}"></i>` : `<span class="gi" style="opacity:.3">${d.ic}</span>`}</button>`; }).join('')}
        ${Object.entries(ART_SLOTS).map(([s, d]) => { const a = artById((h.art || {})[s]); return `<button class="gs art ${a ? a.r : ''}" data-as="${s}" style="${a && !artFits(k, a) ? 'opacity:.5' : ''}"><span class="gi" style="${a ? '' : 'opacity:.3'}">${d.ic}</span>${a ? `<b>+${a.lv}</b>` : ''}</button>`; }).join('')}
        <button class="dark" id="autoeq" style="font-size:.8em">Auto<br>equip</button><button class="gs ex ${h.ex ? 'L' : ''}" id="excl" title="Exclusive"><span class="gi">💠</span><b>E${h.ex || 0}</b></button></div>
      <div style="font-size:.8em;line-height:1.3">XP <b>${h.xp || 0}/${xpNeed(h.lv)}</b> — dragons also level up by fighting</div>
      ${(() => { const b = gearBonus(k); const act = Object.entries(b.sets).filter(([, n]) => n >= 2); return act.length ? `<div style="font-size:.8em;font-weight:800">${act.map(([s, n]) => `<span style="color:${SETS[s].col}">${SETS[s].lb} ${n}/4: ${SETS[s].d2}${n >= 4 ? ', ' + SETS[s].d4 : ''}</span>`).join(' · ')}</div>` : ''; })()}
      <div style="display:flex;gap:.4em"><button class="gold" id="lv1" style="flex:1;font-size:1em;padding:.4em" ${h.lv >= cap ? 'disabled' : ''}>Level Up <small style="font-size:.75em">🪙${fmt(c.gold)} 🔮${fmt(c.ess)}</small></button><button class="dark" id="lvmax" ${h.lv >= cap ? 'disabled' : ''}>MAX</button>
        ${h.st < 5 ? `<button class="dark" id="star" ${h.copies < need ? 'disabled' : ''}>★ ${h.copies}/${need}</button>` : `<button class="dark" id="awk" style="color:#e9a6ff" ${h.aw >= 5 || h.copies < awCost.copies || S.ess < awCost.ess ? 'disabled' : ''}>${h.aw >= 5 ? 'A5 MAX' : `Awaken ${h.copies}/${awCost.copies}`}</button>`}</div>
      <div class="evo3">${v.forms.map((ff, i) => `<div class="${i === f ? 'on' : ''} ${i > f ? 'lk' : ''}"><div class="im"><img src="${FIG(ff)}" style="${v.face[i] === 'L' ? 'transform:scaleX(-1);' : ''}filter:${v.filter || 'none'}"></div>${['Hatchling', 'Juvenile', 'Ascended'][i]} · Lv${FORM_LV[i]}</div>`).join('')}</div>
    </div></div>`;
  wire();
  app.querySelectorAll('[data-sk]').forEach((b) => b.onclick = () => b.dataset.sk === 'p' ? skillPopup(t, null, false, k) : b.dataset.sk === 'p2' ? skillPopup(t, null, true, k) : skillPopup(t, t.skills[+b.dataset.sk], false, k));
  app.querySelectorAll('[data-gs]').forEach((b) => b.onclick = () => gearPopup(k, b.dataset.gs));
  app.querySelectorAll('[data-hk]').forEach((b) => b.onclick = () => { SFX.click(); detail(b.dataset.hk); });
  app.querySelector('#autoeq').onclick = () => { autoEquip(k); save(); detail(k); toast('Best gear equipped'); };
  app.querySelector('#excl').onclick = () => exclPopup(k);
  app.querySelectorAll('[data-as]').forEach((b) => b.onclick = () => artPopup(k, b.dataset.as));
  const lvUp = (n) => {
    let done = 0; const before = formOf(h.lv);
    while (done < n && h.lv < capOf(h.st, h.aw)) { const cc = lvCost(h.lv); if (S.gold < cc.gold || S.ess < cc.ess) break; S.gold -= cc.gold; S.ess -= cc.ess; h.lv++; done++; }
    if (!done) return toast('Not enough gold or essence');
    bump('lvup', done); save(); SFX.coin();
    if (formOf(h.lv) > before) evolveFx(k, before, formOf(h.lv)); else { detail(k); toast(`Lv ${h.lv}!`); }
  };
  app.querySelector('#lv1').onclick = () => lvUp(1);
  app.querySelector('#lvmax').onclick = () => lvUp(99);
  app.querySelector('#awk')?.addEventListener('click', () => { if (h.aw >= 5 || h.copies < awCost.copies || S.ess < awCost.ess) return; h.copies -= awCost.copies; S.ess -= awCost.ess; h.aw = (h.aw || 0) + 1; save(); awakenFx(k); });
  app.querySelector('#star')?.addEventListener('click', () => { if (h.copies < need || h.st >= 5) return; h.copies -= need; h.st++; save(); SFX.legend(); detail(k); toast(`${t.name} reached ${h.st}★!${h.st === 5 ? ' Awakening unlocked!' : ''}`); });
}
const itemScore = (it) => gearMain(it) * ({ atk: 6, hp: 0.35, spd: 9, def: 3 })[SLOTS[it.slot].main] + it.sub[1] * 600 + it.lv * 20;
function autoEquip(k) {
  const h = H(k); h.gear = h.gear || {}; h.art = h.art || {};
  for (const s of Object.keys(ART_SLOTS)) { const free = S.arts.filter((a) => a.slot === s && artFits(k, a) && (!artOwner(a.id) || artOwner(a.id) === k)).sort((a, b) => artVal(b) - artVal(a)); if (free[0]) h.art[s] = free[0].id; }
  for (const s of Object.keys(SLOTS)) {
    const free = S.gear.filter((it) => it.slot === s && (!ownerOf(it.id) || ownerOf(it.id) === k));
    free.sort((a, b) => itemScore(b) - itemScore(a));
    if (free[0]) h.gear[s] = free[0].id;
  }
}
function gearCard(it, extra = '') {
  return `<span class="gcard ${it.r}" style="--sc:${SETS[it.set].col}"><span class="gi">${SLOTS[it.slot].ic}</span><b>+${it.lv}</b><i style="background:${SETS[it.set].col}"></i>${extra}</span>`;
}
function gearPopup(k, slot) {
  const h = H(k); const cur = gearById(h.gear[slot]);
  const list = S.gear.filter((it) => it.slot === slot && it.id !== (cur && cur.id)).sort((a, b) => itemScore(b) - itemScore(a));
  const info = (it) => `<div style="font-size:.85em;line-height:1.35"><b style="color:${SETS[it.set].col}">${SETS[it.set].lb} ${SLOTS[it.slot].lb}</b> <span style="color:${RAR[it.r].color}">${RAR[it.r].label}</span><br>${gearLabel(SLOTS[it.slot].main, gearMain(it))} · ${gearLabel(it.sub[0], it.sub[1] * (1 + 0.1 * it.lv))}<br><span style="color:var(--dim)">Set: 2 = ${SETS[it.set].d2}, 4 = ${SETS[it.set].d4}</span></div>`;
  popup(`<h3>${SLOTS[slot].ic} ${SLOTS[slot].lb} — ${esc(HEROES[k].name)}</h3><div class="sep"></div>
    ${cur ? `<div style="display:flex;gap:.7em;align-items:center">${gearCard(cur)}${info(cur)}</div>
      <div style="display:flex;gap:.5em;margin:.5em 0"><button class="gold" id="up" style="font-size:.95em" ${cur.lv >= 12 || S.gold < gearCost(cur) ? 'disabled' : ''}>Upgrade +${cur.lv + 1} · 🪙${fmt(gearCost(cur))}</button><button class="dark" id="off">Unequip</button></div><div class="sep"></div>` : '<div style="color:var(--dim)">Empty slot.</div>'}
    <div style="font-weight:800;margin:.3em 0">Inventory (${list.length})</div>
    ${list.length ? `<div style="display:flex;flex-direction:column;gap:.4em;max-height:14em;overflow:auto">${list.map((it) => `<div style="display:flex;gap:.6em;align-items:center">${gearCard(it)}${info(it)}<button class="dark" data-eq="${it.id}" style="margin-left:auto">${ownerOf(it.id) ? 'Take' : 'Equip'}</button></div>`).join('')}</div>` : '<div style="color:var(--dim);font-size:.9em">No items yet — gear drops from campaign stages and bosses.</div>'}`, (ov, close) => {
    ov.querySelector('#up')?.addEventListener('click', () => { if (S.gold < gearCost(cur)) return; S.gold -= gearCost(cur); cur.lv++; bump('gear'); save(); SFX.coin(); close(); detail(k); gearPopup(k, slot); });
    ov.querySelector('#off')?.addEventListener('click', () => { delete h.gear[slot]; save(); close(); detail(k); });
    ov.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => { const id = +b.dataset.eq; const o = ownerOf(id); if (o) delete H(o).gear[slot]; h.gear[slot] = id; save(); SFX.click(); close(); detail(k); });
  });
}
function artPopup(k, slot) {
  const h = H(k); const cur = artById(h.art[slot]); const t = HEROES[k];
  const need = slot === 'cls' ? classOfRole(t.role) : slot === 'mark' ? MARKS[t.mark].label : FACTIONS[factionOf(k)].lb;
  const nm = (a) => `${ART_NAMES[a.slot][a.type]}`;
  const info = (a) => `<div style="font-size:.85em;line-height:1.35"><b style="color:${RAR[a.r].color}">${nm(a)}</b> ${a.lv ? `+${a.lv}` : ''} ${artFits(k, a) ? '' : '<span style="color:#ff8a7a">(does not fit)</span>'}<br>${gearLabel(ART_BASE[a.slot][a.type][0], artVal(a))}${a.lv >= 5 ? ` <span style="color:var(--gold)">★${a.lv >= 10 ? '★' : ''}</span>` : ''}</div>`;
  const list = S.arts.filter((a) => a.slot === slot && a.id !== (cur && cur.id)).sort((a, b) => (artFits(k, b) - artFits(k, a)) || (artVal(b) - artVal(a)));
  const c = cur && artCost(cur);
  popup(`<h3>${ART_SLOTS[slot].ic} ${ART_SLOTS[slot].lb} artifact — ${esc(t.name)}</h3><div style="color:var(--dim);font-size:.85em">Works only if it matches the dragon: needs <b style="color:#fff">${esc(need)}</b>. +5 and +10 add a big bonus.</div><div class="sep"></div>
    ${cur ? `<div style="display:flex;gap:.7em;align-items:center"><span class="gs art ${cur.r}"><span class="gi">${ART_SLOTS[slot].ic}</span><b>+${cur.lv}</b></span>${info(cur)}</div>
      <div style="display:flex;gap:.5em;margin:.5em 0"><button class="gold" id="aup" style="font-size:.9em" ${cur.lv >= 10 || S.gold < c.gold || S.dust < c.dust ? 'disabled' : ''}>Upgrade +${cur.lv + 1} · 🪙${fmt(c.gold)} ✨${c.dust}</button><button class="dark" id="aoff">Unequip</button></div>
      <div style="font-size:.8em;color:var(--dim)">You have ✨ ${S.dust} artifact dust — from dungeon bosses and chapter stars</div><div class="sep"></div>` : ''}
    <div style="font-weight:800;margin:.3em 0">Inventory (${list.length})</div>
    ${list.length ? `<div style="display:flex;flex-direction:column;gap:.35em;max-height:13em;overflow:auto">${list.map((a) => `<div style="display:flex;gap:.6em;align-items:center"><span class="gs art ${a.r}"><span class="gi">${ART_SLOTS[slot].ic}</span><b>+${a.lv}</b></span>${info(a)}<button class="dark" data-ae="${a.id}" style="margin-left:auto">${artOwner(a.id) ? 'Take' : 'Equip'}</button></div>`).join('')}</div>` : '<div style="color:var(--dim);font-size:.9em">No artifacts yet — they drop from dungeon gate bosses, chapter bosses and star milestones.</div>'}`, (ov, close) => {
    ov.querySelector('#aup')?.addEventListener('click', () => { const cc = artCost(cur); if (S.gold < cc.gold || S.dust < cc.dust) return; S.gold -= cc.gold; S.dust -= cc.dust; cur.lv++; bump('gear'); save(); SFX.coin(); close(); detail(k); artPopup(k, slot); });
    ov.querySelector('#aoff')?.addEventListener('click', () => { delete h.art[slot]; save(); close(); detail(k); });
    ov.querySelectorAll('[data-ae]').forEach((b) => b.onclick = () => { const id = +b.dataset.ae; const o = artOwner(id); if (o) delete H(o).art[slot]; h.art[slot] = id; save(); SFX.click(); close(); detail(k); });
  });
}
function exclPopup(k) {
  const t = HEROES[k], h = H(k), ex = h.ex || 0, X = t.excl; const c = { eyes: ex + 1, gold: 20000 * (ex + 1) };
  const sk = t.skills.find((s) => s.id === X.skill);
  const tiers = [['E1', `<b>${esc(sk.name)}</b>: ${esc(X.desc)} · stats +10%`], ['E2', 'All stats +5%'], ['E3', `After <b>${esc(t.skills[2].name)}</b>, launches a free Basic attack`], ['E4', 'All stats +5%'], ['E5', `<b>${esc(t.skills[2].name)}</b> cooldown −1 · stats +5%`]];
  popup(`<div style="display:flex;gap:.7em;align-items:center"><span class="gs L" style="width:3.6em;height:3.6em"><span class="gi" style="font-size:1.8em">💠</span><b>E${ex}</b></span><div><h3 style="margin:0">${esc(X.name)}</h3><div style="color:#d77bff;font-weight:800">Exclusive · ${esc(t.name)}</div></div></div><div class="sep"></div>
    ${tiers.map(([e, d], i) => `<div style="margin:.25em 0;font-size:.9em;color:${i < ex ? '#ffd77a' : '#9aa'}">${i < ex ? '✅' : '▫️'} <b>${e}</b> — ${d}</div>`).join('')}
    <div style="text-align:center;margin-top:.7em">${ex >= 5 ? '<b style="color:var(--gold)">MAX</b>' : `<button class="gold" id="exup" ${S.eyes < c.eyes || S.gold < c.gold ? 'disabled' : ''}>${ex ? 'Upgrade' : 'Unlock'} E${ex + 1} · 👁️${c.eyes} 🪙${fmt(c.gold)}</button><div style="font-size:.8em;color:var(--dim);margin-top:.3em">You have 👁️ ${S.eyes} Dragon Eyes — they drop from bosses and dungeon gates</div>`}</div>`, (ov, close) => {
    ov.querySelector('#exup')?.addEventListener('click', () => { if (S.eyes < c.eyes || S.gold < c.gold) return; S.eyes -= c.eyes; S.gold -= c.gold; h.ex = ex + 1; save(); SFX.legend(); close(); detail(k); exclPopup(k); });
  });
}
function awakenFx(k) {
  const fg = figOf(k, H(k).lv); const ov = document.createElement('div'); ov.className = 'reveal';
  ov.style.background = 'radial-gradient(ellipse at 50% 45%,#5a1a7a,#12061f 70%)';
  ov.innerHTML = `<div class="serif t-outline" style="font-size:2.4em;color:#f0b6ff;font-weight:700">AWAKENING ${H(k).aw}</div>
    <div style="height:55%;display:flex;align-items:flex-end"><img src="${fg.src}" style="max-height:100%;filter:${fg.filter} drop-shadow(0 0 1.5em #c45cff) brightness(1.15);${fg.face === 'L' ? 'transform:scaleX(-1)' : ''}"></div>
    <div style="font-weight:800;margin-top:.4em">${awStr(H(k).aw)} · All stats +10% · Level cap +10</div><button class="gold" style="margin-top:.8em" id="ok">Continue</button>`;
  app.appendChild(ov); SFX.summon(); setTimeout(SFX.legend, 900);
  ov.querySelector('#ok').onclick = () => { ov.remove(); detail(k); };
}
function evolveFx(k, from, to) {
  const v = VIS[k];
  const ov = document.createElement('div'); ov.className = 'reveal';
  ov.innerHTML = `<div class="serif" style="font-size:2.2em;color:var(--gold);font-weight:700">EVOLUTION!</div>
    <div style="position:relative;height:60%;width:100%;display:flex;align-items:flex-end;justify-content:center">
      <img id="e1" src="${FIG(v.forms[from])}" style="position:absolute;bottom:0;max-height:65%;filter:${v.filter || ''} brightness(1);transition:all .9s;${v.face[from] === 'L' ? 'transform:scaleX(-1)' : ''}">
      <img id="e2" src="${FIG(v.forms[to])}" style="position:absolute;bottom:0;max-height:100%;opacity:0;filter:${v.filter || ''} brightness(8);transition:all 1s;${v.face[to] === 'L' ? 'transform:scaleX(-1)' : ''}"></div>
    <div class="serif" style="margin-top:.6em;font-size:1.5em">${esc(HEROES[k].name)} → ${['Hatchling', 'Juvenile', 'Ascended'][to]}</div>
    <div style="color:var(--dim)">All stats +8% · new look in battle</div><button class="gold" style="margin-top:.8em" id="ok">Awesome!</button>`;
  app.appendChild(ov); SFX.summon();
  const e1 = ov.querySelector('#e1'), e2 = ov.querySelector('#e2');
  setTimeout(() => { e1.style.filter = `${v.filter || ''} brightness(8)`; }, 200);
  setTimeout(() => { e1.style.opacity = '0'; e2.style.opacity = '1'; e2.style.filter = `${v.filter || ''} brightness(1)`; SFX.legend(); }, 1200);
  ov.querySelector('#ok').onclick = () => { ov.remove(); detail(k); };
}

// ======================= SUMMON (altar) =======================
const POOL = { L: Object.keys(VIS).filter((k) => VIS[k].r === 'L'), E: Object.keys(VIS).filter((k) => VIS[k].r === 'E'), R: Object.keys(VIS).filter((k) => VIS[k].r === 'R') };
const PITY = 30;
function rollOne(minE = false) {
  S.pity = (S.pity || 0) + 1;
  const x = Math.random();
  let r = x < 0.06 ? 'L' : x < 0.3 || minE ? 'E' : 'R';
  if (S.pity >= PITY) r = 'L';
  if (r === 'L') S.pity = 0;
  const p = POOL[r]; return p[Math.floor(Math.random() * p.length)];
}
let wishTab = 'scroll';
function summon() {
  const W = { scroll: { lb: 'Dragon Wish', cur: 'runes', ic: '📜', c1: 1, c10: 10, cr: '#3da5ff', cr2: '#0a4fb0' }, gem: { lb: 'Premium Wish', cur: 'gems', ic: '💎', c1: 150, c10: 1350, cr: '#e04dff', cr2: '#6a0aa8' } }[wishTab];
  app.innerHTML = `<div class="scr"><div class="altar" style="--cr:${W.cr};--cr2:${W.cr2}"><div class="ring1"></div><div class="ring2"></div><div class="well"></div><div class="crystal"><i></i></div></div>
    ${navBtns()}${resBar(['runes', 'gems'])}
    <div class="wtabs"><button data-w="scroll" class="${wishTab === 'scroll' ? 'on' : ''}">Dragon<br>Wish</button><button data-w="gem" class="${wishTab === 'gem' ? 'on' : ''}">Premium<br>Wish</button>
      <div style="color:var(--dim);font-size:.85em;line-height:1.4">Legendary 6%<br>Epic 24%<br>Rare 70%</div></div>
    <div class="sumbtns"><button class="gold" id="s1" ${S[W.cur] < W.c1 ? 'disabled' : ''}>${W.ic} ${W.c1} &nbsp;Wish ×1</button><button class="gold" id="s10" ${S[W.cur] < W.c10 ? 'disabled' : ''}>${W.ic} ${W.c10} &nbsp;Wish ×10</button></div>
    <div class="pity t-outline">Make <b>${PITY - (S.pity || 0)}</b> more wishes for a guaranteed Legendary dragon · ×10 always has an Epic</div></div>`;
  wire();
  app.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { wishTab = b.dataset.w; summon(); });
  app.querySelector('#s1').onclick = () => doSummon(1, W);
  app.querySelector('#s10').onclick = () => doSummon(10, W);
}
function doSummon(n, W) {
  const cost = n === 1 ? W.c1 : W.c10; if (S[W.cur] < cost) return;
  S[W.cur] -= cost;
  const res = [];
  for (let i = 0; i < n; i++) res.push(rollOne(n === 10 && i === 9 && !res.some((k) => VIS[k].r !== 'R')));
  if (S.pulls === 0) res[0] = 'tidecoil'; // first summon ever: Venomfang
  S.pulls += n; bump('summon', n);
  const out = res.map((k) => { const isNew = !owned(k); if (isNew) S.heroes[k] = { lv: 1, st: RAR[VIS[k].r].stars, copies: 0, gear: {} }; else S.heroes[k].copies++; return { k, isNew }; });
  save();
  const best = res.some((k) => VIS[k].r === 'L') ? 'L' : res.some((k) => VIS[k].r === 'E') ? 'E' : 'R';
  const ov = document.createElement('div'); ov.className = 'reveal';
  ov.innerHTML = `<div class="glow" style="background:radial-gradient(#fff,${RAR[best].color} 40%,transparent 70%);box-shadow:0 0 6em 2em ${RAR[best].color}"></div>`;
  app.appendChild(ov); SFX.summon();
  setTimeout(async () => {
    ov.innerHTML = `<div class="rg ${n === 1 ? 'one' : ''}">${out.map((o) => `<div class="flipc ${VIS[o.k].r}"><div class="in"><div class="fr">${pcard(o.k, { name: true, extra: o.isNew ? '<span class="badge">NEW</span>' : '' })}</div><div class="bk">🐉</div></div></div>`).join('')}</div>
      <div id="hint" class="t-outline" style="margin-top:1em;font-weight:800">&nbsp;</div>
      <div style="display:flex;gap:4em;margin-top:.8em"><button class="gold" id="again" ${S[W.cur] < cost ? 'disabled' : ''}>${W.ic} ${cost} &nbsp;Wish ×${n}</button><button class="blue" id="done">Confirm</button></div>`;
    let skip = false; ov.onclick = (e) => { if (!e.target.closest('button')) skip = true; };
    for (const c of ov.querySelectorAll('.flipc')) {
      c.classList.add('open'); const r = c.classList.contains('L') ? 'L' : c.classList.contains('E') ? 'E' : 'R';
      if (r === 'L') { SFX.legend(); if (!skip) await sleep(650); } else { SFX.click(); if (!skip) await sleep(r === 'E' ? 240 : 120); }
    }
    const nn = out.filter((o) => o.isNew).length;
    ov.querySelector('#hint').textContent = nn ? `${nn} new dragon${nn > 1 ? 's' : ''}! Duplicates become ★ copies.` : 'Duplicates become ★ copies — use them to raise stars.';
    ov.querySelector('#again').onclick = () => { ov.remove(); doSummon(n, W); };
    ov.querySelector('#done').onclick = () => { ov.remove(); summon(); };
  }, 1300);
}

// ======================= CAMPAIGN (parchment map) =======================
let viewCh = null;
const NODE_POS = [[10, 72], [19, 84], [29, 76], [35, 58], [28, 38], [42, 28], [55, 36], [60, 56], [70, 70], [80, 50]];
function campaign() {
  const D = viewDiff; const CL = clr(D); const cur = Math.min(CL, STAGE_COUNT - 1);
  if (viewCh === null) viewCh = Math.floor(cur / PER);
  const C = CHAPTERS[viewCh];
  const nodes = Array.from({ length: PER }, (_, n) => stageDef(viewCh * PER + n, D));
  const totStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
  const lead = S.team.find(owned) || Object.keys(S.heroes)[0]; const lf = figOf(lead, H(lead).lv);
  const pts = NODE_POS.map(([x, y]) => `${x},${y}`).join(' ');
  app.innerHTML = `<div class="scr"><div class="parch"><div class="sea"></div>
      <div class="deco" style="left:24%;top:24%">🏯</div><div class="deco" style="left:56%;top:58%">⛰️</div><div class="deco" style="left:8%;top:30%">🌲</div><div class="deco" style="left:82%;top:16%">🐉</div></div>
    <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="rgba(255,248,220,.85)" stroke-width=".45" stroke-dasharray="1.4 1.2"/></svg>
    ${navBtns(`<span class="serif">${esc(C.name)}</span>`)}
    <div class="dtabs">${DIFF_ORDER.map((d) => `<button data-diff="${d}" class="${d === D ? 'on' : ''}" ${diffOpen(d) ? '' : 'disabled'} style="--dc:${DIFFS[d].col}">${diffOpen(d) ? '' : '🔒 '}${DIFFS[d].lb}</button>`).join('')}</div>${resBar(['gold', 'gems'])}
    ${nodes.map((st, i) => {
      const lock = st.g > CL, done = st.g < CL, isCur = st.g === CL;
      const s = S.stars[st.id] || 0; const [x, y] = NODE_POS[i];
      const rw = done ? '' : `<span class="rw">${st.reward.runes ? '📜' : '💎'}<b>${st.reward.runes || st.reward.gems}</b></span>`;
      return `<button class="node ${lock ? 'lock' : ''} ${done ? 'done' : ''} ${isCur ? 'cur' : ''} ${st.boss ? 'boss' : ''}" data-g="${st.g}" style="left:${x}%;top:${y}%">
        ${isCur ? `<span class="me" style="background-image:url(${lf.src});background-position:${lf.face === 'L' ? '5% 8%' : '95% 8%'}"></span>` : ''}${rw}
        <span class="ban"><span>${st.boss ? '☠' : st.name}</span>${done ? `<i>${'★'.repeat(s)}<span style="opacity:.3">${'★'.repeat(3 - s)}</span></i>` : ''}</span><span class="ped"></span></button>`;
    }).join('')}
    <button class="chn t-outline" style="left:calc(1.5em + var(--sl))" ${viewCh === 0 ? 'disabled style="opacity:.4;left:1.5em"' : ''} data-ch="${viewCh - 1}">◄ ${viewCh > 0 ? esc(CHAPTERS[viewCh - 1].name) : ''}</button>
    <div class="chaps">${CHAPTERS.map((c, i) => `${i ? '<i></i>' : ''}<button data-ch="${i}" class="${i === viewCh ? 'on' : ''}" ${i * PER > CL || !diffOpen(D, i) ? 'disabled' : ''}><span>${i + 1}</span></button>`).join('')}</div>
    <button class="chn t-outline" style="right:calc(7em + var(--sr))" ${viewCh + 1 >= CHAPTERS.length || (viewCh + 1) * PER > CL ? 'disabled' : ''} data-ch="${viewCh + 1}">${viewCh + 1 < CHAPTERS.length ? esc(CHAPTERS[viewCh + 1].name) : ''} ►</button>
    <button class="starcnt t-outline" id="miles"><span class="d"><span>★</span></span>${totStars}/${STAGE_COUNT * 3}${MILES.some(([s], i) => totStars >= s && !S.miles[i]) ? '<span class="dotr"></span>' : ''}</button>
    <button class="blue" id="push" style="position:absolute;right:calc(1.2em + var(--sr));top:3.4em;z-index:12;font-size:1em;padding:.4em 1em">⚡ Auto-push</button></div>`;
  wire();
  app.querySelector('[data-back]').onclick = () => { viewCh = null; home(); };
  app.querySelectorAll('[data-ch]').forEach((b) => b.onclick = () => { if (b.disabled) return; viewCh = +b.dataset.ch; campaign(); });
  app.querySelector('#push').onclick = autoPush;
  app.querySelector('#miles').onclick = milestones;
  app.querySelectorAll('[data-diff]').forEach((b) => b.onclick = () => { if (b.disabled) return toast('Clear chapter 1 on the previous difficulty first'); viewDiff = b.dataset.diff; viewCh = null; campaign(); });
  app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { const g = +b.dataset.g; if (g > CL) return toast('Clear the previous stage first'); SFX.click(); stagePopup(stageDef(g, D)); });
}
const MILES = [[10, { gold: 20000, dust: 40 }], [20, { runes: 5, tomes: 6 }], [35, { gems: 400, art: 'E' }], [50, { eyes: 3, dust: 120 }], [70, { runes: 10, art: 'L' }], [90, { gems: 1000, hero: 'L' }]];
function milestones() {
  const tot = Object.values(S.stars).reduce((a, b) => a + b, 0);
  const lbl = (rw) => Object.entries(rw).map(([k, v]) => k === 'art' ? `${RAR[v].label} artifact` : k === 'hero' ? 'Legendary dragon' : `${{ gold: '🪙', ess: '🔮', gems: '💎', runes: '📜', tomes: '📘', eyes: '👁️', dust: '✨' }[k]}${fmt(v)}`).join(' · ');
  popup(`<h3 class="serif">★ Star milestones</h3><div style="color:var(--dim)">Earn stars on every difficulty — 3★ = win, no losses, fast.</div><div class="sep"></div>
    <div style="display:flex;align-items:center;gap:.6em;margin-bottom:.5em"><b>★ ${tot}</b><div class="bar" style="flex:1"><i style="width:${Math.min(100, 100 * tot / MILES.at(-1)[0])}%"></i></div></div>
    ${MILES.map(([s, rw], i) => `<div class="trow" style="grid-template-columns:3.5em 1fr auto"><b style="color:var(--gold)">★${s}</b><span>${lbl(rw)}</span>${S.miles[i] ? '✅' : tot >= s ? `<button class="gold" data-m="${i}" style="font-size:.8em;padding:.25em .7em">Claim</button>` : '🔒'}</div>`).join('')}`, (ov, close) => {
    ov.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => { const i = +b.dataset.m; const rw = { ...MILES[i][1] }; S.miles[i] = 1;
      if (rw.art) { S.arts.push(makeArtifact(rw.art, ['cls', 'mark', 'fac'][Math.floor(Math.random() * 3)])); delete rw.art; }
      if (rw.hero) { const L = Object.keys(VIS).filter((k) => VIS[k].r === 'L'); const lk = L.find((k) => !owned(k)) || L[0]; if (owned(lk)) H(lk).copies++; else S.heroes[lk] = { lv: 1, st: 3, copies: 0, gear: {}, art: {} }; delete rw.hero; toast(`${HEROES[lk].name} joined you!`); }
      giveRw(rw); save(); SFX.legend(); close(); milestones(); });
  });
}
function stagePopup(st) {
  const first = st.g === clr(st.diff); const s = S.stars[st.id] || 0;
  const rule = st.boss ? ENEMIES[st.boss].passive.desc.replace('BOSS RULE: ', '') : null;
  popup(`<div style="display:flex;align-items:center;gap:.6em"><h3 style="margin:0">${st.name} <span style="color:${DIFFS[st.diff || 'easy'].col};font-size:.7em">${DIFFS[st.diff || 'easy'].lb}</span></h3><span style="color:#ffd23a;font-size:1.4em">${starStr(s, 3)}</span></div><div class="sep"></div>
    ${rule ? `<div style="margin-bottom:.6em;padding:.4em .6em;border-left:3px solid #c47cff;background:rgba(150,80,220,.15)"><b style="color:#e2b6ff">☠ ${st.midBoss ? 'Mid-boss' : 'Chapter boss'}: ${esc(ENEMIES[st.boss].name)}</b><br><span style="font-size:.9em">${esc(rule)}</span></div>` : ''}
    <div style="text-align:center;font-weight:800;margin-bottom:.4em">${first ? 'First clear reward' : 'Reward'}</div>
    <div style="display:flex;gap:.5em;justify-content:center"><span class="itm">🪙<b>${fmt(st.reward.gold * (first ? 1 : .5))}</b></span><span class="itm pu">🔮<b>${fmt(st.reward.ess * (first ? 1 : .5))}</b></span>${first ? `<span class="itm bl">💎<b>${st.reward.gems}</b></span>${st.reward.runes ? `<span class="itm gr">📜<b>${st.reward.runes}</b></span>` : ''}` : ''}</div>
    <div style="text-align:center;font-size:.85em;margin-top:.4em">✨ +${stageXp(st, true)} XP to each dragon in the team</div>
    <div style="display:flex;gap:.5em;justify-content:center;margin-top:.7em">${skippable(st) ? '<button class="blue" id="qb">⚡ Quick battle</button>' : '<span style="font-size:.8em;color:#e2b6ff;align-self:center">Boss stage — must be fought</span>'}<button class="gold" id="go" style="background:linear-gradient(#ff9d4a,#d25a12);color:#fff;border-color:#ffc58a;text-shadow:0 1px 1px #000">⚔ Challenge</button></div>`, (ov, close) => {
    ov.querySelector('#go').onclick = () => { close(); formation(st); };
    ov.querySelector('#qb')?.addEventListener('click', () => { close(); quickBattle(st); });
  });
}

// ======================= FORMATION (VS screen) =======================
function formation(st) {
  S.team = S.team.filter(owned).slice(0, 5);
  if (!st) st = stageDef(Math.min(S.cleared, STAGE_COUNT - 1));
  const mine = Object.keys(S.heroes).sort((a, b) => heroPower(b) - heroPower(a));
  const enemies = st.waves[st.waves.length - 1];
  const draw = () => {
    const slot = (i) => { const k = S.team[i]; return k ? `<button data-rm="${k}">${pcard(k)}</button>` : '<div class="empty">+</div>'; };
    const eslot = (k) => { const t = ENEMIES[k]; const v = EVIS[k] || (k.startsWith('elite_') ? (() => { const hk = k.slice(6); const f = VIS[hk]; return { fig: f.forms[2], face: f.face[2], filter: f.filter }; })() : { fig: 'vor1', face: 'L' });
      return `<div class="pc ${t.role === 'Boss' ? 'L' : 'R'}">${photo(FIG(v.fig), v.face, v.filter || '')}${mk(t.mark)}<span class="lv">${st.level}</span></div>`; };
    app.innerHTML = `<div class="scr"><div class="vs"></div>
      ${navBtns(st.mode ? esc(st.title) : `Stage ${st.name}${st.boss ? ' · ☠ ' + esc(ENEMIES[st.boss].name) : ''}`, st.mode || 'campaign')}${resBar(st.mode === 'arena' ? ['gems'] : st.mode ? ['gold'] : ['runes'])}
      <div class="side l"><div class="pwbar t-outline">✊ ${fmt(teamPower())}</div>
        <div class="slots">${slot(0)}${slot(1)}${slot(2)}<div class="row2">${slot(3)}${slot(4)}<div class="pc L" title="Dragon Spirit" style="width:4.6em">${photoFig('fire_roar', 'C', 'sepia(.6) saturate(2) hue-rotate(-10deg) brightness(1.3)')}<span class="lv">${S.petLv}</span></div></div></div></div>
            <div class="vsmid"><div class="V">VS</div><div class="s3">★★★</div><ul>${st.mode === 'arena' ? `<li>Defeat ${esc(st.oppName)}.</li><li>Win: +${st.ptsWin} pts</li>` : '<li>Clear the stage.</li><li>No dragon falls.</li>'}<li>Win within ${Math.floor(15 * st.waves.length / 2 + 5)} rounds.</li></ul>${(() => { const fb = factionBonus(S.team.filter(owned)); return `<div class="facbar">${fb.act.length ? fb.act.map(([f, n]) => `<span style="color:${FACTIONS[f].col}">${FACTIONS[f].ic} ${FACTIONS[f].lb} ${n}/3</span>`).join('') : '<span style="opacity:.6">Faction bonus: put 2–3 dragons of one faction together</span>'}</div>`; })()}</div>
      <div class="side r"><div class="pwbar t-outline">✊ ${fmt(enemyPower(st))}</div>
        <div class="slots">${enemies.slice(0, 3).map(eslot).join('')}<div class="row2">${enemies.slice(3).map(eslot).join('')}</div></div>
        ${st.boss ? `<div style="margin-top:.5em;font-size:.85em;padding:.3em .5em;background:rgba(0,0,0,.35);border-left:3px solid #c47cff">☠ ${esc(ENEMIES[st.boss].passive.desc.replace('BOSS RULE: ', ''))}</div>` : ''}</div>
      <div class="ftabs"><button id="auto5"><span>⚡</span></button></div>
      <div class="roster">${mine.map((k) => `<button data-k="${k}">${pcard(k, { cls: S.team.includes(k) ? 'sel' : '' })}</button>`).join('')}</div>
      <div class="fbtns">${!st.mode && skippable(st) ? '<button class="blue" id="skipb" style="font-size:1.05em;padding:.35em 0">⚡ Skip battle</button>' : ''}<button class="gold" id="go" ${S.team.length ? '' : 'disabled'}>⚔ Battle</button></div></div>`;
    wire();
    app.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { const k = b.dataset.k; SFX.click(); if (S.team.includes(k)) S.team = S.team.filter((x) => x !== k); else if (S.team.length < 5) S.team.push(k); else return toast('Team is full (5)'); save(); draw(); });
    app.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { S.team = S.team.filter((x) => x !== b.dataset.rm); save(); draw(); });
    app.querySelector('#auto5').onclick = () => { S.team = mine.slice(0, 5); save(); draw(); toast('Strongest team set'); };
    app.querySelector('#go').onclick = () => battle(st);
    app.querySelector('#skipb')?.addEventListener('click', () => quickBattle(st));
  };
  draw();
}

// ======================= BATTLE =======================
// feet positions (% of stage). Allies front-left, enemies back-right, like IMR's diagonal view.
const POS = { a: [[42, 70], [33, 90], [30, 54], [19, 74], [12, 94]], e: [[60, 50], [68, 66], [72, 40], [82, 56], [90, 74]] };
let BT = null;
function unitVis(u) {
  if (u.side === 'a') { const lv = H(u.key)?.lv || u.lv; const f = figOf(u.key, lv); const ad = formOf(lv) === 2; return { ...f, key: VIS[u.key].forms[formOf(lv)], poses: ad ? VIS[u.key].poses : null, idle: ad ? VIS[u.key].idle : null, anims: ad ? VIS[u.key].anims : null, animScale: ad ? VIS[u.key].animScale : 1, fx: VIS[u.key].fx }; }
  if (u.key.startsWith('elite_')) { const hk = u.key.slice(6); const v = VIS[hk]; return { src: FIG(v.forms[2]), key: v.forms[2], face: v.face[2], filter: v.filter || '', scale: 1, fx: v.fx, poses: v.poses, idle: v.idle, anims: v.anims, animScale: v.animScale || 1 }; }
  const v = EVIS[u.key]; return { key: v.fig, src: FIG(v.fig), face: v.face, filter: v.filter || '', scale: v.scale || 1, fx: FX_COLOR[u.mark][0] };
}
function makeBattle(team, st) {
  const levels = Object.fromEntries(team.map((k) => [k, H(k).lv]));
  const mults = Object.fromEntries(team.map((k) => [k, heroMul(k)]));
  const fb = factionBonus(team).b;
  const bonuses = Object.fromEntries(team.map((k) => { const gb = gearBonus(k); const o = { ...gb, skLv: H(k).sk, ex: H(k).ex || 0 }; for (const [kk, v] of Object.entries(fb)) o[kk] = (o[kk] || 0) + v; return [k, o]; }));
  return createBattle({ team, levels, mults, bonuses, petLv: S.petLv, stage: st, seed: (Math.random() * 2 ** 31) | 0 });
}
// ---------- battle XP ----------
const xpNeed = (lv) => 40 + lv * 28;
function giveXp(team, amount) {
  const ups = {};
  for (const k of team) {
    const h = H(k); if (!h) continue; const before = h.lv, f0 = formOf(h.lv);
    h.xp = (h.xp || 0) + amount;
    while (h.lv < capOf(h.st, h.aw) && h.xp >= xpNeed(h.lv)) { h.xp -= xpNeed(h.lv); h.lv++; }
    if (h.lv >= capOf(h.st, h.aw)) h.xp = Math.min(h.xp, xpNeed(h.lv));
    if (h.lv > before) ups[k] = { from: before, to: h.lv, evo: formOf(h.lv) > f0 };
  }
  return ups;
}
const stageXp = (st, win) => Math.round((40 + st.level * 9) * (st.boss ? 1.6 : 1) * (win ? 1 : 0.3));
// ---------- campaign rewards (shared by battle, quick battle and auto-push) ----------
function grantStage(st, B) {
  const win = B.result === 'victory'; const n = win ? stars(B) : 0;
  const first = win && st.g === clr(st.diff); const mul = first ? 1 : 0.5;
  const rw = win ? { gold: Math.round(st.reward.gold * mul), ess: Math.round(st.reward.ess * mul), gems: first ? st.reward.gems : 0, runes: first ? st.reward.runes : 0 } : { gold: Math.round(st.reward.gold * 0.15), ess: Math.round(st.reward.ess * 0.15), gems: 0, runes: 0 };
  rw.tomes = win ? (first ? (st.boss ? 6 : 2) : 1) : 0;
  rw.eyes = win && st.boss ? (first ? (st.n === 9 ? 3 : 1) : 0) : 0;
  S.gold += rw.gold; S.ess += rw.ess; S.gems += rw.gems; S.runes += rw.runes; S.tomes += rw.tomes; S.eyes += rw.eyes;
  if (win) { S.stars[st.id] = Math.max(S.stars[st.id] || 0, n); if (first) setClr(st.diff, clr(st.diff) + 1); bump('win'); }
  const drops = [];
  if (win) {
    const rr = Math.random(); const bossy = !!st.boss;
    const gr = st.n === 9 && first ? 'L' : rr < (bossy ? 0.25 : 0.04 + st.g * 0.004) ? 'L' : rr < (bossy ? 0.8 : 0.3 + st.g * 0.01) ? 'E' : 'R';
    const cnt = first ? (bossy ? 3 : 2) : 1;
    for (let i = 0; i < cnt; i++) { const it = makeGear(i === 0 ? gr : (Math.random() < 0.3 ? 'E' : 'R'), st.ch); S.gear.push(it); drops.push(it); }
  }
  let chapterGift = null;
  if (win && first && st.n === 9 && (st.diff || 'easy') !== 'easy') { const k2 = `${st.diff}${st.ch}`; S.chapters[k2] = 1; const m = DIFFS[st.diff].r; S.gems += Math.round(500 * m); S.eyes += 3; S.runes += 10; rw.gems += Math.round(500 * m); rw.eyes += 3; rw.runes += 10; }
  if (win && first && st.n === 9 && (st.diff || 'easy') === 'easy' && !S.chapters[st.ch]) {
    S.chapters[st.ch] = 1;
    const legends = Object.keys(VIS).filter((k) => VIS[k].r === 'L');
    const lk = legends.find((k) => !owned(k)) || legends[Math.floor(Math.random() * legends.length)];
    const isNew = !owned(lk); if (isNew) S.heroes[lk] = migrate({ heroes: { [lk]: { lv: 1, st: 3, copies: 0, gear: {} } } }).heroes[lk]; else H(lk).copies += 1;
    chapterGift = { lk, isNew, gold: 25000 * (st.ch + 1), ess: 8000 * (st.ch + 1), gems: 800, runes: 15 };
    S.gold += chapterGift.gold; S.ess += chapterGift.ess; S.gems += chapterGift.gems; S.runes += chapterGift.runes;
    for (const s of Object.keys(SLOTS)) { const it = makeGear('L', st.ch, s); const set = drops[0] ? drops[0].set : it.set; it.set = set; S.gear.push(it); drops.push(it); }
  }
  const artDrops = [];
  if (win && st.boss) { const ar = st.n === 9 ? (Math.random() < 0.35 ? 'L' : 'E') : Math.random() < 0.3 ? 'E' : 'R'; const a = makeArtifact(ar, ['cls', 'mark', 'fac'][Math.floor(Math.random() * 3)]); S.arts.push(a); artDrops.push(a); S.dust += first ? 30 : 8; rw.dust = first ? 30 : 8; }
  const team = B.allies.map((a) => a.key); const xp = stageXp(st, win); const ups = giveXp(team, xp);
  save();
  return { win, n, rw, drops, chapterGift, xp, ups, artDrops };
}
const skippable = (st) => !st.boss && st.n !== 4 && st.n !== 9;
function quickBattle(st) {
  const team = S.team.filter(owned).slice(0, 5); if (!team.length) return formation(st);
  const B = makeBattle(team, st); runAuto(B);
  const r = grantStage(st, B);
  popup(`<div class="res-t ${r.win ? '' : 'lose'}" style="font-size:2.2em;text-align:center">${r.win ? 'VICTORY' : 'DEFEAT'}</div>
    <div class="bst" style="text-align:center;font-size:2em">${[0, 1, 2].map((i) => `<span class="${i < r.n ? 'on' : ''}" style="animation-delay:${i * .15}s">★</span>`).join('')}</div>
    <div style="text-align:center;font-weight:800;margin:.3em 0">Quick battle ${st.name} · ${round(B)} rounds · ✨ +${r.xp} XP</div>
    ${rwRow(r)}${upsRow(r.ups)}
    <div style="display:flex;gap:.5em;justify-content:center;margin-top:.7em">${r.win && skippable(stageDef(Math.min(clr(st.diff), STAGE_COUNT - 1), st.diff)) && clr(st.diff) < STAGE_COUNT ? '<button class="gold" id="nx">⚡ Next quick battle</button>' : ''}<button class="dark" id="ok">OK</button></div>`, (ov, close) => {
    ov.querySelector('#ok').onclick = () => { close(); campaign(); if (r.chapterGift) chapterRewardPop(st, r.chapterGift); };
    ov.querySelector('#nx')?.addEventListener('click', () => { close(); quickBattle(stageDef(clr(st.diff), st.diff)); });
  });
  r.win ? SFX.win() : SFX.lose();
}
function autoPush() {
  const team = S.team.filter(owned).slice(0, 5); if (!team.length) return formation(null);
  const log = []; const tot = { gold: 0, ess: 0, gems: 0, runes: 0, tomes: 0, eyes: 0 }; const ups = {}; let drops = 0; let stop = '';
  const D = viewDiff;
  for (let i = 0; i < 20 && clr(D) < STAGE_COUNT; i++) {
    const st = stageDef(clr(D), D);
    if (!diffOpen(D, st.ch)) { stop = `Chapter ${st.ch + 1} on ${DIFFS[D].lb} is locked — clear it on the previous difficulty first.`; break; }
    if (!skippable(st)) { stop = `Stopped before ${st.name}: ${st.midBoss ? 'mid-boss' : 'chapter boss'} — fight it yourself!`; break; }
    const B = makeBattle(team, st); runAuto(B); const r = grantStage(st, B);
    for (const k of Object.keys(tot)) tot[k] += r.rw[k] || 0; drops += r.drops.length;
    for (const [k, u] of Object.entries(r.ups)) ups[k] = { from: ups[k] ? ups[k].from : u.from, to: u.to, evo: (ups[k] && ups[k].evo) || u.evo };
    log.push(`${r.win ? '✅' : '❌'} ${st.name} ${r.win ? '★'.repeat(r.n) : 'defeat'}`);
    if (!r.win) { stop = `Lost at ${st.name}. Upgrade your dragons and try again.`; break; }
  }
  if (!stop) stop = clr(D) >= STAGE_COUNT ? 'All stages cleared!' : 'Auto-push limit reached (20 stages).';
  popup(`<h3 class="serif">Auto-push</h3><div class="sep"></div><div style="display:flex;flex-wrap:wrap;gap:.3em .9em;font-weight:800;font-size:.9em">${log.map((l) => `<span>${l}</span>`).join('')}</div>
    <div style="margin:.5em 0;font-weight:800;color:#ffd9a0">${stop}</div>${rwRow({ rw: tot })}<div style="text-align:center;font-size:.85em">+${drops} gear items</div>${upsRow(ups)}
    <div style="text-align:center;margin-top:.6em"><button class="gold" id="ok">OK</button></div>`, (ov, close) => { ov.querySelector('#ok').onclick = () => { close(); viewCh = null; campaign(); }; });
  SFX.win();
}
const rwRow = (r) => `<div style="display:flex;gap:.4em;justify-content:center;flex-wrap:wrap">${[['gold', '🪙', ''], ['ess', '🔮', 'pu'], ['gems', '💎', 'bl'], ['runes', '📜', 'gr'], ['tomes', '📘', 'bl'], ['eyes', '👁️', 'pu']].filter(([k]) => r.rw[k]).map(([k, i, c]) => `<span class="itm ${c}">${i}<b>${fmt(r.rw[k])}</b></span>`).join('')}${(r.drops || []).map((it) => gearCard(it)).join('')}</div>`;
const upsRow = (ups) => Object.keys(ups).length ? `<div style="text-align:center;margin-top:.4em;font-weight:800;font-size:.9em;color:#7dff9a">${Object.entries(ups).map(([k, u]) => `${esc(HEROES[k].name)} Lv ${u.from}→${u.to}${u.evo ? ' 🌟EVOLVED' : ''}`).join(' · ')}</div>` : '';
function chapterRewardPop(st, cg) { const host = document.querySelector('.scr'); if (!host) return; host.id = host.id || 'bt-tmp'; chapterReward(st, cg, host); }
function battle(st) {
  const team = S.team.filter(owned).slice(0, 5);
  if (!team.length) return formation(st);
  if (st.mode === 'dungeons') { daily(); if (S.keys < 1) return toast('No keys left — they refill tomorrow'); S.keys--; save(); }
  if (st.mode === 'arena') { daily(); if (S.tickets < 1) return toast('No arena tickets — they refill tomorrow'); S.tickets--; save(); }
  const B = makeBattle(team, st);
  BT = { B, st, evIdx: 0, alive: true, waiting: null, sel: null };
  const C = CHAPTERS[st.ch];
  const lead = team[0]; const lf = figOf(lead, H(lead).lv);
  app.innerHTML = `<div class="scr" id="bt"><div class="bg" style="background-image:url(${CARD('arena')})"></div><div class="bg" style="background:${C.tint}"></div><div class="floor"></div><div class="vig"></div>
    <div class="stage" id="stage"><canvas id="fx"></canvas><div class="banner" id="banner"></div></div>
    <div class="bt-tl t-outline"><button id="exit">⏏</button>${st.name}${st.boss ? ' ☠' : ''}</div>
    <div class="bt-tr t-outline"><div>Wave: <span id="wv">1/${st.waves.length}</span></div><small>⏱ <span id="tm">00:00</span></small><small>Total rounds</small><em id="rd">1/120</em></div>
    <div class="wavecard t-outline" id="petc"><div class="pt" style="background-image:url(${FIG('fire_roar')});background-size:190%;background-position:50% 12%"></div><span class="pi">🐉</span><span id="kc">0/5</span><div class="pb"><i id="pbar"></i></div></div>
    <div class="bt-bl"><button id="auto">A</button><button id="spd">×1</button><button id="insp">🔍</button></div>
    <div id="bbot"></div></div>`;
  const $ = (id) => document.getElementById(id);
  const sync = () => { $('auto').classList.toggle('on', S.auto); $('spd').textContent = '×' + S.speed; };
  $('auto').onclick = () => { S.auto = !S.auto; save(); sync(); if (S.auto && BT.waiting) BT.waiting(aiChoose(B, B.current)); };
  $('spd').onclick = () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; save(); sync(); };
  $('insp').onclick = () => toast('Tap any dragon to see its skills');
  $('exit').onclick = () => { if (B.over) return; if (BT.exitArm && Date.now() - BT.exitArm < 2500) { BT.alive = false; FX.stop(); st.mode ? go(st.mode) : campaign(); } else { BT.exitArm = Date.now(); toast('Tap again to retreat'); } };
  const t0 = Date.now(); BT.timer = setInterval(() => { if (!BT.alive || !document.getElementById('tm')) return clearInterval(BT.timer); const s = Math.floor((Date.now() - t0) / 1000); $('tm').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
  sync();
  FX.init($('fx'), $('stage'));
  for (const u of allUnits(B)) { const vv = unitVis(u); if (vv.anims) preloadAnims(Object.values(vv.anims)); }
  buildField();
  loop();
}
function buildField() {
  const { B } = BT; const stage = document.getElementById('stage');
  stage.querySelectorAll('.fig').forEach((e) => e.remove());
  const H0 = stage.offsetHeight, W0 = stage.offsetWidth;
  const place = (u) => {
    const v = unitVis(u); const boss = u.boss;
    let [x, y] = POS[u.side][u.slot] || POS[u.side][0];
    if (boss) { x = 74; y = 70; }
    const persp = 0.62 + 0.45 * (y / 100);
    const hgt = H0 * (boss ? 0.66 : 0.4) * persp * (boss ? 1 : Math.max(0.85, v.scale)) * (v.idle ? v.animScale || 1 : 1);
    const flip = (u.side === 'a' && v.face === 'L') || (u.side === 'e' && v.face === 'R');
    const el = document.createElement('div');
    const rr = RARITY[u.key.replace('elite_', '')];
    el.className = `fig ${u.side}${boss ? ' boss' : ''}${rr === 'L' ? ' leg' : rr === 'E' ? ' epi' : ''}`; el.dataset.uid = u.uid;
    el.style.left = x + '%'; el.style.top = y + '%'; el.style.zIndex = String(Math.round(y));
    el.innerHTML = `<div class="body"><div class="circ"></div><div class="${flip ? 'flip' : ''}" style="display:flex;align-items:flex-end;position:relative"><img class="sprite ${v.idle ? 'live' : ''}" src="${v.idle ? ANIM(v.idle) : v.src}" style="height:${hgt}px;max-width:${W0 * (boss ? 0.36 : v.idle ? 0.36 : 0.22)}px;filter:${v.filter || 'none'};animation-delay:${-Math.random() * 2}s"></div>
      <div class="hud"><div class="sts"></div><div class="row" style="position:relative"><span class="arw l">▶</span><span class="arw r">◀</span><span class="lvl">${u.lv}</span><div class="bars"><div class="hp"><u></u><i></i><s></s></div><div class="mt"><i></i></div></div></div></div></div>`;
    el.onclick = () => tapUnit(u.uid);
    el._vis = v; el._x = x; el._y = y; el._h = hgt; el._max = u.maxHp; el._uid = u.uid; el._key = u.key;
    stage.appendChild(el);
  };
  [...B.allies, ...B.enemies].forEach(place);
  update(true);
}
const figEl = (uid) => document.querySelector(`.fig[data-uid="${uid}"]`);
function center(uid) {
  const el = figEl(uid), st = document.getElementById('stage'); if (!el || !st) return { x: 0, y: 0, h: 60 };
  const W0 = st.offsetWidth, H0 = st.offsetHeight;
  return { x: el._x / 100 * W0, y: el._y / 100 * H0 - el._h * 0.5, w: el._h, h: el._h };
}
function setHp(u, hp, uid) {
  const el = figEl(u ? u.uid : uid); if (!el) return;
  const max = u && el._uid === u.uid && el._key === u.key ? u.maxHp : el._max;
  const p = 100 * Math.max(0, hp) / max;
  el.querySelector('.hp i').style.width = p + '%'; el.querySelector('.hp u').style.width = p + '%';
  const sh = u && el._key === u.key ? u.statuses.find((s) => s.type === 'shield') : null;
  el.querySelector('.hp s').style.width = sh ? Math.min(100, 100 * sh.value / max) + '%' : '0';
}
function update(full) {
  const { B } = BT;
  const wv = document.getElementById('wv'); if (!wv) return;
  wv.textContent = `${B.wave + 1}/${B.waves}`;
  document.getElementById('rd').textContent = `${round(B)}/120`;
  document.getElementById('kc').textContent = `${B.pet}/${B.petMax}`; document.getElementById('pbar').style.width = (100 * B.pet / B.petMax) + '%';
  document.getElementById('petc').classList.toggle('full', B.petReady);
  for (const u of allUnits(B)) {
    const el = figEl(u.uid); if (!el) continue;
    if (full) setHp(u, u.hp);
    el.querySelector('.mt i').style.width = Math.min(100, u.meter) + '%';
    el.classList.toggle('dead', !u.alive);
    el.classList.toggle('frozen', u.statuses.some((s) => s.type === 'freeze'));
    const seen = {}; for (const s of u.statuses) seen[s.type] = (seen[s.type] || 0) + 1;
    el.querySelector('.sts').innerHTML = u.alive ? Object.entries(seen).slice(0, 7).map(([t, n]) => `<span class="${STATUS[t].buff ? '' : 'd'}">${STATUS[t].icon}${n > 1 ? `<sub style="font-size:.6em">${n}</sub>` : ''}</span>`).join('') : '';
  }
  highlight();
}
function highlight() {
  const { B, sel } = BT; const cur = B.current;
  document.querySelectorAll('.fig').forEach((e) => e.classList.remove('cur', 'tgt'));
  if (cur) figEl(cur.uid)?.classList.add('cur');
  if (BT.waiting && sel) {
    const sk = cur.skills.find((s) => s.id === sel);
    if (sk.target === 'enemy') legalTargets(B, cur, sk).forEach((t) => figEl(t.uid)?.classList.add('tgt'));
  }
}
function floatAt(uid, text, cls = '', dy = 0) {
  const st = document.getElementById('stage'); if (!st) return;
  const c = center(uid); const d = document.createElement('div');
  d.className = 'fl ' + cls; d.textContent = text;
  d.style.left = (c.x + (Math.random() * 30 - 15)) + 'px'; d.style.top = (c.y - c.h * 0.3 + dy) + 'px';
  st.appendChild(d); setTimeout(() => d.remove(), 1150);
}
function banner(t) { const b = document.getElementById('banner'); if (!b) return; b.textContent = t; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
function shake(px = 8, ms = 300) { document.getElementById('stage')?.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px / 2}px,${px}px)` }, { transform: 'translate(0,0)' }], { duration: ms / S.speed }); }

function panel() {
  const { B } = BT; const el = document.getElementById('bbot'); if (!el) return;
  const u = B.current;
  if (!u || u.side !== 'a' || !BT.waiting) { el.innerHTML = ''; highlight(); return; }
  const usable = usableSkills(u); const sel = u.skills.find((s) => s.id === BT.sel);
  const cols = { red: ['#ff8a3c', '#7a1d06'], blue: ['#59b8ff', '#0b3a8a'], green: ['#7ae86a', '#1b5a1a'], force: ['#ffd76a', '#7a5208'] }[u.mark];
  const kindTag = sel.id === 'basic' ? 'Basic attack' : 'Active skill';
  const desc = esc(skillDesc(sel)).replace(/(Burn|Poison|Stun|Freeze|Shield|Taunt|Severe Wound|Silence|DEF Down|ATK Down|SPD Down|ATK Up|DEF Up|SPD Up|Regen|Immunity|turn meter)/g, '<em>[$1]</em>');
  el.innerHTML = `<div class="skinfo"><span class="si" style="background:radial-gradient(circle at 50% 30%,${cols[0]},${cols[1]})"><b>${skIco(u.key, sel.id, skillIcon(sel))}</b><i>${H(u.key)?.st || 1}</i></span><span class="nm">${esc(sel.name)}</span>
      <span class="tg"><span>${kindTag}</span>${sel.cd ? `<span class="c">⟳ ${sel.cd}</span>` : ''}</span><p>${sel.target === 'enemy' ? '👉 Tap an enemy to attack. ' : '👉 Tap the skill again to cast. '}${desc}</p></div>
    <div class="skb">${u.skills.map((sk) => { const ok = usable.includes(sk); return `<button class="sbtn ${sk.id === 's2' ? 'ult' : ''} ${sk.id === BT.sel ? 'sel' : ''}" data-sk="${sk.id}" ${ok ? '' : 'disabled'} style="background:radial-gradient(circle at 50% 30%,${cols[0]},${cols[1]})"><span class="gl">${skIco(u.key, sk.id, skillIcon(sk))}</span>${!ok ? `<span class="cd">${u.cds[sk.id] > 0 ? u.cds[sk.id] : '🤐'}</span>` : ''}</button>`; }).join('')}
      <button class="sbtn pas" id="pas" style="background:radial-gradient(circle at 50% 30%,${cols[0]},${cols[1]})"><span class="gl" style="font-size:1.6em">${skIco(u.key, 'p', '◈')}</span><span class="p">P</span></button>${HEROES[u.key].passive2 ? `<button class="sbtn pas" id="pas2" style="background:radial-gradient(circle at 50% 30%,${cols[0]},${cols[1]})"><span class="gl" style="font-size:1.6em">✦</span><span class="p">P</span></button>` : ''}</div>`;
  el.querySelectorAll('[data-sk]').forEach((b) => b.onclick = () => {
    const sk = u.skills.find((s) => s.id === b.dataset.sk); SFX.click();
    if (BT.sel === sk.id && sk.target !== 'enemy') { BT.waiting({ skillId: sk.id }); return; }
    BT.sel = sk.id; panel();
  });
  el.querySelector('#pas').onclick = () => skillPopup(HEROES[u.key]);
  el.querySelector('#pas2')?.addEventListener('click', () => skillPopup(HEROES[u.key], null, true));
  highlight();
}
function tapUnit(uid) {
  const { B } = BT; const u = allUnits(B).find((x) => x.uid === uid);
  if (BT.waiting && BT.sel) {
    const cur = B.current; const sk = cur.skills.find((s) => s.id === BT.sel);
    if (sk.target === 'enemy' && legalTargets(B, cur, sk).includes(u)) { BT.waiting({ skillId: sk.id, targetUid: uid }); return; }
    if (sk.target !== 'enemy' && u.side === 'a') { BT.waiting({ skillId: sk.id }); return; }
  }
  const t = u.side === 'a' ? HEROES[u.key] : ENEMIES[u.key];
  popup(`<div style="display:flex;gap:.8em;align-items:center"><div style="width:4em">${unitCard(u)}</div><div><h3 style="margin:0">${esc(u.name)}</h3><div style="color:var(--dim)">${mk(u.mark)} ${MARKS[u.mark].label} · ${esc(t.role)} · HP ${fmt(u.hp)}/${fmt(u.maxHp)} · SPD ${u.spd}</div></div></div><div class="sep"></div>
    ${t.passive && t.passive.name ? `<div style="margin:.3em 0"><b>◈ ${esc(t.passive.name)}</b> <span style="color:var(--gold);font-size:.8em">PASSIVE</span><br><span style="font-size:.9em">${esc(t.passive.desc)}</span></div>` : ''}
    ${t.passive2 ? `<div style="margin:.3em 0"><b>✦ ${esc(t.passive2.name)}</b> <span style="color:var(--gold);font-size:.8em">PASSIVE</span><br><span style="font-size:.9em">${esc(t.passive2.desc)}</span></div>` : ''}
    ${t.skills.map((sk) => `<div style="margin:.3em 0"><b>${skillIcon(sk)} ${esc(sk.name)}</b> <span style="color:var(--gold);font-size:.8em">${skillKind(sk).toUpperCase()}${u.cds[sk.id] > 0 ? ` · READY IN ${u.cds[sk.id]}` : ''}</span><br><span style="font-size:.9em">${esc(skillDesc(sk))}</span></div>`).join('')}
    ${u.statuses.length ? `<div class="sep"></div>${u.statuses.map((s) => `<div style="font-size:.85em">${STATUS[s.type].icon} <b>${STATUS[s.type].label}</b> — ${STATUS[s.type].desc} · ${s.turns}t</div>`).join('')}` : ''}`);
}
function result() {
  const { B, st } = BT; FX.stop(); clearInterval(BT.timer);
  if (st.mode) return modeResult();
  const flags = starFlags(B);
  const { win, n, rw, drops, chapterGift, xp, ups, artDrops } = grantStage(st, B);
  const score = (a) => a.dmgDone + a.healDone + a.shieldDone;
  const mvp = [...B.allies].sort((a, b) => score(b) - score(a))[0]; const mv = unitVis(mvp);
  const maxD = Math.max(1, ...B.allies.map((a) => a.dmgDone));
  const nextG = st.g + 1;
  const ov = document.createElement('div'); ov.className = 'res-ov';
  ov.innerHTML = `${win ? '<div class="rays"></div>' : ''}
    <div class="res-l"><div class="res-t ${win ? '' : 'lose'}">${win ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="bst">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</span>`).join('')}</div>
      <div class="mvp"><img src="${mv.src}" style="filter:${mv.filter};${mv.face === 'L' ? 'transform:scaleX(-1)' : ''}"></div>
      <div class="t-outline" style="font-weight:900"><span style="background:var(--gold);color:#000;padding:0 .4em;border-radius:.2em;margin-right:.4em">MVP</span>${esc(mvp.name)}</div></div>
    <div class="res-r panel" style="padding:.8em 1em">
      ${starRules(B).map((r, i) => `<div style="font-size:.9em">${flags[i] ? '✅' : '▫️'} ${r}</div>`).join('')}<div class="sep"></div>
      ${B.allies.map((a) => `<div class="dmgrow"><div style="width:2.4em">${unitCard(a)}</div><div style="width:6em;font-weight:800">${esc(a.name)}</div><div class="bb"><i style="width:${100 * a.dmgDone / maxD}%"></i></div><div style="width:3.5em;text-align:right">${fmt(a.dmgDone)}</div></div>`).join('')}
      <div class="sep"></div><div style="display:flex;gap:.4em;justify-content:center"><span class="itm">🪙<b>${fmt(rw.gold)}</b></span><span class="itm pu">🔮<b>${fmt(rw.ess)}</b></span>${rw.gems ? `<span class="itm bl">💎<b>${rw.gems}</b></span>` : ''}${rw.runes ? `<span class="itm gr">📜<b>${rw.runes}</b></span>` : ''}${rw.tomes ? `<span class="itm bl">📘<b>${rw.tomes}</b></span>` : ''}${rw.eyes ? `<span class="itm pu">👁️<b>${rw.eyes}</b></span>` : ''}${rw.dust ? `<span class="itm">✨<b>${rw.dust}</b></span>` : ''}${artDrops.map((a) => `<span class="gs art ${a.r}"><span class="gi">${ART_SLOTS[a.slot].ic}</span></span>`).join('')}</div>
      <div style="text-align:center;font-weight:800;font-size:.85em;margin-top:.3em">✨ +${xp} XP to each dragon</div>${upsRow(ups)}
      ${drops.length ? `<div style="display:flex;gap:.3em;justify-content:center;margin-top:.4em;flex-wrap:wrap">${drops.map((it) => gearCard(it)).join('')}</div>` : ''}
      ${win ? '' : `<div style="font-size:.85em;margin-top:.5em;color:#ffd9a0">💡 Level up and evolve dragons, summon new ones or change the team${st.boss ? ' — read the boss rule!' : '.'}</div>`}
      <div style="display:flex;gap:.5em;margin-top:.7em;justify-content:center"><button class="dark" id="home">🏰</button><button class="dark" id="up">🐉 Upgrade</button>
      ${win && nextG < STAGE_COUNT ? '<button class="gold" id="next">Next ►</button>' : '<button class="gold" id="retry">Retry</button>'}</div></div>`;
  document.getElementById('bt').appendChild(ov);
  win ? SFX.win() : SFX.lose();
  BT.alive = false;
  if (chapterGift) setTimeout(() => chapterReward(st, chapterGift), 1600);
  ov.querySelector('#home').onclick = () => home();
  ov.querySelector('#up').onclick = () => dragons();
  ov.querySelector('#next')?.addEventListener('click', () => { viewCh = Math.floor(nextG / PER); campaign(); setTimeout(() => stagePopup(stageDef(nextG, st.diff)), 50); });
  ov.querySelector('#retry')?.addEventListener('click', () => battle(st));
}

// ======================= DUNGEONS =======================
const GATES = [
  { id: 'fury', boss: 'infernal', set: 'fury', lb: 'Gate of Embers', bg: 'bg_fire', ch: 0, mobs: ['whelp_fire', 'drake_fire', 'whelp_shadow'] },
  { id: 'vamp', boss: 'venomqueen', set: 'vamp', lb: 'Gate of the Swarm', bg: 'bg_venom', ch: 1, mobs: ['whelp_venom', 'whelp_moss', 'whelp_gold'] },
  { id: 'swift', boss: 'tyrant', set: 'swift', lb: 'Gate of Storms', bg: 'bg_ice', ch: 2, mobs: ['whelp_frost', 'whelp_shadow', 'whelp_gold'] },
  { id: 'guard', boss: 'colossus', set: 'guard', lb: 'Gate of Stone', bg: 'bg_fire', ch: 0, mobs: ['whelp_moss', 'whelp_shadow', 'drake_fire'] },
];
const FLOORS = 20;
function gateStage(G, f) {
  const r = rngOf(f * 13 + G.id.length); const pick = () => G.mobs[Math.floor(r() * G.mobs.length)];
  return { mode: 'dungeons', gate: G.id, floor: f, id: `d-${G.id}-${f}`, g: -1, ch: G.ch, n: 9, name: `F${f}`, title: `${G.lb} · Floor ${f}`, level: 4 + f * 3, mul: 1.6 + f * 0.13,
    waves: [[pick(), pick(), pick(), pick()], [pick(), G.boss, pick()]], boss: G.boss, reward: { gold: 1500 + f * 900, ess: 500 + f * 300, gems: 30 } };
}
function dungeons() {
  daily();
  app.innerHTML = `<div class="scr"><div class="bg" style="background-image:url(${CARD('bg_hub')});filter:brightness(.3) blur(3px)"></div>
    ${navBtns('<span class="serif">Dungeon Gates</span>')}<div class="res"><div class="p"><i>🗝️</i><b>${S.keys}/6</b></div><div class="p"><i>🪙</i><b>${fmt(S.gold)}</b></div></div>
    <div class="gates">${GATES.map((G) => { const v = EVIS[G.boss]; const best = S.dung[G.id] || 0;
      return `<button class="gate" data-gate="${G.id}" style="--sc:${SETS[G.set].col};background-image:linear-gradient(transparent 30%,rgba(0,0,0,.9)),url(${CARD(G.bg)})">
        <div class="gb"><img src="${FIG(v.fig)}" style="filter:${v.filter || 'none'};${v.face === 'R' ? 'transform:scaleX(-1)' : ''}"></div>
        <div class="gt t-outline"><b class="serif">${G.lb}</b><span style="color:${SETS[G.set].col}">◆ ${SETS[G.set].lb} set</span><span>Floor ${best}/${FLOORS}</span></div></button>`; }).join('')}</div>
    <div class="t-outline" style="position:absolute;left:0;right:0;bottom:.8em;text-align:center;font-weight:800;font-size:.95em">Each gate boss has its own rule and drops its own gear set. 1 🗝️ per fight · keys refill daily</div></div>`;
  wire();
  app.querySelectorAll('[data-gate]').forEach((b) => b.onclick = () => gatePopup(GATES.find((G) => G.id === b.dataset.gate)));
}
function gatePopup(G) {
  const best = S.dung[G.id] || 0; const next = Math.min(FLOORS, best + 1);
  const rule = ENEMIES[G.boss].passive.desc.replace('BOSS RULE: ', '');
  popup(`<h3 class="serif">${G.lb}</h3><div style="color:${SETS[G.set].col};font-weight:800">Drops: ${SETS[G.set].lb} set — 2pc ${SETS[G.set].d2} · 4pc ${SETS[G.set].d4}</div><div class="sep"></div>
    <div style="padding:.3em .5em;border-left:3px solid #c47cff;background:rgba(150,80,220,.15);font-size:.9em;margin-bottom:.5em"><b>☠ ${esc(ENEMIES[G.boss].name)}:</b> ${esc(rule)}</div>
    <div class="floors">${Array.from({ length: FLOORS }, (_, i) => i + 1).map((f) => `<button class="fl-b ${f <= best ? 'done' : f === next ? 'cur' : 'lock'}" data-f="${f}" ${f > next ? 'disabled' : ''}>${f}</button>`).join('')}</div>
    <div style="font-size:.85em;color:var(--dim);margin-top:.5em">Higher floors drop Epic and Legendary pieces. Cleared floors can be replayed for more gear.</div>`, (ov, close) => {
    ov.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { close(); formation(gateStage(G, +b.dataset.f)); });
  });
}

// ======================= ARENA =======================
const TIERS = [[0, 'Bronze III', '#c98a4a'], [900, 'Bronze II', '#c98a4a'], [1000, 'Bronze I', '#c98a4a'], [1100, 'Silver III', '#c8d0de'], [1200, 'Silver II', '#c8d0de'], [1300, 'Silver I', '#c8d0de'],
  [1400, 'Gold III', '#ffcf3a'], [1550, 'Gold II', '#ffcf3a'], [1700, 'Gold I', '#ffcf3a'], [1900, 'Diamond', '#7fb6ff'], [2200, 'Dragon Lord', '#ff6a3c']];
const tierOf = (p) => [...TIERS].reverse().find((t) => p >= t[0]);
const BOT_NAMES = ['Ashwing', 'Kael the Bold', 'Mira Frostclaw', 'Draven', 'Lyra Stormborn', 'Old Grimfang', 'Seraphine', 'Thorne', 'Nyx Hunter', 'Valkor', 'Embermaw', 'Skye'];
function arenaOpps() {
  const r = rngOf(S.arena.seed * 7 + 3); const keys = Object.keys(HEROES);
  const mine = S.team.filter(owned); const avg = mine.length ? mine.reduce((a, k) => a + H(k).lv, 0) / mine.length : 1;
  return [0.85, 1, 1.18].map((diff, i) => {
    const pool = [...keys]; const team = [];
    while (team.length < 5) team.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const lv = Math.max(1, Math.round(avg * diff * (0.9 + r() * 0.2) + (S.arena.pts - 800) / 60));
    const lvOf = Object.fromEntries(team.map((k) => ['elite_' + k, lv]));
    const power = team.reduce((a, k) => { const t = HEROES[k]; const m = levelMul(lv) * RAR_MUL[RARITY[k]]; return a + powerOf({ hp: t.hp * m, atk: t.atk * m, def: t.def * m, spd: t.spd, crit: t.crit }); }, 0);
    return { mode: 'arena', id: `ar-${S.arena.seed}-${i}`, g: -1, ch: i % 3, n: 0, name: 'Arena', oppName: BOT_NAMES[Math.floor(r() * BOT_NAMES.length)], title: '', level: lv, lvOf, rar: true, mul: 1,
      waves: [team.map((k) => 'elite_' + k)], power: Math.round(power), ptsWin: [18, 25, 34][i], ptsLose: [12, 9, 6][i], reward: { gold: 2000 + lv * 120, ess: 600 + lv * 40, gems: [20, 30, 45][i] } };
  }).sort((a, b) => a.power - b.power).map((o, i) => ({ ...o, ptsWin: [18, 25, 34][i], ptsLose: [12, 9, 6][i], reward: { ...o.reward, gems: [20, 30, 45][i] }, title: `Arena · vs ${o.oppName}` }));
}
function botTeam(seed, lv) {
  const r = rngOf(seed); const pool = Object.keys(HEROES); const team = [];
  while (team.length < 5) team.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return team;
}
function simulateDefense() {
  if (!S.defense || !S.defense.filter(owned).length) return [];
  const hours = Math.min(48, (Date.now() - S.lastDef) / 3600e3); const n = Math.min(4, Math.floor(hours / 3));
  if (!n) return [];
  const out = []; const def = S.defense.filter(owned);
  const avg = def.reduce((a, k) => a + H(k).lv, 0) / def.length;
  for (let i = 0; i < n; i++) {
    const seed = Math.floor(Date.now() / 1000) + i * 17; const r = rngOf(seed);
    const lv = Math.max(1, Math.round(avg * (0.85 + r() * 0.4))); const bt = botTeam(seed, lv);
    const st = { mode: 'arena', id: 'def', g: -1, ch: 0, n: 0, name: 'Defense', level: lv, lvOf: Object.fromEntries(bt.map((k) => ['elite_' + k, lv])), rar: true, mul: 1, waves: [bt.map((k) => 'elite_' + k)], reward: {} };
    const B = makeBattle(def, st); runAuto(B);
    const held = B.result === 'victory'; const pts = held ? 6 : -10;
    S.arena.pts = Math.max(800, S.arena.pts + pts);
    out.push({ t: Date.now() - (n - i) * 3 * 3600e3, opp: BOT_NAMES[Math.floor(r() * BOT_NAMES.length)], win: held, pts, defense: 1, team: bt, lv, rounds: round(B), mvp: [...B.allies].sort((a, b) => b.dmgDone - a.dmgDone)[0].key });
  }
  S.lastDef = Date.now(); S.alog = [...out.reverse(), ...S.alog].slice(0, 30); save();
  return out;
}
function defensePick() {
  let pick = (S.defense || S.team).filter(owned).slice(0, 5);
  const mine = Object.keys(S.heroes).sort((a, b) => heroPower(b) - heroPower(a));
  const draw = (ov) => {
    ov.querySelector('.pop').innerHTML = `<button class="x">✕</button><h3 class="serif">🛡️ Defense team</h3><div style="color:var(--dim);font-size:.85em">Other players attack this team while you are away. Holding earns trophies.</div><div class="sep"></div>
      <div style="display:flex;gap:.4em;margin-bottom:.5em">${[0, 1, 2, 3, 4].map((i) => pick[i] ? `<div style="width:4em">${pcard(pick[i])}</div>` : '<div class="empty" style="width:4em;aspect-ratio:4/5;border:2px dashed #555;border-radius:.3em"></div>').join('')}<div style="align-self:center;font-weight:900;margin-left:.5em">✊ ${fmt(pick.reduce((a, k) => a + heroPower(k), 0))}</div></div>
      <div style="display:grid;grid-template-columns:repeat(8,3.6em);gap:.3em;max-height:9em;overflow:auto">${mine.map((k) => `<button data-dk="${k}">${pcard(k, { cls: pick.includes(k) ? 'sel' : '' })}</button>`).join('')}</div>
      <div style="display:flex;gap:.5em;justify-content:center;margin-top:.6em"><button class="dark" id="dbest">Strongest</button><button class="gold" id="dsave" ${pick.length ? '' : 'disabled'}>Save defense</button></div>`;
    ov.querySelector('.x').onclick = () => ov.remove();
    ov.querySelectorAll('[data-dk]').forEach((b) => b.onclick = () => { const k = b.dataset.dk; pick = pick.includes(k) ? pick.filter((x) => x !== k) : pick.length < 5 ? [...pick, k] : pick; draw(ov); });
    ov.querySelector('#dbest').onclick = () => { pick = mine.slice(0, 5); draw(ov); };
    ov.querySelector('#dsave').onclick = () => { S.defense = pick; if (!S.lastDef || S.alog.length === 0) S.lastDef = Date.now(); save(); ov.remove(); toast('Defense team saved'); arena(); };
  };
  const ov = popup(''); draw(ov);
}
function arenaLog() {
  const ago = (t) => { const m = Math.floor((Date.now() - t) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`; };
  popup(`<h3 class="serif">📜 Battle record</h3><div class="sep"></div>${S.alog.length ? `<div style="max-height:17em;overflow:auto">${S.alog.map((x) => `<div class="trow" style="grid-template-columns:5.5em 1fr auto auto"><span style="color:${x.defense ? '#9ecbff' : '#ffd9a0'};font-weight:900">${x.defense ? '🛡️ Defense' : '⚔️ Attack'}</span>
    <span>${x.win ? '✅' : '❌'} vs <b>${esc(x.opp)}</b> <span style="color:var(--dim);font-size:.85em">Lv ${x.lv || '?'} · ${x.rounds || '?'} rounds · ${ago(x.t)}</span></span><span style="color:${x.pts >= 0 ? '#7dff9a' : '#ff8a7a'};font-weight:900">${x.pts >= 0 ? '+' : ''}${x.pts}</span>
    <span>${x.mvp && HEROES[x.mvp] ? `<span style="font-size:.8em">MVP ${esc(HEROES[x.mvp].name)}</span>` : ''}</span></div>`).join('')}</div>` : '<div style="color:var(--dim)">No battles yet.</div>'}`);
}
function arena() {
  daily(); const incoming = simulateDefense(); const T = tierOf(S.arena.pts); const opps = arenaOpps();
  app.innerHTML = `<div class="scr"><div class="bg" style="background-image:url(${CARD('arena')});filter:brightness(.4)"></div>
    ${navBtns('<span class="serif">Arena</span>')}<div class="res"><div class="p"><i>🎫</i><b>${S.tickets}/6</b></div><div class="p"><i>💎</i><b>${fmt(S.gems)}</b></div></div>
    <div class="arank panel"><div class="serif" style="font-size:1.1em;color:var(--dim)">Your rank</div><div class="tier" style="color:${T[2]}">🏆 ${T[1]}</div>
      <div style="font-size:1.8em;font-weight:900">🏆 ${S.arena.pts}${(() => { const nx = TIERS.find((t) => t[0] > S.arena.pts); return nx ? `<span style="font-size:.5em;color:var(--dim)">/${nx[0]}</span>` : ''; })()}</div><div style="color:var(--dim)">Wins: ${S.arena.wins}</div><div class="sep"></div>
      <button class="blue" id="rank" style="font-size:.95em;padding:.35em 1em;width:100%">Rating</button>
      <div style="display:flex;gap:.3em;margin-top:.35em"><button class="dark" id="defb" style="flex:1;font-size:.85em">🛡️ Defense</button><button class="dark" id="logb" style="flex:1;font-size:.85em">📜 Record</button></div>
      ${S.defense ? `<div style="display:flex;gap:.15em;justify-content:center;margin-top:.35em">${S.defense.filter(owned).map((k) => `<div style="width:2.1em;font-size:.55em">${pcard(k)}</div>`).join('')}</div>` : '<div style="font-size:.75em;color:#ffd9a0;margin-top:.3em">⚠ Set a defense team!</div>'}
      <div style="font-size:.75em;line-height:1.45;margin-top:.4em">${TIERS.filter((t, i) => i % 3 === 0 || i >= 9).map((t) => `<div style="color:${t[2]};opacity:${S.arena.pts >= t[0] ? 1 : .45}">${t[1].split(' ')[0]} ${t[1].includes('Dragon') ? 'Lord' : ''} — ${t[0]}+</div>`).join('')}</div>
      <div style="font-size:.8em;color:var(--dim);margin-top:.4em">Weekly reward: 💎 ${100 + TIERS.indexOf(T) * 80}</div></div>
    <div class="opps">${opps.map((o, i) => `<div class="opp panel"><div style="width:9em"><b>${esc(o.oppName)}</b><div style="color:var(--dim);font-size:.85em">Lv ${o.level} · ✊ ${fmt(o.power)}</div><div style="font-size:.8em;color:${['#7dff9a', '#ffd23a', '#ff8a7a'][i]}">${['Easy', 'Even', 'Hard'][i]} · +${o.ptsWin} pts</div></div>
      <div class="omini">${o.waves[0].map((ek) => { const hk = ek.slice(6); const v = VIS[hk]; return `<div class="pc ${v.r}" style="width:3.4em">${photo(FIG(v.forms[2]), v.face[2], v.filter || '')}${mk(HEROES[hk].mark)}<span class="lv" style="font-size:.9em">${o.level}</span></div>`; }).join('')}</div>
      <button class="gold" data-o="${i}" style="font-size:1em;padding:.4em 1em">⚔ Fight</button></div>`).join('')}
      <div style="text-align:right"><button class="dark" id="refresh">↻ New opponents</button></div></div></div>`;
  wire();
  app.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => formation(opps[+b.dataset.o]));
  app.querySelector('#refresh').onclick = () => { S.arena.seed++; save(); arena(); };
  app.querySelector('#rank').onclick = arenaRating;
  app.querySelector('#defb').onclick = defensePick;
  app.querySelector('#logb').onclick = arenaLog;
  if (incoming.length) popup(`<h3 class="serif">🛡️ While you were away</h3><div class="sep"></div>${incoming.map((x) => `<div class="trow" style="grid-template-columns:1fr auto"><span>${x.win ? '✅ Defended against' : '❌ Lost to'} <b>${esc(x.opp)}</b></span><b style="color:${x.pts >= 0 ? '#7dff9a' : '#ff8a7a'}">${x.pts >= 0 ? '+' : ''}${x.pts}</b></div>`).join('')}<div style="margin-top:.4em;font-weight:800">Now: 🏆 ${S.arena.pts}</div>`);
}

function arenaRating() {
  const r = rngOf(99); const ppl = Array.from({ length: 60 }, (_, i) => ({ n: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ' ' + (i + 7) : ''), p: Math.round(2600 - i * 30 - r() * 25), pw: Math.round(4.2e6 / (1 + i * 0.12)) }));
  const me = { n: 'You', p: S.arena.pts, pw: teamPower(), me: 1 }; const all = [...ppl, me].sort((a, b) => b.p - a.p); const pos = all.indexOf(me) + 1;
  const row = (x, i) => `<div class="trow" style="grid-template-columns:2.5em 1fr 6em 5em;${x.me ? 'background:rgba(80,140,255,.25)' : ''}"><b style="color:${i < 3 ? 'var(--gold)' : '#fff'}">${i + 1}</b><span>${x.me ? '<b>You</b>' : esc(x.n)}</span><span>✊ ${fmt(x.pw)}</span><span style="color:${tierOf(x.p)[2]}">🏆 ${x.p}</span></div>`;
  popup(`<h3 class="serif">Arena Rating</h3><div class="sep"></div><div style="max-height:16em;overflow:auto">${all.slice(0, 10).map(row).join('')}</div><div class="sep"></div>${row(me, pos - 1)}
    <div style="font-size:.8em;color:var(--dim);margin-top:.3em">Rating is simulated for now — real players come with the online version.</div>`);
}

// ======================= DRAGON SPIRIT =======================
const petCost = (lv) => ({ ess: 1500 * lv, gold: 4000 * lv });
function spirit() {
  const lv = S.petLv; const c = petCost(lv);
  popup(`<div style="display:flex;gap:1em;align-items:center"><img src="${FIG('fire_roar')}" style="width:9em;filter:sepia(.6) saturate(2) hue-rotate(-10deg) brightness(1.25) drop-shadow(0 0 1em #ffb43c)">
    <div><h3 class="serif">Ancestral Dragon Spirit</h3><div style="color:var(--gold);font-weight:900">Lv.${lv}/60</div>
    <p style="font-size:.9em;line-height:1.4;margin:.4em 0">Charges 1/5 every time your dragon acts. At 5/5 it roars: damages all enemies (${Math.round(90 * (1 + 0.06 * (lv - 1)))}% avg ATK), may lower their DEF, gives all allies ATK Up, +15% turn meter and a Shield of ${(6 + 0.6 * (lv - 1)).toFixed(1)}% max HP.</p>
    <div style="font-size:.85em;color:var(--dim)">Each level: +6% damage, +0.6% shield</div></div></div><div class="sep"></div>
    <div style="text-align:center"><button class="gold" id="pup" ${lv >= 60 || S.ess < c.ess || S.gold < c.gold ? 'disabled' : ''}>${lv >= 60 ? 'MAX' : `Level up · 🔮${fmt(c.ess)} 🪙${fmt(c.gold)}`}</button></div>`, (ov, close) => {
    ov.querySelector('#pup').onclick = () => { if (S.ess < c.ess || S.gold < c.gold) return; S.ess -= c.ess; S.gold -= c.gold; S.petLv++; bump('lvup'); save(); SFX.coin(); close(); spirit(); };
  });
}

// ======================= TASKS =======================
const DAILY_TASKS = [['win', 3, 'Win 3 campaign battles', 20], ['summon', 2, 'Summon 2 dragons', 15], ['lvup', 5, 'Level up dragons 5 times', 15], ['gear', 2, 'Upgrade gear 2 times', 15], ['dung', 2, 'Clear 2 dungeon floors', 20], ['arena', 3, 'Fight 3 arena battles', 15]];
const DAILY_CHESTS = [[40, { runes: 2, gold: 5000, tomes: 2 }], [70, { gems: 100, ess: 3000, tomes: 3 }], [100, { runes: 3, gems: 150, tomes: 5 }]];
const ACHS = [
  ['ch1', 'Clear chapter 1', () => !!S.chapters[0], { gems: 300 }], ['ch2', 'Clear chapter 2', () => !!S.chapters[1], { gems: 500 }], ['ch3', 'Clear chapter 3', () => !!S.chapters[2], { gems: 800, runes: 10 }],
  ['col6', 'Collect 6 dragons', () => Object.keys(S.heroes).length >= 6, { runes: 5 }], ['col12', 'Collect all 12 dragons', () => Object.keys(S.heroes).length >= 12, { gems: 1000 }],
  ['asc', 'Evolve a dragon to Ascended (Lv 30)', () => Object.values(S.heroes).some((h) => h.lv >= 30), { runes: 5 }],
  ['star5', 'Raise a dragon to 5★', () => Object.values(S.heroes).some((h) => h.st >= 5), { gems: 500 }],
  ['set4', 'Equip a full 4-piece set', () => Object.keys(S.heroes).some((k) => Object.values(gearBonus(k).sets).some((n) => n >= 4)), { runes: 3, gold: 20000 }],
  ['hard1', 'Clear chapter 1 on Hard', () => !!S.chapters.hard0, { gems: 600, eyes: 2 }], ['hell1', 'Clear chapter 1 on Hell', () => !!S.chapters.hell0, { gems: 2000, eyes: 5 }],
  ['d10', 'Reach floor 10 in any gate', () => Object.values(S.dung).some((f) => f >= 10), { gems: 400 }],
  ['gold', 'Reach Gold rank in the arena', () => S.arena.pts >= 1250, { gems: 400 }],
];
const dailyPts = () => DAILY_TASKS.reduce((a, [k, n, , p]) => a + ((daily().c[k] || 0) >= n ? p : 0), 0);
const taskDot = () => DAILY_CHESTS.some(([p], i) => dailyPts() >= p && !daily().claimed[i]) || ACHS.some(([id, , ok]) => ok() && !S.ach[id]);
const giveRw = (rw) => { for (const [k, v] of Object.entries(rw)) if (typeof v === 'number') S[k] = (S[k] || 0) + v; };
const rwStr = (rw) => Object.entries(rw).map(([k, v]) => `${{ gold: '🪙', ess: '🔮', gems: '💎', runes: '📜', tomes: '📘', eyes: '👁️' }[k]}${fmt(v)}`).join(' ');
let taskTab = 'daily';
function tasks() {
  const d = daily(); const pts = dailyPts();
  popup(`<div class="tabs2"><button data-t="daily" class="${taskTab === 'daily' ? 'on' : ''}">Daily</button><button data-t="ach" class="${taskTab === 'ach' ? 'on' : ''}">Achievements</button></div><div class="sep"></div>
    ${taskTab === 'daily' ? `<div style="display:flex;align-items:center;gap:.6em;margin-bottom:.5em"><b>Activity ${pts}/100</b><div class="bar" style="flex:1"><i style="width:${pts}%"></i></div>
      ${DAILY_CHESTS.map(([p, rw], i) => `<button class="${pts >= p && !d.claimed[i] ? 'gold' : 'dark'}" data-c="${i}" style="font-size:.8em;padding:.3em .6em" ${pts < p || d.claimed[i] ? 'disabled' : ''}>${d.claimed[i] ? '✅' : '🎁'} ${p}</button>`).join('')}</div>
      ${DAILY_TASKS.map(([k, n, lb, p]) => { const v = Math.min(n, d.c[k] || 0); return `<div class="trow ${v >= n ? 'ok' : ''}"><span>${v >= n ? '✅' : '▫️'} ${lb}</span><span>${v}/${n}</span><span style="color:var(--gold)">+${p}</span></div>`; }).join('')}`
    : ACHS.map(([id, lb, ok, rw]) => `<div class="trow ${S.ach[id] ? 'ok' : ''}"><span>${S.ach[id] ? '✅' : ok() ? '🎁' : '▫️'} ${lb}</span><span style="color:var(--gold)">${rwStr(rw)}</span>${!S.ach[id] && ok() ? `<button class="gold" data-a="${id}" style="font-size:.8em;padding:.25em .7em">Claim</button>` : '<span></span>'}</div>`).join('')}`, (ov, close) => {
    ov.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { taskTab = b.dataset.t; close(); tasks(); });
    ov.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { const i = +b.dataset.c; d.claimed[i] = 1; giveRw(DAILY_CHESTS[i][1]); save(); SFX.coin(); toast(rwStr(DAILY_CHESTS[i][1])); close(); tasks(); });
    ov.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => { const a = ACHS.find((x) => x[0] === b.dataset.a); S.ach[a[0]] = 1; giveRw(a[3]); save(); SFX.coin(); toast(rwStr(a[3])); close(); tasks(); });
  });
}

// ======================= MODE RESULT =======================
function modeResult() {
  const { B, st } = BT; const win = B.result === 'victory';
  const drops = []; let rw = { gold: 0, ess: 0, gems: 0 }; let line = '';
  if (st.mode === 'dungeons') {
    bump('dung', win ? 1 : 0);
    if (win) {
      const G = GATES.find((x) => x.id === st.gate); const firstClear = st.floor > (S.dung[G.id] || 0);
      if (firstClear) S.dung[G.id] = st.floor;
      rw = { gold: st.reward.gold, ess: st.reward.ess, gems: firstClear ? st.reward.gems : 0, tomes: 1 + Math.floor(st.floor / 7), eyes: st.floor % 5 === 0 && firstClear ? 1 : 0 };
      const f = st.floor; const n = f >= 15 ? 3 : f >= 6 ? 2 : 1;
      for (let i = 0; i < n; i++) { const x = Math.random(); const r = x < 0.03 + f * 0.022 ? 'L' : x < 0.3 + f * 0.03 ? 'E' : 'R'; const it = makeGear(r, 0); it.set = G.set; S.gear.push(it); drops.push(it); }
      { const ar = Math.random() < 0.05 + st.floor * 0.02 ? 'L' : Math.random() < 0.4 ? 'E' : 'R'; if (Math.random() < 0.45) { const a = makeArtifact(ar, ['cls', 'mark', 'fac'][Math.floor(Math.random() * 3)]); S.arts.push(a); rw.art = a; } rw.dust = 4 + st.floor; }
      line = firstClear ? `Floor ${st.floor} cleared! Floor ${Math.min(FLOORS, st.floor + 1)} unlocked.` : `Floor ${st.floor} cleared.`;
    } else line = 'The gate boss was too strong. Read its rule and bring the right dragons.';
  } else {
    bump('arena');
    const T0 = tierOf(S.arena.pts);
    if (win) { S.arena.pts += st.ptsWin; S.arena.wins++; rw = st.reward; } else { S.arena.pts = Math.max(800, S.arena.pts - st.ptsLose); rw = { gold: Math.round(st.reward.gold * 0.2), ess: 0, gems: 0 }; }
    S.arena.seed++;
    S.alog = [{ t: Date.now(), opp: st.oppName, win, pts: win ? st.ptsWin : -st.ptsLose, lv: st.level, rounds: round(B), mvp: [...B.allies].sort((a, b) => b.dmgDone - a.dmgDone)[0].key }, ...S.alog].slice(0, 30);
    const T1 = tierOf(S.arena.pts);
    line = `${win ? '+' + st.ptsWin : '−' + st.ptsLose} pts → ${S.arena.pts}${T1 !== T0 ? ` · ${win ? 'Promoted to' : 'Dropped to'} ${T1[1]}!` : ''}`;
  }
  const xpG = Math.round((40 + st.level * 9) * (win ? 1 : 0.3)); const mUps = giveXp(B.allies.map((a) => a.key), xpG);
  giveRw(rw); save();
  const ov = document.createElement('div'); ov.className = 'res-ov';
  ov.innerHTML = `${win ? '<div class="rays"></div>' : ''}<div class="res-l"><div class="res-t ${win ? '' : 'lose'}">${win ? 'VICTORY' : 'DEFEAT'}</div><div class="t-outline" style="font-weight:800;font-size:1.1em;margin-top:.4em">${esc(st.title)}</div></div>
    <div class="res-r panel" style="padding:.9em 1em"><div style="font-weight:800">${line}</div><div style="font-weight:800;font-size:.85em">✨ +${xpG} XP to each dragon</div>${upsRow(mUps)}<div class="sep"></div>
      <div style="display:flex;gap:.4em;justify-content:center;flex-wrap:wrap">${rw.gold ? `<span class="itm">🪙<b>${fmt(rw.gold)}</b></span>` : ''}${rw.ess ? `<span class="itm pu">🔮<b>${fmt(rw.ess)}</b></span>` : ''}${rw.gems ? `<span class="itm bl">💎<b>${rw.gems}</b></span>` : ''}${rw.tomes ? `<span class="itm bl">📘<b>${rw.tomes}</b></span>` : ''}${rw.eyes ? `<span class="itm pu">👁️<b>${rw.eyes}</b></span>` : ''}${rw.dust ? `<span class="itm">✨<b>${rw.dust}</b></span>` : ''}${rw.art ? `<span class="gs art ${rw.art.r}"><span class="gi">${ART_SLOTS[rw.art.slot].ic}</span></span>` : ''}${drops.map((it) => gearCard(it)).join('')}</div>
      <div style="display:flex;gap:.5em;margin-top:.8em;justify-content:center"><button class="dark" id="home">🏰</button><button class="dark" id="up">🐉 Upgrade</button><button class="gold" id="back">${st.mode === 'arena' ? 'Arena' : 'Gates'} ►</button></div></div>`;
  document.getElementById('bt').appendChild(ov);
  win ? SFX.win() : SFX.lose(); BT.alive = false;
  ov.querySelector('#home').onclick = () => home();
  ov.querySelector('#up').onclick = () => dragons();
  ov.querySelector('#back').onclick = () => go(st.mode);
}

function chapterReward(st, cg, hostEl) {
  const lv = VIS[cg.lk]; const fg = figOf(cg.lk, 1);
  const ov = document.createElement('div'); ov.className = 'reveal';
  ov.innerHTML = `<div class="rays" style="left:50%;top:40%"></div><div class="serif t-outline" style="position:relative;font-size:2.6em;color:var(--gold);font-weight:700">CHAPTER ${st.ch + 1} CLEARED!</div>
    <div style="position:relative;color:#ffe9a8;font-weight:800;margin-bottom:.4em">${esc(CHAPTERS[st.ch].name)} conquered — the dragons bow to you</div>
    <div style="position:relative;display:flex;gap:2em;align-items:center">
      <div style="width:9em">${pcard(cg.lk, { name: true, extra: `<span class="badge" style="background:#d08a12">${cg.isNew ? 'NEW' : '+1★ copy'}</span>` })}</div>
      <div style="display:grid;grid-template-columns:repeat(2,auto);gap:.5em"><span class="itm">🪙<b>${fmt(cg.gold)}</b></span><span class="itm pu">🔮<b>${fmt(cg.ess)}</b></span><span class="itm bl">💎<b>${cg.gems}</b></span><span class="itm gr">📜<b>${cg.runes}</b></span></div></div>
    <div style="position:relative;margin-top:.5em;font-weight:800">+ full Legendary gear set (4 items)</div>
    <button class="gold" style="position:relative;margin-top:.8em" id="ok">Claim</button>`;
  (hostEl || document.getElementById('bt')).appendChild(ov); SFX.legend();
  ov.querySelector('#ok').onclick = () => ov.remove();
}
const FX = {
  cv: null, cx: null, parts: [], raf: 0, w: 0, h: 0,
  init(cv, host) { this.cv = cv; const dpr = 1; this.dirty = true; this.w = host.clientWidth; this.h = host.clientHeight; cv.width = this.w * dpr; cv.height = this.h * dpr; cv.style.width = this.w + 'px'; cv.style.height = this.h + 'px'; this.cx = cv.getContext('2d'); this.cx.setTransform(dpr, 0, 0, dpr, 0, 0); this.parts = []; this.run(); },
  stop() { cancelAnimationFrame(this.raf); this.parts = []; },
  texs: new Map(),
  tex(col, kind) { // pre-rendered soft sprite: one drawImage instead of a radial gradient per particle per frame
    const key = kind + col; let t = this.texs.get(key); if (t) return t;
    t = document.createElement('canvas'); t.width = t.height = 64; const g = t.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === 'p') { gr.addColorStop(0, col); gr.addColorStop(0.5, col + 'aa'); gr.addColorStop(1, col + '00'); } else { gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.texs.set(key, t); return t;
  },
  add(p) { this.parts.push({ life: 1, age: 0, vx: 0, vy: 0, g: 0, size: 4, glow: true, shape: 'dot', ...p }); },
  burst(x, y, color, n = 24, sp = 5, size = 4, life = 0.7, g = 0.05) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random()); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, size: size * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.6), g }); } },
  ring(x, y, color, r = 60, life = 0.45, width = 4) { this.add({ x, y, color, shape: 'ring', r0: 6, r1: r, life, width }); },
  slash(x, y, color) { this.add({ x, y, color, shape: 'slash', life: 0.28, ang: -0.6 + Math.random() * 0.3, len: 90 }); this.add({ x, y, color: '#fff', shape: 'slash', life: 0.22, ang: 0.5, len: 70 }); },
  beam(a, b, color, ms = 600, w = 16) { this.add({ shape: 'beam', a, b, color, life: ms / 1000, w, seed: Math.random() * 10 }); },
  cloud(a, b, color, n = 70, ms = 700) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, sp = d / (ms / 1000 * 60);
    for (let i = 0; i < n; i++) { const j = (Math.random() - 0.5) * 0.5, k = 0.6 + Math.random() * 0.7;
      this.add({ x: a.x, y: a.y, vx: (dx / d * Math.cos(j) - dy / d * Math.sin(j)) * sp * k, vy: (dy / d * Math.cos(j) + dx / d * Math.sin(j)) * sp * k, color, size: 10 + Math.random() * 18, life: ms / 1000 * (1 + Math.random() * 0.6), g: 0, delay: Math.random() * 0.25 }); }
  },
  breath(from, targets, pal, ms = 1200, power = 1) {
    // continuous stream from the mouth that widens with distance and washes over all targets
    const tg = targets.map((t) => ({ x: t.x, y: t.y }));
    const mid = tg.reduce((a, t) => ({ x: a.x + t.x / tg.length, y: a.y + t.y / tg.length }), { x: 0, y: 0 });
    this.parts.push({ shape: 'emit', age: 0, life: ms / 1000 / S.speed, from, mid, tg, pal, power });
  },
  fireball(a, b, ms = 380, big = 1) {
    return new Promise((res) => { const t0 = performance.now(); const dur = ms / S.speed; const self = this; const arc = -Math.min(90, Math.abs(b.x - a.x) * 0.3);
      (function step() { const t = Math.min(1, (performance.now() - t0) / dur); const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + arc * Math.sin(Math.PI * t);
        self.add({ x, y, color: '#ff7a1f', size: 15 * big, life: 0.18 }); self.add({ x, y, color: '#fff2b0', size: 7 * big, life: 0.1 });
        for (let i = 0; i < 4; i++) self.add({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: -(b.x - a.x) / Math.abs(b.x - a.x || 1) * (1 + Math.random() * 2), vy: -Math.random() * 1.6, color: Math.random() < 0.5 ? '#ff4a10' : '#ffb03a', size: (4 + Math.random() * 6) * big, life: 0.45 + Math.random() * 0.3, g: -0.05 });
        if (t < 1) requestAnimationFrame(step); else { for (let i = 0; i < 40 * big; i++) { const an = Math.random() * 7, sp = 2 + Math.random() * 7 * big; self.add({ x: b.x, y: b.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 1.5, color: Math.random() < 0.4 ? '#fff0a0' : Math.random() < 0.6 ? '#ff6a1f' : '#c8240a', size: 4 + Math.random() * 7, life: 0.5 + Math.random() * 0.5, g: -0.04 }); }
          self.ring(b.x, b.y + 20, '#ff8a2a', 80 * big, 0.5, 6); res(); } })(); });
  },
  shards(a, b, ms = 340, n = 7) {
    return new Promise((res) => { const self = this; let done = 0;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 14, t0 = performance.now() + i * 30 / S.speed, dur = ms / S.speed;
        (function step() { const now = performance.now(); if (now < t0) return requestAnimationFrame(step); const t = Math.min(1, (now - t0) / dur);
          const x = a.x + (b.x - a.x) * t, y = a.y + off * (1 - t) + (b.y - a.y) * t; self.add({ shape: 'shard', x, y, ang: Math.atan2(b.y - a.y - off, b.x - a.x), color: '#bfefff', life: 0.08, len: 22 });
          self.add({ x, y, color: '#6fd0ff', size: 5, life: 0.25 });
          if (t < 1) requestAnimationFrame(step); else { for (let k = 0; k < 8; k++) { const an = Math.random() * 7; self.add({ shape: 'shard', x: b.x, y: b.y, vx: Math.cos(an) * 4, vy: Math.sin(an) * 4, ang: an, color: '#e6faff', life: 0.5, len: 10, g: 0.15 }); }
            if (++done === n) { self.ring(b.x, b.y + 20, '#9fe4ff', 70, 0.7, 5); res(); } } })(); } });
  },
  lance(a, b, color = '#ffd76a', ms = 260) {
    return new Promise((res) => { this.add({ shape: 'lance', a, b, color, life: (ms + 220) / 1000 / S.speed, grow: ms / 1000 / S.speed }); setTimeout(() => { this.burst(b.x, b.y, color, 30, 7, 5); this.ring(b.x, b.y + 20, color, 80, 0.5, 5); res(); }, ms / S.speed); });
  },
  bolt(a, b, color) { this.add({ shape: 'bolt', a, b, color, life: 0.3, seed: Math.random() }); },
  rise(x, y, color, n = 14, spread = 40) { for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * spread * 2, y: y + Math.random() * 30, vx: 0, vy: -1 - Math.random() * 2, color, size: 3 + Math.random() * 3, life: 0.9 + Math.random() * 0.4, shape: Math.random() < 0.3 ? 'plus' : 'dot' }); },
  proj(a, b, color, ms = 320, size = 10) {
    return new Promise((res) => { const t0 = performance.now(); const dur = ms / S.speed; const self = this; const arc = -Math.min(80, Math.abs(b.x - a.x) * 0.25);
      (function step() { const t = Math.min(1, (performance.now() - t0) / dur); const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t + arc * Math.sin(Math.PI * t);
        self.add({ x, y, color, size: size * 1.35, life: 0.35 }); self.add({ x, y, color: '#fff', size: size * 0.55, life: 0.14 });
        for (let i = 0; i < 2; i++) self.add({ x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, color, size: size * 0.4, life: 0.35 });
        if (t < 1) requestAnimationFrame(step); else res(); })(); });
  },
  run() {
    const loop = () => {
      const c = this.cx; if (!c) return; this.raf = requestAnimationFrame(loop); if (!this.parts.length) { if (this.dirty) { c.clearRect(0, 0, this.w, this.h); this.dirty = false; } return; } this.dirty = true; c.clearRect(0, 0, this.w, this.h); c.globalCompositeOperation = 'lighter';
      const dt = 1 / 60 * S.speed;
      this.parts = this.parts.filter((p) => { if (p.delay > 0) { p.delay -= dt; return true; } return (p.age += dt) < p.life; });
      for (const p of this.parts) {
        if (p.delay > 0) continue;
        const k = 1 - p.age / p.life; c.globalAlpha = Math.max(0, k);
        if (p.shape === 'dot' || p.shape === 'plus') { p.x += p.vx * S.speed; p.y += p.vy * S.speed; p.vy += p.g * S.speed; const s = p.size * (0.4 + k * 0.6);
          if (p.shape === 'plus') { c.fillStyle = p.color; c.fillRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6); c.fillRect(p.x - s * 0.3, p.y - s, s * 0.6, s * 2); } else { const R = s * 2.2; c.drawImage(this.tex(p.color, 'd'), p.x - R, p.y - R, R * 2, R * 2); } }
        else if (p.shape === 'ring') { const r = p.r0 + (p.r1 - p.r0) * (1 - k); c.strokeStyle = p.color; c.lineWidth = p.width * k + 1; c.shadowColor = p.color; c.shadowBlur = 0; c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.55, 0, 0, 7); c.stroke(); c.shadowBlur = 0; }
        else if (p.shape === 'slash') { const t = 1 - k; c.save(); c.translate(p.x, p.y); c.rotate(p.ang); c.strokeStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 0; c.lineCap = 'round'; c.lineWidth = 7 * k + 1; c.beginPath(); c.arc(0, 0, p.len * (0.6 + t * 0.4), -1.1, -1.1 + 2.2 * Math.min(1, t * 3)); c.stroke(); c.restore(); c.shadowBlur = 0; }
        else if (p.shape === 'emit') {
          const f = p.from, tgs = p.tg, n = this.parts.length > 260 ? 1 : Math.round(5 * p.power * S.speed);
          for (let i = 0; i < n; i++) {
            const t = tgs[Math.floor(Math.random() * tgs.length)]; const tx = t.x + (Math.random() - 0.5) * 40, ty = t.y + (Math.random() - 0.5) * 50;
            const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1; const life = 0.42 + Math.random() * 0.12; const sp = d / (life * 60) * (0.9 + Math.random() * 0.25);
            const j = (Math.random() - 0.5) * 0.18;
            this.parts.push({ shape: 'puff', x: f.x + (Math.random() - 0.5) * 6, y: f.y + (Math.random() - 0.5) * 6, vx: (dx / d * Math.cos(j) - dy / d * Math.sin(j)) * sp, vy: (dy / d * Math.cos(j) + dx / d * Math.sin(j)) * sp,
              col: p.pal[Math.floor(Math.random() * p.pal.length)], s0: 4 + Math.random() * 3, s1: (22 + Math.random() * 22) * p.power, age: 0, life });
          }
          // hot core at the mouth
          { const R = 22 * p.power; c.globalAlpha = 0.55; c.drawImage(this.tex(p.pal[0], 'd'), f.x - R, f.y - R, R * 2, R * 2); }
          if (Math.random() < 0.35 * S.speed) for (const t of tgs) this.parts.push({ x: t.x + (Math.random() - 0.5) * 50, y: t.y + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 5, vy: -1 - Math.random() * 3, color: p.pal[1], size: 4 + Math.random() * 5, life: 0.5, age: 0, g: -0.02, shape: 'dot' });
        }
        else if (p.shape === 'puff') {
          p.x += p.vx * S.speed; p.y += p.vy * S.speed; p.vx *= 0.995; p.vy *= 0.995;
          const t = p.age / p.life, s = p.s0 + (p.s1 - p.s0) * Math.pow(t, 0.7);
          c.globalCompositeOperation = t < 0.25 ? 'lighter' : 'source-over';
          c.globalAlpha = Math.max(0, (t < 0.12 ? t / 0.12 : 1) * (1 - t) * (t < 0.25 ? 0.45 : 0.6)); c.drawImage(this.tex(p.col, 'p'), p.x - s, p.y - s, s * 2, s * 2);
          c.globalCompositeOperation = 'lighter';
        }
        else if (p.shape === 'shard') { if (p.vx) { p.x += p.vx * S.speed; p.y += p.vy * S.speed; p.vy += (p.g || 0) * S.speed; } c.save(); c.translate(p.x, p.y); c.rotate(p.ang); c.fillStyle = p.color; c.shadowColor = '#6fd0ff'; c.shadowBlur = 0; c.beginPath(); c.moveTo(p.len, 0); c.lineTo(-p.len * 0.6, -p.len * 0.22); c.lineTo(-p.len * 0.3, 0); c.lineTo(-p.len * 0.6, p.len * 0.22); c.closePath(); c.fill(); c.restore(); c.shadowBlur = 0; }
        else if (p.shape === 'lance') { const g2 = Math.min(1, p.age / p.grow); const ex = p.a.x + (p.b.x - p.a.x) * g2, ey = p.a.y + (p.b.y - p.a.y) * g2; c.lineCap = 'round';
          for (const [w, col, bl] of [[18, p.color, 30], [8, '#fff6d0', 12], [3, '#ffffff', 4]]) { c.strokeStyle = col; c.shadowColor = p.color; c.shadowBlur = 0; c.lineWidth = w * k + 1; c.beginPath(); c.moveTo(p.a.x, p.a.y); c.lineTo(ex, ey); c.stroke(); } c.shadowBlur = 0; }
        else if (p.shape === 'beam') {
          const t = p.age / p.life, grow = Math.min(1, t / 0.3), fade = t > 0.7 ? (1 - t) / 0.3 : 1;
          const ex = p.a.x + (p.b.x - p.a.x) * grow, ey = p.a.y + (p.b.y - p.a.y) * grow;
          const mx = (p.a.x + ex) / 2 + Math.sin(p.age * 25 + p.seed) * 14, my = (p.a.y + ey) / 2 - 18 + Math.cos(p.age * 21 + p.seed) * 10;
          c.globalAlpha = Math.max(0, fade); c.lineCap = 'round';
          for (const [wm, col, bl] of [[2.2, p.color, 30], [1, p.color, 18], [0.35, '#ffffff', 8]]) { c.strokeStyle = col; c.shadowColor = p.color; c.shadowBlur = 0; c.lineWidth = p.w * wm * (0.8 + 0.2 * Math.sin(p.age * 40)); c.beginPath(); c.moveTo(p.a.x, p.a.y); c.quadraticCurveTo(mx, my, ex, ey); c.stroke(); }
          c.shadowBlur = 0;
          if (Math.random() < 0.9) { const q = Math.random() * grow; this.parts.push({ x: p.a.x + (p.b.x - p.a.x) * q, y: p.a.y + (p.b.y - p.a.y) * q - 10, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2.5, g: 0.08, color: p.color, size: 3 + Math.random() * 4, life: 0.6, age: 0, shape: 'dot' }); }
          if (grow >= 1 && Math.random() < 0.6) this.parts.push({ x: ex, y: ey, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.8) * 6, g: 0.15, color: p.color, size: 4 + Math.random() * 5, life: 0.5, age: 0, shape: 'dot' });
        }
        else if (p.shape === 'bolt') { const r = rngOf(Math.floor(p.seed * 1000 + p.age * 30)); c.strokeStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 0; c.lineWidth = 3; c.beginPath(); c.moveTo(p.a.x, p.a.y); for (let i = 1; i < 9; i++) { const t = i / 9; c.lineTo(p.a.x + (p.b.x - p.a.x) * t + (r() - 0.5) * 34, p.a.y + (p.b.y - p.a.y) * t + (r() - 0.5) * 34); } c.lineTo(p.b.x, p.b.y); c.stroke(); c.lineWidth = 1; c.strokeStyle = '#fff'; c.stroke(); c.shadowBlur = 0; }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    };
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(loop);
  },
};

function lunge(uid, toUid, ms = 380) {
  const el = figEl(uid); if (!el) return Promise.resolve();
  const a = center(uid), b = center(toUid);
  const dx = (b.x - a.x) * 0.62, dy = (b.y - a.y) * 0.5;
  const an = el.animate([{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dx * 0.15}px),calc(-100% + ${dy * 0.15 + 4}px)) scale(.96)`, offset: 0.25 }, { transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy}px)) scale(1.08)`, offset: 0.6 }, { transform: 'translate(-50%,-100%)' }], { duration: ms / S.speed, easing: 'ease-in-out' });
  el.style.zIndex = '90';
  an.onfinish = () => { el.style.zIndex = String(Math.round(parseFloat(el.style.top))); };
  return sleep(ms * 0.6 / S.speed);
}
function hop(uid, ms = 300) { const el = figEl(uid); el?.animate([{ transform: 'translate(-50%,-100%)' }, { transform: 'translate(-50%,calc(-100% - 16px)) scale(1.05)' }, { transform: 'translate(-50%,-100%)' }], { duration: ms / S.speed, easing: 'ease-out' }); return sleep(ms * 0.5 / S.speed); }
function knock(uid, big) {
  const el = figEl(uid); if (!el) return;
  if (el._vis && el._vis.anims && el._vis.anims.hit && !el._busy) playAnim(uid, el._vis.anims.hit); const dir = el.classList.contains('e') ? 1 : -1;
  el.querySelector('.sprite').animate([{ filter: 'brightness(3) saturate(0)' }, { filter: 'brightness(1)' }], { duration: 220 / S.speed });
  el.animate([{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dir * (big ? 18 : 9)}px),-100%)` }, { transform: 'translate(-50%,-100%)' }], { duration: 260 / S.speed, easing: 'ease-out' });
}
function setPose(uid, pose) {
  const el = figEl(uid); if (!el) return; const v = el._vis; if (!v.poses) return;
  if (el._lunging) return;
  el.querySelector('.sprite').src = pose ? FIG(v.poses[pose]) : v.idle ? ANIM(v.idle) : v.src;
}
const ANIM_CACHE = {};
function preloadAnims(names) {
  for (const n of names) { const m = ANIM_META[n]; if (!m || ANIM_CACHE[n]) continue; ANIM_CACHE[n] = [];
    for (let i = 0; i < m.n; i++) { const im = new Image(); im.src = ASSET_URL(`anim/${n}_${String(i).padStart(2, '0')}.webp`); im.decode?.().catch(() => {}); ANIM_CACHE[n].push(im.src); } }
}
const ANIM_RATE = { vf_atk: 1.7, vf_cast: 1.6, vf_ult: 1.35, vf_hit: 2.6 };
function playAnim(uid, name, opts = {}) {
  const el = figEl(uid); const m = ANIM_META[name];
  if (!el || !m) return { impact: Promise.resolve(), done: Promise.resolve() };
  preloadAnims([name]);
  const sp = el.querySelector('.sprite'); const tok = (el._tok || 0) + 1; el._tok = tok; el._busy = name;
  const step = 1000 / (m.fps * (ANIM_RATE[name] || 1.5)) / S.speed;
  if (opts.toUid) {
    const a = center(uid), b = center(opts.toUid); const fr = opts.frac || 0.42;
    const dx = (b.x - a.x) * fr, dy = (b.y - a.y) * fr * 0.6; const tAll = m.n * step;
    el.animate([{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy}px))`, offset: Math.min(0.85, Math.max(0.2, m.impact / m.n)) }, { transform: 'translate(-50%,-100%)' }], { duration: tAll, easing: 'ease-in-out' });
    el.style.zIndex = '90';
  }
  let hit; const impact = new Promise((r) => { hit = r; });
  const done = (async () => {
    for (let i = 0; i < m.n; i++) {
      if (el._tok !== tok || !document.body.contains(sp)) { hit(); return; }
      sp.src = ANIM_CACHE[name][i];
      if (i === m.impact) hit();
      await sleep(step);
    }
    hit();
    if (el._tok === tok) { el._busy = null; sp.src = ANIM(el._vis.idle); el.style.zIndex = String(Math.round(el._y || 50)); }
  })();
  return { impact, done };
}
async function cutIn(u, sk) {
  const v = unitVis(u); const host = document.getElementById('bt'); if (!host) return;
  const ca = u.side === 'a' ? cardArt(u.key, H(u.key)?.lv || 1) : null;
  const c = FX_COLOR[u.mark];
  const d = document.createElement('div'); d.className = 'cutin'; d.style.setProperty('--c1', 'rgba(0,0,0,.2)'); d.style.setProperty('--c2', c[0]);
  const img = ca ? `<img class="full" src="${ca}">` : `<img src="${v.poses ? FIG(v.poses.ult) : v.src}" style="filter:${v.filter};${(v.face === 'L') !== (u.side === 'e') ? 'transform:scaleX(-1)' : ''}">`;
  d.innerHTML = `<div class="dark"></div><div class="band"></div><div class="art">${img}</div><div class="nm"><small>${u.side === 'a' ? 'ULTIMATE' : 'ENEMY ULTIMATE'}</small>${esc(sk.name)}</div>`;
  host.appendChild(d); SFX.ult();
  await sleep(1050 / S.speed); d.remove();
}
function skillKindFx(sk) {
  if (sk.heal && !sk.hits) return 'heal'; if (sk.shield && !sk.hits) return 'shield'; if (!sk.hits) return 'buff';
  if (sk.target === 'random3') return 'bolt'; if (sk.target === 'enemies') return 'aoe'; if (sk.id === 'basic') return 'melee'; return 'proj';
}
const elemOf = (u, v) => { const c = (v.fx || '').toLowerCase(); if (/c07bff|b46cff|8a3fd8/.test(c)) return 'void'; if (/6fb8ff|58b6ff/.test(c) && u.mark === 'blue') return 'storm'; return { red: 'fire', blue: 'ice', green: 'poison', force: 'light' }[u.mark]; };
async function elemShot(el, from, to, col, big) {
  if (el === 'fire') { FX.breath(from, [to], PAL.fire, 750, big ? 1.4 : 1); return sleep(420 / S.speed); }
  if (el === 'ice') return FX.shards(from, to, 320, big ? 11 : 7);
  if (el === 'light') return FX.lance(from, to, '#ffd76a', 240);
  if (el === 'void') return FX.lance(from, to, '#b46cff', 260);
  if (el === 'storm') { FX.bolt(from, to, '#8fd0ff'); FX.burst(to.x, to.y, '#bfe6ff', 18, 6, 4); return sleep(140 / S.speed); }
  FX.beam(from, to, col, 520 / S.speed, big ? 20 : 14); return sleep(230 / S.speed);
}
const PAL = { poison: ['#b8f040', '#7ad62a', '#4fb81a', '#2f8a10', '#9ae83a', '#c8ff5a'], fire: ['#ffd25a', '#ff9a2a', '#ff6a1a', '#e2401a', '#b8240a', '#ffb840'], ice: ['#e8fbff', '#a8e6ff', '#6fc8ff', '#3f9aff', '#c8f0ff'] };
const ANIM_MOUTH = { vf_cast: [0.8, 0.34], vf_ult: [0.68, 0.3], vf_atk: [0.9, 0.4] };
function mouthAnim(uid, name) {
  const el = figEl(uid), st = document.getElementById('stage'); if (!el || !st) return center(uid);
  const r = el.querySelector('.sprite').getBoundingClientRect(), s = st.getBoundingClientRect(); const m = ANIM_MOUTH[name] || [0.85, 0.35];
  const flip = !!el.querySelector('.flip'); const fx = flip ? 1 - m[0] : m[0];
  return { x: r.left - s.left + r.width * fx, y: r.top - s.top + r.height * m[1] };
}
const mouthOf = (uid) => { const el = figEl(uid), st = document.getElementById('stage'); if (!el || !st) return center(uid); const r = el.querySelector('.sprite').getBoundingClientRect(), s = st.getBoundingClientRect(); const enemy = el.classList.contains('e'); return { x: r.left - s.left + r.width * (enemy ? 0.12 : 0.88), y: r.top - s.top + r.height * 0.3 }; };
async function actionFx(u, sk, group) {
  const v = unitVis(u); const col = v.fx || FX_COLOR[u.mark][0];
  const hitT = [...new Set(group.filter((e) => e.t === 'dmg' && e.kind === 'hit').map((e) => e.uid))];
  const kind = skillKindFx(sk);
  if (sk.id === 's2' && (u.side === 'a' || u.boss)) await cutIn(u, sk);
  const me = center(u.uid);
  if (v.anims) {
    const name = sk.id === 'basic' ? v.anims.atk : sk.id === 's2' ? (v.anims.ult || v.anims.cast) : v.anims.cast;
    const el = figEl(u.uid); const flip = el && el.querySelector('.flip') ? -1 : 1;
    const r = playAnim(u.uid, name, sk.id === 'basic' && hitT[0] ? { toUid: hitT[0], frac: 0.42 } : {});
    SFX.whoosh(); await r.impact;
    if (kind === 'melee' && hitT[0]) { const t = center(hitT[0]); FX.slash(t.x, t.y, col); FX.burst(t.x, t.y, col, 22, 6, 5); SFX.crit(); shake(6, 220); return; }
    const mouth = mouthAnim(u.uid, name); const m = ANIM_META[name];
    const step = 1000 / (m.fps * (ANIM_RATE[name] || 1.5)) / S.speed; const flow = Math.max(700, (m.n - m.impact - 4) * step * S.speed);
    if (hitT.length) {
      const ult = sk.id === 's2'; const pal = PAL[elemOf(u, v)] || PAL.poison;
      FX.breath(mouth, hitT.map(center), pal, flow, ult ? 1.5 : 1.05);
      SFX.whoosh(); setTimeout(() => SFX.boom(), 300 / S.speed);
      await sleep(420 / S.speed);
      for (const id of hitT) { const t = center(id); FX.burst(t.x, t.y, pal[1], ult ? 36 : 20, 7, 6, 0.9); }
      shake(ult ? 14 : 7, 420);
      if (ult) { const st = document.getElementById('stage'); st && st.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.5) saturate(1.4)' }, { filter: 'brightness(1)' }], { duration: 500 / S.speed }); }
    } else { for (const a of side(BT.B, u.side)) { const t = center(a.uid); FX.rise(t.x, t.y, col, 14, 24); } SFX.heal(); }
    return;
  }
  if (kind === 'melee' && hitT[0]) { setPose(u.uid, 'atk'); SFX.whoosh(); await lunge(u.uid, hitT[0]); const t = center(hitT[0]); FX.slash(t.x, t.y, col); FX.burst(t.x, t.y, col, 16, 5, 4); setTimeout(() => setPose(u.uid, null), 250 / S.speed); return; }
  if (kind === 'proj' && hitT[0]) { setPose(u.uid, 'cast'); await hop(u.uid); SFX.whoosh(); await elemShot(elemOf(u, v), mouthOf(u.uid), center(hitT[0]), col, sk.id === 's2'); const t = center(hitT[0]); FX.burst(t.x, t.y, col, 22, 6, 5); SFX.boom(); shake(sk.id === 's2' ? 10 : 5, 260); setTimeout(() => setPose(u.uid, null), 200 / S.speed); return; }
  if (kind === 'bolt') { setPose(u.uid, 'cast'); await hop(u.uid); let prev = mouthOf(u.uid); for (const id of hitT) { const t = center(id); FX.bolt(prev, t, '#9fd8ff'); prev = t; FX.burst(t.x, t.y, col, 14, 5, 3); SFX.hit(); await sleep(110 / S.speed); } setPose(u.uid, null); return; }
  if (kind === 'aoe') {
    setPose(u.uid, sk.id === 's2' ? 'ult' : 'cast'); await hop(u.uid, 380); SFX.whoosh();
    const el = elemOf(u, v), mo = mouthOf(u.uid);
    if (PAL[el] && el !== 'ice') { FX.breath(mo, hitT.map(center), PAL[el], 950, sk.id === 's2' ? 1.5 : 1.15); await sleep(450 / S.speed); }
    else await Promise.all(hitT.map((id, i) => sleep(i * 70 / S.speed).then(() => elemShot(el, mo, center(id), col, sk.id === 's2'))));
    for (const id of hitT) { const t = center(id); FX.burst(t.x, t.y, col, 26, 7, 5, 0.8); FX.ring(t.x, t.y + 25, col, 60); }
    SFX.boom(); shake(sk.id === 's2' ? 12 : 6, 320); setTimeout(() => setPose(u.uid, null), 300 / S.speed); return;
  }
  const allies = side(BT.B, u.side);
  await hop(u.uid);
  if (kind === 'heal') { SFX.heal(); for (const a of allies) { const t = center(a.uid); FX.rise(t.x, t.y, '#7dff9a', 16, 26); FX.ring(t.x, t.y + 30, '#7dff9a', 50); } }
  else if (kind === 'shield') { for (const a of allies) { const t = center(a.uid); FX.ring(t.x, t.y, '#cfe3ff', 55, 0.6, 5); FX.rise(t.x, t.y, '#bfe0ff', 8, 24); } SFX.heal(); }
  else { const tg = (sk.effects || []).some((e) => e.to === 'self') && !(sk.effects || []).some((e) => e.to === 'allies') ? [u] : allies; for (const a of tg) { const t = center(a.uid); FX.rise(t.x, t.y, col, 14, 24); FX.ring(t.x, t.y + 30, col, 46); } SFX.heal(); }
  await sleep(250 / S.speed);
}

async function spiritFx() {
  const host = document.getElementById('bt'); if (!host) return;
  const d = document.createElement('div'); d.className = 'cutin'; d.style.setProperty('--c2', '#ffb43c');
  d.innerHTML = `<div class="dk"></div><div class="band"></div><div class="art"><img src="${FIG('fire_roar')}" style="filter:sepia(.6) saturate(2) hue-rotate(-10deg) brightness(1.3) drop-shadow(0 0 1.5em #ffb43c)"></div><div class="nm"><small>DRAGON SPIRIT</small>Ancestral Roar</div>`;
  host.appendChild(d); SFX.ult(); await sleep(950 / S.speed); d.remove();
  const st = document.getElementById('stage'); const W0 = st.offsetWidth, H0 = st.offsetHeight;
  for (let i = 0; i < 6; i++) FX.proj({ x: W0 * 0.1, y: H0 * 0.2 }, { x: W0 * (0.6 + Math.random() * 0.3), y: H0 * (0.4 + Math.random() * 0.4) }, '#ffb43c', 380, 16);
  await sleep(380 / S.speed); SFX.boom(); shake(12, 380);
}
async function play() {
  const { B } = BT; const d = (ms) => sleep(ms / S.speed);
  const unitOf = (uid) => allUnits(B).find((x) => x.uid === uid);
  while (BT.evIdx < B.events.length) {
    if (!BT.alive) return;
    const ev = B.events[BT.evIdx++];
    switch (ev.t) {
      case 'wave': if (ev.wave > 1) { await d(400); buildField(); banner(`WAVE ${ev.wave}/${ev.of}`); SFX.whoosh(); await d(1000); } else banner(`WAVE 1/${ev.of}`); break;
      case 'turn': document.querySelectorAll('.fig').forEach((x) => x.classList.toggle('cur', x.dataset.uid === ev.uid)); break;
      case 'act': {
        const u = unitOf(ev.uid); const sk = u.skills.find((s) => s.id === ev.sid);
        const group = []; for (let i = BT.evIdx; i < B.events.length; i++) { const e = B.events[i]; if (['turn', 'act', 'wave', 'end'].includes(e.t)) break; group.push(e); }
        await actionFx(u, sk, group); break;
      }
      case 'dmg': {
        const u = unitOf(ev.uid);
        if (ev.absorbed) floatAt(ev.uid, `🔰${ev.absorbed}`, 'sh', -18);
        if (ev.amount > 0) floatAt(ev.uid, (ev.kind === 'hit' ? '' : ({ burn: '🔥', poison: '☠', bleed: '💧', spirit: '' })[ev.kind]) + fmt(ev.amount), ev.kind === 'burn' ? 'dot' : ev.kind === 'poison' ? 'pois' : ev.kind === 'bleed' ? 'bleed' : ev.kind === 'spirit' ? 'crit' : ev.crit ? 'crit' : '');
        setHp(u, ev.hp, ev.uid); knock(ev.uid, ev.crit);
        if (ev.kind === 'hit') { ev.crit ? (SFX.crit(), shake(5, 200)) : SFX.hit(); } else { const c = center(ev.uid); FX.burst(c.x, c.y, ev.kind === 'burn' ? '#ff7a2f' : ev.kind === 'bleed' ? '#ff2a3a' : ev.kind === 'spirit' ? '#ffcf4a' : '#8dff3a', 10, 3, 3, 0.6, -0.05); }
        await d(ev.kind === 'hit' ? 90 : 260); break;
      }
      case 'heal': setHp(unitOf(ev.uid), ev.hp, ev.uid); floatAt(ev.uid, '+' + fmt(ev.amount), 'heal'); await d(70); break;
      case 'shield': floatAt(ev.uid, '🔰+' + fmt(ev.amount), 'sh'); { const uu = unitOf(ev.uid); if (uu) setHp(uu, uu.hp); } await d(40); break;
      case 'status': floatAt(ev.uid, `${STATUS[ev.status].icon} ${STATUS[ev.status].label}`, 'txt', 22); await d(70); break;
      case 'text': floatAt(ev.uid, ev.text, 'txt', 22); await d(110); break;
      case 'skip': { floatAt(ev.uid, ev.text === 'Frozen' ? '❄️ FROZEN' : '💫 STUNNED', 'big'); const c = center(ev.uid); FX.ring(c.x, c.y - 30, '#ffe46b', 30, 0.6, 3); await d(550); break; }
      case 'revive': { setHp(unitOf(ev.uid), ev.hp, ev.uid); figEl(ev.uid)?.classList.remove('dead'); const c = center(ev.uid); FX.rise(c.x, c.y + 30, '#ffb03c', 30, 30); FX.ring(c.x, c.y + 40, '#ffb03c', 80, 0.8, 6); floatAt(ev.uid, ev.ward ? 'RETURN TO LIFE' : 'REBIRTH', 'big'); SFX.legend(); await d(700); break; }
      case 'steal': { floatAt(ev.uid, `🫳 −${({ atk: 'ATK', def: 'DEF', spd: 'SPD', critDmg: 'CRIT DMG' })[ev.stat]}`, 'txt', 10); floatAt(ev.from, `💰 +${({ atk: 'ATK', def: 'DEF', spd: 'SPD', critDmg: 'CRIT DMG' })[ev.stat]}`, 'txt', 30); const a = center(ev.uid), b = center(ev.from); FX.proj(a, b, '#ffd23a', 260, 7); await sleep(90 / S.speed); break; }
      case 'pet': { document.getElementById('kc').textContent = `${ev.v}/${B.petMax}`; document.getElementById('pbar').style.width = (100 * ev.v / B.petMax) + '%'; document.getElementById('petc').classList.toggle('full', ev.v >= B.petMax); break; }
      case 'petfire': { await spiritFx(); break; }
      case 'death': { const c = center(ev.uid); FX.burst(c.x, c.y, '#999', 20, 4, 4, 0.8, -0.03); figEl(ev.uid)?.classList.add('dead'); await d(300); break; }
      default: break;
    }
  }
  update();
}

async function loop() {
  const { B } = BT;
  await sleep(150); await play(); await sleep(500 / S.speed);
  while (BT.alive && !B.over) {
    const t = beginTurn(B);
    await play();
    if (!t || !BT.alive) break;
    const u = t.unit; let choice;
    if (u.side === 'a' && !S.auto) {
      choice = await new Promise((res) => { BT.waiting = res; BT.sel = usableSkills(u).at(-1).id; panel(); });
      BT.waiting = null; BT.sel = null;
    } else { panel(); await sleep((u.side === 'a' ? 200 : 380) / S.speed); choice = aiChoose(B, u); }
    if (!BT.alive) return;
    act(B, choice.skillId, choice.targetUid);
    panel(); await play(); await sleep(140 / S.speed);
  }
  if (BT.alive && B.over) { await sleep(500); result(); }
}
if (TG && TG.BackButton) {
  const sync = () => { const b = app.querySelector('[data-back]') || (document.getElementById('bt') && !document.querySelector('.res-ov') ? document.getElementById('exit') : null) || app.querySelector('.ov .x');
    try { if (b) TG.BackButton.show(); else TG.BackButton.hide(); } catch { /* */ } };
  new MutationObserver(sync).observe(app, { childList: true, subtree: true });
  TG.BackButton.onClick(() => { const ov = app.querySelector('.ov .x'); if (ov) return ov.click(); const b = app.querySelector('[data-back]') || document.getElementById('exit'); if (b) b.click(); });
}
home();
tgLoad();
