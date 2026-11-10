import { ATTACKS, phaseAt, totalTime } from './combatRules.js';
import { postureRegen } from './damageModel.js';

// Combat 2.0 — one fighter's state (the wanderer and every person who fights), docs/COMBAT_2.md.
// An attack runs prepare → active → recover (or ends interrupted); the guard knows when it went up (parry timing);
// composure (posture 0–1) breaks under blows independent of stamina; each attack has an id, and a body remembers which
// attack ids already struck it (no invulnerability windows).

let nextAttack = 1;
export function createFighter(id, opts = {}) {
  return { id, side: opts.side || 'npc', attack: null, guard: false, guardAt: -9, posture: 1, pressedAt: -9, stagger: 0, broken: 0,
    riposteUntil: -9, struckBy: new Map(), last: null, log: [] };
}
/**
 * Starts an attack. opts: { scale: {prepare, active, recover} multipliers (personality, injuries, fatigue), weapon, pitch }
 * Returns the attack: { id, key, def, weapon, d (phase seconds), t, phase, time (phase time 0–3), prev, pitch, yaw, hits, stopped }.
 */
export function startAttack(f, key, now, opts = {}) {
  const def = ATTACKS[key]; if (!def) return null;
  const s = opts.scale || {};
  const d = { prepare: def.prepare * (s.prepare ?? 1), active: def.active * (s.active ?? 1), recover: def.recover * (s.recover ?? 1) };
  f.attack = { id: nextAttack++, key, def, weapon: opts.weapon, d, t: 0, phase: 'prepare', time: 0, prev: 0, start: now, pitch: opts.pitch ?? 0, yaw: null,
    hits: new Set(), stopped: null, feint: false, total: totalTime(def, s), owner: f.id };
  f.guard = false;
  return f.attack;
}
/** Advances the attack by dt: returns { from, to (phase times), entered (phase name or null) } or null. */
export function stepAttack(f, dt) {
  const a = f.attack; if (!a) return null;
  const was = a.phase, from = a.time;
  a.t += dt; const p = phaseAt(a.d, a.t);
  a.prev = from; a.time = p.time; a.phase = p.phase; a.u = p.u;
  if (a.phase === 'done') f.attack = null;
  return { from, to: p.time, entered: a.phase !== was ? a.phase : null, attack: a };
}
/** Ends an attack early. reason: 'hit' (struck while attacking), 'parried', 'blocked', 'wall', 'feint', 'stagger'. */
export function interrupt(f, reason, now) {
  const a = f.attack; if (!a) return null;
  a.stopped = reason; a.phase = 'interrupted'; f.attack = null; f.last = { key: a.key, reason, at: now };
  return a;
}
/** A blade stopped by a shield, a guard or a wall: it rebounds and the attacker goes straight into the recovery. */
export function rebound(f, reason, now) {
  const a = f.attack; if (!a || a.phase !== 'active') return interrupt(f, reason, now);
  a.stopped = reason; a.t = a.d.prepare + a.d.active; a.time = 2; a.phase = 'recover';
  a.d.recover *= reason === 'parried' ? 1.6 : 1.15;   // thrown off the line: longer to come back
  f.last = { key: a.key, reason, at: now };
  return a;
}
export function setGuard(f, up, now) {
  if (up && !f.guard) f.guardAt = now;
  f.guard = !!up;
}
/** Takes composure; returns true if it broke now. */
export function hurtPosture(f, amount, now) {
  if (amount <= 0) return false;
  f.posture = Math.max(0, f.posture - amount); f.pressedAt = now;
  if (f.posture <= 0 && !(f.broken > 0)) { f.broken = 1.2; f.guard = false; return true; }
  return false;
}
/** Per step: stagger and broken stance run out, composure comes back, old strike records are dropped. */
export function tick(f, dt, now, ctx = {}) {
  f.stagger = Math.max(0, f.stagger - dt);
  if (f.broken > 0) { f.broken -= dt; if (f.broken <= 0) { f.broken = 0; f.posture = Math.max(f.posture, .35); } }
  f.posture = postureRegen(f.posture, dt, { since: now - f.pressedAt, guarding: f.guard, attacking: !!f.attack, stamina: ctx.stamina ?? 1, injured: ctx.injured ?? 0 });
  if (f.struckBy.size > 8) for (const [id, at] of f.struckBy) if (now - at > 3) f.struckBy.delete(id);
}
/** Has this attack already struck this body? Records it if not. */
export function firstStrike(f, attackId, now) {
  if (f.struckBy.has(attackId)) return false;
  f.struckBy.set(attackId, now); return true;
}
export function note(f, line, now) { f.log.push(`${now.toFixed(1)} ${line}`); if (f.log.length > 10) f.log.shift(); }
