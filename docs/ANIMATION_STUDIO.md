# Animation Studio – Anleitung

Das Animation Studio erzeugt aus einem Satz Text eine echte Motion-Capture-Animation für Spiele – komplett lokal auf
dem PC (RTX 5080). Damit ist auch die Cutscene „Die letzte Wacht“ (Hauptmenü → Animationstest) entstanden.

```
"swings a heavy sword overhead"                       Text (Englisch funktioniert am besten)
        │  Wan 2.2 TI2V 5B in ComfyUI                   ~6 Min: 5-s-Video, ein Mann, ganzer Körper, Kamera steht
        ▼
   video.mp4
        │  RGB MoCap · GEM-X (toyxyz_RGBMocap)          ~3 Min: 3D-Bewegung, Fußkontakte korrigiert
        ▼
   <name>_soma.fbx / .bvh                               natives SOMA-Skelett (77 Gelenke)
        │  Blender 4.5 (im Hintergrund)                 ~20 s: Retarget, Ausrichtung, In-Place, Loop
        ▼
   <name>.fbx  (Mixamo-Knochennamen → Unity, Unreal, Godot, Blender)
   <name>.glb  (Three.js)
   preview.mp4, contact.jpg  (zur Kontrolle)
```

## Version 2 (2026-11-20): schneller, passend, geprüft

Nach der ersten Fassung des Films (Figuren schauten falsch, steckten in Steinen, Schläge trafen nicht, der Gang
wirkte zu schlank, 2 Stunden Wartezeit) wurde die Pipeline umgebaut:

| Bereich | Was jetzt passiert | Datei |
| --- | --- | --- |
| Tempo | Wan mit 832×480 und 20 Schritten (4× schneller), `batch.py` stellt alle Videos auf einmal in die Warteschlange und löst jedes fertige Video sofort per Mocap, während Wan schon das nächste rendert | `studio/batch.py`, `studio/comfy_client.py` |
| Bibliothek | jeder Clip wird nur einmal erzeugt; `batch.py` überspringt vorhandene, `library.py` sucht nach Wörtern | `studio/library.py` |
| Darsteller | `--build heavy` (stämmig, breitschultrig) für den Hauptmann, `lean` für den Banditen | `studio/animate.py` |
| Retarget 2.0 | Arme bleiben außerhalb des breiten Blockbench-Torsos, schwere Rüstung trägt die Arme weiter, Kopf rollt nicht, kein Einsinken/Schweben | `film/solver.py` |
| Schwert | wie `aimSword` im Spiel: Ruhe vorwärts-unten, Schwung verlängert den Unterarm, im Treffmoment auf das Ziel, Parade quer, Klingen treffen sich an einem gemeinsamen Punkt; linke Hand per IK an den Griff | `film/solver.py` |
| Choreografie-Löser | Brust zeigt im Schlagmoment zum Gegner, Suche über Abstand und Winkel bis die Klinge trifft, niemand steht in Steinen/Altar/Feuer, Rückstoß nach Körpertreffern | `film/bake_film.py` |
| Prüfer | Bake-Bericht (`letzte_wacht_report.json`: Treffer, Blickrichtung, Clipping) + Browser-Prüfer (Kamera in Geometrie, Figur verdeckt – auch durch den Gegner –, abgeschnitten, zu nah an der Linse) | `film/bake_film.py`, `src/cutscene/check.js` |
| Kamera-Löser | ein Shot, der durchfällt, wird automatisch umkreist/angehoben/herangezogen, bis er besteht | `src/cutscene/check.js` |
| KI-Review | Kontaktbögen pro Shot → Review-Agent (Claude, Codex als Zweitmeinung) mit festen Kriterien → JSON-Mängelliste → Korrektur → erneut prüfen | `film/review_prompt.md` |
| Live-Editor | `?film=edit` oder F2 im Film: Zeitleiste mit Shots und Prüfer-Markern, freie Kamera, Figuren pro Segment schieben/drehen, „Speichern“ → `letzte_wacht_edits.json`, die der nächste Bake übernimmt | `src/cutscene/editor.js` |
| Ton | echte CC0-Aufnahmen über Openverse/Freesound statt Synthese (3 Musikstücke, Wind, Feuer, Schritte mit Kettenhemd, Klingen, Treffer, Stürze), Nachweise in `public/audio/film/CREDITS.json` | `src/cutscene/score.js` |

### Gemessen am 2026-11-20 (Version 2)

| Schritt | vorher (v1) | jetzt (v2) |
| --- | --- | --- |
| Wan pro Clip | ~369 s (1280×704, 30 Schritte, 5 s) | ~110 s (832×480, 20 Schritte, 5 s) · 91 s bei 4 s · 4,5 s pro Schritt statt 10,7 |
| GEM-X pro Clip | ~110 s | 119–203 s, Median ~150 s (läuft jetzt parallel zu Wan; ist damit der Engpass) |
| 8 Clips (Batch) | ~67 min nacheinander | **22 min** (`BATCH_OK 8/8 clips in 1317 s`) |
| Bake mit Löser | ~30 s | ~1–1,5 min (Suche über Abstand × seitlich × Winkel pro Treffer) |
| Kamera-Löser beim Laden im Browser | – | ~0,9 s für 17 Shots |
| Restfehler laut Prüfer | ungeprüft | Bake: 1 (5 cm, 0,7 s) · Browser: 1 (0,25 s verdeckt) |

Erfahrungen v2: Wan liefert bei manchen Seeds Fehlclips (Person fehlt die halbe Zeit, oder kaum Bewegung) –
Kontaktbogen ansehen und in `bake_film.py` den besseren Clip wählen (`pick(...)`). Für die Schlag-Ausrichtung kann
statt der schnellsten Hand der höchste Punkt des Schwerts gewählt werden (`align=("block", t)`), wenn ein Clip
vorher noch einen anderen Schwung enthält.

## Wo liegt was (auf dem PC)

| Ort | Inhalt |
| --- | --- |
| `C:\Users\timre\Music\.Animation Studio\` | das Studio |
| `…\ComfyUI\` | ComfyUI mit eigenem Python (PyTorch CUDA 12.8); Modelle in `models\diffusion_models`, `text_encoders`, `vae` |
| `…\rgb\` → `C:\AS\rgb\` | RGB MoCap (Verknüpfung; liegt auf kurzem Pfad, weil der Installer sonst an Windows' 260-Zeichen-Grenze scheitert) |
| `…\studio\` | die Steuer-Skripte (Kopie hier im Repo: `tools/animation-studio/studio/`) |
| `…\film\` | Skripte für die Hemland-Cutscene (Kopie: `tools/animation-studio/film/`) |
| `…\library\<name>\` | fertige Animationen |
| `…\work\`, `…\logs\` | Zwischenstände und Logs |

Cloud-Sessions haben weder die GPU noch die Modelle: Animationen erzeugen geht nur am PC. Die Skripte hier im Repo
sind zum Lesen und Ändern; die laufende Kopie liegt im Studio-Ordner.

## Eine Animation erzeugen

```powershell
cd "C:\Users\timre\Music\.Animation Studio"
python studio\animate.py "swings a heavy longsword overhead and strikes down hard" --name sword_overhead
```

Nützliche Optionen:

| Option | Wirkung |
| --- | --- |
| `--name x` | Ordnername in `library\` |
| `--seed N` | anderer Zufall → andere Bewegung; bei schlechtem Ergebnis einfach neuen Seed nehmen |
| `--seconds 5` | Videolänge (5 s = 121 Bilder bei 24 fps) |
| `--in-place` | entfernt die Vorwärtsbewegung (für Lauf-/Idle-Zyklen) |
| `--loop` | sucht den besten Schleifenpunkt und blendet die Naht |
| `--trim 0.5:3.2` | nur diesen Abschnitt behalten |
| `--video clip.mp4` | eigenes Video statt Wan verwenden (z. B. Handyvideo von dir selbst) |
| `--from-project <ordner>` | nur Export/Retarget neu machen, ohne neu zu rechnen |
| `--image start.png` | Startbild für Image-to-Video |
| `--raw-prompt` | Text unverändert an Wan geben (ohne Studio-Vorlage) |

Die Vorlage ergänzt den Text automatisch um „ein Mann, ganzer Körper sichtbar, feste Kamera, leerer heller Raum“ –
das braucht die Motion Capture. Das Wort „tripod“ nie verwenden: dann steht ein Stativ im Bild und verdeckt die Beine.

## Ergebnis prüfen

`library\<name>\contact.jpg` zeigt 8 Bilder aus dem Video, `preview.mp4` das Video neben dem gelösten Skelett
(Frontansicht, rot = rechte Seite, blau = linke). Wenn die Bewegung im Video schon falsch ist (Wan erfindet manchmal
Unsinn), mit anderem `--seed` neu erzeugen. Wenn Beine verdeckt oder abgeschnitten sind, wird die Motion Capture schlecht.

## In Hemland verwenden (die Cutscene)

Hemlands Figuren sind starre Blockbench-Rigs (`root > hips > torso > chest > neck > head`, Arm- und Beinketten). Sie
haben keine Skelett-Animationen; deshalb wird die Bewegung in Blender auf die Pivots übertragen und als kompakte
Daten gebacken:

1. Clips erzeugen: `python film\clips.py` (alle Clips der Cutscene, überspringt fertige).
2. Choreografie steht in `film\bake_film.py` (`BANDIT`, `CAPTAIN`: welcher Clip wann, wo, wie schnell, Zeitlupe,
   Ausrichtung auf Schlag-/Block-Momente, Laufzyklen mit Fußgleit-Korrektur).
3. Backen nach Hemland:
   ```powershell
   C:\AS\rgb\runtime_character\blender.exe -b --factory-startup --python film\bake_film.py -- "C:\Users\timre\Documents\Codex\2026-10-09\ich-will-ein-skyrim-like-rpg-2\public\cutscenes"
   ```
   Ergebnis: `public/cutscenes/letzte_wacht.json` (Kopf, Ereignisse für Ton und Effekte) und `.bin` (je Figur und Bild:
   Hüftposition + ein Quaternion pro Pivot, Three.js-Achsen, 30 Hz).
4. Im Spiel: `src/cutscene/` – `film.js` spielt die Daten ab, `stage.js` baut das Set, `shots.js` den Schnitt,
   `fx.js` die Partikel, `score.js` Musik und Geräusche. Prüfen im Browser mit `__FILM__.seek(t)`, `pause()`, `debug()`.

Retarget-Prinzip (`film/hemrig.py`): jeder Pivot bekommt die Welt-Rotation des passenden Mocap-Knochens, verrechnet
mit einem festen Versatz, der die T-Pose des Mocap-Skeletts auf die hängenden Arme/Beine des Blockbench-Rigs dreht.
Die Hüftbewegung wird über die Beinlänge skaliert (nicht über die Hüfthöhe der Ruhepose – die liegt bei sitzenden
Clips falsch in der Datei).

## Einrichtung (falls neu aufgesetzt werden muss)

- ComfyUI: `git clone` nach `ComfyUI\`, `python -m venv venv`, PyTorch cu128, `pip install -r requirements.txt`.
  Modelle (Comfy-Org auf Hugging Face): `wan2.2_ti2v_5B_fp16.safetensors`, `umt5_xxl_fp8_e4m3fn_scaled.safetensors`,
  `wan2.2_vae.safetensors`. Der Server startet automatisch auf Port 8189, wenn `animate.py` läuft.
- RGB MoCap: `git clone https://github.com/toyxyz/toyxyz_RGBMocap` nach `C:\AS\rgb`, `install.cmd`, dann
  `runtime\python.exe -I -X utf8 -B tools\setup_gemx.py` (GEM-X, Lizenzen am 2026-11-19 vom Besitzer freigegeben),
  Modelle: `runtime\python.exe -X utf8 studio\rgb_bridge.py models`.
- ExMR/FlowHMR (bessere Qualität als GEM-X) bräuchten SMPL-X, das eine Registrierung des Besitzers erfordert – nicht eingerichtet.

## Zeiten und Zahlen (gemessen am 2026-11-19)

System: RTX 5080 16 GB (Treiber mit CUDA 13.5), Windows 11, Python 3.12, PyTorch 2.11 cu128 (ComfyUI),
GEM-X-Runtime mit PyTorch 2.10 cu128. Leitung beim Einrichten ~4–5 MB/s.

### Pro Clip (5 s, 121 Bilder, 1280×704, 30 Schritte) – gemessen an 6 Film-Clips

| Schritt | Zeit | Anteil |
| --- | --- | --- |
| Wan 2.2 in ComfyUI („Prompt executed“) | 352–377 s, Median ~369 s | ~75 % |
| ↳ davon Sampling: 30 Schritte × ~10,8 s | ~324 s | |
| ↳ davon Modelle laden, Text kodieren, VAE-Dekodieren, PNGs speichern | ~30–50 s | |
| PNG → MP4 + Kontaktbogen (ffmpeg) | ~2 s | |
| GEM-X Motion Capture (Modell-Prüfsummen, Personenerkennung, 2D-Punkte, Bewegung, SOMA-Geometrie, Fußkorrektur) | 103–124 s, Median ~110 s | ~23 % |
| ↳ allererster Lauf überhaupt (Warp-Kernel kompilieren) | ~190 s | |
| Export SOMA-FBX/BVH | ~2 s | |
| Blender-Retarget ohne Vorschau / mit Skelett-Vorschauvideo | ~2 s / ~20 s | |
| **Gesamt pro Clip** | **475–521 s (8–8,7 Min)** | |

Ausreißer: 443 s für Wan, als nebenbei die Cutscene im Browser getestet wurde (GPU geteilt).

Last während Wan: GPU 99 %, ~10,9 GB VRAM, ~315 W, ~71 °C. GEM-X braucht laut Projekt ~3,5 GB VRAM (Spitze).

### Film „Die letzte Wacht“

| Schritt | Zeit |
| --- | --- |
| 13 Mocap-Clips nacheinander | ~1 h 50 min |
| Bake in Blender (2 Figuren, 3601 Bilder bei 30 Hz) | unter 1 Minute |
| Animationsdaten | 1,07 MB `.bin` + 6 KB `.json` |
| Abspielen in Hemland | 2–3 ms pro Bild (1024×428, Pixelskala 1) |

### Einmalige Einrichtung

| Schritt | Zeit | Platz |
| --- | --- | --- |
| ComfyUI + PyTorch installieren | ~10 min | venv 5,9 GB |
| Wan-Modelle laden (Diffusion 9,4 GB, Text-Encoder 6,3 GB, VAE 1,4 GB) | ~70 min | 17,1 GB |
| RGB MoCap `install.cmd` (Basis, Blender 4.5, FFmpeg, ExMR/FlowHMR/GVHMR-Runtimes) | ~1,5 h inkl. zwei Fehlversuche am Pfadlimit | Runtimes gemessen ~12,5 GB (runtime 5,3 · exmr 5,2 · character/Blender 0,9 · flow 0,6 · gui 0,5) + Setup-Cache |
| GEM-X-Runtime (`setup_gemx.py`) | ~25 min | 2,2 GB |
| GEM-X-Modelle (9 Dateien) | ~15 min | 7,2 GB |

### Ideen für einen schnelleren Weg (ungetestet, geschätzt)

| Idee | erwartete Wirkung | Risiko |
| --- | --- | --- |
| Wan mit 20 statt 30 Schritten (`--steps 20`) | Sampling −33 % → ~6,5 min/Clip | Bewegung unsauberer |
| Kleinere Auflösung (`--width 960 --height 544` oder 832×480) | Sampling ~−40–55 % | Person muss groß genug bleiben (ganzer Körper ≥ ~300 px) |
| Kürzere Clips (`--seconds 3`) für einzelne Aktionen | ~−40 % | weniger Vorlauf/Nachlauf |
| Destillierte/schnelle Wan-2.2-5B-Varianten (4–8 Schritte, z. B. FastWan- oder Lightning-LoRAs) | ~−70–85 % Sampling | Verfügbarkeit und Qualität prüfen |
| fp8-Version des 5B-Modells | weniger VRAM, evtl. schneller auf Blackwell | leicht andere Ergebnisse |
| Modelle im Batch geladen lassen (`/free` nur bei VRAM-Not, `comfy_client.py`) | ~−30 s/Clip | GEM-X braucht dann freien VRAM |
| Überlappen: Wan für Clip N+1 rechnet, während GEM-X Clip N löst | spart die ~2 min GEM-X pro Clip (~−20 %) | 11 GB + 3,5 GB knapp unter 16 GB, OOM möglich |
| Eigene Videos statt Wan (`--video`, z. B. Handy, du selbst) | Wan entfällt → ~2 min/Clip | Kamera muss stehen, ganzer Körper im Bild |
| ExMR/FlowHMR statt GEM-X | bessere Bewegung, aber langsamer | SMPL-X-Registrierung nötig |

### Was beim Film schiefging (Erfahrungen)

- „tripod“ im Prompt → Stativ im Bild, verdeckt die Beine.
- Gehen auf die Kamera zu: Tiefe unterschätzt (gemessen 0,5 m/s); Fußgleit-Korrektur im Bake passt die Geschwindigkeit an.
- Sitzender Clip: Ruhepose in der FBX lag 0,77 m zu tief → Skalierung über Beinlänge statt Hüfthöhe.
- Wan malt manchmal Requisiten oder eine zweite Person an den Bildrand; GEM-X nimmt trotzdem die Hauptperson.

## Grenzen

- Ein Clip dauert ~10 Minuten und belegt die Grafikkarte voll (nicht nebenbei spielen).
- Eine Person pro Video; Zweikämpfe entstehen aus zwei Einzelclips, im Bake zeitlich aufeinander ausgerichtet.
- Wan 2.2 5B erzeugt nicht immer physikalisch sinnvolle Bewegung; Gehen auf die Kamera zu wird in der Tiefe leicht
  unterschätzt (die Fußgleit-Korrektur im Bake gleicht das aus).
- Finger werden gelöst, aber Hemland-Rigs haben keine Finger.

## FastWan (Stand 2026-11-20 abends)
- `studio/convert_fastwan.py` wandelt FastWan2.2-TI2V-5B (diffusers) ins Wan-Format um (mit dem ComfyUI-venv-Python ausführen) → `ComfyUI/models/diffusion_models/fastwan2.2_ti2v_5b.safetensors`.
- Wenn die Datei da ist, ist FastWan der Standard: 3 Schritte (Sigmas 1.0/0.757/0.522, Sampler lcm), 1280×704, **~60 s pro 4-s-Clip** (vorher ~110 s bei 832×480/20 Schritten, v1 ~369 s). `--normal` schaltet zurück.
- Flaschenhals ist jetzt GEM-X (~120–200 s pro Clip); batch.py lässt es parallel zu Wan laufen.
- Review-Runde 3: Bake mit 1 Rest-Issue (Banditen-Oberarm 5 cm in stone19 bei 43,7 s), Browser-Check 1 kurzes Verdecken in Shot 5. Shot 12 hat eine höhere Kamera bekommen, weil der Solver sie zu nah gezogen hatte.
