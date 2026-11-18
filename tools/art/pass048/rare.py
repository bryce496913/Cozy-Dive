"""v0.6 Pass 048: the rare visitors under the ice.

    python3 tools/art/pass048/rare.py [leopard|minke|orca|bear]   # Blender 5.1 module
    node tools/art/pass017/compress.mjs                            # then compress

Built like the other creatures (Pass 025/033/044 helpers): one `<Name>_Root` with a `Body`
(`Stroke_Left` / `Stroke_Right` morphs) and a `Body_LOD1`; scaled at runtime.

  * leopard seal (authored 3 m): long and sinuous, with a huge, reptilian head and a wide gape,
    long fore flippers; silver-grey, darker above, spotted with black; hind flippers sweep sideways;
  * minke whale (authored 3 m, drawn about 7.5 m): sleek and pointed-snouted with a small, curved
    dorsal far back; dark grey above, white below, a white band across each flipper; it strokes with
    its flukes, up and down;
  * killer whale (authored 3 m, drawn about 7 m): robust, a rounded head, a tall dorsal fin, broad
    paddle flippers; black with the white eye patch, chin, belly and grey saddle; flukes up and down;
  * polar bear (authored 2.2 m): a long-necked bear paddling with its big fore paws (its stroke),
    hind legs trailing; creamy white fur, black nose and eyes.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass048'
smooth, lerp, merge, fbm, part = c.smooth, c.lerp, c.merge, c.fbm, c.part


def keys_about(v, pivot, axis, down, up):
    rel = v - pivot
    return {'Stroke_Left': rel @ c.rotation(axis, down).T - rel,
            'Stroke_Right': rel @ c.rotation(axis, up).T - rel}


def vertical_stroke(shape, nose, length, amount):
    """A whale's stroke: the tail end bends up and down (flukes)."""
    q = (nose - shape['v'][:, 0]) / length
    bend = amount * smooth(0.45, 1.0, q) ** 1.6
    d = np.zeros_like(shape['v'])
    d[:, 1] = bend
    shape['keys'] = {'Stroke_Left': d, 'Stroke_Right': -d}
    return shape


# ------------------------------------------------------------------ leopard seal

def leopard_seal():
    L, nose, ped = 3.0, 1.5, -1.3
    s = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.78, 0.9, 1]
    h, w, yc, x = vz.body_profile(L, nose, ped,
                                  (s, [0, .03, .05, .062, .06, .052, .06, .075, .074, .055, .03, .015]),
                                  (s, [0, .035, .058, .07, .066, .055, .065, .08, .078, .058, .032, .015]),
                                  ([0, 1], [0, 0]))
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=32, n=60, flat=0.3)]
    vz.eyes(parts, [[x(0.07), yc(0.07) + 0.4 * h(0.07), sd * 0.8 * w(0.07)] for sd in (1, -1)], 0.022)
    # The long gape: a dark line along each side of the head.
    for sd in (1, -1):
        gv, gf = c.sphere([x(0.05), yc(0.05) - 0.1 * h(0.05), sd * 0.93 * w(0.05)], 0.008, 6, 4)
        gv[:, 0] = x(0.05) + (gv[:, 0] - x(0.05)) * 14
        parts.append(part(gv, gf, c.same_uv(gf, (vz.FIN_BACK, 0.04))))
        fore = vz.strip_fin([(-0.03, -0.05), (0.0, 0.05), (0.15, 0.08), (0.32, 0.07), (0.42, 0.02), (0.38, -0.04),
                             (0.2, -0.06)], [x(0.25), yc(0.25) - 0.5 * h(0.25), sd * 0.85 * w(0.25)],
                            [-0.5, -0.3, sd * 0.8], [1, 0, 0], 0.03, vz.FIN_BACK)
        parts.append(fore)
    hip = np.array([ped + 0.05, yc(1), 0.0])
    for sd in (1, -1):
        parts.append(vz.strip_fin([(-0.02, -0.05), (0.0, 0.05), (0.15, 0.09), (0.3, 0.14), (0.34, 0.06), (0.3, 0.0),
                                   (0.34, -0.06), (0.25, -0.08), (0.12, -0.06)], hip + [0, 0, sd * 0.03],
                                  [-1, 0, sd * 0.18], [0, 1, 0], 0.02, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, L, 0.22)


def leopard_maps():
    def back(s, u, v):
        return lerp([0.62, 0.64, 0.66], [0.3, 0.32, 0.36], smooth(0.0, 1.0, -np.cos(2 * np.pi * v)))

    def spots(col, s, e, u, v):
        sp = (fbm(u * 4, v * 2, 40, 23) > 0.68).astype(float)
        return lerp(col, [0.1, 0.1, 0.12], 0.75 * sp)
    return vz.fish_body_maps('leopardseal', back, [0.8, 0.8, 0.8], lambda s, u, v: -0.1 + 0 * s, extra=spots,
                             fins=([0.3, 0.32, 0.35], [0.4, 0.42, 0.44]), rough_body=0.35)


# ------------------------------------------------------------------ whales

def whale(L, nose, ped, h_ys, w_ys, dorsal, flipper, flukes):
    s = [0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1]
    h, w, yc, x = vz.body_profile(L, nose, ped, (s, h_ys), (s, w_ys), ([0, 0.1, 1], [-0.005, 0, 0.004]))
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.9, m=36, n=64)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    vz.eyes(parts, [[x(0.12), yc(0.12) - 0.1 * h(0.12), sd * 0.95 * w(0.12)] for sd in (1, -1)], 0.012)
    parts.append(vz.strip_fin(dorsal[1], [x(dorsal[0]), top(dorsal[0]), 0], [-1, 0, 0], [0, 1, 0], 0.03, vz.FIN_BACK))
    for sd in (1, -1):
        parts.append(vz.strip_fin(flipper[1], [x(flipper[0]), yc(flipper[0]) - 0.6 * h(flipper[0]),
                                               sd * 0.85 * w(flipper[0])],
                                  [-0.6, -0.4, sd * 0.6], [1, 0, 0], 0.03, vz.FIN_BELLY))
    parts.append(vz.strip_fin(flukes, [ped + 0.04, yc(1), 0], [-1, 0, 0], [0, 0, 1], 0.025, vz.FIN_BACK))
    return vertical_stroke(merge(parts), nose, L, 0.18)


def minke():
    return whale(3.0, 1.5, -1.25,
                 [0, .03, .06, .085, .1, .105, .095, .075, .05, .03, .018],
                 [0, .035, .065, .09, .1, .1, .088, .066, .042, .024, .014],
                 (0.68, [(-0.01, -0.02), (0.0, 0.01), (0.04, 0.07), (0.07, 0.1), (0.08, 0.08), (0.1, 0.02),
                         (0.14, 0.0), (0.1, -0.02)]),
                 (0.24, [(-0.02, -0.04), (0.0, 0.04), (0.12, 0.05), (0.26, 0.03), (0.32, 0.0), (0.24, -0.03),
                         (0.1, -0.04)]),
                 [(-0.05, 0.03), (0.05, 0.05), (0.15, 0.18), (0.22, 0.3), (0.24, 0.28), (0.18, 0.12), (0.17, 0.0),
                  (0.18, -0.12), (0.24, -0.28), (0.22, -0.3), (0.15, -0.18), (0.05, -0.05), (-0.05, -0.03)])


def orca():
    return whale(3.0, 1.5, -1.2,
                 [0, .05, .09, .12, .14, .15, .14, .11, .075, .04, .02],
                 [0, .05, .09, .12, .135, .14, .125, .095, .06, .03, .016],
                 (0.42, [(-0.03, -0.04), (0.0, 0.02), (0.04, 0.2), (0.07, 0.4), (0.09, 0.5), (0.11, 0.48),
                         (0.13, 0.3), (0.18, 0.1), (0.24, 0.0), (0.18, -0.04)]),
                 (0.24, [(-0.03, -0.06), (0.0, 0.06), (0.1, 0.1), (0.2, 0.09), (0.28, 0.04), (0.28, -0.04),
                         (0.18, -0.08), (0.06, -0.07)]),
                 [(-0.05, 0.04), (0.06, 0.07), (0.16, 0.2), (0.22, 0.32), (0.25, 0.3), (0.2, 0.13), (0.19, 0.0),
                  (0.2, -0.13), (0.25, -0.3), (0.22, -0.32), (0.16, -0.2), (0.06, -0.07), (-0.05, -0.04)])


def minke_maps():
    def back(s, u, v):
        return lerp([0.4, 0.42, 0.45], [0.22, 0.24, 0.27], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))
    return vz.fish_body_maps('minke', back, [0.92, 0.92, 0.92], lambda s, u, v: -0.05 + 0 * s,
                             fins=([0.25, 0.27, 0.3], [0.85, 0.85, 0.85]), rough_body=0.4)


def orca_maps():
    def back(s, u, v):
        return np.zeros(s.shape + (3,)) + np.array([0.03, 0.03, 0.035])

    def marks(col, s, e, u, v):
        # The white eye patch, the grey saddle behind the dorsal fin, the white flank sweep.
        patch = (1 - smooth(0.04, 0.1, np.hypot((s - 0.17) * 2.0, (e - 0.2) * 0.8))) * (s < 0.3)
        col = lerp(col, [0.97, 0.97, 0.97], patch)
        saddle = smooth(0.4, 0.5, s) * (1 - smooth(0.55, 0.65, s)) * smooth(0.6, 0.85, e)
        col = lerp(col, [0.45, 0.46, 0.48], 0.8 * saddle)
        flank = smooth(0.55, 0.62, s) * (1 - smooth(0.75, 0.85, s)) * (1 - smooth(-0.4, 0.1, e))
        return lerp(col, [0.97, 0.97, 0.97], flank)
    return vz.fish_body_maps('orca', back, [0.97, 0.97, 0.97], lambda s, u, v: -0.35 + 0.2 * smooth(0.0, 0.2, s),
                             extra=marks, fins=([0.03, 0.03, 0.035], [0.05, 0.05, 0.06]), rough_body=0.3)


# ------------------------------------------------------------------ polar bear

def bear():
    L, nose, ped = 2.2, 1.1, -0.95
    s = [0, 0.03, 0.08, 0.14, 0.2, 0.28, 0.4, 0.55, 0.7, 0.85, 0.95, 1]
    h, w, yc, x = vz.body_profile(L, nose, ped,
                                  (s, [0, .03, .05, .06, .06, .075, .11, .13, .125, .1, .06, .02]),
                                  (s, [0, .03, .045, .055, .055, .07, .11, .13, .12, .095, .055, .02]),
                                  ([0, 0.2, 1], [0.01, 0.0, 0.0]))
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=32, n=60)]
    vz.eyes(parts, [[x(0.07), yc(0.07) + 0.45 * h(0.07), sd * 0.7 * w(0.07)] for sd in (1, -1)], 0.012)
    nv, nf = c.sphere([nose - 0.01, yc(0.01) + 0.01, 0], 0.025, 8, 6)
    parts.append(part(nv, nf, c.same_uv(nf, (vz.FIN_BACK, 0.04))))
    for sd in (1, -1):
        ev, ef = c.sphere([x(0.13), yc(0.13) + 0.85 * h(0.13), sd * 0.6 * w(0.13)], 0.022, 8, 6)
        parts.append(part(ev, ef, c.same_uv(ef, (vz.FIN_BELLY, 0.5))))
        # Fore legs and big paws, paddling (their sweep is the stroke).
        shoulder = np.array([x(0.3), yc(0.3) - 0.3 * h(0.3), sd * 0.7 * w(0.3)])
        leg = vz.strip_fin([(-0.04, -0.06), (0.0, 0.06), (0.2, 0.07), (0.38, 0.09), (0.44, 0.05), (0.44, -0.06),
                            (0.3, -0.07), (0.15, -0.06)], shoulder, [0.1, -1, sd * 0.25], [1, 0, 0], 0.08,
                           vz.FIN_BELLY)
        leg['keys'] = keys_about(leg['v'], shoulder, [0, 0, 1], 0.7, -0.6)
        parts.append(leg)
        hip = np.array([x(0.82), yc(0.82) - 0.3 * h(0.82), sd * 0.6 * w(0.82)])
        hind = vz.strip_fin([(-0.04, -0.06), (0.0, 0.06), (0.2, 0.07), (0.36, 0.08), (0.4, 0.0), (0.3, -0.07)],
                            hip, [-0.8, -0.5, sd * 0.2], [1, 0, 0], 0.08, vz.FIN_BELLY)
        hind['keys'] = keys_about(hind['v'], hip, [0, 0, 1], -0.25, 0.25)
        parts.append(hind)
    return merge(parts)


def bear_maps():
    def back(s, u, v):
        return lerp([0.96, 0.94, 0.86], [0.9, 0.87, 0.78], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def fur(col, s, e, u, v):
        return col * (0.92 + 0.08 * fbm(u * 6, v * 3, 60, 31))[..., None]
    return vz.fish_body_maps('polarbear', back, [0.94, 0.92, 0.84], lambda s, u, v: -2 + 0 * s, extra=fur,
                             fins=([0.05, 0.05, 0.05], [0.9, 0.87, 0.8]), rough_body=0.85)


if __name__ == '__main__':
    c.CREATURES['leopard'] = ('leopard-seal', 'LeopardSeal_Root', leopard_seal, leopard_maps)
    c.CREATURES['minke'] = ('minke-whale', 'Minke_Root', minke, minke_maps)
    c.CREATURES['orca'] = ('killer-whale', 'Orca_Root', orca, orca_maps)
    c.CREATURES['bear'] = ('polar-bear', 'PolarBear_Root', bear, bear_maps)
    for n in (sys.argv[1:] or ['leopard', 'minke', 'orca', 'bear']):
        c.build(n)
