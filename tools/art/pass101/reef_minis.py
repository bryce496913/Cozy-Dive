"""V0.8 Pass 101: the outer reef's four rare miniatures.

    python3 tools/art/pass101/reef_minis.py      (Blender 5.1 Python module)

Writes tools/art/pass101/reef-minis.blend (editable source) and
public/assets/models/creatures/reef-minis.glb: one library of four named animals, each a single
mesh with natural vertex colours and its own morphs. Every animal has `Stroke_Left` and
`Stroke_Right` (the motion the wild animal, the album card and the aquarium miniature all drive);
the mimic octopus also has `Mimic_Flatfish` and `Mimic_Lionfish`, its two mimicry postures.

Each pose is built by the same builder with the same seeded randomness, so every pose has
identical topology: a morph is simply that pose's positions.

Game space: metres at the outer reef's real scale, +Y up, head towards +Z, resting on y = 0
(the pipefish's lowest fin tip; it hovers in the wild).

  Harlequin_Shrimp       Hymenocera picta (5 cm): cream body with large violet, dark-edged
                         spots; huge flattened petal claws; leaf-like flattened antennules on
                         eye stalks; slender walking legs; tail fan.
  Ghost_Pipefish         Solenostomus paradoxus (10 cm): slender red-and-yellow body, a long
                         tubular snout, large lacy fan fins (pelvics, dorsal, tail) with black
                         spots and frilly skin filaments.
  Hairy_Frogfish         Antennarius striatus (15 cm): globose striped body covered in hair-like
                         spinules, an upturned mouth, a lure with a worm-like esca, arm-like
                         pectoral fins with "hands" and pelvic fins it walks on.
  Mimic_Octopus          Thaumoctopus mimicus (45 cm across): small mantle and head with raised
                         eyes; eight long, slender arms banded brown and white.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'v07'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pass100'))
import cozy_art as ca  # noqa: E402
from rare_minis import Part, blob, hexc, tube, vertex_material  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = ca.ROOT / 'public/assets/models/creatures/reef-minis.glb'
POSES = ('rest', 'left', 'right')


def side_of(pose: str) -> float:
    return {'left': 1.0, 'right': -1.0}.get(pose, 0.0)


# ---------------------------------------------------------------- harlequin shrimp


def harlequin(pose: str) -> Part:
    rng = np.random.default_rng(1011)
    part = Part()
    cream, violet, edge, white = hexc(0xf4ead8), hexc(0x9b5ab8), hexc(0x4a2560), hexc(0xfbf8f2)
    s = side_of(pose)
    spots = rng.uniform(-1, 1, (26, 3))

    def spotted(base):
        def col(*args):
            q = args[-1]
            for p in spots:
                d = (q[0] / 0.008 - p[0]) ** 2 + ((q[2] + 0.004) / 0.022 - p[2]) ** 2
                if d < 0.05:
                    return violet if d < 0.03 else edge
            return base
        return col

    # Body: cephalothorax forward, abdomen arched and tapering to the tail fan.
    zs = np.linspace(-0.026, 0.016, 18)
    t = (zs - zs[0]) / (zs[-1] - zs[0])
    arch = 0.010 + 0.004 * np.sin(t * math.pi)
    sway = s * 0.003 * (1 - t) ** 2
    path = np.stack([sway, arch, zs], 1)
    tube(part, path, 0.0035 + 0.0035 * np.sin(np.clip(t, 0.05, 1) ** 0.7 * math.pi * 0.9),
         spotted(cream), seg=12, ry=0.004 + 0.003 * np.sin(np.clip(t, 0.05, 1) * math.pi))
    # Tail fan.
    for k in (-1, 0, 1):
        tip = np.array([sway[0] + k * 0.004, 0.006, -0.032])
        tube(part, np.linspace([sway[0], 0.009, -0.026], tip, 4), np.linspace(0.0018, 0.0009, 4), cream, seg=6)
    # Walking legs: four pairs, thin, down to the ground.
    for z in (0.010, 0.005, 0.0, -0.005):
        for side in (-1, 1):
            hip = np.array([side * 0.004, 0.009, z])
            knee = hip + [side * 0.006, 0.004, 0.001]
            toe = np.array([side * 0.012, 0.0, z + 0.002])
            tube(part, np.concatenate([np.linspace(hip, knee, 3), np.linspace(knee, toe, 3)[1:]]),
                 0.0007, white, seg=5)
    # The great petal claws, held up in front, flattened, white with violet spots.
    for side in (-1, 1):
        wave = 0.15 * s * side
        arm = np.array([[side * (0.004 + 0.004 * k), 0.012 + 0.006 * k + wave * 0.01 * k, 0.014 + 0.008 * k]
                        for k in np.linspace(0, 1, 5)])
        tube(part, arm, 0.0012, white, seg=6)
        c = arm[-1] + [side * 0.002, 0.003, 0.004]
        blob(part, c, [0.0035, 0.0012, 0.008],
             lambda d, q, c=c: violet if ((q[0] - c[0]) * 300) ** 2 + ((q[2] - c[2]) * 120 % 2 - 1) ** 2 < 0.5 else white,
             seg=14, rings=8)
    # Eye stalks with flattened leaf-like antennules.
    for side in (-1, 1):
        stalk = np.linspace([side * 0.002, 0.013, 0.015], [side * 0.004, 0.017, 0.019], 3)
        tube(part, stalk, 0.0008, cream, seg=5)
        blob(part, stalk[-1] + [side * 0.001, 0.0005, 0.0005], [0.0012] * 3, hexc(0x1a1414), seg=8, rings=5)
        blob(part, stalk[-1] + [side * 0.002, 0.004, 0.004], [0.0028, 0.0007, 0.0045], spotted(white), seg=10, rings=6)
    return part


# ---------------------------------------------------------------- ornate ghost pipefish


def fan(part: Part, root, spokes, colour, *, rows=5) -> None:
    """A thin fin membrane spanning `spokes` (tips relative to root), as a two-sided strip."""
    root = np.asarray(root, float)
    pts, uvs, cols, faces = [], [], [], []
    n = len(spokes)
    for i, tip in enumerate(spokes):
        for r in range(rows):
            u = r / (rows - 1)
            q = root + np.asarray(tip, float) * u
            pts.append(q)
            uvs.append((i / (n - 1), u))
            cols.append(colour(i / (n - 1), u, q) if callable(colour) else colour)
    for i in range(n - 1):
        for r in range(rows - 1):
            a, b = i * rows + r, (i + 1) * rows + r
            faces += [(a, b, b + 1), (a, b + 1, a + 1)]
    part.add(pts, faces, uvs, cols)


def pipefish(pose: str) -> Part:
    rng = np.random.default_rng(1012)
    part = Part()
    red, yellow, white, black = hexc(0xc23a2a), hexc(0xe8c04a), hexc(0xf2ece0), hexc(0x1a1010)
    s = side_of(pose)
    L = 0.10
    zs = np.linspace(-L * 0.45, L * 0.2, 22)
    t = (zs - zs[0]) / (zs[-1] - zs[0])
    bend = s * 0.006 * np.sin(t * math.pi)
    y0 = 0.042
    path = np.stack([bend, y0 + 0.002 * np.sin(t * 6), zs], 1)

    def banded(u, j, q):
        return white if (u * 9) % 1 < 0.18 else (yellow if (u * 3) % 1 < 0.35 else red)

    tube(part, path, 0.0022 + 0.0028 * np.sin(np.clip(t, 0.03, 1) ** 0.8 * math.pi), banded, seg=10)
    # Long tubular snout and the head.
    head = path[-1]
    blob(part, head + [0, 0.001, 0.004], [0.004, 0.005, 0.007], red, seg=12, rings=8)
    tube(part, np.linspace(head + [0, 0, 0.008], head + [0, -0.002, 0.03], 6), np.linspace(0.0016, 0.0012, 6),
         lambda u, j, q: yellow if (u * 5) % 1 < 0.3 else red, seg=8)
    for side in (-1, 1):
        blob(part, head + [side * 0.0035, 0.002, 0.005], [0.0016] * 3, black, seg=8, rings=5)

    def lace(i, u, q):
        r = rng.random()
        return black if r < 0.12 else (white if r < 0.35 else (yellow if u > 0.6 else red))

    # Fan fins: two dorsals, large pelvics hanging below (a pocket), and the tail.
    fan(part, path[13], [[bend[13] + s * 0.004, 0.02 + 0.01 * math.sin(a * 3), -0.014 + 0.026 * a] for a in np.linspace(0, 1, 7)], lace)
    fan(part, path[5], [[bend[5], 0.010 + 0.004 * math.sin(a * 3), -0.008 + 0.012 * a] for a in np.linspace(0, 1, 5)], lace)
    for side in (-1, 1):
        fan(part, path[11], [[side * 0.012 + s * 0.003, -0.04 + 0.018 * a, -0.016 + 0.028 * a] for a in np.linspace(0, 1, 7)], lace)
    fan(part, path[0], [[bend[0] * 2 + s * 0.006, 0.018 * math.sin(a), -0.022 - 0.006 * math.cos(a)]
                        for a in np.linspace(-1.2, 1.2, 7)], lace)
    # Frilly skin filaments along the body.
    for k in range(18):
        i = 2 + int(k * 16 / 18)
        d = np.array([rng.uniform(-1, 1), rng.uniform(0.2, 1), rng.uniform(-0.3, 0.3)])
        d /= np.linalg.norm(d)
        tube(part, np.array([path[i] + d * 0.002 * j for j in range(4)]), np.linspace(0.0007, 0.0002, 4), white, seg=4)
    return part


# ---------------------------------------------------------------- hairy frogfish


def frogfish(pose: str) -> Part:
    rng = np.random.default_rng(1013)
    part = Part()
    tan, stripe, pale = hexc(0xc9a55a), hexc(0x4b3218), hexc(0xe8d6a0)
    s = side_of(pose)
    c = np.array([0, 0.05, 0])
    R = np.array([0.045, 0.045, 0.06])

    def skin(d, q):
        # Dark wavy stripes radiating from the eye, as on the striated frogfish.
        w = math.sin(q[2] * 140 + math.sin(q[1] * 90) * 2 + q[0] * 40)
        return stripe if w > 0.55 else (tan if d[1] > -0.4 else pale)

    blob(part, c, R, skin, seg=22, rings=14)
    # The upturned mouth: a darker cleft rimmed pale, opening forward and up.
    tube(part, np.array([[0.03 * math.cos(a), 0.072 + 0.01 * math.sin(a) ** 2, 0.052] for a in np.linspace(0.2, math.pi - 0.2, 9)]),
         0.004, pale, seg=6, cap=False)
    for side in (-1, 1):
        blob(part, [side * 0.024, 0.085, 0.038], [0.006] * 3, hexc(0x2a2010), seg=10, rings=6)
    # Lure: illicium rising from the snout with a pale, worm-like esca (waving with the stroke).
    lure = np.array([[s * 0.006 * k * k, 0.09 + 0.03 * k, 0.05 + 0.006 * k] for k in np.linspace(0, 1, 6)])
    tube(part, lure, 0.0012, stripe, seg=5)
    worm = np.array([lure[-1] + [0.003 * math.sin(k * 6) + s * 0.003, 0.004 * k, 0.003 * k] for k in np.linspace(0, 1, 6)])
    tube(part, worm, 0.0022, hexc(0xf0d8c8), seg=6)
    # Arm-like pectoral fins with "hands", and pelvic fins: it walks on these.
    for side in (-1, 1):
        step = 0.012 * s * side
        elbow = np.array([side * 0.05, 0.03, 0.005 + step])
        hand = np.array([side * 0.058, 0.002, 0.018 + step])
        tube(part, np.concatenate([np.linspace([side * 0.035, 0.045, -0.005], elbow, 3), np.linspace(elbow, hand, 3)[1:]]),
             0.006, tan, seg=8)
        blob(part, hand, [0.009, 0.002, 0.007], pale, seg=10, rings=5)
        pel = np.array([side * 0.02, 0.002, 0.03 - step])
        tube(part, np.linspace([side * 0.015, 0.02, 0.025], pel, 4), 0.003, tan, seg=6)
    # Dorsal spines behind the lure, and the tail.
    for k in range(3):
        tube(part, np.linspace([0, 0.093 - k * 0.004, 0.025 - k * 0.015], [0, 0.105 - k * 0.006, 0.02 - k * 0.016], 3), 0.0025, tan, seg=6)
    tail = np.array([[s * 0.01 * k * k, 0.045, -0.055 - 0.03 * k] for k in np.linspace(0, 1, 5)])
    tube(part, tail, np.linspace(0.012, 0.004, 5), tan, seg=10, ry=np.linspace(0.016, 0.014, 5))
    # Hair: a coat of fine spinules over the body.
    for _ in range(260):
        u, v = rng.uniform(0, 2 * math.pi), rng.uniform(0.15, 2.6)
        d = np.array([math.sin(v) * math.cos(u), math.cos(v), math.sin(v) * math.sin(u)])
        root = c + d * R
        if root[1] < 0.012:
            continue
        n = d / R
        n /= np.linalg.norm(n)
        h = rng.uniform(0.006, 0.014)
        curl = np.array([rng.uniform(-1, 1), 0, rng.uniform(-1, 1)]) * 0.003
        pts = np.array([root - n * 0.001 + n * h * k + curl * k * k for k in np.linspace(0, 1, 3)])
        tube(part, pts, np.linspace(0.0011, 0.0003, 3), lambda t, j, q: stripe if t < 0.4 else tan, seg=4, cap=False)
    return part


# ---------------------------------------------------------------- mimic octopus


def octopus(pose: str) -> Part:
    part = Part()
    brown, cream, dark = hexc(0x6b4a2e), hexc(0xeee2c8), hexc(0x2e1f14)
    s = side_of(pose)
    flat = pose == 'flatfish'
    lion = pose == 'lionfish'

    def bands(u, j, q):
        return cream if (u * 11) % 1 < 0.42 else brown

    # Head with raised eyes; the mantle sac behind, slightly raised.
    head = np.array([0, 0.03 if not flat else 0.018, 0.0])
    blob(part, head, [0.02, 0.016 if not flat else 0.01, 0.018], lambda d, q: cream if math.sin(q[0] * 400) > 0.6 else brown, seg=16, rings=10)
    blob(part, head + [0, 0.012 if not flat else 0.004, -0.032], [0.016, 0.014 if not flat else 0.007, 0.028],
         lambda d, q: cream if (q[2] * 160) % 2 < 0.7 else brown, seg=16, rings=10)
    for side in (-1, 1):
        e = head + [side * 0.012, 0.014 if not flat else 0.008, 0.004]
        blob(part, e, [0.005, 0.006, 0.005], cream, seg=10, rings=6)
        blob(part, e + [side * 0.002, 0.003, 0.001], [0.0025] * 3, dark, seg=8, rings=5)
    # Eight long arms.
    for k in range(8):
        a0 = (k + 0.5) / 8 * 2 * math.pi
        pts = []
        for i, u in enumerate(np.linspace(0, 1, 26)):
            length = 0.22 * u
            if flat:
                # Flatfish: all arms swept back together, close to the sand.
                a = math.pi + (a0 - math.pi) * 0.12
                y = 0.004
            elif lion:
                # Lionfish: arms raised and spread like fin spines.
                a = a0
                y = 0.02 + 0.12 * u ** 1.2
            else:
                a = a0 + s * 0.35 * math.sin(u * 3 + k)
                y = 0.012 * (1 - u) + 0.003 + 0.01 * math.sin(u * 4 + k) ** 2
            curl = 0.03 * u * u * math.sin(k * 1.7)
            pts.append(head + [math.sin(a) * length + curl * math.cos(a), y - head[1], math.cos(a) * length - curl * math.sin(a)])
        pts = np.array(pts)
        tube(part, pts, 0.0055 * (1 - np.linspace(0, 1, 26)) ** 0.9 + 0.0006, bands, seg=8)
    return part


SPECIES = [
    ('Harlequin_Shrimp', harlequin, 'Harlequin_Skin', 0.45, ()),
    ('Ghost_Pipefish', pipefish, 'Ghost_Pipefish_Skin', 0.5, ()),
    ('Hairy_Frogfish', frogfish, 'Hairy_Frogfish_Skin', 0.7, ()),
    ('Mimic_Octopus', octopus, 'Mimic_Octopus_Skin', 0.5, ('flatfish', 'lionfish')),
]


def welded(part: Part):
    """Weld duplicate points of the rest pose; returns arrays and the index map for other poses."""
    p, f, uv, c = (np.concatenate(part.p), np.concatenate(part.f), np.concatenate(part.uv),
                   np.concatenate(part.c))
    piece = np.concatenate([np.full(len(x), i) for i, x in enumerate(part.p)])
    key = np.concatenate([np.round(p / 1e-6), piece[:, None]], 1)
    _, first, remap = np.unique(key, axis=0, return_index=True, return_inverse=True)
    f = remap.ravel()[f]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    return p[first], f, uv[first], c[first], first


def build() -> None:
    import bpy  # noqa: PLC0415
    import bmesh  # noqa: PLC0415

    ca.reset_scene()
    root = ca.create_root('ReefMinis_Root', 'library')
    for i, (name, builder, material, rough, extra) in enumerate(SPECIES):
        rest = builder('rest')
        pos, faces, uvs, cols, first = welded(rest)
        obj = ca.mesh_from_arrays(name, pos, faces, uvs, cols, vertex_material(material, rough), root)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        obj.shape_key_add(name='Basis', from_mix=False)
        for key_name, pose in [('Stroke_Left', 'left'), ('Stroke_Right', 'right')] + [
            ('Mimic_' + e.capitalize(), e) for e in extra
        ]:
            moved = np.concatenate(builder(pose).p)[first]
            assert moved.shape == pos.shape, (name, pose)
            key = obj.shape_key_add(name=key_name, from_mix=False)
            key.value = 0.0  # the rest pose by default (Blender starts new keys at 1)
            bl = ca.to_blender(moved)
            for j, v in enumerate(key.data):
                v.co = bl[j]
        obj.location = ca.to_blender(np.array([i * 0.6, 0, 0]))
        print(f'{name}: {len(pos)} vertices, {len(faces)} triangles')
    bpy.context.view_layer.update()
    ca.save_blend(HERE / 'reef-minis.blend')
    # The standard export, without morph normals: the strokes and postures are small bends, and the
    # normals they would carry are a third of the file (the asset download budget is shared).
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_animations=False, export_morph_normal=False,
                              **ca.EXPORT_SETTINGS)
    print('wrote', OUT)


if __name__ == '__main__':
    build()
