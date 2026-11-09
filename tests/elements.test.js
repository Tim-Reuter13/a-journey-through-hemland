import test from 'node:test';
import assert from 'node:assert/strict';
import { AURAS, REACTIONS, applyElement, tickAuras, shatterDamage } from '../src/systems/elements.js';
import { GLYPH_NAMES } from '../src/ui/sigils.js';

test('an element with nothing to meet stays as an aura; the same one only tops it up', () => {
  const auras = {};
  assert.deepEqual(applyElement(auras, 'feuer'), { reaction: null, multiplier: 1, absorbed: null, aura: 'feuer' });
  assert.equal(auras.feuer, 1);
  assert.equal(applyElement(auras, 'feuer', 1.5).reaction, null);
  assert.equal(auras.feuer, 1.5);
  assert.equal(applyElement({}, 'wind').reaction, null, 'wind alone does nothing');
  assert.equal(applyElement({}, 'erde').reaction, null);
  assert.equal(applyElement({ feuer: 1 }, 'feuer', 0).reaction, null);
});

test('pairs react: melt both ways, vaporize, overload, superconduct, frozen, electro-charged, poison pairs', () => {
  const cases = [
    ['eis', 'feuer', 'schmelzen', 2], ['feuer', 'eis', 'schmelzen', 1.5],
    ['nass', 'feuer', 'verdampfen', 1.5], ['feuer', 'nass', 'verdampfen', 2],
    ['blitz', 'feuer', 'ueberladung', 1], ['feuer', 'blitz', 'ueberladung', 1],
    ['blitz', 'eis', 'supraleiter', 1], ['eis', 'blitz', 'supraleiter', 1],
    ['nass', 'eis', 'gefroren', 1], ['eis', 'nass', 'gefroren', 1],
    ['nass', 'blitz', 'elektrisiert', 1], ['blitz', 'nass', 'elektrisiert', 1],
    ['gift', 'feuer', 'schwelbrand', 1], ['gift', 'blitz', 'nervengift', 1.6], ['gift', 'nass', 'faeulnis', 1],
  ];
  for (const [aura, incoming, reaction, multiplier] of cases) {
    const auras = { [aura]: 1 }, r = applyElement(auras, incoming);
    assert.equal(r.reaction, reaction, `${incoming} on ${aura}`);
    assert.equal(r.multiplier, multiplier, `${incoming} on ${aura} multiplier`);
    assert.ok(REACTIONS[reaction].name);
  }
  // Electro-charged keeps both; melt leaves meltwater; the others use the aura up.
  const ec = { nass: 1 }; applyElement(ec, 'blitz'); assert.ok(ec.nass > 0 && ec.blitz > 0);
  const melt = { eis: 1 }; applyElement(melt, 'feuer'); assert.equal(melt.eis, undefined); assert.ok(melt.nass > 0);
  const over = { blitz: 1 }; applyElement(over, 'feuer'); assert.deepEqual(over, {});
});

test('wind swirls and earth crystallises the strongest aura there, and neither stays', () => {
  const auras = { feuer: .4, blitz: 1.2 };
  const r = applyElement(auras, 'wind');
  assert.equal(r.reaction, 'wirbel'); assert.equal(r.absorbed, 'blitz'); assert.ok(auras.blitz < 1.2); assert.equal(auras.wind, undefined);
  const c = applyElement({ eis: 1 }, 'erde');
  assert.equal(c.reaction, 'kristall'); assert.equal(c.absorbed, 'eis');
  assert.equal(applyElement({ gift: 1 }, 'erde').reaction, null, 'poison does not crystallise');
  assert.equal(applyElement({ gift: 1 }, 'wind').absorbed, 'gift', 'but it swirls');
});

test('fire thaws a frozen body with a hard melt; auras fade; every aura and reaction can be drawn', () => {
  const r = applyElement({ eis: 1, nass: 1 }, 'feuer', 1, { frozen: true });
  assert.equal(r.reaction, 'schmelzen'); assert.equal(r.multiplier, 2); assert.equal(r.thaw, true);
  const auras = { feuer: 1, nass: 1 };
  tickAuras(auras, AURAS.feuer.duration * .5); assert.ok(auras.feuer > .45 && auras.feuer < .55);
  tickAuras(auras, AURAS.feuer.duration); assert.equal(auras.feuer, undefined); assert.ok(auras.nass > 0, 'water lasts longer');
  for (const a of Object.values(AURAS)) assert.ok(GLYPH_NAMES.includes(a.glyph), a.glyph);
  for (const [id, r2] of Object.entries(REACTIONS)) assert.ok(r2.name && r2.colors.length && r2.about, id);
  assert.ok(shatterDamage(20, 40) > 20);
});
