"""Pass 109: make editable Blender 4.3 source files from the current shipping creature GLBs.

Run with:
  blender --background --factory-startup --python tools/art/pass109/import_shipping_models.py

Every result is an actual `.blend` source with opaque PBR materials and the original root/node
names and morph targets retained. It is intentionally an import/preparation step: individual
species are then edited in Blender, exported, and reviewed before replacing the shipping GLB.
"""
from pathlib import Path
import subprocess
import tempfile
import bpy

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / 'public/assets/models'
OUT = ROOT / 'tools/art/pass109/sources'

FILES = [
    *[MODELS / 'fish' / f'{name}.glb' for name in ('firefish', 'parrotfish')],
    *[MODELS / 'creatures' / f'{name}.glb' for name in (
        'anchored-life', 'reef-shark', 'whitetip-shark', 'leopard-shark', 'nurse-shark',
        'hammerhead', 'whale-shark', 'eagle-ray', 'manta-ray', 'sea-turtle', 'ocean-sunfish',
        'humpback-whale', 'harbour-seal', 'sea-lion', 'weddell-seal', 'leopard-seal',
        'emperor-penguin', 'adelie-penguin', 'killer-whale', 'polar-bear', 'kelp-minis',
        'ice-minis',
    )],
]


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(datablocks):
            if item.users == 0:
                datablocks.remove(item)


def opaque_materials():
    for material in bpy.data.materials:
        material.use_nodes = True
        material.surface_render_method = 'DITHERED'
        node = material.node_tree.nodes.get('Principled BSDF')
        if node:
            node.inputs['Alpha'].default_value = 1.0


OUT.mkdir(parents=True, exist_ok=True)
for source in FILES:
    if not source.exists():
        raise FileNotFoundError(source)
    clear()
    with tempfile.TemporaryDirectory() as temporary:
        imported = Path(temporary) / source.name
        subprocess.run(
            ['node', str(ROOT / 'tools/art/pass109/strip_unsupported_textures.mjs'), str(source), str(imported)],
            check=True,
        )
        bpy.ops.import_scene.gltf(filepath=str(imported))
    opaque_materials()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{source.stem}.blend'))
