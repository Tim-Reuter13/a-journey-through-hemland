import * as THREE from 'three';
import { biomeWeights } from './hemland.js';

// Small life that is only ever near the wanderer: flocks of birds wheeling high overhead by day, and
// butterflies tumbling over the meadows. Both are a fixed handful of blocky meshes that follow the
// player round the land, so they cost nothing to stream; birds roost at night, butterflies keep off
// the taiga and the snow.
const TAU = Math.PI * 2;

function bird(material) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(.12, .1, .34), material));
  const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.x = side * .05;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(.42, .025, .16), material); wing.position.x = side * .21;
    pivot.add(wing); g.add(pivot); return pivot;
  });
  return { g, wings };
}

function butterflyMaterial(colors) {
  // A 4×4-texel wing: the colour with a dark rim and a pale spot.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { ctx.fillStyle = x === 3 || y === 3 ? colors[1] : x === 1 && y === 1 ? colors[2] : colors[0]; ctx.fillRect(x, y, 1, 1); }
  const map = new THREE.CanvasTexture(canvas); map.magFilter = map.minFilter = THREE.NearestFilter; map.colorSpace = THREE.SRGBColorSpace; map.generateMipmaps = false;
  return new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .25 });
}

export function createCritters(scene, heightAt, random = Math.random) {
  if (typeof document === 'undefined') return { update() {} };
  const root = new THREE.Group(); root.name = 'Birds and butterflies'; scene.add(root);
  const birdMaterial = new THREE.MeshLambertMaterial({ color: 0x24232a });
  const flocks = Array.from({ length: 3 }, (_, f) => ({
    centre: new THREE.Vector3(), radius: 18 + f * 9, height: 26 + f * 7, speed: (.12 + f * .03) * (f % 2 ? -1 : 1), angle: random() * TAU,
    birds: Array.from({ length: 5 + f }, (_, k) => { const b = bird(birdMaterial); root.add(b.g); return { ...b, offset: new THREE.Vector3((random() - .5) * 6, (random() - .5) * 2.5, (random() - .5) * 6), phase: random() * TAU }; }),
  }));
  const palettes = [['#d8862a', '#2a1a10', '#f0d8a0'], ['#e8e4d8', '#4a4a44', '#f8f4ea'], ['#4a78c8', '#1a2a4a', '#a8c8f0'], ['#e0c840', '#3a3010', '#f8f0b0'], ['#b84a6a', '#2a1018', '#f0c0d0']];
  const wingGeometry = new THREE.PlaneGeometry(.13, .11);
  const butterflies = Array.from({ length: 14 }, (_, i) => {
    const material = butterflyMaterial(palettes[i % palettes.length]), g = new THREE.Group();
    const wings = [-1, 1].map(side => { const pivot = new THREE.Group(); const w = new THREE.Mesh(wingGeometry, material); w.position.x = side * .065; w.rotation.x = -Math.PI / 2; pivot.add(w); g.add(pivot); return pivot; });
    root.add(g);
    return { g, wings, target: new THREE.Vector3(), velocity: new THREE.Vector3(), phase: random() * TAU, home: false };
  });
  const to = new THREE.Vector3();
  let time = 0;
  function place(b, focus) {
    // A spot in the open somewhere round the wanderer, low over the grass.
    for (let tries = 0; tries < 6; tries++) {
      const a = random() * TAU, r = 4 + random() * 16, x = focus.x + Math.cos(a) * r, z = focus.z + Math.sin(a) * r, w = biomeWeights(x, z);
      if (w.taiga > .5 || heightAt(x, z) > 44) continue;
      b.target.set(x, heightAt(x, z) + .5 + random() * 1.1, z); return true;
    }
    return false;
  }
  return {
    update(dt, hour, focus) {
      time += dt;
      const day = hour > 6 && hour < 20;
      root.visible = day;
      if (!day) return;
      for (const f of flocks) {
        // The flock's centre trails the wanderer; it wheels round it in a wide circle.
        if (f.centre.distanceTo(focus) > 80 || !f.centre.lengthSq()) f.centre.set(focus.x + (random() - .5) * 40, 0, focus.z + (random() - .5) * 40);
        f.centre.lerp(to.set(focus.x, 0, focus.z), 1 - Math.exp(-dt * .05));
        f.angle += f.speed * dt;
        const cx = f.centre.x + Math.cos(f.angle) * f.radius, cz = f.centre.z + Math.sin(f.angle) * f.radius, cy = heightAt(f.centre.x, f.centre.z) + f.height;
        // Facing along the circle, the way the flock turns.
        const sign = Math.sign(f.speed), tx = -Math.sin(f.angle) * sign, tz = Math.cos(f.angle) * sign, facing = Math.atan2(-tx, -tz);
        for (const b of f.birds) {
          const bob = Math.sin(time * 1.3 + b.phase) * .6;
          b.g.position.set(cx + b.offset.x, cy + b.offset.y + bob, cz + b.offset.z);
          b.g.rotation.set(0, facing, Math.sin(time * .8 + b.phase) * .15);
          // Flap, glide, flap: every bird beats its wings in short bursts.
          const flap = Math.sin(time * 9 + b.phase) * (Math.sin(time * .9 + b.phase * 3) > -.2 ? .55 : .08);
          b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
        }
      }
      for (const b of butterflies) {
        if (!b.home || b.g.position.distanceTo(focus) > 28) { b.home = place(b, focus); b.g.position.copy(b.target); b.g.visible = b.home; continue; }
        if (b.g.position.distanceTo(b.target) < .4 || random() < dt * .25) place(b, focus.distanceTo(b.g.position) > 20 ? focus : b.g.position);
        // Tumbling flight: steer toward the target with a wobble.
        to.subVectors(b.target, b.g.position).normalize().multiplyScalar(1.1);
        to.x += Math.sin(time * 5 + b.phase) * .8; to.y += Math.sin(time * 7 + b.phase * 2) * .9; to.z += Math.cos(time * 4.3 + b.phase) * .8;
        b.velocity.lerp(to, 1 - Math.exp(-dt * 3));
        b.g.position.addScaledVector(b.velocity, dt);
        b.g.position.y = Math.max(b.g.position.y, heightAt(b.g.position.x, b.g.position.z) + .25);
        b.g.rotation.y = Math.atan2(-b.velocity.x, -b.velocity.z);
        const flap = .2 + Math.abs(Math.sin(time * 16 + b.phase)) * 1.2;
        b.wings[0].rotation.z = -flap; b.wings[1].rotation.z = flap;
      }
    },
  };
}
