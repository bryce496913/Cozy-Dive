# v0.5 Pass 030 — Babies in the tank

## Part 1: Pass 029 regression

Baseline application: merged PR #53, commit `a6c78de`, version `0.5.0-alpha.1`. Baby-animal code is not introduced before completing these regressions. Browser checks run sequentially with Chromium/SwiftShader at DPR 0.5 and the original CSS viewports; geometry and behavioral assertions are retained. This is not evidence of target Mac performance.

The passage fixture now saves five validated seagrass additions as close as possible to the crevice alley, outside its keep-out and the protected routes, then reloads them before real-input travel. The first run completed both directions, the office round trip, pause-screen return and outer-water release. Its final memory comparison found 112 → 113 textures, with geometries stable at 363: the office miniature creates one persistent render-target texture on its first view. The harness now warms that office view before recording its baseline and reruns the unchanged equality assertion. This is a benchmark initialization correction, not a relaxed resource limit.

The first warmed rerun stopped before writing its final result when the test process and local servers ended. The environment was connected when inspected; the cause is not established. The check was restarted rather than skipped. The completed rerun passed in **1,989.7 seconds**, including five restored additions, both travel directions, office round trip, pause-screen return and outer-water release. Uploaded resources matched at **363 geometries / 113 textures / 113 programs**, with no page or console errors.

[Passage raw report](screenshots/v0.5-pass030/baseline-passage-report.json)

`integration` passed in **119.6 seconds**: all nine physical routes, four native movement keys (2.762 m in the expected direction), unavailable/rejected pointer lock, unavailable WebGL and real context loss. No unexpected page/console errors or warnings. Routes use autonomous steering through the production swimming/collision system, with rendered endpoints.

`production` passed against the built preview in **75.1 seconds**: all ten GLBs returned 200, explicit entry captured the pointer, camera-directed W ascent changed depth from 9.4 to 9.2 m, Escape paused, and volume 41 persisted after reload. No page/console errors or warnings.

[Integration report](screenshots/v0.5-pass030/baseline-integration-report.json) · [Production report](screenshots/v0.5-pass030/baseline-production-report.json)

`office` passed in **216.5 seconds**: 1.26 m of native-input walking at eye height 1.28 m, entry/surface and two further office/tank cycles, six fixed room views and zero WebGL/page/console errors or warnings. Uploaded resources stayed at **432 geometries / 113 textures**. Final office-pass view measurements ranged from 24–36 calls and 19,814–61,550 triangles; they exclude the miniature's earlier render pass and do not measure hardware FPS.

[Office report](screenshots/v0.5-pass030/baseline-office-report.json)

The first `outer-reef` attempt was interrupted by an environment reconnection after its return-at-the-wall screenshot. Its browser and local servers were no longer running. Completed passage, integration, production and office results were preserved; the sequential runner resumed from `outer-reef`. The partial outer-reef attempt is not counted as a pass.

The completed `outer-reef` rerun passed in **3,030.3 seconds**. All **235 fish moved**, with none below the floor. Native W input settled the swimmer at the measured seabed (-0.172 m), reached -11.57 m down the wall, eased to a hover 5.58 m beyond the lip and at x = 28.11 m in the side band. Six rendered views measured 47–77 calls and 1,061,343–1,841,579 triangles. Both return/release cycles matched the initial **432 geometries / 113 textures**; no console/page errors. Preparation and CPU-submit timings in the raw report are software-renderer diagnostics only.

[Outer-reef report](screenshots/v0.5-pass030/baseline-outer-reef-report.json)

The first `big-creatures` attempt was stopped after finding that its direct `browser.newContext()` bypassed the external DPR wrapper. It is not counted as evidence. The wrapper now applies and logs DPR 0.5 for both direct pages and contexts, and the harness restarts with its original viewport and unchanged assertions. The earlier completed harnesses used direct pages and logged DPR 0.5.

The verified-DPR `big-creatures` rerun passed in **1,279.5 seconds**: nine models moved and animated; **21,600 clearance samples / zero hits**; all three sightings appeared, were listed and persisted after reload; the waiting swimmer's closest shark pass was **5.59 m**. The shark/ray/turtle views measured 40/51/45 calls and 431,382/1,227,940/835,449 triangles. Both release/revisit comparisons matched **432 geometries / 113 textures**, with no page or console errors.

[Big-creatures report](screenshots/v0.5-pass030/baseline-big-creatures-report.json)

A further environment reconnection ended `runtime-fixes` shortly after it began, along with the local server. Its partial attempt is not counted. The runner resumes there, preserving the six completed passes.

`runtime-fixes` passed in **63.8 seconds**: office fish/plant/creature clocks froze on pause, the real AudioContext suspended on pause and controlled visibility loss, the visible paused office stayed silent, and explicit entry resumed it. Native E in the outer waters neither surfaced the player nor started a transition. No page errors were recorded (this harness does not collect console errors). Visibility is controlled rather than a physical browser-window switch; audio evidence is functional, not listening.

[Runtime-fixes report](screenshots/v0.5-pass030/baseline-runtime-fixes-report.json)

`reef-life` passed in **53.3 seconds**: 235 fish / nine large creatures; **205,560 creature-clearance samples / zero hits**, zero unsafe fish over 2,700 simulation steps, six rendered views, native pause/resume and W movement. Uploaded resources matched at **362 geometries / 112 textures** (a different warmed view set from office/dive harnesses). No page/console errors. Its CPU comparisons are simulation diagnostics on this machine, not hardware FPS.

[Reef-life report](screenshots/v0.5-pass030/baseline-reef-life-report.json)

**Part 1 is complete: all eight required baseline harnesses passed before introducing baby-animal implementation.** Interrupted attempts above were resumed; none was substituted for a completed pass. No production application change was needed for these baseline results.

## Part 2: small tank visitors

Candidate: `0.5.0-alpha.2`; no release tag. The three animal sightings unlock a Blacktip pup, Baby eagle ray and Turtle hatchling, one of each independently of the twenty decoration places. Native catalog actions add/fade in near clear water around the swimmer or return/fade out. Version 2 of the same local save migrates Pass 029 decorations, validates animal ids independently, tolerates unavailable storage and resets both after confirmation.

The models and strokes are the existing local outer-reef assets, borrowed through the same loader. Neutral dimensions in aquarium coordinates are approximately 0.54 m pup length, 0.50 m ray disc (0.72 m including its long tail) and 0.25 m turtle shell (0.31 m whole-body length). These are miniature adult forms; no new models or juvenile mesh edits. Both detail levels and full authored morph endpoints are tested against their conservative collision envelopes; the flat ray rest has a separate verified neutral envelope.

Pure fixed-30-Hz movement uses reused navigation/search buffers and swept body checks. Routes protect production hulls, small pebbles, placed additions, homes, crevice/return alley, glass margins, the actual rippled sand and the animated chest lid's whole sweep. Later edits invalidate paths, and placement rejects the resident's present volume. The ray rests flat before taking off and resuming strokes. Fish see stable resident positions for steering and swept personal space. Pause freezes simulation and fades; reduced motion reduces strokes and speed. The office uses the same residents on far detail levels.

An original tank has no resident owner or model requests. The owner borrows geometry/textures, owns opacity materials and simulation, handles late leases and repeated disposal, and is removed after the final return. Outer-reef cache eviction now waits until no world retains a lease, preserving shared resources across visits.

## Feature checks

| Check | Result |
| --- | --- |
| `npm run build` | Passed, 8.52 s after the lid-sweep correction |
| `npm run test -- --maxWorkers=1` | **513 tests / 57 files passed**, 132.09 s Vitest duration |
| `npm run typecheck` | Passed, 8.84 s |
| `npm run lint` | Passed, 24.00 s |
| `npm run test:stress` | **10 scenarios passed**, 208.85 s Vitest duration |

Coverage includes unlocks, independent limits, version 1 migration, partial/corrupt/unavailable saves, reset, valid spawning around existing swimmers, swept detours and re-planning without relocation, giving way, smaller reduced-motion strokes, pause/fade clocks, both model detail levels/morphs, flat ray clearance, shared cache ownership, late loads, fade reversal and one-time disposal. The production habitat with twenty additions runs for thirty simulated minutes at each of 30/60/120 FPS, checks every fixed step, and ends with identical state. Heavy new tests use explicit 20-second timeouts; the global timeout is unchanged.

The first complete feature suite passed 512 tests. A follow-up after the lid guard and additional test hit five-second timeouts in two unchanged discovery tests; the other 511 passed. Both discovery tests then passed unchanged in an isolated 14-test run (5.02 s total), and the final complete 513-test suite passed. No timeout or assertion was relaxed. CPU/stress and browser jobs ran separately. The first feature-browser attempt found its local server stopped before navigation; it was restarted rather than counted as evidence.

## macOS acceptance checklist

- Discover each large animal outside, return, and check that only seen animals appear under **For your tank**.
- Add each visitor and check the sizes and miniature forms read as charming, calm and natural. Watch the pup's loops, low ray glides/rests, and hatchling's paddling/lightward rises.
- Swim close; visitors should ease aside and fish should leave room. Check the ray's long tail, all strokes, rocks, additions, ornaments, chest lid, homes, glass and the crevice for clipping.
- Place a later addition near a route; the visitor should continue around it without pushing or getting stuck.
- Pause/resume, switch reduced motion, return one visitor, reload, and test both reset confirmation choices. Sightings must remain.
- Inspect the office miniature and repeat dive, surface and passage trips with zero and three visitors.
- Compare frame time against `0.5.0-alpha.1` with twenty additions plus three visitors, and play for 20–30 minutes to check smoothness and comfort.

All browser evidence is cloud Chromium/SwiftShader only. macOS performance, Safari behavior, subjective charm/size and long-session comfort remain pending. v0.4 remains open at `0.4.0-rc.3`; this pass does not close either milestone.
