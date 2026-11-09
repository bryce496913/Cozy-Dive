"""Pass 015: re-author the accepted Pass 013 anchored creatures to the Pass 014 rock/sand standard.

    python3 tools/art/pass015/textures.py
    python3 tools/art/pass015/creatures.py   # Blender 5.1 Python module (`pip install bpy==5.1.2`)

The accepted `anchored-life.glb` is imported unchanged (a verified lossless roundtrip), so every
controller-local frame, pivot, node name and the moray's UV.v centreline parameter is preserved.
Each skin mesh then gains:
  * denser topology where needed (simple subdivision: no shape change);
  * shallow authored surface relief along the normal (frogfish warts, seahorse body rings and
    tubercles, moray skin folds, anemone bubble tips) - never more than a few millimetres;
  * continuous object-space colour pattern and cavity/underside occlusion in vertex colour
    (spans joined parts without UV seams, as on the reef rocks);
  * new skin materials with the Pass 015 micro-detail maps.
Coordinates below are game space (X right, Y up, Z front); Blender stores Z-up.
"""
import math
import sys
from pathlib import Path

import bpy  # noqa: I001 - bpy must load before bmesh
import bmesh
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TEX = ROOT / 'public/assets/textures/pass015'
SOURCE = HERE / 'anchored-life.pass013.glb'  # accepted Pass 013 export, the pinned input
OUT = ROOT / 'public/assets/models/creatures/anchored-life.glb'
TAU = math.tau


def srgb_to_linear(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


class Waves:
    def __init__(self, seed, count=24, base=2.0, octaves=3):
        r = np.random.default_rng(seed)
        d = r.standard_normal((count * octaves, 3))
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        f = np.repeat(base * 2.0 ** np.arange(octaves), count) * (0.75 + r.random(count * octaves) * 0.5)
        self.k = d * f[:, None]
        self.phase = r.random(count * octaves) * TAU
        self.amp = np.repeat(0.5 ** np.arange(octaves), count) / math.sqrt(count)

    def __call__(self, p):
        return (np.sin(p @ self.k.T + self.phase) * self.amp).sum(1)


def worley(p, cell, seed):
    """3D cellular noise: (distance to nearest, second nearest) feature point, in world units."""
    r = np.random.default_rng(seed)
    lo, hi = p.min(0) - cell * 2, p.max(0) + cell * 2
    n = int(np.prod(np.ceil((hi - lo) / cell)))
    pts = lo + r.random((max(n, 8), 3)) * (hi - lo)
    d, _ = cKDTree(pts).query(p, k=2)
    return d[:, 0], d[:, 1]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- mesh access (game space)


def game_positions(me):
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)


def set_game_positions(me, p):
    co = np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1)
    me.vertices.foreach_set('co', co.ravel())
    me.update()


def game_normals(me):
    n = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('normal', n)
    n = n.reshape(-1, 3)
    return np.stack([n[:, 0], n[:, 2], -n[:, 1]], 1)


def vertex_uv(me):
    """Average loop UV per vertex (pass013 tube/sphere islands: u around, v along)."""
    uv = np.zeros((len(me.vertices), 2))
    count = np.zeros(len(me.vertices))
    data = me.uv_layers[0].data
    loops = np.empty(len(me.loops), int)
    me.loops.foreach_get('vertex_index', loops)
    raw = np.empty(len(me.loops) * 2)
    data.foreach_get('uv', raw)
    raw = raw.reshape(-1, 2)
    np.add.at(uv, loops, raw)
    np.add.at(count, loops, 1)
    return uv / np.maximum(count, 1)[:, None]


def edges(me):
    e = np.empty(len(me.edges) * 2, int)
    me.edges.foreach_get('vertices', e)
    return e.reshape(-1, 2)


def cavity(me, p, iterations=3):
    """Concavity from a Laplacian-smoothed position: positive in grooves and pits."""
    e = edges(me)
    n = len(p)
    adj = coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), (n, n)).tocsr()
    deg = np.maximum(np.asarray(adj.sum(1)).ravel(), 1)
    s = p.copy()
    for _ in range(iterations):
        s = 0.5 * s + 0.5 * (adj @ s) / deg[:, None]
    nrm = game_normals(me)
    return ((s - p) * nrm).sum(1)


def subdivide(obj, cuts=1):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def write_colors(me, rgb):
    for attr in list(me.color_attributes):
        me.color_attributes.remove(attr)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    lin = srgb_to_linear(np.clip(rgb, 0, 1))
    col.data.foreach_set('color', np.concatenate([lin, np.ones((len(lin), 1))], 1).ravel())
    me.color_attributes.active_color = col
    me.color_attributes.render_color_index = 0


def displace(me, amount):
    p = game_positions(me)
    set_game_positions(me, p + game_normals(me) * amount[:, None])


# ---------------------------------------------------------------- materials


def skin_material(name, texture, roughness, normal_strength, tiling=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = False
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    p = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(p.outputs['BSDF'], out.inputs['Surface'])
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = 0
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (tiling, tiling, 1)
    links.new(coord.outputs['UV'], mapping.inputs['Vector'])
    vc = nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    images = {}
    for channel in ('base', 'normal', 'orm'):
        node = nodes.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(TEX / f'{texture}-{channel}.png'), check_existing=True)
        if channel != 'base':
            node.image.colorspace_settings.name = 'Non-Color'
        links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        images[channel] = node
    links.new(images['base'].outputs['Color'], mix.inputs[6])
    links.new(vc.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], p.inputs['Base Color'])
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = normal_strength
    links.new(images['normal'].outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], p.inputs['Normal'])
    sep = nodes.new('ShaderNodeSeparateColor')
    links.new(images['orm'].outputs['Color'], sep.inputs['Color'])
    links.new(sep.outputs['Green'], p.inputs['Roughness'])
    links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    return m


def assign(obj, old_name, new_material):
    for i, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name.split('.')[0] == old_name:
            obj.data.materials[i] = new_material


def faces_with_material(me, material_name):
    """Vertex mask of faces using a given material (joined meshes keep eyes/mouth separate)."""
    names = [m.name.split('.')[0] if m else '' for m in me.materials]
    mask = np.zeros(len(me.vertices), bool)
    for poly in me.polygons:
        if names[poly.material_index] == material_name:
            mask[list(poly.vertices)] = True
    return mask


# ---------------------------------------------------------------- creatures


def frogfish(objects, skin):
    body = objects['FrogBody']
    for obj in (body, objects['FrogFoot'], objects['FrogLure']):
        me = obj.data
        mask = faces_with_material(me, 'FrogSkin')
        p = game_positions(me)
        n = game_normals(me)
        d1, d2 = worley(p, 0.045, 1501)
        wart = np.clip(1 - d1 / 0.03, 0, 1) ** 1.6
        dorsal = smoothstep(-0.4, 0.2, n[:, 1])
        amount = wart * 0.007 * dorsal * mask
        if obj is body:
            amount *= smoothstep(0.03, 0.09, p[:, 1])  # keep the seated underside on the deck
        displace(me, amount)
        p = game_positions(me)
        # Warty frogfish: ochre-orange ground, darker rust blotches, small dark ocelli, paler belly
        # and lips, wart tips lighter; cavity and underside occlusion.
        ground = np.array([0.86, 0.60, 0.26])
        blotch_field = Waves(1511, 18, 9.0, 2)(p)
        blotch = smoothstep(0.15, 0.45, blotch_field)
        rust = np.array([0.56, 0.30, 0.14])
        col = ground * (1 - blotch[:, None] * 0.7) + rust * blotch[:, None] * 0.7
        o1, _ = worley(p, 0.08, 1521)
        ocelli = np.clip(1 - o1 / 0.012, 0, 1)
        col = col * (1 - ocelli[:, None] * 0.75) + np.array([0.18, 0.10, 0.06]) * ocelli[:, None] * 0.75
        belly = smoothstep(0.1, -0.6, game_normals(me)[:, 1])
        col = col * (1 - belly[:, None] * 0.35) + np.array([0.95, 0.84, 0.62]) * belly[:, None] * 0.35
        col = col * (1 + wart[:, None] * 0.12)
        cav = np.clip(cavity(me, p) / 0.006, 0, 1)
        col *= (1 - cav * 0.45)[:, None]
        col *= (0.7 + 0.3 * smoothstep(0.0, 0.25, p[:, 1]))[:, None]
        write_colors(me, np.where(mask[:, None], col, 1.0))
        assign(obj, 'FrogSkin', skin)


def seahorse(objects, skin):
    for name in ('HorseBody', 'HorseTail'):
        obj = objects[name]
        if name == 'HorseTail':
            subdivide(obj)
        me = obj.data
        mask = faces_with_material(me, 'HorseSkin')
        p = game_positions(me)
        uv = vertex_uv(me)
        # Bony rings: along the trunk height, along the tail tube (uv.v runs base -> tip).
        along = uv[:, 1] * 26 if name == 'HorseTail' else p[:, 1] / 0.034
        ring = np.cos(along * TAU)
        ridge = smoothstep(0.55, 1.0, ring)
        around = uv[:, 0] * TAU * (4 if name == 'HorseBody' else 4)
        tubercle = ridge * smoothstep(0.75, 1.0, np.cos(around))
        head = smoothstep(0.92, 1.0, p[:, 1]) if name == 'HorseBody' else 0
        amount = (ridge * 0.0045 + tubercle * 0.006) * (1 - head) * mask
        displace(me, amount)
        p = game_positions(me)
        # Yellow-olive ground, irregular dark saddles, white speckle, paler snout and belly.
        ground = np.array([0.80, 0.70, 0.30])
        saddle = smoothstep(0.2, 0.55, Waves(1601, 14, 7.0, 2)(p + np.array([0, 0, 0.3])))
        col = ground * (1 - saddle[:, None] * 0.75) + np.array([0.34, 0.27, 0.10]) * saddle[:, None] * 0.75
        s1, _ = worley(p, 0.02, 1611)
        speck = np.clip(1 - s1 / 0.006, 0, 1)
        col = col * (1 - speck[:, None] * 0.8) + np.array([0.98, 0.96, 0.88]) * speck[:, None] * 0.8
        col = col * (1 + tubercle[:, None] * 0.25)
        groove = smoothstep(-0.2, -0.9, ring)  # dark seams between bony rings
        col *= (1 - groove * 0.35)[:, None]
        cav = np.clip(cavity(me, p) / 0.003, 0, 1)
        col *= (1 - cav * 0.5)[:, None]
        write_colors(me, np.where(mask[:, None], col, 1.0))
        assign(obj, 'HorseSkin', skin)


def honeycomb(p, cell, seed):
    d1, d2 = worley(p, cell, seed)
    return np.exp(-((d2 - d1) / (cell * 0.12)) ** 2), d1


def moray(objects, skin):
    for name in ('MorayBody', 'MorayDorsal', 'MorayHead', 'MorayJaw'):
        obj = objects[name]
        if name == 'MorayBody':
            subdivide(obj)
        me = obj.data
        mask = faces_with_material(me, 'MoraySkin')
        p = game_positions(me)
        uv = vertex_uv(me)
        # The body/dorsal pattern space is the runtime's own (x, y, t * 2.6); head and jaw sit at
        # the front of the same field so the reticulation continues past the gill opening.
        if name in ('MorayBody', 'MorayDorsal'):
            q = np.stack([p[:, 0], p[:, 1], uv[:, 1] * 2.6], 1)
        else:
            q = p * np.array([1, 1, 1]) + np.array([0, 0, 2.6])
        if name == 'MorayBody':
            fold = 0.5 + 0.5 * np.sin(q[:, 2] * 120 + Waves(1701, 8, 3.0, 1)(q) * 2)
            displace(me, fold * 0.0018 * mask)
            p = game_positions(me)
        net, _ = honeycomb(q, 0.075, 1711)
        ground = np.array([0.88, 0.80, 0.50])
        ground = ground * (0.9 + 0.1 * Waves(1721, 10, 4.0, 1)(q))[:, None]
        col = ground * (1 - net[:, None] * 0.88) + np.array([0.20, 0.14, 0.08]) * net[:, None] * 0.88
        belly = smoothstep(0.0, -0.8, game_normals(me)[:, 1])
        col = col * (1 - belly[:, None] * 0.25) + np.array([0.86, 0.82, 0.64]) * belly[:, None] * 0.25
        cav = np.clip(cavity(me, p) / 0.003, 0, 1)
        col *= (1 - cav * 0.4)[:, None]
        write_colors(me, np.where(mask[:, None], col, 1.0))
        assign(obj, 'MoraySkin', skin)


def anemone(objects, skin):
    obj = objects['AnemoneTissue']
    me = obj.data
    p = game_positions(me)
    e = edges(me)
    n = len(p)
    graph = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), (n, n))
    count, label = connected_components(graph, directed=False)
    # Per-island "along tentacle" parameter from the lowest to the highest point of each tentacle.
    along = np.zeros(n)
    tentacle = np.zeros(n, bool)
    for k in range(count):
        idx = np.where(label == k)[0]
        y0, y1 = p[idx, 1].min(), p[idx, 1].max()
        extent = np.ptp(p[idx][:, [0, 2]], axis=0).max() if len(idx) > 1 else 0
        if len(idx) < 4000 and y1 - y0 > 0.12 and extent < 0.5:
            far = np.linalg.norm(p[idx] - p[idx][p[idx, 1].argmin()], axis=1)
            along[idx] = far / max(far.max(), 1e-6)
            tentacle[idx] = True
    # Bubble-tip anemone: subterminal constriction and swollen tip on each tentacle.
    bulb = smoothstep(0.72, 0.9, along) * (1 - smoothstep(0.96, 1.0, along))
    neck = np.exp(-((along - 0.7) / 0.04) ** 2)
    displace(me, (bulb * 0.009 - neck * 0.004) * tentacle)
    p = game_positions(me)
    col = np.zeros((n, 3))
    stem = np.array([0.62, 0.56, 0.40]) * (1 - along[:, None] * 0.2) + np.array([0.76, 0.62, 0.50]) * along[:, None] * 0.2
    band = np.exp(-((along - 0.78) / 0.05) ** 2)
    tip = smoothstep(0.82, 0.95, along)
    tcol = stem * (1 - band[:, None]) + np.array([0.96, 0.92, 0.86]) * band[:, None]
    tcol = tcol * (1 - tip[:, None]) + np.array([0.82, 0.40, 0.58]) * tip[:, None]
    # Oral disc / column: radial stripes from the mouth, orange-tan column with verrucae.
    ang = np.arctan2(p[:, 2], p[:, 0])
    rad = np.hypot(p[:, 0], p[:, 2])
    stripes = 0.5 + 0.5 * np.cos(ang * 24)
    disc = np.array([0.58, 0.50, 0.38]) * (0.85 + 0.15 * stripes[:, None])
    mouth = np.exp(-(rad / 0.06) ** 2)
    disc = disc * (1 - mouth[:, None]) + np.array([0.74, 0.44, 0.38]) * mouth[:, None]
    col = np.where(tentacle[:, None], tcol, disc)
    cav = np.clip(cavity(me, p) / 0.004, 0, 1)
    col *= (1 - cav * 0.35)[:, None]
    col *= (0.65 + 0.35 * smoothstep(0.0, 0.35, p[:, 1]))[:, None]
    write_colors(me, col)
    assign(obj, 'AnemoneTissue', skin)
    return int(tentacle.sum()), count


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects = {o.name: o for o in bpy.context.scene.objects}
    frogfish(objects, skin_material('FrogSkin15', 'frog-skin', 0.7, 0.9, 2.0))
    seahorse(objects, skin_material('HorseSkin15', 'bony-plate', 0.6, 0.8, 3.0))
    moray(objects, skin_material('MoraySkin15', 'eel-skin', 0.4, 0.7, 3.0))
    tentacles, islands = anemone(objects, skin_material('AnemoneTissue15', 'tentacle', 0.35, 0.6, 1.0))
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'anchored-life.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE')
    print('exported', OUT, OUT.stat().st_size, 'anemone tentacle vertices', tentacles, 'islands', islands)


if __name__ == '__main__':
    build()
