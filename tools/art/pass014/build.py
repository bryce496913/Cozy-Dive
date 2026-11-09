"""Build the Pass 014 reef library in Blender and export it to GLB.

    python3 tools/art/pass014/textures.py
    blender -b --factory-startup --python tools/art/pass014/build.py
    # or, with Blender's Python module installed (`pip install bpy`):
    python3 tools/art/pass014/build.py

Geometry comes from reef_geometry.py (seeded numpy construction against baseline.json).
The packed .blend keeps every asset as a separate editable object under a named root;
roots are staged on a grid for inspection and the runtime ignores root translation.
"""
import math
import sys
from pathlib import Path

import bpy
import bmesh

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import reef_geometry as rg  # noqa: E402

TEX = ROOT / 'public/assets/textures/pass014'


def tex(name):
    # Sets prefixed with a pass folder resolve beside pass014 (e.g. 'pass015/coral-plate').
    return (TEX.parent / name) if '/' in name else (TEX / name)
OUT = ROOT / 'public/assets/models/reef/reef-environment.glb'


def to_blender(p):
    return (p[0], -p[2], p[1])


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


MATERIALS = {
    # name: (texture set, base tint, roughness fallback, normal strength)
    'ReefRock': ('reef-rock', (1, 1, 1), 0.88, 1.0),
    # Pass 015 coral and soft-tissue maps (textures/pass015).
    'CoralBranch': ('pass015/coral-acropora', (1, 1, 1), 0.7, 1.0),
    'CoralPlate': ('pass015/coral-plate', (1, 1, 1), 0.72, 0.9),
    'CoralBrain': ('pass015/coral-brain', (1, 1, 1), 0.72, 0.9),
    'SoftTissue': ('pass015/soft-polyp', (1, 1, 1), 0.66, 0.8),
    'Algae': ('algae', (1, 1, 1), 0.66, 0.5),
    'Sand': ('sand', (1, 1, 1), 0.93, 0.8),
}


def material(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    texture, tint, rough, strength = MATERIALS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    # Closed solids are single-sided; thin blades, fronds and gorgonian lattices stay double-sided.
    m.use_backface_culling = name not in ('Algae', 'SoftTissue')
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
    base.image = bpy.data.images.load(str(tex(f'{texture}-base.png')), check_existing=True)
    links.new(base.outputs['Color'], mix.inputs[6])
    links.new(vc.outputs['Color'], mix.inputs[7])
    links.new(mix.outputs[2], p.inputs['Base Color'])
    normal = nodes.new('ShaderNodeTexImage')
    normal.image = bpy.data.images.load(str(tex(f'{texture}-normal.png')), check_existing=True)
    normal.image.colorspace_settings.name = 'Non-Color'
    nmap = nodes.new('ShaderNodeNormalMap')
    nmap.inputs['Strength'].default_value = strength
    links.new(normal.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], p.inputs['Normal'])
    orm = nodes.new('ShaderNodeTexImage')
    orm.image = bpy.data.images.load(str(tex(f'{texture}-orm.png')), check_existing=True)
    orm.image.colorspace_settings.name = 'Non-Color'
    sep = nodes.new('ShaderNodeSeparateColor')
    links.new(orm.outputs['Color'], sep.inputs['Color'])
    links.new(sep.outputs['Green'], p.inputs['Roughness'])
    links.new(sep.outputs['Blue'], p.inputs['Metallic'])
    return m


def proxy_material():
    if 'Proxy' in bpy.data.materials:
        return bpy.data.materials['Proxy']
    m = bpy.data.materials.new('Proxy')
    m.use_nodes = True
    return m


def make_mesh(mesh: 'rg.Mesh', parent, extras=None):
    g = bpy.data.meshes.new(mesh.name)
    g.from_pydata([to_blender(p) for p in mesh.positions], [], [tuple(f) for f in mesh.faces])
    g.update()
    uv = g.uv_layers.new(name='UVMap')
    loops = [0] * len(g.loops) * 2
    g.loops.foreach_get('vertex_index', loops[: len(g.loops)])
    vidx = loops[: len(g.loops)]
    flat = []
    for i in vidx:
        flat += [float(mesh.uvs[i][0]), float(mesh.uvs[i][1])]
    uv.data.foreach_set('uv', flat)
    # Plant current phase travels in a second UV set (glTF COLOR_0 is exported as RGB).
    phase = g.uv_layers.new(name='Phase')
    phase.data.foreach_set('uv', [v for i in vidx for v in (float(mesh.colors[i][3]), 0.0)])
    g.uv_layers.active = uv
    col = g.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    # Authored tints are display (sRGB) values; glTF vertex colours are linear.
    rgba = mesh.colors.copy()
    rgb = rgba[:, :3]
    rgba[:, :3] = rg.np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    col.data.foreach_set('color', [float(c) for c in rgba.ravel()])
    g.color_attributes.active_color = col
    g.color_attributes.render_color_index = 0
    for poly in g.polygons:
        poly.use_smooth = True
    g.materials.append(material(mesh.material))
    o = bpy.data.objects.new(mesh.name, g)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    for k, v in (extras or mesh.extras).items():
        o[k] = v
    return o


def make_collider(name, points, parent):
    g = bpy.data.meshes.new(name)
    g.from_pydata([to_blender(p) for p in points], [], [])
    bm = bmesh.new()
    bm.from_mesh(g)
    bmesh.ops.convex_hull(bm, input=list(bm.verts), use_existing_faces=False)
    bm.to_mesh(g)
    bm.free()
    g.uv_layers.new(name='UVMap')
    g.materials.append(proxy_material())
    o = bpy.data.objects.new(name, g)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o['collision_points'] = True
    o.hide_render = True
    return o


def root(name, index, extras):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = (index % 8 * 5.0, -(index // 8) * 5.0, 0)
    for k, v in extras.items():
        o[k] = v
    return o


def build():
    reset()
    lib = rg.build_all()
    index = 0
    for group, items in lib.items():
        collection = bpy.data.collections.new(group)
        bpy.context.scene.collection.children.link(collection)
        layer = bpy.context.view_layer.layer_collection.children[group]
        bpy.context.view_layer.active_layer_collection = layer
        for item in items:
            if isinstance(item, rg.Asset):
                r = root(item.name + '_Root', index, {**item.extras, 'library': 'pass014-reef', 'group': group})
                for m in item.meshes:
                    make_mesh(m, r)
                for i, pts in enumerate(item.colliders):
                    make_collider(f'COLLIDER_{item.name}_{i}', pts, r)
            else:
                r = root(item.name + '_Root', index, {'library': 'pass014-reef', 'group': group})
                make_mesh(item, r, {'template': item.name, **item.extras})
            index += 1
    # Sand material carrier: a tiny quad so the runtime can adopt the authored PBR sand set.
    sand = rg.Mesh('Sand_Material', 'Sand', rg.np.array([[0, 0, 0], [1, 0, 0], [0, 0, 1.0]]),
                   rg.np.array([[0, 2, 1]]), rg.np.array([[0, 0], [1, 0], [0, 1.0]]),
                   rg.np.ones((3, 4)))
    make_mesh(sand, root('Sand_Material_Root', index, {'library': 'pass014-reef', 'group': 'substrate'}))
    for image in bpy.data.images:
        if image.source == 'FILE' and image.has_data:
            image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'reef-environment.blend'), compress=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format='GLB',
        export_yup=True,
        export_extras=True,
        export_animations=False,
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_image_format='AUTO',
    )
    print('exported', OUT, OUT.stat().st_size)


if __name__ == '__main__':
    build()
