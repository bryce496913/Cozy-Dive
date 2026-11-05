# Fish foundation — v0.2 Pass 001

The environment owns 16 independent freshwater fish: 8 neon tetras, 6 harlequin rasboras, 2 honey gouramis. This pass establishes reusable entities, models, timing, and independent steering; it does not implement boids, formal schooling, feeding, behavior state machines, fish-player reactions, or fish UI.

## Modules and ownership

| Module            | Responsibility                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FishSpecies.ts`  | Registry: counts, body proportions/profiles, appearance, habitat, speed/turn/acceleration limits, wander timing, tail cadence; simulation/steering tuning                      |
| `FishEntity.ts`   | Authoritative pure individual state: position, velocity, heading, size, temperament, persistent target, seeded RNG, animation phase; previous samples solely for interpolation |
| `FishSpawner.ts`  | Reproducible population and individual variation; bounded placement attempts, habitat validation, body spacing, player-start clearance                                         |
| `FishHabitat.ts`  | Read-only aquarium bounds and existing convex rock data; body containment checks without Three.js or player physics                                                            |
| `FishMovement.ts` | Independent steering, acceleration/heading limits, 30 Hz accumulator, bounded catch-up, final containment guard                                                                |
| `FishGeometry.ts` | Shared per-species organic lofted bodies, curved skin markings, fins, eyes, articulation templates, exact resource ownership                                                   |
| `FishSystem.ts`   | Bridge from simulation to interpolated Object3D transforms; render animation, reduced-motion presentation, disposal                                                            |

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

## Configuration and future schooling

The registry holds all species population and movement settings. The default seed and 30 Hz budget live beside it. Model construction stays in `FishGeometry`; smooth longitudinal profiles and elliptical sections produce dimensional silhouettes. Shared curved surface patches carry the neon blue/red bands and rasbora wedge; gourami fins use rounded outlines. No texture downloads, extra render pass, shadow maps, skeletal animation framework, or fish physics dependency are added.

Pass 002 can compute separation/alignment/cohesion vectors over the authoritative fish states, then combine them with the target/depth steering before the existing avoidance and heading/speed caps. Keep group data separate from individual state and preserve seeded timing. Predictive safety and final containment should remain authoritative. Larger populations may justify neighbor indexing, batching compatible components, or instancing; measure before adding those systems.

## Limits

- Runtime fish-to-fish overlap is allowed until separation/schooling is added. Spawn overlap is prohibited.
- Independent steering is local, not a global path planner. Dense artificial obstacles can trigger the conservative guard or require future navigation improvements.
- Body spheres and expanded face planes are conservative around narrow gaps and sharp corners. Fins do not have independent collision volumes.
- Habitats currently use static, untransformed environment-local rock data. Moving scenery or transformed environments need updated collider data.
- Procedural bodies and articulated fins are lightly stylized. This is not a biological growth, scale, or fluid simulation.
- Shared buffers reduce memory, but individually articulated parts still incur draw calls. The 32-fish scenario is a temporary validation configuration, not the shipping population.
- Hardware GPU performance and subjective macOS comfort require manual playtesting; software-browser measurements are recorded separately.
