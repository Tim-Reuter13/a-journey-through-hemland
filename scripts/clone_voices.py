#!/usr/bin/env python3
"""One consistent voice per character.

VoiceDesign invents a new voice on every call, so lines rendered one by one sound like different
people. This renders a single reference clip per voice with VoiceDesign, then speaks every line of
that voice with the Base model's voice clone of that reference. Shared voices: the city and ambient
lines of one job use one voice; the village elder, smith and ranger barks use Elira, Bryn and Soren.

Run with the Qwen3-TTS venv:  C:\\AI\\Qwen3-TTS\\.venv\\Scripts\\python.exe scripts/clone_voices.py
Writes public/audio/<id>.wav (overwriting) and scripts/voice_refs/<voice>.wav, then the manifest.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_voices as gv  # noqa: E402  (shares catalog, WAV writing, model loading, manifest)

REFS = Path(__file__).resolve().parent / "voice_refs"
# A calm, neutral sentence with varied German sounds; long enough for a good speaker embedding.
REF_TEXT = "Ich war heute schon zweimal am Brunnen. Das Wasser ist kalt, und der Weg nach Kronwacht ist weit. Komm, setz dich zu mir."
SHARED = {"ambient_elder": "elira", "ambient_smith": "bryn", "ambient_ranger": "soren"}


def voice_of(speaker: str) -> str:
    if speaker in SHARED:
        return SHARED[speaker]
    for prefix in ("ambient_", "city_"):
        if speaker.startswith(prefix):
            return "job_" + speaker[len(prefix):]
    return speaker


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--dtype", default="bfloat16", choices=("bfloat16", "float16", "float32"))
    parser.add_argument("--batch", type=int, default=6)
    parser.add_argument("--voice", action="append", help="only these voices (after sharing)")
    args = parser.parse_args()
    catalog = gv.read_catalog()
    groups: dict[str, list[dict]] = {}
    for line in catalog["lines"]:
        groups.setdefault(voice_of(line["speaker"]), []).append(line)
    if args.voice:
        groups = {k: v for k, v in groups.items() if k in set(args.voice)}
    # The reference voice is designed from the first speaker that maps to it (job_* use the city prompt).
    instruct = {}
    for speaker, voice in catalog["voices"].items():
        key = voice_of(speaker)
        if key not in instruct or speaker.startswith("city_") or speaker == key:
            instruct[key] = voice["instruct"]

    REFS.mkdir(exist_ok=True)
    loader = argparse.Namespace(device=args.device, dtype=args.dtype, model=gv.DEFAULT_MODEL)
    missing = [k for k in groups if not (REFS / f"{k}.wav").exists()]
    if missing:
        model, torch = gv.load_model(loader)
        for key in missing:
            print(f"Referenzstimme {key}", flush=True)
            torch.manual_seed(20261021)
            waves, rate = model.generate_voice_design(text=REF_TEXT, instruct=instruct[key], language="German")
            gv.write_pcm_wav_atomic(REFS / f"{key}.wav", waves[0], int(rate))
        del model
        torch.cuda.empty_cache()

    loader.model = gv.DEFAULT_MODEL.parent / "Base"
    sys.modules.pop("sox", None)  # the first load left a spec-less shim behind; load_model re-creates it
    model, torch = gv.load_model(loader)
    done = 0
    for key, lines in groups.items():
        prompt = model.create_voice_clone_prompt(ref_audio=str(REFS / f"{key}.wav"), ref_text=REF_TEXT)
        for i in range(0, len(lines), args.batch):
            chunk = lines[i:i + args.batch]
            torch.manual_seed(20261021 + i)
            waves, rate = model.generate_voice_clone(text=[l["text"] for l in chunk], language=["German"] * len(chunk),
                                                     voice_clone_prompt=prompt * len(chunk))
            for line, wave in zip(chunk, waves):
                gv.write_pcm_wav_atomic(gv.AUDIO_DIR / f"{line['id']}.wav", wave, int(rate))
                done += 1
                print(f"[{done}] {key}: {line['id']}", flush=True)
    result, invalid = gv.store_manifest(catalog)
    print(f"FERTIG: {result['available_count']}/{result['catalog_count']} · Fehler {len(invalid)}", flush=True)
    return 1 if invalid else 0


if __name__ == "__main__":
    raise SystemExit(main())
