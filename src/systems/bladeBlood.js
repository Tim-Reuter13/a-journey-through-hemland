import * as THREE from 'three';

// Blood on what strikes: a blade, and the hand and forearm that hold it. Each carries a set of thin dark-red slabs
// lying on its surface, tip first; a blow shows more of them, they dry and darken slowly, and a heavily stained blade
// lets a drop fall now and then. One shared amount (0..1) serves the sword in the hand and the one in view.
const FRESH = 0x8e0d19, DRY = 0x4a080e, DRY_COLOR = new THREE.Color(DRY);
const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _p = new THREE.Vector3();

export function createBladeBlood({ drip = () => {} } = {}) {
  let amount = 0, age = 0;
  const material = new THREE.MeshLambertMaterial({ color: FRESH, emissive: 0x2a0408, emissiveIntensity: .7 });
  const handles = new Map();
  const rand = (a, b) => a + Math.random() * (b - a);

  function build(object, { from = .3, to = 1, thick = 1.07, count = 22, band = [.025, .06] } = {}) {
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
    const slabs = [];
    for (let i = 0; i < count; i++) {
      // Tip first: the first slabs sit nearest the end of the long axis, later ones further back.
      const t = to - (to - from) * (i / count) * rand(.7, 1.05), length = rand(...band) * (axis === 'y' ? 1 : 1);
      // The slab is as wide as the blade, not as wide as the crossguard that makes the whole model broad: a blade is about a ninth of its length wide and a twentieth thick.
      const dims = { [axis]: length, [others[0]]: Math.max(.03, size[axis] * .115 * thick * rand(.85, 1)), [others[1]]: Math.max(.025, size[axis] * .05 * thick * rand(.85, 1)) };
      const slab = new THREE.Mesh(new THREE.BoxGeometry(dims.x, dims.y, dims.z), material);
      slab.userData.bloodSlab = true; slab.userData.skip = Math.random() < .28;   // gaps: blood on a blade is streaky, never a solid sleeve
 slab.castShadow = slab.receiveShadow = false; slab.visible = false;
      const pos = { [axis]: union.min[axis] + size[axis] * t, [others[0]]: centre[others[0]] + rand(-.02, .02), [others[1]]: centre[others[1]] + rand(-.02, .02) };
      slab.position.set(pos.x, pos.y, pos.z);
      object.add(slab); slabs.push(slab);
    }
    return { object, slabs, tip: slabs[0] };
  }
  /** Keeps the stain on `object` (rebuilt when the object is swapped, e.g. a new weapon). */
  function sync(object, options = {}) {
    if (!object) return;
    let h = handles.get(object);
    if (!h) {
      for (const [o, old] of handles) if (!o.parent) { old.slabs.forEach(s => { s.removeFromParent(); s.geometry.dispose(); }); handles.delete(o); }
      h = build(object, options); if (!h) return; handles.set(object, h);
    }
    const shown = Math.ceil(Math.min(1, amount) * h.slabs.length);
    for (let i = 0; i < h.slabs.length; i++) h.slabs[i].visible = i < shown && !h.slabs[i].userData.skip;
  }
  return {
    sync, add(k) { amount = Math.min(1, amount + k); age = 0; }, get amount() { return amount; },
    update(dt) {
      if (amount <= 0) return;
      age += dt; amount = Math.max(0, amount - dt / 70);
      material.color.setHex(FRESH).lerp(DRY_COLOR, Math.min(1, age / 40));
      if (amount > .45 && Math.random() < dt * 1.6) for (const h of handles.values()) if (h.tip?.visible && h.tip.parent?.parent) { h.tip.getWorldPosition(_p); drip(_p); break; }
    },
    debug: handles,
    reset() { amount = 0; age = 0; for (const h of handles.values()) h.slabs.forEach(s => { s.visible = false; }); },
  };
}
