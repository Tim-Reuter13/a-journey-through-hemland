"""Minimal ComfyUI API client for Wan 2.2 TI2V 5B text/image-to-video.

Stdlib only. Starts the local ComfyUI server on demand, queues an API-format
workflow, waits for it and returns the saved frame PNGs.
"""
from __future__ import annotations

import json
import os
import random
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
COMFY = STUDIO / "ComfyUI"
PORT = int(os.environ.get("ANIM_COMFY_PORT", "8189"))
URL = f"http://127.0.0.1:{PORT}"

# Wan's recommended negative prompt plus mocap-specific failures.
NEGATIVE = (
    "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，"
    "JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，"
    "手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走, "
    "camera movement, camera pan, zoom, close-up, cropped body, cut-off feet, cut-off head, "
    "multiple people, extra limbs, motion blur, text, watermark, tripod, light stand, camera equipment, "
    "props in the room, furniture, objects blocking the body"
)


def _get(path: str, timeout: float = 10):
    with urllib.request.urlopen(URL + path, timeout=timeout) as r:
        return json.loads(r.read())


def _post(path: str, data: dict):
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def alive() -> bool:
    try:
        _get("/system_stats", timeout=2)
        return True
    except (urllib.error.URLError, OSError, ValueError):
        return False


def ensure_server(log=print) -> None:
    if alive():
        return
    py = COMFY / "venv/Scripts/python.exe"
    logf = open(STUDIO / "logs/comfyui.log", "ab")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS if os.name == "nt" else 0
    subprocess.Popen([str(py), "main.py", "--port", str(PORT), "--listen", "127.0.0.1",
                      "--disable-auto-launch"], cwd=COMFY, stdout=logf, stderr=subprocess.STDOUT,
                     creationflags=flags)
    log(f"ComfyUI startet auf {URL} ...")
    for _ in range(240):
        if alive():
            return
        time.sleep(1)
    raise RuntimeError("ComfyUI did not start, see logs/comfyui.log")


def upload_image(path: Path) -> str:
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + path.read_bytes() + \
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(URL + "/upload/image", data=body,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["name"]


def workflow(prompt: str, *, width: int, height: int, frames: int, steps: int, cfg: float,
             seed: int, prefix: str, image_name: str | None = None) -> dict:
    wf = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": "wan2.2_ti2v_5B_fp16.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "wan2.2_vae.safetensors"}},
        "4": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 8.0}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": NEGATIVE}},
        "7": {"class_type": "Wan22ImageToVideoLatent",
              "inputs": {"vae": ["3", 0], "width": width, "height": height, "length": frames, "batch_size": 1}},
        "8": {"class_type": "KSampler",
              "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0],
                         "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "uni_pc",
                         "scheduler": "simple", "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefix}},
    }
    if image_name:
        wf["11"] = {"class_type": "LoadImage", "inputs": {"image": image_name}}
        wf["7"]["inputs"]["start_image"] = ["11", 0]
    return wf


def generate(prompt: str, out_dir: Path, *, width=1280, height=704, frames=121, steps=30, cfg=5.0,
             seed: int | None = None, image: Path | None = None, log=print) -> tuple[list[Path], int]:
    ensure_server(log)
    seed = random.randrange(2**31) if seed is None else seed
    image_name = upload_image(image) if image else None
    prefix = f"anim/{uuid.uuid4().hex[:10]}"
    wf = workflow(prompt, width=width, height=height, frames=frames, steps=steps, cfg=cfg,
                  seed=seed, prefix=prefix, image_name=image_name)
    pid = _post("/prompt", {"prompt": wf, "client_id": "animstudio"})["prompt_id"]
    log(f"Wan 2.2 rendert {frames} Frames {width}x{height}, seed {seed} ...")
    started = time.time()
    while True:
        hist = _get(f"/history/{pid}")
        if pid in hist:
            entry = hist[pid]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError("ComfyUI error: " + json.dumps(status.get("messages", []))[-2000:])
            if status.get("completed"):
                break
        time.sleep(3)
        if time.time() - started > 3 * 3600:
            raise TimeoutError("Wan generation exceeded 3 h")
    images = entry["outputs"]["10"]["images"]
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, im in enumerate(images):
        src = COMFY / "output" / im.get("subfolder", "") / im["filename"]
        dst = out_dir / f"frame_{i:04d}.png"
        os.replace(src, dst)
        paths.append(dst)
    log(f"Wan fertig in {time.time() - started:.0f} s")
    try:  # hand the VRAM back for the mocap step
        _post("/free", {"unload_models": True, "free_memory": True})
    except (urllib.error.URLError, OSError, ValueError):
        pass
    return paths, seed
