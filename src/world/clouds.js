import * as THREE from 'three';

// Soft voxel clouds. Not a shell of faces but many overlapping cubes of different sizes on a grid, placed
// by a coverage noise: where they overlap they merge into lumpy, rounded heaps, thick ones get a second,
// smaller cube on top (cauliflower). Every cube breathes slowly in size, so the clouds keep changing shape
// while they drift. Shading is per pixel: brighter with height in the layer and toward the sun, a cool
// shadow under the belly. They are opaque and fade out with an ordered dither (far away, and right in front
// of the camera so you can walk through a low one) — no transparency sorting, and it pixelates like the
// rest of the game. Cells are computed once and cached, the cube set is rebuilt when the camera (or the
// wind) has moved a cell.
const hash = (i, j, s) => { let h = Math.imul(i * 374761393 + j * 668265263 + s * 982451653, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = t => t * t * (3 - 2 * t);
function valueNoise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  return hash(i, j, seed) * (1 - fx) * (1 - fy) + hash(i + 1, j, seed) * fx * (1 - fy) + hash(i, j + 1, seed) * (1 - fx) * fy + hash(i + 1, j + 1, seed) * fx * fy;
}
/** Cloud cover of one cell (0 = clear sky): a few octaves, big banks with ragged edges. */
export function coverage(i, j, seed, scale = 1) {
  const x = i * .085 * scale, y = j * .085 * scale;
  return valueNoise(x, y, seed) * .55 + valueNoise(x * 2.1, y * 2.1, seed + 1) * .3 + valueNoise(x * 4.3, y * 4.3, seed + 2) * .15;
}

const vertexShader = `attribute float aPhase;
  uniform float uTime, uBase, uThick;
  varying vec3 vWorld, vNormal; varying float vRel;
  void main() {
    vec3 p = position * (1. + .09 * sin(uTime * .11 + aPhase * 6.2832));
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.);
    vWorld = world.xyz; vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vRel = (world.y - uBase) / uThick;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const fragmentShader = `uniform vec3 uLit, uShade, uSun; uniform vec2 uFade; uniform float uNear, uOpacity;
  varying vec3 vWorld, vNormal; varying float vRel;
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
  float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
  void main() {
    float far = 1. - smoothstep(uFade.x, uFade.y, length(vWorld.xz - cameraPosition.xz));
    float near = smoothstep(uNear * .35, uNear, length(vWorld - cameraPosition));
    if (bayer4(gl_FragCoord.xy) + .03 > far * near * uOpacity) discard;
    vec3 n = normalize(vNormal);
    float h = clamp(vRel, 0., 1.), sun = max(dot(n, uSun), 0.), up = n.y * .5 + .5;
    vec3 c = mix(uShade * .9, uLit, clamp(h * .85 + up * .35 + sun * .35 - .3, 0., 1.));
    gl_FragColor = vec4(c, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function cloudLayer(scene, { seed, cell, base, thick, cover, radius, fade, opacity, wind, scale = 1, flat = false, nightFade = .2 }) {
  const max = Math.ceil((radius * 2 / cell + 1) ** 2 * .9);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  geometry.setAttribute('aPhase', phase);
  const uniforms = { uTime: { value: 0 }, uBase: { value: base }, uThick: { value: thick }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uFade: { value: new THREE.Vector2(...fade) }, uNear: { value: cell * 1.6 }, uOpacity: { value: opacity } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.FrontSide });
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.frustumCulled = false; mesh.name = 'Soft voxel clouds'; mesh.count = 0; scene.add(mesh);
  const cache = new Map(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const drift = new THREE.Vector2();
  let lastCell = null;
  // The cubes one cell holds, in cloud space (relative to the drifting layer).
  function cubesOf(i, j) {
    const key = i * 73856093 ^ j * 19349663;
    let c = cache.get(key);
    if (c) return c;
    const k = (coverage(i, j, seed, scale) - cover) / (1 - cover);
    c = [];
    if (k > 0) {
      const r1 = hash(i, j, seed + 5), r2 = hash(i, j, seed + 6), r3 = hash(i, j, seed + 7);
      const w = cell * (1.05 + k * 1.5 + r1 * .4), h = flat ? thick * (.4 + r2 * .3) : thick * (.35 + k * .85 + r2 * .25);
      const y = base + (flat ? 0 : h * .5 - thick * .15 + (r3 - .5) * thick * .2);
      c.push([i * cell + (r1 - .5) * cell * .5, y, j * cell + (r2 - .5) * cell * .5, w, h, w * (.85 + r3 * .3), r1]);
      if (!flat && k > .45) { const w2 = w * (.55 + r2 * .2); c.push([i * cell + (r3 - .5) * cell, y + h * .45, j * cell + (r1 - .5) * cell, w2, h * .7, w2, r2]); }
    }
    if (cache.size > 30000) cache.clear();
    cache.set(key, c);
    return c;
  }
  function rebuild(cx, cz) {
    const n = Math.ceil(radius / cell);
    let count = 0;
    for (let j = cz - n; j <= cz + n; j++) for (let i = cx - n; i <= cx + n; i++) {
      if ((i - cx) ** 2 + (j - cz) ** 2 > n * n) continue;
      for (const [x, y, z, w, h, d, p] of cubesOf(i, j)) {
        if (count >= max) break;
        m.compose(v.set(x, y, z), q, s.set(w, h, d)); mesh.setMatrixAt(count, m); phase.setX(count, p); count++;
      }
    }
    mesh.count = count; mesh.instanceMatrix.needsUpdate = true; phase.needsUpdate = true;
  }
  return {
    update(dt, camera, lit, shade, night, sun) {
      drift.x += dt * wind[0]; drift.y += dt * wind[1];
      uniforms.uTime.value += dt;
      uniforms.uLit.value.copy(lit); uniforms.uShade.value.copy(shade); if (sun) uniforms.uSun.value.copy(sun);
      // Night only darkens the colours; fading by dither would show as a screen door over the whole sky.
      uniforms.uOpacity.value = opacity;
      mesh.position.set(drift.x, 0, drift.y);
      const cx = Math.round((camera.position.x - drift.x) / cell), cz = Math.round((camera.position.z - drift.y) / cell), key = `${cx},${cz}`;
      if (key !== lastCell) { lastCell = key; rebuild(cx, cz); }
    },
    state: () => ({ cubes: mesh.count }),
  };
}

export function createClouds(scene) {
  const layers = [
    // Cumulus: big soft heaps of overlapping cubes.
    cloudLayer(scene, { seed: 1, cell: 7, base: 100, thick: 16, cover: .5, radius: 270, fade: [205, 268], opacity: 1, wind: [1.4, .4] }),
    // High veil: sparse, flat, faster.
    cloudLayer(scene, { seed: 7, cell: 11, base: 165, thick: 4, cover: .64, radius: 270, fade: [200, 262], opacity: 1, wind: [2.6, .8], scale: .7, flat: true, nightFade: .4 }),
  ];
  return {
    update(dt, camera, lit, shade, night, sun) { for (const layer of layers) layer.update(dt, camera, lit, shade, night, sun); },
    state: () => layers.map(l => l.state()),
  };
}
