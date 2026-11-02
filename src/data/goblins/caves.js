// Static dungeon plans. Coordinates are cells; group records explicitly declare reference namespaces.
// Encounter groups are finite reserves: a drummer rallies their living members, never spawns an infinite army.
export const CAVE_CELL = 2;
export const CAVE_STOREY = 7;
export const CAVES = [
  {
    "id": "klagende_grube",
    "name": "Die Klagende Grube",
    "tribe": "schaedelsaenger",
    "summary": "Ein zerschlagenes Wandbild führt hinab in eine Halle, deren Wände aus den Gebeinen der Vertriebenen bestehen. Vosh bewahrt hier das Gedächtnis seines Volkes und fügt ihm die Stimmen seiner Gefangenen hinzu.",
    "floors": [
      {
        "level": 0,
        "name": "Die Hörgalerie",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########..#.#.#...................######",
          "#######...........................######",
          "..E.............################vv######",
          "................################vv######",
          "######..........################vv######",
          "######..........################vv######",
          "#######........#################vv######",
          "########....#.##########################",
          "#########..#############################",
          "#########..#############################",
          "#########..#############################",
          "#########..#############################",
          "########....#.#.########################",
          "######...........#######################",
          "######...........#####.....#############",
          "######....##................############",
          "######....##.................###########",
          "######...........####...O...############",
          "######...........#####.....#############",
          "###..............#######################",
          "###..............#######################",
          "######...........#######################",
          "########....#.#.########################",
          "#########vv#############################",
          "#########vv#############################",
          "#########vv#############################",
          "#########vv#############################",
          "#########vv#############################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      },
      {
        "level": -1,
        "name": "Der versunkene Chor",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "###########################.#..#..######",
          "##########################......==.#####",
          "#########################.......==..####",
          "#########################.......==..####",
          "#########################.......==..####",
          "#########################.......==.#####",
          "######..#################..........#####",
          "#####....#################.........#####",
          "#####....##################....#.#######",
          "#####...####################..##########",
          "############################..##########",
          "############################..##########",
          "######.#..##################..##########",
          "#####......#######.#.#..#.#...##########",
          "####........#####............###########",
          "#.............................##########",
          "#.............................##########",
          "#####......#####......##......##########",
          "######.#..######......##......##########",
          "################..............##########",
          "################..............##########",
          "################..............##########",
          "#########==#####..............##########",
          "#########==#####..............##########",
          "#########==#####.............###########",
          "#########==#####...#.#..#.#.############",
          "########:==:::::..######################",
          "#######:::::::::..######################",
          "######::::::::::..######################",
          "#######::::::::::#######################",
          "########::::::::########################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      }
    ],
    "groups": [
      {
        "id": "wache",
        "name": "Die Lauscher am Mundloch",
        "role": "encounter"
      },
      {
        "id": "sippen",
        "name": "Die Hüter der Bilder",
        "role": "encounter"
      },
      {
        "id": "chor",
        "name": "Der Kreis der Rufenden",
        "role": "encounter"
      },
      {
        "id": "vosh",
        "name": "Voshs letzte Stimmen",
        "role": "encounter"
      },
      {
        "id": "gedaechtnis",
        "name": "Die drei Zeugen",
        "role": "pillar"
      },
      {
        "id": "trauer",
        "name": "Die Nacht des Zumauerns",
        "role": "brazier"
      }
    ],
    "rooms": [
      {
        "id": "r_eingang",
        "level": 0,
        "name": "Die drei Zeugen",
        "x0": 6,
        "y0": 3,
        "x1": 15,
        "y1": 10,
        "ceiling": 7,
        "light": "dim",
        "decor": [
          "Wandbilder",
          "abgeschlagene Ohren",
          "Kalkspuren"
        ],
        "purpose": "Die Eintrittsprüfung bewahrt die Reihenfolge des alten Begräbnisgesangs."
      },
      {
        "id": "r_bilder",
        "level": 0,
        "name": "Saal der ausgelöschten Namen",
        "x0": 5,
        "y0": 15,
        "x1": 17,
        "y1": 25,
        "ceiling": 8,
        "light": "dark",
        "decor": [
          "übermeißelte Namen",
          "Schlafmulden",
          "Knochennadeln"
        ],
        "purpose": "Hier bessern Familien die Wandbilder aus."
      },
      {
        "id": "r_galerie",
        "level": 0,
        "name": "Hörgalerie",
        "x0": 20,
        "y0": 17,
        "x1": 28,
        "y1": 21,
        "ceiling": 5,
        "light": "dark",
        "decor": [
          "Knochenbrüstung",
          "Echospalten"
        ],
        "purpose": "Durch den offenen Schacht ist der Trommelkreis eine Ebene tiefer zu sehen."
      },
      {
        "id": "r_aufstieg",
        "level": 0,
        "name": "Der stumme Rückweg",
        "x0": 17,
        "y0": 3,
        "x1": 33,
        "y1": 4,
        "ceiling": 4,
        "light": "dark",
        "decor": [
          "Knochenzüge"
        ],
        "purpose": "Ein alter Trägersteg endet hinter dem Tor am Eingang."
      },
      {
        "id": "r_treppe",
        "level": -1,
        "name": "Kalksturz",
        "x0": 6,
        "y0": 30,
        "x1": 17,
        "y1": 34,
        "ceiling": 5,
        "light": "dim",
        "decor": [
          "abgebrochene Stufen",
          "Guano"
        ],
        "purpose": "Der sichere Abstieg umrundet den Chor von Süden."
      },
      {
        "id": "r_chor",
        "level": -1,
        "name": "Der Knochenchor",
        "x0": 16,
        "y0": 17,
        "x1": 29,
        "y1": 29,
        "ceiling": 6,
        "light": "dark",
        "decor": [
          "singende Knochenwände",
          "Trommelkreis",
          "zerbrochene Spitzhacken"
        ],
        "purpose": "Der Trommler ruft die ruhenden Sänger aus ihren Nischen."
      },
      {
        "id": "r_archiv",
        "level": -1,
        "name": "Archiv der Ohren",
        "x0": 4,
        "y0": 16,
        "x1": 11,
        "y1": 22,
        "ceiling": 5,
        "light": "dark",
        "decor": [
          "Ohrketten",
          "Tonzeichen"
        ],
        "purpose": "Die Trophäen beider Seiten liegen neben den Namen ihrer Träger."
      },
      {
        "id": "r_geheim",
        "level": -1,
        "name": "Das erste Lied",
        "x0": 4,
        "y0": 10,
        "x1": 9,
        "y1": 13,
        "ceiling": 4,
        "light": "dim",
        "decor": [
          "unbeschädigtes Wandbild"
        ],
        "purpose": "Ein zugemauertes Heiligtum bewahrt die Zeit vor den Königen."
      },
      {
        "id": "r_final",
        "level": -1,
        "name": "Voshs Kehle",
        "x0": 25,
        "y0": 4,
        "x1": 35,
        "y1": 12,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Schädelmasken",
          "Altar der Mor-Ghaal",
          "hängende Rippen"
        ],
        "purpose": "Vosh singt zwischen den Gebeinen seiner Vorgänger."
      }
    ],
    "entities": [
      {
        "id": "zeugentora",
        "type": "gate",
        "level": 0,
        "x": 9,
        "y": 12,
        "orientation": "ew"
      },
      {
        "id": "zeugentorb",
        "type": "gate",
        "level": 0,
        "x": 10,
        "y": 12,
        "orientation": "ew"
      },
      {
        "id": "trauertora",
        "type": "gate",
        "level": -1,
        "x": 28,
        "y": 14,
        "orientation": "ew"
      },
      {
        "id": "trauertorb",
        "type": "gate",
        "level": -1,
        "x": 29,
        "y": 14,
        "orientation": "ew"
      },
      {
        "id": "ruecktora",
        "type": "gate",
        "level": 0,
        "x": 17,
        "y": 3,
        "orientation": "ns"
      },
      {
        "id": "ruecktorb",
        "type": "gate",
        "level": 0,
        "x": 17,
        "y": 4,
        "orientation": "ns"
      },
      {
        "id": "zeuge_ohr",
        "type": "pillar",
        "level": 0,
        "x": 8,
        "y": 7,
        "group": "gedaechtnis",
        "symbols": [
          "auge",
          "ohr",
          "knochen"
        ],
        "start": 0,
        "solution": 1
      },
      {
        "id": "zeuge_knochen",
        "type": "pillar",
        "level": 0,
        "x": 11,
        "y": 7,
        "group": "gedaechtnis",
        "symbols": [
          "mond",
          "knochen",
          "kette"
        ],
        "start": 2,
        "solution": 1
      },
      {
        "id": "zeuge_mond",
        "type": "pillar",
        "level": 0,
        "x": 14,
        "y": 7,
        "group": "gedaechtnis",
        "symbols": [
          "mond",
          "pilz",
          "auge"
        ],
        "start": 1,
        "solution": 0
      },
      {
        "id": "zeugenschloss",
        "type": "pillarDoor",
        "level": 0,
        "x": 9,
        "y": 12,
        "group": "gedaechtnis",
        "targets": [
          "zeugentora",
          "zeugentorb"
        ]
      },
      {
        "id": "c_zeugen",
        "type": "clue",
        "level": 0,
        "x": 7,
        "y": 5,
        "for": "gedaechtnis",
        "text": "Drei Gestalten schreiten von links nach rechts: Erst hört das OHR die Lebenden. Dann trägt der KNOCHEN die Toten. Zuletzt deckt der MOND beide zu. Die Zeichen stehen auf den drei Säulen in derselben Reihenfolge."
      },
      {
        "id": "b_heim",
        "type": "brazier",
        "level": -1,
        "x": 18,
        "y": 24,
        "group": "trauer",
        "order": 1,
        "label": "Heim"
      },
      {
        "id": "b_mauer",
        "type": "brazier",
        "level": -1,
        "x": 26,
        "y": 26,
        "group": "trauer",
        "order": 2,
        "label": "Mauer"
      },
      {
        "id": "b_mutter",
        "type": "brazier",
        "level": -1,
        "x": 27,
        "y": 19,
        "group": "trauer",
        "order": 3,
        "label": "Mutter"
      },
      {
        "id": "trauerschloss",
        "type": "brazierDoor",
        "level": -1,
        "x": 28,
        "y": 14,
        "group": "trauer",
        "targets": [
          "trauertora",
          "trauertorb"
        ]
      },
      {
        "id": "c_trauer",
        "type": "clue",
        "level": -1,
        "x": 17,
        "y": 27,
        "for": "trauer",
        "text": "Drei kleine Totenfeuer, keine Sonnenfeuer: Zuerst das HEIM, dann die MAUER, zuletzt die MUTTER. Die Schalen tragen diese Namen. Ein falsches Feuer erstickt die anderen; beginne wieder beim Heim."
      },
      {
        "id": "alte_kette",
        "type": "chain",
        "level": -1,
        "x": 4,
        "y": 18,
        "targets": [
          "liedwand"
        ]
      },
      {
        "id": "liedwand",
        "type": "secret",
        "level": -1,
        "x": 5,
        "y": 14,
        "cells": [
          [
            5,
            14
          ],
          [
            6,
            14
          ],
          [
            5,
            15
          ],
          [
            6,
            15
          ]
        ]
      },
      {
        "id": "c_lied",
        "type": "clue",
        "level": -1,
        "x": 7,
        "y": 18,
        "for": "alte_kette",
        "text": "Das älteste Lied liegt hinter der glatten Wand im Norden. Ziehe am Ohrgewicht neben den Tonzeichen; darunter läuft ein Seil in den Fels."
      },
      {
        "id": "rueckhebel",
        "type": "lever",
        "level": -1,
        "x": 35,
        "y": 7,
        "targets": [
          "ruecktora",
          "ruecktorb"
        ],
        "oneWay": true
      },
      {
        "id": "c_rueck",
        "type": "clue",
        "level": -1,
        "x": 34,
        "y": 9,
        "for": "rueckhebel",
        "text": "Der Knochenzug hebt beide Riegel am Mundloch. Seine Griffseite liegt nur hier; die steile Trägertreppe führt hinauf."
      },
      {
        "id": "vosh_chief",
        "type": "chief",
        "level": -1,
        "x": 29,
        "y": 7,
        "group": "vosh",
        "name": "Vosh der Knochenrufer"
      },
      {
        "id": "g01",
        "type": "goblin",
        "level": 0,
        "x": 8,
        "y": 8,
        "kind": "speer",
        "state": "guard",
        "group": "wache"
      },
      {
        "id": "g02",
        "type": "goblin",
        "level": 0,
        "x": 12,
        "y": 9,
        "kind": "dolch",
        "state": "patrol",
        "group": "wache",
        "patrol": [
          [
            12,
            9
          ],
          [
            12,
            5
          ],
          [
            9,
            5
          ]
        ]
      },
      {
        "id": "g03",
        "type": "goblin",
        "level": 0,
        "x": 7,
        "y": 18,
        "kind": "dolch",
        "state": "work",
        "group": "sippen"
      },
      {
        "id": "g04",
        "type": "goblin",
        "level": 0,
        "x": 13,
        "y": 22,
        "kind": "speer",
        "state": "sleep",
        "group": "sippen"
      },
      {
        "id": "g05",
        "type": "goblin",
        "level": 0,
        "x": 14,
        "y": 20,
        "kind": "dolch",
        "state": "sleep",
        "group": "sippen"
      },
      {
        "id": "g06",
        "type": "goblin",
        "level": 0,
        "x": 23,
        "y": 18,
        "kind": "speer",
        "state": "guard",
        "group": "sippen"
      },
      {
        "id": "g07",
        "type": "goblin",
        "level": 0,
        "x": 4,
        "y": 23,
        "kind": "schleicher",
        "state": "ambush",
        "group": "sippen"
      },
      {
        "id": "g08",
        "type": "goblin",
        "level": -1,
        "x": 8,
        "y": 32,
        "kind": "speer",
        "state": "patrol",
        "group": "chor",
        "patrol": [
          [
            8,
            32
          ],
          [
            15,
            32
          ],
          [
            17,
            28
          ]
        ]
      },
      {
        "id": "g09",
        "type": "goblin",
        "level": -1,
        "x": 20,
        "y": 24,
        "kind": "trommler",
        "state": "pray",
        "group": "chor",
        "rallyGroups": [
          "chor",
          "vosh"
        ]
      },
      {
        "id": "g10",
        "type": "goblin",
        "level": -1,
        "x": 22,
        "y": 27,
        "kind": "speer",
        "state": "sit",
        "group": "chor"
      },
      {
        "id": "g11",
        "type": "goblin",
        "level": -1,
        "x": 24,
        "y": 25,
        "kind": "dolch",
        "state": "sleep",
        "group": "chor"
      },
      {
        "id": "g12",
        "type": "goblin",
        "level": -1,
        "x": 18,
        "y": 21,
        "kind": "dolch",
        "state": "pray",
        "group": "chor"
      },
      {
        "id": "g13",
        "type": "goblin",
        "level": -1,
        "x": 2,
        "y": 20,
        "kind": "schleicher",
        "state": "ambush",
        "group": "chor"
      },
      {
        "id": "g14",
        "type": "goblin",
        "level": -1,
        "x": 27,
        "y": 22,
        "kind": "speer",
        "state": "patrol",
        "group": "chor",
        "patrol": [
          [
            27,
            22
          ],
          [
            27,
            27
          ],
          [
            20,
            27
          ]
        ]
      },
      {
        "id": "g15",
        "type": "goblin",
        "level": -1,
        "x": 27,
        "y": 8,
        "kind": "speer",
        "state": "guard",
        "group": "vosh"
      },
      {
        "id": "g16",
        "type": "goblin",
        "level": -1,
        "x": 31,
        "y": 8,
        "kind": "dolch",
        "state": "guard",
        "group": "vosh"
      },
      {
        "id": "g17",
        "type": "goblin",
        "level": -1,
        "x": 30,
        "y": 10,
        "kind": "wuerger",
        "state": "guard",
        "group": "vosh"
      },
      {
        "id": "g18",
        "type": "goblin",
        "level": -1,
        "x": 28,
        "y": 5,
        "kind": "dolch",
        "state": "pray",
        "group": "vosh"
      },
      {
        "id": "trommelkreis",
        "type": "drums",
        "level": -1,
        "x": 20,
        "y": 23,
        "label": "Rufkreis"
      },
      {
        "id": "lagerfeuer",
        "type": "fire",
        "level": 0,
        "x": 11,
        "y": 20
      },
      {
        "id": "bett_1",
        "type": "bedroll",
        "level": 0,
        "x": 13,
        "y": 23
      },
      {
        "id": "bett_2",
        "type": "bedroll",
        "level": 0,
        "x": 15,
        "y": 21
      },
      {
        "id": "knochenwand",
        "type": "bones",
        "level": -1,
        "x": 17,
        "y": 22
      },
      {
        "id": "altar_vosh",
        "type": "altar",
        "level": -1,
        "x": 30,
        "y": 6
      },
      {
        "id": "totem",
        "type": "totem",
        "level": 0,
        "x": 24,
        "y": 19
      },
      {
        "id": "fackel",
        "type": "torch",
        "level": 0,
        "x": 6,
        "y": 7
      },
      {
        "id": "banner",
        "type": "banner",
        "level": -1,
        "x": 26,
        "y": 7
      },
      {
        "id": "gefangener",
        "type": "cage",
        "level": -1,
        "x": 8,
        "y": 18,
        "prisoner": "Jorren, tauber Steinmetz aus Kronwacht; er musste die Knochenwand ausbessern."
      },
      {
        "id": "truhe_lager",
        "type": "chest",
        "level": 0,
        "x": 15,
        "y": 24,
        "tier": 1
      },
      {
        "id": "truhe_lied",
        "type": "chest",
        "level": -1,
        "x": 7,
        "y": 11,
        "tier": 2
      },
      {
        "id": "truhe_vosh",
        "type": "chest",
        "level": -1,
        "x": 33,
        "y": 11,
        "tier": 3
      },
      {
        "id": "n_jaeger",
        "type": "note",
        "level": 0,
        "x": 8,
        "y": 16,
        "title": "Letzte Zeilen des Gildenjägers",
        "text": "Brenna zahlt für jedes Ohr. Hier tragen sie Ohren wie wir unsere Beutel. Ich hörte meinen Bruder unter den Trommeln rufen. Vielleicht war es nur der Fels. Ich habe die Fackel gelöscht."
      },
      {
        "id": "n_namen",
        "type": "note",
        "level": -1,
        "x": 6,
        "y": 21,
        "title": "Unter dem neuen Kalk",
        "text": "Die königliche Spitzhacke durchbrach die Halle der Namen. Vosh befahl, die Namen neu zu singen. Wer die Arbeit verweigerte, wurde in die Wand gesetzt. Auch unsere eigenen Stimmen fehlen."
      },
      {
        "id": "n_lied",
        "type": "note",
        "level": -1,
        "x": 6,
        "y": 12,
        "title": "Vor dem Zumauern",
        "text": "Ein altes Bild zeigt Ukhai unter Bäumen, ihre Werkzeuge offen in den Händen. Später wurden die Gesichter ausgekratzt. Unter dem Kalk steht: Wir waren Steinsetzer, ehe wir Gräber wurden."
      },
      {
        "id": "rippenfalle",
        "type": "trap",
        "level": 0,
        "x": 12,
        "y": 17,
        "kind": "darts",
        "trigger": [
          [
            10,
            16
          ],
          [
            11,
            16
          ]
        ]
      }
    ]
  },
  {
    "id": "moderhoehle",
    "name": "Die Moderhöhle",
    "tribe": "pilzmuetter",
    "summary": "Unter einem Wald aus bleichen Fruchtkörpern liegt ein flacher See, dessen Wasser die jüngste Brut ernährt. Mutter Ghast hält Menschen als Pfand und Nahrung fest, seit Kronwachts Schächte den Zufluss vergifteten.",
    "floors": [
      {
        "level": 0,
        "name": "Der bleiche Wald",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########,,#,#,#,########################",
          "######,,,,,,,,,,,#####......############",
          "######,,,,,,,,,,,####........###########",
          "######,,,,##,,,,..............##########",
          "######,,,,##,,,,..........O..###########",
          "######,,,,,,,,,,,#####......############",
          "######,,,,,,,,,,,#######################",
          "######,,,,,,,,,,,#######################",
          "##,,,,,,,,,,,,,,,#######################",
          "##,,,,,,,,,,,,,,,#######################",
          "######,,,,,,,,,,,.>>>>>#################",
          "######,,,,,,,,,,,.>>>>>#################",
          "########,..,#,#,########################",
          "#########..#############################",
          "#########..#############################",
          "#########..#############################",
          "#########..######################^^#####",
          "########,..,#,###################^^#####",
          "#######,,,,,,,,##################^^#####",
          "######,,,,,,,,,,#################^^#####",
          "######,,,,,,,,,,#################^^#####",
          "######,,,,,,,,,,#################..#####",
          "..E.....,,,,,,.....................#####",
          "........,,,,,,.....................#####",
          "######,,,,,,,,,,########################",
          "#######,,,,,,,,#########################",
          "########,,#,#,##########################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      },
      {
        "level": -1,
        "name": "Der blinde See",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "######################~~#~#~#~~#~#######",
          "########,,#,#,#######~~~~~~~~~~~~~######",
          "######,,,,,,,,,#####~~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,......~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,......~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,,####~~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,,####~~~~~~###~~~~~~#####",
          "######,,,,,,,,,,####~~~~~~###~~~~~~~~~##",
          "######,,,,,,,,,,####~~~~~~###~~~~~~~~~##",
          "######,,,,,,,,,,####~~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,,####~~~~~~~~~~~~~~~#####",
          "######,,,,,,,,,###=====~~~~~~~~~~~~#####",
          "########,..,#,####=====~~~~~~~~~~~~#####",
          "#########vv#########~~~~~~~~~~~~~~~#####",
          "#########vv#########~~~~~~~~~~~~~~~#####",
          "#########vv##########~~~~~~~~~~~~~######",
          "#########vv###########~~#~#~#..#~~~#####",
          "#########vv##################..##==#####",
          "#############################..##==#####",
          "#############################..##==#####",
          "############################,....==#####",
          "###########################,,,...==#####",
          "##########################,,,,,#########",
          "##########################,,,,,#########",
          "###########################,,,,#########",
          "############################,,,#########",
          "#############################,,>>>>>####",
          "#############################,,>>>>>####",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      },
      {
        "level": -2,
        "name": "Die Wurzelwiege",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "#########.#.#.##########################",
          "########.......#########################",
          "########........########################",
          "########........########################",
          "########........########################",
          "########.......#########################",
          "#########...,,##########################",
          "#########==#,,##########################",
          "#########==#,,##########################",
          "#########==#,,##########################",
          "########,==,,,#,########################",
          "######,,,==,,,,,,##########~#~~#~#######",
          "######,,,,,,,,,,,########~~~~~~~~~~#####",
          "######,,,,,,,,,,,########~~~~~~~~~~~####",
          "######,,,,##,,,,,........~~~~~~~~~~~####",
          "######,,,,##,,,,,........~~~~~~~~~~~####",
          "######,,,,,,,,,,,########~~~~~~~~~~~####",
          "######,,,,,,,,,,,########~~~~~~~~~~~####",
          "######,,,,,,,,,,,########~~~~~~~~~~~####",
          "########,,#,#,#,#########~~~~~~~~~~~~~##",
          "#########################~~~~~~=====~~##",
          "#########################~~~~~~=====~~##",
          "###########################~#~~~~..~~~##",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      }
    ],
    "groups": [
      {
        "id": "sammler",
        "name": "Die Sammlerinnen",
        "role": "encounter"
      },
      {
        "id": "see",
        "name": "Die Wächter des Wassers",
        "role": "encounter"
      },
      {
        "id": "brut",
        "name": "Die Hüter der Wiegen",
        "role": "encounter"
      },
      {
        "id": "ghast",
        "name": "Ghasts Kreis",
        "role": "encounter"
      }
    ],
    "rooms": [
      {
        "id": "r_mund",
        "level": 0,
        "name": "Die Waage der Nahrung",
        "x0": 6,
        "y0": 25,
        "x1": 15,
        "y1": 34,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Lehmabdrücke",
          "Pilzkörbe"
        ],
        "purpose": "Ein beschwerter Futterteller hält das Flechttor offen."
      },
      {
        "id": "r_wald",
        "level": 0,
        "name": "Der bleiche Wald",
        "x0": 5,
        "y0": 8,
        "x1": 17,
        "y1": 20,
        "ceiling": 9,
        "light": "dim",
        "decor": [
          "hohe Leuchtpilze",
          "Sporenschlote",
          "Erntemesser"
        ],
        "purpose": "Zwischen den Stämmen arbeiten und schlafen die Sammlerinnen."
      },
      {
        "id": "r_blick",
        "level": 0,
        "name": "Das sickernde Auge",
        "x0": 20,
        "y0": 9,
        "x1": 29,
        "y1": 13,
        "ceiling": 5,
        "light": "dim",
        "decor": [
          "durchbrochene Pilzkruste"
        ],
        "purpose": "Ein offener Spalt zeigt die Fischreusen im See darunter."
      },
      {
        "id": "r_rueck",
        "level": 0,
        "name": "Trockener Wurzelgang",
        "x0": 14,
        "y0": 30,
        "x1": 34,
        "y1": 31,
        "ceiling": 4,
        "light": "dark",
        "decor": [
          "trockene Wurzeln"
        ],
        "purpose": "Der gesperrte Versorgungsgang kehrt zum Eingang zurück."
      },
      {
        "id": "r_see",
        "level": -1,
        "name": "Der blinde See",
        "x0": 20,
        "y0": 7,
        "x1": 34,
        "y1": 23,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Leuchtalgen",
          "Reusen",
          "Sporennebel"
        ],
        "purpose": "Knietiefes Wasser verrät Bewegung und lässt die Ufer begehbar."
      },
      {
        "id": "r_garten",
        "level": -1,
        "name": "Die schwarzen Beete",
        "x0": 5,
        "y0": 8,
        "x1": 15,
        "y1": 19,
        "ceiling": 6,
        "light": "dark",
        "decor": [
          "verdorbene Pilze",
          "Sporenschlote"
        ],
        "purpose": "Hier wird vergiftete Nahrung getrennt und verbrannt."
      },
      {
        "id": "r_schlick",
        "level": -1,
        "name": "Der verschlammte Schrein",
        "x0": 26,
        "y0": 27,
        "x1": 30,
        "y1": 32,
        "ceiling": 5,
        "light": "dim",
        "decor": [
          "Lehmgesichter",
          "Kalkrinnen"
        ],
        "purpose": "Das Mutterbild wurde vom verseuchten Zufluss aus seiner Nische gespült."
      },
      {
        "id": "r_wiege",
        "level": -2,
        "name": "Die Wurzelwiegen",
        "x0": 5,
        "y0": 23,
        "x1": 17,
        "y1": 32,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "warme Pilzbetten",
          "leere Wiegen",
          "Wurzelvorhänge"
        ],
        "purpose": "Die Brut wird im Rest des sauberen Wassers aufgezogen."
      },
      {
        "id": "r_final",
        "level": -2,
        "name": "Ghasts Mutterbecken",
        "x0": 24,
        "y0": 24,
        "x1": 37,
        "y1": 35,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Heilpilze",
          "Steinschale der Mor-Ghaal",
          "bleiche Wurzeln"
        ],
        "purpose": "Ghast verteidigt das letzte unverdorbene Becken."
      },
      {
        "id": "r_vorrat",
        "level": -2,
        "name": "Kammer der bitteren Vorräte",
        "x0": 7,
        "y0": 13,
        "x1": 15,
        "y1": 19,
        "ceiling": 5,
        "light": "dark",
        "decor": [
          "getrocknete Pilze",
          "verschnürte Körbe"
        ],
        "purpose": "Die ausgelagerten Vorräte zeigen, wie knapp die Nahrung wurde."
      }
    ],
    "entities": [
      {
        "id": "futtertora",
        "type": "gate",
        "level": 0,
        "x": 9,
        "y": 23,
        "orientation": "ew"
      },
      {
        "id": "futtertorb",
        "type": "gate",
        "level": 0,
        "x": 10,
        "y": 23,
        "orientation": "ew"
      },
      {
        "id": "wassertora",
        "type": "gate",
        "level": -1,
        "x": 17,
        "y": 10,
        "orientation": "ns"
      },
      {
        "id": "wassertorb",
        "type": "gate",
        "level": -1,
        "x": 17,
        "y": 11,
        "orientation": "ns"
      },
      {
        "id": "wurzelriegela",
        "type": "gate",
        "level": 0,
        "x": 18,
        "y": 30,
        "orientation": "ns"
      },
      {
        "id": "wurzelriegelb",
        "type": "gate",
        "level": 0,
        "x": 18,
        "y": 31,
        "orientation": "ns"
      },
      {
        "id": "wiegenriegela",
        "type": "gate",
        "level": -1,
        "x": 30,
        "y": 33,
        "orientation": "ns"
      },
      {
        "id": "wiegenriegelb",
        "type": "gate",
        "level": -1,
        "x": 30,
        "y": 34,
        "orientation": "ns"
      },
      {
        "id": "futterteller",
        "type": "plate",
        "level": 0,
        "x": 11,
        "y": 29,
        "targets": [
          "futtertora",
          "futtertorb"
        ]
      },
      {
        "id": "futtergewicht",
        "type": "idol",
        "level": 0,
        "x": 8,
        "y": 32,
        "label": "Korbstein"
      },
      {
        "id": "c_futter",
        "type": "clue",
        "level": 0,
        "x": 8,
        "y": 27,
        "for": "futterteller",
        "text": "Der Korbstein passt in die runde Mulde. Stelle ihn auf den Futterteller: Solange Gewicht auf dem Teller ruht, bleiben beide Torhälften gehoben. Der Stein muss dort bleiben."
      },
      {
        "id": "mutternische",
        "type": "socket",
        "level": -1,
        "x": 21,
        "y": 9,
        "targets": [
          "wassertora",
          "wassertorb"
        ],
        "needs": "mutterbild"
      },
      {
        "id": "mutterbild",
        "type": "idol",
        "level": -1,
        "x": 28,
        "y": 30,
        "label": "Mutterbild"
      },
      {
        "id": "c_mutter",
        "type": "clue",
        "level": -1,
        "x": 24,
        "y": 10,
        "for": "mutternische",
        "text": "Die Nische am Ostufer trägt eine Mutter mit drei Wurzeln. Ihr Bild wurde nach Süden in den Schlamm gespült. Nur dieses Bild hebt das Wassertor; der Korbstein gehört oben auf den Futterteller."
      },
      {
        "id": "rueckhebel",
        "type": "lever",
        "level": -2,
        "x": 35,
        "y": 30,
        "targets": [
          "wurzelriegela",
          "wurzelriegelb",
          "wiegenriegela",
          "wiegenriegelb"
        ],
        "oneWay": true
      },
      {
        "id": "c_rueck",
        "type": "clue",
        "level": -2,
        "x": 32,
        "y": 31,
        "for": "rueckhebel",
        "text": "Zwei Wurzelzüge laufen nach oben. Dieser Griff löst den Riegel über der Versorgungstreppe und das Flechttor am Mundloch. Beide bleiben danach offen."
      },
      {
        "id": "ghast_chief",
        "type": "chief",
        "level": -2,
        "x": 29,
        "y": 30,
        "group": "ghast",
        "name": "Mutter Ghast"
      },
      {
        "id": "g01",
        "type": "goblin",
        "level": 0,
        "x": 9,
        "y": 29,
        "kind": "speer",
        "state": "guard",
        "group": "sammler"
      },
      {
        "id": "g02",
        "type": "goblin",
        "level": 0,
        "x": 13,
        "y": 32,
        "kind": "dolch",
        "state": "sit",
        "group": "sammler"
      },
      {
        "id": "g03",
        "type": "goblin",
        "level": 0,
        "x": 8,
        "y": 11,
        "kind": "dolch",
        "state": "work",
        "group": "sammler"
      },
      {
        "id": "g04",
        "type": "goblin",
        "level": 0,
        "x": 10,
        "y": 15,
        "kind": "speer",
        "state": "patrol",
        "group": "sammler",
        "patrol": [
          [
            10,
            15
          ],
          [
            14,
            15
          ],
          [
            14,
            10
          ],
          [
            8,
            10
          ]
        ]
      },
      {
        "id": "g05",
        "type": "goblin",
        "level": 0,
        "x": 3,
        "y": 17,
        "kind": "schleicher",
        "state": "ambush",
        "group": "sammler"
      },
      {
        "id": "g06",
        "type": "goblin",
        "level": 0,
        "x": 14,
        "y": 18,
        "kind": "dolch",
        "state": "sleep",
        "group": "sammler"
      },
      {
        "id": "g07",
        "type": "goblin",
        "level": 0,
        "x": 24,
        "y": 11,
        "kind": "speer",
        "state": "guard",
        "group": "sammler"
      },
      {
        "id": "g08",
        "type": "goblin",
        "level": -1,
        "x": 25,
        "y": 20,
        "kind": "speer",
        "state": "patrol",
        "group": "see",
        "patrol": [
          [
            25,
            20
          ],
          [
            31,
            20
          ],
          [
            31,
            10
          ],
          [
            25,
            10
          ]
        ]
      },
      {
        "id": "g09",
        "type": "goblin",
        "level": -1,
        "x": 36,
        "y": 15,
        "kind": "speier",
        "state": "ambush",
        "group": "see"
      },
      {
        "id": "g10",
        "type": "goblin",
        "level": -1,
        "x": 22,
        "y": 12,
        "kind": "dolch",
        "state": "work",
        "group": "see"
      },
      {
        "id": "g11",
        "type": "goblin",
        "level": -1,
        "x": 28,
        "y": 28,
        "kind": "speer",
        "state": "guard",
        "group": "see"
      },
      {
        "id": "g12",
        "type": "goblin",
        "level": -1,
        "x": 8,
        "y": 12,
        "kind": "dolch",
        "state": "work",
        "group": "see"
      },
      {
        "id": "g13",
        "type": "goblin",
        "level": -1,
        "x": 12,
        "y": 16,
        "kind": "speer",
        "state": "guard",
        "group": "see"
      },
      {
        "id": "g14",
        "type": "goblin",
        "level": -2,
        "x": 9,
        "y": 27,
        "kind": "dolch",
        "state": "work",
        "group": "brut"
      },
      {
        "id": "g15",
        "type": "goblin",
        "level": -2,
        "x": 13,
        "y": 29,
        "kind": "speer",
        "state": "sleep",
        "group": "brut"
      },
      {
        "id": "g16",
        "type": "goblin",
        "level": -2,
        "x": 14,
        "y": 25,
        "kind": "trommler",
        "state": "guard",
        "group": "brut",
        "rallyGroups": [
          "brut",
          "see"
        ]
      },
      {
        "id": "g17",
        "type": "goblin",
        "level": -2,
        "x": 11,
        "y": 16,
        "kind": "dolch",
        "state": "sleep",
        "group": "brut"
      },
      {
        "id": "g18",
        "type": "goblin",
        "level": -2,
        "x": 15,
        "y": 28,
        "kind": "speer",
        "state": "patrol",
        "group": "brut",
        "patrol": [
          [
            15,
            28
          ],
          [
            8,
            28
          ],
          [
            8,
            25
          ],
          [
            15,
            25
          ]
        ]
      },
      {
        "id": "g19",
        "type": "goblin",
        "level": -2,
        "x": 26,
        "y": 28,
        "kind": "speer",
        "state": "guard",
        "group": "ghast"
      },
      {
        "id": "g20",
        "type": "goblin",
        "level": -2,
        "x": 31,
        "y": 27,
        "kind": "speier",
        "state": "ambush",
        "group": "ghast"
      },
      {
        "id": "g21",
        "type": "goblin",
        "level": -2,
        "x": 30,
        "y": 33,
        "kind": "dolch",
        "state": "pray",
        "group": "ghast"
      },
      {
        "id": "g22",
        "type": "goblin",
        "level": -2,
        "x": 32,
        "y": 32,
        "kind": "speer",
        "state": "guard",
        "group": "ghast"
      },
      {
        "id": "wiegenruf",
        "type": "drums",
        "level": -2,
        "x": 14,
        "y": 26,
        "label": "Wiegenruf"
      },
      {
        "id": "pilzbaum",
        "type": "mushrooms",
        "level": 0,
        "x": 12,
        "y": 12
      },
      {
        "id": "sporen",
        "type": "mushrooms",
        "level": -1,
        "x": 31,
        "y": 14
      },
      {
        "id": "heilerpilz",
        "type": "mushrooms",
        "level": -2,
        "x": 28,
        "y": 31
      },
      {
        "id": "korb",
        "type": "crate",
        "level": 0,
        "x": 12,
        "y": 33
      },
      {
        "id": "bett",
        "type": "bedroll",
        "level": 0,
        "x": 15,
        "y": 18
      },
      {
        "id": "brutbett",
        "type": "bedroll",
        "level": -2,
        "x": 12,
        "y": 30
      },
      {
        "id": "restfeuer",
        "type": "fire",
        "level": -1,
        "x": 7,
        "y": 15
      },
      {
        "id": "altar",
        "type": "altar",
        "level": -2,
        "x": 29,
        "y": 32
      },
      {
        "id": "wurzeltotem",
        "type": "totem",
        "level": -1,
        "x": 22,
        "y": 8
      },
      {
        "id": "gefangene",
        "type": "cage",
        "level": -2,
        "x": 8,
        "y": 30,
        "prisoner": "Mara, Wasserprüferin aus Kronwacht; sie kennt den neuen Ablauf des Bergwerks."
      },
      {
        "id": "truhe_wald",
        "type": "chest",
        "level": 0,
        "x": 7,
        "y": 9,
        "tier": 1
      },
      {
        "id": "truhe_vorrat",
        "type": "chest",
        "level": -2,
        "x": 13,
        "y": 15,
        "tier": 2
      },
      {
        "id": "truhe_ghast",
        "type": "chest",
        "level": -2,
        "x": 32,
        "y": 29,
        "tier": 3,
        "locked": true,
        "key": "ghast_schluessel"
      },
      {
        "id": "ghast_schluessel",
        "type": "key",
        "level": -2,
        "x": 27,
        "y": 31,
        "opens": "truhe_ghast"
      },
      {
        "id": "n_wasser",
        "type": "note",
        "level": -1,
        "x": 28,
        "y": 31,
        "title": "Maras Wasserprobe",
        "text": "Seit dem Durchbruch der königlichen Grube treibt schwarzer Staub im Zufluss. Meine Meldung wurde gestrichen: Der neue Schacht müsse weiter fördern. Ghast ließ mich leben, als ich den Schlamm trank. Meine Gehilfin ließ sie nicht leben."
      },
      {
        "id": "n_wiegen",
        "type": "note",
        "level": -2,
        "x": 12,
        "y": 24,
        "title": "Die leeren Mulden",
        "text": "In die weiche Wand sind Namen geritzt. Unter sieben Namen steht kein Erntetag mehr. Muur-Ghast gibt zuerst den Wiegen zu essen, dann den Wachen. Die gefangenen Sonnengänger erhalten nur bitteres Wasser."
      },
      {
        "id": "n_handel",
        "type": "note",
        "level": 0,
        "x": 14,
        "y": 13,
        "title": "Ölzeug im Pilzkorb",
        "text": "Drei Säcke Leuchtpilze gegen Salz, ohne Siegel. Der Fuhrmann versprach, der neue Schacht bleibe fern vom Wasser. Unter seiner Unterschrift hat eine andere Hand ein einziges Wort eingeritzt: Lüge."
      },
      {
        "id": "reusenfalle",
        "type": "trap",
        "level": -1,
        "x": 27,
        "y": 18,
        "kind": "spikes",
        "trigger": [
          [
            26,
            18
          ],
          [
            26,
            19
          ]
        ]
      }
    ]
  },
  {
    "id": "eisengrube",
    "name": "Die Eisengrube",
    "tribe": "kettenbrecher",
    "summary": "Königliche Messlinien schneiden durch ältere Hallen der Ukhai. Die Kettenbrecher haben die Grube erobert, doch unter Ulgraks Herrschaft arbeiten wieder Gefangene hinter denselben Gittern.",
    "floors": [
      {
        "level": 0,
        "name": "Die königliche Förderstrecke",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "#######...........######################",
          "..E...............######################",
          "..................######################",
          "#######...........##############^^######",
          "#######...........##############^^######",
          "#######...........##############^^######",
          "#######...........##############^^######",
          "#######...........##############^^######",
          "#######...........................######",
          "##########..####..................######",
          "########################################",
          "########################################",
          "##########..############################",
          "#####:::::..::::::######################",
          "#####:::::::::::::######################",
          "#####::::::::::::.....::::::::##########",
          "#####::::::::::::.....::::O:::##########",
          "#####:::::::::::::###:::::::::##########",
          "#####:::::::::::::######################",
          "#####:::::::::::::######################",
          "#####:::::::::::::######################",
          "#####:::::::::::::OO..>>>>>#############",
          "#####:::::::::::::OO..>>>>>#############",
          "#####:::::::::::::######################",
          "#####:::::::::::::######################",
          "#####:::::::::::::######################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      },
      {
        "level": -1,
        "name": "Die letzte Schicht",
        "grid": [
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "#######...........................######",
          "#######...........................######",
          "#######...........##############==######",
          "#######...........##############==######",
          "#######...........##############==######",
          "#######...........##############==######",
          "#######...........##############==######",
          "#######...........######################",
          "#######...........######################",
          "#######...........######################",
          "##########..############################",
          "##########..############################",
          "##########..############################",
          "##########..::::::::::::............####",
          "##########..::::::::::::............####",
          "#######.......::::::::::............####",
          "#######.......::::::::::##..........####",
          "#######.......::::::::::##..........####",
          "#######.......::::::::::............####",
          "#######.......::::::::::............####",
          "#######...............=====.........####",
          "#######...............=====.........####",
          "#######.............#...............####",
          "#######.............#...............####",
          "#######.............#...............####",
          "#######.............#...............####",
          "################..######################",
          "################..######################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################",
          "########################################"
        ]
      }
    ],
    "groups": [
      {
        "id": "tor",
        "name": "Die Stollenwache",
        "role": "encounter"
      },
      {
        "id": "foerderer",
        "name": "Die Lorenarbeiter",
        "role": "encounter"
      },
      {
        "id": "schmiede",
        "name": "Die Rufer der Esse",
        "role": "encounter"
      },
      {
        "id": "ulgrak",
        "name": "Ulgraks Ketten",
        "role": "encounter"
      }
    ],
    "rooms": [
      {
        "id": "r_eingang",
        "level": 0,
        "name": "Zählstube der Krone",
        "x0": 7,
        "y0": 3,
        "x1": 17,
        "y1": 11,
        "ceiling": 5,
        "light": "dim",
        "decor": [
          "Kronensiegel",
          "Kerbhölzer",
          "Balken"
        ],
        "purpose": "Hier wurden Arbeitskräfte als Förderlast gezählt."
      },
      {
        "id": "r_loren",
        "level": 0,
        "name": "Die schiefe Förderhalle",
        "x0": 5,
        "y0": 16,
        "x1": 17,
        "y1": 28,
        "ceiling": 8,
        "light": "dim",
        "decor": [
          "Stützbalken",
          "Lorenwinde",
          "Erzreste"
        ],
        "purpose": "Die Kettenbrecher warten die königlichen Maschinen."
      },
      {
        "id": "r_blick",
        "level": 0,
        "name": "Bruchkante über der Esse",
        "x0": 21,
        "y0": 18,
        "x1": 29,
        "y1": 20,
        "ceiling": 5,
        "light": "dark",
        "decor": [
          "gerissene Ketten",
          "abgebrochene Schienen"
        ],
        "purpose": "Ein Schacht gibt den Blick auf die wieder angefachte Schmiede frei."
      },
      {
        "id": "r_rueck",
        "level": 0,
        "name": "Steigersteg",
        "x0": 17,
        "y0": 11,
        "x1": 33,
        "y1": 12,
        "ceiling": 4,
        "light": "dark",
        "decor": [
          "Nummernschilder",
          "Wartungsseile"
        ],
        "purpose": "Der alte Kontrollweg endet hinter dem Eingangsgitter."
      },
      {
        "id": "r_esse",
        "level": -1,
        "name": "Die alte Königsesse",
        "x0": 21,
        "y0": 17,
        "x1": 35,
        "y1": 29,
        "ceiling": 6,
        "light": "lit",
        "decor": [
          "Blasebalg",
          "glühende Esse",
          "Kronen auf den Gussformen"
        ],
        "purpose": "Der Trommler schlägt den Arbeitstakt der Schmiede."
      },
      {
        "id": "r_werk",
        "level": -1,
        "name": "Kettenwerk und Pferch",
        "x0": 7,
        "y0": 19,
        "x1": 19,
        "y1": 29,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Nietbänke",
          "Sklavenringe",
          "Kettenzüge"
        ],
        "purpose": "Befreite Sklaven schmieden Fesseln für neue Gefangene."
      },
      {
        "id": "r_schlacke",
        "level": -1,
        "name": "Schlackengraben",
        "x0": 14,
        "y0": 17,
        "x1": 23,
        "y1": 23,
        "ceiling": 5,
        "light": "dark",
        "decor": [
          "erkaltete Schlacke",
          "Bruchholz"
        ],
        "purpose": "Wer die Brücke verfehlt, landet bei den Kettenwürgern."
      },
      {
        "id": "r_final",
        "level": -1,
        "name": "Ulgraks Thronwaage",
        "x0": 7,
        "y0": 4,
        "x1": 17,
        "y1": 13,
        "ceiling": 6,
        "light": "dim",
        "decor": [
          "Thron aus Lorenachsen",
          "zerbrochene Halsringe"
        ],
        "purpose": "Ulgrak wiegt Menschen und Erz auf derselben königlichen Waage."
      },
      {
        "id": "r_pruefer",
        "level": -1,
        "name": "Gang der königlichen Prüfer",
        "x0": 17,
        "y0": 4,
        "x1": 33,
        "y1": 5,
        "ceiling": 4,
        "light": "dark",
        "decor": [
          "Messstriche",
          "vergessene Klemmbretter"
        ],
        "purpose": "Die Prüfer konnten die Arbeiter umgehen und ungesehen nach oben gelangen."
      }
    ],
    "entities": [
      {
        "id": "schichtglocke",
        "type": "chain",
        "level": 0,
        "x": 8,
        "y": 10,
        "targets": [
          "bruchpfropfen"
        ]
      },
      {
        "id": "bruchpfropfen",
        "type": "secret",
        "level": 0,
        "x": 10,
        "y": 13,
        "cells": [
          [
            10,
            13
          ],
          [
            11,
            13
          ],
          [
            10,
            14
          ],
          [
            11,
            14
          ]
        ]
      },
      {
        "id": "c_glocke",
        "type": "clue",
        "level": 0,
        "x": 9,
        "y": 8,
        "for": "schichtglocke",
        "text": "Die alte Schichtglocke hängt stumm. Ihr Zug läuft hinter den südlichen Versturz. Ziehen löst die Sperrklinke: Der als Geröll getarnte Holzpfropfen führt seitlich ein."
      },
      {
        "id": "foerderbruecke",
        "type": "bridge",
        "level": 0,
        "x": 18,
        "y": 24,
        "cells": [
          [
            18,
            24
          ],
          [
            19,
            24
          ],
          [
            18,
            25
          ],
          [
            19,
            25
          ]
        ]
      },
      {
        "id": "windenhebel",
        "type": "lever",
        "level": 0,
        "x": 5,
        "y": 21,
        "targets": [
          "foerderbruecke"
        ]
      },
      {
        "id": "c_winde",
        "type": "clue",
        "level": 0,
        "x": 7,
        "y": 22,
        "for": "windenhebel",
        "text": "Wartungszeichen: Den Hebel an der Westwand ziehen, bis die Klinke greift. Die Brücke im Südosten senkt sich über den Schlackengraben. Jenseits beginnt die Fördertreppe. Wer springt, findet unten keinen Aufstieg im Graben."
      },
      {
        "id": "steigertora",
        "type": "gate",
        "level": 0,
        "x": 20,
        "y": 11,
        "orientation": "ns"
      },
      {
        "id": "steigertorb",
        "type": "gate",
        "level": 0,
        "x": 20,
        "y": 12,
        "orientation": "ns"
      },
      {
        "id": "rueckhebel",
        "type": "lever",
        "level": -1,
        "x": 7,
        "y": 7,
        "targets": [
          "steigertora",
          "steigertorb"
        ],
        "oneWay": true
      },
      {
        "id": "c_rueck",
        "type": "clue",
        "level": -1,
        "x": 9,
        "y": 6,
        "for": "rueckhebel",
        "text": "Nur von der Thronwaage aus lässt sich der Steigerriegel lösen. Der Prüfergang führt nach Osten zur Treppe; oben folgt man dem Steg nach Westen zum Mundloch."
      },
      {
        "id": "ulgrak_chief",
        "type": "chief",
        "level": -1,
        "x": 12,
        "y": 8,
        "group": "ulgrak",
        "name": "Ulgrak Kettenfaust"
      },
      {
        "id": "g01",
        "type": "goblin",
        "level": 0,
        "x": 8,
        "y": 5,
        "kind": "speer",
        "state": "guard",
        "group": "tor"
      },
      {
        "id": "g02",
        "type": "goblin",
        "level": 0,
        "x": 15,
        "y": 7,
        "kind": "dolch",
        "state": "patrol",
        "group": "tor",
        "patrol": [
          [
            15,
            7
          ],
          [
            15,
            10
          ],
          [
            10,
            10
          ],
          [
            10,
            6
          ]
        ]
      },
      {
        "id": "g03",
        "type": "goblin",
        "level": 0,
        "x": 8,
        "y": 19,
        "kind": "speer",
        "state": "work",
        "group": "foerderer"
      },
      {
        "id": "g04",
        "type": "goblin",
        "level": 0,
        "x": 10,
        "y": 23,
        "kind": "dolch",
        "state": "work",
        "group": "foerderer"
      },
      {
        "id": "g05",
        "type": "goblin",
        "level": 0,
        "x": 14,
        "y": 26,
        "kind": "dolch",
        "state": "sleep",
        "group": "foerderer"
      },
      {
        "id": "g06",
        "type": "goblin",
        "level": 0,
        "x": 13,
        "y": 18,
        "kind": "speer",
        "state": "patrol",
        "group": "foerderer",
        "patrol": [
          [
            13,
            18
          ],
          [
            13,
            25
          ],
          [
            7,
            25
          ],
          [
            7,
            18
          ]
        ]
      },
      {
        "id": "g07",
        "type": "goblin",
        "level": 0,
        "x": 25,
        "y": 18,
        "kind": "speer",
        "state": "guard",
        "group": "foerderer"
      },
      {
        "id": "g08",
        "type": "goblin",
        "level": -1,
        "x": 28,
        "y": 24,
        "kind": "trommler",
        "state": "work",
        "group": "schmiede",
        "rallyGroups": [
          "schmiede",
          "ulgrak"
        ]
      },
      {
        "id": "g09",
        "type": "goblin",
        "level": -1,
        "x": 32,
        "y": 20,
        "kind": "speer",
        "state": "work",
        "group": "schmiede"
      },
      {
        "id": "g10",
        "type": "goblin",
        "level": -1,
        "x": 31,
        "y": 26,
        "kind": "dolch",
        "state": "work",
        "group": "schmiede"
      },
      {
        "id": "g11",
        "type": "goblin",
        "level": -1,
        "x": 22,
        "y": 20,
        "kind": "speer",
        "state": "guard",
        "group": "schmiede"
      },
      {
        "id": "g12",
        "type": "goblin",
        "level": -1,
        "x": 17,
        "y": 30,
        "kind": "wuerger",
        "state": "ambush",
        "group": "schmiede"
      },
      {
        "id": "g13",
        "type": "goblin",
        "level": -1,
        "x": 13,
        "y": 18,
        "kind": "wuerger",
        "state": "ambush",
        "group": "schmiede"
      },
      {
        "id": "g14",
        "type": "goblin",
        "level": -1,
        "x": 10,
        "y": 26,
        "kind": "dolch",
        "state": "sleep",
        "group": "schmiede"
      },
      {
        "id": "g15",
        "type": "goblin",
        "level": -1,
        "x": 11,
        "y": 22,
        "kind": "speer",
        "state": "patrol",
        "group": "schmiede",
        "patrol": [
          [
            11,
            22
          ],
          [
            11,
            27
          ],
          [
            16,
            27
          ],
          [
            16,
            22
          ]
        ]
      },
      {
        "id": "g16",
        "type": "goblin",
        "level": -1,
        "x": 9,
        "y": 11,
        "kind": "speer",
        "state": "guard",
        "group": "ulgrak"
      },
      {
        "id": "g17",
        "type": "goblin",
        "level": -1,
        "x": 15,
        "y": 10,
        "kind": "brecher",
        "state": "guard",
        "group": "ulgrak"
      },
      {
        "id": "g18",
        "type": "goblin",
        "level": -1,
        "x": 14,
        "y": 6,
        "kind": "dolch",
        "state": "guard",
        "group": "ulgrak"
      },
      {
        "id": "g19",
        "type": "goblin",
        "level": -1,
        "x": 12,
        "y": 5,
        "kind": "speer",
        "state": "sit",
        "group": "ulgrak"
      },
      {
        "id": "g20",
        "type": "goblin",
        "level": -1,
        "x": 16,
        "y": 8,
        "kind": "dolch",
        "state": "guard",
        "group": "ulgrak"
      },
      {
        "id": "schmiedetakt",
        "type": "drums",
        "level": -1,
        "x": 28,
        "y": 23,
        "label": "Schichttrommel"
      },
      {
        "id": "esse",
        "type": "fire",
        "level": -1,
        "x": 33,
        "y": 23
      },
      {
        "id": "lore",
        "type": "cart",
        "level": 0,
        "x": 11,
        "y": 21
      },
      {
        "id": "schiene",
        "type": "rails",
        "level": 0,
        "x": 11,
        "y": 17,
        "cells": [
          [
            11,
            17
          ],
          [
            11,
            18
          ],
          [
            11,
            19
          ],
          [
            11,
            20
          ],
          [
            11,
            21
          ],
          [
            11,
            22
          ],
          [
            11,
            23
          ],
          [
            11,
            24
          ],
          [
            11,
            25
          ],
          [
            11,
            26
          ],
          [
            11,
            27
          ]
        ]
      },
      {
        "id": "bett",
        "type": "bedroll",
        "level": 0,
        "x": 15,
        "y": 26
      },
      {
        "id": "bett_tief",
        "type": "bedroll",
        "level": -1,
        "x": 9,
        "y": 26
      },
      {
        "id": "erz",
        "type": "crate",
        "level": 0,
        "x": 7,
        "y": 27
      },
      {
        "id": "krone",
        "type": "banner",
        "level": 0,
        "x": 16,
        "y": 4
      },
      {
        "id": "kettenaltar",
        "type": "altar",
        "level": -1,
        "x": 12,
        "y": 7
      },
      {
        "id": "fackel",
        "type": "torch",
        "level": 0,
        "x": 7,
        "y": 6
      },
      {
        "id": "knochen",
        "type": "bones",
        "level": -1,
        "x": 18,
        "y": 18
      },
      {
        "id": "gefangene",
        "type": "cage",
        "level": -1,
        "x": 8,
        "y": 24,
        "prisoner": "Edda, königliche Vermesserin, und Rauk, ein Ukhai, der Ulgraks Arbeitsbefehl verweigerte."
      },
      {
        "id": "truhe_lohn",
        "type": "chest",
        "level": 0,
        "x": 28,
        "y": 19,
        "tier": 2,
        "locked": true,
        "key": "lohn_schluessel"
      },
      {
        "id": "lohn_schluessel",
        "type": "key",
        "level": 0,
        "x": 16,
        "y": 9,
        "opens": "truhe_lohn"
      },
      {
        "id": "truhe_werk",
        "type": "chest",
        "level": -1,
        "x": 8,
        "y": 28,
        "tier": 1
      },
      {
        "id": "truhe_ulgrak",
        "type": "chest",
        "level": -1,
        "x": 16,
        "y": 5,
        "tier": 3
      },
      {
        "id": "n_liste",
        "type": "note",
        "level": 0,
        "x": 12,
        "y": 4,
        "title": "Königliches Schichtbuch",
        "text": "Siebzehn Ukhai in Ketten eingefahren. Vierzehn ausgefahren. Drei verbleiben als Stützer im neuen Querschlag. Der Meister hat die Lücke als Holzersparnis gebucht. Das Siegel ist älter als dreihundert Jahre."
      },
      {
        "id": "n_durchbruch",
        "type": "note",
        "level": -1,
        "x": 34,
        "y": 27,
        "title": "Vermessungsblatt des neuen Schachts",
        "text": "Der Querschlag nach Kronwacht traf bemalte Wände und einen Wasserlauf. Befehl: Bilder abschlagen, Wasser in die tiefe Rinne leiten, Förderung fortsetzen. Von den Gesängen durfte kein Bericht an den Hof gehen."
      },
      {
        "id": "n_rauk",
        "type": "note",
        "level": -1,
        "x": 9,
        "y": 25,
        "title": "Rauks Kerben",
        "text": "Drak-ul: Kette zerbrochen. So nannten wir uns. Nun zählt Ulgrak die Schichten mit der Glocke der Könige. Edda teilt ihr Wasser mit mir. Er trägt unsere zerbrochenen Ketten, doch wir tragen seine neuen."
      },
      {
        "id": "lorenfalle",
        "type": "trap",
        "level": 0,
        "x": 12,
        "y": 26,
        "kind": "logs",
        "trigger": [
          [
            12,
            24
          ],
          [
            13,
            24
          ]
        ],
        "label": "Lorenpendel"
      }
    ]
  }
];
