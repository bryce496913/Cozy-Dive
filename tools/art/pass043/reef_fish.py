"""v0.6 Pass 043: more outer-reef fish, reshaped from the accepted chromis rig (Pass 016's method).

    python3 tools/art/pass043/reef_fish.py [name ...]   # Blender 5.1 module; builds and adds LOD1
    node tools/art/pass017/compress.mjs                 # then compress

Each keeps the chromis rig's topology, Stroke_Left / Stroke_Right morphs and pectoral pivots (so
the runtime drives them like every reef fish), and gains its own proportions and colour pattern:

  * blue tang (Paracanthurus): oval, royal blue with a black "palette" band and a yellow tail;
  * threadfin butterflyfish: a deep disc, pale with dark chevrons, a yellow rear, black eye bar;
  * Moorish idol: a tall disc with a long white dorsal streamer, black and white bars, yellow
    rear and an orange saddle on the snout;
  * longfin bannerfish: like the idol's shape, white with two black bars, yellow fins, a streamer;
  * parrotfish: a heavy, blunt-headed fish in teal and green with pink edging and a pale beak;
  * bigeye trevally: streamlined and silver with a darker back, big eyes and a yellowish tail;
  * humphead (Napoleon) wrasse: very large, with a bulging forehead, green-blue with fine wavy lines.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass016'))
sys.path.insert(0, str(HERE.parent / 'pass017'))
import fish as F  # noqa: E402  (Pass 016 reshape pipeline; imports bpy)
import fish_lod as L  # noqa: E402
import numpy as np  # noqa: E402

ss = F.smoothstep

NEW = {
    'bluetang': dict(id='blue-tang', name='Blue_Tang', length=0.62, height=0.3, width=0.1, eye=1.15,
                     iris=(0.1, 0.1, 0.14), fin_height=1.15),
    'butterflyfish': dict(id='threadfin-butterflyfish', name='Butterflyfish', length=0.5, height=0.36, width=0.08,
                          eye=1.1, iris=(0.12, 0.1, 0.1), fin_height=1.25),
    'idol': dict(id='moorish-idol', name='Moorish_Idol', length=0.5, height=0.4, width=0.08, eye=1.1,
                 iris=(0.15, 0.12, 0.1), fin_height=1.5, pennant=6.5),
    'bannerfish': dict(id='longfin-bannerfish', name='Bannerfish', length=0.55, height=0.4, width=0.085,
                       eye=1.15, iris=(0.15, 0.12, 0.1), fin_height=1.4, pennant=5.5),
    'parrotfish': dict(id='parrotfish', name='Parrotfish', length=1.1, height=0.36, width=0.2, eye=0.85,
                       iris=(0.9, 0.55, 0.2), hump=0.05),
    'trevally': dict(id='bigeye-trevally', name='Trevally', length=0.9, height=0.3, width=0.12, eye=1.35,
                     iris=(0.2, 0.2, 0.22)),
    'napoleon': dict(id='humphead-wrasse', name='Humphead_Wrasse', length=2.4, height=0.82, width=0.4, eye=0.55,
                     iris=(0.75, 0.45, 0.15), hump=0.28),
}
F.SPECIES.update(NEW)

_apply = F.apply


def apply(points, basis, spec, fin):
    out = _apply(points, basis, spec, fin)
    if spec.get('hump'):
        # A bulging forehead: the top of the head lifted, most just behind the eyes.
        u = (basis[:, 0] + 0.255) / F.CHROMIS['length']
        v = basis[:, 1] / F.CHROMIS['half']
        w = ss(0.62, 0.78, u) * (1 - ss(0.86, 1.0, u)) * ss(0.0, 0.7, v) * (not fin)
        out[:, 1] += spec['hump'] * w
        out[:, 0] += spec['hump'] * 0.3 * w
    return out


F.apply = apply
_pattern = F.pattern


def mix(col, other, t):
    t = np.broadcast_to(np.clip(np.asarray(t, float), 0, 1), (len(col),))[:, None]
    return col * (1 - t) + np.asarray(other, float) * t


def band(u, a, b, soft=0.015):
    return ss(a - soft, a + soft, u) * (1 - ss(b - soft, b + soft, u))


def pattern(name, p, fin):
    if name not in NEW:
        return _pattern(name, p, fin)
    u = (p[:, 0] + 0.255) / F.CHROMIS['length']
    v = p[:, 1] / F.CHROMIS['half']
    n = len(p)
    if name == 'bluetang':
        col = np.tile([0.1, 0.32, 0.86], (n, 1))
        # The black palette: a band from the eye curving back along the upper side, with a loop.
        d = np.abs(v - (0.35 + 0.35 * np.sin((u - 0.2) * 3.2)))
        pal = ss(0.28, 0.12, d) * ss(0.2, 0.3, u) * (1 - ss(0.8, 0.88, u))
        col = mix(col, [0.03, 0.04, 0.08], pal)
        col = mix(col, [0.98, 0.84, 0.1], 1 - ss(0.1, 0.16, u))
        if fin:
            col = mix(col, [0.03, 0.04, 0.08], ss(1.1, 1.6, np.abs(v)) * (u > 0.16))
    elif name == 'butterflyfish':
        col = np.tile([0.95, 0.94, 0.88], (n, 1))
        chev = (0.5 + 0.5 * np.sin((u * 1.4 + np.abs(v) * 0.6) * 38)) ** 6 * ss(0.3, 0.45, u)
        col = mix(col, [0.32, 0.3, 0.28], 0.6 * chev)
        col = mix(col, [0.98, 0.78, 0.1], ss(0.42, 0.3, u))
        col = mix(col, [0.05, 0.05, 0.06], band(u, 0.8, 0.86, 0.01))
        if fin:
            spot = ss(0.06, 0.03, np.hypot(p[:, 0] + 0.08, (p[:, 1] - 0.12) * 0.7)) * (v > 1)
            col = mix(col, [0.05, 0.05, 0.06], spot)
    elif name == 'idol':
        col = np.tile([0.97, 0.95, 0.88], (n, 1))
        col = mix(col, [0.99, 0.86, 0.2], ss(0.55, 0.45, u) * ss(0.25, 0.32, u))
        col = mix(col, [0.04, 0.04, 0.05], band(u, 0.62, 0.78))
        col = mix(col, [0.04, 0.04, 0.05], band(u, 0.28, 0.4))
        col = mix(col, [0.96, 0.5, 0.12], band(u, 0.86, 0.95) * (v > 0.1))
        col = mix(col, [0.04, 0.04, 0.05], 1 - ss(0.08, 0.12, u))
        if fin:
            col = mix(col, [0.99, 0.99, 0.97], (v > 1.6) * (u > 0.5))
    elif name == 'bannerfish':
        col = np.tile([0.97, 0.97, 0.94], (n, 1))
        # Two black bars running down and back.
        s = u + 0.12 * v
        col = mix(col, [0.04, 0.04, 0.05], band(s, 0.66, 0.78))
        col = mix(col, [0.04, 0.04, 0.05], band(s, 0.36, 0.5) * (v < 0.9))
        if fin:
            col = mix(col, [0.99, 0.86, 0.15], (u < 0.36) | (v < -1.0))
            col = mix(col, [0.99, 0.99, 0.97], (v > 1.4) * (u > 0.45))
        else:
            col = mix(col, [0.99, 0.86, 0.15], 1 - ss(0.1, 0.16, u))
    elif name == 'parrotfish':
        col = np.tile([0.16, 0.66, 0.6], (n, 1))
        scales = (0.5 + 0.5 * np.sin(u * 140) * np.sin(v * 9)) ** 4
        col = mix(col, [0.86, 0.46, 0.55], 0.45 * scales)
        col = mix(col, [0.12, 0.42, 0.62], ss(0.4, 1.0, v))
        col = mix(col, [0.86, 0.9, 0.8], ss(0.93, 0.98, u))  # the beak
        if fin:
            col = mix(col, [0.86, 0.46, 0.55], ss(1.1, 1.6, np.abs(v)))
    elif name == 'trevally':
        col = np.tile([0.8, 0.83, 0.85], (n, 1))
        col = mix(col, [0.26, 0.34, 0.42], ss(0.15, 0.8, v))
        col = mix(col, [0.94, 0.95, 0.95], ss(-0.2, -0.8, v))
        if fin:
            col = mix(col, [0.7, 0.62, 0.3], (u < 0.16))
    else:  # napoleon
        col = np.tile([0.18, 0.5, 0.5], (n, 1))
        waves = (0.5 + 0.5 * np.sin(u * 60 + np.sin(v * 7) * 2)) ** 8
        col = mix(col, [0.1, 0.3, 0.32], 0.5 * waves)
        col = mix(col, [0.35, 0.68, 0.55], ss(-0.2, -0.9, v))
        eye = ss(0.06, 0.02, np.abs(v - 0.25)) * band(u, 0.86, 0.97)
        col = mix(col, [0.12, 0.22, 0.24], 0.7 * eye)
        if fin:
            col = mix(col, [0.12, 0.36, 0.42], 0.5)
    if not fin:
        col = col * (1 - ss(0.3, 1.0, v)[:, None] * 0.12)
    return np.clip(col, 0, 1)


F.pattern = pattern

if __name__ == '__main__':
    F.neutral_maps()
    names = sys.argv[1:] or list(NEW)
    for k in names:
        F.build(k)
        L.SOURCES[k] = L.FISH / f'{k}.glb'
        L.build(k)
