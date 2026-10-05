import { DRAGONS, RUNES, ATTACKS, ABILITIES, stageForLevel, previewDragon, attackResourceGain, createMatch, act, legalActions, chooseAI, resource, attackDamage, RESOURCE_MODES, AI_DIFFICULTIES, resourceName } from './match.js?v=5c6e62ac7cc8';
import { FAMILIES, STARTERS, loadProfile, adoptProfile, awardBattle, saveProfile, upgradeCost, canUpgrade, upgradeDragon } from './profile.js?v=5c6e62ac7cc8';
import { ENCOUNTERS, campaignMatch, recordCampaign } from './campaign.js?v=5c6e62ac7cc8';
import { feel, setFeel, unlockAudio, transition, feedbackEffect } from './feel.js?v=5c6e62ac7cc8';
import { battlefieldMarkup, reserveRow, hydrateSprites, animateBattlefield, spriteMarkup } from './battlefield.js?v=5c6e62ac7cc8';
import { QUESTS, refreshDaily, awardDaily, chestReady, claimChest } from './daily.js?v=5c6e62ac7cc8';
import { stageStorage, battleSettings, saveBattleSettings } from './battle-settings.js?v=5c6e62ac7cc8';
const app = document.querySelector('#app');
const battleView = new URLSearchParams(location.search).get('battleView') === 'cards' ? 'cards' : 'arena';
let animating = false, animationEvent = null, reserveIntent = 'switch';
const artBase = new URL('./assets/dragons/', import.meta.url);
const artFamilies = FAMILIES;
let artFamily = 'vorathion', artStage = 1;
let tutorialSeen = false, aiMoves = [], pendingEffect = null, battleClaws = 0, homeView = 'journey';
const artName = id => id[0].toUpperCase() + id.slice(1);
let mode = battleSettings.mode, difficulty = battleSettings.difficulty, team = DRAGONS.slice(0, 5).map((d, i) => ({ id: d.id, rune: ['fury', 'ward', 'life'][i % 3] }));
let match = null, selection = { zone: 'field', index: 0 }, dialog = '', busy = false, generation = 0, started = 0, seed = Date.now(), feedback = '';
const storage = stageStorage;
let profile = loadProfile(storage), selectedCub = STARTERS[0], heroName = '', savedOK = true, battleId = '', battleReward = null, evolution = null;
let encounter = Math.min(9, profile.campaign.cleared), battleEncounter = encounter;
function persist() { savedOK = saveProfile(profile, storage); }
function restoreTeam() {
  team = profile.team.map(id => ({ id, rune: profile.cards[id].rune, level: profile.cards[id].level, ...(id === profile.starter ? { nickname: profile.name } : {}) }));
}
if (profile.starter) restoreTeam();
try { tutorialSeen = stageStorage.getItem('dragon-tutorial-seen') === '1'; } catch { /* Optional storage. */ }
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const button = (label, command, disabled = false, extra = '') => `<button data-command="${command}" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
const pips = n => `<span class="pips" aria-label="${n} of 4">${[0, 1, 2, 3].map(i => `<i class="${i < n ? 'filled' : ''}"></i>`).join('')}</span>`;
const artUrl = (family, stage = 1) => new URL(`${family}/stage${stage}.webp`, artBase).href;
const image = (d, compact = false) => { const stage = d.stage || stageForLevel(d.level || 1); return `<img src="${new URL(`${d.art}/thumb${stage}.webp`, artBase).href}" alt="${esc(d.name)} · Stage ${stage}" loading="lazy" decoding="async" width="320" height="397">`; };
function header() {
  return `<header><strong>DRAGON <span>CARD GAME</span></strong><nav>${button('Rules', 'rules')}${button('Settings', 'settings')}${match ? button('Exit', 'back') : ''}</nav></header>`;
}
const runeEffect = rune => ({ fury: 'Fury · +8 attack', ward: 'Ward · +30 HP, +5 block', life: 'Life · heal 8 after attack' })[rune];
function upgradeButton(id) {
  const c = profile.cards[id], cost = upgradeCost(profile, id); if (!c?.owned) return '';
  return button(cost ? `<b>Level up · Lv${c.level + 1}</b><small>${cost.xp} XP + ${cost.copies} copies · have ${c.xp} / ${c.copies}</small>` : 'Max level · Lv10', `upgrade:${id}`, !canUpgrade(profile, id), `class="${canUpgrade(profile, id) ? 'primary' : ''}"`);
}
function overlay() {
  if (!dialog) return '';
  const rules = `<p>Win by defeating three dragons or the entire enemy team. Only the front fighter attacks; an attack ends your turn.</p>
    <p>Claw is free and builds resource. Breath costs 2, Ultimate costs 3. Charge gains +1 at the start of your turn.</p>
    <p>Team Charge is shared. Dragon Charge stays on each dragon: only the front gains +1 each turn, reserves keep theirs. Attached Energy (legacy) uses a manual Attach action instead.</p>
    <p>Switch brings a reserve to the front. It costs 1 resource and is available once per turn.</p>
    <p>Fuse consumes a reserve and gives the fighter +35 HP and +12 attack. Cost: 2 resource; individual Charge or Energy is pooled from both dragons, capped at 4 after paying. Once per battle; the fighter keeps its rune.</p>
    <p>Choose runes before battle: Fury increases attack, Ward adds HP and block, Life heals after each attack.</p>`;
  const settings = `<label for="mode">Resource model</label><select id="mode">${Object.entries(RESOURCE_MODES).map(([id, label]) => `<option value="${id}" ${mode === id ? 'selected' : ''}>${label}</option>`).join('')}</select><p>Both Charge models: start at 1, +1 at the start of your turn, Claw builds Charge, maximum 4.</p><p><b>Team Charge:</b> one shared bar. <b>Dragon Charge:</b> only the front gains turn Charge; reserves keep theirs. Switch spends 1 from the old fighter. Fuse pools both dragons’ Charge, then spends 2.</p><p>Attached Energy is the previous experiment: manually Attach +1 once per turn; no automatic turn gain.</p><label for="difficulty">Enemy difficulty</label><select id="difficulty">${Object.entries(AI_DIFFICULTIES).map(([id, label]) => `<option value="${id}" ${difficulty === id ? 'selected' : ''}>${label}</option>`).join('')}</select><p>Easy: basic attacks and emergency switches. Normal: plans a full turn and conserves Charge. Hard: also checks your strongest reply. Same enemy stats and costs.</p>${match ? '<p>Resource model and difficulty changes apply to the next battle.</p>' : ''}<div class="feel-settings">${Object.entries(feel).map(([id, checked]) => `<label><input type="checkbox" data-feel="${id}" ${checked ? 'checked' : ''}>${({ sound: 'Sound', vibration: 'Vibration · supported devices', motion: 'Motion effects' })[id]}</label>`).join('')}</div>`;
  const quit = `<p>End this battle and return to your squad?</p>${button('End battle', 'quit', false, 'class="primary"')}`;
  const tutorial = `<p><b>1. One fighter at the front.</b> It attacks while reserves wait. Claw is free and builds resource.</p><p><b>2. Prepare, then attack.</b> Switch brings a reserve forward for 1 resource. Fuse consumes a reserve and strengthens your fighter for 2. An attack ends your turn.</p><p><b>3. Watch the enemy.</b> Switching and fusion appear in the battle log. Defeat three enemies to win. Resource costs are shown on your attacks.</p>${button('Let’s battle', 'begin-tutorial', false, 'class="primary"')}`;
  const evolved = evolution ? `<span class="evolution-figure">${spriteMarkup(previewDragon(evolution.id, profile.cards[evolution.id].rune, profile.cards[evolution.id].level))}</span><img class="art-preview evolution-art" src="${artUrl(evolution.id, evolution.stage)}" alt="${artName(evolution.id)} · Stage ${evolution.stage}" loading="lazy" decoding="async"><p>Lv${profile.cards[evolution.id].level} · Stage ${evolution.stage}</p><p>${ABILITIES[evolution.id][evolution.stage - 2]}</p><p>The new form and ability apply next battle. Fusion does not change the evolution stage.</p>` : '';
  const collection = `<label for="art-family">Dragon family</label><select id="art-family">${artFamilies.map(id => `<option value="${id}" ${artFamily === id ? 'selected' : ''}>${artName(id)}</option>`).join('')}</select><div class="stage-tabs">${[1, 2, 3].map(stage => button(`Stage ${stage}`, `art-stage:${stage}`, false, `aria-pressed="${stage === artStage}" class="${stage === artStage ? 'selected' : ''}"`)).join('')}</div><img class="art-preview" src="${artUrl(artFamily, artStage)}" alt="${artName(artFamily)} · Stage ${artStage}" loading="lazy" decoding="async"><p>Three stages of each dragon. View the full artwork here; battle forms change at Lv5 and Lv10.</p>`;
  const title = { rules: 'Rules', settings: 'Settings', collection: 'Collection', back: 'End battle?', tutorial: 'Your first battle', evolution: 'Awakening!', chest: 'Daily chest opened!' }[dialog];
  return `<div class="scrim"><section role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>${dialog === 'rules' ? rules : dialog === 'settings' ? settings : dialog === 'collection' ? collection : dialog === 'tutorial' ? tutorial : dialog === 'evolution' ? evolved : dialog === 'chest' ? '<p>+50 XP for each owned dragon</p><p>+3 copies for your dragon, +1 for each companion</p><p>Reward saved. Level up on the map or in your collection.</p>' : quit}${button('Close', 'close')}</section></div>`;
}
function dailyPanel() {
  const d = profile.daily;
  return `<section class="daily-panel"><h2>Daily quests</h2><div>${QUESTS.map(q => `<small>${d[q.id] >= q.goal ? '✓' : '○'} ${q.name} · ${d[q.id]}/${q.goal}</small>`).join('')}</div>${button(d.claimed ? 'Chest claimed · tomorrow' : chestReady(profile) ? 'Open chest · 50 XP + copies' : 'Chest locked · finish 3 quests', 'chest', !chestReady(profile), `class="${chestReady(profile) ? 'primary' : ''}"`)}<small>Resets with your phone’s local date</small></section>`;
}
function campaignMap() {
  return `<section class="campaign-map"><h2>${profile.campaign.cleared === 10 ? 'Campaign complete!' : 'Journey to the Sun Citadel'}</h2><p class="tip">Ten battles. Win to open the next one; retry after defeat. Level up and change runes between battles. Your journey is saved.</p><div class="map-nodes">${ENCOUNTERS.map((e, i) => button(`<b>${i + 1}. ${e.name}</b><small>${i < profile.campaign.cleared ? 'Cleared · replay' : i === profile.campaign.cleared ? e.boss ? 'BOSS · ready' : 'Next battle' : 'Win the previous battle'} · Lv${e.level}</small>`, `encounter:${i}`, i > profile.campaign.cleared, `aria-pressed="${encounter === i}" class="${encounter === i ? 'selected' : ''}"`)).join('')}</div><small>${profile.campaign.cleared}/10 cleared · ${Math.floor(profile.campaign.seconds / 60)}m played</small></section>`;
}
function squad() {
  const hero = DRAGONS.find(d => d.id === profile.starter), progress = profile.cards[profile.starter];
  return `${header()}<section class="squad"><div class="hero-progress">${image({ ...hero, level: progress.level })}<div><b>${esc(profile.name)}${profile.name !== hero.name ? ` · ${hero.name}` : ''}</b><small>Lv${progress.level} · XP ${progress.xp} · Copies ${progress.copies}</small>${upgradeButton(profile.starter)}<small>${savedOK ? 'Saved on this phone' : 'Session only · storage unavailable'}</small></div></div><nav class="home-tabs">${['journey', 'dragons', 'daily'].map(view => button(`${view[0].toUpperCase() + view.slice(1)}${view === 'daily' && chestReady(profile) ? ' · Ready!' : ''}`, `view:${view}`, false, `aria-pressed="${homeView === view}" class="${homeView === view ? 'selected' : ''}"`)).join('')}</nav>${homeView === 'dragons' ? trioEditor() : homeView === 'daily' ? dailyPanel() : campaignMap()}</section><footer class="setup-dock"><span>${team.length}/3 dragons · ${RESOURCE_MODES[mode]} · ${AI_DIFFICULTIES[difficulty]}</span>${button(`Battle ${encounter + 1} · ${ENCOUNTERS[encounter].name}`, 'start', team.length !== 3, 'class="primary"')}</footer>${overlay()}`;
}
function trioEditor() {
  return `<h1>Choose your trio</h1><p class="sub">One fighter attacks. Reserves can replace it or fuse with it.</p>${button('View art collection · 12 stages', 'collection')}<p class="tip">Your chosen hatchling is your dragon. The starting trio earns XP after battle; wins award copies and three wins unlock Aurion. Progress saves in this browser.</p><p class="tip">The first dragon is your fighter; two are reserves. Lead changes your fighter. Fury: +8 attack, −10 HP. Ward: +30 HP, +5 block, −6 attack. Life: heal 8 after attacking, +10 HP, −4 attack.</p><div class="catalog">${FAMILIES.map(id => DRAGONS.find(d => d.id === id)).map(d => {
    const stats = previewDragon(d.id, profile.cards[d.id].rune, profile.cards[d.id]?.level || 1);
    const chosen = team.find(x => x.id === d.id), index = team.findIndex(x => x.id === d.id), rune = RUNES[profile.cards[d.id].rune];
    return `<article class="roster ${chosen ? 'chosen' : ''}">${button(`${image({ ...d, level: profile.cards[d.id]?.level || 1 }, true)}<span><b>${d.name}</b><small>${chosen ? ['FIGHTER', 'RESERVE', 'RESERVE'][index] : profile.cards[d.id].owned ? team.length === 3 ? 'REMOVE ONE TO ADD' : 'ADD TO TRIO' : 'LOCKED · WIN 3 BATTLES'}</small></span>`, `pick:${d.id}`, !profile.cards[d.id].owned || !chosen && team.length === 3, `aria-pressed="${!!chosen}"`)}<label>Rune<select data-rune="${d.id}" ${!profile.cards[d.id].owned ? 'disabled' : ''}>${Object.entries(RUNES).map(([id]) => `<option value="${id}" ${profile.cards[d.id].rune === id ? 'selected' : ''}>${runeEffect(id)}</option>`).join('')}</select></label><small>${stats.maxHp} HP · ${stats.damage} attack · ${stats.guard} block${rune.heal ? ` · heals ${rune.heal}` : ''}</small><small>Lv${stats.level} · XP ${profile.cards[d.id].xp} · Copies ${profile.cards[d.id].copies}</small>${chosen && index > 0 ? button('Lead · set fighter', `lead:${d.id}`) : ''}${upgradeButton(d.id)}</article>`;
  }).join('')}</div>`;
}
function adoption() {
  return `${header()}<section class="squad"><h1>Choose your hatchling</h1><p class="tip">Choose and name your hatchling. The other two starting dragons join your team. Aurion unlocks after three wins.</p><div class="catalog starter-grid">${STARTERS.map(id => { const d = DRAGONS.find(x => x.id === id); return `<article class="roster ${selectedCub === id ? 'chosen' : ''}">${button(`${image(d)}<span><b>${d.name}</b><small>${id === 'sylvara' ? 'Healing' : id === 'cinder' ? 'Energy' : 'Attack'}</small></span>`, `cub:${id}`, false, `aria-pressed="${selectedCub === id}"`)}</article>`; }).join('')}</div><label class="name-label" for="hero-name">Dragon name<input id="hero-name" maxlength="20" value="${esc(heroName)}" placeholder="${artName(selectedCub)}" autocomplete="off"></label></section><footer class="setup-dock">${button('Adopt & continue', 'adopt', false, 'class="primary"')}</footer>${overlay()}`;
}
function card(d, side, zone, index, small = false) {
  const selected = side === 0 && selection.zone === zone && selection.index === index;
  const label = `${d.name}, ${d.hp} of ${d.maxHp} HP, ${RUNES[d.rune].role}${match.mode !== 'charge' ? `, ${resource(match, side, d)} ${resourceName(match.mode)}` : ''}`;
  const content = `${small ? '' : image(d)}<span class="card-info"><b>${esc(d.name)}</b><span class="hp">${d.hp}<small> / ${d.maxHp} HP</small></span><progress value="${d.hp}" max="${d.maxHp}" aria-label="Health"></progress><small>${d.fused ? 'Fused · ' : ''}${RUNES[d.rune].name} · ${small ? `Lv${d.level}` : RUNES[d.rune].role}</small>${!small && d.stage > 1 ? `<small class="ability">Lv${d.level} · ${ABILITIES[d.art]?.[d.stage - 2]?.split(" · ")[0] || "Awakened"}</small>` : ""}${small && match.mode !== 'charge' ? `<span class="energy-label">${resourceName(match.mode)} ${resource(match, side, d)}/4 ${pips(resource(match, side, d))}</span>` : ''}</span>`;
  return side === 1 ? `<article class="dragon ${small ? 'mini' : ''}" aria-label="${esc(label)}">${content}</article>` : button(content, `select:${zone}:${index}`, busy || match.actor !== 0 || match.winner !== null, `class="dragon ${small ? 'mini' : ''} ${selected ? 'selected' : ''}" aria-pressed="${selected}" aria-label="${esc(label)}"`);
}
function can(type, index, attack) { return !busy && !animating && match.actor === 0 && legalActions(match).some(a => a.type === type && a.index === index && a.attack === attack); }
function dock() {
  const p = match.players[0], a = p.field[0], target = match.players[1].field[0], { zone, index } = selection;
  const chosen = zone === 'field' ? p.field[index] : p.hand[index], reserve = zone === 'field' && index > 0;
  const amount = resource(match, 0), pool = resourceName(match.mode), waiting = busy || match.actor !== 0;
  const switchReason = waiting ? 'Wait for AI' : p.switched ? 'Used this turn' : !reserve ? 'Pick a reserve' : amount < 1 ? `Need 1 ${pool}` : esc(chosen.name);
  const fusionEnergy = match.mode === 'charge' ? amount : resource(match, 0, a) + (reserve ? resource(match, 0, chosen) : 0);
  const fuseReason = waiting ? 'Wait for AI' : p.fusionUsed ? 'Used this battle' : !reserve ? 'Pick a reserve' : fusionEnergy < 2 ? (match.mode === 'charge' ? 'Need 2 Charge' : 'Need 2 combined') : '+35 HP · +12 attack';
  const tip = waiting ? 'Enemy turn. Next you can prepare and make one attack.' : zone === 'hand' ? 'Deploy adds a reinforcement to reserve for free. It can attack after Switch.' : reserve ? `${esc(chosen.name)}: Switch to the front; Fuse into ${esc(a.name)}: +35 HP, +12 attack.` : match.mode === 'energy' ? `Attach: +1 to the chosen dragon. Claw: +${attackResourceGain(a, 'strike')} to the fighter. Then attack.` : `Reserves: Switch / Fuse. Claw: +${attackResourceGain(a, 'strike')} Charge. An attack ends the turn.`;
  const attachReason = waiting ? 'Wait for AI' : zone !== 'field' ? 'Pick your dragon' : p.attached ? 'Used this turn' : chosen.energy === 4 ? 'Already full · 4/4' : esc(chosen.name);
  return `<footer class="action-dock"><div class="resource-row"><b>${pool} ${amount}/4 ${pips(amount)}</b><small>${match.mode === 'charge' ? 'Shared by your team' : `On fighter · AI ${resource(match, 1)}/4`}</small></div>
    <p class="tip">${tip}</p><div class="preparation">${match.mode === 'energy' ? button(`<b>Attach +1</b><small>${attachReason}</small>`, 'attach', zone !== 'field' || !can('attach', index)) : ''}${zone === 'hand' ? button(`<b>Deploy</b><small>${p.field.length === 4 ? 'Bench is full' : waiting ? 'Wait for AI' : 'Free · add to bench'}</small>`, 'deploy', !can('deploy', index)) : `${button(`<b>Switch · 1</b><small>${switchReason}</small>`, 'switch', !reserve || !can('switch', index))}${button(`<b>Fuse · 2</b><small>${fuseReason}</small>`, 'fuse', !reserve || !can('fuse', index))}`}</div>
    <div class="front-label">ATTACK WITH ${esc(a.name)}</div><div class="attacks">${Object.entries(ATTACKS).map(([id, spec]) => button(`<b>${spec.name}</b><small>${attackDamage(a, target, id)} damage</small><small>${waiting ? 'Wait for AI' : amount < spec.cost ? `Need ${spec.cost} · have ${amount}` : spec.cost ? `Spend ${spec.cost} ${pool}` : `Free · +${attackResourceGain(a, id)} ${pool}`}</small>`, `attack:${id}`, !can('attack', undefined, id), `class="${id === 'burst' ? 'ultimate' : ''}"`)).join('')}</div></footer>`;
}
function cardBattle() {
  const [you, foe] = match.players, over = match.winner !== null;
  return `${header()}<div class="match-bar"><b>Defeated · You ${you.kos} · AI ${foe.kos}</b><span>${RESOURCE_MODES[match.mode]} · ${AI_DIFFICULTIES[match.difficulty]} · Battle ${battleEncounter + 1} · Turn ${match.turn}</span></div>
    <p class="turn-status" role="status">${over ? match.winner === 0 ? 'Victory!' : 'Defeat' : busy || match.actor === 1 ? 'AI is choosing…' : 'Your turn'}</p><p class="battle-guide" aria-live="polite">${esc([...aiMoves, feedback || 'Defeat three enemies or the whole team. Reserves: Switch / Fuse.'].join(' '))}</p>
    <section class="arena"><div class="fighters"><div class="fighter"><div class="front-label">YOUR FIGHTER · ATTACKS</div>${you.field[0] ? card(you.field[0], 0, 'field', 0) : ''}</div><div class="fighter"><div class="front-label">ENEMY FIGHTER · TARGET</div>${foe.field[0] ? card(foe.field[0], 1, 'field', 0) : ''}</div></div>
    <div class="front-label">YOUR RESERVES · TAP TO CHOOSE</div><div class="bench your-bench">${you.field.slice(1).map((d, i) => card(d, 0, 'field', i + 1, true)).join('') || '<p>No reserves left.</p>'}</div></section>${over ? result() : dock()}
    <section class="extras"><details><summary>Enemy reserves · ${Math.max(0, foe.field.length - 1)} / Battle log</summary><div class="enemy-bench bench">${foe.field.slice(1).map((d, i) => card(d, 1, 'field', i + 1, true)).join('')}</div><ol>${match.log.map(line => `<li>${esc(line)}</li>`).join('')}</ol></details></section>${overlay()}`;
}
function sceneDock() {
  const p = match.players[0], a = p.field[0] || animationEvent?.before.players[0].field[0], target = match.players[1].field[0] || animationEvent?.before.players[1].field[0];
  if (!a || !target) return '';
  const amount = resource(match, 0), pool = resourceName(match.mode), waiting = busy || animating || match.actor !== 0;
  const actions = waiting ? [] : legalActions(match), selected = selection.zone === 'field' && selection.index > 0;
  const switchOK = actions.some(x => x.type === 'switch'), fuseOK = actions.some(x => x.type === 'fuse');
  const switchReason = waiting ? 'Resolving turn' : p.switched ? 'Used this turn' : amount < 1 ? `Need 1 ${pool}` : 'Tap a reserve';
  const fuseReason = waiting ? 'Resolving turn' : p.fusionUsed ? 'Used this battle' : fuseOK ? selected ? 'Use chosen reserve' : 'Choose a reserve' : match.mode === 'charge' ? 'Need 2 Charge' : 'Need 2 combined';
  const attachIndex = selection.zone === 'field' ? selection.index : 0, chosen = p.field[attachIndex] || a;
  const tip = reserveIntent === 'fuse' ? 'Tap a reserve to fuse. It will be consumed.' : match.mode === 'energy' ? 'Attach Energy to your fighter or a reserve. One attack ends your turn.' : 'Claw builds Charge. One attack ends your turn.';
  return `<footer class="action-dock"><div class="resource-row"><b>${pool} ${amount}/4 ${pips(amount)}</b><small>${match.mode === 'charge' ? 'Shared by your team' : match.mode === 'dragon-charge' ? 'Stored on this fighter' : 'Attached to your fighter'}</small></div><div class="attacks">${Object.entries(ATTACKS).map(([id, spec]) => button(`<b>${spec.name}</b><small>${attackDamage(a, target, id)} damage</small><small>${spec.cost ? `${spec.cost} ${pool}` : `Free · +${attackResourceGain(a, id)} ${pool}`}</small>`, `attack:${id}`, !can('attack', undefined, id), `class="${id === 'burst' ? 'ultimate' : ''}"`)).join('')}</div><div class="preparation">${match.mode === 'energy' ? button(`<b>Attach +1</b><small>${p.attached ? 'Used this turn' : chosen.energy === 4 ? 'Full · 4/4' : esc(chosen.name)}</small>`, 'attach', !can('attach', attachIndex)) : ''}${button('<b>Switch · 1</b><small>' + switchReason + '</small>', 'switch', !switchOK)}${button('<b>Fuse · 2</b><small>' + fuseReason + '</small>', 'fuse', !fuseOK)}</div><p class="tip">${tip}</p></footer>`;
}
function sceneBattle() {
  const [you, foe] = match.players, over = match.winner !== null && !animating;
  const shown = animating && animationEvent ? animationEvent.before : match;
  return `${header()}<div class="match-bar"><b>Defeated · You ${you.kos} · Enemy ${foe.kos}</b><span>${RESOURCE_MODES[match.mode]} · ${AI_DIFFICULTIES[match.difficulty]} · Battle ${battleEncounter + 1} · Turn ${match.turn}</span></div><p class="turn-status" role="status">${over ? match.winner === 0 ? 'Victory!' : 'Defeat' : animating ? 'Resolving…' : busy || match.actor === 1 ? 'Enemy turn' : 'Your turn'}</p>${battlefieldMarkup(shown, feel.motion)}${reserveRow(match, selection, busy || animating || match.actor !== 0 || over, reserveIntent, can)}${over ? result() : sceneDock()}<p class="battle-guide" aria-live="polite">${esc([...aiMoves, feedback || 'Defeat three enemy dragons or their whole team.'].join(' '))}</p><section class="extras"><details><summary>Battle log · Enemy reserves ${Math.max(0, foe.field.length - 1)}</summary><ol>${match.log.map(line => `<li>${esc(line)}</li>`).join('')}</ol></details></section>${overlay()}`;
}
const battle = () => battleView === 'arena' ? sceneBattle() : cardBattle();
function result() {
  const seconds = Math.round((Date.now() - started) / 1000);
  return `<section class="result" role="region" aria-label="Battle result"><h1>${match.winner === 0 ? 'Victory!' : 'Defeat'}</h1><p>You ${match.players[0].kos} · AI ${match.players[1].kos} · ${Math.floor(seconds / 60)}m ${seconds % 60}s</p><p class="reward">XP +${battleReward?.xp || 0} · Copies +${battleReward?.copies || 0}${battleReward?.unlocked ? ` · ${battleReward.unlocked} unlocked` : ''}</p>${upgradeButton(profile.starter)}${button(match.winner === 0 && profile.campaign.cleared < 10 ? 'Next battle' : 'Play again', 'replay', false, 'class="primary"')}${button(`Try ${match.mode === 'charge' ? 'Dragon Charge' : 'Team Charge'}`, 'compare')}${button('Map & upgrades', 'quit')}<p>${savedOK ? 'Reward saved in this browser.' : 'Storage unavailable: progress lasts until this page closes.'}</p></section>`;
}
function render() {
  const refreshed = refreshDaily(profile); if (refreshed !== profile) { profile = refreshed; if (profile.starter) persist(); }
  if (match && match.winner !== null && !animating && battleReward === null) { const awarded = awardBattle(profile, battleId, match.winner === 0); profile = recordCampaign(awardDaily(awarded.profile, match.winner === 0, battleClaws), battleEncounter, match.winner === 0, (Date.now() - started) / 1000); encounter = Math.min(9, profile.campaign.cleared); restoreTeam(); battleReward = awarded.reward || { xp: 0, copies: 0 }; persist(); }
  if (match && !match.players[0][selection.zone]?.[selection.index]) selection = { zone: 'field', index: 0 };
  const previousScene = animating ? app.querySelector('.battlefield') : null;
  app.classList.toggle('in-battle', !!match); app.classList.toggle('scene-view', !!match && battleView === 'arena');
  app.classList.toggle('motion-off', !feel.motion);
  app.dataset.battleView = battleView;
  app.dataset.resourceMode = match?.mode || mode;
  app.innerHTML = !profile.starter ? adoption() : match ? battle() : squad();
  if (previousScene && app.querySelector('.battlefield')) app.querySelector('.battlefield').replaceWith(previousScene);
  app.querySelector('.battlefield')?.classList.toggle('motion-off', !feel.motion);
  hydrateSprites(app);
  if (pendingEffect) { const effect = pendingEffect; pendingEffect = null; feedbackEffect(effect.type, battleView === 'arena' ? null : app.querySelector(effect.selector)); if (effect.result) feedbackEffect(effect.result, app.querySelector('.result')); }
}
function play(action) {
  const side = match.actor, before = battleView === 'arena' ? structuredClone(match) : null;
  const target = match.players[1 - side].field[0], oldName = target?.name;
  const player = match.players[side], chosenName = (action.type === 'deploy' ? player.hand : player.field)[action.index]?.name;
  const damage = action.type === 'attack' ? attackDamage(player.field[0], target, action.attack) : 0;
  if (!act(match, action)) return false;
  if (before) animationEvent = { before, after: structuredClone(match), side, action: { ...action }, damage };
  if (side === 0 && action.attack === 'strike') battleClaws++;
  pendingEffect = { type: action.attack || action.type, selector: `.fighters .fighter:nth-child(${action.type === 'attack' ? side === 0 ? 2 : 1 : side === 0 ? 1 : 2}) .dragon`, result: match.winner === null ? null : match.winner === 0 ? 'victory' : 'defeat' };
  if (side === 0) aiMoves = [];
  if (side === 1 && action.type === 'switch') aiMoves.push(`Enemy Switch: ${player.field[0].name} takes the front for 1 resource.`);
  if (side === 1 && action.type === 'fuse') aiMoves.push(`Enemy Fuse: consumes ${chosenName}, gains +35 HP and +12 attack.`);
  if (action.type === 'attack') {
    feedback = `${side === 0 ? 'You' : 'Enemy'}: ${ATTACKS[action.attack].name} hits ${oldName} for ${damage}.`;
    if (target.hp === 0) feedback += ` ${oldName} is defeated.${match.winner !== null ? ' Battle over.' : match.players[1 - side].field[0] ? ` ${match.players[1 - side].field[0].name} takes the front.` : ''}`;
  } else feedback = `${side === 0 ? 'You' : 'Enemy'}: ${({
    attach: `${chosenName} gains +1 Energy.`,
    deploy: `${chosenName} joins the reserves.`,
    switch: `${player.field[0].name} takes the front. Switch spent 1 resource.`,
    fuse: `${chosenName} is consumed. Fighter gains +35 HP, +12 attack and +2 block.`,
  })[action.type]}`;
  return true;
}
async function performAction(action) {
  const token = generation;
  animating = battleView === 'arena' && feel.motion && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!play(action)) { animating = false; return false; }
  if (['switch', 'deploy', 'fuse'].includes(action.type)) selection = { zone: 'field', index: 0 };
  render();
  try {
    if (animating) { const root = app.querySelector('.battlefield'); await animateBattlefield(root, animationEvent, feel.motion, () => token === generation && !!match && root.isConnected); }
  } finally {
    if (token === generation) { animating = false; animationEvent = null; render(); }
  }
  return token === generation;
}
function start(sameSeed = false) {
  battleId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; battleReward = null; battleClaws = 0;
  generation++; animating = false; animationEvent = null; reserveIntent = 'switch'; if (!sameSeed) seed = Date.now(); battleEncounter = sameSeed ? battleEncounter : encounter; match = campaignMatch(profile, battleEncounter, mode, seed); match.difficulty = difficulty; started = Date.now(); selection = { zone: 'field', index: 0 }; busy = false; feedback = ''; aiMoves = []; render(); transition(app); window.scrollTo(0, 0);
}
function aiTurn() {
  busy = true; aiMoves = []; render(); const token = generation;
  const step = async () => {
    if (token !== generation || !match || match.winner !== null) return;
    if (match.actor !== 1) { busy = false; selection = { zone: 'field', index: 0 }; reserveIntent = 'switch'; render(); return; }
    await performAction(chooseAI(match));
    if (token !== generation || !match) return;
    if (match.winner !== null) { busy = false; render(); } else setTimeout(step, 420);
  };
  setTimeout(step, 850);
}
app.addEventListener('click', async event => {
  const control = event.target.closest('[data-command]'); if (!control || control.disabled) return;
  unlockAudio();
  const [command, value, index] = control.dataset.command.split(':');
  if (command === 'view' && !match && ['journey', 'dragons', 'daily'].includes(value)) { homeView = value; render(); transition(app.querySelector('.squad')); window.scrollTo(0, 0); return; }
  if (command === 'chest' && !match) { const reward = claimChest(profile); if (!reward) return; profile = reward.profile; persist(); restoreTeam(); dialog = 'chest'; feedbackEffect('victory', null); render(); return; }
  if (command === 'upgrade' && (!match || match.winner !== null)) {
    const upgraded = upgradeDragon(profile, value); if (!upgraded) return;
    profile = upgraded.profile; persist(); restoreTeam();
    if (upgraded.evolved) { evolution = upgraded; dialog = 'evolution'; feedbackEffect('evolution', null); }
    render(); return;
  }
  if (command === 'cub' && STARTERS.includes(value)) { heroName = app.querySelector('#hero-name')?.value || ''; selectedCub = value; render(); return; }
  if (command === 'adopt') { profile = adoptProfile(selectedCub, app.querySelector('#hero-name')?.value); persist(); restoreTeam(); render(); window.scrollTo(0, 0); return; }
  if (['rules', 'settings', 'back', 'collection'].includes(command)) { dialog = command; render(); app.querySelector('[role="dialog"] button')?.focus(); return; }
  if (command === 'art-stage' && dialog === 'collection' && ['1', '2', '3'].includes(value)) { artStage = Number(value); render(); app.querySelector(`[data-command="art-stage:${value}"]`)?.focus(); return; }
  if (command === 'close') { dialog = ''; render(); return; }
  if (command === 'encounter' && !match && Number(value) <= profile.campaign.cleared && ENCOUNTERS[Number(value)]) { encounter = Number(value); render(); return; }
  if (command === 'pick' && profile.cards[value]?.owned) { const found = profile.team.indexOf(value); if (found >= 0) profile.team.splice(found, 1); else if (profile.team.length < 3) profile.team.push(value); persist(); restoreTeam(); render(); return; }
  if (command === 'lead' && profile.team.includes(value)) { profile.team = [value, ...profile.team.filter(id => id !== value)]; persist(); restoreTeam(); render(); return; }
  if (command === 'quit') { generation++; busy = false; animating = false; animationEvent = null; match = null; dialog = ''; render(); window.scrollTo(0, 0); return; }
  if (command === 'begin-tutorial') { tutorialSeen = true; try { stageStorage.setItem('dragon-tutorial-seen', '1'); } catch { /* Optional storage. */ } dialog = ''; start(); return; }
  if ((command === 'start' || command === 'replay') && team.length !== 3) return;
  if (command === 'start' && !tutorialSeen) { dialog = 'tutorial'; render(); return; }
  if (command === 'start' || command === 'replay') { start(); return; }
  if (command === 'compare') { mode = match.mode === 'charge' ? 'dragon-charge' : 'charge'; saveMode(); start(true); return; }
  if (!match || busy || animating || match.actor !== 0 || match.winner !== null || dialog) return;
  if (battleView === 'arena' && command === 'reserve') {
    const reserve = Number(value); if (!match.players[0].field[reserve] || reserve < 1) return;
    selection = { zone: 'field', index: reserve };
    if (reserveIntent === 'fuse') { await confirmFusion(); reserveIntent = 'switch'; render(); }
    else if (can('switch', reserve)) await performAction({ type: 'switch', index: reserve });
    else render();
    return;
  }
  if (battleView === 'arena' && command === 'reserve-energy') {
    const reserve = Number(value); if (!can('attach', reserve)) return;
    selection = { zone: 'field', index: reserve }; await performAction({ type: 'attach', index: reserve }); return;
  }
  if (battleView === 'arena' && command === 'switch' && (selection.zone !== 'field' || selection.index === 0)) { reserveIntent = 'switch'; render(); return; }
  if (battleView === 'arena' && command === 'fuse' && (selection.zone !== 'field' || selection.index === 0)) { reserveIntent = 'fuse'; render(); return; }
  if (command === 'select') { selection = { zone: value, index: Number(index) }; render(); return; }
  if (command === 'fuse') { await confirmFusion(); return; }
  const action = command === 'attack' ? { type: 'attack', attack: value } : { type: command, index: selection.index };
  if (await performAction(action)) { if (match.actor === 1 && match.winner === null) aiTurn(); }
});
async function confirmFusion() {
  dialog = ''; const index = selection.index, b = match.players[0].field[index];
  if (!b || index === 0 || !can('fuse', index)) return;
  if (window.confirm(`Fuse with ${b.name}? This dragon is consumed.\nYour fighter gains +35 HP and +12 attack.`)) await performAction({ type: 'fuse', index });
}
function saveMode() { saveBattleSettings(mode, difficulty); }
app.addEventListener('change', event => {
  if (event.target.dataset.feel) { setFeel(event.target.dataset.feel, event.target.checked); app.classList.toggle('motion-off', !feel.motion); app.querySelector('.battlefield')?.classList.toggle('motion-off', !feel.motion); return; }
  if (event.target.id === 'art-family' && artFamilies.includes(event.target.value)) { artFamily = event.target.value; render(); app.querySelector('#art-family')?.focus(); }
  if (event.target.id === 'mode' && event.target.value in RESOURCE_MODES) { mode = event.target.value; saveMode(); }
  if (event.target.id === 'difficulty' && event.target.value in AI_DIFFICULTIES) { difficulty = event.target.value; saveMode(); }
  if (event.target.dataset.rune) { const c = profile.cards[event.target.dataset.rune]; if (c?.owned && RUNES[event.target.value]) { c.rune = event.target.value; persist(); restoreTeam(); render(); } }
});
app.addEventListener('load', event => { if (event.target.classList?.contains('evolution-art')) event.target.classList.add('ready'); }, true);
app.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog) { dialog = ''; render(); } });
render();
