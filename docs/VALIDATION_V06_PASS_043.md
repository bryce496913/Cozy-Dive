# v0.6 Pass 043 — Outer reef life (`0.6.0-rc.4`)

Date: November 17, 2026. By user request; the first of three passes adding life to the outer reef, kelp forest and sea cave. No merge or release is authorized by this note.

## New art

- **Seven reef fish on the accepted chromis rig.** They are made with Pass 016's reshape method (`tools/art/pass043/reef_fish.py`), so each keeps the rig's morphs, pectoral pivots and a distance level:
  - blue tang;
  - threadfin butterflyfish;
  - Moorish idol;
  - longfin bannerfish;
  - parrotfish;
  - bigeye trevally;
  - humphead wrasse, with a bulging forehead.
- **Two big animals, authored from scratch** (`tools/art/pass043/big.py`):
  - a great white: about 5.7 m at runtime, smaller than the whale shark (8 m) and the humpback (12.6 m);
  - an ocean sunfish: about 2.2 m long and 3 m from fin to fin. Its tall dorsal and anal fins beat together.
- **Size:** all compressed; together 5.0 MB.
- **Octopus:** built in code. It has a wrinkled mantle and eight arms rewritten each frame with no allocations. It lives in the lobsters' den geometry.

## Behaviour

- **Parrotfish** (4): go from coral to coral and bite each 3–6 times, nose-down. Each bite throws up a small puff of sand that billows and settles (puffs are off with reduced motion). They shy from a swimmer who comes too close.
- **Blue tang** (36 and 26): two schools in big moving clouds over the reef top.
- **Butterflyfish (3 pairs) and Moorish idols (2 pairs):** always in twos, low over the coral.
- **Humphead wrasse:** roams the reef slowly. Now and then it comes to about 3 m from the swimmer, turns side-on to look at them for 10–16 s, then leaves, and won't come back for a minute or so.
- **Octopus:**
  - sits in its den, then creeps out to rocks nearby and back;
  - takes on the colour of the sand or the rock it is on;
  - when the swimmer comes within about 2.6 m, flushes dark, hurries home and pulls into its den;
  - comes out again once they have gone.
- **Bigeye trevally:** now and then a tight ball of 48 drifts in from the haze, circles beyond the glass for a couple of minutes and drifts away. It works like the barracuda (`CirclingVisit`, with a ball shape).
- **Cleaning station (very rare):**
  - twelve longfin bannerfish live loosely, in pairs, just beyond the glass;
  - the sign: they gather into a tight milling school at one spot for 45 s;
  - an ocean sunfish then rises from the deep (always in the haze at first) and hovers side-on to the glass, tilted, about 5 m beyond it;
  - the bannerfish dart in to pick at its sides for 2.5–3.5 minutes, then it sinks away;
  - chance: a check every 4–7 minutes with a 15 % chance.
- **Great white (rare):** a check every 3–5 minutes, 25 % chance. It swims the full length of the glass in a slow, sinuous line, its near side about 1.4 m beyond the glass, starting and ending out of sight past the side panes.
- **Sightings:** every new species is one. The schooling ones count by following a fish; the rare ones while they are there.

## Depth limit

Every big animal now passes no deeper than 8 m below the reef's lip (body middle), where the swimmer can see it from the lip.
- **Reef animals:** the deep blacktip went from 15 m down to 5.5 m; the turtles from 7.5 and 10.5 m to 4.5 and 6 m.
- **Wall visitors:** the scalloped hammerheads went from 9.5 m to 5.5 m.
- **Restacked to stay apart:** the other lanes were moved within that band so they still pass clear of each other.

## Checks

- **Static checks and tests:** `npm run typecheck`, `npm run lint` and `npm run build` pass. `npm run test` has 586 passing, with new tests for:
  - the depth limit;
  - schools inside the glass, and the idols in pairs;
  - grazing bites;
  - the wrasse's look at a distance;
  - the cleaning sequence beyond the glass, and its rarity;
  - the great white's close pass outside the glass;
  - the octopus hiding and coming out.
- **Updated expectations:**
  - the reef's school count (235 → 307);
  - the model download budget (20 → 26 MB; all of the new models load only on entering the outer reef).
- **Browser check** (`validation/reef-life.mjs`, SwiftShader at DPR 0.5) passes with no page errors:
  - 4 parrotfish grazing, with sand puffs showing;
  - 62 blue tang, and 10 butterflyfish and idols in pairs;
  - the wrasse comes over and looks;
  - the octopus is out, then hidden in its den when approached;
  - the bannerfish gather, then the sunfish rises and is cleaned;
  - the great white passes close by the glass;
  - the trevally circle.
- **Sightings:** all eight new ones counted on sight.
- **Screenshots:** `docs/screenshots/pass043/`.
- **Earlier runs caught and fixed:**
  - the idol and bannerfish streamers were far too tall, so the models failed validation;
  - the cleaning station sat behind a glass frame bar;
  - the octopus floated above the coral by its den.
- **Not measured:** real-GPU frame time with everything present.

## Known limitations

- The octopus walks over rock tops by the reef's height map. It doesn't wrap its arms round them.
- The wrasse and the parrotfish don't collide with other fish.
- The cleaning encounter is very rare by design. The harness starts it on cue.
- The stones round the octopus's den are faceted low-poly (the lobsters' den geometry).
