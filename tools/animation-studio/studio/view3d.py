"""Turntable contact sheet of a GLB (4 views) with Blender:  blender -b -P studio/view3d.py -- model.glb out.png"""
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ mathutils.Vector(c) for o in objs for c in o.bound_box]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
c = (lo + hi) / 2; r = (hi - lo).length / 2
faces = sum(len(o.data.polygons) for o in objs)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 640; sc.render.film_transparent = False
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (.35, .37, .4, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.2
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
outs = []
for i, yaw in enumerate([30, 120, 210, 300]):
    d = r * 3.2; ang = math.radians(yaw)
    cam.location = c + mathutils.Vector((math.sin(ang) * d, -math.cos(ang) * d, r * 0.9))
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = a[1].replace(".png", f"_{i}.png"); bpy.ops.render.render(write_still=True); outs.append(sc.render.filepath)
print("VIEW3D", faces, "faces", [round(x, 2) for x in (hi - lo)], "size")
