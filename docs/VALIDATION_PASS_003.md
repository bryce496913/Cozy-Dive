# v0.1 / Pass 003 validation

Validated November 5, 2026. Prior pass records remain historical; the user's macOS Pass 002 playtest informed this pass's scope.

## Project checks

- `npm run test`: **68 passed**, three files, none skipped.
- `npm run typecheck`: passed.
- `npm run lint`: passed, including Prettier.
- `npm run build`: passed; the existing Three.js bundle-size advisory remains.
- `git diff --check`: passed.

No new dependencies, runtime assets, scenery, rendering passes, or player-facing settings were introduced.

## Breathing measurements and regression coverage

A 60 FPS simulation measured steady-state Pass 002 Natural travel at **6.640 cm peak-to-peak** after thirty seconds of settling. With the existing 1.6/s² spring, 2.4/s damping, and five-second forcing frequency, the oscillator is near its stiffness resonance and damping dominates the response. Those coefficients and the vertical coasting endpoint remain unchanged. A moderate 40% force increase yields approximately **9.296 cm** steady-state travel in Natural; Relaxed/Responsive retain their ratios (approximately 6.508 / 5.578 cm). The browser measured **9.339 cm** of camera travel during eleven simulation seconds including the smooth startup transient.

Tests measure Natural travel between 8.5 and 10.5 cm at 30, 60, and 120 FPS and constrain peak vertical velocity. Ten-minute simulations at each rate check bounded depth and cycle-to-cycle stability. Additional coverage verifies swimming-to-hover continuity, intentional vertical suppression, neutral-depth updates, reduced motion, floor/surface fading, invalid/long deltas, and pause/resume without a discontinuity. Existing kick/glide, direction, settings migration/storage, and aquarium-boundary tests remain passing.

## Collision tests

- Swept rock detection with nonzero velocity and a displacement crossing an entire obstacle.
- Tangential sliding without clearing other velocity components.
- Both ascent and descent against exposed obstacle faces.
- Repeated contact stability and reversal away from a rock.
- Corners, intersecting hulls, and local recovery from initial overlaps.
- Combined scenery and aquarium-wall constraints.
- Unchanged open-water simulation with collision enabled away from obstacles.
- Sliding/contact consistency at 30/60/120 FPS.
- Hovering above a rock, preserving breathing clocks and neutral depth, and pause/resume in contact.
- Two independently generated aquariums produce identical 34-rock hull data; hull planes contain the corresponding transformed render vertices and spawn is free.
- The existing seed still produces 89 rocks: 34 collidable major rocks and 55 decorative pebbles. Current leaf-only foliage registers no collider.
- Long routes through both actual rocky banks remain outside all hulls and within aquarium bounds; the sand channel stays traversable.

## Browser checks actually run

System Chromium with Playwright and SwiftShader software WebGL, 1200 × 800 viewport. A test-only intercepted module response exposes the application instance; no debug API or browser harness is shipped. Real keyboard, mouse, pointer-lock, and settings events drive gameplay. The test places the player beside an actual generated rock to reach contact promptly, then samples collision clearance while real movement input drives blocking and sliding.

The completed run passed:

- WebGL scenery render at spawn; screenshot visually inspected.
- No mouse capture on load; entry/resume require explicit button clicks.
- Swimming preset saved through a real refresh.
- W propulsion, coasting with decreasing velocity, mouse-look, and zero roll.
- Multiple strokes toward a generated rock without sampled hull penetration, followed by tangential sliding with combined W/D input.
- Escape freezes the entire movement state; resume clears held forward input.
- Space ascent beside the rock.
- Visible physical camera breathing in clear water, measured at 9.339 cm peak-to-peak.
- Reduced motion suppresses stationary buoyancy after resuming at the current depth.
- No captured console errors or uncaught page exceptions.

The final clear-water view rendered 166 calls and 17,078 triangles. This is a functional software-renderer observation, not a hardware performance claim. Browser collision sampling supplements, rather than replaces, the deterministic substep tests; all six approach directions/limits are not individually traversed in the browser.

## Lightweight CPU measurement

An uncommitted diagnostic used the generated aquarium and 10,000 simulated 60 FPS frames per measured variant, after warm-up. In this execution environment, swimming without scenery collision averaged **0.00895 ms/frame**; with the 34-hull collision world it averaged **0.02779 ms/frame**, approximately **0.01884 ms/frame** extra. The route repeatedly crossed a rocky bank, with position reset every 240 frames. This isolates CPU movement work, excludes rendering and initialization, and is not a benchmark for ordinary laptops, GPU frame rates, battery usage, or worst-case initial-overlap recovery.

## Manual macOS follow-up and limitations

Use the macOS checklist in `PR_DESCRIPTION.md` and README to assess extended comfort, noticeable breathing, rock/foliage clearance, dense overlapping formations, boundary contact, and preserved movement feel. Repeat on a hardware GPU and target browsers. Safari, Firefox, and Edge were not run in this pass.

Collisions are static convex approximations with conservative corner margins and a bounded contact budget. Initial-overlap recovery is an exceptional local correction, not a normal movement mechanism. Leaves/pebbles remain passable; sand uses the existing floor clearance. Future transformed environment roots or moving scenery require updated collider transforms. No full rigid-body dynamics or plant deformation is implemented.
