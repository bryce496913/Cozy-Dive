"""V0.7 Pass 063: the material reference library and its swatch sheet.

    python3 tools/art/v07/template_textures.py
    python3 tools/art/v07/material_reference.py [sheet.jpg]   # Blender 5.1 Python module, Cycles CPU

Builds every material template from standards.json with cozy_art.pbr_material, using the
approved Pass 062 Crafted (B) maps where the benchmark covered the material and the Pass 063
maps for shell, metal and wood. Each sits on a standard swatch (a sphere; a thin membrane for
fins) with the vertex tint the template expects, and is saved to
tools/art/v07/reference/material-library.blend: append materials from it to start a new asset.
The sheet (default docs/art-reference/v07/material-reference.jpg) renders each swatch under the
neutral turnaround light (grey background, one key, Standard view transform).
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'tools/art/pass014'))
import cozy_art as ca  # noqa: E402
import reef_geometry as rg  # noqa: E402

TEX = ROOT / 'tools/art/textures'
SHEET = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/art-reference/v07/material-reference.jpg'
TMP = HERE / 'reference/out'
SIZE = 360

# template -> (texture stem, roughness, normal strength, tint (bottom, top) sRGB, explicit maps)
SWATCHES = {
    'fish-skin': ('p062-crafted-chromis', 0.5, 0.6, ((1, 1, 1), (1, 1, 1)),
                  {'orm': TEX / 'fish/chromis-orm.png'}),
    'fin': ('p062-crafted-chromis', 0.55, 0.5, ((1, 1, 1), (1, 1, 1)),
            {'base': TEX / 'pass062/p062-crafted-chromis-fins.png'}),
    'shell': ('p063-shell', 0.58, 0.8, ((0.92, 0.86, 0.8), (0.97, 0.93, 0.88)), None),
    'coral-tissue': ('p062-crafted-branch', 0.6, 0.7, ((0.80, 0.60, 0.38), (0.98, 0.93, 0.80)), None),
    'limestone': ('p062-crafted-rock', 0.86, 0.8, ((0.86, 0.83, 0.79), (1.0, 0.97, 0.92)), None),
    'sand': ('sand', 0.95, 0.9, ((0.70, 0.64, 0.53), (0.74, 0.68, 0.57)), None),
    'plant': ('p062-crafted-grass', 0.52, 0.5, ((0.22, 0.40, 0.24), (0.50, 0.68, 0.34)), None),
    'metal': ('p063-metal', 0.7, 0.8, ((1, 1, 1), (1, 1, 1)), None),
    'wood': ('p063-wood', 0.82, 0.8, ((1, 1, 1), (1, 1, 1)), None),
}


def swatch(name, kind, material, tint, x):
    if kind == 'fin':
        # A membrane fan: thin, double sided, alpha from the fin map.
        rows, cols = 12, 24
        a = np.linspace(-1.0, 1.0, cols)
        r = np.linspace(0.05, 0.62, rows)
        rr, aa = np.meshgrid(r, a, indexing='ij')
        p = np.stack([np.sin(aa) * rr, np.cos(aa) * rr * 0.9 - 0.25, np.zeros_like(rr) + 0.02 * np.sin(rr * 9)],
                     -1).reshape(-1, 3)
        uv = np.stack([(aa.ravel() + 1) / 2, rr.ravel() / 0.62], 1)
        f = []
        for i in range(rows - 1):
            for j in range(cols - 1):
                k = i * cols + j
                f += [(k, k + cols, k + 1), (k + 1, k + cols, k + cols + 1)]
        f = np.array(f)
    else:
        d, f = rg.icosphere(5)
        p = d * 0.5
        uv = np.stack([np.arctan2(d[:, 2], d[:, 0]) / math.tau + 0.5, d[:, 1] * 0.5 + 0.5], 1) * [2, 1]
    t = np.clip((p[:, 1] + 0.5), 0, 1)[:, None]
    col = np.asarray(tint[0]) * (1 - t) + np.asarray(tint[1]) * t
    o = ca.mesh_from_arrays(name, p, f, uv, col, material, None)
    o.location = (x, 0, 0.5)
    return o


def main():
    ca.reset_scene()
    scene = bpy.context.scene
    objects = {}
    for i, (kind, (stem, rough, strength, tint, paths)) in enumerate(SWATCHES.items()):
        label = ''.join(w.capitalize() for w in kind.split('-'))
        m = ca.pbr_material(f'Ref_{label}', kind, stem, roughness=rough, normal_strength=strength, paths=paths)
        objects[kind] = swatch(f'Swatch_{label}', kind, m, tint, i * 1.4)
    ca.save_blend(HERE / 'reference/material-library.blend')
    # Neutral render setup (as tools/art/pass062/turnaround.py).
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Neutral')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.22, 0.22, 0.22, 1)
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.lens = 70
    scene.collection.objects.link(cam)
    scene.camera = cam
    TMP.mkdir(parents=True, exist_ok=True)
    files = []
    for kind, o in objects.items():
        for other in objects.values():
            other.hide_render = other is not o
        centre = Vector((o.location.x, 0, 0.5))
        cam.location = centre + Vector((0.9, -2.2, 0.75))
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = TMP / f'{kind}.png'
        scene.render.filepath = str(f)
        bpy.ops.render.render(write_still=True)
        files.append((kind, f))
    cols = 3
    rows = math.ceil(len(files) / cols)
    sheet = Image.new('RGB', (SIZE * cols, (SIZE + 54) * rows), (34, 34, 34))
    draw = ImageDraw.Draw(sheet)
    for i, (kind, f) in enumerate(files):
        x, y = (i % cols) * SIZE, (i // cols) * (SIZE + 54)
        sheet.paste(Image.open(f).convert('RGB'), (x, y))
        t = ca.template(kind)
        _, rough, strength, _, _ = SWATCHES[kind]
        draw.text((x + 10, y + SIZE + 6), kind, fill=(240, 240, 240))
        draw.text((x + 10, y + SIZE + 22),
                  f'roughness {rough} ({t["roughness"][0]}-{t["roughness"][1]}) · normal {strength}',
                  fill=(200, 200, 200))
        draw.text((x + 10, y + SIZE + 36),
                  f'{t["alpha"].lower()} · {"double" if t["doubleSided"] else "single"} sided · {t["tier"]} tier',
                  fill=(200, 200, 200))
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET, quality=88)
    print('sheet', SHEET)


if __name__ == '__main__':
    main()
