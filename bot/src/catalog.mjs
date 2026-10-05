import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { STAGES } from './identity.mjs';

const FAMILIES = { kaelith: 'fire', ashmaw: 'fire', pyrestone: 'fire', scorchlane: 'fire', verdraxis: 'nature', aurelune: 'gold' };
const LORE = {
  fire: ['Он появился в углях древнего костра.', 'Его пламя растёт вместе с доверием к тебе.'],
  nature: ['Он проснулся под корнями древнего леса.', 'Теперь его сила хранит вашу стаю.'],
  gold: ['Он вылупился в свете золотой луны.', 'Его сияние крепнет с каждым днём заботы.'],
  unknown: ['Он услышал твой зов сквозь скорлупу.', 'Ваша общая история только начинается.'],
};

export function legendLines(value, family) {
  const lines = Array.isArray(value) ? value : String(value || '').split(/(?<=[.!?])\s+|\n+/u);
  const clean = lines.map((line) => String(line).trim()).filter(Boolean).map((line) => line.slice(0, 180));
  const fallback = LORE[family] || LORE.unknown;
  return [clean[0] || fallback[0], clean[1] || fallback[1]];
}

// Local files only. Catalog metadata can never turn the renderer into an HTTP client.
export function localArtPath(root, path) {
  if (typeof path !== 'string' || !/^img\/[a-z0-9_-]+\.(webp|png|jpe?g)$/i.test(path)) return null;
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return null;
  const canonical = realpathSync(absolute);
  const within = relative(realpathSync(root), canonical);
  if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`)) return null;
  return canonical;
}

function distinctArt(root, paths) {
  const hashes = new Set();
  return paths.map((path) => {
    const local = localArtPath(root, path);
    if (!local) return null;
    const hash = createHash('sha256').update(readFileSync(local)).digest('hex');
    if (hashes.has(hash)) return null; // Legacy copied stages are not new evolution portraits.
    hashes.add(hash);
    return path;
  });
}

export function loadCatalog(root) {
  const file = resolve(root, 'catalog.json');
  if (existsSync(file)) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : parsed.dragons;
    if (!Array.isArray(rows)) throw new Error('catalog.json must contain dragons[]');
    const ids = new Set();
    const catalog = rows.filter((row) => {
      if (!/^[a-z0-9_-]+$/i.test(row.id || '') || ids.has(row.id)) return false;
      ids.add(row.id); return true;
    }).map((row) => {
      const paths = STAGES.map((stage, i) => {
        const art = row.stages?.[stage]?.art;
        if (art) return art.status === 'ready' ? art.path : null;
        const legacy = row.art?.[i];
        return typeof legacy === 'string' ? legacy : legacy?.status === 'ready' ? legacy.path : null;
      });
      return { id: row.id, name: String(row.name || row.id).slice(0, 45), family: row.family || 'unknown',
        legend: legendLines(row.legend, row.family), art: distinctArt(root, paths) };
    }).filter((row) => row.art[0]);
    if (!catalog.length) throw new Error('catalog.json has no usable hatchling art');
    return catalog.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }
  const imgDir = resolve(root, 'img');
  return readdirSync(imgDir).filter((name) => /^[a-z0-9_-]+-1\.webp$/i.test(name)).sort().map((name) => {
    const id = name.slice(0, -7);
    const family = FAMILIES[id] || 'unknown';
    return { id, name: id[0].toUpperCase() + id.slice(1), family, legend: legendLines(null, family),
      art: distinctArt(root, [1, 2, 3].map((stage) => `img/${id}-${stage}.webp`)) };
  });
}

export function createCatalogReader(root) {
  let stamp, cache;
  return () => {
    const file = resolve(root, 'catalog.json');
    const nextStamp = existsSync(file) ? `${statSync(file).mtimeMs}:${statSync(file).size}` : 'legacy';
    if (!cache || nextStamp !== stamp) { cache = loadCatalog(root); stamp = nextStamp; }
    return cache;
  };
}

export function resolveDragonArt(root, dragon, stage, catalog) {
  const current = catalog.find((row) => row.id === dragon.speciesId);
  for (let i = stage - 1; i >= 0; i--) {
    const path = current ? current.art[i] : dragon.art[i];
    const local = localArtPath(root, path);
    if (local) return { local, path, actualStage: i + 1, provisional: i + 1 !== stage };
  }
  throw new Error('This dragon has no local art');
}
