# v0.2 Pass 001 — Fish foundation validation

Validated November 5, 2026. Work starts from `ffd3208`, the merge of v0.1 Pass 003. Existing player physics, controls, settings, and rock-collision semantics are unchanged; only frame timing/active state are passed through the existing environment-render lifecycle.

## Project checks

| Check               | Result                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run test`      | **87 passed**, six files, none skipped; all 68 existing tests remain passing |
| `npm run typecheck` | Passed                                                                       |
| `npm run lint`      | Passed, including Prettier                                                   |
| `npm run build`     | Passed; 611.73 KB JavaScript / 157.66 KB gzip, 6.04 KB CSS / 2.13 KB gzip    |
| `git diff --check`  | Passed                                                                       |

The existing Three.js chunk advisory remains; no dependency, remote runtime asset, extra render pass, or framework was added. The browser harnesses and performance probes live outside the repository; no production debug API or test dependency is shipped.

## Automated coverage

- Three distinct species with valid population/movement settings: 8 neon tetras, 6 harlequin rasboras, 2 honey gouramis.
- Reproducible seeded spawning, individual size/speed/turn/phase variation, preferred depth placement, conservative body separation, diver-start exclusion, aquarium limits, and actual rock-hull clearance. Temporary 32-fish population and invalid/impossible population handling.
- Bounded scalar speed acceleration, capped angular turns, speed limits, nose-first displacement, finite numerical state, persistent/asynchronous targets, invalid frame deltas, and bounded catch-up.
- Identical fixed simulation states after sixty seconds at 30, 60, and 120 FPS rendering conditions.
- Head-on obstacle redirection, both sides of all three boundary axes, a true glass corner, and an emergency near-wall candidate safeguard.
- Ten minutes of the real aquarium population: valid bodies, independent movement, and **zero final-guard corrections**.
- Fractional-step interpolation, exact paused state/pose/tail freeze, zero-time resume, small next-frame displacement, reduced-motion banking, and continuous fin animation through phase wraps.
- Shared instance geometry/materials, idempotent disposal, and no update after disposal. Existing swimming, buoyancy, rock sliding, bounds, and settings tests remain passing.

The corner test caught target samples being clamped onto glass edges. Target selection now rejects outward samples, validates persistent targets, and keeps a safe fallback. The fin-phase test covers periodic pectoral motion without a discontinuity when the tail phase wraps.

## Browser functionality actually exercised

System Chromium with Playwright, a 1200 × 800 viewport, and SwiftShader software WebGL. Test-only response interception exposes the existing app instance for assertions. Real pointer-lock, mouse, keyboard, settings, Escape/resume, and refresh events drive the application. Position placement beside generated rocks expedites the contact probes; it does not replace long deterministic avoidance/collision tests.

The completed gameplay run passed:

- 16 rendered fish, with exact 8/6/2 counts; initial fish/animation frozen until explicit entry.
- Independent movement and tail animation once entering the water.
- Actual W swimming, momentum/coasting, mouse-look, and Space ascent while fish are present.
- Player navigation against a real generated rock while fish continue updating, preserving the existing player collision result.
- A fish steers around actual generated rock data; all checked fish remain outside expanded rock hulls.
- Escape freezes simulation state and visual poses exactly; resume has no accumulated catch-up burst.
- Reduced motion removes bank while tails remain animated.
- Swimming preset/reduced-motion preferences persist through refresh.
- A temporary 32-fish scenario renders/updates without changing shipping counts or files.
- Fish resource disposal and complete application cleanup; no captured console errors or uncaught page exceptions in the completed run.

An early development preview triggered Vite's dependency-optimization refresh while adding the bundled geometry utility; the stable rerun had no errors. The initial coasting harness used a fixed wall-clock delay that was insufficient under software rendering; it was corrected to wait for actual simulation progress. Neither failed attempt is counted as a successful gameplay run.

## Rendering, models, and screenshots

All three close-ups and the population view were inspected visually. Bodies are volumetric smooth lofts, with species proportions/profiles, tapered head/tail regions, curved skin markings, separate caudal/dorsal/lower/pectoral fins, small eyes, and mouth detail. The gourami's rounded silhouette and fins differ from the fork-tailed species. Close-ups use a test camera beside real fish in the existing aquarium; no stand-in image or special runtime gallery is used.

- [Population view](screenshots/v0.2-pass001/aquarium.png)
- [Neon tetra](screenshots/v0.2-pass001/neon-tetra.png)
- [Harlequin rasbora](screenshots/v0.2-pass001/harlequin-rasbora.png)
- [Honey gourami](screenshots/v0.2-pass001/honey-gourami.png)

Transparent thin fins use a single rendering pass; static eye/mouth details share the front body draw. There are **17 shared fish geometry buffers and 7 materials** across all three species. A complete visible population adds at most 112 draws for 16 fish (6 per rasbora/gourami, 8 per tetra including its emissive stripe surfaces); the 32-fish stress case adds at most 224. No buffer or material is duplicated per individual.

A final comparative run used the same fixed overview camera and paused poses, five warm-up frames and twenty measured RAF intervals per case. Hiding the fish root supplied the existing-scenery baseline. Values below are observations of this software environment, not hardware-GPU performance claims.

| Configuration        | Draw calls | Triangles | Median RAF interval | p95 RAF interval |
| -------------------- | ---------: | --------: | ------------------: | ---------------: |
| Scenery, fish hidden |        270 |    20,740 |            799.9 ms |       2,633.1 ms |
| 16 fish              |        382 |    88,314 |          1,016.6 ms |       1,816.6 ms |
| 32 fish, temporary   |        494 |   155,888 |            533.4 ms |         850.0 ms |

These very slow, non-monotonic timings demonstrate that this shared SwiftShader environment is unsuitable for establishing a 60 FPS hardware target or a reliable relative GPU benchmark. **60 FPS was not demonstrated here**, including for the scenery baseline. Draw counts/triangle counts/resource ownership remain useful functional measurements. macOS/hardware-GPU performance and sustained comfort still require manual validation.

GPU geometry residency was **221** in both fish cases. Disposing the 16-fish system reduced it to **204**, releasing exactly 17 fish buffers; replacing it with 32 fish returned to 221. All **24** final owned resources (17 geometries + 7 materials) emitted one disposal event. The stress population still referenced only 17 unique fish geometries and 7 materials. Final rendered animation and application cleanup also passed after the draw-call optimization.

## Simulation CPU measurements

The browser timed 2,000 fixed 30 Hz population steps after 1,000 warm-up steps, using the real aquarium habitat. This isolates pure movement; geometry construction, presentation transforms, WebGL, and rendering are excluded. The movement code was unchanged by subsequent presentation-only draw-call optimization.

| Population | Mean step | p95 step | Maximum observed step | Final containment corrections |
| ---------- | --------: | -------: | --------------------: | ----------------------------: |
| 16         |  0.102 ms | 0.200 ms |               37.4 ms |                             0 |
| 32         |  0.148 ms | 0.200 ms |               33.8 ms |                             0 |

Rare large samples remain visible rather than being omitted; timing resolution, scheduling, and GC were not isolated, so those spikes cannot be attributed solely to steering. Normal simulation and visual updates allocate no per-frame vectors or model resources; target changes reuse each fish's stored vector. No heap-allocation profiler or hardware GPU/battery measurement was run.

## Manual macOS acceptance still required

Use the checklist in `PR_DESCRIPTION.md`: recognize each species from several angles, assess swimming/fin/turn believability and crowding over several minutes, inspect corners and rocky banks, pause/resume and focus changes, compare reduced motion, and verify unchanged diver behavior. Repeat in macOS browsers on a hardware GPU before making frame-rate or cross-browser claims. Safari, Firefox, and Edge were not run here.

Runtime fish separation/schooling, player reactions, feeding, and global navigation are deliberately deferred. Fish can overlap after spawning. Body-sphere/convex approximations are conservative in narrow gaps; externally forced emergency contacts can briefly hold a fish while it turns. Static environment coordinates and resource ownership assumptions are detailed in `FISH.md`.
