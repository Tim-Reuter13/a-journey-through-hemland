# ASHEN REALMS – Die Namen unter der Asche

## Überblick

Eigenständige deutsche Dark-Fantasy-Erzählung für das Three.js-Spiel **Ashen Realms**. Die Region **Veyr** leidet unter grauem Ascheschnee und einer Krankheit, die das Gedächtnis zerstört. Ein altes Glockenwerk hält die Krankheit zurück, allerdings bezahlt die Bevölkerung heimlich mit ihren Erinnerungen. Das Spiel fragt, ob Schutz ohne Einwilligung Sicherheit oder Gewalt ist.

Die Spielfigur verfolgt die Stimme einer vergessenen Schwester, untersucht die Glocken, besucht eine Abtei, durchquert das Trauermoor und entscheidet in der Herzkammer über das Schicksal der Region. Ein drittes, hoffnungsvolleres Ende ist möglich, wenn Rat, Widerstand und Bevölkerung eine freiwillige Alternative unterstützen.

## Dateien und Exporte

`src/data/story.js` ist ein ES-Modul ohne Import oder Three.js-Abhängigkeit. Benannte Exporte:

| Name | Inhalt |
| --- | --- |
| `storyMetadata` | Titel, Einstieg, Anfangsflags, Integrationskonventionen |
| `worldLore` | Weltgeschichte, Orte, Fraktionen, Glossar und auffindbare Lore-Texte |
| `characters` | NPCs mit Aussehen, Zielen, Geheimnissen, Beziehungen und Stimmprofilen |
| `mainQuest` | Sechs Kapitel der Hauptquest und drei Enden |
| `sideQuests` | Vier verzweigte Nebenquests mit Outcomes |
| `dialogues` | Deutsche Dialogbäume mit Antwortoptionen und spielzustandsabhängigen Bedingungen |
| `cutscenes` | Elf kurze Sequenzen mit Kamerafahrten, Aktionen, Timing und Sprechtexten |
| `ttsLines` | Automatisch aus Dialogen und Cutscenes zusammengestellte Sprachzeilen |
| `questIndex` | Quest-ID → Questdaten |
| `npcIndex` | NPC-ID → Charakterdaten |
| `cutsceneIndex` | Cutscene-ID → Sequenzdaten |
| `story` / `default` | Zusammenfassung aller Exporte |

## Schnelle Integration

```js
import story, { dialogues, mainQuest, sideQuests, ttsLines } from './data/story.js';

const flags = { ...story.storyMetadata.startingFlags };
const conversation = dialogues[story.storyMetadata.defaultDialogue];
let currentNode = conversation.nodes.find(node => node.id === conversation.start);

function availableAnswers(node) {
  return node.options.filter(option =>
    Object.entries(option.requires || {}).every(([key, value]) => flags[key] === value)
  );
}

function chooseAnswer(dialogue, option) {
  Object.assign(flags, option.effects || {});
  for (const event of option.events || []) dispatchStoryEvent(event);
  return option.next ? dialogue.nodes.find(node => node.id === option.next) : null;
}

function dispatchStoryEvent(event) {
  // Vom Hauptspiel mit Questlog, Welt, Inventar oder Cutscene-Player verbinden.
  console.debug('Story event:', event);
}

console.log(mainQuest.chapters.length, sideQuests.length, ttsLines.length);
```

**Wichtig:** `objectives[*].completeWhen` verweist auf einen Flag-Namen. Interaktionen in der Welt (etwa `mine_valve_open`, `ward_shards_collected`, `saw_final_memory`) müssen vom Spiel gesetzt werden, sobald der Spieler die entsprechende Aufgabe tatsächlich erfüllt. Diese Weltinteraktionen werden nicht durch das reine Datenmodul ausgeführt. Ebenso sind `events` nur deklarative Signale, keine implementierten Gameplay-Funktionen. Bei einer Dialogoption zuerst `requires` gegen den Status prüfen, dann `effects` übernehmen, dann `events` auslösen, anschließend `next` laden.

Für ein Questlog lässt sich das jeweils passende Kapitel über `questIndex[id]` abrufen. Die Missionen `mq01` bis `mq06` werden chronologisch gespielt. Die Nebenquests `sq01` bis `sq04` können während der Erkundung gestartet werden. Optional erfüllte Nebenquest-Ziele beeinflussen die Verbündeten für das Finale.

## Quests und Entscheidungen

1. **Wenn die Glocke deinen Namen kennt:** Mara und das geheime Wartungsbuch.
2. **Die Bibliothek des Schweigens:** Ilev enthüllt die nicht freiwillige Erinnerungssteuer.
3. **Das Moor vergisst niemanden:** Ved und der Schlüssel der Erfinderin.
4. **Die Rechnung des Rates:** Orun verteidigt die harte Entscheidung des Magistrats.
5. **Drei Stimmen gegen die Stille:** Suche Seras Plan und Verbündete.
6. **Der letzte Glockenschlag:** Entscheide über die Zukunft von Veyr.

Nebenquests: **Die Namen unter Stein** (Arbeiter, Wahrheit oder Versorgung), **Die Brücke, die niemand bezahlt** (Flüchtlinge, heimliche Hilfe oder öffentliche Bürgschaft), **Drei Töne für einen Bruder** (Nelas schmerzhafte Familienerinnerung) und **Der letzte Docht** (freiwilliger Schutzkreis).

Finale: `iron_bell` bewahrt die Schutzfunktion mit fortgesetzter Ausbeutung; `open_ash` gibt Erinnerungen zurück, opfert aber die Sicherheit des Tals; `shared_flame` erfordert `ward_repaired`, `council_support`, `chorus_support`, `people_support` und `found_names` jeweils `true`. Das dritte Ende wird als Auswahl im Dialog `dlg_heart_echo` erst dann sichtbar. Die endgültige Auswahl schreibt `ending`; die letzte Bestätigung setzt `mq_complete`.

## Figuren und Inszenierung

Zentrale Stimmen: **Mara Venn** (schuldgeplagte Glockenwächterin), **Ilev Sar** (Archivar des Widerstands), **Orun Kest** (zweifelnder Ratsherr), **Nela Kest** (Uhrmacherin), **Toma Rusk** (Grubenarbeiter), **Ved** (Fährfrau), **Eira Damm** (Heilerin), **Lorn Asket** (Abt), **Sina** (vergessenes Mädchen), **Sera Vann** (gespeicherter Erinnerungsabdruck).

Cutscene-Einträge enthalten `id`, `trigger`, `durationSeconds` und `shots`. Jeder Shot hat eine stabile ID, ein Intervall `seconds: [start, end]`, `camera`, `action` und eine Liste `lines` mit Sprecher-ID, Text und Emotion. Die Kamera- und Aktionsbeschreibungen sind Regieanweisungen und müssen durch eine Three.js-Regiekomponente umgesetzt werden. Die Texte können zunächst als Untertitel eingeblendet werden.

## Qwen-TTS / Vertonung

`ttsLines` enthält für jede sprechende Dialog-Node und jeden gesprochenen Cutscene-Abschnitt eine stabile ID sowie `speakerId`, `text`, `language: 'de-DE'`, `emotion`, `voiceProfile` und `suggestedFile`. Die Zeilen lassen sich im Batch an eine lokale Qwen-TTS-Pipeline übergeben. `voiceProfile` sind **symbolische Rollenbeschreibungen**, keine garantierten Qwen-Modell-IDs. Entsprechende Referenzsprecher und Voice-Prompts muss die Audiopipeline konfigurieren. `suggestedFile` ist ein Zielpfad für später erzeugte WAV-Dateien; **es werden keine Audiodateien durch dieses Modul erzeugt**. Unbekannte Sprecher und Erzähler verwenden `de_narrator`.

## Technischer Stand und Grenzen

Dieses Paket liefert nur Quest-, Dialog-, Lore-, Cutscene- und TTS-Daten. Es implementiert weder Gameplay-Trigger noch 3D-Modelle, Spracherzeugung, Animationen oder automatische Questlogik. Für ein vollständig spielbares Narrativ muss das Hauptspiel Weltinteraktionen, Flag-Persistenz, Questfortschritt und UI an die Daten anbinden. **`src/main.js`, `src/world`, `src/game` und `package.json` werden von diesem Story-Paket nicht verändert.**
