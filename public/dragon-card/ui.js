import { DRAGONS, RUNES, ATTACKS, ABILITIES, stageForLevel, previewDragon, attackResourceGain, createMatch, act, legalActions, chooseAI, resource, attackDamage } from './match.js';
import { FAMILIES, STARTERS, loadProfile, adoptProfile, awardBattle, saveProfile, upgradeCost, canUpgrade, upgradeDragon } from './profile.js';
import { ENCOUNTERS, campaignMatch, recordCampaign } from './campaign.js';
import { feel, setFeel, unlockAudio, transition, feedbackEffect } from './feel.js';
import { QUESTS, refreshDaily, awardDaily, chestReady, claimChest } from './daily.js';
const app = document.querySelector('#app');
const artBase = new URL('./assets/dragons/', import.meta.url);
const artFamilies = FAMILIES;
let artFamily = 'vorathion', artStage = 1;
let tutorialSeen = false, aiMoves = [], pendingEffect = null, battleClaws = 0;
const artName = id => id[0].toUpperCase() + id.slice(1);
let mode = 'charge', team = DRAGONS.slice(0, 5).map((d, i) => ({ id: d.id, rune: ['fury', 'ward', 'life'][i % 3] }));
let match = null, selection = { zone: 'field', index: 0 }, dialog = '', busy = false, generation = 0, started = 0, seed = Date.now(), feedback = '';
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
let profile = loadProfile(storage), selectedCub = STARTERS[0], heroName = '', savedOK = true, battleId = '', battleReward = null, evolution = null;
let encounter = Math.min(9, profile.campaign.cleared), battleEncounter = encounter;
function persist() { savedOK = saveProfile(profile, storage); }
function restoreTeam() {
  team = profile.team.map(id => ({ id, rune: profile.cards[id].rune, level: profile.cards[id].level, ...(id === profile.starter ? { nickname: profile.name } : {}) }));
}
if (profile.starter) restoreTeam();
try { const saved = localStorage.getItem('dragon-prototype-mode'); if (['charge', 'energy'].includes(saved)) mode = saved; } catch { /* Preference storage is optional. */ }
try { tutorialSeen = localStorage.getItem('dragon-tutorial-seen') === '1'; } catch { /* Optional storage. */ }
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
  const rules = `<p lang="ru">Победа: выбей 3 драконов или всю команду соперника. Атакует только боец впереди; атака завершает ход.</p>
    <p lang="ru">Claw бесплатна и копит ресурс. Breath тратит 2, Ultimate — 3. Каждый ход получаешь ещё +1.</p>
    <p lang="ru">Charge — общая шкала команды. Energy — нажми своего дракона, затем Attach: энергия остаётся на нём, в том числе на скамье.</p>
    <p lang="ru">Switch: выбери дракона на скамье. Смена стоит 1 ресурс и доступна раз за ход.</p>
    <p lang="ru">Fuse: выбери дракона на скамье. Он исчезнет, а передний получит +35 HP и +12 урона. Цена 2 ресурса; в Energy складываются ресурсы обеих карт. Раз за бой, руна переднего сохраняется.</p>
    <p lang="ru">Руны выбираются до боя: Fury повышает урон; Ward добавляет HP и защиту; Life лечит после каждой атаки.</p>`;
  const settings = `<label for="mode">Resource mode</label><select id="mode"><option value="charge" ${mode === 'charge' ? 'selected' : ''}>Charge · shared team bar</option><option value="energy" ${mode === 'energy' ? 'selected' : ''}>Energy · attached to a dragon</option></select><p lang="ru">Charge автоматически растёт на 1 в начале хода. В Energy ты сам выбираешь, кому дать +1. Максимум 4, сильные атаки тратят ресурс.</p>${match ? '<p>Resource changes apply to the next battle.</p>' : ''}<div class="feel-settings">${Object.entries(feel).map(([id, checked]) => `<label><input type="checkbox" data-feel="${id}" ${checked ? 'checked' : ''}>${({ sound: 'Sound · WebAudio', vibration: 'Vibration · supported devices', motion: 'Motion effects' })[id]}</label>`).join('')}</div>`;
  const quit = `<p>End this battle and return to your squad?</p>${button('End battle', 'quit', false, 'class="primary"')}`;
  const tutorial = `<p lang="ru"><b>1. Один боец впереди.</b> Он атакует, запасные ждут. Claw бесплатна и копит ресурс.</p><p lang="ru"><b>2. Подготовка, затем атака.</b> Нажми запасного: Switch выводит его вперёд за 1 ресурс. Fuse поглощает его и усиливает бойца за 2. Атака завершает ход.</p><p lang="ru"><b>3. Следи за ИИ.</b> Его смена и слияние будут объяснены над бойцами. Победа — 3 выбитых врага. На серых кнопках написано, чего не хватает.</p>${button('Let’s battle', 'begin-tutorial', false, 'class="primary"')}`;
  const evolved = evolution ? `<img class="art-preview evolution-art" src="${artUrl(evolution.id, evolution.stage)}" alt="${artName(evolution.id)} · Stage ${evolution.stage}" loading="lazy" decoding="async"><p>Lv${profile.cards[evolution.id].level} · Stage ${evolution.stage}</p><p>${ABILITIES[evolution.id][evolution.stage - 2]}</p><p lang="ru">Новый вид и умение активны со следующего боя. Слияние не меняет стадию эволюции.</p>` : '';
  const collection = `<label for="art-family">Dragon family</label><select id="art-family">${artFamilies.map(id => `<option value="${id}" ${artFamily === id ? 'selected' : ''}>${artName(id)}</option>`).join('')}</select><div class="stage-tabs">${[1, 2, 3].map(stage => button(`Stage ${stage}`, `art-stage:${stage}`, false, `aria-pressed="${stage === artStage}" class="${stage === artStage ? 'selected' : ''}"`)).join('')}</div><img class="art-preview" src="${artUrl(artFamily, artStage)}" alt="${artName(artFamily)} · Stage ${artStage}" loading="lazy" decoding="async"><p lang="ru">Три стадии одного дракона. Здесь можно рассмотреть арты целиком; в бою стадия меняется на Lv5 и Lv10.</p>`;
  const title = { rules: 'Rules', settings: 'Settings', collection: 'Collection', back: 'End battle?', tutorial: 'Your first battle', evolution: 'Awakening!', chest: 'Daily chest opened!' }[dialog];
  return `<div class="scrim"><section role="dialog" aria-modal="true" aria-label="${title}"><h2>${title}</h2>${dialog === 'rules' ? rules : dialog === 'settings' ? settings : dialog === 'collection' ? collection : dialog === 'tutorial' ? tutorial : dialog === 'evolution' ? evolved : dialog === 'chest' ? '<p>+50 XP for each owned dragon</p><p>+3 copies for your dragon, +1 for each companion</p><p lang="ru">Награда сохранена. Повышай уровень на карте или в коллекции.</p>' : quit}${button('Close', 'close')}</section></div>`;
}
function dailyPanel() {
  const d = profile.daily;
  return `<section class="daily-panel"><h2>Daily quests</h2><div>${QUESTS.map(q => `<small>${d[q.id] >= q.goal ? '✓' : '○'} ${q.name} · ${d[q.id]}/${q.goal}</small>`).join('')}</div>${button(d.claimed ? 'Chest claimed · tomorrow' : chestReady(profile) ? 'Open chest · 50 XP + copies' : 'Chest locked · finish 3 quests', 'chest', !chestReady(profile), `class="${chestReady(profile) ? 'primary' : ''}"`)}<small>Resets with your phone’s local date</small></section>`;
}
function campaignMap() {
  return `<section class="campaign-map"><h2>${profile.campaign.cleared === 10 ? 'Campaign complete!' : 'Journey to the Sun Citadel'}</h2><p class="tip" lang="ru">10 боёв. Победа открывает следующий; поражение можно повторить. Между боями повышай уровень и меняй руны. Путь сохранён.</p><div class="map-nodes">${ENCOUNTERS.map((e, i) => button(`<b>${i + 1}. ${e.name}</b><small>${i < profile.campaign.cleared ? 'Cleared · replay' : i === profile.campaign.cleared ? e.boss ? 'BOSS · ready' : 'Next battle' : 'Win the previous battle'} · Lv${e.level}</small>`, `encounter:${i}`, i > profile.campaign.cleared, `aria-pressed="${encounter === i}" class="${encounter === i ? 'selected' : ''}"`)).join('')}</div><small>${profile.campaign.cleared}/10 cleared · ${Math.floor(profile.campaign.seconds / 60)}m played</small></section>`;
}
function squad() {
  const hero = DRAGONS.find(d => d.id === profile.starter), progress = profile.cards[profile.starter];
  return `${header()}<section class="squad"><div class="hero-progress">${image({ ...hero, level: progress.level })}<div><b>${esc(profile.name)} · ${hero.name}</b><small>Lv${progress.level} · XP ${progress.xp} · Copies ${progress.copies}</small>${upgradeButton(profile.starter)}<small>${savedOK ? 'Saved on this phone' : 'Session only · storage unavailable'}</small></div></div>${campaignMap()}${dailyPanel()}<h1>Choose your trio</h1><p class="sub">One fighter attacks. Reserves can replace it or fuse with it.</p>${button('View art collection · 12 stages', 'collection')}<p class="tip" lang="ru">Выбранный детёныш — твой дракон. После боя вся стартовая тройка получает опыт; победа даёт дубликаты, 3 победы открывают Aurion. Прогресс сохраняется в этом браузере.</p><p class="tip" lang="ru">Первый дракон — боец, два — запасные. Lead меняет первого бойца. Fury: +8 урона, −10 HP. Ward: +30 HP, +5 защиты, −6 урона. Life: лечение на 8 после атаки, +10 HP, −4 урона.</p><div class="catalog">${FAMILIES.map(id => DRAGONS.find(d => d.id === id)).map(d => {
    const stats = previewDragon(d.id, profile.cards[d.id].rune, profile.cards[d.id]?.level || 1);
    const chosen = team.find(x => x.id === d.id), index = team.findIndex(x => x.id === d.id), rune = RUNES[profile.cards[d.id].rune];
    return `<article class="roster ${chosen ? 'chosen' : ''}">${button(`${image({ ...d, level: profile.cards[d.id]?.level || 1 }, true)}<span><b>${d.name}</b><small>${chosen ? ['FIGHTER', 'RESERVE', 'RESERVE'][index] : profile.cards[d.id].owned ? team.length === 3 ? 'REMOVE ONE TO ADD' : 'ADD TO TRIO' : 'LOCKED · WIN 3 BATTLES'}</small></span>`, `pick:${d.id}`, !profile.cards[d.id].owned || !chosen && team.length === 3, `aria-pressed="${!!chosen}"`)}<label>Rune<select data-rune="${d.id}" ${!profile.cards[d.id].owned ? 'disabled' : ''}>${Object.entries(RUNES).map(([id]) => `<option value="${id}" ${profile.cards[d.id].rune === id ? 'selected' : ''}>${runeEffect(id)}</option>`).join('')}</select></label><small>${stats.maxHp} HP · ${stats.damage} attack · ${stats.guard} block${rune.heal ? ` · heals ${rune.heal}` : ''}</small><small>Lv${stats.level} · XP ${profile.cards[d.id].xp} · Copies ${profile.cards[d.id].copies}</small>${chosen && index > 0 ? button('Lead · set fighter', `lead:${d.id}`) : ''}${upgradeButton(d.id)}</article>`;
  }).join('')}</div></section><footer class="setup-dock"><span>${team.length}/3 dragons · ${mode === 'charge' ? 'Charge' : 'Energy'}</span>${button(`Battle ${encounter + 1} · ${ENCOUNTERS[encounter].name}`, 'start', team.length !== 3, 'class="primary"')}</footer>${overlay()}`;
}
function adoption() {
  return `${header()}<section class="squad"><h1>Choose your hatchling</h1><p class="tip" lang="ru">Выбери своего детёныша и дай ему имя. Два других стартовых дракона помогут в команде. Aurion откроется после 3 побед.</p><div class="catalog starter-grid">${STARTERS.map(id => { const d = DRAGONS.find(x => x.id === id); return `<article class="roster ${selectedCub === id ? 'chosen' : ''}">${button(`${image(d)}<span><b>${d.name}</b><small>${id === 'sylvara' ? 'Healing' : id === 'cinder' ? 'Energy' : 'Attack'}</small></span>`, `cub:${id}`, false, `aria-pressed="${selectedCub === id}"`)}</article>`; }).join('')}</div><label class="name-label" for="hero-name">Dragon name<input id="hero-name" maxlength="20" value="${esc(heroName)}" placeholder="${artName(selectedCub)}" autocomplete="off"></label></section><footer class="setup-dock">${button('Adopt & continue', 'adopt', false, 'class="primary"')}</footer>${overlay()}`;
}
function card(d, side, zone, index, small = false) {
  const selected = side === 0 && selection.zone === zone && selection.index === index;
  const label = `${d.name}, ${d.hp} of ${d.maxHp} HP, ${RUNES[d.rune].role}${match.mode === 'energy' ? `, ${d.energy} Energy` : ''}`;
  const content = `${small ? '' : image(d)}<span class="card-info"><b>${esc(d.name)}</b><span class="hp">${d.hp}<small> / ${d.maxHp} HP</small></span><progress value="${d.hp}" max="${d.maxHp}" aria-label="Health"></progress><small>${d.fused ? 'Fused · ' : ''}${small ? RUNES[d.rune].name : runeEffect(d.rune)}</small>${d.stage > 1 ? `<small class="ability">Lv${d.level} · ${ABILITIES[d.art]?.[d.stage - 2]?.split(" · ")[0] || "Awakened"}</small>` : ""}${match.mode === 'energy' ? `<span class="energy-label">Energy ${d.energy}/4 ${pips(d.energy)}</span>` : ''}</span>`;
  return side === 1 ? `<article class="dragon ${small ? 'mini' : ''}" aria-label="${esc(label)}">${content}</article>` : button(content, `select:${zone}:${index}`, busy || match.actor !== 0 || match.winner !== null, `class="dragon ${small ? 'mini' : ''} ${selected ? 'selected' : ''}" aria-pressed="${selected}" aria-label="${esc(label)}"`);
}
function can(type, index, attack) { return !busy && match.actor === 0 && legalActions(match).some(a => a.type === type && a.index === index && a.attack === attack); }
function dock() {
  const p = match.players[0], a = p.field[0], target = match.players[1].field[0], { zone, index } = selection;
  const chosen = zone === 'field' ? p.field[index] : p.hand[index], reserve = zone === 'field' && index > 0;
  const amount = resource(match, 0), pool = match.mode === 'charge' ? 'Charge' : 'Energy', waiting = busy || match.actor !== 0;
  const switchReason = waiting ? 'Wait for AI' : p.switched ? 'Used this turn' : !reserve ? 'Pick a reserve' : amount < 1 ? `Need 1 ${pool}` : esc(chosen.name);
  const fusionEnergy = match.mode === 'charge' ? amount : a.energy + (reserve ? chosen.energy : 0);
  const fuseReason = waiting ? 'Wait for AI' : p.fusionUsed ? 'Used this battle' : !reserve ? 'Pick a reserve' : fusionEnergy < 2 ? (match.mode === 'charge' ? 'Need 2 Charge' : 'Need 2 combined') : '+35 HP · +12 attack';
  const tip = waiting ? 'Сейчас ход ИИ. Затем снова выбираешь подготовку и одну атаку.' : zone === 'hand' ? 'Deploy бесплатно добавит подкрепление в запас. Атаковать оно сможет после Switch.' : reserve ? `${esc(chosen.name)}: Switch — вывести вперёд; Fuse — поглотить (+35 HP, +12 урона) для ${esc(a.name)}.` : match.mode === 'energy' ? `Attach: +1 энергии выбранной карте. Claw даёт +${attackResourceGain(a, 'strike')} бойцу. Атака завершает ход.` : `Подготовка: нажми запасного для Switch или Fuse. Затем атака; Claw даёт +${attackResourceGain(a, 'strike')} Charge.`;
  const attachReason = waiting ? 'Wait for AI' : zone !== 'field' ? 'Pick your dragon' : p.attached ? 'Used this turn' : chosen.energy === 4 ? 'Already full · 4/4' : esc(chosen.name);
  return `<footer class="action-dock"><div class="resource-row"><b>${pool} ${amount}/4 ${pips(amount)}</b><small>${match.mode === 'charge' ? 'Shared by your team' : 'On your fighter'}</small></div>
    <p class="tip" lang="ru">${tip}</p><div class="preparation">${match.mode === 'energy' ? button(`<b>Attach +1</b><small>${attachReason}</small>`, 'attach', zone !== 'field' || !can('attach', index)) : ''}${zone === 'hand' ? button(`<b>Deploy</b><small>${p.field.length === 4 ? 'Bench is full' : waiting ? 'Wait for AI' : 'Free · add to bench'}</small>`, 'deploy', !can('deploy', index)) : `${button(`<b>Switch · 1</b><small>${switchReason}</small>`, 'switch', !reserve || !can('switch', index))}${button(`<b>Fuse · 2</b><small>${fuseReason}</small>`, 'fuse', !reserve || !can('fuse', index))}`}</div>
    <div class="front-label">ATTACK WITH ${esc(a.name)}</div><div class="attacks">${Object.entries(ATTACKS).map(([id, spec]) => button(`<b>${spec.name}</b><small>${attackDamage(a, target, id)} damage</small><small>${waiting ? 'Wait for AI' : amount < spec.cost ? `Need ${spec.cost} · have ${amount}` : spec.cost ? `Spend ${spec.cost} ${pool}` : `Free · +${attackResourceGain(a, id)} ${pool}`}</small>`, `attack:${id}`, !can('attack', undefined, id), `class="${id === 'burst' ? 'ultimate' : ''}"`)).join('')}</div></footer>`;
}
function battle() {
  const [you, foe] = match.players, over = match.winner !== null;
  return `${header()}<div class="match-bar"><b>Defeated · You ${you.kos} · AI ${foe.kos}</b><span>${match.mode === 'charge' ? 'Charge' : 'Energy'} · Battle ${battleEncounter + 1} · Turn ${match.turn}</span></div>
    <p class="turn-status" role="status">${over ? match.winner === 0 ? 'Victory!' : 'Defeat' : busy || match.actor === 1 ? 'AI is choosing…' : 'Your turn'}</p><p class="battle-guide" lang="ru" aria-live="polite">${esc([...aiMoves, feedback || 'Победа — выбить 3 врагов или всю команду. Атакует только боец; запасные ждут смены или слияния.'].join(' '))}</p>
    <section class="arena"><div class="fighters"><div class="fighter"><div class="front-label">YOUR FIGHTER · ATTACKS</div>${you.field[0] ? card(you.field[0], 0, 'field', 0) : ''}</div><div class="fighter"><div class="front-label">ENEMY FIGHTER · TARGET</div>${foe.field[0] ? card(foe.field[0], 1, 'field', 0) : ''}</div></div>
    <div class="front-label">YOUR RESERVES · TAP TO CHOOSE</div><div class="bench your-bench">${you.field.slice(1).map((d, i) => card(d, 0, 'field', i + 1, true)).join('') || '<p>No reserves left.</p>'}</div></section>${over ? result() : dock()}
    <section class="extras"><details><summary>Enemy reserves · ${Math.max(0, foe.field.length - 1)} / Battle log</summary><div class="enemy-bench bench">${foe.field.slice(1).map((d, i) => card(d, 1, 'field', i + 1, true)).join('')}</div><ol>${match.log.map(line => `<li>${esc(line)}</li>`).join('')}</ol></details></section>${overlay()}`;
}
function result() {
  const seconds = Math.round((Date.now() - started) / 1000);
  return `<section class="result" role="region" aria-label="Battle result"><h1>${match.winner === 0 ? 'Victory!' : 'Defeat'}</h1><p>You ${match.players[0].kos} · AI ${match.players[1].kos} · ${Math.floor(seconds / 60)}m ${seconds % 60}s</p><p class="reward">XP +${battleReward?.xp || 0} · Copies +${battleReward?.copies || 0}${battleReward?.unlocked ? ` · ${battleReward.unlocked} unlocked` : ''}</p>${upgradeButton(profile.starter)}${button(match.winner === 0 && profile.campaign.cleared < 10 ? 'Next battle' : 'Play again', 'replay', false, 'class="primary"')}${button(`Try ${match.mode === 'charge' ? 'Energy' : 'Charge'}`, 'compare')}${button('Map & upgrades', 'quit')}<p lang="ru">${savedOK ? 'Награда сохранена в этом браузере.' : 'Сохранение недоступно: прогресс останется только до закрытия страницы.'}</p></section>`;
}
function render() {
  const refreshed = refreshDaily(profile); if (refreshed !== profile) { profile = refreshed; if (profile.starter) persist(); }
  if (match && match.winner !== null && battleReward === null) { const awarded = awardBattle(profile, battleId, match.winner === 0); profile = recordCampaign(awardDaily(awarded.profile, match.winner === 0, battleClaws), battleEncounter, match.winner === 0, (Date.now() - started) / 1000); encounter = Math.min(9, profile.campaign.cleared); restoreTeam(); battleReward = awarded.reward || { xp: 0, copies: 0 }; persist(); }
  if (match && !match.players[0][selection.zone]?.[selection.index]) selection = { zone: 'field', index: 0 };
  app.classList.toggle('in-battle', !!match); app.innerHTML = !profile.starter ? adoption() : match ? battle() : squad();
  if (pendingEffect) { const effect = pendingEffect; pendingEffect = null; feedbackEffect(effect.type, app.querySelector(effect.selector)); if (effect.result) feedbackEffect(effect.result, app.querySelector('.result')); }
}
function play(action) {
  const side = match.actor, target = match.players[1 - side].field[0], oldName = target?.name;
  const player = match.players[side], chosenName = (action.type === 'deploy' ? player.hand : player.field)[action.index]?.name;
  const damage = action.type === 'attack' ? attackDamage(match.players[side].field[0], target, action.attack) : 0;
  if (!act(match, action)) return false;
  if (side === 0 && action.attack === 'strike') battleClaws++;
  pendingEffect = { type: action.attack || action.type, selector: `.fighters .fighter:nth-child(${action.type === 'attack' ? side === 0 ? 2 : 1 : side === 0 ? 1 : 2}) .dragon`, result: match.winner === null ? null : match.winner === 0 ? 'victory' : 'defeat' };
  if (side === 0) aiMoves = [];
  if (side === 1 && action.type === 'switch') aiMoves.push(`ИИ Switch: спасает раненого, выводит ${player.field[0].name} за 1 ресурс.`);
  if (side === 1 && action.type === 'fuse') aiMoves.push(`ИИ Fuse: поглощает ${chosenName}, получает +35 HP и +12 урона.`);
  if (action.type === 'attack') {
    feedback = `${side === 0 ? 'Ты' : 'ИИ'}: ${ATTACKS[action.attack].name} → ${damage} урона ${oldName}.`;
    if (target.hp === 0) feedback = `${oldName} выбит.${match.winner !== null ? ' Бой завершён.' : match.players[1 - side].field[0] ? ` ${side === 1 ? 'Твой' : 'Вражеский'} новый боец: ${match.players[1 - side].field[0].name}.` : ''}`;
  } else feedback = `${side === 0 ? 'Ты' : 'ИИ'}: ${({
    attach: `${chosenName} получает +1 Energy.`,
    deploy: `${chosenName} добавлен в запас.`,
    switch: `${player.field[0].name} теперь боец. Смена потратила 1 ресурс.`,
    fuse: `${chosenName} поглощён. Боец получил +35 HP, +12 урона и +2 защиты.`,
  })[action.type]}`;
  return true;
}
function start(sameSeed = false) {
  battleId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; battleReward = null; battleClaws = 0;
  generation++; if (!sameSeed) seed = Date.now(); battleEncounter = sameSeed ? battleEncounter : encounter; match = campaignMatch(profile, battleEncounter, mode, seed); started = Date.now(); selection = { zone: 'field', index: 0 }; busy = false; feedback = ''; aiMoves = []; render(); transition(app); window.scrollTo(0, 0);
}
function aiTurn() {
  busy = true; aiMoves = []; render(); const token = generation;
  const step = () => {
    if (token !== generation || !match || match.winner !== null) return;
    if (match.actor !== 1) { busy = false; selection = { zone: 'field', index: 0 }; render(); return; }
    play(chooseAI(match)); render();
    if (match.winner !== null) { busy = false; render(); } else setTimeout(step, 420);
  };
  setTimeout(step, 850);
}
app.addEventListener('click', event => {
  const control = event.target.closest('[data-command]'); if (!control || control.disabled) return;
  unlockAudio();
  const [command, value, index] = control.dataset.command.split(':');
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
  if (command === 'quit') { generation++; busy = false; match = null; dialog = ''; render(); window.scrollTo(0, 0); return; }
  if (command === 'begin-tutorial') { tutorialSeen = true; try { localStorage.setItem('dragon-tutorial-seen', '1'); } catch { /* Optional storage. */ } dialog = ''; start(); return; }
  if ((command === 'start' || command === 'replay') && team.length !== 3) return;
  if (command === 'start' && !tutorialSeen) { dialog = 'tutorial'; render(); return; }
  if (command === 'start' || command === 'replay') { start(); return; }
  if (command === 'compare') { mode = match.mode === 'charge' ? 'energy' : 'charge'; saveMode(); start(true); return; }
  if (!match || busy || match.actor !== 0 || match.winner !== null || dialog) return;
  if (command === 'select') { selection = { zone: value, index: Number(index) }; render(); return; }
  if (command === 'fuse') { dialog = 'fusion'; confirmFusion(); return; }
  const action = command === 'attack' ? { type: 'attack', attack: value } : { type: command, index: selection.index };
  if (play(action)) { if (command === 'switch' || command === 'deploy') selection = { zone: 'field', index: 0 }; render(); if (match.actor === 1 && match.winner === null) aiTurn(); }
});
function confirmFusion() {
  dialog = ''; const index = selection.index, b = match.players[0].field[index];
  if (!b || index === 0 || !can('fuse', index)) return;
  if (window.confirm(`Fuse with ${b.name}? This card is consumed.\nВыбранная карта исчезнет. Передний дракон: +35 HP, +12 урона.`)) { play({ type: 'fuse', index }); selection = { zone: 'field', index: 0 }; render(); }
}
function saveMode() { try { localStorage.setItem('dragon-prototype-mode', mode); } catch { /* Optional preference. */ } }
app.addEventListener('change', event => {
  if (event.target.dataset.feel) { setFeel(event.target.dataset.feel, event.target.checked); return; }
  if (event.target.id === 'art-family' && artFamilies.includes(event.target.value)) { artFamily = event.target.value; render(); app.querySelector('#art-family')?.focus(); }
  if (event.target.id === 'mode') { mode = event.target.value; saveMode(); }
  if (event.target.dataset.rune) { const c = profile.cards[event.target.dataset.rune]; if (c?.owned && RUNES[event.target.value]) { c.rune = event.target.value; persist(); restoreTeam(); render(); } }
});
app.addEventListener('load', event => { if (event.target.classList?.contains('evolution-art')) event.target.classList.add('ready'); }, true);
app.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog) { dialog = ''; render(); } });
render();
