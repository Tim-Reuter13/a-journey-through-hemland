"""Bake "Die letzte Wacht" onto the Hemland rigs and export animation data for the live cutscene.

blender -b --factory-startup --python bake_film.py -- <out_dir>

Writes <out_dir>/letzte_wacht.json (header, events) and letzte_wacht.bin (per actor, per frame:
hips position float32[3] + one int16[4] quaternion per pivot, local, three.js axes).
Times are seconds on the film clock; the bake runs at 30 Hz.
"""
import json
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector

import hemrig as H

OUT = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else Path(__file__).resolve().parent / "out"
HZ = 30
DURATION = 120.0
H.FPS_FILM = HZ  # the timeline counts in bake frames

FALLBACK = {}  # clip -> stand-in while a clip is still being generated


def clip_name(n):
    if (H.LIBRARY / n / f"{n}.fbx").exists():
        return n
    # stand-in while a clip is still rendering: a guard stance, not a crouch
    return FALLBACK.get(n, "f_circle_guard" if (H.LIBRARY / "f_circle_guard" / "f_circle_guard.fbx").exists() else "sword_overhead")


def F(t):
    return int(round(t * HZ)) + 1


# ------------------------------------------------------------------ choreography (Blender axes: x east, y north)
# place = (x, y, facing°) with 0° = facing -y (south), 90° = facing +x (east), -90° = facing -x (west)
DUEL_Y = 3.0   # north of the altar (three.js z = -3)
BANDIT = [
    dict(clip="f_sit_fire", t=0.0, end=25.5, in_=0.0, speed=0.13, place=(3.8, 0.2, -38.6)),
    dict(clip="f_sit_fire", t=25.5, end=30.0, in_=3.1, speed=0.75, place="chain", blend=20),
    dict(clip="f_standup_draw", t=30.0, end=36.0, in_=0.0, speed=0.95, place=(3.8, 0.2, -38.6), blend=0),
    dict(clip="f_breathe_guard", t=36.0, end=41.0, in_=0.0, speed=0.8, place="chain", blend=10),
    dict(clip="f_circle_guard", t=41.0, end=47.0, in_=0.0, speed=0.85, place=(1.9, DUEL_Y + 0.2, -90), blend=0),
    dict(clip="sword_overhead", t=47.0, end=51.0, align=("strike", 49.0), place=(1.3, DUEL_Y, -90), blend=0),
    dict(clip="f_dodge_back", t=51.0, end=55.0, align=("dodge", 52.9), place=(1.3, DUEL_Y, -90), blend=0),
    dict(clip="f_thrust_lunge", t=55.0, end=61.0, align=("strike", 57.6), slowmo=(57.0, 58.6, 0.3), place=(1.35, DUEL_Y, -90), blend=0),
    dict(clip="f_slash_side", t=61.0, end=66.0, align=("strike", 62.6), place=(1.25, DUEL_Y, -90), blend=0),
    dict(clip="sword_overhead", t=66.0, end=71.0, in_=0.2, speed=0.6, place=(1.45, DUEL_Y, -90), blend=0),
    dict(clip="f_death_fall", t=71.0, end=80.0, in_=0.0, speed=0.85, place=(1.35, DUEL_Y, -90), blend=0),
    dict(clip="f_death_fall", t=80.0, end=DURATION, in_=99.0, speed=0.0, place="chain", blend=12),
]
CAPTAIN = [
    dict(clip="f_walk_toward", t=0.0, end=33.0, cycle=True, speed=1.2, walk_to=(32.6, -4.3, 0.3, 94)),
    dict(clip="f_breathe_guard", t=33.0, end=36.0, in_=0.0, speed=0.8, place="chain", blend=14),
    dict(clip="f_draw_guard", t=36.0, end=41.0, in_=0.0, speed=1.0, place="chain", blend=10),
    dict(clip="f_circle_guard", t=41.0, end=47.0, in_=0.0, speed=0.85, place=(-1.9, DUEL_Y - 0.2, 90), blend=0),
    dict(clip="f_block_high", t=47.0, end=51.0, align=("block", 49.0), place=(-1.2, DUEL_Y, 90), blend=0),
    dict(clip="f_slash_side", t=51.0, end=55.0, align=("strike", 52.9), place=(-1.6, DUEL_Y, 90), blend=0),
    dict(clip="f_block_high", t=55.0, end=61.0, align=("block", 57.6), slowmo=(57.0, 58.6, 0.3), place=(-1.15, DUEL_Y, 90), blend=0),
    dict(clip="f_hit_stagger", t=61.0, end=66.0, align=("hit", 62.6), place=(-1.15, DUEL_Y, 90), blend=0),
    dict(clip="f_thrust_lunge", t=66.0, end=71.0, align=("strike", 69.0), slowmo=(68.3, 70.0, 0.35), place=(-0.25, DUEL_Y, 90), blend=0),
    dict(clip="f_breathe_guard", t=71.0, end=86.0, in_=0.0, speed=0.34, place=(-1.8, DUEL_Y, 90), blend=0),
    dict(clip="f_kneel_mourn", t=86.0, end=94.0, in_=0.0, speed=0.75, place=(-0.7, 2.0, 60), blend=0),
    dict(clip="f_kneel_mourn", t=94.0, end=100.0, in_=99.0, speed=0.0, place="chain", blend=20),
    dict(clip="f_kneel_mourn", t=100.0, end=104.0, in_=99.0, speed=-1.1, place="chain", blend=10),
    dict(clip="f_walk_toward", t=104.0, end=DURATION, cycle=True, speed=0.92, walk_from=-97, blend=22),
]
WALK_ANCHOR = (32.6, -4.3, 0.3)  # captain's hips reach the circle's west edge here
VISIBLE = {"captain": [(16.5, DURATION)], "bandit": [(0.0, DURATION)]}


def hand_speed(clip):
    hs = clip["hands"]["RightHand"]
    sp = [0.0] + [(hs[i] - hs[i - 1]).length * H.FPS_CLIP for i in range(1, len(hs))]
    return sp


def key_time(clip, kind):
    """Clip time (s) of the beat a segment is aligned on."""
    sp = hand_speed(clip)
    n = len(sp)
    hs = clip["hands"]["RightHand"]
    if kind == "strike":     # fastest hand
        i = max(range(n), key=lambda k: sp[k])
    elif kind == "block":    # hands highest
        i = max(range(n), key=lambda k: hs[k].z)
    elif kind == "dodge":    # hips furthest back (most +y travel in clip space = away from the camera)
        hp = clip["hips"]
        i = max(range(n), key=lambda k: hp[k].y)
    else:                    # hit: hips drop fastest
        hp = clip["hips"]
        i = min(range(1, n), key=lambda k: hp[k].z - hp[k - 1].z)
    return i / H.FPS_CLIP


def to_segments(spec, clips):
    segs = []
    for s in spec:
        name = clip_name(s["clip"])
        c = clips[name]
        speed = s.get("speed", 1.0)
        tin = s.get("in_", 0.0)
        if tin >= 99:
            tin = c["seconds"]
        if "align" in s:
            kind, at = s["align"]
            kt = key_time(c, kind)
            dt = at - s["t"]
            sm = s.get("slowmo")
            if sm and dt > sm[0] - s["t"]:
                a0 = sm[0] - s["t"]
                dt = a0 + (min(dt, sm[1] - s["t"]) - a0) * sm[2] + max(0.0, dt - (sm[1] - s["t"]))
            tin = kt - dt * speed
            s["_beat"] = (kind, at)
        if s.get("turn"):
            pass
        segs.append(dict(clip=name, start=F(s["t"]), end=F(s["end"]), **{"in": tin}, speed=speed,
                         place=s.get("place", "chain"), blend=s.get("blend", 8), slowmo=s.get("slowmo"),
                         anchor=s.get("anchor"), turn=s.get("turn", 0), cycle=s.get("cycle", False),
                         walk_to=s.get("walk_to"), walk_from=s.get("walk_from")))
    return segs


def find_loop(clip):
    """Best walk cycle (a, b) in seconds: similar poses, at least 0.8 s apart."""
    n = clip["frames"]
    bones = list(clip["rot"])
    best = None
    lo, hi = int(0.25 * H.FPS_CLIP), n - int(0.15 * H.FPS_CLIP)
    for i in range(lo, hi):
        for j in range(i + int(0.8 * H.FPS_CLIP), min(hi, i + int(2.6 * H.FPS_CLIP))):
            d = sum(1 - abs(clip["rot"][b][i].dot(clip["rot"][b][j])) for b in bones)
            hv = (clip["hips"][min(i + 1, n - 1)] - clip["hips"][i]) - (clip["hips"][min(j + 1, n - 1)] - clip["hips"][j])
            d += 30 * hv.length - 0.004 * (j - i)
            if best is None or d < best[0]:
                best = (d, i, j)
    _, i, j = best
    return i / H.FPS_CLIP, j / H.FPS_CLIP


class FilmTimeline(H.Timeline):
    """Adds slow motion inside a segment, a turn on chained segments, walk cycles and an anchor."""

    def __init__(self, actor, segments, clips, anchor=None):
        from mathutils import Matrix
        self._loops = {}
        for s in segments:
            if s.get("cycle"):
                c = clips[s["clip"]]
                if s["clip"] not in self._loops:
                    a, b = find_loop(c)
                    travel = c["hips"][int(b * H.FPS_CLIP)] - c["hips"][int(a * H.FPS_CLIP)]
                    travel.z = 0
                    self._loops[s["clip"]] = (a, b, travel)
                    print("LOOP", s["clip"], round(a, 2), round(b, 2), "speed", round(travel.length / (b - a), 2), "m/s")
                s["in"] = self._loops[s["clip"]][0]
                if s.get("walk_to"):
                    s["place"] = (0, 0, s["walk_to"][3])
        for s in segments:
            if s["turn"] and s["place"] == "chain":
                s["_turn"] = math.radians(s["turn"])
        super().__init__(actor, segments, clips)
        for i, s in enumerate(self.segs):
            if not s.get("cycle"):
                continue
            a, b, travel = self._loops[s["clip"]]
            O = self.off[s["clip"]]
            v = travel.length / (b - a) * O["_scale"] * s["speed"]   # world speed
            s["_v"] = v
            if s.get("walk_to"):
                t_at, x, y, deg = s["walk_to"]
                yaw = math.radians(deg)
                d = Vector((math.sin(yaw), -math.cos(yaw), 0))
                p_at = Vector((x, y, 0))
                s["_dir"], s["_yaw"] = d, yaw
                s["_p0"] = p_at - d * v * (F(t_at) - s["start"]) / HZ
            elif s.get("walk_from") is not None and i > 0:
                _, hw, _ = self.raw(self.segs[i - 1], s["start"])
                yaw = math.radians(s["walk_from"])
                s["_dir"], s["_yaw"] = Vector((math.sin(yaw), -math.cos(yaw), 0)), yaw
                s["_p0"] = Vector((hw.x, hw.y, 0))
        self._rechain()
        if anchor:
            t, x, y = anchor
            group = [s for s in self.segs if s.get("anchor") == "walk"]
            f = F(t)
            seg = max((s for s in group if s["start"] <= f), key=lambda s: s["start"])
            _, hw, _ = self.raw(seg, f)
            from mathutils import Matrix
            shift = Matrix.Translation((x - hw.x, y - hw.y, 0))
            for s in group:
                s["T"] = shift @ s["T"]
            # the segments chained after the walk follow the shift
            idx = self.segs.index(group[-1])
            for s in self.segs[idx + 1:]:
                if s["place"] != "chain":
                    break
                s["T"] = shift @ s["T"]
        for i, s in enumerate(self.segs):
            if s.get("_turn"):
                from mathutils import Matrix
                _, hw, _ = self.raw(s, s["start"])
                R = Matrix.Translation((hw.x, hw.y, 0)) @ Matrix.Rotation(s["_turn"], 4, "Z") @ Matrix.Translation((-hw.x, -hw.y, 0))
                for t in self.segs[i:]:
                    if t is not s and t["place"] != "chain":
                        break
                    t["T"] = R @ t["T"]

    def _rechain(self):
        """Place every chained segment at the end of the one before (after walk cycles know their paths)."""
        from mathutils import Matrix
        for i, s in enumerate(self.segs):
            if i == 0 or s["place"] != "chain" or s.get("cycle"):
                continue
            clip = self.clips[s["clip"]]
            O = self.off[s["clip"]]
            rot0, h0 = H.sample(clip, s["in"])
            y0 = H.yaw_of(clip, rot0["Hips"])
            _, hw, yaw_end = self.raw(self.segs[i - 1], s["start"])
            R = Matrix.Rotation(yaw_end - y0, 4, "Z")
            start = R @ (h0 * O["_scale"])
            s["T"] = Matrix.Translation((hw.x - start.x, hw.y - start.y, 0)) @ R

    def clip_time(self, s, f):
        t = (f - s["start"]) / HZ
        sm = s.get("slowmo")
        if sm:
            a, b, k = (F(sm[0]) - s["start"]) / HZ, (F(sm[1]) - s["start"]) / HZ, sm[2]
            if t > a:
                t = a + (min(t, b) - a) * k + max(0.0, t - b)
        return s["in"] + t * s["speed"]

    def raw(self, s, f):
        clip = self.clips[s["clip"]]
        O = self.off[s["clip"]]
        if s.get("cycle") and "_dir" in s:
            return self.cycle_pose(s, f, clip, O)
        rot, hips = H.sample(clip, self.clip_time(s, f))
        qT = s["T"].to_quaternion()
        hw = s["T"] @ (hips * O["_scale"])
        qh = qT @ rot["Hips"]
        return {k: (qT @ rot[b]) @ O[k] for k, (b, _) in H.MAP.items()}, hw, H.yaw_of(clip, qh)


def _cycle_pose(self, s, f, clip, O):
    from mathutils import Matrix
    a, b, travel = self._loops[s["clip"]]
    L = b - a
    el = (f - s["start"]) / HZ * s["speed"]
    tc = a + el % L
    rot, hips = H.sample(clip, tc)
    w = 0.18
    if tc > b - w:   # blend into the loop's start across the seam
        k = H.smoothstep((tc - (b - w)) / w)
        r2, h2 = H.sample(clip, tc - L)
        rot = {bn: q.slerp(r2[bn] if q.dot(r2[bn]) >= 0 else -r2[bn], k) for bn, q in rot.items()}
        hips = hips.lerp(h2 + travel, k)
    h0 = H.sample(clip, a)[1]
    frac = (tc - a) / L
    local = hips - h0 - travel * frac          # sway without the travel
    y0 = H.yaw_of(clip, H.sample(clip, a)[0]["Hips"])
    R = Matrix.Rotation(s["_yaw"] - y0, 4, "Z")
    pos = s["_p0"] + s["_dir"] * s["_v"] * (f - s["start"]) / HZ
    hw = Vector((pos.x, pos.y, 0)) + (R @ (local * O["_scale"])) + Vector((0, 0, h0.z * O["_scale"]))
    qT = R.to_quaternion()
    qh = qT @ rot["Hips"]
    return {k: (qT @ rot[bn]) @ O[k] for k, (bn, _) in H.MAP.items()}, hw, H.yaw_of(clip, qh)


FilmTimeline.cycle_pose = _cycle_pose


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    actors = {"captain": H.Actor("captain", "cap_"), "bandit": H.Actor("bandit", "ban_")}
    names = sorted({clip_name(s["clip"]) for s in BANDIT + CAPTAIN})
    clips = {n: H.load_clip(n) for n in names}
    specs = {"captain": CAPTAIN, "bandit": BANDIT}
    n = F(DURATION)
    data = bytearray()
    header = {"name": "Die letzte Wacht", "hz": HZ, "frames": n, "duration": DURATION, "pivots": H.ORDER,
              "actors": {}, "events": [], "clips": {k: clip_name(k) for k in {s["clip"] for s in BANDIT + CAPTAIN}}}
    worlds = {}
    for key, actor in actors.items():
        segs = to_segments(specs[key], clips)
        tl = FilmTimeline(actor, segs, clips)
        # feet must not slide on walk cycles: measure the planted foot and correct the travel speed
        for s in tl.segs:
            if not s.get("cycle") or "_v" not in s:
                continue
            for _ in range(3):
                slip = []
                for f in range(s["start"] + 12, min(s["end"], s["start"] + 12 + 4 * HZ)):
                    pa = foot_positions(actor, tl, f)
                    pb = foot_positions(actor, tl, f + 1)
                    vel = [(pb[i] - pa[i]) * HZ for i in range(2)]
                    low = min(range(2), key=lambda i: pa[i].z)
                    slip.append(vel[low].dot(s["_dir"]))
                slip.sort()
                med = slip[len(slip) // 2]
                print("SLIP", key, round(s["_v"], 2), "planted foot moves", round(med, 2), "m/s")
                if abs(med) < .03:
                    break
                old = s["_v"]
                s["_v"] = old - med
                if s.get("walk_to"):
                    t_at = s["walk_to"][0]
                    s["_p0"] = s["_p0"] + s["_dir"] * (old - s["_v"]) * (F(t_at) - s["start"]) / HZ
        frames = []
        for f in range(1, n + 1):
            q, hips_w = tl.pose(f)
            frames.append((q, hips_w))
        # local transforms (same maths as H.bake, without keyframes)
        root_w = actor.root.matrix_basis.copy()
        offset = len(data)
        ws = []
        for q, hips_w in frames:
            world = {}
            for k in H.ORDER:
                o = actor.piv[k]
                pk = o.parent.name[len(actor.prefix):].split(".")[0] if o.parent else None
                pw = world.get(pk, root_w) if pk != "root" else root_w
                pos = hips_w if k == "hips" else (pw @ actor.rest_local[k]).translation
                from mathutils import Matrix
                W = Matrix.Translation(pos) @ q[k].to_matrix().to_4x4()
                world[k] = W
                L = pw.inverted() @ W
                loc, rot, _ = L.decompose()
                if k == "hips":
                    data += struct.pack("<3f", loc.x, loc.z, -loc.y)  # three.js axes
                rot.normalize()
                # three.js: (x, y, z, w) = (x, z, -y, w)
                data += struct.pack("<4h", *(int(round(max(-1, min(1, v)) * 32767)) for v in (rot.x, rot.z, -rot.y, rot.w)))
            ws.append(world)
        worlds[key] = ws
        header["actors"][key] = {"model": actor_model(key), "offset": offset, "visible": VISIBLE[key],
                                 "segments": [{"clip": s["clip"], "t": (s["start"] - 1) / HZ, "end": (s["end"] - 1) / HZ}
                                              for s in segs]}
    header["events"] = events(worlds)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "letzte_wacht.bin").write_bytes(bytes(data))
    (OUT / "letzte_wacht.json").write_text(json.dumps(header, indent=1), encoding="utf-8")
    print("BAKE_OK", n, "frames", len(data), "bytes", len(header["events"]), "events")


def foot_positions(actor, tl, f):
    from mathutils import Matrix
    q, hips_w = tl.pose(f)
    root_w = actor.root.matrix_basis.copy()
    world = {}
    for k in H.ORDER:
        o = actor.piv[k]
        pk = o.parent.name[len(actor.prefix):].split(".")[0] if o.parent else None
        pw = world.get(pk, root_w) if pk != "root" else root_w
        pos = hips_w if k == "hips" else (pw @ actor.rest_local[k]).translation
        world[k] = Matrix.Translation(pos) @ q[k].to_matrix().to_4x4()
    return [world["foot_left"].translation.copy(), world["foot_right"].translation.copy()]


def actor_model(key):
    return {"captain": "captain", "bandit": "bandit"}[key]


def three(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


def events(worlds):
    """Beats for sound and effects: clashes, hits, footsteps, falls."""
    ev = []
    for spec, who, other in ((BANDIT, "bandit", "captain"), (CAPTAIN, "captain", "bandit")):
        for s in spec:
            beat = s.get("_beat")
            if not beat:
                continue
            kind, at = beat
            f = F(at) - 1
            hand = worlds[who][f]["hand_right"].translation
            if kind == "strike" and who == "bandit" and at in (49.0, 57.6):
                ev.append({"t": at, "type": "clash", "pos": three(hand)})
            if kind == "strike" and who == "captain" and at == 52.9:
                ev.append({"t": at, "type": "whoosh", "pos": three(hand)})
            if kind == "strike" and who == "bandit" and at == 62.6:
                tgt = worlds[other][f]["chest"].translation
                ev.append({"t": at, "type": "hit", "who": other, "pos": three(tgt)})
            if kind == "strike" and who == "captain" and at == 69.0:
                tgt = worlds[other][f]["torso"].translation
                ev.append({"t": at, "type": "kill", "who": other, "pos": three(tgt)})
    for t, kind in ((49.0 - 0.45, "whoosh"), (57.6 - 0.3, "whoosh"), (62.6 - 0.3, "whoosh"), (69.0 - 0.6, "whoosh"),
                    (37.4, "draw"), (31.6, "draw"), (74.5, "drop"), (76.6, "fall"), (93.0, "kneel"), (101.5, "rise")):
        ev.append({"t": t, "type": kind})
    # footsteps from the feet's contact with the ground
    for who, ws in worlds.items():
        for side in ("right", "left"):
            prev_z, down = None, False
            for i, w in enumerate(ws):
                z = w[f"foot_{side}"].translation.z
                if prev_z is not None:
                    v = (z - prev_z) * HZ
                    if v < -0.25 and z < 0.35:
                        down = True
                    if down and v > -0.05 and z < 0.22:
                        ev.append({"t": round(i / HZ, 3), "type": "step", "who": who, "pos": three(w[f"foot_{side}"].translation)})
                        down = False
                prev_z = z
    ev.sort(key=lambda e: e["t"])
    return ev


main()
