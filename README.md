# Cozy Diver

A quiet little world beneath the surface. **v0.1 / Pass 002 — Natural Swimming** is a first-person, browser-based aquarium prototype: swim at your own pace through sand, rocks, plants, and soft blue-green water. No scores, timers, combat, accounts, or external assets.

## Stack and requirements

Vite, strict TypeScript, Three.js, Vitest, ESLint, and Prettier. Use Node.js **22.12+** (Node 24 was used for this pass), npm, and a modern desktop browser with WebGL and pointer lock enabled. No backend, API keys, or services are needed. Chrome, Firefox, Safari, and Edge are the intended targets; see the validation record for browsers actually tested.

## Get started

```bash
npm install
npm run dev
```

Open the address printed by Vite. Click **Enter the Water** to give the canvas mouse capture. Escape pauses swimming and shows the resume overlay. Settings are accessible before entering or while paused.

For an existing lockfile in CI or a clean checkout, use `npm ci`.

| Command             | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the development server               |
| `npm run build`     | Typecheck and produce `dist/`              |
| `npm run preview`   | Serve the production build locally         |
| `npm run test`      | Run the unit tests once                    |
| `npm run typecheck` | Check strict TypeScript types              |
| `npm run lint`      | Check ESLint rules and Prettier formatting |
| `npm run format`    | Apply Prettier formatting                  |

Vite binds to all interfaces for cloud development; use `npm run dev -- --host 127.0.0.1` to restrict it to your own machine. Deployment is a static `dist/` directory; no server-side application is required.

## Swimming controls

| Input      | Action                                     |
| ---------- | ------------------------------------------ |
| W / S      | Swim forward / backward along your view    |
| A / D      | Strafe left / right                        |
| Mouse      | Look around                                |
| Space      | Swim upward, relative to the water surface |
| Left Shift | Swim downward                              |
| Escape     | Release mouse capture and pause            |

Click **Return to the Water** to resume. Pausing or losing browser focus clears held keys and momentum, so resuming cannot cause a sudden lurch. Diagonal input is normalized. Subtle stroke-related pitch feedback stays below 0.07 degrees, with no roll or visual position offsets. Looking straight up/down is limited.

## Current features

- Seeded procedural aquarium with rippled sand, embedded rocks, planted banks, and visible glass seams.
- Gentle plant sway, suspended particles, translucent light shafts, hemisphere and surface lighting, and distance fog.
- First-person swimming with smooth kick-and-glide propulsion, weighted direction changes, progressive water drag, and damped breathing buoyancy. Bounded 1/240-second steps sample forces and integrate linear drag analytically; long frame gaps are capped at 100 ms.
- A safe starting position and configurable clearance from the floor, surface, and all four walls.
- Pointer lock only following an explicit button click. Escape, loss of focus, and hidden tabs pause controls.
- Mouse sensitivity, movement speed, swimming feel, and reduced-motion preferences saved locally. Storage failure falls back to session settings. System reduced-motion preference is respected on first visit; the option uses direct mouse-look and freezes ambient sway.
- Responsive canvas, device pixel ratio capped at 1.75, and messages for unavailable WebGL, lost graphics context, or denied pointer lock.
- Explicit cleanup of listeners, animation frames, geometries, materials, renderer, and DOM on disposal / hot reload.

## Architecture

```text
src/
  app/          Application lifecycle, animation loop, system coordination
  config/       Aquarium dimensions, spawn, and movement tuning
  controls/     Pointer lock, keyboard, and smoothed yaw/pitch
  environment/  Deterministic procedural scenery and ambient animation
  player/       Pure movement direction, drag, integration, and bounds logic
  rendering/    Renderer, camera, fog, lighting, and resize lifecycle
  ui/           Welcome/pause HUD, controls, storage, settings validation
```

`Application` owns and disposes the systems. `Aquarium` owns its generated resources. The environment root is a Three.js group so future environment loaders can replace it without changing movement. Physics and settings have no dependency on the renderer and are tested in Node. Mouse deltas describe displacement and are not multiplied by frame time; look smoothing uses an exponential, delta-time-based blend. Movement follows the same yaw/pitch convention as the camera.

Tune aquarium dimensions, clearance, and all physical/feedback parameters in `src/config/world.ts`; speed defaults/ranges and preset validation live in `src/ui/settings.ts`. Keep seabed variation below the floor clearance. Camera FOV and pixel ratio live in `src/rendering/UnderwaterScene.ts`.

## Swimming physics and tuning

Holding a horizontal movement key repeats an active stroke followed by a glide. A squared-sine envelope builds and fades the propulsion **force**, which is filtered before integration; velocity and position are never multiplied by a wave. A small baseline thrust softens the rhythm. Releasing input cuts thrust while velocity decays under water drag, settling tiny horizontal residuals to zero. Direction changes redirect the filtered force without resetting velocity. Diagonal normalization and pitch-relative forward movement are preserved; intentional vertical movement uses continuous thrust for control.

Choose **Relaxed**, **Natural** (default), or **Responsive** in Settings. Existing v1 storage remains valid; missing/invalid feel values become Natural without losing other preferences. Speed is a nominal average horizontal speed: instantaneous speed varies across the stroke.

| Preset     | Cycle (s) | Active fraction | Drag (1/s) | Force response (1/s) | Rhythmic fraction | Breathing force (m/s²) |
| ---------- | --------- | --------------- | ---------- | -------------------- | ----------------- | ---------------------- |
| Relaxed    | 1.4       | 0.35            | 0.8        | 5                    | 0.85              | 0.07                   |
| Natural    | 1.1       | 0.45            | 1.1        | 8                    | 0.75              | 0.10                   |
| Responsive | 0.8       | 0.50            | 1.8        | 12                   | 0.30              | 0.06                   |

The independent five-second breathing force acts around a neutral depth with a 1.6/s² restoring spring and 2.4/s vertical damping. Natural hovering displacement is only a few centimeters. Intentional depth changes suppress breathing and move the neutral depth toward the projected coasting endpoint; release settles naturally there. Buoyancy fades within 25 cm of floor/surface, preventing repeated contact and boundary-induced drift. All integrated motion respects the existing clearance and outward-velocity cancellation.

`SwimState.position` and `velocity` are authoritative physical state. `thrust` is the filtered propulsion acceleration; stroke/breath timers are independent and bounded. `neutralDepth` anchors buoyancy. `bodyPitch` is optional visual feedback only: it never changes position, velocity, collision, or input direction. No camera position offset is added. Future animation/audio/body systems can read stroke time, thrust, and breath time without owning movement or advancing its clocks.

Reduced motion suppresses breathing force and visual pitch feedback while keeping smooth propulsion/inertia, direct mouse-look, and the existing frozen ambient motion. Enabling it during a breath allows the physical spring/damping to settle naturally. Pause/lock loss and visibility changes clear held inputs, velocities, forces, and rhythm state, reset neutral depth to the current position, and restart with a zero frame delta. Simulation and scene animation clocks do not advance while paused.

For later tuning, adjust cadence/active fraction together, then drag/force response for glide and control. Reduce rhythmic fraction for steadier speed; lower breathing force or visual pitch for comfort. Subjective comfort and laptop GPU performance still need human playtesting.

## Validation and manual testing

See [the Pass 002 validation record](docs/VALIDATION_PASS_002.md) and [historical Pass 001 results](docs/VALIDATION.md) for executed checks, screenshots, and practical limits. Unit tests cover movement direction, diagonal normalization, pitch-relative forward movement, vertical movement, acceleration, drag, frame-rate equivalence, frame-gap protection, all six boundaries, valid spawn, and settings validation/storage.

To test manually:

1. Run the dev server and confirm sand, rocks, plants, fog, and light shafts render without errors.
2. Open Settings; change sensitivity/speed/reduced motion, refresh, and confirm the preferences persist.
3. Enter the water. Check every movement key, including combinations. Release keys to feel drag.
4. Look left/right/up/down: motion should follow the mouse, stop short of a vertical flip, and never roll. Forward swimming should follow your view.
5. Hold Space to the surface and Shift to the floor; swim toward every glass wall. The camera must remain inside with clearance.
6. Press Escape while moving. Verify movement stops, then resume. Repeat after switching tabs or browser focus.
7. Compare all three feel presets: hold W through several strokes, release to coast, and reverse direction repeatedly. There should be no full stops between strokes or sudden reversals.
8. Hover for several breathing cycles, then ascend/descend and release. Verify subtle bounded breathing at the new depth. Repeat within 25 cm of floor/surface and with combined diagonal input against glass.
9. Enable reduced motion and confirm breathing/sway stop while propulsion remains smooth. Pause near a boundary, wait, resume without held keys, and repeat after focus/tab loss.
10. Resize the browser and check canvas proportions and UI. Test a fresh visit with WebGL disabled to inspect the fallback message.

## Known limitations

- Desktop keyboard/mouse only; mobile touch controls are outside this pass.
- Rocks and plants are scenery without collision; only the aquarium volume constrains the player.
- No office, fish AI, passages, customization, ocean, sound, or progression yet.
- Sand and light shafts are intentionally simple; this is a procedural first prototype, not final art. The water surface is a visual plane, not a fluid simulation.
- Player position is not persisted. Only settings are saved, per origin in browser local storage.
- Pointer lock may be restricted by embedded frames or browser policies; use a top-level page. Graphics-context loss requires reloading.
- The build reports a bundle-size advisory for Three.js (about 140 KB gzip in this pass). No runtime asset downloads are needed.
- Browser coverage and performance claims are limited to the actual results in the validation record. Software-rendered Chromium does not establish ordinary-laptop GPU performance.

The [roadmap](docs/ROADMAP.md) is provisional; future passes should preserve the quiet, low-pressure experience.
