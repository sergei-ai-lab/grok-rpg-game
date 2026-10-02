# Battle audit — существующий auto-battler

Источники: `src/game/engine/{battle,run,stats}.ts`, `src/game/data/heroes.ts`, `src/views/BattleView.vue`, battle/store regression tests. Ни одна формула не изменена.

## Решения игрока и автоматизация

Игрок выбирает unlocked leader, deployed Flight, gear, enhancement/rarity/training, маршрут tower/realm, boon, скорость и pause; покупает/продаёт ресурсы и может нажать active skill. Target selection, attacks, crit/double-hit, enemy abilities, victory/defeat и reward settlement автоматические.

BattleView перед каждым tick вызывает `castSkill`, если cooldown лидера равен 0, затем `battleTick`. Поэтому active skill фактически работает как автоматически включаемый skill на cooldown. Ручная кнопка существует, но удержать готовый skill для выбранного момента/врага при обычном автотике нельзя. Tactical targeting нет.

Panel или pause останавливает combat ticks. Reward auto-next (12 секунд) и boon auto-choice (5 секунд) — отдельные timers; открытая панель/pause их не гарантированно останавливает. Raise bond из victory UI отменяет auto-next и оставляет следующий переход ручным.

## Время и speed modes

Один tick — полный round: каждый живой actor атакует один раз по descending SPD. SPD определяет **порядок**, не число атак в секунду. Double-hit может добавить второй удар тому же actor.

Interval = `max(60 ms, round(520 ms / speed))`.

| Надпись | Реальный interval | Tick ускорение относительно 1× |
| --- | ---: | ---: |
| 1× | 520 ms | 1.00× |
| 3× | 173 ms | 3.01× |
| 5× | 104 ms | 5.00× |
| 8× | 65 ms | 8.00× |
| 10× | 60 ms | 8.67× |
| 15× | 60 ms | 8.67× |

Это расчёт таймера, а не измерение FPS реального телефона. Combat длина зависит от RNG, stats, Flight, щитов и лечения; жёсткого тайм-лимита нет. Battle с N rounds занимает примерно N×interval плюс браузерная задержка, затем обычно ещё 12 секунд reward screen. На коротком раннем бою ожидание награды может быть длиннее боя. Силовой grind может состоять из сотен повторных коротких floors, а shield/LS bosses — из длинных боёв. Simulations используют фактические tick intervals; не обещают универсальную длительность.

Каждый floor и каждая realm wave пересоздаёт hero/pets с полным HP, без cooldown/shield carry-over. Continue тоже пересоздаёт encounter. Это последовательность отдельных боёв, а не текущая attrition-модель нескольких волн с общим запасом HP.

## Базовый hit

Обычный урон: `max(1, round(ATK × random(.9,1.1) × critMultiplier − target.DEF × .5))`; critMultiplier = 1.6 или 1.0. Target — случайный живой opponent. При double-hit выполняется дополнительная атака с damage scale .8 после вычитания defense. Hero dodge поле объявлено в type, но действующей evade/dodge модели нет.

Basic damage сначала поглощает shield, затем HP. Corrosion при удачном roll добавляет процент maxHP цели к damage **до той же shield обработки**, хотя log описывает её как unblockable. Lifesteal исходит из рассчитанного damage (включая shield absorption/overkill), а не только фактически потерянного HP противника. Passive lifesteal не учитывает heal reduction.

HP clamped до maxHP при лечении и до 0 при смерти. Живые units получают свой turn; lead death означает поражение даже если Flight жив. Если lead умер в середине round, оставшиеся живые Flight actors могут ещё действовать в этом round; итоговый приоритет — смерть lead. Детерминированные тесты защищают этот исход.

## Шесть kits и элементы

| Dragon / element | Base HP / ATK / DEF / SPD | Growth за profile level | Passive (actual base probabilities) | Active / cooldown rounds |
| --- | --- | --- | --- | --- |
| Vorathion / Fire | 100 / 21 / 5 / 10 | 11 / 3.2 / .9 / .5 | crit .10, double .20 | Single burst 3.2×ATK / 3 |
| Kaelith / Frost | 124 / 13 / 12 / 7 | 15 / 2 / 1.8 / .3 | regen .04, crit .04 | AoE 1.5×ATK / 4 |
| Verdraxis / Storm | 94 / 18 / 6 / 14 | 10 / 2.7 / 1 / .85 | crit .06, double .16 | Single LS 2.5×ATK / 4 |
| Nyxarion / Void | 82 / 23 / 4 / 9 | 8 / 3.4 / .7 / .45 | LS .15, default crit .05 | AoE 1.8×ATK / 5 |
| Aurion / Light | 130 / 14 / 9 / 8 | 16 / 2.2 / 1.5 / .35 | regen .03, crit .08 | Self heal .45×maxHP / 4 |
| Umbraxis / Shadow | 96 / 19 / 5 / 12 | 10 / 2.9 / .8 / .6 | crit .12, LS .08 | Single burst 2.9×ATK / 3 |

Elements **Fire / Frost / Storm / Void / Light / Shadow подтверждены** в canon data/UI. В `BattleUnit` нет elemental combat input; attack/skill formulas не читают element, resistance или matchup table. Frost не накладывает freeze, Storm не даёт отдельной lightning vulnerability, Light/Shadow не образуют counters. Различия kits реальны, элемент пока metadata/presentation.

Текст «Crit +10%» используется как total base crit .10, а не .05+.10. Aurion «mends the flight» фактически регенерирует/лечит только lead. Flight pets не наследуют active/passive hero kit species: обычные attacks, фиксированный crit .08, общие pet stats.

## Cooldown, active damage и healing

Cooldown выставляется при cast; уменьшается в ходе rounds; повторный cast при положительном cooldown не выполняется. Победа после active skill оплачивается store один раз, следующий tick не дублирует reward. Эти случаи покрыты тестами.

Burst/AoE/lifesteal active hits используют attack coefficient и defense, но **вычитают HP напрямую, не shield**. Щит продолжает визуально/численно существовать, пока HP падает. Это значительное отличие от basic hit, а не явная elemental mechanic.

Для Verdraxis: damage уже умножен на power 2.5; heal дополнительно умножается на `power × .5`, то есть на 1.25. Текст обещает half damage. Fixture ATK20/DEF0: enemy теряет 50 HP, hero лечится на 63, shield1000 остаётся 1000. Active LS также не использует heal reduction.

Heal reduction накладывается с шансом .45 при enemy hit и складывается шагом .35, cap .85; duration добавляется от врага (normal 2, boss 3). HP regen и Aurion heal уменьшаются; passive/active LS — нет. Дебафф ставится даже при ударе, поглощённом shield. При истечении duration reduction очищается. Shield regen действует на собственных turns врага; shield cap — его maxHP. Enemy начинает с shield по формуле ниже.

## Scaling врагов и bosses

Enemy level L базово: HP `110×L^1.45`; ATK `14+4.6L`; DEF `1.8L`; SPD `7+.28L`. HP/ATK/DEF имеют random multiplier .9–1.1. Early normal L≤8: HP×.5 и ATK×.82. Early boss L≤8: HP×2.1, ATK×1.35, DEF×1.3. Late boss: HP×4.2, ATK×2.2, DEF×2.0. Поэтому boss floor5 (L6) и floor10 (L11) пересекают дискретную границу early/late одновременно с XP/gear progression.

`tier = min(1, L/40)` для способностей:

| Enemy effect | Normal | Boss |
| --- | --- | --- |
| Crit | `.1 + .15×tier` | То же |
| Lifesteal | `.07×tier` | `.2 + .12×tier` |
| Double hit | `.13×tier` | `.3 + .18×tier` |
| Initial shield | HP×`(.06+.12×tier)` | HP×`(.28+.2×tier)` |
| Shield regen/turn | HP×`(.01+.015×tier)` | HP×`(.03+.02×tier)` |
| Corrosion chance | `.08+.16×tier` | `.35+.2×tier` |
| Corrosion maxHP damage | `.06+.07×tier` | `.12+.08×tier` |

Для normal L≤5 shield отключён. Initial shield рассчитывается в локальном `shieldMax`, но regen runtime cap использует maxHP; продолжительные battles способны накапливать больший shield, чем стартовый. Chance не изменяет elemental interaction. Boss SPD дополнительно умножается на 1.15.

Tower: обычный floor enemy L=floor+random0/1; boss каждые 5, L=floor+1. Counts ordinary:1 до 5,2 на 6–10,3 с 11 (boss branch отдельный). Sprite tier pool `minTier=clamp(1+floor((floor−1)/8),1,10)`, maxTier=minTier+2 capped12. Реальная `SPRITES` заканчивается tier5. На 41–44 пустые waves быстро выигрываются; boss45 падает при чтении undefined sprite. Это подтверждено и unit characterization, и 115 из 360 hour simulation trajectories.

Realm normal waves имеют 2–6 врагов с масштабированием от definition level; последняя wave — boss плюс adds. Много high-level boss names не соответствуют доступному sprite точно и попадают в fallback. Между waves полное восстановление units. Stamina платится при входе; no tower copy/petXP payout за промежуточную волну.

## Boons в бою

Hero percent: ATK+18%, HP+22%, DEF+30%, SPD+20%; дополнительные crit+.15, LS+.12, double+.20, regen+.04. Flightlord даёт всем pet stats+25%. Boon percents одного класса суммируются, затем применяются multiplier. Bond multiplier применяется к lead HP/ATK/DEF после них. Greed+40% относится к tower gold; Fortune+15 процентных пунктов к equip roll и rarity luck.

Повторные boons одного типа разрешены на следующих новых boss floors. Chance stats не имеют явного cap: при >1 `chance(p)` фактически всегда true, UI может показывать >100%. Boons не пропадают после death/restart. Какие из них в будущем должны быть run-only — отдельное продуктовое решение.

## Границы Stage 0

Не изменены shield bypass, heal formula, enemy scaling, cooldowns, speed labels, full-heal per wave, auto-skill и lead-death model. Tests описывают проверенный текущий контракт и отдельно маркируют bugs. Дальнейший playtest балансировки должен сначала получить стабильный поздний tower и правдивые upgrade/skill effects.
