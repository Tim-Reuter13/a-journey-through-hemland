import * as THREE from 'three';

// PS1-style output: the scene is rendered into a low-resolution target, then
// upscaled by an integer factor with nearest sampling and quantised to 15-bit
// colour with ordered dithering. The HTML interface stays at full resolution.
const KEY = 'ashen-realms-graphics-v2';
const profiles = {
  low: { label: 'Leistung', lines: 300, shadows: 1024 },
  medium: { label: 'Ausgewogen', lines: 400, shadows: 2048 },
  high: { label: 'Qualität', lines: 540, shadows: 2048 },
};

// The pixel filter can be switched off (settings): full resolution, no 15-bit quantising, no dither.
const postShader = {
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `uniform sampler2D tScene; uniform vec2 uSize; uniform float uDither, uQuant; varying vec2 vUv;
    uniform vec2 uSun; uniform float uSunOn, uAspect, uGrade, uTime; uniform vec3 uSunColor;
    float lum(vec3 c){ return dot(c, vec3(.3, .59, .11)); }
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
    float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
    void main(){
      vec2 pixel = floor(vUv * uSize);
      vec2 uv = (pixel + .5) / uSize;
      gl_FragColor = vec4(texture2D(tScene, uv).rgb, 1.);
      // Sunlight (own take on the "sunbathing" look): light shafts are bright sky near the sun smeared
      // toward each pixel along the line to the sun, so trees, roofs and cloud edges in front of it cast
      // rays; a soft glare round the sun; lens ghosts along the line through the centre of the screen,
      // dimmed when the sun is hidden. All at the game's pixel resolution.
      if (uSunOn > .01) {
        vec2 delta = (uv - uSun) / 28. * .92, c = uv;
        c -= delta * fract(52.9829189 * fract(dot(pixel, vec2(.06711056, .00583715))));
        vec3 rays = vec3(0.); float decay = 1.;
        for (int i = 0; i < 28; i++) {
          c -= delta;
          vec4 s = texture2D(tScene, c);
          vec2 dd = (c - uSun) * vec2(uAspect, 1.);
          // Only open sky (alpha 0) lets the light through: clouds, trees and roofs cut it into shafts.
          rays += (1. - s.a) * (.55 + .45 * smoothstep(.5, 1., lum(s.rgb))) * exp(-length(dd) * 3.6) * decay;
          decay *= .95;
        }
        float vis = 0.;
        for (int k = 0; k < 5; k++) { vec2 o = vec2(float(k == 1) - float(k == 2), float(k == 3) - float(k == 4)) * .006; vis += 1. - texture2D(tScene, uSun + o).a; }
        vis *= .2;
        vec2 toC = vec2(.5) - uSun, at = (uv - uSun) * vec2(uAspect, 1.);
        vec3 flare = uSunColor * exp(-length(at) * 9.) * .26 * vis;
        for (int g = 0; g < 4; g++) {
          float t = g == 0 ? .55 : g == 1 ? .9 : g == 2 ? 1.35 : 1.75, rad = g == 0 ? .035 : g == 1 ? .06 : g == 2 ? .025 : .09;
          vec2 q = (uv - (uSun + toC * t)) * vec2(uAspect, 1.);
          float d = max(abs(q.x) * .92 + abs(q.y) * .38, abs(q.y));   // octagon-ish, like an aperture
          // Soft-edged and faint: a hard-rimmed ghost read as a strange shape over the scene.
          float ghost = (1. - smoothstep(rad * .45, rad, d)) * .6;
          vec3 tint = g == 0 ? vec3(1., .75, .45) : g == 1 ? vec3(.55, 1., .7) : g == 2 ? vec3(1., .55, .8) : vec3(.55, .7, 1.);
          flare += tint * ghost * .018 * vis;
        }
        gl_FragColor.rgb += (rays * uSunColor * .03 + flare) * uSunOn;
      }
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(.299, .587, .114));
      if (uGrade < .5) {
        // Standard: richer colour and a touch of contrast, so meadows and roofs read warm and alive.
        c = mix(vec3(l), c, 1.2); c = (c - .5) * 1.05 + .5; c *= vec3(1.02, 1., .97);
      } else {
        // Dark fantasy: muted colour, heavy mid tones, cool grey-green shadows and a tired amber light,
        // crushed blacks, a deep vignette and a fine grain at pixel size.
        c = mix(vec3(l), c, .55);
        c = pow(max(c, 0.), vec3(1.12)) * .95;
        c *= mix(vec3(.8, .9, .87), vec3(1.07, 1., .84), smoothstep(.12, .72, l));
        c = (c - .5) * 1.14 + .5;
        c = max(c - .03, 0.) / .97;
        vec2 vg = uv - .5; vg.x *= uAspect * .8;
        c *= 1. - smoothstep(.32, 1.05, length(vg)) * .5;
        c += (fract(sin(dot(pixel + floor(uTime * 24.) * 7.31, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .028;
      }
      gl_FragColor.rgb = clamp(c, 0., 1.);
      float threshold = (bayer4(pixel) - .5) / 31. * uDither;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, floor(clamp(gl_FragColor.rgb + threshold, 0., 1.) * 31. + .5) / 31., uQuant);
    }`,
};

export function createGraphics(renderer, world) {
  let pixelFilter = true, quality = 'medium', debug = false, frameTime = 0, samples = 0, fps = 0, worst = 0, hitch = 0;
  try { const saved = localStorage.getItem(KEY); if (profiles[saved]) quality = saved; } catch { /* Storage can be unavailable. */ }
  const select = document.getElementById('graphics-quality');
  const output = document.getElementById('performance');
  const hint = document.getElementById('graphics-hint');
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  target.texture.name = 'Low resolution scene';
  const uniforms = { tScene: { value: target.texture }, uSize: { value: new THREE.Vector2(4, 4) }, uDither: { value: 1 }, uQuant: { value: 1 },
    uSun: { value: new THREE.Vector2(.5, .5) }, uSunOn: { value: 0 }, uGrade: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uSunColor: { value: new THREE.Color(1, .85, .6) } };
  const sunDir = new THREE.Vector3(), sunAt = new THREE.Vector3(), view = new THREE.Vector3();
  /** Where the sun stands on screen and how strongly its light should show. */
  function sunlight(camera) {
    const sun = world.sun; if (!sun) { uniforms.uSunOn.value = 0; return; }
    sunDir.copy(sun.position).sub(sun.target.position).normalize();
    camera.getWorldDirection(view);
    const facing = view.dot(sunDir);
    sunAt.copy(camera.position).addScaledVector(sunDir, 200).project(camera);
    uniforms.uSun.value.set(sunAt.x * .5 + .5, sunAt.y * .5 + .5);
    const off = Math.hypot(sunAt.x * camera.aspect, sunAt.y);
    uniforms.uSunOn.value = facing > 0 ? THREE.MathUtils.smoothstep(sunDir.y, -.03, .12) * Math.min(1, sun.intensity / 2.4) * THREE.MathUtils.smoothstep(-off, -2.6, -.6) : 0;
    uniforms.uAspect.value = camera.aspect;
    uniforms.uSunColor.value.copy(sun.color);
  }
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, ...postShader, depthTest: false, depthWrite: false }));
  post.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(post);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    // Integer upscale keeps every scene pixel the same size on screen.
    const { width, height } = renderer.domElement;
    const scale = pixelFilter ? Math.max(1, Math.round(height / profiles[quality].lines)) : 1;
    const w = Math.max(1, Math.floor(width / scale)), h = Math.max(1, Math.floor(height / scale));
    target.setSize(w, h); uniforms.uSize.value.set(w, h);
  }
  function apply(value) {
    if (!profiles[value]) return;
    quality = value;
    resize(); world.setQuality(value);
    const size = profiles[value].shadows;
    if (world.sun.shadow.mapSize.x !== size) {
      world.sun.shadow.mapSize.set(size, size);
      world.sun.shadow.map?.dispose(); world.sun.shadow.map = null;
    }
    world.sun.shadow.needsUpdate = true;
    select.value = value;
    hint.textContent = value === 'low' ? 'Gröbere Pixel und weniger Gräser für schwächere Geräte.' : value === 'high' ? 'Feinere Pixel und volle Vegetationsdichte.' : 'Klassischer Retro-Look bei ausgewogener Leistung.';
    try { localStorage.setItem(KEY, quality); } catch { /* Quality still works without persistence. */ }
  }
  /** Renders the world (and an optional overlay such as first-person hands) through the retro pass. */
  function render(scene, camera, overlay = null) {
    sunlight(camera); uniforms.uTime.value = performance.now() / 1000;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    overlay?.(renderer);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }
  /** Compiles every visible material for the low-resolution target (its programs differ from screen ones). */
  function compile(scene, camera) {
    renderer.setRenderTarget(target);
    renderer.compile(scene, camera);
    renderer.setRenderTarget(null);
  }
  select.addEventListener('change', () => apply(select.value));
  apply(quality);
  return {
    resize, apply, render, compile,
    setGrade(mode) { uniforms.uGrade.value = mode === 'dark' ? 1 : 0; },
    setPixelFilter(on) { pixelFilter = !!on; uniforms.uQuant.value = uniforms.uDither.value = on ? 1 : 0; target.texture.minFilter = target.texture.magFilter = on ? THREE.NearestFilter : THREE.LinearFilter; target.texture.needsUpdate = true; resize(); },
    state: () => ({ quality, pixelFilter, fps, hitch, pixelRatio: renderer.getPixelRatio(), resolution: uniforms.uSize.value.toArray() }),
    toggleDebug() { debug = !debug; output.classList.toggle('hidden', !debug); },
    setDebug(value) { debug = !!value; output.classList.toggle('hidden', !debug); },
    /** Extra lines for the F3 overlay (position, streaming); set by the game each frame. */
    info: null,
    update(dt) {
      if (dt <= 0 || dt > .5) return;
      frameTime += dt; samples++; worst = Math.max(worst, dt);
      if (frameTime < .75) return;
      fps = Math.round(samples / frameTime);
      if (debug) output.textContent = `${fps} FPS · ${renderer.info.render.calls} Zeichenaufrufe · ${uniforms.uSize.value.x}×${uniforms.uSize.value.y} · ${profiles[quality].label} · längster Frame ${Math.round(worst * 1000)} ms${this.info ? '\n' + this.info() : ''}`;
      hitch = worst; frameTime = 0; samples = 0; worst = 0;
    },
  };
}
