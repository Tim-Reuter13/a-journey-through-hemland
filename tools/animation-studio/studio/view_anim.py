"""Filmstrip of an animated humanoid GLB as a solid stick figure (bones become boxes), side and front view.

  blender -b --factory-startup --python studio/view_anim.py -- clip.glb out.png [frames=8]
"""
import math
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
count = int(a[2]) if len(a) > 2 else 8
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
sc = bpy.context.scene
act = arm.animation_data.action
f0, f1 = (int(x) for x in act.frame_range)

mat = bpy.data.materials.new("bone")
mat.diffuse_color = (.85, .55, .3, 1)
for b in arm.data.bones:
    if any(k in b.name for k in ("Thumb", "Index", "Middle", "Ring", "Pinky")):
        continue
    bpy.ops.mesh.primitive_cube_add(size=1)
    c = bpy.context.object
    w = .09 if any(k in b.name for k in ("Spine", "Hips", "Head")) else .05
    c.scale = (w, b.length, w)
    c.data.materials.append(mat)
    c.parent, c.parent_type, c.parent_bone = arm, "BONE", b.name
    c.location = (0, -b.length / 2, 0)        # bone parenting sits at the tail; move back to the middle
floor = bpy.data.meshes.new("floor")
floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
fo = bpy.data.objects.new("floor", floor)
sc.collection.objects.link(fo)
gm = bpy.data.materials.new("floor"); gm.diffuse_color = (.25, .27, .3, 1); floor.materials.append(gm)

sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_shadows = True
sc.render.resolution_x, sc.render.resolution_y = 360, 420
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 3.6

# centre of the whole move
pts = []
for f in range(f0, f1 + 1, 3):
    sc.frame_set(f)
    pts.append(arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head)
mid = sum(pts, Vector()) / len(pts)
span = max((p - mid).length for p in pts)
cam.data.ortho_scale = max(3.0, 2 * span + 2.4)
outs = []
VIEWS = {"side": Vector((1, 0, 0)), "front": Vector((0, -1, 0)), "three": Vector((1, -1, 0)).normalized()}
for view, d in ((v, VIEWS[v]) for v in (a[3].split(",") if len(a) > 3 else ("side", "front"))):
    for i in range(count):
        f = round(f0 + (f1 - f0) * i / (count - 1))
        sc.frame_set(f)
        h = arm.matrix_world @ arm.pose.bones["mixamorig:Hips"].head      # follow the hips, fixed zoom
        cam.data.ortho_scale = 2.8
        cam.location = Vector((h.x, h.y, .8)) + d * 8
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        path = a[1].replace(".png", f"_{view}_{i}.png")
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        outs.append(path)
print("VIEW_ANIM", f0, f1, outs[0])
