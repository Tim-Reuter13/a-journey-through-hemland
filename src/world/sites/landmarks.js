import * as THREE from 'three';
import { block, blockOn, beam } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { broadleaf } from '../flora.js';
import * as F from '../furniture.js';
import { siteGroup, pyramidRoof } from './cityBuildings.js';
import { rockModule, scree } from '../rocks.js';
import { propClone } from '../props.js';

// Points of interest between the village and the royal city (hemland.js SITES, flattened ground).
// Each is a small authored place with a story told by what lies there and by one inscription the
// player can read. main.js discovers them: they show on the compass when near, the first visit
// gives experience, and the flag poi_<id> keeps them discovered in the save.
const PI = Math.PI;
const tinted = (name, tint) => pixelMaterial(name, { tint });
const DARK = tinted('stone', 0x262422);

// A point in a site group's frame, in world coordinates.
const toWorld = (x, z, rotation, lx, lz) => ({ x: x + lx * Math.cos(rotation) + lz * Math.sin(rotation), z: z - lx * Math.sin(rotation) + lz * Math.cos(rotation) });
function landmark(ctx, id, kind, x, z, rotation, read, lore, extra = {}) {
  ctx.marker({ id, kind, label: ctx.site(id).name, x, z, discover: true, radius: extra.radius ?? 18, xp: extra.xp ?? 20, lore, read: toWorld(x, z, rotation, ...read), readLabel: extra.readLabel ?? 'Inschrift lesen' });
}
function prop(g, name, x, z, rotation = 0) {
  const p = propClone(name);
  if (p) { p.position.set(x, -.03, z); p.rotation.y = rotation; g.add(p); }
  return p;
}
// A carved stone with a dark inscription panel on its face (+z).
function inscribed(g, x, z, rotation, w = 1, h = 1.4) {
  const s = siteGroup(g, x, 0, z, rotation);
  blockOn(s, w, h, .35, 'ashlarMossy', 0, -.2, 0, 0, { solid: true });
  blockOn(s, w * .7, h * .5, .04, DARK, 0, h * .3, .18);
  for (let k = 0; k < 3; k++) blockOn(s, w * (.5 - k * .08), .05, .05, 'stoneLight', 0, h * .38 + k * .14, .2);
  return s;
}

/** Hügelgrab der Ersten: a grassed barrow in a ring of standing stones, its stone mouth sealed. */
function barrow(ctx, r) {
  const s = ctx.site('barrow'), y = ctx.heightAt(s.x, s.z), rot = .4, g = siteGroup(ctx.root, s.x, y, s.z, rot);
  // Low courses, each turned a little: from a few steps away it reads as a rounded mound.
  for (let k = 0; k < 10; k++) { const w = 15 - k * 1.3; blockOn(g, w, .6, w * .9, 'grass', 0, -.35 + k * .4, 0, k * .33, { solid: k < 4 }); }
  for (let k = 0; k < 9; k++) blockOn(g, .5, .4, .5, 'oakLeaves', Math.sin(k * 2.3) * 4.5, 1.2 + (k % 3) * .7, Math.cos(k * 2.3) * 4);
  // The mouth: a passage of slabs facing south-east, a dark stone blocking it, the lintel cracked.
  for (const sx of [-1.1, 1.1]) blockOn(g, .6, 2, 2.4, 'stone', sx, -.2, 6.4, 0, { solid: true });
  blockOn(g, 3, .55, 2.6, 'stone', 0, 1.8, 6.4); blockOn(g, .9, .6, 2.7, 'stoneLight', .7, 2.1, 6.3, .2);
  blockOn(g, 1.7, 1.9, .3, DARK, 0, -.1, 7.4, 0, { solid: true });
  for (let k = 0; k < 7; k++) blockOn(g, .25, .1, .25, tinted('clothLinen', [0xd8c060, 0xc0462e, 0xe8e0c8][k % 3]), -1 + k * .32, 0, 8.3 + (k % 2) * .3); // offerings
  F.bucket(g, 1.6, 0, 8.6, 0);
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * PI * 2 + .2, d = 11.5 + (k % 3) * .6, p = toWorld(s.x, s.z, rot, Math.sin(a) * d, Math.cos(a) * d);
    if (Math.abs(a - PI * 2) < .35 || a < .35) continue; // the way in stays open
    rockModule(ctx.root, 'boulderStanding', p.x, ctx.heightAt(p.x, p.z) - .3, p.z, a + r() * .4, 1.1 + r() * .5, r, null, false, r() < .5);
  }
  inscribed(g, 2.6, 9.4, -.3);
  landmark(ctx, 'barrow', 'shrine', s.x, s.z, rot, [2.6, 10.1],
    '„Hier schlafen die Ersten, die das Feuer über das Grauwasser trugen. Wer ihren Schlaf stört, trägt ihre Kälte heim.“');
}

/** Kapelle der Stillen Glut: a roofless chapel, its walls broken, a tree grown through the nave. */
function chapelRuin(ctx, r) {
  const s = ctx.site('chapel_ruin'), y = ctx.heightAt(s.x, s.z), rot = -.25, g = siteGroup(ctx.root, s.x, y, s.z, rot);
  const W = 7, D = 12;
  blockOn(g, W + 1, .4, D + 1, 'cobbleMossy', 0, -.3, 0);
  // Side walls in broken runs: each stretch its own height, gaps where stones fell.
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    if (sx > 0 && k === 3) continue;
    const h = [4.6, 3.8, 2.4, 3.2, 1.4, 2.8][(k + (sx > 0 ? 2 : 0)) % 6] + r() * .6;
    blockOn(g, .7, h, D / 6 + .02, 'ashlarMossy', sx * W / 2, -.1, -D / 2 + (k + .5) * D / 6, 0, { solid: true });
    if (h > 3 && r() < .6) blockOn(g, .2, 1.2, .6, 'windowDark', sx * (W / 2 + .36), 1.8, -D / 2 + (k + .5) * D / 6);
  }
  // The gable end still stands with its round window; the door end is a heap.
  blockOn(g, W + .7, 5.2, .8, 'ashlarMossy', 0, -.1, -D / 2, 0, { solid: true });
  for (let k = 0; k < 4; k++) blockOn(g, W - 1.6 - k * 1.6, .9, .8, 'ashlarMossy', 0, 5.1 + k * .9, -D / 2);
  blockOn(g, 1.4, 1.4, .1, 'windowDark', 0, 5.4, -D / 2 + .42);
  for (const sx of [-2.6, 2.6]) blockOn(g, 1.4, 1.6, .8, 'ashlarMossy', sx, -.1, D / 2, 0, { solid: true });
  for (let k = 0; k < 8; k++) { const p = toWorld(s.x, s.z, rot, (r() - .5) * 5, D / 2 + .5 + r() * 3); rockModule(ctx.root, 'boulderPair', p.x, ctx.heightAt(p.x, p.z) - .2, p.z, r() * 6, .6 + r() * .5, r); }
  for (let k = 0; k < 10; k++) blockOn(g, .5 + r() * .5, .4, .4 + r() * .3, 'ashlarMossy', (r() - .5) * 5, -.1, -2 + r() * 7, r() * 3);
  // Fallen rafters, ivy, the altar with its cold bowl, and an ash tree where the nave was.
  for (const [a, b] of [[[-3, 4.2, -3], [1.2, 0, -1]], [[3.2, 3.4, 1], [-.5, 0, 3.4]], [[-3.1, 2.2, 3.5], [0, 0, 5.2]]]) beam(g, a, b, .25, 'darkPlanks');
  for (let k = 0; k < 14; k++) blockOn(g, .45, .5 + r() * .8, .14, 'oakLeaves', (r() < .5 ? -1 : 1) * (W / 2 + .42), r() * 3, -D / 2 + r() * D);
  blockOn(g, 2.4, 1, 1.1, 'ashlar', 0, 0, -D / 2 + 1.4, 0, { solid: true });
  blockOn(g, .8, .3, .8, 'iron', 0, 1, -D / 2 + 1.4); blockOn(g, .5, .08, .5, tinted('dirt', 0x2a2420), 0, 1.3, -D / 2 + 1.4);
  for (let k = 0; k < 5; k++) blockOn(g, .12, .2 + r() * .15, .12, tinted('clothLinen', 0xe8e0c8), -1 + k * .5, 1, -D / 2 + 1.1);
  const tree = toWorld(s.x, s.z, rot, 1, 1.5); broadleaf(ctx.root, tree.x, ctx.heightAt(tree.x, tree.z), tree.z, .9, r, 'birch');
  landmark(ctx, 'chapel_ruin', 'shrine', s.x, s.z, rot, [0, -D / 2 + 2.6],
    '„Die Glut erlosch hier im Winter der Hungerjahre. Die Brüder gingen nach Kronwacht, um Brot zu erbitten. Keiner kam zurück.“',
    { readLabel: 'Altarinschrift lesen' });
}

/** Wegschrein at the fork to Hof Krähenfeld: a roofed pillar, candles, a heap of pebbles. */
function wayshrine(ctx, r) {
  const s = ctx.site('wayshrine'), y = ctx.heightAt(s.x, s.z), rot = 2.5, g = siteGroup(ctx.root, s.x, y, s.z, rot);
  blockOn(g, 1.6, .4, 1.6, 'fieldstone', 0, -.2, 0);
  blockOn(g, .8, 2, .8, 'ashlar', 0, .2, 0, 0, { solid: true });
  blockOn(g, 1, .9, .9, 'ashlar', 0, 2.2, 0); blockOn(g, .6, .55, .1, DARK, 0, 2.35, .42);
  blockOn(g, .2, .3, .1, 'brass', 0, 2.45, .44);
  { const roof = siteGroup(g, 0, 3.1, 0); pyramidRoof(roof, 1.6, 1.6, 0, .9, 'woodShingle', 3); }
  for (let k = 0; k < 4; k++) blockOn(g, .08, .18 + r() * .12, .08, tinted('clothLinen', 0xe8e0c8), -.3 + k * .2, 2.2, .3);
  for (let k = 0; k < 26; k++) { const a = r() * PI * 2, d = .6 + r() * .9; blockOn(g, .18 + r() * .12, .12, .16, ['stoneLight', 'stone', 'fieldstone'][k % 3], Math.sin(a) * d, -.05 + (d < .9 ? .1 : 0), Math.cos(a) * d + .5, r() * 3); }
  for (let k = 0; k < 3; k++) blockOn(g, .2, .2, .2, pixelMaterial(['flowerRed', 'flowerYellow', 'flowerBlue'][k]), -.5 + k * .5, .2, .95);
  prop(g, 'bench', 0, 2.6, PI) ?? F.bench(g, 0, 0, 2.6, PI);
  landmark(ctx, 'wayshrine', 'shrine', s.x, s.z, rot, [0, 1.3],
    '„Für die, die auf der Königsstraße blieben. Leg einen Stein für jeden, den du verloren hast.“', { radius: 12, xp: 10, readLabel: 'Tafel lesen' });
}

/** Köhlerlager: a smouldering charcoal clamp, the burner's hut of leaning poles, wood stacked to dry. */
function kiln(ctx, r) {
  const s = ctx.site('kiln'), y = ctx.heightAt(s.x, s.z), rot = .9, g = siteGroup(ctx.root, s.x, y, s.z, rot);
  // The clamp: a low dome of turf and ash over stacked billets, a dark vent on top.
  for (let k = 0; k < 6; k++) { const w = 6.6 - k * 1.05; blockOn(g, w, .55, w, k < 4 ? 'dirt' : 'mud', -2, -.2 + k * .42, 0, k * .45, { solid: k < 2 }); }
  for (let k = 0; k < 7; k++) { const a = k * 2.4; blockOn(g, .5, .25, .5, 'grass', -2 + Math.sin(a) * 2.2, .6 + (k % 2) * .4, Math.cos(a) * 2.2); }
  blockOn(g, .6, .2, .6, DARK, -2, 2.3, 0); blockOn(g, .3, .15, .3, tinted('clothLinen', 0xd86a2a), -2, 2.42, 0, 0, { shadow: false }); // embers in the vent
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; blockOn(g, .9, .35, .3, 'mud', -2 + Math.sin(a) * 3.4, -.1, Math.cos(a) * 3.4, a); }
  // The hut: poles leaning together, bark slabs, a sleeping place of straw.
  const hut = siteGroup(g, 4.5, 0, -2.5, -.3);
  for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; if (k === 0) continue; beam(hut, [Math.sin(a) * 1.9, -.1, Math.cos(a) * 1.9], [Math.sin(a) * .15, 3.4, Math.cos(a) * .15], .2, 'bark'); }
  for (let k = 1; k < 10; k += 2) { const a = k / 10 * PI * 2; beam(hut, [Math.sin(a) * 1.5, .6, Math.cos(a) * 1.5], [Math.sin(a) * .2, 3.1, Math.cos(a) * .2], .35, 'planksWeathered'); }
  blockOn(hut, 1.6, .25, 1, 'hay', 0, 0, -.3);
  const inside = new THREE.Object3D(); inside.userData.solidFootprint = { width: 2.6, depth: 2.6, height: 2.8 }; hut.add(inside);
  // Wood, tools, the cart that takes the charcoal to the city.
  prop(g, 'woodpile', 1.5, 3.5, .2) ?? F.firewoodStack(g, 1.5, 0, 3.5, .2);
  prop(g, 'woodpile', 3.6, 3.2, -.1);
  prop(g, 'sacks', -5.8, 3.2, .7) ?? F.grainSack(g, -5.8, 0, 3.2, .7);
  prop(g, 'handcart', -6.2, -2.8, 1.1);
  for (let k = 0; k < 6; k++) blockOn(g, .4, .3, .3, tinted('stone', 0x2a2826), -5 + (k % 3) * .45, 0, 4.2 + Math.floor(k / 3) * .35); // charcoal
  blockOn(g, .9, .1, .9, 'mud', 2.4, -.04, -.4); blockOn(g, .5, .06, .4, tinted('stone', 0x8a8580), 2.3, .05, -.3);
  for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; blockOn(g, .3, .25, .3, 'stone', 2.4 + Math.sin(a) * .6, -.05, -.4 + Math.cos(a) * .6); }
  // A note nailed to a post.
  blockOn(g, .2, 1.8, .2, 'timber', 1.2, 0, -5, 0, { solid: true }); blockOn(g, .55, .4, .03, tinted('clothLinen', 0xe8dcb8), 1.2, 1.25, -4.88);
  landmark(ctx, 'kiln', 'camp', s.x, s.z, rot, [1.2, -4.1],
    '„Meiler brennt bis zum Mondwechsel. Holz nur aus dem Krähenwald, nicht aus dem Königsforst — sonst zwei Silber Strafe. Wer den Rauch stört, kriegt meine Axt. — Bero“',
    { readLabel: 'Zettel lesen', xp: 15 });
}

/** Königsbruch: the quarry the walls of Kronwacht came out of, a treadwheel crane over the cut. */
function quarry(ctx, r) {
  const s = ctx.site('quarry'), y = ctx.heightAt(s.x, s.z), rot = -PI / 2 - .2, g = siteGroup(ctx.root, s.x, y, s.z, rot);
  // Rock faces in a horseshoe round the back of the floor, cut in steps.
  for (let k = 0; k < 9; k++) {
    const a = -PI / 2 - .3 + k / 8 * (PI + .6), d = 17, p = toWorld(s.x, s.z, rot, Math.sin(a) * d, -Math.cos(a) * d);
    rockModule(ctx.root, k % 3 === 1 ? 'cliffTall' : 'cliffWide', p.x, ctx.heightAt(p.x, p.z) - 1.2, p.z, rot + PI - a, 1.3 + r() * .4, r, null, false, r() < .5);
  }
  for (let k = 0; k < 4; k++) { const p = toWorld(s.x, s.z, rot, -9 + k * 6, -12.5); rockModule(ctx.root, 'cliffStep', p.x, ctx.heightAt(p.x, p.z) - .5, p.z, rot + PI, 1, r); }
  { const p = toWorld(s.x, s.z, rot, 6, -8); scree(ctx.root, p.x, 0, p.z, rot, 9, r, ctx.heightAt); }
  // The worked floor: gravel and stone chips in overlapping patches over the grass.
  for (let k = 0; k < 16; k++) blockOn(g, 3 + r() * 4, .08, 2.5 + r() * 3.5, k % 3 ? 'path' : 'stone', (r() - .5) * 20, -.04 + k * .002, -6 + r() * 14, r() * PI, { shadow: false });
  // Cut blocks stacked for carting, rough ones waiting for the mason.
  for (let k = 0; k < 14; k++) blockOn(g, 1.2, .7, .8, 'ashlar', -6 + (k % 4) * 1.25, Math.floor(k / 4) * .7 - .1, 4 + (Math.floor(k / 4) % 2) * .1, 0, { solid: true });
  for (let k = 0; k < 6; k++) blockOn(g, 1 + r() * .8, .6 + r() * .6, .9 + r() * .5, 'stone', 3 + (r() - .5) * 6, -.2, -3 + (r() - .5) * 4, r() * 2);
  // Treadwheel crane: an A-frame, the jib, the big wheel a man walks in, the rope and a hanging block.
  const crane = siteGroup(g, -1, 0, -4);
  for (const sx of [-1.3, 1.3]) { beam(crane, [sx, 0, -1.5], [sx * .3, 6.5, 0], .3, 'timber'); beam(crane, [sx, 0, 1.5], [sx * .3, 6.5, 0], .3, 'timber'); }
  beam(crane, [0, 6.4, 0], [0, 7.6, 5.4], .32, 'timber');
  for (const rr of [0, PI / 4]) block(crane, .5, 4.2, 4.2, 'planksWeathered', -1.6, 2.2, -.2, rr, 0, 0);
  blockOn(crane, .3, .3, .3, 'iron', -1.6, 2.05, -.2);
  beam(crane, [0, 7.5, 5.3], [0, 2.3, 5.3], .06, 'clothLinen');
  blockOn(crane, 1.1, .7, .8, 'ashlar', 0, 1.6, 5.3);
  // The masons' shelter, a sharpening stone, carts, and the plaque for the dead.
  const shelter = siteGroup(g, 8.5, 0, 3, -PI / 2);
  for (const [sx, sz] of [[-2, -1.2], [2, -1.2], [-2, 1.2], [2, 1.2]]) blockOn(shelter, .25, 2.4, .25, 'timber', sx, 0, sz, 0, { solid: true });
  block(shelter, 4.8, .2, 3.2, 'woodShingle', 0, 2.5, 0, .15, 0, 0);
  F.bench(shelter, 0, 0, .5, 0); prop(shelter, 'barrels', 1.5, -.6, .3);
  prop(g, 'handcart', -6, 7.5, .3); prop(g, 'wheelbarrow', -2.5, 7.2, 2.8); prop(g, 'crates', 4.5, 7.5, .1);
  inscribed(g, 0, 9.5, PI, 1.4, 1.2);
  landmark(ctx, 'quarry', 'camp', s.x, s.z, rot, [0, 8.9],
    '„Aus diesem Fels sind Mauer und Burg von Kronwacht geschlagen. Elf Steinbrecher liegen unter dem Westhang. Der König zahlte für jeden ein Silberstück.“',
    { radius: 24, xp: 20, readLabel: 'Gedenkstein lesen' });
}

/** Pestacker: the plague field outside the west gate, a low wall, rows of mounds, a charnel shed. */
function plagueField(ctx, r) {
  const s = ctx.site('plague_field'), y = ctx.heightAt(s.x, s.z), rot = -.15, g = siteGroup(ctx.root, s.x, y, s.z, rot), W = 24, D = 18;
  for (const [sx, sz, w, d] of [[0, -D / 2, W, .6], [-W / 2, 0, .6, D], [W / 2, 0, .6, D], [-7, D / 2, W / 2 - 2, .6], [7, D / 2, W / 2 - 2, .6]])
    blockOn(g, w, .9 + r() * .2, d, 'fieldstone', sx, -.2, sz, 0, { solid: true });
  for (const sx of [-2.1, 2.1]) blockOn(g, .7, 1.8, .7, 'fieldstone', sx, -.2, D / 2);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) {
    if (r() < .12) continue;
    const x = -9 + k * 2.2 + (r() - .5) * .3, z = -6 + row * 3.4 + (r() - .5) * .4;
    blockOn(g, 1, .3, 1.9, r() < .3 ? 'mud' : 'dirt', x, -.15, z, (r() - .5) * .1);
    if (r() < .55) { const c = siteGroup(g, x, 0, z - 1.1, (r() - .5) * .3); c.rotation.z = (r() - .5) * .25; blockOn(c, .12, 1.1, .12, 'darkPlanks', 0, 0, 0); blockOn(c, .6, .1, .1, 'darkPlanks', 0, .75, 0); }
    else if (r() < .2) blockOn(g, .5, .7, .2, 'stoneLight', x, -.1, z - 1.1);
  }
  // A great stone cross for all of them, the charnel shed, a dead oak, a spade left in fresh earth.
  blockOn(g, 1.2, .5, 1.2, 'ashlar', 0, -.2, 7.2); blockOn(g, .35, 3, .35, 'stoneLight', 0, .3, 7.2, 0, { solid: true }); blockOn(g, 1.6, .35, .35, 'stoneLight', 0, 2.4, 7.2);
  const shed = siteGroup(g, -9, 0, -6.6);
  blockOn(shed, 3.4, 2.4, 2.6, 'fieldstone', 0, -.1, 0, 0, { solid: true }); block(shed, 3.9, .25, 3.2, 'woodShingle', 0, 2.5, 0, .1, 0, 0);
  blockOn(shed, 1, 1.7, .05, 'darkPlanks', .6, 0, 1.31);
  for (const [a, b] of [[[8.5, 0, -6], [8.6, 4.2, -6.2]], [[8.6, 3, -6.1], [10, 4.4, -5]], [[8.6, 3.6, -6.2], [7.4, 5, -7]], [[8.6, 2.4, -6], [7.6, 3.2, -4.8]]]) beam(g, a, b, .3, 'bark');
  blockOn(g, 1, .35, 1.9, 'mud', 7, -.1, 4); beam(g, [7.6, 0, 3.4], [7.9, 1.3, 3.2], .08, 'timber'); blockOn(g, .3, .3, .05, 'iron', 7.6, 0, 3.35);
  inscribed(g, -3.6, D / 2 + .9, 0, 1.1, 1.3);
  landmark(ctx, 'plague_field', 'shrine', s.x, s.z, rot, [-3.6, D / 2 + 1.6],
    '„Im Jahr der Schwarzen Ernte. Ohne Namen, ohne Glocke, ohne Zahl. Die Stadt hielt das Tor geschlossen.“', { xp: 20, readLabel: 'Torstein lesen' });
}

export function buildLandmarks(ctx) {
  const r = ctx.random;
  barrow(ctx, r); chapelRuin(ctx, r); wayshrine(ctx, r); kiln(ctx, r); quarry(ctx, r); plagueField(ctx, r);
  return {};
}
