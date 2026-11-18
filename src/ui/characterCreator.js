import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, normalizeAppearance } from '../characters/appearance.js';
import { ORIGINS, PRESETS, NAME_POOL, originById } from '../data/origins.js';

// Character editor 2.0. Six pages (origin, body, face, marks, hair, name), a card that sums the character up, ready-made
// looks, an undo, and every choice visible on the real model standing in the village square (main.js openCreator).
// Import ./characterCreator.css in the entry point; the helpers also run in Node.
const optionId = option => option && typeof option === 'object' && 'id' in option ? option.id : option;
const wrap = (value, length) => ((value % length) + length) % length;
const luma = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11; };
/** Swatch indices in the order the editor shows them: light to dark. Saves keep the list's own indices. */
export const swatchOrder = colors => colors.map((c, i) => [luma(c), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);

/** Returns an option's id (or a primitive value), preserving null ids. */
export function cycleOption(list, current, step = 1) {
  if (!Array.isArray(list) || !list.length) return current;
  const delta = Number.isFinite(step) ? Math.trunc(step) : 0;
  const index = list.findIndex(option => Object.is(optionId(option), current));
  return optionId(list[index < 0 ? (delta < 0 ? list.length - 1 : 0) : wrap(index + delta, list.length)]);
}

const seeded = seed => {
  let state = 2166136261;
  for (const char of `${typeof seed}:${seed}`) state = Math.imul(state ^ char.codePointAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
};

/** Number/string seeds are repeatable; a function supplies random draws in [0, 1). Scars, paint and marks stay the exception
 *  (the townsfolk use this too): most faces get none. */
export function randomAppearance(seedOrRandom = Math.random) {
  let random = seedOrRandom;
  if (typeof random !== 'function') {
    if (typeof random !== 'string' && !(typeof random === 'number' && Number.isFinite(random))) {
      throw new TypeError('Expected a finite seed, string seed or random function.');
    }
    random = seeded(random);
  }
  const draw = () => { const d = random(); return Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(d) ? d : 0)); };
  const index = list => Math.floor(draw() * list.length);
  const pick = list => optionId(list[index(list)]), o = APPEARANCE_OPTIONS;
  const rare = (list, chance) => draw() < 1 - chance ? optionId(list[0]) : pick(list.slice(1));
  return normalizeAppearance({
    ...DEFAULT_APPEARANCE,
    body: pick(o.bodies), build: pick(o.builds), skin: index(o.skins),
    face: pick(o.faces), eyes: index(o.eyeColors), scar: rare(o.scars, .25),
    hair: pick(o.hairStyles), hairColor: index(o.hairColors), beard: pick(o.beards),
    paint: rare(o.paints, .15), mark: rare(o.marks, .35), height: pick(o.heights),
  });
}

/** A name for the dice: from the pool of the body's names, never the one already there. */
export function randomName(body, current = '', random = Math.random) {
  const pool = (NAME_POOL[body] || NAME_POOL.male).filter(n => n !== current);
  return pool[Math.floor(Math.max(0, Math.min(.9999, random())) * pool.length)];
}

const label = (list, id) => list.find(e => Object.is(optionId(e), id))?.label ?? String(id);
/** One line that sums the character up, e.g. "Söldner · Männlich · Kräftig · Groß". */
export function describe(a) {
  const o = APPEARANCE_OPTIONS;
  return [originById(a.origin).label, label(o.bodies, a.body), label(o.builds, a.build), label(o.heights, a.height)].join(' · ');
}

const TABS = [['origin', 'Herkunft', '✦'], ['body', 'Körper', '♟'], ['face', 'Gesicht', '◉'], ['marks', 'Zeichen', '✕'], ['hair', 'Haare', '≈'], ['name', 'Name', '✎']];
const FACE_TABS = new Set(['face', 'marks', 'hair']);

/** open() publishes the current value. Confirm/cancel close before calling the host. */
export function createCharacterCreator(root, options = {}) {
  if (!root?.ownerDocument) throw new TypeError('A character creator root element is required.');
  const doc = root.ownerDocument, o = APPEARANCE_OPTIONS;
  const initial = normalizeAppearance(options.initial ?? {});
  let value = { ...initial }, opened = false, previousFocus = null, activeTab = 'origin';
  const history = [];
  const prefix = root.id || 'character-creator';
  root.id = prefix;
  root.classList.add('modal', 'hidden', 'ar-creator');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${prefix}-title`);
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="cc-panel">
      <header class="cc-heading"><p class="cc-eyebrow">HEMLAND · DEIN URSPRUNG</p>
        <h2 id="${prefix}-title">Ein neues Schicksal</h2>
      </header>
      <section class="cc-card" aria-live="polite" aria-atomic="true">
        <span class="cc-crest" aria-hidden="true"></span>
        <div><p class="cc-card-name"></p><p class="cc-card-line"></p></div>
      </section>
      <div class="cc-tabs" role="tablist" aria-label="Charakter anpassen"></div>
      <div class="cc-content"></div>
      <footer class="cc-footer">
        <div class="cc-secondary"><button type="button" data-action="undo" title="Strg+Z">↶ Rückgängig</button><button type="button" data-action="random">⚄ Zufällig</button><button type="button" data-action="reset">Zurücksetzen</button></div>
        <button type="button" class="cc-confirm" data-action="confirm">Abenteuer beginnen <span aria-hidden="true">↵</span></button>
        <button type="button" class="cc-cancel" data-action="cancel">Zurück <span aria-hidden="true">[Esc]</span></button>
        <p class="cc-hint">Ziehen: Drehen · Mausrad: Zoom · Tab/Pfeile: Auswahl · Strg+Z: Rückgängig · Enter: Beginnen · Esc: Zurück</p>
      </footer>
    </div>`;
  const tabs = [], panels = [], controls = [];
  const content = root.querySelector('.cc-content'), tablist = root.querySelector('.cc-tabs');
  const card = { crest: root.querySelector('.cc-crest'), name: root.querySelector('.cc-card-name'), line: root.querySelector('.cc-card-line') };
  const undoButton = root.querySelector('[data-action="undo"]');
  function element(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function publish() { options.onChange?.({ ...value }); }
  function update(patch, remember = true) {
    const next = normalizeAppearance({ ...value, ...patch });
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    if (remember) { history.push(value); if (history.length > 60) history.shift(); }
    value = next;
    render();
    publish();
  }
  function selectTab(id, focus = false, notify = true) {
    activeTab = id;
    tabs.forEach(tab => {
      const selected = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.tab !== id; });
    if (notify) {
      options.onFocus?.(FACE_TABS.has(id) ? 'face' : 'body');
      publish();
    }
  }
  for (const [id, text, glyph] of TABS) {
    const tab = element('button', 'cc-tab'), panel = element('div', 'cc-tabpanel');
    tab.append(element('span', 'cc-tab-glyph', glyph), element('span', 'cc-tab-label', text));
    tab.type = 'button'; tab.dataset.tab = id; tab.id = `${prefix}-tab-${id}`;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${prefix}-page-${id}`);
    panel.id = `${prefix}-page-${id}`; panel.dataset.tab = id;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => selectTab(id));
    tabs.push(tab); panels.push(panel); tablist.append(tab); content.append(panel);
  }
  const page = id => panels.find(p => p.dataset.tab === id);
  function field(panel, key, text) {
    const box = element('fieldset', 'cc-field'), legend = element('legend', '', text);
    legend.id = `${prefix}-label-${key}`;
    box.dataset.field = key; box.append(legend); panel.append(box);
    return box;
  }
  // ◀ value ▶ with a row of pips that shows where in the list you are.
  function choice(panel, key, text, list, { when = null, off = '' } = {}) {
    const box = field(panel, key, text), row = element('div', 'cc-choice');
    const output = element('span', 'cc-choice-value'), pips = element('span', 'cc-pips');
    output.setAttribute('aria-live', 'polite'); output.setAttribute('aria-atomic', 'true');
    const move = step => { if (!when || when()) update({ [key]: cycleOption(list, value[key], step) }); };
    const buttons = [];
    for (const [step, glyph, direction] of [[-1, '◀', 'Vorherige Auswahl'], [1, '▶', 'Nächste Auswahl']]) {
      const button = element('button', 'cc-arrow', glyph);
      button.type = 'button'; button.setAttribute('aria-label', `${text}: ${direction}`);
      button.addEventListener('click', () => move(step)); row.append(button); buttons.push(button);
      if (step === -1) { const middle = element('span', 'cc-choice-middle'); middle.append(output, pips); row.append(middle); }
    }
    const dots = list.map((entry, i) => {
      const dot = element('button', 'cc-pip'); dot.type = 'button'; dot.tabIndex = -1;
      dot.setAttribute('aria-label', `${text}: ${entry.label}`); dot.title = entry.label;
      dot.addEventListener('click', () => { if (!when || when()) update({ [key]: optionId(list[i]) }); });
      pips.append(dot); return dot;
    });
    const note = element('p', 'cc-note', off); note.hidden = true;
    box.append(row, note);
    controls.push({ key, box, move, render() {
      const on = !when || when();
      row.classList.toggle('cc-off', !on); note.hidden = on; buttons.forEach(b => { b.disabled = !on; });
      output.textContent = label(list, value[key]);
      dots.forEach((dot, i) => dot.classList.toggle('on', Object.is(optionId(list[i]), value[key])));
    } });
  }
  function swatches(panel, key, text, colors) {
    const box = field(panel, key, text), grid = element('div', 'cc-swatches');
    grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-labelledby', `${prefix}-label-${key}`);
    const order = key === 'eyes' ? colors.map((_, i) => i) : swatchOrder(colors);
    const buttons = [];
    for (const i of order) {
      const button = element('button', 'cc-swatch');
      button.type = 'button'; button.style.setProperty('--cc-swatch', colors[i]);
      button.setAttribute('role', 'radio'); button.setAttribute('aria-label', `${text} ${order.indexOf(i) + 1} von ${colors.length}, ${colors[i]}`);
      button.title = `${text} ${order.indexOf(i) + 1}`;
      button.addEventListener('click', () => update({ [key]: i })); grid.append(button);
      buttons[i] = button;
    }
    box.append(grid);
    controls.push({ key, box, move(step) {
      const i = order[wrap(order.indexOf(value[key]) + step, order.length)];
      update({ [key]: i }); buttons[i].focus();
    }, render() {
      buttons.forEach((button, i) => {
        button.setAttribute('aria-checked', String(value[key] === i));
        button.tabIndex = value[key] === i ? 0 : -1;
      });
    } });
  }

  // ── Origin: ready-made looks, then the past you come from.
  const presetBox = field(page('origin'), 'preset', 'Vorlagen'), presetRow = element('div', 'cc-presets');
  for (const preset of PRESETS) {
    const button = element('button', 'cc-preset');
    button.type = 'button'; button.dataset.preset = preset.id;
    const face = element('span', 'cc-preset-face');
    face.style.setProperty('--skin', o.skins[preset.look.skin]); face.style.setProperty('--hair', o.hairColors[preset.look.hairColor]);
    face.style.setProperty('--eye', o.eyeColors[preset.look.eyes]);
    face.append(element('i', 'cc-preset-hair'), element('i', 'cc-preset-eyes'));
    button.append(face, element('span', 'cc-preset-label', preset.label));
    button.addEventListener('click', () => { update({ ...preset.look, origin: preset.origin }); });
    presetRow.append(button);
  }
  presetBox.append(presetRow);
  const originBox = field(page('origin'), 'origin', 'Herkunft'), originList = element('div', 'cc-origins');
  originList.setAttribute('role', 'radiogroup'); originList.setAttribute('aria-labelledby', `${prefix}-label-origin`);
  const originButtons = ORIGINS.map(origin => {
    const button = element('button', 'cc-origin');
    button.type = 'button'; button.setAttribute('role', 'radio'); button.dataset.origin = origin.id;
    const head = element('span', 'cc-origin-head');
    head.append(element('span', 'cc-origin-crest', origin.crest), element('strong', '', origin.label));
    button.append(head, element('span', 'cc-origin-lore', origin.lore), element('span', 'cc-origin-bonus', origin.bonus));
    button.addEventListener('click', () => update({ origin: origin.id }));
    originList.append(button); return button;
  });
  originBox.append(originList);
  controls.push({ key: 'origin', box: originBox, move(step) {
    const next = ORIGINS[wrap(ORIGINS.findIndex(e => e.id === value.origin) + step, ORIGINS.length)];
    update({ origin: next.id }); originButtons[ORIGINS.indexOf(next)].focus();
  }, render() {
    originButtons.forEach((button, i) => { const on = ORIGINS[i].id === value.origin; button.setAttribute('aria-checked', String(on)); button.tabIndex = on ? 0 : -1; });
  } });

  choice(page('body'), 'body', 'Körper', o.bodies);
  choice(page('body'), 'build', 'Statur', o.builds);
  choice(page('body'), 'height', 'Größe', o.heights);
  swatches(page('body'), 'skin', 'Hautton', o.skins);
  choice(page('face'), 'face', 'Gesichtszüge', o.faces);
  swatches(page('face'), 'eyes', 'Augenfarbe', o.eyeColors);
  choice(page('face'), 'mark', 'Merkmal', o.marks);
  choice(page('marks'), 'scar', 'Narbe', o.scars);
  choice(page('marks'), 'paint', 'Kriegsbemalung', o.paints);
  page('marks').append(element('p', 'cc-note', 'Narben und Farbe erzählen, was hinter dir liegt. Helme und Masken verdecken sie.'));
  choice(page('hair'), 'hair', 'Frisur', o.hairStyles);
  swatches(page('hair'), 'hairColor', 'Haarfarbe', o.hairColors);
  choice(page('hair'), 'beard', 'Bart', o.beards, { when: () => value.body === 'male', off: 'Bärte gibt es nur bei männlichem Körper.' });

  const nameBox = field(page('name'), 'name', 'Dein Name'), nameRow = element('div', 'cc-name-row'), name = element('input', 'cc-name');
  name.type = 'text'; name.maxLength = 24; name.autocomplete = 'off'; name.spellcheck = false;
  name.setAttribute('aria-labelledby', `${prefix}-label-name`);
  name.setAttribute('aria-describedby', `${prefix}-name-hint`);
  name.value = value.name;
  const dice = element('button', 'cc-dice', '⚄'); dice.type = 'button'; dice.title = 'Namen würfeln'; dice.setAttribute('aria-label', 'Namen würfeln');
  dice.addEventListener('click', () => { update({ name: randomName(value.body, value.name) }); name.value = value.name; });
  nameRow.append(name, dice);
  const nameHint = element('p', 'cc-note', 'Bis zu 24 Zeichen. Dein Name wird Teil dieser Welt.');
  nameHint.id = `${prefix}-name-hint`;
  nameBox.append(nameRow, nameHint);
  // Keep the draft intact while typing spaces or clearing the field; callbacks stay normalized.
  name.addEventListener('input', () => update({ name: name.value }, false));
  name.addEventListener('blur', () => { name.value = value.name; });
  function render() {
    controls.forEach(control => control.render());
    const origin = originById(value.origin);
    card.crest.textContent = origin.crest; card.name.textContent = value.name; card.line.textContent = describe(value);
    undoButton.disabled = !history.length;
  }
  function close() {
    if (!opened) return;
    opened = false;
    doc.removeEventListener('keydown', keydown, true);
    doc.removeEventListener('keyup', keyup, true);
    root.classList.add('hidden'); root.hidden = true; root.setAttribute('aria-hidden', 'true');
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function confirm() {
    const result = { ...value };
    close(); options.onConfirm?.(result);
  }
  function cancel() { close(); options.onCancel?.(); }
  function undo() {
    if (!history.length) return;
    value = history.pop(); name.value = value.name; render(); publish();
  }
  const actions = {
    undo,
    random() { update({ ...randomAppearance(), name: value.name, origin: value.origin }); },
    reset() { update(initial); name.value = value.name; },
    confirm, cancel,
  };
  root.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => { if (opened) actions[button.dataset.action](); });
  });
  function focusable() {
    return [...root.querySelectorAll('button, input')].filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden]'));
  }
  function keyup(event) { if (opened) event.stopPropagation(); }
  function keydown(event) {
    if (!opened) return;
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    const focused = doc.activeElement;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && focused !== name) { event.preventDefault(); undo(); return; }
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) (event.key === 'Escape' ? cancel : confirm)();
      return;
    }
    if (event.key === 'Tab') {
      const all = focusable(), index = all.indexOf(focused);
      event.preventDefault();
      all[index < 0 ? (event.shiftKey ? all.length - 1 : 0) : wrap(index + (event.shiftKey ? -1 : 1), all.length)]?.focus();
      return;
    }
    if (focused === name || event.altKey || event.ctrlKey || event.metaKey) return;
    const arrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
    if (!arrow && event.key !== 'Home' && event.key !== 'End') return;
    const tabIndex = tabs.indexOf(focused), step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    if (tabIndex >= 0) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : wrap(tabIndex + step, tabs.length);
      selectTab(tabs[next].dataset.tab, true);
    } else if (arrow) {
      const control = controls.find(entry => entry.box.contains(focused));
      if (control) { event.preventDefault(); control.move(step); }
    }
  }
  selectTab(activeTab, false, false); render();
  return {
    open() {
      if (opened) return;
      previousFocus = doc.activeElement; opened = true;
      root.hidden = false; root.classList.remove('hidden'); root.setAttribute('aria-hidden', 'false');
      doc.addEventListener('keydown', keydown, true); doc.addEventListener('keyup', keyup, true);
      selectTab(activeTab, true);
    },
    close,
    get value() { return { ...value }; },
  };
}
