"""Pass 016: author the remaining reef fish from the accepted Pass 012 chromis rig.

    python3 tools/art/pass016/fish.py   # Blender 5.1 Python module (`pip install bpy==5.1.2`)

The accepted chromis GLB (a verified lossless Blender roundtrip, including its Stroke_Left /
Stroke_Right morphs and pectoral pivots) is reshaped per species, so every fish keeps the exact
topology, morph contract and pivots the runtime drives:

  * per-vertex axis scaling to the species' length / body height / width (game units, +X forward),
    applied identically to the basis and both morph targets;
  * species anatomy: deep cardinalfish body and tall fins; slender firefish with a tall, swept dorsal
    pennant; truncate assessor tail; slim gramma; eyes scaled uniformly about their own centres;
  * object-space vertex-colour patterns and countershading over neutral (luminance-only) versions of
    the accepted chromis scale and fin-ray maps, which keep their UV-aligned normal and alpha detail.
"""
import math
import shutil
import sys
from pathlib import Path

import bpy  # noqa: I001 - bpy must load before bmesh-dependent addons
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
# Pinned uncompressed accepted chromis (public/ copies are Draco/WebP compressed since Pass 017).
SOURCE = ROOT / 'tools/art/pass017/accepted/chromis.glb'
TEX = ROOT / 'tools/art/textures/pass016'
OUT = ROOT / 'public/assets/models/fish'
CHROMIS = {'length': 0.46, 'height': 0.19, 'width': 0.09, 'tail_root': -0.17, 'snout': 0.205, 'half': 0.089}


def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def srgb_to_linear(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# ------------------------------------------------------------------ neutral maps


def neutral_maps():
    """Luminance-only versions of the accepted chromis base and fin maps (alpha kept)."""
    TEX.mkdir(parents=True, exist_ok=True)
    src = ROOT / 'tools/art/textures/fish'
    base = np.asarray(Image.open(src / 'chromis-base.png').convert('RGB'), float) / 255
    lum = base @ np.array([0.2126, 0.7152, 0.0722])
    lum = 0.82 + (lum - lum.mean()) / (lum.std() + 1e-6) * 0.06  # keep scale-edge detail, drop hue
    Image.fromarray(np.uint8(np.clip(np.stack([lum] * 3, -1), 0, 1) * 255)).save(TEX / 'fish-scales-base.png',
                                                                                    optimize=True)
    fins = np.asarray(Image.open(src / 'chromis-fins.png').convert('RGBA'), float) / 255
    flum = fins[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    flum = 0.86 + (flum - flum.mean()) / (flum.std() + 1e-6) * 0.08
    out = np.concatenate([np.stack([np.clip(flum, 0, 1)] * 3, -1), fins[..., 3:]], -1)
    Image.fromarray(np.uint8(out * 255)).save(TEX / 'fin-rays.png', optimize=True)


# ------------------------------------------------------------------ coordinates (game space)


def to_game(co):
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)


def to_blender(p):
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], 1)


def coords(data, n):
    a = np.empty(n * 3)
    data.foreach_get('co', a)
    return to_game(a.reshape(-1, 3))


def set_coords(data, p):
    data.foreach_set('co', to_blender(p).ravel())


def world_offset(obj):
    """Pectorals carry a pivot translation; body parts have none."""
    return to_game(np.array([tuple(obj.location)]))[0]


# ------------------------------------------------------------------ species


SPECIES = {
    'cardinalfish': dict(id='pajama-cardinalfish', name='Cardinalfish', length=0.62, height=0.34, width=0.125,
                         eye=1.45, iris=(0.86, 0.22, 0.10), fin_height=1.25),
    'firefish': dict(id='firefish-goby', name='Firefish', length=0.85, height=0.13, width=0.11,
                     eye=1.0, iris=(0.95, 0.62, 0.20), pennant=7.0),
    'assessor': dict(id='yellow-assessor', name='Assessor', length=0.64, height=0.23, width=0.14,
                     eye=1.05, iris=(0.30, 0.42, 0.62), rounded=True),
    'gramma': dict(id='royal-gramma', name='Gramma', length=0.72, height=0.24, width=0.15,
                   eye=1.05, iris=(0.15, 0.13, 0.12)),
}


def factors(p, spec, fin):
    """Per-vertex (basis-derived) affine map: returns scale (n,3) and shift (n,3) in game space."""
    sx = spec['length'] / CHROMIS['length']
    sy = spec['height'] / CHROMIS['height']
    sz = spec['width'] / CHROMIS['width']
    n = len(p)
    scale = np.tile([sx, sy, sz], (n, 1)).astype(float)
    shift = np.zeros((n, 3))
    if fin:
        top = CHROMIS['half'] * 0.82
        above = np.abs(p[:, 1]) > top
        if 'fin_height' in spec:  # taller dorsal/anal fins beyond the body outline
            extra = spec['fin_height']
            scale[above, 1] *= extra
            shift[above, 1] -= np.sign(p[above, 1]) * top * sy * (extra - 1)
        if 'pennant' in spec:
            # First dorsal: a tall, swept-back pennant from the front of the dorsal fin.
            w = smoothstep(0.0, 0.035, p[:, 0]) * (1 - smoothstep(0.06, 0.09, p[:, 0])) * (p[:, 1] > top)
            k = 1 + (spec['pennant'] - 1) * w
            scale[:, 1] *= k
            shift[:, 1] -= top * sy * (k - 1) * (p[:, 1] > top)
            # The backward sweep of the pennant tip is a shear applied in apply().
        if spec.get('rounded'):
            # Pull the forked lobes toward the tail root: a truncate / rounded caudal outline.
            tail = p[:, 0] < CHROMIS['tail_root']
            pull = np.where(tail, 1 - 0.45 * np.clip(np.abs(p[:, 1]) / 0.11, 0, 1) ** 2, 1.0)
            shift[:, 0] += CHROMIS['tail_root'] * scale[:, 0] * (1 - pull)
            scale[:, 0] *= pull
    return scale, shift


def apply(points, basis, spec, fin):
    scale, shift = factors(basis, spec, fin)
    out = points * scale + shift
    if fin and 'pennant' in spec:
        top = CHROMIS['half'] * 0.82 * spec['height'] / CHROMIS['height']
        h = np.maximum(out[:, 1] - top, 0)
        out[:, 0] -= h * 0.45
    return out


def pattern(name, p, fin):
    """Species colour in chromis-normalised space: u along body (0 tail -> 1 snout), v height."""
    u = (p[:, 0] + 0.255) / CHROMIS['length']
    v = p[:, 1] / CHROMIS['half']
    n = len(p)
    if name == 'cardinalfish':
        head = np.array([0.80, 0.74, 0.44])
        bar = np.array([0.15, 0.12, 0.09])
        rear = np.array([0.92, 0.90, 0.84])
        col = np.where(u[:, None] > 0.66, head, rear)
        b = smoothstep(0.50, 0.53, u) * (1 - smoothstep(0.64, 0.67, u))
        col = col * (1 - b[:, None]) + bar * b[:, None]
        cells = cKDTree(np.random.default_rng(1601).random((90, 2)) * [0.4, 0.26] + [-0.2, -0.13])
        d, _ = cells.query(p[:, :2])
        spot = smoothstep(0.011, 0.006, d) * (u < 0.5)
        col = col * (1 - spot[:, None]) + np.array([0.80, 0.34, 0.18]) * spot[:, None]
        if fin:
            col = col * 0.9 + 0.1
    elif name == 'firefish':
        head = np.array([0.98, 0.86, 0.48])
        cream = np.array([0.96, 0.94, 0.90])
        red = np.array([0.94, 0.40, 0.16])
        crimson = np.array([0.66, 0.10, 0.16])
        col = np.where(u[:, None] > 0.74, head, cream)
        t = 1 - smoothstep(0.18, 0.48, u)
        col = col * (1 - t[:, None]) + red * t[:, None]
        t2 = 1 - smoothstep(0.02, 0.22, u)
        col = col * (1 - t2[:, None]) + crimson * t2[:, None]
        if fin:
            edge = smoothstep(1.2, 1.9, np.abs(v)) * (u < 0.55)
            col = col * (1 - edge[:, None] * 0.7) + np.array([0.30, 0.06, 0.10]) * edge[:, None] * 0.7
            pennant = (u > 0.5) * (v > 1.0)
            tip = smoothstep(2.6, 3.6, v) * pennant
            col = np.where(pennant[:, None], cream * (1 - tip[:, None]) + np.array([0.90, 0.30, 0.20]) * tip[:, None], col)
    elif name == 'assessor':
        col = np.tile([0.99, 0.80, 0.10], (n, 1))
        belly = smoothstep(-0.2, -0.9, v)
        col = col * (1 - belly[:, None] * 0.4) + np.array([0.99, 0.92, 0.50]) * belly[:, None] * 0.4
        if fin:
            edge = smoothstep(1.3, 2.0, np.abs(v))
            col = col * (1 - edge[:, None] * 0.4) + np.array([0.98, 0.62, 0.10]) * edge[:, None] * 0.4
    else:  # gramma
        violet = np.array([0.64, 0.20, 0.74])
        gold = np.array([0.99, 0.76, 0.08])
        t = smoothstep(0.43, 0.55, u)
        col = gold * (1 - t[:, None]) + violet * t[:, None]
        # Black line from the snout through the eye.
        a, b = np.array([0.205, 0.01]), np.array([0.09, 0.045])
        ab = b - a
        h = np.clip(((p[:, :2] - a) @ ab) / (ab @ ab), 0, 1.25)
        dist = np.linalg.norm(p[:, :2] - (a + h[:, None] * ab), axis=1)
        line = smoothstep(0.0075, 0.004, dist) * (np.abs(p[:, 2]) > 0.006)
        col = col * (1 - line[:, None]) + np.array([0.05, 0.04, 0.06]) * line[:, None]
        if fin:
            spot = smoothstep(0.03, 0.015, np.hypot(p[:, 0] - 0.07, (p[:, 1] - 0.115) * 0.6)) * (v > 1)
            col = col * (1 - spot[:, None]) + np.array([0.06, 0.05, 0.08]) * spot[:, None]
    # Countershading on the body: darker back, paler belly.
    if not fin:
        back = smoothstep(0.3, 1.0, v)
        col = col * (1 - back[:, None] * 0.18)
        belly = smoothstep(-0.3, -1.0, v)
        col = col * (1 - belly[:, None] * 0.12) + belly[:, None] * 0.12
    return np.clip(col, 0, 1)


def paint(me, rgb):
    for attr in list(me.color_attributes):
        me.color_attributes.remove(attr)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', np.concatenate([srgb_to_linear(rgb), np.ones((len(rgb), 1))], 1).ravel())
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = 0


def retint(material, name, image):
    """Swap the accepted map for its neutral version and multiply by vertex colour."""
    m = material.copy()
    m.name = name
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    tex = next(n for n in nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name.split('.')[0].endswith(
        ('-base', '-fins')))
    tex.image = bpy.data.images.load(str(TEX / image), check_existing=True)
    vc = nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    links.new(tex.outputs['Color'], mix.inputs[6])
    links.new(vc.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    return m


def build(key):
    spec = SPECIES[key]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objs = {o.name: o for o in bpy.context.scene.objects}
    root = objs['Chromis_Root']
    root.name = f"{spec['name']}_Root"
    root['species'] = spec['id']
    sx = spec['length'] / CHROMIS['length']
    sy = spec['height'] / CHROMIS['height']
    sz = spec['width'] / CHROMIS['width']
    eye_scale = (sx * sy * sz) ** (1 / 3) * spec['eye']
    for name in ('Body', 'Median_Fins', 'Eyes_Gills_Mouth'):
        obj = objs[name]
        me = obj.data
        fin = name == 'Median_Fins'
        basis = coords(me.vertices, len(me.vertices))
        if name == 'Eyes_Gills_Mouth':
            mats = [m.name.split('.')[0] if m else '' for m in me.materials]
            eye = np.zeros(len(basis), bool)
            for poly in me.polygons:
                if mats[poly.material_index] in ('Iris', 'Pupil'):
                    eye[list(poly.vertices)] = True
            moved = apply(basis, basis, spec, False)
            for side in (-1, 1):
                sel = eye & (np.sign(basis[:, 2]) == side)
                if sel.any():
                    c = basis[sel].mean(0)
                    c2 = apply(c[None], c[None], spec, False)[0]
                    moved[sel] = c2 + (basis[sel] - c) * eye_scale
            set_coords(me.vertices, moved)
        else:
            if me.shape_keys:
                for kb in me.shape_keys.key_blocks:
                    kp = coords(kb.data, len(kb.data))
                    set_coords(kb.data, apply(kp, basis, spec, fin))
            set_coords(me.vertices, apply(basis, basis, spec, fin))
        me.update()
        paint(me, pattern(key, basis, fin))
    for name in ('Pectoral_Left', 'Pectoral_Right'):
        obj = objs[name]
        pivot = world_offset(obj)
        new_pivot = apply(pivot[None], pivot[None], spec, False)[0]
        obj.location = tuple(to_blender(new_pivot[None])[0])
        me = obj.data
        local = coords(me.vertices, len(me.vertices))
        set_coords(me.vertices, local * np.array([sx, (sy + 1) / 2, sz]) * (1.15 if key == 'firefish' else 1.0))
        me.update()
        paint(me, pattern(key, local + pivot, True))
    # Materials: neutral accepted maps, species colour from vertex colour; iris tint per species.
    skin = fins = None
    for mat in list(bpy.data.materials):
        base = mat.name.split('.')[0]
        if base == 'Chromis_Scale_Skin':
            skin = retint(mat, f"{spec['name']}_Scale_Skin", 'fish-scales-base.png')
        elif base == 'Chromis_Fin_Membrane':
            fins = retint(mat, f"{spec['name']}_Fin_Membrane", 'fin-rays.png')
        elif base == 'Iris':
            mat.name = f"{spec['name']}_Iris"
            bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Base Color'].default_value = (*srgb_to_linear(spec['iris']), 1)
            for link in list(bsdf.inputs['Base Color'].links):
                mat.node_tree.links.remove(link)
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for i, slot in enumerate(obj.material_slots):
            nm = slot.material.name.split('.')[0] if slot.material else ''
            if nm == 'Chromis_Scale_Skin':
                obj.data.materials[i] = skin
            elif nm == 'Chromis_Fin_Membrane':
                obj.data.materials[i] = fins
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / f'{key}.blend'), compress=True)
    out = OUT / f'{key}.glb'
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE')
    print('exported', out, out.stat().st_size)


if __name__ == '__main__':
    neutral_maps()
    for k in (sys.argv[1:] or SPECIES):
        build(k)
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
