"""Frogfish re-author: a lifelike warty frogfish with a hinged lower jaw.

    python3 tools/art/frogfish/frogfish.py <out.glb>     # Blender 5.1 module (`pip install bpy==5.1.2`)
    node tools/art/frogfish/splice_frogfish.mjs <out.glb>

Builds only the `Frogfish` library root (FrogBody, FrogJaw, FrogLure, FrogFoot) as an uncompressed
GLB; the splice script replaces that subtree inside the shipped, compressed anchored-life.glb, so the
seahorse, moray and anemone stay byte-identical in geometry.

Anatomy (game space: X right, Y up, Z toward the snout; the seated sole is y ~= 0.02):
  * a lumpy, laterally compressed globular body with a steep face, dorsal hump, second/third dorsal
    spines as fleshy knobs and a short caudal peduncle;
  * a large upturned mouth: the lower jaw is a wedge of the same skin surface cut by two planes
    through the hinge axis, so the closed jaw is seamless with the head and opens like a real jaw,
    revealing a recessed buccal cavity (palate and mouth floor) with thick lips;
  * small gold eyes in warty lids; an illicium (fishing rod) with a tufted esca on the snout;
  * fleshy, rayed soft-dorsal, anal and caudal fins (opaque skin, not translucent panes);
  * elbowed pectoral "arms" ending in webbed hands with fringed fin-ray fingers, and small pelvic
    fins under the throat;
  * warts, fleshy cirri, saddles, pale patches, dark ocelli and a ringed eyespot below the dorsal
    fin, painted in object-space vertex colour over the shipped `FrogSkin15` micro-detail maps.

Controller contract (src/creatures/discoveries/Frogfish.ts):
  * child nodes carry no transform; FrogJaw vertices are local to JAW_HINGE and FrogLure vertices
    local to LURE_BASE (the runtime parents them to pivots at exactly those points);
  * FrogFoot is the +X pectoral limb; the controller mirrors it for the left side.
"""
import math
import sys
from pathlib import Path

import bpy  # noqa: I001 - bpy must load before bmesh
import bmesh
import numpy as np
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass015'))
import creatures as c15  # noqa: E402  (shared noise, colour and material helpers)

TAU = math.tau
# Controller pivots (keep in sync with FROGFISH_JAW_HINGE / FROGFISH_LURE_BASE in Frogfish.ts).
JAW_HINGE = np.array([0.0, 0.31, 0.16])
LURE_BASE = np.array([0.0, 0.455, 0.275])
# Mouth wedge: two planes through the hinge axis (X), angles from +Z toward +Y.
MOUTH_TOP = 0.40
MOUTH_BOTTOM = -0.66
SOLE = 0.02
RNG = np.random.default_rng(2811)


# ---------------------------------------------------------------- body field


def sd_ellipsoid(p, c, r):
    q = (p - c) / r
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / r, axis=-1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


PARTS = [
    # centre, radii, blend
    ((0.0, 0.30, -0.05), (0.205, 0.265, 0.275), 0.0),  # trunk
    ((0.0, 0.315, 0.12), (0.215, 0.215, 0.215), 0.07),  # head
    ((0.0, 0.43, -0.10), (0.14, 0.13, 0.18), 0.07),  # dorsal hump
    ((0.0, 0.27, -0.29), (0.065, 0.095, 0.11), 0.06),  # caudal peduncle
    ((0.115, 0.27, 0.15), (0.11, 0.12, 0.13), 0.05),  # cheeks
    ((-0.115, 0.27, 0.15), (0.11, 0.12, 0.13), 0.05),
    ((0.0, 0.25, 0.22), (0.16, 0.12, 0.13), 0.05),  # chin / throat
    ((0.0, 0.505, 0.155), (0.022, 0.05, 0.026), 0.025),  # second dorsal spine (fleshy horn)
    ((0.0, 0.52, 0.045), (0.045, 0.05, 0.075), 0.04),  # third dorsal spine (skin-covered hump)
]


def body_sdf(p):
    d = None
    for c, r, k in PARTS:
        e = sd_ellipsoid(p, np.array(c), np.array(r))
        d = e if d is None else smin(d, e, k)
    # Flat seated sole.
    return smax(d, SOLE - p[..., 1], 0.03)


def ray_radius(origin, dirs, far=0.75, steps=240):
    """First exit distance of each ray from inside the body (bisection refined)."""
    s = np.linspace(0, far, steps)
    out = np.empty(len(dirs))
    multi = 0
    for a in range(0, len(dirs), 2048):
        d = dirs[a:a + 2048]
        pts = origin + d[:, None, :] * s[None, :, None]
        f = body_sdf(pts)
        inside = f < 0
        exits = inside[:, :-1] & ~inside[:, 1:]
        multi += int((exits.sum(1) > 1).sum())
        i = exits.argmax(1)
        lo, hi = s[i], s[i + 1]
        for _ in range(30):
            mid = (lo + hi) / 2
            m = body_sdf(origin + d * mid[:, None]) < 0
            lo, hi = np.where(m, mid, lo), np.where(m, hi, mid)
        out[a:a + 2048] = (lo + hi) / 2
    if multi:
        print('warning: rays with several exits', multi)
    return out


def surface_toward(origin, direction):
    d = np.asarray(direction, float)
    d = d / np.linalg.norm(d)
    return origin + d * ray_radius(origin, d[None])[0]


def body_normal(p, e=1e-4):
    g = np.stack([(body_sdf(p + np.eye(3)[i] * e) - body_sdf(p - np.eye(3)[i] * e)) for i in range(3)], -1)
    return g / np.linalg.norm(g, axis=-1, keepdims=True)


# ---------------------------------------------------------------- mesh assembly


class Part:
    """Triangle soup with per-vertex attributes, assembled into one Blender mesh per node."""

    def __init__(self):
        self.v, self.f, self.mat, self.tag = [], [], [], []
        self.n = 0

    def add(self, verts, faces, material, tag):
        verts = np.asarray(verts, float)
        self.v.append(verts)
        self.f += [tuple(int(i) + self.n for i in face) for face in faces]
        self.mat += [material] * len(faces)
        self.tag.append(np.full(len(verts), tag, object))
        self.n += len(verts)

    def arrays(self):
        return np.concatenate(self.v), self.f, self.mat, np.concatenate(self.tag)


def grid_faces(rows, cols, wrap=False):
    f = []
    for i in range(rows - 1):
        for j in range(cols - (0 if wrap else 1)):
            a, b = i * cols + j, i * cols + (j + 1) % cols
            f.append((a, b, b + cols, a + cols))
    return f


def tube(points, radii, sides=12, flatten=1.0, cap=True):
    """Swept tube along a polyline (parallel-transport frame); closed with end fans."""
    p = np.asarray(points, float)
    t = np.gradient(p, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    ref = np.array([0.0, 0.0, 1.0]) if abs(t[0, 1]) > 0.9 or abs(t[0, 0]) > 0.9 else np.array([0.0, 1.0, 0.0])
    n = np.cross(t[0], ref)
    n /= np.linalg.norm(n)
    verts = []
    for i in range(len(p)):
        n = n - t[i] * (n @ t[i])
        n /= np.linalg.norm(n)
        b = np.cross(t[i], n)
        for j in range(sides):
            a = j / sides * TAU
            verts.append(p[i] + radii[i] * (math.cos(a) * n + flatten * math.sin(a) * b))
    faces = grid_faces(len(p), sides, wrap=True)
    verts = np.array(verts)
    if cap:
        s0, s1 = len(verts), len(verts) + 1
        verts = np.vstack([verts, p[0], p[-1]])
        last = (len(p) - 1) * sides
        for j in range(sides):
            faces.append((s0, (j + 1) % sides, j))
            faces.append((s1, last + j, last + (j + 1) % sides))
    return verts, faces


def ellipsoid(c, r, nu=16, nv=10):
    verts, faces = [], []
    for i in range(nv + 1):
        th = math.pi * i / nv
        for j in range(nu):
            ph = TAU * j / nu
            verts.append((c[0] + r[0] * math.sin(th) * math.cos(ph), c[1] + r[1] * math.cos(th),
                          c[2] + r[2] * math.sin(th) * math.sin(ph)))
    faces = grid_faces(nv + 1, nu, wrap=True)
    return np.array(verts), faces


def fin(base, tip_fn, rays, segs, thickness, normal):
    """Fleshy fin: closed lens-shaped shell between base points and an outer margin, with ray ridges.

    base: (m,3) attachment polyline; tip_fn(u) -> outer margin point for u in [0,1]; normal: fin plane
    normal (unit). The shell is thick at the base and thins to the margin.
    """
    base = np.asarray(base, float)
    m = len(base)
    us = np.linspace(0, 1, m)
    top, bottom = [], []
    for i, u in enumerate(us):
        tip = tip_fn(u)
        ridge = 0.5 + 0.5 * math.cos(u * rays * TAU)
        for k in range(segs + 1):
            v = k / segs
            p = base[i] * (1 - v) + tip * v
            th = thickness * (1 - v ** 2) * (0.55 + 0.45 * ridge) + 0.0015
            top.append(p + normal * th / 2)
            bottom.append(p - normal * th / 2)
    cols = segs + 1
    faces = grid_faces(m, cols)
    off = m * cols
    faces += [tuple(reversed([x + off for x in q])) for q in grid_faces(m, cols)]
    # Stitch the margin and the two short sides so the shell is closed.
    for i in range(m - 1):
        a, b = i * cols + segs, (i + 1) * cols + segs
        faces.append((a, b, b + off, a + off))
    for i in (0, m - 1):
        for k in range(segs):
            a, b = i * cols + k, i * cols + k + 1
            faces.append((a, a + off, b + off, b) if i == 0 else (a, b, b + off, a + off))
    return np.vstack([top, bottom]), faces


# ---------------------------------------------------------------- body and jaw


def head_surfaces(n_psi=84, dphi=TAU / 172):
    """Body (outside the mouth wedge) and jaw (inside) as one surface sampled from the hinge centre."""
    H = JAW_HINGE
    n_body = int(round((TAU - (MOUTH_TOP - MOUTH_BOTTOM)) / dphi))
    n_jaw = int(round((MOUTH_TOP - MOUTH_BOTTOM) / dphi))
    psi = np.linspace(-math.pi / 2, math.pi / 2, n_psi + 1)[1:-1]  # poles added separately

    def sample(phis):
        P, D = np.meshgrid(phis, psi, indexing='ij')
        d = np.stack([np.sin(D), np.cos(D) * np.sin(P), np.cos(D) * np.cos(P)], -1).reshape(-1, 3)
        r = ray_radius(H, d)
        return P, D, (H + d * r[:, None]).reshape(len(phis), len(psi), 3)

    body_phi = np.linspace(MOUTH_TOP, MOUTH_BOTTOM + TAU, n_body + 1)
    jaw_phi = np.linspace(MOUTH_BOTTOM, MOUTH_TOP, n_jaw + 1)
    poles = [surface_toward(H, (-1, 0, 0)), surface_toward(H, (1, 0, 0))]
    return H, psi, poles, sample(body_phi), sample(jaw_phi)


def lip_profile(dist, psi):
    """Thick lips either side of the mouth line, with a groove exactly at the line."""
    w = 0.10
    bulge = 0.016 * np.exp(-((dist - w * 0.55) / (w * 0.5)) ** 2) + 0.004 * np.exp(-(dist / 0.02) ** 2)
    return bulge * np.cos(psi) ** 0.7


def skin_sheet(part, grid, poles, tag, lip_rows):
    """Quad sheet over (phi, psi) plus pole fans; returns vertex index helpers for the open rows."""
    P, D, X = grid
    rows, cols = X.shape[:2]
    # Lip bulge along the radial direction from the hinge.
    radial = X - JAW_HINGE
    radial /= np.linalg.norm(radial, axis=-1, keepdims=True)
    dist = lip_rows(P)
    X = X + radial * lip_profile(dist, D)[..., None]
    verts = np.vstack([X.reshape(-1, 3), poles[0], poles[1]])
    faces = grid_faces(rows, cols)
    s0, s1 = rows * cols, rows * cols + 1
    for i in range(rows - 1):
        a, b = i * cols, (i + 1) * cols
        faces.append((s0, b, a))
        faces.append((s1, a + cols - 1, b + cols - 1))
    start = part.n
    part.add(verts, faces, 'FrogSkin15', tag)
    edge = lambda i: np.concatenate([[s0], i * cols + np.arange(cols), [s1]]) + start  # noqa: E731
    return edge(0), edge(rows - 1), X


def cap(part, ring, angle, depth, material, tag, rings=10, flip=False):
    """Recessed fan over a mouth plane: from the hinge axis out to the lip edge (duplicate vertices)."""
    H = JAW_HINGE
    n = np.array([0.0, math.cos(angle), -math.sin(angle)])  # +phi direction
    cols = len(ring)
    verts = [H]
    for k in range(1, rings + 1):
        s = k / rings
        for j in range(cols):
            psi_w = math.sin(math.pi * j / (cols - 1))
            p = H + (ring[j] - H) * s + n * depth * math.sin(math.pi * s) ** 0.8 * psi_w
            verts.append(p)
    faces = []
    for j in range(cols - 1):
        faces.append((0, 1 + j, 2 + j))
    for k in range(rings - 1):
        a = 1 + k * cols
        for j in range(cols - 1):
            faces.append((a + j, a + cols + j, a + cols + j + 1, a + j + 1))
    if flip:
        faces = [tuple(reversed(f)) for f in faces]
    part.add(np.array(verts), faces, material, tag)


def build_head():
    H, psi, poles, body, jaw = head_surfaces()
    body_part, jaw_part = Part(), Part()
    # Lips only along the mouth line; the chin seam (MOUTH_BOTTOM) stays a smooth closed surface.
    mouth_dist = lambda P: np.abs(P - MOUTH_TOP)  # noqa: E731
    _, _, BX = skin_sheet(body_part, body, poles, 'skin', mouth_dist)
    _, _, JX = skin_sheet(jaw_part, jaw, poles, 'jawskin', mouth_dist)
    pole_l, pole_r = poles
    ring = lambda X, i: np.vstack([pole_l, X[i], pole_r])  # noqa: E731
    # Palate (deep, into the head), the hidden floor under the jaw, the mouth floor and jaw underside.
    cap(body_part, ring(BX, 0), MOUTH_TOP, 0.075, 'FrogMouth', 'palate', flip=True)
    cap(body_part, ring(BX, -1), MOUTH_BOTTOM, 0.0, 'FrogSkin15', 'throat')
    cap(jaw_part, ring(JX, -1), MOUTH_TOP, -0.04, 'FrogMouth', 'floor')
    cap(jaw_part, ring(JX, 0), MOUTH_BOTTOM, 0.0, 'FrogSkin15', 'under', flip=True)
    return body_part, jaw_part


# ---------------------------------------------------------------- appendages


def surface_point(y, z, side=1):
    """Body surface on the +/-X side at a given height and depth."""
    o = np.array([0.0, y, z])
    return surface_toward(o, (side, 0, 0))


def midline_top(z):
    return surface_toward(np.array([0.0, 0.25, z]), (0, 1, 0))


def midline_bottom(z):
    return surface_toward(np.array([0.0, 0.28, z]), (0, -1, 0))


def add_fins(part):
    x_axis = np.array([1.0, 0.0, 0.0])
    # Soft dorsal fin along the back to the peduncle.
    zs = np.linspace(-0.05, -0.36, 22)
    base = np.array([midline_top(z) - np.array([0, 0.012, 0]) for z in zs])

    def dorsal_tip(u):
        b = base[min(int(u * (len(base) - 1)), len(base) - 1)]
        h = 0.02 + 0.07 * math.sin(math.pi * min(1.0, u * 1.15)) ** 0.7
        return b + np.array([0.0, h, -0.035 - 0.02 * u])

    v, f = fin(base, dorsal_tip, 11, 6, 0.016, x_axis)
    part.add(v, f, 'FrogSkin15', 'fin')
    # Anal fin under the peduncle.
    zs = np.linspace(-0.17, -0.35, 12)
    base = np.array([midline_bottom(z) + np.array([0, 0.012, 0]) for z in zs])

    def anal_tip(u):
        b = base[min(int(u * (len(base) - 1)), len(base) - 1)]
        return b + np.array([0.0, -0.035 - 0.03 * math.sin(math.pi * u), -0.03])

    v, f = fin(base, anal_tip, 6, 5, 0.014, x_axis)
    part.add(v, f, 'FrogSkin15', 'fin')
    # Rounded caudal fan, curled slightly to the side as frogfish rest.
    end = np.array([0.0, 0.275, -0.385])
    ys = np.linspace(0.20, 0.35, 14)
    base = np.array([[0.0, y, -0.355 + 0.02 * ((y - 0.275) / 0.075) ** 2] for y in ys])
    curl = 0.32

    def caudal_tip(u):
        a = (u - 0.5) * 2.3
        p = end + np.array([0.0, math.sin(a) * 0.11, -0.125 * math.cos(a * 0.62)])
        q = p - end
        return end + np.array([q[2] * -math.sin(curl), q[1], q[2] * math.cos(curl)])

    v, f = fin(base, caudal_tip, 8, 8, 0.016, x_axis)
    part.add(v, f, 'FrogSkin15', 'fin')
    # Pelvic fins under the throat, resting on the ground.
    for side in (-1, 1):
        root = surface_toward(np.array([side * 0.05, 0.2, 0.15]), (0, -1, 0)) + np.array([0, 0.01, 0])
        base = np.array([root + np.array([0.0, 0.0, dz]) for dz in np.linspace(-0.025, 0.025, 6)])

        def pelvic_tip(u, side=side, root=root):
            a = (u - 0.5) * 1.1 + side * 0.5
            return root + np.array([math.sin(a) * 0.07, 0.03 - root[1], math.cos(a) * 0.07])

        for k in range(4):
            a = (k / 3 - 0.5) * 0.9 + side * 0.35
            d = np.array([math.sin(a), 0.0, math.cos(a)])
            start = root + d * 0.005
            foot = np.array([root[0] + d[0] * 0.05, 0.03, root[2] + d[2] * 0.05])
            mid = (start + foot) / 2 + d * 0.006
            v, f = tube([start, mid, foot], [0.009, 0.007, 0.004], 7)
            part.add(v, f, 'FrogSkin15', 'pelvic')


def add_eyes(part):
    for side in (-1, 1):
        s = surface_point(0.445, 0.175, side)
        n = body_normal(s)
        c = s - n * 0.012
        # Warty lid ring.
        ring = []
        t1 = np.cross(n, [0, 0, 1.0])
        t1 /= np.linalg.norm(t1)
        t2 = np.cross(n, t1)
        for j in range(25):
            a = j / 24 * TAU
            ring.append(c + n * 0.008 + 0.03 * (math.cos(a) * t1 + math.sin(a) * t2))
        v, f = tube(ring, [0.009 + 0.002 * math.sin(j * 1.7) for j in range(25)], 10)
        part.add(v, f, 'FrogSkin15', 'lid')
        v, f = ellipsoid(c, (0.027, 0.027, 0.027), 24, 16)
        part.add(v, f, 'FrogIris', f'eye{side}')


def add_cirri(part, verts, normals, mask):
    """Fleshy cirri (dermal appendages) on the head and back, some branched."""
    idx = np.where(mask)[0]
    picks = RNG.choice(idx, 30, replace=False)
    back = np.array([0.0, 0.25, -1.0])
    for k, i in enumerate(picks):
        p, n = verts[i], normals[i]
        tilt = RNG.standard_normal(3) * 0.25 + back * 0.55
        d = n + tilt
        d /= np.linalg.norm(d)
        length = 0.011 + 0.012 * RNG.random()
        pts = [p - n * 0.005, p + d * length * 0.45, p + d * length]
        v, f = tube(pts, [0.0075, 0.0055, 0.0032], 7)
        part.add(v, f, 'FrogSkin15', 'cirrus')
        if k % 3 == 0:
            side = np.cross(d, RNG.standard_normal(3))
            side /= np.linalg.norm(side)
            q = p + d * length * 0.5
            v, f = tube([q, q + (d + side) * length * 0.45], [0.004, 0.0025], 6)
            part.add(v, f, 'FrogSkin15', 'cirrus')


def catmull(knots, per):
    """Catmull-Rom curve through knots, `per` samples per span."""
    k = np.vstack([knots[0] * 2 - knots[1], knots, knots[-1] * 2 - knots[-2]])
    out = []
    for i in range(1, len(k) - 2):
        p0, p1, p2, p3 = k[i - 1], k[i], k[i + 1], k[i + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    out.append(knots[-1])
    return np.array(out)


def build_lure():
    part = Part()
    up = np.array([0.0, 1.0, 0.0])
    pts = [np.array([0.0, -0.01, -0.004]), np.array([0.0, 0.06, 0.02]), np.array([0.0, 0.12, 0.06]),
           np.array([0.0, 0.16, 0.11]), np.array([0.0, 0.175, 0.15])]
    curve = []
    for i in range(len(pts) - 1):
        for t in np.linspace(0, 1, 8, endpoint=False):
            curve.append(pts[i] * (1 - t) + pts[i + 1] * t)
    curve.append(pts[-1])
    curve = np.array(curve)
    radii = [0.006 * (1 - i / len(curve)) + 0.0035 for i in range(len(curve))]
    v, f = tube(curve, radii, 8)
    part.add(v, f, 'FrogSkin15', 'illicium')
    # Esca: a small tuft of fleshy filaments like a worm or shrimp.
    tip = curve[-1]
    for k in range(9):
        a = k / 9 * TAU
        d = np.array([math.cos(a) * 0.6, 0.35 + 0.25 * math.sin(a * 2), 0.7 + math.sin(a) * 0.4])
        d /= np.linalg.norm(d)
        length = 0.022 + 0.009 * (k % 3)
        pts2 = [tip, tip + d * length * 0.55 + up * 0.003, tip + d * length]
        v, f = tube(pts2, [0.0075, 0.006, 0.0028], 7)
        part.add(v, f, 'FrogSkin15', 'esca')
    v, f = ellipsoid(tip, (0.012, 0.012, 0.014), 12, 8)
    part.add(v, f, 'FrogSkin15', 'esca')
    return part


def build_foot():
    part = Part()
    # Elbowed pectoral limb: upper arm out and back from the flank, forearm forward to the wrist.
    shoulder = surface_point(0.23, -0.03, 1) - np.array([0.05, 0, 0])
    knots = np.array([shoulder, shoulder + np.array([0.06, -0.04, -0.03]), np.array([0.255, 0.115, -0.045]),
                      np.array([0.275, 0.07, 0.04]), np.array([0.29, 0.045, 0.12])])
    pts = catmull(knots, 6)
    t = np.linspace(0, 1, len(pts))
    radii = 0.052 * (1 - t) ** 1.4 + 0.026 + 0.004 * np.exp(-((t - 0.5) / 0.08) ** 2)
    v, f = tube(pts, radii, 14, flatten=0.85)
    wrist = knots[-1]
    part.add(v, f, 'FrogSkin15', 'arm')
    # Webbed hand resting on the ground, with fringed finger rays.
    rays = 8
    base = np.array([wrist + np.array([-0.012 + 0.024 * u, -0.025, -0.012 + 0.012 * u])
                     for u in np.linspace(0, 1, 10)])

    def hand_tip(u):
        a = -0.35 + u * 1.55  # from forward toward outward
        reach = 0.095 + 0.02 * math.sin(math.pi * u)
        return wrist + np.array([math.sin(a) * reach, -0.032, math.cos(a) * reach])

    v, f = fin(base, hand_tip, rays / 1.0, 6, 0.018, np.array([0.0, 1.0, 0.0]))
    part.add(v, f, 'FrogSkin15', 'hand')
    for k in range(rays):
        u = (k + 0.5) / rays
        a = -0.35 + u * 1.55
        reach = 0.095 + 0.02 * math.sin(math.pi * u)
        d = np.array([math.sin(a), 0.0, math.cos(a)])
        start = wrist + np.array([0.0, -0.022, 0.0]) + d * 0.03
        mid = wrist + d * reach * 0.7 + np.array([0.0, -0.022, 0.0])
        end = wrist + d * (reach + 0.016) + np.array([0.0, -0.03, 0.0])
        v, f = tube([start, mid, end], [0.0065, 0.005, 0.0022], 7)
        part.add(v, f, 'FrogSkin15', 'finger')
    return part


# ---------------------------------------------------------------- colour


def frog_colors(p, n, tag, origin=np.zeros(3)):
    """Warty frogfish: ochre ground, rust saddles, pale patches, dark ocelli, banded lips/fins."""
    g = p + origin
    count = len(g)
    ground = np.array([0.88, 0.63, 0.30])
    saddle = c15.smoothstep(0.12, 0.42, c15.Waves(3101, 20, 7.0, 2)(g * np.array([1.0, 1.4, 1.0])))
    col = ground * (1 - saddle[:, None] * 0.8) + np.array([0.45, 0.24, 0.11]) * saddle[:, None] * 0.8
    pale = c15.smoothstep(0.22, 0.45, c15.Waves(3111, 16, 9.0, 2)(g + 3.1))
    col = col * (1 - pale[:, None] * 0.65) + np.array([0.97, 0.80, 0.64]) * pale[:, None] * 0.65
    # Fine mottling over everything.
    mottle = c15.Waves(3115, 24, 34.0, 2)(g)
    col *= (1 + 0.22 * np.tanh(mottle * 3))[:, None]
    o1, _ = c15.worley(g, 0.07, 3121)
    ocelli = np.clip(1 - o1 / 0.011, 0, 1)
    col = col * (1 - ocelli[:, None] * 0.8) + np.array([0.20, 0.10, 0.05]) * ocelli[:, None] * 0.8
    # Ringed eyespot below the soft dorsal fin, both sides.
    for side in (-1, 1):
        dist = np.linalg.norm((g - np.array([side * 0.15, 0.40, -0.17])) * np.array([0.6, 1, 1]), axis=1)
        ring = np.exp(-((dist - 0.034) / 0.009) ** 2)
        dot = c15.smoothstep(0.03, 0.018, dist)
        col = col * (1 - ring[:, None] * 0.8) + np.array([0.97, 0.88, 0.66]) * ring[:, None] * 0.8
        col = col * (1 - dot[:, None] * 0.85) + np.array([0.13, 0.07, 0.05]) * dot[:, None] * 0.85
    # Radiating bars around the eyes and across the lips.
    for side in (-1, 1):
        e = g - np.array([side * 0.19, 0.445, 0.175])
        r = np.linalg.norm(e, axis=1)
        ang = np.arctan2(e[:, 1], e[:, 2])
        bars = (np.cos(ang * 7) > 0.55) * c15.smoothstep(0.03, 0.045, r) * c15.smoothstep(0.1, 0.06, r)
        col = col * (1 - bars[:, None] * 0.45) + np.array([0.42, 0.22, 0.11]) * bars[:, None] * 0.45
    h = g - JAW_HINGE
    phi = np.arctan2(h[:, 1], h[:, 2])
    lip = np.exp(-((np.minimum(np.abs(phi - MOUTH_TOP), 9) - 0.06) / 0.07) ** 2) * c15.smoothstep(0.1, 0.16, np.linalg.norm(h, axis=1))
    bands = 0.5 + 0.5 * np.sign(np.sin(g[:, 0] * 70))
    lipcol = np.array([0.95, 0.80, 0.58]) * bands[:, None] + np.array([0.55, 0.30, 0.15]) * (1 - bands[:, None])
    is_skin = np.isin(tag, ['skin', 'jawskin', 'lid'])
    lip *= is_skin
    col = col * (1 - lip[:, None] * 0.6) + lipcol * lip[:, None] * 0.6
    # Pale belly, underside and cavity occlusion done by the caller.
    belly = c15.smoothstep(0.15, -0.6, n[:, 1]) * (g[:, 1] < 0.2)
    col = col * (1 - belly[:, None] * 0.3) + np.array([0.95, 0.85, 0.66]) * belly[:, None] * 0.3
    # Fins: dark submarginal band and pale margin.
    fins = np.isin(tag, ['fin', 'hand'])
    if fins.any():
        w = c15.Waves(3131, 12, 26.0, 1)(g)
        band = (w > 0.15) * fins
        col = col * (1 - band[:, None] * 0.35) + np.array([0.38, 0.2, 0.1]) * band[:, None] * 0.35
    # Illicium bands and a pale esca.
    rod = tag == 'illicium'
    stripe = (np.sin(g[:, 1] * 120) > 0.2) * rod
    col = np.where(rod[:, None], np.array([0.80, 0.66, 0.46]) * (1 - stripe[:, None] * 0.55), col)
    esca = tag == 'esca'
    col = np.where(esca[:, None], np.array([0.96, 0.86, 0.74]) * (0.85 + 0.15 * np.sin(g[:, 0] * 300))[:, None], col)
    # Cirri tips paler.
    cir = tag == 'cirrus'
    col = np.where(cir[:, None], col * 0.6 + np.array([0.95, 0.83, 0.6]) * 0.4, col)
    # Shade toward the seated underside.
    col *= (0.72 + 0.28 * c15.smoothstep(0.0, 0.22, g[:, 1]))[:, None]
    return np.clip(col, 0, 1) * np.ones((count, 1))


def mouth_colors(p, tag):
    """Buccal cavity: pinkish-grey near the lips, darkening toward the throat."""
    h = p - JAW_HINGE
    s = np.clip(np.linalg.norm(h, axis=1) / 0.2, 0, 1)
    deep = np.array([0.10, 0.05, 0.045])
    near = np.array([0.52, 0.34, 0.30])
    col = deep * (1 - s[:, None] ** 2.5) + near * s[:, None] ** 2.5
    # Fine, sparse teeth along the very rim of the mouth floor.
    teeth = (tag == 'floor') * (s > 0.94) * (np.sin(p[:, 0] * 210) > 0.85)
    col = np.where(teeth[:, None], np.array([0.72, 0.66, 0.58]), col)
    return col


def eye_colors(p, tag):
    col = np.zeros((len(p), 3))
    for side in (-1, 1):
        m = tag == f'eye{side}'
        if not m.any():
            continue
        c = p[m].mean(0)
        q = p[m] - c
        q /= np.linalg.norm(q, axis=1, keepdims=True)
        gaze = np.array([side * 0.75, 0.25, 0.6])
        gaze /= np.linalg.norm(gaze)
        cosang = q @ gaze
        ang = np.arctan2(q @ np.array([0, 1.0, 0]), q @ np.cross(gaze, [0, 1.0, 0]))
        iris = np.array([0.80, 0.62, 0.24]) * (0.75 + 0.25 * np.cos(ang * 18))[:, None]
        iris = iris * (1 - 0.5 * c15.smoothstep(0.55, 0.45, cosang))[:, None]
        # Slightly horizontal pupil.
        pupil = c15.smoothstep(0.9, 0.93, cosang + 0.04 * np.abs(np.sin(ang)))
        e = iris * (1 - pupil[:, None]) + np.array([0.03, 0.03, 0.03]) * pupil[:, None]
        col[m] = e
    return col


# ---------------------------------------------------------------- Blender output


def game_to_blender(v):
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)


def make_object(name, part, materials, colors_fn, parent, offset=np.zeros(3)):
    verts, faces, mats, tags = part.arrays()
    me = bpy.data.meshes.new(name)
    tri = []
    for fc in faces:
        tri.append(list(fc))
    me.from_pydata(game_to_blender(verts - offset).tolist(), [], tri)
    me.update()
    names = sorted(set(mats))
    for m in names:
        me.materials.append(materials[m])
    me.polygons.foreach_set('material_index', [names.index(m) for m in mats])
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    me.update()
    normals = c15.game_normals(me)
    colors_fn(me, verts - offset, verts, normals, tags, mats)
    return obj


def paint(me, local, world, normals, tags, mats):
    mat_v = np.empty(len(local), object)
    for poly, m in zip(me.polygons, mats):
        for i in poly.vertices:
            mat_v[i] = m
    col = frog_colors(world, normals, tags)
    mouth = mat_v == 'FrogMouth'
    if mouth.any():
        col[mouth] = mouth_colors(world[mouth], tags[mouth])
    eye = mat_v == 'FrogIris'
    if eye.any():
        col[eye] = eye_colors(world[eye], tags[eye])
    skin = mat_v == 'FrogSkin15'
    cav = np.clip(c15.cavity(me, c15.game_positions(me)) / 0.005, 0, 1)
    col[skin] *= (1 - cav[skin] * 0.45)[:, None]
    c15.write_colors(me, col)


def warts(me, tags, keep):
    """Rounded warts along the normal on dorsal and lateral skin, not on the sole or lips."""
    p = c15.game_positions(me)
    n = c15.game_normals(me)
    d1, _ = c15.worley(p, 0.04, 3141)
    wart = np.clip(1 - d1 / 0.026, 0, 1) ** 1.6
    amount = wart * 0.0075 * c15.smoothstep(-0.5, 0.2, n[:, 1]) * c15.smoothstep(0.05, 0.11, p[:, 1]) * keep
    c15.displace(me, amount)


def uv_project(obj, density):
    """Smart-project islands, then scale UVs to a constant texel density (1 UV = `density` units)."""
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.002, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    me = obj.data
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers[0].data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    area3 = sum(poly.area for poly in me.polygons)
    area_uv = 0.0
    for poly in me.polygons:
        idx = list(poly.loop_indices)
        q = uv[idx]
        area_uv += 0.5 * abs(np.dot(q[:, 0], np.roll(q[:, 1], 1)) - np.dot(q[:, 1], np.roll(q[:, 0], 1)))
    k = math.sqrt(area3 / max(area_uv, 1e-12)) / density
    me.uv_layers[0].data.foreach_set('uv', (uv * k).ravel())


def build(out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    skin = c15.skin_material('FrogSkin15', 'frog-skin', 0.7, 0.9, 2.0)
    materials = {'FrogSkin15': skin}
    for name, rough in (('FrogMouth', 0.55), ('FrogIris', 0.18)):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nodes = m.node_tree.nodes
        p = nodes.get('Principled BSDF')
        p.inputs['Roughness'].default_value = rough
        p.inputs['Base Color'].default_value = (1, 1, 1, 1)
        vc = nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        m.node_tree.links.new(vc.outputs['Color'], p.inputs['Base Color'])
        materials[name] = m
    # The lure pivot must sit just inside the snout so the rod grows out of the skin.
    assert -0.02 < body_sdf(LURE_BASE[None])[0] < 0, body_sdf(LURE_BASE[None])
    root = bpy.data.objects.new('Frogfish', None)
    bpy.context.scene.collection.objects.link(root)

    body, jaw = build_head()
    add_fins(body)
    add_eyes(body)
    bv, _, _, bt = body.arrays()
    skin_mask = (bt == 'skin')
    bn = body_normal(bv)
    hdist = np.linalg.norm(bv - JAW_HINGE, axis=1)
    cirri_ok = skin_mask & (bv[:, 1] > 0.3) & (hdist > 0.2) & (np.abs(bv[:, 0]) > 0.04)
    add_cirri(body, bv, bn, cirri_ok)

    def head_paint(me, local, world, normals, tags, mats):
        keep = np.isin(tags, ['skin', 'jawskin', 'lid', 'fin', 'arm']).astype(float)
        h = world - JAW_HINGE
        phi = np.arctan2(h[:, 1], h[:, 2])
        keep *= c15.smoothstep(0.05, 0.16, np.abs(phi - MOUTH_TOP))  # smooth lips
        keep *= c15.smoothstep(0.02, 0.06, np.linalg.norm(world - LURE_BASE, axis=1))
        warts(me, tags, keep)
        world2 = c15.game_positions(me) + (world - local)
        paint(me, local, world2, c15.game_normals(me), tags, mats)

    objs = [
        make_object('FrogBody', body, materials, head_paint, root),
        make_object('FrogJaw', jaw, materials, head_paint, root, JAW_HINGE),
        make_object('FrogLure', build_lure(), materials, paint, root),
        make_object('FrogFoot', build_foot(), materials, head_paint, root),
    ]
    for o in objs:
        uv_project(o, 0.6)
    # Lure geometry was built around its own base; the body/jaw/foot use the body frame.
    stats = {o.name: (len(o.data.vertices), sum(len(p.vertices) - 2 for p in o.data.polygons)) for o in objs}
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'frogfish.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE')
    print('exported', out, 'vertices/triangles', stats)


if __name__ == '__main__':
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'frogfish.raw.glb')
