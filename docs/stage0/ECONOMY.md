# Economy / rewards — без изменения чисел

Источники: actual store settlement/actions, `loot.ts`, `stats.ts`, `quests.ts`, `dungeons.ts`, deterministic regression fixtures и seeded real-engine simulations. «Слишком быстро/медленно» ниже — следствие текущих взаимосвязей и сценариев, а не утверждение об утверждённом target balance.

## Source / sink map

| Resource | Sources | Sinks / ограничения | Вывод baseline |
| --- | --- | --- | --- |
| Gold | Initial200; tower; realm/sweep; quests/achievements; sell gear/material/consumable/pet | Summon40; shop purchases; shop refresh1000; daily refresh100; training; enhancement; rarity upgrades; capacity; stamina50/100 | Безлимитный tower, profitable sweeps и slot resale ослабляют scarce currency |
| Soul / crystals | Gear salvage; pet salvage; quest/achievement rewards | Gear rarity upgrade; pet rarity upgrade | «Soul» в save и «crystals» в UI — одна валюта. Pet upgrade сейчас не даёт combat value |
| Stone | Initial5; normal tower stone roll; gear salvage; quests; dungeon stone entries; shop25/stone; old-save bag migration | Enhancement attempts | Нет tower stamina cost; repeated salvage даёт повторяемый источник. Ранние stones ограничивают +5, late slots mint salvage yield |
| Stamina | Initial1000; lazy/offline sync +1/30s; purchase +100 за 50gold | Realm entry; sweep двойная entry cost | Tower не расходует; дешёвая покупка делает sweep положительным gold loop после первого clear |
| Copies | Basic summon; pet shop; **каждая** tower victory lead +1; floor%3 extra other species +1/unlock | Raise bond до 10; 30copies после unlock | После rank10 нет sink. Бесплатные tower copies конкурируют с платным summon |
| Gear | Tower loot; boss гарантированный drop; shop | Equip временно убирает из bag; sell/salvage уничтожают; replacement/overflow | Item level даёт stats, но не повышает sell price; inherited slot +N повышает цену |
| Boons | Новый boss milestone floor%5, gate floor>lastBoonFloor | Sink/reset отсутствует | Permanent milestone collection; нельзя farm тот же boss ради нового boon |

Gold/reward settlement защищён от повторного `battleTick` уже выигранного encounter в одной session. Refresh/continue пересоздаёт fight на сохранённом floor, и повторная победа опять оплачивается: нет durable encounter/reward transaction ID. Это отличается от same tick double payout.

## Tower rewards и ценность summon

На floor f:

- Gold: `round((12+4f) × (boss?3:1) × (1+Greed/100))`.
- Profile XP: `round((12+4f) × (boss?2.5:1))`.
- Lead: один `grantCopy` **за каждую победу**, включая повторный floor1 после restart.
- Extra: floor, кратный 3, выдаёт одно получение случайной из **остальных пяти species**. Locked → unlock+pet, unlocked → spare copy.
- Один loot roll за victory, независимо от числа mobs. Boss → гарантированная gear; normal →24% gear,22% stone1–2,54% nothing без Fortune.
- Только deployed pets получают `round(XP×.6)` каждый. Tower не расходует stamina.

Basic summon стоит 40gold. Если есть locked species, с шансом 70% выбирается locked pool, иначе весь canon pool; внутри выбранного pool species равновероятны. Unlock создаёт rare level1 Flight pet; duplicate выдаёт одну copy. Basic summon не roll-ит pet rarity. Все шесть species могут быть получены достаточно рано; tower extras также бесплатно открывают коллекцию.

30 побед на повторяемом floor1 дают 30lead copies →rank10, 480gold и 480XP, без stamina/босса. Regression проверяет actual grant/spend/settlement (противники принудительно отмечены defeated для проверки экономики; это **не** замер времени/трудности 30 побед). С initial200 итог gold680 без других расходов. Поэтому copy ladder cap можно достигнуть без роста bestFloor выше 1; ценность дальнейших платных duplicate summons исчезает.

Fortune прибавляет 15 процентных пунктов equip probability и влияет на rarity luck. Stone branch остаётся после equip branch; при большой сумме Fortune вероятность stone уменьшается, а при equipP≥1 gear становится гарантированной. Это не бесконечный independent дополнительный drop.

## Первые 20 floors — условный ledger одного прохода

Условие: каждый floor пройден ровно один раз, без Greed/Fortune и quest payouts/spending. Это ledger выплат, **не обещание**, что новый профиль победит 20 floors подряд. RNG loot и шестёрка лидеров отдельно от ledger.

| Floor | Gold | XP | Cumulative gold | Cumulative XP | Lead copies / extra grants cumul. |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 16 | 16 | 16 | 16 | 1 / 0 |
| 2 | 20 | 20 | 36 | 36 | 2 / 0 |
| 3 | 24 | 24 | 60 | 60 | 3 / 1 |
| 4 | 28 | 28 | 88 | 88 | 4 / 1 |
| 5 boss | 96 | 80 | 184 | 168 | 5 / 1 |
| 6 | 36 | 36 | 220 | 204 | 6 / 2 |
| 7 | 40 | 40 | 260 | 244 | 7 / 2 |
| 8 | 44 | 44 | 304 | 288 | 8 / 2 |
| 9 | 48 | 48 | 352 | 336 | 9 / 3 |
| 10 boss | 156 | 130 | 508 | 466 | 10 / 3 |
| 11 | 56 | 56 | 564 | 522 | 11 / 3 |
| 12 | 60 | 60 | 624 | 582 | 12 / 4 |
| 13 | 64 | 64 | 688 | 646 | 13 / 4 |
| 14 | 68 | 68 | 756 | 714 | 14 / 4 |
| 15 boss | 216 | 180 | 972 | 894 | 15 / 5 |
| 16 | 76 | 76 | 1048 | 970 | 16 / 5 |
| 17 | 80 | 80 | 1128 | 1050 | 17 / 5 |
| 18 | 84 | 84 | 1212 | 1134 | 18 / 6 |
| 19 | 88 | 88 | 1300 | 1222 | 19 / 6 |
| 20 boss | 276 | 230 | **1576** | **1452** | **20 / 6** |

После этого: profile level8, XP262/290; gold1776 с initial200 до трат; если raise расходовать сразу, lead rank8 и 1spare copy (rank9 требует 24copies cumul.). Четыре boss boon milestones при выборе каждого; expected gear4+16×.24=7.84; expected tower stones16×.22×1.5=5.28 плюс initial5. Extra grants могут открыть новые species, поэтому не все 6 обязательно являются spare copies. Boss guaranteed gear может auto-sell/salvage при full bag вместо сохранения item.

## Enhancement / rarity / inventory costs

Attempt на текущем slot enhancement E и rarity index r:
gold=`40×(E+1)×(r+1)`; stone=`1+floor(E/5)`; success=`max(.35,.95−.035E)`. Failure списывает полную цену; E не растёт. Cap99. Без failures common0→5 стоит 600gold/5stone; success rates .95,.915,.88,.845,.81. Суммарный minimum common0→99:198000gold/1030stone, реальное ожидание выше из-за failures. Для higher rarity gold умножается на index+1.

Upgrade требует≥+5 и снимает 5slot ranks. Gear gold/soul costs300/6,900/18,3000/45,8000/120. Pet gold/soul costs200/8,800/25,3000/70,12000/200, но pet combat effect сломан. Training растёт с level и train rank, см. [PROGRESSION.md](PROGRESSION.md).

Sell gear: `max(6, floor(templatePrice×rarityMul×(1+.12E)×.4))`; itemLevel не участвует. Salvage: stone=`rarityIndex+1+floor(E/5)`, soul=`[1,3,8,20,50][rarityIndex]+E`. Pet sell=`round(50×level^1.1×rarityMul)`, salvage soul3/7/18/40/90. Consumable/material sell используют catalogue price/count. Manual и auto salvage/sell не полностью одинаково track-ят achievements.

Capacity30 entries, upgrades+5 до 200; price=`200×(1+.5×previousSteps)`. Nongear stack того же kind/defId добавляется даже при full bag. Если loot не помещается: matched auto-salvage имеет priority над auto-sell; возможно replacement уже лежащего matched item; иначе gear auto-sell даже с выключенной настройкой, nongear может быть потерян. Equip swap/unequip учитывает bag capacity; shop full bag не списывает gold и оставляет offer доступным.

## Shop и прибыльные loops

Stock12:4gear,3stone,5pet. Gear generation floor≈profileLevel+random(−1,2), minimum1. Цена gear — средняя template price доступного pool ×rarity×.9, не individual template price. Stone25/1. Pet offer price=`round(46×offerLevel×rarityMul)`.

**Pet offer loses level/rarity.** Store сначала создаёт advertised pet, затем discards object и передаёт только species в grantCopy. Новый species превращается в rare capture-level1 pet; owned species — в одну copy независимо от price. Поэтому высокий paid summon может стоить значительно больше 40, не давая обещанного улучшения. Shop pet branch также не начисляет shopBuy quest progress.

Refresh1000gold; rare-hunt до 200refresh (potential200000gold) проверяет только первый из пяти pet slots. Даже удачная red/legendary offer пока имеет тот же discard defect.

**Slot minting loop — воспроизведён, late fixture.** Все три slots +99, profile level1, fixed RNG .5. Refresh создаёт 4common armor `a2` по 84gold; equip копирует+99; sell каждого 618gold; total4×(618−84)−1000=**+1136gold/cycle**. Three cycles в regression:10000→13408, stones/soul не меняются. Не утверждается, что +99 доступен за первый час. Loop появляется после накопления slot enhancement и appropriate shop prices; copied enhancement можно также salvage повторно ради stone/soul. Средний gear resale multiplier превышает average purchase multiplier уже при E≥11 до refresh costs; individual templates и refresh влияют на реальный break-even.

**Daily refresh loop.** Hunt:5victories→120gold/60XP/2stone. Paid refresh100gold полностью очищает progress/claimed, поэтому последующие 5 бесплатных towerwins снова дают quest. Только quest часть net+20gold; floor1 rewards ещё+80gold за цикл, плюс copies/loot/XP. Repeatable, календарь не ограничивает farm. Forge считает enhancement attempts, не обязательно successful upgrade. Patron требует 2shopBuy (pet offers не считают); Realm требует 1clear. Claim/questProgress не сами проверяют UTC rollover; reset происходит при track, так что смена дня до следующего игрового event не обновляет всё немедленно.

## Realms / stamina / dungeon payouts

30realm definitions; вход ограничен profile level и stamina; rewards фиксированы на **завершение всех waves**, не за каждую wave. Sweep доступен после первого clear, мгновенно даёт те же fixed rewards и egg при двойной stamina. Копий, tower boons и pet XP эти выплаты не дают. Dungeon eggs добавляют pet напрямую; bond unlock появляется лишь при следующей загрузке save migration.

| Пример realm | Need level | Entry / sweep stamina | Waves / enemy base level | Gold / profile XP | Stone entries / egg |
| --- | ---: | --- | --- | --- | --- |
| Forest | 2 | 10 / 20 | 3 / 3 | 120 / 90 | 2+1, no egg |
| Ice | 7 | 12 / 24 | 3 / 9 | 300 / 220 | 1+3, no egg |
| Hell | 14 | 14 / 28 | 4 / 17 | 650 / 480 | 6+2, egg |
| Origin (last) | 980 | 70 / 140 | 12 / 999 | 60000000 / 50000000 | 8000+150, egg |

Сохраняются все stone entries; reward popup сообщает только первый, поэтому фактическая награда выше показанной. Первоначальные 1000stamina=100Forest entries или 50Forest sweeps. Regen120stamina/hour; cap1000 восстанавливается за 8h20m. Sync lazy в relevant calls; покупка 50gold/+100 ограничена cap, сбрасывает staminaAt.

После первого Forest clear, replenish20stamina стоит эквивалент 10gold, а sweep даёт 120gold: net110gold/с weep при циклических покупках по 100points (5sweeps perpurchase). Это arithmetic source/sink loop на actual costs, не предположение о RNG. Верхние realms делают разницу на порядки больше. Level gate и first clear — реальные препятствия; после clear ограничение скорее clicks/level unlock, чем scarce stamina. Статистика battle wins не увеличивается отдельными intermediate waves так же, как tower victory; `dungeonClear` отслеживается при clear/sweep.

## 10 / 30 / 60 минут — real-engine experiments

Reproduce: `npm run audit:simulate > docs/stage0/simulations.json`. [Full results](simulations.json), [compact per-hero CSV](simulations-summary.csv).20fixed seeds×6leaders×3policies=360hour trajectories. Начальные save/RNG и clocks reset. Формулы берутся из actual store/engine, не написаны заново в simulator. Vue rendering/proxy tracking обходится только для ускорения эксперимента, game actions не подменены.

Policies:

1. Passive1×: начальный lead, auto skill/auto-next12s; ничего не покупает/экипирует/deploy/raise, после defeat не restart.
2. Caretaker1×: summon до 6species, raise affordable bonds, deploy до 5pets, лучший gear по power, salvage остального, enhancement equipped до+5, claim earned quests; next/restart2s, boon5s.
3. Caretaker15×: те же actions при выбранной 15×, actual tick60ms. Boon preference: atk,hp,pet,ls,double,crit,def,regen,spd,gold,drop.

Не включены training, shop, rarity upgrades, realms/sweep, daily refresh, меню-время, human reaction/network/browser scheduling. Это идеализированная политика, **не прогноз среднего игрока/retention**, не оптимальный build и не тест нового баланса. Старт после prep пересоздаёт units. Все невозможные late-floor states/crashes зафиксированы и останавливают trajectory; после crash состояние frozen, не продолжается выдуманная игра.

Ниже **диапазон per-hero medians** (6 медиан по 20seed), а не min/max всех individual trajectories. Здесь median — эмпирический 50-й percentile, нижняя медиана для 20 наблюдений. Подробные min/median/max, total income, stone/soul/stamina/bag/owned/boons/deaths есть в JSON.

| Policy | Minutes | Profile level | Lead rank | Best floor | Wins | Gold balance | Spare copies across six |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Passive1× | 10/30/60 | 1 | 1 | 1–2 | 1–2 | 216–236 | 1–2 |
| Caretaker1× | 10 | 13–18 | 10 | 9–14 | 80–122 | 4120–5680 | 52–97 |
| Caretaker1× | 30 | 26–35 | 10 | 9–34 | 237–367 | 12616–25880 | 213–349 |
| Caretaker1× | 60 | 38–49 | 10 | 14–44 | 410–717 | 28532–46520 | 391–759 |
| Caretaker15× | 10 | 22–29 | 10 | 9–30 | 212–236 | 9348–18012 | 189–215 |
| Caretaker15× | 30 | 41–50 | 10 | 14–44 | 410–715 | 31644–54960 | 391–757 |
| Caretaker15× | 60 | 47–72 | 10 | 19–44 | 410–1449 | 44692–99072 | 391–1723 |

Passive dies once and stops; therefore all three horizons identical. Caretaker shows that copies cap early while XP/bestFloor continue much more slowly and require repeated restarts. Floor45 crashed38/120caretaker1× and77/120caretaker15× trajectories by1hour (115total); earliest7.118minutes. Medians after crashes include frozen states. No late floor/high level conclusion should be extrapolated past this blocker.

## Balance findings, без реализации

| Вопрос | Наблюдение / следствие |
| --- | --- |
| Что слишком быстро относительно других слоёв? | Rank10 достигается 30lead victories; tower repeat pays copies regardless bestFloor; all collection species получаются рано; surplus hundreds в caretaker policies |
| Что медленно / grind? | Passive без deploy/equip/raise проигрывает на 1–2; boss jump требует permanent growth; XP/bestFloor отстают от rank cap; training дороже на высоком pet level; +99 требует многих costly failed attempts |
| Что бесконечно farm? | Tower1gold/XP/copies/loot; paid daily refresh; purchased-stamina sweeps после clear; slot-enhanced resale/salvage при соответствующем enhancement |
| Где теряется смысл валюты? | Gold inflation из profitable sweeps/resale; copies после rank10; soul spent on pet rarity без combat benefit; stamina покупается из того же positive payout |
| Где сломан summon value? | Бесплатная guaranteed lead copy pervictory; бесплатные extra unlocks; expensive shop pet losesrarity/level; owned species имеет cap10 без surplus sink |
| Что пока нельзя обоснованно балансировать? | Floors>40, pet rarity progression, обещанная shop value и exact shield/heal kit: baseline defects искажают выводы |

Stage 0 не меняет costs, chances, reward amounts, copy cap, stamina regeneration и grind loops. Сначала владелец утверждает intended meanings и минимальные исправления из [STAGES.md](STAGES.md), затем можно измерять новый balance на отдельной ветке.
