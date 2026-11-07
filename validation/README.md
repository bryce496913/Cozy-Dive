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
