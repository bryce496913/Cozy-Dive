# V0.7 secondary environment art refinement (Pass 079)

This pass resolves the remaining environment weaknesses listed in Pass 074 (`docs/V07_VISUAL_INTEGRATION.md`, P2 and polish) without redesigning or expanding any world.

**Unchanged:**

- every location, room layout, passage and collider;
- every species and its count, and creature routes;
- lighting, palettes and water profiles.

## Office

The furniture is rebuilt from modelled forms in `src/environment/office/OfficeFurniture.ts`, replacing plain boxes and poles. The office's batcher, materials, warm palette, layout and walking footprints are unchanged. Every new piece stays inside its existing collision box (tested: everything stays inside the room).

| Piece        | Before                                      | After                                                                                                                                          |
| ------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Desk         | Thin slabs on black square tubes            | Walnut tops with eased edges over slim aprons; tapered legs under the return; a three-drawer walnut pedestal with bar pulls and a toe kick     |
| Task chair   | Box spokes, ball casters, box seat and back | Tapered spokes on twin-wheel casters; a gas lift in a shroud; a dished cushion with a waterfall front; a curved back shell with a lumbar swell |
| Guest chairs | A slab on four poles, a flat back           | Sled-base chairs: each side one bent chrome tube, with an armrest loop, a cross brace, a dished rust cushion and a curved cream back           |
| Cabinet      | A box with a line and two handles           | A carcass under an overhanging top, a recessed toe kick, two frame-and-panel doors with bar pulls                                              |
| Monitors     | A slab on a pole and a plate                | A slim bezel with a tapered housing, on a curved neck and an oval foot                                                                         |
| Boxes        | Two plain boxes                             | Softened cardboard boxes, tape over the seam, one flap half open                                                                               |

**Shared helpers:**

- `softBox`: a rounded box with subdivided faces, so it can be dished and bent smoothly.
- `contouredCushion`, `backShell`, `taperedSpoke`, `twinCaster`, `bentTube`, `taperedLeg` and `panelDoor`.

**Open-plan chairs:** the repeated chairs beyond the glass keep the lighter Pass 028 build (`distantTaskChair`). They are only seen at a distance.

**Not authored in Blender:** the existing architecture batches code-built office geometry. Modelling these forms in code kept that architecture, its colliders and its single-draw-per-material batching.

## Sea cave

**Boulder silhouettes.** The cave boulders were bare convex hulls, which read as smooth blobs across the cavern. They now render as a carved surface inside the same hull:

- the Pass 070 carving (fractures, pits, wear);
- new **massing** (`RockMassing` in `RockGeometry.ts`): three deeper fracture caps and two steep joint clefts, deepest low on the rock, which split each boulder into recognisable masses.

The hull remains the collider and fixes the rock's bounds, so placement and collision are unchanged. This is tested: the same planes and bounds, and every rendered vertex inside the collider. Tunnel-mouth rubble keeps the plain hull.

**Floor under the sunbeam.** The floor's height is unchanged; the change is colour only:

- a patchy green-gold diatom film where the light falls;
- a bleached centre and silt darkening round the pool's edge;
- gravel flecks.

Stones fallen through the skylight also lie in a loose fan under the beam: 26 half-buried slabs and pebbles. They are small enough to swim over, so they need no colliders, and they are merged into the boulder mesh (no new draw).

**Atmosphere:** darkness, visibility, passages, creature habitats and nooks are unchanged.

## Under the ice

**Clutter.** The seabed garden was scattered evenly, so dense sponges, corals and sea stars hid small animals everywhere. The same counts of every kind (110 sponges, 120 soft corals, 90 anemones, 110 sea stars, 50 feather stars) now form a hierarchy:

- **Clumps:** sponges stand in clumps of six, a tall barrel at the heart with smaller vases round it. Soft corals ring the same clumps.
- **Accents:** most sea stars and gravel anemones sit at the gardens' edges. The few giant stars are smaller (2.6–3.6 rather than 3.6–4.8).
- **Sand lanes:** three winding lanes run front to back and stay open, so krill, scallops, isopods and drifters show against bare seabed. This is tested: under 3 % of sponges and corals fall in the lanes.

**Materials:** ice, rock and seabed are unchanged and read coherently under the existing light. The sediment breakup below also applies here.

**Polar bear:** reviewed and unchanged. Its placement in an Antarctic world is recorded in Pass 074 and, as instructed, not changed here.

## Global: sediment repetition

The shared sediment material samples its upward faces twice (`breakup` in `Triplanar.ts`):

- a second sample, rotated and at about a third of the scale, blended through a slow, irregular mask;
- a broad tonal drift several metres across.

This hides the 1.4 m tile on every sediment floor (cave, ice and kelp), at the cost of one texture fetch and a few ALU operations per floor fragment. There are no new textures or geometry.

## Performance

Measured with `validation/v07/worlds.mjs` and `validation/v07/office.mjs` (SwiftShader), before → after. Draw calls are unchanged in every view.

| View                 | Draws | Triangles     |
| -------------------- | ----- | ------------- |
| Cave, cavern         | 57    | 1.18 → 1.19 M |
| Cave, boulders (far) | 56    | 1.18 → 1.20 M |
| Cave, sunbeam floor  | 50    | 1.14 → 1.15 M |
| Ice, open water      | 81    | 2.44 → 2.44 M |
| Ice, seabed (wide)   | 68    | 2.43 → 2.43 M |
| Office, overview     | 32    | 66.0k → 93.3k |
| Office, desk         | 25    | 61.5k → 88.7k |

The office grows by about 27k triangles, mostly the hero chairs; it remains the lightest scene by an order of magnitude. A first version reused the detailed chair at every open-plan desk (270k); those distant chairs went back to the light build.

## Validation

- **`tests/environment-refinement.test.ts` (new):**
  - carved cave limestone keeps the same collider and bounds, with every vertex inside it;
  - massing carves measurably deeper;
  - the under-ice garden keeps every count, with its sand lanes clear;
  - the office cushion and back-shell forms behave as described.
- **Targeted suites:** sea cave, under-ice, ice life and rare encounters, office (room bounds, walking, shadows, audio), collision, rocks, terrain, habitat and small-life tests pass (17 files, 152 tests).
- **Checks:** typecheck, lint and build pass.
- **Screenshots:** matched before/after views of each location are in `docs/screenshots/v07-pass079/`. No world traversal was run.

## Playtest follow-up: filling the ice and cave, and finishing the tunnels

**Playtest feedback:** "the ice and cave areas still feel empty compared to the outer reef and kelp ... add larger plant life and more rock/ice formation"; models and tunnels needed improving.

This round was agreed by the user in the playtest. It adds structure, but no new locations or animal species. Every addition is solid where it should be and keeps clear of:

- the sand lanes and the breathing holes' light;
- the tunnel approaches;
- the penguins' loop, the fish schools, and the whitetips' resting and settling spots.

### Large life (`src/environment/shared/LargeLife.ts`)

`SwayingAlgae` draws one instanced draw per form. A `sway` attribute (0 at the holdfast, 1 at the tip) bends each plant in the vertex shader on its own phase. The sway runs on simulation time and freezes with reduced motion.

- **Strap algae:** a short stipe and one long, gently rippled strap blade, 1.5–4 m tall. The form follows the giant Antarctic brown alga _Himantothallus_, and the strap kelps of sea caves.
- **Bushy algae:** a stipe forking into fine fronds, about 1 m tall. The form follows _Desmarestia_.

### Under the ice

- **Grounded ice:** six grounded iceberg fragments, each with a leaning shard, stand along the sides and the far end.
- **Ice columns:** two ice columns join the seabed to the sea ice near the side walls, with a wide foot, a waist and a broad head.
- **Rock outcrops:** four outcrops, clusters of four carved boulders up to about 3 m. They join the stones, so anemones and feather stars settle on them.
- **Algae:** giant strap algae ring the three breathing holes, and bushy algae grow round the outcrops and along the walls.

### Sea cave

- **Pillars:** two limestone pillars run from sand to roof against the side walls. Each has a flared foot, a carved double shaft and a broad head spreading into the roof. Every part is carved inside its own hull, which is its collider.
- **Sea fans:** 26 large orange and red sea fans sit on the walls (one instanced draw), facing into the cavern.
- **Kelp:** strap kelp rings the edge of the sunbeam's pool, with a few stands by the entrance.

### Tunnels

The tunnel mouths, the icicles and the tunnels' ends are reworked; this also applies to every world's tunnel mouths:

- **Smooth shading:** the shared `plain()` helper recomputed normals after de-indexing, which shaded every tunnel-mouth rock and icicle flat-faceted. Smooth normals are now kept.
- **Mouth rocks:** they are carved inside their hulls, with no clefts, and sized up a little so the ring still closes.
- **Icicles:** organic icicles, with a broad root, a slightly crooked body, drip rings and a fine tip (were six-sided cones).
- **Tunnel ends:** a receding throat narrows and fades to black, instead of the flat black disc at the cave's back tunnel and the ice tunnel's start (`tunnelThroat`).
- **Collars:** a rough rock collar covers the stair-stepped edge of the hole cut in the rock face round the ice and back-tunnel mouths, where the water showed through (`mouthCollar`).
- **Moiré:** anisotropic filtering on the shared rock, ice and sand maps, against moiré at grazing angles.

### Cost

| View              | Draws   | Triangles (first round → follow-up) |
| ----------------- | ------- | ----------------------------------- |
| Cave, cavern      | 57 → 60 | 1.19 → 1.25 M                       |
| Cave, back tunnel | 46 → 49 | 1.11 → 1.17 M                       |
| Ice, open water   | 81 → 79 | 2.44 → 2.56 M                       |
| Ice, far end      | 87      | 2.50 → 2.63 M                       |
| Ice, tunnel mouth | 57 → 60 | 2.22 → 2.37 M                       |

- **Draws:** each world gains two or three (algae, fans, collar).
- **Triangles:** about +0.06 M in the cave and +0.12 M under the ice.
- **First version:** the bushy algae doubled that. It was cut to two branching levels.

### Not in this pass

The seals, the polar bear and the cave lobster from the playtest screenshots are creature models; they belong to the paused creature pass (Pass 078, `codex/v0.7-pass-078-creatures`).

## Limitations

- **Office:** the furniture is code-modelled, not Blender-authored, and there is no fabric or wood micro-geometry beyond the shared maps.
- **Cave:** the floor film is vertex colour, so it is soft at the floor's grid resolution. The rubble has no colliders, by design: it is too low to block swimming.
- **Ice:** the clumps reuse the existing sponge, coral and star geometry; only placement changed. The grounded ice and columns are rounded carved lumps, softer than real fractured ice. Fish schools are not steered round the new formations, as they were not steered round the icebergs before.
- **Sediment:** the breakup applies to upward faces only. Steep sediment banks still show the base tiling.
- **Captures:** SwiftShader stills. The in-game look on the MacBook Air needs the user's check.
