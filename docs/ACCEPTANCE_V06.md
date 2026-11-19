# v0.6 full-world acceptance (Pass 055)

**Status: acceptance-ready, not accepted.** v0.6 is formally accepted only after Bryce plays through it on a real Mac (Chrome and Safari) using the checklist below, and approves.

## 1. What the journey depends on

### Spaces and transitions

| From → to                     | How                                                                | Code                                                 |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Start screen → office or tank | "Enter the Office" or "Dive In" (first entry is a plain cut)       | `Application.enter`, `ui/Interface`                  |
| Office ↔ tank                 | E at the tank's glass (dive); E near the water's surface (surface) | `player/dive.ts` `DivePath`, `canDive`, `canSurface` |
| Pause screen: office ↔ water  | The pause screen's buttons, with a calm fade                       | `DivePath('switch')`                                 |
| Tank ↔ outer reef             | The hidden crevice, then the tunnel                                | `config/passage.ts` `CREVICE`, `PASSAGE`             |
| Outer reef ↔ kelp forest      | The cleft in the cliff                                             | `CLEFT`, `KELP`                                      |
| Kelp forest ↔ sea cave        | The grotto                                                         | `GROTTO`, `CAVE`                                     |
| Sea cave ↔ under the ice      | The cave's back tunnel                                             | `CAVE.backTunnel`, `ICE_GATE_FRAME`, `ICE_FRAME`     |
| Any outer world → tank        | "Return to the tank" on the pause screen                           | `Application.returnToTank`                           |

Each outer world is prepared as you approach its passage (an explicit `WorldPreparation` state), and released (disposed) once you are far enough away from it.

### Wildlife, by world

- **Tank:** reef fish on authored rigs, schools, moray in its den, anemone and clownfish, seahorse, frogfish, tank babies, and fish added from the catalog.
- **Outer reef:** schools over the reef top, turtles, sharks, eagle rays, barracuda, wall visitors (hammerhead, manta, whale shark, humpback) on a per-visit schedule, reef encounters (octopus and others), and far silhouettes.
- **Kelp forest:** garibaldi, kelp bass, blacksmith, señorita, sheephead, giant sea bass, sea lion, harbour seal, sea otter, gulls, nudibranchs, kelp crabs, urchins, sea stars.
- **Sea cave:** glassy sweepers, soldierfish, flashlight fish, moray, nurse shark, resting sharks, lionfish, crabs, spiny lobsters, cleaner shrimp.
- **Under the ice:** penguins (emperor and Adélie), Weddell and leopard seals, icefish, notothens, krill, sea butterflies, comb jellies, the ice garden, silverfish schools, and rare encounters (minke and killer whales, toothfish, colossal squid, polar bear and more), each restarting on arrival.

### Saved state (all local, all tolerant of blocked or corrupt storage)

| Key                        | Holds                                                 |
| -------------------------- | ----------------------------------------------------- |
| `cozy-diver.settings.v3`   | Preferences (migrates v1 and v2)                      |
| `cozy-diver.tank.v1`       | The personalised tank (payload version 3; migrates 2) |
| `cozy-diver.journal.v1`    | Things seen beyond the tank (unlocks catalog entries) |
| `cozy-diver.visits.v1`     | Outer-reef visit count (the wall visitors' schedule)  |
| `cozy-diver.dived.v1`      | The office's first-dive hint                          |
| `cozy-diver.onboarding.v1` | Welcome back, last space, the swim hint (Pass 054)    |

### Sound

- **Office ambience** (`OfficeAmbience`).
- **The underwater soundscape** (`AudioSystem`): its small sounds move to each world's spots.

Only the current space is heard; through a dive they crossfade. Both are suspended when hidden or paused.

### Player state that travels

Position, velocity, look direction, `neutralDepth`, the water world, the per-space look directions, and the pause state. Held keys are cleared on every lock change and passage.

## 2. Test matrix

| Area                                   | Automated check                                                                                  | Where                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Entering each environment              | Swim through every passage, office start, real dive                                              | `validation/acceptance.mjs`                                         |
| Returning through every passage        | Ice → cave → kelp → outer → tank by swimming; "Return to the tank"                               | `acceptance.mjs`, `long-session.mjs`                                |
| Rapid backtracking                     | At each passage: through, straight back, through again                                           | `acceptance.mjs`                                                    |
| Interrupted transitions                | Pause in the dark of the cleft, resume; interrupted dives                                        | `acceptance.mjs`, `dive-interrupt.mjs`                              |
| Camera orientation, swimming velocity  | No roll in any world; swimming maths, frame-rate independence, six-sided clearance               | `acceptance.mjs`, unit tests (`swimming`, `controls`)               |
| Collisions (terrain, rock, glass, ice) | Swimmer inside each world's bounds; collision and edge unit tests; edge audit of 16 edges        | `acceptance.mjs`, `collision`, `open-ocean` tests, `edge-audit.mjs` |
| Wildlife after travel                  | Each world still animating on arrival and after travelling back                                  | `acceptance.mjs`                                                    |
| Rare encounters, schedules, sightings  | Schedules and sightings unit tests; the journal saved and restored                               | `ice-rare`, `wall-visitors`, `journal` tests; `acceptance.mjs`      |
| Pause/resume, reduced motion           | Pause mid-passage; the whole second journey with reduced motion                                  | `acceptance.mjs`, `onboarding.mjs`                                  |
| Audio and visual transitions           | Crossfade and lifecycle unit tests; mute remembered                                              | `audio-*` tests, `onboarding.mjs`                                   |
| Loading and unloading                  | Each world prepared before its passage; all released and disposed after                          | `acceptance.mjs`, `long-session.mjs`                                |
| GPU resources and memory               | Geometry and texture counts back to the tank's after each journey, and the same after the second | `acceptance.mjs`, `long-session.mjs`                                |
| Saved state after relaunch             | Tank, preferences, journal, onboarding survive a reload                                          | `acceptance.mjs`                                                    |

## 3. Results

### `validation/acceptance.mjs`: 65 of 65 checks pass

Chromium headless with **SwiftShader (software rendering)**, the Vite dev server, a 800×500 viewport at device pixel ratio 0.5, and frames stepped by hand at 1/30 s. One run took 70 minutes: two full journeys, the second with reduced motion. **No page errors.**

| Check                                                          | Result                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Start screen → office → walk to the tank → E → dive            | Pass; lands in the tank                                                                                                                  |
| Personalise the tank (two blue tangs), change preferences      | Pass; saved                                                                                                                              |
| Forward through every passage, twice                           | Pass. Frames of swimming, journey 1 / journey 2: tank → outer 83 / 84, outer → kelp 138 / 122, kelp → cave 83 / 83, cave → ice 176 / 176 |
| Interrupted passage (paused in the dark of the cleft)          | Pass; resumed and arrived                                                                                                                |
| Rapid backtracking at every passage                            | Pass; back in 23–27 frames and on again in 17–18, in both journeys                                                                       |
| Back through every passage (ice → cave → kelp → outer → tank)  | Pass, 23–27 frames each                                                                                                                  |
| Each world alive, level and in bounds on arrival and on return | Pass: every world animating, camera roll 0, swimmer inside bounds                                                                        |
| Every outer world released after "travelling home"             | Pass; outer, kelp and cave preparations disposed (the ice was already released on the way back)                                          |
| GPU memory after release                                       | 404 → 550 geometries and 125 → 185 textures after the first journey; **exactly the same after the second** (no growth)                   |
| Surface to the office with E                                   | Pass                                                                                                                                     |
| Reload: tank, preferences, journal, onboarding                 | Pass; two blue tangs, sensitivity 1.4, reduced motion on, "Welcome back" to the office                                                   |

### What stays in memory after release

Investigated with a tracing harness, which recorded every GPU geometry and texture uploaded after the tank was warmed, and which world uploaded it:

- **After the first journey:** 146 geometries and 60 textures stay. All of them are authored fish models that the outer worlds borrow from the tank's own asset cache, plus their morph-target textures. The cache keeps decoded models for reuse by design (Pass 018; only transient libraries such as the big creatures are evicted). It held 21 entries afterwards: the tank's own species, and the reef, kelp and ice fish shared with it (`giantSeaBass`, `sheephead`, `icefish`, `notothen`, `toothfish` and others).
- **After the second journey:** nothing new stays. The counts match the first exactly, so there is **no accumulating leak**.
- The acceptance harness now checks a bounded retention budget (220 geometries, 100 textures over the warm tank) and no growth. The long-session harness's stricter "back to exactly the tank's count" rule did not account for this cache. It now uses the same retention budget, and still checks its per-world budgets.

### Per-world counts on arrival (SwiftShader; counts are real, times only relative)

| World         | Draw calls | Triangles in view | Stepped frame (ms, software) | GPU geometries / textures held |
| ------------- | ---------: | ----------------: | ---------------------------: | -----------------------------: |
| Tank          |        178 |            1.04 M |                         1331 |                      404 / 125 |
| Outer reef¹   |         47 |            0.12 M |                      794–926 |                      502 / 239 |
| Kelp forest   |         45 |            2.24 M |                    1790–1998 |                      581 / 302 |
| Sea cave      |         63 |            0.94 M |                    1028–1231 |                      628 / 330 |
| Under the ice |         95 |            1.45 M |                      393–572 |                      722 / 393 |

¹ Measured just inside the tunnel mouth, so little of the reef is in view. The world tour (Pass 053) has the open-reef views: 101–109 calls and 1.2–1.8 M triangles.

The software frame times are seconds, not milliseconds of a real GPU. They only show that the kelp forest is the heaviest world to draw and the ice the lightest. **No real-device frame time, FPS or memory was measured.** That is what the real-device checklist below is for.

### Other automated checks

- Unit tests: 709 pass; typecheck, lint and build are clean.
- `validation/onboarding.mjs` (Pass 054): 8 of 8 scenarios.
- `validation/visual-tour.mjs` (Pass 053): 15 views across all five worlds, no errors.
- **Earlier browser harnesses,** re-run on this revision (same setup):

  | Harness                    | Time   | Result |
  | -------------------------- | ------ | ------ |
  | `dive.mjs`                 | 13 min | pass   |
  | `dive-interrupt.mjs`       | 13 min | pass   |
  | `office.mjs`               | 5 min  | pass   |
  | `runtime-fixes.mjs`        | 1 min  | pass   |
  | `tank-personalization.mjs` | 4 min  | pass   |

  The per-world harnesses (outer reef, kelp, cave, ice, rare encounters) were not all re-run individually. Their worlds, passages and release are covered end to end by `acceptance.mjs`, and their behaviour by the unit tests.

### Not exercised by this run

- **Sightings:** a sighting needs 1.5 s within 6 m in the middle of the view, and this run only paused briefly at passage mouths. They are covered by the journal unit tests and `validation/big-creatures.mjs`.
- **Audio:** headless Chromium plays no sound. Crossfades and suspension are unit-tested (`audio-*`), and mute is checked in the browser, but whether it sounds smooth needs ears (see the checklist).

## 4. Real-device playthrough checklist (macOS: Chrome, then Safari)

Use a production build (`npm run build && npx vite preview`) or the deployed page. Before starting, note: the Mac model and chip, macOS version, browser and version, display resolution, and whether it is on battery. Turn on **Settings → Show frame time** for the whole run, and write down the readout in each world.

Do the whole list once in Chrome, then again in Safari. Tick each item, or note what happened.

**Start**

- [ ] A fresh private window: the start screen appears within a few seconds and says "Your first dive". Enter the Office is focused.
- [ ] Press Enter: the mouse is captured, and you are walking in the office. After a few seconds, a hint points at the tank.
- [ ] Walk to the tank and look into it: "E Dive in" appears. Press E: a calm dive with bubbles, and the sound crossfades to underwater.
- [ ] In the water: the swim hint appears once, then fades as you swim.

**The tank**

- [ ] Swim round the whole tank, up to every glass wall, the sand and the surface. You are stopped gently, never pass through, and never get stuck.
- [ ] Esc pauses and shows "Stay a little longer". "Return to the Water" resumes where you were.
- [ ] Open **For your tank**, add a fish, close. The fish swims in the tank.
- [ ] M mutes and unmutes. The mute button and Settings agree.

**The journey out** (each passage: the screen darkens briefly, with no freeze longer than a blink)

- [ ] Find the crack in the back-right rocks and swim through the tunnel to the **outer reef**. The reef appears, fish and turtles are about, and big animals pass out in the blue.
- [ ] Swim out over the drop-off to the far window: it appears only up close. Drift down the wall into the deep.
- [ ] Find the cleft in the cliff and swim through to the **kelp forest**. Kelp sways, fish swim, and the sea lion, seals or otter may appear.
- [ ] Find the grotto and swim to the **sea cave**. A dim cave with a sunbeam, sharks resting, and lobsters and crabs.
- [ ] Find the back tunnel and swim **under the ice**. Penguins, seals, the ice garden and krill; stay a few minutes for a rare visitor.
- [ ] At each passage, turn round straight after crossing and swim back. Nothing breaks.

**Coming back**

- [ ] Swim back through every passage: ice → cave → kelp → outer reef → tank.
- [ ] Then go out again to any world, pause, and choose "Return to the tank". You arrive by the crack, facing into the tank.
- [ ] Swim near the surface: "E Return to the office". Press E: you surface into the office where you dove from.

**Comfort and settings**

- [ ] Turn on Reduced camera motion and swim through one passage: no sway or bob, and transitions are calm.
- [ ] Change the sensitivity and speed, then reload: they are kept.
- [ ] Reload: "Welcome back", with your last space first. Your tank fish are still there, and "Seen in the outer waters" lists what you saw.

**Long session**

- [ ] Stay 30 minutes or more, travelling between worlds. Note the frame time in each, any stutter, the fan, and the battery.
- [ ] In Chrome, open the Task Manager (Window → Task Manager) and note the tab's memory at the start, after 15 minutes and after 30 minutes. It should level off, not keep climbing.
- [ ] Switch tabs for a minute and come back: the game is paused and silent while away, and resumes cleanly.

**Afterwards:** was any moment confusing, jarring, too dark, too bright, too loud or too slow? Rate how relaxed you felt, from 1 to 5.

## 5. Defects and known issues

Nothing critical or major was found. A **critical** defect would block progress, lose saved state or crash; a **major** one would visibly break a world or a transition.

| #   | Severity    | Issue                                                                                                                                                                                         | Status                                                                                                                  |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Test defect | The long-session harness expected GPU counts to return exactly to the tank's after release. The tank's shared asset cache keeps borrowed fish (bounded, no growth), so that rule cannot hold. | The acceptance harness checks a retention budget plus no growth. `long-session.mjs` aligned the same way.               |
| 2   | Test defect | Harness button names still said "Enter the Water" after Pass 054's rename                                                                                                                     | Fixed (Pass 054 branch)                                                                                                 |
| 3   | Cosmetic    | The start screen's corner label still reads "01 / First dive" on return visits                                                                                                                | Open (Pass 057)                                                                                                         |
| 4   | Cosmetic    | The sea butterfly is still a simple shape                                                                                                                                                     | Open; tiny and rarely seen close                                                                                        |
| 5   | Performance | The kelp forest draws about 2.2–2.4 M triangles in view, the most of any world (+15% from Pass 053's creatures)                                                                               | Open for Pass 059; needs a real-GPU measurement first                                                                   |
| 6   | Memory      | About 146 geometries and 60 textures of borrowed fish stay cached after leaving the outer worlds                                                                                              | By design; Pass 059 could evict outer-only species (giant sea bass, sheephead, icefish, notothen, toothfish) on release |
| 7   | Unverified  | Real-device frame time, memory over 30 minutes, Safari behaviour, and audio quality                                                                                                           | Needs the real-device checklist                                                                                         |

## 6. Release-candidate recommendation

**Recommend `0.6.0-rc.17` as the v0.6 release candidate, acceptance-ready.**

- Every environment is reachable, every return path works, and quick turn-backs and a paused passage recover cleanly.
- Wildlife keeps running after travel; the camera stays level and the swimmer stays in bounds.
- Repeated journeys leave no growing resources.
- Saved tanks, preferences, the journal and onboarding survive a relaunch.
- All automated checks pass.

What is left is what only a person and real hardware can judge: smoothness, sound, comfort and Safari. **v0.6 is not formally accepted** until the real-device checklist above has been played through on a Mac in Chrome and Safari and approved.

Merge order: #85 (052B) → #86 (053) → #87 (054) → this PR.
