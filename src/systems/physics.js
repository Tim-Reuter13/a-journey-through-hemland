import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

// Rigid-body world for loose props and ragdolls. The player and NPCs are not
// physics bodies (they keep the hand-written controller); they push props and
// can grab, carry and throw them like in Skyrim.
export const GROUP = { world: 1, prop: 2, ragdoll: 4 };
// Rapier collision groups: high 16 bits = membership, low 16 bits = filter.
export const groups = (member, filter) => (member << 16) | filter;

const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();

export async function createPhysics({ heightAt = null, water = null, bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 }, resolution = 1, gravity = -15 } = {}) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: gravity, z: 0 });
  const props = new Map(), ragdolls = new Set();
  let accumulator = 0, grabbed = null;

  // Terrain heightfield. Parry stores heights column-major: index = row + column * (rows + 1),
  // rows run along Z and columns along X, centred on the collider position.
  if (heightAt) {
  const columns = Math.round((bounds.maxX - bounds.minX) / resolution), rows = Math.round((bounds.maxZ - bounds.minZ) / resolution);
  const heights = new Float32Array((rows + 1) * (columns + 1));
  for (let c = 0; c <= columns; c++) for (let r = 0; r <= rows; r++)
    heights[r + c * (rows + 1)] = heightAt(bounds.minX + c * resolution, bounds.minZ + r * resolution);
  const terrain = RAPIER.ColliderDesc.heightfield(rows, columns, heights, { x: bounds.maxX - bounds.minX, y: 1, z: bounds.maxZ - bounds.minZ })
    .setTranslation((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2).setFriction(.9)
    .setCollisionGroups(groups(GROUP.world, 0xffff));
  world.createCollider(terrain);
  }
  /** A streamed terrain tile; heights row-major (z rows of x samples), (cells + 1)² values. */
  function addTerrainChunk(x0, z0, size, cells, gridHeights) {
    const heights = new Float32Array((cells + 1) ** 2);
    for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) heights[j + i * (cells + 1)] = gridHeights[j * (cells + 1) + i];
    return world.createCollider(RAPIER.ColliderDesc.heightfield(cells, cells, heights, { x: size, y: 1, z: size }).setTranslation(x0 + size / 2, 0, z0 + size / 2).setFriction(.9).setCollisionGroups(groups(GROUP.world, 0xffff)));
  }
  const removeCollider = collider => world.removeCollider(collider, true);

  function addStaticBox({ x, y, z, hx, hy, hz, rotationY = 0 }) {
    tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    return world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(tmpQ).setCollisionGroups(groups(GROUP.world, 0xffff)));
  }
  function addStaticColliders(colliders) {
    const made = [];
    for (const c of colliders) {
      const hy = (c.top - c.bottom) / 2, y = (c.top + c.bottom) / 2;
      if (c.radius !== undefined) made.push(world.createCollider(RAPIER.ColliderDesc.cylinder(hy, c.radius).setTranslation(c.x, y, c.z).setCollisionGroups(groups(GROUP.world, 0xffff))));
      else made.push(addStaticBox({ x: c.x, y, z: c.z, hx: c.halfWidth, hy, hz: c.halfDepth, rotationY: c.rotation || 0 }));
    }
    return made;
  }

  /** Makes a scene object a dynamic body; the object then follows the body. */
  function addProp(object, { half = [.2, .2, .2], mass = 2, friction = .7, restitution = .1, item = null } = {}) {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(tmpV); object.getWorldQuaternion(tmpQ);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(tmpV.x, tmpV.y, tmpV.z).setRotation(tmpQ)
      .setLinearDamping(.15).setAngularDamping(.6).setCcdEnabled(mass < 1.5));
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setMass(mass).setFriction(friction).setRestitution(restitution)
      .setCollisionGroups(groups(GROUP.prop, 0xffff)), body);
    const handle = { kind: 'prop', body, collider, object, mass, item, half };
    props.set(collider.handle, handle);
    return handle;
  }
  function removeProp(handle) {
    if (grabbed?.handle === handle) grabbed = null;
    props.delete(handle.collider.handle);
    world.removeRigidBody(handle.body);
  }
  function syncObject(object, body) {
    const t = body.translation(), r = body.rotation();
    if (object.parent && object.parent.type !== 'Scene') {
      object.parent.updateWorldMatrix(true, false);
      tmpV.set(t.x, t.y, t.z); object.parent.worldToLocal(tmpV); object.position.copy(tmpV);
      object.parent.getWorldQuaternion(tmpQ).invert(); object.quaternion.copy(tmpQ.multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w)));
    } else { object.position.set(t.x, t.y, t.z); object.quaternion.set(r.x, r.y, r.z, r.w); }
  }

  function updateGrab() {
    if (!grabbed) return;
    const body = grabbed.body, p = body.translation(), target = grabbed.target.clone();
    const heavy = grabbed.mass > 40;
    // Heavy bodies (corpses) slide along the ground instead of floating up.
    if (heavy) target.y = Math.min(target.y, p.y + .3);
    const delta = target.sub(tmpV.set(p.x, p.y, p.z)), distance = delta.length();
    if (distance > (heavy ? 6.5 : 4.5)) { release(); return; }
    const speed = Math.min(heavy ? 4.4 : 9, distance * (heavy ? 7 : 14));
    const desired = delta.normalize().multiplyScalar(speed), v = body.linvel();
    const k = heavy ? .6 : 1;
    body.setLinvel({ x: v.x + (desired.x - v.x) * k, y: heavy ? v.y + Math.max(0, desired.y - v.y) * .4 : desired.y, z: v.z + (desired.z - v.z) * k }, true);
    if (!heavy) { const w = body.angvel(); body.setAngvel({ x: w.x * .8, y: w.y * .8, z: w.z * .8 }, true); }
  }

  // Things in water float a little higher than they sink, are calmed by drag and carried by the current.
  function float(body, size) {
    if (!water || body.isSleeping()) return;
    const t = body.translation(), w = water(t.x, t.z);
    if (!w) return;
    const under = Math.min(1, Math.max(0, (w.surface - t.y) / Math.max(.2, size) + .5));
    if (under <= 0) return;
    const m = body.mass(), v = body.linvel(), h = 1 / 60;
    body.applyImpulse({ x: (w.flow[0] - v.x) * m * 2 * under * h, y: (m * -gravity * 1.3 * under - v.y * m * 2.5 * under) * h, z: (w.flow[1] - v.z) * m * 2 * under * h }, true);
  }
  function step(dt) {
    accumulator = Math.min(accumulator + dt, .1);
    const h = 1 / 60;
    while (accumulator >= h) {
      updateGrab();
      world.timestep = h; world.step();
      for (const ragdoll of ragdolls) { ragdoll.constrain?.(); ragdoll.clamp?.(); for (const part of ragdoll.parts) float(part.body, .3); }
      for (const prop of props.values()) float(prop.body, prop.half[1] * 2);
      accumulator -= h;
    }
    for (const prop of props.values()) {
      if (prop.body.isSleeping()) continue;
      syncObject(prop.object, prop.body);
      if (prop.body.translation().y < -40) removeProp(prop);
    }
    for (const ragdoll of ragdolls) ragdoll.sync();
  }

  function raycast(origin, direction, maxDistance = 3, { exclude } = {}) {
    const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: direction.x, y: direction.y, z: direction.z });
    const hit = world.castRayAndGetNormal(ray, maxDistance, true, undefined, groups(0xffff, GROUP.prop | GROUP.ragdoll), undefined, exclude?.body);
    if (!hit) return null;
    const toi = hit.timeOfImpact ?? hit.toi, point = new THREE.Vector3(origin.x + direction.x * toi, origin.y + direction.y * toi, origin.z + direction.z * toi);
    const prop = props.get(hit.collider.handle);
    if (prop) return { handle: prop, kind: 'prop', point, distance: toi };
    for (const ragdoll of ragdolls) {
      const part = ragdoll.parts.find(p => p.collider.handle === hit.collider.handle);
      if (part) return { handle: { kind: 'ragdoll', body: ragdoll.grabBody(part), mass: ragdoll.mass, ragdoll }, kind: 'ragdoll', point, distance: toi };
    }
    return null;
  }
  function grab(hit, holdPoint) {
    if (!hit) return false;
    hit.handle.body.wakeUp();
    grabbed = { handle: hit.handle, body: hit.handle.body, mass: hit.handle.mass, target: holdPoint.clone() };
    return true;
  }
  function moveGrab(holdPoint) { if (grabbed) grabbed.target.copy(holdPoint); }
  function release(velocity = null) {
    if (!grabbed) return;
    if (velocity && grabbed.mass <= 40) grabbed.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    grabbed = null;
  }
  /** The player kicks props it walks into. */
  function push(position, radius, velocity) {
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed < .5) return;
    for (const prop of props.values()) {
      const t = prop.body.translation();
      if (Math.abs(t.y - position.y - .5) > 1.2) continue;
      const dx = t.x - position.x, dz = t.z - position.z, d = Math.hypot(dx, dz);
      if (d > radius + Math.max(prop.half[0], prop.half[2])) continue;
      const strength = Math.min(1, 6 / prop.mass) * speed * .35;
      prop.body.applyImpulse({ x: (dx / (d || 1) * .6 + velocity.x / speed * .4) * strength * prop.mass * .3, y: .4 * strength, z: (dz / (d || 1) * .6 + velocity.z / speed * .4) * strength * prop.mass * .3 }, true);
    }
  }

  return {
    RAPIER, world, props, ragdolls, step, addTerrainChunk, removeCollider, raycast, grab, moveGrab, release, push, addProp, removeProp, addStaticBox, addStaticColliders,
    get holding() { return grabbed?.handle || null; },
    state: () => ({ props: props.size, ragdolls: ragdolls.size, bodies: world.bodies.len(), holding: grabbed ? grabbed.handle.kind : null }),
  };
}
