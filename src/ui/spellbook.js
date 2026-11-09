// "Buch der Glut" — the spellbook (B). An open grimoire: the left page lists every spell by chapter, the right
// page shows the chosen one as a living plate (a small pixel painting of its element, animated), what it does to
// foes and to the world, and the Zauberhand: four seals at the foot of the page, the spells ready to cast.
// Click a seal (or press 1–4) to lay the chosen spell into it; it becomes the spell in your hand.
import { SPELLS, SPELL_IDS, ELEMENTS, CHAPTERS, HAND_SLOTS, spellCost } from '../data/spells.js';
import { sigilSvg, glyphPath } from './sigils.js';
import './spellbook.css';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NUMERALS = ['I', 'II', 'III', 'IV'];
const effectLine = (id, s) => s.cast === 'self' ? (id === 'lebensquell' ? `${s.power} Leben` : id === 'irrlicht' ? `${s.power} s Licht` : `${s.power} m Schritt`)
  : id === 'seuchennebel' ? 'Gift · 9 s' : `${Math.round(s.power * 100)} % Glutkraft`;

export function createSpellbook(root, hooks) {
  root.className = 'book-screen hidden'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Zauberbuch');
  root.innerHTML = `
    <canvas class="bk-dust" aria-hidden="true"></canvas>
    <div class="bk-book">
      <div class="bk-ribbons">${CHAPTERS.map((c, i) => `<button class="bk-ribbon" data-chapter="${c.id}" style="--i:${i}" title="${esc(c.name)}"><span>${c.numeral}</span></button>`).join('')}</div>
      <div class="bk-spread">
        <section class="bk-page bk-left">
          <header class="bk-title"><small>Zauberbuch des Wanderers</small><h2>Buch der Glut</h2></header>
          <div class="bk-list"></div>
          <footer class="bk-folio">— i —</footer>
        </section>
        <div class="bk-gutter" aria-hidden="true"></div>
        <section class="bk-page bk-right">
          <div class="bk-turn" aria-hidden="true"></div>
          <div class="bk-detail"></div>
          <div class="bk-hand"><div class="bk-hand-head"><span>Zauberhand</span><small class="desk">1–4 legt den Zauber in ein Siegel · 2 / X wechselt im Spiel</small><small class="touch">Siegel antippen legt den Zauber hinein</small></div><div class="bk-seals"></div></div>
          <footer class="bk-folio">— ii —</footer>
        </section>
      </div>
    </div>
    <button class="bk-close" aria-label="Zauberbuch schließen">✕</button>
    <p class="bk-hints"><span>↑ ↓ Zauber wählen</span><span>1–4 in die Hand legen</span><span>Entf aus der Hand nehmen</span><span>B / Esc schließen</span></p>`;
  const $ = s => root.querySelector(s);
  const plateCanvas = document.createElement('canvas'); plateCanvas.className = 'bk-plate-canvas'; plateCanvas.width = 192; plateCanvas.height = 112;
  const pg = plateCanvas.getContext('2d');
  const dust = $('.bk-dust'), dg = dust.getContext('2d');
  let open = false, selected = 'funken', raf = 0, last = 0, t = 0, openedAt = 0, motes = [], particles = [], boltT = 0, flashT = 0, bolt = null;
  const player = () => hooks.player();
  const hand = () => player().spells.loadout, active = () => player().spells.active;

  // ── The left page: chapters and their spells.
  function drawList() {
    const loadout = hand(), p = player();
    $('.bk-list').innerHTML = CHAPTERS.map(c => `<div class="bk-chapter" data-chapter="${c.id}">
        <h3><span class="bk-numeral">${c.numeral}</span>${esc(c.name)}</h3>
        ${SPELL_IDS.filter(id => SPELLS[id].chapter === c.id).map(id => { const s = SPELLS[id], E = ELEMENTS[s.element], slot = loadout.indexOf(id);
          return `<button class="bk-spell${id === selected ? ' selected' : ''}${id === active() ? ' active' : ''}" data-spell="${id}" style="--el:${E.color};--elg:${E.glow}">
            <span class="bk-seal-mini">${sigilSvg(s.sigil)}</span>
            <span class="bk-spell-text"><b>${esc(s.name)}</b><small>${esc(E.name)} · ${esc(s.use)}</small></span>
            <span class="bk-cost" title="Magicka">${spellCost(id, { skill: p.skills?.magic ?? 0, perks: p.perks })}</span>
            ${slot >= 0 ? `<span class="bk-in-hand" title="In der Zauberhand">${NUMERALS[slot]}</span>` : '<span class="bk-in-hand empty"></span>'}
          </button>`; }).join('')}
      </div>`).join('');
    root.querySelectorAll('.bk-spell').forEach(b => {
      b.addEventListener('click', () => select(b.dataset.spell));
      b.addEventListener('dblclick', () => place(slotFor(b.dataset.spell)));
    });
  }
  // ── The right page: the plate, the words, the numbers.
  function drawDetail() {
    const s = SPELLS[selected], E = ELEMENTS[s.element], p = player(), slot = hand().indexOf(selected);
    root.style.setProperty('--el', E.color); root.style.setProperty('--elg', E.glow);
    $('.bk-detail').innerHTML = `
      <figure class="bk-plate"><div class="bk-plate-frame"></div><figcaption>${esc(E.name)}</figcaption></figure>
      <div class="bk-head"><span class="bk-chip">${esc(E.name)} · ${esc(s.use)}</span><h3>${esc(s.name)}</h3></div>
      <p class="bk-desc"><span class="bk-initial">${esc(s.desc[0])}</span>${esc(s.desc.slice(1))}</p>
      <p class="bk-world"><b>In der Welt</b>${esc(s.world)}</p>
      <dl class="bk-stats">
        <div><dt>Magicka</dt><dd>${spellCost(selected, { skill: p.skills?.magic ?? 0, perks: p.perks })}</dd></div>
        <div><dt>Wirkung</dt><dd>${esc(effectLine(selected, s))}</dd></div>
        <div><dt>Reichweite</dt><dd>${s.range ? `${s.range} m` : 'du selbst'}</dd></div>
        <div><dt>Hand</dt><dd>${slot >= 0 ? `Siegel ${NUMERALS[slot]}${selected === active() ? ' · bereit' : ''}` : '—'}</dd></div>
      </dl>`;
    $('.bk-plate-frame').append(plateCanvas); fitPlate();
    particles = []; boltT = .4;
  }
  function drawSeals() {
    const loadout = hand();
    $('.bk-seals').innerHTML = loadout.map((id, i) => { const s = id && SPELLS[id], E = s && ELEMENTS[s.element];
      return `<button class="bk-seal${s ? '' : ' empty'}${id === active() ? ' active' : ''}${id && id === selected ? ' chosen' : ''}" data-slot="${i}" ${s ? `style="--el:${E.color};--elg:${E.glow}"` : ''} aria-label="Siegel ${NUMERALS[i]}${s ? `: ${esc(s.name)}` : ' (leer)'}">
        <span class="bk-seal-wax">${s ? sigilSvg(s.sigil) : ''}</span><span class="bk-seal-num">${NUMERALS[i]}</span><span class="bk-seal-name">${s ? esc(s.name) : 'leer'}</span>
        ${s ? `<span class="bk-seal-out" data-out="${i}" title="Aus der Hand nehmen">✕</span>` : ''}
      </button>`; }).join('');
    root.querySelectorAll('.bk-seal').forEach(b => b.addEventListener('click', e => {
      if (e.target.closest('[data-out]')) { e.stopPropagation(); hooks.unequip(+b.dataset.slot); hooks.sound?.('out'); render(false); return; }
      place(+b.dataset.slot);
    }));
  }
  function render(turnPage = false) { drawList(); drawSeals(); if (turnPage) turn(); else drawDetail(); }
  // A page turns: the right page lifts from its edge, the new spell is written beneath it.
  let turnTimer = 0;
  function turn() {
    const leaf = $('.bk-turn');
    leaf.classList.remove('go'); void leaf.offsetWidth; leaf.classList.add('go');
    clearTimeout(turnTimer); turnTimer = setTimeout(drawDetail, 170);
  }
  function select(id, sound = true) {
    if (!SPELLS[id] || id === selected) return;
    selected = id; drawList(); drawSeals(); turn();
    root.querySelector(`.bk-spell[data-spell="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    if (sound) hooks.sound?.('page');
  }
  /** Where Enter or a double click puts the chosen spell: its own seal (makes it ready), an empty seal, the ready one. */
  function slotFor(id) { const loadout = hand(), own = loadout.indexOf(id); return own >= 0 ? own : loadout.indexOf(null) >= 0 ? loadout.indexOf(null) : Math.max(0, loadout.indexOf(active())); }
  function place(slot) {
    if (!(slot >= 0 && slot < HAND_SLOTS)) return;
    hooks.equip(selected, slot); hooks.sound?.('seal');
    render(false);
    const seal = root.querySelector(`.bk-seal[data-slot="${slot}"]`); seal?.classList.add('stamp');
    burstAt(seal);
  }

  /** The plate's pixels follow the shape it is shown in (192 wide, as tall as the page allows). */
  function fitPlate() {
    const r = plateCanvas.getBoundingClientRect(); if (!r.width) return;
    const h = Math.max(48, Math.min(140, Math.round(192 * r.height / r.width)));
    if (plateCanvas.height !== h) { plateCanvas.height = h; particles = []; }
  }
  // ── The plate: a little pixel painting of the element, alive.
  const R = (a, b) => a + Math.random() * (b - a);
  const hex = n => `#${n.toString(16).padStart(6, '0')}`;
  function plate(dt) {
    const s = SPELLS[selected], E = ELEMENTS[s.element], W = plateCanvas.width, H = plateCanvas.height, ramp = E.ramp.map(hex);
    // Ink-dark ground washed with the element's colour, a horizon of ground for most elements.
    const bg = pg.createRadialGradient(W / 2, H * .55, 4, W / 2, H * .55, W * .7);
    bg.addColorStop(0, ramp[3] + '66'); bg.addColorStop(.55, '#120f0d'); bg.addColorStop(1, '#070605');
    pg.fillStyle = bg; pg.fillRect(0, 0, W, H);
    if (flashT > 0) { pg.fillStyle = `rgba(240,232,255,${flashT * 1.6})`; pg.fillRect(0, 0, W, H); flashT -= dt; }
    const gy = H - 14;
    if (!['blitz', 'licht', 'schatten'].includes(s.element)) { pg.fillStyle = '#0c0a08'; pg.fillRect(0, gy, W, H - gy); pg.fillStyle = ramp[4]; for (let x = 0; x < W; x += 2) pg.fillRect(x, gy + ((x * 7) % 3 === 0 ? 0 : 1), 2, 1); }
    // Spawn by element.
    const sp = (o) => particles.push({ life: 1, max: 1, size: 1, vx: 0, vy: 0, g: 0, ...o, age: 0 });
    const cx = W / 2, cy = H / 2 - 4;
    switch (s.element) {
      case 'feuer': for (let i = 0; i < 4; i++) sp({ x: cx + R(-34, 34), y: gy, vx: R(-6, 6), vy: R(-38, -20), max: R(.6, 1.2), size: Math.random() < .3 ? 2 : 1, ramp: true, flick: true }); break;
      case 'eis': for (let i = 0; i < 2; i++) sp({ x: R(0, W), y: -2, vx: R(-4, 4), vy: R(10, 22), max: 6, size: Math.random() < .2 ? 2 : 1, col: Math.random() < .5 ? ramp[0] : ramp[2], sway: true }); break;
      case 'blitz': boltT -= dt; if (boltT <= 0) { boltT = R(.7, 1.4); flashT = .25; bolt = { pts: zig(cx + R(-30, 30), 0, cx + R(-6, 6), cy + 4), life: .22 }; for (let i = 0; i < 26; i++) sp({ x: cx, y: cy + 4, vx: R(-70, 70), vy: R(-60, 40), max: R(.15, .4), col: ramp[Math.random() < .5 ? 0 : 2] }); } break;
      case 'wind': for (let i = 0; i < 2; i++) sp({ x: -10, y: R(8, gy - 6), vx: R(90, 150), vy: 0, max: 2.2, len: Math.round(R(6, 18)), col: Math.random() < .6 ? ramp[1] : ramp[3], wave: R(0, 6) }); if (Math.random() < .08) sp({ x: -4, y: R(20, gy - 10), vx: R(60, 90), vy: R(-10, 10), max: 3, size: 2, col: ['#6a8a3a', '#9a7a3a', '#8a5a2a'][Math.floor(R(0, 3))], wave: R(0, 6), leaf: true }); break;
      case 'erde': if (Math.random() < .22) { const x = R(14, W - 14); for (let i = 0; i < 4; i++) sp({ x: x + R(-3, 3), y: gy, vx: R(-22, 22), vy: R(-70, -40), g: 160, max: R(.8, 1.3), size: Math.random() < .5 ? 3 : 2, col: ['#8a7a64', '#6a5e50', '#a89878', '#5a4a3a'][i % 4], floor: gy }); sp({ x, y: gy, spike: true, max: .9, col: '#7a6a54' }); } break;
      case 'licht': if (Math.random() < .5) sp({ x: cx + R(-40, 40), y: R(cy, H), vx: R(-3, 3), vy: R(-14, -6), max: R(1.5, 3), col: Math.random() < .5 ? ramp[0] : ramp[2] }); break;
      case 'leben': for (let i = 0; i < 2; i++) { const a = R(0, 6.28); sp({ x: cx + Math.cos(a) * R(10, 44), y: gy, vx: 0, vy: R(-26, -14), max: R(1.6, 2.6), size: Math.random() < .4 ? 2 : 1, col: Math.random() < .6 ? ramp[1] : ramp[2], spiral: a, r0: R(10, 40) }); } if (Math.random() < .04) sp({ x: R(10, W - 10), y: gy, sprout: true, max: 4, col: ramp[3] }); break;
      case 'schatten': if (Math.random() < .55) sp({ x: cx + R(-50, 50), y: R(0, cy), vx: R(-4, 4), vy: R(6, 16), max: R(1.6, 2.8), size: Math.round(R(3, 7)), col: ['#1a1028', '#2a1a40', '#120a1c'][Math.floor(R(0, 3))], smoke: true }); if (Math.random() < .2) sp({ x: cx + R(-30, 30), y: R(10, H - 10), vx: 0, vy: R(4, 10), max: 1.2, col: ramp[0] }); break;
      case 'gift': if (Math.random() < .5) sp({ x: cx + R(-46, 46), y: gy, vx: R(-3, 3), vy: R(-22, -10), max: R(1.2, 2.4), size: Math.random() < .3 ? 3 : 2, col: ramp[1], bubble: true }); if (Math.random() < .3) sp({ x: R(0, W), y: gy - R(0, 10), vx: R(-5, 5), vy: R(-2, 0), max: 3, size: Math.round(R(5, 9)), col: ['#3a5a18', '#2a4a12', '#4a6a20'][Math.floor(R(0, 3))], smoke: true }); break;
    }
    // Rays behind the sigil for light; the sigil itself, glowing and breathing.
    if (s.element === 'licht') { pg.save(); pg.translate(cx, cy); pg.rotate(t * .25); for (let i = 0; i < 12; i++) { pg.rotate(Math.PI / 6); pg.fillStyle = i % 2 ? ramp[2] + '33' : ramp[1] + '22'; pg.fillRect(-2, 18, 4, 60); } pg.restore(); }
    if (s.element === 'schatten' || s.element === 'gift') drawParticles(dt, true);
    const pulse = .75 + Math.sin(t * 3) * .25, path = new Path2D(glyphPath(s.sigil)), scale = H < 80 ? 3 : 4;
    pg.save(); pg.translate(Math.round(cx - 6 * scale), Math.round(cy - 6 * scale));
    pg.scale(scale, scale);
    pg.globalAlpha = .35 * pulse; pg.fillStyle = ramp[2];
    for (const [ox, oy] of [[-.5, 0], [.5, 0], [0, -.5], [0, .5]]) { pg.save(); pg.translate(ox, oy); pg.fill(path); pg.restore(); }
    pg.globalAlpha = 1; pg.fillStyle = ramp[4]; pg.save(); pg.translate(.25, .25); pg.fill(path); pg.restore();
    pg.fillStyle = ramp[1]; pg.fill(path);
    pg.restore();
    if (bolt) { bolt.life -= dt; pg.fillStyle = ramp[0]; for (let i = 0; i < bolt.pts.length - 1; i++) line(bolt.pts[i], bolt.pts[i + 1]); if (bolt.life <= 0) bolt = null; }
    if (!(s.element === 'schatten' || s.element === 'gift')) drawParticles(dt, false);
    // Vignette.
    const v = pg.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); pg.fillStyle = v; pg.fillRect(0, 0, W, H);
  }
  function drawParticles(dt, back) {
    const W = plateCanvas.width, E = ELEMENTS[SPELLS[selected].element], ramp = E.ramp.map(hex);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; if (p.age >= p.max) { particles.splice(i, 1); continue; }
      const k = 1 - p.age / p.max;
      p.vy += p.g * dt;
      if (p.spiral !== undefined) { p.spiral += dt * 3; p.x = W / 2 + Math.cos(p.spiral) * p.r0 * k; }
      else p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -.3; p.vx *= .6; }
      if (p.sway) p.x += Math.sin(p.age * 3 + p.y * .1) * .3;
      if (p.wave !== undefined) p.y += Math.sin(p.age * 5 + p.wave) * .4;
      let c = p.col;
      if (p.ramp) c = ramp[Math.min(4, Math.floor((1 - k) * 5))];
      if (p.flick && Math.random() < .2) continue;
      pg.globalAlpha = p.smoke ? .5 * Math.min(1, k * 2) : Math.min(1, k * 2.5);
      pg.fillStyle = c;
      if (p.len) pg.fillRect(Math.round(p.x), Math.round(p.y), p.len, 1);
      else if (p.spike) { const h = Math.round(Math.sin(Math.min(1, p.age / p.max * 1.3) * Math.PI) * 18); for (let r = 0; r < h; r++) pg.fillRect(Math.round(p.x - (h - r) / 6), Math.round(p.y - r), Math.max(1, Math.round((h - r) / 3)), 1); }
      else if (p.sprout) { const h = Math.min(8, Math.round(p.age * 6)); pg.fillRect(Math.round(p.x), Math.round(p.y - h), 1, h); if (h > 4) { pg.fillRect(Math.round(p.x) - 2, Math.round(p.y - h + 2), 2, 1); pg.fillRect(Math.round(p.x) + 1, Math.round(p.y - h + 4), 2, 1); } }
      else if (p.bubble) { const sz = p.size; pg.fillRect(Math.round(p.x), Math.round(p.y), sz, sz); pg.fillStyle = ramp[0]; pg.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else pg.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      pg.globalAlpha = 1;
      void back;
    }
  }
  function zig(x0, y0, x1, y1) { const pts = [{ x: x0, y: y0 }], n = 7; for (let i = 1; i < n; i++) { const k = i / n; pts.push({ x: x0 + (x1 - x0) * k + R(-9, 9), y: y0 + (y1 - y0) * k }); } pts.push({ x: x1, y: y1 }); return pts; }
  function line(a, b) { const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); for (let i = 0; i <= n; i++) { const k = n ? i / n : 0; pg.fillRect(Math.round(a.x + (b.x - a.x) * k), Math.round(a.y + (b.y - a.y) * k), 2, 1); } }

  // ── Dust in the candlelight, drifting over the book; a burst of sparks when a seal is pressed.
  function resize() { const r = root.getBoundingClientRect(); dust.width = Math.max(1, Math.round(r.width / 3)); dust.height = Math.max(1, Math.round(r.height / 3)); }
  function burstAt(el) {
    if (!el) return;
    const r = el.getBoundingClientRect(), c = dust.getBoundingClientRect(), sx = dust.width / c.width, sy = dust.height / c.height, E = ELEMENTS[SPELLS[selected].element];
    for (let i = 0; i < 40; i++) { const a = R(0, 6.28), v = R(10, 50); motes.push({ x: (r.left + r.width / 2 - c.left) * sx, y: (r.top + r.height / 2 - c.top) * sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: R(.4, .9), age: 0, col: Math.random() < .5 ? E.glow : E.color, burst: true }); }
  }
  function drawDust(dt) {
    const W = dust.width, H = dust.height;
    dg.clearRect(0, 0, W, H);
    if (motes.filter(m => !m.burst).length < 46 && Math.random() < dt * 12) motes.push({ x: R(0, W), y: H + 2, vx: R(-2, 2), vy: R(-7, -3), life: R(6, 12), age: 0, col: Math.random() < .7 ? '#f0c878' : '#fff0d0' });
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i]; m.age += dt; if (m.age > m.life || m.y < -4) { motes.splice(i, 1); continue; }
      m.x += (m.vx + Math.sin(m.age * .8 + m.life) * 2) * dt; m.y += m.vy * dt; if (m.burst) { m.vy += 40 * dt; m.vx *= .97; }
      const k = 1 - m.age / m.life; dg.globalAlpha = m.burst ? k : Math.min(1, k * 2) * .5; dg.fillStyle = m.col; dg.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    dg.globalAlpha = 1;
  }
  function loop(now) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; t += dt;
    plate(dt); drawDust(dt);
  }

  // ── Keys.
  function keydown(event) {
    if (!open) return;
    event.stopPropagation();
    const list = SPELL_IDS, i = list.indexOf(selected);
    if (event.code === 'Escape' || (event.code === 'KeyB' && performance.now() - openedAt > 250)) { event.preventDefault(); hooks.close(); return; }
    if (['ArrowDown', 'KeyS'].includes(event.code)) { event.preventDefault(); select(list[(i + 1) % list.length]); }
    if (['ArrowUp', 'KeyW'].includes(event.code)) { event.preventDefault(); select(list[(i - 1 + list.length) % list.length]); }
    if (/^Digit[1-4]$/.test(event.code)) { event.preventDefault(); place(+event.code.at(-1) - 1); }
    if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); place(slotFor(selected)); }
    if (event.code === 'Delete' || event.code === 'Backspace') { const s = hand().indexOf(selected); if (s >= 0) { hooks.unequip(s); hooks.sound?.('out'); render(false); } }
  }
  root.addEventListener('keydown', keydown);
  $('.bk-close').addEventListener('click', () => hooks.close());
  root.querySelectorAll('.bk-ribbon').forEach(b => b.addEventListener('click', () => {
    const first = SPELL_IDS.find(id => SPELLS[id].chapter === b.dataset.chapter); if (first) select(first);
    root.querySelector(`.bk-chapter[data-chapter="${b.dataset.chapter}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }));
  root.addEventListener('pointerdown', e => { if (e.target === root || e.target === dust) hooks.close(); });
  addEventListener('resize', () => { if (open) { resize(); fitPlate(); } });

  return {
    get isOpen() { return open; },
    open(spellId) {
      selected = SPELLS[spellId] ? spellId : active() || 'funken';
      open = true; openedAt = performance.now(); root.classList.remove('hidden'); root.hidden = false;
      root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
      render(false); resize(); last = 0; motes = [];
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      root.focus({ preventScroll: true });
      root.querySelector('.bk-spell.selected')?.scrollIntoView({ block: 'nearest' });
    },
    close() { open = false; cancelAnimationFrame(raf); root.classList.add('hidden'); },
    render, select, place,
    get selected() { return selected; },
  };
}
