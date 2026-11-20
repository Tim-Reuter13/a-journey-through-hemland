"""Collision boxes of the film set, in three.js world axes, written next to the baked film.

python film/make_set.py <hemland repo>
Every stone, the altar and the fallen stone come from the stone_circle model itself (pois.gltf),
placed with the same scale/rotation as src/cutscene/stage.js; fire and props are boxes from their sizes.
The bake's choreography solver and the browser validator both read this file.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

REPO = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\timre\Documents\Codex\2026-10-09\ich-will-ein-skyrim-like-rpg-2")
CIRCLE = {"scale": 1.35, "rotation": -1.01}            # keep in sync with stage.js
FIRE = (3.0, 0.0, 0.8)
PROPS = [("woodpile", 1.5, 3.9, 0.3, (1.7, 0.9, 1.1)), ("sacks", 2.4, 2.3, -1.9, (1.6, 1.1, 0.5))]


def mat(n):
    t = np.array(n.get("translation", [0, 0, 0]))
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    s = np.array(n.get("scale", [1, 1, 1]))
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def parts(file, rootname):
    g = json.loads(Path(file).read_text(encoding="utf-8"))
    N, A = g["nodes"], g["accessors"]
    root = next(i for i, n in enumerate(N) if n.get("name") == rootname)
    out = []

    def walk(i, M):
        n = N[i]
        M = M @ mat(n)
        if "mesh" in n:
            acc = A[g["meshes"][n["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
            mn, mx = np.array(acc["min"]), np.array(acc["max"])
            cs = np.array([[a, b, c, 1] for a in (mn[0], mx[0]) for b in (mn[1], mx[1]) for c in (mn[2], mx[2])]) @ M.T
            out.append((n.get("name", ""), cs[:, :3].min(0), cs[:, :3].max(0)))
        for c in n.get("children", []):
            walk(c, M)
    walk(root, np.linalg.inv(mat(N[root])))
    return out


def main():
    s, th = CIRCLE["scale"], CIRCLE["rotation"]
    c, si = math.cos(th), math.sin(th)
    boxes = []
    for name, mn, mx in parts(REPO / "public/models/pois.gltf", "stone_circle"):
        short = name.replace("stone_circle_", "")
        if any(k in short for k in ("moss", "offering")) or mx[1] < 0.15:
            continue
        ctr, half = (mn + mx) / 2 * s, (mx - mn) / 2 * s
        # three.js rotation.y = th: x' = x cos + z sin, z' = -x sin + z cos
        wx, wz = ctr[0] * c + ctr[2] * si, -ctr[0] * si + ctr[2] * c
        bottom = max(ctr[1] - half[1], 0.0)
        top = ctr[1] + half[1]
        boxes.append({"name": short, "c": [round(wx, 3), round((bottom + top) / 2, 3), round(wz, 3)],
                      "h": [round(half[0], 3), round((top - bottom) / 2, 3), round(half[2], 3)], "yaw": th})
    boxes.append({"name": "fire", "c": [FIRE[0], 0.25, FIRE[2]], "h": [0.45, 0.25, 0.45], "yaw": 0.0})
    for name, x, z, ry, (w, h, d) in PROPS:
        boxes.append({"name": name, "c": [x, h / 2, z], "h": [w / 2, h / 2, d / 2], "yaw": ry})
    out = REPO / "public/cutscenes/letzte_wacht_set.json"
    out.write_text(json.dumps({"ground": 0.0, "colliders": boxes}, indent=1), encoding="utf-8")
    print("SET_OK", len(boxes), "boxes ->", out)


main()
