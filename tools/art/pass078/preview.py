"""V0.7 Pass 078: turnaround and pose renders of the anchored creatures (Blender Cycles, CPU).

    python3 tools/art/pass078/preview.py <source.blend|.glb> <creature> <out-dir> [label]

Assembles a creature's parts exactly as its runtime controller does (pivots and offsets) and
renders it on a neutral backdrop from the side, at three-quarter, as a head close-up, and in an
animation pose (the controller's extreme: tail gripped, fins beating, jaw open...). The Pass 015
library `.blend` gives "before" views with its original textures; the new uncompressed exports
give "after" views.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

ROOT = Path(__file__).resolve().parents[2]
src, creature, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
label = sys.argv[4] if len(sys.argv) > 4 else ''
out.mkdir(parents=True, exist_ok=True)

#: Controller assembly per creature: node -> (pivot in game space, pose rotation (x, y, z) radians).
ASSEMBLY = {
    'seahorse': {
        'HorseBody': ((0, 0, 0), (0, 0, 0)),
        'HorseTail': ((0, 0.33, 0), (0, 0, 0)),
        'HorseDorsal': ((0, 0.59, -0.14), (0, 0.18, 0)),
        'HorseLeftFin': ((0.045, 0.97, 0.02), (0, 0.14, 0)),
        'HorseRightFin': ((-0.045, 0.97, 0.02), (0, -0.14, 0)),
    },
    'frogfish': {
        'FrogBody': ((0, 0, 0), (0, 0, 0)),
        'FrogFoot': ((0, 0, 0), (0, 0, 0)),
    },
    'moray': {
        'MorayBody': ((0, 0, 0), (0, 0, 0)),
        'MorayDorsal': ((0, 0, 0), (0, 0, 0)),
        'MorayHead': ((0, 0, 0), (0, 0, 0)),
        'MorayJaw': ((0, 0, 0), (0, 0, 0)),
    },
}
#: Camera framing per creature: (target in game space, distance, close-up target, close distance).
FRAMING = {
    'seahorse': ((0, 0.62, 0.05), 2.3, (0, 1.0, 0.13), 0.75),
    'frogfish': ((0, 0.3, -0.05), 1.9, (0, 0.38, 0.22), 0.8),
    'moray': ((0, 0.05, 0.5), 2.8, (0, 0.05, 0.15), 1.1),
}


def game(v):
    return Vector((v[0], -v[2], v[1]))


def load():
    if src.suffix == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(src))
        # Resolve authoring textures by file name (the library references them relatively).
        pngs = {f.name: f for f in (ROOT / 'tools/art/textures').rglob('*.png')}
        for image in bpy.data.images:
            if image.source != 'FILE' or image.packed_file:
                continue
            name = Path(bpy.path.abspath(image.filepath)).name or image.name
            if name in pngs:
                image.filepath = str(pngs[name])
                image.reload()
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(src))


load()
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 720, 720
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Backdrop')
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.13, 0.27, 0.33, 1)
bg.inputs['Strength'].default_value = 0.8
for o in list(scene.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o)
key = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
key.data.energy = 3.2
key.rotation_euler = (math.radians(35), math.radians(10), math.radians(-30))
scene.collection.objects.link(key)
fill = bpy.data.objects.new('Fill', bpy.data.lights.new('Fill', 'SUN'))
fill.data.energy = 0.8
fill.rotation_euler = (math.radians(110), 0, math.radians(150))
scene.collection.objects.link(fill)

parts = ASSEMBLY[creature]
shown = []
for o in scene.objects:
    if o.type != 'MESH':
        continue
    if o.name in parts:
        pivot, _ = parts[o.name]
        o.parent = None
        o.matrix_world.identity()
        o.location = game(pivot)
        o.hide_render = False
        shown.append(o)
    else:
        o.hide_render = True
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.lens = 70
scene.collection.objects.link(cam)
scene.camera = cam
target, distance, close, close_d = FRAMING[creature]


def shoot(name, at, d, yaw, pitch, pose=False):
    for o in shown:
        rx, ry, rz = parts[o.name][1] if pose else (0, 0, 0)
        o.rotation_euler = Euler((rx, -rz, ry))
        if creature == 'seahorse' and o.name == 'HorseTail':
            o.scale = (1, 1 - 0.06 * pose, 1 - 0.04 * pose)
    t = game(at)
    off = game((math.sin(yaw) * math.cos(pitch) * d, math.sin(pitch) * d, math.cos(yaw) * math.cos(pitch) * d))
    cam.location = t + off
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / f'{creature}-{name}.png')
    bpy.ops.render.render(write_still=True)


shoot('side', target, distance, math.pi / 2, 0.05)
shoot('three-quarter', target, distance, 0.75, 0.25)
shoot('close-up', close, close_d, 0.9, 0.15)
shoot('pose', target, distance, 1.2, 0.35, pose=True)
print('rendered', creature, label, [o.name for o in shown])
