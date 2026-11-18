"""v0.6 Pass 052 (playtest: "the otter needs to be better designed"): a new sea otter.

    python3 tools/art/pass052/otter.py          # Blender 5.1 module (bpy)
    node tools/art/pass017/compress.mjs         # then compress

Same contract as Pass 044's otter (it replaces `sea-otter.glb`): game space (+X forward, +Y up),
`Otter_Root` holding one `Body` mesh with `Stroke_Left` / `Stroke_Right` morphs and a decimated
`Body_LOD1`; 1.2 m nose to tail tip; it floats on its back (the runtime rolls it over).

What changed: the old otter was a fish-like loft with paws. This one is built as a mammal:
  * a chunky, buoyant body: broad chest and belly, a short neck and a big, broad, squarish head;
  * a short blunt muzzle with two plump whisker pads, a dark rounded nose and fans of pale whiskers;
  * small rounded ears set low on the sides of the head, and bright dark eyes high on the face;
  * stubby forearms ending in round paws, folded on the chest (as otters float);
  * big webbed hind feet with five toes, splayed behind, and a thick, flattened, tapering tail;
  * dense fur: a dark chocolate body with fine streaking (colour and relief), the head, throat and
    chest grizzled pale cream fading back into the brown.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
sys.path.insert(0, str(HERE.parent / 'pass033'))
import creatures as c  # noqa: E402
import visitors as vz  # noqa: E402
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass052'
smooth, lerp, merge, fbm, part = c.smooth, c.lerp, c.merge, c.fbm, c.part

OTTER = {'length': 0.9, 'nose': 0.6, 'peduncle': -0.3}
DARK = (vz.FIN_BACK, vz.EYE_V)


def tube(points, radii, sides=10, strip=vz.FIN_BACK):
    """A rounded limb along a polyline of `points` with `radii`, capped at both ends."""
    pts = [np.asarray(p, float) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = c.unit(pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
        a = c.unit(np.cross(t, [0, 1, 0]) if abs(t[1]) < 0.9 else np.cross(t, [1, 0, 0]))
        b = np.cross(t, a)
        th = 2 * np.pi * np.arange(sides) / sides
        rings.append(p + radii[i] * (np.cos(th)[:, None] * a + np.sin(th)[:, None] * b))
    tip0 = pts[0] - radii[0] * 0.6 * c.unit(pts[1] - pts[0])
    tip1 = pts[-1] + radii[-1] * 0.8 * c.unit(pts[-1] - pts[-2])
    v, f, station, ring = c.loft(rings, tip0, tip1)
    n = len(pts)
    return part(v, f, c.loft_uv(f, station, ring, sides, lambda i, j: (strip, 0.15 + 0.7 * np.clip(i / n, 0, 1))))


def blob(centre, radii, strip, v=0.5, segments=14, rings=10):
    """A squashed sphere (pads, ears, nose, paws)."""
    sv, sf = c.sphere([0, 0, 0], 1.0, segments, rings)
    sv = sv * np.asarray(radii, float) + np.asarray(centre, float)
    return part(sv, sf, c.same_uv(sf, (strip, v)))


def otter():
    L, nose, ped = OTTER['length'], OTTER['nose'], OTTER['peduncle']
    s = [0, 0.03, 0.07, 0.12, 0.17, 0.22, 0.3, 0.42, 0.56, 0.7, 0.84, 1]
    # Half-heights and half-widths (fractions of the body length): muzzle, big head, neck dip,
    # deep chest and belly, hips, the base of the tail.
    h, w, yc, x = vz.body_profile(L, nose, ped,
                                  (s, [0, .045, .075, .092, .088, .078, .1, .118, .122, .112, .09, .062]),
                                  (s, [0, .05, .088, .105, .1, .088, .112, .13, .135, .124, .1, .07]),
                                  (s, [0, -.004, .0, .004, .004, 0, -.004, -.006, -.004, 0, .004, .006]))
    parts = [vz.lofted_body((h, w, yc, x), nose, ped, belly=1.05, m=36, n=64, flat=0.35)]
    hx = lambda t: x(t)  # noqa: E731
    top = lambda t: yc(t) + h(t)  # noqa: E731
    # The face: plump whisker pads either side of the muzzle, a dark rounded nose above them.
    for side in (1, -1):
        parts.append(blob([hx(0.035), yc(0.035) - 0.2 * h(0.04), side * 0.5 * w(0.04)],
                          [0.03, 0.026, 0.03], vz.FIN_BELLY))
    parts.append(blob([hx(0.012) + 0.006, yc(0.012) + 0.25 * h(0.03), 0], [0.018, 0.016, 0.026], *DARK))
    # Eyes high and forward on the broad face, with a glint ring of dark fur round them.
    for side in (1, -1):
        e = [hx(0.085), yc(0.085) + 0.45 * h(0.085), side * 0.62 * w(0.085)]
        parts.append(blob(e, [0.014, 0.015, 0.014], *DARK))
        # Small rounded ears, low on the sides of the head.
        parts.append(blob([hx(0.16), yc(0.16) + 0.55 * h(0.16), side * 0.92 * w(0.16)],
                          [0.016, 0.02, 0.01], vz.FIN_BELLY, 0.6))
        # Whiskers: a fan of fine pale strips from each pad.
        for k, (up, spread) in enumerate(((0.012, 0.3), (0.0, 0.5), (-0.012, 0.7))):
            origin = [hx(0.035), yc(0.035) - 0.2 * h(0.04) + up, side * (0.5 * w(0.04) + 0.02)]
            parts.append(vz.strip_fin([(0, -0.0015), (0.07, -0.0008), (0.09, 0), (0.07, 0.0008), (0, 0.0015)],
                                      origin, [-0.15, up * 6, side * spread], [0, 1, 0], 0.0015, vz.FIN_BELLY))
    # Stubby forearms folded on the chest, ending in round paws (they float on their backs).
    for side in (1, -1):
        sh = [hx(0.3), yc(0.3) - 0.55 * h(0.3), side * 0.7 * w(0.3)]
        el = [sh[0] + 0.05, sh[1] - 0.07, side * 0.55 * w(0.3)]
        pw = [el[0] + 0.07, el[1] - 0.01, side * 0.2 * w(0.3)]
        parts.append(tube([sh, el, pw], [0.034, 0.028, 0.024]))
        parts.append(blob([pw[0] + 0.02, pw[1], pw[2]], [0.03, 0.022, 0.032], vz.FIN_BACK))
    # Big webbed hind feet, splayed behind the hips, five toes along the trailing edge.
    for side in (1, -1):
        hip = [hx(0.86), yc(0.86) - 0.4 * h(0.86), side * 0.85 * w(0.86)]
        ankle = [hip[0] - 0.08, hip[1] - 0.02, side * (0.85 * w(0.86) + 0.03)]
        parts.append(tube([hip, ankle], [0.04, 0.03]))
        outline = [(-0.01, -0.035), (0.03, -0.05)]
        for toe in range(5):
            b0 = -0.05 + toe * 0.025
            outline += [(0.17 + 0.02 * np.sin(toe * 1.3), b0 + 0.004), (0.15, b0 + 0.0125)]
        outline += [(0.03, 0.08), (-0.01, 0.04)]
        parts.append(vz.strip_fin(outline, ankle, [-1, 0, side * 0.45], [0, 1, 0], 0.014, vz.FIN_BACK))
    # The thick, flattened tail, tapering from the hips.
    parts.append(vz.strip_fin([(-0.03, 0.05), (0.08, 0.052), (0.2, 0.045), (0.3, 0.03), (0.34, 0.0),
                               (0.3, -0.03), (0.2, -0.045), (0.08, -0.052), (-0.03, -0.05)],
                              [ped + 0.04, yc(1), 0], [-1, 0, 0], [0, 0, 1], 0.045, vz.FIN_BACK))
    return vz.side_stroke(merge(parts), nose, L + 0.34, 0.1)


def otter_maps():
    def back(s, u, v):
        # Dark chocolate, a touch warmer along the flanks.
        return lerp([0.2, 0.13, 0.08], [0.16, 0.1, 0.06], smooth(0.2, 1.0, -np.cos(2 * np.pi * v)))

    def fur(col, s, e, u, v):
        # Fine streaks running along the body (dense fur), slightly lighter tips.
        streak = 0.82 + 0.18 * fbm(u * 0.6, v * 4, 70, 31, 3)
        col = col * streak[..., None]
        # Head, throat and chest grizzled pale cream, fading back into the brown.
        head = 1 - smooth(0.16, 0.3, s)
        chest = (1 - smooth(0.3, 0.5, s)) * smooth(-0.2, -0.7, e) * 0.6
        grizzle = 0.72 + 0.28 * fbm(u * 3, v * 2, 45, 32, 3)
        cream = np.array([0.8, 0.72, 0.6]) * grizzle[..., None]
        return lerp(col, cream, np.clip(0.9 * head + chest, 0, 0.92))

    def relief(s, e, u, v):
        return 0.7 * fbm(u * 0.6, v * 4, 90, 33, 3)

    return vz.fish_body_maps('otter', back, [0.24, 0.16, 0.1], lambda s, u, v: 0.4 + 0 * s,
                             extra=fur, fins=([0.13, 0.085, 0.055], [0.82, 0.74, 0.62]),
                             rough_body=0.8, relief=relief)


if __name__ == '__main__':
    c.CREATURES['otter'] = ('sea-otter', 'Otter_Root', otter, otter_maps)
    c.build('otter')
