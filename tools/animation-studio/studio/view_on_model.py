"""Render a clip on a real skinned character (both Mixamo-named), following camera, textured.

  blender -b --factory-startup --python studio/view_on_model.py -- character.glb clip.glb out.png [frames=8] [view=three]
Prints the rest-pose mismatch between the two skeletons (should be ~0 for clips from the studio's retarget).
"""
import math
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
count = int(a[3]) if len(a) > 3 else 8
view = a[4] if len(a) > 4 else "three"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
char = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
for o in list(bpy.context.scene.objects):
    o.select_set(False)
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=a[1])
clip_objs = [o for o in bpy.context.scene.objects if o not in before]
clip = next(o for o in clip_objs if o.type == "ARMATURE")
act = clip.animation_data.action

# rest-pose check: local bone matrices should match for name-based playback in three.js
worst = 0.0
for b in clip.data.bones:
    cb = char.data.bones.get(b.name)
    if cb:
        q1 = b.matrix_local.to_quaternion()
        q2 = cb.matrix_local.to_quaternion()
        ang = math.degrees(q1.rotation_difference(q2).angle)
        worst = max(worst, min(ang, 360 - ang))
print("REST_DIFF_DEG", round(worst, 2))

char.animation_data_create()
for tr in list(char.animation_data.nla_tracks):      # the model's own clips sit in NLA tracks
    char.animation_data.nla_tracks.remove(tr)
char.animation_data.action = act
if hasattr(char.animation_data, "action_slot") and len(getattr(act, "slots", [])):     # Blender 4.4+: slotted actions
    char.animation_data.action_slot = act.slots[0]
for o in clip_objs:
    bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
f0, f1 = (int(x) for x in act.frame_range)
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 420, 480
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (.32, .34, .37, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sc.collection.objects.link(sun)
floor = bpy.data.meshes.new("floor"); floor.from_pydata([(-30, -30, 0), (30, -30, 0), (30, 30, 0), (-30, 30, 0)], [], [(0, 1, 2, 3)])
fo = bpy.data.objects.new("floor", floor); sc.collection.objects.link(fo)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 40
d = {"side": Vector((1, 0, 0)), "front": Vector((0, -1, 0)), "three": Vector((1, -1, 0)).normalized()}[view]
hips = char.pose.bones["mixamorig:Hips"]
for i in range(count):
    f = round(f0 + (f1 - f0) * i / max(1, count - 1))
    sc.frame_set(f)
    h = char.matrix_world @ hips.head
    tgt = Vector((h.x, h.y, .75))
    cam.location = tgt + d * 4.2 + Vector((0, 0, .5))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = a[2].replace(".png", f"_{i}.png")
    bpy.ops.render.render(write_still=True)
print("VIEW_ON_MODEL", f0, f1)
