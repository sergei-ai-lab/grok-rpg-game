import { createHash } from 'node:crypto';

export const DAY = 86_400_000;
export const RARITIES = [
  { id: 'common', chance: 60, label: 'Обычный', color: '#91a6b6' },
  { id: 'rare', chance: 25, label: 'Редкий', color: '#58baff' },
  { id: 'epic', chance: 12, label: 'Эпический', color: '#c186ff' },
  { id: 'legendary', chance: 3, label: 'Легендарный', color: '#ffcb68' },
];
export const STAGES = ['hatchling', 'adult', 'titan'];
export const STAGE_LABELS = ['Детёныш', 'Взрослый', 'Титан'];

export function telegramId(value) {
  const id = String(value);
  if (!/^[1-9]\d{0,15}$/.test(id) || BigInt(id) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Invalid Telegram user ID');
  }
  return id;
}

export function rarityForRoll(roll) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error('Roll must be in [0, 1)');
  let boundary = 0;
  for (const rarity of RARITIES) {
    boundary += rarity.chance / 100;
    if (roll < boundary) return rarity.id;
  }
  return 'legendary';
}

export function stageForFeedings(count) { return count >= 7 ? 3 : count >= 3 ? 2 : 1; }

export function hatchDragon(id, catalog) {
  id = telegramId(id);
  const candidates = catalog.filter((dragon) => dragon.art?.[0]).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (!candidates.length) throw new Error('No hatchling art available');
  const seed = createHash('sha256').update(`dragonverse:incubator:v1:${id}`).digest();
  const species = candidates[seed.readUInt32BE(4) % candidates.length];
  const prefix = ['Вор', 'Каэ', 'Ник', 'Эль', 'Тар', 'Аур', 'Зир', 'Мор'][seed[8] % 8];
  const suffix = ['атион', 'алис', 'арион', 'элис', 'арикс', 'авель', 'эон', 'аэль'][seed[9] % 8];
  // The serial is collision-free for Telegram IDs; the palette and name remain stable.
  const serial = BigInt(id).toString(36).toUpperCase();
  return {
    version: 1, dragonId: `dv-${id}`, speciesId: species.id, speciesName: species.name,
    name: `${prefix}${suffix}`, serial, family: species.family,
    rarity: rarityForRoll(seed.readUInt32BE(0) / 0x1_0000_0000),
    hue: Number((seed.readUInt32BE(12) / 0x1_0000_0000 * 360).toFixed(5)),
    legend: species.legend.slice(0, 2), art: species.art,
  };
}

export function attribution(payload, ownId) {
  if (payload === 'tiktok' || payload === 'insta') return { source: payload, referrerId: null };
  const match = /^ref_([1-9]\d{0,15})$/.exec(payload || '');
  if (match) {
    try {
      const id = telegramId(match[1]);
      if (id !== telegramId(ownId)) return { source: 'ref', referrerId: id };
    } catch { /* An invalid referral behaves like a direct visit. */ }
  }
  return { source: 'direct', referrerId: null };
}

export function referralUrl(username, id) {
  return `https://t.me/${username}?start=ref_${telegramId(id)}`;
}
