"""V0.8 Pass 092: the reef library's plating corals, without mushroom stalks.

    python3 tools/art/pass092/plates.py                  # Blender 5.1 Python (bpy module)
    node tools/art/pass092/splice_reef.mjs tools/art/pass092/out/plates.glb \
        Coral_Plate_0_Root Coral_Plate_1_Root Coral_Plate_2_Root

The Pass 014 / 069 plates (`Coral_Plate_0..2` in reef-environment.glb: the tank's plate colony, the
placeable "Plate coral" and "Tiered plate coral", the outer reef's fallback) were tables: round
plates carried on a trunk and struts, which read as mushrooms (Pass 088 audit). Here each colony
grows the way plating corals do on a reef: out of a broad pinnacle of dead, encrusted coral rock,
wide at its foot (never a stalk), shingled with small young plates, and spreading at the top into
overlapping, cupped laminae (part whorls, not discs), each thick at its root and thin at a wavy,
pale growing margin with growth rings. The tiers keep the shipped heights and reach, so the
colonies fill the same placements and their convex collision parts (one per tier plus the pinnacle)
are comparable to the shipped ones. Vertex colour separates living tissue (the variant's tint, pale
margins) from the grey, faintly pink mineral pinnacle under it; the shipped CoralPlate material
(and its textures) is kept by the splice.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for extra in ('tools/art/pass085', 'tools/art/pass083', 'tools/art/pass082', 'tools/art/pass078', 'tools/art/v07',
              'tools/art/pass077'):
    sys.path.insert(0, str(ROOT / extra))
import variants as v85  # noqa: E402  (sets up the Pass 082 helpers)
from life import Grid  # noqa: E402
from mammals_sdf import noise3, smin, smooth  # noqa: E402

TAU = math.tau
TRIS = 12000  # Blender's collapse lands at about half of this on these thin laminae

# Each colony: its encrusted base (radius, height) and its tiers: (height of the tier's root, its
# reach, laminae in it). Variant 2 keeps the shipped tank colony's tiers and reach (its collision
# in the tank is the hardscape's own, at those heights); 0 and 1 are the placeable "Plate coral"
# (broad: the catalog shows it 1.15 x 1.05 x 0.65) and "Tiered plate coral" (0.85 x 0.8 x 1.15).
VARIANTS = [
    {'base': (0.6, 0.24), 'tiers': [(0.14, 0.86, 3), (0.3, 0.74, 3), (0.44, 0.52, 2)],
     'tint': (0.62, 0.54, 0.36), 'rim': (0.92, 0.86, 0.66)},
    {'base': (0.58, 0.3), 'tiers': [(0.2, 0.74, 3), (0.45, 0.64, 3), (0.7, 0.52, 3), (0.92, 0.38, 2)],
     'tint': (0.70, 0.50, 0.46), 'rim': (0.94, 0.80, 0.74)},
    {'base': (0.62, 0.3), 'tiers': [(0.22, 0.85, 3), (0.52, 0.72, 3), (0.82, 0.58, 3)],
     'tint': (0.50, 0.54, 0.64), 'rim': (0.80, 0.86, 0.92)},
]


def lamina(p, centre, reach, heading, span, seed, thick=0.03, slope=0.32, cup=0.14):
    """SDF of one cupped lamina: a part whorl round `centre` (heading +- span), rising outward."""
    q = p - centre
    r = np.hypot(q[:, 0], q[:, 2])
    ang = np.arctan2(q[:, 2], q[:, 0])
    dang = np.angle(np.exp(1j * (ang - heading)))
    edge = reach * (1 + 0.1 * noise3(np.stack([np.cos(ang), np.zeros_like(ang), np.sin(ang)], 1) * 2.2, 1, seed)
                    + 0.04 * np.sin(ang * 9 + seed))
    u = np.clip(r / reach, 0, 1.5)
    h = slope * r + cup * u * u * reach + 0.02 * np.sin(ang * 5 + seed) * u
    t = thick * (1 - 0.65 * np.clip(u, 0, 1)) + 0.004
    d = (np.abs(q[:, 1] - h) - t) * 0.85
    d = np.maximum(d, r - edge)
    d = np.maximum(d, (np.abs(dang) - span) * np.maximum(r, 0.05))
    return d, r / np.maximum(edge, 1e-6)


def base_sdf(p, k):
    """The encrusted base: a low, lumpy mound of dead coral rock the colony grew over."""
    br, bh = VARIANTS[k]['base']
    q = p.copy()
    q[:, 1] = (q[:, 1] + 0.06) / bh
    q[:, [0, 2]] /= br
    d = (np.linalg.norm(q, axis=1) - 1) * min(br, bh)
    return d + 0.04 * noise3(p, 6, 9241 + k) + 0.015 * noise3(p, 15, 9251 + k)


def colony(k):
    spec = VARIANTS[k]
    rng = np.random.default_rng(9240 + k)
    top = max(y + r * 0.45 for y, r, _ in spec['tiers']) + 0.1
    g = Grid(np.array([-1.0, -0.2, -1.0]), np.array([1.0, top + 0.1, 1.0]), 0.011)
    p = g.p
    parts = {'base': base_sdf(p, k)}
    # Tiers of overlapping, cupped laminae, each rooted in the one below (or in the base): a
    # pagoda of whorls, never a stalk.
    for i, (y, reach, count) in enumerate(spec['tiers']):
        tier = np.full(len(p), 9.0)
        for j in range(count):
            ang = rng.uniform(0, TAU)
            c = np.array([rng.normal(0, 0.04), y - 0.03 + 0.045 * j, rng.normal(0, 0.04)])
            d, _ = lamina(p, c, reach * rng.uniform(0.82, 1.0), ang, rng.uniform(1.4, 2.6), 9270 + 10 * i + j + 40 * k,
                          thick=0.036, slope=0.2 + 0.08 * rng.random(), cup=0.12)
            tier = np.minimum(tier, d)
        parts[f'tier{i}'] = tier
    g.d = smin(list(parts.values()), 0.035)
    v, f = g.mesh(TRIS, blur=0.5)
    f = v85.clean(v, f)
    # Colour: living tissue (growth rings, pale margins, the underside a little darker) and the
    # grey, faintly pink mineral base under it.
    b = base_sdf(v, k)
    tint, rim = np.array(spec['tint']), np.array(spec['rim'])
    rr = np.hypot(v[:, 0], v[:, 2])
    reach = np.interp(v[:, 1], [y for y, _, _ in spec['tiers']], [r for _, r, _ in spec['tiers']])
    margin = smooth(0.68, 1.0, rr / reach)
    rings = 0.5 + 0.5 * np.sin(rr * 30 + noise3(v, 4, 9290 + k) * 2)
    n = v85.normals(v, f)
    under = smooth(0.3, -0.7, n[:, 1])
    tissue = tint * (0.8 + 0.16 * rings)[:, None] * (1 - margin[:, None]) + rim * margin[:, None]
    tissue *= (1 - 0.14 * under)[:, None]
    rock = smooth(0.02, -0.01, b)
    stone = np.array([0.56, 0.53, 0.5]) * (0.85 + 0.15 * noise3(v, 9, 9295 + k))[:, None] + \
        np.array([0.08, -0.02, 0.0]) * smooth(0.2, 0.8, noise3(v, 3, 9296 + k))[:, None]
    col = tissue * (1 - rock[:, None]) + stone * rock[:, None]
    col *= (0.78 + 0.22 * smooth(-0.15, 0.25, v[:, 1]))[:, None]
    # Collision parts: the base, and each tier's band.
    hulls = [v[b < 0.02]]
    ys = [y for y, _, _ in spec['tiers']] + [top + 1]
    for i, (y, reach_i, _) in enumerate(spec['tiers']):
        band = (v[:, 1] > y - 0.05) & (v[:, 1] < ys[i + 1] - 0.01) & (rr > 0.1)
        if band.sum() >= 8:
            hulls.append(v[band])
    # Four parts, as the shipped plates carry (the pinnacle and three tiers): a fourth tier shares
    # the third's part.
    while len(hulls) > 4:
        hulls[-2] = np.concatenate([hulls[-2], hulls.pop()])
    return v, f, np.clip(col, 0, 1), hulls


def export():
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415
    import cozy_art as ca  # noqa: PLC0415
    ca.reset_scene()
    m = bpy.data.materials.new('CoralPlate')
    m.use_nodes = True
    stats = {}
    for k in range(3):
        v, f, c, hulls = colony(k)
        root = ca.create_root(f'Coral_Plate_{k}_Root', 'reef', standards_pass='092')
        name = f'Coral_Plate_{k}'
        o = ca.mesh_from_arrays(name, v, f, v85.box_uv(v, v85.normals(v, f)),
                                np.concatenate([c, np.ones((len(c), 1))], 1), m, root)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(o.data)
        bm.free()
        for i, pts in enumerate(hulls):
            ca.collider_from_points(f'COLLIDER_{name}_{i}', pts, root)
        stats[name] = (len(f), [round(x, 2) for x in v.min(0)], [round(x, 2) for x in v.max(0)], len(hulls))
        print(name, stats[name], flush=True)
    ca.save_blend(HERE / 'plates.blend')
    raw = ca.export_glb(HERE / 'out' / 'plates.glb')
    print('exported', raw, raw.stat().st_size)


if __name__ == '__main__':
    (HERE / 'out').mkdir(exist_ok=True)
    export()
