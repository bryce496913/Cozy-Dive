# Cozy Diver

A quiet little world beneath the surface. **v0.1 / First Dive** is a first-person, browser-based aquarium prototype: swim at your own pace through sand, rocks, plants, and soft blue-green water. No scores, timers, combat, accounts, or external assets.

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

Click **Return to the Water** to resume. Pausing or losing browser focus clears held keys and momentum, so resuming cannot cause a sudden lurch. Diagonal input is normalized. There is no camera bob or roll, and looking straight up/down is limited.

## Current features

- Seeded procedural aquarium with rippled sand, embedded rocks, planted banks, and visible glass seams.
- Gentle plant sway, suspended particles, translucent light shafts, hemisphere and surface lighting, and distance fog.
- First-person 3D swimming with configurable speed, acceleration, and drag. Exact exponential velocity integration keeps acceleration and displacement consistent across frame rates. Long frame gaps are capped at 100 ms.
- A safe starting position and configurable clearance from the floor, surface, and all four walls.
- Pointer lock only following an explicit button click. Escape, loss of focus, and hidden tabs pause controls.
- Mouse sensitivity, movement speed, and reduced-motion preferences saved locally. Storage failure falls back to session settings. System reduced-motion preference is respected on first visit; the option uses direct mouse-look and freezes ambient sway.
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

Tune aquarium dimensions and clearance in `src/config/world.ts`; movement acceleration/damping there and speed defaults/ranges in `src/ui/settings.ts`. Keep seabed variation below the floor clearance. Camera FOV and pixel ratio live in `src/rendering/UnderwaterScene.ts`.

## Validation and manual testing

See [the pass validation record](docs/VALIDATION.md) for executed checks, screenshots, and practical limits. Unit tests cover movement direction, diagonal normalization, pitch-relative forward movement, vertical movement, acceleration, drag, frame-rate equivalence, frame-gap protection, all six boundaries, valid spawn, and settings validation/storage.

To test manually:

1. Run the dev server and confirm sand, rocks, plants, fog, and light shafts render without errors.
2. Open Settings; change sensitivity/speed/reduced motion, refresh, and confirm the preferences persist.
3. Enter the water. Check every movement key, including combinations. Release keys to feel drag.
4. Look left/right/up/down: motion should follow the mouse, stop short of a vertical flip, and never roll. Forward swimming should follow your view.
5. Hold Space to the surface and Shift to the floor; swim toward every glass wall. The camera must remain inside with clearance.
6. Press Escape while moving. Verify movement stops, then resume. Repeat after switching tabs or browser focus.
7. Resize the browser and check canvas proportions and UI. Test a fresh visit with WebGL disabled to inspect the fallback message.

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
