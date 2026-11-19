"""Hemland assets + mocap retarget for Blender (used by build.py).

Hemland characters are rigid Blockbench hierarchies (root > hips > torso > chest > neck > head, arm/leg chains).
Mocap clips are the studio's humanoid FBX (mixamorig:*, facing -Y, 30 fps, start at origin).

Retarget: each pivot gets   R_pivot(t) = R_bone(t) @ O,   O = (S @ R_bone_rest)^-1 @ R_pivot_rest,
where S swings the humanoid's T-pose bone onto the Hemland rest direction (arms/legs hanging), so the
reference poses match. The hips position is scaled by hip-height ratio.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

HEMLAND = Path(r"C:\Users\timre\Documents\Codex\2026-10-09\ich-will-ein-skyrim-like-rpg-2")
MODELS = HEMLAND / "public" / "models"
TEXTURES = HEMLAND / "public" / "textures"
LIBRARY = Path(r"C:\Users\timre\Music\.Animation Studio\library")
CACHE = Path(__file__).resolve().parent / "cache"
FPS_CLIP = 30
P = "mixamorig:"

# Hemland pivot -> (humanoid bone, pivot whose position gives the rest direction | special)
MAP = {
    "hips": ("Hips", "up"), "torso": ("Spine1", "up"), "chest": ("Spine2", "up"),
    "neck": ("Neck", "up"), "head": ("Head", "up"),
}
for side, S in (("right", "Right"), ("left", "Left")):
    MAP.update({
        f"arm_upper_{side}": (f"{S}Arm", f"arm_lower_{side}"),
        f"arm_lower_{side}": (f"{S}ForeArm", f"hand_{side}"),
        f"hand_{side}": (f"{S}Hand", "down"),
        f"leg_upper_{side}": (f"{S}UpLeg", f"leg_lower_{side}"),
        f"leg_lower_{side}": (f"{S}Leg", f"foot_{side}"),
        f"foot_{side}": (f"{S}Foot", "forward"),
    })
ORDER = ["hips", "torso", "chest", "neck", "head",
         "arm_upper_right", "arm_lower_right", "hand_right", "arm_upper_left", "arm_lower_left", "hand_left",
         "leg_upper_right", "leg_lower_right", "foot_right", "leg_upper_left", "leg_lower_left", "foot_left"]


# ----------------------------------------------------------------------------- import helpers
def import_gltf(path, collection_name, prefix=""):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_shading="NORMALS")
    new = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.get(collection_name) or bpy.data.collections.new(collection_name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
        if prefix:
            o.name = prefix + o.name
    pixelate_materials(new)
    return new, col


def pixelate_materials(objs):
    for o in objs:
        for slot in getattr(o, "material_slots", []):
            m = slot.material
            if m and m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type == "TEX_IMAGE":
                        n.interpolation = "Closest"
                    if n.type == "BSDF_PRINCIPLED":
                        n.inputs["Roughness"].default_value = 0.85
                        if "Specular IOR Level" in n.inputs:
                            n.inputs["Specular IOR Level"].default_value = 0.25


def descendants(o):
    out = [o]
    for c in o.children:
        out += descendants(c)
    return out


def template_collection(root, name):
    """Collection holding root + descendants, offset so instances sit at the root's origin."""
    col = bpy.data.collections.new(name)
    for o in descendants(root):
        col.objects.link(o)
    col.instance_offset = root.matrix_world.translation.copy()
    return col


def instance(col, loc, rot_z=0.0, scale=1.0, parent_col=None, name=None):
    e = bpy.data.objects.new(name or ("inst_" + col.name), None)
    e.instance_type = "COLLECTION"
    e.instance_collection = col
    e.location = loc
    e.rotation_euler = (0, 0, rot_z)
    e.scale = (scale, scale, scale)
    (parent_col or bpy.context.scene.collection).objects.link(e)
    return e


# ----------------------------------------------------------------------------- character
class Actor:
    def __init__(self, model, prefix, weapon=None):
        objs, self.col = import_gltf(MODELS / f"{model}.gltf", "ACT_" + prefix, prefix)
        self.prefix = prefix
        names = {}
        for o in objs:
            base = o.name[len(prefix):].split(".")[0]
            names.setdefault(base, []).append(o)

        def pivot(base):
            # the pivot is the node that holds the others (a group, not the mesh of the same name)
            cands = names.get(base, [])
            groups = [o for o in cands if o.children]
            return groups[0] if groups else (cands[0] if cands else None)
        self.root = pivot("root")
        self.piv = {k: pivot(k) for k in ORDER}
        self.piv.update({k: pivot(k) for k in ("grip_right", "grip_left", "cape_1", "cape_2", "cape_3")})
        missing = [k for k in ORDER if self.piv[k] is None]
        if missing:
            raise RuntimeError(f"{model}: missing pivots {missing}")
        for o in objs:
            o.rotation_mode = "QUATERNION"
            o.matrix_parent_inverse = Matrix.Identity(4) if o.parent else o.matrix_parent_inverse
        # face -Y like the mocap humanoid
        self.root.rotation_quaternion = Quaternion((0, 0, 1), math.pi)
        bpy.context.view_layer.update()
        self.rest_local = {k: o.matrix_basis.copy() for k, o in self.piv.items() if o}
        self.rest_world = {k: o.matrix_world.copy() for k, o in self.piv.items() if o}
        self.hip_height = self.rest_world["hips"].translation.z
        self.weapon = None
        if weapon:
            self.equip(weapon)

    def equip(self, item):
        lib = bpy.data.collections.get("LIB_weapons")
        src = bpy.data.objects.get("W_" + item)
        if lib is None or src is None:
            raise RuntimeError("weapons not loaded")
        copies = {}
        for o in descendants(src):
            c = o.copy()
            self.col.objects.link(c)
            copies[o] = c
        for o, c in copies.items():
            if o.parent in copies:
                c.parent = copies[o.parent]
        w = copies[src]
        w.parent = self.piv["grip_right"]
        w.matrix_parent_inverse = Matrix.Identity(4)
        w.location = (0, 0, 0)
        w.rotation_mode = "XYZ"
        w.rotation_euler = (-2.0, 0, 0)  # WEAPON_POSE in src/characters/models.js
        w.scale = (0.9, 0.9, 0.9)
        self.weapon = w
        return w

    def rest_dir(self, key, spec):
        p = self.rest_world[key].translation
        if spec == "up":
            return Vector((0, 0, 1))
        if spec == "down":
            return Vector((0, 0, -1))
        if spec == "forward":
            return Vector((0, -1, 0))
        return (self.rest_world[spec].translation - p).normalized()


# ----------------------------------------------------------------------------- clips
def load_clip(name):
    """Sample a studio clip into world rotations per bone + hips position (cached as JSON)."""
    CACHE.mkdir(exist_ok=True)
    cache = CACHE / f"{name}.json"
    fbx = LIBRARY / name / f"{name}.fbx"
    if cache.exists() and cache.stat().st_mtime > fbx.stat().st_mtime:
        d = json.loads(cache.read_text())
    else:
        scene = bpy.context.scene
        fps = scene.render.fps
        scene.render.fps = FPS_CLIP
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=str(fbx), automatic_bone_orientation=False)
        new = [o for o in bpy.data.objects if o not in before]
        arm = next(o for o in new if o.type == "ARMATURE")
        act = arm.animation_data.action
        f0, f1 = (int(round(v)) for v in act.frame_range)
        bones = sorted({b for b, _ in MAP.values()})
        rest = {}
        for b in bones:
            bone = arm.data.bones[P + b]
            m = arm.matrix_world @ bone.matrix_local
            tail = arm.matrix_world @ bone.tail_local
            head = arm.matrix_world @ bone.head_local
            rest[b] = {"q": list(m.to_quaternion()), "dir": list((tail - head).normalized()), "head": list(head)}
        rot = {b: [] for b in bones}
        hips = []
        hands = {"RightHand": [], "LeftHand": []}
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            for b in bones:
                m = arm.matrix_world @ arm.pose.bones[P + b].matrix
                rot[b].append(list(m.to_quaternion()))
                if b == "Hips":
                    hips.append(list(m.translation))
                if b in hands:
                    hands[b].append(list(m.translation))
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.actions.remove(act)
        scene.render.fps = fps
        d = {"name": name, "frames": f1 - f0 + 1, "rest": rest, "rot": rot, "hips": hips, "hands": hands}
        cache.write_text(json.dumps(d))
    d["rot"] = {b: [Quaternion(q) for q in v] for b, v in d["rot"].items()}
    d["hips"] = [Vector(v) for v in d["hips"]]
    d["hands"] = {k: [Vector(v) for v in vs] for k, vs in d.get("hands", {}).items()}
    d["seconds"] = (d["frames"] - 1) / FPS_CLIP
    return d


def clip_offsets(actor, clip):
    """Constant per-pivot offsets O for this actor/clip pair."""
    out = {}
    for key, (bone, spec) in MAP.items():
        r = clip["rest"][bone]
        rb0 = Quaternion(r["q"])
        db = Vector(r["dir"])
        dp = actor.rest_dir(key, spec)
        swing = db.rotation_difference(dp)
        rbref = swing @ rb0
        rp0 = actor.rest_world[key].to_quaternion()
        out[key] = rbref.inverted() @ rp0
    # scale by leg length (hip joint to ankle): independent of where the rest pose sits in the file
    # bone lengths, not the hip-ankle distance: the rest pose in the files has bent knees
    r = clip["rest"]
    leg_h = ((Vector(r["RightUpLeg"]["head"]) - Vector(r["RightLeg"]["head"])).length
             + (Vector(r["RightLeg"]["head"]) - Vector(r["RightFoot"]["head"])).length)
    leg_a = ((actor.rest_world["leg_upper_right"].translation - actor.rest_world["leg_lower_right"].translation).length
             + (actor.rest_world["leg_lower_right"].translation - actor.rest_world["foot_right"].translation).length)
    out["_scale"] = leg_a / leg_h
    out["_hips_rest_q"] = Quaternion(clip["rest"]["Hips"]["q"])
    return out


def sample(clip, t):
    """Pose at clip time t (seconds, clamped): {bone: quat}, hips Vector."""
    x = max(0.0, min(t * FPS_CLIP, clip["frames"] - 1))
    i = int(math.floor(x))
    j = min(i + 1, clip["frames"] - 1)
    a = x - i
    rot = {b: v[i].slerp(v[j], a) for b, v in clip["rot"].items()}
    hips = clip["hips"][i].lerp(clip["hips"][j], a)
    return rot, hips


def yaw_of(clip, q_hips):
    fwd = q_hips @ (Quaternion(clip["rest"]["Hips"]["q"]).inverted() @ Vector((0, -1, 0)))
    return math.atan2(fwd.x, -fwd.y)


# ----------------------------------------------------------------------------- timeline + bake
FPS_FILM = 24


def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


class Timeline:
    """segments: dicts with clip, start, end (film frames, end exclusive), in (s), speed, place, blend."""

    def __init__(self, actor, segments, clips):
        self.actor, self.clips = actor, clips
        self.segs = sorted(segments, key=lambda s: s["start"])
        self.off = {}
        for s in self.segs:
            s.setdefault("in", 0.0)
            s.setdefault("speed", 1.0)
            s.setdefault("blend", 8)
            s.setdefault("place", "chain")
            if s["clip"] not in self.off:
                self.off[s["clip"]] = clip_offsets(actor, clips[s["clip"]])
        prev = None
        for s in self.segs:
            clip = self.clips[s["clip"]]
            O = self.off[s["clip"]]
            rot0, h0 = sample(clip, s["in"])
            y0 = yaw_of(clip, rot0["Hips"])
            if s["place"] == "chain" and prev is not None:
                _, hw, yaw_end = self.raw(prev, s["start"])
                yaw = yaw_end - y0
                px, py = hw.x, hw.y
            else:
                x, y, deg = s["place"] if s["place"] != "chain" else (0, 0, 0)
                yaw, px, py = math.radians(deg) - y0, x, y
            R = Matrix.Rotation(yaw, 4, "Z")
            start = R @ (h0 * O["_scale"])
            s["T"] = Matrix.Translation((px - start.x, py - start.y, 0)) @ R
            prev = s

    def raw(self, s, f):
        clip = self.clips[s["clip"]]
        O = self.off[s["clip"]]
        t = s["in"] + (f - s["start"]) / FPS_FILM * s["speed"]
        rot, hips = sample(clip, t)
        qT = s["T"].to_quaternion()
        hw = s["T"] @ (hips * O["_scale"])
        qh = qT @ rot["Hips"]
        return {k: (qT @ rot[b]) @ O[k] for k, (b, _) in MAP.items()}, hw, yaw_of(clip, qh)

    def pose(self, f):
        cur = None
        for i, s in enumerate(self.segs):
            if s["start"] <= f:
                cur = i
        cur = 0 if cur is None else cur
        s = self.segs[cur]
        q, h, _ = self.raw(s, f)
        if cur > 0 and f < s["start"] + s["blend"]:
            w = smoothstep((f - s["start"] + 1) / (s["blend"] + 1))
            qp, hp, _ = self.raw(self.segs[cur - 1], f)
            q = {k: qp[k].slerp(q[k], w) if qp[k].dot(q[k]) >= 0 else (-qp[k]).slerp(q[k], w) for k in q}
            h = hp.lerp(h, w)
        return q, h


def bake(actor, timeline, f_start, f_end, extra=None):
    """Key every pivot's local transform for frames f_start..f_end (inclusive). Returns world data per frame."""
    objs = {k: actor.piv[k] for k in ORDER}
    mapped = set(ORDER)
    keys = {k: {"loc": [], "rot": []} for k in ORDER}
    worlds = []
    for f in range(f_start, f_end + 1):
        q, hips_w = timeline.pose(f)
        world = {}

        def wof(o):
            if o is None:
                return Matrix.Identity(4)
            k = o.name[len(actor.prefix):].split(".")[0]
            if k in world and objs.get(k) is o:
                return world[k]
            if o.parent is None:
                return o.matrix_basis.copy()  # root (static)
            return wof(o.parent) @ o.matrix_parent_inverse @ o.matrix_basis
        for k in ORDER:
            o = objs[k]
            pw = wof(o.parent)
            if k == "hips":
                pos = hips_w
            else:
                pos = (pw @ actor.rest_local[k]).translation
            W = Matrix.Translation(pos) @ q[k].to_matrix().to_4x4()
            world[k] = W
            L = pw.inverted() @ W
            loc, rot, _ = L.decompose()
            keys[k]["loc"].append(loc)
            keys[k]["rot"].append(rot)
        if extra:
            extra(f, world)
        worlds.append(world)
    for k in ORDER:
        write_fcurves(objs[k], f_start, keys[k]["loc"], keys[k]["rot"])
    return worlds


def write_fcurves(obj, f_start, locs, rots):
    obj.rotation_mode = "QUATERNION"
    ad = obj.animation_data_create()
    act = bpy.data.actions.new(obj.name + "_film")
    ad.action = act
    prev = None
    fixed = []
    for r in rots:
        if prev is not None and prev.dot(r) < 0:
            r = -r
        fixed.append(r)
        prev = r
    n = len(locs)
    try:  # Blender 4.4+: layered actions need a slot
        slot = act.slots.new(id_type="OBJECT", name=obj.name)
        ad.action_slot = slot
    except AttributeError:
        pass
    for path, comps, data in (("location", 3, locs), ("rotation_quaternion", 4, fixed)):
        for i in range(comps):
            fc = act.fcurves.new(path, index=i) if hasattr(act, "fcurves") else None
            if fc is None:
                fc = act.fcurve_ensure_for_datablock(obj, path, index=i)
            fc.keyframe_points.add(n)
            co = []
            for j in range(n):
                co += [f_start + j, data[j][i]]
            fc.keyframe_points.foreach_set("co", co)
            fc.keyframe_points.foreach_set("interpolation", [1] * n)  # LINEAR
            fc.update()
