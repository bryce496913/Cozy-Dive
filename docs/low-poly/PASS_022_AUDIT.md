# Pass 022 — complete coral migration inventory

The initial audit was completed against every playable environment. Runtime coral geometry now
comes from `environment/shared/CoralLibrary.ts`; the machine-readable family map is
[`coral-inventory.json`](coral-inventory.json).

| Source                                                              | Known growth forms                            | Integration to inspect                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthoredReef.ts`, reef GLB and `ReefLayout.ts`                     | branching, massive/brain, plate, soft and fan | canonical geometry replaces visible GLB coral; accepted placements, collision hulls, discovery anchors and LOD distance remain                                                                                                            |
| `HardscapeSystem.ts`, `config/coralColonies.ts`, `AssetRegistry.ts` | branching, massive/brain and plate            | canonical fallback geometry; established structural collision and shelter contracts remain                                                                                                                                                |
| `PlantGeometry.ts`, `PlantSpecies.ts`                               | finger leather and gorgonian fan              | canonical rooted forms retain the shared height-weighted water-motion attribute                                                                                                                                                           |
| `outer/`, outer reef GLB                                            | massive/brain, branching, plate, soft and fan | canonical visible forms at every quality tier; terrain seating, batching, worms and collision anchors remain                                                                                                                              |
| `wreck/WreckGrowth.ts`, `shared/GrowthForms.ts`                     | sea fan, soft, black, wire and plate          | shared family forms for fan/black/plate; wire coral and the existing continuous wreck soft coral retain their distinct growth and geometry envelopes because rare-miniature seats depend on them; surface attachments and batching remain |
| `ice/IceGarden.ts`, `TankCollectionShapes.ts`                       | Antarctic soft coral                          | one canonical source feeds seabed garden and collection preview; existing instancing and placement remain                                                                                                                                 |

The shared restrained palettes use vertex colour blocks multiplied by the established environment
materials. Hard coral is static. Flexible families retain anchored, height-weighted deformation.
Generators are deterministic per seed and expose a cheaper distance tier with the same growth form.
