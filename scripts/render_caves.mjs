import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CAVES } from '../src/data/goblins/caves.js';
import { validateCaves } from './check_caves.mjs';

const { problems, reports } = validateCaves();
if (problems.length) {
  console.error(`Pläne werden wegen Datenfehlern nicht geschrieben:\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  const output = new URL('../docs/goblin_caves/', import.meta.url);
  const source = await readFile(new URL('../docs/goblin_caves.md', import.meta.url), 'utf8');
  await mkdir(output, { recursive: true });
  const rendered = [];
  for (const cave of CAVES) {
    const svg = renderCave(cave, reports.find(r => r.id === cave.id));
    await writeFile(new URL(`${cave.id}.svg`, output), svg, 'utf8');
    const start = source.indexOf(`## ${cave.name}\n`);
    if (start < 0) throw new Error(`Beschreibung fehlt: ${cave.name}`);
    const end = source.indexOf('\n## ', start + 4);
    rendered.push({ cave, svg, walkthrough: markdown(source.slice(start, end < 0 ? undefined : end)) });
    console.log(`Geschrieben: docs/goblin_caves/${cave.id}.svg`);
  }
  await writeFile(new URL('index.html', output), renderIndex(rendered), 'utf8');
  console.log(`Geschrieben: ${fileURLToPath(new URL('index.html', output))}`);
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function vocabulary() {
  return {
    goblin: ['G', 'Goblin', '#edac79', 'circle'], chief: ['H', 'Häuptling', '#ed8d97', 'diamond'],
    gate: ['T', 'Tor', '#ebbf66', 'bar'], lever: ['L', 'Hebel', '#ebbf66', 'diamond'],
    plate: ['P', 'Druckplatte', '#ebbf66', 'square'], idol: ['I', 'Tragbares Idol', '#ebbf66', 'diamond'],
    socket: ['N', 'Idolnische', '#ebbf66', 'square'], pillar: ['S', 'Zeichensäule', '#ebbf66', 'circle'],
    pillarDoor: ['D', 'Säulenschloss', '#ebbf66', 'diamond'], brazier: ['F', 'Feuerschale', '#ebbf66', 'triangle'],
    brazierDoor: ['D', 'Feuerschloss', '#ebbf66', 'diamond'], chain: ['Z', 'Zugkette', '#ebbf66', 'circle'],
    secret: ['V', 'Verborgener Verschluss', '#ebbf66', 'square'], bridge: ['B', 'Senkbrücke', '#ebbf66', 'bar'],
    clue: ['?', 'Rätselhinweis', '#a6d7dc', 'diamond'], trap: ['!', 'Falle', '#ed8d97', 'triangle'],
    chest: ['K', 'Truhe', '#b2cea2', 'square'], key: ['Q', 'Schlüssel', '#b2cea2', 'diamond'],
    note: ['A', 'Schriftstück', '#a6d7dc', 'square'], cage: ['C', 'Gefangenenkäfig', '#a6d7dc', 'square'],
    fire: ['f', 'Lagerfeuer / Esse', '#b1a598', 'triangle'], torch: ['f', 'Wandfackel', '#b1a598', 'triangle'],
    totem: ['o', 'Totem', '#b1a598', 'diamond'], altar: ['a', 'Altar', '#b1a598', 'square'],
    drums: ['d', 'Trommeln', '#b1a598', 'circle'], bones: ['b', 'Gebeine', '#b1a598', 'diamond'],
    mushrooms: ['m', 'Pilze / Sporen', '#b1a598', 'circle'], cart: ['w', 'Lore', '#b1a598', 'square'],
    rails: ['r', 'Schienen', '#b1a598', 'bar'], banner: ['n', 'Banner', '#b1a598', 'triangle'],
    bedroll: ['s', 'Schlafplatz', '#b1a598', 'square'], crate: ['k', 'Vorratskiste', '#b1a598', 'square'],
  };
}

function label(e) {
  const kinds = { speer: 'Speerträger', dolch: 'Dolchkämpfer', schleicher: 'Lauerer', speier: 'Sporenbalg', wuerger: 'Kettenwürger', brecher: 'Brecher', trommler: 'Trommler' };
  const states = { sleep: 'schläft', sit: 'sitzt', work: 'arbeitet', pray: 'betet', guard: 'wacht', patrol: 'patrouilliert', ambush: 'Hinterhalt' };
  if (e.type === 'goblin') return `${kinds[e.kind]} · ${states[e.state]}`;
  if (e.type === 'chief') return e.name;
  if (e.type === 'chest') return `Truhe, Stufe ${e.tier}${e.locked ? ' · verschlossen' : ''}`;
  if (e.type === 'brazier') return `Feuerschale ${e.label} · Folge ${e.order}`;
  if (e.type === 'pillar') return `Säule · Lösung ${e.symbols[e.solution]}`;
  if (e.type === 'lever' && e.oneWay) return 'Rückweghebel · nur von innen';
  if (e.type === 'note') return e.title;
  return e.label ?? vocabulary()[e.type][1];
}

function detail(e) {
  return [label(e), `Ebene ${e.level}, Zelle (${e.x}, ${e.y})`, e.text, e.prisoner,
    e.targets?.length ? `Öffnet: ${e.targets.join(', ')}` : '', e.needs ? `Benötigt: ${e.needs}` : '',
    e.for ? `Hinweis für: ${e.for}` : '', e.group ? `Gruppe: ${e.group}` : '',
    e.rallyGroups?.length ? `Ruft die Reserven: ${e.rallyGroups.join(', ')}` : '', `Kennung: ${e.id}`].filter(Boolean).join('\n');
}

function icon(shape, x, y, size, color) {
  const common = `fill="${color}" stroke="#151a1d" stroke-width="1"`;
  if (shape === 'circle') return `<circle cx="${x}" cy="${y}" r="${size}" ${common}/>`;
  if (shape === 'diamond') return `<path d="M ${x} ${y - size} l ${size} ${size} l ${-size} ${size} l ${-size} ${-size} Z" ${common}/>`;
  if (shape === 'triangle') return `<path d="M ${x} ${y - size} l ${size} ${size * 2} h ${-size * 2} Z" ${common}/>`;
  return `<rect x="${x - size}" y="${y - (shape === 'bar' ? size / 3 : size)}" width="${size * 2}" height="${shape === 'bar' ? size * 2 / 3 : size * 2}" rx="1" ${common}/>`;
}

function renderCave(c, report) {
  const V = vocabulary(), size = 26, pad = 50, gap = 42, cols = c.floors[0].grid[0].length, rows = c.floors[0].grid.length;
  const mapWidth = cols * size, panelWidth = mapWidth + pad * 2, panelHeight = rows * size;
  const width = c.floors.length * panelWidth + (c.floors.length - 1) * gap + 72;
  const mapY = 218, tableY = mapY + panelHeight + 52;
  const counter = {}, badges = new Map();
  for (const e of c.entities) { const prefix = V[e.type][0]; counter[prefix] = (counter[prefix] ?? 0) + 1; badges.set(e.id, `${prefix}${counter[prefix]}`); }
  const roomCodes = new Map(c.rooms.map((r, i) => [r.id, `R${i + 1}`]));
  const maxRooms = Math.max(...c.floors.map(f => c.rooms.filter(r => r.level === f.level).length));
  const objectY = tableY + 40 + maxRooms * 27;
  const maxEntities = Math.max(...c.floors.map(f => c.entities.filter(e => e.level === f.level).length));
  const legendY = objectY + 38 + Math.ceil(maxEntities / 2) * 27 + 35;
  const usedTypes = [...new Set(c.entities.map(e => e.type))];
  const legendCols = Math.floor((width - 100) / 280);
  const height = legendY + 115 + Math.ceil(usedTypes.length / legendCols) * 32 + 64;
  const titleId = `${c.id}-title`, descId = `${c.id}-desc`;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId} ${descId}">`,
    `<title id="${titleId}">${escape(c.name)} — Grundrisse aller Ebenen</title>`,
    `<desc id="${descId}">${escape(c.summary)} Alle Objekte sind einzeln bezeichnet. Koordinaten beginnen links oben bei null.</desc>`,
    `<style>text{font-family:Segoe UI,Arial,sans-serif;fill:#e7e4db}.muted{fill:#9ca8ac}.small{font-size:13px}.label{font-size:9px;font-weight:700;paint-order:stroke;stroke:#151a1d;stroke-width:2px;stroke-linejoin:round}.room{font-size:12px;fill:#d9d0ae;font-weight:700;paint-order:stroke;stroke:#151a1d;stroke-width:4px}.entity:hover{filter:brightness(1.45)}.index{font-size:16px}</style>`,
    `<rect width="${width}" height="${height}" fill="#11171b"/>`,
    `<text x="48" y="42" font-size="15" letter-spacing="4" class="muted">A JOURNEY THROUGH HEMLAND · HÖHLENATLAS</text>`,
    `<text x="46" y="101" font-size="48" font-weight="700">${escape(c.name)}</text>`,
    `<text x="48" y="136" font-size="19" class="muted">${report.storeys} Ebenen · ${cols} × ${rows} Zellen · ${report.totalGoblins} Goblins + Häuptling · ${report.puzzles} Rätsel · ${report.chests} Truhen · 1 Zelle = 2 × 2 Welteinheiten</text>`];
  const terrain = { '#': '#1d252b', '.': '#67716b', ',': '#716452', ':': '#746e66', '~': '#365e66', O: '#11171b', E: '#779a7e', '=': '#333b42', '>': '#a98f59', '<': '#a98f59', '^': '#a98f59', v: '#a98f59' };
  for (const [fi, floor] of c.floors.entries()) {
    const origin = 36 + fi * (panelWidth + gap), mapX = origin + pad;
    const xy = (x, y) => [mapX + (x + .5) * size, mapY + (y + .5) * size];
    svg.push(`<text x="${origin + 16}" y="184" font-size="26" font-weight="650">${floor.level === 0 ? '0' : '−' + Math.abs(floor.level)} · ${escape(floor.name)}</text>`, `<text x="${origin + panelWidth - 16}" y="184" text-anchor="end" class="small muted">Boden ${floor.level * 7} · N ↑</text>`);
    svg.push(`<rect x="${mapX - 1}" y="${mapY - 1}" width="${mapWidth + 2}" height="${panelHeight + 2}" fill="none" stroke="#626e72"/>`);
    for (let i = 0; i < cols; i += 5) svg.push(`<text x="${mapX + (i + .5) * size}" y="${mapY - 10}" text-anchor="middle" class="small muted">${i}</text>`);
    for (let i = 0; i < rows; i += 5) svg.push(`<text x="${mapX - 12}" y="${mapY + (i + .68) * size}" text-anchor="end" class="small muted">${i}</text>`);
    for (let y = 0; y < floor.grid.length; y++) for (let x = 0; x < cols; x++) {
      const ch = floor.grid[y][x], left = mapX + x * size, top = mapY + y * size, [cx, cy] = xy(x, y);
      svg.push(`<rect x="${left}" y="${top}" width="${size}" height="${size}" fill="${terrain[ch]}" stroke="#11171b" stroke-opacity=".17" stroke-width=".65"/>`);
      if (ch === 'O') svg.push(`<rect x="${left + 2}" y="${top + 2}" width="${size - 4}" height="${size - 4}" fill="none" stroke="#bba1d9" stroke-dasharray="3 2"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="19" fill="#bba1d9">↓</text>`);
      if (ch === '=') svg.push(`<path d="M ${left + 3} ${top + 4} l 19 19 M ${left + 13} ${top + 4} l 9 9" stroke="#7f8a93" stroke-width="1" opacity=".65"/>`);
      if ('><^v'.includes(ch)) svg.push(`<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="22" font-weight="700">${{ '>': '→', '<': '←', '^': '↑', v: '↓' }[ch]}</text>`);
      if (ch === 'E') svg.push(`<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="22" font-weight="700">E</text>`);
    }
    // Room codes occupy unused cells; their full names sit directly beneath each floor.
    const occupied = new Set(c.entities.filter(e => e.level === floor.level).map(e => `${e.x}/${e.y}`));
    for (const r of c.rooms.filter(r => r.level === floor.level)) {
      const candidates = [];
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (!occupied.has(`${x}/${y}`) && !'O=><^vE'.includes(floor.grid[y]?.[x] ?? '#')) candidates.push([x, y]);
      candidates.sort((a, b) => Number(floor.grid[b[1]][b[0]] === '#') - Number(floor.grid[a[1]][a[0]] === '#') || a[1] - b[1] || a[0] - b[0]);
      const [rx, ry] = candidates[0] ?? [r.x0, r.y0], [cx, cy] = xy(rx, ry);
      occupied.add(`${rx}/${ry}`);
      svg.push(`<g><title>${escape(`${r.name}\n${r.purpose}\nDecke ${r.ceiling}; ${r.decor.join(', ')}`)}</title><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="room">${roomCodes.get(r.id)}</text></g>`);
    }
    for (const e of c.entities.filter(e => e.level === floor.level)) {
      if (e.cells) for (const [x, y] of e.cells) {
        const [cx, cy] = xy(x, y);
        if (e.type === 'rails') svg.push(`<path d="M ${cx - 4} ${cy - 13} v 26 M ${cx + 4} ${cy - 13} v 26 M ${cx - 7} ${cy - 5} h 14 M ${cx - 7} ${cy + 5} h 14" stroke="#c4b9a1" stroke-width="1.4"/>`);
        else svg.push(`<rect x="${cx - 11}" y="${cy - 11}" width="22" height="22" fill="${e.type === 'bridge' ? '#a98f59' : '#ebbf66'}" fill-opacity=".16" stroke="#ebbf66" stroke-dasharray="4 3"/>`);
      }
      if (e.type === 'trap') for (const [x, y] of e.trigger) { const [cx, cy] = xy(x, y); svg.push(`<rect x="${cx - 11}" y="${cy - 11}" width="22" height="22" fill="none" stroke="#ed8d97" stroke-dasharray="2 3"/>`); }
      if (e.type === 'gate') { const [cx, cy] = xy(e.x, e.y); const vertical = e.orientation === 'ns'; svg.push(`<path d="M ${cx - (vertical ? 0 : 13)} ${cy - (vertical ? 13 : 0)} l ${vertical ? 0 : 26} ${vertical ? 26 : 0}" stroke="#f4cc75" stroke-width="4"/>`); }
    }
    const perCell = new Map();
    for (const e of c.entities.filter(e => e.level === floor.level)) { const k = `${e.x}/${e.y}`; if (!perCell.has(k)) perCell.set(k, []); perCell.get(k).push(e); }
    for (const residents of perCell.values()) for (const [i, e] of residents.entries()) {
      const [, , color, shape] = V[e.type], [cx, cy] = xy(e.x, e.y);
      const yy = cy + (residents.length > 1 ? (i - (residents.length - 1) / 2) * 12 : 0);
      svg.push(`<g class="entity" data-entity="${escape(e.id)}"><title>${escape(detail(e))}</title>${icon(shape, cx - 9, yy - 2, residents.length > 1 ? 2 : 3, color)}<text x="${cx - 4}" y="${yy + 3}" class="label" style="fill:${color}">${escape(badges.get(e.id))}</text></g>`);
    }
    svg.push(`<text x="${origin + 15}" y="${tableY}" font-size="19" font-weight="700">Räume · Deckenhöhe · Licht</text>`);
    const light = { dark: 'dunkel', dim: 'gedämpft', lit: 'hell' };
    c.rooms.filter(r => r.level === floor.level).forEach((r, i) => svg.push(`<text x="${origin + 15}" y="${tableY + 31 + i * 27}" class="index"><tspan fill="#d9d0ae" font-weight="700">${roomCodes.get(r.id)}</tspan> · ${escape(r.name)} · ${r.ceiling} · ${light[r.light]}</text>`));
    svg.push(`<text x="${origin + 15}" y="${objectY}" font-size="19" font-weight="700">Objekte · Kurzkennung im Raster</text>`);
    c.entities.filter(e => e.level === floor.level).forEach((e, i) => {
      const x = origin + 15 + (i % 2) * (panelWidth / 2), y = objectY + 31 + Math.floor(i / 2) * 27;
      svg.push(`<g><title>${escape(detail(e))}</title>${icon(V[e.type][3], x + 6, y - 5, 5, V[e.type][2])}<text x="${x + 21}" y="${y}" class="index"><tspan fill="${V[e.type][2]}" font-weight="700">${escape(badges.get(e.id))}</tspan> · ${escape(label(e))} <tspan class="muted">(${e.x}, ${e.y})</tspan></text></g>`);
    });
  }
  svg.push(`<path d="M 48 ${legendY - 15} H ${width - 48}" stroke="#455158"/><text x="48" y="${legendY + 13}" font-size="21" font-weight="700">Zeichenerklärung</text>`);
  const samples = [['.', 'Felsboden'], [',', 'Lehm / Guano'], [':', 'Geröll'], ['~', 'Flachwasser'], ['#', 'Fels'], ['O', 'Abwurf ↓'], ['=', 'Treppenkörper'], ['>', 'Treppe abwärts ↔'], ['E', 'Ein- / Ausgang']];
  samples.forEach(([ch, name], i) => { const x = 48 + i * ((width - 96) / samples.length); svg.push(`<rect x="${x}" y="${legendY + 35}" width="22" height="22" fill="${terrain[ch]}" stroke="#7d878d"/><text x="${x + 33}" y="${legendY + 52}" font-size="17">${escape(name)}</text>`); });
  usedTypes.forEach((type, i) => { const x = 48 + (i % legendCols) * 280, y = legendY + 95 + Math.floor(i / legendCols) * 32; svg.push(icon(V[type][3], x + 9, y - 5, 6, V[type][2]), `<text x="${x + 26}" y="${y}" font-size="16">${escape(V[type][0])} · ${escape(V[type][1])}</text>`); });
  svg.push(`<text x="48" y="${height - 25}" font-size="15" class="muted">Geschosshöhe 7 · Pfeile zeigen abwärts, Treppen sind umkehrbar · Abwürfe nur abwärts · Gold = Mechanik · Rot = Gegner / Gefahr · Türkis = Zeugnisse / Gefangene · Grün = Beute</text></svg>`);
  return svg.join('\n');
}

// Only the Markdown constructs used by the authored walkthrough are needed.
// Escaping happens first; no document content is interpreted as raw HTML.
function markdown(text) {
  const inline = value => escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const blocks = text.trim().split(/\r?\n\s*\r?\n/), result = [];
  let inList = false;
  for (const block of blocks) {
    const item = block.match(/^\d+\.\s+([\s\S]*)$/);
    if (item) { if (!inList) { result.push('<ol>'); inList = true; } result.push(`<li>${inline(item[1])}</li>`); continue; }
    if (inList) { result.push('</ol>'); inList = false; }
    const heading = block.match(/^(#{1,3})\s+([^\n]+)$/);
    result.push(heading ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>` : `<p>${inline(block)}</p>`);
  }
  if (inList) result.push('</ol>');
  return result.join('\n');
}

function renderIndex(items) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Höhlenatlas der Ukhai · Hemland</title>
<style>
:root{color-scheme:dark;font-family:Segoe UI,Arial,sans-serif;background:#11171b;color:#e7e4db}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:1680px;margin:auto;padding:32px 40px}header{padding-top:58px}.eyebrow{color:#b3c6bd;letter-spacing:.24em;font-size:12px}h1{font-size:clamp(36px,5vw,70px);letter-spacing:-.04em;margin:14px 0 20px}header p{max-width:760px;color:#aebbbd;line-height:1.7}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}a{color:#e5c78b;text-underline-offset:4px}nav a,button,.download{border:1px solid #4a565d;border-radius:4px;padding:10px 14px;text-decoration:none;background:#1b242a;color:#e7e4db;font:inherit;font-size:14px}button{cursor:pointer}button:hover,nav a:hover{background:#2f3b43}section{margin-bottom:80px;scroll-margin-top:20px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.section-head h2{font-size:30px;margin-bottom:10px}.summary{color:#aebbbd;line-height:1.7;max-width:900px}.controls{display:flex;gap:8px}.map-scroll{overflow:auto;background:#11171b;border:1px solid #455158;border-radius:6px;margin:22px 0 8px;max-height:85vh}.map-scroll svg{display:block;width:100%;height:auto;max-width:none}.map-scroll.detail svg{width:var(--natural-width)}.map-caption{font-size:13px;color:#9ca8ac;line-height:1.5}.walkthrough{max-width:980px;margin:30px auto 0;border-top:1px solid #3b484e;padding-top:16px;font-size:16px;line-height:1.8}.walkthrough h2{font-size:28px}.walkthrough h3{font-size:21px;color:#d9d0ae;margin-top:32px}.walkthrough li{padding-left:8px;margin-bottom:20px}.walkthrough p{color:#c5cece}.walkthrough strong{color:#ebe6d9}code{font-family:Consolas,monospace;color:#e5c78b}footer{border-top:1px solid #3b484e;color:#9ca8ac;font-size:14px;line-height:1.7}@media(max-width:650px){header,main,footer{padding-left:18px;padding-right:18px}.controls{flex-wrap:wrap}.walkthrough{font-size:15px}.map-scroll{max-height:70vh}}
</style></head><body><header><div class="eyebrow">A JOURNEY THROUGH HEMLAND / ENTWURFSATLAS</div><h1>Unter dem Stein.</h1><p>Drei Stämme. Drei Wunden. Sieben Ebenen unter der Aschmark: vom Gedächtnis der Knochensänger über das letzte reine Wasser bis zur königlichen Thronwaage.</p><nav aria-label="Höhlen">${items.map(({ cave: c }) => `<a href="#${c.id}">${escape(c.name)}</a>`).join('')}</nav></header><main>
${items.map(({ cave: c, svg, walkthrough }) => `<section id="${c.id}"><div class="section-head"><h2>${escape(c.name)}</h2><div class="controls"><button type="button" data-view="overview" aria-controls="map-${c.id}" aria-pressed="true">Übersicht</button><button type="button" data-view="detail" aria-controls="map-${c.id}" aria-pressed="false">Details · 100 %</button><a class="download" href="${c.id}.svg" download>SVG speichern</a></div></div><p class="summary">${escape(c.summary)}</p><div class="map-scroll" id="map-${c.id}" tabindex="0" aria-label="Grundriss von ${escape(c.name)}; horizontal und vertikal scrollbar" style="--natural-width:${svg.match(/width="(\d+)"/)[1]}px">${svg}</div><p class="map-caption">Alle Ebenen nebeneinander · Nord ist oben · 1 Zelle = 2 × 2 · Details vergrößern und im Plan scrollen. Objektmarken zeigen beim Darüberfahren Texte und Verknüpfungen. Die Lösungen stehen darunter.</p><article class="walkthrough">${walkthrough}</article></section>`).join('\n')}
</main><footer>Entwurfsdaten für eine spätere Spielintegration. Vier Sondergoblins je Höhle einschließlich Trommler; Häuptlinge zusätzlich. Trommeln rufen vorhandene Reserven. <a href="../goblin_caves.md">Vollständiger Entwurf mit Bau- und Prüfhinweisen</a>.</footer><script>
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const map=document.getElementById(button.getAttribute('aria-controls'));map.classList.toggle('detail',button.dataset.view==='detail');button.parentElement.querySelectorAll('[data-view]').forEach(sibling=>sibling.setAttribute('aria-pressed',String(sibling===button)));}));
</script></body></html>`;
}
