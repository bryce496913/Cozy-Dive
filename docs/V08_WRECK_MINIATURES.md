# V0.8 Pass 103 — Shipwreck's Four Rare Miniature Discoveries

Base: merged Pass 102, main `b1875e8`. Four individual animals are added to the existing shipwreck; there is no new population, passage, den prop, colony or collision shape. The approved dense fog, lights, torch, hold/bridge interiors and navigation routes retain their existing configuration and geometry.

## Canonical animals and anatomical references

All artwork is original, authored in Blender using the same miniature library conventions as Passes 100–102. Published descriptions and image captions informed anatomy; no external photographs, maps or models ship with the game.

| Animal / stable identity                        | Canonical node      | Anatomy and quiet behaviour                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skeleton shrimp / `species:skeleton-shrimp`     | `Skeleton_Shrimp`   | Caprellidae: slender articulated amphipod, reduced rear body, three posterior leg pairs gripping the hydroid, two pairs of gnathopods and two pairs of antennae. Slow upper-body sway and deliberate grasping while rear hooks remain attached.                                                  |
| Juvenile wolf eel / `species:juvenile-wolf-eel` | `Juvenile_Wolf_Eel` | _Anarrhichthys ocellatus_: slender orange juvenile with dark ocelli, long dorsal/anal fin membranes and pectoral fins; no pelvic fins. Peeks from the existing breach margin, shifts gently and withdraws up to 7.5 cm when approached.                                                          |
| Decorator crab / `species:decorator-crab`       | `Decorator_Crab`    | A decorated spider crab, with eight jointed walking legs, two claw-bearing forelimbs, eye stalks, hooked setae, algae tufts and attached sponge fragments. Slow leg movement and an occasional 2.5 cm reposition; decorations move with the shell. No unrequested species-level taxonomic claim. |
| Painted greenling / `species:painted-greenling` | `Painted_Greenling` | _Oxylebius pictus_: tapered snout, red-brown vertical bands, eye cirri, low broad pectoral fans and a rayed tail. Long rests interrupted by a controlled 16 cm perch change with a brief 7 cm lift.                                                                                              |

Primary anatomical references:

- [Monterey Bay Aquarium — Skeleton shrimp](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/skeleton-shrimp): caprellid body, hydroid attachment and camouflage.
- [Seattle Aquarium — Wolf eel](https://www.seattleaquarium.org/animal/wolf-eel/) and [Oregon Coast Aquarium — Wolf eel](https://aquarium.org/animals/wolf-eel/): colourful juvenile stage, dark spots and den behaviour.
- [Australian Museum — Decorator crab](https://australian.museum/learn/animals/crustaceans/decorator-crab/) and [WA Museum — Camposcia retusa](https://museum.wa.gov.au/online-collections/names/Camposcia-retusa/): hooked setae, jointed spider-crab limbs and attached algae/sponges. These inform the approved common-name animal rather than assigning it a new binomial.
- [Washington Department of Fish & Wildlife — Painted greenling](https://wdfw.wa.gov/species-habitats/species/oxylebius-pictus) and [NOAA nearshore fish guide](https://apps-afsc.fisheries.noaa.gov/Publications/AFSC-TM/NOAA-TM-AFSC-293.pdf): striped body, fins and proportions. The WDFW search result supplied its photo description; direct access returned 403.

The skeleton shrimp is intentionally readable at close observation distance (over 17 cm high in the game's miniature scale), with a thin, camouflaged body and visible limbs rather than a vanishingly small model. Album fitting and aquarium display size are presentation transforms; its wild-world identity and source geometry remain the same.

## Source, rigs and ownership

- Editable source: `tools/art/pass103/wreck-minis.blend`.
- Reproducible anatomy and shape-key rigs: `tools/art/pass103/wreck_minis.py`.
- One canonical library: `public/assets/models/creatures/wreck-minis.glb`.
- Compression/inventory: `tools/art/pass103/compress.mjs`, using the existing 16-bit Draco convention and CC0 original-art manifest.

Rebuild with Blender 4.3.2 from the repository root:

```bash
BLENDER_USER_CONFIG=/tmp/cozy-pass103-blender blender -b --python tools/art/pass103/wreck_minis.py
node tools/art/pass103/compress.mjs
```

Each animal is one mesh/material and has `Stroke_Left` / `Stroke_Right` shape keys. Additional keys are `Retreat` (wolf eel), `Reposition` (crab), and `Perch` / `Lift` (greenling). All default weights are zero. `WreckMiniAnimation` drives the same rigs in the wreck, album and aquarium. Habitat retreat responds to approach; previews and aquarium show its calm unprovoked posture. Pause freezes habitat simulation; reduced motion returns all miniature rigs to rest.

`WreckMinis` holds one asset lease and four wrappers. Only successfully loaded models supply observation candidates. Failed/incomplete libraries and late arrivals after disposal release their lease without exposing placeholder sightings. Wrappers own cloned materials; the loader owns shared geometry. Disposal is idempotent.

## Microhabitats and collection

- The shrimp's anchor is a real lower-stem vertex of an existing upright deck hydroid instance. Its rear hooks sit around that attachment rather than floating beside an invented stem.
- The wolf eel uses the upper-forward margin of the existing starboard hull breach, clear of the middle of its entrance route. Its entire rest/stroke/retreat geometry is checked against existing ship collision.
- The decorator crab rests on drawn deck steel beside existing soft coral, with a reserved envelope clear of neighbouring colony geometry.
- The greenling rests by an existing encrusting mat on drawn deck steel; its perch/lift envelope stays clear of surrounding colonies and the hatch approach.

Homes are deterministic and at least 2 m apart. Selection uses actual ship transforms (including list and trim), raycasts against rendered deck surfaces, existing growth instance envelopes and player collision clearance for viewing points. The first attachment tests rejected a tilted hull hydroid and an inaccessible viewing point; the final selection requires upright deck hydroids and reachable views. No navigation collider was weakened or moved to make a seat work.

Observation uses stable species IDs, the existing dwell tracker, a 1.8 m reach, a 0.42-radian half-angle, and actual structural-mesh line-of-sight checks. The small hydroid fronds provide camouflage; opaque steel blocks observations. Structural raycasts run only when the tracker has already passed its near/direct-view checks. `WreckMiniOcclusion` retains exact nearby steel triangles in CPU-only meshes; these are never added to a scene. Geometry replacement or world-matrix changes invalidate that cache, and disposal releases its CPU geometry without disposing shared steel materials.

Shipwreck now has five collection slots: the existing Queensland grouper at order 0, followed by the four rare miniatures. All four have tank definitions and retain their same model nodes in collection previews and placements. Journal and aquarium choices round-trip without a save-format change; the catalog-derived tank capacity still allows one of every discovered animal.

## Validation and performance

The owner adds **four meshes maximum**, four bounded pose updates and one shared library load. It creates no new instanced population, substrate draw, pathfinding simulation or collision geometry. The library remains within the existing 46 MiB shared shipped-model budget. The final compressed library is **291,600 bytes and 11,285 triangles**. Exact render deltas and command results follow.

The browser harness, `validation/wreck-minis.mjs`, is deliberately wreck-only: four local hiding-place views, a few stationary hold frames for the normal torch/pause/reduced-motion checks, and the four-model gallery. It compares the same frozen view with the miniature root hidden and visible, and records draw/triangle deltas. It also measures the CPU owner update loop and checks actual observations and post-release GPU objects / asset leases. No complete world traversal or broad retention/stress run is part of this pass. SwiftShader timing is a software-renderer observation, not a laptop/GPU performance claim.

### Commands and results

| Command                                                                                                                                                                                                                                | Result                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run format`                                                                                                                                                                                                                       | Passed; subsequent edited files were formatted with Prettier.                       |
| `npm run build`                                                                                                                                                                                                                        | Passed on the final runtime code; existing >500 kB bundle advisory remains.         |
| `npm run typecheck`                                                                                                                                                                                                                    | Passed.                                                                             |
| `npm run lint`                                                                                                                                                                                                                         | Passed; final cache modules, tests and profile utility also passed targeted ESLint. |
| `npm run test -- --maxWorkers=2 --testTimeout=30000 --hookTimeout=30000`                                                                                                                                                               | 119 files, **1,198 tests passed**, 346.75 s.                                        |
| `npx vitest run tests/wreck-minis.test.ts tests/asset-validation.test.ts tests/asset-production.test.ts tests/collection-registry.test.ts tests/collection-audit.test.ts tests/album-pages.test.ts tests/fish-lod-compression.test.ts` | 7 files, **114 tests passed** after the final model refinement.                     |
| `npx vitest run tests/wreck-minis.test.ts tests/wreck-loading.test.ts tests/shipwreck.test.ts tests/wreck-life.test.ts`                                                                                                                | Final visibility-cache change: 4 files, **27 tests passed**.                        |
| `node validation/wreck-observations.mjs`                                                                                                                                                                                               | Same-process CPU comparison below; exact real steel triangles, no GPU rendering.    |

An earlier full run overlapped software rendering and hit the default 10-second `beforeAll` timeout in the old aquarium playtest fixture (1,193 bodies passed, 5 skipped by the failed hook). That unchanged suite passed all 5 tests separately in 3.38 s. The full rerun above used a 30-second setup allowance and passed without skipped tests. No unrelated aquarium code or tests were weakened.

The ten focused miniature tests cover stable actual-growth/deck attachments, reachable viewing positions, every vertex of every exported pose against existing ship collision, close/distant/turned-away observations, real steel obstruction (including replaced/moved geometry), frame-rate consistency, approach retreat, pause/reduced motion, bounded perch movement, failed/late library disposal, original-geometry ownership, canonical album/tank art, stable collection order, and journal/tank save round trips.

With Vite running via `npm run dev -- --port 5174`:

```bash
COZY_URL=http://127.0.0.1:5174 \
COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs \
COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass103-final \
node validation/wreck-minis.mjs
```

The shipwreck-only smoke reached `ready`, exposed and actually observed all four IDs, verified normal hold torch activation (intensity 4.32 after three short transition frames), pause and reduced motion, and finished with **0 geometry objects, 0 textures and 0 asset leases retained**. No browser page/console errors occurred. Screenshots and the report are retained in `docs/screenshots/v08-pass103/`.

| Local view        | Added draws | Added triangles |
| ----------------- | ----------: | --------------: |
| Wolf eel          |           1 |           2,692 |
| Skeleton shrimp   |           2 |           5,400 |
| Decorator crab    |           4 |          11,285 |
| Painted greenling |           2 |           4,969 |

The same frozen views had roughly 60–72 draws and 2.50–2.59 million triangles before the miniatures. The peak extra triangle work is about **0.44%** of that view. The four-owner pose update loop measured approximately **0.0022 ms/update** in that run. These are local workload/CPU observations under Chromium SwiftShader; they do not establish hardware frame rates.

### Observation cost fix

Profiling caught a real cost in checking visibility against all 104,496 merged steel triangles. `WreckMiniOcclusion` now crops the exact structural triangles to each observation neighbourhood, warmed during preparation. This does not replace the hull with a collision proxy or add a GPU draw. Tests verify occlusion after structural geometry/matrix replacement and verify that disposing the cache never disposes original steel geometry.

The final same-process Node profile uses 10 warm-up calls and 100 measured queries per animal, comparing original full-mesh raycasts and the cropped geometry on the same ship:

| Home              | Nearby triangles | Full steel query (ms) | Cropped query (ms) |
| ----------------- | ---------------: | --------------------: | -----------------: |
| Skeleton shrimp   |            1,433 |                 3.760 |              0.029 |
| Wolf eel          |            1,075 |                 3.786 |              0.045 |
| Decorator crab    |            1,242 |                 4.014 |              0.019 |
| Painted greenling |            1,370 |                 4.759 |              0.032 |

No complete world traversal, long retention soak, new habitat, lighting retune, fish population increase or performance claim for unmeasured consumer hardware is included.

The final CPU-cache implementation was additionally exercised in the real prepared wreck with `COZY_SMOKE_ONLY=1` (same harness/environment variables, output `/tmp/cozy-pass103-cache-smoke`). That minimal mode omits repeated screenshots/gallery draws; it checks actual sightings, torch, pause/reduced motion and cleanup in the prepared world. It passed with all four IDs, no errors and zero retained geometry, textures or leases. See `cache-smoke.json`.
