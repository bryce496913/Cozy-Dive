"""v0.6 Pass 042: the outer reef's great barracuda.

    python3 tools/art/pass042/barracuda.py    # Blender 5.1 module
    node tools/art/pass017/compress.mjs       # then compress

Built like the other creatures (Pass 025's and Pass 033's helpers): game space (+X forward, +Y
up), one `Barracuda_Root` holding a single `Body` mesh with one material and `Stroke_Left` /
`Stroke_Right` morphs, and a decimated `Body_LOD1`. About 1.4 m long: a long, slender, nearly
round body with a pointed head and a jutting lower jaw, big eyes, two small dorsal fins set far
apart, small pectorals and a broad forked tail. Silver, darker grey-blue above, with dusky bars
on the upper sides, scattered dark spots towards the tail and a dark tail with pale tips.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass042'
smooth, lerp, merge, fbm = c.smooth, c.lerp, c.merge, c.fbm

CUDA = {'length': 1.4, 'nose': 0.72, 'peduncle': -0.6}


def cuda_profile():
    s = [0, 0.02, 0.06, 0.12, 0.2, 0.32, 0.5, 0.68, 0.82, 0.92, 1]
    return vz.body_profile(
        CUDA['length'], CUDA['nose'], CUDA['peduncle'],
        (s, [0, .008, .018, .03, .04, .046, .046, .04, .028, .018, .014]),
        (s, [0, .006, .014, .024, .032, .036, .036, .031, .022, .014, .011]),
        ([0, 0.04, 0.15, 0.5, 1], [-.004, -.002, .002, .002, .002]))


def barracuda():
    h, w, yc, x = cuda_profile()
    nose, ped = CUDA['nose'], CUDA['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.95, m=24, n=48)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.9 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    # The jutting lower jaw: a thin blade under the snout, reaching past it.
    parts.append(vz.strip_fin([(-0.03, 0.0), (0.0, 0.004), (0.1, 0.006), (0.12, 0.0), (0.1, -0.008), (0.0, -0.008)],
                              [nose - 0.1, yc(0.03) - 0.6 * h(0.03), 0], [1, 0.08, 0], [0, 0, 1], 0.02,
                              vz.FIN_BELLY))
    vz.eyes(parts, [[x(0.07), yc(0.07) + 0.3 * h(0.07), s * 0.85 * w(0.07)] for s in (1, -1)], 0.011)
    # Two small dorsals far apart, and the anal fin under the second.
    first = [(-0.01, -0.02), (0.0, 0.01), (0.03, 0.06), (0.06, 0.08), (0.08, 0.06), (0.1, 0.02), (0.12, -0.02)]
    parts.append(vz.strip_fin(first, [x(0.36), top(0.36), 0], back, up, 0.008, vz.FIN_BACK))
    small = [(-0.01, -0.02), (0.0, 0.01), (0.02, 0.05), (0.05, 0.06), (0.06, 0.03), (0.09, 0.0), (0.08, -0.02)]
    parts.append(vz.strip_fin(small, [x(0.7), top(0.7), 0], back, up, 0.006, vz.FIN_BACK))
    parts.append(vz.strip_fin(small, [x(0.72), bottom(0.72), 0], back, down, 0.006, vz.FIN_BELLY))
    for side in (1, -1):
        parts.append(vz.strip_fin([(-0.01, -0.01), (0.0, 0.015), (0.04, 0.05), (0.07, 0.06), (0.08, 0.04),
                                   (0.06, 0.0), (0.03, -0.01)],
                                  [x(0.2), yc(0.2) - 0.4 * h(0.2), side * 0.85 * w(0.2)],
                                  [-1, -0.2, 0], [0, -0.5, side], 0.006, vz.FIN_BACK))
        parts.append(vz.strip_fin([(-0.01, -0.01), (0.0, 0.01), (0.03, 0.035), (0.06, 0.04), (0.06, 0.01),
                                   (0.03, -0.01)],
                                  [x(0.4), bottom(0.4), side * 0.4 * w(0.4)],
                                  [-1, 0, 0], [0, -0.7, side], 0.005, vz.FIN_BELLY))
    # A broad forked tail.
    parts.append(vz.strip_fin([(-0.04, 0.03), (0.03, 0.05), (0.1, 0.11), (0.17, 0.17), (0.19, 0.16),
                               (0.13, 0.08), (0.11, 0.0), (0.13, -0.08), (0.19, -0.16), (0.17, -0.17),
                               (0.1, -0.11), (0.03, -0.05), (-0.04, -0.03)],
                              [ped + 0.02, yc(1), 0], back, up, 0.01, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, CUDA['length'], 0.12)


def cuda_maps():
    def back(s, u, v):
        return lerp([0.66, 0.7, 0.72], [0.34, 0.4, 0.45], smooth(0.3, 1.0, -np.cos(2 * np.pi * v)))

    def marks(col, s, e, u, v):
        # Dusky bars on the upper sides, and scattered dark spots towards the tail.
        bars = (0.5 + 0.5 * np.sin(s * 2 * np.pi * 9)) ** 4 * smooth(0.15, 0.3, s) * (1 - smooth(0.8, 0.9, s))
        out = lerp(col, [0.22, 0.26, 0.3], 0.45 * bars * smooth(-0.1, 0.5, e)[...])
        spots = (fbm(u * 3, v, 40, 77) > 0.72) * smooth(0.55, 0.75, s) * (e > -0.4)
        return lerp(out, [0.1, 0.11, 0.12], 0.7 * spots)
    return vz.fish_body_maps('barracuda', back, [0.88, 0.9, 0.9],
                             lambda s, u, v: -0.1 + 0.05 * (fbm(u, v, 8, 51) - 0.5),
                             extra=marks, fins=([0.2, 0.22, 0.25], [0.6, 0.63, 0.65]), rough_body=0.3)


if __name__ == '__main__':
    c.CREATURES['barracuda'] = ('barracuda', 'Barracuda_Root', barracuda, cuda_maps)
    c.build('barracuda')
