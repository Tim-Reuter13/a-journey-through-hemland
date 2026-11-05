import * as THREE from 'three';

// Blood on a blade is a fluid, not a sticker. The blade is a row of cells from the hilt to the tip, each holding a little
// blood; it runs along the blade under gravity (to the tip when the point is down, back to the hilt when it is raised),
// slides back when the blade accelerates, gathers into a bead at the tip that drips as a real drop, and is flung off in
// a swing: drops leave the blade with the blade's own velocity and land in the world as pools and spatter.
// A thin red slab per cell shows it (fatter where there is more). One handle per stained object, e.g. the sword in the
// hand (physical) and the sword in view (visual only: its space is the view, not the world).
const FRESH = 0x8e0d19, DRY = 0x4a080e, DRY_COLOR = new THREE.Color(DRY);
const CELLS = 22;
const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _tip = new THREE.Vector3(), _vel = new THREE.Vector3(), _acc = new THREE.Vector3(), _axis = new THREE.Vector3(), _at = new THREE.Vector3(), _v = new THREE.Vector3();

export function createBladeBlood({ drop = () => {} } = {}) {
  let age = 0, pending = 0, total = 0;
  const material = new THREE.MeshLambertMaterial({ color: FRESH, emissive: 0x2a0408, emissiveIntensity: .7 });
  const handles = new Map();
  const rand = (a, b) => a + Math.random() * (b - a);

  function build(object, { emit = true } = {}) {
    object.updateWorldMatrix(true, true);
    _inv.copy(object.matrixWorld).invert();
    const union = new THREE.Box3();
    object.traverse(o => {
      if (!o.isMesh || !o.geometry || o.userData.bloodSlab) return;
      o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
      union.union(_box.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld)));
    });
    if (union.isEmpty()) return null;
    const size = union.getSize(new THREE.Vector3()), centre = union.getCenter(new THREE.Vector3());
    const axis = size.y >= size.x && size.y >= size.z ? 'y' : size.x >= size.z ? 'x' : 'z', others = ['x', 'y', 'z'].filter(a => a !== axis);
    const from = union.min[axis] + size[axis] * .3, span = size[axis] * .7, step = span / CELLS;
    const slabs = [];
    for (let i = 0; i < CELLS; i++) {
      // A blade is about a ninth of its length wide and a twentieth thick; a slab hugs it.
      const dims = { [axis]: step * 1.15, [others[0]]: Math.max(.03, size[axis] * .125), [others[1]]: Math.max(.025, size[axis] * .055) };
      const slab = new THREE.Mesh(new THREE.BoxGeometry(dims.x, dims.y, dims.z), material);
      slab.userData.bloodSlab = true; slab.castShadow = slab.receiveShadow = false; slab.visible = false;
      slab.position.set(centre.x, centre.y, centre.z); slab.position[axis] = from + step * (i + .5);
      object.add(slab); slabs.push(slab);
    }
    return { object, slabs, axis, vol: new Float32Array(CELLS), emit, prevTip: null, prevVel: new THREE.Vector3(), step };
  }
  /** Keeps a stain on `object` (rebuilt when the object is swapped, e.g. a new weapon). `emit: false` for things drawn in view space. */
  function sync(object, options = {}) {
    if (!object) return;
    let h = handles.get(object);
    if (!h) {
      for (const [o, old] of handles) if (!o.parent) { old.slabs.forEach(s => { s.removeFromParent(); s.geometry.dispose(); }); handles.delete(o); }
      h = build(object, options); if (!h) return; handles.set(object, h);
    }
  }
  function load(h, k) {
    // Fresh blood lands on the cutting part, towards the tip.
    for (let n = 0; n < Math.ceil(k * 12); n++) { const i = Math.min(CELLS - 1, Math.floor(CELLS * (.4 + Math.random() * .6))); h.vol[i] = Math.min(1.3, h.vol[i] + .3); }
  }
  return {
    sync, add(k) { pending += k; age = 0; },
    get amount() { return Math.min(1, total / 5); },
    update(dt) {
      if (dt <= 0) return;
      age += dt; total = 0;
      material.color.setHex(FRESH).lerp(DRY_COLOR, Math.min(1, age / 50));
      for (const h of handles.values()) {
        if (!h.object.parent) continue;
        if (pending > 0) load(h, pending);
        h.object.updateWorldMatrix(true, false);
        const axisIndex = { x: 0, y: 1, z: 2 }[h.axis], tipSlab = h.slabs[CELLS - 1];
        // Blade direction in the world, the tip's velocity and acceleration.
        _axis.set(0, 0, 0).setComponent(axisIndex, 1).applyQuaternion(h.object.getWorldQuaternion(_q));
        h.object.localToWorld(_tip.copy(tipSlab.position));
        if (h.prevTip) { _vel.subVectors(_tip, h.prevTip).multiplyScalar(1 / dt); if (_vel.lengthSq() > 400) _vel.setLength(20); } else _vel.set(0, 0, 0);
        _acc.subVectors(_vel, h.prevVel).multiplyScalar(1 / dt);
        // Gravity along the blade (+ when the point is down) and the slide of a quick swing.
        const push = -_axis.y * 1.6 - THREE.MathUtils.clamp(_acc.dot(_axis) * .02, -2, 2);
        const move = Math.min(.6, Math.abs(push) * dt * 3);
        if (move > .002) {
          if (push > 0) for (let i = CELLS - 2; i >= 0; i--) { const t = h.vol[i] * move; h.vol[i] -= t; h.vol[i + 1] += t; }
          else for (let i = 1; i < CELLS; i++) { const t = h.vol[i] * move; h.vol[i] -= t; h.vol[i - 1] += t; }
        }
        for (let i = 0; i < CELLS; i++) h.vol[i] *= 1 - dt * .01;
        if (h.emit) {
          // A bead at the tip falls when the point is down.
          if (h.vol[CELLS - 1] > .55 && _axis.y < -.15) { drop(_tip, _v.copy(_vel).multiplyScalar(.3).add(_at.set(0, -.3, 0)), .3); h.vol[CELLS - 1] -= .3; }
          // A fast swing throws blood off the blade, along the way it moves.
          const speed = _vel.length();
          if (speed > 3.5) for (let i = CELLS - 1; i >= CELLS - 9; i--) {
            if (h.vol[i] > .12 && Math.random() < dt * 24) {
              h.object.localToWorld(_at.copy(h.slabs[i].position));
              drop(_at, _v.copy(_vel).multiplyScalar(.75).add({ x: rand(-.8, .8), y: rand(-.2, .9), z: rand(-.8, .8) }), .26); h.vol[i] -= .12;
            }
          }
        }
        h.prevTip ??= new THREE.Vector3(); h.prevTip.copy(_tip); h.prevVel.copy(_vel);
        for (let i = 0; i < CELLS; i++) {
          const v = h.vol[i], slab = h.slabs[i]; total += v;
          slab.visible = v > .06;
          if (slab.visible) { const k = .45 + Math.min(1, v) * .9, bead = i >= CELLS - 2 ? 1 + Math.min(.7, v * .5) : 1; slab.scale.set(1, 1, 1); slab.scale.setComponent(axisIndex, k); for (const c of [0, 1, 2]) if (c !== axisIndex) slab.scale.setComponent(c, bead); }
        }
      }
      pending = handles.size ? 0 : pending * (1 - dt * .5);
    },
    reset() { pending = 0; age = 0; total = 0; for (const h of handles.values()) { h.vol.fill(0); h.slabs.forEach(s => { s.visible = false; }); } },
    debug: handles,
  };
}
