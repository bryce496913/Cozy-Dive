# V0.8 Pass 093: Final Environment Polish

Base: main after Pass 092. Scope: the Pass 088 audit's remaining environment items:

- the wreck's boxy superstructure and sparse deck;
- the ice world's faceted rocks, sawtooth breathing holes and geometric ice;
- a composition review across the worlds.

Nothing is added to the world. No new species, areas or downloads. The fog, the torch and lighting
are unchanged: the outer reef's approved murk, and the wreck's and cave's Pass 089 fog.

- **Gallery:** `docs/screenshots/v08-pass093/` holds ten fixed views, before and after, from the
  game (`validation/v07/worlds.mjs`). Every "before" was rendered from a clean export of main.
  - Wreck: overview (exterior), deck, bridge, broadside, hull.
  - Ice: seabed close and wide, dropstones close, the underside, and a new `ice-breathing-hole`
    view looking up into the largest hole.

## Part A: Shipwreck (`src/environment/wreck/ShipwreckModel.ts`)

- **Plated walls.** The deckhouse and wheelhouse walls were flat, perfect boxes. Their plating now
  dishes inward between frames and seams by a few centimetres, a little unevenly per panel: the
  "hungry horse" look of an old riveted ship.
- **Openings.** Each window band has a sill under it and a drip rail over it, so the openings read
  as framed apertures rather than slots cut in a box.
- **Bridge wings.** The breastwork plating is dished, with a rounded capping rail along its top.
  Diagonal knee braces carry each wing out from the house; the wings were boards floating on the
  wall.
- **Boat deck.**
  - The roof over the deckhouse, where the davits stand, has a guard rail on its sides and after
    edge, clear of the funnel: stanchions with a top and a middle rail. A few bays have fallen,
    some stanchions lean, and some rails hang slack.
  - A ladder climbs the after wall to the roof.
  - Both are thin and carry no collision, like the existing wing rails.
- **Deck composition.** The deck had settled only 7 of the 30 growth sites, so colonies crowded the
  rails and hull and the deck read as bare plate. The same 30 sites are now split 11 deck and 19
  hull, using the same seed sequence. Colonies that settle over the deckhouse now grow on its roof
  instead of being dropped.

  Nothing was added: the growth was redistributed. Kinds, counts and sizes are unchanged. The cargo
  hold, bridge door, hatch, torch, navigation and wildlife routes are untouched.

## Part B: Under the ice (`IceEnvironment.ts`, `IceExtras.ts`)

- **Dropstones and outcrops.** These were smooth, faceted lumps. They are now the Pass 091
  Blender-authored rock (already shipped in `geology.glb`, so no download), placed in the same boxes
  at the same spots with their own convex collision, and darkened to basalt grey with their own
  light and shade kept.
  - Dropstones (glacial erratics) use the broad-footed, rounded and subangular variants, bedded a
    third into the mud.
  - Outcrops (bedrock) use the layered and jointed variants.

  The garden's stone list is identical, so everything that settles round the stones is unmoved.
  Without the geology (load failure, or still loading after 6 s) the lumps return.

- **Breathing-hole rims.** These were sawtooth crowns, because whole 0.5 m grid triangles were
  dropped. The sheet's vertices round each hole are now drawn onto the hole's own irregular, worn
  outline, and the sheet thickens and curls up into a rounded lip.

  The plain 24-sided cylinder chimneys are replaced by melt-scalloped shafts that follow the same
  outline, widening at the bottom where the water melts them.

- **Platelet ice.** The hexagonal discs read as cream starbursts in mass. They are now thin,
  irregular, faintly bowed flakes, drawn on both faces.
- **Small dropstones** (the scattered cobbles in `IceExtras`). These were pale, evenly lumpy
  icosahedra, a second rock family beside the dark erratics. They are now subangular cobbles with
  worn fracture faces, in the same dark basalt.
- **Anchor ice.** Rectangular box blades become thin, tapering crystal plates with ragged tips.
- **Sightlines.** I found no clutter hiding small animals in the views reviewed. The seabed's
  small life (isopods, brittle stars, sea spiders, scallops) reads clearly against the sand.
  Nothing was removed.

## Part C: Composition review

Reviewed in this pass's views and in the current Pass 088 to 092 galleries.

| Finding                                                                                             | Outcome                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ice: two rock families (pale icosahedron pebbles beside dark lumps)                                 | Fixed: one dark basalt family                                                                                                                                        |
| Wreck: deck bare beside crowded rails                                                               | Fixed: growth rebalanced onto the deck and boat deck                                                                                                                 |
| Wreck: superstructure box silhouettes                                                               | Improved (above); the funnel and wheelhouse massing are unchanged                                                                                                    |
| Ice: a seabed stone reads as hovering in `ice-seabed-close`                                         | Checked: no stone floats (each one's lowest point is below the seabed across its footprint, tested). It is the undercut silhouette against dark sand at fog distance |
| Tank: a few smooth Pass 061 boulders remain along the back-right wall, outside the habitat sections | Remaining (see below)                                                                                                                                                |
| Outer reef: the midground reads only as silhouettes in the approved murk                            | Unchanged by design (the fog is approved and must not change)                                                                                                        |
| Kelp, cave: geology and growth consistent since Passes 091 and 092                                  | No action                                                                                                                                                            |

## Part D: Cleanup

- **No unused assets.** Every shipped model is registered and loaded, so there was nothing to
  remove. This pass adds no assets and changes no download (still 44.00 MiB).
- **Rollback.** The code-built lumps remain as the fallback.
- **Collision and habitat anchors.**
  - Ice: the stones' collision is now the authored convex parts, and every stone is solid; before,
    only those over a metre were.
  - Wreck: collision is unchanged. The new rails and ladder are thin and carry none, like the
    existing rails.
  - No creature habitat or route anchor moved.

## Validation

- **New tests** (`tests/final-polish.test.ts`):
  - every vertex on a breathing hole's edge lies on its outline (the old cut left teeth up to
    0.5 m deep);
  - the ice world with the authored rock keeps its stone list, has more than twice the rock detail,
    and every stone is solid;
  - the wreck's deck carries 11 of the 30 growth sites (was 7);
  - colonies grow on the boat deck, all clear of the wheelhouse, funnel and davits.
- **Updated tests:** `tests/lifecycle-dispose.test.ts` lets the ice world build without waiting for
  the geology, as the kelp forest and cave do.
- **Full checks:** `npm run test`, `typecheck`, `lint` and `build` (see the PR). No full-game tour
  was run.

## Performance observations

These are from the capture harness, on SwiftShader.

| View               | Draws (before → after) | Triangles (before → after) |
| ------------------ | ---------------------- | -------------------------- |
| ice-seabed-wide    | 76 → 76                | 3.54 → 3.61 M              |
| ice-breathing-hole | 58 → 58                | 3.31 → 3.38 M              |
| ice-underside      | 69 → 69                | 3.94 → 4.01 M              |
| wreck-bridge       | 83 → 81                | 2.50 → 2.50 M              |
| wreck-hull-close   | 61 → 53                | 2.47 → 2.45 M              |

- **Ice:** about 70k more triangles (2%) from the authored rock; draws are unchanged.
- **Wreck:** the rails, ladder, sills and braces merge into the existing superstructure draw. The
  draw-count drops are culling differences between captures, not removals.
- **Build:** the ice build now briefly holds the geology lease, as the kelp forest and cave do.
- **Not measured:** frame rate on real GPUs.

## Remaining visual issues

1. **Tank back-right boulders.** A few smooth Pass 061 boulders along the back-right wall sit
   outside the Pass 082/083 habitat sections. They are the last ovoid rocks in the tank. Replacing
   them moves tank collision and fish interests, so it needs its own pass.
2. **Wreck massing.** The funnel and the wheelhouse's faceted front keep their simple forms. The
   superstructure is no longer flat, but it is still built from straight runs; there are no
   collapsed sections or holes rusted through.
3. **Wreck deck.** Busier, but still the quietest part of the wreck at swimming distance in the fog.
   Deck gear (winches, bollards, ventilators) is unchanged.
4. **Ice sea spider.** Its legs are plain rods (noted in Pass 088), outside this pass's
   environment scope.
5. **Ice rock style.** The authored rock reuses the kelp and cave forms, darkened. Purpose-made
   glacial erratics (striated, faceted by ice) would be more specific.
6. **Undercut stones.** At fog distance some undercut stones read as hovering, although none float.
7. **Breathing-hole shaft.** It is opaque ice; real shafts glow more where the ice is thin.
