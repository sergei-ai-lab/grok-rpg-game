/** 1000 simple-bot campaigns. `node balance.mjs`
 * Clock: 8s to read the turn and tap, plus the game's own waits,
 * 5s on the reward, 7s on an evolution, 6s in the den, 4s after a loss,
 * and 90s once for choosing and naming the hatchling.
 * The bot skills when it can, and switches when the front is low.
 * Only the named dragon (Kaelith) gains XP. The other two stay level 1.
 */
const WAVES = [
  ["ashmaw"],
  ["ashmaw", "ashmaw"],
  ["ashmaw", "pyrestone"],
  ["pyrestone", "pyrestone"],
  ["pyrestone", "scorchlane"],
  ["scorchlane", "ashmaw"],
  ["scorchlane", "pyrestone", "ashmaw"],
  ["pyrestone", "scorchlane"],
  ["scorchlane", "scorchlane"],
  ["scorchlane"],
];
const RUNE = { kaelith: "fury", verdraxis: "ward", aurelune: "life", ashmaw: "fury", pyrestone: "ward", scorchlane: "fury" };

function stageFor(level) { return level >= 10 ? 3 : level >= 5 ? 2 : 1; }
function xpNeed(level) { return level >= 10 ? 0 : 30 + level * 10; }
function maxHp(rune, level) {
  const stage = stageFor(level);
  const base = { fury: 74, ward: 116, life: 92 }[rune];
  const growth = { fury: 6, ward: 10, life: 7 }[rune];
  const bloom = { fury: 8, ward: 14, life: 10 }[rune];
  return base + (level - 1) * growth + (stage - 1) * bloom;
}
function strike(rune, level) {
  const stage = stageFor(level);
  const base = { fury: 18, ward: 11, life: 13 }[rune];
  const growth = { fury: 2, ward: 1, life: 1 }[rune];
  const bloom = { fury: 6, ward: 3, life: 4 }[rune];
  return base + (level - 1) * growth + (stage - 1) * bloom;
}
const roll = (amount) => Math.max(1, Math.round(amount * (0.9 + Math.random() * 0.22)));
function hit(target, amount) {
  let dealt = amount;
  if (target.shield) { dealt = Math.max(1, Math.round(amount * 0.42)); target.shield = false; }
  target.hp = Math.max(0, target.hp - dealt);
}
function heal(target, amount) { target.hp = Math.min(target.max, target.hp + amount); }
function actOn(actor, target, allies, kind) {
  if (kind === "skill" && actor.cd > 0) kind = "attack";
  if (kind === "skill") {
    actor.cd = 2;
    const power = strike(actor.rune, actor.level);
    if (actor.rune === "fury") hit(target, roll(Math.round(power * 2.15)));
    else if (actor.rune === "ward") { hit(target, roll(Math.max(4, Math.round(power * 0.8)))); actor.shield = true; }
    else {
      heal(actor, Math.round(actor.max * 0.34));
      const other = allies.filter((a) => a !== actor && a.hp > 0 && a.hp < a.max).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
      if (other) heal(other, Math.round(actor.max * 0.16));
      hit(target, roll(Math.max(3, Math.round(power * 0.45))));
    }
    return;
  }
  hit(target, roll(strike(actor.rune, actor.level)));
  if (actor.cd > 0) actor.cd -= 1;
}
function grantXp(level, xp, amount) {
  let lv = level, cur = xp, left = amount, evo = false;
  while (left > 0 && lv < 10) {
    const need = xpNeed(lv);
    if (cur + left < need) { cur += left; break; }
    left -= need - cur;
    const before = stageFor(lv);
    lv += 1; cur = 0;
    if (stageFor(lv) !== before) evo = true;
  }
  if (lv >= 10) { lv = 10; cur = 0; }
  return { level: lv, xp: cur, evo };
}
const frontOf = (list) => list.find((f) => f.hp > 0) || null;
function doSwitch(list) {
  const front = frontOf(list);
  const others = list.filter((f) => f !== front && f.hp > 0);
  if (!front || !others.length) return false;
  list.splice(list.indexOf(front), 1);
  list.push(front);
  return true;
}
function chooseFoe(actor, list) {
  const others = list.filter((f) => f !== actor && f.hp > actor.hp);
  if (actor.hp / actor.max < 0.34 && others.length) return "switch";
  if (actor.cd > 0) return "attack";
  if (actor.rune === "life" && actor.hp / actor.max < 0.75) return "skill";
  if (actor.rune === "ward" && !actor.shield) return "skill";
  if (actor.rune === "fury") return "skill";
  return "attack";
}
function chooseYou(actor, allies) {
  const bench = allies.filter((a) => a !== actor && a.hp > 0);
  if (actor.hp / actor.max < 0.38 && bench.some((b) => b.hp / b.max > actor.hp / actor.max + 0.12)) return "switch";
  if (actor.cd <= 0) return "skill";
  return "attack";
}
function fighter(id, level, boss, bossMul) {
  const rune = RUNE[id];
  const max = Math.round(maxHp(rune, level) * (boss ? bossMul : 1));
  return { id, rune, level, hp: max, max, cd: 0, shield: false };
}
function fight(index, squad, bossMul) {
  const boss = index === 9;
  const level = boss ? 10 : 1 + Math.floor(index * 0.75);
  let n = 0;
  const you = squad.map((d) => fighter(d.id, d.level, false, bossMul));
  const foe = WAVES[index].map((id) => fighter(id, level, boss && n++ === 0, bossMul));
  let actions = 0;
  let seconds = 0;
  for (let guard = 0; guard < 80; guard += 1) {
    const a = frontOf(you);
    if (!a || !frontOf(foe)) break;
    const kind = chooseYou(a, you);
    actions += 1;
    seconds += 8 + (kind === "switch" ? 0.6 : 1.28);
    if (kind === "switch") doSwitch(you);
    else actOn(a, frontOf(foe), you, kind);
    if (!frontOf(foe)) return { won: true, actions, seconds };
    const fa = frontOf(foe);
    const fk = chooseFoe(fa, foe);
    if (fk === "switch") { doSwitch(foe); seconds += 1.08; }
    else actOn(fa, frontOf(you), foe, fk);
    if (!frontOf(you)) return { won: false, actions, seconds };
  }
  return { won: false, actions, seconds };
}
function campaign(bossMul) {
  const squad = [
    { id: "kaelith", level: 1, xp: 0 },
    { id: "verdraxis", level: 1, xp: 0 },
    { id: "aurelune", level: 1, xp: 0 },
  ];
  const attempts = Array.from({ length: 10 }, () => ({ w: 0, l: 0 }));
  let seconds = 90 + 6;
  let wins = 0;
  let firstEvoFight = null;
  while (wins < 10) {
    let won = false;
    for (let tryN = 0; tryN < 8 && !won; tryN += 1) {
      const result = fight(wins, squad, bossMul);
      seconds += result.seconds;
      if (!result.won) { attempts[wins].l += 1; seconds += 4 + 6; continue; }
      attempts[wins].w += 1;
      won = true;
      const amount = 48 + wins * 4 + (wins === 0 || Math.random() < 0.42 ? 36 : 0);
      const gained = grantXp(squad[0].level, squad[0].xp, amount);
      squad[0].level = gained.level;
      squad[0].xp = gained.xp;
      seconds += 5 + 6 + (gained.evo ? 7 : 0);
      if (gained.evo && firstEvoFight == null) firstEvoFight = wins + 1;
      wins += 1;
    }
    if (!won) break;
  }
  return { wins, seconds, firstEvoFight, attempts };
}
function summarize(bossMul) {
  const runs = Array.from({ length: 1000 }, () => campaign(bossMul));
  const rate = (i) => {
    let w = 0, t = 0;
    for (const run of runs) { w += run.attempts[i].w; t += run.attempts[i].w + run.attempts[i].l; }
    return t ? Math.round(w / t * 1000) / 10 : 0;
  };
  const mins = runs.map((r) => r.seconds / 60).sort((a, b) => a - b);
  const pct = (n) => Math.round(n / 10);
  return {
    bossMul,
    first3: [0, 1, 2].map(rate),
    rates: Array.from({ length: 10 }, (_, i) => rate(i)),
    boss: rate(9),
    cleared: pct(runs.filter((r) => r.wins === 10).length),
    evoBeforeFight5: pct(runs.filter((r) => r.firstEvoFight != null && r.firstEvoFight < 5).length),
    minutes: {
      p10: Math.round(mins[100] * 10) / 10,
      p50: Math.round(mins[500] * 10) / 10,
      p90: Math.round(mins[900] * 10) / 10,
    },
  };
}
console.log(JSON.stringify({ before: summarize(1.65), after: summarize(1.18) }, null, 2));
