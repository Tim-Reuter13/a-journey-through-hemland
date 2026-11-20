"""Choreography solver and Retarget 2.0 for the Hemland cutscene bake (Blender axes: x east, y north, z up).

- fk():            world matrices of every pivot (+ grip and blade) for one pose
- capsules():      a simple body of capsules per actor (torso, head, limbs)
- set boxes:       the stone circle, altar, fire and props from public/cutscenes/letzte_wacht_set.json
- face():          turn a segment so the chest faces its target at the beat (or on average)
- hit():           move an attacker so his blade passes through the target at the beat
- clear_set():     push a segment out of stones, altar, fire and props
- arms_clear():    keep the arms outside the (wide) Blockbench torso, plus a style abduction
- ground():        no sinking into the ground, no hovering just above it
- report():        every remaining error with its time, for the validator and the review
"""
import json
import math
from pathlib import Path

from mathutils import Matrix, Quaternion, Vector

import hemrig as H

SET_FILE = Path(r"C:\Users\timre\Documents\Codex\2026-10-09\ich-will-ein-skyrim-like-rpg-2\public\cutscenes\letzte_wacht_set.json")
BLADE = {"captain": 1.6 * 0.9, "bandit": 1.4 * 0.9}       # weapons.gltf blade length × the game's 0.9 scale
BLADE_DIR = Vector((0.0, math.sin(2.0), math.cos(2.0)))    # grip-local: Rx(-2.0) applied to +z (= glTF +y)
LIMB_R = {"torso": 0.30, "head": 0.27, "uarm": 0.13, "farm": 0.12, "thigh": 0.15, "shin": 0.13}


# ----------------------------------------------------------------------------- geometry helpers
def seg_closest(p1, q1, p2, q2):
    """Closest points between segments p1q1 and p2q2."""
    d1, d2, r = q1 - p1, q2 - p2, p1 - p2
    a, e, f = d1.dot(d1), d2.dot(d2), d2.dot(r)
    if a < 1e-9 and e < 1e-9:
        return p1, p2
    if a < 1e-9:
        s, t = 0.0, max(0.0, min(1.0, f / e))
    else:
        c = d1.dot(r)
        if e < 1e-9:
            t, s = 0.0, max(0.0, min(1.0, -c / a))
        else:
            b = d1.dot(d2)
            den = a * e - b * b
            s = max(0.0, min(1.0, (b * f - c * e) / den)) if den > 1e-9 else 0.0
            t = (b * s + f) / e
            if t < 0:
                t, s = 0.0, max(0.0, min(1.0, -c / a))
            elif t > 1:
                t, s = 1.0, max(0.0, min(1.0, (b - c) / a))
    return p1 + d1 * s, p2 + d2 * t


def point_seg(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-9)))
    return a + ab * t


class Box:
    """Oriented box from the set file (three.js axes) in Blender axes."""

    def __init__(self, b):
        cx, cy, cz = b["c"]
        hx, hy, hz = b["h"]
        self.name = b["name"]
        self.c = Vector((cx, -cz, cy))
        self.h = Vector((hx, hz, hy))
        self.R = Matrix.Rotation(b["yaw"], 3, "Z")
        self.Ri = self.R.transposed()

    def closest(self, p):
        q = self.Ri @ (p - self.c)
        q = Vector((max(-self.h.x, min(self.h.x, q.x)), max(-self.h.y, min(self.h.y, q.y)), max(-self.h.z, min(self.h.z, q.z))))
        return self.c + self.R @ q

    def inside(self, p):
        q = self.Ri @ (p - self.c)
        return abs(q.x) < self.h.x and abs(q.y) < self.h.y and abs(q.z) < self.h.z


def load_set():
    d = json.loads(SET_FILE.read_text(encoding="utf-8"))
    return [Box(b) for b in d["colliders"]]


# ----------------------------------------------------------------------------- kinematics
def fk(actor, q, hips_w):
    root_w = actor.root.matrix_basis.copy()
    world = {}
    for k in H.ORDER:
        o = actor.piv[k]
        pk = o.parent.name[len(actor.prefix):].split(".")[0] if o.parent else None
        pw = world.get(pk, root_w) if pk != "root" else root_w
        pos = hips_w if k == "hips" else (pw @ actor.rest_local[k]).translation
        world[k] = Matrix.Translation(pos) @ q[k].to_matrix().to_4x4()
    grip = world["hand_right"] @ actor.rest_local["grip_right"]
    if "grip_right" in q:   # the blade is aimed (see aim_blades): keep the grip's position, take the aimed rotation
        grip = Matrix.Translation(grip.translation) @ q["grip_right"].to_matrix().to_4x4()
    world["grip_right"] = grip
    return world


def blade(actor, key, world):
    g = world["grip_right"]
    p = g.translation.copy()
    d = (g.to_3x3() @ BLADE_DIR).normalized()
    return p, p + d * BLADE[key]


def head_top(world):
    h = world["head"]
    return h.translation + h.to_3x3() @ Vector((0, 0, 0.45))


def capsules(world):
    out = [("torso", world["hips"].translation, world["neck"].translation, LIMB_R["torso"]),
           ("head", world["head"].translation, head_top(world), LIMB_R["head"])]
    for s in ("left", "right"):
        out += [(f"uarm_{s}", world[f"arm_upper_{s}"].translation, world[f"arm_lower_{s}"].translation, LIMB_R["uarm"]),
                (f"farm_{s}", world[f"arm_lower_{s}"].translation, world[f"hand_{s}"].translation, LIMB_R["farm"]),
                (f"thigh_{s}", world[f"leg_upper_{s}"].translation, world[f"leg_lower_{s}"].translation, LIMB_R["thigh"]),
                (f"shin_{s}", world[f"leg_lower_{s}"].translation, world[f"foot_{s}"].translation, LIMB_R["shin"])]
    return out


def set_penetration(world, boxes, samples=5):
    """Deepest body/set overlap: (depth, push vector (horizontal), part, box)."""
    worst = (0.0, Vector((0, 0, 0)), None, None)
    hp = world["hips"].translation
    boxes = [bx for bx in boxes if (bx.c.xy - hp.xy).length < 3.2 + max(bx.h.x, bx.h.y)]
    if not boxes:
        return worst
    for name, a, b, r in capsules(world):
        for i in range(samples):
            p = a.lerp(b, i / (samples - 1))
            for bx in boxes:
                c = bx.closest(p)
                d = (p - c).length
                if bx.inside(p):
                    # push out horizontally away from the box centre
                    v = p - bx.c
                    v.z = 0
                    depth = r + min(bx.h.x, bx.h.y) * 0.5
                    if depth > worst[0]:
                        worst = (depth, v.normalized() if v.length > 1e-6 else Vector((1, 0, 0)), name, bx.name)
                elif d < r:
                    v = p - c
                    v.z = 0
                    if v.length < 1e-6:
                        continue
                    depth = r - d
                    if depth > worst[0]:
                        worst = (depth, v.normalized(), name, bx.name)
    return worst


def body_overlap(wa, wb):
    worst = (0.0, None, None)
    for na, a1, a2, ra in capsules(wa):
        for nb, b1, b2, rb in capsules(wb):
            pa, pb = seg_closest(a1, a2, b1, b2)
            depth = ra + rb - (pa - pb).length
            if depth > worst[0]:
                worst = (depth, na, nb)
    return worst


# ----------------------------------------------------------------------------- segment transforms
def rotate_segment(s, centre, angle):
    s["T"] = Matrix.Translation((centre.x, centre.y, 0)) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Translation((-centre.x, -centre.y, 0)) @ s["T"]


def move_segment(s, v):
    s["T"] = Matrix.Translation((v.x, v.y, 0)) @ s["T"]


def chest_forward(actor, world):
    fwd_local = actor.rest_world["chest"].to_quaternion().inverted() @ Vector((0, -1, 0))
    f = world["chest"].to_quaternion() @ fwd_local
    f.z = 0
    return f.normalized() if f.length > 1e-6 else Vector((0, -1, 0))


def yaw_delta(a, b):
    return math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)


# ----------------------------------------------------------------------------- Retarget 2.0
class Body:
    """Torso box of a Blockbench actor in chest space (for keeping the arms out of it)."""

    def __init__(self, actor):
        import bpy
        chest = actor.piv["chest"]
        skip = {actor.piv[k] for k in ("arm_upper_left", "arm_upper_right", "neck") if actor.piv.get(k)}
        skip |= {actor.piv[k] for k in ("cape_1",) if actor.piv.get(k)}
        inv = actor.rest_world["chest"].inverted()
        lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))

        def walk(o):
            if o in skip:
                return
            if o.type == "MESH":
                for c in o.bound_box:
                    p = inv @ (o.matrix_world @ Vector(c))
                    for i in range(3):
                        lo[i], hi[i] = min(lo[i], p[i]), max(hi[i], p[i])
            for ch in o.children:
                walk(ch)
        bpy.context.view_layer.update()
        walk(actor.piv["torso"])
        self.lo, self.hi = lo, hi


def arms_clear(actor, body, q, hips_w, extra_abduct=0.0):
    """Rotate each upper arm outward (about the chest's forward axis) until the arm clears the torso."""
    world = fk(actor, q, hips_w)
    chest = world["chest"]
    inv = chest.inverted()
    fwd = chest.to_3x3() @ (actor.rest_world["chest"].to_3x3().inverted() @ Vector((0, -1, 0)))
    for side, sign in (("left", 1), ("right", -1)):
        sh = world[f"arm_upper_{side}"].translation
        pts = [world[f"arm_lower_{side}"].translation, world[f"hand_{side}"].translation,
               sh.lerp(world[f"arm_lower_{side}"].translation, .5)]
        # lateral side of this arm in chest space (rest decides: left arm at +x or -x)
        rest_x = (actor.rest_world["chest"].inverted() @ actor.rest_world[f"arm_upper_{side}"].translation).x
        out_sign = 1 if rest_x > 0 else -1
        need = 0.0
        r = LIMB_R["uarm"]
        for p in pts:
            lp = inv @ p
            if body.lo.y - r < lp.y < body.hi.y + r and body.lo.z - r < lp.z < body.hi.z + r:
                edge = body.hi.x + r if out_sign > 0 else body.lo.x - r
                gap = (edge - lp.x) * out_sign
                if gap > 0:
                    dist = max((p - sh).length, .15)
                    need = max(need, math.atan2(gap, dist))
        ang = need + extra_abduct
        if ang <= 1e-4:
            continue
        # rotation about chest forward that moves this arm outward
        axis = fwd.normalized()
        R = Quaternion(axis, ang)
        test = R @ (pts[0] - sh)
        if ((inv.to_3x3() @ test).x - (inv.to_3x3() @ (pts[0] - sh)).x) * out_sign < 0:
            R = Quaternion(axis, -ang)
        for k in (f"arm_upper_{side}", f"arm_lower_{side}", f"hand_{side}"):
            q[k] = (R @ q[k]).normalized()
    return q


def lowest_point(actor, world):
    sole = actor.rest_world["foot_right"].translation.z
    pts = [world["foot_left"].translation.z - sole, world["foot_right"].translation.z - sole,
           world["leg_lower_left"].translation.z - .13, world["leg_lower_right"].translation.z - .13,
           world["hips"].translation.z - .25, world["chest"].translation.z - .3, world["head"].translation.z - .1,
           world["hand_left"].translation.z - .08, world["hand_right"].translation.z - .08]
    return min(pts)


def ground_offsets(actor, frames, hover=0.12, window=4):
    """Per-frame vertical correction: never below the ground, small hovering pulled down; smoothed."""
    raw, lows = [], []
    for q, hw in frames:
        low = lowest_point(actor, fk(actor, q, hw))
        lows.append(low)
        raw.append(-low if low < hover else 0.0)
    out = []
    for i in range(len(raw)):
        a, b = max(0, i - window), min(len(raw), i + window + 1)
        avg = sum(raw[a:b]) / (b - a)
        out.append(max(avg, -lows[i]))     # smoothing may never push a frame into the ground
    return out


# ----------------------------------------------------------------------------- blade aiming (like the game's aimSword)
def body_dir(world, v):
    """A body-space direction (x right, y forward, z up) in world space, from the hips' heading."""
    hq = world["hips"].to_quaternion()
    return hq @ v


def rest_blade_dir(actor, world):
    # forward and down from the hanging fist, in the actor's own heading (rig faces -y at rest)
    f = world["chest"].to_3x3() @ (actor.rest_world["chest"].to_3x3().inverted() @ Vector((0, -1, 0)))
    f.z = 0
    f = f.normalized() if f.length > 1e-6 else Vector((0, -1, 0))
    return (f * .91 + Vector((0, 0, -.42))).normalized()


def swing_blade_dir(world):
    fore = world["hand_right"].translation - world["arm_lower_right"].translation
    fore = fore.normalized() if fore.length > 1e-6 else Vector((0, 0, -1))
    return (fore + Vector((0, 0, .55))).normalized()


def grip_rotation(actor, world, d):
    """Rotation of the grip that points the blade along d with the least twist from the hand's own grip."""
    g0 = (world["hand_right"] @ actor.rest_local["grip_right"]).to_quaternion()
    cur = g0 @ BLADE_DIR
    return (cur.rotation_difference(d) @ g0).normalized()


def aim_blades(actor, key, frames, beats, hz):
    """frames: list of (q, hips). beats: [{t, kind: 'attack'|'block', target(i) -> Vector | None, dir(i) -> Vector}].
    Adds an aimed q['grip_right'] to every frame, smoothed, blending to the beats."""
    dirs = []
    for i, (q, hw) in enumerate(frames):
        w = fk(actor, q, hw)
        hand, chest = w["hand_right"].translation, w["chest"].translation
        reach = (hand - w["arm_upper_right"].translation).length
        raised = H.smoothstep((hand.z - (chest.z - .25)) / .45)
        extended = H.smoothstep((reach - .45) / .2)
        k = max(raised, extended)
        d = rest_blade_dir(actor, w).lerp(swing_blade_dir(w), k).normalized()
        for b in beats:
            dt = i / hz - b["t"]
            if -.3 < dt < .2:
                wgt = H.smoothstep((dt + .3) / .22) if dt < 0 else 1 - H.smoothstep(dt / .2)
                if b["kind"] == "attack":
                    tgt = b["target"](i)
                    g = w["hand_right"] @ actor.rest_local["grip_right"]
                    want = (tgt - g.translation)
                    want = want.normalized() if want.length > 1e-6 else d
                else:
                    want = b["dir"](i)
                d = d.lerp(want, wgt).normalized()
        dirs.append(d)
    # smooth the aim over time (no jitter from the solved wrists)
    sm = []
    for i in range(len(dirs)):
        a, b = max(0, i - 2), min(len(dirs), i + 3)
        v = Vector((0, 0, 0))
        for j in range(a, b):
            v += dirs[j]
        sm.append(v.normalized())
    out = []
    for (q, hw), d in zip(frames, sm):
        w = fk(actor, q, hw)
        q = dict(q)
        q["grip_right"] = grip_rotation(actor, w, d)
        out.append((q, hw))
    return out


def two_bone(shoulder, elbow, hand, target):
    """Positions of elbow and hand after a two-bone IK reach towards target, keeping the bend plane."""
    l1, l2 = (elbow - shoulder).length, (hand - elbow).length
    d = target - shoulder
    dist = max(min(d.length, l1 + l2 - 1e-4), abs(l1 - l2) + 1e-4)
    dn = d.normalized()
    pole = elbow - shoulder
    pole = (pole - dn * pole.dot(dn))
    pole = pole.normalized() if pole.length > 1e-6 else Vector((0, 0, -1)).cross(dn).normalized()
    a = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    a = max(-1.0, min(1.0, a))
    e = shoulder + dn * (l1 * a) + pole * (l1 * math.sqrt(max(0.0, 1 - a * a)))
    return e, shoulder + dn * dist


def left_hand_on_hilt(actor, q, hw, max_gap=.38):
    """Two-handed grip: when the left hand is near the right, put it on the hilt just below the right hand."""
    w = fk(actor, q, hw)
    g = w["grip_right"]
    hilt = g.translation - (g.to_3x3() @ BLADE_DIR) * .2
    hand = w["hand_left"].translation
    gap = (hand - w["hand_right"].translation).length
    if gap > max_gap:
        return q
    wgt = 1 - H.smoothstep((gap - .22) / (max_gap - .22))
    target = hand.lerp(hilt, wgt)
    sh, el = w["arm_upper_left"].translation, w["arm_lower_left"].translation
    e2, h2 = two_bone(sh, el, hand, target)
    q = dict(q)
    r1 = (el - sh).rotation_difference(e2 - sh)
    q["arm_upper_left"] = (r1 @ q["arm_upper_left"]).normalized()
    lower_now = r1 @ (hand - el)
    r2 = lower_now.rotation_difference(h2 - e2)
    q["arm_lower_left"] = (r2 @ r1 @ q["arm_lower_left"]).normalized()
    q["hand_left"] = (r2 @ r1 @ q["hand_left"]).normalized()
    return q


def limit_head(actor, q, max_roll=math.radians(8), max_pitch=math.radians(35)):
    """Mocap heads wobble and roll; keep the big Blockbench head upright: limit roll and pitch relative to the neck."""
    rn = actor.rest_world["neck"].to_quaternion()
    rh = actor.rest_world["head"].to_quaternion()
    rel = (q["neck"] @ rn.inverted()).inverted() @ (q["head"] @ rh.inverted())   # head motion in the neck's frame
    e = rel.to_euler("XYZ")
    # rig faces -y: x = nod (pitch), y = roll (tilt to the shoulder), z = turn
    e.x = max(-max_pitch, min(max_pitch, e.x))
    e.y = max(-max_roll, min(max_roll, e.y))
    q = dict(q)
    q["head"] = ((q["neck"] @ rn.inverted()) @ e.to_quaternion() @ rh).normalized()
    return q


def body_push(wa, wb, extra=0.0):
    """Deepest overlap of body a with body b (plus a clearance `extra`) and the horizontal direction that frees a."""
    worst, push = 0.0, Vector((0, 0, 0))
    for na, a1, a2, ra in capsules(wa):
        for nb, b1, b2, rb in capsules(wb):
            pa, pb = seg_closest(a1, a2, b1, b2)
            d = (pa - pb)
            depth = ra + rb + extra - d.length
            if depth > worst:
                d.z = 0
                if d.length < 1e-6:
                    d = wa["hips"].translation - wb["hips"].translation
                    d.z = 0
                worst, push = depth, d.normalized() if d.length > 1e-6 else Vector((1, 0, 0))
    return worst, push
