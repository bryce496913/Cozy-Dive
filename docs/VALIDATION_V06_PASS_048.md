# v0.6 Pass 048 — Antarctic rare encounters (`0.6.0-rc.10`)

Date: November 17, 2026. By user request. Stacked on Pass 047 (its PR is based on that branch). No merge or release is authorized by this note.

## Wildlife inventory (the agreed rare list)

| Encounter           | Model                                                                    | Entrance                                                                      | Behaviour                                                                                                             | Departure                      |
| ------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Leopard seal        | New, authored 3 m: huge reptilian head, long fore flippers, spotted grey | From the far haze, at least 24 m from the swimmer                             | Comes to about 4.5 m and circles side-on, its head turned to the swimmer, for 14–22 s. Never closer than 3 m; gentle. | Glides back out of sight       |
| Minke whale         | New, about 7.5 m: sleek and pointed, white flipper bands                 | Down through the breathing hole furthest from the swimmer (at least 14 m off) | One long, slow pass across the far side of the tank, more than 7.5 m from the swimmer                                 | Up through the hole            |
| Killer whales (3)   | New, about 6.9 m: tall dorsal, white eye patch and belly, grey saddle    | Down through the furthest hole, in line                                       | A wide sweep round the far side, together, more than 7.5 m from the swimmer                                           | Up through the hole, in line   |
| Antarctic toothfish | New, 1.7 m, on the chromis rig: heavy-jawed, dark grey-brown             | Rises from the seabed in the far, dark corner                                 | Hangs in mid-water for 18 s, turning to face the swimmer                                                              | Sinks back to the corner       |
| Colossal squid      | Built in code: two great glowing eyes and the faint shape of its mantle  | Low in the dark at the far end (at least 24 m off); the eyes glow up over 4 s | Hold, blink once (not with reduced motion)                                                                            | Fade away                      |
| Polar bear          | New, 2.2 m: cream fur, black nose, paddling paws                         | Paddling at a breathing hole, seen from below (8–22 m off)                    | Dives down a few metres for an 8 s look round, at least 4 m from the swimmer                                          | Climbs back up out of the hole |

The polar bear is included **by your request**. Polar bears live only in the Arctic, so its place in an Antarctic dive is the open geographic question recorded in Pass 049.

## Scheduling (`RareDirector`)

- **No encounter on arrival:** none comes in the first 70–140 s.
- **Then:** one at a time, chosen at random from those not seen in the last two, with 1.5–3 minutes after each leaves.
- **Reproducible:** the same seed gives the same order and times.
- **Fallback:** if the chosen one can't enter unseen from where the swimmer is, it tries again 10 s later.
- **Restart:** each arrival under the ice starts the schedule over and sends away anything under way.
- **Pause:** everything runs on simulation time and is frozen while paused.

## Observation

- **Only while it's there:** an animal counts as seen only while its encounter is under way. Its sighting candidates are added to the world's list when it starts and removed when it ends.
- **Tolerances:**
  - leopard seal 2.5 m;
  - minke whale 6 m;
  - killer whales 5 m;
  - toothfish 2 m;
  - polar bear 2 m;
  - squid 22 m (it is only ever seen from afar).

## Reduced motion

The squid's eyes don't blink, the leopard seal circles at half pace, and the bear paddles more slowly. Every encounter still happens.

## Modules

- **Models:**
  - `tools/art/pass048/rare.py` (new): leopard seal, minke whale, killer whale, polar bear;
  - `tools/art/pass047/antarctic_fish.py` (extended): the toothfish.
- **Logic (pure):** `src/creatures/iceRare.ts`.
- **Runtime:** `src/environment/ice/IceRare.ts`, using `SoloCreature`, `PosedFish`, and the squid built in code.
- **Under the ice:** `UnderIceScene` tracks `rare encounters` as a part. `Application` calls its `arrive()` on each entry.
- **Sights:** six new ones in `ICE_SIGHTS`.

## Costs

- **Models:** five new, about 2.2 MB compressed. All models together are 32.2 MB; the budget test goes from 30 to 34 MiB, since the Antarctic animals load only under the ice.
- **Draws:** only the encounter under way is drawn (one to three bodies, or the squid's three meshes).
- **Not measured:** real-GPU cost is **unverified**.

## Checks

- typecheck, lint and build pass; `npm run test`: 663 passing.
- **New tests** (`tests/ice-rare.test.ts`):
  - none in the first minute, then one at a time, never twice running, reproducibly, and occasional;
  - for each of the six encounters:
    - it enters out of sight or through a hole;
    - it stays in the water (or in a hole's column) inside the tank;
    - it keeps its distance from the swimmer, and leaves;
  - pause and resume;
  - reduced motion;
  - sightings only while under way, cleared on arrival;
  - names.
- **Lifecycle:** `IceRare` is in the dispose-while-loading suite.
- **Not run here:** browser runs, by request. `validation/ice-rare.mjs` brings each encounter on cue and photographs it; it joins tonight's full regression.

## Remaining V0.6 content concerns

- **Geography:** the polar bear (Arctic) in the Antarctic dive, and the tropical tank beside temperate and Antarctic areas. Both are recorded as open product decisions in Pass 049.
- **Shared holes:** the emperors (Pass 047) and the minke or killer whales can use the same hole within a minute of each other. Rare, but not prevented.
- **The squid:** the tank's seabed is shallow, so the eyes appear low at the far end rather than "far below".
- **No browser check yet:** none of the encounters has been seen in a browser yet; they are checked in tests only until tonight's run.
