"""The motion library: every clip ever made, searchable, so new films reuse moves instead of generating them.

  python studio/library.py                 # list everything
  python studio/library.py sword overhead  # clips whose name, action or tags contain all words
"""
import json
import sys
from pathlib import Path

LIB = Path(__file__).resolve().parent.parent / "library"


def clips():
    for d in sorted(LIB.iterdir()):
        m = d / "meta.json"
        if m.is_file() and (d / f"{d.name}.fbx").exists():
            j = json.loads(m.read_text(encoding="utf-8"))
            yield {"name": d.name, "action": j.get("action") or "", "tags": j.get("tags") or [], "build": j.get("build", "average"),
                   "seconds": (j.get("humanoid") or {}).get("seconds"), "seed": j.get("seed")}


def main():
    words = [w.lower() for w in sys.argv[1:]]
    for c in clips():
        text = " ".join([c["name"], c["action"], " ".join(c["tags"])]).lower()
        if all(w in text for w in words):
            print(f"{c['name']:22s} {c['seconds'] or 0:5.1f}s  {c['build']:8s} {c['action'][:90]}")


if __name__ == "__main__":
    main()
