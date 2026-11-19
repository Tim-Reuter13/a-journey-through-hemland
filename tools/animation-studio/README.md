# Animation Studio

Text → Video → Motion Capture → game-ready animation, fully local on the RTX 5080.

```
"a man swings a sword overhead"
        │  Wan 2.2 TI2V 5B (ComfyUI, headless API, port 8189)
        ▼
   video.mp4  (1280x704, 24 fps, one person, full body, locked camera)
        │  RGB MoCap · GEM-X (toyxyz_RGBMocap worker, foot-contact correction)
        ▼
   SOMA Native77 skeleton  →  <name>_soma.fbx / .bvh
        │  Blender 4.5 (background): exact retarget, face -Y, in-place, loop
        ▼
   <name>.fbx  (Mixamo bone names: Unity Humanoid / Unreal / Godot / Blender)
   <name>.glb  (Three.js AnimationClip, e.g. Hemland)
   preview.mp4 (source video | solved skeleton) + contact.jpg for QC
```

## Use

```powershell
cd "C:\Users\timre\Music\.Animation Studio"
python studio\animate.py "swings a heavy longsword overhead and strikes down hard" --name sword_overhead
python studio\animate.py "walks forward at a calm pace" --name walk --in-place --loop
python studio\animate.py --video some_clip.mp4 --name dance          # mocap an existing video
python studio\animate.py --from-project <gemx result folder> --name walk --in-place --loop   # redo export only
```

Options: `--seconds` (default 5), `--seed`, `--steps` (30), `--cfg` (5), `--image start.png` (image-to-video),
`--raw-prompt` (no subject template), `--trim 0.5:3.2`, `--in-place`, `--loop`, `--no-correct`, `--no-preview`.

Results land in `library/<name>/`; `library/index.json` lists every clip.

## Layout

| Path | What |
| --- | --- |
| `ComfyUI/` | ComfyUI + venv (PyTorch cu128). Models in `ComfyUI/models/{diffusion_models,text_encoders,vae}` |
| `rgb/` | Junction to `C:/AS/rgb`: RGB MoCap (own pinned runtimes, Blender 4.5, FFmpeg, GEM-X runtime + models). It must live on a short path: its installer exceeds the Windows 260-char path limit under this folder. |
| `studio/animate.py` | Orchestrator (system Python, stdlib only) |
| `studio/comfy_client.py` | Starts ComfyUI on demand, queues the Wan 2.2 workflow, collects frames |
| `studio/rgb_bridge.py` | Runs inside RGB MoCap's runtime: GEM-X model download, reconstruct, native FBX/BVH export |
| `studio/blender_retarget.py` | SOMA → humanoid retarget, yaw/in-place/trim/loop, FBX + GLB export, skeleton preview |
| `library/` | Finished animations |
| `work/`, `logs/` | Intermediate frames, mocap projects, logs |

## Timings (RTX 5080)

Wan 2.2 5B, 121 frames 1280x704, 30 steps: ~6 min · GEM-X mocap 5 s clip: ~3 min · Blender: ~20 s.

## Tested (2026-11-19)

- `library/sword_overhead`: overhead strike → crouch → guard; skeleton matches the video frame by frame.
- `library/walk_relaxed`: side-view walk, `--in-place --loop` → 4.07 s seamless loop.
- FBX and GLB re-imported in Blender: 52 bones `mixamorig:*`, correct length, ~1.98 m tall, faces -Y.
- Not yet tested inside Unity/Unreal/Godot or Hemland.

## Prompting tips

- Describe only the action; the template adds "one man, full body, static camera, grey studio".
- Locomotion: ask for walking/running *in place* or *toward the camera*, then use `--in-place --loop`.
- Wan 5B sometimes produces unphysical motion — check `contact.jpg` / `preview.mp4`, rerun with another `--seed`.
- GEM-X needs the person fully visible; cropped feet or occlusion degrade the solve.

## Licences

GEM-X code Apache-2.0, GEM-X weights NVIDIA Open Model License, SOMA-X Apache-2.0, RTMPose/YOLOX (OpenMMLab),
Wan 2.2 Apache-2.0, RGB MoCap see `rgb/LICENSE`.
