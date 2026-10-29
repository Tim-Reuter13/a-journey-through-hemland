import * as THREE from 'three';
import { rigAdapter } from './rig.js';
import { createFootIK } from './feet.js';
import { createBalance, push, stepBalance, reactionPose, resistance, hitZone, lyingPose, shieldImpact } from './balance.js';
import { GRIP, canGrab, createGrapple, stepGrapple, isActive, gripStrength } from './grapple.js';
import { applyTwoBone, capturePose, blendToPose } from './ik.js';

// HUMANITY MOTION · the coordinator. One set of physical rules for the wanderer and every person:
// the same ground (terrain, floors, steps, crates), the same balance, the same grips, falls and
// getting up. Per frame: simulate() after movement (balance steps, grips pulling bodies, falls and
// recoveries), animInput() feeds the animator, afterAnimate() runs the IK on top of the pose (feet,
// gripping hands, a hand braced on a wall, the blend out of a ragdoll). Distance sets the detail.
const BONES = ['hips', 'torso', 'chest', 'neck', 'head', 'arm_upper_right', 'arm_lower_right', 'hand_right', 'arm_upper_left', 'arm_lower_left', 'hand_left',
  'leg_upper_right', 'leg_lower_right', 'foot_right', 'leg_upper_left', 'leg_lower_left', 'foot_left'];
const HIT_BONES = ['head', 'chest', 'torso', 'hips', 'arm_upper_right', 'arm_lower_right', 'arm_upper_left', 'arm_lower_left', 'leg_upper_right', 'leg_lower_right', 'leg_upper_left', 'leg_lower_left'];
export const LOD = { full: 30, feet: 65 };
const GETUP = { back: 2.0, front: 1.8, side: 1.9, sitting: 1.1, kneeling: .6 };
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = v3(), _b = v3(), _c = v3(), _d = v3(), _q = new THREE.Quaternion();

export function createMotion({ world, physics = null, createRagdoll = null, hooks = {} }) {
  const actors = new Map(), grips = new Set(), fires = [];
  let clock = 0;
  const stats = { feet: 0, full: 0, ms: 0 };

  // ── Ground: everyone stands on terrain, floors and anything solid at most a step above the feet.
  function standY(x, z, y = -Infinity, radius = .3) {
    const g = world.heightAt(x, z);
    return Number.isFinite(y) ? Math.max(g, world.supportAt(x, z, radius, y)) : g;
  }
  function normalAt(x, z, y, out) {
    const e = .14, hx = standY(x + e, z, y, .05) - standY(x - e, z, y, .05), hz = standY(x, z + e, y, .05) - standY(x, z - e, y, .05);
    return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
  }

  /** opts: { kind: 'player'|'enemy'|'npc', pos(): Vector3 (authoritative position), state(): live facts,
   *  setYaw(y), animator, movable, grabbable } */
  function add(model, opts) {
    const a = { model, ...opts, adapter: rigAdapter(model), balance: createBalance(), injury: { leg_right: 0, leg_left: 0, arm_right: 0, arm_left: 0, torso: 0 },
      grip: null, down: null, getup: null, presence: { next: 2 + Math.random() * 4, kind: null, until: 0, look: null, shift: 0, near: 0 },
      last: v3().copy(opts.pos()), vel: { x: 0, z: 0 }, slope: 0, dist: 0, feetOn: true };
    a.feet = createFootIK(model, a.adapter);
    actors.set(model, a);
    return a;
  }
  const remove = model => { const a = actors.get(model); if (a?.grip) endGrip(a.grip); actors.delete(model); };
  const get = model => actors.get(model) || null;
  const yawOf = a => a.model.rotation.y;
  const forward = (a, out = v3()) => out.set(-Math.sin(yawOf(a)), 0, -Math.cos(yawOf(a)));
  const sizeOf = a => a.model.scale.y || 1;

  function tryMove(a, dx, dz) {
    const p = a.pos(), r = .4, y = p.y + .3;
    const ok = (x, z) => !world.blocked(x, z, r, y);
    if (ok(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; }
    else if (ok(p.x + dx, p.z)) p.x += dx;
    else if (ok(p.x, p.z + dz)) p.z += dz;
    else return false;
    p.y = standY(p.x, p.z, p.y);
    return true;
  }
  /** What stands right behind a point along dir (wall, table, low wall), or null. */
  function obstacle(p, dir, reach = .75) {
    for (let d = .3; d <= reach; d += .15) {
      const x = p.x + dir.x * d, z = p.z + dir.z * d;
      if (world.blocked(x, z, .2, p.y + .3)) {
        const c = world.collidersNear?.(x, z, .6)?.find(o => !o.disabled && o.top > p.y + .3 && (o.radius !== undefined ? Math.hypot(x - o.x, z - o.z) < o.radius + .25 : Math.abs(x - o.x) < o.halfWidth + .45 && Math.abs(z - o.z) < o.halfDepth + .45));
        return { distance: d, point: v3(x - dir.x * .18, 0, z - dir.z * .18), top: c ? c.top : p.y + 3, low: c ? c.top - p.y < 1.25 * 1 : false };
      }
    }
    return null;
  }

  // ── Layer E: forces arriving at bodies.
  function standing(a) {
    const s = a.state();
    return resistance({ armor: s.armor || 0, guard: !!s.guard, attacking: !!s.attacking, running: s.running || 0, stamina: s.stamina ?? 1,
      legs: Math.max(a.injury.leg_right, a.injury.leg_left), size: sizeOf(a), down: !!a.down });
  }
  /** Nearest bone to a struck point (world) → hit zone. */
  const _za = v3(), _zb = v3(), _zc = v3(), _zd = v3();
  function zoneAt(a, point, from) {
    const rig = a.model.userData.rig; if (!rig || !point) return 'chest';
    point = point.clone();
    let best = 'chest', bestD = Infinity, near = false;
    for (const name of HIT_BONES) {
      const bone = rig[name]; if (!bone) continue;
      bone.getWorldPosition(_za); const child = bone.children.find(c => rig[c.name] === c && !c.isMesh);
      if (child) child.getWorldPosition(_zb); else _zb.copy(_za).y += .3 * sizeOf(a);
      const line = new THREE.Line3(_za, _zb), closest = line.closestPointToPoint(point, true, _zc), d = closest.distanceTo(point);
      if (d < bestD) { bestD = d; best = name; near = line.closestPointToPointParameter(point, true) < .3; }
    }
    const behind = from ? forward(a, _zd).dot(_zc.copy(from).sub(a.pos()).setY(0).normalize()) < -.2 : false;
    return hitZone(best, { behind, nearJoint: near });
  }
  /**
   * A blow or push lands. info: { from: Vector3 (attacker), point: Vector3 (struck), force, damage,
   * shield (taken on a raised shield) }. Returns { stage, zone }.
   */
  function impact(model, { from = null, point = null, force = 1, damage = 0, shield = false, dir = null } = {}) {
    const a = actors.get(model); if (!a || a.down || a.state().dead) return { stage: 'none', zone: null };
    const p = a.pos();
    const d = dir ? v3().copy(dir).setY(0).normalize() : from ? v3().copy(p).sub(from).setY(0).normalize() : forward(a, v3()).negate();
    if (shield) { shieldImpact(a.balance, force); return { stage: 'shield', zone: 'shield' }; }
    const zone = zoneAt(a, point || v3().copy(p).add(v3(0, 1.5 * sizeOf(a), 0)), from);
    const stage = push(a.balance, { dir: { x: d.x, z: d.z }, force, resist: standing(a), location: zone, now: clock });
    // Wounds the body remembers: a cut leg limps, a cut arm is spared, a gut wound bends you over.
    const s = a.state(), share = damage / Math.max(1, s.maxHp || 100);
    const side = zone.endsWith('left') ? 'left' : 'right';
    if (/^(thigh|shin)/.test(zone)) a.injury[`leg_${side}`] = Math.min(1, a.injury[`leg_${side}`] + share * 3);
    else if (/^(upper_arm|forearm|shoulder)/.test(zone)) a.injury[`arm_${side}`] = Math.min(1, a.injury[`arm_${side}`] + share * 3);
    else if (zone === 'belly' || zone === 'pelvis') a.injury.torso = Math.min(1, a.injury.torso + share * 2.5);
    if (a.grip?.holder === a && force > .6) a.grip.interrupt = true;
    if (stage === 'fall') knockDown(a, d, force);
    hooks.event?.('impact', a, null, { stage, zone, force });
    return { stage, zone };
  }

  // ── Falls and getting up.
  function knockDown(a, dir, force = 2, extra = null) {
    if (a.down || !physics || !createRagdoll) return false;
    if (a.grip && a.grip.state !== 'Takedown') endGrip(a.grip, 'Interrupted');
    const impulse = v3(dir.x, 0, dir.z).multiplyScalar(10 + 8 * Math.min(3, force)).add(v3(0, 4, 0));
    if (extra) impulse.add(extra);
    a.feet.reset();
    a.down = { ragdoll: createRagdoll(physics, a.model, { impulse, point: _a.copy(a.pos()).add(v3(0, 1.5, 0)) }), t: 0, still: 0, held: false };
    a.balance.stage = 'fall';
    hooks.event?.('fall', a, null, { force });
    return true;
  }
  function getUp(a) {
    const rig = a.model.userData.rig, down = a.down;
    const hips = down.ragdoll.position();
    rig.chest.getWorldQuaternion(_q);
    const front = v3(0, 0, -1).applyQuaternion(_q), up = v3(0, 1, 0).applyQuaternion(_q);
    const ground = standY(hips.x, hips.z, hips.y - .4);
    let kind = lyingPose(front.y, up.y, hips.y - ground);
    if (kind === 'side') kind = front.y >= 0 ? 'back' : 'front';
    // Facing: on the back the legs point forward, face down they trail behind.
    rig.foot_right.getWorldPosition(_a); rig.foot_left.getWorldPosition(_b); _a.add(_b).multiplyScalar(.5);
    const toFeet = _c.set(_a.x - hips.x, 0, _a.z - hips.z);
    if (kind === 'front') toFeet.negate();
    if (kind === 'sitting' || kind === 'kneeling') toFeet.set(front.x, 0, front.z);
    const yaw = toFeet.lengthSq() > 1e-4 ? Math.atan2(-toFeet.x, -toFeet.z) : yawOf(a);
    // A safe spot: not inside a wall or a cart.
    const spot = v3(hips.x, 0, hips.z);
    if (world.blocked(spot.x, spot.z, .35, ground + .2)) {
      for (let r = .4; r <= 1.6; r += .4) { let found = false;
        for (let k = 0; k < 8; k++) { const x = hips.x + Math.cos(k * .785) * r, z = hips.z + Math.sin(k * .785) * r; if (!world.blocked(x, z, .35, ground + .2)) { spot.set(x, 0, z); found = true; break; } }
        if (found) break; }
    }
    const captured = capturePose(rig, BONES);
    down.ragdoll.dispose();
    for (const bone of Object.values(rig)) if (bone.userData.rest) bone.position.copy(bone.userData.rest.position);
    const p = a.pos(); p.set(spot.x, standY(spot.x, spot.z, ground + .3), spot.z);
    a.model.position.copy(p); a.model.rotation.y = yaw; a.setYaw?.(yaw);
    a.down = null;
    a.getup = { kind, t: 0, dur: GETUP[kind] * (1 + Math.max(a.injury.leg_left, a.injury.leg_right) * .5 + a.injury.torso * .3), captured };
    a.feet.reset();
    hooks.event?.('getup', a, null, { kind });
  }

  // ── Layer F: grips.
  function facts(a) {
    const s = a.state(), p = a.pos();
    return { x: p.x, y: p.y, z: p.z, yaw: yawOf(a), busy: !!s.busy || !!a.getup || a.balance.stage === 'major', handFree: s.handFree !== false, down: !!a.down,
      dead: !!s.dead, held: a.grip?.target === a && isActive(a.grip) || a.grip?.target === a && a.grip.state.startsWith('Attempt'), holding: a.grip?.holder === a };
  }
  const strength = a => { const s = a.state(); return gripStrength({ armor: s.armor || 0, stamina: s.stamina ?? 1, stability: a.balance.stability, arms: Math.max(a.injury.arm_left, a.injury.arm_right), power: s.power ?? .5, size: sizeOf(a) }); };
  function clearBetween(h, t) {
    const p = h.pos(), q = t.pos();
    return !world.segmentBlocked?.(_a.set(p.x, p.y + 1.3, p.z), _b.set(q.x, q.y + 1.3, q.z));
  }
  /** Take hold of `target` (a model), or the best person in front when target is omitted. */
  function grab(holderModel, targetModel = null) {
    const h = actors.get(holderModel); if (!h) return { ok: false, reason: 'unbekannt' };
    if (h.grip?.holder === h) { h.grip.cmd = { release: true }; return { ok: true, reason: 'losgelassen', released: true }; }
    let candidates = targetModel ? [actors.get(targetModel)].filter(Boolean) : [...actors.values()].filter(t => t !== h && t.grabbable);
    let best = null, why = 'niemand in Reichweite';
    for (const t of candidates) {
      const r = canGrab(facts(h), facts(t), { clear: clearBetween(h, t) });
      if (!r.ok) { if (t.pos().distanceTo(h.pos()) < 2) why = r.reason; continue; }
      const d = t.pos().distanceTo(h.pos()); if (!best || d < best.d) best = { t, d };
    }
    if (!best) return { ok: false, reason: why };
    const t = best.t, toH = _a.copy(h.pos()).sub(t.pos()).setY(0).normalize();
    const from = forward(t, _b).dot(toH) > -.2 ? 'front' : 'behind';
    const g = createGrapple(h, t, { holderStrength: strength(h), targetStrength: strength(t), from, now: clock });
    h.grip = t.grip = g; grips.add(g);
    hooks.event?.('grab', h, t, { from });
    return { ok: true, reason: '', grip: g };
  }
  function command(model, cmd) {
    const a = actors.get(model); const g = a?.grip; if (!g) return false;
    if (g.holder === a) g.cmd = { ...(g.cmd || {}), [cmd]: true };
    else if (cmd === 'wrench') g.wrench = (g.wrench || 0) + 1;
    return true;
  }
  function endGrip(g, state = 'Done') {
    if (!g) return;
    g.state = state === 'Done' ? 'Done' : state;
    if (g.holder.grip === g) g.holder.grip = null;
    if (g.target.grip === g) g.target.grip = null;
    if (g.target.down) g.target.down.held = false;
    grips.delete(g);
  }
  function simulateGrip(g, dt) {
    const h = g.holder, t = g.target, hp = h.pos(), tp = t.pos();
    if (!actors.has(h.model) || !actors.has(t.model) || h.state().dead || t.state().dead) { endGrip(g); return; }
    const dir = _d.copy(tp).sub(hp).setY(0); const dist = dir.length(); dir.normalize();
    const wall = isActive(g) && g.state !== 'GroundControl' ? obstacle(tp, dir, .7) : null;
    g.wall = wall;
    const cmd = g.cmd || {}; g.cmd = null;
    const events = stepGrapple(g, dt, {
      holderStamina: h.state().stamina ?? 1, targetStability: t.balance.stability, targetWantsFree: hooks.wantsFree?.(t, h, g) ?? 0,
      shove: cmd.shove, takedown: cmd.takedown, release: cmd.release, interrupt: g.interrupt, wrench: g.wrench || 0, distance: dist, pinned: !!wall && wall.distance < .55,
    });
    g.interrupt = false; g.wrench = 0;
    for (const e of events) {
      if (e.type === 'jerk') { push(t.balance, { dir: { x: -dir.x, z: -dir.z }, force: .5, resist: 1, now: clock }); t.balance.vel.x += (Math.random() - .5) * 1.2; g.jerk = .25; }
      if (e.type === 'shove') {
        const lowWall = obstacle(tp, dir, 1.1);
        const stage = push(t.balance, { dir: { x: dir.x, z: dir.z }, force: e.force, resist: standing(t), now: clock });
        // Shoved into a low wall or a table while staggering: over it you go.
        if (lowWall?.low && (stage === 'major' || stage === 'fall')) knockDown(t, dir, 3, v3(0, 7, 0));
        else if (stage === 'fall') knockDown(t, dir, e.force);
        hooks.event?.('shove', h, t, { stage, wall: !!lowWall });
      }
      if (e.type === 'takedown') { knockDown(t, _a.copy(dir).multiplyScalar(.4), 1.2, v3(0, -6, 0)); if (t.down) t.down.held = true; hooks.event?.('takedown', h, t, {}); }
      if (e.type === 'escaped') { push(h.balance, { dir: { x: dir.x * -1, z: dir.z * -1 }, force: 1.1, resist: standing(h), now: clock }); hooks.event?.('escaped', t, h, {}); }
      if (e.type === 'refused') hooks.event?.('refused', h, t, {});
      if (e.type === 'state') hooks.event?.('gripState', h, t, { state: e.state });
    }
    if (g.state === 'Done') { endGrip(g); return; }
    if (g.state === 'Escaping' || g.state === 'Recovering' || g.state === 'Interrupted' || g.state === 'Releasing') return;
    if (g.state === 'GroundControl') {
      // Holding a body down: the holder kneels at the chest, the body is pressed to the ground.
      if (!t.down) { endGrip(g); return; }
      t.down.held = true;
      const chest = t.down.ragdoll.parts.find(p => p.name === 'chest')?.body;
      if (chest) { const c = chest.translation(); chest.applyImpulse({ x: 0, y: -.9, z: 0 }, true);
        const want = _a.set(c.x, hp.y, c.z).addScaledVector(dir, -.62); tryMove(h, (want.x - hp.x) * Math.min(1, dt * 6), (want.z - hp.z) * Math.min(1, dt * 6)); }
      return;
    }
    if (g.state === 'Takedown') return;
    // Bodies pull on each other: the error from the hold distance is shared by strength.
    const want = _a.copy(hp).addScaledVector(dir, GRIP.hold * sizeOf(h));
    const ex = tp.x - want.x, ez = tp.z - want.z, k = 1 - Math.exp(-dt * 9), share = g.hs / (g.hs + g.ts);
    tryMove(t, -ex * share * k, -ez * share * k);
    tryMove(h, ex * (1 - share) * k, ez * (1 - share) * k);
    // Dragging someone along takes their feet from under them.
    const hv = Math.hypot(h.vel.x, h.vel.z);
    if (hv > .6) t.balance.stability = Math.max(0, t.balance.stability - dt * .32 * Math.min(1.5, hv / 2));
    // The holder faces the held; the held turns toward the holder (or is held from behind).
    const yaw = Math.atan2(-dir.x, -dir.z);
    h.setYaw?.(yaw); if (h.kind !== 'player') h.model.rotation.y = yaw;
    if (g.from === 'front' && t.kind !== 'player') t.model.rotation.y += THREE.MathUtils.euclideanModulo(yaw + Math.PI - t.model.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
  }

  // ── Per frame, after movement and AI.
  function simulate(dt) {
    if (dt <= 0) return;
    clock += dt;
    for (const a of actors.values()) {
      const p = a.pos(), s = a.state();
      a.vel.x = (p.x - a.last.x) / dt; a.vel.z = (p.z - a.last.z) / dt;
      const speed = Math.hypot(a.vel.x, a.vel.z);
      if (speed > .2 && speed < 30) { const ahead = standY(p.x + a.vel.x / speed * .6, p.z + a.vel.z / speed * .6, p.y), behind = standY(p.x - a.vel.x / speed * .6, p.z - a.vel.z / speed * .6, p.y);
        a.slope += (THREE.MathUtils.clamp((ahead - behind) / 1.2, -1, 1) - a.slope) * (1 - Math.exp(-dt * 4)); }
      else a.slope *= Math.exp(-dt * 3);
      a.last.copy(p);
      if (s.dead) { if (a.grip) endGrip(a.grip); a.down = null; a.getup = null; continue; }
      // Wounds fade as health comes back.
      if ((s.hp ?? 1) / (s.maxHp ?? 1) > .8) for (const k in a.injury) a.injury[k] = Math.max(0, a.injury[k] - dt * .08);
      if (a.down) {
        a.down.t += dt;
        const hips = a.down.ragdoll.parts.find(q => q.name === 'hips')?.body, lv = hips?.linvel();
        a.down.still = lv && Math.hypot(lv.x, lv.y, lv.z) < .35 ? a.down.still + dt : 0;
        // The root stays where the fall began: moving it would drag a resting ragdoll along.
        if (!a.down.held && (a.down.t > 1.4 && a.down.still > .5 || a.down.t > 5.5) && (hooks.mayGetUp?.(a) ?? true)) getUp(a);
        continue;
      }
      if (a.getup) { a.getup.t += dt; if (a.getup.t >= a.getup.dur) { a.getup = null; a.balance.stage = 'steady'; a.balance.stability = .55; hooks.event?.('up', a, null, {}); } continue; }
      if (a.movable === false) { stepBalance(a.balance, dt); continue; }
      const { dx, dz } = stepBalance(a.balance, dt);
      // Held bodies never settle: whoever holds them keeps them off their feet.
      if (a.grip?.target === a && isActive(a.grip)) a.balance.stability = Math.max(0, a.balance.stability - .3 * dt);
      if (dx || dz) {
        if (!tryMove(a, dx, dz)) {
          const stepDir = { x: a.balance.step.x, z: a.balance.step.z };
          const hit = obstacle(p, stepDir, .8);
          if (hit?.low && a.balance.stage === 'major') knockDown(a, stepDir, 3, v3(0, 6, 0));
          else if (hit) { a.balance.braced = { point: v3(hit.point.x, p.y + 1.45 * sizeOf(a), hit.point.z), until: clock + .9 }; a.balance.step.left = 0; }
          else a.balance.step.left = 0;
        }
      }
      if (a.balance.braced && clock > a.balance.braced.until) a.balance.braced = null;
    }
    for (const g of [...grips]) simulateGrip(g, dt);
    for (const g of grips) g.jerk = Math.max(0, (g.jerk || 0) - dt);
  }

  /** Extra animator input for this body. */
  function animInput(model) {
    const a = actors.get(model); if (!a) return {};
    const s = a.state();
    const g = a.grip, role = g ? (g.holder === a ? 'holder' : 'held') : null;
    return {
      reaction: reactionPose(a.balance, yawOf(a)), injury: a.injury, slope: a.slope, heavy: s.armor || 0, fatigue: 1 - (s.stamina ?? 1),
      getup: a.getup ? { kind: a.getup.kind, progress: Math.min(1, a.getup.t / a.getup.dur) } : null,
      grapple: g && g.state !== 'Done' ? { role, state: g.state, jerk: g.jerk || 0, pinned: g.wall ? 1 : 0 } : null,
      shift: a.presence.shift, warm: a.presence.kind === 'warm',
    };
  }
  const isDown = model => !!actors.get(model)?.down;
  /** Bodies that cannot act on their own right now (down, getting up, taken down). */
  function locked(model) {
    const a = actors.get(model); if (!a) return false;
    if (a.down || a.getup) return true;
    const g = a.grip;
    return !!g && (g.state === 'Takedown' || g.state === 'GroundControl' || (g.target === a && g.state === 'AttemptingGrab'));
  }
  const heldBy = model => { const a = actors.get(model), g = a?.grip; return g && g.target === a && isActive(g) ? g.holder.model : null; };
  const holding = model => { const a = actors.get(model), g = a?.grip; return g && g.holder === a && g.state !== 'Done' ? g.target.model : null; };

  // ── Layer G, presence: idle people glance about, shift their weight, warm their hands at a fire.
  function presence(a, dt, viewer) {
    const s = a.state(), pr = a.presence, idle = s.idle && (a.animator?.speed ?? 0) < .15;
    if (!idle) { pr.kind = null; pr.shift *= Math.exp(-dt * 3); pr.look = null; return; }
    pr.next -= dt;
    const p = a.pos();
    const fire = fires.find(f => Math.hypot(f.x - p.x, f.z - p.z) < 3.2);
    if (pr.next <= 0) {
      pr.next = 3 + Math.random() * 6;
      const roll = Math.random();
      if (fire && roll < .5) { pr.kind = 'warm'; pr.look = v3(fire.x, fire.y + .3, fire.z); }
      else if (roll < .7) {
        // Glance at someone nearby, or somewhere along the way.
        const others = [...actors.values()].filter(o => o !== a && !o.state().dead && o.pos().distanceTo(p) < 10);
        const o = others[Math.floor(Math.random() * others.length)];
        pr.kind = 'glance'; pr.look = o ? o.pos().clone().add(v3(0, 2, 0)) : p.clone().add(v3(Math.random() * 8 - 4, 1.8, Math.random() * 8 - 4));
      } else { pr.kind = 'shift'; pr.look = null; pr.side = Math.random() < .5 ? -1 : 1; }
      pr.until = clock + 1.6 + Math.random() * 2.5;
    }
    if (clock > pr.until && pr.kind !== 'shift') { pr.kind = null; pr.look = null; }
    pr.shift += ((pr.kind === 'shift' ? pr.side : 0) - pr.shift) * (1 - Math.exp(-dt * 2.5));
    // Too close for comfort: look at whoever crowds you.
    if (viewer && viewer.distanceTo(p) < 1.3) { pr.near += dt; if (pr.near > .4) pr.look = viewer.clone().add(v3(0, 2.1, 0)); } else pr.near = 0;
  }
  const lookFor = model => actors.get(model)?.presence.look || null;

  // ── After the animator: IK and blends on top of the animated pose.
  function afterAnimate(dt, viewer) {
    const t0 = performance.now();
    stats.feet = 0; stats.full = 0;
    for (const a of actors.values()) {
      const s = a.state(); a.dist = viewer ? a.pos().distanceTo(viewer) : 0;
      if (s.dead || a.down || !a.model.visible) continue;
      const rig = a.model.userData.rig; if (!rig?.hips) continue;
      const full = a.dist < LOD.full;
      if (full) { stats.full++; presence(a, dt, a.kind === 'player' ? null : viewer); }
      if (a.getup && a.getup.t < .4) blendToPose(rig, a.getup.captured, 1 - a.getup.t / .4, BONES);
      if (a.dist < LOD.feet && a.feetOn) {
        const getupWeight = a.getup ? THREE.MathUtils.smoothstep(a.getup.t / a.getup.dur, .55, .95) : 1;
        const weight = (s.feet ?? 1) * getupWeight;
        const y = a.pos().y;
        a.feet.update(dt, { groundY: (x, z) => standY(x, z, y, .07), normal: (x, z, out) => normalAt(x, z, y, out), contact: a.animator?.contact, weight, moving: a.animator?.speed ?? 0 });
        stats.feet++;
      }
      if (!full) continue;
      // A hand on the wall that stopped a stagger.
      if (a.balance.braced) reachHand(a, a.balance.braced.point, 'auto', .9);
      const g = a.grip;
      if (g && g.state !== 'Done' && g.state !== 'Recovering') gripHands(a, g);
    }
    stats.ms = performance.now() - t0;
  }
  function reachHand(a, point, side, weight = 1, pole = null) {
    const rig = a.model.userData.rig;
    if (side === 'auto') { rig.hand_left.getWorldPosition(_a); rig.hand_right.getWorldPosition(_b); side = _a.distanceTo(point) < _b.distanceTo(point) ? 'left' : 'right'; }
    const upper = rig[`arm_upper_${side}`], lower = rig[`arm_lower_${side}`], end = rig[`grip_${side}`] || rig[`hand_${side}`];
    if (!upper || !lower || !end) return null;
    lower.getWorldPosition(_c);
    const elbowOut = pole || _c.clone().add(v3(0, -.6, 0)).addScaledVector(_d.set(Math.cos(yawOf(a)), 0, -Math.sin(yawOf(a))), side === 'right' ? .5 : -.5);
    return applyTwoBone(upper, lower, end, point, elbowOut, { weight, maxFlex: 2.5 });
  }
  function gripHands(a, g) {
    const t = g.target, h = g.holder, size = sizeOf(t);
    const reachIn = g.state === 'AttemptingGrab' ? Math.min(1, g.t / GRIP.reach) : g.state === 'Releasing' || g.state === 'Escaping' || g.state === 'Interrupted' ? Math.max(0, 1 - g.t / .25) : 1;
    if (a === h) {
      if (g.state === 'GroundControl' || g.state === 'Takedown') {
        const chest = t.down?.ragdoll.parts.find(p => p.name === 'chest')?.body.translation();
        if (chest) { reachHand(a, _a.set(chest.x, chest.y + .05, chest.z), 'left', 1); reachHand(a, _b.set(chest.x, chest.y + .1, chest.z).addScaledVector(forward(a, _c), .1), 'right', .8); }
        return;
      }
      // The collar on the near side (or the shoulder from behind).
      const rig = t.model.userData.rig; if (!rig?.chest) return;
      rig.chest.getWorldPosition(_a); _a.y += .32 * size;
      const toH = _b.copy(h.pos()).sub(t.pos()).setY(0).normalize();
      _a.addScaledVector(toH, .2 * size).addScaledVector(_c.set(-toH.z, 0, toH.x), .12 * size);
      const r = reachHand(a, _a, 'left', reachIn);
      if (r && !r.reached && r.stretch > 1.15 && g.state === 'AttemptingGrab') g.interrupt = true;
      if (h.state().handFree === 'both') reachHand(a, _a.addScaledVector(_c, -.28 * size), 'right', reachIn * .9);
    } else if (g.state === 'Struggling' || g.state === 'OffBalance') {
      // The held one works against the hand: their free hand pushes at the holder's forearm.
      const arm = h.model.userData.rig?.arm_lower_left; if (!arm) return;
      arm.getWorldPosition(_a); _a.y -= .1;
      reachHand(a, _a, 'right', .55 + (g.jerk > 0 ? .4 : 0));
      if (g.wall) reachHand(a, _b.set(g.wall.point.x, a.pos().y + 1.4 * size, g.wall.point.z), 'left', .85);
    }
  }

  function addFire(position) { fires.push(position.clone ? position.clone() : v3(position.x, position.y || 0, position.z)); }
  function reset() { for (const g of [...grips]) endGrip(g); for (const a of actors.values()) { if (a.down) { a.down.ragdoll.dispose(); a.down = null; } a.getup = null; a.balance = createBalance(); for (const k in a.injury) a.injury[k] = 0; a.feet.reset(); } }
  function state() {
    return { actors: actors.size, grips: [...grips].map(g => ({ holder: g.holder.kind, target: g.target.kind, state: g.state, grip: +g.grip.toFixed(2), pinned: !!g.wall })),
      down: [...actors.values()].filter(a => a.down).length, gettingUp: [...actors.values()].filter(a => a.getup).length, ...stats };
  }
  function debugActor(model) {
    const a = actors.get(model); if (!a) return null;
    return { stage: a.balance.stage, stability: +a.balance.stability.toFixed(2), injury: { ...a.injury }, down: !!a.down, getup: a.getup?.kind || null, grip: a.grip?.state || null,
      feet: Object.fromEntries(['right', 'left'].map(s => [s, { locked: a.feet.feet[s].locked, contact: +a.feet.feet[s].contact.toFixed(2), y: +a.feet.feet[s].target.y.toFixed(3) }])), drop: +(a.feet.debug.drop || 0).toFixed(3),
      slope: +a.slope.toFixed(2), presence: a.presence.kind, missing: a.adapter.missing() };
  }

  return { add, remove, get, standY, impact, knockDown: (model, dir, force) => { const a = actors.get(model); return a ? knockDown(a, dir, force) : false; },
    grab, command, simulate, animInput, afterAnimate, isDown, locked, heldBy, holding, lookFor, addFire, reset, state, debugActor, actors, grips, LOD };
}
