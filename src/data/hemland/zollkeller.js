// THE ZOLLKELLER — the cellars under Bruchwacht, the old customs fort on the Sackträgersteig (world/sites/bruchwacht.js has the
// ruin above). A landslip tore the north tower open and buried the old guardroom; the band that patched up the ward later dug
// the stairs free and keeps its loot down here. The way: down the guardroom stairs, a bend with the first guard behind it,
// the old guardroom, a low passage into the high cistern (a walkway over the sunken floor, a gallery along the north wall,
// a maintenance niche round the back of the guard at the door), the lit door on the far side, the old customs vault with
// its two great piers and the leader at the loot, the pay room behind a grille set by the old tariff, and the supply
// passage back to the ward, its door barred from inside. Drawn as a cave plan (systems/caves.js) in masonry
// (systems/caveMasonry.js); its people are the band (systems/goblins.js, the human kinds).
// Grid: columns run east (x), rows south (z); '<' are stairs falling west into the storey below, 'O' the open drop into the
// cistern, '~' its wet floor, '=' the space under the stair seen from below.
export const ZOLLKELLER = {
  id: 'zollkeller', name: 'Der Zollkeller der Bruchwacht', tribe: 'bruchwacht',
  summary: 'Unter der alten Wachstube: das Gewölbe der Zollfeste, halb versunken. Die Bande lagert hier, was sie den Karren am Sackträgersteig abnimmt.',
  floors: [
    { level: 0, name: 'Keller und Zollgewölbe', grid: [
      '################################################',
      '################################################',
      '########......................................##',
      '########......................................##',
      '########..######################################',
      '########..##############################.......#',
      '#...####..##############################.......E',
      '#...####..####..............############..######',
      '#...####..####..............############..######',
      '##.#####..####..OOOOOOOOOO..############..######',
      '#.........####..OOOOOOOOOO..############..######',
      '#.........####..OOOOOOOOOO..############..######',
      '#...##....####..OOOOOOOOOO..######........######',
      '#...##....####..OOOOOOOOOO..######........######',
      '#...##....####..OOOOOOOOOO..######........######',
      '#.........####..OOOOOOOOOO..######........######',
      '#.........................................######',
      '#.........................................######',
      '#.........####..OOOOOOOOOO..##..##........######',
      '#...##....####..OOOOOOOOOO..##..################',
      '#...##....####..OOOOOO..........################',
      '#...##....#######<<<<<..........################',
      '#.........######################################',
      '#.........######################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
    ] },
    { level: -1, name: 'Der Zisternengrund', grid: [
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################~~~~~~~~~~######################',
      '################.=====##########################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
      '################################################',
    ] },
  ],
  groups: [
    { id: 'wache', name: 'Die Wache an der Treppe', role: 'encounter' }, { id: 'zisterne', name: 'Die Zisternenwache', role: 'encounter' },
    { id: 'gewoelbe', name: 'Broms Leute', role: 'encounter' }, { id: 'tarif', name: 'Der alte Zolltarif', role: 'pillar' },
  ],
  rooms: [
    { id: 'r_treppe', level: 0, name: 'Am Fuß der Treppe', x0: 40, y0: 5, x1: 46, y1: 12, ceiling: 4.2 },
    { id: 'r_wachstube', level: 0, name: 'Die alte Wachstube', x0: 34, y0: 12, x1: 41, y1: 18, ceiling: 4.6 },
    { id: 'r_gang', level: 0, name: 'Der niedrige Gang', x0: 28, y0: 16, x1: 33, y1: 21, ceiling: 3.1 },
    { id: 'r_zisterne', level: 0, name: 'Die Zisterne', x0: 14, y0: 7, x1: 27, y1: 21, ceiling: 8 },
    { id: 'r_westgang', level: 0, name: 'Der helle Durchgang', x0: 10, y0: 16, x1: 13, y1: 17, ceiling: 3.8 },
    { id: 'r_gewoelbe', level: 0, name: 'Das alte Zollgewölbe', x0: 1, y0: 10, x1: 9, y1: 23, ceiling: 6.6 },
    { id: 'r_soldkammer', level: 0, name: 'Die Soldkammer', x0: 1, y0: 6, x1: 3, y1: 9, ceiling: 3.4 },
    { id: 'r_versorgung', level: 0, name: 'Der alte Versorgungsgang', x0: 8, y0: 2, x1: 45, y1: 9, ceiling: 3.4 },
    { id: 'r_grund', level: -1, name: 'Der Zisternengrund', x0: 16, y0: 9, x1: 25, y1: 21, ceiling: 5 },
  ],
  entities: [
    // Light: the stairs, the guardroom fire, the lit door beyond the cistern (seen from its entrance), the vault.
    { id: 't_treppe', type: 'torch', level: 0, x: 44, y: 5 }, { id: 't_biegung', type: 'torch', level: 0, x: 41, y: 9 },
    { id: 't_wache', type: 'torch', level: 0, x: 34, y: 13 }, { id: 'feuer_wache', type: 'fire', level: 0, x: 39, y: 15 },
    { id: 't_gang', type: 'torch', level: 0, x: 29, y: 17 },
    { id: 't_tor_n', type: 'torch', level: 0, x: 14, y: 15 }, { id: 't_tor_s', type: 'torch', level: 0, x: 14, y: 18 }, { id: 't_westgang', type: 'torch', level: 0, x: 12, y: 16 },
    { id: 't_galerie', type: 'torch', level: 0, x: 27, y: 8 }, { id: 't_nische', type: 'torch', level: 0, x: 27, y: 21 },
    { id: 't_gew_n', type: 'torch', level: 0, x: 9, y: 11 }, { id: 't_gew_s', type: 'torch', level: 0, x: 9, y: 22 }, { id: 'feuer_gew', type: 'fire', level: 0, x: 3, y: 19 },
    { id: 't_sold', type: 'torch', level: 0, x: 1, y: 6 },
    { id: 't_vers_1', type: 'torch', level: 0, x: 9, y: 5 }, { id: 't_vers_2', type: 'torch', level: 0, x: 24, y: 2 }, { id: 't_vers_3', type: 'torch', level: 0, x: 40, y: 3 },
    // The band's things: bedrolls, crates and the band's banner in the vault.
    { id: 'bett_1', type: 'bedroll', level: 0, x: 36, y: 17 }, { id: 'bett_2', type: 'bedroll', level: 0, x: 38, y: 18 },
    { id: 'kiste_1', type: 'crate', level: 0, x: 35, y: 12 }, { id: 'kiste_2', type: 'crate', level: 0, x: 41, y: 17 }, { id: 'kiste_3', type: 'crate', level: 0, x: 23, y: 21 },
    { id: 'kiste_4', type: 'crate', level: 0, x: 1, y: 21 }, { id: 'kiste_5', type: 'crate', level: 0, x: 1, y: 12 }, { id: 'kiste_6', type: 'crate', level: 0, x: 44, y: 3 },
    { id: 'banner_gew', type: 'banner', level: 0, x: 1, y: 16 },
    // Reading.
    { id: 'tarif', type: 'clue', level: 0, x: 36, y: 12, for: 'tarif', text: 'In den Stein über dem alten Zahltisch gehauen, der Zolltarif der Feste: „Ein Wagen Korn: zwei Kerben. Ein Wagen Eisen: drei Kerben. Wer die Waage stellt, öffnet die Soldkammer.“ Darunter hat jemand mit Kohle geschrieben: Brom weiß es auch nicht.' },
    { id: 'n_wachbuch', type: 'note', level: 0, x: 40, y: 17, title: 'Das Wachbuch', text: '„Enno schnarcht. Das Dach tropft. Rike hat meinen linken Stiefel geflickt und ihren eigenen noch immer mit Draht zu. Morgen bin ich mit Feuerholz dran.“ Auf der nächsten Seite stehen nur noch Namen.' },
    { id: 'n_fass', type: 'note', level: 0, x: 35, y: 14, title: 'Ritzschrift am Fass', text: '„Die Krone schuldet uns sieben Winter.“ Jemand hat „sechs“ darübergeschrieben. Darunter, in kleiner Schrift: „Rauk zählt den Winter mit, in dem Silla erfror.“' },
    { id: 'n_grund', type: 'note', level: -1, x: 23, y: 11, title: 'Ein nasser Zettel', text: 'Die Tinte ist zerlaufen. Lesbar ist nur: „…Boden ist abgesackt, als der Hang kam. Die Kiste mit dem Salzgeld ist mit hinunter. Wer sie holt, kriegt ein Drittel.“' },
    { id: 'n_beute', type: 'note', level: 0, x: 3, y: 15, title: 'Broms Beuteliste', text: 'Vier Fässer Öl aus Dämmerwald. Ein Ballen Tuch. Das Zollsiegel aus der Soldkammer, „für später“. Neben jedem Posten ein Strich für jeden, der seinen Teil schon hat. Bei Brom sind es drei.' },
    { id: 'n_zoll', type: 'note', level: 0, x: 30, y: 2, title: 'Alte Zollrolle', text: 'Zollrolle der Feste am Sackträgersteig, Jahr der Brücke. Zweihundertzwölf Wagen. Dann, in anderer Hand: „Der Hang kommt. Die Wachstube räumen. Den Gang offen halten, bis die Pforte zu ist.“' },
    // The tariff: set the two piers in the vault to the right notches and the pay room's grille rises.
    { id: 'p_korn', type: 'pillar', level: 0, x: 7, y: 11, group: 'tarif', symbols: ['k1', 'k2', 'k3'], start: 0, solution: 1, label: 'Kornsäule' },
    { id: 'p_eisen', type: 'pillar', level: 0, x: 7, y: 22, group: 'tarif', symbols: ['k1', 'k2', 'k3'], start: 0, solution: 2, label: 'Eisensäule' },
    { id: 'soldgitter', type: 'gate', level: 0, x: 2, y: 9, orientation: 'ew' },
    { id: 'tarifschloss', type: 'pillarDoor', level: 0, x: 2, y: 9, group: 'tarif', targets: ['soldgitter'] },
    // What there is to find: behind the guard in the niche, on the sunken floor, in the pay room.
    { id: 'kiste_nische', type: 'chest', level: 0, x: 26, y: 21, tier: 1 },
    { id: 'kiste_grund', type: 'chest', level: -1, x: 24, y: 10, tier: 2 },
    { id: 'soldkasse', type: 'chest', level: 0, x: 1, y: 7, tier: 3, item: 'zollsiegel' },
    { id: 'soldtruhe', type: 'chest', level: 0, x: 3, y: 6, tier: 2 },
    // The band. A guard behind the first bend (the fire and his voice warn you), a sleeper; one at the cistern door, one on the
    // gallery who comes round by the side arch; two in the vault and Brom at the loot.
    { id: 'b_wache', type: 'goblin', level: 0, x: 37, y: 13, kind: 'raeuber', state: 'guard', group: 'wache' },
    { id: 'b_schlaefer', type: 'goblin', level: 0, x: 35, y: 18, kind: 'raeuber', state: 'sleep', group: 'wache' },
    { id: 'b_tor', type: 'goblin', level: 0, x: 26, y: 16, kind: 'raeuber', state: 'guard', group: 'zisterne' },
    { id: 'b_galerie', type: 'goblin', level: 0, x: 20, y: 7, kind: 'waechter', state: 'patrol', group: 'zisterne', patrol: [[15, 7], [26, 7], [26, 12]] },
    { id: 'b_gew_1', type: 'goblin', level: 0, x: 8, y: 13, kind: 'waechter', state: 'guard', group: 'gewoelbe' },
    { id: 'b_gew_2', type: 'goblin', level: 0, x: 7, y: 20, kind: 'raeuber', state: 'sit', group: 'gewoelbe' },
    { id: 'brom', type: 'chief', level: 0, x: 2, y: 17, group: 'gewoelbe', name: 'Brom Siegelbrecher' },
    // The way back: the old postern at the end of the supply passage, barred from inside, opens into the ward.
    { id: 'pforte', type: 'postern', level: 0, x: 45, y: 2 },
  ],
};

// Where the supply passage's postern opens in the ward: a low door in the inner face of the north curtain (the door, where
// you stand to use it, where you come out, which way you then face).
export const ZOLL_POSTERN = { x: -336, z: 133.3, doorX: -336, doorZ: 131.8, outX: -336, outZ: 134.8, yaw: Math.PI };
