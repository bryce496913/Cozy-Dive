# Tropical reef habitat metadata

Fish consume read-only anchors with `kind`, position, outward normal and optional stable `anchorId`. Regions support **open reef water, seagrass meadow, sandy floor, sheltered crevice entrance, reef face, coral edge and shaded overhang**. Vegetation records also identify category (seagrass, macroalgae, coral), family, height and broad-segment structure. The interface can later bind a creature to an anchor without implementing any location-bound creature now.

`MarineHabitat.marineInterests` samples bounded deterministic free-space positions adjacent to real convex structures. Crevice anchors represent safe shelter entrances beside the reef, not simulated caves. Overhang points are admitted only if the body envelope fits below an elevated structural cap and outside every solid. Open-water and sand anchors remain in the central corridor. Existing surface/plant interests continue through the same bounded selector.

`reefSurfaceHeight` evaluates actual convex planes and rejects samples outside a hull footprint. Attached coral roots use that surface and its normal. Colony tips supply safe inspection metadata only after solid containment checks. Fish add body-sized stand-offs and require both a safe candidate and a clear route; no target selection moves an entity or bypasses the final containment guard.

Firefish, assessors and grammas choose deterministic safe homes from their highest available preferred category. A body-sized region that cannot fit is never selected. A home is optional in an empty test habitat and is always a soft intention: it does not lock orientation, teleport a fish, or override reef/glass safety. Disturbance and ordinary gradual recovery still run through the established diver system.

See [fish tuning](FISH.md), [marine forms and structural ownership](PLANTS.md), and [validation](VALIDATION_V02_PASS_007.md). Complex cave navigation and aggression remain outside scope.

Pass 008 adds six reusable ornament anchors: `shipwreck-crevice`, `log-interior`, `statue-rear`, `arch-shadow`, `chest-nearby`, and `filter-corner`. `OrnamentSystem.anchors` owns their validated positions and outward unit orientations; every anchor clears a 0.65-unit body envelope against the whole scene. Pass 009 consumes `log-interior` for the moray and adds an independent reef-attached anemone host. See [ornaments](ORNAMENTS.md).

`FishHabitat.creatureAnchors` exposes reusable `CreatureAnchor` data for `anemone-host`. It includes a validated center, unit orientation and three-unit body-inclusive home radius; the anemone also exposes its soft envelope, nearby water and safe escape directions. `moray-shelter` records `log-interior` as its source. See [anchored life](ANCHORED_LIFE.md).
