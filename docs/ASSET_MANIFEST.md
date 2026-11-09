# Asset provenance and inventory — Passes 012–013

All models, texture pixels and editable Blender sources in this pass are original work produced for Cozy Diver. No third-party mesh, scan, photograph texture or game asset is embedded. They are offered under **CC0-1.0**; attribution is not required. [License text](../public/assets/LICENSE.txt). Anatomy/morphology research links in the [audit](VISUAL_QUALITY_AUDIT.md) are reference-only and are not copied or redistributed.

Blender 4.3.2 exports glTF 2.0/GLB with Y-up and the game's X-forward fish convention. Scale matches existing aquarium world units, including the 0.46-unit chromis; these are game proportions, not a biological husbandry scale. Originals and regeneration commands are in [the pipeline](ASSET_PIPELINE.md).

| File                               | Creator / license    | Visible triangles / collision triangles | Primitives / materials | Texture maps                                                                | Animation / use                                          |
| ---------------------------------- | -------------------- | --------------------------------------: | ---------------------: | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `assets/models/fish/chromis.glb`   | Cozy Diver / CC0-1.0 |                              12,686 / 0 |                  8 / 5 | chromis-normal 512², chromis-base 512², chromis-orm 512², chromis-fins 512² | SwimPreview; benchmark only                              |
| `assets/models/coral/acropora.glb` | Cozy Diver / CC0-1.0 |                          82,416 / 5,666 |                  2 / 2 | acropora-normal 512², acropora-base 512², acropora-orm 512²                 | Rigid living skeleton; no animation clip; benchmark only |

Fish maps: blue-green base color, fine scale normal, packed roughness/metal and ray-detailed RGBA fin membrane. Coral maps: peach/lavender/cream base color, skeletal micro-normal and packed roughness/metal. Source map names use `orm`, but the Blender export connects roughness/metal; an occlusion channel is not claimed as a baked whole-model AO solution. All relevant maps are 512×512, locally embedded PNGs. Source PNGs remain under `tools/art/textures` for authoring.

The chromis has `Chromis_Root`, `Body`, `Median_Fins`, `Pectoral_Left`, `Pectoral_Right`, dimensional anatomy primitives, and `Stroke_Left`/`Stroke_Right` morphs on skin/median fins. `SwimPreview` is an interchange clip; runtime uses the accepted fish phase/effort. The Acropora-inspired colony has `Living_Tissue`, `Radial_And_Axial_Corallites` and named hidden convex components `COLLIDER_*`. Shared re-use is supported; this pass replaces one colony rather than filling the scene with this inspection-detail model.

The generated [JSON manifest](../public/assets/manifest.json) records filenames, SHA-256, byte sizes, decoded image dimensions, geometry accessor bytes, scale, creator, license, attribution, clips and intended use. Tests verify the hash/container, self-contained resources, nodes, UVs/normals and inventory. The independent inspection script validates actual accessor numbers and decodes the PNGs; browser GLTFLoader checks provide real parse/render evidence.

Quality is not a manifest field. These are authored candidate assets with known procedural regularity; professional art direction and user/macOS acceptance remain pending. Do not treat licensing, file validity or a triangle count as proof of final art quality.

## Pass 013 default aquarium assets

All additions are original Cozy Diver work, CC0-1.0, with no attribution requirement or external runtime requests. Editable, packed sources live in `tools/art/pass013/`; the deterministic Python scripts preserve the authoring recipe. Textures are original 512² PNG sets in `tools/art/textures/pass013/`, embedded into the GLBs. These are game-scale ornaments, not physical husbandry models.

| Authored root / role                   | Source `.blend` → exported `.glb`                     |         Visible triangles | Maps                              | Collision / animation dependencies                                                                                     | Viewing importance              |
| -------------------------------------- | ----------------------------------------------------- | ------------------------: | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Log / moray shelter                    | `reef-props.blend` → `ornaments/reef-props.glb`       |                    18,342 | wood base/normal/ORM              | Separate shell sectors and stump hulls; both ends open                                                                 | Hero tunnel, inside and outside |
| Shipwreck / discovery perch            | same                                                  |                    11,204 | wood base/normal/ORM              | Bowed plank, frame, deck, cabin components; protected frogfish floor and nudi roof                                     | Hero constructed ornament       |
| Arch / swim-through and crawler ledges | same                                                  |                    36,308 | stone base/normal/ORM             | Individual sculpted stone hulls; protected crawler patches                                                             | Hero passage                    |
| Filter / aquarium equipment            | same                                                  |                     7,436 | Solid PBR equipment/metal         | Housing, intake and nozzle hulls; original local outflow                                                               | Medium close-up                 |
| Chest / animated ornament              | same                                                  |                     7,220 | wood base/normal/ORM + metal      | Static case components, hinge-local curved lid; original chest clock, occupancy guard, bubbles                         | Hero animated close-up          |
| Statue / carved ornament               | same                                                  |                    18,754 | stone base/normal/ORM             | Sculpted body/crown and face proxy; protected crown perch                                                              | Hero silhouette and face        |
| Seahorse / anchored discovery          | `anchored-life.blend` → `creatures/anchored-life.glb` |                    19,024 | horse base/normal/ORM             | Existing root/tail/dorsal/pectoral pivots, grip and awareness                                                          | Small inspection discovery      |
| Frogfish / perched discovery           | same                                                  | 21,240 (foot drawn twice) | frog base/normal/ORM              | Existing breathing body, mirrored feet, lure and rare walk                                                             | Small inspection discovery      |
| Moray / log inhabitant                 | same                                                  |                    13,242 | moray base/normal/ORM             | Existing centerline GPU deformation, extension/phase uniforms, head/jaw controllers                                    | Hero shelter discovery          |
| Anemone / host habitat                 | same                                                  |                    58,448 | anemone base/normal/ORM           | Existing active/reduced-motion clock, attachment basis and host envelope                                               | Hero host close-up              |
| Clownfish pair / host residents        | `clownfish.blend` → `fish/clownfish.glb`              |               12,686 each | clown base/normal/ORM + RGBA fins | Accepted fish morph topology; species proportions, rounded tail, current tail effort and pectorals; two instanced rigs | Hero fish close-up              |

The six ornaments share one 99,264-triangle library; anchored animals share one library. Each is decoded once. Each library is leased as a cloned hierarchy, and selected controller-local parts are attached to the existing scene. Attached coral forks are included in ornament counts. No fine coral branches, bark fissures or decorative fasteners become separate gameplay obstacles. `COLLIDER_` structural meshes are hidden and rebuilt as exact convex hulls from exported points. Directional support sampling bounds structural proxy complexity independently of dense visible bevel/sculpt topology. `DYNAMIC_ChestLid` is hidden and explicitly converted to the original moving lid collider's local frame, retaining collider identity and the existing safety guard. The generated manifest supplies exact aggregate counts, sizes and hashes; individual role counts above exclude hidden collision geometry.

## Pass 014 reef environment library

`assets/models/reef/reef-environment.glb` is original Cozy Diver work under CC0-1.0, with no attribution required. It is generated by `tools/art/pass014/reef_geometry.py` (seeded NumPy construction against the accepted envelopes in `baseline.json`). It is assembled and exported by `build.py` through Blender 5.1.2's Python module, and the packed editable source is `tools/art/pass014/reef-environment.blend`. All 18 texture maps are original 512² tileable PNGs synthesised by `tools/art/pass014/textures.py` (spectral noise and periodic Voronoi cells), stored in `tools/art/textures/pass014/` and embedded in the GLB. No external meshes, scans or photographs are used.

| Root family                                 | Count | Triangles each                    | Maps                      | Structural collision / animation                                                                 | Viewing importance               |
| ------------------------------------------- | ----: | --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| `Rock_0..5` (four archetypes)               |     6 | 20,480 / 5,120 / 1,280 (3 levels) | reef-rock (triplanar)     | 6–10 convex `COLLIDER_` parts, all inside the accepted hull; replaces the single hull at runtime | Hero, mid and far reef, backdrop |
| `Pebble_0..2`                               |     3 | 320                               | reef-rock                 | Passable; reuse the 55 accepted pebble transforms                                                | Low (substrate)                  |
| `Coral_Branching_0..2` (+ tips)             |     3 | 9,000–10,000                      | coral-polyp               | Accepted capsule parts unchanged; secondary/tertiary growth passable                             | Hero coral                       |
| `Coral_Massive_0..2`                        |     3 | 20,480                            | coral-brain / coral-polyp | Accepted lobe parts unchanged; valleys carved inside them                                        | Hero coral                       |
| `Coral_Plate_0..2`                          |     3 | 17,768                            | coral-polyp               | Accepted stem/plate parts unchanged; branchlets passable                                         | Hero coral                       |
| `Soft_Coral_0..2`, `Sea_Fan_0..2`           |     6 | 4,700–7,500                       | soft-tissue               | Passable; existing GPU current deformation; seahorse grip on the fan stem preserved              | Medium, close inspection         |
| Turtle grass, Caulerpa, Halimeda, red algae |    12 | 690–4,040                         | algae                     | Passable; existing GPU current deformation                                                       | Medium                           |
| `Meadow_Blade_0..2`                         |     3 | 40                                | algae                     | Passable; instanced: 1,152 accepted plus 824 understory blades                                   | Low (instanced)                  |
| `Shell_0..2`, `Rubble_0..1`                 |     5 | 60–320                            | coral-polyp               | Passable; pooled instancing                                                                      | Low (substrate)                  |
| `Sand_Material`                             |     1 | 1 (material carrier)              | sand                      | None; the runtime adopts its PBR set for the procedural substrate                                | Whole floor                      |

Plant templates carry linear RGB vertex colour plus a per-stem current phase in `TEXCOORD_1`. Rock and coral roots record `archetype`, `kind` and `formation` extras. The GLB is 19.5 MB: 6.9 MB embedded PNG and 12.4 MB geometry accessors. That is larger than the Pass 013 libraries (8.8 MB together); no mesh or texture compression is claimed. Exact hashes, bytes, decoded image sizes and per-family triangle totals are in [manifest.json](../public/assets/manifest.json) under `pass014`.

## Pass 015 corals, creatures and nudibranchs

All Pass 015 content is original Cozy Diver work under CC0-1.0, with no attribution required. Nine new 512² micro-detail sets live in `tools/art/textures/pass015/`, synthesised by `tools/art/pass015/textures.py`: coral-acropora, coral-brain, coral-plate, soft-polyp, frog-skin, eel-skin, bony-plate, tentacle and nudi-skin. The Pass 014 coral-polyp, coral-brain and soft-tissue sets were retired.

| File                                        | Change                                                                                                                                                                                                                                                        |    Size |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------: |
| `assets/models/reef/reef-environment.glb`   | Coral builders rebuilt (budding corallites, level-5 brain lobes, hummocky boulder, gnarled plate trunk). Coral distance LODs (`Coral_Branching_k_LOD1`, `Coral_Massive_k_LOD1`). Richer soft corals and fans. Rocks, sand and vegetation placements unchanged | 32.0 MB |
| `assets/models/creatures/anchored-life.glb` | Seahorse, frogfish, moray and anemone re-authored on the accepted Pass 013 meshes: relief, vertex-colour pattern and occlusion, new skin materials. Same nodes, roots and frames                                                                              |  8.2 MB |
| `assets/models/creatures/nudibranchs.glb`   | New: `Nudibranch_1..5`, about 6–7k triangles each, inside the validated surface-home envelope                                                                                                                                                                 |  2.1 MB |

The accepted Pass 013 creature export is pinned as `tools/art/pass015/anchored-life.pass013.glb`, and regeneration always starts from it. Editable sources are `tools/art/pass015/anchored-life.blend` and `nudibranchs.blend`. Clownfish are unchanged in this pass. Exact hashes, sizes, images and triangle totals are in [manifest.json](../public/assets/manifest.json).

## Pass 016 reef fish

`fish/cardinalfish.glb`, `fish/firefish.glb`, `fish/assessor.glb` and `fish/gramma.glb` (about 1.08 MB each, 12,686 visible triangles, two stroke morphs each) are original CC0-1.0 Cozy Diver work, derived from the accepted Pass 012 chromis. Their editable sources are `tools/art/pass016/*.blend`, and the script is `tools/art/pass016/fish.py` (Blender 5.1.2 module). `tools/art/textures/pass016/` holds luminance-only versions of the accepted chromis base and fin maps. `fish/chromis.glb` now also ships in the normal aquarium. Hashes and inventory are in [manifest.json](../public/assets/manifest.json).

## Pass 017 compression

Every shipped GLB is now Draco-compressed with WebP textures (see the [pipeline](ASSET_PIPELINE.md)). Shipped models went from 55 MB to 17 MB in total:

| File                                                        | Uncompressed | Compressed |
| ----------------------------------------------------------- | -----------: | ---------: |
| reef/reef-environment.glb                                   |      32.0 MB |    7.75 MB |
| creatures/anchored-life.glb                                 |      8.15 MB |    3.20 MB |
| ornaments/reef-props.glb                                    |      4.39 MB |    1.10 MB |
| creatures/nudibranchs.glb                                   |      2.14 MB |    0.71 MB |
| fish/chromis.glb (+ LOD)                                    |      1.21 MB |    0.61 MB |
| fish/clownfish.glb (+ LOD)                                  |      0.85 MB |    0.52 MB |
| fish/cardinalfish, firefish, assessor, gramma (+ LOD, each) |     ~1.17 MB |   ~0.64 MB |
| coral/acropora.glb (benchmark only)                         |      3.45 MB |    0.83 MB |

The normal-scene download is about 16 MB, against about 53 MB before. Source maps live in `tools/art/textures/`. The local Draco decoder in `public/assets/draco/` (Apache-2.0, from three r187) is 0.76 MB on disk, of which browsers fetch about 0.25 MB (wasm and wrapper); the 0.5 MB asm.js fallback loads only without WebAssembly. Hashes are in [manifest.json](../public/assets/manifest.json).
