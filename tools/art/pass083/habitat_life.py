"""V0.8 Pass 083: reef life (habitat_life.py) composed onto every habitat formation, by the Pass 082B families.

No new species: the colonies are the approved Pass 082B constructions (staghorn thickets and
corymbose bushes, brain and encrusting massive colonies, plating and tabular colonies, leather and
finger soft corals, tube and encrusting sponges), grown at sites on each formation. What changes
from one formation to the next is the composition, so the tank reads as one reef with a hierarchy:

* **Hero colonies** stand where the accepted hardscape corals stood (a brain coral crowning the West
  massif, tabular Acropora on the East massif and the channel terrace, a staghorn thicket on the
  East terraces), so the accepted coral colliders keep their meaning.
* **Secondary structures**: massive fields on the ledges, plating colonies tiered out of the
  vertical faces, a second table where a formation has a high, open top.
* **Attached growth**: bushes, soft corals, tube sponges on the shoulders and encrusting sponges on
  the shaded faces, denser on the massifs, sparse on the outcrops.

Heights, sizes and orientations vary per site (each colony grows along the face it stands on).
"""
from __future__ import annotations

import math

import numpy as np
from scipy.spatial import cKDTree

import habitat as hb
import life as l82
from mammals_sdf import ellipsoid, noise3, round_cone, smin, smooth

rb = hb.rb
# Colonies attach to the Pass 083 rock, not the benchmark's.
l82.rock_sdf = hb.rock_sdf
# The whole tank carries many more colonies than the benchmark section: each is reduced further
# (the relief maps carry the fine corallite detail).
LIFE_BUDGET = 0.48
_mesh = l82.Grid.mesh


def _budget_mesh(self, target, blur=0.5):
    return _mesh(self, max(300, int(target * LIFE_BUDGET)), blur)


l82.Grid.mesh = _budget_mesh
SEED = 83083

# The hardscape colonies this pass replaces (their accepted positions, aquarium metres).
HEROES = {
    'brain': np.array([-14.9531, 1.8304, -7.6018]),
    'thicket': np.array([14.3712, 1.5612, -0.1204]),
    'table-massif': np.array([10.8945, 2.9542, -9.4807]),
    'table-channel': np.array([7.9389, 2.0718, -4.5262]),
}
# How much life each formation carries: (heads, plates, leathers, fingers, bushes, tubes, crusts).
DENSITY = {
    'WestMassif': (16, 9, 4, 4, 8, 4, 7),
    'EastMassif': (16, 9, 4, 4, 8, 4, 7),
    'WestTerraces': (13, 7, 3, 3, 6, 3, 6),
    'EastTerraces': (15, 8, 3, 3, 7, 3, 6),
    'EastChannel': (12, 6, 2, 3, 6, 3, 5),
    'WestOutcrops': (5, 2, 1, 2, 2, 1, 3),
    'EastOutcrops': (6, 2, 1, 2, 2, 1, 3),
}
# Secondary tables where a formation has a high, open top (crest sites, from the water).
TABLES = {'WestMassif': ((-12.6, 5.0, -8.2), 0.5), 'WestTerraces': ((-14.2, 5.0, -2.8), 0.46)}


def site(above, below=None):
    """The point where a vertical ray (or a ray from `above` toward `below`) meets the rock."""
    a = np.asarray(above, float)
    b = a - (0, 4, 0) if below is None else np.asarray(below, float)
    return l82.site(a, b)


def thicket_at(base, n, rng, scale=0.8):
    segs = l82.thicket_skeleton(base + n * 0.02, rng, scale, 12)
    pts = np.array([s[1] for s in segs] + [s[0] for s in segs])
    lo, hi = pts.min(0) - 0.1, pts.max(0) + 0.1
    lo[1] = base[1] - 0.12
    g = l82.Grid(lo, hi, 0.012)
    g.d = ellipsoid(g.p, base, (0.48 * scale, 0.07, 0.44 * scale))
    for a, b, ra, rb_, _ in segs:
        m = np.all((g.p > np.minimum(a, b) - ra - 0.03) & (g.p < np.maximum(a, b) + ra + 0.03), axis=1)
        if m.any():
            g.d[m] = smin([g.d[m], round_cone(g.p[m], a, b, ra, rb_)], 0.012)
    g.d += 0.0025 * noise3(g.p, 60, 3)
    v, f = g.mesh(24000, blur=0.45)
    tipness = np.array([s[4] for s in segs])
    mids = np.array([(s[0] + s[1]) / 2 for s in segs])
    _, idx = cKDTree(mids).query(v)
    t = tipness[idx]
    t = np.where(np.linalg.norm(v - base, axis=1) < 0.3, t * 0.3, t)
    base_c, body_c, tip_c = np.array([0.33, 0.24, 0.15]), np.array([0.6, 0.45, 0.26]), np.array([0.84, 0.78, 0.6])
    col = base_c + (body_c - base_c) * smooth(0.0, 0.5, t)[:, None]
    col = col + (tip_c - col) * smooth(0.95, 1.0, t)[:, None]
    col *= np.stack([1 + 0.06 * noise3(v, 2.5, 5), 1 + 0.05 * noise3(v, 2.5, 6), 1 + 0.03 * noise3(v, 2.5, 7)], 1)
    hull = v[(v[:, 1] < base[1] + 0.3) & (np.hypot(v[:, 0] - base[0], v[:, 2] - base[2]) < 0.5)]
    return v, f, np.clip(col, 0, 1), hull


def brain_at(top, size=0.85):
    c = top + np.array([0, 0.02, 0])
    lo, hi = c - np.array([0.85, 0.15, 0.8]) * size, c + np.array([0.85, 0.55, 0.8]) * size
    g = l82.Grid(lo, hi, 0.01)
    q = g.p - c
    dome = ellipsoid(g.p, c, np.array([0.6, 0.42, 0.55]) * size)
    skirt = ellipsoid(g.p, c + (0, -0.04, 0), np.array([0.78, 0.12, 0.72]) * size)
    d = smin([dome, skirt], 0.08)
    d = np.maximum(d, -q[:, 1] - 0.06)
    d += 0.018 * l82.meander(g.p) + 0.003 * noise3(g.p, 70, 43)
    g.d = d
    v, f = g.mesh(12000, blur=0.3)
    val = l82.meander(v)
    ridge_c, valley_c = np.array([0.7, 0.64, 0.44]), np.array([0.34, 0.4, 0.3])
    col = ridge_c * (1 - val[:, None]) + valley_c * val[:, None]
    col *= (1 - 0.35 * smooth(0.0, -0.08, v[:, 1] - c[1]))[:, None]
    return v, f, col, v


def surface_sites(v, f, rng, keep=0.3):
    n = l82.normals(v, f)
    ys = v[:, 1] - rb.SAND(v[:, [0, 2]])
    m = rng.random(len(v)) < keep
    return v[m], n[m], ys[m]


def merge(items):
    vs, fs, cs, off = [], [], [], 0
    for v, f, c in items:
        vs.append(v)
        fs.append(f + off)
        cs.append(c)
        off += len(v)
    if not vs:
        return np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros((0, 3))
    return np.vstack(vs), np.vstack(fs), np.clip(np.vstack(cs), 0, 1)


TINTS = [(0.62, 0.52, 0.32), (0.46, 0.38, 0.26), (0.44, 0.46, 0.32), (0.5, 0.36, 0.38),
         (0.42, 0.46, 0.42), (0.68, 0.6, 0.44)]
BUSH_TIPS = [(0.84, 0.78, 0.6), (0.58, 0.7, 0.82), (0.72, 0.56, 0.7), (0.74, 0.8, 0.56)]
SPONGE_TINTS = [(0.5, 0.3, 0.62), (0.86, 0.62, 0.22), (0.66, 0.3, 0.38), (0.4, 0.36, 0.62)]
CRUST_TINTS = [(0.84, 0.4, 0.18), (0.88, 0.64, 0.2), (0.7, 0.26, 0.24), (0.52, 0.34, 0.56)]


def massive_field(p, n, r, seed, tint):
    """Pass 082B's encrusting massive colony at the sizes a whole reef needs (up to ~1 m across):
    many small fused hummocks (never a few big smooth lobes), its knobs and pits scaled with it,
    its grid only a little coarser than a small head's."""
    voxel = max(0.009, r * 0.022)
    lo, hi = p - r * 1.6, p + r * 1.6
    g = l82.Grid(lo, hi, voxel)
    rng = np.random.default_rng(seed)
    u, w = l82.orthonormal(n)
    lobes = []
    count = int(14 + 40 * max(0.0, r - 0.25))
    for _ in range(count):
        a, rad = rng.uniform(0, math.tau), r * math.sqrt(rng.random()) * 0.95
        o = (u * math.cos(a) + w * math.sin(a)) * rad
        h = r * (0.3 - 0.24 * rad / r) * rng.uniform(0.6, 1.1)
        s_ = r * rng.uniform(0.14, 0.28) if r > 0.3 else r * rng.uniform(0.28, 0.45)
        lobes.append(ellipsoid(g.p, p + o + n * h * 0.5, (s_, s_ * 0.62, s_)))
    d = smin(lobes, r * 0.07)
    d = np.maximum(d, -((g.p - p) @ n) - r * 0.05)
    d += max(0.012, r * 0.03) * noise3(g.p, 22 / max(1.0, r * 2.5), seed)
    d += 0.008 * smooth(0.5, 0.15, rb.worley(g.p, max(0.022, voxel * 2.2), seed))
    g.d = d
    v, f = g.mesh(1500 if r < 0.3 else 4400, blur=0.3)
    up = smooth(0.0, r * 0.5, (v - p) @ n)
    mottle = noise3(v, 7, seed + 1)
    col = np.tile(tint, (len(v), 1)) * (0.68 + 0.34 * up + 0.14 * mottle)[:, None]
    return v, f, col


def build_one(k, name, rock):
    """One formation's colonies (deterministic per formation, so formations build in parallel)."""
    rng = np.random.default_rng(SEED + 17 * k)
    form = hb.FORMS[name]
    colliders = {}
    seats = [(hb.DEN_MOUTH + hb.DEN_AXIS * 0.3, 1.0), (hb.FROG, 0.9)]
    fam = {'branching': [], 'massive': [], 'soft': [], 'sponge': []}
    taken = list(seats)
    lo, hi = form.lo, form.hi
    for hero, at in HEROES.items():
        if not np.all((at >= lo) & (at <= hi)):
            continue
        p, n = site(at + (0, 1.6, 0), at - (0, 1.5, 0))
        if hero == 'brain':
            v, f, c, hull = brain_at(p)
            fam['massive'].append((v, f, c))
        elif hero == 'thicket':
            v, f, c, hull = thicket_at(p, n, rng)
            fam['branching'].append((v, f, c))
        else:
            v, f, c = l82.table(p, 0.62 if hero == 'table-massif' else 0.56, 451 + len(colliders))
            hull = v[v[:, 1] < p[1] + 0.45]
            fam['branching'].append((v, f, c))
        colliders[hero] = hull
        taken.append((p, 1.0))
    if name in TABLES:
        at, size = TABLES[name]
        p, _ = site(at)
        fam['branching'].append(l82.table(p, size, 470 + k))
        taken.append((p, 0.9))
    v0, f0 = rock[0], rock[1]
    sv, sn, sy = surface_sites(v0, f0, rng)
    heads, plates_n, leathers, fingers, bushes, tubes, crusts = DENSITY[name]
    pick = l82.pick
    toward = -np.sign(sv[:, 0]) * sn[:, 0]
    # Massive fields: a few big ones that cover a ledge, more medium and small ones around them.
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] > 0.5) & (sy > 0.3), heads, 0.7, taken, rng)):
        r = (0.42 + 0.14 * rng.random()) if j % 4 == 0 else 0.18 + 0.24 * rng.random() ** 1.3
        fam['massive'].append(massive_field(sv[i], sn[i], r, 1000 * k + 300 + j,
                                            np.array(TINTS[(j + k) % len(TINTS)])))
    for j, i in enumerate(pick(sv, sn, (np.abs(sn[:, 1]) < 0.35) & (sy > 0.4) & (sy < 2.6), plates_n,
                               0.7, taken, rng, np.clip(toward, 0, 1))):
        fam['massive'].append(l82.plates(sv[i] - sn[i] * 0.03, sn[i], 0.34 + 0.34 * rng.random(),
                                         1000 * k + 400 + j, np.array(TINTS[(j + 2 + k) % 6]) * 0.85))
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] > 0.75) & (sy > 0.8), leathers, 0.9, taken, rng)):
        fam['soft'].append(l82.leather(sv[i] - sn[i] * 0.02, sn[i], 0.22 + 0.18 * rng.random(),
                                       1000 * k + 500 + j))
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] > 0.6) & (sy > 0.5), fingers, 0.8, taken, rng)):
        fam['soft'].append(l82.fingers(sv[i] - sn[i] * 0.02, sn[i], 0.14 + 0.08 * rng.random(),
                                       1000 * k + 550 + j))
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] > 0.6) & (sy > 0.5), bushes, 0.75, taken, rng)):
        fam['branching'].append(l82.bush(sv[i] - sn[i] * 0.02, sn[i], 0.3 + 0.22 * rng.random(),
                                         1000 * k + 800 + j, BUSH_TIPS[(j + k) % 4]))
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] > 0.5) & (sy > 0.3) & (sy < 1.8), tubes, 1.0, taken,
                               rng)):
        fam['sponge'].append(l82.tube_sponges(sv[i] - sn[i] * 0.03, sn[i], 0.14 + 0.12 * rng.random(),
                                              1000 * k + 600 + j, np.array(SPONGE_TINTS[(j + k) % 4])))
    for j, i in enumerate(pick(sv, sn, (sn[:, 1] < 0.15) & (sy > 0.25), crusts, 0.7, taken, rng)):
        fam['sponge'].append(l82.crust(sv[i], sn[i], 0.18 + 0.16 * rng.random(), 1000 * k + 700 + j,
                                       np.array(CRUST_TINTS[(j + k) % 4])))
    out = {key: merge(items) for key, items in fam.items()}
    print('life', name, {key: len(v[1]) for key, v in out.items()}, flush=True)
    return name, out, colliders


def build(rocks):
    """{formation: {family: (v, f, c)}}, and the hero colliders (name -> points). Formations grow
    in parallel (one process each, up to the machine's cores)."""
    import multiprocessing as mp  # noqa: PLC0415
    jobs = [(k, name, rocks[name]) for k, name in enumerate(hb.FORMS)]
    # Largest first, so the long ones start early.
    jobs.sort(key=lambda j: -len(j[2][1]))
    with mp.get_context('fork').Pool(min(4, mp.cpu_count())) as pool:
        results = pool.starmap(build_one, jobs)
    out, colliders = {}, {}
    for name, fams, coll in results:
        out[name] = fams
        colliders.update(coll)
    return {n: out[n] for n in hb.FORMS}, colliders
