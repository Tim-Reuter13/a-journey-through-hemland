import * as THREE from 'three';
import { propClone, placePlant, plantsLoaded } from '../props.js';

// Points of interest of the wild regions: small authored places made in Blockbench (art/blockbench/models.js › pois →
// public/models/pois.gltf), each standing on ground that hemland.js SITES flattens for it. The first visit names the place
// and gives experience, the compass shows it when near, and the lore can be read at its marked spot (main.js discoverPlaces).
// Without the models (node tests) nothing is built. Footprints are [x, z, width, depth, height] in the model's pixels (16 to the unit).
const PLACES = [
  { id: 'mine', model: 'mine_headframe', scale: 2.4, rot: .6, kind: 'tower', radius: 26, xp: 25, read: [0, -4.6], solids: [[52, 2, 36, 32, 30], [-27, 35, 26, 16, 12]],
    lore: '„Die Kisten sind leer, das Seil ist gekappt, nicht gerissen. Wer die Grube aufgab, tat es in einer Nacht und nahm die Namen der Hauer mit.“' },
  { id: 'ribs', model: 'ribcage', scale: 3, rot: 2.1, kind: 'shrine', radius: 34, xp: 25, read: [0, -3.6], solids: [[0, 87, 36, 46, 34]],
    lore: '„Kein Tier, das die Alten kannten, trug solche Rippen. Der Sand schleift sie ab wie Zähne, Jahr um Jahr.“' },
  { id: 'obelisk', model: 'obelisk', scale: 2.8, rot: -.4, kind: 'shrine', radius: 24, xp: 25, read: [0, -4.4], solids: [[0, 0, 28, 28, 100]],
    lore: '„Die Schrift ist von der Sonne weggeschliffen. Nur eine Zeile blieb: Wer im Schatten wartet, wird nicht gefunden.“' },
  { id: 'caravan', model: 'caravan_camp', scale: 2.2, rot: 1.2, kind: 'camp', radius: 24, xp: 20, read: [0, -3.8], solids: [[-24, -8, 56, 60, 40], [30, -32, 30, 16, 9]],
    lore: '„Die Asche ist kalt, die Packen sind unberührt. Die Karawane zog weiter, oder sie kam nie an.“' },
  { id: 'altar', model: 'obsidian_altar', scale: 2.6, rot: .9, kind: 'shrine', radius: 24, xp: 30, read: [0, -3.6], solids: [[0, 0, 50, 34, 36]],
    lore: '„Das Glas ist warm, obwohl der Berg schläft. Jemand hält die Glut am Leben.“' },
  { id: 'burnt_hut', model: 'burned_hut', scale: 2.1, rot: -1.1, kind: 'camp', radius: 22, xp: 20, read: [0, -3.4], solids: [],
    lore: '„Die Balken sind schwarz bis ins Mark. Hier brannte es schneller, als ein Mensch laufen kann.“' },
  { id: 'circle', model: 'stone_circle', scale: 3.2, rot: .3, kind: 'shrine', radius: 36, xp: 30, read: [0, -4.1],
    solids: [...Array.from({ length: 11 }, (_, k) => k).filter(k => k !== 4).map(k => [Math.cos(k / 11 * Math.PI * 2) * 66, Math.sin(k / 11 * Math.PI * 2) * 66, 12, 9, 50]), [0, 0, 46, 28, 15]],
    lore: '„Elf Steine standen hier, zehn stehen noch. Die Heide vergisst nichts, aber sie sagt es keinem.“' },
  { id: 'peat_hut', model: 'peat_hut', scale: 2.2, rot: -.7, kind: 'camp', radius: 22, xp: 20, read: [0, -3.4], solids: [[0, 0, 62, 46, 40], [-34, -34, 54, 8, 14]],
    lore: '„Torf trocknet langsam. Der Stecher ist nicht zurückgekommen, sein Spaten steckt noch im Moor.“' },
  { id: 'jade_shrine', model: 'jade_shrine', scale: 2.6, rot: .2, kind: 'shrine', radius: 26, xp: 30, read: [0, -4.4],
    solids: [[-30, -30, 8, 8, 52], [30, -30, 8, 8, 52], [-30, 30, 8, 8, 52], [30, 30, 8, 8, 52], [0, 0, 24, 24, 14]],
    lore: '„Moos kriecht über den Stein, doch die Laternen brennen. Der Schrein wird gepflegt, aber von wem?“' },
  { id: 'hollow_log', model: 'hollow_log', scale: 2.4, rot: 1.9, kind: 'shrine', radius: 24, xp: 20, read: [0, -3.2], solids: [[0, 0, 48, 124, 32]],
    lore: '„Im hohlen Stamm brennt eine Laterne, Pilze wachsen im Kreis darum. Man sagt, wer hindurchkriecht, kommt nicht als derselbe heraus.“' },
];

export function buildWilds(ctx) {
  for (const p of PLACES) {
    const site = ctx.site(p.id), model = propClone(p.model, { solid: false });
    if (!site || !model) continue;
    const y = ctx.heightAt(site.x, site.z), g = new THREE.Group(), c = Math.cos(p.rot), s = Math.sin(p.rot);
    g.position.set(site.x, y, site.z); g.rotation.y = p.rot; g.name = `poi:${p.id}`;
    model.scale.setScalar(p.scale); g.add(model);
    for (const [x, z, w, d, h] of p.solids) {
      const f = new THREE.Object3D();
      f.position.set(x / 16 * p.scale, 0, z / 16 * p.scale);
      f.userData.solidFootprint = { width: w / 16 * p.scale * .9, depth: d / 16 * p.scale * .9, height: h / 16 * p.scale };
      f.userData.surface = 'stone';
      g.add(f);
    }
    ctx.root.add(g);
    // A ring of red toadstools round the hollow trunk.
    if (p.id === 'hollow_log' && plantsLoaded()) for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + .3, lx = Math.cos(a) * 4.6, lz = Math.sin(a) * 6.4, wx = site.x + lx * c + lz * s, wz = site.z - lx * s + lz * c;
      placePlant(ctx.root, k % 3 ? 'mushroom_red_1' : 'mushroom_red_2', wx, ctx.heightAt(wx, wz), wz, 1.1, ctx.random, ctx.heightAt);
    }
    // Reading spot: in front (-z) of everything solid, 1.6 units clear of it.
    const front = Math.max(0, ...p.solids.map(([, z, , d]) => -(z - d / 2))) / 16 * p.scale + 1.6, dist = Math.max(-p.read[1], front);
    const rx = site.x + p.read[0] * c - dist * s, rz = site.z - p.read[0] * s - dist * c;
    ctx.marker({ id: p.id, kind: p.kind, label: site.name, x: site.x, z: site.z, discover: true, radius: p.radius, xp: p.xp, lore: p.lore, read: { x: rx, z: rz }, readLabel: 'Ansehen' });
  }
  return {};
}
