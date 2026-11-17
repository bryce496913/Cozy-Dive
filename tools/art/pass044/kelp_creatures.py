"""v0.6 Pass 044: the kelp forest's new animals.

    python3 tools/art/pass044/kelp_creatures.py [otter|leopard|seal|gull]   # Blender 5.1 module
    node tools/art/pass017/compress.mjs                                      # then compress

Built like the other creatures (Pass 025/033 helpers): game space (+X forward, +Y up), one
`<Name>_Root` holding a single `Body` mesh with `Stroke_Left` / `Stroke_Right` morphs and a decimated
`Body_LOD1`; scaled at runtime.

  * sea otter (1.2 m): a long, supple body, a rounded pale face with small ears and whiskers, short
    fore paws, broad webbed hind feet and a flat tail; dark brown, the head grizzled cream. Its
    stroke sculls with the tail and hind feet (it floats on its back; the runtime rolls it over);
  * leopard shark (1.5 m): slender, with a short rounded snout and two dorsals of a size; bronze-
    grey with dark saddles across the back and dark spots between them, pale below;
  * harbour seal (1.6 m): a plump, spindle body and a round, dog-like head without ear flaps, big
    dark eyes; short fore flippers held to its sides and broad hind flippers fanned behind, which
    sweep side to side (its stroke); grey, freckled with dark spots, paler below;
  * western gull (0.6 m long, 1.4 m wingspan): white head and body, slate-grey wings with black
    tips, a yellow bill and pink legs. Its stroke is the wingbeat (`Stroke_Left` up,
    `Stroke_Right` down); folded, it swims.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass044'
smooth, lerp, merge, fbm, part = c.smooth, c.lerp, c.merge, c.fbm, c.part


def flipper_keys(v, pivot, axis, down, up):
    rel = v - pivot
    return {'Stroke_Left': rel @ c.rotation(axis, down).T - rel,
            'Stroke_Right': rel @ c.rotation(axis, up).T - rel}


def no_keys(shape):
    z = np.zeros_like(shape['v'])
    shape['keys'] = {'Stroke_Left': z, 'Stroke_Right': z.copy()}
    return shape


# ------------------------------------------------------------------ sea otter

OTTER = {'length': 1.2, 'nose': 0.6, 'peduncle': -0.42}


def otter():
    s = [0, 0.03, 0.08, 0.14, 0.2, 0.3, 0.45, 0.6, 0.75, 0.88, 1]
    h, w, yc, x = vz.body_profile(OTTER['length'], OTTER['nose'], OTTER['peduncle'],
                                  (s, [0, .04, .06, .065, .058, .075, .09, .09, .075, .05, .035]),
                                  (s, [0, .04, .06, .066, .06, .08, .1, .1, .085, .06, .04]),
                                  ([0, 1], [0, 0]))
    nose, ped = OTTER['nose'], OTTER['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=28, n=48)]
    vz.eyes(parts, [[x(0.06), yc(0.06) + 0.35 * h(0.06), s * 0.75 * w(0.06)] for s in (1, -1)], 0.011)
    for s in (1, -1):
        ev, ef = c.sphere([x(0.12), yc(0.12) + 0.8 * h(0.12), s * 0.85 * w(0.12)], 0.012, 6, 4)
        parts.append(part(ev, ef, c.same_uv(ef, (vz.FIN_BACK, 0.2))))
        # Short fore paws, folded on the chest.
        parts.append(vz.strip_fin([(-0.01, -0.02), (0.0, 0.02), (0.06, 0.03), (0.09, 0.0), (0.06, -0.02)],
                                  [x(0.27), yc(0.27) - 0.7 * h(0.27), s * 0.6 * w(0.27)],
                                  [1, -0.3, 0], [0, 0, s], 0.03, vz.FIN_BELLY))
        # Broad webbed hind feet, splayed behind.
        parts.append(vz.strip_fin([(-0.02, -0.03), (0.0, 0.03), (0.08, 0.06), (0.16, 0.07), (0.18, 0.02),
                                   (0.15, -0.03), (0.06, -0.04)],
                                  [x(0.8), yc(0.8) - 0.3 * h(0.8), s * 0.8 * w(0.8)],
                                  [-1, 0, s * 0.5], [0, 1, 0], 0.012, vz.FIN_BACK))
    # The flat tail.
    parts.append(vz.strip_fin([(-0.02, 0.03), (0.1, 0.035), (0.2, 0.03), (0.26, 0.0), (0.2, -0.03),
                               (0.1, -0.035), (-0.02, -0.03)],
                              [ped + 0.02, yc(1), 0], [-1, 0, 0], [0, 0, 1], 0.02, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, OTTER['length'], 0.12)


def otter_maps():
    def back(s, u, v):
        return lerp([0.26, 0.17, 0.1], [0.2, 0.13, 0.08], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def face(col, s, e, u, v):
        head = 1 - smooth(0.14, 0.22, s)
        grizzle = 0.75 + 0.25 * fbm(u * 2, v, 30, 3)
        return lerp(col, np.array([0.78, 0.7, 0.58]) * grizzle[..., None], 0.85 * head)
    return vz.fish_body_maps('otter', back, [0.3, 0.2, 0.13], lambda s, u, v: -0.9 + 0 * s,
                             extra=face, fins=([0.17, 0.11, 0.07], [0.2, 0.13, 0.08]), rough_body=0.75)


# ------------------------------------------------------------------ leopard shark

LEO = {'length': 1.5, 'nose': 0.75, 'peduncle': -0.55}


def leopard():
    s = [0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1]
    h, w, yc, x = vz.body_profile(LEO['length'], LEO['nose'], LEO['peduncle'],
                                  (s, [0, .014, .025, .035, .042, .043, .038, .03, .02, .014]),
                                  (s, [0, .018, .03, .04, .046, .045, .038, .028, .018, .012]),
                                  ([0, 0.1, 1], [-.004, 0, .003]))
    nose, ped = LEO['nose'], LEO['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.85, m=28, n=52)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.85 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    vz.eyes(parts, [[x(0.07), yc(0.07) + 0.3 * h(0.07), s * 0.85 * w(0.07)] for s in (1, -1)], 0.007)
    dorsal = [(-0.01, -0.03), (0.0, 0.01), (0.03, 0.06), (0.06, 0.09), (0.09, 0.08), (0.1, 0.04), (0.14, 0.0),
              (0.12, -0.03)]
    parts.append(vz.strip_fin(dorsal, [x(0.35), top(0.35), 0], back, up, 0.012, vz.FIN_BACK))
    parts.append(vz.strip_fin(dorsal, [x(0.62), top(0.62), 0], back, up, 0.01, vz.FIN_BACK))
    parts.append(vz.strip_fin(dorsal, [x(0.66), bottom(0.66), 0], back, down, 0.01, vz.FIN_BELLY))
    for side in (1, -1):
        parts.append(vz.strip_fin([(-0.02, -0.02), (0.0, 0.02), (0.05, 0.08), (0.1, 0.13), (0.13, 0.12),
                                   (0.12, 0.05), (0.14, 0.0), (0.1, -0.02)],
                                  [x(0.22), yc(0.22) - 0.5 * h(0.22), side * 0.8 * w(0.22)],
                                  [-1, -0.1, 0], [0, -0.4, side], 0.012, vz.FIN_BELLY))
        parts.append(vz.strip_fin([(-0.01, -0.02), (0.0, 0.01), (0.04, 0.05), (0.07, 0.05), (0.08, 0.01),
                                   (0.05, -0.02)],
                                  [x(0.48), yc(0.48) - 0.7 * h(0.48), side * 0.5 * w(0.48)],
                                  [-1, -0.15, 0], [0, -0.6, side], 0.008, vz.FIN_BELLY))
    parts.append(vz.strip_fin([(-0.06, 0.03), (0.04, 0.05), (0.14, 0.1), (0.24, 0.15), (0.3, 0.16), (0.28, 0.1),
                               (0.22, 0.03), (0.16, -0.02), (0.12, -0.06), (0.06, -0.06), (0.0, -0.04),
                               (-0.06, -0.03)],
                              [ped + 0.02, yc(1), 0], back, up, 0.012, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, LEO['length'], 0.2)


def leopard_maps():
    def back(s, u, v):
        return lerp([0.52, 0.46, 0.38], [0.46, 0.41, 0.34], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def saddles(col, s, e, u, v):
        bars = (0.5 + 0.5 * np.cos(s * 2 * np.pi * 7)) ** 6 * smooth(0.0, 0.5, e)
        spots = (fbm(u * 3, v, 36, 41) > 0.7) * smooth(-0.3, 0.2, e)
        out = lerp(col, [0.14, 0.12, 0.1], 0.85 * bars)
        return lerp(out, [0.16, 0.14, 0.12], 0.75 * spots)
    return vz.fish_body_maps('leopardshark', back, [0.9, 0.86, 0.78],
                             lambda s, u, v: -0.25 + 0.05 * (fbm(u, v, 8, 9) - 0.5),
                             extra=saddles, fins=([0.42, 0.37, 0.3], [0.7, 0.66, 0.58]), rough_body=0.45)


# ------------------------------------------------------------------ harbour seal

SEAL = {'length': 1.6, 'nose': 0.8, 'peduncle': -0.66}


def seal():
    s = [0, 0.02, 0.05, 0.1, 0.16, 0.24, 0.4, 0.6, 0.78, 0.9, 1]
    h, w, yc, x = vz.body_profile(SEAL['length'], SEAL['nose'], SEAL['peduncle'],
                                  (s, [0, .03, .05, .068, .072, .08, .11, .115, .09, .05, .025]),
                                  (s, [0, .03, .05, .068, .074, .085, .115, .12, .095, .055, .025]),
                                  ([0, 0.1, 1], [-.004, .004, 0]))
    nose, ped = SEAL['nose'], SEAL['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=32, n=56)]
    vz.eyes(parts, [[x(0.08), yc(0.08) + 0.35 * h(0.08), s * 0.82 * w(0.08)] for s in (1, -1)], 0.02)
    for s in (1, -1):
        # Short fore flippers held to the sides.
        parts.append(vz.strip_fin([(-0.02, -0.03), (0.0, 0.03), (0.08, 0.05), (0.15, 0.04), (0.17, 0.0),
                                   (0.12, -0.03)],
                                  [x(0.3), yc(0.3) - 0.6 * h(0.3), s * 0.85 * w(0.3)],
                                  [-1, -0.3, s * 0.3], [0, 0, s], 0.02, vz.FIN_BACK))
    # Hind flippers: a broad fan behind, both together, sweeping side to side.
    hip = np.array([ped + 0.04, yc(1), 0.0])
    fan = []
    for s in (1, -1):
        f = vz.strip_fin([(-0.02, -0.04), (0.0, 0.04), (0.1, 0.07), (0.2, 0.11), (0.24, 0.12), (0.25, 0.05),
                          (0.22, 0.0), (0.25, -0.05), (0.2, -0.06), (0.1, -0.05)],
                         hip + [0, 0, s * 0.02], [-1, 0, s * 0.18], [0, 1, 0], 0.016, vz.FIN_BACK)
        fan.append(f)
    shape = merge(parts + fan)
    return vz.side_stroke(shape, nose, SEAL['length'], 0.2)


def seal_maps():
    def back(s, u, v):
        return lerp([0.5, 0.5, 0.48], [0.36, 0.37, 0.37], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def freckles(col, s, e, u, v):
        spots = (fbm(u * 4, v * 2, 48, 17) > 0.66).astype(float)
        return lerp(col, [0.14, 0.14, 0.15], 0.7 * spots * smooth(-0.6, 0.0, e))
    return vz.fish_body_maps('seal', back, [0.74, 0.72, 0.66],
                             lambda s, u, v: -0.3 + 0.06 * (fbm(u, v, 8, 5) - 0.5),
                             extra=freckles, fins=([0.3, 0.3, 0.3], [0.4, 0.4, 0.39]), rough_body=0.35)


# ------------------------------------------------------------------ western gull

GULL = {'length': 0.6, 'nose': 0.3, 'peduncle': -0.22}


def gull():
    s = [0, 0.04, 0.1, 0.16, 0.24, 0.4, 0.6, 0.8, 1]
    h, w, yc, x = vz.body_profile(GULL['length'], GULL['nose'], GULL['peduncle'],
                                  (s, [0, .015, .05, .055, .07, .11, .12, .08, .025]),
                                  (s, [0, .012, .045, .05, .065, .1, .1, .07, .03]),
                                  ([0, 0.15, 0.3, 1], [.03, .04, .02, .02]))
    nose, ped = GULL['nose'], GULL['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=24, n=40)]
    # The bill (a short yellow blade forward of the head: shaded via the fin strip's tip).
    parts.append(vz.strip_fin([(-0.02, 0.0), (0.0, 0.012), (0.06, 0.008), (0.08, -0.004), (0.0, -0.01)],
                              [nose - 0.02, yc(0.02), 0], [1, -0.1, 0], [0, 1, 0], 0.012, vz.FIN_BELLY,
                              tip=lambda a, b: 0 * a + 1))
    vz.eyes(parts, [[x(0.12), yc(0.12) + 0.3 * h(0.12), s * 0.8 * w(0.12)] for s in (1, -1)], 0.008)
    # Wings: long, narrow, pointed; they beat about the body's long axis at the shoulder.
    wing_outline = [(-0.03, -0.02), (0.0, 0.06), (0.06, 0.18), (0.1, 0.32), (0.08, 0.5), (0.02, 0.66),
                    (-0.06, 0.7), (-0.1, 0.6), (-0.12, 0.4), (-0.12, 0.2), (-0.1, 0.05), (-0.06, -0.02)]
    for s in (1, -1):
        shoulder = np.array([x(0.35), yc(0.35) + 0.4 * h(0.35), s * 0.7 * w(0.35)])
        f = vz.strip_fin(wing_outline, shoulder, [1, 0, 0], [0, 0.05, s], 0.012, vz.FIN_BACK,
                         tip=lambda a, b: smooth(0.5, 0.66, np.abs(b)))
        f['keys'] = flipper_keys(f['v'], shoulder, [1, 0, 0], s * 0.7, -s * 0.55)
        parts.append(f)
    # A short fanned tail and pink feet tucked under.
    parts.append(vz.strip_fin([(-0.02, 0.03), (0.06, 0.05), (0.1, 0.04), (0.11, 0.0), (0.1, -0.04), (0.06, -0.05),
                               (-0.02, -0.03)], [ped + 0.02, yc(1), 0], [-1, 0, 0], [0, 0, 1], 0.008, vz.FIN_BACK))
    for s in (1, -1):
        parts.append(vz.strip_fin([(-0.01, -0.01), (0.0, 0.01), (0.05, 0.02), (0.06, 0.0), (0.05, -0.02)],
                                  [x(0.62), yc(0.62) - 0.9 * h(0.62), s * 0.3 * w(0.62)],
                                  [-1, -0.4, 0], [0, 0, 1], 0.006, vz.FIN_BELLY))
    shape = merge(parts)
    if 'keys' not in shape:
        no_keys(shape)
    return shape


def gull_maps():
    def back(s, u, v):
        return lerp([0.95, 0.95, 0.94], [0.9, 0.9, 0.9], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))
    # Fin strips: wings slate grey with black tips (FIN_BACK, v near 1), bill/feet yellow-pink.
    out = vz.fish_body_maps('gull', back, [0.97, 0.97, 0.96], lambda s, u, v: -2 + 0 * s,
                            fins=([0.42, 0.45, 0.5], [0.95, 0.75, 0.25]), rough_body=0.6)
    return out


if __name__ == '__main__':
    c.CREATURES['otter'] = ('sea-otter', 'Otter_Root', otter, otter_maps)
    c.CREATURES['leopard'] = ('leopard-shark', 'LeopardShark_Root', leopard, leopard_maps)
    c.CREATURES['seal'] = ('harbour-seal', 'Seal_Root', seal, seal_maps)
    c.CREATURES['gull'] = ('western-gull', 'Gull_Root', gull, gull_maps)
    for n in (sys.argv[1:] or ['otter', 'leopard', 'seal', 'gull']):
        c.build(n)
