import * as THREE from 'three';
import { createBackpack, backpackLoaded } from '../characters/backpack.js';

// Opening the inventory is an act, not a menu flip: the wanderer swings the backpack round from the back, the flap
// falls open and they look in. Third person: the pack travels round the right side to the chest and the camera
// rises over the right shoulder until it looks straight down into the open pack; first person: the pack comes up
// from below, tilting its mouth toward the eye, and the head bows over it. Then the view goes in: the camera sinks
// toward the opening while the field of view narrows, and the menu grows out of the pack's mouth (inventory.css,
// at the screen point mouth() gives). Closing folds the menu back into the mouth, pulls out, shuts the flap and
// shoulders the pack. All of it eases on real time, so it keeps moving while the game behind the menu is paused.
//
//   idle → opening (0 … READY, the menu appears; the dive goes on to DIVE_END) → open → closing (CLOSE) → idle
const READY = .8, DIVE_FROM = .62, DIVE_END = 1.25, CLOSE = .78;
const OPEN_FROM = .3, OPEN_FOR = .5, SWING_FOR = .62, LOOK_FROM = .1, LOOK_FOR = .62;
const ease = {
  out: t => 1 - (1 - t) ** 3, inOut: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  sine: t => .5 - Math.cos(Math.PI * t) / 2, back: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
};
const clamp01 = v => Math.max(0, Math.min(1, v));
const MOUTH = new THREE.Vector3(0, .74, -.02);   // the middle of the pack's opening, in its own space
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _look = new THREE.Vector3(), _m = new THREE.Vector3();

export function createInventoryAccess({ scene, player, firstPerson, puff = () => {}, sound = () => {}, blocked = () => false }) {
  let phase = 'idle', t = 0, onReady = null, onDone = null, look = 0, dive = 0, pack = null, fpPack = null, holdAt = null, tilt = null;
  const world = { open: 0, move: 0 };
  const from = { move: 1, open: 1, look: 1, dive: 1 };   // where a closing starts (it can begin half way)

  function ensure() {
    if (!backpackLoaded()) return false;
    if (!pack) { pack = createBackpack(); fpPack = createBackpack(); pack.root.visible = fpPack.root.visible = false; }
    if (!pack.root.parent) scene.add(pack.root);
    firstPerson?.attachPack?.(fpPack.root);
    return true;
  }
  /** Starts the opening; `ready()` is called when the menu may appear (the view is going into the pack). */
  function begin(ready) {
    if (phase !== 'idle' && phase !== 'closing') return false;
    if (!ensure()) { ready?.(); return false; }   // no model (node tests, load failure): open the menu at once
    // Re-opened while closing: carry on from where the pack is.
    t = phase === 'closing' ? Math.min(SWING_FOR, world.move * SWING_FOR) : 0;
    phase = 'opening'; onReady = ready;
    pack.root.visible = player.mode === 'third'; fpPack.root.visible = player.mode === 'first';
    sound('packOpen');
    return true;
  }
  /** Closes it: out of the pack, flap shut, pack back to the shoulder. `done()` once it is over. */
  function end(done) {
    if (phase === 'idle' || phase === 'closing') { done?.(); return; }
    phase = 'closing'; t = 0; onDone = done; onReady = null;
    Object.assign(from, { move: world.move, open: world.open, look, dive }); sound('packClose');
  }

  const eyePos = () => (player.renderPosition || player.position);
  /** Third person: the pack at progress k (0 = on the back, 1 = held open at the chest). */
  function placeThirdPerson(k, open) {
    const P = eyePos(), yaw = player.yaw;
    _f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // From between the shoulder blades round the right side to the chest, rising a little on the way.
    _a.copy(P).addScaledVector(_f, -.4).setY(P.y + 1.5);
    _c.copy(P).addScaledVector(_f, .5).setY(P.y + .96);
    _b.copy(P).addScaledVector(_r, .95).addScaledVector(_f, .05).setY(P.y + 1.6);
    const m = ease.inOut(k), u = 1 - m;
    _p.copy(_a).multiplyScalar(u * u).addScaledVector(_b, 2 * u * m).addScaledVector(_c, m * m);
    pack.root.position.copy(_p);
    // Worn, its outer side faces back; swung round to the front it turns half a circle and tips its mouth toward the wearer.
    pack.root.rotation.set(.5 * ease.out(k) + Math.sin(k * Math.PI) * .12, yaw + Math.PI * (1 - m) + Math.sin(k * Math.PI) * .3, Math.sin(k * Math.PI) * .2, 'YXZ');
    pack.root.scale.setScalar(k < 1 ? .4 + .6 * ease.back(clamp01(k * 1.15)) : 1);
    pack.set(open * .85, k);
  }
  /** First person: the pack rises from below the view, its mouth turning toward the eye; the dive brings it closer. */
  function placeFirstPerson(k, open, d) {
    const m = ease.out(k), rise = ease.back(clamp01(k * 1.1)), e = ease.inOut(d);
    fpPack.root.position.set(.02 - (1 - m) * .25, -1.46 + 1.1 * rise + .08 * e, -.94 + (1 - m) * .2 + .2 * e);
    // Its outer side toward you and its mouth tipped up toward the eye, as when you hold a bag to look in;
    // the flap stands up on the far side, so nothing hides the opening.
    fpPack.root.rotation.set(-.35 - .55 * m - .08 * e, Math.PI + (1 - m) * .5, (1 - m) * .3, 'YXZ');
    if (tilt) fpPack.root.rotation.set(tilt.x, tilt.y, 0, 'YXZ');
    fpPack.root.scale.setScalar(.62 * (.5 + .5 * m) * (1 + .16 * e));
    fpPack.set(open, k);
  }

  function update(dt) {
    if (phase === 'idle') { look = dive = 0; return; }
    t += Math.min(dt, .1);
    if (holdAt !== null && t > holdAt) t = holdAt;   // test hook: freeze the animation at one moment
    let k, open;
    if (phase === 'opening' || phase === 'open') {
      k = clamp01(t / SWING_FOR);
      open = ease.back(clamp01((t - OPEN_FROM) / OPEN_FOR));
      look = ease.sine(clamp01((t - LOOK_FROM) / LOOK_FOR));
      dive = ease.sine(clamp01((t - DIVE_FROM) / (DIVE_END - DIVE_FROM)));
      if (phase === 'opening' && t >= READY) { phase = 'open'; const f = onReady; onReady = null; f?.(); }
    } else {
      // Out of the pack first, then the flap shuts and the pack goes back.
      const u = clamp01(t / CLOSE);
      dive = from.dive * (1 - ease.sine(clamp01(u / .45)));
      look = from.look * (1 - ease.sine(clamp01((u - .15) / .7)));
      open = from.open * (1 - ease.out(clamp01((u - .2) / .4)));
      k = from.move * (1 - ease.inOut(clamp01((u - .3) / .7)));
      if (t >= CLOSE) {
        phase = 'idle'; look = dive = 0; pack.root.visible = fpPack.root.visible = false;
        const f = onDone; onDone = null; puff(pack.root.position); f?.(); return;
      }
    }
    world.open = open; world.move = k;
    if (player.mode === 'third') { pack.root.visible = true; fpPack.root.visible = false; placeThirdPerson(k, open); }
    else { fpPack.root.visible = true; pack.root.visible = false; placeFirstPerson(k, open, dive); }
    if (phase === 'opening' && t - dt <= 0) puff(pack.root.position);
  }

  /** Where the pack's opening is in the world (third person). */
  const mouthWorld = out => { pack.root.updateMatrixWorld(true); return pack.root.localToWorld(out.copy(MOUTH)); };
  /** The camera goes to look into the pack, then down into it. Call after the normal camera has been placed. */
  function applyCamera(camera) {
    if (look <= 0 && dive <= 0) return;
    const yaw = player.yaw, P = eyePos();
    _f.set(-Math.sin(yaw), 0, -Math.cos(yaw)); _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    if (player.mode === 'third' && pack) {
      // Over the right shoulder, high, looking steeply down into the opening; the dive sinks toward it.
      mouthWorld(_m);
      // The camera comes in over the shoulder to the wanderer's own eyes (the head is not drawn then, hideHead)
      // and looks down into the mouth of the pack, which is tipped toward them; the dive sinks toward it.
      _a.copy(P).addScaledVector(_f, -.04).addScaledVector(_r, .05); _a.y = P.y + 2.28;
      _a.lerp(_m, .12 * dive);
      _c.copy(camera.position).add(camera.getWorldDirection(_b).multiplyScalar(3.2));
      camera.position.lerp(_a, look);
      camera.lookAt(_c.lerp(_m, look));
    } else {
      // Bow the head over the hands, lean in as the view goes into the pack.
      const pitch = THREE.MathUtils.lerp(player.pitch, -.78, look);
      _look.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      camera.position.addScaledVector(_look, .12 * look + .1 * dive);
      camera.lookAt(_c.copy(camera.position).add(_look));
    }
  }
  /** The opening on screen, 0..1 from the top left (where the menu grows from), or null. */
  function mouth(camera) {
    if (phase === 'idle' || !pack) return null;
    if (player.mode !== 'third') return { x: .5, y: .6 };
    mouthWorld(_m).project(camera);
    return { x: clamp01(_m.x * .5 + .5), y: clamp01(-_m.y * .5 + .5) };
  }

  return {
    begin, end, update, applyCamera, mouth,
    get phase() { return phase; }, get blend() { return look; }, get dive() { return dive; },
    /** Third person: the camera passes the bowed head on its way into the pack, so the head is not drawn then. */
    hideHead: () => player.mode === 'third' && look > .62,
    /** How much narrower the field of view is while looking into the pack (a share of it): main.js applies it with the zoom. */
    fovCut: () => look * (player.mode === 'third' ? .1 : .22) + dive * .12,
    /** True from the first swing until the pack is away again: no walking, no fighting. */
    locked: () => phase !== 'idle',
    /** Arm and head pose for the third-person animator (characters/animator.js 'pack'), or null. */
    pose: () => phase === 'idle' || player.mode !== 'third' ? null : { reach: ease.inOut(clamp01(world.move * 1.1)), open: world.open, look },
    /** First-person hands: how far the pack is up, how open it is, how far the view has gone in. */
    fpPose: () => phase === 'idle' || player.mode !== 'first' ? null : { k: world.move, open: world.open, dive },
    /** Test hook: freezes the opening at `seconds` (null lets it run). */
    hold(seconds) { holdAt = seconds; },
    /** Test hook: forces the first-person pack's turn (null lets the animation turn it). */
    tilt(x, y) { tilt = x === null ? null : { x, y }; },
    reset() { phase = 'idle'; t = 0; look = dive = 0; onReady = onDone = null; if (pack) pack.root.visible = false; if (fpPack) fpPack.root.visible = false; },
  };
}
