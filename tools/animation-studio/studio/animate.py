"""Animation Studio: text prompt -> Wan 2.2 video -> RGB MoCap (GEM-X) -> game-ready FBX/GLB.

Usage (system Python 3.12, stdlib only):
  python studio/animate.py "a man swings a heavy sword overhead and strikes down" --name sword_overhead
  python studio/animate.py --video my_clip.mp4 --name dance        # skip Wan, mocap an existing video
  python studio/animate.py --from-project <gemx project> --name x  # only redo export/retarget

Output: library/<name>/
  video.mp4            generated source clip (24 fps)
  contact.jpg          frame contact sheet (QC)
  <name>_soma.fbx/.bvh native SOMA Native77 skeleton (RGB MoCap exporter)
  <name>.fbx           humanoid (Mixamo bone names) for Unity/Unreal/Godot/Blender
  <name>.glb           same humanoid as glTF (Three.js / Hemland)
  preview.mp4          source video next to the solved skeleton (QC)
  meta.json            prompt, seed, frames, timings, paths
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(HERE))
RGB = (STUDIO / "rgb").resolve()  # junction -> C:/AS/rgb (short path, Windows MAX_PATH)
RGB_PY = RGB / "runtime" / "python.exe"
LIB = STUDIO / "library"
WORK = STUDIO / "work"
LOGS = STUDIO / "logs"

# The subject template keeps videos mocap-friendly: one person, full body, locked camera, plain set.
BUILDS = {
    "average": "A single adult man",
    "heavy": "A single stocky, broad-shouldered, heavily built adult man with a thick neck and strong arms, moving with heavy weight,",
    "lean": "A single lean, wiry, agile adult man",
}
SUBJECT = ("{build} in a fitted plain grey t-shirt, dark trousers and simple shoes, "
           "his whole body visible from head to feet the entire time, {action} "
           "Fixed static camera at waist height, wide full-body shot, the camera never moves. "
           "Completely empty bright light-grey room with a seamless backdrop and a flat floor, nothing else in the room, soft even lighting. "
           "Realistic human motion, natural weight and balance, sharp, 24fps.")


def log(*a):
    print(*a, flush=True)


def tool(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    local = list((RGB / "runtime_tools").rglob(name + ".exe")) if (RGB / "runtime_tools").exists() else []
    if local:
        return str(local[0])
    raise SystemExit(f"{name} not found")


def blender() -> Path:
    fixed = RGB / "runtime_character" / "blender.exe"
    if fixed.is_file():
        return fixed
    hits = sorted(RGB.glob("**/blender.exe"))
    if not hits:
        raise SystemExit("Blender (from RGB MoCap install.cmd) not found")
    return hits[0]


def run(cmd, **kw):
    log("  $", " ".join(str(c) for c in cmd)[:240])
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def bridge(*args) -> list[str]:
    """Run rgb_bridge.py inside RGB MoCap's runtime, echo output, return @@ lines."""
    proc = subprocess.Popen([str(RGB_PY), "-X", "utf8", "-u", str(HERE / "rgb_bridge.py"), *map(str, args)],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            encoding="utf-8", errors="replace", cwd=str(RGB))
    marks = []
    for line in proc.stdout:
        line = line.rstrip()
        (marks.append(line) if line.startswith("@@") else log(line))
    if proc.wait():
        raise SystemExit(f"rgb_bridge {args[0]} failed")
    return marks


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:48] or "anim"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("action", nargs="?", help="what the person does (English works best)")
    p.add_argument("--name")
    p.add_argument("--video", help="use an existing video instead of Wan")
    p.add_argument("--from-project", help="reuse an existing GEM-X result folder")
    p.add_argument("--image", help="optional start frame for Wan image-to-video")
    p.add_argument("--raw-prompt", action="store_true", help="send the action text to Wan unchanged")
    p.add_argument("--build", choices=sorted(BUILDS), default="average", help="body type of the generated actor")
    p.add_argument("--normal", action="store_true", help="regular Wan 2.2 with --steps instead of FastWan (3 steps)")
    p.add_argument("--seconds", type=float, default=4.0)
    p.add_argument("--width", type=int, default=None, help="default 1280 (FastWan) / 832 (--normal)")
    p.add_argument("--height", type=int, default=None, help="default 704 (FastWan) / 480 (--normal)")
    p.add_argument("--steps", type=int, default=20)
    p.add_argument("--cfg", type=float, default=5.0)
    p.add_argument("--seed", type=int)
    p.add_argument("--in-place", action="store_true", help="remove horizontal root travel (loops, locomotion)")
    p.add_argument("--loop", action="store_true", help="cut to the best matching loop and blend the seam")
    p.add_argument("--trim", default="", help="keep only START:END seconds of the solved motion")
    p.add_argument("--no-correct", action="store_true", help="skip foot-contact correction")
    p.add_argument("--no-preview", action="store_true")
    p.add_argument("--meta", default="", help="JSON merged into meta.json (used by batch.py)")
    a = p.parse_args()
    from comfy_client import COMFY, FAST_UNET
    a.fast = not a.normal and (COMFY / "models" / "diffusion_models" / FAST_UNET).exists()
    a.width = a.width or (1280 if a.fast else 832)
    a.height = a.height or (704 if a.fast else 480)
    if not (a.action or a.video or a.from_project):
        p.error("give an action prompt, --video or --from-project")

    name = slug(a.name or a.action or Path(a.video or a.from_project).stem)
    out = LIB / name
    out.mkdir(parents=True, exist_ok=True)
    for d in (WORK, LOGS):
        d.mkdir(exist_ok=True)
    meta = {"name": name, "created": time.strftime("%Y-%m-%d %H:%M:%S"), "timings": {}}
    meta_path = out / "meta.json"
    if meta_path.exists():
        meta = {**json.loads(meta_path.read_text(encoding="utf-8")), **meta}
    t0 = time.time()
    video = out / "video.mp4"

    # 1) Video
    if a.from_project:
        project = Path(a.from_project).resolve()
    else:
        if a.video:
            src = Path(a.video).resolve()
            if src != video:
                shutil.copyfile(src, video)
            meta["source"] = str(src)
        else:
            from comfy_client import generate
            prompt = a.action if a.raw_prompt else SUBJECT.format(build=BUILDS[a.build], action=a.action.strip().rstrip(".") + ".")
            frames = max(5, int(round(a.seconds * 24 / 4)) * 4 + 1)
            frames_dir = WORK / name / "frames"
            shutil.rmtree(frames_dir, ignore_errors=True)
            pngs, seed = generate(prompt, frames_dir, width=a.width, height=a.height, frames=frames,
                                  steps=a.steps, cfg=a.cfg, seed=a.seed,
                                  image=Path(a.image) if a.image else None, log=log, fast=a.fast)
            run([tool("ffmpeg"), "-y", "-v", "error", "-framerate", "24", "-i", frames_dir / "frame_%04d.png",
                 "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", video])
            meta.update(action=a.action, prompt=prompt, seed=seed, frames=len(pngs), fps=24, build=a.build,
                        size=[a.width, a.height], steps=a.steps, cfg=a.cfg)
        meta["timings"]["video_s"] = round(time.time() - t0)
        # QC contact sheet: 8 frames spread over the clip
        run([tool("ffmpeg"), "-y", "-v", "error", "-i", video, "-vf",
             "select='not(mod(n\\,15))',scale=480:-1,tile=4x2", "-frames:v", "1", out / "contact.jpg"])

        # 2) Motion capture (GEM-X)
        t1 = time.time()
        args = ["reconstruct", video, WORK / name / "mocap"]
        if a.no_correct:
            args.append("--no-correct")
        marks = bridge(*args)
        info = json.loads(next(m for m in marks if m.startswith("@@PROJECT@@"))[11:])
        project = Path(info["project"])
        meta["timings"]["mocap_s"] = round(time.time() - t1)
    meta["gemx_project"] = str(project)

    # 3) Native export
    soma_fbx, soma_bvh = out / f"{name}_soma.fbx", out / f"{name}_soma.bvh"
    marks = bridge("export", project, soma_fbx, "--bvh", soma_bvh)
    meta["result"] = next((m[8:] for m in marks if m.startswith("@@KIND@@")), "?")

    # 4) Humanoid retarget + cleanup + preview in Blender
    t2 = time.time()
    job = {"soma_fbx": str(soma_fbx), "fbx": str(out / f"{name}.fbx"), "glb": str(out / f"{name}.glb"),
           "name": name, "in_place": a.in_place, "loop": a.loop, "trim": a.trim,
           "preview": None if a.no_preview else str(WORK / name / "skeleton.mp4")}
    job_path = WORK / name / "blender_job.json"
    job_path.parent.mkdir(parents=True, exist_ok=True)
    job_path.write_text(json.dumps(job), encoding="utf-8")
    run([blender(), "-b", "--factory-startup", "-noaudio", "--python", HERE / "blender_retarget.py", "--", job_path],
        stdout=open(LOGS / f"blender_{name}.log", "w", encoding="utf-8"), stderr=subprocess.STDOUT)
    report = json.loads((WORK / name / "blender_job.json.out").read_text(encoding="utf-8"))
    meta["humanoid"] = report
    meta["timings"]["blender_s"] = round(time.time() - t2)
    if job["preview"] and Path(job["preview"]).exists() and video.exists():
        run([tool("ffmpeg"), "-y", "-v", "error", "-i", video, "-i", job["preview"], "-filter_complex",
             "[0:v]scale=-2:540,fps=30[a];[1:v]scale=-2:540,fps=30[b];[a][b]hstack=inputs=2:shortest=1",
             "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", out / "preview.mp4"])
    if a.meta:
        meta.update(json.loads(a.meta))
    meta["files"] = sorted(f.name for f in out.iterdir())
    meta["timings"]["total_s"] = round(time.time() - t0)
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    update_index()
    log(f"\nFertig: {out}")


def update_index():
    rows = []
    for d in sorted(LIB.iterdir()):
        m = d / "meta.json"
        if m.is_file():
            j = json.loads(m.read_text(encoding="utf-8"))
            rows.append({k: j.get(k) for k in ("name", "action", "seed", "result", "created")} |
                        {"frames": j.get("humanoid", {}).get("frames"), "fps": j.get("humanoid", {}).get("fps")})
    (LIB / "index.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
