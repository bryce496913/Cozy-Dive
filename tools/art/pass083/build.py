"""V0.8 Pass 083: build every habitat mesh (aquarium space) and export reef-habitat.glb.

    python3 tools/art/pass083/build.py
    node tools/art/pass017/compress.mjs public/assets/models/reef

Env: PASS083_CACHE=<file.pkl> reuses the rock (and life) meshes, which take minutes;
PASS083_LIFE=1 rebuilds only the life on the cached rock; PASS083_PUBLISH=0 keeps the export in
tools/art/pass083/out (e.g. while captures run); PASS083_VOXEL overrides the rock voxel (0.04).
"""
from __future__ import annotations

import os
import pickle
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import habitat as hb  # noqa: E402  (puts the Pass 082 / v07 / 077 / 078 tools on the path)
from colony import decimate  # noqa: E402

rb = hb.rb
# Rock triangles per accepted rock (Pass 082 used ~12.8 k; the whole tank needs less each).
PER_ROCK = 9000
FAMILIES = {'branching': ('Branching', 0.6), 'massive': ('Massive', 0.7), 'soft': ('Soft', 0.5),
            'sponge': ('Sponge', 0.92)}


def normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def clean(v, f):
    area = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1)
    f = f[(area > 1e-12) & (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    _, first = np.unique(np.sort(f, axis=1), axis=0, return_index=True)
    return f[np.sort(first)]


def paint(form, v, f):
    """Pass 082B's form-driven painting, lifted for the whole tank: the habitat's porous rock
    has many more pockets than the benchmark ridge, and at the benchmark's recess darkening the
    formations read as dark brown mounds under the tank light. Recesses stay darker than faces,
    but the limestone keeps its pale, cool value."""
    n = normals(v, f)
    depth = np.clip(-form.envelope(v), 0, None)
    c = rb.paint(v, n, depth, rb.curvature(v, f, n), form.facet_distance(v))
    rgb = c[:, :3]
    grey = rgb.mean(1, keepdims=True)
    rgb = grey + (rgb - grey) * 0.85
    c[:, :3] = np.clip(rgb * 1.22 + 0.03, 0, 1)
    return c


def rock(form, voxel):
    v, f = form.mesh(voxel)
    v, f = decimate(v, f, PER_ROCK * len(form.rocks))
    f = clean(v, f)
    return v, f, paint(form, v, f)


def rock_named(name, voxel):
    out = rock(hb.FORMS[name], voxel)
    print('rock', name, len(out[1]), flush=True)
    return out


def build_meshes():
    import habitat_life  # noqa: PLC0415
    import habitat_plants  # noqa: PLC0415
    cache = os.environ.get('PASS083_CACHE')
    voxel = float(os.environ.get('PASS083_VOXEL', '0.04'))
    data = pickle.loads(Path(cache).read_bytes()) if cache and Path(cache).exists() else {}
    if 'rocks' not in data:
        import multiprocessing as mp  # noqa: PLC0415
        names = sorted(hb.FORMS, key=lambda n: -len(hb.FORMS[n].rocks))
        with mp.get_context('fork').Pool(min(4, mp.cpu_count())) as pool:
            built = pool.starmap(rock_named, [(n, voxel) for n in names])
        data['rocks'] = {n: built[names.index(n)] for n in hb.FORMS}
        data.pop('life', None)
        if cache:
            Path(cache).write_bytes(pickle.dumps(data))
    if os.environ.get('PASS083_NOLIFE') == '1':
        # Rock and plants only (a quick look while the colonies build).
        empty = (np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros((0, 3)))
        data['life'] = ({n: {k: empty for k in FAMILIES} for n in hb.FORMS}, {})
    elif 'life' not in data or os.environ.get('PASS083_LIFE') == '1':
        data['life'] = habitat_life.build(data['rocks'])
        if cache:
            Path(cache).write_bytes(pickle.dumps(data))
    # Painting is cheap and is redone on every export (the sculpted rock is cached).
    data['rocks'] = {n: (v, f, paint(hb.FORMS[n], v, f)) for n, (v, f, _c) in data['rocks'].items()}
    data['plants'] = (habitat_plants.templates(), habitat_plants.placements(data['rocks']))
    return data


def box_uv(v, n):
    a = np.abs(n).argmax(1)
    return np.where(a[:, None] == 0, v[:, [2, 1]], np.where(a[:, None] == 1, v[:, [0, 2]], v[:, [0, 1]]))


def export():
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415
    import cozy_art as ca  # noqa: PLC0415
    data = build_meshes()
    life, colliders = data['life']
    tpl, places = data['plants']
    ca.reset_scene()
    root = ca.create_root('ReefHabitat_Root', 'reef', standards_pass='083')

    def material(name, rough):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = 0.0
        return m

    rock_mat = material('Reef_Habitat_Rock', 0.88)
    mats = {key: material(f'Reef_Habitat_{label}', rough) for key, (label, rough) in FAMILIES.items()}
    stats = {}

    def add(name, v, f, c, mat):
        f = clean(v, f)
        o = ca.mesh_from_arrays(name, v, f, box_uv(v, normals(v, f)), c, mat, root)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        for ratio, level in ((0.25, 1), (0.07, 2)):
            ca.add_lod(o, ratio, level).parent = root
        stats[name] = len(f)

    for name, (v, f, c) in data['rocks'].items():
        add(f'Habitat_Rock_{name}', v, f, c, rock_mat)
    for name, fams in life.items():
        for key, (v, f, c) in fams.items():
            if len(f):
                add(f'Habitat_{FAMILIES[key][0]}_{name}', v, f, c, mats[key])
    plant_mat = material('Reef_Habitat_Plant', 0.85)
    for kind, (v, f, c, phase) in tpl.items():
        ca.mesh_from_arrays(f'Habitat_Plant_{kind}', v, f, v[:, [0, 2]], c, plant_mat, root, phase=phase)
    for i, (kind, p, yaw, h) in enumerate(places):
        e = bpy.data.objects.new(f'Habitat_PlantSpot_{kind}_{i}', None)
        bpy.context.collection.objects.link(e)
        e.parent = root
        e.location = tuple(ca.to_blender(np.array([p]))[0])
        e.rotation_euler = (0.0, 0.0, float(yaw))
        e.scale = (float(h),) * 3
    # One convex part per composed mass and saddle: the hull of the rendered vertices nearest to
    # it, so colliders follow the drawn rock while caves and the den stay inside solid parts.
    for name, form in hb.FORMS.items():
        v = data['rocks'][name][0]
        v = v[v[:, 1] > rb.SAND(v[:, [0, 2]]) - 0.15]
        owner = np.argmin(np.stack([e.sdf(v) for e in form.elements]), 0)
        for k, e in enumerate(form.elements):
            pts = v[owner == k]
            if len(pts) < 8:
                continue
            label = e.name.replace('-', ' ').title().replace(' ', '')
            ca.collider_from_points(f'COLLIDER_Habitat_{name}_{label}', pts, root)
    for name, pts in colliders.items():
        ca.collider_from_points(f'COLLIDER_Habitat_Coral_{name.replace("-", " ").title().replace(" ", "")}',
                                pts, root)
    stem = os.environ.get('PASS083_STEM', 'reef-habitat')
    ca.save_blend(HERE / f'{stem}.blend')
    raw = ca.export_glb(HERE / 'out' / f'{stem}.glb')
    out = ROOT / 'public/assets/models/reef/reef-habitat.glb'
    if os.environ.get('PASS083_PUBLISH', '1') != '0':
        out.write_bytes(raw.read_bytes())
    else:
        out = raw
    print('exported', out, out.stat().st_size, sum(stats.values()), 'tris LOD0', len(places), 'plants')
    print(stats)


if __name__ == '__main__':
    export()
