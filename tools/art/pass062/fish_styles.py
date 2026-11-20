"""Pass 062: chromis and clownfish for the two benchmark treatments.

    python3 tools/art/pass062/fish_styles.py   # Blender 5.1 Python module

Both treatments start from the pinned accepted rigs (tools/art/pass017/accepted), so topology,
the Stroke_Left / Stroke_Right morph contract and the pectoral pivots are unchanged, and both keep
the accepted UV-painted skins (whose crisp clownfish bars vertex colour cannot match). They differ
only in deliberate choices:

  natural (A)  accepted anatomy unchanged; a naturalistic grade of the shipped maps (less
               saturated, slightly darker, Chromis shifted toward its real apple-green, faint
               mottling) with full-strength scale normals and a rougher, less glossy skin.
  crafted (B)  subtly appealing proportions (body 4 % deeper, eyes 12 % larger, median fins 6 %
               taller, pectorals 8 % larger) that stay anatomically correct; a clean grade (noise
               smoothed, colour fields evened, controlled saturation) with softened normals at 60 %,
               so the skin reads as detailed but calm.

Writes tools/art/pass062/<style>-<fish>.blend, tools/art/pass062/out/<style>-<fish>.glb and a
copy in src/benchmark/style/assets/. Neutral maps for B are written to tools/art/textures/pass062.
"""
import shutil
import sys
from pathlib import Path

import bpy  # noqa: I001
import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCES = {'chromis': ROOT / 'tools/art/pass017/accepted/chromis.glb',
           'clownfish': ROOT / 'tools/art/pass017/accepted/clownfish.glb'}
TEX = ROOT / 'tools/art/textures/pass062'
OUT = ROOT / 'src/benchmark/style/assets'
RAW = HERE / 'out'
STYLES = ('natural', 'crafted')


def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def srgb_to_linear(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


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


def rgb_to_hsv(a):
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn + 1e-9
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return np.stack([h, np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0), mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] * 6, hsv[..., 1], hsv[..., 2]
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    table = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate(table):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


SOURCE_MAPS = {
    'chromis': ROOT / 'tools/art/textures/fish/chromis',
    'clownfish': ROOT / 'tools/art/textures/pass013/clown',
}


def grade(fish: str, style: str):
    """Write p062-<style>-<fish>-{base,fins}.png (and a softened normal for B)."""
    TEX.mkdir(parents=True, exist_ok=True)
    src = SOURCE_MAPS[fish]
    rng = np.random.default_rng(6206)
    for part in ('base', 'fins'):
        im = Image.open(f'{src}-{part}.png')
        alpha = np.asarray(im.convert('RGBA'), float)[..., 3:] / 255 if im.mode == 'RGBA' else None
        rgb = im.convert('RGB')
        if style == 'crafted':
            rgb = rgb.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
        a = np.asarray(rgb, float) / 255
        hsv = rgb_to_hsv(a)
        if style == 'natural':
            if fish == 'chromis':
                hsv[..., 0] = (hsv[..., 0] - 0.035) % 1  # blue -> apple-green blue
            hsv[..., 1] *= 0.82
            hsv[..., 2] *= 0.94
            n = Image.fromarray(np.uint8(rng.random(a.shape[:2]) * 255)).filter(ImageFilter.GaussianBlur(3))
            hsv[..., 2] *= 0.97 + (np.asarray(n, float) / 255 - 0.5) * 0.25
        else:
            if fish == 'chromis':
                hsv[..., 0] = (hsv[..., 0] - 0.02) % 1  # toward a clean teal
            hsv[..., 1] = np.clip(hsv[..., 1] * 1.04, 0, 0.92)
            # Even the colour fields: pull value toward a broad local mean (calmer, less noisy).
            v = Image.fromarray(np.uint8(np.clip(hsv[..., 2], 0, 1) * 255)).filter(ImageFilter.GaussianBlur(4))
            hsv[..., 2] = hsv[..., 2] * 0.75 + np.asarray(v, float) / 255 * 0.25 + 0.02
        out = np.clip(hsv_to_rgb(np.clip(hsv, 0, 1)), 0, 1)
        if alpha is not None:
            out = np.concatenate([out, alpha], -1)
        Image.fromarray(np.uint8(out * 255 + 0.5)).save(TEX / f'p062-{style}-{fish}-{part}.png', optimize=True)
    if style == 'crafted':
        normal = Image.open(f'{src}-normal.png').convert('RGB')
        nn = np.asarray(normal.filter(ImageFilter.GaussianBlur(1.2)), float) / 255 * 2 - 1
        nn[..., :2] *= 0.6
        nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
        Image.fromarray(np.uint8((nn * 0.5 + 0.5) * 255)).save(TEX / f'p062-crafted-{fish}-normal.png',
                                                                optimize=True)


def retint(material, name, base_image, normal_image=None, normal_strength=1.0, roughness_scale=1.0):
    """Swap the accepted base/fin map (and optionally the normal map) for the graded version."""
    m = material.copy()
    m.name = name
    nodes = m.node_tree.nodes
    for n in nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            stem = n.image.name.split('.')[0]
            if stem.endswith(('-base', '-fins')):
                n.image = bpy.data.images.load(str(base_image), check_existing=True)
            elif normal_image and stem.endswith('-normal'):
                img = bpy.data.images.load(str(normal_image), check_existing=True)
                img.colorspace_settings.name = 'Non-Color'
                n.image = img
        if n.type == 'NORMAL_MAP':
            n.inputs['Strength'].default_value = normal_strength
        if n.type == 'BSDF_PRINCIPLED' and not n.inputs['Roughness'].links:
            n.inputs['Roughness'].default_value = min(1.0, n.inputs['Roughness'].default_value * roughness_scale)
    return m


def eye_mask(me):
    mats = [m.name.split('.')[0] if m else '' for m in me.materials]
    mask = np.zeros(len(me.vertices), bool)
    for poly in me.polygons:
        if mats[poly.material_index] in ('Iris', 'Pupil'):
            mask[list(poly.vertices)] = True
    return mask


def build(fish: str, style: str):
    natural = style == 'natural'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCES[fish]))
    objs = {o.name: o for o in bpy.context.scene.objects}
    label = f'{style.capitalize()}_{fish.capitalize()}'
    root = next(o for o in objs.values() if o.name.endswith('_Root'))
    root.name = f'{label}_Root'
    root['treatment'] = style
    body = coords(objs['Body'].data.vertices, len(objs['Body'].data.vertices))
    frame = ((body[:, 0].min(), body[:, 0].max()), ((body[:, 1].max() + body[:, 1].min()) / 2,
                                                   (body[:, 1].max() - body[:, 1].min()) / 2))
    yc = frame[1][0]
    deepen = 1.0 if natural else 1.04
    fin_lift = 1.0 if natural else 1.06

    def reshape(points, fin):
        out = points.copy()
        out[:, 1] = yc + (out[:, 1] - yc) * deepen
        if fin:
            outside = np.abs(points[:, 1] - yc) > frame[1][1] * 0.8
            out[outside, 1] = yc + (out[outside, 1] - yc) * fin_lift
        return out

    for name in ('Body', 'Median_Fins', 'Eyes_Gills_Mouth'):
        me = objs[name].data
        fin = name == 'Median_Fins'
        basis = coords(me.vertices, len(me.vertices))
        if name == 'Eyes_Gills_Mouth':
            moved = reshape(basis, False)
            if not natural:
                eye = eye_mask(me)
                for side in (-1, 1):
                    sel = eye & (np.sign(basis[:, 2]) == side)
                    if sel.any():
                        c = basis[sel].mean(0)
                        moved[sel] = reshape(c[None], False)[0] + (basis[sel] - c) * 1.12
            set_coords(me.vertices, moved)
        else:
            if me.shape_keys:
                for kb in me.shape_keys.key_blocks:
                    kp = coords(kb.data, len(kb.data))
                    set_coords(kb.data, kp + (reshape(basis, fin) - basis))
            set_coords(me.vertices, reshape(basis, fin))
        me.update()
    for name in ('Pectoral_Left', 'Pectoral_Right'):
        obj = objs[name]
        me = obj.data
        local = coords(me.vertices, len(me.vertices))
        if not natural:
            set_coords(me.vertices, local * 1.08)
            me.update()
    grade(fish, style)
    skin_img = TEX / f'p062-{style}-{fish}-base.png'
    fin_img = TEX / f'p062-{style}-{fish}-fins.png'
    normal_img = None if natural else TEX / f'p062-crafted-{fish}-normal.png'
    swap = {}
    for mat in list(bpy.data.materials):
        base = mat.name.split('.')[0]
        if base.endswith('_Scale_Skin'):
            swap[base] = retint(mat, f'{label}_Scale_Skin', skin_img, normal_img, 1.0 if natural else 0.6,
                                1.15 if natural else 0.95)
        elif base.endswith('_Fin_Membrane'):
            swap[base] = retint(mat, f'{label}_Fin_Membrane', fin_img)
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for i, slot in enumerate(obj.material_slots):
            nm = slot.material.name.split('.')[0] if slot.material else ''
            if nm in swap:
                obj.data.materials[i] = swap[nm]
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / f'{style}-{fish}.blend'), compress=True)
    RAW.mkdir(exist_ok=True)
    raw = RAW / f'{style}-{fish}.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE')
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(raw, OUT / raw.name)
    print('exported', raw, raw.stat().st_size)


if __name__ == '__main__':
    for style in STYLES:
        for fish in SOURCES:
            build(fish, style)
