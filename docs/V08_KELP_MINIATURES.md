# V0.8 Pass 102 — Kelp Forest's Four Rare Miniature Discoveries

Base: Pass 101, main `452c2c6206fa0d7d3d4a306774b01bd9aafbf324` (PR #155).

## Animals and shared art

| Animal                   | Scientific name            | Canonical GLB node     | Behaviour                                                                                                                                                  |
| ------------------------ | -------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weedy seadragon          | _Phyllopteryx taeniolatus_ | `Weedy_Seadragon`      | Segmented curved body, long pipette snout, raised eyes, sparse leaf appendages; gentle hovering and small fin strokes.                                     |
| Spanish shawl            | _Flabellinopsis iodinea_   | `Spanish_Shawl`        | Existing purple body, oral tentacles, ringed red rhinophores and orange cerata; tiny crawl and cerata sway beside a hydroid patch.                         |
| Sarcastic fringehead     | _Neoclinus blanchardi_     | `Sarcastic_Fringehead` | Slender den fish with cirri and an open shell cavity; a five-second colourful gape in a 31-second cycle.                                                   |
| East Pacific red octopus | _Octopus rubescens_        | `Red_Octopus`          | Eight arms with paired suckers, horizontal pupils and mantle papillae; slow arm movement, muted camouflage and an occasional short excursion from shelter. |

**Approved geographic exception:** the weedy seadragon is an Australian temperate-water species deliberately included in this predominantly California-inspired kelp forest. It has not been substituted with another species. The album description documents the exception too.

The single library is `public/assets/models/creatures/kelp-minis.glb`. Editable Blender source: `tools/art/pass102/kelp-minis.blend`; deterministic authoring: `tools/art/pass102/kelp_minis.py`. The Draco-compressed library is 429,256 bytes, with four meshes and 24,072 triangles in total, no external maps, and zero default morph weights. All four share `Stroke_Left`/`Stroke_Right`; the fringehead adds `Mouth_Open`, and the octopus adds `Camouflage`.

The Spanish shawl's **existing Pass 053 geometry is the source**, exported directly from `SpanishShawl.ts` and imported into Blender at its former wild scale (2.2). Its cerata orange is more saturated so it remains orange under the green kelp light; the anatomy is retained exactly. Its established identity `species:spanish-shawl` and tank key `spanish-shawl` remain unchanged. The old instanced population and its duplicate candidate locations were removed from `KelpCritters`; crabs remain. There is one canonical Spanish shawl discovery, not a new second species or album slot.

Rebuild from the repository root with Blender 4.3.2:

```bash
node tools/art/pass102/export_spanish.mjs
BLENDER_USER_CONFIG=/tmp/cozy-pass102-blender blender -b --python tools/art/pass102/kelp_minis.py
node tools/art/pass102/compress.mjs
```

The intermediate `spanish-source.json` is generated and ignored. Original source geometry and the editable Blender file are retained. The shared shipped-model budget grows from 45 to 46 MiB for these four animals, following the existing per-pass content budget convention. No texture exception is needed beyond the same vertex-colour/no-image treatment as the earlier miniature libraries. The manifest records the new asset's original CC0 artwork and checksum; the inventory script includes it.

## Homes, discovery and collection

`KelpMinis` selects deterministic homes beside the existing boulders. The shawl is seated on an actual raycast rock surface; the fringehead's den is a genuinely open shell, not a fish intersecting a solid rock. The octopus stays on nearby sand in rock shelter; the seadragon hovers among kelp. The forest's layout, lighting, fog, passages and existing large wildlife are unchanged.

Homes are at least 5 m apart, outside the sinkhole approach, with stalk clearance and a clear near viewing corridor. Static dressing envelopes exclude urchin spines, anemones, sea stars and cobbles. That check was added after the first localized render exposed an urchin crossing the fringehead's shell. Small motion stays within the reserved envelope.

Discovery requires a successful model load, a view within 2.2 m and a 0.4-radian half-angle, plus the existing sighting dwell. A close-range visibility callback raycasts the actual environment geometry so a direct look through a boulder cannot unlock an animal. Failed/late loads expose no sightings; their leases are released. Materials and the hydroid patch belong to the miniature owner; canonical model geometry belongs to the shared asset loader.

The kelp album has 17 slots: its original 14, including the Spanish shawl at order 6, followed by the three new identities. All four miniatures are marked rare. Journal and aquarium keys remain stable, with no save migration. The tank capacity follows the species catalog so all discoveries still fit.

Habitat, album previews and aquarium placements select the **same named GLB meshes**, with size normalization only for presentation. `KelpMiniAnimation` is shared between those render paths. Pause freezes habitat time; reduced motion uses the rest pose and also freezes album miniature morphs.

## Validation

Results and exact commands are recorded below after the final checks. The browser harness is deliberately limited to four kelp closeups and four model gallery views. It does not run a journey, stress test or hardware performance benchmark.

Checks completed in this Linux workspace (Chromium with SwiftShader):

| Command                                                                                                                                    | Result                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run build`                                                                                                                            | Passed; existing >500 kB chunk-size advisory remains.                        |
| `npm run typecheck`                                                                                                                        | Passed.                                                                      |
| `npm run lint`                                                                                                                             | Passed.                                                                      |
| `npx vitest run tests/fish-lod-compression.test.ts tests/kelp-minis.test.ts tests/asset-validation.test.ts tests/asset-production.test.ts` | 4 files, 90 tests passed.                                                    |
| `npx vitest run tests/asset-production.test.ts tests/tank-babies.test.ts tests/reef-minis.test.ts`                                         | 3 files, 34 tests passed, including old saves and one-of-each tank capacity. |
| `npm run test -- --maxWorkers=2 --testTimeout=30000`                                                                                       | Final full-suite run in progress; result recorded before PR readiness.       |

The focused miniature tests cover authored/fallback terrain, dressing and stalk clearance, close-range discoveries and solid-rock/dressing occlusion, pause/reduced motion, frame-rate consistency, intermittent den exploration, failed/late load cleanup, journal round trips, stable Spanish-shawl identity, original anatomy retained within Draco quantization tolerance, default morph weights and identical geometry in habitat/card/tank.

With `npm run dev -- --port 5173` running:

```bash
COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs \
COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass102-final \
node validation/kelp-minis.mjs

COZY_GALLERY_ONLY=1 \
COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs \
COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass102-compressed \
node validation/kelp-minis.mjs
```

The habitat check reached `ready`, exposed exactly the four intended sightings, rendered four localized homes and the four-model gallery, and finished with **0 geometry objects, 0 textures and 0 asset leases**. The final compressed-model gallery also decoded and rendered all four animals with no page/console errors and the same zero-resource result. The orange colour refinement was reviewed in the final gallery. The retained screenshots show that gallery and the corrected fringehead home; reports are in `docs/screenshots/v08-pass102/`.

The initial diagnostic runs caught the fixed tank-capacity limit, missing library classification/compression integration, outdated collection counts and the fringehead–urchin overlap. Those issues were corrected, rather than bypassing their checks. A fixture comparison was changed from rounded coordinate keys to an actual distance tolerance for float32/Draco export, and the terrain test has an explicit timeout for its real-geometry raycasts.

Rendering was capped at 0.7 pixel ratio for this localized software-renderer check. No full travel tour, long retention/stress run, cross-browser claim or hardware frame-rate claim is made for this pass.
