"""V0.8 Pass 083: organic, naturally clustered vegetation for the whole aquarium.

The accepted meadows were single straight blades instanced one by one (and a second layer of
shorter ones), so every bed read as a field of vertical needles; the accepted sprigs stood alone on
open sand. This pass replaces them with whole plants, each a unit-height template (base at the
origin, tallest point at y = 1, a per-blade phase in UV1, as the runtime's `plantMotion` expects):

* **Grass** and **GrassShort**: turtle-grass tufts of 8-14 strap blades that rise from one rhizome
  node, splay, arch over and twist; the short form edges the beds.
* **Caulerpa**: a creeping runner with upright, curving feather fronds.
* **Halimeda** and **RedAlga**: the approved Pass 082 templates.

No new species (turtle grass, Caulerpa, Halimeda and red macroalgae are the tank's own). Placement
follows the habitat, never a uniform scatter: meadow beds of drifting tufts (dense, tall centres;
ragged, shorter edges; gaps), clusters where sand meets rock at each formation's foot, and algae
rooted in upward pockets and crevices of the rock.
"""
from __future__ import annotations

import math

import numpy as np

import habitat as hb
import vegetation as v82
from mammals_sdf import smooth

rb = hb.rb
SEED = 83084


def blade_path(rng, d, length, lean, arch):
    """A strap blade's spine: rising, leaning out and arching over, with a slight S."""
    t = np.linspace(0, 1, 11)
    out = lean * t ** 1.5 + arch * t ** 3
    up = t * (1 - 0.45 * arch * t ** 2)
    wobble = 0.03 * np.sin(t * math.pi * rng.uniform(1.0, 2.0) + rng.uniform(0, 6))
    side = np.array([-d[2], 0, d[0]])
    return (np.outer(out, d) + np.outer(up, [0, 1, 0]) + np.outer(wobble, side)) * length


def grass_tuft(rng, blades=(8, 15), tall=1.0, width=0.07):
    parts = []
    n = rng.integers(*blades)
    base_az = rng.uniform(0, math.tau)
    for b in range(n):
        # Blades fan out from one node: inner blades steep and long, outer ones low and arched.
        rank = b / max(1, n - 1)
        az = base_az + rng.normal(0, 1.2)
        d = np.array([math.cos(az), 0, math.sin(az)])
        length = tall * rng.uniform(0.6, 1.0) * (1 - 0.35 * rank)
        lean = rng.uniform(0.08, 0.3) + 0.35 * rank
        arch = rng.uniform(0.05, 0.25) + 0.3 * rank
        path = blade_path(rng, d, length, lean, arch) + d * rng.uniform(0, 0.03)
        t = np.linspace(0, 1, len(path))
        w = width * (0.8 + 0.4 * rng.random()) * (1 - 0.7 * t ** 1.6)
        twist = np.array([math.cos(az + 1.3 + rng.normal(0, 0.3)), 0, math.sin(az + 1.3)])
        yellow = rng.random() < 0.28
        epi = rng.random() < 0.35

        def colour(u, yellow=yellow, epi=epi):
            base, body, tip = np.array([0.7, 0.7, 0.52]), np.array([0.32, 0.46, 0.22]), np.array([0.62, 0.56, 0.3])
            c = base + (body - base) * smooth(0.0, 0.2, u)
            if yellow:
                c = c + (tip - c) * smooth(0.65, 1.0, u)
            if epi:
                # Old blades carry a pale film of epiphytes toward the tip.
                c = c + (np.array([0.62, 0.6, 0.5]) - c) * 0.35 * smooth(0.5, 1.0, u)
            return c
        parts.append(v82.ribbon(path, w, twist, colour, b / n))
    return v82.merge(parts)


def caulerpa(rng):
    """Caulerpa prolifera: a runner creeping over the sand, with flat, leaf-like blades rising from
    it, each curving and twisting a little, rounded at the tip (never a stiff, ladder-like frond)."""
    parts = []
    a = rng.uniform(0, math.tau)
    d = np.array([math.cos(a), 0, math.sin(a)])
    side = np.array([-d[2], 0, d[0]])
    t = np.linspace(-0.5, 0.5, 11)
    runner = np.outer(t, d) * 1.3 + np.outer(0.1 * np.sin(t * 6), side)
    runner[:, 1] = 0.015

    def green(u, k=0.0):
        return np.array([0.2, 0.46, 0.2]) + np.array([0.16, 0.2, 0.08]) * u + k

    parts.append(v82.ribbon(runner, np.full(len(t), 0.03), np.array([0, 1.0, 0]), green, 0.0))
    for k in range(rng.integers(9, 14)):
        p0 = runner[rng.integers(1, len(t) - 1)] + rng.normal(0, 0.03, 3) * (1, 0, 1)
        az = rng.uniform(0, math.tau)
        out = np.array([math.cos(az), 0, math.sin(az)])
        h = rng.uniform(0.35, 1.0)
        s = np.linspace(0, 1, 9)
        bend = rng.uniform(0.1, 0.45)
        spine = p0 + np.outer(s, [0, h, 0]) + np.outer(bend * h * s ** 1.8, out)
        # A short stipe, then a broad blade with a rounded tip.
        width = 0.13 * np.sqrt(np.clip(np.sin(np.clip(s, 0.08, 1.0) * math.pi * 0.92), 0, 1)) \
            * smooth(0.0, 0.25, s) + 0.012
        twist = np.array([math.cos(az + 1.57 + rng.normal(0, 0.4)), 0.0, math.sin(az + 1.57)])
        tone = rng.normal(0, 0.03)
        parts.append(v82.ribbon(spine, width, twist, lambda u, tone=tone: green(u, tone), k / 14))
    return v82.merge(parts)


def red_alga(rng):
    """A fleshy red macroalga: a bushy tuft of flat, strap-like fronds that fork once or twice,
    curl over and taper, deep rose at the base to a paler, translucent pink at the tips."""
    parts = []

    def frond(p, d, length, width, level, phase):
        s = np.linspace(0, 1, 9)
        side = np.cross(d, [0, 1, 0.01])
        side /= np.linalg.norm(side) + 1e-9
        curl = rng.uniform(0.2, 0.55)
        path = p + np.outer(s, d) * length + np.outer(curl * s ** 2, side) * length \
            - np.outer(0.25 * curl * s ** 3, [0, 1, 0]) * length
        w = width * (1 - 0.55 * s) * smooth(0.0, 0.15, s + 0.05)
        colour = lambda u: np.array([0.46, 0.14, 0.2]) + np.array([0.28, 0.2, 0.16]) * (level / 3 + u / 3)  # noqa: E731
        parts.append(v82.ribbon(path, w, np.cross(d, side), colour, phase))
        if level < 2:
            end = path[int(len(path) * 0.65)]
            for sgn in (-1, 1):
                nd = d + side * 0.5 * sgn + rng.normal(0, 0.15, 3)
                nd /= np.linalg.norm(nd)
                frond(end, nd, length * 0.62, width * 0.75, level + 1, phase)

    for k in range(rng.integers(6, 10)):
        az = rng.uniform(0, math.tau)
        d = np.array([math.cos(az) * rng.uniform(0.25, 0.6), 1, math.sin(az) * rng.uniform(0.25, 0.6)])
        frond(np.zeros(3), d / np.linalg.norm(d), rng.uniform(0.45, 0.62), 0.07, 0, k / 10)
    return v82.merge(parts)


def templates():
    rng = np.random.default_rng(SEED)
    base = v82.templates()
    return {
        'Grass': grass_tuft(rng),
        'GrassShort': grass_tuft(rng, (6, 10), 0.8, 0.065),
        'Caulerpa': caulerpa(rng),
        'Halimeda': base['Halimeda'],
        'RedAlga': red_alga(rng),
    }


def envelope(p):
    return np.min([f.envelope(p) for f in hb.FORMS.values()], 0)


def clear_of_structures(p, margin):
    """Away from every accepted structure the habitat does not own (benchmark rock, ornaments,
    crevice, other colonies), so no plant grows into them."""
    ok = np.ones(len(p), bool)
    for c in hb.LAYOUT['ornamentColliders'] + hb.LAYOUT['crevice']:
        ok &= rb.hull_sdf(p, c['planes']) > margin
    for name in ('Rock 7', 'Rock 11', 'Rock 13', 'Rock 19', 'Rock 31', 'Rock 17'):
        ok &= rb.hull_sdf(p, hb.ROCKS[name]['planes']) > margin
    for h in hb.LAYOUT['hard']:
        for c in h['colliders']:
            ok &= rb.hull_sdf(p, c['planes']) > margin
    return ok


def meadow_spots(rng):
    """Turtle-grass beds where the accepted meadows were: drifts of tufts, dense and tall in the
    middle, ragged and short at the edge, with a gap or two (never a filled disc)."""
    out = []
    for m in hb.LAYOUT['meadows']:
        c = np.array([m['x'], m['z']])
        r = m['radius'] * 1.15
        drifts = [c + rng.normal(0, r * 0.35, 2) for _ in range(rng.integers(3, 6))]
        gap = rng.uniform(0, math.tau)
        n = int(30 * r * r)
        for _ in range(n * 3):
            if len([o for o in out if o[4] == id(m)]) >= n:
                break
            centre = drifts[rng.integers(len(drifts))]
            q = centre + rng.normal(0, r * 0.32, 2)
            off = q - c
            rr = np.hypot(*off) / r
            ang = math.atan2(off[1], off[0])
            if rr > 1.0 + 0.15 * math.sin(ang * 3 + m['x']) or (math.cos(ang - gap) > 0.9 and rr > 0.35):
                continue
            p = np.array([q[0], float(hb.SAND(q[None])[0]) - 0.015, q[1]])
            if envelope(p[None])[0] < 0.2 or not clear_of_structures(p[None], 0.2)[0]:
                continue
            edge = smooth(0.55, 1.0, rr)
            kind = 'GrassShort' if rng.random() < 0.25 + 0.6 * edge else 'Grass'
            h = (0.55 + 0.45 * rng.random()) * (1.0 - 0.4 * edge) * (1.35 if rng.random() < 0.08 else 1)
            out.append((kind, p, rng.uniform(0, math.tau), h, id(m)))
    return [o[:4] for o in out]


def foot_spots(rng, rocks):
    """Clusters where sand gathers at each formation's foot, and algae in the rock's pockets."""
    out = []
    xs, zs = np.meshgrid(np.arange(-17.4, 17.4, 0.14), np.arange(-13.4, 13.4, 0.14), indexing='ij')
    pts = np.stack([xs.ravel(), np.zeros(xs.size), zs.ravel()], 1)
    pts[:, 1] = hb.SAND(pts[:, [0, 2]]) + 0.02
    # Only around habitat rock (the meadows and the benchmark have their own plants).
    near = np.zeros(len(pts), bool)
    for f in hb.FORMS.values():
        near |= np.all((pts >= f.lo - 0.8) & (pts <= f.hi + 0.8), axis=1)
    pts = pts[near & (np.abs(pts[:, 0]) > 3.4)]
    dist = envelope(pts)
    margin = (dist > 0.06) & (dist < 0.55) & clear_of_structures(pts, 0.25)
    cand = pts[margin]
    centres = []
    for i in rng.permutation(len(cand)):
        if len(centres) >= 44:
            break
        if all(np.linalg.norm(cand[i] - c) > 1.25 for c in centres):
            centres.append(cand[i])
    for k, c in enumerate(centres):
        kind = ['Grass', 'Grass', 'Halimeda', 'Caulerpa', 'RedAlga', 'GrassShort'][k % 6]
        count = rng.integers(5, 10) if kind.startswith('Grass') else rng.integers(3, 6)
        for _ in range(count):
            q = c + np.array([rng.normal(0, 0.28), 0, rng.normal(0, 0.28)])
            q[1] = hb.SAND(q[None, [0, 2]])[0] - 0.01
            if envelope(q[None])[0] < 0.04 or not clear_of_structures(q[None], 0.2)[0]:
                continue
            h = {'Grass': rng.uniform(0.6, 1.1), 'GrassShort': rng.uniform(0.4, 0.7),
                 'Halimeda': rng.uniform(0.28, 0.46), 'Caulerpa': rng.uniform(0.18, 0.3),
                 'RedAlga': rng.uniform(0.32, 0.56)}[kind]
            out.append((kind, q, rng.uniform(0, math.tau), h))
    # Algae rooted in crevices: upward, concave pockets on the rock, away from colonies' seats.
    for name, (v, f, *_rest) in rocks.items():
        fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
        vn = np.zeros_like(v)
        for j in range(3):
            np.add.at(vn, f[:, j], fn)
        vn /= np.linalg.norm(vn, axis=1, keepdims=True) + 1e-12
        concave = rb.curvature(v, f, vn)
        up = fn[:, 1] / (np.linalg.norm(fn, axis=1) + 1e-12)
        centre = v[f].mean(1)
        pocket = concave[f].mean(1)
        ys = centre[:, 1] - hb.SAND(centre[:, [0, 2]])
        ok = np.flatnonzero((up > 0.6) & (ys > 0.5) & (pocket > 0.004))
        taken = [hb.DEN_MOUTH + hb.DEN_AXIS * 0.4, hb.FROG]
        placed = 0
        for i in rng.permutation(ok):
            if placed >= 9:
                break
            p = centre[i]
            if all(np.linalg.norm(p - t) > 0.9 for t in taken):
                taken.append(p)
                placed += 1
                out.append(('Halimeda' if rng.random() < 0.55 else 'RedAlga', p - np.array([0, 0.02, 0]),
                            rng.uniform(0, math.tau), rng.uniform(0.2, 0.34)))
    return out


def placements(rocks):
    rng = np.random.default_rng(SEED + 1)
    return meadow_spots(rng) + foot_spots(rng, rocks)
