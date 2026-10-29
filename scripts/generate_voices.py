#!/usr/bin/env python3
"""Offline Qwen3-TTS VoiceDesign renderer for Ashen Realms.

Writes only to public/audio/. Does not edit the game or the Qwen install.
Uses Python's wave module instead of requiring an external SoX executable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import re
import sys
import tempfile
import traceback
import wave
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "scripts" / "dialogue_catalog.json"
AUDIO_DIR = ROOT / "public" / "audio"
MANIFEST_PATH = AUDIO_DIR / "manifest.json"
DEFAULT_MODEL = Path(r"C:\AI\Qwen3-TTS\models\VoiceDesign")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
MIN_DURATION = 0.22


def read_catalog() -> dict:
    data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if data.get("language") != "German" or not isinstance(data.get("voices"), dict):
        raise ValueError("Katalog muss 'German' und eine voices-Tabelle definieren")
    if not isinstance(data.get("lines"), list):
        raise ValueError("Katalog enthält keine gültige lines-Liste")
    seen = set()
    for line in data["lines"]:
        key = line.get("id")
        if not isinstance(key, str) or not ID_PATTERN.fullmatch(key) or key in seen:
            raise ValueError(f"Ungültige oder doppelte Audio-ID: {key!r}")
        seen.add(key)
        if line.get("speaker") not in data["voices"]:
            raise ValueError(f"Sprecher unbekannt: {key}")
        if not isinstance(line.get("text"), str) or not line["text"].strip():
            raise ValueError(f"Dialogtext fehlt: {key}")
        voice = data["voices"][line["speaker"]]
        if not isinstance(voice.get("instruct"), str) or not voice["instruct"].strip():
            raise ValueError(f"VoiceDesign-Prompt fehlt: {line['speaker']}")
    return data


def get_args(voices: dict, all_ids: set[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", action="append", dest="ids", metavar="AUDIO_ID",
                        help="Einzelne ID; mehrfach nutzbar, z.B. --id bryn_01")
    parser.add_argument("--speaker", action="append", choices=sorted(voices),
                        help="Sprecher filtern; mehrfach nutzbar")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL,
                        help="Lokaler VoiceDesign-Modellordner")
    parser.add_argument("--device", default="cuda:0", help="Torch-Gerät, Standard cuda:0")
    parser.add_argument("--dtype", default="bfloat16", choices=("bfloat16", "float16", "float32"))
    parser.add_argument("--seed", type=int, default=20261010)
    parser.add_argument("--max-new-tokens", type=int, default=2048,
                        help="Generationstokenlimit pro Zeile")
    parser.add_argument("--language", default="German", help="Qwen-Sprachcode")
    parser.add_argument("--force", action="store_true", help="Vorhandene gültige WAV-Dateien neu rendern")
    parser.add_argument("--dry-run", action="store_true", help="Nur Auswahl und Pfade prüfen, keine Imports/Schreibvorgänge")
    parser.add_argument("--list", action="store_true", help="Dialogkatalog anzeigen, keine Generierung")
    parser.add_argument("--rebuild-manifest", action="store_true",
                        help="Nur WAV-Bestand validieren und Manifest neu erstellen")
    args = parser.parse_args()
    invalid_ids = set(args.ids or ()) - all_ids
    if invalid_ids:
        parser.error("Unbekannte IDs: " + ", ".join(sorted(invalid_ids)))
    if args.max_new_tokens < 32:
        parser.error("--max-new-tokens muss mindestens 32 sein")
    if args.dry_run and args.rebuild_manifest:
        parser.error("--dry-run und --rebuild-manifest nicht kombinieren")
    return args


def choose_lines(catalog: dict, args: argparse.Namespace) -> list[dict]:
    lines = catalog["lines"]
    if args.ids:
        wanted = set(args.ids)
        lines = [line for line in lines if line["id"] in wanted]
    if args.speaker:
        speakers = set(args.speaker)
        lines = [line for line in lines if line["speaker"] in speakers]
    return lines


def wav_info(path: Path) -> dict:
    """Inspect real PCM WAV bytes, never assume a filename means success."""
    import audioop

    with wave.open(str(path), "rb") as handle:
        sample_rate = handle.getframerate()
        frames = handle.getnframes()
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        if handle.getcomptype() != "NONE" or width != 2 or channels != 1:
            raise ValueError("Erwartet wird eine mono 16-bit PCM WAV")
        if sample_rate < 16000 or frames < sample_rate * MIN_DURATION:
            raise ValueError(f"Ungültige Sample-Rate oder Audiodauer ({sample_rate} Hz, {frames} Samples)")
        payload = handle.readframes(frames)
    if len(payload) != frames * 2:
        raise ValueError("WAV-Daten sind unvollständig")
    rms = audioop.rms(payload, 2) / 32768.0
    peak = audioop.max(payload, 2) / 32768.0
    if rms < 0.00003 or peak < 0.001:
        raise ValueError("WAV ist praktisch stumm")
    return {
        "duration_seconds": round(frames / sample_rate, 3),
        "sample_rate": sample_rate,
        "channels": channels,
        "peak_dbfs": round(20 * math.log10(max(peak, 1e-9)), 2),
        "rms_dbfs": round(20 * math.log10(max(rms, 1e-9)), 2),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def store_manifest(catalog: dict) -> tuple[dict, dict[str, str]]:
    """Include ONLY physically present and successfully validated audio files."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    available = []
    invalid = {}
    for line in catalog["lines"]:
        path = AUDIO_DIR / (line["id"] + ".wav")
        if not path.is_file():
            continue
        try:
            info = wav_info(path)
        except (ValueError, OSError, EOFError) as exc:
            invalid[line["id"]] = str(exc)
            continue
        available.append({
            "id": line["id"],
            "speaker": line["speaker"],
            "scene": line.get("scene", ""),
            "text": line["text"],
            "url": "/audio/" + path.name,
            "filename": path.name,
            **info,
        })
    asset_ids = {item["id"] for item in available}
    manifest = {
        "schema_version": 1,
        "project": "Ashen Realms",
        "language": catalog["language"],
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "catalog_count": len(catalog["lines"]),
        "available_count": len(available),
        "missing_ids": [line["id"] for line in catalog["lines"] if line["id"] not in asset_ids],
        "assets": available,
    }
    write_json_atomic(MANIFEST_PATH, manifest)
    return manifest, invalid


def write_json_atomic(path: Path, content: dict) -> None:
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                     prefix=".manifest-", suffix=".tmp", dir=path.parent,
                                     delete=False) as stream:
        tmp = Path(stream.name)
        try:
            json.dump(content, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        except Exception:
            tmp.unlink(missing_ok=True)
            raise
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def write_pcm_wav_atomic(path: Path, signal, sample_rate: int) -> dict:
    import numpy as np

    audio = np.asarray(signal, dtype=np.float32).squeeze()
    if audio.ndim != 1 or audio.size == 0:
        raise ValueError(f"Qwen lieferte kein Mono-Audiosignal: shape={audio.shape}")
    if not np.all(np.isfinite(audio)):
        raise ValueError("Qwen lieferte NaN/Inf-Audiosamples")
    if not isinstance(sample_rate, int) or sample_rate < 16000 or sample_rate > 192000:
        raise ValueError(f"Unerwartete Samplingrate: {sample_rate!r}")
    if len(audio) < sample_rate * MIN_DURATION:
        raise ValueError("Qwen lieferte nur ein zu kurzes Audiosignal")
    rms = float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))
    peak = float(np.max(np.abs(audio)))
    if rms < 0.00003 or peak < 0.001:
        raise ValueError("Qwen lieferte praktisch stumme Ausgabe")
    # Transparent gain staging: preserve the model's dynamic range, prevent clipping.
    target_peak = 10 ** (-1.2 / 20)
    audio = audio * (target_peak / peak)
    ramp = min(round(sample_rate * 0.008), len(audio) // 2)
    if ramp > 1:
        fade = np.linspace(0, 1, ramp, dtype=np.float32)
        audio[:ramp] *= fade
        audio[-ramp:] *= fade[::-1]
    pcm = np.clip(np.rint(audio * 32767.0), -32768, 32767).astype("<i2")
    with tempfile.NamedTemporaryFile(prefix=".voice-", suffix=".wav.tmp",
                                     dir=path.parent, delete=False) as stream:
        temp_path = Path(stream.name)
    try:
        with wave.open(str(temp_path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(sample_rate)
            handle.writeframes(pcm.tobytes())
        result = wav_info(temp_path)
        os.replace(temp_path, path)
        return result
    finally:
        temp_path.unlink(missing_ok=True)


def load_model(args: argparse.Namespace):
    model_path = args.model.expanduser().resolve()
    if not model_path.is_dir() or not (model_path / "config.json").is_file():
        raise FileNotFoundError(f"Lokales Qwen VoiceDesign-Modell fehlt: {model_path}")
    # Disallow implicit network downloads and keep HF writable cache in project scope.
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HOME"] = str(AUDIO_DIR / ".hf-cache")
    os.environ["TORCH_HOME"] = str(AUDIO_DIR / ".torch-cache")
    # On Windows, Numba can stall while probing its default cache location
    # during the librosa import performed by qwen_tts. A writable project-local
    # cache fixes this without changing the installed Qwen environment.
    numba_cache = AUDIO_DIR / ".numba-cache"
    numba_cache.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("NUMBA_CACHE_DIR", str(numba_cache))
    import torch

    # qwen_tts indirectly imports the legacy Python `sox` package. That package
    # performs an unconditional `os.popen('sox -h')` check during import. On
    # this machine the installed SoX executable is broken (WinError 623), but
    # Qwen3-TTS does not require the SoX command for our PCM WAV output path.
    # Provide a tiny in-process compatibility shim before importing qwen_tts.
    # This keeps the Qwen environment untouched and only affects this script.
    import types
    import sys as _sys
    import importlib.util

    sox_spec = importlib.util.find_spec("sox")
    if sox_spec is not None:
        # Avoid executing sox.__init__ which calls the broken executable.
        shim = types.ModuleType("sox")
        shim.__path__ = [str(Path(sox_spec.origin).parent)]
        shim.__version__ = "shim"
        shim.NO_SOX = True
        _sys.modules.setdefault("sox", shim)

    from qwen_tts import Qwen3TTSModel

    if args.device.startswith("cuda") and not torch.cuda.is_available():
        raise RuntimeError("CUDA nicht verfügbar; --device cpu versuchen (deutlich langsamer)")
    if args.device.startswith("cuda"):
        print("GPU:", torch.cuda.get_device_name(0), flush=True)
    dtype = getattr(torch, args.dtype)
    print("Lade lokales VoiceDesign-Modell:", model_path, flush=True)
    model = Qwen3TTSModel.from_pretrained(
        str(model_path), device_map=args.device, dtype=dtype,
        attn_implementation="sdpa", local_files_only=True,
    )
    return model, torch


def main() -> int:
    catalog = read_catalog()
    args = get_args(catalog["voices"], {line["id"] for line in catalog["lines"]})
    chosen = choose_lines(catalog, args)
    if args.list or args.dry_run:
        print(f"Dialoge: {len(chosen)} / {len(catalog['lines'])}")
        for line in chosen:
            exists = (AUDIO_DIR / (line["id"] + ".wav")).exists()
            print(f"{line['id']:14} {line['speaker']:8} {'EXISTIERT' if exists else 'FEHLT':10} {line['text']}")
        if args.dry_run:
            print("DRY RUN: kein Modell geladen und keine Dateien geschrieben.")
        return 0
    if args.rebuild_manifest:
        result, invalid = store_manifest(catalog)
        print(f"Manifest validiert: {result['available_count']}/{result['catalog_count']} Audioassets")
        for key, reason in invalid.items():
            print(f"WARNUNG: {key}: {reason}", file=sys.stderr)
        return 1 if invalid else 0

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    pending = []
    failed = 0
    for line in chosen:
        dest = AUDIO_DIR / (line["id"] + ".wav")
        if dest.is_file() and not args.force:
            try:
                wav_info(dest)
                print("Überspringe vorhandene gültige WAV:", dest.name, flush=True)
                continue
            except (ValueError, OSError, EOFError) as exc:
                print(f"FEHLER: {dest.name} ist ungültig ({exc}); mit --force neu erstellen", file=sys.stderr)
                failed += 1
                continue
        pending.append(line)
    if not pending:
        manifest, invalid = store_manifest(catalog)
        print(f"Manifest: {manifest['available_count']}/{manifest['catalog_count']} vorhanden")
        return 1 if failed or invalid else 0

    # This import intentionally happens only when generation is actually required.
    model, torch = load_model(args)
    import numpy as np

    for index, line in enumerate(pending):
        line_seed = args.seed + catalog["lines"].index(line)
        random.seed(line_seed)
        np.random.seed(line_seed % (2 ** 32))
        torch.manual_seed(line_seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(line_seed)
        dest = AUDIO_DIR / (line["id"] + ".wav")
        print(f"[{index + 1}/{len(pending)}] Rendere {line['id']} ({line['speaker']})", flush=True)
        try:
            with torch.inference_mode():
                waveforms, sample_rate = model.generate_voice_design(
                    text=line["text"],
                    instruct=catalog["voices"][line["speaker"]]["instruct"],
                    language=args.language,
                    non_streaming_mode=True,
                    max_new_tokens=args.max_new_tokens,
                )
            if len(waveforms) != 1:
                raise ValueError(f"Erwartet 1 Audiosignal, erhalten: {len(waveforms)}")
            info = write_pcm_wav_atomic(dest, waveforms[0], int(sample_rate))
            print(f"OK {dest.name}: {info['duration_seconds']} s, {info['sample_rate']} Hz, {info['bytes']} Bytes", flush=True)
            store_manifest(catalog)
        except Exception as exc:
            failed += 1
            print(f"FEHLER bei {line['id']}: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            traceback.print_exc()
        finally:
            if args.device.startswith("cuda"):
                torch.cuda.empty_cache()
    result, invalid = store_manifest(catalog)
    print(f"FERTIG: {result['available_count']}/{result['catalog_count']} validierte WAV-Dateien, Fehler={failed}")
    return 1 if failed or invalid else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, FileNotFoundError, RuntimeError, ImportError, OSError) as exc:
        print(f"ABBRUCH: {type(exc).__name__}: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(2)
