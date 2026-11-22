"""V0.8 Pass 082: build every benchmark mesh (game space) and export the GLB.

    python3 tools/art/pass082/build.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'tools/art/v07'))
sys.path.insert(0, str(ROOT / 'tools/art/pass077'))
import reef_benchmark as rb  # noqa: E402
from colony import decimate  # noqa: E402

# Triangle budgets: the ridge replaces five 20k hero rocks, the bommie one.
BUDGET = {'Reef_Ridge': 64000, 'Reef_Bommie': 12000}


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


def formation(name, form, voxel):
    v, f = form.mesh(voxel)
    v, f = decimate(v, f, BUDGET[name])
    f = clean(v, f)
    n = normals(v, f)
    # How deep the porosity and caves went at each vertex (for recess shading), how concave the
    # surface is there (positive in hollows), and how close it lies to a fracture plane.
    depth = np.clip(-form.envelope(v) - 0.0, 0, None)
    return v, f, rb.paint(v, n, depth, rb.curvature(v, f, n), form.facet_distance(v))


def build_meshes(preview=False):
    """Every mesh, game space. PASS082_CACHE=<file.npz> reuses the rock and life meshes (they
    take minutes) while vegetation or materials are being iterated."""
    import os  # noqa: PLC0415
    import pickle  # noqa: PLC0415
    import life  # noqa: PLC0415
    import vegetation  # noqa: PLC0415
    cache = os.environ.get('PASS082_CACHE')
    if cache and Path(cache).exists():
        parts, colliders = pickle.loads(Path(cache).read_bytes())
        life.build.colliders = colliders
        rocks = {k: parts[k] for k in ('Reef_Ridge', 'Reef_Bommie')}
        # PASS082_LIFE=1 keeps the cached rock and rebuilds only the life on it.
        if os.environ.get('PASS082_LIFE') == '1':
            parts = dict(rocks)
            parts.update(life.build(preview, rocks))
            Path(cache).write_bytes(pickle.dumps((parts, life.build.colliders)))
    else:
        voxel = 0.05 if preview else 0.03
        parts = {}
        v, f, c = formation('Reef_Ridge', rb.RIDGE_FORMATION, voxel)
        parts['Reef_Ridge'] = (v, f, c, 0.88)
        v, f, c = formation('Reef_Bommie', rb.BOMMIE_FORMATION, voxel)
        parts['Reef_Bommie'] = (v, f, c, 0.88)
        rocks = dict(parts)
        parts.update(life.build(preview, rocks))
        if cache:
            Path(cache).write_bytes(pickle.dumps((parts, life.build.colliders)))
    tpl = vegetation.templates()
    places = vegetation.placements(rocks)
    build_meshes.plants = (tpl, places)
    if preview:
        v, f, c = vegetation.instanced(tpl, places)
        parts['Reef_Plants_Preview'] = (v, f, c, 0.85)
    return parts


def box_uv(v, n):
    a = np.abs(n).argmax(1)
    return np.where(a[:, None] == 0, v[:, [2, 1]], np.where(a[:, None] == 1, v[:, [0, 2]], v[:, [0, 1]]))


def export():
    import bpy  # noqa: PLC0415
    import cozy_art as ca  # noqa: PLC0415
    import life  # noqa: PLC0415
    parts = build_meshes()
    tpl, places = build_meshes.plants
    ca.reset_scene()
    root = ca.create_root('ReefBenchmark_Root', 'reef', standards_pass='082')

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

    rock = material('Reef_Benchmark_Rock', 0.88)
    mats = {'Reef_Ridge': rock, 'Reef_Bommie': rock,
            'Reef_Branching': material('Reef_Benchmark_Branching', 0.6),
            'Reef_Massive': material('Reef_Benchmark_Massive', 0.7),
            'Reef_Soft': material('Reef_Benchmark_Soft', 0.5),
            'Reef_Sponge': material('Reef_Benchmark_Sponge', 0.92)}
    stats = {}
    import bmesh  # noqa: PLC0415
    for name, (v, f, c, _r) in parts.items():
        f = clean(v, f)
        o = ca.mesh_from_arrays(name, v, f, box_uv(v, normals(v, f)), c, mats[name], root)
        # Outward winding everywhere: the game culls back faces (marching cubes' winding and the
        # merged colonies' are not guaranteed consistent).
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        low = ca.add_lod(o, 0.25, 1)
        low.parent = root
        stats[name] = (len(f), sum(len(p.vertices) - 2 for p in low.data.polygons))
    plant_mat = material('Reef_Benchmark_Plant', 0.85)
    for kind, (v, f, c, phase) in tpl.items():
        ca.mesh_from_arrays(f'Reef_Plant_{kind}', v, f, v[:, [0, 2]], c, plant_mat, root, phase=phase)
    for i, (kind, p, yaw, h) in enumerate(places):
        e = bpy.data.objects.new(f'Reef_PlantSpot_{kind}_{i}', None)
        bpy.context.collection.objects.link(e)
        e.parent = root
        e.location = tuple(ca.to_blender(np.array([p]))[0])
        e.rotation_euler = (0.0, 0.0, float(yaw))
        e.scale = (float(h),) * 3
    import reef_benchmark as rbm  # noqa: PLC0415
    # One convex part per composed element: the hull of the rendered vertices nearest to it, so
    # the colliders follow the drawn rock (lobes and warped rims included) while the grotto's
    # mouth and the arch's window stay open between parts.
    for form, prefix, key in ((rbm.RIDGE_FORMATION, 'Ridge', 'Reef_Ridge'),
                              (rbm.BOMMIE_FORMATION, 'Bommie', 'Reef_Bommie')):
        v = parts[key][0]
        v = v[v[:, 1] > rbm.SAND(v[:, [0, 2]]) - 0.15]
        owner = np.argmin(np.stack([e.sdf(v) for e in form.elements]), 0)
        for k, e in enumerate(form.elements):
            pts = v[owner == k]
            if len(pts) < 8:
                pts = e.corners()
            name = e.name.replace('-', ' ').title().replace(' ', '')
            ca.collider_from_points(f'COLLIDER_{prefix}_{name}', pts, root)
    for name, pts in life.build.colliders.items():
        ca.collider_from_points(f'COLLIDER_Coral_{name.title()}', pts, root)
    ca.save_blend(HERE / 'reef-benchmark.blend')
    raw = ca.export_glb(HERE / 'out' / 'reef-benchmark.glb')
    import os  # noqa: PLC0415
    out = ROOT / 'public/assets/models/reef/reef-benchmark.glb'
    # PASS082_PUBLISH=0 keeps the result in tools/art/pass082/out (e.g. while captures run).
    if os.environ.get('PASS082_PUBLISH', '1') != '0':
        out.write_bytes(raw.read_bytes())
    else:
        out = raw
    print('exported', out, out.stat().st_size, stats, len(places), 'plants')


if __name__ == '__main__':
    export()
