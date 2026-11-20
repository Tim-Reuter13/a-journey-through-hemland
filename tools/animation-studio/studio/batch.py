"""Batch generation with overlap: every Wan video is queued in ComfyUI at once (the models stay loaded), and each
finished video goes straight into motion capture + export while Wan already renders the next one.

  python studio/batch.py jobs.json            # [{"name", "action", "seed"?, "build"?, "seconds"?, "args"?: [...]}]
  python studio/batch.py jobs.json --force    # also redo clips that already exist

Clips that already exist in library/ are reused (the motion library), never generated twice.
"""
import json
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent
sys.path.insert(0, str(HERE))
import comfy_client as C  # noqa: E402
from animate import BUILDS, SUBJECT, tool  # noqa: E402

LIB = STUDIO / "library"


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    force = "--force" in sys.argv
    todo = [j for j in jobs if force or not (LIB / j["name"] / f"{j['name']}.fbx").exists()]
    print(f"{len(jobs)} clips, {len(jobs) - len(todo)} already in the library, {len(todo)} to make", flush=True)
    if not todo:
        return
    t0 = time.time()
    queued = []
    for j in todo:
        prompt = SUBJECT.format(build=BUILDS[j.get("build", "average")], action=j["action"].strip().rstrip(".") + ".")
        frames = max(5, int(round(j.get("seconds", 4.0) * 24 / 4)) * 4 + 1)
        fast = j.get("fast", (C.COMFY / "models" / "diffusion_models" / C.FAST_UNET).exists())
        q = C.queue(prompt, width=j.get("width", 1280 if fast else 832), height=j.get("height", 704 if fast else 480), frames=frames,
                    steps=j.get("steps", 20), seed=j.get("seed"), fast=fast)
        queued.append((j, q, prompt, frames))
        print(f"queued {j['name']} (seed {q['seed']})", flush=True)

    work: queue.Queue = queue.Queue()
    results = {}

    def mocap_worker():
        while True:
            item = work.get()
            if item is None:
                return
            j, video, meta = item
            t = time.time()
            cmd = [sys.executable, "-u", str(HERE / "animate.py"), "--video", str(video), "--name", j["name"],
                   "--meta", json.dumps(meta)] + j.get("args", ["--no-preview"])
            r = subprocess.run(cmd, cwd=STUDIO, capture_output=True, text=True, encoding="utf-8", errors="replace")
            results[j["name"]] = (r.returncode, round(time.time() - t))
            print(f"  mocap {j['name']}: exit {r.returncode} in {time.time() - t:.0f} s", flush=True)
            if r.returncode:
                print(r.stdout[-1500:], r.stderr[-800:], flush=True)

    th = threading.Thread(target=mocap_worker, daemon=True)
    th.start()
    for j, q, prompt, frames in queued:
        while (entry := C.done(q)) is None:
            time.sleep(2)
        frames_dir = STUDIO / "work" / j["name"] / "frames"
        if frames_dir.exists():
            for f in frames_dir.glob("*.png"):
                f.unlink()
        C.collect(entry, frames_dir)
        video = STUDIO / "work" / j["name"] / "video.mp4"
        subprocess.run([tool("ffmpeg"), "-y", "-v", "error", "-framerate", "24", "-i", str(frames_dir / "frame_%04d.png"),
                        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(video)], check=True)
        print(f"video {j['name']} ready after {time.time() - t0:.0f} s", flush=True)
        work.put((j, video, {"action": j["action"], "prompt": prompt, "seed": q["seed"], "frames": frames, "fps": 24,
                             "build": j.get("build", "average"), "tags": j.get("tags", [])}))
    C.free()            # Wan is done: all VRAM to the mocap that is still running
    work.put(None)
    th.join()
    ok = sum(1 for c, _ in results.values() if c == 0)
    print(f"BATCH_OK {ok}/{len(todo)} clips in {time.time() - t0:.0f} s", flush=True)


main()
