"""V0.7 Pass 078: the large sea creatures, sculpted to the user's reference standard (playtest: "make
the large creature models up to the level of the attached screenshots").

    python3 tools/art/pass078/sea_creatures.py [hammerhead whale-shark killer-whale humpback-whale
                                                 ocean-sunfish eagle-ray manta-ray sea-lion]
    node tools/art/pass017/compress.mjs public/assets/models

Same method and contract as `mammals_sdf.py` (whose build step this shares): a signed distance
field of the body sweep, head forms and limbs, fused with smooth unions, polygonised, reduced in
Blender, coloured per vertex over a fine skin detail map; `<Root>` > `Body` + `Body_LOD1`, one
material, `Stroke_Left` / `Stroke_Right` morphs at rest weight 0. Root names and sizes are the
shipped ones, so every movement system drives them unchanged.

What the Pass 067/068 loft could not do and this adds: **fins** as true membranes, each a 2-D
outline (falcate dorsals, sickle pectorals, heterocercal and lunate tails, ray wings, a humpback's
knobbed flippers) with a thickness that tapers from root to edge, filleted into the body; and
head anatomy as its own forms (a hammerhead's cephalofoil, a whale shark's broad flat mouth, a
manta's cephalic lobes, a humpback's tubercles and ventral pleats, a sunfish's clavus).
Game space: +X head, +Y up, +Z left; metres.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import mammals_sdf as m  # noqa: E402

smooth, smin, smax, ellipsoid, chain, Body, noise3, spots = (
    m.smooth, m.smin, m.smax, m.ellipsoid, m.chain, m.Body, m.noise3, m.spots)
TAU = math.tau


def poly2d(q, V):
    """Signed distance from 2-D points `q` (N, 2) to the polygon `V` (M, 2); negative inside."""
    V = np.asarray(V, float)
    keep = np.linalg.norm(V - np.roll(V, 1, axis=0), axis=1) > 1e-9
    V = V[keep]
    d = np.full(len(q), np.inf)
    s = np.ones(len(q))
    j = len(V) - 1
    for i in range(len(V)):
        e = V[j] - V[i]
        w = q - V[i]
        b = w - e[None, :] * np.clip((w @ e) / (e @ e), 0, 1)[:, None]
        d = np.minimum(d, (b * b).sum(1))
        c1 = q[:, 1] >= V[i, 1]
        c2 = q[:, 1] < V[j, 1]
        c3 = e[0] * w[:, 1] > e[1] * w[:, 0]
        flip = (c1 & c2 & c3) | (~c1 & ~c2 & ~c3)
        s = np.where(flip, -s, s)
        j = i
    return s * np.sqrt(d)


def fin(p, origin, u, v, outline, thick, edge=0.006, depth=None):
    """A membrane in the plane through `origin` spanned by unit `u`, `v`, with 2-D `outline` (in
    metres along u, v): `thick` at its root region, tapering to `edge` at its margin."""
    origin, u, v = (np.asarray(x, float) for x in (origin, u, v))
    n = np.cross(u, v)
    n /= np.linalg.norm(n)
    q = p - origin
    q2 = np.stack([q @ u, q @ v], 1)
    h = np.abs(q @ n)
    d2 = poly2d(q2, outline)
    depth = depth or thick * 6
    t = edge + (thick - edge) * smooth(0, depth, -d2) ** 0.7
    inside = np.maximum(h - t, d2)
    outside = np.hypot(np.maximum(d2, 0), np.maximum(h - edge, 0))
    return np.where(d2 > 0, outside, inside)


def bez2(*ctrl, n=10):
    """A 2-D Bezier polyline through control points (for fin outlines)."""
    u = np.linspace(0, 1, n)[:, None]
    P = [np.broadcast_to(np.asarray(c, float), (n, 2)) for c in ctrl]
    while len(P) > 1:
        P = [P[i] * (1 - u) + P[i + 1] * u for i in range(len(P) - 1)]
    return P[0]


def outline(*curves):
    return np.vstack([c[:-1] for c in curves])


class Creature(m.Species):
    template = 'fish-skin'
    rough = 0.5
    near, far = 7600, 1400
    blend = 0.02
    resolution = 280
    eyes: list = []

    def eye_paint(self, p, col, r, iris=(0.03, 0.03, 0.035), ring=None):
        for e in self.eyes:
            # Measured across the side of the head (eyes face sideways), on the eye's own side.
            d = np.hypot(p[:, 0] - e[0], p[:, 1] - e[1])
            d = np.where((p[:, 2] * np.sign(e[2]) > abs(e[2]) * 0.8), d, 9.0)
            if ring is not None:
                col = np.where((d < r * 1.5)[:, None], np.array(ring), col)
            col = np.where((d < r)[:, None], np.array(iris), col)
        return col

    def lateral(self, p, sign, amp=0.11, start=0.35):
        """Shark/fish S-bend: the rear sweeps side to side, the head counters a little."""
        L = self.length
        xs = np.clip((p[:, 0].max() - p[:, 0]) / L, 0, 1.2)
        q = p.copy()
        q[:, 2] += sign * L * (amp * smooth(start, 1.1, xs) ** 1.5 - 0.015 * smooth(0.25, 0.0, xs))
        return q

    def fluke(self, p, sign, amp=0.08):
        L = self.length
        xs = np.clip((p[:, 0].max() - p[:, 0]) / L, 0, 1.2)
        q = p.copy()
        q[:, 1] += sign * amp * L * smooth(0.45, 1.1, xs) ** 1.8
        return q


# ------------------------------------------------------------------ sharks


class Hammerhead(Creature):
    """Scalloped hammerhead: a wide flat cephalofoil with the eyes at its tips and a scalloped
    front edge; a tall falcate first dorsal; long, swept pectorals; a heterocercal tail with a long
    upper lobe and a terminal notch; five gill slits; blue-grey over white, dusky fin tips."""
    root = 'Hammerhead'
    length = 3.07
    pad = ((0.1, 0.35, 0.3), (0.12, 0.35, 0.3))

    def build_body(self):
        L = self.length
        xs = np.linspace(0, 1, 9)
        spine = np.stack([(xs - 0.62) * L * 0.78, 0.01 * L * np.sin(xs * 3), np.zeros_like(xs)], 1)
        self.body = Body(spine,
                         [(0, .018 * L), (.1, .03 * L), (.3, .055 * L), (.55, .072 * L), (.72, .068 * L),
                          (.86, .05 * L), (.95, .032 * L), (1, .02 * L)],
                         [(0, .014 * L), (.1, .024 * L), (.3, .047 * L), (.55, .062 * L), (.72, .058 * L),
                          (.86, .045 * L), (.95, .03 * L), (1, .025 * L)], belly=0.18)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        ds = {'body': b.sdf(p)}
        head, up, t, H, W = b.at(1.0)
        # Cephalofoil: a flat, wide wing across the head; scalloped front, eyes at the tips.
        span = 0.135 * L
        front = [(0.02 * L, z) for z in np.linspace(-span, span, 9)]
        scallop = np.array([(x + 0.007 * L * (1 - math.cos(z / span * math.pi * 4)) * 0.5, z) for x, z in front])
        foil = outline(scallop, np.array([(-0.045 * L, span * 0.92), (-0.05 * L, span * 0.4), (-0.03 * L, 0),
                                          (-0.05 * L, -span * 0.4), (-0.045 * L, -span * 0.92), (0.02 * L, -span)]))
        ds['body'] = smin([ds['body'], fin(p, head + np.array([-0.01 * L, 0.004 * L, 0]), X, Z, foil, 0.017 * L,
                                           0.006 * L)], 0.02 * L)
        self.eyes = []
        for sd in (-1, 1):
            e = head + np.array([-0.012 * L, 0.006 * L, sd * span * 0.97])
            ds['body'] = smin([ds['body'], ellipsoid(p, e, (0.012 * L, 0.011 * L, 0.01 * L))], 0.006 * L)
            self.eyes.append(e + np.array([0, 0, sd * 0.009 * L]))
            # Five gill slits behind the head.
            c, upg, tg, Hg, Wg = b.at(0.86)
            for k in range(5):
                g = c - X * k * 0.012 * L + np.array([0, -0.004 * L, sd * Wg * 0.95])
                ds['body'] = smax(ds['body'], -ellipsoid(p, g, (0.0018 * L, 0.024 * L, 0.006 * L)), 0.002 * L)
        # Mouth: an underslung crescent under the head.
        ds['body'] = smax(ds['body'], -ellipsoid(p, head + np.array([-0.04 * L, -0.02 * L, 0]),
                                                 (0.012 * L, 0.0025 * L, 0.03 * L)), 0.002 * L)
        # First dorsal: tall and falcate; second dorsal and anal small; pectorals long and swept.
        c, *_ = b.at(0.58)
        top = c + Y * b.H(0.58) * 0.75
        ds['fins'] = fin(p, top, X, Y, outline(bez2((0.06 * L, 0), (0.03 * L, 0.1 * L), (-0.01 * L, 0.17 * L)),
                                                bez2((-0.01 * L, 0.17 * L), (-0.03 * L, 0.06 * L), (-0.07 * L, 0.01 * L)),
                                                np.array([(-0.07 * L, 0.01 * L), (-0.05 * L, -0.02 * L), (0.05 * L, -0.02 * L)])),
                         0.014 * L)
        c2, *_ = b.at(0.18)
        ds['fins'] = np.minimum(ds['fins'], fin(p, c2 + Y * b.H(0.18) * 0.7, X, Y,
                                                np.array([(0.02 * L, -0.01 * L), (-0.005 * L, 0.035 * L), (-0.02 * L, 0.02 * L),
                                                          (-0.03 * L, -0.01 * L)]), 0.006 * L))
        ds['fins'] = np.minimum(ds['fins'], fin(p, c2 - Y * b.H(0.18) * 0.7, X, -Y,
                                                np.array([(0.025 * L, -0.01 * L), (0.0, 0.04 * L), (-0.02 * L, 0.025 * L),
                                                          (-0.03 * L, -0.01 * L)]), 0.006 * L))
        c3, *_ = b.at(0.32)
        ds['fins'] = np.minimum(ds['fins'], fin(p, c3 - Y * b.H(0.32) * 0.75, X, -Y,
                                                np.array([(0.03 * L, -0.01 * L), (0.0, 0.05 * L), (-0.025 * L, 0.035 * L),
                                                          (-0.03 * L, -0.01 * L)]), 0.007 * L))
        cp, *_ = b.at(0.74)
        for sd in (-1, 1):
            out = np.array([-0.45, -0.32, sd * 0.84])
            out /= np.linalg.norm(out)
            back = np.cross(out, Y * sd)
            back /= np.linalg.norm(back)
            pect = outline(bez2((0.05 * L, 0), (0.06 * L, 0.12 * L), (-0.04 * L, 0.24 * L)),
                           bez2((-0.04 * L, 0.24 * L), (-0.02 * L, 0.1 * L), (-0.05 * L, 0.0)))
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp - Y * b.H(0.74) * 0.55 + Z * sd * b.W(0.74) * 0.7,
                                                    -back * sd, out, pect, 0.012 * L))
            # Pelvic fins.
            ds['fins'] = np.minimum(ds['fins'], fin(p, c3 + np.array([0.06 * L, -b.H(0.32) * 0.7, sd * b.W(0.32) * 0.4]), X,
                                                    np.array([0, -0.5, sd * 0.86]),
                                                    np.array([(0.02 * L, 0), (0.0, 0.05 * L), (-0.03 * L, 0.04 * L),
                                                              (-0.03 * L, 0)]), 0.006 * L))
        # Heterocercal tail: a long upper lobe with a terminal notch, a shorter lower lobe.
        tail = b.c[0] + np.array([0.01 * L, 0, 0])
        upper = outline(bez2((0.04 * L, 0.0), (-0.04 * L, 0.08 * L), (-0.16 * L, 0.2 * L)),
                        np.array([(-0.16 * L, 0.2 * L), (-0.17 * L, 0.185 * L), (-0.15 * L, 0.18 * L)]),
                        bez2((-0.15 * L, 0.18 * L), (-0.08 * L, 0.06 * L), (-0.04 * L, -0.02 * L)),
                        bez2((-0.04 * L, -0.02 * L), (-0.07 * L, -0.08 * L), (-0.1 * L, -0.12 * L)),
                        bez2((-0.1 * L, -0.12 * L), (-0.03 * L, -0.06 * L), (0.04 * L, -0.02 * L)),
                        np.array([(0.04 * L, -0.02 * L), (0.04 * L, 0)]))
        ds['tail'] = fin(p, tail, X, Y, upper, 0.012 * L, 0.004 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        top = np.array([0.44, 0.53, 0.6])
        belly = np.array([0.9, 0.91, 0.9])
        k = smooth(0.15, -0.35, yn + 0.25 * (label != 'body'))
        # Fins: grey above, the pectorals' undersides white with dusky tips.
        under = (label == 'fins') & (n[:, 1] < -0.3)
        k = np.where(under, np.maximum(k, 0.55), k)
        col = top * (1 - k[:, None]) + belly * k[:, None]
        col *= (1 + 0.05 * noise3(p, 6, 31) + 0.03 * noise3(p, 30, 32))[:, None]
        tip = (label == 'fins') & (p[:, 1] < p[:, 1].min() + 0.06 * self.length)
        col = np.where(tip[:, None], col * 0.6, col)
        return self.eye_paint(p, col, 0.006 * self.length, ring=(0.75, 0.78, 0.7))

    def stroke(self, p, label, sign):
        return self.lateral(p, sign, 0.1, 0.35)


def sample_along(body, s0, s1, offset, n=14):
    """Points along the body between s0 and s1, offset by (up * H * oy + z * W * oz)."""
    pts = []
    for s in np.linspace(s0, s1, n):
        c, up, t, H, W = body.at(s)
        oy, oz = offset(s)
        pts.append(c + up * H * oy + np.array([0, 0, W * oz]))
    return np.array(pts)


def torpedo(L, frac, H, W, x0=0.6, belly=0.15, arch=0.0):
    xs = np.linspace(0, 1, 9)
    spine = np.stack([(xs - x0) * L * frac, arch * L * np.sin(xs * math.pi), np.zeros_like(xs)], 1)
    return Body(spine, [(s, h * L) for s, h in H], [(s, w * L) for s, w in W], belly=belly)


def flipper_frame(out, back_hint):
    out = np.asarray(out, float)
    out /= np.linalg.norm(out)
    u = np.asarray(back_hint, float)
    u = u - out * (u @ out)
    u /= np.linalg.norm(u)
    return u, out


class WhaleShark(Creature):
    """Whale shark: a broad flat head with a wide terminal mouth at the very front, small eyes at
    its corners, ridges running along the back and flanks, big gill slits, moderate dorsals, broad
    pectorals and a tall crescent tail; blue-grey checked with pale spots and stripes, white below."""
    root = 'WhaleShark'
    length = 3.0
    pad = ((0.2, 0.3, 0.32), (0.06, 0.3, 0.32))

    def build_body(self):
        self.body = torpedo(self.length, 0.82,
                            [(0, .02), (.1, .033), (.3, .068), (.55, .092), (.75, .094), (.9, .078), (.97, .058), (1, .04)],
                            [(0, .016), (.1, .026), (.3, .058), (.55, .09), (.75, .1), (.9, .1), (.97, .092), (1, .07)],
                            x0=0.55, belly=0.2)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        d = b.sdf(p)
        head, up, t, H, W = b.at(1.0)
        # Wide terminal mouth: a slot across the front with a slight lip above it.
        d = smax(d, -ellipsoid(p, head + np.array([0.004 * L, -0.012 * L, 0]), (0.016 * L, 0.0045 * L, 0.062 * L)),
                 0.003 * L)
        d = smin([d, ellipsoid(p, head + np.array([-0.004 * L, 0.0, 0]), (0.014 * L, 0.012 * L, 0.06 * L))], 0.01 * L)
        self.eyes = []
        for sd in (-1, 1):
            e = head + np.array([-0.035 * L, 0.0, sd * 0.088 * L])
            d = smin([d, ellipsoid(p, e, (0.007 * L, 0.006 * L, 0.006 * L))], 0.004 * L)
            self.eyes.append(e + np.array([0, 0, sd * 0.004 * L]))
            for k in range(5):
                c, upg, tg, Hg, Wg = b.at(0.86 - k * 0.018)
                g = c + np.array([0, -0.01 * L, sd * Wg * 0.93])
                d = smax(d, -ellipsoid(p, g, (0.0022 * L, 0.04 * L, 0.008 * L)), 0.002 * L)
            # Three ridges along each side: one high on the back, two along the flank.
            for oy, oz, s1 in ((0.88, 0.36, 0.22), (0.45, 0.82, 0.2), (0.05, 0.98, 0.3)):
                pts = sample_along(b, 0.9, s1, lambda s, oy=oy, oz=oz: (oy, sd * oz), 12)
                d = smin([d, chain(p, list(pts), [0.0055 * L] * len(pts))], 0.008 * L)
        ds = {'body': d}
        # Dorsals, anal, pectorals.
        c, up, *_ = b.at(0.45)
        ds['fins'] = fin(p, c + Y * b.H(0.45) * 0.8, X, Y,
                         outline(bez2((0.06 * L, 0), (0.03 * L, 0.08 * L), (-0.015 * L, 0.115 * L)),
                                 bez2((-0.015 * L, 0.115 * L), (-0.03 * L, 0.05 * L), (-0.06 * L, 0.0)),
                                 np.array([(-0.06 * L, 0), (-0.04 * L, -0.03 * L), (0.05 * L, -0.03 * L)])), 0.014 * L)
        c2, *_ = b.at(0.22)
        for sgn in (1, -1):
            ds['fins'] = np.minimum(ds['fins'], fin(p, c2 + Y * sgn * b.H(0.22) * 0.75, X, Y * sgn,
                                                    np.array([(0.03 * L, -0.01 * L), (0.0, 0.045 * L), (-0.02 * L, 0.035 * L),
                                                              (-0.03 * L, -0.01 * L)]), 0.007 * L))
        cp, *_ = b.at(0.74)
        for sd in (-1, 1):
            u, out = flipper_frame((-0.3, -0.35, sd * 0.9), (-1, 0, 0))
            pect = outline(bez2((0.06 * L, 0), (0.06 * L, 0.11 * L), (-0.03 * L, 0.2 * L)),
                           bez2((-0.03 * L, 0.2 * L), (-0.03 * L, 0.08 * L), (-0.07 * L, 0.0)))
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp - Y * b.H(0.74) * 0.6 + Z * sd * b.W(0.74) * 0.75,
                                                    -u, out, pect, 0.014 * L))
            c3, *_ = b.at(0.32)
            ds['fins'] = np.minimum(ds['fins'], fin(p, c3 + np.array([0, -b.H(0.32) * 0.7, sd * b.W(0.32) * 0.4]), X,
                                                    np.array([0, -0.5, sd * 0.86]),
                                                    np.array([(0.025 * L, 0), (0.0, 0.05 * L), (-0.03 * L, 0.04 * L),
                                                              (-0.03 * L, 0)]), 0.007 * L))
        tail = b.c[0] + np.array([0.012 * L, 0, 0])
        ds['tail'] = fin(p, tail, X, Y,
                         outline(bez2((0.04 * L, 0.0), (-0.05 * L, 0.07 * L), (-0.13 * L, 0.17 * L)),
                                 bez2((-0.13 * L, 0.17 * L), (-0.08 * L, 0.06 * L), (-0.07 * L, 0.0)),
                                 bez2((-0.07 * L, 0.0), (-0.08 * L, -0.05 * L), (-0.1 * L, -0.11 * L)),
                                 bez2((-0.1 * L, -0.11 * L), (-0.03 * L, -0.05 * L), (0.04 * L, -0.015 * L))),
                         0.013 * L, 0.004 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        top = np.array([0.2, 0.28, 0.34])
        belly = np.array([0.88, 0.89, 0.88])
        k = smooth(-0.1, -0.5, yn)
        k = np.where((label != 'body') & (n[:, 1] < -0.4), np.maximum(k, 0.6), k)
        col = top * (1 - k[:, None]) + belly * k[:, None]
        # Checkerboard: thin pale bars across the back, thin lines along it, and a round pale spot
        # in the middle of each cell between them; small scattered spots on the head.
        pale = np.array([0.82, 0.85, 0.84])
        u = p[:, 0] / (0.07 * L) * TAU
        w = theta * 8
        bar = smooth(0.9, 0.97, np.cos(u))
        line = smooth(0.92, 0.98, np.cos(w))
        cellspot = smooth(-0.55, -0.8, np.cos(u)) * smooth(-0.55, -0.8, np.cos(w))
        head = spots(p, 0.024 * L, 5, 0.26) * (s > 0.84)
        body = (s < 0.86) & (s > 0.12)
        mark = np.maximum(np.maximum(bar, line) * 0.7 * body, np.maximum(cellspot * body, head))
        mark = mark * smooth(-0.35, 0.0, yn)
        col = col * (1 - mark[:, None]) + pale * mark[:, None]
        col *= (1 + 0.04 * noise3(p, 12, 7))[:, None]
        return self.eye_paint(p, col, 0.004 * L)

    def stroke(self, p, label, sign):
        return self.lateral(p, sign, 0.08, 0.4)


class Orca(Creature):
    """Killer whale: robust, a rounded head without a beak, a tall dorsal, broad rounded paddle
    pectorals and notched flukes; jet black with the white eye patch, white chin and belly lobing up
    the flank behind the dorsal, and a grey saddle."""
    root = 'Orca'
    length = 2.95
    template = 'fish-skin'
    rough = 0.35
    pad = ((0.16, 0.36, 0.3), (0.05, 0.3, 0.3))

    def build_body(self):
        self.body = torpedo(self.length, 0.86,
                            [(0, .022), (.1, .04), (.3, .088), (.55, .118), (.75, .114), (.88, .096), (.95, .074), (1, .03)],
                            [(0, .02), (.1, .033), (.3, .078), (.55, .108), (.75, .106), (.88, .09), (.95, .07), (1, .028)],
                            x0=0.55, belly=0.08)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        head, up, t, H, W = b.at(0.97)
        d = smin([b.sdf(p), ellipsoid(p, head + np.array([0.0, 0.01 * L, 0]), (0.06 * L, 0.06 * L, 0.06 * L))], 0.02 * L)
        # A shallow mouth line and the eyes.
        tip, *_ = b.at(1.0)
        d = smax(d, -ellipsoid(p, tip + np.array([-0.06 * L, -0.03 * L, 0]), (0.075 * L, 0.0025 * L, 0.06 * L)),
                 0.002 * L)
        self.eyes = [tip + np.array([-0.085 * L, -0.008 * L, sd * 0.062 * L]) for sd in (-1, 1)]
        ds = {'body': d}
        c, *_ = b.at(0.55)
        ds['fins'] = fin(p, c + Y * b.H(0.55) * 0.85, X, Y,
                         outline(bez2((0.07 * L, 0.0), (0.02 * L, 0.12 * L), (-0.03 * L, 0.21 * L)),
                                 bez2((-0.03 * L, 0.21 * L), (-0.03 * L, 0.1 * L), (-0.07 * L, 0.0)),
                                 np.array([(-0.07 * L, 0), (-0.05 * L, -0.03 * L), (0.06 * L, -0.03 * L)])),
                         0.016 * L)
        cp, *_ = b.at(0.8)
        for sd in (-1, 1):
            u, out = flipper_frame((-0.35, -0.55, sd * 0.75), (-1, 0, 0))
            paddle = np.array([(0.045 * L * math.cos(a) - 0.01 * L, 0.075 * L + 0.085 * L * math.sin(a))
                               for a in np.linspace(-math.pi / 2, 1.5 * math.pi, 24)[:-1]])
            paddle[:, 1] = np.maximum(paddle[:, 1], -0.01 * L)
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp - Y * b.H(0.8) * 0.6 + Z * sd * b.W(0.8) * 0.7,
                                                    -u, out, paddle, 0.013 * L, 0.004 * L))
        # Flukes: horizontal, swept, notched.
        tail = b.c[0] + np.array([0.02 * L, 0, 0])
        fl = []
        for sd in (1, -1):
            fl.append(np.array([(0.04 * L, 0.0), (0.0, sd * 0.05 * L), (-0.06 * L, sd * 0.14 * L), (-0.085 * L, sd * 0.15 * L),
                                (-0.08 * L, sd * 0.1 * L), (-0.06 * L, sd * 0.03 * L), (-0.07 * L, sd * 0.004 * L)]))
        fluke = np.vstack([fl[0], fl[1][::-1]])
        ds['tail'] = fin(p, tail, X, Z, fluke, 0.014 * L, 0.004 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        black = np.array([0.035, 0.038, 0.045])
        white = np.array([0.93, 0.93, 0.91])
        x = s
        # Chin and belly white, lobing up the flank behind the dorsal.
        lobe = 0.5 * smooth(0.22, 0.32, x) * smooth(0.48, 0.38, x)
        w = smooth(-0.3 + lobe, -0.45 + lobe, yn) * smooth(0.12, 0.2, x)
        w = np.maximum(w, smooth(-0.15, -0.35, yn) * (x > 0.75))
        tip = p[:, 0].max()
        eye = np.array([tip - 0.135 * L, 0.018 * L, 0])
        q = (p - eye) / np.array([0.05 * L, 0.017 * L, 1])
        q[:, 1] -= 0.25 * q[:, 0]
        patch = smooth(1.05, 0.9, np.hypot(q[:, 0], q[:, 1])) * (np.abs(p[:, 2]) > 0.03 * L) * (label == 'body')
        w = np.maximum(w, patch)
        w = np.where(label == 'tail', smooth(0.1, -0.2, n[:, 1]), w)
        w = np.where(label == 'fins', 0.0, w)
        col = black * (1 - w[:, None]) + white * w[:, None]
        saddle = smooth(0.6, 0.85, yn) * smooth(0.36, 0.42, x) * smooth(0.52, 0.46, x) * (label == 'body')
        col = col * (1 - saddle[:, None] * 0.5) + np.array([0.42, 0.43, 0.45]) * saddle[:, None] * 0.5
        col *= (1 + 0.04 * noise3(p, 8, 9))[:, None]
        return self.eye_paint(p, col, 0.007 * L)

    def stroke(self, p, label, sign):
        return self.fluke(p, sign, 0.07)


class Humpback(Creature):
    """Humpback whale: a long body with a flat, knobbed rostrum (tubercles), ventral pleats from chin
    to navel, very long flippers with a scalloped leading edge, a small dorsal on a hump and broad
    flukes with a serrated trailing edge; slate blue above, pale pleated throat, flippers pale."""
    root = 'Humpback'
    length = 2.95
    rough = 0.45
    pad = ((0.15, 0.3, 0.42), (0.05, 0.24, 0.42))

    def build_body(self):
        self.body = torpedo(self.length, 0.86,
                            [(0, .016), (.1, .03), (.3, .072), (.55, .1), (.72, .104), (.86, .092), (.95, .062), (1, .03)],
                            [(0, .016), (.1, .03), (.3, .074), (.55, .104), (.72, .11), (.86, .1), (.95, .07), (1, .034)],
                            x0=0.55, belly=0.0)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        d = b.sdf(p)
        s, theta, yn = b.param(p)
        # Ventral pleats: grooves along the throat and belly.
        pleat = (0.5 + 0.5 * np.cos(theta * 34)) * smooth(-0.15, -0.45, yn) * smooth(0.55, 0.62, s)
        d = d + 0.0035 * L * pleat
        # Flat rostrum: shave the top of the head flat, then the tubercles in rows on it and the jaw.
        tip, *_ = b.at(1.0)
        cut = p[:, 1] - (tip[1] + 0.028 * L + 0.12 * (tip[0] - p[:, 0])) - 0.15 * L * (1 - smooth(0.8, 0.93, s))
        d = smax(d, cut, 0.02 * L)
        knobs = []
        for k, xk in enumerate(np.linspace(0.02, 0.15, 6)):
            for oz in (-0.035, -0.012, 0.012, 0.035):
                y = 0.028 * L + 0.12 * xk * L - 0.003 * L - abs(oz) * 0.15 * L
                knobs.append(ellipsoid(p, tip + np.array([-xk * L, y, oz * L * (1 + xk)]), (0.006 * L, 0.0045 * L, 0.006 * L)))
        d = smin([d, *knobs], 0.004 * L)
        d = smax(d, -ellipsoid(p, tip + np.array([-0.08 * L, -0.012 * L, 0]), (0.11 * L, 0.003 * L, 0.08 * L)), 0.002 * L)
        self.eyes = [tip + np.array([-0.17 * L, -0.012 * L, sd * 0.098 * L]) for sd in (-1, 1)]
        # Small dorsal on a hump.
        ch, *_ = b.at(0.33)
        d = smin([d, ellipsoid(p, ch + Y * b.H(0.33) * 0.85, (0.06 * L, 0.025 * L, 0.03 * L))], 0.015 * L)
        ds = {'body': d}
        ds['fins'] = fin(p, ch + Y * b.H(0.33) * 1.0, X, Y,
                         np.array([(0.035 * L, -0.01 * L), (0.0, 0.025 * L), (-0.03 * L, 0.035 * L), (-0.035 * L, -0.01 * L)]),
                         0.01 * L)
        # Long flippers with knobs along the leading edge.
        cp, *_ = b.at(0.76)
        for sd in (-1, 1):
            u, out = flipper_frame((-0.5, -0.35, sd * 0.8), (-1, 0, 0))
            span = 0.32 * L
            lead = [(0.035 * L * (1 - r) + 0.006 * L * math.cos(r * 9 * math.pi) * (r > 0.1), r * span)
                    for r in np.linspace(0, 1, 28)]
            trail = [(-0.04 * L * (1 - r) ** 0.8 - 0.004 * L, r * span) for r in np.linspace(1, 0, 14)]
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp - Y * b.H(0.76) * 0.55 + Z * sd * b.W(0.76) * 0.8,
                                                    -u, out, np.array(lead + trail), 0.014 * L, 0.004 * L))
        tail = b.c[0] + np.array([0.02 * L, 0, 0])
        fl = []
        for sd in (1, -1):
            edge = [(-0.085 * L + 0.012 * L * (r ** 2) - 0.004 * L * abs(math.sin(r * 7 * math.pi)), sd * r * 0.165 * L)
                    for r in np.linspace(0.06, 1, 16)]
            fl.append(np.array([(0.04 * L, 0.0), (0.0, sd * 0.05 * L), (-0.05 * L, sd * 0.15 * L)] + edge[::-1]
                               + [(-0.07 * L, sd * 0.004 * L)]))
        ds['tail'] = fin(p, tail, X, Z, np.vstack([fl[0], fl[1][::-1]]), 0.013 * L, 0.004 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        top = np.array([0.13, 0.21, 0.32])
        pale = np.array([0.72, 0.78, 0.84])
        k = smooth(-0.15, -0.5, yn) * smooth(0.5, 0.62, s)
        k = np.where(label == 'fins', 0.15 + 0.6 * smooth(0.0, -0.5, n[:, 1]), k)
        k = np.where(label == 'tail', smooth(0.1, -0.3, n[:, 1]) * 0.8, k)
        col = top * (1 - k[:, None]) + pale * k[:, None]
        # Grooves of the pleats a shade darker, scars and barnacle flecks on the head.
        groove = (0.5 + 0.5 * np.cos(theta * 34)) * smooth(-0.15, -0.45, yn) * smooth(0.55, 0.62, s)
        col *= (1 - 0.25 * groove)[:, None]
        fleck = spots(p, 0.02 * L, 11, 0.22) * (s > 0.88) * (yn > 0)
        col = col * (1 - fleck[:, None] * 0.6) + pale * fleck[:, None] * 0.6
        col *= (1 + 0.05 * noise3(p, 7, 12) + 0.03 * noise3(p, 30, 13))[:, None]
        return self.eye_paint(p, col, 0.006 * L)

    def stroke(self, p, label, sign):
        return self.fluke(p, sign, 0.075)


class Sunfish(Creature):
    """Ocean sunfish: a tall, laterally flat disc ending in the scalloped clavus, a tall swept dorsal
    and anal fin, small rounded pectorals, a small beaked mouth and a large eye; silver grey, darker
    above, mottled with pale blotches."""
    root = 'Sunfish'
    length = 1.2
    resolution = 300
    pad = ((0.12, 0.62, 0.15), (0.05, 0.62, 0.15))

    def build_body(self):
        L = self.length
        xs = np.linspace(0, 1, 9)
        spine = np.stack([(xs - 0.5) * L * 0.86, np.zeros_like(xs), np.zeros_like(xs)], 1)
        self.body = Body(spine, [(0, .3 * L), (.2, .33 * L), (.5, .36 * L), (.75, .31 * L), (.9, .21 * L), (1, .07 * L)],
                         [(0, .045 * L), (.2, .07 * L), (.5, .11 * L), (.75, .12 * L), (.9, .1 * L), (1, .05 * L)],
                         belly=0.0)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        tip, *_ = b.at(1.0)
        d = smin([b.sdf(p), ellipsoid(p, tip + np.array([0.005 * L, -0.02 * L, 0]), (0.03 * L, 0.035 * L, 0.03 * L))],
                 0.02 * L)
        d = smax(d, -ellipsoid(p, tip + np.array([0.035 * L, -0.02 * L, 0]), (0.012 * L, 0.012 * L, 0.012 * L)), 0.004 * L)
        self.eyes = []
        for sd in (-1, 1):
            e = tip + np.array([-0.1 * L, 0.04 * L, sd * b.W(0.86) * 0.8])
            d = smin([d, ellipsoid(p, e, (0.036 * L, 0.036 * L, 0.024 * L))], 0.012 * L)
            self.eyes.append(e + np.array([0, 0, sd * 0.024 * L]))
        ds = {'body': d}
        c, *_ = b.at(0.28)
        dorsal = outline(bez2((0.12 * L, -0.05 * L), (0.05 * L, 0.25 * L), (-0.12 * L, 0.48 * L)),
                         bez2((-0.12 * L, 0.48 * L), (-0.13 * L, 0.25 * L), (-0.13 * L, -0.05 * L)))
        ds['fins'] = np.minimum(fin(p, c + Y * 0.27 * L, X, Y, dorsal, 0.035 * L, 0.006 * L),
                                fin(p, c - Y * 0.27 * L, X, -Y, dorsal, 0.035 * L, 0.006 * L))
        for sd in (-1, 1):
            cp = tip + np.array([-0.27 * L, 0.02 * L, sd * 0.1 * L])
            u, out = flipper_frame((-0.4, 0.8, sd * 0.45), (1, 0, 0))
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp, u, out,
                                                    np.array([(0.04 * L * math.cos(a), 0.06 * L + 0.07 * L * math.sin(a))
                                                              for a in np.linspace(-math.pi / 2, 1.5 * math.pi, 18)[:-1]]),
                                                    0.012 * L, 0.004 * L))
        # Clavus: the scalloped rear rudder.
        rear = b.c[0]
        lobes = [(-0.06 * L - 0.03 * L * abs(math.sin(a * 4)) * (1 - abs(a) / 1.7), a * 0.29 * L)
                 for a in np.linspace(1.0, -1.0, 32)]
        cl = np.array([(0.06 * L, -0.27 * L), (0.06 * L, 0.27 * L)] + lobes)
        ds['tail'] = fin(p, rear, X, Y, cl, 0.04 * L, 0.006 * L, depth=0.08 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        top = np.array([0.4, 0.44, 0.48])
        pale = np.array([0.78, 0.8, 0.8])
        k = smooth(0.4, -0.6, p[:, 1] / (0.36 * L))
        col = top * (1 - k[:, None]) + pale * k[:, None]
        blot = spots(p, 0.09 * L, 14, 0.42) * (label == 'body')
        col = col * (1 - blot[:, None] * 0.35) + np.array([0.86, 0.87, 0.86]) * blot[:, None] * 0.35
        col = np.where((label == 'fins')[:, None], col * 0.72, col)
        col = np.where((label == 'tail')[:, None], col * 0.85, col)
        col *= (1 + 0.06 * noise3(p, 9, 15) + 0.03 * noise3(p, 40, 16))[:, None]
        return self.eye_paint(p, col, 0.026 * L, ring=(0.7, 0.72, 0.72))

    def stroke(self, p, label, sign):
        """The dorsal and anal fins scull together to one side; the clavus follows a little."""
        L = self.length
        q = p.copy()
        reach = smooth(0.25 * L, 0.7 * L, np.abs(p[:, 1]))
        q[:, 2] += sign * 0.22 * L * reach ** 1.3
        rear = smooth(-0.3 * L, -0.48 * L, p[:, 0])
        q[:, 2] += sign * 0.03 * L * rear
        return q


class RayBase(Creature):
    """Rays: a central body (head, disc core, tail) along +X, the wings a membrane in the x-z plane."""
    resolution = 360
    blend = 0.025
    flap = 0.22

    def stroke(self, p, label, sign):
        half = np.abs(p[:, 2]).max()
        r = np.clip(np.abs(p[:, 2]) / half, 0, 1)
        q = p.copy()
        # The beat travels back along the wing: the trailing edge lags a touch.
        q[:, 1] += sign * self.flap * half * r ** 1.7
        q[:, 0] -= sign * 0.03 * half * r ** 2
        return q


class EagleRay(RayBase):
    """Spotted eagle ray: a diamond disc with pointed tips, a domed head with a rounded duck-bill
    snout and eyes on its sides, a very long whip tail with a small dorsal at its base; ink blue
    above with white spots and rings, white beneath."""
    root = 'Ray'
    length = 4.3
    pad = ((0.02, 0.06, 0.02), (0.02, 0.06, 0.02))

    def build_body(self):
        xs = np.array([-3.72, -2.0, -0.45, 0.05, 0.55, 0.68])
        spine = np.stack([xs, np.zeros_like(xs), np.zeros_like(xs)], 1)
        self.body = Body(spine, [(0, .004), (.5, .009), (.7, .025), (.74, .05), (.84, .085), (.93, .07), (.96, .055), (1, .03)],
                         [(0, .004), (.5, .009), (.7, .025), (.74, .1), (.84, .18), (.93, .11), (.96, .09), (1, .055)],
                         belly=0.35)
        self.pad = ((0.02, 0.06, 0.37), (0.02, 0.06, 0.37))

    def parts(self, p):
        X, Y, Z = np.eye(3)
        b = self.body
        d = smin([b.sdf(p), ellipsoid(p, (0.6, 0.0, 0), (0.17, 0.065, 0.1)),
                  ellipsoid(p, (0.76, -0.018, 0), (0.1, 0.028, 0.07))], 0.03)
        self.eyes = []
        for sd in (-1, 1):
            e = np.array([0.55, 0.025, sd * 0.1])
            d = smin([d, ellipsoid(p, e, (0.025, 0.022, 0.018))], 0.015)
            self.eyes.append(e + np.array([0, 0, sd * 0.012]))
            d = smax(d, -ellipsoid(p, (0.48, 0.03, sd * 0.07), (0.022, 0.01, 0.014)), 0.006)  # spiracle
        ds = {'body': d}
        wing = []
        for sd in (1, -1):
            lead = bez2((0.5, sd * 0.08), (0.25, sd * 0.85), (-0.2, sd * 1.5), n=14)
            trail = bez2((-0.2, sd * 1.5), (-0.3, sd * 0.9), (-0.5, sd * 0.12), n=14)
            wing.append(np.vstack([lead[:-1], trail]))
        outline_ = np.vstack([wing[0], wing[1][::-1]])
        ds['wings'] = fin(p, (0, 0.005, 0), X, Z, outline_, 0.1, 0.012, depth=0.9)
        for sd in (-1, 1):
            ds['wings'] = np.minimum(ds['wings'], fin(p, (-0.45, -0.01, sd * 0.07), X, Z * sd,
                                                      np.array([(0.05, 0), (0.0, 0.12), (-0.18, 0.08), (-0.12, 0.0)]),
                                                      0.02, 0.006))
        ds['tail'] = fin(p, (-0.52, 0.025, 0), X, Y,
                         np.array([(0.04, -0.01), (-0.02, 0.07), (-0.07, 0.05), (-0.08, -0.01)]), 0.012, 0.005)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        top = np.array([0.07, 0.09, 0.13])
        white = np.array([0.92, 0.93, 0.92])
        k = smooth(0.15, -0.3, n[:, 1])
        col = top * (1 - k[:, None]) + white * k[:, None]
        dots = spots(p, 0.13, 21, 0.24)
        ring = spots(p, 0.21, 22, 0.3) * (1 - spots(p, 0.21, 22, 0.18))
        mark = np.maximum(dots, ring * 0.9) * (1 - k) * (p[:, 0] > -0.6)
        col = col * (1 - mark[:, None]) + white * mark[:, None]
        col *= (1 + 0.05 * noise3(p, 7, 23))[:, None]
        return self.eye_paint(p, col, 0.016)


class Manta(RayBase):
    """Reef manta: broad sickle wings, a wide terminal mouth between the two cephalic lobes, gill
    slits beneath, a short tail; black above with pale shoulder patches, white beneath with dark
    belly spots and dusky wing margins."""
    root = 'Manta'
    length = 4.3
    flap = 0.2

    def build_body(self):
        xs = np.array([-1.4, -0.7, -0.35, 0.25, 0.85, 0.95])
        spine = np.stack([xs, np.zeros_like(xs), np.zeros_like(xs)], 1)
        self.body = Body(spine, [(0, .006), (.3, .015), (.44, .06), (.68, .13), (.93, .09), (1, .06)],
                         [(0, .006), (.3, .015), (.44, .16), (.68, .33), (.93, .3), (1, .26)], belly=0.3)
        self.pad = ((0.03, 0.05, 0.52), (0.07, 0.05, 0.52))

    def parts(self, p):
        X, Y, Z = np.eye(3)
        b = self.body
        d = b.sdf(p)
        d = smax(d, -ellipsoid(p, (0.96, -0.01, 0), (0.06, 0.03, 0.2)), 0.01)  # the mouth
        self.eyes = []
        for sd in (-1, 1):
            e = np.array([0.82, 0.02, sd * 0.32])
            self.eyes.append(e + np.array([0, 0, sd * 0.02]))
            d = smin([d, ellipsoid(p, e, (0.035, 0.03, 0.03))], 0.02)
            for k in range(5):
                d = smax(d, -ellipsoid(p, (0.5 - k * 0.07, -0.1, sd * 0.24), (0.008, 0.01, 0.07)), 0.004)
        ds = {'body': d}
        lobes = []
        for sd in (-1, 1):
            lobes.append(chain(p, [np.array([0.86, 0.0, sd * 0.29]), np.array([1.03, -0.015, sd * 0.31]),
                                   np.array([1.11, -0.035, sd * 0.27])], [0.03, 0.026, 0.014], flat=((0, 0, 1), 0.4)))
        ds['lobes'] = np.minimum(*lobes)
        wing = []
        for sd in (1, -1):
            lead = bez2((0.75, sd * 0.25), (0.55, sd * 1.3), (-0.4, sd * 2.1), n=16)
            trail = bez2((-0.4, sd * 2.1), (-0.1, sd * 1.1), (-0.4, sd * 0.2), n=16)
            wing.append(np.vstack([lead[:-1], trail]))
        ds['wings'] = fin(p, (0, 0, 0), X, Z, np.vstack([wing[0], wing[1][::-1]]), 0.11, 0.012, depth=0.9)
        ds['wings'] = np.minimum(ds['wings'], fin(p, (-0.4, 0.04, 0), X, Y,
                                                  np.array([(0.05, -0.02), (-0.02, 0.06), (-0.08, 0.03), (-0.08, -0.02)]),
                                                  0.015, 0.005))
        return ds

    def colour(self, p, n, s, theta, yn, label):
        black = np.array([0.04, 0.045, 0.055])
        white = np.array([0.92, 0.92, 0.9])
        k = smooth(0.15, -0.3, n[:, 1])
        k = np.where(label == 'lobes', k * 0.4, k)
        # Pale chevron shoulder patches on the upper surface.
        az = np.abs(p[:, 2])
        patch = smooth(0.12, 0.0, np.abs(p[:, 0] - (0.45 - 0.35 * az)) - 0.12) * smooth(0.25, 0.45, az) * smooth(1.25, 0.9, az)
        top = black * (1 - patch[:, None] * 0.8) + np.array([0.8, 0.82, 0.82]) * patch[:, None] * 0.8
        # Underside: dusky wing margins and the belly spots.
        margin = smooth(1.4, 2.0, az) * 0.6
        bspots = spots(p, 0.09, 31, 0.3) * smooth(0.5, 0.2, az) * (p[:, 0] < 0.4)
        under = white * (1 - np.maximum(margin, bspots)[:, None]) + black * np.maximum(margin, bspots)[:, None]
        col = top * (1 - k[:, None]) + under * k[:, None]
        col *= (1 + 0.05 * noise3(p, 6, 32))[:, None]
        return self.eye_paint(p, col, 0.02)


class SeaLion(m.Seal):
    """California sea lion: a sleek, long-necked body, a pointed dog-like muzzle with whiskers, small
    external ears, long wing-like fore-flippers and hind flippers turned back; warm brown, darker
    and glossy along the back, paler on the chest."""
    root = 'SeaLion'
    length = 2.05
    rough = 0.4
    spine_y = ((0, 0.0), (0.4, 0.02), (0.7, 0.045), (0.84, 0.1), (1, 0.13))
    height = [(0, .03), (.06, .06), (.2, .12), (.45, .16), (.62, .155), (.74, .12), (.82, .085),
              (.9, .075), (.96, .06), (1, .025)]
    width = [(0, .035), (.06, .07), (.2, .13), (.45, .16), (.62, .15), (.74, .11), (.82, .075),
             (.9, .075), (.96, .06), (1, .025)]
    fore = dict(s=.66, len=.25, chord=.075, droop=.75)
    hind = dict(len=.14, spread=.4)
    head = dict(muzzle=1.2, pads=0.6, gape=0.5)

    def parts(self, p):
        ds = super().parts(p)
        L, b = self.length, self.body
        c, up, t, H, W = b.at(0.93)
        ears = []
        for sd in (-1, 1):
            base = c - t * 0.03 * L + up * H * 0.55 + np.array([0, 0, sd * W * 0.85])
            ears.append(chain(p, [base, base + np.array([-0.03 * L, 0.006 * L, sd * 0.014 * L])],
                              [0.009 * L, 0.0035 * L], flat=((0, 0, 1), 0.5)))
        ds['body'] = smin([ds['body'], *ears], 0.004 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        back = np.array([0.24, 0.16, 0.1])
        chest = np.array([0.55, 0.42, 0.3])
        k = smooth(0.2, -0.6, yn)
        col = back * (1 - k[:, None]) + chest * k[:, None]
        col = np.where((label == 'fore')[:, None] | (label == 'hind')[:, None], back * 0.75, col)
        col *= (1 + 0.06 * noise3(p, 8, 41) + 0.03 * noise3(p, 30, 42))[:, None]
        col = np.where(((s > 0.97) & (yn < 0.2))[:, None], col * 0.8, col)
        return m.WeddellSeal.features(self, p, col)

    def stroke(self, p, label, sign):
        """The fore-flippers sweep down and back together (the sea lion's flight stroke)."""
        L, b = self.length, self.body
        f = self.fore
        cf, upf, tf, Hf, Wf = b.at(f['s'])
        q = p.copy()
        w = smooth(Wf * 0.6, Wf * 1.15, np.abs(p[:, 2])) * smooth(0.18 * L, 0.05 * L, np.abs(p[:, 0] - cf[0]))
        w = np.maximum(w, (label == 'fore') * 1.0) * smooth(0.25 * L, 0.12 * L, np.abs(p[:, 0] - cf[0]))
        rel = p - cf
        a = sign * 0.5 * w * np.sign(rel[:, 2])
        q[:, 1] = cf[1] + rel[:, 1] * np.cos(a) + rel[:, 2] * np.sin(a)
        q[:, 2] = cf[2] - rel[:, 1] * np.sin(a) + rel[:, 2] * np.cos(a)
        q[:, 0] -= sign * 0.04 * L * w
        return q


SPECIES = {'hammerhead': Hammerhead, 'whale-shark': WhaleShark, 'killer-whale': Orca, 'humpback-whale': Humpback,
           'ocean-sunfish': Sunfish, 'eagle-ray': EagleRay, 'manta-ray': Manta, 'sea-lion': SeaLion}

if __name__ == '__main__':
    for name in (sys.argv[1:] or SPECIES):
        m.build_species(name, SPECIES[name]())
