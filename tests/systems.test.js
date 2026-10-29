import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INITIAL_CHARACTER, gainExperience, resetCharacter } from '../src/systems/progression.js';
import { normalizeSave, encodeSave } from '../src/systems/saveState.js';
import { circleIntersectsBox } from '../src/systems/collision.js';
import { createRPGSystems } from '../src/systems/rpgSystems.js';
import { batchScenery } from '../src/world/batching.js';

const character = () => ({ ...structuredClone(INITIAL_CHARACTER), position: new THREE.Vector3(3,0,0), yaw: 2.55, pitch: -.09, mode: 'third' });
const legacy = { version: 3, position: [3,0,0], level: 2, hp: 120, stamina: 90, xp: 5, quest: 'camp' };

test('one XP award grants each crossed level exactly once', () => {
  const player = character();
  assert.equal(gainExperience(player, 350), 2);
  assert.equal(player.level, 3); assert.equal(player.xp, 50);
  assert.equal(player.maxHp, 124); assert.equal(player.maxStamina, 112);
  assert.equal(player.perkPoints, 2);
  assert.equal(gainExperience(player, 0), 0);
  assert.equal(gainExperience(player, NaN), 0);
  assert.equal(gainExperience(player, -50), 0);
});

test('new game restores all character stats without replacing the position vector', () => {
  const player = character(), position = player.position;
  gainExperience(player, 350); player.perks.push('eisernes_herz');
  player.equipment.weapon = 'aschenklinge'; player.loot.push('aschenrüstung');
  resetCharacter(player);
  assert.equal(player.position, position); assert.equal(player.maxHp, 100);
  assert.deepEqual(player.equipment, INITIAL_CHARACTER.equipment);
  assert.deepEqual(player.perks, []); assert.deepEqual(player.loot, []);
  player.attributes.strength = 8; resetCharacter(player);
  assert.equal(player.attributes.strength, 1);
});

test('version 4 round-trips progression, inventory, relationships and clock', () => {
  const player = character(); gainExperience(player, 350);
  player.maxHp += 30; player.perks.push('eisernes_herz'); player.perkPoints--;
  player.equipment.weapon = 'aschenklinge'; player.loot.push('rostiges_schwert');
  const relations = { elira: { trust: 15, met: true, gifts: 0, memories: ['Hat geholfen'] } };
  const encoded = encodeSave(player, {quest:'m_camp',flags:{elira_briefed:true}}, [{hp:0,dead:true}], relations, 17.5, {});
  const restored = normalizeSave(JSON.parse(encoded));
  for (const key of Object.keys(INITIAL_CHARACTER)) assert.deepEqual(restored.player[key], player[key], key);
  assert.equal(restored.hour, 17.5); assert.equal(restored.quest, 'm_camp'); assert.equal(restored.flags.elira_briefed, true);
  assert.deepEqual(restored.relationships.elira, relations.elira);
  assert.equal(restored.enemies[0].dead, true);
});

test('older saves migrate missing maxima and remove already-awarded duplicate potions', () => {
  for (const version of [1,2,3]) {
    const restored = normalizeSave({...legacy, version, loot:['heiltrank','aschenklinge'], potions:4});
    assert.equal(restored.player.maxHp, 112); assert.equal(restored.player.hp, 112);
    assert.equal(restored.player.maxStamina, 106); assert.equal(restored.player.perkPoints, 1);
    assert.deepEqual(restored.player.loot, ['aschenklinge']); assert.equal(restored.player.potions, 4);
  }
});

test('invalid save envelopes fail safely; valid saves sanitize unsafe fields', () => {
  for (const data of [null, {}, {...legacy,version:99}, {...legacy,position:[NaN,0,0]}, {...legacy,position:[0,0]}]) assert.equal(normalizeSave(data), null);
  const restored = normalizeSave({...legacy, hp:Infinity, gold:-30, stamina:99999, attributes:{endurance:'oops'},
    perks:['invalid','eisernes_herz','eisernes_herz'], equipment:{weapon:'unknown'}, loot:['unknown'], enemies:[null] });
  assert.equal(restored.player.gold, 0);
  assert.equal(restored.player.stamina, restored.player.maxStamina);
  assert.equal(restored.player.attributes.endurance, 1);
  assert.deepEqual(restored.player.perks, ['eisernes_herz']);
  assert.equal(restored.player.equipment.weapon, 'rostiges_schwert');
  assert.deepEqual(restored.player.loot, []);
});

test('rotated rectangular building collisions cover corners without blocking open streets', () => {
  assert.equal(circleIntersectsBox(3.9,3.3,.43,0,0,4.05,3.45,0),true);
  assert.equal(circleIntersectsBox(4.7,0,.43,0,0,4.05,3.45,0),false);
  const rotation = .7, lx = 3.9, lz = 3.3;
  const x = lx*Math.cos(rotation)+lz*Math.sin(rotation), z = -lx*Math.sin(rotation)+lz*Math.cos(rotation);
  assert.equal(circleIntersectsBox(x,z,.43,0,0,4.05,3.45,rotation),true);
  assert.equal(circleIntersectsBox(0,0,.43,0,0,4.05,3.45,rotation),true);
});

test('RPG resource restore and reset do not retain a previous adventure', () => {
  const rpg = createRPGSystems(); rpg.addResource('leather',8); rpg.setWorldFlag('shrineLit');
  rpg.reset(); assert.equal(rpg.state.inventory.leather,0); assert.deepEqual(rpg.state.worldFlags,{});
  rpg.restore({inventory:{leather:3,wood:-1},worldFlags:{shrineLit:true},crafted:['blade']});
  assert.equal(rpg.state.inventory.leather,3); assert.equal(rpg.state.inventory.wood,0);
  assert.equal(rpg.state.worldFlags.shrineLit,true);
});

test('scenery batching preserves transformed geometry and excludes animated meshes', () => {
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
  group.position.set(3,2,10); group.rotation.y = .8;
  const material = new THREE.MeshStandardMaterial();
  for (const x of [-2,2]) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,2,1),material); mesh.position.x=x; group.add(mesh); }
  const animated = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material); scene.add(animated);
  const before = new THREE.Box3().setFromObject(scene);
  const stats = batchScenery(scene,new Set([animated]),1000);
  const after = new THREE.Box3().setFromObject(scene);
  assert.equal(stats.sourceMeshes,2); assert.equal(stats.batches,1);
  assert.ok(before.min.distanceTo(after.min)<.00001); assert.ok(before.max.distanceTo(after.max)<.00001);
  assert.equal(animated.parent,scene);
});
