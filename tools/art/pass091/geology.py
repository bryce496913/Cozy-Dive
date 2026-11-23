"""V0.8 Pass 091: kelp-forest and sea-cave geology, by the approved Pass 082/083 sculpt method.

    python3 tools/art/pass091/geology.py          # builds and exports geology.glb
    node tools/art/pass017/compress.mjs public/assets/models/reef

The kelp forest's boulders and wall rocks were one code-built rock (`rockShape`, about 500
triangles) stretched to each placement: rounded ovoids, faceted up close. The sea cave's boulders
and pillars were carved convex hulls (`limestoneGeometry`); the pillars stretched about 2.5 times
vertically, so their facets read as low-poly slabs. This pass authors reusable variants in the
Pass 082/083 way (smooth-unioned masses with fracture planes and undercuts, porosity, carved
cavities, marching cubes, decimation, form-driven painting) and the runtime places them at the
existing layouts' positions and footprints, so routes, cracks, habitats and passages are unchanged:

* **Kelp coastal rock** (six variants, in the +-0.85 unit box like the library pieces): tilted
  sandstone slabs, a water-worn boulder broken by a fracture face, an overhanging ledge over a
  cavity, a boulder split by a joint, a low bench with eroded steps, and a tor of stacked blocks.
  Painted as dark weathered stone: darker in hollows and toward the sand, paler fresh fracture faces
  and worn crests, faint coralline warmth on upward faces; the 'Kelp rock' material tints it.
* **Cave limestone** (six variants): a bedded block with a waterline notch, a dissolution dome, a
  tilted bed, a fallen roof slab, a leaning pair and a shelf over a hollow. Pale stone, strata bands,
  dark cavities and a darker silt line at the foot.
* **Cave pillars** (two variants), authored at column proportions (1.7 wide x 3.2 tall locally) so
  the runtime scales them almost uniformly: a flared foot, an eroded waist of offset drums, ledges
  and a head spreading into the roof.

Each piece carries convex collision parts (the hull of the vertices owned by each mass) under
`<name>_Root`, as the reef pieces do, so the swimmer and fish collide with what is drawn.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for extra in ('tools/art/pass085', 'tools/art/pass083', 'tools/art/pass082', 'tools/art/pass078', 'tools/art/v07',
              'tools/art/pass077'):
    sys.path.insert(0, str(ROOT / extra))
import variants as v85  # noqa: E402  (also sets up the Pass 082 sculpt helpers)
import reef_benchmark as rb  # noqa: E402
from colony import decimate  # noqa: E402
from mammals_sdf import ellipsoid, noise3, smin, smax, smooth  # noqa: E402
from skimage.measure import marching_cubes  # noqa: E402
from scipy.ndimage import gaussian_filter  # noqa: E402

E = rb.Element
ROCK_TRIS = 2400
PILLAR_TRIS = 6000


class Piece(v85.Piece):
    """A composed rock in a local box of half-extents `half` (the pillars are taller than wide)."""

    def __init__(self, name, masses, caves=(), seed=0, half=(0.86, 0.86, 0.86), porosity=0.4):
        super().__init__(name, masses, caves, seed)
        self.half = np.asarray(half, float)
        self.porosity = porosity

    def envelope(self, p):
        d = smin([e.sdf(p) for e in self.masses], 0.08)
        box = np.max(np.abs(p) - self.half, axis=1)
        return smax(d, box, 0.03)

    def field(self, p):
        env = self.envelope(p)
        d = env.copy()
        band = (env > -0.2) & (env < 0.15)
        if band.any():
            d[band] = weather(p[band], env[band], 900 + self.seed, self.porosity)
        for c, r in self.caves:
            d = smax(d, -ellipsoid(p, c, r), 0.06)
        return d

    def mesh(self, voxel=0.02):
        axes = [np.arange(-h - 0.09, h + 0.09, voxel) for h in self.half]
        X, Y, Z = np.meshgrid(*axes, indexing='ij')
        p = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
        f = self.field(p).reshape(X.shape)
        # Broad, continuous surfaces: a wider blur than the reef's live rock.
        f = gaussian_filter(f, 0.9)
        v, fc, _, _ = marching_cubes(f, 0.0, spacing=(voxel,) * 3)
        v += np.array([a[0] for a in axes])
        return largest(v, fc[:, ::-1].copy())


def largest(v, f):
    """The rock's one connected body: no detached crumbs hovering beside it."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]]])
    g = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v)))
    _, label = connected_components(g, directed=False)
    keep = np.bincount(label[f[:, 0]]).argmax()
    f = f[label[f[:, 0]] == keep]
    used = np.unique(f)
    remap = np.full(len(v), -1)
    remap[used] = np.arange(len(used))
    return v[used], remap[f]


def weather(p, env, seed, strength):
    """Weathered stone, not live reef: a few rounded solution pockets in clusters, faint bedding
    and broad undulation. (The Pass 082 live-rock porosity, a dense field of fine holes, decimated
    into crumpled spiky pits on rock this size.)"""
    d = env.copy()
    cluster = smooth(-0.1, 0.45, noise3(p, 0.8, seed))
    pockets = rb.worley(p, 0.42, seed + 2) * 0.42 - 0.085 * cluster
    d = smax(d, -pockets * strength, 0.09)
    # Bedding: shallow grooves along the strata, wandering a little.
    d += 0.009 * np.sin(p[:, 1] * 34 + 2.5 * noise3(p, 1.1, seed + 5))
    # Broad undulation of the faces.
    d += 0.03 * noise3(p, 1.6, seed + 3) + 0.008 * rb.ridged(p, 4.0, seed + 4, 2)
    return d


def kelp_rocks():
    """Coastal rock: weathered, layered and water-worn (local metres; the placement scales them)."""
    return [
        Piece('slabs', [
            E('foot', (0, -0.42, 0), (1.65, 0.62, 1.4), yaw=8, rz=3, under=0.4, seed=101),
            E('slab1', (0.1, -0.05, 0.05), (1.4, 0.38, 1.15), yaw=-22, rx=-6, rz=-9, under=0.4, seed=102),
            E('slab2', (-0.15, 0.3, -0.1), (0.95, 0.32, 0.8), yaw=35, rx=8, rz=11, under=0.4, seed=103),
        ], seed=11),
        Piece('worn', [
            E('body', (0, -0.15, 0), (1.6, 1.15, 1.35), yaw=12, rz=-5, under=0.15, seed=111),
            E('shoulder', (0.45, 0.2, 0.2), (0.75, 0.6, 0.7), yaw=-30, rx=6, seed=112),
        ], caves=[((-0.55, -0.15, 0.4), (0.3, 0.22, 0.25))], seed=12),
        Piece('ledge', [
            E('mass', (-0.3, -0.2, 0), (1.05, 1.15, 1.35), yaw=10, under=0.3, seed=121),
            E('ledge', (0.38, 0.2, 0.0), (0.95, 0.26, 1.1), yaw=-8, rz=-7, under=0.12, seed=122),
            E('cap', (-0.35, 0.48, -0.05), (0.65, 0.28, 0.7), yaw=42, under=0.25, seed=123),
        ], caves=[((0.45, -0.22, 0.0), (0.38, 0.3, 0.42))], seed=13),
        Piece('split', [
            E('half1', (-0.36, -0.12, 0.02), (0.78, 1.15, 1.3), yaw=6, rz=6, under=0.25, seed=131),
            E('half2', (0.42, -0.2, -0.03), (0.74, 1.0, 1.2), yaw=-9, rz=-8, under=0.25, seed=132),
        ], seed=14),
        Piece('bench', [
            E('bench', (0, -0.4, 0), (1.7, 0.7, 1.55), yaw=0, under=0.35, seed=141),
            E('step', (0.25, -0.05, -0.15), (1.05, 0.38, 0.95), yaw=28, rz=-4, under=0.35, seed=142),
            E('knob', (-0.45, 0.1, 0.35), (0.6, 0.45, 0.55), yaw=-20, rx=6, seed=143),
        ], seed=15),
        Piece('tor', [
            E('base', (0, -0.45, 0), (1.4, 0.65, 1.3), yaw=15, under=0.3, seed=151),
            E('block', (0.08, 0.05, 0.05), (1.05, 0.55, 0.95), yaw=-25, rx=-5, rz=7, under=0.3, seed=152),
            E('top', (-0.1, 0.45, -0.05), (0.7, 0.42, 0.65), yaw=40, rx=8, rz=-9, under=0.25, seed=153),
        ], seed=16),
    ]


def cave_rocks():
    """Limestone: bedded, dissolved, fallen and undercut at the waterline."""
    return [
        Piece('block', [
            E('lower', (0, -0.35, 0), (1.6, 0.8, 1.45), yaw=10, under=0.55, seed=201),
            E('upper', (0.05, 0.2, -0.03), (1.4, 0.55, 1.25), yaw=-6, rz=3, under=0.3, seed=202),
        ], seed=21, porosity=0.55),
        Piece('dome', [
            E('dome', (0, -0.2, 0), (1.65, 1.2, 1.5), yaw=0, under=0.2, seed=211),
            E('lobe', (-0.4, 0.15, 0.3), (0.8, 0.6, 0.7), yaw=30, seed=212),
        ], caves=[((0.5, -0.3, -0.35), (0.3, 0.25, 0.3))], seed=22, porosity=0.7),
        Piece('tilted', [
            E('bed1', (0, -0.3, 0), (1.65, 0.6, 1.3), yaw=5, rz=12, under=0.4, seed=221),
            E('bed2', (0.1, 0.12, 0.05), (1.35, 0.45, 1.1), yaw=-4, rz=14, rx=-4, under=0.4, seed=222),
        ], seed=23, porosity=0.45),
        Piece('fallen', [
            E('slab', (0, -0.2, 0), (1.7, 0.75, 1.3), yaw=20, rx=8, rz=-10, under=0.2, seed=231),
            E('wedge', (-0.4, 0.25, 0.25), (0.75, 0.5, 0.65), yaw=-35, rx=-12, rz=15, seed=232),
        ], seed=24, porosity=0.35),
        Piece('pair', [
            E('a', (-0.4, -0.15, 0), (0.85, 1.25, 1.2), yaw=8, rz=10, under=0.35, seed=241),
            E('b', (0.42, -0.25, 0.05), (0.8, 1.0, 1.1), yaw=-12, rz=-14, under=0.35, seed=242),
        ], seed=25, porosity=0.5),
        Piece('shelf', [
            E('mass', (-0.25, -0.2, 0), (1.1, 1.2, 1.3), yaw=15, under=0.4, seed=251),
            E('shelf', (0.35, 0.2, 0.0), (1.0, 0.3, 1.15), yaw=-6, rz=-5, under=0.15, seed=252),
        ], caves=[((0.42, -0.25, 0.05), (0.38, 0.32, 0.45))], seed=26, porosity=0.55),
    ]


def pillars():
    """Two columns, 1.7 x 3.2 x 1.7 locally (the runtime scales them almost uniformly)."""
    H = (0.86, 1.62, 0.86)
    return [
        Piece('pillar0', [
            E('foot', (0, -1.3, 0), (1.7, 0.75, 1.6), yaw=0, under=0.35, seed=301),
            E('drum1', (0.05, -0.6, 0.03), (1.05, 0.95, 1.0), yaw=20, rz=3, under=0.3, seed=302),
            E('waist', (-0.06, 0.15, -0.02), (0.78, 1.0, 0.8), yaw=-15, rz=-4, under=0.25, seed=303),
            E('drum2', (0.04, 0.75, 0.05), (1.0, 0.7, 0.95), yaw=35, rz=5, under=0.3, seed=304),
            E('head', (0, 1.32, 0), (1.72, 0.65, 1.66), yaw=-10, under=0.15, seed=305),
        ], seed=31, half=H, porosity=0.55),
        Piece('pillar1', [
            E('foot', (0.05, -1.32, 0), (1.66, 0.7, 1.7), yaw=25, under=0.4, seed=311),
            E('drum1', (-0.04, -0.7, 0.05), (0.95, 0.85, 1.05), yaw=-10, rx=4, under=0.3, seed=312),
            E('waist', (0.08, 0.0, -0.03), (0.72, 1.1, 0.76), yaw=12, rx=-5, under=0.25, seed=313),
            E('ledge', (-0.1, 0.55, 0.08), (1.1, 0.35, 1.05), yaw=-30, under=0.3, seed=314),
            E('head', (0, 1.3, 0), (1.7, 0.7, 1.7), yaw=15, under=0.15, seed=315),
        ], seed=32, half=H, porosity=0.55),
    ]


# ------------------------------------------------------------------ painting


def paint(v, n, depth, curv, facet, world):
    """Neutral stone values (the world's material tints them): hollows dark, fresh fracture faces
    and worn crests pale, a darker foot toward the sand; kelp rock a little warm on upward faces
    (coralline), cave limestone banded by its beds."""
    rng = np.random.default_rng(91)
    up = np.clip(n[:, 1], -1, 1)
    hollow = np.clip(-curv * 6, 0, 1)
    crest = np.clip(curv * 6, 0, 1)
    fresh = np.clip(1 - facet / 0.06, 0, 1)
    mottle = np.sin(v[:, 0] * 9.1 + v[:, 2] * 6.3) * np.sin(v[:, 1] * 7.7 - v[:, 0] * 4.1)
    foot = np.clip((v[:, 1] - v[:, 1].min()) / 0.45, 0, 1)
    if world == 'kelp':
        k = 0.66 + 0.06 * mottle + 0.1 * crest + 0.08 * fresh - 0.2 * hollow - 0.12 * (1 - foot)
        rgb = np.stack([k * 1.02, k, k * 0.97], 1)
        warm = np.clip(up, 0, 1) ** 2 * (0.5 + 0.5 * np.sin(v[:, 0] * 5 + v[:, 2] * 3)) * 0.12
        rgb[:, 0] += warm
        rgb[:, 2] -= warm * 0.4
    else:
        beds = 0.04 * np.sign(np.sin(v[:, 1] * 22 + 0.4 * np.sin(v[:, 0] * 3)))
        k = 0.56 + 0.05 * mottle + beds + 0.1 * crest + 0.07 * fresh - 0.22 * hollow - 0.12 * (1 - foot)
        k = k - 0.08 * np.clip(-up, 0, 1)
        rgb = np.stack([k * 1.02, k, k * 0.95], 1)
    rgb += rng.normal(0, 0.006, rgb.shape)
    return np.clip(rgb, 0, 1)


def build(piece, world, tris):
    v, f = piece.mesh()
    v, f = decimate(v, f, tris)
    f = v85.clean(v, f)
    n = v85.normals(v, f)
    depth = np.clip(-piece.envelope(v), 0, None)
    c = paint(v, n, depth, rb.curvature(v, f, n), piece.facet_distance(v), world)
    owner = np.argmin(np.stack([e.sdf(v) for e in piece.masses]), 0)
    hulls = [v[owner == k] for k in range(len(piece.masses)) if (owner == k).sum() >= 8]
    return v, f, np.concatenate([c, np.ones((len(c), 1))], 1), hulls


def export():
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415
    import cozy_art as ca  # noqa: PLC0415
    ca.reset_scene()
    root = ca.create_root('Geology_Root', 'reef', standards_pass='091')

    def material(name, rough):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = rough
        return m

    mats = {'kelp': material('Kelp_Coastal_Rock', 0.9), 'cave': material('Cave_Limestone', 0.95)}
    stats = {}

    def add(name, v, f, c, mat, hulls):
        group = bpy.data.objects.new(f'{name}_Root', None)
        bpy.context.collection.objects.link(group)
        group.parent = root
        f = v85.clean(v, f)
        o = ca.mesh_from_arrays(name, v, f, v85.box_uv(v, v85.normals(v, f)), c, mat, group)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        for k, pts in enumerate(hulls):
            ca.collider_from_points(f'COLLIDER_{name}_{k}', pts, group)
        stats[name] = len(f)

    for t, piece in enumerate(kelp_rocks()):
        v, f, c, hulls = build(piece, 'kelp', ROCK_TRIS)
        add(f'KelpRock_{t}', v, f, c, mats['kelp'], hulls)
        print('kelp', t, piece.name, len(f), flush=True)
    for t, piece in enumerate(cave_rocks()):
        v, f, c, hulls = build(piece, 'cave', ROCK_TRIS)
        add(f'CaveRock_{t}', v, f, c, mats['cave'], hulls)
        print('cave', t, piece.name, len(f), flush=True)
    for t, piece in enumerate(pillars()):
        v, f, c, hulls = build(piece, 'cave', PILLAR_TRIS)
        add(f'CavePillar_{t}', v, f, c, mats['cave'], hulls)
        print('pillar', t, piece.name, len(f), flush=True)
    ca.save_blend(HERE / 'geology.blend')
    raw = ca.export_glb(HERE / 'out' / 'geology.glb')
    out = ROOT / 'public/assets/models/reef/geology.glb'
    if os.environ.get('PASS091_PUBLISH', '1') != '0':
        out.write_bytes(raw.read_bytes())
    print('exported', out, out.stat().st_size if out.exists() else 0, stats)


if __name__ == '__main__':
    (HERE / 'out').mkdir(exist_ok=True)
    export()
