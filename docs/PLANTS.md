# Marine habitat forms — Pass 007

The active environment contains **65 marine habitat colonies/clumps** across six forms, plus eight irregular tropical seagrass meadows. Freshwater plant families are absent. The historical `PlantSystem` module name describes shared GPU deformation infrastructure, not biological taxonomy.

| Form                     | Count | Category                          | Dimensional construction                                        |
| ------------------------ | ----: | --------------------------------- | --------------------------------------------------------------- |
| Turtle grass             |    16 | Flowering marine plant / seagrass | Curved broad strap blades with rounded tapered tips             |
| Feather Caulerpa         |    12 | Green macroalgae                  | Upright stolons with paired flattened pinnules                  |
| Red branching macroalgae |    12 | Red macroalgae                    | Fine tapered connected forks                                    |
| Halimeda                 |    10 | Green calcifying macroalgae       | Chains of flattened rounded segments and connecting stipes      |
| Finger leather coral     |     8 | Colonial animal / soft coral      | Fleshy branching fingers, rounded polyp tips and attached bases |
| Sea fan / gorgonian      |     7 | Colonial animal / soft coral      | Connected planar branching tube lattice with cross-branches     |

These forms use new species-specific geometry rather than relabeled freshwater leaves. Three seeded templates per family share one current-driven material; 18 instance batches handle the 65 clumps. Meadows share three efficient one-blade templates and the material/time uniform. The new reef arrangement deterministically produces 1,258 meadow blades at the default seed.

Seagrass and macroalgae occupy sand/rocky-bank margins; the central channel remains open. Soft corals and fans attach to exact convex upper reef surfaces, with their bases aligned to the supporting face normal. Their zero-flex root vertices remain fixed, while deformation is projected consistently through the instance orientation. Coral tissue may touch its support; non-attached algae/grass retains a clearance margin. Initialization checks actual transformed vertices across a conservative current envelope. Tests check actual transformed/bent vertices at multiple seeds and doubled density, rather than relying only on a footprint proxy.

## Structural reef and living coral

The original 34 structural reef-rock hulls remain. `HardscapeSystem` now distinguishes **six attached living stony colonies** from **three separate aquarium ornaments**. Living colonies use branching, rounded and plate skeletons attached to rock; plate supports create potential shaded shelter. Small instanced corallite details make living surfaces distinct from stone ornaments. There are **39 exact convex structural components**, so total solid hull count remains 73.

Only structural rock/skeleton/ornament geometry participates in major solid collision. Fine corallites, flexible coral tissue, algae, seagrass and pebbles remain passable. They are not replaced by oversized whole-colony boxes. Each rigid mesh's rendered structure matches its convex component union; attached bases intentionally join the supporting rock.

Stony skeletons stay rigid. Soft fingers, fans, algae and seagrass share slow position-dependent currents. Existing gentle movement direction and pause/reduced-motion settling are preserved. No coral growth, feeding, spawning or reproductive simulation is introduced. Coral is an animal, macroalgae is algae, and seagrass is a flowering plant.

## Resource ownership

`Aquarium` owns lifecycle. Fish, meadow, hardscape and marine vegetation roots detach before generic scenery cleanup. `PlantSystem` owns its 18 templates, instance buffers and one material. `MeadowSystem` borrows that material, owns only its three templates/buffers and disposes first. `HardscapeSystem` owns nine structural templates, one shared corallite geometry, four materials and its corallite instance buffers. Disposal remains idempotent and shared objects are released once.

See [habitat metadata](HABITAT.md), [fish](FISH.md), and [Pass 007 validation](VALIDATION_V02_PASS_007.md). Geometry is stylized, not a species-identification or aquarium-care reference. Living-tissue collision and biological simulation are intentionally absent.
