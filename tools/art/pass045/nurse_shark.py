"""v0.6 Pass 045: the sea cave's nurse shark.

    python3 tools/art/pass045/nurse_shark.py   # Blender 5.1 module
    node tools/art/pass017/compress.mjs        # then compress

Built like the other creatures (Pass 025/033 helpers): one `NurseShark_Root` with a `Body` mesh
(`Stroke_Left` / `Stroke_Right` morphs) and a `Body_LOD1`. About 2.6 m long: a heavy, sluggish
shark with a broad, flattened, blunt head, small eyes, two fleshy barbels at the nostrils, two
large rounded dorsal fins set far back, broad rounded pectorals, and a very long tail whose upper
lobe trails almost straight back with hardly any lower lobe. Plain tawny brown, paler below.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass045'
smooth, lerp, merge, fbm, part = c.smooth, c.lerp, c.merge, c.fbm, c.part
NURSE = {'length': 2.6, 'nose': 1.3, 'peduncle': -0.75}


def nurse():
    s = [0, 0.02, 0.05, 0.1, 0.18, 0.3, 0.45, 0.6, 0.75, 0.88, 1]
    h, w, yc, x = vz.body_profile(NURSE['length'], NURSE['nose'], NURSE['peduncle'],
                                  (s, [0, .012, .022, .032, .042, .05, .05, .044, .034, .022, .014]),
                                  (s, [0, .03, .044, .054, .06, .062, .056, .045, .032, .02, .013]),
                                  ([0, 0.1, 1], [-.006, -.002, .004]))
    nose, ped = NURSE['nose'], NURSE['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.7, m=32, n=60, flat=0.6)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.7 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    vz.eyes(parts, [[x(0.08), yc(0.08) + 0.4 * h(0.08), s * 0.9 * w(0.08)] for s in (1, -1)], 0.009)
    for s in (1, -1):
        # Two fleshy barbels hanging from the nostrils.
        parts.append(vz.strip_fin([(-0.005, 0.0), (0.0, 0.006), (0.05, 0.004), (0.06, -0.002), (0.0, -0.006)],
                                  [nose - 0.04, yc(0.02) - 0.6 * h(0.02), s * 0.03], [0.2, -1, 0], [0, 0, 1],
                                  0.01, vz.FIN_BELLY))
        # Broad, rounded pectorals.
        parts.append(vz.strip_fin([(-0.03, -0.05), (0.0, 0.03), (0.06, 0.14), (0.13, 0.24), (0.2, 0.28),
                                   (0.25, 0.25), (0.26, 0.15), (0.22, 0.05), (0.15, -0.04)],
                                  [x(0.22), yc(0.22) - 0.6 * h(0.22), s * 0.85 * w(0.22)],
                                  [-1, -0.1, 0], [0, -0.3, s], 0.03, vz.FIN_BELLY))
        parts.append(vz.strip_fin([(-0.02, -0.03), (0.0, 0.03), (0.06, 0.09), (0.12, 0.11), (0.15, 0.07),
                                   (0.14, 0.0), (0.08, -0.03)],
                                  [x(0.55), bottom(0.55), s * 0.5 * w(0.55)],
                                  [-1, -0.1, 0], [0, -0.5, s], 0.016, vz.FIN_BELLY))
    rounded = [(-0.02, -0.06), (0.0, 0.02), (0.04, 0.12), (0.1, 0.18), (0.16, 0.18), (0.2, 0.12), (0.22, 0.03),
               (0.24, -0.04), (0.18, -0.06)]
    parts.append(vz.strip_fin(rounded, [x(0.55), top(0.55), 0], back, up, 0.025, vz.FIN_BACK))
    parts.append(vz.strip_fin([(px * 0.85, py * 0.8) for px, py in rounded], [x(0.68), top(0.68), 0], back, up,
                              0.02, vz.FIN_BACK))
    parts.append(vz.strip_fin([(px * 0.7, py * 0.6) for px, py in rounded], [x(0.66), bottom(0.66), 0], back,
                              down, 0.016, vz.FIN_BELLY))
    # The long tail: upper lobe trailing almost straight back, hardly any lower lobe.
    parts.append(vz.strip_fin([(-0.08, 0.04), (0.1, 0.06), (0.3, 0.08), (0.48, 0.09), (0.55, 0.07), (0.56, 0.02),
                               (0.5, -0.04), (0.42, -0.07), (0.34, -0.06), (0.24, -0.03), (0.1, -0.05),
                               (0.02, -0.08), (-0.08, -0.04)],
                              [ped + 0.04, yc(1) + 0.01, 0], [-1, 0.06, 0], up, 0.024, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, NURSE['length'], 0.2)


def nurse_maps():
    def back(s, u, v):
        return lerp([0.5, 0.38, 0.24], [0.42, 0.32, 0.2], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))
    def relief(s,e,u,v):
        # Five gill slits behind the head, dermal denticles and the underside mouth fold.
        gills = sum(np.exp(-((s-(0.14+i*0.014))/0.0025)**2) for i in range(5))
        return 0.04*fbm(u*8,v*6,100,91) - 0.22*gills*(1-smooth(0.55,0.85,abs(e)))
    return vz.fish_body_maps('nurseshark', back, [0.7, 0.58, 0.42],
                             lambda s, u, v: -0.5 + 0.06 * (fbm(u, v, 8, 13) - 0.5),
                             fins=([0.44, 0.33, 0.21], [0.55, 0.44, 0.3]), rough_body=0.55, relief=relief)


if __name__ == '__main__':
    c.CREATURES['nurse'] = ('nurse-shark', 'NurseShark_Root', nurse, nurse_maps)
    c.build('nurse')
