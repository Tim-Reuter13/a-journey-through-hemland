import * as THREE from 'three';
import { traceSpellSurface } from './spellFx.js';
import { registerPixelTexture, pixelMaterial, TEXTURE_NAMES } from '../art/pixelTextures.js';

// The hunting bow. Hold to draw (full after BOW.drawTime), let go to loose; a half-drawn arrow flies
// slower and hurts less, holding full draw tires the arms. Arrows fly with gravity and a faint trail.
// Bodies are struck where the arrow really meets the model — a quick sphere test first, then a ray
// against the meshes — and the arrow rides on the bone it hit, through the ragdoll fall; the head
// counts more, the legs less. The world answers by what it is made of: stone throws the arrow off with
// sparks and a scratch, wood takes it with splinters and a notch, earth and the rest with dust.
// Arrows that stay somewhere can be pulled out again (E); some break.
export const BOW = { drawTime: .9, minDraw: .2, speed: [30, 76], gravity: 9, life: 6, length: 1.03, stuck: 40, reach: 2.6, cost: 9,
  headshot: 1.6, legs: .7, trail: 9, marks: 40, breaks: .2 };

if (!TEXTURE_NAMES().includes('arrowNotch')) {
  registerPixelTexture('arrowNotch', p => {
    p.clear();
    // A short split gouge with pale torn fibres round a dark centre.
    for (let x = 3; x < 13; x++) for (let y = 6; y < 10; y++) { const edge = y === 6 || y === 9 || x === 3 || x === 12; if (!edge || (x + y) % 3) p.set(x, y, edge ? '#c9a676' : (x * 7 + y) % 4 ? '#2a1c12' : '#3e2a1a'); }
    for (const [x, y] of [[2, 7], [13, 8], [5, 5], [10, 10], [8, 5]]) p.set(x, y, '#d8b888');
  }, { cutout: true });
  registerPixelTexture('arrowChip', p => {
    p.clear();
    // A bright scratch where the point glanced off, with a few chips.
    for (let x = 2; x < 14; x++) { const y = 8 + Math.round(Math.sin(x * .9) * .6); p.set(x, y, x % 3 ? '#d6d2c8' : '#f0ece2'); if (x > 4 && x < 11) p.set(x, y + 1, '#8f8b82'); }
    for (const [x, y] of [[4, 6], [9, 11], [12, 6], [6, 11]]) p.set(x, y, '#e4e0d6');
  }, { cutout: true });
}

/**
 * targets(): living enemies and animals ({ model, aim, radius, prey, kind }); strike(target, amount, from);
 * aim(origin, direction) fills where the arrow's nock leaves the bow and where it is aimed; ammo { count(), use(), add(n) };
 * damage(power); arrowModel() a fresh arrow (pivot at the nock, front −Z) or null; sound(kind); toast(text);
 * spray(point, direction, kind, count) for splinters, chips, sparks and dust; alert(enemy) when one is shot;
 * hurtPlayer(amount, from) when an enemy's arrow (launch(), hostile) strikes the wanderer.
 */
export function createArchery({ scene, world, player, targets, strike, aim, ammo, damage, arrowModel, sound, toast, alert, spray = () => {}, hurtPlayer = () => {},
  drawTime = () => 1, steady = () => false, scored = () => {}, nearMiss = () => {}, noise = () => {}, shielded = () => {} }) {
  const flying = [], stuck = [], fades = [], marks = [];
  let bow = null; // { t, draw, release }
  const before = new THREE.Vector3(), next = new THREE.Vector3(), segment = new THREE.Vector3(), centre = new THREE.Vector3(), offset = new THREE.Vector3();
  const surface = { point: new THREE.Vector3(), normal: new THREE.Vector3() }, forward = new THREE.Vector3(0, 0, -1), dir = new THREE.Vector3(), probe = new THREE.Vector3();
  const ray = new THREE.Raycaster(), hits = [], where = new THREE.Vector3();

  // ── Trails: one line set for every arrow, each a fading tail of its last positions.
  const TRAILS = 24, trailPositions = new Float32Array(TRAILS * (BOW.trail - 1) * 6), trailColors = new Float32Array(TRAILS * (BOW.trail - 1) * 8);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 4));
  const trails = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  trails.frustumCulled = false; trails.name = 'Arrow trails'; scene.add(trails);
  function drawTrails() {
    let n = 0;
    const put = (trail, fade) => {
      for (let k = 0; k < trail.length - 1 && n < TRAILS * (BOW.trail - 1); k++, n++) {
        trail[k].toArray(trailPositions, n * 6); trail[k + 1].toArray(trailPositions, n * 6 + 3);
        const a = (1 - k / (BOW.trail - 1)) * .5 * fade, b = (1 - (k + 1) / (BOW.trail - 1)) * .5 * fade;
        trailColors.set([.93, .9, .82, a, .93, .9, .82, b], n * 8);
      }
    };
    for (const a of flying) put(a.trail, 1);
    for (const f of fades) put(f.trail, f.t / .3);
    trailGeometry.setDrawRange(0, n * 2);
    trailGeometry.attributes.position.needsUpdate = trailGeometry.attributes.color.needsUpdate = true;
  }
  const tail = (a, out) => out.copy(a.tip).addScaledVector(dir.copy(a.velocity).normalize(), -BOW.length);
  function endTrail(a) { if (a.trail.length > 1) fades.push({ trail: a.trail, t: .3 }); }

  // ── Marks: a notch in wood, a scratch on stone; the oldest go when there are too many.
  let markGeometry = null;
  function mark(point, normal, kind) {
    if (typeof document === 'undefined') return;
    markGeometry ??= new THREE.PlaneGeometry(.26, .26);
    const material = pixelMaterial(kind === 'chip' ? 'arrowChip' : 'arrowNotch');
    material.polygonOffset = true; material.polygonOffsetFactor = -3;
    const m = new THREE.Mesh(markGeometry, material);
    m.position.copy(point).addScaledVector(normal, .012);
    m.lookAt(where.copy(m.position).add(normal)); m.rotateZ(Math.random() * Math.PI);
    m.name = 'Arrow mark'; scene.add(m); marks.push(m);
    if (marks.length > BOW.marks) marks.shift().removeFromParent();
  }

  function draw() {
    if (bow) return false;
    if (ammo.count() < 1) { toast('KEINE PFEILE', 1400); return false; }
    if (player.stamina < BOW.cost * .5) { toast('ZU WENIG AUSDAUER', 1300); return false; }
    bow = { t: 0, draw: 0, release: 0 }; sound('bowDraw');
    return true;
  }
  function release() {
    if (!bow || bow.release > 0) return false;
    // Barely drawn: the arrow is let down again, not wasted.
    if (bow.draw < BOW.minDraw) { bow = null; return false; }
    const power = bow.draw, origin = new THREE.Vector3(), direction = new THREE.Vector3();
    ammo.use(); player.stamina = Math.max(0, player.stamina - BOW.cost * power);
    aim(origin, direction);
    // Tired arms shake: below a quarter of stamina the arrow wanders.
    if (!steady() && player.stamina < player.maxStamina * .25) direction.add(offset.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.05)).normalize();
    const mesh = arrowModel();
    if (mesh) { mesh.name = 'Arrow in flight'; mesh.userData.arrow = true; scene.add(mesh); }
    const a = { mesh, tip: origin.clone().addScaledVector(direction, BOW.length), velocity: direction.multiplyScalar(THREE.MathUtils.lerp(BOW.speed[0], BOW.speed[1], power)), life: BOW.life, power, spent: false, trail: [] };
    a.trail.push(tail(a, new THREE.Vector3()));
    flying.push(a);
    bow.release = .3; bow.draw = 0; sound('bowRelease'); noise('bowRelease', player.position, { source: 'player' });
    return true;
  }
  const cancel = () => { if (bow && !bow.release) bow = null; };
  /** An arrow loosed by someone else (an enemy archer): from `origin` (the nock) with `velocity`. */
  function launch(origin, velocity, { damage: hurt = 14 } = {}) {
    const mesh = arrowModel();
    if (mesh) { mesh.name = 'Enemy arrow'; mesh.userData.arrow = true; scene.add(mesh); }
    const dirn = velocity.clone().normalize();
    const a = { mesh, tip: origin.clone().addScaledVector(dirn, BOW.length), velocity: velocity.clone(), life: BOW.life, power: 1, spent: false, trail: [], hostile: hurt };
    a.trail.push(tail(a, new THREE.Vector3()));
    flying.push(a); sound('bowRelease');
  }

  function place(mesh, tip, direction) {
    if (!mesh) return;
    dir.copy(direction).normalize();
    mesh.quaternion.setFromUnitVectors(forward, dir);
    mesh.position.copy(tip).addScaledVector(dir, -BOW.length);
  }
  function unlink(entry) {
    const list = entry.owner?.model.userData.attached;
    if (list) { const i = list.findIndex(x => x.object === entry.mesh); if (i >= 0) list.splice(i, 1); }
  }
  function keep(entry) {
    stuck.push(entry);
    if (stuck.length > BOW.stuck) { const old = stuck.shift(); unlink(old); old.mesh?.removeFromParent(); }
  }
  // The exact place an arrow meets a body: a ray against its meshes (not other arrows, not wounds).
  function bodyHit(target, from, direction, far) {
    ray.set(from, direction); ray.far = far; hits.length = 0;
    ray.intersectObject(target.model, true, hits);
    return hits.find(h => h.face && h.object.visible && !h.object.userData.wound && !h.object.parent?.userData.arrow && !h.object.userData.arrow) || null;
  }
  // The bone an arrow rides on: the rig node above the mesh it struck (so it falls with the ragdoll).
  function boneOf(target, object) {
    const rig = new Set(Object.values(target.model.userData.rig || {}));
    let node = object;
    while (node && !rig.has(node) && node !== target.model) node = node.parent;
    return node || target.model;
  }
  // A rough sphere round the whole body decides whether the exact test is worth doing this frame.
  function near(e, from, seg, lengthSq) {
    const scale = e.model.scale?.y || 1, small = e.prey || e.kind === 'wolf';
    centre.copy(e.model.position); centre.y += small ? e.aim ?? .9 : 1.25 * scale;
    const radius = small ? (e.radius ?? .7) * 1.8 : 1.45 * scale;
    offset.subVectors(from, centre);
    const b = offset.dot(seg), c = offset.lengthSq() - radius * radius;
    return c <= 0 || (b < 0 && b * b - lengthSq * c >= 0);
  }

  function update(dt) {
    if (bow) {
      if (bow.release > 0) { bow.release -= dt; if (bow.release <= 0) bow = null; }
      else { bow.t += dt; bow.draw = Math.min(1, bow.t / (BOW.drawTime * drawTime())); if (bow.draw >= 1) player.stamina = Math.max(0, player.stamina - dt * 2.5); }
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const a = flying[i];
      a.life -= dt;
      before.copy(a.tip); a.velocity.y -= BOW.gravity * dt; next.copy(before).addScaledVector(a.velocity, dt);
      segment.subVectors(next, before);
      const length = segment.length(), lengthSq = length * length;
      if (!length) continue;
      dir.copy(segment).divideScalar(length);
      const contact = traceSpellSurface(world, before, next, surface);
      let fraction = contact ? contact.t : Infinity, target = null, prop = null, body = null;
      if (world.loose?.length) {
        ray.set(before, dir); ray.far = Math.min(length, length * fraction); hits.length = 0;
        ray.intersectObjects(world.loose, true, hits);
        const h = hits.find(h => h.face && h.object.visible && !h.object.parent?.userData.arrow);
        if (h && h.distance / length < fraction) { fraction = h.distance / length; prop = h.object; }
      }
      // An enemy's arrow is after the wanderer: a stack of spheres along legs, chest and head.
      let wanderer = false;
      if (a.hostile && !a.spent) for (const [y, radius] of [[.7, .4], [1.45, .45], [2.05, .3]]) {
        centre.copy(player.position); centre.y += y; offset.subVectors(before, centre);
        const b = offset.dot(segment), c = offset.lengthSq() - radius * radius, disc = b * b - lengthSq * c;
        if (disc < 0) continue;
        const t = c <= 0 ? 0 : (-b - Math.sqrt(disc)) / lengthSq;
        if (t >= 0 && t <= 1 && t < fraction) { fraction = t; wanderer = true; prop = null; }
      }
      if (!a.spent && !a.hostile) for (const e of targets()) {
        if (e.dead || !near(e, before, segment, lengthSq)) continue;
        const h = bodyHit(e, before, dir.copy(segment).divideScalar(length), length * Math.min(1, fraction));
        if (h && h.distance / length < fraction) { fraction = h.distance / length; target = e; body = h; prop = null; }
        // Close enough to hear it hiss past: a near miss frightens (once per arrow and person).
        else if (!h && !e.prey && !(a.missed ??= new Set()).has(e)) {
          centre.copy(e.model.position); centre.y += 1.3; offset.subVectors(centre, before);
          const along = THREE.MathUtils.clamp(offset.dot(segment) / lengthSq, 0, 1);
          if (offset.addScaledVector(segment, -along).length() < 1.7) { a.missed.add(e); nearMiss(e, before.clone().addScaledVector(segment, along), segment.clone().divideScalar(length)); }
        }
      }
      dir.copy(segment).divideScalar(length);
      if (fraction > 1) {
        if (a.life <= 0 || next.y < -40) { a.mesh?.removeFromParent(); endTrail(a); flying.splice(i, 1); continue; }
        a.tip.copy(next); place(a.mesh, next, a.velocity);
        a.trail.unshift(tail(a, a.trail.length >= BOW.trail ? a.trail.pop() : new THREE.Vector3()));
        continue;
      }
      const point = before.addScaledVector(segment, fraction);
      if (wanderer) {
        hurtPlayer(a.hostile, a.tip.clone().addScaledVector(dir, -2));
        a.mesh?.removeFromParent(); endTrail(a); flying.splice(i, 1); continue;
      }
      if (target && /shield/.test(body.object.name)) {
        // Into the shield: it thuds into the planks and stays there, the bearer unhurt.
        place(a.mesh, probe.copy(body.point).addScaledVector(dir, .12), a.velocity);
        if (a.mesh) body.object.attach(a.mesh);
        spray(body.point, offset.copy(dir).negate(), 'splinter', 6); sound('arrowWood'); shielded(target);
        keep({ mesh: a.mesh, owner: target });
        endTrail(a); flying.splice(i, 1); continue;
      }
      if (target) {
        // Driven in a hand's breadth where it met the model, riding on the bone it struck.
        point.copy(body.point);
        place(a.mesh, probe.copy(point).addScaledVector(dir, .16), a.velocity);
        const bone = boneOf(target, body.object), name = bone.name || '';
        const factor = /head|neck/.test(name) ? BOW.headshot : /leg|foot|paw/.test(name) ? BOW.legs : 1;
        let amount = damage(a.power) * factor;
        if (player.sneaking && !target.engaged && !target.prey) { amount *= 2; toast('HINTERHÄLTIGER SCHUSS · DOPPELTER SCHADEN', 1800); }
        else if (factor > 1) toast('KOPFTREFFER', 1100);
        strike(target, amount, a.tip.clone().addScaledVector(dir, -2)); scored(target);
        if (!target.prey) alert(target);
        if (a.mesh) { bone.attach(a.mesh); (target.model.userData.attached ??= []).push({ object: a.mesh, bone: name }); }
        sound('arrowFlesh');
        keep({ mesh: a.mesh, owner: target });
        endTrail(a); flying.splice(i, 1); continue;
      }
      const normal = contact && !prop ? surface.normal : offset.copy(dir).negate();
      const kind = prop ? 'wood' : contact?.ground ? 'earth' : world.surfaceAt?.(probe.copy(point).addScaledVector(dir, .06)) ?? 'soft';
      if (kind === 'stone' && !a.spent) {
        // Glances off: thrown back along the mirror of its path, slowed and spinning, no longer sharp.
        a.velocity.reflect(normal).multiplyScalar(.3).add(offset.set(Math.random() - .5, Math.random() * .6, Math.random() - .5).multiplyScalar(2.5));
        a.tip.copy(point).addScaledVector(normal, .06); a.spent = true; a.life = Math.min(a.life, 2.5);
        spray(point, normal, 'ember', 8); spray(point, normal, 'stone', 7); spray(point, normal, 'dust', 2); mark(point, normal, 'chip'); sound('arrowStone');
        place(a.mesh, a.tip, a.velocity);
        continue;
      }
      endTrail(a); flying.splice(i, 1);
      if (a.spent) {
        // A spent arrow drops and lies where it comes to rest.
        const y = world.heightAt(point.x, point.z);
        dir.set(a.velocity.x, 0, a.velocity.z); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
        place(a.mesh, probe.set(point.x, y + .04, point.z), dir);
        sound('arrowHit');
        keep({ mesh: a.mesh, broken: .4 });
        continue;
      }
      place(a.mesh, probe.copy(point).addScaledVector(dir, kind === 'wood' ? .28 : .3), a.velocity);
      if (prop && a.mesh) prop.attach(a.mesh);
      if (kind === 'wood') { spray(point, normal, 'splinter', 9); spray(point, normal, 'dust', 1); mark(point, normal, 'notch'); sound('arrowWood'); }
      else { spray(point, normal, kind === 'earth' ? 'earth' : 'stone', 8); spray(point, normal, 'dust', 3); sound('arrowHit'); }
      if (!a.hostile) noise('arrowHit', point, { direction: dir.clone() });
      keep({ mesh: a.mesh });
    }
    for (let i = fades.length - 1; i >= 0; i--) { fades[i].t -= dt; if (fades[i].t <= 0) fades.splice(i, 1); }
    drawTrails();
  }

  /** The arrow the player can pull: within reach, in view (or right at their feet), not in a living body. */
  function nearestArrow(position, eye, view) {
    let best = null, score = Infinity;
    for (const s of stuck) {
      if (!s.mesh?.parent || (s.owner && !s.owner.dead)) continue;
      s.mesh.updateWorldMatrix(true, false);
      // The middle of the shaft, where a hand would take it.
      s.mesh.localToWorld(where.set(0, 0, -BOW.length * .4));
      const distance = where.distanceTo(position);
      if (distance > BOW.reach + .8) continue;
      const angle = offset.subVectors(where, eye).normalize().angleTo(view);
      if (angle > .5 && distance > 1.3) continue;
      if (angle + distance * .08 < score) { score = angle + distance * .08; best = s; }
    }
    return best;
  }
  /** Pulls an arrow out; returns true when it comes out whole (back to the quiver), false when it breaks. */
  function pull(entry) {
    const i = stuck.indexOf(entry);
    if (i < 0) return null;
    stuck.splice(i, 1); unlink(entry); entry.mesh?.removeFromParent();
    const whole = Math.random() >= (entry.broken ?? BOW.breaks);
    if (whole) ammo.add(1);
    sound('arrowPull');
    return whole;
  }
  function reset() {
    bow = null;
    for (const a of flying) a.mesh?.removeFromParent();
    for (const s of stuck) { unlink(s); s.mesh?.removeFromParent(); }
    for (const m of marks) m.removeFromParent();
    flying.length = stuck.length = fades.length = marks.length = 0;
    drawTrails();
  }
  return {
    draw, release, cancel, launch, update, reset, nearestArrow, pull,
    get drawing() { return !!bow && !bow.release; },
    get bow() { return bow; },
    state: () => ({ drawing: !!bow && !bow.release, draw: bow?.draw ?? 0, released: bow?.release ?? 0, flying: flying.length, stuck: stuck.length,
      inBodies: stuck.filter(s => s.owner).length, marks: marks.length, trails: trailGeometry.drawRange.count / 2 }),
  };
}
