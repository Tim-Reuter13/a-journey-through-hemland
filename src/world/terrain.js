import * as THREE from 'three';
import { pixelTexture, textureSize } from '../art/pixelTextures.js';
import { BOUNDS, CHUNK, WATER_LEVEL } from './hemland.js';
import { cityGroundMap, CITY_MAP } from './streets.js';
import { burnUniforms, BURN_GLSL } from './burnMap.js';

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
    shader.vertexShader = 'attribute vec4 splatA;\nattribute vec4 splatB;\nattribute float shade;\nattribute vec3 rockTint;\nvarying vec4 vSplatA;\nvarying vec4 vSplatB;\nvarying float vShade;\nvarying vec3 vRockTint;\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSplatA = splatA; vSplatB = splatB; vShade = shade; vRockTint = rockTint; vTerrainPos = (modelMatrix * vec4(position, 1.)).xyz; vTerrainNormal = normal;`);
    Object.assign(shader.uniforms, burnUniforms);
    shader.fragmentShader = `${BURN_GLSL}
      uniform sampler2D ${Object.keys(uniforms).filter(n => n !== 'cityBounds').join(', ')}; uniform vec4 cityBounds;
      varying vec4 vSplatA; varying vec4 vSplatB; varying float vShade; varying vec3 vRockTint; varying vec3 vTerrainPos; varying vec3 vTerrainNormal;
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
        vec3 grass = layer(t_grass, groundUV, ${scale('grass')}, other), dirt = layer(t_dirt, cliffUV, ${scale('dirt')}, otherRock), trail = layer(t_path, groundUV, ${scale('path')}, other);
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
        vec3 ground = grass; float living = 1.; vec3 stoneTint = vRockTint;
        // Height blending: each layer's own relief (how far a texel is lighter than its layer's
        // average) moves the edge, so stones, clods and leaf heaps poke through first.
        #define RELIEF(c, mean) ((dot(c, vec3(.333)) - mean) * .9)
        float grassRelief = RELIEF(grass, .33);
        if (vSplatB.x + RELIEF(litter, .25) - grassRelief > pick) { ground = litter; living = .6; }
        if (vSplatB.y + RELIEF(mud, .18) - grassRelief > pick) { ground = mud; living = .2; }
        if (vSplatA.y + RELIEF(dirt, .27) - grassRelief > pick) { ground = dirt; living = .25; }
        if (vSplatB.z + RELIEF(sand, .42) - grassRelief > pick) { ground = sand; living = 0.; }
        if (vSplatA.x + RELIEF(trail, .42) * .5 > pick * .8 + .1) { ground = trail; living = 0.; }
        if (vSplatB.w + RELIEF(paving, .4) * .5 > pick * .8 + .1) { ground = paving * (.9 + macro * .2); living = 0.; stoneTint = vec3(1.); }
        if (vSplatA.z + RELIEF(rock, .43) > pick) {
          // Strata: bands of lighter and darker stone down a face, and long weathering streaks running with the fall line.
          float strata = terrainHash(vec2(floor(vTerrainPos.y * 1.25), 3.)), streak = terrainNoise(vec2(cliffUV.x * .55, cliffUV.y * .09 + 11.));
          ground = rock * (.78 + strata * .36) * (.8 + streak * .38); living = 0.;
        }
        if (vSplatA.w + RELIEF(snow, .8) > pick) { ground = snow; living = 0.; stoneTint = vec3(1.); }
        vec3 tone = mix(vec3(1.), vec3(.86 + macro * .26, .9 + macro * .2, .84 + macro * .2), living);
        diffuseColor.rgb *= ground * tone * mix(stoneTint, vColor, living) * (1. - vShade);
        // Fire (world/burnMap.js): melted snow shows bare wet earth; scorched ground chars, with a ragged
        // pixel edge, ash flecks and glowing embers while it is still hot.
        vec4 bg = burnGround(vTerrainPos);
        if (bg.b > .03 && bg.b + (terrainHash(texel + 31.) - .5) * .5 > .45) diffuseColor.rgb = mix(diffuseColor.rgb, mud * vec3(.8, .75, .7), .85);
        if (bg.r > .02) {
          float edge = bg.r + (terrainHash(texel + 17.) - .5) * .55, ashPick = terrainHash(texel * 1.7 + 3.);
          if (edge > .5) {
            vec3 charred = mix(vec3(.05, .046, .042), vec3(.17, .16, .15), step(.82, ashPick));
            diffuseColor.rgb = mix(diffuseColor.rgb * .4, charred, smoothstep(.5, .75, edge));
            gBurnEmit += vec3(1., .36, .07) * bg.g * step(.86, terrainHash(texel + floor(uBurnTime * 3.))) * 1.2;
          } else if (edge > .32) diffuseColor.rgb *= .55;
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n        totalEmissiveRadiance += gBurnEmit;');
  };
  return material;
}

function attributes(heightfield, sample, xs, zs, heights, slopeStep) {
  const n = heights.length, splatA = new Float32Array(n * 4), splatB = new Float32Array(n * 4), colors = new Float32Array(n * 3), rock = new Float32Array(n * 3), normals = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const x = xs[k], z = zs[k], h = heights[k];
    const dx = sample(x + slopeStep, z) - sample(x - slopeStep, z);
    const dz = sample(x, z + slopeStep) - sample(x, z - slopeStep);
    const nx = -dx, ny = 2 * slopeStep, nz = -dz, len = Math.hypot(nx, ny, nz);
    normals.set([nx / len, ny / len, nz / len], k * 3);
    const s = heightfield.surface(x, z, h, Math.hypot(dx, dz) / (2 * slopeStep));
    splatA.set(s.a, k * 4); splatB.set(s.b, k * 4); colors.set(s.tint, k * 3); rock.set(s.rock, k * 3);
  }
  return { splatA, splatB, colors, rock, normals };
}

// Goblin holes (heightfield.js burrows) are far narrower than the 2-unit grid. At full detail the cells round each
// one are drawn on a grid four times finer: heights from heightAt (the hole included), everything else interpolated
// from the cell's corners exactly as the coarse triangles would be (so the patch meets them without a seam), then
// bare earth round the rim, rock down the walls, darker and darker towards the bottom.
const SUB = 4;
function pitCells(heightfield, g) {
  const C = heightfield.CELLS, i0 = g.cx * C, j0 = g.cz * C, cells = new Set();
  for (const b of heightfield.burrows) for (let j = Math.max(b.j0, j0); j < Math.min(b.j1, j0 + C); j++) for (let i = Math.max(b.i0, i0); i < Math.min(b.i1, i0 + C); i++) cells.add((j - j0) * C + i - i0);
  return cells.size ? cells : null;
}
function pitPatch(heightfield, g, cells) {
  const C = heightfield.CELLS, full = C + 1, A = g.attr, e = .25;
  const out = { pos: [], normals: [], colors: [], rock: [], splatA: [], splatB: [], shade: [], index: [] };
  const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const dh = (x, z) => heightfield.pit(x, z)?.dh || 0;
  const copy = (k, drop) => {
    out.pos.push(out.pos[k * 3], out.pos[k * 3 + 1] - drop, out.pos[k * 3 + 2]);
    for (const [name, size] of [['normals', 3], ['colors', 3], ['rock', 3], ['splatA', 4], ['splatB', 4], ['shade', 1]]) for (let c = 0; c < size; c++) out[name].push(out[name][k * size + c]);
    return out.shade.length - 1;
  };
  for (const cell of cells) {
    const i = cell % C, j = Math.floor(cell / C), corner = [j * full + i, j * full + i + 1, (j + 1) * full + i, (j + 1) * full + i + 1];
    const base = out.shade.length;
    for (let v = 0; v <= SUB; v++) for (let u = 0; u <= SUB; u++) {
      const fu = u / SUB, fv = v / SUB, x = g.x0 + (i + fu) * heightfield.STEP, z = g.z0 + (j + fv) * heightfield.STEP;
      // Barycentric weights of corners a, b, c, d in the coarse cell's two triangles (split b–c, as heightAt).
      const w = fu + fv <= 1 ? [1 - fu - fv, fu, fv, 0] : [0, 1 - fv, 1 - fu, fu + fv - 1];
      const mix = (arr, size) => { const r = new Array(size).fill(0); for (let n = 0; n < 4; n++) if (w[n]) for (let c = 0; c < size; c++) r[c] += arr[corner[n] * size + c] * w[n]; return r; };
      // Slopes, not normals, interpolate linearly; the hole's own slope is added on top.
      let gx = 0, gz = 0;
      for (let n = 0; n < 4; n++) if (w[n]) { const o = corner[n] * 3; gx -= A.normals[o] / A.normals[o + 1] * w[n]; gz -= A.normals[o + 2] / A.normals[o + 1] * w[n]; }
      gx += (dh(x + e, z) - dh(x - e, z)) / (2 * e); gz += (dh(x, z + e) - dh(x, z - e)) / (2 * e);
      const len = Math.hypot(gx, 1, gz), a = mix(A.splatA, 4), b = mix(A.splatB, 4), p = heightfield.pit(x, z);
      if (p) { a[1] = Math.max(a[1], ss(1.5, 1.05, p.r) * .85); a[2] = Math.max(a[2], p.rock); b[0] *= ss(1.1, 1.5, p.r); b[1] = Math.max(b[1], ss(1.05, .7, p.r) * .5); }
      out.pos.push(x, heightfield.heightAt(x, z), z); out.normals.push(-gx / len, 1 / len, -gz / len);
      out.colors.push(...mix(A.colors, 3)); out.rock.push(...mix(A.rock, 3)); out.splatA.push(...a); out.splatB.push(...b); out.shade.push(p ? p.shade : 0);
    }
    for (let v = 0; v < SUB; v++) for (let u = 0; u < SUB; u++) {
      const a = base + v * (SUB + 1) + u, b = a + 1, c = a + SUB + 1, d = c + 1;
      out.index.push(a, c, b, b, c, d);
    }
    // Where the patch meets coarse cells their edges carry fewer vertices: a short skirt under each such side
    // hides any hairline crack.
    const gi = g.cx * C + i, gj = g.cz * C + j;
    for (const [di, dj, edge] of [[0, -1, u => u], [0, 1, u => SUB * (SUB + 1) + u], [-1, 0, v => v * (SUB + 1)], [1, 0, v => v * (SUB + 1) + SUB]]) {
      if (heightfield.pitCell(gi + di, gj + dj)) continue;
      const top = [...Array(SUB + 1).keys()].map(t => base + edge(t)), low = top.map(k => copy(k, .6));
      for (let t = 0; t < SUB; t++) out.index.push(top[t], low[t], top[t + 1], top[t + 1], low[t], low[t + 1], top[t], top[t + 1], low[t], top[t + 1], low[t + 1], low[t]);
    }
  }
  return out;
}

/** Terrain mesh for one chunk. lod 0/1/2 = 2/4/8 units per quad. Skirts hide cracks between LODs. */
export function buildChunkMesh(heightfield, cx, cz, lod) {
  const g = heightfield.grid(cx, cz), stride = 1 << lod, n = heightfield.CELLS / stride, step = heightfield.STEP * stride;
  const side = n + 1, count = side * side + 4 * side;
  const pos = new Float32Array(count * 3);
  const set = (k, x, y, z) => { pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) set(j * side + i, g.x0 + i * step, g.heights[(j * stride) * (heightfield.CELLS + 1) + i * stride], g.z0 + j * step);
  const index = [], fine = lod === 0 ? pitCells(heightfield, g) : null;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (fine?.has(j * n + i)) continue;
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
    g.attr = attributes(heightfield, heightfield.gridHeightAt, gx, gz, g.heights, heightfield.STEP);
  }
  const source = new Int32Array(count);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) source[j * side + i] = (j * stride) * full + i * stride;
  let s = side * side;
  for (const edge of edges) for (const v of edge) source[s++] = source[v];
  const attr = { normals: new Float32Array(count * 3), colors: new Float32Array(count * 3), rock: new Float32Array(count * 3), splatA: new Float32Array(count * 4), splatB: new Float32Array(count * 4) };
  for (let v = 0; v < count; v++) {
    const o = source[v];
    attr.normals.set(g.attr.normals.subarray(o * 3, o * 3 + 3), v * 3); attr.colors.set(g.attr.colors.subarray(o * 3, o * 3 + 3), v * 3); attr.rock.set(g.attr.rock.subarray(o * 3, o * 3 + 3), v * 3);
    attr.splatA.set(g.attr.splatA.subarray(o * 4, o * 4 + 4), v * 4); attr.splatB.set(g.attr.splatB.subarray(o * 4, o * 4 + 4), v * 4);
  }
  let position = pos, shade = new Float32Array(count);
  if (fine) {
    const patch = pitPatch(heightfield, g, fine), grow = (a, extra) => { const r = new Float32Array(a.length + extra.length); r.set(a); r.set(extra, a.length); return r; };
    position = grow(pos, patch.pos); shade = grow(shade, patch.shade);
    for (const name of ['normals', 'colors', 'rock', 'splatA', 'splatB']) attr[name] = grow(attr[name], patch[name]);
    for (const k of patch.index) index.push(k + count);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(attr.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(attr.colors, 3));
  geometry.setAttribute('rockTint', new THREE.BufferAttribute(attr.rock, 3));
  geometry.setAttribute('splatA', new THREE.BufferAttribute(attr.splatA, 4));
  geometry.setAttribute('splatB', new THREE.BufferAttribute(attr.splatB, 4));
  geometry.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, terrainMaterial());
  mesh.receiveShadow = true; mesh.name = `terrain ${cx},${cz} lod${lod}`;
  return mesh;
}

/** One coarse mesh over the whole region (and beyond its edge) for distant mountain silhouettes. */
// The far terrain (a 32-unit grid, lowered 1.5 units) fills the view beyond the streamed chunks. It must
// never draw where a near chunk is loaded: in a pond or any hollow narrower than its grid its coarse surface
// lies above the real ground and the water, and would hide them behind a straight edge. One texel per chunk
// says which chunks are loaded (the streamer keeps it up to date).
const FAR_MASK = 32, FAR_ORIGIN = [Math.floor((BOUNDS.minX - 640) / CHUNK), Math.floor((BOUNDS.minZ - 640) / CHUNK)];
const farMaskData = new Uint8Array(FAR_MASK * FAR_MASK);
const farMask = new THREE.DataTexture(farMaskData, FAR_MASK, FAR_MASK, THREE.RedFormat, THREE.UnsignedByteType);
farMask.magFilter = farMask.minFilter = THREE.NearestFilter; farMask.needsUpdate = true;
/** Marks a near terrain chunk as drawn (or dropped), so the far terrain leaves it alone. */
export function markNearChunk(cx, cz, loaded) {
  const i = cx - FAR_ORIGIN[0], j = cz - FAR_ORIGIN[1];
  if (i < 0 || j < 0 || i >= FAR_MASK || j >= FAR_MASK) return;
  farMaskData[j * FAR_MASK + i] = loaded ? 255 : 0; farMask.needsUpdate = true;
}
function farTerrainMaterial() {
  const near = terrainMaterial(), far = new THREE.MeshLambertMaterial({ vertexColors: true });
  far.onBeforeCompile = (shader, renderer) => {
    near.onBeforeCompile(shader, renderer);
    shader.uniforms.farMask = { value: farMask }; shader.uniforms.farOrigin = { value: new THREE.Vector2(...FAR_ORIGIN) };
    shader.fragmentShader = 'uniform sampler2D farMask; uniform vec2 farOrigin;\n' + shader.fragmentShader.replace('void main() {', `void main() {
      vec2 farChunk = floor(vTerrainPos.xz / ${CHUNK}.) - farOrigin;
      if (texture2D(farMask, (farChunk + .5) / ${FAR_MASK}.).r > .5) discard;`);
  };
  far.customProgramCacheKey = () => 'far-terrain';
  return far;
}
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
  geometry.setAttribute('rockTint', new THREE.BufferAttribute(attr.rock, 3));
  geometry.setAttribute('splatA', new THREE.BufferAttribute(attr.splatA, 4));
  geometry.setAttribute('splatB', new THREE.BufferAttribute(attr.splatB, 4));
  geometry.setAttribute('shade', new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setIndex(index); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, farTerrainMaterial());
  mesh.name = 'far terrain'; mesh.receiveShadow = false;
  return mesh;
}

/** Lakes, marsh pools and the river share one water plane at WATER_LEVEL. */
export function buildWater() {
  const size = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ) + 1400;
  const texture = pixelTexture('water').clone();
  texture.repeat.set(size / 2, size / 2); texture.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: texture, color: 0x6f8c92, transparent: true, opacity: .92, emissive: 0x10232b, emissiveIntensity: .5, depthWrite: false });
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
