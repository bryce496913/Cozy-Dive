"""Pass 109 Blender-native low-poly replacements for procedural small residents.

Run:
  blender --background --factory-startup --python tools/art/pass109/author_small_residents.py

Exports a deliberately solid asset library. Every part is a closed Blender primitive or a capped
curve converted to mesh; no one-sided sheets, alpha body materials, or disconnected decorative
balls are used. The source is retained beside the export for per-species editing.
"""
from pathlib import Path
import math
import bpy

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'tools/art/pass109/sources'
EXPORT = ROOT / 'tools/art/pass109/exports'


def material(name, colour):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*colour, 1)
    value.use_nodes = True
    node = value.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*colour, 1)
    node.inputs['Roughness'].default_value = 0.72
    node.inputs['Alpha'].default_value = 1
    value.surface_render_method = 'DITHERED'
    return value


PALETTE = {
    'octopus': material('Octopus_Red', (0.55, 0.12, 0.06)),
    'crab': material('Crab_Olive', (0.22, 0.31, 0.12)),
    'lobster': material('Lobster_Red', (0.48, 0.08, 0.035)),
    'lion': material('Lionfish_Cream', (0.9, 0.62, 0.3)),
    'stripe': material('Lionfish_Maroon', (0.32, 0.035, 0.02)),
    'krill': material('Krill_Coral', (0.86, 0.23, 0.2)),
    'butterfly': material('SeaButterfly_Amber', (0.96, 0.4, 0.08)),
    'eye': material('Eyes_Black', (0.008, 0.01, 0.012)),
}


def sphere(name, location, scale, mat, segments=8, rings=5):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def cone(name, location, radius1, radius2, depth, mat, rotation=(0, 0, 0), vertices=7):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def join(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    root = bpy.context.object
    root.name = name
    return root


def stroke_keys(ob, wing=False):
    basis = ob.shape_key_add(name='Basis')
    for name, sign in [('Stroke_Left', 1), ('Stroke_Right', -1)]:
        key = ob.shape_key_add(name=name)
        for vertex in key.data:
            x, y, z = vertex.co
            if wing:
                vertex.co.y += sign * 0.12 * abs(z) ** 1.4
            else:
                vertex.co.z += sign * 0.05 * max(0, -x) ** 2
        key.value = 0
    basis.value = 0


def octopus():
    parts = [sphere('Mantle', (0, 0.16, 0), (0.16, 0.19, 0.14), PALETTE['octopus'])]
    for i in range(8):
        a = i * math.tau / 8
        x, z = math.sin(a), math.cos(a)
        arm = cone('Arm', (x * .19, .045, z * .19), .034, .009, .3, PALETTE['octopus'], rotation=(math.pi / 2, 0, -a))
        parts.append(arm)
    for side in (-1, 1):
        parts.append(sphere('Eye', (side*.095, .22, .09), (.022,.022,.018), PALETTE['eye'], 6, 4))
    return join('Day_Octopus', parts)


def crab(name, colour):
    parts = [sphere('Carapace', (0, .065, 0), (.15,.06,.12), colour, 8, 5)]
    for side in (-1, 1):
        for row in range(4):
            z = .075 - row*.05
            parts.append(cone('Leg', (side*.17,.025,z), .014,.006,.18, colour, rotation=(0, side*math.pi/2, 0.55*side), vertices=5))
        for z in (-.07,.07):
            parts.append(cone('Claw', (side*.2,.075,z), .032,.008,.13, colour, rotation=(0,side*math.pi/2,0), vertices=6))
        parts.append(sphere('Eye', (side*.065,.13,.085), (.016,.018,.016), PALETTE['eye'], 6,4))
    return join(name, parts)


def lobster():
    parts = [sphere('Carapace', (0,.07,.06), (.09,.06,.16), PALETTE['lobster'], 8,5)]
    for i in range(6):
        parts.append(sphere('Abdomen', (0,.055,-.04-i*.05), (.075-i*.006,.045,.04), PALETTE['lobster'], 7,4))
    for side in (-1,1):
        for row in range(5):
            parts.append(cone('WalkingLeg', (side*.1,.025,.07-row*.06), .009,.003,.15, PALETTE['lobster'], rotation=(0,side*math.pi/2,.5*side), vertices=5))
        parts.append(cone('Antenna', (side*.025,.09,.19), .006,.001,.45, PALETTE['lobster'], rotation=(.8,side*.2,0), vertices=5))
    return join('Spiny_Lobster', parts)


def lionfish():
    parts = [sphere('Body', (0,.1,0), (.11,.09,.22), PALETTE['lion'], 8,5)]
    for i in range(13):
        x = -.08 + i*.013
        parts.append(cone('DorsalSpine', (x,.2,-.01), .009,.002,.2, PALETTE['stripe'], rotation=(0,0,0), vertices=5))
    for side in (-1,1):
        for i in range(7):
            parts.append(cone('FinRay', (side*.1,.1,-.03+i*.035), .008,.002,.22, PALETTE['stripe'], rotation=(0,side*math.pi/2,.5*side), vertices=5))
    return join('Lionfish', parts)


def krill():
    parts = [sphere('Carapace', (0,.02,.08), (.035,.03,.06), PALETTE['krill'], 7,4)]
    for i in range(5):
        parts.append(sphere('Segment', (0,.012,-i*.045), (.03-i*.003,.022,.028), PALETTE['krill'], 6,4))
    for side in (-1,1):
        parts.append(sphere('Eye', (side*.027,.035,.12), (.012,.012,.012), PALETTE['eye'], 5,3))
        parts.append(cone('Antenna', (side*.018,.028,.15), .004,.001,.16, PALETTE['krill'], rotation=(.7,side*.4,0), vertices=4))
    return join('Antarctic_Krill', parts)


def butterfly():
    parts=[sphere('Body',(0,.02,0),(.025,.045,.02),PALETTE['butterfly'],7,4)]
    for side in (-1,1):
        parts.append(sphere('Wing',(side*.045,.035,0),(.055,.012,.04),PALETTE['butterfly'],7,4))
    return join('Sea_Butterfly',parts)


OUT.mkdir(parents=True, exist_ok=True)
EXPORT.mkdir(parents=True, exist_ok=True)
models = [octopus(), crab('Kelp_Crab', PALETTE['crab']), crab('Rock_Crab', PALETTE['crab']), lobster(), lionfish(), krill(), butterfly()]
for model in models:
    stroke_keys(model, wing=model.name == 'Sea_Butterfly')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'small-resident-redesigns.blend'))
bpy.ops.export_scene.gltf(filepath=str(EXPORT / 'small-resident-redesigns.glb'), export_format='GLB', export_yup=True, export_morph=True, export_animations=True)
