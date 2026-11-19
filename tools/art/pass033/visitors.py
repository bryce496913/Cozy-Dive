"""v0.6 Pass 033: author the outer reef's wall visitors from scratch.

    python3 tools/art/pass033/visitors.py [hammerhead|manta|whaleshark|humpback]   # Blender 5.1 module
    node tools/art/pass017/compress.mjs                                             # then compress

Four big animals for the blue beyond the reef's wall, built like Pass 025's creatures (whose
helpers this reuses): game space (+X forward, +Y up), one `<Name>_Root` holding a single `Body` mesh
with one material and `Stroke_Left` / `Stroke_Right` morphs (the two ends of its swimming stroke),
and a decimated `Body_LOD1` for distance.

  * a hammerhead shark: the blacktip's build with a wide cephalofoil (eyes at its tips) and a tall,
    sickle dorsal; bronze-grey above, white below. Drawn large as a great hammerhead and smaller,
    paler, in a school as scalloped hammerheads;
  * a reef manta: broad pointed wings, two cephalic fins at the mouth and a short tail; black above
    with pale shoulder patches, white below with a few belly spots; its wings beat slowly;
  * a whale shark: a broad, flat head with a wide mouth at the front, ridges along the back, a tall
    crescent tail; dark blue-grey covered in pale spots and stripes;
  * a humpback whale: robust, with very long white pectoral flippers, a small dorsal hump and wide
    flukes; its stroke is vertical (flukes up and down), as a whale's is.

Every body is authored about 3 m long (the manta about 4.4 m across) and scaled at runtime.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
import creatures as c  # noqa: E402  (Pass 025 helpers; imports bpy, bmesh)
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from scipy.interpolate import PchipInterpolator  # noqa: E402
from scipy.spatial import cKDTree  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass033'
smooth, unit, lerp, part, merge, loft, loft_uv, fin, sphere, same_uv, fbm, grid = (
    c.smooth, c.unit, c.lerp, c.part, c.merge, c.loft, c.loft_uv, c.fin, c.sphere, c.same_uv, c.fbm, c.grid)


def body_profile(L, nose, peduncle, h, w, yc):
    hh = PchipInterpolator(h[0], L * np.asarray(h[1]))
    ww = PchipInterpolator(w[0], L * np.asarray(w[1]))
    yy = PchipInterpolator(yc[0], L * np.asarray(yc[1]))
    x = lambda t: nose - t * (nose - peduncle)  # noqa: E731
    return hh, ww, yy, x


def lofted_body(prof, nose, peduncle, belly=0.8, m=32, n=56, flat=0.0):
    """A body of revolution-ish loft; `flat` squares the cross-section (a flatter, wider head)."""
    h, w, yc, x = prof
    s = np.linspace(0, 1, n + 2)[1:-1] ** 1.2
    th = 2 * np.pi * np.arange(m) / m
    co, sn = np.cos(th), np.sin(th)
    rings = []
    for t in s:
        f = flat * (1 - smooth(0.05, 0.35, t))
        sq_c = np.sign(co) * np.abs(co) ** (1 - 0.5 * f)
        sq_s = np.sign(sn) * np.abs(sn) ** (1 - 0.5 * f)
        rings.append(np.stack([np.full(m, x(t)), yc(t) - h(t) * sq_c * np.where(co > 0, belly, 1.0), w(t) * sq_s], 1))
    verts, faces, station, ring = loft(rings, [nose, yc(0), 0], [peduncle - 0.07, yc(1), 0])
    su = np.concatenate([[0], s, [1]])
    return part(verts, faces, loft_uv(faces, station, ring, m,
                                      lambda i, j: (0.94 * np.interp(i + 1, np.arange(n + 2), su), j)))


def strip_fin(outline, origin, a, b, thickness, strip, tip=lambda a, b: 0 * a):
    a = unit(a)
    b = unit(np.asarray(b, float) - np.dot(b, a) * a)
    v, f, plane = fin(outline, (origin, a, b), thickness)
    t = np.clip(tip(plane[:, 0], plane[:, 1]), 0, 1)
    return part(v, f, [[(strip, 0.1 + 0.85 * t[i]) for i in face] for face in f])


def side_stroke(shape, nose, length, amount):
    q = (nose - shape['v'][:, 0]) / length
    bend = amount * smooth(0.28, 1.0, q) ** 1.5 - 0.025 * (1 - smooth(0.0, 0.3, q))
    d = np.zeros_like(shape['v'])
    d[:, 2] = bend
    shape['keys'] = {'Stroke_Left': d, 'Stroke_Right': -d}
    return shape


FIN_BACK, FIN_BELLY, EYE_V = 0.955, 0.985, 0.04


def eyes(parts, centres, radius):
    for p in centres:
        ev, ef = sphere(p, radius)
        parts.append(part(ev, ef, same_uv(ef, (FIN_BACK, EYE_V))))


def fish_body_maps(name, back, belly, edge_fn, extra=None, fins=None, rough_body=0.5, relief=None):
    """Body (u < 0.94: u along it, v around it, belly at v = 0/1), fin strips and eye texels."""
    u, v = grid()
    s = u / 0.94
    e = -np.cos(2 * np.pi * v)
    edge = edge_fn(s, u, v)
    col = lerp(belly, back(s, u, v), smooth(edge - 0.06, edge + 0.06, e))
    col *= (0.93 + 0.07 * fbm(u * 2, v, 12, 12))[..., None]
    if extra is not None:
        col = extra(col, s, e, u, v)
    fb, fp = fins or (back(s, u, v)[0, 0], belly)
    col = np.where((u >= 0.94)[..., None], np.where((u < 0.97)[..., None], fb, fp), col)
    col = np.where(((u >= 0.94) & (v < 0.08))[..., None], [0.02, 0.02, 0.025], col)
    height = (0.5 * fbm(u * 2, v, 16, 13, 3) + (relief(s, e, u, v) if relief else 0)) * (u < 0.94)
    rough = np.where((u >= 0.94) & (v < 0.08), 0.12, rough_body)
    return (c.save_png(f'creature_{name}_base', col), c.save_png(f'creature_{name}_normal', c.normal_map(height, 1.5)),
            c.save_roughness(f'creature_{name}_orm', rough))


# ------------------------------------------------------------------ hammerhead

HAMMER = {'length': 3.0, 'nose': 1.5, 'peduncle': -0.95}


def hammer_profile():
    s = [0, 0.02, 0.06, 0.12, 0.22, 0.35, 0.5, 0.65, 0.8, 0.92, 1]
    return body_profile(HAMMER['length'], HAMMER['nose'], HAMMER['peduncle'],
                        (s, [0, .012, .026, .045, .066, .078, .072, .056, .04, .028, .022]),
                        (s, [0, .03, .036, .046, .058, .062, .056, .043, .028, .02, .017]),
                        ([0, 0.1, 0.4, 0.7, 1], [-.008, -.002, .004, .002, .006]))


def hammerhead():
    h, w, yc, x = hammer_profile()
    nose, ped = HAMMER['nose'], HAMMER['peduncle']
    parts = [lofted_body((h, w, yc, x), nose, ped)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.8 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    # The cephalofoil: a wide, flat head, its front edge nearly straight with a shallow notch.
    head = [(0.0, 0.0), (0.012, 0.2), (0.0, 0.36), (0.03, 0.43), (0.09, 0.445), (0.14, 0.405), (0.125, 0.28),
            (0.15, 0.14), (0.25, 0.055), (0.25, -0.055), (0.15, -0.14), (0.125, -0.28), (0.14, -0.405),
            (0.09, -0.445), (0.03, -0.43), (0.0, -0.36), (0.012, -0.2)]
    parts.append(strip_fin(head, [nose + 0.04, yc(0.04) + 0.005, 0], back, [0, 0, 1], 0.05, FIN_BACK))
    eyes(parts, [[nose - 0.03, yc(0.03) + 0.01, s * 0.435] for s in (1, -1)], 0.018)
    # Tall sickle-shaped first dorsal; small second dorsal and anal fins.
    parts.append(strip_fin([(-0.02, -0.09), (0.0, 0.02), (0.05, 0.2), (0.1, 0.36), (0.14, 0.46), (0.17, 0.48),
                            (0.19, 0.42), (0.2, 0.25), (0.25, 0.1), (0.36, 0.04), (0.31, -0.01), (0.28, -0.09)],
                           [x(0.3), top(0.3), 0], back, up, 0.032, FIN_BACK))
    small = [(-0.01, -0.05), (0.0, 0.01), (0.04, 0.07), (0.07, 0.1), (0.09, 0.07), (0.11, 0.025), (0.18, 0.012),
             (0.13, -0.01), (0.12, -0.05)]
    parts.append(strip_fin(small, [x(0.7), top(0.7), 0], back, up, 0.016, FIN_BACK))
    parts.append(strip_fin(small, [x(0.71), bottom(0.71), 0], back, down, 0.016, FIN_BELLY))
    for side in (1, -1):
        parts.append(strip_fin([(-0.03, -0.05), (0.0, 0.02), (0.05, 0.14), (0.12, 0.28), (0.19, 0.37),
                                (0.225, 0.38), (0.22, 0.3), (0.19, 0.18), (0.2, 0.06), (0.24, 0.0), (0.18, -0.05)],
                               [x(0.24), yc(0.24) - 0.45 * h(0.24), side * 0.8 * w(0.24)],
                               [-1, -0.1, 0], [0, -0.42, side], 0.03, FIN_BACK))
        parts.append(strip_fin([(-0.02, -0.03), (0.0, 0.03), (0.06, 0.09), (0.11, 0.12), (0.135, 0.08),
                                (0.17, 0.03), (0.12, -0.03)],
                               [x(0.58), yc(0.58) - 0.62 * h(0.58), side * 0.45 * w(0.58)],
                               [-1, -0.15, 0], [0, -0.6, side], 0.016, FIN_BELLY))
    # Caudal: a long upper lobe with a notch near its tip, a short lower lobe.
    parts.append(strip_fin([(-0.1, 0.07), (0.06, 0.1), (0.24, 0.27), (0.44, 0.47), (0.6, 0.63), (0.58, 0.56),
                            (0.5, 0.5), (0.47, 0.36), (0.38, 0.17), (0.35, 0.04), (0.38, -0.07), (0.42, -0.18),
                            (0.41, -0.23), (0.34, -0.2), (0.22, -0.13), (0.08, -0.07), (-0.1, -0.06)],
                           [ped + 0.03, yc(1), 0], back, up, 0.028, FIN_BACK))
    return side_stroke(merge(parts), nose, HAMMER['length'], 0.32)


def hammer_maps():
    back = lambda s, u, v: lerp([0.5, 0.47, 0.4], [0.4, 0.38, 0.33], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))  # noqa: E731
    return fish_body_maps('hammerhead', back, [0.92, 0.92, 0.89],
                          lambda s, u, v: -0.18 + 0.06 * (fbm(u, v, 8, 14) - 0.5),
                          fins=([0.44, 0.42, 0.37], [0.82, 0.82, 0.79]))


# ------------------------------------------------------------------ reef manta

MANTA = {'half_span': 2.2, 'x0': -0.95, 'dx': 2.05}
MANTA_DARK = (0.5 * 0.03 / MANTA['dx'], 0.03)


def manta_edges(z):
    R = MANTA['half_span']
    a = np.clip(np.abs(z) / R, 0, 1)
    lead = 0.55 - 0.95 * a ** 1.1
    head = np.where(np.abs(z) < 0.42, 0.78, -9)
    k = 0.035
    front = k * np.logaddexp(lead / k, head / k)
    back = -0.52 + 0.4 * a ** 0.9 - 0.28 * a ** 3
    return front, back


def manta_uv(p, top):
    u = 0.5 * (p[0] - MANTA['x0']) / MANTA['dx']
    return (u if top else 0.5 + u, (p[2] + MANTA['half_span']) / (2 * MANTA['half_span']))


def manta():
    R = MANTA['half_span']
    m, n = 28, 72
    z = -R * np.cos(np.pi * np.arange(1, n + 1) / (n + 1))
    phi = 2 * np.pi * np.arange(m) / m
    rings = []
    for zi in z:
        a = abs(zi) / R
        front, back = manta_edges(zi)
        mid, half = 0.5 * (front + back), 0.5 * (front - back)
        cam = 0.05 * a * a
        thick = 0.025 * (1 - a) ** 0.6 + 0.2 * np.exp(-(zi / 0.45) ** 2)
        rings.append(np.stack([mid + half * np.cos(phi), cam + thick * np.sin(phi) * (0.6 + 0.4 * np.cos(phi)),
                               np.full(m, zi)], 1))
    tip = float(manta_edges(R)[0])
    verts, faces, _, ring = loft(rings, [tip, 0.05, -R], [tip, 0.05, R])
    side = np.sin(phi)[ring]
    side[0] = side[-1] = 0
    parts = [part(verts, faces, [[manta_uv(verts[i], side[f].sum() >= 0) for i in f] for f in faces])]
    # A short tail.
    t = np.linspace(0, 1, 18)[1:-1]
    k = 8
    psi = 2 * np.pi * np.arange(k) / k
    rad = 0.035 * (1 - t) + 0.004
    tail = [np.stack([np.full(k, -0.45 - 0.9 * ti), ri * np.sin(psi), ri * np.cos(psi)], 1) for ti, ri in zip(t, rad)]
    tv, tf, _, _ = loft(tail, [-0.43, 0, 0], [-1.37, 0, 0])
    parts.append(part(tv, tf, same_uv(tf, MANTA_DARK)))
    # Cephalic fins: a pair of paddles either side of the wide mouth, curled down and forward.
    for s in (1, -1):
        fv, ff, _ = fin([(-0.02, 0.0), (0.1, -0.02), (0.26, 0.0), (0.32, 0.06), (0.27, 0.12), (0.1, 0.13),
                         (-0.02, 0.1)], ([0.74, 0.02, s * 0.38], [1, -0.35, 0], [0, -1, 0]), 0.03)
        parts.append(part(fv, ff, same_uv(ff, MANTA_DARK)))
        ev, ef = sphere([0.66, 0.06, s * 0.41], 0.03)
        parts.append(part(ev, ef, same_uv(ef, MANTA_DARK)))
    shape = merge(parts)
    zz = shape['v'][:, 2]
    f = smooth(0.2, 1.0, np.abs(zz) / R) ** 1.3
    upk, downk = np.zeros_like(shape['v']), np.zeros_like(shape['v'])
    upk[:, 1], upk[:, 2] = 0.85 * f, -np.sign(zz) * 0.22 * f * f
    downk[:, 1], downk[:, 2] = -0.75 * f, -np.sign(zz) * 0.18 * f * f
    shape['keys'] = {'Stroke_Left': upk, 'Stroke_Right': downk}
    return shape


def manta_maps():
    R = MANTA['half_span']
    u, v = grid()
    top = u < 0.5
    x = MANTA['x0'] + (np.where(top, u, u - 0.5) / 0.5) * MANTA['dx']
    z = -R + v * 2 * R
    front, back = manta_edges(z)
    inside = (x <= front) & (x >= back) & (np.abs(z) < R)
    margin = np.minimum(front - x, x - back)
    nz = fbm(u, v, 16, 61)
    # Above: near-black, with pale shoulder patches behind the head (chevrons), a darker spine.
    sh = np.exp(-(((np.abs(z) - 0.62) / 0.32) ** 2 + ((x - 0.28 - 0.25 * (np.abs(z) - 0.62)) / 0.16) ** 2))
    upper = lerp(lerp([0.04, 0.045, 0.05], [0.09, 0.1, 0.11], nz), [0.78, 0.8, 0.8], smooth(0.35, 0.65, sh))
    # Below: white, with a grey margin at the wing edges and a few dark belly spots.
    rng = np.random.default_rng(3307)
    spots = np.column_stack([rng.uniform(-0.3, 0.35, 9), rng.uniform(-0.45, 0.45, 9)])
    d, _ = cKDTree(spots).query(np.stack([x.ravel(), z.ravel()], 1))
    spot = 1 - smooth(0.035, 0.055, d.reshape(x.shape))
    lower = lerp([0.92, 0.93, 0.92], [0.35, 0.37, 0.4], 0.75 * (1 - smooth(0.0, 0.12, margin)))
    lower = lerp(lower, [0.1, 0.1, 0.12], spot)
    col = np.where(top[..., None], upper, lower)
    col = np.where(inside[..., None], col, [0.03, 0.035, 0.04])
    height = 0.4 * fbm(u, v, 24, 62, 3)
    rough = np.where(inside, 0.45, 0.2)
    return (c.save_png('creature_manta_base', col), c.save_png('creature_manta_normal', c.normal_map(height, 1.0)),
            c.save_roughness('creature_manta_orm', rough))


# ------------------------------------------------------------------ whale shark

WHALE_SHARK = {'length': 3.0, 'nose': 1.5, 'peduncle': -1.0}


def whale_shark_profile():
    s = [0, 0.012, 0.04, 0.1, 0.2, 0.33, 0.5, 0.65, 0.8, 0.92, 1]
    return body_profile(WHALE_SHARK['length'], WHALE_SHARK['nose'], WHALE_SHARK['peduncle'],
                        (s, [0, .03, .045, .064, .085, .095, .088, .068, .046, .03, .022]),
                        (s, [0, .06, .072, .082, .09, .092, .084, .062, .038, .024, .02]),
                        ([0, 0.1, 0.4, 0.7, 1], [-.006, -.001, .006, .004, .008]))


def whale_shark():
    h, w, yc, x = whale_shark_profile()
    nose, ped = WHALE_SHARK['nose'], WHALE_SHARK['peduncle']
    parts = [lofted_body((h, w, yc, x), nose, ped, belly=0.85, flat=0.8)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.85 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    parts.append(strip_fin([(-0.02, -0.08), (0.0, 0.02), (0.07, 0.15), (0.15, 0.24), (0.21, 0.26), (0.24, 0.2),
                            (0.26, 0.09), (0.33, 0.03), (0.29, -0.01), (0.27, -0.08)],
                           [x(0.45), top(0.45), 0], back, up, 0.04, FIN_BACK))
    small = [(-0.01, -0.05), (0.0, 0.01), (0.04, 0.06), (0.07, 0.08), (0.09, 0.05), (0.11, 0.02), (0.16, 0.01),
             (0.12, -0.01), (0.11, -0.05)]
    parts.append(strip_fin(small, [x(0.72), top(0.72), 0], back, up, 0.02, FIN_BACK))
    parts.append(strip_fin(small, [x(0.74), bottom(0.74), 0], back, down, 0.02, FIN_BELLY))
    for side in (1, -1):
        parts.append(strip_fin([(-0.03, -0.06), (0.0, 0.02), (0.06, 0.16), (0.15, 0.32), (0.23, 0.44),
                                (0.27, 0.45), (0.265, 0.36), (0.23, 0.22), (0.23, 0.08), (0.27, 0.0), (0.2, -0.06)],
                               [x(0.27), yc(0.27) - 0.5 * h(0.27), side * 0.82 * w(0.27)],
                               [-1, -0.08, 0], [0, -0.38, side], 0.04, FIN_BACK))
        parts.append(strip_fin([(-0.02, -0.03), (0.0, 0.03), (0.06, 0.08), (0.11, 0.1), (0.13, 0.07),
                                (0.16, 0.03), (0.11, -0.03)],
                               [x(0.6), yc(0.6) - 0.66 * h(0.6), side * 0.45 * w(0.6)],
                               [-1, -0.15, 0], [0, -0.6, side], 0.02, FIN_BELLY))
    eyes(parts, [[x(0.05), yc(0.05) + 0.05 * h(0.05), s * 0.98 * w(0.05)] for s in (1, -1)], 0.014)
    # A tall crescent tail, its upper lobe a little longer.
    parts.append(strip_fin([(-0.1, 0.08), (0.08, 0.12), (0.24, 0.3), (0.38, 0.5), (0.48, 0.6), (0.47, 0.52),
                            (0.4, 0.34), (0.36, 0.16), (0.35, 0.04), (0.38, -0.1), (0.44, -0.3), (0.46, -0.42),
                            (0.39, -0.36), (0.26, -0.2), (0.1, -0.09), (-0.1, -0.07)],
                           [ped + 0.04, yc(1), 0], back, up, 0.035, FIN_BACK))
    return side_stroke(merge(parts), nose, WHALE_SHARK['length'], 0.22)


def whale_shark_maps():
    u, v = grid()
    back = lambda s, uu, vv: lerp([0.22, 0.27, 0.33], [0.16, 0.2, 0.26], smooth(0.2, 1.0, -np.cos(2 * np.pi * vv)))  # noqa: E731

    def markings(col, s, e, uu, vv):
        # Pale spots in rows along the body, between faint vertical stripes; none on the belly.
        upper = smooth(-0.35, -0.15, e)
        sx, sy = s * 46, vv * 30
        jx, jy = np.floor(sx), np.floor(sy)
        rng = np.random.default_rng(4407)
        jit = rng.uniform(-0.25, 0.25, (64, 64, 2))
        cx = jx + 0.5 + jit[jx.astype(int) % 64, jy.astype(int) % 64, 0]
        cy = jy + 0.5 + jit[jx.astype(int) % 64, jy.astype(int) % 64, 1]
        d = np.hypot(sx - cx, (sy - cy) * 1.1)
        spot = (1 - smooth(0.17, 0.27, d)) * upper * smooth(0.04, 0.1, s)
        stripe = (1 - smooth(0.035, 0.07, np.abs(((s * 23) % 1) - 0.5) - 0.42)) * upper * smooth(0.18, 0.3, s)
        mouth = (1 - smooth(0.004, 0.009, np.abs(s - 0.012))) * (1 - smooth(0.4, 0.75, np.abs(e)))
        out = lerp(col, [0.82, 0.84, 0.82], np.maximum(spot, 0.5 * stripe))
        return out * (1 - 0.6 * mouth)[..., None]
    ridges = lambda s, e, uu, vv: 0.9 * sum(  # noqa: E731
        (1 - smooth(0.0, 0.02, np.abs(e - r))) * smooth(0.12, 0.25, s) * (1 - smooth(0.7, 0.85, s))
        for r in (0.55, 0.8, 0.95))
    return fish_body_maps('whaleshark', back, [0.86, 0.88, 0.86],
                          lambda s, uu, vv: -0.25 + 0.04 * (fbm(uu, vv, 8, 44) - 0.5),
                          extra=markings, fins=([0.2, 0.25, 0.31], [0.72, 0.74, 0.72]), relief=ridges)


# ------------------------------------------------------------------ humpback whale

HUMPBACK = {'length': 3.0, 'nose': 1.5, 'peduncle': -1.15}


def humpback_profile():
    s = [0, 0.02, 0.06, 0.14, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1]
    return body_profile(HUMPBACK['length'], HUMPBACK['nose'], HUMPBACK['peduncle'],
                        (s, [0, .03, .055, .085, .105, .11, .1, .075, .045, .026, .016]),
                        (s, [0, .04, .06, .085, .1, .102, .09, .064, .036, .02, .012]),
                        ([0, 0.15, 0.4, 0.7, 1], [-.012, -.004, .004, .004, .008]))


def humpback():
    h, w, yc, x = humpback_profile()
    nose, ped = HUMPBACK['nose'], HUMPBACK['peduncle']
    parts = [lofted_body((h, w, yc, x), nose, ped, belly=0.92, flat=0.4)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    back, up = [-1, 0, 0], [0, 1, 0]
    # A small dorsal hump far back.
    parts.append(strip_fin([(-0.02, -0.05), (0.0, 0.01), (0.05, 0.04), (0.08, 0.06), (0.1, 0.05), (0.14, 0.015),
                            (0.12, -0.05)], [x(0.66), top(0.66), 0], back, up, 0.03, FIN_BACK))
    for side in (1, -1):
        # The long pectoral flippers: a third of the body, their leading edge scalloped (tubercles).
        outline = [(-0.04, -0.05), (0.0, 0.03)]
        for i in range(1, 9):
            outline.append((0.11 * i, 0.04 + 0.012 * (i % 2) - 0.004 * i))
        outline += [(0.97, 0.0), (0.9, -0.05), (0.6, -0.085), (0.3, -0.09), (0.08, -0.08)]
        parts.append(strip_fin(outline, [x(0.24), yc(0.24) - 0.55 * h(0.24), side * 0.75 * w(0.24)],
                               [-0.45, -0.35, side * 0.82], [1, 0, 0], 0.035, FIN_BELLY))
    eyes(parts, [[x(0.12), yc(0.12) - 0.25 * h(0.12), s * 0.97 * w(0.12)] for s in (1, -1)], 0.012)
    # Wide flukes, horizontal, with a central notch and a scalloped trailing edge.
    flukes = [(-0.06, 0.0), (0.0, 0.05), (0.08, 0.2), (0.17, 0.38), (0.22, 0.5), (0.27, 0.52), (0.26, 0.42),
              (0.28, 0.3), (0.26, 0.18), (0.28, 0.06), (0.24, 0.0), (0.28, -0.06), (0.26, -0.18), (0.28, -0.3),
              (0.26, -0.42), (0.27, -0.52), (0.22, -0.5), (0.17, -0.38), (0.08, -0.2), (0.0, -0.05)]
    parts.append(strip_fin(flukes, [ped + 0.02, yc(1), 0], back, [0, 0, 1], 0.04, FIN_BACK))
    shape = merge(parts)
    # A whale's stroke is vertical: the flukes rise and fall, the head counters slightly.
    q = (nose - shape['v'][:, 0]) / HUMPBACK['length']
    bend = 0.32 * smooth(0.4, 1.0, q) ** 1.6 - 0.02 * (1 - smooth(0.0, 0.3, q))
    d = np.zeros_like(shape['v'])
    d[:, 1] = bend
    shape['keys'] = {'Stroke_Left': d, 'Stroke_Right': -d}
    return shape


def humpback_maps():
    back = lambda s, u, v: lerp([0.1, 0.11, 0.12], [0.06, 0.065, 0.07], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))  # noqa: E731

    def throat(col, s, e, u, v):
        # Ventral grooves from the chin to the belly button, and white mottling below.
        grooves = (1 - smooth(0.25, 0.45, np.abs(((v * 64) % 1) - 0.5) * 2)) * smooth(0.02, 0.06, s) \
            * (1 - smooth(0.36, 0.44, s)) * (1 - smooth(-0.55, -0.25, e))
        mott = smooth(0.48, 0.62, fbm(u * 2, v, 10, 71)) * (1 - smooth(-0.6, -0.1, e))
        out = lerp(col, [0.9, 0.9, 0.88], 0.8 * mott)
        return out * (1 - 0.35 * grooves)[..., None]
    knobs = lambda s, e, u, v: 1.4 * smooth(0.6, 0.75, fbm(u * 4, v, 24, 72)) * (1 - smooth(0.06, 0.12, s)) \
        * smooth(0.0, 0.4, e)  # noqa: E731
    return fish_body_maps('humpback', back, [0.85, 0.86, 0.84],
                          lambda s, u, v: -0.1 - 0.35 * smooth(0.05, 0.4, s) * (1 - smooth(0.45, 0.6, s)),
                          extra=throat, fins=([0.08, 0.085, 0.09], [0.9, 0.9, 0.88]), relief=knobs, rough_body=0.42)


# ------------------------------------------------------------------ build

VISITORS = {
    'hammerhead': ('hammerhead', 'Hammerhead_Root', hammerhead, hammer_maps),
    'manta': ('manta-ray', 'Manta_Root', manta, manta_maps),
    'whaleshark': ('whale-shark', 'WhaleShark_Root', whale_shark, whale_shark_maps),
    'humpback': ('humpback-whale', 'Humpback_Root', humpback, humpback_maps),
}

if __name__ == '__main__':
    c.CREATURES.update(VISITORS)
    for n in (sys.argv[1:] or VISITORS):
        c.build(n)
