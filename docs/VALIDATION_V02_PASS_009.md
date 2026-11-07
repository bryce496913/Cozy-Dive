# v0.2 Pass 009 — Anchored Marine Life

Executed November 7, 2026. Base `main` at `5d593e7` includes merged Pass 007 and Pass 008 / PR #15. Branch: `codex/v0.2-pass-009-anchored-marine-life`. Private candidate **0.2.0-rc.4**. No automatic merge, tag or release is part of this pass.

## Scope and baseline

The accepted Pass 008 baseline contains 38 ordinary fish, six home-aquarium ornaments, 65 marine clumps, eight meadows, 139 structural hulls and 159 owned scene geometries / 33 materials. Its JavaScript was 693.86 kB / 184.24 kB gzip, with 242 routine tests in 23 files. [Historical validation](VALIDATION_V02_PASS_008.md) remains unchanged.

This pass adds one reef-attached anemone, exactly two host-associated ocellaris clownfish and one sheltered snowflake-inspired moray. The ordinary population is now **40**, preserving the original 38 species counts and spawn IDs/random streams; the moray is separate. Six fish templates use 30 geometries / 12 materials. The temporary 60-fish scenario raises chromis to 40 and preserves the other groups.

Clownfish reuse the existing fish entity, fixed-step locomotion, instance rendering, separation, diver awareness and solid guard. A small host-intention component supplies local hover/excursion/return targets, pair awareness and local refuge from a diver. Outward speed tapers before reaching the body-inclusive home radius; there is no teleport or second position integrator. Dedicated broad/rounded anatomy, orange skin, three white bands with dark borders and rounded dark-rimmed fins distinguish the pair.

The anemone attaches to a validated real upper reef face, aligns to its normal and avoids existing flora/solids. One merged mesh has a soft column/crown and 72 varied tentacles; phase-separated GPU bending grows toward the tips while the attachment remains fixed. Its host, soft envelope, open water and safe escape directions are exposed as metadata.

The moray references `log-interior` through `moray-shelter`. Its full tucked/unfolded body and head envelope validates against real hulls. Seeded hidden/peek/rest/emerge/retreat states use a fixed local clock, GPU body deformation, tangent-frame normals and a tiny head/jaw rig. Procedural pale/dark mottling preserves dimensional eyes/mouth. A nearby active diver causes gradual retreat, rather than an oversized invisible hiding-site collider. The log remains physically open. There are no attacks, damage, predation or pursuit.

Player movement, buoyancy, collision solver, vegetation, ornament geometry/animation, settings and audio source are unchanged. The soft animals add no structural hulls: **139 remain**. Existing resources still have explicit idempotent ownership. See [anchored life architecture](ANCHORED_LIFE.md), [fish](FISH.md) and [habitat](HABITAT.md).

## Automated validation

- `npm run build`: passes; JavaScript **710.90 kB / 189.54 kB gzip**, with the existing Vite large-chunk advisory.
- `npm run typecheck`: passes.
- `npm run lint`: passes (ESLint and Prettier).
- `npm run test -- --maxWorkers=2`: **257 tests / 24 files pass**, 53.96 seconds.
- `npm run test:stress`: **four tests pass**, 49.99 seconds. Five simulated minutes at 60 fish, fifteen and thirty at 40 fish, plus 30/60/120 FPS determinism.

The [raw stress report](benchmarks/v0.2-pass009/stress.json) updates the real ornament and anchored-creature systems alongside fish/player/plant/audio scheduling. Every long scenario has zero fish containment corrections, bounded scatter and all existing activity states. Existing travel/safety assertions remain unchanged, including the host pair. These are accelerated simulations, not real-time laptop performance claims.

Fourteen anchored-life regressions cover original IDs/counts, explicit host association and missing-host errors, real attachment planes, current envelopes/phases, local home bounds, pair spacing, diver retreat/return, smooth recovery from a displaced start, distinctive bands/anatomy, sampled deformed eel vertices against solids, outward winding/normals, all five calm states, body proximity response, pause, reduced motion, actual rig equivalence across render schedules and exact-once disposal. The existing regression suite remains in place. Population expectations and validation harnesses change only for the intended 40/60 configurations and new active creature updates.

Rendered review prompted warmer clownfish colors, thin fin rims, more organic tentacle spread and crisp procedural moray mottling. The body winding correction is protected by a dedicated normal-agreement test. These changes introduce no runtime assets or new dependencies.

## Browser evidence and profiling

Reports and screenshots below use Chromium/SwiftShader software rendering at fixed viewport/DPR. Camera fixtures place the camera directly; they are not player navigation recordings, and HUD depth still reflects the unchanged player. The full-scene camera is outside the front glass. Cloud timing does not establish hardware FPS, macOS comfort or subjective listening quality.

[Creature capture and batched CPU report](benchmarks/v0.2-pass009/creatures.json), [40/60-fish CPU/dense/recreation scenarios](benchmarks/v0.2-pass009/scenarios.json), and [native control/audio lifecycle](benchmarks/v0.2-pass009/lifecycle.json) all pass with no console errors. The retained capture also records zero warnings.

The scene owns **168 geometries / 38 materials**, up from 159 / 33. The anemone uses **36,072 static vertices / one draw**; the eel body/frill uses **3,960 vertices**, plus its small head/jaw meshes. Their deformation runs on the GPU. The fixed full-scene view submits **271 draws / 254,218 triangles**. This is added animal geometry, not a rendering speedup claim; fish poses and culling also affect view totals.

240 timing batches of 20 updates (4,800 updates per scenario) give the following diagnostic milliseconds per update:

| Scenario                                              |   Mean |    p95 |    p99 |
| ----------------------------------------------------- | -----: | -----: | -----: |
| Anemone + moray CPU update                            | 0.0011 | 0.0050 | 0.0100 |
| Isolated two-clownfish locomotion in the real habitat | 0.0234 | 0.0450 | 0.1100 |

The tentacle GPU work is not included in those CPU timings. Timer quantization, JIT warmup and cloud scheduling limit precision. In the separate 600-sample whole-ecosystem measurements, 40 fish have mean/median/p95 **0.747/0.300/1.600 ms**, while 60 fish have **0.564/0.500/1.200 ms**. The non-monotonic means illustrate runner/JIT variance, not a claim that a larger population is faster. Ordinary and dense-diver scenarios both have zero corrections; default population is restored after temporary stress disposal. Two recreation/disposal cycles and final disposal return renderer geometry/texture counts to zero and close audio contexts.

The host pair is observed at 0.912 and 0.881 units from its center, with distinct sizes and zero corrections. A proximity fixture reduces moray extension from **0.760 to 0.253 in one second**, enters `retreating` and records one retreat. Pause checks retain exactly equal creature clocks/extension. The [native lifecycle report](benchmarks/v0.2-pass009/lifecycle.json) passes actual pointer lock, camera-directed depth, input clearing, shortcut modifiers, settings migration/persistence, mute/resume/visibility handlers, native Web Audio, unsupported-audio fallback and disposal. Its accelerated thirty-minute soak keeps 40 fish, 19 audio nodes, three buffers and three loops, with zero corrections over 54,000 steps. Post-GC heap samples rise from 15.43 MB to 16.06 MB and level toward the end; this is bounded evidence, not a proof against every leak. Visibility uses controlled hidden state, and transient voices follow accelerated simulation time. Functional audio checks do not establish subjective listening quality.

- [Full aquarium](screenshots/v0.2-pass009/overview.png), [anemone and pair](screenshots/v0.2-pass009/host-pair.png), [clownfish closeup](screenshots/v0.2-pass009/clownfish.png).
- [Anemone current pose](screenshots/v0.2-pass009/anemone.png), [same view five active seconds later](screenshots/v0.2-pass009/anemone-motion.png).
- Moray [hidden](screenshots/v0.2-pass009/eel-hidden.png), [peeking](screenshots/v0.2-pass009/eel-peeking.png), [resting](screenshots/v0.2-pass009/eel-resting.png), [partial emergence](screenshots/v0.2-pass009/eel-emerging.png), [retreat](screenshots/v0.2-pass009/eel-retreating.png).
- [Moray head and mottling](screenshots/v0.2-pass009/eel-head.png), [response to nearby diver fixture](screenshots/v0.2-pass009/eel-diver-retreat.png).
  The creature capture exercises actual shaders, actual timed eel states, a diver-proximity fixture, paused-state equality and renderer/audio disposal. Isolated CPU diagnostics batch 20 updates per timing sample to reduce timer quantization. They measure the existing locomotion with a temporary two-clownfish subset and the anemone/moray controller updates separately; they do not add fish to the production scene.

## Manual macOS acceptance — pending

Use the [repeatable validation procedure](../validation/README.md) with a production build. Automated rendering does not check these human acceptance items.

- [ ] The anemone looks natural.
- [ ] Tentacles move gently.
- [ ] Both clownfish are recognizable.
- [ ] Clownfish remain near the anemone.
- [ ] Clownfish react naturally to the player.
- [ ] The moray is partly hidden.
- [ ] The eel looks anatomically distinct.
- [ ] Eel head and body animation is believable.
- [ ] Eel behavior is calm rather than aggressive.
- [ ] No clipping through solid hiding structures.
- [ ] Existing reef fish remain unaffected.
- [ ] Performance remains smooth.

The models are stylized; the moray curve is a bounded visual approximation, not physical soft-body or husbandry simulation. Hidden means sheltered deep in the open log, not invisible from every angle. Its soft retreat response intentionally allows contact without adding a whole-site player barrier. Personal space remains soft and transparent fins retain the existing per-batch sorting limitations.

Await manual testing before Pass 010. No feeding, reproduction, stinging, combat or additional anchored inhabitants are implemented.
