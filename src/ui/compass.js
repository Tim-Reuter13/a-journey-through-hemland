// Import ./compass.css in the game's entry point. Importing this module needs no DOM.
const HALF_FOV = 75;
const wrap = (angle) => ((angle % 360) + 360) % 360;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function headingFromYaw(yaw) {
  return wrap(-finite(yaw) * 180 / Math.PI);
}

export function bearingTo(from, to) {
  const dx = finite(to?.x) - finite(from?.x);
  const dz = finite(to?.z) - finite(from?.z);
  return dx === 0 && dz === 0 ? 0 : wrap(Math.atan2(dx, -dz) * 180 / Math.PI);
}

/** Signed angle a relative to heading b, in [-180, 180). East is positive. */
export function relativeAngle(a, b) {
  return wrap(finite(a) - finite(b) + 180) - 180;
}

/** Pure projection, shared by the UI and tests. Fade from 120 to 180 metres. */
export function projectMarker(heading, position, marker) {
  const angle = relativeAngle(bearingTo(position, marker), heading);
  const distance = Math.hypot(finite(marker?.x) - finite(position?.x), finite(marker?.z) - finite(position?.z));
  const quest = marker?.kind === 'quest';
  const visible = quest || Math.abs(angle) <= HALF_FOV;
  return {
    angle,
    distance,
    fraction: (Math.max(-HALF_FOV, Math.min(HALF_FOV, angle)) + HALF_FOV) / (HALF_FOV * 2),
    opacity: visible ? (quest ? 1 : Math.max(0, Math.min(1, (180 - distance) / 60))) : 0,
  };
}

// Small, fixed pixel masks. Each lit pixel becomes a 1-unit SVG rectangle.
const PIXELS = {
  quest:   ['00011000','00111100','01111110','11111111','01111110','00111100','00011000','00011000'],
  village: ['00011000','00111100','01111110','11111111','01111110','01100110','01100110','01111110'],
  shrine:  ['00011000','00011000','01111110','00011000','00111100','00111100','01111110','11111111'],
  camp:    ['00011000','00011000','00111100','00111100','01100110','01100110','11000011','11111111'],
  tower:   ['11011011','11111111','01111110','01100110','01111110','01100110','01100110','11111111'],
  npc:     ['00111100','00111100','00111100','00011000','01111110','11111111','01111110','01100110'],
};
const LABELS = { quest: 'Quest', village: 'Dorf', shrine: 'Schrein', camp: 'Lager', tower: 'Turm', npc: 'Person' };
const DIRECTIONS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function createIcon(document, kind) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ar-compass__icon');
  PIXELS[kind].forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel !== '1') return;
      const rect = document.createElementNS(SVG_NS, 'rect');
      for (const [key, value] of Object.entries({ x, y, width: 1, height: 1 })) rect.setAttribute(key, String(value));
      svg.append(rect);
    });
  });
  return svg;
}

/**
 * Mount in a dedicated empty HUD element, e.g. <div id="world-compass"></div>.
 * Returns { update, destroy }. Marker ids must be unique and stable.
 * DOM creation happens only at mount / when ids or marker kinds change.
 */
export function createCompass(container) {
  if (!container?.ownerDocument) return { update() {}, destroy() {} };
  const document = container.ownerDocument;
  const root = document.createElement('div');
  root.className = 'ar-compass';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Kompass');
  const track = document.createElement('div');
  track.className = 'ar-compass__track';
  root.append(track);
  container.classList.add('ar-compass-mount');
  container.append(root);
  const ticks = [];
  const elements = new Map();
  let destroyed = false;
  let frame = 0;
  let accessibleHeading = '';
  let width = root.clientWidth || 520;
  const ResizeObserver = document.defaultView?.ResizeObserver;
  const resize = ResizeObserver ? new ResizeObserver((entries) => {
    width = entries[0]?.contentRect.width || width;
  }) : null;
  resize?.observe(root);
  for (let angle = 0; angle < 360; angle += 15) {
    const tick = document.createElement('div');
    const cardinal = angle % 90 === 0;
    const named = angle % 45 === 0;
    tick.className = `ar-compass__tick${named ? ' ar-compass__tick--named' : ''}${cardinal ? ' ar-compass__tick--cardinal' : ''}`;
    tick.textContent = named ? DIRECTIONS[angle / 45] : '';
    tick.setAttribute('aria-hidden', 'true');
    track.append(tick);
    ticks.push({ angle, element: tick });
  }

  function place(element, fraction, opacity) {
    const transform = `translateX(${Math.round(fraction * width * 100) / 100}px) translateX(-50%)`;
    const alpha = String(Math.round(opacity * 1000) / 1000);
    if (element.style.transform !== transform) element.style.transform = transform;
    if (element.style.opacity !== alpha) element.style.opacity = alpha;
  }

  function update(yaw, position, markers = []) {
    if (destroyed) return;
    // Old browsers without ResizeObserver get a throttled layout read.
    if (!resize && frame % 30 === 0) width = root.clientWidth || width;
    frame++;
    const heading = headingFromYaw(yaw);
    const direction = DIRECTIONS[Math.round(heading / 45) % 8];
    if (accessibleHeading !== direction) {
      root.setAttribute('aria-label', `Kompass: ${direction}`);
      accessibleHeading = direction;
    }
    for (const tick of ticks) {
      const delta = relativeAngle(tick.angle, heading);
      place(tick.element, (delta + HALF_FOV) / (2 * HALF_FOV), Math.abs(delta) <= HALF_FOV ? 1 : 0);
    }
    for (const marker of markers ?? []) {
      if (!marker || marker.id == null || !Number.isFinite(marker.x) || !Number.isFinite(marker.z)) continue;
      const kind = Object.hasOwn(PIXELS, marker.kind) ? marker.kind : 'npc';
      let entry = elements.get(marker.id);
      if (entry && entry.kind !== kind) {
        entry.element.remove();
        elements.delete(marker.id);
        entry = null;
      }
      if (!entry) {
        const element = document.createElement('div');
        element.className = `ar-compass__marker ar-compass__marker--${kind}`;
        element.append(createIcon(document, kind));
        const distance = document.createElement('span');
        distance.className = 'ar-compass__distance';
        if (kind === 'quest') element.append(distance);
        track.append(element);
        entry = { element, distance, kind, frame, label: null, metres: null };
        elements.set(marker.id, entry);
      }
      entry.frame = frame;
      const label = String(marker.label ?? LABELS[kind]);
      if (entry.label !== label) {
        entry.element.title = label;
        entry.element.setAttribute('aria-label', label);
        entry.label = label;
      }
      const projection = projectMarker(heading, position, marker);
      // Keep the entire edge-clamped icon and its distance inside the strip.
      const inset = Math.min(32, width / 4);
      const fraction = kind === 'quest'
        ? Math.max(inset / width, Math.min(1 - inset / width, projection.fraction))
        : projection.fraction;
      place(entry.element, fraction, projection.opacity);
      if (kind === 'quest') {
        const metres = `${Math.round(projection.distance)} m`;
        if (entry.metres !== metres) {
          entry.distance.textContent = metres;
          entry.metres = metres;
        }
      }
    }
    for (const [id, entry] of elements) {
      if (entry.frame === frame) continue;
      entry.element.remove();
      elements.delete(id);
    }
  }

  update(0, { x: 0, z: 0 });
  return {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resize?.disconnect();
      elements.clear();
      root.remove();
      container.classList.remove('ar-compass-mount');
    },
  };
}
