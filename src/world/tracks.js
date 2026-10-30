import * as THREE from 'three';

// Tracks: whoever walks over sand, a dirt road, mud or snow leaves prints behind — boots for people, paws
// for wolves, foxes and hares, split hooves for deer. One print per step along the way the walker moves,
// left and right in turn, pressed into the ground's own colour (darker sand, dark wet sand at the water,
// brown in the road dust and mud, blue shadows in snow). Grass, rock and paving keep no prints. Old prints
// fade out (snow keeps them longest); a fixed ring of instances per kind, so the count never grows.
// A little larger than life, like everything held or worn in this style: at the game's low resolution
// a true-size print would be two pixels wide.
const KINDS = {
  boot: { size: [.3, .44], stride: .72, offset: .14 },
  paw: { size: [.22, .22], stride: .45, offset: .09 },
  hoof: { size: [.2, .22], stride: .6, offset: .12 },
};
// Print colour and how long it stays, by ground.
const GROUND = {
  sand: { color: 0x67522f, life: 90, alpha: .78 }, wetsand: { color: 0x3c3020, life: 70, alpha: .85 },
  path: { color: 0x33261a, life: 60, alpha: .7 }, mud: { color: 0x1f160f, life: 120, alpha: .8 },
  snow: { color: 0x44577c, life: 180, alpha: .85 },
};

/** A 16×16 print with soft alpha, white so the instance colour tints it. */
function printTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const dot = (x, y, a = 1) => { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x, y, 1, 1); };
  if (kind === 'boot') {
    // Sole (toe up), a gap at the arch, the heel; the edge a little fainter than the pressed middle.
    for (let y = 0; y < 10; y++) for (let x = 2; x < 14; x++) { const e = Math.hypot((x - 7.5) / 5.2, (y - 4.8) / 4.9); if (e < 1) dot(x, y, e > .8 ? .65 : 1); }
    for (let y = 10; y < 16; y++) for (let x = 3; x < 13; x++) { const e = Math.hypot((x - 7.5) / 4.2, (y - 12.6) / 3.3); if (e < 1) dot(x, y, e > .78 ? .65 : 1); }
  } else if (kind === 'paw') {
    for (let y = 7; y < 15; y++) for (let x = 3; x < 13; x++) if (Math.hypot((x - 7.5) / 4.2, (y - 10.8) / 3.6) < 1) dot(x, y);
    for (const [tx, ty] of [[3, 4], [6, 1], [10, 1], [13, 4]]) for (let y = ty; y < ty + 4; y++) for (let x = tx - 1; x < tx + 2; x++) dot(x, y, .9);
  } else {
    // Two halves of a cloven hoof.
    for (let y = 2; y < 14; y++) for (const [cx, side] of [[5.5, -1], [10.5, 1]]) for (let x = 0; x < 16; x++) {
      const e = Math.hypot((x - cx) / 3.4, (y - 8) / 7); if (e < 1 && (x - 8) * side > 0) dot(x, y, e > .8 ? .65 : 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * heightAt(x, z): the ground under a point; groundAt(x, z): 'sand' | 'wetsand' | 'path' | 'mud' | 'snow' | null.
 */
export function createTracks(scene, { heightAt, groundAt, capacity = 360 }) {
  const root = new THREE.Group(); root.name = 'tracks'; scene.add(root);
  const color = new THREE.Color(), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Quaternion(), normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
  const sets = Object.fromEntries(Object.entries(KINDS).map(([kind, def]) => {
    const count = kind === 'boot' ? capacity : Math.round(capacity / 2);
    const geometry = new THREE.PlaneGeometry(def.size[0], def.size[1]).rotateX(-Math.PI / 2);
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); fade.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('fade', fade);
    const material = new THREE.MeshLambertMaterial({ map: printTexture(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float fade;\nvarying float vFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = fade;');
      shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFade;');
    };
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `${kind} prints`; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) mesh.setColorAt(i, color.setRGB(0, 0, 0));
    root.add(mesh);
    return [kind, { def, mesh, fade, prints: Array.from({ length: count }, () => ({ age: 0, life: 0, alpha: 0 })), next: 0 }];
  }));
  const walkers = new Map();

  function place(kind, x, z, yaw, ground) {
    const set = sets[kind], g = GROUND[ground], i = set.next; set.next = (i + 1) % set.prints.length;
    const y = heightAt(x, z);
    // Lie on the slope: the ground's normal from its height a step either way.
    normal.set(heightAt(x - .3, z) - heightAt(x + .3, z), .6, heightAt(x, z - .3) - heightAt(x, z + .3)).normalize();
    turn.setFromAxisAngle(up, yaw); q.setFromUnitVectors(up, normal).multiply(turn);
    set.mesh.setMatrixAt(i, matrix.compose(pos.set(x, y + .02, z), q, scale));
    set.mesh.setColorAt(i, color.setHex(g.color));
    Object.assign(set.prints[i], { age: 0, life: g.life * (.85 + Math.random() * .3), alpha: g.alpha });
    set.mesh.count = Math.max(set.mesh.count, i + 1);
    set.mesh.instanceMatrix.needsUpdate = true; set.mesh.instanceColor.needsUpdate = true;
  }

  return {
    root,
    /**
     * Call every frame for each walker near the player. Places a print each stride along the way it
     * moves. `y` is where the feet are: off the ground (a floor, a bridge, swimming) leaves nothing.
     */
    step(id, x, y, z, kind = 'boot') {
      const def = KINDS[kind];
      let w = walkers.get(id);
      if (!w) { walkers.set(id, { x, z, run: 0, side: 1 }); return; }
      const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
      if (d > 4) { w.x = x; w.z = z; w.run = 0; return; } // a teleport, not a walk
      w.x = x; w.z = z; w.run += d;
      if (w.run < def.stride || d < 1e-4) return;
      w.run %= def.stride; w.side = -w.side;
      if (Math.abs(y - heightAt(x, z)) > .3) return;
      const ground = groundAt(x, z); if (!ground) return;
      const yaw = Math.atan2(-dx, -dz), px = Math.cos(yaw) * def.offset * w.side, pz = -Math.sin(yaw) * def.offset * w.side;
      place(kind, x + px, z + pz, yaw, ground);
    },
    /** Forget a walker (gone, dead, despawned). */
    forget(id) { walkers.delete(id); },
    update(dt) {
      for (const set of Object.values(sets)) {
        let dirty = false;
        for (let i = 0; i < set.mesh.count; i++) {
          const p = set.prints[i]; if (p.life <= 0) continue;
          p.age += dt;
          // Pressed in at once, then a slow fade over the last third of its life.
          const k = p.age >= p.life ? 0 : Math.min(1, (p.life - p.age) / (p.life / 3));
          if (k <= 0) p.life = 0;
          const value = p.alpha * k;
          if (Math.abs(set.fade.array[i] - value) > .004 || value === 0) { set.fade.array[i] = value; dirty = true; }
        }
        if (dirty) set.fade.needsUpdate = true;
      }
    },
    reset() { walkers.clear(); for (const set of Object.values(sets)) { set.mesh.count = 0; set.next = 0; for (const p of set.prints) p.life = 0; set.fade.array.fill(0); set.fade.needsUpdate = true; } },
    state: () => Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, s.prints.filter(p => p.life > 0).length])),
  };
}
