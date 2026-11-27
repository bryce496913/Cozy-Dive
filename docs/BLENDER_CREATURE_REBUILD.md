# Blender creature rebuild

This pass preserves editable Blender sources without changing the approved runtime models. Blender
exports must pass visual review before they replace the existing low-poly creature builders.

## Source convention

Pass 109 creates current-version Blender source files under `tools/art/pass109/sources/` from the
shipping GLBs. Each source is preserved with the model's required root/node contract so exported
replacements continue to work with existing encounter, collection, aquarium, and morph controllers.

| Requested group | Blender export(s) |
| --- | --- |
| Firefish and bumphead parrotfish | `assets/models/fish/firefish.glb`, `parrotfish.glb` |
| Seahorse, frogfish and moray | `assets/models/creatures/anchored-life.glb` |
| Sharks, rays, turtle, sunfish and humpback | individual files in `assets/models/creatures/` |
| Pinnipeds, penguins, killer whale and polar bear | individual files in `assets/models/creatures/` |
| Spanish shawl, giant isopod and other rare miniatures | `kelp-minis.glb`, `ice-minis.glb` |

## Draft small resident library

`tools/art/pass109/author_small_residents.py` builds and exports
`tools/art/pass109/exports/small-resident-redesigns.glb`, retaining its editable source at
`tools/art/pass109/sources/small-resident-redesigns.blend`.

The draft contains closed, opaque low-poly meshes for:

- Day octopus
- Kelp crab and rock crab
- Spiny lobster
- Lionfish
- Antarctic krill
- Sea butterfly

This draft is not registered or shipped at runtime. Its first visual review found proportion and
assembly problems, so the existing residents remain active until redesigned exports are approved.

