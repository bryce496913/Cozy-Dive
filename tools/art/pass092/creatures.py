"""V0.8 Pass 092: the remaining marine animals, and the defects the Pass 088 audit found.

    python3 tools/art/pass092/creatures.py [names...]       # Blender 5.1 Python (bpy module)
    node tools/art/pass017/compress.mjs public/assets/models/creatures

Same contract as Pass 078/084 (`<Root>` > `Body` + `Body_LOD1`, one material, `Stroke_Left` /
`Stroke_Right` morphs at rest weight 0, shipped root names and sizes), so every movement,
encounter and discovery system drives them unchanged. Built on the Pass 084 sculpt classes.

* **Minke whale** (was the Pass 068 loft): a new sculpt. Slender, laterally keeled tail stock; a
  narrow, pointed, V-shaped rostrum with its single median ridge and splash guard round the
  blowholes; a bowed mouth line and small eyes at its corner; ventral pleats to behind the
  flippers; a tall, falcate dorsal two-thirds back; slender pointed flippers; broad flukes with a
  notch and a smooth trailing edge. Black-grey back, white belly, pale chevrons on the shoulders
  and the minke's white flipper band.
* **Sea otter** (was the Pass 068 loft, with flat polygonal eye patches): a new sculpt. A long,
  supple body, a broad flat head with a blunt muzzle and swollen whisker pads, a dark nose pad,
  small round ears, eyes set in sockets (eyeballs, not painted patches), short forelimbs with
  mitten paws, large webbed hind feet, and a flat, paddle-like tail a third of its length. Dark
  brown with a grizzled pale head and throat.
* **Polar bear**: reproportioned past the plush toy. A long neck, a smaller, longer head with a
  Roman-nosed muzzle; a low shoulder and heavy hindquarters; fore legs reaching forward and down
  mid-paddle (elbow bent) and hind legs trailing; big, flat, slightly turned-in paws.
* **Every rebuilt animal** (these three, and the whale shark, eagle ray, manta, great white, reef
  shark and humpback the audit flagged):
  - Jagged fin and wing edges: marching cubes leaves a voxel staircase on thin trailing edges.
    The raw surface is now smoothed (Taubin, so it keeps its volume), most on the fins.
  - Polygonal markings (whale-shark spots, eagle-ray spots, chevrons): vertex colour can only
    change at a vertex. The mesh is decimated a little lower, and the reserve is spent splitting
    the triangles a marking's edge crosses (neighbours split too, so no T-junction opens during
    a stroke), with new points projected back onto the sculpted surface. The body stays within
    its 8000-triangle budget.
  - Texture seams: the detail map was box-projected, which seams wherever the dominant axis
    changes (lines across the back and flanks). The body is now mapped round its own spine
    (the one seam runs along the belly midline); fins keep planar mapping.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools/art/pass084'))
import creatures as c84  # noqa: E402  (sets up the Pass 078 modules and Pass 084 skins)

m, sc = c84.m, c84.sc
smooth, smin, smax, ellipsoid, chain, Body, noise3, spots = (
    m.smooth, m.smin, m.smax, m.ellipsoid, m.chain, m.Body, m.noise3, m.spots)
fin, bez2, flipper_frame, torpedo, round_cone = sc.fin, sc.bez2, sc.flipper_frame, sc.torpedo, m.round_cone
TAU = math.tau
BUDGET = 7900  # the shipped body budget is under 8000 triangles


# ------------------------------------------------------------------ mesh refinement


def adjacency(n, f):
    from scipy.sparse import coo_matrix  # noqa: PLC0415
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    a = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n)).tocsr()
    a.data[:] = 1
    return a


def taubin(v, f, weight, iterations=12, lam=0.5, mu=-0.53):
    """Volume-keeping smoothing; `weight` (0..1 per vertex) sets how much each vertex moves."""
    a = adjacency(len(v), f)
    deg = np.asarray(a.sum(1)).ravel()
    deg[deg == 0] = 1
    w = weight[:, None]
    for _ in range(iterations):
        for k in (lam, mu):
            v = v + k * w * (a @ v / deg[:, None] - v)
    return v


def field(sp, p):
    ds = sp.parts(p)
    return smin(list(ds.values()), sp.blend)


def project(sp, p, step):
    """Move points onto the sculpted surface (two Newton steps on its field)."""
    for _ in range(2):
        d = field(sp, p)
        g = np.stack([(field(sp, p + e) - field(sp, p - e)) / (2 * step)
                      for e in np.eye(3) * step], 1)
        p = p - (d / np.maximum((g * g).sum(1), 1e-9))[:, None] * g
    return p


def colours_at(sp, v, f):
    ds = sp.parts(v)
    names = list(ds)
    label = np.array(names)[np.argmin(np.stack([ds[k] for k in names]), 0)]
    nrm = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(nrm, f[:, k], fn)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    cen = (v[f[:, 0]] + v[f[:, 1]] + v[f[:, 2]]) / 3
    if np.sum(cen * fn) < 0:
        nrm = -nrm
    s, theta, yn = sp.body.param(v)
    return np.clip(sp.colour(v, nrm, s, theta, yn, label), 0, 1)


def split_markings(sp, v, f, budget, step):
    """Split the triangles a colour edge crosses (most contrasting first) until `budget`."""
    for _ in range(3):
        if len(f) >= budget - 8:
            break
        col = colours_at(sp, v, f)
        contrast = np.max([np.abs(col[f[:, a]] - col[f[:, b]]).max(1) for a, b in ((0, 1), (1, 2), (2, 0))], 0)
        order = np.argsort(-contrast)
        order = order[contrast[order] > 0.12]
        if not len(order):
            break
        # Each split edge adds about two triangles (one in each face sharing it).
        edges = {}
        for fi in order:
            if len(f) + 2 * len(edges) >= budget - 6:
                break
            for a, b in ((0, 1), (1, 2), (2, 0)):
                key = tuple(sorted((f[fi, a], f[fi, b])))
                edges.setdefault(key, None)
        if not edges:
            break
        keys = list(edges)
        mids = (v[[k[0] for k in keys]] + v[[k[1] for k in keys]]) / 2
        mids = project(sp, mids, step)
        base = len(v)
        index = {k: base + i for i, k in enumerate(keys)}
        v = np.vstack([v, mids])
        out = []
        for tri in f:
            ms = [index.get(tuple(sorted((tri[i], tri[(i + 1) % 3])))) for i in range(3)]
            k = sum(x is not None for x in ms)
            if k == 0:
                out.append(tri)
            elif k == 3:
                a, b, c = tri
                mab, mbc, mca = ms
                out += [(a, mab, mca), (mab, b, mbc), (mca, mbc, c), (mab, mbc, mca)]
            elif k == 1:
                i = next(j for j in range(3) if ms[j] is not None)
                a, b, c = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
                out += [(a, ms[i], c), (ms[i], b, c)]
            else:
                j = next(j for j in range(3) if ms[j] is None)  # the unsplit edge (v_j, v_j+1)
                a, b, c = tri[(j + 1) % 3], tri[(j + 2) % 3], tri[j]
                m1, m2 = ms[(j + 1) % 3], ms[(j + 2) % 3]
                out += [(a, m1, c), (m1, m2, c), (m1, b, m2)]
        f = np.array(out, dtype=f.dtype)
    return v, f


def body_uv(sp, v, label, nrm):
    """Detail-map coordinates: round the spine on the body (one seam, under the belly), planar
    (by the dominant axis) on fins and limbs."""
    L = sp.length
    k = 3.0 / L * 2
    i, y, z, _ = sp.body.local(v)
    s = sp.body.s[i]
    theta = np.arctan2(z, y)
    girth = np.sqrt(np.maximum(sp.body.H(s) * sp.body.W(s), 1e-6))
    along = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(sp.body.c, axis=0), axis=1))])[i]
    round_uv = np.stack([along * k, theta * girth * k], 1)
    a = np.abs(nrm).argmax(1)
    planar = np.where(a[:, None] == 0, v[:, [2, 1]], np.where(a[:, None] == 1, v[:, [0, 2]], v[:, [0, 1]])) * k
    return np.where((label == 'body')[:, None], round_uv, planar)


# The asset standard: every image 512 by 512 (about 6 mm a texel on the whale shark, well under
# its smallest spot).
MARKS_SIZE = 512


def bake_markings(sp, body, v, nrm, name):
    """Bake the species' colour pattern into a texture on a second, unique UV set ('Marks') and
    switch the skin's base map to it, so spots and stripes keep crisp, round edges whatever the
    triangle count (vertex colour can only change at a vertex). The pattern is sampled from the
    same analytic colouring at every texel's point on the surface."""
    import bpy  # noqa: PLC0415
    from PIL import Image  # noqa: PLC0415
    from scipy.ndimage import distance_transform_edt  # noqa: PLC0415
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    me = body.data
    uvl = me.uv_layers.new(name='Marks')
    me.uv_layers.active = uvl
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Leaving edit mode rebuilds the mesh's layers: fetch them again (the old handles are stale).
    me = body.data
    uvl = me.uv_layers['Marks']
    me.uv_layers.active = me.uv_layers[0]
    nl = len(me.loops)
    vi = np.empty(nl, np.int64)
    me.loops.foreach_get('vertex_index', vi)
    uv = np.empty(nl * 2)
    uvl.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2) * MARKS_SIZE
    starts = np.empty(len(me.polygons), np.int64)
    me.polygons.foreach_get('loop_start', starts)
    N = MARKS_SIZE
    pts, nrms, where = [], [], []
    for st in starts:
        a, b, c = uv[st], uv[st + 1], uv[st + 2]
        ia, ib, ic = vi[st], vi[st + 1], vi[st + 2]
        x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
        x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1, N - 1) + 1), np.arange(max(y0, 0), min(y1, N - 1) + 1))
        q = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12:
            continue
        w0 = ((b[1] - c[1]) * (q[:, 0] - c[0]) + (c[0] - b[0]) * (q[:, 1] - c[1])) / d
        w1 = ((c[1] - a[1]) * (q[:, 0] - c[0]) + (a[0] - c[0]) * (q[:, 1] - c[1])) / d
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not inside.any():
            continue
        W = np.stack([w0, w1, w2], 1)[inside]
        pts.append(W @ v[[ia, ib, ic]])
        nrms.append(W @ nrm[[ia, ib, ic]])
        where.append(q[inside].astype(int))
    P, Nn, at = np.vstack(pts), np.vstack(nrms), np.vstack(where)
    Nn /= np.linalg.norm(Nn, axis=1, keepdims=True) + 1e-12
    ds = sp.parts(P)
    names = list(ds)
    label = np.array(names)[np.argmin(np.stack([ds[k] for k in names]), 0)]
    s, theta, yn = sp.body.param(P)
    col = np.clip(sp.colour(P, Nn, s, theta, yn, label), 0, 1)
    img = np.zeros((N, N, 3))
    filled = np.zeros((N, N), bool)
    img[at[:, 1], at[:, 0]] = col
    filled[at[:, 1], at[:, 0]] = True
    # Bleed each island's colour outward so filtering never pulls in the background.
    _, (iy, ix) = distance_transform_edt(~filled, return_indices=True)
    img = img[iy, ix]
    path = m.TEX / f'p092-{name}-marks.png'
    Image.fromarray(np.uint8(np.flipud(img) * 255 + 0.5)).save(path, optimize=True)
    # (The colours are sRGB already, as the vertex colours were.)
    # The skin's base map becomes the markings on 'Marks'; vertex colour goes white.
    mat = body.data.materials[0]
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image and node.image.filepath.endswith('-base.png'):
            node.image = bpy.data.images.load(str(path))
            uvn = mat.node_tree.nodes.new('ShaderNodeUVMap')
            uvn.uv_map = 'Marks'
            mat.node_tree.links.new(uvn.outputs['UV'], node.inputs['Vector'])
    colattr = me.color_attributes['Col']
    colattr.data.foreach_set('color', np.ones(len(colattr.data) * 4))
    print('  baked markings', path, len(P), 'texels', flush=True)



def build(name, sp, kind, smooth_parts=True, markings=True, texture=False):
    """Pass 078's build_species with the Pass 092 refinements (see the module comment)."""
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415
    from skimage.measure import marching_cubes  # noqa: PLC0415
    c84.SKIN['kind'] = kind
    c84.SMOOTH['on'] = name not in ('eagle-ray', 'manta-ray')
    m.HERE = HERE
    (HERE / 'out').mkdir(exist_ok=True)
    sp.build_body()
    L = sp.length
    voxel = L / getattr(sp, 'resolution', 260)
    probe = sp.body.c
    pad = getattr(sp, 'pad', ((0.22, 0.42, 0.42), (0.22, 0.32, 0.42)))
    lo = probe.min(0) - np.array(pad[0]) * L
    hi = probe.max(0) + np.array(pad[1]) * L
    shape = np.ceil((hi - lo) / voxel).astype(int) + 1
    axes = [lo[k] + np.arange(shape[k]) * voxel for k in range(3)]
    X, Y, Z = np.meshgrid(*axes, indexing='ij')
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    fld = np.empty(len(pts))
    for i in range(0, len(pts), 300000):
        ds = sp.parts(pts[i:i + 300000])
        fld[i:i + 300000] = smin(list(ds.values()), sp.blend)
    v, f, _, _ = marching_cubes(fld.reshape(shape), 0.0, spacing=(voxel,) * 3)
    v += lo
    f = f[:, ::-1].copy()
    if smooth_parts:
        ds = sp.parts(v)
        names = list(ds)
        label = np.array(names)[np.argmin(np.stack([ds[k] for k in names]), 0)]
        v = taubin(v, f, np.where(label == 'body', 0.35, 1.0))
    target = int(sp.near * 0.84) if markings else sp.near
    v, f = m.decimate(v, f, target)
    area = np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1)
    f = f[(area > 1e-12) & (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    _, first = np.unique(np.sort(f, axis=1), axis=0, return_index=True)
    f = f[np.sort(first)]
    if markings:
        v, f = split_markings(sp, v, f, min(BUDGET, sp.near + 300), voxel * 0.5)
    ds = sp.parts(v)
    names = list(ds)
    label = np.array(names)[np.argmin(np.stack([ds[k] for k in names]), 0)]
    nrm = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(nrm, f[:, k], fn)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    cen = (v[f[:, 0]] + v[f[:, 1]] + v[f[:, 2]]) / 3
    if np.sum(cen * fn) < 0:
        nrm = -nrm
    s, theta, yn = sp.body.param(v)
    col = np.clip(sp.colour(v, nrm, s, theta, yn, label), 0, 1)
    uv = body_uv(sp, v, label, nrm)
    shift = np.array([(v[:, 0].min() + v[:, 0].max()) / 2, 0, 0])
    stem = f'p078-{name}-skin'
    m.detail_texture(stem, sp.template == 'fur')
    ca = m.ca
    ca.reset_scene()
    root = ca.create_root(f'{sp.root}_Root', 'creature', species=name, standards_pass='092')
    skin = ca.pbr_material(f'{sp.root}_Skin', sp.template, stem, roughness=sp.rough, normal_strength=0.6,
                           directory=m.TEX, vertex_tint=True)
    body = ca.mesh_from_arrays('Body', v - shift, f, uv, col, skin, root)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(body.data)
    bm.free()
    if texture:
        bake_markings(sp, body, v, nrm, name)
    body.shape_key_add(name='Basis', from_mix=False)
    for sign, key in ((1, 'Stroke_Left'), (-1, 'Stroke_Right')):
        q = sp.stroke(v, label, sign) - shift
        kb = body.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set('co', ca.to_blender(q).ravel())
        kb.value = 0.0
    import fish_lod  # noqa: PLC0415
    fish_lod.RATIOS['Body'] = sp.far / max(len(f), 1)
    low = fish_lod.lod(body)
    for kb in low.data.shape_keys.key_blocks[1:]:
        kb.value = 0.0
    for w in ca.check_scene('creature'):
        print('  note:', w)
    ca.save_blend(HERE / f'{name}.blend')
    raw = ca.export_glb(HERE / 'out' / f'{name}.glb')
    out = m.OUT / f'{name}.glb'
    out.write_bytes(raw.read_bytes())
    tris = {o.name: sum(len(pl.vertices) - 2 for pl in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
    dims = {o.name: [round(x, 2) for x in o.dimensions] for o in bpy.data.objects if o.type == 'MESH'}
    print('exported', name, out.stat().st_size, tris, dims, flush=True)


# ------------------------------------------------------------------ minke whale


class Minke(sc.Creature):
    root = 'Minke'
    length = 3.02
    rough = 0.42
    pad = ((0.16, 0.22, 0.3), (0.05, 0.22, 0.3))

    def build_body(self):
        self.body = torpedo(self.length, 0.88,
                            [(0, .012), (.08, .027), (.2, .046), (.35, .066), (.55, .079), (.7, .077), (.82, .066),
                             (.9, .048), (.96, .028), (1, .008)],
                            [(0, .009), (.08, .015), (.2, .032), (.35, .058), (.55, .074), (.7, .074), (.82, .064),
                             (.9, .046), (.96, .026), (1, .007)],
                            x0=0.56, belly=0.0)

    def parts(self, p):
        L, b = self.length, self.body
        X, Y, Z = np.eye(3)
        d = b.sdf(p)
        s, theta, yn = b.param(p)
        # Ventral pleats from the chin to behind the flippers.
        pleat = (0.5 + 0.5 * np.cos(theta * 40)) * smooth(-0.2, -0.5, yn) * smooth(0.6, 0.66, s) * smooth(1.0, 0.95, s)
        d = d + 0.0025 * L * pleat
        tip, *_ = b.at(1.0)
        # The rostrum: flat-topped and pointed (V-shaped from above), one median ridge along it.
        cut = p[:, 1] - (tip[1] + 0.018 * L + 0.1 * (tip[0] - p[:, 0])) - 0.15 * L * (1 - smooth(0.82, 0.92, s))
        d = smax(d, cut, 0.015 * L)
        ridge = round_cone(p, tip + np.array([-0.012 * L, 0.012 * L, 0]), tip + np.array([-0.13 * L, 0.029 * L, 0]),
                           0.004 * L, 0.007 * L)
        d = smin([d, ridge], 0.008 * L)
        # Splash guard and the paired blowholes behind it.
        bh = tip + np.array([-0.155 * L, 0.036 * L, 0])
        d = smin([d, ellipsoid(p, bh + np.array([0.01 * L, 0.002 * L, 0]), (0.018 * L, 0.006 * L, 0.012 * L))], 0.006 * L)
        for sd in (-1, 1):
            d = smax(d, -ellipsoid(p, bh + np.array([-0.006 * L, 0.006 * L, sd * 0.005 * L]),
                                   (0.008 * L, 0.004 * L, 0.0025 * L)), 0.002 * L)
        # A bowed mouth line from the tip back past the eye.
        mx = tip[0] - p[:, 0]
        bow = tip[1] - 0.006 * L - 0.04 * mx + 0.12 * mx * mx / L
        mouth = np.maximum(np.abs(p[:, 1] - bow) - 0.0018 * L, mx - 0.2 * L)
        d = smax(d, -np.maximum(mouth, -mx), 0.002 * L)
        # Eyes just above the mouth's corner, in a slight swelling.
        self.eyes = []
        for sd in (-1, 1):
            e = tip + np.array([-0.205 * L, -0.002 * L, sd * 0.06 * L])
            self.eyes.append(e)
            d = smin([d, ellipsoid(p, e - np.array([0, 0, sd * 0.004 * L]), (0.014 * L, 0.01 * L, 0.008 * L))], 0.006 * L)
            d = smax(d, -ellipsoid(p, e + np.array([0, 0, sd * 0.004 * L]), (0.006 * L, 0.004 * L, 0.004 * L)), 0.002 * L)
        ds = {'body': d}
        # A tall, falcate dorsal two-thirds of the way back.
        cd, *_ = b.at(0.31)
        hd = b.H(0.31)
        dorsal = np.vstack([bez2((0.045 * L, -0.012 * L), (0.02 * L, 0.02 * L), (-0.012 * L, 0.05 * L), n=12),
                            bez2((-0.012 * L, 0.05 * L), (-0.018 * L, 0.03 * L), (-0.03 * L, -0.012 * L), n=10)[1:]])
        ds['fins'] = fin(p, cd + Y * hd * 0.85, X, Y, dorsal, 0.008 * L, 0.0025 * L)
        # Slender, pointed flippers, low on the side, angled down and back.
        cp, *_ = b.at(0.75)
        for sd in (-1, 1):
            u, out = flipper_frame((-0.45, -0.55, sd * 0.7), (-1, 0, 0))
            span = 0.13 * L
            lead = [(0.016 * L * (1 - r) ** 0.9 + 0.003 * L * math.sin(r * math.pi), r * span) for r in np.linspace(0, 1, 16)]
            trail = [(-0.014 * L * (1 - r) ** 1.2, r * span) for r in np.linspace(1, 0, 12)]
            ds['fins'] = np.minimum(ds['fins'], fin(p, cp - Y * b.H(0.75) * 0.55 + Z * sd * b.W(0.75) * 0.82,
                                                    -u, out, np.array(lead + trail), 0.01 * L, 0.0025 * L))
        # The tail stock's keels, above and below.
        for sy in (1, -1):
            keel = round_cone(p, b.at(0.03)[0] + Y * sy * b.H(0.03) * 0.6, b.at(0.22)[0] + Y * sy * b.H(0.22) * 0.55,
                              0.004 * L, 0.006 * L)
            ds['body'] = smin([ds['body'], keel], 0.012 * L)
        # Broad flukes: swept, a median notch, a smooth, gently concave trailing edge.
        tail = b.c[0] + np.array([0.015 * L, 0, 0])
        fl = []
        for sz in (1, -1):
            lead = bez2((0.035 * L, 0), (0.01 * L, sz * 0.06 * L), (-0.05 * L, sz * 0.135 * L), n=14)
            trail = bez2((-0.05 * L, sz * 0.135 * L), (-0.06 * L, sz * 0.07 * L), (-0.07 * L, sz * 0.006 * L), n=14)
            fl.append(np.vstack([lead, trail[1:], [(-0.058 * L, 0)]]))
        ds['tail'] = fin(p, tail, X, Z, np.vstack([fl[0], fl[1][::-1]]), 0.012 * L, 0.003 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        dark = np.array([0.1, 0.11, 0.13])
        white = np.array([0.88, 0.88, 0.86])
        grey = np.array([0.52, 0.55, 0.58])
        wave = 0.08 * np.sin(s * 14) + 0.05 * noise3(p, 6, 51)
        k = smooth(-0.05 + wave, -0.35 + wave, yn)
        col = dark * (1 - k[:, None]) + white * k[:, None]
        # Pale chevrons sweeping up the flank behind the flippers, and over the shoulders.
        chev = smooth(0.08, 0.02, np.abs(s - (0.66 - 0.12 * (yn + 0.2)))) * smooth(0.55, 0.1, yn) * smooth(-0.4, -0.1, yn)
        chev2 = smooth(0.05, 0.0, np.abs(s - (0.8 - 0.08 * yn))) * smooth(0.65, 0.3, yn) * smooth(0.0, 0.25, yn)
        blaze = np.maximum(chev, chev2 * 0.8)
        col = col * (1 - 0.9 * blaze[:, None]) + grey * 0.9 * blaze[:, None]
        # Pleat grooves a shade darker on the white throat.
        groove = (0.5 + 0.5 * np.cos(theta * 40)) * smooth(-0.2, -0.5, yn) * smooth(0.6, 0.66, s)
        col *= (1 - 0.18 * groove)[:, None]
        # Flippers: dark tips and root, the white band across the middle.
        cp, *_ = self.body.at(0.75)
        reach = np.linalg.norm(p - (cp - np.array([0, self.body.H(0.75) * 0.55, 0])), axis=1) / (0.14 * L)
        band = smooth(0.25, 0.35, reach) * smooth(0.7, 0.6, reach)
        flip = (label == 'fins') & (p[:, 1] < cp[1])
        fcol = dark * (1 - band[:, None]) + white * band[:, None]
        col = np.where(flip[:, None], fcol, col)
        # Flukes dark above, white below with a dark margin.
        under = smooth(0.1, -0.3, n[:, 1])
        col = np.where((label == 'tail')[:, None], dark * (1 - 0.85 * under[:, None]) + white * 0.85 * under[:, None], col)
        col *= (1 + 0.04 * noise3(p, 8, 52) + 0.025 * noise3(p, 30, 53))[:, None]
        return self.eye_paint(p, col, 0.005 * L)

    def stroke(self, p, label, sign):
        return self.fluke(p, sign, 0.075)


# ------------------------------------------------------------------ sea otter


class SeaOtter(m.Species):
    root = 'Otter'
    length = 1.21
    template = 'fur'
    rough = 0.82
    blend = 0.02
    resolution = 300

    def build_body(self):
        L = self.length
        spine = m.bezier((-0.5 * L, 0.004 * L, 0), (-0.15 * L, -0.012 * L, 0), (0.25 * L, 0.0, 0),
                         (0.5 * L, 0.012 * L, 0), n=14)
        # Tail (0 to 0.3) flattened top to bottom; hips, a long torso, the neck, a broad head.
        self.body = Body(spine,
                         [(0, .006 * L), (.05, .012 * L), (.2, .016 * L), (.3, .03 * L), (.36, .075 * L),
                          (.5, .092 * L), (.66, .09 * L), (.76, .075 * L), (.82, .06 * L), (.88, .064 * L),
                          (.94, .05 * L), (.98, .03 * L), (1, .012 * L)],
                         [(0, .012 * L), (.05, .028 * L), (.2, .036 * L), (.3, .045 * L), (.36, .085 * L),
                          (.5, .1 * L), (.66, .095 * L), (.76, .075 * L), (.82, .062 * L), (.88, .072 * L),
                          (.94, .058 * L), (.98, .034 * L), (1, .013 * L)], belly=0.15)

    def parts(self, p):
        L, b = self.length, self.body
        d = b.sdf(p)
        # Head: a broad, flat cranium; the muzzle short and blunt with swollen whisker pads.
        c, up, t, H, W = b.at(0.9)
        # A broad, flat-topped skull, wider than deep.
        d = smin([d, ellipsoid(p, c + up * H * 0.1, (H * 1.3, H * 0.85, W * 1.15))], 0.02 * L)
        d = smax(d, p[:, 1] - (c[1] + H * 0.95), 0.012 * L)
        tip, *_ = b.at(0.985)
        # The blunt muzzle: swollen whisker pads either side, the chin under them.
        for sd in (-1, 1):
            pad = tip + np.array([-0.018 * L, -0.012 * L, sd * 0.024 * L])
            d = smin([d, ellipsoid(p, pad, (0.026 * L, 0.022 * L, 0.024 * L))], 0.006 * L)
        d = smin([d, ellipsoid(p, tip + np.array([-0.03 * L, -0.035 * L, 0]), (0.025 * L, 0.012 * L, 0.022 * L))],
                 0.008 * L)
        self.nose = tip + np.array([0.008 * L, 0.008 * L, 0])
        d = smin([d, ellipsoid(p, self.nose, (0.01 * L, 0.012 * L, 0.018 * L))], 0.004 * L)
        self.mouth = tip + np.array([-0.025 * L, -0.03 * L, 0])
        d = smax(d, -ellipsoid(p, self.mouth, (0.025 * L, 0.0025 * L, 0.03 * L)), 0.002 * L)
        # Eyes: sockets and eyeballs, set forward and high on the head; small round ears behind.
        self.eyes = []
        for sd in (-1, 1):
            e = c + t * 0.045 * L + up * H * 0.62 + np.array([0, 0, sd * W * 0.62])
            self.eyes.append(e)
            d = smax(d, -ellipsoid(p, e, (0.011 * L, 0.009 * L, 0.008 * L)), 0.005 * L)
            d = smin([d, ellipsoid(p, e - np.array([0, 0, sd * 0.002 * L]), (0.0075 * L,) * 3)], 0.002 * L)
            ear = c - t * 0.035 * L + up * H * 0.55 + np.array([0, 0, sd * W * 1.05])
            d = smin([d, ellipsoid(p, ear, (0.012 * L, 0.014 * L, 0.008 * L))], 0.003 * L)
            d = smax(d, -ellipsoid(p, ear + np.array([0.002 * L, 0, sd * 0.006 * L]), (0.006 * L, 0.008 * L, 0.004 * L)),
                     0.002 * L)
        ds = {'body': d}
        # Short forelimbs, folded under the chest, ending in mitten paws.
        cf, upf, tf, Hf, Wf = b.at(0.72)
        ds['fore'] = np.full(len(p), np.inf)
        for sd in (-1, 1):
            sh = cf - upf * Hf * 0.45 + np.array([0, 0, sd * Wf * 0.7])
            el = sh + np.array([0.01 * L, -0.06 * L, sd * 0.012 * L])
            paw = el + np.array([0.05 * L, -0.012 * L, -sd * 0.01 * L])
            arm = chain(p, [sh, el, paw], [0.026 * L, 0.018 * L, 0.014 * L], flat=((0, 0, 1), 0.8))
            mitt = ellipsoid(p, paw + np.array([0.012 * L, -0.002 * L, 0]), (0.022 * L, 0.011 * L, 0.017 * L))
            ds['fore'] = np.minimum(ds['fore'], smin([arm, mitt], 0.008 * L))
        # Large webbed hind feet reaching back beside the tail's root.
        ch, uph, th, Hh, Wh = b.at(0.33)
        ds['hind'] = np.full(len(p), np.inf)
        self.hips = []
        for sd in (-1, 1):
            hp = ch - uph * Hh * 0.3 + np.array([0, 0, sd * Wh * 0.75])
            self.hips.append(hp)
            ankle = hp + np.array([-0.07 * L, -0.012 * L, sd * 0.03 * L])
            leg = chain(p, [hp, ankle], [0.036 * L, 0.02 * L], flat=((0, 0, 1), 0.75))
            toes = []
            for k, a in enumerate(np.linspace(-0.45, 0.45, 5)):
                dirv = np.array([-math.cos(a), 0.0, sd * 0.35 + math.sin(a) * 0.8])
                dirv /= np.linalg.norm(dirv)
                reach = 0.12 * L * (1.0 - 0.15 * (k if sd > 0 else 4 - k) / 4)
                toes.append(chain(p, [ankle, ankle + dirv * reach], [0.011 * L, 0.006 * L], flat=((0, 1, 0), 0.4)))
            web = ellipsoid(p, ankle + np.array([-0.06 * L, 0, sd * 0.02 * L]), (0.06 * L, 0.005 * L, 0.05 * L))
            ds['hind'] = np.minimum(ds['hind'], smin([leg, *toes, web], 0.01 * L))
        return ds

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        brown = np.array([0.23, 0.15, 0.1])
        pale = np.array([0.74, 0.66, 0.52])
        # Grizzled: pale guard hairs over dark underfur, coarse enough to read at swimming distance.
        grizzle = 0.6 + 0.4 * smooth(-0.5, 0.7, noise3(p, 14, 61) + 0.5 * noise3(p, 32, 63))
        # Palest at the muzzle and cheeks, darker over the crown, grading down the neck.
        head = smooth(0.74, 0.9, s) * (1 - 0.35 * smooth(0.3, 0.9, yn) * smooth(0.99, 0.9, s))
        col = brown * (1 + 0.12 * noise3(p, 6, 62))[:, None]
        col = col * (1 - head[:, None]) + pale * (grizzle * head)[:, None] + brown * (1 - grizzle)[:, None] * head[:, None] * 0.6
        col = np.where((label == 'hind')[:, None], brown * 0.75, col)
        col = np.where((label == 'fore')[:, None], brown * 0.85, col)
        col = np.where((np.linalg.norm(p - self.nose, axis=1) < 0.019 * L)[:, None], np.array([0.05, 0.045, 0.045]), col)
        for e in self.eyes:
            col = np.where((np.linalg.norm(p - e, axis=1) < 0.0095 * L)[:, None], np.array([0.02, 0.02, 0.02]), col)
        return col

    def stroke(self, p, label, sign):
        # The Pass 068 contract: the body bends to one side from the middle back.
        L = self.length
        xs = np.clip((p[:, 0].max() - p[:, 0]) / L, 0, 1.3)
        q = p.copy()
        q[:, 2] += sign * 0.12 * L * smooth(0.5, 1.15, xs) ** 1.6
        return q


# ------------------------------------------------------------------ polar bear


class PolarBear(c84.PolarBear):
    """See the module comment. Same root, length and paddle stroke as Pass 084."""

    def build_body(self):
        L = self.length
        # Lower shoulders, a long neck carried forward and slightly down, the head held low.
        spine = m.bezier((-0.5 * L, 0.0, 0), (-0.12 * L, 0.07 * L, 0), (0.2 * L, 0.055 * L, 0),
                         (0.5 * L, 0.05 * L, 0), n=12)
        self.body = Body(spine,
                         [(0, .06 * L), (.06, .13 * L), (.2, .17 * L), (.38, .175 * L), (.55, .17 * L),
                          (.66, .13 * L), (.74, .095 * L), (.82, .08 * L), (.87, .074 * L), (.92, .062 * L),
                          (.96, .045 * L), (1, .018 * L)],
                         [(0, .06 * L), (.06, .13 * L), (.2, .165 * L), (.38, .16 * L), (.55, .15 * L),
                          (.66, .115 * L), (.74, .085 * L), (.82, .07 * L), (.87, .066 * L), (.92, .055 * L),
                          (.96, .04 * L), (1, .016 * L)], belly=0.12)

    def parts(self, p):
        L, b = self.length, self.body
        ds = {'body': b.sdf(p)}
        # Heavy hindquarters; shoulder blades low.
        c, up, t, H, W = b.at(0.2)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.15, (H * 1.0, H * 0.85, W * 0.98))], 0.06)
        c, up, t, H, W = b.at(0.58)
        ds['body'] = smin([ds['body'], ellipsoid(p, c + up * H * 0.3, (H * 0.85, H * 0.5, W * 0.78))], 0.06)
        # Head: smaller and longer, a flat skull, the Roman-nosed muzzle tapering to the nose pad.
        c, up, t, H, W = b.at(0.9)
        skull = ellipsoid(p, c + up * 0.022 * L, (0.085 * L, 0.055 * L, 0.06 * L))
        cheeks = ellipsoid(p, c + t * 0.02 * L - up * 0.01 * L, (0.06 * L, 0.045 * L, 0.066 * L))
        muzzle = round_cone(p, c + t * 0.05 * L + up * 0.006 * L, c + t * 0.165 * L - up * 0.006 * L, 0.04 * L, 0.024 * L)
        bridge = round_cone(p, c + t * 0.05 * L + up * 0.03 * L, c + t * 0.15 * L + up * 0.012 * L, 0.018 * L, 0.012 * L)
        ds['body'] = smin([ds['body'], skull, cheeks, muzzle, bridge], 0.024 * L)
        nose = c + t * 0.178 * L
        ds['body'] = smin([ds['body'], ellipsoid(p, nose, (0.015 * L, 0.016 * L, 0.021 * L))], 0.01 * L)
        self.nose = nose
        self.eyes = []
        for sd in (-1, 1):
            e = c + t * 0.065 * L + up * 0.035 * L + np.array([0, 0, sd * 0.045 * L])
            self.eyes.append(e)
            ds['body'] = smax(ds['body'], -ellipsoid(p, e, (0.012 * L, 0.008 * L, 0.008 * L)), 0.006 * L)
            ds['body'] = smin([ds['body'], ellipsoid(p, e - np.array([0, 0, sd * 0.0025 * L]), (0.007 * L,) * 3)],
                              0.0025 * L)
            ear = c - t * 0.035 * L + up * 0.065 * L + np.array([0, 0, sd * 0.046 * L])
            ds['body'] = smin([ds['body'], ellipsoid(p, ear, (0.013 * L, 0.014 * L, 0.008 * L))], 0.008 * L)
            ds['body'] = smax(ds['body'], -ellipsoid(p, nose + t * 0.01 * L + up * 0.005 * L + np.array([0, 0, sd * 0.008 * L]),
                                                     (0.005 * L, 0.004 * L, 0.004 * L)), 0.002 * L)
        self.mouth = nose - t * 0.05 * L - up * 0.02 * L
        ds['body'] = smax(ds['body'], -ellipsoid(p, self.mouth, (0.05 * L, 0.0025 * L, 0.034 * L)), 0.0025 * L)
        flat = ((0, 0, 1), 0.7)
        ds['fore'] = np.full(len(p), np.inf)
        ds['hind'] = np.full(len(p), np.inf)
        self.pivots = {}
        for sd in (-1, 1):
            # Fore legs reach forward and down mid-paddle: upper arm down, forearm forward.
            c, up, t, H, W = b.at(0.6)
            sh = c - up * H * 0.25 + np.array([0, 0, sd * W * 0.7])
            scap = ellipsoid(p, sh + up * H * 0.32, (0.09 * L, 0.11 * L, 0.055 * L))
            el = sh + np.array([0.02 * L, -0.15 * L, sd * 0.025 * L])
            wr = el + np.array([0.12 * L, -0.06 * L, sd * 0.012 * L])
            arm = chain(p, [sh, el], [0.066 * L, 0.04 * L], flat=flat)
            bulge = ellipsoid(p, sh + (el - sh) * 0.38 + np.array([-0.012 * L, 0, 0]), (0.05 * L, 0.07 * L, 0.045 * L))
            # The point of the elbow behind, the forearm thick below it and narrowing to the wrist.
            olecranon = ellipsoid(p, el + np.array([-0.022 * L, 0.004 * L, 0]), (0.026 * L, 0.024 * L, 0.024 * L))
            fore = chain(p, [el, wr], [0.038 * L, 0.022 * L], flat=flat)
            fbulge = ellipsoid(p, el + (wr - el) * 0.25, (0.042 * L, 0.034 * L, 0.034 * L))
            # Big, flat paws (the bear's paddles), toes turned slightly in, each toe its own pad.
            pc = wr + np.array([0.065 * L, -0.016 * L, -sd * 0.008 * L])
            paw = ellipsoid(p, pc, (0.08 * L, 0.014 * L, 0.066 * L))
            heel = ellipsoid(p, wr + np.array([0.01 * L, -0.006 * L, 0]), (0.03 * L, 0.02 * L, 0.04 * L))
            toes = [ellipsoid(p, pc + np.array([0.07 * L - 0.008 * abs(k) * L, -0.002 * L, k * 0.026 * L - sd * 0.006 * L]),
                              (0.016 * L, 0.011 * L, 0.012 * L)) for k in (-2, -1, 0, 1, 2)]
            limb = smin([scap, arm, bulge], 0.022 * L)
            lower = smin([olecranon, fore, fbulge], 0.012 * L)
            hand = smin([heel, paw], 0.01 * L)
            hand = smin([hand, *toes], 0.006 * L)
            ds['fore'] = np.minimum(ds['fore'], smin([smin([limb, lower], 0.014 * L), hand], 0.012 * L))
            self.pivots[('fore', sd)] = sh
            # Hind legs trail behind, thigh heavy, the sole turned back.
            c, up, t, H, W = b.at(0.2)
            hp = c - up * H * 0.2 + np.array([0, 0, sd * W * 0.68])
            haunch = ellipsoid(p, hp + np.array([0.01 * L, 0.035 * L, -sd * 0.01 * L]), (0.14 * L, 0.13 * L, 0.075 * L))
            kn = hp + np.array([-0.11 * L, -0.08 * L, sd * 0.02 * L])
            hk = kn + np.array([-0.13 * L, 0.0, sd * 0.01 * L])
            thigh = chain(p, [hp, kn], [0.085 * L, 0.05 * L], flat=flat)
            shin = chain(p, [kn, hk], [0.045 * L, 0.028 * L], flat=flat)
            calf = ellipsoid(p, kn + (hk - kn) * 0.3, (0.055 * L, 0.04 * L, 0.038 * L))
            heel = ellipsoid(p, hk + np.array([0.012 * L, 0.012 * L, 0]), (0.026 * L, 0.024 * L, 0.024 * L))
            fc = hk + np.array([-0.08 * L, 0.0, 0])
            foot = ellipsoid(p, fc, (0.088 * L, 0.016 * L, 0.058 * L))
            toes = [ellipsoid(p, fc + np.array([-0.075 * L + 0.008 * abs(k) * L, 0.0, k * 0.022 * L]),
                              (0.016 * L, 0.011 * L, 0.012 * L)) for k in (-2, -1, 0, 1, 2)]
            leg = smin([haunch, thigh], 0.024 * L)
            lower = smin([shin, calf, heel], 0.012 * L)
            sole = smin([foot, *toes], 0.006 * L)
            ds['hind'] = np.minimum(ds['hind'], smin([smin([leg, lower], 0.014 * L), sole], 0.012 * L))
            self.pivots[('hind', sd)] = hp
        c0 = b.c[0]
        ds['body'] = smin([ds['body'], ellipsoid(p, c0 - np.array([0.015 * L, -0.02 * L, 0]),
                                                 (0.035 * L, 0.026 * L, 0.028 * L))], 0.018 * L)
        return ds

    def colour(self, p, n, s, theta, yn, label):
        col = super().colour(p, n, s, theta, yn, label)
        # Fur that is not one cream: warmer and yellowed along the back and flanks, cooler on the
        # legs and belly, clumped (soft value breakup), darker in the skin creases.
        warm = np.array([1.0, 0.97, 0.9])
        cool = np.array([0.95, 0.97, 1.0])
        k = smooth(-0.3, 0.6, yn)
        col = col * (warm * k[:, None] + cool * (1 - k[:, None]))
        clumps = 0.06 * noise3(p, 18, 71) + 0.035 * noise3(p, 45, 72)
        return col * (1 + clumps)[:, None]


# ------------------------------------------------------------------ whale shark markings


class WhaleShark(sc.WhaleShark):
    """The Pass 078 anatomy; its checkerboard redrawn for the baked texture. At vertex resolution
    the pattern blurred into angular blotches; sampled crisply it showed as a ruled grid. Real
    whale sharks carry wavering pale lines, often broken into rows of dots, with round spots of
    differing size between them: the lattice is warped and broken by noise, the spots jittered."""

    def colour(self, p, n, s, theta, yn, label):
        L = self.length
        top = np.array([0.2, 0.28, 0.34])
        belly = np.array([0.88, 0.89, 0.88])
        k = smooth(-0.1, -0.5, yn)
        k = np.where((label != 'body') & (n[:, 1] < -0.4), np.maximum(k, 0.6), k)
        col = top * (1 - k[:, None]) + belly * k[:, None]
        pale = np.array([0.8, 0.84, 0.83])
        # The lattice, warped so its lines waver (about a quarter of a cell).
        u = p[:, 0] / (0.07 * L) * TAU + 1.6 * noise3(p, 4, 81)
        w = theta * 8 + 1.2 * noise3(p, 3.5, 82)
        wrap = lambda a: np.angle(np.exp(1j * a))  # noqa: E731
        # Thin lines, broken into dashes and dots in places.
        dash = smooth(-0.2, 0.35, noise3(p, 40, 83) + 0.6 * np.cos(u * 3.1))
        bar = smooth(0.94, 0.99, np.cos(u)) * (0.3 + 0.7 * dash)
        line = smooth(0.95, 0.99, np.cos(w)) * (0.4 + 0.6 * smooth(-0.3, 0.3, noise3(p, 30, 84)))
        # A round spot in each cell, off-centre and of its own size.
        du = wrap(u - math.pi + 0.5 * noise3(p, 9, 86))
        dw = wrap(w - math.pi + 0.5 * noise3(p, 9, 87))
        radius = 0.95 + 0.35 * noise3(p, 7, 85)
        cellspot = smooth(radius, radius * 0.72, np.hypot(du, dw))
        head = spots(p, 0.024 * L, 5, 0.26) * (s > 0.84)
        body = (s < 0.86) & (s > 0.12)
        mark = np.maximum(np.maximum(bar, line) * 0.75 * body, np.maximum(cellspot * body, head))
        mark = mark * smooth(-0.35, 0.0, yn)
        col = col * (1 - mark[:, None]) + pale * mark[:, None]
        col *= (1 + 0.04 * noise3(p, 12, 7))[:, None]
        return self.eye_paint(p, col, 0.004 * L)


# ------------------------------------------------------------------ build

SPECIES = {
    'minke-whale': (Minke, 'smooth', True),
    'sea-otter': (SeaOtter, 'fur', True),
    'polar-bear': (PolarBear, 'fur', True),
    'whale-shark': (WhaleShark, 'denticle', 'texture'),
    'eagle-ray': (c84.EagleRay, 'denticle', 'texture'),
    'manta-ray': (c84.Manta, 'denticle', True),
    'great-white-shark': (c84.GreatWhite, 'denticle', True),
    'reef-shark': (c84.ReefShark, 'denticle', True),
    'humpback-whale': (sc.Humpback, 'smooth', True),
}

if __name__ == '__main__':
    for name in (sys.argv[1:] or SPECIES):
        cls, kind, marks = SPECIES[name]
        # 'texture': the markings are baked into a texture (too many spot edges for the vertex
        # budget); True: they are refined in the mesh.
        build(name, cls(), kind, markings=marks is True, texture=marks == 'texture')
