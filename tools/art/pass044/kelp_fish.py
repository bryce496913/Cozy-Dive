"""v0.6 Pass 044: kelp forest fish on the accepted chromis rig (Pass 016's method, Pass 043's script).

    python3 tools/art/pass044/kelp_fish.py [seabass|sheephead]   # Blender 5.1 module; adds LOD1
    node tools/art/pass017/compress.mjs                          # then compress

  * giant sea bass: huge (2.2 m), deep and heavy, with a big mouth; dark bronze-grey with large,
    scattered black spots and a paler belly;
  * California sheephead (a male): a long, heavy wrasse with a blunt forehead; black head and
    tail, a broad brick-red middle, a white chin.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass043'))
import reef_fish as R  # noqa: E402  (patches the Pass 016 pipeline; imports bpy)
import numpy as np  # noqa: E402

F, L, ss, mix, band = R.F, R.L, R.ss, R.mix, R.band

KELP_FISH = {
    'seabass': dict(id='giant-sea-bass', name='Giant_Sea_Bass', length=2.2, height=0.72, width=0.4, eye=0.55,
                    iris=(0.3, 0.25, 0.15), hump=0.06),
    'sheephead': dict(id='california-sheephead', name='Sheephead', length=0.95, height=0.3, width=0.16,
                      eye=0.9, iris=(0.8, 0.25, 0.1), hump=0.07),
}
F.SPECIES.update(KELP_FISH)
R.NEW.update(KELP_FISH)
_pattern = F.pattern


def pattern(name, p, fin):
    if name not in KELP_FISH:
        return _pattern(name, p, fin)
    u = (p[:, 0] + 0.255) / F.CHROMIS['length']
    v = p[:, 1] / F.CHROMIS['half']
    n = len(p)
    if name == 'seabass':
        col = np.tile([0.32, 0.31, 0.27], (n, 1))
        col = mix(col, [0.55, 0.52, 0.45], ss(-0.2, -0.9, v))
        cells = R.F.cKDTree(np.random.default_rng(4401).random((70, 2)) * [0.44, 0.2] + [-0.22, -0.1])
        d, _ = cells.query(p[:, :2])
        col = mix(col, [0.07, 0.07, 0.07], ss(0.016, 0.009, d) * (np.abs(p[:, 2]) > 0.004))
        if fin:
            col = mix(col, [0.2, 0.2, 0.18], 0.5)
    else:
        col = np.tile([0.72, 0.2, 0.16], (n, 1))
        col = mix(col, [0.07, 0.06, 0.07], ss(0.68, 0.74, u))
        col = mix(col, [0.07, 0.06, 0.07], 1 - ss(0.2, 0.26, u))
        col = mix(col, [0.95, 0.94, 0.9], ss(0.86, 0.9, u) * ss(-0.2, -0.6, v))
        if fin:
            col = mix(col, [0.08, 0.07, 0.08], 0.75)
    if not fin:
        col = col * (1 - ss(0.3, 1.0, v)[:, None] * 0.12)
    return np.clip(col, 0, 1)


F.pattern = pattern

if __name__ == '__main__':
    F.neutral_maps()
    for k in sys.argv[1:] or list(KELP_FISH):
        F.build(k)
        L.SOURCES[k] = L.FISH / f'{k}.glb'
        L.build(k)
        (F.HERE / f'{k}.blend').unlink(missing_ok=True)
