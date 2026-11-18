# Cozy Diver: development audit (Pass 049)

This is a documentation-only reconciliation of the original Cozy Diver vision with the code as it stands at `0.6.0-rc.10`: the tip of Pass 048, landing on `main` via #79. It changes no gameplay, assets or architecture. The canonical plan remains [ROADMAP.md](ROADMAP.md); this file holds the evidence behind it.

The audit draws on:

- **History:** the git history (76 merged PRs to `main`, plus #77 and #78, which were merged into stacked branches).
- **Records:** the validation records in `docs/` and the README.
- **Code:** the `src/` modules, the 66 unit-test files in `tests/` (about 465 test blocks) and the 37 browser harnesses in `validation/`.

## 1. Status vocabulary

The audit keeps four states separate and never infers one from another.

| State                    | Meaning                                                                                                             | Evidence required                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Implemented**          | The code is on `main` and reachable in the app.                                                                     | A merged PR.                                                      |
| **Automatically tested** | Covered by unit tests (`npm run test`) and/or a browser harness in `validation/` run on Linux Chromium/SwiftShader. | A test file or harness, plus a validation record of its last run. |
| **Manually accepted**    | The user played it on the target MacBook Air and said so.                                                           | An explicit acceptance line recorded in ROADMAP or README.        |
| **Released**             | Tagged or published as a release.                                                                                   | A git tag or GitHub release. **None exist.**                      |

SwiftShader results say nothing about MacBook Air performance, Safari behaviour or comfort. Those are only ever established by the user's play-through.

## 2. Original vision versus what was built

> Cozy Diver is a calm, browser-based scuba exploration experience. The player begins in a cozy office, approaches a small aquarium, dives inside, and becomes tiny in a large, customizable underwater world. Hidden passages lead to larger marine environments. The experience should prioritize natural creature behavior, polished geometry, comforting sound, smooth swimming, freedom of exploration, and zero gameplay pressure.

| Vision pillar                          | Status                            | Where it lives                                                                        | Notes                                                                                                                                                                              |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calm, browser-based                    | Implemented                       | `src/app`, `src/rendering`, Vite build                                                | No scores, timers, combat or accounts anywhere in the code.                                                                                                                        |
| Begins in a cozy office                | Implemented, accepted (v0.3)      | `src/environment/office`, `src/rendering/OfficeScene.ts`, `src/player/walking.ts`     | Remodelled as a glass office in Pass 027 (v0.4, not yet accepted).                                                                                                                 |
| Dive inside, become tiny               | Implemented, accepted (v0.3)      | `src/player/dive.ts`, `src/rendering/TankOutlook.ts`                                  |                                                                                                                                                                                    |
| Large, customizable world              | Implemented, **not accepted**     | `src/catalog/*`, `src/environment/TankDecoration.ts`, `src/environment/TankBabies.ts` | Customization is limited to discovered items (corals, seagrass, kelp, an arch, and baby shark/ray/turtle). You can place, turn in 30° steps, move, remove, save locally and reset. |
| Hidden passages to larger environments | Implemented, **not accepted**     | `src/player/passage.ts`, `src/environment/passage`, the four scenes                   | Chain: tank → outer reef → kelp forest → sea cave → under the ice.                                                                                                                 |
| Natural creature behaviour             | Implemented, partly accepted      | `src/fish/*`, `src/creatures/*`                                                       | Tank life accepted with v0.2. Everything in the outer waters is unaccepted.                                                                                                        |
| Polished geometry                      | Implemented                       | Blender pipeline (`tools/art`), `src/assets`, `docs/ASSET_PIPELINE.md`                | Shipped models total about 32 MB; texture memory is managed with KTX2.                                                                                                             |
| Comforting sound                       | Implemented, partly accepted      | `src/audio/*`                                                                         | Procedural water texture, office ambience, crossfades and a seal call. There are no per-environment music beds; the open waters reuse the water texture.                           |
| Smooth swimming                        | Implemented, accepted (v0.1–v0.3) | `src/player/swimming.ts`, `src/controls/SwimControls.ts`                              | Speed retuned at v0.2 Pass 019 and v0.3 Pass 021 and accepted with v0.3.                                                                                                           |
| Freedom of exploration                 | Implemented                       | Passages and sightings journal (`src/discovery`)                                      | Discovery is gentle: no counters or loss.                                                                                                                                          |
| Zero gameplay pressure                 | Implemented                       | Repo-wide rule (AGENTS.md)                                                            | Nothing to lose, miss or complete.                                                                                                                                                 |

## 3. Original version plan versus the actual order

The order changed twice by user decision. Both changes are kept; development history is not reversed.

| Original plan                   | Actual milestone (as built)   | Change                                                                                        |
| ------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| V0.1 First Swim                 | v0.1 First Dive               | Same scope under a different name.                                                            |
| V0.2 Living Aquarium            | v0.2 Living Aquarium          | Same. It also absorbed a tropical conversion (Pass 007) and an art overhaul (Passes 012–018). |
| V0.3 Office and Dive Transition | v0.3 Office & Dive Transition | Same.                                                                                         |
| V0.4 Personalization            | **v0.5** Personalization      | Swapped after v0.3 acceptance, so that exploring fills the catalog.                           |
| V0.5 Beyond the Glass           | **v0.4** First Passage        | Swapped (see above).                                                                          |
| V0.6 Expanding Oceans           | v0.6 Expanding Oceans         | Same name, much larger scope: three new worlds plus wildlife passes (see §6).                 |

## 4. Milestone status

| Milestone             | Last candidate | Implemented                  | Automated tests                                                                                   | Manually accepted                                                                      | Released |
| --------------------- | -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| v0.1 First Dive       | Pass 003       | Yes                          | Swimming, collision, controls, settings unit tests; `browser.mjs`                                 | **Not explicitly recorded.** Superseded by v0.2 acceptance, which played on top of it. | No       |
| v0.2 Living Aquarium  | `0.2.0-rc.15`  | Yes                          | Fish, plants, habitat, anchored life, discoveries, assets; many harnesses                         | **Yes**, at `0.2.0-rc.15`                                                              | No       |
| v0.3 Office & Dive    | `0.3.0-rc.1`   | Yes                          | Office, walking, dive, audio lifecycle; `office.mjs`, `dive.mjs`, `dive-interrupt.mjs`            | **Yes**, at `0.3.0-rc.1`                                                               | No       |
| v0.4 First Passage    | `0.4.0-rc.3`   | Yes                          | Passage, outer reef, big creatures, wall/blue; harnesses `passage`, `outer-reef`, `big-creatures` | **Open:** awaiting the macOS play-through                                              | No       |
| v0.5 Personalization  | `0.5.0-rc.1`   | Yes                          | Tank catalog, tank babies; `tank-catalog.mjs`, `tank-babies.mjs`                                  | **Open:** awaiting the macOS play-through                                              | No       |
| v0.6 Expanding Oceans | `0.6.0-rc.10`  | Yes (Pass 048 lands via #79) | Kelp, cave, ice, encounters; regression last fully run at Pass 040 (rc.1)                         | **Open:** content still being added after rc.1                                         | No       |

All releases remain unreleased: there are no git tags or GitHub releases. "rc" in this project means a candidate offered for play-testing, not a published release.

## 5. Feature matrix

**Legend.** U = unit tests, H = browser harness, M = manual acceptance recorded, — = none.

| Feature                                               | Milestone | Source modules                                                                        | Tests                                                                  | U   | H           | M          |
| ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --- | ----------- | ---------- |
| First-person swimming, bounds, pointer lock, settings | v0.1      | `player/swimming.ts`, `player/collision.ts`, `controls`, `ui/settings.ts`             | `swimming`, `collision`, `controls`, `settings`                        | ✓   | ✓           | (via v0.2) |
| Procedural aquarium and reef rock                     | v0.1–v0.2 | `environment/Aquarium.ts`, `RockGeometry.ts`, `ReefLayout.ts`                         | `rocks`, `reef-environment`                                            | ✓   | ✓           | ✓          |
| Tropical fish, schooling, diver reaction              | v0.2      | `fish/*`                                                                              | `fish-*`, `biodiversity`, `tropical-integration`                       | ✓   | ✓           | ✓          |
| Plants and habitat                                    | v0.2      | `PlantSystem.ts`, `MeadowSystem.ts`, `MarineHabitat.ts`                               | `plant-*`, `habitat-regions`                                           | ✓   | ✓           | ✓          |
| Ornaments (six)                                       | v0.2      | `environment/ornaments`                                                               | `ornaments`                                                            | ✓   | ✓           | ✓          |
| Anchored life (anemone, clownfish, moray, seahorse…)  | v0.2      | `creatures/AnchoredLife.ts`, `Moray*.ts`, `HostBehavior.ts`                           | `anchored-life`, `seahorse-grip`, `rock-den`                           | ✓   | ✓           | ✓          |
| Hidden marine discoveries in the tank                 | v0.2      | `creatures/discoveries`                                                               | `hidden-discoveries`                                                   | ✓   | ✓           | ✓          |
| Ambient water audio                                   | v0.2      | `audio/*`                                                                             | `audio-*`                                                              | ✓   | ✓           | ✓          |
| Authored GLB art, LOD, KTX2                           | v0.2      | `assets`, `tools/art`                                                                 | `asset-*`, `fish-lod-compression`, `ktx2-loader`                       | ✓   | ✓           | ✓          |
| Office and walking                                    | v0.3      | `environment/office`, `player/walking.ts`, `OfficeScene.ts`                           | `office`, `office-walking`, `office-shadows`, `office-audio-lifecycle` | ✓   | ✓           | ✓          |
| Dive and surfacing transition                         | v0.3      | `player/dive.ts`, `TankOutlook.ts`                                                    | `dive`, `tank-outlook`                                                 | ✓   | ✓           | ✓          |
| Hidden crevice and passage system                     | v0.4      | `player/passage.ts`, `environment/passage`, `WaterWorld.ts`                           | `passage`, `kelp-passage`                                              | ✓   | ✓           | —          |
| Outer reef wall and the blue                          | v0.4      | `environment/outer`, `OuterWatersScene.ts`, `deepFog.ts`                              | `outer-reef`, `deep-fog`, `wall-visitors`                              | ✓   | ✓           | —          |
| Big creatures and sightings                           | v0.4      | `creatures/cruising.ts`, `discovery/*`                                                | `big-creatures`, `journal`                                             | ✓   | ✓           | —          |
| Glass office remodel                                  | v0.4      | `environment/office`                                                                  | `office`                                                               | ✓   | ✓           | —          |
| Gentle-discovery unlocks                              | v0.5      | `discovery/sights.ts`, `catalog/catalog.ts`                                           | `journal`, `tank-catalog`                                              | ✓   | ✓           | —          |
| Tank catalog: place, move, remove, save, reset        | v0.5      | `catalog/*`, `TankDecoration.ts`                                                      | `tank-catalog`                                                         | ✓   | ✓           | —          |
| Baby animals in the tank                              | v0.5      | `TankBabies.ts`, `TankBabyHabitat.ts`, `creatures/babies`                             | `tank-babies*`, `tank-baby-models`                                     | ✓   | ✓           | —          |
| Kelp forest world and life                            | v0.6      | `environment/kelp`, `KelpForestScene.ts`, `creatures/kelpEncounters.ts`, `seaLion.ts` | `kelp-forest`, `kelp-passage`                                          | ✓   | ✓           | —          |
| Wall visitors, barracuda, reef encounters             | v0.6      | `creatures/wallVisitors.ts`, `barracuda.ts`, `reefEncounters.ts`, `octopus.ts`        | `wall-visitors`, `outer-reef`                                          | ✓   | ✓           | —          |
| Sea cave world and life                               | v0.6      | `environment/cave`, `SeaCaveScene.ts`, `creatures/caveEncounters.ts`                  | `sea-cave`                                                             | ✓   | ✓           | —          |
| Under the ice world                                   | v0.6      | `environment/ice`, `UnderIceScene.ts`                                                 | `under-ice`                                                            | ✓   | not yet run | —          |
| Antarctic wildlife and rare encounters                | v0.6      | `creatures/iceLife.ts`, `iceRare.ts`, `environment/ice/Ice*.ts`                       | `ice-life`, `ice-rare`                                                 | ✓   | not yet run | —          |
| World lifecycle: staged builds, preparation states    | v0.6      | `StagedBuild.ts`, `WorldPreparation.ts`                                               | `lifecycle-dispose`; `long-session.mjs`                                | ✓   | not yet run | —          |

## 6. Scope additions beyond the original plan

All of these were requested or agreed by the user and are kept:

- **Tropical conversion (v0.2 Pass 007):** the aquarium changed from a freshwater to a tropical reef.
- **Art overhaul (v0.2 Passes 012–018):** authored Blender models, LOD and KTX2.
- **Gentle-discovery unlocks:** agreed alongside the v0.4/v0.5 swap. Sightings unlock tank items.
- **Glass office (v0.4 Pass 027):** the office remodelled as a glass-walled room.
- **Every area is a tank (v0.6 Pass 036):** every outer world is bounded like an aquarium.
- **Four outer worlds:** outer reef, kelp forest, sea cave and under the ice, with wildlife passes and rare encounters for each (Passes 033–048).
- **Lifecycle and loading hardening (Pass 046 review):** added from a code review rather than the plan.

## 7. Gaps, partial work and outdated documents

**Missing or partial against the vision:**

- **Acceptance:**
  - No explicit v0.1 acceptance is recorded.
  - v0.4, v0.5 and v0.6 are unaccepted. Pass 050 prepares v0.4/v0.5.
- **Customization:** limited to discovered items.
  - No ornaments from the tank's own six props in the catalog.
  - The outer-world fish and Antarctic life are not unlockable for the tank.
  - The kelp-forest life for the tank (garibaldi, a bat ray pup) was proposed but never agreed.
- **Sound:**
  - No distinct soundscapes per environment beyond the shared water texture and a few calls.
  - The office and water mixes have had no comfort check on real hardware since v0.3.
- **Browser validation:**
  - The full regression was last run at Pass 040 (rc.1).
  - Passes 041–048 rely on unit tests and per-pass harnesses.
  - The ice harnesses and the long-session memory harness have never been run.
- **Performance:**
  - The worst-frame build time when entering a world is still about 140–190 ms on SwiftShader (environment pieces).
  - It has never been measured on the MacBook Air.
- **Devices:** no Safari, Firefox or touch coverage, and no accessibility review beyond reduced motion and keyboard access.

**Outdated documents (fixed in this pass):**

- **ROADMAP:**
  - Pass 038 (fish inside the glass) was missing.
  - A stale "Provisional, to agree after the user plays Pass 032" block was presented as current.
  - The title still said "provisional roadmap" with no status table.
- **README:**
  - It called the roadmap "provisional" with no status.
  - The Pass 019 section said "v0.4 Personalization, v0.5 Beyond the Glass", which was superseded by the later swap. That text is historical, so a correction note was added rather than a rewrite.
- **README per-pass notes (not fixed here):** they stop at Pass 040. Passes 041–048 are described only in the roadmap and their validation records. Backfilling them is left to a later documentation pass.
- **AGENTS.md:** the vision line says "v0.4 adds a hidden passage … v0.5 lets the player personalize … v0.6 adds new environments". That is still accurate, so no change was made.

**Process finding:** #77 and #78 were stacked PRs that merged into their base branches, not `main`. #79 lands them. Future stacked work should be retargeted to `main` before merging.

## 8. Unresolved product decisions

These need the user's decision. Nothing is removed until then.

1. **Geographic direction.**
   - **The question:** the aquarium was established as a tropical reef (Pass 007, accepted with v0.2), and the outer reef continues it. The newer worlds are temperate (kelp forest, sea cave) and polar (under the ice). Is Cozy Diver a tour of many oceans reached through one tropical tank, or should later worlds lean back toward the tropics?
   - **The polar bear:** included by request, though polar bears live only in the Arctic and the rest of the ice world is Antarctic. Keep it as a deliberate whimsy, relabel the world as "polar" rather than Antarctic, or replace it?
2. **What unlocks for the tank from the temperate and polar worlds:** for example, a kelp stand and an arch are already unlockable; animals are not. Should tank-sized penguins or seals exist, or should the tank stay tropical?
3. **Closing v0.6:** v0.6 has had content added after its first candidate (rc.1 → rc.10). Should v0.6 freeze content now and move remaining ideas to v0.7, or take one more world first?
4. **v0.1 acceptance:** should v0.1 be recorded as accepted implicitly through the v0.2 acceptance, or explicitly?

## 9. Recommended next steps

1. **Merge #79**, so that `main` holds Passes 047–048.
2. **Run the full browser regression and the long-session harness** on `0.6.0-rc.10`, and record the results (scheduled for the next full run-through).
3. **Pass 050:** v0.4/v0.5 acceptance preparation, then the user's macOS play-through of v0.4 and v0.5 together.
4. **Decide the open questions in §8**, then freeze v0.6 content and do a v0.6 acceptance play-through.
5. **v0.7 Polish, then v0.8 Beta**, as proposed in [ROADMAP.md](ROADMAP.md).
