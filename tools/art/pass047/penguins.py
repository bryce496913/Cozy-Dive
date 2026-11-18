"""v0.6 Pass 047: Antarctic penguins.

    python3 tools/art/pass047/penguins.py [emperor|adelie]   # Blender 5.1 module
    node tools/art/pass017/compress.mjs                       # then compress

Built like the other creatures (Pass 025/033 helpers): game space (+X forward, +Y up), one
`<Name>_Root` with a single `Body` mesh (`Stroke_Left` / `Stroke_Right` morphs) and a decimated
`Body_LOD1`. Underwater a penguin flies with its flippers, so its stroke is the flipper beat:
`Stroke_Left` sweeps them down and back, `Stroke_Right` up and forward; its feet trail behind.

  * emperor (authored 1.15 m): a long, heavy torpedo with a small head and a long, slightly
    down-curved bill; blue-black back and head, white belly washing to pale yellow at the breast,
    bright orange-yellow ear patches, an orange stripe on the lower bill;
  * Adélie (authored 0.7 m): compact and round-headed with a short stubby bill; black head and back,
    white belly, a white ring round each eye.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass047'
smooth, lerp, merge, fbm, part = c.smooth, c.lerp, c.merge, c.fbm, c.part


def flipper_keys(v, pivot, axis, down, up):
    rel = v - pivot
    return {'Stroke_Left': rel @ c.rotation(axis, down).T - rel,
            'Stroke_Right': rel @ c.rotation(axis, up).T - rel}


def penguin(length, bill, head_w, plump):
    nose, ped = length * 0.5, -length * 0.42
    s = [0, 0.04, 0.1, 0.16, 0.24, 0.36, 0.5, 0.65, 0.8, 0.92, 1]
    h, w, yc, x = vz.body_profile(length, nose, ped,
                                  (s, [0, .03, head_w, head_w * 0.95, .1 * plump, .13 * plump, .14 * plump,
                                       .13 * plump, .1 * plump, .06, .02]),
                                  (s, [0, .03, head_w, head_w * 0.95, .1 * plump, .13 * plump, .14 * plump,
                                       .13 * plump, .1 * plump, .06, .02]),
                                  ([0, 1], [0, 0]))
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.0, m=28, n=48)]
    # The bill: a tapering blade forward of the head (dark; the emperor's lower edge is orange).
    parts.append(vz.strip_fin([(-0.01, 0.0), (0.0, 0.012), (bill * 0.6, 0.008), (bill, -0.003),
                               (bill * 0.6, -0.008), (0.0, -0.01)],
                              [nose - 0.01, yc(0.02) - 0.01, 0], [1, -0.12, 0], [0, 1, 0], 0.016, vz.FIN_BACK))
    vz.eyes(parts, [[x(0.08), yc(0.08) + 0.35 * h(0.08), sd * 0.82 * w(0.08)] for sd in (1, -1)],
            0.011 * length / 0.7)
    for sd in (1, -1):
        # Flippers: long, flat and stiff, from the shoulders.
        shoulder = np.array([x(0.3), yc(0.3) + 0.2 * h(0.3), sd * 0.9 * w(0.3)])
        L = length * 0.38
        outline = [(-0.02, -0.03), (0.0, 0.03), (L * 0.3, 0.05), (L * 0.7, 0.045), (L, 0.01),
                   (L * 0.85, -0.02), (L * 0.4, -0.035)]
        f = vz.strip_fin(outline, shoulder, [-0.5, -0.15, sd * 0.85], [1, 0, 0], 0.012, vz.FIN_BACK)
        f['keys'] = flipper_keys(f['v'], shoulder, [1, 0.1, 0], sd * 0.6, -sd * 0.5)
        parts.append(f)
        # Feet trailing behind, pale pink-grey (shaded as belly).
        parts.append(vz.strip_fin([(-0.01, -0.02), (0.0, 0.02), (0.06, 0.03), (0.08, 0.0), (0.06, -0.03)],
                                  [ped + 0.06, yc(0.95) - 0.6 * h(0.95), sd * 0.05], [-1, -0.1, sd * 0.2],
                                  [0, 0, 1], 0.008, vz.FIN_BELLY))
    # A short wedge of tail.
    parts.append(vz.strip_fin([(-0.01, 0.02), (0.05, 0.02), (0.08, 0.0), (0.05, -0.02), (-0.01, -0.02)],
                              [ped + 0.02, yc(1), 0], [-1, 0, 0], [0, 0, 1], 0.008, vz.FIN_BACK))
    shape = merge(parts)
    if 'keys' not in shape:
        z = np.zeros_like(shape['v'])
        shape['keys'] = {'Stroke_Left': z, 'Stroke_Right': z.copy()}
    return shape


def emperor():
    return penguin(1.15, 0.16, 0.065, 1.05)


def adelie():
    return penguin(0.7, 0.07, 0.085, 1.1)


def maps(name, emperor_marks):
    def back(s, u, v):
        return lerp([0.06, 0.07, 0.1], [0.1, 0.12, 0.16], smooth(0.3, 1.0, -np.cos(2 * np.pi * v)))

    def marks(col, s, e, u, v):
        if emperor_marks:
            # Pale yellow breast and bright orange-yellow ear patches.
            breast = smooth(0.12, 0.2, s) * (1 - smooth(0.3, 0.45, s)) * smooth(-0.1, -0.6, e)
            col = lerp(col, [1.0, 0.9, 0.55], 0.6 * breast)
            ear = smooth(0.1, 0.13, s) * (1 - smooth(0.17, 0.21, s)) * (1 - smooth(0.0, 0.35, np.abs(e + 0.05)))
            col = lerp(col, [1.0, 0.68, 0.12], 0.95 * ear)
        else:
            # A white ring round each eye.
            ring = (1 - smooth(0.012, 0.02, np.abs(np.hypot(s - 0.08, (e - 0.5) * 0.12) - 0.025)))
            col = lerp(col, [0.97, 0.97, 0.97], ring * (s < 0.14))
        return col
    edge = (lambda s, u, v: 0.15 - 0.6 * smooth(0.0, 0.16, s)) if emperor_marks else (lambda s, u, v: 0.2 - 0.9 * smooth(0.0, 0.14, s))
    return vz.fish_body_maps(name, back, [0.95, 0.95, 0.93], edge, extra=marks,
                             fins=([0.07, 0.08, 0.1], [0.75, 0.65, 0.6]), rough_body=0.45)


if __name__ == '__main__':
    c.CREATURES['emperor'] = ('emperor-penguin', 'EmperorPenguin_Root', emperor, lambda: maps('emperor', True))
    c.CREATURES['adelie'] = ('adelie-penguin', 'AdeliePenguin_Root', adelie, lambda: maps('adelie', False))
    for n in (sys.argv[1:] or ['emperor', 'adelie']):
        c.build(n)
