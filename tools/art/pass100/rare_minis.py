"""V0.8 Pass 100: the aquarium's three rare miniature discoveries.

    python3 tools/art/pass100/rare_minis.py      (Blender 5.1 Python module)

Writes tools/art/pass100/rare-minis.blend (editable source) and
public/assets/models/creatures/rare-minis.glb, one library holding three named animals, each a
single mesh with its own natural material and two bend morphs (`Stroke_Left`/`Stroke_Right`)
that the wild animal, the album card and the aquarium miniature all drive the same way.

Game space throughout: metres, +Y up, head towards +Z, the foot/legs resting on y = 0, so the
runtime can seat an animal on a surface point and turn it along the surface. Sizes are the
aquarium's own scale (its fish are about 0.4 m long): small enough to be overlooked.

  Pikachu_Nudibranch  Thecacera pacifica: yellow foot and mantle, black-tipped rhinophores in
                      flared sheaths, a branched gill rosette, two black-tipped extra-branchial
                      papillae, oral tentacles and black/blue speckling.
  Leaf_Sheep          Costasiella kuroshimae: pale translucent body, rows of swollen green leaf
                      cerata with pale-blue tips, white-tipped banded rhinophores and two black
                      eyes close together on a white face.
  Candy_Crab          Hoplophrys oatesii: a small pink-and-white spider crab: triangular
                      carapace covered in white-tipped pink spines, eye stalks, two small
                      chelipeds and eight jointed walking legs.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'v07'))
import cozy_art as ca  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = ca.ROOT / 'public/assets/models/creatures/rare-minis.glb'
RNG = np.random.default_rng(100)


def hexc(c: int) -> np.ndarray:
    return np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], float) / 255


class Part:
    """Accumulates vertices, faces, uvs and sRGB colours for one animal."""

    def __init__(self) -> None:
        self.p: list[np.ndarray] = []
        self.f: list[np.ndarray] = []
        self.uv: list[np.ndarray] = []
        self.c: list[np.ndarray] = []
        self.n = 0

    def add(self, p, f, uv, c) -> None:
        self.p.append(np.asarray(p, float))
        self.f.append(np.asarray(f, int) + self.n)
        self.uv.append(np.asarray(uv, float))
        self.c.append(np.asarray(c, float))
        self.n += len(p)

    def arrays(self):
        """Welded (duplicate pole/seam points merged per piece) with degenerate triangles dropped."""
        p, f, uv, c = (np.concatenate(self.p), np.concatenate(self.f), np.concatenate(self.uv),
                       np.concatenate(self.c))
        piece = np.concatenate([np.full(len(x), i) for i, x in enumerate(self.p)])
        key = np.concatenate([np.round(p / 1e-6), piece[:, None]], 1)
        _, first, remap = np.unique(key, axis=0, return_index=True, return_inverse=True)
        remap = remap.ravel()
        f = remap[f]
        f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
        return p[first], f, uv[first], c[first]


def frames(path: np.ndarray):
    """Parallel-transport frames along a polyline."""
    t = np.gradient(path, axis=0)
    t /= np.linalg.norm(t, axis=1, keepdims=True)
    ref = np.array([0, 1, 0.0]) if abs(t[0][1]) < 0.9 else np.array([1, 0, 0.0])
    n = np.cross(t[0], ref)
    n /= np.linalg.norm(n)
    ns, bs = [], []
    for i in range(len(path)):
        if i:
            n = n - t[i] * np.dot(n, t[i])
            n /= np.linalg.norm(n)
        ns.append(n.copy())
        bs.append(np.cross(t[i], n))
    return np.array(ns), np.array(bs)


def tube(part: Part, path, radius, colour, *, seg=10, ry=None, cap=True) -> None:
    """A closed tube along `path` with per-point radius (and optional second radius) and colour.
    `colour(i, j, point)` returns an sRGB triple (or a fixed triple)."""
    path = np.asarray(path, float)
    m = len(path)
    rx = np.broadcast_to(np.asarray(radius, float), (m,))
    rr = rx if ry is None else np.broadcast_to(np.asarray(ry, float), (m,))
    ns, bs = frames(path)
    pts, uvs, cols = [], [], []
    for i in range(m):
        for j in range(seg):
            a = 2 * math.pi * j / seg
            q = path[i] + ns[i] * math.cos(a) * rx[i] + bs[i] * math.sin(a) * rr[i]
            pts.append(q)
            uvs.append((j / seg, i / (m - 1)))
            cols.append(colour(i / (m - 1), j / seg, q) if callable(colour) else colour)
    faces = []
    for i in range(m - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces += [(a, b, b + seg), (a, b + seg, a + seg)]
    if cap:
        for end, ring in ((path[0], 0), (path[-1], (m - 1) * seg)):
            k = len(pts)
            pts.append(end)
            uvs.append((0.5, 0 if ring == 0 else 1))
            cols.append(cols[ring])
            for j in range(seg):
                a, b = ring + j, ring + (j + 1) % seg
                faces.append((k, b, a) if ring == 0 else (k, a, b))
    part.add(pts, faces, uvs, cols)


def blob(part: Part, centre, radii, colour, *, seg=12, rings=8) -> None:
    centre, radii = np.asarray(centre, float), np.asarray(radii, float)
    pts, uvs, cols, faces = [], [], [], []
    for i in range(rings + 1):
        v = math.pi * i / rings
        for j in range(seg):
            u = 2 * math.pi * j / seg
            d = np.array([math.sin(v) * math.cos(u), math.cos(v), math.sin(v) * math.sin(u)])
            q = centre + d * radii
            pts.append(q)
            uvs.append((j / seg, i / rings))
            cols.append(colour(d, q) if callable(colour) else colour)
    for i in range(rings):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            faces += [(a, b + seg, b), (a, a + seg, b + seg)]
    part.add(pts, faces, uvs, cols)


def bend_keys(obj, positions: np.ndarray, length: float, amount: float, *, lift=None) -> None:
    """Stroke_Left/Right: a lateral wave along the body (and an optional per-vertex lift for legs)."""
    obj.shape_key_add(name='Basis', from_mix=False)
    z = positions[:, 2] / (length / 2)
    for name, side in (('Stroke_Left', 1), ('Stroke_Right', -1)):
        key = obj.shape_key_add(name=name, from_mix=False)
        moved = positions.copy()
        moved[:, 0] += side * amount * (np.sin(z * 1.6) * 0.6 + 0.4 * z * z * np.sign(-z))
        if lift is not None:
            moved[:, 1] += lift(positions, side)
        bl = ca.to_blender(moved)
        for i, v in enumerate(key.data):
            v.co = bl[i]


def vertex_material(name: str, roughness: float, *, sss: float = 0.0, alpha: float = 1.0):
    import bpy  # noqa: PLC0415

    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    p = nodes.get('Principled BSDF')
    vc = nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    links.new(vc.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = 0.0
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    return m


# ---------------------------------------------------------------- Pikachu nudibranch


def pikachu() -> Part:
    part = Part()
    L = 0.16
    yellow, deep, black, blue = hexc(0xf2c21c), hexc(0xe39a12), hexc(0x16130f), hexc(0x2f5f9e)
    spots = RNG.uniform(-1, 1, (55, 3))

    def skin(t, j, q):
        c = yellow * (0.92 + 0.08 * math.cos(j * 6.28)) + (deep - yellow) * max(0, 0.4 - q[1] / 0.05) * 0.4
        # Fine dark and blue speckling on the mantle, none on the sole.
        if q[1] > 0.012 and q[2] < 0.045:
            for s in spots:
                d = (q[0] / 0.022 - s[0]) ** 2 + (q[2] / 0.075 - s[2]) ** 2
                if d < 0.0012:
                    return blue if s[1] > 0.55 else black
        return np.clip(c, 0, 1)

    # The body: a broad sole and a domed mantle, rounded head, tapering tail.
    zs = np.linspace(-L / 2, L / 2, 40)
    t = (zs - zs[0]) / L
    width = 0.024 * np.sin(np.clip(t, 0.02, 0.985) ** 1.25 * math.pi) ** 0.55 + 0.002
    height = 0.020 * np.sin(np.clip(t, 0.02, 0.985) ** 1.2 * math.pi) ** 0.6 + 0.003
    path = np.stack([np.zeros_like(zs), height, zs], 1)
    tube(part, path, width, skin, seg=28, ry=height)
    # The foot's skirt: a slightly wider, flatter sole edge.
    tube(part, np.stack([np.zeros_like(zs), np.full_like(zs, 0.004), zs], 1), width * 1.12,
         deep, seg=14, ry=np.full_like(zs, 0.004))
    hi = int(len(zs) * 0.78)
    head, top = zs[hi], 2 * height[hi] - 0.004
    # Rhinophores: lamellate clubs with black tips, each in a flared, black-rimmed sheath.
    for side in (-1, 1):
        base = np.array([side * 0.009, top, head])
        sheath = np.array([base + [0, k * 0.010, 0] + [side * k * 0.002, 0, 0] for k in np.linspace(0, 1, 5)])
        tube(part, sheath, np.linspace(0.0045, 0.0075, 5),
             lambda u, j, q: black if u > 0.8 else yellow, seg=12)
        club = np.array([base + [side * 0.002 * k, 0.008 + 0.022 * k, -0.002 * k] for k in np.linspace(0, 1, 7)])
        tube(part, club, 0.0038 * (1 - 0.6 * np.linspace(0, 1, 7) ** 2) + 0.0008,
             lambda u, j, q: black if u > 0.62 else yellow * (0.9 + 0.1 * math.sin(u * 40)), seg=10)
    # Oral tentacles at the front of the head.
    for side in (-1, 1):
        ten = np.array([[side * (0.008 + 0.010 * k), 0.010 - 0.004 * k, L / 2 - 0.006 + 0.008 * k]
                        for k in np.linspace(0, 1, 5)])
        tube(part, ten, np.linspace(0.0032, 0.001, 5), yellow, seg=8)
    # Branched gill rosette (five plumes) mid-back.
    gz = -0.018
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.55
        stem = [np.array([0, 0.040, gz])]
        d = np.array([math.cos(a) * 0.6, 1.0, math.sin(a) * 0.4 - 0.3])
        d /= np.linalg.norm(d)
        for s in range(1, 6):
            stem.append(stem[0] + d * 0.0045 * s)
        stem = np.array(stem)
        tube(part, stem, np.linspace(0.0026, 0.0009, len(stem)),
             lambda u, j, q: yellow * (1.0 - 0.15 * u), seg=8)
        for b in (2, 3, 4):
            side = np.cross(d, [0, 0, 1])
            for sgn in (-1, 1):
                twig = np.array([stem[b] + (side * sgn * 0.6 + d * 0.5) * 0.004 * s for s in range(4)])
                tube(part, twig, np.linspace(0.0011, 0.0005, 4), yellow * 0.95, seg=6, cap=False)
    # The two extra-branchial papillae flanking the gills: yellow, tipped in black.
    for side in (-1, 1):
        pap = np.array([[side * (0.010 + 0.006 * k), 0.030 + 0.022 * k, gz - 0.012 - 0.004 * k]
                        for k in np.linspace(0, 1, 7)])
        tube(part, pap, np.linspace(0.0055, 0.0016, 7),
             lambda u, j, q: black if u > 0.7 else yellow, seg=10)
    return part


# ---------------------------------------------------------------- leaf sheep


def leaf_sheep() -> Part:
    part = Part()
    L = 0.09
    pale, green, lime, tip, white, black = (hexc(0xd8e3c4), hexc(0x3f8a2b), hexc(0x8fc552),
                                            hexc(0xb9dcef), hexc(0xf4f2ea), hexc(0x0d0d0d))
    zs = np.linspace(-L / 2, L / 2, 16)
    t = (zs - zs[0]) / L
    width = 0.010 * np.sin(np.clip(t, 0.03, 1) ** 0.6 * math.pi) ** 0.6 + 0.0015
    height = 0.009 * np.sin(np.clip(t, 0.03, 1) ** 0.7 * math.pi) ** 0.7 + 0.002
    tube(part, np.stack([np.zeros_like(zs), height, zs], 1), width, pale, seg=12, ry=height)
    # A white face with two black eyes set close together.
    blob(part, [0, 0.012, L / 2 - 0.006], [0.0085, 0.0075, 0.009], white)
    for side in (-1, 1):
        blob(part, [side * 0.0026, 0.0185, L / 2 - 0.004], [0.0016, 0.0016, 0.0016], black, seg=8, rings=5)
    # Rhinophores: long, white with a dark band and white tip.
    for side in (-1, 1):
        r = np.array([[side * (0.0035 + 0.006 * k), 0.016 + 0.020 * k, L / 2 - 0.007 + 0.006 * k]
                      for k in np.linspace(0, 1, 8)])
        tube(part, r, np.linspace(0.0018, 0.0010, 8),
             lambda u, j, q: black if 0.55 < u < 0.75 else white, seg=8)
    # Leaf cerata: rows of swollen paddles over the back, greener in the middle, pale-blue tips.
    rows = np.linspace(-L / 2 + 0.010, L / 2 - 0.018, 7)
    for i, z in enumerate(rows):
        for side in (-1, 1):
            for k, spread in enumerate((0.35, 0.85, 1.35)):
                if i in (0, 6) and k == 2:
                    continue
                a = side * spread
                length = 0.014 + 0.006 * math.sin(i / 6 * math.pi) - 0.002 * k
                root = np.array([side * 0.004, 0.008 + 0.005 * math.cos(spread), z])
                d = np.array([math.sin(a), math.cos(a) * 1.1 + 0.2, -0.25])
                d /= np.linalg.norm(d)
                pts = np.array([root + d * length * s for s in np.linspace(0, 1, 7)])
                prof = np.sin(np.linspace(0.15, 1, 7) * math.pi * 0.95) * 0.0042 + 0.0008
                flat = prof * 0.55
                shade = RNG.uniform(0.85, 1.05)

                def col(u, j, q, shade=shade):
                    base = green + (lime - green) * (0.5 + 0.5 * math.cos(j * 6.28)) * 0.5
                    return np.clip(tip if u > 0.82 else base * shade, 0, 1)

                tube(part, pts, prof, col, seg=8, ry=flat)
    return part


# ---------------------------------------------------------------- candy crab


def candy_crab() -> Part:
    part = Part()
    pink, rose, white = hexc(0xf0a3b8), hexc(0xd9667f), hexc(0xfbeef0)

    def shell(d, q):
        return np.clip(pink * (0.9 + 0.12 * d[1]) + (rose - pink) * max(0, -d[1]) * 0.6, 0, 1)

    # Carapace: pear-shaped, narrow rostrum forward (+Z), sitting above the legs.
    cy = 0.020
    blob(part, [0, cy, -0.002], [0.019, 0.012, 0.024], shell, seg=16, rings=10)
    blob(part, [0, cy + 0.002, 0.020], [0.009, 0.007, 0.012], shell, seg=12, rings=8)
    # Spines and tubercles: pink with white tips, covering the back (its coral-polyp camouflage).
    for _ in range(80):
        u, v = RNG.uniform(0, 2 * math.pi), RNG.uniform(0.15, 1.2)
        d = np.array([math.sin(v) * math.cos(u), math.cos(v), math.sin(v) * math.sin(u)])
        root = np.array([0, cy, -0.002]) + d * [0.019, 0.012, 0.024]
        if root[1] < cy - 0.002:
            continue
        n = d / [0.019, 0.012, 0.024]
        n /= np.linalg.norm(n)
        h = RNG.uniform(0.004, 0.009)
        tube(part, np.array([root - n * 0.002 + n * (h + 0.002) * s for s in np.linspace(0, 1, 4)]),
             np.linspace(0.0018, 0.0006, 4), lambda t, j, q: white if t > 0.6 else pink, seg=6)
    # Rostral horns and eye stalks.
    for side in (-1, 1):
        tube(part, np.array([[side * 0.002 * (1 + 2 * k), cy + 0.004 + 0.004 * k, 0.030 + 0.008 * k]
                             for k in np.linspace(0, 1, 4)]),
             np.linspace(0.0018, 0.0006, 4), lambda t, j, q: white if t > 0.7 else rose, seg=6)
        tube(part, np.array([[side * (0.006 + 0.004 * k), cy + 0.004 + 0.003 * k, 0.024 + 0.003 * k]
                             for k in np.linspace(0, 1, 3)]),
             0.0014, rose, seg=6)
        blob(part, [side * 0.0105, cy + 0.0075, 0.0275], [0.0018] * 3, hexc(0x2a1a1f), seg=8, rings=5)
    # Chelipeds: short, slender, held forward.
    for side in (-1, 1):
        arm = np.array([[side * (0.012 + 0.010 * k), cy - 0.006 + 0.002 * math.sin(k * 3), 0.014 + 0.016 * k]
                        for k in np.linspace(0, 1, 6)])
        tube(part, arm, np.linspace(0.0026, 0.0018, 6), pink, seg=8)
        blob(part, arm[-1] + [side * 0.001, 0, 0.004], [0.0026, 0.002, 0.005], white, seg=8, rings=5)
    # Eight walking legs: three segments, down to tips touching y = 0.
    for side in (-1, 1):
        for k, z in enumerate((0.010, 0.0, -0.010, -0.019)):
            a = (0.5 - k * 0.33) * side
            out = np.array([side * math.cos(a * side * 0.6) , 0, math.sin(a) * 0.6])
            out /= np.linalg.norm(out)
            hip = np.array([side * 0.016, cy - 0.006, z])
            knee = hip + out * 0.013 + [0, 0.006, 0]
            ankle = knee + out * 0.010 + [0, -0.012, 0]
            toe = ankle + out * 0.006 + [0, -ankle[1], 0]
            pts = np.concatenate([np.linspace(hip, knee, 4), np.linspace(knee, ankle, 4)[1:],
                                  np.linspace(ankle, toe, 3)[1:]])
            tube(part, pts, np.linspace(0.0030, 0.0012, len(pts)),
                 lambda t, j, q: white if (t * 3) % 1 > 0.82 else pink, seg=7)
    return part


def build() -> None:
    import bpy  # noqa: PLC0415

    ca.reset_scene()
    root = ca.create_root('RareMinis_Root', 'library')
    specs = [
        ('Pikachu_Nudibranch', pikachu(), vertex_material('Pikachu_Skin', 0.45), 0.16, 0.010, None),
        ('Leaf_Sheep', leaf_sheep(), vertex_material('Leaf_Sheep_Skin', 0.5), 0.09, 0.004, None),
        ('Candy_Crab', candy_crab(), vertex_material('Candy_Crab_Shell', 0.6), 0.06, 0.0015,
         # Walking legs step: alternate legs lift a little as the body sways.
         lambda p, side: np.where((np.abs(p[:, 0]) > 0.02) & (p[:, 1] < 0.03),
                                  0.004 * ((p[:, 0] * side > 0) ^ (p[:, 2] > 0)), 0.0)),
    ]
    for i, (name, part, material, length, amount, lift) in enumerate(specs):
        pos, faces, uvs, cols = part.arrays()
        obj = ca.mesh_from_arrays(name, pos, faces, uvs, cols, material, root)
        # Every face outward, so smooth shading never darkens a pole or a cap.
        import bmesh  # noqa: PLC0415
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()
        bend_keys(obj, pos, length, amount, lift=lift)
        obj.location = ca.to_blender(np.array([i * 0.3, 0, 0]))
        print(f'{name}: {len(pos)} vertices, {len(faces)} triangles')
    bpy.context.view_layer.update()
    ca.save_blend(HERE / 'rare-minis.blend')
    ca.export_glb(OUT)
    print('wrote', OUT)


if __name__ == '__main__':
    build()
