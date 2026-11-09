# Authored asset pipeline — Passes 012–013

## Authoring and reproduction

Blender 4.3.2 is installed and used to author/export the benchmark. Sources are [chromis.blend](../tools/art/chromis.blend), [acropora.blend](../tools/art/acropora.blend), [authoring script](../tools/art/author_benchmark.py) and [original map painter](../tools/art/textures.py). Blender sources pack their image dependencies. The Python source uses NumPy/Pillow/SciPy; Blender supplies `bpy`/`bmesh`/`mathutils`. These tools are authoring dependencies only, never runtime dependencies.

```bash
python3 tools/art/textures.py
blender -b --factory-startup --python tools/art/author_benchmark.py
python3 tools/art/inspect_assets.py
```

The fish uses an authored cross-section schedule, continuous skin, curved ray grids for distinct fins, dimensional eyes/gill/mouth details, UVs and two coordinated bend morphs. Median fins/peduncle use the same deformation field as the body. Paired fins have independent hierarchy pivots. A `SwimPreview` clip is exported for authoring/interchange. Runtime effort comes from existing fish phase/tail effort rather than an independent animation timer.

Coral uses an asymmetric scaffold with secondary/tertiary growth. Major branch junctions are voxel-fused in Blender; fine branches retain their own authored topology so remeshing cannot erase them while leaving floating calyces. Raised flared cups have recessed centers and axial tips. A basal tissue mat embeds in the original supporting reef. Hidden collision point sets are generated from the same branch paths and rebuilt into exact convex hulls after glTF decoding; fine surface corallite detail remains passable. The visible model is not a collision box.

All seven original 512px maps are bundled both as editable PNG source maps and embedded PNGs in GLB. There are no remote model/image dependencies at runtime. Meshes/UVs/normals, node transforms, PBR materials, alpha and optional animation data survive GLTFLoader. Exporting primitives into GLB is not a quality gate; actual browser renders must be reviewed.

## Runtime ownership

`src/assets/AssetRegistry.ts` is the typed local registry. `AssetLoader` uses Three.js `GLTFLoader` asynchronously, with one in-flight/read cache entry per asset ID. `SkeletonUtils.clone` creates lightweight independent hierarchies, morph weights and optional skeletons while retaining shared geometry/material/texture references. Clips are shared immutable data. No skeleton is required by the chromis morph workflow, but skeleton cloning is supported and tested.

The cache owns decoded geometries/materials/textures/ImageBitmaps. A lease owns only its cloned scene state. Releasing a lease is idempotent. Cache disposal retires entries immediately and defers shared destruction until the last live lease releases; pending loads are also cleaned on completion. Unique resources and bitmaps dispose/close once. A failed or invalid load is removed from the cache, logs a clear development error and may be retried. The showcase keeps the original procedural animals visible and displays an explicit failure message. Loading/ready/error states are visible; empty objects are never used as a successful fallback.

The loader rejects cross-origin external requests; embedded blob/data images and same-origin bundled files are supported. Asset validation checks required nodes, finite attributes, UVs/normals, PBR references, authored scale, required body/fin morphs and structural coral collision. `inspect_assets.py` independently checks actual GLB containers/accessors and decodes every embedded image, emitting [machine-readable provenance](../public/assets/manifest.json).

`AuthoredSchool` adapts the existing component instancing approach to glTF primitives and `InstancedMesh.setMorphAt`. Twenty instances share one mesh/material family and map set. Existing interpolated simulation roots supply position, size, yaw/pitch/bank; existing tail effort drives continuous bend weights and pectoral motion. Instance bounds refresh after animation. Geometry bounds are computed once; no geometry/texture is rebuilt each frame. The benchmark owns its material clones and instance/morph buffers, while the cache owns source data.

## Showcase integration

`benchmark.html` and `src/benchmark/` are a separate entry. Normal `npm run build` includes only the regular aquarium entry; the showcase HTML is emitted only by `npm run build:benchmark`. Pass 013 promotes the new ornament/anchored/clownfish libraries into the ordinary aquarium. Asset files remain locally bundled under `public/assets`; chromis and Acropora remain available in the separate benchmark.

The application has a one-time optional world/state configuration callback; `UnderwaterScene` owns an optional presentation lifecycle updated after the ordinary aquarium and disposed before it. The optional benchmark presentation composes with the normal Pass 013 hero layer. A scoped collision replacement method preserves the shared collider-array identity/order for fish and player. The benchmark replaces only the selected branching formation's components, restores them on comparison/disposal, and leaves fish tuning, spawn roster, interests/homes, controls, physics, settings and audio intact.

```bash
npm run dev -- --host 127.0.0.1 --port 5176
# open http://127.0.0.1:5176/benchmark.html
npm run build:benchmark
npm run preview -- --outDir dist-benchmark --host 127.0.0.1 --port 5177
```

The clearly marked development panel reports load state, compares with Pass 011 and links back to the normal aquarium. Enter/escape/WASD remain the real application controls. No permanent debug menu ships in the normal build. For matched portrait evidence the validation harness controls a single fish pose; it discloses this fixture and uses identical cameras in before/assets-only/after captures. The animation sequence restores an actual simulated animal and follows its locomotion.

## Required validation

Run all routine/stress checks, `python3 tools/art/inspect_assets.py`, and `validation/visual-benchmark.mjs` using the documented Playwright/Chromium overrides. The latter loads real GLBs/maps, records matched views and isolated/full-scene budgets, checks native swimming, pause/reduced motion, fallback, containment and repeated disposal, and captures deterministic animation frames. Encode the retained sequence with ffmpeg at 30 FPS; this is simulated time, not measured hardware performance. Repeat against the benchmark production build and check the normal production entry separately.

See [manifest](ASSET_MANIFEST.md), [art direction](ART_DIRECTION.md) and [current evidence/limitations](VALIDATION_V02_PASS_012.md). Wider conversion and final quality acceptance remain separate decisions.

## Pass 013 authoring and integration

```bash
python3 tools/art/pass013/textures.py
blender -b --factory-startup --python tools/art/pass013/author.py
blender -b --factory-startup --python tools/art/pass013/creatures.py
python3 tools/art/pass013/collision_inventory.py
python3 tools/art/inspect_assets.py
```

Use Blender 4.3.2 and the existing pinned Python art dependencies. `baseline.json` is a retained local-coordinate reference extracted from the accepted ornament collision surfaces and discovery homes before replacement; regeneration must not silently re-sample a changed world. `author_benchmark.py` is import-safe and still regenerates the original benchmark when executed directly. Blender files pack their images and retain editable separate construction elements. The prop/anchored libraries stage named roots seven units apart for source inspection; the runtime resets each selected root's gallery translation. Their export bakes Blender Z-up to game Y-up and uses `export_yup=False`; controller-local vertices require no extra conversion wrapper. Clownfish use the accepted fish exporter and `export_yup=True`, including its root conversion and morph keys.

`AuthoredAquarium`, owned by `UnderwaterScene`, acquires all libraries before swapping presentation. It hides original materials rather than controller nodes, keeping inherited controller transforms available to authored children. Body deformation uses existing moray and anemone uniforms; foot/tail/fin/lure/head/jaw parts attach to existing pivots. The clownfish school shares decoded geometry/maps and updates two instance poses. No behavior controller, population, home-selection algorithm, physics/audio tuning or lighting is replaced. Initialization checks the existing steering look-ahead before accepting a seeded heading; blocked headings try nearby clear directions without consuming more random values or moving the spawn center. Original geometry remains resident for atomic comparison and fallback; this increases CPU-side resident inventory and is disclosed in validation.

Each asset is local and self-contained. Loading status is visible until ready; any missing/invalid library leaves the original aquarium usable and reports the fallback. Pending disposal releases fulfilled leases after the remaining loads settle. Disposal restores colliders and original visibility, detaches authored parts, disposes instance/deformation material resources, and finally releases the cache. `setEnabled` exists for automated matched-pose comparisons; no debug panel is added to the normal UI.

`collisions.json` records exact exported structural point sets and transforms for CPU-only collision/stress tests. Run the inspection scripts after any re-export. `validation/geometry-overhaul.mjs` captures all ten paired views, checks three deduplicated GLB requests, shader/page errors, disposal and missing-library fallback. The existing ornament/anchored/discovery harnesses now await the default authored scene. See [Pass 013 validation](VALIDATION_V02_PASS_013.md) for the measured limits and macOS checklist.

## Pass 014 reef environment

```bash
npx vitest run --config tools/art/pass014/vitest.config.ts   # only when the accepted layout changes
python3 tools/art/pass014/textures.py
python3 tools/art/pass014/build.py      # with `pip install bpy==5.1.2` (Python 3.13)
# or: blender -b --factory-startup --python tools/art/pass014/build.py  (Blender 5.1)
python3 tools/art/inspect_assets.py
```

The cloud container for this pass could not download the Blender 4.3.2 application, so the reef library was built with Blender **5.1.2 as a Python module** (`bpy` from PyPI) and its bundled glTF exporter. Pass 012/013 sources are untouched and still regenerate with 4.3.2. The Pass 014 `.blend` is saved by 5.1 and will not open in 4.3.

`baseline.extract.ts` records the accepted pre-Pass-014 structure: the six major and three pebble rock template hulls, all 34 rock placements, the nine hardscape formations' exact convex parts (recovered by plane vertex enumeration), and every plant template's radial envelope per 1/20 height band. The authoring code reads only this file, so regeneration never re-samples a changed world.

Construction contracts:

- **Rocks**: a level-5/4/3 icosphere is ray-cast onto the accepted hull from its centroid (the hull is star-shaped), then carved inward by archetype features. Every vertex is asserted inside the hull. Upward faces keep a small tolerance, and depth below the sand line is suppressed. Structural parts are k-means clusters of the carved surface, reduced to support points along 96 Fibonacci directions plus box diagonals. Each part is a subset of the accepted hull, so the reef never gains solid volume.
- **Corals**: built from the formation parts' own points (principal axes for branches and stems, ray-cast lobes, hull-clamped plates). Passable growth may extend beyond the parts.
- **Vegetation**: templates are normalised to unit height with roots at y = 0. A smooth height-dependent XZ fit keeps every band inside the procedural template's validated envelope.
- **Export**: glTF Y-up (`export_yup=True`). Mesh children carry no transforms; roots are staged on a grid only for inspection, and the runtime ignores root translation. Closed solids are single-sided; algae and soft tissue are double-sided. Vertex colours are converted to linear before export.

Runtime: `AuthoredReef` (owned by `UnderwaterScene`) leases the `reef` library through the shared `AssetLoader` contract. It then applies the following, with `setEnabled` toggling all of it atomically and restoring collider identity:

- **Rocks**: 34 three-level `THREE.LOD` reef rocks on the exact accepted transforms. Each rock's hull is swapped for its authored parts via `replacePresentationColliders`.
- **Corals**: nine formations replaced in place.
- **Vegetation**: instanced plant and meadow geometry swapped while keeping instance matrices, the shared current uniform and the pause/reduced-motion clock.
- **Substrate**: the PBR sand material adopted, plus pooled debris, a meadow understory and the flattened backdrop.

Load failure, or disposal before load, leaves the procedural reef untouched. Disposal releases its materials, cloned sand textures, instanced buffers and lease exactly once. `validation/ReefAsset.ts` reads the GLB on the CPU for tests and stress scenarios, and `validation/reef-overhaul.mjs` captures the matched evidence.

## Pass 015 corals, creatures and nudibranchs

```bash
python3 tools/art/pass015/textures.py
python3 tools/art/pass014/build.py         # reef library with the Pass 015 coral builders and maps
python3 tools/art/pass015/creatures.py     # re-authors the pinned Pass 013 creature export
python3 tools/art/pass015/nudibranchs.py
python3 tools/art/inspect_assets.py
```

All three use Blender 5.1.2's Python module, as in Pass 014.

- **Creatures.** `creatures.py` imports `anchored-life.pass013.glb`; a Blender glTF import/export roundtrip was verified lossless for every node, root offset and vertex. It then applies a simple subdivision where density is needed (the moray body and seahorse tail), a few millimetres of relief along the normal, and object-space vertex colour with cavity and underside occlusion, and assigns new skin materials. The moray body keeps `z = 1 − v` (its GPU centreline parameter), and the frogfish sole receives no relief.
- **Runtime.** `AuthoredAquarium` strips the procedural moray shader's colour override (keeping its deformation) so the authored skin shows. It attaches one authored nudibranch per animal under the existing nudibranch root, copying each animal's crawl-pose matrix every frame. It reproduces the mantle ripple from the shared nudibranch clock (pause and reduced motion unchanged) and hides the procedural instances.
- **Reef.** `AuthoredReef` builds a `THREE.LOD` (switching at 10 units) for any coral that has an `_LOD1` level.
- **Evidence.** `validation/creature-overhaul.mjs` captures matched coral and creature close-ups for one build. Run it against the previous candidate and this branch.

## Pass 017 fish distance levels and compression

Full regeneration order (each step reads the previous step's uncompressed output):

```bash
python3 tools/art/pass016/fish.py            # four species from the pinned accepted chromis
python3 tools/art/pass017/fish_lod.py        # adds *_LOD1 levels to all six fish libraries
# (other authoring scripts as in Passes 012-015, writing uncompressed GLBs)
node tools/art/pass017/compress.mjs          # last step: Draco geometry + WebP textures, in place
python3 tools/art/inspect_assets.py
```

- **Pinned inputs.** The accepted chromis and clownfish are pinned uncompressed in `tools/art/pass017/accepted/`; the Pass 013 creatures stay pinned in `tools/art/pass015/`.
- **Idempotent steps.** `compress.mjs` skips files that already use `KHR_draco_mesh_compression`, so it never re-quantizes. `fish_lod.py` replaces any existing `_LOD1` level instead of stacking a second one.
- **Source maps.** Source PNG maps moved from `public/assets/textures/` to `tools/art/textures/`. They are authoring inputs embedded into GLBs, and no longer ship in `dist/`.
- **Compression settings.** Positions use 16-bit quantization, normals 10-bit, UVs 14-bit and colours 8-bit (edgebreaker). Colour maps are WebP at quality 88; normal and ORM maps are near-lossless WebP. Primitives with morph targets stay uncompressed (Draco does not cover morphs). Node transforms are untouched, so controller-local frames and collision point sets keep their meaning.
- **Runtime.** `AssetLoader` lazily owns a `DRACOLoader` (two workers) that decodes with the local `public/assets/draco/` wasm decoder (Apache-2.0), and disposes it with its cache. No runtime network requests are added.
- **Tooling.** Tests decode Draco through `draco3dgltf` (`validation/ReefAsset.ts`); the Python inspector uses DracoPy.
