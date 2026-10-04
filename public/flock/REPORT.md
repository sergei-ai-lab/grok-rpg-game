# Flock — ночной отчёт v3

Рабочая ссылка: https://sergei-ai-lab.github.io/grok-rpg-game/flock/

Сравнение со стабильной версией до этой ночи: https://sergei-ai-lab.github.io/grok-rpg-game/flock-v2/

Публикацию на grok.me не трогал. Папку `dragon-card/` не трогал.

## Баланс (1000 кампаний простого бота)

Скрипт: `public/flock/balance.mjs`. Бот берёт Kaelith и двух стартовых, жмёт умение, когда оно готово, и меняет бойца, если спереди меньше 38% жизни. Часы: 96 секунд на выбор и имя, около 10 секунд на ход игрока, 10 секунд на повтор после поражения, 11 на награду, 7 на эволюцию.

Прогон до правок этой ночи и повторный прогон после того, как бойцовые числа оставлены как есть. Менять было нечего: все четыре цели уже внутри коридора. Здоровье босса по-прежнему ×1.52.

| | До | После |
|---|---|---|
| Бои 1–3 | 100 / 100 / 100% | 100 / 100 / 100% |
| Босс (попытки) | 44% | 44% |
| Вся кампания до конца | 92.1% | 92.1% |
| Первая эволюция до 5-го боя | 100% | 100% |
| Время, медиана | 20 мин | 20 мин |
| Время, 10–90% | 18.5–29.9 мин | 18.5–29.9 мин |
| Время, среднее | 21.8 мин | 21.8 мин |

Коридор: первые три боя ≥ 85%, босс 40–60%, кампания около 20–30 минут, эволюция раньше 5-го боя. Нижние 10% чуть быстрее 20 минут, потому что бот не читает экраны. Среднее и медиана в коридоре, верхние 10% упираются в 30 минут за счёт повторов босса.

Решение: формулы урона, опыта и множитель босса не менял.

## Ощущение

Удар, крит, умение, победа и эволюция звучат по-разному через WebAudio. Выключатель в Settings. Крит — верхние 18% уже существующего разброса, формула урона не менялась. На крите вспышка и искры, на эволюции искры и вспышка. Смена экрана слегка поднимается и проявляется. Сам бой между ходами не переигрывает эту анимацию.

Кнопки Attack / Skill / Switch в стабильной сборке были нарисованы, но не подключены к ходу. Подключил. Без этого бой нельзя было сыграть.

## Ростер

Девять драконов, три стадии, у каждого свой приём:

| Дракон | Стиль | Что чувствуется |
|---|---|---|
| Kaelith | Тяжёлый удар | Одно большое число |
| Verdraxis | Щит | Удар и синяя кромка, следующий входящий режется |
| Aurelune | Лечение | Зелёные числа и короткий укус |
| Ashmaw | Горение | Урон сейчас и ещё два тика, оранжевая кромка |
| Pyrestone | Шкура | Слабее щита, но свой контур |
| Scorchlane | Два удара | Два числа за один ход |
| Glacielle | Заморозка | Враг пропускает следующий ход, белая кромка |
| Stormveil | Дуга | Урон по переднему и по следующему |
| Nyxshade | Вампиризм | Часть урона возвращается лечением |

Руна по-прежнему меняет только толщину жизни и силу удара. Умение на 2 и 3 стадии примерно на 12% и 24% сильнее. Открытие по победам: 1 Ashmaw, 2 Pyrestone, 3 Scorchlane, 4 Glacielle, 5 Stormveil, 6 Nyxshade.

## Возврат

Три цели на локальный день: выиграть 2 боя, применить умение 3 раза, один раз сменить бойца. Когда все три готовы, на экране дня открывается сундук: крышка, свет, искры, +36 опыта именному дракону. Если этого хватает на эволюцию, сразу сцена эволюции. Повторно в тот же день сундук не берётся. Прогресс дня в том же `localStorage` (`flock.v3`, поле `daily`).

## Сброс

В Settings кнопка Reset progress. Первый тап вооружает, второй стирает путь, стаю и дневные цели и возвращает к выбору детёныша. Настройка звука остаётся.

Не делал: скрещивание, магазин, деньги, аккаунты, PvP.

## Картинки, которые нужны

Формат 2:3, без текста. Стадии 1–3 у Kaelith, Verdraxis и Aurelune уже разные. Где файла нет, в бою стоит чужой арт с цветным фильтром или копия первой стадии.

- `img/ashmaw-2.webp` — Young ash dragon, caked jaws, cinders, dark firelight, no text, 2:3
- `img/ashmaw-3.webp` — Colossal ash dragon, soot wings, black-sun halo, volcanic night, no text, 2:3
- `img/pyrestone-2.webp` — Adolescent magma dragon, stone plates, orange cracks, no text, 2:3
- `img/pyrestone-3.webp` — Massive caldera dragon, cooling lava rock, crater glow, no text, 2:3
- `img/scorchlane-2.webp` — Young flame dragon, longer fire mane, ember ground, no text, 2:3
- `img/scorchlane-3.webp` — Huge wildfire dragon, horned head, burning air, night, no text, 2:3
- `img/glacielle-1.webp` — Tiny frost hatchling, ice spines, blue breath, no text, 2:3
- `img/glacielle-2.webp` — Young glacier dragon, ice plates, mist, no text, 2:3
- `img/glacielle-3.webp` — Colossal whiteout dragon, frozen wings, blizzard, no text, 2:3
- `img/stormveil-1.webp` — Tiny storm hatchling, spark on the horns, rain, no text, 2:3
- `img/stormveil-2.webp` — Young thunder dragon, crown of sparks, wet rock, no text, 2:3
- `img/stormveil-3.webp` — Colossal tempest dragon, lightning mane, cliff storm, no text, 2:3
- `img/nyxshade-1.webp` — Tiny void hatchling, violet dusk, soft dark wings, no text, 2:3
- `img/nyxshade-2.webp` — Young eclipse dragon, shadow petals, dim gold eyes, no text, 2:3
- `img/nyxshade-3.webp` — Colossal night dragon, eclipse maw, starless sky, no text, 2:3
- `img/blacksun-1.webp` — Towering black-sun dragon, eclipse behind the horns, ash and gold fire, no text, 2:3
