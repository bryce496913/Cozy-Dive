# v0.1 Pass 003 — Breathing buoyancy polish and environmental collision

Stationary hovering now has a more visible, restrained five-second breath, and the 34 major aquarium rocks block the player with sliding contacts. Existing kick-and-glide propulsion, controls, presets, settings, scene layout, and pause behavior are preserved.

## Breathing tuning

Measured Pass 002 Natural hovering at **6.64 cm peak-to-peak**. Its five-second force frequency is already near the hover spring's natural frequency; damping dominates the response, so lowering stiffness would add little displacement and risk changing depth settling. Keep the spring (1.6/s²), vertical damping (2.4/s), vertical speed, and projected neutral-depth endpoint unchanged. Increase buoyancy force moderately by 40%: Natural **0.10 → 0.14 m/s²**, Relaxed **0.07 → 0.098**, Responsive **0.06 → 0.084**.

Natural now hovers at approximately **9.30 cm peak-to-peak** in clear water, within the requested 5–12 cm target. Relaxed/Responsive remain relatively gentler. All values stay in `src/config/world.ts`; reduced motion, boundary fade, independent breathing timing, and suppression during intentional vertical movement remain intact. No new visible settings are added.

## Collision strategy

- A 28 cm player sphere sweeps against convex rock hulls derived once from the actual rendered vertices and transforms. The 34 substantial rocks register hulls; scenery positions and random sequence are unchanged.
- Thin seagrass/leaves and the 55 small decorative pebbles remain passable. No current plant has a thick structural stem/base requiring a collider.
- A pure TypeScript collision module handles earliest contacts, inward-velocity removal, and tangential sliding after each bounded physics substep. Aquarium walls participate in the same sweep to prevent sliding through glass.
- Multiple contact normals constrain corners and overlapping formations; initial penetration recovery finds a local free exit from the connected union. Contact leaves propulsion forces, neutral depth, and breathing clocks intact.
- Bounding-box rejection and reusable contact storage keep normal steps lightweight. No physics library, new render pass, or animation system is added.

## Validation

See `docs/VALIDATION_PASS_003.md` for executed project checks, displacement measurements, browser results, and performance limits. Tests cover ten-minute breathing stability at 30/60/120 FPS, visible amplitude, transitions, boundaries, real generated hull geometry and spawn safety, sweeping/sliding, vertical contact, corners/overlaps, contact stability/reversal, frame-rate consistency, real-bank routes, and pause/resume regressions.

## Manual macOS playtest checklist

- [ ] Hover through several breaths in Natural; expect slow ±4–5 cm movement without bobbing or depth drift.
- [ ] Compare Relaxed/Responsive; check reduced motion suppresses buoyancy and optional sway.
- [ ] Swim, release, reverse, strafe, and change depth; confirm Pass 002's feel is preserved.
- [ ] Approach large rocks from every direction, including ascent/descent and diagonals.
- [ ] Hold input against a rock for multiple strokes; slide along its face, then reverse away.
- [ ] Check overlapping banks, narrow gaps, and rocks beside glass for trapping/jitter.
- [ ] Hover near a rock top, floor, and surface; check clearance and continuous motion.
- [ ] Swim through seagrass and decorative pebbles; confirm no invisible foliage barriers.
- [ ] Pause/resume in contact; switch tabs/focus; confirm no retained keys or camera jumps.
- [ ] Reload and verify speed, sensitivity, presets, and reduced-motion preferences.
- [ ] Assess hardware-GPU performance and extended comfort on macOS; repeat in target browsers.

## Remaining limitations

Static convex collision only: sphere expansion uses conservative face offsets with a small extra margin around sharp corners. Thin foliage and decorative pebbles remain passable; sand relies on floor clearance. The environment root must remain untransformed; future moving scenery needs collider updates. An eight-contact budget conservatively discards unresolved displacement in unusually complex contact arrangements. No diver model, audio, plant deformation, or rigid-body physics. Software-rendered Chromium and CPU measurements do not establish macOS GPU performance, cross-browser compatibility, or subjective comfort.

Do not merge automatically.
