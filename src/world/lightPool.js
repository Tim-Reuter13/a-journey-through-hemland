import * as THREE from 'three';

// A fixed set of point lights shared by every lamp, brazier, forge and spell in the world.
// three.js compiles the number of lights into every shader, so a light that appears or vanishes
// (a site culled by distance, a Funken projectile) makes every material recompile — the game froze
// for seconds. The pool never changes its count; each frame it lends its lights to the anchors
// nearest the viewer and fades the hand-over so lamps never pop.
export function createLightPool(scene, size = 10) {
  const pool = Array.from({ length: size }, () => {
    const light = new THREE.PointLight(0xffffff, 0, 1, 2);
    light.name = 'pooled light'; scene.add(light);
    return light;
  });
  const anchors = new Set(), ranked = [];

  /** Turns a placed light into an anchor. The light object stays the source of colour and intensity
   *  (flicker and day/night code keep animating it) but leaves the scene graph; its children
   *  (halo sprites) stay where they were. */
  function adopt(light) {
    const parent = light.parent;
    light.updateWorldMatrix(true, false);
    const anchor = { source: light, position: light.getWorldPosition(new THREE.Vector3()) };
    if (parent) { for (const child of [...light.children]) parent.attach(child); parent.remove(light); }
    anchors.add(anchor);
    return anchor;
  }
  /** A light that moves with an object (spells). Returns a release function. */
  function follow(object, { color = 0xffffff, intensity = 1, distance = 6, decay = 2 } = {}) {
    const anchor = { object, source: new THREE.PointLight(color, intensity, distance, decay), position: new THREE.Vector3() };
    anchors.add(anchor);
    return () => anchors.delete(anchor);
  }
  function update(viewer) {
    ranked.length = 0;
    for (const anchor of anchors) {
      if (anchor.object) anchor.object.getWorldPosition(anchor.position);
      const source = anchor.source;
      if (source.intensity <= 0) continue;
      const d = anchor.position.distanceTo(viewer);
      if (d < source.distance + 70) ranked.push({ d, anchor });
    }
    ranked.sort((a, b) => a.d - b.d);
    // The first anchor that misses out defines where pooled lights start to fade.
    const cut = ranked[size]?.d ?? Infinity;
    pool.forEach((light, i) => {
      const entry = ranked[i];
      if (!entry) { light.intensity = 0; return; }
      const { source, position } = entry.anchor;
      light.position.copy(position); light.color.copy(source.color);
      light.distance = source.distance; light.decay = source.decay;
      light.intensity = source.intensity * Math.min(1, Math.max(0, (cut - entry.d) / 10));
    });
  }
  return { adopt, follow, update, size, pool, state: () => ({ anchors: anchors.size, lit: ranked.length }) };
}
