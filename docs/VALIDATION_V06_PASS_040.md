# v0.6 Pass 040 — Tests brought up to date, full browser regression

Date: November 17, 2026. Candidate `0.6.0-rc.1` for user review. No merge or release is authorized by this report.

**Limits of this evidence.** All browser evidence comes from Linux Chromium with SwiftShader in a four-core cloud container, at `COZY_DPR=0.5`. Nothing here measures MacBook Air frame time, Safari, or how the new areas feel. The container restarted twice during the run; each time the run resumed, keeping harnesses that had already passed.

## Unit tests

| Check                                  | Result                                         |
| -------------------------------------- | ---------------------------------------------- |
| `npm run build` / `typecheck` / `lint` | Pass                                           |
| `npm run test`                         | **565 passed** (62 files; was 553 + 2 failing) |

- **Updated:** two outer reef tests predated the glass.
  - **Edge test:** the swimmer now glides out over the lip at full speed, slows only over the last 1.4 m before the back glass, and never below 15% of normal speed. The glass sits 2–5 m past the lip.
  - **Wall shoals test:** the two wall shoals now hover inside the window.
- **New:** `tanks-and-life.test.ts` (10 tests).
  - **Outer reef:**
    - every reef fish school lies inside the glass;
    - over half an hour of simulated time, every big animal (the reef's own and the wall visitors) stays outside the glass and passes both close and far;
    - a newly arrived visitor's first pass is close.
  - **Kelp forest:**
    - its walls stop the swimmer on all three sides;
    - its kelp (more than 100 plants in the wall band) and the rocks at the walls' feet stand inside the walls;
    - it disposes once.
  - **Sea cave:** it is tank-sized and boxy, with a roof about 12 m up.
  - **Lobsters:** a lobster backs into its crack when the swimmer comes close and creeps out again.
  - **Sea lion:**
    - it comes over, plays, darts off and roams again, never closer than its personal distance (1.8 m) and always inside its limits;
    - it ignores an inactive swimmer;
    - it never rolls with reduced motion.

## Browser regression (one at a time)

All 21 harnesses pass. That is every functional harness, as in Pass 028, plus those added since (wall visitors, kelp forest, tank catalog, tank babies) and a new one for the sea cave. The before/after comparison harnesses (creature, fish and geometry overhauls, texture memory, visual benchmark) compare two builds and were not run, as in Pass 028.

| Harness                                                                                                        | Result                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `passage.mjs`                                                                                                  | **Pass.** Seamless swap (0.94 / 0.94); outer waters released; GPU 363 geometries / 113 textures / 113 programs before and after                                                                                                                                                                    |
| `outer-reef.mjs`                                                                                               | **Pass.** With W held the swimmer reaches the glass 2.95 m past the lip; down the wall to −11.6 m                                                                                                                                                                                                  |
| `big-creatures.mjs`                                                                                            | **Pass after a harness update.** Since Pass 037, the camera stayed near each animal, so it never left its far lane. The harness now puts each group on its close pass before watching. All three species noted; no reef contact in 21,600 samples (2.82 m lowest above the floor); 9 models loaded |
| `wall-visitors.mjs`                                                                                            | **Pass.** First visitor at exactly 8 s; every visitor appears 26–41 m away, beyond the view distance, and passes within 5–11 m; GPU memory back to 362 / 113                                                                                                                                       |
| `kelp-forest.mjs`                                                                                              | **Pass after a game fix and a harness update** (below). Through both passages at equal darkness; 20 garibaldi and 4 bat rays all moving; garibaldi, bat ray and giant kelp seen; GPU memory back to its first counts                                                                               |
| `sea-cave.mjs` (new)                                                                                           | **Pass.** Detailed in the list below the table                                                                                                                                                                                                                                                     |
| `tank-catalog.mjs`                                                                                             | **Pass after a harness update.** Eight item types (the limestone arch), all 20 placements with real keys, move and remove, the full tank, reload and restore. One run timed out waiting for the mouse capture after 18 placements; the clean re-runs placed all 20                                 |
| `tank-babies.mjs`, `runtime-fixes.mjs`, `office.mjs`, `dive.mjs`, `dive-interrupt.mjs`, `lifecycle.mjs`        | **Pass**                                                                                                                                                                                                                                                                                           |
| `discoveries.mjs`, `anchored-life.mjs`, `ornaments.mjs`, `reef-overhaul.mjs`, `integration.mjs`, `browser.mjs` | **Pass**                                                                                                                                                                                                                                                                                           |
| `production.mjs`, `load-budget.mjs` (built preview)                                                            | **Pass**                                                                                                                                                                                                                                                                                           |

The new `sea-cave.mjs` uses real pointer lock and held W through the crevice, the cleft and the grotto:

- **The sea lion:** it came over to a waiting swimmer and circled, its closest 3.2 m. It was seen, and it was still while paused.
- **Into the cave:** the grotto swap happened at equal darkness (0.94 / 0.94).
- **The cave's life:** 3 resting whitetips, 1 circling, 42 sweepers and 11 lobsters. A lobster backed 0.42 m into its crack when approached.
- **Sightings:** the sea lion, the sea cave, the spiny lobster and the glassy sweeper were all seen.
- **Release:** home from the cave, all three outer worlds were released, and GPU memory returned to 362 / 113.

## A bug the regression found

**Giant kelp could no longer be seen near the kelp forest's tunnel exit.**

- **Cause:** the kelp sighting spots are taken from the plants nearest the tunnel's wall. Since Pass 036 those were the dense wall-band kelp along the side walls, far from where the swimmer comes out.
- **Fix:** the spots now come from the forest's own kelp again, and the kelp-forest harness looks at an actual sighting spot.

## Harness updates for earlier passes

These harnesses expected behaviour from before passes 035–037. None of them reflected a fault in the game.

- **`big-creatures`:** watches each animal on its close pass (Pass 037).
- **`kelp-forest`:** counts garibaldi by species, because Pass 035's kelp bass share the fish system.
- **`tank-catalog`:** expects eight item types and eight seeded sightings (Pass 034's arch).
- **`sea-cave`:** looks at its lobster for long enough (1.5 s) to count it as seen.

## For the user's macOS play-through

1. Swim the whole route: tank → outer reef glass → kelp forest (sea lion) → grotto → sea cave, and back through each passage. Then use Return to the tank from the cave.
2. Wait at the outer reef's glass: visitors come, some passing close and some far out.
3. Place items in the tank, including the limestone arch.
4. Watch the frame rate in the kelp forest (its wall kelp is heavy) and in the cave.
