# grok-rpg-game

Source snapshot of the current playable DragonVerse build.
This repository is the editable game. It is not the compiled preview bundle.
It is an isolated Grok RPG game, not the main DragonVerse project.

Baseline tag: `baseline-2026-10-02`
Frozen baseline SHA: `2931ea69bfbf653c105f145520d41747c85f4f07`.
The tag matches the source that produced the playable build. Nothing in this snapshot was refactored for the export.

## Install

```bash
npm ci
```

Use Node.js 22 and `package-lock.json`, the lockfile used by the exported playable build and the Stage 0 checks. `pnpm-lock.yaml` and `bun.lockb` remain historical upstream snapshots; CI uses `npm ci` to avoid different dependency resolutions. No dependency versions were changed for Stage 0.

## Run locally

```bash
npm run dev
```

Open the URL Vite prints. `npm run dev` prints the upstream console banner before starting Vite; `npx vite` also starts the same game.

## Build

The historical playable export was produced with `npx vite build`. The standard verified production command is now:

```bash
npm run build
```

Output is `dist/`. Serve that folder with any static file server. Asset paths are relative (`base: './'` in `vite.config.ts`).

`npm run build` runs `vue-tsc && vite build`; Stage 0 corrects the baseline type errors without removing that check. Serve the static bundle with `npm run preview`.

## Regression checks and audit

```bash
npm run typecheck
npm test
npm run build
npm run verify:bundle
```

Tests use the real game source, existing Vite pipeline and Node's built-in test runner. No new dependency or test framework is installed. Explicitly named `AUDIT BUG`, `AUDIT BLOCKER` and `AUDIT ECONOMY` cases document existing defects; a green CI does not imply those defects were repaired.

The [Stage 0 audit](docs/stage0/README.md) covers active/legacy code, systems, progression, economy, battle, licenses and proposed future stages. `npm run audit:simulate` reproduces the seeded economy/battle experiment; `node scripts/audit-runtime.mjs` rebuilds the runtime map. Product balance and visuals are unchanged.

## Stack

- Vue 3, Vite 5, Vue Router (hash history), vue-i18n, VueUse `createGlobalState`
- UnoCSS and unplugin-auto-import
- No backend, no database, no accounts
- The phone preview only redirects to the built `index.html`. It is not part of this source tree.

## Where the code lives

| Area | Path |
| --- | --- |
| Screens | `src/views/HomeView.vue`, `src/views/BattleView.vue` |
| Panels | `src/components/` (bag, shop, flight, quests, realms, language switch) |
| Battle | `src/game/engine/battle.ts`, `src/game/engine/run.ts` |
| Progression, loot, stats | `src/game/engine/stats.ts`, `src/game/engine/loot.ts` |
| Save and actions | `src/store/index.ts` |
| Dragons, items, quests, realms, boons | `src/game/data/` |
| English and Russian UI catalog | `src/locales/index.ts` |
| Russian content and battle-log lines | `src/locales/text.ts` |
| Sprites | `src/assets/monster/` and `src/assets/property/` |

## Save data

Browser `localStorage` only. Clearing site data deletes the save.

| Key | Contents |
| --- | --- |
| `dragonverse-profile` | Profile, inventory, equipment, flight, quests, gold, floor |
| `dragonverse-lang` | `en-US` or `ru` |

There is one save slot. Dragon names are not translated.

## Secrets

This game has no API keys, tokens, or passwords. `.env.example` is empty on purpose.

## Known limitations

- Enemy names generated in battle stay in English.
- A combat-log line stays in English if it does not match a known pattern in `src/locales/text.ts`.
- Creature and item art are Dungeon Crawl tiles used as placeholders. Named-dragon portraits are not in this build. See `ATTRIBUTION.txt` and `MISSING_ASSETS.md`.
- No server, no cloud save, no accounts.
- Upstream Chinese strings remain in `src/locales/index.ts` as an unused catalog. The switch only offers Russian and English.

## License

Game code is adapted from [Auto Monster](https://github.com/SmallTeddy/auto-monster) by SmallTeddy, MIT. See `LICENSE` and `public/ATTRIBUTION.txt`.
Tiles are Dungeon Crawl 32x32, CC0.
Full notices for bundled runtime libraries, Material Design Icons and the inherited CC BY 3.0 Shark bite logo by Delapouite are in `public/THIRD_PARTY_NOTICES.txt`. The unused font's unresolved rights and tile provenance limits are documented in [the license audit](docs/stage0/LICENSES.md).
