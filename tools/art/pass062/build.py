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

Pass 063: materials, meshes, checks and export now come from the shared V0.7 helpers
(tools/art/v07/cozy_art.py); the output is unchanged apart from each material's `template` extra.
"""
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'tools/art/v07'))
import style_geometry as sg  # noqa: E402
import cozy_art as ca  # noqa: E402  (Pass 063: the shared V0.7 conventions)

OUT = ROOT / 'src/benchmark/style/assets'
RAW = HERE / 'out'

# subject material -> (texture set, material template, roughness, normal strength)
MATERIALS = {
    'natural': {
        'Rock': ('rock', 'limestone', 0.9, 1.0),
        'Brain': ('brain', 'coral-tissue', 0.66, 1.0),
        'Branch': ('branch', 'coral-tissue', 0.68, 1.0),
        'Grass': ('grass', 'plant', 0.6, 0.7),
    },
    'crafted': {
        'Rock': ('rock', 'limestone', 0.86, 0.8),
        'Brain': ('brain', 'coral-tissue', 0.62, 0.8),
        'Branch': ('branch', 'coral-tissue', 0.6, 0.7),
        'Grass': ('grass', 'plant', 0.52, 0.5),
    },
}


def material(style: str, kind: str):
    texture, template, rough, strength = MATERIALS[style][kind]
    return ca.pbr_material(f'{style.capitalize()}_{kind}', template, f'p062-{style}-{texture}',
                           roughness=rough, normal_strength=strength)


def build(style: str) -> Path:
    ca.reset_scene()
    root = ca.create_root(f'{style.capitalize()}_Root', 'library', library='pass062-style-benchmark',
                          treatment=style)
    for m in sg.build_style(style):
        ca.mesh_from_arrays(m.name, m.positions, m.faces, m.uvs, m.colors, material(style, m.material), root,
                            extras={'treatment': style})
    ca.check_scene('library')
    ca.save_blend(HERE / f'style-{style}.blend')
    RAW.mkdir(exist_ok=True)
    raw = ca.export_glb(RAW / f'style-{style}.glb')
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copy(raw, OUT / raw.name)
    print('exported', raw, raw.stat().st_size)
    return raw


if __name__ == '__main__':
    for s in (sys.argv[1:] or sg.STYLES):
        build(s)
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
