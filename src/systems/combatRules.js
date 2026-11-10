// Combat rules as data (Combat 2.0, docs/COMBAT_2.md). Pure: no scene, no DOM, so node tests can load it.
// Units are the rigs' own: a person stands about 2.4 tall, the right shoulder at (.43, 1.92, 0), the body faces −Z.

/** Non-melee actions of the wanderer (casting, drinking keep their old single impact). */
export const ACTIONS = { sword: { duration: .68, impact: .29, cost: 12 }, cast: { duration: .85, impact: .34, cost: 20 }, drink: { duration: 1.65, impact: 1.02, cost: 0 } };
export function crossedImpact(previous, next, kind) { return previous < ACTIONS[kind].impact && next >= ACTIONS[kind].impact; }
export function inAttackArc(dx, dz, yaw, range = 3.1, cosine = .45) {
  const distance = Math.hypot(dx, dz);
  return distance <= range && (distance < .01 || (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > cosine);
}

// ── Weapons. length: grip → point; edge: the part that cuts or pierces ([from, to] along the weapon); radius: how
// thick the swept segment is; mass: how much a blow weighs (posture, impulse, stopping on shields); kind: how it wounds.
export const WEAPONS = {
  sword: { id: 'sword', length: 1.4, edge: [.3, 1.4], radius: .05, mass: 1.2, kind: 'cut', cleave: true, guard: .7 },
  spear: { id: 'spear', length: 2.05, edge: [1.45, 2.05], radius: .05, mass: 1.5, kind: 'thrust', cleave: false, guard: .5 },
  axe: { id: 'axe', length: 1.15, edge: [.85, 1.15], radius: .07, mass: 1.9, kind: 'chop', cleave: false, guard: .45 },
  mace: { id: 'mace', length: 1.05, edge: [.75, 1.05], radius: .09, mass: 2.1, kind: 'blunt', cleave: false, guard: .45 },
  unarmed: { id: 'unarmed', length: .12, edge: [0, .12], radius: .1, mass: .6, kind: 'blunt', cleave: false, guard: .2 },
};
/** Per item: the rusty sword is broken short, the guard's blade and the ash blade are full length. */
export const ITEM_WEAPON = {
  rostiges_schwert: { weapon: 'sword', length: 1.26, edge: [.3, 1.26] },
  waechterklinge: { weapon: 'sword', length: 1.44, edge: [.3, 1.44] },
  aschenklinge: { weapon: 'sword', length: 1.44, edge: [.3, 1.44] },
  jagdspeer: { weapon: 'spear', length: 2.1, edge: [1.46, 2.1] },
};
export function weaponFor(item, style) {
  const it = ITEM_WEAPON[item], base = WEAPONS[it?.weapon || style] || WEAPONS.sword;
  return it ? { ...base, length: it.length, edge: it.edge, item } : base;
}

// ── Attacks. Phases (seconds): prepare (wind-up, readable, can be feinted), active (the blade is live), recover (open,
// no guard). The track is the blade itself, in body space: keys at phase time 0–1 prepare, 1–2 active, 2–3 recover,
// each [time, hilt [x, y, z], blade direction [x, y, z]]. Simulation, animation and first person all sample it.
// cost: stamina; damage: × weapon damage; posture: what it takes from a guard or a body; force: push (MOTION);
// lunge: metres the body steps in during prepare → active; anim: [set, key at wind-up end, key at strike end] for the
// animator's body keys (characters/animator.js SWORD / THRUST).
const READY = [.32, 1.38, -.46], READY_DIR = [-.14, .4, -.9];
const SPEAR_READY = [.3, 1.42, -.3], SPEAR_DIR = [-.05, .22, -.97];
export const ATTACKS = {
  // Forehand, right to left at chest height.
  slash_r: { weapon: 'sword', prepare: .26, active: .15, recover: .31, cost: 12, damage: 1, posture: .16, force: 1, lunge: .35, kind: 'cut', anim: [0, .3, .52],
    track: [[0, READY, READY_DIR], [.55, [.5, 1.82, -.2], [.55, .62, .55]], [1, [.62, 1.95, .05], [.62, .42, .66]],
      [1.35, [.55, 1.75, -.55], [.38, .08, -.92]], [1.65, [.14, 1.65, -.68], [-.3, 0, -.95]], [2, [-.3, 1.5, -.5], [-.88, -.05, -.47]],
      [2.45, [-.26, 1.3, -.36], [-.72, -.5, -.1]], [3, READY, READY_DIR]] },
  // Backhand, left to right.
  slash_l: { weapon: 'sword', prepare: .25, active: .15, recover: .3, cost: 12, damage: .95, posture: .15, force: .95, lunge: .3, kind: 'cut', anim: [1, .28, .5],
    track: [[0, READY, READY_DIR], [.55, [.1, 1.8, -.36], [-.42, .6, .68]], [1, [-.05, 1.85, -.2], [-.62, .45, .64]],
      [1.35, [0, 1.72, -.6], [-.4, .05, -.92]], [1.65, [.35, 1.65, -.7], [.35, 0, -.94]], [2, [.65, 1.55, -.45], [.9, -.05, -.43]],
      [2.45, [.6, 1.35, -.25], [.7, -.5, -.1]], [3, READY, READY_DIR]] },
  // Heavy overhead chop (LMB held): slow, readable, takes a guard apart.
  chop: { weapon: 'sword', heavy: true, prepare: .5, active: .15, recover: .44, cost: 22, damage: 1.4, posture: .38, force: 1.9, lunge: .45, kind: 'cut', anim: [2, .36, .55],
    track: [[0, READY, READY_DIR], [.5, [.3, 2.2, -.2], [.05, .9, .4]], [1, [.25, 2.45, 0], [-.05, .55, .83]],
      [1.3, [.22, 2.35, -.3], [0, .9, -.43]], [1.6, [.15, 1.95, -.65], [0, .1, -1]], [2, [.1, 1.4, -.6], [0, -.72, -.7]],
      [2.4, [.1, 1.2, -.5], [0, -.85, -.5]], [3, READY, READY_DIR]] },
  // Spear: straight thrust, high thrust (over a shield), lunge (heavy).
  thrust: { weapon: 'spear', prepare: .28, active: .14, recover: .3, cost: 12, damage: 1, posture: .14, force: 1.1, lunge: .3, kind: 'thrust', anim: [3, .4, .55],
    track: [[0, SPEAR_READY, SPEAR_DIR], [1, [.42, 1.5, .1], [-.08, .12, -.99]], [1.5, [.25, 1.55, -.5], [-.05, .06, -1]], [2, [.18, 1.57, -.78], [-.04, .05, -1]],
      [2.4, [.24, 1.52, -.55], [-.05, .12, -.99]], [3, SPEAR_READY, SPEAR_DIR]] },
  thrust_high: { weapon: 'spear', prepare: .3, active: .14, recover: .3, cost: 12, damage: .95, posture: .13, force: 1, lunge: .3, kind: 'thrust', anim: [3, .4, .55],
    track: [[0, SPEAR_READY, SPEAR_DIR], [1, [.42, 1.65, .1], [-.08, .2, -.98]], [1.5, [.25, 1.8, -.5], [-.05, .16, -.99]], [2, [.18, 1.88, -.76], [-.04, .14, -.99]],
      [2.4, [.24, 1.6, -.55], [-.05, .15, -.99]], [3, SPEAR_READY, SPEAR_DIR]] },
  lunge: { weapon: 'spear', heavy: true, prepare: .46, active: .16, recover: .42, cost: 20, damage: 1.35, posture: .3, force: 1.7, lunge: .75, kind: 'thrust', anim: [3, .4, .55],
    track: [[0, SPEAR_READY, SPEAR_DIR], [1, [.5, 1.42, .2], [-.08, .1, -.99]], [1.5, [.24, 1.4, -.62], [-.04, .02, -1]], [2, [.16, 1.38, -.88], [-.03, 0, -1]],
      [2.4, [.24, 1.4, -.6], [-.05, .1, -.99]], [3, SPEAR_READY, SPEAR_DIR]] },
};
/** The wanderer's chain: taps alternate forehand and backhand; LMB held is the heavy blow. */
export const CHAINS = { sword: { light: ['slash_r', 'slash_l'], heavy: 'chop' }, spear: { light: ['thrust', 'thrust_high'], heavy: 'lunge' } };

// ── Defence. parry: a guard raised this short a time before the blade arrives turns it aside; arc: cosine of the
// half angle a guard covers (front); flank: beyond this the guard is wrong-footed (bad defence).
export const DEFENSE = { parry: .2, arc: .34, flank: .02, raise: .07, blockDamage: .12, badDamage: .55, staminaPerForce: 11, postureRegen: .16, postureDelay: 1.1, ripostes: 1.25 };
/** The pivot every track pitches about (the line through both shoulders) and the pitch a track is drawn for. */
export const PIVOT_Y = 1.92, NEUTRAL_PITCH = -.167;

/** Total length of an attack (seconds), with its phases scaled. */
export const totalTime = (def, scale = {}) => def.prepare * (scale.prepare ?? 1) + def.active * (scale.active ?? 1) + def.recover * (scale.recover ?? 1);
/** Phase and phase time (0–3) at seconds t into an attack whose phases last `d` = {prepare, active, recover}. */
export function phaseAt(d, t) {
  if (t < d.prepare) return { phase: 'prepare', u: t / d.prepare, time: t / d.prepare };
  if (t < d.prepare + d.active) { const u = (t - d.prepare) / d.active; return { phase: 'active', u, time: 1 + u }; }
  const u = Math.min(1, (t - d.prepare - d.active) / d.recover); return { phase: t >= d.prepare + d.active + d.recover ? 'done' : 'recover', u, time: 2 + u };
}
/** Seconds into the attack where a phase time (0–3) falls. */
export function secondsAt(d, time) {
  if (time <= 1) return time * d.prepare;
  if (time <= 2) return d.prepare + (time - 1) * d.active;
  return d.prepare + d.active + (time - 2) * d.recover;
}
const smooth = u => u * u * (3 - 2 * u);
/** Blade at phase time `time` → out.hilt [x,y,z], out.dir (unit) in body space; the prepare and recover legs ease. */
export function sampleTrack(def, time, out = { hilt: [0, 0, 0], dir: [0, 0, 0] }) {
  const keys = def.track; let i = 0;
  while (i < keys.length - 2 && time > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], span = b[0] - a[0];
  let u = span > 0 ? Math.min(1, Math.max(0, (time - a[0]) / span)) : 1;
  if (b[0] <= 1 || a[0] >= 2) u = smooth(u);
  for (let k = 0; k < 3; k++) out.hilt[k] = a[1][k] + (b[1][k] - a[1][k]) * u;
  slerpDir(a[2], b[2], u, out.dir);
  return out;
}
const unit = (v, out) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l; return out; };
const _ua = [0, 0, 0], _ub = [0, 0, 0];
/** Great-circle blend of two directions (unit result). */
export function slerpDir(a, b, u, out) {
  unit(a, _ua); unit(b, _ub);
  const dot = Math.max(-1, Math.min(1, _ua[0] * _ub[0] + _ua[1] * _ub[1] + _ua[2] * _ub[2])), th = Math.acos(dot);
  if (th < 1e-4) { for (let k = 0; k < 3; k++) out[k] = _ua[k] + (_ub[k] - _ua[k]) * u; return unit(out, out); }
  const s = Math.sin(th), wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  for (let k = 0; k < 3; k++) out[k] = _ua[k] * wa + _ub[k] * wb;
  return unit(out, out);
}
/** How far in front of the attacker's feet the edge of an attack reaches (for the AI's sense of distance). */
export function reachOf(def, weapon = WEAPONS[def.weapon]) {
  const s = { hilt: [0, 0, 0], dir: [0, 0, 0] }; let best = 0;
  for (let k = 0; k <= 20; k++) { sampleTrack(def, 1 + k / 20, s); best = Math.max(best, -(s.hilt[2] + s.dir[2] * weapon.length)); }
  return best + def.lunge;
}
/** Which way an attack comes at someone: 'right' (the attacker's forehand arrives from the defender's left), 'left', 'high', 'thrust'. */
export const lineOf = id => ({ slash_r: 'right', slash_l: 'left', chop: 'high' })[id] || 'thrust';
