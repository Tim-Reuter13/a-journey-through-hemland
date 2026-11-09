import * as THREE from 'three';
import { AURAS, REACTIONS } from '../systems/elements.js';
import { sigilSvg } from './sigils.js';
import './auraMarks.css';

// Over the heads of those carrying an element: its sigil in its colour (two or three side by side), a crystal for
// "frozen", a crack for "brittle". A reaction writes its name over the body in the colours of the two elements
// and floats up. Plain DOM over the canvas, placed by projecting the head each frame.
export function createAuraMarks(parent = document.body) {
  const layer = document.createElement('div'); layer.className = 'aura-layer'; parent.append(layer);
  const marks = new Map(), texts = [], _p = new THREE.Vector3();
  const icon = (el, cls = '') => `<i class="aura-icon ${cls}" style="--c:${AURAS[el]?.color || '#fff'}">${sigilSvg(AURAS[el]?.glyph || 'star')}</i>`;
  function place(node, world, camera, lift = 0) {
    _p.copy(world).project(camera);
    const on = _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
    node.style.display = on ? '' : 'none';
    if (on) node.style.transform = `translate(${(_p.x * .5 + .5) * innerWidth}px, ${(-_p.y * .5 + .5) * innerHeight - lift}px) translate(-50%, -100%)`;
    return on;
  }
  /** list: [{ key, head (world point), auras: { el: units }, frozen, brittle }] — the bodies near the wanderer. */
  function update(dt, camera, list) {
    const seen = new Set();
    for (const b of list) {
      const els = Object.keys(b.auras || {}).filter(el => AURAS[el]);
      if (!els.length && !b.frozen && !b.brittle) continue;
      seen.add(b.key);
      let m = marks.get(b.key);
      if (!m) { m = { node: document.createElement('div'), sig: '' }; m.node.className = 'aura-mark'; layer.append(m.node); marks.set(b.key, m); }
      const sig = els.join() + (b.frozen ? '|f' : '') + (b.brittle ? '|b' : '');
      if (sig !== m.sig) {
        m.sig = sig;
        m.node.innerHTML = els.map(el => icon(el, (b.auras[el] || 0) < .35 ? 'fading' : '')).join('') +
          (b.frozen ? `<i class="aura-icon frozen" style="--c:#e8f6ff">${sigilSvg('gem')}</i>` : '') + (b.brittle ? `<i class="aura-icon brittle" style="--c:#c8b8ff">${sigilSvg('rune')}</i>` : '');
      }
      place(m.node, b.head, camera);
    }
    for (const [key, m] of marks) if (!seen.has(key)) { m.node.remove(); marks.delete(key); }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt;
      if (t.life <= 0) { t.node.remove(); texts.splice(i, 1); continue; }
      const k = 1 - t.life / t.dur;
      place(t.node, t.at, camera, 34 + k * 46);
      t.node.style.opacity = String(Math.min(1, t.life * 2.5));
    }
  }
  /** A reaction's name over a body. */
  function reaction(id, at) {
    const r = REACTIONS[id]; if (!r) return;
    const node = document.createElement('div'); node.className = 'reaction-text';
    node.style.setProperty('--a', r.colors[0]); node.style.setProperty('--b', r.colors[1] || r.colors[0]);
    node.textContent = r.name; layer.append(node);
    texts.push({ node, at: at.clone(), life: 1.5, dur: 1.5 });
    if (texts.length > 10) texts.shift().node.remove();
  }
  function clear() { for (const m of marks.values()) m.node.remove(); marks.clear(); for (const t of texts) t.node.remove(); texts.length = 0; }
  return { update, reaction, clear };
}
