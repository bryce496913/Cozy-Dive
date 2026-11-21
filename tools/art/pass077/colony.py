"""V0.7 Pass 077: naturally grown branching coral colonies for the reef library.

The Pass 014-069 branching corals were assembled from tubes and junction balls on one shared,
tall single-trunk frame. Here each colony is *grown* and then *fused*:

1. **Growth.** The five structural primaries come from `baseline.json` (the colony's colliders,
   defined in `src/config/coralColonies.ts`). An archetype-specific rule grows the branching
   hierarchy on them: secondaries, tertiaries and digits with organic taper, so every branch
   thins continuously toward a growing tip.
2. **Fusion.** Every branch segment is a tapered capsule in a signed distance field. A smooth
   (exponential) union fillets each junction, so secondaries leave their parent as continuous
   tissue and the colony grows out of one encrusting foot. The field is polygonised with marching
   cubes.
3. **Blender.** The dense surface is reduced with Blender's Decimate (collapse) modifier into a
   near level and a much lighter distance level of the *same* silhouette, so distant colonies
   stay stable.

Everything is seeded and deterministic.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

TAU = math.tau

#: Growth archetypes, by branching-colony variant (matching `BRANCHING_COLONIES`).
ARCHETYPES = ('spreading-thicket', 'asymmetric-head', 'tabular-digitate')
#: Marching-cubes cell (m): fine enough to resolve 12 mm growing tips.
VOXEL = 0.0065
#: Smooth-union blend radius (m): how far junction fillets reach.
BLEND = 0.011
#: Triangle budgets for the fused tissue (corallites and tips are added on top of the near level).
NEAR_TISSUE = 30000
FAR_TISSUE = 10000


@dataclass
class Branch:
    """A grown branch: its spine, its radii along the spine, and its order (0 = primary)."""
    spine: np.ndarray
    radii: np.ndarray
    order: int


def _unit(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-12)


def _perpendicular(t: np.ndarray, rng) -> np.ndarray:
    s = rng.standard_normal(3)
    s -= t * (s @ t)
    return _unit(s)


def _bezier(a: np.ndarray, c: np.ndarray, b: np.ndarray, n: int) -> np.ndarray:
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t ** 2 * b


def _sample(branch: Branch, u: float) -> tuple[np.ndarray, np.ndarray, float]:
    """Point, unit tangent and radius at fraction `u` of the branch length."""
    s = branch.spine
    seg = np.linalg.norm(np.diff(s, axis=0), axis=1)
    acc = np.concatenate([[0], np.cumsum(seg)])
    d = u * acc[-1]
    i = int(np.clip(np.searchsorted(acc, d) - 1, 0, len(s) - 2))
    f = (d - acc[i]) / max(seg[i], 1e-9)
    return s[i] * (1 - f) + s[i + 1] * f, _unit(s[i + 1] - s[i]), \
        float(branch.radii[i] * (1 - f) + branch.radii[i + 1] * f)


def _length(branch: Branch) -> float:
    return float(np.linalg.norm(np.diff(branch.spine, axis=0), axis=1).sum())


def _shoot(start, direction, length, r0, r1, order, rng, upturn=0.0, wander=0.25, n=8) -> Branch:
    """A gently curving tapered shoot; `upturn` bends its tip toward the light."""
    direction = _unit(direction)
    end = start + direction * length
    end = end + np.array([0, upturn * length, 0]) + rng.standard_normal(3) * wander * length * 0.2
    mid = start + direction * length * 0.5 + rng.standard_normal(3) * wander * length * 0.12
    spine = _bezier(start, mid, end, n)
    t = np.linspace(0, 1, n)
    # Organic taper: thick for most of its length, thinning faster toward the growing tip.
    radii = r1 + (r0 - r1) * (1 - t) ** 1.35
    return Branch(spine, radii, order)


def _primary(points: np.ndarray, rng) -> Branch:
    """The structural primary inside one collider: the hull's long axis, gently curved."""
    c = points.mean(0)
    _, _, vt = np.linalg.svd(points - c)
    axis = vt[0]
    proj = (points - c) @ axis
    a, b = c + axis * proj.min(), c + axis * proj.max()
    if a[1] > b[1]:
        a, b = b, a
    # Pull the ends inside the hull's rounded caps (they were swept 0.09 → 0.045 m spheres).
    d = _unit(b - a)
    a, b = a + d * 0.06, b - d * 0.035
    mid = (a + b) / 2 + rng.standard_normal(3) * 0.025 + np.array([0, 0.02, 0])
    spine = _bezier(a, mid, b, 12)
    t = np.linspace(0, 1, 12)
    return Branch(spine, 0.074 * (1 - t) + 0.038 * t, 0)


def grow(parts: list[np.ndarray], variant: int, seed: int) -> list[Branch]:
    """Grow the colony's branching hierarchy on its structural primaries."""
    rng = np.random.default_rng(seed)
    primaries = [_primary(np.asarray(p, float), rng) for p in parts]
    out = list(primaries)
    archetype = ARCHETYPES[variant]
    if archetype == 'spreading-thicket':
        # Staghorn thicket: secondaries fork off at 30-50 degrees and curve upward; each primary
        # tip turns up too, so the colony reads as a broad, low tangle of up-curving branches.
        for p in primaries:
            L = _length(p)
            pos, tan, r = _sample(p, 1.0)
            out.append(_shoot(pos - tan * 0.01, tan * 0.6 + np.array([0, 0.8, 0]), 0.16, r * 0.98, 0.016,
                              1, rng, 0.3))
            for u in np.arange(0.22, 0.95, 0.12 / L) + rng.random() * 0.04:
                pos, tan, r = _sample(p, min(u, 0.96))
                side = _perpendicular(tan, rng)
                ang = math.radians(30 + rng.random() * 22)
                d = tan * math.cos(ang) + side * math.sin(ang) + np.array([0, 0.25, 0])
                length = 0.2 + rng.random() * 0.2
                s = _shoot(pos, d, length, r * 0.72, 0.015, 1, rng, 0.45)
                out.append(s)
                for v in (0.35 + rng.random() * 0.2, 0.7) if rng.random() < 0.75 else (0.5,):
                    q, qt, qr = _sample(s, v)
                    side2 = _perpendicular(qt, rng)
                    d2 = qt * 0.7 + side2 * 0.7 + np.array([0, 0.3, 0])
                    out.append(_shoot(q, d2, 0.07 + rng.random() * 0.08, qr * 0.8, 0.013, 2, rng, 0.5))
    elif archetype == 'asymmetric-head':
        # Corymbose head: the canopy primaries carry dense, mostly upright branchlets whose tips
        # reach a common, lopsided dome (higher on the +x side), like a colony shaded on one flank.
        def dome(x, z):
            return 0.9 + 0.12 * np.clip(x / 0.6, -1, 1) - 0.08 * (x * x + z * z)

        for k, p in enumerate(primaries):
            L = _length(p)
            start = 0.45 if k < 2 else 0.12
            for u in np.arange(start, 1.0, 0.075 / L) + rng.random() * 0.03:
                pos, tan, r = _sample(p, min(u, 0.98))
                for _ in range(1 + int(rng.random() < 0.45)):
                    side = _perpendicular(tan, rng)
                    d = _unit(side * 0.55 + tan * 0.25 + np.array([0, 1.0, 0]))
                    reach = max(0.06, (dome(pos[0], pos[2]) - pos[1]) / max(d[1], 0.3))
                    length = min(0.42, reach * (0.85 + rng.random() * 0.2))
                    s = _shoot(pos, d, length, r * 0.66, 0.016, 1, rng, 0.25)
                    out.append(s)
                    if length > 0.16 and rng.random() < 0.7:
                        q, qt, qr = _sample(s, 0.55 + rng.random() * 0.2)
                        d2 = _unit(qt + _perpendicular(qt, rng) * 0.8 + np.array([0, 0.4, 0]))
                        out.append(_shoot(q, d2, 0.06 + rng.random() * 0.07, qr * 0.8, 0.013, 2, rng, 0.4))
            pos, tan, r = _sample(p, 1.0)
            out.append(_shoot(pos - tan * 0.01, tan + np.array([0, 0.9, 0]), 0.1, r, 0.016, 1, rng, 0.2))
    else:
        # Tabular colony: near-horizontal arms (and lateral branchlets filling the gaps between
        # them) form a flat table, crowded with short upright digits; a flared stalk carries it.
        arms = primaries[1:]
        stalk_top = _sample(primaries[0], 0.95)[0]
        angles = sorted(math.atan2(a.spine[-1][2], a.spine[-1][0]) for a in arms)
        for i, a0 in enumerate(angles):
            a1 = angles[(i + 1) % len(angles)] + (TAU if i == len(angles) - 1 else 0)
            for f in (0.33, 0.66):
                ang = a0 + (a1 - a0) * f
                d = np.array([math.cos(ang), 0.16, math.sin(ang)])
                arms.append(_shoot(stalk_top, d, 0.5 + rng.random() * 0.18, 0.05, 0.022, 1, rng, 0.06, 0.15))
        out.extend(arms[len(primaries) - 1:])
        for k, arm in enumerate(arms):
            L = _length(arm)
            for u in np.arange(0.18, 1.0, 0.13 / L):
                pos, tan, r = _sample(arm, u)
                for sgn in (-1, 1):
                    side = _unit(np.cross(tan, [0, 1, 0])) * sgn
                    d = side + tan * 0.6 + np.array([0, 0.04, 0])
                    lat = _shoot(pos, d, 0.12 + rng.random() * 0.12 * (1.2 - u), r * 0.62, 0.016, 2, rng, 0.05, 0.2)
                    out.append(lat)
        # Upright digits crowd the table top (every 5-6 cm along each arm and branchlet).
        tops = [b for b in out if b.order >= 1] + arms[:len(primaries) - 1]
        for b in tops:
            L = _length(b)
            for u in np.arange(0.12, 1.0, 0.058 / L) + rng.random() * 0.02:
                pos, tan, r = _sample(b, min(u, 0.99))
                d = np.array([0, 1, 0]) + tan * 0.25 + rng.standard_normal(3) * 0.12
                out.append(_shoot(pos, d, 0.06 + rng.random() * 0.06, max(r * 0.75, 0.017), 0.013, 3, rng, 0.0, 0.1, 5))
    return out


# ---------------------------------------------------------------------------------- the surface


def _segments(branches: list[Branch]) -> np.ndarray:
    """Every spine segment as [ax, ay, az, bx, by, bz, ra, rb]."""
    rows = []
    for b in branches:
        for i in range(len(b.spine) - 1):
            rows.append([*b.spine[i], *b.spine[i + 1], b.radii[i], b.radii[i + 1]])
    return np.asarray(rows, float)


def fuse(branches: list[Branch], foot: tuple[float, float, float], seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Smooth union of every tapered segment plus an encrusting foot, polygonised."""
    seg = _segments(branches)
    lo = np.minimum(seg[:, 0:3], seg[:, 3:6]).min(0) - 0.12
    hi = np.maximum(seg[:, 0:3], seg[:, 3:6]).max(0) + 0.12
    fx, fy, fz = foot
    lo = np.minimum(lo, [-fx - 0.06, -0.1, -fz - 0.06])
    hi = np.maximum(hi, [fx + 0.06, fy + 0.06, fz + 0.06])
    shape = np.ceil((hi - lo) / VOXEL).astype(int) + 1
    acc = np.zeros(shape, np.float64)
    reach = BLEND * 7

    def splat(i0, i1, d):
        acc[i0[0]:i1[0], i0[1]:i1[1], i0[2]:i1[2]] += np.exp(-d / BLEND)

    def box(a, b, r):
        i0 = np.maximum(np.floor((np.minimum(a, b) - r - reach - lo) / VOXEL).astype(int), 0)
        i1 = np.minimum(np.ceil((np.maximum(a, b) + r + reach - lo) / VOXEL).astype(int) + 1, shape)
        axes = [lo[k] + np.arange(i0[k], i1[k]) * VOXEL for k in range(3)]
        X, Y, Z = np.meshgrid(*axes, indexing='ij')
        return i0, i1, np.stack([X, Y, Z], -1)

    for ax, ay, az, bx, by, bz, ra, rb in seg:
        a, b = np.array([ax, ay, az]), np.array([bx, by, bz])
        i0, i1, P = box(a, b, max(ra, rb))
        ba = b - a
        h = np.clip(((P - a) @ ba) / max(ba @ ba, 1e-12), 0, 1)
        d = np.linalg.norm(P - a - h[..., None] * ba, axis=-1) - (ra + (rb - ra) * h)
        splat(i0, i1, np.maximum(d, -0.05))
    # Encrusting foot: a low, lumpy, flattened skirt sunk slightly into the substrate.
    rng = np.random.default_rng(seed)
    centre = np.array([0, -0.02, 0])
    i0, i1, P = box(centre - [fx, 0.06, fz], centre + [fx, fy, fz], 0)
    q = (P - centre) / np.array([fx, fy, fz])
    ang = np.arctan2(q[..., 2], q[..., 0])
    lump = 1 + 0.16 * np.sin(ang * 3 + rng.random() * TAU) + 0.1 * np.sin(ang * 5 + rng.random() * TAU)
    d = (np.linalg.norm(q, axis=-1) - lump) * min(fx, fy, fz)
    splat(i0, i1, np.maximum(d, -0.05))
    field = -BLEND * np.log(np.maximum(acc, 1e-300))
    verts, faces, _, _ = marching_cubes(field, 0.0, spacing=(VOXEL, VOXEL, VOXEL))
    verts += lo
    # Nothing below the substrate is ever seen: cut what lies under the foot's sunk base.
    keep = verts[faces].max(1)[:, 1] > -0.06
    return verts, faces[keep][:, ::-1].copy()


def decimate(verts: np.ndarray, faces: np.ndarray, target: int) -> tuple[np.ndarray, np.ndarray]:
    """Reduce a surface to about `target` triangles with Blender's Decimate (collapse) modifier."""
    import bpy

    mesh = bpy.data.meshes.new('pass077_decimate')
    mesh.from_pydata(verts.tolist(), [], faces.tolist())
    mesh.update()
    obj = bpy.data.objects.new('pass077_decimate', mesh)
    bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, target / max(len(faces), 1))
    mod.use_collapse_triangulate = True
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    out = evaluated.to_mesh()
    out.calc_loop_triangles()
    p = np.zeros(len(out.vertices) * 3)
    out.vertices.foreach_get('co', p)
    tris = np.zeros(len(out.loop_triangles) * 3, np.int64)
    out.loop_triangles.foreach_get('vertices', tris)
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)
    return p.reshape(-1, 3), tris.reshape(-1, 3)


def skeleton(branches: list[Branch], step: float = 0.012) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Dense skeleton samples: positions, distance to their branch's growing tip, branch order."""
    pts, tip, order = [], [], []
    for b in branches:
        L = _length(b)
        for u in np.linspace(0, 1, max(2, int(L / step))):
            pts.append(_sample(b, u)[0])
            tip.append((1 - u) * L)
            order.append(b.order)
    return np.asarray(pts), np.asarray(tip), np.asarray(order)


def tip_shading(positions: np.ndarray, branches: list[Branch]) -> tuple[np.ndarray, np.ndarray]:
    """Per-vertex (paleness toward growing tips, interior cavity occlusion in 0..1)."""
    pts, tip, order = skeleton(branches)
    tree = cKDTree(pts)
    _, idx = tree.query(positions)
    # Growing tips of the outer branches only: a primary's end is buried in growth.
    pale = np.clip(1 - tip[idx] / 0.05, 0, 1) * (order[idx] > 0)
    crowd = np.array([len(n) for n in tree.query_ball_point(positions, 0.09)], float)
    cavity = np.clip((crowd - crowd.min()) / max(np.percentile(crowd, 97) - crowd.min(), 1), 0, 1)
    return pale, cavity


def terminal_tips(branches: list[Branch]) -> list[tuple[np.ndarray, np.ndarray, float]]:
    """(tip position, growth direction, tip radius) of every growing tip."""
    out = []
    for b in branches:
        if b.order == 0:
            continue
        out.append((b.spine[-1], _unit(b.spine[-1] - b.spine[-2]), float(b.radii[-1])))
    return out
