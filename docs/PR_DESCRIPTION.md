# Natural swimming, breathing, and buoyancy — v0.1 Pass 002

Holding a movement key now produces smooth kicks and recognizable glides instead of continuously chasing a fixed speed. Releasing input preserves momentum; direction changes redirect filtered propulsion without an impulse. Existing controls, aquarium layout, mouse-look, pointer lock, and v1 preferences remain supported.

## Physics and breathing

- A C1 squared-sine stroke envelope drives acceleration, with a small baseline thrust and exponential force response. Linear water drag integrates velocity and displacement analytically per bounded step (at most 1/240 second, capped at 100 ms per frame). Horizontal residual velocities below 0.001 m/s settle to zero.
- Five-second breathing adds a small periodic buoyancy force around a damped neutral-depth spring, independent of stroke timing. Intentional ascent/descent suppresses breathing and updates neutral depth to the projected coasting endpoint. Buoyancy fades near floor/surface to prevent repeated contact and drift.
- Physical position/velocity own bounds checking. Optional filtered pitch feedback is below 0.07 degrees, with no visual position offsets or roll. Reduced motion suppresses breathing and visual feedback while preserving propulsion/inertia.
- Pause/visibility/lock changes clear held input, force, momentum, and rhythm clocks; the next frame starts with zero delta. Visual pitch freezes during pause and eases on resume.

## Default tuning

Natural: 1.1-second stroke cycle, 45% active, drag 1.1/s, force response 8/s, rhythmic fraction 0.75, breathing force 0.10 m/s². Nominal horizontal speed remains 2.8 m/s. Vertical speed is 80% of nominal, vertical damping 2.4/s, hover stiffness 1.6/s², and breathing cycle five seconds. Breathing fades within 25 cm of the vertical limits.

Relaxed uses a 1.4-second cycle, 35% active, drag 0.8/s, and gentler force response/breathing. Responsive uses 0.8 seconds, 50% active, drag 1.8/s, faster force response, and a reduced rhythmic fraction. All physical tuning is centralized in `src/config/world.ts`. Settings add one accessible preset selector and keep the existing local-storage key; old/invalid feel values default to Natural.

## Validation

See `docs/VALIDATION_PASS_002.md` for executed results and browser limitations. Automated simulations cover smooth stroke timing, gliding, release/coasting, reversals, long-term buoyancy stability, neutral-depth changes, combined vertical input, all bounds, reduced motion, settings migration, lifecycle reset, and 30/60/120 FPS consistency.

## Manual testing checklist

- [ ] Compare all presets on a hardware GPU; hold W for several strokes and release to coast.
- [ ] Reverse/strafe repeatedly; check weighted movement and prompt mouse-look.
- [ ] Hover for several five-second breaths; verify bounded depth without cumulative drift.
- [ ] Ascend/descend and release; settle naturally at the new depth.
- [ ] Swim continuously into each glass wall and repeat strokes there.
- [ ] Hover near floor/surface; check for vibration, clipping, and sharp corrections.
- [ ] Combine forward/ascent and descent/direction changes near boundaries.
- [ ] Pause/resume near limits; switch focus/tabs and confirm cleared inputs and no jumps.
- [ ] Toggle reduced motion and reload; check saved speed/sensitivity/feel and comfort.
- [ ] Repeat in macOS Safari, Firefox, and Edge; assess subjective comfort over an extended session.

## Limitations and future tuning

No diver body, animation, audio, equipment/air simulation, scenery collision, or new environments. This is lightweight gameplay physics, not a scientific diving simulation. Hardware-GPU performance, cross-browser coverage, and subjective comfort require human playtesting. Tune cadence/active fraction first, drag/force response for stopping distance next, and rhythmic fraction/breathing force/visual pitch for comfort. Future body/audio animation can consume stroke time, thrust, and breathing time without advancing physics clocks.

Do not merge automatically.
