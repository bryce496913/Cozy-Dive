"""V0.7 Pass 063: reusable Blender modelling and export conventions for Cozy Diver.

Import from any authoring script (Blender 5.1 Python module, or `blender -b --python`):

    import sys; sys.path.insert(0, 'tools/art/v07')
    import cozy_art as ca

    ca.reset_scene()
    root = ca.create_root('Grouper_Root', category='creature')
    skin = ca.pbr_material('Grouper_Skin', 'fish-skin', 'p070-grouper-skin', roughness=0.5)
    ca.mesh_from_arrays('Body', positions, faces, uvs, colours, skin, root)
    ca.check_scene('creature')          # raises on export mistakes, returns warnings
    ca.save_blend('tools/art/pass070/grouper.blend')
    ca.export_glb('public/assets/models/creatures/grouper.glb')

All geometry passed in is in GAME space (metres, +Y up, fish +X forward); the helpers convert to
Blender (+Z up) and the exporter converts back (`export_yup=True`), so authored numbers are the
numbers the runtime sees. Material templates, texture tiers, naming and scale ranges come from
standards.json, the same file the GLB validator (validation/AssetStandards.ts) reads.

Pure helpers (`STANDARDS`, `to_blender`, `to_game`, `srgb_to_linear`, `template`) work without
Blender; everything else needs `bpy`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
STANDARDS = json.loads((HERE / 'standards.json').read_text())

# The one export configuration every V0.7 asset uses (matches Passes 014-062).
EXPORT_SETTINGS = dict(
    export_format='GLB',
    export_yup=True,
    export_extras=True,
    export_vertex_color='ACTIVE',
    export_all_vertex_colors=False,
    export_image_format='AUTO',
)


# ------------------------------------------------------------------ pure helpers


def to_blender(p: np.ndarray) -> np.ndarray:
    """Game (x, y up, z) -> Blender (x, -z, y up)."""
    p = np.asarray(p, float)
    return np.stack([p[..., 0], -p[..., 2], p[..., 1]], -1)


def to_game(co: np.ndarray) -> np.ndarray:
    co = np.asarray(co, float)
    return np.stack([co[..., 0], co[..., 2], -co[..., 1]], -1)


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = np.clip(np.asarray(c, float), 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def template(name: str) -> dict:
    if name not in STANDARDS['materials']:
        raise KeyError(f'unknown material template {name!r}; see tools/art/v07/standards.json')
    return STANDARDS['materials'][name]


def check_name(name: str, kind: str = 'node') -> None:
    if not re.search(STANDARDS['naming'][kind], name):
        raise ValueError(f'{name!r} does not follow the {kind} naming rule {STANDARDS["naming"][kind]}')


def texture_path(stem: str, suffix: str, directory: Path | None = None) -> Path:
    """`<stem>-<suffix>.png` under tools/art/textures (searched recursively when no directory)."""
    check_name(f'{stem}-{suffix}', 'texture')
    if directory:
        return Path(directory) / f'{stem}-{suffix}.png'
    hits = sorted((ROOT / 'tools/art/textures').rglob(f'{stem}-{suffix}.png'))
    if not hits:
        raise FileNotFoundError(f'no authoring map {stem}-{suffix}.png under tools/art/textures')
    return hits[0]


# ------------------------------------------------------------------ Blender helpers


def _bpy():
    import bpy  # noqa: PLC0415 - Blender-only dependency
    return bpy


def reset_scene() -> None:
    _bpy().ops.wm.read_factory_settings(use_empty=True)


def create_root(name: str, category: str, **extras):
    """The asset's single named root (`<Asset>_Root`); runtime code ignores its translation."""
    bpy = _bpy()
    check_name(name, 'root')
    if category not in STANDARDS['categories']:
        raise KeyError(f'unknown category {category!r}')
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o['category'] = category
    o['standards'] = STANDARDS['version']
    for k, v in extras.items():
        o[k] = v
    return o


def pbr_material(name: str, template_name: str, stem: str, *, roughness: float | None = None,
                 normal_strength: float | None = None, directory: Path | None = None,
                 vertex_tint: bool = True, paths: dict | None = None):
    """A Principled material on the V0.7 PBR contract: base x vertex colour, tangent normal map,
    ORM (G roughness, B metalness). Overrides must stay inside the template's ranges.
    `paths` maps 'base'/'normal'/'orm' to explicit files (e.g. a fin map or a shared ORM)."""
    bpy = _bpy()

    def tex(suffix: str) -> Path:
        return Path(paths[suffix]) if paths and suffix in paths else texture_path(stem, suffix, directory)

    if name in bpy.data.materials:
        return bpy.data.materials[name]
    t = template(template_name)
    lo, hi = t['roughness']
    rough = (lo + hi) / 2 if roughness is None else roughness
    if not lo <= rough <= hi:
        raise ValueError(f'{name}: roughness {rough} outside the {template_name} range {t["roughness"]}')
    strength = t['normalStrength'] if normal_strength is None else normal_strength
    if not 0 < strength <= 1.5:
        raise ValueError(f'{name}: normal strength {strength} out of range')
    m = bpy.data.materials.new(name)
    m['template'] = template_name
    m.use_nodes = True
    m.use_backface_culling = not t['doubleSided']
    if t['alpha'] == 'BLEND':
        m.surface_render_method = 'BLENDED'
    nodes, links = m.node_tree.nodes, m.node_tree.links
    p = nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = t['metallic'] if isinstance(t['metallic'], (int, float)) else 0
    if vertex_tint:
        vc = nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        mix = nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
    base = nodes.new('ShaderNodeTexImage')
    base.image = bpy.data.images.load(str(tex('base')), check_existing=True)
    if vertex_tint:
        links.new(base.outputs['Color'], mix.inputs[6])
        links.new(vc.outputs['Color'], mix.inputs[7])
        links.new(mix.outputs[2], p.inputs['Base Color'])
    else:
        links.new(base.outputs['Color'], p.inputs['Base Color'])
    if t['alpha'] == 'BLEND':
        links.new(base.outputs['Alpha'], p.inputs['Alpha'])
    if 'normal' in t['maps']:
        normal = nodes.new('ShaderNodeTexImage')
        normal.image = bpy.data.images.load(str(tex('normal')), check_existing=True)
        normal.image.colorspace_settings.name = 'Non-Color'
        nmap = nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = strength
        links.new(normal.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], p.inputs['Normal'])
    if 'orm' in t['maps']:
        orm = nodes.new('ShaderNodeTexImage')
        orm.image = bpy.data.images.load(str(tex('orm')), check_existing=True)
        orm.image.colorspace_settings.name = 'Non-Color'
        sep = nodes.new('ShaderNodeSeparateColor')
        links.new(orm.outputs['Color'], sep.inputs['Color'])
        links.new(sep.outputs['Green'], p.inputs['Roughness'])
        links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    return m


def mesh_from_arrays(name: str, positions, faces, uvs, colors, material, parent, *, phase=None,
                     extras: dict | None = None, smooth: bool = True):
    """A mesh object from game-space arrays: per-vertex UVs, sRGB RGBA colours (converted to the
    linear `Col` attribute glTF expects) and an optional per-vertex plant phase in UV1 (`Phase`)."""
    bpy = _bpy()
    check_name(name)
    positions = np.asarray(positions, float)
    g = bpy.data.meshes.new(name)
    g.from_pydata([tuple(p) for p in to_blender(positions)], [], [tuple(int(i) for i in f) for f in faces])
    g.update()
    vidx = [0] * len(g.loops)
    g.loops.foreach_get('vertex_index', vidx)
    uv = g.uv_layers.new(name='UVMap')
    uvs = np.asarray(uvs, float)
    uv.data.foreach_set('uv', [float(c) for i in vidx for c in uvs[i]])
    if phase is not None:
        ph = g.uv_layers.new(name='Phase')
        ph.data.foreach_set('uv', [v for i in vidx for v in (float(phase[i]), 0.0)])
        g.uv_layers.active = uv
    col = g.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = np.asarray(colors, float).copy()
    if rgba.shape[1] == 3:
        rgba = np.concatenate([rgba, np.ones((len(rgba), 1))], 1)
    rgba[:, :3] = srgb_to_linear(rgba[:, :3])
    col.data.foreach_set('color', [float(c) for c in rgba.ravel()])
    g.color_attributes.active_color = col
    g.color_attributes.render_color_index = 0
    for poly in g.polygons:
        poly.use_smooth = smooth
    g.materials.append(material)
    o = bpy.data.objects.new(name, g)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    for k, v in (extras or {}).items():
        o[k] = v
    return o


def collider_from_points(name: str, points, parent):
    """Hidden convex collision hull (`COLLIDER_*`, `collision_points`), rebuilt exactly at runtime."""
    bpy = _bpy()
    import bmesh  # noqa: PLC0415
    check_name(name, 'collider')
    g = bpy.data.meshes.new(name)
    g.from_pydata([tuple(p) for p in to_blender(np.asarray(points, float))], [], [])
    bm = bmesh.new()
    bm.from_mesh(g)
    bmesh.ops.convex_hull(bm, input=list(bm.verts), use_existing_faces=False)
    bm.to_mesh(g)
    bm.free()
    g.uv_layers.new(name='UVMap')
    o = bpy.data.objects.new(name, g)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o['collision_points'] = True
    o.hide_render = True
    return o


def add_lod(obj, ratio: float, level: int = 1):
    """A collapse-decimated distance level `<name>_LOD<level>` for STATIC meshes. Morph-carrying
    fish/creature meshes use tools/art/pass017/fish_lod.py, which transfers the stroke morphs."""
    bpy = _bpy()
    if obj.data.shape_keys:
        raise ValueError(f'{obj.name}: has morphs; use tools/art/pass017/fish_lod.py')
    lo, hi = STANDARDS['lod'][f'LOD{level}']['ratio']
    if not lo <= ratio <= hi:
        raise ValueError(f'LOD{level} ratio {ratio} outside the standard {lo}-{hi}')
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = copy.data.name = f'{obj.name}_LOD{level}'
    bpy.context.collection.objects.link(copy)
    mod = copy.modifiers.new('Decimate', 'DECIMATE')
    mod.ratio = ratio
    with bpy.context.temp_override(object=copy, active_object=copy):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return copy


def check_scene(category: str) -> list[str]:
    """Pre-export checks; raises ValueError listing errors, returns warnings.

    Errors: unapplied/negative scale on meshes, missing UVs, non-template materials on visible
    meshes, required nodes or morphs missing, origin rule broken for grounded categories."""
    bpy = _bpy()
    spec = STANDARDS['categories'][category]
    errors, warnings = [], []
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    names = {o.name for o in bpy.context.scene.objects}
    for req in spec['requiredNodes']:
        if req not in names:
            errors.append(f'missing required node {req}')
    for o in meshes:
        helper = re.search(STANDARDS['naming']['collider'], o.name) or re.search(STANDARDS['naming']['dynamic'], o.name)
        s = o.scale
        if min(s) < 0:
            errors.append(f'{o.name}: negative scale')
        elif max(abs(s[0] - s[1]), abs(s[1] - s[2])) > 1e-4:
            warnings.append(f'{o.name}: non-uniform scale; apply it before export')
        if helper:
            continue
        if not re.search(STANDARDS['naming']['node'], o.name):
            warnings.append(f'{o.name}: name is not PascalCase_With_Underscores')
        if not o.data.uv_layers:
            errors.append(f'{o.name}: no UVs')
        for m in o.data.materials:
            if m and 'template' not in m and not any(m.name.endswith(a) or a in m.name for a in STANDARDS['untexturedAllowed']):
                warnings.append(f'{o.name}: material {m.name} was not made from a template')
        if o.name.split('_LOD')[0] in spec['morphMeshes']:
            keys = [k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else []
            for morph in spec['morphs']:
                if morph not in keys:
                    errors.append(f'{o.name}: missing morph {morph}')
    if category in ('reef', 'plant', 'prop'):
        lows = [min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in meshes if o.data.vertices]
        if lows and min(lows) > 0.05:
            errors.append(f'{category}: lowest point {min(lows):.3f} m above the origin (origin must sit on the ground)')
    if errors:
        raise ValueError('export check failed:\n  ' + '\n  '.join(errors))
    return warnings


def pack_images() -> None:
    for image in _bpy().data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()


def save_blend(path) -> None:
    """Packed, compressed, editable source beside the export."""
    pack_images()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    _bpy().ops.wm.save_as_mainfile(filepath=str(path), compress=True)


def export_glb(path, *, animations: bool = False) -> Path:
    """Uncompressed GLB with the standard settings. Compress afterwards with
    `node tools/art/pass017/compress.mjs <dir>` and validate with `node validation/AssetStandards.ts`."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    _bpy().ops.export_scene.gltf(filepath=str(path), export_animations=animations, **EXPORT_SETTINGS)
    return path
