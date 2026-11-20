import * as THREE from 'three';
import { SHOTS } from './shots.js';

// Live editor for the film (open with ?film=edit, or press F2 while the film runs):
// a timeline with the shots and the checker's problems, a free camera, and per-segment nudges for the actors
// (arrows move 10 cm, Shift = 50 cm, Q/E turn 5°) that show at once. "Speichern" downloads the edits as
// letzte_wacht_edits.json; put it into public/cutscenes and the next bake (bake_film.py) builds them in.
const CSS = `#film-edit{position:fixed;left:0;right:0;bottom:0;z-index:45;background:rgba(10,9,8,.86);color:#e9dfc8;font:12px/1.4 'Pixelify Sans',monospace;padding:8px 12px;pointer-events:auto}
#film-edit .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:3px 0}
#film-edit button{background:#2b2620;color:#e9dfc8;border:1px solid #6b5d48;padding:3px 8px;font:inherit;cursor:pointer}
#film-edit button.on{background:#7a5a2a}
#film-edit .tl{position:relative;height:26px;background:#1c1915;border:1px solid #4a4134;cursor:pointer}
#film-edit .tl .shot{position:absolute;top:0;bottom:0;border-left:1px solid #6b5d48;color:#9d917b;padding-left:2px;font-size:10px}
#film-edit .tl .issue{position:absolute;bottom:0;height:7px;background:#c0392b}
#film-edit .tl .issue.medium{background:#d9a441}
#film-edit .tl .head{position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff}
#film-edit .list{max-height:96px;overflow:auto;color:#cfc3ab}
#film-edit .list div{cursor:pointer}#film-edit .list div:hover{color:#fff}`;

export function createEditor(film, api) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div'); el.id = 'film-edit'; el.hidden = true;
  el.innerHTML = `<div class="row"><button data-a="play">▶ / ❚❚</button><span class="time">0.0 s</span>
    <button data-a="free">Freie Kamera</button><button data-a="check">Prüfen</button>
    <span>Figur:</span><button data-a="who" data-w="captain" class="on">Hauptmann</button><button data-a="who" data-w="bandit">Bandit</button>
    <span class="seg"></span><button data-a="reset">Segment zurücksetzen</button><button data-a="save">Speichern</button>
    <span class="hint">←↑↓→ schieben (Shift ×5) · Q/E drehen · Leertaste Pause · F2 schließen</span></div>
    <div class="tl"></div><div class="list"></div>`;
  document.body.append(el);
  const $ = s => el.querySelector(s);
  const tl = $('.tl');
  const D = film.header.duration;
  for (const [i, s] of SHOTS.entries()) { const d = document.createElement('div'); d.className = 'shot'; d.style.left = `${s.t0 / D * 100}%`; d.textContent = i + 1; tl.append(d); }
  const head = document.createElement('div'); head.className = 'head'; tl.append(head);
  let who = 'captain', free = false, issues = [];
  const edits = film.edits || (film.edits = { actors: { captain: {}, bandit: {} }, cameras: {} });

  // free camera: drag to orbit, wheel to zoom, right-drag to pan
  const orbit = { target: new THREE.Vector3(0, 1, -2), yaw: .8, pitch: .35, dist: 9 };
  let drag = null;
  const canvas = document.querySelector('#game canvas');
  canvas?.addEventListener('pointerdown', e => { if (free) drag = { x: e.clientX, y: e.clientY, b: e.button }; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2) { const r = new THREE.Vector3(Math.cos(orbit.yaw), 0, -Math.sin(orbit.yaw)); orbit.target.addScaledVector(r, -dx * .01 * orbit.dist / 8); orbit.target.y += dy * .01 * orbit.dist / 8; }
    else { orbit.yaw -= dx * .006; orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * .005, -.2, 1.45); }
  });
  canvas?.addEventListener('wheel', e => { if (free) { orbit.dist = THREE.MathUtils.clamp(orbit.dist * (1 + Math.sign(e.deltaY) * .1), 1.5, 60); e.preventDefault(); } }, { passive: false });
  canvas?.addEventListener('contextmenu', e => { if (free) e.preventDefault(); });

  function segmentAt(key, t) {
    const segs = film.header.actors[key].segments;
    let i = 0; for (let k = 0; k < segs.length; k++) if (segs[k].t <= t) i = k;
    return i;
  }
  function nudge(dx, dz, dyaw) {
    const t = api.time(), i = segmentAt(who, t);
    const e = edits.actors[who][i] ||= { dx: 0, dz: 0, yaw: 0 };
    e.dx = +(e.dx + dx).toFixed(3); e.dz = +(e.dz + dz).toFixed(3); e.yaw = +(e.yaw + dyaw).toFixed(4);
  }
  function key(e) {
    if (el.hidden) return false;
    const s = e.shiftKey ? .5 : .1;
    const map = { ArrowLeft: [-s, 0, 0], ArrowRight: [s, 0, 0], ArrowUp: [0, -s, 0], ArrowDown: [0, s, 0], KeyQ: [0, 0, .0873], KeyE: [0, 0, -.0873] };
    if (map[e.code]) { e.preventDefault(); nudge(...map[e.code]); return true; }
    return false;
  }
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'play') api.pause(!api.paused());
    if (a === 'free') { free = !free; b.classList.toggle('on', free); if (free) { orbit.target.copy(film.camera.position).addScaledVector(film.camera.getWorldDirection(new THREE.Vector3()), 6); } }
    if (a === 'who') { who = b.dataset.w; el.querySelectorAll('[data-a=who]').forEach(x => x.classList.toggle('on', x === b)); }
    if (a === 'reset') delete edits.actors[who][segmentAt(who, api.time())];
    if (a === 'check') { b.textContent = 'Prüfe …'; await new Promise(r => setTimeout(r, 30)); const t = api.time(); issues = api.validate(.25) || []; api.seek(t); b.textContent = `Prüfen (${issues.length})`; drawIssues(); }
    if (a === 'save') {
      const blob = new Blob([JSON.stringify(edits, null, 1)], { type: 'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'letzte_wacht_edits.json'; link.click();
    }
  });
  tl.addEventListener('click', e => { const r = tl.getBoundingClientRect(); api.seek((e.clientX - r.left) / r.width * D); });
  function drawIssues() {
    tl.querySelectorAll('.issue').forEach(x => x.remove());
    const list = $('.list'); list.innerHTML = '';
    for (const i of issues) {
      const d = document.createElement('div'); d.className = `issue ${i.severity}`; d.style.left = `${i.t / D * 100}%`; d.style.width = `${Math.max(.3, (i.t_end - i.t) / D * 100)}%`; tl.append(d);
      const row = document.createElement('div'); row.textContent = `${i.t.toFixed(1)}–${i.t_end.toFixed(1)} s · Shot ${i.shot} · ${i.type}${i.who ? ' · ' + i.who : ''}${i.by ? ' · durch ' + i.by : ''}${i.what ? ' · ' + i.what : ''} · ${i.severity}`;
      row.onclick = () => api.seek(i.t); list.append(row);
    }
  }
  return {
    get open() { return !el.hidden; },
    toggle(on = el.hidden) { el.hidden = !on; if (!on) free = false; },
    key,
    /** After the film placed actors and camera: apply segment edits, the free camera, the playhead. */
    apply(t) {
      if (free) {
        const cam = film.camera, o = orbit;
        cam.position.set(o.target.x + Math.cos(o.pitch) * Math.sin(o.yaw) * o.dist, o.target.y + Math.sin(o.pitch) * o.dist, o.target.z + Math.cos(o.pitch) * Math.cos(o.yaw) * o.dist);
        cam.lookAt(o.target); cam.fov = 50; cam.updateProjectionMatrix();
      }
      head.style.left = `${t / D * 100}%`;
      $('.time').textContent = `${t.toFixed(1)} s`;
      const i = segmentAt(who, t), s = film.header.actors[who].segments[i];
      $('.seg').textContent = `Segment ${i + 1}: ${s.clip} (${s.t}–${s.end} s)${edits.actors[who][i] ? ' · verschoben' : ''}`;
    },
  };
}
