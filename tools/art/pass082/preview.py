"""V0.8 Pass 082: quick Cycles previews of the benchmark section from the benchmark cameras.

    python3 tools/art/pass082/preview.py <out-dir> [views...]

Renders the composed reef (and, once built, its life) over the accepted seabed, in a neutral
underwater light, so forms can be judged before they go into the game. Not a game capture.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[0] / 'v07'))
import cozy_art as ca  # noqa: E402
import reef_benchmark as rb  # noqa: E402

VIEWS = {
    'bench-swim': ([-1.0, 3.0, -7.5], [-6.5, 1.2, 0.8]),
    'bench-swim-channel': ([1.2, 3.4, 5.2], [-6.2, 1.4, 0.2]),
    'bench-medium': ([-2.4, 2.6, -2.6], [-6.3, 1.4, 0.6]),
    'bench-medium-ridge': ([-3.2, 3.6, 4.6], [-7.6, 1.6, 1.4]),
    'bench-close-coral': ([-4.2, 2.6, -1.2], [-5.6, 2.0, -0.1]),
    'bench-close-rock': ([-2.9, 1.3, 1.5], [-4.6, 0.8, 0.4]),
    'bench-close-bommie': ([-3.8, 1.9, -6.8], [-5.6, 1.0, -5.4]),
}


def material(name, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    return m


def add(name, v, f, col, mat):
    uv = np.zeros((len(v), 2))
    return ca.mesh_from_arrays(name, v, f, uv, col, mat, None)


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    views = sys.argv[2:] or list(VIEWS)
    ca.reset_scene()
    import build  # noqa: PLC0415
    parts = build.build_meshes(preview=True)
    mats = {}
    for name, (v, f, col, rough) in parts.items():
        mats.setdefault(rough, material(f'm{rough}', rough))
        add(name, v, f, col, mats[rough])
    # The accepted seabed.
    s = rb._sand
    xs, zs = np.unique(s[:, 0]), np.unique(s[:, 1])
    nx, nz = len(xs), len(zs)
    v = np.stack([s[:, 0], s[:, 2], s[:, 1]], 1)
    f = []
    for i in range(nx - 1):
        for j in range(nz - 1):
            a = i * nz + j
            f += [(a, a + 1, a + nz + 1), (a, a + nz + 1, a + nz)]
    add('Sand', v, np.array(f), np.tile([0.82, 0.76, 0.62], (len(v), 1)), material('sand', 0.95))
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 960, 600
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Water')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.12, 0.3, 0.36, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    for name, energy, rot, colour in (('Key', 3.2, (30, 8, -40), (1, 0.95, 0.85)),
                                      ('Rim', 1.0, (115, 0, 140), (0.7, 0.85, 1))):
        sun = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
        sun.data.energy = energy
        sun.data.color = colour
        sun.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle = math.radians(60)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name in views:
        eye, target = VIEWS[name]
        e = Vector(ca.to_blender(np.array([eye]))[0])
        t = Vector(ca.to_blender(np.array([target]))[0])
        cam.location = e
        cam.rotation_euler = (t - e).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'{name}.png')
        bpy.ops.render.render(write_still=True)
    print('previewed', views)


main()
