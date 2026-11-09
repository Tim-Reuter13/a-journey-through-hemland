// "Pfade der Glut" — the skill menu. Six paths (data/skillTrees.js) grow as trees of embers out of a glowing
// core: glass gems with pixel sigils, joined by veins that fill with molten light when a node is lit.
// Embers drift up in the path's colour behind it. Mouse, keys (arrows move to the nearest node that way,
// Q/E or 1–6 change the path, Enter lights, K/Esc close) and touch all work.
import { PATHS, canUnlock, findNode } from '../data/skillTrees.js';
import { sigilSvg, glyphPath, emblemPath } from './sigils.js';
import './skillTree.css';

// The tree's own space follows the stage's shape, so the tree fills it on any screen (set by fit()).
let W = 1000, H = 700, CORE_Y = 608, CROWN_Y = 96, SPREAD = 385, NS = 1;
const at = node => ({ x: W / 2 + node.x * SPREAD, y: CORE_Y - node.y * (CORE_Y - CROWN_Y) });
function fit(stage) {
  const r = stage.getBoundingClientRect(), sw = Math.max(320, r.width), sh = Math.max(240, r.height);
  W = Math.min(1000, Math.max(680, sw * 1.18)); H = Math.round(Math.min(1500, Math.max(560, W * sh / sw)));
  W = Math.round(Math.max(W, Math.min(1400, H * sw / sh))); // a short stage: widen to its shape, so the branches spread
  CORE_Y = H - 92; CROWN_Y = 104; SPREAD = Math.min(440, (W - 230) / 2);
  NS = Math.min(sw / W, sh / H) < .7 ? .8 : 1; // drawn small (a phone): smaller gems, so names never touch the row above
}
const RANKS = ['', 'I', 'II', 'III', 'IV'];
const rankOf = node => node.y < .1 ? 0 : node.y < .4 ? 1 : node.y < .65 ? 2 : node.y < .9 ? 3 : 4;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * root: the empty <section> for the menu. hooks: { player(), unlock(id) → bool, close(), sound(kind)?,
 * extras(path) → [[label, value]]?, skillInfo(skill) → { name, level, progress } }.
 */
export function createSkillTree(root, hooks) {
  root.classList.add('skills-screen'); root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Pfade der Glut');
  root.innerHTML = `
    <canvas class="sk-embers" aria-hidden="true"></canvas>
    <header class="sk-head">
      <div class="sk-title"><small>A Journey through Hemland</small><h2>Pfade der Glut</h2></div>
      <div class="sk-level" aria-live="polite">
        <svg class="sk-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/><circle class="sk-ring-fill" cx="22" cy="22" r="19"/></svg>
        <b class="sk-level-n"></b><div><span>Stufe</span><small class="sk-xp"></small></div>
      </div>
      <div class="sk-shards" aria-live="polite"><span class="sk-shard-row"></span><div><b class="sk-shard-n"></b><small>Glutsplitter</small></div></div>
      <button class="sk-close" aria-label="Pfade schließen">×</button>
    </header>
    <nav class="sk-paths" aria-label="Pfade"></nav>
    <main class="sk-stage">
      <svg class="sk-watermark" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path/></svg>
      <svg class="sk-tree" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="group"></svg>
    </main>
    <aside class="sk-detail" aria-live="polite"></aside>
    <footer class="sk-hints">Q · E Pfad wechseln &nbsp;·&nbsp; Pfeile Knoten wählen &nbsp;·&nbsp; Enter Entfachen &nbsp;·&nbsp; K / Esc Schließen</footer>`;
  const $ = s => root.querySelector(s);
  const svg = $('.sk-tree'), canvas = $('.sk-embers'), ctx = canvas.getContext('2d');
  let path = PATHS[0], selected = null, open = false, frame = 0, last = 0, grow = 0, openedAt = 0;
  const embers = [];

  // ── Paths column: a seal per path.
  $('.sk-paths').innerHTML = PATHS.map((p, i) => `<button class="sk-seal" data-path="${p.id}" style="--seal:${p.color};--seal-glow:${p.glow};--i:${i}" aria-label="${p.name}">
      <span class="sk-seal-ring">${sigilSvg(p.emblem, { emblem: true, className: 'sk-seal-emblem' })}</span>
      <span class="sk-seal-text"><b>${p.name}</b><small class="sk-seal-skill"></small><span class="sk-seal-bar"><i></i></span></span>
      <span class="sk-seal-count"></span></button>`).join('');
  root.querySelectorAll('.sk-seal').forEach(b => b.addEventListener('click', () => choosePath(b.dataset.path)));
  $('.sk-close').addEventListener('click', () => hooks.close());

  const player = () => hooks.player();
  const lit = id => id === path.id || player().perks.includes(id);
  const all = () => [{ id: path.id, name: path.title, glyph: null, x: 0, y: 0, from: [], core: true }, ...path.nodes];

  function setTheme() {
    root.style.setProperty('--pc', path.color); root.style.setProperty('--pg', path.glow);
    $('.sk-watermark path').setAttribute('d', emblemPath(path.emblem));
  }
  /** The tree of the current path: veins first (etched groove, lit core, flowing sparks), then gems. */
  function drawTree() {
    fit($('.sk-stage')); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.classList.toggle('compact', NS < 1);
    const nodes = all(), perks = player().perks, points = player().perkPoints;
    let veins = '', gems = '';
    for (const node of nodes) for (const parentId of node.from) {
      const parent = nodes.find(n => n.id === parentId); if (!parent) continue;
      const a = at(parent), b = at(node), mid = (a.y + b.y) / 2;
      const d = `M${a.x} ${a.y} C${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`;
      const on = lit(parent.id) && lit(node.id), reachable = lit(parent.id) && !lit(node.id);
      veins += `<g class="sk-vein ${on ? 'on' : reachable ? 'open' : ''}" data-to="${node.id}" style="--rank:${rankOf(node)}">
        <path class="groove" d="${d}"/><path class="core" d="${d}" pathLength="100"/>${on ? `<path class="flow" d="${d}" pathLength="100"/>` : ''}</g>`;
    }
    for (const node of nodes) {
      const p = at(node), isLit = lit(node.id), check = node.core ? { ok: false } : canUnlock(node.id, perks, Math.max(1, points));
      const state = node.core ? 'core' : isLit ? 'lit' : check.ok ? 'ready' : 'locked';
      const size = (node.core ? 46 : node.capstone ? 40 : 31) * NS, glyph = node.core ? emblemPath(path.emblem) : glyphPath(node.glyph), gsize = node.core ? 16 : 12;
      const scale = (size * (node.core ? 1.15 : 1.05)) / gsize;
      gems += `<g class="sk-node ${state}${node.capstone ? ' capstone' : ''}${node.effect ? ' real' : ''}${selected === node.id ? ' selected' : ''}" data-node="${node.id}" transform="translate(${p.x} ${p.y})" style="--rank:${rankOf(node)}" tabindex="-1" role="button" aria-label="${esc(node.name)}"><g class="sk-gemwrap">
        <circle class="halo" r="${size * 1.75}"/>
        <circle class="orbit" r="${size * 1.32}"/>
        ${node.core ? `<polygon class="gem" points="${octagon(size)}"/>` : `<rect class="gem" x="${-size}" y="${-size}" width="${size * 2}" height="${size * 2}" rx="${size * .18}" transform="rotate(45)"/>`}
        ${node.capstone ? `<rect class="gem-outer" x="${-size - 7}" y="${-size - 7}" width="${size * 2 + 14}" height="${size * 2 + 14}" rx="${size * .22}" transform="rotate(45)"/>` : ''}
        <path class="sigil" d="${glyph}" transform="translate(${-gsize * scale / 2} ${-gsize * scale / 2}) scale(${scale})"/>
        <text class="label" y="${node.capstone ? -size - 34 * NS : size + (node.core ? 34 : 28) * NS}">${esc(node.core ? path.title : node.name)}</text>
      </g></g>`;
    }
    svg.innerHTML = `<defs><radialGradient id="sk-gem-lit" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="var(--pg)"/><stop offset=".55" stop-color="var(--pc)"/><stop offset="1" stop-color="#1a0d06"/></radialGradient>
        <radialGradient id="sk-core-glow"><stop offset="0" stop-color="var(--pg)" stop-opacity=".55"/><stop offset=".5" stop-color="var(--pc)" stop-opacity=".18"/><stop offset="1" stop-color="var(--pc)" stop-opacity="0"/></radialGradient></defs>
      <g class="sk-forge" transform="translate(${W / 2} ${CORE_Y})"><circle r="150" fill="url(#sk-core-glow)"/><circle class="ring r1" r="96"/><circle class="ring r2" r="128"/><circle class="ring r3" r="168"/></g>
      <g class="sk-veins">${veins}</g><g class="sk-gems">${gems}</g>`;
    svg.querySelectorAll('.sk-node').forEach(g => {
      g.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') select(g.dataset.node, false); });
      g.addEventListener('click', () => select(g.dataset.node, false));
      g.addEventListener('dblclick', () => ignite(g.dataset.node));
    });
  }
  const octagon = r => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(' ');

  function drawHeader() {
    const p = player(), need = p.level * 100, k = Math.min(1, p.xp / need);
    $('.sk-level-n').textContent = p.level;
    $('.sk-xp').textContent = `${Math.floor(p.xp)} / ${need} EP`;
    $('.sk-ring-fill').style.strokeDashoffset = String(119.4 * (1 - k));
    $('.sk-shard-n').textContent = p.perkPoints;
    $('.sk-shard-row').innerHTML = Array.from({ length: Math.min(6, p.perkPoints) }, (_, i) => `<i style="--i:${i}"></i>`).join('') || '<i class="spent"></i>';
    root.classList.toggle('has-points', p.perkPoints > 0);
    root.querySelectorAll('.sk-seal').forEach(b => {
      const pp = PATHS.find(x => x.id === b.dataset.path), info = hooks.skillInfo(pp.skill), litCount = pp.nodes.filter(n => p.perks.includes(n.id)).length;
      b.classList.toggle('active', pp === path);
      b.querySelector('.sk-seal-skill').textContent = `${info.name} ${info.level}`;
      b.querySelector('.sk-seal-bar i').style.width = `${Math.round(info.progress * 100)}%`;
      b.querySelector('.sk-seal-count').textContent = `${litCount}/${pp.nodes.length}`;
      b.classList.toggle('can-grow', p.perkPoints > 0 && pp.nodes.some(n => canUnlock(n.id, p.perks, p.perkPoints).ok));
    });
  }
  function drawDetail() {
    const p = player(), info = hooks.skillInfo(path.skill), litCount = path.nodes.filter(n => p.perks.includes(n.id)).length;
    const node = selected && path.nodes.find(n => n.id === selected);
    const extras = (hooks.extras?.(path) || []).map(([l, v]) => `<div class="sk-stat"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');
    let card = '';
    if (node) {
      const isLit = p.perks.includes(node.id), check = canUnlock(node.id, p.perks, p.perkPoints);
      const status = isLit ? ['lit', 'Entfacht'] : check.ok ? ['ready', 'Bereit'] : ['locked', 'Gesperrt'];
      card = `<div class="sk-card ${status[0]}">
        <div class="sk-card-top"><span class="sk-card-gem">${sigilSvg(node.glyph)}</span>
          <div><small>Rang ${RANKS[rankOf(node)]}${node.capstone ? ' · Krone des Pfades' : ''}</small><h3>${esc(node.name)}</h3><span class="sk-chip ${status[0]}">${status[1]}</span></div></div>
        <p class="sk-desc">${esc(node.effect ?? node.desc)}</p>
        ${node.effect ? '<p class="sk-tag real">Wirkt im Spiel</p>' : '<p class="sk-tag">Platzhalter · die Wirkung folgt in einem späteren Kapitel</p>'}
        ${!isLit && !check.ok ? `<p class="sk-need">${esc(check.reason)}</p>` : ''}
        ${isLit ? '' : `<button class="sk-ignite" ${check.ok ? '' : 'disabled'}><span>Entfachen</span><small>1 Glutsplitter</small></button>`}
      </div>`;
    } else card = `<div class="sk-card empty"><p>Wähle einen Knoten, um zu sehen, was er entfacht.</p></div>`;
    $('.sk-detail').innerHTML = `
      <div class="sk-path-head">${sigilSvg(path.emblem, { emblem: true, className: 'sk-path-emblem' })}<div><small>${esc(path.title)}</small><h3>${esc(path.name)}</h3></div></div>
      <p class="sk-motto">„${esc(path.motto)}“</p>
      <p class="sk-about">${esc(path.about)}</p>
      <div class="sk-skill"><div><span>${esc(info.name)}</span><b>${info.level}</b></div><span class="sk-skill-bar"><i style="width:${Math.round(info.progress * 100)}%"></i></span></div>
      <div class="sk-stat"><span>Entfachte Knoten</span><b>${litCount} / ${path.nodes.length}</b></div>${extras}
      ${card}`;
    $('.sk-ignite')?.addEventListener('click', () => ignite(selected));
  }
  function render() { setTheme(); drawTree(); drawHeader(); drawDetail(); }

  function select(id, focus = true) {
    if (!path.nodes.some(n => n.id === id)) return;
    if (selected === id) return;
    selected = id;
    svg.querySelectorAll('.sk-node').forEach(g => g.classList.toggle('selected', g.dataset.node === id));
    drawDetail();
    if (focus) svg.querySelector(`[data-node="${id}"]`)?.focus({ preventScroll: true });
    hooks.sound?.('tick');
  }
  /** The tree grows rank by rank from its core; afterwards redraws (a lit node, a resize) must not replay it. */
  let growTimer = 0;
  function regrow() {
    const stage = $('.sk-stage');
    clearTimeout(growTimer); stage.classList.remove('grow'); void stage.offsetWidth; stage.classList.add('grow');
    growTimer = setTimeout(() => stage.classList.remove('grow'), 1800);
  }
  function choosePath(id) {
    const next = PATHS.find(p => p.id === id); if (!next || next === path) return;
    path = next; selected = path.nodes[0].id;
    regrow(); render(); grow = 1;
    hooks.sound?.('path');
  }
  /** Lights a node: the vein from its parent fills with molten light, the gem flares, embers burst. */
  function ignite(id) {
    const p = player();
    if (!canUnlock(id, p.perks, p.perkPoints).ok || !hooks.unlock(id)) { hooks.sound?.('deny'); root.querySelector('.sk-ignite')?.classList.add('shake'); setTimeout(() => root.querySelector('.sk-ignite')?.classList.remove('shake'), 400); return; }
    clearTimeout(growTimer); $('.sk-stage').classList.remove('grow');
    render();
    const g = svg.querySelector(`[data-node="${id}"]`);
    g?.classList.add('ignite');
    svg.querySelectorAll(`.sk-vein[data-to="${id}"]`).forEach(v => v.classList.add('ignite'));
    $('.sk-shards').classList.remove('pop'); void $('.sk-shards').offsetWidth; $('.sk-shards').classList.add('pop');
    burst(g);
    hooks.sound?.('ignite');
  }

  // ── Embers: drifting up in the path's colour; a burst where a node is lit.
  function resize() {
    const r = root.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr / 2)); canvas.height = Math.max(1, Math.round(r.height * dpr / 2));
  }
  function spawn(x, y, burst = false) {
    if (embers.length > 260) embers.shift();
    const a = Math.random() * Math.PI * 2, s = burst ? 40 + Math.random() * 140 : 0;
    embers.push({ x, y, vx: burst ? Math.cos(a) * s : (Math.random() - .5) * 8, vy: burst ? Math.sin(a) * s - 30 : -(14 + Math.random() * 30), life: 0, max: burst ? .7 + Math.random() * .6 : 4 + Math.random() * 4, size: burst ? 1 + Math.random() * 2 : 1 + Math.random() * 1.6, wob: Math.random() * 6 });
  }
  function burst(g) {
    if (!g) return;
    const b = g.getBoundingClientRect(), r = canvas.getBoundingClientRect(), sx = canvas.width / r.width, sy = canvas.height / r.height;
    const x = (b.left + b.width / 2 - r.left) * sx, y = (b.top + b.height / 2 - r.top) * sy;
    for (let i = 0; i < 70; i++) spawn(x, y, true);
  }
  function loop(now) {
    if (!open) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    const w = canvas.width, h = canvas.height;
    for (let i = 0; i < 2; i++) if (Math.random() < dt * 22) spawn(Math.random() * w, h + 4);
    if (grow > 0) { grow -= dt; for (let i = 0; i < 3; i++) spawn(w * (.42 + Math.random() * .16), h * .92); }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const color = getComputedStyle(root).getPropertyValue('--pg').trim() || '#ffb06a';
    ctx.fillStyle = color;
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]; e.life += dt;
      if (e.life > e.max || e.y < -10) { embers.splice(i, 1); continue; }
      e.wob += dt * 2; e.vx += Math.sin(e.wob) * dt * 6; e.vy *= 1 - dt * .4; e.vy -= dt * 4;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const k = 1 - e.life / e.max;
      ctx.globalAlpha = Math.min(1, k * 1.4) * (.45 + .55 * Math.abs(Math.sin(e.wob * 2.3)));
      const s = Math.max(1, Math.round(e.size * (e.max < 2 ? 1 + k : 1)));
      ctx.fillRect(Math.round(e.x), Math.round(e.y), s, s);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ── Keys: spatial moves between nodes, Q/E or 1–6 for paths, Enter lights.
  function move(dx, dy) {
    const nodes = path.nodes, from = nodes.find(n => n.id === selected) ?? nodes[0];
    let best = null, score = Infinity;
    for (const n of nodes) {
      if (n === from) continue;
      const vx = n.x - from.x, vy = (n.y - from.y) * 1.6, along = vx * dx + vy * dy;
      if (along <= .02) continue;
      const side = Math.abs(vx * dy - vy * dx), s = along + side * 2.2;
      if (s < score) { score = s; best = n; }
    }
    if (best) select(best.id);
  }
  function keydown(event) {
    if (!open) return;
    const k = event.code;
    event.stopPropagation();
    // The key press that opened the menu must not close it again.
    if (k === 'Escape' || k === 'KeyK' && performance.now() - openedAt > 250) { event.preventDefault(); hooks.close(); return; }
    if (k === 'KeyQ' || k === 'PageUp') { choosePath(PATHS[(PATHS.indexOf(path) + PATHS.length - 1) % PATHS.length].id); return; }
    if (k === 'KeyE' || k === 'PageDown' || k === 'Tab') { event.preventDefault(); choosePath(PATHS[(PATHS.indexOf(path) + (event.shiftKey ? PATHS.length - 1 : 1)) % PATHS.length].id); return; }
    if (/^Digit[1-6]$/.test(k)) { choosePath(PATHS[+k.at(-1) - 1].id); return; }
    const dir = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1] }[k];
    if (dir) { event.preventDefault(); move(...dir); return; }
    if (k === 'Enter' || k === 'Space') { event.preventDefault(); if (selected) ignite(selected); }
  }
  window.addEventListener('keydown', keydown, true);
  addEventListener('resize', () => { if (open) { resize(); drawTree(); } });

  return {
    get isOpen() { return open; },
    open(pathId) {
      if (pathId) path = PATHS.find(p => p.id === pathId) ?? path;
      else { const p = player(); path = PATHS.find(pp => p.perkPoints > 0 && pp.nodes.some(n => canUnlock(n.id, p.perks, p.perkPoints).ok)) ?? path; }
      selected = path.nodes.find(n => !player().perks.includes(n.id) && canUnlock(n.id, player().perks, player().perkPoints).ok)?.id ?? path.nodes[0].id;
      open = true; openedAt = performance.now(); root.classList.remove('hidden'); root.hidden = false;
      root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
      regrow(); render(); resize(); grow = 1.4; last = 0;
      cancelAnimationFrame(frame); frame = requestAnimationFrame(loop);
      root.focus({ preventScroll: true });
    },
    close() { open = false; cancelAnimationFrame(frame); embers.length = 0; root.classList.add('hidden'); },
    render, select, choosePath, ignite,
    state: () => ({ open, path: path.id, selected }),
  };
}
export { findNode };
