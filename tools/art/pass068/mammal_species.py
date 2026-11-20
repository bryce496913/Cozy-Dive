"""V0.7 Pass 068: specifications for tools/art/pass068/mammals.py.

Root names and authored sizes match the shipped models and the asset registry bounds, so the
ice-world and kelp-forest systems drive them unchanged. Profiles use s = 0 at the tail root and
1 at the snout (or bill base); heights and widths are fractions of `hm` / `wm` (half-depth and
half-width, metres).
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'pass067'))
from species import counter, flat, mix  # noqa: E402

P = '068'


def side_of(T):
    return np.abs(np.sin(T)) > 0.35


def ellipse(S, yn, s0, y0, rs, ry):
    return ((S - s0) / rs) ** 2 + ((yn - y0) / ry) ** 2


# ------------------------------------------------------------------ painters


def orca_paint(S, T, yn, noise, smooth, **_):
    col = flat(S, (.05, .055, .065)) * (1 + 0.05 * noise(20, 1))[..., None]
    # White chin, throat and belly, narrowing back toward the genital patch.
    belly = smooth(-0.25, -0.45, yn + 0.25 * smooth(0.95, 0.55, S)) * smooth(0.25, 0.35, S) * smooth(1.0, 0.97, S)
    col = mix(col, belly, (.93, .94, .93))
    # Flank patch sweeping up behind the dorsal fin.
    flank = smooth(1.0, 0.7, ellipse(S, yn, 0.36, -0.2, 0.09, 0.3)) * side_of(T)
    col = mix(col, flank, (.93, .94, .93))
    # Eye patch above and behind the eye.
    eye = smooth(1.0, 0.75, ellipse(S, yn, 0.82, 0.12, 0.045, 0.14)) * side_of(T)
    col = mix(col, eye, (.95, .95, .94))
    # Grey saddle behind the dorsal fin.
    saddle = smooth(1.0, 0.6, ellipse(S, yn, 0.44, 1.0, 0.05, 0.35))
    return mix(col, saddle * 0.8, (.42, .44, .47))


def minke_paint(S, T, yn, noise, smooth, **_):
    col = counter(S, yn, smooth, (.2, .22, .25), (.9, .9, .88), -0.15, 0.2)
    chevron = smooth(1.0, 0.6, ellipse(S, yn, 0.62, 0.15, 0.03, 0.35)) * side_of(T)
    col = mix(col, chevron * 0.6, (.55, .57, .6))
    pleats = smooth(.8, .97, np.abs(np.sin(T * 34))) * smooth(-.45, -.7, yn) * smooth(.6, .7, S)
    return mix(col, pleats * .5, (.6, .6, .62))


def leopard_seal_paint(S, T, yn, noise, smooth, **_):
    col = counter(S, yn, smooth, (.27, .29, .32), (.72, .73, .75), -0.15, 0.35)
    col *= (1 + 0.05 * noise(14, 2))[..., None]
    spots = smooth(1.2, 1.7, noise(2.5, 3)) * smooth(0.3, -0.3, yn)
    col = mix(col, spots * 0.8, (.2, .21, .23))
    gape = smooth(0.012, 0.0, np.abs(yn + 0.15)) * smooth(0.9, 0.93, S) * side_of(T)
    return mix(col, gape, (.08, .08, .09))


def harbour_seal_paint(S, T, yn, noise, smooth, **_):
    col = counter(S, yn, smooth, (.42, .43, .44), (.72, .7, .66), -0.3, 0.4)
    spots = smooth(1.0, 1.6, noise(2.2, 4))
    rings = smooth(0.25, 0.0, np.abs(noise(3.0, 5) - 1.2))
    col = mix(col, spots * 0.8, (.17, .18, .19))
    col = mix(col, rings * 0.4, (.25, .26, .27))
    return mix(col, smooth(0.975, 0.995, S), (.1, .1, .1))


def sea_lion_paint(S, T, yn, noise, smooth, **_):
    col = counter(S, yn, smooth, (.3, .21, .14), (.5, .38, .26), -0.2, 0.45)
    col *= (1 + 0.06 * noise(18, 6))[..., None]
    return mix(col, smooth(0.975, 0.995, S), (.12, .09, .07))


def polar_bear_paint(S, T, yn, noise, smooth, **_):
    col = counter(S, yn, smooth, (.9, .87, .77), (.8, .76, .64), -0.3, 0.5)
    col *= (1 + 0.05 * noise(10, 7))[..., None]
    nose = smooth(0.982, 0.992, S)
    return mix(col, nose, (.05, .05, .06))


def otter_paint(S, T, yn, noise, smooth, **_):
    col = flat(S, (.2, .14, .09)) * (1 + 0.12 * noise(1.2, 8))[..., None]
    pale = smooth(0.74, 0.86, S) * (0.75 + 0.25 * smooth(-1, 1, noise(6, 9)))
    col = mix(col, pale, (.72, .65, .52))
    return mix(col, smooth(0.982, 0.994, S), (.06, .05, .05))


def penguin_paint(emperor):
    def paint(S, T, yn, noise, smooth, **_):
        col = counter(S, yn, smooth, (.07, .08, .11), (.95, .95, .92), 0.05, 0.08)
        # The head is dark all round (Adélie: throat included).
        head = smooth(0.83, 0.86, S) * (smooth(-0.6, -0.4, yn) if emperor else 1.0)
        col = mix(col, head, (.06, .07, .1))
        if emperor:
            breast = smooth(0.68, 0.84, S) * smooth(0.0, -0.4, yn) * (1 - head)
            col = mix(col, breast * 0.7, (.98, .9, .62))
            ear = smooth(1.0, 0.6, ellipse(S, yn, 0.9, -0.1, 0.03, 0.22)) * side_of(T)
            col = mix(col, ear, (.98, .7, .2))
        return col
    return paint




def gull_paint(S, T, yn, noise, smooth, **_):
    col = flat(S, (.95, .95, .93)) * (1 + 0.02 * noise(20, 10))[..., None]
    mantle = smooth(0.4, 0.6, yn) * smooth(0.22, 0.32, S) * smooth(0.74, 0.66, S)
    return mix(col, mantle, (.34, .36, .41))


# ------------------------------------------------------------------ specs


def spec(**kw):
    s = dict(pass_=P, src=Path(__file__).resolve().parent, n=2.0, belly=0.05, mid=[(0, 0), (1, 0)], rough=0.55)
    s.update(kw)
    s['pass'] = s.pop('pass_')
    return s


SPECIES = {
    'killer-whale': spec(family='cetacean', loco='fluke', root='Orca', body=2.6, caudal=.3, hm=.28, wm=.27,
                         height=[(0, .12), (.1, .28), (.25, .6), (.45, .92), (.6, 1), (.75, .95), (.88, .75),
                                 (.95, .5), (1, .2)],
                         width=[(0, .14), (.1, .3), (.25, .62), (.45, .95), (.6, 1), (.75, .95), (.88, .78),
                                (.95, .55), (1, .2)], mid=[(0, 0), (1, -.05)],
                         eye=dict(s=.86, y=-.05, r=.05), flipper=dict(s=.7, back=.05, len=.4, chord=.14),
                         fluke=.42, dorsal=dict(s=(.48, .6), h=.45, rake=.25, skew=.5, sharp=1.2),
                         paint=orca_paint, fin=(.05, .055, .065), rough=.4),
    'minke-whale': spec(family='cetacean', loco='fluke', root='Minke', body=2.7, caudal=.25, hm=.2, wm=.2,
                        height=[(0, .12), (.1, .26), (.3, .65), (.5, .95), (.65, 1), (.8, .85), (.92, .5),
                                (.98, .22), (1, .08)],
                        width=[(0, .14), (.1, .3), (.3, .66), (.5, .95), (.65, 1), (.8, .9), (.92, .6),
                               (.98, .3), (1, .1)], mid=[(0, 0), (.9, -.05), (1, -.08)],
                        eye=dict(s=.86, y=-.1, r=.04), flipper=dict(s=.7, back=.1, len=.32, chord=.06),
                        fluke=.36, dorsal=dict(s=(.28, .34), h=.1, rake=.6, skew=.4),
                        paint=minke_paint, fin=(.2, .22, .25), slots={0: (.6, .62, .65)}, rough=.45),
    'leopard-seal': spec(family='pinniped', loco='seal', root='LeopardSeal', body=3.0, hm=.26, wm=.27, n=2.1,
                         belly=.1, amp=.14, pivot=.5,
                         height=[(0, .15), (.06, .4), (.2, .75), (.4, 1), (.58, .95), (.72, .74), (.8, .64),
                                 (.87, .6), (.93, .45), (.98, .26), (1, .1)],
                         width=[(0, .2), (.06, .45), (.2, .8), (.4, 1), (.58, .9), (.72, .66), (.8, .6),
                                (.87, .6), (.93, .44), (.98, .24), (1, .08)], mid=[(0, 0), (.8, .05), (1, .02)],
                         eye=dict(s=.9, y=.3, r=.11), fore=dict(s=.66, back=.12, len=.38, chord=.1),
                         hind=dict(len=.45, spread=.5), paint=leopard_seal_paint, fin=(.25, .27, .3)),
    'harbour-seal': spec(family='pinniped', loco='seal', root='Seal', body=1.45, hm=.2, wm=.22, n=2.1, belly=.1,
                         height=[(0, .15), (.06, .45), (.2, .8), (.45, 1), (.65, .92), (.78, .78), (.86, .74),
                                 (.93, .6), (.98, .36), (1, .14)],
                         width=[(0, .2), (.06, .5), (.2, .85), (.45, 1), (.65, .92), (.78, .76), (.86, .72),
                                (.93, .56), (.98, .32), (1, .12)], mid=[(0, 0), (.85, .06), (1, 0)],
                         eye=dict(s=.9, y=.32, r=.16), fore=dict(s=.68, back=.1, len=.2, chord=.1),
                         hind=dict(len=.3, spread=.5), paint=harbour_seal_paint, fin=(.3, .3, .31)),
    'sea-lion': spec(family='pinniped', loco='sealion', root='SeaLion', body=2.0, hm=.19, wm=.2,
                     height=[(0, .15), (.06, .4), (.2, .75), (.42, 1), (.6, .95), (.74, .66), (.83, .52),
                             (.9, .55), (.96, .36), (1, .1)],
                     width=[(0, .2), (.06, .45), (.2, .78), (.42, 1), (.6, .92), (.74, .6), (.83, .46),
                            (.9, .52), (.96, .32), (1, .1)], mid=[(0, 0), (.7, .05), (.9, .3), (1, .25)],
                     eye=dict(s=.92, y=.25, r=.1), fore=dict(s=.64, back=.22, len=.42, chord=.16, droop=.75),
                     hind=dict(len=.26, spread=.45, turned=True), ears=.88, paint=sea_lion_paint,
                     fin=(.2, .15, .1), rough=.4),
    'polar-bear': spec(family='bear', loco='paddle', root='PolarBear', template='fur', body=2.0, hm=.36, wm=.3, n=2.3,
                       height=[(0, .3), (.05, .68), (.15, .9), (.35, 1), (.55, .96), (.66, .74), (.74, .5),
                               (.82, .4), (.88, .42), (.93, .36), (.97, .22), (1, .08)],
                       width=[(0, .3), (.05, .7), (.15, .92), (.35, 1), (.55, .95), (.66, .7), (.74, .48),
                              (.82, .4), (.88, .48), (.93, .36), (.97, .2), (1, .08)],
                       mid=[(0, 0), (.55, .05), (.72, .35), (.86, .7), (.95, .72), (1, .62)],
                       eye=dict(s=.925, y=.35, r=.09), paint=polar_bear_paint, fin=(.86, .82, .7), relief=.5,
                       rough=.8),
    'sea-otter': spec(family='otter', loco='otter', root='Otter', template='fur', body=1.2, hm=.1, wm=.13, n=2.2, amp=.12,
                      pivot=.5,
                      height=[(0, .08), (.05, .15), (.25, .25), (.33, .7), (.5, 1), (.68, .95), (.8, .7),
                              (.86, .78), (.94, .7), (1, .2)],
                      width=[(0, .1), (.05, .3), (.25, .45), (.33, .75), (.5, 1), (.68, .95), (.8, .72),
                             (.86, .85), (.94, .7), (1, .2)],
                      eye=dict(s=.93, y=.35, r=.14), paint=otter_paint, fin=(.16, .11, .07), relief=.45,
                      rough=.8),
    'emperor-penguin': spec(family='penguin', loco='penguin', root='EmperorPenguin', template='feather', body=1.2, hm=.2, wm=.19,
                            height=[(0, .1), (.05, .3), (.2, .75), (.45, 1), (.65, .9), (.8, .6), (.86, .5),
                                    (.93, .5), (.98, .32), (1, .12)],
                            width=[(0, .1), (.05, .3), (.2, .75), (.45, 1), (.65, .88), (.8, .55), (.86, .45),
                                   (.93, .45), (.98, .28), (1, .1)], mid=[(0, 0), (.8, .05), (1, .1)],
                            eye=dict(s=.93, y=.3, r=.1), bill=.085,
                            wing=dict(s=(.6, .72), span=.36, tip_u=.3, lead=.6, trail=1.2, sweep=.12, thick=.02,
                                      y=0, droop=-.15),
                            paint=penguin_paint(True), fin=(.07, .08, .11),
                            slots={3: (.12, .1, .1), 4: (.1, .1, .1)}, rough=.45),
    'adelie-penguin': spec(family='penguin', loco='penguin', root='AdeliePenguin', template='feather', body=.74, hm=.12, wm=.115,
                           height=[(0, .1), (.05, .3), (.2, .75), (.45, 1), (.65, .9), (.8, .62), (.86, .55),
                                   (.93, .55), (.98, .35), (1, .12)],
                           width=[(0, .1), (.05, .3), (.2, .75), (.45, 1), (.65, .88), (.8, .58), (.86, .5),
                                  (.93, .5), (.98, .3), (1, .1)], mid=[(0, 0), (.8, .05), (1, .1)],
                           eye=dict(s=.93, y=.3, r=.12), eye_col=(.04, .04, .05), bill=.07,
                           wing=dict(s=(.6, .72), span=.22, tip_u=.3, lead=.6, trail=1.2, sweep=.07, thick=.014,
                                     y=0, droop=-.15),
                           paint=penguin_paint(False), fin=(.07, .08, .11),
                           slots={3: (.18, .09, .08), 4: (.9, .62, .6)}, rough=.45),
    'western-gull': spec(family='gull', loco='wing', root='Gull', template='feather', body=.55, hm=.055, wm=.06, beat=.6,
                         height=[(0, .15), (.08, .35), (.3, .85), (.5, 1), (.68, .85), (.78, .6), (.85, .7),
                                 (.93, .65), (1, .25)],
                         width=[(0, .2), (.08, .4), (.3, .85), (.5, 1), (.68, .85), (.78, .6), (.85, .68),
                                (.93, .6), (1, .22)], mid=[(0, .1), (.5, 0), (.8, .5), (1, .8)],
                         eye=dict(s=.93, y=.35, r=.14), bill=.09,
                         wing=dict(s=(.5, .66), span=.68, tip_u=.3, lead=.45, trail=.9, sweep=.12, thick=.008, y=.4),
                         paint=gull_paint, fin=(.34, .36, .41), tip=(.06, .06, .07), tip_at=.72,
                         slots={2: (.95, .95, .93), 3: (.95, .8, .2), 4: (.85, .6, .58)}, rough=.6),
}
