# v0.6 Pass 041 — Play-test fixes (`0.6.0-rc.2`)

Date: November 17, 2026. By user request. No merge or release is authorized by this note.

## Changes

- **Outer reef coral pop-in:** while the swimmer is in the tunnel, every coral detail level is primed with one instance (`LevelInstances.primeAll`) so the warm-up compiles and uploads them all, then the levels are re-sorted for the real view. Levels first shown mid-swim no longer upload (and pop) on the fly.
- **A smaller kelp forest:** its walls are at x ±24 and z -60 (were larger). The kelp, boulders, light shafts, fish homes and the sea lion's roam are fitted to the new size, and every fish's habitat is bounded inside the walls.
- **More kelp-forest life:** three schools of blacksmith in mid-water and three loose groups of señorita lower down, both new sightings.
- **Startled sharks:** a swimmer within about 3 m of a resting whitetip makes it bolt away with hard tail beats, lifting off the sand. It then swims calmly to the free resting place furthest from the swimmer and settles there, and it can't be startled again for a few seconds. With reduced motion it swims off without the burst.
- **Lobster dens:** each lobster lives in a dark hole under a hood of rock ringed by stones. It backs right into the dark when the swimmer comes close.
- **Hanging formations:** three templates, each a rock boss with a cluster of fluted, drip-bulged stalactites and thin soda straws. There are 64 of them, up from 46 single lumps.
- **More rock and life in the cave:**
  - eight more boulders against the walls and in the corners, each with its own lobster den;
  - 44 stalagmites by the walls and the rocks;
  - four loose groups of red soldierfish in the shade by the rocks;
  - 18 rock crabs that walk round the rocks' feet and scuttle to the far side when the swimmer comes close;
  - soldierfish and rock crab are new sightings.

## Checks

At the user's request, no tests or browser runs were made for this pass; the user tests in game. Only `tsc --noEmit` and `npm run format` were run.

## Known limitations

- Stalagmites have no colliders: the swimmer and fish can pass through the small ones by the rocks.
- Crabs can walk across a lobster den's mouth.
- A fleeing shark is steered in from the walls and lifted over rocks, but it is not a full collision check against the new boulders.
- The lobster harness and unit test may need their retreat expectations re-checked against the deeper retreat (0.72 m).
