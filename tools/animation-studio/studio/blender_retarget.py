"""Blender (background) step: SOMA Native77 FBX -> game humanoid (Mixamo bone names).

blender -b --factory-startup --python blender_retarget.py -- job.json

The humanoid copies the SOMA rest matrices of the bones it keeps, so the transfer
is exact (world-space rotation per bone, root location on Hips). Then optional
yaw normalisation (character faces Blender -Y = Mixamo/Unity forward), in-place,
trim and loop, export FBX + GLB and render a stick-figure preview.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

job_path = Path(sys.argv[sys.argv.index("--") + 1])
job = json.loads(job_path.read_text(encoding="utf-8"))
report = {}

PREFIX = "mixamorig:"
MAP = {  # SOMA Native77 -> Mixamo
    "Hips": "Hips", "Spine1": "Spine", "Spine2": "Spine1", "Chest": "Spine2", "Neck1": "Neck", "Head": "Head",
}
for s in ("Left", "Right"):
    MAP.update({f"{s}Shoulder": f"{s}Shoulder", f"{s}Arm": f"{s}Arm", f"{s}ForeArm": f"{s}ForeArm",
                f"{s}Hand": f"{s}Hand", f"{s}Leg": f"{s}UpLeg", f"{s}Shin": f"{s}Leg",
                f"{s}Foot": f"{s}Foot", f"{s}ToeBase": f"{s}ToeBase"})
    for i in (1, 2, 3):
        MAP[f"{s}HandThumb{i}"] = f"{s}HandThumb{i}"
    for finger in ("Index", "Middle", "Ring", "Pinky"):
        for i in (1, 2, 3):  # SOMA has a metacarpal at 1
            MAP[f"{s}Hand{finger}{i + 1}"] = f"{s}Hand{finger}{i}"


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


clean_scene()
scene = bpy.context.scene
bpy.ops.import_scene.fbx(filepath=job["soma_fbx"], automatic_bone_orientation=False, ignore_leaf_bones=False)
src = next(o for o in scene.objects if o.type == "ARMATURE")
act = src.animation_data.action
f0, f1 = (int(round(v)) for v in act.frame_range)
scene.render.fps = 30
report["soma_bones"] = len(src.data.bones)


def strip(name):
    return name.split(":")[-1].split("|")[-1]


present = {strip(b.name): b.name for b in src.data.bones}
missing = [k for k in MAP if k not in present]
report["unmapped_soma"] = missing
keep = [k for k in MAP if k in present]

# --- build target armature with identical rest matrices (world space, unit scale)
tgt_data = bpy.data.armatures.new("Humanoid")
tgt = bpy.data.objects.new(job["name"], tgt_data)
scene.collection.objects.link(tgt)
bpy.context.view_layer.objects.active = src
bpy.ops.object.mode_set(mode="EDIT")
rest = {}
for k in keep:
    eb = src.data.edit_bones[present[k]]
    m = src.matrix_world @ eb.matrix
    length = (src.matrix_world @ eb.tail - src.matrix_world @ eb.head).length
    loc, rot, _ = m.decompose()
    rest[k] = (loc, rot, max(length, 0.01))
parent_of = {}
for k in keep:
    b = src.data.bones[present[k]].parent
    while b is not None and strip(b.name) not in MAP:
        b = b.parent
    parent_of[k] = strip(b.name) if b is not None else None
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.objects.active = tgt
bpy.ops.object.mode_set(mode="EDIT")
for k in keep:
    eb = tgt_data.edit_bones.new(PREFIX + MAP[k])
    loc, rot, length = rest[k]
    eb.head = (0, 0, 0)
    eb.tail = (0, length, 0)
    eb.matrix = Matrix.Translation(loc) @ rot.to_matrix().to_4x4()
for k in keep:
    if parent_of[k]:
        tgt_data.edit_bones[PREFIX + MAP[k]].parent = tgt_data.edit_bones[PREFIX + MAP[parent_of[k]]]
bpy.ops.object.mode_set(mode="POSE")
for k in keep:
    pb = tgt.pose.bones[PREFIX + MAP[k]]
    pb.rotation_mode = "QUATERNION"
    if k == "Hips":
        c = pb.constraints.new("COPY_LOCATION")
        c.target, c.subtarget = src, present[k]
    c = pb.constraints.new("COPY_ROTATION")
    c.target, c.subtarget = src, present[k]
bpy.ops.object.mode_set(mode="OBJECT")

# --- sample world-exact motion into plain per-frame data (local pose values)
frames = list(range(f0, f1 + 1))
names = [PREFIX + MAP[k] for k in keep]
Q = {n: [] for n in names}
L = {n: [] for n in names}
for f in frames:
    scene.frame_set(f)
    for n in names:
        pb = tgt.pose.bones[n]
        # visual (constraint) result in armature space -> local basis
        world = pb.matrix.copy()
        parent = pb.parent
        restm = pb.bone.matrix_local
        if parent is None:
            basis = restm.inverted() @ world
        else:
            basis = (parent.bone.matrix_local.inverted() @ restm).inverted() @ parent.matrix.inverted() @ world
        loc, rot, _ = basis.decompose()
        Q[n].append(rot.normalized())
        L[n].append(loc.copy())
for pb in tgt.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
    pb.matrix_basis = Matrix.Identity(4)

hips = PREFIX + "Hips"
HR = tgt.data.bones[hips].matrix_local
N = len(frames)


def hips_world(i):
    return HR @ (Matrix.Translation(L[hips][i]) @ Q[hips][i].to_matrix().to_4x4())


def set_hips_world(i, m):
    b = HR.inverted() @ m
    loc, rot, _ = b.decompose()
    L[hips][i], Q[hips][i] = loc, rot.normalized()


# --- face Blender -Y (Mixamo / Unity forward) at frame 0, start at origin
def side_vec(i):
    # rough lateral axis from the hips rotation: take the bone-space vector that points to UpLeg R - L in rest
    lr = tgt.data.bones[PREFIX + "RightUpLeg"].head_local - tgt.data.bones[PREFIX + "LeftUpLeg"].head_local
    restrot = HR.to_3x3()
    local = restrot.inverted() @ lr
    return hips_world(i).to_3x3() @ local


lat = side_vec(0)
fwd = Vector((0, 0, 1)).cross(lat)
fwd.z = 0
yaw = math.atan2(fwd.x, -fwd.y)  # angle from -Y
R = Matrix.Rotation(-yaw, 4, "Z")
start = hips_world(0).to_translation()
T = Matrix.Translation((-start.x, -start.y, 0))
for i in range(N):
    set_hips_world(i, R @ T @ hips_world(i))
report["yaw_fix_deg"] = round(math.degrees(yaw), 1)

if job.get("in_place"):
    for i in range(N):
        m = hips_world(i)
        m.translation = Vector((0, 0, m.translation.z))
        set_hips_world(i, m)

# --- trim (seconds)
lo, hi = 0, N
if job.get("trim"):
    a, _, b = job["trim"].partition(":")
    lo = max(0, int(float(a or 0) * 30))
    hi = min(N, int(float(b) * 30) + 1) if b else N


def slice_all(a, b):
    for n in names:
        Q[n] = Q[n][a:b]
        L[n] = L[n][a:b]


slice_all(lo, hi)
N = len(Q[hips])

# --- loop: find the most similar pose pair (i, j), blend the seam, cut to i..j-1
if job.get("loop") and N > 40:
    def dist(i, j):
        d = 0.0
        for n in names:
            dot = abs(Q[n][i].dot(Q[n][j]))
            d += 1 - min(1.0, dot)
        vi = hips_world(min(i + 1, N - 1)).translation - hips_world(i).translation
        vj = hips_world(min(j + 1, N - 1)).translation - hips_world(j).translation
        return d + 20 * (vi - vj).length
    best = None
    min_len = 20
    for i in range(0, max(1, N // 2)):
        for j in range(i + min_len, N):
            d = dist(i, j) - 0.002 * (j - i)  # prefer longer cycles slightly
            if best is None or d < best[0]:
                best = (d, i, j)
    _, i, j = best
    k = min(10, (j - i) // 3)
    hip_i, hip_j = hips_world(i), hips_world(j)
    for f in range(j - k, j + 1):
        w = (f - (j - k)) / k
        w = w * w * (3 - 2 * w)
        for n in names:
            d = Q[n][j].inverted() @ Q[n][i]
            Q[n][f] = (Q[n][f] @ Quaternion().slerp(d, w)).normalized()
        m = hips_world(f)
        off = hip_i.translation - hip_j.translation
        if not job.get("in_place"):
            off.x = off.y = 0  # keep root travel; only fix the height seam
        m.translation = m.translation + off * w
        set_hips_world(f, m)
    slice_all(i, j)
    N = len(Q[hips])
    report["loop"] = {"from_frame": i + lo, "to_frame": j + lo, "blend_frames": k}

# --- write a clean action
action = bpy.data.actions.new(job["name"])
tgt.animation_data_create()
tgt.animation_data.action = action
for n in names:
    pb = tgt.pose.bones[n]
    prev = None
    for f in range(N):
        q = Q[n][f]
        if prev is not None and prev.dot(q) < 0:
            q = -q
        prev = q
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=f)
        if n == hips:
            pb.location = L[n][f]
            pb.keyframe_insert("location", frame=f)
scene.frame_start, scene.frame_end = 0, N - 1
report.update(frames=N, fps=30, seconds=round(N / 30, 2), bones=len(names))

# --- export
bpy.ops.object.select_all(action="DESELECT")
tgt.select_set(True)
bpy.context.view_layer.objects.active = tgt
bpy.data.objects.remove(src)
bpy.data.actions.remove(act)  # only the humanoid clip may be exported
bpy.ops.export_scene.fbx(filepath=job["fbx"], use_selection=True, object_types={"ARMATURE"},
                         add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=False,
                         bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True,
                         bake_anim_simplify_factor=0.0, armature_nodetype="NULL",
                         axis_forward="-Z", axis_up="Y", apply_unit_scale=True)
bpy.ops.export_scene.gltf(filepath=job["glb"], export_format="GLB", use_selection=True,
                          export_animations=True, export_force_sampling=True, export_frame_range=True,
                          export_animation_mode="ACTIONS")
report["fbx"], report["glb"] = job["fbx"], job["glb"]

# --- stick-figure preview
if job.get("preview"):
    tgt.data.pose_position = "REST"
    bpy.context.view_layer.update()
    for b in tgt.data.bones:
        r = 0.035 if not ("Hand" in b.name and len(b.name) > len(PREFIX) + 9) else 0.008
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=b.length, location=(0, b.length / 2, 0),
                                            rotation=(math.pi / 2, 0, 0))
        ob = bpy.context.object
        bpy.ops.object.transform_apply(location=True, rotation=True)
        ob.parent, ob.parent_type, ob.parent_bone = tgt, "BONE", b.name
        ob.matrix_world = tgt.matrix_world @ b.matrix_local
        side = b.name[len(PREFIX):]
        ob.color = (0.2, 0.45, 1, 1) if side.startswith("Left") else (1, 0.3, 0.2, 1) if side.startswith("Right") else (0.9, 0.9, 0.9, 1)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(0, 0, 0))
    head = bpy.context.object
    hb = tgt.data.bones[PREFIX + "Head"]
    head.parent, head.parent_type, head.parent_bone = tgt, "BONE", hb.name
    head.matrix_world = Matrix.Translation(hb.head_local + Vector((0, 0, 0.1)))
    head.color = (0.9, 0.9, 0.9, 1)
    tgt.data.pose_position = "POSE"
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=20, y_subdivisions=20, size=10)
    grid = bpy.context.object
    grid.color = (0.25, 0.25, 0.27, 1)
    grid.modifiers.new("w", "WIREFRAME").thickness = 0.01
    focus = bpy.data.objects.new("focus", None)
    scene.collection.objects.link(focus)
    c = focus.constraints.new("COPY_LOCATION")
    c.target, c.subtarget, c.use_z = tgt, PREFIX + "Hips", False
    focus.location.z = 0.9
    c.use_offset = True
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.parent = focus
    cam.location = (0.0, -4.6, 0.2)
    t = cam.constraints.new("TRACK_TO")
    t.target, t.track_axis, t.up_axis = focus, "TRACK_NEGATIVE_Z", "UP_Y"
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "OBJECT"
    scene.display.shading.light = "STUDIO"
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.color = (0.08, 0.08, 0.09)
    scene.render.resolution_x, scene.render.resolution_y = 640, 540
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    stem = Path(job["preview"]).with_suffix("")
    scene.render.filepath = str(stem) + "_"
    bpy.ops.render.render(animation=True)
    out = sorted(stem.parent.glob(stem.name + "_*.mp4"))
    if out:
        Path(job["preview"]).unlink(missing_ok=True)
        out[-1].rename(job["preview"])
    report["preview"] = job["preview"]

Path(str(job_path) + ".out").write_text(json.dumps(report, indent=2), encoding="utf-8")
print("RETARGET_OK", json.dumps(report))
