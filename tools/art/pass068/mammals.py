"""V0.7 Pass 068: marine mammals, penguins and the gull on the Crafted Stylized Realism standard.

    python3 tools/art/pass068/mammals.py [species ...]     # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs public/assets/models
    python3 tools/art/inspect_assets.py

Extends the Pass 067 creature builder (`tools/art/pass067/creatures.py`) with what fish-shaped
animals never needed: limbs (tapered capped tubes), ears, bills, webbed hind flippers and feet,
bird and penguin wings, and four new gaits. Every animal keeps the shipped contract: its root name
and authored size, one `Body` mesh with one material, `Body_LOD1`, and `Stroke_Left` /
`Stroke_Right` morphs at rest weight 0, which the runtime drives exactly as before:

  * fluke (killer and minke whales): the tail and flukes beat up and down (`Stroke_Left` up);
  * seal (leopard and harbour seals): the hind body and hind flippers sweep side to side;
  * sealion: the big fore-flippers sweep down and back (`Stroke_Left`) or up and forward;
  * penguin / wing (penguins, gull): the wings rotate about the body axis (`Stroke_Left` up);
  * paddle (polar bear): the forelegs swing in alternation, the hind legs trail and kick;
  * otter: the tail and webbed hind feet scull side to side.
Game space: +X head, +Y up, +Z left; metres.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass067'))
import creatures as c  # noqa: E402
import hero_fish as hf  # noqa: E402

TAU, smooth, Part, fin, line = c.TAU, c.smooth, c.Part, c.fin, c.line
BODY_V = c.BODY_V


# ------------------------------------------------------------------ geometry helpers


def tube(points, radii, slot, kind, sides=10, ref=(0, 1, 0)):
    """A rounded limb along a polyline, capped at both ends, mapped into fin-band slot `slot`."""
    pts = np.asarray(points, float)
    r = np.asarray(radii, float)
    n = len(pts)
    t = np.gradient(pts, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    refv = np.asarray(ref, float)
    nrm = np.cross(t, refv)
    bad = np.linalg.norm(nrm, axis=1) < 1e-3
    nrm[bad] = np.cross(t[bad], (1, 0, 0))
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
    bin_ = np.cross(nrm, t)
    a = np.linspace(0, TAU, sides, endpoint=False)
    ring = np.cos(a)[None, :, None] * bin_[:, None, :] + np.sin(a)[None, :, None] * nrm[:, None, :]
    p = (pts[:, None, :] + r[:, None, None] * ring).reshape(-1, 3)
    faces = hf.grid_faces(n, sides, closed=True)
    p = np.vstack([p, pts[0], pts[-1]])
    c0, c1 = n * sides, n * sides + 1
    faces += [((j + 1) % sides, j, c0) for j in range(sides)]
    last = (n - 1) * sides
    faces += [(last + j, last + (j + 1) % sides, c1) for j in range(sides)]
    I, A = np.meshgrid(np.arange(n), np.arange(sides), indexing='ij')
    uv = np.stack([(slot + 0.1 + 0.8 * I.ravel() / max(n - 1, 1)) / 8,
                   BODY_V + 0.02 + 0.22 * A.ravel() / sides], 1)
    uv = np.vstack([uv, [[(slot + 0.1) / 8, BODY_V + 0.13], [(slot + 0.9) / 8, BODY_V + 0.13]]])
    return Part(p, faces, uv, kind)


def bezier(*ctrl, n=10):
    """Points along a Bezier curve through control points (de Casteljau), for limbs and bills."""
    u = np.linspace(0, 1, n)[:, None]
    P = [np.broadcast_to(np.asarray(p, float), (n, 3)) for p in ctrl]
    while len(P) > 1:
        P = [P[i] * (1 - u) + P[i + 1] * u for i in range(len(P) - 1)]
    return P[0]


def rotate(p, pivot, axis, angle):
    """Rodrigues rotation of points `p` about `axis` through `pivot` by per-point `angle`."""
    k = np.asarray(axis, float)
    k = k / np.linalg.norm(k)
    v = p - pivot
    ang = np.broadcast_to(np.asarray(angle, float), (len(p),))[:, None]
    cs, sn = np.cos(ang), np.sin(ang)
    return pivot + v * cs + np.cross(k, v) * sn + k * (v @ k)[:, None] * (1 - cs)


def tagged(part, **kw):
    for k, v in kw.items():
        setattr(part, k, v)
    return part


def fan(root, length, spread, side, slot, kind, toes=5, thick=0.012, back=(-1, 0, 0), up=(0, 1, 0),
        normal=(0, 0, 1)):
    """A webbed fan (hind flipper, foot, tail) from `root`, opening toward `back` across `up`."""
    root = np.asarray(root, float)
    bk, upv = np.asarray(back, float), np.asarray(up, float)
    w = length * 0.16
    base = line(root + upv * w, root - upv * w)

    def edge(u):
        a = (0.5 - u) * 2 * spread
        reach = length * (1 - 0.12 * np.sin(np.pi * u * toes) ** 2 * (toes > 1))
        return root[None, :] + bk[None, :] * (reach * np.cos(a))[:, None] + upv[None, :] * (reach * np.sin(a))[:, None]
    return tagged(fin(base, edge, max(toes * 2, 4), thick, slot, kind=kind, normal=normal, v_steps=6), side=side)


# ------------------------------------------------------------------ families


def dorsal(an, d):
    b = c.on_back(an, d['s'][0], d['s'][1], inset=0.8)
    h = d['h']

    def e(u, b=b):
        g = np.sin(np.pi * np.clip(u, 0, 1) ** d.get('skew', 0.6)) ** d.get('sharp', 1.0)
        return b(u) + np.stack([-d.get('rake', 0.4) * h * g, h * g, 0 * g], 1)
    return fin(b, e, 6, an.spec['hm'] * 0.12, 2, kind='dorsal')


def cetacean_parts(an):
    sp, L, hm = an.spec, an.spec['body'], an.spec['hm']
    parts = [c.loft(an, rows=64, cols=36)]
    fl = sp['flipper']
    for side in (-1, 1):
        s = fl['s']
        root = (an.x(s), an.C(s) - 0.5 * an.H(s), side * an.W(s) * 0.8)
        parts.append(c.flipper(root, -fl['back'] * L, fl['len'], fl['len'], fl['chord'] * L, side, 0, 'flipper'))
    span, r0, y0 = sp['fluke'], an.x(0.015), an.C(0)
    for side in (-1, 1):
        base = line((r0 + 0.01 * L, y0, 0), (r0 - 0.03 * L, y0, side * 0.015 * L))

        def edge(u, side=side):
            z = side * span * np.sin(np.pi * u / 2) ** 0.7
            x = r0 - 0.05 * L - 0.09 * L * np.sin(np.pi * u) ** 1.2 + 0.02 * L * u
            return np.stack([x, np.full_like(u, y0), z], 1)
        parts.append(fin(base, edge, 8, hm * 0.1, 1, kind='fluke', normal=(0, 1, 0), v_steps=6))
    parts.append(dorsal(an, sp['dorsal']))
    return parts


def pinniped_parts(an):
    sp, L = an.spec, an.spec['body']
    parts = [c.loft(an, rows=64, cols=36)]
    ff = sp['fore']
    for side in (-1, 1):
        s = ff['s']
        root = (an.x(s), an.C(s) - 0.55 * an.H(s), side * an.W(s) * 0.75)
        f = c.flipper(root, -ff['back'] * L, ff['len'], ff['len'], ff['chord'] * L, side, 0, 'fore')
        # Held angled down and out from the chest rather than flat, as pinnipeds carry them.
        f.p = rotate(f.p, np.array(root), (1, 0, 0), side * ff.get('droop', 0.6))
        parts.append(tagged(f, side=side, pivot=np.array(root)))
    hf_ = sp['hind']
    for side in (-1, 1):
        root = (an.x(0.03), an.C(0.03) - 0.1 * an.H(0.03), side * an.W(0.03) * 0.6)
        if hf_.get('turned'):  # sea lion: hind flippers turned out to the sides, flat
            parts.append(fan(root, hf_['len'], hf_['spread'], side, 1, 'hind', back=(-0.8, 0, side * 0.6),
                             up=(0.6, 0, side * 0.8), normal=(0, 1, 0)))
        else:
            parts.append(fan(root, hf_['len'], hf_['spread'], side, 1, 'hind'))
    if sp.get('ears'):
        for side in (-1, 1):
            s = sp['ears']
            b = np.array((an.x(s), an.C(s) + 0.55 * an.H(s), side * an.W(s) * 0.7))
            parts.append(tube([b, b + (-0.03 * L, 0.025 * L, side * 0.01 * L)], [0.012 * L, 0.004 * L], 2, 'ear',
                              sides=6))
    return parts


def bear_parts(an):
    sp, L, hm = an.spec, an.spec['body'], an.spec['hm']
    parts = [c.loft(an, rows=72, cols=36)]
    for side in (-1, 1):
        # Forelegs: from the shoulder, reaching down and forward in a paddling stroke.
        s = 0.6
        sh = np.array((an.x(s), an.C(s) - 0.35 * an.H(s), side * an.W(s) * 0.6))
        pts = bezier(sh, sh + (0.08 * L, -0.55 * hm, side * 0.05), sh + (0.12 * L, -1.3 * hm, side * 0.08), n=9)
        rad = np.linspace(0.3 * hm, 0.17 * hm, 9)
        rad[-2:] = [0.2 * hm, 0.12 * hm]
        parts.append(tagged(tube(pts, rad, 0, 'fore'), side=side, pivot=sh))
        # Hind legs: trailing back and down from the hip, broad paws.
        s = 0.16
        hp = np.array((an.x(s), an.C(s) - 0.3 * an.H(s), side * an.W(s) * 0.6))
        pts = bezier(hp, hp + (-0.08 * L, -0.5 * hm, side * 0.04), hp + (-0.2 * L, -0.85 * hm, side * 0.06), n=9)
        rad = np.linspace(0.32 * hm, 0.16 * hm, 9)
        rad[-2:] = [0.2 * hm, 0.12 * hm]
        parts.append(tagged(tube(pts, rad, 1, 'hind'), side=side, pivot=hp))
        # Small rounded ears.
        s = 0.9
        e = np.array((an.x(s), an.C(s) + 0.75 * an.H(s), side * an.W(s) * 0.6))
        parts.append(tube([e - (0, 0.04 * hm, 0), e + (0, 0.12 * hm, side * 0.04 * hm)],
                          [0.09 * hm, 0.05 * hm], 0, 'ear', sides=8))
    return parts


def otter_parts(an):
    sp, L, hm = an.spec, an.spec['body'], an.spec['hm']
    parts = [c.loft(an, rows=64, cols=32)]
    for side in (-1, 1):
        # Stubby forearms folded on the chest, round paws together under the chin.
        s = 0.68
        sh = np.array((an.x(s), an.C(s) - 0.5 * an.H(s), side * an.W(s) * 0.65))
        pts = bezier(sh, sh + (0.05 * L, -0.45 * hm, -side * 0.1 * hm), sh + (0.11 * L, -0.55 * hm, -side * 0.45 * an.W(s)),
                     n=7)
        rad = np.linspace(0.22 * hm, 0.15 * hm, 7)
        rad[-1] = 0.18 * hm
        parts.append(tube(pts, rad, 0, 'arm'))
        # Big webbed hind feet splayed behind the hips.
        s = 0.34
        root = (an.x(s), an.C(s) - 0.4 * an.H(s), side * an.W(s) * 0.8)
        parts.append(fan(root, 0.16 * L, 0.45, side, 1, 'hind', back=(-0.85, 0, side * 0.5), up=(0.5, 0, side * 0.85),
                         normal=(0, 1, 0), thick=0.012))
        s = 0.92
        e = np.array((an.x(s), an.C(s) + 0.6 * an.H(s), side * an.W(s) * 0.8))
        parts.append(tube([e, e + (-0.01, 0.02, side * 0.012)], [0.016, 0.008], 2, 'ear', sides=6))
    return parts


def wing_parts(an, wing, slot_pair=(0, 1), kind='wing'):
    """Bird/penguin wings: membranes from the shoulder out along Z, rotating about the body axis."""
    sp, parts = an.spec, []
    s0, s1 = wing['s']
    for side in (-1, 1):
        def wb(u, side=side):
            s = s1 - (s1 - s0) * u
            return np.stack([an.x(s), an.C(s) + wing.get('y', 0.2) * an.H(s), side * an.W(s) * 0.7], 1)

        def we(u, side=side):
            s = s1 - (s1 - s0) * u
            u = np.clip(u, 0, 1)
            ut = wing['tip_u']
            reach = wing['span'] * np.where(u < ut, (u / ut) ** wing.get('lead', 0.5),
                                            ((1 - u) / (1 - ut)) ** wing.get('trail', 1.0))
            sweep = wing['sweep'] * (reach / wing['span']) ** 1.5
            return np.stack([an.x(s) - sweep, an.C(s) + wing.get('y', 0.2) * an.H(s) + wing.get('droop', 0) * reach,
                             side * (an.W(s) * 0.7 + reach)], 1)
        pivot = np.array((an.x((s0 + s1) / 2), float(an.C((s0 + s1) / 2) + wing.get('y', 0.2) * an.H((s0 + s1) / 2)),
                          side * float(an.W((s0 + s1) / 2)) * 0.7))
        parts.append(tagged(fin(wb, we, 10, wing['thick'], slot_pair[0 if side > 0 else 1], kind=kind,
                                normal=(0, 1, 0), v_steps=7), side=side, pivot=pivot))
    return parts


def penguin_parts(an):
    sp, L, hm = an.spec, an.spec['body'], an.spec['hm']
    parts = [c.loft(an, rows=56, cols=32)]
    parts += wing_parts(an, sp['wing'])
    # Bill: from the face forward and slightly down.
    b = np.array((an.x(0.985), an.C(0.985), 0))
    bl = sp['bill'] * L
    pts = bezier(b, b + (bl * 0.6, -0.02 * bl, 0), b + (bl, -0.15 * bl, 0), n=8)
    parts.append(tube(pts, np.linspace(0.06 * L if sp['bill'] > 0.07 else 0.045 * L, 0.004 * L, 8) * 0.55, 3, 'bill',
                      sides=8))
    # Feet tucked back under the tail.
    for side in (-1, 1):
        root = (an.x(0.1), an.C(0.1) - 0.6 * an.H(0.1), side * an.W(0.1) * 0.5)
        parts.append(fan(root, 0.09 * L, 0.35, side, 4, 'foot', toes=3, back=(-1, -0.15, side * 0.15), up=(0, 0, 1),
                         normal=(0, 1, 0), thick=0.006))
    return parts


def gull_parts(an):
    sp, L, hm = an.spec, an.spec['body'], an.spec['hm']
    parts = [c.loft(an, rows=56, cols=28)]
    parts += wing_parts(an, sp['wing'])
    # Tail fan.
    root = (an.x(0.06), an.C(0.06) + 0.1 * an.H(0.06), 0)
    parts.append(fan(root, 0.16 * L, 0.35, 0, 2, 'tail', toes=1, up=(0, 0, 1), normal=(0, 1, 0), thick=0.006))
    # Bill: deep, hooked, yellow.
    b = np.array((an.x(0.99), an.C(0.99) - 0.1 * an.H(0.99), 0))
    bl = sp['bill'] * L
    pts = bezier(b, b + (bl * 0.7, 0.0, 0), b + (bl, -0.12 * bl, 0), n=8)
    parts.append(tube(pts, np.linspace(0.028 * L, 0.006 * L, 8), 3, 'bill', sides=8))
    # Pink legs tucked back under the body.
    for side in (-1, 1):
        h = np.array((an.x(0.4), an.C(0.4) - 0.7 * an.H(0.4), side * an.W(0.4) * 0.35))
        pts = bezier(h, h + (-0.06 * L, -0.08 * L, 0), h + (-0.16 * L, -0.08 * L, side * 0.01), n=6)
        parts.append(tube(pts, np.full(6, 0.008 * L), 4, 'leg', sides=6))
    return parts


c.FAMILIES.update({'cetacean': cetacean_parts, 'pinniped': pinniped_parts, 'bear': bear_parts,
                   'otter': otter_parts, 'penguin': penguin_parts, 'gull': gull_parts})


# ------------------------------------------------------------------ gaits

_base_stroke = c.stroke_field


def stroke_field(an, part, p, sign):
    sp = an.spec
    loco, L = sp['loco'], sp['body']
    q = p.copy()
    xs = np.clip((an.x_snout - p[:, 0]) / L, 0, 1.3)  # 0 at the snout, 1 at the tail root
    if loco == 'seal' or loco == 'otter':
        w = smooth(sp.get('pivot', 0.45), 1.15, xs) ** 1.6
        q[:, 2] += sign * sp.get('amp', 0.16) * L * w
        return q
    if loco == 'sealion':
        q[:, 2] += sign * 0.03 * L * smooth(0.5, 1.1, xs) ** 2
        if part.kind == 'fore':
            # Down and back for Stroke_Left; the flipper pivots about a fore-aft axis and a vertical one.
            q = rotate(q, part.pivot, (1, 0, 0), sign * part.side * 0.55)
            q = rotate(q, part.pivot, (0, 1, 0), sign * part.side * 0.35)
        return q
    if loco in ('penguin', 'wing'):
        if part.kind == 'wing':
            q = rotate(q, part.pivot, (1, 0, 0), -sign * part.side * sp.get('beat', 0.6))
        elif loco == 'penguin':
            q[:, 1] += sign * 0.03 * L * smooth(0.55, 1.1, xs)
        return q
    if loco == 'paddle':
        if part.kind == 'fore':
            q = rotate(q, part.pivot, (0, 0, 1), sign * part.side * 0.4)
        elif part.kind == 'hind':
            q = rotate(q, part.pivot, (0, 0, 1), -sign * part.side * 0.25)
        return q
    return _base_stroke(an, part, p, sign)


c.stroke_field = stroke_field


if __name__ == '__main__':
    from mammal_species import SPECIES  # noqa: E402
    for n in (sys.argv[1:] or SPECIES):
        c.build(n, SPECIES[n])
