import * as THREE from 'three';
import { atlasMapFor } from '../characters/modular.js';
import { traceSpellSurface } from './spellFx.js';
import { createHeightCache } from '../world/heightCache.js';
import { TILE, CELL, FILM, KIND, CORE, flowStep, absorb, poolPixel, bodyPixel, uvFrame, pixelStep, linePixels, regionOf, REGIONS, cellHash } from './bloodSim.js';

// HUMANITY BLOOD — pixel blood that knows what it hit.
//  • Drops are 1/16 m blocks (the world's texel); fast ones stretch into streaks.
//  • Blood that lands joins a pixel fluid: 2 m ground tiles of 32×32 cells that flow downhill, pool, soak into
//    the ground by surface, dry from red to near-black and keep a darker rim.
//  • A blow is raycast onto the character's own texture atlas. The pixel it hits tells skin from cloth from
//    leather, mail and plate: bare skin gets a gash along the blade's path (it follows the body across faces)
//    and runs that trickle down the model, cloth soaks, armour only shows scratches and sparks.
//  • Every wound stays on its bone and keeps bleeding: pulses from the neck while alive, a gravity stream
//    after death, light drips from limbs. All of it ends in the ground pools.
const SIZE = TILE * CELL;            // 2 m
const MAX_TILES = 24, DROPS = 520, CLOUDS = 40, SEG = 8;
const FIXED = 1 / 14;                // pool simulation step
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _zAxis = new THREE.Vector3(0, 0, 1), _color = new THREE.Color();
const rand = (a, b) => a + Math.random() * (b - a);
const ABSORB = { path: .05, mud: .09, sand: .07, wetsand: .05, snow: .012, null: .025 };

export function createBlood(scene, world, { spark = () => {}, sound = () => {} } = {}) {
  const root = new THREE.Group(); root.name = 'Blood'; scene.add(root);
  let time = 0, focus = new THREE.Vector3();
  // Drops ask for the ground every frame; the height function is slow, so they read a cache.
  const walk = createHeightCache((x, z) => world.heightAt(x, z), .5);

  // ── Drops.
  const dropMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, CELL, CELL), new THREE.MeshLambertMaterial({ color: 0xffffff }), DROPS);
  dropMesh.name = 'Blood drops'; dropMesh.frustumCulled = false; dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DROPS; i++) { dropMesh.setMatrixAt(i, hidden); dropMesh.setColorAt(i, _color.setRGB(1, 0, 0)); }
  root.add(dropMesh);
  const drops = Array.from({ length: DROPS }, () => ({ life: 0, duration: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 1, vol: .35, drag: .2, stretch: 1 }));
  let dropCursor = 0, dropsLive = 0;
  const DROP_COLORS = [0xa8101c, 0x8c0c1a, 0x7a0a16, 0xb61a26];
  function emitDrop(p, v, size = 1, vol = .35, life = 1.6, drag = .15) {
    for (let n = 0; n < DROPS; n++) {
      const i = (dropCursor + n) % DROPS, d = drops[i];
      if (d.life > 0) continue;
      dropCursor = (i + 1) % DROPS;
      d.life = d.duration = life; d.p.copy(p); d.v.copy(v); d.size = size; d.vol = vol; d.drag = drag; d.stretch = 1;
      dropMesh.setColorAt(i, _color.setHex(DROP_COLORS[(Math.random() * DROP_COLORS.length) | 0]));
      dropMesh.instanceColor.needsUpdate = true;
      return d;
    }
    return null;
  }

  // Blood in water: a pink cloud that swells and thins away.
  const cloudMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, CELL, CELL), new THREE.MeshBasicMaterial({ color: 0xc02838, transparent: true, opacity: .38, depthWrite: false }), CLOUDS);
  cloudMesh.name = 'Blood in water'; cloudMesh.frustumCulled = false; cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < CLOUDS; i++) cloudMesh.setMatrixAt(i, hidden);
  root.add(cloudMesh);
  const clouds = Array.from({ length: CLOUDS }, () => ({ life: 0, duration: 1, p: new THREE.Vector3(), size: 4 }));
  function cloud(x, y, z, size = 4) {
    const c = clouds.find(o => o.life <= 0) || clouds[0];
    c.life = c.duration = rand(1.3, 2.1); c.p.set(x, y, z); c.size = size * rand(.8, 1.4);
  }

  // ── Ground tiles: the pixel fluid.
  const tiles = new Map(), spare = [];
  const heights = new Float32Array((SEG + 1) * (SEG + 1));
  function makeTile() {
    const data = new Uint8Array(TILE * TILE * 4), tex = new THREE.DataTexture(data, TILE, TILE, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.needsUpdate = true;
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geometry.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .2 });
    const mesh = new THREE.Mesh(geometry, mat); mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.name = 'Blood pool'; root.add(mesh);
    return { vol: new Float32Array(TILE * TILE), next: new Float32Array(TILE * TILE), ground: new Float32Array(TILE * TILE), spill: new Float32Array(TILE * 4), data, tex, mesh,
      ix: 0, iz: 0, key: '', used: false, lastAdd: 0, lastStep: 0, settled: true, dirty: false, shade: -1, absorbRate: .03, total: 0 };
  }
  for (let i = 0; i < MAX_TILES; i++) spare.push(makeTile());
  const tileKey = (ix, iz) => `${ix},${iz}`;
  function getTile(ix, iz, create = true, keep = null) {
    const key = tileKey(ix, iz);
    let t = tiles.get(key);
    if (t || !create) return t || null;
    t = spare.pop();
    if (!t) {
      // Recycle the pool that is farthest from the viewer (dried ones first), never one still flowing.
      let worst = null, score = -1;
      for (const o of tiles.values()) {
        if (o === keep || (!o.settled && time - o.lastAdd < 20)) continue;
        const d = Math.hypot((o.ix + .5) * SIZE - focus.x, (o.iz + .5) * SIZE - focus.z) + (o.settled ? 40 : 0) + (time - o.lastAdd > 90 ? 40 : 0);
        if (d > score) { score = d; worst = o; }
      }
      if (!worst) return null;
      tiles.delete(worst.key); t = worst;
    }
    t.ix = ix; t.iz = iz; t.key = key; t.used = true; t.vol.fill(0); t.spill.fill(0); t.data.fill(0); t.tex.needsUpdate = true;
    t.lastAdd = t.lastStep = time; t.settled = false; t.dirty = true; t.shade = -1; t.total = 0;
    const ox = ix * SIZE, oz = iz * SIZE, pos = t.mesh.geometry.attributes.position, uv = t.mesh.geometry.attributes.uv;
    for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) {
      const k = j * (SEG + 1) + i, x = ox + i * SIZE / SEG, z = oz + j * SIZE / SEG, h = world.heightAt(x, z);
      heights[k] = h; pos.setXYZ(k, x, h + .018, z); uv.setXY(k, i / SEG, j / SEG);
    }
    pos.needsUpdate = uv.needsUpdate = true; t.mesh.geometry.computeBoundingSphere();
    // Cell heights: bilinear from the 9×9 samples.
    for (let cz = 0; cz < TILE; cz++) for (let cx = 0; cx < TILE; cx++) {
      const gx = (cx + .5) / TILE * SEG, gz = (cz + .5) / TILE * SEG, i0 = Math.min(SEG - 1, gx | 0), j0 = Math.min(SEG - 1, gz | 0), fx = gx - i0, fz = gz - j0, W = SEG + 1;
      t.ground[cz * TILE + cx] = (heights[j0 * W + i0] * (1 - fx) + heights[j0 * W + i0 + 1] * fx) * (1 - fz) + (heights[(j0 + 1) * W + i0] * (1 - fx) + heights[(j0 + 1) * W + i0 + 1] * fx) * fz;
    }
    t.absorbRate = ABSORB[world.groundAt?.(ox + SIZE / 2, oz + SIZE / 2) ?? 'null'] ?? .025;
    t.mesh.visible = true; tiles.set(key, t);
    return t;
  }
  /** Adds `amount` of blood at a point. */
  function addVolume(x, z, amount) {
    const ix = Math.floor(x / SIZE), iz = Math.floor(z / SIZE), t = getTile(ix, iz);
    if (!t) return;
    const cx = Math.min(TILE - 1, Math.floor((x - ix * SIZE) / CELL)), cz = Math.min(TILE - 1, Math.floor((z - iz * SIZE) / CELL));
    t.vol[cz * TILE + cx] += amount; t.lastAdd = time; t.settled = false; t.dirty = true;
  }
  /** A blot of blood: `amount` spread over a round patch of cells. */
  function pool(x, z, amount, radius = 4) {
    const n = Math.max(1, Math.round(radius * radius * 3.1)), each = amount / n;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * radius * CELL;
      addVolume(x + Math.cos(a) * r, z + Math.sin(a) * r, each);
    }
  }
  function volumeAt(x, z) {
    const ix = Math.floor(x / SIZE), iz = Math.floor(z / SIZE), t = tiles.get(tileKey(ix, iz));
    if (!t) return 0;
    return t.vol[Math.min(TILE - 1, Math.floor((z - iz * SIZE) / CELL)) * TILE + Math.min(TILE - 1, Math.floor((x - ix * SIZE) / CELL))];
  }
  const edgeVol = (t, x, z) => {
    if (x >= 0 && z >= 0 && x < TILE && z < TILE) return t.vol[z * TILE + x];
    const o = tiles.get(tileKey(t.ix + (x < 0 ? -1 : x >= TILE ? 1 : 0), t.iz + (z < 0 ? -1 : z >= TILE ? 1 : 0)));
    return o ? o.vol[((z + TILE) % TILE) * TILE + (x + TILE) % TILE] : 0;
  };
  function paintTile(t) {
    const age = time - t.lastAdd, d = t.data;
    for (let z = 0; z < TILE; z++) for (let x = 0; x < TILE; x++) {
      const i = z * TILE + x, v = t.vol[i], o = i * 4;
      let c = null;
      if (v >= .1) {
        const rim = edgeVol(t, x - 1, z) < .1 || edgeVol(t, x + 1, z) < .1 || edgeVol(t, x, z - 1) < .1 || edgeVol(t, x, z + 1) < .1;
        c = poolPixel(v, age + cellHash(i) * 12, rim, x, z);
      }
      if (c) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } else d[o + 3] = 0;
    }
    t.tex.needsUpdate = true; t.dirty = false; t.shade = Math.round(Math.max(0, 1 - age / 70) * 3);
  }
  function stepTiles(budget) {
    let stepped = 0;
    for (const t of tiles.values()) {
      if (!t.settled && time - t.lastStep >= FIXED && stepped < budget) {
        const dt = Math.min(.25, time - t.lastStep); t.lastStep = time; stepped++;
        t.spill.fill(0);
        const moved = flowStep(t.vol, t.ground, t.next, t.spill);
        t.vol.set(t.next); absorb(t.vol, t.absorbRate, dt);
        for (let side = 0; side < 4; side++) for (let k = 0; k < TILE; k++) {
          const amount = t.spill[side * TILE + k];
          if (amount < .002) continue;
          const o = getTile(t.ix + (side === 2 ? -1 : side === 3 ? 1 : 0), t.iz + (side === 0 ? -1 : side === 1 ? 1 : 0), true, t);
          if (!o) continue;
          const cx = side === 2 ? TILE - 1 : side === 3 ? 0 : k, cz = side === 0 ? TILE - 1 : side === 1 ? 0 : k;
          o.vol[cz * TILE + cx] += amount; o.settled = false; o.dirty = true; o.lastAdd = Math.max(o.lastAdd, time - 1);
        }
        t.dirty = true;
        if (moved < .02 && time - t.lastAdd > 1.5) t.settled = true;
      }
      // Wet blood changes colour in steps while it dries; paint only when a step changes.
      const shade = Math.round(Math.max(0, 1 - (time - t.lastAdd) / 70) * 3);
      if (t.dirty || shade !== t.shade) {
        let any = false;
        for (let i = 0; i < t.vol.length; i++) if (t.vol[i] >= .1) { any = true; break; }
        if (!any) { t.mesh.visible = false; t.dirty = false; t.shade = shade; t.settled = true; continue; }
        t.mesh.visible = true; paintTile(t);
      }
    }
  }

  // ── Drops in flight.
  function land(d, speed) {
    const x = d.p.x, z = d.p.z;
    if (world.water?.at(x, z)) { cloud(x, world.water.at(x, z).surface + .02, z, 2.5 + d.vol * 4); return; }
    addVolume(x, z, d.vol);
    if (d.vol >= .3 && Math.random() < .7) launchRunner(x, z, d.vol);
    if (speed > 3.2 && Math.random() < .35) {
      for (let k = 0; k < 2; k++) emitDrop(d.p, _v.set(rand(-1, 1), rand(1, 2), rand(-1, 1)), 1, .12, .5, .4);
    }
  }
  // A drop that lands on a slope does not stay: it runs downhill, leaving a thin trail, the further and faster the steeper.
  const runners = [];
  function launchRunner(x, z, vol) {
    const e = .3, gx = walk.at(x + e, z) - walk.at(x - e, z), gz = walk.at(x, z + e) - walk.at(x, z - e), slope = Math.hypot(gx, gz) / (2 * e);
    if (slope < .07) return;
    if (runners.length > 70) runners.shift();
    const l = Math.hypot(gx, gz);
    runners.push({ x, z, dx: -gx / l, dz: -gz / l, vol: vol * .9, left: Math.min(3.2, .4 + slope * 7), speed: .4 + slope * 3.2, acc: 0 });
  }
  function updateRunners(dt) {
    for (let i = runners.length - 1; i >= 0; i--) {
      const r = runners[i], step = r.speed * dt;
      r.x += r.dx * step + (Math.random() - .5) * step * .35; r.z += r.dz * step + (Math.random() - .5) * step * .35; r.left -= step; r.acc += step;
      while (r.acc >= CELL) { r.acc -= CELL; addVolume(r.x, r.z, .11); r.vol -= .11; }
      if (r.left <= 0 || r.vol <= 0) runners.splice(i, 1);
    }
  }
  function updateDrops(dt) {
    let live = 0;
    for (let i = 0; i < DROPS; i++) {
      const d = drops[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { dropMesh.setMatrixAt(i, hidden); continue; }
      d.v.y -= 9.8 * dt; d.v.multiplyScalar(Math.exp(-dt * d.drag));
      d.p.addScaledVector(d.v, dt);
      const ground = walk.at(d.p.x, d.p.z);
      if (d.p.y <= ground + .01) { d.p.y = ground + .01; land(d, d.v.length()); d.life = 0; dropMesh.setMatrixAt(i, hidden); continue; }
      const speed = d.v.length();
      // Thin: a drop is a fraction of a texel wide, fast ones are fine streaks.
      if (speed > 2) { _q.setFromUnitVectors(_zAxis, _n.copy(d.v).multiplyScalar(1 / speed)); _s.set(d.size * .6, d.size * .6, d.size * Math.min(4, 1 + speed * .4)); }
      else { _q.identity(); _s.setScalar(d.size * .7); }
      dropMesh.setMatrixAt(i, _m.compose(d.p, _q, _s)); live++;
    }
    dropsLive = live; dropMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < CLOUDS; i++) {
      const c = clouds[i];
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) { cloudMesh.setMatrixAt(i, hidden); continue; }
      const k = 1 - c.life / c.duration, s = c.size * (.5 + k * 2.4) * (k > .6 ? 1 - (k - .6) * 2.2 : 1);
      cloudMesh.setMatrixAt(i, _m.compose(_v.set(c.p.x, c.p.y + k * .12, c.p.z), _q.identity(), _s.setScalar(Math.max(.01, s))));
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
  }

  // A body dragged through a pool carries blood away and leaves it as a smear along the way.
  const bodies = new Map();
  function takeVolume(x, z, max) {
    const ix = Math.floor(x / SIZE), iz = Math.floor(z / SIZE), t = tiles.get(tileKey(ix, iz));
    if (!t) return 0;
    const i = Math.min(TILE - 1, Math.floor((z - iz * SIZE) / CELL)) * TILE + Math.min(TILE - 1, Math.floor((x - ix * SIZE) / CELL)), take = Math.min(t.vol[i], max);
    if (take > 0) { t.vol[i] -= take; t.dirty = true; t.settled = false; }
    return take;
  }
  const _body = new THREE.Vector3();
  function updateBodies(dt) {
    for (const [actor, b] of bodies) {
      const m = actor.model;
      b.age += dt;
      if (!m || !m.parent || b.age > 300) { bodies.delete(actor); continue; }
      m.getWorldPosition(_body);
      const dx = _body.x - b.x, dz = _body.z - b.z, moved = Math.hypot(dx, dz);
      if (moved > .03 && moved < 2.5 && _body.distanceToSquared(focus) < 60 * 60) {
        for (let k = 0; k < 10; k++) {
          const ox = (Math.random() - .5) * .55, oz = (Math.random() - .5) * .55, taken = takeVolume(b.x + ox, b.z + oz, .8);
          if (taken > .02) { const f = Math.random(); addVolume(b.x + dx * f + ox * .35, b.z + dz * f + oz * .35, taken * .85); }
        }
      }
      b.x = _body.x; b.z = _body.z;
    }
  }

  /** A generic burst of blood drops (what `effects.spray(…, 'blood', n)` used to be). */
  const _sp = new THREE.Vector3(), _sd = new THREE.Vector3(), _sv = new THREE.Vector3();
  function spurt(point, direction, count = 14, { speed = 2.4, spread = .8, size = 1, vol = .3 } = {}) {
    _sp.copy(point); _sd.copy(direction).normalize();
    for (let i = 0; i < count; i++) {
      _sv.set(rand(-1, 1), rand(-.25, 1), rand(-1, 1)).normalize().multiplyScalar(spread).add(_sd).normalize().multiplyScalar(speed * rand(.35, 1.25));
      emitDrop(_sp, _sv, size, vol, .9, .35);
    }
  }

  // ── Blood thrown against a wall stays there: a splat with drips, from a small pool of decals.
  const splatMaterials = [3, 11, 29].map(seed => {
    const data = new Uint8Array(16 * 16 * 4), rnd = (x, y) => { let h = Math.imul(x * 73 + seed, 668265263) ^ Math.imul(y * 41 + seed * 7, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const cx = 7.5 + rnd(1, 1) * 1.5 - .7, cy = 10.5 + rnd(2, 2) * 1.5, r = 3 + rnd(3, 3) * 2.2;     // row 0 is the bottom of the image
    const put = (x, y, rim) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const i = (y * 16 + x) * 4, c = rim ? [96, 8, 16] : [150, 14, 24]; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - cx, (y - cy) * 1.1), edge = r * (.7 + rnd(x, y) * .55); if (d < edge) put(x, y, d > edge * .78); }
    for (let k = 0; k < 3; k++) { const x = Math.round(cx - 2 + k * 2 + rnd(k, 9) * 1.5), len = 2 + Math.floor(rnd(k, 5) * 6); for (let j = 0; j < len; j++) put(x, Math.round(cy - r * .6) - j, j === len - 1); }
    const tex = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .2 });
  });
  const splatGeometry = new THREE.PlaneGeometry(1, 1), splats = Array.from({ length: 18 }, (_, i) => { const m = new THREE.Mesh(splatGeometry, splatMaterials[i % 3]); m.visible = false; m.name = 'Blood splat'; root.add(m); return m; });
  let splatCursor = 0;
  const _trace = { point: new THREE.Vector3(), normal: new THREE.Vector3() }, _look = new THREE.Vector3();
  function wallSplat(point, normal, size) {
    const m = splats[splatCursor++ % splats.length];
    m.material = splatMaterials[(Math.random() * 3) | 0];
    m.position.copy(point).addScaledVector(normal, .014); m.lookAt(_look.copy(point).add(normal)); m.scale.setScalar(size); m.visible = true;
  }

  // ── Character skins.
  const skins = new WeakMap(), allEntries = new Set();
  function makeEntry(canvas, texture, atlas, model) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }), w = canvas.width, h = canvas.height, img = ctx.getImageData(0, 0, w, h);
    const entry = { canvas, ctx, w, h, texture, atlas, img, base: new Uint8ClampedArray(img.data), layer: new Uint8Array(w * h * 4), box: null, wetPixels: 0, clip: -1, lastDry: time, owner: new WeakRef(model) };
    allEntries.add(entry);
    return entry;
  }
  function skinOf(model) {
    let s = skins.get(model);
    const map = model.userData.material?.map;
    if (s && (!map || s.entries[0].texture === map || s.own)) return s;
    s = { entries: [], meshes: [], own: false };
    if (map && typeof HTMLCanvasElement !== 'undefined' && map.image instanceof HTMLCanvasElement) {
      s.entries.push(makeEntry(map.image, map, atlasMapFor(model), model));
    } else {
      // Animals: their texture is shared by every one of the species, so this one gets a private copy.
      s.own = true;
      const copies = new Map();
      model.traverse(o => {
        if (!o.isMesh || !o.material?.map || o.name === 'face') return;
        let copy = copies.get(o.material);
        if (!copy) {
          const src = o.material.map, canvas = document.createElement('canvas'); canvas.width = src.image.width; canvas.height = src.image.height;
          canvas.getContext('2d').drawImage(src.image, 0, 0);
          const tex = new THREE.CanvasTexture(canvas); tex.flipY = src.flipY; tex.colorSpace = src.colorSpace; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
          const mat = o.material.clone(); mat.map = tex; if (mat.emissiveMap === src) mat.emissiveMap = tex;
          copy = { mat, entry: makeEntry(canvas, tex, null, model) }; copies.set(o.material, copy); s.entries.push(copy.entry);
        }
        o.material = copy.mat; o.userData.bloodEntry = copy.entry;
      });
    }
    s.meshes = [];
    model.traverse(o => { if (o.isMesh && o.name.endsWith(':mesh')) { s.meshes.push(o); o.userData.bloodEntry ??= s.entries[0]; } });
    skins.set(model, s);
    return s;
  }
  function paint(entry, x, y, thick, kind, { core = false, wet = 255 } = {}) {
    if (x < 0 || y < 0 || x >= entry.w || y >= entry.h) return false;
    const p = y * entry.w + x;
    if (entry.atlas) { if (entry.clip < 0 || entry.atlas.islandAt[p] !== entry.clip) return false; }
    const i = p * 4;
    if (kind === KIND.scratch) { entry.layer[i + 1] = KIND.scratch; entry.layer[i + 3] = thick; }
    else {
      if ((entry.layer[i + 1] & 15) === KIND.scratch) return false;
      entry.layer[i] = wet; entry.layer[i + 1] = kind | (core || (entry.layer[i + 1] & CORE) ? CORE : 0); entry.layer[i + 3] = Math.max(entry.layer[i + 3], thick);
      entry.wetPixels++;
    }
    const b = entry.box ||= [x, y, x, y];
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    return true;
  }
  function flush(entry) {
    const b = entry.box; if (!b) return;
    const { img, base, layer, w } = entry, px = [0, 0, 0];
    for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) {
      const i = (y * w + x) * 4;
      let c = null;
      if (layer[i + 3] > 0) { px[0] = base[i]; px[1] = base[i + 1]; px[2] = base[i + 2]; c = bodyPixel(layer[i], layer[i + 1], layer[i + 3], x, y, px); }
      if (c) { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = base[i + 3]; }
      else { img.data[i] = base[i]; img.data[i + 1] = base[i + 1]; img.data[i + 2] = base[i + 2]; img.data[i + 3] = base[i + 3]; }
    }
    entry.ctx.putImageData(img, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
    entry.texture.needsUpdate = true; entry.box = null;
  }
  /** Blood dries on the body: wetness sinks in steps; redraw only where a step changes. */
  function dryEntry(entry, dt) {
    const { layer, w, h } = entry, drop = Math.max(1, Math.round(dt * 3.4));
    let wet = 0;
    for (let i = 0; i < w * h * 4; i += 4) {
      if (layer[i + 3] === 0 || (layer[i + 1] & 15) === KIND.scratch || layer[i] === 0) continue;
      const before = layer[i] >> 6; layer[i] = Math.max(0, layer[i] - drop);
      if ((layer[i] >> 6) !== before) { const p = i / 4, x = p % w, y = (p / w) | 0, b = entry.box ||= [x, y, x, y]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
      if (layer[i] > 0) wet++;
    }
    entry.wetPixels = wet;
  }

  // Runs: blood trickling down the model, one pixel at a time, along "down" in the texture.
  const runs = [];
  function addRun(entry, x, y, dx, dy, volume, clip) {
    if (runs.length > 60) runs.shift();
    runs.push({ entry, x, y, dx, dy, vol: volume, clip, acc: 0, speed: rand(3, 7), thick: 215 });
  }
  function updateRuns(dt) {
    for (let i = runs.length - 1; i >= 0; i--) {
      const r = runs[i];
      r.acc += dt * r.speed;
      let alive = true;
      while (r.acc >= 1 && alive) {
        r.acc--; r.x += r.dx; r.y += r.dy; r.vol--; r.thick = Math.max(70, r.thick - 3);
        r.entry.clip = r.clip;
        const ok = paint(r.entry, Math.round(r.x), Math.round(r.y), r.thick, KIND.skin);
        if (!ok || r.vol <= 0) alive = false;
      }
      if (!alive) runs.splice(i, 1);
    }
  }

  // ── Wounds.
  const wounds = [];
  function addWound(actor, mesh, point, normal, region, severity, cls, blow) {
    const mine = wounds.filter(w => w.actor === actor);
    if (mine.length >= 8) wounds.splice(wounds.indexOf(mine[0]), 1);
    const w = {
      actor, anchor: mesh, local: mesh.worldToLocal(point.clone()), nLocal: normal.clone().transformDirection(_m.copy(mesh.matrixWorld).invert()),
      region, severity, bleed: region.bleed, t: 0, deadT: 0, acc: 0, pulse: rand(0, 1), blow: blow.clone(), prev: point.clone(), cls,
      clot: region.bleed === 'light' ? rand(4, 6.5) : region.bleed === 'heavy' ? rand(9, 13) : 20,
    };
    wounds.push(w);
    return w;
  }
  const wp = new THREE.Vector3(), wn = new THREE.Vector3(), wv = new THREE.Vector3();
  function updateWounds(dt) {
    for (let i = wounds.length - 1; i >= 0; i--) {
      const w = wounds[i], a = w.actor, model = a.model;
      if (!model?.parent && !model?.visible) { wounds.splice(i, 1); continue; }
      const dead = !!a.dead || (a.hp !== undefined && a.hp <= 0);
      w.t += dt; if (dead) w.deadT += dt;
      if (dead && w.deadT > w.region.after) { wounds.splice(i, 1); continue; }
      if (!dead && w.t > w.clot + 8) { wounds.splice(i, 1); continue; }
      w.anchor.updateWorldMatrix(true, false);
      wp.copy(w.local).applyMatrix4(w.anchor.matrixWorld);
      if (wp.distanceToSquared(focus) > 80 * 80) { w.prev.copy(wp); continue; }
      wv.copy(wp).sub(w.prev).multiplyScalar(1 / Math.max(dt, 1e-3)); if (wv.lengthSq() > 64) wv.setLength(8); w.prev.copy(wp);
      wn.copy(w.nLocal).transformDirection(w.anchor.matrixWorld);
      const hpFrac = a.maxHp ? Math.max(0, a.hp / a.maxHp) : 1;
      let rate = 0;
      w.loss = dead ? 0 : ({ light: .45, heavy: 1.2, artery: 2.4 }[w.bleed] || .5) * w.severity * Math.max(0, 1 - w.t / w.clot);
      if (dead) {
        const k = 1 - w.deadT / w.region.after;
        rate = (w.bleed === 'artery' ? 24 : w.bleed === 'heavy' ? 16 : 7) * w.severity * k;   // a body bleeds for half a minute, slowing, so a dragged corpse leaves a trail
      } else if (w.bleed === 'artery') {
        // A pulse every ~0.8 s: a hard jet, fading as the pressure drops.
        w.pulse += dt * (1.2 + (1 - hpFrac) * .6);
        if (w.pulse >= 1) {
          w.pulse -= 1;
          const strength = Math.max(.25, 1 - w.t / 18);
          for (let n = 0; n < 6 * strength + 3; n++) {
            _v.copy(wn).multiplyScalar(rand(2, 3.4) * strength).addScaledVector(w.blow, rand(.2, 1.2)).add(wv); _v.y += rand(.6, 1.8);
            emitDrop(wp, _v, 1, .3, 1.6, .1);
          }
        }
        rate = 6 * Math.max(0, 1 - w.t / w.clot);
      } else {
        rate = (w.bleed === 'heavy' ? 8 : 3.6) * w.severity * Math.max(0, 1 - w.t / w.clot) * (hpFrac < .4 ? 1.4 : 1);
      }
      w.acc += rate * dt;
      while (w.acc >= 1) {
        w.acc--;
        _v.copy(wn).multiplyScalar(dead ? .5 : 1.1).addScaledVector(wv, .6); _v.x += rand(-.35, .35); _v.z += rand(-.35, .35);
        _w.copy(wp); _w.x += rand(-.03, .03); _w.z += rand(-.03, .03);
        emitDrop(_w, _v, 1, .46, 1.3, .3);
      }
    }
  }

  // ── The blow.
  const ray = new THREE.Raycaster();
  const SWING = [[1, -.45], [-1, -.45], [.08, -1]];
  /**
   * A blow lands on `actor` (anything with `.model`). `from` is the attacker's eye or the arrow's origin;
   * info: { kind: 'sword'|'arrow'|'magic'|'bite', combo, amount, point? (exact hit), direction? }.
   * Returns { armoured, cls, region } so the caller can pick a sound.
   */
  function strike(actor, from, info = {}) {
    const model = actor.model; if (!model) return null;
    const kind = info.kind || 'sword', combo = info.combo ?? 0, amount = info.amount ?? 20;
    model.updateWorldMatrix(true, true);
    const skin = skinOf(model), meshes = skin.meshes;
    const base = model.getWorldPosition(new THREE.Vector3());
    if (actor.dead && actor.ragdoll?.position) { base.copy(actor.ragdoll.position()); base.y -= .45; }
    const height = actor.aim ?? (actor.kind === 'wolf' ? .9 : (1.6 * (model.scale?.y || 1)));
    const fwd = new THREE.Vector3(base.x - from.x, 0, base.z - from.z); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const target = new THREE.Vector3(), origin = new THREE.Vector3(), dir = new THREE.Vector3(), blow = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    if (info.point) target.copy(info.point);
    else {
      const y = kind === 'arrow' ? height * rand(.45, .95) : combo === 2 ? height * rand(.82, 1.08) : height * rand(.5, .92);
      target.set(base.x, base.y + y, base.z).addScaledVector(right, rand(-.14, .14));
    }
    let reach = 0;
    const castAt = tgt => { origin.copy(from); origin.y = from.y + (tgt.y - from.y) * .8; dir.copy(tgt).sub(origin); reach = dir.length(); dir.normalize(); ray.set(origin, dir); ray.far = reach + 1.5; return ray.intersectObjects(meshes, false)[0]; };
    let hit = castAt(target);
    // A shot that grazes past the body still wounds it: aim again at the middle of the torso.
    if (!hit && !info.point) { target.set(base.x, base.y + height * .6, base.z); hit = castAt(target); }
    if (info.direction) blow.copy(info.direction).normalize();
    else if (kind === 'sword') { const sw = SWING[combo % 3]; blow.set(0, 0, 0).addScaledVector(right, sw[0]).addScaledVector(up, sw[1]).normalize(); }
    else blow.copy(dir);
    const result = { armoured: false, cls: 'skin', region: REGIONS.torso, point: hit ? hit.point.clone() : target.clone() };
    const entry = hit?.object.userData.bloodEntry || skin.entries[0];
    let normal = dir.clone().negate();
    if (hit) {
      const mesh = hit.object, g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv;
      normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      result.region = mesh.name === 'shield:mesh' ? REGIONS.arm : regionOf(mesh.name);
      const W = entry.w, H = entry.h, px = Math.min(W - 1, Math.floor(hit.uv.x * W)), py = Math.min(H - 1, Math.floor(hit.uv.y * H));
      const atlas = entry.atlas, idx = py * W + px;
      let cls = atlas ? atlas.classes[atlas.classAt[idx] - 1] || 'skin' : 'skin';
      if (mesh.name === 'shield:mesh') cls = 'plate';
      if (info.armored && cls !== 'mail') cls = 'plate';   // a full suit shows no flesh anywhere: sparks and nicks, never blood
      result.cls = cls;
      if (info.dry) return result;   // only asked what it would hit (armour decides how much a blow hurts)
      const clip = atlas ? atlas.islandAt[idx] : 0;
      const f = hit.face;
      _a.fromBufferAttribute(pos, f.a).applyMatrix4(mesh.matrixWorld); _b.fromBufferAttribute(pos, f.b).applyMatrix4(mesh.matrixWorld); _c.fromBufferAttribute(pos, f.c).applyMatrix4(mesh.matrixWorld);
      const frame = uvFrame(_a.toArray(), _b.toArray(), _c.toArray(), [uv.getX(f.a) * W, uv.getY(f.a) * H], [uv.getX(f.b) * W, uv.getY(f.b) * H], [uv.getX(f.c) * W, uv.getY(f.c) * H]);
      let along = [1, 0], down = null;
      if (frame) {
        const s = pixelStep(frame, blow.toArray()), l = Math.hypot(s[0], s[1]);
        if (l > .05) along = [s[0] / l, s[1] / l];
        const d = pixelStep(frame, [0, -1, 0]), dl = Math.hypot(d[0], d[1]);
        if (dl > .3) down = [d[0] / dl, d[1] / dl];
      }
      const severity = result.region.severity * Math.min(1.6, .6 + amount / 40) * (kind === 'arrow' ? .8 : 1);
      entry.clip = clip;
      const metal = cls === 'plate' || cls === 'mail';
      if (metal) {
        // Armour: a bright nick along the blow and a shower of sparks. Mail lets a little blood through.
        result.armoured = true;
        for (const [x, y] of linePixels(px, py, Math.round(px + along[0] * 4), Math.round(py + along[1] * 4))) paint(entry, x, y, 255, KIND.scratch);
        spark(hit.point, normal, cls === 'plate' ? 4 : 2);
      }
      if (!metal || cls === 'mail') {
        const soft = cls === 'cloth' || cls === 'leather' || cls === 'mail';
        const kindPaint = soft ? KIND.cloth : KIND.skin, len = Math.round((soft ? 3 : 4) + severity * 2.2) * (metal ? .4 : 1);
        const cut = linePixels(Math.round(px - along[0] * len / 2), Math.round(py - along[1] * len / 2), Math.round(px + along[0] * len / 2), Math.round(py + along[1] * len / 2));
        for (const [x, y] of cut) {
          paint(entry, x, y, 255, kindPaint, { core: !soft });
          if (!metal) { paint(entry, x - Math.round(along[1]), y + Math.round(along[0]), 190, kindPaint); paint(entry, x + Math.round(along[1]), y - Math.round(along[0]), 150, kindPaint); }
        }
        // Spatter round the cut, and on cloth a wet halo that wicks outward.
        const dots = Math.round((soft ? 9 : 5) + severity * 3);
        for (let k = 0; k < dots; k++) paint(entry, px + Math.round(rand(-3.4, 3.4)), py + Math.round(rand(-3.4, 3.4)), rand(110, 230), kindPaint);
        // The cut follows the body: more samples along the blade's path hit other faces (arm, shoulder, ribs).
        if (!metal) {
          for (let k = -4; k <= 4; k++) {
            if (k === 0) continue;
            _v.copy(origin).addScaledVector(blow, k * .055);
            ray.set(_v, dir); ray.far = reach + 1.5;
            const h2 = ray.intersectObjects(meshes, false)[0];
            if (!h2 || h2.point.distanceTo(hit.point) > .45) continue;
            const e2 = h2.object.userData.bloodEntry || entry, W2 = e2.w, H2 = e2.h;
            const x2 = Math.min(W2 - 1, Math.floor(h2.uv.x * W2)), y2 = Math.min(H2 - 1, Math.floor(h2.uv.y * H2));
            e2.clip = e2.atlas ? e2.atlas.islandAt[y2 * W2 + x2] : 0;
            const c2 = e2.atlas ? e2.atlas.classes[e2.atlas.classAt[y2 * W2 + x2] - 1] : 'skin';
            if (c2 === 'plate' || c2 === 'mail') continue;
            paint(e2, x2, y2, 240, c2 === 'cloth' || c2 === 'leather' ? KIND.cloth : KIND.skin, { core: c2 === 'skin' || c2 === 'hair' });
            if (e2.atlas === entry.atlas) e2.clip = clip; // keep the original island for the rest
          }
        }
        // Runs down the model from the low end of the cut.
        if (down && !soft) {
          const start = cut.reduce((best, p) => (p[0] * down[0] + p[1] * down[1] > best[0] * down[0] + best[1] * down[1] ? p : best), cut[0]);
          const n = severity > 1.2 ? 3 : severity > .6 ? 2 : 1;
          for (let k = 0; k < n; k++) addRun(entry, start[0] + k - (n >> 1), start[1], down[0], down[1], Math.round(rand(5, 9) + severity * 5), clip);
        }
        addWound(actor, mesh, hit.point, normal, result.region, severity * (metal ? .35 : soft ? .75 : 1), cls, blow);
      }
      entry.clip = -1;
      skin.entries.forEach(flush);
    } else {
      result.region = height > 0 && target.y - base.y > height * .85 ? REGIONS.head : target.y - base.y < height * .4 ? REGIONS.leg : REGIONS.torso;
      if (info.armored) result.armoured = true;
    }
    // Spray: toward the attacker as the blade bites, and out the back along the blow when it is a deep one.
    if (info.dry) return result;
    if (!result.armoured && !info.quiet) {
      const severity = result.region.severity, heavy = kind === 'sword' && (combo === 2 || amount > 30);
      const spot = result.point, jet = new THREE.Vector3();
      jet.copy(normal).multiplyScalar(.7).addScaledVector(blow, .5).normalize();
      spurt(spot, jet, Math.round((10 + severity * 7) * (heavy ? 1.3 : 1)), { speed: 2.1 + severity * .5, spread: .75 });
      // Cast-off: drops thrown along the swing land in a line across the ground (the pools build the pattern).
      if (kind === 'sword') {
        jet.copy(blow).multiplyScalar(-1).addScaledVector(fwd, .6); jet.y = Math.abs(jet.y) * .5 + .2;
        spurt(spot, jet, 7 + (heavy ? 4 : 0), { speed: 3.1, spread: .3, size: 1, vol: .45 });
      }
      if (result.region.bleed === 'artery') {
        jet.copy(normal).multiplyScalar(2.2); jet.y += 2.2;
        spurt(spot, jet, 13, { speed: 3.8, spread: .25 });
      }
      pool(spot.x + normal.x * .15, spot.z + normal.z * .15, 1.2 + severity, 2);
      // A hard blow throws blood against a wall behind or beside the wounded.
      if (severity > .7 && Math.random() < .55) {
        jet.copy(blow).addScaledVector(normal, .4).normalize();
        if (traceSpellSurface(world, spot, _a.copy(spot).addScaledVector(jet, 2.8), _trace) && !_trace.ground && Math.abs(_trace.normal.y) < .5) wallSplat(_trace.point, _trace.normal, .45 + severity * .22);
      }
    }
    return result;
  }

  /** Where a ray (the crosshair) meets an actor's body, or null: { point, distance }. Dead and alive alike. */
  function pick(actor, origin, direction, far = 12) {
    const model = actor.model; if (!model) return null;
    model.updateWorldMatrix(true, true);
    ray.set(origin, direction); ray.far = far;
    const h = ray.intersectObjects(skinOf(model).meshes, false)[0];
    return h ? { point: h.point.clone(), distance: h.distance, object: h.object } : null;
  }
  /** The actor has fallen: a pool grows under the body, wounds go on bleeding by their region. */
  function killed(actor, quiet = false) {
    const model = actor.model; if (!model) return;
    const p = model.getWorldPosition(new THREE.Vector3());
    bodies.set(actor, { x: p.x, z: p.z, age: 0 });
    const mine = wounds.filter(w => w.actor === actor);
    const sev = mine.reduce((s, w) => Math.max(s, w.severity), .8);
    // A suit of plate keeps the blood in: only a little seeps out at the joints.
    if (actor.suited) { pool(p.x, p.z, 18, 3); return; }
    pool(p.x, p.z, 120 + sev * 70, 7);
    if (quiet) return;
    // A gush as the body drops.
    spurt(new THREE.Vector3(p.x, p.y + 1.1, p.z), new THREE.Vector3(0, .6, 0), 14, { speed: 2.2, spread: 1 });
    if (!mine.length && model.userData.rig) {
      // Killed by fire, an arrow, a fall: open a wound at the torso so the body still bleeds out.
      const chest = model.userData.rig.chest || model.userData.rig.torso;
      if (chest) {
        chest.updateWorldMatrix(true, false);
        addWound(actor, chest, chest.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).transformDirection(chest.matrixWorld), REGIONS.chest, 1, 'skin', new THREE.Vector3(0, -1, 0));
      }
    }
  }

  function update(dt, camera) {
    if (dt > 0) {
      time += dt; focus.copy(camera.position);
      updateDrops(dt); updateWounds(dt); updateRuns(dt); updateRunners(dt); updateBodies(dt); stepTiles(2);
      for (const e of allEntries) {
        const owner = e.owner.deref();
        if (!owner || (!owner.parent && time - e.lastDry > 30)) { allEntries.delete(e); continue; }
        if (e.box) flush(e);
        if (e.wetPixels > 0 && time - e.lastDry > .8) { dryEntry(e, time - e.lastDry); e.lastDry = time; flush(e); }
      }
    }
  }
  function reset() {
    for (const d of drops) d.life = 0;
    for (let i = 0; i < DROPS; i++) dropMesh.setMatrixAt(i, hidden);
    for (const c of clouds) c.life = 0;
    for (const t of tiles.values()) { t.mesh.visible = false; spare.push(t); }
    for (const m of splats) m.visible = false;
    tiles.clear(); wounds.length = 0; runs.length = 0; runners.length = 0; bodies.clear();
    for (const e of allEntries) { e.layer.fill(0); e.box = [0, 0, e.w - 1, e.h - 1]; e.wetPixels = 0; flush(e); }
  }
  /** Shows the pooled meshes for one shader-compile pass, then hides them again. */
  function warm(on) { for (const t of spare) t.mesh.visible = on; for (const m of splats) m.visible = on; cloudMesh.visible = true; }
  return {
    strike, killed, spurt, pool, update, reset, warm, wetAt: volumeAt, addWound, pick,
    /** One physical drop (from a blade, a fist): position and velocity in the world. */
    drop: (p, v, vol = .3) => emitDrop(p, v, 1, vol, 1.4, .2),
    /** Hit points an actor is losing to its open wounds, per second. */
    bleeding: actor => wounds.reduce((sum, w) => sum + (w.actor === actor ? w.loss || 0 : 0), 0),
    state: () => ({ drops: dropsLive, tiles: tiles.size, wounds: wounds.length, runs: runs.length, skins: allEntries.size,
      volume: +[...tiles.values()].reduce((s, t) => s + t.vol.reduce((a, b) => a + b, 0), 0).toFixed(1) }),
    debug: { tiles, wounds, runs, skinOf, getTile, addVolume },
  };
}
