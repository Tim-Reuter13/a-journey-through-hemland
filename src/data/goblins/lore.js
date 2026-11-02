// The Ukhai — the people the Kronreich calls goblins. Plain data: lore, the three tribes of the Aschmark, their
// language (a small lexicon the callouts are built from) and what the Grubenwacht guild in Kronwacht says of them.
// Tone as everywhere in Hemland: serious, no comic relief; neither side is innocent.

export const GOBLIN_LORE = {
  name: 'Ukhai',
  outsideName: 'Goblins',
  summary: 'Die Ukhai nennen sich „die unter dem Stein“. Vor dreihundert Jahren waren sie das Hügelvolk der Aschmark, Erzgräber und Steinsetzer. Als die ersten Könige von Kronwacht das Eisen in den Hügeln wollten, trieb man sie in ihre eigenen Stollen und mauerte die Mundlöcher zu. Die Chroniken nennen es „die Vertreibung“. Die Ukhai nennen es „das Zumauern“.',
  change: 'Drei Jahrhunderte Dunkelheit haben sie verändert: klein, gebeugt, mit grauer Haut, riesigen Ohren und milchigen Augen. Sie sehen schlecht und hören alles. Licht schmerzt sie, Feuer fürchten sie. Wer leise geht, kommt nah heran. Wer eine Fackel trägt, wird gehört, gemieden und dann von hinten angegriffen.',
  faith: 'Sie beten zur Mor-Ghaal, der Mutter unter dem Stein, die alles verschluckt, was fällt. Die Sonne halten sie für das brennende Auge der Könige. Eines Tages, so lehren ihre Sänger, wird die Mutter das Auge schließen. Dann gehen die Ukhai wieder oben.',
  ears: 'Ohren sind ihnen heilig: Wer hört, lebt. Ein Ukhai nimmt dem getöteten Feind das Ohr, damit dessen Hören in die Mutter eingeht. Die Grubenwacht in Kronwacht zahlt Gold für Goblinohren. Beide Seiten zählen ihre Toten an denselben Trophäen.',
  wits: 'Sie sind nicht dumm. Sie sprechen eine eigene Sprache mit Ruf- und Trommelzeichen, stellen Fallen, locken Feinde in Engen, kreisen sie ein und ziehen sich zurück, wenn sie verlieren. Ihre Sänger bewahren Wissen in Wandbildern. Manche Stämme handeln heimlich mit Menschen, die an Erz und Schweigen verdienen.',
  wound: 'Seit Kronwachts neue Schächte in ihre heiligen Hallen gebrochen sind, überfallen sie Wagen und Höfe. Die Krone nennt es eine Plage. In den Höhlen hängen die Spitzhacken der Schachtleute als Beweis an den Wänden.',
};

/** The three tribes of the Aschmark, each with its cave, its chief and its own way of fighting. */
export const TRIBES = {
  schaedelsaenger: {
    name: 'Die Schädelsänger', ukhai: 'Khar-Vosh', cave: 'klagende_grube', chief: 'Vosh der Knochenrufer',
    look: 'Kalkweiße Kriegsbemalung, Knochenketten, Schädelmasken, Trommeln aus Schulterblättern.',
    way: 'Sänger und Hüter der Wandbilder. Sie rufen sich in Echos zu und lassen Trommler Horden heranholen. Ihr Häuptling ist ein Schamane, der seine Leute rasend singt.',
    weapons: 'Knochenspeere, Dolche aus Rippen, Wurfspeere.',
  },
  pilzmuetter: {
    name: 'Die Pilzmütter', ukhai: 'Muur-Ghast', cave: 'moderhoehle', chief: 'Mutter Ghast',
    look: 'Grünlich gefleckte Haut, Pilzgeflechte auf Schultern und Kapuzen, leuchtende Sporen in Beuteln.',
    way: 'Ziehen leuchtende Pilze an einem unterirdischen See, kennen jedes Gift. Sie kämpfen aus Sporenwolken und vergiften Klingen. Ihre Häuptlingin ist eine alte Mutter, die ihre Brut heilt und Seuche spuckt.',
    weapons: 'Vergiftete Steindolche, Speere mit Glasspitzen, Sporenbeutel.',
  },
  kettenbrecher: {
    name: 'Die Kettenbrecher', ukhai: 'Drak-Ul', cave: 'eisengrube', chief: 'Ulgrak Kettenfaust',
    look: 'Rostrote Bemalung, zerrissene Sklavenketten an Hals und Armen, Helmreste der Schachtleute.',
    way: 'Hausen in einem alten Kronbergwerk, in dem ihre Vorfahren in Ketten Erz brachen. Sie tragen die Ketten als Reliquie, bauen Fallen aus Loren und Winden. Ihr Häuptling ist ein Hüne mit einer Kettenfaust.',
    weapons: 'Rostige Eisenspeere, Hakendolche, Ketten mit Haken.',
  },
};

/** The kinds of Ukhai a cave holds. Plain fighters come with spears or daggers; the specials each fight differently. */
export const GOBLIN_KINDS = {
  speer: { name: 'Speerträger', hp: 75, role: 'Hält Abstand, stößt aus der Reihe, wirft manchmal den Speer.' },
  dolch: { name: 'Dolchschleicher', hp: 60, role: 'Schnell, kreist, sticht in den Rücken und springt zurück.' },
  schleicher: { name: 'Lauerer', hp: 115, role: 'Hager, lange Krallen. Lauert im Dunkeln, springt aus der Distanz an und drückt dich zu Boden.' },
  speier: { name: 'Sporenbalg', hp: 120, role: 'Aufgeblähter Rücken voller Sporen. Spuckt Giftwolken, platzt im Tod. Aus der Ferne töten.' },
  wuerger: { name: 'Kettenwürger', hp: 105, role: 'Dürr, mit Hakenkette. Reißt dich aus der Entfernung zu sich und hält dich fest.' },
  brecher: { name: 'Brecher', hp: 400, role: 'Ein verwachsener Hüne mit einem Riesenarm. Stürmt, wirft Felsen, fällt dich um. Verwundbar im Rücken und durch Feuer.' },
  trommler: { name: 'Trommler', hp: 90, role: 'Schamane mit Trommel. Solange er schlägt, kommen mehr. Zuerst töten.' },
};

// Ukhai: short guttural words, clipped calls. Glosses are what the Grubenwacht teaches its hunters.
export const UKHAI = {
  grah: 'Feind!', tak: 'Jetzt!', ukhtak: 'Umgehen!', vosh: 'Zurück!', ishk: 'Leise!', zhikra: 'Licht! Feuer!',
  morghaal: 'Mutter unter dem Stein', shik: 'Ohr', solnakh: 'Sonnengänger (Mensch)', krahdun: 'Häuptling', ghu: 'Heim, Höhle',
  ree: 'Blut', drak: 'Kette', muur: 'Pilz', khar: 'Knochen', nakh: 'Mensch', vrek: 'Verwundet', ghor: 'Stirb', ulu: 'Ruft alle!',
};
/** Callouts by situation: [Ukhai, gloss]. */
export const UKHAI_CALLS = {
  spot: [['Grah! Sol-nakh!', 'Feind! Ein Sonnengänger!'], ['Grah! Grah!', 'Feind!'], ['Ishk… nakh ghu-ma.', 'Leise… ein Mensch im Heim.']],
  flank: [['Ukh-tak! Ukh-tak!', 'Umgehen!'], ['Ukh-tak, ree-shik!', 'Umgehen, holt sein Ohr!']],
  attack: [['Tak! Ghor!', 'Jetzt! Stirb!'], ['Shik! Shik!', 'Das Ohr!'], ['Ree! Ree!', 'Blut!']],
  fire: [['Zhikra! Zhikra!', 'Feuer!'], ['Vosh, zhikra!', 'Zurück, Licht!']],
  retreat: [['Vosh! Vosh!', 'Zurück!'], ['Vrek… vosh ghu.', 'Verwundet… zurück ins Heim.']],
  rally: [['Ulu! Mor-Ghaal ulu!', 'Alle her! Die Mutter ruft!'], ['Krah-dun ulu!', 'Der Häuptling ruft!']],
  death: [['Mor-Ghaal…', 'Mutter…'], ['Ghu…', 'Heim…']],
  idle: [['Mor-Ghaal ishk.', 'Die Mutter schweigt.'], ['Khar-vosh, khar-vosh…', '(ein leiser Gesang)'], ['Muur ree-ma.', 'Der Pilz ist reif.'], ['Drak… drak-ul.', 'Kette… zerbrochen.']],
};

/** The Grubenwacht: goblin hunters in Kronwacht, paying for ears and posting contracts on the tribes. */
export const GUILD = {
  name: 'Die Grubenwacht', hall: 'Grubenwachthaus', master: 'Brenna Rußhand',
  masterRole: 'MEISTERIN DER GRUBENWACHT',
  pitch: 'Fünf Kronen für jedes Ohr. Hundert für den Kopf eines Häuptlings. Keine Fragen, woher. Die Krone zahlt, ich zähle.',
  earPrice: 5, chiefBounty: 100,
  contracts: [
    { id: 'c_ears', title: 'Zehn Ohren', objective: 'Bringe der Grubenwacht zehn Goblinohren.', reward: 40 },
    { id: 'c_vosh', title: 'Das Lied verstummt', objective: 'Töte Vosh den Knochenrufer in der Klagenden Grube.', reward: 100, chief: 'schaedelsaenger' },
    { id: 'c_ghast', title: 'Moder und Mutter', objective: 'Töte Mutter Ghast in der Moderhöhle.', reward: 100, chief: 'pilzmuetter' },
    { id: 'c_ulgrak', title: 'Die letzte Kette', objective: 'Töte Ulgrak Kettenfaust in der Eisengrube.', reward: 120, chief: 'kettenbrecher' },
  ],
};
