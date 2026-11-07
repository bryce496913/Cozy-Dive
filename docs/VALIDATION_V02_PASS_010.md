# v0.2 Pass 010 — Hidden Marine Discoveries

Executed November 7, 2026. Base `main` at `a789578` includes merged Pass 009 / PR #16. Branch `codex/v0.2-pass-010-hidden-marine-discoveries`. Private candidate **0.2.0-rc.5**. No automatic merge, tag or release is part of this pass.

## Scope and audit

The accepted Pass 009 baseline has 40 ordinary fish, one anemone, one sheltered moray, six ornaments, 65 marine clumps, eight meadows and 139 structural hulls. Its scene owns 168 geometries / 38 materials; JavaScript is 710.90 kB / 189.54 kB gzip. Its 257 routine tests / 24 files and four stress checks remain the regression foundation. [Historical validation](VALIDATION_V02_PASS_009.md) is preserved.

This pass adds **one seahorse, one frogfish and five nudibranchs** outside the unchanged fish registry. They have deterministic IDs, homes, surfaces/vegetation and safely reachable viewing positions. There is no marker, outline, notification, collection state, achievement, progress tracker or required sequence. The animals are small and naturally camouflaged; close inspection reveals their anatomy.

The seahorse has an upright segmented torso, curved neck, horse-shaped head/snout, tapered curled tail and independent small fins. It hovers and gently alternates grip/floating states beside an existing sea fan. The frogfish has a mottled irregular body, large mouth, limb-like webbed pectorals, a small caudal fin and lure. It stays still most of the time, with tiny posture/breathing changes and an eight-second walking interval per 112 motion seconds. Five nudibranch palettes share body and two appendage templates across three instance batches. Rhinophores, raised mantle and gill plumes/cerata distinguish them from generic worms.

Crawlers use actual static planar face patches, including a 0.285-unit envelope covering every heading, their tiny ellipse and optional ripple. Roots stay 0.006 units above the support plane; the flat foot remains attached. No global runtime raycast, pathfinding or vertex rebuilding occurs. The larger frogfish uses a conservative foot/path patch. Named ornament surface groups reference existing collider components; moving lids are excluded. Reachable camera volumes and three swept approach legs are validated at initialization. Technical home metadata is never displayed as player guidance.

The fixed 30 Hz discovery clock provides render interpolation and uses the existing optional-motion clock for smooth reduced-motion settling. Pause freezes state and poses; frame gaps do not replay missed behavior. Personal-space responses only read player state. No collider, player force, audio layer or setting is added. Fish, player, UI, controls, audio, world constants, vegetation generation and ornament geometry source are unchanged. The original anemone/moray remain in place.

See [hidden-life architecture](HIDDEN_LIFE.md), [anchored life](ANCHORED_LIFE.md), [habitat](HABITAT.md) and [repeatable validation](../validation/README.md).

## Automated validation

`npm run build`, `npm run typecheck`, and `npm run lint` pass. Production JavaScript is **730.86 kB / 195.90 kB gzip**, with the existing large-chunk advisory. `npm run test -- --maxWorkers=2` passes **270 tests / 25 files** (57.25 seconds). `npm run test:stress` passes **four tests** (66.06 seconds): five simulated minutes at 60 fish, fifteen and thirty at 40 fish, and frame-rate determinism.

The [raw stress report](benchmarks/v0.2-pass010/stress.json) includes the new layer through the existing anchored-life update path. All long scenarios finish with zero containment corrections, bounded scatter, existing activity coverage and the unchanged movement/safety assertions. Thirteen discovery regressions cover exact counts/IDs, unchanged fish spawning, deterministic homes, validated views/approach routes, vegetation association, finite anatomy, bounded posture/rare walking, gentle proximity response, real surface normals, slow continuous crawling, sampled posed/deformed vertices against solids and aquarium boundaries, pause/reduced motion, equivalent 30/60/120 FPS schedules and exact-once shared-resource cleanup.

Initial geometry checks caught a pectoral tube dipping into the perch; tapering the lower limb preserves foot contact. The browser rejected an early nudibranch shader because this Three.js version exposes four-component vertex colors; the shader now multiplies only RGB. No passing evidence is retained from that failed capture. Render review also prompted clearer frogfish mottling, webbed pectorals and a stubby caudal fin, while preserving the habitat/behavior scope.

An interim full run passed 269 tests but exceeded the unchanged five-second timeout in a pre-existing two-aquarium collider test. The new construction search unnecessarily kept checking samples after a candidate was already rejected. It now exits rejected candidates early and precomputes footprint offsets, preserving every check for accepted homes. No existing assertion or timeout was relaxed.

## Browser evidence and profiling

[Discovery capture and CPU report](benchmarks/v0.2-pass010/discoveries.json) and [40/60-fish dense/recreation scenarios](benchmarks/v0.2-pass010/scenarios.json) pass with zero console errors or warnings. The scene owns **178 geometries / 42 materials**, compared with the baseline 168 / 38. There are still 40 ordinary fish and 139 hulls.

At an identical final camera and scene pose, toggling only the discovery layer changes **271 → 283 draw calls** and **254,218 → 275,744 triangles**: **12 added draws / 21,526 triangles** for all seven animals. Five nudibranchs use three instance batches. This controlled comparison measures submissions, not hardware frame latency. Batched CPU timings are retained in JSON; small values remain limited by timer quantization and JIT/cloud scheduling. No speedup or MacBook FPS claim is made.

The capture advances 120 active seconds at the same nudibranch camera, verifies displacement greater than 0.05 units, and retains the source plane. A scheduled frogfish walking fixture records alternating foot lift while its root remains on the perch. Paused clocks and all poses remain exactly equal; optional motion settles under reduced motion. Full disposal returns renderer geometry/texture counts to zero and closes audio. The general harness also verifies normal/dense 40/60-fish scenarios with zero corrections and two recreate/dispose cycles.

The retained 240 batches of 20 updates (4,800 updates total) measure the complete seven-animal update at mean **0.0039 ms**, p95 **0.0100 ms** and p99 **0.0150 ms** per update. These CPU diagnostics exclude GPU rendering.

Close and central-channel wide views for every animal:

| Creature            | Close                                                     | Wide                                                    |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Seahorse            | [close](screenshots/v0.2-pass010/seahorse-home-close.png) | [wide](screenshots/v0.2-pass010/seahorse-home-wide.png) |
| Frogfish            | [close](screenshots/v0.2-pass010/frogfish-close.png)      | [wide](screenshots/v0.2-pass010/frogfish-wide.png)      |
| Blue/orange cerata  | [close](screenshots/v0.2-pass010/nudibranch-1-close.png)  | [wide](screenshots/v0.2-pass010/nudibranch-1-wide.png)  |
| Yellow/purple dorid | [close](screenshots/v0.2-pass010/nudibranch-2-close.png)  | [wide](screenshots/v0.2-pass010/nudibranch-2-wide.png)  |
| Pale edged dorid    | [close](screenshots/v0.2-pass010/nudibranch-3-close.png)  | [wide](screenshots/v0.2-pass010/nudibranch-3-wide.png)  |
| Orange/white cerata | [close](screenshots/v0.2-pass010/nudibranch-4-close.png)  | [wide](screenshots/v0.2-pass010/nudibranch-4-wide.png)  |
| Violet dorid        | [close](screenshots/v0.2-pass010/nudibranch-5-close.png)  | [wide](screenshots/v0.2-pass010/nudibranch-5-wide.png)  |

[Full aquarium](screenshots/v0.2-pass010/overview.png), [two-minute crawling interval](screenshots/v0.2-pass010/nudibranch-1-after-two-minutes.png), [rare frogfish walking pose](screenshots/v0.2-pass010/frogfish-rare-walk.png). The validated homes include a sea fan, the wreck floor/roof, statue and several eligible stone-arch faces. Hard-structure occlusion is only one concealment measure; the seahorse is partly screened by soft vegetation, while scale and camouflage make other animals inconspicuous in wide views.
These are fixed camera fixtures, not player navigation recordings. The full-scene camera is outside the front glass; HUD depth continues to describe the unchanged player. Native controls/audio receive separate lifecycle checks.

Cloud rendering uses Chromium/SwiftShader. CPU timings and draw counts do not establish MacBook Air FPS, subjective visual comfort or listening quality. No hardware rendering speedup is claimed.

## Native controls and audio lifecycle

The [native browser lifecycle report](benchmarks/v0.2-pass010/lifecycle.json) passes pointer lock, camera-directed ascent/descent, ignored Space/Shift, input clearing, shortcut modifiers, settings migration/persistence, silent preview, gesture-started Web Audio, mute/unmute, sparse voice cleanup, pause/resume, controlled visibility, unsupported-audio fallback and context disposal. No console errors are observed.

Its accelerated thirty-minute soak retains 40 fish, 19 audio nodes, three buffers and three loops, with zero containment corrections over 54,000 steps. The lifecycle settings exercise reduced motion; the separate extended ecosystem run also exercises normal optional motion and toggles. Post-GC heap samples are retained as observations, not proof against every possible leak. Visibility uses controlled document-hidden state, and native transient voices are released according to accelerated simulation time. This is functional validation, not perceptual listening or hardware performance acceptance.

## Manual macOS acceptance — pending

Run the production build with the [validation procedure](../validation/README.md). These human acceptance items remain unchecked.

- [ ] Seahorse looks like a real seahorse.
- [ ] Seahorse is hidden but discoverable.
- [ ] Seahorse has gentle natural movement.
- [ ] Frogfish is recognizable when found.
- [ ] Frogfish camouflage feels believable.
- [ ] Frogfish remains mostly still.
- [ ] Nudibranchs look like small marine invertebrates.
- [ ] Nudibranchs crawl naturally along surfaces.
- [ ] Hidden creatures do not float or clip.
- [ ] No markers or game-like discovery prompts.
- [ ] Existing reef fish remain natural.
- [ ] Performance remains smooth.
- [ ] Aquarium atmosphere remains relaxing.

The anatomy is stylized; tail grip and crawling patches are bounded visual approximations, not physical attachment or ecological simulation. Hard-structure visibility metadata cannot quantify concealment by soft vegetation, attention or camouflage; wide/close render review and manual acceptance complement those checks.

Await manual macOS acceptance before Pass 011. No combat, feeding, prey capture, damage or collection system is introduced.
