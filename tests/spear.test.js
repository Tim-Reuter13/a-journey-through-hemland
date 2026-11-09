import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, outfitFor, INITIAL_MERCHANT } from '../src/systems/items.js';
import { buildSpear, isSpearModel } from '../src/characters/spear.js';
import { createPreviewModel } from '../src/ui/itemPreview.js';
import { SPELLS } from '../src/data/spells.js';
import * as THREE from 'three';

test('the hunting spear is a long-reaching weapon the trader sells, carried without a scabbard', () => {
  const s = ITEMS.jagdspeer;
  assert.equal(s.type, 'weapon'); assert.equal(s.subtype, 'Speer');
  assert.ok(s.reach > 4 && s.damage > 30);
  assert.ok(INITIAL_MERCHANT.stock.jagdspeer >= 1);
  assert.ok(!outfitFor({ weapon: 'jagdspeer' }).parts.includes('scabbard'));
  assert.ok(outfitFor({ weapon: 'rostiges_schwert' }).parts.includes('scabbard'));
  assert.ok(isSpearModel('spear_hunt') && !isSpearModel('sword_guard') && !isSpearModel(undefined));
});

test('the spear model runs up +Y from the hand, longer than a sword, with finite boxes; its preview builds', () => {
  const spear = buildSpear('spear_hunt', () => new THREE.MeshBasicMaterial()); spear.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(spear), size = box.getSize(new THREE.Vector3());
  assert.ok(size.y > 3 && size.y < 3.6, `length ${size.y}`);
  assert.ok(box.min.y < -.8 && box.max.y > 2, 'the hand holds it a third of the way up');
  assert.ok(size.x < .3 && size.z < .2, 'thin');
  spear.traverse(o => { if (o.isMesh) for (const v of o.geometry.attributes.position.array) assert.ok(Number.isFinite(v)); });
  const preview = createPreviewModel({ id: 'jagdspeer', ...ITEMS.jagdspeer }, () => new THREE.MeshBasicMaterial());
  assert.ok(preview.children.length > 8);
});

test('Kettenblitz is a held stream: a small price to start, magicka drained while it pours', () => {
  const k = SPELLS.kettenblitz;
  assert.equal(k.cast, 'channel'); assert.ok(k.drain > 0 && k.cost < 15);
});
