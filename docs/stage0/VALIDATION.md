# Build / baseline integrity evidence

Frozen source: `2931ea69bfbf653c105f145520d41747c85f4f07`, tree `3f7bbb1911dd22b696073be445783222fbe838f6`. Repository восстановлен clone-ом, branch создана от этого commit; новый проект не создавался. Baseline commit/tag/main не переписываются. Branch head SHA и CI evidence публикуются в PR после завершения проверок: commit не может включать собственный SHA.

## Исходное failure

Baseline Actions: [run 36974648313](https://github.com/sergei-ai-lab/grok-rpg-game/actions/runs/36974648313), job 110735737445. Dependency install прошёл; build упал на typecheck. Локальный `npm run build` на exact baseline воспроизвёл:

```text
src/locales/index.ts(279,5): TS2353 — summon does not exist in inferred nav type
src/locales/index.ts(451,5): TS2353 — summon does not exist in inferred nav type
src/store/index.ts(150,3): TS2322 — string is not assignable to 'en-US' | 'ru' | 'zh-CN'
```

Stage 0 исправляет inferred schema через missing keys, locale — через существующий AppLocale. TypeScript не отключён; no new any; localization не удалена; exclusions и проверки не ослаблены.

## Канонические команды

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run verify:bundle
npm run dev
npm run preview
```

CI: Node 22, npm cache от package-lock, `npm ci --no-audit --no-fund`. Flags отключают только reporting, не install integrity/typechecks/tests. Local runtime Node 24.19.0/npm 11.9.0; target Node 22 проверяется в GitHub Actions. Frozen package-lock не изменён; новых dependencies нет. Исторические pnpm/bun locks не удалены; CI использует один resolver.

Production command осталась `vue-tsc && vite build`; typecheck script отдельно проверяет `vue-tsc --noEmit`. `base: './'`, hash router и static deployment сохранены.

## Локальный результат

| Check | Result | Evidence / границы |
| --- | --- | --- |
| Locked install | PASS | Чистый `npm ci` на baseline; final CI повторяет в fresh checkout |
| Typecheck | PASS | Все 3 исходные TS errors устранены двумя minimal fixes |
| Regression | PASS | 43 pass, 0 fail, 0 skip, 0 todo; [TESTS.md](TESTS.md) |
| Standard production | PASS | Original build script; emitted Home/Battle chunks, CSS/index/assets |
| Static references | PASS | 12 files / 10 local references; app mount/module, найденные HTML/CSS/JS references, route chunks, ATTRIBUTION и THIRD_PARTY_NOTICES |
| Dev | PASS | Vite startup, HTTP 200 HTML и `src/main.ts`, real Chromium mount |
| Static browser | PASS | `vite preview` serves dist; тот же user journey в двух viewports |
| UI / language / save | PASS | Четыре конфигурации: six cards, start, battle, pause, summon −40, Flight, Home, reload/continue, RU/EN |

Production Vite предупреждает о chunk >500kB. Main JS около 792.5kB/gzip 445kB: большой eager monster PNG pool инлайнится. Warning не заглушён, assets не перепакованы под новый performance/visual этап. Byte-reproducible artifact claim не выдвигается: checks подтверждают воспроизводимый install/build behavior и готовый static output, не bit-identical zip across Node/OS.

## Browser matrix

Real Chromium 153, Playwright вне repository dependencies. Dev 8081 и production preview 8082 на localhost. Каждый case — fresh browser/context, реальные UI actions, pageerror/HTTP error listeners, reload с существующим localStorage. Screenshot/image/video не создавались.

| Surface | Viewport | Page errors | HTTP errors | Horizontal overflow |
| --- | --- | ---: | ---: | --- |
| Dev mobile | 393×852 | 0 | 0 | нет |
| Dev desktop | 1366×768 | 0 | 0 | нет |
| Production mobile | 393×852 | 0 | 0 | нет |
| Production desktop | 1366×768 | 0 | 0 | нет |

[ui-smoke.json](ui-smoke.json) фиксирует результаты. Это mobile viewport Chromium, не физический iPhone Safari. Late floor 45 выявлен engine/simulation; browser journey не объявлен полной campaign verification.

## CI behavior

Workflow `.github/workflows/deploy.yml` срабатывает для PR в main, push main и manual dispatch. Checkout PR явно использует `github.event.pull_request.head.sha`, чтобы build/tests относились к exact audit head. Steps: install, typecheck, tests, production, bundle; artifact `static-production-bundle` с dist. Pages publish только для main non-PR после успешного build; skipped PR deploy job ожидаем. Main не изменён, прежний live build не подменён.

CI GREEN evidence = завершённый Actions run с conclusion `success`, успешными build job/steps, связанным head SHA и artifact. Локальный PASS не подменяет этот факт. Ссылка на финальный run и full head SHA добавляются в PR description после run.

## Lint applicability и существующие ограничения

В baseline нет lint script. Есть `eslint.config.ts` от antfu, но locked ESLint 8 не читает его обычным CLI: `npx --no-install eslint src/store/index.ts` даёт configuration error, а не game-source violations. Tooling migration/массовый format diff не включены в Stage 0; lint не объявлен успешным и не добавлен обязательным CI gate.

Baseline уже имел `strict: false`, `skipLibCheck: true` и legacy excludes в tsconfig. Они не изменены. Typecheck проверяет активный Vue/TS scope, не неиспользуемые views, ссылающиеся на старый store. Test subject транспилируется существующим Vite; assertions исполняет реальный Node.

## Diff control

Перед публикацией сравниваются baseline и branch: `src/game`, `src/components`, `src/views`, `src/styles`, `src/assets`, public SVG/PNG, locks, LICENSE и tsconfigs без изменений. Два разрешённых source changes — locale schema и store typing. Остальное — CI/scripts/tests/docs/notices. Нет новых gameplay values или deletions. [integrity-evidence.json](integrity-evidence.json) содержит unchanged scopes и asset hashes. Diff reviewable в PR; merge не выполняется в Stage 0.
