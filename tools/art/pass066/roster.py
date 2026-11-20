"""V0.7 Pass 066: the rest of the fish roster on the approved Pass 065 hero-fish builder.

    python3 tools/art/pass066/roster.py [species ...]   # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs public/assets/models
    python3 tools/art/inspect_assets.py

Every remaining fish was a reshaped chromis. Each now has species anatomy from one of four body
families, its own tail type, fin layout and painted markings, at its existing authored size and
under its existing root name, so the runtime (AuthoredSchool instancing, AI, schooling, catalog,
aquarium customization) is unchanged:

  oval damsel / basslet   assessor, cardinalfish (deep body, big eye)
  compressed disc         butterflyfish, bannerfish, Moorish idol, blue tang (tall, short-snouted
                          or beaked discs; pennants on the bannerfish and idol)
  elongate                firefish (dorsal pennant), Antarctic icefish (broad flat head),
                          notothen, Patagonian toothfish
  robust / large          humphead wrasse (forehead hump, thick lips), giant sea bass,
                          parrotfish (beak), California sheephead (hump), trevally (lunate tail)
"""
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass065'))
import hero_fish as hf  # noqa: E402

TAU = np.pi * 2


# ------------------------------------------------------------------ family profiles (s: tail root 0 .. snout 1)

OVAL_H = [(0, .17), (.08, .25), (.2, .5), (.35, .8), (.5, .97), (.62, 1.0), (.74, .95), (.85, .78), (.93, .5),
          (.98, .25), (1, .06)]
DISC_H = [(0, .13), (.07, .2), (.2, .55), (.35, .88), (.5, 1.0), (.62, .98), (.74, .86), (.84, .6), (.92, .32),
          (.97, .16), (1, .05)]
LONG_H = [(0, .24), (.15, .48), (.35, .84), (.55, 1.0), (.75, .96), (.88, .82), (.95, .55), (.99, .25), (1, .08)]
ROBUST_H = [(0, .16), (.1, .26), (.25, .56), (.4, .86), (.55, .98), (.68, 1.0), (.8, .93), (.9, .74), (.96, .47),
            (1, .12)]
WIDTH = [(0, .18), (.12, .3), (.3, .68), (.55, 1.0), (.8, .9), (.92, .6), (.98, .3), (1, .08)]
FLAT_HEAD_W = [(0, .18), (.12, .3), (.35, .7), (.6, .95), (.8, 1.08), (.92, .98), (.98, .62), (1, .2)]
MID = [(0, 0), (.5, .03), (.85, 0), (1, -.12)]
SNOUT_MID = [(0, 0), (.5, .05), (.8, -.02), (.93, -.15), (1, -.3)]
HUMP_MID = [(0, 0), (.55, .04), (.8, .1), (.92, .06), (1, -.1)]

DORSAL = dict(s=(.2, .75), h=[(0, .3), (.15, .6), (.6, .55), (.9, .5), (1, .2)], slant=.45)
ANAL = dict(s=(.18, .45), h=[(0, .3), (.25, .62), (.75, .5), (1, .2)], slant=.45)
RAYS = dict(dorsal=24, anal=14, caudal=16, pelvic=6, pectoral=12)


def spec(name, root, length, caudal_frac, hm, wm, height, mid, caudal, eye, **extra):
    caudal_len = length * caudal_frac
    s = dict(name=name, root=root, body=length - caudal_len, caudal=caudal_len, hm=hm, wm=wm, n=2.25,
             belly=0.1, height=height, width=WIDTH, mid=mid, eye=eye, gill=.74, mouth=.955,
             caudal_shape=caudal, dorsal=DORSAL, anal=ANAL, pelvic=dict(s=.65, len=.4),
             pectoral=dict(s=.7, y=-.2, len=.45), rays=RAYS)
    s.update(extra)
    return s


# ------------------------------------------------------------------ painters
# Each receives the UV-space body grids: S (0 tail root .. 1 snout), T (angle), x, y, yn (-1 belly
# .. 1 back) and returns an (N, N, 3) colour. `mix` blends a colour in by a mask.


def mix(col, mask, colour):
    m = np.clip(mask, 0, 1)[..., None]
    return col * (1 - m) + np.asarray(colour, float) * m


def base(S, colour):
    return np.tile(np.asarray(colour, float), S.shape + (1,))


def countershade(col, yn, smooth, back=0.12, belly=0.15):
    col = col * (1 - back * smooth(0.3, 1.0, yn))[..., None]
    return col + (1 - col) * (belly * smooth(-0.2, -1.0, yn))[..., None]


def band(S, centre, half, smooth, soft=0.008):
    return smooth(half + soft, half - soft, np.abs(S - centre))


def paint_assessor(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.98, .8, .12)), smooth(.3, 1, yn), (.95, .68, .1))
    return countershade(col, yn, smooth, 0.05, 0.2)


def paint_cardinal(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.93, .91, .86)), smooth(.6, .66, S), (.8, .74, .42))
    col = mix(col, band(S, .54, .055, smooth), (.16, .13, .1))
    # Rows of red-orange spots on the pale rear body.
    spots = (np.sin(x / (an.spec['hm'] * .09)) * np.sin((y - an.C(S)) / (an.spec['hm'] * .09)))
    col = mix(col, smooth(.82, .95, spots) * (S < .47), (.85, .36, .2))
    return countershade(col, yn, smooth)


def paint_firefish(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.96, .94, .9)), smooth(.7, .78, S), (.98, .86, .5))
    col = mix(col, smooth(.42, .18, S), (.93, .4, .16))
    col = mix(col, smooth(.2, .02, S), (.62, .1, .16))
    return countershade(col, yn, smooth, .04, .1)


def paint_butterfly(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.97, .95, .88)), smooth(.5, .3, S), (.98, .84, .2))
    col = mix(col, band(S, .875, .03, smooth) * (yn > -.7), (.08, .07, .08))  # eye bar
    spot = smooth(.09, .06, np.hypot(S - .22, (yn - .45) * .25))
    col = mix(col, spot, (.06, .05, .06))
    return countershade(col, yn, smooth, .04, .08)


def paint_bannerfish(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.95, .94, .9))
    col = mix(col, band(S, .64 + .07 * yn, .075, smooth), (.07, .07, .08))
    col = mix(col, band(S, .33 + .1 * yn, .07, smooth) * (yn > -.6), (.07, .07, .08))
    col = mix(col, smooth(.2, .5, yn) * smooth(.3, .2, S), (.98, .85, .2))
    return countershade(col, yn, smooth, .04, .06)


def paint_idol(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.98, .93, .72)), smooth(.42, .3, S), (.98, .86, .3))
    col = mix(col, band(S, .68, .085, smooth), (.06, .06, .07))
    col = mix(col, band(S, .29, .05, smooth), (.06, .06, .07))
    col = mix(col, smooth(.88, .92, S) * smooth(.1, .4, yn), (.95, .55, .16))  # orange snout saddle
    return countershade(col, yn, smooth, .04, .06)


def paint_tang(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.12, .32, .86))
    upper = smooth(.12, .2, yn) * smooth(.7, .62, yn) * smooth(.18, .26, S) * smooth(.9, .82, S)
    hole = smooth(.11, .07, np.hypot((S - .55) * .9, (yn - .4) * .3))  # the blue "window" in the palette
    col = mix(col, upper * (1 - hole), (.05, .06, .1))
    col = mix(col, smooth(.12, .02, S), (.98, .84, .14))  # yellow tail base
    return countershade(col, yn, smooth, .05, .1)


def paint_icefish(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.8, .83, .86))
    bars = (np.sin(S * TAU * 7) * .5 + .5) * smooth(-.2, .6, yn)
    col = mix(col, bars * .35, (.48, .5, .54))
    return countershade(col, yn, smooth, .1, .15)


def paint_notothen(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.46, .42, .32))
    blotch = smooth(.5, 1.0, noise(10, 66))
    col = mix(col, blotch * smooth(-.4, .3, yn), (.24, .22, .17))
    return countershade(col, yn, smooth, .1, .35)


def paint_toothfish(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.32, .32, .33))
    col = mix(col, smooth(.6, 1.2, noise(14, 67)) * .5, (.2, .2, .22))
    return countershade(col, yn, smooth, .12, .3)


def paint_napoleon(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.24, .5, .5))
    lines = smooth(.7, .95, np.sin((y - an.C(S)) / (an.spec['hm'] * .06) + np.sin(x / (an.spec['hm'] * .2)) * 2))
    col = mix(col, lines * smooth(.72, .8, S) * .6, (.12, .3, .36))
    return countershade(col, yn, smooth, .14, .18)


def paint_seabass(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.34, .31, .27))
    spots = smooth(1.2, 1.6, noise(5, 68))
    col = mix(col, spots, (.1, .09, .08))
    return countershade(col, yn, smooth, .12, .3)


def paint_parrot(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.18, .64, .55))
    col = mix(col, smooth(-.3, -.9, yn) * .6, (.88, .55, .6))
    stripe = smooth(.04, .0, np.abs(y - an.C(S) - .15 * an.H(S) - (S - .88) * .5 * an.H(S))) * smooth(.8, .86, S)
    col = mix(col, stripe, (.92, .58, .62))
    col = mix(col, smooth(.965, .985, S), (.86, .86, .78))  # the fused beak
    return countershade(col, yn, smooth, .1, .05)


def paint_sheephead(S, T, x, y, yn, an, noise, smooth):
    col = base(S, (.84, .32, .28))
    col = mix(col, smooth(.68, .74, S), (.09, .08, .09))
    col = mix(col, smooth(.26, .2, S), (.09, .08, .09))
    col = mix(col, smooth(.86, .92, S) * smooth(-.35, -.7, yn), (.95, .94, .92))  # white chin
    return countershade(col, yn, smooth, .08, .05)


def paint_trevally(S, T, x, y, yn, an, noise, smooth):
    col = mix(base(S, (.78, .8, .82)), smooth(.15, .85, yn), (.34, .45, .56))
    col = mix(col, smooth(-.2, -.8, yn), (.94, .95, .95))
    return col * (1 + .03 * noise(30, 69))[..., None]


# ------------------------------------------------------------------ species

F = lambda c, **k: dict(color=c, **k)  # noqa: E731

ROSTER = {
    'assessor': spec('Assessor', 'Assessor', .613, .18, .108, .059, OVAL_H, MID, 'rounded',
                     dict(s=.885, y=.24, r=.17), paint=paint_assessor, fin=F((.98, .78, .14), alpha=.9, fade=.3),
                     iris=(.3, .45, .7)),
    'cardinalfish': spec('Cardinalfish', 'Cardinalfish', .62, .2, .15, .053, OVAL_H, MID, 'forked',
                         dict(s=.88, y=.28, r=.22), paint=paint_cardinal,
                         dorsal=dict(s=(.2, .7), h=[(0, .4), (.3, .75), (.45, .35), (.55, .75), (.8, .65), (1, .2)],
                                     slant=.4),
                         fin=F((.86, .82, .7), alpha=.75, fade=.4), iris=(.9, .3, .14)),
    'firefish': spec('Firefish', 'Firefish', .852, .19, .06, .046, LONG_H, MID, 'rounded',
                     dict(s=.89, y=.25, r=.3), paint=paint_firefish, n=2.1,
                     dorsal=dict(s=(.12, .74), h=[(0, .9), (.4, 1.0), (.75, 1.4), (.86, 3.6), (.92, 1.0),
                                                  (1, .3)], slant=.5),
                     anal=dict(s=(.1, .42), h=[(0, .9), (.5, 1.0), (1, .3)], slant=.4),
                     fin=F((.92, .42, .2), edge=(.35, .06, .1), edge_at=.8, alpha=.85),
                     iris=(.95, .62, .2)),
    'butterflyfish': spec('Butterflyfish', 'Butterflyfish', .5, .18, .16, .034, DISC_H, SNOUT_MID, 'truncate',
                          dict(s=.86, y=.2, r=.15), paint=paint_butterfly,
                          dorsal=dict(s=(.12, .78), h=[(0, .3), (.2, .45), (.7, .4), (1, .15)], slant=.3),
                          anal=dict(s=(.12, .48), h=[(0, .3), (.3, .45), (1, .15)], slant=.3),
                          fin=F((.98, .84, .22), edge=(.1, .08, .08), alpha=.92), iris=(.2, .18, .16)),
    'bannerfish': spec('Bannerfish', 'Bannerfish', .56, .19, .18, .036, DISC_H, SNOUT_MID, 'truncate',
                       dict(s=.85, y=.2, r=.14), paint=paint_bannerfish,
                       dorsal=dict(s=(.15, .78), h=[(0, .3), (.3, .45), (.62, .55), (.74, 1.45), (.8, .8), (1, .3)],
                                   slant=1.1),
                       anal=dict(s=(.12, .48), h=[(0, .3), (.3, .5), (1, .2)], slant=.35),
                       fin=F((.98, .9, .4), alpha=.9), iris=(.25, .22, .2)),
    'idol': spec('Moorish idol', 'Moorish_Idol', .511, .17, .17, .034, DISC_H, SNOUT_MID, 'lunate',
                 dict(s=.8, y=.25, r=.14), paint=paint_idol, caudal_span=.8,
                 dorsal=dict(s=(.35, .75), h=[(0, .3), (.4, .5), (.75, 1.9), (.85, 1.0), (1, .4)], slant=1.6),
                 anal=dict(s=(.18, .5), h=[(0, .3), (.5, .9), (1, .3)], slant=.6),
                 fin=F((.96, .94, .86), edge=(.08, .08, .08), edge_at=.82, alpha=.9), iris=(.2, .2, .2)),
    'bluetang': spec('Blue tang', 'Blue_Tang', .62, .2, .135, .042, DISC_H, MID, 'emarginate',
                     dict(s=.86, y=.25, r=.16), paint=paint_tang,
                     dorsal=dict(s=(.1, .78), h=[(0, .3), (.15, .38), (.8, .35), (1, .15)], slant=.3),
                     anal=dict(s=(.1, .5), h=[(0, .3), (.2, .36), (1, .15)], slant=.3),
                     fin=F((.12, .3, .82), edge=(.04, .05, .1), alpha=.95), iris=(.1, .1, .12)),
    'icefish': spec('Icefish', 'Icefish', 1.006, .16, .075, .055, LONG_H, MID, 'truncate',
                    dict(s=.83, y=.4, r=.28), paint=paint_icefish, width=FLAT_HEAD_W, n=2.0,
                    dorsal=dict(s=(.12, .68), h=[(0, .6), (.4, .7), (.62, .3), (.72, .9), (.95, .8), (1, .2)],
                                slant=.4),
                    anal=dict(s=(.1, .5), h=[(0, .5), (.5, .6), (1, .2)], slant=.3),
                    pectoral=dict(s=.7, y=-.1, len=.9), skin_rough=.55, rough=.5,
                    fin=F((.86, .88, .9), alpha=.6, fade=.4), iris=(.5, .55, .6)),
    'notothen': spec('Notothen', 'Notothen', .42, .19, .05, .03, LONG_H, MID, 'rounded',
                     dict(s=.88, y=.35, r=.3), paint=paint_notothen,
                     dorsal=dict(s=(.12, .7), h=[(0, .6), (.45, .7), (.6, .3), (.72, .8), (1, .2)], slant=.4),
                     pectoral=dict(s=.7, y=-.15, len=.9), skin_rough=.55, rough=.5,
                     fin=F((.5, .45, .35), alpha=.85), iris=(.6, .55, .3)),
    'toothfish': spec('Toothfish', 'Toothfish', 1.7, .19, .17, .11, LONG_H, MID, 'truncate',
                      dict(s=.88, y=.3, r=.2), paint=paint_toothfish,
                      dorsal=dict(s=(.12, .7), h=[(0, .4), (.45, .45), (.6, .2), (.72, .5), (1, .2)], slant=.4),
                      skin_rough=.55, rough=.5, fin=F((.3, .3, .32), alpha=.95), iris=(.4, .45, .5)),
    'napoleon': spec('Humphead wrasse', 'Humphead_Wrasse', 2.4, .19, .48, .17, ROBUST_H, HUMP_MID, 'rounded',
                     dict(s=.86, y=.32, r=.07), paint=paint_napoleon, scale=.08,
                     dorsal=dict(s=(.15, .76), h=[(0, .35), (.2, .4), (1, .25)], slant=.35),
                     anal=dict(s=(.14, .42), h=[(0, .35), (.4, .45), (1, .2)], slant=.35),
                     skin_rough=.5, fin=F((.24, .5, .46), edge=(.85, .75, .35), edge_at=.88, alpha=.95),
                     iris=(.8, .55, .2)),
    'seabass': spec('Giant sea bass', 'Giant_Sea_Bass', 2.2, .18, .34, .17, ROBUST_H, MID, 'truncate',
                    dict(s=.87, y=.3, r=.08), paint=paint_seabass, scale=.08,
                    dorsal=dict(s=(.18, .72), h=[(0, .35), (.4, .38), (.55, .25), (.75, .5), (1, .2)], slant=.4),
                    skin_rough=.55, rough=.48, fin=F((.3, .28, .25), alpha=.95), iris=(.3, .3, .25)),
    'parrotfish': spec('Parrotfish', 'Parrotfish', 1.1, .19, .18, .085, ROBUST_H, MID, 'emarginate',
                       dict(s=.86, y=.3, r=.1), paint=paint_parrot, scale=.09,
                       dorsal=dict(s=(.15, .75), h=[(0, .3), (.2, .32), (1, .2)], slant=.35),
                       fin=F((.2, .62, .55), edge=(.9, .55, .6), edge_at=.86, alpha=.95), iris=(.8, .5, .2)),
    'sheephead': spec('Sheephead', 'Sheephead', .95, .19, .165, .068, ROBUST_H, HUMP_MID, 'lunate',
                      dict(s=.86, y=.3, r=.11), paint=paint_sheephead, caudal_span=.85,
                      dorsal=dict(s=(.18, .74), h=[(0, .3), (.2, .38), (1, .2)], slant=.35),
                      fin=F((.5, .16, .14), edge=(.08, .07, .08), alpha=.95), iris=(.85, .3, .2)),
    'trevally': spec('Trevally', 'Trevally', .9, .2, .135, .05, ROBUST_H, MID, 'lunate',
                     dict(s=.88, y=.28, r=.15), paint=paint_trevally, n=2.0, skin_rough=.36, rough=.32,
                     dorsal=dict(s=(.12, .62), h=[(0, .25), (.3, .3), (.8, .6), (1, .2)], slant=.6),
                     anal=dict(s=(.1, .4), h=[(0, .25), (.4, .3), (.8, .55), (1, .2)], slant=.6),
                     pectoral=dict(s=.7, y=-.1, len=.75),
                     fin=F((.72, .7, .5), alpha=.8, fade=.3), iris=(.85, .8, .4)),
}

if __name__ == '__main__':
    hf.SPECIES.update(ROSTER)
    hf.HERE, hf.RAW = HERE, HERE / 'out'  # Blender sources and raw exports beside this script
    for n in (sys.argv[1:] or ROSTER):
        hf.build(n)
