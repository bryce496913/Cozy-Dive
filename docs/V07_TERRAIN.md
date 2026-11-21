# V0.7 rocks, terrain and seabed (Pass 070)

Foundational geometry moves from smooth, assembled shapes toward naturally formed rock and sediment.

**Unchanged, and tested:**

- routes, passages and gameplay boundaries;
- collision volumes;
- creature navigation and world transitions.

No new areas were added.

## Audit

| Surface                                                                                              | Source                                           | Finding                                                                | Pass 070                                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Boulders and wall rocks (kelp, cave, ice), crevice, cave arch, limestone, home-tank procedural rocks | `RockGeometry.ts` (shared)                       | Each rock rendered as a bare convex hull: smooth, inflated, repetitive | **Carved** (below)                                     |
| Cave and ice sand floors                                                                             | `HabitatSurface('sediment')`                     | 14 identical straight ripples per tile, tiled: obvious stripes         | **Natural ripple field** (below)                       |
| Kelp seabed                                                                                          | vertex-coloured height field                     | Rock and sand met with no transition                                   | Silt-and-grit contact shading round every boulder      |
| Ice walls, icebergs, ice lumps                                                                       | `RockGeometry.ts` and ice materials              | Crisp, faceted character worth keeping                                 | Carved with fracture planes; character preserved       |
| Tank and outer-reef rock                                                                             | authored `reef-environment.glb` (Passes 014–015) | Already sculpted, textured and LOD'd                                   | Reviewed: kept                                         |
| Cave walls and ceiling, tunnels, wreck cavern, under-ice ceiling                                     | code (lumpy walls, triplanar limestone and ice)  | Continuous, already relief-mapped                                      | Reviewed: kept (they use the improved shared surfaces) |

## Carved rocks, compatible with collision

`createRockGeometry` still builds the same seeded convex hull. That hull stays the rock's envelope and its collider, but the rendered rock is now a finer surface projected onto the hull and carved only inward:

- **Fracture planes:** caps cut off the rock leave flat broken faces with crisp edges. The fractured family gets five, slabs three, boulders two.
- **Bedding grooves:** on sedimentary slabs.
- **Solution pits and cavities:** 8 to 14 per rock.
- **Erosion:** lumpy mid-scale relief and fine rounded wear.
- **Colour:** carved hollows darken, as they hold shadow and silt.

**How collision stays compatible:**

- **Inside the envelope:** carving never pushes outward, so the rendered rock is always inside its envelope. Routes can only appear slightly roomier, never narrower.
- **Stored hull:** the exact hull travels with the geometry as plain data (`userData.collisionHull`, kept by `clone()`). `rockCollider` uses it while the geometry is untransformed, so colliders are the original hulls: the same planes and the same bounds.
- **Fallback:** once a geometry has been transformed, `rockCollider` falls back to the convex hull of the rendered vertices, which still contains the rock.
- **Pinned bounds:** callers fit rocks to their bounding box, so a slightly smaller carved box would have scaled rocks (and colliders) up. The hull's six extreme points are appended as zero-area triangles, which pins the rendered bounds to the hull's exactly.

  The first build without this was caught by the crevice test: a rock had edged into the clear sand channel (0.692 against the 0.7 limit). Placements are now unchanged.

**Detail:** carved rocks use an icosphere of level `detail + 2`, capped at 4 (pebbles at 3).

## Seabed

**Sediment texture.** The shared sediment texture is regenerated at 256 px. It stays seamless, using integer frequencies only. The new field has:

- current ripples whose direction and wavelength wander, that fork and vary in crest height;
- an asymmetric profile (a steeper lee side) and a faint cross-ripple;
- grain, plus scattered pale shell flecks and dark grains;
- a softer normal strength (0.65 → 0.5).

This reaches every floor that uses it: the cave and ice floors, plus anything else triplanar-mapped with sediment.

**Kelp rock-to-sand transition.** Silt and grit darken the sand around each boulder's foot. The contact is drawn in colour only, so the floor height used for navigation is unchanged.

## Cost

From the browser world harness (`validation/v07/worlds.mjs`) and baseline (`validation/v07/baseline.mjs`, `COZY_OUTER=1`), before → after:

| View           | Triangles     | Draws     |
| -------------- | ------------- | --------- |
| Kelp forest    | 2.53 → 2.65 M | 56        |
| Kelp rocks     | 2.39 → 2.51 M | 42        |
| Cave cavern    | 1.07 → 1.18 M | 57        |
| Ice open water | 2.41 → 2.44 M | 81        |
| Wreck          | unchanged     | unchanged |
| Tank (all)     | unchanged     | unchanged |
| Outer reef top | 3.93 → 3.93 M | 118       |
| Outer wall lip | 4.25 → 4.25 M | 116 → 120 |

- **Downloads:** no new textures or files.
- **Memory:** the sediment texture is 256 px instead of 128 px (three small CPU-generated maps per surface kind).

## Validation

- **`tests/terrain-overhaul.test.ts` (new):** for four representative rocks, it checks that:
  - each renders inside its envelope with exactly the envelope's bounds;
  - the collider equals the bare hull's (planes and bounds);
  - more than 30 % of vertices are carved over 2 cm deep.

  It also checks that a transformed rock falls back to a containing hull, and that the sediment texture varies across the tile.

- **Updated test:** `tests/reef-environment.test.ts` now builds the authored rocks' accepted hull from `rockCollider` (the envelope), not from the template's triangles.
- **Full suite:** 94 files and 957 tests pass, including the passage and crevice channel, rock placement, collision, fish habitat simulation, and world tests. Typecheck, lint and build pass.
- **Browser smoke:** the kelp, cave, ice and wreck worlds (12 views), plus the tank and outer reef (10 views), render with no errors.

## Limitations

- **Authored rocks:** the tank and outer-reef rock library is unchanged (already authored).
- **Kelp sand:** still a vertex-coloured field without the sediment texture; adding it would need care with its caustics shader.
- **Tiling:** the sediment field still repeats every tile (about 1.4 m). It is no longer obviously striped, but a second, larger-scale sample would break it up further.
- **Tunnels:** tunnel and cave-wall geometry is unchanged.
- **Floor cracks:** rock fractures are geometric, not paired with debris or rubble at their feet.
- **Captures:** SwiftShader stills; motion and lighting in the real game need a short look.
