# Pass 022 — coral migration audit (in progress)

Base: Pass 021 audit branch (`3b5c15b`). Pass 021 itself is incomplete. This file is an initial
source map, not a completed migration inventory or an acceptance report.

| Source | Known growth forms | Integration to inspect |
| --- | --- | --- |
| `AuthoredReef.ts`, reef GLB and `ReefLayout.ts` | branching, massive, plate, soft; massive variants include brain | aquarium original, benchmark and habitat variants, LOD, collisions and discovery anchors |
| `HardscapeSystem.ts`, `config/coralColonies.ts`, `AssetRegistry.ts` | living branching colonies and authored Acropora | aquarium collision, shelter and catalog placements |
| `PlantGeometry.ts`, `PlantSpecies.ts` | finger leather, gorgonian fan | water motion, rooted bases and habitat associations |
| `outer/`, outer reef GLB | massive, branching and plate | terrain, distant variants and quality tiers |
| `wreck/WreckGrowth.ts`, `shared/GrowthForms.ts` | sea fans, soft, black, wire and plate corals | wreck surface attachments and batching |
| `ice/IceGarden.ts`, `TankCollectionShapes.ts` | Antarctic soft coral | seabed attachment, collection source and animation |

Remaining work: trace all generator and GLB consumers, quality levels, attached growth and fallback
paths; record each family and variant; rebuild canonical shapes and materials; preserve collision,
habitat and motion contracts; validate deterministic seeds, close and full-habitat views, loading,
resource use and performance; update the complete inventory and run build, typecheck, lint and tests.
No model or runtime behavior has changed in this audit.
