import * as THREE from 'three';

// CAVE ROCK — the goblin caves' walls, floors and ceilings as one rounded surface (systems/caves.js has the plans).
// The open space is a density field: per storey, the 2D distance to the plan's rock (blurred, so corners round off),
// a vault profile (walls curve into the ceiling like a tunnel, a small fillet at the floor), stairs and drops,
// extra tubes (a tunnel out to the daylight), and 3D noise on the rock but never on the floor. Surface nets turn it
// into a smooth mesh. Light is baked into the vertices like the PS1 did it (and as most games still light their
// dungeons: a coloured ambient that never goes black, many practical lights, darker crevices): an ambient term,
// ambient occlusion from the field, and every torch, fire, mushroom patch and shaft of daylight with a sight check
// over the plan, so a torch never shines through a wall. Dynamic lights (your lamp, a lit brazier) add on top.
// Goblin holes are filthy: a grime layer darkens the rock in blotches, soots the rock above every fire and torch,
// leaves a wet dark band where wall meets floor and muck on the floors.

function hash3(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** Smooth value noise in 3D, -1..1. */
export function vnoise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), s = t => t * t * (3 - 2 * t), u = s(x - X), v = s(y - Y), w = s(z - Z);
  const c = (i, j, k) => hash3(X + i, Y + j, Z + k), l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
}

/** Lambert with a pixel texture projected along the dominant axis (no UVs needed), the grime layer and the baked light. */
export function caveRockMaterial(texture, tint = 0xffffff, grime = 0x2a2218) {
  const material = new THREE.MeshLambertMaterial({ color: tint });
  material.onBeforeCompile = shader => {
    shader.uniforms.rockMap = { value: texture }; shader.uniforms.rockScale = { value: 16 / texture.image.width }; shader.uniforms.rockGrime = { value: new THREE.Color(grime) };
    shader.vertexShader = 'attribute vec3 baked;\nattribute float grime;\nvarying vec3 vBaked;\nvarying float vGrime;\nvarying vec3 vRockPos;\nvarying vec3 vRockNormal;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvBaked = baked; vGrime = grime; vRockPos = (modelMatrix * vec4(position, 1.)).xyz; vRockNormal = normal;');
    shader.fragmentShader = 'uniform sampler2D rockMap;\nuniform float rockScale;\nuniform vec3 rockGrime;\nvarying vec3 vBaked;\nvarying float vGrime;\nvarying vec3 vRockPos;\nvarying vec3 vRockNormal;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', `vec3 rockAxis = abs(normalize(vRockNormal));
        vec2 rockUV = rockAxis.y > .65 ? vRockPos.xz : (rockAxis.x > rockAxis.z ? vRockPos.zy : vRockPos.xy);
        diffuseColor *= texture2D(rockMap, rockUV * rockScale);
        // Grime in whole texels, so it reads as dirt on the pixel rock and not as a smooth shadow.
        vec2 grimeTexel = floor(rockUV * 16.);
        float grimeDither = fract(sin(dot(grimeTexel, vec2(12.9898, 78.233))) * 43758.5453) * .3 - .15;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * rockGrime * 2.2, clamp(vGrime + grimeDither * step(.05, vGrime), 0., 1.));`)
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * vBaked;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'cave-rock';
  return material;
}

const S = .5; // sample spacing of the field (world units)
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * cells: { W, H, CELL, x0, z0 } (the plan's grid; x0/z0 = its west/north edge). levels: [{ L, y, open(i, j), floor(i, j, x, z), top(i, j) }]
 * (absolute heights; floor may dip below y on stairs and drops). tubes: [{ a: [x, y, z], b: [x, y, z], r }]. lights: [{ x, y, z,
 * color: THREE.Color (linear, strength included), range, L }]. ambient: THREE.Color. classify(x, y, z, nx, ny, nz) → material key;
 * materials: { key: material }. Returns the mesh.
 */
export function buildCaveRock({ cells, levels, tubes = [], lights = [], ambient, classify, materials, noise = .3 }) {
  const { W, H, CELL } = cells;
  // ── Bounds round everything open.
  let i0 = W, i1 = -1, j0 = H, j1 = -1, ylo = Infinity, yhi = -Infinity;
  for (const lv of levels) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (lv.open(i, j)) {
    i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
    ylo = Math.min(ylo, lv.floor(i, j, cells.x0 + (i + .5) * CELL, cells.z0 + (j + .5) * CELL)); yhi = Math.max(yhi, lv.top(i, j));
  }
  let xlo = cells.x0 + i0 * CELL - 3, xhi = cells.x0 + (i1 + 1) * CELL + 3, zlo = cells.z0 + j0 * CELL - 3, zhi = cells.z0 + (j1 + 1) * CELL + 3;
  for (const t of tubes) for (const p of [t.a, t.b]) { xlo = Math.min(xlo, p[0] - t.r - 2); xhi = Math.max(xhi, p[0] + t.r + 2); zlo = Math.min(zlo, p[2] - t.r - 2); zhi = Math.max(zhi, p[2] + t.r + 2); ylo = Math.min(ylo, p[1] - t.r - 1); yhi = Math.max(yhi, p[1] + t.r + 1); }
  ylo -= 1.5; yhi += 1.5;
  const nx = Math.ceil((xhi - xlo) / S) + 1, ny = Math.ceil((yhi - ylo) / S) + 1, nz = Math.ceil((zhi - zlo) / S) + 1, nxz = nx * nz;
  const X = ix => xlo + ix * S, Y = iy => ylo + iy * S, Z = iz => zlo + iz * S;
  const cellI = x => Math.floor((x - cells.x0) / CELL), cellJ = z => Math.floor((z - cells.z0) / CELL);

  // ── Per storey: blurred distance to rock (negative inside the open space), ceiling and floor at every sample column.
  const blur = (a, passes = 2, r = 2) => {
    const tmp = new Float32Array(a.length);
    for (let p = 0; p < passes; p++) {
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const x = ix + k; if (x >= 0 && x < nx) { s += a[iz * nx + x]; n++; } } tmp[iz * nx + ix] = s / n; }
      for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const z = iz + k; if (z >= 0 && z < nz) { s += tmp[z * nx + ix]; n++; } } a[iz * nx + ix] = s / n; }
    }
    return a;
  };
  const columns = levels.map(lv => {
    const d2 = new Float32Array(nxz), top = new Float32Array(nxz), floor = new Float32Array(nxz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = X(ix), z = Z(iz), i = cellI(x), j = cellJ(z), inside = i >= 0 && j >= 0 && i < W && j < H && lv.open(i, j), k = iz * nx + ix;
      // Distance to the nearest cell of the other kind (squares CELL wide).
      let best = 3 * CELL, roof = -Infinity;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const ci = i + di, cj = j + dj, o = ci >= 0 && cj >= 0 && ci < W && cj < H && lv.open(ci, cj);
        if (o && Math.abs(di) <= 1 && Math.abs(dj) <= 1) roof = Math.max(roof, lv.top(ci, cj));
        if (o === inside) continue;
        const ax = cells.x0 + ci * CELL, az = cells.z0 + cj * CELL, dx = Math.max(ax - x, 0, x - ax - CELL), dz = Math.max(az - z, 0, z - az - CELL);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      d2[k] = inside ? -best : best;
      top[k] = inside ? lv.top(i, j) : roof > -Infinity ? roof : lv.y + 3;
      floor[k] = inside ? lv.floor(i, j, x, z) : lv.y;
    }
    return { lv, d2: blur(d2, 2, 1), top: blur(top, 1, 2), floor };
  });

  // ── The field: negative is open, positive is rock.
  const D = new Float32Array(nx * ny * nz), wallness = new Float32Array(nx * ny * nz);
  for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const k = ix + nx * (iy + ny * iz);
    if (!ix || !iy || !iz || ix === nx - 1 || iy === ny - 1 || iz === nz - 1) { D[k] = 1; continue; }
    const x = X(ix), y = Y(iy), z = Z(iz), c = iz * nx + ix;
    let den = 3, wall = 1;
    for (const col of columns) {
      const f = col.floor[c], hgt = col.top[c] - f, h = y - f;
      if (h < -2 || h > hgt + 2) continue;
      const delta = -col.d2[c], R = Math.min(2.6, Math.max(.9, hgt * .42)), a = h - (hgt - R);
      let inset = a > 0 ? R - Math.sqrt(Math.max(0, R * R - a * a)) : 0;
      if (h < .25) inset += .25 - Math.sqrt(Math.max(0, .0625 - (.25 - h) ** 2));
      const dl = Math.max(inset - delta, -h, h - hgt);
      if (dl < den) { den = dl; wall = smooth(.1, .9, h); }
    }
    for (const t of tubes) {
      const bx = t.b[0] - t.a[0], by = t.b[1] - t.a[1], bz = t.b[2] - t.a[2], px = x - t.a[0], py = y - t.a[1], pz = z - t.a[2];
      const u = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
      const dl = Math.hypot(px - bx * u, py - by * u, pz - bz * u) - t.r;
      if (dl < den) { den = dl; wall = 1; }
    }
    den = Math.max(-3, Math.min(3, den));
    // Rough rock, never a rough floor.
    if (den > -1.2 && den < 1.2 && wall > 0) den += (vnoise(x * .55, y * .55, z * .55) * noise + vnoise(x * 1.6 + 17, y * 1.6, z * 1.6) * noise * .4) * wall;
    D[k] = den; wallness[k] = wall;
  }

  // ── Surface nets: one vertex per cube the surface passes through, one quad per crossed edge.
  const cube = (ix, iy, iz) => ix + (nx - 1) * (iy + (ny - 1) * iz);
  const vid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [], nrm = [];
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let iz = 0; iz < nz - 1; iz++) for (let iy = 0; iy < ny - 1; iy++) for (let ix = 0; ix < nx - 1; ix++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) { const [a, b, d] = CORNERS[c]; v[c] = D[ix + a + nx * (iy + b + ny * (iz + d))]; if (v[c] < 0) inside++; }
    if (!inside || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [p, q] of EDGES) {
      if ((v[p] < 0) === (v[q] < 0)) continue;
      const t = v[p] / (v[p] - v[q]), A = CORNERS[p], B = CORNERS[q];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    vid[cube(ix, iy, iz)] = pos.length / 3;
    pos.push(X(ix) + sx / n * S, Y(iy) + sy / n * S, Z(iz) + sz / n * S);
    // Normal from the field's gradient across the cube (pointing into the open air).
    const gx = (v[1] - v[0]) + (v[3] - v[2]) + (v[5] - v[4]) + (v[7] - v[6]), gy = (v[2] - v[0]) + (v[3] - v[1]) + (v[6] - v[4]) + (v[7] - v[5]), gz = (v[4] - v[0]) + (v[5] - v[1]) + (v[6] - v[2]) + (v[7] - v[3]);
    const len = Math.hypot(gx, gy, gz) || 1; nrm.push(-gx / len, -gy / len, -gz / len);
  }
  const tris = new Map();
  const emit = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const q = flip ? [a, d, c, b] : [a, b, c, d];
    // Material by the quad's middle and its average normal.
    let mx = 0, my = 0, mz = 0, gx = 0, gy = 0, gz = 0;
    for (const vi of q) { mx += pos[vi * 3]; my += pos[vi * 3 + 1]; mz += pos[vi * 3 + 2]; gx += nrm[vi * 3]; gy += nrm[vi * 3 + 1]; gz += nrm[vi * 3 + 2]; }
    const gl = Math.hypot(gx, gy, gz) || 1, key = classify(mx / 4, my / 4, mz / 4, gx / gl, gy / gl, gz / gl);
    if (!tris.has(key)) tris.set(key, []);
    tris.get(key).push(q[0], q[1], q[2], q[0], q[2], q[3]);
  };
  for (let iz = 1; iz < nz - 1; iz++) for (let iy = 1; iy < ny - 1; iy++) for (let ix = 1; ix < nx - 1; ix++) {
    const k = ix + nx * (iy + ny * iz), here = D[k] < 0;
    if (ix < nx - 1 && here !== (D[k + 1] < 0)) emit(vid[cube(ix, iy - 1, iz - 1)], vid[cube(ix, iy, iz - 1)], vid[cube(ix, iy, iz)], vid[cube(ix, iy - 1, iz)], here);
    if (iy < ny - 1 && here !== (D[k + nx] < 0)) emit(vid[cube(ix - 1, iy, iz - 1)], vid[cube(ix - 1, iy, iz)], vid[cube(ix, iy, iz)], vid[cube(ix, iy, iz - 1)], here);
    if (iz < nz - 1 && here !== (D[k + nx * ny] < 0)) emit(vid[cube(ix - 1, iy - 1, iz)], vid[cube(ix, iy - 1, iz)], vid[cube(ix, iy, iz)], vid[cube(ix - 1, iy, iz)], here);
  }

  // ── Baked light: ambient times occlusion, plus every light that can see the vertex.
  const sample = (x, y, z) => {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - xlo) / S)), fy = Math.min(ny - 1.001, Math.max(0, (y - ylo) / S)), fz = Math.min(nz - 1.001, Math.max(0, (z - zlo) / S));
    const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz), u = fx - ix, w = fy - iy, t = fz - iz, at = (a, b, c) => D[ix + a + nx * (iy + b + ny * (iz + c))];
    const l = (a, b, s) => a + (b - a) * s;
    return l(l(l(at(0, 0, 0), at(1, 0, 0), u), l(at(0, 1, 0), at(1, 1, 0), u), w), l(l(at(0, 0, 1), at(1, 0, 1), u), l(at(0, 1, 1), at(1, 1, 1), u), w), t);
  };
  const levelAt = y => levels.reduce((best, lv) => lv.y <= y + 1 && (!best || lv.y > best.y) ? lv : best, null) || levels[levels.length - 1];
  const sees = (lv, x, z, tx, tz) => {
    const d = Math.hypot(tx - x, tz - z), steps = Math.ceil(d / .5);
    for (let s = 1; s < steps; s++) { const px = x + (tx - x) * s / steps, pz = z + (tz - z) * s / steps, i = cellI(px), j = cellJ(pz); if (i < 0 || j < 0 || i >= W || j >= H || !lv.open(i, j)) return false; }
    return true;
  };
  const count = pos.length / 3, baked = new Float32Array(count * 3), dirt = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], n0 = nrm[k * 3], n1 = nrm[k * 3 + 1], n2 = nrm[k * 3 + 2];
    // Occlusion: how much open air lies a little way out along the normal.
    const ao = Math.min(1, Math.max(.4, .45 - sample(x + n0 * .9, y + n1 * .9, z + n2 * .9) * .5));
    let r = ambient.r * ao, g = ambient.g * ao, b = ambient.b * ao;
    const ox = x + n0 * .6, oz = z + n2 * .6, lv = levelAt(y);
    for (const L of lights) {
      const dx = L.x - x, dy = L.y - y, dz = L.z - z, d = Math.hypot(dx, dy, dz);
      if (d > L.range) continue;
      const lam = Math.min(1, Math.max(0, (n0 * dx + n1 * dy + n2 * dz) / (d || 1) * .8 + .2));
      if (!lam) continue;
      if (L.L !== undefined && L.L !== lv.L ? d > 6 : !sees(lv, ox, oz, L.x, L.z)) continue;
      const fall = (1 - (d / L.range) ** 2) ** 2 * lam;
      r += L.color.r * fall; g += L.color.g * fall; b += L.color.b * fall;
    }
    baked[k * 3] = r; baked[k * 3 + 1] = g; baked[k * 3 + 2] = b;
    // Grime: blotches and drips everywhere, a wet band at the foot of the walls, muck on the floors, soot above fires.
    const blot = smooth(-.1, .55, vnoise(x * .28 + 3, y * .45, z * .28)) * .5 + smooth(.3, .8, vnoise(x * .9, y * 2.2, z * .9)) * .25;
    let grime = blot;
    if (n1 > .6) grime = Math.max(grime, smooth(-.2, .6, vnoise(x * .35, 7, z * .35)) * .6);
    else grime = Math.max(grime, smooth(1.1, .1, y - lv.y) * .55);
    for (const L of lights) { const up = y - L.y, side = Math.hypot(L.x - x, L.z - z); if (up > 0 && up < 4 && side < 2.2) grime = Math.max(grime, (1 - side / 2.2) * (1 - up / 4) * .9); }
    dirt[k] = Math.min(.9, grime);
  }

  const geometry = new THREE.BufferGeometry(), index = [], mats = [];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geometry.setAttribute('baked', new THREE.Float32BufferAttribute(baked, 3));
  geometry.setAttribute('grime', new THREE.Float32BufferAttribute(dirt, 1));
  for (const [key, list] of tris) { geometry.addGroup(index.length, list.length, mats.length); mats.push(materials[key]); for (const v of list) index.push(v); }
  geometry.setIndex(index); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, mats);
  mesh.name = 'cave rock'; mesh.receiveShadow = false; mesh.castShadow = false;
  return mesh;
}
