import * as THREE from 'three';
import { pixelTexture, textureSize } from '../art/pixelTextures.js';
import { BOUNDS, CHUNK, WATER_LEVEL } from './hemland.js';
import { cityGroundMap, CITY_MAP } from './streets.js';

// Smooth heightfield, pixel surface: every texel picks exactly one ground
// texture by dithered thresholding, so transitions stay crisp. Per-vertex
// weights: splatA = (road, dirt, rock, snow), splatB = (litter, mud, sand, paving);
// the vertex colour is the biome tint and only colours living ground.
let material = null;
export function terrainMaterial() {
  if (material) return material;
  const uniforms = Object.fromEntries(['grass', 'dirt', 'path', 'stone', 'snow', 'litter', 'mud', 'sand', 'cobble', 'setts', 'flagstone'].map(n => [`t_${n}`, { value: pixelTexture(n) }]));
  uniforms.cityMap = { value: cityGroundMap() };
  uniforms.cityBounds = { value: new THREE.Vector4(CITY_MAP.minX, CITY_MAP.minZ, 1 / (CITY_MAP.maxX - CITY_MAP.minX), 1 / (CITY_MAP.maxZ - CITY_MAP.minZ)) };
  const scale = name => (16 / textureSize(name)).toFixed(5);
  material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute vec4 splatA;\nattribute vec4 splatB;\nvarying vec4 vSplatA;\nvarying vec4 vSplatB;\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSplatA = splatA; vSplatB = splatB; vTerrainPos = (modelMatrix * vec4(position, 1.)).xyz; vTerrainNormal = normal;`);
    shader.fragmentShader = `uniform sampler2D ${Object.keys(uniforms).filter(n => n !== 'cityBounds').join(', ')}; uniform vec4 cityBounds;
      varying vec4 vSplatA; varying vec4 vSplatB; varying vec3 vTerrainPos; varying vec3 vTerrainNormal;
      float terrainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float terrainNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(terrainHash(i), terrainHash(i + vec2(1., 0.)), f.x), mix(terrainHash(i + vec2(0., 1.)), terrainHash(i + vec2(1., 1.)), f.x), f.y); }
      // Ground canvases are 64 or 128 texels (16 per unit). Each layer is read twice, the second time
      // turned a quarter and moved by whole texels; smooth world noise picks one reading per texel, so
      // repeats never line up and there are no seams. Gradients are explicit, so mips stay continuous.
      vec3 layer(sampler2D t, vec2 uv, float scale, float other) {
        vec2 a = uv * scale, dx = dFdx(uv) * scale, dy = dFdy(uv) * scale;
        if (other < .5) return textureGrad(t, a, dx, dy).rgb;
        return textureGrad(t, vec2(a.y, -a.x) + vec2(37., 61.) * scale / 16., vec2(dx.y, -dx.x), vec2(dy.y, -dy.x)).rgb;
      }
      // Coursed paving keeps its rows: the second reading is moved by whole courses instead of turned.
      vec3 layerRows(sampler2D t, vec2 uv, float scale, float other) {
        vec2 a = uv * scale + other * vec2(.5, .2734);
        return textureGrad(t, a, dFdx(uv) * scale, dFdy(uv) * scale).rgb;
      }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `
        vec2 groundUV = vTerrainPos.xz;
        vec3 axis = abs(normalize(vTerrainNormal));
        vec2 cliffUV = axis.y > .72 ? groundUV : (axis.x > axis.z ? vTerrainPos.zy : vTerrainPos.xy);
        // Sample every layer outside of branches so mip selection stays defined.
        vec2 texel = floor(groundUV * 16.);
        float other = step(.5, terrainNoise(groundUV * .11) + (terrainHash(texel + 5.) - .5) * .16);
        float otherRock = step(.5, terrainNoise(cliffUV * .11) + (terrainHash(floor(cliffUV * 16.) + 5.) - .5) * .16);
        vec3 grass = layer(t_grass, groundUV, ${scale('grass')}, other), dirt = layer(t_dirt, groundUV, ${scale('dirt')}, other), trail = layer(t_path, groundUV, ${scale('path')}, other);
        vec3 litter = layer(t_litter, groundUV, ${scale('litter')}, other), mud = layer(t_mud, groundUV, ${scale('mud')}, other), sand = layer(t_sand, groundUV, ${scale('sand')}, other);
        vec3 cobble = layer(t_cobble, groundUV, ${scale('cobble')}, other), setts = layerRows(t_setts, groundUV, ${scale('setts')}, other), flags = layer(t_flagstone, groundUV, ${scale('flagstone')}, other);
        // Kronwacht's street plan (streets.js): setts on the main streets, flagstones on the squares,
        // a gutter of slabs down each street, dirt in the joints by the house fronts.
        vec2 cityUV = (groundUV - cityBounds.xy) * cityBounds.zw;
        vec4 city = all(greaterThan(cityUV, vec2(0.))) && all(lessThan(cityUV, vec2(1.))) ? textureLod(cityMap, cityUV, 0.) : vec4(0.);
        float pavePick = terrainNoise(groundUV * 1.3 + 3.) * .6 + terrainHash(texel + 9.) * .4;
        vec3 paving = cobble;
        if (city.r > pavePick * .8 + .1) paving = setts;
        if (city.g > pavePick * .8 + .1) paving = flags;
        if (city.b > .6 - terrainHash(texel + 2.) * .1) paving = flags * vec3(.46, .5, .56); // dark, wet slabs
        float grime = city.a * (.45 + terrainNoise(groundUV * .8 + 21.) * .9);
        if (grime > .55 && dot(paving, vec3(.333)) < .3) paving = mud;
        if (grime > .9 && terrainHash(texel + 4.) < .35) paving = mix(paving, dirt, .6);
        vec3 rock = layer(t_stone, cliffUV, ${scale('stone')}, otherRock), snow = layer(t_snow, cliffUV, ${scale('snow')}, otherRock);
        // Layers meet in coherent patches about a metre across with ragged texel edges, not speckle.
        float pick = clamp(terrainNoise(groundUV * .9 + 13.) * .72 + terrainHash(texel) * .28, 0., 1.);
        // Broad, seamless light and colour variation over the living ground.
        float macro = terrainNoise(groundUV * .06) * .6 + terrainNoise(groundUV * .21 + 7.) * .4;
        vec3 ground = grass; float living = 1.;
        // Height blending: each layer's own relief (how far a texel is lighter than its layer's
        // average) moves the edge, so stones, clods and leaf heaps poke through first.
        #define RELIEF(c, mean) ((dot(c, vec3(.333)) - mean) * .9)
        float grassRelief = RELIEF(grass, .33);
        if (vSplatB.x + RELIEF(litter, .25) - grassRelief > pick) { ground = litter; living = .6; }
        if (vSplatB.y + RELIEF(mud, .18) - grassRelief > pick) { ground = mud; living = .2; }
        if (vSplatA.y + RELIEF(dirt, .27) - grassRelief > pick) { ground = dirt; living = .25; }
        if (vSplatB.z + RELIEF(sand, .42) - grassRelief > pick) { ground = sand; living = 0.; }
        if (vSplatA.x + RELIEF(trail, .42) * .5 > pick * .8 + .1) { ground = trail; living = 0.; }
        if (vSplatB.w + RELIEF(paving, .4) * .5 > pick * .8 + .1) { ground = paving * (.9 + macro * .2); living = 0.; }
        if (vSplatA.z + RELIEF(rock, .43) > pick) { ground = rock; living = 0.; }
        if (vSplatA.w + RELIEF(snow, .8) > pick) { ground = snow; living = 0.; }
        vec3 tone = mix(vec3(1.), vec3(.86 + macro * .26, .9 + macro * .2, .84 + macro * .2), living);
        diffuseColor.rgb *= ground * tone * mix(vec3(1.), vColor, living);`);
  };
  return material;
}

function attributes(heightfield, sample, xs, zs, heights, slopeStep) {
  const n = heights.length, splatA = new Float32Array(n * 4), splatB = new Float32Array(n * 4), colors = new Float32Array(n * 3), normals = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const x = xs[k], z = zs[k], h = heights[k];
    const dx = sample(x + slopeStep, z) - sample(x - slopeStep, z);
    const dz = sample(x, z + slopeStep) - sample(x, z - slopeStep);
    const nx = -dx, ny = 2 * slopeStep, nz = -dz, len = Math.hypot(nx, ny, nz);
    normals.set([nx / len, ny / len, nz / len], k * 3);
    const s = heightfield.surface(x, z, h, Math.hypot(dx, dz) / (2 * slopeStep));
    splatA.set(s.a, k * 4); splatB.set(s.b, k * 4); colors.set(s.tint, k * 3);
  }
  return { splatA, splatB, colors, normals };
}

/** Terrain mesh for one chunk. lod 0/1/2 = 2/4/8 units per quad. Skirts hide cracks between LODs. */
export function buildChunkMesh(heightfield, cx, cz, lod) {
  const g = heightfield.grid(cx, cz), stride = 1 << lod, n = heightfield.CELLS / stride, step = heightfield.STEP * stride;
  const side = n + 1, count = side * side + 4 * side;
  const pos = new Float32Array(count * 3);
  const set = (k, x, y, z) => { pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) set(j * side + i, g.x0 + i * step, g.heights[(j * stride) * (heightfield.CELLS + 1) + i * stride], g.z0 + j * step);
  const index = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  // Skirts: each border vertex again, 4 units lower, stitched to the edge.
  const edges = [[...Array(side).keys()].map(i => i), [...Array(side).keys()].map(i => n * side + i), [...Array(side).keys()].map(j => j * side), [...Array(side).keys()].map(j => j * side + n)];
  let k = side * side;
  edges.forEach((edge, e) => {
    const start = k;
    for (const v of edge) { set(k, pos[v * 3], pos[v * 3 + 1] - 4, pos[v * 3 + 2]); k++; }
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i], b = edge[i + 1], a2 = start + i, b2 = start + i + 1;
      e === 0 || e === 3 ? index.push(a, b, a2, b, b2, a2) : index.push(a, a2, b, b, a2, b2);
    }
  });
  // Surface data is computed once per chunk on the full grid and shared by every LOD;
  // skirt vertices copy the edge vertex above them so they shade like the edge.
  const cells = heightfield.CELLS, full = cells + 1;
  if (!g.attr) {
    const gx = new Float32Array(full * full), gz = new Float32Array(full * full);
    for (let j = 0; j < full; j++) for (let i = 0; i < full; i++) { gx[j * full + i] = g.x0 + i * heightfield.STEP; gz[j * full + i] = g.z0 + j * heightfield.STEP; }
    g.attr = attributes(heightfield, heightfield.heightAt, gx, gz, g.heights, heightfield.STEP);
  }
  const source = new Int32Array(count);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) source[j * side + i] = (j * stride) * full + i * stride;
  let s = side * side;
  for (const edge of edges) for (const v of edge) source[s++] = source[v];
  const attr = { normals: new Float32Array(count * 3), colors: new Float32Array(count * 3), splatA: new Float32Array(count * 4), splatB: new Float32Array(count * 4) };
  for (let v = 0; v < count; v++) {
    const o = source[v];
    attr.normals.set(g.attr.normals.subarray(o * 3, o * 3 + 3), v * 3); attr.colors.set(g.attr.colors.subarray(o * 3, o * 3 + 3), v * 3);
    attr.splatA.set(g.attr.splatA.subarray(o * 4, o * 4 + 4), v * 4); attr.splatB.set(g.attr.splatB.subarray(o * 4, o * 4 + 4), v * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(attr.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(attr.colors, 3));
  geometry.setAttribute('splatA', new THREE.BufferAttribute(attr.splatA, 4));
  geometry.setAttribute('splatB', new THREE.BufferAttribute(attr.splatB, 4));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, terrainMaterial());
  mesh.receiveShadow = true; mesh.name = `terrain ${cx},${cz} lod${lod}`;
  return mesh;
}

/** One coarse mesh over the whole region (and beyond its edge) for distant mountain silhouettes. */
export function buildFarTerrain(heightfield, step = 32, margin = 640) {
  const x0 = BOUNDS.minX - margin, z0 = BOUNDS.minZ - margin;
  const nx = Math.round((BOUNDS.maxX - BOUNDS.minX + 2 * margin) / step), nz = Math.round((BOUNDS.maxZ - BOUNDS.minZ + 2 * margin) / step);
  const count = (nx + 1) * (nz + 1), pos = new Float32Array(count * 3), xs = new Float32Array(count), zs = new Float32Array(count), hs = new Float32Array(count);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i, x = x0 + i * step, z = z0 + j * step, h = heightfield.computeHeight(x, z) - 1.5;
    pos.set([x, h, z], k * 3); xs[k] = x; zs[k] = z; hs[k] = h;
  }
  const index = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; index.push(a, c, b, b, c, d); }
  const attr = attributes(heightfield, heightfield.computeHeight, xs, zs, hs, step / 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(attr.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(attr.colors, 3));
  geometry.setAttribute('splatA', new THREE.BufferAttribute(attr.splatA, 4));
  geometry.setAttribute('splatB', new THREE.BufferAttribute(attr.splatB, 4));
  geometry.setIndex(index); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, terrainMaterial());
  mesh.name = 'far terrain'; mesh.receiveShadow = false;
  return mesh;
}

/** Lakes, marsh pools and the river share one water plane at WATER_LEVEL. */
export function buildWater() {
  const size = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ) + 1400;
  const texture = pixelTexture('water').clone();
  texture.repeat.set(size / 2, size / 2); texture.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: .84, emissive: 0x16303a, emissiveIntensity: .6, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, WATER_LEVEL, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
  mesh.renderOrder = 2; mesh.name = 'water';
  // Inside the streamed rings the chunk water (water.js) takes over; the plane stays out of its way.
  const focus = { value: new THREE.Vector2() };
  mat.onBeforeCompile = shader => {
    shader.uniforms.uFocus = focus;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ; uniform vec2 uFocus;')
      .replace('void main() {', 'void main() {\n  if (distance(vWorldXZ, uFocus) < 370.0) discard;');
  };
  let t = 0;
  return { mesh, update(dt, at) { t += dt; texture.offset.set(Math.floor(t * 4) / 64, Math.floor(t * 2.5) / 64); if (at) focus.value.set(at.x, at.z); } };
}
export { CHUNK };
