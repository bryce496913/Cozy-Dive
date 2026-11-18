# Visual consistency and art review (Pass 053)

The standard is the accepted direction in [ART_DIRECTION.md](ART_DIRECTION.md):

- natural, slightly stylised marine life with convincing anatomy;
- carefully designed silhouettes and restrained materials;
- the Pass 012 chromis and the Pass 016 reef-fish rigs as the reference.

This pass audits every environment against that standard, ranks the gaps by how visible they are, and fixes the highest-impact ones. It does not replace assets that already meet the standard.

## How the audit was done

- **World tour:** `validation/visual-tour.mjs` takes fixed, repeatable views in each world (office, tank, outer reef, kelp forest, sea cave, under the ice), with draw calls and triangles for each. It ran before and after.
- **Creature close-ups:** `validation/creature-closeups.mjs` renders each creature that is built in code alone, framed to its size, from three angles under one neutral light rig, so before and after compare like for like. It records triangle counts.
- **Authored models:** the Blender-authored models (every fish, shark, ray, turtle, whale, seal, penguin, coral, rock and ornament) were checked against the asset registry by `tests/asset-validation.test.ts` and `tools/art/inspect_assets.py`. Where they were reviewed in earlier passes, they were left alone.

## Audit matrix (ranked by visual impact)

| Rank | Asset | World | How visible | Issue | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | **Sea star** | Kelp forest | Dozens on the rocks along every path | A flat extruded five-pointed star (76 triangles), clip-art-like, with no arms or surface | **Rebuilt** (see below) |
| 2 | **Spiny lobster** | Sea cave | Several at dens on the cave floor | A stretched sphere for a carapace, box plates and flaps, a box tail fan | **Rebuilt** (see below) |
| 3 | **Spanish shawl nudibranch** | Kelp forest | Small, but bright and on rocks at eye level | An ellipsoid with cones | **Rebuilt** (see below) |
| 4 | **Krill, sea butterflies, comb jellies** | Under the ice | Small, but numerous (520 krill) and drifting past the face | Capsule with cone; sphere with discs; ring-banded sphere | **Rebuilt** (see below) |
| 5 | **Purple urchin** | Kelp forest | Many, at the urchin barrens | Sparse spikes (about 40) | **Denser:** a domed, banded test and 150 spines |
| 6 | Rock crab, lionfish | Sea cave | – | Rebuilt in Pass 052 | Kept |
| 7 | Ice garden (sponges, soft corals) | Under the ice | – | Lathe and branch forms, adequate | Kept; noted for a later review |
| 8 | Office furniture | Office | – | Built from boxes, which suits an office; consistent | Kept |
| – | Authored fish, sharks, rays, turtles, whales, seals, penguins, corals, rocks and ornaments | All | – | Meet the standard (reviewed in Passes 012–048) | Kept, not replaced |

What each rebuild adds:

- **Sea star:** a domed disc and five thick, rounded, tapering arms that curl slightly. A net of raised pale knobs covers the top, the tips are lifted, and it is still tinted per instance.
- **Spiny lobster:**
  - a squarish, tapering carapace with a cervical groove and rows of forward-raked spines;
  - curved horns over stalked eyes, and forked antennules;
  - six grooved, spotted tergites with pointed pleura;
  - a telson-and-uropod tail fan;
  - banded three-segment legs.
- **Spanish shawl:** a slender tapering body with a flared foot, sweeping oral tentacles, ringed scarlet rhinophores, and dense curved orange cerata with pale tips.
- **Ice critters:**
  - krill: a segmented, bent shrimp with stalked eyes, antennae and a swimmer fringe;
  - sea butterflies: a coiled shell and veined wing-lobes;
  - comb jellies: eight rows of tiny iridescent combs, a mouth and tentacles.

## Lighting and colour balance

Every world uses the same three-light rig: a hemisphere sky and ground light, a directional sun, and a cool fill, under the same ACES tone mapping. The differences are deliberate, one mood per place, so they are kept:

| World | Mood | Key differences |
| --- | --- | --- |
| Tank | A lit display tank | The brightest: sky 2.6, sun 3.2 |
| Outer reef | Tropical sun over blue water | Warm sun 2.4, blue-green fill, depth darkening |
| Kelp forest | Golden-green light through the canopy | Green-gold sky and warm sun 2.3 |
| Sea cave | Dim, with one sunbeam | The lowest: sky 1.1, sun 1.7 |
| Under the ice | Cold, pale light through the ice | Cold white sky, sun 1.5, blue fill |

## Still to review later

- **Ice garden:** sponges and soft corals could become authored models.
- **Cave lobster dens and cleaner shrimp:** small, and acceptable at their size.
- **LOD switching for code-built creatures:** none have distance levels, as they are small. The authored models keep theirs.
