# v0.2 Pass 013 — Authored Geometry Overhaul

Validation date: November 9, 2026 (America/New_York). Candidate for user review; no merge, release or next pass is authorized by this report. The user accepted the Pass 012 chromis direction and target-machine performance as the reference for this work.

## Geometry and integration

The normal aquarium now loads three original local GLB libraries: six ornaments, four anchored creatures and the two clownfish. The log has an irregular continuous bore, bark channels and broken knots. The wreck has bowed layered planks, exposed frames, deck seams and a damaged cabin. Individual weathered arch stones preserve the passage and discovery ledges. The filter adds recessed intake vanes, brackets, suction hardware, a curved nozzle and fasteners. The chest has fitted boards, straps, feet, lock, hinge hardware and a separately articulated barrel-planked lid. The statue has a narrower supporting body and a dimensional asymmetric carved face, with its crown perch retained. Attached branching growth is part of the ornament asset.

Seahorse anatomy adds a shaped torso/head, crown, bony plates, dimensional eyes and a tapered gripping coil. Frogfish anatomy adds fleshy mouth folds, eye hoods, tassels, webbed feet and a modeled lure. Moray geometry follows its existing continuous GPU centerline, including a median fin and separately controlled head/jaw. The anemone has pedal/oral discs and 96 varied tentacles. Clownfish reuse the accepted morph workflow with species-specific proportions, rounded tail, bands, dimensional anatomy and independently moving pectorals.

The old controllers still determine movement, breathing, awareness, lure motion, fin/tail effort, emergence/retreat, chest timing and current. Population remains 40 fish, two host residents and seven hidden discoveries. Lighting, swimming, audio, player controls and home-selection algorithms are unchanged. A one-time spawn check now selects a clear initial heading when the existing steering look-ahead crosses a solid; it preserves positions and RNG consumption, and leaves ongoing steering untouched. The 60-fish authored stress case exposed this latent startup edge case against an original reef rock. A synthetic-wall regression also checks that fish begin with safe momentum. New structural proxies replace the six original ornament groups in the same shared collision array. The chest retains its mutable lid collider identity and occupant guard. Fine growth, bark fissures and hardware do not add independent collision obstacles.

## Matched before/after evidence

These pairs are captured in one paused session by `validation/geometry-overhaul.mjs`, with identical camera, source-controller pose, lighting and scene state for each pair. The comparison toggles both visible geometry and corresponding structural collision. This is a camera fixture, not evidence of native player navigation or measured hardware FPS. The moray view deliberately sets an emergence pose; ordinary state transitions are separately exercised by the anchored-life harness.

| Object / creature   | Before                                                                       | After                                                                      |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Log tunnel          | ![Before Log tunnel](screenshots/v0.2-pass013/log-before.png)                | ![After Log tunnel](screenshots/v0.2-pass013/log-after.png)                |
| Shipwreck           | ![Before Shipwreck](screenshots/v0.2-pass013/shipwreck-before.png)           | ![After Shipwreck](screenshots/v0.2-pass013/shipwreck-after.png)           |
| Stone archway       | ![Before Stone archway](screenshots/v0.2-pass013/arch-before.png)            | ![After Stone archway](screenshots/v0.2-pass013/arch-after.png)            |
| Filter              | ![Before Filter](screenshots/v0.2-pass013/filter-before.png)                 | ![After Filter](screenshots/v0.2-pass013/filter-after.png)                 |
| Treasure chest      | ![Before Treasure chest](screenshots/v0.2-pass013/chest-before.png)          | ![After Treasure chest](screenshots/v0.2-pass013/chest-after.png)          |
| Statue              | ![Before Statue](screenshots/v0.2-pass013/statue-before.png)                 | ![After Statue](screenshots/v0.2-pass013/statue-after.png)                 |
| Seahorse            | ![Before Seahorse](screenshots/v0.2-pass013/seahorse-before.png)             | ![After Seahorse](screenshots/v0.2-pass013/seahorse-after.png)             |
| Frogfish            | ![Before Frogfish](screenshots/v0.2-pass013/frogfish-before.png)             | ![After Frogfish](screenshots/v0.2-pass013/frogfish-after.png)             |
| Moray eel           | ![Before Moray eel](screenshots/v0.2-pass013/moray-before.png)               | ![After Moray eel](screenshots/v0.2-pass013/moray-after.png)               |
| Clownfish / anemone | ![Before Clownfish / anemone](screenshots/v0.2-pass013/host-pair-before.png) | ![After Clownfish / anemone](screenshots/v0.2-pass013/host-pair-after.png) |

Full-resolution screenshots and a machine-readable comparison report are retained beside this document. The [manifest](ASSET_MANIFEST.md) lists every role, source, export, map set, approximate triangles, collision/animation dependency and viewing priority. Exact hashes, aggregate resource sizes and decoded image metadata are in [manifest.json](../public/assets/manifest.json). Regeneration and coordinate/ownership contracts are in the [pipeline](ASSET_PIPELINE.md).

## Validation results

| Check                                                     | Result                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` / `npm run build:benchmark`               | Pass; normal and explicit benchmark builds                                                                                                         |
| `npm run typecheck` / `npm run lint` / `git diff --check` | Pass                                                                                                                                               |
| `npm run test -- --maxWorkers=2 --no-file-parallelism`    | 297 tests / 31 files passed                                                                                                                        |
| `npm run test:stress`                                     | 7 tests passed; original and authored 5/15/30-minute scenarios plus schedule equivalence                                                           |
| `python3 tools/art/inspect_assets.py`                     | All five local GLBs inspected; finite accessors, embedded 512² maps, convex data, hashes and inventory                                             |
| Matched geometry browser harness                          | Ten pairs; three model requests; two moving/morphing clownfish rigs; pause, finite animation data; 32,632 sampled seahorse/frogfish vertices clear |
| Ornament / anchored / discovery browser harnesses         | Chest opening/bubbles; all moray states and diver retreat; anemone current; hidden close-ups, rare walk/crawl, pause/reduced motion; cleanup       |
| Native browser lifecycle                                  | 30 simulated minutes; pointer lock, camera-directed W, Escape, mute/resume, persistence, visibility, reduced motion and unsupported-audio fallback |
| Production normal and benchmark smoke                     | Local GLBs/PBR decode, real Enter/W/Escape/settings, comparison composition, population and GPU/audio cleanup                                      |

No assertions or time limits were relaxed. An early run with concurrent Blender/software rendering hit four pre-existing five-second unit timeouts; the prescribed serial-file run passes without those competing workloads. Actual fit checks caught and corrected the statue face/body overlap and wreck mast/rib intrusion into the protected frogfish patch. The 60-fish test exposed the initial-heading edge case described above; its regression and all stress assertions now pass.

Retained reports: [geometry](benchmarks/v0.2-pass013/geometry.json), [CPU stress](benchmarks/v0.2-pass013/stress.json), [native lifecycle](benchmarks/v0.2-pass013/lifecycle.json), [production](benchmarks/v0.2-pass013/production.json), [benchmark production](benchmarks/v0.2-pass013/production-benchmark.json), [ornaments](benchmarks/v0.2-pass013/ornaments.json), [anchored life](benchmarks/v0.2-pass013/anchored-life.json), [discoveries](benchmarks/v0.2-pass013/discoveries.json).

Additional animated-state evidence: [open chest and bubbles](screenshots/v0.2-pass013/chest-open-bubbles.png), [rare frogfish walk](screenshots/v0.2-pass013/frogfish-rare-walk.png), [current-driven anemone](screenshots/v0.2-pass013/anemone-motion.png).

## Measurements and collision checks

| Inventory                                                  |             Original world |               Authored world |
| ---------------------------------------------------------- | -------------------------: | ---------------------------: |
| Resident geometry / materials (includes retained fallback) |                   178 / 42 |                     373 / 65 |
| Structural hulls                                           |                        139 |                          216 |
| Fish / hidden discoveries                                  |                     40 / 7 |                       40 / 7 |
| Uploaded resources after inspection tour                   | 178 geometries / 1 texture | 230 geometries / 27 textures |
| Uploaded resources after disposal                          |                      0 / 0 |                        0 / 0 |

The three normal-scene GLBs total 9,238,424 bytes (8.81 MiB), decoded once per library with shared geometry/maps and two lightweight clownfish rigs. Original sources remain resident for atomic comparison/fallback. Matched static views peak at 229 uploaded geometries; the animated chest inspection reaches 230. GPU counts are renderer-owned uploads, distinct from resident CPU inventory; neither is a driver-memory measurement. Audio ownership remains 19 nodes / three buffers / three looping sources.

| Matched full-scene view | Before draws / triangles | After draws / triangles |
| ----------------------- | -----------------------: | ----------------------: |
| log                     |            182 / 231,340 |           160 / 360,994 |
| shipwreck               |            154 / 215,728 |           137 / 355,916 |
| arch                    |             62 / 137,786 |            52 / 187,126 |
| filter                  |              34 / 54,100 |             28 / 61,220 |
| chest                   |            185 / 237,370 |           164 / 384,574 |
| statue                  |             88 / 131,812 |            81 / 157,526 |
| seahorse                |              50 / 83,190 |            45 / 135,852 |
| frogfish                |            127 / 180,256 |           109 / 317,278 |
| moray                   |            189 / 255,302 |           179 / 397,620 |
| host-pair               |            121 / 206,270 |           118 / 320,546 |

These counts include all visible aquarium content from each fixed camera, not only the target object. Each view records two synchronized SwiftShader intervals (including `gl.finish()` to drain queued software work before capture). They are diagnostic samples, not a statistically useful hardware FPS benchmark; cold compilation/loading is included in initial samples. The raw intervals remain in the geometry report.

| Authored CPU stress  | Fish/simulation step p95 | Swimming/collision p95 | Recovery corrections |
| -------------------- | -----------------------: | ---------------------: | -------------------: |
| 5 minutes / 60 fish  |                 1.395 ms |               0.206 ms |                    0 |
| 15 minutes / 40 fish |                 1.247 ms |               0.281 ms |                    0 |
| 30 minutes / 40 fish |                 1.133 ms |               0.271 ms |                    0 |

The CPU tests reconstruct collision from exact exported GLB point sets. They check the log/arch travel corridors, accepted ornament anchors and every authored lid point against the existing 1.52-unit hinge sweep guard. Extended stress runs cover both the original and authored structural worlds at 5 minutes / 60 fish, 15 minutes / 40 fish and 30 minutes / 40 fish, retaining safe positions, zero recovery corrections, native swimming bounds, pause gates, stable resource inventories, hidden home stability, chest occupancy/bubble limits, moray states and audio-event limits. Those accelerated simulations are not wall-clock GPU or audio quality measurements.

The browser checks actual decoding, PBR textures, shader compilation, authored child attachments, morph instances, current-driven tentacles, rare walk/crawl poses, chest animation, native pointer lock/swimming, reduced motion, pause/resume and audio lifecycle. A deliberately missing prop library keeps the usable original scene and reports the fallback; all loads are local, deduplicated and explicitly owned. Disposal returns uploaded geometry and textures to zero.

## Remaining limits

- Hardware FPS and comfort on the target Mac are pending user review. Linux Chromium uses SwiftShader software rendering; its timings cannot establish MacBook Air performance or cross-browser compatibility.
- Background fish, broad hardscape, vegetation and sand retain their earlier presentation. Dense hero assets increase resident/download budgets; original meshes remain resident for atomic comparison and fallback. No LOD system or compressed texture pipeline is claimed.
- Structural convex components approximate fine surface relief. Protected roof, floor, arch and crown patches preserve the current discovery controllers; this pass does not generalize perching to arbitrary user-edited geometry.
- The models are original authored candidates with some repeated surface motifs. Final artistic acceptance is the user's review, not a file-format or triangle-count check.

## Manual macOS acceptance checklist

### Environment props

- [ ] Log no longer reads as a simple polygon tube.
- [ ] Shipwreck looks more constructed and detailed.
- [ ] Stone arch feels like a finished ornament rather than a bent slab.
- [ ] Filter looks like actual aquarium equipment.
- [ ] Treasure chest feels more finished and articulated.
- [ ] Statue has stronger shape and surface character.

### Creatures

- [ ] Seahorse looks anatomically improved.
- [ ] Frogfish looks more distinctive and less blob-like.
- [ ] Moray feels more finished and believable.
- [ ] Clownfish look closer to benchmark quality.
- [ ] Anemone tentacles and form feel richer.

### Overall

- [ ] Props and creatures feel less placeholder-like.
- [ ] Scene close-ups are more immersive.
- [ ] Silhouettes are more interesting from multiple angles.
- [ ] Increased geometry improves form rather than just density.
- [ ] Performance remains comfortable.
- [ ] Swimming and exploration still feel smooth.
- [ ] The aquarium feels more like a crafted world.
