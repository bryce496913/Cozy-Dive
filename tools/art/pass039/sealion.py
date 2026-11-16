"""v0.6 Pass 039: the kelp forest's California sea lion.

    python3 tools/art/pass039/sealion.py      # Blender 5.1 module
    node tools/art/pass017/compress.mjs       # then compress

Built like the other creatures (Pass 025's and Pass 033's helpers): game space (+X forward, +Y
up), one `SeaLion_Root` holding a single `Body` mesh with one material and `Stroke_Left` /
`Stroke_Right` morphs, and a decimated `Body_LOD1`. About 2 m long: a sleek, torpedo body with a
thick neck, a rounded dog-like head with a short snout, small ear flaps and big dark eyes; long
fore flippers and paired hind flippers trailing behind. Sea lions swim with their fore flippers,
so its stroke sweeps them down and back (`Stroke_Left`) and up and forward (`Stroke_Right`), the
body flexing a little with them. Warm brown above, golden tan below.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass039'
smooth, unit, lerp, part, merge, fbm = c.smooth, c.unit, c.lerp, c.part, c.merge, c.fbm

LION = {'length': 2.0, 'nose': 1.0, 'peduncle': -0.92}


def lion_profile():
    s = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.45, 0.6, 0.75, 0.88, 1]
    return vz.body_profile(
        LION['length'], LION['nose'], LION['peduncle'],
        (s, [0, .022, .036, .05, .056, .062, .085, .1, .094, .07, .042, .02]),
        (s, [0, .02, .032, .046, .05, .055, .08, .096, .088, .062, .036, .016]),
        ([0, 0.05, 0.12, 0.3, 0.6, 1], [-.004, .002, .008, .004, -.002, .002]))


def flipper_keys(v, pivot, axis, down, up):
    """Morph displacements for a flipper rotating about `axis` through `pivot` by the two angles."""
    rel = v - pivot
    return {'Stroke_Left': rel @ c.rotation(axis, down).T - rel,
            'Stroke_Right': rel @ c.rotation(axis, up).T - rel}


def sea_lion():
    h, w, yc, x = lion_profile()
    nose, ped = LION['nose'], LION['peduncle']
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=0.92, m=32, n=60)]
    back = [-1, 0, 0]
    # Eyes: big and dark, set forward on the head.
    vz.eyes(parts, [[x(0.08), yc(0.08) + 0.45 * h(0.08), s * 0.82 * w(0.08)] for s in (1, -1)], 0.016)
    # Small ear flaps behind the eyes.
    for s in (1, -1):
        ev, ef = c.sphere([x(0.16), yc(0.16) + 0.6 * h(0.16), s * 0.9 * w(0.16)], 0.012, 8, 6)
        ev[:, 0] = x(0.16) + (ev[:, 0] - x(0.16)) * 1.8
        parts.append(part(ev, ef, c.same_uv(ef, (vz.FIN_BACK, 0.2))))
    # Fore flippers: long and broad, from the chest, angled out and back; they sweep about the
    # body's long axis (tilted) at the shoulder.
    for s in (1, -1):
        shoulder = np.array([x(0.3), yc(0.3) - 0.55 * h(0.3), s * 0.75 * w(0.3)])
        outline = [(-0.02, -0.05), (0.0, 0.05), (0.1, 0.09), (0.22, 0.1), (0.34, 0.085), (0.42, 0.05),
                   (0.44, 0.0), (0.4, -0.04), (0.28, -0.05), (0.14, -0.06), (0.04, -0.06)]
        f = vz.strip_fin(outline, shoulder, [-0.45, -0.2, s * 0.87], [1, 0, 0], 0.03, vz.FIN_BACK)
        f['keys'] = flipper_keys(f['v'], shoulder, [1, 0.15, 0], -s * 0.55, s * 0.5)
        parts.append(f)
    # Hind flippers: a pair trailing behind, splayed a little, fanned like webbed feet.
    for s in (1, -1):
        hip = np.array([ped + 0.06, yc(1) - 0.005, s * 0.022])
        outline = [(-0.02, -0.03), (0.0, 0.03), (0.1, 0.05), (0.2, 0.08), (0.26, 0.09), (0.27, 0.05),
                   (0.24, 0.02), (0.27, -0.01), (0.26, -0.05), (0.18, -0.05), (0.08, -0.04)]
        f = vz.strip_fin(outline, hip, [-1, 0, s * 0.22], [0, 0, 1], 0.02, vz.FIN_BACK)
        f['keys'] = flipper_keys(f['v'], hip, [0, 0, 1], 0.22, -0.22)
        parts.append(f)
    shape = merge(parts)
    # The body flexes a little with the stroke: the hindquarters dip as the flippers sweep down.
    q = (nose - shape['v'][:, 0]) / LION['length']
    bend = 0.05 * smooth(0.45, 1.0, q) ** 1.5
    d = np.zeros_like(shape['v'])
    d[:, 1] = bend
    shape['keys'] = {'Stroke_Left': shape['keys']['Stroke_Left'] - d,
                     'Stroke_Right': shape['keys']['Stroke_Right'] + d}
    return shape


def lion_maps():
    def back(s, u, v):
        return lerp([0.4, 0.29, 0.18], [0.3, 0.21, 0.13], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def face(col, s, e, u, v):
        # A darker muzzle and nose, and whisker pads.
        muzzle = 1 - smooth(0.02, 0.07, s)
        out = lerp(col, [0.2, 0.15, 0.1], 0.6 * muzzle)
        pads = (1 - smooth(0.035, 0.06, s)) * smooth(0.02, 0.035, s) * (1 - smooth(0.2, 0.6, np.abs(e)))
        return lerp(out, [0.62, 0.52, 0.4], 0.5 * pads)
    return vz.fish_body_maps('sealion', back, [0.66, 0.53, 0.36],
                             lambda s, u, v: -0.25 + 0.05 * (fbm(u, v, 8, 91) - 0.5),
                             extra=face, fins=([0.22, 0.16, 0.11], [0.3, 0.23, 0.16]), rough_body=0.38)


if __name__ == '__main__':
    c.CREATURES['sealion'] = ('sea-lion', 'SeaLion_Root', sea_lion, lion_maps)
    c.build('sealion')
