"""V0.7 Pass 067: large marine creatures on the Crafted Stylized Realism standard.

    python3 tools/art/pass067/creatures.py [species ...]   # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs public/assets/models
    python3 tools/art/inspect_assets.py

The runtime contract is unchanged: `<Root>` > `Body` (one mesh, one material) and `Body_LOD1`, with
`Stroke_Left` / `Stroke_Right` morphs that the creature systems (SoloCreature, visitors, cruisers)
drive from swimming effort. Every species keeps its root name and authored size, so movement
paths, encounters, sightings and avoidance are untouched.

Construction, in game space (+X head, +Y up, +Z left), merged into one continuous `Body`:
  * a superellipse loft from species profiles (the Pass 065 hero-fish anatomy), with a buried
    eye bulge; fins and flippers are membranes with real thickness rooted inside the body;
  * one 512 px texture atlas: the body in the lower three quarters of UV space (painted from each
    point's position, so markings follow anatomy), fins in the top band;
  * the stroke field per locomotion: lateral S-bend (sharks, barracuda), dorso-ventral fluke beat
    (whale), wing flap (rays), fore-flipper sweep (turtle), dorsal/anal sculling (sunfish).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy  # noqa: I001
import bmesh
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/v07'))
sys.path.insert(0, str(ROOT / 'tools/art/pass065'))
sys.path.insert(0, str(ROOT / 'tools/art/pass017'))
import cozy_art as ca  # noqa: E402
import hero_fish as hf  # noqa: E402

TEX = ROOT / 'tools/art/textures/pass067'  # pass 068 animals share it (prefix p068)
OUT = ROOT / 'public/assets/models/creatures'
RAW = HERE / 'out'
N = 512
TAU = math.tau
smooth = hf.smooth
BODY_V = 0.75  # body occupies UV v in [0, 0.75]; fins the band above
# The body's wrap seam runs along the back: keep it off the band edges so mipmaps don't bleed the fin
# band (or the image edge) into it; the gutters repeat the dorsal colour.
GUT = 0.025


# ------------------------------------------------------------------ parts


class Part:
    def __init__(self, p, f, uv, kind, weight=None):
        self.p, self.f, self.uv, self.kind = np.asarray(p, float), list(f), np.asarray(uv, float), kind
        self.weight = np.ones(len(self.p)) if weight is None else weight


def loft(an: hf.Anatomy, rows=64, cols=36, eye=True):
    spec = an.spec
    s = np.linspace(0, 1, rows)
    # cols + 1 columns: the last repeats the first (T = 2 pi) with its own UVs, so no face wraps
    # the whole body band; `build` merges the duplicate positions once the morphs are made.
    th = np.linspace(0, TAU, cols + 1)
    S, T = np.meshgrid(s, th, indexing='ij')
    y, z = an.section(S, T)
    z[:, -1], y[:, -1] = z[:, 0], y[:, 0]
    p = np.stack([an.x(S), y, z], -1).reshape(-1, 3)
    if eye and 'eye' in spec:
        e = spec['eye']
        ex, ey = an.x(e['s']), an.C(e['s']) + e['y'] * an.H(e['s'])
        er = e['r'] * spec['hm']
        d = np.hypot(p[:, 0] - ex, p[:, 1] - ey) / er
        p[:, 2] += np.sign(p[:, 2]) * 0.18 * er * smooth(1.0, 0.0, d) * (np.abs(p[:, 2]) > 0.2 * an.W(e['s']))
    uv = np.stack([S.ravel(), GUT + (T / TAU).ravel() * (BODY_V - 2 * GUT)], 1)
    faces = hf.grid_faces(rows, cols, closed=False)
    tip = len(p)
    p = np.vstack([p, [[an.x_snout + 0.004 * spec['body'], an.C(1), 0], [an.x_root - 0.002, an.C(0), 0]]])
    uv = np.vstack([uv, [[1, BODY_V / 2], [0, BODY_V / 2]]])
    last = (rows - 1) * (cols + 1)
    faces += [(last + j, last + j + 1, tip) for j in range(cols)]
    faces += [(j + 1, j, tip + 1) for j in range(cols)]
    return Part(p, faces, uv, 'body')


def fin(base, edge, rays, thickness, slot, kind='fin', normal=(0, 0, 1), v_steps=5):
    """A thick membrane mapped into fin slot `slot` (0..7) of the atlas's fin band."""
    p, f, uv = hf.membrane(base, edge, rays, thickness, v_steps=v_steps, normal=normal)
    uv = np.stack([(slot + uv[:, 0]) / 8, BODY_V + 0.02 + uv[:, 1] * 0.22], 1)
    return Part(p, f, uv, kind)


def line(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    return lambda u: a[None, :] * (1 - u[:, None]) + b[None, :] * u[:, None]


def on_back(an, s0, s1, sign=1, inset=0.85):
    def f(u):
        s = s1 - (s1 - s0) * u
        return np.stack([an.x(s), an.C(s) + sign * an.H(s) * inset, np.zeros_like(s)], 1)
    return f


# ------------------------------------------------------------------ families


def shark_parts(an: hf.Anatomy):
    sp, hm, L = an.spec, an.spec['hm'], an.spec['body']
    th = 0.035 * hm
    parts = [loft(an)]
    # First dorsal: a tall triangle with a falcate trailing edge.
    d = sp['dorsal1']
    b = on_back(an, d['s'][0], d['s'][1])

    def d_edge(u, b=b, d=d):
        base = b(u)
        h = d['h'] * hm * (np.clip(1 - np.abs(u - d['peak']) / max(d['peak'], 1 - d['peak']), 0, 1) ** d.get('sharp', 1.2))
        return base + np.stack([-d['rake'] * h, h, 0 * h], 1)
    parts.append(fin(b, d_edge, 10, th * 1.6, 0))
    for key, sign, slot in (('dorsal2', 1, 1), ('anal', -1, 2)):
        if key in sp:
            d2 = sp[key]
            b2 = on_back(an, d2['s'][0], d2['s'][1], sign)

            def e2(u, b2=b2, d2=d2, sign=sign):
                base = b2(u)
                h = d2['h'] * hm * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8
                return base + np.stack([-0.6 * h, sign * h, 0 * h], 1)
            parts.append(fin(b2, e2, 6, th, slot))
    # Heterocercal caudal: the upper lobe long and raised, the lower lobe short.
    lc = sp['caudal']
    r0, y0 = an.x(0.02), an.C(0)
    hroot = an.H(0) * 0.9

    def cbase(u):
        return np.stack([np.full_like(u, r0), y0 + (u - 0.5) * 2 * hroot, np.zeros_like(u)], 1)

    def cedge(u):
        k = (u - 0.5) * 2
        up = sp.get('upper', 1.0)
        lower = sp.get('lower', 0.55)
        back = np.where(k > 0, lc * (0.35 + 0.65 * k ** 0.9), lc * (0.3 + 0.35 * np.abs(k)))
        y = np.where(k > 0, y0 + k * lc * 0.55 * up, y0 + k * lc * 0.42 * lower)
        notch = np.where(np.abs(k) < 0.25, lc * 0.12 * (1 - np.abs(k) / 0.25), 0)
        return np.stack([r0 - back + notch, y, np.zeros_like(u)], 1)
    parts.append(fin(cbase, cedge, 12, th * 1.4, 3, kind='caudal'))
    # Pectorals: big horizontal planes (thickness along Y), swept back.
    pc = sp['pectoral']
    for side in (-1, 1):
        s = pc['s']
        px, py, pz = an.x(s), an.C(s) - 0.45 * an.H(s), side * an.W(s) * 0.7
        ln = pc['len']
        bp = line((px + 0.12 * ln, py, pz), (px - 0.25 * ln, py, pz))

        def ep(u, px=px, py=py, pz=pz, side=side, ln=ln):
            tip_x = px - ln * pc.get('sweep', 0.55)
            x = (px + 0.1 * ln) * (1 - u) ** 2 + 2 * (1 - u) * u * (tip_x + 0.1 * ln) + u ** 2 * (px - 0.3 * ln)
            z = pz + side * ln * np.sin(np.pi * np.clip(u * 0.8 + 0.2, 0, 1)) ** 0.6 * 0.95
            return np.stack([x, py - 0.18 * ln * np.sin(np.pi * u) - 0.1 * ln * u, z], 1)
        parts.append(fin(bp, ep, 8, th * 1.3, 4, kind='pectoral', normal=(0, 1, 0)))
    # Pelvics.
    pv = sp.get('pelvic_s', 0.38)
    for side in (-1, 1):
        px, py, pz = an.x(pv), an.C(pv) - 0.85 * an.H(pv), side * an.W(pv) * 0.3
        ln = 0.35 * hm * 2
        parts.append(fin(line((px, py, pz), (px - 0.4 * ln, py, pz)),
                         line((px - 0.25 * ln, py - 0.45 * ln, pz + side * 0.4 * ln), (px - 0.9 * ln, py - 0.2 * ln, pz)),
                         4, th * 0.8, 5, normal=(0, 0.3, 1)))
    return parts


def ray_parts(an: hf.Anatomy):
    """Rays: a narrow body loft with broad wing membranes (thickness along Y) and a whip tail."""
    sp, hm = an.spec, an.spec['hm']
    parts = [loft(an, rows=48, cols=28)]
    span, chord = sp['span'], sp['chord']
    for side in (-1, 1):
        s0, s1 = sp['wing_s']
        def wb(u, s0=s0, s1=s1, side=side):
            s = s1 - (s1 - s0) * u
            return np.stack([an.x(s), an.C(s), side * an.W(s) * 0.8], 1)

        def we(u, s0=s0, s1=s1, side=side):
            s = s1 - (s1 - s0) * u
            # Pointed, swept-back wingtip: a near-straight leading edge out to the tip at u = ut,
            # then a concave trailing edge back to the root.
            u = np.clip(u, 0, 1)
            ut = sp.get('tip_u', 0.38)
            lead = (u / ut) ** 0.85
            trail = ((1 - u) / (1 - ut)) ** 1.8
            reach = span * np.where(u < ut, lead, trail)
            sweep = chord * 0.75 * (reach / span) ** 1.4
            return np.stack([an.x(s) - sweep, an.C(s) + 0.05 * reach * sp.get('dihedral', 0.3),
                             side * (an.W(s) * 0.8 + reach)], 1)
        parts.append(fin(wb, we, 14, hm * 0.55, 0 if side > 0 else 1, kind='wing', normal=(0, 1, 0), v_steps=8))
    # Whip tail: a thin tapering tube behind the body.
    tl = sp['tail']
    n, sides = 20, 6
    xs = np.linspace(an.x_root, an.x_root - tl, n)
    r = np.linspace(0.18 * hm, 0.02 * hm, n)
    th = np.linspace(0, TAU, sides, endpoint=False)
    X, A = np.meshgrid(np.arange(n), th, indexing='ij')
    p = np.stack([xs[X], an.C(0) + np.cos(A) * r[X], np.sin(A) * r[X]], -1).reshape(-1, 3)
    uv = np.stack([np.repeat(np.linspace(0, 1, n), sides) * 0.12 + 0.75, np.full(n * sides, BODY_V + 0.1)], 1)
    parts.append(Part(p, hf.grid_faces(n, sides, closed=True), uv, 'tail'))
    if sp.get('horns'):
        # Manta cephalic fins: two rolled lobes beside the mouth.
        for side in (-1, 1):
            hx, hz = an.x(0.97), side * an.W(0.97) * 0.95
            parts.append(fin(line((hx - 0.15 * hm * 2, an.C(1), hz), (hx, an.C(1), hz)),
                             line((hx + 0.05, an.C(1) - 0.1 * hm, hz + side * 0.05),
                                  (hx + 0.45 * hm * 2, an.C(1) - 0.05 * hm, hz + side * 0.02)),
                             4, hm * 0.3, 2, normal=(0, 0, 1)))
    return parts


def flipper(root, tip_dx, tip_dz, length, width, side, slot, kind):
    """A flattened paddle (thickness along Y) from `root` out to a tip, for turtles and whales."""
    rx, ry, rz = root
    base = line((rx + width / 2, ry, rz), (rx - width / 2, ry, rz))

    def edge(u):
        a = np.pi * u
        x = rx + tip_dx * np.sin(a) ** 0.6 + width * 0.4 * np.cos(a)
        z = rz + side * tip_dz * np.sin(a) ** 0.6
        return np.stack([x, np.full_like(u, ry), z], 1)
    return fin(base, edge, 8, width * 0.18, slot, kind=kind, normal=(0, 1, 0), v_steps=7)


def turtle_parts(an: hf.Anatomy):
    sp = an.spec
    parts = [loft(an, rows=56, cols=36)]
    L = sp['body']
    for side in (-1, 1):
        fx = an.x(0.68)
        parts.append(flipper((fx, an.C(.68) - 0.1 * an.H(.68), side * an.W(.68) * 0.8), -0.3 * L, 0.48 * L,
                             0.5 * L, 0.18 * L, side, 0, 'fore'))
        hx = an.x(0.18)
        parts.append(flipper((hx, an.C(.18) - 0.15 * an.H(.18), side * an.W(.18) * 0.75), -0.18 * L, 0.18 * L,
                             0.2 * L, 0.12 * L, side, 1, 'hind'))
    # Head and neck: a short loft continuing forward of the shell.
    head = hf.Anatomy(dict(body=0.32 * L, hm=0.11 * L, wm=0.1 * L, n=2.1, belly=0.05,
                           height=[(0, .6), (.4, .9), (.75, 1), (1, .35)],
                           width=[(0, .6), (.4, .9), (.8, 1), (1, .3)], mid=[(0, 0), (1, -.1)],
                           eye=dict(s=.72, y=.25, r=.28)))
    hp = loft(head, rows=24, cols=20)
    hp.p[:, 0] += an.x_snout - head.x_root - 0.1 * L
    hp.p[:, 1] += an.C(0.9) - 0.15 * an.H(0.9)
    hp.uv[:, 0] = 0.8 + hp.uv[:, 0] * 0.2  # the head paints from the body's front columns
    hp.kind = 'head'
    parts.append(hp)
    return parts


def whale_parts(an: hf.Anatomy):
    sp, hm, L = an.spec, an.spec['hm'], an.spec['body']
    parts = [loft(an, rows=64, cols=36)]
    for side in (-1, 1):
        s = 0.66
        parts.append(flipper((an.x(s), an.C(s) - 0.45 * an.H(s), side * an.W(s) * 0.85), -0.25 * L, sp['flipper'],
                             sp['flipper'], 0.09 * L, side, 0, 'flipper'))
    # Flukes: horizontal (thickness along Y), notched, behind the tail stock.
    span = sp['fluke']
    r0, y0 = an.x(0.02), an.C(0)
    for side in (-1, 1):
        base = line((r0, y0, 0), (r0 - 0.04 * L, y0, side * 0.02 * L))

        def edge(u, side=side):
            z = side * span * np.sin(np.pi * u / 2) ** 0.8
            x = r0 - 0.06 * L - 0.08 * L * np.sin(np.pi * u) - 0.03 * L * u
            return np.stack([x, np.full_like(u, y0), z], 1)
        parts.append(fin(base, edge, 8, hm * 0.12, 1, kind='fluke', normal=(0, 1, 0), v_steps=6))
    # Small dorsal hump.
    b = on_back(an, 0.28, 0.36)
    parts.append(fin(b, lambda u, b=b: b(u) + np.stack([-0.03 * L * u, 0.12 * hm * np.sin(np.pi * u), 0 * u], 1),
                     4, hm * 0.1, 2))
    return parts


def sunfish_parts(an: hf.Anatomy):
    sp, hm = an.spec, an.spec['hm']
    parts = [loft(an, rows=48, cols=36)]
    for key, sign, slot in (('dorsal', 1, 0), ('anal', -1, 1)):
        b = on_back(an, 0.12, 0.3, sign)

        def e(u, b=b, sign=sign):
            h = sp['fin_h'] * hm * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7
            return b(u) + np.stack([-0.35 * h, sign * h, 0 * h], 1)
        parts.append(fin(b, e, 10, hm * 0.06, slot, kind='scull'))
    # Clavus: the scalloped rudder that replaces a tail.
    r0 = an.x(0.0)
    parts.append(fin(line((r0 + 0.02, an.C(0) + hm * .9, 0), (r0 + 0.02, an.C(0) - hm * .9, 0)),
                     lambda u: np.stack([r0 - 0.16 * sp['body'] - 0.03 * sp['body'] * np.sin(u * np.pi * 7) ** 2,
                                         an.C(0) + (0.5 - u) * 2 * hm * 0.95, 0 * u], 1), 12, hm * 0.05, 2))
    for side in (-1, 1):
        s = 0.62
        parts.append(fin(line((an.x(s), an.C(s), side * an.W(s) * .9), (an.x(s) - 0.05, an.C(s), side * an.W(s) * .9)),
                         line((an.x(s) - 0.1, an.C(s) + 0.05, side * (an.W(s) + 0.06)),
                              (an.x(s) - 0.14, an.C(s) - 0.03, side * (an.W(s) + 0.05))), 4, hm * 0.04, 3))
    return parts


# ------------------------------------------------------------------ stroke fields


def stroke_field(an, part, p, sign):
    sp = an.spec
    L = sp['body'] + sp.get('caudal', 0)
    q = p.copy()
    loco = sp['loco']
    if loco in ('lateral', 'scull'):
        xs = np.clip((an.x_snout - p[:, 0]) / L, 0, 1.2)
        amp = sp.get('amp', 0.09)
        w = smooth(0.3, 1.0, xs) ** 1.5
        lateral = sp['body'] * (amp * w - 0.012 * np.sin(np.pi * smooth(0, 0.45, xs)))
        if loco == 'scull':  # sunfish: the body stays stiff, the tall fins scull
            lateral = sp['body'] * 0.012 * w
            if part.kind == 'scull':
                lateral = lateral + sign * 0 + np.abs(p[:, 1] - an.C(an.s(p[:, 0]))) * 0.35
        q[:, 2] += sign * lateral
    elif loco == 'fluke':
        xs = np.clip((an.x_snout - p[:, 0]) / L, 0, 1.2)
        w = smooth(0.45, 1.0, xs) ** 1.6
        q[:, 1] += sign * sp['body'] * 0.07 * w
    elif loco == 'flap':
        reach = np.clip(np.abs(p[:, 2]) - an.W(an.s(np.clip(p[:, 0], an.x_root, an.x_snout))) * 0.8, 0, None)
        q[:, 1] += sign * reach ** 1.3 / max(sp['span'], 1e-6) ** 0.3 * 0.38
    elif loco == 'flipper':
        if part.kind == 'fore':
            out = np.clip(np.abs(p[:, 2]) - an.W(0.68) * 0.8, 0, None)
            q[:, 1] += sign * out * 0.55
            q[:, 0] += sign * out * 0.18
        elif part.kind == 'hind':
            out = np.clip(np.abs(p[:, 2]) - an.W(0.18) * 0.75, 0, None)
            q[:, 1] -= sign * out * 0.25
    return q


# ------------------------------------------------------------------ textures


def body_texture(an: hf.Anatomy):
    sp = an.spec
    v, u = np.mgrid[0:N, 0:N] / N
    body = v < BODY_V
    S, T = u, np.clip((v - GUT) / (BODY_V - 2 * GUT), 0, 1) * TAU
    y, z = an.section(S, T)
    x = an.x(S)
    yn = (y - an.C(S)) / an.H(S)

    def noise(scale, seed):
        r = np.random.default_rng(seed)
        f = np.fft.fft2(r.standard_normal((N, N)))
        fy, fx = np.meshgrid(np.fft.fftfreq(N), np.fft.fftfreq(N), indexing='ij')
        out = np.real(np.fft.ifft2(f * np.exp(-((np.hypot(fx, fy) * scale) ** 2))))
        return (out - out.mean()) / (out.std() + 1e-9)

    col = sp['paint'](S=S, T=T, x=x, y=y, z=z, yn=yn, an=an, noise=noise, smooth=smooth)
    # Eye: dark iris with a pale ring, painted where the eye bulge sits.
    if 'eye' in sp:
        e = sp['eye']
        ex, ey, er = an.x(e['s']), an.C(e['s']) + e['y'] * an.H(e['s']), e['r'] * sp['hm']
        d = np.hypot(x - ex, y - ey) / er * (np.abs(np.sin(T)) > 0.2)
        d = np.where(np.abs(np.sin(T)) > 0.2, d, 9)
        col = col * (1 - smooth(1.1, 0.8, d)[..., None]) + np.array(sp.get('eye_col', (.05, .05, .06))) * smooth(1.1, 0.8, d)[..., None]
    # Fin band: species fin colour, optional tip colour toward the free edge.
    fv = np.clip((v - BODY_V - 0.02) / 0.22, 0, 1)
    fincol = np.array(sp['fin'], float) * (1 + 0.05 * noise(20, 7))[..., None]
    if 'tip' in sp:
        t = smooth(sp.get('tip_at', 0.7), 1.0, fv)
        fincol = fincol * (1 - t[..., None]) + np.array(sp['tip'], float) * t[..., None]
    # Per-slot colours (bills, feet, legs) override the fin colour in their eighth of the band.
    for slot, colour in sp.get('slots', {}).items():
        m = (u >= slot / 8) & (u < (slot + 1) / 8)
        fincol = np.where(m[..., None], np.array(colour, float) * (1 + 0.04 * noise(20, 8))[..., None], fincol)
    col = np.where(body[..., None], col, fincol)
    fine = noise(1.5, 11)
    broad = noise(30, 12)
    height = fine * sp.get('relief', 0.25) + broad * 0.1
    rough = sp.get('rough', 0.5) + 0.04 * broad + 0.03 * fine
    return np.clip(col, 0, 1), height, np.clip(rough, 0.3, 0.8)


def write_textures(name, an):
    TEX.mkdir(parents=True, exist_ok=True)
    col, height, rough = body_texture(an)
    # Painted with row = v; Blender's v runs bottom-up and glTF stores v' = 1 - v, so image row 0
    # must hold v = 1. Flip before saving (and before deriving normals) so the body and fin bands
    # land where the UVs read them.
    col, height, rough = col[::-1], height[::-1], rough[::-1]
    save = lambda a, f: Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(TEX / f, optimize=True)  # noqa: E731
    stem = f"p{an.spec.get('pass', '067')}-{name}-skin"
    save(col, f'{stem}-base.png')
    save(hf.normal_from_height(height, 1.2) * 0.5 + 0.5, f'{stem}-normal.png')
    save(np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], -1), f'{stem}-orm.png')
    return stem


# ------------------------------------------------------------------ assembly

FAMILIES = {'shark': shark_parts, 'ray': ray_parts, 'turtle': turtle_parts, 'whale': whale_parts,
            'sunfish': sunfish_parts}


def build(name, spec):
    an = hf.Anatomy(spec)
    parts = FAMILIES[spec['family']](an)
    stem = write_textures(name, an)
    ca.reset_scene()
    root = ca.create_root(f"{spec['root']}_Root", 'creature', species=name, standards_pass=spec.get('pass', '067'))
    skin = ca.pbr_material(f"{spec['root']}_Skin", spec.get('template', 'fish-skin'), stem, roughness=spec.get('rough', 0.5),
                           normal_strength=0.6, vertex_tint=False)
    off, P, F, UV = 0, [], [], []
    for part in parts:
        P.append(part.p)
        F += [tuple(i + off for i in q) for q in part.f]
        UV.append(part.uv)
        off += len(part.p)
    P = np.concatenate(P)
    # Centre the animal's length on the origin, as the earlier models were: the runtime turns and
    # scales them about the root (tank babies, cruisers), so the pivot stays mid-body.
    shift = np.array([(P[:, 0].min() + P[:, 0].max()) / 2, 0, 0])
    P = P - shift
    body = ca.mesh_from_arrays('Body', P, F, np.concatenate(UV), np.ones((len(P), 4)), skin, root)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(body.data)
    bm.free()
    body.shape_key_add(name='Basis', from_mix=False)
    for sign, key in ((1, 'Stroke_Left'), (-1, 'Stroke_Right')):
        q = np.concatenate([stroke_field(an, part, part.p, sign) for part in parts]) - shift
        kb = body.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', ca.to_blender(q).ravel())
        kb.value = 0.0  # rest pose by default; the runtime drives the weights
    # Weld the loft's UV seam (duplicate positions in the basis and every key); UVs stay split per
    # face corner, normals become continuous.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bm.to_mesh(body.data)
    bm.free()
    import fish_lod  # noqa: PLC0415
    fish_lod.RATIOS['Body'] = spec.get('lod', 0.16)
    low = fish_lod.lod(body)
    # Edge collapse leaves sliver triangles where thin fin edges fold; dissolve them (shape-key
    # layers ride along in bmesh) and keep the distance level's morphs at rest by default.
    bm = bmesh.new()
    bm.from_mesh(low.data)
    bmesh.ops.dissolve_degenerate(bm, dist=2e-4, edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # Collinear slivers (long edges, no area) along folded fin rims add nothing visible.
    flat = [f for f in bm.faces if f.calc_area() < 1e-8]
    bmesh.ops.delete(bm, geom=flat, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(low.data)
    bm.free()
    for kb in low.data.shape_keys.key_blocks[1:]:
        kb.value = 0.0
    for w in ca.check_scene('creature'):
        print('  note:', w)
    ca.save_blend(spec.get('src', HERE) / f'{name}.blend')
    raw = ca.export_glb(RAW / f'{name}.glb')
    out = OUT / f'{name}.glb'
    out.write_bytes(raw.read_bytes())
    tris = {o.name: sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
    print('exported', name, out.stat().st_size, tris)


if __name__ == '__main__':
    from species import SPECIES  # noqa: E402
    for n in (sys.argv[1:] or SPECIES):
        build(n, SPECIES[n])
