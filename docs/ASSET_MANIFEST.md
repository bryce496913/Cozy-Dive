# Asset provenance and inventory — Pass 012

All models, texture pixels and editable Blender sources in this pass are original work produced for Cozy Diver. No third-party mesh, scan, photograph texture or game asset is embedded. They are offered under **CC0-1.0**; attribution is not required. [License text](../public/assets/LICENSE.txt). Anatomy/morphology research links in the [audit](VISUAL_QUALITY_AUDIT.md) are reference-only and are not copied or redistributed.

Blender 4.3.2 exports glTF 2.0/GLB with Y-up and the game's X-forward fish convention. Scale matches existing aquarium world units, including the 0.46-unit chromis; these are game proportions, not a biological husbandry scale. Originals and regeneration commands are in [the pipeline](ASSET_PIPELINE.md).

| File                               | Creator / license    | Visible triangles / collision triangles | Primitives / materials | Texture maps                                                                | Animation / use                                          |
| ---------------------------------- | -------------------- | --------------------------------------: | ---------------------: | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `assets/models/fish/chromis.glb`   | Cozy Diver / CC0-1.0 |                              12,686 / 0 |                  8 / 5 | chromis-normal 512², chromis-base 512², chromis-orm 512², chromis-fins 512² | SwimPreview; benchmark only                              |
| `assets/models/coral/acropora.glb` | Cozy Diver / CC0-1.0 |                          82,416 / 5,666 |                  2 / 2 | acropora-normal 512², acropora-base 512², acropora-orm 512²                 | Rigid living skeleton; no animation clip; benchmark only |

Fish maps: blue-green base color, fine scale normal, packed roughness/metal and ray-detailed RGBA fin membrane. Coral maps: peach/lavender/cream base color, skeletal micro-normal and packed roughness/metal. Source map names use `orm`, but the Blender export connects roughness/metal; an occlusion channel is not claimed as a baked whole-model AO solution. All relevant maps are 512×512, locally embedded PNGs. Source PNGs remain under `public/assets/textures` for authoring.

The chromis has `Chromis_Root`, `Body`, `Median_Fins`, `Pectoral_Left`, `Pectoral_Right`, dimensional anatomy primitives, and `Stroke_Left`/`Stroke_Right` morphs on skin/median fins. `SwimPreview` is an interchange clip; runtime uses the accepted fish phase/effort. The Acropora-inspired colony has `Living_Tissue`, `Radial_And_Axial_Corallites` and named hidden convex components `COLLIDER_*`. Shared re-use is supported; this pass replaces one colony rather than filling the scene with this inspection-detail model.

The generated [JSON manifest](../public/assets/manifest.json) records filenames, SHA-256, byte sizes, decoded image dimensions, geometry accessor bytes, scale, creator, license, attribution, clips and intended use. Tests verify the hash/container, self-contained resources, nodes, UVs/normals and inventory. The independent inspection script validates actual accessor numbers and decodes the PNGs; browser GLTFLoader checks provide real parse/render evidence.

Quality is not a manifest field. These are authored candidate assets with known procedural regularity; professional art direction and user/macOS acceptance remain pending. Do not treat licensing, file validity or a triangle count as proof of final art quality.
