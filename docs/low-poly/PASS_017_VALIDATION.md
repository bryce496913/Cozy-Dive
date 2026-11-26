# Core fish rebuild — low-poly migration Pass 017

Dependency: Pass 016, PR #164 (`739b2f8`), merged into `main` as `f8d923f` during this pass. This PR targets `main`; it is not a replacement for the historical v0.2 Pass 017. No version, roster, discovery/save ID, population or habitat-route change.

## Complete species audit

The Pass 015 census is provisional and includes technical mesh nodes, archive GLBs and rendering machinery. This pass resolves its core-fish scope into **31 identities: 29 swimming species plus the original seahorse and frogfish**. The mixed `anchored-life` library's nine Horse/Frog nodes belong here; its moray and anemone stay unchanged. Rare frogfish, pipefish, seadragons and other discoveries among the approved 22 remain assigned to Pass 020. Sharks, rays, sunfish and other large visitors remain Pass 019. No animal is removed to narrow the work.

[Machine-readable species inventory](core-fish-inventory.json) records every species, anatomical parameters, palette/pattern, asset ID, wild habitats and shared presentation contexts. The [migration census](asset-inventory.json) now links replaced records to their canonical factories. `node tools/audit/core-fish-inventory.mjs` reproduces that reconciliation from the source definitions and gallery results. Original GLBs are retained for source history/rollback; the runtime loader resolves core fish to the new factories before any GLB request. Historical GLB tests still verify those archived files; the new tests verify current runtime art.

| Identity                | Wild habitats                   | Canonical source         |
| ----------------------- | ------------------------------- | ------------------------ |
| blue green chromis      | Aquarium, Outer Reef, Shipwreck | `chromis` / fork         |
| pajama cardinalfish     | Aquarium, Outer Reef            | `cardinalfish` / fork    |
| royal gramma            | Aquarium, Outer Reef, Shipwreck | `gramma` / round         |
| yellow assessor         | Aquarium, Outer Reef            | `assessor` / round       |
| firefish goby           | Aquarium, Outer Reef            | `firefish` / swept       |
| ocellaris clownfish     | Aquarium, Outer Reef            | `clownfish` / round      |
| garibaldi               | Kelp Forest                     | `garibaldi` / notched    |
| kelp bass               | Kelp Forest                     | `kelpBass` / truncate    |
| blacksmith              | Kelp Forest                     | `blacksmith` / fork      |
| senorita                | Kelp Forest                     | `senorita` / round       |
| glassy sweeper          | Sea Cave, Shipwreck             | `sweeper` / fork         |
| soldierfish             | Sea Cave                        | `soldierfish` / fork     |
| blue tang               | Outer Reef                      | `blueTang` / truncate    |
| threadfin butterflyfish | Outer Reef                      | `butterflyfish` / round  |
| moorish idol            | Outer Reef, Shipwreck           | `moorishIdol` / truncate |
| longfin bannerfish      | Outer Reef                      | `bannerfish` / fork      |
| parrotfish              | Outer Reef                      | `parrotfish` / notched   |
| bigeye trevally         | Outer Reef                      | `trevally` / swept       |
| humphead wrasse         | Outer Reef                      | `humpheadWrasse` / round |
| flashlight fish         | Sea Cave                        | `flashlightFish` / fork  |
| antarctic silverfish    | Antarctic                       | `silverfish` / fork      |
| great barracuda         | Outer Reef, Shipwreck           | `barracuda` / swept      |
| blackfin icefish        | Antarctic                       | `icefish` / truncate     |
| bald notothen           | Antarctic                       | `notothen` / round       |
| antarctic toothfish     | Antarctic                       | `toothfish` / truncate   |
| giant sea bass          | Kelp Forest                     | `giantSeaBass` / round   |
| queensland grouper      | Shipwreck                       | `grouper` / round        |
| california sheephead    | Kelp Forest                     | `sheephead` / truncate   |
| cleaner wrasse          | Outer Reef                      | `cleanerWrasse` / round  |
| seahorse                | Aquarium                        | `anchored` / anchored    |
| frogfish                | Aquarium                        | `anchored` / anchored    |

## Implementation and ownership

- `src/fish/lowPoly/designs.ts`: independently authored depth/width stations, forehead offsets, palettes, tail and dorsal styles for all 29 swimming identities. Uses elongated, slender, oval, deep compressed, spindle and broad bottom-fish proportions; identities no longer differ only by tint.
- `src/fish/lowPoly/model.ts`: shared Pass 016 profile/outline/palette tools build head, torso, peduncle, tail, median/paired fins, seated polygonal eyes and mouth. Color boundaries add topology where useful; cardinalfish spots are placed patches, not random noise. Flat MeshStandardMaterials have no scale/normal/roughness image maps.
- `src/fish/lowPoly/anchored.ts`: upright curved seahorse with tapered coiled tail and small fins; broad frogfish with limb-like feet, hinged jaw and lure. Their existing controller pivots, grip/perch selection, walking, respiration and observations remain authoritative. The mixed imported library may contain multi-primitive groups; replacement handles both groups and meshes and only disposes old resources not shared by remaining parts.
- `AssetLoader`: keeps the existing cache, hierarchy cloning, validation, leases, eviction and stale-load handling. No parallel species loader/cache. Generated scenes and decoded scenes have the same ownership contract. Added asset IDs distinguish former chromis/firefish/sea-bass substitutions.
- `FishGeometry`: the procedural fallback now uses the canonical factory. `FishRenderBatch` writes per-instance morph data alongside transforms. `AuthoredSchool`, `PosedFish`, collection cards and aquarium guests retain their existing owners/controllers. Existing recolor compatibility never overwrites a crafted fish's palette.
- Body curvature grows towards the tail, with a stable head and embedded fin roots. Existing speed/burst-driven cadence and per-fish phases remain; a restrained turning bias bends the tail during turns. Small outer-pectoral movement is part of the continuous deformation. Driver transforms remain for the authored-school interface, without splitting the visible body at a joint.
- Near/far and Full/lighter use the same designed topology. There is no legacy distance model, billboard or silent quality downgrade. A school has one instanced surface per active distance bucket; fallback has one surface per species batch. Existing deterministic size, tint and cadence variation remains. Fin proportions are species-authored rather than randomly distorted.

Saves, 2× large-miniature rules, tank capacities, local storage formats, schooling/scatter/regroup behavior, avoidance, fog, caustics, lighting and passage code are unchanged. Generated fish use the old rig's length contract; scene/guest scale remains explicit. Fish cards are fitted for presentation only. Seahorse/frogfish remain existing home residents, with no new placement UI.

## Validation

Commands and results (2026-11-26):

- `npm run typecheck`: passed.
- `npm run lint`: ESLint and Prettier passed.
- `npm run build`: passed; Vite build 2.67 s. Entry 1,644.22 kB / 501.24 kB gzip, versus Pass 016's 1,635.94 / 497.54 kB (+8.28 / +3.70 kB). Existing >500 kB bundle warning remains.
- `npm run test`: 127 files, 1,322 tests passed and one test hit its default 5 s timeout; 658.99 s total while SwiftShader was running. No assertion mismatch was reported.
- `npx vitest run tests/reef-collision-audit.test.ts --testTimeout=15000`: the timed-out collision test passed (6.47 s including import/transform). No collision code or test assertion was changed to obtain this result.
- `npx vitest run tests/core-fish-low-poly.test.ts tests/collection-audit.test.ts tests/wreck-loading.test.ts tests/shared-models-scale.test.ts`: 95 tests passed in four files (16.85 s). This includes the final multi-material anchored-fish regression.
- `node validation/core-fish/smoke.mjs` and `node validation/core-fish/habitats.mjs`: measurements below. The final habitat run used the following server command to prevent hot reload from interrupting release assertions:

  ```bash
  node --input-type=module -e 'import {createServer} from "vite"; const server = await createServer({server:{host:"0.0.0.0",port:5181,hmr:false}}); await server.listen();'
  ```

  The harness stops the paused aquarium's animation callback before building the localized kelp scene, avoiding unnecessary background rendering. It does not modify production warm-up, fog, scene contents or quality settings. An earlier run captured both habitats but was interrupted by development hot reload before release; it was not counted as a passing release check.

[Command logs](pass017-evidence/commands/) retain the full-suite timeout rather than reporting the original command as green. Tests include current-runtime geometry, all 29 asset identities, source sharing, independent instance weights, fallback matching, morph continuity/bounds, head stability/tail reach, repeated cache retirement, anchored pivots, and preservation of shared moray/anemone resources. Existing movement, collisions, schooling, save and discovery regressions remain in the full suite.

The four-view gallery exercises all 31 identities at slow, normal and burst rates, pause/resume and reduced motion. Three release/recreate cycles check GPU ownership. The separate habitat harness loads the actual aquarium and kelp scenes, uses pointer lock/pause in the aquarium, renders their existing schools and releases the kelp owner before final renderer disposal. This is localized inspection, not an exhaustive world or passage traversal.

### Rendering and resource evidence

The final gallery contains all 31 fish, normalized only for presentation. Side, front, top and three-quarter screenshots were inspected. It draws **39 calls / 9,466 triangles**; the 29 swimming models use **260–548 triangles each**. Existing instancing is retained, and near/far geometry is identical. Some background fish exceed the provisional 250-triangle starting target to keep the same readable eyes, fins and silhouette at both distances; they remain single-surface instances, not separate fin draw calls.

Gallery startup was 2,981 ms. A 40-frame software-renderer sample measured median 116.6 ms, p95 300 ms and maximum 416.6 ms while another software-rendered habitat was active. These are diagnostic numbers under contention, **not gameplay FPS or hardware benchmarks**. Slow/normal/burst controls, pause and reduced motion passed. Three release/recreate cycles returned model geometry to zero; one renderer-owned lighting texture remained until final disposal, which returned geometry and textures to zero. No browser errors or GLB downloads occurred in the standalone fish gallery.

The final localized habitat smoke passed with no browser errors or legacy fish GLB requests. Aquarium readiness took 154,914 ms in SwiftShader, with its 41 fish and 45 leases. Kelp readiness took 9,568 ms after the paused aquarium callback was stopped; its 145 fish included garibaldi, kelp bass, blacksmith and señorita. Readiness timing excludes the later screenshot/readback cost and is not comparable to normal passage loading on hardware.

| Captured scene | Draw calls | Triangles | Points |
| -------------- | ---------: | --------: | -----: |
| Aquarium       |        107 |   906,513 |    210 |
| Kelp           |         39 | 3,005,599 |    700 |

These are whole-scene counters including existing plants, terrain and other animals, not fish-only budgets. Kelp release returned leases from 206 to the aquarium baseline of 45. Final application disposal returned **leases, GPU geometries and textures to zero**. Pointer lock, key input and Escape/pause were exercised before localized scene inspection; passage traversal was not exercised. The screenshots are [aquarium](pass017-evidence/aquarium.png) and [kelp](pass017-evidence/kelp.png).

Evidence: [side](pass017-evidence/side.png), [front](pass017-evidence/front.png), [top](pass017-evidence/top.png), [three-quarter](pass017-evidence/three-quarter.png), [gallery measurements](pass017-evidence/results.json), [habitat measurements](pass017-evidence/habitats.json).

## Limits and follow-up

All browser measurements use Linux Chromium **SwiftShader software rendering**. They are not MacBook Air/Safari/GPU performance claims. The gallery and full habitats have different populations and camera coverage; do not compare their FPS as if they were matched scenes. Full-device appearance, sustained heat/battery behavior and comfortable motion need the user's playthrough.

The historical fish GLBs remain on disk and under archive-oriented tests; they are not requested by the canonical production fish loader. The mixed anchored library is still downloaded because its anemone/moray are outside this pass. A later asset-packaging pass can remove superseded embedded geometry once its rollback/source policy is agreed. No broad asset deletion or unrelated architecture rewrite is included.

Pass 015's penguin/whale/seal/manta reference images were not attached; this pass follows its written faceted/palette standard and does not claim image matching. The 22 rare identities and other future migration families have not been rebuilt here. This PR is a review candidate, not release or visual acceptance.
