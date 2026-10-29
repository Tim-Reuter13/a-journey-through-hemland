// HUMANITY MOTION · layer E, balance and physical reactions (pure logic; motion.js moves the body
// and drives the pose). A push or a blow is a force with a direction. What it does depends on how
// firmly the body stands: armour and size resist, a raised guard braces, an attack in progress or a
// sprint is easy to unbalance, tired or wounded legs give way, and someone already staggering
// topples from a blow they would otherwise take with a step. Five reactions:
//   minor   – the upper body gives a little and springs back, feet stay;
//   stagger – one balance step in the direction of the force, arms come out;
//   major   – two or three steps, arms wide; a wall in the way is grabbed or leaned on;
//   fall    – balance is lost: a living ragdoll, then recovery (getting up) when it has settled.
// Not every hit topples anyone: an ordinary sword cut is a minor reaction or a stagger.
export const BAL = {
  minor: .9, stagger: 2.0, major: 3.3,            // effective force thresholds
  steps: { stagger: .45, major: 1.15 },            // distance stepped
  speed: { stagger: 1.7, major: 2.5 },             // m/s while stepping
  hold: { minor: .35, stagger: .65, major: 1.25 }, // how long the reaction lasts
  regen: .3, cost: .22, spring: 70, damping: 12,
};
const ORDER = ['steady', 'minor', 'stagger', 'major', 'fall'];

export function createBalance() {
  return { stability: 1, stage: 'steady', until: 0, t: 0, sway: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, step: { x: 0, z: 0, left: 0, speed: 0 },
    knee: { right: 0, left: 0 }, guardArm: 0, braced: null, falls: 0, last: null };
}

/** How firmly someone stands (≈1 for an ordinary person). */
export function resistance({ armor = 0, guard = false, attacking = false, running = 0, stamina = 1, legs = 0, size = 1, down = false } = {}) {
  if (down) return .2;
  return size * (1 + armor * .55) * (guard ? 1.35 : 1) * (attacking ? .8 : 1) * (1 - running * .25) * (.6 + .4 * stamina) * (1 - legs * .35);
}

export const stageFor = effective => effective >= BAL.major ? 'fall' : effective >= BAL.stagger ? 'major' : effective >= BAL.minor ? 'stagger' : 'minor';

/**
 * A force arrives. dir: unit vector {x, z} (world) it pushes toward; force: ~1 for a normal cut,
 * ~2.5 for a heavy blow or a shove; resist from resistance(); location: hit zone ('leg_left', ...).
 * Returns the reaction stage.
 */
export function push(b, { dir, force, resist = 1, location = 'chest', now = b.t }) {
  let effective = force / Math.max(.15, resist) * (1 + (1 - b.stability) * 1.4);
  if (b.stage === 'stagger' || b.stage === 'major') effective *= 1.35;
  if (/^(thigh|shin)/.test(location)) { b.knee[location.endsWith('left') ? 'left' : 'right'] = 1; effective *= 1.12; }
  if (location === 'head') effective *= 1.15;
  const stage = stageFor(effective);
  b.stability = Math.max(0, b.stability - effective * BAL.cost);
  const kick = Math.min(3.5, effective) * .9;
  b.vel.x += dir.x * kick; b.vel.z += dir.z * kick;
  b.last = { stage, effective, location, at: now };
  if (ORDER.indexOf(stage) >= ORDER.indexOf(b.stage) || now >= b.until) {
    b.stage = stage;
    b.until = now + (BAL.hold[stage] ?? 0);
    if (stage === 'stagger' || stage === 'major') Object.assign(b.step, { x: dir.x, z: dir.z, left: BAL.steps[stage], speed: BAL.speed[stage] });
    if (stage === 'fall') b.falls++;
  }
  return stage;
}

/** A blow taken on a raised shield: the shield arm gives, the body barely moves. */
export function shieldImpact(b, force) { b.guardArm = Math.min(1, b.guardArm + force * .6); b.stability = Math.max(0, b.stability - force * .05); }

/**
 * Advances the reaction. Returns { dx, dz } the body should step this frame (the caller checks
 * walls). The upper body sways on a damped spring.
 */
export function stepBalance(b, dt) {
  b.t += dt;
  const ax = -BAL.spring * b.sway.x - BAL.damping * b.vel.x, az = -BAL.spring * b.sway.z - BAL.damping * b.vel.z;
  b.vel.x += ax * dt; b.vel.z += az * dt;
  b.sway.x += b.vel.x * dt; b.sway.z += b.vel.z * dt;
  const lim = .55, s = Math.hypot(b.sway.x, b.sway.z);
  if (s > lim) { b.sway.x *= lim / s; b.sway.z *= lim / s; }
  for (const k of ['right', 'left']) b.knee[k] = Math.max(0, b.knee[k] - dt * 2.2);
  b.guardArm = Math.max(0, b.guardArm - dt * 3);
  let dx = 0, dz = 0;
  if (b.step.left > 0) {
    const d = Math.min(b.step.left, b.step.speed * dt);
    dx = b.step.x * d; dz = b.step.z * d; b.step.left -= d;
  }
  if (b.stage !== 'fall' && b.t >= b.until && b.step.left <= 0) { b.stage = 'steady'; b.braced = null; }
  if (b.stage === 'steady' || b.stage === 'minor') b.stability = Math.min(1, b.stability + BAL.regen * dt);
  return { dx, dz };
}

/** Upper-body reaction in the body's frame (yaw = model rotation.y; front is −Z). */
export function reactionPose(b, yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const forward = b.sway.x * fx + b.sway.z * fz, right = b.sway.x * rx + b.sway.z * rz;
  const stepping = b.step.left > 0 ? 1 : 0, wide = b.stage === 'major' ? 1 : b.stage === 'stagger' ? .55 : 0;
  return { pitch: forward, roll: right, arms: Math.max(wide, stepping * .5) * (b.braced ? 0 : 1), knee: { ...b.knee }, guardArm: b.guardArm,
    hipsY: -(b.knee.right + b.knee.left) * .06 - wide * .05 };
}

// Hit zones by the bone nearest the struck point (motion.js finds it). The chest struck from behind
// is the back; an upper arm struck near its top is the shoulder.
const ZONES = { head: 'head', neck: 'head', chest: 'chest', torso: 'belly', hips: 'pelvis', arm_upper: 'upper_arm', arm_lower: 'forearm', hand: 'forearm',
  leg_upper: 'thigh', leg_lower: 'shin', foot: 'shin' };
export function hitZone(bone, { behind = false, nearJoint = false } = {}) {
  const side = bone.endsWith('_left') ? '_left' : bone.endsWith('_right') ? '_right' : '';
  const base = ZONES[bone.replace(/_(left|right)$/, '')] || 'chest';
  if (base === 'chest' && behind) return 'back';
  if (base === 'upper_arm' && nearJoint) return `shoulder${side}`;
  return base + side;
}

/** Lying pose from the chest's front direction (world y of it) and how upright the chest stands. */
export function lyingPose(frontY, chestUpY, hipsHeight) {
  if (chestUpY > .7) return hipsHeight > .45 ? 'kneeling' : 'sitting';
  if (frontY > .45) return 'back';
  if (frontY < -.45) return 'front';
  return 'side';
}
