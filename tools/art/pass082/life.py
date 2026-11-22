"""V0.8 Pass 082: the reef life composed onto the benchmark rock (hard and soft corals, sponges).

Every colony is placed deliberately: a site is chosen by hand (a ray from a point in the water
toward the rock finds where the colony attaches and which way the rock faces there), then the
colony is grown at that site with its own family's construction:

* **Staghorn thicket** (the focal point, on the buttress where the accepted colony stood): an
  encrusting base fused to the rock, primaries splaying up and out, forking two or three times
  with a slight upward bend, short axial branchlets, pale growing tips over a darker base.
* **Brain coral** crowning the bommie: a low dome with a flared skirt and broad meanders.
* **Plating colonies**: thin, wavy, tiered plates growing out of the vertical faces.
* **Massive heads**: lumpy hummocks on ledges and the crest.
* **Leather and finger soft corals**, **tube sponges** and **encrusting sponge** patches.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

import reef_benchmark as rb
from mammals_sdf import ellipsoid, noise3, round_cone, smax, smin, smooth
from colony import decimate

RNG_SEED = 82082


def rock_sdf(p):
    """The composed ridge or bommie surface (both, for site finding)."""
    a = rb.RIDGE_FORMATION
    b = rb.BOMMIE_FORMATION
    return np.minimum(a.details(p, a.envelope(p)), b.details(p, b.envelope(p)))


def site(origin, target, back=0.0):
    """Where a ray from `origin` toward `target` meets the rock: (point, outward normal)."""
    o, t = np.asarray(origin, float), np.asarray(target, float)
    d = (t - o) / np.linalg.norm(t - o)
    s = 0.0
    for _ in range(400):
        p = o + d * s
        v = rock_sdf(p[None])[0]
        if v < 0.004:
            break
        s += max(v * 0.6, 0.004)
    p = o + d * s
    e = 0.02
    n = np.array([rock_sdf((p + dv)[None])[0] - rock_sdf((p - dv)[None])[0]
                  for dv in np.eye(3) * e])
    n /= np.linalg.norm(n) + 1e-9
    return p - n * back, n


class Grid:
    """A local SDF grid around one colony, polygonised and reduced."""

    def __init__(self, lo, hi, voxel):
        self.lo = np.asarray(lo, float)
        self.voxel = voxel
        self.axes = [np.arange(self.lo[k], hi[k], voxel) for k in range(3)]
        X, Y, Z = np.meshgrid(*self.axes, indexing='ij')
        self.shape = X.shape
        self.p = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
        self.d = np.full(len(self.p), 9.0)

    def mesh(self, target, blur=0.5):
        field = gaussian_filter(self.d.reshape(self.shape), blur)
        v, f, _, _ = marching_cubes(field, 0.0, spacing=(self.voxel,) * 3)
        v += self.lo
        v, f = decimate(v, f[:, ::-1].copy(), target)
        return v, f


def normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def orthonormal(n):
    a = np.array([1.0, 0, 0]) if abs(n[0]) < 0.9 else np.array([0, 0, 1.0])
    u = np.cross(n, a)
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)


# ------------------------------------------------------------------ staghorn thicket


def thicket_skeleton(base, rng, scale=1.0, primaries=15):
    """Segments (a, b, ra, rb, tip) of a staghorn thicket: primaries forking with an upward bend."""
    segs = []

    def grow(p, d, r, length, level):
        steps = 3
        for k in range(steps):
            d = d + np.array([0, 0.12, 0]) + rng.normal(0, 0.07, 3)
            d /= np.linalg.norm(d)
            q = p + d * length / steps
            r1 = r * (0.93 if level < 3 else 0.88)
            tip = level / 3 + (k + 1) / steps / 3
            segs.append((p, q, r, r1, min(1.0, tip)))
            # Short axial branchlets along the way, at random.
            if level >= 1 and rng.random() < 0.35:
                side = np.cross(d, rng.normal(0, 1, 3))
                side /= np.linalg.norm(side) + 1e-9
                bd = d * 0.5 + side
                bd /= np.linalg.norm(bd)
                segs.append((q, q + bd * length * 0.18, r1 * 0.7, r1 * 0.55, 1.0))
            p, r = q, r1
        if level >= 3 or length < 0.12 * scale:
            return
        forks = 2 if rng.random() < 0.75 else 3
        axis = np.cross(d, rng.normal(0, 1, 3))
        axis /= np.linalg.norm(axis) + 1e-9
        for k in range(forks):
            ang = math.radians(rng.uniform(22, 38)) * (1 if k % 2 == 0 else -1)
            spin = rng.uniform(0, math.tau)
            ax = axis * math.cos(spin) + np.cross(d, axis) * math.sin(spin)
            nd = d * math.cos(ang) + np.cross(ax, d) * math.sin(ang)
            grow(p, nd, r * 0.8, length * rng.uniform(0.62, 0.78), level + 1)

    # A spreading thicket: many primaries, low and splayed at the rim, steeper in the middle.
    for k in range(primaries):
        az = k / primaries * math.tau + rng.uniform(-0.2, 0.2)
        el = math.radians(rng.uniform(14, 34) if k % 3 else rng.uniform(40, 62))
        d = np.array([math.cos(az) * math.cos(el), math.sin(el), math.sin(az) * math.cos(el)])
        start = base + np.array([math.cos(az), 0, math.sin(az)]) * rng.uniform(0.02, 0.22) * scale
        grow(start + d * 0.04 * scale, d, rng.uniform(0.032, 0.042) * max(scale, 0.7), rng.uniform(0.42, 0.62) * scale, 0)
    return segs


def thicket(rng):
    base, n = site(rb.BRANCHING + (0, 1.2, 0), rb.BRANCHING + (0, -1, 0))
    segs = thicket_skeleton(base + n * 0.02, rng)
    pts = np.array([s[1] for s in segs] + [s[0] for s in segs])
    lo, hi = pts.min(0) - 0.1, pts.max(0) + 0.1
    lo[1] = base[1] - 0.12
    g = Grid(lo, hi, 0.011)
    # The encrusting base: a thin skirt fused over the rock.
    plate = ellipsoid(g.p, base + n * 0.0, (0.55, 0.07, 0.5))
    g.d = plate
    for a, b, ra, rb_, _ in segs:
        box_lo = np.minimum(a, b) - ra - 0.03
        box_hi = np.maximum(a, b) + ra + 0.03
        m = np.all((g.p > box_lo) & (g.p < box_hi), axis=1)
        if m.any():
            d = round_cone(g.p[m], a, b, ra, rb_)
            g.d[m] = smin([g.d[m], d], 0.012)
    # Corallite texture: tiny radial bumps.
    g.d += 0.0025 * noise3(g.p, 60, 3)
    v, f = g.mesh(24000, blur=0.45)
    # Colour: darker brown base, lavender-grey body, pale growing tips.
    tipness = np.array([s[4] for s in segs])
    mids = np.array([(s[0] + s[1]) / 2 for s in segs])
    _, idx = cKDTree(mids).query(v)
    t = tipness[idx]
    t = np.where(np.linalg.norm(v - base, axis=1) < 0.35, t * 0.3, t)
    base_c, body_c, tip_c = np.array([0.36, 0.3, 0.24]), np.array([0.5, 0.42, 0.42]), np.array([0.78, 0.72, 0.76])
    col = np.where((t < 0.5)[:, None], base_c + (body_c - base_c) * (t / 0.5)[:, None],
                   body_c + (tip_c - body_c) * ((t - 0.5) / 0.5)[:, None] ** 1.5)
    col *= (1 + 0.05 * noise3(v, 8, 5))[:, None]
    hull = v[(v[:, 1] < base[1] + 0.35) & (np.hypot(v[:, 0] - base[0], v[:, 2] - base[2]) < 0.55)]
    return v, f, np.clip(col, 0, 1), hull



def bush(p, n, scale, seed, tip_c):
    """A small corymbose Acropora: the thicket's construction at a third of the size, denser."""
    rng = np.random.default_rng(seed)
    segs = thicket_skeleton(p + n * 0.01, rng, scale, 9)
    pts = np.array([s[1] for s in segs] + [s[0] for s in segs])
    g = Grid(pts.min(0) - 0.06, pts.max(0) + 0.06, 0.009)
    g.d = ellipsoid(g.p, p, (0.18 * scale / 0.35, 0.05, 0.16 * scale / 0.35))
    for a, b, ra, rb_, _ in segs:
        m = np.all((g.p > np.minimum(a, b) - ra - 0.02) & (g.p < np.maximum(a, b) + ra + 0.02), axis=1)
        if m.any():
            g.d[m] = smin([g.d[m], round_cone(g.p[m], a, b, ra, rb_)], 0.01)
    v, f = g.mesh(2800, blur=0.45)
    t = smooth(p[1], p[1] + scale * 0.7, v[:, 1])
    col = np.array([0.5, 0.44, 0.34]) * (1 - t[:, None]) + np.array(tip_c) * t[:, None]
    return v, f, col


# ------------------------------------------------------------------ brain coral


def meander(p):
    """Brain-coral valleys: the contour bands of a slowly warped field, so they wind, fork and
    close as meanders do (one valley every ~5 cm), rather than the cracks of a noise threshold."""
    w = p + 0.06 * np.stack([noise3(p, 6, 44), noise3(p, 6, 45), noise3(p, 6, 46)], 1)
    field = noise3(w, 2.2, 41) + 0.5 * noise3(w, 4.5, 42)
    band = np.abs(np.sin(field * 26.0))
    return smooth(0.32, 0.0, band)


def brain(rng):
    top, n = site(rb.MASSIVE + (0, 1.0, 0), rb.MASSIVE + (0, -1, 0))
    c = top + np.array([0, 0.02, 0])
    lo, hi = c - np.array([0.85, 0.15, 0.8]), c + np.array([0.85, 0.55, 0.8])
    g = Grid(lo, hi, 0.009)
    q = g.p - c
    dome = ellipsoid(g.p, c, (0.6, 0.46, 0.55))
    skirt = ellipsoid(g.p, c + (0, -0.04, 0), (0.78, 0.12, 0.72))
    d = smin([dome, skirt], 0.08)
    d = np.maximum(d, -q[:, 1] - 0.06)
    # Broad meanders: the zero crossings of a band-limited field become the valleys.
    valley = meander(g.p)
    d += 0.018 * valley + 0.003 * noise3(g.p, 70, 43)
    g.d = d
    v, f = g.mesh(12000, blur=0.3)
    val = meander(v)
    ridge_c, valley_c = np.array([0.78, 0.7, 0.48]), np.array([0.36, 0.4, 0.26])
    col = ridge_c * (1 - val[:, None]) + valley_c * val[:, None]
    under = smooth(0.0, -0.08, v[:, 1] - c[1])
    col *= (1 - 0.35 * under)[:, None]
    return v, f, col, v


# ------------------------------------------------------------------ small colonies


def massive_head(p, n, r, seed, tint):
    """A Porites-like massive colony: a low, spreading hummock of many fused lobes that hugs the
    rock, its surface knobbly and pitted by corallites, its colour mottled and paler on the
    lobe tops (never a smooth, round head)."""
    lo, hi = p - r * 1.8, p + r * 1.8
    g = Grid(lo, hi, 0.009)
    rng = np.random.default_rng(seed)
    u, w = orthonormal(n)
    lobes = []
    for _ in range(14):
        a, rad = rng.uniform(0, math.tau), r * math.sqrt(rng.random()) * 0.95
        o = (u * math.cos(a) + w * math.sin(a)) * rad
        h = r * (0.55 - 0.4 * rad / r) * rng.uniform(0.6, 1.1)
        s_ = r * rng.uniform(0.28, 0.45)
        lobes.append(ellipsoid(g.p, p + o + n * h * 0.5, (s_, s_ * 0.85, s_)))
    d = smin(lobes, r * 0.12)
    # Flattened against the rock: nothing below the attachment plane.
    d = np.maximum(d, -((g.p - p) @ n) - r * 0.05)
    # Knobbly surface and corallite pitting.
    d += 0.012 * noise3(g.p, 22, seed) + 0.008 * smooth(0.5, 0.15, rb.worley(g.p, 0.022, seed))
    g.d = d
    v, f = g.mesh(1500, blur=0.35)
    up = smooth(0.0, r * 0.6, (v - p) @ n)
    mottle = noise3(v, 7, seed + 1)
    col = np.tile(tint, (len(v), 1)) * (0.7 + 0.32 * up + 0.12 * mottle)[:, None]
    return v, f, col


def plates(p, n, size, seed, tint):
    """A tiered plating colony growing out of a vertical face: thin, wavy, upturned plates."""
    rng = np.random.default_rng(seed)
    u, w = orthonormal(n)
    g = Grid(p - size * 1.3, p + size * 1.3 + np.array([0, size * 0.8, 0]), 0.01)
    d = np.full(len(g.p), 9.0)
    for k in range(3):
        c = p + n * size * (0.35 + 0.15 * k) + np.array([0, size * 0.32 * k, 0]) + u * rng.normal(0, size * 0.2)
        q = g.p - c
        radial = q - np.outer(q @ np.array([0, 1.0, 0]), [0, 1.0, 0])
        rr = np.linalg.norm(radial, axis=1)
        ang = np.arctan2(q @ w, q @ u)
        rad = size * (0.75 - 0.15 * k) * (1 + 0.12 * np.sin(ang * 5 + k) + 0.06 * np.sin(ang * 11))
        # Upturned, wavy rim; only the half facing out of the rock.
        h = q[:, 1] - 0.08 * (rr / rad) ** 2 * size - 0.02 * np.sin(ang * 7)
        disc = np.maximum(np.abs(h) - 0.012 * (1.2 - rr / rad), rr - rad)
        disc = np.maximum(disc, -(q @ n) - size * 0.1)
        d = np.minimum(d, disc)
    g.d = d
    v, f = g.mesh(1900, blur=0.4)
    rr = np.linalg.norm(v - p, axis=1) / size
    col = tint * (0.75 + 0.35 * smooth(0.3, 1.0, rr))[:, None] * np.ones((len(v), 1))
    return v, f, col


def leather(p, n, size, seed):
    """Sarcophyton: a short stalk and a folded, mushroom-like capitulum."""
    g = Grid(p - size * 1.4, p + size * 1.4 + np.array([0, size, 0]), 0.012)
    stalk = round_cone(g.p, p, p + np.array([0, size * 0.55, 0]), size * 0.22, size * 0.28)
    c = p + np.array([0, size * 0.62, 0])
    q = g.p - c
    rr = np.hypot(q[:, 0], q[:, 2])
    ang = np.arctan2(q[:, 2], q[:, 0])
    fold = 0.09 * size * np.sin(ang * 9 + seed) * smooth(0.3 * size, size, rr)
    cap = np.maximum(np.abs(q[:, 1] - fold - 0.1 * (rr / size) ** 2 * size) - size * 0.06,
                     rr - size * (1 + 0.08 * np.sin(ang * 4)))
    g.d = smin([stalk, cap], size * 0.12)
    v, f = g.mesh(2200, blur=0.45)
    top = smooth(c[1] - 0.05, c[1] + 0.1, v[:, 1])
    col = np.array([0.66, 0.62, 0.46]) * (1 - top[:, None]) + np.array([0.82, 0.78, 0.6]) * top[:, None]
    col *= (1 + 0.05 * noise3(v, 30, seed))[:, None]
    return v, f, col


def tube_sponges(p, n, size, seed, tint):
    rng = np.random.default_rng(seed)
    g = Grid(p - size * 1.2, p + size * 1.2 + np.array([0, size * 1.8, 0]), 0.012)
    d = np.full(len(g.p), 9.0)
    tops = []
    for k in range(4):
        b = p + rng.normal(0, size * 0.25, 3) * (1, 0, 1)
        lean = rng.normal(0, 0.2, 3) * (1, 0, 1) + np.array([0, 1, 0])
        lean /= np.linalg.norm(lean)
        t = b + lean * size * rng.uniform(1.0, 1.7)
        r = size * rng.uniform(0.16, 0.22)
        outer = round_cone(g.p, b, t, r * 1.1, r)
        inner = round_cone(g.p, b + lean * size * 0.3, t + lean * r, r * 0.6, r * 0.7)
        d = np.minimum(d, smax(outer, -inner, 0.01))
        tops.append(t)
    g.d = d + 0.003 * noise3(g.p, 45, seed)
    v, f = g.mesh(2000, blur=0.45)
    col = np.tile(tint, (len(v), 1)) * (0.8 + 0.25 * smooth(p[1], p[1] + size * 1.5, v[:, 1]))[:, None]
    return v, f, col


def crust(p, n, size, seed, tint):
    """Encrusting sponge: a thin, lobed patch moulded over the rock."""
    g = Grid(p - size * 1.2, p + size * 1.2, 0.012)
    r = rock_sdf(g.p)
    rng = np.random.default_rng(seed)
    blob = np.min([ellipsoid(g.p, p + rng.normal(0, size * 0.35, 3), (size * 0.5,) * 3) for _ in range(5)], 0)
    g.d = np.maximum(np.abs(r - 0.012) - 0.014, blob)
    v, f = g.mesh(900, blur=0.4)
    col = np.tile(tint, (len(v), 1)) * (1 + 0.1 * noise3(v, 20, seed))[:, None]
    return v, f, col


def table(p, size, seed):
    """Tabular Acropora: a short stalk under a flat, fused plate of radiating branchlets with
    upturned tips. Its silhouette is the reef's horizontal accent."""
    rng = np.random.default_rng(seed)
    top = p + np.array([0, size * 0.42, 0])
    pts_lo = p - np.array([size * 1.15, 0.1, size * 1.15])
    pts_hi = p + np.array([size * 1.15, size * 0.75, size * 1.15])
    g = Grid(pts_lo, pts_hi, 0.011)
    d = round_cone(g.p, p - np.array([0, 0.05, 0]), top, size * 0.16, size * 0.11)
    for k in range(34):
        az = k / 34 * math.tau + rng.uniform(-0.08, 0.08)
        L = size * rng.uniform(0.75, 1.0)
        dirv = np.array([math.cos(az), 0.08, math.sin(az)])
        a = top + dirv * size * 0.1
        b = top + dirv * L
        tip = b + np.array([0, size * 0.1, 0]) + dirv * size * 0.05
        seg = np.minimum(round_cone(g.p, a, b, size * 0.045, size * 0.03),
                         round_cone(g.p, b, tip, size * 0.03, size * 0.022))
        d = smin([d, seg], size * 0.04)
    d += 0.002 * noise3(g.p, 60, seed)
    g.d = d
    v, f = g.mesh(7000, blur=0.45)
    rr = np.hypot(v[:, 0] - p[0], v[:, 2] - p[2]) / size
    col = np.array([0.5, 0.46, 0.34]) * (1 - smooth(0.4, 1.0, rr))[:, None] + \
        np.array([0.7, 0.72, 0.6]) * smooth(0.4, 1.0, rr)[:, None]
    return v, f, col


def fingers(p, n, size, seed):
    """Sinularia-like finger soft coral: a low base with short, blunt, branching lobes."""
    rng = np.random.default_rng(seed)
    g = Grid(p - size * 1.3, p + size * 1.3 + np.array([0, size, 0]), 0.011)
    d = ellipsoid(g.p, p, (size * 0.7, size * 0.3, size * 0.6))
    for k in range(9):
        b = p + rng.normal(0, size * 0.3, 3) * (1, 0.2, 1)
        t = b + (rng.normal(0, 0.35, 3) * (1, 0, 1) + np.array([0, 1, 0])) * size * rng.uniform(0.5, 0.9)
        d = smin([d, round_cone(g.p, b, t, size * 0.13, size * 0.1)], size * 0.1)
    g.d = d
    v, f = g.mesh(1500, blur=0.45)
    col = np.tile([0.72, 0.66, 0.5], (len(v), 1)) * (0.85 + 0.2 * smooth(p[1], p[1] + size, v[:, 1]))[:, None]
    return v, f, col


# ------------------------------------------------------------------ composition

# Sites chosen by eye from the benchmark cameras: (from a point in the water, toward the rock).
HEADS = [((-3.6, 2.6, -1.3), (-4.6, 1.6, -0.6), 0.22, (0.62, 0.48, 0.55)),   # shelf, purple-brown
         ((-6.3, 3.2, 1.9), (-6.6, 1.5, 1.6), 0.28, (0.72, 0.62, 0.42)),    # terrace step, tan
         ((-9.0, 3.6, 2.6), (-9.3, 2.0, 2.9), 0.25, (0.55, 0.6, 0.45)),     # tower mid, olive
         ((-7.6, 2.4, 4.4), (-7.9, 1.0, 4.0), 0.2, (0.7, 0.55, 0.5))]       # talus
PLATES = [((-5.6, 1.2, 3.3), (-6.6, 1.1, 2.0), 0.42, (0.58, 0.5, 0.36)),     # terrace north face
          ((-2.9, 0.9, -1.1), (-4.2, 0.9, -0.6), 0.36, (0.52, 0.46, 0.34)),  # buttress channel face
          ((-11.4, 1.6, 2.4), (-10.2, 1.5, 3.0), 0.4, (0.6, 0.52, 0.4))]     # tower west face
LEATHERS = [((-6.9, 3.0, -0.3), (-7.0, 1.4, 0.2), 0.32),
            ((-8.7, 3.0, 4.6), (-8.6, 1.2, 4.2), 0.26)]
SPONGES = [((-4.9, 2.3, 1.6), (-5.3, 1.0, 1.3), 0.2, (0.56, 0.44, 0.66)),    # lavender, buttress back
           ((-9.0, 2.0, 1.0), (-8.8, 0.8, 1.6), 0.18, (0.82, 0.6, 0.3))]     # ochre, saddle
CRUSTS = [((-3.2, 0.8, 0.6), (-4.2, 0.9, 0.6), 0.28, (0.86, 0.46, 0.22)),
          ((-6.4, 0.9, 3.4), (-6.9, 0.7, 2.8), 0.25, (0.84, 0.5, 0.3)),
          ((-8.3, 1.2, 3.0), (-8.3, 1.5, 3.4), 0.22, (0.78, 0.36, 0.3))]


def surface_sites(rocks, rng):
    """Candidate attachment points on the rock: (point, normal, height above sand)."""
    pts, nrm = [], []
    for name in ('Reef_Ridge', 'Reef_Bommie'):
        v, f = rocks[name][0], rocks[name][1]
        pts.append(v)
        nrm.append(normals(v, f))
    v, n = np.vstack(pts), np.vstack(nrm)
    ys = v[:, 1] - rb.SAND(v[:, [0, 2]])
    keep = rng.random(len(v)) < 0.25
    return v[keep], n[keep], ys[keep]


def pick(v, n, mask, count, spacing, taken, rng, weight=None):
    """Poisson-like picks among masked sites, keeping clear of everything already placed."""
    idx = np.flatnonzero(mask)
    if weight is not None:
        order = idx[np.argsort(-(weight[idx] + rng.random(len(idx)) * 0.6))]
    else:
        order = rng.permutation(idx)
    out = []
    for i in order:
        if len(out) >= count:
            break
        if all(np.linalg.norm(v[i] - t) > r for t, r in taken):
            out.append(i)
            taken.append((v[i], spacing))
    return out


def build(preview=False, rocks=None):
    rng = np.random.default_rng(RNG_SEED)
    coral, soft, colliders = [], [], {}
    v, f, c, hull = thicket(rng)
    coral.append((v, f, c))
    colliders['thicket'] = hull
    v, f, c, hull = brain(rng)
    coral.append((v, f, c))
    colliders['brain'] = hull
    # The table coral crowns the terrace knob, the reef's horizontal accent behind the anemone.
    tp, _ = site((-8.05, 4.0, 1.65), (-8.05, 1.0, 1.65))
    coral.append(table(tp, 0.55, 451))
    sv, sn, sy = surface_sites(rocks, rng)
    # Keep clear of the living seats and the hand-placed heroes.
    taken = [(rb.ANEMONE, 0.85), (rb.BRANCHING, 1.0), (rb.MASSIVE, 0.9), (tp, 0.8)]
    focal = np.exp(-np.sum((sv - rb.BRANCHING) ** 2, axis=1) / 6.0)
    exposed = np.clip(0.8 * sn[:, 0] - 0.4 * sn[:, 2], 0, 1)
    heads = pick(sv, sn, (sn[:, 1] > 0.5) & (sy > 0.3), 18, 0.55, taken, rng, focal)
    # Muted massive-coral colours: yellow-brown, brown, purple-brown, olive-grey, cream, rust.
    tints = [(0.66, 0.56, 0.36), (0.5, 0.42, 0.3), (0.52, 0.4, 0.44), (0.56, 0.56, 0.44),
             (0.72, 0.66, 0.5), (0.62, 0.46, 0.36)]
    for k, i in enumerate(heads):
        r = 0.18 + 0.3 * rng.random() ** 1.3
        coral.append(massive_head(sv[i], sn[i], r, 300 + k, np.array(tints[k % len(tints)])))
    plates_i = pick(sv, sn, (np.abs(sn[:, 1]) < 0.35) & (sy > 0.4) & (sy < 2.2), 11, 0.75, taken, rng,
                    exposed + focal)
    for k, i in enumerate(plates_i):
        coral.append(plates(sv[i] - sn[i] * 0.03, sn[i], 0.34 + 0.26 * rng.random(), 400 + k,
                            np.array(tints[(k + 2) % len(tints)]) * 0.85))
    leather_i = pick(sv, sn, (sn[:, 1] > 0.75) & (sy > 0.9), 5, 0.9, taken, rng)
    for k, i in enumerate(leather_i):
        soft.append(leather(sv[i] - sn[i] * 0.02, sn[i], 0.2 + 0.12 * rng.random(), 500 + k))
    finger_i = pick(sv, sn, (sn[:, 1] > 0.6) & (sy > 0.6), 5, 0.8, taken, rng, focal)
    for k, i in enumerate(finger_i):
        soft.append(fingers(sv[i] - sn[i] * 0.02, sn[i], 0.22 + 0.1 * rng.random(), 550 + k))
    bush_i = pick(sv, sn, (sn[:, 1] > 0.6) & (sy > 0.5), 5, 0.8, taken, rng, focal)
    bush_tips = [(0.86, 0.8, 0.62), (0.74, 0.82, 0.86), (0.84, 0.72, 0.78), (0.8, 0.84, 0.7)]
    for k, i in enumerate(bush_i):
        coral.append(bush(sv[i] - sn[i] * 0.02, sn[i], 0.3 + 0.12 * rng.random(), 800 + k, bush_tips[k % 4]))
    sponge_i = pick(sv, sn, (sn[:, 1] > 0.5) & (sy > 0.3) & (sy < 1.6), 4, 1.1, taken, rng)
    sponge_tints = [(0.56, 0.44, 0.66), (0.82, 0.6, 0.3), (0.7, 0.4, 0.45), (0.5, 0.52, 0.68)]
    for k, i in enumerate(sponge_i):
        soft.append(tube_sponges(sv[i] - sn[i] * 0.03, sn[i], 0.14 + 0.08 * rng.random(), 600 + k,
                                 np.array(sponge_tints[k % 4])))
    crust_i = pick(sv, sn, (sn[:, 1] < 0.15) & (sy > 0.25), 8, 0.7, taken, rng)
    crust_tints = [(0.74, 0.46, 0.3), (0.7, 0.5, 0.36), (0.66, 0.4, 0.36), (0.56, 0.44, 0.58)]
    for k, i in enumerate(crust_i):
        soft.append(crust(sv[i], sn[i], 0.16 + 0.12 * rng.random(), 700 + k, np.array(crust_tints[k % 4])))

    def merge(items):
        vs, fs, cs, off = [], [], [], 0
        for v, f, c in items:
            vs.append(v)
            fs.append(f + off)
            cs.append(c)
            off += len(v)
        return np.vstack(vs), np.vstack(fs), np.clip(np.vstack(cs), 0, 1)

    v, f, c = merge(coral)
    out = {'Reef_Coral': (v, f, c, 0.62)}
    v, f, c = merge(soft)
    out['Reef_Soft'] = (v, f, c, 0.78)
    build.colliders = colliders
    return out
