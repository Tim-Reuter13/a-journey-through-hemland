import { block, blockOn, beam } from '../../art/blocks.js';
import * as THREE from 'three';
import { arch, curtain, frame, painting, pennon, ruinTower, standing } from '../bruchwachtArt.js';
import { makeLantern } from '../buildings.js';
import { propClone } from '../props.js';
import { ZOLL_POSTERN } from '../../data/hemland/zollkeller.js';
import * as F from '../furniture.js';

// BRUCHWACHT — the old customs fort on the Sackträgersteig, read from the road as it was lived: the two gate towers frame it;
// the north tower, torn open by the landslip, stands higher and ragged out of the slope over its own fallen masonry; the
// bridge between the gate towers lost its middle bays and hangs broken over rubble (nobody crosses it, and it shows why).
// The band that made the ward usable again cooks against the sheltered north wall, dries its washing, keeps its stores under
// a tarp and walks a trodden path past the guard to the old guardroom, a roofless ruin over the cellar stairs: an old
// barricade pulled aside, new boards nailed up, a lantern at the top of the steps. Down the steps lies the Zollkeller
// (data/hemland/zollkeller.js, entered like the goblin caves). Its supply passage comes up behind a low door in the north
// curtain, barred from inside. Nothing of the cellar stands above the hill.
const PI = Math.PI;
const put = (root, name, x, y, z, ry = 0, scale = 1) => { const p = propClone(name, { solid: true }); if (!p) return null; p.position.set(x, y, z); p.rotation.y = ry; p.scale.setScalar(scale); root.add(p); return p; };

function court(ctx) {
  const { root, heightAt } = ctx, y = heightAt(-330, 150);
  const wall = (ax, az, bx, bz, heights) => curtain(root, ax, az, bx, bz, heights, y);
  wall(-312, 133, -312, 146, [5, 4.7, 5.2, 5.8]);
  wall(-312, 154, -312, 168, [6.2, 4.6, 3.4, 3.1, 2.8]);
  wall(-312, 133, -348, 130, [5.6, 4.8, 3.3, 2.1, 1.8, 2.2, 3.8, 4.6, 5.3]);
  // The south flank slumped: a fallen run of curtain with its rubble at the foot (the way round behind the fire).
  wall(-312, 168, -348, 170, [3.1, 3.6, 2.5, .8, .55, 1.1, 3.1, 4.7, 4.1]);
  for (const [x, z, s] of [[-326.5, 171.6, 1.1], [-329, 172.4, .8], [-324.5, 172.6, .7], [-327.6, 168.1, .6]]) put(root, 'rubble_pile', x, heightAt(x, z) - .05, z, x * .7, s);
  // The west curtain ends in rubble on both sides of the old guardroom's door.
  wall(-348, 130, -348, 146.6, [3.6, 2.3, 1.3, 1.3, 2.4, 3.6]);
  wall(-348, 153.4, -348, 170, [3.6, 3.4, 2.2, 1.7, 2.1, 4]);
  ruinTower(root, -312, y, 142.7, 11.7, [0, .5, 1.4, 2.3, 2.4, 1.5, 0, 0]);
  ruinTower(root, -311.8, y, 157.5, 8.2, [1, 2.9, 3.4, 3.7, 2.2, .6, 0, 0]);
  // The north tower: the landmark. Taller and more broken than the gate towers, its downhill corner washed out, the foundation
  // sunk on that side (a tilted footing course), its own stones heaped at the foot.
  ruinTower(root, -343, y - .4, 132.2, 15.8, [0, 0, 2.6, 4.6, 7.4, 6.1, 3, 1.1]);
  block(root, 7.6, .9, 2.2, 'ashlarMossy', -343.6, y - .2, 128.4, -.09, .12, .05, standing);
  for (const [x, z, s, r] of [[-346.8, 127.4, 1.25, .4], [-340.2, 126.9, 1, 1.9], [-348.4, 131.5, .9, 3.1], [-338.6, 129.2, .8, 2.4]]) put(root, 'rubble_pile', x, heightAt(x, z) - .1, z, r, s);
  for (const [x, z, w] of [[-345.2, 126.2, 1.4], [-341.1, 125.6, 1.1], [-347.9, 128.7, .9]]) block(root, w, w * .7, w * .9, 'ashlar', x, heightAt(x, z) + w * .2, z, .3, x, .2, standing);
  arch(root, -311.8, y, 150, PI / 2, 6.3, 3.65);
  // The hoarding between the gate towers. Its middle bays are gone: the floor ends in torn planks on both sides, one joist hangs
  // down into the gap, the bearer it sat on is ripped out of the masonry, and what fell lies under it in the gate.
  const gallery = frame(root, -311.8, y, 150, PI / 2);
  for (const x of [-3.75, 3.75]) blockOn(gallery, 3.1, .48, 2.45, 'darkPlanks', x, 6.92, 0, 0, standing);
  block(gallery, 2.6, .3, .35, 'planksWeathered', -1.6, 6.75, .7, 0, .1, -.55);
  block(gallery, 2.2, .24, .3, 'darkPlanks', 1.4, 6.5, -.6, .1, -.15, .7);
  beam(gallery, [-2.2, 7.1, .99], [-.4, 5.6, 1.1], .2, 'timber');
  for (const x of [-4.5, -2.3, 2.3, 4.5]) {
    blockOn(gallery, .19, 2.05, .19, 'timber', x, 7.37, .99);
    blockOn(gallery, .19, 2.05, .19, 'timber', x, 7.37, -.99);
    beam(gallery, [x, 6.95, 1.08], [x, 6.15, .05], .22, 'timber');
  }
  for (const x of [-3.45, 3.45]) {
    blockOn(gallery, 2.15, .75, .15, 'planksWeathered', x, 7.38, 1.02);
    blockOn(gallery, 2.15, .75, .15, 'darkPlanks', x, 7.38, -1.02);
  }
  block(gallery, 3.4, .17, 1.94, 'woodShingle', -3.6, 9.37, .78, .28);
  block(gallery, 3.4, .17, 1.94, 'slate', 3.6, 9.37, -.78, -.28);
  // The torn-out bearer: a dark socket in the pier and its stone lying below.
  blockOn(gallery, .8, .6, 1.2, 'ashlar', 0, 6.1, 0, .4);
  put(gallery, 'bridge_stub', -1.9, 0, .4, .5); put(gallery, 'rubble_pile', .8, 0, -1.1, 2.2, .9);
  for (const x of [-4.1, 3.75]) painting(gallery, 'brueckenbanner', 1.62, 3.24, x, 6.43, 1.19);
  // Plank floors in the towers cut off the old arrow slits; each storey reads from the road.
  for (const [x, z, h] of [[-312, 142.7, 8.1], [-311.8, 157.5, 5.1]]) blockOn(root, 6.4, .38, 6.4, 'darkPlanks', x, y + h, z);
  pennon(root, -309.9, y, 145.65, PI / 2, 1.26);
  pennon(root, -309.9, y, 154.3, PI / 2, .97);
  makeLantern(root, heightAt, -315.3, 147.2);
  // Washing, leatherwork and a loom against the south wall; the cooking fire close in under the sheltered north wall.
  const yard = frame(root, -333, y, 163);
  for (const x of [-4, 4]) blockOn(yard, .18, 3, .18, 'timber', x, 0, 0, 0, standing);
  for (const side of [-1, 1]) beam(yard, [0, 2.4, 0], [side * 4, 2.85, 0], .055, 'bark');
  for (let i = 0; i < 6; i++) {
    const x = -3.2 + i * 1.22, h = [.89, 1.2, .7, .65, 1, .82][i];
    block(yard, .63 + (i % 2) * .22, h, .05, ['clothLinen', 'clothRed', 'clothBlue'][i % 3], x, 2.42 + Math.abs(x) * .1 - h * .5, 0, .065, i * .08);
  }
  F.workbench(yard, 3.5, 0, -1.6, -.4); F.bucket(yard, -2.3, 0, .4);
  F.loom(yard, -3.2, 0, 1.35); F.firewoodStack(yard, 1.3, 0, 1);
  const cook = frame(root, -323, y, 134.6, .14);
  F.cauldron(cook, 0, 0, 0); F.grainSack(cook, 1, 0, .6); F.table(cook, -2.3, 0, 0);
  F.bread(cook, -2.65, 1.1, 0); F.bowl(cook, -1.96, 1.1, .17);
  // Stores under a tarp, newer than anything round them; drag marks lead from them toward the guardroom.
  put(root, 'tarp_stores', -341.5, y, 164.2, -.2); put(root, 'crate_stack', -339.2, y, 166.1, .5); put(root, 'barrel_group', -344.2, y, 166.4, 1.2);
  F.weaponRack(root, -321, y, 162, .25); F.armourStand(root, -318, y, 162.7, -.22);
  ctx.marker({ id: 'bruchwacht', kind: 'tower', label: 'Bruchwacht · Westlager', x: -320, z: 150, discover: true, radius: 23, xp: 25 });
}

// The old guardroom: four ruined walls round the cellar stairs, no roof, the door toward the ward.
function guardroom(ctx) {
  const { root, heightAt } = ctx, y = 19;
  const wall = (ax, az, bx, bz, heights) => curtain(root, ax, az, bx, bz, heights, y);
  wall(-350, 143, -366, 143, [3.2, 2.6, 1.4, .6, .9, 2.2, 3.4, 3.8]);
  wall(-366, 157, -350, 157, [3.6, 3.1, 2.4, 1.1, .5, 1.3, 2.8, 3]);
  wall(-366, 143, -366, 157, [3.8, 4.2, 4.4, 4.6, 4.4, 4]);
  wall(-350, 143, -350, 146.4, [2.2, 1.4]);
  wall(-350, 153.6, -350, 157, [1.2, 2.6]);
  // A rafter end still in its socket, the rest fallen in a corner.
  beam(root, [-364.8, y + 3.6, 143.6], [-360.2, y + .3, 146.2], .3, 'timber');
  beam(root, [-351.2, y + 2.4, 156.4], [-354.6, y + .2, 155.1], .26, 'timber');
  put(root, 'rubble_pile', -363.8, y, 155.2, .8); put(root, 'rubble_pile', -352.3, y, 144.4, 2.1, .8);
  // The stairs (the terrain is cut for them, heightfield.js burrows › stairs): retaining walls of ashlar each side, a step of cut
  // stone over every tread, a vault over the landing at the foot and the cellar door under it.
  const x0 = -363.5, len = 10, foot = 14, steps = 14, tread = (len - 1.4) / steps;
  for (const side of [-1, 1]) {
    const z = 150 + side * 1.78;
    for (let k = 0; k < 4; k++) blockOn(root, 3.05, 5.6, .5, k % 2 ? 'ashlarMossy' : 'ashlar', x0 - .9 + 1.55 + k * 3, foot - .3, z, 0, standing);
    blockOn(root, 11.9, .3, .72, 'ashlarMossy', x0 + 4.95, y - .02, z);
  }
  for (let s = 1; s <= steps; s++) {
    const top = foot + 5 * s / steps, cx = x0 + 1.4 + (s - .5) * tread;
    const step = blockOn(root, tread + .02, top - foot + .2, 3.05, s % 3 ? 'ashlar' : 'flagstone', cx, foot - .2, 150);
    step.userData.noCollide = true;
  }
  blockOn(root, 2.4, .2, 3.05, 'flagstone', x0 + .25, foot - .2, 150).userData.noCollide = true;
  // The vault over the foot: the stairs run under the guardroom floor into the dark.
  blockOn(root, 3.2, 1.4, 4.6, 'ashlar', x0 - .3, foot + 3.6, 150, 0, standing);
  arch(root, x0 + 1.3, foot, 150, PI / 2, 3, 2.4);
  blockOn(root, .8, 5.6, 4.4, 'ashlarMossy', x0 - 1.4, foot - .2, 150, 0, standing);
  put(root, 'door_cellar', x0 - .92, foot, 150, -PI / 2);   // models face -Z: turned to face up the stairs
  // Old barricade pulled aside, new boards nailed over the gap in the north wall, the lantern at the top of the steps.
  put(root, 'barricade', -352.2, y, 147.2, .3); put(root, 'plank_patch', -357.5, y, 143.85, 0);
  put(root, 'stair_lantern', -352.8, y, 152.4, -PI / 2);
  const glow = new THREE.PointLight(0xffb066, 6, 9, 2); glow.position.set(-352.8, y + 2.2, 152.4); root.add(glow);
  ctx.marker({ id: 'zollkeller_treppe', kind: 'tower', label: 'Die alte Wachstube', x: -357, z: 150, discover: true, radius: 9, xp: 10 });
}

// The supply passage's postern in the north curtain: a low, iron-bound door, barred from inside (main.js knows how it opens).
function postern(ctx) {
  const { root } = ctx, y = 19, P = ZOLL_POSTERN;
  put(root, 'door_postern', P.doorX, y, P.doorZ, PI);
  blockOn(root, 2.4, .5, 1.7, 'ashlar', P.doorX, y + 2.55, P.doorZ - .45, 0, standing);
}

export function buildBruchwacht(ctx) {
  court(ctx); guardroom(ctx); postern(ctx);
  return { sync() {}, update() {} };
}
