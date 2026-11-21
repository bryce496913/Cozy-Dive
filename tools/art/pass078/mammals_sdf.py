"""V0.7 Pass 078: the Weddell seal, leopard seal and polar bear, sculpted (playtest: "fix the models
for the black seals and the polar bear").

    python3 tools/art/pass078/mammals_sdf.py [weddell-seal leopard-seal polar-bear]   # Blender 5.1
    node tools/art/pass017/compress.mjs public/assets/models

The Pass 068 builder made every mammal one lofted tube, so the seals were sausages with blob heads
(the Weddell seal was the harbour seal tinted almost black) and the bear a blob on straight tubes.
These are sculpted instead, as signed distance fields fused with smooth unions:

  * **Body.** A sweep along a curved spine with species girth and depth profiles and a flattened
    belly, so the animal has a chest, a waist and hips.
  * **Head.** Its own forms on the end of the neck: a cranium, a brow stop, a muzzle with whisker
    pads (seals) or a long Roman-nosed muzzle (bear), nostrils and a mouth line cut in, eyes set in
    sockets, ears for the bear.
  * **Limbs.** Seal fore-flippers as flattened, tapering paddles with a wrist bend; hind flippers
    as paired webbed fans. The bear's legs as jointed shoulder-elbow-wrist chains ending in broad
    paws, fused into the body.

The field is polygonised (marching cubes), reduced in Blender (Decimate), and coloured per vertex
(markings follow anatomy: a seal's spots, pale throat and belly; the bear's cream coat, black nose
and lips, dark paw pads), over a fine skin or fur detail texture (base x vertex colour, normal,
ORM). The runtime contract is unchanged: `<Root>` > `Body` and `Body_LOD1`, one material, and
`Stroke_Left` / `Stroke_Right` morphs at rest weight 0 (seal: the hind body sweeps side to side;
bear: the forelegs paddle, the hind legs kick), built with smooth weights so the mesh never tears.
Game space: +X head, +Y up, +Z left; metres; centred on its length, as the shipped models are.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy  # noqa: I001
import bmesh
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/v07'))
sys.path.insert(0, str(ROOT / 'tools/art/pass017'))
sys.path.insert(0, str(ROOT / 'tools/art/pass077'))
import cozy_art as ca  # noqa: E402
from colony import decimate  # noqa: E402

TEX = ROOT / 'tools/art/textures/pass078'
OUT = ROOT / 'public/assets/models/creatures'
TAU = math.tau


def smooth(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def smin(ds, k):
    ds = np.asarray(ds)
    m = ds.min(0)
    return m - k * np.log(np.exp(-(ds - m) / k).sum(0))


def smax(a, b, k):
    return -smin([-a, -b], k)


# ------------------------------------------------------------------ primitives


def ellipsoid(p, c, r, rot=None):
    q = p - np.asarray(c, float)
    if rot is not None:
        q = q @ np.asarray(rot, float)
    r = np.asarray(r, float)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def round_cone(p, a, b, ra, rb):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ba = b - a
    h = np.clip(((p - a) @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(p - a - h[:, None] * ba, axis=1) - (ra + (rb - ra) * h)


def chain(p, pts, radii, flat=None):
    """Tapered capsules through `pts`; `flat` = (axis, factor) squashes them across `axis` (paddles)."""
    q = p
    if flat is not None:
        axis, f = np.asarray(flat[0], float), flat[1]
        axis = axis / np.linalg.norm(axis)
        q = p + np.outer(p @ axis, axis) * (1 / f - 1)
        pts = [np.asarray(x, float) + axis * ((np.asarray(x, float) @ axis) * (1 / f - 1)) for x in pts]
    ds = [round_cone(q, pts[i], pts[i + 1], radii[i], radii[i + 1]) for i in range(len(pts) - 1)]
    d = np.min(ds, axis=0)
    return d * (flat[1] if flat is not None else 1)


def bezier(*ctrl, n=24):
    u = np.linspace(0, 1, n)[:, None]
    P = [np.broadcast_to(np.asarray(c, float), (n, 3)) for c in ctrl]
    while len(P) > 1:
        P = [P[i] * (1 - u) + P[i + 1] * u for i in range(len(P) - 1)]
    return P[0]


class Body:
    """A sweep along a spine in the x-y plane: s = 0 at the tail, 1 at the snout tip."""

    def __init__(self, spine, height, width, belly=0.25, samples=600):
        sp = np.asarray(spine, float)
        d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(sp, axis=0), axis=1))])
        t = np.linspace(0, d[-1], samples)
        self.c = np.stack([np.interp(t, d, sp[:, k]) for k in range(3)], 1)
        self.s = t / d[-1]
        tan = np.gradient(self.c, axis=0)
        self.t = tan / np.linalg.norm(tan, axis=1, keepdims=True)
        self.up = np.stack([-self.t[:, 1], self.t[:, 0], np.zeros(len(t))], 1)
        self.H = lambda s: np.interp(s, *zip(*height))
        self.W = lambda s: np.interp(s, *zip(*width))
        self.belly = belly
        self.tree = cKDTree(self.c)

    def local(self, p):
        _, i = self.tree.query(p)
        q = p - self.c[i]
        return i, (q * self.up[i]).sum(1), q[:, 2], (q * self.t[i]).sum(1)

    def sdf(self, p):
        i, y, z, along = self.local(p)
        s = self.s[i]
        h, w = self.H(s), self.W(s)
        # Flattened underside: the lower half is less deep.
        h = np.where(y < 0, h * (1 - self.belly), h)
        k = np.hypot(y / h, z / w)
        d = (k - 1) * np.minimum(h, w)
        end = (i == len(self.c) - 1) | (i == 0)
        return np.where(end & (np.abs(along) > 0), np.maximum(d, np.abs(along) - 0.0), d)

    def param(self, p):
        """(s along the body, theta around it: 0 on the back, +-pi under the belly, yn)."""
        i, y, z, _ = self.local(p)
        theta = np.arctan2(z, y)
        return self.s[i], theta, y / np.maximum(self.H(self.s[i]), 1e-6)

    def at(self, s):
        i = int(np.clip(s, 0, 1) * (len(self.c) - 1))
        return self.c[i], self.up[i], self.t[i], self.H(s), self.W(s)


# ------------------------------------------------------------------ species


class Species:
    root = ''
    length = 1.0
    template = 'fish-skin'
    rough = 0.55
    # Within the creature budget: Body under 8000 triangles, its distance level under a fifth.
    near, far = 7600, 1400
    blend = 0.03

    def parts(self, p):  # returns {name: sdf}
        raise NotImplementedError

    def colour(self, p, n, s, theta, yn, label):
        raise NotImplementedError


def noise3(p, scale, seed):
    """Smooth value noise from a few seeded plane waves (cheap, deterministic)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(len(p))
    for _ in range(9):
        k = rng.standard_normal(3)
        k = k / np.linalg.norm(k) * scale * (0.6 + rng.random())
        out += np.sin(p @ k + rng.random() * TAU)
    return out / 3


def spots(p, cell, seed, size=0.45):
    """Irregular blotches (Worley F1 under a threshold) at roughly `cell` spacing."""
    rng = np.random.default_rng(seed)
    q = p / cell
    base = np.floor(q)
    best = np.full(len(p), 9.0)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                g = base + (dx, dy, dz)
                h = np.sin(g @ np.array([127.1, 311.7, 74.7]) + rng.random()) * 43758.5453
                j = np.stack([h % 1, (h * 1.37) % 1, (h * 2.11) % 1], 1)
                best = np.minimum(best, np.linalg.norm(g + j - q, axis=1))
    return smooth(size, size * 0.6, best)


class Seal(Species):
    """Common seal anatomy; species set the proportions and the coat."""
    template = 'fish-skin'
    rough = 0.55
    blend = 0.025
    # proportions (fractions of length) overridden per species
    spine_y = ((0, 0.0), (0.4, 0.02), (0.75, 0.035), (0.88, 0.05), (1, 0.04))
    height = [(0, .035), (.06, .07), (.2, .14), (.42, .19), (.62, .175), (.76, .125), (.83, .1),
              (.9, .095), (.96, .07), (1, .03)]
    width = [(0, .04), (.06, .08), (.2, .15), (.42, .2), (.62, .18), (.76, .125), (.83, .105),
             (.9, .1), (.96, .075), (1, .035)]
    fore = dict(s=.68, len=.17, chord=.07, droop=.55)
    hind = dict(len=.17, spread=.45)
    head = dict(muzzle=.7, pads=1.0, gape=.25)

    def build_body(self):
        L = self.length
        xs = np.linspace(0, 1, 9)
        y = np.interp(xs, *zip(*self.spine_y))
        spine = np.stack([(xs - 0.5) * L, y * L, np.zeros_like(xs)], 1)
        self.body = Body(spine, [(s, h * L) for s, h in self.height], [(s, w * L) for s, w in self.width],
                         belly=0.22)

    def parts(self, p):
        L, b = self.length, self.body
        ds = {'body': b.sdf(p)}
        # Head: cranium, muzzle with whisker pads, set on the end of the neck.
        c, up, t, H, W = b.at(0.93)
        m = self.head
        ds['body'] = smin([ds['body'],
                           ellipsoid(p, c + up * H * 0.15, (H * 1.05, H * 1.0, W * 1.05)),
                           ellipsoid(p, c + t * 0.06 * L - up * H * 0.12, (0.07 * L * m['muzzle'], H * 0.62, W * 0.62))],
                          self.blend)
        nose = c + t * 0.1 * L * m['muzzle'] - up * H * 0.1
        pads = [ellipsoid(p, nose - t * 0.012 * L + (0, 0, sd * W * 0.32) - up * H * 0.12,
                          (0.03 * L, H * 0.32 * m['pads'], W * 0.3 * m['pads'])) for sd in (-1, 1)]
        ds['body'] = smin([ds['body'], *pads], self.blend * 0.6)
        # Brow over each eye, then the eye sockets and nostrils and the mouth line cut in.
        self.eyes = []
        for sd in (-1, 1):
            e = c + t * 0.015 * L + up * H * 0.4 + np.array([0, 0, sd * W * 0.78])
            self.eyes.append(e)
            ds['body'] = smax(ds['body'], -ellipsoid(p, e, (H * .2, H * .17, W * .14)), 0.01 * L)
            ds['body'] = smin([ds['body'], ellipsoid(p, e - np.array([0, 0, sd * W * 0.06]), (H * .17, H * .15, W * .13))],
                              0.004 * L)
            n_ = nose + t * 0.01 * L + up * H * 0.15 + np.array([0, 0, sd * W * 0.13])
            ds['body'] = smax(ds['body'], -ellipsoid(p, n_, (0.008 * L, 0.012 * L, 0.006 * L)), 0.004 * L)
        mouth_c = nose - t * 0.05 * L * m['gape'] - up * H * 0.42
        ds['body'] = smax(ds['body'], -ellipsoid(p, mouth_c, (0.06 * L * (0.6 + m['gape']), 0.004 * L, W * 0.7)),
                          0.003 * L)
        # Fore-flippers: flattened paddles angled down and back from the chest, a slight wrist bend.
        f = self.fore
        cf, upf, tf, Hf, Wf = b.at(f['s'])
        ds['fore'] = np.inf * np.ones(len(p))
        for sd in (-1, 1):
            root = cf - upf * Hf * 0.55 + np.array([0, 0, sd * Wf * 0.65])
            out = np.array([-0.55, -0.45 * f['droop'], sd * 0.7])
            out /= np.linalg.norm(out)
            wrist = root + out * f['len'] * L * 0.55
            tip = wrist + (out + np.array([-0.5, -0.1, 0])) / np.linalg.norm(out + np.array([-0.5, -0.1, 0])) * f['len'] * L * 0.45
            normal = np.cross(out, np.array([1.0, 0, 0]))
            d = chain(p, [root, wrist, tip], [f['chord'] * L * 0.6, f['chord'] * L * 0.55, f['chord'] * L * 0.3],
                      flat=(normal, 0.32))
            ds['fore'] = np.minimum(ds['fore'], d)
        # Hind flippers: two webbed fans behind the tail, each three fused digits.
        h = self.hind
        ct = b.c[0]
        ds['hind'] = np.inf * np.ones(len(p))
        for sd in (-1, 1):
            root = ct + np.array([0.02 * L, 0, sd * 0.012 * L])
            # Five digits fanning in the vertical plane (the flippers are held sole to sole), the outer
            # ones longest, joined by a thinner web.
            for k, a in enumerate(np.linspace(-h['spread'], h['spread'], 5)):
                dirv = np.array([-math.cos(a), math.sin(a), sd * 0.18])
                dirv /= np.linalg.norm(dirv)
                reach = h['len'] * L * (1.0 - 0.18 * (1 - abs(a) / h['spread']))
                tip = root + dirv * reach
                d = chain(p, [root, root + dirv * reach * 0.5, tip], [0.024 * L, 0.014 * L, 0.008 * L],
                          flat=((0, 0, 1), 0.3))
                ds['hind'] = np.minimum(ds['hind'], d)
            web = ellipsoid(p, root + np.array([-h['len'] * L * 0.48, 0, sd * 0.016 * L]),
                            (h['len'] * L * 0.42, h['len'] * L * 0.42, 0.006 * L))
            ds['hind'] = smin([ds['hind'], web], 0.008 * L)
        return ds

    def stroke(self, p, label, sign):
        L = self.length
        xs = np.clip((p[:, 0].max() - p[:, 0]) / L, 0, 1.2)
        w = smooth(0.42, 1.12, xs) ** 1.6
        q = p.copy()
        q[:, 2] += sign * 0.15 * L * w
        return q


class WeddellSeal(Seal):
    """Weddell seal: plump, small round head, short broad muzzle; charcoal with silver blotches."""
    root = 'WeddellSeal'
    length = 2.6
    height = [(0, .03), (.06, .065), (.2, .14), (.44, .2), (.62, .185), (.76, .13), (.83, .1),
              (.9, .095), (.96, .068), (1, .03)]
    width = [(0, .035), (.06, .075), (.2, .15), (.44, .21), (.62, .19), (.76, .13), (.83, .105),
             (.9, .1), (.96, .072), (1, .032)]
    fore = dict(s=.69, len=.13, chord=.055, droop=.5)
    hind = dict(len=.17, spread=.55)
    head = dict(muzzle=.62, pads=1.1, gape=.25)

    def colour(self, p, n, s, theta, yn, label):
        dark = np.array([0.2, 0.22, 0.25])
        pale = np.array([0.66, 0.67, 0.68])
        belly = smooth(0.1, -0.6, yn)
        col = dark * (1 - belly[:, None] * 0.55) + pale * belly[:, None] * 0.55
        blotch = spots(p, 0.16, 1, 0.42) * smooth(0.6, -0.2, yn)
        col = col * (1 - blotch[:, None] * 0.6) + pale * blotch[:, None] * 0.6
        col *= (1 + 0.06 * noise3(p, 9, 2))[:, None]
        # A paler muzzle, darker eyes and nostrils.
        col = np.where(((s > 0.97) & (yn < 0.3))[:, None], col * 0.75 + pale * 0.25, col)
        return self.features(p, col)

    def features(self, p, col):
        for e in self.eyes:
            d = np.linalg.norm(p - e, axis=1)
            col = np.where((d < 0.022 * self.length)[:, None], np.array([0.03, 0.03, 0.035]), col)
        return col


class LeopardSeal(Seal):
    """Leopard seal: long serpentine body, large reptilian head with a long gape, long fore-flippers;
    dark grey back, pale silver throat and belly, dark spots on the throat and flanks."""
    root = 'LeopardSeal'
    length = 2.85
    spine_y = ((0, 0.0), (0.4, 0.015), (0.75, 0.02), (0.88, 0.03), (1, 0.03))
    height = [(0, .025), (.06, .05), (.2, .1), (.42, .135), (.6, .125), (.74, .095), (.82, .082),
              (.89, .085), (.95, .068), (1, .025)]
    width = [(0, .03), (.06, .06), (.2, .11), (.42, .14), (.6, .125), (.74, .09), (.82, .078),
             (.89, .09), (.95, .07), (1, .025)]
    fore = dict(s=.66, len=.2, chord=.05, droop=.55)
    hind = dict(len=.16, spread=.5)
    head = dict(muzzle=1.15, pads=.75, gape=.9)

    def colour(self, p, n, s, theta, yn, label):
        back = np.array([0.3, 0.32, 0.36])
        pale = np.array([0.72, 0.73, 0.75])
        belly = smooth(0.05, -0.55, yn)
        col = back * (1 - belly[:, None]) + pale * belly[:, None]
        sp_ = spots(p, 0.13, 7, 0.38) * smooth(0.5, -0.4, yn)
        col = col * (1 - sp_[:, None] * 0.55) + np.array([0.22, 0.23, 0.26]) * sp_[:, None] * 0.55
        col *= (1 + 0.05 * noise3(p, 8, 8))[:, None]
        return WeddellSeal.features(self, p, col)


class PolarBear(Species):
    """Polar bear, swimming: long neck and narrow Roman-nosed head held forward, a gentle shoulder
    hump, jointed legs (forelegs reaching to paddle, hind legs trailing) with broad paws."""
    root = 'PolarBear'
    length = 2.05
    template = 'fur'
    rough = 0.82
    blend = 0.045
    near, far = 7600, 1400

    def build_body(self):
        L = self.length
        spine = bezier((-0.5 * L, 0.0, 0), (-0.1 * L, 0.06 * L, 0), (0.22 * L, 0.06 * L, 0), (0.5 * L, 0.11 * L, 0),
                       n=12)
        self.body = Body(spine,
                         [(0, .07 * L), (.06, .13 * L), (.2, .17 * L), (.4, .18 * L), (.56, .175 * L), (.66, .135 * L),
                          (.74, .09 * L), (.82, .075 * L), (.9, .075 * L), (.96, .055 * L), (1, .02 * L)],
                         [(0, .07 * L), (.06, .13 * L), (.2, .16 * L), (.4, .165 * L), (.56, .155 * L), (.66, .115 * L),
                          (.74, .075 * L), (.82, .065 * L), (.9, .07 * L), (.96, .05 * L), (1, .02 * L)], belly=0.12)

    def parts(self, p):
        L, b = self.length, self.body
        ds = {'body': b.sdf(p)}
        # Shoulder hump and haunches.
        c, up, t, H, W = b.at(0.6)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.45, (H * 0.9, H * 0.6, W * 0.8))], self.blend)
        c, up, t, H, W = b.at(0.18)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.2, (H * 0.9, H * 0.8, W * 0.95))], self.blend)
        # Head: a long, narrow skull; cheeks; a muzzle with a slight Roman arch, a nose pad.
        c, up, t, H, W = b.at(0.9)
        ds['body'] = smin([ds['body'],
                           ellipsoid(p, c + up * H * 0.3, (H * 1.85, H * 1.4, W * 1.5)),
                           ellipsoid(p, c + t * 0.13 * L + up * H * 0.05, (0.09 * L, H * 0.85, W * 0.85))],
                          self.blend * 0.7)
        nose = c + t * 0.21 * L + up * H * 0.05
        ds['body'] = smin([ds['body'], ellipsoid(p, nose, (0.026 * L, H * 0.42, W * 0.46))], 0.016 * L)
        self.nose = nose
        self.eyes = []
        for sd in (-1, 1):
            e = c + t * 0.06 * L + up * H * 0.95 + np.array([0, 0, sd * W * 0.78])
            self.eyes.append(e)
            ds['body'] = smax(ds['body'], -ellipsoid(p, e, (0.018 * L, 0.014 * L, 0.012 * L)), 0.01 * L)
            ds['body'] = smin([ds['body'], ellipsoid(p, e - np.array([0, 0, sd * 0.004 * L]), (0.012 * L,) * 3)],
                              0.004 * L)
            ear = c - t * 0.05 * L + up * H * 1.6 + np.array([0, 0, sd * W * 0.85])
            ds['body'] = smin([ds['body'], ellipsoid(p, ear, (0.02 * L, 0.024 * L, 0.013 * L))], 0.012 * L)
            ds['body'] = smax(ds['body'], -ellipsoid(p, ear + np.array([0.006 * L, 0.004 * L, sd * 0.006 * L]),
                                                     (0.011 * L, 0.013 * L, 0.006 * L)), 0.004 * L)
            ds['body'] = smax(ds['body'], -ellipsoid(p, nose + t * 0.02 * L + up * H * 0.15 + np.array([0, 0, sd * W * 0.17]),
                                                     (0.008 * L, 0.006 * L, 0.006 * L)), 0.003 * L)
        self.mouth = nose - t * 0.07 * L - up * H * 0.38
        ds['body'] = smax(ds['body'], -ellipsoid(p, self.mouth, (0.07 * L, 0.004 * L, W * 0.55)), 0.003 * L)
        # Legs: shoulder -> elbow -> wrist -> paw; hips -> knee -> hock -> paw.
        ds['fore'] = np.full(len(p), np.inf)
        ds['hind'] = np.full(len(p), np.inf)
        self.pivots = {}
        for sd in (-1, 1):
            c, up, t, H, W = b.at(0.6)
            sh = c - up * H * 0.15 + np.array([0, 0, sd * W * 0.72])
            el = sh + np.array([0.06 * L, -0.2 * L, sd * 0.03 * L])
            wr = el + np.array([0.08 * L, -0.15 * L, sd * 0.01 * L])
            paw = wr + np.array([0.06 * L, -0.03 * L, 0])
            leg = chain(p, [sh, el, wr], [0.1 * L, 0.066 * L, 0.048 * L])
            pad = ellipsoid(p, paw, (0.07 * L, 0.024 * L, 0.06 * L))
            toes = [ellipsoid(p, paw + np.array([0.06 * L, -0.004 * L, k * 0.022 * L]), (0.02 * L, 0.016 * L, 0.014 * L))
                    for k in (-1.5, -0.5, 0.5, 1.5)]
            ds['fore'] = np.minimum(ds['fore'], smin([leg, pad, *toes], 0.026 * L))
            self.pivots[('fore', sd)] = sh
            c, up, t, H, W = b.at(0.18)
            hp = c - up * H * 0.2 + np.array([0, 0, sd * W * 0.7])
            kn = hp + np.array([-0.1 * L, -0.14 * L, sd * 0.02 * L])
            hk = kn + np.array([-0.12 * L, -0.06 * L, sd * 0.01 * L])
            paw = hk + np.array([-0.07 * L, -0.005 * L, 0])
            leg = chain(p, [hp, kn, hk], [0.11 * L, 0.066 * L, 0.048 * L])
            pad = ellipsoid(p, paw, (0.08 * L, 0.022 * L, 0.058 * L))
            toes = [ellipsoid(p, paw + np.array([-0.07 * L, -0.003 * L, k * 0.022 * L]), (0.02 * L, 0.015 * L, 0.014 * L))
                    for k in (-1.5, -0.5, 0.5, 1.5)]
            ds['hind'] = np.minimum(ds['hind'], smin([leg, pad, *toes], 0.026 * L))
            self.pivots[('hind', sd)] = hp
        # Short tail.
        c0 = b.c[0]
        ds['body'] = smin([ds['body'], ellipsoid(p, c0 - np.array([0.02 * L, -0.02 * L, 0]), (0.04 * L, 0.03 * L, 0.03 * L))],
                          0.02 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        cream = np.array([0.93, 0.9, 0.81])
        under = np.array([0.84, 0.79, 0.66])
        col = cream * (1 - smooth(0.2, -0.7, yn)[:, None]) + under * smooth(0.2, -0.7, yn)[:, None]
        col *= (1 + 0.05 * noise3(p, 7, 3) + 0.03 * noise3(p, 21, 4))[:, None]
        L = self.length
        # Black nose pad and lips, dark eyes, dark paw pads under the paws.
        dn = np.linalg.norm(p - self.nose, axis=1)
        tip = p[:, 0] > self.nose[0] - 0.012 * L
        col = np.where(((dn < 0.044 * L) & tip)[:, None], np.array([0.05, 0.05, 0.06]), col)
        dm = np.abs(p[:, 1] - self.mouth[1]) < 0.006 * L
        lip = dm & (p[:, 0] > self.mouth[0] - 0.05 * L) & (p[:, 0] < self.nose[0])
        col = np.where(lip[:, None], np.array([0.12, 0.11, 0.11]), col)
        for e in self.eyes:
            col = np.where((np.linalg.norm(p - e, axis=1) < 0.014 * L)[:, None], np.array([0.03, 0.03, 0.03]), col)
        paws = (label != 'body') & (n[:, 1] < -0.6) & (p[:, 1] < p[:, 1].min() + 0.06 * L)
        col = np.where(paws[:, None], np.array([0.12, 0.11, 0.1]), col)
        return col

    def stroke(self, p, label, sign):
        q = p.copy()
        L = self.length
        ds = self.parts(p)
        for (kind, sd), pivot in self.pivots.items():
            # A continuous weight (closer to the leg than to the body, on its own side), so the hide
            # where leg meets body stretches instead of tearing at the label boundary.
            m = (np.sign(p[:, 2]) == sd) & (ds[kind] - ds['body'] < 0.06 * L)
            if not m.any():
                continue
            # Rotate about the shoulder/hip (z axis), fading in from the joint so the hide stretches.
            d = np.linalg.norm(p - pivot, axis=1)
            w = smooth(0.02 * L, 0.12 * L, d) * smooth(0.05 * L, -0.03 * L, ds[kind] - ds['body']) * m
            ang = (0.45 if kind == 'fore' else -0.28) * sign * sd * w
            v = p - pivot
            cs, sn = np.cos(ang), np.sin(ang)
            q[:, 0] = np.where(m, pivot[0] + v[:, 0] * cs - v[:, 1] * sn, q[:, 0])
            q[:, 1] = np.where(m, pivot[1] + v[:, 0] * sn + v[:, 1] * cs, q[:, 1])
        return q


SPECIES = {'weddell-seal': WeddellSeal, 'leopard-seal': LeopardSeal, 'polar-bear': PolarBear}


# ------------------------------------------------------------------ build


def detail_texture(stem, fur):
    """A seamless, near-white detail map (the vertex colours carry the coat): fine skin grain or
    combed fur strands in the normal map, matte ORM."""
    n = 512
    v, u = np.mgrid[0:n, 0:n] / n * TAU
    rng = np.random.default_rng(78)
    h = np.zeros((n, n))
    for _ in range(40 if fur else 24):
        kx, ky = rng.integers(1, 40 if fur else 28, 2)
        if fur:
            ky = max(1, ky // 6)  # strands run mostly one way
        h += np.sin(kx * u + ky * v + rng.random() * TAU) / (kx + ky) ** 0.6
    h = (h - h.min()) / (h.max() - h.min())
    base = 0.88 + 0.12 * h
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    s = 3.0 if fur else 1.6
    nx, ny = -dx * s, -dy * s
    l = np.sqrt(nx * nx + ny * ny + 1)
    TEX.mkdir(parents=True, exist_ok=True)
    save = lambda a, f: Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(TEX / f, optimize=True)  # noqa: E731
    save(np.stack([base] * 3, -1), f'{stem}-base.png')
    save(np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5], -1), f'{stem}-normal.png')
    rough = 0.8 if fur else 0.55
    save(np.stack([np.ones_like(h), np.full_like(h, rough) + 0.05 * (h - 0.5), np.zeros_like(h)], -1), f'{stem}-orm.png')


def build(name):
    build_species(name, SPECIES[name]())


def build_species(name, sp):
    """Sculpt, reduce, colour, morph and export one species instance (shared with sea_creatures)."""
    sp.build_body()
    L = sp.length
    voxel = L / getattr(sp, 'resolution', 260)
    probe = sp.body.c
    pad = getattr(sp, 'pad', ((0.22, 0.42, 0.42), (0.22, 0.32, 0.42)))
    lo = probe.min(0) - np.array(pad[0]) * L
    hi = probe.max(0) + np.array(pad[1]) * L
    shape = np.ceil((hi - lo) / voxel).astype(int) + 1
    axes = [lo[k] + np.arange(shape[k]) * voxel for k in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    field = np.empty(len(pts))
    for i in range(0, len(pts), 300000):
        ds = sp.parts(pts[i:i + 300000])
        field[i:i + 300000] = smin(list(ds.values()), sp.blend)
    v, f, _, _ = marching_cubes(field.reshape(shape), 0.0, spacing=(voxel,) * 3)
    v += lo
    f = f[:, ::-1].copy()
    v, f = decimate(v, f, sp.near)
    # Decimation can leave a few degenerate faces (repeated corners, no area); drop them so the
    # exported mesh is valid. Vertices are untouched, so the morphs line up.
    area = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1)
    f = f[(area > 1e-12) & (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    _, first = np.unique(np.sort(f, axis=1), axis=0, return_index=True)
    f = f[np.sort(first)]
    # Labels (which part each vertex belongs to), normals, coat colour, detail UVs.
    ds = sp.parts(v)
    names = list(ds)
    label = np.array(names)[np.argmin(np.stack([ds[k] for k in names]), 0)]
    nrm = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(nrm, f[:, k], fn)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    # Point the colouring normals outward whatever the face winding (signed volume).
    cen = (v[f[:, 0]] + v[f[:, 1]] + v[f[:, 2]]) / 3
    if np.sum(cen * fn) < 0:
        nrm = -nrm
    s, theta, yn = sp.body.param(v)
    col = np.clip(sp.colour(v, nrm, s, theta, yn, label), 0, 1)
    a = np.abs(nrm).argmax(1)
    uv = np.where(a[:, None] == 0, v[:, [2, 1]], np.where(a[:, None] == 1, v[:, [0, 2]], v[:, [0, 1]])) * (3.0 / L * 2)
    # Centre on the length, as the shipped models are.
    shift = np.array([(v[:, 0].min() + v[:, 0].max()) / 2, 0, 0])
    stem = f'p078-{name}-skin'
    detail_texture(stem, sp.template == 'fur')
    ca.reset_scene()
    root = ca.create_root(f'{sp.root}_Root', 'creature', species=name, standards_pass='078')
    skin = ca.pbr_material(f'{sp.root}_Skin', sp.template, stem, roughness=sp.rough, normal_strength=0.6,
                           directory=TEX, vertex_tint=True)
    body = ca.mesh_from_arrays('Body', v - shift, f, uv, col, skin, root)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(body.data)
    bm.free()
    body.shape_key_add(name='Basis', from_mix=False)
    for sign, key in ((1, 'Stroke_Left'), (-1, 'Stroke_Right')):
        q = sp.stroke(v, label, sign) - shift
        kb = body.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', ca.to_blender(q).ravel())
        kb.value = 0.0
    import fish_lod  # noqa: PLC0415
    fish_lod.RATIOS['Body'] = sp.far / max(len(f), 1)
    low = fish_lod.lod(body)
    for kb in low.data.shape_keys.key_blocks[1:]:
        kb.value = 0.0
    for w in ca.check_scene('creature'):
        print('  note:', w)
    ca.save_blend(HERE / f'{name}.blend')
    raw = ca.export_glb(HERE / 'out' / f'{name}.glb')
    out = OUT / f'{name}.glb'
    out.write_bytes(raw.read_bytes())
    tris = {o.name: sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
    dims = {o.name: [round(x, 2) for x in o.dimensions] for o in bpy.data.objects if o.type == 'MESH'}
    print('exported', name, out.stat().st_size, tris, dims)


if __name__ == '__main__':
    for n in (sys.argv[1:] or SPECIES):
        build(n)
