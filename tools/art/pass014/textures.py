"""Original tileable 512px PBR maps for the Pass 014 reef environment.

Every map is synthesised here from seeded spectral noise and periodic Voronoi cells,
so all sets tile seamlessly and no external imagery is used. Colour maps carry
restrained luminance/mineral detail; species hue comes from vertex/instance tint.
Run: python3 tools/art/pass014/textures.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

OUT = Path(__file__).resolve().parents[3] / 'public/assets/textures/pass014'
N = 512
rng = np.random.default_rng(14014)
v, u = np.mgrid[0:N, 0:N] / N


def spectral(scale, power=2.0, seed=None):
    """Periodic band-limited noise; `scale` is the dominant feature size in texels."""
    r = np.random.default_rng(seed) if seed is not None else rng
    white = np.fft.fft2(r.standard_normal((N, N)))
    fy, fx = np.meshgrid(np.fft.fftfreq(N), np.fft.fftfreq(N), indexing='ij')
    f = np.hypot(fx, fy)
    f0 = 1 / scale
    shaped = white * np.exp(-((np.log((f + 1e-9) / f0)) ** 2) * power)
    shaped[0, 0] = 0
    n = np.real(np.fft.ifft2(shaped))
    return (n - n.mean()) / (n.std() + 1e-9)


def fbm(scales, gains, seed):
    total = np.zeros((N, N))
    for i, (s, g) in enumerate(zip(scales, gains)):
        total += spectral(s, seed=seed + i) * g
    return total / sum(gains)


def cells(count, seed, jitter=None):
    """Periodic Voronoi: distance to nearest and second-nearest seed (in texture units).

    With `jitter`, seeds sit on a jittered grid for evenly packed biological cells."""
    r = np.random.default_rng(seed)
    if jitter is None:
        pts = r.random((count, 2))
    else:
        side = int(round(count ** 0.5))
        gy, gx = np.mgrid[0:side, 0:side]
        pts = (np.stack([gx.ravel(), gy.ravel()], -1) + 0.5 + (r.random((side * side, 2)) - 0.5) * jitter) / side
        pts %= 1.0
    tree = cKDTree(pts, boxsize=1.0)
    d, i = tree.query(np.stack([u.ravel(), v.ravel()], -1), k=2)
    return d[:, 0].reshape(N, N), d[:, 1].reshape(N, N), i[:, 0].reshape(N, N)


def normalize01(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, dy * strength, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def write(name, base, height, strength, rough, occlusion=None):
    OUT.mkdir(parents=True, exist_ok=True)

    def save(suffix, a):
        Image.fromarray(np.uint8(np.clip(a, 0, 1) * 255 + 0.5)).save(
            OUT / f'{name}-{suffix}.png', optimize=True
        )

    ao = np.ones((N, N)) if occlusion is None else occlusion
    save('base', base)
    save('normal', normal_from_height(height, strength) * 0.5 + 0.5)
    # glTF ORM: R occlusion, G roughness, B metalness (always zero for these organics/minerals).
    save('orm', np.stack([ao, rough, np.zeros((N, N))], -1))


def reef_rock():
    broad = fbm([140, 70], [1, 0.6], 101)
    medium = fbm([28, 14], [1, 0.5], 111)
    fine = spectral(3.5, seed=121)
    d1, d2, _ = cells(120, 131)
    pores = np.clip(1 - d1 / 0.016, 0, 1) ** 1.8  # erosion holes, fewer and crisper
    d1b, _, _ = cells(30, 141)
    cavities = np.clip(1 - d1b / 0.045, 0, 1) ** 2.4  # larger solution cavities
    strata = np.sin(v * 2 * np.pi * 9 + broad * 0.9) * 0.5 + 0.5
    height = (
        medium * 0.35 + fine * 0.14 + strata * 0.12 - pores * 0.9 - cavities * 0.9
        + broad * 0.15
    )
    # Warm grey/beige limestone, carbonate-white crests and sparse muted coralline/algal films.
    stone = np.array([0.66, 0.62, 0.55])
    col = stone + broad[..., None] * np.array([0.05, 0.045, 0.04])
    col += medium[..., None] * 0.04 + fine[..., None] * 0.025
    crest = np.clip(medium * 0.8 + 0.1 - pores - cavities, 0, 1)
    col = col * (1 - crest[..., None] * 0.18) + crest[..., None] * np.array([0.86, 0.84, 0.79]) * 0.18
    algae = np.clip(fbm([46, 20], [1, 0.6], 151) * 0.9 - 0.75, 0, 1)
    col = col * (1 - algae[..., None] * 0.45) + algae[..., None] * np.array([0.40, 0.46, 0.30]) * 0.45
    coralline = np.clip(fbm([60, 24], [1, 0.5], 161) - 1.1, 0, 1) ** 0.7
    col = col * (1 - coralline[..., None] * 0.55) + coralline[..., None] * np.array([0.66, 0.46, 0.54]) * 0.55
    recess = np.clip(pores + cavities * 0.8, 0, 1)
    col *= (1 - recess * 0.5)[..., None]
    rough = 0.86 + fine * 0.03 + recess * 0.08 - algae * 0.05
    write('reef-rock', col, height, 4.5, rough, 1 - recess * 0.6)


def coral_polyp():
    """Corallite cups: raised rims with recessed centres on a fine porous coenosteum."""
    d1, d2, _ = cells(576, 201, jitter=0.3)
    edge = d2 - d1
    spacing = 1 / 24
    cup = np.clip(1 - d1 / (spacing * 0.42), 0, 1)
    rim = np.exp(-((d1 - spacing * 0.34) / (spacing * 0.09)) ** 2)
    septa_angle = np.arctan2(*np.gradient(d1))
    septa = (np.sin(septa_angle * 12) * 0.5 + 0.5) * cup
    fine = spectral(2.5, seed=211)
    height = rim * 0.9 - cup ** 2 * 0.8 + septa * 0.12 + fine * 0.08 + np.clip(edge * 20, 0, 0.3)
    tone = 0.84 + fine * 0.025 + rim * 0.06 - cup ** 2 * 0.22
    col = np.stack([tone, tone * 0.985, tone * 0.955], -1)
    write('coral-polyp', col, height, 4.0, 0.74 + cup * 0.12 + fine * 0.03, 1 - cup ** 2 * 0.45)


def coral_brain():
    """Fine meandering ridges for massive/brain coral (major valleys are geometry)."""
    warp = fbm([40, 18], [1, 0.5], 301)
    warp2 = fbm([40, 18], [1, 0.5], 311)
    field = np.sin((u * 46 + warp * 1.6) * 2 * np.pi * 0.5) * np.cos((v * 46 + warp2 * 1.6) * 2 * np.pi * 0.5)
    ridge = 1 - np.abs(field)
    ridge = ridge ** 3
    fine = spectral(2.2, seed=321)
    height = ridge * 0.8 + fine * 0.1
    tone = 0.80 + ridge * 0.12 + fine * 0.025
    col = np.stack([tone, tone * 0.98, tone * 0.94], -1)
    write('coral-brain', col, height, 6.0, 0.72 + (1 - ridge) * 0.12, 0.75 + ridge * 0.25)


def soft_tissue():
    """Soft coral / gorgonian tissue with retracted polyp pores and spicule speckle."""
    d1, _, _ = cells(676, 401, jitter=0.45)
    polyp = np.clip(1 - d1 / 0.009, 0, 1)
    speck = spectral(1.8, seed=411)
    broad = fbm([90, 35], [1, 0.5], 421)
    height = -polyp ** 1.5 * 0.8 + speck * 0.06 + broad * 0.06
    tone = 0.86 + broad * 0.03 + speck * 0.02 - polyp * 0.18
    col = np.stack([tone, tone * 0.97, tone * 0.95], -1)
    write('soft-tissue', col, height, 5.0, 0.7 + polyp * 0.15, 1 - polyp * 0.35)


def algae():
    """Longitudinal blade striations and cellular sheen for seagrass and macroalgae."""
    stri = np.sin(u * 2 * np.pi * 38 + fbm([60], [1], 501) * 0.6) * 0.5 + 0.5
    cellsd, _, _ = cells(900, 511)
    cell = np.clip(cellsd / 0.01, 0, 1)
    broad = fbm([120, 40], [1, 0.4], 521)
    epiphyte = np.clip(fbm([30, 12], [1, 0.5], 531) - 1.1, 0, 1)
    height = stri * 0.25 + cell * 0.12 + broad * 0.05
    tone = 0.82 + stri * 0.08 + broad * 0.05 + cell * 0.03
    col = np.stack([tone, tone, tone * 0.96], -1)
    col = col * (1 - epiphyte[..., None] * 0.35) + epiphyte[..., None] * np.array([0.78, 0.72, 0.58]) * 0.35
    write('algae', col, height, 3.0, 0.62 + stri * 0.08 + epiphyte * 0.2)


def sand():
    """Fine carbonate grains, shell grit and tiny ripples; large ripples stay in geometry."""
    d1, d2, idx = cells(5200, 601)
    grain = np.clip(1 - d1 / 0.0045, 0, 1)
    hue = np.random.default_rng(611).random(5200)[idx]
    micro = np.sin((v * 7 + fbm([200], [1], 621) * 0.25) * 2 * np.pi) * 0.5 + 0.5
    broad = fbm([180, 60], [1, 0.5], 631)
    height = grain * 0.5 + micro * 0.35 + broad * 0.08
    base = np.array([0.80, 0.76, 0.68])
    col = base + broad[..., None] * np.array([0.03, 0.028, 0.024])
    col = col * (0.92 + grain[..., None] * 0.1)
    dark = (hue > 0.93)[..., None] * grain[..., None]
    col = col * (1 - dark * 0.35) + dark * np.array([0.45, 0.42, 0.38]) * 0.35
    pink = ((hue > 0.86) & (hue <= 0.93))[..., None] * grain[..., None]
    col = col * (1 - pink * 0.4) + pink * np.array([0.85, 0.66, 0.62]) * 0.4
    write('sand', col, height, 4.0, 0.93 - grain * 0.04, 0.85 + grain * 0.15)


if __name__ == '__main__':
    for build in (reef_rock, coral_polyp, coral_brain, soft_tissue, algae, sand):
        build()
    print(OUT)
