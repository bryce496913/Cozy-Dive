"""V0.8 Pass 083: quick Cycles previews of the habitat formations (coarse, for judging forms).

    python3 tools/art/pass083/preview.py <out-dir> <pickle of {name: (v, f[, c])}> [views...]

Not a game capture: the game captures (validation/v07/baseline.mjs, COZY_AQUA=1) are the judge.
"""
import math
import pickle
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[0] / 'v07'))
import cozy_art as ca  # noqa: E402

VIEWS = {
    'aqua-overview': ([0, 6.5, 12.5], [0, 1.2, -4]),
    'aqua-high': ([0, 12.6, 12.8], [0, 0, -3]),
    'aqua-left-bank': ([1.5, 4.5, 6.5], [-11, 1.2, -5]),
    'aqua-right-bank': ([-1.5, 4.5, 6.5], [10.5, 1.2, -5]),
    'aqua-back-left': ([-5.5, 3.6, -1.5], [-13, 1.2, -9.5]),
    'aqua-back-right': ([3.2, 4.2, 0.5], [11, 1.5, -8.5]),
    'top': ([0, 40, 0.01], [0, 0, 0]),
}


def material(name, rough, colour=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    if colour is None:
        attr = nt.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*colour, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return m


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    parts = pickle.loads(Path(sys.argv[2]).read_bytes())
    views = sys.argv[3:] or list(VIEWS)
    ca.reset_scene()
    import habitat as hb  # noqa: PLC0415
    grey = material('rock', 0.9, (0.55, 0.52, 0.47))
    vc = material('vc', 0.8)
    for name, part in parts.items():
        v, f = part[0], part[1]
        col = part[2][:, :3] if len(part) > 2 else np.tile([0.55, 0.52, 0.47], (len(v), 1))
        ca.mesh_from_arrays(name, v, f, np.zeros((len(v), 2)), col, vc if len(part) > 2 else grey, None)
    # Seabed.
    xs, zs = np.arange(-18, 18.01, 0.25), np.arange(-14, 14.01, 0.25)
    X, Z = np.meshgrid(xs, zs, indexing='ij')
    Y = hb.SAND(np.stack([X.ravel(), Z.ravel()], 1))
    v = np.stack([X.ravel(), Y, Z.ravel()], 1)
    nx, nz = len(xs), len(zs)
    f = []
    for i in range(nx - 1):
        for j in range(nz - 1):
            a = i * nz + j
            f += [(a, a + 1, a + nz + 1), (a, a + nz + 1, a + nz)]
    ca.mesh_from_arrays('Sand', v, np.array(f), np.zeros((len(v), 2)), np.tile([0.82, 0.76, 0.62], (len(v), 1)),
                        material('sand', 0.95, (0.82, 0.76, 0.62)), None)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
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
        cam.data.angle = math.radians(40 if name == 'top' else 60)
        cam.rotation_euler = (t - e).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'{name}.png')
        bpy.ops.render.render(write_still=True)
    print('previewed', views)


main()
