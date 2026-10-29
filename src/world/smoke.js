import * as THREE from 'three';

// Chimney smoke. Sites mark a chimney's mouth with chimneyMarker(); world.js gathers the marks once
// and this draws every puff of every chimney in one instanced mesh. Puffs are computed in the vertex
// shader from time alone (rise, grow, drift downwind, fade), so the CPU only advances a clock. Not
// every hearth burns: about two in three chimneys smoke, each at its own pace.
const PUFFS = 6;

/** Marks the mouth of a chimney at (x, y, z) in `parent`'s space. */
export function chimneyMarker(parent, x, y, z) {
  const mark = new THREE.Object3D();
  mark.position.set(x, y, z); mark.userData.chimney = true; mark.name = 'Chimney mouth';
  parent.add(mark);
  return mark;
}

function puffTexture() {
  // A 16-texel puff: a lumpy round cloud, lighter to the upper left, ragged at the rim.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(16, 16);
  const lumps = [[8, 9, 5.2], [5.5, 7, 3.4], [10.5, 6.5, 3.6], [7.5, 4.5, 3]];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const inside = Math.max(...lumps.map(([cx, cy, r]) => 1 - Math.hypot(x + .5 - cx, y + .5 - cy) / r));
    const i = (y * 16 + x) * 4, hash = ((x * 73 + y * 151) % 17) / 17;
    if (inside <= 0 || (inside < .18 && hash < .5)) continue;
    const shade = 200 + Math.round((1 - (x + y) / 30) * 40) - (hash < .2 ? 14 : 0);
    image.data[i] = image.data[i + 1] = shade; image.data[i + 2] = shade + 6;
    image.data[i + 3] = Math.round(Math.min(1, inside * 2.2) * 255);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createChimneySmoke(scene, points, random = Math.random) {
  const lit = points.filter(() => random() < .68);
  if (!lit.length || typeof document === 'undefined') return { update() {}, count: 0 };
  const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index; geometry.setAttribute('position', quad.attributes.position); geometry.setAttribute('uv', quad.attributes.uv);
  const base = new Float32Array(lit.length * PUFFS * 3), seed = new Float32Array(lit.length * PUFFS * 2);
  lit.forEach((p, c) => {
    const rate = .07 + random() * .05, offset = random();
    for (let k = 0; k < PUFFS; k++) {
      const i = c * PUFFS + k;
      base.set([p.x, p.y, p.z], i * 3);
      seed.set([offset + k / PUFFS, rate], i * 2);
    }
  });
  geometry.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 2));
  geometry.instanceCount = lit.length * PUFFS;
  const uniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(.8, .35) } };
  const material = new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: .62, fog: true });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uTime;\nuniform vec2 uWind;\nattribute vec3 aBase;\nattribute vec2 aSeed;\nvarying float vFade;\n' + shader.vertexShader.replace('#include <project_vertex>', [
      'float age = fract(uTime * aSeed.y + aSeed.x);',
      '// Rises and slows, bends downwind, wobbles, swells as it thins.',
      'vec3 p = aBase + vec3(uWind.x, 0., uWind.y) * age * age * 3.2;',
      'p.y += sqrt(age) * 4.2;',
      'p.xz += vec2(sin(uTime * .9 + aSeed.x * 31.), cos(uTime * .7 + aSeed.x * 17.)) * .25 * age;',
      'vec4 mvPosition = viewMatrix * vec4(p, 1.);',
      'mvPosition.xy += position.xy * (.55 + age * 1.9);',
      'gl_Position = projectionMatrix * mvPosition;',
      'vFade = smoothstep(0., .1, age) * (1. - age) * (1. - age);'].join('\n'));
    shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vFade;');
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'Chimney smoke';
  scene.add(mesh);
  const night = new THREE.Color(0x3a4048), day = new THREE.Color(0xb4b4b0);
  return {
    count: lit.length,
    /** daylight 0..1 greys the smoke toward night. */
    update(dt, daylight) {
      uniforms.uTime.value += dt;
      material.color.copy(night).lerp(day, daylight);
      // The wind swings slowly round.
      const a = .4 + Math.sin(uniforms.uTime.value * .02) * .6;
      uniforms.uWind.value.set(Math.cos(a), Math.sin(a));
    },
  };
}
