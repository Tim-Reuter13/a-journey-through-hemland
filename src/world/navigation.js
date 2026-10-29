import * as THREE from 'three';
import { circleIntersectsBox } from '../systems/collision.js';

export const ROUTES = [
  [[-1,7],[5,5],[15,2],[29,-8],[42,-17],[49,-24],[49,-27]],
  [[-4,12],[-11,15],[-24,15],[-28,27],[-36,40],[-45,45]],
  [[-6,9],[-15,8],[-25,-1],[-35,-10],[-39,-13]],
];
export const routePoints = ROUTES.map(route => new THREE.CatmullRomCurve3(route.map(([x,z]) => new THREE.Vector3(x,0,z))).getPoints(160));
export function nearTrail(x,z,margin=3.7) {
  return routePoints.some(points => points.some((p,i) => {
    if (!i) return false;
    const a=points[i-1], dx=p.x-a.x, dz=p.z-a.z;
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    return (x-a.x-dx*t)**2+(z-a.z-dz*t)**2<margin*margin;
  }));
}

// Exactly the same two triangles per cell as PlaneGeometry. Navigation must use
// the rendered surface, not an independent approximation of the height function.
export function sampleTerrain(height, x, z, step=300/180) {
  const x0=Math.floor((x+150)/step)*step-150, z0=Math.floor((z+150)/step)*step-150;
  const u=(x-x0)/step,v=(z-z0)/step;
  const a=height(x0,z0),b=height(x0,z0+step),d=height(x0+step,z0);
  if(u+v<=1) return a+(d-a)*u+(b-a)*v;
  const c=height(x0+step,z0+step);
  return c+(b-c)*(1-u)+(d-c)*(1-v);
}

export function createCollisionWorld({ bounds = { minX: -112, maxX: 112, minZ: -112, maxZ: 112 }, cell = 8 } = {}) {
  const colliders = [], grid = new Map();
  let dirty = true;
  // Colliders are bucketed into a coarse grid by their bounding circle; queries only
  // test the cells they touch. `disabled` colliders (open doors) are skipped.
  function index() {
    grid.clear();
    for (const o of colliders) {
      const r = o.radius ?? Math.hypot(o.halfWidth, o.halfDepth);
      for (let gx = Math.floor((o.x - r) / cell); gx <= Math.floor((o.x + r) / cell); gx++)
        for (let gz = Math.floor((o.z - r) / cell); gz <= Math.floor((o.z + r) / cell); gz++) {
          const key = gx * 65536 + gz;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(o);
        }
    }
    dirty = false;
  }
  function add(collider) { colliders.push(collider); dirty = true; return collider; }
  function remove(list) { const gone = new Set(list); for (let i = colliders.length - 1; i >= 0; i--) if (gone.has(colliders[i])) colliders.splice(i, 1); dirty = true; }
  function hits(o, x, z, radius, y, height, skipKind) {
    if (o.disabled || o.kind === skipKind || y >= o.top - .03 || y + height <= o.bottom + .03) return false;
    return o.radius !== undefined ? Math.hypot(x - o.x, z - o.z) < o.radius + radius : circleIntersectsBox(x, z, radius, o.x, o.z, o.halfWidth, o.halfDepth, o.rotation || 0);
  }
  function blocked(x, z, radius = .43, y = 0, height = 2.6, skipKind = null) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return true;
    if (dirty) index();
    for (let gx = Math.floor((x - radius) / cell); gx <= Math.floor((x + radius) / cell); gx++)
      for (let gz = Math.floor((z - radius) / cell); gz <= Math.floor((z + radius) / cell); gz++) {
        const list = grid.get(gx * 65536 + gz);
        if (list && list.some(o => hits(o, x, z, radius, y, height, skipKind))) return true;
      }
    return false;
  }
  // Highest collider top under a circle that lies at most `step` above y: what a character can stand on.
  function supportAt(x, z, radius, y, step = .45) {
    if (dirty) index();
    let best = -Infinity;
    for (let gx = Math.floor((x - radius) / cell); gx <= Math.floor((x + radius) / cell); gx++)
      for (let gz = Math.floor((z - radius) / cell); gz <= Math.floor((z + radius) / cell); gz++) {
        for (const o of grid.get(gx * 65536 + gz) || []) {
          if (o.disabled || o.top > y + step || o.top <= best) continue;
          const over = o.radius !== undefined ? Math.hypot(x - o.x, z - o.z) < o.radius + radius : circleIntersectsBox(x, z, radius, o.x, o.z, o.halfWidth, o.halfDepth, o.rotation || 0);
          if (over) best = o.top;
        }
      }
    return best;
  }
  function segmentBlocked(a, b, radius = .07) {
    const distance = a.distanceTo(b), steps = Math.max(1, Math.ceil(distance / .12));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (blocked(THREE.MathUtils.lerp(a.x, b.x, t), THREE.MathUtils.lerp(a.z, b.z, t), radius, THREE.MathUtils.lerp(a.y, b.y, t), .08)) return true;
    }
    return false;
  }
  /** Colliders whose cells touch a circle (cover search, AI). Each listed once. */
  function near(x, z, r) {
    if (dirty) index();
    const out = new Set();
    for (let gx = Math.floor((x - r) / cell); gx <= Math.floor((x + r) / cell); gx++)
      for (let gz = Math.floor((z - r) / cell); gz <= Math.floor((z + r) / cell); gz++) for (const o of grid.get(gx * 65536 + gz) || []) out.add(o);
    return [...out];
  }
  // The collider a point lies in (what an arrow struck), or null.
  function colliderAt(x, z, y, radius = .1) {
    if (dirty) index();
    for (const o of grid.get(Math.floor(x / cell) * 65536 + Math.floor(z / cell)) || []) if (hits(o, x, z, radius, y - .04, .08)) return o;
    return null;
  }
  return { add, remove, blocked, supportAt, segmentBlocked, colliderAt, near, colliders };
}

// Upright boxes get oriented colliders (walls of rotated houses stay thin);
// tilted pieces fall back to their axis-aligned bounds.
const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3(), up = new THREE.Vector3(), ax = new THREE.Vector3();
// What a collider is made of, for arrows: stone glances off, wood takes a notch, the rest is soft.
const STONE = /stone|cobble|brick|rock|ashlar|slate|flag|sett|granite|marble|fieldstone|roof|tile|iron|metal/i, WOOD = /plank|timber|bark|log|wood|beam|door|shingle|barrel|crate|fence|wicker/i;
export const surfaceOf = object => object.userData.surface || (name => STONE.test(name) ? 'stone' : WOOD.test(name) ? 'wood' : 'soft')(`${object.material?.map?.name || ''} ${object.material?.name || ''}`);
export function collidersFrom(root) {
  const list = [];
  root.updateMatrixWorld(true);
  root.traverse(object => {
    const footprint = object.userData.solidFootprint;
    if (!object.userData.solid && !footprint) return;
    object.getWorldPosition(wp); object.getWorldQuaternion(wq); object.getWorldScale(ws);
    up.set(0, 1, 0).applyQuaternion(wq); ax.set(1, 0, 0).applyQuaternion(wq);
    const yaw = Math.atan2(-ax.z, ax.x), box = object.geometry?.parameters;
    const surface = surfaceOf(object);
    if (footprint) list.push({ kind: 'furniture', surface, x: wp.x, z: wp.z, rotation: yaw, halfWidth: footprint.width / 2, halfDepth: footprint.depth / 2, bottom: wp.y, top: wp.y + footprint.height });
    else if (box?.width && up.y > .999) list.push({ kind: 'prop', surface, x: wp.x, z: wp.z, rotation: yaw, halfWidth: box.width * ws.x / 2, halfDepth: box.depth * ws.z / 2, bottom: wp.y - box.height * ws.y / 2, top: wp.y + box.height * ws.y / 2 });
    else {
      const bounds = new THREE.Box3().setFromObject(object), center = bounds.getCenter(new THREE.Vector3());
      list.push({ kind: 'prop', surface, x: center.x, z: center.z, halfWidth: (bounds.max.x - bounds.min.x) / 2, halfDepth: (bounds.max.z - bounds.min.z) / 2, bottom: bounds.min.y, top: bounds.max.y });
    }
  });
  return list;
}
