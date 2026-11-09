// The thief's three windows: the lock (rings to set, ui for systems/thievery.js lockRings), the pockets (a
// mark's attention rising and falling: reach in while it looks away) and the veil round the reticle that
// tells a sneaking wanderer how far they are noticed. Own takes, not Skyrim's: no rotating pick angle, no eye.
import { lockRings, inNotch, LOCKS, pickpocketChance } from '../systems/thievery.js';
import { icon, typeIcon } from './inventoryIcons.js';
import './thief.css';

const TAU = Math.PI * 2;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── Lock: a brass face of concentric rings, each with a notch; the dietrich waits at twelve o'clock.
// Set the active ring when its notch passes under the pick (Space, click or tap); a slip breaks a pick.
export function createLockpick(root, hooks) {
  root.className = 'thief-screen lockpick hidden'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Schloss knacken');
  root.innerHTML = `<div class="th-card lp-card">
      <header class="th-head"><small class="lp-level"></small><h2 class="lp-title"></h2></header>
      <div class="lp-stage"><canvas class="lp-lock" width="144" height="144"></canvas><div class="lp-flash"></div></div>
      <div class="lp-rings" aria-label="Gesetzte Ringe"></div>
      <div class="th-row"><span>Dietriche</span><b class="lp-picks"></b><span>Diebeskunst</span><b class="lp-skill"></b></div>
      <p class="th-hint lp-hint">Setze jeden Ring, wenn seine Kerbe unter dem Dietrich steht.<br><span class="desk">Leertaste / Klick</span><span class="touch">Tippen</span> · Setzen &nbsp; <span class="desk">Esc</span><span class="touch">✕</span> · Aufgeben</p>
      <button class="th-close" aria-label="Aufgeben">✕</button>
    </div>`;
  const canvas = root.querySelector('.lp-lock'), g = canvas.getContext('2d'), flash = root.querySelector('.lp-flash');
  let state = null, raf = 0, last = 0;

  function open(opts) {
    const rings = lockRings(opts.level, { skill: opts.skill, perks: opts.perks, seed: opts.seed });
    state = { ...opts, rings, active: 0, jab: 0, snap: 0, done: false, time: 0, flip: 1.4 };
    root.querySelector('.lp-level').textContent = `Schloss · ${LOCKS[opts.level].name}`;
    root.querySelector('.lp-title').textContent = opts.title;
    root.querySelector('.lp-skill').textContent = opts.skill;
    root.classList.remove('hidden'); root.classList.remove('won', 'lost');
    root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
    refresh(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    root.focus({ preventScroll: true });
  }
  function close(success = false) {
    if (!state) return;
    const done = state.onDone; state = null; cancelAnimationFrame(raf);
    root.classList.add('hidden'); done?.(success);
  }
  function refresh() {
    root.querySelector('.lp-picks').textContent = state.picks();
    root.querySelector('.lp-rings').innerHTML = state.rings.map((_, i) => `<i class="${i < state.active ? 'set' : i === state.active ? 'now' : ''}"></i>`).join('');
  }
  function pulse(kind) { flash.className = 'lp-flash'; void flash.offsetWidth; flash.className = `lp-flash ${kind}`; }
  /** The wanderer sets the pick: a ring caught in its notch, or a slip. */
  function attempt() {
    if (!state || state.done) return;
    const ring = state.rings[state.active];
    state.jab = .14;
    if (inNotch(ring)) {
      ring.angle = -ring.target; // snaps true under the pick
      state.active++; hooks.sound?.('set'); pulse('good');
      if (state.active >= state.rings.length) { state.done = true; refresh(); root.classList.add('won'); hooks.sound?.('open'); setTimeout(() => close(true), 650); return; }
      refresh(); return;
    }
    // A slip: the pick may break; out of picks, the lock wins.
    const broke = state.slip();
    hooks.sound?.(broke ? 'break' : 'slip'); pulse('bad'); state.snap = broke ? .5 : 0;
    root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
    refresh();
    if (state.picks() <= 0) { state.done = true; root.classList.add('lost'); setTimeout(() => close(false), 900); }
  }

  function draw() {
    const s = state, W = canvas.width, c = W / 2;
    g.clearRect(0, 0, W, W);
    // Plate: dark iron disc, a brass rim with rivets.
    g.fillStyle = '#1a1612'; disc(c, c, 68); g.fillStyle = '#6e5122'; ring(c, c, 68, 63); g.fillStyle = '#a07a34'; ring(c, c, 66, 64);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.fillStyle = '#c99d4a'; g.fillRect(Math.round(c + Math.sin(a) * 65.5) - 1, Math.round(c - Math.cos(a) * 65.5) - 1, 2, 2); }
    s.rings.forEach((r, i) => {
      const outer = 58 - i * 9, inner = outer - 6, set = i < s.active, now = i === s.active;
      const base = set ? '#d7a84a' : now ? '#9aa0a8' : '#393c40', edge = set ? '#ffe2a0' : now ? '#e2e6ea' : '#4a4e53';
      g.fillStyle = base; ring(c, c, outer, inner);
      g.fillStyle = edge; ring(c, c, outer, outer - 1);
      // Ticks round the ring, turning with it.
      g.fillStyle = set ? '#8a6420' : '#2c2f33';
      for (let k = 0; k < 16; k++) { const a = r.angle + k / 16 * TAU; px(c + Math.sin(a) * (outer - 3), c - Math.cos(a) * (outer - 3)); }
      // The notch: a dark gap with a bright lip.
      const at = r.angle + r.target, steps = Math.max(3, Math.round(r.notch * outer));
      // The ring being worked shows its notch as a slot of amber light (bright as it passes under the pick).
      const hot = now && inNotch(r);
      for (let k = 0; k <= steps; k++) {
        const a = at - r.notch / 2 + r.notch * k / steps;
        for (let rr = inner; rr < outer; rr++) { g.fillStyle = hot ? (rr === inner || rr === outer - 1 ? '#ffb347' : '#ffe08a') : now ? (rr === inner || rr === outer - 1 ? '#4a2f0a' : '#8a5a16') : '#0d0b09'; px(c + Math.sin(a) * rr, c - Math.cos(a) * rr); }
      }
      if (now) { g.fillStyle = hot ? '#fff6d8' : '#e8c27a'; for (const side of [-1, 1]) { const a = at + side * r.notch / 2; for (let rr = inner - 1; rr <= outer; rr++) px(c + Math.sin(a) * rr, c - Math.cos(a) * rr); } }
    });
    // Keyhole.
    g.fillStyle = '#050403'; disc(c, c - 3, 5); g.fillRect(c - 2, c - 3, 4, 11);
    // The dietrich from twelve o'clock down to the active ring; it jabs in when you set, snaps when it breaks.
    const depth = s.active < s.rings.length ? 58 - s.active * 9 - 3 : 10, jab = s.jab > 0 ? 3 : 0;
    g.fillStyle = '#3b3f45'; g.fillRect(c - 3, 0, 6, 9); g.fillStyle = '#7d848c'; g.fillRect(c - 2, 1, 4, 7);
    if (s.snap > 0) { g.fillStyle = '#b8c0c8'; g.fillRect(c, 9, 1, Math.max(2, (c - depth - 9) * .4)); g.fillStyle = '#e0554a'; px(c + 2, c - depth + 4); px(c - 3, c - depth + 7); }
    else {
      const len = c - depth - 9 + jab;
      g.fillStyle = '#0b0a09'; g.fillRect(c - 2, 9, 4, len + 1);
      g.fillStyle = '#d8dee4'; g.fillRect(c - 1, 9, 2, len); g.fillStyle = '#ffffff'; g.fillRect(c - 1, 9, 1, len);
      g.fillStyle = '#0b0a09'; g.fillRect(c - 2, c - depth + jab - 2, 5, 4); g.fillStyle = '#ffffff'; g.fillRect(c - 1, c - depth + jab - 1, 3, 2);
    }
  }
  const px = (x, y) => g.fillRect(Math.round(x), Math.round(y), 1, 1);
  function disc(x, y, r) { for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); g.fillRect(Math.round(x - w), Math.round(y + yy), w * 2, 1); } }
  function ring(x, y, r0, r1) { for (let yy = -r0; yy <= r0; yy++) for (let xx = -r0; xx <= r0; xx++) { const d = Math.hypot(xx, yy); if (d <= r0 && d > r1) g.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); } }

  function loop(now) {
    if (!state) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const s = state; s.time += dt; s.jab = Math.max(0, s.jab - dt); s.snap = Math.max(0, s.snap - dt);
    const r = s.rings[s.active];
    if (r && !s.done) {
      if (r.flips && (s.flip -= dt) <= 0) { r.dir = -r.dir; s.flip = 1 + Math.random() * 1.6; }
      r.angle += r.dir * r.speed * dt;
    }
    draw();
  }
  function keydown(event) {
    if (!state) return;
    event.stopPropagation();
    if (event.code === 'Escape') { event.preventDefault(); close(false); }
    else if (['Space', 'Enter', 'KeyE'].includes(event.code) && !event.repeat) { event.preventDefault(); attempt(); }
  }
  window.addEventListener('keydown', keydown, true);
  root.querySelector('.lp-stage').addEventListener('pointerdown', e => { e.preventDefault(); attempt(); });
  root.querySelector('.th-close').addEventListener('click', () => close(false));
  return { open, close: () => close(false), attempt, get isOpen() { return !!state; }, state: () => state && { active: state.active, rings: state.rings.length, notch: state.rings[state.active] ? inNotch(state.rings[state.active]) : null } };
}

// ── Pockets: what the mark carries, the chance for each, and their attention rising and falling.
export function createPickpocket(root, hooks) {
  root.className = 'thief-screen pickpocket hidden'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Taschendiebstahl');
  root.innerHTML = `<div class="th-card pp-card">
      <header class="th-head"><small>Taschendiebstahl</small><h2 class="pp-name"></h2><span class="pp-who"></span></header>
      <div class="pp-pulse"><canvas class="pp-wave" width="240" height="40"></canvas><span class="pp-calm"></span></div>
      <ul class="pp-items"></ul>
      <div class="th-row"><span>Diebeskunst</span><b class="pp-skill"></b><span>Verdacht</span><b class="pp-heat"></b></div>
      <p class="th-hint">Greif zu, wenn der Blick abschweift: dann steigt die Chance.<br><span class="desk">Klick / 1–9</span><span class="touch">Tippen</span> · Nehmen &nbsp; <span class="desk">Esc</span><span class="touch">✕</span> · Hand zurückziehen</p>
      <button class="th-close" aria-label="Hand zurückziehen">✕</button>
    </div>`;
  const wave = root.querySelector('.pp-wave'), g = wave.getContext('2d');
  let state = null, raf = 0, last = 0;
  const history = [], SAMPLES = 118;
  /** The mark's calm (1 = looking elsewhere) at a moment: two slow waves and a little unrest. */
  const calmAt = t => Math.max(0, Math.min(1, .52 + Math.sin(t * state.w1 + state.p1) * .32 + Math.sin(t * state.w2 + state.p2) * .16 - state.heat * .12));

  function open(opts) {
    state = { ...opts, time: 0, heat: 0, w1: 1.7 + Math.random() * .9, w2: 3.6 + Math.random() * 1.4, p1: Math.random() * 6, p2: Math.random() * 6 };
    // The last four seconds of attention are already there when the window opens (sampled 30 times a second).
    history.length = 0; for (let i = -SAMPLES; i < 0; i++) history.push(calmAt(i / 30));
    state.sampled = 0;
    root.querySelector('.pp-name').textContent = opts.name;
    root.querySelector('.pp-who').textContent = `${opts.role}${opts.facing ? ' · sieht in deine Richtung' : ' · bemerkt dich nicht'}`;
    root.querySelector('.pp-skill').textContent = opts.skill;
    root.classList.remove('hidden', 'caught'); root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
    list(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    root.focus({ preventScroll: true });
  }
  function close(caught = false) { if (!state) return; const done = state.onDone; state = null; cancelAnimationFrame(raf); root.classList.add('hidden'); done?.(caught); }
  const entries = () => [...(state.pockets.gold > 0 ? [{ id: 'gold', name: `Münzbeutel · ${state.pockets.gold} Gold`, gold: state.pockets.gold, icon: icon('coin') }] : []),
    ...Object.entries(state.pockets.items).map(([id, n]) => { const item = state.item(id); return { id, name: n > 1 ? `${item.name} × ${n}` : item.name, weight: item.weight || .1, value: item.value || 1, icon: icon(typeIcon(item.type)) }; })];
  const chanceOf = (e, calm) => pickpocketChance({ skill: state.skill, perks: state.perks, facing: state.facing, calm, ...(e.gold ? { gold: e.gold, weight: .2, value: 0 } : { weight: e.weight, value: e.value }) }) * (1 - state.heat * .1);
  function list() {
    const calm = calmAt(state.time), items = entries();
    root.querySelector('.pp-items').innerHTML = items.length ? items.map((e, i) => `<li><button data-take="${e.id}"><span class="pp-ico">${e.icon}</span><span class="pp-label">${esc(e.name)}</span><span class="pp-chance" data-id="${e.id}">${Math.round(chanceOf(e, calm) * 100)} %</span><kbd>${i + 1}</kbd></button></li>`).join('')
      : '<li class="pp-empty">Die Taschen sind leer.</li>';
    root.querySelectorAll('[data-take]').forEach(b => b.addEventListener('click', () => take(b.dataset.take)));
    root.querySelector('.pp-heat').textContent = ['keiner', 'leicht', 'wachsend', 'hoch'][Math.min(3, state.heat)];
  }
  function take(id) {
    if (!state) return;
    const e = entries().find(x => x.id === id); if (!e) return;
    const chance = chanceOf(e, calmAt(state.time));
    if (Math.random() < chance) {
      state.give(id); state.heat++;
      hooks.sound?.('take');
      const li = root.querySelector(`[data-take="${id}"]`)?.closest('li'); li?.classList.add('taken');
      setTimeout(() => state && list(), 260);
      return;
    }
    root.classList.add('caught'); hooks.sound?.('caught');
    const done = state; setTimeout(() => { if (state === done) close(true); }, 450);
  }
  function loop(now) {
    if (!state) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; state.time += dt;
    const calm = calmAt(state.time);
    while (state.sampled <= state.time) { history.push(calmAt(state.sampled)); state.sampled += 1 / 30; }
    while (history.length > SAMPLES) history.shift();
    // The wave: the mark's attention over the last seconds, scrolling left; above the line the mark looks away.
    const W = wave.width, H = wave.height, yOf = v => Math.round((1 - v) * (H - 6)) + 3, band = yOf(.7);
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(126, 210, 150, .1)'; g.fillRect(0, 0, W, band);
    g.fillStyle = 'rgba(126, 210, 150, .35)'; for (let x = 0; x < W; x += 4) g.fillRect(x, band, 2, 1);
    let prev = null;
    history.forEach((v, i) => {
      const x = W - 6 - (history.length - 1 - i) * 2, y = yOf(v);
      g.fillStyle = v > .7 ? '#8ee0a6' : v > .4 ? '#e8b44c' : '#e0554a';
      const top = prev === null ? y : Math.min(prev, y), h = prev === null ? 2 : Math.abs(prev - y) + 2;
      g.fillRect(x, top, 2, h); prev = y;
    });
    // Now: a bright bead at the right edge.
    const ny = yOf(calm); g.fillStyle = calm > .7 ? '#d6ffe0' : calm > .4 ? '#ffe6a8' : '#ffb0a6'; g.fillRect(W - 6, ny - 2, 5, 5);
    g.fillStyle = '#0b0d10'; g.fillRect(W - 5, ny - 1, 3, 3); g.fillStyle = calm > .7 ? '#8ee0a6' : calm > .4 ? '#e8b44c' : '#e0554a'; g.fillRect(W - 4, ny, 1, 1);
    const label = root.querySelector('.pp-calm');
    label.textContent = calm > .7 ? 'Schaut weg' : calm > .4 ? 'Unruhig' : 'Wachsam';
    label.className = `pp-calm ${calm > .7 ? 'calm' : calm > .4 ? 'uneasy' : 'alert'}`;
    root.querySelectorAll('.pp-chance').forEach(el => { const e = entries().find(x => x.id === el.dataset.id); if (e) el.textContent = `${Math.round(chanceOf(e, calm) * 100)} %`; });
  }
  function keydown(event) {
    if (!state) return;
    event.stopPropagation();
    if (event.code === 'Escape') { event.preventDefault(); close(false); return; }
    if (/^Digit[1-9]$/.test(event.code)) { const e = entries()[+event.code.at(-1) - 1]; if (e) take(e.id); }
  }
  window.addEventListener('keydown', keydown, true);
  root.querySelector('.th-close').addEventListener('click', () => close(false));
  return { open, close: () => close(false), take, get isOpen() { return !!state; }, calm: () => state ? calmAt(state.time) : 0 };
}

// ── The veil: two brackets round the reticle while sneaking. Far apart and cool when hidden, closing in
// and amber when someone notices, clamped red when you are seen.
export function createStealthMeter(root) {
  root.className = 'stealth-veil'; root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<i class="l"></i><i class="r"></i><span></span>';
  const label = root.querySelector('span');
  let shown = null, smooth = 0;
  return {
    update(dt, sneaking, { state, level }) {
      root.classList.toggle('on', sneaking);
      if (!sneaking) return;
      smooth += (level - smooth) * Math.min(1, dt * 6);
      root.style.setProperty('--k', smooth.toFixed(3));
      if (state !== shown) { shown = state; root.dataset.state = state; label.textContent = { hidden: 'Verborgen', noticed: 'Bemerkt', detected: 'Entdeckt' }[state]; }
    },
  };
}
