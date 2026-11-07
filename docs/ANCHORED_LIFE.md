# Anchored marine life — Pass 009

The reef contains **40 ordinary fish** (the original 38 plus two ocellaris clownfish), one living sea anemone and one additional moray. The moray is not in the ordinary fish registry or a new school. `Aquarium` owns `AnchoredLife`, which delegates geometry, animation and behavior to small creature-specific components and detaches them before generic scenery disposal.

## Shared homes and ordinary swimming

`CreatureAnchor` is scene-free metadata: stable ID, optional source ID, world position, unit orientation, home radius and habitat kind. `FishHabitat.creatureAnchors` exposes homes to the existing spawner. Production requires `anemone-host`; a deliberately empty standalone habitat can use the registry's reference region for renderer/simulation fixtures. An explicitly provided anchor list missing the required ID fails clearly.

Clownfish remain `FishEntity` instances with seeded IDs **38 and 39**, species geometry, instance batches and the existing fixed-step locomotion, separation, diver awareness and final solid guard. The first 38 spawn IDs/random streams remain unchanged. `HostBehavior` supplies local hover/excursion/return intentions instead of the generic whole-tank activity scheduler. Targets stay near the crown and pair members can face each other during quiet hovering. Size and color vary slightly without duplicating templates.

Host return steering grows toward the edge of the three-unit home sphere. Outward speed tapers before the body envelope reaches that sphere; the existing turning and solid checks remain authoritative. This is gradual steering/deceleration, not teleportation or a new position integrator. Diver disturbance selects a safe local retreat within the host region, including when the diver enters the crown. Once disturbance fades, local activity resumes. The pair never pursues the player. The soft tentacles are passable; reef rock remains solid.

The clownfish profile is broad and compressed with a rounded head, long rounded dorsal and rounded fan tail. Three white bands with dark borders follow the dimensional body. Thin dark fin rims surround orange membranes. Tail/rear/pectoral articulation and shared rendering are the same ownership model as other fish. Six species templates now own **30 geometries / 12 materials**. The 60-fish temporary stress configuration uses 40 chromis and preserves all other counts.

## Anemone attachment and current

One merged geometry contains a rounded basal column/crown and **72 elongated tentacles**, varied in length, spread and phase. The system chooses an actual upper convex face of a native reef rock, aligns the root to its outward normal and rejects intersection with every structural hull and nearby flora envelopes. Its home center, open-water point, tentacle envelope and validated escape directions are exposed for consumers.

Tentacles bend entirely in the vertex shader: zero-flex basal vertices remain attached, neighboring phases differ, and displacement increases quadratically toward the tips. The maximum lateral bend is 0.14 units within a conservative 0.95-unit radial / 1.04-unit height envelope. One material/time uniform and one draw handle the entire animal; no per-tentacle traversal or CPU vertex deformation occurs. The existing `PlantClock` supplies pause and smooth reduced-motion settling without changing the global vegetation current.

## Sheltered moray

`moray-shelter` references the existing **`log-interior`** anchor and its orientation. The complete curved-body/head envelope is validated against all real scene hulls across extension and wave phases at initialization. No hiding-site box is added to collision. The substantial body instead responds to a nearby active diver by gradually retreating into the log; it does not attack, bite, chase or deal damage. A player can enter soft animal space while visibly provoking that response; the log itself remains solid around its open bore.

`MorayBehavior` cycles through hidden, peeking, resting, partial emergence and retreat with seeded durations. Most time is spent tucked inside or resting with the head visible. Hidden means deep within the open log, not invisibility from every viewing angle. The tapered body unfolds from a compact S, with subtle undulation, a continuous dorsal membrane, a broad head, dimensional eyes and a small breathing jaw motion. Pale/dark snowflake-inspired mottling is a small procedural skin shader, with facial masks preserving the eyes/mouth. There are no image textures or remote assets.

The body deforms on the GPU with corrected tangent-frame normals. CPU work moves only the head/jaw rig and a few scalar uniforms. A fixed 30 Hz local clock makes state timing and poses equivalent across rendering schedules; it is not another generic fish movement engine. Pausing freezes states, phase and poses. Reduced motion settles optional body/jaw waving through `PlantClock`, while essential slow shelter transitions remain active. Frame gaps cannot replay a backlog of transitions.

## Ownership and limits

The anemone owns one geometry/material; the eel owns three geometries/two materials. Both have idempotent cleanup and no timers, listeners or extra animation loop. Fish template/batch ownership is unchanged. No player forces, collision solver, settings schema, ornament geometry, audio layer or mix constant changes in this pass.

These are stylized animals, not biological care or anatomical references. The eel's tucked/unfolded curve is a bounded visual approximation, not physical soft-body simulation. Fish personal space remains soft, and transparent fins retain the existing per-batch sorting limitations. See [Pass 009 validation](VALIDATION_V02_PASS_009.md) for measured evidence and pending manual macOS acceptance.
