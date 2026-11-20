"""Pass 062: build the two benchmark treatments in Blender and export them to GLB.

    python3 tools/art/pass062/style_textures.py
    python3 tools/art/pass062/build.py            # Blender 5.1 Python module (`pip install bpy==5.1.2`)
    python3 tools/art/pass062/fish.py
    node tools/art/pass017/compress.mjs src/benchmark/style/assets
    python3 tools/art/pass062/turnaround.py       # neutral Cycles turnarounds (uncompressed sources)

Writes, per style (natural = A, crafted = B):
  tools/art/pass062/style-<style>.blend        packed, editable source (one object per subject)
  src/benchmark/style/assets/style-<style>.glb  benchmark-only export (never in public/)
  tools/art/pass062/out/style-<style>.glb       uncompressed copy kept for the turnaround renders

The GLB holds `<Style>_Root` with Rock, Coral_Brain, Coral_Branching and Seagrass_0..2 at the
origin, each with its own PBR material (base/normal/ORM maps from tools/art/textures/pass062 and
vertex-colour tint, exactly the Pass 014 material contract the runtime already reads).
"""
import shutil
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import style_geometry as sg  # noqa: E402

TEX = ROOT / 'tools/art/textures/pass062'
OUT = ROOT / 'src/benchmark/style/assets'
RAW = HERE / 'out'

# subject material -> (texture set, roughness fallback, normal strength, double sided)
MATERIALS = {
    'natural': {
        'Rock': ('rock', 0.9, 1.0, False),
        'Brain': ('brain', 0.66, 1.0, False),
        'Branch': ('branch', 0.68, 1.0, False),
        'Grass': ('grass', 0.6, 0.7, True),
    },
    'crafted': {
        'Rock': ('rock', 0.86, 0.8, False),
        'Brain': ('brain', 0.62, 0.8, False),
        'Branch': ('branch', 0.6, 0.7, False),
        'Grass': ('grass', 0.52, 0.5, True),
    },
}


def to_blender(p):
    return (p[0], -p[2], p[1])


def material(style: str, kind: str):
    name = f'{style.capitalize()}_{kind}'
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    texture, rough, strength, double = MATERIALS[style][kind]
    stem = f'p062-{style}-{texture}'
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = not double
    nodes, links = m.node_tree.nodes, m.node_tree.links
    p = nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = 0
    vc = nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    base = nodes.new('ShaderNodeTexImage')
    base.image = bpy.data.images.load(str(TEX / f'{stem}-base.png'), check_existing=True)
    links.new(base.outputs['Color'], mix.inputs[6])
    links.new(vc.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], p.inputs['Base Color'])
    normal = nodes.new('ShaderNodeTexImage')
    normal.image = bpy.data.images.load(str(TEX / f'{stem}-normal.png'), check_existing=True)
    normal.image.colorspace_settings.name = 'Non-Color'
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = strength
    links.new(normal.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], p.inputs['Normal'])
    orm = nodes.new('ShaderNodeTexImage')
    orm.image = bpy.data.images.load(str(TEX / f'{stem}-orm.png'), check_existing=True)
    orm.image.colorspace_settings.name = 'Non-Color'
    sep = nodes.new('ShaderNodeSeparateColor')
    links.new(orm.outputs['Color'], sep.inputs['Color'])
    links.new(sep.outputs['Green'], p.inputs['Roughness'])
    links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    return m


def make_mesh(style, mesh, parent):
    g = bpy.data.meshes.new(mesh.name)
    g.from_pydata([to_blender(p) for p in mesh.positions], [], [tuple(int(i) for i in f) for f in mesh.faces])
    g.update()
    uv = g.uv_layers.new(name='UVMap')
    vidx = [0] * len(g.loops)
    g.loops.foreach_get('vertex_index', vidx)
    uv.data.foreach_set('uv', [float(c) for i in vidx for c in mesh.uvs[i]])
    col = g.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    rgba = mesh.colors.copy()
    rgb = rgba[:, :3]
    rgba[:, :3] = sg.np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    col.data.foreach_set('color', [float(c) for c in rgba.ravel()])
    g.color_attributes.active_color = col
    g.color_attributes.render_color_index = 0
    for poly in g.polygons:
        poly.use_smooth = True
    g.materials.append(material(style, mesh.material))
    o = bpy.data.objects.new(mesh.name, g)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o['treatment'] = style
    return o


def build(style: str) -> Path:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = bpy.data.objects.new(f'{style.capitalize()}_Root', None)
    bpy.context.collection.objects.link(root)
    root['library'] = 'pass062-style-benchmark'
    root['treatment'] = style
    for m in sg.build_style(style):
        make_mesh(style, m, root)
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / f'style-{style}.blend'), compress=True)
    RAW.mkdir(exist_ok=True)
    raw = RAW / f'style-{style}.glb'
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', export_yup=True, export_extras=True,
                              export_animations=False, export_vertex_color='ACTIVE',
                              export_all_vertex_colors=False, export_image_format='AUTO')
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(raw, OUT / raw.name)
    print('exported', raw, raw.stat().st_size)
    return raw


if __name__ == '__main__':
    for s in (sys.argv[1:] or sg.STYLES):
        build(s)
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
