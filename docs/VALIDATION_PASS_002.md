# v0.1 / Pass 002 validation

Validated November 5, 2026. Pass 001 results remain in `VALIDATION.md`; they are historical, not new cross-browser claims.

## Automated checks

- `npm run test`: **47 passed** across two files, none skipped.
- `npm run typecheck`: passed.
- `npm run lint`: passed (ESLint and Prettier).
- `npm run build`: passed. The existing Three.js chunk advisory remains (about 562 KB minified / 142 KB gzip); no dependencies or rendering passes were added.
- `git diff --check`: passed.

Tests cover movement directions/diagonals, bounded smooth stroke envelopes and timing, repeated kicks/glides without full stops, gradual release/coasting, reversal inertia, nominal speed/preset behavior, frame-gap protection, invalid deltas, and authoritative bounds/outward velocity cancellation. Breathing is simulated for ten minutes at each of 30, 60, and 120 FPS, checking bounded displacement and cycle-to-cycle stability without cumulative drift. Mixed horizontal/vertical movement followed by sixty seconds of hovering also agrees across those rates with numerical tolerances. Additional checks cover new neutral-depth settling after ascent/descent, suppression during intentional depth changes, floor/surface breathing, reduced motion, combined input against boundaries, pause/resume reset, and old/corrupt/unavailable settings storage.

The old exact constant-target-speed assertion was replaced with rhythmic-speed bounds, and frame-rate comparisons now use numerical tolerances appropriate to sampled time-varying forces. Existing direction, bounds, storage failure, and input conventions remain covered.

## Browser validation

Browser checks use system Chromium with Playwright and SwiftShader software WebGL at 1200 × 800. Test-only response interception exposes the application instance for assertions; no production debug API or browser-test dependency is added. Real pointer-lock, keyboard, mouse, and settings UI events drive gameplay. Near-boundary state placement accelerates collision checks; it does not substitute for real input or pure long-duration bounds tests.

Initial launch/server attempts were blocked by sandbox socket restrictions and were rerun with the permitted local runner. A development hot reload interrupted one run; another exposed a harness synchronization issue around pointer-lock events. These attempts are not counted as passing gameplay runs.

The completed browser run passed:

- WebGL render and explicit pointer-lock entry.
- Swimming-feel/reduced-motion preferences persisted through refresh.
- Stationary breathing, W propulsion, continued coasting with decreasing velocity.
- Actual mouse movement, zero camera roll, and intentional Space ascent.
- Escape froze the complete movement state; resume cleared held inputs.
- Combined W/D/Space input near the glass/surface stayed within bounds.
- Reduced motion suppressed stationary buoyancy after resume.
- No captured console errors or uncaught page exceptions.

A screenshot from the paused near-surface view was inspected. No new scenery or GPU-image equality assertions were introduced. Browser checks directly exercised the upper/corner boundary; all six limits and lower-bound breathing were exercised by the longer pure simulations. Full subjective and cross-browser checks remain pending.

## Manual checks still required

Use the checklist in `PR_DESCRIPTION.md` and the README to assess subjective rhythm, comfort, and stopping distance, especially over extended sessions. Repeat on a hardware GPU and macOS Safari, Firefox, and Edge. Software Chromium checks do not establish hardware frame rates, laptop battery/performance, or cross-browser compatibility. Scenery still has no collision; only the aquarium volume constrains the diver.
