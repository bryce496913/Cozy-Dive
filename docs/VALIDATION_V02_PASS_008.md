# v0.2 Pass 008 — Aquarium Ornaments & Animated Decorations

Executed November 7, 2026. Base `main` at `0bf189c` includes merged Pass 007 / PR #14. Branch: `codex/v0.2-pass-008-aquarium-ornaments`. Candidate **0.2.0-rc.3**. No automatic merge, release, tag or future anchored creature is part of this pass.

## Scope and audit

The accepted marine baseline contains 38 fish, 65 marine clumps, eight meadows and 73 structural reef hulls. Pass 007 owned 79 scene geometries / 25 materials and shipped 682.17 kB JavaScript / 180.28 kB gzip. Its 226 routine tests and four opt-in stress checks remain the regression foundation. [Historical validation](VALIDATION_V02_PASS_007.md) preserves those measurements.

The environment now owns six additional home-aquarium objects: treasure chest, rear-corner filter, swimmable stone arch, miniature wreck, hollow driftwood and island-head statue. Shared muted materials and procedural component geometry avoid remote assets or physics libraries. Object roots remain fixed; the chest lid pivots about its actual rear hinge. Convex components follow the visible structural pieces, preserving the arch/log openings and the wreck's open main hull. No single convex hull closes an entrance.

The lid collider updates in place from its rendered transform. A conservative swept envelope holds its animation before a player or fish could be touched. A safety hold may extend nominal 25–45 second cycles; it never pushes an occupant or creates a permanent overhead barrier. Flora placement separately reserves the lid's full sweep, while a distinct support list keeps living corals on actual reef surfaces. Optional bubbles use one pool of 18 instances and a bounded lifetime. Twelve faint local particles indicate filter return flow. Pause freezes animation; reduced motion holds the pose/flow and clears optional bubbles.

Six named, oriented habitat anchors clear a 0.65-unit body envelope against the entire scene. Generic reef anchors are deliberately not sampled from narrow ornament planks. An early navigation regression exposed poor outer-edge shelter selection; using the intended named anchors restores safe local navigation. The revised layout also exposed tilted-coral inspection points outside their placement radius; those metadata positions are now bounded and revalidated without changing coral geometry or the global current.

Eight seagrass meadows remain. Their bounded placement search now includes more bank-margin space to clear the decorations. Player spawn and the central swimming corridor remain clear. Fish roster/tuning, swimming, buoyancy, collision solver, plant current and audio mix are unchanged. The existing sparse audio scheduler gains two validated locations, chest and filter, with unchanged 28–65 second intervals and at most one transient voice. No chest-triggered audio, filter loop or new layer is added.

See [ornament architecture](ORNAMENTS.md), [habitat anchors](HABITAT.md), [fish](FISH.md) and [marine forms](PLANTS.md).

## Checks and evidence

`npm run build`, `npm run typecheck`, and `npm run lint` pass. Production JavaScript is **693.86 kB / 184.24 kB gzip**, with the existing Vite large-chunk advisory. `npm run test -- --maxWorkers=2` passes **242 tests / 23 files** (39.23 seconds). `npm run test:stress` passes **four tests** (46.22 seconds): five simulated minutes with 60 fish, fifteen and thirty with 38 fish, and 30/60/120 FPS determinism.

The [raw stress report](benchmarks/v0.2-pass008/stress.json) includes the new ornament animation and collision components. All long scenarios have zero fish containment corrections, bounded scatter, five activity states and minimum 30-second travel of 2.79–3.48 units. Timing observations are not hardware FPS claims. Browser evidence uses Chromium with SwiftShader software rendering in the cloud. It cannot certify MacBook Air FPS, perceptual listening quality or subjective swimming comfort. Camera fixtures place the test camera directly; they are not navigation recordings and HUD depth continues to describe the unchanged player.

Two interim cloud runs exceeded the unchanged five-second timeout in pre-existing biodiversity checks. The retained run passes the same two-worker command without relaxed assertions or timeouts.

The new regressions cover six distinct deterministic models, finite vertices/unit normals, stable transforms, floor/corner placement, named anchor safety, clear spawn/center, swept player passage through arch/log/wreck, solid filter/statue colliders, real hinge alignment, moving lid plane agreement, occupant holds, cycle duration/easing, bubble pooling/rise/pause/reduced motion, sparse single-voice audio limits, sustained fish safety and idempotent resource disposal. Existing geometry, movement, schooling, scatter, control, audio and disposal regressions remain in place.

## Rendered views and resources

The [completed browser report](benchmarks/v0.2-pass008/browser.json) retains all six models, 38 fish, **139 structural hulls** (73 reef + 66 ornament components), **159 owned geometries / 33 materials**, and eight meadows. The added landmarks increase resource counts; this pass makes no rendering speedup claim. Camera-view draw/triangle counts are retained in JSON rather than treated as hardware frame timings. No console errors were observed. Disposal returns renderer geometries/textures to zero and closes the native audio context.

The chest opening capture shows a live pooled bubble burst and a lid angle above 0.8 radians. The same active-time state remains exactly unchanged after a paused update. Unit tests additionally verify both player/fish sweep holds, full smooth cycles, reduced motion and surface-reaching bubbles.

An initial capture harness tried to read the audio context after application disposal had cleared its reference. The harness now retains the native context before disposal; the saved report is the completed rerun. No passing resource claim is taken from that failed capture.

- [Full aquarium and all six objects](screenshots/v0.2-pass008/overview.png).
- [Chest closed](screenshots/v0.2-pass008/chest.png), [open with bubbles](screenshots/v0.2-pass008/chest-open-bubbles.png).
- [Corner filter](screenshots/v0.2-pass008/filter.png), [stone arch](screenshots/v0.2-pass008/arch.png).
- [Miniature wreck](screenshots/v0.2-pass008/shipwreck.png), [hollow log](screenshots/v0.2-pass008/log.png), [island-head statue](screenshots/v0.2-pass008/statue.png).

The full-scene camera is outside the front glass to include all six landmarks; closeups are fixed camera fixtures. The moai marks were brought forward after rendered review showed them buried in the face. Log rims/grain and arch contours use restrained irregularity; the objects remain stylized aquarium decorations rather than realistic historical artifacts or natural specimens.

## Native controls and audio lifecycle

The [native browser lifecycle report](benchmarks/v0.2-pass008/lifecycle.json) passes camera-directed ascent/descent, ignored Space/Shift, held-input clearing on blur, shortcut modifiers, silent preview, legacy settings migration, gesture-started Web Audio, swimming gain, mute/unmute, sparse voice release, Escape freeze, settings persistence, four resume cycles, controlled visibility, unsupported-audio fallback and context disposal. No console errors were observed.

The accelerated thirty-minute browser soak retains 38 fish, 19 audio nodes, three buffers and three loops, with zero fish containment corrections over 54,000 steps. Its settings exercise reduced motion; the separate stress harness also exercises normal ornament motion and toggles. Post-GC heap samples are retained in JSON, not treated as proof against every possible leak. Visibility uses a controlled document-hidden state, and transient native voices are released on accelerated simulation time. This is functional validation, not perceptual listening or a real-time hardware soak.

## Manual macOS acceptance — pending

Use the [repeatable validation procedure](../validation/README.md) with a production build. These checks require human review; automated evidence does not mark them complete.

- [ ] Treasure chest is recognizable.
- [ ] Lid opens and closes smoothly.
- [ ] Bubbles appear occasionally and rise naturally.
- [ ] Filter looks like genuine aquarium equipment.
- [ ] Arch is swimmable.
- [ ] Shipwreck is miniature and visually detailed.
- [ ] Log has a believable hollow section.
- [ ] Island statue is recognizable.
- [ ] Props are distributed naturally.
- [ ] Solid collisions match visible geometry.
- [ ] No trapping or blocked corridors.
- [ ] Fish navigate around the ornaments.
- [ ] Existing marine life remains natural.
- [ ] Audio remains subtle.
- [ ] Performance remains smooth.

Await manual macOS acceptance before Pass 009. No new location-bound creature is implemented.
