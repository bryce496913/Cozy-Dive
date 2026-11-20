"""V0.7 Pass 067: species specifications for tools/art/pass067/creatures.py.

Sizes and root names match the shipped models (so encounters, scales and sightings are unchanged).
Profiles use s = 0 at the tail root and 1 at the snout tip, in fractions of `hm` / `wm`.
"""
import numpy as np

SHARK_H = [(0, .16), (.08, .22), (.2, .42), (.35, .7), (.5, .92), (.62, 1), (.74, .94), (.84, .78), (.92, .52),
           (.97, .28), (1, .06)]
SHARK_W = [(0, .2), (.1, .3), (.3, .65), (.55, 1), (.75, .95), (.88, .75), (.95, .5), (1, .1)]
SHARK_MID = [(0, 0), (.6, .03), (.9, -.02), (1, .02)]


def mix(col, mask, colour):
    m = np.clip(mask, 0, 1)[..., None]
    return col * (1 - m) + np.asarray(colour, float) * m


def flat(S, c):
    return np.tile(np.asarray(c, float), S.shape + (1,))


def counter(S, yn, smooth, back, belly, line=0.0, soft=0.25):
    """A countershaded body: `back` above, `belly` below, the boundary at yn = line."""
    t = smooth(line - soft, line + soft, yn)
    return flat(S, belly) * (1 - t[..., None]) + flat(S, back) * t[..., None]


def gills(col, S, T, yn, smooth, at=0.8, n=5, gap=0.018, colour=(0.2, 0.22, 0.24)):
    m = 0
    for i in range(n):
        m = np.maximum(m, smooth(0.004, 0.0, np.abs(S - (at - i * gap))) * (np.abs(yn) < 0.45) * (np.abs(np.sin(T)) > 0.4))
    return mix(col, m * 0.7, colour)


def reef_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.36, .4, .43), (.9, .9, .88), -0.15, 0.2)
    col *= (1 + 0.04 * noise(25, 3))[..., None]
    return gills(col, S, T, yn, smooth)


def whitetip_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.38, .4, .4), (.88, .88, .86), -0.25, 0.3)
    return gills(col * (1 + 0.04 * noise(25, 4))[..., None], S, T, yn, smooth)


def greatwhite_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    edge = -0.1 + 0.12 * np.sin(S * 23) * 0.4 + 0.06 * noise(8, 5)
    col = counter(S, yn - edge, smooth, (.3, .32, .34), (.94, .94, .93), 0.0, 0.05)
    return gills(col, S, T, yn, smooth, at=0.79, gap=0.02)


def hammer_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.42, .45, .46), (.9, .9, .87), -0.2, 0.25)
    return gills(col * (1 + 0.03 * noise(25, 6))[..., None], S, T, yn, smooth, at=0.82)


def leopard_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.55, .52, .45), (.9, .88, .82), -0.3, 0.3)
    saddles = smooth(.55, .8, np.sin(S * 2 * np.pi * 7)) * smooth(-.1, .5, yn)
    col = mix(col, saddles * .8, (.18, .16, .14))
    spots = smooth(1.3, 1.7, noise(3, 7)) * smooth(-.6, 0, yn)
    return mix(col, spots, (.2, .18, .15))


def nurse_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.5, .4, .28), (.72, .64, .5), -0.5, 0.4)
    return col * (1 + 0.05 * noise(15, 8))[..., None]


def whaleshark_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.25, .32, .4), (.88, .9, .9), -0.35, 0.15)
    gx, gy = S * 70, (yn + 1) * 9
    spots = smooth(.25, .15, np.hypot(gx - np.round(gx), gy - np.round(gy))) * (yn > -.35)
    stripes = smooth(.02, .0, np.abs((gy % 1) - .5) - .47) * (yn > -.3) * (S < .85) * 0.0
    col = mix(col, spots + stripes, (.86, .88, .86))
    return gills(col, S, T, yn, smooth, at=0.8, gap=0.02)


def barracuda_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.4, .46, .5), (.86, .88, .9), 0.05, 0.3)
    chev = smooth(.85, .95, np.sin(S * 2 * np.pi * 18 + yn * 3)) * smooth(.0, .45, yn) * (S < .82)
    col = mix(col, chev * .6, (.2, .22, .25))
    return mix(col, smooth(-.2, -.8, yn) * smooth(.1, 0, S) * 0, (0, 0, 0))


def eagle_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.16, .19, .24), (.94, .94, .92), 0.0, 0.15)
    dots = smooth(1.1, 1.4, noise(2.5, 9)) * (yn > 0)
    return mix(col, dots, (.92, .92, .9))


def manta_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.14, .15, .18), (.93, .93, .92), 0.0, 0.12)
    shoulder = smooth(.7, .45, np.abs(S - .75) * 3) * smooth(.3, .8, yn)
    return mix(col, shoulder * .35, (.75, .76, .78))


def turtle_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    # Carapace scutes on top, a pale plastron below.
    gx, gy = S * 5.5, (np.arctan2(np.sin(T), np.cos(T)) / np.pi) * 3
    scute = np.minimum(np.abs(gx - np.round(gx)), np.abs(gy - np.round(gy)))
    col = flat(S, (.45, .36, .22)) * (1 + 0.12 * noise(6, 10))[..., None]
    col = mix(col, smooth(.06, .02, scute) * (yn > -.2), (.25, .2, .12))
    col = mix(col, smooth(-.2, -.5, yn), (.85, .78, .55))
    head = smooth(.78, .82, S)
    tiles = smooth(.15, .05, np.abs(np.sin(S * 120) * np.sin(T * 9)))
    return mix(col, head * tiles * .5, (.3, .24, .14))


def sunfish_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.55, .58, .6), (.86, .87, .86), 0.1, 0.5)
    blotch = smooth(1.0, 1.5, noise(12, 11)) * 0.4
    return mix(col, blotch, (.42, .44, .46))


def humpback_paint(S, T, x, y, z, yn, an, noise, smooth, **_):
    col = counter(S, yn, smooth, (.16, .18, .2), (.86, .87, .86), -0.45, 0.2)
    pleats = smooth(.85, .98, np.abs(np.sin(T * 30))) * smooth(-.4, -.7, yn) * smooth(.5, .65, S)
    col = mix(col, pleats * .6, (.4, .4, .42))
    tubercles = smooth(1.4, 1.8, noise(1.6, 12)) * smooth(.9, .95, S) * (yn > 0)
    return mix(col, tubercles, (.3, .3, .32))


def shark(root, total, lc, hm, wm, paint, fin, **kw):
    s = dict(family='shark', loco='lateral', root=root, body=total - lc * 0.95, caudal=lc, hm=hm, wm=wm, n=2.1,
             belly=0.05, height=SHARK_H, width=SHARK_W, mid=SHARK_MID, eye=dict(s=.9, y=.2, r=.12),
             dorsal1=dict(s=(.48, .66), h=1.6, peak=.32, rake=.5), dorsal2=dict(s=(.12, .18), h=.35),
             anal=dict(s=(.1, .16), h=.3), pectoral=dict(s=.72, len=total * .17, sweep=.55), paint=paint, fin=fin,
             rough=.55)
    s.update(kw)
    return s


SPECIES = {
    'reef-shark': shark('Shark', 2.95, .68, .2, .16, reef_paint, (.36, .4, .43), tip=(.1, .1, .12), tip_at=.85),
    'whitetip-shark': shark('Whitetip', 2.95, .68, .18, .15, whitetip_paint, (.38, .4, .4), tip=(.96, .96, .94),
                            tip_at=.72, dorsal1=dict(s=(.46, .62), h=1.5, peak=.3, rake=.6)),
    'great-white-shark': shark('GreatWhite', 2.94, .6, .27, .23, greatwhite_paint, (.3, .32, .34), lower=.9,
                               dorsal1=dict(s=(.5, .66), h=1.35, peak=.35, rake=.35),
                               height=[(0, .14), (.08, .2), (.2, .44), (.35, .74), (.5, .95), (.62, 1), (.74, .95),
                                       (.84, .8), (.92, .58), (.97, .34), (1, .1)]),
    'hammerhead': shark('Hammerhead', 3.07, .78, .17, .14, hammer_paint, (.42, .45, .46), lower=.4,
                        dorsal1=dict(s=(.52, .64), h=2.2, peak=.3, rake=.3, sharp=1.6),
                        height=[(0, .16), (.08, .22), (.2, .42), (.35, .7), (.5, .92), (.62, 1), (.74, .94), (.84, .74),
                                (.9, .5), (.94, .32), (.97, .22), (1, .16)],
                        width=[(0, .2), (.1, .3), (.3, .65), (.55, 1), (.75, .95), (.88, .7), (.92, .6), (.95, 2.4),
                               (.985, 3.2), (1, 1.2)], eye=dict(s=.975, y=0, r=.2)),
    'leopard-shark': shark('LeopardShark', 1.58, .36, .085, .085, leopard_paint, (.5, .47, .4),
                           dorsal1=dict(s=(.5, .62), h=1.3, peak=.35, rake=.5), dorsal2=dict(s=(.22, .3), h=.9),
                           pectoral=dict(s=.72, len=.22, sweep=.45)),
    'nurse-shark': shark('NurseShark', 2.57, .7, .13, .2, nurse_paint, (.48, .38, .26), n=2.4, upper=.45, lower=.1,
                         dorsal1=dict(s=(.3, .42), h=1.1, peak=.5, rake=.3, sharp=.6),
                         dorsal2=dict(s=(.16, .26), h=.9), pectoral=dict(s=.7, len=.38, sweep=.3),
                         height=[(0, .2), (.1, .3), (.3, .6), (.5, .9), (.62, 1), (.78, .9), (.9, .65), (.97, .4),
                                 (1, .2)]),
    'whale-shark': shark('WhaleShark', 2.95, .6, .2, .24, whaleshark_paint, (.25, .32, .4), lower=.9, upper=1.05,
                         dorsal1=dict(s=(.38, .5), h=1.0, peak=.35, rake=.45),
                         height=[(0, .16), (.1, .26), (.3, .62), (.5, .92), (.65, 1), (.8, .92), (.9, .78), (.97, .55),
                                 (1, .35)],
                         width=[(0, .2), (.1, .3), (.3, .65), (.55, 1), (.8, 1.0), (.92, .92), (.98, .75), (1, .5)],
                         eye=dict(s=.93, y=.0, r=.08)),
    'barracuda': shark('Barracuda', 1.51, .26, .07, .055, barracuda_paint, (.42, .46, .5), upper=1.0, lower=1.0,
                       n=2.0, dorsal1=dict(s=(.56, .62), h=.8, peak=.3, rake=.4),
                       dorsal2=dict(s=(.2, .26), h=.7), anal=dict(s=(.18, .24), h=.6),
                       pectoral=dict(s=.74, len=.12, sweep=.4), eye=dict(s=.9, y=.25, r=.25), rough=.38,
                       height=[(0, .25), (.1, .4), (.3, .75), (.5, .95), (.65, 1), (.8, .9), (.9, .65), (.96, .38),
                               (1, .12)]),
    'eagle-ray': dict(family='ray', loco='flap', root='Ray', body=.9, caudal=0, tail=3.4, hm=.09, wm=.16, n=2.0,
                      belly=0.05, span=1.42, chord=.8, wing_s=(.2, .82), height=SHARK_H, width=SHARK_W,
                      mid=[(0, 0), (1, -.1)], eye=dict(s=.9, y=.5, r=.25), paint=eagle_paint, fin=(.16, .19, .24),
                      rough=.5),
    'manta-ray': dict(family='ray', loco='flap', root='Manta', body=1.8, caudal=0, tail=.55, hm=.12, wm=.3, n=2.0,
                      belly=0.05, span=1.95, chord=1.3, wing_s=(.15, .85), horns=True,
                      height=[(0, .3), (.2, .7), (.5, 1), (.8, .9), (1, .5)],
                      width=[(0, .3), (.2, .7), (.5, 1), (.8, .95), (1, .8)], mid=[(0, 0), (1, 0)],
                      eye=dict(s=.93, y=.2, r=.15), paint=manta_paint, fin=(.14, .15, .18), rough=.5),
    'sea-turtle': dict(family='turtle', loco='flipper', root='Turtle', body=.95, caudal=0, hm=.17, wm=.5, n=2.2,
                       belly=-0.3, height=[(0, .25), (.15, .6), (.4, .95), (.6, 1), (.8, .85), (.95, .45), (1, .15)],
                       width=[(0, .3), (.15, .65), (.4, .95), (.6, 1), (.8, .85), (.95, .45), (1, .15)],
                       mid=[(0, 0), (1, 0)], paint=turtle_paint, fin=(.38, .3, .2), rough=.6),
    'ocean-sunfish': dict(family='sunfish', loco='scull', root='Sunfish', body=1.1, caudal=.16, hm=.42, wm=.16,
                          n=2.3, belly=0.0, fin_h=1.0,
                          height=[(0, .7), (.15, .85), (.4, 1), (.7, .95), (.9, .7), (1, .3)],
                          width=[(0, .5), (.3, .9), (.6, 1), (.9, .7), (1, .3)], mid=[(0, 0), (1, 0)],
                          eye=dict(s=.86, y=.3, r=.08), paint=sunfish_paint, fin=(.52, .55, .58), rough=.6),
    'humpback-whale': dict(family='whale', loco='fluke', root='Humpback', body=2.6, caudal=.3, hm=.27, wm=.3, n=2.0,
                           belly=0.05, flipper=.75, fluke=.45,
                           height=[(0, .14), (.12, .3), (.3, .65), (.5, .92), (.65, 1), (.8, .92), (.92, .68),
                                   (.98, .4), (1, .16)],
                           width=[(0, .16), (.12, .3), (.3, .65), (.5, .95), (.65, 1), (.8, .95), (.92, .7),
                                  (1, .2)], mid=[(0, 0), (.9, -.02), (1, -.1)],
                           eye=dict(s=.82, y=-.2, r=.04), paint=humpback_paint, fin=(.2, .22, .24),
                           tip=(.88, .88, .86), tip_at=.55, rough=.55),
}
