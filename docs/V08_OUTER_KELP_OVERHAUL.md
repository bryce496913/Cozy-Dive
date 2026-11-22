# V0.8 Pass 085: Outer Reef and Kelp Forest Visual Overhaul

Base: main after Pass 084. Scope: the outer tropical reef and the kelp forest. Gameplay systems,
creature encounter paths, the reef's seeded layout and its environmental boundaries are kept.

Galleries: `docs/screenshots/v08-pass085/` (before on the left, Pass 085 on the right, from the
real game at identical cameras and simulation time: `validation/v07/baseline.mjs` with
`COZY_OUTER=1 COZY_OUTER_ONLY=1` for the outer reef, `validation/v07/worlds.mjs` with
`COZY_WORLDS=kelp` for the kelp forest).

## 1. Audit (before)

- **Outer reef.**
  - The pieces were the tank's old reef library: one family of rounded "pillow" rocks scattered
    one per 3.8 m cell.
  - Brain-coral domes and tiered plating "towers" stood on the crowns of the rocks like ornaments
    on pedestals.
  - The seagrass was straight library blades.
  - The lip of the drop-off was a row of the same pillows.
- **Kelp forest.**
  - The blades were short, straight, pointed strips at regular spacing: a rigid, "bamboo-like"
    silhouette.
  - The stipes were constant-width tubes.
  - The stipes rose from a bare point among the holdfast's roots.
  - Every plant faced a random direction, so the forest read as uniform columns.

## 2. Outer reef: reusable authored variants

`tools/art/pass085/variants.py` (Blender source `reef-outer.blend`; asset `reef-outer.glb`, 0.57 MB)
builds, by the approved Pass 082/083 method:

- **Six rock variants**, each inside the library's ±0.85 unit footprint, so every placement keeps
  its size:
  - a flat-topped table with an undercut lip;
  - a stepped ridge of tilted beds;
  - a plinth with two pinnacles;
  - a mass with a cantilevered shelf over a grotto;
  - a low fractured mound;
  - a stack of tilted slabs.

  They carry Pass 082B fracture planes, porosity and form-driven painting, with convex collision
  parts per composed mass.

- **Nine colony variants that grow over the rock** instead of standing on it:
  - encrusting massive fields whose skirts drape over the rock's edges;
  - a staghorn thicket, a corymbose bush cluster, and a thicket with a bush;
  - two tabular Acropora and a tier of plates on a short stub.

  These are Pass 082B constructions; no new species.

- **Seagrass:** the Pass 083 arching turtle-grass tufts replace the straight blades.

The runtime (`OuterReef`) swaps these in per template over the same seeded placements and the same
instancing. It uses one draw per template and level, one level at every distance as before (no
popping), and the Pass 082B material families. The library pieces remain the fallback.

**Composition.**

- The reef-top matrix rocks are 20 % broader and flatter, so neighbours (3.8 m apart) meet, and
  the reef top reads as one connected structure with layered ledges (the same random draws, so
  everything else in the layout is unchanged).
- The bommies remain the primary landmarks.
- The sand gully and the tunnel mouth stay open.
- The lip is now a craggy edge over the blue.
- Distant silhouettes use the same composed forms, a little cooler, within the existing 36 m
  backdrop distance (no draw-distance increase).

**Fish containment.**

- Each rock's "reef face" interest point now sits low on its face, inside every variant. Some
  variants are lower than the old pillows, and half the height stood in open water above them.
- There it became the only shelter for the yellow assessors, so they could not spawn: found and
  reproduced in a unit test.
- With the interest lower, the fish behave as before; a test spawns every reef school against the
  variants' collision.

## 3. Kelp forest

`src/environment/kelp/KelpStalks.ts` (procedural; instanced per template):

- **Blades:**
  - long and lanceolate, on a short stalk;
  - widest a third of the way along, with a long taper to a soft tip;
  - they arch out from the stipe and then droop, the lowest heaviest;
  - they swerve and twist along their length;
  - they are cupped across their width, with ruffled, wavy margins.

  Ten segments of three quads across replace eight segments of two, and the blades are fewer and
  longer (one every 50-75 cm, from 34-50 cm).

- **Stipes** taper from 6 cm at the holdfast to 2 cm under the canopy.
- **Holdfast:** each grows from a knotted crown, so the stipes rise out of it rather than from a
  point among the haptera.
- **Direction:** the current has a heading. Plants turn within 0.9 rad of it and their blades trail
  broadly downstream, so the forest flows one way without repeating rows.
- **Templates:** seven (from five), from young plants well below the canopy to the tallest at the
  surface. They have 2-5 stipes each and canopies of 4-8 blades, so stands vary in size and
  density.
- **Motion:** the travelling-wave sway, the blade flutter (now along ten segments, so it bends
  smoothly), and the lean away from the swimmer are unchanged.

## 4. Performance (SwiftShader, same views)

| Measure                      | Before → Pass 085                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Outer reef, frame triangles  | 3.68-4.07 M → 2.91-3.19 M (about -22 %): the variants are lighter than the library's coral levels |
| Outer reef, draw calls       | 111-152 → 111-149 (unchanged within a few)                                                        |
| Kelp forest, frame triangles | 2.89-3.06 M → 3.13-3.30 M (+8 %)                                                                  |
| Kelp forest, draw calls      | +2 (two more templates)                                                                           |
| New asset                    | `reef-outer.glb` 0.57 MB (Draco, no textures)                                                     |

Measured under SwiftShader only; no laptop measurement.

## 5. Validation

- **Checks:** typecheck, lint and build pass.
- **Targeted tests pass** (17 files, 201 tests):
  - the new `tests/outer-kelp-overhaul.test.ts`: variant footprints and collision parts; colonies
    low and spreading, not pedestals; unit-height seagrass; every reef school spawning against
    the variants' collision (fish containment); kelp plants within the current spread; kelp
    templates within their triangle budget;
  - the existing outer reef, creature routes and boundaries, draw distance, worms and spawning
    suites;
  - the kelp forest, passage, vegetation and plant animation suites (including the lean away from
    the swimmer);
  - asset validation, loading and compression.
- **Browser:** one capture run per world (outer reef 7 views, kelp 6 views), 0 errors, including the
  swim through the passage into the outer reef. No full-game traversal.

## 6. Known limitations

- The kelp forest's boulders are still the code-built rocks (only the plants changed there).
- At swimming distance the encrusting fields can read as soft mounds through the haze.
- The kelp blades are flat-shaded vertex-coloured sheets with no translucency map.
- The `outer-reef-west` view in the harness looks into the cliff and is left out of the gallery.
