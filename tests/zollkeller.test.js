import test from 'node:test';
import assert from 'node:assert/strict';
import { ZOLLKELLER, ZOLL_POSTERN } from '../src/data/hemland/zollkeller.js';
import { CAVES } from '../src/data/goblins/caves.js';
import { SITES } from '../src/world/hemland.js';
import { createHeightfield } from '../src/world/heightfield.js';
import { GOBLIN_STATS } from '../src/systems/goblins.js';
import { GOBLIN_KINDS } from '../src/data/goblins/lore.js';
import { ITEMS } from '../src/systems/items.js';

// The Zollkeller under Bruchwacht: a cave plan in masonry. Every room can be walked to the way caves.js walks a plan, the
// cistern floor has its way back up, the pay room is behind its grille, the postern is at the end of the supply passage.
const ARROWS = { '>': [1, 0], '<': [-1, 0], v: [0, 1], '^': [0, -1] }, FLAT = new Set('.,:~E');
const grids = new Map(ZOLLKELLER.floors.map(f => [f.level, f.grid]));
const ch = (L, i, j) => grids.get(L)?.[j]?.[i] ?? '#';
const walk = c => FLAT.has(c) || c in ARROWS;
const stepOf = (L, i, j) => { const c = ch(L, i, j), d = ARROWS[c]; let k = 0; while (ch(L, i - d[0] * (k + 1), j - d[1] * (k + 1)) === c && k < 5) k++; return k; };
function neighbours(L, i, j, gate = () => false) {
  const c = ch(L, i, j), out = [];
  if (c in ARROWS) { const [di, dj] = ARROWS[c], k = stepOf(L, i, j); out.push(k < 4 ? [L, i + di, j + dj] : [L - 1, i + di, j + dj], [L, i - di, j - dj]); return out; }
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj, n = ch(L, ni, nj);
    if (!(walk(n) || n === 'O') || gate(L, ni, nj)) continue;
    if (n in ARROWS && (ARROWS[n][0] !== di || ARROWS[n][1] !== dj || stepOf(L, ni, nj) !== 0)) continue;
    if (n === 'O') { if (walk(ch(L - 1, ni, nj))) out.push([L - 1, ni, nj]); continue; }
    out.push([L, ni, nj]);
  }
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = ch(L + 1, i - di, j - dj); if (ARROWS[u]?.[0] === di && ARROWS[u]?.[1] === dj && stepOf(L + 1, i - di, j - dj) === 4) out.push([L + 1, i - di, j - dj]); }
  return out;
}
function reach(from, gate) {
  const seen = new Set([from.join()]), todo = [from];
  while (todo.length) for (const n of neighbours(...todo.pop(), gate)) if (!seen.has(n.join())) { seen.add(n.join()); todo.push(n); }
  return e => seen.has([e.level, e.x, e.y].join());
}
const mouth = (() => { for (const [L, g] of grids) for (let j = 0; j < g.length; j++) { const i = g[j].indexOf('E'); if (i >= 0) return [L, i, j]; } })();
const grille = ZOLLKELLER.entities.find(e => e.id === 'soldgitter');

test('the cellar is a cave plan of its own, at the end of the list, with a mouth, a chief and a postern', () => {
  assert.equal(CAVES.at(-1).id, 'zollkeller', 'appended last: save flags use the cave index');
  assert.ok(mouth, 'a mouth');
  assert.ok(ZOLLKELLER.entities.some(e => e.type === 'chief'));
  assert.ok(ZOLLKELLER.entities.some(e => e.type === 'postern'));
  for (const f of ZOLLKELLER.floors) for (const row of f.grid) assert.equal(row.length, f.grid[0].length);
  assert.equal(new Set(ZOLLKELLER.entities.map(e => e.id)).size, ZOLLKELLER.entities.length, 'ids are unique');
});

test('every room and every thing in it can be walked to; the pay room only through its grille', () => {
  const open = reach(mouth), shut = reach(mouth, (L, i, j) => L === grille.level && i === grille.x && j === grille.y);
  for (const e of ZOLLKELLER.entities) {
    if (['torch', 'banner', 'clue'].includes(e.type)) continue;
    assert.ok(open(e), `${e.id} (${e.type}) at ${e.x},${e.y} cannot be reached`);
  }
  for (const id of ['soldkasse', 'soldtruhe']) assert.equal(shut(ZOLLKELLER.entities.find(e => e.id === id)), false, `${id} is open without the tariff`);
  // Whoever falls from the walkway into the cistern can climb out again.
  assert.ok(reach([-1, 24, 10])({ level: mouth[0], x: mouth[1], y: mouth[2] }), 'the cistern floor has no way back up');
  // The tariff: two piers with three notches, the clue says two and three.
  const piers = ZOLLKELLER.entities.filter(e => e.type === 'pillar');
  assert.deepEqual(piers.map(p => p.solution), [1, 2]);
});

test('the band are people with stats, names of their kinds, and armour to loot', () => {
  for (const e of ZOLLKELLER.entities.filter(e => e.type === 'goblin')) {
    assert.ok(GOBLIN_STATS[e.kind]?.human, `${e.id}: ${e.kind} is not one of the band's kinds`);
    assert.ok(GOBLIN_KINDS[e.kind]?.hp > 0);
  }
  assert.ok(ITEMS.zollsiegel, 'the customs seal is an item');
});

test('the stairs are cut into the ward from its level down to the cellar door, and nothing of the cellar stands above', () => {
  const field = createHeightfield(), s = SITES.cave_zoll;
  const b = field.burrows.find(b => b.id === 'cave_zoll');
  assert.ok(b?.stairs);
  const at = u => field.heightAt(s.x + Math.sin(b.facing) * u, s.z + Math.cos(b.facing) * u);
  assert.ok(Math.abs(at(b.length + .6) - 19) < .05, 'the top of the stairs is the ward');
  assert.ok(Math.abs(at(.2) - 14) < .05, 'the landing is five below');
  for (let u = 1.6; u < b.length; u += .3) assert.ok(at(u + .3) >= at(u) - 1e-6, 'the steps only climb');
  assert.ok(!SITES.westmagazin.halfX || SITES.westmagazin.halfX < 12, 'no levelled block for a building above');
  assert.ok(Math.hypot(ZOLL_POSTERN.x - SITES.camp.x, ZOLL_POSTERN.z - SITES.camp.z) < SITES.camp.radius, 'the postern opens in the ward');
});
