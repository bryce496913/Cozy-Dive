"""V0.7 Pass 063: Crafted Stylized Realism maps for the templates the benchmark did not cover.

    python3 tools/art/v07/template_textures.py

Shell, metal and wood follow the approved B treatment rules: biology/material read in broad,
calm shapes; crisp but sparse accents; lower-frequency normals; colour fields evened. 512 px
(hero tier) so the reference swatches can be judged up close; production assets pick the tier
their screen importance earns (standards.json `textureTiers`).
Output: tools/art/textures/pass063/p063-{shell,metal,wood}-{base,normal,orm}.png
"""
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass062'))
import style_textures as st  # noqa: E402  (shared Canvas, write, smoothstep)

st.OUT = HERE.parent / 'textures/pass063'
smoothstep = st.smoothstep


def shell():
    """Calcium carbonate shell: concentric growth bands and a few clean radial ribs."""
    c = st.Canvas(512, 63001)
    bands = np.sin((c.v * 18 + c.fbm([90], [1], 11) * 0.25) * 2 * np.pi) * 0.5 + 0.5
    ribs = smoothstep(0.55, 0.95, np.sin(c.u * 2 * np.pi * 7) * 0.5 + 0.5)
    mottle = c.fbm([70, 30], [1, 0.4], 21)
    height = bands * 0.25 + ribs * 0.5 + mottle * 0.05
    tone = 0.86 + bands * 0.05 + ribs * 0.04 + mottle * 0.03
    col = np.stack([tone, tone * 0.95, tone * 0.88], -1)
    col = st.mix(col, smoothstep(0.6, 1.1, mottle), [0.78, 0.60, 0.48], 0.35)
    rough = 0.62 - ribs * 0.12 + mottle * 0.02  # worn rib crests are a little glossier
    st.write('p063-shell', col, height, 2.5, rough, 0.85 + ribs * 0.15)


def metal():
    """Submerged iron/bronze: broad rust and crust fields; bare metal only on worn edges (ORM B)."""
    c = st.Canvas(512, 63002)
    broad = c.fbm([150, 70], [1, 0.5], 31)
    crust = smoothstep(0.3, 1.1, c.fbm([110, 50], [1, 0.3], 41))
    worn = smoothstep(1.0, 1.5, c.fbm([40, 18], [1, 0.4], 51)) * (1 - crust)
    pits = smoothstep(0.02, 0.008, c.cells(90, 61)[0])
    height = crust * 0.45 + broad * 0.1 - pits * 0.4
    rust = np.array([0.46, 0.28, 0.17]) + broad[..., None] * 0.04
    col = st.mix(rust, crust, [0.44, 0.42, 0.36], 0.55)
    col = st.mix(col, worn, [0.56, 0.52, 0.46], 0.9)
    col *= (1 - pits * 0.3)[..., None]
    rough = 0.82 - worn * 0.3 + crust * 0.04
    st.write('p063-metal', col, height, 3.0, rough, 1 - pits * 0.4, metal=worn * 0.85)


def wood():
    """Waterlogged timber: soft long grain, a couple of knots, silt settled in the grooves."""
    c = st.Canvas(512, 63003)
    warp = c.fbm([120, 50], [1, 0.4], 71)
    d, _, _ = c.cells(3, 81)
    knot = smoothstep(0.06, 0.0, d)
    grain = np.sin((c.u * 22 + warp * 0.18 + knot * 1.2) * 2 * np.pi) * 0.5 + 0.5
    grooves = smoothstep(0.75, 0.98, 1 - grain)
    height = grain * 0.3 - grooves * 0.35 + knot * 0.2
    col = np.array([0.50, 0.40, 0.29]) + (grain[..., None] - 0.5) * np.array([0.08, 0.06, 0.04])
    col = st.mix(col, grooves, [0.55, 0.53, 0.46], 0.55)  # silt in the grain
    col = st.mix(col, knot, [0.32, 0.24, 0.17], 0.6)
    rough = 0.86 + grooves * 0.04
    st.write('p063-wood', col, height, 2.6, rough, 1 - grooves * 0.3)


if __name__ == '__main__':
    for build in (shell, metal, wood):
        build()
        print('wrote', build.__name__)
