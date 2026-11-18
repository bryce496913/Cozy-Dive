# v0.6 — Pass 046 review fixes (`0.6.0-rc.8`)

Date: November 17, 2026. From the code review after Pass 046. No merge or release is authorized by this note.

## Lifecycle: nothing changes a world once it is let go

- **The sea cave:** it added its visitors, flashlight-fish lights and their sightings after its creatures loaded, but before checking that it had not been disposed. It now checks first.
- **All four outer worlds:** each checks immediately after every wait.
- **Creature systems:**
  - each checks after each model arrives;
  - the kelp forest's visitors now track bodies still loading, so a body that finishes after the forest is let go is disposed and releases its model.
- **Tests** (`tests/lifecycle-dispose.test.ts`, with a loader whose models arrive only when told):
  - each creature system (reef life, barracuda, kelp visitors, sea lion, cave visitors, resting sharks), and three whole worlds (kelp forest, sea cave, under the ice), are disposed while their models are loading; nothing is added afterwards and every model is released;
  - each also loads normally and releases everything when disposed after.
  - `AssetLoader.leased` counts held leases for this.

## Preparation states

- **`WorldPreparation`:** each outer world is `loading`, then one of:
  - `ready`, every part loaded;
  - `partial`, swimmable with failed parts left out;
  - `failed`, its preparation itself failed and it is swimmable without its life;
  - `disposed`, for good.
- **Parts:** each part's state is recorded, and a late result never changes a disposed world.
- **What is used:** sightings and scene objects come only from parts that loaded. The schools always show, since they fall back to simple fish.

## Frame time: building worlds a piece per frame

- **Measured first.** Building a world in one go took (Node, V8, models not included):
  - kelp forest: 270–425 ms;
  - sea cave: 180–270 ms;
  - under the ice: 160–200 ms.
    The environment builds dominated, at 100–140 ms each.
- **Changes:**
  - **Staged builds:** the kelp forest, sea cave and under the ice now build via `static build()`, one piece per frame (`StagedBuild`): environment, kelp, dressing, light, grotto, the scene. Each piece is timed (`buildStats`), and the build stops and disposes what it built if no longer wanted.
  - **Creature systems:** set up one per frame too.
  - **The application:** builds through `buildWorld()` and keeps `buildTimes` per world. The outer reef's synchronous construction is timed as well.
  - **Rock shapes:** `rockShape()` generates each procedural rock shape once and copies it (each took 1–2 ms).
- **Result (Node, cold, first build):** the worst single frame is now:
  - kelp forest: 190 ms (was about 395);
  - sea cave: 161 ms (was 266);
  - under the ice: 141 ms (was 149).
- **What remains:** the environment pieces are still the longest. Splitting them internally is the next step if play shows a stutter. Real-browser and real-GPU timing is unmeasured until the long run.

## Memory and long sessions

- **`validation/long-session.mjs`:** two loops of tank → outer reef → kelp forest → sea cave → under the ice and back. Each loop pauses and resumes, uses "Return to the tank", and releases everything. It records each world's GPU geometry and texture counts and build times, and checks:
  - per-world and all-worlds budgets;
  - a return to the tank's counts after each release, with no growth between loops;
  - preparation states;
  - no page errors.
- **Budgets:** first estimates, to be confirmed on the first run.

## Not done here

- **Full browser regression and long-session run:** stopped at your request, to run together tonight.
- **A `WorldManager`:** deferred, as the review advises, until these fixes have settled.

## Checks

typecheck, lint and build pass; `npm run test`: 632 passing.
