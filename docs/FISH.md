# Tropical marine fish — Pass 007

The active reef has **38 free-swimming fish**, all marine. Two future anemone-associated clownfish are reserved for Pass 009; none are implemented here.

| Species             | Count | Model identity                                                                                             | Social/habitat role                                                                  |
| ------------------- | ----: | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Blue-green chromis  |    20 | Compressed streamlined blue-green body, forked tail, reflective sheen, per-individual tint                 | Locally cohesive midwater school, asynchronous short dart/glide, scatter and regroup |
| Pajama cardinalfish |     6 | Deep compressed silhouette, tall divided dorsal, large eyes, yellow face, dark band and spotted cream rear | Calm loose group, hovering, resting and exploration                                  |
| Firefish goby       |     6 | Elongated ivory-to-warm-red body and extended pennant dorsal                                               | Shy shelter-adjacent hovering; strong bounded escape and gradual return              |
| Yellow assessor     |     4 | Compact warm yellow body and rounded reef fins                                                             | Independent shaded-rock/overhang exploration and cover inspection                    |
| Royal gramma        |     2 | Purple front, golden rear/caudal fin and low continuous dorsal                                             | Independent crevice/reef-face association and local exploration                      |

## Rendering and ownership

`FishSpecies.ts` contains only the active marine roster, anatomy and tuning. `FishGeometry` lofts species-specific profiles, dimensions, fins and vertex-color fields. Cardinal spots are tessellated onto the curved skin, not floating billboard decals. Eyes, articulated rear/tail and moving pectorals remain dimensional. No old freshwater marking/model branch remains in production.

Five immutable templates own **25 geometries / 10 materials**. All five species use articulated instance batches; the 20 chromis share one template with deterministic instance colors. Body/fin transforms interpolate fixed-step poses; refreshed conservative instance spheres include fins/eyes for safe camera culling. Fin transparency remains sorted per batch, not per individual. Models share procedural anatomy infrastructure, not freshwater bodies with swapped colors.

## Simulation and shelter

The existing 30 Hz fixed step, bounded catch-up, stable ID order, consistent neighbor snapshot, body-size separation, finite local cohesion/alignment, diver envelopes, individual intention scheduler and burst machinery remain. There is no leader, global school waypoint, food resource, predator system or teleporting hide action.

Chromis transfer the accepted 20-fish school: alignment radius/weight 3.6/1.65, cohesion 8.5/1.4, reconnect 13, up to 12 neighbors, wander .18. Burst intervals remain 5–11 seconds, duration .4–.8, target speed 1.05 and acceleration cap 1.6. Danger, pressure, sharp turns, resting and fear suppress voluntary bursts. Their larger compressed bodies use .62-length conservative radii; cardinals use .70 for their tall sail, firefish .60 for their pennant.

Cardinals have weaker social attraction and more rest. The other three species are independent. Each receives a safe deterministic home from its preferred marine anchor categories when those exist. Spawn is near that anchor; ordinary wander samples a small home region rather than repeatedly expanding from the current position. A soft shelter intention, strengthened during firefish retreat, is considered only on a clear route and enters before authoritative obstacle/separation steering. Escape may leave the home region; normal motion brings the fish back gradually. Home radius is a preference, not a position lock.

Behavior target trials remain bounded (24 random trials, at most 256 nearest-safe fallback checks, eight local exploration attempts). Preferred region filtering applies before route/position checks. Targets retain body offsets, straight convex route validation, progress timeout, asynchronous timing and disturbance/recovery priority. Existing small inspection gestures provide varied orientation near shelter without changing physical position or player camera.

## Safety, determinism and tests

`FishSpawner` uses stable seeded IDs 0–37, finite placement budgets, player exclusion and pairwise personal space. `fishPopulation(38 | 60)` supplies production and temporary stress populations; 60 raises chromis to 42 without changing the other groups. Safety tests use actual rock/coral/ornament hulls, not a scene raycast or the player's collision solver.

Historic 16-fish numerical steering calibrations are retained only in `tests/fixtures/regressionSpecies.ts`, using marine identities with their original numeric role parameters. They preserve earlier motion/reaction/scheduler regressions without exporting a compatibility registry or including old species/models in the production bundle. Current production-specific tests separately verify all 38 fish, anatomy, marine categories, shelter return, schooling, darting, collision, frame-rate equivalence and cleanup.

See [habitat metadata](HABITAT.md), [marine environment](PLANTS.md) and [Pass 007 validation](VALIDATION_V02_PASS_007.md). Fin sorting, stylized scale, soft personal space, and finite-range navigation remain limitations; biological husbandry/territorial aggression are not simulated.
