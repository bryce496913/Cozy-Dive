"""V0.7 Pass 065: hero reef fish in the approved Crafted Stylized Realism standard.

    python3 tools/art/pass065/hero_fish.py [chromis clownfish gramma]   # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs public/assets/models
    node validation/AssetStandards.ts public/assets/models/fish/chromis.glb

Rebuilds the blue-green chromis, ocellaris clownfish and royal gramma from species anatomy, keeping
the runtime rig contract exactly (so AuthoredSchool instancing, fish AI and schooling are untouched):

  <Species>_Root
    Body                 continuous skin; Stroke_Left / Stroke_Right morphs
    Median_Fins          dorsal, anal, caudal and pelvic fins; the same morphs
    Eyes_Gills_Mouth     seated lens eyes (materials Iris, Pupil; rim in skin)
    Pectoral_Left/Right  pivoted at the fin base (node translation = pivot)
    *_LOD1               distance levels (tools/art/pass017/fish_lod.py, morphs transferred)

Construction (game space: +X snout, +Y dorsal, +Z left flank; metres at authored length):
  * Body: a loft of superellipse cross-sections (flatter flanks, a narrower back than belly) from
    species profiles of half-height, half-width and midline; a slim peduncle; a blunt or pointed
    snout. Eye orbits are carved into the skin, the gill cover is a real step in the surface, and
    the mouth is a groove; none are stuck-on tubes.
  * Fins: membranes with thickness (thicker at the base, ray ridges, a thin closed edge) whose
    base sits inside the body, so they grow out of it. Caudal shapes per species (forked, rounded,
    truncate).
  * Eyes: lens-shaped caps seated in their orbits (pupil, iris, skin rim), tilted slightly forward.
  * Stroke morphs: one lateral deformation field for every vertex (skin and fins move together):
    a carangiform S - the head counter-swings slightly, the peduncle bends most - with length kept.
  * Textures (512 px, UV-painted from physical position): species pigmentation with soft
    countershading, subtle scale relief, roughness variation; fins with rays and edge translucency.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy  # noqa: I001
import bmesh
import numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/v07'))
sys.path.insert(0, str(ROOT / 'tools/art/pass017'))
import cozy_art as ca  # noqa: E402

TEX = ROOT / 'tools/art/textures/pass065'
OUT = ROOT / 'public/assets/models/fish'
RAW = HERE / 'out'
N = 512
TAU = math.tau


def smooth(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ species anatomy
# Profiles are (s, value) with s = 0 at the tail root and 1 at the snout tip; heights and widths
# are fractions of the species' maximum half-height `hm` and half-width `wm`.

SPECIES = {
    'chromis': dict(
        name='Chromis', body=0.355, caudal=0.105, hm=0.085, wm=0.036, n=2.35, belly=0.12,
        height=[(0, .09), (.08, .13), (.2, .3), (.35, .64), (.5, .9), (.62, 1.0), (.74, .95), (.85, .74),
                (.93, .45), (.98, .2), (1, .05)],
        width=[(0, .14), (.1, .22), (.3, .62), (.55, 1.0), (.75, .93), (.9, .62), (.97, .3), (1, .07)],
        mid=[(0, 0), (.5, .03), (.8, .0), (1, -.18)],
        eye=dict(s=.885, y=.22, r=.17), gill=.74, mouth=.955,
        caudal_shape='forked',
        dorsal=dict(s=(.24, .74), h=[(0, .25), (.12, .75), (.45, .62), (.85, .55), (1, .2)], slant=.55),
        anal=dict(s=(.2, .46), h=[(0, .25), (.2, .7), (.7, .55), (1, .2)], slant=.6),
        pelvic=dict(s=.66, len=.42), pectoral=dict(s=.70, y=-.22, len=.48),
        rays=dict(dorsal=22, anal=14, caudal=18, pelvic=6, pectoral=12),
    ),
    'clownfish': dict(
        name='Clownfish', body=0.54, caudal=0.14, hm=0.13, wm=0.068, n=2.2, belly=0.1,
        height=[(0, .17), (.08, .25), (.2, .5), (.35, .8), (.5, .97), (.6, 1.0), (.72, .96), (.84, .82),
                (.93, .58), (.98, .32), (1, .08)],
        width=[(0, .2), (.1, .3), (.3, .7), (.55, 1.0), (.78, .95), (.9, .7), (.97, .4), (1, .1)],
        mid=[(0, 0), (.5, .02), (.85, -.02), (1, -.12)],
        eye=dict(s=.885, y=.25, r=.14), gill=.75, mouth=.96,
        caudal_shape='rounded',
        dorsal=dict(s=(.2, .74), h=[(0, .3), (.15, .62), (.42, .55), (.5, .26), (.56, .4), (.8, .42),
                                    (1, .18)], slant=.35),
        anal=dict(s=(.18, .42), h=[(0, .3), (.3, .62), (.75, .5), (1, .2)], slant=.35),
        pelvic=dict(s=.64, len=.38), pectoral=dict(s=.69, y=-.2, len=.42),
        rays=dict(dorsal=24, anal=13, caudal=16, pelvic=6, pectoral=14),
    ),
    'gramma': dict(
        name='Gramma', body=0.57, caudal=0.15, hm=0.104, wm=0.06, n=2.25, belly=0.1,
        height=[(0, .2), (.1, .32), (.25, .62), (.4, .86), (.55, .98), (.65, 1.0), (.78, .93), (.88, .72),
                (.95, .45), (.99, .18), (1, .05)],
        width=[(0, .2), (.12, .3), (.3, .68), (.55, 1.0), (.8, .9), (.92, .6), (.98, .3), (1, .08)],
        mid=[(0, 0), (.5, .02), (.85, 0), (1, -.1)],
        eye=dict(s=.9, y=.22, r=.16), gill=.77, mouth=.965,
        caudal_shape='truncate',
        dorsal=dict(s=(.1, .78), h=[(0, .3), (.15, .62), (.6, .58), (.9, .55), (1, .25)], slant=.45),
        anal=dict(s=(.1, .46), h=[(0, .3), (.25, .66), (.8, .55), (1, .22)], slant=.45),
        pelvic=dict(s=.68, len=.55), pectoral=dict(s=.72, y=-.18, len=.45),
        rays=dict(dorsal=30, anal=16, caudal=16, pelvic=5, pectoral=12),
    ),
}


class Anatomy:
    def __init__(self, spec):
        self.spec = spec
        self.L = spec['body']
        self.x_snout = self.L * 0.55
        self.x_root = -self.L * 0.45
        mk = lambda pts: PchipInterpolator(*zip(*pts))  # noqa: E731
        self._h, self._w, self._m = mk(spec['height']), mk(spec['width']), mk(spec['mid'])

    def x(self, s):
        return self.x_root + np.asarray(s, float) * self.L

    def s(self, x):
        return (np.asarray(x, float) - self.x_root) / self.L

    def H(self, s):
        return np.maximum(self._h(np.clip(s, 0, 1)) * self.spec['hm'], 0.0015)

    def W(self, s):
        return np.maximum(self._w(np.clip(s, 0, 1)) * self.spec['wm'], 0.001)

    def C(self, s):
        return self._m(np.clip(s, 0, 1)) * self.spec['hm']

    def section(self, s, theta):
        """Point on the skin at s, angle theta (0 = dorsal, pi/2 = left flank, pi = ventral)."""
        n = self.spec['n']
        c, sn = np.cos(theta), np.sin(theta)
        y = self.C(s) + self.H(s) * np.sign(c) * np.abs(c) ** (2 / n)
        # A rounder belly than back: the lower half carries a little more width.
        w = self.W(s) * (1 - self.spec['belly'] * c)
        z = w * np.sign(sn) * np.abs(sn) ** (2 / n)
        return y, z


# ------------------------------------------------------------------ geometry


def grid_faces(rows, cols, closed=False):
    f = []
    w = cols + (0 if closed else 1)
    for i in range(rows - 1):
        for j in range(cols if closed else cols):
            a = i * w + j
            b = i * w + (j + 1) % w if closed else a + 1
            c, d = a + w, b + w
            f.append((a, c, d, b))
    return f


def body_mesh(an: Anatomy):
    spec = an.spec
    rows, cols = 72, 40
    s = 1 - (1 - np.linspace(0, 1, rows)) ** 1.15  # a little denser toward the head
    th = np.linspace(0, TAU, cols, endpoint=False)
    S, T = np.meshgrid(s, th, indexing='ij')
    y, z = an.section(S, T)
    x = an.x(S)
    p = np.stack([x, y, z], -1).reshape(-1, 3)
    uv = np.stack([S.ravel(), (T / TAU).ravel()], 1)
    # Eye orbits: a recess under each eye with a soft brow above it.
    e = spec['eye']
    ex, ey = an.x(e['s']), an.C(e['s']) + e['y'] * an.H(e['s'])
    er = e['r'] * spec['hm']
    d = np.hypot((p[:, 0] - ex) / 1.0, (p[:, 1] - ey) / 1.05) / er
    side = np.sign(p[:, 2])
    p[:, 2] -= side * 0.42 * er * smooth(1.25, 0.6, d) * (np.abs(p[:, 2]) > 0.3 * an.W(e['s']))
    p[:, 1] += 0.08 * er * smooth(1.6, 1.1, d) * (p[:, 1] > ey + 0.6 * er)
    # Gill cover: the operculum's free edge is a step in the skin, bulging back at mid-height.
    yn = (p[:, 1] - an.C(S.ravel())) / an.H(S.ravel())
    edge = spec['gill'] - 0.035 * (1 - np.clip(yn, -1, 1) ** 2)
    behind = edge - S.ravel()
    flank = np.abs(np.sin(T.ravel())) > 0.35
    step = (smooth(0.0, 0.004, behind) * smooth(0.035, 0.012, behind)) * flank
    p[:, 2] -= np.sign(p[:, 2]) * step * 0.07 * an.W(spec['gill'])
    # Mouth groove: a short slit back from the snout, slightly below the midline.
    sm = S.ravel()
    mouth = (sm > spec['mouth']) & (np.abs(np.sin(T.ravel())) > 0.15)
    my = an.C(sm) - 0.18 * an.H(sm)
    groove = mouth * smooth(0.012, 0.0, np.abs(p[:, 1] - my)) * smooth(spec['mouth'], spec['mouth'] + 0.01, sm)
    p[:, 2] -= np.sign(p[:, 2]) * groove * 0.35 * an.W(sm)
    faces = grid_faces(rows, cols, closed=True)
    # Caps: snout tip and tail root (the latter sits inside the caudal fin base).
    tip = len(p)
    p = np.vstack([p, [[an.x_snout + 0.002, an.C(1), 0], [an.x_root - 0.002, an.C(0), 0]]])
    uv = np.vstack([uv, [[1, 0.5], [0, 0.5]]])
    last = (rows - 1) * cols
    faces += [(last + j, last + (j + 1) % cols, tip) for j in range(cols)]
    faces += [((j + 1) % cols, j, tip + 1) for j in range(cols)]
    return p, faces, uv


def membrane(base, edge, rays, thickness, ray_depth=0.35, u_steps=None, v_steps=6, normal=(0, 0, 1)):
    """A fin with real thickness: two surfaces around the mid-sheet, closed at the free edge.

    base(u), edge(u): (n, 3) arrays for u in [0, 1]. Thickness thins from base to edge; ray ridges
    make it ribbed. Returns positions, quads, uvs (u along the base, v base->edge)."""
    nu = u_steps or rays * 2 + 1
    u = np.linspace(0, 1, nu)
    v = np.linspace(0, 1, v_steps)
    B, E = base(u), edge(u)
    U, V = np.meshgrid(u, v, indexing='ij')
    mid = B[:, None, :] * (1 - V[..., None]) + E[:, None, :] * V[..., None]
    rib = np.abs(np.cos(np.pi * rays * U)) ** 2
    t = thickness * (1 - V) ** 0.8 * (1 - ray_depth + ray_depth * rib) + 0.00025
    nrm = np.asarray(normal, float)
    # A gentle billow across the membrane between rays.
    billow = 0.12 * thickness * np.sin(np.pi * U * rays) * V
    top = mid + nrm * (t / 2 + billow)[..., None]
    bot = mid - nrm * (t / 2 - billow)[..., None]
    p = np.concatenate([top.reshape(-1, 3), bot.reshape(-1, 3)])
    w = v_steps
    faces = []
    off = nu * v_steps
    for i in range(nu - 1):
        for j in range(w - 1):
            a = i * w + j
            faces.append((a, a + 1, a + w + 1, a + w))
            faces.append((off + a, off + a + w, off + a + w + 1, off + a + 1))
        # Free edge closes the two surfaces.
        a, b = i * w + w - 1, (i + 1) * w + w - 1
        faces.append((a, b, off + b, off + a))
    for i, j in ((0, 1), (nu - 1, -1)):
        for k in range(w - 1):
            a, b = i * w + k, i * w + k + 1
            faces.append((a, off + a, off + b, b) if j > 0 else (a, b, off + b, off + a))
    uvs = np.concatenate([np.stack([U.ravel(), V.ravel()], 1)] * 2)
    return p, faces, uvs


def profile_fn(points):
    f = PchipInterpolator(*zip(*points))
    return lambda u: f(np.clip(u, 0, 1))


def median_fins(an: Anatomy):
    spec, hm = an.spec, an.spec['hm']
    parts = []
    thick = 0.022 * hm

    def along(range_s, hp, slant, sign):
        s0, s1 = range_s
        h = profile_fn(hp)

        def base(u):
            s = s1 - (s1 - s0) * u
            y = an.C(s) + sign * an.H(s) * 0.9
            return np.stack([an.x(s), y, np.zeros_like(s)], 1)

        def edge(u):
            b = base(u)
            hh = h(u) * hm
            return b + np.stack([-slant * hh, sign * hh, np.zeros_like(hh)], 1)
        return base, edge

    for key, sign in (('dorsal', 1), ('anal', -1)):
        f = spec[key]
        b, e = along(f['s'], f['h'], f['slant'], sign)
        parts.append(membrane(b, e, spec['rays'][key], thick))
    # Caudal fin, rooted in the peduncle.
    lc, shape = spec['caudal'], spec['caudal_shape']
    r0 = an.x(0.015)
    hroot = an.H(0.0) * 0.9

    def cbase(u):
        y = an.C(0) + (u - 0.5) * 2 * hroot
        return np.stack([np.full_like(u, r0), y, np.zeros_like(u)], 1)

    def cedge(u):
        k = (u - 0.5) * 2
        if shape == 'forked':
            back = lc * (0.62 + 0.38 * np.abs(k) ** 1.3)
            span = 0.95 * hm
        elif shape == 'rounded':
            back = lc * (1 - 0.32 * k ** 2)
            span = 0.78 * hm
        else:  # truncate with softly rounded corners
            back = lc * (0.94 - 0.12 * k ** 4)
            span = 0.82 * hm
        y = an.C(0) + k * span
        return np.stack([r0 - back, y, np.zeros_like(u)], 1)
    parts.append(membrane(cbase, cedge, spec['rays']['caudal'], thick * 1.1))
    # Pelvic fins: paired, angled down and back from the belly.
    pv = spec['pelvic']
    for side in (-1, 1):
        s = pv['s']
        bx, by, bz = an.x(s), an.C(s) - an.H(s) * 0.85, side * an.W(s) * 0.35
        ln = pv['len'] * hm

        def pbase(u, bx=bx, by=by, bz=bz):
            return np.stack([bx - u * 0.35 * ln, np.full_like(u, by), np.full_like(u, bz)], 1)

        def pedge(u, bx=bx, by=by, bz=bz, side=side, ln=ln):
            return np.stack([bx - ln * (0.75 + 0.45 * u), by - ln * (0.75 - 0.35 * u), bz + side * ln * 0.18 + 0 * u], 1)
        parts.append(membrane(pbase, pedge, spec['rays']['pelvic'], thick * 0.8, normal=(0, 0, 1)))
    return parts


def pectoral(an: Anatomy, side):
    spec, hm = an.spec, an.spec['hm']
    pc = spec['pectoral']
    s = pc['s']
    pivot = np.array([an.x(s), an.C(s) + pc['y'] * an.H(s), side * an.W(s) * 0.92])
    ln = pc['len'] * hm

    def base(u):
        return np.stack([np.zeros_like(u), (u - 0.5) * 0.25 * ln, np.zeros_like(u)], 1)

    def edge(u):
        a = (u - 0.5) * 1.6  # fan angle
        r = ln * (0.8 + 0.25 * np.cos(a * 1.4))
        return np.stack([-r * np.cos(a), r * np.sin(a) * 0.7, side * r * 0.35 * np.ones_like(u)], 1)
    p, f, uv = membrane(base, edge, spec['rays']['pectoral'], 0.018 * hm, normal=(0, 0, 1))
    return pivot, p, f, uv


def eye_mesh(an: Anatomy, side):
    """A lens seated in its orbit: pupil, iris and a skin-coloured rim, tilted a little forward."""
    e = an.spec['eye']
    r = e['r'] * an.spec['hm']
    s = e['s']
    cx, cy = an.x(s), an.C(s) + e['y'] * an.H(s)
    cz = side * (an.W(s) - 0.42 * r)
    rings, segs = 14, 28
    phi = np.radians(np.linspace(0, 72, rings))
    th = np.linspace(0, TAU, segs, endpoint=False)
    P, T = np.meshgrid(phi, th, indexing='ij')
    lx = np.sin(P) * np.cos(T) * r
    ly = np.sin(P) * np.sin(T) * r
    lz = (np.cos(P) - np.cos(np.radians(72))) * r * 0.62
    tilt = np.radians(12)
    x2 = lx * np.cos(tilt) + lz * np.sin(tilt)
    z2 = -lx * np.sin(tilt) + lz * np.cos(tilt)
    pts = np.stack([cx + x2.ravel(), cy + ly.ravel(), cz + side * z2.ravel()], 1)
    faces = grid_faces(rings, segs, closed=True)
    if side < 0:
        faces = [tuple(reversed(q)) for q in faces]
    ang = np.degrees(P.ravel())
    region = np.where(ang < 20, 0, np.where(ang < 46, 1, 2))  # 0 pupil, 1 iris, 2 rim
    face_region = [int(max(region[list(q)])) for q in faces]
    uv = np.stack([0.5 + lx.ravel() / (2 * r), 0.5 + ly.ravel() / (2 * r)], 1)
    return pts, faces, uv, face_region


# ------------------------------------------------------------------ morphs


def stroke(an: Anatomy, p, sign):
    """Lateral S-bend: head counter-swings slightly, the peduncle bends most, length is kept."""
    total = an.x_snout - (an.x_root - an.spec['caudal'])
    xs = np.clip((an.x_snout - p[:, 0]) / total, 0, 1)  # 0 snout .. 1 tail tip
    w = smooth(0.28, 1.0, xs) ** 1.5
    lateral = an.spec['body'] * (0.105 * w - 0.012 * np.sin(np.pi * smooth(0.0, 0.45, xs)))
    q = p.copy()
    q[:, 2] += sign * lateral
    q[:, 0] += 0.25 * lateral ** 2 / max(an.spec['body'], 1e-6) * 4
    return q


# ------------------------------------------------------------------ textures


def body_texture(name, an: Anatomy):
    spec = an.spec
    v, u = np.mgrid[0:N, 0:N] / N
    S, T = u, v * TAU
    y, z = an.section(S, T)
    x = an.x(S)
    yn = (y - an.C(S)) / an.H(S)  # -1 belly .. 1 back
    rng = np.random.default_rng(65000 + len(name))

    def noise(scale, seed):
        r = np.random.default_rng(seed)
        f = np.fft.fft2(r.standard_normal((N, N)))
        fy, fx = np.meshgrid(np.fft.fftfreq(N), np.fft.fftfreq(N), indexing='ij')
        k = np.exp(-((np.hypot(fx, fy) * scale) ** 2))
        out = np.real(np.fft.ifft2(f * k))
        return (out - out.mean()) / (out.std() + 1e-9)

    broad = noise(40, 1)
    if name == 'chromis':
        back, flank, belly = np.array([.28, .58, .66]), np.array([.50, .84, .74]), np.array([.86, .95, .9])
        col = flank + (back - flank) * smooth(0.15, 0.85, yn)[..., None] + (belly - flank) * smooth(-0.1, -0.85, yn)[..., None]
        col *= (1 + broad * 0.025)[..., None]
    elif name == 'clownfish':
        orange, white, black = np.array([.95, .47, .13]), np.array([.97, .96, .92]), np.array([.05, .04, .04])
        col = np.tile(orange, (N, N, 1)).astype(float)
        col = col * (1 - 0.1 * smooth(0.3, 1, yn))[..., None]  # slightly deeper on the back
        bars = [(.79 + .02 * yn, .045), (.5 + .045 * np.clip(yn, 0, 1), .05), (.12, .032)]
        for centre, half in bars:
            dist = np.abs(S - centre)
            inner = smooth(half + .004, half - .004, dist)
            outer = smooth(half + .019, half + .011, dist)
            col = col * (1 - outer[..., None]) + black * outer[..., None]
            col = col * (1 - inner[..., None]) + white * inner[..., None]
    else:  # royal gramma
        violet, gold = np.array([.62, .22, .74]), np.array([.98, .76, .1])
        t = smooth(0.40, 0.52, S + 0.03 * np.sin(T * 3) * 0.3)
        col = gold * (1 - t[..., None]) + violet * t[..., None]
        # Black line from the snout through the eye.
        e = spec['eye']
        ly = an.C(S) + (e['y'] + (S - e['s']) * 1.6) * an.H(S)
        line = smooth(0.012, 0.004, np.abs(y - ly)) * (S > e['s'] - 0.02) * (np.abs(np.sin(T)) > 0.2)
        col = col * (1 - line[..., None]) + np.array([.04, .03, .05]) * line[..., None]
        col *= (1 - 0.12 * smooth(0.4, 1, yn))[..., None]
    # Gill-cover shadow line and mouth.
    gill_edge = spec['gill'] - 0.035 * (1 - np.clip(yn, -1, 1) ** 2)
    gill = smooth(0.006, 0.0, np.abs(S - gill_edge)) * (np.abs(yn) < 0.85) * (np.abs(np.sin(T)) > 0.3)
    col *= (1 - 0.35 * gill)[..., None]
    # Scales: offset rows in physical space; relief only, no engraved outlines.
    cell = spec['hm'] * 0.11
    gx, gy = x / cell, (y - an.C(S)) / (cell * 0.8)
    row = np.floor(gy)
    gx = gx + 0.5 * (row % 2)
    fx, fy = gx - np.floor(gx), gy - row
    scale = np.clip(1 - np.hypot((fx - 0.5) * 1.1, fy * 0.9) * 1.25, 0, 1) ** 0.6
    head = smooth(spec['gill'] - 0.01, spec['gill'] + 0.02, S)  # no scales on the head
    fins_free = 1 - head
    height = scale * 0.6 * fins_free + broad * 0.05
    col *= (0.97 + 0.04 * scale * fins_free)[..., None]
    rough = 0.42 + 0.06 * (1 - scale) * fins_free + 0.03 * broad + 0.05 * gill
    return np.clip(col, 0, 1), height, rough, 1 - 0.4 * gill


def fin_texture(name):
    v, u = np.mgrid[0:N, 0:N] / N
    rays = np.abs(np.cos(np.pi * 24 * u)) ** 8
    edge = smooth(0.8, 1.0, v)
    if name == 'chromis':
        col = np.array([.62, .86, .82]) * (1 - 0.15 * rays[..., None])
        alpha = 0.78 - 0.45 * v + 0.12 * rays
    elif name == 'clownfish':
        col = np.array([.95, .5, .14]) * (1 - 0.12 * rays[..., None])
        black = smooth(0.84, 0.9, v)
        col = col * (1 - black[..., None]) + np.array([.05, .04, .04]) * black[..., None]
        alpha = 0.92 - 0.25 * v + 0.08 * rays
    else:
        col = np.array([.98, .8, .16]) * (1 - 0.12 * rays[..., None])
        alpha = 0.86 - 0.35 * v + 0.1 * rays
    col = col * (1 - 0.08 * edge[..., None])
    return np.clip(np.concatenate([col, np.clip(alpha, 0.2, 1)[..., None]], -1), 0, 1)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, dy * strength, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def write_textures(name, an):
    TEX.mkdir(parents=True, exist_ok=True)
    col, height, rough, ao = body_texture(name, an)
    save = lambda a, f: Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(TEX / f, optimize=True)  # noqa: E731
    stem = f'p065-{name}-skin'
    save(col, f'{stem}-base.png')
    save(normal_from_height(height, 2.0) * 0.5 + 0.5, f'{stem}-normal.png')
    save(np.stack([ao, rough, np.zeros_like(rough)], -1), f'{stem}-orm.png')
    save(fin_texture(name), f'p065-{name}-fin-fins.png')
    return stem


# ------------------------------------------------------------------ Blender assembly


def recalc(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()


def add_morphs(obj, an, positions):
    obj.shape_key_add(name='Basis', from_mix=False)
    for sign, key in ((1, 'Stroke_Left'), (-1, 'Stroke_Right')):
        kb = obj.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', ca.to_blender(stroke(an, positions, sign)).ravel())


def swim_preview(morphing, pectorals):
    """`SwimPreview`: one stroke cycle for authoring review (the game drives morphs itself)."""
    for o in morphing:
        keys = o.data.shape_keys
        for f in range(1, 34, 4):
            phase = (f - 1) / 32 * TAU
            for sign, nm in ((1, 'Stroke_Left'), (-1, 'Stroke_Right')):
                kb = keys.key_blocks[nm]
                kb.value = max(0.0, math.sin(phase) * sign)
                kb.keyframe_insert('value', frame=f)
        action = keys.animation_data.action
        track = keys.animation_data.nla_tracks.new()
        track.name = 'SwimPreview'
        track.strips.new(action.name, 1, action)
        keys.animation_data.action = None
        for kb in keys.key_blocks:
            kb.value = 0
    for p in pectorals:
        for f in range(1, 34, 4):
            p.rotation_euler.z = 0.12 * math.sin((f - 1) / 32 * TAU)
            p.keyframe_insert('rotation_euler', frame=f)
        action = p.animation_data.action
        track = p.animation_data.nla_tracks.new()
        track.name = 'SwimPreview'
        track.strips.new(action.name, 1, action)
        p.animation_data.action = None
        p.rotation_euler.z = 0
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, 33
    bpy.context.scene.frame_set(1)


def plain(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*ca.srgb_to_linear(rgb), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = 0
    return m


IRIS = {'chromis': (.48, .58, .44), 'clownfish': (.82, .42, .12), 'gramma': (.18, .14, .14)}


def build(name):
    spec = SPECIES[name]
    an = Anatomy(spec)
    stem = write_textures(name, an)
    ca.reset_scene()
    label = spec['name']
    root = ca.create_root(f'{label}_Root', 'fish', species=name, standards_pass='065')
    skin = ca.pbr_material(f'{label}_Scale_Skin', 'fish-skin', stem, roughness=0.45, normal_strength=0.6,
                           vertex_tint=False)
    fin = ca.pbr_material(f'{label}_Fin_Membrane', 'fin', stem, roughness=0.55, vertex_tint=False,
                          paths={'base': TEX / f'p065-{name}-fin-fins.png'})
    iris, pupil = plain('Iris', IRIS[name], 0.22), plain('Pupil', (.01, .012, .015), 0.08)
    white = np.ones((1, 4))
    # Body.
    p, f, uv = body_mesh(an)
    body = ca.mesh_from_arrays('Body', p, f, uv, np.repeat(white, len(p), 0), skin, root)
    recalc(body)
    add_morphs(body, an, p)
    # Median fins as one mesh.
    parts = median_fins(an)
    off, P, F, UV = 0, [], [], []
    for pp, ff, uu in parts:
        P.append(pp)
        F += [tuple(i + off for i in q) for q in ff]
        UV.append(uu)
        off += len(pp)
    P = np.concatenate(P)
    fins = ca.mesh_from_arrays('Median_Fins', P, F, np.concatenate(UV), np.repeat(white, len(P), 0), fin, root)
    recalc(fins)
    add_morphs(fins, an, P)
    # Eyes (and the rim, in skin).
    off, P, F, UV, R = 0, [], [], [], []
    for side in (1, -1):
        pp, ff, uu, rr = eye_mesh(an, side)
        P.append(pp)
        F += [tuple(i + off for i in q) for q in ff]
        UV.append(uu)
        R += rr
        off += len(pp)
    P = np.concatenate(P)
    eyes = ca.mesh_from_arrays('Eyes_Gills_Mouth', P, F, np.concatenate(UV), np.repeat(white, len(P), 0), pupil,
                               root)
    eyes.data.materials.append(iris)
    eyes.data.materials.append(skin)
    for poly, r in zip(eyes.data.polygons, R):
        poly.material_index = r
    # Pectorals on pivots.
    for side, nm in ((1, 'Pectoral_Left'), (-1, 'Pectoral_Right')):
        pivot, pp, ff, uu = pectoral(an, side)
        o = ca.mesh_from_arrays(nm, pp, ff, uu, np.repeat(white, len(pp), 0), fin, root)
        recalc(o)
        o.location = tuple(ca.to_blender(pivot))
    swim_preview([body, fins], [bpy.data.objects['Pectoral_Left'], bpy.data.objects['Pectoral_Right']])
    # Distance levels with transferred morphs (the Pass 017 tool).
    import fish_lod  # noqa: E402,PLC0415
    # Seated lens eyes keep more of their (small) mesh, so the far level stays inside the near one.
    fish_lod.RATIOS['Eyes_Gills_Mouth'] = 0.3
    for part in ('Body', 'Median_Fins', 'Eyes_Gills_Mouth'):
        fish_lod.lod(bpy.data.objects[part])
    for w in ca.check_scene('fish'):
        print('  note:', w)
    ca.save_blend(HERE / f'{name}.blend')
    raw = ca.export_glb(RAW / f'{name}.glb', animations=True)
    out = OUT / f'{name}.glb'
    out.write_bytes(raw.read_bytes())
    tris = {o.name: sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
    print('exported', name, out.stat().st_size, tris)


if __name__ == '__main__':
    for n in (sys.argv[1:] or SPECIES):
        build(n)
