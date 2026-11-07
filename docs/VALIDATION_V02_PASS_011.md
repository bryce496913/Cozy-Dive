# v0.2 Pass 011 — Tropical Aquarium Integration & Final Validation

Executed November 7, 2026. Base `main` at `07fc0cd`, including merged Pass 010 / PR #17. Branch `codex/v0.2-pass-011-tropical-validation`. Private release candidate **0.2.0-rc.6**. No automatic merge, release or tag. Await final user acceptance before closing v0.2 or starting v0.3.

## Scope and recommendation

This pass reviews the complete tropical saltwater aquarium from Passes 007–010. It adds validation and updates current documentation; production scene generation, animal models/tuning, swimming physics, controls, UI and audio are unchanged. No demonstrated product issue required a behavioral or visual fix. Historical validation files remain unchanged.

The technical candidate is suitable for manual macOS acceptance after the automated checks below. **Final v0.2 release readiness remains conditional on target MacBook Air performance, Safari/browser behavior and human visual/audio/comfort approval.** Software-rendered cloud results cannot establish these criteria.

## Complete production inventory

| Free-swimming species |  Count | Integration coverage                                                                          |
| --------------------- | -----: | --------------------------------------------------------------------------------------------- |
| Blue-green chromis    |     20 | Cohesive schooling, asynchronous dart/glide, slow/fast diver scatter and recovery             |
| Pajama cardinalfish   |      6 | Loose social hovering, rest, local exploration and bounded reactions                          |
| Firefish goby         |      6 | Safe shelter selection, gradual retreat and recovery without teleporting                      |
| Yellow assessor       |      4 | Shaded reef/overhang home preferences, cover inspection and solid avoidance                   |
| Royal gramma          |      2 | Crevice/reef-face association and local independent activity                                  |
| Ocellaris clownfish   |      2 | Body-inclusive three-unit anemone home, short excursions, local retreat/return                |
| **Total**             | **40** | Stable IDs, finite/contained states, reachable bounded target selection and activity progress |

Additional animals: **one moray, one seahorse, one frogfish, five nudibranchs and one host sea anemone**. They are separate from the free-swimming registry. There are **six stony coral colonies**, **eight finger-leather soft corals** and **seven sea fans**; coral colonies are animals, not plants. Vegetation also contains **16 turtle-grass clumps, 12 Caulerpa, 12 red macroalgae and 10 Halimeda**, for 65 shared vegetation/soft-coral placements, plus eight seagrass meadows with 1,152 blades. No freshwater fish/plant registry or model branch remains in `src/`; historical test fixtures and validation documents are preserved.

Moray construction validates its complete folded-to-emerged deformation envelope against the real log and all solids. Controller regressions cover all five calm states, local retreat, smooth extension, consistent normals, finite poses, pause/reduced motion and deterministic timing. The anemone attaches to an actual reef face; its 72 tentacles use a bounded GPU current envelope and one merged geometry/material. Clownfish share its validated host metadata.

The seahorse references a real sea-fan placement and stays within its small hovering/gripping envelope. The mostly stationary frogfish uses a wreck-floor face with rare eight-second repositioning per 112 motion seconds. Five nudibranch variants crawl continuously on actual wreck/arch/statue face patches; their foot roots stay 0.006 units off the support plane with stable normals. Existing tests sample posed/shader-deformed vertices against the entire collision world, not just root positions. Their seven focus/view locations have safe approach routes and no markers, notifications or collection state.

Each subsystem has an explicit owner: `Aquarium` owns ornaments, fish, vegetation, meadows, hardscape and `AnchoredLife`; the latter owns anemone, moray and hidden life. Detachment precedes generic scene disposal; shared geometries/materials and instance buffers dispose once. No new timer, listener, animation loop, audio node or context belongs to the creature/ornament layers. See [fish](FISH.md), [plants and coral](PLANTS.md), [anchored life](ANCHORED_LIFE.md) and [hidden life](HIDDEN_LIFE.md).

## Six ornaments, habitat and collision review

| Object             |            Root x / y / z | Yaw radians | Placement / opening                   |
| ------------------ | ------------------------: | ----------: | ------------------------------------- |
| Corner filter      |  16.950 / 8.000 / -13.390 |        0.00 | Rear-right wall mount                 |
| Stone arch         | -14.700 / 0.081 / -11.700 |        0.25 | Rear-left bank; open bore             |
| Shipwreck          | -11.200 / -0.013 / 10.000 |        0.25 | Front-left bank; open planked hull    |
| Hollow log         |     5.600 / 0.157 / 5.100 |       -0.30 | Right bank; open bore / moray shelter |
| Island-head statue |    14.700 / 0.050 / 4.400 |       -0.20 | Right bank landmark; nudibranch face  |
| Treasure chest     |    -5.100 / 0.050 / 9.700 |       -0.25 | Front-left bank; guarded hinged lid   |

All six props are present and deliberately placed along the banks, clear of spawn and the central channel. Five floor props are based on the highest sampled substrate under their footprint with a 0.015-unit placement offset; the filter is deliberately wall-mounted. Bases can expose tiny sand ripples; this is not a terrain-conforming contact model. Rendered dimensions and floor/corner placement are checked against aquarium bounds. Close screenshots retain the actual procedural geometry and scale.

There are **139 structural collision hulls**: 34 native reef rocks, 39 stony/older decorative components and 66 components belonging to the six aquarium ornaments, including the moving lid. Solid shapes use the visible convex component geometry rather than oversized whole-object boxes. The arch and log retain real open bores; the wreck has separate planks/ribs/cabin components and a passable open interior. Fine trim, flexible tissue, foliage, nudibranchs and pebbles remain passable. Chest vegetation clearance is not an invisible player collider. The eel retreats softly instead of blocking the log with a hiding-site box.

Regression coverage includes direct/glancing sweeps, sliding, overlapping solids, openings, aquarium corners, persistent contact and reversing away. Physical route fixtures advance the production swimming integrator against the complete collision world to every hidden viewing location, through the stone arch and around the shipwreck. Each segment is prevalidated with 0.65-unit clearance; player contact uses the production 0.28 radius. These fixtures start at spawn, use no mid-route teleport and must reach every waypoint within 0.075 units; failure to progress throws. The arch is approached from its open front rather than descending onto the roof. The wreck circuit chooses a clear near-prop elevation using actual hulls.

Marine habitat remains turtle grass, green/red/calcifying macroalgae, attached soft and stony coral, reef rock, rippled sand, an open sandy central corridor, coherent blue-green fog/water and slow shared currents. Close views show anchored roots and distinct rigid/flexible forms. No broad redesign, new species, predator/prey simulation or new interaction was introduced. Stylized plate supports, simple light shafts and per-batch transparency remain known artistic/rendering limits.

## Chest and bubble lifecycle

The actual hinged chest is exercised through multiple complete seeded cycles: eight seconds closed, four-second smooth opening, four-second hold, five-second smooth closing and a varying closed interval (25–45 seconds total). Occupant clearance can deliberately hold the cycle before a sweep. The regression verifies continuous hinge motion, one pooled burst per eligible opening and empty particle intervals between bursts.

The fixed 18-instance bubble allocation is reused exactly; no transient particle array or resource is added per cycle. Drawn particles rise, shrink and terminate before crossing the water surface or their finite lifetime. A separate near-surface burst proves termination. Pause freezes the hinge, bubble matrices, filter flow and creature poses; resume advances one bounded step without catch-up. Reduced motion holds the lid/flow and clears optional bubbles, then resumes from the same cycle. Long-session audits retain bounded counts and nonzero cycle/burst progress. Chest/filter add no continuous or cycle-synchronized audio layer; the unchanged sparse scheduler retains one transient voice and its existing interval.

## Automated results and extended scenarios

| Required check                   | Result                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| `npm run build`                  | Pass; 730.86 kB JS / 195.90 kB gzip, existing chunk advisory |
| `npm run typecheck`              | Pass                                                         |
| `npm run lint`                   | Pass (ESLint and Prettier)                                   |
| `npm run test -- --maxWorkers=2` | **274 tests / 26 files pass**, 61.20 seconds                 |
| `npm run test:stress`            | **4 checks pass**, 43.33 seconds                             |
| `git diff --check`               | Pass                                                         |

`npm run format` is applied after edits. Production `src/` is unchanged from the merged Pass 010 baseline.

The four new routine integration regressions complement all existing tests: whole-scene pause/resume, repeated hinge-to-pool coupling, surface termination/pool reuse, and nine physical navigation routes. Existing suites still cover anatomy, species identity, shelter, schooling, individual behavior, proximity, containment, frame-rate equivalence, settings, input, swimming, GPU bounds and exact-once disposal. No old assertion or timeout is relaxed or excluded. An initial overlapped CPU-suite/Chromium attempt exceeded an existing five-second test timeout; it was interrupted and replaced by sequential complete runs. An early navigation fixture descended onto the arch roof/near the rear wall; the approach was corrected to use the clear front entry without changing geometry or collision checks.

`TropicalAudit.ts` adds explicit whole-scene checks to the 5/15/30-minute stress scenarios: finite transforms/clocks, unchanged geometry/material counts, stable 40-fish production roster alongside the separately requested 40/60-fish simulation, seven stable hidden identities, bounded horse/frog movement, nudibranch plane attachment, bounded particles, valid moray state/extension, and continued chest cycles. Snapshot traversals run only at coarse validation checkpoints, never in production frames. Existing assertions still require safe finite swimmers, continued travel in every 30-second window, multiple activities, bounded scatter and correct audio scheduling. Pause gates compare complete snapshots exactly.

| Scenario         | Full ornament/anchored/fish step mean / median / p95 / p99 ms | Swimming + collision mean ms | Minimum travel / 30 s | Sparse events | Corrections | Chest cycles / bursts |
| ---------------- | ------------------------------------------------------------: | ---------------------------: | --------------------: | ------------: | ----------: | --------------------: |
| 5 min / 60 fish  |                                 0.616 / 0.479 / 1.081 / 2.875 |                        0.068 |                 1.432 |             6 |           0 |                 8 / 8 |
| 15 min / 40 fish |                                 0.341 / 0.268 / 0.611 / 1.334 |                        0.064 |                 1.730 |            14 |           0 |               23 / 24 |
| 30 min / 40 fish |                                 0.328 / 0.276 / 0.576 / 1.120 |                        0.054 |                 1.255 |            30 |           0 |               48 / 49 |

All five moray states are observed in every long scenario. There are 10/30/60 whole-scene checkpoints, respectively; every checkpoint preserves 178 owned geometries / 42 materials and seven hidden animals. Minimum travel is intentionally measured only for free swimmers. The archived Pass 006 full-step means were 0.399 / 0.185 / 0.187 ms and swimming/collision means 0.068 / 0.045 / 0.044 ms; this candidate has more hulls and additional systems. Timing observations are not deterministic assertions or hardware claims. The separate 30/60/120 FPS fish schedule comparison remains exactly equal; existing anchored/discovery tests retain their frame-rate equivalence checks.

The tests do not promise global pathfinding or unreachable-target freedom for arbitrary edited tanks. Bounded target trials, route checks, target-progress timeout, deterministic generated habitat and the observed long-session progress guard against persistent trapping in this candidate. Body-inclusive clownfish host bounds and diver return behavior retain dedicated regressions; slow surface crawling and frogfish stillness are intentional and are not judged by free-swimmer travel thresholds.

## Browser, controls, UI and failures

All five existing browser harnesses are rerun: full aquarium/render profile, ornaments, anchored life, discoveries and native controls/audio lifecycle. The new integration harness adds rendered physical-route endpoints and explicit failure scenarios. Reports/screenshot evidence are linked below. Instrumentation is injected only into Playwright-served sources; no production debug API ships.

The full eleven-view profile, ornaments, anchored life, discoveries, integration and native lifecycle checks pass. Normal captures report zero console errors; the full profile and creature/integration captures also retain zero warnings. Deliberate WebGL-failure pages produce expected failure diagnostics and are assessed by their explicit UI/state assertions. The chest capture records 18 pooled bubbles and exact paused hinge/bubble equality; anchored captures show all five actual moray states and diver retreat; hidden captures prove two-minute surface crawling, a rare walking pose, pause equality, reduced-motion settling and disposal.

The first lifecycle attempt was interrupted during entry while a Vite reload of `validation/SwimRoutes.ts` was logged. The retained rerun used unchanged served files and completed every native/lifecycle assertion. The interrupted attempt is not presented as passing evidence. The production-build smoke check also passes without source injection: hashed build assets load, Enter captures the mouse only on request, camera-directed W ascent changes the public depth readout, Escape pauses, and volume persists after reload. It reports zero console errors or warnings.

The lifecycle harness exercises native Enter/pointer lock, W movement, camera-directed ascent/descent, legacy Space/Shift rejection, input clearing on blur, modified M shortcut safety, mute/unmute, volume migration/persistence, silent preview, gesture-started Web Audio, four pause/resume cycles and controlled background visibility. Integration checks feed actual W/A/S/D events through the production input and swimming logic. Graphics failure checks explicitly disable WebGL, remove/reject pointer lock and lose the real WebGL context: a clear message appears, context loss releases pointer lock, suspends audio and stops simulation. Unsupported audio remains independently playable.

Headless visibility is a controlled document-hidden event, not an assertion about Safari or real tab scheduling. Route steering is autonomous with actual physics; endpoint screenshots are not a human navigation recording. The close and wide captures complement sampled geometry/collision proofs but cannot certify every possible view.

## Performance and Pass 006 comparison

The scene owns **178 geometries / 42 materials**, versus Pass 006's **93 / 31**. Structural hulls increase **73 → 139**, while production free swimmers remain **40**. Persistent audio remains **19 nodes / 3 buffers / 3 loops / 2,048,000 buffer bytes**. After the full camera sweep, uploaded resources are **178 geometries / 1 texture**; disposal returns both counts to **zero** and closes audio.

| Identical camera | Pass 006 draws → Pass 011 |         Triangles | Pass 011 rAF mean / median / p95 / p99 ms | CPU render/finish mean ms |
| ---------------- | ------------------------: | ----------------: | ----------------------------------------: | ------------------------: |
| overview         |                 250 → 210 | 181,154 → 258,148 |       710.57 / 700.00 / 1449.90 / 1449.90 |                     6.208 |
| floor            |                  75 → 116 |  79,526 → 198,706 |         384.83 / 383.30 / 566.70 / 566.70 |                     7.117 |
| glass-away       |                   20 → 41 |  63,120 → 141,660 |         133.33 / 150.00 / 250.00 / 250.00 |                     4.475 |

Historical rAF mean values at those cameras were 485.69 / 233.33 / 107.14 ms, respectively. These and the current software intervals are not hardware frame budgets. Overview submissions decrease while submitted triangles increase; floor/away costs increase with the richer marine scene. The full eleven-view distributions and camera coordinates are retained in [marine profiling JSON](benchmarks/v0.2-pass011/marine.json).

| Browser CPU scenario             | Pass 006 mean ms | Pass 011 mean / median / p95 / p99 ms |
| -------------------------------- | ---------------: | ------------------------------------: |
| 40 fish / fixed step             |            0.171 |         0.273 / 0.200 / 0.500 / 1.300 |
| 60 fish / fixed step             |            0.299 |         0.523 / 0.400 / 1.100 / 2.500 |
| 40 fish / dense scatter-recovery |            0.252 |         0.511 / 0.300 / 1.600 / 2.500 |
| 60 fish / dense scatter-recovery |            0.264 |         0.441 / 0.400 / 0.700 / 1.400 |

Each browser CPU case retains 600 samples and zero corrections. These timings isolate fish stepping; complete ornament/anchored/player collision costs appear in the extended scenario table. Dense maximum scatter exceeds 0.99 for both counts. The temporary 60-fish overview submits **210 draws / 276,268 triangles**, with the same visible batches whether culling is enabled or disabled at that particular pose. This does not imply culling is ineffective in other views.

Production JavaScript is **730.86 kB / 195.90 kB gzip**, versus Pass 006 **674.76 / 177.85 kB**. The existing >500 kB chunk advisory remains. There are no runtime asset downloads.

Content differs substantially from the historical freshwater Pass 006 scene. The baseline remains an honest cost reference, not a same-scene optimization experiment. Overview, floor and glass-away camera transforms are retained for comparison; species portraits necessarily differ. Counts measure submitted geometry, not GPU frame time. No model/collider was simplified to improve a benchmark.

Measured render intervals and CPU render/finish submission are separate. Cloud Chromium uses SwiftShader at 960×640, DPR 1. Twelve render samples per view produce only eleven rAF intervals; p95/p99 are diagnostic extremes with small samples. Scheduling, software rasterization and browser protocol work influence these values. Use 120+ samples and the production build on the target MacBook Air for hardware acceptance; CPU submission time is not hardware FPS.

The temporary 60-fish scene is disposed and the original production population restored. All living coral, vegetation, six ornaments, hidden/anchored animals and procedural audio are present in whole-scene runs. Chest/bubble rendering is additionally captured during an actual opening; player collision timings use real props in extended scenarios. Draw/triangle and owned/uploaded resource counts are more reproducible here than elapsed cloud timings. No CPU speedup or hardware comfort claim is made.

The hidden layer's controlled on/off comparison at an identical camera/pose is **271 → 283 draws / 254,218 → 275,744 triangles**, an incremental **12 draws / 21,526 triangles**. Its 4,800 batched updates average **0.0043 ms** (p95 0.0100, p99 0.0150) per seven-animal update. The complete anchored update, including hidden life, averages **0.0074 ms**; these timer-quantized CPU diagnostics exclude rendering and are retained in the individual reports. There is no hardware speed claim.

## Native long-session memory, audio and ownership

Native Chromium/Web Audio completes **54,000 fixed steps / thirty active simulated minutes** with **zero containment corrections**, 40 fish, one context, 19 persistent nodes, three buffers, three loops and at most one transient voice. Whole-scene snapshots retain 178 geometries / 42 materials, 139 hulls, finite transforms and all seven hidden animals.

| Active minute | Fixed steps | Forced-GC heap bytes | Uploaded geometries / textures | Contexts / nodes / buffers / loops | Voices | Corrections |
| ------------- | ----------: | -------------------: | -----------------------------: | ---------------------------------: | -----: | ----------: |
| 0             |           0 |           16,017,264 |                        115 / 1 |                     1 / 19 / 3 / 3 |      0 |           0 |
| 5             |       9,000 |           16,479,968 |                        115 / 1 |                     1 / 19 / 3 / 3 |      0 |           0 |
| 15            |      27,000 |           16,661,712 |                        115 / 1 |                     1 / 19 / 3 / 3 |      0 |           0 |
| 30            |      54,000 |           16,714,168 |                        115 / 1 |                     1 / 19 / 3 / 3 |      0 |           0 |

Heap grows about **0.70 MB** from the initial snapshot and only **52 KB** between fifteen and thirty minutes. Pass 006 ended at **14,252,256 bytes**, versus **16,714,168** here; module/content/test differences make this a cost observation rather than an isolated leak comparison. Uploaded GPU counts remain **115 geometries / 1 texture** in this fixed-view soak; the full camera sweep uploads 178 / 1 because more meshes become visible.

This native run uses reduced motion inherited from the migrated-settings fixture. The separate extended ecosystem scenarios exercise normal motion and periodic reduced-motion toggles, including many complete chest cycles. These runs are complementary; a stationary chest under reduced motion is expected.

Rendering is canceled during accelerated simulation; this is thirty active simulated minutes, not thirty minutes of real-time rendering/listening. Native transient voices are stopped at their simulated end to keep the test accelerated. Context suspend/resume is awaited every five minutes. Persistent nodes/buffers/loops and uploaded GPU resources are checked against fixed ownership; post-GC heap samples are observations, not a universal proof of no leak. Modules/dev-server/test state remain in the JS process after disposal.

Two additional full Application recreations return uploaded geometry/textures to zero and close audio. Scene-wide and per-layer tests check exact-once owned/shared disposal, including instance buffers. No accumulating pool, multiplied context or growing persistent audio-voice count is observed.

## Browser evidence

All retained reports: [marine/render/40–60-fish profile](benchmarks/v0.2-pass011/marine.json), [ornaments](benchmarks/v0.2-pass011/ornaments.json), [anchored life](benchmarks/v0.2-pass011/anchored.json), [hidden discoveries](benchmarks/v0.2-pass011/discoveries.json), [physical routes/failure handling](benchmarks/v0.2-pass011/integration.json), [extended stress](benchmarks/v0.2-pass011/stress.json), [native lifecycle](benchmarks/v0.2-pass011/lifecycle.json), [production smoke](benchmarks/v0.2-pass011/production.json).

- Marine/UI: [preview](screenshots/v0.2-pass011/marine/preview.png), [overview](screenshots/v0.2-pass011/marine/overview.png), [chromis](screenshots/v0.2-pass011/marine/chromis-school.png), [cardinal](screenshots/v0.2-pass011/marine/pajama-cardinalfish.png), [firefish](screenshots/v0.2-pass011/marine/firefish-goby.png), [assessor](screenshots/v0.2-pass011/marine/yellow-assessor.png), [gramma](screenshots/v0.2-pass011/marine/royal-gramma.png), [seagrass](screenshots/v0.2-pass011/marine/seagrass.png), [soft coral](screenshots/v0.2-pass011/marine/soft-coral.png), [floor/channel](screenshots/v0.2-pass011/marine/floor.png), [pause](screenshots/v0.2-pass011/marine/pause.png), [settings](screenshots/v0.2-pass011/marine/settings.png).
- Ornaments: [chest](screenshots/v0.2-pass011/ornaments/chest.png), [open chest/bubbles](screenshots/v0.2-pass011/ornaments/chest-open-bubbles.png), [filter](screenshots/v0.2-pass011/ornaments/filter.png), [arch](screenshots/v0.2-pass011/ornaments/arch.png), [wreck](screenshots/v0.2-pass011/ornaments/shipwreck.png), [log](screenshots/v0.2-pass011/ornaments/log.png), [statue](screenshots/v0.2-pass011/ornaments/statue.png).
- Anchored animals: [host-pair](screenshots/v0.2-pass011/anchored/host-pair.png), [anemone](screenshots/v0.2-pass011/anchored/anemone.png), [anemone-motion](screenshots/v0.2-pass011/anchored/anemone-motion.png), [clownfish](screenshots/v0.2-pass011/anchored/clownfish.png), [eel-hidden](screenshots/v0.2-pass011/anchored/eel-hidden.png), [eel-peeking](screenshots/v0.2-pass011/anchored/eel-peeking.png), [eel-resting](screenshots/v0.2-pass011/anchored/eel-resting.png), [eel-emerging](screenshots/v0.2-pass011/anchored/eel-emerging.png), [eel-retreating](screenshots/v0.2-pass011/anchored/eel-retreating.png), [eel-head](screenshots/v0.2-pass011/anchored/eel-head.png), [eel-diver-retreat](screenshots/v0.2-pass011/anchored/eel-diver-retreat.png).
- Hidden animals, close and wide: seahorse-home: [close](screenshots/v0.2-pass011/discoveries/seahorse-home-close.png), [wide](screenshots/v0.2-pass011/discoveries/seahorse-home-wide.png); frogfish: [close](screenshots/v0.2-pass011/discoveries/frogfish-close.png), [wide](screenshots/v0.2-pass011/discoveries/frogfish-wide.png); nudibranch-1: [close](screenshots/v0.2-pass011/discoveries/nudibranch-1-close.png), [wide](screenshots/v0.2-pass011/discoveries/nudibranch-1-wide.png); nudibranch-2: [close](screenshots/v0.2-pass011/discoveries/nudibranch-2-close.png), [wide](screenshots/v0.2-pass011/discoveries/nudibranch-2-wide.png); nudibranch-3: [close](screenshots/v0.2-pass011/discoveries/nudibranch-3-close.png), [wide](screenshots/v0.2-pass011/discoveries/nudibranch-3-wide.png); nudibranch-4: [close](screenshots/v0.2-pass011/discoveries/nudibranch-4-close.png), [wide](screenshots/v0.2-pass011/discoveries/nudibranch-4-wide.png); nudibranch-5: [close](screenshots/v0.2-pass011/discoveries/nudibranch-5-close.png), [wide](screenshots/v0.2-pass011/discoveries/nudibranch-5-wide.png). [Two-minute crawl](screenshots/v0.2-pass011/discoveries/nudibranch-1-after-two-minutes.png) and [rare frogfish walk](screenshots/v0.2-pass011/discoveries/frogfish-rare-walk.png).
- Physical route endpoints: [arch exit looking back through the opening](screenshots/v0.2-pass011/integration/stone-arch-through.png), [wreck circuit](screenshots/v0.2-pass011/integration/shipwreck-circuit.png), [seahorse view](screenshots/v0.2-pass011/integration/seahorse-home.png), [frogfish view](screenshots/v0.2-pass011/integration/frogfish.png); five nudibranch endpoint captures are retained in the same directory.
- Failures: [unavailable WebGL](screenshots/v0.2-pass011/integration/webgl-unavailable.png), [real context loss](screenshots/v0.2-pass011/integration/graphics-context-lost.png).
- Built candidate: [production preview](screenshots/v0.2-pass011/production/preview.png), [swimming](screenshots/v0.2-pass011/production/swimming.png), [settings](screenshots/v0.2-pass011/production/settings.png).

## Manual macOS acceptance — pending

Use `npm run build` and `npm run preview` on the target MacBook Air in Chrome and Safari. Record hardware, OS/browser versions, viewport/DPR, power mode and a 15–30-minute session. Measure mean/median/p95/p99 frame intervals, long tasks, heap/resources and subjective comfort; aim for the 16.7 ms frame budget. None of the following human checks is marked complete by cloud automation.

### Environment

- [ ] Aquarium reads clearly as tropical saltwater.
- [ ] No freshwater species remain.
- [ ] Reef vegetation and coral look natural.
- [ ] Six aquarium ornaments are visible.
- [ ] Environment remains balanced and uncluttered.
- [ ] Central swimming corridor remains open.

### Creatures

- [ ] Chromis school naturally.
- [ ] All six marine free-swimming species are recognizable.
- [ ] Clownfish stay with their anemone.
- [ ] Moray eel hides and peeks naturally.
- [ ] Hidden seahorse can be discovered.
- [ ] Hidden frogfish can be discovered.
- [ ] Nudibranchs are visible on close inspection.
- [ ] No creatures clip through major solid objects.

### Interaction

- [ ] Chest opens and closes naturally.
- [ ] Chest bubbles rise correctly.
- [ ] Filter looks appropriate.
- [ ] Stone archway is swimmable.
- [ ] Shipwreck and log collision works.
- [ ] Island statue remains a recognizable landmark.
- [ ] Existing swimming physics remain unchanged.
- [ ] Breathing buoyancy remains comfortable.

### Audio and performance

- [ ] Underwater ambience remains soft and natural.
- [ ] No excessively loud new prop sounds.
- [ ] Audio pauses and resumes correctly.
- [ ] FPS feels smooth on MacBook Air.
- [ ] No noticeable degradation during extended exploration.
- [ ] No crashes, obvious glitches or resource leaks.

Also test real tab switching, pointer-lock recovery, browser refresh/settings persistence, reduced motion and extended headphone/speaker listening. Final user acceptance is required before v0.2 closure or v0.3 work. No release/tag/merge is authorized by a passing automated report.
