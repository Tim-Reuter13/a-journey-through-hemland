// The customs house, seen from above. Columns lead west, rows lead south.
// The cart door opens into the east end of the mess. The south door is barred from inside.
export const VAULT_PLAN = [
  '####...####',
  '.......####',
  '##.#...####',
  '#...##.##..',
  '...........',
  '#...##.##..',
  '##.###..###',
  '#.......###',
  '#...##..###',
];
export const BAY = 4.8;
export const bayAt = (col, row) => ({ x: -350 - col * BAY, z: 150 + (row - 4) * BAY });
export const openBay = (col, row) => VAULT_PLAN[row]?.[col] === '.';
export const BRIDGE = { x: -174, z: 83, halfSpan: 11 };

// The first five persistent actors in main.js predate Bruchwacht. Append these after them.
export const WATCH = [
  { personName: 'Alva', name: 'Alva vom Hohlweg', archer: true, hp: 65, day: [-271, 129], night: [-271, 130], duty: 'beobachtet den Hohlweg' },
  { personName: 'Kuno', name: 'Kuno Torwacht', shield: true, hp: 85, day: [-307, 151.5], night: [-318, 152.2], duty: 'hält Torwache' },
  // The old toll house is a cellar now (data/hemland/zollkeller.js): its people keep the ward above it. Meret at the fire under
  // the north wall, Enno by the stores and the guardroom door, Rike walking between the fire and the inside of the gate
  // (her round has a gap: while she is at the fire the gate side is open).
  { personName: 'Meret', name: 'Meret Kesselflick', hp: 70, day: [-325, 137.4], night: [-327, 138], duty: 'wartet am Herd' },
  { personName: 'Enno', name: 'Enno Kerbholz', archer: true, hp: 75, day: [-343.5, 160.5], night: [-344, 158.5], duty: 'zählt die Lieferungen' },
  { personName: 'Rike', name: 'Rike Eisenhand', shield: true, hp: 90, day: [-318, 146], night: [-320, 150], duty: 'macht die Runde', round: [[-318, 146], [-326, 139], [-318, 154]] },
];

// State lives in ordinary save flags. A failed weighing leaves both settings intact.
export function dial(flags, id) { return flags['bruch_' + id] || 1; }
const notes = {
  memorial: 'An dem Stein hängen schmale Tuchstreifen. „Für Hanne. Wenn der Wagen wiederkommt, soll sie den Weg nach Hause finden.“ Ein jüngerer Streifen ist aus rotem Uniformstoff.',
  cart: 'Zwischen den Fässern steckt ein Frachtzettel. Auf der Vorderseite steht „Korn für Dämmerwald“. Auf der Rückseite hat jemand fünf Namen unter das Wort „Sold“ gesetzt.',
  tally: 'Der alte Zolltarif unter dem Bild ist noch lesbar. Zwei Kerben für einen Wagen Korn, drei für einen Wagen Eisen. Erst beide Zählräder einstellen, dann den Waagbalken vor der Kasse ziehen.',
  bunks: '„Enno schnarcht. Das Dach tropft. Rike hat meinen linken Stiefel geflickt und ihren eigenen noch immer mit Draht zu. Morgen bin ich mit Feuerholz dran.“ Auf der nächsten Seite stehen nur noch Namen.',
  cask: '„Die Krone schuldet uns sieben Winter.“ Jemand hat „sechs“ darübergeschrieben. Darunter, in kleiner Schrift: „Rauk zählt den Winter mit, in dem Silla erfror.“',
};
const caches = {
  roadcache: { item: 'heiltrank', count: 1, text: 'Unter dem Wachstuch liegt ein unversehrter Heiltrank.' },
  stores: { item: 'pfeil', count: 12, text: 'Zwölf trockene Pfeile aus dem versiegelten Köcher genommen.' },
  pay: { item: 'bruchmarke', count: 1, gold: 38, text: '38 Gold und die Tragmarke der Bruchwacht. Die Rückseite trägt Rikes eingeritzte Initialen.' },
};
export function useBruchSpot(id, flags, take) {
  if (notes[id]) return notes[id];
  const flag = 'bruch_' + id;
  if (caches[id]) {
    if (flags[flag]) return 'Leer. Hier hast du schon nachgesehen.';
    if (!take(caches[id])) return 'Dein Gepäck ist zu schwer.';
    flags[flag] = true;
    return caches[id].text;
  }
  if (id === 'grain' || id === 'iron') {
    if (flags.bruch_vault) return 'Das Gegengewicht ist eingerastet.';
    flags[flag] = dial(flags, id) % 3 + 1;
    return (id === 'grain' ? 'Kornrad' : 'Eisenrad') + ' auf ' + flags[flag] + ' von drei Kerben.';
  }
  if (id === 'scale') {
    if (flags.bruch_vault) return 'Der Waagbalken ruht in der Kerbe. Die Soldkammer ist offen.';
    if (dial(flags, 'grain') !== 2 || dial(flags, 'iron') !== 3) return 'Der Balken kippt zurück. Die Kerben stimmen nicht mit dem Zolltarif überein.';
    flags.bruch_vault = true;
    return 'Die Gewichte stehen im Lot. Das Gitter der Soldkammer hebt sich.';
  }
  if (id === 'postern') {
    if (flags.bruch_postern) return 'Die Sackpforte steht offen.';
    flags.bruch_postern = true;
    return 'Der Riegel fällt. Durch die Sackpforte führt der kurze Weg ins Freie.';
  }
}
