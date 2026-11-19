import * as THREE from 'three';
import { createCharacter, equipItem } from '../characters/models.js';
import { wind } from '../world/trees.js';
import { buildStage, SUN_DIR, HAZE, FIRE } from './stage.js';
import { createFx } from './fx.js';
import { frameCamera } from './shots.js';
import { createScore } from './score.js';
import './film.css';

// "Die letzte Wacht" – a two-minute live cutscene (main menu → Animationstest). The motion is real
// motion capture: videos generated with Wan 2.2, solved with RGB MoCap (GEM-X), retargeted in Blender
// onto Hemland's Blockbench rigs and baked to public/cutscenes/letzte_wacht.{json,bin}. Set, light,
// camera, effects and sound run here in the engine, every frame a pure function of the film clock.
const FILM_ASPECT = 2.39;
const LINES = 420;   // the film's pixel resolution (lines in the picture), like the game's retro pass

const postShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D tScene; uniform vec2 uSize, uSun; uniform mat4 uInvProj, uCamWorld;
    uniform vec3 uSunDir, uSunColor, uHaze, uZenith; uniform float uSunVis, uAspect, uTime, uFade, uExposure, uRays;
    varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
    float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    vec3 skyAt(vec3 dir){
      vec3 sky = mix(uHaze, uZenith, smoothstep(-.03, .5, dir.y));
      float sd = max(dot(dir, uSunDir), 0.);
      return sky + uSunColor * (pow(sd, 1400.) * 40. + pow(sd, 60.) * 1.1 + pow(sd, 7.) * .3);
    }
    void main(){
      vec2 pixel = floor(vUv * uSize), uv = (pixel + .5) / uSize;
      vec4 s = texture2D(tScene, uv);
      vec4 vp = uInvProj * vec4(uv * 2. - 1., 1., 1.);
      vec3 dir = normalize((uCamWorld * vec4(vp.xyz / vp.w, 0.)).xyz);
      vec3 col = mix(skyAt(dir), s.rgb, s.a);
      // Light shafts: open sky near the sun smeared towards each pixel, cut by trunks, crowns and stones.
      if (uSunVis > .01) {
        vec2 delta = (uv - uSun) / 36., c = uv; vec3 rays = vec3(0.); float decay = 1.;
        c -= delta * fract(52.9829189 * fract(dot(pixel, vec2(.06711056, .00583715))));
        for (int i = 0; i < 36; i++) {
          c -= delta;
          float open = 1. - texture2D(tScene, clamp(c, 0., 1.)).a;
          vec2 dd = (c - uSun) * vec2(uAspect, 1.);
          rays += open * exp(-length(dd) * 2.6) * decay; decay *= .955;
        }
        col += rays * uSunColor * .055 * uSunVis * uRays;
      }
      col = aces(col * uExposure);
      // Grade: muted earth tones, amber light, cool green-grey shadows, firm contrast (never neon).
      float l = dot(col, vec3(.299, .587, .114));
      col = mix(vec3(l), col, .8);
      col *= mix(vec3(.86, .94, .95), vec3(1.07, 1., .88), smoothstep(.1, .7, l));
      col = (col - .5) * 1.1 + .5;
      vec2 vg = uv - .5; vg.x *= uAspect * .55;
      col *= 1. - smoothstep(.3, .95, length(vg)) * .45;
      col += (fract(sin(dot(pixel + floor(uTime * 24.) * 7.31, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .022;
      col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
      // 15-bit colour with ordered dithering: the game's own pixel look
      col = floor(clamp(col + (bayer4(pixel) - .5) / 31., 0., 1.) * 31. + .5) / 31.;
      gl_FragColor = vec4(col * uFade, 1.);
    }`,
};

export function createFilm({ renderer, onExit }) {
  let film = null, active = false;
  const base = import.meta.env.BASE_URL;
  const ui = document.createElement('div'); ui.id = 'film-ui'; ui.className = 'hidden';
  ui.innerHTML = `<div class="film-loading">Die Szene wird aufgebaut …</div>
    <div class="film-title"><div class="kicker">A Journey through Hemland</div><h2>Die letzte Wacht</h2><div class="line">Ein Animationstest</div></div>
    <div class="film-credits"><h2>Die letzte Wacht</h2><p><b>Bewegung</b> · Wan 2.2 TI2V 5B · RGB MoCap (GEM-X)</p><p><b>Figuren, Wald und Steine</b> · Hemland</p><p><b>Regie, Kamera, Licht und Ton</b> · Claude</p><p>Live in der Engine · ESC zurück zum Menü</p></div>
    <div class="film-skip">ESC · Überspringen &nbsp; Leertaste · Pause</div>`;
  document.body.append(ui);
  const $ = sel => ui.querySelector(sel);

  async function load() {
    const [header, bin] = await Promise.all([fetch(`${base}cutscenes/letzte_wacht.json`).then(r => r.json()), fetch(`${base}cutscenes/letzte_wacht.bin`).then(r => r.arrayBuffer())]);
    const stage = buildStage(base);
    const view = new DataView(bin), P = header.pivots.length, stride = 12 + 8 * P;
    const actors = {};
    for (const [key, a] of Object.entries(header.actors)) {
      const root = createCharacter(a.model);
      const weapon = equipItem(root, key === 'captain' ? 'sword_guard' : 'sword_rusty');
      const rig = root.userData.rig;
      rig.root.quaternion.set(0, 1, 0, 0);   // the bake faces the rigs like the mocap humanoid
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      stage.scene.add(root);
      actors[key] = { key, root, rig, weapon, grip: weapon?.parent, weaponLocal: weapon ? weapon.matrix.clone() : null, offset: a.offset, visible: a.visible };
    }
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const frameOf = t => { const x = Math.min(Math.max(t * header.hz, 0), header.frames - 1.001); const i = Math.floor(x); return [i, x - i]; };
    const q16 = (o, out) => out.set(view.getInt16(o, true) / 32767, view.getInt16(o + 2, true) / 32767, view.getInt16(o + 4, true) / 32767, view.getInt16(o + 6, true) / 32767).normalize();
    /** Hips in world space at film time t, straight from the data (for the camera). */
    function at(key, t, out = new THREE.Vector3()) {
      const a = actors[key], [i, f] = frameOf(t), o1 = a.offset + i * stride, o2 = o1 + stride;
      const x = view.getFloat32(o1, true) * (1 - f) + view.getFloat32(o2, true) * f, y = view.getFloat32(o1 + 4, true) * (1 - f) + view.getFloat32(o2 + 4, true) * f, z = view.getFloat32(o1 + 8, true) * (1 - f) + view.getFloat32(o2 + 8, true) * f;
      return out.set(-x, y, -z);   // the rig root is turned half round
    }
    function pose(a, t) {
      const [i, f] = frameOf(t), o1 = a.offset + i * stride, o2 = o1 + stride;
      a.rig.hips.position.set(view.getFloat32(o1, true) * (1 - f) + view.getFloat32(o2, true) * f, view.getFloat32(o1 + 4, true) * (1 - f) + view.getFloat32(o2 + 4, true) * f, view.getFloat32(o1 + 8, true) * (1 - f) + view.getFloat32(o2 + 8, true) * f);
      header.pivots.forEach((name, k) => { q16(o1 + 12 + k * 8, qa); q16(o2 + 12 + k * 8, qb); a.rig[name].quaternion.copy(qa).slerp(qb, f); });
      a.root.visible = a.visible.some(([s, e]) => t >= s && t < e);
    }
    const camera = new THREE.PerspectiveCamera(40, FILM_ASPECT, .1, 400);
    const fx = createFx(stage.scene, { fire: FIRE, events: header.events });
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    const uniforms = { tScene: { value: target.texture }, uSize: { value: new THREE.Vector2(4, 4) }, uSun: { value: new THREE.Vector2() }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uSunDir: { value: SUN_DIR.clone() }, uSunColor: { value: new THREE.Color(1, .7, .42) }, uHaze: { value: HAZE.clone() }, uZenith: { value: new THREE.Color(0x2e3846) }, uSunVis: { value: 0 }, uAspect: { value: FILM_ASPECT },
      uTime: { value: 0 }, uFade: { value: 0 }, uExposure: { value: 1.0 }, uRays: { value: 1 } };
    const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, ...postShader, depthTest: false, depthWrite: false }));
    post.frustumCulled = false;
    const postScene = new THREE.Scene(); postScene.add(post);
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // the bandit lets his sword fall when the blade goes in
    const drop = header.events.find(e => e.type === 'drop');
    const ban = actors.bandit;
    let dropFrom = null;
    if (drop && ban?.weapon) {
      pose(ban, drop.t); pose(actors.captain, drop.t); ban.root.updateMatrixWorld(true);
      dropFrom = ban.weapon.matrixWorld.clone();
    }
    // crows: three cross the sky at the start, one comes down onto a standing stone after the fight
    const crows = [0, 1, 2].map(i => { const c = createCharacter('crow', { scale: 1.6 }); c.traverse(o => { if (o.isMesh) o.castShadow = true; }); stage.scene.add(c); return c; });
    const perch = new THREE.Vector3(-1.6, 6, -5.35), ray = new THREE.Raycaster(new THREE.Vector3(-1.6, 30, -5.35), new THREE.Vector3(0, -1, 0));
    stage.circle.updateMatrixWorld(true);
    const hit = ray.intersectObject(stage.circle, true)[0]; if (hit) perch.copy(hit.point);
    // warm every shader up front, so the first cuts never stall
    renderer.setRenderTarget(target); renderer.compile(stage.scene, camera); renderer.setRenderTarget(null);
    return { header, stage, actors, at, pose, camera, fx, target, uniforms, postScene, postCamera, dropFrom, crows, perch, camAt: t => { frameCamera(camera, t, ctxFor(t)); return camera.position.clone(); } };
    function ctxFor() { return { at: (k, tt) => at(k, tt), events: header.events }; }
  }

  // --- the captain's cape hangs from his shoulders and trails behind when he moves
  const _q = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _down = new THREE.Vector3(), _want = new THREE.Vector3(), _v = new THREE.Vector3(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _swing = new THREE.Quaternion();
  function cape(a, t) {
    const rig = a.rig; if (!rig.cape_1 || !rig.chest) return;
    rig.cape_1.quaternion.identity(); rig.cape_2?.quaternion.identity(); rig.cape_3?.quaternion.identity();
    a.root.updateMatrixWorld(true);
    rig.chest.getWorldQuaternion(_qc);
    _down.set(0, -1, 0).applyQuaternion(_qc);
    film.at(a.key, t, _p1); film.at(a.key, t - .2, _p0); _v.subVectors(_p1, _p0).divideScalar(.2); _v.y = 0;
    const speed = Math.min(_v.length(), 3);
    _want.set(0, -1, 0).addScaledVector(_v, -.32);
    _want.x += Math.sin(t * 2.1) * .05 + Math.sin(t * 5.3) * .025; _want.z += Math.cos(t * 1.7) * .05;
    _want.normalize().lerp(_down, .22).normalize();
    _swing.setFromUnitVectors(_down, _want);
    // local = chest⁻¹ · swing · chest
    _q.copy(_qc).invert().multiply(_swing).multiply(_qc);
    rig.cape_1.quaternion.copy(_q);
    if (rig.cape_2) rig.cape_2.quaternion.setFromAxisAngle(_v.set(1, 0, 0), Math.sin(t * 3.1) * .05 + speed * .06);
    if (rig.cape_3) rig.cape_3.quaternion.setFromAxisAngle(_v.set(1, 0, 0), Math.sin(t * 3.7 + 1) * .07 + speed * .08);
  }

  const _m = new THREE.Matrix4(), _pos = new THREE.Vector3(), _rot = new THREE.Quaternion(), _scl = new THREE.Vector3(), _end = new THREE.Quaternion();
  function sword(t) {
    const a = film.actors.bandit; if (!a?.weapon || !film.dropFrom) return;
    const td = film.header.events.find(e => e.type === 'drop').t;
    if (t < td) {
      if (a.weapon.parent !== a.grip) { a.grip.add(a.weapon); a.weaponLocal.decompose(a.weapon.position, a.weapon.quaternion, a.weapon.scale); }
      return;
    }
    if (a.weapon.parent !== film.stage.scene) film.stage.scene.add(a.weapon);
    const k = Math.min(1, (t - td) / .42), fall = k * k;
    film.dropFrom.decompose(_pos, _rot, _scl);
    _end.setFromEuler(new THREE.Euler(Math.PI / 2, 0, .4));
    a.weapon.position.set(_pos.x + fall * .25, THREE.MathUtils.lerp(_pos.y, .06, fall), _pos.z + fall * .1);
    a.weapon.quaternion.copy(_rot).slerp(_end, fall); a.weapon.scale.copy(_scl);
    if (k >= 1 && t < td + .7) a.weapon.position.y = .06 + Math.abs(Math.sin((t - td - .42) * 22)) * .05 * (1 - (t - td - .42) / .28);
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
  function flyCrows(t) {
    film.crows.forEach((crow, i) => {
      const rig = crow.userData.rig, start = 1.2 + i * 1.7, k = (t - start) / 9;
      let flap = 1;
      if (k >= 0 && k <= 1) {
        _a.set(-6 + i * 2.5, 13 + i * 1.2, -24 - i * 2); _b.set(-1 + i * 2, 10 - i, 22 + i * 3);
        crow.position.lerpVectors(_a, _b, k); crow.position.y += Math.sin(k * Math.PI) * 2.5;
        _d.subVectors(_b, _a); crow.visible = true;
      } else if (i === 0 && t >= 79.2 && t < 112) {
        // glides down onto the stone and folds its wings
        const g = Math.min(1, (t - 79.2) / 2.6), e = 1 - (1 - g) ** 2;
        _a.set(9, 12, 6); crow.position.lerpVectors(_a, film.perch, e); _d.subVectors(film.perch, _a); _d.y = 0;
        flap = g < 1 ? 1 - g * .6 : 0; crow.visible = true;
      } else { crow.visible = false; return; }
      crow.rotation.y = Math.atan2(-_d.x, -_d.z);
      const w = flap > 0 ? Math.sin(t * 15 + i * 2) * .9 * flap : -.15;
      if (rig.wing_right) rig.wing_right.rotation.z = w;
      if (rig.wing_left) rig.wing_left.rotation.z = -w;
      if (flap === 0 && rig.head) rig.head.rotation.y = Math.sin(t * 1.3) * .5;
    });
  }
  let t = 0, paused = false, score = null, hint = 0;
  const _sun = new THREE.Vector3(), _view = new THREE.Vector3();
  function render(dt) {
    const { stage, camera, uniforms, target } = film;
    const canvas = renderer.domElement, W = canvas.width, H = canvas.height;
    let fw = W, fh = Math.round(W / FILM_ASPECT);
    if (fh > H) { fh = H; fw = Math.round(H * FILM_ASPECT); }
    const ox = Math.floor((W - fw) / 2), oy = Math.floor((H - fh) / 2), scale = Math.max(1, Math.round(fh / LINES));
    const tw = Math.max(1, Math.floor(fw / scale)), th = Math.max(1, Math.floor(fh / scale));
    if (target.width !== tw || target.height !== th) { target.setSize(tw, th); uniforms.uSize.value.set(tw, th); }
    camera.aspect = tw / th; camera.updateProjectionMatrix();
    for (const a of Object.values(film.actors)) film.pose(a, t);
    cape(film.actors.captain, t); sword(t); flyCrows(t);
    const shot = frameCamera(camera, t, { at: film.at, events: film.header.events });
    if (api.override) { camera.position.fromArray(api.override.pos); camera.fov = api.override.fov ?? 40; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3().fromArray(api.override.look)); }
    stage.fire.update(t); stage.fire.setLevel(t < 79 ? 1 : Math.max(.35, 1 - (t - 79) / 30));
    stage.fog.material.uniforms.uTime.value = t;
    film.fx.update(t, th / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    film.fx.embers.material.uniforms.uLevel.value = stage.fire.light.intensity / 36;
    wind.value = t * 1.3;
    // the light: dusk sinking further, the sun breaking through for the kneeling, gone at the end
    const late = THREE.MathUtils.smoothstep(t, 84, 98), gone = THREE.MathUtils.smoothstep(t, 110, 119);
    stage.sun.intensity = 3.1 * (1 + late * .35) * (1 - gone * .6);
    uniforms.uRays.value = 1 + late * .9;
    uniforms.uExposure.value = 1.3 - gone * .3;
    camera.updateMatrixWorld();
    _sun.copy(camera.position).addScaledVector(SUN_DIR, 300).project(camera);
    camera.getWorldDirection(_view);
    const off = Math.hypot(_sun.x * camera.aspect, _sun.y);
    uniforms.uSun.value.set(_sun.x * .5 + .5, _sun.y * .5 + .5);
    uniforms.uSunVis.value = _view.dot(SUN_DIR) > 0 ? THREE.MathUtils.smoothstep(-off, -2.8, -.5) : 0;
    uniforms.uInvProj.value.copy(camera.projectionMatrixInverse); uniforms.uCamWorld.value.copy(camera.matrixWorld);
    uniforms.uTime.value = t;
    // fades: in from black, a dip on the cut after the kill, out to black for the credits
    let fade = THREE.MathUtils.smoothstep(t, 0, 2.5) * (1 - THREE.MathUtils.smoothstep(t, 115.5, 118.5));
    const cut = Math.abs(t - 71); if (cut < .35) fade *= cut / .35;
    uniforms.uFade.value = fade;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    renderer.render(stage.scene, camera);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W / renderer.getPixelRatio(), H / renderer.getPixelRatio());
    renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    const pr = renderer.getPixelRatio();
    renderer.setViewport(ox / pr, oy / pr, fw / pr, fh / pr);
    renderer.render(film.postScene, film.postCamera);
    renderer.setViewport(0, 0, W / pr, H / pr);
    // titles
    $('.film-title').style.opacity = String(THREE.MathUtils.smoothstep(t, 2.6, 4.2) * (1 - THREE.MathUtils.smoothstep(t, 8.2, 10)));
    $('.film-credits').style.opacity = String(THREE.MathUtils.smoothstep(t, 117.5, 119) * (1 - THREE.MathUtils.smoothstep(t, 127, 129)));
    hint = Math.max(0, hint - dt); $('.film-skip').classList.toggle('on', hint > 0);
    score?.update(t, camera.position);
    return shot;
  }

  function onKey(e) {
    if (!active) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stop(); }
    else if (e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); paused = !paused; hint = 3; }
    else { hint = 3; }
  }
  function onMove() { hint = 2.5; }

  async function start(from = 0) {
    if (active) return;
    active = true; t = from; paused = false; hint = 4;
    ui.classList.remove('hidden'); $('.film-loading').style.display = '';
    window.addEventListener('keydown', onKey, true); window.addEventListener('pointermove', onMove);
    try {
      film ??= await load();
    } catch (error) {
      console.error('Film could not be loaded', error); $('.film-loading').textContent = 'Die Szene konnte nicht geladen werden.'; setTimeout(stop, 2500); return;
    }
    if (!active) return;
    $('.film-loading').style.display = 'none';
    try { score = createScore({ events: film.header.events, camAt: film.camAt, fire: FIRE.clone() }); score.start(t); } catch (error) { console.warn('Film sound unavailable', error); score = null; }
  }
  function stop() {
    if (!active) return;
    active = false; ui.classList.add('hidden');
    window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointermove', onMove);
    score?.stop(); score = null;
    const pr = renderer.getPixelRatio(); renderer.setRenderTarget(null); renderer.setViewport(0, 0, renderer.domElement.width / pr, renderer.domElement.height / pr);
    onExit?.();
  }

  const api = {
    override: null,
    get active() { return active; },
    start, stop,
    /** Called by the game loop instead of the game while the film runs. */
    frame(dt) {
      if (!film) { renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear(); return; }
      if (!paused) t += dt;
      if (t >= film.header.duration + 10) { stop(); return; }
      render(dt);
    },
    // test hooks: jump, freeze, read the clock
    seek(time) { t = time; if (score) { score.stop(); score = createScore({ events: film.header.events, camAt: film.camAt, fire: FIRE.clone() }); score.start(t); } },
    pause(on = true) { paused = on; },
    time: () => t,
    audio: () => score?.state ?? 'none',
    debug: () => film && ({ cam: film.camera.position.toArray().map(v => +v.toFixed(2)), captain: film.at('captain', t).toArray().map(v => +v.toFixed(2)), bandit: film.at('bandit', t).toArray().map(v => +v.toFixed(2)),
      capHead: film.actors.captain.rig.head.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)), banHead: film.actors.bandit.rig.head.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)),
      capHand: film.actors.captain.rig.hand_right.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)), banHand: film.actors.bandit.rig.hand_right.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) }),
  };
  window.__FILM__ = api;
  return api;
}
