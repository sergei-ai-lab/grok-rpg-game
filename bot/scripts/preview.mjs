import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_FLOCK_DIR } from '../src/config.mjs';
import { loadCatalog } from '../src/catalog.mjs';
import { hatchDragon } from '../src/identity.mjs';
import { cardDescriptor, renderCard, renderEgg } from '../src/cards.mjs';

const catalog = loadCatalog(DEFAULT_FLOCK_DIR);
const dragon = hatchDragon('123456789', catalog);
const out = resolve('preview');
await mkdir(out, { recursive: true });
await writeFile(resolve(out, 'egg.jpg'), await renderEgg());
for (const [stage, feedings] of [[1, 0], [2, 3], [3, 7]]) {
  const player = { id: '123456789', dragon, stage, feedings, glow: 1 };
  await writeFile(resolve(out, `dragon-stage-${stage}.jpg`), await renderCard(player, cardDescriptor(DEFAULT_FLOCK_DIR, player, catalog)));
}
console.log(`Preview written to ${out}`);
