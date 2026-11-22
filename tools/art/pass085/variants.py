"""V0.8 Pass 085: reusable, artist-authored reef variants for the outer reef.

    python3 tools/art/pass085/variants.py          # builds and exports reef-outer.glb
    node tools/art/pass017/compress.mjs public/assets/models/reef

The outer reef places hundreds of rocks and colonies (seeded layout, instanced per template), and
it drew them all from the tank's old library: one family of rounded boulders, and tall colonies
perched on their crowns like ornaments on pedestals. This pass replaces those templates with
variants authored by the approved Pass 082/083 method, so the layout, collision, encounter paths
and instancing stay as they are while every piece changes:

* **Rocks** (six variants, each fitting the library's +-0.85 unit box, so every placement keeps its
  footprint): a flat-topped table with an undercut lip, a stepped ridge of tilted beds, a plinth
  with two pinnacles, a mass with a cantilevered shelf over a grotto, a low fractured mound, and a
  stack of tilted slabs. Pass 082B fracture planes, porosity and form-driven painting.
* **Colonies** grow over the rock instead of standing on it: encrusting massive fields whose skirts
  drape below the attachment point, staghorn thickets and corymbose bush clusters, and tabular and
  tiered plating colonies on short stalks. Pass 082B constructions; no new species.
* **Seagrass**: the Pass 083 arching turtle-grass tufts replace the straight library blades.

Each piece carries convex collision parts (the hull of its rendered vertices per composed mass) in
`<name>_Root`, as the library pieces do, so the swimmer and the fish collide with what is drawn.
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for extra in ('tools/art/pass083', 'tools/art/pass082', 'tools/art/pass078', 'tools/art/v07', 'tools/art/pass077'):
    sys.path.insert(0, str(ROOT / extra))
import reef_benchmark as rb  # noqa: E402
from colony import decimate  # noqa: E402
from mammals_sdf import ellipsoid, smin, smax  # noqa: E402
from skimage.measure import marching_cubes  # noqa: E402
from scipy.ndimage import gaussian_filter  # noqa: E402

# Local space: the sand meets a placed rock at about y -0.45 (rocks stand 40 % buried).
SAND_Y = -0.45
rb.SAND = lambda q: np.full(len(np.atleast_2d(q)), SAND_Y)
import life as l82  # noqa: E402
import habitat_plants as hp  # noqa: E402
import habitat_life as hl  # noqa: E402

# (The habitat modules set the tank's sand on import; these pieces use their own local sand.)
rb.SAND = lambda q: np.full(len(np.atleast_2d(q)), SAND_Y)

E = rb.Element
ROCK_TRIS = 5200


class Piece:
    """A composed rock in local space: smooth-unioned masses, clipped to the +-0.85 box."""

    def __init__(self, name, masses, caves=(), seed=0):
        self.name, self.masses, self.caves, self.seed = name, masses, caves, seed

    def envelope(self, p):
        d = smin([e.sdf(p) for e in self.masses], 0.08)
        box = np.max(np.abs(p) - 0.86, axis=1)
        return smax(d, box, 0.03)

    def field(self, p):
        env = self.envelope(p)
        d = env.copy()
        band = (env > -0.2) & (env < 0.15)
        if band.any():
            d[band] = rb.porous(p[band], env[band], 900 + self.seed, 0.4)
        for c, r in self.caves:
            d = smax(d, -ellipsoid(p, c, r), 0.06)
        return d

    def facet_distance(self, p):
        return np.min([e.facet_distance(p) for e in self.masses], 0)

    def mesh(self, voxel=0.018):
        ax = np.arange(-0.95, 0.95, voxel)
        X, Y, Z = np.meshgrid(ax, ax, ax, indexing='ij')
        p = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
        f = self.field(p).reshape(X.shape)
        f = gaussian_filter(f, 0.3)
        v, fc, _, _ = marching_cubes(f, 0.0, spacing=(voxel,) * 3)
        v += ax[0]
        return v, fc[:, ::-1].copy()


def rocks():
    """The six rock variants (local metres; the placement scales them)."""
    return [
        Piece('table', [
            E('foot', (0, -0.42, 0), (1.6, 0.7, 1.5), yaw=10, under=0.45, seed=1),
            E('bed', (0.05, 0.08, -0.04), (1.55, 0.42, 1.4), yaw=-14, rz=4, under=0.35, seed=2),
            E('cap', (-0.25, 0.42, 0.15), (0.8, 0.28, 0.7), yaw=30, rx=5, under=0.2, seed=3),
        ], seed=1),
        Piece('ridge', [
            E('foot', (0, -0.45, 0), (1.7, 0.7, 1.0), yaw=0, under=0.4, seed=11),
            E('bed1', (-0.35, 0.0, 0.05), (1.0, 0.5, 0.85), yaw=8, rz=9, seed=12),
            E('bed2', (0.4, 0.15, -0.06), (0.85, 0.55, 0.8), yaw=-12, rz=-11, under=0.25, seed=13),
            E('crest', (0.15, 0.5, 0.0), (0.7, 0.3, 0.5), yaw=20, rz=6, under=0.3, seed=14),
        ], seed=2),
        Piece('pinnacles', [
            E('plinth', (0, -0.4, 0), (1.6, 0.8, 1.45), yaw=25, under=0.4, seed=21),
            E('spire1', (-0.35, 0.25, 0.2), (0.6, 1.1, 0.55), yaw=12, rx=-5, rz=6, under=0.25, seed=22),
            E('spire2', (0.4, 0.1, -0.25), (0.55, 0.85, 0.5), yaw=-20, rx=6, rz=-8, under=0.25, seed=23),
        ], seed=3),
        Piece('shelf', [
            E('mass', (-0.25, -0.2, 0), (1.1, 1.2, 1.3), yaw=15, under=0.35, seed=31),
            E('shelf', (0.35, 0.22, 0.05), (1.0, 0.24, 1.15), yaw=-6, rz=-6, under=0.1, seed=32),
            E('cap', (-0.35, 0.5, -0.1), (0.7, 0.3, 0.7), yaw=40, under=0.25, seed=33),
        ], caves=[((0.45, -0.25, 0.05), (0.35, 0.3, 0.45))], seed=4),
        Piece('mound', [
            E('mound', (0, -0.35, 0), (1.65, 0.85, 1.55), yaw=0, under=0.25, seed=41),
            E('knoll', (0.25, 0.05, -0.2), (0.9, 0.5, 0.85), yaw=33, rx=4, rz=-5, under=0.2, seed=42),
            E('knoll2', (-0.4, -0.05, 0.35), (0.7, 0.4, 0.6), yaw=-25, rz=6, seed=43),
        ], seed=5),
        Piece('stack', [
            E('slab1', (0, -0.45, 0), (1.6, 0.6, 1.3), yaw=5, rz=4, under=0.35, seed=51),
            E('slab2', (0.12, -0.02, 0.1), (1.25, 0.42, 1.05), yaw=38, rx=-8, rz=-10, under=0.35, seed=52),
            E('slab3', (-0.1, 0.36, -0.08), (0.85, 0.34, 0.75), yaw=-30, rx=9, rz=12, under=0.35, seed=53),
        ], seed=6),
    ]


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


def build_rock(piece):
    v, f = piece.mesh()
    v, f = decimate(v, f, ROCK_TRIS)
    f = clean(v, f)
    n = normals(v, f)
    depth = np.clip(-piece.envelope(v), 0, None)
    c = rb.paint(v, n, depth, rb.curvature(v, f, n), piece.facet_distance(v))
    # The same lift as the habitat (the porous rock reads dark otherwise).
    rgb = c[:, :3]
    grey = rgb.mean(1, keepdims=True)
    c[:, :3] = np.clip((grey + (rgb - grey) * 0.85) * 1.22 + 0.03, 0, 1)
    owner = np.argmin(np.stack([e.sdf(v) for e in piece.masses]), 0)
    hulls = [v[owner == k] for k in range(len(piece.masses)) if (owner == k).sum() >= 8]
    return v, f, c, hulls


# ------------------------------------------------------------------ colonies


UP = np.array([0.0, 1.0, 0.0])


def merge(items):
    vs, fs, cs, off = [], [], [], 0
    for v, f, c in items:
        vs.append(v)
        fs.append(f + off)
        cs.append(c)
        off += len(v)
    return np.vstack(vs), np.vstack(fs), np.clip(np.vstack(cs), 0, 1)


def low_hull(v, height):
    return v[v[:, 1] < v[:, 1].min() + height]


def colonies():
    """(family, template) -> (v, f, c, collider points). Attachment point at the origin."""
    out = {}
    tints = hl.TINTS
    # Massive: encrusting fields that drape over the rock below their attachment point.
    for t, (r, tint, seed) in enumerate(((0.62, tints[0], 1), (0.55, tints[2], 2), (0.6, tints[3], 3))):
        v, f, c = hl.massive_field(np.zeros(3), UP, r, 8500 + seed, np.array(tint))
        # A skirt hanging over the rock's edge: the field's rim bends down.
        rr = np.hypot(v[:, 0], v[:, 2])
        v[:, 1] -= 0.22 * np.clip((rr - r * 0.55) / r, 0, 1) ** 1.5
        out[('massive', t)] = (v, f, c, low_hull(v, 0.18))
    # Branching: a staghorn thicket, a cluster of corymbose bushes, a thicket with a bush beside it.
    rng = np.random.default_rng(8510)
    v, f, c, hull = hl.thicket_at(np.zeros(3), UP, rng, 0.7)
    out[('branching', 0)] = (v, f, c, hull)
    items = [l82.bush(np.array([dx, 0.0, dz]), UP, s, 8520 + k, hl.BUSH_TIPS[k % 4])
             for k, (dx, dz, s) in enumerate(((0, 0, 0.42), (0.38, 0.18, 0.32), (-0.3, 0.3, 0.3), (0.1, -0.4, 0.28)))]
    v, f, c = merge(items)
    out[('branching', 1)] = (v, f, c, low_hull(v, 0.2))
    v1, f1, c1, _ = hl.thicket_at(np.zeros(3), UP, np.random.default_rng(8530), 0.5)
    v2, f2, c2 = l82.bush(np.array([0.5, 0.0, -0.2]), UP, 0.36, 8531, hl.BUSH_TIPS[1])
    v, f, c = merge([(v1, f1, c1), (v2, f2, c2)])
    out[('branching', 2)] = (v, f, c, low_hull(v, 0.2))
    # Plate: two tabular colonies and a tier of plates on a short stub.
    for t, (size, seed) in enumerate(((0.62, 8540), (0.5, 8541))):
        v, f, c = l82.table(np.zeros(3), size, seed)
        out[('plate', t)] = (v, f, c, low_hull(v, 0.3))
    v, f, c = l82.plates(np.array([0, 0.05, 0]), np.array([0.0, 0.25, 1.0]) / np.linalg.norm([0, 0.25, 1]), 0.55,
                         8542, np.array(tints[4]) * 0.9)
    out[('plate', 2)] = (v, f, c, low_hull(v, 0.25))
    return out


# ------------------------------------------------------------------ export


def box_uv(v, n):
    a = np.abs(n).argmax(1)
    return np.where(a[:, None] == 0, v[:, [2, 1]], np.where(a[:, None] == 1, v[:, [0, 2]], v[:, [0, 1]]))


def export():
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415
    import cozy_art as ca  # noqa: PLC0415
    ca.reset_scene()
    root = ca.create_root('ReefOuter_Root', 'reef', standards_pass='085')

    def material(name, rough):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = rough
        return m

    mats = {'rock': material('Reef_Outer_Rock', 0.88), 'branching': material('Reef_Outer_Branching', 0.6),
            'massive': material('Reef_Outer_Massive', 0.7), 'plate': material('Reef_Outer_Plate', 0.6),
            'plant': material('Reef_Outer_Plant', 0.85)}
    stats = {}

    def add(name, v, f, c, mat, hulls):
        group = bpy.data.objects.new(f'{name}_Root', None)
        bpy.context.collection.objects.link(group)
        group.parent = root
        f = clean(v, f)
        o = ca.mesh_from_arrays(name, v, f, box_uv(v, normals(v, f)), c, mat, group)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        for k, pts in enumerate(hulls):
            ca.collider_from_points(f'COLLIDER_{name}_{k}', pts, group)
        stats[name] = len(f)

    for t, piece in enumerate(rocks()):
        v, f, c, hulls = build_rock(piece)
        add(f'OuterRock_{t}', v, f, c, mats['rock'], hulls)
        print('rock', t, piece.name, len(f), flush=True)
    for (family, t), (v, f, c, hull) in colonies().items():
        add(f'OuterCoral_{family}_{t}', v, f, c, mats[family], [hull])
        print('coral', family, t, len(f), flush=True)
    tpl = hp.templates()
    for kind, key in (('Grass', 'grass'), ('GrassShort', 'blade')):
        v, f, c, phase = tpl[kind]
        ca.mesh_from_arrays(f'OuterPlant_{key}', v, f, v[:, [0, 2]], c, mats['plant'], root, phase=phase)
    ca.save_blend(HERE / 'reef-outer.blend')
    raw = ca.export_glb(HERE / 'out' / 'reef-outer.glb')
    out = ROOT / 'public/assets/models/reef/reef-outer.glb'
    if os.environ.get('PASS085_PUBLISH', '1') != '0':
        out.write_bytes(raw.read_bytes())
    print('exported', out, out.stat().st_size if out.exists() else 0, stats)


if __name__ == '__main__':
    (HERE / 'out').mkdir(exist_ok=True)
    export()
