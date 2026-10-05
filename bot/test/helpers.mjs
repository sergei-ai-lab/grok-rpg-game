import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IncubatorStore } from '../src/store.mjs';
import { loadCatalog } from '../src/catalog.mjs';
import { DEFAULT_FLOCK_DIR } from '../src/config.mjs';

export const BASE = Date.UTC(2026, 9, 1, 12);
export const CATALOG = loadCatalog(DEFAULT_FLOCK_DIR);

export function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'dv-incubator-'));
  const store = new IncubatorStore(dir);
  t.after(() => { try { store.close(); } catch {} rmSync(dir, { recursive: true, force: true }); });
  return { dir, store, start: (id, payload = '', now = BASE, key = `start-${id}-${now}-${payload}`) =>
    store.start({ id, payload, firstName: 'Player', catalog: CATALOG, key, now }) };
}
