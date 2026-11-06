# Living plants and habitat — v0.2 Pass 004

The environment retains 65 procedural clusters in five freshwater families, now complemented by eight freshwater grass meadows and nine decorative coral-inspired ornaments. Thin foliage and slender petioles remain passable; no plant colliders or substantial plant bases are introduced. The new hardscape has separate solid convex components. Aquarium dimensions, rocks, player physics, fish models, animation, schooling and behavior scheduling are preserved.

## Modules and ownership

| Module              | Responsibility                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PlantSpecies.ts`   | Five families, counts, heights, leaf proportions, palettes, habitat preference, flexibility and frequency        |
| `PlantGeometry.ts`  | Seeded reusable rosette/tuft buffers, shaped leaves, twist/cupping, vertex colors and per-leaf motion attributes |
| `HabitatRegions.ts` | Cluster anchors, seeded placement, channel/spawn clearance, rock-aware volume checks, shared sand height         |
| `PlantAnimation.ts` | Coherent current, reference bending function, shader hook and pause/reduced-motion phase clock                   |
| `PlantSystem.ts`    | Instanced batches, owned material/templates, habitat metadata, uniform updates and idempotent disposal           |
| `Aquarium.ts`       | Assemble vegetation with existing scenery/fish and forward lifecycle updates                                     |

Each family has up to three shared complete-plant templates. Leaves are part of the template rather than independent meshes. Templates differ in leaf count, length, orientation, curvature and phase. Instance matrices vary height/yaw, with restrained instance tint. A shared opaque, rough, double-sided material uses vertex gradients and subtle midribs; no textures, emissive layers or external assets are needed.

## Families and distribution

| Plant           | Clusters | Height range | Shape                                            | Region / motion                                         |
| --------------- | -------: | ------------ | ------------------------------------------------ | ------------------------------------------------------- |
| Vallisneria     |       16 | 3.2–5.0      | Slender curved ribbons, varied lengths           | Rear/side vertical structure; strongest tip flexibility |
| Amazon Sword    |       12 | 1.4–2.5      | Lance leaves on narrow petioles, central rosette | Rocky midground; restrained bending                     |
| Java Fern       |       14 | 1.1–2.0      | Narrow irregular dark fronds                     | Rock banks; gentle individual variation                 |
| Anubias         |       10 | 0.55–0.95    | Compact oval cupped leaves on short stems        | Lower banks; minimal movement                           |
| Dwarf Hairgrass |       13 | 0.25–0.52    | Dense tufts of tapered strands                   | Sand transitions; very small tip motion                 |

Heights are instance scale ranges; individual leaves are shorter and curved. Anchors define loose bank/background/substrate patches, with seeded triangular scatter and minimum base separation. Leaves may overlap other thin foliage. Placement stays inside all boundaries, maintains a 6.4-unit-wide clear central channel, and excludes the initial player area. Roots meet the existing rippled substrate rather than a flat assumed floor.

Three-dimensional sampled envelopes include leaf spread and sway margin, rejecting solid rock intersections while allowing upper leaves above low formations. Bounded placement attempts fail explicitly if density cannot fit. Tests also inspect actual transformed and bent vertices at multiple times/seeds, including double density. This is static layout validation rather than dynamic foliage collision.

Vegetation has its own seed, independent of existing rocks, sand colors and motes. Aquarium deliberately advances the old plant RNG budget (65 × 18 samples) before building motes, preserving the established downstream scenery stream. Original rock transforms/colliders remain unchanged; new ornament component colliders are owned separately.

## Current and animation

A low-frequency deterministic field uses environment-local X/Z and time. Nearby plants share a broad flow; species frequency and each leaf's persistent phase add smaller variation. Flexibility grows quadratically from zero at the base to a species maximum at the tip. Per-instance yaw converts the common current into each plant's local axes, so nearby plants retain coherent world direction despite different orientations.

The material's small `onBeforeCompile` hook bends existing vertices and adjusts normals for the local bend slope. One time uniform drives every batch. No geometry, buffer, matrix, scene search, raycast, or per-leaf transform is rebuilt during animation. Expanded batch bounds cover the maximum sway. CPU reference functions exercise the same equations; actual shader compilation and rendering are checked separately in Chromium.

`PlantClock` advances only during active simulation, with the same bounded frame-delta policy as the application. Preview and paused plants retain their exact pose. Reduced motion smoothly slows the phase rate to zero over a short settling interval, **freezing the current shape** rather than snapping displacement to zero. Turning motion back on smoothly restarts that phase. The exponential rate ramp is analytically integrated for frame-rate consistency. Fish and player clocks remain independently owned by their existing systems.

## Fish habitat integration

Plant interests extend the existing read-only `kind / position / normal` interface with optional plain metadata: plant family, habitat region, approximate height and broad-leaf flag. Fish do not import or inspect meshes. Inspection regions are selected from actual template vertices on the channel-facing upper leaf area, with a safe outward/upward approach direction. These static regions need not chase every animated leaf tip. The existing target sampler applies soft preferences: gouramis favor broad-leaved plants, tetras favor taller vegetation edges over low grass, and rasboras accept most planted areas. No activity scheduler, fear signal, movement integrator or social algorithm is replaced.

Existing body-size offsets, safe straight-route tests and stalled-target abandonment remain authoritative. If 24 random forage trials miss a usable surface, a bounded nearest-safe fallback scans at most 256 regions. This improves sparse-habitat availability without changing the scheduler or its tuning. Leaves stay passable. Solid rock clearance and diver scattering still take priority over investigation; a nearby diver interrupts voluntary activity through the accepted recovery machinery.

## Lifecycle and practical limits

PlantSystem detaches its root before aquarium scenery disposal, then disposes instanced mesh resources, each template and the shared material once. Disposal/update after disposal is harmless. Metadata and shared arrays have no external listeners or timers. The temporary density setting is a validation option; the shipping aquarium uses 65 existing clusters, eight meadows and 40 fish.

The result is stylized thin-leaf vegetation, not botanical growth, physically simulated stems, or real fluid dynamics. Plant metadata and shader currents assume the existing untransformed environment root. Current normal adjustment is a lightweight bend-slope approximation. Larger future habitats may benefit from spatial batching; this pass keeps at most 15 vegetation draws rather than a draw per leaf. Hardware MacBook Air performance remains a manual acceptance check.

Pass 005 may add ambient sound through a separate lifecycle owner. This pass adds no audio, plant health, growth, harvesting, food, customization or backend. Await manual macOS acceptance before beginning Pass 005. See [validation](VALIDATION_V02_PASS_004.md) for executed checks, screenshots, performance and limitations.

## Pass 004B — meadows, visible flow and freshwater ornaments

`MeadowSystem` creates eight irregular islands with center-dense / sparse-edge radial placement, elliptical/wavy boundaries, 120–180 single blades per patch, mixed lengths and occasional taller ribbons. The default seed produces **1,225 blades**. These are not extra duplicated Hairgrass tufts: three shared one-blade templates feed three InstancedMeshes across all patches. Roots individually sample the actual substrate; geometry has narrow tapered profiles and flexible tips. Patches stay beside banks and quiet corners, away from the initial player/channel. Eight `grass-edge` interests expose useful inspection regions without registering every strand.

Meadows borrow the existing PlantSystem material and time uniform, so they require no independent animation update/clock. MeadowSystem owns/disposes only its three geometries and instance buffers; it never disposes the borrowed material. Aquarium disposes meadows before the material owner. Optional plant motion now uses selective coefficients: Vallisneria .072 (was .045), Sword .023 (.014), Fern .037 (.025), Anubias unchanged .006, Hairgrass .039 (.022), and meadow blades .075. Frequencies and the broad current model remain slow; position-dependent local phase adds variation among adjacent blades. Maximum motion bounds expand to .65 units. Pause and smooth reduced-motion phase retention are unchanged.

`HardscapeSystem` adds three branching, three rounded/lobed and three plate formations. These are **freshwater aquarium ornaments**, not living marine coral. Curved branching arms are smooth convex hulls of tapered spherical samples; rounded forms combine sculpted lobes; plates use irregular convex domes/lips around a narrow supporting stem. Mineral vertex variation and rough cream, muted coral-orange and lavender-gray materials match the existing style.

Rendering and collision use the same 39 convex component surfaces, transformed identically. No single convex hull blocks the empty space between branches or layers, and no arbitrary concave mesh is treated as a plane hull. The original 34 rock colliders remain separately available; the full environment contains 73 solid components. Nine new `hardscape-edge` interests and ten substrate interests share the existing body-size / clear-route / stalled-target pipeline. Hardscape placement preserves the central corridor and clearance from existing rocks; vegetation validates against the combined solid list.

Aquarium owns hardscape lifecycle, detaching its root before generic scene cleanup and disposing its nine merged geometry templates / three shared materials once. No food, growth, saltwater chemistry, plant health, audio or new physics engine is added. See [Pass 004B validation](VALIDATION_V02_PASS_004B.md) for visuals, motion pairs, collision checks, 16/25/45/60-fish measurements and the manual macOS checklist.
