// Presentation only: this module never calls act() or writes to a match.
import { RUNES } from './match.js?v=2349f3449164';

const artBase = new URL('./assets/battle/', import.meta.url);
const version = new URL(import.meta.url).search;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const palette = { vorathion: '#ef754b', aurion: '#edc975', sylvara: '#85d6b1', cinder: '#ffad65', nyx: '#a493e0', glacier: '#9bcddd', volt: '#c8dc78', umbra: '#af96ce', obsidian: '#9eb6bf', solaris: '#f5c07c' };
const tint = d => palette[d.id] || '#b8cbe0';
const health = d => d.hp / d.maxHp <= .25 ? 'low' : d.hp / d.maxHp <= .5 ? 'warning' : 'healthy';
let spriteFiles = new Set(), manifest;

// A right-facing, two-legged wyvern. The wings are its forelimbs.
// Stage/fusion shapes are visual variants, never new combat properties.
function silhouette(d) {
  const key = `wyvern-${d.uid || d.id}-${d.stage || 1}-${d.fused ? 'fused' : 'base'}`;
  const adult = d.stage >= 3, young = (d.stage || 1) === 1;
  const wing = young ? 'M115 129 96 61 148 87 156 27 181 73 220 46 205 116 169 151Z' : 'M106 132 63 19 129 64 144 5 183 66 245 22 217 112 174 153Z';
  return `<svg class="dragon-silhouette" viewBox="0 0 320 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${key}" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#536372"/><stop offset=".45" stop-color="#202d3a"/><stop offset="1" stop-color="#0b121c"/></linearGradient></defs><g fill="url(#${key})" stroke="${tint(d)}" stroke-width="2" stroke-linejoin="round"><path d="M143 158C98 162 79 185 45 175S14 138 4 160C6 196 54 210 108 188L166 173Z"/><path d="${wing}"/><path d="M139 129 109 58 147 98 156 38 177 111 214 62 179 153" fill="none" opacity=".5"/><path d="M97 154C112 126 151 119 177 133L210 126 226 86 242 70 259 84 277 87 308 103 295 118 268 119 254 147 231 170 168 180 117 175Z"/><path d="M226 87 216 61 236 76 238 49 251 73 267 60 260 85"/><path d="M141 168 143 193 129 204 119 213 159 210 170 183 176 171M205 161 217 187 212 203 229 210 251 207 235 196 237 176 229 150"/><path d="M159 136 151 116 174 129 178 108 197 127 207 110 218 126"/>${adult || d.fused ? '<path d="M120 157 95 123 128 139M167 168 171 139 183 168M240 84 243 39 252 76"/>' : ''}${d.fused ? `<path d="M144 145 129 92 166 130 178 77 195 130 223 90 211 145" fill="${tint(d)}" opacity=".42"/>` : ''}</g><path d="M246 98 261 96 253 102Z" fill="${tint(d)}"/><path d="M279 112 294 111M184 151 196 143 211 151M166 158 175 151" fill="none" stroke="${tint(d)}" stroke-width="2" opacity=".7"/></svg>`;
}

export function spriteMarkup(d) {
  return `<span class="dragon-visual ${d.fused ? 'fused-form' : ''}" data-sprite="${escape(d.id)}" data-stage="${d.stage || 1}" data-fused="${!!d.fused}" style="--dragon-glow:${tint(d)}">${silhouette(d)}</span>`;
}

function pngFor(d) {
  const candidates = [d.fused ? `${d.id}-fused.png` : '', d.stage > 1 ? `${d.id}-stage${d.stage}.png` : '', `${d.id}.png`];
  return candidates.find(file => file && spriteFiles.has(file));
}

// The export automatically discovers PNGs. An empty manifest means no failed
// image requests: silhouettes render immediately, including on a slow phone.
export function hydrateSprites(root) {
  if (!root) return;
  manifest ||= fetch(new URL(`sprites/manifest.json${version}`, artBase), { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(files => { spriteFiles = new Set(Array.isArray(files) ? files : []); }).catch(() => {});
  void manifest.then(() => {
    if (!root.isConnected) return;
    for (const node of root.querySelectorAll('[data-sprite]')) {
      const file = pngFor({ id: node.dataset.sprite, stage: Number(node.dataset.stage), fused: node.dataset.fused === 'true' });
      if (!file || node.querySelector('img')) continue;
      const img = new Image(); img.alt = ''; img.decoding = 'async'; img.className = 'dragon-png';
      img.onload = () => { if (node.isConnected) node.classList.add('has-png'); };
      img.onerror = () => { img.remove(); node.classList.remove('has-png'); };
      img.src = new URL(`sprites/${file}${version}`, artBase).href; node.append(img);
    }
  });
}

function figure(d, side) {
  if (!d) return '<div class="empty-fighter" aria-label="No active dragon"></div>';
  const content = `<span class="figure-hud" style="--dragon-glow:${tint(d)}"><span class="figure-name">${escape(d.name)}</span><span class="figure-health"><b data-hp-number>${d.hp}</b><small> / ${d.maxHp} HP</small></span><span class="figure-hp-track" role="progressbar" aria-label="${escape(d.name)} health" aria-valuemin="0" aria-valuemax="${d.maxHp}" aria-valuenow="${d.hp}" data-health="${health(d)}"><i style="transform:scaleX(${d.hp / d.maxHp})"></i></span><small class="figure-meta">Lv${d.level} · ${RUNES[d.rune].name}${d.fused ? ' · Fused' : ''}</small></span><span class="dragon-ground" aria-hidden="true"></span><span class="dragon-motion"><span class="dragon-idle"><span class="dragon-facing">${spriteMarkup(d)}</span></span></span>`;
  const attributes = `class="dragon-figure ${side === 0 ? 'player' : 'enemy'}" data-uid="${escape(d.uid)}" data-dragon-id="${escape(d.id)}" aria-label="${escape(d.name)}, ${d.hp} of ${d.maxHp} HP"`;
  return side === 0 ? `<button ${attributes} data-command="select:field:0" type="button">${content}</button>` : `<div ${attributes}>${content}</div>`;
}

function enemyReserves(state) {
  return state.players[1].field.slice(1).map((d, i) => `<div class="enemy-reserve" style="--reserve:${i}" data-uid="${escape(d.uid)}" aria-label="Enemy reserve ${escape(d.name)}, ${d.hp} HP"><span class="dragon-idle"><span class="dragon-facing">${spriteMarkup(d)}</span></span><small>${escape(d.name)}</small></div>`).join('');
}

export function battlefieldMarkup(state, motion = true) {
  return `<section class="battlefield ${motion ? '' : 'motion-off'}" aria-label="Dragon battlefield"><img class="arena-backdrop" src="${new URL(`arena.webp${version}`, artBase).href}" alt="" decoding="async" fetchpriority="high"><div class="arena-atmosphere" aria-hidden="true"></div><div class="arena-floor" aria-hidden="true"></div><div class="enemy-reserves">${enemyReserves(state)}</div><div class="fighters"><div class="fighter" data-side="0">${figure(state.players[0].field[0], 0)}</div><div class="fighter" data-side="1">${figure(state.players[1].field[0], 1)}</div></div><div class="scene-fx" aria-hidden="true"></div></section>`;
}

export function reserveRow(state, selection, locked, intent, can) {
  return `<section class="scene-reserves"><div class="reserve-heading"><span>YOUR RESERVES</span><small>${intent === 'fuse' ? 'Choose one to fuse' : 'Tap to switch · cost 1'}</small></div><div class="bench your-bench">${state.players[0].field.slice(1).map((d, i) => {
    const index = i + 1, selected = selection.zone === 'field' && selection.index === index;
    return `<div class="reserve-tile"><button class="reserve-icon ${selected ? 'selected' : ''}" data-command="reserve:${index}" aria-pressed="${selected}" aria-label="${intent === 'fuse' ? 'Fuse with' : 'Switch to'} ${escape(d.name)}, ${d.hp} of ${d.maxHp} HP" ${locked ? 'disabled' : ''}><span class="reserve-portrait">${spriteMarkup(d)}</span><span><b>${escape(d.name)}</b><small>${d.hp} / ${d.maxHp} HP</small></span></button>${state.mode === 'energy' ? `<button class="reserve-attach" data-command="reserve-energy:${index}" ${!can('attach', index) ? 'disabled' : ''}>Energy ${d.energy}/4 · Attach +1</button>` : ''}</div>`;
  }).join('') || '<p class="empty-reserves">No reserves left</p>'}</div></section>`;
}

function updateHealth(node, d) {
  if (!node || !d) return;
  node.querySelector('[data-hp-number]').textContent = d.hp;
  const track = node.querySelector('.figure-hp-track'); track.dataset.health = health(d); track.setAttribute('aria-valuenow', d.hp); track.querySelector('i').style.transform = `scaleX(${d.hp / d.maxHp})`;
  node.setAttribute('aria-label', `${d.name}, ${d.hp} of ${d.maxHp} HP`);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const animate = (node, frames, duration, extra = {}) => node?.animate(frames, { duration, easing: 'ease-out', fill: 'none', ...extra });

function flash(root, ultimate = false) {
  const layer = document.createElement('i'); layer.className = `scene-flash ${ultimate ? 'ultimate-flash' : ''}`; root.querySelector('.scene-fx').append(layer);
  animate(layer, [{ opacity: 0 }, { opacity: ultimate ? .8 : .6, offset: .2 }, { opacity: 0 }], 360); setTimeout(() => layer.remove(), 380);
}

function hit(root, target, damage, ultimate) {
  const motion = target?.querySelector('.dragon-motion');
  animate(motion, [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)', offset: .18 }, { transform: 'translateX(9px)', offset: .36 }, { transform: 'translateX(-6px)', offset: .55 }, { transform: 'translateX(4px)', offset: .72 }, { transform: 'translateX(0)' }], 300);
  const facing = target?.querySelector('.dragon-facing');
  if (facing) {
    const white = document.createElement('span'); white.className = 'hit-white'; white.innerHTML = facing.innerHTML; facing.append(white);
    animate(white, [{ opacity: .95 }, { opacity: 0 }], 230); setTimeout(() => white.remove(), 250);
  }
  const label = document.createElement('b'); label.className = `floating-damage ${ultimate ? 'ultimate-damage' : ''}`; label.textContent = `−${damage}`;
  const bounds = root.getBoundingClientRect(), box = target.getBoundingClientRect(); label.style.left = `${box.x + box.width / 2 - bounds.x}px`; label.style.top = `${box.y + box.height * .5 - bounds.y}px`; root.querySelector('.scene-fx').append(label);
  animate(label, [{ transform: 'translate(-50%, 0) scale(.8)', opacity: 1 }, { transform: 'translate(-50%, -14px) scale(1.12)', opacity: 1, offset: .18 }, { transform: 'translate(-50%, -65px) scale(1)', opacity: 0 }], 850, { fill: 'forwards' }); setTimeout(() => label.remove(), 870);
}

export async function animateBattlefield(root, event, motion, current) {
  if (!root || !motion || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const { before, after, side, action, damage } = event;
  const active = which => root.querySelector(`.fighter[data-side="${which}"] .dragon-figure`);
  const replace = which => { const slot = root.querySelector(`.fighter[data-side="${which}"]`); slot.innerHTML = figure(after.players[which].field[0], which); hydrateSprites(root); return active(which)?.querySelector('.dragon-motion'); };
  const player = active(side), direction = side === 0 ? 1 : -1;
  root.dataset.animation = action.attack || action.type;
  if (action.type === 'attack') {
    const target = active(1 - side), ultimate = action.attack === 'burst', duration = ultimate ? 920 : 700, impactAt = ultimate ? 360 : 270;
    player?.classList.add('attacking');
    const distance = (target.getBoundingClientRect().x - player.getBoundingClientRect().x) * (ultimate ? .65 : .58);
    animate(player.querySelector('.dragon-motion'), [{ transform: 'translateX(0) scale(1)' }, { transform: `translateX(${-direction * 12}px) scale(.96)`, offset: .12 }, { transform: `translateX(${distance}px) scale(${ultimate ? 1.22 : 1.05})`, offset: impactAt / duration }, { transform: `translateX(${distance}px) scale(${ultimate ? 1.15 : 1.02})`, offset: .5 }, { transform: 'translateX(0) scale(1)' }], duration);
    await wait(impactAt); if (!current()) return;
    hit(root, target, damage, ultimate);
    const oldTarget = before.players[1 - side].field[0], surviving = after.players[1 - side].field.find(d => d.uid === oldTarget.uid);
    updateHealth(target, surviving || { ...oldTarget, hp: 0 }); updateHealth(player, after.players[side].field[0]);
    if (ultimate) {
      flash(root, true);
      animate(root, [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,3px)', offset: .18 }, { transform: 'translate(4px,-3px)', offset: .38 }, { transform: 'translate(-3px,2px)', offset: .58 }, { transform: 'translate(2px,-1px)', offset: .78 }, { transform: 'translate(0,0)' }], 420);
    }
    await wait(duration - impactAt); if (!current()) return;
    player?.classList.remove('attacking');
    if (!surviving) {
      root.dataset.animation = 'death';
      animate(target, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(30px) scale(.88)' }], 430, { fill: 'forwards' });
      await wait(440); if (!current()) return;
      const newFront = replace(1 - side); root.querySelector('.enemy-reserves').innerHTML = enemyReserves(after); hydrateSprites(root);
      if (newFront) { animate(newFront, [{ opacity: 0, transform: `translateX(${(1 - side) === 0 ? -55 : 55}px)` }, { opacity: 1, transform: 'translateX(0)' }], 270); await wait(280); }
    } else await wait(170);
  } else if (action.type === 'switch') {
    animate(player.querySelector('.dragon-motion'), [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 100}px)` }], 230);
    await wait(240); if (!current()) return;
    const entering = replace(side); root.querySelector('.enemy-reserves').innerHTML = enemyReserves(after); hydrateSprites(root);
    animate(entering, [{ opacity: 0, transform: `translateX(${-direction * 85}px)` }, { opacity: 1, transform: 'translateX(0)' }], 310); await wait(320);
  } else if (action.type === 'fuse') {
    flash(root); animate(player.querySelector('.dragon-motion'), [{ transform: 'scale(1)' }, { transform: 'scale(.86)', offset: .6 }, { transform: 'scale(1.12)' }], 280);
    await wait(200); if (!current()) return;
    const evolved = replace(side); flash(root); root.querySelector('.enemy-reserves').innerHTML = enemyReserves(after); hydrateSprites(root);
    animate(evolved, [{ opacity: .35, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1.08)', offset: .75 }, { opacity: 1, transform: 'scale(1)' }], 430); await wait(440);
  } else if (action.type === 'attach') {
    flash(root); await wait(240);
  }
  if (current()) { root.removeAttribute('data-animation'); root.querySelector('.scene-fx').replaceChildren(); }
}
