import * as THREE from 'three';
import { createHorseAnimator, GAITS, LEGS } from '../characters/horseAnimator.js';
import { seatRider, sideSpot } from '../characters/rider.js';
import { canopiesNear } from '../world/trees.js';
import { WATER_LEVEL } from '../world/hemland.js';

// HORSES — riding in Hemland, with Red Dead Redemption 2 as the model for how it feels: a horse is an animal
// with weight and a will, not a vehicle. W asks for a trot, each tap of Shift spurs it on a step (canter,
// gallop) and holding Shift keeps the pace while its stamina lasts; S reins in and backs up, Caps Lock keeps a
// walk, Space jumps (standing: it rears). It turns toward where you look, wider the faster it goes, and stops
// at a wall instead of sliding along it. On foot you lead it by the reins (T), tie it to a hitching rail or a
// tree (E), mount from the side you stand on (E) and whistle it to you (H). Tied, it rests a leg, swishes its
// tail and paws the ground; let go, it grazes. Riders travel the king's road alone or in company, keep to the
// right and slow down behind whoever blocks the way.
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const wrap = a => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// The paces a rider asks for, from Caps Lock's walk to the second spur's gallop (units/s).
export const RIDE_SPEEDS = [GAITS.walk.speed, GAITS.trot.speed, GAITS.canter.speed, GAITS.gallop.speed];
export const MOUNT_TIME = 1.35, DISMOUNT_TIME = 1.1;
const BODY = { front: 1.15, back: 1.0, radius: .55 };

/**
 * The rider's half of the controls (pure): which pace the horse is asked for this step.
 * ride: { level: 0 walk … 3 gallop, decay: s since the last spur, stamina: 0..100, refused: s of head-tossing }
 * controls: { moving (a direction is held), spur (Shift went down), hold (Shift is held), walk (Caps Lock) }
 * Returns the wished speed.
 */
export function rideStep(ride, controls, dt) {
  const base = controls.walk ? 0 : 1;
  // Caps Lock turned on: back to a walk at once; turned off: up to the trot.
  if (!!controls.walk !== !!ride.walk) { ride.level = base; ride.walk = !!controls.walk; }
  ride.level = Math.max(ride.level ?? base, base);
  ride.refused = Math.max(0, (ride.refused || 0) - dt);
  if (controls.spur && controls.moving) {
    if (ride.stamina > 10) { ride.level = Math.min(3, ride.level + 1); ride.stamina -= 5; ride.decay = 0; }
    else ride.refused = .8;
  }
  ride.decay = controls.hold ? 0 : (ride.decay || 0) + dt;
  // Without the spur held the pace falls back a step every couple of seconds, down to the cruising gait.
  if (!controls.hold && ride.level > base && ride.decay > 2.4) { ride.level--; ride.decay = 0; }
  const cost = !controls.moving ? -9 : ride.level === 3 ? 6.5 : ride.level === 2 ? 1.2 : -4;
  ride.stamina = clamp(ride.stamina - cost * dt, 0, 100);
  // A spent horse drops back by itself.
  if (ride.stamina < 1 && ride.level === 3) ride.level = 2;
  if (!controls.moving) ride.level = base;
  return controls.moving ? RIDE_SPEEDS[ride.level] : 0;
}

/** A sagging rope from a to b with `slack` extra length: n points into out (Vector3s), a parabola. */
export function ropePoints(a, b, slack, out) {
  const n = out.length, sag = Math.min(1.4, Math.sqrt(Math.max(0, slack) * a.distanceTo(b) * .375) + .02);
  for (let i = 0; i < n; i++) { const t = i / (n - 1); out[i].lerpVectors(a, b, t); out[i].y -= sag * 4 * t * (1 - t); }
  return out;
}

/**
 * world: heightAt, blocked(x, z, r, y, h), nearRoad; createCharacter(name) → model; sound(kind, at, strength)
 * for hooves and voices; bark(at, line) for riders' words.
 */
export function createHorses({ scene, world, createCharacter, sound = () => {}, bark = () => {}, print = () => {} }) {
  const horses = [], ties = [], riders = [], groups = [];
  let nextId = 1;

  // ── Tie points: hitching rails and posts placed by the world; any tree trunk will do as well.
  function addTie(point) { ties.push({ radius: 1.6, ...point }); return point; }
  function tieNear(x, z, reach = 2.3) {
    let best = null, bd = reach;
    for (const p of ties) { const d = distanceToTie(p, x, z); if (d < bd) { bd = d; best = p; } }
    for (const c of canopiesNear(x, z, reach + .6)) {
      const d = Math.hypot(c.x - x, c.z - z) - .45;
      if (d < bd) { bd = d; best = { id: `tree:${c.x.toFixed(1)}:${c.z.toFixed(1)}`, kind: 'tree', x: c.x, z: c.z, y: world.heightAt(c.x, c.z) + 1.25, radius: .45 }; }
    }
    return best;
  }
  // Rails are a segment (x, z) → (x2, z2): the nearest point on it.
  function railPoint(p, x, z, out = v3()) {
    if (p.x2 === undefined) return out.set(p.x, p.y, p.z);
    const dx = p.x2 - p.x, dz = p.z2 - p.z, t = clamp(((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz), .12, .88);
    return out.set(p.x + dx * t, p.y, p.z + dz * t);
  }
  const _rail = v3();
  function distanceToTie(p, x, z) { railPoint(p, x, z, _rail); return Math.hypot(_rail.x - x, _rail.z - z); }

  // ── Horses.
  function add({ variant = 'bay', name = 'Pferd', x, z, yaw = 0, mode = 'free', owner = 'npc', tie = null }) {
    // Tied without a place given: whichever side of the rail has room.
    if (tie && x === undefined) {
      const mx = tie.x2 === undefined ? tie.x : (tie.x + tie.x2) / 2, mz = tie.z2 === undefined ? tie.z : (tie.z + tie.z2) / 2;
      const nx = tie.x2 === undefined ? 1 : -(tie.z2 - tie.z), nz = tie.x2 === undefined ? 0 : tie.x2 - tie.x, l = Math.hypot(nx, nz);
      const free = s => !world.blocked(mx + nx / l * 2.2 * s, mz + nz / l * 2.2 * s, .8);
      const s = free(1) || !free(-1) ? 1 : -1; x = mx + nx / l * 1.5 * s; z = mz + nz / l * 1.5 * s;
    }
    const model = createCharacter(`horse_${variant}`);
    const h = { id: nextId++, name, variant, owner, model, animator: null, pos: v3(x, world.heightAt(x, z), z), yaw, speed: 0, vy: 0, airborne: false, pitch: 0,
      mode, tie: null, home: v3(x, 0, z), target: null, wait: 2 + Math.random() * 6, stamina: 100, ride: { level: 1, decay: 0, stamina: 100 }, rear: 0, rearT: 0,
      rider: null, stuck: 0, lastPos: v3(x, 0, z), reins: null, voiceAt: 4 + Math.random() * 10, prevPos: v3(), prevYaw: yaw };
    model.position.copy(h.pos); model.rotation.y = yaw;
    h.animator = createHorseAnimator(model);
    scene.add(model);
    horses.push(h);
    if (tie) place(h, { x, z, tie });
    makeReins(h);
    return h;
  }

  // Reins: two leather straps from the bit rings to the rider's hands, the leading hand, the rail, or lying over
  // the neck to the pommel; each a chain of thin boxes along a sagging curve, rebuilt every frame.
  const reinMaterial = new THREE.MeshLambertMaterial({ color: 0x3d2819, side: THREE.DoubleSide });
  const STRAP = { segments: 11, width: .075, thick: .03 };
  function makeReins(h) {
    const make = () => {
      const n = STRAP.segments, geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 72), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 72), 3));
      const mesh = new THREE.Mesh(geometry, reinMaterial); mesh.frustumCulled = false; mesh.name = 'rein'; scene.add(mesh);
      return { mesh, points: Array.from({ length: n + 1 }, () => v3()) };
    };
    h.reins = [make(), make()];
  }
  const UP = v3(0, 1, 0), _d = v3(), _s = v3(), _u = v3(), _ca = [v3(), v3(), v3(), v3()], _cb = [v3(), v3(), v3(), v3()];
  // Four long faces per segment (the ends meet the next segment); corners 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left.
  const FACES = [[0, 1, _u, 1], [3, 2, _u, -1], [1, 2, _s, 1], [0, 3, _s, -1]];
  function writeStrap(geometry, points) {
    const pos = geometry.attributes.position.array, nor = geometry.attributes.normal.array, hw = STRAP.width / 2, ht = STRAP.thick / 2;
    let k = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      _d.subVectors(b, a); if (_d.lengthSq() < 1e-10) _d.set(0, -1, 0); _d.normalize();
      _s.crossVectors(_d, UP); if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0); _s.normalize(); _u.crossVectors(_s, _d).normalize();
      for (const [c, p] of [[_ca, a], [_cb, b]]) {
        c[0].copy(p).addScaledVector(_s, -hw).addScaledVector(_u, ht); c[1].copy(p).addScaledVector(_s, hw).addScaledVector(_u, ht);
        c[2].copy(p).addScaledVector(_s, hw).addScaledVector(_u, -ht); c[3].copy(p).addScaledVector(_s, -hw).addScaledVector(_u, -ht);
      }
      for (const [i0, i1, n, sign] of FACES) for (const v of [_ca[i0], _cb[i0], _cb[i1], _ca[i0], _cb[i1], _ca[i1]]) {
        pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z; nor[k] = n.x * sign; nor[k + 1] = n.y * sign; nor[k + 2] = n.z * sign; k += 3;
      }
    }
    geometry.attributes.position.needsUpdate = true; geometry.attributes.normal.needsUpdate = true;
  }
  const _bit = v3(), _head = new THREE.Quaternion(), _side = v3(), _end = v3(), _pommel = v3();
  function drawReins(h, ends) {
    const rig = h.model.userData.rig;
    rig.bit.getWorldPosition(_bit); rig.head.getWorldQuaternion(_head); _side.set(1, 0, 0).applyQuaternion(_head);
    h.reins.forEach((rein, i) => {
      const s = i ? 1 : -1, a = _bit.clone().addScaledVector(_side, s * .2), end = ends[i];
      ropePoints(a, end.at, end.slack ?? .25, rein.points);
      writeStrap(rein.mesh.geometry, rein.points);
      rein.mesh.visible = h.model.visible;
    });
  }

  /** Puts a horse somewhere at once (loading a save, a new game): free, or tied to `tie` at its place there. */
  function place(h, { x = h.pos.x, z = h.pos.z, yaw = h.yaw, tie = null } = {}) {
    if (led === h) led = null;
    h.rider = null; h.speed = 0; h.airborne = false; h.vy = 0; h.target = null; h.rearT = 0;
    if (tie) { h.pos.set(x, 0, z); tieTo(h, tie); x = h.tie.stand.x; z = h.tie.stand.z; yaw = Math.atan2(x - h.tie.at.x, z - h.tie.at.z); }
    else { h.mode = 'free'; h.tie = null; }
    h.pos.set(x, world.heightAt(x, z), z); h.yaw = yaw; h.home.copy(h.pos); h.prevPos.copy(h.pos); h.prevYaw = yaw;
    h.model.position.copy(h.pos); h.model.rotation.y = yaw;
  }
  /** A tie point by its id: a rail the world placed, or a tree ('tree:x:z'). */
  function tieById(id) {
    if (!id) return null;
    if (id.startsWith('tree:')) { const [, x, z] = id.split(':').map(Number); return Number.isFinite(x) && Number.isFinite(z) ? { id, kind: 'tree', x, z, y: world.heightAt(x, z) + 1.25, radius: .45 } : null; }
    return ties.find(t => t.id === id) || null;
  }

  function tieTo(h, point) {
    railPoint(point, h.pos.x, h.pos.z, _rail);
    // The horse stands square to the rail, its head at it.
    const away = v3(h.pos.x - _rail.x, 0, h.pos.z - _rail.z);
    if (away.lengthSq() < .01) away.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    if (point.x2 !== undefined) { const nx = -(point.z2 - point.z), nz = point.x2 - point.x, l = Math.hypot(nx, nz); const sgn = Math.sign(away.x * nx + away.z * nz) || 1; away.set(nx / l * sgn, 0, nz / l * sgn); }
    away.normalize();
    h.tie = { point, at: _rail.clone(), stand: v3(_rail.x + away.x * 2.2, 0, _rail.z + away.z * 2.2) };
    h.mode = 'tied'; h.target = null;
  }

  // ── Movement with weight: speed eases toward the wish, the body turns toward the wished heading as fast as
  // the pace allows, and it moves only where its chest, middle and hips all fit.
  const _f = v3();
  function fits(h, x, z, yaw, y = h.pos.y) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const [k, r] of [[BODY.front, BODY.radius], [0, .7], [-BODY.back, BODY.radius]]) {
      const px = x + fx * k, pz = z + fz * k, ground = world.heightAt(px, pz);
      if (world.blocked(px, pz, r, Math.max(ground, y) + .25, 2.2)) return false;
      if (WATER_LEVEL - world.terrainHeightAt(px, pz) > 1.45) return false;
      if (ground - y > .9 && !h.airborne) return false;
    }
    return true;
  }
  function move(h, wishSpeed, wishYaw, dt, { accel = 3.6, brake = 9, turn = null, free = false } = {}) {
    const rate = wishSpeed > h.speed ? (h.speed < 3 ? accel * 1.4 : accel) : Math.abs(wishSpeed) < .05 ? brake * .6 : brake;
    h.speed += clamp(wishSpeed - h.speed, -rate * dt, rate * dt);
    if (wishYaw !== null) {
      const turnRate = turn ?? lerp(2.4, 1.05, clamp(Math.abs(h.speed) / 13.5, 0, 1));
      h.yaw += clamp(wrap(wishYaw - h.yaw), -turnRate * dt, turnRate * dt);
    }
    // Wading slows a horse down.
    const depth = WATER_LEVEL - world.terrainHeightAt(h.pos.x, h.pos.z);
    const wade = depth > .3 ? clamp(1 - (depth - .3) * .45, .45, 1) : 1;
    const step = h.speed * wade * dt;
    _f.set(-Math.sin(h.yaw) * step, 0, -Math.cos(h.yaw) * step);
    const nx = h.pos.x + _f.x, nz = h.pos.z + _f.z;
    if (Math.abs(step) > 1e-5) {
      if (free || fits(h, nx, nz, h.yaw)) { h.pos.x = nx; h.pos.z = nz; }
      else {
        // Into a wall at speed: it skids and rears; slower it just stops.
        if (h.speed > 8.5 && !h.rearT) { h.rearT = 1.1; sound('neigh', h.pos, 1); }
        h.speed *= .2; h.blocked = .4;
      }
    }
    h.blocked = Math.max(0, (h.blocked || 0) - dt);
    // Height: the ground under its middle, a jump's arc; pitch from the ground under chest and hips.
    const ground = world.heightAt(h.pos.x, h.pos.z);
    if (h.airborne) {
      h.vy -= 17 * dt; h.pos.y += h.vy * dt;
      if (h.pos.y <= ground) { h.pos.y = ground; h.airborne = false; h.vy = 0; sound('land', h.pos, 1); }
    } else h.pos.y = damp(h.pos.y, ground, 18, dt);
    const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
    const front = world.heightAt(h.pos.x + fx * BODY.front, h.pos.z + fz * BODY.front), back = world.heightAt(h.pos.x - fx * BODY.back, h.pos.z - fz * BODY.back);
    h.pitch = damp(h.pitch, clamp(Math.atan2(front - back, BODY.front + BODY.back), -.35, .35), 8, dt);
  }
  function faceAndStop(h, x, z, dt) { move(h, 0, Math.atan2(h.pos.x - x, h.pos.z - z), dt, { turn: 1.2 }); }

  // ── Behaviour on its own: tied, free (grazing, wandering a little), led, coming to a whistle.
  function think(h, dt, player) {
    const p = h.pos;
    switch (h.mode) {
      case 'tied': {
        const s = h.tie.stand, d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d > .25) move(h, Math.min(2.2, d * 1.6), Math.atan2(p.x - s.x, p.z - s.z), dt, { turn: 2 });
        else faceAndStop(h, h.tie.at.x, h.tie.at.z, dt);
        break;
      }
      case 'free': {
        h.wait -= dt;
        if (h.target) {
          const d = Math.hypot(h.target.x - p.x, h.target.z - p.z);
          if (d < .4 || h.blocked) { h.target = null; h.wait = 6 + Math.random() * 12; }
          else move(h, Math.min(1.3, d), Math.atan2(p.x - h.target.x, p.z - h.target.z), dt, { turn: 1.4 });
        } else {
          move(h, 0, null, dt);
          if (h.wait <= 0 && !h.animator.grazing) {
            const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 4;
            const x = h.home.x + Math.cos(a) * r, z = h.home.z + Math.sin(a) * r;
            if (fits(h, x, z, h.yaw)) h.target = v3(x, 0, z); else h.wait = 3;
          }
        }
        break;
      }
      case 'led': {
        // Follows the hand at the length of the reins: walks up when they tighten, stands when they slacken.
        const hand = player.position, d = Math.hypot(hand.x - p.x, hand.z - p.z);
        if (d > 7) { dropReins(h); break; }
        const want = d > 2.3 ? Math.min(6.2, (d - 2.0) * 2.6) : 0;
        move(h, want, want > 0 || d > 1.8 ? Math.atan2(p.x - hand.x, p.z - hand.z) : null, dt, { accel: 5, brake: 7, turn: 2.6 });
        break;
      }
      case 'come': {
        const d = Math.hypot(player.position.x - p.x, player.position.z - p.z);
        if (d < 3.4) { h.mode = 'free'; h.home.copy(p); h.wait = 4; move(h, 0, null, dt); break; }
        const want = d > 40 ? RIDE_SPEEDS[2] : d > 14 ? RIDE_SPEEDS[1] : RIDE_SPEEDS[0];
        // Around obstacles: try the heading, then a little to either side.
        let yaw = Math.atan2(p.x - player.position.x, p.z - player.position.z);
        if (h.blocked) h.detour = (h.detour || (Math.random() < .5 ? -1 : 1));
        if (h.detour) { yaw += h.detour * .9; h.detourT = (h.detourT || 0) + dt; if (h.detourT > 1.6) { h.detour = 0; h.detourT = 0; } }
        move(h, want, yaw, dt);
        break;
      }
    }
  }

  // ── The wanderer and their horse: leading, tying, mounting, riding, whistling.
  let led = null, ride = null, mouseIdle = 0;
  function nearest(x, z, reach = 3.3) {
    let best = null, bd = reach;
    for (const h of horses) { if (h.rider && h.rider !== 'player' || h.mode === 'travel') continue; const d = Math.hypot(h.pos.x - x, h.pos.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  function lead(h) {
    if (led && led !== h) dropReins(led);
    h.mode = 'led'; h.tie = null; h.target = null; led = h; sound('snort', h.pos, .6);
  }
  function dropReins(h) { if (h.mode === 'led') { h.mode = 'free'; h.home.copy(h.pos); h.wait = 5; } if (led === h) led = null; }
  function tie(h, point) { if (led === h) led = null; tieTo(h, point); sound('snort', h.pos, .4); }
  function mount(h, player) {
    if (ride) return false;
    // Mount from the side you stand on.
    const right = Math.cos(h.yaw) * (player.position.x - h.pos.x) - Math.sin(h.yaw) * (player.position.z - h.pos.z);
    const side = right >= 0 ? 1 : -1;
    if (led === h) led = null;
    h.mode = 'ridden'; h.tie = null; h.target = null; h.rider = 'player'; h.speed = 0;
    ride = { horse: h, kind: 'mount', t: 0, side, from: player.position.clone(), fromYaw: player.modelYaw ?? player.yaw, lean: 0 };
    sound('snort', h.pos, .5);
    return true;
  }
  function dismount(player, instant = false) {
    if (!ride || ride.kind !== 'ride' && !instant) return false;
    const h = ride.horse;
    // Step down on the left if there is room, else on the right.
    let side = -1; sideSpot(h, side, _end);
    if (world.blocked(_end.x, _end.z, .4, world.heightAt(_end.x, _end.z))) { side = 1; sideSpot(h, side, _end); }
    _end.y = world.heightAt(_end.x, _end.z);
    if (instant) { finishDismount(player, _end.clone()); return true; }
    ride.kind = 'dismount'; ride.t = 0; ride.side = side; ride.to = _end.clone();
    h.speed = 0;
    return true;
  }
  function finishDismount(player, at) {
    const h = ride.horse;
    player.position.copy(at); h.rider = null; h.mode = 'free'; h.home.copy(h.pos); h.wait = 6; h.ride.level = 1;
    ride = null;
  }
  function whistle(player) {
    sound('whistle', player.position, 1);
    const h = horses.find(o => o.owner === 'player');
    if (!h || h.rider) return null;
    if (h.mode === 'tied') { sound('neigh', h.pos, .8); return 'tied'; }
    const d = h.pos.distanceTo(player.position);
    // Too far to hear: it was grazing somewhere behind you all along.
    if (d > 150) {
      for (let k = 0; k < 12; k++) {
        const a = player.yaw + (Math.random() - .5) * 1.6, r = 34 + Math.random() * 12;
        const x = player.position.x + Math.sin(a) * r, z = player.position.z + Math.cos(a) * r;
        if (fits(h, x, z, h.yaw, world.heightAt(x, z))) { h.pos.set(x, world.heightAt(x, z), z); h.model.position.copy(h.pos); h.animator.update(.001, {}); break; }
      }
    }
    if (led === h) led = null;
    h.mode = 'come'; h.tie = null; h.target = null; sound('neigh', h.pos, .7);
    return 'come';
  }

  /**
   * One simulation step of the wanderer's ride. controls: { forward, strafe (−1..1), cameraYaw, spur, hold,
   * walk, brake, jump, mouseMoved }. Moves the horse and returns the wanderer's ground position (the horse's).
   */
  function control(controls, dt, player) {
    if (!ride) return;
    const h = ride.horse;
    if (ride.kind !== 'ride') {
      ride.t += dt / (ride.kind === 'mount' ? MOUNT_TIME : DISMOUNT_TIME);
      move(h, 0, null, dt);
      if (ride.t >= 1) { if (ride.kind === 'mount') { ride.kind = 'ride'; ride.t = 1; } else { finishDismount(player, ride.to); return; } }
      player.position.copy(ride.kind === 'dismount' ? ride.to : h.pos);
      return;
    }
    const { forward, strafe } = controls, moving = Math.abs(forward) > .1 || Math.abs(strafe) > .1;
    let wishYaw = null;
    if (moving && !(forward < -.1 && Math.abs(strafe) < .1)) {
      // Camera-relative: W goes where you look, A and D bend that way.
      const mx = -Math.sin(controls.cameraYaw) * Math.max(0, forward) + Math.cos(controls.cameraYaw) * strafe, mz = -Math.cos(controls.cameraYaw) * Math.max(0, forward) - Math.sin(controls.cameraYaw) * strafe;
      wishYaw = Math.atan2(-mx, -mz);
    }
    const backing = forward < -.1;
    const wish = backing ? (h.speed > .3 ? 0 : -1.4) : rideStep(h.ride, { moving: moving && !backing, spur: controls.spur, hold: controls.hold, walk: controls.walk }, dt);
    if (backing) h.ride.level = controls.walk ? 0 : 1;
    if (controls.jump && !h.airborne) {
      if (h.speed > 4 && h.ride.stamina > 12) { h.airborne = true; h.vy = 6.2; h.ride.stamina -= 10; sound('snort', h.pos, .8); }
      else if (h.speed < 1 && !h.rearT) { h.rearT = 1.6; sound('neigh', h.pos, 1); }
    }
    if (h.ride.refused > .7) sound('snort', h.pos, .8);
    if (h.rearT) { move(h, 0, null, dt); }
    else move(h, wish, wishYaw, dt, { accel: wish > 9 ? 3 : 3.8, brake: backing ? 11 : 6, turn: Math.abs(h.speed) < .6 && wishYaw !== null ? 1.7 : null });
    // Lean: into the spur, back when reining in.
    ride.lean = damp(ride.lean, backing && h.speed > 1 ? -.18 : 0, 6, dt);
    // RDR2's camera drifts back behind the horse when you leave the mouse alone at speed.
    mouseIdle = controls.mouseMoved ? 0 : mouseIdle + dt;
    if (mouseIdle > 1.4 && h.speed > 2.5) player.yaw += wrap(h.yaw - player.yaw) * (1 - Math.exp(-dt * .9));
    player.position.copy(h.pos);
  }

  // ── Riders on the roads: groups travel a road back and forth, each person on a horse, keeping right.
  /** route: [[x, z], …]; members: [{ horse (from add), model, animator }]; pace in units/s. */
  function addGroup({ route, members, pace = RIDE_SPEEDS[1], start = 0, dir = 1, spacing = 3.6, name = '', lines = [] }) {
    const lengths = [0];
    for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const g = { route, lengths, total: lengths.at(-1), s: start * lengths.at(-1), dir, pace, speed: pace, spacing, members, rest: 0, name, lines, greeted: 0, near: false };
    for (const m of members) { m.horse.mode = 'travel'; m.horse.rider = m; m.group = g; riders.push(m); }
    groups.push(g);
    // Everyone starts in their place in the column.
    travel(g, 0, { position: v3(1e5, 0, 1e5) }, false);
    for (const m of members) { const h = m.horse; h.pos.y = world.heightAt(h.pos.x, h.pos.z); h.prevPos.copy(h.pos); h.prevYaw = h.yaw; h.model.position.copy(h.pos); h.model.rotation.y = h.yaw; }
    return g;
  }
  function along(g, s, out) {
    const d = clamp(s, 0, g.total);
    let i = 1; while (i < g.lengths.length - 1 && g.lengths[i] < d) i++;
    const [ax, az] = g.route[i - 1], [bx, bz] = g.route[i], len = g.lengths[i] - g.lengths[i - 1] || 1, k = (d - g.lengths[i - 1]) / len;
    out.x = ax + (bx - ax) * k; out.z = az + (bz - az) * k; out.tx = (bx - ax) / len; out.tz = (bz - az) / len;
    return out;
  }
  const _at = { x: 0, z: 0, tx: 0, tz: 0 }, _ahead = { x: 0, z: 0, tx: 0, tz: 0 };
  function travel(g, dt, player, visible) {
    // Someone on the road ahead of the leader: the group slows and stops short of them.
    along(g, g.s, _at);
    const leader = g.members[0], fx = _at.tx * g.dir, fz = _at.tz * g.dir;
    const px = player.position.x - leader.horse.pos.x, pz = player.position.z - leader.horse.pos.z, ahead = px * fx + pz * fz, aside = Math.abs(-px * fz + pz * fx);
    const blocking = visible && ahead > 0 && ahead < 7 && aside < 2.6;
    if (g.rest > 0) { g.rest -= dt; g.speed = 0; }
    else g.speed = damp(g.speed, blocking ? 0 : g.pace, blocking ? 3 : 1.2, dt);
    if (blocking && !g.warned) { g.warned = true; bark(leader.model, g.lines.block || 'Aus dem Weg!'); }
    if (!blocking && ahead < -6) g.warned = false;
    g.s += g.speed * g.dir * dt;
    if (g.s <= 0 || g.s >= g.total) { g.s = clamp(g.s, 0, g.total); g.dir *= -1; g.rest = 12 + Math.random() * 18; }
    g.members.forEach((m, i) => {
      const h = m.horse, s = g.s - g.dir * i * g.spacing;
      along(g, s, _ahead);
      // Keep right of the road's middle; in pairs, the second rides beside the first.
      const side = 1.7 + (m.beside ? 1.5 : 0), dx = _ahead.tx * g.dir, dz = _ahead.tz * g.dir;
      const x = _ahead.x - dz * side, z = _ahead.z + dx * side;
      if (!visible) { h.pos.set(x, h.pos.y, z); h.yaw = Math.atan2(-dx, -dz); h.speed = g.speed; return; }
      const d = Math.hypot(x - h.pos.x, z - h.pos.z);
      move(h, Math.min(g.pace * 1.25, d > .5 ? g.speed + (d - .5) * 1.5 : g.speed * d / .5), d > .15 ? Math.atan2(h.pos.x - x, h.pos.z - z) : Math.atan2(-dx, -dz), dt, { turn: 2.2, free: true });
    });
    // A word in passing.
    const dist = Math.hypot(px, pz);
    if (visible && dist < 9 && !blocking && performance.now() - g.greeted > 40000 && g.lines.greet) { g.greeted = performance.now(); bark(leader.model, g.lines.greet[Math.floor(Math.random() * g.lines.greet.length)]); }
  }

  // ── The simulation step (60 Hz). capture() first, before anything moves a horse this step, so rendered
  // frames can interpolate between the last two steps.
  function capture() { for (const h of horses) { h.prevPos.copy(h.pos); h.prevYaw = h.yaw; } }
  function update(dt, player) {
    for (const g of groups) {
      along(g, g.s, _at);
      const visible = Math.hypot(_at.x - player.position.x, _at.z - player.position.z) < 230;
      if (visible && !g.near) for (const m of g.members) { m.horse.pos.y = world.heightAt(m.horse.pos.x, m.horse.pos.z); }
      g.near = visible;
      travel(g, dt, player, visible);
      for (const m of g.members) { m.horse.model.visible = visible; m.model.visible = visible; }
    }
    for (const h of horses) {
      if (h.rearT) { h.rearT = Math.max(0, h.rearT - dt); }
      if (h.mode === 'ridden' || h.mode === 'travel') continue;
      if (h.pos.distanceToSquared(player.position) > 250 * 250) continue;
      think(h, dt, player);
    }
    // Horses shoulder the wanderer aside when they walk into them.
    if (!ride) for (const h of horses) {
      if (!h.model.visible) continue;
      const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
      for (const k of [BODY.front * .8, 0, -BODY.back * .8]) {
        const cx = h.pos.x + fx * k, cz = h.pos.z + fz * k, dx = player.position.x - cx, dz = player.position.z - cz, d = Math.hypot(dx, dz), min = .95;
        if (d < min && Math.abs(player.position.y - h.pos.y) < 2) {
          const nx = d > 1e-3 ? dx / d : 1, nz = d > 1e-3 ? dz / d : 0, x = cx + nx * min, z = cz + nz * min;
          if (!world.blocked(x, z, .43, player.position.y)) { player.position.x = x; player.position.z = z; }
        }
      }
    }
  }

  // ── Per rendered frame: interpolated placement, animation, riders, reins, hooves and voices.
  const _look = v3(), _hand = v3(), _tieAt = v3(), _hoof = v3();
  function animate(dt, alpha, { player, playerModel, playerAnimator, camera, wind, groundAt, rider = {} }) {
    for (const h of horses) {
      if (!h.model.visible) continue;
      // Far horses are not animated; the wanderer's own always is (the camera follows it).
      const distance = h.pos.distanceTo(camera.position);
      if (distance > 160 && h.rider !== 'player' && h.mode !== 'led') continue;
      h.model.position.lerpVectors(h.prevPos, h.pos, alpha);
      h.model.rotation.y = h.prevYaw + wrap(h.yaw - h.prevYaw) * alpha;
      // Rearing rises and falls over the rear's time.
      const rearing = h.rearT ? Math.sin(Math.PI * clamp(1 - h.rearT / 1.6, 0, 1)) : 0;
      h.rear = damp(h.rear, rearing, 10, dt);
      const nearPlayer = !ride && h.pos.distanceTo(player.position) < 6;
      const look = h.mode === 'led' || nearPlayer ? _look.copy(player.position).setY(player.position.y + 2) : null;
      h.animator.update(dt, { look, wind, mode: h.mode === 'tied' ? 'tied' : h.mode === 'free' ? 'free' : h.mode === 'ridden' || h.mode === 'travel' ? 'ridden' : 'led',
        calm: h.mode !== 'free', airborne: h.airborne, vy: h.vy, rear: h.rear, slope: h.pitch });
      // Hooves: louder on the road, quieter far off; each shod hoof presses its print where it came down.
      for (const leg of h.animator.footfalls) {
        if (distance < 45) sound('hoof', h.model.position, clamp(1 - distance / 45, 0, 1) * (.35 + .65 * clamp(h.animator.speed / 10, 0, 1)), { road: world.nearRoad(h.pos.x, h.pos.z, 2.6), leg });
        if (distance < 40) { const [set, side] = LEGS[leg]; h.model.userData.rig[`${set}_hoof_${side}`]?.getWorldPosition(_hoof); print(_hoof.x, _hoof.z, h.model.rotation.y, h.pos.y); }
      }
      h.voiceAt -= dt;
      if (h.voiceAt <= 0) { h.voiceAt = 10 + Math.random() * 25; if (distance < 30) sound(Math.random() < .7 ? 'snort' : 'neigh', h.model.position, clamp(1 - distance / 30, 0, 1) * .7); }
    }
    // Riders on the roads.
    for (const m of riders) {
      if (!m.model.visible || m.horse.model.position.distanceTo(camera.position) > 140) continue;
      seatRider(m.model, m.animator, m.horse, { kind: 'ride', t: 1, side: -1 }, dt, { groundAt });
    }
    // The wanderer in the saddle (or getting into or out of it).
    if (ride) seatRider(playerModel, playerAnimator, ride.horse, ride, dt, { groundAt, ...rider, lookAt: ride.kind === 'ride' ? rider.lookAt : null });
    // Reins.
    for (const h of horses) {
      if (!h.model.visible || h.pos.distanceTo(camera.position) > 70) { for (const r of h.reins) r.mesh.visible = false; continue; }
      const rig = h.model.userData.rig;
      let ends;
      const riderModel = h.rider === 'player' ? (ride && ride.kind === 'ride' || ride?.kind === 'mount' && ride.t > .8 ? playerModel : null) : h.rider?.model;
      if (riderModel) {
        const r = riderModel.userData.rig;
        ends = [{ at: (r.grip_left || r.hand_left).getWorldPosition(v3()), slack: .12 }, { at: (r.grip_right || r.hand_right).getWorldPosition(v3()), slack: .12 }];
      } else if (h.mode === 'led') {
        (playerModel.userData.rig.grip_left || playerModel.userData.rig.hand_left).getWorldPosition(_hand);
        if (player.mode === 'first' || !playerModel.visible) _hand.copy(player.position).add(v3(-Math.cos(player.yaw) * .3, 1.15, Math.sin(player.yaw) * .3));
        const at = _hand.clone(), slack = Math.max(.08, 2.6 - at.distanceTo(rig.bit.getWorldPosition(_bit)));
        ends = [{ at, slack }, { at: at.clone(), slack }];
      } else if (h.mode === 'tied') {
        _tieAt.copy(h.tie.at); _tieAt.y = h.tie.point.y;
        ends = [{ at: _tieAt.clone(), slack: .3 }, { at: _tieAt.clone(), slack: .3 }];
      } else {
        rig.saddle.localToWorld(_pommel.set(-.14, .2, -.33));
        const a = _pommel.clone(); rig.saddle.localToWorld(_pommel.set(.14, .2, -.33));
        ends = [{ at: a, slack: .5 }, { at: _pommel.clone(), slack: .5 }];
      }
      drawReins(h, ends);
    }
  }

  return {
    horses, ties, groups, add, addTie, addGroup, tieNear, tieById, nearest, place, lead, dropReins, tie, mount, dismount, whistle, control, capture, update, animate,
    get led() { return led; }, get ride() { return ride; }, get riding() { return !!ride; }, get mounted() { return ride?.kind === 'ride'; },
    state: () => ({ horses: horses.map(h => ({ id: h.id, name: h.name, variant: h.variant, mode: h.mode, x: +h.pos.x.toFixed(1), z: +h.pos.z.toFixed(1), speed: +h.speed.toFixed(2), gait: h.animator.gait, stamina: +h.ride.stamina.toFixed(0), visible: h.model.visible })),
      ride: ride && { kind: ride.kind, t: +ride.t.toFixed(2), horse: ride.horse.name, level: ride.horse.ride.level }, led: led?.name ?? null, groups: groups.map(g => ({ name: g.name, s: +g.s.toFixed(0), dir: g.dir, speed: +g.speed.toFixed(1), near: g.near })) }),
  };
}
