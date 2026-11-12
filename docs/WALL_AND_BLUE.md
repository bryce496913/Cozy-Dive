# The wall and the blue (v0.4 Pass 026)

Pass 026 reshapes [the outer reef](OUTER_REEF.md) as a wall dive, following the direction of a dive instructor with almost 10,000 dives: fake scale with the reef's edge, the fade into the blue and the big animals passing in it.

## The experience

1. **The tunnel is the loading screen.** You cross from the tank into the dark tunnel as soon as its rock is ready. The reef beyond it, its fish and creatures are built and their shaders compiled while you swim through. Until they are ready, the light beyond the exit stays dark and swimming eases to a stop a few metres before it. Then the light opens over about two seconds.
2. **A breathtaking arrival.** You come out over a dense reef top:
   - eight bommies rising from a near-continuous reef of rock and coral;
   - a narrow sand gully leading the eye towards the edge, with a little seagrass;
   - two big chromis schools clouding over it, and smaller fish low over the coral.
3. **The edge is close.** The reef's lip is about 26 m from the tunnel mouth. Below it a steep wall falls 38 m into the dark, with rocks, sea fans and soft corals jutting from its face. Beyond its foot the bottom keeps falling away, out of sight.
4. **Distance fades from blue to dark.** A water dome around the eye is lighter towards the surface, deep blue at the horizon and near-black below. The fog fades everything towards the dome's horizon colour, so the reef, the wall and the animals sink into the same blue. Going deeper, the horizon darkens, the fog thickens and the light dims.
5. **Swimming slows to a hover near the edges.** There is no current pushing you back and no wall to hit. Movement towards an edge eases smoothly to almost nothing, then stops; movement back is never slowed:
   - out over the blue, over 7 m past the lip;
   - down the wall, between 6 and 13 m deep;
   - at the sides, 24–31 m from the middle;
   - up high, above 12 m.
6. **The big animals pass by in the blue.** The sharks, eagle rays and turtle from Pass 025 now cruise long loops along the wall, at different depths and distances. Hovering past the lip, something passes every half-minute or so. Big animals count as seen from 3 m further across the clear blue.

## How it is built

| Module                                  | Role                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/passage.ts`                     | The lip and wall (`dropOff`), the falling bottom beyond it (`abyss`), the reachable area (`reach`), the gully and the fog.                                                                                        |
| `environment/outer/OuterTerrain.ts`     | The seabed (now with the wall and the abyss), and `easeAtEdges` / `easeFactor`: pure soft limits.                                                                                                                 |
| `environment/outer/OuterReefLayout.ts`  | Bommies, the reef matrix, sand corals, seagrass, rubble, the crowded lip, the wall's rocks and fans, and side framing. Pure and seeded.                                                                           |
| `environment/outer/OuterEnvironment.ts` | The seabed is split: the reef top wears the reef's sand, the wall the reef's rock, darkening with depth. Shafts and particles hang over the lip and the blue.                                                     |
| `environment/outer/WaterDome.ts`        | The blue: a gradient dome on the far plane, and the horizon colour the fog follows; `depthShade` drives darkening with depth.                                                                                     |
| `environment/outer/OuterReef.ts`        | Detail distances retuned for the denser reef; far massive colonies become mounds in their colony's own colour; distant rocks stop being drawn where the fog has them; `begin()` defers building until the tunnel. |
| `environment/outer/OuterSchools.ts`     | Schools placed over the reef top at heights taken from the reef's own tops; distant fish leave out their sub-pixel eyes.                                                                                          |
| `environment/outer/OuterCreatures.ts`   | Routes in the blue along the wall.                                                                                                                                                                                |
| `rendering/OuterWatersScene.ts`         | Two-stage preparation (`prepared`: the tunnel; `reefPrepared`: the reef), the dark exit and the reveal, and depth-dependent light and fog.                                                                        |
| `app/Application.ts`                    | Crossing into the outer waters starts the reef's preparation; swimming direction passes through the world's `ease` before integration.                                                                            |

## Budgets

The reef top is several times denser than Pass 024's reef, in a smaller area. Detail distances were cut to fit (all in metres):

| Piece                     | Pass 024 levels                | Pass 026 levels                            |
| ------------------------- | ------------------------------ | ------------------------------------------ |
| Reef rock                 | full < 8, medium < 22, far     | full < 4, medium < 10, far < 40, then none |
| Massive colony            | full < 6, far < 28, mound < 70 | full < 2.5, far < 13, coloured mound < 40  |
| Branching colony          | full < 8, far < 24             | full < 3.5, far < 12                       |
| Plate colony              | < 28                           | < 13                                       |
| Soft coral, fan, seagrass | < 24                           | < 13                                       |
| Shells and rubble         | < 22                           | < 12                                       |

The fog is denser (0.04, up from 0.02), so what is no longer drawn has already faded into the blue. Measured views are in the [validation report](VALIDATION_V04_PASS_026.md).
