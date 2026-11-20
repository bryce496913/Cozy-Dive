"""Pass 062: neutral Blender turnarounds of every benchmark subject in all three treatments.

    python3 tools/art/pass062/turnaround.py [output-dir]   # Blender 5.1 Python module, Cycles CPU

Each subject is framed by its own bounding sphere and rendered from four azimuths at 18 degrees
elevation, on a mid-grey background with one key light and an even grey world (Standard view
transform, no water, fog or tone mapping), so shape and material read without the game's lighting.
Sources are the uncompressed authoring files (Blender cannot import KTX2): the Pass 014 reef
.blend and the accepted fish for the baseline, tools/art/pass062/out/*.glb for A and B.
Writes <output-dir>/turnaround-<subject>.png: rows baseline / natural (A) / crafted (B).
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/screenshots/v07-pass062'
TMP = HERE / 'out/turnaround'
SIZE = 320
AZIMUTHS = (30, 120, 210, 300)
TREATMENTS = ('baseline', 'natural', 'crafted')
LABELS = {'baseline': 'Baseline (shipped)', 'natural': 'A: Natural Realism', 'crafted': 'B: Crafted Stylized'}

SOURCES = {
    'baseline-reef': ('blend', ROOT / 'tools/art/pass014/reef-environment.blend'),
    'baseline-chromis': ('glb', ROOT / 'tools/art/pass017/accepted/chromis.glb'),
    'baseline-clownfish': ('glb', ROOT / 'tools/art/pass017/accepted/clownfish.glb'),
    'natural': ('glb', HERE / 'out/style-natural.glb'),
    'crafted': ('glb', HERE / 'out/style-crafted.glb'),
    'natural-chromis': ('glb', HERE / 'out/natural-chromis.glb'),
    'natural-clownfish': ('glb', HERE / 'out/natural-clownfish.glb'),
    'crafted-chromis': ('glb', HERE / 'out/crafted-chromis.glb'),
    'crafted-clownfish': ('glb', HERE / 'out/crafted-clownfish.glb'),
}
# subject -> treatment -> (source, mesh object names; None = every mesh)
SUBJECTS = {
    'rock': {'baseline': ('baseline-reef', ['Rock_0']), 'natural': ('natural', ['Rock']),
             'crafted': ('crafted', ['Rock'])},
    'brain': {'baseline': ('baseline-reef', ['Coral_Massive_0']), 'natural': ('natural', ['Coral_Brain']),
              'crafted': ('crafted', ['Coral_Brain'])},
    'branching': {'baseline': ('baseline-reef', ['Coral_Branching_0', 'Coral_Branching_0_Tips']),
                  'natural': ('natural', ['Coral_Branching']), 'crafted': ('crafted', ['Coral_Branching'])},
    'seagrass': {'baseline': ('baseline-reef', ['Turtle_Grass_0']), 'natural': ('natural', ['Seagrass_0']),
                 'crafted': ('crafted', ['Seagrass_0'])},
    'chromis': {'baseline': ('baseline-chromis', None), 'natural': ('natural-chromis', None),
                'crafted': ('crafted-chromis', None)},
    'clownfish': {'baseline': ('baseline-clownfish', None), 'natural': ('natural-clownfish', None),
                  'crafted': ('crafted-clownfish', None)},
}


def load(kind, path):
    if kind == 'blend':
        bpy.ops.wm.open_mainfile(filepath=str(path))
        # The Pass 014 library references its authoring PNGs by relative path: resolve by name.
        pngs = {f.name: f for f in (ROOT / 'tools/art/textures').rglob('*.png')}
        for image in bpy.data.images:
            if image.source == 'FILE' and not image.packed_file and image.name in pngs:
                image.filepath = str(pngs[image.name])
                image.reload()
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Neutral') if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.22, 0.22, 0.22, 1)
    bg.inputs['Strength'].default_value = 1.0
    for o in list(scene.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o)
    sun = bpy.data.objects.new('Key', bpy.data.lights.new('Key', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-35))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def render(scene, cam, names, stem):
    meshes = [o for o in scene.objects if o.type == 'MESH']
    chosen = [o for o in meshes if (names is None and not o.name.endswith('_LOD1') and 'LOD' not in o.name)
              or (names is not None and o.name in names)]
    if not chosen:
        raise SystemExit(f'{stem}: none of {names} found')
    for o in meshes:
        o.hide_render = o not in chosen
    pts = [o.matrix_world @ Vector(c) for o in chosen for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, radius = (lo + hi) / 2, (hi - lo).length / 2
    distance = radius / math.tan(cam.data.angle / 2) * 1.08
    files = []
    for az in AZIMUTHS:
        a, e = math.radians(az), math.radians(18)
        cam.location = centre + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * distance
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = TMP / f'{stem}-{az}.png'
        scene.render.filepath = str(f)
        bpy.ops.render.render(write_still=True)
        files.append(f)
    tris = sum(len(o.data.loop_triangles) if o.data.loop_triangles else 0 for o in chosen)
    return files, tris


def main():
    TMP.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    needed = {}
    for subject, rows in SUBJECTS.items():
        for treatment, (source, names) in rows.items():
            needed.setdefault(source, []).append((subject, treatment, names))
    done = {}
    for source, jobs in needed.items():
        scene, cam = load(*SOURCES[source])
        for o in scene.objects:
            if o.type == 'MESH':
                o.data.calc_loop_triangles()
        for subject, treatment, names in jobs:
            done[(subject, treatment)] = render(scene, cam, names, f'{subject}-{treatment}')
            print('rendered', subject, treatment, done[(subject, treatment)][1], 'triangles')
    for subject in SUBJECTS:
        label_w = 170
        sheet = Image.new('RGB', (label_w + SIZE * len(AZIMUTHS), SIZE * len(TREATMENTS)), (40, 40, 40))
        draw = ImageDraw.Draw(sheet)
        for r, treatment in enumerate(TREATMENTS):
            files, tris = done[(subject, treatment)]
            for c, f in enumerate(files):
                sheet.paste(Image.open(f).convert('RGB'), (label_w + c * SIZE, r * SIZE))
            draw.text((10, r * SIZE + 12), LABELS[treatment], fill=(235, 235, 235))
            draw.text((10, r * SIZE + 30), f'{subject}', fill=(190, 190, 190))
            draw.text((10, r * SIZE + 48), f'{tris:,} triangles', fill=(190, 190, 190))
        sheet.save(OUT / f'turnaround-{subject}.png', optimize=True)
        print('sheet', OUT / f'turnaround-{subject}.png')


if __name__ == '__main__':
    main()
