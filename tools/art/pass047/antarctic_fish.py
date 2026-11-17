"""v0.6 Pass 047: Antarctic fish on the accepted chromis rig (Pass 016's method, Pass 043's script).

    python3 tools/art/pass047/antarctic_fish.py [icefish|notothen]   # Blender 5.1 module; adds LOD1
    node tools/art/pass017/compress.mjs                              # then compress

  * blackfin icefish (crocodile icefish): long and slim with a long, flat, duck-like snout and big
    fan pectorals; pale, almost translucent grey-white (no red blood), faint dusky bars, dark fins;
  * bald notothen: small and slender with a big head, mottled grey-brown above and pale below; it
    lives in the hollows under the sea ice.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'pass043'))
import reef_fish as R  # noqa: E402  (patches the Pass 016 pipeline; imports bpy)
import numpy as np  # noqa: E402

F, L, ss, mix, band = R.F, R.L, R.ss, R.mix, R.band

ICE_FISH = {
    'icefish': dict(id='blackfin-icefish', name='Icefish', length=0.75, height=0.16, width=0.11, eye=1.25,
                    iris=(0.75, 0.78, 0.8), snout=0.16),
    # v0.6 Pass 048: the rare toothfish: big (1.7 m), heavy-jawed, dark grey-brown, rising from the dark.
    'toothfish': dict(id='antarctic-toothfish', name='Toothfish', length=1.7, height=0.36, width=0.26, eye=0.75,
                      iris=(0.7, 0.62, 0.3), hump=0.03),
    'notothen': dict(id='bald-notothen', name='Notothen', length=0.42, height=0.11, width=0.07, eye=1.15,
                     iris=(0.6, 0.55, 0.4)),
}
F.SPECIES.update(ICE_FISH)
R.NEW.update(ICE_FISH)
_apply = F.apply


def apply(points, basis, spec, fin):
    out = _apply(points, basis, spec, fin)
    if spec.get('snout'):
        # The snout: the head drawn out forward and flattened, like a duck's bill.
        u = (basis[:, 0] + 0.255) / F.CHROMIS['length']
        k = ss(0.8, 1.0, u)
        out[:, 0] += spec['snout'] * k * 1.6
        out[:, 1] *= 1 - 0.45 * k
    return out


F.apply = apply
_pattern = F.pattern


def pattern(name, p, fin):
    if name not in ICE_FISH:
        return _pattern(name, p, fin)
    u = (p[:, 0] + 0.255) / F.CHROMIS['length']
    v = p[:, 1] / F.CHROMIS['half']
    n = len(p)
    if name == 'icefish':
        col = np.tile([0.86, 0.88, 0.88], (n, 1))
        bars = (0.5 + 0.5 * np.sin(u * 2 * np.pi * 5)) ** 6 * ss(0.15, 0.3, u) * (1 - ss(0.75, 0.85, u))
        col = mix(col, [0.55, 0.58, 0.6], 0.5 * bars * ss(-0.2, 0.4, v))
        if fin:
            col = mix(col, [0.12, 0.13, 0.15], 0.7)
    elif name == 'toothfish':
        col = np.tile([0.34, 0.32, 0.3], (n, 1))
        col = mix(col, [0.52, 0.5, 0.47], ss(-0.2, -0.9, v))
        mottle = (0.5 + 0.5 * np.sin(u * 37 + np.sin(v * 9) * 2)) ** 6
        col = mix(col, [0.22, 0.2, 0.19], 0.4 * mottle)
        if fin:
            col = mix(col, [0.25, 0.24, 0.23], 0.6)
    else:
        col = np.tile([0.5, 0.46, 0.4], (n, 1))
        cells = R.F.cKDTree(np.random.default_rng(4702).random((60, 2)) * [0.44, 0.2] + [-0.22, -0.1])
        d, _ = cells.query(p[:, :2])
        col = mix(col, [0.28, 0.25, 0.22], ss(0.02, 0.01, d))
        col = mix(col, [0.88, 0.86, 0.8], ss(-0.1, -0.7, v))
        if fin:
            col = mix(col, [0.45, 0.42, 0.38], 0.5)
    if not fin:
        col = col * (1 - ss(0.3, 1.0, v)[:, None] * 0.1)
    return np.clip(col, 0, 1)


F.pattern = pattern

if __name__ == '__main__':
    F.neutral_maps()
    for k in sys.argv[1:] or list(ICE_FISH):
        F.build(k)
        L.SOURCES[k] = L.FISH / f'{k}.glb'
        L.build(k)
        (F.HERE / f'{k}.blend').unlink(missing_ok=True)
