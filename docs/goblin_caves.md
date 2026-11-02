# Höhlen der Ukhai

Drei bewohnte Orte unter der Aschmark, keine austauschbaren Monsterlager. Die Schädelsänger verwahren Erinnerung, die Pilzmütter verteidigen Wasser und Nachwuchs, die Kettenbrecher wiederholen die Gewalt ihrer früheren Herren. Die Geschichten widersprechen den einfachen Kopfgeldaufträgen der Grubenwacht, ohne die Überfälle oder den Umgang der Ukhai mit Gefangenen zu entschuldigen.

Die Pläne sind Entwurfsdaten; sie werden hier noch nicht in die Spielwelt eingebaut. Alle Koordinaten sind nullbasiert als **(x, y)** angegeben. Eine Zelle misst 2 × 2 Welteinheiten, die Bodenhöhen sind **0, −7 und −14**. Norden liegt oben. Raumhöhen stehen in den Daten; unbenannte Verbindungsgänge erhalten 4 Einheiten lichte Höhe. Unter einer begehbaren oberen Etage bleiben die unteren Decken höchstens 6 Einheiten hoch. Die hohen Pilze der obersten Ebene dürfen die freie Laufhöhe nicht beschneiden.

Die zwei parallelen Pfeilreihen jeder Treppe bilden zusammen einen vier Einheiten breiten Abstieg. Pfeile zeigen immer die Richtung **abwärts**, die Treppe bleibt in beiden Richtungen begehbar. Der Treppenkörper auf der tieferen Ebene ist gesperrt; die Verbindung erfolgt ausschließlich über die beiden Enden. Ein **O** ist eine echte Öffnung mit sichtbarer Landung sieben Einheiten darunter, kein gleich hoher Durchgang. Ein Sprung hinunter ist endgültig, bis eine Treppe erreicht wird. Abwurflandungen brauchen eine spielbare Fallhöhe und dürfen keine tödlichen Fallschäden erzwingen.

Gegnerzahlen zählen fest platzierte Goblins, jeweils zusätzlich ein Häuptling. Die vier Sondergoblins je Höhle schließen den Trommler ein. Sein Ruf alarmiert die noch lebenden Mitglieder seiner in `rallyGroups` benannten Gruppen: Diese bilden die Horde, laufen über die vorhandenen Wege herbei und ersetzen keine Getöteten. Schlafende Reserven und arbeitende Lager werden dadurch Teil des Kampfes. Gefangenenkäfige besitzen einen von außen bedienbaren Riegel; eine Befreiung verlangt kein unbeschriebenes Schlüsselrätsel. Feuerschalen setzen eine Fackel oder einen Feuerzauber voraus, wie im Rätselsystem vorgesehen.

## Die Klagende Grube

**Idee:** Eine unterirdische Totenliturgie. Oben werden Namen ausgebessert, unten werden sie gesungen. Die zuerst gehörte Trommel ist durch den Galerieschacht sichtbar, lange bevor der sichere Abstieg den Spieler zu ihr bringt. Kalk, Guano, abgeschlagene Ohrketten und königliche Spitzhacken erzählen von einem verletzten Gedächtnis. Vosh ist dessen Hüter und dessen grausamer Zensor.

**Aufbau:** Zwei Ebenen, je 40 × 40 Zellen. Die Hörgalerie liegt auf 0, der versunkene Chor auf −1. 18 Goblins: sieben Speerträger, sieben Dolchkämpfer, zwei Lauerer, ein Kettenwürger und ein Trommler. Dazu Vosh der Knochenrufer. Drei Rätsel und drei Truhen.

### Weg und Lösungen

1. **Die drei Zeugen, Ebene 0:** Vom Mundloch **(2, 5)** geht es nach Osten in die Vorhalle. Eine Wache lauscht, eine zweite zieht zwischen den Bildflächen ihre Runde. Das Wandbild bei **(7, 5)** zeigt die Begräbnisfolge. Die Säulen bei **(8, 7), (11, 7), (14, 7)** werden von links nach rechts auf **Ohr – Knochen – Mond** gedreht. Dadurch öffnen sich beide Zellen des Zeugentors **(9–10, 12)**. Die verriegelte Nordostpassage ist der spätere Rückweg.

2. **Saal der ausgelöschten Namen:** Hinter dem Tor folgt die Spur über den südlichen Gang. Die Bodenmarkierungen bei **(10–11, 16)** lösen Rippenpfeile aus. Ein Arbeiter ritzt Zeichen in den Kalk, zwei Goblins schlafen am kleinen Feuer. In der westlichen Seitennische **(4, 23)** wartet ein Lauerer. Der Felskern im Saal lässt sich auf beiden Seiten umgehen; der Kampf muss nicht frontal im Eingang stattfinden. Die Lagertruhe **(15, 24)** und die letzten Zeilen des Gildenjägers **(8, 16)** belohnen die Untersuchung.

3. **Die Hörgalerie:** Der östliche Abzweig führt zur Brüstung. Bei **(24, 20)** sieht und hört man den Knochenchor auf −1. Der Sprung landet auf derselben Rasterkoordinate mitten in der unteren Halle und überspringt den südlichen Anmarsch. Er lässt die Wache auf der Kalktreppe im Rücken. Der sichere Weg führt zurück in den Bildersaal und über die beiden Südpfeilreihen **(9–10, 26–30)** zur Landung **(9–10, 31)** auf −1; von dort geht es nach Osten und dann nach Norden in den Chor.

4. **Der Knochenchor:** Der Trommler bei **(20, 24)** ruft die Chorgruppe und Voshs Leibwachen heran. Der zentrale Felskern unterbricht Sichtlinien; Schlafende und Sitzende werden beim Alarm zur beweglichen Reserve. Die Leibwachen bleiben bis zum Öffnen des Trauertors hinter ihrem Tor. Der kleine Westgang führt zum Archiv der Ohren und zu **Jorren**, einem tauben Steinmetz im Käfig **(8, 18)**. Ein zweiter Lauerer sitzt noch weiter westlich in der Nische **(2, 20)**.

5. **Das erste Lied, optionales Rätsel:** Im Archiv beschreibt der Hinweis bei **(7, 18)** den verborgenen Seilzug. Die Ohrgewicht-Kette **(4, 18)** öffnet den vierzelligen Verschluss **(5–6, 14–15)**. Dahinter liegen eine Truhe der Stufe 2 bei **(7, 11)** und ein unbeschädigtes Bild der Ukhai unter Bäumen. Dieses Seitenheiligtum ist keine notwendige Station auf dem Weg zu Vosh.

6. **Die Nacht des Zumauerns:** Das Wandbild **(17, 27)** nennt die Feuerfolge ausdrücklich: **Heim → Mauer → Mutter**. Entzündet werden die beschrifteten Schalen **Heim (18, 24)**, **Mauer (26, 26)** und **Mutter (27, 19)**. Eine falsche Reihenfolge setzt die ganze Gruppe zurück. Die richtige öffnet beide Hälften des Trauertors **(28–29, 14)**. Die Schalen sind kleine, eingehegte Totenfeuer: gefährliche Flammen, denen die Sänger eine religiöse Funktion geben.

7. **Voshs Kehle und Rückweg:** Im Norden steht Vosh bei **(29, 7)** zwischen Schädelmasken. Der Kettenwürger zieht Angreifer aus ihrer Deckung, während Vosh seine Leute durch Gesang antreibt. Die beste Truhe liegt bei **(33, 11)**. Erst der Hebel an der Ostwand **(35, 7)** hebt die beiden Riegel auf Ebene 0 bei **(17, 3–4)**. Von der unteren Landung **(32–33, 10)** steigt man durch den alten Trägerschacht hinauf, folgt oben dem Gang auf **y = 3–4** nach Westen und erreicht die Vorhalle unmittelbar neben dem Ausgang. Am Eingang gibt es keinen zweiten Öffner.

### Die erzählte Geschichte

Der Gildenjäger erkennt im Ohrhandel die Spiegelung seines eigenen Gewerbes. Jorren musste ausgerechnet die Wand reparieren, die er nicht hören kann. Die Notiz unter dem Kalk verrät, dass Vosh auch widersprechende Ukhai verstummen ließ. Das geheime älteste Bild zeigt dagegen ein Volk von Steinsetzern unter freiem Himmel. Wer das Heiligtum auslässt, sieht vor allem Trophäen; wer es findet, erkennt, was aus der Erinnerung verdrängt wurde.

## Die Moderhöhle

**Idee:** Ein verletzter Nahrungskreislauf. Der Weg folgt den Leuchtpilzen hinunter zum Wasser und weiter zu den Wurzelwiegen. Glanz und Leben nehmen nach unten nicht einfach ab: Gerade das letzte reine Becken leuchtet am stärksten. Die sichere Versorgungstrecke ist von Ghast abgeriegelt, damit niemand mit den Vorräten flieht.

**Aufbau:** Drei Ebenen, je 40 × 40 Zellen. Bleicher Wald auf 0, blinder See auf −1, Wurzelwiege auf −2. 22 Goblins: zehn Speerträger, acht Dolchkämpfer, ein Lauerer, zwei Sporenbälge und ein Trommler. Dazu Mutter Ghast. Zwei Rätsel und drei Truhen.

### Weg und Lösungen

1. **Die Waage der Nahrung, Ebene 0:** Vom Eingang **(2, 30)** führt der Weg in eine lehmige Sammelkammer. Der Hinweis **(8, 27)** erklärt den Mechanismus. Den **Korbstein (8, 32)** auf den **Futterteller (11, 29)** legen: Sein Gewicht hält beide Hälften des Tors **(9–10, 23)** offen. Der Stein bleibt dort. Nur selbst auf der Platte zu stehen genügt nicht, um anschließend durch das Tor zu laufen.

2. **Der bleiche Wald:** Im Norden arbeiten Sammlerinnen zwischen hohen Fruchtkörpern. Ein Lauerer sitzt abseits des Hauptwegs in der Westnische **(3, 17)**, eine Patrouille umrundet den inneren Pilzfels. Ein Schlafplatz und die einfache Truhe **(7, 9)** machen die Halle als Lager lesbar. Die Handelsnotiz **(14, 13)** berichtet von gebrochenen Zusagen zum neuen Schacht. Sporen werden durch Pilzgruppen und Schlote dargestellt; sie schaffen Deckung für Gegner, keinen zusätzlichen unsichtbaren Rätselzustand.

3. **Das sickernde Auge:** Auf dem östlichen Balkon öffnet sich bei **(26, 12)** der Boden. Unten liegen Reusen und ein knietiefer See. Der Sprung landet sicher im Wasser auf −1, aber nahe der Sporenbalg-Nische. Der reguläre Abstieg beginnt südlich am Waldrand: **(18–22, 18–19)** führt ostwärts zur unteren Landung **(23, 18–19)**. Beide Wege erreichen dasselbe Ostufer.

4. **Das Mutterbild, Ebene −1:** Die Nische **(21, 9)** ist leer; der Hinweis **(24, 10)** beschreibt eine Mutter mit drei Wurzeln und die Spur nach Süden. Das gesuchte **Mutterbild (28, 30)** liegt im verschlammten Schrein. Dorthin gelangt man am Südufer über den Lehmgang **x = 29–30**. Das Bild zurücktragen und in die Nische setzen: Es öffnet das Wassertor **(17, 10–11)** zu den westlichen Beeten. Der oben zurückgelassene Korbstein ist ausdrücklich kein Ersatz. Im Schrein liegt auch Maras Wasserprobe.

5. **Der See und die schwarzen Beete:** Die ganze Wasserfläche ist flach und begehbar; die Ufer und die Felsinsel erlauben unterschiedliche Anmärsche. Eine Reusenfalle bei **(26, 18–19)** bestraft den direkten Weg. Der erste Sporenbalg lauert im östlichen Seitenschlauch **(36, 15)**. Hinter dem Wassertor arbeiten Goblins zwischen verdorbenen Pilzen und einem kleinen Entsorgungsfeuer. Der Abstieg **(9–10, 20–24)** endet auf −2 bei **(9–10, 25)**. Die südöstliche Versorgungstreppe bleibt vorerst durch das zweite Riegeltor versperrt.

6. **Die Wurzelwiegen, Ebene −2:** Der Trommler **(14, 25)** ruft die Wiegenhüter und die noch lebenden Seewachen zusammen. Ein Felsrücken teilt die Schlaf- und Arbeitszone, während der Seitenweg **x = 12–13** nach Norden zur Vorratskammer führt. Dort liegen eine optionale Truhe der Stufe 2 **(13, 15)** und eine schlafende Reserve. Im Käfig **(8, 30)** sitzt die Wasserprüferin **Mara**. Die Namen an der Wand **(12, 24)** erklären die leeren Brutmulden.

7. **Mutterbecken und Rückweg:** Über den östlichen Verbindungsgang **y = 27–28** erreicht man Ghast bei **(29, 30)**. Ihr Kreis hält die Nähe zu den Heilpilzen; der zweite Sporenbalg wartet am nördlichen Beckenrand. Der Schlüssel **(27, 31)** gehört zur Truhe der Stufe 3 **(32, 29)**. Der Hebel **(35, 30)** löst gleichzeitig das Versorgungstor auf −1 bei **(30, 33–34)** und das Eingangstor auf 0 bei **(18, 30–31)**. Vom Ostende des Beckens **(36, 33–34)** geht es über die Versorgungstreppe nach Westen hinauf zum Schrein. Am östlichen Seeufer erreicht man die nächste untere Treppenlandung **(33–34, 23)**. Diese Treppe steigt nach Süden zur oberen Etage; der trockene Wurzelgang auf **y = 30–31** führt durch das nun offene Tor direkt zur Eingangskammer. Beide Riegel besitzen ausschließlich Ghasts Hebel als Öffner.

### Die erzählte Geschichte

Menschliche Händler kannten den Stamm schon vor den Überfällen. Die Krone ließ den neuen Schacht trotz einer belasteten Wasserprobe weiterarbeiten. Ghast schützt die Wiegen, ließ aber Maras Gehilfin sterben und hält Menschen unter grausamen Bedingungen gefangen. Der Abstieg führt von vollen Pilzkörben über verdorbene Beete zu sieben verstummten Namen. Wasser ist hier Lebensgrundlage, Verhandlungsmasse und Waffe.

## Die Eisengrube

**Idee:** Ein geradliniges königliches Bergwerk, das in ältere Höhlen geschnitten wurde. Holzbalken, Messstriche und Schienen ordnen den oberen Bereich; Schlackennischen und eingestürzte Querschläge brechen diese Ordnung unten auf. Am Ende sitzt Ulgrak auf einer Maschine, die schon seine Vorfahren gewogen hat.

**Aufbau:** Zwei Ebenen, je 40 × 40 Zellen. Königliche Förderstrecke auf 0, letzte Schicht auf −1. 20 Goblins: neun Speerträger, sieben Dolchkämpfer, zwei Kettenwürger, ein Brecher und ein Trommler. Dazu Ulgrak Kettenfaust. Zwei Rätsel und drei Truhen.

### Weg und Lösungen

1. **Zählstube der Krone, Ebene 0:** Der Eingang **(2, 4)** führt zwischen Kronensiegel und Kerbhölzern nach Osten. Eine Patrouille kreist um die alte Arbeitszählung. Das Schichtbuch **(12, 4)** bezeichnet verschüttete Ukhai als eingespartes Stützholz. Beim Schlüssel **(16, 9)** liegt der Zugang zur späteren Lohntruhe bereits in Reichweite. Der Steigersteg im Osten ist von der Eingangsseite verriegelt.

2. **Die stumme Schichtglocke:** Der Wartungshinweis **(9, 8)** erklärt, dass der Glockenzug hinter dem südlichen Versturz verschwindet. Die **Kette (8, 10)** ziehen: Der getarnte Holzpfropfen **(10–11, 13–14)** fährt zur Seite und öffnet den Weg in die Förderhalle. Das ist ein mechanischer Verschluss mit vier Felszellen, kein bloß dekorativer Einsturz.

3. **Die schiefe Förderhalle:** Zwei Arbeiter halten die Lore instand, eine Wache umrundet die Schienen und ein Kämpfer schläft neben Erzsäcken. Ein als Baumstammfalle modelliertes Lorenpendel wird auf **(12–13, 24)** ausgelöst. Der östliche Seitensteg führt zur Bruchkante und zur verschlossenen **Lohntruhe (28, 19)**; der Schlüssel aus der Zählstube öffnet sie. Bei **(26, 19)** blickt man in die noch betriebene Esse. Wer hinunterspringt, landet nahe ihrer Arbeiter und kann hier nicht zurückklettern.

4. **Die Förderbrücke:** Die Wartungszeichnung **(7, 22)** verbindet die Winde an der Westwand mit dem südöstlichen Bruch. Den **Hebel (5, 21)** ziehen: Die Brücke senkt sich über die vier offenen Zellen **(18–19, 24–25)**. Danach erreicht man den Treppenantritt **(21, 24–25)** und die fünf ostwärts gerichteten Stufen **(22–26, 24–25)**. Unten tritt man bei **(27, 24–25)** in die Esse. Ein absichtlicher Sprung durch die noch offene Brückenlücke ist eine riskante alternative Route in das Kettenwerk auf −1; er umgeht die Winde, führt aber an die Nischen der Kettenwürger. Die Brücke ist deshalb ein lösbares Wegerätsel und keine zwingende unsichtbare Fortschrittssperre.

5. **Esse und Pferch, Ebene −1:** Der Trommler **(28, 24)** schlägt auf derselben Trommel den Arbeitstakt und den Alarm. Er ruft die Schmiedegruppe und Ulgraks Gefolge zusammen; die Horde nutzt die westlichen Verbindungsgänge. Der Schlackenpfeiler in der Esse bietet Deckung. Die Würger verbergen sich in Nischen **(13, 18)** und **(17, 30)**, von denen sie Fliehende in das Kettenwerk ziehen. Im Käfig **(8, 24)** sitzen **Edda**, eine königliche Vermesserin, und **Rauk**, ein Ukhai, der die neue Zwangsarbeit verweigerte. Die Werkstatttruhe **(8, 28)** ist optional. Das Vermessungsblatt **(34, 27)** verbindet dieses Bergwerk mit den zerstörten Bildhallen und dem vergifteten See der anderen Höhlen.

6. **Ulgraks Thronwaage:** Der alte Transportgang **x = 10–11** führt nach Norden. Ulgrak steht bei **(12, 8)**, begleitet von einem Brecher und seinen verbliebenen Wachen. Die rechteckige Waagenkammer bietet Platz, den Ansturm des Brechers seitlich abzufangen. Die Truhe der Stufe 3 liegt bei **(16, 5)**. Der **Hebel (7, 7)** hebt ausschließlich von dieser Seite die beiden Steigerriegel auf Ebene 0 bei **(20, 11–12)**.

7. **Rückweg der Prüfer:** Hinter der Thronwaage verläuft auf **y = 4–5** ein zweizelliger Kontrollgang nach Osten. Bei **(32–33, 5)** erreicht man die untere Treppenlandung. Nach dem Aufstieg liegt der obere Antritt bei **(32–33, 11)**; der Steigersteg führt nach Westen durch das geöffnete Tor in die Zählstube. Der Rückweg umgeht Förderhalle, Brücke und Pferch vollständig.

### Die erzählte Geschichte

Das Schichtbuch dokumentiert die alte Versklavung, das Vermessungsblatt die neue Grenzverletzung. Dazwischen liegt Rauks Kerbentext: „Drak-ul“ bedeutete Kette zerbrochen; inzwischen stellt der Stamm neue Fesseln her. Edda und Rauk teilen denselben Käfig und ihr Wasser. Ulgrak trägt die gebrochenen Ketten als Reliquie, behält aber die königliche Arbeitsordnung bei. Der bequeme Prüfergang macht die soziale Trennung im Bergwerk räumlich erfahrbar.

## Daten, Prüfung und Pläne

Die Datei `src/data/goblins/caves.js` enthält ausschließlich exportierte Konstanten und statische Daten. Ergänzend zum vorgegebenen Format deklariert `groups` die benannten Kampf- und Rätselgruppen. `rallyGroups` am Trommler benennt seine endlichen Reserven; `name` am Häuptling und `label` an beschrifteten Rätselstücken sind deutsche Anzeigenamen. Andere Verknüpfungen bleiben im vorgegebenen Format. Säulenlösungen sind nullbasierte Symbolindizes. Gemeinsame Tor- und Steuerungszellen sind beabsichtigt und werden im Plan mit getrennten kleinen Marken dargestellt.

`node scripts/check_caves.mjs` prüft Raster, Etagen, Treppen, Abwürfe, Positionen, Referenzen, Rätselhinweise und die schrittweise Erreichbarkeit. Es reserviert für jede Druckplatte ein tatsächlich hintransportierbares Idol; dieses steht anschließend nicht für ein anderes Rätsel zur Verfügung. Gruppenrätsel öffnen erst, wenn sämtliche Teile erreichbar sind. Vom Häuptling wird zusätzlich ein eigener gerichteter Rückweg gesucht. Begehbare Zellen in der Zusammenfassung schließen Treppen ein, offene Löcher und Treppenkörper aus. Die Prüfung betrachtet die statische Navigation und Rätselabhängigkeiten; Kampfverhalten, Fallschaden und die räumliche Lesbarkeit der Hinweise benötigen später einen Spieltest.

`node scripts/render_caves.mjs` erzeugt die drei SVG-Pläne und `docs/goblin_caves/index.html` aus denselben Daten und diesem Text. Die HTML-Seite enthält die deutschen Lösungswege sowie eine vergrößerbare Ansicht. Jede Objektmarke besitzt eine Kurzkennung, einen deutschen Legendeneintrag und einen Tooltip mit ihren Daten. Die SVGs bleiben unabhängig von der HTML-Seite nutzbar.
