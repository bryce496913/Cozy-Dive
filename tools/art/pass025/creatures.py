"""Pass 025: author the outer reef's big creatures from scratch.

    python3 tools/art/pass025/creatures.py [shark|ray|turtle]   # Blender 5.1 Python module
    node tools/art/pass017/compress.mjs                         # then compress (Draco + KTX2)

A blacktip reef shark, a spotted eagle ray and a green sea turtle, each built procedurally in game
space (+X forward, +Y up) as one `<Name>_Root` holding:

  * `Body`: the whole animal (fins, eyes and all) as one mesh with one material, so each creature
    costs one draw call. Its `Stroke_Left` / `Stroke_Right` morph targets are the two extremes of
    its swimming stroke, which the runtime blends: the shark's body bends side to side; the eagle
    ray's wings beat up and down; the turtle's front flippers sweep down-and-back and
    up-and-forward;
  * `Body_LOD1`: a collapse-decimated copy for distance, its morphs transferred from the nearest
    full-detail vertex (as Pass 017's fish).

Bodies are lofted from cross-sections; fins and flippers are smoothed outlines, filled, subdivided
and given thickness that tapers to their edges. Base colour and normal maps are painted in numpy
(sources kept under tools/art/textures/pass025, named as the images so compress.mjs re-encodes
them to KTX2). Each creature's map is an atlas: body, fin strips and a small dark block for eyes.
"""
import sys
from pathlib import Path

import bpy  # noqa: I001 - bpy must load before bmesh
import bmesh
import numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TEX = ROOT / 'tools/art/textures/pass025'
OUT = ROOT / 'public/assets/models/creatures'
SIZE = 512  # the project's texture size for every authored library
LOD_RATIO = 0.16


# ------------------------------------------------------------------ small maths


def smooth(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def to_blender(p):
    p = np.asarray(p, float)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def catmull(points, samples):
    """Resample a closed control polygon (K, 2) with a Catmull-Rom spline through its points."""
    pts = np.asarray(points, float)
    n = len(pts)
    per = max(2, samples // n)
    out = []
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        for k in range(per):
            t = k / per
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.asarray(out)


def noise2(u, v, freq, seed):
    """Smooth value noise, periodic over u, v in [0, 1)."""
    g = np.random.default_rng(seed).random((freq, freq))
    x, y = np.mod(u, 1) * freq, np.mod(v, 1) * freq
    i, j = np.floor(x).astype(int) % freq, np.floor(y).astype(int) % freq
    i1, j1 = (i + 1) % freq, (j + 1) % freq
    fx, fy = x - np.floor(x), y - np.floor(y)
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = g[i, j], g[i1, j], g[i, j1], g[i1, j1]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy


def fbm(u, v, base, seed, octaves=4):
    total, amp, s = 0.0, 0.5, 0.0
    for o in range(octaves):
        s = s + amp * noise2(u, v, base * 2 ** o, seed + o)
        total += amp
        amp *= 0.5
    return s / total


def grid():
    """Texel centres as Blender UVs (rows run top-down in the image, v runs bottom-up)."""
    c = (np.arange(SIZE) + 0.5) / SIZE
    return np.meshgrid(c, 1 - c)


def lerp(a, b, t):
    a, b = np.asarray(a, float), np.asarray(b, float)
    return a + (b - a) * np.asarray(t, float)[..., None]


# ------------------------------------------------------------------ geometry parts


def part(v, f, uv, keys=None):
    """A piece of a creature: game-space vertices, faces, per-corner UVs, morph displacements."""
    return {'v': np.asarray(v, float), 'f': [list(map(int, x)) for x in f], 'uv': uv, 'keys': keys or {}}


def merge(parts):
    names = sorted({n for p in parts for n in p['keys']})
    verts, faces, uvs, keys, offset = [], [], [], {n: [] for n in names}, 0
    for p in parts:
        verts.append(p['v'])
        faces += [[i + offset for i in face] for face in p['f']]
        uvs += p['uv']
        for n in names:
            keys[n].append(p['keys'].get(n, np.zeros_like(p['v'])))
        offset += len(p['v'])
    return part(np.concatenate(verts), faces, uvs, {n: np.concatenate(k) for n, k in keys.items()})


def loft(stations, front_tip, back_tip):
    """Closed surface through rings (each (M, 3)), capped by a point at either end.
    Returns vertices, faces, and each vertex's station (tips: -0.5 and n - 0.5) and ring index."""
    m, n = len(stations[0]), len(stations)
    verts = np.concatenate([[front_tip], np.concatenate(stations, 0), [back_tip]], 0)
    idx = lambda i, j: 1 + i * m + (j % m)  # noqa: E731
    last = len(verts) - 1
    faces = [[0, idx(0, j + 1), idx(0, j)] for j in range(m)]
    for i in range(n - 1):
        faces += [[idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)] for j in range(m)]
    faces += [[idx(n - 1, j), idx(n - 1, j + 1), last] for j in range(m)]
    station = np.concatenate([[-0.5], np.repeat(np.arange(n), m), [n - 0.5]])
    ring = np.concatenate([[0], np.tile(np.arange(m), n), [0]])
    return verts, faces, station, ring


def loft_uv(faces, station, ring, m, uv_of):
    """Per-corner UVs for a loft from uv_of(station, ring fraction); faces across the seam wrap."""
    out = []
    for f in faces:
        js = ring[f]
        wrap = js.max() - js.min() > m // 2
        out.append([uv_of(station[i], (ring[i] + (m if wrap and ring[i] < m // 2 else 0)) / m) for i in f])
    return out


def fin(outline, frame, thickness, cuts=1):
    """A fin or flipper: a smoothed outline in its plane, filled, subdivided and given thickness
    that tapers to its edges. frame = (origin, a_axis, b_axis), game space. Returns vertices,
    faces and each vertex's plane coordinates (a, b)."""
    o, ax, bx = (np.asarray(x, float) for x in frame)
    nrm = unit(np.cross(ax, bx))
    pts = catmull(outline, 72)
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((p[0], p[1], 0)) for p in pts])
    bmesh.ops.triangulate(bm, faces=[face])
    bmesh.ops.beautify_fill(bm, faces=bm.faces[:], edges=bm.edges[:])
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.index_update()
    flat = np.array([v.co[:2] for v in bm.verts])
    tris = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    inset, _ = cKDTree(pts).query(flat)
    half = 0.5 * thickness * np.maximum(0.12, np.sqrt(smooth(0, 0.6 * inset.max(), inset)))
    n = len(flat)
    base = o + flat[:, :1] * ax + flat[:, 1:2] * bx
    verts = np.concatenate([base + half[:, None] * nrm, base - half[:, None] * nrm], 0)
    faces = [list(t) for t in tris] + [[a + n, c + n, b + n] for a, b, c in tris]
    count = {}
    for t in tris:
        for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            k = tuple(sorted(e))
            count[k] = count.get(k, 0) + 1
    for t in tris:
        for x, y in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if count[tuple(sorted((x, y)))] == 1:
                faces.append([y, x, x + n, y + n])
    return verts, faces, np.concatenate([flat, flat], 0)


def sphere(centre, radius, segments=12, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bm.verts.index_update()
    v = np.array([x.co[:] for x in bm.verts])
    f = [[x.index for x in face.verts] for face in bm.faces]
    bm.free()
    return np.asarray(centre, float) + v, f


def same_uv(faces, uv):
    return [[uv] * len(f) for f in faces]


def rotation(axis, angle):
    x, y, z = unit(axis)
    c, s, t = np.cos(angle), np.sin(angle), 1 - np.cos(angle)
    return np.array([[t * x * x + c, t * x * y - s * z, t * x * z + s * y],
                     [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
                     [t * x * z - s * y, t * y * z + s * x, t * z * z + c]])


# ------------------------------------------------------------------ Blender objects


def mesh_object(name, p, parent):
    me = bpy.data.meshes.new(name)
    me.from_pydata(to_blender(p['v']).tolist(), [], p['f'])
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv', np.asarray([c for f in p['uv'] for c in f], float).ravel())
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    if p['keys']:
        obj.shape_key_add(name='Basis', from_mix=False)
        base = to_blender(p['v'])
        for key, d in p['keys'].items():
            kb = obj.shape_key_add(name=key, from_mix=False)
            kb.data.foreach_set('co', (base + to_blender(d)).ravel())
    return obj


def save_png(name, rgb):
    TEX.mkdir(parents=True, exist_ok=True)
    path = TEX / f'{name}.png'
    Image.fromarray(np.uint8(np.clip(rgb, 0, 1) * 255 + 0.5)).save(path, optimize=True)
    return path


def save_roughness(name, rough):
    """glTF metallic-roughness map (G roughness, B metalness 0)."""
    return save_png(name, np.dstack([np.ones_like(rough), rough, np.zeros_like(rough)]))


def normal_map(height, strength):
    """Tangent-space normals from a height field (green follows +v, which runs up the image)."""
    gy, gx = np.gradient(height)
    n = np.dstack([-gx * strength, gy * strength, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def blender_image(path, non_color=False):
    img = bpy.data.images.load(str(path))
    img.name = path.stem
    img.pack()
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def material(name, base, normal, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    orm = nt.nodes.new('ShaderNodeTexImage')
    orm.image = blender_image(rough, non_color=True)
    split = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(orm.outputs['Color'], split.inputs['Color'])
    nt.links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = blender_image(base)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    ntex = nt.nodes.new('ShaderNodeTexImage')
    ntex.image = blender_image(normal, non_color=True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(ntex.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def co(data):
    a = np.empty(len(data) * 3)
    data.foreach_get('co', a)
    return a.reshape(-1, 3)


def distance_level(obj):
    """Collapse-decimated copy with morphs transferred from the nearest full-detail vertex."""
    src = obj.data
    basis = co(src.vertices)
    keys = {kb.name: co(kb.data) for kb in src.shape_keys.key_blocks if kb.name != 'Basis'}
    dup = obj.copy()
    dup.data = src.copy()
    dup.name = dup.data.name = f'{obj.name}_LOD1'
    bpy.context.collection.objects.link(dup)
    dup.shape_key_clear()
    mod = dup.modifiers.new('Distance level', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = LOD_RATIO
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.modifier_apply(modifier=mod.name)
    low = co(dup.data.vertices)
    _, nearest = cKDTree(basis).query(low)
    dup.shape_key_add(name='Basis', from_mix=False)
    for name, key in keys.items():
        kb = dup.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set('co', (low + (key[nearest] - basis[nearest])).ravel())
    return dup


# ------------------------------------------------------------------ blacktip reef shark
# 3.0 m long. Atlas: u < 0.94 is the body (u along it, v around it: belly at v = 0 and 1, back at
# 0.5); u 0.94-0.97 dorsal-coloured fins and u 0.97-1 pale fins, whose v runs from base to tip
# (black tips); v < 0.08 there is the eyes' black.

SHARK = {'length': 3.0, 'nose': 1.5, 'peduncle': -0.9}
FIN_DARK, FIN_PALE, EYE_V = 0.955, 0.985, 0.04


def shark_profile():
    s = [0, 0.02, 0.06, 0.12, 0.22, 0.35, 0.5, 0.65, 0.8, 0.92, 1]
    L = SHARK['length']
    h = PchipInterpolator(s, L * np.array([0, .018, .034, .05, .068, .08, .076, .06, .042, .03, .024]))
    w = PchipInterpolator(s, L * np.array([0, .026, .044, .056, .064, .066, .06, .046, .03, .022, .019]))
    yc = PchipInterpolator([0, 0.1, 0.4, 0.7, 1], L * np.array([-.012, -.002, .004, .002, .006]))
    x = lambda t: SHARK['nose'] - t * (SHARK['nose'] - SHARK['peduncle'])  # noqa: E731
    return h, w, yc, x


def shark_fin(outline, origin, a, b, thickness, strip, tip):
    a = unit(a)
    b = unit(np.asarray(b, float) - np.dot(b, a) * a)
    v, f, plane = fin(outline, (origin, a, b), thickness)
    t = np.clip(tip(plane[:, 0], plane[:, 1]), 0, 1)
    uv = [[(strip, 0.1 + 0.85 * t[i]) for i in face] for face in f]
    return part(v, f, uv)


def shark():
    h, w, yc, x = shark_profile()
    m, n = 32, 56
    s = np.linspace(0, 1, n + 2)[1:-1] ** 1.2
    th = 2 * np.pi * np.arange(m) / m
    c, sn = np.cos(th), np.sin(th)
    rings = [np.stack([np.full(m, x(t)), yc(t) - h(t) * c * np.where(c > 0, 0.8, 1.0), w(t) * sn], 1) for t in s]
    verts, faces, station, ring = loft(rings, [SHARK['nose'], yc(0), 0], [SHARK['peduncle'] - 0.07, yc(1), 0])
    su = np.concatenate([[0], s, [1]])
    body = part(verts, faces, loft_uv(faces, station, ring, m,
                                      lambda i, j: (0.94 * np.interp(i + 1, np.arange(n + 2), su), j)))
    top = lambda t: yc(t) + h(t)  # noqa: E731
    bottom = lambda t: yc(t) - 0.8 * h(t)  # noqa: E731
    back, up, down = [-1, 0, 0], [0, 1, 0], [0, -1, 0]
    parts = [body]
    # First dorsal: tall, swept, its tip black.
    parts.append(shark_fin([(-0.02, -0.09), (0.0, 0.02), (0.07, 0.17), (0.16, 0.30), (0.22, 0.345), (0.245, 0.30),
                            (0.25, 0.17), (0.29, 0.08), (0.37, 0.035), (0.32, -0.01), (0.3, -0.09)],
                           [x(0.29), top(0.29), 0], back, up, 0.034, FIN_DARK,
                           lambda a, b: smooth(0.2, 0.3, b)))
    # Second dorsal and anal fins: small.
    small = [(-0.01, -0.05), (0.0, 0.01), (0.04, 0.07), (0.07, 0.09), (0.09, 0.06), (0.11, 0.025), (0.17, 0.012),
             (0.13, -0.01), (0.12, -0.05)]
    parts.append(shark_fin(small, [x(0.69), top(0.69), 0], back, up, 0.018, FIN_DARK,
                           lambda a, b: 0.6 * smooth(0.05, 0.09, b)))
    parts.append(shark_fin(small, [x(0.71), bottom(0.71), 0], back, down, 0.018, FIN_PALE, lambda a, b: 0 * a))
    for side in (1, -1):
        # Pectorals: long, swept back and down, black-tipped.
        parts.append(shark_fin([(-0.03, -0.05), (0.0, 0.02), (0.06, 0.18), (0.16, 0.38), (0.26, 0.52),
                                (0.305, 0.535), (0.295, 0.44), (0.245, 0.3), (0.225, 0.15), (0.26, 0.04),
                                (0.2, -0.05)],
                               [x(0.24), yc(0.24) - 0.45 * h(0.24), side * 0.8 * w(0.24)],
                               [-1, -0.1, 0], [0, -0.42, side], 0.034, FIN_DARK,
                               lambda a, b: smooth(0.38, 0.5, b)))
        # Pelvics: small, under the belly.
        parts.append(shark_fin([(-0.02, -0.03), (0.0, 0.03), (0.06, 0.09), (0.11, 0.12), (0.135, 0.08),
                                (0.17, 0.03), (0.12, -0.03)],
                               [x(0.56), yc(0.56) - 0.62 * h(0.56), side * 0.45 * w(0.56)],
                               [-1, -0.15, 0], [0, -0.6, side], 0.018, FIN_PALE, lambda a, b: 0 * a))
        ev, ef = sphere([x(0.095), yc(0.095) + 0.25 * h(0.095), side * 0.86 * w(0.095)], 0.02)
        parts.append(part(ev, ef, same_uv(ef, (FIN_DARK, EYE_V))))
    # Caudal: heterocercal, the upper lobe long, the lower lobe's tip black.
    parts.append(shark_fin([(-0.1, 0.075), (0.06, 0.1), (0.22, 0.25), (0.4, 0.44), (0.56, 0.6), (0.555, 0.52),
                            (0.43, 0.34), (0.37, 0.17), (0.34, 0.04), (0.39, -0.08), (0.45, -0.22), (0.455, -0.28),
                            (0.38, -0.245), (0.24, -0.15), (0.08, -0.07), (-0.1, -0.06)],
                           [SHARK['peduncle'] + 0.03, yc(1), 0], back, up, 0.03, FIN_DARK,
                           lambda a, b: np.maximum(smooth(-0.1, -0.22, b), 0.55 * smooth(0.42, 0.56, a))))
    shape = merge(parts)
    # The stroke bends the body side to side, most towards the tail; the head counters slightly.
    q = (SHARK['nose'] - shape['v'][:, 0]) / SHARK['length']
    bend = 0.3 * smooth(0.28, 1.0, q) ** 1.5 - 0.025 * (1 - smooth(0.0, 0.3, q))
    d = np.zeros_like(shape['v'])
    d[:, 2] = bend
    shape['keys'] = {'Stroke_Left': d, 'Stroke_Right': -d}
    return shape


def shark_maps():
    u, v = grid()
    s = u / 0.94
    e = -np.cos(2 * np.pi * v)  # -1 along the belly, +1 along the back
    ang = np.minimum(v, 1 - v) * 2 * np.pi  # 0 under the belly's midline, pi on the back
    nz = fbm(u, v, 8, 11)
    band = smooth(0.42, 0.52, s) * (1 - smooth(0.62, 0.8, s))
    edge = -0.14 + 0.36 * band + 0.08 * (nz - 0.5)
    back = lerp([0.5, 0.49, 0.44], [0.4, 0.39, 0.36], smooth(0.3, 1.0, e))
    col = lerp([0.93, 0.93, 0.9], back, smooth(edge - 0.05, edge + 0.05, e))
    col *= (0.93 + 0.07 * fbm(u * 2, v, 12, 12))[..., None]
    gills = np.zeros_like(u)
    for g in (0.15, 0.164, 0.178, 0.192, 0.206):
        gills = np.maximum(gills, 1 - smooth(0.002, 0.0045, np.abs(s - g + 0.01 * (e + 0.3))))
    gills *= smooth(-0.5, -0.32, e) * (1 - smooth(0.05, 0.2, e))
    mouth = (1 - smooth(0.003, 0.007, np.abs(s - (0.068 + 0.035 * (ang / 0.9) ** 2)))) * (1 - smooth(0.75, 0.9, ang))
    col *= (1 - 0.38 * np.maximum(gills, mouth))[..., None]
    tip = np.clip((v - 0.1) / 0.85, 0, 1)
    black = [0.06, 0.06, 0.065]
    dark = lerp([0.44, 0.43, 0.39], black, smooth(0.45, 0.8, tip))
    pale = lerp([0.7, 0.7, 0.67], black, smooth(0.45, 0.8, tip))
    col = np.where((u >= 0.94)[..., None], np.where((u < 0.97)[..., None], dark, pale), col)
    col = np.where(((u >= 0.94) & (v < 0.08))[..., None], [0.02, 0.02, 0.025], col)
    # Fins and eyes are smooth (their strips only carry colour).
    height = (0.5 * fbm(u * 2, v, 16, 13, 3) - 2.5 * np.maximum(gills, mouth)) * (u < 0.94)
    rough = np.where((u >= 0.94) & (v < 0.08), 0.12, 0.5)
    return (save_png('creature_shark_base', col), save_png('creature_shark_normal', normal_map(height, 1.5)),
            save_roughness('creature_shark_orm', rough))


# ------------------------------------------------------------------ spotted eagle ray
# 3.0 m across. Atlas: u < 0.5 is the top seen from above, u >= 0.5 the underside (x along u,
# z along v); texels outside the disc are dark (the tail, eyes and fin use them).

RAY = {'half_span': 1.5, 'x0': -0.72, 'dx': 1.72}
DARK_UV = (0.5 * 0.02 / RAY['dx'], 0.03)


def ray_edges(z):
    a = np.clip(np.abs(z) / RAY['half_span'], 0, 1)
    lead = 0.5 - 0.85 * a ** 1.4
    head = np.where(np.abs(z) < 0.17, 0.62 + 0.3 * np.sqrt(np.clip(1 - (z / 0.17) ** 2, 0, 1)), -9)
    k = 0.03
    front = k * np.logaddexp(lead / k, head / k)
    back = -0.6 + 0.45 * a ** 0.7 - 0.2 * a ** 4
    return front, back


def ray_uv(p, top):
    u = 0.5 * (p[0] - RAY['x0']) / RAY['dx']
    return (u if top else 0.5 + u, (p[2] + RAY['half_span']) / (2 * RAY['half_span']))


def ray():
    R = RAY['half_span']
    m, n = 28, 64
    z = -R * np.cos(np.pi * np.arange(1, n + 1) / (n + 1))
    phi = 2 * np.pi * np.arange(m) / m
    rings = []
    for zi in z:
        a = abs(zi) / R
        front, back = ray_edges(zi)
        mid, half = 0.5 * (front + back), 0.5 * (front - back)
        cam = 0.04 * a * a
        thick = 0.018 * (1 - a) ** 0.6 + 0.1 * np.exp(-(zi / 0.26) ** 2)
        rings.append(np.stack([mid + half * np.cos(phi), cam + thick * np.sin(phi) * (0.62 + 0.38 * np.cos(phi)),
                               np.full(m, zi)], 1))
    tip = float(ray_edges(R)[0])
    verts, faces, _, ring = loft(rings, [tip, 0.04, -R], [tip, 0.04, R])
    side = np.sin(phi)[ring]
    side[0] = side[-1] = 0
    uv = [[ray_uv(verts[i], side[f].sum() >= 0) for i in f] for f in faces]
    parts = [part(verts, faces, uv)]
    # Whip tail, its little dorsal fin and the eyes use the dark texels.
    t = np.linspace(0, 1, 34)[1:-1]
    k = 8
    psi = 2 * np.pi * np.arange(k) / k
    rad = 0.04 * (1 - t) ** 1.3 + 0.004
    tail = [np.stack([np.full(k, -0.5 - 2.9 * ti), ri * np.sin(psi), ri * np.cos(psi)], 1) for ti, ri in zip(t, rad)]
    tv, tf, _, _ = loft(tail, [-0.48, 0, 0], [-3.42, 0, 0])
    parts.append(part(tv, tf, same_uv(tf, DARK_UV)))
    fv, ff, _ = fin([(-0.02, -0.04), (0.0, 0.02), (0.04, 0.07), (0.08, 0.085), (0.1, 0.04), (0.14, 0.0),
                     (0.1, -0.04)], ([-0.6, 0.03, 0], [-1, 0, 0], [0, 1, 0]), 0.014)
    parts.append(part(fv, ff, same_uv(ff, DARK_UV)))
    for s in (1, -1):
        ev, ef = sphere([0.7, 0.055, s * 0.145], 0.026)
        parts.append(part(ev, ef, same_uv(ef, DARK_UV)))
    shape = merge(parts)
    # Wing beat: up for Stroke_Left, down for Stroke_Right; the body and tail stay put.
    zz = shape['v'][:, 2]
    f = smooth(0.18, 1.0, np.abs(zz) / R) ** 1.4
    upk, downk = np.zeros_like(shape['v']), np.zeros_like(shape['v'])
    upk[:, 1], upk[:, 2] = 0.55 * f, -np.sign(zz) * 0.15 * f * f
    downk[:, 1], downk[:, 2] = -0.5 * f, -np.sign(zz) * 0.12 * f * f
    shape['keys'] = {'Stroke_Left': upk, 'Stroke_Right': downk}
    return shape


def ray_maps():
    R = RAY['half_span']
    u, v = grid()
    top = u < 0.5
    x = RAY['x0'] + (np.where(top, u, u - 0.5) / 0.5) * RAY['dx']
    z = -R + v * 2 * R
    front, back = ray_edges(z)
    inside = (x <= front) & (x >= back) & (np.abs(z) < R)
    margin = np.minimum(front - x, x - back)
    rng = np.random.default_rng(2507)
    spots, radii = [], []
    for _ in range(9000):
        sx, sz = rng.uniform(-0.65, 0.95), rng.uniform(-R, R)
        f, b = ray_edges(sz)
        r = rng.uniform(0.018, 0.034) * (1 + 0.5 * abs(sz) / R)
        if not (b + 0.03 < sx < f - 0.03):
            continue
        if spots and cKDTree(spots).query([sx, sz])[0] < 2.6 * r + 0.035:
            continue
        spots.append((sx, sz))
        radii.append(r)
        if len(spots) >= 260:
            break
    d, i = cKDTree(spots).query(np.stack([x.ravel(), z.ravel()], 1))
    d, r = d.reshape(x.shape), np.asarray(radii)[i].reshape(x.shape)
    spot = 1 - smooth(0.75 * r, r, d)
    nz = fbm(u, v, 16, 21)
    navy = lerp([0.05, 0.07, 0.11], [0.09, 0.12, 0.17], nz)
    upper = lerp(navy, [0.86, 0.88, 0.88], spot)
    lower = lerp([0.9, 0.91, 0.9], [0.42, 0.45, 0.5], 0.7 * (1 - smooth(0.0, 0.07, margin)))
    col = np.where(top[..., None], upper, lower)
    col = np.where(inside[..., None], col, [0.035, 0.04, 0.05])
    height = 0.4 * fbm(u, v, 24, 22, 3) + 0.6 * spot * top
    rough = np.where(inside, np.where(top, 0.42, 0.5), 0.2)
    return (save_png('creature_ray_base', col), save_png('creature_ray_normal', normal_map(height, 1.0)),
            save_roughness('creature_ray_orm', rough))


# ------------------------------------------------------------------ green sea turtle
# 1.4 m long (shell 1.0 m). Atlas: u < 0.5 is the carapace seen from above (z along u, x along v);
# u >= 0.5, v >= 0.5 the plastron from below; u >= 0.5, v < 0.5 scaly skin; the corner u, v < 0.03
# (outside the shell) is the eyes' black.

TURTLE = {'zr': 0.42, 'x0': -0.52, 'dx': 1.04}


def shell_size(t):
    t = np.clip(t, -1, 1)
    w = 0.4 * np.where(t >= 0, np.sqrt(1 - t * t), (1 - t * t) ** 0.7) * (1 + 0.1 * t)
    return w, 0.2 * (1 - t * t) ** 0.55 * (1 + 0.08 * t), 0.07 * np.sqrt(1 - t * t)


def turtle_flipper(outline, hinge, a, b, thickness, swing):
    a = unit(a)
    b = unit(np.asarray(b, float) - np.dot(b, a) * a)
    hinge = np.asarray(hinge, float)
    v, f, plane = fin(outline, (hinge, a, b), thickness)
    uv = [[(0.5 + 0.47 * np.clip((plane[i, 0] + 0.06) / 0.7, 0, 1),
            0.03 + 0.44 * np.clip((plane[i, 1] + 0.12) / 0.24, 0, 1)) for i in face] for face in f]
    keys = {}
    if swing:
        weight = smooth(0.0, 0.3, plane[:, 0])
        for name, (down, sweep) in swing.items():
            d = np.zeros_like(v)
            for k in range(len(v)):
                rot = rotation([0, 1, 0], sweep * weight[k]) @ rotation([1, 0, 0], down * weight[k])
                d[k] = rot @ (v[k] - hinge) + hinge - v[k]
            keys[name] = d
    return part(v, f, uv, keys)


def turtle():
    m, n = 48, 40
    t = np.linspace(-1, 1, n + 2)[1:-1]
    phi = 2 * np.pi * np.arange(m) / m
    c, sn = np.cos(phi), np.sin(phi)
    rings = []
    for ti in t:
        w, ht, hb = shell_size(ti)
        y = np.where(sn >= 0, ht * sn * sn * (1 + 0.35 * c * c), -hb * sn * sn)
        rings.append(np.stack([np.full(m, -0.01 + 0.49 * ti), y, w * c], 1))
    verts, faces, _, ring = loft(rings, [-0.5, 0, 0], [0.48, 0, 0])
    side = np.where(sn[ring] >= 0, 1.0, -1.0)
    side[0] = side[-1] = 0
    zr, x0, dx = TURTLE['zr'], TURTLE['x0'], TURTLE['dx']

    def shell_uv(p, top):
        su, sv = (p[2] + zr) / (2 * zr), (p[0] - x0) / dx
        return (0.5 * su, sv) if top else (0.5 + 0.5 * su, 0.5 + 0.5 * sv)

    parts = [part(verts, faces, [[shell_uv(verts[i], side[f].sum() >= 0) for i in f] for f in faces])]
    # Neck and head, from under the shell's front.
    hx = np.linspace(0.28, 0.7, 22)
    r = PchipInterpolator([0.28, 0.4, 0.5, 0.58, 0.65, 0.7], [0.07, 0.066, 0.074, 0.079, 0.066, 0.036])(hx)
    yc = np.interp(hx, [0.28, 0.5, 0.7], [-0.03, -0.005, -0.012])
    k = 18
    psi = 2 * np.pi * np.arange(k) / k
    hv, hf, hs, hr = loft([np.stack([np.full(k, xi), yi + 0.85 * ri * np.sin(psi), ri * np.cos(psi)], 1)
                           for xi, ri, yi in zip(hx, r, yc)], [0.27, -0.03, 0], [0.716, -0.016, 0])
    parts.append(part(hv, hf, loft_uv(hf, hs, hr, k, lambda i, j: (0.5 + 0.47 * np.clip((i + 0.5) / 22, 0, 1),
                                                                  0.03 + 0.44 * j))))
    front = [(-0.06, -0.06), (-0.06, 0.06), (0.1, 0.105), (0.25, 0.115), (0.42, 0.085), (0.55, 0.045),
             (0.63, 0.005), (0.59, -0.03), (0.42, -0.045), (0.25, -0.06), (0.1, -0.08)]
    rear = [(-0.04, -0.05), (-0.04, 0.05), (0.08, 0.07), (0.17, 0.055), (0.22, 0.0), (0.17, -0.05), (0.08, -0.06)]
    for s in (1, -1):
        # Front flippers: the power stroke sweeps them down and back, the recovery up and forward.
        parts.append(turtle_flipper(front, [0.18, -0.035, s * 0.3], [-0.62, -0.14, s * 0.78], [0.78, 0, s * 0.62],
                                    0.045, {'Stroke_Left': (0.55 * s, -0.42 * s),
                                            'Stroke_Right': (-0.5 * s, 0.3 * s)}))
        parts.append(turtle_flipper(rear, [-0.38, -0.03, s * 0.14], [-0.7, -0.1, s * 0.7], [0.7, 0, s * 0.7],
                                    0.03, None))
        ev, ef = sphere([0.615, 0.022, s * 0.062], 0.016)
        parts.append(part(ev, ef, same_uv(ef, (0.012, 0.012))))
    return merge(parts)


def voronoi_seams(points, query):
    d, i = cKDTree(points).query(query, k=2)
    return d[:, 0], d[:, 1] - d[:, 0], i[:, 0]


def turtle_maps():
    u, v = grid()
    zr, x0, dx = TURTLE['zr'], TURTLE['x0'], TURTLE['dx']
    col = np.zeros(u.shape + (3,))
    height = np.zeros(u.shape)
    # Carapace: vertebral, costal and marginal scutes, each with streaks radiating from its centre.
    shell = u < 0.5
    z = -zr + (u / 0.5) * 2 * zr
    x = x0 + v * dx
    w, _, _ = shell_size((x + 0.01) / 0.49)
    q = z / np.maximum(w, 1e-3)
    centres = [(xi, 0) for xi in (0.36, 0.18, 0.0, -0.18, -0.34)]
    centres += [(xi, s * 0.56) for xi in (0.27, 0.09, -0.09, -0.26) for s in (1, -1)]
    centres += [(xi, s * 0.95) for xi in np.linspace(-0.44, 0.42, 11) for s in (1, -1)] + [(0.47, 0), (-0.49, 0)]
    pts = np.array([(cx, cq * 0.3) for cx, cq in centres])
    sel = np.stack([x[shell], np.clip(q[shell], -1.2, 1.2) * 0.3], 1)
    d1, gap, idx = voronoi_seams(pts, sel)
    seam = 1 - smooth(0.006, 0.018, gap)
    ang = np.arctan2(sel[:, 1] - pts[idx, 1], sel[:, 0] - pts[idx, 0])
    streak = 0.6 * noise2((ang / (2 * np.pi)) % 1, (idx * 0.137) % 1, 14, 31) + 0.4 * noise2(
        (ang / (2 * np.pi)) % 1, (idx * 0.291) % 1, 36, 32)
    streak = smooth(0.42, 0.72, streak) * smooth(0.01, 0.06, d1)
    tint = np.random.default_rng(31).uniform(0.85, 1.12, len(pts))[idx]
    base = lerp([0.25, 0.21, 0.12], [0.58, 0.45, 0.24], streak) * tint[:, None]
    base *= (0.9 + 0.1 * fbm(u[shell], v[shell], 16, 33))[:, None]
    col[shell] = lerp(base, [0.11, 0.09, 0.06], 0.85 * seam)
    height[shell] = smooth(0.0, 0.05, gap) * 0.6 + 0.15 * streak
    col[shell & (np.abs(q) > 1.02)] = [0.2, 0.17, 0.1]
    # Plastron: pale, with its seams.
    plast = (u >= 0.5) & (v >= 0.5)
    z = -zr + ((u - 0.5) / 0.5) * 2 * zr
    x = x0 + ((v - 0.5) / 0.5) * dx
    pp = np.array([(xi, s * 0.12) for xi in (0.3, 0.13, -0.05, -0.22, -0.38) for s in (1, -1)])
    _, gap, _ = voronoi_seams(pp, np.stack([x[plast], z[plast]], 1))
    pseam = 1 - smooth(0.005, 0.014, gap)
    col[plast] = lerp(lerp([0.84, 0.77, 0.55], [0.74, 0.67, 0.47], fbm(u[plast], v[plast], 16, 41)),
                      [0.45, 0.4, 0.28], 0.8 * pseam)
    height[plast] = -pseam
    # Skin: dark olive scales with pale seams.
    skin = (u >= 0.5) & (v < 0.5)
    rng = np.random.default_rng(51)
    sp = rng.random((650, 2)) * [0.5, 0.5] + [0.5, 0.0]
    d1, gap, idx = voronoi_seams(sp, np.stack([u[skin], v[skin]], 1))
    sseam = 1 - smooth(0.003, 0.008, gap)
    tint = rng.uniform(0.8, 1.15, len(sp))[idx]
    scale = lerp([0.2, 0.17, 0.1], [0.32, 0.26, 0.15], smooth(0.0, 0.018, gap)) * tint[:, None]
    col[skin] = lerp(scale, [0.62, 0.57, 0.42], 0.7 * sseam)
    height[skin] = smooth(0.0, 0.018, gap)
    eyes = (u < 0.03) & (v < 0.03)
    col[eyes] = [0.02, 0.02, 0.02]
    rough = np.full(u.shape, 0.65)
    rough[shell] = 0.5 + 0.2 * seam
    rough[plast] = 0.6
    rough[eyes] = 0.12
    return (save_png('creature_turtle_base', col), save_png('creature_turtle_normal', normal_map(height, 2.0)),
            save_roughness('creature_turtle_orm', rough))


# ------------------------------------------------------------------ build


CREATURES = {
    'shark': ('reef-shark', 'Shark_Root', shark, shark_maps),
    'ray': ('eagle-ray', 'Ray_Root', ray, ray_maps),
    'turtle': ('sea-turtle', 'Turtle_Root', turtle, turtle_maps),
}


def build(name):
    file, root_name, shape_fn, maps_fn = CREATURES[name]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    shape = shape_fn()
    base, normal, rough = maps_fn()
    root = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(root)
    body = mesh_object('Body', shape, root)
    body.data.materials.append(material(f'{root_name[:-5]}_Skin', base, normal, rough))
    low = distance_level(body)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f'{file}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='NONE', export_morph=True)
    tris = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)  # noqa: E731
    lo, hi = shape['v'].min(0), shape['v'].max(0)
    print(name, 'triangles', tris(body), 'LOD1', tris(low), 'size', np.round(hi - lo, 2), 'bytes', out.stat().st_size)


if __name__ == '__main__':
    for n in (sys.argv[1:] or CREATURES):
        build(n)
