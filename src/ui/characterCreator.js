import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, normalizeAppearance } from '../characters/appearance.js';

// Import ./characterCreator.css in the entry point; helpers also run in Node.
const optionId = option => option && typeof option === 'object' && 'id' in option ? option.id : option;
const wrap = (value, length) => ((value % length) + length) % length;

/** Returns an option's id (or a primitive value), preserving null ids. */
export function cycleOption(list, current, step = 1) {
  if (!Array.isArray(list) || !list.length) return current;
  const delta = Number.isFinite(step) ? Math.trunc(step) : 0;
  const index = list.findIndex(option => Object.is(optionId(option), current));
  return optionId(list[index < 0 ? (delta < 0 ? list.length - 1 : 0) : wrap(index + delta, list.length)]);
}

/** Number/string seeds are repeatable; a function supplies random draws in [0, 1). */
export function randomAppearance(seedOrRandom = Math.random) {
  let random = seedOrRandom;
  if (typeof random !== 'function') {
    if (typeof random !== 'string' && !(typeof random === 'number' && Number.isFinite(random))) {
      throw new TypeError('Expected a finite seed, string seed or random function.');
    }
    let state = 2166136261;
    for (const char of `${typeof random}:${random}`) state = Math.imul(state ^ char.codePointAt(0), 16777619) >>> 0;
    random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let n = Math.imul(state ^ (state >>> 15), state | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }
  const index = list => {
    const draw = random();
    return Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(draw) ? draw : 0)) * list.length);
  };
  const pick = list => optionId(list[index(list)]), o = APPEARANCE_OPTIONS;
  return normalizeAppearance({
    ...DEFAULT_APPEARANCE,
    body: pick(o.bodies), build: pick(o.builds), skin: index(o.skins),
    face: pick(o.faces), eyes: index(o.eyeColors), scar: pick([false, true]),
    hair: pick(o.hairStyles), hairColor: index(o.hairColors), beard: pick(o.beards),
  });
}

/** open() publishes the current value. Confirm/cancel close before calling the host. */
export function createCharacterCreator(root, options = {}) {
  if (!root?.ownerDocument) throw new TypeError('A character creator root element is required.');
  const doc = root.ownerDocument, o = APPEARANCE_OPTIONS;
  const initial = normalizeAppearance(options.initial ?? {});
  let value = { ...initial }, opened = false, previousFocus = null, activeTab = 'body';
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
        <p>Gib deiner Geschichte ein Gesicht.</p>
      </header>
      <div class="cc-tabs" role="tablist" aria-label="Charakter anpassen"></div>
      <div class="cc-content"></div>
      <footer class="cc-footer">
        <p class="cc-summary" aria-live="polite" aria-atomic="true"></p>
        <div class="cc-secondary"><button type="button" data-action="random">Zufällig</button><button type="button" data-action="reset">Zurücksetzen</button></div>
        <button type="button" class="cc-confirm" data-action="confirm">Abenteuer beginnen <span aria-hidden="true">↵</span></button>
        <button type="button" class="cc-cancel" data-action="cancel">Zurück <span aria-hidden="true">[Esc]</span></button>
        <p class="cc-hint">Maus ziehen: Drehen · Mausrad: Zoom · Tab: Wechseln · Pfeile: Auswahl<br>Leertaste: Bedienen · Enter: Beginnen · Esc: Zurück</p>
      </footer>
    </div>`;
  const tabs = [], panels = [], controls = [];
  const content = root.querySelector('.cc-content'), tablist = root.querySelector('.cc-tabs');
  const summary = root.querySelector('.cc-summary');
  function element(tag, className, text) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function publish() { options.onChange?.({ ...value }); }
  function update(patch) {
    value = normalizeAppearance({ ...value, ...patch });
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
      options.onFocus?.(id === 'body' || id === 'name' ? 'body' : 'face');
      publish();
    }
  }
  for (const [id, label] of [['body', 'Körper'], ['face', 'Gesicht'], ['hair', 'Haare'], ['name', 'Name']]) {
    const tab = element('button', 'cc-tab', label), panel = element('div', 'cc-tabpanel');
    tab.type = 'button'; tab.dataset.tab = id; tab.id = `${prefix}-tab-${id}`;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${prefix}-page-${id}`);
    panel.id = `${prefix}-page-${id}`; panel.dataset.tab = id;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => selectTab(id));
    tabs.push(tab); panels.push(panel); tablist.append(tab); content.append(panel);
  }
  function field(panel, key, label) {
    const box = element('fieldset', 'cc-field'), legend = element('legend', '', label);
    legend.id = `${prefix}-label-${key}`;
    box.dataset.field = key; box.append(legend); panel.append(box);
    return box;
  }
  function choice(panel, key, label, list) {
    const box = field(panel, key, label), row = element('div', 'cc-choice');
    const output = element('span', 'cc-choice-value');
    output.setAttribute('aria-live', 'polite'); output.setAttribute('aria-atomic', 'true');
    const move = step => update({ [key]: cycleOption(list, value[key], step) });
    for (const [step, glyph, direction] of [[-1, '◀', 'Vorherige Auswahl'], [1, '▶', 'Nächste Auswahl']]) {
      const button = element('button', 'cc-arrow', glyph);
      button.type = 'button'; button.setAttribute('aria-label', `${label}: ${direction}`);
      button.addEventListener('click', () => move(step)); row.append(button);
      if (step === -1) row.append(output);
    }
    box.append(row);
    controls.push({ key, box, move, render() {
      const item = list.find(entry => Object.is(optionId(entry), value[key]));
      output.textContent = item?.label ?? String(value[key]);
    } });
  }
  function swatches(panel, key, label, colors) {
    const box = field(panel, key, label), grid = element('div', 'cc-swatches');
    grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-labelledby', `${prefix}-label-${key}`);
    const buttons = colors.map((color, i) => {
      const button = element('button', 'cc-swatch');
      button.type = 'button'; button.style.setProperty('--cc-swatch', color);
      button.setAttribute('role', 'radio'); button.setAttribute('aria-label', `${label} ${i + 1} von ${colors.length}, ${color}`);
      button.title = `${label} ${i + 1}`;
      button.addEventListener('click', () => update({ [key]: i })); grid.append(button);
      return button;
    });
    box.append(grid);
    controls.push({ key, box, move(step) {
      const i = wrap(value[key] + step, colors.length);
      update({ [key]: i }); buttons[i].focus();
    }, render() {
      buttons.forEach((button, i) => {
        button.setAttribute('aria-checked', String(value[key] === i));
        button.tabIndex = value[key] === i ? 0 : -1;
        button.textContent = value[key] === i ? '✓' : '';
      });
    } });
  }
  choice(panels[0], 'body', 'Körper', o.bodies);
  choice(panels[0], 'build', 'Statur', o.builds);
  swatches(panels[0], 'skin', 'Hautton', o.skins);
  choice(panels[1], 'face', 'Gesichtszüge', o.faces);
  swatches(panels[1], 'eyes', 'Augenfarbe', o.eyeColors);
  choice(panels[1], 'scar', 'Narbe', [{ id: false, label: 'Ohne Narbe' }, { id: true, label: 'Mit Narbe' }]);
  choice(panels[2], 'hair', 'Frisur', o.hairStyles);
  swatches(panels[2], 'hairColor', 'Haarfarbe', o.hairColors);
  // Respect the external normalizer, including older versions rejecting null beard ids.
  const beards = o.beards.filter(entry => normalizeAppearance({ ...initial, beard: entry.id }).beard === entry.id);
  choice(panels[2], 'beard', 'Bart', beards);
  if (beards.length !== o.beards.length) panels[2].append(element('p', 'cc-note', 'Bart „Keiner“ ist derzeit nicht verfügbar.'));
  const nameBox = field(panels[3], 'name', 'Dein Name'), name = element('input', 'cc-name');
  name.type = 'text'; name.maxLength = 24; name.autocomplete = 'off'; name.spellcheck = false;
  name.setAttribute('aria-labelledby', `${prefix}-label-name`);
  name.setAttribute('aria-describedby', `${prefix}-name-hint`);
  name.value = value.name;
  const nameHint = element('p', 'cc-note', 'Bis zu 24 Zeichen. Dein Name wird Teil dieser Welt.');
  nameHint.id = `${prefix}-name-hint`;
  nameBox.append(name, nameHint);
  // Keep the draft intact while typing spaces or clearing the field; callbacks stay normalized.
  name.addEventListener('input', () => update({ name: name.value }));
  name.addEventListener('blur', () => { name.value = value.name; });
  function render() {
    controls.forEach(control => control.render());
    summary.textContent = value.name;
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
  const actions = {
    random() { update({ ...randomAppearance(), name: value.name }); name.value = value.name; },
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
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) (event.key === 'Escape' ? cancel : confirm)();
      return;
    }
    const focused = doc.activeElement;
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
