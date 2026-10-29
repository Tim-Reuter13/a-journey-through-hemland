import * as THREE from 'three';
import { CHUNK, WATER_LEVEL } from './hemland.js';
import { pixelMaterial, registerPixelTexture } from '../art/pixelTextures.js';
import { block } from '../art/blocks.js';

// Water per terrain chunk, drawn in the 16-texel grid of the art style:
// - an animated 16×16 water tile (16 frames) that scrolls with the current in whole texels;
// - a palette in fixed depth steps (shallows you can see through, darker pools, deep channel);
// - a wave simulation around the player at 16 cells per unit, after the Wakes mod: wading,
//   swimming, animals, splashes and fish leave rings and V-shaped wakes, drawn through banded
//   wake colours; the river carries the whole wave field downstream;
// - the river acts on its surroundings: stones in the stream throw a standing wake, leaves and
//   twigs drift down it; still ponds get lily pads, duckweed and rising fish instead.
const STEP = 4, CELLS = CHUNK / STEP;
const N = 192, RES = 16, WAKE_STEP = 1 / 30;

const vertexShader = `
  attribute float depth; attribute vec2 flow;
  varying vec2 vXZ; varying float vDepth; varying vec2 vFlow;
  #include <fog_pars_vertex>
  void main() {
    vXZ = position.xz; vDepth = depth; vFlow = flow;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const fragmentShader = `
  uniform float uTime; uniform float uLight;
  uniform sampler2D uFrames; uniform sampler2D uPalette; uniform sampler2D uWake; uniform vec2 uWakeOrigin;
  varying vec2 vXZ; varying float vDepth; varying vec2 vFlow;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
  // Wakes-style banded colours: the wave height picks one of a few flat, semi-opaque tones.
  vec4 wakeColor(float w) {
    if (w < .05) return vec4(0.);
    if (w < .15) return vec4(.157, .576, .6, .55);
    if (w < .2) return vec4(.392, .62, .647, .62);
    if (w < .35) return vec4(.706, .769, .792, .78);
    if (w < .52) return vec4(0.);
    if (w < .6) return vec4(.706, .769, .792, .78);
    if (w < .7) return vec4(1., 1., 1., .92);
    if (w < .9) return vec4(.706, .769, .792, .78);
    return vec4(.392, .62, .647, .62);
  }
  void main() {
    if (vDepth < -0.02) discard;
    vec2 cell = floor(vXZ * 16.0), p = (cell + .5) / 16.0;
    float speed = length(vFlow);
    // The tile scrolls with the current in whole texels; still water only plays its frames.
    // The tile is 64 texels (4 units); a second, quarter-turned reading takes over in drifting
    // patches so lakes never show a grid. Far off, where a texel is smaller than a screen pixel,
    // the pattern calms to its middle tones instead of flickering.
    vec2 scroll = floor(vFlow * uTime * 16.0) / 16.0;
    vec2 q = (p - scroll) / 4.0;
    if (noise(p * .09) + (hash(cell) - .5) * .12 > .5) q = vec2(q.y, -q.x) + vec2(.3125, .5625);
    vec2 tuv = fract(q);
    float frame = mod(floor(uTime * (5.0 + speed * 3.0)), 16.0);
    float level = floor(texture2D(uFrames, vec2(tuv.x, (tuv.y + frame) / 16.0)).r * 4.0 + .5);
    float texels = length(fwidth(vXZ)) * 16.0;
    if (texels > 1.2) level = mix(level, 2.0, clamp((texels - 1.2) / 2.0, 0.0, 1.0)) + (hash(cell) > .5 ? .49 : -.49);
    // Still water lies calmer: mostly the middle tones, the odd bright crest.
    level = mix(level, 2.0, (1.0 - clamp(speed * 4.0, 0.0, 1.0)) * .4);
    level = clamp(floor(level + .5), 0.0, 4.0);
    float d = clamp(vDepth, 0.0, 8.0);
    float row = d < .55 ? 0.0 : d < 1.6 ? 1.0 : d < 3.2 ? 2.0 : 3.0;
    vec3 col = texture2D(uPalette, vec2((level + .5) / 5.0, (row + .5) / 4.0)).rgb;
    float alpha = row < .5 ? .5 : row < 1.5 ? .7 : row < 2.5 ? .84 : .92;
    // Still shallows grow duckweed in clumps near the bank.
    if (speed < .05 && d < .9 && hash(floor(p * 2.0)) > .72 && hash(cell) > .35) { col = hash(cell + 3.0) > .5 ? vec3(.33, .48, .2) : vec3(.42, .56, .24); alpha = .95; }
    // Foam: a thin broken line where the water laps at the bank.
    float lap = .04 + .04 * floor(2.5 + 2.5 * sin(uTime * 1.3 + dot(cell, vec2(.023, .017)))) / 5.0;
    if (d < lap && hash(cell + floor(uTime * 2.0)) > .62) { col = vec3(.82, .9, .88); alpha = .82; }
    // Wakes around the player.
    vec2 wuv = (cell - uWakeOrigin + .5) / ${N}.0;
    if (wuv.x > 0. && wuv.y > 0. && wuv.x < 1. && wuv.y < 1.) {
      vec4 wc = wakeColor(abs(texture2D(uWake, wuv).r * 2.0 - 1.0) * 1.35);
      col = mix(col, wc.rgb, wc.a); alpha = max(alpha, wc.a);
    }
    gl_FragColor = vec4(col * uLight, alpha);
    #include <fog_fragment>
  }`;

/** 16 frames of a 64×64 water tile (4 units at 16 texels each) in five brightness levels, stacked
 * vertically. The pattern is wrapping value noise with no preferred direction; each octave turns
 * between two noise fields (cos/sin of the loop phase), so the animation closes on itself. */
function framesTexture() {
  const W = 64, F = 16, data = new Uint8Array(W * W * F * 4), TAU = Math.PI * 2;
  let seed = 9071;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const field = cell => {
    const g = W / cell, grid = Array.from({ length: g * g }, () => random() * 2 - 1), out = new Float32Array(W * W);
    const at = (i, j) => grid[((j % g) + g) % g * g + ((i % g) + g) % g];
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      out[y * W + x] = (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy;
    }
    return out;
  };
  const a1 = field(16), b1 = field(16), a2 = field(8), b2 = field(8), a3 = field(4), b3 = field(4);
  for (let f = 0; f < F; f++) {
    const t = f / F * TAU;
    for (let k = 0; k < W * W; k++) {
      const v = (a1[k] * Math.cos(t) + b1[k] * Math.sin(t)) * .55 + (a2[k] * Math.cos(2 * t) + b2[k] * Math.sin(2 * t)) * .32
        + (a3[k] * Math.cos(3 * t) + b3[k] * Math.sin(3 * t)) * .18;
      // Mostly the middle tone: a few dark troughs, fewer bright crests, like hand-drawn water.
      const level = v < -.46 ? 0 : v < -.17 ? 1 : v < .26 ? 2 : v < .44 ? 3 : 4;
      const i = (f * W * W + k) * 4; data[i] = level * 63.75; data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, W, W * F);
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.wrapS = THREE.RepeatWrapping; texture.needsUpdate = true;
  return texture;
}
/** Water colours: five levels (trough → crest) × four depth steps (shallow → deep channel). */
function paletteTexture() {
  const rows = [['#3f8b86', '#4c9c92', '#5fae9f', '#7cc0ae', '#b4ded0'], ['#25707e', '#2e7f8b', '#3a8f98', '#55a3a8', '#9fd0cc'],
    ['#1a5268', '#205f75', '#286d82', '#3a8191', '#86bcc4'], ['#123e55', '#174a62', '#1d5670', '#2c6a80', '#6fa5b5']];
  const data = new Uint8Array(5 * 4 * 4);
  rows.forEach((row, j) => row.forEach((hex, i) => { const n = parseInt(hex.slice(1), 16), k = (j * 5 + i) * 4; data.set([n >> 16 & 255, n >> 8 & 255, n & 255, 255], k); }));
  const texture = new THREE.DataTexture(data, 5, 4);
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

// Little things on the water, as 16×16 cutouts.
registerPixelTexture('lilyPad', p => {
  p.clear();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), notch = dx > 0 && Math.abs(dy) < 1.2;
    if (r < 6.6 && !notch) p.set(x, y, r > 5.6 ? '#2f5a2a' : (x + y) % 5 === 0 ? '#5a8a3e' : p.random() < .3 ? '#3f6e32' : '#4a7c38');
  }
  for (let i = 0; i < 6; i++) p.set(7 - i, 7 + Math.round(i * .4), '#3a6430');
}, { cutout: true });
registerPixelTexture('lilyFlower', p => {
  p.clear();
  for (const [x, y, c] of [[7, 5, '#f2eee4'], [8, 5, '#f2eee4'], [6, 6, '#e8d0dc'], [9, 6, '#e8d0dc'], [7, 6, '#f6d86a'], [8, 6, '#f6d86a'], [6, 7, '#f2eee4'], [9, 7, '#f2eee4'], [7, 7, '#e8d0dc'], [8, 7, '#e8d0dc'], [7, 8, '#f2eee4'], [8, 8, '#f2eee4']]) p.set(x, y, c);
}, { cutout: true });
registerPixelTexture('floatLeaf', p => {
  p.clear();
  const c = ['#a5521f', '#c98a34', '#7a5a2a', '#8a3f1d'][Math.floor(p.random() * 4)];
  for (const [x, y] of [[6, 6], [7, 6], [8, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [7, 9]]) p.set(x, y, c);
  p.set(7, 7, '#4a2a14'); p.set(7, 10, '#4a2a14');
}, { cutout: true });

export function createWater(field) {
  const wakeData = new Uint8Array(N * N).fill(128);
  const wakeTexture = new THREE.DataTexture(wakeData, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  wakeTexture.magFilter = wakeTexture.minFilter = THREE.NearestFilter; wakeTexture.needsUpdate = true;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: 1 }, uWakeOrigin: { value: new THREE.Vector2() } }]);
  uniforms.uFrames = { value: framesTexture() }; uniforms.uPalette = { value: paletteTexture() }; uniforms.uWake = { value: wakeTexture };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true });
  material.name = 'chunk water';

  /** Current at a point: along the river, strongest mid-stream (units per second). */
  function flowAt(x, z) {
    const river = field.riverAt(x, z);
    if (!river) return [0, 0];
    const half = river.line.width / 2;
    if (river.distance > half + 3) return [0, 0];
    const s = river.segment, len = s.length || 1, k = 1.7 * Math.max(0, 1 - (river.distance / (half + 3)) ** 2);
    return [(s.bx - s.ax) / len * k, (s.bz - s.az) / len * k];
  }
  /** Water at a point, or null on dry ground: depth below the surface and the current. */
  function at(x, z) {
    const depth = WATER_LEVEL - field.heightAt(x, z);
    return depth > 0 ? { surface: WATER_LEVEL, depth, flow: flowAt(x, z) } : null;
  }
  const hash = (x, z, k = 0) => { const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  // Stones standing in the stream: each keeps throwing a small wake while the sim covers it.
  const rocks = [];
  const lily = pixelMaterial('lilyPad'), flower = pixelMaterial('lilyFlower');

  /** The water mesh for one chunk (with its lily pads and stream stones), or null if the chunk is dry. */
  function chunkMesh(cx, cz) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK, n = CELLS + 1, depth = new Float32Array(n * n);
    let wet = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const d = WATER_LEVEL - field.heightAt(x0 + i * STEP, z0 + j * STEP);
      depth[j * n + i] = d; if (d > -.3) wet = true;
    }
    if (!wet) return null;
    const positions = [], depths = [], flows = [], index = [], vertex = new Map();
    const v = (i, j) => {
      const k = j * n + i;
      if (vertex.has(k)) return vertex.get(k);
      const x = x0 + i * STEP, z = z0 + j * STEP, f = flowAt(x, z);
      positions.push(x, WATER_LEVEL, z); depths.push(depth[k]); flows.push(f[0], f[1]);
      vertex.set(k, positions.length / 3 - 1); return positions.length / 3 - 1;
    };
    for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
      const ds = [depth[j * n + i], depth[j * n + i + 1], depth[(j + 1) * n + i], depth[(j + 1) * n + i + 1]];
      if (Math.max(...ds) < -.05) continue;
      const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
      index.push(a, c, b, b, c, d);
    }
    if (!index.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('depth', new THREE.Float32BufferAttribute(depths, 1));
    geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
    geometry.setIndex(index); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 3; mesh.name = 'chunk water';
    // Decorations on a 2-unit lattice, decided by hash so chunks always rebuild the same.
    for (let z = z0 + 1; z < z0 + CHUNK; z += 2) for (let x = x0 + 1; x < x0 + CHUNK; x += 2) {
      const d = WATER_LEVEL - field.heightAt(x, z);
      if (d < .25) continue;
      const f = flowAt(x, z), still = Math.hypot(f[0], f[1]) < .05, r = hash(x, z);
      if (still && d < 1.3 && r < .12) {
        // A raft of lily pads, now and then a white flower.
        for (let k = 0; k < 2 + Math.floor(hash(x, z, 1) * 4); k++) {
          const px = x + (hash(x, z, k + 2) - .5) * 1.6, pz = z + (hash(x, z, k + 9) - .5) * 1.6, s = .45 + hash(x, z, k + 5) * .35;
          const pad = block(mesh, s, .01, s, lily, px, WATER_LEVEL + .012 + k * .001, pz, 0, hash(x, z, k) * 6.3, 0, { shadow: false });
          pad.renderOrder = 4;
          if (hash(x, z, k + 20) < .18) { const bloom = block(mesh, .4, .01, .4, flower, px, WATER_LEVEL + .06, pz, 0, 0, 0, { shadow: false }); bloom.renderOrder = 4; }
        }
      } else if (!still && d > .5 && d < 2.4 && r < .035) {
        // A stone in the stream; its wake comes from the simulation.
        const s = .7 + hash(x, z, 3) * .8, top = WATER_LEVEL + .15 + hash(x, z, 4) * .35;
        block(mesh, s, top - (WATER_LEVEL - d), s * .8, 'cobbleMossy', x, (top + WATER_LEVEL - d) / 2, z, 0, hash(x, z, 6) * 3, 0);
        block(mesh, s * .7, .2, s * .55, 'stoneLight', x, top + .05, z, 0, hash(x, z, 6) * 3 + .4, 0);
        rocks.push({ x, z, r: s * .5, chunk: `${cx},${cz}`, phase: hash(x, z, 8) * 6 });
      }
    }
    mesh.userData.dispose = () => { for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].chunk === `${cx},${cz}`) rocks.splice(i, 1); };
    return mesh;
  }

  // ── Wave simulation: height and velocity on an N×N grid of 1/16-unit cells around the player.
  let h = new Float32Array(N * N), vel = new Float32Array(N * N), ox = 0, oz = 0, wet = new Uint8Array((N / 4) * (N / 4)), acc = 0, time = 0, flowX = 0, flowZ = 0, ready = false;
  const sources = [];
  function shift(dx, dz) {
    if (!dx && !dz) return;
    const h2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const sj = j + dz; if (sj < 0 || sj >= N) continue;
      for (let i = 0; i < N; i++) { const si = i + dx; if (si < 0 || si >= N) continue; h2[j * N + i] = h[sj * N + si]; v2[j * N + i] = vel[sj * N + si]; }
    }
    h = h2; vel = v2;
  }
  function refreshMask() {
    const M = N / 4;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) wet[j * M + i] = WATER_LEVEL - field.heightAt((ox + i * 4 + 2) / RES, (oz + j * 4 + 2) / RES) > -.05 ? 1 : 0;
  }
  function recenter(x, z) {
    const cx = Math.round(x * RES) - N / 2, cz = Math.round(z * RES) - N / 2;
    if (ready && Math.abs(cx - ox) < 32 && Math.abs(cz - oz) < 32) return;
    if (ready) shift(cx - ox, cz - oz);
    ox = cx; oz = cz; ready = true; refreshMask();
    const f = flowAt(x, z); flowX = f[0]; flowZ = f[1];
    uniforms.uWakeOrigin.value.set(ox, oz);
  }
  /** Pushes the surface down in a disc (a stroke, a step, a stone falling in). */
  function disturb(x, z, radius, amount) {
    const ci = x * RES - ox, cj = z * RES - oz, r = Math.max(1, radius * RES);
    for (let j = Math.max(1, Math.floor(cj - r)); j <= Math.min(N - 2, Math.ceil(cj + r)); j++)
      for (let i = Math.max(1, Math.floor(ci - r)); i <= Math.min(N - 2, Math.ceil(ci + r)); i++) {
        const d = Math.hypot(i - ci, j - cj) / r;
        if (d < 1) h[j * N + i] -= amount * (1 - d * d);
      }
  }
  let flowShiftX = 0, flowShiftZ = 0;
  function simulate() {
    time += WAKE_STEP;
    // The current carries the whole field downstream, in whole cells so nothing smears.
    flowShiftX += flowX * RES * WAKE_STEP; flowShiftZ += flowZ * RES * WAKE_STEP;
    const sx = Math.trunc(flowShiftX), sz = Math.trunc(flowShiftZ);
    if (sx || sz) { shift(-sx, -sz); flowShiftX -= sx; flowShiftZ -= sz; }
    for (const s of sources) disturb(s.x, s.z, s.radius, s.amount);
    sources.length = 0;
    for (const rock of rocks) if (Math.abs(rock.x * RES - ox - N / 2) < N / 2 && Math.abs(rock.z * RES - oz - N / 2) < N / 2) disturb(rock.x, rock.z, rock.r, .03 * Math.sin(time * 9 + rock.phase));
    // Still water now and then: a fish rising or a water strider.
    if (Math.hypot(flowX, flowZ) < .05 && Math.random() < WAKE_STEP * .7) {
      const x = (ox + 16 + Math.random() * (N - 32)) / RES, z = (oz + 16 + Math.random() * (N - 32)) / RES;
      if (WATER_LEVEL - field.heightAt(x, z) > .3) disturb(x, z, Math.random() < .3 ? .22 : .12, Math.random() < .3 ? .4 : .18);
    }
    const M = N / 4, C = .34, DAMP = .986, DECAY = .996;
    for (let j = 1; j < N - 1; j++) {
      const mrow = (j >> 2) * M;
      for (let i = 1; i < N - 1; i++) {
        const k = j * N + i;
        if (!wet[mrow + (i >> 2)]) { h[k] = 0; vel[k] = 0; continue; }
        vel[k] += (h[k - 1] + h[k + 1] + h[k - N] + h[k + N] - 4 * h[k]) * C;
      }
    }
    for (let k = 0; k < N * N; k++) { vel[k] *= DAMP; h[k] = (h[k] + vel[k]) * DECAY; wakeData[k] = Math.max(0, Math.min(255, 128 + h[k] * 96)); }
    wakeTexture.needsUpdate = true;
  }

  // Splash drops (pixel cubes) and drifting leaves.
  const root = new THREE.Group(); root.name = 'water effects';
  const drops = [], dropGeometry = new THREE.BoxGeometry(1 / 16 * 1.5, 1 / 16 * 1.5, 1 / 16 * 1.5), dropMaterial = new THREE.MeshBasicMaterial({ color: 0xb8dcd6 });
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(dropGeometry, dropMaterial); m.visible = false; root.add(m); drops.push({ mesh: m, v: new THREE.Vector3(), life: 0 }); }
  const leaves = [], leafMaterial = pixelMaterial('floatLeaf'), leafGeometry = new THREE.PlaneGeometry(.38, .38).rotateX(-Math.PI / 2);
  for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(leafGeometry, leafMaterial); m.visible = false; m.renderOrder = 4; root.add(m); leaves.push({ mesh: m, life: 0, spin: 0 }); }

  /** Something moving through the water: a wake behind it, stronger the faster it goes. */
  function wake(x, z, speed = 1, radius = .35) { if (ready) sources.push({ x, z, radius, amount: Math.min(.16, .015 + speed * .02) }); }
  function ripple(x, z, size = 1.6) { if (ready) sources.push({ x, z, radius: Math.min(.5, size * .2), amount: .35 }); }
  function splash(x, z, strength = 1) {
    if (ready) sources.push({ x, z, radius: .3 + strength * .2, amount: .55 * strength });
    let count = Math.round(6 + strength * 8);
    for (const d of drops) {
      if (count <= 0) break; if (d.life > 0) continue; count--;
      d.mesh.position.set(x + (Math.random() - .5) * .6, WATER_LEVEL + .1, z + (Math.random() - .5) * .6);
      d.v.set((Math.random() - .5) * 2.4, 2 + Math.random() * 2.6 * strength, (Math.random() - .5) * 2.4); d.life = .9; d.mesh.visible = true;
    }
  }
  function update(dt, light = 1, focus = null) {
    uniforms.uTime.value += dt; uniforms.uLight.value = light;
    if (focus) {
      recenter(focus.x, focus.z);
      for (acc += Math.min(dt, .1); acc >= WAKE_STEP; acc -= WAKE_STEP) simulate();
      // Leaves and twigs come down the river past the player and float off downstream.
      for (const leaf of leaves) {
        const m = leaf.mesh;
        if (leaf.life <= 0) {
          if (Math.random() > dt * 1.5) continue;
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9, x = focus.x + Math.cos(a) * r, z = focus.z + Math.sin(a) * r, f = flowAt(x, z);
          if (Math.hypot(f[0], f[1]) < .3 || WATER_LEVEL - field.heightAt(x, z) < .3) continue;
          m.position.set(x, WATER_LEVEL + .02, z); m.rotation.y = Math.random() * 6; m.visible = true; leaf.life = 12 + Math.random() * 10; leaf.spin = (Math.random() - .5) * .6;
          continue;
        }
        const f = flowAt(m.position.x, m.position.z);
        m.position.x += f[0] * dt; m.position.z += f[1] * dt; m.rotation.y += leaf.spin * dt;
        leaf.life -= dt;
        if (leaf.life <= 0 || Math.hypot(f[0], f[1]) < .1 || Math.hypot(m.position.x - focus.x, m.position.z - focus.z) > 24) { m.visible = false; leaf.life = 0; }
      }
    }
    for (const d of drops) {
      if (d.life <= 0) continue;
      d.life -= dt; d.v.y -= 14 * dt; d.mesh.position.addScaledVector(d.v, dt);
      if (d.life <= 0 || d.mesh.position.y < WATER_LEVEL) { d.mesh.visible = false; d.life = 0; }
    }
  }
  return { material, chunkMesh, at, flowAt, ripple, splash, wake, update, root,
    state: () => ({ origin: [ox, oz], rocks: rocks.length, flow: [flowX, flowZ], peak: h.reduce((m, v) => Math.max(m, Math.abs(v)), 0) }) };
}
