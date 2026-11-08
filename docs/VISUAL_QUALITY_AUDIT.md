# Visual quality audit — Pass 012

Base `main` is `11e8a6f` (merged Pass 011). The user rejects the current art standard. Passing geometry, collision and lifecycle tests establishes functional safety; it does not establish convincing art.

## Current construction

`FishGeometry.ts` lofts elliptical sections from a short species profile. Chromis use ten longitudinal rows and ten radial samples. Vertex colors provide broad back/belly gradients. Eyes and simple fins are merged into five shared geometries per species. Six species own 30 geometries / 12 materials. `FishSystem` retains a 30 Hz pure simulation, interpolates position/orientation and independently rotates rear, tail and pectoral pivots. `FishRenderBatch` submits one instanced mesh per matching component and refreshes conservative bounds. Geometry/materials belong to templates; instance buffers belong to batches. This separation is valuable and can support an authored hierarchy without rewriting locomotion.

`PlantGeometry` assembles seagrass ribbons, tapered tubes and branched forms, then removes UVs and merges templates. Eighteen clump and three meadow templates share a current-deformed vertex-colored material. Hardscape builds a handful of convex branches/rounded/plate forms, plus sparse small corallite spheres. Living colonies attach to real reef planes. Rocks are displaced convex hulls with coarse mineral vertex colors. Convex rendering/collision alignment protects swimming, but uniformly convex silhouettes suppress crevices, layered erosion and contact detail.

Anemone/moray/hidden animals have explicit procedural construction and local animation ownership. Their dedicated anatomy improves recognition but does not solve material richness. No externally authored model loader, UV texture library or PBR baking workflow existed. Most materials have one uniform roughness value; chromis metalness is 0.2. There is no image-based surface-scale detail. Sand uses vertex-colored geometry. All runtime scenery is local/generated.

`UnderwaterScene` uses ACES filmic tone mapping, sRGB output, exposure 1.35, a 2.6-intensity hemisphere, a 3.2-intensity warm directional sun and a 0.7 blue fill. Exponential blue-green fog supplies distance. Large translucent light-shaft geometry adds atmosphere. No shadow map/contact shadow or environment reflection reveals small surface relief. Strong ambient/exposure reduces material separation, while broad uniform colors make coral read as plastic branches and rocks as smooth blobs.

## Why the current assets read as placeholders

- Chromis have an abbreviated forehead/peduncle profile, planar generic membranes, almost no fin-ray structure, simple eye rings and no scale/gill microstructure. Increasing ring counts alone would preserve that generic design.
- Fin detail does not describe distinct anatomical rays, thickness or flex. Abrupt rigid rear/tail joints cannot make a continuously bending skin. Shared resources are appropriate; identical coarse silhouettes and sparse surface information are not an art standard.
- Coral has too few growth decisions and repeating branch radii. Tiny scattered spheres do not describe axial and radial corallites, flared lips, recessed calices or fused growing tissue.
- Uniform roughness and vertex tint cannot provide deliberate scale edges, fine skeletal texture, subtle occlusion and material response at inspection distance. Metallic shine is an inadequate substitute for restrained biological iridescence.
- There is little contact shading, warm/cool separation or controlled foreground framing. High ambient illumination flattens surface relief. More saturation, bloom or polygons would not address these causes.

## Baseline and adaptation boundary

Pass 011 owns 178 geometries / 42 materials and 139 hulls. At 960×640/DPR1 its overview submits 210 draws / 258,148 triangles; floor 116 / 198,706; away 41 / 141,660. Forty free swimmers remain six species. Persistent audio is 19 nodes, three buffers and three loops. JS is 730.86 kB / 195.90 kB gzip. SwiftShader timing is not MacBook Air performance. See [historical measurements](VALIDATION_V02_PASS_011.md).

Retain pure behavior, timing, spawn IDs, schooling, home metadata, settings, player physics and audio. Add a shared GLTFLoader cache with explicit leases, decoded-resource ownership, validation and visible fallback. glTF hierarchy, materials, UVs, morphs, skeletons and clips must survive loading. Adapt component instancing to authored morph-capable meshes; do not reduce skin animation to rigid root rotation. Authoring should happen in Blender with editable source, intentional anatomy, UVs and maps, not by wrapping the old primitives in a GLB.

A separate benchmark entry should replace only chromis presentation and one branching colony, compare identical cameras, retain first-person swimming, and keep the normal aquarium unchanged. New coral collision must follow its branches rather than blocking its entire bounding box. Lighting changes belong to that showcase until accepted. Convert the wider aquarium only after rendered quality and target-device performance acceptance.

## Reference study

Reference images are studied, not copied into assets or redistributed. The original assets must not include photograph/game texture data.

- [Oregon Coast Aquarium: blue-green chromis](https://aquarium.org/animals/blue-green-chromis/) and [CMFRI species account](https://eprints.cmfri.org.in/14853/): compressed blue-green body, pale underside, deeply forked tail and distinct dorsal/anal/paired fins.
- [REEF identification](https://www.reef.org/species/blue-green-chromis): avoid incorrectly adding the black pectoral-base spot of a similar species.
- [Corals of the World: Acropora granulosa imagery](https://www.coralsoftheworld.org/species_factsheets/species_factsheet_summary/acropora-granulosa/) and [Cambridge corallite microscopy](https://www.cam.ac.uk/stories/duygu-sevilgen): branch/tip asymmetry and recessed radial cups, rather than a smooth cylinder cluster.
- [NOAA Wake Island coral field guide](https://www.coris.noaa.gov/activities/wake_coral_field_id/field_guide_corals_wake_island_2021.pdf): axial terminal and radial side corallites inform the branching benchmark. This is an Acropora-inspired art model, not a taxonomic reconstruction.

Blender 4.3.2 is installed and has been launched successfully in background mode. Authoring capability is available; a convincing render still requires direct review and cannot be inferred from this audit or a successful export.
