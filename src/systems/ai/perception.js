import * as THREE from 'three';
import { AI } from './config.js';

// Layer A — perception. Nobody knows anything they have not seen or heard. Sight builds awareness over
// time inside a view cone, scaled by light, distance and how the wanderer moves; walls block it.
// Hearing reads a shared bus of sounds (position, kind, loudness); walls muffle them and the farther
// a sound is, the vaguer its direction. What a brain perceives becomes beliefs (memory.js).

/** All sounds of the last two seconds. Brains read what is new since they last listened. */
export function createSoundBus() {
  const sounds = [];
  let time = 0;
  return {
    emit(kind, position, { loudness = AI.sounds[kind] ?? 10, source = null, speaker = null, text = null, info = null } = {}) {
      sounds.push({ kind, x: position.x, y: position.y, z: position.z, loudness, source, speaker, text, info, t: time });
      if (sounds.length > 96) sounds.shift();
    },
    forEachSince(t, fn) { for (const s of sounds) if (s.t > t) fn(s); },
    advance(dt) { time += dt; while (sounds.length && time - sounds[0].t > 2) sounds.shift(); },
    get time() { return time; },
    get size() { return sounds.length; },
  };
}

const eye = new THREE.Vector3(), chest = new THREE.Vector3(), to = new THREE.Vector3(), point = new THREE.Vector3();
const forward = (yaw, out) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
const fwd = new THREE.Vector3();

/** Eye point of an NPC (borrowed vector). */
export function eyeOf(npc, out = eye) {
  return out.copy(npc.model.position).setY(npc.model.position.y + AI.sight.eye * (npc.model.scale?.y || 1) * (npc.kind === 'wolf' ? .5 : 1));
}

/** Is `target` inside this NPC's view cone? (cone half-angle from the full fov) */
export function inView(npc, target, fov) {
  forward(npc.model.rotation.y, fwd);
  to.set(target.x - npc.model.position.x, 0, target.z - npc.model.position.z);
  const d = to.length();
  return d < .01 || fwd.dot(to) / d > Math.cos(fov / 2);
}

/**
 * Updates the brain's awareness of the wanderer and its hearing, from what this NPC can perceive.
 * ctx: { world, player: { position, stance, noise }, daylight, time }
 * Returns { sees, glimpsed, heard: [sounds] } for the decision layer.
 */
export function sense(brain, ctx, dt) {
  const { npc } = brain, world = ctx.world, p = ctx.player;
  // Heard sounds queue up until the next think tick drains them (brain.js); sight is per sense tick.
  const result = brain.perceived;
  result.sees = false; result.glimpsed = false;
  if (result.heard.length > 24) result.heard.splice(0, result.heard.length - 24);
  eyeOf(npc, eye);
  chest.copy(p.position).setY(p.position.y + 1.4);
  const d = eye.distanceTo(chest), asleep = brain.asleep;
  // ── Sight.
  let vis = 0;
  if (!asleep) {
    const fov = brain.alert ? AI.sight.fovAlert : AI.sight.fov;
    const range = THREE.MathUtils.lerp(AI.sight.nightRange, AI.sight.range, ctx.daylight) * (npc.kind === 'wolf' ? 1.15 : 1);
    const stance = AI.sight.stance[p.stance] ?? 1;
    const near = d < AI.sight.feel && p.stance !== 'sneakStill';
    if ((near || inView(npc, chest, fov)) && d < range * stance) {
      brain.los = !world.segmentBlocked(eye, chest, .02);
      if (brain.los) vis = near ? 1 : stance * (1 - d / (range * stance)) ** .7;
    }
  }
  if (vis > 0) brain.awareness = Math.min(1.2, brain.awareness + vis * AI.sight.rate * dt * (brain.alert ? 1.7 : 1) * (.6 + brain.traits.suspicion * .8));
  else brain.awareness = Math.max(0, brain.awareness - AI.sight.decay * dt);
  if (vis > 0 && brain.awareness >= 1) {
    result.sees = true;
    brain.memory.see(p.position, ctx.time, 'sight');
  } else if (vis > 0 && brain.awareness >= AI.sight.glimpse) {
    // A glimpse: something moved over there. Rough place, low quality.
    result.glimpsed = true;
    brain.memory.hear(point.copy(p.position).add(jitter(d * .15, brain)), ctx.time, .35, 'glimpse');
  }
  brain.sees = result.sees;
  // ── The wanderer's own noise (steps, running, armour), heard without a bus entry.
  if (p.noise > 0) {
    const loud = p.noise * (asleep ? .45 : 1) * (world.segmentBlocked(eye, chest, .02) ? AI.hearing.wall : 1);
    if (d < loud) {
      const strength = 1 - d / loud;
      if (!result.sees) brain.memory.hear(point.copy(p.position).add(jitter(d * AI.hearing.error * (1 - strength), brain)), ctx.time, .25 + strength * .35, 'step');
      result.heard.push({ kind: 'step', strength, source: 'player' });
    }
  }
  // ── The bus: fights, shouts, arrows, spells.
  ctx.sounds.forEachSince(brain.lastHeard, s => {
    if (s.speaker === npc) return;
    point.set(s.x, s.y + 1, s.z);
    const sd = eye.distanceTo(point), loud = s.loudness * (asleep ? .5 : 1) * (sd > 4 && world.segmentBlocked(eye, point, .02) ? AI.hearing.wall : 1);
    if (sd >= loud) return;
    const strength = 1 - sd / loud;
    result.heard.push({ ...s, strength, distance: sd });
    if (s.source === 'player' && !result.sees) brain.memory.hear(point.set(s.x, s.y, s.z).add(jitter(sd * AI.hearing.error * (1 - strength), brain)), ctx.time, .3 + strength * .4, s.kind);
  });
  brain.lastHeard = ctx.sounds.time;
  return result;
}

// A seeded scatter so a brain's guesses differ from its neighbours' but stay reproducible.
const scatter = new THREE.Vector3();
function jitter(radius, brain) {
  const r = brain.random, a = r() * Math.PI * 2, k = Math.sqrt(r()) * radius;
  return scatter.set(Math.cos(a) * k, 0, Math.sin(a) * k);
}
