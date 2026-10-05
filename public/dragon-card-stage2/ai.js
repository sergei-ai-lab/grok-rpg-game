// Decisions use only visible battle information and the same legal act() path.
// No stat bonuses, hidden rolls, reserve targeting or extra actions for the AI.
import { act, legalActions, attackDamage, resource, ATTACKS } from './match.js?v=5c6e62ac7cc8';

const copy = m => ({ ...m, log: [], players: m.players.map(p => ({ ...p, field: p.field.map(d => ({ ...d })), hand: p.hand.map(d => ({ ...d })) })) });
const key = m => m.players.map(p => `${p.charge}/${+p.attached}/${+p.switched}/${+p.fusionUsed}:` + p.field.map(d => `${d.uid},${d.hp},${d.energy},${d.charge},${+d.fused}`).join(';') + '/' + p.hand.map(d => d.uid).join(',')).join('|');

function threat(m, side, defender) {
  const p = m.players[side];
  if (!defender || !p.field[0]) return 0;
  let worst = 0;
  for (let i = 0; i < p.field.length; i++) {
    if (i && resource(m, side) < 1) continue;
    const attacker = p.field[i];
    let available = resource(m, side, attacker) - (i && m.mode === 'charge' ? 1 : 0);
    if (m.mode === 'energy' && !p.attached) available = Math.min(4, available + 1);
    for (const [type, spec] of Object.entries(ATTACKS)) if (spec.cost <= available) worst = Math.max(worst, attackDamage(attacker, defender, type));
  }
  return worst;
}

function position(m, side) {
  if (m.winner !== null) return m.winner === side ? 100000 : -100000;
  const value = which => {
    const p = m.players[which];
    let total = (p.field.length + p.hand.length) * 45;
    for (const d of [...p.field, ...p.hand]) total += d.hp + d.damage * 1.5 + d.guard * 2 + d.heal * 2;
    total += resource(m, which) * 4;
    if (m.mode !== 'charge') total += p.field.slice(1).reduce((sum, d) => sum + resource(m, which, d), 0) * 2;
    return total;
  };
  return value(side) - value(1 - side);
}

function score(before, after, side, path, cautious = true) {
  if (after.winner !== null) return after.winner === side ? 100000 - path.length : -100000;
  const p = after.players[side], a = p.field[0];
  let value = position(after, side);
  // Evaluate the front's real attack/guard/healing role, not just its HP.
  value += a.damage * 1.2 + a.guard * 2 + a.heal * 2;
  value += p.field.length * 2;
  if (cautious) {
    const incoming = threat(after, 1 - side, a);
    value -= Math.min(a.hp, incoming);
    if (a.hp <= incoming) value -= 90 + a.damage * 1.5;
  }
  return value - path.length * .5;
}

function plans(m, limit, cautious) {
  const side = m.actor, queue = [{ state: m, path: [] }], seen = new Set([key(m)]), results = [];
  for (let cursor = 0; cursor < queue.length && cursor < limit; cursor++) {
    const { state, path } = queue[cursor];
    for (const action of legalActions(state)) {
      const next = copy(state); act(next, action);
      const steps = [...path, action];
      if (action.type === 'attack') results.push({ state: next, path: steps, score: score(m, next, side, steps, cautious) });
      else if (path.length < 4 && queue.length < limit) {
        const signature = key(next);
        if (!seen.has(signature)) { seen.add(signature); queue.push({ state: next, path: steps }); }
      }
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

function easy(m) {
  const actions = legalActions(m), p = m.players[m.actor], a = p.field[0], target = m.players[1 - m.actor].field[0];
  // Even Easy recognizes a knockout and spends the smallest possible cost.
  const lethal = actions.find(x => x.type === 'attack' && attackDamage(a, target, x.attack) >= target.hp);
  if (lethal) return lethal;
  const deploy = actions.find(x => x.type === 'deploy'); if (deploy) return deploy;
  const attach = actions.find(x => x.type === 'attach' && x.index === 0); if (attach) return attach;
  const swap = actions.filter(x => x.type === 'switch').sort((x, y) => p.field[y.index].hp - p.field[x.index].hp)[0];
  if (swap && a.hp < a.maxHp * .25 && p.field[swap.index].hp > a.hp + 35) return swap;
  const fusion = actions.filter(x => x.type === 'fuse').sort((x, y) => p.field[x.index].hp - p.field[y.index].hp)[0];
  if (fusion && a.hp < a.maxHp * .4 && p.field[fusion.index].hp < p.field[fusion.index].maxHp * .6) return fusion;
  const attacks = actions.filter(x => x.type === 'attack');
  // Easy has a simple budget: use Breath at 2, save Ultimate for a full bar.
  // The lethal check above still allows any affordable finishing attack.
  return resource(m) === 4 ? attacks.at(-1) : resource(m) === 2 ? attacks.find(x => x.attack === 'power') : attacks.find(x => x.attack === 'strike');
}

export function chooseBattleAI(m, difficulty = 'normal') {
  if (m.winner !== null) return undefined;
  if (difficulty === 'easy') return easy(m);
  const candidates = plans(m, difficulty === 'hard' ? 56 : 32, true);
  if (difficulty === 'hard') {
    // Evaluate the opponent's strongest legal reply for the best six plans.
    // Fixed limits keep the search small enough for a phone.
    for (const candidate of candidates.slice(0, 6)) {
      if (candidate.state.winner !== null) continue;
      const replies = plans(candidate.state, 20, true);
      if (replies.length) candidate.score = Math.min(...replies.map(reply => {
        if (reply.state.winner !== null) return position(reply.state, m.actor);
        const front = reply.state.players[m.actor].field[0], target = reply.state.players[1 - m.actor].field[0];
        const attacks = legalActions(reply.state).filter(a => a.type === 'attack');
        const followup = Math.max(...attacks.map(a => Math.min(target.hp, attackDamage(front, target, a.attack)) + (attackDamage(front, target, a.attack) >= target.hp ? 45 : 0) - ATTACKS[a.attack].cost * 4));
        return position(reply.state, m.actor) + (front.damage * 1.2 + front.guard * 2 + front.heal * 2) + followup * .5 - candidate.path.length * .5;
      }));
    }
    candidates.splice(6); candidates.sort((a, b) => b.score - a.score);
  }
  return candidates[0]?.path[0] || easy(m);
}
