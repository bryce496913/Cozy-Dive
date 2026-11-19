# v0.4 and v0.5 acceptance (Pass 050)

**Status: acceptance-ready, not accepted.** v0.4 (First Passage) and v0.5 (Personalization) remain open until the user completes the macOS play-through below and says so. Passing automated checks does not close either milestone.

- **Build under test:** `0.6.0-rc.11`. v0.4 and v0.5 are tested as they exist in the current build, which also contains v0.6. Their last stand-alone candidates were `0.4.0-rc.3` and `0.5.0-rc.1`; everything they contained is still present, except where later passes deliberately changed it (listed in §4).
- **Evidence limits:**
  - All automated evidence is Linux Chromium with SwiftShader software rendering.
  - It says nothing about MacBook Air frame time, Safari, audio comfort or how the game feels.
  - By agreement, the long browser harnesses were not run in this pass; they are part of the scheduled full run-through (§5).

## 1. Records reviewed

| Record                                                                                                                       | What it established                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [VALIDATION_V04_PASS_023](VALIDATION_V04_PASS_023.md) … [028](VALIDATION_V04_PASS_028.md)                                    | The passage, outer reef, big creatures, the wall and the blue, the glass office, and a full regression at `0.4.0-rc.1`. The v0.4 macOS checklist is in Pass 028 §5. |
| [VALIDATION_V04_PASS_026_PLAYTEST](VALIDATION_V04_PASS_026_PLAYTEST.md), [028_PLAYTEST](VALIDATION_V04_PASS_028_PLAYTEST.md) | The user's playtest feedback: thicker water, a natural crevice, the overhang on its buttresses, and the desk chairs. All of it was addressed.                       |
| [VALIDATION_OUTER_REEF_LIFE](VALIDATION_OUTER_REEF_LIFE.md), the two outer-reef hotfixes                                     | `0.4.0-rc.3`: more reef life, visibility and the viewing edge.                                                                                                      |
| [VALIDATION_V05_PASS_029](VALIDATION_V05_PASS_029.md) … [031](VALIDATION_V05_PASS_031.md)                                    | The tank catalog, the babies, a code review, a full regression at `0.5.0-rc.1` and the v0.5 macOS checklist (Pass 031 §6).                                          |

**Feedback still open:** none from v0.4/v0.5 playtests. Every recorded item was addressed in a later candidate. The user has not yet done the full play-through of either milestone.

## 2. Audit findings and fixes

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                            | Severity                                                                | Status                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A save could be emptied by one edit.** Loading skips additions and babies the tank cannot show this visit: not unlocked (for example, after the sightings were cleared or corrupted) or no longer fitting the placement rules. The next placement, move or removal then saved without them, losing them permanently. A save written by a newer version was likewise overwritten. | Acceptance-blocking for v0.5 ("saved aquarium state"; malformed saves). | **Fixed.** `keptEntries()` remembers what was skipped (up to 40 entries, well-formed ids only) and `saveTank()` writes them back unchanged after your own additions. They return once they can be shown again. A newer-version save is never overwritten; a quiet notice says changes last for this visit. **Restore the original tank** still clears everything, kept entries included. Tests: `tests/tank-save-safety.test.ts`. |
| 2   | **Crossing tests covered only the tank's crevice.** The other seven crossings (outer ↔ kelp ↔ cave ↔ ice, and back) had no direct test of carry-over or bounce-back.                                                                                                                                                                                                               | Coverage gap (no defect).                                               | **Covered.** `tests/passage-transitions.test.ts` checks all eight directions. For each: the crossing comes just past the threshold; position round-trips exactly; speed and climb are kept; the look turns by exactly the frames' difference; swimming on never hands you straight back; and a world that is not ready is never entered. All pass on the existing code.                                                           |

No other reproducible defect was found in the reviewed areas.

## 3. Consolidated manual test matrix

Each row lists where it is covered automatically (U = unit test file, H = browser harness) and what to check by hand. Harness results come from the last full regression (Pass 040, `0.6.0-rc.1`) unless marked.

| Area                                         | Automated coverage                                                                                                                                  | Manual check (macOS) |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Aquarium interactions (swim, look, bounds)   | U `swimming`, `collision`, `controls`; H `browser`, `integration`                                                                                   | A1–A3                |
| Ornaments and their effects                  | U `ornaments`; H `ornaments`                                                                                                                        | A4                   |
| Local creature behaviour (anchored, hidden)  | U `anchored-life`, `seahorse-grip`, `rock-den`, `hidden-discoveries`; H `anchored-life`, `discoveries`                                              | A5                   |
| Hidden crevice discovery                     | U `passage`; H `passage`                                                                                                                            | P1                   |
| Entering and returning, all connected worlds | U `passage`, `passage-transitions` (new), `kelp-passage`, `sea-cave`, `under-ice`; H `passage`, `kelp-forest`, `sea-cave` (`under-ice` not yet run) | P2–P5                |
| Position, look and momentum across crossings | U `passage-transitions` (new), `passage`, `dive`                                                                                                    | P2, P3               |
| Sightings journal                            | U `journal`, `big-creatures`; H `big-creatures`                                                                                                     | S1–S3                |
| Add, move, turn, remove, save tank objects   | U `tank-catalog`, `tank-save-safety` (new); H `tank-catalog`                                                                                        | T1–T5                |
| Add and return miniature animals             | U `tank-babies`, `tank-babies-lifecycle`, `tank-baby-models`; H `tank-babies`                                                                       | B1–B3                |
| Storage migration, malformed saves, reset    | U `tank-babies` (v1 → v2, corrupt data), `tank-save-safety` (new), `journal`, `settings`                                                            | R1–R4                |
| Pause/resume and audio transitions           | U `audio-*`, `office-audio-lifecycle`, `dive`; H `dive-interrupt`, `lifecycle`                                                                      | X1–X4                |
| Office miniature shows the tank              | U `tank-outlook`; H `tank-catalog`, `tank-babies`                                                                                                   | T5, B3               |

## 4. macOS playtest checklist (v0.4 and v0.5 together)

**Setup**

1. Run `npm ci`, `npm run build` and `npm run preview`. Open the printed address in Chrome; repeat the starred (★) steps in Safari if you can.
2. Use a fresh profile, or clear site data, so that discovery starts from nothing.
3. Settings → turn on **Show frame time**.

Record the mean and p95 frame times where asked. Target: about 16.7 ms mean, with p95 well under 33 ms.

**Office and tank (A)**

- [ ] **A1 ★** Walk to the tank and dive. Expected: the dive is seamless, and the blurred glass office fades in behind the glass only once you are in the water. _Record frame time in the office and in the tank._
- [ ] **A2** Swim to each of the six walls, the floor and the surface. Expected: a soft stop with no jitter or seeing through rock or glass.
- [ ] **A3** Hold W and look around. Expected: one steady speed; on release, a glide that settles. Diagonals are not faster.
- [ ] **A4** Visit each ornament (boat, chest, filter, and the others). Expected: the bubbles and effects are calm, and the filter sits at the top corner.
- [ ] **A5** Visit the anemone and clownfish, moray, seahorse, frogfish and the hidden animals. Expected: each behaves locally and calmly; the moray pulls back as you approach.

**The passage and connected worlds (P)**

- [ ] **P1** Find the crack at the back of the tank without help. Expected: hidden but findable; rock-like edges and a dark centre.
- [ ] **P2 ★** Swim in steadily, without stopping, through to the outer reef. Expected: no stop, jump or change of speed, and your heading is kept. _Record frame time on the reef top and at the lip._
- [ ] **P3** Turn round and swim back into the tunnel to the tank. Expected: just as smooth; you come out of the crack facing into the tank.
- [ ] **P4** Pause → **Return to the tank** from the outer reef (and, optionally, from the kelp forest, sea cave and under the ice). Expected: a calm fade, just outside the crack, level and at rest.
- [ ] **P5** (v0.6, optional here) The cleft to the kelp forest, the grotto to the sea cave and the back tunnel to the ice: in and back once each, without hitches.

**Sightings (S)**

- [ ] **S1** Look at a shark, eagle ray, turtle, a coral and the seagrass from nearby for a moment. Expected: a quiet "New sighting" note each time, never repeated for the same thing.
- [ ] **S2** Pause → **Seen in the outer waters**. Expected: names and the first-seen day, with no counts.
- [ ] **S3** Reload. Expected: the list is unchanged.

**Tank objects (T)**

- [ ] **T1** In the tank, pause → **For your tank**. Expected: only what you have seen is offered.
- [ ] **T2** Choose a coral: the preview follows your view. **R** turns it in 30° steps; unsuitable spots dim quietly; **F** or a left click places it. Expected: it is seated naturally on sand or rock.
- [ ] **T3** Look at it, press **G** to move it, then press **Escape**. Expected: it stays where it was. Move it again and place it.
- [ ] **T4** Look at it and press **X**. Expected: it is removed. Add about 20 items, up to the cap. Expected: a gentle limit with no error. _Record frame time._
- [ ] **T5** Reload, then surface to the office. Expected: the tank is identical after the reload, and the office miniature shows the additions.

**Babies (B)**

- [ ] **B1** **Add to the tank** the shark, ray and turtle babies. Expected: calm, charming, a believable size, and they give you room without clipping rock, glass or additions.
- [ ] **B2** Watch for a minute. Expected: no stutter every few seconds. _Record frame time with 20 additions and 3 babies._
- [ ] **B3** **Return it to the sea** for one baby, reload, and check the office miniature. Expected: that baby is gone; the others remain and show in the miniature.

**Saves and reset (R)**

- [ ] **R1** Settings → **Restore the original tank** → **Keep my tank**. Expected: nothing changes.
- [ ] **R2** Restore → **Restore tank**. Expected: all additions and babies are removed, your sightings are kept, and a reload shows the original tank.
- [ ] **R3** (Pass 050 fix) Add two items, then in DevTools → Application → Local Storage delete only `cozy-diver.journal.v1`, and reload. Expected: the tank shows no additions, because nothing is unlocked. Look at more sightings, unlocking at least one item, and place one. Then restore the journal: re-sight everything, or reload with the deleted key restored from a copy. Expected: the earlier additions come back rather than being lost.
- [ ] **R4** Set `cozy-diver.tank.v1` to `{` (corrupt) and reload. Expected: the original tank with no errors; decorating still works.

**Pause, resume and audio (X)**

- [ ] **X1 ★** Press **Escape** mid-swim. Expected: movement stops and the sound fades. Resume. Expected: your view is kept, with no drift.
- [ ] **X2** Switch tabs mid-swim and come back. Expected: paused, the sound is suspended, and held keys are cleared.
- [ ] **X3** Dive and surface a few times. Expected: the soundscape crossfades smoothly with no clicks; **M** mutes and unmutes.
- [ ] **X4** Turn on reduced motion. Expected: the dive, surfacing and switches become short fades, and the seagrass is still.

**Long session**

- [ ] **L1** 20–30 minutes moving between the office, the tank and the outer reef, with some decorating. Expected: stays smooth, with no audio or visual glitches and no growing hitch.

**Report back:** which items failed (with the step number), the frame-time readings, and whether v0.4 and/or v0.5 are accepted.

## 5. Automated checks in this pass

| Check               | Result                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`     | Pass                                                                                                                                                                                                                                                       |
| `npm run typecheck` | Pass                                                                                                                                                                                                                                                       |
| `npm run lint`      | Pass                                                                                                                                                                                                                                                       |
| `npm run test`      | **678 passed** (68 files), including 15 new tests: 9 in `passage-transitions`, 6 in `tank-save-safety`                                                                                                                                                     |
| Browser harnesses   | **Not run in this pass, by agreement.** For the scheduled full run-through: `passage`, `tank-catalog`, `tank-babies`, `big-creatures`, `outer-reef`, `office`, `dive`, `dive-interrupt`, `lifecycle`, `integration`, plus the v0.6 set and `long-session`. |

## 6. Blocking versus later

**Blocks acceptance (must be clear before v0.4/v0.5 close):**

- ~~Save emptied by one edit (finding 1)~~: fixed in this pass.
- The user's macOS play-through (§4) has not been done.
- The browser regression has not been re-run since `0.6.0-rc.1`; it must pass on the build being accepted.

**Not blocking: belongs in later versions (v0.7 Polish or later):**

- **Placement:** placement is conservative and can refuse spots that look fine near creature homes. This is intended, to keep swim routes clear.
- **Baby models:** they are scaled adults rather than juvenile models.
- **First step after adding a baby:** a single ~12 ms step, behind the catalog action.
- **Storage:** saves live in this browser profile only, so clearing site data resets them. There is no export or import.
- **Undo:** there is no undo beyond Escape while moving.
- **Turning:** rotation is in fixed 30° steps.
- **Outer-reef triangles:** 1–1.7 M on the outer reef; measured on SwiftShader only.
- **Pass 051:** the catalog will be extended with fish, more decorations and a versioned migration. It builds on this pass's save safety.

## 7. Known limitations of this evidence

- **Frame-time targets:** the frame-time targets are unverified on the MacBook Air.
- **Browsers:** no Safari or Firefox runs.
- **Audio:** comfort is subjective and untested by automation.
- **Real hardware:** the kept-entries fix is unit-tested only. R3 is the manual check that exercises it in the browser.
