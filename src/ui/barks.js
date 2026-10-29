import * as THREE from 'three';

// Shouts over people's heads (HUMANITY AI callouts, warnings, pleas): a short line that follows the
// speaker on screen for a few seconds. Only for people within earshot of the wanderer and in view;
// one line per speaker, a handful at a time. The debug view (F6) reuses it for brain labels.
export function createBarks(camera, { range = 34, max = 4 } = {}) {
  const layer = document.createElement('div'); layer.id = 'barks'; document.body.append(layer);
  const items = [], at = new THREE.Vector3();
  function remove(i) { items[i].el.remove(); items.splice(i, 1); }
  function say(object, text, { duration = 3.2, kind = '' } = {}) {
    const i = items.findIndex(x => x.object === object && x.kind === kind); if (i >= 0) remove(i);
    const el = document.createElement('div'); el.className = `bark ${kind}`; el.textContent = text; layer.append(el);
    items.push({ object, el, kind, until: performance.now() + duration * 1000 });
    while (items.filter(x => !x.kind).length > max) remove(items.findIndex(x => !x.kind));
  }
  function update() {
    const now = performance.now(), w = innerWidth, h = innerHeight;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (now > item.until || !item.object.parent) { remove(i); continue; }
      item.object.getWorldPosition(at); at.y += 2.75 * (item.object.scale?.y || 1);
      const d = at.distanceTo(camera.position);
      at.project(camera);
      const show = at.z < 1 && d < range && Math.abs(at.x) < 1.1 && Math.abs(at.y) < 1.1;
      item.el.style.display = show ? '' : 'none';
      if (show) { item.el.style.left = `${(at.x * .5 + .5) * w}px`; item.el.style.top = `${(-at.y * .5 + .5) * h}px`; item.el.style.opacity = Math.min(1, (item.until - now) / 400); }
    }
  }
  function clear(kind = null) { for (let i = items.length - 1; i >= 0; i--) if (kind === null || items[i].kind === kind) remove(i); }
  return { say, update, clear };
}
