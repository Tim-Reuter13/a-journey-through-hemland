// HUMANITY MOTION · layer F, grappling (pure state machine; motion.js does bodies, hands and walls).
// A grip is a real state between two bodies, not a finisher animation. Who holds whom, how firmly,
// and what each side tries changes both of them: a strong body pulling away drags its holder, a weak
// one fights visibly, grips tire and slip, and anyone holding is open to the others. Holding is never
// endless and never makes anyone invulnerable.
export const GRIP = {
  range: 1.35, cone: .55, height: .75, hold: .78, maxHold: 12,
  reach: .22, contact: .14, takedown: .5, release: .25, escape: .3, interrupted: .2, recover: .35,
  decay: .028, drain: 7, struggle: [.45, 1.2], wrench: .17, offBalance: .42, steady: .62, pinnedFor: .8,
};
export const STATES = ['AttemptingGrab', 'ContactEstablished', 'Holding', 'Struggling', 'OffBalance', 'Takedown', 'GroundControl',
  'Releasing', 'Escaping', 'Interrupted', 'Recovering', 'Done'];
const ACTIVE = new Set(['Holding', 'Struggling', 'OffBalance', 'GroundControl']);

/** How strong a body is in a grapple (≈1 for an ordinary person). */
export function gripStrength({ armor = 0, stamina = 1, stability = 1, arms = 0, power = .5, size = 1 } = {}) {
  return size * (1 + armor * .3) * (.55 + .45 * stamina) * (.6 + .4 * stability) * (1 - arms * .4) * (.8 + power * .4);
}

/**
 * Can `h` take hold of `t`? Each is { x, z, y, yaw, busy, handFree, down, dead, held, holding };
 * clear: nothing solid between them. Returns { ok, reason } (reason in German for the HUD).
 */
export function canGrab(h, t, { clear = true } = {}) {
  if (t.dead) return { ok: false, reason: 'tot' };
  if (h.holding || h.held) return { ok: false, reason: 'schon im Griff' };
  if (t.held || t.holding) return { ok: false, reason: 'schon gepackt' };
  if (!h.handFree) return { ok: false, reason: 'keine Hand frei' };
  if (h.busy || h.down) return { ok: false, reason: 'beschäftigt' };
  const dx = t.x - h.x, dz = t.z - h.z, d = Math.hypot(dx, dz);
  if (d > GRIP.range) return { ok: false, reason: 'zu weit' };
  if (Math.abs((t.y ?? 0) - (h.y ?? 0)) > GRIP.height) return { ok: false, reason: 'nicht erreichbar' };
  const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
  if (d > .2 && (dx * fx + dz * fz) / d < GRIP.cone) return { ok: false, reason: 'nicht vor dir' };
  if (!clear) return { ok: false, reason: 'etwas im Weg' };
  return { ok: true, reason: '' };
}

export function createGrapple(holder, target, { holderStrength = 1, targetStrength = 1, from = 'front', now = 0 } = {}) {
  return { holder, target, state: 'AttemptingGrab', t: 0, age: 0, grip: 1, hs: holderStrength, ts: targetStrength, from, pinned: 0, wall: null,
    nextJerk: GRIP.struggle[0], events: [], started: now };
}
export const isActive = g => !!g && ACTIVE.has(g.state);
export const isOver = g => !g || g.state === 'Done';

function go(g, state) { g.state = state; g.t = 0; g.events.push({ type: 'state', state }); }

/**
 * Advances a grapple. input: { holderStamina 0..1, targetStability 0..1, targetWantsFree 0..1 (effort),
 *   shove, pull, takedown, release, interrupt, wrench (target escape attempt, e.g. player key),
 *   distance (current separation), pinned (target back against something solid), rand () → 0..1 }.
 * Returns the events of this step ({ type: 'state' | 'jerk' | 'shove' | 'takedown' | 'escaped' | 'refused' }).
 */
export function stepGrapple(g, dt, input = {}) {
  g.events = [];
  if (g.state === 'Done') return g.events;
  g.t += dt; g.age += dt;
  const rand = input.rand || Math.random, ratio = g.ts / Math.max(.2, g.hs);
  if (input.interrupt && g.state !== 'Releasing' && g.state !== 'Recovering') { go(g, 'Interrupted'); return g.events; }
  switch (g.state) {
    case 'AttemptingGrab':
      if ((input.distance ?? 0) > GRIP.range * 1.25) go(g, 'Interrupted');
      else if (g.t >= GRIP.reach) go(g, 'ContactEstablished');
      return g.events;
    case 'ContactEstablished':
      if (g.t >= GRIP.contact) go(g, 'Holding');
      return g.events;
    case 'Releasing': if (g.t >= GRIP.release) go(g, 'Recovering'); return g.events;
    case 'Escaping': if (g.t >= GRIP.escape) go(g, 'Recovering'); return g.events;
    case 'Interrupted': if (g.t >= GRIP.interrupted) go(g, 'Recovering'); return g.events;
    case 'Recovering': if (g.t >= GRIP.recover) go(g, 'Done'); return g.events;
    case 'Takedown': if (g.t >= GRIP.takedown) go(g, 'GroundControl'); return g.events;
  }
  // Holding, Struggling, OffBalance, GroundControl: the grip lives and tires.
  const stamina = input.holderStamina ?? 1;
  g.grip -= (GRIP.decay + (stamina <= .02 ? .25 : 0)) * dt * (g.state === 'GroundControl' ? .7 : 1);
  g.pinned = input.pinned ? g.pinned + dt : Math.max(0, g.pinned - dt * 2);
  const effort = input.targetWantsFree ?? 0;
  if (effort > .05) {
    if (g.state === 'Holding') go(g, 'Struggling');
    g.nextJerk -= dt;
    if (g.nextJerk <= 0) {
      g.nextJerk = GRIP.struggle[0] + rand() * (GRIP.struggle[1] - GRIP.struggle[0]);
      const loss = GRIP.wrench * ratio * effort * (g.state === 'GroundControl' ? .6 : 1) * (g.pinned > 0 ? .7 : 1);
      g.grip -= loss; g.events.push({ type: 'jerk', strength: loss });
    }
  } else if (g.state === 'Struggling') go(g, 'Holding');
  if (input.wrench) { const loss = .1 * ratio * input.wrench; g.grip -= loss; g.events.push({ type: 'jerk', strength: loss }); }
  if (g.grip <= 0) { go(g, 'Escaping'); g.events.push({ type: 'escaped' }); return g.events; }
  if (g.age > GRIP.maxHold && g.state !== 'GroundControl' || g.age > GRIP.maxHold * 1.5) { go(g, 'Releasing'); return g.events; }
  if (input.release) { go(g, 'Releasing'); return g.events; }
  if (input.shove && g.state !== 'GroundControl') { go(g, 'Releasing'); g.events.push({ type: 'shove', force: 1.7 * Math.sqrt(g.hs / Math.max(.3, g.ts)) + (g.pinned > 0 ? .4 : 0) }); return g.events; }
  const stability = input.targetStability ?? 1;
  if (g.state !== 'GroundControl') {
    if (stability < GRIP.offBalance || g.pinned >= GRIP.pinnedFor) { if (g.state !== 'OffBalance') go(g, 'OffBalance'); }
    else if (g.state === 'OffBalance' && stability > GRIP.steady && g.pinned < GRIP.pinnedFor) go(g, 'Holding');
  }
  if (input.takedown && g.state !== 'GroundControl') {
    if (g.state === 'OffBalance') { go(g, 'Takedown'); g.events.push({ type: 'takedown' }); }
    else { g.grip -= .15; g.events.push({ type: 'refused' }); }
  }
  return g.events;
}
