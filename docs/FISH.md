# Tropical marine fish — Pass 011

The active reef has **40 free-swimming fish**, all marine, including two host-associated clownfish. The moray, seahorse, frogfish and five nudibranchs belong to separate habitat-bound systems outside this registry.

| Species             | Count | Model identity                                                                                             | Social/habitat role                                                                  |
| ------------------- | ----: | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Blue-green chromis  |    20 | Compressed streamlined blue-green body, forked tail, reflective sheen, per-individual tint                 | Locally cohesive midwater school, asynchronous short dart/glide, scatter and regroup |
| Pajama cardinalfish |     6 | Deep compressed silhouette, tall divided dorsal, large eyes, yellow face, dark band and spotted cream rear | Calm loose group, hovering, resting and exploration                                  |
| Firefish goby       |     6 | Elongated ivory-to-warm-red body and extended pennant dorsal                                               | Shy shelter-adjacent hovering; strong bounded escape and gradual return              |
| Yellow assessor     |     4 | Compact warm yellow body and rounded reef fins                                                             | Independent shaded-rock/overhang exploration and cover inspection                    |
| Royal gramma        |     2 | Purple front, golden rear/caudal fin and low continuous dorsal                                             | Independent crevice/reef-face association and local exploration                      |
| Ocellaris clownfish |     2 | Broad orange body, three white/dark bordered bands, rounded dark-rimmed fins                               | Host-associated hover, short excursions, local diver retreat and return              |

## Rendering and ownership

`FishSpecies.ts` contains only the active marine roster, anatomy and tuning. `FishGeometry` lofts species-specific profiles, dimensions, fins and vertex-color fields. Cardinal spots are tessellated onto the curved skin, not floating billboard decals. Eyes, articulated rear/tail and moving pectorals remain dimensional. No old freshwater marking/model branch remains in production.

Six immutable templates own **30 geometries / 12 materials**. All six species use articulated instance batches; the 20 chromis share one template with deterministic instance colors. Body/fin transforms interpolate fixed-step poses; refreshed conservative instance spheres include fins/eyes for safe camera culling. Fin transparency remains sorted per batch, not per individual. Models share procedural anatomy infrastructure, not freshwater bodies with swapped colors.

## Simulation and shelter

The existing 30 Hz fixed step, bounded catch-up, stable ID order, consistent neighbor snapshot, body-size separation, finite local cohesion/alignment, diver envelopes, individual intention scheduler and burst machinery remain. There is no leader, global school waypoint, food resource, predator system or teleporting hide action.

Chromis transfer the accepted 20-fish school: alignment radius/weight 3.6/1.65, cohesion 8.5/1.4, reconnect 13, up to 12 neighbors, wander .18. Burst intervals remain 5–11 seconds, duration .4–.8, target speed 1.05 and acceleration cap 1.6. Danger, pressure, sharp turns, resting and fear suppress voluntary bursts. Their larger compressed bodies use .62-length conservative radii; cardinals use .70 for their tall sail, firefish .60 for their pennant.

Cardinals have weaker social attraction and more rest. Firefish, assessors and grammas are independent. Each receives a safe deterministic home from its preferred marine anchor categories when those exist; clownfish use the separate anemone host described below. Spawn is near that anchor; ordinary wander samples a small home region rather than repeatedly expanding from the current position. A soft shelter intention, strengthened during firefish retreat, is considered only on a clear route and enters before authoritative obstacle/separation steering. Escape may leave the home region; normal motion brings the fish back gradually. Home radius is a preference, not a position lock.

Behavior target trials remain bounded (24 random trials, at most 256 nearest-safe fallback checks, eight local exploration attempts). Preferred region filtering applies before route/position checks. Targets retain body offsets, straight convex route validation, progress timeout, asynchronous timing and disturbance/recovery priority. Existing small inspection gestures provide varied orientation near shelter without changing physical position or player camera.

## Safety, determinism and tests

`FishSpawner` uses stable seeded IDs 0–39 (original 0–37 preserved), finite placement budgets, player exclusion and pairwise personal space. `fishPopulation(40 | 60)` supplies production and temporary stress populations; 60 raises chromis to 40 without changing the other groups. Safety tests use actual rock/coral/ornament hulls, not a scene raycast or the player's collision solver.

Historic 16-fish numerical steering calibrations are retained only in `tests/fixtures/regressionSpecies.ts`, using marine identities with their original numeric role parameters. They preserve earlier motion/reaction/scheduler regressions without exporting a compatibility registry or including old species/models in the production bundle. Current production-specific tests separately verify all 40 fish, anatomy, marine categories, shelter return, schooling, darting, collision, frame-rate equivalence and cleanup.

See [habitat metadata](HABITAT.md), [marine environment](PLANTS.md) and [Pass 007 validation](VALIDATION_V02_PASS_007.md). Fin sorting, stylized scale, soft personal space, and finite-range navigation remain limitations; biological husbandry/territorial aggression are not simulated.

Pass 008 introduced the ornament habitats; Pass 009 preserves the first 38 fish and adds the host pair. Fish share the ornament structural colliders and use validated named anchors rather than generic anchors sampled from narrow planks. Nearby bodies hold the chest lid safely before it moves. See [ornaments](ORNAMENTS.md) and [Pass 008 validation](VALIDATION_V02_PASS_008.md).

Exactly two ocellaris clownfish use `anemone-host`, three white/dark bordered bands, rounded fins and a broad dedicated profile. Host-associated intentions replace generic wandering while reusing ordinary locomotion, personal space and solid safety. See [anchored life](ANCHORED_LIFE.md) and [Pass 009 validation](VALIDATION_V02_PASS_009.md).

Pass 010 leaves all 40 ordinary fish, anatomy, tuning, IDs and locomotion unchanged. The hidden seahorse, frogfish and five nudibranchs belong to the separate habitat-bound layer; they are not added to this registry. See [hidden discoveries](HIDDEN_LIFE.md).

Pass 011 retains the exact production roster and tuning. The extended 5/15/30-minute scenarios now also audit all anchored/hidden animals, real surface attachment, finite transforms, stable resource ownership and bounded chest particles alongside fish safety, activity progress and frame-rate determinism. The temporary 60-fish case is validation-only. See [current integration validation](VALIDATION_V02_PASS_011.md).
