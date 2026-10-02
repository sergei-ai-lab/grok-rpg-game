# Minimum regression protection

`npm test`: **43 tests, 43 pass, 0 fail, 0 skipped, 0 todo** на финальной локальной проверке. Точный опубликованный commit и CI job/log указаны в PR. Новых packages/framework нет.

## Как тестируется actual game

`scripts/run-tests.mjs` собирает `tests/subject.ts` существующим Vite во временный ES module, затем запускает Node `--test`. Subject экспортирует реальные store, locale, data и engines; формулы не скопированы в mocks. Temporary outputs удаляются в finally и игнорируются git.

`tests/helpers.mjs` предоставляет memoryStorage через поддерживаемый VueUse SSR storage adapter и fresh module instance на каждый case. Serialization/deepwatch выполняет реальный VueUse/Vue serializer; flush использует nextTick. Контролируются storage среда, RNG и clock в нужных случаях. Toast timers unref, чтобы они не задерживали exit.

В deterministic reward fixtures противники могут быть отмечены defeated через helper `forceVictory`, после чего settlement выполняет реальный `battleTick`. Это проверка выплат, не combat difficulty. Отдельные battle tests действительно вызывают `stepRound/castHeroSkill` и проверяют HP/shield/cooldown; simulator отдельно выполняет реальные rounds.

## Покрытие обязательных систем

| File / tests | Сценарии | Что защищает |
| --- | --- | --- |
| `progression.test.mjs` / 7 | Полная ladder 1,2,2,3,3,4,4,5,6; rank cap 10; недостаточно copies; summon unlock/duplicate/cost; XP carry/cap 999; training limit; deployed pet XP/Flight cap 5; lead bond stats/shared XP | Progression values и полезные actions |
| `save.test.mjs` / 4 | JSON roundtrip существующего профиля и RU/EN; supported older fields; idempotent stone migration; invalid language fallback; empty/bad JSON; explicit delete; continue floor/full HP | Текущий save и конкретный older-save contract |
| `battle.test.mjs` / 8 | Win/loss в deterministic rounds; lead death с живыми pets; basic shield/regen; burst/AoE/cooldown; heal reduction duration; crit/double/LS; boss/wave generation; active kill reward once; defeat no reward | Damage/status/reward paths |
| `rewards.test.mjs` / 6 | Tower gold/XP/lead copy/extra; guaranteed boss gear; boon gate/permanence; loot branches; realm level/stamina gate/clear/sweep; все stone entries; quest claim once/refresh; stamina regen/buy | Начисления и costs |
| `inventory.test.mjs` / 7 | Equip/swap/enhance inheritance; sell/salvage once; enhance fail/success/cap/cost; rarity upgrade cost/+5 loss; stack/capacity/full bag auto-sale/unequip; auto-recycle priority/replacement; shop purchase once/full bag/no funds | Item/resource ownership |
| `known-behavior.test.mjs` / 8 | Floor 45 blocker; pet rarity no effect; shop rarity discard/no quest; skill shield bypass/125% heal; capped copies; profile XP achievements; stone popup; egg bond reload | Установленные baseline bugs |
| `economy-loops.test.mjs` / 3 | Repeat floor 1 до rank 10; profitable daily refresh; repeated +99 slot buy/equip/sell/refresh | Воспроизводимые economy findings |

Counts: 7+4+8+6+7+8+3=43. Ни один case не skip/todo; blanket coverage target отсутствует. Особенно защищены точные copy costs/max rank и successful/failed resource transactions.

## Characterization не утверждает желаемый дизайн

Названия `AUDIT BUG`, `AUDIT BLOCKER`, `AUDIT LIMIT`, `AUDIT ECONOMY` явно отделяют существующий behavior от правильного design. Например, тест floor 45 проходит **потому что подтверждает throw**, а не потому что поздняя башня исправлена. Когда владелец утвердит соответствующий Stage 1 fix, этот case надо перевести в expected correct behavior в том же PR. Сохранять throw/ineffective upgrade ради GREEN противоречит назначению этих tests.

Older migration fixture удаляет только поля, которые baseline уже явно мигрирует, сохраняя daily/pets и прочую структуру. Тест не выдаёт partial schema за поддержку любых исторических/legacy IndexedDB saves. Unknown shapes и данные реальных пользователей нельзя молча обнулять в следующих этапах.

`audit:simulate` — отдельный experiment, не expensive CI gate; JSON/CSV включены для review. Browser smoke — проведённая проверка четырёх конфигураций, не новый browser framework в game dependencies. Standard CI остаётся install → typecheck → 43 tests → build → bundle.
