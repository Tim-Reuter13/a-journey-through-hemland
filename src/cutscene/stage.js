import * as THREE from 'three';
import { placeTree } from '../world/trees.js';
import { propClone, placePlant } from '../world/props.js';

// The set of "Die letzte Wacht": a stone circle in a misty spruce forest at dusk. Built once per showing,
// out of the game's own Blockbench trees, plants and points of interest. Axes as in the game: y up, the
// captain comes from the west (-x) along a worn path, the bandit's camp lies on the circle's north side (-z).
export const FIRE = new THREE.Vector3(3.0, 0, 0.8);
// The circle's wide gap faces west, to the path and the low sun; the altar stands in the middle.
export const CIRCLE = { scale: 1.35, rotation: -1.01 };
export const SUN_DIR = new THREE.Vector3(-0.93, 0.25, -0.3).normalize(); // towards the low sun, west-north-west
const SUN_AZ = Math.atan2(SUN_DIR.z, SUN_DIR.x);
export const HAZE = new THREE.Color(0x8b8073);   // fog = horizon colour, warm grey-amber
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.1, y * 2.1) * .28 + vnoise(x * 4.3, y * 4.3) * .17;
export const pathZ = x => .2 * Math.sin(x * .08) * 6 * .2;

/** 1 where the ground stays flat: the circle, the camp, the path from the west. */
function flat(x, z) {
  let w = 1 - smooth(10, 16, Math.hypot(x, z));
  if (x < 0) w = Math.max(w, 1 - smooth(1.8, 4.8, Math.abs(z - pathZ(x))));
  return w;
}
export function heightAt(x, z) {
  return ((fbm(x * .035 + 10, z * .035 + 3) - .5) * 5.5 + (vnoise(x * .11, z * .11) - .5) * .7) * (1 - flat(x, z)) - .02;
}
function wearAt(x, z) {
  let w = .8 * (1 - smooth(3.2, 6.8, Math.hypot(x, z)));
  if (x < -4) w = Math.max(w, .65 * (1 - smooth(.5, 1.9, Math.abs(z - pathZ(x)))));
  w = Math.max(w, .9 * (1 - smooth(.4, 1.6, Math.hypot(x - FIRE.x, z - FIRE.z))));
  return w * (.7 + .3 * vnoise(x * .6, z * .6));
}

function groundTexture(base, name) {
  const t = new THREE.TextureLoader().load(`${base}textures/ground/${name}.png`);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ground(base) {
  const size = 180, seg = 180;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, wear = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z)); wear[i] = wearAt(x, z);
  }
  g.setAttribute('wear', new THREE.BufferAttribute(wear, 1));
  g.computeVertexNormals();
  const tex = { needles: groundTexture(base, 'pine_needles'), meadow: groundTexture(base, 'clover_meadow'), dirt: groundTexture(base, 'peat'), moss: groundTexture(base, 'moss_rock') };
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { tNeedles: { value: tex.needles }, tMeadow: { value: tex.meadow }, tDirt: { value: tex.dirt }, tMoss: { value: tex.moss } });
    shader.vertexShader = 'attribute float wear;\nvarying float vWear;\nvarying vec3 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWear = wear; vGround = (modelMatrix * vec4(position, 1.)).xyz;');
    shader.fragmentShader = `uniform sampler2D tNeedles, tMeadow, tDirt, tMoss; varying float vWear; varying vec3 vGround;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
      ` + shader.fragmentShader.replace('#include <map_fragment>', `
      // One 16 px tile per unit (the game's texel density); broad change only from world-space noise.
      vec2 uv = vGround.xz;
      float n1 = gn(vGround.xz * .045) * .65 + gn(vGround.xz * .13) * .35;
      vec3 c = mix(texture2D(tNeedles, uv).rgb, texture2D(tMeadow, uv).rgb, smoothstep(.42, .62, n1));
      c = mix(c, texture2D(tMoss, uv).rgb, smoothstep(.62, .78, gn(vGround.xz * .07 + 9.)) * .55);
      c = mix(c, texture2D(tDirt, uv).rgb, clamp(vWear, 0., 1.));
      c *= mix(.62, 1.02, gn(vGround.xz * .21 + 3.));
      diffuseColor.rgb *= c;`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'film:ground';
  return mesh;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function forest(group) {
  const random = rng(7);
  const kinds = [['spruce_1', 14], ['spruce_2', 14], ['spruce_3', 10], ['pine_1', 8], ['pine_2', 8], ['pine_3', 6], ['oak_1', 5], ['oak_2', 5],
    ['oak_4', 3], ['oak_5', 3], ['dead_1', 5], ['dead_2', 4], ['birch_1', 4], ['birch_3', 3], ['autumn_1', 2], ['charred_1', 2]];
  const pool = kinds.flatMap(([k, w]) => Array(w).fill(k));
  const placed = [];
  for (let tries = 0; placed.length < 430 && tries < 20000; tries++) {
    const r = 13.5 + random() ** .8 * 64, a = random() * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
    if (flat(x, z) > .3) continue;
    // a gap in the forest towards the sun: the evening light falls through it into the circle
    const off = Math.abs(Math.atan2(Math.sin(a - SUN_AZ), Math.cos(a - SUN_AZ)));
    if (r < 48 && off < .3 + (r < 22 ? .12 : 0)) continue;
    if (r < 48 && off < .5 && random() < .6) continue;
    const gap = r < 30 ? 3.2 : 3.9;
    if (placed.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < gap * gap)) continue;
    placed.push([x, z]);
    placeTree(group, pool[Math.floor(random() * pool.length)], x, heightAt(x, z), z, .85 + random() * .45, random, { solid: false });
  }
  const plants = ['fern_big_1', 'fern_big_2', 'fern_big_1', 'heather_1', 'heather_2', 'dry_shrub_1', 'mushroom_brown_1', 'mushroom_red_1', 'fern_big_2', 'pampas_1'];
  for (let i = 0; i < 520; i++) {
    const r = 8.6 + random() * 46, a = random() * Math.PI * 2, x = r * Math.cos(a), z = r * Math.sin(a);
    if (Math.hypot(x, z) < 8.5 || (x < -5 && Math.abs(z - pathZ(x)) < 2.1)) continue;
    placePlant(group, plants[Math.floor(random() * plants.length)], x, heightAt(x, z), z, .7 + random() * .5, random, heightAt);
  }
}

function prop(group, name, x, z, ry, s = 1) {
  const p = propClone(name, { solid: false });
  if (!p) return null;
  p.position.set(x, heightAt(x, z), z); p.rotation.y = ry; p.scale.setScalar(s);
  p.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  group.add(p);
  return p;
}

// Pixel flames: emissive boxes that rise and shrink on a loop; their light flickers with them.
function campfire(group) {
  const fire = new THREE.Group(); fire.position.copy(FIRE); group.add(fire);
  const wood = new THREE.MeshLambertMaterial({ color: 0x2a1a10 }), ash = new THREE.MeshLambertMaterial({ color: 0x1b1916 });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, log = new THREE.Mesh(new THREE.BoxGeometry(.9, .16, .16), wood);
    log.position.set(Math.cos(a) * .22, .14, Math.sin(a) * .22); log.rotation.set(0, -a, .38); log.castShadow = true; fire.add(log);
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, stone = new THREE.Mesh(new THREE.BoxGeometry(.28, .2, .28), ash);
    stone.position.set(Math.cos(a) * .72, .08, Math.sin(a) * .72); stone.rotation.y = a * 1.7; stone.receiveShadow = true; fire.add(stone);
  }
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, .78, .38).multiplyScalar(2.2), fog: false }),
    warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, .42, .1).multiplyScalar(1.8), fog: false });
  const random = rng(3), flames = [];
  for (let i = 0; i < 12; i++) {
    const s = .1 + random() * .15, m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.6, s), i < 4 ? hot : warm);
    m.userData.flame = { s, x: (random() - .5) * .38, z: (random() - .5) * .38, period: .45 + random() * .5, phase: random() };
    fire.add(m); flames.push(m);
  }
  const light = new THREE.PointLight(0xff8a3d, 40, 18, 1.6); light.position.set(0, .8, 0); light.castShadow = true;
  light.shadow.mapSize.set(512, 512); light.shadow.bias = -.002; fire.add(light);
  let level = 1;
  return {
    light, flames,
    setLevel(v) { level = v; },
    update(t) {
      for (const m of flames) {
        const f = m.userData.flame, ph = ((t / f.period + f.phase) % 1), k = (1 - ph) * level;
        m.position.set(f.x + Math.sin(t * 7 + f.phase * 20) * .04, .22 + ph * (.5 + f.s) * level, f.z + Math.cos(t * 6 + f.phase * 13) * .04);
        m.scale.setScalar(Math.max(.001, k)); m.rotation.y = f.phase * 6 + t;
      }
      light.intensity = (34 + 12 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1) + 5 * Math.sin(t * 23.7)) * level;
    },
  };
}

// Ground mist: wide sheets of drifting noise, lit by the low sun, faded where they meet the ground and the camera.
function mist(group) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8d857b) }, uSun: { value: new THREE.Color(1, .72, .45) }, uSunDir: { value: SUN_DIR.clone() }, uAmount: { value: 1 } }]),
    vertexShader: `varying vec3 vW; varying float vH;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uAmount; uniform vec3 uColor, uSun, uSunDir; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 p = vW.xz * .085 + vec2(uTime * .018, uTime * .007) + vW.y * 1.7;
        float d = n(p) * .55 + n(p * 2.3 + 4.1) * .3 + n(p * 5.1 - uTime * .03) * .15;
        float a = smoothstep(.38, .82, d) * .11 * uAmount;
        a *= smoothstep(-.1, .5, vW.y - (.0));
        a *= smoothstep(1.5, 6., distance(vW, cameraPosition));
        vec3 view = normalize(vW - cameraPosition);
        float glow = pow(max(dot(view, uSunDir), 0.), 6.);
        gl_FragColor = vec4(mix(uColor, uSun * 1.25, glow * .65), a);
        #include <fog_fragment>
      }`,
  });
  const layers = [];
  for (const [y, s] of [[.25, 1], [.7, 1.2], [1.3, 1.4], [2.2, 1.7]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), material); m.rotation.x = -Math.PI / 2; m.position.y = y; m.scale.setScalar(s);
    m.renderOrder = 2; group.add(m); layers.push(m);
  }
  return { material, layers };
}

export function buildStage(base) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HAZE.clone(), .021);
  const group = new THREE.Group(); scene.add(group);
  group.add(ground(base));
  forest(group);
  const circle = prop(group, 'stone_circle', 0, 0, CIRCLE.rotation, CIRCLE.scale);
  prop(group, 'hollow_log', 9.5, -6.5, -.6, .8);
  prop(group, 'burned_hut', -24, -13, .35);
  prop(group, 'woodpile', 1.5, 3.9, .3);
  prop(group, 'sacks', 4.0, -1.6, -1.9);
  const fire = campfire(group);
  const fog = mist(group);
  const sun = new THREE.DirectionalLight(0xffb070, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(60); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  const sky = new THREE.HemisphereLight(0xb4c0cf, 0x5b4a39, 1.55); scene.add(sky);
  // cool bounce from the east, so faces turned from the sun are dark but never black
  const fill = new THREE.DirectionalLight(0x8ea2bf, .7); fill.position.set(40, 30, 25); scene.add(fill);
  return { scene, group, fire, fog, sun, sky, circle };
}
