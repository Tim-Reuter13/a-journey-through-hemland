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


def queue(prompt: str, *, width=832, height=480, frames=97, steps=20, cfg=5.0, seed: int | None = None,
          image: Path | None = None, log=print, fast=False) -> dict:
    """Submit one Wan job without waiting. Returns {pid, seed, prefix}."""
    ensure_server(log)
    seed = random.randrange(2**31) if seed is None else seed
    image_name = upload_image(image) if image else None
    prefix = f"anim/{uuid.uuid4().hex[:10]}"
    if fast:
        wf = workflow_fast(prompt, width=width, height=height, frames=frames, seed=seed, prefix=prefix, image_name=image_name)
    else:
        wf = workflow(prompt, width=width, height=height, frames=frames, steps=steps, cfg=cfg,
                      seed=seed, prefix=prefix, image_name=image_name)
    pid = _post("/prompt", {"prompt": wf, "client_id": "animstudio"})["prompt_id"]
    return {"pid": pid, "seed": seed, "prefix": prefix, "queued": time.time()}


def done(job: dict) -> dict | None:
    """The finished history entry of a queued job, None while it still runs (raises on error)."""
    hist = _get(f"/history/{job['pid']}")
    entry = hist.get(job["pid"])
    if not entry:
        return None
    status = entry.get("status", {})
    if status.get("status_str") == "error":
        raise RuntimeError("ComfyUI error: " + json.dumps(status.get("messages", []))[-2000:])
    return entry if status.get("completed") else None


def collect(entry: dict, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, im in enumerate(entry["outputs"]["10"]["images"]):
        src = COMFY / "output" / im.get("subfolder", "") / im["filename"]
        dst = out_dir / f"frame_{i:04d}.png"
        os.replace(src, dst)
        paths.append(dst)
    return paths


def free():
    try:
        _post("/free", {"unload_models": True, "free_memory": True})
    except (urllib.error.URLError, OSError, ValueError):
        pass


FAST_UNET = "fastwan2.2_ti2v_5b.safetensors"   # FastWan 2.2 5B (3-step DMD distillation), converted by convert_fastwan.py


def workflow_fast(prompt: str, *, width: int, height: int, frames: int, seed: int, prefix: str,
                  image_name: str | None = None) -> dict:
    """FastWan: 3 denoising steps at the distilled timesteps 1000/757/522, x0-prediction re-noised (LCM), no CFG."""
    wf = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": FAST_UNET, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "wan2.2_vae.safetensors"}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "7": {"class_type": "Wan22ImageToVideoLatent",
              "inputs": {"vae": ["3", 0], "width": width, "height": height, "length": frames, "batch_size": 1}},
        "12": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["5", 0]}},
        "13": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "lcm"}},
        "14": {"class_type": "ManualSigmas", "inputs": {"sigmas": "1.0, 0.757, 0.522, 0.0"}},
        "15": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "8": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["15", 0], "guider": ["12", 0], "sampler": ["13", 0],
                                                                "sigmas": ["14", 0], "latent_image": ["7", 0]}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefix}},
    }
    if image_name:
        wf["11"] = {"class_type": "LoadImage", "inputs": {"image": image_name}}
        wf["7"]["inputs"]["start_image"] = ["11", 0]
    return wf


def generate(prompt: str, out_dir: Path, *, width=832, height=480, frames=97, steps=20, cfg=5.0,
             seed: int | None = None, image: Path | None = None, log=print, keep_loaded=False, fast=False) -> tuple[list[Path], int]:
    job = queue(prompt, width=width, height=height, frames=frames, steps=steps, cfg=cfg, seed=seed, image=image, log=log, fast=fast)
    log(f"Wan 2.2 rendert {frames} Frames {width}x{height}, {steps} Schritte, seed {job['seed']} ...")
    while (entry := done(job)) is None:
        time.sleep(2)
        if time.time() - job["queued"] > 3 * 3600:
            raise TimeoutError("Wan generation exceeded 3 h")
    paths = collect(entry, out_dir)
    log(f"Wan fertig in {time.time() - job['queued']:.0f} s")
    if not keep_loaded:
        free()   # hand the VRAM back for the mocap step
    return paths, job["seed"]
