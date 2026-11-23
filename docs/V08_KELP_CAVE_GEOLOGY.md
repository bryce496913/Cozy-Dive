# V0.8 Pass 091: Kelp and Sea Cave Geological Refinement

Base: main after Pass 090 (and the ice fog follow-up). Scope: the kelp forest's boulders and wall
rocks and the sea cave's boulders and pillars. These were the remaining prominent code-built rocks.
They are replaced with Blender-authored variants made by the approved Pass 082/083 sculpt method.
No new species, no world expansion, no change to routes, lighting, fog or passages.

- **Source:** `tools/art/pass091/geology.py`, with the Blender file `tools/art/pass091/geology.blend`.
  It builds `public/assets/models/reef/geology.glb`. The code rocks (`rockShape`,
  `limestoneGeometry`) are kept and still used as the fallback, which also serves as the rollback.
- **Gallery:** `docs/screenshots/v08-pass091-geology/` has 13 fixed views, before and after, from
  the game itself (`validation/v07/worlds.mjs`). Every "before" was rendered from a clean export of
  main. `variants-turnaround.jpg` shows the authored forms in Blender, unpainted, under a plain
  studio light.

## 1. What was primitive

| Where                 | Before                                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kelp boulders (30)    | One 506-triangle rounded rock, stretched to each footprint. They read as smooth grey-brown ovoids (`kelp-rocks-close`, `kelp-forest`)                                                         |
| Kelp wall rocks (36)  | The same rock, piled along the walls' foot                                                                                                                                                    |
| Cave boulders (16)    | Carved convex hulls (`limestoneGeometry`): slab facets, a low-poly silhouette up close                                                                                                        |
| Cave pillars (2)      | Four stacked hull parts each, stretched about 2.5 times vertically, so the facets became long flat slabs. They read as a stack of crates against the light (`cave-wall-close`, `cave-pillar`) |
| Life on kelp boulders | Sea stars, anemones and nudibranchs were seated on an assumed ellipsoid, which only matched the ovoid rock                                                                                    |
| Kelp holdfasts        | Stalk placement ignored the boulders. 9 forest stalks grew out of a boulder and 26 wall-thicket stalks out of a wall rock                                                                     |

## 2. The authored rock

Fourteen variants (`geology.glb`), each under `<name>_Root` with convex collision parts:

- **Kelp coastal rock (6):**
  - tilted sandstone slabs;
  - a water-worn boulder broken by a fracture face;
  - an overhanging ledge over a cavity;
  - a boulder split by a joint;
  - a low bench with eroded steps;
  - a tor of stacked blocks.

  The kelp stone is painted dark and weathered. Hollows and the foot are darker; fresh fracture
  faces and worn crests are paler; upward faces carry faint coralline warmth.

- **Cave limestone (6):**
  - a bedded block with a waterline notch;
  - a dissolution dome;
  - a tilted bed;
  - a fallen roof slab;
  - a leaning pair;
  - a shelf over a hollow.

  The limestone is pale stone with strata bands, dark cavities and a silt line at the foot.

- **Cave pillars (2):** authored at column proportions, so the runtime scales them almost evenly.
  Each is one continuous column from below the sand into the roof: a flared foot, an eroded waist
  of offset drums, and a head spreading into the roof.

**Method.** Smooth-unioned masses with fracture planes and undercuts. These are clipped to the
variant's box, then carved cavities are added. Weathering is applied in a band near the surface,
then the volume goes through marching cubes, decimation and form-driven vertex painting.

The weathering is specific to rock, not the reef's live-rock porosity:

- a few rounded solution pockets in clusters;
- shallow bedding grooves along the strata;
- broad undulation of the faces.

The first build reused the Pass 082 porosity. On rock this size its dense fine holes decimated into
crumpled, spiky pits that read as paper at swimming distance, so it was replaced. The surface is
also blurred more widely before meshing, which gives broad continuous faces. Detached fragments are
dropped, so each rock is one connected body.

**Budgets.** Kelp and cave rocks are 2,400 triangles each; pillars are 6,000 each. These are tested
limits.

## 3. Runtime

- **`environment/shared/Geology.ts`:** copies a variant's geometry and its hulls out of the loaded
  model. `placeGeology` fits the variant into an existing placement's box (the same footprint,
  height, sink depth and turn the code rock used) and pushes its colliders. Everything else stays
  put: the layouts, crack positions, habitats, fish obstacles and passages.
  - Visual geometry stays plain float position, normal and colour, so it merges into the existing
    single `Kelp boulders` and `Cave boulders` draws. Draw calls are unchanged.
- **Variant choice:**
  - kelp boulders use `KelpRock_[(5i+1) mod 6]` and wall rocks `KelpRock_[(7i+4) mod 6]`, so
    neighbours rarely repeat;
  - cave rocks use `CaveRock_[i mod 6]`;
  - each pillar position uses its own `CavePillar`.
- **Loading.**
  - `KelpForestScene.build` and `SeaCaveScene.build` acquire the geology before the environment
    step and release the lease when the build ends.
  - The build waits at most `GEOLOGY_WAIT_MS` (6 s). After that, or if loading fails, the world
    builds with the code rock and logs a warning. A lease that arrives late is released, which is
    tested.
- **Holdfasts (`KelpStalks`):**
  - forest stalks never root inside a rock's footprint. The groves fill elsewhere, so the forest
    keeps every stalk;
  - wall-thicket stalks over a wall rock step out in front of it, up to 3 m, to grip the sand at
    its foot. Where several rocks overlap, the stretch stays bare rock: 3 of 110 wall stalks.
  - Many holdfasts now sit right at rock feet, so rock and kelp read as one habitat.
- **Life on the rock (`BoulderSurface`):**
  - each authored kelp boulder samples its real outer surface once at build time. Its vertices are
    binned by direction on the same ellipsoid frame the seats were addressed on.
  - `onBoulder` (sea stars, anemones, nudibranch creep) reads that surface instead of the ellipsoid.
    The lookup is allocation-free, for the per-frame nudibranchs.
  - With the old ellipsoid seats, 25% of the life would have hung off the fractured rock; on the
    real surface, 7% does (tested).

## 4. Validation

- **Tests:** `tests/kelp-cave-geology.test.ts` covers:
  - every variant and its collision parts;
  - the triangle budgets;
  - asymmetric, distinct outlines per variant (not one repeated round boulder);
  - authored rock and colliders placed in both worlds;
  - no holdfast inside a rock;
  - the forest kept full;
  - life seated on the real surface.

  The existing kelp, cave, passage, return-tunnel, habitat, fog, art-consistency and creature suites
  now build both worlds with the authored geology, decoded on the CPU by `validation/geologyModel.ts`.
  These are the same rock and colliders the game uses, and the suites pass unchanged:
  - the tunnel and grotto thresholds map into open water;
  - the cave can be swum from both tunnels into the cavern and home again;
  - the walls stop the swimmer;
  - the lane and exit stay clear;
  - the whitetip, lobster and crab habitats stay clear.

- **Full checks:** `npm run test` passed (1082 tests), and `typecheck`, `lint` and `build` are
  clean. No complete world journey was run, as the brief specifies.
- **Browser:** headless Chromium on SwiftShader (software WebGL), 13 views, before and after, with
  no errors. These views check visuals, not frame rate.

### Gallery notes

- **`kelp-rocks-close`:** the smooth ovoids become a ledged slab with eroded cavities beside
  stacked blocks. The anemones and sea stars sit on the real faces.
- **`kelp-forest`, `kelp-forest-wide`:** at distance the rocks read as layered coastal stone among
  the kelp, not grey eggs. The sandy lane, light and haze are unchanged.
- **`cave-wall-close`:** the faceted slab pillar becomes an eroded, layered column. The foreground
  boulder is a bedded block.
- **`cave-pillar`, `cave-boulders-far`, `cave-cavern`:** the pillars read as continuous columns in
  the murk. The Pass 089 fog, sunbeam and passage glows are unchanged.
- **`cave-back-tunnel`, `cave-return-tunnel`:** the tunnel mouths are unchanged and not narrowed.
  The return tunnel's glow still reads.

## 5. Performance

| World       | Rock triangles (code to authored) | Whole environment triangles | Draws         | Colliders |
| ----------- | --------------------------------- | --------------------------- | ------------- | --------- |
| Kelp forest | 35,420 to 157,295                 | 93,923 to 215,798           | 8 (unchanged) | 101 → 210 |
| Sea cave    | 20,620 to 58,240                  | 107,056 to 144,676          | 19 (same)     | 34 → 52   |

- **Triangles.** The kelp forest has 66 rocks, so its rock carries most of the increase. That is
  about 2,400 triangles per visible boulder, in line with the Pass 085 outer reef pieces. The whole
  rendered kelp scene is about 3.4 M triangles, dominated by the instanced kelp.
- **Draw calls** are unchanged: the rock still merges into one draw per world.
- **Colliders** are the authored convex parts. The collision grid keeps lookups local.
- **Build time.** Environment construction measured faster with the authored rock, because there is
  no hull carving: kelp 848 to 554 ms and cave 1495 to 671 ms in Node. These figures are noisy and
  were taken on a loaded machine.
- **Download.** `geology.glb` is 391 KB (Draco). The model total is 43.87 MiB of the 44 MiB budget,
  leaving about 0.13 MiB of headroom. The next asset pass will need to free space or raise the
  budget deliberately.
- **Not measured:** frame rate on real GPUs or laptops (SwiftShader only).

## 6. Known limitations

- **Cave walls** (the shell, its mouth formations and the skylight rim) are not changed by this
  pass. They are the Pass 086 geology, and the rock-to-seabed transition at their foot is
  unchanged. The new boulders and pillars are seated a third into the sand, as before.
- **Hollows.** Collision hulls are convex, so a rock's deepest hollows are solid to the swimmer. The
  same is true of the reef pieces.
- **Neighbouring variants.** With six variants per family, two neighbouring boulders sometimes share
  a variant. They differ in turn and proportion.
- **Uncovered seats.** The kelp wall rocks carry no seated life, as before. Nudibranch seats that
  fall in a cavity mouth can sit slightly proud of the rock (the 7% above).
