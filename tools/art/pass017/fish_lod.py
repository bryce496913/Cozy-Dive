"""Pass 017: add a distance level to every authored fish library.

    python3 tools/art/pass017/fish_lod.py   # Blender 5.1 Python module, before compress.mjs

For each species the full rig (LOD0, untouched) gains `Body_LOD1`, `Median_Fins_LOD1` and
`Eyes_Gills_Mouth_LOD1`: collapse-decimated copies (~1.8k triangles in total, versus 12.7k)
whose Stroke_Left / Stroke_Right morph targets are transferred from the nearest full-rig vertex,
so distant fish still beat their tails. Pectoral fins are omitted at distance (sub-pixel there).
Inputs: the pinned accepted chromis / clownfish and the Pass 016 species built from that chromis.
"""
import sys
from pathlib import Path

import bpy  # noqa: I001
import numpy as np
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FISH = ROOT / 'public/assets/models/fish'
SOURCES = {
    'chromis': HERE / 'accepted/chromis.glb',
    'clownfish': HERE / 'accepted/clownfish.glb',
    'cardinalfish': FISH / 'cardinalfish.glb',
    'firefish': FISH / 'firefish.glb',
    'assessor': FISH / 'assessor.glb',
    'gramma': FISH / 'gramma.glb',
}
RATIOS = {'Body': 0.16, 'Median_Fins': 0.2, 'Eyes_Gills_Mouth': 0.1}


def co(data):
    a = np.empty(len(data) * 3)
    data.foreach_get('co', a)
    return a.reshape(-1, 3)


def lod(obj):
    src = obj.data
    basis = co(src.vertices)
    keys = {kb.name: co(kb.data) for kb in src.shape_keys.key_blocks} if src.shape_keys else {}
    dup = obj.copy()
    dup.data = src.copy()
    dup.name = f'{obj.name}_LOD1'
    dup.data.name = dup.name
    bpy.context.collection.objects.link(dup)
    if dup.data.shape_keys:
        dup.shape_key_clear()
    mod = dup.modifiers.new('Distance level', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = RATIOS[obj.name]
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if keys:
        low = co(dup.data.vertices)
        _, nearest = cKDTree(basis).query(low)
        dup.shape_key_add(name='Basis', from_mix=False)
        for name, key in keys.items():
            if name == 'Basis':
                continue
            kb = dup.shape_key_add(name=name, from_mix=False)
            kb.data.foreach_set('co', (low + (key[nearest] - basis[nearest])).ravel())
    return dup


def build(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCES[name]))
    # Idempotent: a re-run replaces an existing distance level instead of stacking another.
    for o in list(bpy.context.scene.objects):
        if '_LOD1' in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
    objects = {o.name: o for o in bpy.context.scene.objects}
    tris = 0
    for part in RATIOS:
        low = lod(objects[part])
        tris += sum(len(p.vertices) - 2 for p in low.data.polygons)
    out = FISH / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=name == 'chromis', export_vertex_color='ACTIVE')
    print(name, 'LOD1 triangles', tris, 'bytes', out.stat().st_size)


if __name__ == '__main__':
    for n in (sys.argv[1:] or SOURCES):
        build(n)
