"""v0.6 Pass 034: the sea cave's whitetip reef shark.

    python3 tools/art/pass034/whitetip.py      # Blender 5.1 module
    node tools/art/pass017/compress.mjs        # then compress

Pass 025's reef shark body (the same lofted shape, fins, stroke morphs and distance level) with
its own skin: grey-brown above, white below, and white tips on its dorsal and tail fins.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass025'))
import creatures as c  # noqa: E402  (Pass 025 helpers; imports bpy, bmesh)
import numpy as np  # noqa: E402

c.TEX = c.ROOT / 'tools/art/textures/pass034'
smooth, lerp, fbm, grid = c.smooth, c.lerp, c.fbm, c.grid


def whitetip_maps():
    u, v = grid()
    s = u / 0.94
    e = -np.cos(2 * np.pi * v)  # -1 along the belly, +1 along the back
    ang = np.minimum(v, 1 - v) * 2 * np.pi
    nz = fbm(u, v, 8, 21)
    edge = -0.18 + 0.08 * (nz - 0.5)
    back = lerp([0.47, 0.44, 0.39], [0.36, 0.34, 0.3], smooth(0.3, 1.0, e))
    col = lerp([0.9, 0.9, 0.87], back, smooth(edge - 0.06, edge + 0.06, e))
    # A few darker spots scattered over the flanks, as on many whitetips.
    spots = smooth(0.66, 0.72, fbm(u * 3, v, 30, 22))
    col *= (1 - 0.18 * spots * smooth(-0.2, 0.2, e))[..., None]
    col *= (0.93 + 0.07 * fbm(u * 2, v, 12, 12))[..., None]
    gills = np.zeros_like(u)
    for g in (0.15, 0.164, 0.178, 0.192, 0.206):
        gills = np.maximum(gills, 1 - smooth(0.002, 0.0045, np.abs(s - g + 0.01 * (e + 0.3))))
    gills *= smooth(-0.5, -0.32, e) * (1 - smooth(0.05, 0.2, e))
    mouth = (1 - smooth(0.003, 0.007, np.abs(s - (0.068 + 0.035 * (ang / 0.9) ** 2)))) * (1 - smooth(0.75, 0.9, ang))
    col *= (1 - 0.38 * np.maximum(gills, mouth))[..., None]
    tip = np.clip((v - 0.1) / 0.85, 0, 1)
    white = [0.93, 0.93, 0.9]
    dark = lerp([0.42, 0.4, 0.36], white, smooth(0.62, 0.85, tip))
    pale = lerp([0.68, 0.67, 0.63], [0.8, 0.8, 0.77], smooth(0.62, 0.85, tip))
    col = np.where((u >= 0.94)[..., None], np.where((u < 0.97)[..., None], dark, pale), col)
    col = np.where(((u >= 0.94) & (v < 0.08))[..., None], [0.02, 0.02, 0.025], col)
    height = (0.5 * fbm(u * 2, v, 16, 13, 3) - 2.5 * np.maximum(gills, mouth)) * (u < 0.94)
    rough = np.where((u >= 0.94) & (v < 0.08), 0.12, 0.5)
    return (c.save_png('creature_whitetip_base', col), c.save_png('creature_whitetip_normal', c.normal_map(height, 1.5)),
            c.save_roughness('creature_whitetip_orm', rough))


if __name__ == '__main__':
    shark = c.CREATURES['shark']
    c.CREATURES['whitetip'] = ('whitetip-shark', 'Whitetip_Root', shark[2], whitetip_maps)
    c.build('whitetip')
