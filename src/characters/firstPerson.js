import * as THREE from 'three';
import { block, boxGeometry } from '../art/blocks.js';
import { pixelMaterial } from '../art/pixelTextures.js';
import { createLiquid } from '../systems/liquid.js';
import { APPEARANCE_OPTIONS } from './appearance.js';
import { createHeldBow, aimObject } from './bow.js';
import { heldItem, WEAPON_MODELS } from './models.js';

const T = 1 / 16;
const clamp = THREE.MathUtils.clamp;
const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const phase = (p, start, end) => ease((p - start) / (end - start));

// Local item palettes. A tile covers one world unit, even on tiny boxes.
// Lazy construction keeps imports independent of the DOM and WebGL.
const materials = new Map();
function painted(name, ramp, pattern = (x, y) => (x * 13 + y * 7 + x * y) % 11 < 3 ? 0 : 1) {
  if (materials.has(name)) return materials.get(name);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = ramp[pattern(x, y) % ramp.length]; ctx.fillRect(x, y, 1, 1);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.generateMipmaps = false;
  map.name = `viewmodel:${name}`;
  const material = new THREE.MeshLambertMaterial({ map });
  materials.set(name, material); return material;
}

// One arm for every held thing, Minecraft-plain: a 4×4×12 texel box of skin with the sleeve of the worn
// clothes over its elbow half. The group's origin is the end of the arm, where items are held; the
// arm runs from there down and back toward the camera.
const ELBOW = new THREE.Vector3(0, -1, .55).normalize(), UP = new THREE.Vector3(0, 1, 0);
// Worn gear shows on it like on the body: gloves over the hand end, bracers round the forearm.
function arm(parent, skin, sleeve, bracer, glove) {
  const g = new THREE.Group(); parent.add(g); g.name = 'Arm';
  const length = 12 * T, along = (mesh, at) => { mesh.position.copy(ELBOW).multiplyScalar(at); mesh.quaternion.setFromUnitVectors(UP, ELBOW.clone().negate()); return mesh; };
  along(block(g, 4 * T, length, 4 * T, skin), length / 2 - .03);
  along(block(g, 4 * T + .02, length * .55, 4 * T + .02, sleeve), length * .72);
  g.userData.bracer = along(block(g, 4 * T + .03, length * .26, 4 * T + .03, bracer), length * .34);
  g.userData.glove = along(block(g, 4 * T + .025, length * .3, 4 * T + .025, glove), length * .12);
  return g;
}


// The sword in hand is the Blockbench model the world uses (art/blockbench/models.js weapons), so first and
// third person show the same blade; until the models have loaded nothing is shown. The hilt is the grip of
// the fist: it sits inside the end of the arm and turns with the wrist, so the grip runs through the fist,
// the pommel shows on one side and the guard on the other. The sword inside it rolls about its own axis so
// an edge leads (rollBlade).
function makeSword(parent) {
  const hilt = new THREE.Group(); parent.add(hilt); hilt.name = 'Hilt';
  hilt.position.copy(ELBOW).multiplyScalar(.11);
  const sword = new THREE.Group(); hilt.add(sword); sword.name = 'Held sword';
  let equipped = null, model = null;
  return {
    hilt, sword,
    equip(weapon = 'rostiges_schwert') {
      const key = WEAPON_MODELS[weapon] || 'sword_rusty';
      if (key === equipped && model) return;
      const item = heldItem(key); if (!item) return;
      model?.removeFromParent(); model = item; equipped = key;
      // The hand closes just below the guard.
      item.scale.setScalar(.72); item.rotation.set(0, 0, 0); item.position.set(0, -.05, 0);
      sword.add(item);
    },
  };
}

function potion(parent, trim) {
  const bottle = new THREE.Group(); parent.add(bottle); bottle.name = 'Box potion';
  const glass = painted('glass', ['#18382c', '#294d3a', '#63876a'], (x, y) => x === 1 ? 2 : (x + y) % 5 === 0 ? 0 : 1).clone();
  glass.transparent = true; glass.opacity = .42; glass.depthWrite = false;
  const shell = block(bottle, 6 * T, 7 * T, 6 * T, glass); shell.renderOrder = 5;
  const shoulder = block(bottle, 4 * T, T, 4 * T, glass, 0, .25, 0); shoulder.renderOrder = 5;
  const neck = block(bottle, 2 * T, 2 * T, 2 * T, glass, 0, .34375, 0); neck.renderOrder = 5;
  const cork = block(bottle, 2 * T, T, 2 * T, painted('cork', ['#604830', '#96744e']), 0, .425, 0);
  for (const side of [-1, 1]) {
    block(bottle, 6 * T + .01, T / 2, T / 2, trim, 0, -.125, side * .1875);
    block(bottle, T / 2, T / 2, 6 * T, trim, side * .1875, -.125, 0);
  }
  block(bottle, T, T, T / 2, trim, 0, -.08, .2);

  // The liquid (systems/liquid.js): a box whose top is a grid of ripples on the sloshing plane and whose
  // walls rise to meet it; a little see-through, so the bubbles show inside. Darker toward the floor.
  const HALF = .171875, BOTTOM = -.203125, TOP = .203125, FULL = .045;
  const liquid = createLiquid({ cells: 6, half: HALF }), N = liquid.cells + 1, step = 2 * HALF / liquid.cells;
  const liquidMaterial = painted('liquid', ['#4b1426', '#842337', '#ab3a45'], (x, y) => (x + y * 3) % 5 === 0 ? 2 : y % 4 === 0 ? 0 : 1).clone();
  Object.assign(liquidMaterial, { transparent: true, opacity: .86, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
  const positions = [], uvs = [], colors = [], indices = [];
  const vertex = (x, y, z, u, v, shade) => { positions.push(x, y, z); uvs.push(u, v); colors.push(shade, shade, shade); return positions.length / 3 - 1; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) vertex(-HALF + i * step, FULL, -HALF + j * step, i * step, j * step, 1);
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i; indices.push(a, a + N, a + 1, a + 1, a + N, a + N + 1); }
  // Walls: for each side the grid points along its edge, a floor row and a row that follows the surface.
  const edges = [[k => k, () => 0], [() => N - 1, k => k], [k => k, () => N - 1], [() => 0, k => k]], walls = [];
  for (const [ei, ej] of edges) {
    const first = positions.length / 3;
    for (let k = 0; k < N; k++) {
      const i = ei(k), j = ej(k), x = -HALF + i * step, z = -HALF + j * step, along = k * step;
      vertex(x, BOTTOM, z, along, 0, .62); walls.push([vertex(x, FULL, z, along, FULL - BOTTOM, .8), j * N + i]);
    }
    for (let k = 0; k < N - 1; k++) { const a = first + k * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const floor = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => vertex(x * HALF, BOTTOM, z * HALF, (x + 1) * HALF, (z + 1) * HALF, .55));
  indices.push(floor[0], floor[1], floor[2], floor[0], floor[2], floor[3]);
  const liquidGeometry = new THREE.BufferGeometry();
  liquidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  liquidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  liquidGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  liquidGeometry.setIndex(indices);
  const surfaceMesh = new THREE.Mesh(liquidGeometry, liquidMaterial); surfaceMesh.renderOrder = 3; bottle.add(surfaceMesh);
  const vertices = liquidGeometry.attributes.position;
  // Bubbles rise inside; foam floats on top while the potion is churned up. Both fade with the agitation.
  const bubbleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffc4cc, transparent: true, opacity: .8, depthWrite: false }), liquid.bubbles.length);
  const FOAM = 18, foam = Array.from({ length: FOAM }, (_, k) => ({ u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, size: .018 + Math.random() * .02, phase: k * 1.7 }));
  const foamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xf2c6c6, transparent: true, opacity: .9, depthWrite: false }), FOAM);
  bubbleMesh.renderOrder = foamMesh.renderOrder = 4; bubbleMesh.frustumCulled = foamMesh.frustumCulled = false; bottle.add(bubbleMesh, foamMesh);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), s0 = new THREE.Vector3();
  let level = FULL;

  function updateLiquid(time) {
    const visible = level > BOTTOM + .004;
    surfaceMesh.visible = bubbleMesh.visible = foamMesh.visible = visible;
    if (!visible) return;
    const height = (x, z, edge) => clamp(level + liquid.surface(x, z) + (edge ? .006 : 0), BOTTOM + .002, TOP);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const edge = i === 0 || j === 0 || i === N - 1 || j === N - 1;
      vertices.setY(j * N + i, height(-HALF + i * step, -HALF + j * step, edge));
    }
    for (const [wall, top] of walls) vertices.setY(wall, vertices.getY(top));
    vertices.needsUpdate = true; liquidGeometry.computeVertexNormals();
    let count = 0;
    for (const b of liquid.bubbles) {
      if (!b.alive || b.y > level + liquid.surface(b.x, b.z)) continue;
      m4.compose(p0.set(b.x, b.y, b.z), q0, s0.setScalar(b.size * 2)); bubbleMesh.setMatrixAt(count++, m4);
    }
    bubbleMesh.count = count; bubbleMesh.instanceMatrix.needsUpdate = true;
    const froth = Math.min(1, liquid.state.agitation * 1.6);
    count = 0;
    for (const f of foam) {
      const k = clamp(froth * FOAM - count, 0, 1); if (k <= 0) break;
      const x = clamp(f.u * HALF * .8 + Math.sin(time * 1.3 + f.phase) * .02, -HALF * .9, HALF * .9), z = clamp(f.v * HALF * .8 + Math.cos(time * 1.1 + f.phase) * .02, -HALF * .9, HALF * .9);
      m4.compose(p0.set(x, height(x, z, false) + .003, z), q0, s0.set(f.size * k, .006, f.size * k)); foamMesh.setMatrixAt(count++, m4);
    }
    foamMesh.count = count; foamMesh.instanceMatrix.needsUpdate = true;
  }
  // Where the bottle really goes in the world: the view model hangs in front of the world camera, so its
  // place there follows the walk, the jumps, the turning view and the hand's own shaking.
  const world = new THREE.Vector3(), lastWorld = new THREE.Vector3(), velocity = new THREE.Vector3(), lastVelocity = new THREE.Vector3();
  const accel = new THREE.Vector3(), raw = new THREE.Vector3(), felt = new THREE.Vector3(), quick = new THREE.Vector3(), toBottle = new THREE.Quaternion();
  let tracked = false, time = 0;
  updateLiquid(0);
  return {
    bottle,
    reset() {
      liquid.reset(); tracked = false; accel.set(0, 0, 0);
      level = FULL; cork.position.y = .425; cork.visible = true; updateLiquid(0);
    },
    update(dt, player, worldCamera, action) {
      time += dt;
      bottle.updateWorldMatrix(true, false);
      bottle.getWorldPosition(world).applyQuaternion(worldCamera.quaternion).add(worldCamera.position);
      if (!tracked || dt <= 0 || world.distanceToSquared(lastWorld) > 4 || !bottle.visible) { velocity.set(0, 0, 0); accel.set(0, 0, 0); tracked = true; }
      else {
        velocity.subVectors(world, lastWorld).divideScalar(dt);
        raw.subVectors(velocity, lastVelocity).divideScalar(dt).clampLength(0, 60);
        accel.lerp(raw, 1 - Math.exp(-dt / .035));
      }
      lastWorld.copy(world); lastVelocity.copy(velocity);
      // Felt gravity as the liquid's "up", and the acceleration, both in the bottle's own frame.
      bottle.getWorldQuaternion(toBottle).premultiply(worldCamera.quaternion).invert();
      felt.set(accel.x, 9.8 + accel.y, accel.z).applyQuaternion(toBottle).normalize();
      quick.copy(accel).applyQuaternion(toBottle);
      const drinking = action?.kind === 'drink', p = drinking ? clamp(action.progress, 0, 1) : 0;
      level = drinking ? THREE.MathUtils.lerp(FULL, BOTTOM - .005, phase(p, .25, .72)) : player.potions > 0 ? FULL : BOTTOM - .005;
      liquid.update(dt, { felt, quick, level, bottom: BOTTOM });
      updateLiquid(time);
      cork.position.y = .425 + (drinking ? phase(p, 0, .2) * .18 : 0);
      cork.visible = !drinking || p < .24;
    },
    takeCue: () => liquid.takeCue(),
    state: () => ({ tilt: { x: liquid.state.x, z: liquid.state.z }, agitation: liquid.state.agitation, bubbles: liquid.bubbles.filter(b => b.alive).length, level }),
  };
}

// Sword poses in view space: the fist (`at`: x and y in half screen heights, depth) and the blade (grip →
// tip). The forearm always runs from a shoulder below and right of the view to the fist, so the arm comes in
// from the lower right like a body's would; the wrist bends, so at rest and in guard the blade crosses the
// forearm almost at right angles, as a hand holds a sword. Neither pose covers the screen centre.
const SHOULDER = new THREE.Vector3(.42, -.62, .2);
const SWORD_REST = { at: [.95, -.6, .95], blade: [-.32, 1, -.08] };
const SWORD_GUARD = { at: [.3, -.48, .8], blade: [.55, .8, -.25] };
// Strikes: wind-up, two keys through the cut (the blade sweeps through the front, never past the face),
// follow-through, then back. Times are fractions of the attack; the hit lands near the third key.
const STRIKES = [
  { times: [0, .22, .36, .45, .6, 1], keys: [ // forehand, right to left
    { at: [1.15, .1, .85], blade: [.75, .55, .35] },
    { at: [.55, -.05, .8], blade: [.95, .3, -.15] },
    { at: [-.25, -.2, .8], blade: [-.95, .15, -.2] },
    { at: [-.85, -.5, .85], blade: [-.6, -.2, .75] }] },
  { times: [0, .22, .36, .45, .6, 1], keys: [ // backhand, left to right
    { at: [-.55, 0, .8], blade: [-.75, .45, .5] },
    { at: [-.25, -.1, .78], blade: [-.95, .2, -.15] },
    { at: [.45, -.25, .8], blade: [.95, .1, -.2] },
    { at: [1.2, -.55, .9], blade: [.7, -.25, .6] }] },
  { times: [0, .3, .42, .5, .64, 1], keys: [ // diagonal chop, upper right to lower left
    { at: [.6, .45, .75], blade: [.2, .5, .85] },
    { at: [.45, .25, .78], blade: [.25, .95, -.2] },
    { at: [.05, -.2, .8], blade: [-.75, -.3, -.6] },
    { at: [-.2, -.75, .85], blade: [-.6, -.75, -.25] }] },
];
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
const read = (v, src) => src.isVector3 ? v.copy(src) : v.fromArray(src);
/** Blends two sword poses (arrays or Vector3s) into `out`; the blade blends and renormalises. `out` may be
 *  `a` or `b`: each part is read before it is written. */
function blendPose(out, a, b, t) {
  for (const key of ['at', 'blade']) {
    read(_pa, a[key]); read(_pb, b[key]);
    if (key === 'blade') { _pa.normalize(); _pb.normalize(); }
    out[key].lerpVectors(_pa, _pb, t);
    if (key === 'blade') out[key].normalize();
  }
  return out;
}
/** Where the sword is during an attack, from the pose it starts and ends in. */
function strikePose(out, base, progress, combo) {
  const { times, keys } = STRIKES[combo], frames = [base, ...keys, base];
  let index = 0;
  while (index < frames.length - 2 && progress > times[index + 1]) index++;
  return blendPose(out, frames[index], frames[index + 1], phase(progress, times[index], times[index + 1]));
}
// Turns an arm group so the forearm (elbow → fist) points along `dir`, its sides kept level with the screen.
const ARM_AXIS = ELBOW.clone().negate(), _ax = new THREE.Vector3(), _az = new THREE.Vector3(), _basis = new THREE.Matrix4();
const ARM_FRAME = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), ARM_AXIS, new THREE.Vector3(1, 0, 0).cross(ARM_AXIS)).transpose();
function aimArm(group, dir) {
  _ax.set(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
  _az.crossVectors(_ax, dir);
  group.quaternion.setFromRotationMatrix(_basis.makeBasis(_ax, dir, _az).multiply(ARM_FRAME));
}

export function createFirstPerson() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .01, 10);
  // The hands are lit like the world round them (main.js handLight): the sky light, the sun or moon
  // from where it really stands relative to the view, and the nearest lamp or fire. A fixed number
  // of lights, only their colours and strengths change, so nothing recompiles.
  const sky = new THREE.HemisphereLight(0xdceaf5, 0x594230, 1.5), key = new THREE.DirectionalLight(0xffe0b7, 2), lamp = new THREE.DirectionalLight(0xffb060, 0);
  key.position.set(-1, 2, 3); scene.add(sky, key, lamp);
  const viewInverse = new THREE.Quaternion();
  const rig = new THREE.Group(); scene.add(rig);
  const right = new THREE.Group(), left = new THREE.Group(); rig.add(right, left);
  // Light neutral ramp, tinted to the player's skin tone in update().
  const skin = painted('skin', ['#d8d0c8', '#ece6e0', '#f8f4f0']);
  // The sleeve takes the colour of the worn clothes, set in update().
  const sleeve = painted('sleeve', ['#c8c8c8', '#dcdcdc', '#eeeeee'], (x, y) => (x + y * 3) % 7 === 0 ? 0 : (x * y) % 5 === 0 ? 2 : 1);
  const trim = pixelMaterial('brass');
  const bracer = painted('bracer', ['#b8b8b8', '#d0d0d0', '#a4a4a4'], (x, y) => y % 4 === 0 ? 2 : (x + y) % 5 === 0 ? 0 : 1);
  const glove = painted('glove', ['#c4c4c4', '#d8d8d8', '#b0b0b0'], (x, y) => (x * 3 + y) % 6 === 0 ? 2 : 1);
  const arms = [arm(right, skin, sleeve, bracer, glove), arm(left, skin, sleeve, bracer, glove)];
  const weapon = makeSword(right), sword = weapon.sword, flask = potion(right, trim);
  flask.bottle.position.set(0, .16, -.15);
  flask.bottle.scale.setScalar(.64);
  const spell = new THREE.Group(); left.add(spell); spell.position.set(0, .11, -.1);
  // Funken ready: a small fire burns in the palm. Glowing blocks rise from it, swell and burn down from
  // white-yellow to red; a warm light flickers on the hand and arm, so the hand itself glows.
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const core = block(spell, T * .9, T * .9, T * .9, glow);
  const FLAMES = [[1, 0xffe08a], [.75, 0xffb03a], [.5, 0xff6a1c], [.25, 0xc8361a], [0, 0x4a1206]];
  const flames = Array.from({ length: 26 }, () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(T, T, T), new THREE.MeshBasicMaterial({ color: 0xffcc58, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.visible = false; spell.add(mesh); return { mesh, life: 0, duration: 1, size: 1, velocity: new THREE.Vector3(), swirl: 0 };
  });
  const palmLight = new THREE.PointLight(0xff8a3a, 0, 1.6, 1.2); palmLight.position.set(0, .05, 0); spell.add(palmLight);
  const flameColor = new THREE.Color(), flameNext = new THREE.Color();
  let flameTimer = 0;
  function burn(dt, strength) {
    flameTimer += dt * (32 + strength * 40);
    while (flameTimer > 1) {
      flameTimer -= 1;
      const f = flames.find(q => q.life <= 0); if (!f) break;
      f.duration = f.life = .32 + Math.random() * .34; f.size = (1.2 + Math.random() * 1.4) * (1 + strength * .7); f.swirl = Math.random() * 6.28;
      f.mesh.position.set((Math.random() - .5) * .05, 0, (Math.random() - .5) * .05); f.mesh.visible = true;
      f.velocity.set((Math.random() - .5) * .12, .22 + Math.random() * .2 + strength * .2, (Math.random() - .5) * .12);
      f.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
    for (const f of flames) {
      if (f.life <= 0) continue;
      f.life -= dt; if (f.life <= 0) { f.mesh.visible = false; continue; }
      const k = f.life / f.duration;
      f.swirl += dt * 10; f.velocity.y += dt * .5; f.velocity.x += Math.cos(f.swirl) * dt * .15; f.velocity.z += Math.sin(f.swirl) * dt * .15;
      f.mesh.position.addScaledVector(f.velocity, dt); f.mesh.rotation.y += dt * 4;
      f.mesh.scale.setScalar(f.size * (k > .7 ? .6 + (1 - k) * 1.5 : Math.max(.2, k * 1.4)));
      for (let i = 1; i < FLAMES.length; i++) if (k >= FLAMES[i][0]) { f.mesh.material.color.setHex(FLAMES[i][1]).lerp(flameNext.setHex(FLAMES[i - 1][1]), (k - FLAMES[i][0]) / (FLAMES[i - 1][0] - FLAMES[i][0])); break; }
      f.mesh.material.opacity = Math.min(1, k * 2.4);
    }
    palmLight.intensity = (4 + strength * 4) * (.85 + Math.sin(time * 23) * .08 + Math.sin(time * 37 + 1) * .07);
  }
  // Bow (tool 4): upright in a left fist, canted a little, the right fist drawing the string back
  // toward the cheek; built on first use, once the Blockbench bow has loaded.
  const bowRig = new THREE.Group(), leftFist = new THREE.Group(); rig.add(bowRig, leftFist);
  arms.push(arm(leftFist, skin, sleeve, bracer, glove));
  // Slimmed sideways: seen from behind the string the limbs would otherwise be chunky bars.
  bowRig.scale.set(.36, .68, .68); bowRig.visible = leftFist.visible = false;
  leftFist.scale.setScalar(.7);
  let held = null;
  const pull = new THREE.Vector3(), aim = new THREE.Vector3(), grip = new THREE.Vector3();
  let time = 0, currentTool = 0, switchDip = 0, walking = 0, guarding = 0, shaking = 0, roll = Math.PI / 2;
  // The blade turns about its own axis so the cutting edge (its width, local X) leads: along the
  // path of the tip while it swings, toward the target (into the screen) at rest and in guard.
  const tip = new THREE.Vector3(), lastTip = new THREE.Vector3(), lead = new THREE.Vector3(), turn = new THREE.Quaternion();
  let tipReady = false;
  function rollBlade(dt, swinging) {
    const hilt = weapon.hilt;
    hilt.updateWorldMatrix(true, false);
    tip.set(0, .9, 0).applyMatrix4(hilt.matrixWorld);
    // At rest the flat of the (thin) blade turns toward you, the edge to the side, so you see the steel.
    if (swinging && tipReady) lead.subVectors(tip, lastTip); else lead.set(-1, -.15, -.25);
    lastTip.copy(tip); tipReady = true;
    if (lead.lengthSq() < 1e-7) return;
    hilt.getWorldQuaternion(turn).invert(); lead.applyQuaternion(turn);
    let target = Math.atan2(-lead.z, lead.x);
    // Two edges: take whichever turn is shorter.
    target = roll + THREE.MathUtils.euclideanModulo(target - roll + Math.PI / 2, Math.PI) - Math.PI / 2;
    roll = THREE.MathUtils.lerp(roll, target, 1 - Math.exp(-(swinging ? 28 : 10) * dt));
    sword.rotation.y = roll;
  }
  // Like Skyrim. Placement is in screen terms (units of half the screen height at the item's depth), so the
  // bow keeps its place relative to the reticle on 4:3, 16:9 and ultrawide alike; wider screens only add
  // room at the edges. At rest it hangs low at the left edge, top leaning out, clear of the centre. Drawn,
  // it stands just left of the reticle, canted a little clockwise; the arrow runs from the cheek (out of
  // view, beside the eye) along the line of sight, so it points at the reticle; the string hand stays at
  // the cheek like in Skyrim, only the bow hand shows. A kick forward on release.
  const HALF = Math.tan(THREE.MathUtils.degToRad(31));
  const REST = { sx: -1.25, sy: -1.15, z: .9, cant: .55 }, DRAWN = { sx: -.36, sy: -.24, z: .95, cant: -.16 }, SHOULDER = new THREE.Vector3(-.85, -.8, -.4);
  const place = (out, o, wide) => out.set(o.sx * wide * HALF * o.z, o.sy * HALF * o.z, -o.z);
  const restPos = new THREE.Vector3(), drawnPos = new THREE.Vector3(), anchor = new THREE.Vector3();
  const restAim = new THREE.Vector3(-.12, .32, -1).normalize(), arrowLine = new THREE.Vector3(), qRest = new THREE.Quaternion(), qRaised = new THREE.Quaternion();
  function poseBow(bow, bob, sway, dip) {
    held ??= createHeldBow(scene, { thickness: .0024, arrowScale: .5 });
    if (!held || !bow.equipped) { hideBow(); return; }
    bowRig.visible = leftFist.visible = true; held.bow.visible = true;
    if (held.bow.parent !== bowRig) bowRig.add(held.bow);
    const k = ease(bow.raise), kick = bow.release * bow.release;
    // Ultrawide: the resting bow moves out toward the edge a little, never into the middle.
    place(restPos, REST, Math.min(1.35, Math.max(1, camera.aspect / (16 / 9))));
    place(drawnPos, DRAWN, 1);
    bowRig.position.lerpVectors(restPos, drawnPos, k).add(grip.set(-sway, bob - dip, -kick * .05));
    // The cheek anchor lies almost straight behind the grip: the arrow points where you look.
    anchor.copy(drawnPos).add(aim.set(.02, -.08, .78));
    arrowLine.subVectors(drawnPos, anchor).normalize();
    aimObject(bowRig, restAim, REST.cant); qRest.copy(bowRig.quaternion);
    aimObject(bowRig, arrowLine, DRAWN.cant); qRaised.copy(bowRig.quaternion);
    bowRig.quaternion.slerpQuaternions(qRest, qRaised, k);
    if (kick) bowRig.rotateX(kick * .12);
    bowRig.updateMatrixWorld(true);
    // The bow arm runs down and out of the frame, clear of the arrow, on any screen shape.
    leftFist.position.copy(bowRig.position); leftFist.quaternion.setFromUnitVectors(ELBOW, aim.subVectors(SHOULDER, bowRig.position).lerp(grip.set(-.25, -1, .1), 1 - k).normalize());
    // The string from its braced place back to the cheek.
    held.pullPoint(pull, 0, arrowLine).lerp(anchor, ease(bow.draw));
    right.visible = false;
    held.update(bow.draw, bow.nocked || bow.draw > 0 ? pull : null, bow.nocked);
  }
  // Sword (tool 1): the fist, forearm and blade from the view-space poses above, rest blended into guard and
  // the strike keys laid over that. Screen terms like the bow, so it keeps its place on ultrawide screens.
  const swordPose = { at: new THREE.Vector3(), blade: new THREE.Vector3() };
  const bladeLocal = new THREE.Vector3(), armInverse = new THREE.Quaternion(), forearm = new THREE.Vector3();
  function poseSword(action, lift) {
    blendPose(swordPose, SWORD_REST, SWORD_GUARD, guarding);
    if (action?.kind === 'sword') strikePose(swordPose, swordPose, clamp(action.progress, 0, 1), clamp(Math.floor(action.combo || 0), 0, 2));
    const wide = Math.min(1.35, Math.max(1, camera.aspect / (16 / 9))), z = swordPose.at.z;
    right.position.set(swordPose.at.x * wide * HALF * z + lift.x, swordPose.at.y * HALF * z + lift.y, -z);
    aimArm(right, forearm.subVectors(right.position, SHOULDER).normalize());
    armInverse.copy(right.quaternion).invert();
    weapon.hilt.quaternion.setFromUnitVectors(UP, bladeLocal.copy(swordPose.blade).applyQuaternion(armInverse));
  }
  function hideBow() { bowRig.visible = leftFist.visible = false; if (held) { held.setVisible(false); held.bow.visible = true; } }
  function light(world, camera) {
    if (!world) return;
    camera.getWorldQuaternion(viewInverse).invert();
    sky.color.copy(world.ambient); sky.groundColor.copy(world.ground); sky.intensity = world.ambientIntensity;
    key.color.copy(world.key); key.intensity = world.keyIntensity; key.position.copy(world.keyDirection).applyQuaternion(viewInverse).multiplyScalar(4);
    lamp.color.copy(world.lamp); lamp.intensity = world.lampIntensity; lamp.position.copy(world.lampDirection).applyQuaternion(viewInverse).multiplyScalar(4);
  }
  // ── Motion layer over everything held (own take on what Punchy / Hold My Items do): the hands are a body
  // part with weight. Two damped springs (position and rotation) carry the whole rig:
  // - looking round, the hands lag behind the view and swing back; - walking, they trace a figure eight in
  //   step with the feet; sprinting they drop, tilt in and pump; - sidestepping tilts them against the step;
  // - jumping they lag down, falling they float up, landing they bounce by how hard you came down;
  // - sneaking they sink and tilt; - switching tools the old one turns away down, the new one comes up;
  // - pressing E the free hand reaches out; - taking a blow jolts them; a blocked blow kicks the guard.
  const spring = { p: new THREE.Vector3(), pv: new THREE.Vector3(), r: new THREE.Vector3(), rv: new THREE.Vector3() };
  const look = { yaw: null, pitch: 0, vy: 0, vp: 0 }, motion = { wasAir: false, lastVy: 0, reach: 0, sprint: 0, sneak: 0, side: 0, swap: 0 };
  const springTarget = new THREE.Vector3(), rotTarget = new THREE.Vector3(), rigBase = new THREE.Vector3();
  function kick(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) { spring.pv.x += px; spring.pv.y += py; spring.pv.z += pz; spring.rv.x += rx; spring.rv.y += ry; spring.rv.z += rz; }
  function motionLayer(dt, player, tool) {
    // Look inertia from the turn rate of the view.
    if (look.yaw === null) { look.yaw = player.yaw; look.pitch = player.pitch; }
    const dyaw = THREE.MathUtils.euclideanModulo(player.yaw - look.yaw + Math.PI, Math.PI * 2) - Math.PI, dpitch = player.pitch - look.pitch;
    look.yaw = player.yaw; look.pitch = player.pitch;
    look.vy = THREE.MathUtils.lerp(look.vy, clamp(dyaw / Math.max(dt, 1e-3), -12, 12), 1 - Math.exp(-dt * 18));
    look.vp = THREE.MathUtils.lerp(look.vp, clamp(dpitch / Math.max(dt, 1e-3), -12, 12), 1 - Math.exp(-dt * 18));
    const speed = player.moveSpeed || 0, grounded = player.grounded !== false;
    motion.sprint = THREE.MathUtils.lerp(motion.sprint, speed > 7 && grounded && tool !== 3 ? 1 : 0, 1 - Math.exp(-dt * 8));
    motion.sneak = THREE.MathUtils.lerp(motion.sneak, player.sneaking ? 1 : 0, 1 - Math.exp(-dt * 7));
    // Sideways speed in view space (strafing) tilts the hands against the step.
    const vx = player.velocity?.x || 0, vz = player.velocity?.z || 0, sideways = vx * Math.cos(player.yaw) - vz * Math.sin(player.yaw);
    motion.side = THREE.MathUtils.lerp(motion.side, clamp(sideways / 5, -1, 1), 1 - Math.exp(-dt * 8));
    // Landing: a bounce by the speed of the fall.
    const air = !grounded;
    if (motion.wasAir && !air) { const k = clamp(-motion.lastVy / 12, .1, 1); kick(0, -.28 * k, .05 * k, -.8 * k, 0, 0); }
    motion.wasAir = air; motion.lastVy = player.velocityY || 0;
    motion.reach = Math.max(0, motion.reach - dt / .45); motion.swap = Math.max(0, motion.swap - dt);
    // Targets the springs pull toward.
    const stride = player.stride || 0, w = clamp(speed / 5, 0, 1.6);
    // Kept small (feedback 2026-10-30: the hands swung far too much): a hint of weight, never a wobble.
    springTarget.set(
      -look.vy * .005 + Math.sin(stride * .5) * .008 * w + motion.side * .015,
      Math.abs(Math.cos(stride * .5)) * -.008 * w - motion.sprint * .03 - motion.sneak * .05 + (air ? clamp(-(player.velocityY || 0) * .003, -.025, .03) : 0),
      motion.sprint * .025);
    rotTarget.set(
      look.vp * .012 - motion.sprint * .1 + motion.sneak * .06,
      look.vy * .018 + motion.sprint * .08,
      -look.vy * .008 + Math.sin(stride * .5) * .012 * w - motion.side * .05 - motion.sprint * .08);
    // Sprinting the hands pump with the stride.
    if (motion.sprint > .05) { springTarget.y += Math.sin(stride) * .012 * motion.sprint; rotTarget.x += Math.sin(stride) * .04 * motion.sprint; }
    // Tool swap: down and turned away, then back up.
    if (motion.swap > 0) { const k = Math.sin(Math.PI * Math.min(1, motion.swap / .35)); springTarget.y -= .22 * k; rotTarget.x -= .6 * k; rotTarget.z += .3 * k; }
    // Damped springs, close to critical: they follow without swinging back and forth.
    const kP = 90, cP = 19, kR = 70, cR = 17;
    spring.pv.addScaledVector(springTarget.clone().sub(spring.p), kP * dt).multiplyScalar(Math.exp(-cP * dt));
    spring.rv.addScaledVector(rotTarget.clone().sub(spring.r), kR * dt).multiplyScalar(Math.exp(-cR * dt));
    spring.p.addScaledVector(spring.pv, dt); spring.r.addScaledVector(spring.rv, dt);
    spring.p.clampLength(0, .2);
    rig.position.copy(rigBase).add(spring.p); rig.rotation.set(spring.r.x, spring.r.y, spring.r.z);
    // Reaching (E): the free (left) hand goes out toward what you take, opens, comes back.
    if (motion.reach > 0 && tool !== 3) {
      const k = Math.sin(Math.PI * (1 - motion.reach));
      left.visible = true; left.position.lerp(new THREE.Vector3(-.18, -.16, -.72), k); left.rotation.x += -.5 * k; left.rotation.z += .3 * k;
    }
  }
  function update(dt, player, worldCamera, action, guard, bow = { raise: 0, draw: 0, release: 0, nocked: false, equipped: false }, worldLight = null) {
    light(worldLight, worldCamera);
    skin.color.set(APPEARANCE_OPTIONS.skins[player.appearance?.skin ?? 2] || APPEARANCE_OPTIONS.skins[2]);
    sleeve.color.set(player.sleeveColor || '#3a4a5a').multiplyScalar(.85);
    // Gloves and bracers from the hands slot (main.js handGear), in their own colours.
    const gear = player.handGear || {};
    if (gear.bracer) bracer.color.set(gear.bracer); if (gear.glove) glove.color.set(gear.glove);
    for (const a of arms) { a.userData.bracer.visible = !!gear.bracer; a.userData.glove.visible = !!gear.glove; }
    time += dt;
    weapon.equip(player.equipment?.weapon);
    // Keep the drinking silhouette below 18% width, including narrow windows.
    flask.bottle.scale.setScalar(.64 * Math.min(1, worldCamera.aspect / (4 / 3)));
    const tool = (action ? { drink: 2, cast: 1, sword: 0 }[action.kind] : player.tool) ?? player.tool ?? 0;
    if (currentTool !== tool) { currentTool = tool; switchDip = .15; motion.swap = .35; }
    switchDip = Math.max(0, switchDip - dt);
    walking = THREE.MathUtils.lerp(walking, clamp((player.moveSpeed || 0) / 3, 0, 1), 1 - Math.exp(-dt * 10));
    guarding = THREE.MathUtils.lerp(guarding, guard ? 1 : 0, 1 - Math.exp(-dt * 18));
    const stride = player.stride || 0, breathe = Math.sin(time * 1.65) * .004;
    const bob = (Math.abs(Math.cos(stride)) - .5) * .012 * walking;
    const sway = Math.sin(stride * .5) * .006 * walking + Math.sin(time * .83) * .002;
    const dip = ease(switchDip / .15) * .14;
    right.position.set(.34 + sway, -.32 + breathe + bob - dip, -1.05);
    right.rotation.set(-.08, -.08, -.14 + sway * .6);
    weapon.hilt.quaternion.identity();
    left.position.set(-.34 - sway, -.32 + breathe - bob - dip, -.92);
    left.rotation.set(.1, .18, .15 - sway * .6);
    right.visible = tool !== 1; left.visible = tool === 1 || guard || guarding > .01;
    sword.visible = tool === 0; flask.bottle.visible = tool === 2; spell.visible = tool === 1;
    left.position.lerp(new THREE.Vector3(-.22, -.2, -.72), guarding);
    if (tool === 0) poseSword(action, { x: sway, y: breathe + bob - dip });
    if (action) {
      const p = clamp(action.progress, 0, 1);
      if (action.kind === 'cast') {
        const gather = phase(p, 0, .22) * (1 - phase(p, .22, .4));
        const push = phase(p, .22, .42) * (1 - phase(p, .56, 1));
        left.position.z += gather * .08 - push * .25;
        left.position.y += push * .055; left.rotation.x += gather * .2 - push * .5;
      } else if (action.kind === 'drink') {
        const lift = phase(p, 0, .28) * (1 - phase(p, .74, 1));
        const tilt = phase(p, .28, .46) * (1 - phase(p, .7, .87));
        right.position.lerp(new THREE.Vector3(.12, -.42, -1.3), lift);
        right.rotation.z += tilt * 1.1; right.rotation.x -= lift * .25;
      }
    }
    // Shaking the potion (block held with the potion in hand): the fist rattles it to and fro.
    shaking = THREE.MathUtils.lerp(shaking, tool === 2 && player.shaking && action?.kind !== 'drink' ? 1 : 0, 1 - Math.exp(-dt * 12));
    if (shaking > .01) {
      right.position.x += Math.sin(time * 26) * .05 * shaking; right.position.y += Math.sin(time * 52) * .02 * shaking;
      right.rotation.z += Math.sin(time * 26 + .6) * .35 * shaking;
    }
    rollBlade(dt, action?.kind === 'sword');
    if (tool === 3) poseBow(bow, bob, sway, dip); else hideBow();
    core.rotation.set(time * .25, time * .5, .35); core.scale.setScalar(1 + Math.sin(time * 31) * .15);
    if (tool === 1) burn(dt, action?.kind === 'cast' ? Math.sin(Math.min(1, action.progress) * Math.PI) : 0);
    else { palmLight.intensity = 0; for (const f of flames) { f.life = 0; f.mesh.visible = false; } }
    flask.update(dt, player, worldCamera, action);
    motionLayer(dt, player, tool);
    if (camera.aspect !== worldCamera.aspect) { camera.aspect = worldCamera.aspect; camera.updateProjectionMatrix(); }
  }
  function reset() {
    time = currentTool = switchDip = walking = guarding = 0; flask.reset();
    right.position.set(.62, -.55, -1.05); right.rotation.set(-1.12, -.08, -.14);
    left.position.set(-.34, -.32, -.92); left.rotation.set(.1, .18, .15);
    right.visible = sword.visible = true; left.visible = flask.bottle.visible = spell.visible = false;
    hideBow();
  }
  reset();
  return {
    update, reset,
    /** Strength (0..1) of a slosh against the glass worth a sound since the last call, else 0. */
    sloshCue: () => flask.takeCue(),
    /** The free hand reaches out (taking, opening, looting). */
    reach() { motion.reach = 1; },
    /** A blow taken (strength 0..1), or a blow caught on the guard. */
    hit(strength = .5, blocked = false) { const k = clamp(strength, .1, 1); blocked ? kick(0, -.2 * k, .5 * k, .9 * k, 0, .4 * k) : kick((Math.random() - .5) * .8 * k, -.4 * k, .3 * k, -.8 * k, (Math.random() - .5) * .6 * k, (Math.random() - .5) * .8 * k); },
    render(renderer) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true; },
    state: () => ({ tool: currentTool, rightVisible: right.visible, leftVisible: left.visible, sword: sword.visible, potion: flask.bottle.visible, spell: spell.visible, bow: bowRig.visible, liquid: flask.state() }),
  };
}
