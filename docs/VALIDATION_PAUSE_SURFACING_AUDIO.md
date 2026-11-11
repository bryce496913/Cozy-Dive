# Pause, surfacing and office audio fixes

The office miniature and both sides of a dive/surface transition now receive the application's active state. Losing pointer lock freezes the ecosystem's simulation and the office animation clock; hidden tabs also stop rendering. Paused views remain visible. Resuming continues the same simulation rather than reconstructing it.

The surfacing prompt and E action share a world-aware eligibility check. Only the aquarium can surface to the office, even when outer-water height overlaps the aquarium's surface band.

Office ambience keeps one gesture-created audio graph across visits. Pause, mute and zero volume fade out and suspend its context after 600 ms; hiding suspends immediately. Re-entry cancels a pending suspension, asynchronous resumes/suspends reconcile the latest desired state, and disposal clears lifecycle timers and closes the context. A destination's zero crossfade share keeps its unlocked context ready until the transition ends. Browser audio failures report blocked/unavailable status without crashing the application.

## Regression coverage

- `tests/dive.test.ts`: outer-water heights cannot surface.
- `tests/office-audio-lifecycle.test.ts`: silent preview, context reuse, pause/mute/volume fades, rapid re-entry, visibility, asynchronous lifecycle races, disposal and browser audio failures.
- `validation/dive-interrupt.mjs`: interrupted dives and surfacing before/after the space switch, resume/cancel, visibility, repeat cycles and reduced motion. Pause assertions inspect fish steps and plant/anemone/moray clocks as well as application time and camera position.
- `validation/runtime-fixes.mjs`: rendered office pause/resume with fish, plant and discovery clocks; real AudioContext suspension/resumption; E at a staged outer-water surface height. Pointer lock and keys are real; visibility is simulated with a visibility event and positions are staged.

Run the browser scripts against a local Vite server with Playwright and Chromium configured through `COZY_PLAYWRIGHT`, `COZY_CHROMIUM` and `COZY_URL`. The interruption harness accepts `COZY_CYCLES` (default 5). Both use a 480 × 320 viewport to keep software-rendered regression runs practical. These checks establish functional behavior, not laptop performance or cross-browser compatibility.

## Verification (2026-11-11)

Production build, benchmark build, standalone typecheck and all 451 unit tests (49 files, one worker) pass. A first unit run overlapped software rendering and hit existing five-second test deadlines; the clean run passed without changing timeouts.

The focused Chromium/SwiftShader browser harness passed with real rendering and input: office clocks froze, resumed fish advanced, pause/visibility suspended the real AudioContext, visible paused office stayed silent until explicit re-entry, and outer-water E left the player underwater with no transition or surfacing prompt. No page errors occurred.

An additional state/input run of the interruption harness passed all eight before/after-switch × resume/cancel cases, hidden mid-surfacing, one repeat cycle and reduced-motion surfacing, including the new ecosystem-clock assertions. For that run only, draw calls were omitted after initial real rendering to avoid a SwiftShader command backlog; GPU resource stability and transition visuals are not established by that run. The committed interruption harness retains full rendering and GPU checks by default. An initial full-render interruption run was stopped because it was too slow on this software renderer.
