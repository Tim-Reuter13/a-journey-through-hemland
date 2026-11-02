import { pathToFileURL } from 'node:url';
import { CAVES, CAVE_CELL, CAVE_STOREY } from '../src/data/goblins/caves.js';

// The simulator is conservative: plates need a spare, transportable idol. Opened
// mechanisms latch except plates, whose assigned idol stays in place permanently.
const FLOOR = '.,:~E';
const ARROWS = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
const DIRS = Object.values(ARROWS);
const TYPES = new Set(('goblin chief gate lever plate idol socket pillar pillarDoor brazier brazierDoor chain secret bridge clue trap chest key note cage fire torch totem altar drums bones mushrooms cart rails banner bedroll crate').split(' '));
const KINDS = ['speer', 'dolch', 'schleicher', 'speier', 'wuerger', 'brecher', 'trommler'];
const STATES = ['sleep', 'sit', 'work', 'pray', 'guard', 'patrol', 'ambush'];
const SYMBOLS = ['ohr', 'auge', 'kette', 'pilz', 'knochen', 'mond'];
const key = (l, x, y) => `${l}/${x}/${y}`;
const pos = e => key(e.level, e.x, e.y);
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const pairs = a => Array.isArray(a) && a.length > 0 && a.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger));

export function validateCaves(caves = CAVES) {
  const problems = [], reports = [];
  const error = (c, msg) => problems.push(`${c.id ?? '?'}: ${msg}`);
  if (CAVE_CELL !== 2 || CAVE_STOREY !== 7) problems.push('Rastermaß muss 2 und Geschosshöhe 7 sein.');
  const expected = new Map([['klagende_grube', 'schaedelsaenger'], ['moderhoehle', 'pilzmuetter'], ['eisengrube', 'kettenbrecher']]);
  if (!Array.isArray(caves)) return { problems: ['CAVES muss ein Array sein.'], reports };
  if (caves.length !== 3 || new Set(caves.map(c => c?.id)).size !== 3) problems.push('Genau drei verschiedene Höhlen erforderlich.');
  for (const c of caves) {
    if (!c || typeof c !== 'object') { problems.push('Ungültiger Höhleneintrag.'); continue; }
    const fail = msg => error(c, msg);
    if (expected.get(c.id) !== c.tribe || !expected.has(c.id)) fail('Höhlenkennung oder Stamm falsch.');
    if (!nonempty(c.name) || !nonempty(c.summary)) fail('Name oder Zusammenfassung fehlt.');
    if (!Array.isArray(c.floors) || !Array.isArray(c.entities) || !Array.isArray(c.rooms) || !Array.isArray(c.groups)) { fail('Etagen, Räume, Gruppen oder Objekte fehlen.'); continue; }
    const floors = new Map(c.floors.map(f => [f.level, f]));
    const levels = c.floors.map(f => f.level).sort((a, b) => b - a);
    if (![2, 3].includes(levels.length) || levels.some((l, i) => l !== -i)) fail('Etagen müssen 0, -1 und gegebenenfalls -2 sein.');
    const width = c.floors[0]?.grid?.[0]?.length, height = c.floors[0]?.grid?.length;
    let geometryOK = true;
    if (!(width >= 30 && width <= 48 && height >= 30 && height <= 48)) fail('Raster muss in beiden Richtungen 30–48 Zellen messen.');
    for (const f of c.floors) {
      if (!nonempty(f.name)) fail(`Etage ${f.level}: Name fehlt.`);
      if (!Array.isArray(f.grid) || f.grid.length !== height || f.grid.some(r => typeof r !== 'string' || r.length !== width)) { fail(`Etage ${f.level}: Raster nicht rechteckig oder abweichende Größe.`); geometryOK = false; }
      for (const [y, row] of (Array.isArray(f.grid) ? f.grid : []).entries()) if (typeof row === 'string') for (const [x, ch] of [...row].entries()) if (!'#.,:~OE><^v='.includes(ch)) fail(`Etage ${f.level}, ${x},${y}: unbekanntes Zeichen ${ch}.`);
    }
    if (!geometryOK) continue;
    const cell = (l, x, y) => floors.get(l)?.grid?.[y]?.[x];
    const stand = (l, x, y) => FLOOR.includes(cell(l, x, y) ?? '!');
    const walk = (l, x, y) => stand(l, x, y) || !!ARROWS[cell(l, x, y)];
    const stairEdges = new Map(), coveredBodies = new Set(), stairRuns = [], entrances = [];
    const edge = (a, b) => { if (!stairEdges.has(a)) stairEdges.set(a, new Set()); stairEdges.get(a).add(b); };
    for (const f of c.floors) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const ch = cell(f.level, x, y);
      if (ch === 'E') { entrances.push(key(f.level, x, y)); if (f.level !== 0) fail('E liegt nicht auf Ebene 0.'); }
      if (ch === 'O' && !stand(f.level - 1, x, y)) fail(`Abwurf ${f.level}/${x}/${y}: sichere begehbare Landung fehlt.`);
      if (!ARROWS[ch]) continue;
      const [dx, dy] = ARROWS[ch];
      if (cell(f.level, x - dx, y - dy) === ch) continue;
      let length = 0;
      while (cell(f.level, x + dx * length, y + dy * length) === ch) length++;
      if (length !== 5) fail(`Treppe ${f.level}/${x}/${y}: ${length} statt fünf Pfeile.`);
      if (!stand(f.level, x - dx, y - dy)) fail(`Treppe ${f.level}/${x}/${y}: oberer Antritt fehlt.`);
      if (!stand(f.level - 1, x + dx * length, y + dy * length)) fail(`Treppe ${f.level}/${x}/${y}: unterer Austritt fehlt.`);
      let previous = key(f.level, x - dx, y - dy);
      for (let i = 0; i < length; i++) {
        const xx = x + dx * i, yy = y + dy * i, current = key(f.level, xx, yy);
        if (cell(f.level - 1, xx, yy) !== '=') fail(`Treppe ${f.level}/${xx}/${yy}: Treppenkörper darunter fehlt.`);
        coveredBodies.add(key(f.level - 1, xx, yy));
        edge(previous, current); edge(current, previous); previous = current;
      }
      const landing = key(f.level - 1, x + dx * length, y + dy * length);
      edge(previous, landing); edge(landing, previous);
      stairRuns.push({ level: f.level, x, y, dx, dy, length });
    }
    if (entrances.length !== 1) fail(`Genau ein E erforderlich, gefunden: ${entrances.length}.`);
    for (const f of c.floors) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (cell(f.level, x, y) === '=' && !coveredBodies.has(key(f.level, x, y))) fail(`Verwaister Treppenkörper ${f.level}/${x}/${y}.`);
    const registry = new Map(), entities = new Map(), groups = new Map();
    for (const item of [...c.entities, ...c.rooms, ...c.groups]) {
      if (!nonempty(item.id) || registry.has(item.id)) fail(`Fehlende oder doppelte Kennung: ${item.id}.`);
      registry.set(item.id, item);
    }
    c.entities.forEach(e => entities.set(e.id, e)); c.groups.forEach(g => groups.set(g.id, g));
    for (const g of c.groups) {
      if (!nonempty(g.name) || !['encounter', 'pillar', 'brazier'].includes(g.role)) fail(`Gruppe ${g.id}: ungültige Definition.`);
      if (!c.entities.some(e => e.group === g.id)) fail(`Gruppe ${g.id} hat keine Mitglieder.`);
    }
    for (const r of c.rooms) {
      if (![r.x0, r.y0, r.x1, r.y1, r.ceiling].every(Number.isFinite) || ![r.x0, r.y0, r.x1, r.y1].every(Number.isInteger) || r.x0 < 0 || r.y0 < 0 || r.x1 >= width || r.y1 >= height || r.x0 > r.x1 || r.y0 > r.y1 || !floors.has(r.level)) fail(`Raum ${r.id}: ungültige Grenzen.`);
      if (r.ceiling < 4 || r.ceiling > 9 || !['dark', 'dim', 'lit'].includes(r.light) || !Array.isArray(r.decor) || !nonempty(r.purpose) || !nonempty(r.name)) fail(`Raum ${r.id}: ungültige Raumdaten.`);
    }
    const cellOwners = new Map();
    for (const e of c.entities) {
      if (!TYPES.has(e.type)) fail(`${e.id}: unbekannter Objekttyp ${e.type}.`);
      if (![e.level, e.x, e.y].every(Number.isInteger) || !floors.has(e.level)) fail(`${e.id}: ungültige Position.`);
      if (['secret', 'bridge'].includes(e.type)) {
        if (!pairs(e.cells)) fail(`${e.id}: Zellenliste fehlt oder ist ungültig.`);
        else {
          if (e.x !== e.cells[0][0] || e.y !== e.cells[0][1]) fail(`${e.id}: Anker muss die erste Zelle sein.`);
          for (const [x, y] of e.cells) {
            if (cell(e.level, x, y) !== (e.type === 'secret' ? '#' : 'O')) fail(`${e.id}: falscher Untergrund bei ${x},${y}.`);
            const k = key(e.level, x, y);
            if (cellOwners.has(k)) fail(`${e.id}: überlappende bewegliche Geometrie bei ${k}.`);
            cellOwners.set(k, e.id);
          }
        }
      } else if (!walk(e.level, e.x, e.y)) fail(`${e.id}: steht nicht auf begehbarer Zelle (${pos(e)} = ${cell(e.level, e.x, e.y)}).`);
      for (const prop of ['needs', 'opens', 'key', 'for', 'group']) if (e[prop] !== undefined && !registry.has(e[prop])) fail(`${e.id}.${prop}: unbekannte Referenz ${e[prop]}.`);
      if (e.group !== undefined && !groups.has(e.group)) fail(`${e.id}: group verweist nicht auf eine deklarierte Gruppe.`);
      const targetTypes = { lever: ['gate', 'bridge'], plate: ['gate', 'bridge'], socket: ['gate'], pillarDoor: ['gate'], brazierDoor: ['gate'], chain: ['secret'], bridge: ['gate'] };
      if (targetTypes[e.type] && e.type !== 'bridge' && (!Array.isArray(e.targets) || !e.targets.length)) fail(`${e.id}: Ziele fehlen.`);
      if (e.targets !== undefined) {
        if (!Array.isArray(e.targets)) fail(`${e.id}: targets muss ein Array sein.`);
        else for (const id of e.targets) {
          const target = entities.get(id);
          if (!target) fail(`${e.id}.targets: unbekannte Referenz ${id}.`);
          else if (targetTypes[e.type] && !targetTypes[e.type].includes(target.type)) fail(`${e.id}: ungeeigneter Zieltyp ${target.type}.`);
        }
      }
      if (e.type === 'goblin') {
        if (!KINDS.includes(e.kind) || !STATES.includes(e.state) || groups.get(e.group)?.role !== 'encounter') fail(`${e.id}: ungültige Goblindaten.`);
        if (e.state === 'patrol' && (!pairs(e.patrol) || e.patrol.length < 2)) fail(`${e.id}: Patrouille benötigt mindestens zwei Punkte.`);
        if (e.kind === 'trommler' && (!Array.isArray(e.rallyGroups) || !e.rallyGroups.length)) fail(`${e.id}: Rufgruppen für die Horde fehlen.`);
      }
      if (e.rallyGroups !== undefined) {
        if (!Array.isArray(e.rallyGroups)) fail(`${e.id}: Rufgruppen müssen eine Liste sein.`);
        else for (const id of e.rallyGroups) if (groups.get(id)?.role !== 'encounter') fail(`${e.id}.rallyGroups: unbekannte Kampfgruppe ${id}.`);
      }
      for (const prop of ['patrol', 'trigger', ...(e.type === 'rails' ? ['cells'] : [])]) if (e[prop] !== undefined) {
        if (!pairs(e[prop])) fail(`${e.id}.${prop}: ungültige Zellenliste.`);
        else for (const [x, y] of e[prop]) if (!walk(e.level, x, y)) fail(`${e.id}.${prop}: ${x},${y} ist nicht begehbar.`);
      }
      if (e.type === 'gate' && !['ns', 'ew'].includes(e.orientation)) fail(`${e.id}: ungültige Torausrichtung.`);
      if (['lever', 'torch'].includes(e.type) && !DIRS.some(([dx, dy]) => cell(e.level, e.x + dx, e.y + dy) === '#')) fail(`${e.id}: muss neben einer Felswand stehen.`);
      if (e.type === 'socket' && entities.get(e.needs)?.type !== 'idol') fail(`${e.id}: needs muss ein Idol referenzieren.`);
      if (e.type === 'chief' && groups.get(e.group)?.role !== 'encounter') fail(`${e.id}: Häuptlingsgruppe fehlt.`);
      if (e.type === 'pillar' && (!Array.isArray(e.symbols) || e.symbols.length < 3 || e.symbols.length > 4 || new Set(e.symbols).size !== e.symbols.length || e.symbols.some(s => !SYMBOLS.includes(s)) || ![e.start, e.solution].every(i => Number.isInteger(i) && i >= 0 && i < e.symbols.length) || groups.get(e.group)?.role !== 'pillar')) fail(`${e.id}: ungültige Säulendaten.`);
      if (e.type === 'brazier' && (!Number.isInteger(e.order) || e.order < 1 || groups.get(e.group)?.role !== 'brazier' || !nonempty(e.label))) fail(`${e.id}: ungültige Feuerschale.`);
      if (e.type === 'trap' && (!['spikes', 'logs', 'rocks', 'darts'].includes(e.kind) || !pairs(e.trigger))) fail(`${e.id}: ungültige Falle.`);
      if (e.type === 'chest' && ![1, 2, 3].includes(e.tier)) fail(`${e.id}: ungültige Beutestufe.`);
      if (e.type === 'chest' && e.key !== undefined && (entities.get(e.key)?.type !== 'key' || entities.get(e.key)?.opens !== e.id)) fail(`${e.id}: Schlüsselbeziehung nicht gegenseitig.`);
      if (e.type === 'key' && (entities.get(e.opens)?.type !== 'chest' || entities.get(e.opens)?.key !== e.id)) fail(`${e.id}: verweist nicht auf die zugehörige Truhe.`);
      if (e.type === 'clue' && (!nonempty(e.text) || !e.for)) fail(`${e.id}: Hinweis unvollständig.`);
      if (e.type === 'note' && (!nonempty(e.text) || !nonempty(e.title))) fail(`${e.id}: Schriftstück unvollständig.`);
      if (e.type === 'cage' && !nonempty(e.prisoner)) fail(`${e.id}: Gefangener fehlt.`);
    }
    const clues = c.entities.filter(e => e.type === 'clue');
    const puzzleTriggers = c.entities.filter(e => ['plate', 'socket', 'pillarDoor', 'brazierDoor', 'chain'].includes(e.type) || (e.type === 'lever' && !e.oneWay));
    for (const e of [...puzzleTriggers, ...c.entities.filter(e => e.type === 'lever' && e.oneWay)]) if (!clues.some(cl => cl.for === e.id || (e.group && cl.for === e.group))) fail(`${e.id}: fairer Hinweis fehlt.`);
    if (puzzleTriggers.length < 2 || puzzleTriggers.length > 3) fail(`Zwei bis drei Rätsel erforderlich, gefunden: ${puzzleTriggers.length}.`);
    for (const g of c.groups.filter(g => g.role !== 'encounter')) {
      const pieces = c.entities.filter(e => e.type === g.role && e.group === g.id);
      const doors = c.entities.filter(e => e.type === `${g.role}Door` && e.group === g.id);
      if (pieces.length < 2 || pieces.length > 4 || doors.length !== 1) fail(`${g.id}: zwei bis vier Teile und genau ein Auslöser erforderlich.`);
      const text = clues.filter(cl => cl.for === g.id).map(cl => cl.text).join(' ').toLocaleLowerCase('de');
      if (g.role === 'pillar') for (const p of pieces) if (!text.includes(p.symbols?.[p.solution] ?? '\0')) fail(`${g.id}: Lösungssymbol fehlt im Hinweis.`);
      if (g.role === 'brazier') {
        const sorted = pieces.toSorted((a, b) => a.order - b.order);
        let last = -1;
        sorted.forEach((p, i) => { if (p.order !== i + 1) fail(`${g.id}: Feuerreihenfolge muss lückenlos sein.`); const at = text.indexOf(p.label?.toLocaleLowerCase('de') ?? '\0', last + 1); if (at < 0) fail(`${g.id}: Reihenfolge der Schalen fehlt im Hinweis.`); else last = at; });
      }
    }
    const goblins = c.entities.filter(e => e.type === 'goblin'), chiefs = c.entities.filter(e => e.type === 'chief');
    const counts = Object.fromEntries(KINDS.map(k => [k, goblins.filter(e => e.kind === k).length]));
    if (goblins.length < 12 || goblins.length > 25) fail('12–25 Goblins erforderlich.');
    const specials = goblins.filter(e => !['speer', 'dolch'].includes(e.kind)).length;
    if (specials < 2 || specials > 4 || counts.trommler !== 1) fail('Zwei bis vier Sondergoblins einschließlich genau eines Trommlers erforderlich.');
    if (chiefs.length !== 1) fail('Genau ein Häuptling erforderlich.');
    if (!c.entities.some(e => e.type === 'cage')) fail('Gefangenenkäfig fehlt.');
    for (const state of ['patrol', 'sleep', 'work', 'ambush']) if (!goblins.some(e => e.state === state)) fail(`Begegnungszustand ${state} fehlt.`);
    for (const type of ['note', 'chest', 'drums']) if (!c.entities.some(e => e.type === type)) fail(`${type} fehlt.`);
    for (const e of c.entities.filter(e => ['gate', 'secret', 'bridge'].includes(e.type))) if (!c.entities.some(t => t.targets?.includes(e.id))) fail(`${e.id}: besitzt keinen Auslöser.`);

    const gates = new Map();
    for (const e of c.entities.filter(e => e.type === 'gate')) { if (gates.has(pos(e))) fail(`${e.id}: zwei Tore auf derselben Zelle.`); gates.set(pos(e), e.id); }
    const opened = new Set(), expanded = new Set(), bridged = new Set(), assigned = new Map(), solved = new Set();
    const allowed = k => { const [l, x, y] = k.split('/').map(Number); return !(gates.has(k) && !opened.has(gates.get(k))) && (walk(l, x, y) || cell(l, x, y) === 'O' || expanded.has(k)); };
    function flood(start, onlyLevel) {
      const visited = new Set(), queue = [];
      const add = k => { if (allowed(k) && !visited.has(k) && (onlyLevel === undefined || Number(k.split('/')[0]) === onlyLevel)) { visited.add(k); queue.push(k); } };
      if (start) add(start);
      for (let i = 0; i < queue.length; i++) {
        const k = queue[i], [l, x, y] = k.split('/').map(Number), ch = cell(l, x, y);
        if (ch === 'O' && !bridged.has(k)) { add(key(l - 1, x, y)); continue; }
        for (const next of stairEdges.get(k) ?? []) add(next);
        // Stairs connect only through their endpoints, never through a side wall.
        if (ARROWS[ch]) continue;
        for (const [dx, dy] of DIRS) if (!ARROWS[cell(l, x + dx, y + dy)]) add(key(l, x + dx, y + dy));
      }
      return visited;
    }
    function activate(id) {
      if (opened.has(id)) return;
      opened.add(id);
      const e = entities.get(id);
      if (['secret', 'bridge'].includes(e?.type) && pairs(e.cells)) for (const [x, y] of e.cells) (e.type === 'secret' ? expanded : bridged).add(key(e.level, x, y));
      if (e?.type === 'bridge' && Array.isArray(e.targets)) e.targets.forEach(activate);
    }
    let reachable = flood(entrances[0]);
    const progression = [];
    for (let pass = 0; pass <= c.entities.length; pass++) {
      let changed = false;
      for (const e of c.entities) {
        if (solved.has(e.id) || !['lever', 'plate', 'socket', 'chain', 'pillarDoor', 'brazierDoor'].includes(e.type)) continue;
        let ready = reachable.has(pos(e)), resource;
        if (['pillarDoor', 'brazierDoor'].includes(e.type)) {
          const pieces = c.entities.filter(p => p.group === e.group && p.type === e.type.replace('Door', ''));
          ready = pieces.length >= 2 && pieces.every(p => reachable.has(pos(p)));
        }
        if (ready && ['plate', 'socket'].includes(e.type)) {
          const candidates = c.entities.filter(p => p.type === 'idol' && (!e.needs || p.id === e.needs) && !assigned.has(p.id) && reachable.has(pos(p)));
          resource = candidates.find(p => flood(pos(p)).has(pos(e)));
          ready = !!resource;
        }
        const hint = clues.find(cl => cl.for === e.id || (e.group && cl.for === e.group));
        if (ready && hint && !reachable.has(pos(hint))) { fail(`${e.id}: Hinweis liegt hinter dem eigenen Rätsel.`); }
        if (!ready) continue;
        if (resource) assigned.set(resource.id, e.id);
        solved.add(e.id); (Array.isArray(e.targets) ? e.targets : []).forEach(activate);
        progression.push(e.id); changed = true;
      }
      if (!changed) break;
      reachable = flood(entrances[0]);
    }
    for (const e of c.entities.filter(e => ['chief', 'chest', 'note', 'cage', 'key', 'goblin', 'clue'].includes(e.type))) if (!reachable.has(pos(e))) fail(`${e.id}: nach Lösung aller erreichbaren Mechanismen unerreichbar.`);
    for (const e of puzzleTriggers) if (!solved.has(e.id)) fail(`${e.id}: Rätsel nicht lösbar.`);
    for (const chief of chiefs) if (!flood(pos(chief)).has(entrances[0])) fail('Vom Häuptling führt kein Weg zum Eingang zurück.');
    for (const e of goblins.filter(e => pairs(e.patrol))) {
      const local = flood(pos(e), e.level);
      for (const [x, y] of e.patrol) if (!local.has(key(e.level, x, y))) fail(`${e.id}: Patrouillenpunkt ohne Weg auf derselben Etage.`);
    }
    const shortcuts = c.entities.filter(e => e.type === 'lever' && e.oneWay);
    if (!shortcuts.length) fail('Einseitiger Rückweghebel fehlt.');
    for (const lever of shortcuts) {
      if (!solved.has(lever.id)) fail(`${lever.id}: Rückweghebel unerreichbar.`);
      if (!chiefs.some(ch => ch.level === lever.level && Math.abs(ch.x - lever.x) + Math.abs(ch.y - lever.y) <= 12)) fail(`${lever.id}: Rückweghebel liegt nicht beim Häuptling.`);
      const targetGates = (lever.targets ?? []).map(id => entities.get(id)).filter(e => e?.type === 'gate');
      if (!targetGates.length) fail(`${lever.id}: Rückweg muss ein Tor öffnen.`);
      for (const gate of targetGates) if (c.entities.some(e => e.id !== lever.id && e.targets?.includes(gate.id))) fail(`${gate.id}: Rückwegtor besitzt einen zweiten Öffner.`);
      if (lever.level === 0) fail(`${lever.id}: Rückweghebel muss auf einer tiefen Ebene liegen.`);
      // Each two-cell gate line must actually separate its two passage sides.
      // Test on its own storey so a legitimate multi-storey loop is not a bypass.
      targetGates.forEach(g => opened.delete(g.id));
      for (const gate of targetGates) {
        const [dx, dy] = gate.orientation === 'ns' ? [1, 0] : [0, 1];
        const a = key(gate.level, gate.x - dx, gate.y - dy), b = key(gate.level, gate.x + dx, gate.y + dy);
        if (!allowed(a) || !allowed(b)) fail(`${gate.id}: Tor liegt nicht zwischen zwei Gangseiten.`);
        else if (flood(a, gate.level).has(b)) fail(`${gate.id}: geschlossenes Rückwegtor kann auf derselben Etage umgangen werden.`);
      }
      targetGates.forEach(g => opened.add(g.id));
    }
    reports.push({ id: c.id, name: c.name, width, height, storeys: levels.length, walkable: c.floors.map(f => ({ level: f.level, count: [...f.grid.join('')].filter(ch => FLOOR.includes(ch) || !!ARROWS[ch]).length })), goblins: counts, totalGoblins: goblins.length, specials, puzzles: puzzleTriggers.length, chests: c.entities.filter(e => e.type === 'chest').length, reachable: reachable.size, progression, stairRuns });
  }
  return { problems, reports };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, reports } = validateCaves();
  for (const r of reports) console.log(`${r.name}: ${r.width}×${r.height}, ${r.storeys} Etagen; begehbar ${r.walkable.map(f => `${f.level}: ${f.count}`).join(', ')}; Goblins ${r.totalGoblins} (${Object.entries(r.goblins).map(([k, n]) => `${k} ${n}`).join(', ')}); Rätsel ${r.puzzles}; Truhen ${r.chests}.`);
  if (problems.length) { console.error(`\n${problems.length} Fehler:\n${problems.map(p => `- ${p}`).join('\n')}`); process.exitCode = 1; }
  else console.log('\nAlle Höhlen bestehen die Struktur-, Referenz- und Wegeprüfung.');
}
