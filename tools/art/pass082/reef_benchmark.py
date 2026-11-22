"""V0.8 Pass 082: the reference-driven aquarium reef benchmark section.

    python3 tools/art/pass082/reef_benchmark.py            # build the GLB and the .blend
    node tools/art/pass017/compress.mjs public/assets/models/reef

The left bank of the central channel is rebuilt as one composed reef: a ridge (rocks 7, 11, 13, 19
and 31 of the accepted layout, whose hulls overlap) and a satellite bommie (rock 17). The work is
authored in aquarium world space (metres), so the runtime places nothing.

How the forms are decided (see docs/V08_REEF_BENCHMARK.md):

1. **Primary mass**: the accepted rock hulls (`section.json`, exported from the game) fused into one
   formation. The union is the envelope that the fish habitat and colliders already know, so
   nothing new blocks a fish or the swimmer.
2. **Composed secondary forms**, placed by hand at chosen coordinates: a channel-side undercut
   (the bioeroded notch of a reef's foot), three dipping bedding seams with ledges above them,
   spur-and-groove channels on the exposed faces, saddles that split the crest into separate
   pinnacles, two grottos facing the channel, and protected seats for the host anemone and the
   branching colony.
3. **Tertiary detail**, procedural and restrained: solution pits and pockets, fine erosion.

Coral colonies, sponges and soft corals are composed onto that rock (``life.py``), and the plant
clusters are placed in its sand pockets (``vegetation.py``).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass078'))
from mammals_sdf import ellipsoid, noise3, smax, smin, smooth  # noqa: E402

SECTION = json.loads((HERE / 'section.json').read_text())
RIDGE = ['Rock 7', 'Rock 11', 'Rock 13', 'Rock 19', 'Rock 31']
BOMMIE = ['Rock 17']
# Living things that sit on this rock and must keep their seat (aquarium metres).
ANEMONE = np.array([-7.2268, 2.2608, 0.9917])
BRANCHING = np.array([-5.5759, 2.0985, -0.0842])
MASSIVE = np.array([-5.6246, 1.2735, -5.4200])
# How far the rendered rock may stand proud of the accepted hulls (fish keep more clearance).
PROUD = 0.12

_sand = np.array(SECTION['sand'])
_sx, _sz = np.unique(_sand[:, 0]), np.unique(_sand[:, 1])
SAND = RegularGridInterpolator((_sx, _sz), _sand[:, 2].reshape(len(_sx), len(_sz)),
                               bounds_error=False, fill_value=None)


def rock(name):
    return next(r for r in SECTION['all'] if r['name'] == name)


def hull_sdf(p, planes):
    P = np.asarray(planes, float)
    return (p @ P[:, :3].T - P[:, 3]).max(1)


def worley(p, cell, seed):
    rng = np.random.default_rng(seed)
    q = p / cell
    base = np.floor(q)
    best = np.full(len(p), 9.0)
    off = rng.random(3) * 10
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                g = base + (dx, dy, dz)
                h = np.sin(g @ np.array([127.1, 311.7, 74.7]) + off[0]) * 43758.5453
                j = np.stack([h % 1, (h * 1.37) % 1, (h * 2.11) % 1], 1)
                best = np.minimum(best, np.linalg.norm(g + j - q, axis=1))
    return best


def ridged(p, scale, seed, octaves=3):
    out = np.zeros(len(p))
    amp = 1.0
    for o in range(octaves):
        out += amp * (1 - np.abs(noise3(p, scale * 2 ** o, seed + o)))
        amp *= 0.5
    return out / (2 - 2 ** (1 - octaves))



def rot(yaw, rx=0.0, rz=0.0):
    """Element orientation: yaw about +Y, then tilts about the element's own X and Z (degrees)."""
    a, b, c = (math.radians(t) for t in (yaw, rx, rz))
    Ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(b), -math.sin(b)], [0, math.sin(b), math.cos(b)]])
    Rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


class Element:
    """One composed mass: a slab, block or shelf of reef rock (centre, full size, orientation),
    with its own erosion: an undercut lower face, chipped edges and fracture lines."""

    def __init__(self, name, centre, size, yaw=0.0, rx=0.0, rz=0.0, under=0.18, chip=1.0, seed=0):
        self.name = name
        self.c = np.asarray(centre, float)
        self.h = np.asarray(size, float) / 2
        self.R = rot(yaw, rx, rz)
        self.under, self.chip, self.seed = under, chip, seed

    def local(self, p):
        return (p - self.c) @ self.R

    def lobes(self):
        """Lobate heads of fossil coral along the rim and top: reef rock is a framework of old
        colonies, so every mass carries a few knobbly lobes of its own (deterministic)."""
        rng = np.random.default_rng(1000 + self.seed)
        out = []
        n = int(2 + 1.5 * self.h[0] * self.h[2])
        for k in range(min(n, 6)):
            a = rng.random() * math.tau
            rim = 0.55 + 0.4 * rng.random()
            lp = np.array([math.cos(a) * self.h[0] * rim, self.h[1] * (0.45 + 0.5 * rng.random()),
                           math.sin(a) * self.h[2] * rim])
            r = self.h.min() * (0.55 + 0.5 * rng.random()) + 0.08
            # V0.8 Pass 082B: flattened into the rim, so they read as worn fossil heads, not spheres.
            out.append((self.c + self.R @ lp, np.array([r * 1.3, r * 0.5, r * 1.15])))
        return out

    def facets(self):
        """Fracture planes (V0.8 Pass 082B): flat, crisp-edged broken faces of fresh mineral cut
        across each mass, so the rock reads as fractured limestone and not as soft clay."""
        rng = np.random.default_rng(2000 + self.seed)
        out = []
        for _ in range(4):
            a = rng.uniform(0, math.tau)
            d = np.array([math.cos(a), rng.uniform(-0.15, 0.75), math.sin(a)])
            d /= np.linalg.norm(d)
            n = self.R @ d
            # How far the mass reaches along this normal, and a cut a little inside that.
            reach = np.abs((self.R.T @ n)) @ self.h
            out.append((n, n @ self.c + reach * rng.uniform(0.68, 0.86)))
        return out

    def facet_distance(self, p):
        """Distance to the nearest fracture plane (small on a fractured face)."""
        return np.min([np.abs(p @ n - o) for n, o in self.facets()], 0)

    def sdf(self, p):
        # Lobed, irregular outlines: the element's frame is warped at the scale of the element,
        # so no edge runs straight and no plan is a rectangle.
        warp = self.h.min() * 0.38
        w = np.stack([noise3(p, 0.9, 700 + self.seed), noise3(p, 0.9, 760 + self.seed) * 0.4,
                      noise3(p, 0.9, 780 + self.seed)], 1) * warp
        l = self.local(p + w)
        r = 0.36 * self.h.min()
        q = np.abs(l) - (self.h - r)
        d = np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - r
        u = l / self.h
        # The lower part of every mass is eaten back, so its upper edge overhangs as a lip.
        d += self.under * self.h.min() * np.clip((0.15 - u[:, 1]) / 1.15, 0, 1) ** 1.6
        # Undulating tops and faces at two scales; chipped, weathered edges.
        d += 0.09 * self.h.min() * noise3(p, 2.0, 800 + self.seed) + 0.03 * noise3(p, 5.0, 820 + self.seed)
        a = np.sort(np.abs(u), axis=1)[:, 1]
        d += 0.05 * self.chip * smooth(0.6, 0.98, a) * (0.5 + 0.5 * noise3(p, 3.0, 840 + self.seed))
        lobes = [ellipsoid(p, c, r) + 0.03 * noise3(p, 4.0, 860 + self.seed) for c, r in self.lobes()]
        d = smin([d, *lobes], 0.07)
        for n, o in self.facets():
            d = smax(d, p @ n - o, 0.012)
        return d

    def corners(self):
        s = np.array([[i, j, k] for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)], float)
        return self.c + (s * self.h) @ self.R.T


# The ridge, composed mass by mass (aquarium metres; the sand lies at y ~ 0). From the channel:
# a flat-topped buttress carrying the branching colony with a shelf cantilevered over a grotto,
# a stepped terrace holding the host anemone's pocket, a three-tier tower at the far end joined to
# a low spur of tilted slabs by an arch, and a talus of slabs sloping into the sand.
RIDGE_ELEMENTS = [
    # Rock 7: the buttress and its shelf (the focal end, facing the channel).
    Element('buttress-foot', (-5.75, 0.5, 0.1), (3.0, 1.25, 2.6), yaw=20, under=0.35, seed=1),
    Element('buttress-bed', (-5.4, 1.32, -0.05), (2.9, 0.55, 2.4), yaw=34, rx=3, rz=-5, seed=2),
    Element('buttress-top', (-5.6, 1.86, 0.0), (2.2, 0.46, 2.0), yaw=8, rz=4, under=0.25, seed=3),
    Element('channel-shelf', (-4.15, 1.22, 0.65), (1.4, 0.26, 1.6), yaw=24, rz=-7, under=0.1, seed=4),
    # Rock 11: the terrace (the anemone's pocket sits on its top at y 2.26) and a knob behind it.
    Element('terrace-foot', (-7.45, 0.58, 1.25), (3.1, 1.25, 2.9), yaw=-16, under=0.32, seed=5),
    Element('terrace-bed', (-7.3, 1.4, 1.05), (2.6, 0.62, 2.35), yaw=41, rx=5, seed=6),
    Element('terrace-top', (-7.3, 2.0, 0.95), (1.6, 0.5, 1.45), yaw=14, under=0.2, seed=7),
    Element('terrace-knob', (-8.05, 2.32, 1.65), (0.95, 0.9, 0.8), yaw=31, rx=8, rz=-6, seed=8),
    # Rock 13: the tower, three offset tiers.
    Element('tower-foot', (-9.85, 0.8, 3.4), (2.5, 1.7, 2.3), yaw=12, under=0.3, seed=9),
    Element('tower-mid', (-9.65, 1.95, 3.3), (2.0, 0.8, 1.85), yaw=52, rx=-5, rz=4, seed=10),
    Element('tower-cap', (-9.95, 2.72, 3.5), (1.35, 0.68, 1.2), yaw=21, rx=6, rz=6, under=0.25, seed=11),
    # Rocks 19 and 31: the spur and talus, and the arch's lintel from the tower to the spur.
    Element('spur', (-6.85, 0.55, 3.3), (1.8, 0.9, 1.5), yaw=70, rx=10, rz=-8, seed=12),
    Element('talus', (-8.2, 0.62, 4.45), (1.9, 0.95, 1.3), yaw=-28, rx=-8, rz=6, seed=13),
    Element('arch-lintel', (-8.35, 1.55, 3.45), (2.1, 0.36, 0.75), yaw=-8, rz=5, under=0.05, seed=14),
    Element('saddle-block', (-8.75, 1.0, 2.05), (1.25, 0.9, 1.1), yaw=40, seed=15),
]
# The bommie: an eroded stem under a broad cap, which the massive colony crowns.
BOMMIE_ELEMENTS = [
    Element('bommie-stem', (-5.6, 0.35, -5.4), (0.95, 0.95, 0.85), yaw=20, under=0.15, seed=20),
    Element('bommie-cap', (-5.62, 0.93, -5.42), (1.75, 0.46, 1.55), yaw=40, rx=4, rz=-6, under=0.3, seed=21),
]


class Formation:
    """A body composed of elements, cemented together, with porous live-rock detail."""

    def __init__(self, elements, details):
        self.elements = elements
        pts = np.vstack([e.corners() for e in elements])
        self.lo, self.hi = pts.min(0) - 0.2, pts.max(0) + 0.2
        self.details = details

    def envelope(self, p):
        return smin([e.sdf(p) for e in self.elements], 0.1)

    def field(self, voxel):
        axes = [np.arange(self.lo[k], self.hi[k], voxel) for k in range(3)]
        X, Y, Z = np.meshgrid(*axes, indexing='ij')
        p = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
        d = np.empty(len(p))
        for i in range(0, len(p), 300000):
            s = slice(i, i + 300000)
            env = self.envelope(p[s])
            d[s] = self.details(p[s], env)
        sand = SAND(p[:, [0, 2]])
        d = np.maximum(d, (sand - 0.3) - p[:, 1])
        return d.reshape(X.shape), axes

    def mesh(self, voxel=0.03):
        field, axes = self.field(voxel)
        field = gaussian_filter(field, 0.28)
        v, f, _, _ = marching_cubes(field, 0.0, spacing=(voxel,) * 3)
        v += np.array([a[0] for a in axes])
        return v, f[:, ::-1].copy()

    def facet_distance(self, p):
        return np.min([e.facet_distance(p) for e in self.elements], 0)

    def colliders(self):
        return {e.name: e.corners() for e in self.elements}


def porous(p, env, density_seed, strength=1.0):
    """Live-rock porosity: fine holes everywhere near the surface, larger pockets in clusters,
    softened so they read as eroded rock rather than drilled holes."""
    near = env > -0.25
    d = env.copy()
    if not near.any():
        return d
    q = p[near]
    cluster = smooth(-0.2, 0.4, noise3(q, 0.7, density_seed))
    holes = worley(q, 0.17, density_seed + 1) * 0.17 - (0.022 + 0.03 * cluster)
    pockets = worley(q, 0.55, density_seed + 2) * 0.55 - 0.11 * smooth(0.25, 0.8, cluster)
    voids = np.minimum(holes, pockets)
    d[near] = smax(d[near], -voids * strength, 0.05)
    d[near] += 0.022 * ridged(q, 3.0, density_seed + 3)
    return d


def ridge_details(p, env):
    d = porous(p, env, 880)
    # The grotto under the channel shelf, and a second, smaller one beside it.
    caves = [ellipsoid(p, (-4.35, 0.6, 0.55), (0.6, 0.48, 0.72)),
             ellipsoid(p, (-4.6, 0.5, -1.25), (0.42, 0.36, 0.5))]
    d = smax(d, -np.min(caves, 0), 0.1)
    # The arch's window between the tower and the spur.
    d = smax(d, -ellipsoid(p, (-8.25, 0.62, 3.45), (0.5, 0.75, 1.1)), 0.08)
    # The host anemone's pocket.
    d = smax(d, -ellipsoid(p, ANEMONE + (0, 0.13, 0), (0.42, 0.15, 0.42)), 0.07)
    return d


def bommie_details(p, env):
    return porous(p, env, 890, 0.8)


TAU_ = math.tau
RIDGE_FORMATION = Formation(RIDGE_ELEMENTS, ridge_details)
BOMMIE_FORMATION = Formation(BOMMIE_ELEMENTS, bommie_details)


def curvature(v, f, n):
    """Mean-curvature proxy per vertex: neighbours' mean offset along the normal (+ concave)."""
    acc = np.zeros_like(v)
    cnt = np.zeros(len(v))
    for a, b in ((0, 1), (1, 2), (2, 0)):
        np.add.at(acc, f[:, a], v[f[:, b]])
        np.add.at(cnt, f[:, a], 1)
        np.add.at(acc, f[:, b], v[f[:, a]])
        np.add.at(cnt, f[:, b], 1)
    lap = acc / np.maximum(cnt, 1)[:, None] - v
    return (lap * n).sum(1)


def paint(v, n, depth, curv, facet):
    """Reef-rock colour and weathering (RGBA; alpha 0 = fresh fracture, 1 = eroded or living),
    driven by the form so every difference means something:

    * **fresh fracture faces** (on a fracture plane): pale, cool mineral, crisp (less relief);
    * **weathered surfaces**: cool grey-tan limestone with a slow tonal drift;
    * **convex edges**: worn a little paler; **cavities and recesses**: dark, silted, warm;
    * **sediment** settled on upward, concave ledges;
    * restrained **biology**: turf algae on exposed tops, crisp-edged coralline crusts on shaded
      faces, and dark vertical stains on steep faces.
    """
    ys = v[:, 1] - SAND(v[:, [0, 2]])
    up = n[:, 1]
    stone = np.array([0.6, 0.58, 0.53])
    col = np.tile(stone, (len(v), 1)) * (1 + 0.08 * noise3(v, 0.6, 901) + 0.03 * noise3(v, 3.0, 905))[:, None]
    wear = np.full(len(v), 0.62)
    # Fresh fractures.
    fresh = smooth(0.03, 0.008, facet) * smooth(-0.004, 0.006, -depth + 0.006)
    col = col * (1 - fresh[:, None] * 0.7) + np.array([0.74, 0.73, 0.69]) * fresh[:, None] * 0.7
    wear = wear * (1 - fresh) + 0.12 * fresh
    # Convex edges worn paler; concave recesses darker.
    convex = smooth(0.0, -0.012, curv)
    col *= (1 + 0.08 * convex)[:, None]
    hollow = np.maximum(smooth(0.03, 0.3, depth), smooth(0.002, 0.02, curv))
    col = col * (1 - hollow[:, None] * 0.5) + np.array([0.3, 0.26, 0.2]) * hollow[:, None] * 0.5
    wear = np.maximum(wear, hollow)
    # Sediment on upward, concave ledges.
    silt = smooth(0.7, 0.92, up) * smooth(-0.002, 0.01, curv) * smooth(0.3, 1.2, ys)
    col = col * (1 - silt[:, None] * 0.75) + np.array([0.78, 0.72, 0.6]) * silt[:, None] * 0.75
    wear = np.maximum(wear, silt)
    # Turf algae on exposed tops, in patches.
    turf = smooth(0.5, 0.85, up) * smooth(0.0, 0.5, noise3(v, 1.2, 902)) * (1 - silt) * (1 - fresh)
    col = col * (1 - turf[:, None] * 0.55) + np.array([0.36, 0.38, 0.24]) * turf[:, None] * 0.55
    wear = np.maximum(wear, turf)
    # Coralline algae: crisp-edged crusts on shaded, steep faces.
    crust = smooth(0.5, 0.2, np.abs(up)) * smooth(0.27, 0.24, worley(v, 0.32, 903)) * smooth(0.3, 0.9, ys)
    col = col * (1 - crust[:, None] * 0.7) + np.array([0.64, 0.42, 0.5]) * crust[:, None] * 0.7
    wear = np.maximum(wear, crust)
    # Dark vertical stains on steep faces (streaks stretched downward), sparse.
    streak = smooth(0.35, 0.75, noise3(v * np.array([3.0, 0.5, 3.0]), 1.0, 904)) * smooth(0.35, 0.1, np.abs(up))
    col *= (1 - 0.35 * streak)[:, None]
    # A sand-dusted foot blending into the seabed.
    dust = smooth(0.4, 0.0, ys)
    col = col * (1 - dust[:, None] * 0.6) + np.array([0.8, 0.74, 0.62]) * dust[:, None] * 0.6
    wear = np.maximum(wear, dust)
    return np.concatenate([np.clip(col, 0, 1), np.clip(wear, 0, 1)[:, None]], 1)
