# grok-rpg-game

Source snapshot of the current playable DragonVerse build.
This repository is the editable game. It is not the compiled preview bundle.

Baseline tag: `baseline-2026-10-02`
The tag matches the source that produced the playable build. Nothing in this snapshot was refactored for the export.

## Install

```bash
npm install
```

`package-lock.json` is the lockfile used by the current build. `pnpm-lock.yaml` is also in the tree from the upstream project.

## Run locally

```bash
npx vite
```

Open the URL Vite prints. The dev script in `package.json` (`npm run dev`) also runs `bin/art-code-font.js` before Vite. That script is from the upstream project and is not required to start the game. Use `npx vite` to match the running build.

## Build

The playable build was produced with:

```bash
npx vite build
```

Output is `dist/`. Serve that folder with any static file server. Asset paths are relative (`base: './'` in `vite.config.ts`).

`npm run build` runs `vue-tsc && vite build`. The typecheck step is stricter than the command that produced the current playable build. Use `npx vite build` to reproduce that build.

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
