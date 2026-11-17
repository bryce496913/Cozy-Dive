# v0.6 Pass 044 — Kelp forest life (`0.6.0-rc.5`)

Date: November 17, 2026. By user request; the second of three passes adding life (outer reef, kelp forest, sea cave). No merge or release is authorized by this note.

## New art

- **Authored from scratch** (`tools/art/pass044/kelp_creatures.py`, using Pass 025/033 helpers):
  - **sea otter** (1.2 m): sculls with its tail and hind feet;
  - **leopard shark** (1.5 m): with dark saddles and spots;
  - **harbour seal** (1.6 m): freckled grey, with no ear flaps and hind flippers that sweep side to side;
  - **western gull** (1.4 m wingspan): its stroke is the wingbeat.
- **On the accepted chromis rig** (`tools/art/pass044/kelp_fish.py`, Pass 043's method):
  - **giant sea bass** (2.2 m): dark, black-spotted;
  - **California sheephead** (a male): black head and tail, red middle, white chin.
- **Built in code:** Spanish shawl nudibranchs, and kelp crabs (the cave crab's body, olive).
- **Size:** about 2.9 MB compressed.

## Behaviour

- **Sea otter:**
  - floats on its back just under the surface, drifting and turning slowly, sculling now and then (you see it from below);
  - every 40–80 s it rolls over, dives to an urchin, forages there for a few seconds, and comes back up to float.
- **Leopard sharks** (three): cruise along the sandy lane below the bat rays, lifted clear of the boulders. They count as sightings like the other cruisers.
- **California sheephead** (three): go from urchin to urchin, biting each a few times (a small puff each time; no puffs with reduced motion), and shy from a close swimmer.
- **Spanish shawl nudibranchs** (26): creep very slowly over the boulders.
- **Kelp crabs** (20): cling to kelp stalks low down, climbing a little way up and down. If the swimmer comes close, a crab sidles round to the far side of its stalk.
- **Harbour seal:**
  - roams the forest;
  - when the swimmer comes within 14 m it holds off about 9 m away and turns to watch them;
  - if they come closer than 7 m it backs away quickly to keep its distance;
  - after a while it leaves, and rests before watching again.
- **Giant sea bass (rare):** a check every 2.5–5 minutes, 30 % chance. It appears at least 20 m from the swimmer (lost in the green), cruises slowly past about 5 m from them, and swims away out of sight.
- **Gull (spot encounter):** a check every 1.5–3.5 minutes, 35 % chance.
  - It plunges in from the surface with its wings folded, near the swimmer.
  - It paddles down to the sand 5–8 m from them and pecks 3–5 times, with a puff each time.
  - It then swims back up and out.

## Checks

- typecheck, lint and build pass.
- `npm run test`: 598 passing. New tests cover:
  - the otter's float, dive and rise;
  - the seal keeping its distance;
  - the sea bass arriving out of sight, passing close and leaving;
  - the gull's plunge, pecks and exit;
  - the critters, and the leopard sharks low over the sand.
- **Updated expectations:**
  - the forest's cruiser count (4 → 7);
  - the model download budget (26 → 30 MB; each area's models load only on entering it).
- **Browser check:** `validation/kelp-life.mjs`, SwiftShader at DPR 0.5. See the PR for the result. Screenshots are in `docs/screenshots/pass044/`.

## Known limitations

- The gull enters from above the surface. The forest's surface is seen from below only, so it simply appears there.
- The nudibranchs and crabs are tiny. Their sightings need you to come close, as for the lobsters.
- The seal and the sea lion don't avoid each other.
