import * as THREE from 'three';
import { canopiesNear } from './trees.js';

// Life in the air round the wanderer.
// - Leaves come out of real crowns (trees.js keeps them on a grid): a few at a time, more from autumn
//   trees, from the lower half of a crown near you; they flutter down, lie a while and fade.
// - Light shafts: faint, soft beams of sunlight slanting down along the sun's direction from the edges of
//   crowns, fading in and out over several seconds, golden when the sun is low, fainter at noon, none at
//   night or when the sun is down. Each is a ribbon along the light, turned to face you. (Beams from roof
//   eaves were dropped on feedback 2026-10-30: bright streaked bands across houses.)
// - Petals and pollen over meadows by day, fireflies by night.
// One instanced mesh (or small pool) per kind, a fixed budget.
const T = 1 / 16;
const LEAF_COLORS = { autumn: [0xc8521e, 0xe08a2a, 0xd8b030, 0xa83a1c, 0xb86a24], broadleaf: [0x5e8a3a, 0x7a9a3e, 0x4e7a34, 0x8aa040] };
const PETALS = [0xf2f0e6, 0xf4c8d8, 0xf6e27a, 0xe8e4f4];

// A beam in pixels: a soft core that fades smoothly to both sides (no hard edges or streaks), faded in at
// the top and out long before the foot.
function shaftTexture() {
  const w = 16, h = 64, canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const across = 1 - Math.abs((x + .5) / w * 2 - 1);
    const along = Math.min(1, y / (h * .2)) * Math.pow(1 - y / h, 1.6);
    const a = across * across * (3 - 2 * across) * along, i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}

export function createAmbientFx(scene, { heightAt, biomeWeights, waterLevel = 0 }) {
  const make = (count, material, size) => {
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size), material, count);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    mesh.frustumCulled = false; mesh.count = count; scene.add(mesh); return mesh;
  };
  const LEAVES = 60, MOTES = 90, SHAFTS = 18;
  const leaves = make(LEAVES, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 2 * T);
  const motes = make(MOTES, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 2.2 * T);
  leaves.name = 'Falling leaves'; motes.name = 'Petals and fireflies';
  // The plane hangs down from its top edge (the source) along local −y.
  const shaftMap = shaftTexture(), shaftGeometry = new THREE.PlaneGeometry(1, 1).translate(0, -.5, 0);
  const shafts = Array.from({ length: SHAFTS }, () => {
    const material = new THREE.MeshBasicMaterial({ map: shaftMap, color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(shaftGeometry, material); mesh.visible = false; mesh.frustumCulled = false; mesh.name = 'Light shaft'; scene.add(mesh);
    return { mesh, material, life: 0, max: 1, at: new THREE.Vector3(), length: 6, width: 1, peak: .25 };
  });
  const pool = n => Array.from({ length: n }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), phase: 0, rest: 0, kind: '' }));
  const L = pool(LEAVES), M = pool(MOTES);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
  const light = new THREE.Vector3(), down = new THREE.Vector3(), toCam = new THREE.Vector3(), side = new THREE.Vector3(), face = new THREE.Vector3(), basis = new THREE.Matrix4();
  let leafTimer = 0, moteTimer = 0, shaftTimer = 0, time = 0;
  const hide = (mesh, i) => { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); };
  for (let i = 0; i < LEAVES; i++) hide(leaves, i);
  for (let i = 0; i < MOTES; i++) hide(motes, i);

  function spawnLeaf(crowns) {
    const crown = crowns[Math.floor(Math.random() * crowns.length)];
    if (!crown || crown.kind === 'conifer' || (crown.kind !== 'autumn' && Math.random() < .6)) return;
    const f = L.find(o => o.life <= 0); if (!f) return;
    const a = Math.random() * Math.PI * 2, r = crown.radius * (.4 + Math.random() * .55);
    f.kind = 'leaf'; f.life = f.max = 10 + Math.random() * 6; f.rest = 0; f.phase = Math.random() * 6.3;
    f.p.set(crown.x + Math.cos(a) * r, crown.bottom + (crown.top - crown.bottom) * Math.random() * .4, crown.z + Math.sin(a) * r);
    f.v.set(0, -(.45 + Math.random() * .3), 0);
    f.spin.set((Math.random() - .5) * 5, (Math.random() - .5) * 3, (Math.random() - .5) * 5); f.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const set = LEAF_COLORS[crown.kind] || LEAF_COLORS.broadleaf;
    leaves.setColorAt(L.indexOf(f), c.setHex(set[Math.floor(Math.random() * set.length)])); leaves.instanceColor.needsUpdate = true;
  }
  function spawnMote(player, night) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 14, x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
    const w = biomeWeights(x, z), g = heightAt(x, z);
    if (g < waterLevel + .2) return;
    const meadow = Math.max(night ? .45 : .2, (w.plains || 0) + (w.forest || 0) * .4 + (w.autumn || 0) * .3) * (1 - (w.taiga || 0) * .7);
    if (Math.random() > meadow * (night ? .8 : .5)) return;
    const f = M.find(o => o.life <= 0); if (!f) return;
    f.kind = night ? 'firefly' : 'petal'; f.life = f.max = night ? 5 + Math.random() * 5 : 6 + Math.random() * 5; f.phase = Math.random() * 6.3;
    f.p.set(x, g + (night ? .4 + Math.random() * 1.6 : .3 + Math.random() * 1.8), z);
    f.v.set((Math.random() - .5) * .3, night ? 0 : .05, (Math.random() - .5) * .3);
    motes.setColorAt(M.indexOf(f), night ? c.setHex(0xc8ff6a) : c.setHex(PETALS[Math.floor(Math.random() * PETALS.length)])); motes.instanceColor.needsUpdate = true;
  }
  // A shaft from the edge of a crown. Sources in front of the camera are preferred: a beam you never see
  // is wasted.
  const ahead = new THREE.Vector3(), seen = (x, z, cam) => { if (!cam) return true; cam.getWorldDirection(ahead); const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1; return (dx * ahead.x + dz * ahead.z) / d > .25; };
  function spawnShaft(player, allCrowns, camera, groundY) {
    const f = shafts.find(o => o.life <= 0); if (!f) return;
    const crowns = allCrowns.filter(k => seen(k.x, k.z, camera));
    const crown = crowns[Math.floor(Math.random() * crowns.length)]; if (!crown) return;
    const a = Math.random() * Math.PI * 2, r = crown.radius * (.55 + Math.random() * .45);
    f.at.set(crown.x + Math.cos(a) * r, crown.bottom + (crown.top - crown.bottom) * (.35 + Math.random() * .4), crown.z + Math.sin(a) * r);
    f.width = .5 + Math.random() * 1.1; f.length = 5.5 + Math.random() * 4.5;
    if (f.at.distanceToSquared(player) > 34 * 34) return;
    // Long enough to reach the ground along the slant of the light.
    f.length = Math.max(f.length, (f.at.y - heightAt(f.at.x, f.at.z)) / Math.max(.25, Math.abs(down.y)) + .5);
    f.life = f.max = 6 + Math.random() * 4; f.peak = .07 + Math.random() * .07; f.mesh.visible = true;
  }
  /** player: Vector3; hour 0..24; camera; sun: unit vector toward the sun; wind [x, z] m/s. */
  function update(dt, player, hour, camera = null, sun = null, wind = [.6, .2]) {
    if (dt <= 0) return;
    time += dt;
    const night = hour < 5.5 || hour > 20.5;
    const crowns = canopiesNear(player.x, player.z, 24);
    const autumn = crowns.filter(k => k.kind === 'autumn').length / Math.max(1, crowns.length);
    leafTimer += dt * (crowns.length ? 1.2 + autumn * 3 : 0); while (leafTimer > 1) { leafTimer--; spawnLeaf(crowns); }
    moteTimer += dt * (night ? 10 : 6); while (moteTimer > 1) { moteTimer--; spawnMote(player, night); }
    // Shafts need a sun above the trees; a low sun gives the longest, warmest ones.
    const elevation = sun ? sun.y : -1, sunny = THREE.MathUtils.smoothstep(elevation, .06, .25), low = 1 - THREE.MathUtils.smoothstep(elevation, .25, .7);
    if (sun) { light.copy(sun).negate(); down.copy(light); }
    shaftTimer += dt * (sunny > 0 && camera ? 1.4 : 0); while (shaftTimer > 1) { shaftTimer--; spawnShaft(player, crowns, camera); }
    for (const f of shafts) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0 || !camera || !sun) { f.mesh.visible = false; f.life = 0; continue; }
      const d = Math.hypot(f.at.x - player.x, f.at.z - player.z);
      const fade = Math.sin(Math.PI * f.life / f.max) * THREE.MathUtils.smoothstep(d, 2, 7) * (1 - THREE.MathUtils.smoothstep(d, 26, 34)) * sunny;
      f.material.opacity = f.peak * fade * (.7 + .5 * low);
      f.material.color.setHex(0xfff1cc).lerp(c.setHex(0xffb25a), low * .8);
      // Ribbon along the light: local −y runs down the beam, its face turned toward the camera.
      toCam.subVectors(camera.position, f.at);
      side.crossVectors(down, toCam).normalize();
      face.crossVectors(side, down).normalize().negate();
      basis.makeBasis(side, s.copy(down).negate(), face);
      f.mesh.quaternion.setFromRotationMatrix(basis);
      f.mesh.position.copy(f.at); f.mesh.scale.set(f.width, f.length, 1);
    }
    L.forEach((f, i) => {
      if (f.life <= 0) return;
      f.life -= dt;
      if (f.rest > 0) { f.rest -= dt; if (f.rest <= 0) f.life = 0; }
      else {
        // Fluttering: a sideways swing that slows the fall at its ends, and a tumbling spin.
        const swing = Math.sin(time * 2.4 + f.phase);
        f.p.x += (wind[0] + Math.cos(time * 1.3 + f.phase) * .5) * dt + swing * .8 * dt;
        f.p.z += (wind[1] + Math.sin(time * 1.1 + f.phase) * .5) * dt;
        f.p.y += f.v.y * (.6 + .4 * Math.abs(Math.cos(time * 2.4 + f.phase))) * dt;
        f.rot.x += f.spin.x * dt; f.rot.y += f.spin.y * dt; f.rot.z += f.spin.z * dt;
        const g = heightAt(f.p.x, f.p.z) + .02;
        if (f.p.y <= g) { f.p.y = g; f.rest = 3 + Math.random() * 3; f.rot.set(-Math.PI / 2, 0, Math.random() * 6); }
      }
      if (f.p.distanceToSquared(player) > 1200 || f.life <= 0) { f.life = 0; hide(leaves, i); return; }
      const fade = Math.min(1, f.life * 2, f.rest > 0 ? f.rest : 1);
      leaves.setMatrixAt(i, m.compose(f.p, q.setFromEuler(f.rot), s.setScalar(fade)));
    });
    M.forEach((f, i) => {
      if (f.life <= 0) return;
      f.life -= dt;
      const fly = f.kind === 'firefly';
      f.p.x += (f.v.x + Math.sin(time * (fly ? 1.7 : .9) + f.phase) * (fly ? .35 : .25) + wind[0] * (fly ? .1 : .5)) * dt;
      f.p.z += (f.v.z + Math.cos(time * (fly ? 1.3 : .7) + f.phase) * (fly ? .35 : .25) + wind[1] * (fly ? .1 : .5)) * dt;
      f.p.y += Math.sin(time * (fly ? 2.1 : 1.2) + f.phase) * (fly ? .25 : .12) * dt;
      if (f.life <= 0 || f.p.distanceToSquared(player) > 400) { f.life = 0; hide(motes, i); return; }
      const glow = fly ? Math.max(0, Math.sin(time * 2.2 + f.phase * 3)) : 1;
      const k = Math.min(1, f.life, (f.max - f.life) * 2) * glow;
      motes.setMatrixAt(i, m.compose(f.p, q.setFromEuler(f.rot.set(time + f.phase, f.phase, 0)), s.setScalar(k)));
    });
    leaves.instanceMatrix.needsUpdate = true; motes.instanceMatrix.needsUpdate = true;
  }
  return { update, state: () => ({ leaves: L.filter(f => f.life > 0).length, motes: M.filter(f => f.life > 0).length, shafts: shafts.filter(f => f.life > 0).length }) };
}
