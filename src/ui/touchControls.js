// Touch controls for phones and tablets. A stick appears wherever the left thumb lands (push past its
// ring to sprint), the rest of the screen turns the view (two fingers zoom the third-person camera),
// and a small thumb cluster on the right holds the actions. A thumb held on a button can slide to turn
// the view too, so you aim while drawing the bow or holding the guard. Pointer events only; main.js
// decides what each control does through the handlers it passes in.
import { icon } from './inventoryIcons.js';

/** True on devices whose main pointer is a finger (phones, tablets), false with a mouse. */
export function prefersTouch(win = globalThis) {
  const query = q => !!win.matchMedia?.(q).matches;
  return query('(pointer: coarse)') || (win.navigator?.maxTouchPoints > 0 && !query('(pointer: fine)'));
}

/** Stick reading from a thumb offset: x right, y forward, length 0…1 after a dead zone; a thumb pushed
 *  well past the ring sprints. */
export function stickVector(dx, dy, radius, dead = .12) {
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(radius > 0)) return { x: 0, y: 0, mag: 0, sprint: false };
  const raw = Math.min(1, length / radius), mag = raw <= dead ? 0 : (raw - dead) / (1 - dead);
  return { x: dx / length * mag, y: -dy / length * mag, mag, sprint: length > radius * 1.45 };
}

/** Places the cluster: each button sits on a ring round the attack button at a given angle
 *  (180° = left of it, 90° = above). Returns right/bottom offsets in px for a button of `size`. */
export function ringSpot(center, radius, degrees, size) {
  const a = degrees * Math.PI / 180;
  return { right: center.right - Math.cos(a) * radius - size / 2, bottom: center.bottom + Math.sin(a) * radius - size / 2 };
}

// Extra 12×12 pixel glyphs in the style of the inventory icons.
const px = rows => rows.map((row, y) => [...row].map((c, x) => c === '#' ? `M${x} ${y}h1v1H${x}z` : '').join('')).join('');
const GLYPHS = {
  shield: px(['.##########.', '.##########.', '.####..####.', '.###....###.', '.####..####.', '.##########.', '..########..', '..########..', '...######...', '....####....', '.....##.....', '............']),
  jump: px(['.....##.....', '....####....', '...######...', '..########..', '.###.##.###.', '.....##.....', '.....##.....', '.....##.....', '............', '............', '############', '............']),
  use: px(['....##......', '....##......', '....##......', '....######..', '....########', '.##.########', '.###########', '..##########', '...#########', '....#######.', '.....#####..', '............']),
  sneak: px(['............', '............', '............', '#..........#', '.##......##.', '...######...', '..#..##..#..', '.#...##...#.', '............', '............', '............', '............']),
  grab: px(['.#..#..#..#.', '.#..#..#..#.', '.#..#..#..#.', '.##########.', '.##########.', '.##########.', '..########..', '..########..', '...######...', '...######...', '............', '............']),
  eye: px(['............', '............', '...######...', '.##......##.', '#....##....#', '#...####...#', '#...####...#', '#....##....#', '.##......##.', '...######...', '............', '............']),
  pause: px(['............', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '..###..###..', '............']),
  expand: px(['####....####', '#..........#', '#..........#', '#..........#', '............', '............', '............', '............', '#..........#', '#..........#', '#..........#', '####....####']),
};
const art = name => GLYPHS[name]
  ? `<svg viewBox="0 0 12 12" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${GLYPHS[name]}"/></svg>`
  : icon(name);
const TOOL_ICONS = ['sword', 'star', 'potion', 'bow'];
const TOOL_LABELS = ['Schlag', 'Zauber', 'Trinken', 'Bogen'];

// kind: primary/secondary = attack and block (held), hold = a key held while pressed, tap = one key
// press, toggle = latched mode. ring: [ring, angle] round the attack button. Kept to what a fight needs:
// the potion is quickbar slot 3, journal and full screen sit in the pause menu.
const PAD = [
  { id: 'attack', icon: 'sword', label: 'Schlag', kind: 'primary', big: true },
  { id: 'block', icon: 'shield', label: 'Block', kind: 'secondary', ring: [1, 180] },
  { id: 'use', icon: 'use', label: 'Nutzen', kind: 'hold', code: 'KeyE', ring: [1, 135] },
  { id: 'jump', icon: 'jump', label: 'Sprung', kind: 'hold', code: 'Space', ring: [1, 90] },
  { id: 'sneak', icon: 'sneak', label: 'Ducken', kind: 'toggle', ring: [2, 168] },
  { id: 'grab', icon: 'grab', label: 'Packen', kind: 'tap', code: 'KeyG', ring: [2, 118] },
];
const TOP = [
  { id: 'view', icon: 'eye', label: 'Sicht', kind: 'tap', code: 'KeyF' },
  { id: 'inventory', icon: 'bag', label: 'Inventar', kind: 'tap', code: 'KeyI' },
  { id: 'pause', icon: 'pause', label: 'Menü', kind: 'tap', code: 'Escape' },
];
// Buttons a thumb may slide on to turn the view while holding them.
const AIMING = new Set(['primary', 'secondary', 'hold']);

/**
 * @param {HTMLElement} root  empty container, shown as an overlay above the canvas
 * @param {{onKey(code:string, down:boolean):void, onPrimary(down:boolean):void, onSecondary(down:boolean):void,
 *          onLook(dx:number, dy:number):void, onZoom?(delta:number):void}} handlers
 */
export function createTouchControls(root, handlers) {
  const button = b => `<button type="button" class="touch-btn${b.big ? ' big' : ''}" data-touch="${b.id}" aria-label="${b.label}">${art(b.icon)}${b.big ? `<small>${b.label}</small>` : ''}</button>`;
  root.innerHTML = `<div class="touch-zone"></div><div class="touch-stick idle"><i></i></div>
    <div class="touch-top">${TOP.map(button).join('')}</div><div class="touch-pad">${PAD.map(button).join('')}</div>`;
  const zone = root.querySelector('.touch-zone'), stickEl = root.querySelector('.touch-stick'), knob = stickEl.firstElementChild;
  const buttons = new Map([...root.querySelectorAll('[data-touch]')].map(el => [el.dataset.touch, el]));
  const specs = new Map([...PAD, ...TOP].map(b => [b.id, b]));

  const state = { stick: { x: 0, y: 0, mag: 0, sprint: false }, sneak: false, visible: false };
  let stick = null, radius = 56; // { id, x, y } — the stick's base where the thumb landed
  const rest = { x: 0, y: 0 }; // where the idle stick waits, bottom left
  const looks = new Map(); // pointerId → last { x, y }
  let pinch = 0;
  const held = new Map(); // pointerId → { id, x, y, aiming } of the thumb on a button
  let interactLabel = null;

  function layout() {
    const short = Math.min(innerWidth, innerHeight);
    const big = Math.round(Math.max(60, Math.min(88, short * .18))), small = Math.round(Math.max(42, Math.min(58, short * .12)));
    const gap = Math.round(small * .18), inset = Math.round(Math.max(14, short * .04));
    radius = Math.round(Math.max(46, Math.min(74, short * .15)));
    rest.x = Math.round(inset * 2 + radius + 12); rest.y = Math.round(innerHeight - inset * 2 - radius - 12);
    if (!stick) endStick();
    root.style.setProperty('--touch-big', big + 'px'); root.style.setProperty('--touch-small', small + 'px'); root.style.setProperty('--touch-stick', radius * 2 + 'px');
    const center = { right: inset + big / 2, bottom: inset + big / 2 };
    const ring1 = big / 2 + small / 2 + gap * 1.5, rings = { 1: ring1, 2: ring1 + small + gap * 1.2 };
    for (const b of PAD) {
      const el = buttons.get(b.id), size = b.big ? big : small;
      const spot = b.ring ? ringSpot(center, rings[b.ring[0]], b.ring[1], size) : { right: inset, bottom: inset };
      el.style.right = `calc(${Math.round(spot.right)}px + env(safe-area-inset-right))`;
      el.style.bottom = `calc(${Math.round(spot.bottom)}px + env(safe-area-inset-bottom))`;
    }
  }

  function setStick(x, y) {
    state.stick = stickVector(x - stick.x, y - stick.y, radius);
    const length = Math.hypot(x - stick.x, y - stick.y), k = length > radius ? radius / length : 1;
    knob.style.transform = `translate(${(x - stick.x) * k}px, ${(y - stick.y) * k}px)`;
    stickEl.classList.toggle('sprint', state.stick.sprint);
  }
  function endStick() {
    stick = null; state.stick = { x: 0, y: 0, mag: 0, sprint: false };
    stickEl.classList.remove('sprint'); stickEl.classList.add('idle'); knob.style.transform = '';
    stickEl.style.left = rest.x + 'px'; stickEl.style.top = rest.y + 'px';
  }
  const spread = () => { const [a, b] = [...looks.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };

  zone.addEventListener('pointerdown', event => {
    event.preventDefault();
    zone.setPointerCapture?.(event.pointerId);
    if (!stick && event.clientX < innerWidth * .42) {
      // Keep the whole ring on screen even when the thumb lands at the very edge.
      const margin = radius + 8;
      stick = { id: event.pointerId, x: Math.min(Math.max(event.clientX, margin), innerWidth - margin), y: Math.min(Math.max(event.clientY, margin), innerHeight - margin) };
      stickEl.classList.remove('idle'); stickEl.style.left = stick.x + 'px'; stickEl.style.top = stick.y + 'px';
      setStick(event.clientX, event.clientY);
      return;
    }
    looks.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch = spread();
  });
  zone.addEventListener('pointermove', event => {
    if (stick?.id === event.pointerId) { setStick(event.clientX, event.clientY); return; }
    const last = looks.get(event.pointerId); if (!last) return;
    if (looks.size > 1) {
      last.x = event.clientX; last.y = event.clientY;
      const now = spread(); if (pinch && now) handlers.onZoom?.((pinch - now) / 40); pinch = now;
      return;
    }
    handlers.onLook(event.clientX - last.x, event.clientY - last.y);
    last.x = event.clientX; last.y = event.clientY;
  });
  const lift = event => {
    if (stick?.id === event.pointerId) endStick();
    looks.delete(event.pointerId); pinch = spread();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, lift);

  function press(id, down) {
    const b = specs.get(id), el = buttons.get(id);
    if (b.kind === 'toggle') { if (down) { state[id] = !state[id]; el.setAttribute('aria-pressed', String(state[id])); } return; }
    el.classList.toggle('down', down);
    if (b.kind === 'primary') handlers.onPrimary(down);
    else if (b.kind === 'secondary') handlers.onSecondary(down);
    else if (b.kind === 'hold') handlers.onKey(b.code, down);
    else if (b.kind === 'tap' && down) { handlers.onKey(b.code, true); handlers.onKey(b.code, false); }
  }
  for (const el of buttons.values()) {
    el.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      el.setPointerCapture?.(event.pointerId);
      held.set(event.pointerId, { id: el.dataset.touch, x: event.clientX, y: event.clientY, aiming: false }); press(el.dataset.touch, true);
    });
    // Sliding the thumb that holds a button turns the view (after a few pixels, so a tap stays a tap).
    el.addEventListener('pointermove', event => {
      const thumb = held.get(event.pointerId); if (!thumb || !AIMING.has(specs.get(thumb.id).kind)) return;
      const dx = event.clientX - thumb.x, dy = event.clientY - thumb.y;
      if (!thumb.aiming && Math.hypot(dx, dy) < 8) return;
      thumb.aiming = true; thumb.x = event.clientX; thumb.y = event.clientY;
      handlers.onLook(dx, dy);
    });
    const up = event => { const thumb = held.get(event.pointerId); if (!thumb) return; held.delete(event.pointerId); press(thumb.id, false); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, up);
    el.addEventListener('contextmenu', event => event.preventDefault());
  }
  root.addEventListener('contextmenu', event => event.preventDefault());

  /** Lets go of everything: fingers still on the glass no longer steer once the controls hide. */
  function reset() {
    endStick(); looks.clear(); pinch = 0;
    for (const [pointer, thumb] of held) { held.delete(pointer); press(thumb.id, false); }
  }
  addEventListener('resize', layout);
  layout();

  return {
    get stick() { return state.stick; },
    get sneak() { return state.sneak; },
    get visible() { return state.visible; },
    setVisible(on) {
      on = !!on; if (on === state.visible) return;
      state.visible = on; root.hidden = !on;
      if (!on) reset();
    },
    /** The big button shows what it will do with the selected quickbar tool. */
    setTool(index) {
      const el = buttons.get('attack'); if (el.dataset.tool === String(index)) return;
      el.dataset.tool = String(index);
      el.innerHTML = `${art(TOOL_ICONS[index] || 'sword')}<small>${TOOL_LABELS[index] || 'Schlag'}</small>`;
    },
    /** Lights the use button while something can be used, with the action as its name. */
    setInteract(label) {
      label ||= null; if (label === interactLabel) return; interactLabel = label;
      const el = buttons.get('use'); el.classList.toggle('ready', !!label); el.setAttribute('aria-label', label || 'Nutzen');
    },
    setSneak(on) { state.sneak = !!on; buttons.get('sneak').setAttribute('aria-pressed', String(state.sneak)); },
    reset, layout,
  };
}

/** Full screen (and landscape where the browser allows locking it). Needs a user gesture.
 *  `force` true/false only enters/leaves; without it, it toggles. */
export function toggleFullscreen(force) {
  const doc = document, on = !!doc.fullscreenElement;
  if (force === on) return;
  if (on) { doc.exitFullscreen?.().catch(() => {}); return; }
  doc.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}
