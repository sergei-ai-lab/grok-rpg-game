# Stage 1 — Trust / Integrity Contract

Status: implementation branch `stage1/trust-integrity`.
Frozen implementation baseline: `a8c4f0c90c091ce8156872a4266eb6d644869c7f`.
Stage 0 frozen historical baseline remains `2931ea69bfbf653c105f145520d41747c85f4f07`.

## Goal

Keep the existing playable loop and make every visible action trustworthy before Stage 2 redesigns collection/progression.

## In scope

- Legacy Tower ends safely at floor 40; no empty 41–44 or crash at 45.
- Exact encounter/reward state survives reload so reload cannot heal, reset cooldown, or pay the same encounter twice.
- Delete/summon confirmations require an explicit player choice; no automatic confirmation.
- Reward/boon screens never auto-advance.
- Opening gameplay panels or hero info pauses combat; backgrounding pauses the local battle loop.
- Active damage uses the same shield pipeline as normal damage.
- Lifesteal/healing use actual dealt/restored values and respect healing reduction.
- Hero info includes Bond multiplier used by battle.
- Dungeon reward receipt reports all stone entries.
- Dungeon egg species unlocks its Bond immediately.
- Permanent slot enhancement cannot be carried away and monetized on sold/salvaged gear.
- Known misleading spend paths are closed/hidden for Stage 1: pet rarity upgrade, pet market offers, rare-hunt refresh, paid daily refresh, paid stamina refill, realm sweep.
- Old saves get defensive defaults instead of crashing on missing nested fields.
- RU/EN describe the same rules.
- Home visibly identifies the Stage 1 build.

## Explicitly deferred

No Stage 2 collection redesign. No Flight-3 migration. No Account 1–50 migration. No post-cap Essence. No new summon economy. No elemental counters. No Tower-10 roguelike redesign. No new art/animation/3D.

## Automated acceptance

Canonical check remains:

`npm ci -> npm run typecheck -> npm test -> npm run build -> npm run verify:bundle`

Tests must cover:

- floor-40 boundary;
- shield/heal/lifesteal consistency;
- no-value spend paths blocked;
- slot-enhancement resale exploit closed;
- full realm receipt;
- immediate egg Bond unlock;
- exact run-state reload;
- no duplicate payout after reward reload;
- safe sparse-save migration;
- no auto-confirm;
- visible UI contract (no auto reward/boon transition and hidden spend paths).

## Owner iPhone acceptance before merge

On the Stage 1 playable build:

1. Start a fight, open Hero info and gameplay panels: combat must not advance.
2. Background Safari and return: battle must be paused, not silently progressed.
3. Close/reopen mid-fight: HP, round and skill cooldown resume without free heal.
4. Win, close/reopen on reward: no second payout.
5. Reward and boon screens wait indefinitely for explicit choice.
6. Cancel Delete Save and wait: save remains.
7. Summon shows cost/rules before spend and only spends after explicit confirmation.
8. Floor-39 fixture can finish floor 40 and cannot enter a broken 41.
9. Swap/sell gear with an enhanced slot: sold item cannot carry slot bonus value.
10. Check RU and EN for the same rules/receipts.

Stage 1 is not accepted merely because CI is green. Real iPhone Safari remains the final owner-device gate.
