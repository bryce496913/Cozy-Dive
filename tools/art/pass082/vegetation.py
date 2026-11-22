"""V0.8 Pass 082: vegetation clusters for the benchmark section.

Three unit-height templates (base at the origin, tallest point at y = 1, as the runtime's
`plantMotion` contract expects; a per-blade phase in UV1):

* **Turtle grass tuft**: 9-13 strap blades, tapering, leaning out and curving over, twisting a
  little, pale at the base, green in the body, yellowing at a few tips.
* **Halimeda**: branching chains of calcified kidney-shaped segments, bright green, pale rims.
* **Red alga**: a bushy, dichotomously forking tuft of flat fronds, maroon to rose.

Placement follows the reef: dense clusters where sand meets rock (most on the channel side and
in the inside corners), sparser clumps further out, and a few algal tufts on the ledges.
"""
from __future__ import annotations

import math

import numpy as np

import reef_benchmark as rb
from mammals_sdf import smooth

SEED = 82083


def ribbon(path, widths, normal_hint, colour, phase):
    """A flat strip along `path` (N, 3) with per-point widths; returns (v, f, c, phase)."""
    v, f, c, ph = [], [], [], []
    n = len(path)
    for i in range(n):
        t = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        t /= np.linalg.norm(t) + 1e-9
        side = np.cross(t, normal_hint)
        side /= np.linalg.norm(side) + 1e-9
        for s in (-1, 1):
            v.append(path[i] + side * widths[i] * 0.5 * s)
            c.append(colour(i / (n - 1)))
            ph.append(phase)
    for i in range(n - 1):
        a = i * 2
        f += [(a, a + 1, a + 3), (a, a + 3, a + 2)]
    return np.array(v), np.array(f), np.array(c), np.array(ph)


def merge(parts):
    vs, fs, cs, ps, off = [], [], [], [], 0
    for v, f, c, p in parts:
        vs.append(v)
        fs.append(f + off)
        cs.append(c)
        ps.append(p)
        off += len(v)
    v = np.vstack(vs)
    v[:, 1] -= v[:, 1].min()
    v /= v[:, 1].max()
    return v, np.vstack(fs), np.vstack(cs), np.concatenate(ps)


def grass(rng):
    parts = []
    blades = rng.integers(9, 14)
    for b in range(blades):
        az = rng.uniform(0, math.tau)
        lean = rng.uniform(0.05, 0.45)
        length = rng.uniform(0.55, 1.0)
        d = np.array([math.cos(az), 0, math.sin(az)])
        t = np.linspace(0, 1, 9)
        bend = lean * t ** 1.8 + 0.12 * t ** 3
        path = np.stack([d[0] * bend * length, t * length * (1 - 0.25 * t ** 2 * lean),
                         d[2] * bend * length], 1) + d * rng.uniform(0, 0.05)
        width = 0.075 * (1 - 0.65 * t ** 1.4)
        twist = np.array([math.cos(az + 1.4), 0, math.sin(az + 1.4)])
        yellow = rng.random() < 0.3

        def colour(u, yellow=yellow):
            base, body, tip = np.array([0.74, 0.74, 0.54]), np.array([0.36, 0.46, 0.24]), np.array([0.62, 0.58, 0.32])
            c = base + (body - base) * smooth(0.0, 0.25, u)
            return c + (tip - c) * smooth(0.7, 1.0, u) if yellow else c
        parts.append(ribbon(path, width, twist, colour, b / blades))
    return merge(parts)


def halimeda(rng):
    parts = []
    chains = rng.integers(5, 8)
    for k in range(chains):
        az = rng.uniform(0, math.tau)
        d = np.array([math.cos(az) * rng.uniform(0.2, 0.6), 1.0, math.sin(az) * rng.uniform(0.2, 0.6)])
        d /= np.linalg.norm(d)
        p = np.zeros(3)
        segs = rng.integers(6, 10)
        for i in range(segs):
            size = 0.11 * (1 - 0.35 * i / segs)
            normal = np.cross(d, [0, 1, 0.001]) + rng.normal(0, 0.3, 3)
            normal /= np.linalg.norm(normal)
            u = np.cross(normal, d)
            ang = np.linspace(0, math.tau, 9)[:-1]
            ring = [p + d * size * 0.6 + (u * math.cos(a) * size * (0.9 + 0.2 * math.cos(2 * a))
                                         + d * math.sin(a) * size * 0.6) for a in ang]
            v = np.vstack([p + d * size * 0.6, ring])
            f = np.array([(0, j + 1, (j + 1) % 8 + 1) for j in range(8)])
            rim = np.array([0.62, 0.78, 0.5])
            c = np.vstack([[0.28, 0.56, 0.24], np.tile(rim, (8, 1))])
            parts.append((v, f, c, np.full(len(v), k / chains)))
            p = p + d * size * 1.15
            d = d + rng.normal(0, 0.18, 3) * (1, 0, 1)
            d /= np.linalg.norm(d)
    return merge(parts)


def red_alga(rng):
    parts = []

    def frond(p, d, length, level, phase):
        t = np.linspace(0, 1, 6)
        curve = np.outer(t ** 2, np.cross(d, [0, 0, 1])) * 0.15 * length
        path = p + np.outer(t, d) * length + curve
        width = 0.035 * (1 - 0.5 * t) * (0.8 ** level)
        parts.append(ribbon(path, width, np.cross(d, [1, 0, 0.3]),
                            lambda u: np.array([0.5, 0.17, 0.2]) + np.array([0.25, 0.18, 0.12]) * u, phase))
        if level < 3:
            end = path[-1]
            for s in (-1, 1):
                nd = d + np.cross(d, [0, 0, 1]) * 0.55 * s + rng.normal(0, 0.15, 3)
                nd /= np.linalg.norm(nd)
                frond(end, nd, length * 0.72, level + 1, phase)

    for k in range(rng.integers(4, 7)):
        az = rng.uniform(0, math.tau)
        d = np.array([math.cos(az) * 0.35, 1, math.sin(az) * 0.35])
        frond(np.zeros(3), d / np.linalg.norm(d), 0.32, 0, k / 7)
    return merge(parts)


TEMPLATES = {'Grass': grass, 'Halimeda': halimeda, 'RedAlga': red_alga}


def templates():
    rng = np.random.default_rng(SEED)
    return {k: fn(rng) for k, fn in TEMPLATES.items()}


def placements(rocks):
    """[(kind, position, yaw, height)] for the section, art-directed by simple habitat rules."""
    rng = np.random.default_rng(SEED + 1)
    form = rb.RIDGE_FORMATION
    bom = rb.BOMMIE_FORMATION
    xs, zs = np.meshgrid(np.arange(-11.8, -2.6, 0.12), np.arange(-6.8, 5.6, 0.12), indexing='ij')
    pts = np.stack([xs.ravel(), np.zeros(xs.size), zs.ravel()], 1)
    pts[:, 1] = rb.SAND(pts[:, [0, 2]]) + 0.02
    dist = np.minimum(form.envelope(pts), bom.envelope(pts))
    margin = (dist > 0.12) & (dist < 0.75) & (np.abs(pts[:, 0]) > 2.7)
    # Clear of every other accepted rock and coral in the tank.
    others = [r for r in rb.SECTION['all'] if r['name'] not in rb.RIDGE + rb.BOMMIE]
    for r in others:
        margin &= rb.hull_sdf(pts, r['planes']) > 0.25
    cand = pts[margin]
    out = []
    centres = []
    for i in rng.permutation(len(cand)):
        if len(centres) >= 14:
            break
        if all(np.linalg.norm(cand[i] - c) > 1.1 for c in centres):
            centres.append(cand[i])
    for k, c in enumerate(centres):
        kind = 'Grass' if k % 3 != 2 else ('Halimeda' if k % 2 else 'RedAlga')
        count = rng.integers(7, 12) if kind == 'Grass' else rng.integers(4, 7)
        for _ in range(count):
            q = c + np.array([rng.normal(0, 0.32), 0, rng.normal(0, 0.32)])
            q[1] = rb.SAND(q[None, [0, 2]])[0] - 0.01
            if min(form.envelope(q[None])[0], bom.envelope(q[None])[0]) < 0.06:
                continue
            h = {'Grass': rng.uniform(0.7, 1.25), 'Halimeda': rng.uniform(0.3, 0.48),
                 'RedAlga': rng.uniform(0.35, 0.6)}[kind]
            out.append((kind, q, rng.uniform(0, math.tau), h))
    # A few algal tufts on the ledges (flat, upward rock away from the colonies).
    v, f = rocks['Reef_Ridge'][0], rocks['Reef_Ridge'][1]
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    up = fn[:, 1] / (np.linalg.norm(fn, axis=1) + 1e-12)
    centre = v[f].mean(1)
    ok = np.flatnonzero((up > 0.9) & (centre[:, 1] > 0.6))
    taken = [rb.ANEMONE, rb.BRANCHING]
    for i in rng.permutation(ok):
        if len([o for o in out if o[1][1] > 0.5]) >= 8:
            break
        p = centre[i]
        if all(np.linalg.norm(p - t) > 0.8 for t in taken):
            taken.append(p)
            out.append(('Halimeda' if rng.random() < 0.6 else 'RedAlga', p - np.array([0, 0.02, 0]),
                        rng.uniform(0, math.tau), rng.uniform(0.2, 0.32)))
    return out


def instanced(tpl, places):
    """Preview only: the placed plants as one merged mesh in world space."""
    parts = []
    for kind, p, yaw, h in places:
        v, f, c, _ = tpl[kind]
        R = np.array([[math.cos(yaw), 0, math.sin(yaw)], [0, 1, 0], [-math.sin(yaw), 0, math.cos(yaw)]])
        parts.append(((v * h) @ R.T + p, f, c))
    vs, fs, cs, off = [], [], [], 0
    for v, f, c in parts:
        vs.append(v)
        fs.append(f + off)
        cs.append(c)
        off += len(v)
    return np.vstack(vs), np.vstack(fs), np.vstack(cs)
