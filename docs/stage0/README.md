# Grok RPG Game — Stage 0

Дата аудита: 2 октября 2026. Это отдельная существующая игра Grok, а не основная DragonVerse.

**Frozen baseline:** `2931ea69bfbf653c105f145520d41747c85f4f07`.
**Baseline tree:** `3f7bbb1911dd22b696073be445783222fbe838f6`.
**Ветка аудита:** `stage0/baseline-integrity-audit`, создана непосредственно от frozen SHA.
Точный SHA опубликованной ветки и CI run находятся в описании Stage 0 PR. SHA baseline является точкой сравнения; main и tag `baseline-2026-10-02` не переписывались.

## Результат

Технический путь `npm ci → typecheck → tests → production build → static bundle verification` восстановлен. Две минимальные правки устраняют три исходные ошибки TypeScript. Проверка типов сохранена. Новых зависимостей, игровых чисел, механик, ассетов и изменений внешнего вида нет.

Игра является работающим начальным auto-battler, но **не целостной системой прогрессии и экономики**. GREEN CI означает исправленную сборку и защиту проверенных сценариев. Он не означает, что перечисленные ниже ошибки игрового baseline исправлены.

Главные установленные факты:

1. Башня реально ломается: этажи 41–44 генерируют пустой список врагов; этаж 45 бросает `TypeError`. Заявленный бесконечный/высокий диапазон этажей не поддержан пулом спрайтов.
2. Duplicate rank 1–10 работает и требует **30 копий** после первого unlock. Он увеличивает HP/ATK/DEF только ведущего дракона. Profile XP level до 999 — другая, общая для всех лидеров система.
3. Каждая победа в башне выдаёт одну копию лидера; каждая третья — ещё одно получение другой species. Перезапуск с этажа 1 позволяет повторять эти выплаты без выносливости.
4. Повышение редкости питомца расходует ресурсы и меняет подпись/цену, но не его боевые характеристики.
5. Магазин может продавать мифический призыв высокого уровня, но unlock фактически создаёт rare-питомца уровня 1; duplicate превращается только в одну копию. Магазинная редкость и capture-level теряются.
6. Боевые умения автоматически применяются при готовности. Атакующие умения обходят щит, а `Thunder Feast` лечит на 125% нанесённого урона при заявленных 50%.
7. Сохранённое усиление слотов можно переносить на новые предметы и затем монетизировать. При fixture +99 проверенный цикл покупки/экипировки/продажи/refresh даёт +1136 gold за цикл без траты stone/soul.
8. Дубликаты после rank 10 продолжают накапливаться и не имеют sink. Boons сохраняются после смерти и restart; это permanent progression, а не run-only roguelike слой.

## Что изменено в Stage 0

| Область | Изменение | Почему это остаётся Stage 0 |
| --- | --- | --- |
| `src/locales/index.ts` | Добавлены отсутствующие ключи `summon` и `more` в исходный китайский schema-каталог | Исправлена типовая согласованность каталогов; RU/EN и переключатель сохранены |
| `src/store/index.ts` | `useStorage<AppLocale>` вместо слишком широкого `string`; использован существующий union RU/EN | Исправлен locale assignment; та же runtime-нормализация |
| CI | Канонический `npm ci`, Node 22, typecheck, tests, build, bundle check; проверка PR; отдельное условие публикации main | PR проверяется без публикации новой игровой версии |
| Regression suite | Node test runner + существующий Vite; реальные store/engine и VueUse storage adapter | Нет нового framework, зависимостей или production test hooks |
| Документы | README/build instructions, корректное описание copies/training и фактических элементов; аудит и notices | Исправлены факты и происхождение; roadmap не переписан под новую игру |
| Assets/runtime | Ни один PNG, SVG, шрифт, CSS, Vue view, game data или engine не изменён | Baseline сохранён |

Исходный `tsconfig` уже содержал `strict: false`, `skipLibCheck: true` и exclusions legacy. Stage 0 не добавляет ослаблений и не расширяет exclusions. Они зафиксированы как существующие ограничения проверок.

## Проверки и доказательства

| Проверка | Итог / границы |
| --- | --- |
| Чистая установка | `npm ci` использует frozen `package-lock.json`; dependency versions не изменены |
| Исходная сборка | Воспроизведены две TS2353 в каталоге и TS2322 locale; baseline Actions run `36974648313` упал на той же причине |
| Стандартная сборка | `npm run build`, включая `vue-tsc`, проходит после минимальных правок |
| Dev startup | `npm run dev` запускает Vite; HTTP 200 для HTML и `src/main.ts`; реальный браузер монтирует игру |
| Tests | Все тесты выполняются, без skip/todo; [карта покрытия](TESTS.md) различает regression и characterization известных ошибок |
| Static bundle | Проверяются app mount, module script, локальные ссылки, Home/Battle chunks и notices; bundle доступен статическому серверу |
| Browser smoke | Dev и production, 393×852 и 1366×768: выбор шести драконов, RU/EN, save, battle, pause, summon, Flight, Home, reload, continue; без page errors/HTTP errors/горизонтального overflow |
| iPhone | Проверен мобильный viewport в Chromium, **не физический Safari iPhone** |
| Lint | В baseline нет lint command; `eslint.config.ts` не поддерживается установленным ESLint 8, обычный запуск даёт config error. Массовое форматирование/обновление lint-инфраструктуры не включено в Stage 0 |

Детали браузерной проверки: [ui-smoke.json](ui-smoke.json). Карта production-графа: [runtime-map.json](runtime-map.json). Локальные результаты и ограничения: [VALIDATION.md](VALIDATION.md). CI GREEN на точном опубликованном SHA подтверждается ссылкой в PR, а не предположением по локальным тестам.

## Полный аудит

| Вопрос владельца | Документ |
| --- | --- |
| Что действительно работает, что частично или сломано; active/legacy карта | [SYSTEMS.md](SYSTEMS.md) |
| Что означает каждый уровень, rank, rarity, training, enhancement и boon | [PROGRESSION.md](PROGRESSION.md) |
| Gold/soul/stone/stamina/copies/gear/boons; реальные источники и sinks; 10/30/60 минут и первые 20 этажей | [ECONOMY.md](ECONOMY.md) |
| Решения игрока, автоматизация, formulas, skills, bosses, HP/shield, Flight, elements | [BATTLE.md](BATTLE.md) |
| Подтверждённые ошибки, последствия и границы их воспроизведения | [FINDINGS.md](FINDINGS.md) |
| Происхождение кода/ассетов, коммерческая совместимость, notices и неустановленные права | [LICENSES.md](LICENSES.md) |
| Что владелец увидит после будущих этапов | [STAGES.md](STAGES.md) |

## Что Stage 0 не исправляет

Все balance и gameplay findings сохранены как baseline facts. Нет изменений стоимости summon, выдачи copies, сложности врагов, XP, rare upgrades, permanency boons, shielding или heal formulas. Не удалён legacy. Не добавлены elemental matchups. Stage 1 не запущен.

До следующего этапа нужно отдельно выбрать из [STAGES.md](STAGES.md) минимальный пакет исправления игровых противоречий. Без исправления floor 45 и платных upgrades полноценный progression playtest будет давать ошибочные выводы о балансе.
