import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { pixelTexture, textureSize } from '../art/pixelTextures.js';
import { broadleaf, pine, spruce, stump, fallenLog, mushrooms, bush, deadTree } from './flora.js';

// Landscape kit: faceted low-poly rocks — cliff walls, spires, outcrops, boulders, slabs, scree —
// shaped from noise-displaced solids with layered strata, flat-shaded like PS1 geometry. One master
// material textures them in world space with the terrain's own stone (16 texels per unit, axis
// picked per facet so pixels never smear) and grows the ground's grass, leaf litter or snow on every
// facet that faces the sky, with a ragged texel edge, so rock and meadow meet without a seam.
// On top of the chunk scatter sit three systems:
// - cliffs: steep breaks in the terrain get walls set into the slope, facing downhill, with scree;
// - stamps: composed little places (a rock nose with a tree, a forest clearing, a boulder field,
//   a stone ring, a ridge with bushes), placed whole and turned, never as loose single props;
// - landmarks: one rare large formation per region (a rock tower or an arch) to steer by.

// ── Shapes: unit solids (base at y = 0, about one unit across), cached per variant.
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash3(ix + i, iy + j, iz + k);
  return l(l(l(h(0, 0, 0), h(1, 0, 0), sx), l(h(0, 1, 0), h(1, 1, 0), sx), sy), l(l(h(0, 0, 1), h(1, 0, 1), sx), l(h(0, 1, 1), h(1, 1, 1), sx), sy), sz);
}
const SHAPES = {
  // Cliff wall: a subdivided block, bulged by noise, cut into strata whose ledges stand out unevenly.
  wall: { make: () => new THREE.BoxGeometry(1, 1, 1, 7, 6, 3), amp: .16, layers: 5, ledge: .22, tilt: 0, round: false, taper: .2 },
  // Rock tower: a seven-sided column, narrowing upward, strongly layered.
  spire: { make: () => new THREE.CylinderGeometry(.36, .5, 1, 7, 6), amp: .14, layers: 6, ledge: .18, tilt: 0, round: false, taper: .1 },
  // Outcrop: a dense polyhedron with tilted bedding, as if pushed up out of the ground.
  outcrop: { make: () => new THREE.IcosahedronGeometry(.5, 2), amp: .13, layers: 4, ledge: .1, tilt: .35, round: true },
  boulder: { make: () => new THREE.IcosahedronGeometry(.5, 1), amp: .16, layers: 0, ledge: 0, tilt: 0, round: true },
  slab: { make: () => new THREE.IcosahedronGeometry(.5, 1), amp: .12, layers: 2, ledge: .06, tilt: .2, round: true },
  standing: { make: () => new THREE.IcosahedronGeometry(.5, 1), amp: .09, layers: 0, ledge: 0, tilt: 0, round: true },
};
const shapeCache = new Map();
function shape(kind, variant) {
  const key = `${kind}:${variant}`;
  if (shapeCache.has(key)) return shapeCache.get(key);
  const spec = SHAPES[kind], g = spec.make(), pos = g.attributes.position, o = variant * 17.31 + kind.length * 3.7, v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Displacement is a function of position only, so vertices shared by two faces stay together.
    d.set(v.x, spec.round ? v.y : v.y * .3, v.z); if (d.lengthSq() < 1e-6) d.set(0, 1, 0); d.normalize();
    const n = (noise3(v.x * 3.1 + o, v.y * 3.1, v.z * 3.1) - .5) * 2 * spec.amp + (noise3(v.x * 7.3 + o, v.y * 7.3 + 9, v.z * 7.3) - .5) * spec.amp * .6;
    v.addScaledVector(d, n);
    if (spec.layers) {
      // Strata: heights pulled toward layer lines (tilted for outcrops); each layer juts out by its own amount.
      const bed = v.y + v.x * spec.tilt, layer = Math.round((bed + .5) * spec.layers), line = layer / spec.layers - .5 - v.x * spec.tilt;
      v.y += (line - v.y) * .45;
      const jut = 1 + (hash3(layer, variant, o) - .5) * 2 * spec.ledge;
      v.x *= jut; v.z *= jut;
    }
    // Walls and towers lean back and narrow toward the top instead of standing like boxes.
    if (spec.taper) { const k = 1 - (v.y + .5) * spec.taper; v.x *= k; v.z = v.z * k - (v.y + .5) * spec.taper * .25; }
    v.y = Math.max(v.y, -.5);
    pos.setXYZ(i, v.x, v.y + .5, v.z);
  }
  // Welded and smooth-shaded, like the terrain it stands in; only the texture projection stays faceted.
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const welded = mergeVertices(g, 1e-4); g.dispose();
  welded.computeVertexNormals();
  const out = welded.toNonIndexed(); welded.dispose();
  const ys = out.attributes.position, heights = new Float32Array(ys.count);
  for (let i = 0; i < ys.count; i++) heights[i] = ys.getY(i);
  out.setAttribute('aRockHeight', new THREE.BufferAttribute(heights, 1));
  out.computeBoundingBox();
  shapeCache.set(key, out);
  return out;
}

// ── Master material: world-space stone with ground cover on sky-facing facets.
const materialCache = new Map();
const CAPS = { grass: ['grass', [.84, .9, .74]], litter: ['litter', [.95, .9, .82]], snow: ['snow', [1, 1, 1]], none: ['grass', [.84, .9, .74]] };
function rockMaterial(tone, cap, tint = [1, 1, 1]) {
  const key = `${tone}:${cap}:${tint.join(',')}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const [capTexture, capTint] = CAPS[cap], scale = name => (16 / textureSize(name)).toFixed(5);
  const uniforms = { t_stone: { value: pixelTexture('stone') }, t_cap: { value: pixelTexture(capTexture) } };
  const material = new THREE.MeshLambertMaterial({ color: tone });
  material.name = `rock:${key}`;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float aRockHeight;\nvarying vec3 vRockPos;\nvarying float vRockHeight;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPos = (modelMatrix * vec4(transformed, 1.)).xyz; vRockHeight = aRockHeight;');
    shader.fragmentShader = `uniform sampler2D t_stone, t_cap; varying vec3 vRockPos; varying float vRockHeight;
      float rockHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rockNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(rockHash(i), rockHash(i + vec2(1., 0.)), f.x), mix(rockHash(i + vec2(0., 1.)), rockHash(i + vec2(1., 1.)), f.x), f.y); }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        // Facet normal from the surface itself; the projection axis is the facet's dominant one.
        vec3 facet = normalize(cross(dFdx(vRockPos), dFdy(vRockPos))), axis = abs(facet);
        vec2 uv = axis.y > axis.x && axis.y > axis.z ? vRockPos.xz : axis.x > axis.z ? vRockPos.zy : vRockPos.xy;
        vec3 stone = textureGrad(t_stone, uv * ${scale('stone')}, dFdx(uv) * ${scale('stone')}, dFdy(uv) * ${scale('stone')}).rgb;
        float texel = rockHash(floor(vRockPos.xz * 16.) + floor(vRockPos.y * 16.) * 7.);
        // Ground cover in the terrain's own colour: the biome tint and the same broad world noise.
        float macro = rockNoise(vRockPos.xz * .06) * .6 + rockNoise(vRockPos.xz * .21 + 7.) * .4;
        vec3 macroTone = vec3(.86 + macro * .26, .9 + macro * .2, .84 + macro * .2);
        vec3 capColor = textureGrad(t_cap, vRockPos.xz * ${scale(capTexture)}, dFdx(vRockPos.xz) * ${scale(capTexture)}, dFdy(vRockPos.xz) * ${scale(capTexture)}).rgb
          * vec3(${capTint.join(', ')}) * vec3(${tint.map(v => v.toFixed(3)).join(', ')}) * macroTone;
        // Ground cover only where it would really lie: on flat tops, in patches with a ragged pixel edge
        // (noise sampled on the 16-texel grid), never whole facets. Around them moss creeps over the
        // stone in speckles that thin out down the slope, so rock and cover blend instead of meeting in
        // a hard polygon line. At the foot grass and earth creep up; just above, the rock stays damp.
        vec3 px = floor(vRockPos * 16.) / 16.;
        float n = rockNoise(px.xz * 1.9 + px.y * 1.3) * .62 + rockNoise(px.xz * 5.3 - px.y * 2.1 + 3.) * .38;
        float ragged = (rockNoise(px.xz * 1.7 + px.y) - .5) * .12 + (texel - .5) * .06;
        float foot = .25 + ragged;
        float top = facet.y + (n - .5) * .55;
        bool covered = ${cap === 'none' ? 'false' : cap === 'snow' ? 'top > .7' : 'top > .86'} || vRockHeight < foot;
        float moss = ${cap === 'none' || cap === 'snow' ? '0.' : 'smoothstep(.4, .86, top) * step(.38, texel * .55 + n * .45)'};
        stone *= vRockHeight < foot + .07 ? .7 : 1.;
        vec3 bare = diffuseColor.rgb * stone;
        diffuseColor.rgb = covered ? capColor : mix(bare, capColor * .72 * mix(vec3(1.), stone, .35), moss * .85);`);
  };
  materialCache.set(key, material);
  return material;
}
const TONES = [0xffffff, 0xf2e8da, 0xe2e8ee, 0xece4d4, 0xd8d8d2];
const capFor = (w, high) => high ? 'snow' : w && w.autumn > .5 ? 'litter' : 'grass';
/** The terrain's biome tint (heightfield.js surface) at these weights, in steps of 0.04. */
const tintFor = w => !w ? [1, 1, 1] : [1 - w.taiga * .1 + w.autumn * .05 + w.plains * .03, 1 - w.autumn * .12 - w.marsh * .08, 1 - w.autumn * .35 - w.plains * .12 + w.taiga * .02].map(v => Math.round(v * 25) / 25);

// ── Modules: compositions of shapes. Parts: [shape, width, height, depth, x, y (base), z, rx, ry, rz].
// h is the height the module shows above the ground, w its width (for scree and spacing).
const MODULES = {
  cliffWide: { h: 3.8, w: 8, parts: [['wall', 8.4, 4.8, 3.6, 0, -1, 0], ['boulder', 2.2, 1.6, 1.8, 2.8, -.3, 2, 0, .4, 0], ['slab', 3, .8, 1.6, -2.2, 2.2, 1.6, .05, .2, 0]] },
  cliffTall: { h: 7.6, w: 6.4, parts: [['wall', 6.4, 8.6, 4, 0, -1, 0], ['spire', 2.2, 6.4, 2.2, 2.8, -1, 1, 0, 0, .04], ['boulder', 1.8, 1.3, 1.6, -2.4, -.3, 2.1, 0, 1, 0]] },
  cliffStep: { h: 1.9, w: 10, parts: [['wall', 10.4, 2.9, 2.8, 0, -1, 0], ['boulder', 1.6, 1, 1.4, -3, -.3, 1.6], ['boulder', 1.2, .8, 1.1, 3.2, -.3, 1.5, 0, 2, 0]] },
  cliffOverhang: { h: 3.9, w: 6, parts: [['wall', 5.4, 4.2, 3.4, 0, -1, -.2], ['slab', 6.6, 1.3, 4.6, .2, 2.6, .5, -.06, 0, 0]] },
  cliffCorner: { h: 7.2, w: 4, parts: [['spire', 4, 8.2, 4, 0, -1, 0], ['boulder', 2, 1.5, 1.8, 1.8, -.3, 1.6, 0, .6, 0]] },
  outcropStrata: { h: 1.8, w: 4.8, parts: [['outcrop', 4.8, 2.4, 3, 0, -.6, 0, .2, 0, 0]] },
  outcropKnoll: { h: 2.2, w: 3.8, parts: [['outcrop', 3.8, 2.8, 3.6, 0, -.6, 0]] },
  outcropSplit: { h: 2.3, w: 4.4, parts: [['outcrop', 2.2, 2.9, 3.2, -1.2, -.6, 0, 0, .1, -.06], ['outcrop', 2, 2.5, 3, 1.2, -.6, .2, 0, -.1, .06]] },
  outcropRidge: { h: 1.9, w: 7.4, parts: [['outcrop', 7.4, 2.6, 3.4, 0, -.7, 0, 0, .06, 0], ['boulder', 1.6, 1.2, 1.4, 3.2, -.3, 1.4, 0, .5, 0]] },
  boulderBig: { h: 1.3, w: 2, parts: [['boulder', 2, 1.6, 1.8, 0, -.3, 0]] },
  boulderStanding: { h: 2.2, w: 1.1, parts: [['standing', 1.1, 2.6, .9, 0, -.4, 0, .04, 0, .06]] },
  boulderSlab: { h: .45, w: 2.6, parts: [['slab', 2.6, .7, 1.9, 0, -.25, 0]] },
  boulderPair: { h: .8, w: 2, parts: [['boulder', 1.3, 1, 1.2, -.5, -.2, 0], ['boulder', .8, .6, .8, .7, -.15, .4, 0, 1, 0]] },
};
const BOULDERS = ['boulderBig', 'boulderStanding', 'boulderSlab', 'boulderPair'];

/** One faceted rock mesh: a cached shape variant scaled to size, its base at (x, y, z) in parent space. */
function rock(parent, kind, sx, sy, sz, x, y, z, rx, ry, rz, material, random, solid = true) {
  const mesh = new THREE.Mesh(shape(kind, Math.floor(random() * 4)), material);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = `rock:${kind}`;
  // An oriented collider a little inside the silhouette (navigation.js reads solidFootprint).
  if (solid && sy > .5) mesh.userData.solidFootprint = { width: sx * .8, depth: sz * .8, height: sy * .92 };
  mesh.userData.surface = 'stone';
  parent.add(mesh);
  return mesh;
}
/** Builds one module into `parent` at (x, y, z), turned by ry, uniformly scaled; returns the group. */
export function rockModule(parent, name, x, y, z, ry, scale, random, w = null, high = false, mirror = false) {
  const spec = MODULES[name], g = new THREE.Group(), material = rockMaterial(TONES[Math.floor(random() * TONES.length)], capFor(w, high), tintFor(w)), f = mirror ? -1 : 1;
  g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  for (const [kind, sw, sh, sd, px, py, pz, rx = 0, rry = 0, rz = 0] of spec.parts)
    rock(g, kind, sw * scale, sh * scale, sd * scale, px * f * scale, py * scale, pz * scale, rx, rry * f + (random() - .5) * .3, rz * f, material, random);
  return g;
}
/** Loose stones at the foot of something: scree spreading forward (+z) over a width. */
export function scree(parent, x, y, z, ry, width, random, heightAt, w = null) {
  const c = Math.cos(ry), s = Math.sin(ry), n = Math.round(width * 1.4), material = rockMaterial(TONES[Math.floor(random() * TONES.length)], capFor(w, false), tintFor(w));
  for (let i = 0; i < n; i++) {
    const lx = (random() - .5) * width, lz = random() * 2.8, px = x + lx * c + lz * s, pz = z - lx * s + lz * c, size = .22 + random() * .6 * (1 - lz / 3.2);
    rock(parent, random() < .3 ? 'slab' : 'boulder', size * (1 + random() * .5), size * .65, size, px, heightAt(px, pz) - size * .2, pz, 0, random() * 6.3, 0, material, random, size > .55);
  }
}

// ── Cliffs: where the terrain breaks steeply, a wall sized to the drop is set into the slope.
function cliffs(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid, placed) {
  for (let gz = 2; gz < size; gz += 5) for (let gx = 2; gx < size; gx += 5) {
    const x = x0 + gx + (random() - .5) * 3, z = z0 + gz + (random() - .5) * 3, h = field.heightAt(x, z);
    if (h < waterLevel + 1.5 || field.roadClearance(x, z) < 6 || avoid(x, z)) continue;
    const dx = (field.heightAt(x + 2, z) - field.heightAt(x - 2, z)) / 4, dz = (field.heightAt(x, z + 2) - field.heightAt(x, z - 2)) / 4, slope = Math.hypot(dx, dz);
    // High up, the mountain is one body of rock and snow: a few broad bands of strata, sunk deep into the
    // slope, not a field of loose walls and pillars.
    const mountain = h > 34;
    if (slope < .85 || placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + (mountain ? 12 : 3.5))) continue;
    if (mountain && random() > .35) continue;
    // Downhill unit vector; the wall's front (+z) faces it. The foot sits on the lower ground.
    const ux = -dx / slope, uz = -dz / slope, low = field.heightAt(x + ux * 3, z + uz * 3), high = field.heightAt(x - ux * 3, z - uz * 3), drop = high - low;
    if (drop < 2.2) continue;
    const name = mountain ? (drop > 4 ? 'cliffWide' : 'cliffStep') : drop > 6 ? (random() < .6 ? 'cliffTall' : 'cliffCorner') : drop > 3 ? (random() < .5 ? 'cliffWide' : 'cliffOverhang') : 'cliffStep';
    // Texturing is in world space, so a wall can grow to the drop without losing texel density.
    const spec = MODULES[name], scale = mountain ? THREE.MathUtils.clamp(drop / spec.h * 1.3, 1.3, 2.6) : THREE.MathUtils.clamp(drop / spec.h * 1.15, .9, 1.9), ry = Math.atan2(ux, uz);
    const fx = x + ux * 1.2, fz = z + uz * 1.2;
    const w = biomeWeights(fx, fz);
    rockModule(parent, name, fx, Math.min(low, field.heightAt(fx, fz)) + (mountain ? -.9 : .3) * scale, fz, ry, scale, random, w, high > 46, random() < .5);
    if (!mountain) scree(parent, fx + ux * 1.4 * scale, 0, fz + uz * 1.4 * scale, ry, spec.w * scale * .9, random, field.heightAt, w);
    placed.push({ x: fx, z: fz, r: spec.w * scale * .55 });
  }
}

// ── Stamps: composed little places. Each returns the radius it claims so trees keep out of it.
const STAMPS = {
  // A rock nose breaking out of the ground, a tree leaning beside it, scree and a bush.
  rockNose(parent, field, x, z, ry, random, w) {
    const h = field.heightAt(x, z);
    const big = 1.3 + random() * .5;
    rockModule(parent, random() < .5 ? 'outcropKnoll' : 'cliffCorner', x, h - .2, z, ry, big, random, w, false, random() < .5);
    const tx = x + Math.cos(ry) * 3.6 * big, tz = z - Math.sin(ry) * 3.6 * big;
    w.taiga > .4 ? pine(parent, tx, field.heightAt(tx, tz), tz, 1.1, random) : broadleaf(parent, tx, field.heightAt(tx, tz), tz, 1.1, random, w.autumn > .4 ? 'autumn' : 'oak');
    scree(parent, x + Math.sin(ry) * 2.2 * big, 0, z + Math.cos(ry) * 2.2 * big, ry, 5 * big, random, field.heightAt, w);
    const bx = x - Math.cos(ry) * 3.2 * big, bz = z + Math.sin(ry) * 3.2 * big; bush(parent, bx, field.heightAt(bx, bz), bz, 1, random);
    return 7 * big;
  },
  // A clearing in the wood: stumps in a loose ring, a fallen trunk, toadstools, a dead tree, a mossy slab.
  clearing(parent, field, x, z, ry, random, w) {
    for (let i = 0; i < 4; i++) { const a = ry + i * 1.6 + random() * .6, r = 4 + random() * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; stump(parent, px, field.heightAt(px, pz), pz, .9 + random() * .4, random); }
    const lx = x + Math.cos(ry + .8) * 1.8, lz = z + Math.sin(ry + .8) * 1.8; fallenLog(parent, lx, field.heightAt(lx, lz), lz, 1.1, random);
    for (let i = 0; i < 3; i++) { const px = x + (random() - .5) * 5, pz = z + (random() - .5) * 5; mushrooms(parent, px, field.heightAt(px, pz), pz, random); }
    const dx = x + Math.cos(ry + 3) * 6.5, dz = z + Math.sin(ry + 3) * 6.5; deadTree(parent, dx, field.heightAt(dx, dz), dz, 1, random);
    const sx = x + Math.cos(ry - 1.2) * 3, sz = z + Math.sin(ry - 1.2) * 3; rockModule(parent, 'outcropStrata', sx, field.heightAt(sx, sz) - .3, sz, ry, .7, random, w);
    return 8;
  },
  // Erratic boulders left in a meadow, the biggest one half-sunk, smaller ones around it.
  boulderField(parent, field, x, z, ry, random, w) {
    for (let i = 0; i < 4 + Math.floor(random() * 4); i++) {
      const a = random() * Math.PI * 2, r = i ? 3 + random() * 7 : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      rockModule(parent, i ? BOULDERS[Math.floor(random() * BOULDERS.length)] : 'boulderBig', px, field.heightAt(px, pz) - .1, pz, random() * 6.3, i ? .9 + random() * .9 : 2.2, random, w);
    }
    return 8;
  },
  // An old stone ring round a fallen capstone; the grass grows up to the stones.
  stoneRing(parent, field, x, z, ry, random, w) {
    const n = 7 + Math.floor(random() * 3);
    for (let i = 0; i < n; i++) {
      if (random() < .15) continue;
      const a = ry + i / n * Math.PI * 2, px = x + Math.cos(a) * 5.5, pz = z + Math.sin(a) * 5.5;
      rockModule(parent, 'boulderStanding', px, field.heightAt(px, pz) - .2, pz, a + Math.PI / 2, 1.2 + random() * .4, random, w);
    }
    rockModule(parent, 'boulderSlab', x, field.heightAt(x, z) - .1, z, ry, 1.2, random, w);
    return 8;
  },
  // A low ridge of tilted strata with bushes in its lee and a tree at the end.
  ridge(parent, field, x, z, ry, random, w) {
    rockModule(parent, 'outcropRidge', x, field.heightAt(x, z) - .3, z, ry, 1.3 + random() * .4, random, w, false, random() < .5);
    const sx = x + Math.cos(ry) * 4.2, sz = z - Math.sin(ry) * 4.2; rockModule(parent, 'outcropStrata', sx, field.heightAt(sx, sz) - .3, sz, ry + .3, .8, random, w);
    for (let i = 0; i < 3; i++) { const px = x - Math.sin(ry) * 1.8 + (random() - .5) * 5, pz = z - Math.cos(ry) * 1.8 + (random() - .5) * 2; bush(parent, px, field.heightAt(px, pz), pz, .7 + random() * .4, random); }
    const tx = x - Math.cos(ry) * 4.5, tz = z + Math.sin(ry) * 4.5;
    (w.taiga > .4 ? spruce : (p, a, b, c, s, r) => broadleaf(p, a, b, c, s, r, w.autumn > .4 ? 'autumn' : 'birch'))(parent, tx, field.heightAt(tx, tz), tz, 1, random);
    return 7;
  },
};

// ── Landmarks: one big formation per 320 m region, on open rising ground, to steer by.
const REGION = 320;
const regionHash = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
function landmarkOf(field, i, j, avoid) {
  if (regionHash(i, j, 1) > .55) return null;
  const x = (i + .2 + regionHash(i, j, 2) * .6) * REGION, z = (j + .2 + regionHash(i, j, 3) * .6) * REGION, h = field.heightAt(x, z);
  if (h < 4 || h > 42 || field.roadClearance(x, z) < 22 || avoid(x, z)) return null;
  return { x, z, kind: regionHash(i, j, 4) < .5 ? 'tower' : 'arch', ry: regionHash(i, j, 5) * 6.3 };
}
function landmark(parent, field, mark, random) {
  const { x, z, ry } = mark, h = field.heightAt(x, z), at = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  if (mark.kind === 'tower') {
    // A weathered rock tower: stacked corner blocks narrowing upward, buttresses and a ring of scree.
    rockModule(parent, 'cliffCorner', x, h - .6, z, ry, 1.3, random);
    rockModule(parent, 'cliffCorner', x + .3, h + 6.6, z - .2, ry + .9, 1, random);
    rockModule(parent, 'cliffCorner', x - .2, h + 12.4, z + .1, ry + 1.7, .72, random);
    for (const [lx, lz, a] of [[3.2, .5, 0], [-2.8, 1.8, 2.1], [.4, -3.3, 4.2]]) { const [px, pz] = at(lx, lz); rockModule(parent, 'cliffTall', px, field.heightAt(px, pz) - .8, pz, ry + a, .55, random); }
    for (let k = 0; k < 4; k++) { const a = ry + k * 1.57, [px, pz] = at(Math.cos(a) * 5, Math.sin(a) * 5); scree(parent, px, 0, pz, a, 6, random, field.heightAt); }
  } else {
    // A natural arch: two pillars and a heavy lintel slab, grass on top, scree below.
    for (const side of [-1, 1]) { const [px, pz] = at(side * 4.2, 0); rockModule(parent, 'cliffCorner', px, field.heightAt(px, pz) - .6, pz, ry + side * .3, 1.05, random); }
    const [cx, cz] = at(0, 0), top = Math.max(field.heightAt(...at(-4.2, 0)), field.heightAt(...at(4.2, 0))) + 6.4;
    const g = new THREE.Group(); g.position.set(cx, top, cz); g.rotation.y = ry; parent.add(g);
    const material = rockMaterial(TONES[0], 'grass');
    rock(g, 'slab', 12, 2.6, 4, 0, -.2, 0, 0, 0, .03, material, random); rock(g, 'outcrop', 7, 1.8, 3.2, -.4, 1.6, -.2, 0, .05, 0, material, random);
    for (const side of [-1, 1]) { const [px, pz] = at(0, side * 2.6); scree(parent, px, 0, pz, ry + (side > 0 ? 0 : Math.PI), 8, random, field.heightAt); }
  }
}

/** The landscape pass for one chunk; runs before trees, returns circles the trees should keep out of. */
/** What the last chunks placed (dev aid for looking at cliffs, stamps and landmarks in the game). */
export const placementLog = globalThis.__rockPlacements ??= [];
export function landscapeChunk(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid) {
  const placed = [];
  cliffs(parent, field, biomeWeights, waterLevel, x0, z0, size, random, avoid, placed);
  // Landmarks whose point falls inside this chunk.
  const i = Math.floor((x0 + size / 2) / REGION), j = Math.floor((z0 + size / 2) / REGION), mark = landmarkOf(field, i, j, avoid);
  if (mark && mark.x >= x0 && mark.x < x0 + size && mark.z >= z0 && mark.z < z0 + size) { landmark(parent, field, mark, random); placed.push({ x: mark.x, z: mark.z, r: 12, kind: `landmark:${mark.kind}` }); }
  // One or two stamps, chosen by what grows here.
  for (let k = 0; k < 2; k++) {
    if (random() > .38) continue;
    const x = x0 + 8 + random() * (size - 16), z = z0 + 8 + random() * (size - 16), h = field.heightAt(x, z);
    if (h < waterLevel + 1 || h > 44 || field.roadClearance(x, z) < 10 || avoid(x, z) || placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 8)) continue;
    const slope = Math.abs(field.heightAt(x + 3, z) - h) + Math.abs(field.heightAt(x, z + 3) - h);
    if (slope > 2.4) continue;
    const w = biomeWeights(x, z), wooded = Math.min(1, w.taiga + w.autumn + w.forest), roll = random();
    const kind = wooded > .5 ? (roll < .45 ? 'clearing' : roll < .8 ? 'rockNose' : 'ridge')
      : w.plains > .4 ? (roll < .45 ? 'boulderField' : roll < .62 ? 'stoneRing' : roll < .85 ? 'ridge' : 'rockNose')
      : (roll < .4 ? 'rockNose' : roll < .75 ? 'boulderField' : 'ridge');
    const r = STAMPS[kind](parent, field, x, z, random() * Math.PI * 2, random, w);
    placed.push({ x, z, r, kind });
  }
  for (const p of placed) placementLog.push({ kind: p.kind || 'cliff', x: Math.round(p.x), z: Math.round(p.z) });
  if (placementLog.length > 4000) placementLog.splice(0, placementLog.length - 4000);
  return placed;
}
export const ROCK_MODULES = Object.keys(MODULES);
