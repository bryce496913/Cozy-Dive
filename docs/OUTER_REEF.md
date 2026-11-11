# The outer reef (v0.4 Pass 024)

Pass 024 replaces Pass 023's placeholder beyond the tunnel with a real reef, dressed from the same authored library as the tank. You reach it through [the hidden passage](PASSAGE.md).

## What is there

- **The seabed.** It is a pure height function, used by the terrain mesh, the swimmer's floor, the fish and the layout:
  - a sand plain with a gentle swell;
  - a winding sand channel leading away from the cliff;
  - a drop-off about 70 m out, falling 23 m into deep blue.
- **Coral heads.** Eleven bommies, 13 m or more apart:
  - each is three to five half-buried reef rocks, crowned with colonies;
  - massive corals ring their feet, with soft corals and sea fans on their flanks;
  - every colony is seated exactly on the rock beneath it (the top of its convex hull).
- **Around them:**
  - lone colonies on the sand;
  - six seagrass meadows along the channel's banks;
  - about 300 shells and pieces of rubble;
  - a line of reef along the drop-off's lip, with a rocky wall below;
  - big low-detail rocks framing the sides.
- **Reef fish.** About 100 fish in six schools, each gathered beside a coral head: two big chromis schools, then cardinalfish, firefish, assessors and grammas. They use the tank's own species, behaviour and authored rigs, so no new species yet; those need new models and come with Pass 025's modelling.
- **Soft edges.** No glass and no walls. Within 8 m of the comfortable reef's edges (and above 30 m), a gentle current turns you back. It works through your velocity, so collision still applies, and it never pushes outward (tested).
- **Sound.** The underwater soundscape's small sounds come from the coral heads while you are here.

## How it is built

| Module                                 | Role                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment/outer/OuterTerrain.ts`    | The seabed, the channel, the drop-off and the edge current. Pure.                                                                                                                                                                             |
| `environment/outer/OuterReefLayout.ts` | Seeded placements for every piece and the coral heads. Pure and deterministic.                                                                                                                                                                |
| `environment/outer/OuterReef.ts`       | Dresses the layout from the reef library (leased from the tank's own loader, so nothing decodes twice), with authored hull collision, coarse fish obstacles, sand and rock materials, plant sway on its own clock, and a procedural fallback. |
| `environment/outer/LevelInstances.ts`  | One instanced draw per piece and detail level. Copies are re-sorted by distance a few times a second, and a level can be "not drawn".                                                                                                         |
| `environment/outer/OuterSchools.ts`    | The outer schools: one `FishSystem` with authored schools leased from the tank's fish libraries.                                                                                                                                              |
| `player/terrainCollision.ts`           | A uniform grid hands the solver only nearby hulls (about 1,000 in all), and the seabed is the floor.                                                                                                                                          |

## Budgets

These are measured library costs, in triangles, and the detail distances chosen from them. Fog hides most of what lies past the last distance.

| Piece                           | Full / far              | Drawn                                              |
| ------------------------------- | ----------------------- | -------------------------------------------------- |
| Reef rock                       | 20.5k / 5.1k / 1.3k     | full < 8 m, medium < 22 m, far beyond              |
| Massive colony                  | 82k / 5.1k / 1.3k mound | full < 6 m, far < 28 m, mound < 70 m               |
| Branching colony                | 45k / 16k               | full < 8 m, far < 24 m                             |
| Plate colony                    | 17k (no far level)      | < 28 m                                             |
| Soft coral / sea fan / seagrass | 7–13k / 0.7k / 40       | < 24 m                                             |
| Shells and rubble               | under 0.4k              | < 22 m                                             |
| Reef fish                       | 14k / 1.8k              | full detail within 8 body lengths (14 in the tank) |

Measured views are in the [validation report](VALIDATION_V04_PASS_024.md).
