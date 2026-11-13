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
