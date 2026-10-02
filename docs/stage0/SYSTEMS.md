# Runtime map и current-system inventory

Baseline: `2931ea69bfbf653c105f145520d41747c85f4f07`. Изменения Stage 0 не добавляют игровые маршруты или подсистемы.

## Метод доказательства

Путь загрузки: `index.html → src/main.ts → App.vue / router / locales / styles/main.css`. Router использует hash history и ровно два маршрута: `/` и `/battle`. Их dynamic imports входят в production bundle. Vite production graph, включая transformed auto imports, собран через `node scripts/audit-runtime.mjs`.

`ACTIVE` означает достижимый runtime module. `SHARED` — общие declarations/type contracts для активного кода и tooling, без самостоятельного runtime. `LEGACY / UNUSED` — не достижим от entrypoint, отсутствует в router и production chunks. Это не утверждение, что такие файлы можно безопасно удалить вместе с любыми зависимостями. `UNKNOWN` используется для происхождения отдельных assets/tooling, когда доказательств недостаточно; среди проверенных source modules таких нет.

### ACTIVE — 39 файлов

| Группа | Точные пути |
| --- | --- |
| Boot/router | `src/main.ts`, `src/App.vue`, `src/router/index.ts` |
| Views | `src/views/HomeView.vue`, `src/views/BattleView.vue` |
| Главные панели | `src/components/BagPanel.vue`, `ShopPanel.vue`, `PetPanel.vue`, `DungeonPanel.vue`, `QuestPanel.vue`, `HeroInfoPanel.vue` |
| Общие компоненты интерфейса | `src/components/ConfirmDialog.vue`, `GameSelect.vue`, `HpBar.vue`, `ItemTile.vue`, `LangSwitch.vue`, `ModalPanel.vue`, `Sprite.vue`, `ToastHost.vue`, `TopBar.vue`, `UnitCard.vue`, `ZoneTag.vue` |
| State | `src/store/index.ts` |
| Assets | `src/game/assets.ts` |
| Data | `src/game/data/boons.ts`, `catalog.ts`, `dragons.ts`, `dungeons.ts`, `heroes.ts`, `quests.ts` |
| Engines | `src/game/engine/battle.ts`, `items.ts`, `loot.ts`, `rng.ts`, `run.ts`, `stats.ts` |
| Locale | `src/locales/index.ts`, `src/locales/text.ts` |
| Styles | `src/styles/main.css` |

Строки с короткими именами относятся к явно указанной в строке директории. [runtime-map.json](runtime-map.json) содержит каждый полный путь, classification, importers и список модулей в каждом emitted chunk.

### SHARED — 3 файла

| Путь | Назначение |
| --- | --- |
| `src/game/types.ts` | Контракты Profile/Pet/BagItem/BattleUnit/hero/quests/dungeons/boons, используемые активными слоями |
| `src/env.d.ts` | Declarations для активного TypeScript tooling |
| `src/vite-env.d.ts` | Vite/SFC declarations |

`auto-imports.d.ts`, `vite.config.ts`, `uno.config.ts`, tsconfigs и `bin/art-code-font.js` находятся вне игровых source modules; это shared/build tooling. Баннер dev не является игровым UI.

### LEGACY / UNUSED — 22 файла

| Группа | Точные пути |
| --- | --- |
| Старый i18n | `src/i18n/cn.ts`, `src/i18n/en.ts`, `src/i18n/index.ts` |
| Старые styles/utilities | `src/styles/base.css`, `src/utils/index.ts` |
| Старые enums/types | `src/views/Enum/index.ts`, `src/views/Type/index.ts` |
| Старые Game views | `src/views/Game/GameMain.vue`, `src/views/Game/Home.vue` |
| Старые items | `src/views/Game/Item/EquipmentItem.vue`, `src/views/Game/Item/LogInfoItem.vue` |
| Старые panels | `src/views/Game/Panel/BagPanel.vue`, `EquipmentPanel.vue`, `FightLogPanel.vue`, `StatsPanel.vue` |
| Старый layout | `src/views/Layout/GameContent.vue`, `src/views/Layout/GameNav.vue` |
| Старые nav actions | `src/views/NavButton/ChangeGameStatus.vue`, `ChangeLanguage.vue`, `FullScreenToggle.vue`, `GitHubButton.vue` |
| Старое persistence utility | `src/views/Utils/indexDB.ts` |

Старые views обращаются к прежнему shape `useGlobalState`, которого текущий store не предоставляет. Это не параллельно работающая вторая версия. Неиспользуемый IndexedDB utility не является cloud save или активным persistence backend.

### Assets и неигровые остатки

В production reachable 500 monster PNG; они импортированы eagerly через glob и большинство инлайнится в JavaScript. Property PNG не reachable. Всего в `src/assets` сохранён 1311 файл; все побайтно совпадают с upstream Auto Monster snapshot `efb10dfe5eb4c771840c4ca59e4a0e889c02b5e3`. Никакой чистки не проведено.

`src/styles/pixel.ttf` принадлежит legacy stylesheet и не emitted в dist. `public/icons/game.svg` используется Home/TopBar/favicon, `public/icons/game.png` копируется как public asset. SVG path точно совпал с `delapouite/shark-bite.svg` в Game-icons.net; добавлен CC BY 3.0 credit, assets сохранены. Старые lockfiles и `.trae-html-share-packages/index.html.zip` — исторические export/tooling artifacts, не активный gameplay. Неустановленная license provenance шрифта и границы подтверждения tiles отражены в LICENSES.md.

## Inventory состояния систем

Значения: WORKING — проверенный основной сценарий; PARTIAL — реализована основа, есть существенные ограничения; BROKEN — установлен дефект заявленного поведения; DUPLICATED — перекрывающиеся слои/данные; UNCLEAR — продуктовая семантика не определена; LEGACY — не используется. Метки могут сочетаться; наличие файла не считается доказательством WORKING.

| Система | Статус | Что реально происходит | Доказательство / ограничение |
| --- | --- | --- | --- |
| Home / выбор старта | WORKING / PARTIAL | Шесть лидеров; до save можно выбрать любой; после save нужны bonds rank ≥1 | Home.start + createSave; browser smoke. Нет пошагового обучения тому, что надо deploy/raise |
| Initial resources | WORKING | Level 1, 200 gold, 0 soul, 5 stone, 1000 stamina; один rare pet той же species, не deployed | defaultProfile |
| Save / continue | WORKING / PARTIAL | Один localStorage JSON slot; floor/mode/wave/resources сохраняются | JSON roundtrip и supported-old fixture; units/HP/cooldowns/battle status не сохраняются |
| Migration | PARTIAL | Новые bonds/slots/config/cap/run fields; bag stones переводятся в currency | save tests; отсутствует versioned schema и defaults для всех старых shapes |
| Delete save | WORKING / BROKEN UX | Реально удаляет slot, но confirm автоматически соглашается через 5 секунд | confirm + Home.resetSave; нет обязательного явного подтверждения удаления |
| Six dragons | WORKING | Vorathion Fire, Kaelith Frost, Verdraxis Storm, Nyxarion Void, Aurion Light, Umbraxis Shadow | dragons.ts/heroes.ts; игровые IDs совпадают |
| Basic summon | WORKING | 40 gold; новый species unlock или +1 spare copy; 70% предпочтение locked pool | progression tests; rarity rolls здесь отсутствуют |
| Duplicate rank | WORKING / PARTIAL | Rank 1–10, отдельный raise; surplus хранится | 30 copies total; после max нет использования surplus |
| Lead selection | WORKING / PARTIAL | Любой unlocked species; общий level/equipment/boons переходят к нему | setLead + Home.start; это не шесть отдельных XP-героев |
| Flight | WORKING / DUPLICATED | До 5 deployed Pet instances плюс lead; одинаковая species может присутствовать несколько раз | deploy cap tests; lead species может одновременно быть pet |
| Tower | WORKING ранний / BROKEN поздний | 1–3 mobs, каждый пятый этаж boss; restart с 1 | genTowerWave; после max sprite tier возникнут пустые waves и crash 45 |
| Realms | PARTIAL | 30 definitions, gates level 2–980, 3–12 waves, фиксированные награды | forest clear/sweep tests; большинство высокоуровневых bosses отсутствует как точный sprite и использует fallback |
| Sweep | WORKING / PARTIAL | После первого clear, двойная stamina, те же fixed rewards мгновенно | rewards tests; store не перепроверяет needLevel; UI блокирует sweep во время dungeon |
| Automatic attacks | WORKING | Каждый живой actor бьёт random enemy по speed order | battle tests; kill lead завершает run даже с живыми pets |
| Active skills | WORKING / BROKEN details | Кнопка и auto-cast при готовности; четыре общих типа burst/AoE/heal/lifesteal | cooldown/kill/heal tests; shield bypass и неправильный lifesteal coefficient |
| Passive skills | WORKING / PARTIAL | Crit/lifesteal/doubleHit/regen; нет element resistances | heroes/stats/battle; описания отдельных skills вводят в заблуждение |
| Bosses / enemy scaling | PARTIAL / BROKEN late | Более сильные формулы и shield/corrosion/heal reduction | early/late boss discontinuity; pool limit сломал позднюю tower progression |
| HP / shield | WORKING / INCONSISTENT | Basic attacks расходуют shield, active damage — HP напрямую; новые waves полное HP | battle tests; resume и смена маршрута также дают rebuild units |
| Loot | WORKING / PARTIAL | Ordinary roll: 24% equip, 22% stone, остальное none; boss гарантирует equip | branch tests; один roll за tower victory, не за каждого врага |
| Gear equip/sell/salvage | WORKING / EXPLOITABLE | 3 slots; заменяемая экипировка; продажа/разбор дают gold/stone/soul | inventory tests; inherited enhancement можно монетизировать снова |
| Gear rarity | WORKING | Multipliers 1 / 1.7 / 2.6 / 4 / 6.5 | equipStats; max template unlock около floor 42 |
| Gear item level | WORKING | Instance level усиливает gear на 16% за level; отдельного действия повышения item level нет | genEquip + equipStats |
| Enhancement | WORKING / UNCLEAR ownership | Permanent slot rank 0–99 переносится на item; costs и шанс failure работают | inventory tests; duplicated old item enhance сохраняется в bag |
| Gear upgrade | WORKING | +5 prerequisite, gold/soul, rarity next, потеря пяти slot-enhance ranks | upgrade test; item level не меняется |
| Profile/dragon XP level | WORKING / UNCLEAR name | Общий level 1–999, усиливает текущего лидера и открывает realms | XP tests; UI также называет duplicate rank уровнем |
| Pet XP level | WORKING / PARTIAL | Только deployed pets получают 60% tower XP; уровень без cap | tower XP test; realms/quests не дают pet XP |
| Training | WORKING / DUPLICATED | 0–10, gold cost, +6% от base-layer за training rank | training test; не заменяет bond rank |
| Pet rarity | BROKEN upgrade / WORKING initial roll | Rarity при genPet встроена в base; subsequent rarity upgrade меняет только поле | known-behavior test |
| Pet copies field | LEGACY / UNUSED data | Поле создаётся со значением 0 | Все copy actions используют Profile.bonds; Pet.copies не участвует |
| Boons | WORKING / UNCLEAR run scope | 3 выбора, auto-pick 5s, duplicate boon stacks; permanent, gate lastBoonFloor | rewards tests; нет повторной boon выплаты на ранее пройденном boss floor |
| Shop | PARTIAL / BROKEN pet offers | 12 slots: 4 gear, 3 stone, 5 pet offers | stock data; rare pet semantics и questBuy event нарушены |
| Shop refresh / rare hunt | WORKING / BROKEN search | 1000 gold; hunt до 200 refresh проверяет только первый pet slot | ignores other four pet offers; initial sold has 6 flags for 12 slots, JS undefined пока работает |
| Stamina | WORKING / WEAK economy gate | Cap 1000, +1/30s, 50 gold за 100; только dungeon uses | stamina tests; tower бесплатна, покупки позволяют финансировать sweeps |
| Daily quests | WORKING / EXPLOITABLE / PARTIAL | 4 daily, UTC date; 100 gold полностью сбрасывает progress/claimed | refresh can repeat rewards; date rollover happens only when track runs |
| Achievements | WORKING / INCONSISTENT events | 18 definitions; profile-level targets, floor/gear/salvage etc | petGain mixes max count and summon increments; pet shop purchase doesn't track shopBuy |
| Currencies | WORKING / UNBALANCED | Gold, soul/crystals, stone, stamina; bonds copies; gear/boons | ECONOMY.md traces every source and sink |
| RU/EN | WORKING / PARTIAL | Two offered locales; localized interface/content/log patterns | browser/lang tests; generated foe labels and some aria/title/raw logs English |
| Persistence backend | WORKING local only | VueUse useStorage + explicit JSON serializer | No backend/account/cloud/sync; storage-denied fallback in index.html is memory only |
| Old Game/Layout/Nav/i18n | LEGACY | Не подключены к current routes/entrypoint | Actual production graph, 22 files |

## Документация против кода

`public/ATTRIBUTION.txt` ошибочно утверждал отсутствие duplicate progression; исправлено. README советовал обходить typecheck через Vite-only build; теперь стандартная command проходит и описана прямо. MISSING_ASSETS приписывал Kaelith Storm и Verdraxis venom, хотя source определяет Frost/Storm; исправлены только эти факты. Утверждение «все названные системы работают» заменено на «присутствуют в коде» с указанием установленных defects.

Ни asset roadmap, ни русско-английская версия игры, ни gameplay numbers не изменены. Исторический upstream README не используется как документация текущей игры: старые герои, зелья и event semantics оттуда не действуют автоматически.
