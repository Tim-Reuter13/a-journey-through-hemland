"""Keyframe mode: still pictures of the key poses -> 3D poses (GEM-X) -> animator's curves -> FBX/GLB.

  python studio/keyframes.py work/x/keys --name x --times 0,0.7,1.4,2.2,2.6,3.1 \
         --move "0,0;0.35,0;0.7,0;0.8,0;1.6,0;2.3,0" --air "0,0,0,0,0.45,0"

  pictures   the key poses in order (png/jpg/webp), one person, whole body, same camera if possible
  --times    when each key pose is reached, seconds (default: every 0.6 s)
  --move     where the hips are at each key: "forward,side" metres (default: on the spot)
  --air      hips lifted by this much at a key (jumps); every other key puts the lowest foot/hand on the floor

How: every picture is held for HOLD frames in a video, GEM-X solves that video once, the retarget turns it into the
Mixamo humanoid, and blender_keyframes.py takes the pose from the middle of each hold and rebuilds the clip with
Bezier in-betweens. No video model, no morphing between the pictures.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(HERE))
from animate import LIB, WORK, blender, tool  # noqa: E402

HOLD = 14          # frames per picture at 24 fps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pictures")
    ap.add_argument("--name", required=True)
    ap.add_argument("--times", default="")
    ap.add_argument("--move", default="")
    ap.add_argument("--air", default="")
    ap.add_argument("--in-place", action="store_true", help="cycle for the game: hips stay, feet slide back")
    ap.add_argument("--reuse", action="store_true", help="keep an existing GEM-X result of the same pictures")
    a = ap.parse_args()
    pics = sorted(p for p in Path(a.pictures).iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    n = len(pics)
    if n < 2:
        raise SystemExit("need at least two key pictures")
    times = [float(x) for x in a.times.split(",")] if a.times else [i * 0.6 for i in range(n)]
    move = [[float(v) for v in p.split(",")] for p in a.move.split(";")] if a.move else [[0, 0]] * n
    air = [float(x) for x in a.air.split(",")] if a.air else [0.0] * n
    assert len(times) == n and len(move) == n and len(air) == n, "times/move/air need one entry per picture"
    t0 = time.time()
    work = WORK / a.name
    work.mkdir(parents=True, exist_ok=True)

    # 1) hold video: every picture letterboxed to 1280x704 and shown for HOLD frames
    inputs, chains = [], []
    for i, p in enumerate(pics):
        inputs += ["-loop", "1", "-t", f"{HOLD / 24:.4f}", "-i", str(p)]
        chains.append(f"[{i}:v]scale=1280:704:force_original_aspect_ratio=decrease,pad=1280:704:(ow-iw)/2:(oh-ih)/2:color=0xd8d8d8,"
                      f"fps=24,setsar=1,format=yuv420p[v{i}]")
    filt = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[out]"
    holds = work / "holds.mp4"
    subprocess.run([tool("ffmpeg"), "-y", "-v", "error", *inputs, "-filter_complex", filt, "-map", "[out]",
                    "-c:v", "libx264", "-crf", "14", str(holds)], check=True)

    # 2) GEM-X + humanoid retarget on the hold video (the normal studio path)
    raw = f"{a.name}_raw"
    if not (a.reuse and (LIB / raw / f"{raw}.glb").exists()):
        subprocess.run([sys.executable, "-u", str(HERE / "animate.py"), "--video", str(holds), "--name", raw,
                        "--no-preview", "--no-correct"], check=True, cwd=STUDIO)
    t_mocap = time.time() - t0

    # 3) poses from the hold centres -> curves
    out = LIB / a.name
    out.mkdir(parents=True, exist_ok=True)
    job = {"raw_glb": str(LIB / raw / f"{raw}.glb"), "glb": str(out / f"{a.name}.glb"), "fbx": str(out / f"{a.name}.fbx"),
           "name": a.name, "hold_s": [(i * HOLD + HOLD / 2) / 24 for i in range(n)], "times": times, "move": move,
           "air": air, "fps": 30, "in_place": a.in_place}
    jp = work / "keyframes_job.json"
    jp.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([str(blender()), "-b", "--factory-startup", "-noaudio", "--python", str(HERE / "blender_keyframes.py"),
                        "--", str(jp)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if "KEYFRAMES_OK" not in r.stdout:
        print(r.stdout[-3000:], r.stderr[-2000:])
        raise SystemExit("blender_keyframes failed")
    subprocess.run([tool("ffmpeg"), "-y", "-v", "error", "-i", str(holds), "-vf",
                    f"select='eq(mod(n\\,{HOLD})\\,{HOLD // 2})',scale=420:-1,tile={n}x1", "-frames:v", "1",
                    str(out / "keys.jpg")], check=True)
    meta = {"name": a.name, "mode": "keyframes", "pictures": [str(p) for p in pics], "times": times, "move": move,
            "air": air, "created": time.strftime("%Y-%m-%d %H:%M:%S"),
            "timings": {"mocap_s": round(t_mocap), "total_s": round(time.time() - t0)}}
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"KEYFRAMES_DONE {out} in {time.time() - t0:.0f} s")


main()
