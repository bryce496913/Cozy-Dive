# Reproducible v0.2 candidate validation

Start from `main` when comparing a baseline. Do not use the repository's old default branch as the baseline. No script changes production population, saved scene layout, physics or audio tuning.

## Routine and extended checks

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run test -- --maxWorkers=2
npm run test:stress
```

The opt-in stress configuration includes only `validation/ecosystem.test.ts`, uses one worker and a 120-second per-scenario budget. It does not change routine tests or their timeouts. It runs five minutes with 60 fish, fifteen and thirty minutes with 40 fish, plus a 30/60/120 FPS determinism comparison. Simulated time is accelerated. Real generated hulls, swimming/buoyancy, fish intentions/reactions, plant clocks and pure audio scheduling participate. It records sampled step/collision times, travel, corrections and activities in `/tmp/cozy-ecosystem-stress.json` (override with `COZY_REPORT`). Timing values are observations, never pass/fail budgets.

## Browser setup

The optional harness uses Playwright as a development tool, not an application dependency:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 5173
```

In a second terminal:

```bash
COZY_OUTPUT=/tmp/cozy-browser-report COZY_SAMPLES=120 node validation/browser.mjs
node validation/lifecycle.mjs
```

For local GPU measurements, set `COZY_HARDWARE=1 COZY_HEADFUL=1` to stop forcing SwiftShader and open a visible browser; check the reported `backend` rather than assuming acceleration. Use `COZY_URL` for another dev-server URL. Use `COZY_PLAYWRIGHT` to point to an existing Playwright ESM entry instead of installing it into this checkout. Set `COZY_CHROMIUM` to an installed Chromium executable when needed. Cloud execution used `/usr/bin/chromium` with SwiftShader and configurable render samples per viewpoint; this is deliberately not a hardware FPS claim. `COZY_DETAILS_ONLY=1` skips the marine-view screenshot/frame loop but still runs CPU, dense activity, 60-fish draw comparison and recreation/disposal checks. Output defaults to `/tmp/cozy011-browser` and `/tmp/cozy-marine-lifecycle.json`; override with `COZY_OUTPUT` and `COZY_LIFECYCLE_OUTPUT`.

The rendering harness fixes viewport/DPR, scenery seeds and 20 seconds of simulation, then uses the same camera positions. It reports mean/median/p95/p99 for rAF intervals and CPU render/finish submission separately. Small sample counts are diagnostic: use 120+ samples for a local investigation. Browser protocol/screenshot delays and software-GPU scheduling affect rAF timings. JavaScript render/finish time alone does not measure hardware frame latency. Draw/triangle counts are the reliable comparison here. Reports include steady and controlled scatter/recovery CPU samples for 40/60 fish, and a 60-fish scene drawn with batch culling off/on at the same pose. The temporary stress scene is disposed and the default restored.

The lifecycle harness uses actual Enter, keyboard and pointer lock, checks camera-directed depth, legacy keys, focus loss, audio/preferences and a controlled visibility event. It then cancels rendering and accelerates thirty active minutes in the full ecosystem (54,000 fixed steps). Native Web Audio nodes run, with environmental sources stopped after their simulated duration so a fast test does not wait for wall-clock audio. Context pauses are awaited. This tests state, ownership and resource bounds, not thirty minutes of real-time rendering or listening. Forced-GC heap samples at 0/5/15/30 minutes expose trends, without brittle heap/timing assertions. Nothing records microphone audio or requests new permissions.

All application instrumentation is injected into served source responses by Playwright. No debug API is shipped. Reports and screenshots go outside the repository unless deliberately copied into validation evidence.

## MacBook Air procedure

Use the production build (`npm run build`, `npm run preview`) for actual playtesting in Chrome/Safari on the target MacBook Air. Close competing tabs; record model, OS/browser versions, viewport, DPR and power mode. Use browser Performance/Memory tools while swimming from spawn through the banks, meadows and ornaments and approaching schools slowly/quickly. Record frame-time mean/median/p95/p99 and long tasks over at least 60 seconds for each view, then repeat after a 15–30 minute session. Aim at the 16.7 ms frame budget while checking p95/p99 spikes and subjective comfort. Test real tab switching, pointer-lock recovery and speakers/headphones. Do not infer hardware performance from SwiftShader or CPU-only simulation results.

The full human acceptance checklist and measured cloud results live in [Pass 011 validation](../docs/VALIDATION_V02_PASS_011.md). No release/tag/merge is performed by these scripts.

For Pass 008 decoration camera evidence, run `COZY_OUTPUT=/tmp/cozy-ornaments-browser node validation/ornaments.mjs` using the same Playwright/Chromium overrides. It captures the entire scene, six closeups, an open chest/bubble burst, pause equality, console errors and renderer/audio disposal. These are fixed camera fixtures, not navigation recordings. The lifecycle harness exercises real controls, settings and Web Audio, including a thirty-minute accelerated ecosystem soak.

For Pass 009 host/eel evidence run `COZY_OUTPUT=/tmp/cozy009-browser node validation/anchored-life.mjs` with the same optional Playwright/Chromium overrides. It captures anemone/current, both clownfish and multiple actual controller states of the moray. The report includes owned resources, draw counts, bounded batched anchored and isolated clownfish update diagnostics, pause equality and disposal. The extended ecosystem harness now updates both anchored animals alongside 40/60 fish.

For Pass 010 use `COZY_OUTPUT=/tmp/cozy010-browser node validation/discoveries.mjs` with the same Playwright/Chromium overrides. It captures close and central-channel wide views of all seven hidden animals, a two-minute crawling interval and a rare frogfish walking pose. Batched update timings, a controlled visibility on/off draw comparison, pause/reduced-motion checks and disposal are retained as JSON. The extended ecosystem and native lifecycle harnesses update the hidden layer through `AnchoredLife` without changing the 40/60-fish scenarios.

## Pass 011 integration

Run the existing `browser.mjs`, `ornaments.mjs`, `anchored-life.mjs`, `discoveries.mjs` and `lifecycle.mjs` scripts against the unchanged tropical content. Use separate output paths per script so reports do not overwrite one another. Run CPU tests and browser profiling sequentially to avoid contention on the cloud runner; leave existing assertions and timeouts intact.

```bash
COZY_OUTPUT=/tmp/cozy011-integration node validation/integration.mjs
```

The integration harness uses `SwimRoutes.ts` to advance the actual swimming integrator through full-world collision along all seven discovery approaches, through the arch, and around the wreck. It renders the physical endpoints, exercises native WASD key events, and tests unavailable WebGL, unavailable/denied pointer lock and real WebGL context loss. Autonomous route steering is a reproducible fixture, not a recording of human navigation. Only Playwright-served source is instrumented; no debug API or guidance ships.

`TropicalAudit.ts` records whole-scene snapshots in the stress and native lifecycle harnesses: stable roster/owned resources, finite transforms/clocks, surface attachment, bounded home movement, moray states, chest cycles and pooled particles. Long runs retain all prior fish/swimming/audio checks. The native lifecycle harness also samples uploaded GPU resource counts and JS heap at 0/5/15/30 minutes. Reduced-motion and normal-motion runs are complementary. Accelerated simulation does not replace a real-time target-hardware soak.

Await final user acceptance before closing v0.2 or starting v0.3. Use the complete [manual macOS checklist](../docs/VALIDATION_V02_PASS_011.md) with a production build; do not create a release or tag from validation scripts.

After `npm run build`, serve `npm run preview -- --host 127.0.0.1 --port 5175` and run `COZY_URL=http://127.0.0.1:5175 COZY_OUTPUT=/tmp/cozy011-production node validation/production.mjs` with the same Playwright/Chromium overrides. This smoke check uses public DOM/input only, without served-source instrumentation: built asset loading, preview mouse policy, Enter/pointer lock, camera-directed W ascent visible in the depth readout, Escape and persisted volume. It does not measure laptop hardware performance or subjective audio.

## Pass 012 authored asset benchmark

The normal profile/lifecycle harnesses still target `/`. For the opt-in showcase, use the same `COZY_PLAYWRIGHT`/`COZY_CHROMIUM` overrides and run:

```bash
python3 tools/art/inspect_assets.py
COZY_URL=http://127.0.0.1:5176 COZY_OUTPUT=/tmp/cozy012-visual node validation/visual-benchmark.mjs
ffmpeg -y -framerate 30 -i /tmp/cozy012-visual/frames/%03d.png -c:v libvpx-vp9 -b:v 1400k -pix_fmt yuv420p /tmp/cozy012-visual/swimming.webm
```

Start the dev server at port 5176 first. Freeze served source during browser captures; Vite HMR invalidates pointer lock and capture state. The harness retains before/assets-only/after images at identical camera transforms and a controlled portrait pose. The animation restores and follows a real simulated fish. It tests local GLB loading, one request per model/cache owner, decoded maps, full 20-fish authored instancing, native swimming, convex collider validity, safe first-person cameras, pause/reduced motion, finite states, missing-model fallback, two recreations and GPU/audio cleanup. Rendering timings are software diagnostic intervals; video encodes 80 simulated 1/30-second frames, not measured hardware FPS.

The normal `npm run build` excludes `benchmark.html`. `npm run build:benchmark` emits `dist-benchmark` for a separate production-mode asset test. Record normal and benchmark production checks independently. Re-run ordinary build/type/lint/tests/stress and native browser/audio regression checks. A serial-file test run may be used on a contended cloud runner without changing any assertion or timeout; document it explicitly rather than hiding an earlier timeout.

[Pass 012 evidence](../docs/VALIDATION_V02_PASS_012.md) includes the user-facing visual gate status. File validity and passing technical tests do not establish professional-quality art or MacBook Air performance.

For explicit production benchmark smoke validation, serve `dist-benchmark` at the selected port and run `COZY_URL=http://127.0.0.1:5177 COZY_OUTPUT=/tmp/cozy012-production-benchmark node validation/asset-smoke.mjs` with the same Playwright/Chromium overrides. The normal production harness remains `production.mjs` against the ordinary build. Source lint/format ignore only the generated `dist-benchmark` directory in addition to their existing generated-output exclusions.

## Pass 013 authored geometry

Use the same Playwright/Chromium environment variables above with a running dev server:

```bash
COZY_OUTPUT=/tmp/cozy013-geometry node validation/geometry-overhaul.mjs
COZY_OUTPUT=/tmp/cozy013-ornaments node validation/ornaments.mjs
COZY_OUTPUT=/tmp/cozy013-anchored node validation/anchored-life.mjs
COZY_OUTPUT=/tmp/cozy013-discoveries node validation/discoveries.mjs
COZY_OUTPUT=/tmp/cozy013-lifecycle node validation/lifecycle.mjs
```

The normal scene now awaits three authored local libraries. The geometry harness records ten identical-pose before/after pairs, deduplicated loading, actual seahorse/frogfish vertex clearance, missing-library fallback, complete cleanup and disposal with requests pending. Its two synchronized software frames per view drain the GPU queue before screenshots; these diagnostic timings are not target-machine FPS. `COZY_GEOMETRY_PROBE=1` skips image capture while retaining the ownership/clearance/fallback checks.

Resident normal-world inventory is now 373 geometries / 65 materials / 216 hulls (includes hidden original geometry retained for comparison/fallback); fish and hidden counts remain 40 / 7. The lifecycle soak asserts those exact counts and unchanged 19 audio nodes / three buffers. The CPU stress suite separately runs original and authored structural worlds at 5, 15 and 30 minutes, plus render-schedule equivalence. Regenerate the exact GLB point inventory with `python3 tools/art/pass013/collision_inventory.py` after an ornament export. Run CPU tests and software-rendered browser jobs sequentially to avoid unrelated five-second unit-test timeouts under CPU contention.

The benchmark still replaces chromis and one coral, composing with the new normal hero layer. Its startup now makes five unique model requests; its comparison button only toggles the chromis/coral presentation. For production, build normally and point `validation/production.mjs` at `npm run preview`; it checks the three successful GLB responses as well as public controls/settings.

## Pass 014 reef environment

```bash
COZY_OUTPUT=/tmp/cozy014-reef node validation/reef-overhaul.mjs
```

The harness captures 16 identical-camera before/after pairs in one paused session: the shipped Pass 013 world, then the same view with the authored reef enabled. It records draws, triangles (with a per-family breakdown), GPU resource counts, CPU submission and synchronized software frame time per view. It then checks the four deduplicated GLB requests, WebGL errors, collider identity across toggles, disposal back to Pass 013 GPU counts, and that a missing reef library keeps the Pass 013 world (216 hulls) with the fallback notice. `COZY_VIEWS=wide,crevice` limits capture to selected views and skips the lifecycle checks.

The CPU stress suite adds Pass 014 production-composition scenarios (Pass 013 ornament hulls plus reef parts, 435 hulls) and asserts that fish never enter the 0.2-unit reef relief beside the glass. `validation/ReefAsset.ts` reads the exported GLB on the CPU for tests.

Pass 014 raises Playwright's per-action timeout in the software-rendered harnesses to 240 s (`COZY_ACTION_TIMEOUT`). SwiftShader compiles the reef's shader variants lazily on first present, which can take over a minute. Assertions are unchanged. `validation/integration.mjs` currently fails on `main` at the frogfish approach leg against the Pass 013 wreck hulls; see [Pass 014 validation](../docs/VALIDATION_V02_PASS_014.md).

## Pass 015 corals and creatures

```bash
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy015-before node validation/creature-overhaul.mjs  # previous candidate
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy015-after node validation/creature-overhaul.mjs   # this branch
```

The harness fixes moray extension, discovery pose time and clocks, then captures 16 coral, anemone, clownfish, moray, frogfish, seahorse and nudibranch close-ups for one build. It records draws, triangles, GPU resources and CPU submission time. Serve the previous candidate from a separate clean clone so both runs use identical cameras.

## Pass 016 reef fish

```bash
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy016-before node validation/fish-overhaul.mjs  # previous candidate
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy016-after node validation/fish-overhaul.mjs   # this branch
```

The harness freezes the simulation, frames the first fish of each species from its right side at a length-proportional distance, adds a whole-chromis-school view, records draws, triangles, GPU resources and submission time, and asserts that every authored school freezes exactly on pause.

## Pass 017 fish LOD and compression

`fish-overhaul.mjs` now records each view twice from the same camera, with the per-fish distance level and forced to full detail, plus the number of fish drawn at full detail. A spawn view down the channel shows the typical saving.

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 5175
COZY_URL=http://127.0.0.1:5175 COZY_OUTPUT=/tmp/cozy017-load node validation/load-budget.mjs
```

`load-budget.mjs` reports the bytes actually transferred (`request.sizes()`, split into models, decoder and scripts) and the time from navigation until the "Preparing aquarium details" status clears, over three fresh contexts. On localhost this time is dominated by decoding and SwiftShader shader preparation, not by download.

## Pass 018 KTX2 texture memory

`texture-memory.mjs` loads the benchmark entry on a dev server, waits until the aquarium is prepared, and sums resident texture bytes over every material in the scene (including shader uniforms). It counts each shared texture source once, takes compressed textures from their transcoded mip data and plain images as RGBA8 with a 4/3 mip chain. It also reports the WebGL compressed-format extensions and the GPU formats actually chosen, so an RGBA fallback is visible.

```bash
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy018-before node validation/texture-memory.mjs  # previous candidate
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy018-after node validation/texture-memory.mjs   # this branch
```

Set `COZY_GPU_ARGS` (space-separated Chromium flags) to replace the default SwiftShader flags on a machine with a real GPU. The byte totals are computed from texture data, not read from the driver.

## Pass 019 playtest fixes

`playtest-fixes.mjs` swims with real input (Enter, pointer lock, held W and mouse look) at the default speed and reports the peak swimming speed and distance. It counts GPU textures resident after preparation and again after the swim: any growth is data uploaded lazily on first sight, which showed as texture pop-in. It also captures the seahorse, clownfish family, filter corner and moray den from fixed cameras.

```bash
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy019-before node validation/playtest-fixes.mjs  # previous candidate
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy019-after node validation/playtest-fixes.mjs   # this branch
```

The fish-count assertions in the browser harnesses are now 41 (formerly 40), and the stress scenarios use the named `'home'` / `'dense'` populations.

## Pass 020 office

```bash
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy020-office node validation/office.mjs
```

`office.mjs` checks the following:

- **Start:** the start screen opens in the office.
- **Walking:** real Enter, pointer lock, held W and mouse look walk the player at a fixed eye height inside the room, with the depth readout hidden.
- **Switching:** pause → Enter the Water → swim → back to the office works, and repeated switches leave GPU geometry and texture counts unchanged.
- **Views:** fixed-camera captures of the room, the live miniature tank, the desk and window, and the shelf, with draw calls, triangles and CPU submit time.

## Pass 021 dive

```bash
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy021-dive node validation/dive.mjs
COZY_DIVE_ONLY=1 COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy021-seam node validation/dive.mjs  # quick seam check
```

`dive.mjs` enters the office with real input, stands in front of the tank, waits for the "Dive in" prompt and presses E. It then steps the animation loop by hand at 60 Hz, so the frames just before and just after the switch into the aquarium are captured: compare them for the seam. It also checks:

- swimming works after the dive;
- surfacing near the top returns to the office, standing;
- reduced motion uses a short fade;
- GPU memory returns to its earlier counts;
- surfacing compiles no new shader programs;
- there are no console errors.

```bash
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy021-interrupt node validation/dive-interrupt.mjs
```

`dive-interrupt.mjs` steps the loop by hand at 10 Hz and covers the paths a playthrough rarely hits:

- **Interruptions:** Escape before and after the switch, for both the dive and surfacing. While paused nothing advances. Choosing the destination then resumes and finishes; choosing the origin cancels back to exactly where E was pressed, with the camera on that pose.
- **A hidden tab mid-surfacing:** the transition, the aquarium clock and the reverse view all stop, and resume afterwards.
- **Five consecutive dive/surface cycles**, then reduced-motion surfacing (a short fade with no reverse view).
- **Resources:** GPU geometries, textures and compiled programs are unchanged at the end, with no console errors.

Run it on its own: alongside the unit suite, the container can run out of memory and kill the browser.

## Pass 022 polish and v0.3 release candidate

```bash
COZY_CYCLES=20 COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy022-soak node validation/dive-interrupt.mjs  # long alternating soak
```

- **`dive-interrupt.mjs` cycles:** each cycle now also swims and makes a pause-screen fade there and back. GPU resources must be unchanged after every cycle. Each cycle prints a progress line, so a run stopped by a time limit still leaves evidence. In software rendering, allow about 2.5 minutes per cycle.
- **Fades:** `office.mjs`, `dive.mjs` and `dive-interrupt.mjs` wait for the pause-screen fade to finish before checking the new space.
- **One browser at a time:** run the harnesses one after another. Several SwiftShader browsers at once, or a browser next to the unit suite, can exhaust the container's memory.
