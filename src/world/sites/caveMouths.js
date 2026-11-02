import * as THREE from 'three';
import { block, blockOn, beam } from '../../art/blocks.js';
import { pixelMaterial } from '../../art/pixelTextures.js';
import { propClone } from '../props.js';

// The ways down into the goblin caves (systems/caves.js has the insides). Each is a hole in the ground itself, on the
// downhill flank of a rise of earth: the heightfield shapes both (heightfield.js burrows, terrain.js draws the hole on
// a finer grid), so it is the land and not a model set on it. Two are sunken ways you walk down into the dark (at the
// bottom you are in); the old mine is a shaft you climb down. Each tribe leaves only a small sign: two skulls
// on stakes for the bone singers, glowing mushrooms on the rim for the fungus mothers, the rotten head-frame of the old
// royal mine's shaft for the chain breakers.
const PI = Math.PI;
const IRON_DARK = pixelMaterial('iron', { tint: 0x5a5e62 });
export const CAVE_MOUTHS = { klagende_grube: 'cave_klagende', moderhoehle: 'cave_moder', eisengrube: 'cave_eisen' };

/** Where a cave's hole is and which way the land falls from it; door is where you go in, exit where you come out. */
export function caveMouth(site, heightAt) {
  let best = -Infinity, facing = 0;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * PI * 2, drop = heightAt(site.x, site.z) - heightAt(site.x + Math.sin(a) * 22, site.z + Math.cos(a) * 22);
    if (drop > best) { best = drop; facing = a; }
  }
  const hole = site.hole || 2, walkIn = !!site.walkIn, rim = walkIn ? 10.5 : hole + .4, fx = Math.sin(facing), fz = Math.cos(facing);
  const along = u => ({ x: site.x + fx * u, z: site.z + fz * u });
  return { x: site.x, z: site.z, y: heightAt(site.x + fx * rim, site.z + fz * rim), facing, hole, walkIn, door: walkIn ? along(1.3) : along(0), exit: along(walkIn ? 5.5 : hole + 1.1) };
}

export function buildCaveMouths(ctx) {
  const r = ctx.random;
  for (const [caveId, siteId] of Object.entries(CAVE_MOUTHS)) {
    const site = ctx.site(siteId), m = caveMouth(site, ctx.heightAt);
    // Local frame: +z points down the slope out of the hole, +x across it.
    const at = (lx, lz) => { const x = m.x + lx * Math.cos(m.facing) + lz * Math.sin(m.facing), z = m.z - lx * Math.sin(m.facing) + lz * Math.cos(m.facing); return [x, ctx.heightAt(x, z), z]; };
    const g = new THREE.Group(); g.name = `cave mouth ${caveId}`; ctx.root.add(g);
    // Nobody walks over the shaft: its rim stops you, and the cave is entered from it (main.js).
    if (!m.walkIn) ctx.addCollider({ kind: 'cave_mouth', surface: 'stone', x: m.x, z: m.z, radius: m.hole - .1, bottom: m.y - 7, top: m.y + 1.4 });
    // Blockbench props (world/props.js CAVE_PROPS), stood on the ground; before they load (Node tests) nothing.
    const put = (name, lx, lz, ry = 0, solid = false) => { const [x, y, z] = at(lx, lz), prop = propClone(name, { solid }); if (!prop) return; prop.position.set(x, y - .05, z); prop.rotation.y = m.facing + ry; g.add(prop); };
    if (caveId === 'klagende_grube') {
      // The bone singers: skulls on stakes at the top of the way down, a barricade of stakes, bones on the rim.
      put('skull_stake', -m.hole - 1.1, 9.3, .3, true); put('skull_stake', m.hole + 1.2, 9.1, -.2, true); put('skull_stake', -m.hole - 1.4, 4.5, .8, true);
      put('spikes', m.hole + 2.6, 6.5, PI / 2 - .2, true); put('bone_pile', -m.hole - 2.2, 2, r() * PI); put('filth', m.hole + 1.6, 1.2, r() * PI);
    } else if (caveId === 'moderhoehle') {
      // The fungus mothers: giant mushrooms on the rim, clusters glowing down the way.
      put('mushroom_giant', -m.hole - 1.8, 3.2, r() * PI, true); put('mushroom_giant', m.hole + 2.2, 6.8, r() * PI, true);
      for (let k = 0; k < 5; k++) put('mushrooms', (k % 2 ? 1 : -1) * (m.hole + .6 + r() * .9), 1.5 + k * 1.9, r() * PI);
      put('filth', -m.hole - .8, 8.5, r() * PI);
      const [x, y, z] = at(0, 2), light = new THREE.PointLight(0x6fd2c0, 2.5, 9, 2); light.position.set(x, y + 3, z); g.add(light);
    } else {
      // The old royal mine's shaft: a rotten head-frame of two posts and a crossbeam, a rusty chain down into the dark.
      const [ax, ay, az] = at(-m.hole - .2, 0), [bx, by, bz] = at(m.hole + .2, 0), top = Math.max(ay, by) + 2.6;
      beam(g, [ax, ay - .3, az], [ax, top, az], .3, 'timber'); beam(g, [bx, by - .3, bz], [bx, top, bz], .3, 'timber');
      beam(g, [ax, top, az], [bx, top + .15, bz], .26, 'timber');
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      for (let k = 0; k < 9; k++) block(g, .07, .3, .14, IRON_DARK, cx, top - .2 - k * .32, cz, 0, k % 2 ? PI / 2 : 0, 0);
      const [px, py, pz] = at(1.2, m.hole + 1.6);
      blockOn(g, 1.6, .12, .3, 'darkPlanks', px, py - .02, pz, m.facing + .4);
    }
    ctx.marker({ id: siteId, kind: 'camp', label: site.name, x: m.x, z: m.z, discover: true, radius: 28, xp: 25 });
  }
  return {};
}
