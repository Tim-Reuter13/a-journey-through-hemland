import * as THREE from 'three';
import { createClouds } from './clouds.js';

const smooth = THREE.MathUtils.smoothstep;
const color = hex => new THREE.Color(hex);

export function createAtmosphere(scene, sun, ambient) {
  const uniforms = {
    uTime: { value: 0 }, uDay: { value: 1 }, uDusk: { value: 0 }, uNight: { value: 0 },
    uSun: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() },
    uTop: { value: color(0x3a7cc4) }, uMid: { value: color(0x79acd8) }, uHorizon: { value: color(0xcfe3ef) },
    uCloudLit: { value: color(0xfbf6ec) }, uCloudShade: { value: color(0xaab6c6) },
  };
  // The sky, drawn at the game's low resolution so it pixelates with everything else: a three-stop
  // gradient, a square block sun with a halo and an evening band, a square moon opposite it, twinkling
  // stars and a faint milky way at night. No clouds are painted on it: the clouds are real (clouds.js).
  const sky = new THREE.Mesh(new THREE.SphereGeometry(290, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 uTop, uMid, uHorizon, uSun, uMoon; uniform float uTime, uDay, uDusk, uNight;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y); }
      float fbm(vec2 p) { return noise(p)*.55 + noise(p*2.03)*.27 + noise(p*4.07)*.13 + noise(p*8.13)*.05; }
      vec2 facing(vec3 d, vec3 c) { vec3 r=normalize(cross(c,vec3(0.,1.,.001))), u=cross(r,c); float k=max(dot(d,c),1e-4); return vec2(dot(d,r),dot(d,u))/k; }
      void main() {
        vec3 d=normalize(vDirection);
        float h=d.y;
        vec3 col=mix(mix(uHorizon,uMid,smoothstep(-.02,.24,h)),uTop,smoothstep(.2,.88,h));
        float sunDot=dot(d,uSun), sunUp=smoothstep(-.08,.04,uSun.y);
        col+=vec3(1.,.78,.5)*pow(max(sunDot,0.),9.)*.3*(uDay+uDusk);
        col+=vec3(1.,.42,.18)*uDusk*pow(max(sunDot,0.),2.5)*(1.-smoothstep(0.,.32,h))*.55;
        vec3 sc=floor(d*150.);
        vec2 sg=vec2(dot(sc,vec3(1.,57.,113.)),dot(sc,vec3(31.,7.,211.)));
        float sh=hash(sg), up=smoothstep(.02,.3,h);
        float star=step(.9962,sh)*up*uNight*(.6+.4*sin(uTime*(1.5+sh*4.)+sh*60.));
        col+=star*mix(vec3(.62,.72,1.),vec3(1.,.88,.72),hash(sg+7.))*(.55+.6*step(.9991,sh));
        float band=exp(-pow(dot(d,normalize(vec3(.35,.45,.82)))*3.2,2.));
        col+=vec3(.16,.18,.28)*band*fbm(d.xz*9.+d.y*5.)*uNight*up;
        if(sunDot>0.){ vec2 q=abs(facing(d,uSun)); float m=max(q.x,q.y);
          col=mix(col,col+vec3(1.,.86,.6)*.22,step(m,.075)*sunUp*(uDay+uDusk));
          col=mix(col,vec3(1.,.96,.84),step(m,.032)*sunUp); }
        float moonDot=dot(d,uMoon);
        if(moonDot>0.){ vec2 q=facing(d,uMoon); float m=max(abs(q.x),abs(q.y));
          vec2 px=floor(q/.008); float spot=step(.62,hash(px+vec2(3.,9.)));
          col=mix(col,col+vec3(.3,.36,.5)*.25,step(m,.06)*uNight);
          col=mix(col,mix(vec3(.84,.86,.9),vec3(.62,.64,.7),spot),step(m,.026)*uNight); }
        // Alpha 0 marks open sky for the post pass (light shafts shine only through it).
        gl_FragColor=vec4(col,0.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const clouds = createClouds(scene);
  sky.frustumCulled = false;
  sky.name = 'Living sky';
  scene.add(sky);
  scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x9bb9eb, 0);
  moon.position.set(45, 65, -35); scene.add(moon);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(32,32,0,32,32,32);
  glowGradient.addColorStop(0,'rgba(255,255,255,.7)');
  glowGradient.addColorStop(.22,'rgba(255,255,255,.2)');
  glowGradient.addColorStop(1,'rgba(255,255,255,0)');
  glowContext.fillStyle = glowGradient; glowContext.fillRect(0,0,64,64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  // Palettes for day, dusk and night: sky top, low sky, and the clouds' lit and shaded tones.
  const nightTop = color(0x070d22), dayTop = color(0x3a7cc4), duskTop = color(0x34477c);
  const nightMid = color(0x121e3c), dayMid = color(0x79acd8), duskMid = color(0xb07c8a);
  const nightHorizon = color(0x24324e), dayHorizon = color(0xbad4e8), duskHorizon = color(0xf0a868);
  const cloud = { day: [color(0xfbf6ec), color(0xa9b6c7)], dusk: [color(0xffc08a), color(0x7a5a72)], night: [color(0x3a4560), color(0x141a2a)] };
  const sunWarm = color(0xffb46a), sunDay = color(0xfff0d2);
  const nightFog = color(0x283a50), dayFog = color(0xb6cfdc), duskFog = color(0xd2b08a);
  const localLights = [];
  function collectLights() {
    const lights = [];
    scene.traverse(o => { if (o.isPointLight) lights.push(o); });
    for (const light of lights) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: light.color,
        transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.1); light.add(halo);
      localLights.push({ light, base: light.intensity, halo });
    }
  }
  const direction = new THREE.Vector3();
  function update(dt, hour, camera, focus) {
    uniforms.uTime.value += dt;
    const angle = (hour - 6) / 24 * Math.PI * 2;
    const elevation = Math.sin(angle);
    const daylight = smooth(elevation, -.16, .3);
    const sunset = (1 - smooth(elevation, .1, .65)) * daylight;
    direction.set(-Math.cos(angle), elevation, .36).normalize();
    uniforms.uSun.value.copy(direction);
    uniforms.uMoon.value.set(Math.cos(angle) * .9, Math.max(.2, -elevation), -.4).normalize();
    uniforms.uDay.value = daylight; uniforms.uDusk.value = sunset; uniforms.uNight.value = 1 - daylight;
    uniforms.uTop.value.copy(nightTop).lerp(dayTop, daylight).lerp(duskTop, sunset * .55);
    uniforms.uMid.value.copy(nightMid).lerp(dayMid, daylight).lerp(duskMid, sunset * .7);
    uniforms.uHorizon.value.copy(nightHorizon).lerp(dayHorizon, daylight).lerp(duskHorizon, sunset * .8);
    uniforms.uCloudLit.value.copy(cloud.night[0]).lerp(cloud.day[0], daylight).lerp(cloud.dusk[0], sunset * .8);
    uniforms.uCloudShade.value.copy(cloud.night[1]).lerp(cloud.day[1], daylight).lerp(cloud.dusk[1], sunset * .7);
    clouds.update(dt, camera, uniforms.uCloudLit.value, uniforms.uCloudShade.value, 1 - daylight, uniforms.uSun.value);
    sky.position.copy(camera.position);
    sun.position.copy(focus).addScaledVector(direction, 100);
    sun.target.position.copy(focus);
    sun.color.copy(sunWarm).lerp(sunDay, smooth(elevation, .15, .8));
    sun.intensity = 3.15 * smooth(elevation, -.02, .48);
    ambient.intensity = .82 + daylight * .95;
    moon.intensity = (1 - daylight) * .55;
    // Sky light from above, a green-brown bounce from the meadows below.
    ambient.color.setHex(0xb4d4f2);
    ambient.groundColor.setHex(0x6f7848);
    scene.fog.color.copy(nightFog).lerp(dayFog, daylight).lerp(duskFog, sunset * .6);
    scene.fog.density = .0025 + (1 - daylight) * .0026;
    for (const { light, base, halo } of localLights) {
      const flicker = 1 + Math.sin(uniforms.uTime.value * 7 + light.id) * .075;
      light.intensity = base * (.5 + (1 - daylight) * 1.1) * flicker;
      halo.material.opacity = (.13 + (1 - daylight) * .32) * flicker;
    }
  }
  return { update, collectLights, moon, uniforms };
}
