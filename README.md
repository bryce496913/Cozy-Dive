# Cozy Diver

A quiet little world beneath the surface. **v0.2 / Pass 016 — Reef Fish Overhaul (`0.2.0-rc.10`)** is a first-person, browser-based aquarium prototype: swim at your own pace through rippled sand, carved reef rock, corals, seagrass and soft blue-green water. No scores, timers, combat, accounts, or external asset services.

## Stack and requirements

Vite, strict TypeScript, Three.js, Vitest, ESLint, and Prettier. Use Node.js **22.12+** (Node 24 was used for this pass), npm, and a modern desktop browser with WebGL and pointer lock enabled. No backend, API keys, or services are needed. Chrome, Firefox, Safari, and Edge are the intended targets; see the validation record for browsers actually tested.

## Get started

```bash
npm install
npm run dev
```

Open the address printed by Vite. Click **Enter the Water** to give the canvas mouse capture. Escape pauses swimming and shows the resume overlay. Settings are accessible before entering or while paused.

For an existing lockfile in CI or a clean checkout, use `npm ci`.

| Command               | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `npm run dev`         | Start the development server                  |
| `npm run build`       | Typecheck and produce `dist/`                 |
| `npm run preview`     | Serve the production build locally            |
| `npm run test`        | Run the unit tests once                       |
| `npm run test:stress` | Run opt-in 5/15/30-minute ecosystem scenarios |
| `npm run typecheck`   | Check strict TypeScript types                 |
| `npm run lint`        | Check ESLint rules and Prettier formatting    |
| `npm run format`      | Apply Prettier formatting                     |

Vite binds to all interfaces for cloud development; use `npm run dev -- --host 127.0.0.1` to restrict it to your own machine. Deployment is a static `dist/` directory; no server-side application is required.

## Swimming controls

| Input  | Action                                  |
| ------ | --------------------------------------- |
| W / S  | Swim forward / backward along your view |
| A / D  | Strafe left / right                     |
| Mouse  | Look around                             |
| Escape | Release mouse capture and pause         |
| M      | Toggle ambient audio while swimming     |

Click **Return to the Water** to resume. Look up or down and use W/S to change depth; A/D always strafe horizontally. Space and Shift have no swimming action. Pausing or losing browser focus clears held input and propulsion momentum while retaining a resting breath’s phase and small vertical velocity. Diagonal input is normalized. Subtle stroke-related pitch feedback stays below 0.07 degrees, with no roll or visual position offsets. Looking straight up/down is limited.

This is a technical release candidate; final v0.2 approval awaits manual MacBook Air acceptance. See [Pass 016 validation](docs/VALIDATION_V02_PASS_016.md), [Pass 015 validation](docs/VALIDATION_V02_PASS_015.md), [Pass 014 validation](docs/VALIDATION_V02_PASS_014.md), [Pass 013 validation](docs/VALIDATION_V02_PASS_013.md) and [repeatable benchmarks](validation/README.md).

## Current features

- Seeded procedural aquarium with rippled sand, embedded rocks, planted banks, visible glass seams, and 40 tropical marine fish across six species with distinct social behavior.
- Six marine habitat forms (seagrass, macroalgae and soft corals) in seeded habitat patches, with shared-current vertex bending, stable bases and smooth reduced-motion settling. Suspended particles, translucent light shafts, hemisphere and surface lighting, and distance fog.
- First-person swimming with smooth kick-and-glide propulsion, weighted direction changes, progressive water drag, and damped breathing buoyancy. Bounded 1/240-second steps sample forces and integrate linear drag analytically; long frame gaps are capped at 100 ms.
- A safe starting position, clearance from all six aquarium boundaries, and sliding collisions against 139 structural hulls: 34 reef rocks, 39 coral/older decorative components, and 66 components across six aquarium ornaments. Thin foliage and decorative pebbles remain passable.
- Pointer lock only following an explicit button click. Escape, loss of focus, and hidden tabs pause controls.
- Optional procedural underwater ambience, slow currents, gentle stroke-driven swimming sound, and sparse ornament-adjacent water details. Silent preview; audio fades on pause/mute and suspends in hidden tabs.
- Mouse sensitivity, movement speed, swimming feel, reduced-motion, audio enable and volume preferences saved locally. Storage failure falls back to session settings. System reduced-motion preference is respected on first visit; the option uses direct mouse-look and freezes ambient sway.
- Responsive canvas, device pixel ratio capped at 1.75, and messages for unavailable WebGL, lost graphics context, or denied pointer lock.
- Explicit cleanup of listeners, animation frames, geometries, materials, renderer, and DOM on disposal / hot reload.

## Architecture

```text
src/
  app/          Application lifecycle, animation loop, system coordination
  audio/        Procedural water layers, bounded events, gesture-gated lifecycle
  config/       Aquarium dimensions, spawn, and movement tuning
  controls/     Pointer lock, keyboard, and smoothed yaw/pitch
  environment/  Deterministic procedural scenery and owned fish lifecycle
  creatures/    Anemone, moray and seven hidden animals with owned local clocks
  fish/         Species, seeded spawning, pure steering, shared models, interpolation
  player/       Pure movement physics, convex collision sweeps, and sliding
  rendering/    Renderer, camera, fog, lighting, and resize lifecycle
  ui/           Welcome/pause HUD, controls, storage, settings validation
```

`Application` owns and disposes the systems. `Aquarium` owns its generated resources. The environment root is a Three.js group so future environment loaders can replace it without changing movement. Physics and settings have no dependency on the renderer and are tested in Node. Mouse deltas describe displacement and are not multiplied by frame time; look smoothing uses an exponential, delta-time-based blend. Movement follows the same yaw/pitch convention as the camera.

Tune aquarium dimensions, clearance, and all physical/feedback parameters in `src/config/world.ts`; speed defaults/ranges and preset validation live in `src/ui/settings.ts`. Keep seabed variation below the floor clearance. Camera FOV and pixel ratio live in `src/rendering/UnderwaterScene.ts`.

## Ambient soundscape

Click Enter to enable quiet underwater audio when the browser permits it. The initial preview remains silent. **Ambient audio** in Settings and the top-bar button toggle the soundscape; **M** mutes/unmutes while swimming. **Master volume** defaults to 30%, persists locally, and is retained while muted. Audio is optional; reduced motion remains a separate choice.

The soundscape uses soft procedural liquid textures: short muffled cavity resonances, a quiet colored-water bed, restrained kick-and-glide movement and occasional delicate bubble details. A subdued current and deeper filtering reduce the earlier wind-like hiss. There is no music, prominent breathing, machinery or per-fish sound. Escape fades everything out; background tabs suspend audio and never accumulate events. Audio support or autoplay failure leaves swimming playable in silence. Previous v1 preferences migrate without resetting swimming choices.

See [audio architecture and settings](docs/AUDIO.md) and [Pass 005B validation and before/after listening previews](docs/VALIDATION_V02_PASS_005B.md). Functional checks do not establish subjective sound quality; human listening and MacBook Air acceptance remain pending.

## A tropical marine aquarium

Six home-aquarium decorations now share the reef: a slowly opening treasure chest with occasional bubbles, corner filter, swimmable stone arch, miniature wreck, hollow driftwood log, and island-head statue. Openings have matching component collision; the chest lid holds safely when a player or fish is nearby. See [ornament architecture](docs/ORNAMENTS.md).

The active roster is **20 blue-green chromis, 6 pajama cardinalfish, 6 firefish gobies, 4 yellow assessors, 2 royal grammas and 2 ocellaris clownfish** (40 total). Chromis form the larger lively school; cardinals hover in loose groups; firefish retreat toward safe shelter; assessors and grammas explore local reef cover. The five freshwater species have been replaced. The clownfish pair stays near one gently animated host anemone. A separate sheltered moray peeks and retreats inside the hollow log. See [anchored marine life](docs/ANCHORED_LIFE.md).

Models have species-specific lofted bodies, distinctive marine patterns, eyes and articulated fins. Chromis vary in blue-green tint, cardinals carry yellow faces/bands/spots, firefish have extended dorsal pennants, and grammas have purple/gold bodies. All species use shared articulated instance batches with conservative moving bounds.

The reef includes turtle grass, Caulerpa, Halimeda, red macroalgae, soft leather corals and sea fans, plus eight seagrass meadows. Six living stony colonies attach to reef rock alongside three separate aquarium ornaments. Coral is an animal, macroalgae is algae, and seagrass is a flowering marine plant. The sandy central channel remains open.

Patient exploration can also reveal one seahorse tucked beside vegetation, a camouflaged frogfish in the wreck, and five tiny surface-crawling nudibranchs. They have stable, safely viewable homes and no markers, notifications or collection mechanics. See [hidden marine discoveries](docs/HIDDEN_LIFE.md).

See [fish](docs/FISH.md), [marine forms](docs/PLANTS.md), [habitat anchors](docs/HABITAT.md), and [Pass 013 validation](docs/VALIDATION_V02_PASS_013.md). Production uses 40 fish; the explicit temporary stress configuration uses 60. No new audio layers, feeding, aggression or damage mechanics are implemented.

## Swimming physics and tuning

Holding a movement key repeats an active stroke followed by a glide. A squared-sine envelope builds and fades the propulsion **force**, which is filtered before integration; velocity and position are never multiplied by a wave. A small baseline thrust softens the rhythm. Releasing input cuts thrust while velocity decays under water drag, settling tiny horizontal residuals to zero. Direction changes redirect the filtered force without resetting velocity. Diagonal normalization and pitch-relative forward movement are preserved; all three propulsion axes use the same force pulse, filtering, drag, and coasting, including nearly vertical swimming.

Choose **Relaxed**, **Natural** (default), or **Responsive** in Settings. Existing v1 storage remains valid; missing/invalid feel values become Natural without losing other preferences. Speed is a nominal average horizontal speed: instantaneous speed varies across the stroke.

| Preset     | Cycle (s) | Active fraction | Drag (1/s) | Force response (1/s) | Rhythmic fraction | Breathing force (m/s²) |
| ---------- | --------- | --------------- | ---------- | -------------------- | ----------------- | ---------------------- |
| Relaxed    | 1.4       | 0.35            | 0.8        | 5                    | 0.85              | 0.14                   |
| Natural    | 1.1       | 0.45            | 1.1        | 8                    | 0.75              | 0.20                   |
| Responsive | 0.8       | 0.50            | 1.8        | 12                   | 0.30              | 0.12                   |

The independent five-second breathing force acts around a neutral depth with a 1.6/s² restoring spring and 2.4/s vertical damping. Natural hovering displacement is approximately **13.3 cm peak-to-peak** (about ±6.65 cm), up from 9.3 cm. Relaxed is about 9.3 cm and Responsive about 8.0 cm. Intentional depth changes suppress breathing and move the neutral depth toward the projected coasting endpoint; release settles naturally there. Buoyancy fades within 25 cm of floor/surface, preventing repeated contact and boundary-induced drift. All integrated motion respects the existing clearance and outward-velocity cancellation.

`SwimState.position` and `velocity` are authoritative physical state. `thrust` is the filtered propulsion acceleration; stroke/breath timers are independent and bounded. `neutralDepth` anchors buoyancy. `bodyPitch` is optional visual feedback only: it never changes position, velocity, collision, or input direction. No camera position offset is added. Future animation/audio/body systems can read stroke time, thrust, and breath time without owning movement or advancing its clocks.

Reduced motion suppresses breathing force and visual pitch feedback while keeping smooth propulsion/inertia, direct mouse-look, and frozen ambient sway. Enabling it during a breath lets spring/damping settle naturally. Before the first entry, only physical resting buoyancy advances: no input, fish simulation, or ambient clock starts. A quarter-cycle initial phase gives an immediate gentle acceleration rather than waiting for a zero crossing. Entry uses the same position, phase, anchor, and resting velocity.

After entry, pause/lock loss and visibility changes freeze every simulation clock and physical position. Propulsion resets; a resting breath retains its anchor and small vertical velocity for continuous resume. Pausing during intentional depth change captures the current resting depth and clears ascent/descent momentum. Natural steady peak vertical speed is about 8.3 cm/s; boundaries and rock contact can reduce breathing travel.

## Living vegetation and decorative hardscape

Tropical seagrass frames sand margins; feathered and segmented macroalgae occupy reef banks. Soft corals and sea fans attach to supporting rock. Living rigid colonies and separate ornaments share exact structural collision hulls; flexible tissue stays passable. See [marine habitat forms](docs/PLANTS.md).

## Environmental collision

The player has a **28 cm spherical collision radius**, independent of the existing 65 cm glass/floor/surface clearance and the camera’s 8 cm near plane. The environment extracts static convex hull planes from the exact convex triangles and scale/tilt/position used to draw each major rock. Six pooled major templates and three pebble templates mix weathered boulders, sedimentary slabs, and fractured stones. Seeded low-frequency deformation, layered contours, creased normals, and restrained mineral vertex colors replace flat low-detail primitives. Displaced points are explicitly rebuilt with Three.js ConvexGeometry before either rendering or collider extraction; arbitrary concave triangle planes are never treated as hull planes. No separately guessed rock positions or extra runtime assets are used. The scenery seed and random-number sequence are unchanged.

`src/environment/rockCollider.ts` performs one-time geometry extraction; `Aquarium.collision` owns the resulting `CollisionWorld`. The pure TypeScript solver in `src/player/collision.ts` uses a swept bounding-box rejection followed by expanded convex-plane intersection. Each bounded swimming substep submits its displacement after force integration. The earliest scenery or aquarium-wall contact removes only inward velocity and displacement; tangential motion slides along the contact. Several contacts can constrain a corner without clearing propulsion, breathing clocks, neutral depth, or the whole movement state. Sweeps prevent tunneling even across a large displacement. Exceptional initial overlaps recover toward a nearby free point outside the connected rock union, within the aquarium, rather than teleporting to spawn.

Seagrass, macroalgae and flexible coral tissue remain passable. Solid reef rock and stony coral skeletons use matching convex components; soft living tissue does not add blocking hulls. The 55 decorative pebbles also remain passable. This avoids large invisible barriers around foliage. Future thick stems can register static convex hulls through the same collision interface without altering propulsion.

Tune `COLLISION.playerRadius`, contact budget, numerical skin, and tolerance in `src/config/world.ts`. Broad-phase rejection, reusable contact buffers, and a bounded eight-contact solver keep normal steps allocation-free; there is no physics-engine dependency or extra rendering pass. Expanded face planes approximate a sphere against a convex rock conservatively at sharp edges/vertices, with a slight extra corner margin. Hulls are static and assume the environment root remains untransformed; rebuilding/moving scenery requires regenerating colliders. Sand still uses the existing floor clearance, rather than per-triangle terrain collision.

For later tuning, adjust cadence/active fraction together, then drag/force response for glide and control. Reduce rhythmic fraction for steadier speed; lower breathing force or visual pitch for comfort. Subjective comfort and laptop GPU performance still need human playtesting.

## Validation and manual testing

See [v0.2 Pass 004B biodiversity validation](docs/VALIDATION_V02_PASS_004B.md), [v0.2 Pass 004 vegetation validation](docs/VALIDATION_V02_PASS_004.md), [v0.2 Pass 003 behavior validation](docs/VALIDATION_V02_PASS_003.md), [v0.2 Pass 002B validation](docs/VALIDATION_V02_PASS_002B.md), [v0.2 Pass 002 schooling validation](docs/VALIDATION_V02_PASS_002.md), [v0.2 Pass 001 fish validation](docs/VALIDATION_V02_PASS_001.md), [the Pass 003 validation record](docs/VALIDATION_PASS_003.md), [Pass 002 results](docs/VALIDATION_PASS_002.md) and [historical Pass 001 results](docs/VALIDATION.md) for executed checks, screenshots, and practical limits. Unit tests cover movement direction, diagonal normalization, pitch-relative forward movement, vertical movement, acceleration, drag, frame-rate equivalence, frame-gap protection, all six boundaries, valid spawn, and settings validation/storage.

To test manually:

1. Run the dev server and confirm sand, rocks, plants, fog, and light shafts render without errors.
2. Open Settings; change sensitivity/speed/reduced motion, refresh, and confirm the preferences persist.
3. Enter the water. Check every movement key, including combinations. Release keys to feel drag.
4. Look left/right/up/down: motion should follow the mouse, stop short of a vertical flip, and never roll. Forward swimming should follow your view.
5. Look up/down and use W/S toward the surface/floor; swim toward every glass wall. The camera must remain inside with clearance.
6. Press Escape while moving. Verify movement stops, then resume. Repeat after switching tabs or browser focus.
7. Compare all three feel presets: hold W through several strokes, release to coast, and reverse direction repeatedly. There should be no full stops between strokes or sudden reversals.
8. Hover for several breathing cycles, then ascend/descend and release. Verify subtle bounded breathing at the new depth. Repeat within 25 cm of floor/surface and with combined diagonal input against glass.
9. Enable reduced motion and confirm breathing/sway stop while propulsion remains smooth. Pause near a boundary, wait, resume without held keys, and repeat after focus/tab loss.
10. Approach major rocks from the front, side, above, below exposed edges, and diagonally. Continue holding input through several strokes: expect solid contact and smooth sliding, not vibration. Reverse away and check overlapping banks and nearby glass.
11. Swim through seagrass and over decorative pebbles: there should be no large invisible plant barriers. Hover just above a rock and pause/resume in contact.
12. Inspect all six marine species from side and front. Check chromis schooling and varied tints, cardinal face/band/spots, firefish dorsal pennants, yellow assessors, two-tone grammas and the host-associated clownfish pair. Observe shelter use, personal space, reef avoidance, scatter and gradual recovery.
13. Pause while watching fish, wait, and resume. Check that positions and fin animation freeze exactly, then continue smoothly. Repeat with reduced motion, tab/focus loss, and a refresh.
14. Resize the browser and check canvas proportions and UI. Test a fresh visit with WebGL disabled to inspect the fallback message.

## Known limitations

- Desktop keyboard/mouse only; mobile touch controls are outside this pass.
- Collision covers major static rocks, solid ornament components and aquarium limits. Delicate foliage and decorative pebbles remain passable; there is no contact-driven plant deformation, per-triangle sand collision, or dynamic rigid-body physics.
- Schooling is local steering rather than global pathfinding or hard fish collision. Occasional close passes or temporary fragmentation are possible. Diver reactions are soft avoidance rather than hard player-fish collision. Foraging is visual activity only; there is no food system or identification UI. No office, passages, customization, ocean or progression.
- Sand is a rippled procedural surface with authored PBR detail (visual relief sits up to 7 cm above the habitat reference); light shafts remain simple and the full lighting overhaul is reserved for a later pass. The water surface is a visual plane, not a fluid simulation.
- The authored reef library is a 19.5 MB local GLB (no mesh/texture compression yet). Reef rocks are carved inside their accepted footprints, so the overall layout and rock placement are unchanged from Pass 013.
- Player position is not persisted. Only settings are saved, per origin in browser local storage.
- Pointer lock may be restricted by embedded frames or browser policies; use a top-level page. Graphics-context loss requires reloading.
- The build reports a bundle-size advisory for Three.js (see the current validation record for measured size). No runtime asset downloads are needed.
- Browser coverage and performance claims are limited to the actual results in the validation record. Software-rendered Chromium does not establish ordinary-laptop GPU performance.

The [roadmap](docs/ROADMAP.md) is provisional; future passes should preserve the quiet, low-pressure experience.

Pass 011 integrates the complete tropical roster and six ornaments without changing production behavior. Deterministic physical route fixtures, full-scene long-session audits, graphics/input failure checks and retained browser evidence support this candidate. MacBook Air performance, Safari behavior, audio comfort and final v0.2 acceptance remain manual. No release, tag, automatic merge or v0.3 work is included.

## Authored visual benchmark — opt in

Pass 012 adds an original Blender-authored chromis, branching coral, embedded 512px PBR maps and an asynchronous GLB pipeline. Its chromis direction was accepted by the user as the reference for Pass 013. The benchmark remains available separately; default aquarium hero props and anchored creatures now use the same authored workflow.

```bash
npm run dev
# Open /benchmark.html for the clearly marked development showcase.
npm run build:benchmark
npm run preview -- --outDir dist-benchmark
# Open /benchmark.html in this explicit benchmark build.
```

Enter/escape/WASD use the real swimming controls. The development panel shows loading/fallback and switches between original and benchmark assets. The normal production build emits only the ordinary aquarium entry, with no debug panel; it requests three local hero-asset GLBs. Required model/maps are local; no runtime internet connection is needed.

See [visual audit](docs/VISUAL_QUALITY_AUDIT.md), [art direction](docs/ART_DIRECTION.md), [asset workflow](docs/ASSET_PIPELINE.md), [licensing/inventory](docs/ASSET_MANIFEST.md), and [matched renders, animation, budgets and pending acceptance](docs/VALIDATION_V02_PASS_012.md). Pass 013 awaits user review before the next pass.

### v0.2 Pass 013 candidate

The normal aquarium now loads original authored ornament, anchored-creature and clownfish GLBs locally, following the existing behavior and animation controllers. A visible loading/fallback status keeps exploration available if a library fails. See [validation and paired screenshots](docs/VALIDATION_V02_PASS_013.md), [asset inventory](docs/ASSET_MANIFEST.md) and [reproduction commands](docs/ASSET_PIPELINE.md). The separate Pass 012 benchmark remains available. This pass requires user review and macOS acceptance before merging or starting another pass.

### v0.2 Pass 014 candidate

The environment itself now uses the authored workflow:

- **Rocks**: four reef-rock archetypes (porous limestone, organic outcrop, layered sedimentary, crevice/overhang) are carved from the accepted rock hulls and rendered with three LOD levels and triplanar limestone maps.
- **Corals**: authored branching, brain/boulder and tiered plate corals sit on the existing colony structure.
- **Vegetation**: soft corals, sea fans, seagrass and three macroalgae families are richer, with unchanged current motion, pause and reduced-motion behaviour.
- **Sand and depth**: rippled PBR sand with shells and coral rubble, a layered meadow understory, and a low reef relief hugging the rear and side glass.

Collision gains convex crevice parts that never add solid volume. Every Pass 013 ornament, creature, home and route is preserved. A loading/fallback status keeps the procedural reef if the library fails. See [validation, matched screenshots and budgets](docs/VALIDATION_V02_PASS_014.md), [art direction](docs/ART_DIRECTION.md), [asset inventory](docs/ASSET_MANIFEST.md) and [reproduction](docs/ASSET_PIPELINE.md). This pass awaits user review and MacBook Air acceptance before merging or starting another pass.

### v0.2 Pass 015 candidate

Corals and creatures now match the Pass 014 rock and sand standard:

- **Corals**: branching colonies bud radial corallites; brain colonies have sharp meanders; the boulder colony is hummocky; plate colonies have gnarled trunks. Soft corals and fans are richer.
- **Creatures**: the seahorse, frogfish, moray and host anemone are re-authored on their accepted meshes with relief, natural skin pattern and occlusion.
- **Nudibranchs**: five authored species replace the procedural forms.

Behaviour, homes, collision and animation contracts are unchanged; clownfish and the free-swimming reef fish are next. See [validation and matched captures](docs/VALIDATION_V02_PASS_015.md). This pass awaits user review and MacBook Air acceptance.

### v0.2 Pass 016 candidate

All 40 fish now swim as authored morph rigs: the accepted chromis, plus new pajama cardinalfish, firefish, yellow assessors and royal grammas built on the same rig and morph contract, alongside the Pass 013 clownfish. Simulation, behaviour, pause and reduced motion are unchanged, and the procedural fish remain as the fallback. See [validation and matched captures](docs/VALIDATION_V02_PASS_016.md). This pass awaits user review and MacBook Air acceptance.
