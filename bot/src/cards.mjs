import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RARITIES, STAGE_LABELS } from './identity.mjs';
import { resolveDragonArt } from './catalog.mjs';

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

function wrap(value, max = 54) {
  const words = String(value).split(/\s+/);
  const lines = [];
  for (const word of words) {
    if (!lines.length || (lines.at(-1).length + word.length + 1 > max)) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines.slice(0, 2).map((line) => line.slice(0, 72));
}

export function cardDescriptor(root, player, catalog) {
  const art = resolveDragonArt(root, player.dragon, player.stage, catalog);
  const image = readFileSync(art.local);
  const signature = createHash('sha256').update('card-v1:').update(JSON.stringify({
    dragon: player.dragon, feedings: player.feedings, stage: player.stage, glow: player.glow,
    path: art.path, actualStage: art.actualStage,
  })).update(image).digest('hex');
  return { ...art, image, signature };
}

export async function renderCard(player, descriptor, username = 'DragonVerseBot') {
  const { dragon, stage, feedings, glow = 0 } = player;
  const rarity = RARITIES.find((item) => item.id === dragon.rarity) || RARITIES[0];
  const picture = await sharp(descriptor.image, { limitInputPixels: 40_000_000 })
    .resize(788, 820, { fit: 'contain', background: '#090e18' })
    .modulate({ hue: Math.round(dragon.hue) % 360, saturation: 1 + Math.min(glow, 8) * 0.04 }).png().toBuffer();
  const lore = dragon.legend.flatMap((line) => wrap(line)).slice(0, 4);
  const progress = Array.from({ length: 7 }, (_, i) =>
    `<circle cx="${90 + i * 54}" cy="1240" r="11" fill="${i < feedings ? rarity.color : '#243143'}"/>`).join('');
  const overlay = Buffer.from(`<svg width="900" height="1340" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090e18" stop-opacity="0"/><stop offset="1" stop-color="#090e18"/></linearGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${rarity.color}"/><stop offset=".55" stop-color="#4f5167"/><stop offset="1" stop-color="${rarity.color}"/></linearGradient>
    </defs>
    <rect x="24" y="24" width="852" height="1292" rx="36" fill="none" stroke="url(#edge)" stroke-width="6"/>
    <rect x="37" y="37" width="826" height="1266" rx="27" fill="none" stroke="${rarity.color}" stroke-opacity=".3"/>
    <path d="M52 150H848 M52 1187H848" stroke="${rarity.color}" stroke-opacity=".4"/>
    <g font-family="DejaVu Sans, sans-serif">
      <text x="60" y="90" font-size="24" letter-spacing="6" fill="#c3cdd8">DRAGONVERSE</text>
      <text x="840" y="87" text-anchor="end" font-size="24" fill="${rarity.color}">${escapeXml(rarity.label)}</text>
      <text x="60" y="125" font-size="21" fill="#8296b0">${escapeXml(dragon.speciesName)} · ${escapeXml(dragon.family)}</text>
      <text x="840" y="125" text-anchor="end" font-size="21" fill="#d9e3f0">${STAGE_LABELS[stage - 1]} · ${stage}/3</text>
      <rect x="56" y="790" width="788" height="220" fill="url(#fade)"/>
      <text x="60" y="984" font-size="48" font-weight="bold" fill="#f7f0df">${escapeXml(dragon.name)}</text>
      <text x="60" y="1021" font-size="20" letter-spacing="2" fill="${rarity.color}">ЛИЧНЫЙ ДРАКОН · ${escapeXml(dragon.serial)}</text>
      ${lore.map((line, i) => `<text x="60" y="${1064 + i * 27}" font-size="22" fill="#c5cdd9">${escapeXml(line)}</text>`).join('')}
      <text x="60" y="1216" font-size="21" fill="#c5cdd9">Рост: ${feedings}/7${glow ? ` · Сияние: ${glow}` : ''}</text>
      ${progress}
      <text x="840" y="1248" text-anchor="end" font-size="18" fill="${rarity.color}">${escapeXml(`@${username}`)}</text>
      <text x="60" y="1286" font-size="17" fill="#8296b0">${descriptor.provisional ? 'Иллюстрация новой стадии готовится' : stage === 3 ? 'Титан вашей стаи' : '3 кормления → взрослый · 7 → титан'}</text>
    </g>
  </svg>`);
  return sharp({ create: { width: 900, height: 1340, channels: 3, background: '#090e18' } })
    .composite([{ input: picture, left: 56, top: 158 }, { input: overlay }])
    .jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

export async function renderEgg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100">
    <defs>
      <radialGradient id="halo"><stop stop-color="#c49345" stop-opacity=".55"/><stop offset="1" stop-color="#090e18" stop-opacity="0"/></radialGradient>
      <radialGradient id="shell" cx=".35" cy=".3"><stop stop-color="#596576"/><stop offset=".65" stop-color="#252d3b"/><stop offset="1" stop-color="#111826"/></radialGradient>
      <linearGradient id="ember"><stop stop-color="#ffe4aa"/><stop offset="1" stop-color="#ff8d39"/></linearGradient>
    </defs>
    <rect width="900" height="1100" fill="#090e18"/>
    <ellipse cx="450" cy="560" rx="385" ry="420" fill="url(#halo)"/>
    <ellipse cx="450" cy="784" rx="212" ry="30" fill="#000" opacity=".6"/>
    <path d="M450 200C328 200 233 476 233 610C233 850 667 850 667 610C667 476 572 200 450 200Z" fill="url(#shell)" stroke="#bd9259" stroke-width="3"/>
    <path d="M470 260L425 355L493 405L432 508L492 558L448 642L480 718 M433 508L341 488L322 540 M492 405L564 376" fill="none" stroke="url(#ember)" stroke-width="7" stroke-linejoin="round"/>
    <g font-family="DejaVu Sans, sans-serif" text-anchor="middle">
      <text x="450" y="104" fill="#c5a46a" font-size="24" letter-spacing="8">DRAGONVERSE</text>
      <text x="450" y="938" fill="#f7f0df" font-size="43" font-weight="bold">Твоё яйцо просыпается</text>
      <text x="450" y="991" fill="#a6b4c8" font-size="23">Внутри уже слышно биение сердца…</text>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
