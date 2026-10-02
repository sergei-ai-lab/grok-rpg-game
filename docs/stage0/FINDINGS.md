# Подтверждённые ошибки и несогласованности

Baseline: `2931ea69bfbf653c105f145520d41747c85f4f07`. Только T01/T02 исправлены в runtime source Stage 0. Остальное установлено и оставлено без gameplay изменений. Priority — предложенный порядок обсуждения, а не разрешение начать Stage 1.

Evidence: **TEST** — воспроизведено real-source regression/characterization; **SIM** — seeded experiment; **CODE** — подтверждён прямой путь/формула без отдельного end-to-end сценария; **BROWSER** — dev/static production smoke. Для CODE последствия выведены из проверенных branches, а не выданы за измеренную пользовательскую сессию.

## Technical integrity — исправлено

| ID | Факт baseline | Stage 0 / evidence |
| --- | --- | --- |
| T01 | EN/RU nav имеют summon/more, исходный schema-каталог не имеет их; две TS2353 | Добавлены два schema keys; typecheck/build проходят, union не отключён |
| T02 | useStorage locale inferred string не подходит vue-i18n locale union; TS2322 | Использован существующий AppLocale union; RU/EN roundtrip TEST/BROWSER |
| T03 | Actions строит через падающий typecheck, нет regression step/PR checks | Canonical locked npm install + typecheck + tests + standard build + bundle check; PR проверяет точный head SHA |

## Game defects — не исправлено

| ID / priority | Факт / воспроизведение | Игровое последствие | Evidence |
| --- | --- | --- | --- |
| G01 / blocker | `genTowerWave(41..44)`→[], `genTowerWave(45)`→TypeError; pool minTier6, sprites maxTier5 | Пустые оплачиваемые floors и crash; achievements floors50..1000 недостижимы через обычную башню | TEST `AUDIT BLOCKER`, SIM115/360 crashes |
| G02 / high | Rare pet→epic списывает 800gold/25soul; stats до/после совпадают | Платный upgrade без promised combat growth | TEST `AUDIT BUG: pet rarity` |
| G03 / high | Shop red level20 offer unlock→rare pet level1; advertised object discarded | Игрок платит за level/rarity, которые не получает; duplicate offer даёт только 1copy | TEST `AUDIT BUG: shop rarity/level` |
| G04 / high | Equip копирует slot +N; sell/salvage уничтожает item, сохраняя slot | Повторное создание resale/salvage value; +99 fixture net+1136gold/cycle | TEST `AUDIT ECONOMY: retained +99`, CODE |
| G05 / high | Burst/AoE/activeLS напрямую меняют HP, игнорируя shield | Разные damage paths имеют несогласованное shielding; skill balance сильно искажён | TEST `AUDIT BUG: damaging active skills` |
| G06 / high | Thunder Feast healing=`damage×2.5×.5` | 125% calculated damage вместо описанных 50%; дополнительный bypass healing reduction | TEST той же fixture, CODE |
| G07 / high | Confirm resolve(true) через 5s; Home deleteSave ждёт confirm | Save может удалиться при бездействии на открытом delete dialog | CODE `confirm`, `HomeView`; explicit delete TEST отдельно |
| G08 / high | Old migration читает `pf.daily.refreshCount` и итерирует `pf.pets` до defaults всего shape | Supported older shape работает; shapes без daily/pets могут бросить ошибку. Нет полной schema migration guarantee | CODE; save TEST ограничен явно описанным supported fixture |
| G09 / medium | Dungeon egg addPet не вызывает grantCopy; при reload migration unlock-ит species по pets | Новый dragon присутствует в Flight, но lead locked до reload | TEST `AUDIT BUG: dungeon egg` |
| G10 / medium | Shop pet branch return до track('shopBuy') | Patron/Market Hand не получают progress за pet purchase | TEST shop rarity case |
| G11 / medium | Summon track petGain increment, addPet track petGain max length | Own3/5 achievements считают смесь current/max count и summon count, включая duplicates | CODE `summonDragon/addPet/track` |
| G12 / medium | Sell/recycle last species pet сохраняет bond unlock; duplicate grant не ensureSpeciesPet | Unlocked species без Flight instance; обычные duplicates не восстанавливают её pet | CODE `sellPet/recyclePet/grantCopy` |
| G13 / medium | Reward stone popup использует find(firstentry), выплаты loop(allentries) | Игрок видит неполную награду: Forest popup2stone, actual3 | TEST `AUDIT BUG: multiple stone entries` |
| G14 / medium | HeroInfo stats без bond multiplier, battle stats с multiplier | Rank10 может давать фактические HP/ATK/DEF2.26× показанных там stats | CODE; lead-bond TEST для actual units |
| G15 / medium | Rare-hunt refresh проверяет один pet slot из 5 | Может продолжать тратить 1000 gold за refresh, хотя нужная rarity уже в другом slot | CODE `refreshShopToGoldOrRed` |
| G16 / medium | Continue сохраняет floor/mode/wave, но не battle status/HP/cooldown/reward transaction | Full heal/retry, повторная награда при повторной победе на уже оплаченном floor; missed offer/reward screen не восстановлены | save TEST full HP, CODE |
| G17 / medium | BattleView mount при !started и runFloor≤1 вызывает startRun независимо от saved dungeon mode | Direct /battle reload сохранённого dungeon после towerfloor1 может вернуть tower1 | CODE; Home.continueRun использует отдельный корректный mode path |
| G18 / medium | 10× и 15× оба clamp60ms | 15× не быстрее 10×; максимум около 8.67× относительно 1× | CODE таймерная формула |
| G19 / medium | Passive/activeLS рассчитывается от totaldamage и не heal-reduced | Healing за shield/overkill; enemy wound не ослабляет значительную часть лечения | CODE, crit/LS and heal-reduction TESTs |
| G20 / low | Corrosion log says unblocked, damage проходит обычный shield | Текст не соответствует фактической защите | CODE attack |
| G21 / low | Aurion desc mendsflight, regen/heal onlylead; Crit+X uses totalbaseX | Описания не объясняют actual kit | CODE heroes/cast/stats |
| G22 / low | Daily date check только track; claim/questProgress не ensureDaily | Stale daily может отображаться/claim-иться до нового tracked action | CODE |
| G23 / low | Auto-salvage/overflow не всегда trackrecycle; enhance trackattempt даже failure | Achievement/daily progress неравномерный по action paths | CODE; enhancement fail TEST |
| G24 / low | Initial sold length6 для stock12 | Сейчас undefined трактуется false; shape inconsistent, при другой обработке flags возможна regression | CODE; не утверждается, что текущая покупка slots6–11 сломана |
| G25 / low | RU catalog неполный для runtime strings/foe names/aria/log patterns | Смешанный RU/EN текст при RU UI | CODE + BROWSER language persistence; полный linguistic review не выполнялся |

## Balance / product inconsistencies — требуют решения владельца

| ID | Факт | Последствие / unresolved intent |
| --- | --- | --- |
| P01 | Lead copy за каждую tower win, extra на каждом третьем floor, restart бесплатный | Copy cap 10 закрывается быстро; платный summon конкурирует с бесплатным farm |
| P02 | Rank 10 не прекращает incoming copies, conversion отсутствует | Копии теряют полезность, UI продолжает награждать ими |
| P03 | Boons сохраняются после death/restart, lastBoonFloor монотонно растёт | Это permanent milestones; роль run build не определена |
| P04 | Profile level 999 общий, bond 1–10 per species, pet level без cap, training 0–10 | Несколько накладывающихся уровней; «dragon level» неоднозначен |
| P05 | Bond усиливает lead, не Flight той же species | Два режима одного dragon имеют разную progression семантику |
| P06 | Stamina purchase 50/+100; минимальный realm sweep 120 gold/20 stamina | Payout финансирует stamina и даёт положительный net gold; scarcity неустойчива |
| P07 | Daily refresh 100 полностью сбрасывает claims; Hunt 120 gold | Повторяемые daily rewards вместо только календарного цикла |
| P08 | Полное HP units каждую wave, SPD только order, auto active | Реальные решения игрока в основном preparation, а не timing/attrition |
| P09 | Kit differences есть, elemental combat input отсутствует | Elements metadata; counter система пока не реализована |
| P10 | Последний realm XP 50M > всего пути profile 1→999, 15.005M | Late reward масштабы не согласованы с profile cap; unlock 980 остаётся отдельным barrier |
| P11 | Passive начальный save без actions быстро проигрывает | Onboarding не показывает необходимость deploy/equip/raise; предположение «auto игра сама progresses» не работает |

P findings подробно количественно разобраны в [ECONOMY.md](ECONOMY.md), semantic conflicts — [PROGRESSION.md](PROGRESSION.md), mechanics — [BATTLE.md](BATTLE.md). Они **не** превращены в edits.

## Остальные ограничения доказательства

Нет real user telemetry, live account backend, physical Safari smoke, exhaustive older-save corpus или испытания всех 30realms до level999. Static production/browser smoke подтверждает начальный игровой loop, не всю campaign. License audit не подтверждает права на unused Founderfont и не подменяет per-file canonical tile archive matching. CI не включает неисправный baseline lint setup и не делает строгий mode, которого baseline не имел.
