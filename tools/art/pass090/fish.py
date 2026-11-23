"""V0.8 Pass 090: fish anatomy and surface quality, on the Pass 065/066 builder.

    python3 tools/art/pass090/fish.py [species ...]      # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs public/assets/models/fish
    python3 tools/art/inspect_assets.py

The Pass 066 roster gave every species one of four shared height profiles (five large fish shared
one exactly), the same domed snout, a shallow mouth groove, one small fan pectoral and the same
scale relief: a regular grid of round bumps that read as woven fabric. This pass keeps the
builder, the rig contract and every painter, and replaces:

  * Body profiles: each species has its own dorsal (`top`) and ventral (`bot`) outline, so steep
    foreheads, humps, protruding snouts, jutting lower jaws and narrow peduncles are modelled
    (from reference proportions; see docs/V08_FISH_ANATOMY.md), and its own width profile.
  * Mouths: a real gape (a cleft with lips above and below), its size (where it starts), height
    on the head (terminal, superior, inferior), obliqueness and lip thickness per species.
  * Pectorals: four shapes: a fan (damsels), rounded paddles (groupers, notothens), falcate
    sickles (jacks, tangs, idols) and the broad labriform wing of wrasses and parrotfish.
  * Skin: imbricate scales in the body's flow (rows converge toward the peduncle and belly), each
    scale's exposed posterior margin a soft step over the one behind, jittered in place and size,
    sized per species (fine on tangs and jacks, coarse on parrotfish and wrasse, none on the
    scaleless icefish). The head is scaleless skin with fine pores; the gill cover is a smooth
    plate; a lateral line of pores runs along the upper flank. Normal relief is gentler (1.2, was
    2.0) and roughness varies with the scales.

The runtime contract is unchanged: `<Root>` > Body, Median_Fins, Eyes_Gills_Mouth, Pectoral_Left /
Pectoral_Right (pivots), Stroke_Left / Stroke_Right morphs, *_LOD1 levels; the root names, authored
sizes and asset files are the same, so instancing, AI, schooling, the catalog and aquarium
customization behave as before. The Pass 065/066 scripts stay in place for rollback.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass065'))
sys.path.insert(0, str(HERE.parent / 'pass066'))
import hero_fish as hf  # noqa: E402
import roster  # noqa: E402

N = hf.N
TAU = np.pi * 2
smooth = hf.smooth


# ------------------------------------------------------------------ anatomy with separate outlines


class Anatomy(hf.Anatomy):
    """Half-heights from separate dorsal and ventral outlines: the section's centre and half-height
    are derived from them, so every consumer (fins, eyes, painters) stays consistent."""

    def __init__(self, spec):
        super().__init__(spec)
        mk = lambda pts: PchipInterpolator(*zip(*pts))  # noqa: E731
        self._top = mk(spec['top']) if 'top' in spec else None
        self._bot = mk(spec['bot']) if 'bot' in spec else None

    def top(self, s):
        return self._top(np.clip(s, 0, 1)) * self.spec['hm']

    def bot(self, s):
        return self._bot(np.clip(s, 0, 1)) * self.spec['hm']

    def H(self, s):
        if self._top is None:
            return super().H(s)
        return np.maximum((self.top(s) + self.bot(s)) / 2, 0.0015)

    def C(self, s):
        if self._top is None:
            return super().C(s)
        return self._m(np.clip(s, 0, 1)) * self.spec['hm'] + (self.top(s) - self.bot(s)) / 2


# ------------------------------------------------------------------ body with a real mouth


_builder_body_mesh = hf.body_mesh


def body_mesh(an: Anatomy):
    p, faces, uv = _builder_body_mesh(an)
    spec = an.spec
    m = spec.get('mouth_shape')
    if not m:
        return p, faces, uv
    # The builder's shallow groove lies inside the deeper gape cut here.
    rows, cols = 72, 40
    s = 1 - (1 - np.linspace(0, 1, rows)) ** 1.15
    th = np.linspace(0, TAU, cols, endpoint=False)
    S, T = np.meshgrid(s, th, indexing='ij')
    sm, tm = S.ravel(), T.ravel()
    n = rows * cols
    q = p[:n]
    start = spec['mouth']
    # The gape line: from the mouth's corner forward to the snout, at its height on the head,
    # rising (oblique) toward the tip.
    t = np.clip((sm - start) / max(1 - start, 1e-3), 0, 1)
    gy = an.C(sm) + (m.get('y', -0.12) + m.get('tilt', 0.3) * t * 0.5) * an.H(sm)
    flank = smooth(0.1, 0.35, np.abs(np.sin(tm)))
    inside = smooth(start - 0.004, start + 0.02, sm) * flank
    d = np.abs(q[:, 1] - gy) / (an.H(sm) + 1e-6)
    gape = smooth(0.07, 0.0, d) * inside
    lip = (smooth(0.04, 0.09, d) * smooth(0.2, 0.1, d)) * inside
    side = np.sign(q[:, 2])
    w = an.W(sm)
    q[:, 2] -= side * gape * m.get('depth', 0.45) * w
    q[:, 2] += side * lip * m.get('lips', 0.25) * 0.35 * w
    p[:n] = q
    return p, faces, uv


# ------------------------------------------------------------------ pectoral shapes


def pectoral(an: Anatomy, side):
    spec, hm = an.spec, an.spec['hm']
    pc = spec['pectoral']
    shape = pc.get('shape', 'fan')
    s = pc['s']
    pivot = np.array([an.x(s), an.C(s) + pc['y'] * an.H(s), side * an.W(s) * 0.9])
    ln = pc['len'] * hm
    root = {'falcate': 0.18, 'wing': 0.32, 'rounded': 0.34}.get(shape, 0.25)

    def base(u):
        return np.stack([np.zeros_like(u), (u - 0.5) * root * ln, np.zeros_like(u)], 1)

    def edge(u):
        a = (u - 0.5) * 1.6  # fan angle: upper rays at u -> 1
        if shape == 'falcate':  # sickle: long, pointed upper rays, short lower ones
            r = ln * (0.35 + 0.95 * smooth(-0.55, 0.7, a) ** 1.4)
            sweep = 0.55
        elif shape == 'wing':  # labriform: broad, the upper edge longest, a straight trailing edge
            r = ln * (0.55 + 0.5 * smooth(-0.8, 0.8, a))
            sweep = 0.45
        elif shape == 'rounded':  # broad paddle with a rounded margin
            r = ln * (0.86 + 0.14 * np.cos(a * 1.1))
            a = a * 1.25
            sweep = 0.3
        else:  # fan
            r = ln * (0.8 + 0.25 * np.cos(a * 1.4))
            sweep = 0.35
        return np.stack([-r * np.cos(a), r * np.sin(a) * 0.7, side * r * sweep * np.ones_like(u)], 1)
    p, f, uv = hf.membrane(base, edge, spec['rays']['pectoral'], 0.018 * hm, normal=(0, 0, 1))
    return pivot, p, f, uv


# ------------------------------------------------------------------ skin


def hash2(i, j, seed):
    h = np.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453
    return h - np.floor(h)


def hero_colour(name, S, T, x, y, yn, an, broad):
    """The three Pass 065 heroes' pigmentation (their painters lived inside the old texture)."""
    spec = an.spec
    if name == 'chromis':
        # A deeper blue-green back than Pass 065 (.28 .58 .66): the old bump grid darkened the back
        # by shading; with natural scales the countershading itself carries the school's contrast.
        back, flank, belly = np.array([.16, .42, .52]), np.array([.42, .76, .7]), np.array([.86, .95, .9])
        col = flank + (back - flank) * smooth(0.15, 0.85, yn)[..., None] + (belly - flank) * smooth(-0.1, -0.85, yn)[..., None]
        return col * (1 + broad * 0.025)[..., None]
    if name == 'clownfish':
        orange, white, black = np.array([.95, .47, .13]), np.array([.97, .96, .92]), np.array([.05, .04, .04])
        col = np.tile(orange, (N, N, 1)).astype(float)
        col = col * (1 - 0.1 * smooth(0.3, 1, yn))[..., None]
        for centre, half in [(.79 + .02 * yn, .045), (.5 + .045 * np.clip(yn, 0, 1), .05), (.12, .032)]:
            dist = np.abs(S - centre)
            inner = smooth(half + .004, half - .004, dist)
            outer = smooth(half + .019, half + .011, dist)
            col = col * (1 - outer[..., None]) + black * outer[..., None]
            col = col * (1 - inner[..., None]) + white * inner[..., None]
        return col
    violet, gold = np.array([.62, .22, .74]), np.array([.98, .76, .1])
    t = smooth(0.40, 0.52, S + 0.03 * np.sin(T * 3) * 0.3)
    col = gold * (1 - t[..., None]) + violet * t[..., None]
    e = spec['eye']
    ly = an.C(S) + (e['y'] + (S - e['s']) * 1.6) * an.H(S)
    line = smooth(0.012, 0.004, np.abs(y - ly)) * (S > e['s'] - 0.02) * (np.abs(np.sin(T)) > 0.2)
    col = col * (1 - line[..., None]) + np.array([.04, .03, .05]) * line[..., None]
    return col * (1 - 0.12 * smooth(0.4, 1, yn))[..., None]


def body_texture(name, an: Anatomy):
    spec = an.spec
    v, u = np.mgrid[0:N, 0:N] / N
    S, T = u, v * TAU
    y, z = an.section(S, T)
    x = an.x(S)
    yn = (y - an.C(S)) / an.H(S)

    def noise(scale, seed):
        r = np.random.default_rng(seed)
        f = np.fft.fft2(r.standard_normal((N, N)))
        fy, fx = np.meshgrid(np.fft.fftfreq(N), np.fft.fftfreq(N), indexing='ij')
        k = np.exp(-((np.hypot(fx, fy) * scale) ** 2))
        out = np.real(np.fft.ifft2(f * k))
        return (out - out.mean()) / (out.std() + 1e-9)

    broad = noise(40, 1)
    if 'paint' in spec:
        col = spec['paint'](S=S, T=T, x=x, y=y, yn=yn, an=an, noise=noise, smooth=smooth)
    else:
        col = hero_colour(name, S, T, x, y, yn, an, broad)

    sk = spec.get('skin', {})
    kind = sk.get('kind', 'scaled')
    gill = spec['gill']
    head = smooth(gill - 0.012, gill + 0.018, S)  # 1 on the head (scaleless)
    flank = np.abs(np.sin(T)) > 0.3
    # ---- scales: imbricate rows in the body's flow, sized per species.
    # Physical cell, at least ~8 texels along the body so big fish do not alias into noise.
    cell = max(spec['hm'] * sk.get('scale', 0.11), 8 * an.L / N)
    # Along the body: physical x. Around it: the section's normalised height times a mean
    # half-height, so rows converge toward the narrow peduncle and the belly.
    Hm = float(np.mean(an.H(np.linspace(0.2, 0.8, 9))))
    gu = x / cell
    gv = yn * Hm / (cell * 0.78)
    row = np.floor(gv)
    best = np.full(S.shape, -1e9)
    vis_d = np.ones(S.shape)
    for dr in (-1, 0, 1):
        r = row + dr
        for dc in (-1, 0, 1, 2):
            c = np.floor(gu + 0.5 * (r % 2)) + dc
            cx = c - 0.5 * (r % 2) + 0.5 + (hash2(c, r, 1) - 0.5) * 0.24
            cy = r + 0.5 + (hash2(c, r, 2) - 0.5) * 0.2
            rad = 0.78 * (0.9 + 0.2 * hash2(c, r, 3))
            d = np.hypot(gu - cx, (gv - cy) * 1.1) / rad
            cover = d < 1
            # The most headward scale covering a point is the one seen (roof-tile overlap).
            take = cover & (cx > best)
            best = np.where(take, cx, best)
            vis_d = np.where(take, d, vis_d)
    exposed = 0.55 + 0.45 * (1 - vis_d ** 2)  # domed, stepping down at its posterior margin
    margin = smooth(0.82, 1.0, vis_d)  # the free edge
    depth = sk.get('depth', 0.7) * (kind != 'naked')
    scaled = (1 - head) * depth
    # Lateral line: a row of pores along the upper flank, arching down to the peduncle.
    ll_y = 0.42 + 0.18 * smooth(0.25, 0.75, S) - 0.25 * smooth(0.35, 0.05, S)
    ll = smooth(0.035, 0.01, np.abs(yn - ll_y)) * flank * (1 - head) * (S > 0.06)
    pores_ll = ll * (np.sin(gu * TAU) * 0.5 + 0.5) ** 4
    # Head: fine pores and soft skin; the gill cover a smooth plate with a faint preopercle groove.
    pores = noise(1.6, 77)
    gill_edge = gill - 0.035 * (1 - np.clip(yn, -1, 1) ** 2)
    gill_line = smooth(0.006, 0.0, np.abs(S - gill_edge)) * (np.abs(yn) < 0.85) * flank
    preop = smooth(0.005, 0.0, np.abs(S - (gill_edge + 0.045))) * (np.abs(yn) < 0.6) * flank * 0.5
    height = (exposed * scaled
              + head * (0.03 * pores - 0.25 * preop)
              - 0.35 * pores_ll
              + broad * 0.03)
    # Pigment: a little darker at scale margins (species ink), paler exposed fields; the gill line.
    ink = sk.get('ink', 0.05) * margin * scaled
    col = col * (1 - ink - 0.12 * gill_line)[..., None] * (1 + 0.02 * (exposed - 0.75) * scaled)[..., None]
    col = col * (1 - 0.12 * ll)[..., None]
    rough = (spec.get('rough', 0.42) + 0.05 * margin * scaled - 0.03 * head + 0.025 * broad
             + 0.05 * gill_line)
    ao = 1 - 0.15 * gill_line - 0.12 * margin * scaled
    return np.clip(col, 0, 1), height, np.clip(rough, 0.05, 1), np.clip(ao, 0, 1)


def fin_texture(name, spec=None):
    """Branching fin rays (each ray forks over its outer half), clearer membrane between them."""
    v, u = np.mgrid[0:N, 0:N] / N
    n = (spec or {}).get('rays', {}).get('dorsal', 22)
    near = np.abs(np.cos(np.pi * n * u)) ** 10
    far = np.abs(np.cos(np.pi * 2 * n * u)) ** 14
    fork = smooth(0.45, 0.65, v)
    rays = near * (1 - fork) + far * fork * 0.8
    fin = (spec or {}).get('fin') or {}
    colour = np.array(fin.get('color', (.8, .8, .75)), float)
    col = colour * (1 - 0.18 * rays[..., None]) * (1 - 0.05 * v[..., None])
    if 'edge' in fin:
        band = smooth(fin.get('edge_at', 0.84), fin.get('edge_at', 0.84) + 0.06, v)
        col = col * (1 - band[..., None]) + np.array(fin['edge'], float) * band[..., None]
    alpha = fin.get('alpha', 0.85) - fin.get('fade', 0.35) * v ** 1.2 + 0.14 * rays - 0.06 * (1 - rays) * v
    return np.clip(np.concatenate([col, np.clip(alpha, 0.2, 1)[..., None]], -1), 0, 1)


def write_textures(name, an):
    from PIL import Image  # noqa: PLC0415
    hf.TEX.mkdir(parents=True, exist_ok=True)
    col, height, rough, ao = body_texture(name, an)
    save = lambda a, f: Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(hf.TEX / f, optimize=True)  # noqa: E731
    stem = f'p090-{name}-skin'
    save(col, f'{stem}-base.png')
    save(hf.normal_from_height(height, 1.2) * 0.5 + 0.5, f'{stem}-normal.png')
    save(np.stack([ao, rough, np.zeros_like(rough)], -1), f'{stem}-orm.png')
    save(fin_texture(name, an.spec), f'p090-{name}-fin-fins.png')
    return stem


# ------------------------------------------------------------------ species (s: 0 tail root .. 1 snout tip)


def P(*pts):
    return list(pts)


ANATOMY = {
    # Damsels and basslets: compact, compressed; species heads and mouths.
    'chromis': dict(
        top=P((0, .1), (.1, .16), (.3, .6), (.5, .92), (.62, 1.0), (.75, .95), (.86, .75), (.94, .45), (1, .12)),
        bot=P((0, .1), (.1, .15), (.3, .55), (.5, .85), (.62, .9), (.75, .82), (.86, .62), (.94, .35), (1, .1)),
        mouth=.955, mouth_shape=dict(y=-.05, tilt=.5, lips=.2), pectoral=dict(s=.7, y=-.22, len=.5, shape='fan'),
        skin=dict(scale=.12, depth=.75, ink=.05),
        # The heroes' fin colours lived in the Pass 065 fin painter; carried over here.
        fin=dict(color=(.62, .86, .82), alpha=.78, fade=.45)),
    'clownfish': dict(
        top=P((0, .17), (.1, .27), (.3, .72), (.5, .97), (.62, 1.0), (.75, .95), (.86, .82), (.94, .58), (1, .2)),
        bot=P((0, .17), (.1, .26), (.3, .66), (.5, .9), (.62, .92), (.75, .85), (.86, .7), (.94, .45), (1, .14)),
        mouth=.955, mouth_shape=dict(y=-.08, tilt=.4, lips=.35),
        pectoral=dict(s=.69, y=-.2, len=.46, shape='rounded'), skin=dict(scale=.08, depth=.55, ink=.03),
        fin=dict(color=(.95, .5, .14), edge=(.05, .04, .04), edge_at=.84, alpha=.92, fade=.25)),
    'gramma': dict(
        top=P((0, .2), (.1, .32), (.3, .72), (.5, .95), (.65, 1.0), (.78, .9), (.87, .7), (.94, .46), (1, .16)),
        bot=P((0, .2), (.1, .3), (.3, .62), (.5, .82), (.65, .86), (.8, .76), (.9, .52), (.97, .22), (1, .06)),
        mouth=.93, mouth_shape=dict(y=-.02, tilt=.9, lips=.25), pectoral=dict(s=.72, y=-.18, len=.48, shape='fan'),
        skin=dict(scale=.1, depth=.7, ink=.05), fin=dict(color=(.98, .8, .16), alpha=.86, fade=.35)),
    'assessor': dict(
        top=P((0, .22), (.1, .34), (.3, .74), (.5, .96), (.65, 1.0), (.78, .9), (.87, .7), (.94, .46), (1, .16)),
        bot=P((0, .22), (.1, .33), (.3, .68), (.5, .86), (.65, .88), (.8, .8), (.9, .6), (.97, .3), (1, .18)),
        mouth=.915, mouth_shape=dict(y=.02, tilt=1.0, lips=.3), pectoral=dict(s=.71, y=-.2, len=.5, shape='rounded'),
        pelvic=dict(s=.7, len=.6), skin=dict(scale=.1, depth=.7, ink=.05)),
    'cardinalfish': dict(
        top=P((0, .13), (.08, .2), (.25, .62), (.45, .95), (.58, 1.0), (.72, .92), (.84, .7), (.93, .42), (1, .12)),
        bot=P((0, .13), (.08, .2), (.25, .6), (.45, .9), (.58, .95), (.72, .86), (.84, .65), (.93, .4), (1, .2)),
        mouth=.895, mouth_shape=dict(y=0, tilt=1.1, lips=.35, depth=.5), eye=dict(s=.875, y=.3, r=.24),
        pectoral=dict(s=.7, y=-.18, len=.5, shape='fan'), pelvic=dict(s=.67, len=.6),
        skin=dict(scale=.14, depth=.8, ink=.08)),
    'firefish': dict(
        top=P((0, .25), (.15, .5), (.4, .88), (.6, 1.0), (.78, .95), (.9, .75), (.97, .42), (1, .14)),
        bot=P((0, .25), (.15, .5), (.4, .85), (.6, .95), (.78, .9), (.9, .7), (.97, .45), (1, .24)),
        mouth=.955, mouth_shape=dict(y=.12, tilt=1.3, lips=.15), pectoral=dict(s=.72, y=-.15, len=.42, shape='fan'),
        skin=dict(scale=.07, depth=.4, ink=.02)),
    # Butterflyfish and idols: deep compressed discs with species snouts.
    'butterflyfish': dict(
        top=P((0, .12), (.07, .2), (.2, .62), (.38, .96), (.52, 1.0), (.66, .9), (.76, .68), (.84, .42), (.9, .24),
              (.95, .15), (1, .08)),
        bot=P((0, .12), (.07, .2), (.2, .6), (.38, .92), (.52, .95), (.66, .85), (.76, .62), (.84, .36), (.9, .18),
              (.95, .11), (1, .06)),
        width=P((0, .18), (.12, .3), (.3, .7), (.55, 1.0), (.8, .8), (.9, .45), (.96, .3), (1, .12)),
        mouth=.975, mouth_shape=dict(y=0, tilt=.2, lips=.15, depth=.35), eye=dict(s=.8, y=.25, r=.13),
        pectoral=dict(s=.66, y=-.15, len=.42, shape='fan'), skin=dict(scale=.09, depth=.55, ink=.04)),
    'bannerfish': dict(
        top=P((0, .13), (.07, .22), (.2, .7), (.4, 1.05), (.55, 1.1), (.68, .95), (.8, .62), (.88, .36), (.95, .18),
              (1, .08)),
        bot=P((0, .13), (.07, .2), (.2, .5), (.4, .75), (.55, .78), (.68, .7), (.8, .5), (.88, .3), (.95, .14),
              (1, .07)),
        width=P((0, .18), (.12, .3), (.3, .7), (.55, 1.0), (.8, .82), (.9, .5), (.96, .32), (1, .12)),
        mouth=.97, mouth_shape=dict(y=0, tilt=.2, lips=.15, depth=.35), eye=dict(s=.82, y=.22, r=.13),
        pectoral=dict(s=.66, y=-.15, len=.44, shape='fan'), skin=dict(scale=.09, depth=.55, ink=.04)),
    'idol': dict(
        top=P((0, .1), (.06, .18), (.2, .72), (.36, 1.1), (.5, 1.15), (.62, .95), (.72, .6), (.8, .3), (.86, .16),
              (.93, .12), (1, .09)),
        bot=P((0, .1), (.06, .18), (.2, .6), (.36, .88), (.5, .9), (.62, .75), (.72, .45), (.8, .22), (.86, .12),
              (.93, .09), (1, .07)),
        width=P((0, .18), (.12, .3), (.3, .7), (.5, 1.0), (.7, .7), (.8, .42), (.9, .3), (1, .18)),
        mouth=.985, mouth_shape=dict(y=0, tilt=.1, lips=.1, depth=.3), eye=dict(s=.74, y=.28, r=.13),
        pectoral=dict(s=.62, y=-.12, len=.4, shape='falcate'), skin=dict(scale=.06, depth=.3, ink=.02)),
    # Tang: oval, steep forehead, small low mouth, narrow peduncle.
    'bluetang': dict(
        top=P((0, .1), (.06, .14), (.18, .42), (.35, .8), (.52, .97), (.65, 1.0), (.77, .9), (.87, .7), (.94, .42),
              (1, .12)),
        bot=P((0, .1), (.06, .14), (.18, .42), (.35, .78), (.52, .92), (.65, .92), (.77, .82), (.87, .58), (.94, .3),
              (1, .05)),
        mouth=.97, mouth_shape=dict(y=-.3, tilt=.2, lips=.15, depth=.35), eye=dict(s=.85, y=.28, r=.15),
        pectoral=dict(s=.7, y=-.15, len=.6, shape='falcate'), skin=dict(kind='fine', scale=.05, depth=.15, ink=0)),
    # Elongate cold-water fish.
    'icefish': dict(
        top=P((0, .24), (.15, .45), (.35, .8), (.55, 1.0), (.7, .92), (.8, .7), (.88, .42), (.95, .26), (1, .12)),
        bot=P((0, .24), (.15, .45), (.35, .8), (.55, .95), (.7, .86), (.8, .66), (.88, .38), (.95, .24), (1, .14)),
        mouth=.8, mouth_shape=dict(y=-.05, tilt=.2, lips=.2, depth=.5),
        pectoral=dict(s=.7, y=-.1, len=1.0, shape='rounded'), skin=dict(kind='naked', depth=0, ink=0)),
    'notothen': dict(
        top=P((0, .25), (.15, .5), (.35, .85), (.55, 1.0), (.72, 1.0), (.82, .88), (.9, .68), (.96, .44), (1, .2)),
        bot=P((0, .25), (.15, .48), (.35, .8), (.55, .92), (.72, .9), (.84, .8), (.93, .6), (.98, .34), (1, .2)),
        width=P((0, .18), (.12, .3), (.35, .72), (.6, 1.0), (.8, 1.08), (.92, .95), (.98, .6), (1, .24)),
        mouth=.885, mouth_shape=dict(y=-.02, tilt=.5, lips=.35, depth=.5),
        pectoral=dict(s=.7, y=-.15, len=1.0, shape='rounded'), skin=dict(scale=.09, depth=.55, ink=.06)),
    'toothfish': dict(
        top=P((0, .22), (.15, .46), (.35, .82), (.55, 1.0), (.7, .96), (.8, .8), (.88, .6), (.95, .36), (1, .14)),
        bot=P((0, .22), (.15, .46), (.35, .8), (.55, .94), (.72, .9), (.85, .74), (.93, .5), (.98, .3), (1, .18)),
        mouth=.85, mouth_shape=dict(y=-.04, tilt=.6, lips=.3, depth=.5),
        pectoral=dict(s=.7, y=-.15, len=.7, shape='fan'), skin=dict(scale=.07, depth=.5, ink=.05)),
    # Robust reef fish, each its own outline.
    'napoleon': dict(
        # Deep oblong body under a pronounced forehead hump, thick fleshy lips.
        top=P((0, .18), (.1, .3), (.3, .72), (.5, .95), (.65, 1.0), (.77, 1.06), (.85, 1.04), (.91, .82),
              (.96, .52), (1, .24)),
        bot=P((0, .18), (.1, .3), (.3, .66), (.5, .86), (.65, .88), (.78, .8), (.87, .62), (.93, .42), (.97, .26),
              (1, .16)),
        mouth=.935, mouth_shape=dict(y=-.06, tilt=.4, lips=1.0, depth=.5),
        pectoral=dict(s=.7, y=-.1, len=.6, shape='wing'), skin=dict(scale=.07, depth=.8, ink=.12)),
    'seabass': dict(
        # Heavy, the deepest point mid-body, a long straight wedge of a head to a huge underslung jaw.
        top=P((0, .16), (.1, .28), (.3, .7), (.48, .95), (.6, 1.0), (.72, .95), (.79, .78), (.86, .6), (.93, .4),
              (1, .16)),
        bot=P((0, .16), (.1, .28), (.3, .68), (.48, .92), (.6, .96), (.72, .9), (.8, .82), (.88, .68), (.95, .5),
              (1, .32)),
        width=P((0, .18), (.12, .3), (.3, .7), (.55, 1.0), (.8, 1.0), (.92, .8), (.98, .52), (1, .24)),
        mouth=.86, mouth_shape=dict(y=.02, tilt=.8, lips=.45, depth=.55),
        pectoral=dict(s=.7, y=-.18, len=.62, shape='rounded'), skin=dict(scale=.06, depth=.6, ink=.08)),
    'parrotfish': dict(
        # Oblong, a blunt rounded head ending in a short protruding beak (fused teeth).
        top=P((0, .15), (.1, .26), (.3, .66), (.5, .9), (.65, .98), (.78, .97), (.87, .84), (.93, .62), (.965, .4),
              (.985, .3), (1, .2)),
        bot=P((0, .15), (.1, .26), (.3, .62), (.5, .85), (.65, .9), (.78, .86), (.87, .72), (.93, .5), (.965, .32),
              (.985, .24), (1, .16)),
        width=P((0, .18), (.12, .3), (.3, .7), (.55, 1.0), (.8, .95), (.92, .74), (.98, .5), (1, .3)),
        mouth=.975, mouth_shape=dict(y=-.02, tilt=.1, lips=.1, depth=.45),
        pectoral=dict(s=.71, y=-.1, len=.6, shape='wing'), skin=dict(scale=.11, depth=.9, ink=.12)),
    'sheephead': dict(
        # Elongate, the forehead humped well forward, falling steeply to a strong, toothy jaw.
        top=P((0, .16), (.1, .26), (.3, .62), (.5, .85), (.65, .92), (.77, .98), (.85, .96), (.91, .8), (.96, .52),
              (1, .24)),
        bot=P((0, .16), (.1, .25), (.3, .58), (.5, .78), (.65, .8), (.77, .74), (.86, .6), (.93, .44), (1, .22)),
        mouth=.94, mouth_shape=dict(y=-.04, tilt=.3, lips=.4, depth=.5),
        pectoral=dict(s=.71, y=-.12, len=.58, shape='wing'), skin=dict(scale=.08, depth=.6, ink=.06)),
    'trevally': dict(
        # Jack: a hair-thin peduncle, deep convex belly, a steep rounded forehead to a blunt snout.
        top=P((0, .06), (.05, .08), (.15, .3), (.35, .8), (.55, 1.0), (.68, .98), (.78, .88), (.86, .7), (.92, .5),
              (.97, .28), (1, .1)),
        bot=P((0, .06), (.05, .08), (.15, .28), (.4, .85), (.55, .98), (.7, .95), (.82, .8), (.9, .6), (.96, .35),
              (1, .1)),
        mouth=.94, mouth_shape=dict(y=-.04, tilt=.5, lips=.2, depth=.45),
        pectoral=dict(s=.7, y=-.1, len=.9, shape='falcate'), skin=dict(kind='fine', scale=.05, depth=.16, ink=0)),
}


def species():
    """The full specs: the Pass 065 heroes and Pass 066 roster, with this pass's anatomy over them."""
    out = {}
    base = {**hf.SPECIES, **roster.ROSTER}
    for name, extra in ANATOMY.items():
        spec = dict(base[name])
        for key, value in extra.items():
            if key in ('pectoral', 'pelvic', 'eye') and key in spec:
                spec[key] = {**spec[key], **value}
            else:
                spec[key] = value
        out[name] = spec
    return out


def install():
    """Point the shared builder at this pass's anatomy, body, pectorals and skin."""
    hf.Anatomy = Anatomy
    hf.body_mesh = body_mesh
    hf.pectoral = pectoral
    hf.write_textures = write_textures
    hf.TEX = hf.ROOT / 'tools/art/textures/pass090'
    hf.HERE, hf.RAW = HERE, HERE / 'out'
    specs = species()
    hf.SPECIES.clear()
    hf.SPECIES.update(specs)
    # The builder names the fin map `p065-<name>-fin-fins.png`; use this pass's map instead.
    pbr = hf.ca.pbr_material

    def pbr_material(*args, paths=None, **kwargs):
        if paths and 'base' in paths:
            p = Path(paths['base'])
            paths = {**paths, 'base': p.with_name(p.name.replace('p065-', 'p090-'))}
        return pbr(*args, paths=paths, **kwargs)
    hf.ca.pbr_material = pbr_material


if __name__ == '__main__':
    install()
    for n in (sys.argv[1:] or list(ANATOMY)):
        hf.build(n)
