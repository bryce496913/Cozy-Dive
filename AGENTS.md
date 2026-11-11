# Working on Cozy Diver

## Vision and scope

Build a peaceful browser aquarium for relaxing exploration: enjoyable swimming, inviting scenery, no pressure. The office and the dive are done (v0.3). v0.4 adds a hidden passage from the tank into larger outer waters; v0.5 lets the player personalize the tank. Follow the requested pass; do not add quests, combat, accounts, backends, multiplayer, or unrequested frameworks. The one agreed form of progression is gentle discovery: things seen in the outer waters unlock for the tank, with no counters, currency, timers, scores or anything to lose. Use code-generated scenery and local assets; never depend on externally hosted runtime assets.

## Architecture conventions

- Keep `app/` focused on lifecycle and orchestration; no scene generation or settings markup there.
- Put procedural scenery and its disposal in `environment/`, renderer/camera/lighting in `rendering/`, and input capture in `controls/`.
- Keep swimming and settings logic independently testable without WebGL. Share configuration through `config/` rather than duplicating dimensions or spawn positions.
- Retain an environment-owned scene root. New environment loaders, fish entities, interactions, or customization should have explicit interfaces and lifecycles when introduced in later passes.
- Each system must own and clean up its listeners, GPU objects, animation callbacks, and DOM. Shared geometry/material ownership must avoid repeated disposal.
- Avoid per-frame object allocations, costly postprocessing, and unnecessary draw calls. Profile before adding heavy effects. Keep the pixel ratio capped.

## Coding standards

Use strict TypeScript with clear interfaces; no `any` or unexplained casts. Prefer small cohesive modules and named tuning values. Use npm and commit its lockfile. Run `npm run format` after edits; ESLint and Prettier are enforced by `npm run lint`.

Use seconds for movement time. Camera forward is -Z, positive yaw looks left, positive pitch looks up. Mouse event displacement is not a velocity: do not multiply it by delta time. Normalize combined movement, cap long frame gaps, keep yaw/pitch free of roll, and maintain clearance from all six aquarium boundaries. Never request pointer lock on load; use explicit player action. Pause on lock loss and clear held input.

Settings are local-only and must tolerate absent/corrupt/unavailable storage. Respect reduced-motion preferences. Keep UI unobtrusive and keyboard accessible; surface initialization and pointer-lock failures clearly.

## Testing expectations

Before completing a pass run:

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```

Extend meaningful tests for new behavior. Prefer pure logic tests for simulation, bounds, input direction, and settings. Test frame-rate consistency and nontrivial boundary cases. Never replace gameplay validation with GPU screenshot equality tests or claim browser behavior based only on unit tests. If browser tooling is available, exercise actual rendering, pointer lock, key input, pause/resume, and preferences. Record browser/renderer limits honestly. Do not claim cross-browser or laptop performance without measuring it.

## Future Codex passes

Use the existing isolated checkout; do not create worktrees unless explicitly requested. Inspect status and preserve user changes. Work on the dedicated requested branch, never merge into main without authorization. Keep each pass reviewable, document architectural choices and known limitations, and update the provisional roadmap only when scope changes are agreed. If an empty repository lacks a PR base, report that blocker rather than creating main against the user's instructions.
