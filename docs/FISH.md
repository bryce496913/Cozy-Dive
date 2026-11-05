# Fish simulation — v0.2 Pass 002

The environment owns 16 freshwater fish: 8 neon tetras form moderately cohesive schools, 6 harlequin rasboras coordinate in looser groups, and 2 honey gouramis remain independent. All fish have size-aware personal space. Models, animation, seeded initial variations, fixed timing, player movement, and resource ownership are preserved from Pass 001. There is no feeding, behavior state machine, fish-player reaction, or fish UI.

## Modules and ownership

| Module             | Responsibility                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FishSpecies.ts`   | Registry: counts, body proportions/profiles, appearance, habitat, speed/turn/acceleration limits, wander timing, tail cadence; simulation/steering tuning                      |
| `FishEntity.ts`    | Authoritative pure individual state: position, velocity, heading, size, temperament, persistent target, seeded RNG, animation phase; previous samples solely for interpolation |
| `FishSpawner.ts`   | Reproducible population and individual variation; bounded placement attempts, habitat validation, body spacing, player-start clearance                                         |
| `FishHabitat.ts`   | Read-only aquarium bounds and existing convex rock data; body containment checks without Three.js or player physics                                                            |
| `FishMovement.ts`  | Individual locomotion, safety-prioritized social blending, acceleration/heading limits, 30 Hz accumulator, bounded catch-up, final containment guard                           |
| `FishSchooling.ts` | Stable step-snapshot neighbor evaluation, all-species separation, same-species alignment/cohesion, reusable bounded scratch buffers                                            |
| `FishGeometry.ts`  | Shared per-species organic lofted bodies, curved skin markings, fins, eyes, articulation templates, exact resource ownership                                                   |
| `FishSystem.ts`    | Bridge from simulation to interpolated Object3D transforms; render animation, reduced-motion presentation, disposal                                                            |

`Aquarium` constructs `FishSystem` after registering rocks and adds its root to the environment root. `Application` passes its already-bounded frame delta and active pointer-lock state through `UnderwaterScene.render` to `Aquarium.update`. Player movement is unmodified. Hidden pages skip rendering/updating; paused frames render frozen fish. Fish code adds no global listeners, animation-frame callbacks, or asynchronous resources.

Fish templates own geometry/material sets, including resources shared by many individual meshes. Instance creation allocates transforms but no body buffers or materials. `FishSystem.dispose()` detaches/clears the fish root and disposes each template exactly once. `Aquarium.dispose()` does this before its existing scenery traversal, preventing double disposal of fish resources. Update/dispose calls after fish disposal are harmless.

## Timing and locomotion

The simulation uses 1/30-second steps and a fractional frame accumulator, advancing at most four steps per call; larger frame gaps are discarded beyond that budget. No paused/hidden time is added. The fractional remainder stays frozen during pause, preserving the exact interpolated visual pose. Resume uses the application's existing zero initial frame delta and continues from the same remainder.

Rendering interpolates previous/current position and shortest-path yaw/phase; pitch and mild bank interpolate linearly. Fish local forward is **+X**, distinct from the player's camera-forward -Z. Movement always advances along the current fish heading. `speed` acceleration is capped independently from angular speed; velocity changes also include the normal centripetal component of a turn. Species speed limits include a small deterministic individual factor.

Each fish owns its RNG, phase, target, target lifetime, age, speed factor, turn factor, size, and temperament. Targets persist for several seconds and prefer species depths. New samples near glass are rejected rather than clamped onto a common edge/corner. Soft depth steering permits temporary excursions while gradually guiding fish back. Smooth low-frequency speed variation avoids a constant mechanical cruise. There is no periodic circular route or per-frame random heading.

Tail cadence and amplitude track actual displacement speed, with a gentle residual motion while hovering. A short articulated rear body flexes subtly; the separate caudal joint supplies most of the tail motion. Pectoral animation is periodic across phase wraps. Mild turn banking is optional and removed by reduced motion; rear flex is halved and essential fin movement stays visible.

## Avoidance and safety

The habitat references the same 34 generated convex rock hulls as player physics. A nearby-hull bounding-box test precedes face-distance checks. A velocity-scaled lookahead range, nearest outward face normal, approach direction, and fixed individual side bias produce an avoidance steering contribution before the heading limits. Soft wall steering and early deceleration provide room for a gradual turn. Delicate leaves and decorative pebbles are not obstacles.

A conservative spherical body radius is 56% of species length times individual scale, enclosing nose, tail, and fins. The final candidate-position guard rejects invalid steps instead of teleporting the fish or invoking player swept collision. Normal ten-minute seeded tests record zero guard corrections. An externally forced emergency close-contact case may briefly hold position while the fish turns away; this is a fallback, not the normal locomotion model. Fish use geometric bounds with their own radius, not the player's larger clearance.

Spawning uses loose species regions, preferred depths, variable headings/phases/sizes, a three-unit exclusion around the initial diver, and pairwise body-radius separation plus 0.25 units. The finite placement budget fails clearly for impossible populations instead of silently spawning into scenery. No player proximity is read after spawning.

## Schooling pipeline and tuning

At each fixed step, `FishSimulation` first calls its owned `FishSchooling.calculate()`. That phase reads all current positions/headings/velocities and completes **every** fish's influence before `stepFish` advances anyone. This provides a logical immutable snapshot without copying every entity each frame. Evaluation and neighbor tie-breaking use a stable unique-id order, so even reversing the locomotion update array leaves results unchanged. Cached forces are separate from authoritative entity positions and persist unchanged during pause.

Each directed pair's squared distance is reused for separation and social-neighbor selection. All nearby bodies, including different species, contribute separation. Alignment/cohesion use the closest bounded set of matching species ids, selected into reusable typed arrays. No spatial index, per-step vector/array allocation, leader, shared waypoint, group turning timer, position constraint, or additional RNG draw is introduced. The cache assumes a fixed population; future spawn/removal must rebuild it with the new stable unique identities.

- **Separation:** comfortable distance is the sum of the two conservative body radii plus the observing species' spacing gap. A quadratic distance falloff strengthens repulsion as bodies approach, with a small consistent passing bias and a capped total force. Coincident centers use a deterministic antisymmetric id-based direction, never a random impulse or division by zero. Relative closing motion adds gentle early deceleration through the existing acceleration cap.
- **Alignment:** nearby same-species forward headings contribute a distance-weighted mean. Opposing headings can cancel rather than forcing an arbitrary common direction. Turn-rate limits still apply; individual targets, speed factors, temperament, and fin phases remain independent.
- **Cohesion:** a local weighted center gently attracts fish outside a body-size-aware comfortable dead zone. A bounded reconnection range lets stragglers approach nearby companions without a global tether. Cohesion has reduced vertical influence to preserve depth variation. It does not correct positions or enforce a formation.

| Tuning                           | Neon tetra | Harlequin rasbora | Honey gourami |
| -------------------------------- | ---------: | ----------------: | ------------: |
| Social schooling enabled         |        Yes |               Yes |            No |
| Surface spacing gap              |       0.45 |              0.80 |          0.55 |
| Extra separation range           |       1.10 |              1.10 |          1.20 |
| Separation force cap             |       2.80 |              2.40 |          2.00 |
| Alignment radius / weight        |  5.0 / 1.3 |         5.5 / 1.0 |      Disabled |
| Cohesion radius / weight         |  7.0 / 0.9 |        9.0 / 0.65 |      Disabled |
| Reconnection radius              |         11 |                13 |      Disabled |
| Maximum social neighbors         |          6 |                 5 |             0 |
| Nearby-neighbor wandering weight |       0.45 |              0.65 |           1.0 |

Distances use aquarium world units. All species settings live in `FishSpecies.schooling`. Temperament scales social response by approximately ±10% without changing seeded spawning or consuming movement randomness. Tetras favor coordination more strongly; rasboras retain more wander influence and a larger comfortable gap; gouramis receive separation only, even near other gouramis.

`stepFish` computes the original wandering/depth and rock/wall contributions, then blends the cached influences before the unchanged heading/speed caps and candidate-position guard. `SCHOOLING_SAFETY` centralizes the priority controls: attraction/alignment fade quadratically to zero by danger 0.75; inward separation is projected off the avoidance direction above danger 0.3; separation fades up to 65% in restricted space; close encounters can reduce target speed by up to 40%. Obstacles keep their original force. This lets individuals select different routes around a rock and reconnect later, rather than pulling the entire group through it or keeping a rigid formation.

The registry still owns proportions, colors/markings, preferred depth, movement limits, and animation cadence. `FishGeometry` and `FishSystem` are unchanged by this pass: no new meshes, materials, render passes, textures, animation loops, or GPU resource ownership. See `VALIDATION_V02_PASS_002.md` for simulations, browser observations, CPU measurements, and manual macOS checks.

## Preparation for Pass 003

Future individual behaviors can select persistent movement intentions or targets before the existing social/safety blend. Keep social neighbor evaluation on a consistent snapshot and preserve unique ids, individual seeded RNG, acceleration/turn limits, and final containment. Feeding, resting, curiosity, and caution states are deliberately not implemented here. Larger populations may justify neighbor indexing only after measurement; the 16-fish shipping population and 32-fish stress scenario use a simple bounded pairwise scan.

## Limits

- Personal space is soft steering, not a rigid collision constraint. Occasional close passes can occur in forced/dense configurations; spawn overlap remains prohibited. Schools may temporarily fragment or wander beyond finite reconnection range.
- Independent steering is local, not a global path planner. Dense artificial obstacles can trigger the conservative guard or require future navigation improvements.
- Body spheres and expanded face planes are conservative around narrow gaps and sharp corners. Fins do not have independent collision volumes.
- Habitats currently use static, untransformed environment-local rock data. Moving scenery or transformed environments need updated collider data.
- Procedural bodies and articulated fins are lightly stylized. This is not a biological growth, scale, or fluid simulation.
- Shared buffers reduce memory, but individually articulated parts still incur draw calls. The 32-fish scenario is a temporary validation configuration, not the shipping population.
- Hardware GPU performance and subjective macOS comfort require manual playtesting; software-browser measurements are recorded separately.
