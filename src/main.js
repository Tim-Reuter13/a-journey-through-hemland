import * as THREE from 'three';
import { createWorld } from './world/world.js';
import { loadPropModels } from './world/props.js';
import { loadTreeModels } from './world/trees.js';
import { loadCharacterModels, createCharacter, equipItem, WEAPON_MODELS, heldItem } from './characters/models.js';
import { createAnimator, solveArm } from './characters/animator.js';
import { createHeldBow, aimObject } from './characters/bow.js';
import { traceSpellSurface } from './systems/spellFx.js';
import { loadModularLibrary, createModularCharacter, restyleCharacter } from './characters/modular.js';
import { PLAYER_DEFAULT, NPC_LOOKS, banditLook } from './data/npcs.js';
import { createCitizens, townSpots } from './data/citizens.js';
import * as STORY from './data/hemland/story.js';
import { SITES, WATER_LEVEL, ROADS, biomeWeights } from './world/hemland.js';
import { createDialogue } from './systems/dialogue.js';
import { createDirector } from './systems/director.js';
import { INTRO_SCRIPT } from './data/hemland/intro.js';
import { block, blockOn } from './art/blocks.js';
import { pixelMaterial } from './art/pixelTextures.js';
import { createPhysics } from './systems/physics.js';
import { createRagdoll, createCreatureRagdoll } from './systems/ragdoll.js';
import { createMotion } from './systems/motion/motion.js';
import { createAmbientFx } from './world/ambientFx.js';
import * as motionIK from './systems/motion/ik.js';
import { createNpcLife } from './systems/npcLife.js';
import { speakLine, stopVoice, voiceStatus } from './audio/voice.js';
import { createRPGSystems } from './systems/rpgSystems.js';
import { resetCharacter, gainExperience } from './systems/progression.js';
import { normalizeSave, encodeSave } from './systems/saveState.js';
import { ITEMS, outfitFor } from './systems/items.js';
import { createInventory } from './systems/inventory.js';
import { createInventoryUI } from './ui/inventoryUI.js';
import { createGraphics } from './systems/graphics.js';
import { createCombat, ARCHER_DRAW } from './systems/combat.js';
import { BOW } from './systems/archery.js';
import { createFirstPerson } from './characters/firstPerson.js';
import { createAmbience } from './audio/ambience.js';
import { createCompass } from './ui/compass.js';
import './ui/compass.css';
import './ui/fonts.js';
import { createMenu, loadSettings, saveSettings, setBarVisibility, SETTINGS_KEY } from './ui/menu.js';
import { createTouchControls, prefersTouch, toggleFullscreen } from './ui/touchControls.js';
import { createCharacterCreator, randomAppearance } from './ui/characterCreator.js';
import { createWildlife } from './systems/wildlife.js';
import { createTracks } from './world/tracks.js';
import { createAIManager } from './systems/ai/manager.js';
import { campSchedule } from './systems/ai/camp.js';
import { AI } from './systems/ai/config.js';
import { createBarks } from './ui/barks.js';
import './ui/characterCreator.css';
import './ui/style.css';
import './ui/touch.css';

// ASHEN REALMS — Die letzte Glut. Playable standalone fantasy RPG vertical slice.
// The scene, creatures, architecture and effects are constructed locally.
const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 320);
// Phones skip MSAA on the canvas: the scene renders into the low-resolution target, the canvas only shows it.
const renderer = new THREE.WebGLRenderer({ antialias: !prefersTouch(), powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
scene.fog = new THREE.FogExp2(0x8d9aa0, 0.0052);
renderer.domElement.tabIndex = 0;
$('game').append(renderer.domElement);
// The towns place Blockbench props while they are generated, so those load before the world.
await Promise.all([loadPropModels().catch(error => console.warn('Props not loaded, towns use block clutter', error)),
  loadTreeModels().catch(error => console.warn('Trees not loaded, the land uses block trees', error))]);
const world = createWorld(scene);
const graphics = createGraphics(renderer, world);
const rpg = createRPGSystems();

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const [physics] = await Promise.all([createPhysics({ water: (x, z) => world.water.at(x, z) }), loadCharacterModels(), loadModularLibrary()]);
physics.addStaticColliders(world.colliders.filter(c => c.kind !== 'door'));
// Terrain tiles and chunk scenery join the physics world as the streamer loads them.
world.streamer.attachPhysics(physics);
world.streamer.prime(new THREE.Vector3(3, 0, 0));
for (const f of world.floors) physics.addStaticBox({ x: f.x, y: f.y - .25, z: f.z, hx: f.halfWidth, hy: .25, hz: f.halfDepth, rotationY: f.rotation });
// Small things on interior tables become physics props (origin moved to the box centre).
for (const item of world.loose) {
  const { half, mass, center = [0, half[1], 0] } = item.userData.physics;
  scene.attach(item);
  for (const child of item.children) child.position.y -= center[1];
  item.position.y += center[1];
  physics.addProp(item, { half, mass, item: ITEMS[item.userData.item] ? item.userData.item : null });
}
// Interior chests hold a few useful things; beds let the player sleep until morning.
const CHEST_GOODS = [{ reisefladen: 2, heiltrank: 1 }, { leder: 3, holz: 2, waldapfel: 2 }, { ausdauertrank: 1, bernstein: 1 }, { kraeuter: 4, reisefladen: 1 }, { eisenerz: 2, leder: 1 }];
const furnitureSpots = world.interiors.flatMap(room => room.interactables.map((piece, i) => ({ piece, room, kind: piece.userData.interact.kind, label: piece.userData.interact.label,
  items: piece.userData.interact.kind === 'loot' ? { ...CHEST_GOODS[(room.house + i) % CHEST_GOODS.length] } : null })));
for (const [half, top] of [[4, .215], [3.4, .615], [2.8, 1.015]]) { const s = world.landmarks.shrine, base = world.terrainHeightAt(s.x, s.z); physics.addStaticBox({ x: s.x, y: base + top - .6, z: s.z, hx: half, hy: .6, hz: half }); }
// Loose things lying around the village: pick up (tap E), carry (hold E), throw (click while carrying), kick.
const LOOSE = [
  ['waldapfel', 5.3, 9.3, 'apple'], ['waldapfel', 5.6, 9.0, 'apple'], ['waldapfel', 3.4, 11.2, 'apple'], ['reisefladen', 6.1, 8.0, 'bread'],
  [null, -1.4, 6.8, 'bucket'], [null, 1.2, 12.4, 'crate'], [null, 1.9, 13.4, 'crate'], [null, -0.2, 14.6, 'barrel'],
  [null, -5.6, 11.6, 'log'], [null, -5.9, 12.2, 'log'], ['kraeuter', -8.8, 5.4, 'herbs'], [null, 7.6, 9.4, 'pot'],
];
function looseObject(kind) {
  const g = new THREE.Group();
  const shapes = { apple: [[.14, .14, .14, 'clothRed']], bread: [[.32, .12, .2, 'hay']], bucket: [[.36, .38, .36, 'planksVertical'], [.4, .05, .4, 'iron']],
    crate: [[.5, .5, .5, 'planks']], barrel: [[.6, .8, .6, 'planksVertical'], [.64, .06, .64, 'iron']], log: [[1.1, .26, .26, 'bark']],
    herbs: [[.2, .1, .14, 'oakLeaves']], pot: [[.34, .28, .34, 'iron'], [.24, .06, .24, 'stone']] }[kind];
  shapes.forEach(([w, h, d, mat], i) => block(g, w, h, d, mat, 0, i ? h / 2 - .02 : 0, 0));
  const [w, h, d] = shapes[0];
  return { object: g, half: [w / 2, h / 2, d / 2], mass: { apple: .2, bread: .3, bucket: 2, crate: 9, barrel: 30, log: 12, herbs: .1, pot: 3 }[kind] };
}
for (const [item, x, z, kind] of LOOSE) {
  const { object, half, mass } = looseObject(kind);
  object.position.set(x, world.terrainHeightAt(x, z) + half[1] + .3, z); object.rotation.y = x * 1.7;
  object.userData.item = item; scene.add(object);
  physics.addProp(object, { half, mass, item });
}
// Characters are assembled from appearance + equipped items (src/data/npcs.js).
function dressed(look, scale = 1) {
  const { parts, tints } = outfitFor(look.equipment || {});
  return createModularCharacter({ appearance: look.appearance, outfit: [...parts, ...(look.extras || [])], tints: { ...tints, ...look.tints }, scale });
}
const playerModel = dressed({ ...PLAYER_DEFAULT, equipment: { weapon: 'rostiges_schwert', armor: 'reisekleidung', hands: 'armschienen', feet: 'wanderstiefel', cloak: 'reiseumhang' } });
scene.add(playerModel);
const playerAnimator = createAnimator(playerModel);
// The first-person arm wears the sleeve of the body garment.
function sleeveColor(equipment) {
  const armor = ITEMS[equipment.armor];
  if (!armor) return '#9a8f7a';
  for (const part of ['tunic', 'shirt', 'robe', 'dress']) if (armor.tints?.[part]) return armor.tints[part];
  if (armor.parts?.includes('chainmail')) return '#666d71';
  return armor.tints?.tabard ?? `#${(armor.color ?? 0x8a7f6a).toString(16).padStart(6, '0')}`;
}
// Gloves and bracers of the hands slot, by the modular parts they put on the body.
function handGear(equipment) {
  const item = ITEMS[equipment.hands], hex = `#${(item?.color ?? 0x37261b).toString(16).padStart(6, '0')}`;
  // Plate armour brings its own steel vambraces when no bracers are worn.
  const plate = ITEMS[equipment.armor]?.parts?.includes('plate') ? '#50565a' : null;
  return { glove: item?.parts?.includes('gloves') ? hex : null, bracer: item?.parts?.includes('bracers') ? hex : plate };
}
function itemStats() {
  return { damage: ITEMS[player.equipment.weapon]?.damage || 0, armor: Object.entries(player.equipment).reduce((sum, [slot, id]) => sum + (slot !== 'weapon' && ITEMS[id]?.armor || 0), 0) };
}

function playerDamageBonus() {
  return (player.attributes?.strength || 1) * 3 + (player.perks?.includes('schwertmeister') ? 12 : 0);
}

function playerMagicBonus() {
  return (player.attributes?.arcane || 1) * 5 + (player.perks?.includes('arkaner_fokus') ? 15 : 0) + (ITEMS[player.equipment.accessory]?.magic || 0);
}

function awardXP(amount) {
  const levels = gainExperience(player, amount);
  rpg.state.level = player.level; rpg.state.xp = player.xp;
  if (levels) toast('STUFENAUFSTIEG · STUFE ' + player.level + ' · PERK-PUNKT ERHALTEN', 5800);
}

const PERKS = {
  schwertmeister: { name: 'Schwertmeister', desc: '+12 Nahkampfschaden', apply() { player.perks.push('schwertmeister'); } },
  arkaner_fokus: { name: 'Arkaner Fokus', desc: '+15 Magieschaden', apply() { player.perks.push('arkaner_fokus'); } },
  eisernes_herz: { name: 'Eisernes Herz', desc: '+30 maximale Lebenspunkte', apply() { player.perks.push('eisernes_herz'); player.maxHp += 30; player.hp += 30; } },
  meisterschuetze: { name: 'Meisterschütze', desc: '+12 Bogenschaden', apply() { player.perks.push('meisterschuetze'); } },
  ruhige_hand: { name: 'Ruhige Hand', desc: 'Bogen 30 % schneller gespannt, kein Zittern bei Erschöpfung', apply() { player.perks.push('ruhige_hand'); } },
};
// Archery grows with use, like in Skyrim: every five arrows that strike flesh raise it by one, and
// each point adds to the bow's damage (systems/archery.js scored()).
let archeryHits = 0;
function trainArchery() {
  if ((player.skills.archery ??= 1) >= 50 || ++archeryHits < 5) return;
  archeryHits = 0; player.skills.archery++;
  toast(`BOGENSCHIESSEN STEIGT AUF ${player.skills.archery}`, 2600);
}

function unlockPerk(id) {
  if (!PERKS[id] || player.perkPoints <= 0 || player.perks.includes(id)) return;
  player.perkPoints--;
  PERKS[id].apply();
  toast('PERK ERHALTEN · ' + PERKS[id].name, 4000);
  saveGame(false);
}

function showPerkChoices(panel) {
  if (player.perkPoints <= 0) return;
  const choices = Object.keys(PERKS).filter(id => !player.perks.includes(id));
  if (!choices.length) return;

  panel.innerHTML = `<h3>Perk auswählen (${player.perkPoints})</h3>${choices.map(id => `<button data-perk="${id}">${PERKS[id].name}<br><small>${PERKS[id].desc}</small></button>`).join('')}`;

  panel.querySelectorAll('[data-perk]').forEach(btn => {
    btn.onclick = () => {
      unlockPerk(btn.dataset.perk);
      inventoryUI.render(); updateHUD();
    };
  });
}

function equipLoot(index) {
  const id = player.loot[index];
  if (inventory.equip(id)) {
    toast(ITEMS[id].name + ' ausgerüstet', 2500);
    inventoryChanged();
    if (game.modal === 'inventory') inventoryUI.render();
  }
}
const player = { position: v3(3, world.heightAt(3, 0), 0), yaw: 2.55, pitch: -.09, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, level: 1, xp: 0, perkPoints: 0, gold: 24, potions: 3, kills: 0, skills: { sword: 1, magic: 0, survival: 0 }, attributes: { strength: 1, arcane: 1, endurance: 1 }, perks: [], equipment: { weapon: 'rostiges_schwert', ranged: 'jagdbogen', armor: 'reisekleidung' }, loot: [], velocityY: 0, grounded: true, attack: 0, invuln: 0, magicCd: 0, tool: 0, mode: 'third', stride: 0 };
resetCharacter(player);
const keys = new Set();
// Touch controls (src/ui/touchControls.js), created with the settings at the end; touchMode follows the setting.
let touch = null, touchMode = false;
const tip = (desk, finger) => touchMode ? finger : desk;
const npcs = [
  { id: 'elira', name: 'Elira', role: 'DORFÄLTESTE', x: -7.1, z: 4.4, facing: -.2, trust: 0, mood: 'besorgt', memories: ['die erste Glutnacht', 'verlorene Dorfbewohner'], lines: ['Die Asche fällt wieder. Der letzte Glutstein beginnt zu erwachen.', 'Im Westen haben Plünderer unser Heiligtum entweiht. Ohne die Glut wird die Aschmark verstummen.'] },
  { id: 'bryn', name: 'Bryn', role: 'SCHMIED', x: 7.0, z: 7.0, facing: 2.0, trust: 0, mood: 'misstrauisch', memories: ['sein zerbrochenes Meisterschwert'], lines: ['Gutes Eisen erzählt die Wahrheit. Das hier riecht nach Krieg.', 'Nimm dich vor den Wölfen im Wald in Acht. Sie jagen inzwischen im Rudel.'] },
  { id: 'soren', name: 'Soren', role: 'WALDLÄUFER', x: -2.1, z: 19.2, facing: 1.2, trust: 0, mood: 'wachsam', memories: ['die alten Waldpfade'], lines: ['Westlich des Dorfs lagern Räuber. Drei habe ich gezählt.', 'Der steinerne Schrein liegt hinter dem östlichen Pass. Folge dem Weg.'] },
];

// Named people of the Hemland story (src/data/hemland/story.js). Homes are the interiors nearest
// their site; Iven, Ada, Severin and Albrecht hold their posts instead of following a routine.
const roomNear = (kinds, site, max = 260) => world.interiors.filter(r => kinds.includes(r.kind) && r.door)
  .map(r => ({ r, d: Math.hypot(r.door.position.x - site.x, r.door.position.z - site.z) })).filter(x => x.d < max).sort((a, b) => a.d - b.d)[0]?.r;
const poiIn = (room, kinds) => room?.pois.find(p => kinds.includes(p.kind));
const NAMED = [
  { id: 'innkeeper', name: 'Marta', role: 'WIRTIN', job: 'innkeeper', room: roomNear(['inn', 'tavern'], SITES.inn, 60), trader: true,
    appearance: { body: 'female', build: 'normal', skin: 2, hair: 'bun', hairColor: 4, eyes: 1, face: 'weathered' }, equipment: { armor: 'leinenkleid', feet: 'lederschuhe' }, tints: { dress: '#5a3a2a' } },
  { id: 'farmer', name: 'Grete', role: 'BÄUERIN', job: 'farmer', room: roomNear(['home'], SITES.farm_bridge, 60),
    appearance: { body: 'female', build: 'strong', skin: 3, hair: 'braid', hairColor: 2, eyes: 0, face: 'stern' }, equipment: { armor: 'bauernkleidung', feet: 'wanderstiefel' }, tints: { shirt: '#7a6a4a' } },
  { id: 'miller', name: 'Tamme', role: 'MÜLLER', job: 'miller', home: 'mill_work',
    appearance: { body: 'male', build: 'strong', skin: 1, hair: 'shaved', hairColor: 3, beard: 'full', eyes: 2, face: 'soft' }, equipment: { armor: 'schmiedekluft', feet: 'lederschuhe' }, tints: { shirt: '#c8bca8', pants: '#5a4f40' } },
  { id: 'guard_captain', name: 'Iven', role: 'HAUPTMANN DER KÖNIGSWACHE', at: { x: 1004, z: -756, facing: Math.PI },
    appearance: { body: 'male', build: 'strong', skin: 2, hair: 'short', hairColor: 1, beard: 'stubble', eyes: 3, face: 'stern' }, equipment: { weapon: 'waechterklinge', armor: 'wachpanzer', hands: 'lederhandschuhe', feet: 'wanderstiefel', cloak: 'roter_umhang' } },
  { id: 'priest', name: 'Ada', role: 'PRIESTERIN DES KRONENTEMPELS', at: poiIn(roomNear(['temple'], SITES.city), ['shrine']),
    appearance: { body: 'female', build: 'slim', skin: 0, hair: 'long', hairColor: 6, eyes: 4, face: 'calm' }, equipment: { armor: 'aeltestenrobe', feet: 'lederschuhe' }, tints: { robe: '#d8d2c0', shawl: '#4a5a6a' } },
  { id: 'steward', name: 'Severin', role: 'KÖNIGLICHER VOGT', at: (seat => seat && { x: seat.x + 2.2, z: seat.z + 1.4, facing: seat.facing })(poiIn(roomNear(['keep'], SITES.castle), ['seat'])),
    appearance: { body: 'male', build: 'slim', skin: 1, hair: 'ponytail', hairColor: 0, beard: 'moustache', eyes: 1, face: 'calm' }, equipment: { armor: 'aeltestenrobe', feet: 'lederschuhe' }, tints: { robe: '#2f2a3a', shawl: '#8a6a2a' } },
  { id: 'king', name: 'Albrecht', role: 'KÖNIG', at: poiIn(roomNear(['keep'], SITES.castle), ['seat']), pose: 'sit',
    appearance: { body: 'male', build: 'strong', skin: 2, hair: 'long', hairColor: 7, beard: 'full', eyes: 0, face: 'weathered' }, equipment: { armor: 'aeltestenrobe', feet: 'wanderstiefel', cloak: 'roter_umhang' }, tints: { robe: '#5e2224', shawl: '#c9a24a' } },
];
for (const n of NAMED) {
  const bed = n.room?.pois.find(p => p.kind === 'bed') || n.room?.pois[0], spot = n.at || bed || (n.home && world.pois.find(p => p.id === n.home)) || SITES[n.job === 'miller' ? 'mill' : 'village'];
  npcs.push({ id: n.id, storyId: n.id, name: n.name, role: n.role, x: spot.x, z: spot.z, facing: spot.facing ?? 0, trust: 0, mood: 'ruhig', memories: [], lines: [],
    trader: n.trader, pose: n.pose, staticPost: !!n.at, job: n.job, home: n.room?.house ?? n.home, workplace: n.job === 'innkeeper' ? n.room?.house : undefined, range: 120,
    look: { appearance: { ...n.appearance, name: n.name }, equipment: n.equipment, extras: [], tints: n.tints } });
}

// Travelers on the king's road: a pedlar, a pilgrim, a messenger and a road warden walk between
// Dämmerwald, the inn and Kronwacht, keep to the right and rest by the road now and then.
const KING_ROAD = ROADS.find(r => r.id === 'king').points;
const KING_LENGTH = KING_ROAD.slice(1).reduce((sum, q, i) => sum + Math.hypot(q[0] - KING_ROAD[i][0], q[1] - KING_ROAD[i][1]), 0);
function onKingRoad(s) {
  let d = clamp(s, 0, KING_LENGTH);
  for (let i = 1; i < KING_ROAD.length; i++) {
    const [ax, az] = KING_ROAD[i - 1], [bx, bz] = KING_ROAD[i], len = Math.hypot(bx - ax, bz - az);
    if (d <= len || i === KING_ROAD.length - 1) { const k = Math.min(1, d / len); return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, tx: (bx - ax) / len, tz: (bz - az) / len }; }
    d -= len;
  }
}
for (const [i, [id, name, role, job, equipment, extras]] of [
  ['wenna', 'Wenna', 'FAHRENDE HÄNDLERIN', 'merchant', { armor: 'leinenkleid', feet: 'wanderstiefel', cloak: 'reiseumhang' }, ['satchel']],
  ['anselm', 'Bruder Anselm', 'PILGER', 'priest', { armor: 'aeltestenrobe', feet: 'lederschuhe' }, []],
  ['kurt', 'Kurt', 'BOTE', 'townsfolk', { armor: 'reisekleidung', feet: 'wanderstiefel', cloak: 'reiseumhang' }, ['satchel']],
  ['ruprecht', 'Ruprecht', 'STRASSENWACHE', 'guard', { weapon: 'waechterklinge', armor: 'wachpanzer', head: 'wachhelm', feet: 'wanderstiefel' }, []],
].entries()) {
  const appearance = { ...randomAppearance(`traveler-${id}`), name, ...(id === 'wenna' ? { body: 'female' } : { body: 'male' }) };
  const s = KING_LENGTH * (.12 + i * .23), at = onKingRoad(s);
  npcs.push({ id, storyId: `city_${job}`, name, role, job, traveler: { s, dir: i % 2 ? -1 : 1, rest: 0 }, staticPost: true, trader: job === 'merchant',
    x: at.x, z: at.z, facing: 0, trust: 0, mood: 'ruhig', memories: [], lines: [], look: { appearance, equipment, extras, tints: id === 'anselm' ? { robe: '#6a6458', shawl: '#3a3a34' } : {} } });
}
// Each command post keeps a guard at its road barrier (updateBarriers below).
const BARRIER_GUARDS = { outpost_west: ['gerold', 'Gerold', 'male'], outpost_east: ['imke', 'Imke', 'female'] };
const barriers = [];
scene.traverse(o => { if (o.userData.barrier) barriers.push({ arm: o, collider: o.userData.collider, ...o.userData.barrier, open: 0, target: 0, quiet: 99, phase: 'wait', timer: 0 }); });
for (const b of barriers) {
  const frame = b.arm.parent; frame.updateWorldMatrix(true, false);
  const spot = ([x, z]) => frame.localToWorld(new THREE.Vector3(x, 0, z));
  b.idleAt = spot(b.idle); b.workAt = spot(b.work); b.roadAt = spot([3.85, 0]);
  // Facing convention: yaw = atan2(self − target) turns the model's front (−z) toward the target.
  b.idleYaw = Math.atan2(b.idleAt.x - b.roadAt.x, b.idleAt.z - b.roadAt.z);
  const weight = spot([-.55, 0]); b.workYaw = Math.atan2(b.workAt.x - weight.x, b.workAt.z - weight.z);
  const [id, name, body] = BARRIER_GUARDS[b.site] || [];
  if (!id) continue;
  const appearance = { ...randomAppearance(`barrier-${id}`), name, body };
  b.guard = { id, storyId: 'city_guard', name, role: 'SCHRANKENWACHE', job: 'guard', staticPost: true, x: b.idleAt.x, z: b.idleAt.z, facing: b.idleYaw, trust: 0, mood: 'ruhig', memories: [], lines: [],
    look: { appearance, equipment: { weapon: 'waechterklinge', armor: 'wachpanzer', head: 'wachhelm', feet: 'wanderstiefel' }, extras: [], tints: {} } };
  npcs.push(b.guard);
}
// Road barriers: when someone comes along the road the guard walks to the counterweight and swings
// the pole up, and lowers it again once the road has been quiet for a while. Without a guard to work
// it (dead, or talking to you) the pole still lifts, so the road can never trap anyone.
function walkTo(npc, to, dt) {
  const p = npc.model.position, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
  if (d < .06) return true;
  const step = Math.min(d, 1.6 * dt);
  p.x += dx / d * step; p.z += dz / d * step; p.y = world.heightAt(p.x, p.z); npc.x = p.x; npc.z = p.z;
  npc.model.rotation.y = Math.atan2(-dx, -dz);
  return false;
}
function updateBarriers(dt) {
  for (const b of barriers) {
    const near = (x, z) => Math.hypot(x - b.roadAt.x, z - b.roadAt.z) < 13;
    const someone = near(player.position.x, player.position.z) || npcs.some(n => n !== b.guard && !n.dead && n.model && near(n.model.position.x, n.model.position.z));
    b.quiet = someone ? 0 : b.quiet + dt;
    const want = someone ? 1 : b.quiet > 6 ? 0 : b.target, g = b.guard;
    if (!g || g.dead || g === talkingNPC) b.target = want;
    else switch (b.phase) {
      case 'wait': if (want !== b.target) { b.phase = 'go'; b.next = want; } break;
      case 'go': if (walkTo(g, b.workAt, dt)) { b.phase = 'work'; b.timer = 0; g.model.rotation.y = b.workYaw; } break;
      case 'work':
        b.timer += dt; g.pose = 'operate';
        if (b.timer > .45) b.target = b.next;
        if (b.timer > 2) { g.pose = null; b.phase = 'back'; }
        break;
      case 'back': if (walkTo(g, b.idleAt, dt)) { b.phase = 'wait'; g.model.rotation.y = b.idleYaw; g.facing = b.idleYaw; } break;
    }
    // The pole swings with a little weight to it; it only stops blocking once it is well up.
    b.open += (b.target - b.open) * (1 - Math.exp(-dt * 2.2));
    b.arm.rotation.z = b.open * 1.32;
    b.collider.disabled = b.open > .5;
  }
}
function updateTravelers(dt) {
  for (const npc of npcs) {
    const t = npc.traveler; if (!t || npc === talkingNPC) continue;
    if (t.rest > 0) { t.rest -= dt; npc.pose = null; continue; }
    t.s += t.dir * 1.25 * dt;
    if (t.s < 0 || t.s > KING_LENGTH) { t.dir *= -1; t.s = clamp(t.s, 0, KING_LENGTH); t.rest = 6 + Math.random() * 8; }
    else if (Math.random() < dt * .004) t.rest = 8 + Math.random() * 10;
    const at = onKingRoad(t.s), side = 1.7;
    const x = at.x - at.tz * side * t.dir, z = at.z + at.tx * side * t.dir;
    npc.model.position.set(x, world.heightAt(x, z), z); npc.x = x; npc.z = z;
    npc.model.rotation.y = Math.atan2(-at.tx * t.dir, -at.tz * t.dir);
  }
}

// Kronwacht's citizens come from the city's houses, barracks, temple and tavern.
npcs.push(...createCitizens(world.interiors, { center: world.landmarks.city, radius: 240, seed: 7 }));
for (const npc of npcs) npc.storyId ??= npc.citizen ? `city_${npc.job}` : npc.id;
// Who sells: Bryn, Marta and the city's merchants, smith and innkeeper.
for (const npc of npcs) npc.trader ??= npc.id === 'bryn' || ['merchant', 'smith', 'innkeeper'].includes(npc.job);

// Persistent relationship layer: NPCs remember important player actions.
// This gives the world RPG-like reactions instead of static quest vendors.
const relationship = Object.fromEntries(npcs.map(npc => [npc.id, { trust: 0, met: false, gifts: 0, memories: [] }]));

// Persistent NPC memory system: important player actions survive during the session.
// This allows future quests and dialogues to react to previous choices.
function npcMemory(id, event) {
  const state = relationship[id];
  const npc = npcs.find(n => n.id === id);
  if (!state || !npc) return;
  state.memories ??= [];
  if (!state.memories.includes(event)) state.memories.push(event);
}

function npcTrustLine(npc) {
  const value = relationship[npc.id]?.trust ?? 0;
  if (value >= 50) return 'Du hast bewiesen, dass dein Wort etwas bedeutet.';
  if (value <= -30) return 'Ich weiß nicht, ob ich dir noch vertrauen kann.';
  return npc.lines[0];
}

function affectNPC(id, amount, reason = '') {
  const state = relationship[id];
  const npc = npcs.find(n => n.id === id);
  if (!state || !npc) return;
  state.trust = THREE.MathUtils.clamp(state.trust + amount, -100, 100);
  npc.trust = state.trust;
  npcMemory(id, reason || 'Begegnung');
  if (reason) toast(`${npc.name}: ${reason}`);
}
for (const npc of npcs) {
  const look = npc.look || NPC_LOOKS[npc.id];
  npc.model = dressed(look, npc.scale ?? (npc.id === 'elira' ? .97 : 1.03));
  if (look.weaponModel) equipItem(npc.model, look.weaponModel);
  npc.animator = createAnimator(npc.model);
  npc.model.position.set(npc.x, world.heightAt(npc.x, npc.z), npc.z);
  npc.model.rotation.y = npc.facing;
  scene.add(npc.model);
}

const enemies = [
  // The plunderers' camp lies far west in the autumn forest (hemland.js SITES.camp); wolves roam the woods.
  { kind: 'bandit', name: 'Aschenplünderer', x: -325.8, z: 151.9, hp: 80, maxHp: 80, shield: true },
  { kind: 'bandit', name: 'Aschenplünderer', x: -333.5, z: 145.4, hp: 80, maxHp: 80, archer: true },
  { kind: 'bandit', name: 'Plündererhauptmann', x: -328.8, z: 141.5, hp: 130, maxHp: 130 },
  { kind: 'wolf', name: 'Aschenwolf', x: -205, z: -62, hp: 55, maxHp: 55 },
  { kind: 'wolf', name: 'Aschenwolf', x: 150, z: -96, hp: 55, maxHp: 55 },
];
for (const e of enemies) {
  e.home = v3(e.x, 0, e.z); e.calm = e.kind === 'bandit';
  if (e.name === 'Plündererhauptmann') { e.storyId = 'bandit_captain'; e.name = 'Rauk'; }
  e.look = e.kind === 'bandit' ? banditLook(enemies.indexOf(e), !!e.storyId) : null;
  if (e.archer) archerLook(e.look);
  e.model = e.look ? dressed(e.look) : createCharacter('wolf', { scale: 1.3 });
  if (e.look?.equipment.weapon) equipItem(e.model, WEAPON_MODELS[e.look.equipment.weapon]);
  e.model.position.set(e.x, world.heightAt(e.x, e.z), e.z);
  scene.add(e.model);
  e.animator = createAnimator(e.model);
  e.cooldown = Math.random() * 1.5; e.stride = 0; e.dead = false;
}
// ── HUMANITY AI (systems/ai): every enemy is a person (or a wolf) with senses, a temperament, fears
// and a day. Camp members keep a routine and warn before they fight; road thieves may ask for a toll;
// whoever yields can be robbed or let go, and a spared face may turn up again on the road.
const barks = createBarks(camera);
const ai = createAIManager({
  world: { heightAt: world.heightAt, blocked: (x, z, r) => world.blocked(x, z, r), segmentBlocked: world.segmentBlocked, near: (x, z, r) => world.collidersNear(x, z, r) },
  hooks: {
    say: (npc, text) => { if (npc.model.position.distanceTo(player.position) < 34) barks.say(npc.model, text); },
    provoke: brain => brain.group === 'camp' ? provokeCamp() : bandTurns(brain.group),
    enemyOf: brain => !brain.npc.calm,
    faction: () => ({ fire: game.flags.ai_fire || 0, bow: game.flags.ai_bow || 0, cruel: !!game.flags.ai_cruel, spared: game.flags.ai_spared || 0 }),
    // What survivors tell the others about the wanderer.
    learn: seen => { for (const k of seen) if (k === 'cruel') game.flags.ai_cruel = true; else if (k === 'fire' || k === 'bow') game.flags[`ai_${k}`] = Math.min(9, (game.flags[`ai_${k}`] || 0) + 1); },
  },
});
const campRole = e => e.storyId ? 'leader' : e.archer ? 'archer' : 'melee';
const CAMP_NAMES = ['Bodo', 'Hilde'];
function brainFor(e, i) {
  if (e.kind !== 'wolf' && !e.storyId) e.personName ??= CAMP_NAMES[i];
  if (e.kind === 'wolf') return ai.attach(e, { group: `wolf_${i}`, id: `Wolf_${i}`, seed: 500 + i, archetype: 'wolf' });
  return ai.attach(e, { group: 'camp', id: e.storyId ? 'Rauk' : e.personName, seed: 300 + i * 17, archetype: e.storyId ? 'leader' : e.archer ? 'archer' : e.shield ? 'shieldbearer' : 'veteran',
    territorial: true, story: !!e.storyId, noSurrender: !!e.storyId, schedule: campSchedule(SITES.camp, world.heightAt, campRole(e)) });
}
enemies.forEach(brainFor);
/** A new game or a load: the same people again, fresh in mind (same seeds, same temperaments). */
function rebrain() { enemies.forEach((e, i) => { if (e.transient || e.settler !== undefined) return; e.gone = false; ai.detach(e); brainFor(e, i); }); }
function bandTurns(group) { for (const e of enemies) if (e.ai?.group === group && !['pacified', 'grateful'].includes(e.ai.hostility)) e.calm = false; }
function provokeCamp() {
  if (game.flags.captain_hostile) return;
  game.flags.captain_hostile = true;
  for (const e of enemies) if (e.ai?.group === 'camp' && !['pacified', 'grateful'].includes(e.ai.hostility)) e.calm = false;
  toast('DAS LAGER GREIFT AN', 2600);
}
// Spared road thieves are remembered (name, face, temperament) and may be met again.
const PERSON_NAMES = ['Jorek', 'Ulla', 'Bertram', 'Ilse', 'Hagen', 'Wenzel', 'Mareike', 'Oswin', 'Liesl', 'Tamo'];
function sparedPeople() { return [0, 1, 2, 3].map(i => game.flags[`ai_sp${i}`]).filter(Boolean).map(s => { const [name, look, seed] = s.split('|'); return { name, look: +look, seed: +seed }; }); }
function rememberSpared(e) {
  const list = sparedPeople().filter(p => p.name !== e.personName).slice(-3);
  list.push({ name: e.personName, look: e.lookIndex, seed: e.ai.personality.seed });
  list.forEach((p, i) => { game.flags[`ai_sp${i}`] = `${p.name}|${p.look}|${p.seed}`; });
}

// Animals around the wanderer (systems/wildlife.js); they keep away from towns and farms.
const ambientFx = createAmbientFx(scene, { heightAt: world.heightAt, biomeWeights, waterLevel: WATER_LEVEL });
const ambientSun = v3(0, 1, 0);
// Prints in sand, road dust, mud and snow (world/tracks.js), left by everyone walking near the wanderer.
const tracks = createTracks(scene, { heightAt: world.terrainHeightAt, groundAt: world.groundAt });
const PAWS = { wolf: 'paw', fox: 'paw', hare: 'paw', deer: 'hoof' };
function leaveTracks(dt) {
  const near = p => Math.abs(p.x - player.position.x) < 40 && Math.abs(p.z - player.position.z) < 40;
  if (!player.fly) tracks.step(player, player.position.x, player.position.y, player.position.z, 'boot');
  for (const n of npcs) if (n.model.visible && near(n.model.position)) tracks.step(n, n.model.position.x, n.model.position.y, n.model.position.z, 'boot');
  for (const e of enemies) if (!e.dead && e.model.visible && near(e.model.position)) tracks.step(e, e.model.position.x, e.model.position.y, e.model.position.z, PAWS[e.kind] || 'boot'); else tracks.forget(e);
  for (const an of wildlife.animals) if (!an.dead && PAWS[an.kind] && near(an.group.position)) tracks.step(an, an.group.position.x, an.group.position.y, an.group.position.z, PAWS[an.kind]); else tracks.forget(an);
  tracks.update(dt);
}
const wildlife = createWildlife(scene, { heightAt: world.heightAt, biomeAt: biomeWeights, waterLevel: WATER_LEVEL,
  ragdoll: (model, impulse) => createCreatureRagdoll(physics, model, { impulse }),
  avoid: (x, z) => ['village', 'city', 'castle', 'inn', 'camp', 'mill', 'farm_bridge', 'farm_east', 'farm_north', 'shrine'].some(id => world.field.siteDistance(id, x, z) < 25) });
// Random encounters in the wild: a wolf pack, or at night two road thieves. They come from behind
// and are gone again once you are far away.
// An archer's kit: the hunting bow instead of the blade, and a quiver on the back.
// A hedge-witch: ash-dark robe and hood, the staff in hand; no blade.
function mageLook(index) {
  return { appearance: banditLook(index).appearance, equipment: { armor: 'aeltestenrobe', head: 'kapuze', feet: 'lederschuhe' }, tints: { robe: '#2a2420', shawl: '#6a2a1a', hood: '#1c1a18' }, extras: ['satchel'] };
}
function archerLook(look) {
  look.equipment = { ...look.equipment, ranged: 'jagdbogen' };
  look.extras = [...(look.extras || []), 'quiver'];
}
let encounterGroup = 0;
function spawnEnemy(kind, x, z, known = null, role = null) {
  const wolf = kind === 'wolf', e = { kind, name: wolf ? 'Grauwolf' : known ? known.name : role === 'mage' ? 'Aschenhexer' : 'Wegelagerer', x, z, hp: wolf ? 55 : role === 'mage' ? 60 : 80, maxHp: wolf ? 55 : role === 'mage' ? 60 : 80, transient: true };
  if (role === 'mage') e.mage = true; else if (role === 'shield') e.shield = true;
  e.home = v3(x, 0, z); e.calm = false;
  e.lookIndex = known ? known.look : 1 + Math.floor(Math.random() * 3);
  e.personName = known ? known.name : PERSON_NAMES[Math.floor(Math.random() * PERSON_NAMES.length)];
  e.look = wolf ? null : e.mage ? mageLook(e.lookIndex) : banditLook(e.lookIndex);
  // About one road thief in three carries a bow besides the blade; more once word of your bow spreads.
  if (!wolf && !known && !role && Math.random() < .35 + Math.min(.2, (game.flags.ai_bow || 0) * .05)) { e.archer = true; archerLook(e.look); }
  e.model = e.look ? dressed(e.look) : createCharacter('wolf', { scale: 1.15 + Math.random() * .25 });
  if (e.look?.equipment.weapon) equipItem(e.model, WEAPON_MODELS[e.look.equipment.weapon]);
  e.model.position.set(x, world.heightAt(x, z), z); scene.add(e.model);
  e.animator = createAnimator(e.model); e.cooldown = 1 + Math.random(); e.stride = 0; e.dead = false;
  enemies.push(e);
  const r = Math.random(), archetype = wolf ? 'wolf' : e.mage ? 'mage' : e.shield ? 'shieldbearer' : e.archer ? 'archer' : r < .55 ? 'rogue' : r < .75 ? 'veteran' : r < .9 ? 'berserker' : 'leader';
  ai.attach(e, { group: `enc_${encounterGroup}`, id: wolf ? `Grauwolf_${enemies.length}` : `${e.personName}`, seed: known ? known.seed : Math.floor(Math.random() * 1e9), archetype, transient: true });
  if (known) { e.ai.hostility = 'grateful'; e.calm = true; }
  return e;
}
let encounterIn = 120;
function updateEncounters(dt) {
  for (const e of [...enemies]) if (e.transient && e.model.position.distanceTo(player.position) > 170) {
    ai.detach(e); e.bow?.dispose(); e.dropped?.removeFromParent();
    e.ragdoll?.dispose(); e.model.removeFromParent(); enemies.splice(enemies.indexOf(e), 1);
  }
  if ((encounterIn -= dt) > 0 || player.fly) return;
  encounterIn = 110 + Math.random() * 140;
  const p = player.position;
  if (['village', 'city', 'castle', 'inn', 'camp', 'farm_bridge', 'farm_east', 'farm_north', 'mill'].some(id => world.field.siteDistance(id, p.x, p.z) < 90)) return;
  if (enemies.some(e => e.transient && !e.dead)) return;
  const night = worldClock.hour < 5.5 || worldClock.hour > 20.5, a = player.yaw + (Math.random() - .5) * 1.4;
  const cx = p.x + Math.sin(a) * 34, cz = p.z + Math.cos(a) * 34;
  if (world.heightAt(cx, cz) < WATER_LEVEL + .5) return;
  const bandits = night ? Math.random() < .7 : Math.random() < .2;
  encounterGroup++;
  // Sometimes one of them is somebody you once let go.
  const people = bandits ? sparedPeople() : [], known = people.length && Math.random() < .35 ? people[Math.floor(Math.random() * people.length)] : null;
  const party = [];
  const roles = bandits ? [null, Math.random() < .25 + Math.min(.2, (game.flags.ai_bow || 0) * .05) ? 'shield' : null, night && Math.random() < .25 ? 'mage' : null].filter((r, i) => i < 2 || r) : [];
  for (let i = 0; i < (bandits ? roles.length : 2 + Math.floor(Math.random() * 2)); i++) party.push(spawnEnemy(bandits ? 'bandit' : 'wolf', cx + (Math.random() - .5) * 6, cz + (Math.random() - .5) * 6, i === 0 ? known : null, bandits && i > 0 ? roles[i] : null));
  // A greedy, confident pair may first ask for a toll instead of fighting.
  if (bandits && !known && party.some(e => e.ai.traits.greed > .55 && e.ai.traits.confidence > .45) && Math.random() < .5)
    for (const e of party) { e.ai.hostility = 'demanding'; e.ai.demandUntil = ai.time + 18; }
}

const game = { started: false, paused: true, modal: null, cinematic: null, cinematicTime: 0, quest: 'm_elira', flags: {}, voice: true, toastTime: 0, lastSave: 0 };
const inventory = createInventory(player, rpg, game);
const dropBagMeshes = new Map();
const chestPosition = world.landmarks.chest ?? new THREE.Vector3(-1, 0, 13);
const inventoryUI = createInventoryUI({
  root: $('inventory'), player, inventory,
  onChange: inventoryChanged, onClose: closeInventory, onPerks: showPerkChoices,
  onHeal: () => {
    if (player.potions < 1 || player.hp >= player.maxHp) return {ok:false,message:'Keine Heilung nötig oder kein Heiltrank vorhanden.'};
    applyHeal();
    return {ok:true,message:'Heiltrank getrunken.'};
  },
});

function makeDropBagMesh() {
  const group = new THREE.Group();
  blockOn(group, .5, .34, .4, 'clothLinen', 0, 0, 0);
  blockOn(group, .3, .14, .26, 'clothLinen', 0, .34, 0);
  blockOn(group, .34, .06, .3, 'darkPlanks', 0, .3, 0);
  return group;
}
function syncDropBags() {
  player.drops = player.drops.filter(bag => Object.values(bag.items).some(n => n > 0));
  for (const [id, mesh] of dropBagMeshes) {
    if (player.drops.some(bag => bag.id === id)) continue;
    scene.remove(mesh);
    dropBagMeshes.delete(id);
  }
  for (const bag of player.drops) {
    if (!dropBagMeshes.has(bag.id)) {
      const mesh = makeDropBagMesh(); scene.add(mesh); dropBagMeshes.set(bag.id, mesh);
    }
    dropBagMeshes.get(bag.id).position.set(bag.x, world.heightAt(bag.x, bag.z), bag.z);
  }
}
function inventoryChanged() {
  syncDropBags(); syncCorpses(); updateHUD(); updateInteractions(); saveGame(false);
}
function openInventory(mode = 'inventory') {
  let context = typeof mode === 'string' ? {kind:mode} : {...mode};
  if (context.kind === 'stash') context = {kind:'container',name:'Reisetruhe',items:player.stash};
  else if (context.kind === 'take') {
    const bag = player.drops.find(b => b.id === context.id) ?? player.drops[0];
    if (!bag) return;
    context = {kind:'take',name:'Abgelegter Beutel',items:bag.items};
  } else if (context.kind === 'corpse') context = {kind:'take',name:context.enemy.name,items:context.enemy.loot};
  else if (context.kind === 'chest') context = {kind:'take',name:'Truhe',items:context.spot.items};
  else if (context.kind === 'merchant') context.name = 'Bryn · Schmiede';
  setModal('inventory', context);
}
function closeInventory() { setModal(null); }

// Living world: daily routines from systems/npcLife.js. Homes are the houses'
// interiors (beds, tables, hearths); work and free time happen around the village.
const worldClock = { hour: 8 };
const NPC_JOBS = { elira: { job: 'elder', home: 3 }, bryn: { job: 'smith', home: 1, workplace: 'anvil' }, soren: { job: 'ranger', home: 0 } };
const life = createNpcLife({ blocked: (x, z, r = .32, y) => world.blocked(x, z, r, y ?? world.heightAt(x, z)), navBlocked: world.navBlocked, heightAt: world.heightAt,
  routes: world.routePoints.map(route => route.map(p => ({ x: p.x, z: p.z }))), seed: 11 });
life.addPOIs([
  ...world.interiors.flatMap(room => room.pois.map((poi, i) => ({ ...poi, id: `h${room.house}_${poi.kind}_${i}`, house: room.house }))),
  ...world.doors.map(door => ({ id: `h${door.house}_door`, kind: 'door', x: door.outside.x, z: door.outside.z, facing: 0, house: door.house })),
  { id: 'anvil', kind: 'workstation', ...world.landmarks.anvil, job: 'smith' }, { id: 'forge', kind: 'workstation', x: 4.9, z: 7.6, facing: 2.6, job: 'smith' },
  { id: 'well', kind: 'well', x: -1.2, z: 8.2, facing: -1.6 }, { id: 'shrine_steps', kind: 'shrine', x: world.landmarks.shrine.x, z: world.landmarks.shrine.z + 4.5, facing: Math.PI },
  { id: 'square', kind: 'idle_spot', x: -6.5, z: 5, facing: .4 }, { id: 'lantern', kind: 'idle_spot', x: 8.5, z: 11.2, facing: 2 },
  { id: 'woodpile', kind: 'woodpile', x: -21.6, z: -1.8, facing: 1.9, job: 'ranger' },
  { id: 'patrol_n', kind: 'patrol', x: -12, z: 30, facing: 0, job: 'ranger' }, { id: 'patrol_w', kind: 'patrol', x: -26, z: 12, facing: 1.6, job: 'ranger' },
  { id: 'patrol_s', kind: 'patrol', x: 10, z: -8, facing: 3, job: 'ranger' },
  // Site POIs (markets, wells, patrols, fields); house-bound ones come from world.interiors above.
  ...world.pois.filter(p => !p.house && p.id && p.kind && Number.isFinite(p.x) && Number.isFinite(p.z)).map(p => p.kind === 'market' ? { capacity: 1, ...p } : p),
  ...townSpots(world.pois, { center: world.landmarks.city }),
]);
for (const npc of npcs) if (!npc.staticPost) life.addNPC({ id: npc.id, ...(NPC_JOBS[npc.id] || { job: npc.job, home: npc.home, workplace: npc.workplace, range: npc.range }) });
life.skipTo(worldClock.hour);
const ACTIVITY_EXPRESSION = { talk: 'happy', greet: 'happy', sleep: 'sleep', pray: 'sad', flee: 'surprised' };
let barkTimer = 0;
function updateNPCSimulation(dt) {
  const hourBefore = worldClock.hour;
  worldClock.hour = (worldClock.hour + dt * .08) % 24;
  if (worldClock.hour < hourBefore) game.flags.ai_day = (game.flags.ai_day || 0) + 1;
  life.update(dt, { hour: worldClock.hour, player: { x: player.position.x, z: player.position.z },
    events: enemies.filter(e => !e.dead && e.windup > 0 && e.model.position.distanceTo(player.position) < 20).map(e => ({ type: 'combat', x: e.model.position.x, z: e.model.position.z })) });
  for (const npc of npcs) {
    if (npc === talkingNPC) continue;
    const state = life.get(npc.id); if (!state) continue;
    npc.life = state;
    npc.model.position.set(state.x, state.activity === 'sleep' || state.activity === 'sit' ? state.y ?? world.heightAt(state.x, state.z) : motion.standY(state.x, state.z, npc.model.position.y), state.z);
    const facing = state.activity === 'sleep' ? state.facing + Math.PI : state.facing;
    const turn = THREE.MathUtils.euclideanModulo(facing - npc.model.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    npc.model.rotation.y += state.activity === 'sleep' || state.activity === 'sit' ? turn : clamp(turn, -dt * 5, dt * 5);
    // Lying down rotates the body about the feet; shift it so the sleeper is centred on the mattress.
    if (state.activity === 'sleep') { const y = npc.model.rotation.y; npc.model.position.x -= Math.sin(y) * 1.1; npc.model.position.z -= Math.cos(y) * 1.1; }
    npc.expression = ACTIVITY_EXPRESSION[state.activity] || 'neutral';
    if (state.door) { const door = world.doors.find(d => `h${d.house}_door` === state.door); if (door) { door.target = 1; door.closeAt = performance.now() + 4000; } }
    npc.x = state.x; npc.z = state.z;
    // Ambient lines show as a subtitle when the player is close enough to hear them.
    if (state.bark && state.bark !== npc.lastBark && npc.model.position.distanceTo(player.position) < 9) { showBark(npc, state.bark); npc.lastBark = state.bark; }
  }
  for (const door of world.doors) if (door.closeAt && performance.now() > door.closeAt && !npcs.some(n => n.model.position.distanceTo(door.position) < 1.6) && player.position.distanceTo(door.position) > 1.6) { door.target = 0; door.closeAt = 0; }
  barkTimer = Math.max(0, barkTimer - dt);
  if (barkTimer <= 0 && !game.modal) show('subtitle', false);
}
function showBark(npc, line) {
  if (game.modal || game.cinematic || !settings.subtitles) return;
  $('subtitle').textContent = `${npc.name}: ${line}`; show('subtitle', true); barkTimer = 3.2;
  if (!voiceStatus().playing) speech(line, npc.id);
}
const MAIN_STAGES = STORY.QUESTS.main, stageOf = id => MAIN_STAGES.find(stage => stage.id === id);
const firstPerson=createFirstPerson();
// Game animals can be struck too; a kill gives a little experience and a carcass to search.
const prey = { targets: (radius = 30) => wildlife.targets(player.position, radius), hit: (animal, amount) => {
  if (!wildlife.hurt(animal, Math.round(amount), player.position)) return;
  awardXP(animal.def.xp);
  toast(`${animal.name.toUpperCase()} ERLEGT · +${animal.def.xp} EP`); } };
// ── HUMANITY MOTION (systems/motion/, README there): one body rule for the wanderer and every person.
const motion = createMotion({ world, physics, createRagdoll, hooks: { event: (...args) => motionEvent(...args), wantsFree: (t, h, g) => motionWantsFree(t, h, g) } });
const combat=createCombat({scene,camera,player,enemies,world,prey,ai,onHit:damageEnemy,onHurt:hurt,onHeal:applyHeal,
  motion:{impact:(e,info)=>enemyImpact(e,info),playerHit:(e,info)=>playerImpact(e,info),grapple:(e,kind)=>enemyGrapple(e,kind),handles:e=>!!motion.get(e.model)},
  weaponDamage:()=>itemStats().damage+playerDamageBonus(),magicDamage:()=>39+playerMagicBonus(),toast,
  // The hunting bow (systems/archery.js): arrows from the satchel, damage by bow and draw.
  bow:{ammo:{count:()=>player.satchel.pfeil||0,use:()=>inventory.remove('pfeil'),add:n=>{inventory.add('pfeil',n);updateHUD();}},
    damage:power=>((ITEMS[player.equipment.ranged]?.damage||0)+playerDamageBonus()*.6+((player.skills.archery||1)-1)*1.2+(player.perks.includes('meisterschuetze')?12:0))*(.3+.7*power),
    drawTime:()=>player.perks.includes('ruhige_hand')?.7:1,steady:()=>player.perks.includes('ruhige_hand'),scored:()=>trainArchery(),aim:(origin,direction)=>bowAim(origin,direction),arrowModel:()=>heldItem('arrow')},
  // Third person casts from the real left hand; first person from the view-model palm.
  getCastOrigin:out=>player.mode==='third'&&playerModel.userData.rig?.hand_left?playerModel.userData.rig.hand_left.getWorldPosition(out)
    :out.copy(player.position).add(v3(-Math.cos(player.yaw)*.34-Math.sin(player.yaw)*.7,1.73+Math.sin(player.pitch)*.7,Math.sin(player.yaw)*.34-Math.cos(player.yaw)*.7)),
  // Fire blasts shove loose props and corpses.
  onImpact:(point,direction,radius)=>{
    const shove=(body,mass)=>{const p=body.translation(),d=Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z);if(d>=radius)return;
      const force=Math.min(mass,30)*4*(1-d/radius);body.applyImpulse({x:direction.x*force,y:Math.max(.35,direction.y)*force,z:direction.z*force},true);};
    for(const {body,mass} of physics.props.values())shove(body,mass);
    for(const ragdoll of physics.ragdolls)for(const part of ragdoll.parts)shove(part.body,.35);
  }});
let talkingNPC=null,dialogCamReady=false;
const saveKey = 'ashen-realms-save-v1';
const isVisible = (id) => !$(id).classList.contains('hidden');
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);

function toast(message, duration = 3900, kind = '') {
  const el = document.createElement('div'); el.className = kind ? `toast ${kind}` : 'toast'; el.textContent = message;
  $('toast-container').append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; setTimeout(() => el.remove(), 500); }, duration);
}
function speech(text, speaker = null) {
  if (!game.voice) { stopVoice(); return; }
  void speakLine(text, speaker);
}
function objective() { $('objective').textContent = game.quest ? stageOf(game.quest)?.objective ?? '' : 'Die Aschmark kommt zur Ruhe. Vorerst.'; }
function changeQuest(id) {
  if (id === game.quest) return;
  game.quest = id; objective(); updateJournal(); saveGame(false);
  toast(id ? `${stageOf(id).title.toUpperCase()} · ${stageOf(id).objective}` : 'KAPITEL ABGESCHLOSSEN · A JOURNEY THROUGH HEMLAND', 5300);
}
function saveGame(notify = true) {
  try {
    localStorage.setItem(saveKey, encodeSave(player, game, enemies, relationship, worldClock.hour, rpg.state));
    game.lastSave = performance.now(); show('continue', true);
    if (notify) toast('SPIEL GESPEICHERT');
  } catch (err) { if (notify) toast('Speichern nicht möglich'); console.warn(err); }
}
function loadGame() {
  try {
    const data = normalizeSave(JSON.parse(localStorage.getItem(saveKey))); if (!data) return false;
    resetGame(false);
    Object.assign(player, data.player);
    player.position.fromArray(data.position);
    if (world.blocked(player.position.x, player.position.z)) player.position.set(3, 0, 0);
    player.position.y = world.heightAt(player.position.x, player.position.z);
    player.yaw = data.yaw; player.pitch = data.pitch; player.mode = data.perspective; snapPlayerView();
    game.quest = data.quest; game.flags = data.flags; worldClock.hour = data.hour; life.skipTo(data.hour);
    Object.assign(relationship, data.relationships);
    rpg.restore(data.rpg); rpg.state.level = player.level; rpg.state.xp = player.xp;
    data.enemies.forEach((state, i) => { const e = enemies[i]; if (!e) return; e.hp = Math.min(e.maxHp, state.hp); e.dead = state.dead || e.hp <= 0; e.loot = e.dead ? state.loot ?? corpseLoot(e) : null; if (state.ai) ai.restore(e, state.ai); });
    syncCorpses();
    for (const e of enemies) if (e.dead && !e.ragdoll) { e.animator.update(.016, {}); e.ragdoll = e.kind === 'bandit' ? createRagdoll(physics, e.model, { impulse: v3(0, 0, 8) }) : createCreatureRagdoll(physics, e.model); }
    combat.restore();
    syncDropBags(); updateHUD();
    if (game.modal === 'inventory') inventoryUI.open();
    for (const e of enemies) e.calm = e.kind === 'bandit' && !game.flags.captain_hostile || ['pacified', 'grateful'].includes(e.ai?.hostility);
    if (game.flags.soren_dead) sorenDies(false);
    restoreSettlers();
    if (game.flags.camp_state === 'resettled') buryOldCamp();
    for (const e of enemies) if (e.gone) e.model.visible = false;
    return true;
  } catch (err) { console.warn('Save corrupted:', err); return false; }
}
function resetGame(clearSave = true) {
  motion.reset();
  for (const e of enemies) {
    e.ragdoll?.dispose(); e.ragdoll = null; e.loot = null;
    // Bones keep the ragdoll pose; restore the rest pose and the full outfit.
    for (const bone of Object.values(e.model.userData.rig)) if (bone.userData.rest) { bone.position.copy(bone.userData.rest.position); bone.quaternion.copy(bone.userData.rest.quaternion); }
    if (e.look && e.model.userData.corpseKey) { const { parts, tints } = outfitFor(e.look.equipment); restyleCharacter(e.model, { outfit: [...parts, ...(e.look.extras || [])], tints }); e.model.userData.corpseKey = null; if (e.look.equipment.weapon) equipItem(e.model, WEAPON_MODELS[e.look.equipment.weapon]); }
  }
  physics.release();
  resetCharacter(player); rpg.reset(); keys.clear(); combat.reset(); firstPerson.reset(); talkingNPC=null;
  syncDropBags();
  if (game.modal === 'inventory') inventoryUI.open();
  stopVoice(); game.cinematic = null; game.cinematicTime = 0;
  $('cinematic').classList.remove('active'); show('subtitle', false);
  player.position.set(3, world.heightAt(3, 0), 0); player.yaw = 2.55; player.pitch = -.09; snapPlayerView();
  Object.assign(player, { velocityY: 0, grounded: true, attack: 0, invuln: 0, magicCd: 0, tool: 0, stride: 0, mode: 'third' });
  game.quest = 'm_elira'; game.flags = {}; game.lastSave = performance.now(); worldClock.hour = 8; life.skipTo(8);
  for (const e of enemies) e.calm = e.kind === 'bandit';
  rebrain(); restoreSettlers();
  enemies.forEach(e => { e.hp = e.maxHp; e.dead = false; e.buried = false; e.model.visible = true; e.cooldown = 1.5; e.stride = 0; e.model.position.set(e.home.x, world.heightAt(e.home.x, e.home.z), e.home.z); });
  npcs.forEach(npc => {
    npc.trust = 0;
    relationship[npc.id] = { trust: 0, met: false, gifts: 0, memories: [] };
  });
  for (const p of particles) { scene.remove(p.mesh); p.mesh.material.dispose(); }
  particles.length = 0;
  if (clearSave) { try { localStorage.removeItem(saveKey); } catch { /* Storage unavailable. */ } show('continue', false); }
  updatePlayer(0); updateCamera(1); objective(); updateHUD(); updateInteractions();
}

function lockPointer() { if (!touchMode && !game.paused && !game.modal && !game.cinematic && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.().catch(() => {}); }
function unlockPointer() { if (document.pointerLockElement) document.exitPointerLock?.(); }
function syncPresentation() {
  const cinematic=!!game.cinematic,dialog=game.modal==='dialog';
  document.body.classList.toggle('in-cinematic',cinematic);
  document.body.classList.toggle('in-dialog',dialog);
  show('hud',game.started&&!cinematic&&!dialog);
  show('reticle',game.started&&!game.paused&&!cinematic&&!dialog);
  const thumbs=touchMode&&game.started&&!game.paused&&!cinematic&&!dialog;
  if(thumbs&&touch&&!touch.visible&&!touchHelpShown){touchHelpShown=true;toast('LINKS ZIEHEN: GEHEN · WEITER ZIEHEN: SPRINTEN · RECHTS WISCHEN: UMSEHEN · AUF EINER GEHALTENEN TASTE WISCHEN: ZIELEN',6500);}
  touch?.setVisible(thumbs);
}
let touchHelpShown=false;
function setModal(id, inventoryContext) {
  keys.clear();combat.setGuard(false);
  const closingInventory = game.modal === 'inventory' && id !== 'inventory';
  if (closingInventory) inventoryUI.close();
  if(game.modal==='dialog'&&id!=='dialog'&&talkingNPC){talkingNPC.model.rotation.y=talkingNPC.savedFacing;talkingNPC=null;}
  if(id!=='dialog')dialogCamReady=false;
  if (game.modal === 'dialog' && id !== 'dialog') stopVoice();
  for (const name of ['dialog', 'inventory', 'journal', 'pause']) show(name, name === id);
  game.modal = id;
  game.paused = !!id || !game.started || !!game.cinematic;
  if (id) { unlockPointer(); if (id === 'inventory') inventoryUI.open(inventoryContext); if (id === 'journal') updateJournal(); }
  else if (game.started && !game.cinematic) { game.paused = false; }
  syncPresentation();
  if (closingInventory && !id) { renderer.domElement.focus(); lockPointer(); }
}
function startGame(continueExisting = false) {
  const loaded = continueExisting && loadGame();
  if (!loaded) { resetGame(!continueExisting); if (pendingAppearance) player.appearance = { ...pendingAppearance }; pendingAppearance = null; }
  setModal(null);
  show('start-screen', false); show('hud', true);
  game.started = true; game.paused = false; game.modal = null;
  objective(); updateHUD();
  updatePlayer(0); updateCamera(1);
  grantBow(loaded);
  if (!loaded) playIntro();
  else toast('WILLKOMMEN ZURÜCK IN DER ASCHMARK');
  syncPresentation();
}
// ── Intro: the staged opening (src/data/hemland/intro.js) run by the director. Hanne, the two raiders,
// her handcart and the props exist only for the scene; Hanne's covered body stays by the well.
const fadeLayer = Object.assign(document.createElement('div'), { id: 'fade-layer' });
const titleCard = Object.assign(document.createElement('div'), { id: 'title-card', innerHTML: '<small>A Journey through</small><strong>Hemland</strong>' });
document.body.append(fadeLayer, titleCard);
const INTRO_SOUNDS = { string: 'swing', bow: 'swing', thud: 'impact', bucket: 'impact' };
let hanneBody = null;
function makeHandcart() {
  const cart = new THREE.Group();
  blockOn(cart, 1.3, .5, 1.9, 'planks', 0, .55, 0);
  for (const sx of [-1, 1]) {
    const wheel = blockOn(cart, .14, .9, .9, 'darkPlanks', sx * .78, .05, .1); wheel.rotation.x = .2;
    blockOn(cart, .1, .1, 1.5, 'timber', sx * .45, .78, -1.55);
  }
  scene.add(cart); return cart;
}
function playIntro() {
  keys.clear(); show('reticle', false); unlockPointer();
  const S = INTRO_SCRIPT, cine = { actors: {}, poses: {}, carry: null, cart: makeHandcart(), cartFollow: true, props: [], action: null };
  worldClock.hour = S.hour; life.skipTo(S.hour);
  for (const [id, def] of Object.entries(S.cast)) {
    const look = def.bandit !== undefined ? banditLook(def.bandit) : { appearance: { ...def.appearance, name: def.name }, equipment: def.equipment, tints: def.tints, extras: [] };
    const model = dressed(look);
    if (look.equipment.weapon) equipItem(model, WEAPON_MODELS[look.equipment.weapon]);
    model.rotation.order = 'YXZ'; scene.add(model);
    cine.actors[id] = { model, animator: createAnimator(model), name: def.name };
  }
  const modelOf = id => id === 'wanderer' ? playerModel : cine.actors[id]?.model ?? npcs.find(n => n.id === id)?.model;
  const place = (id, p) => {
    const model = modelOf(id); if (!model) return;
    model.visible = true;
    model.position.set(p.x, world.heightAt(p.x, p.z), p.z); model.rotation.y = p.yaw;
    model.userData.simPos = null;
    const npc = npcs.find(n => n.id === id); if (npc) { npc.x = p.x; npc.z = p.z; }
    if (id === 'wanderer') player.position.copy(model.position);
  };
  for (const [id, [x, z]] of Object.entries(S.start)) place(id, { x, z, yaw: id === 'wanderer' || id === 'hanne' ? -2 : Math.atan2(x + 30, z - 18) });
  const at = (id, y = 1.4) => modelOf(id).position.clone().add(v3(0, y, 0));
  const director = createDirector(S, {
    place,
    end: () => endCinematic(),
    event(e) {
      switch (e.do) {
        case 'pose': cine.poses[e.actor] = e.pose; if (e.for) setTimeout(() => { if (cine.poses[e.actor] === e.pose) cine.poses[e.actor] = null; }, e.for * 1000); break;
        case 'say': {
          const name = cine.actors[e.speaker]?.name ?? npcs.find(n => n.id === e.speaker)?.name ?? '';
          $('cinematic-caption').textContent = name ? `${name}: ${e.text.replaceAll('{name}', player.appearance?.name || 'Wanderer')}` : e.text;
          speech(e.text.replaceAll('{name}', player.appearance?.name || 'Wanderer'), e.speaker); break;
        }
        case 'sound': if (INTRO_SOUNDS[e.name]) combat.effects.sound(INTRO_SOUNDS[e.name]); break;
        case 'blood': { const p = at(e.actor, 1.35); combat.effects.spray(p, v3(Math.random() - .5, .3, Math.random() - .5).normalize(), 'blood', e.count || 14); combat.effects.groundStain?.(modelOf(e.actor).position.clone(), .5); break; }
        case 'swing': cine.action = { kind: 'sword', combo: 0, t: 0, duration: .55, progress: 0 }; combat.effects.sound('swing'); break;
        case 'cart': cine.cartFollow = false; if (e.turn) cine.cart.rotation.y += e.turn; if (e.shift) { cine.cart.position.x += e.shift[0]; cine.cart.position.z += e.shift[1]; } break;
        case 'bolt': { const bolt = blockOn(cine.cart, .05, .05, .55, 'timber', .66, .75, -.2); bolt.rotation.y = .4; combat.effects.sound('impact'); break; }
        case 'well_bolt': { const y = world.heightAt(-3, 9) + 1.44, bolt = blockOn(scene, .05, .05, .5, 'timber', -1.9, y, 9.6); bolt.rotation.y = 1.2; cine.props.push(bolt); break; }
        case 'carry': cine.carry = { carrier: e.carrier, carried: e.carried }; cine.poses[e.carried] = 'slump'; break;
        case 'lay': { cine.carry = null; const m = modelOf(e.carried); m.rotation.set(0, e.yaw, 0); place(e.carried, { x: e.pos[0], z: e.pos[1], yaw: e.yaw }); cine.poses[e.carried] = 'sleep'; break; }
        case 'cloak': { const m = modelOf('hanne'), cloak = blockOn(m, 1.05, .3, 2.3, pixelMaterial('clothRed', { tint: 0x6a5040 }), 0, .02, -.95); cloak.userData.hanneCloak = true; break; }
        case 'hide': modelOf(e.actor).visible = false; break;
        case 'title': titleCard.classList.toggle('show', !!e.show); break;
        case 'fade': fadeLayer.style.transition = `opacity ${e.duration ?? 1}s linear`; fadeLayer.style.opacity = String(e.to); break;
      }
    },
  });
  fadeLayer.style.transition = 'none'; fadeLayer.style.opacity = '1';
  game.cinematic = { director, cine, frame: null, duration: Infinity, callback: () => {
    // Clean up the scene's extras; Hanne's covered body stays until she is buried.
    cine.cart.removeFromParent(); for (const prop of cine.props) prop.removeFromParent();
    for (const id of ['raider', 'shooter']) cine.actors[id].model.removeFromParent();
    hanneBody = cine.actors.hanne;
    const end = S.end;
    if (!hanneBody.model.parent) scene.add(hanneBody.model);
    hanneBody.model.position.set(end.hanne[0], world.heightAt(end.hanne[0], end.hanne[1]), end.hanne[1]); hanneBody.model.rotation.set(0, .4, 0);
    hanneBody.animator.update(.5, { activity: 'sleep' });
    if (!hanneBody.model.children.some(c => c.userData.hanneCloak)) blockOn(hanneBody.model, 1.05, .3, 2.3, pixelMaterial('clothRed', { tint: 0x6a5040 }), 0, .02, -.95).userData.hanneCloak = true;
    titleCard.classList.remove('show');
    fadeLayer.style.transition = 'opacity 1.6s linear'; fadeLayer.style.opacity = '0';
    camera.fov = settings.fov; camera.updateProjectionMatrix();
    player.position.set(end.wanderer[0], world.heightAt(end.wanderer[0], end.wanderer[1]), end.wanderer[1]); player.yaw = end.yaw; player.pitch = -.12; snapPlayerView();
    // The raid happens at dusk; play begins the next morning, in daylight.
    worldClock.hour = 8.5; life.skipTo(worldClock.hour); updateHUD();
    toast('AM NÄCHSTEN MORGEN · SPRICH MIT ELIRA, SIE STEHT AM BRUNNEN', 5200);
  } };
  game.cinematicTime = 0; game.paused = true;
  $('cinematic').classList.add('active'); $('cinematic-caption').textContent = ''; show('subtitle', false); syncPresentation();
}
// Per frame while the intro runs: actors, carried body, the cart and the camera frame.
function updateIntro(dt) {
  const c = game.cinematic, cine = c.cine;
  c.frame = c.director.update(dt);
  if (!game.cinematic) return;
  if (cine.cartFollow) {
    const h = cine.actors.hanne.model, yaw = h.rotation.y;
    cine.cart.position.set(h.position.x + Math.sin(yaw) * 1.9, world.heightAt(h.position.x + Math.sin(yaw) * 1.9, h.position.z + Math.cos(yaw) * 1.9), h.position.z + Math.cos(yaw) * 1.9);
    cine.cart.rotation.y = yaw;
  }
  if (cine.carry) {
    const carrier = npcs.find(n => n.id === cine.carry.carrier).model, body = cine.actors[cine.carry.carried].model, yaw = carrier.rotation.y;
    body.position.set(carrier.position.x - Math.sin(yaw) * .6 + Math.cos(yaw) * 1.05, carrier.position.y + 1.2, carrier.position.z - Math.cos(yaw) * .6 - Math.sin(yaw) * 1.05);
    body.rotation.set(0, yaw, Math.PI / 2);
  }
  if (cine.action) { cine.action.t += dt; cine.action.progress = Math.min(1, cine.action.t / cine.action.duration); if (cine.action.progress >= 1) cine.action = null; }
  for (const [id, a] of Object.entries(cine.actors)) if (a.model.parent && a.model.visible) a.animator.update(dt, { activity: cine.poses[id] ?? null });
}
function playCinematic(caption, duration = 5, callback = null) {
  keys.clear(); show('reticle', false);
  unlockPointer(); speech(caption, 'narrator');
  game.cinematic = { caption, duration, callback }; game.cinematicTime = 0; game.paused = true;
  $('cinematic-caption').textContent = caption;
  $('cinematic').classList.add('active');
  show('subtitle', false); syncPresentation();
}
function endCinematic() {
  if (!game.cinematic) return;
  stopVoice();
  const callback = game.cinematic.callback;
  game.cinematic = null; game.paused = !!game.modal;
  $('cinematic').classList.remove('active'); show('subtitle', false);
  syncPresentation();
  if (callback) callback();
}

function dialogLine(npc, text, options) {
  $('dialog-role').textContent = npc.role; $('dialog-name').textContent = npc.name;
  $('dialog-line').textContent = text; $('dialog-options').replaceChildren();
  const makeOption = (label, action) => {
    const button = document.createElement('button'); button.textContent = label;
    button.addEventListener('click', () => { stopVoice(); action(); }); $('dialog-options').append(button);
  };
  options.forEach(([label, fn]) => makeOption(label, fn));
  speech(text, npc.id);
}
function speakTo(npc) {
  talkingNPC=npc;npc.savedFacing=npc.model.rotation.y;
    npc.dialogFacing=Math.atan2(npc.model.position.x-player.position.x,npc.model.position.z-player.position.z);
    for(const offset of [0,.55,-.55,1.1,-1.1,Math.PI]) {
      const yaw=npc.dialogFacing+offset;
      const eye=npc.model.position.clone().add(v3(0,2.2*npc.model.scale.x,0));
      const view=eye.clone().add(v3(-Math.sin(yaw)*2.7,0,-Math.cos(yaw)*2.7));
      if(!world.segmentBlocked(eye,view,.18)){npc.dialogFacing=yaw;break;}
    }
  setModal('dialog');
  const close = () => setModal(null);
  // People outside the village (Rauk) get their entry on first meeting.
  (relationship[npc.id] ??= { trust: 0, met: false, gifts: 0, memories: [] }).met = true;
  const node = dialogue.start(npc.storyId);
  if (node?.text) { showNode(npc, node, true); return; }
  dialogLine(npc, npc.lines[0] || '…', [...(npc.trader ? [['Handeln · Waren ansehen', () => openInventory('merchant')]] : []), ['Leb wohl.', close]]);
}
// The story's state lives in game.flags, relationships, the inventory and the quest stage.
const dialogue = createDialogue({ story: STORY, state: {
  get: flag => game.flags[flag], set: (flag, value) => { game.flags[flag] = value; },
  quest: () => game.quest, setQuest: id => changeQuest(id),
  trust: id => (relationship[id]?.trust ?? 0) / 10,
  addTrust: (id, amount) => { relationship[id] ??= { trust: 0, met: true, gifts: 0, memories: [] }; relationship[id].trust = clamp(relationship[id].trust + amount * 10, -100, 100); },
  hasItem: id => (inventory.counts()[id] || 0) > 0,
  giveItem: id => { if (inventory.add(id)) { toast(`ERHALTEN · ${ITEMS[id].name}`, 3200); inventoryChanged(); } },
  name: () => player.appearance?.name || 'Wanderer',
} });
function showNode(npc, node, entry = false) {
  const speaker = npc.storyId === node.speaker ? npc : npcs.find(n => n.storyId === node.speaker && !n.citizen) || npc;
  const options = node.choices.map((choice, i) => [choice.text, () => {
    const next = dialogue.choose(node, i);
    storyEvent({ type: 'talk', npc: npc.storyId });
    if (next?.text) showNode(npc, next); else setModal(null);
  }]);
  if (entry && npc.trader) options.unshift(['Handeln · Waren ansehen', () => openInventory('merchant')]);
  dialogLine(speaker, node.text, options.length ? options : [['…', () => setModal(null)]]);
}
// Advances the main quest and every running side quest whose current stage the event completes.
function storyEvent(event = {}) {
  for (let guard = 0; guard < 8; guard++) {
    let moved = false;
    for (const track of ['main', ...STORY.QUESTS.side.map(q => q.id)]) {
      const stages = track === 'main' ? MAIN_STAGES : STORY.QUESTS.side.find(q => q.id === track).stages;
      const current = track === 'main' ? game.quest : game.flags[`side_${track}`];
      const trigger = stages.find(stage => stage.id === current)?.trigger;
      if (!trigger) continue;
      // Items and choices are states; talk, reach and kill have to match the event that happened.
      const candidate = ['item', 'choice'].includes(trigger.type) ? trigger : { ...event };
      const result = dialogue.questForTrigger({ ...candidate, track });
      if (!result) continue;
      moved = true;
      if (track === 'main') changeQuest(result.next?.id ?? null);
      else { game.flags[`side_${track}`] = result.next?.id ?? 'done'; if (result.next) toast(`${result.next.title.toUpperCase()} · ${result.next.objective}`, 4200); else toast('NEBENAUFGABE ABGESCHLOSSEN', 3200); updateJournal(); }
    }
    if (!moved) break;
  }
  for (const e of enemies) if (e.calm && game.flags.captain_hostile && e.ai?.group === 'camp' && !['pacified', 'grateful'].includes(e.ai.hostility)) e.calm = false;
}
// Soren is found dead outside the inn: his routine ends and his body lies by the door.
function sorenDies(announce = true) {
  const soren = npcs.find(n => n.id === 'soren');
  if (!soren || soren.dead) return;
  soren.dead = true; life.remove('soren');
  const door = roomNear(['inn'], SITES.inn, 60)?.door?.outside || SITES.inn;
  soren.model.position.set(door.x + 1.6, world.heightAt(door.x + 1.6, door.z + 1), door.z + 1);
  soren.x = soren.model.position.x; soren.z = soren.model.position.z;
  soren.animator.update(.016, {});
  soren.ragdoll = createRagdoll(physics, soren.model, { impulse: v3(0, -4, 6) });
  if (announce) toast('VOR DEM GASTHAUS LIEGT SOREN', 4200);
}
const STORY_PICKUPS = [
  { item: 'burial_boards', at: () => ({ x: -21.6, z: -1.8 }), when: () => game.flags.side_burial === 'burial_wood', label: 'Trockene Bretter nehmen' },
  { item: 'olt_token', at: () => SITES.tower, radius: 6, when: () => game.flags.side_tower === 'tower_token', label: 'Olts Holzmarke aufheben' },
];
let storyClock = 0;
function updateStory(dt) {
  if (hanneBody && game.flags.hanne_buried) { hanneBody.model.removeFromParent(); hanneBody = null; }
  if ((storyClock += dt) < .5) return;
  storyClock = 0;
  discoverPlaces();
  for (const [site, s] of Object.entries(SITES)) {
    const reach = (s.radius ?? Math.max(s.halfX || 0, s.halfZ || 0)) + 12;
    if (Math.hypot(player.position.x - s.x, player.position.z - s.z) > reach) continue;
    if (site === 'inn' && game.quest === 'm_inn' && !game.flags.soren_dead) { game.flags.soren_dead = true; sorenDies(); }
    storyEvent({ type: 'reach', site });
  }
}

// Points of interest (world.markers with `discover`): the first visit names the place and gives
// experience; the flag poi_<id> keeps it on the compass for good.
const discovered = m => !!game.flags[`poi_${m.id}`];
function discoverPlaces() {
  for (const m of world.markers) {
    if (!m.discover || discovered(m) || Math.hypot(player.position.x - m.x, player.position.z - m.z) > (m.radius ?? 16)) continue;
    game.flags[`poi_${m.id}`] = true;
    toast(`Ort entdeckt: ${m.label}`, 4200);
    awardXP(m.xp ?? 20);
  }
}

function updateJournal() {
  $('quest-list').replaceChildren();
  const entry = (title, text, status) => {
    const box = document.createElement('article'); box.className = 'quest';
    const heading = document.createElement('h3'); heading.textContent = title;
    const desc = document.createElement('p'); desc.textContent = text;
    const small = document.createElement('small'); small.textContent = status;
    box.append(heading, desc, small); $('quest-list').append(box);
  };
  const main = stageOf(game.quest);
  if (main) entry(main.title, main.journal, main.objective);
  else entry('Die Aschmark', 'Was hier zu tun war, ist getan. Hemland ist größer als dieses Tal.', 'Abgeschlossen');
  for (const quest of STORY.QUESTS.side) {
    const stage = quest.stages.find(st => st.id === game.flags[`side_${quest.id}`]);
    if (stage) entry(stage.title, stage.journal, stage.objective);
  }
}
function updateHUD() {
  setBarVisibility(player.hp, player.maxHp, player.stamina, player.maxStamina, 1, 1);
  $('health-fill').style.width = `${100 * player.hp / player.maxHp}%`; $('health-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  $('stamina-fill').style.width = `${100 * player.stamina / player.maxStamina}%`; $('stamina-text').textContent = `${Math.ceil(player.stamina)} / ${player.maxStamina}`;
  $('level').textContent = `STUFE ${player.level} · WANDERER`;
  const hour = Math.floor(worldClock.hour), minute = Math.floor(worldClock.hour % 1 * 60);
  const period = hour < 6 || hour >= 21 ? 'Nacht' : hour < 10 ? 'Morgen' : hour < 17 ? 'Tag' : 'Abend';
  $('world-time').textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} · ${period}`;
  document.querySelector('.slot small').textContent = ITEMS[player.equipment.weapon]?.name || 'Unbewaffnet';
  document.querySelectorAll('.slot small')[2].textContent = `Heiltrank × ${player.potions}`;
  document.querySelectorAll('.slot small')[3].textContent = ITEMS[player.equipment.ranged] ? `${ITEMS[player.equipment.ranged].name} · ${player.satchel.pfeil || 0}` : 'Kein Bogen';
  // The compact touch quickbar shows only the icons and these counts.
  const slots = document.querySelectorAll('.slot'); slots[2].dataset.count = player.potions; slots[3].dataset.count = ITEMS[player.equipment.ranged] ? player.satchel.pfeil || 0 : '–';
  [...document.querySelectorAll('.slot')].forEach((element, i) => element.classList.toggle('selected', i === player.tool));
  touch?.setTool(player.tool);
}
function nearestInteraction() {
  let best = null, distance = 3.8;
  for (const npc of npcs) { if (npc.dead) continue; const d = Math.hypot(player.position.x - npc.x, player.position.z - npc.z); if (d < distance) { best = { type: 'npc', npc }; distance = d; } }
  const rauk = enemies.find(e => e.storyId && e.calm && !e.dead);
  if (rauk) { const d = Math.hypot(player.position.x - rauk.model.position.x, player.position.z - rauk.model.position.z); if (d < Math.min(distance, 3.5)) { best = { type: 'npc', npc: raukSpeaker(rauk) }; distance = d; } }
  for (const pickup of STORY_PICKUPS) { if (!pickup.when()) continue; const at = pickup.at(), d = Math.hypot(player.position.x - at.x, player.position.z - at.z); if (d < Math.min(distance, pickup.radius ?? 2.6)) { best = { type: 'story', pickup }; distance = d; } }
  const chestDistance = Math.hypot(player.position.x - chestPosition.x, player.position.z - chestPosition.z);
  if (chestDistance < Math.min(distance, 2.8)) { best = {type:'stash'}; distance = chestDistance; }
  for (const bag of player.drops) {
    const d = Math.hypot(player.position.x - bag.x, player.position.z - bag.z);
    if (d < Math.min(distance, 2.5)) { best = {type:'drop',bag}; distance = d; }
  }
  for (const e of enemies) {
    if (e.dead || !e.ai) continue;
    const d = Math.hypot(player.position.x - e.model.position.x, player.position.z - e.model.position.z);
    if (e.ai.hostility === 'surrendered' && d < Math.min(distance, 3.4)) { best = { type: 'yielded', enemy: e }; distance = d; }
    else if (e.ai.hostility === 'demanding' && d < Math.min(distance, 6)) { best = { type: 'toll', enemy: e }; distance = d; }
  }
  for (const e of enemies) {
    if (!e.dead || !e.loot || !Object.values(e.loot).some(n => n > 0)) continue;
    const body = e.ragdoll ? e.ragdoll.position() : e.model.position;
    const d = Math.hypot(player.position.x - body.x, player.position.z - body.z);
    if (d < Math.min(distance, 2.6)) { best = {type:'corpse',enemy:e}; distance = d; }
  }
  for (const animal of wildlife.carcasses()) {
    const body = wildlife.bodyAt(animal), d = Math.hypot(player.position.x - body.x, player.position.z - body.z);
    if (d < Math.min(distance, 2.2)) { best = { type: 'corpse', enemy: animal }; distance = d; }
  }
  const at = new THREE.Vector3();
  for (const door of world.doors) {
    const d = Math.hypot(player.position.x - door.position.x, player.position.z - door.position.z);
    if (d < Math.min(distance, 2.2)) { best = { type: 'door', door }; distance = d; }
  }
  for (const spot of furnitureSpots) {
    if (!['sleep', 'loot'].includes(spot.kind)) continue;
    spot.piece.getWorldPosition(at);
    const d = Math.hypot(player.position.x - at.x, player.position.z - at.z);
    if (d < Math.min(distance, 1.9) && Math.abs(at.y - player.position.y) < 1.2) { best = { type: 'furniture', spot }; distance = d; }
  }
  for (const m of world.markers) {
    if (!m.lore || !m.read) continue;
    const d = Math.hypot(player.position.x - m.read.x, player.position.z - m.read.z);
    if (d < Math.min(distance, 2.4)) { best = { type: 'lore', marker: m }; distance = d; }
  }
  for (const prop of physics.props.values()) {
    if (!prop.item) continue;
    const t = prop.body.translation(), d = Math.hypot(player.position.x - t.x, player.position.z - t.z);
    if (d < Math.min(distance, 2) && Math.abs(t.y - player.position.y - .8) < 1.6) { best = { type: 'pickup', prop }; distance = d; }
  }
  // An arrow you look at within reach (in the ground, a wall, a corpse) comes before everything else.
  const arrow = combat.archery?.nearestArrow(player.position, camera.position, camera.getWorldDirection(v3(0, 0, 0)));
  if (arrow) best = { type: 'arrow', arrow };
  return best;
}
function interact() {
  if (player.mode === 'first') firstPerson.reach();
  if (game.cinematic) { endCinematic(); return; }
  const target = nearestInteraction();
  if (!target) { toast('HIER GIBT ES NICHTS ZU INTERAGIEREN'); return; }
  if (target.type === 'npc') speakTo(target.npc);
  else if (target.type === 'stash') openInventory('stash');
  else if (target.type === 'drop') openInventory({kind:'take',id:target.bag.id});
  else if (target.type === 'corpse') openInventory({kind:'corpse',enemy:target.enemy});
  else if (target.type === 'door') target.door.target = target.door.target > .5 ? 0 : 1;
  else if (target.type === 'furniture' && target.spot.kind === 'loot') openInventory({kind:'chest',spot:target.spot});
  else if (target.type === 'furniture' && target.spot.kind === 'sleep') sleepUntilMorning();
  else if (target.type === 'pickup') {
    if (!inventory.add(target.prop.item)) return;
    physics.removeProp(target.prop); target.prop.object.removeFromParent();
    toast(`${ITEMS[target.prop.item].name} genommen`, 1600); inventoryChanged();
  }
  else if (target.type === 'lore') { toast(`${target.marker.label} — ${target.marker.lore}`, 11000, 'lore'); if (!discovered(target.marker)) discoverPlaces(); }
  else if (target.type === 'yielded') spareOrRob(target.enemy);
  else if (target.type === 'toll') payToll(target.enemy);
  else if (target.type === 'arrow') { const whole = combat.archery.pull(target.arrow); if (whole !== null) toast(whole ? 'PFEIL GEZOGEN · +1' : 'DER PFEIL IST GEBROCHEN', 1300); updateHUD(); }
  else if (target.type === 'story') {
    if (inventory.add(target.pickup.item)) { toast(`${ITEMS[target.pickup.item].name} genommen`, 2400); inventoryChanged(); storyEvent({ type: 'item', item: target.pickup.item }); }
  }
}
function raukSpeaker(e) {
  e.speaker ??= { id: 'bandit_captain', storyId: 'bandit_captain', name: 'Rauk', role: 'HAUPTMANN DES WESTLAGERS', model: e.model, lines: [] };
  e.speaker.x = e.model.position.x; e.speaker.z = e.model.position.z;
  return e.speaker;
}
// Everything a fallen enemy wore or carried stays on the corpse to be looted.
function corpseLoot(enemy) {
  const loot = {}, add = (id, n = 1) => { loot[id] = (loot[id] || 0) + n; };
  for (const id of Object.values(enemy.look?.equipment || {})) if (ITEMS[id]) add(id);
  const roll = Math.random();
  if (enemy.kind === 'bandit') { add('leder'); if (roll > .55) add(roll > .82 ? 'aschenklinge' : 'heiltrank'); if (roll < .3) add('reisefladen'); }
  if (enemy.archer) add('pfeil', 3 + Math.floor(Math.random() * 6));
  else add('leder', roll < .5 ? 2 : 1);
  if (enemy.storyId) { add('aschenrüstung'); if (!game.flags.captain_spared) add('payment_order'); }
  return loot;
}
// Looted corpses lose the clothes and weapons that were taken from them.
function syncCorpses() {
  for (const e of enemies) {
    if (!e.dead || !e.look || !e.loot) continue;
    const equipment = Object.fromEntries(Object.entries(e.look.equipment).filter(([, id]) => (e.loot[id] || 0) > 0));
    const key = JSON.stringify(equipment);
    if (e.model.userData.corpseKey === key) continue;
    e.model.userData.corpseKey = key;
    const { parts, tints } = outfitFor(equipment);
    restyleCharacter(e.model, { outfit: [...parts, ...(e.look.extras || [])], tints });
    e.ragdoll?.rebind(e.model);
    if (!equipment.weapon) equipItem(e.model, null);
  }
}
function sleepUntilMorning() {
  if (enemies.some(e => !e.dead && e.model.position.distanceTo(player.position) < 25)) { toast('DU KANNST NICHT SCHLAFEN, WENN FEINDE IN DER NÄHE SIND'); return; }
  playCinematic('Du schläfst tief und traumlos …', 2.6, () => {
    if (worldClock.hour > 7) game.flags.ai_day = (game.flags.ai_day || 0) + 1;
    worldClock.hour = 7; player.hp = player.maxHp; player.stamina = player.maxStamina;
    toast('AUSGERUHT · LEBEN UND AUSDAUER WIEDERHERGESTELLT', 3500); updateHUD(); saveGame(false);
  });
}
function damageEnemy(enemy, amount, magic = false) {
  if (enemy.dead) return;
  // Striking a calm bandit ends any talk in the camp.
  const yielding = ['surrendered', 'pacified', 'grateful'].includes(enemy.ai?.hostility);
  if (enemy.calm && (enemy.ai?.group === 'camp' || !enemy.ai)) provokeCamp();
  // Striking someone you let go, or who yielded: they turn on you (or run), and it is not forgotten.
  if (yielding) { enemy.calm = false; enemy.ai.hostility = enemy.ai.traits.aggression > .6 ? 'hostile' : 'fleeing'; enemy.ai.disarmed = false; }
  const stats = itemStats();
  amount = Math.round(amount);
  enemy.hp -= amount;
  const pos = enemy.model.position.clone().add(v3(0, 1.9, 0));

  if (enemy.hp <= 0) {
    enemy.dead = true; enemy.model.visible = true; player.kills++; player.gold += enemy.kind === 'bandit' ? 17 : 7;
    ai.died(enemy, { cruel: yielding });
    if (enemy.ai?.group === 'camp' && !enemy.storyId) game.flags.camp_loss_day = game.flags.ai_day || 0;
    if (enemy.settler !== undefined) game.flags.camp_lost = (game.flags.camp_lost || 0) | 1 << enemy.settler;
    const xpReward = enemy.kind === 'bandit' ? 35 : 18;
    awardXP(xpReward);
    enemy.loot = corpseLoot(enemy);
    const from = enemy.model.position.clone().sub(player.position).setY(0).normalize();
    if (enemy.kind === 'bandit') enemy.ragdoll = createRagdoll(physics, enemy.model, { impulse: from.multiplyScalar(magic ? 45 : 32).add(v3(0, 12, 0)), point: enemy.model.position.clone().add(v3(0, 1.6, 0)) });
    // Wolves go down as ragdolls too (systems/ragdoll.js createCreatureRagdoll).
    else enemy.ragdoll = createCreatureRagdoll(physics, enemy.model, { impulse: from.multiplyScalar(magic ? 26 : 18).add(v3(0, 8, 0)) });
    toast(`${enemy.name.toUpperCase()} BESIEGT · +${enemy.kind === 'bandit' ? 35 : 18} EP`);
    if (enemy.storyId) game.flags.captain_dead = true;
    const group = enemy.kind === 'wolf' ? 'wolves' : enemy.storyId ? 'bandit_captain' : 'bandits';
    if (enemies.filter(e => (e.kind === 'wolf' ? 'wolves' : e.storyId ? 'bandit_captain' : 'bandits') === group).every(e => e.dead)) storyEvent({ type: 'kill', group });
    saveGame(false);
  }
}
const particles = [];
const burstGeometry = new THREE.IcosahedronGeometry(.075, 0);
function spawnBurst(position, color, amount = 12) {
  for (let i = 0; i < amount && particles.length < 180; i++) {
    const mesh = new THREE.Mesh(burstGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    mesh.position.copy(position); scene.add(mesh);
    particles.push({ mesh, vel: v3((Math.random() - .5) * 5, Math.random() * 3 + 1.5, (Math.random() - .5) * 5), ttl: .8 + Math.random() * .6 });
  }
}
function attack() {
  if(!game.started||game.paused||game.cinematic)return;
  if(motion.locked(playerModel))return;
  if(motion.holding(playerModel)){motion.command(playerModel,'shove');return;}
  if(motion.heldBy(playerModel)){if(player.stamina>=12){player.stamina-=12;motion.command(playerModel,'wrench');motion.command(playerModel,'wrench');combat.effects.sound('impact');}return;}
  if(player.tool===3&&!ITEMS[player.equipment.ranged]){toast('KEIN BOGEN AUSGERÜSTET',1500);return;}
  combat.attack();
}
let bowHintShown=false,potionHintShown=false;
function selectTool(tool){
  player.tool=tool;updateHUD();
  if(tool===2&&!potionHintShown){potionHintShown=true;toast(tip('HEILTRANK · LINKSKLICK TRINKT · RECHTSKLICK HALTEN SCHÜTTELT DIE FLASCHE','HEILTRANK · SCHLAG TRINKT · BLOCK HALTEN SCHÜTTELT DIE FLASCHE'),4200);}
  if(tool===3&&!bowHintShown&&ITEMS[player.equipment.ranged]){bowHintShown=true;toast(tip('BOGEN · LINKE MAUSTASTE HALTEN ZUM SPANNEN, LOSLASSEN ZUM SCHIESSEN · RECHTSKLICK SENKT IHN','BOGEN · GROSSE TASTE HALTEN ZUM SPANNEN, DABEI WISCHEN ZUM ZIELEN, LOSLASSEN ZUM SCHIESSEN'),4200);}
}
function heal(){if(game.started&&!game.paused&&!game.cinematic)combat.drink();}
function applyHeal(){
  if(player.potions<1)return;
  player.potions--;player.hp=Math.min(player.maxHp,player.hp+ITEMS.heiltrank.heal);
  toast('HEILTRANK · +45 LEBEN',2000);updateHUD();saveGame(false);
}
function hurt(amount) {
  if (player.invuln > 0 || player.hp <= 0 || player.fly) return;
  const stats = itemStats();
  amount = Math.max(1, amount - stats.armor);
  player.hp = Math.max(0, player.hp - amount); player.invuln = .65;
  $('damage-flash').style.opacity = '.22'; setTimeout(() => { $('damage-flash').style.opacity = '0'; }, 170);
  if (player.hp <= 0) {
    toast('DU BIST GEFALLEN · DU ERWACHST IN DÄMMERWALD', 6500);
    player.position.set(3, world.heightAt(3, 0), 0); player.hp = player.maxHp; player.stamina = player.maxStamina; player.velocityY = 0; snapPlayerView();
    saveGame(false);
  }
}
function updatePlayer(dt) {
  player.invuln = Math.max(0, player.invuln - dt);

  // The touch stick adds an analogue direction; a light push walks, a full one runs, past the ring sprints.
  const pad = touchMode && touch.stick.mag > 0 ? touch.stick : null;
  const walking = clamp((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + (pad?.y ?? 0), -1, 1);
  const strafing = clamp((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (pad?.x ?? 0), -1, 1);
  let movement = v3(-Math.sin(player.yaw) * walking + Math.cos(player.yaw) * strafing, 0, -Math.cos(player.yaw) * walking - Math.sin(player.yaw) * strafing);
  // HUMANITY MOTION: down or getting up you do not walk; held you barely move; holding, you drag.
  const bodyLocked = motion.locked(playerModel), heldBy = motion.heldBy(playerModel), holdingSomeone = motion.holding(playerModel);
  if (bodyLocked) movement.set(0, 0, 0);
  const active = movement.lengthSq() > .001;
  if (active) movement.normalize();
  // Hold C to creep (Ctrl would close the browser tab with W): slow and quiet, game lets you come close.
  player.sneaking = (keys.has('KeyC') || touchMode && touch.sneak) && !player.fly;
  // Gaits: W runs, Shift sprints (stamina), Caps Lock toggles a calm walk for strolling through a village.
  // First person and fights steer directly; exploring in third person the body keeps a little weight.
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight') || !!pad?.sprint;
  const ready = player.mode === 'first' || performance.now() < (player.drawnUntil || 0) || !!combat.action || combat.guarding || !!combat.archery?.bow;
  const sprinting = active && !player.sneaking && shift && player.stamina > 1;
  const running = active && !player.sneaking && !sprinting && !player.walkMode && !(pad && pad.mag < .5);
  // Ground under the feet: a bridge deck or floor far overhead (swimming under a bridge) does not count.
  const groundAt = (x, z) => { const g = world.heightAt(x, z); return g > player.position.y + 1.6 ? world.terrainHeightAt(x, z) : g; };
  // Water: wading slows you down, deeper you swim with the head above the surface.
  const depth = WATER_LEVEL - groundAt(player.position.x, player.position.z);
  player.swimming = depth > 1.9 && !player.fly;
  const wade = player.swimming ? .42 : depth > .55 ? clamp(1 - (depth - .55) * .38, .5, 1) : 1;
  // Dragging a corpse is slow work: no faster than the body can follow.
  const speed = (sprinting ? 9.2 : running ? 5.6 : player.sneaking ? 1.9 : 2.1)*combat.speedFactor*(physics.holding?.kind === 'ragdoll' ? .52 : 1)*wade*(heldBy ? .3 : holdingSomeone ? .55 : 1);
  if (sprinting) player.stamina = Math.max(0, player.stamina - 21 * dt);
  else if(!combat.action&&!combat.guarding) player.stamina = Math.min(player.maxStamina, player.stamina + 18 * dt);
  player.velocity ??= v3(0, 0, 0);
  let planar = 0;
  if (player.fly) {
    // Debug flight (F4): noclip along the view direction, Space up, C down, Shift ×5.
    const rise = (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0), cp = Math.cos(player.pitch);
    const wish = v3(-Math.sin(player.yaw) * cp * walking + Math.cos(player.yaw) * strafing, Math.sin(player.pitch) * walking + rise,
      -Math.cos(player.yaw) * cp * walking - Math.sin(player.yaw) * strafing);
    if (wish.lengthSq() > 1) wish.normalize();
    player.position.addScaledVector(wish, FLY_SPEED * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 1) * dt);
    player.position.y = Math.max(player.position.y, world.heightAt(player.position.x, player.position.z));
    player.velocity.set(0, 0, 0); player.velocityY = 0; player.grounded = false; player.moveSpeed = 0; player.stamina = player.maxStamina;
  } else {
  // Velocity eases toward the wish direction: quick to start, quicker to stop, little air control.

  if (ready || !player.grounded || player.swimming) {
    // Fighting, airborne or swimming: direct, camera-relative control.
    const response = 1 - Math.exp(-dt * (player.grounded ? (active ? 16 : 20) : 2.5));
    player.velocity.x += (movement.x * (active ? speed : 0) - player.velocity.x) * response;
    player.velocity.z += (movement.z * (active ? speed : 0) - player.velocity.z) * response;
    player.heading = Math.atan2(-player.velocity.x, -player.velocity.z); player.pace = Math.hypot(player.velocity.x, player.velocity.z);
  } else {
    // Exploring: the body has weight. Speed builds up and dies down at a body's pace, the heading swings
    // round to where you steer, slower the faster you go, and a hard turn at speed first plants the feet.
    player.pace ??= 0; player.heading ??= player.modelYaw ?? player.yaw;
    const wish = Math.atan2(-movement.x, -movement.z), off = active ? THREE.MathUtils.euclideanModulo(wish - player.heading + Math.PI, Math.PI * 2) - Math.PI : 0;
    const planting = active && Math.abs(off) > 2.3 && player.pace > 6.5;
    const target = active && !planting ? speed * (1 - Math.min(.45, Math.abs(off) / 3.5 * player.pace / 8)) : 0;
    const rate = target > player.pace ? (player.pace < 3 ? 14 : 9) : planting ? 18 : 16;
    player.pace += clamp(target - player.pace, -rate * dt, rate * dt);
    const turnRate = planting ? 3 : player.pace < .4 ? 16 : THREE.MathUtils.lerp(13, 6, clamp(player.pace / 9.2, 0, 1));
    if (active) player.heading += clamp(off, -turnRate * dt, turnRate * dt);
    player.velocity.x = -Math.sin(player.heading) * player.pace; player.velocity.z = -Math.cos(player.heading) * player.pace;
  }
  planar = Math.hypot(player.velocity.x, player.velocity.z);
  // The step counter the first-person hands bob to (two steps per cycle of stride / 2).
  player.stride = (player.stride || 0) + (player.grounded ? planar * dt * 2.4 : 0);
  player.moveSpeed = planar > .15 ? planar : 0;
  const dx = player.velocity.x * dt, dz = player.velocity.z * dt;
  // Low obstacles (steps, low walls, crates up to .45) are climbed instead of blocking.
  // Cliffs: ground rising steeper than ~50° ahead of you (and above your feet) cannot be walked up.
  const cliff = (x, z) => { const g = groundAt(x, z); return g > player.position.y + .45 && (g - groundAt(player.position.x, player.position.z)) / Math.max(.05, Math.hypot(x - player.position.x, z - player.position.z)) > 1.2; };
  const free = (x, z) => !cliff(x, z) && (!world.blocked(x, z, .43, player.position.y) || player.grounded && !world.blocked(x, z, .43, player.position.y + .45));
  if (free(player.position.x + dx, player.position.z)) player.position.x += dx; else player.velocity.x *= .2;
  if (free(player.position.x, player.position.z + dz)) player.position.z += dz; else player.velocity.z *= .2;
  if ((keys.has('Space')) && player.grounded && !player.swimming && player.stamina > 9 && !bodyLocked && !heldBy && !holdingSomeone) { player.velocityY = 7.1; player.grounded = false; player.stamina -= 9; }
  player.velocityY -= 19 * dt; player.position.y += player.velocityY * dt;
  // Crates, carts, walls and wells are solid from above too: land on them instead of sinking in.
  const ground = Math.max(groundAt(player.position.x, player.position.z), world.supportAt(player.position.x, player.position.z, .3, player.position.y));
  const swimY = WATER_LEVEL - 1.55;
  if (player.swimming && player.position.y <= swimY + .05) {
    if (player.velocityY < -6) world.water.splash(player.position.x, player.position.z, Math.min(2, -player.velocityY / 6));
    player.position.y = Math.max(swimY, ground); player.velocityY = 0; player.grounded = true;
  } else if (player.position.y <= ground) {
    if (depth > .2 && player.velocityY < -6) world.water.splash(player.position.x, player.position.z, Math.min(1.5, -player.velocityY / 8));
    player.position.y = ground; player.velocityY = 0; player.grounded = true;
  } else if (player.position.y > ground + .25) player.grounded = false;
  // Rings behind whoever moves through water.
  // A wake behind you in the water (water.js simulation); swimming strokes push harder.
  if (depth > .15 && planar > .3) world.water.wake(player.position.x, player.position.z, planar * (player.swimming ? 1.6 : 1), player.swimming ? .45 : .3);
  // The current carries a swimmer downstream and tugs at anyone wading.
  const stream = depth > .6 && world.water.at(player.position.x, player.position.z);
  if (stream) { const pull = player.swimming ? .75 : .3, fx = stream.flow[0] * pull * dt, fz = stream.flow[1] * pull * dt;
    if (free(player.position.x + fx, player.position.z + fz)) { player.position.x += fx; player.position.z += fz; } }
  }
    for(const actor of [...npcs,...enemies]) {
      if(actor.dead)continue;
      const p=actor.model.position,dx=player.position.x-p.x,dz=player.position.z-p.z,d=Math.hypot(dx,dz);
      if(d<.85&&Math.abs(player.position.y-p.y)<1.8) {
        const angle=d>.001?Math.atan2(dz,dx):player.yaw;
        const x=p.x+Math.cos(angle)*.85,z=p.z+Math.sin(angle)*.85;
        if(!world.blocked(x,z,.43,player.position.y)){player.position.x=x;player.position.z=z;}
      }
    }
  if (!motion.isDown(playerModel)) playerModel.position.copy(player.position);
  // Exploring: the body turns toward where it walks. Weapon drawn: it faces the camera, like Skyrim.
  const facesCamera = performance.now() < (player.drawnUntil || 0) || combat.action || combat.guarding || combat.archery?.bow || player.mode === 'first';
  player.modelYaw ??= player.yaw;
  const targetYaw = holdingSomeone || heldBy || bodyLocked ? player.modelYaw : facesCamera ? player.yaw : planar > .3 ? player.heading ?? Math.atan2(-player.velocity.x, -player.velocity.z) : player.modelYaw;
  const turn = THREE.MathUtils.euclideanModulo(targetYaw - player.modelYaw + Math.PI, Math.PI * 2) - Math.PI;
  player.modelYaw += clamp(turn, -dt * 11, dt * 11);
  playerModel.rotation.y = player.modelYaw;
  const outfitKey = JSON.stringify([player.equipment, player.appearance]);
  if (playerModel.userData.outfitKey !== outfitKey) {
    player.sleeveColor = sleeveColor(player.equipment); player.handGear = handGear(player.equipment);
    const { parts, tints } = outfitFor(player.equipment);
    restyleCharacter(playerModel, { appearance: player.appearance, outfit: parts, tints });
    playerModel.userData.outfitKey = outfitKey; playerModel.userData.weaponName = undefined;
  }
  // Skyrim-style: the blade is drawn for combat and sheathed while travelling.
  const threat = enemies.some(e => !e.dead && !e.calm && (!e.ai || e.ai.hostility === 'hostile') && e.model.position.distanceTo(player.position) < 15);
  if (combat.action || combat.guarding || threat || combat.archery?.bow) player.drawnUntil = performance.now() + 4000;
  const drawn = performance.now() < (player.drawnUntil || 0);
  const weaponModel = (player.tool === 0 && drawn) || combat.action?.kind === 'sword' ? WEAPON_MODELS[player.equipment.weapon] || 'sword_rusty' : null;
  if (playerModel.userData.weaponName !== weaponModel) { equipItem(playerModel, weaponModel); playerModel.userData.weaponName = weaponModel; }
  playerModel.visible = player.mode === 'third'&&!talkingNPC;
}
const aiPlayer = { position: player.position, yaw: 0, stance: 'still', noise: 0, swinging: false, casting: false, drawn: false, armor: 0, bow: { drawing: false, draw: 0, dir: v3(0, 0, -1), eye: v3(0, 0, 0) } };
const HEAVY = new Set(['aschenrüstung', 'hauptmannsplatte', 'wachpanzer']);
/** The wanderer as others can perceive them: posture, noise, what they hold and where a drawn bow points. */
function perceivablePlayer() {
  const P = aiPlayer, speed = player.velocity ? Math.hypot(player.velocity.x, player.velocity.z) : 0, act = combat.action?.kind, heavy = HEAVY.has(player.equipment.armor) ? 2 : 0;
  P.yaw = player.yaw; P.swinging = act === 'sword'; P.casting = act === 'cast';
  P.stance = player.sneaking ? (speed < .3 ? 'sneakStill' : 'sneak') : act === 'sword' || combat.guarding ? 'attack' : act === 'cast' ? 'cast' : speed > 4.5 ? 'run' : speed > .4 ? 'walk' : 'still';
  P.noise = player.fly ? 0 : player.sneaking ? (speed > .3 ? AI.sounds.sneak : 0) : speed > 4.5 ? AI.sounds.run + heavy : speed > .4 ? AI.sounds.step + heavy : 0;
  P.drawn = performance.now() < (player.drawnUntil || 0); P.armor = itemStats().armor;
  P.bow.drawing = !!combat.archery?.drawing; P.bow.draw = bowView.draw; P.bow.eye.copy(camera.position); camera.getWorldDirection(P.bow.dir);
  return P;
}
// ── The camp over days (HUMANITY AI layer H). Losses weaken it; with the captain alive, new blood
// arrives after two days; with him dead and at most one left, the last leave once nobody watches, and two
// days later a new band moves in — more shields if word of your bow got round, a hedge-witch if of fire.
// Nobody appears or vanishes in sight: changes happen only while the wanderer is far away.
const SETTLERS = [{ role: 'leader', name: 'Bandenführer' }, { role: 'shield', name: 'Schildträger' }, { role: 'archer', name: 'Aschenplünderer' }, { role: 'mage', name: 'Aschenhexer' }, { role: 'melee', name: 'Aschenplünderer' }];
let campCheckAt = 0;
function spawnSettler(index, group, role, name, seed) {
  const c = SITES.camp, a = index * 2.1 + .5, x = c.x + Math.cos(a) * 3, z = c.z + Math.sin(a) * 3;
  const mage = role === 'mage', e = { kind: 'bandit', name, x, z, hp: mage ? 60 : 80, maxHp: mage ? 60 : 80, settler: index, home: v3(x, 0, z), calm: !(group === 'camp' && game.flags.captain_hostile) };
  e.archer = role === 'archer'; e.mage = mage; e.shield = role === 'shield';
  // Never borrow the name of someone you spared or someone already standing here.
  const taken = new Set([...sparedPeople().map(p => p.name), ...enemies.map(o => o.personName)]);
  let n = seed + index; for (let k = 0; k < PERSON_NAMES.length && taken.has(PERSON_NAMES[n % PERSON_NAMES.length]); k++) n++;
  e.lookIndex = 1 + index % 3; e.personName = PERSON_NAMES[n % PERSON_NAMES.length];
  e.look = mage ? mageLook(e.lookIndex) : banditLook(e.lookIndex); if (e.archer) archerLook(e.look);
  e.model = dressed(e.look); e.model.position.set(x, world.heightAt(x, z), z); scene.add(e.model);
  e.animator = createAnimator(e.model); e.cooldown = 1; e.stride = 0; e.dead = false;
  enemies.push(e);
  const archetype = mage ? 'mage' : e.shield ? 'shieldbearer' : e.archer ? 'archer' : role === 'leader' ? 'leader' : 'veteran';
  ai.attach(e, { group, id: `${e.personName}`, seed: seed * 31 + index, archetype, territorial: true,
    schedule: campSchedule(SITES.camp, world.heightAt, e.archer ? 'archer' : role === 'leader' ? 'leader' : 'melee') });
  return e;
}
/** Settlers and reinforcements as the flags say (after a load, or when they arrive). */
function restoreSettlers() {
  for (const e of [...enemies]) if (e.settler !== undefined) { ai.detach(e); e.model.removeFromParent(); enemies.splice(enemies.indexOf(e), 1); }
  const f = game.flags, lost = f.camp_lost || 0;
  if (f.camp_state === 'resettled') {
    const band = SETTLERS.filter(s => s.role !== 'mage' || (f.ai_fire || 0) >= 2 || (f.ai_bow || 0) >= 3);
    band.forEach((s, i) => { if (!(lost & 1 << i)) spawnSettler(i, 'camp_neu', s.role, s.name, f.camp_seed || 1); });
  }
  for (let k = 0; k < (f.camp_reinf || 0); k++) if (!(lost & 1 << (8 + k))) spawnSettler(8 + k, 'camp', k % 2 ? 'archer' : 'shield', 'Aschenplünderer', 77 + k);
}
// The newcomers bury what is left of the old band (and keep its belongings).
function buryOldCamp() {
  for (const e of enemies) if (e.dead && e.ai?.group === 'camp' && e.settler === undefined) { e.ragdoll?.dispose(); e.ragdoll = null; e.loot = null; e.buried = true; e.model.visible = false; }
}
function updateCampDays(dt) {
  if ((campCheckAt -= dt) > 0) return;
  campCheckAt = 1.5;
  const f = game.flags, day = f.ai_day || 0, c = SITES.camp, far = Math.hypot(player.position.x - c.x, player.position.z - c.z) > 170;
  const old = enemies.filter(e => e.ai?.group === 'camp' && e.settler === undefined), rauk = old.find(e => e.storyId);
  const living = enemies.filter(e => e.ai?.group === 'camp' && !e.dead && !e.gone);
  const state = f.camp_state || 'occupied';
  // The captain dead and at most one left: the camp is given up.
  if (state === 'occupied' && rauk?.dead && living.length <= 1) { f.camp_state = 'abandoned'; f.camp_day = day; }
  if (f.camp_state === 'abandoned') for (const e of living) {
    // The last of them pack up and go once nobody is watching.
    if (far || e.model.position.distanceTo(player.position) > 90) { e.gone = true; e.calm = true; e.model.visible = false; e.ai.hostility = 'pacified'; }
  }
  if (!far) return;
  // A captain who lost men gets new ones after two days (armed for a fight if you started one).
  if (state === 'occupied' && rauk && !rauk.dead && (f.camp_reinf || 0) < 2 && f.camp_loss_day !== undefined && day >= f.camp_loss_day + 2
      && old.some(e => e.dead && !e.storyId)) { f.camp_reinf = (f.camp_reinf || 0) + 1; f.camp_loss_day = day; restoreSettlers(); }
  // Abandoned for two days: a new band moves in.
  if (f.camp_state === 'abandoned' && day >= f.camp_day + 2) { f.camp_state = 'resettled'; f.camp_seed = 1 + day * 7 % 97; f.camp_lost = 0; f.camp_reinf = 0; buryOldCamp(); restoreSettlers(); }
}
let aiDebug = false, aiDebugAt = 0;
const aiDebugPanel = Object.assign(document.createElement('div'), { id: 'ai-debug', hidden: true }); document.body.append(aiDebugPanel);
const MOOD = { surrendered: 'ERGIBT SICH · E: WERTSACHEN FORDERN / ZIEHEN LASSEN', fleeing: 'FLIEHT', pacified: 'FRIEDLICH', grateful: 'ERKENNT DICH WIEDER',
  demanding: 'VERLANGT WEGZOLL · E: ZAHLEN', territorial: 'WACHSAM', searching: 'SUCHT DICH', suspicious: 'MISSTRAUISCH' };
function updateEnemies(dt) {
  const daylight = THREE.MathUtils.smoothstep(Math.sin((worldClock.hour - 6) / 24 * Math.PI * 2), -.16, .3);
  ai.update(dt, perceivablePlayer(), { daylight, hour: worldClock.hour, truce: !!game.flags.camp_truce });
  // Someone in a conversation stands and listens.
  for (const e of enemies) if (e.ai && talkingNPC?.model === e.model) Object.assign(e.ai.intent, { goal: null, face: player.position, pose: null, attack: false });
  for (const e of enemies) { e.motionLock = motion.locked(e.model) || !!motion.heldBy(e.model) || !!motion.holding(e.model); e.heldByPlayer = motion.heldBy(e.model) === playerModel; }
  const holder = motion.heldBy(playerModel); aiPlayer.heldBy = holder ? enemies.find(e => e.model === holder) ?? null : null;
  combat.update(dt);
  updateEnemyHolds(dt);
  motion.simulate(dt);
  if (!motion.isDown(playerModel)) playerModel.position.copy(player.position);
  updateCampDays(dt);
  if (aiDebug && (aiDebugAt -= dt) <= 0) {
    aiDebugAt = .25;
    aiDebugPanel.textContent = `HUMANITY AI · F6 · Zeit ${ai.time.toFixed(1)} s · Geräusche ${ai.sounds.size} · Lager ${game.flags.camp_state || 'besetzt'} · Tag ${game.flags.ai_day || 0}\n` + ai.debugLines(player.position, 8).join('\n')
      + '\n— zuletzt gerufen —\n' + ai.spoken.slice(-6).join('\n');
    for (const e of enemies) if (e.ai && !e.dead && e.model.position.distanceTo(player.position) < 45)
      barks.say(e.model, `${e.ai.id} · ${e.ai.hostility} · ${e.ai.action.id}${e.ai.token ? ' [Slot]' : ''} · F ${e.ai.emotion.fear.toFixed(2)} · ${e.ai.action.reason}`, { kind: 'debug', duration: .5 });
  }
  barks.update();
  let nearest=null,distance=12;
  for(const e of enemies){const d=e.model.position.distanceTo(player.position);if(!e.dead&&d<distance){nearest=e;distance=d;}}
  show('enemy-hud',!!nearest);
  if(nearest){
    $('enemy-name').textContent=nearest.name;$('enemy-fill').style.width=100*Math.max(0,nearest.hp)/nearest.maxHp+'%';
    $('enemy-intent').textContent=MOOD[nearest.ai?.hostility]??(nearest.casting==='bolt'?'WIRKT FEUER · AUSWEICHEN ODER DECKUNG':nearest.casting==='heal'?'HEILT EINEN VERBÜNDETEN · UNTERBRECHEN':nearest.shieldUp?'SCHILD ERHOBEN · VON DER SEITE ANGREIFEN':nearest.windup>0&&nearest.archer?'SPANNT DEN BOGEN · DECKUNG HOCH ODER HINTER ETWAS':nearest.windup>0?'ANGRIFF · BLOCKEN ODER AUSWEICHEN':nearest.stagger>0?'TAUMELT':combat.guarding?'DECKUNG':tip('LINKSKLICK · ANGRIFF','ANGRIFF'));
    $('enemy-hud').classList.toggle('threat',nearest.windup>0);
  }
}
let debugCamera = null;
const FLY_SPEED = 18;
graphics.info = () => {
  const p = player.position, s = world.streamer.state(), slow = Object.entries(s.timing || {}).map(([k, t]) => `${k} ${t.max.toFixed(0)}`).join(' ');
  return `X ${p.x.toFixed(0)} · Y ${p.y.toFixed(0)} · Z ${p.z.toFixed(0)}${player.fly ? ' · FLUG' : ''}
Chunk-Jobs max ms: ${slow}`;
};
function toggleFlight() {
  player.fly = !player.fly;
  if (!player.fly) { player.grounded = false; player.velocityY = 0; }
  graphics.setDebug(player.fly);
  toast(player.fly ? 'DEBUG-FLUG AN · WASD + MAUS · LEERTASTE/C HOCH/RUNTER · SHIFT SCHNELL · F4 AUS' : 'DEBUG-FLUG AUS', 2600);
}
/** After a teleport: no interpolation smear, camera and body snap to the new spot. */
function snapPlayerView() { player.renderPosition = null; player.prevPosition = null; player.modelYaw = player.yaw; if (player.velocity) player.velocity.set(0, 0, 0); cameraRig.pivotY = null; }
const cameraRig = { zoom: 4.6, distance: 4.6, length: 4.6, pivotY: null };
function updateCamera(dt) {
  if (debugCamera) { const t = debugCamera.follow ? player.position.clone().add(debugCamera.target) : debugCamera.target; camera.position.copy(debugCamera.follow ? player.position.clone().add(debugCamera.position) : debugCamera.position); camera.lookAt(t); return; }
  if(talkingNPC&&game.modal==='dialog'){
      // Over the shoulder: the camera stands behind the wanderer's right shoulder, the speaker faces you
      // and sits in the upper third, the dialogue panel below. Geometry in between pulls the camera in.
      const npc=talkingNPC,scale=npc.model.scale.x,yaw=npc.dialogFacing;
      const head=npc.model.position.clone().add(v3(0,2.05*scale,0)),me=player.position.clone().add(v3(0,2.05,0));
      const toNpc=head.clone().sub(me).setY(0),gap=Math.max(.6,toNpc.length());toNpc.normalize();
      const right=v3(-toNpc.z,0,toNpc.x);
      const desired=me.clone().addScaledVector(toNpc,-1.35).addScaledVector(right,1.0).add(v3(0,.22,0));
      for(let i=0;i<10&&world.blocked(desired.x,desired.z,.25,desired.y-.4,.6);i++)desired.lerp(head,.12);
      if(!dialogCamReady){camera.position.copy(desired);dialogCamReady=true;}else camera.position.lerp(desired,1-Math.exp(-dt*8));
      const aim=head.clone().addScaledVector(toNpc,-Math.min(.4,gap*.2)).add(v3(0,-.62,0));
      camera.lookAt(aim);
      npc.model.rotation.y=yaw;playerModel.rotation.y=Math.atan2(-toNpc.x,-toNpc.z);playerModel.visible=player.mode==='third';return;
  }
  if(game.cinematic?.director){ const f=game.cinematic.frame; if(f){ const [x,y,z]=f.position,[tx,ty,tz]=f.target;
    const eye=v3(x,world.heightAt(x,z)+y,z),aim=v3(tx,world.heightAt(tx,tz)+ty,tz);
    for(let i=0;i<12&&world.blocked(eye.x,eye.z,.28,eye.y-.4,.6)&&eye.distanceTo(aim)>1.2;i++)eye.lerp(aim,.12);
    camera.position.copy(eye); camera.lookAt(aim); if(f.fov&&camera.fov!==f.fov){camera.fov=f.fov;camera.updateProjectionMatrix();} } return; }
  if(game.cinematic){
    const focus=game.quest==='complete'?world.landmarks.shrine:world.landmarks.village;
    const angle=2.5+game.cinematicTime*.055;
    camera.position.set(focus.x+Math.sin(angle)*13,world.heightAt(focus.x,focus.z)+7,focus.z+Math.cos(angle)*13);
    camera.lookAt(focus.x,world.heightAt(focus.x,focus.z)+2,focus.z);return;
  }
  // Follow the interpolated position so 144 Hz frames never show 60 Hz steps.
  const eye = (player.renderPosition || player.position).clone().add(v3(0, 2.30, 0));
  const forward = v3(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
  if (player.mode === 'first') {
    camera.position.copy(eye); camera.lookAt(eye.clone().add(forward)); return;
  }
  // Over-the-shoulder pivot; vertical jitter from terrain is smoothed, horizontal follow is exact.
  const right = v3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  // Aiming the bow, the camera moves out over the right shoulder so the reticle clears the head.
  const pivot = eye.clone().add(v3(0, .12 - .55 * bowView.raise, 0)).addScaledVector(right, .42 + .95 * bowView.raise);
  cameraRig.pivotY = cameraRig.pivotY === null || dt >= 1 ? pivot.y : cameraRig.pivotY + (pivot.y - cameraRig.pivotY) * (1 - Math.exp(-dt * 14));
  pivot.y = cameraRig.pivotY;
  // Drawing the bow pulls the camera in over the shoulder.
  const zoom = bowView.raise > .01 ? THREE.MathUtils.lerp(cameraRig.zoom, Math.min(cameraRig.zoom, 2.6), bowView.raise) : cameraRig.zoom;
  cameraRig.distance += (zoom - cameraRig.distance) * (1 - Math.exp(-dt * 8));
  const elevation = clamp(.3 - .3 * bowView.raise - player.pitch * .85, -.45, 1.25);
  const boom = v3(Math.sin(player.yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(player.yaw) * Math.cos(elevation));
  // The boom shortens instantly when something blocks it and eases back out.
  let free = cameraRig.distance;
  for (let t = .3; t <= cameraRig.distance; t += .2) {
    const sample = pivot.clone().addScaledVector(boom, t);
    if (sample.y < world.heightAt(sample.x, sample.z) + .3 || world.blocked(sample.x, sample.z, .15, sample.y - .1, .2)) { free = Math.max(.6, t - .35); break; }
  }
  cameraRig.length = free < cameraRig.length || dt >= 1 ? free : cameraRig.length + (free - cameraRig.length) * (1 - Math.exp(-dt * 3.5));
  camera.position.copy(pivot).addScaledVector(boom, cameraRig.length);
  camera.lookAt(pivot.clone().add(forward.clone().multiplyScalar(3.2)));
}
function updateInteractions() {
  const target = nearestInteraction();
  show('interact', !!target && !game.paused);
  if (target) $('interact-text').textContent = target.type === 'npc' ? `Mit ${target.npc.name} sprechen` : target.type === 'stash' ? 'Reisetruhe öffnen' : target.type === 'drop' ? 'Beutel durchsuchen' : target.type === 'corpse' ? (target.enemy.prey ? `${target.enemy.name} ausnehmen` : `${target.enemy.name} durchsuchen · ${tip('[E halten]', '[Nutzen halten]')} Ziehen`) : target.type === 'pickup' ? `${ITEMS[target.prop.item].name} nehmen` : target.type === 'door' ? (target.door.target > .5 ? 'Tür schließen' : 'Tür öffnen') : target.type === 'furniture' ? (target.spot.kind === 'sleep' ? 'Schlafen bis zum Morgen' : 'Truhe öffnen') : target.type === 'story' ? target.pickup.label : target.type === 'lore' ? target.marker.readLabel : target.type === 'arrow' ? 'Pfeil ziehen' : target.type === 'yielded' ? (target.enemy.ai.robbed ? `${target.enemy.name} ziehen lassen` : 'Wertsachen fordern') : target.type === 'toll' ? `Wegzoll zahlen (${AI.toll} Gold)` : '';
  touch?.setInteract(target && !game.paused ? $('interact-text').textContent : null);
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.ttl -= dt;
    if (p.ttl <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); particles.splice(i, 1); continue; }
    p.vel.y -= 6 * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.scale.setScalar(clamp(p.ttl, .1, 1)); p.mesh.material.opacity = clamp(p.ttl, 0, 1);
  }
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'F3') { event.preventDefault(); if (!event.repeat) graphics.toggleDebug(); return; }
  if (event.code === 'F4') { event.preventDefault(); if (!event.repeat && game.started && !game.cinematic) toggleFlight(); return; }
  if (game.modal === 'inventory') { inventoryUI.handleKey(event); return; }
  if (event.target?.matches?.('select, input, textarea')) { if (event.code === 'Escape') setModal(null); return; }
  if (event.repeat && ['Escape', 'KeyI', 'KeyJ'].includes(event.code)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (game.cinematic) { if (['Escape','Space','Enter'].includes(event.code)) endCinematic(); return; }
  if (event.code === 'Escape') { if (game.modal) setModal(null); else if (game.started) setModal('pause'); return; }
  if (event.code === 'KeyI' && game.started) { setModal(game.modal === 'inventory' ? null : 'inventory'); return; }
  if (event.code === 'KeyJ' && game.started) { setModal(game.modal === 'journal' ? null : 'journal'); return; }
  if (game.paused) return;
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyE') grabbing.pressed = performance.now();
  if (event.code === 'KeyG' && game.started) playerGrab();
  if (event.code === 'CapsLock') { player.walkMode = !player.walkMode; toast(player.walkMode ? 'GEHEN' : 'LAUFEN', 900); }
  if (event.code === 'Space' && motion.heldBy(playerModel) && player.stamina >= 5) { player.stamina -= 5; motion.command(playerModel, 'wrench'); }
  if (event.code === 'F6') { aiDebug = !aiDebug; aiDebugPanel.hidden = !aiDebug; if (!aiDebug) barks.clear('debug'); toast(aiDebug ? 'KI-ANSICHT AN · F6' : 'KI-ANSICHT AUS', 1400); return; }
  if (event.code === 'KeyF') { player.mode = player.mode === 'third' ? 'first' : 'third'; toast(player.mode === 'third' ? 'THIRD-PERSON-ANSICHT' : 'FIRST-PERSON-ANSICHT', 1500); }
  if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3' || event.code === 'Digit4') selectTool(Number(event.code.at(-1)) - 1);
  if (event.code === 'KeyQ') heal();
  if (event.code === 'KeyR') combat.setGuard(true);
});
window.addEventListener('keyup', (event) => { keys.delete(event.code);if(event.code==='KeyE'&&grabbing.pressed!==null){const held=performance.now()-grabbing.pressed;grabbing.pressed=null;if(physics.holding)physics.release();else if(held<320&&!game.paused){if(motion.holding(playerModel))motion.command(playerModel,'takedown');else interact();}}if(event.code==='KeyR')combat.setGuard(false); });
function suspendGame() { keys.clear(); if (game.started && !game.paused) { setModal('pause'); saveGame(false); } }
window.addEventListener('blur', suspendGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendGame(); });
window.addEventListener('pagehide', () => { if (game.started) saveGame(false); });
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || game.paused) return;
  player.yaw -= event.movementX * .0025 * settings.mouseSensitivity;
  player.pitch = clamp(player.pitch - event.movementY * .0021 * settings.mouseSensitivity * (settings.invertY ? -1 : 1), -1.15, 1.18);
});
// Primary (left button / touch "Schlag") and secondary (right button / touch "Block") actions.
function primaryDown() {
  if (!game.started) return;
  if (game.cinematic) { endCinematic(); return; }
  if (game.paused) return;
  if (physics.holding) { const d = camera.getWorldDirection(v3(0, 0, 0)); physics.release(d.multiplyScalar(11).add(v3(0, 2, 0))); }
  else attack();
}
function primaryUp() { if (player.tool === 3 && combat.archery?.release()) updateHUD(); }
// With the potion in hand the block button shakes the flask instead (firstPerson.js, systems/liquid.js).
function secondaryDown() { if (game.started && !game.paused && !game.cinematic) { if (player.tool === 3) combat.archery?.cancel(); else if (player.tool === 2) player.shaking = true; else combat.setGuard(true); } }
function secondaryUp() { combat.setGuard(false); player.shaking = false; }
renderer.domElement.addEventListener('mousedown', (event) => {
  if (!game.started) return;
  if (event.button === 2) { secondaryDown(); return; }
  if (event.button !== 0) return;
  // The first click only captures the mouse; touch has no pointer lock.
  if (!game.cinematic && !game.paused && !touchMode && document.pointerLockElement !== renderer.domElement) lockPointer();
  else primaryDown();
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{if(!game.started||game.paused)return;cameraRig.zoom=clamp(cameraRig.zoom+Math.sign(e.deltaY)*.6,2,7.5);},{passive:true});
window.addEventListener('mouseup',e=>{if(e.button===2)secondaryUp();if(e.button===0)primaryUp();});
$('new-game').addEventListener('click', () => { if (touchMode) toggleFullscreen(true); openCreator(); });
// ── Character creation: the real player model stands in the village square while you edit it.
const creatorSpot = { x: -6.2, z: 13.6, yaw: -2.5 };
let creating = null, pendingAppearance = null;
const creator = createCharacterCreator($('character-creator'), {
  initial: player.appearance,
  onChange: a => { restyleCharacter(playerModel, { appearance: a }); playerModel.userData.outfitKey = null; },
  onFocus: focus => { if (creating) creating.focus = focus; },
  onConfirm: a => { pendingAppearance = a; closeCreator(); startGame(false); },
  onCancel: () => { closeCreator(); show('start-screen', true); },
});
function openCreator() {
  creating = { focus: 'body', spin: 0, zoom: 1, drag: null };
  show('start-screen', false); show('character-creator', true); creator.open();
  playerModel.visible = true;
  playerModel.position.set(creatorSpot.x, world.heightAt(creatorSpot.x, creatorSpot.z), creatorSpot.z);
  playerModel.rotation.y = creatorSpot.yaw; playerModel.userData.simPos = null;
  restyleCharacter(playerModel, { appearance: creator.value });
}
function closeCreator() { creating = null; creator.close(); show('character-creator', false); camera.clearViewOffset(); }
// Drag the free left side to turn the character, wheel to step closer.
renderer.domElement.addEventListener('pointerdown', e => { if (creating && e.button === 0) creating.drag = e.clientX; });
window.addEventListener('pointermove', e => { if (creating?.drag != null) { creating.spin += (e.clientX - creating.drag) * .012; creating.drag = e.clientX; } });
window.addEventListener('pointerup', () => { if (creating) creating.drag = null; });
renderer.domElement.addEventListener('wheel', e => { if (creating) creating.zoom = clamp(creating.zoom + Math.sign(e.deltaY) * .12, .55, 1.4); }, { passive: true });
$('continue').addEventListener('click', () => { if (touchMode) toggleFullscreen(true); startGame(true); });
$('dialog-close').addEventListener('click', () => setModal(null));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => setModal(null)));
$('resume').addEventListener('click', () => setModal(null));
$('pause-journal').addEventListener('click', () => setModal('journal'));
$('pause-fullscreen').addEventListener('click', () => { toggleFullscreen(); setModal(null); });
$('save').addEventListener('click', () => saveGame(true));
$('restart').addEventListener('click', () => { resetGame(); setModal(null); toast('EIN NEUES ABENTEUER BEGINNT'); });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); graphics.resize(); });
try { show('continue', !!normalizeSave(JSON.parse(localStorage.getItem(saveKey)))); } catch { show('continue', false); }
show('reticle', false);
show('hud', false);
for (const id of ['dialog', 'inventory', 'journal', 'pause', 'subtitle']) show(id, false);
objective();

// Simulation runs at 60 Hz; rendered frames show positions interpolated between
// the last two steps. Anything moved from outside the loop (teleports) is kept.
const trackedActors = () => [playerModel, ...npcs.map(n => n.model), ...enemies.map(e => e.model)];
function restoreSimulation(models) {
  for (const m of models) {
    const u = m.userData;
    if (u.simPos && u.renderPos?.equals(m.position)) { m.position.copy(u.simPos); m.rotation.y = u.simYaw; }
  }
}
function captureSimulation(models) {
  player.prevPosition ??= player.position.clone(); player.prevPosition.copy(player.position);
  for (const m of models) { (m.userData.prevPos ??= new THREE.Vector3()).copy(m.position); m.userData.prevYaw = m.rotation.y; }
}
function interpolateSimulation(models, alpha) {
  (player.renderPosition ??= new THREE.Vector3()).lerpVectors(player.prevPosition || player.position, player.position, alpha);
  for (const m of models) {
    const u = m.userData;
    if (!u.prevPos) continue;
    (u.simPos ??= new THREE.Vector3()).copy(m.position); u.simYaw = m.rotation.y;
    m.position.lerpVectors(u.prevPos, u.simPos, alpha);
    m.rotation.y = u.prevYaw + (THREE.MathUtils.euclideanModulo(u.simYaw - u.prevYaw + Math.PI, Math.PI * 2) - Math.PI) * alpha;
    (u.renderPos ??= new THREE.Vector3()).copy(m.position);
  }
}
let prev = performance.now(), elapsed = 0, frame = 0, accumulator = 0, lastSlosh = 0;
const simulationStep = 1 / 60;
const profile = { sections: {}, last: 0, worst: { total: 0 }, mark(name) { const t = performance.now(); this.sections[name] = (this.sections[name] || 0) + t - this.last; this.last = t; } };
// Dev: ?timerLoop keeps the game running on a timer when the tab is not painted (hidden previews).
const nextFrame = new URLSearchParams(location.search).has('timerLoop') ? cb => setTimeout(() => cb(performance.now()), 16) : cb => requestAnimationFrame(cb);
function animate(now) {
  nextFrame(animate);
  profile.sections = {}; profile.last = performance.now(); const frameStart = profile.last;
  const rawDt = (now - prev) / 1000;
  const dt = Math.min(rawDt, .1); prev = now;
  if (document.hidden) { accumulator = 0; return; }
  elapsed += dt;
  if (game.modal === 'inventory') inventoryUI.update(now);
  if (game.cinematic) {
    game.cinematicTime += dt;
    if (game.cinematic.director) updateIntro(dt);
    // The intro may have ended the cinematic itself just now.
    if (game.cinematic && game.cinematicTime > game.cinematic.duration) endCinematic();
  }
  if (game.started && !game.paused && !game.cinematic) {
    accumulator = Math.min(accumulator + dt, .1);
    const tracked = trackedActors();
    restoreSimulation(tracked);
    while (accumulator >= simulationStep) {
      captureSimulation(tracked);
      updatePlayer(simulationStep); profile.mark('player'); updateEnemies(simulationStep, elapsed); profile.mark('enemies'); updateNPCSimulation(simulationStep); updateTravelers(simulationStep); updateBarriers(simulationStep); profile.mark('npcs');
      accumulator -= simulationStep;
    }
    interpolateSimulation(tracked, accumulator / simulationStep);
    // Creeping (C) or standing still lets you get much closer to game than walking up to it.
    const still = (player.moveSpeed || 0) < .3;
    ambientFx.update(dt, player.position, worldClock.hour, camera, ambientSun.copy(world.sun.position).sub(world.sun.target.position).normalize());
    wildlife.update(dt, [player.position], player.fly ? 0 : player.sneaking ? (still ? 1 : .85) : still ? .6 : 0); updateEncounters(dt);
    if (++frame % 4 === 0) { updateHUD(); updateInteractions(); }
    updateStory(dt);
    profile.mark('hud');
    if (performance.now() - game.lastSave > 45000) saveGame(false);
  } else if (creating) {
    accumulator = 0;
    // The panel covers the right side: shift the projection so the character stands centred in the free part.
    const panel = $('character-creator').querySelector('.cc-panel')?.getBoundingClientRect();
    const free = panel && panel.left > innerWidth * .3 ? panel.left : innerWidth;
    camera.setViewOffset(innerWidth, innerHeight, innerWidth / 2 - free / 2, 0, innerWidth, innerHeight);
    const p = playerModel.position, f = creating.focus === 'face', s = playerModel.scale.y;
    playerModel.rotation.y = creatorSpot.yaw + creating.spin;
    // The camera stays in front of the spot; dragging turns the character, not the view.
    const yaw = creatorSpot.yaw + Math.sin(elapsed * .2) * .06, dist = (f ? 1.5 : 3.5) * creating.zoom, height = (f ? 2.0 : 1.12) * s;
    camera.position.set(p.x - Math.sin(yaw) * dist, p.y + height + (f ? .04 : .3), p.z - Math.cos(yaw) * dist);
    camera.lookAt(p.x, p.y + height, p.z);
  } else if (!game.started) {
    accumulator = 0;
    const p = world.landmarks.village;
    camera.position.set(p.x + Math.sin(elapsed * .055) * 21 + 16, world.heightAt(p.x, p.z) + 14, p.z + Math.cos(elapsed * .055) * 24 + 24);
    camera.lookAt(p.x, 2, p.z);
  }
  else accumulator = 0;
  if (game.started) updateCamera(dt);
  const visualDt = game.modal&&game.modal!=='dialog' ? 0 : dt;
  const voice=voiceStatus();
  profile.mark('camera'); updatePhysics(game.started && !game.paused && !game.cinematic ? dt : 0); profile.mark('physics');
  animateActors(visualDt,voice); profile.mark('actors');
  updateSoundscape(dt);
  compass.update(player.yaw,player.position,compassMarkers());
  profile.mark('sound'); world.update(visualDt, worldClock.hour, camera, player.position); if (game.started) leaveTracks(visualDt); profile.mark('world');
  updateParticles(visualDt);
  combat.effects.update(game.paused?0:dt,camera);
  const kick=combat.effects.shake;camera.rotation.z+=Math.sin(elapsed*83)*kick;
  renderer.info.autoReset=false;renderer.info.reset();
  const hands=game.started&&!game.paused&&!game.cinematic&&player.mode==='first';
  if(hands){firstPerson.update(dt,player,camera,combat.action,combat.guarding,bowView,handLight(dt));const slosh=firstPerson.sloshCue();if(slosh>.25&&elapsed-lastSlosh>.18){lastSlosh=elapsed;combat.effects.sound('slosh');}}
  aimZoom();
  profile.mark('effects'); graphics.render(scene,camera,hands?firstPerson.render:null); profile.mark('render');
  graphics.update(rawDt);
  const total = performance.now() - frameStart;
  if (total > profile.worst.total || now - profile.worst.at > 4000) profile.worst = { total, at: now, ...Object.fromEntries(Object.entries(profile.sections).map(([k, v]) => [k, +v.toFixed(1)])), world: { ...world.profile } };
}
// Compile every shader up front (all sites are still visible here), so nothing compiles mid-game.
graphics.compile(scene, camera);
nextFrame(animate);

// ── Physics: carrying, corpses, kicking props.
const grabbing = { pressed: null };
function updatePhysics(dt) {
  if (dt <= 0) return;
  if (grabbing.pressed !== null && !physics.holding && performance.now() - grabbing.pressed > 320) {
    const origin = camera.position.clone(), dir = camera.getWorldDirection(v3(0, 0, 0));
    const hit = physics.raycast(origin, dir, player.mode === 'first' ? 3.2 : 7.5);
    if (hit && hit.point.distanceTo(player.position) < 3.4) physics.grab(hit, hit.point);
    grabbing.pressed = performance.now() + 1e9; // one attempt per press
  }
  if (physics.holding) {
    const dir = camera.getWorldDirection(v3(0, 0, 0)), heavy = physics.holding.mass > 40;
    const hold = player.position.clone().add(v3(0, heavy ? .4 : 1.5, 0)).addScaledVector(v3(dir.x, 0, dir.z).normalize(), heavy ? 1.4 : 1.25);
    hold.y += heavy ? 0 : dir.y * 1.2;
    physics.moveGrab(hold);
  }
  if (player.velocity) physics.push(player.position, .45, player.velocity);
  physics.step(dt);
}
// ── The hunting bow on the wanderer: across the back while travelling, in the left hand with tool 4.
// Drawing turns the body side-on (animator), both arms meet bow and string by IK, the string runs
// through the right hand, and the arrow flies toward whatever the reticle covers.
const bowView = { raise: 0, draw: 0, release: 0, inHand: false, nocked: false, equipped: false };
let playerBow = null;
const bowAimDir = v3(0, 0, -1), bowPoint = v3(0, 0, 0), bowPole = v3(0, 0, 0), bowShoulder = v3(0, 0, 0), bowHand = v3(0, 0, 0), bowSide = v3(0, 0, 0), bowAimed = new THREE.Quaternion();
const aimProbe = { point: v3(0, 0, 0), normal: v3(0, 0, 0) };
function bowAim(origin, direction) {
  const eye = camera.position, view = camera.getWorldDirection(v3(0, 0, 0)), from = eye.clone(), to = v3(0, 0, 0);
  let target = eye.clone().addScaledVector(view, 140);
  // March the view ray a unit at a time; the first wall or slope it meets is the mark.
  for (let t = 1; t <= 140; t++) {
    to.copy(eye).addScaledVector(view, t);
    if (to.y < world.heightAt(to.x, to.z) || world.segmentBlocked(from, to, 0)) { if (traceSpellSurface(world, from, to, aimProbe)) target = aimProbe.point.clone(); break; }
    from.copy(to);
  }
  // `origin` is the nock: the arrow's head starts at the bow's rest (third person) or just ahead of the eye.
  if (player.mode === 'third' && playerBow?.bow.parent && bowView.inHand) playerBow.bow.localToWorld(origin.set(-.08, .18, -.05));
  else origin.copy(eye).addScaledVector(view, .6).add(v3(0, -.1, 0));
  direction.subVectors(target, origin).normalize();
  origin.addScaledVector(direction, -BOW.length);
}
function updateBowView(dt) {
  const state = combat.archery?.bow;
  bowView.equipped = !!ITEMS[player.equipment.ranged];
  bowView.inHand = bowView.equipped && player.tool === 3 && (!!state || performance.now() < (player.drawnUntil || 0));
  // Raised while drawing and a moment after the shot, then lowered again.
  bowView.raise = THREE.MathUtils.damp(bowView.raise, state ? 1 : 0, state ? 10 : 5, dt);
  bowView.draw = state && !state.release ? state.draw : 0;
  bowView.release = state?.release ? state.release / .3 : 0;
  bowView.nocked = !!state && !state.release;
}
function poseBow(cine) {
  playerBow ??= createHeldBow(scene);
  if (!playerBow) return;
  const rig = playerModel.userData.rig, show = bowView.equipped && !cine && playerModel.visible && !!rig?.grip_left && !!rig.chest;
  playerBow.setVisible(show);
  if (!show) return;
  const bow = playerBow.bow, parent = bowView.inHand ? rig.grip_left : rig.chest;
  if (bow.parent !== parent) parent.add(bow);
  if (!bowView.inHand) {
    // Slung flat across the back from the right shoulder to the left hip, crossing the quiver; turned
    // into the back's plane first, then tilted about the body's own front-back axis.
    bow.position.set(.02, .12, .27); bow.rotation.set(0, Math.PI / 2, -.65, 'ZYX');
    playerBow.update(0, null, false); return;
  }
  const k = bowView.raise;
  bow.position.set(0, 0, 0); bow.rotation.order = 'XYZ'; bow.quaternion.identity();
  if (k < .01) { playerBow.update(0, null, false); return; }
  bowSide.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  // The bow arm points at what the reticle covers (fifteen units out along the view), straight out
  // from the shoulder (from low at the hip as it comes up).
  rig.arm_upper_left.getWorldPosition(bowShoulder);
  bowAimDir.copy(camera.position).addScaledVector(camera.getWorldDirection(bowPole), 15).sub(bowShoulder).normalize();
  // Held a little right of the eye line, so the bow stands clear of the (big, blocky) head in the
  // over-the-shoulder view; arrows still leave it for the reticle.
  bowPoint.copy(bowShoulder).addScaledVector(bowAimDir, 1.4 * k + .2).addScaledVector(bowSide, .32 * k).add(v3(0, -1.1 * (1 - k), 0));
  bowPole.copy(bowShoulder).add(v3(0, -1, 0)).addScaledVector(bowSide, -.6);
  solveArm(playerModel, 'left', bowPoint, bowPole);
  aimObject(bow, bowAimDir, -.12); bowAimed.copy(bow.quaternion); bow.quaternion.identity().slerp(bowAimed, k);
  // String hand on the string, elbow out behind at shoulder height.
  playerBow.pullPoint(bowPoint, bowView.draw, bowAimDir);
  rig.arm_upper_right.getWorldPosition(bowShoulder);
  bowPole.copy(bowShoulder).addScaledVector(bowSide, .9).addScaledVector(bowAimDir, -.8).add(v3(0, .25, 0));
  solveArm(playerModel, 'right', bowPoint, bowPole);
  rig.grip_right.getWorldPosition(bowHand);
  playerBow.update(bowView.draw, bowView.nocked || bowView.draw > 0 ? bowHand : null, bowView.nocked);
}
// An enemy archer's bow: in the left hand, raised and drawn at the wanderer while it aims (arm IK as
// for the wanderer), lowered otherwise; it stays with the body until the loot takes it.
const enemyAim = v3(0, 0, 0), enemyShoulder = v3(0, 0, 0), enemyPoint = v3(0, 0, 0), enemyPole = v3(0, 0, 0), enemyHand = v3(0, 0, 0);
// ── HUMANITY MOTION wiring: who has a body, what it feels, what its hands do.
const MOTION_ARMOR = { 'aschenrüstung': .8, 'hauptmannsplatte': .9, 'wachpanzer': .8 };
const STILL_ACTIVITIES = new Set(['sleep', 'sit', 'swim', 'lay', 'kneel', 'pray', 'lean', 'slump', 'wash', 'draw_water', 'work_farm']);
let firesAdded = false;
function registerBodies() {
  if (!firesAdded) { firesAdded = true; motion.addFire({ x: SITES.camp.x, y: world.heightAt(SITES.camp.x, SITES.camp.z), z: SITES.camp.z }); }
  if (!motion.get(playerModel)) motion.add(playerModel, { kind: 'player', animator: playerAnimator, pos: () => player.position, grabbable: false,
    setYaw: y => { player.modelYaw = y; playerModel.rotation.y = y; },
    state: () => ({ armor: MOTION_ARMOR[player.equipment.armor] ?? .1, guard: combat.guarding, attacking: !!combat.action, running: (player.moveSpeed || 0) > 6 ? 1 : 0,
      stamina: player.stamina / player.maxStamina, hp: player.hp, maxHp: player.maxHp, dead: player.hp <= 0, handFree: !combat.archery?.bow && combat.action?.kind !== 'cast',
      busy: !!combat.action, feet: player.grounded && !player.swimming && !player.fly ? 1 : 0, power: .55 }) });
  for (const e of enemies) if (e.kind === 'bandit' && !motion.get(e.model)) motion.add(e.model, { kind: 'enemy', ref: e, animator: e.animator, pos: () => e.model.position, grabbable: true,
    state: () => ({ armor: e.storyId ? .6 : e.shield ? .45 : .15, guard: e.blocking > 0 || !!e.shieldUp, attacking: e.windup > 0 || e.strikeT > 0, stamina: (e.ai?.stamina ?? 100) / 100,
      hp: e.hp, maxHp: e.maxHp, dead: e.dead || !!e.gone, handFree: !e.shield && !(e.archer && !e.ai?.meleeMode), busy: e.windup > 0 || !!e.casting, idle: e.calm && !e.ai?.alert,
      feet: ['sleep', 'sit'].includes(e.ai?.intent.pose) ? 0 : 1, power: e.storyId ? .8 : e.ai?.personality.label === 'Berserker' ? .75 : .5 }) });
  for (const npc of npcs) if (!motion.get(npc.model)) motion.add(npc.model, { kind: 'npc', ref: npc, animator: npc.animator, pos: () => npc.model.position, movable: false, grabbable: false,
    state: () => ({ armor: npc.job === 'guard' ? .4 : 0, hp: 1, maxHp: 1, dead: !!npc.dead, idle: !npc.life?.activity || ['idle', 'stand', 'watch', 'wait'].includes(npc.life.activity),
      feet: STILL_ACTIVITIES.has(npc.life?.activity) || npc === talkingNPC && game.cinematic ? 0 : 1 }) });
  for (const model of [...motion.actors.keys()]) if (!model.parent) motion.remove(model);
}
/** A blow from the wanderer lands: where it lands follows the swing (high or low with the view, from the side the blade comes). */
function enemyImpact(e, { kind, from, combo = 0, amount = 0, shield = false, magic = false, force }) {
  if (shield) return motion.impact(e.model, { shield: true, force, from });
  const p = e.model.position, s = e.model.scale.y || 1, fwd = v3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), right = v3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const centre = p.clone().add(v3(0, 1.4 * s, 0));
  if (kind === 'arrow') { const dir = centre.clone().sub(from).normalize(); return motion.impact(e.model, { from, point: from.clone().addScaledVector(dir, 2), force: .55, damage: amount, dir }); }
  const side = combo === 0 ? 1 : combo === 1 ? -1 : 0;
  const point = p.clone().add(v3(0, THREE.MathUtils.clamp(1.45 + player.pitch * 1.6, .45, 2.1) * s, 0)).addScaledVector(right, side * .25);
  const dir = fwd.clone().addScaledVector(right, -side * .7).normalize();
  const strength = kind === 'parried' ? 1.7 : magic ? 1.9 : combo === 2 ? 2.3 : 1.15;
  return motion.impact(e.model, { from: player.position, point, force: strength, damage: amount, dir });
}
function playerImpact(e, { damage = 0, heavy = false, blocked = false }) {
  if (player.mode === 'first') firstPerson.hit(blocked ? .6 : heavy ? 1 : .6, blocked);
  if (blocked) return motion.impact(playerModel, { shield: true, force: .9 });
  return motion.impact(playerModel, { from: e.model.position, point: player.position.clone().add(v3(0, 1.5, 0)), force: heavy ? 1.7 : 1.05, damage });
}
/** A bandit's hands on the wanderer (HUMANITY AI asks, the body decides). */
function enemyGrapple(e, kind) {
  if (motion.holding(e.model) || motion.locked(e.model) || player.hp <= 0) return;
  if (kind === 'grab') { const r = motion.grab(e.model, playerModel); if (r.ok) e.holdFor = 2.4 + Math.random() * 1.6; return; }
  const d = player.position.distanceTo(e.model.position);
  if (d > 1.6) return;
  e.strikeT = .3; combat.effects.sound('impact');
  motion.impact(playerModel, { from: e.model.position, dir: player.position.clone().sub(e.model.position), force: e.shield ? 1.9 : 1.5 });
}
/** G: take hold of whoever stands in front of you, or let go. */
function playerGrab() {
  if (player.hp <= 0 || motion.locked(playerModel) || game.modal) return;
  const r = motion.grab(playerModel);
  if (!r.ok) toast(`GREIFEN: ${r.reason.toUpperCase()}`, 1300);
}
/** Bandits holding the wanderer keep them for the others, then throw them off. */
function updateEnemyHolds(dt) {
  for (const e of enemies) if (motion.holding(e.model) === playerModel && (e.holdFor = (e.holdFor ?? 3) - dt) <= 0) { motion.command(e.model, 'shove'); e.holdFor = undefined; }
}
const YIELDING = new Set(['surrendered', 'pacified', 'grateful']);
function motionWantsFree(t, h, g) {
  if (t.kind !== 'enemy') return 0;
  const b = t.ref.ai; if (!b || YIELDING.has(b.hostility)) return 0;
  if ((t.saidHeld = (t.saidHeld || 0) - .016) <= 0) { t.saidHeld = 3; ai.say(b, 'held', 4); }
  return Math.min(1.3, .6 + b.traits.aggression * .3 + b.emotion.fear * .3);
}
function motionEvent(type, a, other, data) {
  if (type === 'grab' && a.kind === 'player') {
    toast(tip('GEPACKT · LMB STOSSEN · E NIEDERWERFEN · G LOSLASSEN', 'GEPACKT · SCHLAG STÖSST · NUTZEN WIRFT NIEDER · PACKEN LÄSST LOS'), 2600);
    // Laying hands on someone is an attack, the same as a blow.
    const e = other.ref;
    if (e && !YIELDING.has(e.ai?.hostility)) { if (e.calm && (e.ai?.group === 'camp' || !e.ai)) provokeCamp(); e.calm = false; if (e.ai) ai.hurt(e, 1, player.position.clone()); }
  }
  if (type === 'grab' && other?.kind === 'player') { toast(tip('DU WIRST FESTGEHALTEN · LEERTASTE / LMB: LOSREISSEN', 'DU WIRST FESTGEHALTEN · SPRUNG / SCHLAG: LOSREISSEN'), 2400); if (a.ref?.ai) ai.say(a.ref.ai, 'heldYou', 6); }
  if (type === 'refused' && a.kind === 'player') toast('ER STEHT ZU FEST · ERST GEGEN DIE WAND DRÜCKEN ODER AUS DEM TRITT BRINGEN', 2200);
  if (type === 'escaped' && a.kind === 'player') toast('LOSGERISSEN', 1200);
  if (type === 'escaped' && other?.kind === 'player') toast('ER REISST SICH LOS', 1200);
  if (type === 'fall') {
    combat.effects.sound('impact');
    if (a.kind === 'player') { toast('ZU BODEN GEGANGEN', 1300); if (player.mode === 'first') { player.mode = 'third'; player.forcedThird = true; } }
    if (a.ref?.ai) ai.noise('fight', a.model.position);
  }
  if (type === 'up' && a.kind === 'player' && player.forcedThird) { player.mode = 'first'; player.forcedThird = false; }
  // Held down on the ground, most give up; the stubborn and the captain fight on.
  if (type === 'takedown' && other?.ref?.ai) {
    const b = other.ref.ai; b.emotion.fear = Math.min(1, b.emotion.fear + .35);
    if (!b.noSurrender && (b.emotion.fear > .5 || other.ref.hp < other.ref.maxHp * .45 || b.traits.courage < .45)) {
      b.hostility = 'surrendered'; b.disarmed = true; b.since = ai.time; b.token = false; ai.say(b, 'pinned', 0); toast(`${(other.ref.personName || other.ref.name).toUpperCase()} GIBT AUF`, 1800);
    }
  }
}
// What a person holds follows their state: the blade in hand to fight, nothing while yielding (it lies
// at their feet, where a feigned surrender looks for it), an archer's sword only once pressed close.
function holdWeapons(e) {
  const b = e.ai, blade = e.mage ? 'staff' : WEAPON_MODELS[e.look?.equipment.weapon] ?? null;
  const want = b.disarmed || e.calm && !b.alert && !e.mage ? null : e.archer && !b.meleeMode ? null : blade;
  if (e.held !== want) { const item = equipItem(e.model, want); if (item && want === 'staff') { item.rotation.set(-.15, 0, 0); item.scale.setScalar(.95); item.position.set(0, -.2, 0); } e.held = want; }
  if (e.shield) holdShield(e);
  if (b.disarmed && !e.dropped && blade) {
    const item = heldItem(blade);
    if (item) { const p = e.model.position, a = e.model.rotation.y; item.position.set(p.x - Math.sin(a) * .9 + Math.cos(a) * .5, world.heightAt(p.x, p.z) + .05, p.z - Math.cos(a) * .9 - Math.sin(a) * .5); item.rotation.set(Math.PI / 2, 0, a); scene.add(item); e.dropped = item; }
  } else if (!b.disarmed && e.dropped) { e.dropped.removeFromParent(); e.dropped = null; }
}
// The shield rides on the left forearm: flat against the arm at the side, face forward when raised.
const shieldAim = v3(0, 0, 0);
// The shield is strapped to the left forearm and the arm carries it: raised, the hand is brought by IK to a
// point a forearm in front of the breastbone (elbow out and down) and the face turns to the front; lowered,
// it hangs at the side, face out. Raising takes a quarter second; a guard break flings it aside.
const solveArmTo = (model, side, target, pole, weight) => motionIK.applyTwoBone(model.userData.rig[`arm_upper_${side}`], model.userData.rig[`arm_lower_${side}`], model.userData.rig[`grip_${side}`], target, pole, { weight, maxFlex: 2.5 });
const shieldHand = v3(0, 0, 0), shieldPole = v3(0, 0, 0), shieldFront = v3(0, 0, 0), shieldSide = v3(0, 0, 0);
function holdShield(e) {
  const rig = e.model.userData.rig;
  if (!rig?.grip_left) return;
  if (!e.shieldItem) { e.shieldItem = heldItem('shield'); if (!e.shieldItem) return; e.shieldItem.scale.setScalar(.85); }
  const item = e.shieldItem, gone = e.ai.disarmed || e.dead && (e.loot?.rundschild ?? 1) === 0;
  item.visible = !gone;
  if (item.parent !== rig.grip_left) rig.grip_left.add(item);
  item.position.set(0, 0, 0);
  const dt = 1 / 60, up = e.shieldUp && !e.dead && !(e.guardBroken > 0);
  e.shieldRaise = THREE.MathUtils.damp(e.shieldRaise ?? 0, up ? 1 : 0, up ? 9 : 6, dt);
  const k = e.shieldRaise, a = e.model.rotation.y, s = e.model.scale.y || 1;
  shieldFront.set(-Math.sin(a), 0, -Math.cos(a)); shieldSide.set(-Math.cos(a), 0, Math.sin(a));
  e.model.updateMatrixWorld(true);
  if (k > .01 && !e.dead) {
    rig.chest.getWorldPosition(shieldHand);
    shieldHand.addScaledVector(shieldFront, .52 * s).addScaledVector(shieldSide, .1 * s).y += .05 * s;
    rig.arm_lower_left.getWorldPosition(shieldPole); shieldPole.addScaledVector(shieldSide, .6 * s).y -= .4 * s;
    solveArmTo(e.model, 'left', shieldHand, shieldPole, k);
  }
  // Face: to the front (a little to the left) when raised, outward at the side when lowered.
  shieldAim.copy(shieldSide).multiplyScalar(1 - k).addScaledVector(shieldFront, k).addScaledVector(shieldSide, .15 * k).setY(-.15 * (1 - k)).normalize();
  aimObject(item, shieldAim, 0);
}
// Mercy: first their valuables, then their freedom. Remembered by the faction, and by them.
function spareOrRob(e) {
  const b = e.ai;
  if (!b.robbed) {
    b.robbed = true; const gold = 6 + Math.floor(Math.random() * 18), item = Math.random() < .5 ? 'heiltrank' : 'reisefladen';
    player.gold += gold; inventory.add(item); barks.say(e.model, 'Hier ... nimm. Mehr hab ich nicht.');
    toast(`ER GIBT DIR ${gold} GOLD UND ${ITEMS[item].name.toUpperCase()}`, 2400); updateHUD(); return;
  }
  b.hostility = 'pacified'; b.spared = true; b.token = false; e.calm = true;
  const away = e.model.position.clone().sub(player.position).setY(0).normalize().multiplyScalar(60).add(e.model.position);
  if (e.transient) { b.cache.leaveTo = { t: ai.time, v: away }; rememberSpared(e); }
  game.flags.ai_spared = (game.flags.ai_spared || 0) + 1;
  barks.say(e.model, e.transient ? `Ich bin ${e.personName}. Das vergesse ich dir nicht.` : 'Ich ... danke.');
  toast(`${e.name.toUpperCase()} DARF GEHEN`, 2200); awardXP(10); saveGame(false);
}
function payToll(e) {
  if (player.gold < AI.toll) { toast('NICHT GENUG GOLD', 1600); return; }
  player.gold -= AI.toll; updateHUD();
  for (const m of enemies) if (m.ai?.group === e.ai.group && !m.dead) {
    m.ai.hostility = 'pacified'; m.calm = true;
    m.ai.cache.leaveTo = { t: ai.time, v: m.model.position.clone().sub(player.position).setY(0).normalize().multiplyScalar(50).add(m.model.position) };
  }
  barks.say(e.model, 'Kluge Entscheidung. Weiter mit dir.'); toast(`WEGZOLL BEZAHLT · −${AI.toll} GOLD`, 2000);
}
function poseEnemyBow(e, drawing) {
  e.bow ??= createHeldBow(scene);
  const rig = e.model.userData.rig;
  if (!e.bow || !rig?.grip_left) return;
  const show = e.model.visible && !e.ai?.meleeMode && !e.ai?.disarmed && (!e.dead || (e.loot?.jagdbogen ?? 1) > 0) && e.model.position.distanceTo(player.position) < 120;
  e.bow.setVisible(show);
  if (!show) return;
  const bow = e.bow.bow;
  if (bow.parent !== rig.grip_left) rig.grip_left.add(bow);
  bow.position.set(0, 0, 0); bow.quaternion.identity();
  if (!drawing) { e.bow.update(0, null, false); return; }
  const k = clamp(1 - e.windup / ARCHER_DRAW, 0, 1);
  rig.arm_upper_left.getWorldPosition(enemyShoulder);
  enemyAim.copy(player.position).add(v3(0, 1.4, 0)).sub(enemyShoulder).normalize();
  const side = v3(-enemyAim.z, 0, enemyAim.x).normalize();
  enemyPoint.copy(enemyShoulder).addScaledVector(enemyAim, 1.4);
  enemyPole.copy(enemyShoulder).add(v3(0, -1, 0)).addScaledVector(side, -.6);
  solveArm(e.model, 'left', enemyPoint, enemyPole);
  aimObject(bow, enemyAim, -.1);
  e.bow.pullPoint(enemyPoint, k, enemyAim);
  rig.arm_upper_right.getWorldPosition(enemyShoulder);
  enemyPole.copy(enemyShoulder).addScaledVector(side, .9).addScaledVector(enemyAim, -.8).add(v3(0, .25, 0));
  solveArm(e.model, 'right', enemyPoint, enemyPole);
  rig.grip_right.getWorldPosition(enemyHand);
  e.bow.update(k, enemyHand, true);
}
// What lights the wanderer's own hands in first person: the world's sky light, the sun or the moon
// (whichever is up) unless a roof or a wall stands between, and the nearest lamps and fires.
const hand = { ambient: new THREE.Color(), ground: new THREE.Color(), ambientIntensity: 1, key: new THREE.Color(), keyIntensity: 0, keyDirection: v3(0, 1, 0),
  lamp: new THREE.Color(), lampIntensity: 0, lampDirection: v3(0, 0, 1) };
let handShade = 1, handShadeGoal = 1, handShadeAt = 0;
const handPoint = v3(0, 0, 0), handFar = v3(0, 0, 0);
function handLight(dt) {
  hand.ambient.copy(world.ambient.color); hand.ground.copy(world.ambient.groundColor); hand.ambientIntensity = world.ambient.intensity;
  const sunUp = world.sun.intensity >= (world.moon?.intensity ?? 0), source = sunUp ? world.sun : world.moon;
  hand.key.copy(source.color);
  hand.keyDirection.copy(source.position).sub(sunUp ? world.sun.target.position : v3(0, 0, 0)).normalize();
  handPoint.copy(player.position).y += 2.1;
  if (performance.now() > handShadeAt) {
    handShadeAt = performance.now() + 250;
    const indoors = world.indoorAt(player.position.x, player.position.z);
    handShadeGoal = indoors ? .08 : world.segmentBlocked(handPoint, handFar.copy(handPoint).addScaledVector(hand.keyDirection, 30), .05) ? .25 : 1;
  }
  handShade += (handShadeGoal - handShade) * (1 - Math.exp(-dt * 6));
  hand.keyIntensity = source.intensity * handShade;
  if (handShadeGoal < .1) hand.ambientIntensity *= .55;
  // The strongest nearby pooled light (lanterns, braziers, the forge, spells).
  let best = 0;
  hand.lampIntensity = 0;
  for (const l of world.lights.pool) {
    if (l.intensity <= 0) continue;
    const d = l.position.distanceTo(handPoint);
    if (d >= l.distance) continue;
    const k = l.intensity * (1 - d / l.distance) ** 2 * .35;
    if (k > best) { best = k; hand.lamp.copy(l.color); hand.lampDirection.copy(l.position).sub(handPoint).normalize(); }
  }
  hand.lampIntensity = Math.min(3, best);
  return hand;
}
// A slight zoom at full draw, in both views.
function aimZoom() {
  if (game.cinematic) return;
  const fov = settings.fov * (1 - .12 * bowView.draw * bowView.draw);
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
// The bow came after the first saves were made: an old save finds it (and arrows) in the pack once.
function grantBow(loaded) {
  if (game.flags.bogen_erhalten) return;
  game.flags.bogen_erhalten = true;
  const owned = Object.values(player.equipment).includes('jagdbogen') || player.loot.includes('jagdbogen');
  if (!owned) { if (!player.equipment.ranged) player.equipment.ranged = 'jagdbogen'; else player.loot.push('jagdbogen'); }
  if ((player.satchel.pfeil || 0) < 24) player.satchel.pfeil = 24;
  updateHUD();
  if (loaded) toast(tip('NEU IM GEPÄCK · JAGDBOGEN UND 24 PFEILE · TASTE 4', 'NEU IM GEPÄCK · JAGDBOGEN UND 24 PFEILE · FELD 4'), 5200);
}
// ── Character animation, soundscape and compass (presentation only, per rendered frame).
const playerHead = v3(0, 0, 0);
let lastStep = 0;
// RDR2-style: in third person the wanderer looks where the camera looks (neck and head share the turn),
// up to over the shoulder; with the camera right behind them they look ahead.
const playerLookPoint = v3(0, 0, 0), cameraForward = v3(0, 0, 0);
function playerLook() {
  if (player.mode !== 'third' || talkingNPC || combat.archery?.bow) return null;
  camera.getWorldDirection(cameraForward);
  const off = Math.abs(THREE.MathUtils.euclideanModulo(Math.atan2(-cameraForward.x, -cameraForward.z) - playerModel.rotation.y + Math.PI, Math.PI * 2) - Math.PI);
  if (off > 2.4) return null;
  return playerLookPoint.copy(player.position).add(v3(0, 2.2, 0)).addScaledVector(cameraForward, 12);
}
function animateActors(dt, voice) {
  if (dt <= 0) return;
  playerHead.copy(player.position).y += 2.2;
  const look = talkingNPC && game.modal === 'dialog' ? camera.position : playerHead;
  const cine = game.cinematic?.cine;
  updateBowView(cine ? 0 : dt);
  if (!motion.isDown(playerModel)) playerAnimator.update(dt, cine ? { action: cine.action, activity: cine.poses.wanderer ?? null } : { ...motion.animInput(playerModel), lookAt: playerLook(), vy: player.velocityY || 0, action: combat.action, guard: combat.guarding, airborne: !player.grounded, stagger: Math.max(0, player.invuln - .25), activity: player.swimming ? 'swim' : player.sneaking ? 'sneak' : null, bow: bowView.raise, bowPitch: player.pitch });
  poseBow(cine);
  // Funken ready (tool 2): a flame burns in the left hand in third person (first person: firstPerson.js).
  const handFire = player.tool === 1 && player.mode === 'third' && !cine && playerModel.visible && !motion.isDown(playerModel);
  combat.spellFx.handFlame(handFire ? playerModel.userData.rig.grip_left.getWorldPosition(v3()).add(v3(0, .08, 0)) : null, dt);
  playerModel.userData.face?.update(dt, { expression: player.invuln > .3 ? 'pain' : combat.action?.kind === 'sword' ? 'angry' : 'neutral' });
  for (const npc of npcs) {
    if (npc.dead) continue;
    // Far citizens are simulated by npcLife but neither drawn nor animated.
    const distance = npc.model.position.distanceTo(player.position);
    npc.model.visible = distance < 150 || npc === talkingNPC;
    if (!npc.model.visible) continue;
    const near = distance < 7 || npc === talkingNPC;
    const speaking = voice.speaker === npc.id ? voice.mouth : 0;
    let activity = cine ? cine.poses[npc.id] ?? null : npc === talkingNPC ? null : npc.life?.activity ?? npc.pose;
    if (activity === 'greet') activity = npc.job === 'child' || (relationship[npc.id]?.trust ?? 0) >= 40 ? 'wave' : npc.job === 'guard' || npc.storyId === 'guard_captain' ? 'salute' : 'nod';
    npc.animator.update(dt, { ...motion.animInput(npc.model), speaking: speaking > .05 || (npc === talkingNPC && voice.speaker === npc.id), lookAt: near && activity !== 'sleep' ? look : activity ? null : motion.lookFor(npc.model), activity: activity === 'walk' ? null : activity });
    // Wading NPCs leave rings on the water.
    if (distance < 45 && npc.animator.speed > .5 && WATER_LEVEL - world.heightAt(npc.model.position.x, npc.model.position.z) > .15) world.water.wake(npc.model.position.x, npc.model.position.z, npc.animator.speed, .3);
    // A blow on the anvil throws sparks from the hammer head (and rings out when you stand close).
    if (npc.model.userData.blows !== npc.blows) {
      npc.blows = npc.model.userData.blows;
      const grip = npc.model.userData.rig?.grip_right;
      if (grip && distance < 30) { combat.effects.spray(grip.getWorldPosition(v3()).add(v3(0, -.15, 0)), v3(0, 1, 0), 'ember', 8); if (distance < 10) combat.effects.sound('impact'); }
    }
    npc.model.userData.face?.update(dt, { speaking, expression: npc.expression || (npc.id === 'bryn' ? 'neutral' : 'neutral'), look: near ? npc.model.userData.lookSide || 0 : 0 });
  }
  for (const e of enemies) {
    const near = !e.dead && e.model.position.distanceTo(player.position) < 17;
    const drawing = e.archer && !e.dead && e.windup > 0 && !e.ai?.meleeMode;
    const pose = e.ai && !e.dead ? (e.shieldUp && e.ai.intent.pose !== 'surrender' ? 'shieldUp' : e.ai.intent.pose) : null, fighting = near && !e.calm && (!e.ai || e.ai.hostility === 'hostile');
    const spell = e.casting || e.castRelease > 0 ? { kind: 'cast', progress: e.casting ? .3 * (1 - e.windup / (e.windupTotal || 1)) : .3 + .7 * (1 - e.castRelease / .5) } : null;
    if (e.casting && near && Math.random() < .5) combat.effects.spray(e.model.userData.rig?.hand_left?.getWorldPosition(v3(0, 0, 0)) ?? e.model.position.clone().add(v3(0, 1.5, 0)), v3(0, .6, 0), e.casting === 'heal' ? 'heal' : 'ember', 1);
    if (!e.ragdoll && !motion.isDown(e.model)) e.animator.update(dt, { ...motion.animInput(e.model), action: spell, windup: !drawing && !e.casting && e.windup > 0 ? 1 - e.windup / (e.kind === 'wolf' ? .5 : .7) : 0, strike: e.strikeT || 0, stagger: e.stagger || 0, dead: e.dead, death: e.deathTime ?? 1, lookAt: near && pose !== 'sleep' ? playerHead : motion.lookFor(e.model), guard: e.blocking > 0, combat: fighting, bow: drawing ? 1 : 0, activity: pose });
    if (e.guardBroken > 0) e.guardBroken = Math.max(0, e.guardBroken - dt);
    if (e.ai && !e.dead) holdWeapons(e);
    if (e.archer) poseEnemyBow(e, drawing);
    // Badly wounded enemies leave a trail of drops.
    if (!e.dead && e.hp < e.maxHp * .5 && near && (e.dripAt = (e.dripAt || 0) - dt) <= 0) { e.dripAt = .35 + Math.random() * .4; combat.effects.spray(e.model.position.clone().add(v3(0, e.kind === 'wolf' ? .7 : 1.2, 0)), v3(0, -1, 0), 'blood', 2); if (Math.random() < .4) combat.effects.groundStain(e.model.position, .2 + Math.random() * .2); }
    e.model.userData.face?.update(dt, { expression: e.dead ? 'dead' : e.stagger > 0 ? 'pain' : near ? 'angry' : 'neutral' });
  }
  registerBodies();
  motion.afterAnimate(dt, player.position);
}
const ambience = createAmbience();
const compass = createCompass($('world-compass'));
function updateSoundscape(dt) {
  const fighting = enemies.some(e => !e.dead && e.model.position.distanceTo(player.position) < 13);
  ambience.update(dt, { hour: worldClock.hour, position: player.position, fires: world.landmarks.fires, combat: game.started && fighting, paused: game.paused || !game.started });
  // Footsteps land on the gait's contact points.
  const phase = playerAnimator.phase, step = Math.floor(phase * 2);
  if (game.started && !game.paused && player.grounded && playerAnimator.speed > .8 && step !== lastStep)
    ambience.footstep(world.nearRoad(player.position.x, player.position.z, 2.3) ? 'path' : 'grass', clamp(playerAnimator.speed / 9, .35, 1));
  lastStep = step;
}
function compassMarkers() {
  const L = world.landmarks, elira = npcs.find(n => n.id === 'elira');
  const trigger = stageOf(game.quest)?.trigger, who = trigger?.type === 'talk' && npcs.find(n => n.storyId === trigger.npc);
  const itemSite = trigger?.type === 'item' && STORY.STORY_ITEMS.find(i => i.id === trigger.item)?.site;
  const quest = who ? who.model.position : trigger?.type === 'reach' ? SITES[trigger.site] : itemSite ? SITES[itemSite] : trigger?.type === 'kill' ? L.camp : trigger?.type === 'choice' ? L.castle : elira.model.position;
  const markers = [
    { id: 'village', x: L.village.x, z: L.village.z, kind: 'village', label: 'Dämmerwald' },
    { id: 'shrine', x: L.shrine.x, z: L.shrine.z, kind: 'shrine', label: 'Glutschrein' },
    { id: 'camp', x: L.camp.x, z: L.camp.z, kind: 'camp', label: 'Westlager' },
    { id: 'tower', x: L.tower.x, z: L.tower.z, kind: 'tower', label: 'Alter Wachturm' },
    { id: 'kronwacht', x: L.city.x, z: L.city.z, kind: 'village', label: 'Kronwacht' },
    { id: 'burg', x: L.castle.x, z: L.castle.z, kind: 'tower', label: 'Burg Kronwacht' },
    ...world.markers.filter(m => !m.discover || discovered(m) || Math.hypot(player.position.x - m.x, player.position.z - m.z) < 120).map(m => ({ ...m, kind: ['quest', 'village', 'shrine', 'camp', 'tower', 'npc'].includes(m.kind) ? m.kind : 'village' })),
  ];
  if (quest && game.quest) markers.push({ id: 'quest', x: quest.x, z: quest.z, kind: 'quest', label: stageOf(game.quest).objective });
  return markers;
}
for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, () => ambience.resume(), { passive: true });
// Settings (main menu and pause menu) apply live: controls, field of view, audio, subtitles.
let settings = loadSettings();
try { if (prefersTouch() && !localStorage.getItem(SETTINGS_KEY)) settings = saveSettings({ ...settings, graphicsQuality: 'low' }); } catch { /* Storage unavailable. */ }
function applySettings(values) {
  settings = values;
  touchMode = values.touchControls === 'on' || values.touchControls !== 'off' && prefersTouch();
  document.body.classList.toggle('touch-mode', touchMode);
  if (touchMode) unlockPointer();
  syncPresentation();
  camera.fov = values.fov; camera.updateProjectionMatrix();
  ambience.setVolume({ master: values.masterVolume, music: values.musicVolume, effects: values.effectsVolume });
  if (values.graphicsQuality && values.graphicsQuality !== graphics.state().quality) graphics.apply(values.graphicsQuality);
  if ((values.pixelFilter ?? true) !== graphics.state().pixelFilter) graphics.setPixelFilter(values.pixelFilter ?? true);
  graphics.setGrade(values.colorGrade ?? 'standard');
}
// Touch: keys go through the same keyboard handlers, so every action behaves exactly as on a keyboard.
touch = createTouchControls($('touch-ui'), {
  onKey: (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true })),
  onPrimary: down => down ? primaryDown() : primaryUp(),
  onSecondary: down => down ? secondaryDown() : secondaryUp(),
  onLook: (dx, dy) => {
    if (game.paused || game.cinematic) return;
    const k = .0055 * settings.mouseSensitivity;
    player.yaw -= dx * k;
    player.pitch = clamp(player.pitch - dy * k * .85 * (settings.invertY ? -1 : 1), -1.15, 1.18);
  },
  onZoom: delta => { if (!game.paused) cameraRig.zoom = clamp(cameraRig.zoom + delta, 2, 7.5); },
});
document.querySelectorAll('.quickbar .slot').forEach((slot, i) => slot.addEventListener('pointerdown', event => {
  if (!touchMode || !game.started || game.paused) return;
  event.preventDefault(); selectTool(i);
}));
createMenu({ values: settings, onSettingsChange: applySettings });
applySettings(settings);

// Deterministic browser-playtest bridge. Read-only state plus explicitly named test actions.
window.__ASHEN_TEST__ = {
  inventory: () => inventory.rows(), openInventory, closeInventory,
  state: () => ({ started: game.started, paused: game.paused, modal: game.modal, cinematic: !!game.cinematic, quest: game.quest, perspective: player.mode, position: player.position.toArray(), health: player.hp, maxHp: player.maxHp, stamina: player.stamina, maxStamina: player.maxStamina, level: player.level, xp: player.xp, perkPoints: player.perkPoints, equipment: {...player.equipment}, loot: [...player.loot], perks: [...player.perks], hour: worldClock.hour, relationships: structuredClone(relationship), enemiesRemaining: enemies.filter((e) => !e.dead).length, enemyPositions: enemies.map(e => e.model.position.toArray()), npcCount: npcs.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, batching: world.batching, graphics: graphics.state(), combat:combat.state(), firstPerson:firstPerson.state(), actors:{player:{speed:playerAnimator.speed,phase:playerAnimator.phase},npcs:npcs.map(n=>({id:n.id,speed:n.animator.speed}))},audio:ambience.state(), hudVisible:!$('hud').classList.contains('hidden') }),
  start: () => startGame(false), skip: () => endCinematic(), perspective: () => { player.mode = player.mode === 'first' ? 'third' : 'first'; },
  move: (x, z) => { if (!world.blocked(x, z)) { player.position.set(x, world.heightAt(x, z), z); snapPlayerView(); updatePlayer(.0001); } },
  interact, attack, speak: (id) => { const npc = npcs.find((n) => n.id === id); if (npc) speakTo(npc); },
  // Local development tools are excluded from the production build.
  ...(import.meta.env.DEV ? { save: () => saveGame(false), load: loadGame, reset: resetGame, awardXP,
    hour: value => { worldClock.hour = clamp(value, 0, 23.99); updateHUD(); },
    face: yaw => { player.yaw = yaw; updateCamera(1); },
    resume: () => setModal(null), equip: equipLoot,
    tool: value=>{player.tool=value;},look:(yaw,pitch)=>{player.yaw=yaw;player.pitch=pitch;updateCamera(1);},
    injure:amount=>{player.hp=Math.max(1,player.hp-amount);},guard:combat.setGuard,
    navigation:()=>({routes:world.routePoints.map(r=>r.map(p=>[p.x,p.z])),colliders:world.colliders}),
    blocked:(x,z,r)=>world.blocked(x,z,r),ground:(x,z)=>world.heightAt(x,z),
    cinematic:()=>playCinematic('Die Aschmark erwacht.',4),
    camera:(position,target,follow=false)=>{debugCamera=position?{position:v3(...position),target:v3(...target),follow}:null;},
    keys:(codes=[])=>{keys.clear();codes.forEach(c=>keys.add(c));},
    setHour:value=>{worldClock.hour=value;life.skipTo(value);},
    lifeState:()=>npcs.map(n=>({id:n.id,activity:n.life?.activity,x:+n.model.position.x.toFixed(1),z:+n.model.position.z.toFixed(1),inside:n.life?.inside,bark:n.life?.bark})),
    snapshot:async(file='shot')=>{graphics.render(scene,camera,player.mode==='first'&&game.started&&!game.paused?firstPerson.render:null);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));return fetch('http://127.0.0.1:5299/save?file=work/screens/'+file+'.png',{method:'POST',body:blob}).then(r=>r.text());},
    rootPosition:()=>playerModel.position.toArray(),
    streamer:()=>world.streamer.state(),fly:()=>toggleFlight(),profile:()=>profile.worst,dev:()=>({tracks,world,physics,npcs,enemies,life,player,playerModel,combat,game,scene,camera,wildlife,spawnEnemy,motion,graphics,renderer,ai}),ai:()=>ai.state(),aiDebug:()=>ai.debugLines(player.position,10),aiDays:n=>{game.flags.ai_day=(game.flags.ai_day||0)+n;campCheckAt=0;},introTime:()=>game.cinematic?.director?.time??null,
    killEnemy:i=>damageEnemy(enemies[i],9999),
    motion:()=>motion.state(),ambient:()=>ambientFx.state(),body:i=>motion.debugActor(i==='player'?playerModel:enemies[i].model),
    push:(i,force=2,dx=1,dz=0)=>motion.impact(i==='player'?playerModel:enemies[i].model,{force,dir:v3(dx,0,dz)}),
    grabEnemy:i=>motion.grab(playerModel,enemies[i].model),grip:cmd=>motion.command(playerModel,cmd),knock:(i,force=3)=>motion.knockDown(i==='player'?playerModel:enemies[i].model,v3(1,0,0),force),physics:()=>physics.state(),corpse:i=>({loot:enemies[i].loot,ragdoll:!!enemies[i].ragdoll,at:enemies[i].ragdoll?.position().toArray()}),
    actor:(id='player')=>{const m=id==='player'?playerModel:(npcs.find(n=>n.id===id)||enemies[Number(id)])?.model;if(!m)return null;const box=new THREE.Box3().setFromObject(m);let meshes=0;m.traverse(o=>{if(o.isMesh)meshes++;});let first=null;m.traverse(o=>{if(o.isMesh&&!first)first=o;});const mat=first?.material;return {mat:mat&&{type:mat.type,map:mat.map?.image?.width,alphaTest:mat.alphaTest,opacity:mat.opacity,visible:mat.visible},verts:first?.geometry.attributes.position.count,attrs:first&&Object.keys(first.geometry.attributes),meshes,visible:m.visible,min:box.min.toArray(),max:box.max.toArray(),bones:Object.keys(m.userData.rig||{})};},
  } : {}),
};
