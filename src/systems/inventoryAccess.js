import * as THREE from 'three';
import { createBackpack, backpackLoaded } from '../characters/backpack.js';

// Opening the inventory is an act, not a menu flip: the wanderer swings the backpack round from the back,
// undoes the buckle, the flap falls open and they look in. Seen from outside (third person) the pack travels
// round the right side to the chest, the arms hold it and the head bows over it; in first person it rises
// from below the view, tilted toward you, and the hands close round it. The camera follows both ways: it
// glides over the shoulder (or tips down) and narrows its field of view; once the flap is open the inventory
// fades in over the view, and closing plays everything backwards. All of it eases on real time, so it keeps
// moving while the game proper is paused behind the menu.
//
//   idle → opening (0 … READY) → open (until closed) → closing (CLOSE) → idle
const READY = 1.0, CLOSE = .62;
const OPEN_FROM = .38, OPEN_FOR = .55, SWING_FOR = .66;
const ease = { out: t => 1 - (1 - t) ** 3, inOut: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2, back: t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; } };
const clamp01 = v => Math.max(0, Math.min(1, v));
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _look = new THREE.Vector3();

export function createInventoryAccess({ scene, player, firstPerson, puff = () => {}, sound = () => {}, blocked = () => false }) {
  let phase = 'idle', t = 0, onReady = null, onDone = null, blend = 0, pack = null, fpPack = null, holdAt = null;
  const world = { open: 0, slack: 0, move: 0, scale: 1 };   // the pack's own state, 0..1
  const from = { move: 1, open: 1 };                        // where a closing starts (it can be cancelled half way)

  function ensure() {
    if (!backpackLoaded()) return false;
    if (!pack) { pack = createBackpack(); fpPack = createBackpack(); pack.root.visible = fpPack.root.visible = false; }
    if (!pack.root.parent) scene.add(pack.root);
    firstPerson?.attachPack?.(fpPack.root);
    return true;
  }
  /** Starts the opening; `ready()` is called when the flap is open and the inventory may appear. */
  function begin(ready) {
    if (phase !== 'idle' && phase !== 'closing') return false;
    if (!ensure()) { ready?.(); return false; }   // no model (node tests, load failure): open the menu at once
    phase = 'opening'; t = phase === 'closing' ? t : 0; onReady = ready;
    pack.root.visible = player.mode === 'third'; fpPack.root.visible = player.mode === 'first';
    sound('packOpen');
    return true;
  }
  /** Closes it: flap shut, pack back to the shoulder. `done()` once it is over. */
  function end(done) {
    if (phase === 'idle' || phase === 'closing') { done?.(); return; }
    phase = 'closing'; t = 0; onDone = done; onReady = null; from.move = world.move; from.open = world.open; sound('packClose');
  }

  const eyePos = () => (player.renderPosition || player.position);
  /** Places the pack in the world around the player at progress k (0 = on the back, 1 = held open in front). */
  function placeThirdPerson(k, open) {
    const P = eyePos(), yaw = player.yaw;
    _f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // From between the shoulder blades round the right side to the chest, rising a little on the way.
    _a.copy(P).addScaledVector(_f, -.4).setY(P.y + 1.5);
    _c.copy(P).addScaledVector(_f, .52).setY(P.y + .98);
    _b.copy(P).addScaledVector(_r, .95).addScaledVector(_f, .02).setY(P.y + 1.62);
    const m = ease.inOut(k), u = 1 - m;
    _p.copy(_a).multiplyScalar(u * u).addScaledVector(_b, 2 * u * m).addScaledVector(_c, m * m);
    pack.root.position.copy(_p);
    // It stays outer side toward the wearer, swings out as it travels and settles tilted toward them.
    // Worn, its outer side faces back; swung round the side to the front it turns half a circle, so the buckles end up facing the world,
    // and it leans back toward the wearer, who looks into the opening.
    pack.root.rotation.set(.42 * ease.out(k) + Math.sin(k * Math.PI) * .12, yaw + Math.PI * (1 - m) + Math.sin(k * Math.PI) * .3, Math.sin(k * Math.PI) * .2, 'YXZ');
    const grow = k < 1 ? .35 + .65 * ease.back(clamp01(k * 1.15)) : 1;
    pack.root.scale.setScalar(grow * world.scale);
    pack.set(open * .8, k);   // the flap stands up behind the opening rather than falling onto the wearer
  }
  /** First person: the pack rises from below the view, tilted toward the eye. In the hand scene, units are the arm's. */
  function placeFirstPerson(k, open) {
    const m = ease.out(k);
    fpPack.root.position.set(.02 - (1 - m) * .25, -1.5 + 0.98 * ease.back(clamp01(k * 1.1)) , -.96 + (1 - m) * .2);
    fpPack.root.rotation.set(-.62 - (1 - m) * 1.0, Math.PI + (1 - m) * .5, (1 - m) * .3, 'YXZ');
    fpPack.root.scale.setScalar(.62 * (.5 + .5 * m));
    fpPack.set(open, k);
  }

  function update(dt) {
    if (phase === 'idle') { blend = 0; return; }
    t += Math.min(dt, .1);
    if (holdAt !== null && t > holdAt) t = holdAt;   // test hook: freeze the animation at one moment
    let k, open;
    if (phase === 'opening' || phase === 'open') {
      k = clamp01(t / SWING_FOR);
      open = ease.back(clamp01((t - OPEN_FROM) / OPEN_FOR));
      blend = ease.inOut(clamp01((t - .12) / (READY - .12)));
      if (phase === 'opening' && t >= READY) { phase = 'open'; const f = onReady; onReady = null; f?.(); }
    } else {
      const u = clamp01(t / CLOSE);
      k = from.move * (1 - ease.inOut(clamp01(u * 1.25))); open = from.open * (1 - ease.out(clamp01(u * 2.2)));
      blend = 1 - ease.inOut(clamp01(u));
      if (t >= CLOSE) {
        phase = 'idle'; blend = 0; pack.root.visible = fpPack.root.visible = false;
        const f = onDone; onDone = null; puff(pack.root.position); f?.(); return;
      }
    }
    world.open = open; world.move = k;
    if (player.mode === 'third') { pack.root.visible = true; fpPack.root.visible = false; placeThirdPerson(k, open); }
    else { fpPack.root.visible = true; pack.root.visible = false; placeFirstPerson(k, open); }
    if (phase === 'opening' && t - dt <= 0) puff(pack.root.position);
  }

  /** The camera glides toward the pack. Call after the normal camera has been placed. */
  function applyCamera(camera) {
    if (blend <= 0) return;
    const yaw = player.yaw, P = eyePos(), b = blend;
    _f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    if (player.mode === 'third') {
      // In front of the wanderer and a little to the side, close in: the head bowed over the open pack, held at the chest.
      _a.copy(P).addScaledVector(_f, 2.4).addScaledVector(_r, 1.1).setY(P.y + 2.75);
      for (let i = 0; i < 10 && blocked(_a.x, _a.z, _a.y); i++) _a.lerp(P, .12).setY(P.y + 2.75);
      _look.copy(P).addScaledVector(_f, .2).setY(P.y + 1.55);
      _c.copy(camera.position).add(camera.getWorldDirection(_b).multiplyScalar(3.2));
      camera.position.lerp(_a, b);
      camera.lookAt(_c.lerp(_look, b));
    } else {
      // Tip the head down toward the hands and lean in.
      const pitch = THREE.MathUtils.lerp(player.pitch, -.62, b);
      _look.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      camera.position.addScaledVector(_look, .1 * b);
      camera.lookAt(_c.copy(camera.position).add(_look));
    }
  }

  return {
    begin, end, update, applyCamera,
    get phase() { return phase; }, get blend() { return blend; },
    /** How much narrower the field of view is while looking into the pack (a share of it): main.js applies it with the zoom. */
    fovCut: () => blend * (player.mode === 'third' ? .2 : .26),
    /** True from the first swing until the pack is away again: no walking, no fighting. */
    locked: () => phase !== 'idle',
    /** Arm and head pose for the third-person animator (characters/animator.js 'pack'), or null. */
    pose: () => phase === 'idle' || player.mode !== 'third' ? null : { reach: ease.inOut(clamp01(world.move * 1.1)), open: world.open, look: blend },
    /** First-person hands: how far the pack is up, how open it is. */
    fpPose: () => phase === 'idle' || player.mode !== 'first' ? null : { k: world.move, open: world.open },
    /** Test hook: freezes the opening at `seconds` (null lets it run). */
    hold(seconds) { holdAt = seconds; },
    reset() { phase = 'idle'; t = 0; blend = 0; onReady = onDone = null; if (pack) pack.root.visible = false; if (fpPack) fpPack.root.visible = false; },
  };
}
