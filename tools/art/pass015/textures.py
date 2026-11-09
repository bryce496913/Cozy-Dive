"""Original tileable 512px micro-detail PBR maps for Pass 015 corals and creatures.

Hue, blotches and patterns live in object-space vertex colour (continuous across joined parts,
as on the Pass 014 rocks); these maps add the fine relief and roughness that read at close range:
corallites, septa, polyps, warts, papillae, pores and tissue striations. Built from the same seeded
spectral-noise / periodic-Voronoi helpers as Pass 014. Run: python3 tools/art/pass015/textures.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pass014'))
import textures as t14  # noqa: E402

t14.OUT = Path(__file__).resolve().parents[3] / 'public/assets/textures/pass015'
spectral, fbm, cells, write, N = t14.spectral, t14.fbm, t14.cells, t14.write, t14.N
u, v = t14.u, t14.v


def gray(tone):
    return np.stack([tone, tone, tone], -1)


def coral_acropora():
    """Tightly packed raised radial corallites with recessed calices and septa on porous coenosteum."""
    d1, d2, _ = cells(1024, 1501, jitter=0.35)
    s = 1 / 32
    cup = np.clip(1 - d1 / (s * 0.40), 0, 1)
    rim = np.exp(-((d1 - s * 0.30) / (s * 0.08)) ** 2)
    calice = np.clip(1 - d1 / (s * 0.18), 0, 1)
    ang = np.arctan2(*np.gradient(d1))
    septa = (0.5 + 0.5 * np.cos(ang * 12)) * np.clip(1 - d1 / (s * 0.3), 0, 1)
    pores = spectral(1.6, seed=1511)
    height = cup * 0.7 + rim * 0.5 - calice ** 1.5 * 1.1 + septa * 0.15 + pores * 0.06
    tone = 0.88 + rim * 0.06 - calice * 0.3 + pores * 0.02
    write('coral-acropora', gray(tone), height, 5.0, 0.62 + calice * 0.25 + pores * 0.03, 1 - calice * 0.55)


def coral_brain():
    """Fine septa running across the meanders (major valleys are geometry and vertex colour)."""
    warp = fbm([60, 25], [1, 0.5], 1601)
    dir_field = np.sin((u * 7 + warp * 0.8) * 2 * np.pi) * 0.5 + 0.5
    septa = np.sin((u * np.cos(dir_field) + v * np.sin(dir_field)) * 2 * np.pi * 70 + warp * 3)
    fine = spectral(1.8, seed=1611)
    collar = fbm([20, 9], [1, 0.4], 1621)
    height = septa * 0.35 + collar * 0.25 + fine * 0.08
    tone = 0.86 + septa * 0.05 + collar * 0.04 + fine * 0.02
    write('coral-brain', gray(tone), height, 4.0, 0.66 + (1 - septa) * 0.06 + fine * 0.03, 0.82 + septa * 0.12)


def coral_plate():
    """Rows of immersed corallites with fine costae for tabular/plating colonies."""
    d1, _, _ = cells(1600, 1701, jitter=0.4)
    s = 1 / 40
    calice = np.clip(1 - d1 / (s * 0.28), 0, 1)
    costae = np.sin((u * 2 * np.pi * 180) + fbm([80], [1], 1711) * 2)
    fine = spectral(1.6, seed=1721)
    height = costae * 0.18 - calice ** 1.5 * 0.9 + fine * 0.08
    tone = 0.87 + costae * 0.03 - calice * 0.28 + fine * 0.02
    write('coral-plate', gray(tone), height, 4.5, 0.64 + calice * 0.24, 1 - calice * 0.5)


def soft_polyp():
    """Extended eight-armed polyp crowns over a spiculed coenenchyme (soft corals, gorgonians)."""
    d1, _, _ = cells(900, 1801, jitter=0.45)
    s = 1 / 30
    gy, gx = np.gradient(d1)
    ang = np.arctan2(gy, gx)
    crown = np.clip(1 - d1 / (s * 0.45), 0, 1)
    arms = (0.5 + 0.5 * np.cos(ang * 8)) * crown ** 0.6
    mouth = np.clip(1 - d1 / (s * 0.08), 0, 1)
    speck = spectral(1.4, seed=1811)
    height = arms * 0.6 + crown * 0.25 - mouth * 0.5 + speck * 0.07
    tone = 0.84 + arms * 0.12 - mouth * 0.25 + speck * 0.03
    write('soft-polyp', gray(tone), height, 4.0, 0.58 + (1 - crown) * 0.18, 0.8 + arms * 0.2)


def frog_skin():
    """Dense rounded warts, finer papillae and skin creases for frogfish."""
    d1, d2, _ = cells(400, 1901, jitter=0.6)
    wart = np.clip(1 - d1 / 0.032, 0, 1) ** 1.5
    d3, _, _ = cells(2500, 1911, jitter=0.7)
    papilla = np.clip(1 - d3 / 0.009, 0, 1) ** 2
    crease = np.exp(-((d2 - d1) / 0.004) ** 2)
    height = wart * 0.9 + papilla * 0.3 - crease * 0.25 + spectral(2.0, seed=1921) * 0.05
    tone = 0.84 + wart * 0.1 + papilla * 0.06 - crease * 0.12
    write('frog-skin', gray(tone), height, 4.5, 0.72 - wart * 0.12 + crease * 0.1, 1 - crease * 0.35)


def eel_skin():
    """Smooth leathery skin with fine pores and wrinkles (moray, also seahorse plates at scale)."""
    wr = np.sin((v * 2 * np.pi * 30) + fbm([40, 15], [1, 0.5], 2001) * 2.5)
    d1, _, _ = cells(3000, 2011, jitter=0.8)
    pore = np.clip(1 - d1 / 0.004, 0, 1)
    fine = spectral(2.2, seed=2021)
    height = wr * 0.12 - pore * 0.5 + fine * 0.08
    tone = 0.9 + wr * 0.02 - pore * 0.15 + fine * 0.02
    write('eel-skin', gray(tone), height, 3.5, 0.42 + pore * 0.2 + np.abs(fine) * 0.04, 1 - pore * 0.3)


def bony_plate():
    """Seahorse dermal plates: tubercled polygonal plates separated by grooves."""
    d1, d2, _ = cells(144, 2101, jitter=0.25)
    groove = np.exp(-((d2 - d1) / 0.006) ** 2)
    tubercle = np.clip(1 - d1 / 0.02, 0, 1) ** 2
    gran = spectral(1.6, seed=2111)
    height = tubercle * 0.6 - groove * 0.6 + gran * 0.1
    tone = 0.86 + tubercle * 0.1 - groove * 0.2 + gran * 0.02
    write('bony-plate', gray(tone), height, 5.0, 0.6 + groove * 0.2, 1 - groove * 0.4)


def tentacle():
    """Anemone tissue: longitudinal muscle striations, zooxanthellae speckle and a wet sheen."""
    stri = np.sin(u * 2 * np.pi * 60 + fbm([90], [1], 2201) * 1.2) * 0.5 + 0.5
    speck = np.clip(spectral(1.3, seed=2211) - 1.2, 0, 2)
    height = stri * 0.25 + speck * 0.1
    tone = 0.86 + stri * 0.06 - speck * 0.1
    write('tentacle', gray(tone), height, 2.5, 0.34 + stri * 0.06, np.ones((N, N)))


def nudi_skin():
    """Nudibranch mantle: soft tubercles/papillae and a moist surface."""
    d1, _, _ = cells(1600, 2301, jitter=0.6)
    tub = np.clip(1 - d1 / 0.011, 0, 1) ** 1.7
    fine = spectral(1.8, seed=2311)
    height = tub * 0.6 + fine * 0.08
    tone = 0.9 + tub * 0.06 + fine * 0.02
    write('nudi-skin', gray(tone), height, 3.5, 0.32 + (1 - tub) * 0.1, 1 - (1 - tub) * 0.1)


if __name__ == '__main__':
    for build in (coral_acropora, coral_brain, coral_plate, soft_polyp, frog_skin, eel_skin, bony_plate,
                  tentacle, nudi_skin):
        build()
    print(t14.OUT)
