/** Kit balance. Same clock and bot as flock/balance.mjs, with per-dragon skills. */
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
const STYLE = { kaelith: "burst", verdraxis: "bulwark", aurelune: "mend", ashmaw: "burn", pyrestone: "shell", scorchlane: "flurry" };
const stageFor = (level) => (level >= 10 ? 3 : level >= 5 ? 2 : 1);
const xpNeed = (level) => (level >= 10 ? 0 : 30 + level * 10);
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
  else if (target.shell) { dealt = Math.max(1, Math.round(amount * 0.7)); target.shell = false; }
  target.hp = Math.max(0, target.hp - dealt);
}
function heal(target, amount) { const b = target.hp; target.hp = Math.min(target.max, target.hp + amount); return target.hp - b; }
function skill(actor, target, allies, foes) {
  actor.cd = 2;
  const amp = 1 + (stageFor(actor.level) - 1) * 0.12;
  const power = strike(actor.rune, actor.level) * amp;
  const style = STYLE[actor.id];
  if (style === "burst") hit(target, roll(power * 2.05));
  else if (style === "bulwark") { hit(target, roll(Math.max(4, power * 0.75))); actor.shield = true; }
  else if (style === "mend") {
    heal(actor, Math.round(actor.max * 0.28));
    const other = allies.filter((a) => a !== actor && a.hp > 0 && a.hp < a.max).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (other) heal(other, Math.round(actor.max * 0.14));
    hit(target, roll(Math.max(3, power * 0.4)));
  } else if (style === "burn") {
    hit(target, roll(power * 0.7));
    target.burn = Math.max(2, Math.round(power * 0.26));
    target.burnLeft = 2;
  } else if (style === "shell") {
    hit(target, roll(power * 0.85));
    actor.shell = true;
  } else if (style === "flurry") {
    hit(target, roll(power * 0.62));
    if (target.hp > 0) hit(target, roll(power * 0.62));
  } else if (style === "frost") {
    hit(target, roll(power * 0.75));
    target.frozen = 1;
  } else if (style === "arc") {
    hit(target, roll(power * 0.95));
    const next = foes.filter((f) => f !== target && f.hp > 0)[0];
    if (next) hit(next, roll(power * 0.45));
  } else {
    const before = target.hp;
    hit(target, roll(power * 1.15));
    heal(actor, Math.round((before - target.hp) * 0.5));
  }
}
function attack(actor, target) {
  hit(target, roll(strike(actor.rune, actor.level)));
  if (actor.cd > 0) actor.cd -= 1;
}
function ticks(list) {
  for (const f of list) {
    if (f.hp > 0 && f.burnLeft > 0) { hit(f, f.burn); f.burnLeft -= 1; }
  }
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
function choose(actor, allies, smart) {
  const bench = allies.filter((a) => a !== actor && a.hp > 0 && (smart ? a.hp > actor.hp : a.hp / a.max > actor.hp / actor.max + 0.12));
  if (actor.hp / actor.max < (smart ? 0.34 : 0.38) && bench.length) return "switch";
  if (actor.cd > 0) return "attack";
  return "skill";
}
function fighter(id, level, boss, mul) {
  const rune = RUNE[id];
  const max = Math.round(maxHp(rune, level) * Number(process.env.HP || 1) * (boss ? mul : 1));
  return { id, rune, level, hp: max, max, cd: 0, shield: false, shell: false, burn: 0, burnLeft: 0, frozen: 0 };
}
function sideAct(actor, allies, foes, kind) {
  if (actor.frozen > 0) { actor.frozen = 0; return; }
  if (kind === "switch") { doSwitch(allies); return; }
  const target = frontOf(foes);
  if (!target) return;
  if (kind === "skill") skill(actor, target, allies, foes);
  else attack(actor, target);
}
function fight(index, squad, mul) {
  const boss = index === 9;
  const level = boss ? 10 : 1 + Math.floor(index * 0.75);
  let n = 0;
  const you = squad.map((d) => fighter(d.id, d.level, false, mul));
  const foe = WAVES[index].map((id) => fighter(id, level, boss && n++ === 0, mul));
  let actions = 0;
  let seconds = 0;
  for (let guard = 0; guard < 90; guard += 1) {
    ticks(you);
    const a = frontOf(you);
    if (!a || !frontOf(foe)) break;
    const kind = a.frozen > 0 ? "freeze" : choose(a, you, false);
    actions += 1;
    seconds += 8.6 + 1.28;
    if (kind !== "freeze") sideAct(a, you, foe, kind);
    else a.frozen = 0;
    if (!frontOf(foe)) return { won: true, seconds };
    ticks(foe);
    const fa = frontOf(foe);
    if (!fa || !frontOf(you)) return { won: !fa, seconds };
    const fk = fa.frozen > 0 ? "freeze" : choose(fa, foe, true);
    if (fk === "freeze") fa.frozen = 0;
    else sideAct(fa, foe, you, fk);
    if (!frontOf(you)) return { won: false, seconds };
  }
  return { won: false, seconds };
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
function campaign(mul) {
  const squad = [{ id: "kaelith", level: 1, xp: 0 }, { id: "verdraxis", level: 1, xp: 0 }, { id: "aurelune", level: 1, xp: 0 }];
  const attempts = Array.from({ length: 10 }, () => ({ w: 0, l: 0 }));
  let seconds = 96, wins = 0, firstEvoFight = null;
  while (wins < 10) {
    let won = false;
    for (let t = 0; t < 8 && !won; t += 1) {
      const result = fight(wins, squad, mul);
      seconds += result.seconds;
      if (!result.won) { attempts[wins].l += 1; seconds += 10; continue; }
      attempts[wins].w += 1;
      won = true;
      const amount = 48 + wins * 4 + (wins === 0 || Math.random() < 0.42 ? 36 : 0);
      const gained = grantXp(squad[0].level, squad[0].xp, amount);
      squad[0].level = gained.level; squad[0].xp = gained.xp;
      seconds += 11 + (gained.evo ? 7 : 0);
      if (gained.evo && firstEvoFight == null) firstEvoFight = wins + 1;
      wins += 1;
    }
    if (!won) break;
  }
  return { wins, seconds, firstEvoFight, attempts };
}
function summarize(mul) {
  const runs = Array.from({ length: 1000 }, () => campaign(mul));
  const rate = (i) => {
    let w = 0, t = 0;
    for (const run of runs) { w += run.attempts[i].w; t += run.attempts[i].w + run.attempts[i].l; }
    return t ? Math.round(w / t * 1000) / 10 : 0;
  };
  const mins = runs.map((r) => r.seconds / 60).sort((a, b) => a - b);
  const at = (q) => Math.round(mins[Math.min(runs.length - 1, Math.floor(runs.length * q))] * 10) / 10;
  const pct = (n) => Math.round(n / runs.length * 1000) / 10;
  const mean = Math.round(mins.reduce((s, n) => s + n, 0) / mins.length * 10) / 10;
  return {
    runs: runs.length,
    mul,
    rates: Array.from({ length: 10 }, (_, i) => rate(i)),
    cleared: pct(runs.filter((r) => r.wins === 10).length),
    evoBefore5: pct(runs.filter((r) => r.firstEvoFight != null && r.firstEvoFight < 5).length),
    minutes: { p10: at(0.1), p50: at(0.5), p90: at(0.9), mean },
  };
}
const before = summarize(1.52);
console.log(JSON.stringify({ label: "before-and-after-unchanged", ...before }, null, 2));
