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

| Rank | Asset                                                                                      | World         | How visible                                                | Issue                                                                                    | Action                                                                            |
| ---- | ------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | **Sea star**                                                                               | Kelp forest   | Dozens on the rocks along every path                       | A flat extruded five-pointed star (76 triangles), clip-art-like, with no arms or surface | **Rebuilt** (see below)                                                           |
| 2    | **Spiny lobster**                                                                          | Sea cave      | Several at dens on the cave floor                          | A stretched sphere for a carapace, box plates and flaps, a box tail fan                  | **Rebuilt** (see below)                                                           |
| 3    | **Spanish shawl nudibranch**                                                               | Kelp forest   | Small, but bright and on rocks at eye level                | An ellipsoid with cones                                                                  | **Rebuilt** (see below)                                                           |
| 4    | **Krill, sea butterflies, comb jellies**                                                   | Under the ice | Small, but numerous (520 krill) and drifting past the face | Capsule with cone; sphere with discs; ring-banded sphere                                 | **Rebuilt** (see below)                                                           |
| 5    | **Purple urchin**                                                                          | Kelp forest   | Many, at the urchin barrens                                | Sparse spikes (about 40)                                                                 | **Denser:** a domed, banded test and 150 spines (open-ended cones, 768 triangles) |
| 6    | Rock crab, lionfish                                                                        | Sea cave      | –                                                          | Rebuilt in Pass 052                                                                      | Kept                                                                              |
| 7    | Ice garden (sponges, soft corals)                                                          | Under the ice | –                                                          | Lathe and branch forms, adequate                                                         | Kept; noted for a later review                                                    |
| 8    | Office furniture                                                                           | Office        | –                                                          | Built from boxes, which suits an office; consistent                                      | Kept                                                                              |
| –    | Authored fish, sharks, rays, turtles, whales, seals, penguins, corals, rocks and ornaments | All           | –                                                          | Meet the standard (reviewed in Passes 012–048)                                           | Kept, not replaced                                                                |

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

### Close-ups, before and after

Rendered by `validation/creature-closeups.mjs` under the same neutral light, side, three-quarter and top views (SwiftShader):

| Creature      | Before (triangles) | After (triangles) | Image                                                                           |
| ------------- | -----------------: | ----------------: | ------------------------------------------------------------------------------- |
| Spiny lobster |               1964 |              7564 | [closeup-spiny-lobster.jpg](screenshots/v0.6-pass053/closeup-spiny-lobster.jpg) |
| Spanish shawl |                328 |              2524 | [closeup-spanish-shawl.jpg](screenshots/v0.6-pass053/closeup-spanish-shawl.jpg) |
| Sea star      |                 76 |              1184 | [closeup-kelp-star.jpg](screenshots/v0.6-pass053/closeup-kelp-star.jpg)         |
| Purple urchin |                572 |               768 | [closeup-kelp-urchin.jpg](screenshots/v0.6-pass053/closeup-kelp-urchin.jpg)     |
| Krill         |                152 |               332 | [closeup-krill.jpg](screenshots/v0.6-pass053/closeup-krill.jpg)                 |
| Sea butterfly |                100 |               300 | [closeup-sea-butterfly.jpg](screenshots/v0.6-pass053/closeup-sea-butterfly.jpg) |
| Comb jelly    |               1504 |              1392 | [closeup-comb-jelly.jpg](screenshots/v0.6-pass053/closeup-comb-jelly.jpg)       |

Every one is still a single instanced or merged mesh, so the number of draw calls does not change. The shapes were first built richer, then trimmed (fewer knobs, segments and sides) once their instance counts were counted: 170 kelp stars, 110 ice stars, 340 urchins, 26 nudibranchs and 520 krill. The trimmed versions keep the silhouettes. The triangle cost in each world is in the world tour below.

## World tour, before and after

`validation/visual-tour.mjs` at 640×400, device pixel ratio 0.75, SwiftShader (software rendering, so these are counts, not frame times). Same positions and look directions before and after:

| World | View         | Draws before | Draws after | Triangles before | Triangles after | Change |
| ----- | ------------ | -----------: | ----------: | ---------------: | --------------: | -----: |
| tank  | front        |          163 |         163 |           0.97 M |          0.97 M |  +0.0% |
| tank  | reef-close   |          117 |         117 |           1.04 M |          1.04 M |  +0.0% |
| tank  | corner       |          190 |         190 |           1.03 M |          1.03 M |  +0.0% |
| outer | reef-top     |          101 |         101 |           1.19 M |          1.19 M |  +0.0% |
| outer | lip          |          107 |         107 |           1.63 M |          1.63 M |  +0.0% |
| outer | coral-close  |          109 |         109 |           1.77 M |          1.77 M |  +0.0% |
| kelp  | forest       |           50 |          50 |           2.00 M |          2.31 M | +15.6% |
| kelp  | rocks-close  |           52 |          52 |           2.06 M |          2.37 M | +15.2% |
| kelp  | canopy       |           40 |          40 |           1.91 M |          2.22 M | +16.4% |
| cave  | cavern       |           51 |          51 |           0.79 M |          0.90 M | +13.4% |
| cave  | floor-close  |           40 |          40 |           0.73 M |          0.83 M | +14.6% |
| cave  | sunbeam      |           49 |          49 |           0.77 M |          0.87 M | +13.9% |
| ice   | open-water   |           88 |          88 |           1.23 M |          1.45 M | +18.1% |
| ice   | seabed-close |           47 |          47 |           1.02 M |          1.24 M | +21.8% |
| ice   | under-ice    |           67 |          67 |           1.67 M |          1.89 M | +13.3% |

- **Draw calls: unchanged everywhere.**
- **Triangles:** unchanged in the tank and outer reef. Up 13–22% in the kelp forest, sea cave and under the ice, where the rebuilt creatures live. The kelp forest stays the heaviest world, at about 2.4 M in view. This is the cost of the detail, kept down by the trimming above. It is not measured on a laptop GPU here; Pass 059 (performance) should check it on real hardware.
- **No errors** in either run.

Side by side (left before, right after):

- [Kelp forest, rocks close](screenshots/v0.6-pass053/tour-kelp-rocks-close.jpg): denser purple urchins and the new stars.
- [Kelp forest](screenshots/v0.6-pass053/tour-kelp-forest.jpg)
- [Under the ice, seabed close](screenshots/v0.6-pass053/tour-ice-seabed-close.jpg): the new sea star.
- [Under the ice, open water](screenshots/v0.6-pass053/tour-ice-open-water.jpg)

The office and start screen were captured for the audit and need no change.

## Lighting and colour balance

Every world uses the same three-light rig: a hemisphere sky and ground light, a directional sun, and a cool fill, under the same ACES tone mapping. The differences are deliberate, one mood per place, so they are kept:

| World         | Mood                                  | Key differences                                |
| ------------- | ------------------------------------- | ---------------------------------------------- |
| Tank          | A lit display tank                    | The brightest: sky 2.6, sun 3.2                |
| Outer reef    | Tropical sun over blue water          | Warm sun 2.4, blue-green fill, depth darkening |
| Kelp forest   | Golden-green light through the canopy | Green-gold sky and warm sun 2.3                |
| Sea cave      | Dim, with one sunbeam                 | The lowest: sky 1.1, sun 1.7                   |
| Under the ice | Cold, pale light through the ice      | Cold white sky, sun 1.5, blue fill             |

## Still to review later

- **Ice garden:** sponges and soft corals could become authored models.
- **Cave lobster dens and cleaner shrimp:** small, and acceptable at their size.
- **Sea butterfly:** better than the old sphere and discs, but still simple; it is about 2 cm and rarely seen close.
- **LOD switching for code-built creatures:** none have distance levels, as they are small. If Pass 059 finds the kelp forest's triangle count too high on real laptops, the stars and urchins are the first candidates for a distance level.
- **The world-tour cave view looking at the floor** pointed at the roof; the close-ups stand in for it.
