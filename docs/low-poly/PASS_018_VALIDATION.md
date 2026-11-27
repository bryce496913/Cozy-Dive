# Special and showcase fish — low-poly migration Pass 018

Base: merged Pass 017, `72f856d` (PR #165). This pass refines the existing canonical models; no species, discovery ID, population, aquarium slot, save format or environment is added.

## Scope reconciliation

The new user brief supersedes the provisional Pass 015 assignment of small animals/invertebrates to 018. Those animals remain pending a separately agreed pass. Historical reports and the original census labels remain records; `asset-inventory.json` now carries an explicit 018 scope override instead of claiming those animals were migrated.

Pass 017 already supplied independent anatomy for all 29 swimming identities and the original seahorse/frogfish. This pass upgrades that same library, not a second set of showcase assets. All **29 swimming identities** receive independently driven pectoral articulation; clownfish, long-finned fish and round-tailed species also receive silhouette refinements. The seahorse and frogfish retain their already distinct Pass 017 parts and existing grip/perch/jaw/lure controllers. The 22 rare discoveries and large non-core visitors remain in their assigned future migrations.

[The showcase inventory](showcase-fish-inventory.json) lists every identity, habitat, asset, feature, palette, body stations, motion and integration context. Reproduce it with `node tools/audit/showcase-fish-inventory.mjs` after the gallery run. The Pass 017 inventory/evidence remains a historical record.

## Anatomy and markings

- **Ocellaris clownfish:** a more compact forehead/snout profile, rounded tail/pectoral/dorsal contours, orange body and narrow dark borders around all three white bands. The bands are face colors on anatomical body stations, following the curved torso. There are no floating ring meshes or textured scales.
- **Moorish idol and longfin bannerfish:** narrow swept dorsal streamers replace the broad solid crests, with independently authored body proportions and existing markings. The threadfin butterflyfish has a separate posterior-thread outline. Their new outlines fit the existing navigation clearance; scales and anchors were not reduced to make room.
- **Round-tailed reef and feature fish:** the caudal outline is rounded through several deliberate perimeter points rather than a squared-off fan; pectoral webs have rounded coherent outlines. Existing independently designed head, peduncle, body depth/width and markings are retained.
- **Slender darting schools and other fish:** their species-authored streamlining, forked/swept tails and recognizable silhouettes remain. Their fin articulation now follows the same visible canonical mesh as the tail, across quality tiers.

Every swimming model remains one merged surface/material per instancing bucket, with the same geometry in near/far contexts. Materials use the existing flat, vertex-colored low-poly body preset, without skin/scale maps or extra transparency. No unrelated GLB or creature assets are changed.

## Motion and habitat contracts

Two bounded pectoral poses supplement the existing continuous left/right body stroke. The outboard fin web moves while embedded roots and head remain seated. `FishSystem`, `AuthoredSchool` and `PosedFish` use their existing fin phases; cards and tank art use their own existing animation clock. A fish can now stabilize with its pectorals while tail effort is zero. Streamers receive a small additional trailing bend, not cloth simulation. Reduced-motion simulation halves both fin and tail amplitude; album still mode supplies zero time/effort.

Existing anemone-family excursions/hovering, shy shelter retreat, schooling cohesion, scatter/recovery, speed-driven cadence, banking and capped turns remain controlled by their existing simulation. No scripted performances were added. Combined tail/fin extremes are enclosed by render bounds. Focused checks verify long-finned fish fit their unchanged navigation radius, and the existing anemone/shelter/avoidance tests check habitat behavior. No collision proxies, spawn points, host anchors, floor geometry or fog settings needed modification.

Wild, card, tank and procedural fallback contexts retain the same `AssetLoader` source and material palette. Optional fin poses leave non-fish and archived two-pose fixtures untouched. Existing leases, instanced meshes and disposal owners remain authoritative.

## Validation and measurements

Commands completed on 2026-11-26:

- `npm run typecheck`: passed.
- `npm run build`: passed in 1.20 s. The entry is 1,645.28 kB / 501.58 kB gzip, versus Pass 017's 1,644.22 / 501.24 kB (+1.06 / +0.34 kB). The existing >500 kB warning remains.
- `npm run test`: 128 files / 1,358 tests passed in 266.67 s on the final delivery state.
- Focused showcase/core/anemone/conversion/schooling run: 5 files / 153 tests passed in 14.55 s after the final streamer-clearance adjustment.
- `npm run lint`: ESLint and Prettier passed.

The focused tests cover all 29 swimming identities at combined tail/fin extremes, bounding boxes and spheres, immutable vertex colors, clownfish topology/band borders, long-fin navigation envelopes, independent pectoral control, reduced motion, pause stability, instanced authored schools and habitat-linked anemone/shelter behavior.

The gallery inspects every canonical fish from side/front/top/three-quarter views and exercises slow/cruise/burst, pause, reduced motion and three resource release/recreate cycles. The localized habitat harness checks the actual aquarium (anemone family), kelp forest and outer reef (paired long-finned fish) and releases each temporary scene before final application disposal. It uses existing world loaders and lighting; this is not a complete passage traversal.

The final gallery contains 31 models (29 swimming fish plus the retained seahorse/frogfish), **39 draw calls / 9,856 triangles**. Swimming identities range from 260 to 548 triangles; clownfish is 496. Two added morph arrays bring the gallery's canonical swimming-fish morph attributes to 1,331,136 bytes. Geometry/material sharing and draw counts are unchanged. Startup took 2,129 ms. A 40-frame SwiftShader sample measured 100 ms median, 183.3 ms p95 and 200 ms maximum; these are software-renderer diagnostics, not gameplay FPS.

Slow/cruise/burst, pause and reduced motion passed. Three release/recreate cycles returned model geometry and morph bytes to zero while retaining one renderer-owned lighting texture; final renderer disposal returned geometry, textures and morph bytes to zero. The gallery made no GLB requests and reported no browser errors.

The final localized habitat smoke passed with no browser errors or legacy fish GLB requests:

| Scene       | Fish | Draw calls | Triangles | Readiness |
| ----------- | ---: | ---------: | --------: | --------: |
| Aquarium    |   41 |         92 | 1,160,890 | 87,556 ms |
| Kelp forest |  145 |         39 | 3,006,243 |  6,133 ms |
| Outer reef  |  307 |         79 | 2,675,513 |  3,375 ms |

These are whole-scene counters including existing terrain, plants and other animals. The aquarium readiness time includes the game's normal authored aquarium/reef warm-up; the two temporary scenes reuse the same renderer/cache and are not cold standalone comparisons. Kelp included garibaldi, kelp bass, blacksmith and señorita. Outer reef included chromis, cardinalfish, firefish, assessor, gramma, blue tang, threadfin butterflyfish and Moorish idol. Releasing either temporary scene returned fish leases to the aquarium baseline of 45; final application disposal returned leases, GPU geometries and textures to zero. Pointer lock, forward input and Escape/pause were exercised in the aquarium. Passage traversal was not exercised.

Evidence: [side](pass018-evidence/side.png), [front](pass018-evidence/front.png), [top](pass018-evidence/top.png), [three-quarter](pass018-evidence/three-quarter.png), [aquarium/anemone family](pass018-evidence/aquarium.png), [kelp](pass018-evidence/kelp.png), [outer reef long-finned pair](pass018-evidence/outer.png), [raw gallery measurements](pass018-evidence/results.json), [raw habitat measurements](pass018-evidence/habitats.json).

## Limits and acceptance

Chromium uses **SwiftShader software rendering**. Its timings are diagnostic and do not represent MacBook Air, Safari, real GPU, thermal or battery performance. Actual-device appearance, comfortable motion and sustained performance need the user's playthrough. Individual gallery inspection covers all identities; localized scenery screenshots cover representative habitats rather than every individual fish in every environment. Cave, shipwreck and Antarctic behavior remain covered by automated regressions; no full traversal is claimed.

Two extra morph arrays add shared source-buffer and shader blending work; draw-call counts and populations remain unchanged. The existing production bundle-size warning is reported, not hidden. Historical superseded core GLBs remain on disk for source/rollback; canonical fish do not download them. The mixed anchored library remains necessary for its moray/anemone. No merge, version bump, release or visual acceptance is implied by this PR.
