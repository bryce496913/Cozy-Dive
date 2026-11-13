# Cozy Diver

A quiet little world beneath the surface. **v0.5 / Pass 029 — The tank catalog (`0.5.0-alpha.1`)** is a first-person, browser-based aquarium prototype. Start in a small glass-walled office where a one-metre aquarium sits on its stand, then swim at your own pace through its rippled sand, carved reef rock, corals, seagrass and soft blue-green water. v0.2 (Living Aquarium) was accepted at `0.2.0-rc.15` and v0.3 (Office & Dive Transition) at `0.3.0-rc.1`. No scores, timers, combat, accounts, or external asset services.

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

| Input  | Action                                                       |
| ------ | ------------------------------------------------------------ |
| W / S  | Swim forward / backward along your view                      |
| A / D  | Strafe left / right                                          |
| Mouse  | Look around                                                  |
| Escape | Release mouse capture and pause                              |
| M      | Toggle ambient audio while swimming                          |
| E      | At the tank: dive in. Near the surface: return to the office |

In the office, W A S D walk and the mouse looks around.

Click **Return to the Water** to resume. Look up or down and use W/S to change depth; A/D always strafe horizontally. Space and Shift have no swimming action. Pausing or losing browser focus clears held input and propulsion momentum while retaining a resting breath’s phase and small vertical velocity. Diagonal input is normalized. Subtle stroke-related pitch feedback stays below 0.07 degrees, with no roll or visual position offsets. Looking straight up/down is limited.

v0.5 Personalization has started alongside the v0.4 candidate, which still awaits macOS acceptance. See [tank catalog design](docs/TANK_CATALOG.md) and [Pass 029 validation](docs/VALIDATION_V05_PASS_029.md). See [outer reef life validation](docs/VALIDATION_OUTER_REEF_LIFE.md), [Pass 028 playtest round](docs/VALIDATION_V04_PASS_028_PLAYTEST.md), [Pass 028 release-candidate validation](docs/VALIDATION_V04_PASS_028.md), [Pass 027 validation](docs/VALIDATION_V04_PASS_027.md), [Pass 026 playtest round](docs/VALIDATION_V04_PASS_026_PLAYTEST.md), [Pass 026 validation](docs/VALIDATION_V04_PASS_026.md), [Pass 025 validation](docs/VALIDATION_V04_PASS_025.md), [Pass 024 validation](docs/VALIDATION_V04_PASS_024.md), [Pass 023 validation](docs/VALIDATION_V04_PASS_023.md), [Pass 022 validation](docs/VALIDATION_V03_PASS_022.md), [Pass 021 validation](docs/VALIDATION_V03_PASS_021.md), [Pass 020 validation](docs/VALIDATION_V03_PASS_020.md), [Pass 019 validation](docs/VALIDATION_V02_PASS_019.md), [Pass 018 validation](docs/VALIDATION_V02_PASS_018.md), [Pass 017 validation](docs/VALIDATION_V02_PASS_017.md), [Pass 016 validation](docs/VALIDATION_V02_PASS_016.md), [Pass 015 validation](docs/VALIDATION_V02_PASS_015.md), [Pass 014 validation](docs/VALIDATION_V02_PASS_014.md), [Pass 013 validation](docs/VALIDATION_V02_PASS_013.md) and [repeatable benchmarks](validation/README.md).

## Current features

- Seeded procedural aquarium with rippled sand, embedded rocks, planted banks, visible glass seams, and 41 tropical marine fish across six species with distinct social behavior.
- Six marine habitat forms (seagrass, macroalgae and soft corals) in seeded habitat patches, with shared-current vertex bending, stable bases and smooth reduced-motion settling. Suspended particles, translucent light shafts, hemisphere and surface lighting, and distance fog.
- First-person swimming at one steady, calm speed (it eases in within about a second, then holds; strokes show only as a subtle sway and soft sound), weighted direction changes, progressive water drag, and damped breathing buoyancy. Bounded 1/240-second steps sample forces and integrate linear drag analytically; long frame gaps are capped at 100 ms.
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

Six home-aquarium decorations now share the reef: a slowly opening treasure chest with occasional bubbles, an internal filter hung in the top corner, swimmable stone arch, small sunken boat, hollow driftwood log, and island-head statue. Openings have matching component collision; the chest lid holds safely when a player or fish is nearby. See [ornament architecture](docs/ORNAMENTS.md).

The active roster is **20 blue-green chromis, 6 pajama cardinalfish, 6 firefish gobies, 4 yellow assessors, 2 royal grammas and 3 ocellaris clownfish** (41 total). Chromis form the larger lively school; cardinals hover in loose groups; firefish retreat toward safe shelter; assessors and grammas explore local reef cover. The five freshwater species have been replaced. The clownfish pair and a small juvenile stay near one gently animated host anemone. A separate moray lives in a hole in a large reef rock, its head resting out of the hole until you come close. See [anchored marine life](docs/ANCHORED_LIFE.md).

Models have species-specific lofted bodies, distinctive marine patterns, eyes and articulated fins. Chromis vary in blue-green tint, cardinals carry yellow faces/bands/spots, firefish have extended dorsal pennants, and grammas have purple/gold bodies. All species use shared articulated instance batches with conservative moving bounds.

The reef includes turtle grass, Caulerpa, Halimeda, red macroalgae, soft leather corals and sea fans, plus eight seagrass meadows. Six living stony colonies attach to reef rock alongside three separate aquarium ornaments. Coral is an animal, macroalgae is algae, and seagrass is a flowering marine plant. The sandy central channel remains open.

Patient exploration can also reveal one seahorse tucked beside vegetation, a camouflaged frogfish on a reef-rock top, and five tiny surface-crawling nudibranchs. They have stable, safely viewable homes and no markers, notifications or collection mechanics. See [hidden marine discoveries](docs/HIDDEN_LIFE.md).

See [fish](docs/FISH.md), [marine forms](docs/PLANTS.md), [habitat anchors](docs/HABITAT.md), and [Pass 013 validation](docs/VALIDATION_V02_PASS_013.md). Production uses 41 fish; the explicit temporary stress configuration uses 61. No new audio layers, feeding, aggression or damage mechanics are implemented.

## Swimming physics and tuning

Holding a movement key eases the diver up to the chosen swim speed within each feel's `cruise` time (Relaxed 0.9 s, Natural 0.7 s, Responsive 0.45 s), then holds that speed exactly. The Pass 021 playtest found speed building for several seconds and surging with every stroke; strokes now set only the subtle body sway and the stroke sound, through a squared-sine envelope. Releasing input cuts thrust; water drag plus a gentle constant deceleration ends the horizontal glide exactly at each feel's `rest` time (Relaxed 3 s, Natural 2.5 s, Responsive 1.6 s), so the next stroke starts from rest. Direction changes redirect the filtered force without resetting velocity. Diagonal normalization and pitch-relative forward movement are preserved; all three propulsion axes use the same steady force, filtering, drag, and coasting, including nearly vertical swimming.

Choose **Relaxed**, **Natural** (default), or **Responsive** in Settings. Existing v1 or v2 storage migrates to v3 on first load, keeping every preference; the swim speed keeps its place on the slower Pass 019 scale (60% of v1). Missing/invalid feel values become Natural without losing other preferences. Speed is a nominal average horizontal speed: instantaneous speed varies across the stroke.

| Preset     | Cycle (s) | Active fraction | Drag (1/s) | Force response (1/s) | Rhythmic fraction | Breathing force (m/s²) |
| ---------- | --------- | --------------- | ---------- | -------------------- | ----------------- | ---------------------- |
| Relaxed    | 1.4       | 0.35            | 0.8        | 5                    | 0.85              | 0.084                  |
| Natural    | 1.1       | 0.45            | 1.1        | 8                    | 0.75              | 0.12                   |
| Responsive | 0.8       | 0.50            | 1.8        | 12                   | 0.30              | 0.072                  |

The independent five-second breathing force acts around a neutral depth with a 1.6/s² restoring spring and 2.4/s vertical damping. Natural hovering displacement is approximately **8.0 cm peak-to-peak** (about ±4 cm; Pass 019 calmed it from 13.3 cm). Relaxed is about 5.6 cm and Responsive about 4.8 cm. Intentional depth changes suppress breathing and move the neutral depth toward the projected coasting endpoint; release settles naturally there. Buoyancy fades within 25 cm of floor/surface, preventing repeated contact and boundary-induced drift. All integrated motion respects the existing clearance and outward-velocity cancellation.

`SwimState.position` and `velocity` are authoritative physical state. `thrust` is the filtered propulsion acceleration; stroke/breath timers are independent and bounded. `neutralDepth` anchors buoyancy. `bodyPitch` is optional visual feedback only: it never changes position, velocity, collision, or input direction. No camera position offset is added. Future animation/audio/body systems can read stroke time, thrust, and breath time without owning movement or advancing its clocks.

Reduced motion suppresses breathing force and visual pitch feedback while keeping smooth propulsion/inertia, direct mouse-look, and frozen ambient sway. Enabling it during a breath lets spring/damping settle naturally. Before the first entry, only physical resting buoyancy advances: no input, fish simulation, or ambient clock starts. A quarter-cycle initial phase gives an immediate gentle acceleration rather than waiting for a zero crossing. Entry uses the same position, phase, anchor, and resting velocity.

After entry, pause/lock loss and visibility changes freeze every simulation clock and physical position. Propulsion resets; a resting breath retains its anchor and small vertical velocity for continuous resume. Pausing during intentional depth change captures the current resting depth and clears ascent/descent momentum. Natural steady peak vertical speed is about 5 cm/s; boundaries and rock contact can reduce breathing travel.

## Living vegetation and decorative hardscape

Tropical seagrass frames sand margins; feathered and segmented macroalgae occupy reef banks. Soft corals and sea fans attach to supporting rock. Living rigid colonies and separate ornaments share exact structural collision hulls; flexible tissue stays passable. See [marine habitat forms](docs/PLANTS.md).

## Environmental collision

The player has a **28 cm spherical collision radius**, independent of the existing 65 cm glass/floor/surface clearance and the camera’s 8 cm near plane. The environment extracts static convex hull planes from the exact convex triangles and scale/tilt/position used to draw each major rock. Six pooled major templates and three pebble templates mix weathered boulders, sedimentary slabs, and fractured stones. Seeded low-frequency deformation, layered contours, creased normals, and restrained mineral vertex colors replace flat low-detail primitives. Displaced points are explicitly rebuilt with Three.js ConvexGeometry before either rendering or collider extraction; arbitrary concave triangle planes are never treated as hull planes. No separately guessed rock positions or extra runtime assets are used. The scenery seed and random-number sequence are unchanged.

`src/environment/rockCollider.ts` performs one-time geometry extraction; `Aquarium.collision` owns the resulting `CollisionWorld`. The pure TypeScript solver in `src/player/collision.ts` uses a swept bounding-box rejection followed by expanded convex-plane intersection. Each bounded swimming substep submits its displacement after force integration. The earliest scenery or aquarium-wall contact removes only inward velocity and displacement; tangential motion slides along the contact. Several contacts can constrain a corner without clearing propulsion, breathing clocks, neutral depth, or the whole movement state. Sweeps prevent tunneling even across a large displacement. Exceptional initial overlaps recover toward a nearby free point outside the connected rock union, within the aquarium, rather than teleporting to spawn.

Seagrass, macroalgae and flexible coral tissue remain passable. Solid reef rock and stony coral skeletons use matching convex components; soft living tissue does not add blocking hulls. The 55 decorative pebbles also remain passable. This avoids large invisible barriers around foliage. Future thick stems can register static convex hulls through the same collision interface without altering propulsion.

Tune `COLLISION.playerRadius`, contact budget, numerical skin, and tolerance in `src/config/world.ts`. Broad-phase rejection, reusable contact buffers, and a bounded eight-contact solver keep normal steps allocation-free; there is no physics-engine dependency or extra rendering pass. Expanded face planes approximate a sphere against a convex rock conservatively at sharp edges/vertices, with a slight extra corner margin. Hulls are static and assume the environment root remains untransformed; rebuilding/moving scenery requires regenerating colliders. Sand still uses the existing floor clearance, rather than per-triangle terrain collision.

For later tuning, adjust `cruise` for how quickly the steady speed is reached, `drag` for how long the coast lasts after release, and cadence/active fraction for the sway and sound rhythm; lower breathing force or visual pitch for comfort. Subjective comfort and laptop GPU performance still need human playtesting.

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
- Schooling is local steering rather than global pathfinding or hard fish collision. Occasional close passes or temporary fragmentation are possible. Diver reactions are soft avoidance rather than hard player-fish collision. Foraging is visual activity only; there is no food system or identification UI. No passages, customization, larger ocean or progression.
- Sand is a rippled procedural surface with authored PBR detail (visual relief sits up to 7 cm above the habitat reference); light shafts remain simple and the full lighting overhaul is reserved for a later pass. The water surface is a visual plane, not a fluid simulation.
- Shipped GLBs use Draco geometry and KTX2/Basis textures (about 14.5 MB of models). Textures stay block-compressed on the GPU where the browser supports a compressed format; otherwise three.js falls back to uncompressed RGBA. Reef rocks are carved inside their accepted footprints, so the overall layout and rock placement are unchanged from Pass 013.
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

### v0.4 Pass 028 playtest round (`0.4.0-rc.2`)

Fixes from playing `0.4.0-rc.1`:

- **Chairs:** one complete task chair, at your desk and at every open-plan desk. Its armrests stand on posts, and the backrest is joined to the seat. The open-plan chairs no longer sit through the partition, and each faces its own desk.
- **The crevice:** the overhang above the mouth now rests on the rocks either side, instead of floating over them.

See [the playtest round](docs/VALIDATION_V04_PASS_028_PLAYTEST.md).

### v0.4 Pass 028 release candidate — polish and acceptance

`0.4.0-rc.1` gathers v0.4 for acceptance: the hidden passage, the outer reef and its wall, the big animals and sightings, and the glass office.

- **Full regression:** every browser harness for the office, dive, tank, passage, outer reef, creatures, lifecycle and production build passes, with GPU memory steady across dives, visits to the outer waters and repeated cycles.
- **Reliable tests:** simulation-heavy unit tests now carry their own time budgets, so a busy machine no longer trips them.
- **Acceptance:** a macOS checklist for the whole of v0.4.

See [release-candidate validation](docs/VALIDATION_V04_PASS_028.md).

### v0.4 Pass 027 candidate — The glass office

The office is remodelled as a small private office in a modern workplace.

- **The room:** grey grasscloth walls, porcelain tiles and an acoustic ceiling with LED panels. There is a dark L-desk with two monitors, blue guest chairs, a frosted window with rain beyond, and the aquarium on its cabinet.
- **The glass front:** a black-framed glass partition with a closed door. You stay in the room, but can look out over an open-plan office of workstations, glass offices and framed posters.
- **From inside the tank:** looking out through the aquarium glass, you see the office, blurred and tinted by the water.
- **Generic details:** no real logos, brands or screen content.

See [the office](docs/OFFICE.md#the-glass-office-v04-pass-027) and [validation](docs/VALIDATION_V04_PASS_027.md).

### v0.4 Pass 026 candidate — The wall and the blue

The outer reef is now a wall dive.

- **The tunnel is the loading screen:** the reef prepares while you swim through the dark, and the light at its end opens when it is ready.
- **A dense reef top:** bommies, rock and coral almost everywhere, schools of fish overhead. Its edge is 26 m from the tunnel.
- **The wall and the blue:** past the edge, a wall falls into the deep. Looking out, the blue fades to dark.
- **No walls, no currents:** near the edges, swimming slows to a hover, a little way out over the blue and some way down the wall.
- **Big animals in the blue:** sharks, eagle rays and the turtle pass along the wall while you hover and watch.

See [the wall and the blue](docs/WALL_AND_BLUE.md) and [validation](docs/VALIDATION_V04_PASS_026.md).

### v0.4 Pass 025 candidate — Big creatures

The outer reef has its first big animals, and remembers what you see there.

- **Creatures:** two blacktip reef sharks cruising wide loops, three spotted eagle rays gliding down the sand channel and out over the deep blue, and a green sea turtle wandering between the coral heads. They were modelled from scratch for this pass.
- **Calm:** they keep their own unhurried routes over the reef, and give you room: if you are in their way they ease aside, sideways or up, and drift back once you have gone. Nothing chases or flees.
- **Sightings:** look at a creature, a kind of coral, a sea fan or the seagrass for a moment from nearby, and a quiet note fades in: _New sighting · Green sea turtle_. The pause screen then offers _Seen in the outer waters_: just names and the day you first saw them, with no counts. In v0.5, what you have seen unlocks for the tank.

See [big creatures and sightings](docs/BIG_CREATURES.md) and [validation](docs/VALIDATION_V04_PASS_025.md).

### v0.4 Pass 024 candidate — The outer reef

Beyond the tunnel there is now a reef: the same corals, rocks, sand and fish as in the tank, but on an open seabed to explore.

- **The reef:**
  - eleven coral heads, rock mounds crowned with colonies, with soft corals and sea fans;
  - lone corals on the sand, and seagrass meadows along a winding sand channel;
  - rubble and shells;
  - about 70 m out, a drop-off falling into deep blue that you can swim down.
- **Fish:** about 100 reef fish in six schools around the coral heads, from big chromis schools to cardinalfish, firefish, assessors and grammas.
- **Soft edges:** no walls. Near the reef's edges a gentle current turns you back.
- **Built from the tank's own art library:** shared, never loaded twice. Each piece switches to lighter versions with distance, so the whole reef takes about 30–80 draw calls.

See [the outer reef](docs/OUTER_REEF.md) and [validation](docs/VALIDATION_V04_PASS_024.md).

### v0.4 Pass 023 candidate — The opening

Somewhere at the back of the tank there is a dark crack in the rock. Swim into it and keep going.

- **The crevice:** a rock outcrop in the back-right corner, against the glass. Its crack opens into the narrow alley behind the right bank, half hidden by seagrass and out of sight from the usual swim start.
- **The passage:** inside, the crack darkens. Deep in the dark you pass into a winding tunnel in the outer waters, and you never stop swimming: position, speed and look carry straight across, and nothing jumps. The tunnel leads through a cliff and opens onto open blue water above a sand plain. That area is a placeholder for the outer reef (Pass 024).
- **Getting back:** swim back through the tunnel, or choose **Return to the tank** on the pause screen.
- **Only one world at a time:** the outer waters load as you near the crevice, render only while you are in them, and are released when you are well away again.
- **Sightings journal:** the groundwork for v0.5. Things seen in the outer waters will be remembered locally, though nothing in the outer waters counts as a sighting yet.

See [the passage architecture](docs/PASSAGE.md) and [validation](docs/VALIDATION_V04_PASS_023.md).

### v0.3 Pass 022 release candidate — polish and acceptance

- **Surface where you are:** surfacing leaves through the part of the front glass nearest you and stands you in front of it, after a rise timed by how far you are from the glass.
- **Calm switching:** the pause screen's office and water buttons now fade between the spaces instead of cutting. Escape mid-fade behaves like any transition: choose the destination to carry on, or the origin to stay.
- **Sound:** the office and underwater soundscapes crossfade through every dive, surfacing and switch, instead of swapping at the glass.
- **Contact shadows:** soft baked shadows under the furniture, the tank's cabinet and the plants, and a gentle darkening along the base of the walls. They are one extra draw call, with no real-time shadow maps.
- **First visit:** after a few seconds in the office, a quiet hint ("Walk up to the tank and look into it to dive in") shows until you dive for the first time.
- **Frame time:** Settings → **Show frame time** adds a small readout of mean frame time, frame rate and 95th-percentile frame time, for checking performance on your own device. It is off by default.

See [validation](docs/VALIDATION_V03_PASS_022.md).

### v0.3 Pass 021 candidate — The Dive

Walk up to the tank and look at it: **E · Dive in** appears.

- **Diving in:** press E and you crouch to tank height, lean into the front glass, and keep going straight into the water. A brief teal wash and a burst of bubbles mark the moment you touch it, then you drift to the usual starting point as the haze thickens to underwater. The office's rain and clock give way to the underwater soundscape.
- **Surfacing:** near the surface, **E · Return to the office** brings you out through the glass and back on your feet in the room.
- **How it stays seamless:** the tank's glass already shows exactly what the aquarium camera sees from your position (Pass 020). The dive switches to the full aquarium a few centimetres from the glass, from the identical viewpoint, so you simply keep moving.
- **Reduced motion:** the glide becomes a short fade.
- **Eye height:** after the first playtest, the office eye height is 1.28 m (was 1.6 m, which felt too tall).
- **Steady swimming:** holding W now eases to one calm speed within about a second and stays there. It no longer keeps building, or surges with each stroke.
- **Coming to rest:** letting go glides you to a complete stop within a few seconds (Natural 2.5 s), like a person. The next stroke starts from rest again; pressing W mid-glide carries on smoothly.
- **The pause screen:** offered instant switching in Pass 021; Pass 022 makes it a calm fade.

See [the office architecture](docs/OFFICE.md#the-dive-pass-021) and [validation](docs/VALIDATION_V03_PASS_021.md).

### v0.3 Pass 020 candidate — The Office

The start screen now opens in a calm home office, generated entirely in code: a desk by a rain-streaked window, an office chair, a lamp, a bookshelf, plants, a rug, a framed ocean print and a wall clock that shows your local time. The office has its own gentle soundscape: rain on the window, a distant clock tick, and filter bubbling that rises as you approach the tank.

- **Walking:** choose **Enter the Office** to walk with W A S D and look around with the mouse. You walk at a fixed eye height and slide along the walls and furniture.
- **The aquarium:** it sits on its stand as a roughly 1 m tank, and the glass shows the real aquarium running live in miniature, fish and all. It is rendered cheaply: from the room, every fish, coral and rock uses its distance level.
- **Diving in:** **Enter the Water** dives straight in, as before. From the pause screen you can switch between the office and the water. Pass 021 adds the seamless dive from the tank.

See [the office architecture](docs/OFFICE.md) and [validation](docs/VALIDATION_V03_PASS_020.md).

### v0.2 Pass 019 candidate

Fixes from two MacBook playtests:

- **Seahorse:** 20% of its former size (about 22 cm). It clings with its tail to a thin branch up on its sea fan, facing out, rather than hugging the trunk.
- **Clownfish:** the pair is half its former size, joined by a juvenile at 10% of the former size.
- **Frogfish:** half its former size. It perches on top of a reef rock, seated on the visible stone and tinted to blend into the limestone.
- **Moray:** lives in a hole in a large reef rock. Its body stays hidden in the stone; its head rests out of the hole and pulls back in as you approach.
- **Shipwreck:** redesigned as a small sunken wooden boat. It has a plank hull with a pointed bow and transom, missing planks showing the ribs, sand drifted inside, and a snapped mast lying across the gunwale.
- **Filter:** the internal filter hangs in the top back corner with its body just under the waterline.
- **Swimming:** 40% slower than v0.2 rc.12 (default 1.68 m/s, maximum 3 m/s), with saved speeds moved onto the new scale. Idle bobbing is calmer: about 8 cm instead of 13 cm.
- **Texture pop-in:** gone. Every texture and per-object GPU resource is uploaded behind "Preparing aquarium details" before you enter, where 93 used to upload during the first swim.

The roadmap now follows the agreed sequence: v0.3 Office & Dive Transition, v0.4 Personalization, v0.5 Beyond the Glass, v0.6 Expanding Oceans. See [validation](docs/VALIDATION_V02_PASS_019.md).

### v0.2 Pass 018 candidate

Every embedded texture is now KTX2/Basis with a full mip chain, re-encoded from the original authoring maps, so textures stay block-compressed in GPU memory. Measured in software-rendered Chromium, resident texture memory for the loaded aquarium falls from about 83 MiB to about 21 MiB, and shipped models shrink from 17.3 MB to 14.5 MB. The Basis transcoder is served locally. See [validation](docs/VALIDATION_V02_PASS_018.md).

### v0.2 Pass 017 candidate

Fish beyond 14 body lengths switch to a morphing distance level (about 1.8k instead of 12.7k triangles), cutting the spawn view by 28%. Every shipped model is Draco-compressed with WebP textures, so the production startup download falls from about 53 MB to about 17 MB, with no visible change. The Draco decoder is served locally. See [validation](docs/VALIDATION_V02_PASS_017.md).

### v0.5 Pass 029 — The tank catalog

Discover corals and seagrass beyond the tank, then pause inside the aquarium and choose **For your tank**. Aim a preview at sand or rock, **R** turns, **F** places, and **Escape** cancels. Look at an addition to **G** move or **X** remove it. Additions save on this device and appear in the office miniature. Settings can restore the original tank after confirmation.
