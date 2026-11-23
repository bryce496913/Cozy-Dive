# V0.8 Pass 096: Shared Creature Models and Aquarium Scale

Base: main after the collection-architecture audit (#149).

- **Part A:** the aquarium now uses the wild animal's own model for every creature.
- **Part B:** the large animals' aquarium miniatures are twice their previous displayed size.
- **Part C:** collision and navigation grow with them.
- **Part D:** a comparison gallery shows the wild, before, after and preview models.

No species, habitats or saves change.

**Gallery:** `docs/screenshots/v08-pass096/`. Each image shows one animal in four views, from the
same three-quarter angle:

1. the wild model;
2. the aquarium miniature before;
3. the aquarium miniature after;
4. the collection preview.

The two aquarium views share one camera distance and a 1 m bar, so their sizes compare directly.

The "before" view of the octopus, sea spider and ribbon worm was rendered from a clean export of
main (their old tank builds no longer exist). The harness is `validation/v08/miniatures.html` and
`miniatures.mjs`.

## Part A: one model per animal

| Animal                                                                                        | Before                                                                    | Now                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Octopus                                                                                       | A separate tank build: an egg-shaped mantle with eight tube arms          | The wild octopus. `octopusMantleGeometry`, `octopusArmsGeometry` and `poseOctopusArms` are extracted from `shared/Octopus`; the wild rig calls them per frame, and the tank builds `octopusRestGeometry` at rest |
| Giant sea spider                                                                              | A separate tank build: tube legs splayed flat                             | The wild sea spider: `seaSpiderBodyGeometry`, `seaSpiderLegGeometry` and `seaSpiderLeg` (joints) from `IceCritters`, shared by the wild instancing and the tank's `seaSpiderRestGeometry`                        |
| Ribbon worm                                                                                   | A plain tube in the tank, in another orange                               | The wild worm: `ribbonWormGeometry` and `poseRibbonWorm`, its wild colour (`RIBBON_WORM_COLOUR`)                                                                                                                 |
| Cleaner wrasse                                                                                | The chromis rig in the tank (the firefish rig in the wild), a paler blue  | The firefish rig in its wild electric blue                                                                                                                                                                       |
| Bat ray, swell shark, Weddell seal pup                                                        | Tank tints copied by hand; the bat ray and pup had drifted                | One shared table, `src/config/creatureLooks.ts` (`CREATURE_LOOKS`)                                                                                                                                               |
| Garibaldi, kelp bass, blacksmith, señorita, sweeper, soldierfish, flashlight fish, silverfish | Tank tints copied by hand; the flashlight fish and silverfish had drifted | `FISH_RECOLOR` in the same table; `TANK_FISH` takes every recolour from it                                                                                                                                       |

- **Unchanged and already shared:** every GLB animal (the tank leases the same asset through the
  same `AssetLoader` and keeps its `Stroke_Left`/`Stroke_Right` morphs), the lionfish, Spanish
  shawl, moray, the Antarctic invertebrates, Christmas tree worms and sea angels.
- **Behaviour:** controllers stay separate. The tank's `TankBaby` steers the miniature; only the
  look is shared.
- **Resources:**
  - **GLB leases:** these are unchanged (leased, cloned materials, released and evicted on
    dispose).
  - **Procedural animals:** each builds its geometry once per resident and disposes it once
    (tested).
- **Not done here:** the substitute models the collection audit lists remain, because there is no
  species-specific wild asset yet to share. These are the bat ray on the eagle ray, the hammerheads,
  the swell shark on the nurse shark, the Weddell pup on the harbour seal, the grouper on the giant
  sea bass, the chromis-rig fish and the crabs. The tank already matches the wild animal for each
  of them; authoring species models is a later pass.

## Part B: twice the miniature size

The 28 large animals are doubled (`MINIATURE_GROWTH`):

- the 11 cruising sharks, rays, turtle and whales;
- the great white, ocean sunfish, sea otter, harbour seal, western gull, sea lion, nurse shark,
  swell shark, both penguins, Weddell seal and pup, leopard seal, minke, orca and polar bear;
- the colossal squid.

Size-normalised animals grow by their target length; the blacktip, eagle ray and turtle grow by
their scale. In both cases the growth is relative to the previous displayed size, kept as
`MINIATURES_BEFORE_096`.

| Measured in the browser (longest bounds, m) | Before | After |
| ------------------------------------------- | ------ | ----- |
| Blacktip reef shark                         | 0.52   | 1.05  |
| Spotted eagle ray (wingspan)                | 0.67   | 1.34  |
| Green sea turtle                            | 0.42   | 0.84  |
| Manta, humpback, polar bear, otter          | 0.55   | 1.10  |
| Emperor penguin                             | 0.55   | 1.10  |

- **Not doubled:** ordinary fish (the fish catalog), the moray, and every small invertebrate
  (octopus, sea spider, ribbon worm, crabs, shrimp, nudibranch, jellies and so on).
- **Fit:**
  - The largest miniature is about 1.3 m (the eagle ray's span). The aquarium is 36 × 14 × 28 m.
  - All 28 large animals spawned together in the production tank found room and swam for 90 s
    without contact (tested). **There are no exceptions; nothing was shrunk.**

## Part C: collision and navigation

- **Collision radius and half-height** are doubled with the size. A new test checks that, for
  **every** GLB miniature (it covered three), they enclose both detail levels, tail tips and every
  authored stroke at the displayed size.
- **Clearance:** turning and wall clearance, floor and resting height, and the avoidance of the
  swimmer, fish and each other all derive from these in `BabyNavigation`/`TankBaby`, so they grow
  with them.
- **The eagle ray's rest on the sand** used fixed sizes. Its resting half-height (0.045 m), how
  low it must be to settle (0.85 m) and its sink rate now grow with it. Without this it could no
  longer reach the sand.
- **A navigation bug the larger ray exposed:** lifting off the sand was checked at the flat resting
  height, so the ray could resume stroking where its full body touched a collider. It now finishes
  lifting only where its whole stroking body is clear.
- **Spawn:** this is unchanged. Each animal starts at the safe point nearest the swimmer, found with
  its own radius.
- **Capacity:** `BABY_CAP` is now a fixed 61 (it was the roster length, which would have grown
  silently with new species).
- **Saved animals:** the tank saves animals by ID only, not position, so nothing needs relocating.
  A save holding every animal loads every one (tested).

## Validation

- **New tests:**
  - `tests/shared-models-scale.test.ts`:
    - the tank octopus, sea spider and worm are the wild factories' geometry;
    - every tint is the wild animal's;
    - every large wild animal is on its own asset;
    - exactly the large animals are doubled (size, radius and half-height);
    - all 28 swim safely together in the production tank;
    - every saved animal loads.
  - `tests/tank-baby-models.test.ts` now covers every GLB miniature.
- **Updated tests:**
  - `tank-collection` (the colossal squid is a large miniature);
  - `collection-audit` (the cleaner wrasse left the chromis rig).
- **Full checks:** `npm run typecheck`, `lint`, `build` and `test` (112 files, 1130 tests) pass.
- **Browser:** `validation/v08/aquarium-miniatures.mjs` is a short aquarium-only run on
  SwiftShader. It seeds a saved tank (version 3) with seven large animals and the octopus, sea
  spider and ribbon worm. **Passed:**
  - 0 page errors;
  - all ten arrive at their new sizes;
  - 30 simulated seconds with no contact against the scenery;
  - the closest a fish came to any animal's body enclosure was 0.22 m;
  - after they are all sent home, GPU geometries fall from 441 to 431 and textures from 151 to
    123, so their resources are released.

  `docs/screenshots/v08-pass096/aquarium-in-tank.jpg` shows them in the tank.

- **Not used:** `validation/tank-babies.mjs` fails on main too. Its saved Pass 029 decorations no
  longer all fit the rebuilt reef (17 of 20), which is unrelated to this pass.

## Performance

- **Draw calls and textures:** the same per animal. GLB animals share their lease. The procedural
  animals have more vertices, but they are built once per resident: the octopus about 5.0k, the
  spider 1.6k, the worm 0.3k.
- **Fill rate:** doubled miniatures cover about four times the screen area, so more fill when
  close.
- **Not measured:** real-GPU frame rate.

## Known issues

- The substitute models listed in Part A remain until species models are authored.
- The collection preview uses the tank's art framed to fill. There is no collection UI yet.
- Miniature speeds are unchanged, so doubled animals look a little more leisurely for their size.
