# V0.8 Pass 082: reference-driven aquarium reef benchmark

One section of the personal aquarium is rebuilt to show the intended Crafted Stylized Realism
standard: the left bank of the central channel. Its parts:

- a reef ridge, replacing the accepted rocks 7, 11, 13, 19 and 31, whose hulls overlapped into
  one bank;
- a bommie standing in front of it (rock 17);
- the two hardscape colonies that grew on them.

It is a benchmark for approval. Nothing else in the tank, and no other world, is converted.
This pass stops at the approval gate.

**Rollback.** `?reef=original` shows the accepted section exactly as before: the same rocks,
corals, colliders, plants and fish interests. The accepted assets are untouched in
`reef-environment.glb` and the layout.

## 1. Reference study

The study used real reef photography (tropical reef flats and back-reef patch reefs), and
high-quality stylized-realism underwater environment art in general. No textures, models or
images were copied; every form is authored here. These are the characteristics reproduced, and
where each one lives:

| Reference characteristic                                                                                                                         | In the benchmark                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reef rock is a framework of old colonies**: lobate, knobbly, porous masses cemented together, not smooth boulders.                             | Each mass carries lobes of fossil coral heads along its rim, live-rock porosity (fine holes everywhere, larger pockets in clusters) and fracture lines.                                                      |
| **Ledges, overhangs and undercuts**: bioerosion eats a reef's foot back, so the top overhangs its own shadow. Patch reefs mushroom into bommies. | Every mass is eaten back below its upper edge. The buttress carries a shelf cantilevered over a grotto toward the channel. The bommie is a broad cap on an eroded stem.                                      |
| **Vertical structure and separate pinnacles**, not one level mound.                                                                              | A flat-topped buttress, a stepped terrace, and a three-tier tower at the far end joined to a low spur by an arch, with a talus of tilted slabs sloping into the sand.                                        |
| **Corals grow across the rock**: from encrusting bases, in a zonation by light and current.                                                      | Branching on the light-filled tops, a table as the horizontal accent, massive heads on ledges, plates out of vertical faces, soft corals on rims, and sponges and encrusting growth in shade and under lips. |
| **Families differ in construction, size and height.**                                                                                            | Spreading staghorn thicket (focal), corymbose bushes, tabular Acropora, brain coral, Porites-like hummocks, plating colonies, leather and finger soft corals, tube sponges, encrusting sponge.               |
| **Rock surface life in colour, not texture noise**: turf algae on tops, coralline crusts on shaded faces.                                        | Vertex painting: olive turf on upward faces, muted pink-lilac coralline blotches on steep shaded faces, darker recesses, a sand-dusted foot.                                                                 |
| **Seagrass and macroalgae at the reef margin**, in clumps, thinning away from the rock.                                                          | Turtle-grass tufts, Halimeda and red algae in 14 clusters where sand meets rock (most on the channel side), plus algal tufts on the ledges.                                                                  |
| **Composition**: foreground, midground, background; negative space; one focal point.                                                             | Foreground bommie and grass; midground ridge with the staghorn thicket and table coral as the focal pair; tower behind; the sand channel left open.                                                          |
| **Restrained palette**: calm neutrals, with saturated colour as sparse accents.                                                                  | Warm limestone, brown-to-lavender coral with pale tips, muted massive-coral browns, and a few accents (orange crusts, lavender tube sponges).                                                                |

**What makes this stylized realism and not photorealism.** The forms are organised for reading:

- big readable masses and a clear focal pair;
- a controlled density of detail;
- colour hierarchy over texture noise.

## 2. Method

Blender (via `bpy`) builds everything in aquarium world space, so the runtime places nothing.

1. **Primary forms (composed by hand).** `tools/art/pass082/reef_benchmark.py` lists the masses
   one by one, each with a centre, size, orientation and erosion. The list is 15 for the ridge
   and 2 for the bommie. The grotto, the arch's window and the anemone's pocket are placed at
   chosen coordinates.
2. **Secondary forms.** Each mass carries:
   - domain-warped outlines (no straight edges, no rectangular plans);
   - an undercut lower face;
   - rim lobes;
   - chipped edges.
3. **Tertiary detail (procedural, restrained).** Porosity and fine wear. The body is a signed
   distance field, polygonised and reduced in Blender.
4. **Life.** `life.py`:
   - **Hand-placed heroes:** the staghorn thicket where the accepted colony stood, the brain
     coral crowning the bommie, and the table coral on the terrace knob.
   - **Rule-placed smaller colonies,** over the actual rock surface by habitat rules: massive
     heads on ledges, plates on exposed vertical faces, encrusting sponges under lips, soft
     corals on rims. Placement is densest near the focal buttress and keeps clear of the living
     seats.
5. **Vegetation.** `vegetation.py` builds unit-height templates for the existing current-driven
   sway, plus their placements.
6. **Export.** `build.py` writes `public/assets/models/reef/reef-benchmark.glb`:
   - rock, coral and soft meshes, each with a distance level;
   - plant templates and placement empties;
   - one convex collider per composed mass, plus the two hero colonies.

   Draco and KTX2 compression come from `tools/art/pass017/compress.mjs`.

The `.blend` source is `tools/art/pass082/reef-benchmark.blend`.

**Iteration record (Cycles previews, not shipped).**

1. **Carving inside the old hulls** kept the rounded-boulder silhouettes. Rejected: it was the
   look this pass replaces.
2. **Composed rectangular slabs** read as stacked primitives. Rejected.
3. **Lobed, warped masses with live-rock porosity** were accepted. Coverage and the colony
   families were then iterated three times: a wider thicket, real brain meanders, muted massive
   heads, and denser margins.

## 3. Integration and safety

- **Overlay.** `AuthoredReef` loads the benchmark beside the reef library (`reefBenchmark` in
  the asset registry):
  - it hides the section's six rocks and two colonies;
  - it shows the new meshes;
  - it swaps the section's colliders, as one group, for the benchmark's convex parts. The
    swimmer and the fish share that collider list, so both treat the new rock as solid.
- **Covered items.** Plants, rubble and understory instances that the new rock covers are
  withheld. So are fish interest points inside it (`Aquarium.suspendInterests`).
- **Unchanged:**
  - the layout's random stream, so the fish spawns, plants and anemone are the same;
  - the host anemone keeps its seat (tested);
  - the central channel stays open (tested: no part reaches past x = −2.6);
  - every other rock, coral, ornament and placement.
- **Rollback.** Everything returns with `?reef=original`, or if the benchmark asset fails to
  load.

## 4. Before and after

All captures are in `docs/screenshots/v08-pass082/`. The before (left) and after (right) of each
pair share one camera, exposure, resolution and fixed simulation clock, and the same renderer.
They are SwiftShader captures of the real game, from `validation/v07/baseline.mjs` with
`COZY_BENCH=1`.

| Distance        | Pairs                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Normal swimming | `swim-1` (bommie in front, ridge behind), `swim-2` (the bank from the channel)                                           |
| Medium          | `medium-1` (buttress, shelf, grotto), `medium-2` (the ridge with anemone, staghorn, table coral, tower)                  |
| Close           | `close-coral` (the staghorn thicket), `close-rock` (rock surface, grotto, growth), `close-bommie`                        |
| Pass 061 views  | `p061-tank-section-swim`, `p061-tank-branching-coral-close`, `p061-tank-section-medium`, `p061-tank-massive-coral-close` |

`blender-preview-ridge.jpg` is an untextured Cycles preview from the authoring loop.

### Why the result is artistically better

- **Silhouette.**
  - _Before:_ five rounded boulders of one size huddle together. A brain coral sits on a stone
    pedestal like a ball on a post.
  - _After:_ one reef bank with a readable profile. A flat-topped buttress overhangs a grotto, a
    stepped terrace carries the anemone, a tiered tower stands at the far end, and a mushroomed
    bommie stands in front. It has overhangs, cavities and separate pinnacles, and reads as
    built by growth and erosion.
- **Construction.**
  - _Before:_ coral sat on rock as a separate object.
  - _After:_ every colony starts from the rock. The staghorn spreads from an encrusting base,
    the brain coral crowns the bommie, plates grow out of the walls, and sponges and crusts sit
    in shade under lips.
- **Variety at three scales.**
  - _Primary:_ the masses.
  - _Secondary:_ lobes, ledges and grooves.
  - _Tertiary:_ porosity, corallite pits and meanders.

  Colony families differ in size, height and form. The old section had two colonies.

- **Focal point and composition.** The staghorn thicket and table coral above the anemone make a
  clear focal group. The bommie and grass frame the foreground, the tower closes the view, and
  the channel stays open.
- **Material and colour.**
  - **Rock:** warm limestone, turf on the tops, coralline crusts on shaded faces, darker
    recesses and a dusted foot, carrying the existing triplanar maps.
  - **Coral:** keeps relief maps but takes its colour from its own painting, not the brain
    texture.
  - **Palette:** saturated colour is kept to small accents.

### Against the approved V0.7 benchmark (Pass 062, treatment B)

| Pass 062 B criterion                                                        | Benchmark section                                                                                                                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slab-built rock with ledges, bedding and an undercut, pressed into the sand | Yes, pushed further: cantilevered ledges, a grotto, an arch window, lobate rims, and a foot carried below the sand.                                               |
| Single grounded colonies with skirts                                        | Yes: encrusting bases and skirts. The brain coral flares over the bommie's cap.                                                                                   |
| Antler anatomy; broad, legible meanders                                     | Yes: the staghorn forks two to three times with an upward bend and pale tips; the brain coral's meanders are contour bands about 5 cm apart.                      |
| Clean blade gradients                                                       | Yes: turtle grass is pale at the base, green in the body and yellowing at some tips.                                                                              |
| Warm key, cool rim                                                          | Unchanged: the tank lighting is the accepted one.                                                                                                                 |
| Fine detail as close-up accents, not noise                                  | Mostly. Porosity is clustered and fine pits are shallow. Some massive heads still read as sprinkled blobs at medium distance (see concerns).                      |
| Budgets                                                                     | Hero masses about 12–20 k triangles each, as in the benchmark. The section's colonies are heavier than B's single coral, because there are many more (section 5). |

## 5. Cost

**Section triangles at full detail** (distance level beyond 14 m in brackets):

| Mesh                                                        | Triangles        |
| ----------------------------------------------------------- | ---------------- |
| Ridge rock                                                  | 63,062 (15,765)  |
| Bommie rock                                                 | 11,991 (2,996)   |
| Hard corals (staghorn, table, brain, heads, plates, bushes) | 103,713 (25,928) |
| Soft corals and sponges                                     | 31,710 (7,926)   |
| Plants: 114 instances of three templates                    | 192–750 each     |

The accepted section had six 20 k-triangle hero rocks and two colonies.

**Frame totals** (SwiftShader, before → after):

| View                         | Draws     | Triangles             |
| ---------------------------- | --------- | --------------------- |
| bench-swim                   | 131 → 129 | 0.98 → 1.06 M (+8 %)  |
| bench-swim-channel           | 130 → 128 | 0.96 → 1.13 M (+18 %) |
| bench-medium-ridge           | 124 → 122 | 1.01 → 1.11 M (+10 %) |
| tank-section-swim (Pass 061) | 144 → 142 | 1.06 → 1.22 M (+15 %) |

- **Draw calls:** down by two in every view. Four LOD meshes and three instanced plant batches
  replace six rock LODs, two colony groups and their parts.
- **Asset:** `reef-benchmark.glb` is 1.68 MB (Draco, with no images: colour is vertex paint, and
  the runtime reuses the shared reef maps). `reef-environment.glb` is unchanged.
- **Materials:** three triplanar materials (rock, hard coral, soft coral). The plants share the
  existing plant program.
- **Not claimed:** frame time. These are SwiftShader counts; the MacBook Air judgement is the
  user's.

## 6. Validation

**Project checks:**

- typecheck, lint and build pass;
- the full test suite passes (100 files, 1,032 tests).

**New `tests/reef-benchmark.test.ts`:**

- rollback flag;
- the replaced rocks and colonies exist in the accepted layout;
- every visible rock vertex is covered by a convex part;
- the anemone keeps its seat;
- the central channel stays clear;
- plant templates follow the sway contract;
- fish interests are withheld and restored in place.

**Two existing tests now allow an untextured static asset:** asset validation and compression.
Every texture that exists must still be KTX2.

**Browser:** the aquarium-only rendering checks (the seven benchmark views and the seven Pass 061
tank views) load with 0 errors. No long stress testing was run.

## 7. Remaining concerns (for the approval decision)

1. **Massive heads.** At medium distance some read as scattered blobs on the ridge top. They
   need more of them, merged into larger encrusting fields, or fewer and larger.
2. **Staghorn tips.** They read pale and slightly icy under the tank's bright key, even after a
   slight grey. A warmer tip colour may be wanted.
3. **Rule-placed colonies** are placed by habitat rules, not hand-tuned one by one. A conversion
   pass would hand-adjust the visible ones.
4. **Collision.** One convex hull per mass is conservative in the grotto and under the shelf:
   the swimmer stops short of their back walls. Fish don't enter (by design).
5. **Engine look.** The Cycles previews in the authoring loop are untextured. The in-engine
   result is the reference.

**Approval gate.** No other section is converted. If this direction is approved, the same method
(composed masses, rule- and hand-placed life, an overlay with rollback) would extend to the rest
of the tank, one area at a time.
