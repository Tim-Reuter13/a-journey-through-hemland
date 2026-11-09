import * as THREE from 'three';

// The wanderer as a little figure in the inventory, wearing what is equipped: a second character of the same
// modular kind (made and dressed by main.js), idling and breathing, turned by dragging, rendered in its own
// small renderer at a third of the size and shown pixelated, like the world.
export function createPaperDoll(container, { make, dress, animator }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false }); }
  catch { return { update() {}, refresh() {}, nudge() {} }; }
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = 'doll-canvas'; renderer.domElement.setAttribute('aria-label', 'Dein Charakter mit seiner Ausrüstung');
  container.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(24, 1, .1, 40);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x40362c, 2.3));
  const key = new THREE.DirectionalLight(0xffe6c0, 2.6); key.position.set(-2.5, 4, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.6); rim.position.set(2.5, 2.5, -3); scene.add(rim);
  let model = null, anim = null, yaw = .38, spin = 0, drag = null, last = null, height = 2.4, pulse = 0;
  function ensure() {
    if (model) return true;
    model = make(); if (!model) return false;
    model.position.set(0, 0, 0); model.rotation.y = yaw; scene.add(model);
    anim = animator?.(model) ?? null;
    // The figure stands about as tall as the wanderer's eye is high (main.js: eye at 2.3), a little more for the hair.
    height = 2.45 * (model.scale?.y || 1);
    return true;
  }
  /** Puts on what the wanderer now wears; a little turn shows it off. */
  function refresh(show = false) { if (!ensure()) return; dress(model); if (show) { spin = .9; pulse = 1; } }
  const down = e => { drag = e.clientX; container.setPointerCapture?.(e.pointerId); };
  const move = e => { if (drag !== null) { yaw += (e.clientX - drag) * .014; drag = e.clientX; } };
  const up = () => { drag = null; };
  container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', up); container.addEventListener('pointercancel', up);
  function update(time) {
    const dt = last === null ? 0 : Math.min(.1, Math.max(0, (time - last) / 1000)); last = time;
    if (!ensure()) return;
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    const rw = Math.max(1, Math.round(w / 3)), rh = Math.max(1, Math.round(h / 3));
    if (renderer.domElement.width !== rw || renderer.domElement.height !== rh) { renderer.setSize(rw, rh, false); camera.aspect = rw / rh; }
    // Frame the whole figure, a little room above the head and under the feet.
    const fit = height * .62 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), dist = Math.max(fit, fit / Math.min(1, camera.aspect * 1.9));
    camera.position.set(0, height * .55, dist); camera.lookAt(0, height * .49, 0); camera.updateProjectionMatrix();
    if (spin > 0) { spin = Math.max(0, spin - dt); yaw += dt * 7 * Math.sin(spin / .9 * Math.PI); }
    if (drag === null && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) yaw += Math.sin(time / 2600) * dt * .12;
    model.rotation.y = yaw;
    pulse = Math.max(0, pulse - dt * 1.6); model.scale.setScalar(1 + Math.sin(pulse * Math.PI) * .04);
    anim?.update(dt || .016, {});
    renderer.render(scene, camera);
  }
  return { update, refresh, nudge: () => { spin = .9; } };
}
