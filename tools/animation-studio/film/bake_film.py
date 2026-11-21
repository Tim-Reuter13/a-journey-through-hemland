"""Bake "Die letzte Wacht" onto the Hemland rigs and export animation data for the live cutscene (v2).

blender -b --factory-startup --python bake_film.py -- <out_dir>

v2: Retarget 2.0 (arms kept out of the wide Blockbench torso, ground contact, style per figure) and a
choreography solver (chest faces its target, blades meet on clashes and reach the body on hits, nobody
stands in stones, altar or fire). Writes letzte_wacht.{json,bin} and letzte_wacht_report.json (every
error that is left, with its time) – the browser validator and the AI review read that report.
"""
import json
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy
from mathutils import Matrix, Vector

import hemrig as H
import solver as S

OUT = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else Path(__file__).resolve().parent / "out"
HZ = 30
DURATION = 120.0
H.FPS_FILM = HZ  # the timeline counts in bake frames


def clip_name(n):
    if (H.LIBRARY / n / f"{n}.fbx").exists():
        return n
    return "f_circle_guard" if (H.LIBRARY / "f_circle_guard" / "f_circle_guard.fbx").exists() else "sword_overhead"


def F(t):
    return int(round(t * HZ)) + 1


# ------------------------------------------------------------------ choreography (Blender axes: x east, y north)
# place = (x, y, facing°) as a start guess (0° = facing -y, 90° = +x, -90° = -x); the solver refines it.
# face = "opp" (the other fighter) or (x, y); hit = (target, time) where target is "blade", "chest" or "torso".
DUEL_Y = 3.5   # north of the altar's corner (three.js z = -3.5)
FIRE_B = (3.0, -0.8)
WALK = "f_walk_heavy" if (H.LIBRARY / "f_walk_heavy" / "f_walk_heavy.fbx").exists() else "f_walk_toward"


def pick(*names):
    """First clip of the list that exists in the library (stocky captain clips, then the older ones)."""
    for n in names:
        if (H.LIBRARY / n / f"{n}.fbx").exists():
            return n
    return names[-1]
BANDIT = [
    dict(clip="f_sit_fire", t=0.0, end=25.5, in_=0.0, speed=0.13, place=(4.2, 0.65, -38.6), face=FIRE_B),
    dict(clip="f_sit_fire", t=25.5, end=30.0, in_=2.4, speed=0.55, place="chain", blend=20),
    dict(clip="f_standup_draw", t=30.0, end=36.0, in_=0.0, speed=0.95, place=(4.2, 0.65, -38.6), blend=0, face="opp", face_t=35.0),
    dict(clip="f_breathe_guard", t=36.0, end=41.0, in_=0.0, speed=0.8, place="chain", blend=10),
    dict(clip="f_circle_guard", t=41.0, end=47.0, in_=0.0, speed=0.85, place=(1.9, DUEL_Y, -90), blend=0, face="opp"),
    dict(clip=pick("b_overhead", "sword_overhead"), t=47.0, end=51.0, align=("block", 48.7), place=(1.3, DUEL_Y, -90), blend=0, face="opp", hit=("blade", 49.0)),
    dict(clip="f_dodge_back", t=51.0, end=55.0, align=("dodge", 52.9), place=(1.3, DUEL_Y, -90), blend=0, face="opp"),
    dict(clip="f_thrust_lunge", t=55.0, end=61.0, align=("strike", 57.6), slowmo=(57.0, 58.6, 0.3), place=(1.35, DUEL_Y, -90), blend=0, face="opp", hit=("blade", 57.6)),
    dict(clip="f_slash_side", t=61.0, end=66.0, align=("strike", 62.6), place=(1.25, DUEL_Y, -90), blend=0, face="opp", hit=("chest", 62.6)),
    dict(clip=pick("b_overhead", "sword_overhead"), t=66.0, end=71.0, in_=1.6, speed=0.5, place=(1.45, DUEL_Y, -90), blend=0, face="opp"),
    dict(clip="f_death_fall", t=71.0, end=76.0, in_=0.0, speed=0.6, place=(1.35, DUEL_Y, -90), blend=0, free=True),
    dict(clip="f_death_fall", t=76.0, end=DURATION, in_=3.0, speed=0.0, place="chain", blend=14),   # lies flat face down, before the clip rolls him over
]
CAPTAIN = [
    dict(clip=WALK, t=0.0, end=33.0, cycle=True, speed=1.0, walk_to=(32.6, -4.3, 0.3, 94)),
    dict(clip=pick("c_breathe_guard", "f_breathe_guard"), t=33.0, end=36.0, in_=0.0, speed=0.8, place="chain", blend=14),
    dict(clip=pick("c_draw_guard", "f_draw_guard"), t=36.0, end=41.0, in_=0.0, speed=1.0, place="chain", blend=10),
    dict(clip=pick("c_circle_guard", "f_circle_guard"), t=41.0, end=47.0, in_=0.0, speed=0.85, place=(-1.9, DUEL_Y - 0.2, 90), blend=0, face="opp"),
    dict(clip=pick("c_block_high", "f_block_high"), t=47.0, end=51.0, align=("block", 49.0), place=(-1.2, DUEL_Y, 90), blend=0, face="opp"),
    dict(clip=pick("c_slash_side", "f_slash_side"), t=51.0, end=55.0, align=("strike", 52.9), place=(-1.6, DUEL_Y, 90), blend=0, face="opp", aim=("miss", 52.9)),
    dict(clip=pick("c_circle_guard", "f_circle_guard"), t=55.0, end=61.0, align=("block", 57.6), slowmo=(57.0, 58.6, 0.3), place=(-1.15, DUEL_Y, 90), blend=0, face="opp"),
    dict(clip="f_hit_stagger", t=61.0, end=66.0, align=("hit", 62.8), place=(-1.15, DUEL_Y, 90), blend=0, face="opp"),
    dict(clip="f_thrust_lunge", t=66.0, end=71.0, align=("strike", 69.0), slowmo=(68.3, 70.0, 0.35), place=(-0.25, DUEL_Y, 90), blend=0, face="opp", hit=("torso", 69.0)),
    dict(clip=pick("c_breathe_guard", "f_breathe_guard"), t=71.0, end=86.0, in_=0.0, speed=0.34, place=(-1.8, DUEL_Y, 90), blend=0, face="opp"),
    dict(clip=pick("c_kneel_mourn", "f_kneel_mourn"), t=86.0, end=94.0, in_=1.3, speed=0.6, place=(0.2, 3.7, 0), blend=0, face="opp", clear=.2, free=True, near=1.0),
    dict(clip=pick("c_kneel_mourn", "f_kneel_mourn"), t=94.0, end=98.6, in_=99.0, speed=0.0, place="chain", blend=20),
    dict(clip=pick("c_kneel_mourn", "f_kneel_mourn"), t=98.6, end=102.2, in_=2.9, speed=-.55, place="chain", blend=10),   # back up through the kneel-down, upright (~0.9 s clip) before the cut
    # cut at 102.2 s (shot 16 starts): he walks off from a free spot west of the altar towards the gap and the sun
    dict(clip=WALK, t=102.2, end=DURATION, cycle=True, speed=0.92, walk_start=(-2.4, 2.6), walk_from=(-7.5, 0.6), blend=0),
]
VISIBLE = {"captain": [(16.5, DURATION)], "bandit": [(0.0, DURATION)]}
# the swords appear when they are drawn / picked up (the captain walks in with his blade sheathed)
WEAPONS = {"captain": [(37.3, DURATION + 10)], "bandit": [(31.4, DURATION + 10)]}
PLANTED = {"captain": [(88.0, 98.9)]}   # blade point-down in the ground while he kneels
STYLE = {"captain": {"abduct": math.radians(2)}, "bandit": {"abduct": 0.0}}   # heavy armour carries the arms wider


def hand_speed(clip):
    hs = clip["hands"]["RightHand"]
    return [0.0] + [(hs[i] - hs[i - 1]).length * H.FPS_CLIP for i in range(1, len(hs))]


def key_time(clip, kind):
    """Clip time (s) of the beat a segment is aligned on."""
    sp = hand_speed(clip)
    n = len(sp)
    hs = clip["hands"]["RightHand"]
    if kind == "strike":
        i = max(range(n), key=lambda k: sp[k])
    elif kind == "block":
        i = max(range(n), key=lambda k: hs[k].z)
    elif kind == "dodge":
        hp = clip["hips"]
        i = max(range(n), key=lambda k: hp[k].y)
    else:
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
        segs.append(dict(clip=name, start=F(s["t"]), end=F(s["end"]), **{"in": tin}, speed=speed,
                         place=s.get("place", "chain"), blend=s.get("blend", 8), slowmo=s.get("slowmo"),
                         cycle=s.get("cycle", False), walk_to=s.get("walk_to"), walk_from=s.get("walk_from"),
                         face=s.get("face"), face_t=s.get("face_t"), clear=s.get("clear", 0.0), free=s.get("free", False), near=s.get("near"),
                         walk_start=s.get("walk_start"), hit=s.get("hit"), aim=s.get("aim"), beat=s.get("_beat"), t0=s["t"], t1=s["end"]))
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
    """Slow motion inside segments, walk cycles on a path, chained placement that can be refreshed."""

    def __init__(self, actor, segments, clips):
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
                s["place"] = (0, 0, s["walk_to"][3]) if s.get("walk_to") else (0, 0, 0)
        super().__init__(actor, segments, clips)
        for s in self.segs:
            if s.get("cycle"):
                a, b, travel = self._loops[s["clip"]]
                s["_v"] = travel.length / (b - a) * self.off[s["clip"]]["_scale"] * s["speed"]
        self.refresh()

    def refresh(self):
        """Recompute walk paths and chained placements after the solver moved segments."""
        for i, s in enumerate(self.segs):
            if s.get("cycle"):
                if s.get("walk_to"):
                    t_at, x, y, deg = s["walk_to"]
                    yaw = math.radians(deg)
                    d = Vector((math.sin(yaw), -math.cos(yaw), 0))
                    s["_dir"], s["_yaw"] = d, yaw
                    s["_p0"] = Vector((x, y, 0)) - d * s["_v"] * (F(t_at) - s["start"]) / HZ
                elif s.get("walk_from") is not None and i > 0:
                    if s.get("walk_start"):    # starts after a cut, at its own place
                        hw = Vector((s["walk_start"][0], s["walk_start"][1], 0))
                    else:
                        _, hw, _ = self.raw(self.segs[i - 1], s["start"])
                    wf = s["walk_from"]
                    if isinstance(wf, (tuple, list)):   # head for a point (e.g. the gap between two stones)
                        dx, dy = wf[0] - hw.x, wf[1] - hw.y
                        yaw = math.atan2(dx, -dy)
                    else:
                        yaw = math.radians(wf)
                    s["_dir"], s["_yaw"] = Vector((math.sin(yaw), -math.cos(yaw), 0)), yaw
                    s["_p0"] = Vector((hw.x, hw.y, 0))
                continue
            if i == 0 or s["place"] != "chain":
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
        kb = s.get("_knock")
        if kb and f > kb[0]:   # driven back by the blow that hit him
            hw = hw + kb[1] * (kb[2] * H.smoothstep((f - kb[0]) / (.7 * HZ)))
        qh = qT @ rot["Hips"]
        return {k: (qT @ rot[b]) @ O[k] for k, (b, _) in H.MAP.items()}, hw, H.yaw_of(clip, qh)

    def cycle_pose(self, s, f, clip, O):
        a, b, travel = self._loops[s["clip"]]
        L = b - a
        el = (f - s["start"]) / HZ * s["speed"]
        tc = a + el % L
        rot, hips = H.sample(clip, tc)
        w = 0.18
        if tc > b - w:
            k = H.smoothstep((tc - (b - w)) / w)
            r2, h2 = H.sample(clip, tc - L)
            rot = {bn: q.slerp(r2[bn] if q.dot(r2[bn]) >= 0 else -r2[bn], k) for bn, q in rot.items()}
            hips = hips.lerp(h2 + travel, k)
        h0 = H.sample(clip, a)[1]
        local = hips - h0 - travel * ((tc - a) / L)
        y0 = H.yaw_of(clip, H.sample(clip, a)[0]["Hips"])
        # the walk's own travel direction (in clip space) must point along the path
        tdir = math.atan2(travel.x, -travel.y) if travel.length > 1e-4 else y0
        R = Matrix.Rotation(s["_yaw"] - tdir, 4, "Z")
        pos = s["_p0"] + s["_dir"] * s["_v"] * (f - s["start"]) / HZ
        hw = Vector((pos.x, pos.y, 0)) + (R @ (local * O["_scale"])) + Vector((0, 0, h0.z * O["_scale"]))
        qT = R.to_quaternion()
        qh = qT @ rot["Hips"]
        return {k: (qT @ rot[bn]) @ O[k] for k, (bn, _) in H.MAP.items()}, hw, H.yaw_of(clip, qh)


# ------------------------------------------------------------------ solver passes
def world_at(actor, tl, f):
    q, hw = tl.pose(f)
    return S.fk(actor, q, hw)


def seg_frames(s, step=4):
    return list(range(s["start"], max(s["start"] + 1, s["end"] - 1), step))


def followers(tl, s):
    """The segment and every chained segment hanging on it."""
    i = tl.segs.index(s)
    out = [s]
    for t in tl.segs[i + 1:]:
        if t["place"] != "chain" or t.get("cycle"):
            break
        out.append(t)
    return out


def pass_face(actors, tls, log):
    for key, other in (("captain", "bandit"), ("bandit", "captain")):
        actor, tl = actors[key], tls[key]
        for s in tl.segs:
            if not s.get("face") or s.get("cycle") or s["place"] == "chain":
                continue
            frames = [F(s["face_t"])] if s.get("face_t") else [F(s["beat"][1])] if s.get("beat") else seg_frames(s, max(1, (s["end"] - s["start"]) // 5))
            sx = sy = 0.0
            for f in frames:
                w = world_at(actor, tl, f)
                if s["face"] == "opp":
                    tgt = tls[other].pose(f)[1]
                else:
                    tgt = Vector((s["face"][0], s["face"][1], 0))
                d = tgt - w["hips"].translation
                d.z = 0
                if d.length < 1e-3:
                    continue
                a = S.yaw_delta(S.chest_forward(actor, w), d.normalized())
                sx += math.cos(a)
                sy += math.sin(a)
            ang = math.atan2(sy, sx)
            if abs(ang) > math.radians(2):
                fm = frames[len(frames) // 2]
                centre = tl.pose(fm)[1]
                S.rotate_segment(s, centre, ang)
                log.append(f"face {key} {s['clip']} @{s['t0']:.1f}: {math.degrees(ang):+.0f}°")
        tl.refresh()


def pass_hit(actors, tls, boxes, log):
    """Search distance along the fighters' line and a small turn so the blade meets its target,
    without stones, altar or the other body in the way."""
    for key, other in (("captain", "bandit"), ("bandit", "captain")):
        actor, tl = actors[key], tls[key]
        for s in tl.segs:
            if not s.get("hit"):
                continue
            kind, at = s["hit"]
            f = F(at)
            wb = world_at(actors[other], tls[other], f)
            q0, h0, _ = tl.raw(s, f)
            u = wb["hips"].translation - h0
            u.z = 0
            u = u.normalized()
            checks = sorted(set(seg_frames(s, 6) + [f]))
            opp = {g: world_at(actors[other], tls[other], g) for g in checks}
            opp[f] = wb
            T0 = s["T"].copy()
            best = None
            side = Vector((-u.y, u.x, 0))
            for di in range(-12, 13):
              for li in (0, -2, 2, -4, 4):
                for pi in range(-9, 10):
                    d, psi = di * .1, math.radians(pi * 5)
                    s["T"] = Matrix.Translation(u * d + side * (li * .1)) @ Matrix.Translation((h0.x, h0.y, 0)) @ Matrix.Rotation(psi, 4, "Z") @ Matrix.Translation((-h0.x, -h0.y, 0)) @ T0
                    q, hw, _ = tl.raw(s, f)
                    wa = S.fk(actor, q, hw)
                    tgt = target_point(actors, other, wb, kind, wa)
                    reach = (tgt - wa["grip_right"].translation).length
                    L = S.BLADE[key]
                    miss = max(0.0, reach - .85 * L) + max(0.0, .55 * L - reach)   # meet with the outer half of the blade
                    cost = miss + .04 * abs(d) + .06 * abs(li * .1) + .002 * abs(pi * 5)
                    if best is not None and cost >= best[0]:
                        continue
                    pen = 0.0
                    for g in checks:
                        qg, hg, _ = tl.raw(s, g)
                        wg = S.fk(actor, qg, hg)
                        pen = max(pen, S.set_penetration(wg, boxes, samples=3)[0])
                        pen = max(pen, S.body_overlap(wg, opp[g])[0] - .02)
                        if cost + 3 * pen >= (best[0] if best else 1e9):
                            break
                    cost += 3 * pen
                    if best is None or cost < best[0]:
                        best = (cost, s["T"].copy(), miss, d, pi * 5, pen)
            s["T"] = best[1]
            tl.refresh()
            log.append(f"hit {key} {s['clip']} @{at}: miss {best[2]:.2f} m after {best[3]:+.1f} m / {best[4]:+d}°, set/body overlap {best[5]:.2f}")


def pass_walk(actors, tls, boxes, log):
    """Walks that head for a point: try neighbouring points until the whole walk touches no stone."""
    for key, actor in actors.items():
        tl = tls[key]
        for s in tl.segs:
            wf = s.get("walk_from")
            if not s.get("cycle") or not isinstance(wf, (tuple, list)):
                continue
            base = Vector((wf[0], wf[1], 0))
            best = None
            for dx, dy in [(0, 0), (0, -.6), (0, .6), (0, -1.2), (0, 1.2), (-.8, -.6), (-.8, .6), (.8, .6), (.8, -.6),
                           (0, -1.8), (0, 1.8), (-1.2, 0), (1.2, 0), (-1.2, 1.2), (1.2, 1.2), (-1.2, -1.2), (1.2, -1.2)]:
                s["walk_from"] = (base.x + dx, base.y + dy)
                tl.refresh()
                other = "bandit" if key == "captain" else "captain"
                worst = 0.0
                for f in seg_frames(s, 6):
                    wa = world_at(actor, tl, f)
                    worst = max(worst, S.set_penetration(wa, boxes, samples=3)[0], S.body_push(wa, world_at(actors[other], tls[other], f), .1)[0])
                if best is None or worst < best[0]:
                    best = (worst, s["walk_from"])
                if worst < .02:
                    break
            s["walk_from"] = best[1]
            tl.refresh()
            log.append(f"walk {key} {s['clip']} @{s['t0']:.0f}: heads for {tuple(round(v, 1) for v in best[1])}, worst {best[0]:.2f} m")


def pass_free(actors, tls, boxes, log):
    """Segments marked free (a fall, a kneel): search position and turn for the spot that touches no stone and no
    body, closest to the plan; `near` keeps the hips that far from the other one (the mourner by the dead)."""
    hits = hit_times(tls)
    for key in ("bandit", "captain"):      # the dead first, then the one kneeling by him
        actor, tl = actors[key], tls[key]
        other = "bandit" if key == "captain" else "captain"
        for s in tl.segs:
            if not s.get("free"):
                continue
            group = followers(tl, s)
            frames = [f for t in group for f in seg_frames(t, 12)]   # every chained segment, the rise too
            settle = int(s["end"]) - 1                              # the pose he settles in (kneeling)
            opp = {f: world_at(actors[other], tls[other], f) for f in frames}
            mid = frames[len(frames) // 2]
            T0 = s["T"].copy()
            h0 = tl.pose(settle if s.get("face") == "opp" else s["start"])[1]   # a mourner turns on the spot where he kneels
            best = None
            for dx in (0, -.45, .45, -.9, .9):
                for dy in (0, -.45, .45, -.9, .9):
                    for deg in (range(-180, 180, 15) if s.get("face") == "opp" else (0, -15, 15, -30, 30, -45, 45)):
                        s["T"] = Matrix.Translation((dx, dy, 0)) @ Matrix.Translation((h0.x, h0.y, 0)) @ Matrix.Rotation(math.radians(deg), 4, "Z") @ Matrix.Translation((-h0.x, -h0.y, 0)) @ T0
                        tl.refresh()
                        cost = .12 * math.hypot(dx, dy) + .002 * abs(deg)
                        for f in frames:
                            wa = world_at(actor, tl, f)
                            cost += 3 * S.set_penetration(wa, boxes, samples=3)[0] / len(frames) * 4
                            if all(abs((f - 1) / HZ - h) > .45 for h in hits):
                                cost += 3 * S.body_push(wa, opp[f], s.get("clear", 0.0))[0] / len(frames) * 4
                            if best is not None and cost >= best[0]:
                                break
                        if s.get("face") == "opp" and (best is None or cost < best[0]):
                            wm = world_at(actor, tl, settle)          # settled pose: head leans towards the dead
                            fwd = wm["head"].translation - wm["hips"].translation
                            to = world_at(actors[other], tls[other], settle)["chest"].translation - wm["hips"].translation
                            fwd.z = to.z = 0
                            if fwd.length > .05 and to.length > .05:
                                cost += 1.2 * abs(S.yaw_delta(fwd.normalized(), to.normalized()))
                        if s.get("near") and (best is None or cost < best[0]):
                            d = (tl.pose(mid)[1] - opp[mid]["hips"].translation)
                            d.z = 0
                            cost += abs(d.length - s["near"]) * .6
                        if best is None or cost < best[0]:
                            best = (cost, s["T"].copy(), dx, dy, deg)
            s["T"] = best[1]
            tl.refresh()
            log.append(f"free {key} {s['clip']} @{s['t0']:.0f}: moved ({best[2]:+.2f}, {best[3]:+.2f}) m, {best[4]:+d}°, cost {best[0]:.2f}")
        if key == "captain":
            pass


def pass_knock(actors, tls, log):
    """A body blow drives the one who takes it back: as far as the bodies would otherwise overlap."""
    for key, other in (("captain", "bandit"), ("bandit", "captain")):
        for s in tls[key].segs:
            if not s.get("hit") or s["hit"][0] == "blade":
                continue
            at = s["hit"][1]
            f = F(at)
            tl_o = tls[other]
            seg_o = max((t for t in tl_o.segs if t["start"] <= f), key=lambda t: t["start"])
            d = tl_o.pose(f)[1] - tls[key].pose(f)[1]
            d.z = 0
            d = d.normalized()
            need = 0.0
            for g in range(f, min(seg_o["end"], f + int(1.5 * HZ)), 3):
                depth = S.body_overlap(world_at(actors[key], tls[key], g), world_at(actors[other], tl_o, g))[0]
                need = max(need, depth)
            if need > .03:
                seg_o["_knock"] = (f, d, min(need + .15, 1.0))
                tl_o.refresh()
                log.append(f"knock {other} back {need + .15:.2f} m after the blow @{at}")


EDITS = S.SET_FILE.with_name("letzte_wacht_edits.json")


def apply_edits(tls, log):
    """Nudges from the live editor (three.js metres/radians per segment), applied after the solver."""
    if not EDITS.exists():
        return
    edits = json.loads(EDITS.read_text(encoding="utf-8"))
    for key, segs in edits.get("actors", {}).items():
        tl = tls[key]
        for idx, e in segs.items():
            s = tl.segs[int(idx)]
            centre = tl.pose(s["start"])[1]
            if e.get("yaw"):
                S.rotate_segment(s, centre, e["yaw"])
            S.move_segment(s, Vector((e.get("dx", 0), -e.get("dz", 0), 0)))
            tl.refresh()
            log.append(f"edit {key} segment {int(idx) + 1} {s['clip']}: {e}")


def block_dir(w_def, w_att):
    """A parry: the blade across the line of attack, raised."""
    line = w_att["hips"].translation - w_def["hips"].translation
    line.z = 0
    line = line.normalized()
    perp = Vector((0, 0, 1)).cross(line)
    return (perp * .85 + Vector((0, 0, .5)) + line * .15).normalized()


def clash_point(w_def, w_att, k_def, k_att):
    """Where the blades meet: on the middle of the defender's blade held across the line of attack."""
    return w_def["grip_right"].translation + block_dir(w_def, w_att) * S.BLADE[k_def] * .5


def target_point(actors, other, w_other, kind, w_att, att_key=None):
    if kind == "blade":
        att_key = att_key or ("captain" if other == "bandit" else "bandit")
        return clash_point(w_other, w_att, other, att_key)
    return w_other["chest" if kind == "chest" else "torso"].translation + Vector((0, 0, .1))


def hit_times(tls):
    return [s["hit"][1] for k in tls for s in tls[k].segs if s.get("hit")]


def pass_set(actors, tls, boxes, log, rounds=6):
    hits = hit_times(tls)
    for key, actor in actors.items():
        other = "bandit" if key == "captain" else "captain"
        tl = tls[key]
        for s in tl.segs:
            if s.get("cycle") or s["place"] == "chain" or s.get("hit") or s.get("free"):
                continue
            group = followers(tl, s)
            for _ in range(rounds):
                push, worst = Vector((0, 0, 0)), (0.0, None, None)
                for t in group:
                    for f in seg_frames(t, 3):
                        wa = world_at(actor, tl, f)
                        depth, v, part, box = S.set_penetration(wa, boxes)
                        if depth > .02:
                            push += v * depth
                            if depth > worst[0]:
                                worst = (depth, part, box)
                        if all(abs((f - 1) / HZ - h) > .45 for h in hits) and tls[other].pose(f) is not None:
                            bd, bv = S.body_push(wa, world_at(actors[other], tls[other], f), max(x.get("clear", 0.0) for x in group))
                            if bd > .03:
                                push += bv * bd
                                if bd > worst[0]:
                                    worst = (bd, "body", other)
                if worst[0] <= .02:
                    break
                step = push.normalized() * min(worst[0] + .03, .5)
                for t in group:
                    S.move_segment(t, step)
                tl.refresh()
                log.append(f"set {key} {s['clip']} @{s['t0']:.1f}: {worst[1]} in {worst[2]} {worst[0]:.2f} m -> moved")


# ------------------------------------------------------------------ report
def intervals(frames_bad, gap=3):
    out = []
    for f in frames_bad:
        if out and f - out[-1][1] <= gap:
            out[-1][1] = f
        else:
            out.append([f, f])
    return [((a - 1) / HZ, (b - 1) / HZ) for a, b in out]


def report(actors, worlds, tls, boxes):
    issues = []
    hit_times = []
    for key in actors:
        for s in tls[key].segs:
            if s.get("hit"):
                hit_times.append(s["hit"][1])
    # set penetration and ground
    for key, actor in actors.items():
        bad, sink = {}, []
        for i, w in enumerate(worlds[key]):
            if not any(a <= i / HZ < b for a, b in VISIBLE[key]):
                continue
            depth, _, part, box = S.set_penetration(w, boxes, samples=4) if i % 2 == 0 else (0, None, None, None)
            if depth > .04:
                bad.setdefault(box, []).append((i + 1, depth, part))
            if S.lowest_point(actor, w) < -.05:
                sink.append(i + 1)
        for box, items in bad.items():
            for a, b in intervals([f for f, _, _ in items], gap=6):
                worst = max(d for f, d, _ in items if a <= (f - 1) / HZ <= b)
                parts = sorted({p for f, _, p in items if a <= (f - 1) / HZ <= b})
                issues.append({"type": "set_clip", "who": key, "t": round(a, 2), "t_end": round(b, 2), "depth": round(worst, 2),
                               "what": f"{', '.join(parts)} in {box}", "severity": "high" if worst > .12 else "medium"})
        for a, b in intervals(sink):
            issues.append({"type": "sinks", "who": key, "t": round(a, 2), "t_end": round(b, 2), "severity": "medium"})
    # the two bodies inside each other (outside the moments of a hit)
    ov = []
    for i in range(0, len(worlds["captain"]), 2):
        t = i / HZ
        if any(abs(t - h) < .35 for h in hit_times) or t < 16.5:
            continue
        depth, pa, pb = S.body_overlap(worlds["captain"][i], worlds["bandit"][i])
        if depth > .06:
            ov.append((i + 1, depth, pa, pb))
    for a, b in intervals([f for f, *_ in ov], gap=6):
        worst = max(d for f, d, *_ in ov if a <= (f - 1) / HZ <= b)
        issues.append({"type": "body_clip", "t": round(a, 2), "t_end": round(b, 2), "depth": round(worst, 2), "severity": "high" if worst > .15 else "medium"})
    # hits and facing at the beats
    for key, other in (("captain", "bandit"), ("bandit", "captain")):
        for s in tls[key].segs:
            if s.get("hit"):
                kind, at = s["hit"]
                i = F(at) - 1
                a1, a2 = S.blade(actors[key], key, worlds[key][i])
                if kind == "blade":
                    b1, b2 = S.blade(actors[other], other, worlds[other][i])
                    pa, pb = S.seg_closest(a1, a2, b1, b2)
                    dist = (pa - pb).length
                    ok = dist < .15
                else:
                    tgt = worlds[other][i]["chest" if kind == "chest" else "torso"].translation
                    dist = (S.point_seg(tgt, a1, a2) - tgt).length
                    ok = dist < .3
                issues.append({"type": "hit", "who": key, "t": at, "target": kind, "miss": round(dist, 2), "ok": ok,
                               "severity": "none" if ok else ("high" if dist > .5 else "medium")})
            if s.get("face") == "opp" and s.get("beat"):
                at = s["beat"][1]
                i = F(at) - 1
                w = worlds[key][i]
                d = worlds[other][i]["hips"].translation - w["hips"].translation
                d.z = 0
                err = abs(math.degrees(S.yaw_delta(S.chest_forward(actors[key], w), d.normalized())))
                issues.append({"type": "facing", "who": key, "t": at, "error_deg": round(err, 1),
                               "severity": "none" if err < 25 else ("high" if err > 60 else "medium")})
    return issues


# ------------------------------------------------------------------ main
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    actors = {"captain": H.Actor("captain", "cap_"), "bandit": H.Actor("bandit", "ban_")}
    bodies = {k: S.Body(a) for k, a in actors.items()}
    boxes = S.load_set()
    names = sorted({clip_name(s["clip"]) for s in BANDIT + CAPTAIN})
    clips = {n: H.load_clip(n) for n in names}
    specs = {"captain": CAPTAIN, "bandit": BANDIT}
    n = F(DURATION)
    tls = {key: FilmTimeline(actor, to_segments(specs[key], clips), clips) for key, actor in actors.items()}
    log = []
    for round_ in range(2):
        pass_face(actors, tls, log)
        pass_hit(actors, tls, boxes, log)
        pass_set(actors, tls, boxes, log)
    pass_face(actors, tls, log)
    pass_set(actors, tls, boxes, log)      # the last turn must not swing anyone into a stone
    pass_free(actors, tls, boxes, log)     # falls and kneels: search a free spot near the planned one
    pass_walk(actors, tls, boxes, log)
    apply_edits(tls, log)
    pass_knock(actors, tls, log)
    for line in log:
        print("SOLVE", line)

    data = bytearray()
    header = {"name": "Die letzte Wacht", "hz": HZ, "frames": n, "duration": DURATION, "pivots": H.ORDER + ["grip_right"],
              "actors": {}, "events": [], "clips": {k: clip_name(k) for k in {s["clip"] for s in BANDIT + CAPTAIN}}}
    worlds = {}
    frames_all = {}
    for key, actor in actors.items():
        tl = tls[key]
        frames = []
        for f in range(1, n + 1):
            q, hw = tl.pose(f)
            q = S.arms_clear(actor, bodies[key], dict(q), hw, STYLE[key]["abduct"])
            q = S.limit_head(actor, q)
            frames.append((q, hw))
        lift = S.ground_offsets(actor, frames)
        frames_all[key] = [(q, hw + Vector((0, 0, dz))) for (q, hw), dz in zip(frames, lift)]
    # blades: first every parry (independent of the attacker's blade), then every attack at its target
    hits = [(key, other, s["hit"]) for key, other in (("captain", "bandit"), ("bandit", "captain")) for s in tls[key].segs if s.get("hit")]
    pre = {k: [S.fk(actors[k], q, hw) for q, hw in fr] for k, fr in frames_all.items()}

    def blocks_for(key):
        out = []
        for att, dfn, (kind, at) in hits:
            if dfn == key and kind == "blade":
                out.append({"t": at, "kind": "block", "dir": (lambda i, a=att, d=dfn: block_dir(pre[d][i], pre[a][i]))})
        return out
    aimed = {k: S.aim_blades(actors[k], k, frames_all[k], blocks_for(k), HZ) for k in actors}
    aimed_w = {k: [S.fk(actors[k], q, hw) for q, hw in fr] for k, fr in aimed.items()}
    for key in actors:
        beats = blocks_for(key)
        for att, dfn, (kind, at) in hits:
            if att == key:
                beats.append({"t": at, "kind": "attack", "target": (lambda i, d=dfn, kd=kind, a=att: target_point(actors, d, aimed_w[d][i], kd, aimed_w[a][i]))})
        other = "bandit" if key == "captain" else "captain"
        for s in tls[key].segs:
            if s.get("aim") and s["aim"][0] == "miss":   # cut through the place the other one just left
                at = s["aim"][1]
                lag = F(at - .3) - 1
                beats.append({"t": at, "kind": "attack", "target": (lambda i, o=other, g=lag: aimed_w[o][g]["chest"].translation.copy())})
        for a0, a1 in PLANTED.get(key, []):
            for tt in range(int(a0 * 4), int(a1 * 4)):
                beats.append({"t": tt / 4, "kind": "block", "dir": (lambda i: Vector((0, 0, -1)))})
        frames_all[key] = S.aim_blades(actors[key], key, frames_all[key], beats, HZ)
        frames_all[key] = [(S.left_hand_on_hilt(actors[key], q, hw), hw) for q, hw in frames_all[key]]
    for key, actor in actors.items():
        tl = tls[key]
        frames = frames_all[key]
        root_w = actor.root.matrix_basis.copy()
        offset = len(data)
        ws = []
        for q, hips_w in frames:
            world = S.fk(actor, q, hips_w)
            for k in H.ORDER + ["grip_right"]:
                o = actor.piv[k]
                pk = o.parent.name[len(actor.prefix):].split(".")[0] if o.parent else None
                pw = world.get(pk, root_w) if pk != "root" else root_w
                L = pw.inverted() @ world[k]
                loc, rot, _ = L.decompose()
                if k == "hips":
                    data += struct.pack("<3f", loc.x, loc.z, -loc.y)  # three.js axes
                rot.normalize()
                data += struct.pack("<4h", *(int(round(max(-1, min(1, v)) * 32767)) for v in (rot.x, rot.z, -rot.y, rot.w)))
            ws.append(world)
        worlds[key] = ws
        header["actors"][key] = {"model": key, "offset": offset, "visible": VISIBLE[key], "weapon": WEAPONS[key],
                                 "segments": [{"clip": s["clip"], "t": (s["start"] - 1) / HZ, "end": (s["end"] - 1) / HZ}
                                              for s in tl.segs]}
    header["events"] = events(worlds, tls)
    issues = report(actors, worlds, tls, boxes)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "letzte_wacht.bin").write_bytes(bytes(data))
    (OUT / "letzte_wacht.json").write_text(json.dumps(header, indent=1), encoding="utf-8")
    (OUT / "letzte_wacht_report.json").write_text(json.dumps({"solver": log, "issues": issues}, indent=1, ensure_ascii=False), encoding="utf-8")
    bad = [i for i in issues if i.get("severity") in ("high", "medium")]
    for i in issues:
        if i.get("severity") != "none":
            print("ISSUE", json.dumps(i, ensure_ascii=False))
    print("BAKE_OK", n, "frames", len(data), "bytes", len(header["events"]), "events", len(bad), "issues")


def three(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


def events(worlds, tls):
    """Beats for sound and effects, placed where the blades actually meet."""
    ev = []
    for key, other in (("captain", "bandit"), ("bandit", "captain")):
        for s in tls[key].segs:
            if not s.get("hit"):
                continue
            kind, at = s["hit"]
            i = F(at) - 1
            a1, a2 = S.blade_world(worlds, key, i) if hasattr(S, "blade_world") else (None, None)
            wa = worlds[key][i]
            p = wa["grip_right"].translation
            if kind == "blade":
                ev.append({"t": at, "type": "clash", "pos": three(p.lerp(worlds[other][i]["grip_right"].translation, .5) + Vector((0, 0, .2)))})
            else:
                tgt = worlds[other][i]["chest" if kind == "chest" else "torso"].translation
                ev.append({"t": at, "type": "hit" if kind == "chest" else "kill", "who": other, "pos": three(tgt)})
    for t, kind in ((49.0 - 0.45, "whoosh"), (52.9, "whoosh"), (57.6 - 0.3, "whoosh"), (62.6 - 0.3, "whoosh"), (69.0 - 0.6, "whoosh"),
                    (37.4, "draw"), (31.6, "draw"), (72.0, "drop"), (72.9, "fall"), (93.0, "kneel"), (98.8, "rise")):
        ev.append({"t": t, "type": kind})
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
