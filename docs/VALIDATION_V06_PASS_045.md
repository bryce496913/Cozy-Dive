# v0.6 Pass 045 — Sea cave life (`0.6.0-rc.6`)

Date: November 17, 2026. By user request; the last of three passes adding life (outer reef, kelp forest, sea cave). No merge or release is authorized by this note.

## New art

- **Nurse shark** (`tools/art/pass045/nurse_shark.py`, Pass 025/033 helpers):
  - about 2.6 m long;
  - a broad, flattened head with barbels;
  - two rounded dorsal fins set far back, broad pectorals, and a long tail whose upper lobe trails straight back;
  - tawny brown;
  - 601 KB compressed.
- **Built in code:**
  - cleaner shrimps (red and white, with long white antennae);
  - lionfish (banded bodies; dorsal spines and pectoral fan rays, all drawn in one instanced draw);
  - the flashlight fish's light organs;
  - a rock ledge.
- **Reused:**
  - the tank's moray, which can now take a given hole instead of finding one in a reef rock;
  - the green turtle;
  - the reef's octopus;
  - the chromis rig, recoloured, for the flashlight fish and the visiting soldierfish.

## Behaviour

- **Moray:**
  - in a crack low in the right-hand wall, under a hood of rock;
  - peeks, rests with its head out gaping slowly, and pulls back when approached (the tank moray's behaviour).
- **Flashlight fish** (18):
  - a loose group in the darkest corner, at the back on the left;
  - each has a bright blue-green light under its eye that ignores the murk, mostly lit and shuttered briefly every few seconds.
- **Sleeping turtle:**
  - asleep on the sand by a boulder near the front, breathing slowly;
  - every 2.5–4 minutes it rises up the sunbeam to the hole in the roof, breathes there for a few seconds, and sinks back to the same spot.
- **Nurse shark:**
  - asleep on the sand under a rock ledge against the back wall; the ledge is solid;
  - its tail stirs slowly, and sweeps more if you come within about 2 m.
- **Cleaner shrimp station:**
  - six shrimps on the left-hand wall;
  - every 40–80 s a soldierfish comes and hangs still, head down, while most of the shrimps climb over it for 10–16 s; then it leaves and they go back to the rock.
- **Octopus:** in a den at the foot of a boulder on the left. It creeps between the boulders nearby, changes colour, and hides when approached.
- **Lionfish** (two, on boulder tops):
  - rest with fins folded;
  - when you come within about 2.6 m, they turn to face you, fan their pectoral fins wide and raise their dorsal spines;
  - they settle again once you back off.
- **Placement:** every nook is kept clear of the resting whitetips' places and the pool of light.
- **Sightings:** moray eel, flashlight fish, nurse shark, cleaner shrimp and lionfish are new. The turtle and the octopus count under their existing sightings.

## Checks

- **Static checks and tests:** typecheck, lint and build pass. `npm run test` has 604 passing, with new tests for:
  - the nooks being inside the cave and clear of the sharks' places and the light;
  - the ledge roofing the shark;
  - the turtle's breath cycle;
  - the cleaning visit, with shrimps on the fish;
  - the lionfish fanning out, turning, and settling;
  - the lights' blinking.
- **Browser check** (`validation/cave-life.mjs`, SwiftShader at DPR 0.5) passes on its first run with no page errors. It swims tank → outer reef → kelp forest → grotto → cave, then:
  - photographs the moray's crack, the flashlight fish with all 18 lights, and the nurse shark under its ledge;
  - photographs the turtle asleep, then breathing at the roof (on cue);
  - photographs a soldierfish at the cleaner shrimps (on cue), the octopus out and then hidden in its den;
  - confirms the lionfish fanned out (spread 0.998).
- **Sightings counted:** moray eel, flashlight fish, green sea turtle, cleaner shrimp, octopus and lionfish. The nurse shark wasn't looked at long enough in the run to count.
- **Fixed after the run:** the lionfish's fin membranes read as flat slabs and were made thin, tapering slivers. A second full run also passed with no page errors, and its lionfish screenshot is the one kept.
- **Screenshots:** `docs/screenshots/pass045/`.
- **Not measured:** real-GPU frame time.

## Known limitations

- The lionfish's fins are simple banded rays with a sliver of membrane, not a continuous fan.
- The soldierfish at the cleaners is drawn at the chromis rig's size (smaller than the schooling soldierfish).
- The shrimps are tiny. Their sighting needs you to come close to the wall patch.
