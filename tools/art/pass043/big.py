"""v0.6 Pass 043: the outer reef's rare encounters: a great white shark and an ocean sunfish.

    python3 tools/art/pass043/big.py [greatwhite|sunfish]   # Blender 5.1 module
    node tools/art/pass017/compress.mjs                      # then compress

Built like Pass 033's visitors (whose helpers this reuses): game space (+X forward, +Y up), one
`<Name>_Root` holding a single `Body` mesh with `Stroke_Left` / `Stroke_Right` morphs and a
decimated `Body_LOD1`; scaled at runtime.

  * great white (authored 3 m): a heavy torpedo with a conical snout, black eyes, five long gill
    slits, a tall triangular first dorsal, long pectorals, a keeled tail stock and a crescent tail
    with near-equal lobes; slate grey above, a sharp, ragged line to white below, dark pectoral tips;
  * ocean sunfish (authored 1.2 m long, 1.7 m from fin tip to fin tip): a tall, flattened disc
    with no true tail, only the rippled clavus; tall dorsal and anal fins that beat together side
    to side (its whole stroke), a small round mouth and small pectorals; silvery grey, mottled.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass043'
smooth, lerp, merge, fbm = c.smooth, c.lerp, c.merge, c.fbm

WHITE = {'length': 3.0, 'nose': 1.5, 'peduncle': -1.05}


def white_profile():
    s = [0, 0.02, 0.06, 0.12, 0.2, 0.32, 0.45, 0.6, 0.75, 0.88, 1]
    return vz.body_profile(
        WHITE['length'], WHITE['nose'], WHITE['peduncle'],
        (s, [0, .016, .036, .058, .078, .092, .094, .084, .062, .036, .022]),
        (s, [0, .016, .034, .054, .072, .084, .086, .074, .05, .028, .02]),
        ([0, 0.05, 0.3, 0.7, 1], [-.012, -.004, .004, .004, .006]))


def great_white():
    h, w, yc, x = white_profile()
    nose, ped = WHITE['nose'], WHITE['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.85, m=36, n=64)]
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.85 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    vz.eyes(parts, [[x(0.07), yc(0.07) + 0.2 * h(0.07), s * 0.9 * w(0.07)] for s in (1, -1)], 0.017)
    # A tall, triangular first dorsal.
    parts.append(vz.strip_fin([(-0.02, -0.08), (0.0, 0.02), (0.06, 0.16), (0.12, 0.3), (0.17, 0.4), (0.21, 0.42),
                               (0.23, 0.36), (0.25, 0.2), (0.3, 0.06), (0.4, 0.0), (0.34, -0.08)],
                              [x(0.3), top(0.3), 0], back, up, 0.04, vz.FIN_BACK))
    small = [(-0.01, -0.03), (0.0, 0.01), (0.03, 0.05), (0.05, 0.07), (0.07, 0.04), (0.1, 0.01), (0.09, -0.03)]
    parts.append(vz.strip_fin(small, [x(0.78), top(0.78), 0], back, up, 0.015, vz.FIN_BACK))
    parts.append(vz.strip_fin(small, [x(0.8), bottom(0.8), 0], back, down, 0.015, vz.FIN_BELLY))
    for side in (1, -1):
        # Long, swept pectorals with dark tips (shaded in the maps).
        parts.append(vz.strip_fin([(-0.03, -0.05), (0.0, 0.03), (0.06, 0.16), (0.14, 0.3), (0.22, 0.42),
                                   (0.27, 0.46), (0.27, 0.38), (0.22, 0.24), (0.21, 0.1), (0.25, 0.0), (0.18, -0.05)],
                                  [x(0.27), yc(0.27) - 0.5 * h(0.27), side * 0.82 * w(0.27)],
                                  [-1, -0.12, 0], [0, -0.38, side], 0.035, vz.FIN_BELLY))
        parts.append(vz.strip_fin([(-0.02, -0.03), (0.0, 0.02), (0.05, 0.07), (0.1, 0.1), (0.12, 0.06),
                                   (0.14, 0.02), (0.1, -0.03)],
                                  [x(0.62), yc(0.62) - 0.7 * h(0.62), side * 0.5 * w(0.62)],
                                  [-1, -0.15, 0], [0, -0.6, side], 0.016, vz.FIN_BELLY))
        # A keel on the tail stock.
        parts.append(vz.strip_fin([(-0.02, -0.01), (0.0, 0.01), (0.1, 0.02), (0.2, 0.015), (0.22, 0.0)],
                                  [ped + 0.2, yc(0.95), side * 0.85 * w(0.95)], back, [0, 0, side], 0.012,
                                  vz.FIN_BACK))
        # Five long gill slits.
        for k in range(5):
            t = 0.17 + k * 0.022
            gv, gf = c.sphere([x(t), yc(t) - 0.05 * h(t), side * 0.97 * w(t)], 0.006, 6, 4)
            gv[:, 1] = yc(t) + (gv[:, 1] - yc(t)) * 12 - 0.05 * h(t) * 11
            parts.append(c.part(gv, gf, c.same_uv(gf, (vz.FIN_BACK, 0.04))))
    # A crescent tail, its lobes nearly equal.
    parts.append(vz.strip_fin([(-0.08, 0.06), (0.04, 0.09), (0.16, 0.22), (0.3, 0.4), (0.4, 0.52), (0.42, 0.48),
                               (0.34, 0.3), (0.26, 0.1), (0.25, 0.0), (0.27, -0.1), (0.33, -0.28), (0.38, -0.42),
                               (0.35, -0.44), (0.24, -0.3), (0.12, -0.16), (0.02, -0.08), (-0.08, -0.05)],
                              [ped + 0.04, yc(1), 0], back, up, 0.03, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, WHITE['length'], 0.26)


def white_maps():
    def back(s, u, v):
        return lerp([0.42, 0.45, 0.47], [0.33, 0.36, 0.38], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))
    return vz.fish_body_maps('greatwhite', back, [0.94, 0.94, 0.92],
                             lambda s, u, v: 0.05 + 0.16 * (fbm(u, v, 10, 23) - 0.5) + 0.06 * np.sin(s * 40),
                             fins=([0.3, 0.32, 0.34], [0.16, 0.17, 0.18]), rough_body=0.45)


MOLA = {'length': 1.2, 'nose': 0.55, 'peduncle': -0.62}


def mola_profile():
    s = [0, 0.03, 0.08, 0.16, 0.3, 0.5, 0.7, 0.86, 0.95, 1]
    return vz.body_profile(
        MOLA['length'], MOLA['nose'], MOLA['peduncle'],
        (s, [0, .1, .17, .24, .3, .32, .3, .25, .2, .17]),
        (s, [0, .03, .05, .07, .085, .09, .085, .07, .05, .035]),
        ([0, 1], [0, 0]))


def sunfish():
    h, w, yc, x = mola_profile()
    nose, ped = MOLA['nose'], MOLA['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=32, n=40)]
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    vz.eyes(parts, [[x(0.12), yc(0.12) + 0.25 * h(0.12), s * 0.9 * w(0.12)] for s in (1, -1)], 0.028)
    # Tall dorsal and anal fins, set far back; they beat together, side to side.
    tall = [(-0.04, -0.06), (0.0, 0.05), (0.04, 0.22), (0.08, 0.42), (0.12, 0.52), (0.16, 0.5), (0.18, 0.36),
            (0.2, 0.18), (0.22, 0.0), (0.18, -0.06)]
    fins = [vz.strip_fin(tall, [x(0.72), yc(0.72) + 0.9 * h(0.72), 0], back, up, 0.03, vz.FIN_BACK),
            vz.strip_fin(tall, [x(0.72), yc(0.72) - 0.9 * h(0.72), 0], back, down, 0.03, vz.FIN_BELLY)]
    # The clavus: a short, rippled frill round the back edge in place of a tail.
    frill = [(-0.03, 0.3), (0.06, 0.32), (0.1, 0.24), (0.08, 0.14), (0.11, 0.05), (0.08, -0.05), (0.11, -0.14),
             (0.08, -0.24), (0.1, -0.3), (0.0, -0.32), (-0.03, -0.3)]
    fins.append(vz.strip_fin(frill, [ped + 0.08, yc(1), 0], back, up, 0.025, vz.FIN_BACK))
    for side in (1, -1):
        parts.append(vz.strip_fin([(-0.01, -0.03), (0.0, 0.02), (0.04, 0.06), (0.08, 0.07), (0.09, 0.03),
                                   (0.06, -0.03)],
                                  [x(0.22), yc(0.22), side * 0.95 * w(0.22)], [-1, 0.2, 0], [0, 0, side], 0.012,
                                  vz.FIN_BACK))
    # A small round mouth.
    mv, mf = c.sphere([nose - 0.005, yc(0), 0], 0.025, 8, 6)
    parts.append(c.part(mv, mf, c.same_uv(mf, (vz.FIN_BACK, 0.04))))
    body = merge(parts)
    fin = merge(fins)
    # The stroke: the tall fins sweep side to side about their roots (the body barely moves).
    rel_y = np.abs(fin['v'][:, 1] - yc(0.72))
    sweep = 0.38 * smooth(0.0, 0.7, rel_y / 0.7) * (fin['v'][:, 0] < x(0.6))
    d = np.zeros_like(fin['v'])
    d[:, 2] = sweep
    fin['keys'] = {'Stroke_Left': d, 'Stroke_Right': -d}
    zero = np.zeros_like(body['v'])
    body['keys'] = {'Stroke_Left': zero, 'Stroke_Right': zero.copy()}
    return merge([body, fin])


def mola_maps():
    def back(s, u, v):
        return lerp([0.62, 0.64, 0.64], [0.44, 0.47, 0.5], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def mottle(col, s, e, u, v):
        m = smooth(0.55, 0.75, fbm(u * 2, v, 14, 61))
        return lerp(col, [0.78, 0.79, 0.77], 0.45 * m)
    return vz.fish_body_maps('sunfish', back, [0.74, 0.75, 0.74],
                             lambda s, u, v: -0.4 + 0.05 * (fbm(u, v, 8, 7) - 0.5),
                             extra=mottle, fins=([0.42, 0.45, 0.48], [0.5, 0.52, 0.53]), rough_body=0.55)


if __name__ == '__main__':
    c.CREATURES['greatwhite'] = ('great-white-shark', 'GreatWhite_Root', great_white, white_maps)
    c.CREATURES['sunfish'] = ('ocean-sunfish', 'Sunfish_Root', sunfish, mola_maps)
    for n in (sys.argv[1:] or ['greatwhite', 'sunfish']):
        c.build(n)
