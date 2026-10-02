# Progression — фактическая модель baseline

Источник: `src/store/index.ts`, `src/game/types.ts`, `src/game/engine/{stats,battle,items}.ts`, `src/game/data/{heroes,dragons,quests,boons}.ts`, активные panels. Формулы и persistence не изменены.

## Девять параллельных слоёв

| Слой | Данные / диапазон | Что реально меняет | Что видит игрок | Persistence |
| --- | --- | --- | --- | --- |
| Profile / Hero XP level | Один `Profile.level`, 1–999, `Profile.exp` | Base/growth текущего лидера, dungeon gates, shop generation level, XP achievements | TopBar level/XP, Home save level, HeroInfo | Permanent, общий для всех шести лидеров |
| Duplicate / Bond rank | `Profile.bonds[species].rank`, 0 locked, 1–10 unlocked; spare copies | Lead HP/ATK/DEF × `1 + .14 × (rank−1)`; unlock species; SPD не меняется | Home dragon cards, Flight, reward copy/raise buttons | Permanent отдельно по species |
| Pet level | `Pet.level`, начинается с 1, cap отсутствует; `Pet.exp` | Все четыре pet stats × `1 + .11 × (level−1)` | Flight cards/details | Permanent отдельно по instance |
| Training | `Pet.train`, 0–10 | Все четыре pet stats × `1 + .06 × train` | Flight training action | Permanent отдельно по instance |
| Pet rarity | common / rare / epic / legendary / red | При первоначальном создании умножает сохранённый `Pet.base`; **upgrade не пересчитывает base**; меняет sell/salvage prices | Flight rarity и upgrade button | Permanent; платный upgrade сейчас не даёт stats |
| Gear item level | `BagItem.itemLevel`, ≥1; tower floor / shop generation level | Gear stats × `1 + .16 × (itemLevel−1)` | ItemTile/Bag details | Permanent у предмета; отдельного level-up action нет |
| Gear rarity | Те же пять rarities | Gear stats и цены × 1 / 1.7 / 2.6 / 4 / 6.5 | Цвет, подпись, upgrade action | Permanent у предмета |
| Gear enhancement | `Profile.slotEnhance`, 0–99; скопированное `item.enhance` | Gear stats × `1 + .1 × enhance`; sell/salvage также растут | Bag enhance и +N | Permanent **у слота и одновременно в instance** |
| Boons | `Profile.boons[]`, `lastBoonFloor` | Hero percent stats, crit/LS/double/regen, Flight percent stats, tower gold/drop bonus | Выбор после нового boss milestone, HeroInfo | Permanent; restart/death не очищают |

`Pet.copies` создаётся равным 0, но не используется текущими copy/raise actions. Это дублирующее старое поле, а не второй работающий источник copies.

## Profile XP не является XP каждого отдельного дракона

`expNeed(L) = 50 + 30L`. `gainExp` переносит остаток через несколько уровней; на 999 обнуляет XP. Смена leader меняет species/base/growth/passive/active kit и используемый bond multiplier, но сохраняет общий XP level, equipment и boons. XP из tower, realms, sweep и quests приходит в один профиль. Max-level achievement tracker обновляется при получении XP.

Сумма XP для перехода с level 1 на level L:

`50 × (L−1) + 15 × (L−1) × L`.

Например: level 10 = 1800 XP; 30 = 14500; 50 = 39200; 100 = 153450. Для 999 требуется 15004930 XP. Высокие realm payouts имеют другой масштаб: последний realm выдаёт 50000000 XP за clear/sweep, то есть больше всего пути до cap за одну выплату после unlock.

Achievements `ach_level30`, `ach_level50`, `ach_level100` проверяют **Profile XP level**, не duplicate rank. Поэтому формального противоречия «rank max 10, achievement 100 невозможен» нет. Есть противоречие названий: UI называет rank тоже «level», и игроку трудно понять, какой из уровней имеется в виду.

## Bond ladder и результат копий

| Переход | Copies на переход | Copies суммарно после unlock | Lead HP/ATK/DEF multiplier после перехода |
| --- | ---: | ---: | ---: |
| 1→2 | 1 | 1 | 1.14 |
| 2→3 | 2 | 3 | 1.28 |
| 3→4 | 2 | 5 | 1.42 |
| 4→5 | 3 | 8 | 1.56 |
| 5→6 | 3 | 11 | 1.70 |
| 6→7 | 4 | 15 | 1.84 |
| 7→8 | 4 | 19 | 1.98 |
| 8→9 | 5 | 24 | 2.12 |
| 9→10 | 6 | **30** | **2.26** |

Первое получение locked species даёт rank 1, copies 0 и rare Flight pet level 1. Последующие получения дают copies +1. Raise требует явного action, списывает copies и не тратит currency. Rank 10 блокирует raise, но не дальнейшую выдачу copies. Surplus не превращается в gold/soul/XP и не имеет другого потребителя.

Bond применён в `createHeroUnits` **после** profile growth + gear + boon percent bonuses. Поэтому bond усиливает в том числе вклад gear/boons. `petCombatStats` не читает bonds: Flight-питомец этой же species не получает rank bonus. `HeroInfoPanel` берёт `heroCombatStats` без последующего bond multiplier; показанная сила лидера и реальная сила в бою могут расходиться.

## Pet instance — отдельный объект от unlocked dragon

Сохранение начинается с одного rare pet той же species, что и lead, но `deployed: false`. Его нужно отдельно отправить в Flight. До пяти deployed pets плюс lead участвуют в бою. Можно одновременно иметь lead и pet той же species; realm eggs допускают несколько instances одной species.

`genPet(captureLevel, rarity)` создаёт `level: 1`, сохраняя в `base` характеристики, полученные от enemy stats capture-level, начальной rarity и коэффициента .78. Поэтому два питомца с отображаемым level 1 / rare могут иметь разные base stats из-за уровня источника. Capture-level после создания отдельным полем не хранится.

Итог pet stats: `round(base × (1+.11×(L−1)) × (1+.06×train) × (1+FlightlordBonus/100))`; SPD округляется до десятых. Только deployed pets получают `round(towerXP × .6)`. Realm, sweep и quest XP не повышает pet level.

Training: стоимость очередного шага `60 × pet.level × (train+1)`. Все 10 steps при неизменном level 1 стоят 3300 gold и дают multiplier 1.6; при level 20 это 66000. Уровень питомца увеличивает и stats, и стоимость следующего training, поэтому поздняя тренировка значительно дороже ранней.

Pet rarity upgrade costs:

| Текущая → следующая | Gold | Soul/crystals | Combat результат сейчас |
| --- | ---: | ---: | --- |
| common→rare | 200 | 8 | Stats без изменения |
| rare→epic | 800 | 25 | Stats без изменения |
| epic→legendary | 3000 | 70 | Stats без изменения |
| legendary→red | 12000 | 200 | Stats без изменения |

Rarity была встроена в base при создании; action меняет только `pet.rarity`. Проверено через реальный store: rare→epic успешно списывает ресурсы, а combat stats совпадают до/после. Это дефект платного progression, а не предложение о новом балансе.

Продажа/разбор последнего pet instance не сбрасывает unlocked bond. Следующий duplicate по уже unlocked species не вызывает `ensureSpeciesPet`. В результате видимый unlocked dragon может остаться без Flight instance, который basic summons затем не восстанавливают.

## Gear: три разных множителя и двойное владение enhancement

Gear stats = `templateBase × rarityMultiplier × itemLevelMultiplier × enhancementMultiplier`. Три slots: weapon, armor, accessory. Profile gear общий при смене lead. Item level влияет на силу, но **не входит в sell price**. Inventory capacity считает bag entries, а не equipment slots и не суммарный stack count.

Enhancement upgrade относится к слоту. При экипировке новый предмет получает slot +N, ранее экипированный предмет уходит в bag со своим сохранённым +N. Поэтому один permanent slot bonus может существовать одновременно во множестве sellable/salvageable instances. Это источник повторного экономического дохода, см. [ECONOMY.md](ECONOMY.md).

Gear rarity upgrade требует slot enhancement ≥5, списывает gold/soul, меняет rarity и уменьшает slot enhancement на 5. Item level не растёт. Costs: common→rare 300/6; rare→epic 900/18; epic→legendary 3000/45; legendary→red 8000/120 (gold/soul). На других предметах, уже лежащих в bag, ранее скопированное enhancement не отзывается.

## Boons и run scope

Boss каждые пять floors; три уникальных варианта в одном offer. Уже owned boons не исключаются, поэтому одинаковые эффекты складываются. Первый выбор на новом floor сохраняется в `Profile.boons`; `lastBoonFloor` не позволяет снова получить boon на меньшем/равном boss floor. Есть auto-pick через 5 секунд.

Permanent: XP level, bonds/copies, pet instances/XP/training/rarity, gold/soul/stone/stamina, inventory/equipment/slot enhancement, boons, quest/achievement claims, bestFloor, realm clear counts. Restart переводит tower floor на 1, сохраняя всё перечисленное.

Run-only сейчас: текущие units/HP/shields/cooldowns, round, combat status, logs/floats, boon offer, temporary displayed rewards и session goldGained. Floor/mode/wave checkpoint сохранён, но восстановление пересоздаёт units с полным HP. Каждый новый floor/realm wave также начинает бой с полным HP.

Что **должно** стать run-only, код не определяет. Название roguelike и boon choice предполагают возможный run слой, но комментарий `startRun` явно сохраняет boons как permanent. Решение владельца требуется до изменения scope: перенос boons в run без отдельного согласования обнулит смысл имеющегося progression/save.

## Дублирование и последствия

| Перекрытие | Факт | Последствие |
| --- | --- | --- |
| Profile level / bond rank / pet level | Три числа называются level; действуют на разных сущностях | Непонятны цели achievements и следующий полезный upgrade |
| Bond / pet rarity / pet training | Один именованный dragon имеет species progression и instance progression | Lead сильнее от copies, Flight — нет; rarity upgrade выглядит полезным, но не работает |
| Training / pet level | Оба умножают HP/ATK/DEF/SPD | Нет уникальной боевой роли каждого слоя; costs растут с pet level |
| Gear item / slot enhancement | Одна сила сохранена на двух owners | Старые items остаются ценными без нового расхода stone |
| Profile XP / boon stats / bond stats | Все увеличивают leader stats, частично multiplicatively | Рост силы легко ошибочно приписать одной системе |
| Flight species / lead species | Один dragon может быть в команде несколько раз | Hero selection и коллекция не равны составу Flight |

Stage 0 фиксирует эти факты; не объединяет уровни, не убирает training/rarity и не меняет permanency.
