import * as THREE from 'three';

// Imprints: whoever walks over sand, a dirt road, mud or snow presses prints into it — square-cut boots for people,
// shod hooves for horses, bare clawed feet for goblins, paws for wolves, foxes and hares, split hooves for deer.
// Each print is a small depth map: the pressed shape, its walls and a lip of pushed-up soil round it, lit by the
// sun through a normal map so it reads as pressed in, not painted on. How deep depends on the ground (mud and snow
// take a print deepest, road dust least) and the weight (a horse sinks in further than a goblin). Old prints
// soften (snow fills them, wind smooths sand) and fade; mud keeps them longest. One ring of instances per kind.
// Prints follow the stride of the walker, or the real hoof when its animator says one came down (stamp()).
// A little larger than life, like everything held or worn in this style.
const KINDS = {
  boot: { size: [.3, .44], stride: .72, offset: .14 },
  horseshoe: { size: [.36, .38], stride: 1, offset: .2 },
  goblin: { size: [.22, .32], stride: .52, offset: .1 },
  paw: { size: [.22, .22], stride: .45, offset: .09 },
  hoof: { size: [.2, .22], stride: .6, offset: .12 },
};
// The lip colour per ground (the pressed floor of a print is darker), how long it stays, how deep it goes.
const GROUND = {
  sand: { color: 0xb0956a, life: 80, alpha: .9, depth: .8, settle: .5 }, wetsand: { color: 0x7a6446, life: 70, alpha: .95, depth: .95, settle: .3 },
  path: { color: 0x7a5d40, life: 60, alpha: .85, depth: .55, settle: .4 }, mud: { color: 0x4f3a28, life: 150, alpha: .95, depth: 1.25, settle: .15 },
  snow: { color: 0xe4eaf2, life: 200, alpha: .95, depth: 1.35, settle: .7 },
};
const WEIGHT = { boot: 1, horseshoe: 1.35, goblin: .65, paw: .7, hoof: .9 };

/** The depth of each texel of a print (16×16, canvas rows top = toe end): 1 deepest, 0 untouched. */
function printDepth(kind) {
  const d = new Float32Array(256), set = (x, y, v) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) d[y * 16 + x] = Math.max(d[y * 16 + x], v); };
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
  if (kind === 'boot') {
    // A square-toed sole with tread, the arch barely touching, a square heel.
    rect(4, 1, 11, 8, 1); for (let y = 2; y < 8; y += 2) rect(5, y, 10, y, .78);
    rect(5, 9, 10, 10, .25); rect(5, 11, 10, 14, 1); rect(6, 12, 9, 12, .82);
  } else if (kind === 'horseshoe') {
    // The iron shoe bites deepest in a U open at the heels; the hoof wall and sole inside it less; the frog a V.
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const e = Math.hypot((x - 7.5) / 6.3, (y - 7.8) / 6.7);
      if (e < 1) set(x, y, e > .68 && y < 13 ? 1 : .5);
    }
    for (let y = 7; y < 14; y++) { const w = (y - 7) * .45; for (let x = Math.round(7.5 - w); x <= Math.round(7.5 + w); x++) set(x, y, .72); }
    for (const x of [3, 12]) set(x, 6, .3);
  } else if (kind === 'goblin') {
    // A narrow bare heel and ball, three long toes ending in claw marks.
    for (let y = 6; y < 15; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 7.5) / 3.6, (y - 10.5) / 4.4) < 1) set(x, y, .9);
    for (const [tx, lean] of [[5, -1], [8, 0], [11, 1]]) for (let k = 0; k < 4; k++) { set(tx + Math.round(lean * k * .4), 5 - k, .85); }
    for (const [tx, lean] of [[5, -1], [8, 0], [11, 1]]) set(tx + Math.round(lean * 1.8), 0, 1);
  } else if (kind === 'paw') {
    for (let y = 7; y < 15; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 7.5) / 4.2, (y - 10.8) / 3.6) < 1) set(x, y, 1);
    for (const [tx, ty] of [[3, 4], [6, 1], [10, 1], [13, 4]]) rect(tx - 1, ty, tx + 1, ty + 3, .9);
  } else {
    // Two halves of a cloven hoof.
    for (let y = 2; y < 14; y++) for (const [cx, side] of [[5.5, -1], [10.5, 1]]) for (let x = 0; x < 16; x++) {
      const e = Math.hypot((x - cx) / 3.4, (y - 8) / 7); if (e < 1 && (x - 8) * side > 0) set(x, y, e > .8 ? .7 : 1);
    }
  }
  // The lip: soil pushed up round the print.
  const lip = new Float32Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (d[y * 16 + x] > .1) continue;
    let near = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && xx < 16 && yy >= 0 && yy < 16 && d[yy * 16 + xx] > .5) near++; }
    if (near) lip[y * 16 + x] = Math.min(1, near / 3);
  }
  return { d, lip };
}

/** Colour (white, tinted by the instance's lip colour: the floor darker) and a tangent-space normal map. */
function printTextures(kind) {
  const { d, lip } = printDepth(kind), at = (x, y) => x < 0 || x > 15 || y < 0 || y > 15 ? 0 : d[y * 16 + x] - lip[y * 16 + x] * .35;
  const color = document.createElement('canvas'), normal = document.createElement('canvas');
  color.width = color.height = normal.width = normal.height = 16;
  const ci = color.getContext('2d').createImageData(16, 16), ni = normal.getContext('2d').createImageData(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4, depth = d[y * 16 + x], rim = lip[y * 16 + x];
    const value = depth > .05 ? 1 - .42 * depth : 1;
    ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = Math.round(255 * value);
    ci.data[i + 3] = depth > .05 ? 255 : rim > 0 ? Math.round(150 * rim) : 0;
    // Height is minus depth: the normal leans out of the pit walls and off the lip.
    const nx = (at(x + 1, y) - at(x - 1, y)) * 1.6, ny = (at(x, y - 1) - at(x, y + 1)) * 1.6, l = Math.hypot(nx, ny, 1);
    ni.data[i] = Math.round((nx / l * .5 + .5) * 255); ni.data[i + 1] = Math.round((ny / l * .5 + .5) * 255); ni.data[i + 2] = Math.round((1 / l * .5 + .5) * 255); ni.data[i + 3] = 255;
  }
  color.getContext('2d').putImageData(ci, 0, 0); normal.getContext('2d').putImageData(ni, 0, 0);
  const tex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(color, true), normalMap: tex(normal, false) };
}

/**
 * heightAt(x, z): the ground under a point; groundAt(x, z): 'sand' | 'wetsand' | 'path' | 'mud' | 'snow' | null.
 * Floors that are not the terrain (cave floors) pass their own ground kind and height to step() and stamp().
 */
const BLOOD_PRINT = new THREE.Color(0x6e0a14);
export function createTracks(scene, { heightAt, groundAt, capacity = 360, bloodAt = null }) {
  const root = new THREE.Group(); root.name = 'tracks'; scene.add(root);
  const color = new THREE.Color(), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
  const sets = Object.fromEntries(Object.entries(KINDS).map(([kind, def]) => {
    const count = kind === 'boot' ? capacity : Math.round(capacity / 2);
    const geometry = new THREE.PlaneGeometry(def.size[0], def.size[1]).rotateX(-Math.PI / 2);
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(count), 1), depth = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    fade.setUsage(THREE.DynamicDrawUsage); depth.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('fade', fade); geometry.setAttribute('depth', depth);
    const { map, normalMap } = printTextures(kind);
    const material = new THREE.MeshLambertMaterial({ map, normalMap, normalScale: new THREE.Vector2(1, 1), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float fade;\nattribute float depth;\nvarying float vFade;\nvarying float vDepth;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = fade; vDepth = depth;');
      shader.fragmentShader = 'varying float vFade;\nvarying float vDepth;\n' + shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFade;')
        .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vDepth;');
    };
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `${kind} prints`; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.count = 0; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) mesh.setColorAt(i, color.setRGB(0, 0, 0));
    root.add(mesh);
    return [kind, { def, mesh, fade, depth, prints: Array.from({ length: count }, () => ({ age: 0, life: 0, alpha: 0, depth: 0, settle: 0 })), next: 0 }];
  }));
  const walkers = new Map();

  function place(kind, x, z, yaw, ground, weight = 1, y = null, stain = 0) {
    const set = sets[kind], g = GROUND[ground], i = set.next; set.next = (i + 1) % set.prints.length;
    const gy = y ?? heightAt(x, z);
    // Lie on the slope: the ground's normal from its height a step either way (flat on a cave floor).
    if (y === null) normal.set(heightAt(x - .3, z) - heightAt(x + .3, z), .6, heightAt(x, z - .3) - heightAt(x, z + .3)).normalize(); else normal.copy(up);
    turn.setFromAxisAngle(up, yaw); q.setFromUnitVectors(up, normal).multiply(turn);
    set.mesh.setMatrixAt(i, matrix.compose(pos.set(x, gy + .02, z), q, scale));
    color.setHex(g.color); if (stain > .05) color.lerp(BLOOD_PRINT, Math.min(1, stain * 1.3));   // feet that stood in blood print it, fainter with every step
    set.mesh.setColorAt(i, color);
    Object.assign(set.prints[i], { age: 0, life: g.life * (.85 + Math.random() * .3) * (stain > .05 ? 1.8 : 1), alpha: stain > .05 ? Math.max(g.alpha, .35 + stain * .5) : g.alpha, depth: g.depth * weight * (WEIGHT[kind] ?? 1), settle: g.settle });
    set.mesh.count = Math.max(set.mesh.count, i + 1);
    set.mesh.instanceMatrix.needsUpdate = true; set.mesh.instanceColor.needsUpdate = true;
  }

  return {
    root,
    /**
     * Call every frame for each walker near the player. Places a print each stride along the way it
     * moves. `y` is where the feet are: off the ground (a floor, a bridge, swimming) leaves nothing.
     */
    step(id, x, y, z, kind = 'boot', weight = 1, floor = null) {
      const def = KINDS[kind];
      let w = walkers.get(id);
      if (!w) { walkers.set(id, { x, z, run: 0, side: 1 }); return; }
      const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
      if (d > 4) { w.x = x; w.z = z; w.run = 0; return; } // a teleport, not a walk
      w.x = x; w.z = z; w.run += d;
      if (w.run < def.stride || d < 1e-4) return;
      w.run %= def.stride; w.side = -w.side;
      if (!floor && Math.abs(y - heightAt(x, z)) > .3) return;
      if (bloodAt && bloodAt(x, z) > .25) w.stain = 1;
      const ground = floor || groundAt(x, z) || ((w.stain || 0) > .12 ? 'mud' : null); if (!ground) return;
      const yaw = Math.atan2(-dx, -dz), px = Math.cos(yaw) * def.offset * w.side, pz = -Math.sin(yaw) * def.offset * w.side;
      place(kind, x + px, z + pz, yaw, ground, weight, floor ? y : null, w.stain || 0);
      w.stain = (w.stain || 0) * .82;
    },
    /** A print exactly where a foot or hoof came down (an animator's footfall), facing yaw. */
    stamp(x, z, yaw, kind = 'horseshoe', weight = 1, y = null, floor = null) {
      if (!floor && y !== null && Math.abs(y - heightAt(x, z)) > .4) return;
      const ground = floor || groundAt(x, z); if (!ground) return;
      place(kind, x, z, yaw, ground, weight, floor ? y : null);
    },
    /** Forget a walker (gone, dead, despawned). */
    forget(id) { walkers.delete(id); },
    update(dt) {
      for (const set of Object.values(sets)) {
        let dirty = false;
        for (let i = 0; i < set.mesh.count; i++) {
          const p = set.prints[i]; if (p.life <= 0) continue;
          p.age += dt;
          // Pressed in at once; then it softens (snow fills, sand runs in) and fades over the last third of its life.
          const k = p.age >= p.life ? 0 : Math.min(1, (p.life - p.age) / (p.life / 3));
          if (k <= 0) p.life = 0;
          const value = p.alpha * k, deep = p.depth * (1 - p.settle * Math.min(1, p.age / p.life));
          if (Math.abs(set.fade.array[i] - value) > .004 || value === 0) { set.fade.array[i] = value; set.depth.array[i] = deep; dirty = true; }
        }
        if (dirty) { set.fade.needsUpdate = true; set.depth.needsUpdate = true; }
      }
    },
    reset() { walkers.clear(); for (const set of Object.values(sets)) { set.mesh.count = 0; set.next = 0; for (const p of set.prints) p.life = 0; set.fade.array.fill(0); set.fade.needsUpdate = true; } },
    state: () => Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, s.prints.filter(p => p.life > 0).length])),
  };
}
