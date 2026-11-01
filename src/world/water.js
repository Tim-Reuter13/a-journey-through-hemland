import * as THREE from 'three';
import { WATER_LEVEL, LAKES, SITES, biomeWeights } from './hemland.js';
import { pixelMaterial, pixelTexture, registerPixelTexture } from '../art/pixelTextures.js';
import { block, beam } from '../art/blocks.js';
import { spriteInstances } from './flora.js';
import { rockModule } from './rocks.js';

// Water per terrain chunk, drawn in the 16-texel grid of the art style:
// - an animated 16×16 water tile (16 frames) read as a height field: on still water it ripples in every
//   direction, in the river it is stretched into streaks along the current and scrolls with it;
// - the body darkens with depth in many small steps blended by an ordered dither (clear shallows that
//   show the bed with moving light caustics, green-teal water, a dark channel), no hard bands;
// - the surface reflects the sky (the real sky colours, so lakes mirror the evening glow) more and more
//   toward a grazing view, and glitters where a ripple turns the sun (or the moon) toward you;
// - lakes and ponds swell gently, so the line on the bank comes and goes, and gusts darken drifting
//   patches; a thin broken line of foam laps at the bank;
// - a wave simulation around the player at 16 cells per unit, after the Wakes mod: wading, swimming,
//   animals, splashes and fish leave rings and V-shaped wakes; the river carries them downstream;
// - stones in the stream throw a standing wake, leaves drift down it; still ponds get lily pads and
//   rising fish instead.
// The surface is built on the terrain's own 2-unit grid with the same triangle split, so its depth is
// exact everywhere and the waterline lies exactly where the ground meets the water (no cut-off ponds).
// Water differs by place: clear slate water in the lake and the river, peaty brown-green in the marsh
// and in forest ponds. The banks get their plants and things from here too (reed beds, rushes, irises,
// lily colonies, stones and driftwood at the waterline).
const N = 192, RES = 16, WAKE_STEP = 1 / 30, UP = new THREE.Vector3(0, 1, 0);

const vertexShader = `
  attribute float depth; attribute vec2 flow; attribute float murk;
  uniform float uTime;
  varying vec3 vWorld; varying float vDepth; varying vec2 vFlow; varying float vSwell; varying float vMurk;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    // Still water swells a little (the bank line comes and goes); the river runs flat.
    float still = 1. - clamp(length(flow) * 3., 0., 1.);
    vSwell = (sin(uTime * 1.1 + p.x * .35 + p.z * .2) * .5 + sin(uTime * .73 - p.x * .13 + p.z * .31) * .5) * .03 * still;
    p.y += vSwell;
    vWorld = (modelMatrix * vec4(p, 1.)).xyz; vDepth = depth; vFlow = flow; vMurk = murk;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const fragmentShader = `
  uniform float uTime; uniform float uLight; uniform float uDay;
  uniform sampler2D uFrames; uniform sampler2D uWake; uniform vec2 uWakeOrigin;
  uniform vec3 uSkyTop, uSkyMid, uSkyHorizon, uSunDir, uMoonDir, uSunColor;
  varying vec3 vWorld; varying float vDepth; varying vec2 vFlow; varying float vSwell; varying float vMurk;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
  float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
  // Wakes-style banded colours: the wave height picks one of a few flat, semi-opaque tones.
  vec4 wakeColor(float w) {
    if (w < .05) return vec4(0.);
    if (w < .15) return vec4(.2, .4, .42, .35);
    if (w < .2) return vec4(.34, .5, .52, .45);
    if (w < .35) return vec4(.58, .66, .67, .55);
    if (w < .52) return vec4(0.);
    if (w < .6) return vec4(.58, .66, .67, .55);
    if (w < .7) return vec4(.8, .85, .84, .7);
    if (w < .9) return vec4(.58, .66, .67, .55);
    return vec4(.34, .5, .52, .45);
  }
  // The ripple height (0..4) of the tile at a point: isotropic on still water; in the river stretched along
  // the current into streaks and scrolled with it in whole texels.
  float level(vec2 p, vec2 dir, float speed, float frame) {
    vec2 perp = vec2(-dir.y, dir.x);
    float run = clamp(speed * 1.6, 0., 1.);
    vec2 q = mix(p, vec2(dot(p, dir) * .45, dot(p, perp) * 1.7), run);
    q.x -= floor(speed * uTime * 16.0) / 16.0 * mix(1., .45, run);
    q /= 4.0;
    if (noise(p * .09) + (hash(floor(p * 16.)) - .5) * .12 > .5) q = vec2(q.y, -q.x) + vec2(.3125, .5625);
    vec2 tuv = fract(q);
    return floor(texture2D(uFrames, vec2(tuv.x, (tuv.y + frame) / 16.0)).r * 4.0 + .5);
  }
  vec3 sky(vec3 r) {
    float h = r.y;
    return mix(mix(uSkyHorizon, uSkyMid, smoothstep(-.02, .24, h)), uSkyTop, smoothstep(.2, .88, h));
  }
  void main() {
    float d = vDepth + vSwell;
    if (d < -.005) discard;
    vec2 cell = floor(vWorld.xz * 16.0), p = (cell + .5) / 16.0;
    float speed = length(vFlow), still = 1. - clamp(speed * 3., 0., 1.);
    vec2 dir = speed > .01 ? vFlow / speed : vec2(1., 0.);
    float frame = mod(floor(uTime * (4.0 + speed * 3.0)), 16.0);
    // Wind patches drifting over open water: rougher (more glitter) and a shade darker.
    float gust = smoothstep(.52, .78, noise(p * .06 + vec2(uTime * .16, uTime * .05))) * still;
    float l = level(p, dir, speed, frame), lx = level(p + vec2(1. / 16., 0.), dir, speed, frame), lz = level(p + vec2(0., 1. / 16.), dir, speed, frame);
    // Far off, where a texel is smaller than a screen pixel, the ripples calm down instead of flickering.
    float texels = length(fwidth(vWorld.xz)) * 16.0, calm = clamp((texels - 1.2) / 2.0, 0.0, 1.0);
    float rough = (.36 + gust * .3 + clamp(speed, 0., 1.) * .35) * (1. - calm * .85);
    vec3 n = normalize(vec3((l - lx) * .04 * rough, 1., (l - lz) * .04 * rough));
    vec3 v = normalize(cameraPosition - vWorld);
    float dither = bayer4(cell);
    // How much water lies between the eye and the bed: more where it is deep, and more again when you look
    // flat across it. Clear water lets the bed show through for longer than peaty water.
    float path = d / max(.22, v.y);
    float k = 1. - exp(-path * mix(.45, 1., vMurk));
    k = floor(k * 10. + dither * .99) / 10.;
    vec3 shallow = mix(vec3(.22, .32, .3), vec3(.26, .25, .15), vMurk);
    vec3 deep = mix(vec3(.05, .12, .15), vec3(.075, .09, .06), vMurk);
    vec3 body = mix(shallow, deep, smoothstep(0., 1., k));
    body *= .93 + l * .035 - gust * .03;
    float sunUp = smoothstep(-.02, .08, uSunDir.y);
    vec3 col = body * uLight * (.86 + .14 * max(dot(n, uSunDir), 0.) * sunUp);
    float alpha = mix(.12, .93, k);
    // Light caustics on the bed under clear, sunny shallows.
    float c1 = noise(p * 2.6 + vec2(uTime * .45, uTime * .2)), c2 = noise(p * 2.6 + vec2(-uTime * .3, uTime * .4) + 7.);
    float caustic = step(abs(c1 - c2), .04) * (1. - smoothstep(.15, .9, d)) * uDay * (1. - vMurk) * still;
    col += caustic * vec3(.16, .18, .14) * uLight; alpha = max(alpha, caustic * .35);
    // Haze falls on the water itself, not on the sky it mirrors (the sky is never fogged either).
    #ifdef USE_FOG
      col = mix(col, fogColor, 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));
    #endif
    // The sky in the water, more of it the flatter you look, in a few steps like the palette. Low in the
    // mirror sit the far banks and trees, so the reflection darkens toward its horizon; near the bank the
    // trees and reeds overhead shade it too.
    float fresnel = (.02 + .98 * pow(1. - clamp(dot(normalize(mix(vec3(0., 1., 0.), n, .35)), v), 0., 1.), 5.)) * .8;
    // Even looking straight down some sky lies on the water, more on a ripple's crest: the surface always
    // reads as water, never as a dark hole.
    fresnel = max(fresnel, .08 + .05 * l / 4. + gust * .04);
    fresnel = floor(fresnel * 8. + dither * .99) / 8.;
    vec3 r = reflect(-v, n); r.y = abs(r.y);
    vec3 refl = sky(r);
    refl = mix(refl, refl * vec3(.42, .5, .45), (1. - smoothstep(0., .06, r.y)) * .55);
    refl *= mix(.72, 1., smoothstep(.04, .9, d)) * mix(1., .62, vMurk);
    col = mix(col, refl, fresnel);
    alpha = mix(alpha, 1., fresnel);
    // Glitter where a ripple turns the sun (or the moon) toward you, in single pixels.
    float glint = pow(max(dot(r, uSunDir), 0.), 200.) * sunUp + pow(max(dot(r, uMoonDir), 0.), 300.) * .5 * (1. - sunUp);
    float sparkle = hash(cell + floor(uTime * 6.));
    if (glint * (.5 + l * .2 + gust * .4) > .3 + sparkle * .6) { col = mix(uSunColor, vec3(.85, .9, 1.), 1. - sunUp) * 1.25; alpha = 1.; }
    // The water's edge: a thin wet sheen where it meets the bank, broken and drifting; on open, clear water a
    // soft lap a little further out comes and goes with the swell. Nothing white.
    float edge = (1. - smoothstep(0., .03, d)) * step(.45, noise(p * 2.4 + vec2(uTime * .25, 0.)));
    col = mix(col, refl * 1.1 + .03 * uLight, edge * .45); alpha = max(alpha, edge * .45);
    float lap = .05 + .035 * (sin(uTime * 1.25 + dot(cell, vec2(.021, .017))) * .5 + .5);
    float band = step(abs(d - lap), .007) * step(.55, noise(p * 3. + vec2(uTime * .5, 0.))) * still * (1. - vMurk);
    col = mix(col, vec3(.62, .7, .7) * uLight, band * .35); alpha = max(alpha, band * .4);
    // Wakes around the player.
    vec2 wuv = (cell - uWakeOrigin + .5) / ${N}.0;
    if (wuv.x > 0. && wuv.y > 0. && wuv.x < 1. && wuv.y < 1.) {
      vec4 wc = wakeColor(abs(texture2D(uWake, wuv).r * 2.0 - 1.0) * 1.35);
      col = mix(col, wc.rgb * uLight, wc.a); alpha = max(alpha, wc.a);
    }
    gl_FragColor = vec4(col, alpha);
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
// Little things on the water. A lily pad: a round leaf with a narrow notch to its centre, a darker rim,
// veins running out from the stalk and a few light texels where it catches the sky.
registerPixelTexture('lilyPad', p => {
  p.clear();
  const body = ['#2c5024', '#37602a', '#426e31', '#4e7c38'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (r > 7.4 || (Math.abs(a) < .3 && r > .8)) continue;
    p.set(x, y, r > 6.5 ? '#23421d' : body[Math.min(3, Math.floor(p.random() * 1.8 + (7.4 - r) / 3.2))]);
  }
  for (let k = 0; k < 7; k++) {
    const a = .45 + k * (Math.PI * 2 - .9) / 6;
    for (let t = 1.2; t < 6.2; t += .7) p.set(Math.round(7.5 + Math.cos(a) * t), Math.round(7.5 + Math.sin(a) * t), '#2a4c22');
  }
  for (let i = 0; i < 5; i++) { const a = Math.PI + (p.random() - .5) * 2.4, t = 2 + p.random() * 3.5; p.set(Math.round(7.5 + Math.cos(a) * t), Math.round(7.5 + Math.sin(a) * t), '#64944a'); }
}, { cutout: true });
// Bleached driftwood: silver-grey, long cracks along the grain.
registerPixelTexture('driftwood', p => {
  const ramp = ['#5c5850', '#736e66', '#8a857b', '#a29c90', '#b8b1a3'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ramp[1 + Math.floor(p.random() * 3)]);
  for (let s = 0; s < 7; s++) { const x = Math.floor(p.random() * 16); for (let y = 0; y < 16; y++) if (p.random() < .85) p.set(x, y, s % 2 ? ramp[4] : ramp[0]); }
  for (let c = 0; c < 3; c++) { const x = Math.floor(p.random() * 16), y = Math.floor(p.random() * 12); for (let k = 0; k < 4; k++) p.set(x, y + k, '#3e3a34'); }
});
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
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: 1 }, uDay: { value: 1 }, uWakeOrigin: { value: new THREE.Vector2() },
    uSunColor: { value: new THREE.Color(1, .9, .7) } }]);
  uniforms.uFrames = { value: framesTexture() }; uniforms.uWake = { value: wakeTexture };
  // The sky the water mirrors: shared with the atmosphere (useSky), placeholders until then.
  Object.assign(uniforms, { uSkyTop: { value: new THREE.Color(0x3a7cc4) }, uSkyMid: { value: new THREE.Color(0x79acd8) }, uSkyHorizon: { value: new THREE.Color(0xcfe3ef) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) } });
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
  const smooth = t => t * t * (3 - 2 * t);
  /** Value noise from the hash: coherent patches (reed beds, lily bays) instead of speckle. */
  const patchNoise = (x, z, size, k) => {
    const gx = x / size, gz = z / size, i = Math.floor(gx), j = Math.floor(gz), u = smooth(gx - i), w = smooth(gz - j);
    return (hash(i, j, k) * (1 - u) + hash(i + 1, j, k) * u) * (1 - w) + (hash(i, j + 1, k) * (1 - u) + hash(i + 1, j + 1, k) * u) * w;
  };
  /** How dark and peaty the water is: clear in the lake and the river, brown-green in the marsh and in
   *  forest ponds. */
  function murkAt(x, z) {
    const w = biomeWeights(x, z);
    const lake = Math.max(0, ...LAKES.map(l => 1 - smooth(Math.min(1, Math.max(0, (Math.hypot(x - l.x, z - l.z) - l.radius) / 60)))));
    const river = field.riverAt(x, z), inRiver = river ? 1 - smooth(Math.min(1, Math.max(0, (river.distance - river.line.width / 2) / 10))) : 0;
    const peat = Math.min(1, w.marsh + w.autumn * .7 + w.forest * .5 + w.taiga * .6 + .25);
    return peat * (1 - lake) * (1 - inRiver);
  }
  // Stones standing in the stream: each keeps throwing a small wake while the sim covers it.
  const rocks = [];
  const padMaterial = new THREE.MeshLambertMaterial({ map: pixelTexture('lilyPad'), alphaTest: .5, side: THREE.DoubleSide });
  const flowerMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Pads and blossoms ride the same swell as the water under them.
  for (const m of [padMaterial, flowerMaterial]) m.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 floatAt = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
      transformed.y += (sin(uTime * 1.1 + floatAt.x * .35 + floatAt.z * .2) * .5 + sin(uTime * .73 - floatAt.x * .13 + floatAt.z * .31) * .5) * .03;`);
  };
  const padGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // A water-lily blossom in blocks: six white petals opening round a yellow heart, two inner ones upright.
  const flowerGeometry = (() => {
    const parts = [], T = 1 / 16;
    const add = (w, h, d, x, y, z, rx, ry, color) => {
      const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z);
      const c = new THREE.Color(color), n = g.attributes.position.count, cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); parts.push(g.toNonIndexed());
    };
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(1.5 * T, .5 * T, 3 * T, Math.sin(a) * 1.6 * T, .8 * T, Math.cos(a) * 1.6 * T, -.55, a, k % 2 ? '#f3efe4' : '#e9e2d6'); }
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + .5; add(1.2 * T, .5 * T, 2.2 * T, Math.sin(a) * .8 * T, 1.6 * T, Math.cos(a) * .8 * T, -1.05, a, '#fbf8f0'); }
    add(1.4 * T, 1.2 * T, 1.4 * T, 0, 1.2 * T, 0, 0, 0, '#e6b83a');
    const merged = new THREE.BufferGeometry(), pos = [], col = [], nor = [];
    for (const g of parts) { pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); nor.push(...g.attributes.normal.array); }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return merged;
  })();
  const driftMaterial = pixelMaterial('driftwood');

  /** The water mesh for one chunk with everything that grows and lies at its banks, or null if dry. */
  function chunkMesh(cx, cz) {
    const g = field.grid(cx, cz), C = field.CELLS, S = field.STEP, n = C + 1, heights = g.heights;
    let any = false;
    for (let k = 0; k < heights.length && !any; k++) if (heights[k] < WATER_LEVEL + 1.2) any = true;
    if (!any) return null;
    const positions = [], depths = [], flows = [], murks = [], index = [], vmap = new Int32Array(n * n).fill(-1);
    const murkGrid = new Float32Array(n * n).fill(-1);
    const murkOf = (i, j) => { const k = j * n + i; if (murkGrid[k] < 0) murkGrid[k] = murkAt(g.x0 + i * S, g.z0 + j * S); return murkGrid[k]; };
    const vtx = (i, j) => {
      const k = j * n + i;
      if (vmap[k] >= 0) return vmap[k];
      const x = g.x0 + i * S, z = g.z0 + j * S, f = flowAt(x, z);
      positions.push(x, WATER_LEVEL, z); depths.push(WATER_LEVEL - heights[k]); flows.push(f[0], f[1]); murks.push(murkOf(i, j));
      return (vmap[k] = positions.length / 3 - 1);
    };
    // The same cells and the same diagonal as the terrain mesh, wherever any corner lies under water.
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      const a = j * n + i;
      if (Math.min(heights[a], heights[a + 1], heights[a + n], heights[a + n + 1]) > WATER_LEVEL + .04) continue;
      const va = vtx(i, j), vb = vtx(i + 1, j), vc = vtx(i, j + 1), vd = vtx(i + 1, j + 1);
      index.push(va, vc, vb, vb, vc, vd);
    }
    const group = new THREE.Group(); group.name = 'water chunk';
    let mesh = null;
    if (index.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('depth', new THREE.Float32BufferAttribute(depths, 1));
      geometry.setAttribute('flow', new THREE.Float32BufferAttribute(flows, 2));
      geometry.setAttribute('murk', new THREE.Float32BufferAttribute(murks, 1));
      geometry.setIndex(index); geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 3; mesh.name = 'chunk water';
      group.add(mesh);
    }
    // ── The banks. Every 2-unit grid point near the waterline decides what grows or lies there, by hash
    // and by coherent patch noise, so chunks always rebuild the same and plants come in beds, not speckle.
    const plants = [], pads = [], blooms = [];
    let seed = (cx * 73856093 ^ cz * 19349663) >>> 0;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const groundAt = (x, z) => field.heightAt(x, z);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const h = heights[j * n + i], d = WATER_LEVEL - h;
      if (d < -.9 || d > 1.7) continue;
      if (Math.abs(g.x0 + i * S - SITES.jetty.x + 8) < 15 && Math.abs(g.z0 + j * S - SITES.jetty.z) < 7) continue;
      const x = g.x0 + i * S, z = g.z0 + j * S, f = flowAt(x, z), fast = Math.hypot(f[0], f[1]) > .25, murk = murkOf(i, j);
      const bed = patchNoise(x, z, 9, 31), bay = patchNoise(x, z, 14, 47), r = hash(x, z, 5);
      const put = (name, count, size, spread = 1) => {
        for (let c = 0; c < count; c++) {
          const px = x + (random() - .5) * 2 * spread, pz = z + (random() - .5) * 2 * spread, py = groundAt(px, pz);
          if (WATER_LEVEL - py > .85) continue;
          plants.push([px, py, pz, name, size * (.8 + random() * .45), random() * Math.PI, .82 + random() * .26]);
        }
      };
      if (d > .02 && d < .8 && !fast) {
        // Reed beds standing in the shallows: tall reeds with plumes, cattails among them.
        if (bed > .5 - murk * .12) put(random() < .35 + murk * .3 ? 'cattail' : 'reedPlume', 2 + Math.floor((bed - .4) * 9), 1.55);
      } else if (d > -.28 && d <= .02) {
        // The waterline: rushes and sedge, now and then a clump of yellow iris or a cattail.
        if (bed > .32) put(r < .12 ? 'iris' : r < .3 ? 'cattail' : r < .65 ? 'rush' : 'sedge', 2 + Math.floor(bed * 3), r < .3 ? 1.25 : .95);
      } else if (d <= -.28) {
        if (bed > .45 && r < .5) put(r < .2 ? 'rush' : 'sedge', 1 + Math.floor(bed * 2), .85);
      }
      // Lily colonies in still, sheltered water, most in peaty ponds and marsh bays.
      if (!fast && d > .3 && d < 1.5 && i % 3 === 0 && j % 3 === 0 && bay > .55 && hash(x, z, 9) < .2 + murk * .35) {
        const count = 9 + Math.floor(hash(x, z, 10) * 16), radius = 1.5 + hash(x, z, 11) * 2;
        for (let c = 0; c < count; c++) {
          const a = random() * Math.PI * 2, rr = Math.sqrt(random()) * radius, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, pd = WATER_LEVEL - groundAt(px, pz);
          if (pd < .12 || pd > 1.7) continue;
          const size = .3 + random() * .32;
          pads.push([px, pz, size, random() * Math.PI * 2, random()]);
          if (random() < .12) blooms.push([px + (random() - .5) * size * .4, pz + (random() - .5) * size * .4, random()]);
        }
      }
      // At the waterline of lakes and rivers: rounded stones, now and then bleached driftwood.
      if (d > -.35 && d < .3) {
        const open = 1 - murk, stone = hash(x, z, 13), wood = hash(x, z, 14);
        if (stone < .035 + open * .05) {
          const kind = stone < .02 ? 'boulderPair' : 'boulderBig', sc = .22 + hash(x, z, 15) * .35;
          rockModule(group, kind, x + (random() - .5), h - .08 * sc, z + (random() - .5), random() * 6.3, sc, random, biomeWeights(x, z), false, random() < .5, 'none');
        } else if (wood < .006 + open * .012) driftwood(group, x, h, z, random);
      }
      // A stone standing in the stream throws a wake (the simulation draws it).
      if (fast && d > .5 && d < 2.4 && hash(x, z, 1) < .035) {
        const sz = .7 + hash(x, z, 3) * .8, top = WATER_LEVEL + .15 + hash(x, z, 4) * .35;
        rockModule(group, 'boulderBig', x, h - .1, z, hash(x, z, 6) * 6.3, Math.max(.4, (top - h) / 1.3), random, biomeWeights(x, z), false, false, 'none');
        rocks.push({ x, z, r: sz * .5, chunk: `${cx},${cz}`, phase: hash(x, z, 8) * 6 });
      }
    }
    if (!mesh && !plants.length) return null;
    const shore = spriteInstances(plants); if (shore) group.add(shore);
    if (pads.length) {
      const padMesh = new THREE.InstancedMesh(padGeometry, padMaterial, pads.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      pads.forEach(([x, z, size, turn, tone], k) => {
        padMesh.setMatrixAt(k, m.compose(new THREE.Vector3(x, WATER_LEVEL + .008 + k * .0002, z), q.setFromAxisAngle(UP, turn), new THREE.Vector3(size, 1, size)));
        // Most pads green, some yellowing or flushed red at the edge of summer.
        padMesh.setColorAt(k, tone < .78 ? c.setRGB(.92 + tone * .12, .95 + tone * .08, .9) : tone < .9 ? c.setRGB(1.18, 1.08, .72) : c.setRGB(1.2, .86, .74));
      });
      padMesh.name = 'Lily pads'; padMesh.receiveShadow = true; padMesh.computeBoundingSphere(); group.add(padMesh);
    }
    if (blooms.length) {
      const bloomMesh = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, blooms.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      blooms.forEach(([x, z, tone], k) => {
        bloomMesh.setMatrixAt(k, m.compose(new THREE.Vector3(x, WATER_LEVEL + .01, z), q.setFromAxisAngle(UP, tone * 6.3), new THREE.Vector3(1, 1, 1)));
        bloomMesh.setColorAt(k, tone < .7 ? c.setRGB(1, 1, 1) : c.setRGB(1, .8, .88));
      });
      bloomMesh.name = 'Water lilies'; bloomMesh.computeBoundingSphere(); group.add(bloomMesh);
    }
    group.userData.dispose = () => {
      for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].chunk === `${cx},${cz}`) rocks.splice(i, 1);
      group.traverse(o => { if (o.isInstancedMesh) o.dispose?.(); if (o === mesh || o.name === 'Shore plants') o.geometry.dispose(); });
    };
    return group;
  }
  // Bleached driftwood at the waterline: a crooked trunk with a stub or two, half on the bank.
  function driftwood(parent, x, y, z, random) {
    const g = new THREE.Group(); g.position.set(x, y + .06, z); g.rotation.set((random() - .5) * .12, random() * 6.3, (random() - .5) * .08); parent.add(g);
    const len = 1.3 + random() * 1.6, t = .16 + random() * .1;
    block(g, len, t, t, driftMaterial, 0, 0, 0, 0, 0, (random() - .5) * .1, { shadow: true });
    beam(g, [len * .3, 0, 0], [len * .3 + .35, .28 + random() * .2, .25], t * .55, driftMaterial);
    if (random() < .6) beam(g, [-len * .35, 0, 0], [-len * .35 - .2, .05, -.45], t * .5, driftMaterial);
    block(g, t * 1.5, t * 1.4, t * 1.4, driftMaterial, -len / 2, .02, 0, 0, 0, .3);
    return g;
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
  const drops = [], dropGeometry = new THREE.BoxGeometry(1 / 16 * 1.2, 1 / 16 * 1.2, 1 / 16 * 1.2), dropMaterial = new THREE.MeshLambertMaterial({ color: 0xc4dcd8 });
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
  const fish = new THREE.Group(); fish.name = 'Leaping fish'; fish.visible = false; root.add(fish);
  {
    const scale = new THREE.MeshLambertMaterial({ color: 0x9aa6a0 }), back = new THREE.MeshLambertMaterial({ color: 0x55645c }), fin = new THREE.MeshLambertMaterial({ color: 0x6e7a70 });
    const part = (w, h, d, m, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; fish.add(b); };
    part(.07, .08, .3, scale, 0, 0, 0); part(.06, .03, .26, back, 0, .045, 0); part(.02, .06, .08, fin, 0, .08, -.02);
    part(.02, .1, .07, fin, 0, 0, .18, .5); part(.02, .1, .07, fin, 0, 0, .18, -.5);
  }
  let fishTimer = 6, leap = null;
  /** A fish leaping somewhere in deep water within sight (every few seconds while you are near water). */
  function leapFish(focus, dt) {
    if (leap) {
      leap.t += dt; const k = Math.min(1, leap.t / leap.dur);
      const y = WATER_LEVEL - .1 + 4 * leap.h * k * (1 - k), slope = 4 * leap.h * (1 - 2 * k) / leap.len;
      fish.position.set(leap.x + leap.dx * leap.len * k, y, leap.z + leap.dz * leap.len * k);
      fish.rotation.set(0, Math.atan2(-leap.dx, -leap.dz), 0); fish.rotateX(Math.atan(slope));
      if (k >= 1) { splash(fish.position.x, fish.position.z, .45); fish.visible = false; leap = null; }
      return;
    }
    if ((fishTimer -= dt) > 0) return;
    fishTimer = 5 + Math.random() * 10;
    const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 16, x = focus.x + Math.cos(a) * r, z = focus.z + Math.sin(a) * r;
    if (WATER_LEVEL - field.heightAt(x, z) < .8) return;
    const turn = Math.random() * Math.PI * 2;
    leap = { x, z, dx: Math.cos(turn), dz: Math.sin(turn), len: .8 + Math.random() * .7, h: .35 + Math.random() * .35, dur: .55 + Math.random() * .2, t: 0 };
    fish.position.set(x, WATER_LEVEL - .1, z); fish.visible = true; splash(x, z, .3);
  }
  function update(dt, light = 1, focus = null) {
    uniforms.uTime.value += dt; uniforms.uLight.value = light;
    if (focus) {
      recenter(focus.x, focus.z);
      leapFish(focus, dt);
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
  /** Mirrors the real sky: takes the atmosphere's own uniforms, so colours follow the time of day. */
  function useSky(sky, sun) {
    Object.assign(uniforms, { uSkyTop: sky.uTop, uSkyMid: sky.uMid, uSkyHorizon: sky.uHorizon, uSunDir: sky.uSun, uMoonDir: sky.uMoon, uDay: sky.uDay });
    uniforms.uSunColor.value = sun.color;
  }
  return { material, chunkMesh, at, flowAt, ripple, splash, wake, update, root, useSky,
    state: () => ({ origin: [ox, oz], rocks: rocks.length, flow: [flowX, flowZ], peak: h.reduce((m, v) => Math.max(m, Math.abs(v)), 0) }) };
}
