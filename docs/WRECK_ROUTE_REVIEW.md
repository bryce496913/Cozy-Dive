# Shipwreck route and loading review

Base: `main` at `bca42b912af7a35e4adcac79705eca79dee5a872` (2026-11-19).

## Confirmed defects

- A failed `SoloCreature` remained registered in `WreckLife` until the entire scene was disposed. Dispose and remove that wrapper as soon as readiness resolves false.
- `WreckLife.ready` used `some(Boolean)`, so one successful group masked another group's failure. Require all groups to succeed; `ShipwreckScene` remains enterable, with `WorldPreparation` correctly reporting `partial`.
- Fail-fast `Promise.all` in a mixed-success creature group allowed wildlife readiness to settle before healthy companions finished loading. Wait for every companion before shader warm-up. Keep successfully loaded animals.

Five focused ownership/readiness tests cover these cases, successful loading, disposal while loading, and partial fish-lease acquisition. Before the fixes, the failed-wrapper test and delayed-companion test failed. No geometry, models, materials, populations, movement, collision dimensions, lighting or discovery rules changed.

## Browser method

`validation/wreck-route.mjs` instruments the development entry point through a Playwright response hook; it adds no application debug interface. It enters the office through the normal UI, walks to the aquarium, presses E, swims through the crevice and outer tunnel into kelp, uses the sinkhole's open side under its ledge, explores deck/hold/bridge, reverses the passages, swims beyond the release radius, and repeats three times before surfacing to the office.

Movement uses real W/S/E/Escape events and the production integrator/colliders. Steering changes camera angles. Positions, velocities, readiness and world IDs are never assigned. The bridge route goes around the binnacle; the sinkhole route goes around the overhanging ledge. Stopping under the ledge or swimming straight into the binnacle is an expected collision, not a reason to change the art.

Chromium uses SwiftShader, CSS viewport 640×600, DPR 0.25 (160×150 render buffer). Simulation advances in 100 ms steps. Ordinary travel presents one render per 100 simulation steps; loading/warm-up renders are never suppressed. Twenty consecutive rendered frames at each first-cycle wreck checkpoint provide separate timing samples. This is accelerated behavioral validation and a limited software-renderer profile, not a real-time playthrough, hardware FPS measurement or detailed visual-art acceptance test. GPU counters are counts, not VRAM byte measurements. Raw JSON and screenshots go to `COZY_OUTPUT`.

`validation/wreck-failure.mjs` separately builds the actual shipwreck scene and returns HTTP 503 for the barracuda GLB. It checks partial-but-enterable scene readiness, immediate failed-wrapper disposal, surviving wildlife, a real draw, lease release, and GPU resource cleanup after disposing its independent asset cache. The route harness additionally injects one individual acquisition failure among otherwise healthy barracuda.

## Reproduce

Playwright is external validation tooling, not an application dependency. Commands in this workspace:

```bash
npm run build
npm run typecheck
npm run lint
npm run test -- --maxWorkers=1
npx vitest run tests/wreck-loading.test.ts --maxWorkers=1
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

With the servers running, in another terminal:

```bash
export COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs
export COZY_CHROMIUM=/usr/bin/chromium
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy-wreck-complete node validation/wreck-route.mjs
COZY_URL=http://127.0.0.1:5174 COZY_OUTPUT=/tmp/cozy-wreck-failure node validation/wreck-failure.mjs
COZY_URL=http://127.0.0.1:4173 COZY_DPR=0.5 COZY_OUTPUT=/tmp/cozy-wreck-production node validation/production.mjs
```

`production.mjs` exercises the built bundle using public DOM/input only. The full route's internal resource and collision instrumentation uses the development server. Do not conflate those two checks.

## Results

The complete route passed: three entries/exits, 18 passage crossings, return to the office, and zero unexpected console/page errors. Crossing opacity was 0.93–0.94, with a maximum before/after change of 0.01. All normal wreck visits reported `ready`.

The solid-deck probe stopped at ship-local y=7.030004 (deck top 6.75 plus player radius 0.28), while the hatch and bridge door remained traversable. Static collider overlap checks ran throughout movement. The torch reached intensity 9 in both interiors and 0 outside; player position and grouper patrol froze on pause and resumed. The journal recorded the wreck, hold, bridge and grouper. All 210 school fish, three posed groups and 19 solo animals loaded; wrasse/turtle positions and actual creature stroke influences changed.

### Resource release

| Checkpoint         | Geometries | Textures | Programs | Fish leases | Reef leases |
| ------------------ | ---------: | -------: | -------: | ----------: | ----------: |
| Initial tank       |        362 |      113 |      108 |          44 |           2 |
| After round trip 1 |        448 |      149 |      108 |          44 |           2 |
| After round trip 2 |        448 |      149 |      108 |          44 |           2 |
| After round trip 3 |        448 |      149 |      108 |          44 |           2 |

The outer, kelp and wreck scenes were absent at every release checkpoint. Decoded school/reef assets remain in the shared cache after first use; the counts plateau, rather than growing per visit. Persistent home-tank leases remain owned by the tank.

The single-instance fault disposed one failed wrapper immediately, retained 18 healthy solo animals, and returned fish leases from 297 to the original 44. The independent real HTTP 503 test made one failed network request, disposed all 16 failed barracuda wrappers immediately, retained 210 school fish / three posed groups / three healthy solo animals, and returned all 238 leases to zero. The scene remained `isReady=true`, with preparation `partial`. After its asset cache was disposed there were zero geometries, zero programs and one texture: Three.js r187's renderer-wide 16×16 `DFG_LUT`, identified by tracing texture ownership. This lookup is an engine cache, not a scene-owned texture. There were 19 expected HTTP/loading diagnostics and no unexpected errors.

### Rendering and loading observations

Twenty consecutive presented frames were sampled per first-cycle wreck space. Frame-interval statistics omit the first interval, which spans the preceding automation step (19 intervals per row). These are slow **SwiftShader wall-clock observations**, not laptop/GPU FPS estimates. Tick submission time alone excludes much of the software GPU work. Draw counters come from `renderer.info` for the last scene render; office portal/offscreen passes are not summed into a whole-frame counter.

| Space  | Draw calls |           Triangles | Wall interval p50 / p95 / max (ms) | Maximum tick submission (ms) |
| ------ | ---------: | ------------------: | ---------------------------------- | ---------------------------: |
| Deck   |         74 | 1,055,628–1,066,552 | 1740.1 / 2415.4 / 3704.8           |                         57.0 |
| Hold   |         63 | 1,171,776–1,183,082 | 1234.5 / 1572.4 / 1932.9           |                         57.0 |
| Bridge |         43 |             871,974 | 589.2 / 710.5 / 1187.7             |                         53.5 |

Across the route's sampled presentations, observed maximum calls/triangles were aquarium 158 / 951,828; outer reef 141 / 1,926,077; kelp 72 / 2,387,510; wreck 82 / 1,300,936. These are sampled views, not an exhaustive worst-case bound.

Startup through tank/office/editor readiness took 33,587 ms. On the first visit, remaining readiness waits were outer tunnel 22 ms, reef 5,019 ms, kelp 35 ms and wreck 26 ms. These are residual waits after approaching, not total scene-load times. First-visit construction totals/longest pieces were outer 251.1/251.1 ms, kelp 413.4/258.1 ms, and wreck 250.8/248.7 ms. The independent partial-scene load took 10,643.1 ms. The maximum observed scheduler gap was 12,192.4 ms across the entire harness; that includes preparation and automation, so it is not a steady gameplay frame-time claim. Later route cycles overlapped the production functional smoke check and are not used for the consecutive-frame profile.

The software renderer is far too slow to certify hardware performance. No art, visibility, population or lighting reductions were made on the basis of these measurements.

### Commands and outcomes

- `npm run build`: passed; Vite built in 1.86 s. The existing >500 kB chunk advisory remains.
- `npm run typecheck`: passed.
- `npm run lint`: passed; final formatting verification covers the saved results too.
- `npx vitest run tests/wreck-loading.test.ts --maxWorkers=1`: 5 passed.
- `npm run test -- --maxWorkers=1`: 86 files, 781 tests passed in 164.36 s without competing browsers.
- Route command above: passed, all three round trips and 18 crossings.
- HTTP failure command above: passed, expected partial readiness and cleanup.
- Production command above: passed; 10 GLB responses were HTTP 200, entry/movement/pause worked, and volume persisted after reload. No browser errors or warnings.

Earlier baseline `npm run test` passed 776 tests; the first four added tests brought that to 780. A concurrent post-fix attempt hit the unchanged hidden-discovery test's 5-second timeout and was stopped; the final full suite is run without competing browsers. Exploratory paths that hit the binnacle/ledge were corrected in the harness. An environment restart interrupted another run during its second return; the full three-cycle run was restarted, and checkpoints now save durable progress. These incomplete attempts are not counted as successful three-cycle runs.

Compact evidence: [route measurements](benchmarks/wreck-review/route.json), [HTTP failure](benchmarks/wreck-review/failure.json), [production smoke](benchmarks/wreck-review/production.json). Generate the route summary from raw JSON with:

```bash
node validation/wreck-report.mjs /tmp/cozy-wreck-complete/report.json > docs/benchmarks/wreck-review/route.json
```

Low-resolution checkpoint captures (functional evidence, not a detailed art-quality audit): [deck](screenshots/wreck-review/deck.png), [hold](screenshots/wreck-review/hold.png), [bridge](screenshots/wreck-review/bridge.png).
