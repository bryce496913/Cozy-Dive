# Fish simulation — v0.2 Pass 004B biodiversity

The default environment owns **40 freshwater fish**: 8 neon tetras, 6 harlequin rasboras and 2 honey gouramis retain their accepted roles; 4 Endler’s livebearers swim independently in mid/upper water, and 20 tiny chili rasboras form a larger active school. All fish have size-aware personal space. Models, animation, seeded initial variations, fixed timing, player movement, and resource ownership are preserved from Pass 001. A small seeded intention scheduler adds occasional exploration, resting, foraging, observation, and recovery. There is no food resource, hunger mechanic, or fish UI.

## Modules and ownership

| Module                                     | Responsibility                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FishSpecies.ts`                           | Registry: counts, body proportions/profiles, appearance, habitat, speed/turn/acceleration limits, wander timing, tail cadence; simulation/steering tuning                      |
| `FishEntity.ts`                            | Authoritative pure individual state: position, velocity, heading, size, temperament, persistent target, seeded RNG, animation phase; previous samples solely for interpolation |
| `FishSpawner.ts`                           | Reproducible population and individual variation; bounded placement attempts, habitat validation, body spacing, player-start clearance                                         |
| `FishHabitat.ts`                           | Read-only aquarium bounds and existing convex rock data; body containment checks without Three.js or player physics                                                            |
| `FishMovement.ts`                          | Individual locomotion, safety-prioritized social blending, acceleration/heading limits, 30 Hz accumulator, bounded catch-up, final containment guard                           |
| `FishSchooling.ts`                         | Stable step-snapshot neighbor evaluation, all-species separation, same-species alignment/cohesion, reusable bounded scratch buffers                                            |
| `FishGeometry.ts`                          | Shared per-species organic lofted bodies, curved skin markings, fins, eyes, articulation templates, exact resource ownership                                                   |
| `FishBehavior.ts` / `FishBehaviorTypes.ts` | Individual schedule, persistent traits, safe habitat targets, blended speed/social/gesture intentions                                                                          |
| `FishDiverReaction.ts`                     | Read-only physical diver presence, smooth awareness/scatter/recovery, reusable escape direction                                                                                |
| `FishSystem.ts`                            | Bridge from simulation to interpolated Object3D transforms; render animation, reduced-motion presentation, disposal                                                            |

`Aquarium` constructs `FishSystem` after registering rocks and adds its root to the environment root. `Application` passes its already-bounded frame delta and active pointer-lock state through `UnderwaterScene.render` to `Aquarium.update`. The application also passes a reused read-only `PlayerPresence` referencing the physical diver position/velocity, gated by active lock/visibility state. Fish never read camera offsets or own controls/player collision. Hidden pages skip rendering/updating; paused frames render frozen fish. Fish code adds no global listeners, animation-frame callbacks, or asynchronous resources.

Fish templates own geometry/material sets, including resources shared by many individual meshes. Instance creation allocates transforms but no body buffers or materials. `FishSystem.dispose()` detaches/clears the fish root and disposes each template exactly once. `Aquarium.dispose()` does this before its existing scenery traversal, preventing double disposal of fish resources. Update/dispose calls after fish disposal are harmless.

## Timing and locomotion

The simulation uses 1/30-second steps and a fractional frame accumulator, advancing at most four steps per call; larger frame gaps are discarded beyond that budget. No paused/hidden time is added. The fractional remainder stays frozen during pause, preserving the exact interpolated visual pose. Resume uses the application's existing zero initial frame delta and continues from the same remainder.

Rendering interpolates previous/current position and shortest-path yaw/phase; pitch and mild bank interpolate linearly. Fish local forward is **+X**, distinct from the player's camera-forward -Z. Movement always advances along the current fish heading. `speed` acceleration is capped independently from angular speed; velocity changes also include the normal centripetal component of a turn. Species speed limits include a small deterministic individual factor.

Each fish owns its RNG, phase, target, target lifetime, age, speed factor, turn factor, size, and temperament. Targets persist for several seconds and prefer species depths. New samples near glass are rejected rather than clamped onto a common edge/corner. Soft depth steering permits temporary excursions while gradually guiding fish back. Smooth low-frequency speed variation avoids a constant mechanical cruise. There is no periodic circular route or per-frame random heading.

Tail cadence and amplitude track actual displacement speed, with a gentle residual motion while hovering. A short articulated rear body flexes subtly; the separate caudal joint supplies most of the tail motion. Pectoral animation is periodic across phase wraps. Mild turn banking is optional and removed by reduced motion; rear flex is halved and essential fin movement stays visible.

## Avoidance and safety

The habitat references the same 34 generated rock hulls and 39 convex hardscape component hulls as player physics. A nearby-hull bounding-box test precedes face-distance checks. A velocity-scaled lookahead range, nearest outward face normal, approach direction, and fixed individual side bias produce an avoidance steering contribution before the heading limits. Soft wall steering and early deceleration provide room for a gradual turn. Delicate leaves and decorative pebbles are not obstacles.

A conservative spherical body radius defaults to 56% of species length times individual scale. The final candidate-position guard rejects invalid steps instead of teleporting the fish or invoking player swept collision. Normal ten-minute seeded tests record zero guard corrections. An externally forced emergency close-contact case may briefly hold position while the fish turns away; this is a fallback, not the normal locomotion model. Fish use geometric bounds with their own radius, not the player's larger clearance.

Spawning uses loose species regions, preferred depths, variable headings/phases/sizes, a three-unit exclusion around the initial diver, and pairwise body-radius separation plus 0.25 units. The finite placement budget fails clearly for impossible populations instead of silently spawning into scenery. Live player proximity is supplied separately to the diver-reaction module.

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

`stepFish` computes the original wandering/depth and rock/wall contributions, then blends the cached influences before the locomotion limits and unchanged candidate-position guard. `SCHOOLING_SAFETY` centralizes the priority controls: attraction/alignment fade quadratically to zero by danger 0.75; inward separation is projected off the avoidance direction above danger 0.3; separation fades up to 65% in restricted space; close encounters can reduce target speed by up to 40%. Obstacles keep their original force. This lets individuals select different routes around a rock and reconnect later, rather than pulling the entire group through it or keeping a rigid formation.

The registry still owns proportions, colors/markings, preferred depth, movement limits, and animation cadence. Original species retain their accepted models and articulated motion. New species add bounded shared templates and articulated instance batches, described below; there are no new animation loops or render passes. See `VALIDATION_V02_PASS_004B.md` for current measurements and manual macOS checks.

## Diver awareness, scatter, and recovery

`FishDiverReaction.ts` owns smooth awareness/scatter envelopes and a persistent escape direction for each fish. Distances subtract both body radii. A stationary close diver still produces avoidance; relative closing velocity increases response before contact. Smooth distance falloffs and exponential attack/recovery avoid binary triggers. Exact overlap uses a finite deterministic id direction. Per-id sideways choices help fish clear the approach path independently; no randomness is consumed and this reaction module itself has no state machine.

| Parameter                        |      Tetra |   Rasbora |   Gourami |
| -------------------------------- | ---------: | --------: | --------: |
| Awareness surface-gap radius     |        4.2 |       3.8 |       2.8 |
| Comfort / strong surface gap     | 2.2 / 0.75 | 2.0 / 0.8 | 1.5 / 0.7 |
| Sensitivity                      |        1.0 |      0.85 |      0.55 |
| Escape speed cap                 |       1.55 |       1.2 |      0.65 |
| Reaction acceleration cap        |        1.2 |      0.85 |       0.4 |
| Turn-cap multiplier              |        1.6 |       1.5 |      1.25 |
| Steering weight                  |        4.8 |       4.2 |       2.8 |
| Awareness / scatter attack (1/s) |      3 / 5 |   2.5 / 4 |   1.8 / 3 |
| Direction response (1/s)         |          4 |       3.5 |       2.5 |
| Recovery time scale (s)          |        4.5 |         5 |         6 |

Full approach strength is reached at 2 world units/s closing speed. Recovery has rate `3 / recoverySeconds` (about 95% decay over that interval), then snaps only negligible values below 0.00001 to zero. Species own all these parameters in `FishSpecies.diver`.

Safety remains first: the escape contribution is projected away from inward obstacle force; a bounded forward probe chooses an available tangent when escape faces a wall/rock. Obstacle danger and close-neighbor pressure suppress escape-speed boosts. Personal-space separation remains active. School attraction/alignment fade by up to 90% during scatter; wandering recedes with awareness. After the diver leaves, the envelopes decay and the ordinary local school attraction gradually returns. Heading, acceleration and speed stay bounded; no position correction, player push, invisible wall, scripted regroup target, or global school tether is added. The final habitat guard remains unchanged.

The same fixed-step pause/reduced-motion policy applies to reaction clocks. Reduced motion suppresses optional visual motion, not essential avoidance. Preview fish remain frozen until entry. The behavior layer reads these envelopes rather than computing a second fear signal. Pass 003 began after the user confirmed Pass 002B was merged and manually accepted.

## Individual activities and personality

`FishBehaviorTypes` defines six activities and compact species preferences. Every entity owns one behavior state with a target, independent seeded schedule, elapsed/duration/cooldown, immutable traits, progress tracking, and reusable blended intentions. These are intentions only; position, velocity, heading and animation phase still have one owner in `stepFish`.

Initialization forks the existing individual seed with a fixed salt, using the same LCG primitive as wandering. It consumes no extra spawn/layout RNG draws and leaves the individual wandering stream independent. Initiative, rest preference, curiosity and recovery vary within bounded ranges; recovery also reflects existing temperament. There are no global activity timers, saved memories, shared leaders, or compulsory activity cycles.

| Preference                                 | Neon tetra            | Harlequin rasbora     | Honey gourami         |
| ------------------------------------------ | --------------------- | --------------------- | --------------------- |
| Cruise interval before a decision (s)      | 32–64                 | 28–60                 | 20–42                 |
| Explore / rest / forage / observe weights  | .65 / .08 / .22 / .05 | .45 / .22 / .25 / .08 | .30 / .30 / .20 / .20 |
| Explore/forage maximum dwell (s)           | 7–12                  | 10–17                 | 15–24                 |
| Rest duration (s)                          | 3–6                   | 5–9                   | 10–18                 |
| Rest speed fraction                        | .30                   | .22                   | .16                   |
| Social attraction retained during activity | .90                   | .70                   | 1 (independent)       |
| Base calm recovery dwell (s)               | 5                     | 7                     | 10                    |

Initiative scales cruise intervals by 1 / [.8, 1.2]; rest preference scales the resting draw by [.7, 1.3]; curiosity scales observation draws by [.6, 1.4]. Ineligible observation has zero weight. A failed target search returns to a full quiet cruise interval. These choices keep most fish cruising, while the two gouramis show more frequent individual activity. Durations are bounds, not a script: arrival, blocked progress, invalid targets, or disturbance may end an activity earlier.

- **Cruising:** existing persistent wandering targets, soft depth preferences and ordinary schooling.
- **Exploring:** choose a nearby habitat point or bounded local open-water fallback. Gradually approach at 90% cruise speed; pause gently near arrival, then resume cruising.
- **Resting:** capture a local anchor, gradually reduce speed and preserve heading inside a 0.4-unit neighborhood. Small drift and corrections remain; essential tail/pectoral motion never stops. School attraction is only modestly reduced, and separation remains active.
- **Foraging:** choose an appropriate surface interest (tetras may inspect open water too); approach normally, slow on arrival within 0.9 units, then make at most two restrained four-degree inspection dips over four seconds and leave after five seconds of inspection. Arrival/phase are not animation resets. No edible objects or food state are created.
- **Observing:** only a calm active diver (<0.35 units/s) outside awareness radius + 0.6 surface-gap units, within awareness + 4 units, and without recent fear/cooldown is eligible. The fish slows and turns toward the diver for 5–8 seconds, staying near its existing location rather than following a moving target. Cooldown is 35–60 seconds. Motion >0.5 units/s, gap below awareness + 0.2, loss of presence, or awareness >0.025 ends observation. This is wildlife acknowledgement, not player interaction UI.
- **Recovering:** existing scatter >0.08 or awareness >0.35 interrupts all voluntary activities. Behavior influence recedes, ordinary social cruising returns, and the species dwell (scaled by individual recovery, approximately .72–1.32) starts once the threat subsides. Curiosity is suppressed for at least recovery duration + 25 seconds from interruption. Continued disturbance can prolong caution; removal always permits bounded recovery. There is no independent fear meter.

Speed, social influence, intent weight and inspection gesture blend exponentially at 1.8/s. Actual acceleration, turn rate and escape-speed limits remain those of existing locomotion. Behavior modifies only the lowest-priority target/depth intention **before** rock/wall steering; it never adds a second position integrator. Diver awareness/scatter fades behavior influence immediately at the steering blend, so even a lingering visual/intention envelope cannot fight avoidance. Personal-space separation is not scaled away. Reduced motion omits inspection pitch and optional bank, while essential fins and avoidance continue.

## Habitat interests and target safety

`Aquarium` collects metadata as it generates the existing scenery, with no extra layout random draws: 65 plant inspection regions from the owned PlantSystem, 102 conservative major-rock edge/top points (three per hull), five open-channel regions, eight grass edges, nine hardscape edges and ten substrate regions. `FishHabitat.interests` is a read-only optional list of plain `{kind, position, normal}` values; fish never inspect Three.js objects. Plant leaves remain passable.

Selection samples at most 24 points, offsetting by the body radius + 0.45 along the outward normal with a small individual tangent variation. Candidates must be nearby (4.5 units for foraging, 6 for exploration), fit the body with an extra margin, and have a clear straight route through the existing convex hull data. `clearFishRoute` uses segment/expanded-plane intervals with bounding-box rejection; no raycasting or navigation library is needed. Exploration has eight bounded local fallback attempts. Foraging fails quietly if no suitable interest is available.

Targets persist. They are revalidated against solids; lack of at least 0.15 units of progress over six seconds abandons the activity rather than retrying the same unreachable target. This is local intention selection, not guaranteed global navigation. Safety steering may steer away from an otherwise clear target when school/personal-space constraints intervene.

At each fixed step, `FishSchooling.calculate()` still completes every neighbor influence first. Each `stepFish` then updates the existing diver envelope, selects its own behavior, blends intent, and runs the original safety/locomotion path. Behavior reads no neighboring mutable state. Reversing entity update order yields identical schedules and movement, and the fixed accumulator preserves 30/60/120 FPS equivalence. Pause advances neither scheduler nor gesture; interpolation retains previous/current inspection samples without snapping.

## Biodiversity roles, bursts and rendering

| Species             | Count | Identity and movement                                                                                                                                                                         |
| ------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endler’s livebearer |     4 | Streamlined fish with four stable marking layouts/hues, dark/orange/teal skin patches and natural articulated fins. Independent upper/midwater movement with gentle occasional speed changes. |
| Chili rasbora       |    20 | Slender 0.24-unit red-orange 3D bodies with dark lateral markings and tiny fins/eyes. Stronger local schooling, infrequent rests, short independent bursts and quick diver reactions.         |

`ORIGINAL_FISH_SPECIES` retains the original registry entries and counts, while `FISH_SPECIES` is the five-species default. `fishPopulation(16 | 20 | 40 | 60)` centralizes validation gates: 16 original, 20 with Endlers, 40 default, 60 with 40 chilis. Spawning remains deterministic, body-size-safe, and excludes the initial player. The first 16 fish retain the original spawn RNG sequence; new species append after them. Original regression scenarios now explicitly use the original population fixture, rather than accidentally applying old count assertions to the expanded default.

`FishBurst.ts` adds an optional, separately seeded per-individual burst intention to the existing locomotion path. Chili intervals are 5–11 seconds, active envelope 0.4–0.8 seconds, preferred burst speed 1.05, acceleration cap 1.6; Endler intervals are 8–15 seconds, envelope 0.45–0.8 seconds, speed 0.82, acceleration cap 0.8. Initial phases vary independently. A squared-sine envelope changes desired speed, followed by bounded acceleration/deceleration and a glide; position/velocity are never multiplied by a pulse or reset.

Bursts recede during obstacle danger, close-neighbor pressure and large desired turns (fully suppressed above 1.2 radians), and are interrupted by fear or voluntary rest/inspection. This lets fish turn toward companions before accelerating. Diver escape remains last in speed selection and retains its configured limits. Original species have no burst tuning and keep their prior movement. All burst/behavior clocks freeze while paused and preserve fixed-step FPS consistency.

The chili school uses local alignment radius 3.6 / weight 1.65, cohesion radius 8.5 / weight 1.4, reconnect radius 13, at most 12 neighbors and nearby wander weight 0.18. These finite local preferences support regrouping after scatter without leaders, position tethers, scripted paths or shared burst clocks. The O(n²) consistent neighbor snapshot remains practical at 40/60; no spatial index was added without need.

New models use species-appropriate lower tessellation, preserving lofted volumes, skin-hugging markings and the existing tail/rear/pectoral rig. Endlers have four geometry-marking variants, selected by stable identity. `FishRenderBatch` copies the actual articulated component matrices into shared InstancedMeshes: it does not replace fish with sprites or rigid single-mesh instances. Original species retain their existing presentation. At 40 and 60 fish, fish resources remain 42 geometries / 17 materials; all resources and instance buffers have explicit owners. Moving batches refresh conservative per-part instance spheres from the real articulated geometry every pose update, then use Three.js camera-frustum culling. This removes offscreen draws without changing fish updates or per-fish visibility. Fins retain the existing transparency, without per-instance depth sorting.

## Living vegetation metadata and preparation for Pass 005

Pass 004 adds optional plain vegetation metadata (family, region, height, broad-leaf flag) without exposing meshes to fish. The existing target sampler applies soft family preferences: gouramis favor broad leaves, tetras prefer taller edges over low grass, and rasboras broadly accept planted habitat. Plant inspection positions come from channel-facing leaf vertices. If random forage trials miss nearby usable habitat, a nearest-safe fallback checks at most 256 regions. The original body-size margin, route validation and progress timeout remain; diver disturbance still overrides investigation. Behavior scheduling, state durations, schooling, models, animation and player physics are unchanged.

PlantSystem owns interest generation and the same 65-cluster shipping count. See [Pass 004B validation](VALIDATION_V02_PASS_004B.md) for population/motion evidence and [PLANTS.md](PLANTS.md) for shapes, current field, seeded placement, rendering and lifecycle; see [Pass 004 validation](VALIDATION_V02_PASS_004.md) for executed results. Future regions can add metadata through this interface without scene traversal. No audio or competing behavior integrator is introduced. Await manual macOS acceptance before beginning Pass 005.

## Limits

- Personal space is soft steering, not a rigid collision constraint. Occasional close passes can occur in forced/dense configurations; spawn overlap remains prohibited. Schools may temporarily fragment or wander beyond finite reconnection range.
- Independent steering is local, not a global path planner. Dense artificial obstacles can trigger the conservative guard or require future navigation improvements.
- Body spheres and expanded face planes are conservative around narrow gaps and sharp corners. Fins do not have independent collision volumes.
- Habitats currently use static, untransformed environment-local rock data. Moving scenery or transformed environments need updated collider data.
- Procedural bodies and articulated fins are lightly stylized. This is not a biological growth, scale, or fluid simulation.
- Shared buffers reduce memory, but individually articulated parts still incur draw calls. The 60-fish scenario is a temporary validation configuration, not the 40-fish shipping population.
- Hardware GPU performance and subjective macOS comfort require manual playtesting; software-browser measurements are recorded separately.
