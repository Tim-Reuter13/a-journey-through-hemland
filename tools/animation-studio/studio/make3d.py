"""Image (or text) -> textured 3D model (GLB) with Pixal3D in the studio's ComfyUI.

  python studio/make3d.py bild.png --name axt                 # one picture -> library3d/axt/axt.glb
  python studio/make3d.py --prompt "a rusty iron lantern" --name laterne   # text -> Wan picture -> 3D
  options: --faces 20000 (polygon budget, default 30000)  --tex 1024 (texture size)  --seed N
           --trellis (TRELLIS.2 instead of Pixal3D, for comparison)  --keep-bg (picture already cut out)

Pipeline = ComfyUI's own template "Pixal3D & TRELLIS.2: Image to Model" (studio/workflows/pixal3d_api.json):
BiRefNet cut-out -> MoGe camera FOV -> Pixal3D structure / shape / upsample / texture -> remesh, decimate,
UV unwrap, bake base colour + normal + AO -> GLB. Models live in ComfyUI/models (see README).
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
import time
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(HERE))
import comfy_client as C  # noqa: E402

LIB = STUDIO / "library3d"
WF = HERE / "workflows" / "pixal3d_api.json"
PICTURE = ("a single {what}, the whole object fully visible and centered, three-quarter view, "
           "plain light grey studio background, soft even lighting, sharp detailed product photo, no people")


def picture_from_text(what: str, out: Path, seed: int) -> Path:
    """One Wan 2.2 frame as the reference picture (FastWan when installed)."""
    fast = (C.COMFY / "models" / "diffusion_models" / C.FAST_UNET).exists()
    job = C.queue(PICTURE.format(what=what.strip().rstrip(".")), width=1280 if fast else 832,
                  height=704 if fast else 480, frames=1, steps=20, seed=seed, fast=fast)
    while (entry := C.done(job)) is None:
        time.sleep(1)
    frame = C.collect(entry, out.parent / "picture")[0]
    shutil.move(frame, out)
    shutil.rmtree(out.parent / "picture", ignore_errors=True)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image", nargs="?")
    ap.add_argument("--prompt")
    ap.add_argument("--name", required=True)
    ap.add_argument("--faces", type=int, default=30000)
    ap.add_argument("--tex", type=int, default=1024)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--trellis", action="store_true")
    ap.add_argument("--keep-bg", action="store_true")
    a = ap.parse_args()
    if not a.image and not a.prompt:
        ap.error("give a picture or --prompt")
    out = LIB / a.name
    out.mkdir(parents=True, exist_ok=True)
    seed = random.randrange(2**31) if a.seed is None else a.seed
    t0 = time.time()
    C.ensure_server()
    if a.prompt:
        src = picture_from_text(a.prompt, out / "source.png", seed)
        C.free()          # Wan out of VRAM before Pixal3D loads
        print(f"picture from text in {time.time() - t0:.0f} s", flush=True)
    else:
        src = out / ("source" + Path(a.image).suffix.lower())
        if Path(a.image).resolve() != src.resolve():
            shutil.copyfile(a.image, src)
    t1 = time.time()

    wf = json.loads(WF.read_text(encoding="utf-8"))
    wf["122"]["inputs"]["image"] = C.upload_image(src)
    for k in ("3", "12", "18", "23"):
        wf[k]["inputs"]["seed"] = seed
    wf["316"]["inputs"]["value"] = bool(a.trellis)
    wf["248"]["inputs"]["switch"] = not a.keep_bg
    wf["288"]["inputs"]["value"] = a.tex                       # UV atlas + base colour bake size
    wf["224"]["inputs"]["resolution"] = a.tex                  # normal map
    wf["233"]["inputs"]["resolution"] = min(a.tex, 1024)       # AO
    wf["186"]["inputs"]["target_face_count"] = a.faces
    prefix = f"3d/{a.name}_{uuid.uuid4().hex[:6]}"
    wf["322"]["inputs"]["filename_prefix"] = prefix
    pid = C._post("/prompt", {"prompt": wf, "client_id": uuid.uuid4().hex})["prompt_id"]
    job = {"pid": pid}
    while (entry := C.done(job)) is None:
        time.sleep(2)
    secs = time.time() - t1

    glb = None
    for node, res in entry["outputs"].items():
        for item in sum((v for v in res.values() if isinstance(v, list)), []):
            if isinstance(item, dict) and str(item.get("filename", "")).lower().endswith((".glb", ".gltf")) \
                    and item.get("type") == "output":
                glb = C.COMFY / "output" / item.get("subfolder", "") / item["filename"]
    if not glb or not glb.exists():   # fall back to the newest file with our prefix
        hits = sorted((C.COMFY / "output").glob(prefix + "*.glb"), key=lambda p: p.stat().st_mtime)
        glb = hits[-1] if hits else None
    if not glb:
        raise SystemExit("no GLB in the ComfyUI outputs: " + json.dumps(entry["outputs"])[:1500])
    dst = out / f"{a.name}.glb"
    shutil.move(glb, dst)
    meta = {"name": a.name, "source": src.name, "prompt": a.prompt, "seed": seed, "faces": a.faces, "tex": a.tex,
            "model": "trellis2" if a.trellis else "pixal3d", "seconds_3d": round(secs),
            "seconds_total": round(time.time() - t0), "made": time.strftime("%Y-%m-%d %H:%M")}
    (out / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"MAKE3D_OK {dst} ({dst.stat().st_size / 1e6:.1f} MB) 3D in {secs:.0f} s, total {time.time() - t0:.0f} s",
          flush=True)


main()
