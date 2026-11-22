"""V0.8 Pass 083: the personal aquarium's reef habitat, by the approved Pass 082 method.

    python3 tools/art/pass083/build.py          # builds every mesh and exports reef-habitat.glb

Pass 082 rebuilt one section (the left channel bank). This pass applies the same method to every
other reef rock in the tank, so the accepted field of 28 separate rounded boulders becomes seven
composed reef formations with a clear hierarchy:

* **Major formations** at the back of each bank: the West massif (the moray's reef) and the East
  massif (around the crevice), the tallest, most layered structures.
* **Secondary terraces** along each bank: stepped, ledged bodies of tilted beds that lead the eye
  from the massifs toward the channel.
* **Satellite patch reefs** at the front: low outcrops with sand halos, which keep the front of the
  tank open and give the composition its negative space.

How each formation is built (see docs/V08_HABITAT_OVERHAUL.md):

1. **Envelope**: the accepted rock hulls (``layout.json``, exported from the game). Every element is
   clipped to its rocks' hulls (grown by ``PROUD``), so fish, the swimmer, creature homes and the
   tank editor keep the space they already know. Only low ``saddles`` (<= 0.7 m) of cemented rubble
   bridge the narrow sand gaps between neighbouring rocks of one formation, so a formation reads as
   one structure instead of a row of separate stones.
2. **Composed masses** per rock: a broad undercut foot, a tilted bedding slab with a ledge above it,
   and a smaller cap or a pair of pinnacles; some rocks carry a cantilevered shelf. Rock heights are
   varied on purpose (``HEIGHT``), so neighbouring masses step instead of repeating.
3. **Tertiary detail**: the Pass 082B fracture planes, flattened fossil lobes, porosity and pockets,
   and form-driven painting (fresh fractures, worn edges, silted hollows, turf and coralline).

Creature homes are sculpted in: the moray's den is a tunnel through solid rock at its mouth, and the
frogfish's perch is a seat on top of its rock at the height it already rests at.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import RegularGridInterpolator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for extra in ('tools/art/pass082', 'tools/art/pass078', 'tools/art/v07', 'tools/art/pass077'):
    sys.path.insert(0, str(ROOT / extra))
import reef_benchmark as rb  # noqa: E402
from mammals_sdf import ellipsoid, round_cone, smax, smin  # noqa: E402

LAYOUT = json.loads((HERE / 'layout.json').read_text())
CREATURES = json.loads((HERE / 'creatures.json').read_text())

# The whole tank's sand (the Pass 082 section covered only its own corner).
_sand = np.array(LAYOUT['sand'])
_sx, _sz = np.unique(np.round(_sand[:, 0], 4)), np.unique(np.round(_sand[:, 1], 4))
SAND = RegularGridInterpolator((_sx, _sz), _sand[:, 2].reshape(len(_sx), len(_sz)),
                               bounds_error=False, fill_value=None)
rb.SAND = SAND

ROCKS = {r['name']: r for r in LAYOUT['rocks'] if r['solid']}
DEN_MOUTH = np.array([CREATURES['den']['mouth'][k] for k in 'xyz'])
DEN_AXIS = np.array([CREATURES['den']['axis'][k] for k in 'xyz'])
FROG = np.array([CREATURES['frogfish']['position'][k] for k in 'xyz'])
FROG_UP = np.array([CREATURES['frogfish']['orientation'][k] for k in 'xyz'])
# Moray den (MORAY_DEN in src/creatures/MorayBehavior.ts).
DEN_RADIUS, DEN_DEPTH = 0.3, 0.8
PROUD = 0.12

# The seven formations: accepted rocks grouped by where they already stand (hull gaps < 1.5 m).
FORMATIONS = {
    'WestMassif': ['Rock 3', 'Rock 33', 'Rock 9', 'Rock 21', 'Rock 25'],
    'WestTerraces': ['Rock 1', 'Rock 5', 'Rock 15', 'Rock 27'],
    'WestOutcrops': ['Rock 29', 'Rock 23'],
    'EastMassif': ['Rock 28', 'Rock 18', 'Rock 2', 'Rock 8'],
    'EastTerraces': ['Rock 14', 'Rock 12', 'Rock 6', 'Rock 10', 'Rock 16', 'Rock 20'],
    'EastChannel': ['Rock 22', 'Rock 26', 'Rock 4', 'Rock 34', 'Rock 32'],
    'EastOutcrops': ['Rock 24', 'Rock 30'],
}
# Fraction of each rock's hull height the composed rock uses: the massifs stand tall, the
# terraces step down toward the channel, the outcrops stay low (the rest of the hull is water).
HEIGHT = {
    'Rock 3': 1.0, 'Rock 33': 0.8, 'Rock 9': 0.85, 'Rock 21': 0.75, 'Rock 25': 0.95,
    'Rock 1': 0.95, 'Rock 5': 0.78, 'Rock 15': 0.7, 'Rock 27': 0.66,
    'Rock 29': 0.62, 'Rock 23': 0.72,
    'Rock 28': 0.92, 'Rock 18': 1.0, 'Rock 2': 0.96, 'Rock 8': 0.8,
    'Rock 14': 0.95, 'Rock 12': 0.72, 'Rock 6': 0.8, 'Rock 10': 0.82, 'Rock 16': 0.9, 'Rock 20': 0.7,
    'Rock 22': 0.9, 'Rock 26': 0.95, 'Rock 4': 0.7, 'Rock 34': 1.0, 'Rock 32': 0.85,
    'Rock 24': 0.74, 'Rock 30': 0.8,
}
# Cantilevered shelves: (rock, compass angle of the shelf's reach in degrees, 0 = +x, 90 = +z).
SHELVES = {'Rock 27': 0, 'Rock 1': 60, 'Rock 25': 30, 'Rock 22': 180, 'Rock 20': 200,
           'Rock 2': 200, 'Rock 24': 160, 'Rock 10': 120}
# Rocks whose top splits into two pinnacles instead of one cap.
PINNACLES = {'Rock 3', 'Rock 18', 'Rock 14', 'Rock 25', 'Rock 28'}
# Grottos and undercut caves facing open water: (formation, centre, radii).
CAVES = {
    'WestTerraces': [((-11.0, 0.45, -1.4), (0.55, 0.42, 0.7))],
    'EastChannel': [((5.1, 0.5, -3.6), (0.5, 0.4, 0.75))],
    'EastTerraces': [((10.0, 0.45, -0.5), (0.6, 0.4, 0.55))],
    'EastMassif': [((7.6, 0.55, -6.7), (0.65, 0.48, 0.6))],
}


def interior(name, n=12000, seed=0):
    r = ROCKS[name]
    lo = np.array([r['min'][k] for k in 'xyz'])
    hi = np.array([r['max'][k] for k in 'xyz'])
    p = lo + np.random.default_rng(seed).random((n, 3)) * (hi - lo)
    return p[rb.hull_sdf(p, r['planes']) < 0]


def rock_elements(name, seed):
    """The composed masses of one accepted rock (inside its hull)."""
    pts = interior(name, seed=seed)
    sand = SAND(pts[:, [0, 2]])
    pts = pts[pts[:, 1] > sand - 0.05]
    c2 = pts[:, [0, 2]].mean(0)
    cov = np.cov((pts[:, [0, 2]] - c2).T)
    w, vec = np.linalg.eigh(cov)
    main = vec[:, 1]
    across = vec[:, 0]
    proj_l = (pts[:, [0, 2]] - c2) @ main
    proj_w = (pts[:, [0, 2]] - c2) @ across
    L = np.percentile(proj_l, 98) - np.percentile(proj_l, 2)
    W = np.percentile(proj_w, 98) - np.percentile(proj_w, 2)
    s = float(SAND(c2[None])[0])
    top = ROCKS[name]['max']['y']
    H = (top - s) * HEIGHT[name]
    phi = math.atan2(main[1], main[0])
    yaw = -math.degrees(phi)
    rng = np.random.default_rng(3000 + seed)
    m3 = np.array([main[0], 0, main[1]])
    a3 = np.array([across[0], 0, across[1]])
    c = np.array([c2[0], 0, c2[1]])
    k = name.split()[-1]
    side = 1 if rng.random() < 0.5 else -1
    # A stepped profile, never the hull's dome: a low undercut plinth, a strongly tilted bedding
    # slab offset to one side (its overhanging edge is the ledge), and a smaller, offset cap or a
    # pair of pinnacles. The hull clips whatever overreaches into flat, fractured faces.
    tilt = rng.uniform(6, 13) * (1 if rng.random() < 0.5 else -1)
    out = [
        rb.Element(f'r{k}-foot', c + (0, s + 0.17 * H, 0), (L * 0.98, 0.44 * H, W * 0.94),
                   yaw=yaw + rng.uniform(-8, 8), under=0.42, seed=seed * 10 + 1),
        rb.Element(f'r{k}-bed', c + m3 * L * 0.12 * side + a3 * W * 0.05 + (0, s + 0.5 * H, 0),
                   (L * 0.84, 0.3 * H, W * 0.78), yaw=yaw + rng.uniform(-22, 22),
                   rx=rng.uniform(-5, 5), rz=tilt, under=0.3, seed=seed * 10 + 2),
    ]
    if name in PINNACLES:
        for j, (f, hgt) in enumerate(((0.24, 0.84), (-0.24, 0.7))):
            out.append(rb.Element(
                f'r{k}-pinnacle{j}', c + m3 * L * f - a3 * W * 0.08 * side + (0, s + hgt * H, 0),
                (L * 0.3, 0.34 * H, W * 0.36), yaw=yaw + rng.uniform(-30, 30), rx=rng.uniform(-8, 8),
                rz=rng.uniform(-8, 8), under=0.25, seed=seed * 10 + 3 + j))
    else:
        out.append(rb.Element(
            f'r{k}-cap', c - m3 * L * 0.16 * side + a3 * W * 0.1 + (0, s + 0.77 * H, 0),
            (L * 0.5, 0.34 * H, W * 0.48), yaw=yaw + rng.uniform(-35, 35), rx=rng.uniform(-8, 8),
            rz=-tilt * 0.6, under=0.3, seed=seed * 10 + 3))
    if name in SHELVES:
        a = math.radians(SHELVES[name])
        d = np.array([math.cos(a), 0, math.sin(a)])
        reach = np.percentile(pts[:, [0, 2]] @ d[[0, 2]] - c2 @ d[[0, 2]], 97)
        out.append(rb.Element(
            f'r{k}-shelf', c + d * reach * 0.62 + (0, s + 0.52 * H, 0), (reach * 0.85, 0.2, W * 0.5),
            yaw=-SHELVES[name] + rng.uniform(-10, 10), rz=rng.uniform(-6, 2), under=0.08, seed=seed * 10 + 6))
    return out


def saddle(a, b, seed):
    """A low bridge of cemented rubble across the sand gap between two rocks of one formation."""
    pa = interior(a, 8000, 7)
    pb = interior(b, 8000, 8)
    pa = pa[pa[:, 1] < SAND(pa[:, [0, 2]]) + 0.6]
    pb = pb[pb[:, 1] < SAND(pb[:, [0, 2]]) + 0.6]
    from scipy.spatial import cKDTree
    dist, idx = cKDTree(pa[:, [0, 2]]).query(pb[:, [0, 2]])
    j = int(np.argmin(dist))
    qa, qb = pa[idx[j]], pb[j]
    gap = float(dist[j])
    mid = (qa + qb) / 2
    d = qb - qa
    yaw = -math.degrees(math.atan2(d[2], d[0]))
    s = float(SAND(mid[None, [0, 2]])[0])
    rng = np.random.default_rng(4000 + seed)
    h = 0.5 + 0.18 * rng.random()
    return rb.Element(f'saddle-{a.split()[-1]}-{b.split()[-1]}', (mid[0], s + h * 0.2, mid[2]),
                      (gap + 1.5, h, 1.0 + 0.4 * rng.random()), yaw=yaw, rx=rng.uniform(-5, 5),
                      under=0.12, chip=1.4, seed=5000 + seed), gap


class HabitatFormation(rb.Formation):
    """A Pass 082 formation whose composed masses stay inside their accepted rock hulls."""

    def __init__(self, name, rocks, seed):
        self.name = name
        self.rocks = rocks
        self.hulls = [ROCKS[r]['planes'] for r in rocks]
        masses = []
        for i, r in enumerate(rocks):
            masses += rock_elements(r, seed + i)
        self.saddles = []
        for i, a in enumerate(rocks):
            for b in rocks[i + 1:]:
                e, gap = saddle(a, b, seed + len(self.saddles))
                if 0.05 < gap < 1.5:
                    self.saddles.append(e)
        if name == 'WestMassif':
            # The moray's den: a block of solid rock around the tunnel, flush with its mouth.
            masses.append(rb.Element('den-block', DEN_MOUTH - DEN_AXIS * 0.6, (1.3, 1.0, 1.0),
                                     yaw=-math.degrees(math.atan2(DEN_AXIS[2], DEN_AXIS[0])),
                                     under=0.0, chip=0.5, seed=6001))
        if name == 'EastChannel':
            # The frogfish's seat: a flat-topped boss at the height its perch already has.
            masses.append(rb.Element('frog-seat', FROG - FROG_UP * 0.22, (1.0, 0.44, 0.9), yaw=20,
                                     under=0.1, chip=0.4, seed=6002))
        self.masses = masses
        super().__init__(masses + self.saddles, self.details)

    @staticmethod
    def _sdf(e, p):
        """An element's distance, evaluated exactly only near it (a bound elsewhere): the
        formations span many metres and most voxels are far from most masses."""
        r = float(np.linalg.norm(e.h)) * 1.25 + 0.35
        far = np.linalg.norm(p - e.c, axis=1) - r
        out = far + r * 0.2
        near = far < 0.3
        if near.any():
            out[near] = e.sdf(p[near])
        return out

    def envelope(self, p):
        d = smin([self._sdf(e, p) for e in self.masses], 0.2)
        clip = np.min([rb.hull_sdf(p, h) for h in self.hulls], 0) - PROUD
        d = smax(d, clip, 0.04)
        if self.saddles:
            d = smin([d] + [self._sdf(e, p) for e in self.saddles], 0.14)
        return d

    def details(self, p, env):
        # Porosity only in the band around the surface (Pass 082 evaluated it for all the water).
        d = env.copy()
        band = (env > -0.25) & (env < 0.2)
        if band.any():
            d[band] = rb.porous(p[band], env[band], 880 + len(self.name), 0.45)
        for c, r in CAVES.get(self.name, []):
            d = smax(d, -ellipsoid(p, c, r), 0.1)
        if self.name == 'WestMassif':
            tunnel = round_cone(p, DEN_MOUTH + DEN_AXIS * 0.35, DEN_MOUTH - DEN_AXIS * DEN_DEPTH,
                                DEN_RADIUS + 0.02, DEN_RADIUS)
            d = smax(d, -tunnel, 0.05)
        return d


def formations():
    return {name: HabitatFormation(name, rocks, 100 * (i + 1)) for i, (name, rocks) in
            enumerate(FORMATIONS.items())}


FORMS = formations()


def rock_sdf(p):
    """Every formation's surface (only those whose box reaches `p`), for colony sites and crusts."""
    p = np.atleast_2d(p)
    lo, hi = p.min(0), p.max(0)
    # Outside every formation's box the distance to the nearest box is a safe bound (a constant
    # would let a ray march step straight through the rock).
    d = np.full(len(p), 9.0)
    for f in FORMS.values():
        if np.any(hi < f.lo) or np.any(lo > f.hi):
            gap = np.linalg.norm(np.maximum(np.maximum(f.lo - p, p - f.hi), 0), axis=1)
            d = np.minimum(d, gap + 0.01)
            continue
        d = np.minimum(d, f.details(p, f.envelope(p)))
    return d
