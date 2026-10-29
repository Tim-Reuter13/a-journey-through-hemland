import * as THREE from 'three';
import { createCharacter } from '../characters/models.js';

// Animals around the player: deer and foxes in woods and fields, hares in the open, crows that
// sit in groups and lift off when you come close. They are Blockbench models (art/blockbench/
// models.js) animated on their rig: walk and gallop, a hare's hop, a crow's wingbeat, grazing,
// ear flicks, a deer flashing its tail as it runs. They graze, wander and flee from people; they
// are spawned in a ring around the player by biome and removed far behind.
// They can be hunted: a wounded animal bolts, a dead one goes down as a ragdoll and can be searched
// for meat and hide. Someone creeping up slowly gets far closer than someone who runs at them.
const KINDS = {
  deer: { name: 'Hirsch', speed: 2.2, flee: 9.5, fear: 20, herd: [2, 4], hp: 45, aim: 1.2, radius: .8, xp: 10, scale: [.92, 1.08], gait: 'gallop', loot: { wildbret: [2, 3], hirschfell: [1, 1], geweih: [0, 1] } },
  fox: { name: 'Fuchs', speed: 2.6, flee: 8.5, fear: 13, herd: [1, 1], hp: 24, aim: .45, radius: .5, xp: 8, scale: [.9, 1.05], gait: 'gallop', loot: { fuchsfell: [1, 1], wildbret: [0, 1] } },
  hare: { name: 'Hase', speed: 1.6, flee: 7.5, fear: 9, herd: [1, 3], hp: 9, aim: .25, radius: .35, xp: 4, scale: [.9, 1.1], gait: 'hop', loot: { hasenfell: [1, 1], wildbret: [1, 1] } },
  crow: { name: 'Krähe', speed: 1, flee: 6, fear: 8, herd: [3, 6], hp: 5, aim: .2, radius: .3, xp: 2, scale: [.62, .72], gait: 'hop', loot: { kraehenfedern: [2, 4] } },
};
const LEGS = [['front', 'right', 0], ['front', 'left', Math.PI], ['rear', 'right', Math.PI], ['rear', 'left', 0]];
const damp = (value, target, rate, dt) => value + (target - value) * Math.min(1, rate * dt);

function build(kind) {
  const def = KINDS[kind], scale = def.scale[0] + Math.random() * (def.scale[1] - def.scale[0]);
  const group = createCharacter(kind, { scale }), rig = group.userData.rig;
  // Does have no antlers; a crow on the ground keeps its wings folded.
  if (kind === 'deer' && Math.random() < .55) rig.antlers.visible = false;
  if (kind === 'crow') rig.wing_right.visible = rig.wing_left.visible = false;
  group.traverse(o => { if (o.isMesh) o.castShadow = kind !== 'crow'; });
  return { group, rig };
}

/** ragdoll(model, impulse): optional, turns a dead animal into a physics body (systems/ragdoll.js). */
export function createWildlife(scene, { heightAt, biomeAt, waterLevel, avoid = () => false, max = 14, ragdoll = null }) {
  const animals = [], root = new THREE.Group(); root.name = 'wildlife'; scene.add(root);
  let spawnIn = 2, time = 0;
  function choose(x, z) {
    const w = biomeAt(x, z), wooded = Math.min(1, w.forest + w.autumn + w.taiga);
    const roll = Math.random();
    if (roll < .3) return 'crow';
    if (roll < .55) return w.plains > .4 ? 'hare' : wooded > .4 ? 'deer' : 'hare';
    if (roll < .85) return wooded > .25 || w.plains > .3 ? 'deer' : 'hare';
    return 'fox';
  }
  function spawn(near) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 60, x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < waterLevel + .5 || h > 55 || avoid(x, z)) return;
    const kind = choose(x, z), def = KINDS[kind], [lo, hi] = def.herd, n = lo + Math.floor(Math.random() * (hi - lo + 1));
    for (let i = 0; i < n && animals.length < max; i++) {
      const { group, rig } = build(kind), px = x + (Math.random() - .5) * 6, pz = z + (Math.random() - .5) * 6;
      group.position.set(px, heightAt(px, pz), pz); group.rotation.y = Math.random() * Math.PI * 2; root.add(group);
      animals.push({ kind, def, group, rig, state: 'graze', timer: 2 + Math.random() * 5, heading: group.rotation.y, speed: 0, phase: Math.random() * 6, fly: 0,
        flick: Math.random() * 3, seed: Math.random() * 9, bodyY: rig.body.position.y,
        // Combat reads these like an enemy's (model, aim height, hit radius).
        prey: true, model: group, name: def.name, hp: def.hp, maxHp: def.hp, aim: def.aim * group.scale.y, radius: def.radius, dead: false, loot: null });
    }
  }
  function remove(an) { an.ragdoll?.dispose(); root.remove(an.group); animals.splice(animals.indexOf(an), 1); }
  // Heading is the facing (front is −z), so turning away from the threat means facing along threat → animal.
  function bolt(an, from) { an.state = 'flee'; an.timer = 4 + Math.random() * 3; an.heading = Math.atan2(from.x - an.group.position.x, from.z - an.group.position.z) + (Math.random() - .5) * .6; }
  /** Damage from a blow or spell; returns true when it kills. Herd mates nearby bolt as well. */
  function hurt(an, amount, from) {
    if (an.dead) return false;
    an.hp -= amount;
    if (an.hp > 0) { bolt(an, from); an.speed = an.def.flee; return false; }
    an.dead = true; an.state = 'dead'; an.fall = 0; an.rot = 600;
    an.loot = Object.fromEntries(Object.entries(an.def.loot).map(([id, [lo, hi]]) => [id, lo + Math.floor(Math.random() * (hi - lo + 1))]).filter(([, n]) => n > 0));
    for (const other of animals) if (!other.dead && other !== an && other.group.position.distanceTo(an.group.position) < 25) bolt(other, from);
    if (an.kind === 'crow') { an.rig.wing_right.visible = an.rig.wing_left.visible = true; an.rig.fold.visible = false; }
    if (ragdoll) {
      // The blow carries on into the body; a running animal tumbles on in its own direction.
      const p = an.group.position, away = new THREE.Vector3(p.x - from.x, 0, p.z - from.z).normalize();
      const run = new THREE.Vector3(-Math.sin(an.group.rotation.y), 0, -Math.cos(an.group.rotation.y)).multiplyScalar(an.speed * .5);
      const mass = an.kind === 'deer' ? 60 : an.kind === 'fox' ? 9 : 2;
      an.ragdoll = ragdoll(an.group, away.multiplyScalar(2.5).add(run).add(new THREE.Vector3(0, 1.5, 0)).multiplyScalar(mass * .35));
    }
    an.speed = 0;
    return true;
  }
  /** Living animals within `radius` of a point, for weapons and spells. */
  function targets(at, radius = 30) { return animals.filter(an => !an.dead && Math.hypot(an.group.position.x - at.x, an.group.position.z - at.z) < radius); }
  /** Dead animals that still carry something; `at` is where the body lies. */
  function carcasses() { return animals.filter(an => an.dead && an.loot && Object.values(an.loot).some(n => n > 0)); }
  const bodyAt = an => an.ragdoll ? an.ragdoll.position() : an.group.position;

  function animate(an, dt) {
    const rig = an.rig, def = an.def, moving = Math.min(1, an.speed / 1.5), fast = an.speed > def.speed * 1.3;
    an.phase += dt * (def.gait === 'hop' ? 3 + an.speed * 1.6 : 2.2 + an.speed * (fast ? 1.25 : 2.4));
    if (an.kind === 'crow') return animateCrow(an, dt);
    // Legs: diagonal pairs at a walk, front and rear pairs together at a gallop or a hop.
    const amp = Math.min(.8, an.speed * (def.gait === 'hop' ? .3 : fast ? .14 : .3));
    for (const [set, side, offset] of LEGS) {
      const upper = rig[`${set}_upper_${side}`], lower = rig[`${set}_lower_${side}`];
      const pair = def.gait === 'hop' || fast ? (set === 'front' ? 0 : Math.PI) + (side === 'left' ? .35 : 0) : offset;
      const t = an.phase + pair, swing = Math.sin(t) * amp, lift = Math.max(0, Math.cos(t)) * amp * 1.4;
      upper.rotation.x = damp(upper.rotation.x, def.gait === 'hop' && set === 'rear' ? -swing * 1.3 : swing, 14, dt);
      lower.rotation.x = damp(lower.rotation.x, set === 'front' ? -lift : lift * .7, 14, dt);
    }
    // Body: a bounce in the gait, the hare arcs through each hop.
    const bounce = def.gait === 'hop' ? Math.max(0, Math.sin(an.phase)) * moving * .22 : Math.abs(Math.sin(an.phase)) * moving * (fast ? .05 : .02);
    rig.body.position.y = an.bodyY + bounce;
    rig.body.rotation.x = damp(rig.body.rotation.x, def.gait === 'hop' ? Math.cos(an.phase) * moving * .25 : fast ? Math.sin(an.phase * 2) * .05 : 0, 10, dt);
    // Grazing: head down to the grass now and then; on the run the neck stretches forward.
    const grazing = an.state === 'graze' && Math.sin(time * .55 + an.seed) > -.25;
    rig.neck.rotation.x = damp(rig.neck.rotation.x, grazing ? -.95 : an.state === 'flee' ? -.35 : .08 * Math.sin(time * .3 + an.seed), 3, dt);
    rig.head.rotation.x = damp(rig.head.rotation.x, grazing ? -.25 + Math.sin(time * 7 + an.seed) * .06 : 0, 4, dt);
    rig.head.rotation.y = damp(rig.head.rotation.y, an.state === 'graze' && !grazing ? Math.sin(time * .8 + an.seed) * .5 : 0, 3, dt);
    // Ears flick now and then; the deer flags its white tail when it runs, the fox's brush sways.
    if ((an.flick -= dt) <= 0) an.flick = 1.5 + Math.random() * 4;
    const twitch = an.flick < .15 ? Math.sin(an.flick * 40) * .35 : 0;
    if (rig.ear_right) { rig.ear_right.rotation.z = twitch; rig.ear_left.rotation.z = -twitch * .6; }
    const tail = rig.tail_1;
    if (tail) {
      if (an.kind === 'deer') tail.rotation.x = damp(tail.rotation.x, an.state === 'flee' ? -1.3 : Math.sin(time * 3 + an.seed) * .1, 8, dt);
      else tail.rotation.y = Math.sin(time * (1.5 + an.speed) + an.seed) * (.15 + moving * .2);
    }
  }
  function animateCrow(an, dt) {
    const rig = an.rig, flying = an.fly > .05;
    rig.wing_right.visible = rig.wing_left.visible = flying; rig.fold.visible = !flying;
    if (flying) {
      const flap = Math.sin(time * 16 + an.seed) * .85 * Math.min(1, an.fly * 2);
      rig.wing_right.rotation.z = flap; rig.wing_left.rotation.z = -flap;
      rig.leg_right.rotation.x = rig.leg_left.rotation.x = .9;
      rig.body.rotation.x = damp(rig.body.rotation.x, .15, 6, dt);
    } else {
      // On the ground: little hops while walking, pecking at the soil while it feeds.
      rig.body.position.y = an.bodyY + (an.speed > .2 ? Math.max(0, Math.sin(an.phase * 1.6)) * .14 : 0);
      rig.leg_right.rotation.x = rig.leg_left.rotation.x = 0;
      const peck = an.state === 'graze' && Math.sin(time * 1.3 + an.seed) > .4;
      rig.head.rotation.x = damp(rig.head.rotation.x, peck ? -.9 + Math.max(0, Math.sin(time * 14 + an.seed)) * .5 : 0, 12, dt);
      rig.body.rotation.x = damp(rig.body.rotation.x, peck ? -.25 : 0, 8, dt);
      rig.head.rotation.y = an.state === 'graze' && !peck ? Math.sin(time * 2 + an.seed) * .6 : 0;
    }
    rig.tail_1.rotation.x = Math.sin(time * 2.5 + an.seed) * .08;
  }

  /** people: what scares animals, the player first; `stealth` (0..1) shrinks how far they notice you. */
  function update(dt, people, stealth = 0) {
    time += dt;
    const player = people[0];
    if ((spawnIn -= dt) <= 0) { spawnIn = 3 + Math.random() * 4; if (animals.filter(an => !an.dead).length < max) spawn(player); }
    for (const an of [...animals]) {
      const g = an.group, p = g.position, b = bodyAt(an), d = Math.hypot(b.x - player.x, b.z - player.z);
      if (d > 170 || an.dead && (an.rot -= dt) <= 0) { remove(an); continue; }
      if (an.dead) {
        if (an.ragdoll) continue;
        // Without physics: down on its side; a shot crow drops out of the air first.
        an.fall = Math.min(1, an.fall + dt * 3.2);
        const ground = heightAt(p.x, p.z); p.y = Math.max(ground, p.y - dt * 9);
        g.rotation.z = an.fall * Math.PI / 2;
        continue;
      }
      const threat = people.reduce((best, q) => { const dq = Math.hypot(p.x - q.x, p.z - q.z); return dq < best.d ? { d: dq, q } : best; }, { d: Infinity, q: null });
      // A grazing animal with its head in the grass notices less.
      const fear = an.def.fear * (threat.q === player ? 1 - stealth * .75 : 1) * (an.state === 'graze' ? .8 : 1);
      if (threat.d < fear && an.state !== 'flee') bolt(an, threat.q);
      if ((an.timer -= dt) <= 0) {
        if (an.state === 'flee') { an.state = 'graze'; an.timer = 3 + Math.random() * 5; an.fly = 0; }
        else if (an.state === 'graze') { an.state = 'walk'; an.timer = 2 + Math.random() * 4; an.heading += (Math.random() - .5) * 2.2; }
        else { an.state = 'graze'; an.timer = 3 + Math.random() * 6; }
      }
      const target = an.state === 'flee' ? an.def.flee : an.state === 'walk' ? an.def.speed * .45 : 0;
      an.speed += (target - an.speed) * Math.min(1, dt * 4);
      if (an.kind === 'crow' && an.state === 'flee') {
        // Crows lift off and circle away, then land again further on.
        an.fly = Math.min(1, an.fly + dt * .8); an.heading += dt * .8;
        p.x += Math.sin(an.heading) * -an.speed * dt; p.z += Math.cos(an.heading) * -an.speed * dt;
        p.y = heightAt(p.x, p.z) + an.fly * (5 + Math.sin(time + an.seed) * 1.5);
      } else {
        const nx = p.x - Math.sin(an.heading) * an.speed * dt, nz = p.z - Math.cos(an.heading) * an.speed * dt, nh = heightAt(nx, nz);
        // Turn away from water, cliffs and walls instead of walking into them.
        if (nh < waterLevel + .3 || Math.abs(nh - heightAt(p.x, p.z)) > .8 * Math.max(.2, an.speed * dt * 4) || avoid(nx, nz)) an.heading += 1.4 * dt * 4;
        else { p.x = nx; p.z = nz; }
        p.y = Math.max(heightAt(p.x, p.z), p.y - dt * 6);
        an.fly = Math.max(0, an.fly - dt * 2);
      }
      const turn = THREE.MathUtils.euclideanModulo(an.heading - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      g.rotation.y += turn * Math.min(1, dt * 6);
      animate(an, dt);
    }
  }
  return { update, hurt, targets, carcasses, bodyAt, animals, state: () => ({ animals: animals.length, dead: animals.filter(a => a.dead).length, ragdolls: animals.filter(a => a.ragdoll).length, kinds: animals.reduce((m, a) => (m[a.kind] = (m[a.kind] || 0) + 1, m), {}) }) };
}
