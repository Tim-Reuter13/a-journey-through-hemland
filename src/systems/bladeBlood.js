import * as THREE from 'three';

// Blood on a blade is a fluid that sticks to the steel, painted into the blade's own texture (no boxes on top).
// The blade is a grid of cells, a few across its width and one per pixel from the hilt to the tip; each holds a
// little blood. It runs along the blade under gravity (to the tip when the point is down, back to the hilt when it
// is raised), slides back when the blade swings, spreads a little sideways, gathers into a bead at the tip that drips
// as a real drop, and is flung off in a swing: drops leave with the blade's own velocity and land in the world as
// pools and spatter. What stays dries from bright red to a dark crust.
// The grid is a tiny texture; the weapon's material (its own copy) mixes it in over the steel in blade space, at
// nearest-pixel resolution like everything else. One handle per stained object, e.g. the sword in the hand
// (physical) and the sword in view (visual only: its space is the view, not the world).
const FRESH = new THREE.Color(0x9a0e1c), DRY = new THREE.Color(0x3c060b);
const CELLS = 22, COLS = 3;
const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _tip = new THREE.Vector3(), _vel = new THREE.Vector3(), _acc = new THREE.Vector3(), _axis = new THREE.Vector3(), _at = new THREE.Vector3(), _v = new THREE.Vector3();
const AXES = { x: 0, y: 1, z: 2 };

/** Patches a copy of a weapon material so it shows the blood grid (a shared program for all of them). */
function bloodMaterial(base, uniforms) {
  const material = base.clone();
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uToBlade;\nvarying vec3 vBladePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBladePos = (uToBlade * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uBlood; uniform vec4 uBladeFrame; uniform vec3 uBloodFresh; uniform vec3 uBloodDry; uniform float uBloodAge; uniform int uBladeAxis;
varying vec3 vBladePos;
float bladeBlood() {
  float along = uBladeAxis == 0 ? vBladePos.x : uBladeAxis == 1 ? vBladePos.y : vBladePos.z;
  float side = uBladeAxis == 0 ? vBladePos.y : vBladePos.x;
  vec2 uv = vec2((side - uBladeFrame.z) / uBladeFrame.w * .5 + .5, (along - uBladeFrame.x) / uBladeFrame.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec4 cell = texture2D(uBlood, uv);
  // Ragged edges: each pixel of the blade has its own threshold, so thin blood breaks into specks.
  vec2 px = floor(uv * vec2(${COLS * 2}.0, ${CELLS * 2}.0));
  float grain = fract(sin(dot(px, vec2(12.9898, 78.233))) * 43758.5453);
  return cell.r > .04 + grain * .22 ? min(1.0, .62 + cell.r * .5) : 0.0;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float bloodK = bladeBlood();
vec3 bloodCol = mix(uBloodFresh, uBloodDry, clamp(uBloodAge, 0.0, 1.0));
diffuseColor.rgb = mix(diffuseColor.rgb, bloodCol, bloodK);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance = mix(totalEmissiveRadiance, bloodCol * .55, bloodK);`);
  };
  material.customProgramCacheKey = () => 'bladeBlood';
  return material;
}

export function createBladeBlood({ drop = () => {} } = {}) {
  let age = 0, pending = 0, total = 0;
  const handles = new Map();
  const rand = (a, b) => a + Math.random() * (b - a);

  function build(object, { emit = true } = {}) {
    object.updateWorldMatrix(true, true);
    _inv.copy(object.matrixWorld).invert();
    const union = new THREE.Box3(), meshes = [];
    object.traverse(o => {
      if (!o.isMesh || !o.geometry || o.userData.bloodPatched) return;
      o.geometry.boundingBox ?? o.geometry.computeBoundingBox();
      union.union(_box.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld)));
      meshes.push(o);
    });
    if (union.isEmpty()) return null;
    const size = union.getSize(new THREE.Vector3()), centre = union.getCenter(new THREE.Vector3());
    const axis = size.y >= size.x && size.y >= size.z ? 'y' : size.x >= size.z ? 'x' : 'z', side = axis === 'x' ? 'y' : 'x';
    // The blade: the last 70 % of the length (the rest is pommel, grip and guard), about a twelfth as wide as long.
    const from = union.min[axis] + size[axis] * .3, span = size[axis] * .7, half = size[axis] * .042;
    const data = new Uint8Array(COLS * CELLS * 4), texture = new THREE.DataTexture(data, COLS, CELLS, THREE.RGBAFormat);
    texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.needsUpdate = true;
    const uniforms = { uBlood: { value: texture }, uBladeFrame: { value: new THREE.Vector4(from, span, centre[side], half) }, uBladeAxis: { value: AXES[axis] },
      uBloodFresh: { value: FRESH.clone() }, uBloodDry: { value: DRY.clone() }, uBloodAge: { value: 0 } };
    const patched = [];
    for (const mesh of meshes) {
      const toBlade = { value: new THREE.Matrix4().multiplyMatrices(_inv, mesh.matrixWorld) };
      const original = mesh.material, material = bloodMaterial(original, { ...uniforms, uToBlade: toBlade });
      mesh.material = material; mesh.userData.bloodPatched = true; patched.push({ mesh, original, material });
    }
    return { object, axis, from, span, vol: new Float32Array(COLS * CELLS), data, texture, uniforms, patched, emit, prevTip: null, prevVel: new THREE.Vector3() };
  }
  function release(h) {
    for (const { mesh, original, material } of h.patched) { mesh.material = original; mesh.userData.bloodPatched = false; material.dispose(); }
    h.texture.dispose();
  }
  /** Keeps a stain on `object` (rebuilt when the object is swapped, e.g. a new weapon). `emit: false` for things drawn in view space. */
  function sync(object, options = {}) {
    if (!object) return;
    let h = handles.get(object);
    if (!h) {
      h = build(object, options); if (!h) return;
      // The same blade drawn again (sheathed and drawn, a new copy in the hand): the blood is still on it.
      for (const [o, old] of handles) if (!o.parent) { if (old.emit === h.emit) { h.vol.set(old.vol); h.prevTip = null; } release(old); handles.delete(o); }
      handles.set(object, h);
    }
  }
  const at = (col, i) => i * COLS + col;
  function load(h, k) {
    // Fresh blood lands on the cutting part, towards the tip, in a streak or two.
    for (let n = 0; n < Math.ceil(k * 14); n++) {
      const i = Math.min(CELLS - 1, Math.floor(CELLS * (.35 + Math.random() * .65))), col = Math.floor(Math.random() * COLS);
      h.vol[at(col, i)] = Math.min(1.4, h.vol[at(col, i)] + .32);
      if (i + 1 < CELLS && Math.random() < .5) h.vol[at(col, i + 1)] = Math.min(1.4, h.vol[at(col, i + 1)] + .15);
    }
  }
  const tipPoint = (h, out) => out.set(0, 0, 0).setComponent(AXES[h.axis], h.from + h.span);
  return {
    sync, add(k) { pending += k; age = 0; },
    get amount() { return Math.min(1, total / 5); },
    update(dt) {
      if (dt <= 0) return;
      age += dt; total = 0;
      for (const h of handles.values()) {
        if (!h.object.parent) continue;
        if (pending > 0) load(h, pending);
        h.object.updateWorldMatrix(true, false);
        const a = AXES[h.axis];
        // Blade direction in the world, the tip's velocity and acceleration.
        _axis.set(0, 0, 0).setComponent(a, 1).applyQuaternion(h.object.getWorldQuaternion(_q));
        h.object.localToWorld(tipPoint(h, _tip));
        if (h.prevTip) { _vel.subVectors(_tip, h.prevTip).multiplyScalar(1 / dt); if (_vel.lengthSq() > 400) _vel.setLength(20); } else _vel.set(0, 0, 0);
        _acc.subVectors(_vel, h.prevVel).multiplyScalar(1 / dt);
        // Gravity along the blade (+ when the point is down) and the slide of a quick swing; it sticks, so it creeps.
        const push = -_axis.y * 1.1 - THREE.MathUtils.clamp(_acc.dot(_axis) * .015, -1.6, 1.6);
        const move = Math.min(.45, Math.abs(push) * dt * 2.2);
        const v = h.vol;
        for (let col = 0; col < COLS; col++) {
          if (move > .002) {
            // Only what is more than a thin film runs; the film stays where it is.
            if (push > 0) for (let i = CELLS - 2; i >= 0; i--) { const t = Math.max(0, v[at(col, i)] - .1) * move; v[at(col, i)] -= t; v[at(col, i + 1)] += t; }
            else for (let i = 1; i < CELLS; i++) { const t = Math.max(0, v[at(col, i)] - .1) * move; v[at(col, i)] -= t; v[at(col, i - 1)] += t; }
          }
          for (let i = 0; i < CELLS; i++) v[at(col, i)] *= 1 - dt * .006;
        }
        // A little spreads across the width (a smear, not three stripes).
        for (let i = 0; i < CELLS; i++) for (let col = 0; col < COLS - 1; col++) {
          const d = (v[at(col, i)] - v[at(col + 1, i)]) * Math.min(.5, dt * .6); v[at(col, i)] -= d; v[at(col + 1, i)] += d;
        }
        const tipVol = () => { let s = 0; for (let col = 0; col < COLS; col++) s += v[at(col, CELLS - 1)]; return s; };
        if (h.emit) {
          // A bead at the tip falls when the point is down.
          if (tipVol() > 1 && _axis.y < -.15) { drop(_tip, _v.copy(_vel).multiplyScalar(.3).add(_at.set(0, -.3, 0)), .3); for (let col = 0; col < COLS; col++) v[at(col, CELLS - 1)] *= .55; }
          // A fast swing throws blood off the blade, along the way it moves.
          const speed = _vel.length();
          if (speed > 3.5) for (let i = CELLS - 1; i >= CELLS - 9; i--) for (let col = 0; col < COLS; col++) {
            const k = at(col, i);
            if (v[k] > .22 && Math.random() < dt * 9) {
              _at.set(0, 0, 0).setComponent(a, h.from + h.span * (i + .5) / CELLS); h.object.localToWorld(_at);
              drop(_at, _v.copy(_vel).multiplyScalar(.75).add({ x: rand(-.8, .8), y: rand(-.2, .9), z: rand(-.8, .8) }), .24); v[k] -= .14;
            }
          }
        }
        h.prevTip ??= new THREE.Vector3(); h.prevTip.copy(_tip); h.prevVel.copy(_vel);
        // Into the texture: red is how much blood is there.
        for (let k = 0; k < COLS * CELLS; k++) { total += v[k] / COLS; h.data[k * 4] = Math.min(255, v[k] * 220); h.data[k * 4 + 3] = 255; }
        h.texture.needsUpdate = true;
        h.uniforms.uBloodAge.value = Math.min(1, age / 50);
      }
      pending = handles.size ? 0 : pending * (1 - dt * .5);
    },
    reset() { pending = 0; age = 0; total = 0; for (const h of handles.values()) { h.vol.fill(0); h.data.fill(0); h.texture.needsUpdate = true; } },
    debug: handles,
  };
}
