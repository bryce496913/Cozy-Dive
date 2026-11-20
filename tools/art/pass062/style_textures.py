"""Pass 062: tileable PBR maps for the two benchmark treatments.

    python3 tools/art/pass062/style_textures.py

Style A (Natural Realism) maps are 1024 px with dense, physically motivated micro-detail:
eroded limestone with crusts and films, sharp corallite cups, brain-coral septa and epiphyte-
spotted seagrass. Style B (Crafted Stylized Realism) maps are 512 px: the same biology read in
broader, calmer shapes (soft strata, clean corallite rims, smooth septa, clean blade striations)
with lower-frequency normals so surfaces stay detailed without becoming noisy.

Every map is synthesised from seeded spectral noise and periodic Voronoi cells (no external
imagery). Colour maps carry luminance and mineral detail; species hue comes from vertex colour.
Output: tools/art/textures/pass062/p062-<style>-<material>-{base,normal,orm}.png
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

OUT = Path(__file__).resolve().parents[1] / 'textures/pass062'


class Canvas:
    """Noise helpers on an N x N periodic grid."""

    def __init__(self, n: int, seed: int):
        self.n = n
        self.rng = np.random.default_rng(seed)
        self.v, self.u = np.mgrid[0:n, 0:n] / n

    def spectral(self, scale: float, seed: int, power: float = 2.0) -> np.ndarray:
        """Periodic band-limited noise; `scale` is the feature size as a fraction of 512 texels."""
        n = self.n
        r = np.random.default_rng(seed)
        white = np.fft.fft2(r.standard_normal((n, n)))
        fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing='ij')
        f = np.hypot(fx, fy)
        f0 = 1 / (scale * n / 512)
        shaped = white * np.exp(-((np.log((f + 1e-9) / f0)) ** 2) * power)
        shaped[0, 0] = 0
        out = np.real(np.fft.ifft2(shaped))
        return (out - out.mean()) / (out.std() + 1e-9)

    def fbm(self, scales, gains, seed: int) -> np.ndarray:
        total = sum(self.spectral(s, seed + i) * g for i, (s, g) in enumerate(zip(scales, gains)))
        return total / sum(gains)

    def cells(self, count: int, seed: int, jitter: float | None = None):
        r = np.random.default_rng(seed)
        if jitter is None:
            pts = r.random((count, 2))
        else:
            side = int(round(count ** 0.5))
            gy, gx = np.mgrid[0:side, 0:side]
            pts = (np.stack([gx.ravel(), gy.ravel()], -1) + 0.5 + (r.random((side * side, 2)) - 0.5) * jitter) / side
            pts %= 1.0
        tree = cKDTree(pts, boxsize=1.0)
        d, i = tree.query(np.stack([self.u.ravel(), self.v.ravel()], -1), k=2)
        n = self.n
        return d[:, 0].reshape(n, n), d[:, 1].reshape(n, n), i[:, 0].reshape(n, n)

    def blur(self, a: np.ndarray, sigma_texels: float) -> np.ndarray:
        n = self.n
        fy, fx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing='ij')
        k = np.exp(-2 * (np.pi * sigma_texels) ** 2 * (fx ** 2 + fy ** 2))
        return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, dy * strength, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def write(name, base, height, strength, rough, occlusion):
    OUT.mkdir(parents=True, exist_ok=True)

    def save(suffix, a):
        Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(OUT / f'{name}-{suffix}.png', optimize=True)

    save('base', base)
    # Normal strength is given per 512 texels so both resolutions read at the same physical slope.
    save('normal', normal_from_height(height, strength * len(height) / 512) * 0.5 + 0.5)
    save('orm', np.stack([occlusion, rough, np.zeros_like(rough)], -1))


def mix(col, mask, colour, amount):
    m = (mask * amount)[..., None]
    return col * (1 - m) + np.asarray(colour) * m


# ---------------------------------------------------------------- reef rock


def rock_natural():
    c = Canvas(1024, 62001)
    broad = c.fbm([150, 70], [1, 0.6], 101)
    medium = c.fbm([30, 14], [1, 0.55], 111)
    fine = c.spectral(3.0, 121)
    grit = c.spectral(1.4, 125)
    d1, _, _ = c.cells(220, 131)
    pores = np.clip(1 - d1 / 0.013, 0, 1) ** 1.6
    d1b, _, _ = c.cells(40, 141)
    cavities = np.clip(1 - d1b / 0.04, 0, 1) ** 2.2
    # Bedding planes: thin, slightly wavy layers with uneven hardness (some recess, some stand proud).
    layer = c.v * 14 + broad * 0.7 + medium * 0.08
    band = np.sin(layer * 2 * np.pi)
    bedding = smoothstep(0.65, 0.95, band) - smoothstep(-0.95, -0.7, band) * 0.6
    # Hairline fractures: zero-crossings of warped noise.
    crack_field = c.fbm([60, 28], [1, 0.4], 171)
    cracks = np.exp(-(crack_field / 0.05) ** 2) * smoothstep(0.1, 0.6, c.fbm([90], [1], 181))
    height = (medium * 0.32 + fine * 0.14 + grit * 0.05 + bedding * 0.16 + broad * 0.12
              - pores * 0.85 - cavities * 0.9 - cracks * 0.55)
    stone = np.array([0.63, 0.60, 0.54])
    col = stone + broad[..., None] * np.array([0.05, 0.045, 0.04]) + medium[..., None] * 0.035 + fine[..., None] * 0.03
    col += grit[..., None] * 0.012
    crest = np.clip(medium * 0.8 + 0.15 - pores - cavities, 0, 1)
    col = mix(col, crest, [0.84, 0.82, 0.77], 0.2)
    # Turf algae film in shallow hollows, crustose coralline algae patches, sparse sponge stains.
    turf = np.clip(c.fbm([42, 18], [1, 0.6], 151) * 0.9 - 0.55, 0, 1)
    col = mix(col, turf, [0.36, 0.40, 0.27], 0.55)
    coralline = np.clip(c.fbm([64, 24], [1, 0.5], 161) - 0.95, 0, 1) ** 0.6
    col = mix(col, coralline, [0.62, 0.44, 0.52], 0.6)
    sponge = np.clip(c.fbm([24, 10], [1, 0.6], 191) - 1.6, 0, 1) ** 0.5
    col = mix(col, sponge, [0.70, 0.52, 0.30], 0.5)
    recess = np.clip(pores + cavities * 0.8 + cracks * 0.6, 0, 1)
    col *= (1 - recess * 0.55)[..., None]
    rough = 0.88 + fine * 0.03 + recess * 0.08 - turf * 0.06 - coralline * 0.08
    write('p062-natural-rock', col, height, 4.8, rough, 1 - recess * 0.65)


def rock_crafted():
    c = Canvas(512, 62002)
    broad = c.fbm([170, 80], [1, 0.5], 201)
    medium = c.fbm([40, 22], [1, 0.4], 211)
    fine = c.blur(c.spectral(4.0, 221), 1.2)
    d1, _, idx = c.cells(70, 231)
    r = np.random.default_rng(232).random((70, 2))
    radius = (0.008 + r[:, 0] ** 2 * 0.026)[idx]
    keep = (r[:, 1] < 0.45)[idx]
    pores = smoothstep(radius, radius * 0.45, d1) * keep  # a few varied, crisp-edged pockets
    layer = c.v * 6 + broad * 0.45
    band = np.sin(layer * 2 * np.pi)
    bedding = smoothstep(0.2, 0.8, band) * 0.6 - smoothstep(-0.9, -0.5, band) * 0.4
    height = medium * 0.28 + fine * 0.06 + bedding * 0.24 + broad * 0.1 - pores * 0.7
    stone = np.array([0.66, 0.62, 0.55])
    col = stone + broad[..., None] * np.array([0.04, 0.035, 0.03]) + medium[..., None] * 0.025
    # Painterly value design: lit layer tops lighter, layer undersides cooler and darker.
    col = mix(col, smoothstep(0.3, 0.9, band), [0.80, 0.77, 0.70], 0.25)
    col = mix(col, smoothstep(-0.3, -0.9, band), [0.46, 0.47, 0.46], 0.25)
    coralline = smoothstep(0.9, 1.4, c.fbm([80, 40], [1, 0.4], 261))
    col = mix(col, coralline, [0.70, 0.50, 0.58], 0.55)
    turf = smoothstep(0.7, 1.2, c.fbm([60, 30], [1, 0.4], 251))
    col = mix(col, turf, [0.48, 0.52, 0.36], 0.4)
    col *= (1 - pores * 0.3)[..., None]
    rough = 0.86 + fine * 0.02 + pores * 0.06 - coralline * 0.06
    write('p062-crafted-rock', col, height, 3.2, rough, 1 - pores * 0.5)


# ---------------------------------------------------------------- brain / massive coral


def brain_natural():
    """Septa: fine ridges across the meander walls, with a granular coenosteum."""
    c = Canvas(1024, 62003)
    warp = c.fbm([30, 14], [1, 0.5], 301)
    septa = np.sin((c.u * 90 + warp * 2.2) * 2 * np.pi) * 0.5 + 0.5
    septa = septa ** 2
    gran = c.spectral(1.3, 311)
    mottle = c.fbm([60, 20], [1, 0.5], 321)
    height = septa * 0.6 + gran * 0.12 + mottle * 0.08
    tone = 0.80 + septa * 0.1 + gran * 0.03 + mottle * 0.04
    col = np.stack([tone, tone * 0.98, tone * 0.93], -1)
    bleach = np.clip(c.fbm([90, 40], [1, 0.4], 331) - 1.2, 0, 1)
    col = mix(col, bleach, [0.92, 0.90, 0.84], 0.35)
    write('p062-natural-brain', col, height, 5.5, 0.62 + (1 - septa) * 0.14 + gran * 0.02, 0.7 + septa * 0.3)


def brain_crafted():
    c = Canvas(512, 62004)
    warp = c.blur(c.fbm([40, 20], [1, 0.4], 401), 1.5)
    septa = np.sin((c.u * 40 + warp * 1.4) * 2 * np.pi) * 0.5 + 0.5
    septa = smoothstep(0.25, 0.85, septa)
    mottle = c.fbm([90, 40], [1, 0.4], 421)
    height = septa * 0.45 + mottle * 0.05
    tone = 0.84 + septa * 0.08 + mottle * 0.03
    col = np.stack([tone, tone * 0.985, tone * 0.95], -1)
    write('p062-crafted-brain', col, height, 3.5, 0.6 + (1 - septa) * 0.1, 0.8 + septa * 0.2)


# ---------------------------------------------------------------- branching coral


def branch_natural():
    """Acropora radial corallites: raised tubular cups with dark mouths, porous coenosteum."""
    c = Canvas(1024, 62005)
    d1, d2, _ = c.cells(1600, 501, jitter=0.55)
    spacing = 1 / 40
    cup = np.clip(1 - d1 / (spacing * 0.40), 0, 1)
    rim = np.exp(-((d1 - spacing * 0.30) / (spacing * 0.08)) ** 2)
    mouth = np.clip(1 - d1 / (spacing * 0.17), 0, 1)
    pores = c.spectral(1.2, 511)
    height = rim * 0.9 + cup * 0.25 - mouth ** 1.5 * 0.9 + pores * 0.07
    tone = 0.84 + rim * 0.07 + pores * 0.025 - mouth * 0.3
    col = np.stack([tone, tone * 0.985, tone * 0.955], -1)
    write('p062-natural-branch', col, height, 5.0, 0.66 + mouth * 0.15 + pores * 0.02, 1 - mouth * 0.5)


def branch_crafted():
    c = Canvas(512, 62006)
    d1, _, _ = c.cells(484, 601, jitter=0.35)
    spacing = 1 / 22
    cup = smoothstep(spacing * 0.42, spacing * 0.18, d1)
    mouth = smoothstep(spacing * 0.16, spacing * 0.08, d1)
    height = cup * 0.6 - mouth * 0.5
    tone = 0.86 + cup * 0.06 - mouth * 0.18
    col = np.stack([tone, tone * 0.985, tone * 0.96], -1)
    write('p062-crafted-branch', col, height, 3.0, 0.6 + mouth * 0.1, 1 - mouth * 0.35)


# ---------------------------------------------------------------- seagrass


def grass_natural():
    """Thalassia: parallel veins, cell sheen, epiphyte crusts and grazing scars (blades are U across)."""
    c = Canvas(1024, 62007)
    veins = np.sin((c.u * 26 + c.fbm([160], [1], 701) * 0.04) * 2 * np.pi) * 0.5 + 0.5
    veins = veins ** 3
    cell = c.spectral(1.2, 711)
    d1, _, _ = c.cells(700, 721)
    epi = np.clip(1 - d1 / 0.006, 0, 1) * (c.fbm([30], [1], 731) > 0.25)
    film = np.clip(c.fbm([50, 20], [1, 0.5], 741) - 0.8, 0, 1)
    height = veins * 0.3 + cell * 0.05 + epi * 0.8
    tone = 0.84 + veins * 0.06 + cell * 0.02
    col = np.stack([tone, tone, tone * 0.95], -1)
    col = mix(col, film, [0.78, 0.74, 0.58], 0.45)
    col = mix(col, epi, [0.93, 0.86, 0.84], 0.85)
    write('p062-natural-grass', col, height, 3.0, 0.55 + film * 0.25 + epi * 0.3, 1 - film * 0.15)


def grass_crafted():
    c = Canvas(512, 62008)
    veins = np.sin(c.u * 9 * 2 * np.pi) * 0.5 + 0.5
    midrib = np.exp(-((c.u - 0.5) / 0.04) ** 2)
    height = veins * 0.15 + midrib * 0.4
    tone = 0.88 + veins * 0.04 + midrib * 0.05
    col = np.stack([tone, tone, tone * 0.97], -1)
    write('p062-crafted-grass', col, height, 2.0, 0.5 + veins * 0.05, np.ones_like(tone))


if __name__ == '__main__':
    for build in (rock_natural, rock_crafted, brain_natural, brain_crafted, branch_natural, branch_crafted,
                  grass_natural, grass_crafted):
        build()
        print('wrote', build.__name__)
    print(OUT)
