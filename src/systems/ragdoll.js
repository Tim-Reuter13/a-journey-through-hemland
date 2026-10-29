import * as THREE from 'three';
import { GROUP, groups } from './physics.js';

// Active ragdolls for the Blockbench humanoid rig ("Euphoria"-style, kept simple). Each simulated
// bone becomes a box body hanging off its joint pivot; spine, hips, knees and elbows are limited
// hinges, shoulders and neck are ball joints. Every joint has a motor: for a moment after death
// the body keeps muscle tone, the knees buckle and the arms reach out to break the fall in the
// direction it tips; then the tone fades and the corpse goes limp. Bones read the bodies back.
// Segment centre offset and half extents in rig units (16 px = 1), before scaling.
const SEGMENTS = {
  hips: { c: [0, .0625, 0], h: [.25, .125, .156], mass: 10 },
  torso: { c: [0, .125, 0], h: [.25, .125, .156], mass: 8, parent: 'hips', hinge: [-.9, .5] },
  chest: { c: [0, .219, 0], h: [.3125, .219, .1875], mass: 14, parent: 'torso', hinge: [-.6, .4] },
  head: { c: [0, .1875, 0], h: [.219, .219, .219], mass: 5, parent: 'chest' },
  arm_upper_right: { c: [0, -.156, 0], h: [.094, .219, .094], mass: 3, parent: 'chest' },
  arm_upper_left: { c: [0, -.156, 0], h: [.094, .219, .094], mass: 3, parent: 'chest' },
  arm_lower_right: { c: [0, -.25, 0], h: [.094, .25, .094], mass: 2.5, parent: 'arm_upper_right', hinge: [0, 2.4] },
  arm_lower_left: { c: [0, -.25, 0], h: [.094, .25, .094], mass: 2.5, parent: 'arm_upper_left', hinge: [0, 2.4] },
  leg_upper_right: { c: [0, -.25, 0], h: [.125, .25, .125], mass: 7, parent: 'hips', hinge: [-.6, 1.7] },
  leg_upper_left: { c: [0, -.25, 0], h: [.125, .25, .125], mass: 7, parent: 'hips', hinge: [-.6, 1.7] },
  leg_lower_right: { c: [0, -.281, -.03], h: [.125, .281, .156], mass: 4.5, parent: 'leg_upper_right', hinge: [-2.4, 0] },
  leg_lower_left: { c: [0, -.281, -.03], h: [.125, .281, .156], mass: 4.5, parent: 'leg_upper_left', hinge: [-2.4, 0] },
};
export const RAGDOLL_BONES = Object.keys(SEGMENTS);

// The dying reaction, in joint angles (same sign as the animator's bone pitch). `at` is how far
// into the fall the target is reached; `tone` how long the joint keeps strength before fading.
const REACTION = {
  torso: { target: -.15, at: .5, tone: .6 }, chest: { target: -.1, at: .5, tone: .6 },
  leg_upper_right: { target: .55, at: .35, tone: .45, k: 1.4 }, leg_upper_left: { target: .45, at: .4, tone: .45, k: 1.4 },
  leg_lower_right: { target: -1.2, at: .3, tone: .4, k: 1.6 }, leg_lower_left: { target: -1.05, at: .35, tone: .4, k: 1.6 },
  arm_lower_right: { target: 1, at: .35, tone: 1 }, arm_lower_left: { target: 1, at: .35, tone: 1 },
};
const AXES = [3, 4, 5]; // RAPIER.JointAxis.AngX/AngY/AngZ
// rapier3d-compat 0.21 does not expose motors on spherical joints; the raw joint set does.
const motor = (joint, axis, target, stiffness, damping) => joint.rawSet.jointConfigureMotorPosition(joint.handle, axis, target, stiffness, damping);
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

/** Strength of a joint `t` seconds after death: full while the body still fights, then fading out. */
export function muscleTone(t, hold) { return 1 - smooth((t - hold) / .9); }

const m4 = new THREE.Matrix4(), m4b = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();

export function createRagdoll(physics, character, { impulse = null, point = null } = {}) {
  const { RAPIER, world } = physics, rig = character.userData.rig;
  character.updateWorldMatrix(true, true);
  rig.chest.getWorldScale(s);
  const scale = (s.x + s.y + s.z) / 3;
  const parts = [], byName = {};
  for (const [name, seg] of Object.entries(SEGMENTS)) {
    const bone = rig[name]; if (!bone) continue;
    bone.getWorldPosition(v); bone.getWorldQuaternion(q);
    const centre = new THREE.Vector3(...seg.c).multiplyScalar(scale).applyQuaternion(q).add(v);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(centre.x, centre.y, centre.z).setRotation(q)
      .setLinearDamping(.25).setAngularDamping(1.4).setCanSleep(true));
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(...seg.h.map(x => x * scale)).setMass(seg.mass).setFriction(.95)
      .setCollisionGroups(groups(GROUP.ragdoll, GROUP.world | GROUP.prop)), body);
    const part = { name, bone, body, collider, offset: new THREE.Vector3(...seg.c).multiplyScalar(scale) };
    parts.push(part); byName[name] = part;
  }
  // Which way the body tips decides the reaction: falling forward, the arms reach out in front.
  const front = new THREE.Vector3(0, 0, -1).applyQuaternion(character.getWorldQuaternion(new THREE.Quaternion()));
  const forward = impulse ? Math.sign(impulse.x * front.x + impulse.z * front.z) || 1 : 1;
  const brace = forward > 0 ? 1.45 : .75;
  const joints = [];
  for (const part of parts) {
    const seg = SEGMENTS[part.name], parent = byName[seg.parent];
    if (!parent) continue;
    // The joint sits on the child bone's pivot, expressed in both bodies' frames.
    part.bone.getWorldPosition(v);
    const local = body => { const t = body.translation(), r = body.rotation(); return v.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()); };
    const a1 = local(parent.body), a2 = local(part.body);
    const data = seg.hinge ? RAPIER.JointData.revolute(a1, a2, { x: 1, y: 0, z: 0 }) : RAPIER.JointData.spherical(a1, a2);
    const joint = world.createImpulseJoint(data, parent.body, part.body, true);
    if (seg.hinge) joint.setLimits(...seg.hinge);
    joint.setContactsEnabled?.(false);
    // Start angle: the animated pose at the moment of death (bones rest axis-aligned with their parent).
    const start = part.bone.rotation.x, reaction = REACTION[part.name];
    const shoulder = part.name.startsWith('arm_upper');
    joints.push({ joint, hinge: !!seg.hinge, name: part.name, start,
      target: reaction?.target ?? (shoulder ? brace : 0), at: reaction?.at ?? (shoulder ? .3 : .4),
      hold: reaction?.tone ?? (shoulder ? .9 : .8), strength: reaction?.k ?? 1, residual: part.name === 'head' ? 14 : shoulder ? 6 : 0 });
  }
  if (impulse) {
    const target = point ? parts.reduce((best, p) => { const t = p.body.translation(); const d = Math.hypot(t.x - point.x, t.y - point.y, t.z - point.z); return d < best.d ? { p, d } : best; }, { p: byName.chest, d: Infinity }).p : byName.chest;
    target.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }
  const mass = parts.reduce((sum, p) => sum + SEGMENTS[p.name].mass, 0);
  let age = 0, limp = false;

  // Per physics substep: blend each joint from the death pose to the reaction pose with fading strength.
  function drive(h) {
    if (limp) return;
    age += h;
    let alive = false;
    for (const j of joints) {
      const tone = muscleTone(age, j.hold);
      if (tone > .01) alive = true;
      const target = j.start + (j.target - j.start) * smooth(age / j.at);
      const stiffness = (30 + 420 * tone) * j.strength, damping = (4 + 30 * tone) * j.strength;
      if (j.hinge) {
        if (tone > .01) j.joint.configureMotorPosition(target, stiffness * tone, damping);
        else j.joint.configureMotorVelocity(0, 1.2);
      } else {
        // Ball joints: pitch follows the reaction, twist and roll are held near neutral; neck and
        // shoulders keep a little residual tone so heads and arms never spin through the body.
        const k = Math.max(stiffness * tone, j.residual), c = Math.max(damping * tone, j.residual ? 5 : 0);
        motor(j.joint, AXES[0], tone > .01 ? target : 0, k, c);
        motor(j.joint, AXES[1], 0, k * .6, c);
        motor(j.joint, AXES[2], 0, k * .6, c);
      }
    }
    if (!alive) limp = true;
  }

  function sync(force = false) {
    if (!force && resting()) return;
    // Parents first (SEGMENTS is ordered root → leaves), so each bone reads an up-to-date parent.
    for (const part of parts) {
      const t = part.body.translation(), r = part.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      v.copy(part.offset).applyQuaternion(q).negate().add(new THREE.Vector3(t.x, t.y, t.z));
      part.bone.parent.updateWorldMatrix(true, false);
      part.bone.parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
      m4.compose(v, q, s);
      m4b.copy(part.bone.parent.matrixWorld).invert().multiply(m4);
      m4b.decompose(part.bone.position, part.bone.quaternion, new THREE.Vector3());
      part.bone.updateMatrixWorld(true);
    }
  }
  const resting = () => parts.every(p => p.body.isSleeping());
  // Corpses are dragged by the collar, or by an ankle when a leg was grabbed (to hide them).
  const grabBody = part => (part.name.startsWith('leg_') ? byName[`leg_lower_${part.name.endsWith('right') ? 'right' : 'left'}`] : byName.chest).body;
  const ragdoll = {
    parts, mass, sync, resting, grabBody, constrain: () => drive(1 / 60),
    /** Re-dressing a corpse rebuilds its rig; the bodies must drive the new bones or it stands up again. */
    rebind(model) { for (const part of parts) part.bone = model.userData.rig[part.name] || part.bone; sync(true); },
    /** Nothing in a dead body moves faster than a falling one: no corpses flung across the map. */
    clamp() {
      for (const { body } of parts) {
        const v = body.linvel(), w = body.angvel(), s = Math.hypot(v.x, v.y, v.z), a = Math.hypot(w.x, w.y, w.z);
        if (s > 7) body.setLinvel({ x: v.x * 7 / s, y: v.y * 7 / s, z: v.z * 7 / s }, true);
        if (a > 12) body.setAngvel({ x: w.x * 12 / a, y: w.y * 12 / a, z: w.z * 12 / a }, true);
      }
    },
    state: () => ({ age, limp }),
    position: () => { const t = byName.hips.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); },
    dispose() { joints.forEach(j => world.removeImpulseJoint(j.joint, true)); parts.forEach(p => world.removeRigidBody(p.body)); physics.ragdolls.delete(ragdoll); },
  };
  physics.ragdolls.add(ragdoll);
  return ragdoll;
}

// Animals (deer, fox, hare, crow, wolf): the same bodies-on-bones idea without muscles. Each listed
// bone becomes a box fitted to its own Blockbench mesh, so every species ragdolls from its model.
// Hips and knees are hinges, neck, head and wings swing on ball joints held by a little tone.
const LEG = (set, parent) => ['right', 'left'].flatMap(side => [
  [`${set}_upper_${side}`, parent, [-1.1, 1.1]], [`${set}_lower_${side}`, `${set}_upper_${side}`, set === 'front' ? [-1.5, .15] : [-.15, 1.5]]]);
const CREATURE = [['body'], ['chest', 'body', [-.35, .35]], ['neck', 'chest'], ['head', 'neck'], ['tail_1', 'body'],
  ...LEG('front', 'chest'), ...LEG('rear', 'body'), ['wing_right', 'body'], ['wing_left', 'body']];

export function createCreatureRagdoll(physics, creature, { impulse = null } = {}) {
  const { RAPIER, world } = physics, rig = creature.userData.rig;
  creature.updateWorldMatrix(true, true);
  const parts = [], byName = {}, joints = [], box = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();
  for (const [name, parentName, hinge] of CREATURE) {
    const bone = rig[name], mesh = bone?.children.find(c => c.isMesh);
    if (!mesh || (parentName && !byName[parentName])) continue;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox); box.getSize(size); box.getCenter(centre);
    bone.getWorldPosition(v); bone.getWorldQuaternion(q); bone.getWorldScale(s);
    const half = size.multiply(s).multiplyScalar(.5).max(new THREE.Vector3(.03, .03, .03));
    const offset = centre.clone().multiply(s), at = offset.clone().applyQuaternion(q).add(v);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation(q)
      .setLinearDamping(.3).setAngularDamping(1.6).setCanSleep(true));
    const mass = Math.max(.08, half.x * half.y * half.z * 8 * 420);
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setMass(mass).setFriction(.95)
      .setCollisionGroups(groups(GROUP.ragdoll, GROUP.world | GROUP.prop)), body);
    const part = { name, bone, body, collider, offset, mass };
    parts.push(part); byName[name] = part;
    const parent = byName[parentName];
    if (!parent) continue;
    const local = b => { const t = b.translation(), r = b.rotation(); return v.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()); };
    const data = hinge ? RAPIER.JointData.revolute(local(parent.body), local(body), { x: 1, y: 0, z: 0 }) : RAPIER.JointData.spherical(local(parent.body), local(body));
    const joint = world.createImpulseJoint(data, parent.body, body, true);
    if (hinge) joint.setLimits(...hinge);
    else for (const axis of AXES) motor(joint, axis, 0, name === 'head' || name === 'neck' ? 6 : 2, 1.2);
    joint.setContactsEnabled?.(false);
    joints.push(joint);
  }
  const root = byName.body || parts[0];
  if (impulse && root) root.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  const total = parts.reduce((sum, p) => sum + p.mass, 0);
  const ragdoll = {
    parts, mass: total,
    sync(force = false) {
      if (!force && parts.every(p => p.body.isSleeping())) return;
      for (const part of parts) {
        const t = part.body.translation(), r = part.body.rotation();
        q.set(r.x, r.y, r.z, r.w);
        v.copy(part.offset).applyQuaternion(q).negate().add(new THREE.Vector3(t.x, t.y, t.z));
        part.bone.parent.updateWorldMatrix(true, false);
        part.bone.parent.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
        m4.compose(v, q, s);
        m4b.copy(part.bone.parent.matrixWorld).invert().multiply(m4);
        m4b.decompose(part.bone.position, part.bone.quaternion, new THREE.Vector3());
        part.bone.updateMatrixWorld(true);
      }
    },
    grabBody: part => (part.name.includes('_lower_') || part.name.includes('_upper_') ? part : root).body,
    clamp() {
      for (const { body } of parts) {
        const lv = body.linvel(), w = body.angvel(), sp = Math.hypot(lv.x, lv.y, lv.z), a = Math.hypot(w.x, w.y, w.z);
        if (sp > 9) body.setLinvel({ x: lv.x * 9 / sp, y: lv.y * 9 / sp, z: lv.z * 9 / sp }, true);
        if (a > 14) body.setAngvel({ x: w.x * 14 / a, y: w.y * 14 / a, z: w.z * 14 / a }, true);
      }
    },
    position: () => { const t = root.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); },
    dispose() { joints.forEach(j => world.removeImpulseJoint(j, true)); parts.forEach(p => world.removeRigidBody(p.body)); physics.ragdolls.delete(ragdoll); },
  };
  physics.ragdolls.add(ragdoll);
  return ragdoll;
}
