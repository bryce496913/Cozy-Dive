"""Pass 015: five original authored nudibranchs replacing the procedural instanced forms.

    python3 tools/art/pass015/nudibranchs.py   # Blender 5.1 Python module

Each species matches an existing `NUDIBRANCH_VARIANTS` entry (same order and palette family) and
fits the surface-home envelope its home was validated against: every vertex within 0.27 of the
crawl origin in XZ (home radius 0.285) and 0 <= y <= 0.235 (home height 0.26, minus the 3 mm
mantle ripple). Animal space: +Z forward (rhinophores), Y up from the sole, foot on y = 0.
"""
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass014'))
import reef_geometry as rg  # noqa: E402
from reef_geometry import Mesh, Waves, blob, curve, icosphere, merge, smoothstep, tube  # noqa: E402

OUT = ROOT / 'public/assets/models/creatures/nudibranchs.glb'
TAU = math.tau
REACH, HEIGHT = 0.27, 0.235


def mantle(length, width, height, rim_flare, wave, seed, colors):
    """Dorid notum: domed body with a thin undulating mantle skirt and a flat creeping sole."""
    base, rim, spot_col, spot_size = colors
    d, f = icosphere(4)
    p = d * np.array([width, height, length])
    ring = np.hypot(d[:, 0], d[:, 2])
    equator = np.exp(-(d[:, 1] / 0.22) ** 2)
    ang = np.arctan2(d[:, 0], d[:, 2])
    flare = 1 + rim_flare * equator * (1 + wave * np.sin(ang * 9 + seed))
    p[:, 0] *= flare
    p[:, 2] *= 1 + rim_flare * 0.5 * equator
    p[:, 1] += wave * 0.012 * equator * np.sin(ang * 9 + seed)
    p[:, 1] = np.maximum(p[:, 1], 0) + 0.004
    p[d[:, 1] < -0.05, 1] = 0.0  # flat creeping sole
    # Colour: body, contrasting mantle border, raised spots.
    edge = smoothstep(0.86, 0.98, ring) * (d[:, 1] > -0.05)
    col = np.tile(base, (len(p), 1)).astype(float)
    col = col * (1 - edge[:, None]) + np.array(rim) * edge[:, None]
    if spot_col is not None:
        rng = np.random.default_rng(seed)
        centres = rng.standard_normal((70, 3))
        centres[:, 1] = np.abs(centres[:, 1])
        centres /= np.linalg.norm(centres, axis=1, keepdims=True)
        dist = np.min(np.linalg.norm(d[:, None, :] - centres[None], axis=2), axis=1)
        spot = smoothstep(spot_size, spot_size * 0.5, dist) * (1 - edge)
        col = col * (1 - spot[:, None]) + np.array(spot_col) * spot[:, None]
        p += (rg.vertex_normals(p, f) * (spot * 0.0025)[:, None])
    col *= (0.8 + 0.2 * smoothstep(0.0, height, p[:, 1]))[:, None]
    uv = np.stack([np.arctan2(d[:, 2], d[:, 0]) / TAU * 4, d[:, 1] * 2], 1)
    return Mesh('mantle', '', p, f, uv, np.concatenate([col, np.ones((len(p), 1))], 1))


def rhinophores(z, spread, height, color, tip):
    parts = []
    for side in (-1, 1):
        pts = np.array([[side * spread, height * 0.55, z], [side * spread * 1.15, height * 0.85, z + 0.008],
                        [side * spread * 1.25, height * 1.05, z + 0.014]])
        sp = curve(pts, 9)
        radii = np.array([0.006, 0.0075, 0.009, 0.0095, 0.0095, 0.009, 0.008, 0.006, 0.003])
        # Lamellae: stacked plates on the club read as ridges.
        m = tube(sp, radii, 8, color, profile=lambda i, a: 1 + (0.22 if 2 <= i <= 7 and i % 2 else 0))
        t = np.linspace(0, 1, len(m.positions))
        m.colors[:, :3] = m.colors[:, :3] * (1 - smoothstep(0.75, 1, t)[:, None]) + np.array(tip) * smoothstep(0.75, 1, t)[:, None]
        parts.append(m)
    return parts


def gills(z, height, color, tip, count, seed):
    """Branchial plume: a ring of bipinnate gill leaflets around the anus at the rear."""
    rng = np.random.default_rng(seed)
    parts = []
    centre = np.array([0, height * 0.92, z])
    for k in range(count):
        a = k / count * TAU
        out = np.array([math.sin(a) * 0.6, 1.0, math.cos(a) * 0.6 - 0.35])
        out /= np.linalg.norm(out)
        L = 0.05 + rng.random() * 0.015
        spine = curve(np.array([centre, centre + out * L * 0.5 + [0, 0.004, 0], centre + out * L]), 6)
        parts.append(tube(spine, np.linspace(0.0045, 0.0015, 6), 5, color))
        for j in range(1, 5):
            base = spine[j]
            for s in (-1, 1):
                side = np.cross(out, [0, 0, 1.0]) * s
                twig = base + side * 0.011 + out * 0.006
                parts.append(tube(np.array([base, twig]), np.array([0.0022, 0.001]), 4, tip if j > 2 else color))
    return parts


def aeolid(length, color, core, tip, seed, rows=7, per_row=3):
    """Aeolid: slender body, long oral tentacles, rhinophores and rows of spindle cerata."""
    rng = np.random.default_rng(seed)
    parts = []
    spine = curve(np.array([[0, 0.022, -length / 2], [0, 0.03, -length * 0.15], [0, 0.034, length * 0.25],
                            [0, 0.03, length / 2]]), 20)
    t = np.linspace(0, 1, 20)
    radii = 0.03 * np.sin(np.clip(t, 0.02, 0.98) * math.pi) ** 0.5 * (0.6 + 0.4 * t)
    body = tube(spine, radii, 14, color, flatten=1.35)
    body.positions[:, 1] = np.maximum(body.positions[:, 1], 0.0)
    parts.append(body)
    parts.append(blob(np.array([0, 0.008, 0]), 1, 3, tuple(c * 0.85 for c in color), None, 0,
                      (0.032, 0.008, length * 0.5)))  # foot sole
    for side in (-1, 1):  # oral tentacles
        pts = np.array([[side * 0.015, 0.03, length / 2 - 0.01], [side * 0.05, 0.03, length / 2 + 0.02],
                        [side * 0.08, 0.025, length / 2 + 0.03]])
        parts.append(tube(curve(pts, 6), np.linspace(0.0045, 0.0015, 6), 6, color))
    parts += rhinophores(length / 2 - 0.035, 0.012, 0.075, tip, tip)
    for r in range(rows):
        z = length / 2 - 0.07 - r * (length - 0.1) / rows
        for side in (-1, 1):
            for c in range(per_row):
                lean = side * (0.35 + c * 0.35)
                base = np.array([side * (0.01 + c * 0.007), 0.045, z + (rng.random() - 0.5) * 0.008])
                L = 0.06 + rng.random() * 0.03 - c * 0.012
                direction = np.array([lean, 1.0, -0.25])
                direction /= np.linalg.norm(direction)
                sp = curve(np.array([base, base + direction * L * 0.5 + [0, 0, -0.004], base + direction * L]), 7)
                rr = 0.0065 * np.sin(np.linspace(0.25, 1.0, 7) * math.pi) ** 0.7 + 0.0012
                m = tube(sp, rr, 7, core)
                tt = np.linspace(0, 1, len(m.positions))
                band = smoothstep(0.62, 0.8, tt)
                m.colors[:, :3] = m.colors[:, :3] * (1 - band[:, None]) + np.array(tip) * band[:, None]
                parts.append(m)
    return parts


SPECIES = [
    # id, builder
    ('blue-orange-cerata', lambda: aeolid(0.3, (0.42, 0.58, 0.76), (0.86, 0.52, 0.22), (0.98, 0.84, 0.50), 2501)),
    ('yellow-purple-dorid', lambda: [mantle(0.15, 0.065, 0.048, 0.28, 0.4, 2511,
                                            ((0.96, 0.82, 0.24), (0.52, 0.30, 0.66), (0.98, 0.98, 0.92), 0.11))]
     + rhinophores(0.1, 0.022, 0.07, (0.48, 0.28, 0.62), (0.6, 0.4, 0.74))
     + gills(-0.095, 0.07, (0.50, 0.30, 0.64), (0.70, 0.52, 0.80), 8, 2512)),
    ('pale-edged-dorid', lambda: [mantle(0.15, 0.062, 0.045, 0.26, 0.3, 2521,
                                         ((0.86, 0.90, 0.94), (0.96, 0.96, 0.98), (0.18, 0.42, 0.70), 0.09))]
     + rhinophores(0.1, 0.02, 0.066, (0.92, 0.66, 0.30), (0.98, 0.80, 0.50))
     + gills(-0.095, 0.066, (0.94, 0.94, 0.96), (0.92, 0.66, 0.30), 9, 2522)),
    ('orange-white-cerata', lambda: aeolid(0.28, (0.96, 0.62, 0.36), (0.90, 0.44, 0.16), (0.99, 0.97, 0.92), 2531,
                                            rows=6, per_row=4)),
    ('violet-dorid', lambda: [mantle(0.15, 0.064, 0.05, 0.3, 0.5, 2541,
                                     ((0.62, 0.48, 0.80), (0.98, 0.96, 0.98), (0.94, 0.84, 0.36), 0.07))]
     + rhinophores(0.1, 0.021, 0.072, (0.96, 0.66, 0.24), (0.98, 0.82, 0.40))
     + gills(-0.095, 0.072, (0.96, 0.70, 0.26), (0.98, 0.86, 0.52), 8, 2542)),
]


def species(index):
    name, build = SPECIES[index]
    m = merge(f'Nudibranch_{index + 1}', 'NudiSkin', build())
    # Fit the validated envelope (uniform scale keeps proportions; never enlarges).
    reach = np.hypot(m.positions[:, 0], m.positions[:, 2]).max()
    top = m.positions[:, 1].max()
    s = min(1.0, REACH / reach, HEIGHT / top)
    m.positions *= s
    m.positions[:, 1] = np.maximum(m.positions[:, 1], 0)
    m.extras = {'species': name, 'fitScale': round(float(s), 4)}
    return m


if __name__ == '__main__':
    import bpy  # noqa: F401
    import build as reef_build

    reef_build.MATERIALS['NudiSkin'] = ('pass015/nudi-skin', (1, 1, 1), 0.4, 0.6)
    reef_build.reset()
    lib = [species(i) for i in range(len(SPECIES))]
    for i, m in enumerate(lib):
        root = reef_build.root(f'Nudibranch_{i + 1}_Root', i, {'library': 'pass015-nudibranchs'})
        reef_build.make_mesh(m, root)
        print(m.name, m.extras, m.triangles)
    reef_build.bpy.data.materials['NudiSkin'].use_backface_culling = False
    for image in reef_build.bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    reef_build.bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'nudibranchs.blend'), compress=True)
    reef_build.bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True,
                                         export_extras=True, export_animations=False,
                                         export_vertex_color='ACTIVE')
    print('exported', OUT, OUT.stat().st_size)
