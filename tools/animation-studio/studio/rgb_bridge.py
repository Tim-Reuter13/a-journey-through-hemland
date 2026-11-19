"""Headless bridge into RGB MoCap (GEM-X / SOMA Native77).

Run with RGB MoCap's base runtime:  vendor/toyxyz_RGBMocap/runtime/python.exe -X utf8 rgb_bridge.py ...
Uses the app's own worker (gemx_reconstruct) and FBX exporter, so numerical
processing stays exactly as in the GUI.

  models                         download/verify the public GEM-X files
  reconstruct VIDEO ROOT [--no-correct]   -> prints project path
  export PROJECT OUT.fbx [--bvh OUT.bvh] [--origin]
"""
import argparse
import json
import subprocess
import sys
import uuid
from pathlib import Path

RGB = (Path(__file__).resolve().parent.parent / "rgb").resolve()
sys.path.insert(0, str(RGB))


def log(*a):
    print(*a, flush=True)


def cmd_models(_):
    from mocap.models import BY_KEY, GEMX_KEYS, download, ready
    for key in GEMX_KEYS:
        model = BY_KEY[key]
        if ready(model):
            log("ok  ", model.name)
            continue
        log("load", model.name)
        download(key, lambda kind, **v: log("    ", v.get("message", "")))
        log("done", model.name, ready(model))


def cmd_reconstruct(a):
    from mocap.paths import HOME, worker_command
    from mocap.storage import atomic_json
    from mocap.video import probe
    from mocap.correction_settings import correction_options

    video = Path(a.video).resolve()
    info = probe(video)
    end = min(info["duration"], 60.0)
    folder = HOME / "cache/worker_jobs"
    folder.mkdir(parents=True, exist_ok=True)
    request = folder / (uuid.uuid4().hex + ".json")
    atomic_json(request, dict(version=1, root=str(Path(a.root).resolve()), video=str(video), start=0.0,
                              end=end, correct=not a.no_correct,
                              correction=correction_options({"foot_lock": True, "hand_lock": False})))
    proc = subprocess.Popen(worker_command("gemx_reconstruct", "--request", str(request)),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                            encoding="utf-8", errors="replace", cwd=str(RGB))
    project, result, last = None, None, ""
    for line in proc.stdout:
        line = line.rstrip()
        if line.startswith("@@MOCAP@@"):
            ev = json.loads(line[9:])
            if ev["type"] == "progress":
                msg = ev.get("message", "")
                if msg != last:
                    log("  gemx:", msg)
                    last = msg
            elif ev["type"] in ("info", "failed"):
                log("  gemx", ev["type"] + ":", ev.get("message"))
            elif ev["type"] == "gemx_ready":
                project, result = ev["project"], ev["result"]
        elif line:
            log("  |", line[-300:])
    if proc.wait() or not project:
        raise SystemExit(f"GEM-X reconstruction failed (exit {proc.returncode})")
    print("@@PROJECT@@" + json.dumps({"project": project, "result": result}), flush=True)


def _export(project, kind, target, fmt):
    from mocap.motion_tools import selected_export
    source = selected_export(project, kind)
    if source is None:
        raise SystemExit(f"No current {kind} result in {project}")
    Path(target).unlink(missing_ok=True)  # our own previous export of this clip
    row = dict(project=str(project), kind=kind, target=str(target), source=str(source),
               place_at_origin=True, prepend_tpose=False, rig_name="SOMA", fbx_rest_pose='t')
    if fmt == "fbx":
        from mocap.fbx_export import run
        req = project / f".export-{uuid.uuid4().hex[:8]}.json"
        req.write_text(json.dumps([row]), encoding="utf-8")
        run(req)
    else:
        from mocap.gemx_skeleton_export import write
        verify = write(target, row, source, {Path(target).resolve()}, "bvh", lambda *_: None)
        verify()


def cmd_export(a):
    from mocap.motion_tools import selected_export
    project = Path(a.project).resolve()
    kind = "corrected_initial" if selected_export(project, "corrected_initial") else "initial"
    log("export kind:", kind)
    _export(project, kind, Path(a.out).resolve(), "fbx")
    if a.bvh:
        _export(project, kind, Path(a.bvh).resolve(), "bvh")
    print("@@KIND@@" + kind, flush=True)


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("models")
    r = sub.add_parser("reconstruct")
    r.add_argument("video")
    r.add_argument("root")
    r.add_argument("--no-correct", action="store_true")
    e = sub.add_parser("export")
    e.add_argument("project")
    e.add_argument("out")
    e.add_argument("--bvh")
    a = p.parse_args()
    {"models": cmd_models, "reconstruct": cmd_reconstruct, "export": cmd_export}[a.cmd](a)


if __name__ == "__main__":
    main()
