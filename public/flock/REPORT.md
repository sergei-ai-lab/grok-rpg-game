# Flock — ночной отчёт

Рабочая ссылка: https://sergei-ai-lab.github.io/grok-rpg-game/flock/

Папка `dragon-card/` не менялась.

## Этапы

1. Страница выложена в `public/flock/` (корень публикуемой папки Vite, путь `/grok-rpg-game/flock/`). `index.html` один файл, картинки `img/<имя>-1.webp` … `-3.webp`, пути относительные.
2. Старт: один из трёх детёнышей на весь экран, свайп, имя.
3. Бой: только Attack / Skill / Switch. Полоска жизни, без ATK/ARM. Удар, вылетающие числа, тряска, звук, `navigator.vibrate`. Ход ИИ с паузой и фразой на русском. Экран 390×844 без прокрутки боя.
4. Награда: опыт и шанс дубликата (первая победа — дубликат всегда). Уровни 1–10. На 5 и 10 — сцена эволюции: вспышка, другая стадия, новое умение. Прогресс в `localStorage` (`flock.v3`).
5. Руны Striker / Tank / Healer меняют длину полоски и умение. Коллекция: открытые и силуэты, своя тройка.
6. Кампания из 10 боёв, сложность растёт, десятый — босс Blacksun. Карта Path. Поражение не сбрасывает путь.

## Решения, принятые без вопросов

- Именной дракон всегда впереди и его нельзя снять с тройки. Двух других игрок выбирает сам.
- Каждый бой начинается с полной жизни. Растёт уровень, а не износ между боями.
- Кампания линейная: можно играть только следующий бой. После 10-го босса его можно повторить.
- Первая победа всегда даёт дубликат именного дракона, дальше шанс около 42%.
- Ashmaw открывается после 1-й победы, Pyrestone после 3-й, Scorchlane после 6-й.
- Glacielle, Stormveil и Nyxshade остаются силуэтами: арта нет.
- Где нет своей стадии 2 или 3, стоит копия первой картинки и золотая рамка. В бою это видно.
- Босс использует арт Scorchlane, увеличенное здоровье и имя Blacksun.
- Вибрация вызывается, но iPhone Safari часто её молча игнорирует. Тряска и числа остаются.
- Скрещивания, магазина и денег нет.
- Интерфейс на английском, одна русская подсказка на экран, потом она гаснет.

## Картинки, которые нужно сгенерировать

Формат 2:3, без текста на картинке. Стадии 1–3 стартовых (Kaelith, Verdraxis, Aurelune) уже настоящие и разные.

- Ashmaw, стадия 2. `Young ash dragon, larger than a hatchling, caked jaws, standing in cinders, cinematic dark firelight, no text, 2:3`
- Ashmaw, стадия 3. `Colossal ash dragon, soot wings, black-sun halo, volcanic night, cinematic, no text, 2:3`
- Pyrestone, стадия 2. `Adolescent magma dragon, cooling stone plates, leaping, orange cracks, cinematic, no text, 2:3`
- Pyrestone, стадия 3. `Massive caldera dragon, body of cooling lava rock, crater glow, cinematic, no text, 2:3`
- Scorchlane, стадия 2. `Young flame dragon walking, longer fire mane, ember ground, cinematic, no text, 2:3`
- Scorchlane, стадия 3. `Huge wildfire dragon, the air burning around a horned head, cinematic night, no text, 2:3`
- Blacksun, босс. `Towering black-sun dragon, eclipse behind the horns, ash and gold fire, cinematic, no text, 2:3`
- Glacielle, стадия 1. `Tiny frost dragon hatchling, pale ice spines, blue breath, cinematic, no text, 2:3`
- Glacielle, стадия 2. `Young glacier dragon, armored ice plates, mist, cinematic, no text, 2:3`
- Glacielle, стадия 3. `Colossal whiteout dragon, frozen wings, blizzard halo, cinematic, no text, 2:3`
- Stormveil, стадия 1. `Tiny storm dragon hatchling, spark along the horns, rain, cinematic, no text, 2:3`
- Stormveil, стадия 2. `Young thunder dragon, crown of sparks, wet rock, cinematic, no text, 2:3`
- Stormveil, стадия 3. `Colossal tempest dragon, lightning mane, cliff in a storm, cinematic, no text, 2:3`
- Nyxshade, стадия 1. `Tiny void dragon hatchling, violet dusk, soft dark wings, cinematic, no text, 2:3`
- Nyxshade, стадия 2. `Young eclipse dragon, shadow petals, dim gold eyes, cinematic, no text, 2:3`
- Nyxshade, стадия 3. `Colossal night dragon, eclipse maw, starless sky, cinematic, no text, 2:3`

Имена файлов, если заменять: `img/ashmaw-2.webp`, `img/ashmaw-3.webp`, `img/pyrestone-2.webp`, `img/pyrestone-3.webp`, `img/scorchlane-2.webp`, `img/scorchlane-3.webp`, и новые `img/glacielle-1.webp` … `img/nyxshade-3.webp`. Босса можно положить как `img/blacksun-1.webp`, когда появится отдельный арт.
