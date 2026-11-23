"""V0.8 Pass 084: marine creature artistic refinement.

    python3 tools/art/pass084/creatures.py [names...]       # Blender 5.1 Python (bpy module)
    node tools/art/pass017/compress.mjs public/assets/models

Builds on the Pass 078 sculpt method (signed distance fields fused with smooth unions, marching
cubes, reduced in Blender, coloured per vertex over a fine detail texture; `<Root>` > `Body` +
`Body_LOD1`, one material, `Stroke_Left` / `Stroke_Right` morphs at rest weight 0). Root names and
sizes are the shipped ones, so every movement and encounter system drives them unchanged.

What this pass corrects (see docs/V08_CREATURE_REFINEMENT.md):

* **Skin.** The Pass 078 detail maps were sums of integer plane waves, which tile as straight,
  directional stripes: under the tank light every animal looked wrapped in brushed fabric. They are
  replaced by band-limited, isotropic noise made in the frequency domain (seamless by construction):
  fine dermal-denticle grain for sharks and rays, smooth skin with faint pores and creases for
  whales and seals, short broken clumped strands for fur, and leathery scaled skin for the turtle.
* **Hammerhead.** The eyes were spheres hanging off a thin cephalofoil; they now sit in thickened
  lateral lobes at its tips. A nape fills the step from body to head, and fin roots are filleted.
* **Sharks.** The reef, whitetip, great white, leopard and nurse sharks were one lofted body tinted
  five ways. Each is now sculpted with its own silhouette (snout, girth, fin plan and tail).
* **Seals, sea lion, polar bear, turtle and rays**: see each class.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass078'))
import mammals_sdf as m  # noqa: E402
import sea_creatures as sc  # noqa: E402

smooth, smin, smax, ellipsoid, chain, Body, noise3, spots = (
    m.smooth, m.smin, m.smax, m.ellipsoid, m.chain, m.Body, m.noise3, m.spots)
fin, bez2, outline, flipper_frame, torpedo = sc.fin, sc.bez2, sc.outline, sc.flipper_frame, sc.torpedo
round_cone = m.round_cone
TAU = math.tau

# ------------------------------------------------------------------ skin detail maps

SKIN = {'kind': 'denticle'}


def band(n, f0, f1, rng, aniso=(1.0, 1.0)):
    """Seamless band-limited noise: white noise filtered in the frequency domain to a ring between
    f0 and f1 cycles per tile (optionally stretched, for strands). Normalised to 0..1."""
    w = rng.standard_normal((n, n))
    fx = np.fft.fftfreq(n) * n
    FX, FY = np.meshgrid(fx, fx)
    r = np.hypot(FX * aniso[0], FY * aniso[1])
    mid, width = (f0 + f1) / 2, max((f1 - f0) / 2, 1)
    filt = np.exp(-((r - mid) / width) ** 2)
    h = np.real(np.fft.ifft2(np.fft.fft2(w) * filt))
    return (h - h.min()) / (h.max() - h.min() + 1e-12)


def detail_texture(stem, fur):
    """Replaces Pass 078's plane-wave maps: near-white base (the vertex colours carry the coat),
    a restrained, isotropic normal map and a matte ORM, by kind of skin."""
    n = 512
    rng = np.random.default_rng(84)
    kind = 'fur' if fur else SKIN['kind']
    if kind == 'denticle':
        # Placoid scales: a fine, even grain, a softer mottling under it.
        grain = band(n, 110, 150, rng)
        mottle = band(n, 10, 22, rng)
        h = 0.65 * grain + 0.35 * mottle
        base = 0.93 + 0.07 * mottle
        strength, rough = 1.0, 0.68
    elif kind == 'smooth':
        # Wet mammal skin: gentle undulation, faint creases, sparse pores.
        und = band(n, 5, 12, rng)
        crease = band(n, 30, 50, rng)
        pores = smooth(0.78, 0.9, band(n, 160, 220, rng))
        h = 0.5 * und + 0.3 * crease - 0.25 * pores
        base = 0.94 + 0.05 * und - 0.04 * pores
        strength, rough = 0.9, 0.45
    elif kind == 'scute':
        # Leathery, finely scaled skin.
        cells = band(n, 40, 60, rng)
        h = 0.7 * smooth(0.35, 0.65, cells) + 0.3 * band(n, 120, 170, rng)
        base = 0.9 + 0.1 * cells
        strength, rough = 1.4, 0.65
    else:
        # Fur: short, clumped strands, broken at random so no line runs across the map.
        strands = band(n, 70, 130, rng, aniso=(1.0, 0.22))
        breakup = band(n, 14, 28, rng)
        clumps = band(n, 6, 12, rng)
        h = 0.55 * strands * (0.55 + 0.45 * breakup) + 0.45 * clumps
        base = 0.9 + 0.1 * clumps
        strength, rough = 2.2, 0.8
    h = (h - h.min()) / (h.max() - h.min() + 1e-12)
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    nx, ny = -dx * strength, -dy * strength
    ln = np.sqrt(nx * nx + ny * ny + 1)
    m.TEX.mkdir(parents=True, exist_ok=True)
    save = lambda a, f: Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(m.TEX / f, optimize=True)  # noqa: E731
    save(np.stack([base] * 3, -1), f'{stem}-base.png')
    save(np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, 1 / ln * 0.5 + 0.5], -1), f'{stem}-normal.png')
    save(np.stack([np.ones_like(h), rough + 0.08 * (h - 0.5), np.zeros_like(h)], -1), f'{stem}-orm.png')


m.detail_texture = detail_texture

# ------------------------------------------------------------------ smooth body profiles

_body_init = m.Body.__init__
# The rays keep Pass 078's profiles: their whip tails are thinner than a voxel, and the smooth
# curve shortened the eagle ray's below its validated length.
SMOOTH = {'on': True}


def _smooth_body_init(self, spine, height, width, belly=0.25, samples=600):
    """Pass 078 interpolated each body's depth and width profile piecewise-linearly, so every
    profile knot left a ring-shaped crease around the body (most visible on the seals and the sea
    lion). Monotone cubic interpolation passes through the same knots without the creases."""
    from scipy.interpolate import PchipInterpolator  # noqa: PLC0415
    if SMOOTH['on']:
        # The spine itself was piecewise-linear through a few control points; each kink twisted
        # the cross-section frame and left a ring. A spline through the same points removes them.
        from scipy.interpolate import CubicSpline  # noqa: PLC0415
        sp = np.asarray(spine, float)
        d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(sp, axis=0), axis=1))])
        cs = CubicSpline(d, sp, bc_type='natural')
        spine = cs(np.linspace(0, d[-1], 64))
    _body_init(self, spine, height, width, belly, samples)
    if not SMOOTH['on']:
        return
    hs, hv = zip(*height)
    ws, wv = zip(*width)
    fh = PchipInterpolator(hs, hv, extrapolate=True)
    fw = PchipInterpolator(ws, wv, extrapolate=True)
    self.H = lambda s: fh(np.clip(s, hs[0], hs[-1]))
    self.W = lambda s: fw(np.clip(s, ws[0], ws[-1]))


m.Body.__init__ = _smooth_body_init

# ------------------------------------------------------------------ hammerhead


class Hammerhead(sc.Hammerhead):
    """Pass 078's scalloped hammerhead with the eyes set into thickened lobes at the cephalofoil's
    tips (they hung below it as separate spheres), a nape that carries the body into the head, and
    filleted fin roots."""
    blend = 0.05
    rough = 0.64

    def build_body(self):
        L = self.length
        xs = np.linspace(0, 1, 9)
        spine = np.stack([(xs - 0.62) * L * 0.78, 0.01 * L * np.sin(xs * 3), np.zeros_like(xs)], 1)
        # A fuller head end: the body meets the cephalofoil at its width, not as a thin tip.
        self.body = Body(spine,
                         [(0, .018 * L), (.1, .03 * L), (.3, .055 * L), (.55, .072 * L), (.72, .068 * L),
                          (.86, .052 * L), (.95, .038 * L), (1, .028 * L)],
                         [(0, .014 * L), (.1, .024 * L), (.3, .047 * L), (.55, .062 * L), (.72, .058 * L),
                          (.86, .047 * L), (.95, .036 * L), (1, .032 * L)], belly=0.18)

    def base_parts(self, p):
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

    def parts(self, p):
        ds = self.base_parts(p)
        L, b = self.length, self.body
        head, *_ = b.at(1.0)
        span = 0.135 * L
        # The foil thickens toward its tips into the eye lobes.
        lobes = []
        self.eyes = []
        for sd in (-1, 1):
            c = head + np.array([-0.013 * L, 0.004 * L, sd * span * 0.95])
            lobes.append(ellipsoid(p, c, (0.017 * L, 0.0085 * L, 0.011 * L)))
            e = head + np.array([-0.012 * L, 0.004 * L, sd * (span * 0.95 + 0.0105 * L)])
            # A shallow socket on the lobe's outer face; the eye is painted in it.
            lobes[-1] = smax(lobes[-1], -ellipsoid(p, e + np.array([0, 0, sd * 0.004 * L]),
                                                   (0.006 * L, 0.0055 * L, 0.004 * L)), 0.002 * L)
            self.eyes.append(e)
        # The nape: the body widens and flattens into the cephalofoil's root.
        nape = ellipsoid(p, head + np.array([-0.05 * L, 0.004 * L, 0]), (0.08 * L, 0.026 * L, 0.05 * L))
        ds['body'] = smin([ds['body'], nape, *lobes], 0.012 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        # Countershading as the species shows it: bronze-grey over the back and upper two thirds
        # of the flank, a soft transition low on the flank, white only beneath (Pass 078 turned
        # white at mid-flank, so the shark read white under the tank's top light).
        top = np.array([0.36, 0.42, 0.46])
        belly = np.array([0.88, 0.88, 0.86])
        k = smooth(-0.4, -0.75, yn + 0.25 * (label != 'body'))
        under = (label == 'fins') & (n[:, 1] < -0.3)
        k = np.where(under, np.maximum(k, 0.55), k)
        col = top * (1 - k[:, None]) + belly * k[:, None]
        col *= (1 + 0.04 * noise3(p, 6, 31) + 0.02 * noise3(p, 30, 32))[:, None]
        # (No dusky "tips" by height: low fin roots read as dark patches on the flank.)
        return self.eye_paint(p, col, 0.0055 * self.length)

    def eye_paint(self, p, col, r, iris=(0.03, 0.03, 0.035), ring=None):
        for e in self.eyes:
            d = np.linalg.norm((p - e) * np.array([1, 1, 0.5]), axis=1)
            col = np.where((d < r * 1.45)[:, None], np.array(ring or (0.62, 0.6, 0.48)), col)
            col = np.where((d < r)[:, None], np.array(iris), col)
        return col


# ------------------------------------------------------------------ sharks by species


def falcate(base, height, sweep, rear=0.35, n=10):
    """A falcate fin outline in its own (along, out) plane: a convex leading edge sweeping back to
    the apex, a concave trailing edge, a short free rear tip."""
    apex = (-sweep * height, height)
    lead = bez2((base * 0.5, 0.0), (base * 0.45 - sweep * height * 0.2, height * 0.7), apex, n=n)
    trail = bez2(apex, (-sweep * height * 0.55, height * 0.35), (-base * 0.5 - rear * base * 0.4, -0.004), n=n)
    return outline(lead, trail, np.array([(-base * 0.5 - rear * base * 0.4, -0.004), (-base * 0.45, -0.02 * height),
                                          (base * 0.5, -0.02 * height)]))


class Shark(sc.Creature):
    """A shark sculpted from its species' own plan (Pass 084), not a tinted generic body."""
    blend = 0.05
    # Shark skin is matte (placoid scales); a glossier value turned the back white under the top light.
    rough = 0.64
    resolution = 290
    pad = ((0.16, 0.32, 0.3), (0.1, 0.3, 0.3))
    frac, x0, belly = 0.8, 0.6, 0.18
    H = W = ()
    snout = 'rounded'          # rounded | conical | flat | slender
    d1 = dict(s=0.6, base=0.12, height=0.12, sweep=0.45)
    d2 = dict(s=0.2, base=0.04, height=0.035, sweep=0.4)
    anal = dict(s=0.2, base=0.04, height=0.032)
    pect = dict(s=0.74, len=0.2, chord=0.09, sweep=0.5, droop=0.32)
    pelvic = dict(s=0.34, len=0.05)
    tail = dict(upper=0.2, lower=0.1, angle=0.55, lunate=False)
    eye_r = 0.006
    gills = 5

    def build_body(self):
        L = self.length
        self.body = torpedo(L, self.frac, self.H, self.W, x0=self.x0, belly=self.belly)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        d = b.sdf(p)
        tip, up, t, Ht, Wt = b.at(1.0)
        c9, _, _, H9, W9 = b.at(0.93)
        # Snout forms.
        # Snout forms: each tapers from the head to its own tip (Pass 084: they ended in blunt bulbs).
        if self.snout == 'conical':
            d = smin([d, ellipsoid(p, tip + np.array([-0.04 * L, 0.0, 0]), (0.075 * L, H9 * 0.55, W9 * 0.6))], 0.02 * L)
        elif self.snout == 'flat':
            d = smin([d, ellipsoid(p, tip + np.array([-0.04 * L, -0.006 * L, 0]), (0.06 * L, H9 * 0.45, W9 * 0.85))], 0.02 * L)
        elif self.snout == 'slender':
            d = smin([d, ellipsoid(p, tip + np.array([-0.035 * L, 0, 0]), (0.06 * L, H9 * 0.5, W9 * 0.6))], 0.015 * L)
        else:
            d = smin([d, ellipsoid(p, tip + np.array([-0.04 * L, -0.002 * L, 0]), (0.062 * L, H9 * 0.55, W9 * 0.7))], 0.018 * L)
        nose = tip + np.array([0.02 * L, 0, 0])
        # Underslung mouth, nostrils under the snout, gill slits, eyes set into shallow sockets.
        d = smax(d, -ellipsoid(p, tip + np.array([-0.07 * L, -H9 * 0.62, 0]), (0.022 * L, 0.003 * L, W9 * 0.7)), 0.002 * L)
        self.eyes = []
        for sd in (-1, 1):
            e = tip + np.array([-0.075 * L, H9 * 0.25, sd * W9 * 0.82])
            d = smax(d, -ellipsoid(p, e + np.array([0, 0, sd * 0.004 * L]), (self.eye_r * L * 1.5, self.eye_r * L * 1.2,
                                                                              self.eye_r * L)), 0.002 * L)
            self.eyes.append(e)
            d = smax(d, -ellipsoid(p, tip + np.array([-0.02 * L, -H9 * 0.4, sd * W9 * 0.45]),
                                   (0.006 * L, 0.002 * L, 0.004 * L)), 0.0015 * L)
            for k in range(self.gills):
                c, *_ = b.at(0.86 - k * 0.016)
                g = c + np.array([0, -0.004 * L, sd * b.W(0.86 - k * 0.016) * 0.96])
                d = smax(d, -ellipsoid(p, g, (0.0016 * L, (0.018 + 0.002 * (2 - abs(k - 2))) * L, 0.005 * L)), 0.0015 * L)
            if self.snout == 'flat':
                # Nurse shark barbels at the nostrils.
                a0 = tip + np.array([-0.025 * L, -H9 * 0.45, sd * W9 * 0.4])
                d = smin([d, chain(p, [a0, a0 + np.array([0.005 * L, -0.03 * L, 0])], [0.004 * L, 0.0018 * L])], 0.003 * L)
        self.nose = nose
        ds = {'body': d}
        # Fins: dorsals, anal, pectorals, pelvics; roots filleted by the blend.
        def dorsal(spec, sign):
            c, *_ = b.at(spec['s'])
            out = falcate(spec['base'] * L, spec['height'] * L, spec.get('sweep', 0.4))
            return fin(p, c + Y * sign * b.H(spec['s']) * 0.78, X, Y * sign, out,
                       max(0.006, spec['base'] * 0.12) * L)
        f = dorsal(self.d1, 1)
        f = np.minimum(f, dorsal(self.d2, 1))
        f = np.minimum(f, dorsal(dict(self.anal, sweep=0.35), -1))
        pc = self.pect
        cp, *_ = b.at(pc['s'])
        for sd in (-1, 1):
            u, out = flipper_frame((-pc['sweep'], -pc['droop'], sd * 0.84), (-1, 0, 0))
            plan = outline(bez2((pc['chord'] * L * 0.55, 0), (pc['chord'] * L * 0.55, pc['len'] * L * 0.5),
                                (-pc['chord'] * L * 0.35, pc['len'] * L)),
                           bez2((-pc['chord'] * L * 0.35, pc['len'] * L), (-pc['chord'] * L * 0.25, pc['len'] * L * 0.4),
                                (-pc['chord'] * L * 0.5, 0.0)))
            f = np.minimum(f, fin(p, cp - Y * b.H(pc['s']) * 0.5 + Z * sd * b.W(pc['s']) * 0.72, -u, out, plan,
                                  pc['chord'] * L * 0.14))
            cv, *_ = b.at(self.pelvic['s'])
            pl = self.pelvic['len'] * L
            f = np.minimum(f, fin(p, cv + np.array([0, -b.H(self.pelvic['s']) * 0.7, sd * b.W(self.pelvic['s']) * 0.4]),
                                  X, np.array([0, -0.5, sd * 0.86]),
                                  np.array([(pl * 0.4, 0), (0.0, pl), (-pl * 0.6, pl * 0.8), (-pl * 0.6, 0)]), 0.006 * L))
        ds['fins'] = f
        # Caudal fin.
        tl = self.tail
        root = b.c[0] + np.array([0.012 * L, 0, 0])
        U, Lw, a = tl['upper'] * L, tl['lower'] * L, tl['angle']
        ux, uy = -U * math.cos(a), U * math.sin(a)
        lx, ly = -Lw * math.cos(a * 0.9), -Lw * math.sin(a * 0.9)
        notch = (-0.035 * L, -0.005 * L) if tl['lunate'] else (ux * 0.62, uy * 0.55)
        upper = outline(bez2((0.035 * L, 0.0), (ux * 0.3, uy * 0.45), (ux, uy)),
                        bez2((ux, uy), (ux * 0.6, uy * 0.45), notch),
                        bez2(notch, (lx * 0.6, ly * 0.4), (lx, ly)),
                        bez2((lx, ly), (lx * 0.3, ly * 0.4), (0.035 * L, -0.012 * L)))
        ds['tail'] = fin(p, root, X, Y, upper, 0.011 * L, 0.004 * L)
        if tl['lunate']:
            # Caudal keels: a ridge along each side of the tail stock.
            for sd in (-1, 1):
                pts = sc.sample_along(b, 0.0, 0.14, lambda s, sd=sd: (0.0, sd * 1.05), 8)
                ds['body'] = smin([ds['body'], chain(p, list(pts), [0.006 * L] * len(pts))], 0.008 * L)
        return ds

    def shade(self, p, n, yn, label, top, belly, low=-0.35, high=-0.72):
        k = smooth(low, high, yn + 0.2 * (label != 'body'))
        k = np.where((label == 'fins') & (n[:, 1] < -0.3), np.maximum(k, 0.5), k)
        col = top * (1 - k[:, None]) + belly * k[:, None]
        return col * (1 + 0.04 * noise3(p, 6, 51) + 0.02 * noise3(p, 28, 52))[:, None]

    def stroke(self, p, label, sign):
        return self.lateral(p, sign, 0.1, 0.35)


class ReefShark(Shark):
    """Grey reef shark: stocky, a broadly rounded snout, a moderate upright first dorsal, broad
    falcate pectorals; grey above, white below, a broad black rear margin on the caudal fin."""
    root = 'Shark'
    length = 2.9
    H = [(0, 0.02), (.1, 0.032), (.3, 0.062), (.55, 0.082), (.72, 0.08), (.86, 0.064), (.95, 0.0368), (1, 0.0186)]
    W = [(0, 0.016), (.1, 0.026), (.3, 0.054), (.55, 0.072), (.72, 0.07), (.86, 0.058), (.95, 0.0336), (1, 0.0186)]
    d1 = dict(s=0.6, base=0.12, height=0.105, sweep=0.35)
    pect = dict(s=0.74, len=0.19, chord=0.085, sweep=0.45, droop=0.3)
    tail = dict(upper=0.21, lower=0.1, angle=0.6, lunate=False)

    def colour(self, p, n, s, theta, yn, label):
        col = self.shade(p, n, yn, label, np.array([0.42, 0.45, 0.48]), np.array([0.88, 0.88, 0.86]))
        # The black trailing margin of the caudal fin, a dusky tip to the pectorals' undersides.
        tail = (label == 'tail') & (p[:, 0] < p[:, 0].min() + 0.08 * self.length)
        col = np.where(tail[:, None], col * 0.25, col)
        pt = (label == 'fins') & (n[:, 1] < -0.3) & (p[:, 1] < p[:, 1].min() + 0.05 * self.length)
        col = np.where(pt[:, None], col * 0.4, col)
        return self.eye_paint(p, col, 0.005 * self.length)


class WhitetipShark(Shark):
    """Whitetip reef shark: slender, a short, broad, blunt snout, the first dorsal set well back,
    a large second dorsal; grey with brilliant white tips to the first dorsal and upper caudal lobe."""
    root = 'Whitetip'
    length = 2.9
    H = [(0, 0.016), (.1, 0.026), (.3, 0.05), (.55, 0.066), (.72, 0.064), (.86, 0.052), (.95, 0.032), (1, 0.0174)]
    W = [(0, 0.014), (.1, 0.022), (.3, 0.046), (.55, 0.06), (.72, 0.06), (.86, 0.056), (.95, 0.0368), (1, 0.0223)]
    snout = 'flat'
    d1 = dict(s=0.52, base=0.1, height=0.085, sweep=0.4)
    d2 = dict(s=0.22, base=0.055, height=0.05, sweep=0.35)
    anal = dict(s=0.22, base=0.05, height=0.045)
    pect = dict(s=0.76, len=0.16, chord=0.075, sweep=0.5, droop=0.3)
    tail = dict(upper=0.23, lower=0.08, angle=0.42, lunate=False)

    def parts(self, p):
        ds = super().parts(p)
        # No barbels: the whitetip's snout is only broad and blunt.
        return ds

    def colour(self, p, n, s, theta, yn, label):
        col = self.shade(p, n, yn, label, np.array([0.46, 0.47, 0.47]), np.array([0.86, 0.86, 0.84]))
        L = self.length
        c1, *_ = self.body.at(self.d1['s'])
        top = p[:, 1] > c1[1] + self.body.H(self.d1['s']) * 0.78 + self.d1['height'] * L * 0.72
        col = np.where(((label == 'fins') & top)[:, None], np.array([0.94, 0.94, 0.92]), col)
        ut = (label == 'tail') & (p[:, 1] > p[:, 1].max() - 0.035 * L)
        col = np.where(ut[:, None], np.array([0.94, 0.94, 0.92]), col)
        col = col * (1 - 0.25 * spots(p, 0.05 * L, 61, 0.25) * smooth(0.0, 0.5, yn))[:, None]
        return self.eye_paint(p, col, 0.005 * L)


class GreatWhite(Shark):
    """Great white: heavy and spindle-shaped, a conical snout, a big triangular first dorsal, long
    pectorals with black tips beneath, a near-symmetrical crescent tail with keels on the tail stock;
    slate grey above, white below along an irregular line."""
    root = 'GreatWhite'
    length = 2.9
    H = [(0, 0.02), (.08, 0.03), (.2, 0.058), (.45, 0.1), (.62, 0.105), (.78, 0.092), (.9, 0.066), (.97, 0.032), (1, 0.0136)]
    W = [(0, 0.018), (.08, 0.026), (.2, 0.05), (.45, 0.09), (.62, 0.096), (.78, 0.086), (.9, 0.062), (.97, 0.0288), (1, 0.0124)]
    snout = 'conical'
    d1 = dict(s=0.6, base=0.14, height=0.13, sweep=0.22)
    d2 = dict(s=0.17, base=0.025, height=0.02, sweep=0.3)
    anal = dict(s=0.17, base=0.025, height=0.02)
    pect = dict(s=0.73, len=0.22, chord=0.09, sweep=0.38, droop=0.35)
    tail = dict(upper=0.2, lower=0.17, angle=0.75, lunate=True)
    eye_r = 0.005

    def colour(self, p, n, s, theta, yn, label):
        line = -0.18 + 0.12 * noise3(p, 9, 71) + 0.06 * noise3(p, 25, 72)
        col = self.shade(p, n, yn - line - 0.1, label, np.array([0.3, 0.33, 0.36]), np.array([0.9, 0.9, 0.88]),
                         low=-0.02, high=-0.1)
        pt = (label == 'fins') & (n[:, 1] < -0.2) & (p[:, 1] < p[:, 1].min() + 0.06 * self.length)
        col = np.where(pt[:, None], np.array([0.06, 0.06, 0.07]), col)
        return self.eye_paint(p, col, 0.0045 * self.length)


class LeopardShark(Shark):
    """Leopard shark: small and slender, a short rounded snout, two near-equal dorsals, a long
    upper caudal lobe; bronze-grey with dark saddles across the back and dark spots on the flanks."""
    root = 'LeopardShark'
    length = 1.58
    H = [(0, 0.014), (.1, 0.022), (.3, 0.044), (.55, 0.056), (.72, 0.055), (.86, 0.046), (.95, 0.0272), (1, 0.0136)]
    W = [(0, 0.012), (.1, 0.02), (.3, 0.04), (.55, 0.052), (.72, 0.052), (.86, 0.046), (.95, 0.0288), (1, 0.0149)]
    snout = 'slender'
    d1 = dict(s=0.56, base=0.085, height=0.075, sweep=0.4)
    d2 = dict(s=0.3, base=0.07, height=0.06, sweep=0.4)
    anal = dict(s=0.24, base=0.05, height=0.04)
    pect = dict(s=0.76, len=0.14, chord=0.07, sweep=0.45, droop=0.28)
    tail = dict(upper=0.22, lower=0.07, angle=0.32, lunate=False)
    eye_r = 0.008

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        col = self.shade(p, n, yn, label, np.array([0.54, 0.52, 0.47]), np.array([0.86, 0.84, 0.8]))
        x = p[:, 0] / L
        saddle = smooth(0.82, 0.92, np.cos(x * TAU * 6.5 + 0.6)) * smooth(-0.1, 0.4, yn)
        flank = spots(p, 0.045 * L, 81, 0.3) * smooth(0.4, -0.2, yn) * smooth(-0.6, -0.2, yn)
        mark = np.maximum(saddle * 0.85, flank * 0.7)
        col = col * (1 - mark[:, None]) + np.array([0.18, 0.16, 0.15]) * mark[:, None]
        return self.eye_paint(p, col, 0.007 * L, ring=(0.6, 0.58, 0.5))


class NurseShark(Shark):
    """Nurse shark: a broad, flattened head with barbels at the nostrils, small eyes, two big
    rounded dorsals set far back, broad rounded pectorals, a long low upper caudal lobe with almost
    no lower lobe; uniform yellow-brown, a little paler beneath."""
    root = 'NurseShark'
    length = 2.55
    H = [(0, 0.016), (.1, 0.024), (.3, 0.05), (.5, 0.066), (.7, 0.064), (.86, 0.052), (.95, 0.0288), (1, 0.0149)]
    W = [(0, 0.016), (.1, 0.026), (.3, 0.056), (.5, 0.08), (.7, 0.082), (.86, 0.074), (.95, 0.0496), (1, 0.0298)]
    belly = 0.32
    snout = 'flat'
    d1 = dict(s=0.42, base=0.11, height=0.065, sweep=0.15)
    d2 = dict(s=0.29, base=0.09, height=0.055, sweep=0.15)
    anal = dict(s=0.26, base=0.08, height=0.04)
    pect = dict(s=0.74, len=0.14, chord=0.1, sweep=0.3, droop=0.25)
    pelvic = dict(s=0.42, len=0.06)
    tail = dict(upper=0.27, lower=0.03, angle=0.18, lunate=False)
    eye_r = 0.004

    def colour(self, p, n, s, theta, yn, label):
        col = self.shade(p, n, yn, label, np.array([0.68, 0.57, 0.4]), np.array([0.78, 0.7, 0.56]),
                         low=-0.4, high=-0.8)
        col *= (1 + 0.06 * noise3(p, 4, 91))[:, None]
        return self.eye_paint(p, col, 0.004 * self.length)


# ------------------------------------------------------------------ polar bear


class PolarBear(m.PolarBear):
    """Swimming polar bear with believable anatomy (Pass 078's legs were straight tubes ending in
    balls): a deep chest and a thick neck, shoulder blades and haunches that carry each limb out of
    the body, upper and lower limb segments flattened like muscle rather than cylinders, and broad,
    flat paws (the bear's paddles) with small toes; a flatter skull and a narrower, tapering muzzle."""
    blend = 0.06

    def build_body(self):
        L = self.length
        spine = m.bezier((-0.5 * L, 0.0, 0), (-0.1 * L, 0.06 * L, 0), (0.22 * L, 0.065 * L, 0),
                         (0.5 * L, 0.1 * L, 0), n=12)
        self.body = Body(spine,
                         [(0, .07 * L), (.06, .13 * L), (.2, .165 * L), (.4, .18 * L), (.56, .185 * L), (.66, .15 * L),
                          (.74, .11 * L), (.82, .092 * L), (.88, .082 * L), (.94, .06 * L), (1, .02 * L)],
                         [(0, .07 * L), (.06, .13 * L), (.2, .155 * L), (.4, .165 * L), (.56, .16 * L), (.66, .13 * L),
                          (.74, .095 * L), (.82, .08 * L), (.88, .072 * L), (.94, .055 * L), (1, .02 * L)], belly=0.12)

    def parts(self, p):
        L, b = self.length, self.body
        ds = {'body': b.sdf(p)}
        c, up, t, H, W = b.at(0.6)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.45, (H * 0.9, H * 0.55, W * 0.8))], self.blend)
        c, up, t, H, W = b.at(0.18)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.2, (H * 0.95, H * 0.8, W * 0.95))], self.blend)
        # Head: a long, flat skull, cheeks, a tapering muzzle and a nose pad.
        c, up, t, H, W = b.at(0.9)
        skull = ellipsoid(p, c + up * 0.03 * L + t * 0.01 * L, (0.11 * L, 0.07 * L, 0.075 * L))
        cheeks = ellipsoid(p, c + t * 0.03 * L - up * 0.01 * L, (0.07 * L, 0.055 * L, 0.08 * L))
        muzzle = round_cone(p, c + t * 0.06 * L + up * 0.005 * L, c + t * 0.19 * L - up * 0.004 * L, 0.05 * L, 0.03 * L)
        ds['body'] = smin([ds['body'], skull, cheeks, muzzle], 0.03 * L)
        nose = c + t * 0.205 * L + up * 0.004 * L
        ds['body'] = smin([ds['body'], ellipsoid(p, nose, (0.018 * L, 0.02 * L, 0.026 * L))], 0.012 * L)
        self.nose = nose
        self.eyes = []
        for sd in (-1, 1):
            e = c + t * 0.075 * L + up * 0.045 * L + np.array([0, 0, sd * 0.055 * L])
            self.eyes.append(e)
            ds['body'] = smax(ds['body'], -ellipsoid(p, e, (0.014 * L, 0.01 * L, 0.009 * L)), 0.008 * L)
            ds['body'] = smin([ds['body'], ellipsoid(p, e - np.array([0, 0, sd * 0.003 * L]), (0.0085 * L,) * 3)],
                              0.003 * L)
            ear = c - t * 0.04 * L + up * 0.085 * L + np.array([0, 0, sd * 0.055 * L])
            ds['body'] = smin([ds['body'], ellipsoid(p, ear, (0.016 * L, 0.018 * L, 0.01 * L))], 0.01 * L)
            ds['body'] = smax(ds['body'], -ellipsoid(p, ear + np.array([0.005 * L, 0.003 * L, sd * 0.005 * L]),
                                                     (0.009 * L, 0.01 * L, 0.005 * L)), 0.003 * L)
            ds['body'] = smax(ds['body'], -ellipsoid(p, nose + t * 0.012 * L + up * 0.006 * L + np.array([0, 0, sd * 0.01 * L]),
                                                     (0.006 * L, 0.005 * L, 0.005 * L)), 0.002 * L)
        self.mouth = nose - t * 0.06 * L - up * 0.022 * L
        ds['body'] = smax(ds['body'], -ellipsoid(p, self.mouth, (0.06 * L, 0.003 * L, 0.04 * L)), 0.003 * L)
        # Limbs: shoulder blade / haunch masses carry each limb out of the body; segments are
        # flattened across the body (muscle, not tubes); paws are broad and flat.
        flat = ((0, 0, 1), 0.72)
        ds['fore'] = np.full(len(p), np.inf)
        ds['hind'] = np.full(len(p), np.inf)
        self.pivots = {}
        for sd in (-1, 1):
            c, up, t, H, W = b.at(0.6)
            sh = c - up * H * 0.2 + np.array([0, 0, sd * W * 0.68])
            scap = ellipsoid(p, sh + up * H * 0.35 + np.array([-0.01 * L, 0, -sd * 0.01 * L]), (0.1 * L, 0.13 * L, 0.06 * L))
            el = sh + np.array([0.08 * L, -0.15 * L, sd * 0.02 * L])
            wr = el + np.array([0.1 * L, -0.09 * L, sd * 0.01 * L])
            arm = chain(p, [sh, el], [0.066 * L, 0.042 * L], flat=flat)
            # Biceps and forearm muscle: the limb swells and narrows instead of tapering evenly.
            bulge = ellipsoid(p, sh + (el - sh) * 0.4 + np.array([0.012 * L, 0, 0]), (0.045 * L, 0.065 * L, 0.042 * L))
            fore = chain(p, [el, wr], [0.04 * L, 0.026 * L], flat=flat)
            fbulge = ellipsoid(p, el + (wr - el) * 0.28, (0.042 * L, 0.034 * L, 0.034 * L))
            arm = smin([arm, bulge, fbulge], 0.02 * L)
            paw_c = wr + np.array([0.055 * L, -0.025 * L, 0])
            paw = ellipsoid(p, paw_c, (0.078 * L, 0.018 * L, 0.064 * L))
            toes = [ellipsoid(p, paw_c + np.array([0.06 * L, -0.004 * L, k * 0.022 * L]), (0.016 * L, 0.012 * L, 0.012 * L))
                    for k in (-2, -1, 0, 1, 2)]
            ds['fore'] = np.minimum(ds['fore'], smin([scap, arm, fore, paw, *toes], 0.03 * L))
            self.pivots[('fore', sd)] = sh
            c, up, t, H, W = b.at(0.2)
            hp = c - up * H * 0.15 + np.array([0, 0, sd * W * 0.66])
            haunch = ellipsoid(p, hp + np.array([0.0, 0.03 * L, -sd * 0.01 * L]), (0.13 * L, 0.12 * L, 0.07 * L))
            kn = hp + np.array([-0.1 * L, -0.1 * L, sd * 0.02 * L])
            hk = kn + np.array([-0.12 * L, -0.03 * L, sd * 0.01 * L])
            thigh = chain(p, [hp, kn], [0.08 * L, 0.046 * L], flat=flat)
            shin = chain(p, [kn, hk], [0.042 * L, 0.026 * L], flat=flat)
            calf = ellipsoid(p, kn + (hk - kn) * 0.28, (0.05 * L, 0.038 * L, 0.036 * L))
            shin = smin([shin, calf], 0.02 * L)
            foot_c = hk + np.array([-0.075 * L, -0.005 * L, 0])
            foot = ellipsoid(p, foot_c, (0.085 * L, 0.02 * L, 0.056 * L))
            toes = [ellipsoid(p, foot_c + np.array([-0.07 * L, 0.0, k * 0.021 * L]), (0.016 * L, 0.011 * L, 0.012 * L))
                    for k in (-2, -1, 0, 1, 2)]
            ds['hind'] = np.minimum(ds['hind'], smin([haunch, thigh, shin, foot, *toes], 0.03 * L))
            self.pivots[('hind', sd)] = hp
        c0 = b.c[0]
        ds['body'] = smin([ds['body'], ellipsoid(p, c0 - np.array([0.02 * L, -0.02 * L, 0]), (0.04 * L, 0.03 * L, 0.03 * L))],
                          0.02 * L)
        return ds


# ------------------------------------------------------------------ seals and sea lion


def flipper_fillets(sp, p, ds):
    """Carry each fore-flipper out of the body: an upper-arm mass inside the body wall at its root
    (Pass 078's paddles met the body at a crease), and a heel where the hind flippers join."""
    L, b = sp.length, sp.body
    f = sp.fore
    cf, upf, tf, Hf, Wf = b.at(f['s'])
    extra = []
    for sd in (-1, 1):
        root = cf - upf * Hf * 0.5 + np.array([0, 0, sd * Wf * 0.6])
        extra.append(ellipsoid(p, root + np.array([0.01 * L, 0.01 * L, -sd * 0.02 * L]),
                               (f['chord'] * L * 1.1, f['chord'] * L * 0.75, f['chord'] * L * 0.55)))
    ct = b.c[0]
    extra.append(ellipsoid(p, ct + np.array([0.035 * L, 0, 0]), (0.05 * L, 0.03 * L, 0.035 * L)))
    ds['body'] = smin([ds['body'], *extra], 0.03 * L)
    return ds


class WeddellSeal(m.WeddellSeal):
    blend = 0.045

    def parts(self, p):
        return flipper_fillets(self, p, super().parts(p))


class LeopardSeal(m.LeopardSeal):
    blend = 0.045

    def parts(self, p):
        return flipper_fillets(self, p, super().parts(p))


class SeaLion(sc.SeaLion):
    blend = 0.04

    def parts(self, p):
        return flipper_fillets(self, p, super().parts(p))


class HarbourSeal(m.Seal):
    """Harbour seal, sculpted (it was Pass 068's lofted tube with a dot eye): plump and short, a
    round head with a short, dog-like muzzle, V-set nostrils and large dark eyes, short fore-flippers
    and fanned hind flippers; silver-grey densely marked with dark spots and rings, paler beneath."""
    root = 'Seal'
    length = 1.66
    blend = 0.035
    height = [(0, .035), (.06, .07), (.2, .15), (.42, .2), (.62, .185), (.76, .13), (.84, .108),
              (.9, .102), (.96, .075), (1, .03)]
    width = [(0, .04), (.06, .08), (.2, .16), (.42, .21), (.62, .19), (.76, .13), (.84, .11),
             (.9, .106), (.96, .078), (1, .034)]
    fore = dict(s=.68, len=.13, chord=.06, droop=.5)
    hind = dict(len=.16, spread=.5)
    head = dict(muzzle=.55, pads=1.05, gape=.2)

    def parts(self, p):
        return flipper_fillets(self, p, super().parts(p))

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        back = np.array([0.36, 0.38, 0.38])
        pale = np.array([0.7, 0.7, 0.66])
        belly = smooth(0.15, -0.6, yn)
        col = back * (1 - belly[:, None]) + pale * belly[:, None]
        dots = spots(p, 0.05 * L, 101, 0.28)
        rings = spots(p, 0.08 * L, 102, 0.32) * (1 - spots(p, 0.08 * L, 102, 0.2))
        mark = np.maximum(dots * 0.75, rings * 0.6) * (1 - 0.6 * belly)
        col = col * (1 - mark[:, None]) + np.array([0.16, 0.17, 0.18]) * mark[:, None]
        col *= (1 + 0.05 * noise3(p, 9, 103))[:, None]
        col = np.where(((s > 0.97) & (yn < 0.3))[:, None], col * 0.8 + pale * 0.2, col)
        # Large dark eyes, painted where each eye meets the head's surface (seen from the side).
        for e in self.eyes:
            d = np.hypot(p[:, 0] - e[0], p[:, 1] - e[1])
            side = p[:, 2] * np.sign(e[2]) > abs(e[2]) * 0.55
            col = np.where(((d < 0.026 * L) & side)[:, None], np.array([0.03, 0.03, 0.035]), col)
            col = np.where(((d < 0.034 * L) & (d >= 0.026 * L) & side)[:, None], col * 0.6, col)
        return col


# ------------------------------------------------------------------ sea turtle


class SeaTurtle(sc.Creature):
    """Green turtle, sculpted (it was a lofted barrel with plank stripes): a low, heart-shaped
    carapace of grooved scutes (five vertebral, four costal each side) over a flat plastron, a
    blunt head with a horny beak and scaled skin, long curved fore-flippers and short rounded hind
    flippers; olive-brown scutes with radiating amber streaks, pale plastron, grey-brown scaled skin."""
    root = 'Turtle'
    length = 1.3
    rough = 0.6
    blend = 0.03
    resolution = 300
    pad = ((0.06, 0.25, 0.75), (0.06, 0.25, 0.75))

    def build_body(self):
        xs = np.linspace(-0.6, 0.75, 9)
        spine = np.stack([xs, 0.02 + 0 * xs, 0 * xs], 1)
        self.body = Body(spine, [(0, .02), (.5, .16), (1, .05)], [(0, .02), (.5, .4), (1, .06)], belly=0.3)
        self.seeds = np.array([(x, 0.0) for x in (0.3, 0.15, 0.0, -0.15, -0.3)]
                              + [(x, sd * 0.2) for x in (0.22, 0.07, -0.08, -0.23) for sd in (-1, 1)])

    def scutes(self, p):
        q = np.stack([p[:, 0], p[:, 2]], 1)
        dd = np.linalg.norm(q[:, None, :] - self.seeds[None], axis=2)
        dd.sort(1)
        return dd[:, 1] - dd[:, 0], np.argmin(np.linalg.norm(q[:, None, :] - self.seeds[None], axis=2), 1)

    def parts(self, p):
        X, Y, Z = np.eye(3)
        # Carapace: a low dome, heart-shaped in plan (broad at the shoulders, tapering behind).
        taper = 1 - 0.18 * smooth(0.0, -0.45, p[:, 0])
        q = p.copy()
        q[:, 2] = q[:, 2] / taper
        shell = ellipsoid(q, (-0.02, 0.03, 0), (0.5, 0.17, 0.4))
        shell = smax(shell, -(p[:, 1] + 0.065), 0.02)
        groove, _ = self.scutes(p)
        top = smooth(0.0, 0.06, p[:, 1])
        shell = shell + 0.006 * smooth(0.025, 0.0, groove) * top
        plastron = ellipsoid(p, (0.0, -0.05, 0), (0.42, 0.06, 0.33))
        d = smin([shell, plastron], 0.03)
        # Head and neck: a blunt head with a horny beak, eyes set into it.
        neck = round_cone(p, (0.38, 0.0, 0), (0.56, 0.03, 0), 0.075, 0.062)
        head = ellipsoid(p, (0.63, 0.04, 0), (0.1, 0.065, 0.068))
        beak = ellipsoid(p, (0.7, 0.015, 0), (0.05, 0.04, 0.045))
        body = smin([d, neck, head, beak], 0.03)
        body = smax(body, -ellipsoid(p, (0.71, 0.005, 0), (0.05, 0.003, 0.05)), 0.003)
        self.eyes = []
        for sd in (-1, 1):
            e = np.array([0.65, 0.06, sd * 0.06])
            body = smax(body, -ellipsoid(p, e, (0.016, 0.012, 0.01)), 0.006)
            body = smin([body, ellipsoid(p, e - np.array([0, 0, sd * 0.003]), (0.011, 0.011, 0.011))], 0.003)
            self.eyes.append(e)
        tail = round_cone(p, (-0.45, -0.02, 0), (-0.58, -0.03, 0), 0.04, 0.012)
        body = smin([body, tail], 0.02)
        ds = {'body': body}
        flat = ((0, 1, 0.2), 0.28)
        fore = []
        for sd in (-1, 1):
            sh = np.array([0.3, -0.02, sd * 0.26])
            fore.append(chain(p, [sh, sh + np.array([-0.1, -0.03, sd * 0.32]), sh + np.array([-0.32, -0.04, sd * 0.56])],
                              [0.075, 0.055, 0.016], flat=flat))
        ds['fore'] = np.minimum(*fore)
        hind = []
        for sd in (-1, 1):
            hp = np.array([-0.36, -0.03, sd * 0.18])
            hind.append(chain(p, [hp, hp + np.array([-0.14, -0.01, sd * 0.12])], [0.06, 0.045], flat=flat))
        ds['hind'] = np.minimum(*hind)
        self.fore_pivots = [np.array([0.3, -0.02, sd * 0.26]) for sd in (-1, 1)]
        return ds

    def colour(self, p, n, s, theta, yn, label):
        groove, which = self.scutes(p)
        shell = (label == 'body') & (p[:, 1] > -0.03) & (np.abs(p[:, 0]) < 0.52) & (np.abs(p[:, 2]) < 0.42) \
            & ~((p[:, 0] > 0.36) & (np.abs(p[:, 2]) < 0.09))
        # Scutes: olive-brown with amber streaks radiating from each scute's growth centre.
        seed = self.seeds[which]
        ang = np.arctan2(p[:, 2] - seed[:, 1], p[:, 0] - seed[:, 0])
        streak = smooth(0.4, 0.9, np.sin(ang * 9 + which * 1.7) * 0.5 + 0.5 + 0.3 * noise3(p, 30, 111))
        carapace = np.array([0.32, 0.26, 0.15]) * (1 - streak[:, None] * 0.45) + np.array([0.62, 0.45, 0.2]) * streak[:, None] * 0.45
        carapace = carapace * (1 - 0.5 * smooth(0.02, 0.0, groove))[:, None]
        plastron = np.array([0.8, 0.72, 0.5])
        # Skin: grey-brown scales with paler edges.
        cells = spots(p, 0.03, 112, 0.42)
        skin = np.array([0.3, 0.28, 0.23]) * (1 - cells[:, None] * 0.4) + np.array([0.62, 0.58, 0.46]) * cells[:, None] * 0.4
        under = shell & (p[:, 1] < -0.02)
        col = np.where(shell[:, None], carapace, skin)
        col = np.where((under | ((label == 'body') & (n[:, 1] < -0.7) & (np.abs(p[:, 0]) < 0.42)))[:, None], plastron, col)
        col *= (1 + 0.05 * noise3(p, 8, 113))[:, None]
        return self.eye_paint(p, col, 0.009)

    def stroke(self, p, label, sign):
        """The fore-flippers beat down and back together (the green turtle's underwater flight); the
        hind flippers trail and steer a little."""
        q = p.copy()
        for pv in self.fore_pivots:
            sd = np.sign(pv[2])
            reach = np.clip((np.abs(p[:, 2]) - abs(pv[2]) * 0.8) / 0.6, 0, 1) * (np.sign(p[:, 2]) == sd)
            w = smooth(0.0, 1.0, reach) * smooth(-0.2, 0.0, p[:, 0])
            a = sign * 0.45 * w
            rel = p - pv
            q[:, 1] = np.where(w > 0, pv[1] + rel[:, 1] * np.cos(a) - np.abs(rel[:, 2]) * np.sin(a), q[:, 1])
            q[:, 0] = np.where(w > 0, q[:, 0] - sign * 0.08 * w, q[:, 0])
        rear = smooth(-0.32, -0.5, p[:, 0])
        q[:, 1] += sign * 0.02 * rear
        return q


# ------------------------------------------------------------------ rays


def ray_stroke(self, p, label, sign):
    """A travelling wave along each wing (Pass 078 raised the whole wing rigidly): the beat grows
    toward the tip, the trailing edge lags, the tip curls, and the body and tail stay steady."""
    half = np.abs(p[:, 2]).max()
    r = np.clip(np.abs(p[:, 2]) / half, 0, 1)
    x0, x1 = p[:, 0].min(), p[:, 0].max()
    chord = np.clip((p[:, 0] - (x0 + x1) * 0.5) / ((x1 - x0) * 0.5), -1, 1)
    q = p.copy()
    lift = self.flap * half * r ** 1.8 * (1 + 0.18 * chord)
    curl = 0.05 * half * smooth(0.75, 1.0, r)
    q[:, 1] += sign * (lift + curl)
    # Pulling the wing in a touch as it rises keeps its area, so it does not stretch.
    q[:, 2] -= np.sign(p[:, 2]) * 0.04 * half * r ** 3 * abs(sign)
    q[:, 0] -= sign * 0.03 * half * r ** 2
    return q


class EagleRay(sc.EagleRay):
    stroke = ray_stroke


class Manta(sc.Manta):
    stroke = ray_stroke


# ------------------------------------------------------------------ build

# name -> (class, skin kind)
SPECIES = {
    'hammerhead': (Hammerhead, 'denticle'),
    'reef-shark': (ReefShark, 'denticle'),
    'whitetip-shark': (WhitetipShark, 'denticle'),
    'great-white-shark': (GreatWhite, 'denticle'),
    'leopard-shark': (LeopardShark, 'denticle'),
    'nurse-shark': (NurseShark, 'denticle'),
    'polar-bear': (PolarBear, 'fur'),
    'harbour-seal': (HarbourSeal, 'smooth'),
    'weddell-seal': (WeddellSeal, 'smooth'),
    'leopard-seal': (LeopardSeal, 'smooth'),
    'sea-lion': (SeaLion, 'smooth'),
    'sea-turtle': (SeaTurtle, 'scute'),
    'eagle-ray': (EagleRay, 'denticle'),
    'manta-ray': (Manta, 'denticle'),
    # Skin only (their anatomy passed the audit): the whales and the whale shark and sunfish.
    'whale-shark': (sc.WhaleShark, 'denticle'),
    'killer-whale': (sc.Orca, 'smooth'),
    'humpback-whale': (sc.Humpback, 'smooth'),
    'ocean-sunfish': (sc.Sunfish, 'smooth'),
}


def build(name):
    cls, kind = SPECIES[name]
    SKIN['kind'] = kind
    SMOOTH['on'] = name not in ('eagle-ray', 'manta-ray')
    # Sources (.blend) and intermediate exports live with this pass.
    m.HERE = HERE
    (HERE / 'out').mkdir(exist_ok=True)
    m.build_species(name, cls())


if __name__ == '__main__':
    for name in (sys.argv[1:] or SPECIES):
        build(name)
