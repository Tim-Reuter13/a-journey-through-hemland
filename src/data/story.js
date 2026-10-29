/**
 * ASHEN REALMS — Die Namen unter der Asche
 * Eigenständige, datengetriebene Erzählung für ein düsteres Fantasy-RPG.
 * Keine Three.js- oder Laufzeitabhängigkeiten. Siehe STORY.md.
 */

export const storyMetadata = {
  id: 'ashen-realms-namen',
  title: 'Ashen Realms: Die Namen unter der Asche',
  language: 'de-DE',
  version: '1.0.0',
  openingQuest: 'mq01',
  openingCutscene: 'cs_opening',
  defaultDialogue: 'dlg_mara_intro',
  startingFlags: {
    intro_complete: false,
    heard_bell: false,
    has_ledger: false,
    met_ilev: false,
    knows_bell_truth: false,
    has_heart_key: false,
    found_names: false,
    truth_public: false,
    archive_burned: false,
    town_saved: false,
    remembers_sister: false,
    saw_final_memory: false,
    mq_complete: false,
    mq_route: 'undecided',
    ending: '',
    sq01_complete: false,
    sq01_outcome: '',
    sq02_complete: false,
    sq02_outcome: '',
    sq03_complete: false,
    sq03_outcome: '',
    sq04_complete: false,
    sq04_outcome: '',
    refugees_safe: false,
    miners_freed: false,
    voices_restored: false,
    ward_repaired: false,
    council_support: false,
    chorus_support: false,
    people_support: false,
  },
  stateConventions: {
    condition: 'Alle angegebenen Flag-Werte müssen dem Spielzustand exakt entsprechen.',
    effect: 'effects ist ein Objekt aus Flag-Namen und neuen Werten; merge statt addieren.',
    next: 'Die optionale Antwort-Eigenschaft next ist eine Node-ID innerhalb desselben Dialogs; null beendet den Dialog.',
    events: 'events sind optionale Integrationssignale an Quest-, Inventar-, Cutscene- und Weltsysteme.',
    priority: 'Antworten mit requires erst nach Prüfung anzeigen; Antworten ohne requires sind immer sichtbar.',
  },
};

export const worldLore = {
  realm: {
    name: 'Veyr',
    epithet: 'Das Land, das sich an morgen erinnert und gestern vergisst',
    introduction: 'In Veyr fällt seit dreiunddreißig Jahren grauer Schnee. Tief unter den Bergen schlägt ein Herz aus Messing, das einst eine Seuche aufhalten sollte. Jeder Glockenschlag kostet jemanden eine Erinnerung.',
    atmosphere: ['Ascheregen', 'Glocken aus stumpfem Kupfer', 'Nasse Schieferdächer', 'Moore mit kalten Irrlichtern', 'Leise Stimmen in verlassenen Schächten'],
    centralTruth: 'Der Nachhall ist kein Geist und keine göttliche Strafe: Er ist ein Netz aus geraubten Erinnerungen. Das Herzwerk hält eine tödliche Aschekrankheit fern, weil lebendige Erinnerungen seine Schutzkreise speisen. Der Magistrat verschweigt die Opfer.',
  },
  timeline: [
    { yearsAgo: 204, title: 'Die Gründung der Dochtstädte', text: 'Küstenflüchtlinge erschließen das Tal und versprechen einander, niemals einen Namen aus ihren Totenbüchern zu streichen.' },
    { yearsAgo: 83, title: 'Der Graue Winter', text: 'Eine mineralische Sporenkrankheit zieht durch Bergwerke und Viehställe. Kranke vergessen erst Gesichter, dann das Atmen.' },
    { yearsAgo: 79, title: 'Die Erfindung des Herzwerks', text: 'Ingenieurin Sera Vann entdeckt, dass Erinnerungen die Sporenresonanz brechen. Ihr Prototyp schützt das erste Dorf und löscht ihre Kindheit aus.' },
    { yearsAgo: 33, title: 'Der Glockenbund', text: 'Der Magistrat verbindet die Schutzwerke und erhebt unbemerkt eine Erinnerungssteuer. Die Schmerzensschreie der Opfer werden als Nachhall bekannt.' },
    { yearsAgo: 2, title: 'Die Nacht ohne Morgen', text: 'Die Glocken schweigen neun Minuten. Menschen finden leere Kinderbetten, deren Bewohner sie nicht mehr benennen können.' },
    { yearsAgo: 0, title: 'Der Splitterfall', text: 'Am Nordturm bricht ein Glockenzahn ab. Verlorene Erinnerungen regnen als leuchtende Asche nieder. Die Handlung beginnt.' },
  ],
  locations: [
    { id: 'ashen_crossing', name: 'Aschenfurt', biome: 'market_town', description: 'Ein Handelsort aus Schiefer und mit Wachs abgedichteten Fenstern. Seine große Glocke schlägt auch ohne Wind.', ambience: ['nasser Pflasterstein', 'ferne Hammerschläge', 'müde Marktgespräche'] },
    { id: 'mourn_mire', name: 'Trauermoor', biome: 'swamp', description: 'Ein Moor voller vergessener Grabsteine. Wer einem Irrlicht folgt, hört eine Stimme aus einer Erinnerung, die nicht die eigene ist.', ambience: ['Insekten', 'Schilf', 'Wasserblasen'] },
    { id: 'cinder_mine', name: 'Die Kammbrüche', biome: 'mine', description: 'Ein Bergwerk, dessen Stützen mit Porträtplatten verstorbener Arbeiter verstärkt wurden.', ambience: ['Ketten', 'Steinschlag', 'tiefes Summen'] },
    { id: 'hush_abbey', name: 'Abtei der Stillen', biome: 'monastery', description: 'Ein Kloster ohne Glocken, in dem Mönche Erinnerungen in Wachszylindern aufbewahren.', ambience: ['Wind im Kreuzgang', 'Holzknarren', 'Flüstern'] },
    { id: 'salt_bridge', name: 'Salzbrücke', biome: 'ruins', description: 'Die einzige trockene Passage zwischen den Höfen und Aschenfurt. Auf beiden Seiten warten Menschen, die einander fürchten.', ambience: ['Sturm', 'knirschende Seile', 'Fluss'] },
    { id: 'heart_vault', name: 'Herzkammer', biome: 'ancient_machine', description: 'Eine kathedralengroße Maschine unter der Stadt. In Glasröhren treiben flüchtige Gesichter wie Fische.', ambience: ['Pulsieren', 'Schlagwerke', 'metallische Atemzüge'] },
  ],
  factions: [
    { id: 'magistrate', name: 'Magistrat der Dochte', creed: 'Ein gestohlenes Gestern ist besser als ein verlorenes Morgen.', publicGoal: 'Veyr vor der Aschekrankheit schützen.', secret: 'Der Rat lässt Erinnerungen an Verbrechen gezielt tilgen.' },
    { id: 'chorus', name: 'Chor der Namen', creed: 'Niemand darf über das Vergessen eines anderen entscheiden.', publicGoal: 'Die gestohlenen Erinnerungen zurückgeben.', secret: 'Eine radikale Gruppe will das Herzwerk sprengen, obwohl der Schutz dann versagt.' },
    { id: 'keepers', name: 'Bewahrer des letzten Lichts', creed: 'Erinnerung ist ein gemeinsames Feuer, keine Währung.', publicGoal: 'Den ursprünglichen, freiwilligen Schutzkreis wiederherstellen.', secret: 'Für den Umbau braucht es Zeugnisse und Zustimmung verfeindeter Gruppen.' },
  ],
  glossary: [
    { term: 'Nachhall', definition: 'Hörbare Reste ausgelöschter Erinnerungen, besonders bei Glockenschlag.' },
    { term: 'Eidglas', definition: 'Durchscheinendes Material, in dem ein Mensch eine Erinnerung freiwillig hinterlegen kann.' },
    { term: 'Aschekrankheit', definition: 'Von mineralischen Sporen ausgelöste Krankheit, die zuerst das Gedächtnis und später den Atem zerstört.' },
    { term: 'Herzwerk', definition: 'Maschinennetz aus Kupfer, Eidglas und Glocken. Es schützt Veyr, indem es menschliche Erinnerung verbraucht.' },
    { term: 'Unbenannte', definition: 'Menschen, deren Existenz fast vollständig aus fremdem Gedächtnis getilgt wurde.' },
  ],
  collectibles: [
    { id: 'lore_torn_bell', locationId: 'ashen_crossing', title: 'Brief unter dem Glockenfuß', text: 'An meine Tochter: Wenn du morgen nicht weißt, wer ich war, dann erinnere dich an den Geruch von warmem Brot. Das war ich, bevor sie mich geholt haben.' },
    { id: 'lore_miner_roll', locationId: 'cinder_mine', title: 'Schichtliste ohne Namen', text: 'Vierundzwanzig Lohnmarken. Neunzehn Unterschriften. Der Vorarbeiter behauptet, fünf Hände hätten nie existiert.' },
    { id: 'lore_seras_plan', locationId: 'hush_abbey', title: 'Seras erster Entwurf', text: 'Niemand darf das eigene Leben zum Brennstoff machen müssen. Der Kreis funktioniert auch mit kleinen, freiwilligen Erinnerungen vieler Menschen. Nicht vergessen: freiwillig.' },
    { id: 'lore_heart_wall', locationId: 'heart_vault', title: 'Inschrift an der Herzkammer', text: 'Ein Name ist nicht das, was du behältst. Ein Name ist das, was andere weigern sich zu verlieren.' },
  ],
};

export const characters = [
  { id: 'mara', name: 'Mara Venn', age: 46, role: 'Glockenwächterin', locationId: 'ashen_crossing', appearance: 'Grauer Mantel, rußige Finger, Messinghörrohr, ein fehlender Fingernagel.', temperament: 'Nüchtern, wachsam, trocken humorvoll.', want: 'Den Ort retten, auch wenn sie dafür erneut schuldig wird.', secret: 'Sie hat einst den Befehl zur ersten Erinnerungsabgabe unterschrieben.', connections: ['ilev', 'orun'], voice: { profile: 'de_female_low_rough', pace: 0.91, tone: 'tief, müde, kontrolliert' } },
  { id: 'ilev', name: 'Ilev Sar', age: 28, role: 'Archivar des Chors', locationId: 'hush_abbey', appearance: 'Dunkle Locken, Tinte an den Handflächen, eine silberne Maske am Gürtel.', temperament: 'Mitfühlend und unbequem ehrlich.', want: 'Die Wahrheit veröffentlichen, ohne ein zweites Massengrab zu schaffen.', secret: 'Er könnte die Mechanik zum Schutz Veyrs retten, verschweigt aber seine Angst vor einer neuen Herrschaft.', connections: ['mara', 'sera_echo'], voice: { profile: 'de_male_soft_clear', pace: 1.0, tone: 'ruhig, warm, bei Gefahr brüchig' } },
  { id: 'orun', name: 'Orun Kest', age: 58, role: 'Ratsherr des Magistrats', locationId: 'ashen_crossing', appearance: 'Makellose Handschuhe, zerbrochener Siegelring, schlaflose Augen.', temperament: 'Höflich, kalt in der Sache, aufrichtig beim Leid.', want: 'Die Schutzglocken um jeden Preis am Leben halten.', secret: 'Sein Sohn lebt, doch Orun hat dessen Gesicht für die Stadt geopfert.', connections: ['mara', 'nela'], voice: { profile: 'de_male_baritone', pace: 0.88, tone: 'präzise, getragen, autoritär' } },
  { id: 'nela', name: 'Nela Kest', age: 19, role: 'Uhrmacherin und Tochter des Ratsherrn', locationId: 'ashen_crossing', appearance: 'Drahtspangen im Haar, Lupenglas, schiefer Handschuh.', temperament: 'Neugierig, ungeduldig, mutig.', want: 'Wissen, warum ihr Vater jedes Jahr ein weiteres Kinderbild verbrennt.', secret: 'Sie erkennt Melodien, die niemand ihr beigebracht hat.', connections: ['orun', 'toma'], voice: { profile: 'de_female_bright', pace: 1.08, tone: 'direkt, schnell, empfindsam' } },
  { id: 'toma', name: 'Toma Rusk', age: 41, role: 'Anführer der Grubenarbeiter', locationId: 'cinder_mine', appearance: 'Breite Schultern, vernarbter Hals, mit Wachs versiegelte Helmritzen.', temperament: 'Stur, loyal, misstrauisch.', want: 'Seine Leute aus der Mine bringen und ihre Namen zurückholen.', secret: 'Er hat einen Freund geopfert, um einen Einsturz zu verhindern.', connections: ['nela', 'ved'], voice: { profile: 'de_male_hoarse', pace: 0.94, tone: 'rau, aber weich bei Familie' } },
  { id: 'ved', name: 'Ved die Fährfrau', age: 67, role: 'Fährfrau am Trauermoor', locationId: 'mourn_mire', appearance: 'Alte Seile als Gürtel, nasse Zöpfe, eine Laterne ohne Flamme.', temperament: 'Schalkhaft, geduldig, niemals sentimental.', want: 'Die letzten verlorenen Namen ins Totenbuch schreiben.', secret: 'Sie ist die erste freiwillige Trägerin des Schutzkreises.', connections: ['toma', 'sera_echo'], voice: { profile: 'de_female_aged', pace: 0.83, tone: 'kratzig, trocken, scharf in den Pausen' } },
  { id: 'eira', name: 'Eira Damm', age: 35, role: 'Heilerin der Brückenflüchtlinge', locationId: 'salt_bridge', appearance: 'Blau geflickter Umhang, Brandnarbe über der Braue.', temperament: 'Pragmatisch und entschieden.', want: 'Jedes Kind über die Brücke bringen.', secret: 'Ihre Heilmittel enthalten verdünnte Aschesporen.', connections: ['orun'], voice: { profile: 'de_female_mid', pace: 1.03, tone: 'fokussiert, körperlich erschöpft' } },
  { id: 'lorn', name: 'Lorn Asket', age: 51, role: 'Abt der Stillen', locationId: 'hush_abbey', appearance: 'Kahl rasierter Kopf, Schriften aus Wachs um die Handgelenke.', temperament: 'Sanft, dogmatisch, verschlossen.', want: 'Gefährliche Erinnerungen von der Welt fernhalten.', secret: 'Er versteckte Seras unzensierten Maschinenplan.', connections: ['ilev'], voice: { profile: 'de_male_whisper', pace: 0.87, tone: 'sehr leise, gemessene Silben' } },
  { id: 'sina', name: 'Sina aus dem Wachs', age: 14, role: 'Unbenanntes Kind', locationId: 'mourn_mire', appearance: 'Flickenrock, graue Hände, ein rotes Band ohne Besitzer.', temperament: 'Mutig, beobachtend, gelegentlich verspielt.', want: 'Dass jemand sich ihren Namen merkt.', secret: 'Sie bewahrt die Stimme einer verlorenen Schwester der Spielfigur.', connections: ['ved'], voice: { profile: 'de_young_soft', pace: 1.02, tone: 'klar, vorsichtig, nicht künstlich niedlich' } },
  { id: 'sera_echo', name: 'Sera Vann', age: 0, role: 'Gespeicherter Erinnerungsabdruck der Erfinderin', locationId: 'heart_vault', appearance: 'Gesicht aus Lichtflecken im schwebenden Eidglas.', temperament: 'Wissenschaftlich, selbstkritisch, hoffnungsvoll.', want: 'Ihren Fehler richtigstellen, ohne ein weiteres Leben zu besitzen.', secret: 'Das Herzwerk benötigt keine unfreiwilligen Opfer, sofern das Tal gemeinsam Verantwortung übernimmt.', connections: ['ilev', 'ved'], voice: { profile: 'de_female_austere', pace: 0.96, tone: 'klar, leicht hohl, menschlich' } },
];

const objective = (id, text, completeWhen, optional = false) => ({ id, text, completeWhen, optional });
const answer = (id, text, next, effects = {}, extra = {}) => ({ id, text, next, effects, ...extra });
const node = (id, speaker, text, options = [], extra = {}) => ({ id, speaker, text, options, ...extra });

export const dialogues = {
  dlg_mara_intro: {
    npcId: 'mara', start: 'start',
    nodes: [
      node('start', 'mara', 'Du bist vom Nordweg gekommen? Dann hast du die Glocke gehört. Sag mir nicht, sie klang normal.', [
        answer('ask_bell', 'Sie schlug. Danach rief jemand meinen Namen.', 'bell', { heard_bell: true }),
        answer('stay_guarded', 'Ich suche nur einen Schlafplatz.', 'guarded'),
      ], { emotion: 'skeptical' }),
      node('bell', 'mara', 'Dann ist es schlimmer, als ich dachte. Der Nachhall gibt nichts zurück, ohne etwas zu nehmen.', [answer('offer_help', 'Sag mir, wie ich helfen kann.', 'task')]),
      node('guarded', 'mara', 'Die Herberge ist voll mit Leuten, die sich heute an ihre Kinder nicht erinnern. Wenn du bleiben willst, mach dich nützlich.', [answer('offer_help', 'Was muss ich tun?', 'task')]),
      node('task', 'mara', 'Unter dem Glockenfuß liegt ein Wartungsbuch. Hol es, bevor die Männer des Rates es verbrennen. Und sieh nicht zu lange in das Eidglas.', [answer('accept', 'Ich hole das Buch.', null, { intro_complete: true }, { events: [{ type: 'questStart', id: 'mq01' }, { type: 'objectiveActivate', id: 'mq01_find_ledger' }] })]),
    ],
  },
  dlg_mara_ledger: {
    npcId: 'mara', start: 'start',
    nodes: [
      node('start', 'mara', 'Das Siegel auf dem Buch... Ich habe es selbst damals geschlossen. Es war eine Abstimmung ohne Gegenstimme.', [
        answer('challenge', 'Du wusstest, was das Herzwerk den Menschen nimmt?', 'confess'),
        answer('sympathize', 'Ihr hattet Angst vor der Krankheit.', 'fear'),
      ], { emotion: 'ashamed' }),
      node('confess', 'mara', 'Ja. Ich habe die Rechnung gesehen und trotzdem unterschrieben. Wenn du mich hasst, schließ dich hinten an.', [answer('to_abbey', 'Wo finde ich die ursprünglichen Pläne?', 'lead')]),
      node('fear', 'mara', 'Angst macht aus einer Entscheidung keine gute. Nur eine erklärbare.', [answer('to_abbey', 'Woher kommt diese Maschine?', 'lead')]),
      node('lead', 'mara', 'Zur Abtei der Stillen. Frag nach Ilev Sar. Und lass den Rat nicht merken, dass du das Buch trägst.', [answer('finish', 'Ich finde ihn.', null, { has_ledger: true }, { events: [{ type: 'questComplete', id: 'mq01' }, { type: 'questStart', id: 'mq02' }, { type: 'cutscene', id: 'cs_ledger' }] })]),
    ],
  },
  dlg_ilev_first: {
    npcId: 'ilev', start: 'start',
    nodes: [
      node('start', 'ilev', 'Bei uns klingelt niemand. Wer eine Erinnerung zurückhaben will, muss zuerst die eigene Geschichte erzählen.', [
        answer('show', 'Ich habe Maras Wartungsbuch.', 'ledger', {}, { requires: { has_ledger: true } }),
        answer('ask', 'Was ist der Nachhall?', 'explain'),
      ]),
      node('explain', 'ilev', 'Ein Echo hat keinen Hunger. Das hier schon. Ein Glockenschlag kostet keine Zeit, sondern gelebte Jahre.', [answer('show', 'Dann lies dieses Buch.', 'ledger', {}, { requires: { has_ledger: true } }), answer('leave', 'Ich komme wieder.', null)]),
      node('ledger', 'ilev', 'Hier steht die Zahl der Spenden. Und daneben eine Spalte für nicht einwilligende Spender. Das ist keine Buchführung. Das ist eine Beichte.', [
        answer('publish', 'Wir müssen es öffentlich machen.', 'public', { mq_route: 'truth' }),
        answer('study', 'Erst herausfinden, ob der Schutz ohne Opfer hält.', 'study', { mq_route: 'repair' }),
      ], { emotion: 'angry' }),
      node('public', 'ilev', 'Wahrheit ist ein Messer. Ich helfe dir, aber wir müssen aufpassen, wen wir damit treffen.', [answer('continue', 'Zeig mir den alten Entwurf.', 'finish')]),
      node('study', 'ilev', 'Das ist die schwierigere Frage. Gut. Die einfacheren Antworten haben uns hierhergebracht.', [answer('continue', 'Zeig mir den alten Entwurf.', 'finish')]),
      node('finish', 'ilev', 'Sera Vann verbarg den Schlüssel im Trauermoor. Ved kennt jeden Weg dort. Nimm dieses Wachssiegel.', [answer('take_seal', 'Ich suche Ved.', null, { met_ilev: true }, { events: [{ type: 'questComplete', id: 'mq02' }, { type: 'questStart', id: 'mq03' }, { type: 'cutscene', id: 'cs_abbey' }, { type: 'itemGrant', id: 'abbey_seal' }] })]),
    ],
  },
  dlg_ved_ferry: {
    npcId: 'ved', start: 'start',
    nodes: [
      node('start', 'ved', 'Ein Fremder mit einem Klostersiegel. Ihr seid alle sehr erfinderisch, wenn ihr Angst habt.', [
        answer('direct', 'Ich suche Seras Schlüssel.', 'riddle'),
        answer('polite', 'Was verlangt die Überfahrt?', 'price'),
      ]),
      node('price', 'ved', 'Kein Geld. Sag mir den Namen eines Menschen, den du vermisst. Und meine Fähre fährt.', [answer('remember', 'Meine Schwester. Ich erinnere mich nicht an ihren Namen.', 'riddle', { remembers_sister: true })]),
      node('riddle', 'ved', 'Sera ließ kein Schloss für Diebe bauen. Ein Name öffnet es, aber nur, wenn du begreifst: Erinnern ist keine Besitzurkunde.', [
        answer('promise', 'Ich trage die Namen weiter, auch wenn sie mir weh tun.', 'key', { people_support: true }),
        answer('force', 'Genug Rätsel. Gib den Schlüssel heraus.', 'key'),
      ]),
      node('key', 'ved', 'Hinter den bleichen Weiden liegt ein Stein mit drei Kerben. Darunter schläft das Eidglas. Lass die Stimmen ausreden.', [answer('thanks', 'Ich werde zuhören.', null, { has_heart_key: true }, { events: [{ type: 'itemGrant', id: 'heart_key' }, { type: 'questComplete', id: 'mq03' }, { type: 'questStart', id: 'mq04' }, { type: 'cutscene', id: 'cs_mire' }] })]),
    ],
  },
  dlg_sina_memory: {
    npcId: 'sina', start: 'start',
    nodes: [
      node('start', 'sina', 'Die Leute schauen an mir vorbei. Manchmal auch durch mich. Du tust das nicht.', [
        answer('name', 'Wie heißt du?', 'name'),
        answer('afraid', 'Bist du ein Geist?', 'ghost'),
      ]),
      node('ghost', 'sina', 'Nein. Geister werden wenigstens betrauert.', [answer('name', 'Dann sag mir deinen Namen.', 'name')]),
      node('name', 'sina', 'Sina. Sprich ihn noch einmal aus. Nur damit ich weiß, wie er in deinem Mund klingt.', [
        answer('repeat', 'Sina. Ich werde dich nicht vergessen.', 'trust', { found_names: true, chorus_support: true }),
        answer('refuse', 'Ich kann dir nichts versprechen.', 'sad'),
      ]),
      node('trust', 'sina', 'Deine Schwester hat das auch gesagt, damals vor der Stille. Ich kann dir ihre Stimme zeigen, wenn du bereit bist.', [answer('hear', 'Zeig sie mir.', null, { remembers_sister: true }, { events: [{ type: 'cutscene', id: 'cs_sister' }] })], { emotion: 'hopeful' }),
      node('sad', 'sina', 'Wenigstens hast du nicht gelogen. Das ist mehr als die meisten.', [answer('leave', 'Es tut mir leid.', null)]),
    ],
  },
  dlg_orun_offer: {
    npcId: 'orun', start: 'start',
    nodes: [
      node('start', 'orun', 'Ich weiß, was du trägst. Ich weiß auch, wie viele Kinder sterben, wenn die Glocken schweigen.', [
        answer('accuse', 'Du hast den Menschen ihr Leben gestohlen.', 'accuse'),
        answer('listen', 'Gibt es einen anderen Weg?', 'alternative'),
      ]),
      node('accuse', 'orun', 'Ich habe ihnen Jahre gestohlen. Der Tod hätte ihnen alle genommen. Das ist keine Entschuldigung, nur meine Rechnung.', [answer('alternative', 'Zeig mir die zweite Rechnung.', 'alternative')]),
      node('alternative', 'orun', 'Sera zeichnete ein freiwilliges Netz. Dafür müsste der Rat Macht abgeben und der Chor das Herzwerk vorerst am Leben lassen.', [
        answer('support', 'Dann zwing beide Seiten zu Verhandlungen.', 'parley', { council_support: true }),
        answer('reject', 'Niemand darf entscheiden, welche Erinnerung zählt.', 'warn'),
      ]),
      node('parley', 'orun', 'Dann bring mir Beweise, dass die Schutzkreise repariert werden können. Meine Unterschrift bekommt niemand auf bloße Hoffnung.', [answer('close', 'Du erhältst deine Beweise.', null, { knows_bell_truth: true }, { events: [{ type: 'questComplete', id: 'mq04' }, { type: 'questStart', id: 'mq05' }] })]),
      node('warn', 'orun', 'Wenn du alle Fesseln zerreißt, wird die Krankheit nicht nach Gerechtigkeit fragen.', [answer('close', 'Ich treffe die Entscheidung selbst.', null, { knows_bell_truth: true }, { events: [{ type: 'questComplete', id: 'mq04' }, { type: 'questStart', id: 'mq05' }] })]),
    ],
  },
  dlg_lorn_plan: {
    npcId: 'lorn', start: 'start',
    nodes: [
      node('start', 'lorn', 'Sera schrieb zwei Baupläne. Einer war für Könige. Der andere für Menschen. Ich habe den zweiten weggeschlossen.', [
        answer('demand', 'Gib ihn heraus.', 'judgment'),
        answer('why', 'Warum hast du ihn versteckt?', 'confession'),
      ]),
      node('confession', 'lorn', 'Weil auch freiwillige Opfer erzwungen werden können, wenn alle auf einen zeigen und sagen: Du bist der Letzte, der noch nein sagt.', [answer('demand', 'Trotzdem müssen wir es versuchen.', 'judgment')]),
      node('judgment', 'lorn', 'Der Plan braucht drei Stimmen: Rat, Chor und die Menschen ohne Siegel. Nicht drei Herrscher. Drei gleichwertige Zeugen.', [answer('receive', 'Dann sollen alle mitreden.', null, { found_names: true }, { events: [{ type: 'itemGrant', id: 'seras_blueprint' }, { type: 'cutscene', id: 'cs_blueprint' }] })]),
    ],
  },
  dlg_heart_echo: {
    npcId: 'sera_echo', start: 'start',
    nodes: [
      node('start', 'sera_echo', 'Ich bin nicht Sera. Ich bin die Form ihres letzten Gedankens. Bitte verwechselt die Stimme nicht mit einer Seele.', [
        answer('ask', 'Kannst du das Herzwerk retten?', 'answer'),
        answer('blame', 'Deine Maschine hat unzählige Leben zerstört.', 'guilt'),
      ]),
      node('guilt', 'sera_echo', 'Ja. Das kleinste ehrliche Wort ist manchmal das schwerste.', [answer('ask', 'Gibt es eine andere Lösung?', 'answer')]),
      node('answer', 'sera_echo', 'Drei Wege. Erhalte die Glocke und die heimliche Steuer. Zerbrich sie und die Schutzfelder fallen. Oder verteile das Gewicht auf freiwillige, widerrufbare Erinnerungen.', [
        answer('end_rule', 'Ich übernehme die Steuerung des Herzwerks.', 'rule', { ending: 'iron_bell' }),
        answer('end_break', 'Niemand wird hier je wieder Erinnerungen bezahlen.', 'break', { ending: 'open_ash' }),
        answer('end_share', 'Wir bauen den Kreis gemeinsam neu.', 'share', { ending: 'shared_flame' }, { requires: { ward_repaired: true, council_support: true, chorus_support: true, people_support: true, found_names: true } }),
      ], { emotion: 'solemn' }),
      node('rule', 'sera_echo', 'Die Glocken bleiben. Das Tal atmet. Aber jedes Läuten wird dich daran erinnern, wer die Rechnung bezahlt.', [answer('confirm', 'Ich trage diese Schuld.', null, { mq_complete: true, town_saved: true }, { events: [{ type: 'questComplete', id: 'mq06' }, { type: 'cutscene', id: 'cs_end_iron' }] })]),
      node('break', 'sera_echo', 'Dann gib ihnen ihre Stimmen zurück. Die Asche wird kommen. Aber niemand wird mehr heimlich verschwinden.', [answer('confirm', 'Die Menschen sollen die Wahrheit kennen.', null, { mq_complete: true, truth_public: true }, { events: [{ type: 'questComplete', id: 'mq06' }, { type: 'cutscene', id: 'cs_end_ash' }] })]),
      node('share', 'sera_echo', 'Du hast etwas getan, das ich nicht vermochte. Du hast die Frage nicht für sie beantwortet. Du hast sie gefragt.', [answer('confirm', 'Das erste Wort gehört allen.', null, { mq_complete: true, town_saved: true, truth_public: true }, { events: [{ type: 'questComplete', id: 'mq06' }, { type: 'cutscene', id: 'cs_end_shared' }] })], { emotion: 'relieved' }),
    ],
  },
  dlg_toma_mine: {
    npcId: 'toma', start: 'start',
    nodes: [
      node('start', 'toma', 'Fünf meiner Leute stehen auf keiner Liste mehr. Ich kann dir ihre Narben beschreiben. Ich kann dir nicht sagen, wie sie hießen.', [
        answer('help', 'Wir bringen die Schichtliste zum Tageslicht.', 'rescue'),
        answer('pay', 'Der Magistrat bezahlt für Schweigen.', 'bribe'),
      ]),
      node('rescue', 'toma', 'Dann löse die Sperre am Entlüftungsschacht. Ohne Atemluft sterben die Lebenden, bevor wir die Toten beim Namen nennen.', [answer('accept', 'Ich öffne den Schacht.', null, {}, { events: [{ type: 'questStart', id: 'sq01' }, { type: 'objectiveActivate', id: 'sq01_valve' }] })]),
      node('bribe', 'toma', 'Und was kaufst du dir mit einem Schweigen? Einen warmen Mantel? Die Winter hier werden nicht mehr wärmer.', [answer('rethink', 'Du hast recht. Ich helfe.', 'rescue'), answer('leave', 'Ich entscheide später.', null)]),
    ],
  },
  dlg_toma_result: {
    npcId: 'toma', start: 'start',
    nodes: [
      node('start', 'toma', 'Der Schacht ist offen. Jetzt können wir die Namen hinausbringen. Oder die Liste verkaufen und Lebensmittel für einen Winter kaufen.', [
        answer('truth', 'Veröffentliche die Namen.', 'truth', { sq01_outcome: 'names', miners_freed: true, people_support: true, chorus_support: true }),
        answer('food', 'Verkaufe die Liste. Die Lebenden brauchen Essen.', 'food', { sq01_outcome: 'bread', miners_freed: true, council_support: true }),
      ]),
      node('truth', 'toma', 'Dann stehen sie morgen auf unserer Mauer. Und wir sagen die Namen laut, bis niemand mehr behaupten kann, sie hätten nie gelebt.', [answer('close', 'Ich komme zur Verlesung.', null, { sq01_complete: true }, { events: [{ type: 'questComplete', id: 'sq01' }] })]),
      node('food', 'toma', 'Ich werde das Brot essen. Aber ich weiß nicht, ob ich es schmecken kann.', [answer('close', 'Die Entscheidung gehört dir.', null, { sq01_complete: true }, { events: [{ type: 'questComplete', id: 'sq01' }] })]),
    ],
  },
  dlg_eira_bridge: {
    npcId: 'eira', start: 'start',
    nodes: [
      node('start', 'eira', 'Der Rat hat die Brücke gesperrt. Drei Kinder haben Fieber, und ein Wachmann zählt unsere Messer, nicht unsere Gesichter.', [
        answer('smuggle', 'Ich kenne einen Weg unter den Streben.', 'smuggle', {}, { events: [{ type: 'questStart', id: 'sq02' }] }),
        answer('negotiate', 'Ich spreche mit der Wache.', 'negotiate', {}, { events: [{ type: 'questStart', id: 'sq02' }] }),
      ]),
      node('smuggle', 'eira', 'Bei Flut werden die unteren Balken nass. Ich werde dir vertrauen, aber wenn jemand fällt, gibt es kein zweites Ufer.', [answer('finish', 'Ich sichere den Übergang.', null, { sq02_outcome: 'hidden_path', refugees_safe: true, people_support: true, sq02_complete: true }, { events: [{ type: 'questComplete', id: 'sq02' }, { type: 'worldChange', id: 'refugees_arrive_unseen' }] })]),
      node('negotiate', 'eira', 'Ein Wachmann hört nur auf Siegel. Vielleicht gibt der Rat nach, wenn du dich öffentlich für uns verbürgst.', [answer('pledge', 'Ich bürge mit meinem Namen.', null, { sq02_outcome: 'public_promise', refugees_safe: true, council_support: true, people_support: true, sq02_complete: true }, { events: [{ type: 'questComplete', id: 'sq02' }, { type: 'worldChange', id: 'refugees_enter_public' }] }), answer('retreat', 'Ich suche einen anderen Weg.', null)]),
    ],
  },
  dlg_nela_voices: {
    npcId: 'nela', start: 'start',
    nodes: [
      node('start', 'nela', 'Mein Vater verbrennt jedes Jahr das gleiche Bild. Und jedes Jahr malt er es neu. Würdest du das tun, wenn du dich erinnern könntest?', [
        answer('ask', 'Wessen Gesicht ist es?', 'face', {}, { events: [{ type: 'questStart', id: 'sq03' }] }),
        answer('avoid', 'Vielleicht schützt er dich vor etwas.', 'defend', {}, { events: [{ type: 'questStart', id: 'sq03' }] }),
      ]),
      node('face', 'nela', 'Ich höre nachts eine Stimme aus seinem alten Phonographen. Ich glaube, sie gehört meinem Bruder. Ich kann sie nicht festhalten.', [answer('choose', 'Was möchtest du tun?', 'choice')]),
      node('defend', 'nela', 'Vor der Wahrheit? Ich möchte entscheiden, ob ich sie aushalte.', [answer('choose', 'Dann entscheiden wir gemeinsam.', 'choice')]),
      node('choice', 'nela', 'Wir können die Wachswalze spielen. Oder sie einschmelzen, damit niemand mit seiner Stimme handeln kann.', [
        answer('play', 'Hör sie an. Auch Schmerz gehört zu dir.', 'restore', { sq03_outcome: 'remember', voices_restored: true, chorus_support: true }),
        answer('melt', 'Vernichte die Walze. Seine Stimme gehört keiner Maschine.', 'silence', { sq03_outcome: 'silence', council_support: true }),
      ]),
      node('restore', 'nela', 'Er hat mir früher immer die gleichen drei Töne gepfiffen. Jetzt erinnere ich mich. Das ist schön. Und schrecklich.', [answer('close', 'Du musst beides nicht allein tragen.', null, { sq03_complete: true }, { events: [{ type: 'questComplete', id: 'sq03' }, { type: 'cutscene', id: 'cs_nela' }] })]),
      node('silence', 'nela', 'Ich kann ihn nicht kennen. Aber wenigstens wird niemand seine Stimme verkaufen.', [answer('close', 'Es war deine Entscheidung.', null, { sq03_complete: true }, { events: [{ type: 'questComplete', id: 'sq03' }] })]),
    ],
  },
  dlg_ved_repair: {
    npcId: 'ved', start: 'start',
    nodes: [
      node('start', 'ved', 'Da unten steht noch Seras erster Docht. Nicht viel größer als eine Kinderhand. Er brennt ohne jemanden zu verbrauchen.', [
        answer('repair', 'Wie repariere ich ihn?', 'help', {}, { events: [{ type: 'questStart', id: 'sq04' }] }),
        answer('distrust', 'Warum hast du ihn so lange versteckt?', 'history', {}, { events: [{ type: 'questStart', id: 'sq04' }] }),
      ]),
      node('history', 'ved', 'Ich dachte, wenn ich das kleine Licht schütze, bewahre ich die große Hoffnung. Ich habe zu lange gewartet.', [answer('repair', 'Zeig mir, was ich tun muss.', 'help')]),
      node('help', 'ved', 'Im Moor liegen drei Eidglassplitter. Setz sie in die Halterung und sprich die Namen der ersten freiwilligen Träger.', [answer('accept', 'Ich finde die Splitter.', null, {}, { events: [{ type: 'objectiveActivate', id: 'sq04_shards' }] })]),
    ],
  },
  dlg_ved_repair_done: {
    npcId: 'ved', start: 'start',
    nodes: [
      node('start', 'ved', 'Hörst du? Kein Schrei. Nur ein Summen. So hätte es immer klingen sollen.', [
        answer('share', 'Wir geben den Entwurf allen drei Gruppen.', 'share', { sq04_outcome: 'shared', ward_repaired: true, people_support: true }),
        answer('hide', 'Wir behalten die Entdeckung für uns.', 'hide', { sq04_outcome: 'hidden', ward_repaired: true }),
      ]),
      node('share', 'ved', 'Dann sei nicht überrascht, wenn sie streiten. Frieden ist nicht Stille. Frieden ist, wenn sie bleiben und trotzdem reden.', [answer('finish', 'Sie werden davon erfahren.', null, { sq04_complete: true }, { events: [{ type: 'questComplete', id: 'sq04' }, { type: 'worldChange', id: 'ward_glows_clean' }] })]),
      node('hide', 'ved', 'Ein Licht unter einem Eimer ist immer noch Licht. Aber niemand findet dadurch nach Hause.', [answer('finish', 'Ich trage die Verantwortung.', null, { sq04_complete: true }, { events: [{ type: 'questComplete', id: 'sq04' }] })]),
    ],
  },
  dlg_final_council: {
    npcId: 'orun', start: 'start',
    nodes: [
      node('start', 'orun', 'Die Herzkammer ist offen. Meine Wachen folgen mir noch. Die Menschen vielleicht nicht mehr.', [
        answer('appeal', 'Gib deine Stimme dem freiwilligen Kreis.', 'yes', { council_support: true }, { requires: { ward_repaired: true, found_names: true } }),
        answer('expose', 'Jeder soll das geheime Steuerbuch lesen.', 'exposed', { truth_public: true, chorus_support: true }),
        answer('leave', 'Wir werden uns dort unten wiedersehen.', null),
      ]),
      node('yes', 'orun', 'Ich werde unterschreiben. Und dieses Mal lasse ich die Namen derer aufschreiben, die nein sagen.', [answer('finish', 'Dann komm zur Herzkammer.', null, { council_support: true }, { events: [{ type: 'cutscene', id: 'cs_council' }] })]),
      node('exposed', 'orun', 'Du wirst mich stürzen. Vielleicht ist das nötig. Aber vergiss die Kranken nicht, wenn sie morgen an deine Tür klopfen.', [answer('finish', 'Ich vergesse sie nicht.', null, {}, { events: [{ type: 'cutscene', id: 'cs_council' }] })]),
    ],
  },
};

export const mainQuest = {
  id: 'mq_ashen_names',
  title: 'Die Namen unter der Asche',
  premise: 'Nachdem eine Glocke den Namen einer vergessenen Schwester flüstert, entdeckt die Spielfigur ein Schutzsystem, das Menschen das Gedächtnis raubt. Drei Wege zur Zukunft liegen unter Aschenfurt.',
  chapters: [
    { id: 'mq01', act: 1, title: 'Wenn die Glocke deinen Namen kennt', locationId: 'ashen_crossing', giverId: 'mara', startDialogue: 'dlg_mara_intro', objectives: [objective('mq01_meet_mara', 'Sprich mit Mara am Glockenturm.', 'intro_complete'), objective('mq01_find_ledger', 'Untersuche den Glockenfuß und sichere das Wartungsbuch.', 'has_ledger')], completionDialogue: 'dlg_mara_ledger', onComplete: ['cs_ledger'], reward: { experience: 250, items: ['ledger_copy'] }, summary: 'Die alte Glocke stiehlt nicht nur die Ruhe, sondern Erinnerungen.' },
    { id: 'mq02', act: 1, title: 'Die Bibliothek des Schweigens', locationId: 'hush_abbey', giverId: 'ilev', startDialogue: 'dlg_ilev_first', objectives: [objective('mq02_find_ilev', 'Finde Ilev in der Abtei.', 'met_ilev'), objective('mq02_read_records', 'Lies die Aufzeichnungen über die Erinnerungssteuer.', 'met_ilev')], onComplete: ['cs_abbey'], reward: { experience: 340, items: ['abbey_seal'] }, summary: 'Die angeblichen freiwilligen Opfer wurden systematisch erzwungen.' },
    { id: 'mq03', act: 2, title: 'Das Moor vergisst niemanden', locationId: 'mourn_mire', giverId: 'ved', startDialogue: 'dlg_ved_ferry', objectives: [objective('mq03_find_ved', 'Finde Veds Fähre.', 'has_heart_key'), objective('mq03_claim_key', 'Berge Seras Schlüssel aus dem Eidglas.', 'has_heart_key')], onComplete: ['cs_mire'], reward: { experience: 450, items: ['heart_key'] }, summary: 'Die Fährfrau trägt das letzte Geheimnis der Erfinderin.' },
    { id: 'mq04', act: 2, title: 'Die Rechnung des Rates', locationId: 'ashen_crossing', giverId: 'orun', startDialogue: 'dlg_orun_offer', objectives: [objective('mq04_confront', 'Konfrontiere Orun mit der Erinnerungssteuer.', 'knows_bell_truth'), objective('mq04_find_evidence', 'Erfahre vom freiwilligen Schutzkreis.', 'knows_bell_truth')], onComplete: ['cs_council'], reward: { experience: 520 }, summary: 'Orun räumt seine Schuld ein, aber warnt vor dem Kollaps des Schutzwerks.' },
    { id: 'mq05', act: 3, title: 'Drei Stimmen gegen die Stille', locationId: 'hush_abbey', giverId: 'lorn', startDialogue: 'dlg_lorn_plan', objectives: [objective('mq05_blueprint', 'Sichere Seras ursprünglichen Bauplan.', 'found_names'), objective('mq05_repair', 'Repariere den freiwilligen Schutzkreis.', 'ward_repaired', true), objective('mq05_council', 'Gewinne die Zustimmung des Rates.', 'council_support', true), objective('mq05_chorus', 'Gewinne die Zustimmung des Chors.', 'chorus_support', true), objective('mq05_people', 'Gewinne die Zustimmung der Bewohner.', 'people_support', true)], optionalQuests: ['sq01', 'sq02', 'sq03', 'sq04'], nextChapter: 'mq06', reward: { experience: 650 }, summary: 'Der friedliche Weg ist möglich, aber nur mit freiwilliger Mitwirkung.' },
    { id: 'mq06', act: 3, title: 'Der letzte Glockenschlag', locationId: 'heart_vault', giverId: 'sera_echo', startDialogue: 'dlg_heart_echo', objectives: [objective('mq06_enter', 'Betritt die Herzkammer.', 'saw_final_memory'), objective('mq06_decide', 'Entscheide über die Zukunft des Herzwerks.', 'mq_complete')], onComplete: ['cs_end_iron', 'cs_end_ash', 'cs_end_shared'], reward: { experience: 1500 }, summary: 'Deine Entscheidung bestimmt, ob Veyr sicher, frei oder gemeinsam beides sein kann.' },
  ],
  endings: [
    { id: 'iron_bell', title: 'Der eiserne Morgen', condition: { ending: 'iron_bell' }, cutsceneId: 'cs_end_iron', outcome: 'Die Stadt überlebt; die geheime Erinnerungssteuer bleibt und die Spielfigur wird zu ihrer Hüterin.', epilogue: 'Der Markt öffnete wieder. Nur bei jedem siebten Glockenschlag blieb jemand stehen und suchte ein Gesicht, das nicht mehr da war.' },
    { id: 'open_ash', title: 'Ein Himmel ohne Glocken', condition: { ending: 'open_ash' }, cutsceneId: 'cs_end_ash', outcome: 'Alle geraubten Erinnerungen kehren zurück. Die Schutzfelder versagen; Veyr muss evakuiert werden und das Land verliert viele Bewohner.', epilogue: 'Zum ersten Mal seit Jahrzehnten wusste jeder, wen er vermisste. Die Wege waren voll von Menschen, die mit ihrem ganzen Schmerz in eine ungewisse Zukunft gingen.' },
    { id: 'shared_flame', title: 'Das geteilte Licht', condition: { ending: 'shared_flame' }, cutsceneId: 'cs_end_shared', requires: { ward_repaired: true, council_support: true, chorus_support: true, people_support: true, found_names: true }, outcome: 'Die Schutzlast wird transparent, freiwillig und widerrufbar verteilt; alle Gruppen erhalten eine gleichberechtigte Stimme.', epilogue: 'Die erste Glocke aus dem neuen Eidglas schlug nicht. Sie sang. Und jeder Mensch durfte selbst entscheiden, welche Erinnerung er in das Licht stellte.' },
  ],
};

export const sideQuests = [
  { id: 'sq01', title: 'Die Namen unter Stein', locationId: 'cinder_mine', giverId: 'toma', dialogueId: 'dlg_toma_mine', completionDialogue: 'dlg_toma_result', summary: 'Befreie Grubenarbeiter und entscheide zwischen öffentlicher Wahrheit und dringend benötigten Vorräten.', objectives: [objective('sq01_valve', 'Öffne die Entlüftung im untersten Stollen.', 'mine_valve_open'), objective('sq01_choice', 'Entscheide über die gestohlene Schichtliste.', 'sq01_complete')], outcomes: [{ id: 'names', impact: 'Die Namen werden öffentlich; der Chor und die Bürger gewinnen Vertrauen.' }, { id: 'bread', impact: 'Der Rat zahlt Lebensmittel; die Familien bleiben ohne vollständige Wahrheit.' }], reward: { experience: 420, item: 'miner_token' } },
  { id: 'sq02', title: 'Die Brücke, die niemand bezahlt', locationId: 'salt_bridge', giverId: 'eira', dialogueId: 'dlg_eira_bridge', summary: 'Bringe kranke Flüchtlinge durch heimliche Hilfe oder öffentliche Bürgschaft nach Aschenfurt.', objectives: [objective('sq02_route', 'Finde einen sicheren Übergang.', 'refugees_safe')], outcomes: [{ id: 'hidden_path', impact: 'Flüchtlinge kommen heimlich an, das Vertrauen des Rates sinkt nicht weiter.' }, { id: 'public_promise', impact: 'Öffentliche Aufnahme; beide Seiten müssen künftig zu ihren Zusagen stehen.' }], reward: { experience: 360, item: 'eiras_bandage' } },
  { id: 'sq03', title: 'Drei Töne für einen Bruder', locationId: 'ashen_crossing', giverId: 'nela', dialogueId: 'dlg_nela_voices', summary: 'Nela findet die Stimme ihres ausgelöschten Bruders. Lässt du die Erinnerung zurückkehren oder schützt du sie vor Missbrauch?', objectives: [objective('sq03_voice', 'Untersuche den Wachsphonographen.', 'sq03_complete')], outcomes: [{ id: 'remember', impact: 'Nela gewinnt eine schmerzliche Erinnerung und unterstützt den Chor.' }, { id: 'silence', impact: 'Die Aufnahme wird zerstört, wodurch ihre Stimme nicht länger ausgebeutet werden kann.' }], reward: { experience: 300, item: 'clockwork_locket' } },
  { id: 'sq04', title: 'Der letzte Docht', locationId: 'mourn_mire', giverId: 'ved', dialogueId: 'dlg_ved_repair', completionDialogue: 'dlg_ved_repair_done', summary: 'Repariere einen Prototyp des freiwilligen Schutzkreises und entscheide, wem das Wissen gehört.', objectives: [objective('sq04_shards', 'Finde drei Eidglassplitter im Trauermoor.', 'ward_shards_collected'), objective('sq04_ignite', 'Entzünde den ersten Docht ohne Erinnerungsopfer.', 'ward_repaired')], outcomes: [{ id: 'shared', impact: 'Der Prototyp wird öffentlich; der beste Schluss wird erreichbar.' }, { id: 'hidden', impact: 'Der Prototyp funktioniert, bleibt aber verborgen.' }], reward: { experience: 500, item: 'clean_eidglass' } },
];

export const cutscenes = [
  { id: 'cs_opening', title: 'Die Glocke weiß deinen Namen', trigger: 'new_game', durationSeconds: 43, shots: [
    { id: 'a', seconds: [0, 11], camera: 'Langsame Luftfahrt über Schieferdächer; Asche steigt gegen den Wind.', action: 'Eine Glocke bewegt sich lautlos. Ihr Klöppel wirft keinen Schatten.', lines: [{ speaker: 'narrator', text: 'In Veyr sterben die Menschen selten an ihren Wunden. Sie sterben an dem, was von ihnen vergessen wird.', emotion: 'grave' }] },
    { id: 'b', seconds: [11, 27], camera: 'Halbnahe auf das Gesicht der Spielfigur, dann harter Schnitt auf den Glockenturm.', action: 'Ein einzelner Schlag; alle Passanten erstarren, eine Mutter lässt einen Kinderhandschuh fallen.', lines: [{ speaker: 'unknown', text: 'Du hast versprochen, mich nicht zu vergessen.', emotion: 'whisper' }] },
    { id: 'c', seconds: [27, 43], camera: 'Kranfahrt in die enge Gasse; weicher Übergang in die spielbare Perspektive.', action: 'Mara löscht eine Laterne, obwohl es noch Tag ist.', lines: [{ speaker: 'mara', text: 'Wenn du diese Stimme gehört hast, komm zu mir. Und frag besser nicht, warum ich auf dich gewartet habe.', emotion: 'urgent' }] },
  ] },
  { id: 'cs_ledger', title: 'Die Schuld in Tinte', trigger: 'mq01_complete', durationSeconds: 27, shots: [
    { id: 'a', seconds: [0, 13], camera: 'Extreme Nahaufnahme eines geöffneten Buchs; die Kamera verfolgt eine Zeile in verwischter Tinte.', action: 'Unter der Überschrift Freiwillige erscheint die Spalte Ersatzabgaben.', lines: [{ speaker: 'mara', text: 'Dreiunddreißig Jahre. So lange habe ich versucht, diese Seite nicht wiederzusehen.', emotion: 'ashamed' }] },
    { id: 'b', seconds: [13, 27], camera: 'Gegenschuss über Maras Schulter zum Glockenturm im Regen.', action: 'Mara schließt das Buch nicht. Sie hält es offen.', lines: [{ speaker: 'mara', text: 'Nimm sie mit. Die Wahrheit muss endlich schwerer wiegen als meine Angst.', emotion: 'resolute' }] },
  ] },
  { id: 'cs_abbey', title: 'Das Archiv atmet', trigger: 'mq02_complete', durationSeconds: 23, shots: [
    { id: 'a', seconds: [0, 12], camera: 'Langsame Kamerafahrt entlang von Wachszylindern; Gesichter spiegeln sich in ihrer Oberfläche.', action: 'Ilev dreht einen Zylinder. Kinderlachen verwandelt sich in Wind.', lines: [{ speaker: 'ilev', text: 'Jede Stimme hier gehörte einmal zu einem Menschen. Keine ist eine Sache.', emotion: 'sad' }] },
    { id: 'b', seconds: [12, 23], camera: 'Weite Einstellung auf den dunklen Eingang der Abtei.', action: 'Das Licht hinter den Fenstern flackert synchron mit fernen Glocken.', lines: [{ speaker: 'ilev', text: 'Geh ins Moor. Wenn es eine andere Zukunft gibt, dann hat Ved ihren Schlüssel.', emotion: 'hopeful' }] },
  ] },
  { id: 'cs_mire', title: 'Der Stein mit den drei Kerben', trigger: 'mq03_complete', durationSeconds: 20, shots: [
    { id: 'a', seconds: [0, 20], camera: 'Unterwasserkamera steigt durch dunkles Wasser zur Hand der Spielfigur auf.', action: 'Ein Eidglassplitter wirft die Silhouette zweier Kinder an die Nebelwand.', lines: [{ speaker: 'unknown', text: 'Wenn du meinen Namen wiederfindest, sag ihn nicht nur für dich.', emotion: 'tender' }] },
  ] },
  { id: 'cs_sister', title: 'Ein Lied aus zwei Leben', trigger: 'sina_reveals_sister', durationSeconds: 28, shots: [
    { id: 'a', seconds: [0, 14], camera: 'Schwenk über ein unerreichbares Kindheitszimmer, dessen Wände langsam zu Asche werden.', action: 'Zwei Kinder klopfen drei Töne auf eine Fensterbank.', lines: [{ speaker: 'sina', text: 'Sie hat mich gebeten, dir das Lied aufzubewahren. Manchmal ist ein Lied alles, was bleibt.', emotion: 'tender' }] },
    { id: 'b', seconds: [14, 28], camera: 'Lange Totale auf Sina im Nebel, keine Überblendung.', action: 'Sina zieht das rote Band von ihrem Handgelenk und hält es hin.', lines: [{ speaker: 'sina', text: 'Du musst dich nicht an alles erinnern. Nur daran, dass sie dich geliebt hat.', emotion: 'sad' }] },
  ] },
  { id: 'cs_blueprint', title: 'Seras verlorener Entwurf', trigger: 'blueprint_found', durationSeconds: 21, shots: [
    { id: 'a', seconds: [0, 21], camera: 'Statische Nahaufnahme der kreisförmigen Linien auf einem vergilbten Bauplan.', action: 'Mehrere kleine Lichter verbinden sich, ohne dass eines erlischt.', lines: [{ speaker: 'sera_echo', text: 'Ein Kreis ist kein Thron. Wenn alle etwas tragen, muss niemand alles verlieren.', emotion: 'quiet' }] },
  ] },
  { id: 'cs_nela', title: 'Drei Töne', trigger: 'sq03_remember', durationSeconds: 18, shots: [
    { id: 'a', seconds: [0, 18], camera: 'Ruhige Halbnahe auf Nelas Hände am Phonographen.', action: 'Die Nadel springt. Nela pfeift die unterbrochene Melodie selbst zu Ende.', lines: [{ speaker: 'nela', text: 'Ich weiß wieder, wie er gelacht hat. Ich hätte nie gedacht, dass Glück so weh tun kann.', emotion: 'crying_soft' }] },
  ] },
  { id: 'cs_council', title: 'Das Siegel auf dem Tisch', trigger: 'council_confronted', durationSeconds: 18, shots: [
    { id: 'a', seconds: [0, 18], camera: 'Zwei Figuren im Gegenlicht, dazwischen ein Tisch mit einem geöffneten Siegelbuch.', action: 'Orun legt seinen Ring ab. Der Raum bleibt still.', lines: [{ speaker: 'orun', text: 'Ich möchte später nicht als der Mann erinnert werden, der recht hatte. Nur als einer, der endlich zuhörte.', emotion: 'restrained' }] },
  ] },
  { id: 'cs_end_iron', title: 'Der eiserne Morgen', trigger: 'ending_iron_bell', durationSeconds: 29, shots: [
    { id: 'a', seconds: [0, 15], camera: 'Totale über die wieder belebte Stadt, dann langsamer Zoom auf das Glockenseil.', action: 'Die Glocke läutet; mehrere Bürger vergessen plötzlich, warum sie stehen geblieben sind.', lines: [{ speaker: 'narrator', text: 'Du hast Veyr gerettet. Und eine Schuld geerbt, die mit jedem Morgen weiterwächst.', emotion: 'grave' }] },
    { id: 'b', seconds: [15, 29], camera: 'Close-up des Buchs, das die Spielfigur jetzt selbst führt.', action: 'Eine neue leere Namenszeile erscheint.', lines: [{ speaker: 'mara', text: 'Möge dir eines Tages jemand widersprechen, bevor du zu weit gehst.', emotion: 'sad' }] },
  ] },
  { id: 'cs_end_ash', title: 'Ein Himmel ohne Glocken', trigger: 'ending_open_ash', durationSeconds: 30, shots: [
    { id: 'a', seconds: [0, 16], camera: 'Die Kamera fällt durch die stillstehenden Zahnräder der Herzkammer.', action: 'Tausende Lichtspuren steigen auf; Menschen rufen verlorene Namen.', lines: [{ speaker: 'narrator', text: 'Als die Glocken zerbrachen, fanden alle ihre Toten wieder. Aber die Asche fand auch die Lebenden.', emotion: 'grave' }] },
    { id: 'b', seconds: [16, 30], camera: 'Weite Verfolgungseinstellung eines Flüchtlingszugs auf dem Nordweg.', action: 'Eira trägt ein schlafendes Kind. Hinter ihnen verdunkelt sich das Tal.', lines: [{ speaker: 'eira', text: 'Weitergehen. Trauern dürfen wir, wenn wir atmen können.', emotion: 'determined' }] },
  ] },
  { id: 'cs_end_shared', title: 'Das geteilte Licht', trigger: 'ending_shared_flame', durationSeconds: 34, shots: [
    { id: 'a', seconds: [0, 17], camera: '360-Grad-Fahrt um das Herzwerk; viele Hände legen kleine Eidglassplitter in den Kreis.', action: 'Der Motor wechselt vom düsteren Hämmern zu einem weichen Chorklang.', lines: [{ speaker: 'sera_echo', text: 'Ich dachte, ich müsste die Welt allein retten. Ihr habt bewiesen, dass genau das mein Fehler war.', emotion: 'relieved' }] },
    { id: 'b', seconds: [17, 34], camera: 'Fahrt durch die Straßen bei Sonnenaufgang; letzte Einstellung auf Sina in der Menge.', action: 'Menschen lesen die Namen auf den Mauern laut. Sina lächelt, als sie ihren hört.', lines: [{ speaker: 'sina', text: 'Diesmal weiß jemand, dass ich hier bin.', emotion: 'hopeful' }] },
  ] },
];

/** Eine TTS-Zeile je gesprochener Dialog-Node oder Cutscene-Zeile. */
export const ttsLines = [
  ...Object.entries(dialogues).flatMap(([dialogueId, dialogue]) =>
    dialogue.nodes.map((entry) => ({
      id: `dialogue.${dialogueId}.${entry.id}`,
      sourceType: 'dialogue',
      sourceId: dialogueId,
      nodeId: entry.id,
      speakerId: entry.speaker,
      text: entry.text,
      language: 'de-DE',
      emotion: entry.emotion || 'natural',
      voiceProfile: characters.find((character) => character.id === entry.speaker)?.voice?.profile || 'de_narrator',
      suggestedFile: `audio/voice/dialogue.${dialogueId}.${entry.id}.wav`,
    }))),
  ...cutscenes.flatMap((scene) => scene.shots.flatMap((shot) =>
    (shot.lines || []).map((line, index) => ({
      id: `cutscene.${scene.id}.${shot.id}.${index}`,
      sourceType: 'cutscene',
      sourceId: scene.id,
      shotId: shot.id,
      speakerId: line.speaker,
      text: line.text,
      language: 'de-DE',
      emotion: line.emotion || 'natural',
      voiceProfile: characters.find((character) => character.id === line.speaker)?.voice?.profile || 'de_narrator',
      suggestedFile: `audio/voice/cutscene.${scene.id}.${shot.id}.${index}.wav`,
    })))),
];

export const questIndex = Object.fromEntries([
  ...mainQuest.chapters,
  ...sideQuests,
].map((quest) => [quest.id, quest]));

export const npcIndex = Object.fromEntries(characters.map((character) => [character.id, character]));

export const cutsceneIndex = Object.fromEntries(cutscenes.map((scene) => [scene.id, scene]));

export const story = {
  storyMetadata,
  worldLore,
  characters,
  mainQuest,
  sideQuests,
  dialogues,
  cutscenes,
  ttsLines,
  questIndex,
  npcIndex,
  cutsceneIndex,
};

export default story;
