# v0.5 Pass 031 — Polish and acceptance

Validation date: November 14, 2026. Release candidate `0.5.0-rc.1` for v0.5 (Personalization), for user review. No merge, release or tag is authorized by this report. v0.5 closes on the user's macOS acceptance. v0.4 also remains open at `0.4.0-rc.3`, so one Mac play-through can accept both.

**Limits of this evidence.** All browser evidence is Linux Chromium with SwiftShader software rendering, in a four-core container, with long harnesses at `COZY_DPR=0.5`. That reduces raster size only; scenes, controls and assertions are unchanged. Nothing here measures MacBook Air frame time, Safari, or how placing and watching the babies feels.

## 1. What v0.5 contains

| Pass                        | What it added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 029 — The tank catalog      | Corals (boulder, branching, plate, soft, sea fans) and seagrass seen in the outer waters unlock under **For your tank**. Unseen items do not appear. Placing happens while swimming in the tank: a translucent preview, **R** to turn, **F** to place, **G** to move, **X** to remove, and a quiet note at 20 items. Items keep clear of the glass, the channel, the crevice, creature homes and the tested swim routes. Saved locally, with a confirmed **Restore the original tank** in Settings. |
| 030 — Baby animals          | A blacktip pup, a baby eagle ray and a turtle hatchling, one of each, unlocked by seeing the adults. Each is a miniature of the existing model, with calm, body-aware routes around the reef and your additions. They give you room, freeze on pause, are saved with the tank and appear in the office miniature.                                                                                                                                                                                   |
| 031 — Polish and acceptance | A review of Passes 029–030, the fixes below, a full regression and this release candidate.                                                                                                                                                                                                                                                                                                                                                                                                          |

## 2. Code review of Pass 030, and the fixes

The review covered the baby simulation, navigation, model leasing, fish personal space, the scene integration, saving and disposal.

**Sound as it stands**

- **Model leases:** they clone the hierarchy per animal and share only geometry and textures. A baby's material swap therefore cannot affect the outer reef's adults. Release detaches the clone without disposing shared materials.
- **Fish personal space:** around the babies it uses a swept check that lets a fish leave an overlap, never trapping it, with no per-frame allocation.
- **Lifecycle:** the scene creates the babies on demand and disposes them once. Version 1 tank saves migrate, and corrupt or unavailable storage is tolerated.

**Fixed: a periodic stutter whenever a baby planned a route.**

- **Measured:** five simulated minutes with all three babies and 20 placed items in the production habitat. Almost every step cost 0.03 ms, but whenever a baby planned a new route, the step spiked to 8–12 ms, about once every six seconds. On a 16.7 ms frame that shows as a hitch. Adding all three babies took 87 ms.
- **Cause:** before each search, finding the start and goal cells scanned all 26,730 grid cells (up to 20 ms). The search itself was cheaper.
- **Fix, nearest cell:** the nearest free cell is now found by searching outward from the point, shell by shell, stopping once no further shell could be nearer. A new test proves it returns exactly the full scan's cell, ties included, at 300 points inside and outside the grid, with and without the reachability requirement.
- **Fix, search:** the search advances at most 60 nodes per fixed step (`PLAN_BUDGET`), and the baby coasts gently, with clearance checked, until its route is ready. The budget counts nodes, not time, so behaviour is still identical at 30, 60 and 120 FPS; the existing 30-minute determinism test passes unchanged.

| Same five-minute run (this container's CPU) |  Before |     After |
| ------------------------------------------- | ------: | --------: |
| Worst step, warmed                          | 12.4 ms |    1.3 ms |
| 99.9th-percentile step                      |  8.0 ms |    0.6 ms |
| Finding start and goal cells, worst         |   20 ms |    0.3 ms |
| Adding all three babies                     |   87 ms |     19 ms |
| Steps until a new route is ready            |       — | at most 2 |

The one remaining spike is the very first step after a baby arrives, about 12 ms while its cell cache is cold. That happens once, as you add it from the catalog. Editing the tank (placing or moving an item) also clears the cache, so the next routes are a little slower to plan.

**Fixed: give-way steering.** When turning aside for the swimmer, the second half of the turn read the already-updated heading, skewing every turn to one side. It now turns the original heading.

## 3. Checks

| Check                                  | Result                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build` / `typecheck` / `lint` | Pass                                                                                                                                                   |
| `npm run test`                         | **515 passed** (57 files). New: the nearest-cell equivalence test, and that planning always runs within its per-step budget while the pup keeps moving |
| `npm run test:stress`                  | **10 passed**, including the 5-, 15- and 30-minute ecosystem soaks                                                                                     |

### Browser regression (one at a time, `COZY_DPR=0.5`)

| Harness                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tank-babies.mjs`                                                                                                    | Pass, with the new route planning in a real browser. All three babies added with real input. Over four simulation seconds the pup, ray and hatchling moved 1.02, 0.75 and 0.54 m, never touching scenery, and fish kept at least 4.3 m from them. Saved, reloaded, shown in the office miniature, carried through two crevice passages, then a confirmed reset (0 additions, 0 animals, all 9 sightings kept). GPU counts were steady throughout: 365 / 113 / 113 with no babies, and 371 / 128 / 117 with three. Fixed view with 20 additions: 190 → 196 draw calls and 1.19 → 1.22 M triangles for the three babies |
| `tank-catalog.mjs`                                                                                                   | **Pass after a harness fix** (section 4): all six items placed with real keys, rotate, move, cancel, remove, fill to the cap, reload, office miniature, and both reset choices. GPU 365 / 113 before and after. Empty vs full tank view: 179 → 186 draw calls and 1.01 → 1.20 M triangles. A second full run also passed                                                                                                                                                                                                                                                                                              |
| `passage.mjs`                                                                                                        | Pass. The swap is seamless with five additions near the alley, the reef is ready at the crossing, and the outer waters are released. GPU 363 / 113 / 113 before and after                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `outer-reef.mjs`                                                                                                     | Pass. 235 fish, all moving, none below the seabed. Memory back to 432 / 113 after two visits. 47–77 draw calls and 1.06–1.84 M triangles across six views (the busiest, "at the lip", rose from 1.73 M with rc.3's extra reef life)                                                                                                                                                                                                                                                                                                                                                                                   |
| `big-creatures.mjs`                                                                                                  | Pass. No reef contact in 21,600 clearance samples, they give way (closest 5.6 m), and the Seen page survives a reload                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `office.mjs`, `dive.mjs`, `dive-interrupt.mjs`                                                                       | Pass. Dive and surfacing compile no new programs, and five full dive cycles hold at 432 / 113 / 123                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `lifecycle.mjs`                                                                                                      | Pass, with exact counts unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `reef-life`, `runtime-fixes`, `discoveries`, `anchored-life`, `ornaments`, `reef-overhaul`, `integration`, `browser` | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `production.mjs` (built preview)                                                                                     | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `load-budget.mjs` (built preview)                                                                                    | Pass. 14.8 MB downloaded (13.7 MB models), prepared in 7.0–10.2 s over three runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Console errors                                                                                                       | None, apart from `reef-overhaul`'s deliberate missing-asset fallback check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Not run, by design: the one-off before/after comparisons (`creature-overhaul`, `fish-overhaul`, `geometry-overhaul`, `playtest-fixes`) and the separate benchmark-page tools (`asset-smoke`, `texture-memory`, `visual-benchmark`).

## 4. Found during the regression

- **The tank-catalog harness had been broken since Pass 030.** It failed on unchanged `main` too, so Pass 031 did not cause it. Pass 030's report did not re-run it.
  - **The cause:** a race in the harness, not the game. Resuming from the pause screen restores your previous look on a later frame. When that landed after the harness had posed the camera, the pose was overwritten and the preview aimed somewhere else. The fixture's validity check then failed at varying spots.
  - **The fix:** the harness now re-applies its pose until the controls hold it, with the validity assertion unchanged. Its failure message now names the posed spot and the swimmer's actual position.
  - **In play:** the same restore is what you would expect when resuming, since you get your own look back.
- **Harness ports.** `tank-babies.mjs` and `tank-catalog.mjs` default to their own ports (5200 and 5196); they were run with `COZY_URL` against the shared dev server.

## 5. Known limitations

- **Software rendering only.** Frame time on the MacBook Air is unmeasured. Twenty additions add about 19% more triangles to the tank view (Pass 029's measurement); the babies' cost is measured in the regression table.
- **First step after adding a baby:** one ~12 ms step, behind the catalog action. Editing the tank makes the next routes plan from a cold cache.
- **Conservative placement:** it can refuse spots that look fine, near homes or narrow rocks, to keep the tested swim routes and habitats clear.
- **Miniature babies:** they are scaled adults, not juvenile models.
- **Saving:** the tank and sightings live in this browser profile; clearing site data resets them.

## 6. macOS acceptance checklist (v0.5)

Use the production build (`npm run build`, `npm run preview`) in Chrome or Safari, with Settings → Show frame time on. Play through v0.4 first if it is not yet accepted. Its checklist is in [the v0.4 release-candidate report](VALIDATION_V04_PASS_028.md).

**Discovery and the catalog**

- [ ] Seeing a coral, the seagrass or a big animal outside makes it appear under **For your tank**; nothing unseen is listed.

**Placing**

- [ ] The preview, turning (**R**) and placing (**F**) feel calm and easy.
- [ ] Unsuitable spots dim quietly.
- [ ] Moving (**G**) and removing (**X**) work, and Escape while moving keeps the original.

**Looks**

- [ ] Placed corals and seagrass look naturally seated on the reef.
- [ ] Seagrass sways, and is still with reduced motion.

**Babies**

- [ ] Each one looks charming and calm, with sizes that feel right.
- [ ] The pup loops, the ray glides and sometimes rests on the sand, and the hatchling paddles and rises.
- [ ] They give you room and never clip rock, glass or your additions.
- [ ] **No stutter every few seconds** (the fix in this pass).

**Fish**

- [ ] Fish flow around your additions and the babies.

**Persistence**

- [ ] A reload brings back the same tank.
- [ ] The office miniature shows your additions and babies.
- [ ] **Restore the original tank** asks first, then clears additions and babies but keeps your sightings.

**Frame time**

- [ ] Note the mean and p95 in the tank with no additions, then with 20 additions and 3 babies, and compare with `0.4.0-rc.3`. Aim for about 16.7 ms mean, with p95 well under 33 ms.

**A long session**

- [ ] A 20–30 minute session with dives, surfacing and trips through the crevice stays smooth, with no audio or visual glitches.
