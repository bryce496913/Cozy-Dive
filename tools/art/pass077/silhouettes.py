"""V0.7 Pass 077: render branching-coral colonies on a plain background (Blender Workbench).

    python3 tools/art/pass077/silhouettes.py <reef_geometry dir> <out-dir>

Builds the three branching colonies with the `reef_geometry` module found in the given directory
(the current one, or an older checkout of it for "before" views), and renders each (near level
plus tips) from the side and at three-quarter view, shaded by its vertex colour, plus a dark
silhouette, on a plain backdrop with one shared camera scale so colonies compare at true size.
"""
import importlib
import math
import sys
from pathlib import Path

import bpy

src, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(src))
sys.path.insert(0, str(Path(__file__).resolve().parent))
rg = importlib.import_module('reef_geometry')
bpy.ops.wm.read_factory_settings(use_empty=True)
forms = [f for f in rg.BASELINE['formations'] if f['kind'] == 'branching']
names = []
for i, f in enumerate(forms):
    asset = rg.branching_coral(f, i)
    names.append(asset.name)
    for m in asset.meshes:
        if m.name.endswith('_LOD1'):
            continue
        g = bpy.data.meshes.new(m.name)
        g.from_pydata([(p[0], -p[2], p[1]) for p in m.positions], [], [tuple(x) for x in m.faces])
        col = g.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        col.data.foreach_set('color', [float(c) for c in m.colors.ravel()])
        for poly in g.polygons:
            poly.use_smooth = True
        o = bpy.data.objects.new(m.name, g)
        bpy.context.scene.collection.objects.link(o)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 560
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Plain')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.77, 0.8, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
scene.collection.objects.link(sun)
shaded = bpy.data.materials.new('Shaded')
shaded.use_nodes = True
attr = shaded.node_tree.nodes.new('ShaderNodeAttribute')
attr.attribute_name = 'Col'
bsdf = shaded.node_tree.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.8
shaded.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
flat = bpy.data.materials.new('Silhouette')
flat.use_nodes = True
flat.node_tree.nodes.remove(flat.node_tree.nodes['Principled BSDF'])
emit = flat.node_tree.nodes.new('ShaderNodeEmission')
emit.inputs['Color'].default_value = (0.03, 0.035, 0.045, 1)
flat.node_tree.links.new(emit.outputs[0], flat.node_tree.nodes['Material Output'].inputs['Surface'])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.5
meshes = [o for o in scene.objects if o.type == 'MESH']
for name in names:
    keep = {name, name + '_Tips'}
    for o in meshes:
        o.hide_render = o.name not in keep
    for shade, material in (('colour', shaded), ('silhouette', flat)):
        for o in meshes:
            o.data.materials.clear()
            o.data.materials.append(material)
        for view, yaw, pitch in (('side', 0, 0.05), ('three-quarter', 0.7, 0.4)):
            if shade == 'silhouette' and view != 'side':
                continue
            d = 6
            cam.location = (math.sin(yaw) * math.cos(pitch) * d, -math.cos(yaw) * math.cos(pitch) * d,
                            0.8 + math.sin(pitch) * d)
            cam.rotation_euler = (math.pi / 2 - pitch, 0, yaw)
            scene.render.filepath = str(out / f'{name}-{shade}-{view}.png')
            bpy.ops.render.render(write_still=True)
print('rendered', names)
