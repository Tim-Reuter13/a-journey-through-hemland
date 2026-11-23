"""Blender side of the keyframe mode: rebuild a clean animation from single poses.

Input is the retargeted GLB of a "hold video" (every keyframe picture shown for a while, run through GEM-X).
From the middle of every hold we take the pose, put it at the time the job asks for, place the hips on the
ground (or in the air) and let Blender's Bezier curves do the in-betweens.

  blender -b --factory-startup --python blender_keyframes.py -- job.json
job: {"raw_glb", "glb", "fbx", "name", "hold_s": [centre of each hold in the raw clip, s],
      "times": [s], "move": [[forward, side], ...] metres, "air": [height or 0, ...], "fps": 30,
      "preview": "x.png" or null}
"""
import json
import math
import sys

import bpy
from mathutils import Matrix, Vector

job = json.loads(open(sys.argv[sys.argv.index("--") + 1], encoding="utf-8").read())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=job["raw_glb"])
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
sc = bpy.context.scene
src_fps = sc.render.fps / sc.render.fps_base
raw_action = arm.animation_data.action
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
pb = arm.pose.bones
P = "mixamorig:"
hips = pb[P + "Hips"]
feet = [pb[P + n] for n in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase") if P + n in pb]
hands = [pb[P + n] for n in ("LeftHand", "RightHand") if P + n in pb]


def world(b, tail=False):
    return arm.matrix_world @ (b.tail if tail else b.head)


def lowest(include_hands):
    pts = [world(b) for b in feet] + [world(b, True) for b in feet]
    if include_hands:
        pts += [world(b, True) for b in hands]
    return min(p.z for p in pts)


# 1) sample the poses at the hold centres
keys = []
for t in job["hold_s"]:
    sc.frame_set(round(t * src_fps))
    bpy.context.view_layer.update()
    pose = {b.name: b.matrix_basis.copy() for b in pb}
    hw = arm.matrix_world @ hips.matrix
    rel = {sd: (world(pb[P + fn]) - hw.translation) for sd, fn in (("L", "LeftFoot"), ("R", "RightFoot"))}
    for v in rel.values():
        v.z = 0
    keys.append({"pose": pose, "hips_world": hw.copy(), "ground": lowest(True), "rel": rel})

# facing of the first key = "forward" for the authored travel
fw = keys[0]["hips_world"].to_3x3() @ Vector((0, 0, 1))      # glTF-imported Mixamo hips: local +Z points forward
fw.z = 0
fw = fw.normalized() if fw.length > 1e-4 else Vector((0, -1, 0))
side = Vector((fw.y, -fw.x, 0))
origin = keys[0]["hips_world"].translation.copy()

# 2) new action: poses at the asked times, hips placed by the authored travel and the ground
arm.animation_data.action = None
act = bpy.data.actions.new(job["name"])
arm.animation_data.action = act
fps = job.get("fps", 30)
sc.render.fps, sc.render.fps_base = fps, 1
prev_q = {}
# hips travel: between two keys on the ground the planted foot stays where it is (footprints decide the
# step length); a jump uses the authored distance
air_list = job.get("air", [])
travel = [Vector((0, 0, 0))]
for i in range(1, len(keys)):
    on_ground = not (air_list[i] if i < len(air_list) else 0) and not (air_list[i - 1] if i - 1 < len(air_list) else 0)
    m0, m1 = job["move"][i - 1], job["move"][i]
    if on_ground and job.get("steps", "footprints") == "footprints":
        d = {sd: (keys[i]["rel"][sd] - keys[i - 1]["rel"][sd]).dot(fw) for sd in ("L", "R")}
        st = min(d, key=d.get)                          # the foot that slides back under the body is planted
        travel.append(travel[-1] + keys[i - 1]["rel"][st] - keys[i]["rel"][st])
    else:
        travel.append(travel[-1] + fw * (m1[0] - m0[0]) + side * (m1[1] - m0[1]))
print("TRAVEL", [round(t.dot(fw), 2) for t in travel])
for i, k in enumerate(keys):
    f = round(job["times"][i] * fps) + 1
    for name, mb in k["pose"].items():
        pb[name].matrix_basis = mb
    bpy.context.view_layer.update()
    mv = job["move"][i] if i < len(job["move"]) else (0, 0)
    air = job["air"][i] if i < len(job.get("air", [])) else 0.0
    hw = arm.matrix_world @ hips.matrix
    want = Vector((origin.x, origin.y, 0)) + travel[i]
    want.z = hw.translation.z - k["ground"] + air        # lowest foot/hand on the floor (z = 0), or lifted in the air
    m = hw.copy()
    m.translation = want
    hips.matrix = arm.matrix_world.inverted() @ m
    bpy.context.view_layer.update()
    for b in pb:
        if b.rotation_mode != "QUATERNION":
            b.rotation_mode = "QUATERNION"
        q = b.rotation_quaternion.copy()
        if b.name in prev_q and prev_q[b.name].dot(q) < 0:        # shortest way between keys
            q.negate()
            b.rotation_quaternion = q
        prev_q[b.name] = q.copy()
        b.keyframe_insert("rotation_quaternion", frame=f)
        if b == hips:
            b.keyframe_insert("location", frame=f)
for fc in act.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = "BEZIER"
        kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    fc.update()
sc.frame_start, sc.frame_end = 1, round(job["times"][-1] * fps) + 1

# ground lock: between the keys the curves swing the legs through the floor (or lift both feet);
# outside the jumps the lowest foot is held on the floor every frame
air = job.get("air", [])
windows = [(round(job["times"][i - 1] * fps) + 1, round(job["times"][i + 1] * fps) + 1)
           for i in range(1, len(keys) - 1) if i < len(air) and air[i] > 0]
SIDES = {"L": ("LeftFoot", "LeftToeBase", "LeftLeg"), "R": ("RightFoot", "RightToeBase", "RightLeg")}


def foot(side):
    fo, toe, _ = SIDES[side]
    pts = [world(pb[P + fo]), world(pb[P + fo], True), world(pb[P + toe], True)]
    return world(pb[P + fo]), min(p.z for p in pts)


frames = list(range(sc.frame_start, sc.frame_end + 1))
key_f = [round(t * fps) + 1 for t in job["times"]]
# ankle positions at the keys (the hips are already placed, the key poses stand on the floor)
at_key, rot_key = [], []
for f in key_f:
    sc.frame_set(f)
    bpy.context.view_layer.update()
    ki = key_f.index(f)
    planted = {}
    for sd in SIDES:
        ankle, low = foot(sd)
        ankle = ankle.copy()
        if not (ki < len(air) and air[ki] > 0) and low < .25:   # a single picture misjudges depth: feet near
            ankle.z -= low                                         # the floor in a ground pose stand on it
        planted[sd] = ankle
    at_key.append(planted)
    rot_key.append({s: (arm.matrix_world @ pb[P + SIDES[s][0]].matrix).to_quaternion() for s in SIDES})
fk = {}                                   # the plain curve pose, for the jumps
for f in frames:
    sc.frame_set(f)
    bpy.context.view_layer.update()
    fk[f] = {s: (foot(s)[0].copy(), foot(s)[1]) for s in SIDES}
targets = {}
for s, (fo, toe, leg) in SIDES.items():
    e = bpy.data.objects.new("ik_" + s, None)
    r = bpy.data.objects.new("rot_" + s, None)
    sc.collection.objects.link(e)
    sc.collection.objects.link(r)
    r.rotation_mode = "QUATERNION"
    c = pb[P + leg].constraints.new("IK")
    c.target, c.chain_count, c.use_tail = e, 2, True
    cr = pb[P + fo].constraints.new("COPY_ROTATION")
    cr.target = r
    targets[s] = (e, c, r, cr)
steps = 0
for f in frames:
    i = max(j for j in range(len(key_f)) if key_f[j] <= f)
    j = min(i + 1, len(key_f) - 1)
    in_air = any(a < f < b for a, b in windows)
    u = 0.0 if j == i else (f - key_f[i]) / (key_f[j] - key_f[i])
    k = u * u * (3 - 2 * u)
    for s, (e, c, r, cr) in targets.items():
        if in_air:                          # jump: free curve pose, only kept out of the floor
            ankle, low = fk[f][s]
            pos, ik, flat = ankle + Vector((0, 0, max(0.0, -low))), (1.0 if low < 0 else 0.0), 0.0
        else:
            p0, p1 = at_key[i][s], at_key[j][s]
            moved = (p1 - p0).xy.length
            pos = p0.lerp(p1, k)
            if moved < .12:                 # stance: the foot stays where it is, flat as in the key
                flat = 1.0
            else:                           # swing: from footprint to footprint on a low arc
                pos.z += min(.18, .25 * moved) * math.sin(math.pi * u)
                flat = 1.0 - math.sin(math.pi * u)
                steps += f == key_f[i]
            ik = 1.0
        e.location = pos
        e.keyframe_insert("location", frame=f)
        c.influence = ik
        c.keyframe_insert("influence", frame=f)
        r.rotation_quaternion = rot_key[i][s].slerp(rot_key[j][s], k)
        r.keyframe_insert("rotation_quaternion", frame=f)
        cr.influence = flat
        cr.keyframe_insert("influence", frame=f)
bpy.ops.pose.select_all(action="SELECT")
bpy.ops.nla.bake(frame_start=frames[0], frame_end=frames[-1], only_selected=False, visual_keying=True,
                 clear_constraints=True, use_current_action=True, bake_types={"POSE"})
for e, _, r, _ in targets.values():
    bpy.data.objects.remove(e)
    bpy.data.objects.remove(r)
shift = [0]
lifted = steps
print("FOOT_IK swing segments", lifted)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.data.actions.remove(raw_action)

# 3) export
for o in bpy.context.scene.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=job["glb"], export_format="GLB", export_animations=True, export_frame_range=True)
bpy.ops.export_scene.fbx(filepath=job["fbx"], use_selection=False, add_leaf_bones=False, bake_anim=True,
                         bake_anim_use_all_actions=False, bake_anim_simplify_factor=0.0)
print("KEYFRAMES_OK", len(keys), "keys", sc.frame_end, "frames")
