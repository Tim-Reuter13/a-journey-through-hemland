import * as THREE from 'three';

// Particle effects of the film. Every particle is a pure function of the film clock (spawn time, seed),
// so the film can be scrubbed and every frame looks the same each showing. Square points: at the film's
// pixel resolution they read as single pixels or small blocks, like the rest of Hemland.
const vertex = `
  attribute vec4 aSeed; attribute vec4 aSpawn; uniform float uTime, uScale; uniform vec3 uGravity;
  varying vec4 vColor;
  #include <fog_pars_vertex>
  float r(float x){ return fract(sin(x * 91.3458) * 47453.5453); }
  vec3 rv(float s){ return vec3(r(s), r(s + 1.7), r(s + 3.1)); }
  KIND_FN
  void main(){
    vec3 pos; float size; vec4 col;
    particle(pos, size, col);
    vColor = col;
    vec4 mvPosition = viewMatrix * vec4(pos, 1.);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = col.a <= 0. ? 0. : clamp(size * uScale / -mvPosition.z, 1., 5.);
    #include <fog_vertex>
  }`;
const fragment = `varying vec4 vColor;
  #include <fog_pars_fragment>
  void main(){ if (vColor.a <= 0.) discard; gl_FragColor = vColor;
  #include <fog_fragment>
  }`;

function points(count, kind, { additive = false, fog = true, uniforms = {} } = {}) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 4), spawn = new Float32Array(count * 4);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aSpawn', new THREE.BufferAttribute(spawn, 4));
  const m = new THREE.ShaderMaterial({
    vertexShader: vertex.replace('KIND_FN', kind), fragmentShader: fragment, fog,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uScale: { value: 300 }, uGravity: { value: new THREE.Vector3(0, -9.8, 0) }, ...uniforms }]),
    transparent: true, depthWrite: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = additive ? 3 : 1;
  return { points: p, seed, spawn, material: m };
}

// --- embers rising from the fire, endless
const EMBER = `uniform vec3 uFire; uniform float uLevel;
  void particle(out vec3 pos, out float size, out vec4 col){
    float P = 2.2 + aSeed.x * 2.6, age = mod(uTime + aSeed.y * P, P), k = age / P;
    vec3 s = rv(aSeed.z * 10.);
    pos = uFire + vec3((s.x - .5) * .5, .3, (s.z - .5) * .5);
    pos.y += age * (.75 + s.y * .6) - age * age * .04;
    pos.x += sin(age * 2.3 + s.x * 9.) * .25 * age + age * .22; pos.z += cos(age * 1.9 + s.z * 7.) * .2 * age - age * .05;
    size = (.012 + s.y * .012) * (1. - k * .5);
    float blink = .6 + .4 * sin(uTime * 17. + s.x * 40.);
    col = vec4(mix(vec3(2.4, 1.1, .35), vec3(1.3, .28, .06), k) * blink, (1. - smoothstep(.55, 1., k)) * uLevel);
  }`;

// --- sparks at sword clashes: hot, fast, falling, short-lived
const SPARK = `void particle(out vec3 pos, out float size, out vec4 col){
    float age = uTime - aSpawn.w, life = .25 + aSeed.x * .55;
    if (age < 0. || age > life) { pos = vec3(0.); size = 0.; col = vec4(0.); return; }
    vec3 d = normalize(rv(aSeed.z * 13.) - .5 + vec3(0., .25, 0.)), v = d * (2.5 + aSeed.y * 6.5);
    pos = aSpawn.xyz + v * age + .5 * uGravity * age * age * .7;
    float k = age / life;
    size = .014 + aSeed.y * .016;
    col = vec4(mix(vec3(3.6, 3., 1.8), vec3(2.2, .7, .12), k), 1. - k * k);
  }`;

// --- blood: dark drops that fall and stay on the ground
const BLOOD = `void particle(out vec3 pos, out float size, out vec4 col){
    float age = uTime - aSpawn.w;
    if (age < 0.) { pos = vec3(0.); size = 0.; col = vec4(0.); return; }
    vec3 s = rv(aSeed.z * 17.);
    vec3 v = vec3((s.x - .5) * 2.4, .6 + s.y * 2.4, (s.z - .5) * 2.4) + aSeed.xyw * vec3(1.);
    float g = 9.8, y0 = aSpawn.y - .02;
    float land = (v.y + sqrt(v.y * v.y + 2. * g * y0)) / g, t = min(age, land);
    pos = vec3(aSpawn.x + v.x * t, aSpawn.y + v.y * t - .5 * g * t * t, aSpawn.z + v.z * t);
    pos.y = max(pos.y, .02);
    size = age < land ? .022 + s.y * .02 : .035 + s.y * .03;
    col = vec4(vec3(.32, .03, .03) * (age < land ? 1. : .7), 1.);
  }`;

// --- leaves drifting down over the clearing, and ash at the end
const LEAF = `uniform float uFrom, uAmount; uniform vec3 uTint;
  void particle(out vec3 pos, out float size, out vec4 col){
    float P = 9. + aSeed.x * 7., age = mod(uTime + aSeed.y * P, P), k = age / P;
    vec3 s = rv(aSeed.z * 23.);
    float r = 2. + s.x * 13., a = s.y * 6.2831;
    pos = vec3(cos(a) * r, 11. - age * (1.1 + s.z * .4), sin(a) * r);
    pos.x += sin(age * 1.4 + s.z * 6.) * .9 + age * .35; pos.z += cos(age * 1.1 + s.x * 5.) * .7;
    pos.y = max(pos.y, .03);
    size = .045 + s.z * .035;
    vec3 c = mix(uTint, uTint * vec3(1.2, .8, .6), s.x);
    float on = step(uFrom, uTime) * smoothstep(0., 1.5, uTime - uFrom) * uAmount;
    col = vec4(c, on * (1. - smoothstep(.9, 1., k)));
  }`;

// --- motes hanging in the low light
const MOTE = `void particle(out vec3 pos, out float size, out vec4 col){
    vec3 s = rv(aSeed.z * 31.);
    pos = vec3((s.x - .5) * 26., .3 + s.y * 4.5, (s.z - .5) * 26.);
    pos += vec3(sin(uTime * .21 + s.y * 9.), sin(uTime * .17 + s.x * 7.) * .5, cos(uTime * .19 + s.z * 8.)) * .6;
    size = .006 + aSeed.x * .008;
    col = vec4(vec3(1.1, .9, .62) * (.5 + .5 * sin(uTime * 1.3 + s.x * 30.)), .4);
  }`;

export function createFx(scene, { fire, events }) {
  const rand = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const fill = (fx, fn) => { const n = fx.seed.length / 4; for (let i = 0; i < n; i++) fn(i, fx.seed, fx.spawn); };
  const embers = points(260, EMBER, { additive: true, uniforms: { uFire: { value: fire.clone() }, uLevel: { value: 1 } } });
  fill(embers, (i, s) => s.set([rand(), rand(), rand(), rand()], i * 4));
  const clashes = events.filter(e => e.type === 'clash');
  const sparks = points(Math.max(1, clashes.length) * 90, SPARK, { additive: true });
  fill(sparks, (i, s, sp) => { const e = clashes[Math.floor(i / 90)]; s.set([rand(), rand(), rand(), rand()], i * 4); if (e) sp.set([e.pos[0], e.pos[1] + .35, e.pos[2], e.t], i * 4); else sp.set([0, -99, 0, 1e9], i * 4); });
  const wounds = events.filter(e => e.type === 'hit' || e.type === 'kill');
  const per = 70;
  const blood = points(Math.max(1, wounds.length) * per, BLOOD);
  fill(blood, (i, s, sp) => {
    const e = wounds[Math.floor(i / per)];
    // the spray leaves the wound away from the blade: towards the side the victim is pushed
    const dir = e?.who === 'bandit' ? 1 : -1;
    s.set([dir * (.5 + rand() * 1.4), rand() * .8, rand(), (rand() - .5) * .6], i * 4);
    if (e) sp.set([e.pos[0], e.pos[1] - .2, e.pos[2], e.t + rand() * .08], i * 4); else sp.set([0, -99, 0, 1e9], i * 4);
  });
  const leaves = points(150, LEAF, { uniforms: { uFrom: { value: 0 }, uAmount: { value: 1 }, uTint: { value: new THREE.Color(.42, .27, .1) } } });
  fill(leaves, (i, s) => s.set([rand(), rand(), rand(), rand()], i * 4));
  const ash = points(220, LEAF, { uniforms: { uFrom: { value: 84 }, uAmount: { value: .9 }, uTint: { value: new THREE.Color(.55, .53, .5) } } });
  fill(ash, (i, s) => s.set([rand(), rand(), rand(), rand()], i * 4));
  const motes = points(380, MOTE, { additive: true });
  fill(motes, (i, s) => s.set([rand(), rand(), rand(), rand()], i * 4));
  const all = [embers, sparks, blood, leaves, ash, motes];
  for (const fx of all) { fx.points.geometry.attributes.aSeed.needsUpdate = fx.points.geometry.attributes.aSpawn.needsUpdate = true; scene.add(fx.points); }
  return {
    embers,
    update(t, scale) { for (const fx of all) { fx.material.uniforms.uTime.value = t; fx.material.uniforms.uScale.value = scale; } },
    dispose() { for (const fx of all) { fx.points.geometry.dispose(); fx.material.dispose(); fx.points.removeFromParent(); } },
  };
}
