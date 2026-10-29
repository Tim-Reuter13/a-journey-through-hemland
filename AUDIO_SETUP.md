# Ashen Realms — Offline-NPC-Sprachausgabe

## Lieferumfang und Zuständigkeit

Der Audiobaustein arbeitet vollständig getrennt vom Three.js-Spielcode. Er verändert **keine** Dateien in `src/`, `index.html` oder CSS. Die Spieleintegration übernimmt der Hauptagent.

- `scripts/dialogue_catalog.json`: 17 deutsche Dialog-/Cinematic-Zeilen, Sprecher, Szenen und VoiceDesign-Prompts.
- `scripts/generate_voices.py`: offlinefähiger Batch-Renderer für Qwen3-TTS VoiceDesign mit Fehlerprüfung, stabilen Audio-IDs, WAV-Normalisierung und automatischer Manifestpflege.
- `public/audio/<id>.wav`: erst nach **echter erfolgreicher Generierung** existierende Sprachdateien.
- `public/audio/manifest.json`: ausschließlich existierende, vollständig lesbare PCM-WAV-Dateien mit ID, Text, Sprecher, URL, Dauer, Sample-Rate, Pegel und SHA-256.

## Lokale Installation (bereits geprüft)

- Python-Venv: `C:\AI\Qwen3-TTS\.venv\Scripts\python.exe`
- VoiceDesign-Modell: `C:\AI\Qwen3-TTS\models\VoiceDesign`
- Base-Modell: `C:\AI\Qwen3-TTS\models\Base` (optional, vom aktuellen Skript nicht benötigt)
- PyTorch in Venv: `2.11.0+cu128`; vorherige Prüfung meldete CUDA und RTX 5080 verfügbar.

Das Skript lädt Gewichte ausschließlich aus dem lokalen VoiceDesign-Verzeichnis. `HF_HUB_OFFLINE` und `TRANSFORMERS_OFFLINE` werden aktiviert. Eventuelle Hugging-Face-/Torch-Caches werden auf `public/audio/` innerhalb des Projekts umgeleitet. Nichts wird in der Qwen-Installation installiert, heruntergeladen oder verändert.

## PowerShell: Anwenden

Im Projektordner `C:\Users\timre\Documents\Codex\2026-10-09\ich-will-ein-skyrim-like-rpg-2`:

```powershell
$python = 'C:\AI\Qwen3-TTS\.venv\Scripts\python.exe'
& $python scripts\generate_voices.py --list
& $python scripts\generate_voices.py --dry-run
& $python scripts\generate_voices.py --id bryn_01
& $python scripts\generate_voices.py --speaker elira
& $python scripts\generate_voices.py --speaker soren --speaker narrator
& $python scripts\generate_voices.py
```

Der letzte Aufruf erzeugt alle noch fehlenden Zeilen. Existierende, valide Dateien werden automatisch übersprungen. Gleicher `--seed` und identische Modellversion machen erneute Läufe möglichst reproduzierbar; GPU-Kernels und Sampling können trotzdem geringfügig abweichen.

Weitere Optionen:

```powershell
& $python scripts\generate_voices.py --id narrator_01 --max-new-tokens 256
& $python scripts\generate_voices.py --id bryn_01 --force
& $python scripts\generate_voices.py --rebuild-manifest
& $python scripts\generate_voices.py --device cpu --dtype float32 --id soren_01
```

`--force` überschreibt nur die ausgewählte Audio-WAV **nach** erfolgreicher Neugenerierung und Validierung. Ein fehlgeschlagener Versuch bewahrt eine vorherige WAV-Datei. Über `--model` lässt sich ein anderes **lokales** VoiceDesign-Verzeichnis angeben. `--max-new-tokens` muss bei längeren Aussagen ausreichend groß sein.

## Stimmen und Audioqualität

Die VoiceDesign-Anweisungen stehen vollständig in `scripts/dialogue_catalog.json`:

| Sprecher | Stimme | Stimmung |
| --- | --- | --- |
| Elira | ältere warme, leicht heisere Frauenstimme | würdevoll, mystisch, sorgenvoll |
| Bryn | tiefer rauer Bariton | bodenständiger Schmied, trocken |
| Soren | zurückhaltende tiefere Männerstimme | wachsam und rätselhaft |
| Erzähler | tiefe filmische Erzählstimme | langsames episches Intro |

Ein einzelner VoiceDesign-Prompt garantiert **keine** perfekt konstante Sprecheridentität zwischen unabhängig erzeugten Clips. Für streng konsistente Stimmen sind eine gute Referenzaufnahme und das lokale Qwen3-TTS-Base-Modell mit Voice-Cloning ein möglicher späterer Entwicklungsschritt, der im aktuellen Skript bewusst noch nicht behauptet wird. Kritische Takes nach Gehör prüfen und gegebenenfalls mit anderem Seed neu erstellen.

Die Ausgabe ist mono, unkomprimiertes 16-bit-PCM-WAV mit vom Modell gelieferter Sample-Rate. Es erfolgt eine Peak-Anpassung auf circa −1,2 dBFS und ein kurzer Fade-in/Fade-out. Defekte, stumme, nicht-finite oder zu kurze Renderings werden abgelehnt. Dateien werden erst nach erfolgreicher Prüfung atomar veröffentlicht. Ein externes `sox.exe` wird zum Schreiben nicht benötigt.

## Integration in Three.js

Der Hauptagent liest nach der Erzeugung `/audio/manifest.json` (Vite kopiert `public/audio/` unverändert) und baut beispielsweise einen Index nach `asset.id` und `asset.text`. Dialoge können über `asset.url` via `THREE.AudioLoader`, `HTMLAudioElement` oder Web Audio API geladen werden. Wenn kein passender Asset vorliegt oder Laden/Abspielen scheitert, ist die bestehende Browser-`speechSynthesis` ein sinnvoller Fallback. Audio bei Dialogwechsel abbrechen, auf `ended` hören und Lautstärke/Fernwirkung je nach Szene behandeln. Autoplay-Sperren im Browser erfordern normalerweise eine erste Spielerinteraktion.

Der Katalog hat stabile IDs wie `elira_03`, `bryn_01`, `soren_02`, `narrator_01`; Text und Szenentyp sind im Manifest gespiegelt. Wenn der Spieltext abweicht, IDs explizit zuordnen oder dessen exakten Text mit Manifest-`text` vergleichen. Im Manifest erscheinen bewusst **nur** tatsächlich validierte Dateien; `missing_ids` listet ausstehende Dialoge.

## Bekannte Fehlerquellen

- **`SoX could not be found!`**: Kann eine optionale Warnung eines Audio-Pakets sein. Erst beim tatsächlichen Inferenzfehler relevant. WAV-Schreiben über `wave` braucht kein SoX.
- **`The system cannot execute the specified program`**: Eventuell Windows-DLL-/Importproblem von PyTorch/Torchaudio; vollständigen Python-Traceback und Venv-Bibliotheken prüfen. Die Qwen-Installation wird durch dieses Skript nicht repariert oder verändert.
- **CUDA out of memory**: Nur einen Clip per `--id` rendern, andere GPU-Anwendungen schließen, bei Bedarf `--device cpu --dtype float32` testen.
- **Fehlende `config.json`**: `--model` muss direkt auf den lokalen VoiceDesign-Modellordner zeigen.
- **Leere/kaputte WAV**: Fehler wird angezeigt und im Manifest nicht als Erfolg geführt. Nach Fehlerbehebung gezielt mit `--force` neu generieren.
- **Sprecher klingt inkonsistent**: Die eingebauten Prompts verbessern den Stil, sind aber ohne Referenzstimme kein Identitätsanker. Wichtige Takes anhören und neu rendern.

## Validierungsstatus

**Stand: 10. Oktober 2026 – alle 17 deutschen Sprachaufnahmen erfolgreich generiert und technisch validiert.**

- Der Dialogkatalog enthält 17 Zeilen. Die bereits vorhandene `narrator_02.wav` wurde unverändert übernommen; die übrigen 16 Aufnahmen wurden mit dem lokalen Qwen3-TTS-VoiceDesign-Modell auf der NVIDIA GeForce RTX 5080 **sequenziell** generiert (`--max-new-tokens 1536`). Der Generator meldete `FERTIG: 17/17 validierte WAV-Dateien, Fehler=0` und Exit-Code 0.
- Die Dateien liegen unter `public/audio/`: `elira_01.wav` bis `elira_10.wav` (10), `bryn_01.wav` bis `bryn_03.wav` (3), `soren_01.wav` bis `soren_02.wav` (2) sowie `narrator_01.wav` und `narrator_02.wav` (2).
- `python scripts/generate_voices.py --rebuild-manifest` wurde erfolgreich ausgeführt und meldete `Manifest validiert: 17/17 Audioassets`.
- Unabhängige Bestandsprüfung: 17 WAV-Dateien auf der Festplatte, 17 Manifest-Einträge, 17 mit den tatsächlich gespeicherten Dateien übereinstimmende SHA-256-Prüfsummen und **0 fehlende IDs**.
- Zusätzlich wurde die neu generierte `public/audio/elira_01.wav` mit Pythons `wave`-Modul und PCM-Sampleauswertung erfolgreich decodiert: **3,760 Sekunden, 24.000 Hz, Mono, 16 Bit**, normierter RMS-Pegel **0,08025** und Peak-Pegel **0,87094**. Format-, Dauer- und Pegelprüfungen bestanden.
- Während des Durchlaufs erschienen nicht-fatale Hinweise zu fehlendem `flash-attn` (langsamerer PyTorch-Inferenzpfad), `pad_token_id` und dem künftig entfallenden Python-Modul `audioop`. **Keine Generierungs- oder Validierungsfehler** wurden gemeldet. Für Python 3.13 sollte die `audioop`-Abhängigkeit im WAV-Prüfcode ersetzt werden.
- Die technische Prüfung beweist die Lesbarkeit und das Vorhandensein eines nicht stummen Audiosignals. **Aussprache, vollständige Texttreue, Natürlichkeit und Sprecherkonsistenz wurden noch nicht durch menschliches Anhören bestätigt.** Kritische Dialogzeilen vor einem finalen Release nach Gehör überprüfen.

Aktuellen Zustand bei Bedarf erneut prüfen:

```powershell
$python = 'C:\AI\Qwen3-TTS\.venv\Scripts\python.exe'
& $python scripts\generate_voices.py --rebuild-manifest
```
