// The six paths of the wanderer ("Pfade der Glut", ui/skillTree.js). Each path is a tree that grows up from
// its core: nodes in four ranks, joined by veins (`from`: any one lit parent opens a node). Perk points
// from levelling light a node. Positions are in the tree's own space: x −1..1 across, y 0 (core) .. 1 (crown).
// `effect` marks nodes that already work in the game; the rest are placeholders whose effect comes later.
export const PATHS = [
  { id: 'krieger', name: 'Krieger', title: 'Pfad der Klinge', skill: 'sword', color: '#e2603f', glow: '#ff9b6b', emblem: 'krieger',
    motto: 'Wer zuerst zweifelt, fällt zuerst.', about: 'Stahl, Standhaftigkeit und der Mut, den ersten Hieb zu führen.',
    nodes: [
      { id: 'schwertmeister', name: 'Schwertmeister', glyph: 'sword', x: -.42, y: .27, from: ['krieger'], effect: '+12 Nahkampfschaden.' },
      { id: 'eisernes_herz', name: 'Eisernes Herz', glyph: 'heart', x: .42, y: .27, from: ['krieger'], effect: '+30 maximale Lebenspunkte.' },
      { id: 'klingenwall', name: 'Klingenwall', glyph: 'shield', x: -.72, y: .52, from: ['schwertmeister'], desc: 'Blocken kostet weniger Ausdauer, Konter kommen schneller.' },
      { id: 'sturmlauf', name: 'Sturmlauf', glyph: 'charge', x: -.2, y: .54, from: ['schwertmeister'], desc: 'Ein Angriff aus dem Sprint, der Gegner von den Füßen holt.' },
      { id: 'ruestungstraeger', name: 'Rüstungsträger', glyph: 'armor', x: .55, y: .52, from: ['eisernes_herz'], desc: 'Schwere Rüstung wiegt weniger und bremst dich kaum.' },
      { id: 'kriegsschrei', name: 'Kriegsschrei', glyph: 'shout', x: -.45, y: .77, from: ['klingenwall', 'sturmlauf'], desc: 'Ein Schrei, unter dem schwache Feinde wanken.' },
      { id: 'unbeugsam', name: 'Unbeugsam', glyph: 'fist', x: .38, y: .77, from: ['ruestungstraeger'], desc: 'Unter einem Fünftel Leben schlägst du härter zu.' },
      { id: 'meister_der_klinge', name: 'Meister der Klinge', glyph: 'crown', x: 0, y: .97, from: ['kriegsschrei', 'unbeugsam'], capstone: true, desc: 'Jeder dritte Hieb einer Folge bricht durch jede Deckung.' },
    ] },
  { id: 'magier', name: 'Magier', title: 'Pfad der Glut', skill: 'magic', color: '#5c9ae8', glow: '#9cc4ff', emblem: 'magier',
    motto: 'Das Feuer gehorcht nur dem, der es fürchtet.', about: 'Funken, Asche und die alten Worte, die Glut zu Waffen machen.',
    nodes: [
      { id: 'arkaner_fokus', name: 'Arkaner Fokus', glyph: 'flame', x: -.42, y: .27, from: ['magier'], effect: '+15 Magieschaden.' },
      { id: 'tiefer_brunnen', name: 'Tiefer Brunnen', glyph: 'drop', x: .42, y: .27, from: ['magier'], desc: 'Deine Magicka reicht weiter.' },
      { id: 'funkenregen', name: 'Funkenregen', glyph: 'spark', x: -.7, y: .53, from: ['arkaner_fokus'], desc: 'Funken teilen sich im Flug in drei Glutkugeln.' },
      { id: 'glutschild', name: 'Glutschild', glyph: 'ward', x: -.18, y: .53, from: ['arkaner_fokus'], desc: 'Ein Kreis aus Glut fängt Pfeile ab.' },
      { id: 'ruhiger_geist', name: 'Ruhiger Geist', glyph: 'moon', x: .52, y: .53, from: ['tiefer_brunnen'], desc: 'Magicka kehrt schneller zurück, solange du nicht kämpfst.' },
      { id: 'flammenwelle', name: 'Flammenwelle', glyph: 'wave', x: -.42, y: .77, from: ['funkenregen', 'glutschild'], desc: 'Eine Welle aus Feuer rollt vor dir über den Boden.' },
      { id: 'aschensturm', name: 'Aschensturm', glyph: 'swirl', x: .38, y: .77, from: ['ruhiger_geist'], desc: 'Ein Wirbel aus Asche nimmt Feinden die Sicht.' },
      { id: 'erzmagier', name: 'Erzmagier der Glut', glyph: 'star', x: 0, y: .97, from: ['flammenwelle', 'aschensturm'], capstone: true, desc: 'Die letzte Glut antwortet auf deinen Ruf.' },
    ] },
  { id: 'assassine', name: 'Assassine', title: 'Pfad des Schattens', skill: 'sneak', color: '#9a86d6', glow: '#c7b8ff', emblem: 'assassine',
    motto: 'Der beste Hieb ist der, den niemand kommen sah.', about: 'Schatten, Stille und Klingen, die aus dem Dunkel treffen.',
    nodes: [
      { id: 'meuchelstoss', name: 'Meuchelstoß', glyph: 'dagger', x: -.42, y: .27, from: ['assassine'], effect: 'Hiebe aus dem Verborgenen treffen dreifach statt doppelt.' },
      { id: 'leiser_schritt', name: 'Leiser Schritt', glyph: 'foot', x: .42, y: .27, from: ['assassine'], effect: 'Schleichend machst du nur halb so viel Lärm.' },
      { id: 'schattenblick', name: 'Schattenblick', glyph: 'eye', x: -.72, y: .53, from: ['meuchelstoss'], desc: 'Du spürst, wer dich gleich bemerken wird.' },
      { id: 'giftklinge', name: 'Giftklinge', glyph: 'vial', x: -.22, y: .53, from: ['meuchelstoss'], desc: 'Klingen mit Gift bestreichen, das langsam wirkt.' },
      { id: 'meisterschuetze', name: 'Meisterschütze', glyph: 'bow', x: .3, y: .53, from: ['leiser_schritt'], effect: '+12 Bogenschaden.' },
      { id: 'ruhige_hand', name: 'Ruhige Hand', glyph: 'hand', x: .74, y: .53, from: ['leiser_schritt'], effect: 'Bogen 30 % schneller gespannt, kein Zittern bei Erschöpfung.' },
      { id: 'totenstille', name: 'Totenstille', glyph: 'skull', x: -.42, y: .77, from: ['schattenblick', 'giftklinge'], desc: 'Wer aus dem Schatten fällt, schreit nicht mehr.' },
      { id: 'schattenfuerst', name: 'Fürst der Schatten', glyph: 'moon', x: .08, y: .97, from: ['totenstille', 'meisterschuetze'], capstone: true, desc: 'Steht man still im Dunkel, verliert man dich aus den Augen.' },
    ] },
  { id: 'dieb', name: 'Dieb', title: 'Pfad der flinken Hand', skill: 'thievery', color: '#e8b44c', glow: '#ffd98a', emblem: 'dieb',
    motto: 'Was niemand vermisst, hat nie jemandem gehört.', about: 'Dietriche, Taschen und das Geschäft danach.',
    nodes: [
      { id: 'flinke_finger', name: 'Flinke Finger', glyph: 'hand', x: -.42, y: .27, from: ['dieb'], effect: '+15 % Erfolg beim Taschendiebstahl.' },
      { id: 'feine_dietriche', name: 'Feine Dietriche', glyph: 'key', x: .42, y: .27, from: ['dieb'], effect: 'Die Kerben jedes Schlosses sind breiter.' },
      { id: 'taschenkenner', name: 'Taschenkenner', glyph: 'eye', x: -.72, y: .53, from: ['flinke_finger'], desc: 'Du ahnst, was jemand bei sich trägt, bevor du zugreifst.' },
      { id: 'schwere_beute', name: 'Schwere Beute', glyph: 'bag', x: -.22, y: .53, from: ['flinke_finger'], desc: 'Auch Schweres verschwindet unbemerkt aus Taschen.' },
      { id: 'unzerbrechlich', name: 'Unzerbrechlich', glyph: 'pick', x: .5, y: .53, from: ['feine_dietriche'], effect: 'Ein abgerutschter Dietrich bricht nur in zwei von drei Fällen.' },
      { id: 'nachtwandler', name: 'Nachtwandler', glyph: 'moon', x: -.45, y: .77, from: ['taschenkenner', 'schwere_beute'], desc: 'Nachts bist du für alle schwerer zu sehen.' },
      { id: 'haendlerzunge', name: 'Händlerzunge', glyph: 'coin', x: .4, y: .77, from: ['unzerbrechlich'], desc: 'Hehler zahlen mehr für Diebesgut.' },
      { id: 'meisterdieb', name: 'Meisterdieb', glyph: 'crown', x: 0, y: .97, from: ['nachtwandler', 'haendlerzunge'], capstone: true, desc: 'Kein Schloss in Hemland hält dich auf.' },
    ] },
  { id: 'schmied', name: 'Schmied', title: 'Pfad des Ambosses', skill: 'smithing', color: '#e8833a', glow: '#ffb27a', emblem: 'schmied',
    motto: 'Gutes Eisen erzählt die Wahrheit.', about: 'Esse, Hammer und Stahl, der länger hält als sein Träger.',
    nodes: [
      { id: 'funkenschlag', name: 'Funkenschlag', glyph: 'hammer', x: -.42, y: .27, from: ['schmied'], desc: 'Waffen und Werkzeug aus Eisen schmieden.' },
      { id: 'lederkunde', name: 'Lederkunde', glyph: 'needle', x: .42, y: .27, from: ['schmied'], desc: 'Felle gerben, Leder schneiden und vernähen.' },
      { id: 'haertung', name: 'Härtung', glyph: 'flame', x: -.7, y: .53, from: ['funkenschlag'], desc: 'Gehärtete Klingen schlagen tiefer.' },
      { id: 'feinschliff', name: 'Feinschliff', glyph: 'gem', x: -.2, y: .53, from: ['funkenschlag'], desc: 'Am Schleifstein Waffen schärfen, die du trägst.' },
      { id: 'ringpanzer', name: 'Ringpanzer', glyph: 'chain', x: .5, y: .53, from: ['lederkunde'], desc: 'Kettenhemden flechten und flicken.' },
      { id: 'stahlmeister', name: 'Stahlmeister', glyph: 'anvil', x: -.44, y: .77, from: ['haertung', 'feinschliff'], desc: 'Stahl statt Eisen: leichter, härter, teurer.' },
      { id: 'glutstahl', name: 'Glutstahl', glyph: 'ember', x: .38, y: .77, from: ['ringpanzer'], desc: 'Mit der letzten Glut gehärteter Stahl, der nie ganz erkaltet.' },
      { id: 'meisterschmied', name: 'Meisterschmied', glyph: 'crown', x: 0, y: .97, from: ['stahlmeister', 'glutstahl'], capstone: true, desc: 'Was du schmiedest, trägt deinen Namen.' },
    ] },
  { id: 'hexer', name: 'Hexer', title: 'Pfad des Banns', skill: 'witchcraft', color: '#7cc46a', glow: '#b8f29e', emblem: 'hexer',
    motto: 'Jede Macht verlangt ihren Preis. Meist zahlt ihn ein anderer.', about: 'Flüche, Bannzeichen und Pakte, über die man nicht spricht.',
    nodes: [
      { id: 'bannzeichen', name: 'Bannzeichen', glyph: 'rune', x: -.42, y: .27, from: ['hexer'], desc: 'Zeichen in den Boden ritzen, die Feinde festhalten.' },
      { id: 'blutpakt', name: 'Blutpakt', glyph: 'drop', x: .42, y: .27, from: ['hexer'], desc: 'Leben gegen Macht tauschen.' },
      { id: 'fluch_der_schwaeche', name: 'Fluch der Schwäche', glyph: 'skull', x: -.72, y: .53, from: ['bannzeichen'], desc: 'Ein Fluch, unter dem Hiebe kraftlos werden.' },
      { id: 'knochenruf', name: 'Knochenruf', glyph: 'bone', x: -.2, y: .53, from: ['bannzeichen'], desc: 'Die Toten stehen für kurze Zeit auf und kämpfen für dich.' },
      { id: 'seelenfeuer', name: 'Seelenfeuer', glyph: 'flame', x: .5, y: .53, from: ['blutpakt'], desc: 'Grünes Feuer, das Lebenskraft frisst.' },
      { id: 'mondzauber', name: 'Mondzauber', glyph: 'moon', x: -.45, y: .77, from: ['fluch_der_schwaeche', 'knochenruf'], desc: 'Unter dem Mond wirkt jeder Bann stärker.' },
      { id: 'verderbnis', name: 'Verderbnis', glyph: 'thorn', x: .38, y: .77, from: ['seelenfeuer'], desc: 'Wunden, die du schlägst, heilen nicht.' },
      { id: 'hexenmeister', name: 'Hexenmeister', glyph: 'eye', x: 0, y: .97, from: ['mondzauber', 'verderbnis'], capstone: true, desc: 'Man spricht deinen Namen nur noch leise.' },
    ] },
];

/** Every perk id of every path (the save keeps only these). */
export const PERK_IDS = PATHS.flatMap(p => p.nodes.map(n => n.id));
/** A node with its path, or null. */
export function findNode(id) {
  for (const path of PATHS) { const node = path.nodes.find(n => n.id === id); if (node) return { path, node }; }
  return null;
}
/** Can this node be lit now? { ok, reason } — needs a perk point and one lit parent (the core is always lit). */
export function canUnlock(id, perks, points) {
  const found = findNode(id);
  if (!found) return { ok: false, reason: 'Unbekannt' };
  if (perks.includes(id)) return { ok: false, reason: 'Bereits entfacht' };
  const { path, node } = found;
  const lit = node.from.some(parent => parent === path.id || perks.includes(parent));
  if (!lit) return { ok: false, reason: `Benötigt ${node.from.map(p => findNode(p)?.node.name ?? path.name).join(' oder ')}` };
  if (points <= 0) return { ok: false, reason: 'Kein Glutsplitter übrig' };
  return { ok: true, reason: '' };
}
