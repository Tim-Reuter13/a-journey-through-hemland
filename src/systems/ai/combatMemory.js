// Combat 2.0 — what one person has seen of how the wanderer fights (docs/COMBAT_2.md, Phase 4).
// Only what they saw themselves (combat.js feeds events from fights in their sight); counts fade (TAU), so an
// old habit is forgotten and a changed style is noticed; certainty grows with what was seen, so a guess on two
// blows is a weak guess. Pure: tests/combatAi.test.js.

export const TAU = 30;
const KINDS = ['attacks', 'heavy', 'parries', 'blocks', 'hitsTaken', 'whiffs', 'guardTime', 'watchTime', 'charged'];
export function createCombatMemory() {
  const n = Object.fromEntries(KINDS.map(k => [k, 0]));
  return { t: 0, n, openers: {}, lastAttack: -9, gap: 0, gapN: 0, seen: 0 };
}
function decay(m, t) {
  if (t <= m.t) return;
  const k = Math.exp(-(t - m.t) / TAU);
  for (const key of KINDS) m.n[key] *= k;
  for (const key in m.openers) m.openers[key] *= k;
  m.seen *= k; m.t = t;
}
/** kind: 'attack' ({ key, heavy }), 'charged', 'whiff', 'parried' (the wanderer parried one of us), 'blocked',
 *  'tookHit' (one of us struck the wanderer), 'watch' ({ dt, guard }) */
export function observe(m, kind, t, data = {}) {
  decay(m, t);
  switch (kind) {
    case 'attack':
      m.n.attacks++; m.seen++;
      if (data.heavy) m.n.heavy++;
      if (data.key) m.openers[data.key] = (m.openers[data.key] || 0) + 1;
      if (t - m.lastAttack < 6) { m.gap = (m.gap * m.gapN + (t - m.lastAttack)) / (m.gapN + 1); m.gapN = Math.min(8, m.gapN + 1); }
      m.lastAttack = t; break;
    case 'charged': m.n.charged++; m.n.heavy++; break;
    case 'whiff': m.n.whiffs++; m.seen += .5; break;
    case 'parried': m.n.parries++; m.seen++; break;
    case 'blocked': m.n.blocks++; m.seen++; break;
    case 'tookHit': m.n.hitsTaken++; m.seen++; break;
    case 'watch': m.n.watchTime += data.dt || 0; if (data.guard) m.n.guardTime += data.dt || 0; break;
  }
}
/** What the habits look like now: rates 0–1, attacks per 10 s, how sure the guess is. */
export function readMemory(m, t) {
  decay(m, t);
  const n = m.n, defended = n.parries + n.blocks + n.hitsTaken;
  let favourite = null, best = 0; for (const [k, v] of Object.entries(m.openers)) if (v > best) { best = v; favourite = k; }
  return {
    rate: n.watchTime > 1 ? n.attacks / n.watchTime * 10 : 0,
    parry: defended > .5 ? n.parries / defended : 0,
    block: defended > .5 ? n.blocks / defended : 0,
    open: defended > .5 ? n.hitsTaken / defended : 0,
    whiff: n.attacks > .5 ? Math.min(1, n.whiffs / n.attacks) : 0,
    heavy: n.attacks > .5 ? Math.min(1, n.heavy / n.attacks) : 0,
    guarding: n.watchTime > 1 ? n.guardTime / n.watchTime : 0,
    rhythm: m.gapN ? m.gap : null,
    favourite,
    certainty: 1 - Math.exp(-m.seen / 4),
  };
}
