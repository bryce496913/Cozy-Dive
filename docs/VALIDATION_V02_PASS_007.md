# v0.2 Pass 007 — Tropical Marine Aquarium Conversion

Executed November 7, 2026 on branch `codex/v0.2-pass-007-tropical-conversion`, based on `main` at `33bff88` (merged Pass 006). Candidate package: **0.2.0-rc.2**. No merge, tag or release is part of this pass.

## Audit and scope

The accepted Pass 006 baseline contained 40 freshwater fish, five plant families, nine ornaments, 34 rock hulls and 39 hardscape hulls. Its scene owned 93 geometries / 31 materials (fish 42 / 17), and its production JavaScript was 674.76 kB / 177.85 kB gzip. The pre-change routine suite passed 220 tests in 21 files. Historical measurements remain in [Pass 006 validation](VALIDATION_V02_PASS_006.md).

The active biological identity is now marine: **20 blue-green chromis, 6 pajama cardinalfish, 6 firefish gobies, 4 yellow assessors and 2 royal grammas**, exactly **38 fish**. Five species-specific articulated models share 25 geometries and 10 materials. Freshwater calibration data survives only in test fixtures; no old species registry or marking/model branches ship for compatibility. Chromis retain the accepted 20-fish schooling/burst tuning. The other species have deliberate species-specific motion and shelter preferences; safe local homes guide shy retreats without teleporting or bypassing avoidance.

Six marine habitat forms replace the old leaves: turtle grass, Caulerpa, Halimeda, red macroalgae, leather soft coral and sea fans. Seagrass is a marine flowering plant, macroalgae is algae, and corals are animals. Sixty-five clumps use 18 shared templates; eight meadows contain 1,258 grass blades. Six living stony colonies attach to exact rock surfaces; three separate aquarium ornaments remain. Soft coral/fans follow gentle current with fixed roots. Placement checks actual transformed vertices against convex solids across the conservative sway envelope, including tilted coral supports.

Structural rock and reef skeleton collision remains authoritative: **73 hulls**, unchanged in count. Seven deterministic marine interest categories support bounded, safe target selection and optional homes. Fine coral tissue stays passable. The central channel remains open. Player, control, buoyancy, audio and application source are unchanged; procedural emitter locations follow the reef formations automatically. No new audio layer or mix retune was introduced.

## Automated and browser evidence

`npm run build`, `npm run typecheck`, and `npm run lint` pass. `npm run test -- --maxWorkers=2` passes **226 tests / 22 files** (41.40 seconds). An earlier run concurrent with lint exceeded the existing five-second timeout in the doubled-density geometry test; the isolated rerun passes without changing assertions or timeouts. JavaScript is **682.17 kB / 180.28 kB gzip**; Vite retains its existing large-chunk advisory. Regression coverage includes exact populations, five model proportions and articulation, outward-facing cardinal spots, chromis schooling/bursts, shy retreat/recovery, deterministic movement, reachable habitat interests, attached geometry and current envelopes, collision, instance bounds, pause/reduced motion and disposal. Historical steering fixtures preserve earlier numerical regression coverage without importing those fish into production.

[Browser report](benchmarks/v0.2-pass007/browser.json) uses Chromium/SwiftShader, 960×640, DPR 1. Its ten fixed views are camera fixtures, not player navigation recordings. Four render samples per view and three rAF intervals are diagnostic snapshots; they do **not** establish hardware FPS or stable tail percentiles. The overview submits **145 draws / 217,396 triangles**; geometry differs from the historical aquarium, so this is not a controlled rendering speed comparison. Owned scene resources are **79 geometries / 25 materials**, down from 93 / 31.

600 browser CPU samples per scenario: default 38-fish fixed-step mean **0.209 ms**, p95 **0.400 ms**; temporary 60-fish mean **0.401 ms**, p95 **0.800 ms**. Dense diver scenarios also complete with zero corrections. Culling at the same 60-fish pose reduces submissions from 153 to 147. All scenarios retain the 38-fish production roster after temporary stress disposal. Browser errors/warnings: **zero**. Main disposal and two recreate/dispose cycles return renderer geometry/texture counts to zero and close audio contexts. Software rAF means range hundreds of milliseconds and must not be read as MacBook Air performance.

The [native Web Audio/control lifecycle report](benchmarks/v0.2-pass007/lifecycle.json) passes: camera-directed ascent/descent, input clearing, shortcut modifiers, silent preview, settings migration/persistence, gesture-started audio, mute/unmute, pause/resume, controlled visibility, unsupported-audio fallback and context disposal. Its accelerated 30-minute browser ecosystem run retains 38 fish, 19 audio nodes, three buffers and three loops, with zero fish corrections across 54,000 steps. Post-GC heap samples rise from 14.01 MB to 14.50 MB; this bounded run is evidence, not a proof against every leak. Functional Web Audio checks do not establish subjective listening quality.

`npm run test:stress` passes **4 tests** (61.53 seconds): five minutes at 60 fish, fifteen and thirty minutes at 38 fish, plus identical 30/60/120 FPS simulation schedules. The [raw stress report](benchmarks/v0.2-pass007/stress.json) records zero containment corrections, minimum 30-second travel of 2.93–3.21 units, all five activity states and bounded scatter. These are accelerated simulations, not real-time hardware benchmarks.

## Visual evidence

- [Aquarium overview](screenshots/v0.2-pass007/overview.png), [chromis school](screenshots/v0.2-pass007/chromis-school.png).
- [Cardinalfish](screenshots/v0.2-pass007/pajama-cardinalfish.png), [firefish](screenshots/v0.2-pass007/firefish-goby.png), [assessor](screenshots/v0.2-pass007/yellow-assessor.png), [gramma](screenshots/v0.2-pass007/royal-gramma.png).
- [Reef and solid collision areas](screenshots/v0.2-pass007/reef.png), [seagrass](screenshots/v0.2-pass007/seagrass.png), [floor/channel](screenshots/v0.2-pass007/floor.png).
- [Attached soft coral](screenshots/v0.2-pass007/soft-coral.png) and [same view after five seconds of current](screenshots/v0.2-pass007/soft-coral-motion.png).
- [Preview](screenshots/v0.2-pass007/preview.png), [pause](screenshots/v0.2-pass007/pause.png), [settings](screenshots/v0.2-pass007/settings.png).

The marine forms remain stylized procedural geometry. Static screenshots cannot prove motion comfort, collision feel or subjective underwater audio quality. Those need the manual review below.

## Manual macOS acceptance — pending

Run the production build locally using the [validation procedure](../validation/README.md). These items are deliberately unchecked; cloud/software rendering cannot certify MacBook Air comfort.

- [ ] The aquarium clearly looks tropical and marine.
- [ ] No original freshwater species remain.
- [ ] Each new fish species looks distinctive.
- [ ] Chromis form one lively 20-fish school.
- [ ] Fish behaviors match their respective habitat preferences.
- [ ] Seagrass and macroalgae look appropriate.
- [ ] Corals are recognizable and organically placed.
- [ ] Plant and coral movement remains gentle.
- [ ] Central swimming channel remains open.
- [ ] Fish and player collision remains reliable.
- [ ] Audio and swimming remain unchanged.
- [ ] Performance stays smooth on MacBook Air.

Await manual testing before Pass 008. Two anemone-associated clownfish remain reserved for Pass 009; no future location-bound creature is implemented here.
