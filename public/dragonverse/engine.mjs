// DragonVerse Card Game — Battle Lab: 5v5 turn-meter combat modelled on Infinite Magicraid.
// Pure logic, no DOM. Every number here is an [ASSUMPTION] until the combat contract is approved.

export const MARKS = {
  red: { label: 'Fire', color: '#ff6a3d', beats: 'blue' },
  blue: { label: 'Frost', color: '#53b8ff', beats: 'green' },
  green: { label: 'Wild', color: '#7bd66a', beats: 'red' },
  force: { label: 'Force', color: '#f2c94c', beats: null },
};

export const STATUS = {
  atkUp: { buff: true, icon: '⚔️', label: 'ATK Up', desc: '+35% attack' },
  defUp: { buff: true, icon: '🛡️', label: 'DEF Up', desc: '+50% defense' },
  spdUp: { buff: true, icon: '💨', label: 'SPD Up', desc: '+30% speed' },
  taunt: { buff: true, icon: '🎯', label: 'Taunt', desc: 'Enemies must attack this dragon' },
  immunity: { buff: true, icon: '✨', label: 'Immunity', desc: 'Blocks new debuffs' },
  regen: { buff: true, icon: '🌿', label: 'Regen', desc: 'Heals 8% max HP each turn' },
  shield: { buff: true, icon: '🔰', label: 'Shield', desc: 'Absorbs damage' },
  defDown: { buff: false, icon: '💔', label: 'DEF Down', desc: '−45% defense' },
  atkDown: { buff: false, icon: '🔻', label: 'ATK Down', desc: '−35% attack' },
  spdDown: { buff: false, icon: '🐌', label: 'SPD Down', desc: '−30% speed' },
  burn: { buff: false, icon: '🔥', label: 'Burn', desc: 'Takes fire damage each turn', dot: true },
  poison: { buff: false, icon: '☠️', label: 'Poison', desc: '3% max HP per stack each turn (max 5)', dot: true },
  stun: { buff: false, icon: '💫', label: 'Stun', desc: 'Skips the next turn', control: true },
  freeze: { buff: false, icon: '❄️', label: 'Freeze', desc: 'Skips the next turn; takes +20% damage', control: true },
  silence: { buff: false, icon: '🤐', label: 'Silence', desc: 'Can only use the basic attack' },
  wound: { buff: false, icon: '🩸', label: 'Severe Wound', desc: 'Cannot be healed' },
  robbed: { buff: false, icon: '🫳', label: 'Stolen', desc: 'A stat was stolen from this dragon' },
  loot: { buff: true, icon: '💰', label: 'Plunder', desc: 'Holds stats stolen from enemies' },
  bleed: { buff: false, icon: '💧', label: 'Bleed', desc: 'Loses HP each turn per stack (max 10 stacks)', dot: true },
  counter: { buff: true, icon: '↩️', label: 'Counterattack', desc: 'Strikes back when hit by an enemy skill' },
  deathward: { buff: true, icon: '✝️', label: 'Return to Life', desc: 'Survives the next lethal hit and heals' },
};

const Basic = (name, mult, extra = {}) => ({ id: 'basic', name, cd: 0, target: 'enemy', hits: [mult], ...extra });

export const RARITY = { vorathion: 'L', sylvara: 'L', stormcaller: 'L', nyxar: 'L', cinderwing: 'E', tidecoil: 'L', frostmaw: 'E', solgarde: 'E', aurion: 'R', emberfang: 'R', goldleaf: 'R', mossback: 'R' };
export const RAR_MUL = { R: 1, E: 1.7, L: 3.0 };
export const HEROES = {
  aurion: {
    name: 'Aurion', mark: 'green', role: 'Tank', art: 'aurion',
    hp: 6200, atk: 300, def: 620, spd: 950, res: 30,
    skills: [
      Basic('Thorn Slam', 1.6),
      { id: 's1', name: 'Bark Bulwark', cd: 3, target: 'self', desc: 'Taunt and DEF Up on self for 2 turns. Shields all allies for 8% of Aurion\'s max HP.',
        effects: [{ to: 'self', status: 'taunt', turns: 2 }, { to: 'self', status: 'defUp', turns: 2 }],
        shield: { to: 'allies', pct: 0.08, stat: 'hp', turns: 2 } },
      { id: 's2', name: 'Rootquake', cd: 4, target: 'enemies', hits: [1.5], desc: 'Hits all enemies. 40% chance to Stun for 1 turn.',
        effects: [{ to: 'target', status: 'stun', chance: 0.4, turns: 1 }] },
    ],
    passive: { name: 'Ancient Bark', desc: 'Takes 15% less damage. Once per battle, at the start of the first wave, gives all allies 1 charge of Return to Life: survive a lethal hit and heal 20% of Aurion\'s max HP.', takenMul: 0.85, deathward: 0.2 },
    passive2: { name: 'Stone Heart', desc: 'At the start of each turn heals 5% of max HP.', selfRegen: 0.05 },
    excl: { name: 'Elder Bark', skill: 's1', addEffects: [{ to: 'allies', status: 'regen', turns: 2 }], desc: 'Also grants all allies Regen for 2 turns.' },
  },
  sylvara: {
    name: 'Sylvara', mark: 'green', role: 'Healer', art: 'sylvara',
    hp: 4300, atk: 330, def: 420, spd: 1040, res: 20,
    skills: [
      Basic('Petal Lash', 1.5),
      { id: 's1', name: 'Bloom', cd: 3, target: 'allies', desc: 'Heals all allies for 160% ATK and removes 1 debuff from each.',
        heal: { to: 'allies', pct: 1.6, stat: 'atk' }, cleanse: 1 },
      { id: 's2', name: 'Golden Spring', cd: 5, target: 'allies', desc: 'Heals all allies for 20% of their max HP, grants Regen and Immunity for 2 turns.',
        heal: { to: 'allies', pct: 0.2, stat: 'targetHp' },
        effects: [{ to: 'allies', status: 'regen', turns: 2 }, { to: 'allies', status: 'immunity', turns: 2 }] },
    ],
    passive: { name: 'Maiden\'s Grace', desc: 'At the start of her turn, heals the weakest ally for 6% of their max HP. Once per wave, when any ally drops below 50% HP, heals all allies for 15% of Sylvara\'s max HP and shields them for 25%.', turnHealLowest: 0.06, lowHpGuard: { heal: 0.15, shield: 0.25 } },
    passive2: { name: 'Purifying Bloom', desc: 'At the start of her turn, removes 1 debuff from every ally.', turnCleanse: 1 },
    excl: { name: 'Crown of Spring', skill: 's1', addEffects: [{ to: 'allies', status: 'defUp', turns: 2 }], desc: 'Also grants all allies DEF Up for 2 turns.' },
  },
  goldleaf: {
    name: 'Goldleaf', mark: 'force', role: 'Support', art: 'goldleaf',
    hp: 4100, atk: 320, def: 430, spd: 1120, res: 25,
    skills: [
      Basic('Gilded Claw', 1.5),
      { id: 's1', name: 'War Hymn', cd: 3, target: 'allies', desc: 'ATK Up on all allies for 2 turns and +20% turn meter.',
        effects: [{ to: 'allies', status: 'atkUp', turns: 2 }], meter: { to: 'allies', value: 20 } },
      { id: 's2', name: 'Gilded Wind', cd: 4, target: 'allies', desc: 'SPD Up on all allies for 2 turns and +15% turn meter.',
        effects: [{ to: 'allies', status: 'spdUp', turns: 2 }], meter: { to: 'allies', value: 15 } },
    ],
    passive: { name: 'Gifts of Dawn', desc: 'At the start of each wave: all allies +25% turn meter. Attack dragons deal +20% damage, Defense dragons take 15% less damage, Support dragons get +25% effect resistance.', startAllyMeter: 25, classGift: true },
    passive2: { name: 'Golden Omen', desc: 'At battle start, all allies gain +10% critical chance.', teamCrit: 0.1 },
    excl: { name: 'Golden Bell', skill: 's2', addEffects: [{ to: 'allies', status: 'atkUp', turns: 2 }], desc: 'Also grants all allies ATK Up for 2 turns.' },
  },
  cinderwing: {
    name: 'Pyroclast', mark: 'red', role: 'AoE DPS', art: 'cinderwing',
    hp: 3900, atk: 440, def: 360, spd: 1010, res: 10,
    skills: [
      Basic('Flame Bite', 1.7, { effects: [{ to: 'target', status: 'burn', chance: 0.3, turns: 2 }] }),
      { id: 's1', name: 'Ember Rain', cd: 3, target: 'enemies', hits: [1.4], desc: 'Hits all enemies. 60% chance to Burn for 2 turns.',
        effects: [{ to: 'target', status: 'burn', chance: 0.6, turns: 2 }] },
      { id: 's2', name: 'Inferno', cd: 4, target: 'enemies', hits: [1.9], desc: 'Hits all enemies. +50% damage to burning targets.',
        bonusVs: { status: 'burn', mul: 1.5 } },
    ],
    passive: { name: 'Rebirth', desc: 'Once per battle, revives with 40% HP when defeated.', rebirth: 0.4 },
    passive2: { name: 'Kindling', desc: 'Deals +10% damage for each Burn on the target.', perBurn: 0.1 },
    excl: { name: 'Phoenix Ember', skill: 's1', addEffects: [{ to: 'target', status: 'burn', chance: 0.5, turns: 2 }], desc: 'Applies a second Burn (50%).' },
  },
  vorathion: {
    name: 'Vorathion', mark: 'red', role: 'Assassin', art: 'vorathion',
    hp: 3700, atk: 500, def: 340, spd: 1060, res: 10, crit: 0.25,
    skills: [
      Basic('Rending Claw', 1.9, { desc: 'Hits one enemy for 190% ATK, 70% chance of Bleed, and steals 8% of its ATK for 2 turns (up to 2 times).', effects: [{ to: 'target', status: 'bleed', chance: 0.7, turns: 2 }], steal: { stat: 'atk', pct: 0.08, max: 2 } }),
      { id: 's1', name: 'Thousand Cuts', cd: 3, target: 'enemy', hits: [1.2, 1.2, 1.2], pierce: 0.4, desc: 'Strikes one enemy in 3 stages ignoring 40% DEF. Each stage applies Bleed.', effects: [{ to: 'target', status: 'bleed', turns: 2 }, { to: 'target', status: 'bleed', turns: 2 }, { to: 'target', status: 'bleed', turns: 2 }] },
      { id: 's2', name: 'Shadow Execution', cd: 4, target: 'enemy', hits: [4.2], desc: 'Massive hit. Double damage to targets below 40% HP.',
        execute: { below: 0.4, mul: 2 } },
    ],
    passive: { name: 'Bloodlust', desc: 'Killing an enemy with a skill grants an extra turn. Deals +8% damage for each Bleed stack on the target.', extraTurnOnKill: true, perBleed: 0.08 },
    passive2: { name: 'Night Predator', desc: '+20% critical chance and +50% critical damage.', statUp: { crit: 0.2, critDmg: 0.5 } },
    excl: { name: 'Fang of the Eclipse', skill: 's1', steal: { stat: 'critDmg', pct: 0.3, max: 2 }, desc: 'Steals 30% Crit DMG from the target for 2 turns (up to 2 times).' },
  },
  emberfang: {
    name: 'Emberfang', mark: 'red', role: 'Debuffer', art: 'emberfang',
    hp: 4200, atk: 380, def: 400, spd: 1080, acc: 30,
    skills: [
      Basic('Scorch', 1.6),
      { id: 's1', name: 'Searing Howl', cd: 3, target: 'enemies', hits: [1.1], desc: 'Hits all enemies. 80% chance of DEF Down for 2 turns.',
        effects: [{ to: 'target', status: 'defDown', chance: 0.8, turns: 2 }] },
      { id: 's2', name: 'Brand', cd: 3, target: 'enemy', hits: [2.4], desc: 'Applies 2 Burns and Severe Wound for 2 turns.',
        effects: [{ to: 'target', status: 'burn', turns: 2 }, { to: 'target', status: 'burn', turns: 2 }, { to: 'target', status: 'wound', turns: 2 }] },
    ],
    passive: { name: 'Cruel Flame', desc: 'Deals +12% damage for every debuff on the target (max +36%).', perDebuff: 0.12 },
    passive2: { name: 'Searing Focus', desc: '+25 accuracy: debuffs land far more often.', statUp: { acc: 25 } },
    excl: { name: 'Searing Brand', skill: 's1', steal: { stat: 'def', pct: 0.15, max: 2 }, desc: 'Steals 15% DEF from all enemies hit for 2 turns.' },
  },
  frostmaw: {
    name: 'Frostmaw', mark: 'blue', role: 'Control', art: 'frostmaw',
    hp: 4400, atk: 360, def: 450, spd: 1090, acc: 25,
    skills: [
      Basic('Ice Fang', 1.6, { effects: [{ to: 'target', status: 'spdDown', chance: 0.4, turns: 2 }] }),
      { id: 's1', name: 'Glacial Breath', cd: 3, target: 'enemies', hits: [1.2], desc: 'Hits all enemies. SPD Down (70%) and Freeze (30%) for 1–2 turns.',
        effects: [{ to: 'target', status: 'spdDown', chance: 0.7, turns: 2 }, { to: 'target', status: 'freeze', chance: 0.3, turns: 1 }] },
      { id: 's2', name: 'Frozen Tomb', cd: 4, target: 'enemy', hits: [2.6], desc: 'Freezes the target for 1 turn and drains 30% turn meter.',
        effects: [{ to: 'target', status: 'freeze', turns: 1 }], meter: { to: 'target', value: -30 } },
    ],
    passive: { name: 'Permafrost', desc: 'Deals +30% damage to frozen or slowed targets.', vsCold: 1.3 },
    passive2: { name: 'Glacial Aura', desc: 'At the start of each wave, enemies lose 10% turn meter.', startEnemyMeter: -10 },
    excl: { name: 'Glacier Heart', skill: 's2', steal: { stat: 'spd', pct: 0.2, max: 2 }, desc: 'Steals 20% SPD from the target for 2 turns.' },
  },
  stormcaller: {
    name: 'Stormcaller', mark: 'blue', role: 'Speed DPS', art: 'stormcaller',
    hp: 3800, atk: 410, def: 360, spd: 1230,
    skills: [
      Basic('Spark', 1.6),
      { id: 's1', name: 'Chain Lightning', cd: 3, target: 'random3', hits: [1.8], desc: 'Strikes 3 random enemies. 40% chance to Stun for 1 turn.',
        effects: [{ to: 'target', status: 'stun', chance: 0.4, turns: 1 }] },
      { id: 's2', name: 'Thunder Drive', cd: 4, target: 'enemies', hits: [1.3], desc: 'Hits all enemies and drains 25% turn meter. Allies gain 20% turn meter.',
        meter: { to: 'target', value: -25 }, meter2: { to: 'allies', value: 20 } },
    ],
    passive: { name: 'Static Field', desc: 'At battle start, enemies lose 15% turn meter.', startEnemyMeter: -15 },
    passive2: { name: 'Overcharge', desc: '+150 speed. After using a skill, 25% chance to take another turn.', statUp: { spd: 150 }, extraTurnChance: 0.25 },
    excl: { name: 'Heart of Thunder', skill: 's1', steal: { stat: 'spd', pct: 0.15, max: 2 }, desc: 'Steals 15% SPD from each target hit for 2 turns.' },
  },
  nyxar: {
    name: 'Nyxar', mark: 'force', role: 'Breaker', art: 'nyxar',
    hp: 3900, atk: 450, def: 360, spd: 1110, crit: 0.3, acc: 20,
    skills: [
      Basic('Void Slash', 1.8),
      { id: 's1', name: 'Void Rend', cd: 3, target: 'enemy', hits: [2.8], desc: 'Removes all buffs from the target, then applies Severe Wound for 2 turns.',
        dispel: true, effects: [{ to: 'target', status: 'wound', turns: 2 }] },
      { id: 's2', name: 'Eclipse', cd: 4, target: 'enemies', hits: [1.4], desc: 'Hits all enemies. 70% chance of Silence and Severe Wound for 2 turns.',
        effects: [{ to: 'target', status: 'silence', chance: 0.7, turns: 2 }, { to: 'target', status: 'wound', chance: 0.7, turns: 2 }] },
    ],
    passive: { name: 'Umbral Edge', desc: 'Deals +25% damage to targets that have a buff.', vsBuffed: 1.25 },
    passive2: { name: 'Soul Siphon', desc: 'Heals for 15% of damage dealt. +40% critical damage.', lifesteal: 0.15, statUp: { critDmg: 0.4 } },
    excl: { name: 'Void Reliquary', skill: 's2', steal: { stat: 'atk', pct: 0.12, max: 2 }, desc: 'Steals 12% ATK from all enemies hit for 2 turns.' },
  },
  solgarde: {
    name: 'Solgarde', mark: 'force', role: 'Shielder', art: 'solgarde',
    hp: 5200, atk: 320, def: 520, spd: 1000, res: 30,
    skills: [
      Basic('Sun Strike', 1.6),
      { id: 's1', name: 'Sun Aegis', cd: 3, target: 'allies', desc: 'Shields all allies for 14% of Solgarde\'s max HP for 2 turns.',
        shield: { to: 'allies', pct: 0.14, stat: 'hp', turns: 2 } },
      { id: 's2', name: 'Radiant Judgment', cd: 4, target: 'enemies', hits: [1.3], desc: 'Hits all enemies. Allies gain DEF Up for 2 turns and lose 1 debuff.',
        effects: [{ to: 'allies', status: 'defUp', turns: 2 }], cleanse: 1 },
    ],
    passive: { name: 'Divine Creation', desc: 'At the start of each wave, shields all allies for 18% of Solgarde\'s max HP. Sun Strike deals extra damage equal to 40% of Solgarde\'s current shield.', startShield: 0.18, shieldStrike: 0.4 },
    passive2: { name: 'Sunplate', desc: 'Takes 12% less damage.', takenMul: 0.88 },
    excl: { name: 'Aegis of Dawn', skill: 's1', addEffects: [{ to: 'allies', status: 'immunity', turns: 1 }], desc: 'Also grants all allies Immunity for 1 turn.' },
  },
  tidecoil: {
    name: 'Venomfang', mark: 'green', role: 'Poison', art: 'tidecoil',
    hp: 4000, atk: 380, def: 380, spd: 1050, acc: 25,
    skills: [
      Basic('Venom Fang', 1.5, { effects: [{ to: 'target', status: 'poison', chance: 0.5, turns: 2 }] }),
      { id: 's1', name: 'Venom Spray', cd: 2, target: 'enemies', hits: [0.9], desc: 'Hits all enemies, applying 2 Poison stacks (70% each) for 2 turns.',
        effects: [{ to: 'target', status: 'poison', chance: 0.7, turns: 2 }, { to: 'target', status: 'poison', chance: 0.7, turns: 2 }] },
      { id: 's2', name: 'Toxic Bloom', cd: 4, target: 'enemy', hits: [2.2], desc: 'Applies 3 Poison stacks and Severe Wound for 2 turns.',
        effects: [{ to: 'target', status: 'poison', turns: 2 }, { to: 'target', status: 'poison', turns: 2 }, { to: 'target', status: 'poison', turns: 2 }, { to: 'target', status: 'wound', turns: 2 }] },
    ],
    passive: { name: 'Virulence', desc: 'Poison she applies lasts 1 extra turn.', dotExtend: 1 },
    passive2: { name: 'Toxic Mind', desc: 'Deals +8% damage for each debuff on the target.', perDebuff: 0.08 },
    excl: { name: 'Venom Gland', skill: 's1', addEffects: [{ to: 'target', status: 'wound', chance: 0.5, turns: 2 }], desc: 'Also 50% chance of Severe Wound.' },
  },
  mossback: {
    name: 'Mossback', mark: 'green', role: 'Bruiser', art: 'mossback',
    hp: 5400, atk: 400, def: 480, spd: 990,
    skills: [
      Basic('Maul', 1.7),
      { id: 's1', name: 'Thorn Vanguard', cd: 4, target: 'allies', desc: 'Gives all allies Counterattack and a Shield of 30% of Mossback\'s max HP for 2 turns.',
        effects: [{ to: 'allies', status: 'counter', turns: 2 }], shield: { to: 'allies', pct: 0.3, stat: 'hp', turns: 2 } },
      { id: 's2', name: 'Primal Roar', cd: 4, target: 'enemies', hits: [1.4], desc: 'Hits all enemies, 60% ATK Down for 2 turns. Heals self for 15% max HP.',
        effects: [{ to: 'target', status: 'atkDown', chance: 0.6, turns: 2 }], heal: { to: 'self', pct: 0.15, stat: 'hp' } },
    ],
    passive: { name: 'Feral Hunger', desc: 'Heals for 20% of damage dealt.', lifesteal: 0.2 },
    passive2: { name: 'Ironbark', desc: 'Takes 10% less damage.', takenMul: 0.9 },
    excl: { name: 'Thorn Heart', skill: 's2', steal: { stat: 'atk', pct: 0.1, max: 2 }, desc: 'Steals 10% ATK from all enemies hit for 2 turns.' },
  },
};

// ---------- enemies ----------
const W = (name, art, mark, role, stats, skills, passive = {}, filter) => ({ name, art, mark, role, ...stats, skills, passive, filter });
export const ENEMIES = {
  whelp_fire: W('Ember Whelp', 'whelp_fire', 'red', 'Minion', { hp: 2400, atk: 300, def: 300, spd: 1000 },
    [Basic('Spit Fire', 1.6, { effects: [{ to: 'target', status: 'burn', chance: 0.35, turns: 2 }] })]),
  whelp_moss: W('Moss Whelp', 'whelp_moss', 'green', 'Minion', { hp: 3200, atk: 260, def: 420, spd: 960 },
    [Basic('Headbutt', 1.5), { id: 's1', name: 'Harden', cd: 3, target: 'self', effects: [{ to: 'self', status: 'taunt', turns: 1 }, { to: 'self', status: 'defUp', turns: 2 }] }]),
  whelp_gold: W('Gilded Whelp', 'whelp_gold', 'force', 'Minion', { hp: 2300, atk: 260, def: 320, spd: 1050 },
    [Basic('Peck', 1.4), { id: 's1', name: 'Mend', cd: 3, target: 'allies', heal: { to: 'allies', pct: 1.2, stat: 'atk' } }]),
  whelp_shadow: W('Shade Whelp', 'whelp_shadow', 'red', 'Minion', { hp: 2200, atk: 340, def: 280, spd: 1110, crit: 0.2 },
    [Basic('Ambush', 1.8), { id: 's1', name: 'Rip', cd: 3, target: 'enemy', hits: [2.6] }]),
  whelp_frost: W('Rime Whelp', 'whelp_fire', 'blue', 'Minion', { hp: 2400, atk: 290, def: 320, spd: 1020 },
    [Basic('Frost Spit', 1.5, { effects: [{ to: 'target', status: 'spdDown', chance: 0.4, turns: 2 }] })], {}, 'hue-rotate(190deg) saturate(1.3)'),
  thornmother: W('Thornmother', 'mossback', 'green', 'Boss', { hp: 26000, atk: 420, def: 520, spd: 1000, res: 40 },
    [Basic('Bramble Lash', 1.8),
      { id: 's1', name: 'Strangle Vines', cd: 3, target: 'enemies', hits: [1.3], effects: [{ to: 'target', status: 'spdDown', chance: 0.6, turns: 2 }] },
      { id: 's2', name: 'Heart of the Grove', cd: 4, target: 'enemy', hits: [3.2] }],
    { name: 'Endless Growth', desc: 'BOSS RULE: heals 10% max HP at the start of each turn unless it has Severe Wound.', bossRegen: 0.1, controlImmune: true },
    'saturate(1.4) brightness(1.05)'),
  colossus: W('Obsidian Colossus', 'vorathion', 'force', 'Boss', { hp: 22000, atk: 460, def: 700, spd: 960, res: 60 },
    [Basic('Crush', 1.9),
      { id: 's1', name: 'Obsidian Quake', cd: 3, target: 'enemies', hits: [1.5] },
      { id: 's2', name: 'Molten Core', cd: 4, target: 'enemy', hits: [3.6], effects: [{ to: 'target', status: 'burn', turns: 2 }] }],
    { name: 'Stone Skin', desc: 'BOSS RULE: takes 80% less damage unless it has DEF Down. Immune to control.', stoneSkin: 0.2, controlImmune: true },
    'grayscale(0.85) brightness(0.9) contrast(1.2)'),
  tyrant: W('Storm Tyrant', 'stormcaller', 'blue', 'Boss', { hp: 21000, atk: 500, def: 480, spd: 1500, res: 50 },
    [Basic('Thunder Claw', 1.8),
      { id: 's1', name: 'Tempest', cd: 3, target: 'enemies', hits: [1.5], effects: [{ to: 'target', status: 'stun', chance: 0.6, turns: 1 }] },
      { id: 's2', name: 'Skyfall', cd: 4, target: 'enemies', hits: [2.0], meter: { to: 'target', value: -30 } }],
    { name: 'Eye of the Storm', desc: 'BOSS RULE: speed 1500 and immune to control. Its stuns are blocked by Immunity.', controlImmune: true },
    'contrast(1.2) saturate(1.3)'),
};
ENEMIES.whelp_venom = W('Venom Whelp', 'whelp_venom', 'green', 'Minion', { hp: 2300, atk: 300, def: 300, spd: 1040, acc: 20 },
  [Basic('Toxic Bite', 1.5, { effects: [{ to: 'target', status: 'poison', chance: 0.5, turns: 2 }] })]);
ENEMIES.drake_fire = W('Lava Drake', 'drake_fire', 'red', 'Minion', { hp: 3000, atk: 330, def: 360, spd: 1000 },
  [Basic('Lava Claw', 1.6), { id: 's1', name: 'Magma Spit', cd: 3, target: 'enemies', hits: [1.0], effects: [{ to: 'target', status: 'burn', chance: 0.4, turns: 2 }] }]);
ENEMIES.infernal = W('Infernal Wyrm', 'infernal', 'red', 'Boss', { hp: 20000, atk: 420, def: 620, spd: 980, res: 50 },
  [Basic('Molten Fang', 1.8),
    { id: 's1', name: 'Ash Storm', cd: 3, target: 'enemies', hits: [1.4], effects: [{ to: 'target', status: 'burn', chance: 0.6, turns: 2 }] },
    { id: 's2', name: 'Cataclysm', cd: 4, target: 'enemy', hits: [3.6] }],
  { name: 'Obsidian Hide', desc: 'BOSS RULE: takes 80% less damage unless it has DEF Down. Immune to control.', stoneSkin: 0.2, controlImmune: true });
ENEMIES.venomqueen = W('Venom Queen', 'venom_front', 'green', 'Boss', { hp: 22000, atk: 430, def: 500, spd: 1020, res: 40 },
  [Basic('Acid Fang', 1.8, { effects: [{ to: 'target', status: 'poison', chance: 0.6, turns: 2 }] }),
    { id: 's1', name: 'Plague Breath', cd: 3, target: 'enemies', hits: [1.3], effects: [{ to: 'target', status: 'poison', chance: 0.7, turns: 2 }] },
    { id: 's2', name: 'Devour', cd: 4, target: 'enemy', hits: [3.4] }],
  { name: 'Venom Carapace', desc: 'BOSS RULE: takes 65% less damage unless it is Burning. Poisons your whole team every turn. Immune to control.', armorUnless: { status: 'burn', mul: 0.35 }, poisonAura: 0.6, controlImmune: true });
ENEMIES.cinderbrute = W('Cinder Brute', 'drake', 'red', 'Boss', { hp: 15000, atk: 380, def: 420, spd: 980, res: 30 },
  [Basic('Lava Fist', 1.8),
    { id: 's1', name: 'Eruption', cd: 3, target: 'enemies', hits: [1.2], effects: [{ to: 'target', status: 'burn', chance: 0.5, turns: 2 }] },
    { id: 's2', name: 'Rampage', cd: 4, target: 'enemy', hits: [1.4, 1.4] }],
  { name: 'Rising Fury', desc: 'BOSS RULE: deals 12% more damage every turn it takes (up to +150%). Kill it fast: burst damage and speed.', enrage: 0.12, controlImmune: true });
// Elite enemy heroes reuse hero kits.
for (const [id, h] of Object.entries(HEROES)) ENEMIES['elite_' + id] = { ...h, role: h.role };

export const STAGES = [
  { id: 'c1', name: 'Ashen Foothills', hint: 'Warm-up. Any team works.', level: 1,
    waves: [['whelp_fire', 'whelp_fire', 'whelp_moss'], ['whelp_fire', 'whelp_shadow', 'whelp_moss', 'whelp_gold'], ['elite_emberfang', 'whelp_fire', 'whelp_moss', 'whelp_shadow']] },
  { id: 'c2', name: 'Frozen Pass', hint: 'Frost enemies slow you down. Fire hits Frost harder.', level: 3,
    waves: [['whelp_frost', 'whelp_frost', 'whelp_moss', 'whelp_gold'], ['elite_frostmaw', 'whelp_frost', 'whelp_frost', 'whelp_gold'], ['elite_stormcaller', 'elite_tidecoil', 'whelp_frost', 'whelp_moss', 'whelp_gold']] },
  { id: 'b1', name: "Thornmother's Grove", boss: 'thornmother', hint: 'Boss heals every turn. Bring Severe Wound (Emberfang, Nyxar, Tidecoil).', level: 4,
    waves: [['whelp_moss', 'whelp_gold', 'whelp_shadow', 'whelp_fire'], ['whelp_gold', 'thornmother', 'whelp_gold']] },
  { id: 'b2', name: 'Obsidian Gate', boss: 'colossus', hint: 'Boss ignores most damage. Keep DEF Down on it (Emberfang).', level: 5,
    waves: [['whelp_shadow', 'whelp_fire', 'whelp_moss', 'whelp_shadow'], ['whelp_fire', 'colossus', 'whelp_moss']] },
  { id: 'b3', name: 'Storm Peak', boss: 'tyrant', hint: 'Very fast boss that stuns. Immunity, shields and healing keep you alive.', level: 6,
    waves: [['whelp_frost', 'whelp_shadow', 'whelp_frost', 'whelp_gold'], ['whelp_frost', 'tyrant', 'whelp_frost']] },
  { id: 'e1', name: 'Abyss Duel', hint: 'An elite dragon team mirrors yours. Speed and control decide it.', level: 8,
    waves: [['elite_aurion', 'elite_vorathion', 'elite_frostmaw', 'elite_sylvara', 'elite_goldleaf']] },
];

export const DIFFICULTY = { normal: { label: 'Normal', mul: 1 }, hard: { label: 'Hard', mul: 1.4 } };

// ---------- rng ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- levels ----------
export const MAX_LEVEL = 70;
export const xpToNext = (lv) => 60 + lv * 40;
export const levelMul = (lv) => 1 + (lv - 1) * 0.045;

export function applyExclusive(tpl, skills, ex) {
  if (!ex || !tpl.excl) return skills;
  return skills.map((sk) => {
    let o = sk;
    if (sk.id === tpl.excl.skill) { o = { ...o, effects: [...(o.effects || []), ...(tpl.excl.addEffects || [])] }; if (tpl.excl.steal) o.steal = [].concat(o.steal || [], tpl.excl.steal); if (tpl.excl.dispel) o.dispel = true; if (tpl.excl.desc) o.desc = (o.desc || '') + ' [E1] ' + tpl.excl.desc; }
    if (sk.id === 's2' && ex >= 5 && o.cd) o = { ...o, cd: Math.max(1, o.cd - 1) };
    return o;
  });
}
export function scaleSkill(sk, lv) {
  if (lv <= 1) return sk;
  const m = 1 + 0.1 * (lv - 1); const o = { ...sk };
  if (sk.hits) o.hits = sk.hits.map((h) => h * m);
  if (sk.heal) o.heal = { ...sk.heal, pct: sk.heal.pct * m };
  if (sk.shield) o.shield = { ...sk.shield, pct: sk.shield.pct * m };
  if (lv >= 5 && sk.cd) o.cd = Math.max(1, sk.cd - 1);
  return o;
}
const CLASS_OF = { Tank: 'Defense', Shielder: 'Defense', Bruiser: 'Defense', Healer: 'Support', Support: 'Support', Control: 'Support', Debuffer: 'Support', Breaker: 'Support', Boss: 'Attack', Minion: 'Attack' };
export const classOf = (role) => CLASS_OF[role] || 'Attack';
function makeUnit(tpl, key, side, slot, lv, extraMul = 1, b = {}) {
  const m = levelMul(lv) * extraMul;
  const passive = { ...(tpl.passive2 || {}), ...(tpl.passive || {}) };
  if (tpl.passive2 && tpl.passive && tpl.passive2.takenMul && tpl.passive.takenMul) passive.takenMul = tpl.passive.takenMul * tpl.passive2.takenMul;
  if (b.lifesteal) passive.lifesteal = (passive.lifesteal || 0) + b.lifesteal;
  const su = { ...((tpl.passive2 || {}).statUp || {}) };
  const exM = b.ex ? 1 + 0.1 + 0.05 * (b.ex - 1) : 1;
  const hp = Math.round(tpl.hp * m * exM * (1 + (b.hpPct || 0)) + (b.hp || 0));
  return {
    uid: `${side}${slot}`, key, side, slot, name: tpl.name, mark: tpl.mark, role: tpl.role, art: tpl.art, filter: tpl.filter || '', lv,
    maxHp: hp, hp, atk: Math.round(tpl.atk * m * exM * (1 + (b.atkPct || 0)) + (b.atk || 0)), def: Math.round(tpl.def * m * exM * (1 + (b.defPct || 0)) + (b.def || 0)),
    spd: Math.round((tpl.spd + (su.spd || 0)) * (1 + (b.spdPct || 0)) + (b.spd || 0)),
    crit: (tpl.crit ?? 0.15) + (su.crit || 0) + (b.crit || 0), critDmg: 1.5 + (su.critDmg || 0) + (b.critDmg || 0), acc: (tpl.acc ?? 0) + (su.acc || 0), res: tpl.res ?? 0,
    skills: applyExclusive(tpl, b.skLv ? tpl.skills.map((sk) => scaleSkill(sk, b.skLv[sk.id] || 1)) : tpl.skills, b.ex || 0), exLv: b.ex || 0, passive, cds: {}, statuses: [], meter: 0, alive: true, turnsTaken: 0,
    rebirthUsed: false, boss: tpl.role === 'Boss', cls: classOf(tpl.role), gift: null, guardUsed: false,
    dmgDone: 0, healDone: 0, shieldDone: 0, dmgTaken: 0,
  };
}

// ---------- battle state ----------
export function createBattle({ team, levels = {}, mults = {}, bonuses = {}, petLv = 1, stageId, stage: stageObj, difficulty = 'normal', seed = Date.now() }) {
  const stage = stageObj || STAGES.find((s) => s.id === stageId);
  const S = {
    stage, difficulty, rng: makeRng(seed), clock: 0, turnNo: 0, wave: 0, waves: stage.waves.length,
    allies: team.map((k, i) => makeUnit(HEROES[k], k, 'a', i, levels[k] || 1, mults[k] || 1, bonuses[k] || {})),
    enemies: [], events: [], over: false, result: null, current: null, extraTurn: null, deaths: 0, pet: 0, petMax: 5, petReady: false, petLv,
  };
  spawnWave(S);
  return S;
}

function spawnWave(S) {
  const keys = S.stage.waves[S.wave];
  const lv = S.stage.level + (S.difficulty === 'hard' ? 6 : 0);
  const mul = DIFFICULTY[S.difficulty].mul * (S.stage.mul || 1);
  const lvOf = S.stage.lvOf || {};
  S.enemies = keys.map((k, i) => makeUnit(ENEMIES[k], k, 'e', i, lvOf[k] || lv, mul * (k.startsWith('elite_') ? (S.stage.rar ? RAR_MUL[RARITY[k.slice(6)]] : 0.9) : 1)));
  // [ASSUMPTION] between waves: HP and cooldowns carry over, statuses are cleared.
  for (const u of S.allies) if (u.alive) u.statuses = [];
  S.events.push({ t: 'wave', wave: S.wave + 1, of: S.waves });
  const all = [...S.allies, ...S.enemies];
  for (const u of all) {
    if (!u.alive) continue;
    u.meter = S.rng() * 10; // small jitter so equal speeds do not lock-step
    const p = u.passive;
    if (p.startAllyMeter) for (const a of side(S, u.side)) a.meter = clamp(a.meter + p.startAllyMeter, 0, 99);
    if (p.startEnemyMeter) for (const e of foes(S, u.side)) e.meter = clamp(e.meter + p.startEnemyMeter, 0, 99);
    if (p.startShield) for (const a of side(S, u.side)) addShield(S, u, a, u.maxHp * p.startShield, 2);
    if (p.classGift) for (const a of side(S, u.side)) a.gift = a.cls;
    if (p.teamCrit && S.wave === 0) for (const a of side(S, u.side)) a.crit += p.teamCrit;
    if (p.deathward && S.wave === 0) for (const a of side(S, u.side)) a.statuses.push({ type: 'deathward', turns: 99, value: u.maxHp * p.deathward, src: u, stamp: S.turnNo });
    u.guardUsed = false;
  }
}

export const side = (S, s) => (s === 'a' ? S.allies : S.enemies).filter((u) => u.alive);
export const foes = (S, s) => side(S, s === 'a' ? 'e' : 'a');
export const allUnits = (S) => [...S.allies, ...S.enemies];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const has = (u, t) => u.statuses.some((s) => s.type === t);
export const count = (u, t) => u.statuses.filter((s) => s.type === t).length;
export const debuffs = (u) => u.statuses.filter((s) => !STATUS[s.type].buff);
export const buffs = (u) => u.statuses.filter((s) => STATUS[s.type].buff);

const stolen = (u, stat) => u.statuses.reduce((a, s) => a + (s.stat === stat ? (s.type === 'loot' ? s.value : s.type === 'robbed' ? -s.value : 0) : 0), 0);
export function effSpd(u) {
  let m = 1; if (has(u, 'spdUp')) m += 0.3; if (has(u, 'spdDown')) m -= 0.3;
  return Math.max(100, u.spd * m + stolen(u, 'spd'));
}
const effAtk = (u) => Math.max(1, u.atk * (1 + (has(u, 'atkUp') ? 0.35 : 0) - (has(u, 'atkDown') ? 0.35 : 0)) + stolen(u, 'atk'));
const effDef = (u) => Math.max(0, u.def * (1 + (has(u, 'defUp') ? 0.5 : 0) - (has(u, 'defDown') ? 0.45 : 0)) + stolen(u, 'def'));
const effCritDmg = (u) => u.critDmg + stolen(u, 'critDmg');
function steal(S, u, t, st) {
  t.stolenBy = t.stolenBy || {}; const key = u.uid + st.stat;
  if ((t.stolenBy[key] || 0) >= (st.max || 2)) return;
  if (t.passive.controlImmune && t.boss && st.stat !== 'critDmg') { /* bosses resist half */ }
  const base = st.stat === 'critDmg' ? t.critDmg : st.stat === 'spd' ? t.spd : t[st.stat];
  const amt = base * st.pct * (t.boss ? 0.5 : 1);
  t.stolenBy[key] = (t.stolenBy[key] || 0) + 1;
  t.statuses.push({ type: 'robbed', stat: st.stat, value: amt, turns: 2, src: u, stamp: S.turnNo });
  u.statuses.push({ type: 'loot', stat: st.stat, value: amt * (st.share ?? 1), turns: 2, src: u, stamp: S.turnNo });
  S.events.push({ t: 'steal', uid: t.uid, from: u.uid, stat: st.stat });
  for (const a of side(S, u.side)) if (a.passive.onAllySteal) dealRaw(S, a, t, a.maxHp * a.passive.onAllySteal, 'hit');
}

// Time to full meter: meter fills at speed/10 per clock unit; a 1000-speed dragon acts once per round.
export function nextActor(S) {
  const live = allUnits(S).filter((u) => u.alive);
  const order = (a, b) => b.meter - a.meter || effSpd(b) - effSpd(a) || (a.side === 'a' ? -1 : 1) || a.slot - b.slot;
  let ready = live.filter((u) => u.meter >= 100);
  if (!ready.length) {
    const dt = Math.min(...live.map((u) => (100 - u.meter) / (effSpd(u) / 10)));
    for (const u of live) u.meter += (effSpd(u) / 10) * dt;
    S.clock += dt;
    ready = live.filter((u) => u.meter >= 100 - 1e-9);
  }
  ready.sort(order);
  return ready[0];
}

export function previewOrder(S, n = 7) {
  const live = allUnits(S).filter((u) => u.alive);
  const sim = live.map((u) => ({ u, m: u.meter, s: effSpd(u) }));
  const out = [];
  if (S.current) out.push(S.current);
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    let ready = sim.filter((x) => x.m >= 100);
    if (!ready.length) {
      const dt = Math.min(...sim.map((x) => (100 - x.m) / (x.s / 10)));
      for (const x of sim) x.m += (x.s / 10) * dt;
      ready = sim.filter((x) => x.m >= 100 - 1e-9);
    }
    ready.sort((a, b) => b.m - a.m || b.s - a.s);
    const x = ready[0]; x.m = 0;
    if (x.u !== S.current || out.length > 0) out.push(x.u);
  }
  return out.slice(0, n);
}

export const round = (S) => Math.floor(S.clock) + 1;

// ---------- turn flow ----------
// beginTurn: returns { unit, canAct, choices } ; the UI (or AI) then calls act().
export function beginTurn(S) {
  if (S.over) return null;
  let u;
  if (S.extraTurn && S.extraTurn.alive) { u = S.extraTurn; S.events.push({ t: 'text', uid: u.uid, text: 'EXTRA TURN' }); }
  else u = nextActor(S);
  S.extraTurn = null;
  S.current = u; S.turnNo++; u.turnStamp = S.turnNo;
  S.events.push({ t: 'turn', uid: u.uid });
  for (const k of Object.keys(u.cds)) if (u.cds[k] > 0) u.cds[k]--;
  // passives at turn start
  const p = u.passive;
  if (p.bossRegen && !has(u, 'wound')) heal(S, u, u, u.maxHp * p.bossRegen);
  else if (p.bossRegen) S.events.push({ t: 'text', uid: u.uid, text: 'Regen blocked' });
  u.turnsTaken++;
  if (p.selfRegen && u.hp < u.maxHp) heal(S, u, u, u.maxHp * p.selfRegen);
  if (p.turnCleanse) for (const a of side(S, u.side)) { const d = debuffs(a)[0]; if (d) { a.statuses.splice(a.statuses.indexOf(d), 1); S.events.push({ t: 'text', uid: a.uid, text: 'Cleansed' }); } }
  if (p.poisonAura) for (const t of foes(S, u.side)) applyStatus(S, u, t, { status: 'poison', chance: p.poisonAura, turns: 2 });
  if (p.turnHealLowest) { const t = side(S, u.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (t && t.hp < t.maxHp) heal(S, u, t, t.maxHp * p.turnHealLowest); }
  // statuses ticking at turn start
  for (const s of u.statuses.filter((x) => x.type === 'regen')) heal(S, s.src || u, u, u.maxHp * 0.08);
  const burns = u.statuses.filter((s) => s.type === 'burn');
  for (const s of burns) { if (!u.alive) break; dealRaw(S, s.src, u, s.value, 'burn'); }
  const pois = u.statuses.filter((s) => s.type === 'poison').slice(0, 5);
  if (pois.length && u.alive) dealRaw(S, pois[0].src, u, u.maxHp * 0.03 * pois.length, 'poison');
  const bl = u.statuses.filter((s) => s.type === 'bleed');
  if (bl.length && u.alive) dealRaw(S, bl[0].src, u, bl.reduce((a, s) => a + s.value, 0), 'bleed');
  if (checkEnd(S)) return null;
  if (!u.alive) { endTurn(S, u); return beginTurn(S); }
  if (u.side === 'a' && S.petReady) petStrike(S);
  if (S.over) return null;
  if (has(u, 'stun') || has(u, 'freeze')) {
    S.events.push({ t: 'skip', uid: u.uid, text: has(u, 'freeze') ? 'Frozen' : 'Stunned' });
    endTurn(S, u);
    return beginTurn(S);
  }
  return { unit: u, choices: usableSkills(u) };
}

function petStrike(S) {
  S.petReady = false; S.pet = 0;
  const allies = side(S, 'a'); const atk = allies.reduce((a, x) => a + effAtk(x), 0) / Math.max(1, allies.length);
  S.events.push({ t: 'petfire' });
  const spirit = { uid: 'pet', side: 'a', passive: {}, atk, crit: 0.15, critDmg: 1.5, mark: 'force', statuses: [], acc: 20, dmgDone: 0, healDone: 0, shieldDone: 0, alive: true };
  const pm = 1 + 0.06 * ((S.petLv || 1) - 1);
  for (const e of foes(S, 'a')) { if (!e.alive) continue; dealRaw(S, null, e, pm * atk * 0.9 * (700 / (700 + effDef(e))), 'spirit'); if (e.alive) applyStatus(S, spirit, e, { status: 'defDown', chance: 0.5, turns: 2 }); }
  for (const a of side(S, 'a')) { applyStatus(S, spirit, a, { status: 'atkUp', turns: 2 }); changeMeter(S, a, 15); addShield(S, spirit, a, a.maxHp * (0.06 + 0.006 * ((S.petLv || 1) - 1)), 2); }
  S.events.push({ t: 'pet', v: 0 });
  checkEnd(S);
}

export function usableSkills(u) {
  return u.skills.filter((sk) => sk.id === 'basic' || (!has(u, 'silence') && !(u.cds[sk.id] > 0)));
}

export function legalTargets(S, u, sk) {
  if (sk.target !== 'enemy') return [];
  const f = foes(S, u.side);
  const taunts = f.filter((x) => has(x, 'taunt'));
  return taunts.length ? taunts : f;
}

export function act(S, skillId, targetUid) {
  const u = S.current;
  const sk = u.skills.find((s) => s.id === skillId) || u.skills[0];
  if (!usableSkills(u).includes(sk)) throw new Error('skill not usable');
  S.events.push({ t: 'act', uid: u.uid, skill: sk.name, sid: sk.id });
  let targets = [];
  const f = foes(S, u.side);
  if (sk.target === 'enemy') {
    const legal = legalTargets(S, u, sk);
    let t = legal.find((x) => x.uid === targetUid) || aiPickTarget(S, u, sk, legal);
    targets = [t];
  } else if (sk.target === 'enemies') targets = f;
  else if (sk.target === 'random3') {
    const taunts = f.filter((x) => has(x, 'taunt'));
    for (let i = 0; i < 3; i++) { const pool = i === 0 && taunts.length ? taunts : foes(S, u.side); if (pool.length) targets.push(pool[Math.floor(S.rng() * pool.length)]); }
  }
  let killed = false;
  for (const t of targets) {
    if (!t.alive) continue;
    for (const mult of sk.hits || []) {
      const wasAlive = t.alive;
      attack(S, u, t, sk, mult);
      if (wasAlive && !t.alive) killed = true;
    }
    if (t.alive) for (const e of (sk.effects || []).filter((e) => e.to === 'target')) applyStatus(S, u, t, e);
    if (t.alive && sk.steal) for (const st of [].concat(sk.steal)) steal(S, u, t, st);
    if (t.alive && sk.dispel) { const n = buffs(t).length; t.statuses = t.statuses.filter((s) => !STATUS[s.type].buff); if (n) S.events.push({ t: 'text', uid: t.uid, text: 'Buffs removed' }); }
    if (t.alive && sk.meter && sk.meter.to === 'target') changeMeter(S, t, sk.meter.value);
  }
  const allies = side(S, u.side);
  for (const e of sk.effects || []) {
    if (e.to === 'self' && u.alive) applyStatus(S, u, u, e);
    if (e.to === 'allies') for (const a of allies) applyStatus(S, u, a, e);
  }
  if (sk.heal) {
    const list = sk.heal.to === 'self' ? [u] : allies;
    for (const a of list) heal(S, u, a, sk.heal.stat === 'atk' ? effAtk(u) * sk.heal.pct : sk.heal.stat === 'targetHp' ? a.maxHp * sk.heal.pct : u.maxHp * sk.heal.pct);
  }
  if (sk.shield) for (const a of allies) addShield(S, u, a, u.maxHp * sk.shield.pct, sk.shield.turns);
  if (sk.cleanse) for (const a of allies) { const d = debuffs(a)[0]; if (d) { a.statuses.splice(a.statuses.indexOf(d), 1); S.events.push({ t: 'text', uid: a.uid, text: 'Cleansed' }); } }
  for (const m of [sk.meter, sk.meter2]) if (m && m.to === 'allies') for (const a of allies) if (a !== u) changeMeter(S, a, m.value);
  if (sk.cd) u.cds[sk.id] = sk.cd;
  if (sk.id === 's2' && u.exLv >= 3 && u.alive && !S.over) { const f = foes(S, u.side); if (f.length) { S.events.push({ t: 'text', uid: u.uid, text: 'EXCLUSIVE: FREE ATTACK' }); const b = u.skills[0]; const legal = legalTargets(S, u, b); const tt = aiPickTarget(S, u, b, legal); for (const m of b.hits) attack(S, u, tt, b, m); if (tt.alive) for (const ef of (b.effects || []).filter((x) => x.to === 'target')) applyStatus(S, u, tt, ef); } }
  if (u.side === 'a' && !S.petReady) { S.pet = Math.min(S.petMax, S.pet + 1); if (S.pet >= S.petMax) S.petReady = true; S.events.push({ t: 'pet', v: S.pet }); }
  if (killed && sk.id !== 'basic' && u.passive.extraTurnOnKill && u.alive && !u._chain) { S.extraTurn = u; u._chain = true; }
  else if (sk.id !== 'basic' && u.passive.extraTurnChance && u.alive && !u._chain && S.rng() < u.passive.extraTurnChance) { S.extraTurn = u; u._chain = true; }
  else u._chain = false;
  endTurn(S, u);
  checkEnd(S);
}

function endTurn(S, u) {
  u.meter = 0;
  // statuses applied during this turn are not consumed by it
  for (const s of u.statuses) if (s.stamp !== S.turnNo) s.turns--;
  u.statuses = u.statuses.filter((s) => s.turns > 0 && !(s.type === 'shield' && s.value <= 0));
  S.current = null;
}

function changeMeter(S, t, v) {
  if (v < 0 && t.passive.controlImmune) { S.events.push({ t: 'text', uid: t.uid, text: 'Immune' }); return; }
  t.meter = clamp(t.meter + v, 0, 100);
  S.events.push({ t: 'meter', uid: t.uid, v });
}

function hitChance(src, t, base) {
  const res = (t.res || 0) + (t.gift === 'Support' ? 25 : 0);
  return clamp(base - Math.max(0, res - (src.acc || 0)) / 100, 0.05, 1);
}

function applyStatus(S, src, t, e) {
  const def = STATUS[e.status];
  if (!def.buff) {
    if (has(t, 'immunity')) { S.events.push({ t: 'text', uid: t.uid, text: 'Immune' }); return; }
    if (def.control && t.passive.controlImmune) { S.events.push({ t: 'text', uid: t.uid, text: 'Immune' }); return; }
    if (S.rng() > hitChance(src, t, e.chance ?? 1)) { S.events.push({ t: 'text', uid: t.uid, text: 'Resisted' }); return; }
  } else if (e.chance && S.rng() > e.chance) return;
  let turns = e.turns;
  if ((e.status === 'poison' || e.status === 'burn') && src.passive.dotExtend) turns += src.passive.dotExtend;
  const stackable = e.status === 'burn' || e.status === 'poison' || e.status === 'bleed';
  if (stackable) {
    if (e.status === 'poison' && count(t, 'poison') >= 5) { const old = t.statuses.find((s) => s.type === 'poison'); old.turns = Math.max(old.turns, turns); return; }
    if (e.status === 'bleed' && count(t, 'bleed') >= 10) { const old = t.statuses.find((s) => s.type === 'bleed'); old.turns = Math.max(old.turns, turns); return; }
    if (e.status === 'burn' && count(t, 'burn') >= 3) { const old = t.statuses.find((s) => s.type === 'burn'); old.turns = Math.max(old.turns, turns); return; }
    t.statuses.push({ type: e.status, turns, src, stamp: S.turnNo, value: e.status === 'burn' ? effAtk(src) * 0.45 : e.status === 'bleed' ? effAtk(src) * 0.22 : 0 });
  } else {
    const old = t.statuses.find((s) => s.type === e.status);
    if (old) { old.turns = Math.max(old.turns, turns); old.stamp = S.turnNo; }
    else t.statuses.push({ type: e.status, turns, src, stamp: S.turnNo });
  }
  S.events.push({ t: 'status', uid: t.uid, status: e.status });
}

function addShield(S, src, t, amount, turns) {
  amount = Math.round(amount);
  const old = t.statuses.find((s) => s.type === 'shield');
  if (old) { old.value = Math.max(old.value, amount); old.turns = Math.max(old.turns, turns); old.stamp = S.turnNo; }
  else t.statuses.push({ type: 'shield', value: amount, turns, src, stamp: S.turnNo });
  src.shieldDone += amount;
  S.events.push({ t: 'shield', uid: t.uid, amount });
}

function heal(S, src, t, amount) {
  if (!t.alive) return;
  if (has(t, 'wound')) { S.events.push({ t: 'text', uid: t.uid, text: 'No heal' }); return; }
  const real = Math.min(t.maxHp - t.hp, Math.round(amount));
  if (real <= 0) return;
  t.hp += real; src.healDone += real;
  S.events.push({ t: 'heal', uid: t.uid, amount: real, hp: t.hp });
}

function markMul(a, t) {
  if (MARKS[a.mark].beats === t.mark) return 1.25;
  if (MARKS[t.mark].beats === a.mark) return 0.8;
  return 1;
}

function attack(S, u, t, sk, mult) {
  const p = u.passive;
  let def = effDef(t) * (1 - (sk.pierce || 0));
  let dmg = effAtk(u) * mult * (700 / (700 + def));
  dmg *= markMul(u, t);
  if (sk.bonusVs && has(t, sk.bonusVs.status)) dmg *= sk.bonusVs.mul;
  if (sk.execute && t.hp / t.maxHp < sk.execute.below) dmg *= sk.execute.mul;
  if (p.perDebuff) dmg *= 1 + Math.min(3, debuffs(t).length) * p.perDebuff;
  if (p.vsCold && (has(t, 'freeze') || has(t, 'spdDown'))) dmg *= p.vsCold;
  if (p.vsBuffed && buffs(t).length) dmg *= p.vsBuffed;
  if (has(t, 'freeze')) dmg *= 1.2;
  if (p.perBleed) dmg *= 1 + count(t, 'bleed') * p.perBleed;
  if (p.perBurn) dmg *= 1 + count(t, 'burn') * p.perBurn;
  if (p.enrage) dmg *= Math.min(2.5, 1 + u.turnsTaken * p.enrage);
  if (p.shieldStrike && sk.id === 'basic') { const sh = u.statuses.find((s) => s.type === 'shield'); if (sh) dmg += sh.value * p.shieldStrike; }
  if (u.gift === 'Attack') dmg *= 1.2;
  const crit = S.rng() < u.crit;
  if (crit) dmg *= effCritDmg(u);
  dmg *= 0.95 + S.rng() * 0.1;
  const dealt = dealRaw(S, u, t, dmg, 'hit', crit);
  if (p.lifesteal && dealt > 0) heal(S, u, u, dealt * p.lifesteal);
  if (t.alive && u.alive && has(t, 'counter') && !sk.isCounter && !S._countering) {
    S._countering = true; S.events.push({ t: 'text', uid: t.uid, text: 'COUNTER!' });
    attack(S, t, u, { id: 'basic', isCounter: true }, 1.0); S._countering = false;
  }
}

function dealRaw(S, src, t, dmg, kind, crit = false) {
  if (!t.alive) return 0;
  const p = t.passive;
  if (p.takenMul) dmg *= p.takenMul;
  if (p.stoneSkin && !has(t, 'defDown')) dmg *= p.stoneSkin;
  if (p.armorUnless && !has(t, p.armorUnless.status)) dmg *= p.armorUnless.mul;
  if (t.gift === 'Defense') dmg *= 0.85;
  dmg = Math.max(1, Math.round(dmg));
  let absorbed = 0;
  const sh = t.statuses.find((s) => s.type === 'shield');
  if (sh && kind === 'hit') { absorbed = Math.min(sh.value, dmg); sh.value -= absorbed; if (sh.value <= 0) t.statuses.splice(t.statuses.indexOf(sh), 1); }
  const real = Math.min(t.hp, dmg - absorbed);
  t.hp -= real; t.dmgTaken += real;
  if (src) src.dmgDone += real + absorbed;
  S.events.push({ t: 'dmg', uid: t.uid, amount: dmg - absorbed, absorbed, crit, kind, hp: Math.max(0, t.hp) });
  if (t.hp <= 0) kill(S, t);
  else if (t.hp < t.maxHp * 0.5) lowHpTrigger(S, t);
  return real;
}

function lowHpTrigger(S, t) {
  for (const g of side(S, t.side)) {
    const lg = g.passive.lowHpGuard; if (!lg || g.guardUsed) continue;
    g.guardUsed = true; S.events.push({ t: 'text', uid: g.uid, text: g.passive.name.toUpperCase() });
    for (const a of side(S, t.side)) { heal(S, g, a, g.maxHp * lg.heal); addShield(S, g, a, g.maxHp * lg.shield, 2); }
  }
}

function kill(S, t) {
  const dw = t.statuses.find((s) => s.type === 'deathward');
  if (dw) {
    t.statuses.splice(t.statuses.indexOf(dw), 1); t.hp = Math.min(t.maxHp, Math.max(1, Math.round(dw.value)));
    S.events.push({ t: 'revive', uid: t.uid, hp: t.hp, ward: true }); return;
  }
  if (t.passive.rebirth && !t.rebirthUsed) {
    t.rebirthUsed = true; t.hp = Math.round(t.maxHp * t.passive.rebirth); t.statuses = [];
    S.events.push({ t: 'revive', uid: t.uid, hp: t.hp });
    return;
  }
  t.alive = false; t.hp = 0; t.statuses = []; t.meter = 0;
  if (t.side === 'a') S.deaths++;
  S.events.push({ t: 'death', uid: t.uid });
}

function checkEnd(S) {
  if (S.over) return true;
  if (!side(S, 'a').length) { S.over = true; S.result = 'defeat'; S.events.push({ t: 'end', result: 'defeat' }); return true; }
  if (!side(S, 'e').length) {
    if (S.wave + 1 < S.waves) { S.wave++; spawnWave(S); S.extraTurn = null; return false; }
    S.over = true; S.result = 'victory'; S.events.push({ t: 'end', result: 'victory' }); return true;
  }
  if (round(S) > 150) { S.over = true; S.result = 'defeat'; S.events.push({ t: 'end', result: 'timeout' }); return true; }
  return false;
}

const fastLimit = (S) => Math.floor(15 * S.waves / 2 + 5);
export function starFlags(S) {
  const win = S.result === 'victory';
  return [win, win && S.deaths === 0, win && round(S) <= fastLimit(S)];
}
export const stars = (S) => (starFlags(S)[0] ? starFlags(S).filter(Boolean).length : 0);
export const starRules = (S) => ['Win the battle', 'No dragon falls', `Win within ${fastLimit(S)} rounds`];

// ---------- AI ----------
export function aiPickTarget(S, u, sk, legal) {
  const score = (t) => {
    let s = t.hp / t.maxHp;
    if (markMul(u, t) > 1) s -= 0.15;
    if (markMul(u, t) < 1) s += 0.15;
    if (sk.execute && t.hp / t.maxHp < sk.execute.below) s -= 0.5;
    if (sk.dispel) s -= buffs(t).length * 0.15;
    if (t.boss && (sk.effects || []).some((e) => e.status === 'wound' || e.status === 'defDown')) s -= 0.4;
    return s;
  };
  return [...legal].sort((a, b) => score(a) - score(b))[0];
}

export function aiChoose(S, u) {
  const usable = usableSkills(u);
  const allies = side(S, u.side);
  const minHp = Math.min(...allies.map((a) => a.hp / a.maxHp));
  const ranked = usable.filter((s) => s.id !== 'basic').sort((a, b) => b.cd - a.cd);
  for (const sk of ranked) {
    if (sk.heal && sk.heal.to === 'allies' && !sk.hits) { if (minHp < (sk.cd >= 5 ? 0.55 : 0.8)) return { skillId: sk.id }; continue; }
    if (sk.shield && !sk.hits && sk.target !== 'self') { if (minHp < 0.95 || foes(S, u.side).some((f) => f.boss)) return { skillId: sk.id }; continue; }
    return { skillId: sk.id, targetUid: sk.target === 'enemy' ? aiPickTarget(S, u, sk, legalTargets(S, u, sk)).uid : null };
  }
  const b = u.skills[0];
  return { skillId: 'basic', targetUid: aiPickTarget(S, u, b, legalTargets(S, u, b)).uid };
}

export function runAuto(S, maxTurns = 3000) {
  for (let i = 0; i < maxTurns && !S.over; i++) {
    const t = beginTurn(S);
    if (!t) break;
    const c = aiChoose(S, t.unit);
    act(S, c.skillId, c.targetUid);
  }
  return S;
}

// ---------- campaign ----------
export const CHAPTERS = [
  { name: 'Ember Wastes', mid: 'cinderbrute', bg: 'bg_fire', tint: 'rgba(255,90,20,.12)', mobs: ['whelp_fire', 'drake_fire', 'whelp_shadow'], elites: ['elite_emberfang', 'elite_cinderwing', 'elite_vorathion'], boss: 'infernal' },
  { name: 'Venom Jungle', mid: 'thornmother', bg: 'bg_venom', tint: 'rgba(80,255,60,.08)', mobs: ['whelp_venom', 'whelp_moss', 'whelp_gold'], elites: ['elite_tidecoil', 'elite_mossback', 'elite_sylvara'], boss: 'venomqueen' },
  { name: 'Frost Peaks', mid: 'colossus', bg: 'bg_ice', tint: 'rgba(80,170,255,.12)', mobs: ['whelp_frost', 'whelp_shadow', 'whelp_gold'], elites: ['elite_frostmaw', 'elite_stormcaller', 'elite_nyxar'], boss: 'tyrant' },
];
export const PER = 10;
export function rngOf(seed) { let a = seed * 9301 + 49297; return () => ((a = (a * 9301 + 49297) % 233280) / 233280); }
export const DIFFS = { easy: { lb: 'Easy', lv: 0, m: 1, r: 1, col: '#7dff9a' }, hard: { lb: 'Hard', lv: 15, m: 2.4, r: 1.8, col: '#ffd23a' }, nightmare: { lb: 'Nightmare', lv: 30, m: 4, r: 3, col: '#ff8a3c' }, hell: { lb: 'Hell', lv: 45, m: 7, r: 5, col: '#ff3b3b' } };
export const DIFF_ORDER = ['easy', 'hard', 'nightmare', 'hell'];
export function stageDef(g, diff = 'easy') {
  const base = stageBase(g); if (diff === 'easy') return { ...base, diff };
  const D = DIFFS[diff]; const rw = base.reward;
  return { ...base, diff, id: `${diff}-g${g}`, level: base.level + D.lv, mul: base.mul * D.m,
    reward: { gold: Math.round(rw.gold * D.r), ess: Math.round(rw.ess * D.r), gems: Math.round(rw.gems * D.r), runes: rw.runes } };
}
function stageBase(g) {
  const ch = Math.floor(g / PER), n = g % PER, C = CHAPTERS[ch], r = rngOf(g + 7);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const level = 1 + Math.round(g * 1.65);
  const boss = n === 4 ? C.mid : n === 9 ? C.boss : null;
  const sz = (w) => Math.min(5, 3 + Math.floor(n / 3) + (w === 2 ? 1 : 0));
  const waves = [0, 1, 2].map((w) => Array.from({ length: sz(w) }, () => pick(C.mobs)));
  if (boss) waves[2] = [pick(C.mobs), boss, pick(C.mobs)];
  else if (n >= 2) waves[2][0] = pick(C.elites);
  if (n >= 6 && !boss) waves[1][0] = pick(C.elites);
  return { mul: 1.7 + g * 0.085, id: 'g' + g, g, ch, n, name: `${ch + 1}-${n + 1}`, title: boss ? ENEMIES[boss].name : C.name, level, waves, boss, midBoss: n === 4,
    reward: { gold: 500 + g * 450, ess: 200 + g * 130, gems: boss ? (n === 9 ? 300 : 150) : 40, runes: n === 9 ? 5 : n === 4 ? 3 : 0 } };
}
export const STAGE_COUNT = CHAPTERS.length * PER;
