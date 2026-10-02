# License / reuse provenance

Проверено 2 октября 2026. Stage 0 не добавляет libraries/assets и не меняет images/font. Добавлены фактические credits и полный bundled-runtime notice file, копируемый в static dist. Ни root MIT, ни один общий attribution не превращают автоматически все материалы repository в MIT.

## Установленные источники и коммерческая совместимость

| Материал | Доказательство происхождения | License / commercial scope | Notices / состояние |
| --- | --- | --- | --- |
| Game code foundation | `SmallTeddy/auto-monster`, upstream snapshot `efb10dfe5eb4c771840c4ca59e4a0e889c02b5e3`; текущий root LICENSE побайтно совпадает | MIT, Copyright(c)2024SmallTeddy; разрешает коммерческое использование/модификацию/распространение | Сохранён rootLICENSE; полный MIT с copyright добавлен в publicTHIRD_PARTY_NOTICES |
| Creature/item tiles | Все 1311tracked `src/assets` files побайтно совпали с Auto Monster snapshot; README/attribution называют Dungeon Crawl32×32 | Заявленный tileset CC0; primary OGA page подтверждает свободное commercial reuse | Courtesy ChrisHamons(maintainer)/contributors и sourceURL сохранены. CanonicalOGA per-file match не выполнен для всех 1311, поэтому provenance scope ограничен inherited set |
| Game SVG logo | LongestSVGpath exact match `delapouite/shark-bite.svg` из `game-icons/icons` commit `82d948812bfe3f269ef8f731dcdb07b08160edc4`; текущий SVG также byte-identical upstreamAutoMonster | Delapouite, Sharkbite, CC BY3.0; commercial use разрешён при attribution/license terms | Добавлены title,author,source,licenseURL; inherited brownbackground adaptation указана; SVG не изменён |
| Game PNG logo | `public/icons/game.png` byte-identical AutoMonster; paired inherited logo asset | Attribution приложен к паре; exact vector path proof относится к SVG | PNG сохранён. Это не claim независимого pixel-hash matching official PNG |
| MaterialDesignIcons | UnoCSS `i-mdi-*`; installedIconifycollection declares Pictogrammers/Templarian, Apache2.0; collectionLICENSE checked atSHA`382f8a138afaaefe9ca2cfa80d33317f7814d997` | Apache2.0icons, MITtooling; collection permits commercial reuse | PictogrammersFreeLicense text, standardApache2.0terms и source включены; noNOTICEfile обнаружен в rootcollection listing |
| BundledruntimeJS/CSS | Реальный productionchunkgraph, [runtime-map.json](runtime-map.json) | Listed packages below all MIT | Полные installedpackageLICENSE texts в publicTHIRD_PARTY_NOTICES |
| `src/styles/pixel.ttf` | Byte-identicalupstream; fontmetadata BeijingFounderElectronicsCoLtd2006–2008, familyFZXS15/方正像素15 | Permissivelicense не найдена; sourcecodeMIT не доказывает права на font | **UNCLEAR rights.** Только legacybase.css; не productionreachable, не emitted в dist. Неудалён/неподключён |

CC0 освобождает от обязательной attribution в рамках этого инструмента; original OGA page прямо допускает commercial reuse и рекомендует courtesy source link. Это относится к опубликованному tileset. В Stage 0 не проведена независимая юридическая проверка каждого автора/всех 1311 inherited filenames, поэтому «все файлы автоматически очищены» не утверждается.

CC BY3.0 требует credit, license link и указание adaptation. Унаследованный logo имел brown background в gameSVG относительно чёрного originalSVG; path unchanged. Это происхождение удалось установить, а не оставлено UNKNOWN. Credits даны в`public/ATTRIBUTION.txt` и`public/THIRD_PARTY_NOTICES.txt`; обязательный текст лицензии допускается предоставить URL. При дальнейшем распространении credits должны оставаться доступными вместе с продуктом; новый визуальный redesign не требуется.

## Реально bundled packages

| Package | Locked installed version | License |
| --- | --- | --- |
| `@intlify/core-base` |9.14.5|MIT|
| `@intlify/message-compiler` |9.14.5|MIT|
| `@intlify/shared` |9.14.5|MIT|
| `@unocss/reset` |0.58.9|MIT|
| `@vue/reactivity` |3.5.43|MIT|
| `@vue/runtime-core` |3.5.43|MIT|
| `@vue/runtime-dom` |3.5.43|MIT|
| `@vue/shared` |3.5.43|MIT|
| `@vueuse/core` |10.11.1|MIT|
| `@vueuse/shared` |10.11.1|MIT|
| `vue-i18n` |9.14.5|MIT|
| `vue-router` |4.6.4|MIT|

Vue3 entry приводит к этим runtime modules; compiler/SFC tooling не является дополнительным browser runtime в этом graph. Chalk/commitizen/gh-pages/buildplugins из package.json не означают, что их код отправляется игроку. Iconcollection license проверяется отдельно от MIT Iconify/UnoCSS tooling.

Lockfile metadata просмотрена также для build-only dependencies: типичные MIT/ISC/BSD/Apache; есть data-onlyCC BY licenses (`caniuse-lite`, SPDXexceptiondata) и старый nestedjsesc без package license field. Они не найденны в browserchunkgraph. Это review текущего distributable, не exhaustive legalcertificate всей node_modules/source redistribution. При поставке полного vendored dependency tree его собственные LICENSE/NOTICE должны сохраниться.

## Primary sources и воспроизведение

- [Auto Monster repository](https://github.com/SmallTeddy/auto-monster), rootMITlicense; upstreamcommit указан выше.
- [Dungeon Crawl32×32 tiles / OpenGameArt](https://opengameart.org/content/dungeon-crawl-32x32-tiles), maintainerChrisHamons, CC0 и courtesy notice.
- [CC0 official terms](https://creativecommons.org/publicdomain/zero/1.0/).
- [Shark bite / Delapouite](https://game-icons.net/1x1/delapouite/shark-bite.html), CC BY3.0; [official terms](https://creativecommons.org/licenses/by/3.0/).
- [Game-icons source at inspected commit](https://github.com/game-icons/icons/tree/82d948812bfe3f269ef8f731dcdb07b08160edc4), `delapouite/shark-bite.svg`, `license.txt`.
- [Pictogrammers licensing](https://pictogrammers.com/docs/general/license/), [MaterialDesign LICENSE](https://github.com/Templarian/MaterialDesign/blob/master/LICENSE), [Apache2.0 terms](https://www.apache.org/licenses/LICENSE-2.0).

Метод assets сравнения: `git ls-files -z src/assets` (важно для nonASCII filenames), SHA256 current/upstreamfiles по относительным путям. SVG matching: XML paths, longestpath, whitespace-normalized exact string across official icons repo. Никакое изображение не генерировалось/перерисовывалось для сравнения. Font metadata прочитана из name table существующего TTF. Полное lineage baseline самого adaptation не доказано одним upstreamHEAD: confirmed identical files и rootlicense не означают подтверждённую merge ancestry всей новой game logic.

Практический результат: MIT foundation/runtime и CC0 declared tileset совместимы с commercial use на их terms; CC BYlogo и Apacheicons требуют notices; **unusedFounderfont не очищен**. Stage 0 сохраняет font в source, подтверждает его отсутствие в production и оставляет решение о дальнейшей source redistribution на отдельный этап.
