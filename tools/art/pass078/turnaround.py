"""V0.7 Pass 078: side, three-quarter, head close-up and stroke-pose renders of a creature `.blend`.

    python3 tools/art/pass078/turnaround.py <creature.blend> <out-dir> <label>

Renders the `Body` mesh (not its distance level) with its authored skin on a neutral underwater
backdrop (Blender Cycles, CPU), framed from its own bounds (+X head, as the creature builder
authors them). The pose view sets the `Stroke_Left` morph to 1.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
src, out, label = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(src))
pngs = {f.name: f for f in (ROOT / 'tools/art/textures').rglob('*.png')}
for image in bpy.data.images:
    if image.source == 'FILE' and not image.packed_file:
        name = Path(bpy.path.abspath(image.filepath)).name or image.name
        if name in pngs:
            image.filepath = str(pngs[name])
            image.reload()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 800, 560
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Backdrop')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.3, 0.38, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
for o in list(scene.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o)
for name, energy, rot in (('Key', 3.0, (35, 10, -30)), ('Fill', 0.9, (110, 0, 150))):
    sun = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
    sun.data.energy = energy
    sun.rotation_euler = tuple(math.radians(a) for a in rot)
    scene.collection.objects.link(sun)
body = next(o for o in scene.objects if o.type == 'MESH' and o.name == 'Body')
for o in scene.objects:
    if o.type == 'MESH':
        o.hide_render = o is not body
pts = [body.matrix_world @ Vector(c) for c in body.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre, size = (lo + hi) / 2, (hi - lo)
length = max(size.x, size.y, size.z)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 60
scene.collection.objects.link(cam)
scene.camera = cam
# Blender space: game +X head = Blender +X, game +Y up = Blender +Z, game +Z left = Blender -Y.
head = Vector((hi.x - length * 0.12, centre.y, centre.z))


def shoot(name, at, distance, yaw, pitch, pose=0.0):
    keys = body.data.shape_keys
    if keys:
        for kb in keys.key_blocks[1:]:
            kb.value = pose if kb.name == 'Stroke_Left' else 0.0
    d = Vector((math.cos(pitch) * math.cos(yaw), -math.cos(pitch) * math.sin(yaw), math.sin(pitch)))
    cam.location = at + d * distance
    cam.rotation_euler = (at - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / f'{label}-{name}.png')
    bpy.ops.render.render(write_still=True)


shoot('side', centre, length * 1.9, math.pi / 2, 0.05)
shoot('three-quarter', centre, length * 1.9, 0.9, 0.3)
shoot('close-up', head, length * 0.8, 0.55, 0.15)
shoot('pose', centre, length * 1.9, 1.2, 0.45, pose=1.0)
print('rendered', label)
