# v0.2 Pass 012 — Visual Foundation & Asset Quality Benchmark

November 8, 2026. Base `main` at `11e8a6f`, merged Pass 011 / PR #18. Branch `codex/v0.2-pass-012-visual-foundation`. Candidate `0.2.0-rc.7`. No merge, release or tag. Await user acceptance before Pass 013.

## Outcome and visual gate status

This pass establishes a real Blender → GLB → shared Three.js presentation workflow and original textured chromis/coral candidates. It does not declare the user's professional visual-quality bar satisfied. **The art benchmark remains pending user/macOS review**, with procedural regularity and wider-environment limitations described below. The normal aquarium stays playable and retains its original presentation; the comparison/showcase is opt-in.

The original art lacks deliberate surface hierarchy, fine material response and organic detail. Increasing polygon counts alone would not solve this. The [specific audit](VISUAL_QUALITY_AUDIT.md) covers fish construction, sharing, articulation, vegetation/coral, missing UV/map workflow, lighting and the Pass 011 baseline. [Art direction](ART_DIRECTION.md) defines the desired standard and explicitly contains no falsely accepted example.

## Authored assets and production method

Blender **4.3.2** is installed, launched and used for authoring, mesh fusion, shape keys, preview animation and glTF export. These assets are not the old procedural models rewrapped as GLB. Editable packed-image `.blend` files, original Python authoring/map sources and an independent GLB/PNG inspector are committed. No photographed texture pixels, scan, downloaded model or copyrighted game asset is embedded. Original assets/source maps are CC0-1.0 with no attribution requirement; reference-only anatomy/morphology links appear in the audit. See [full provenance](ASSET_MANIFEST.md) and [reproducible pipeline](ASSET_PIPELINE.md).

The chromis has an authored forehead/body/peduncle profile, a forked caudal fin, distinct curved ray-detailed dorsal/anal/pelvic/pectoral membranes, modest dimensional eyes/iris/pupil, mouth fold, operculum and lateral-line details. One continuous rear bend field drives the skin and median fins through `Stroke_Left`/`Stroke_Right` morphs. Paired fins retain their own pivots. A `SwimPreview` clip is exported for interchange. Runtime preserves the accepted 30 Hz simulation, interpolated roots, turning/banking, phase/effort, gliding and fin activity; there is no new locomotion model or whole-body-rotation shortcut. Twenty instances share one asset family, with existing per-fish scale and modest tint variation. No species count, school/home tuning or diver reaction is changed.

The Acropora-inspired colony has an asymmetric scaffold, secondary/tertiary growth, fused major junctions, a basal tissue mat, tapered tips and flared radial/axial corallites with recessed centers. Fine growth retains authored topology to avoid voxel-remeshing it away while leaving disconnected cups. Runtime convex branch components are rebuilt from decoded point sets, independent of DCC winding/cap triangulation, and replace only this colony's original hulls in the showcase. They are restored in original order/array identity on comparison and disposal. Fine calyx surface detail remains passable. The original support rock remains the attachment surface; no whole-colony blocking box is introduced.

All seven relevant maps are **512×512**: fish base/normal/roughness-metal/fin RGBA, and coral base/normal/roughness-metal. Skin uses restrained relief rather than metallic paint; fish metalness is zero. Membranes use single-pass alpha blending with depth writes off. Packed source maps are named `orm`, but only roughness/metal links are exported; no whole-model baked AO claim is made. Models contain their PNGs and need no external runtime URL. Materials/normals/UVs/transforms/morphs/clips resolve through GLTFLoader.

| Asset    |        GLB size | Visible triangles | Hidden collision triangles | Materials / embedded maps |
| -------- | --------------: | ----------------: | -------------------------: | ------------------------: |
| chromis  | 1,121,864 bytes |            12,686 |                          0 |                     5 / 4 |
| acropora | 3,454,388 bytes |            82,416 |                      5,666 |                     2 / 3 |

The chromis has eight render primitives, five materials and four map images. The coral has two visible primitives sharing one tissue material plus 100 hidden collision point-set meshes and one hidden collision material. Visible tissue is 82,416 triangles; hidden geometry is not submitted for drawing. Runtime hulls use 100 components, replacing five original colony components, for **234 showcase hulls**. The normal aquarium remains at 139.

The maps/model geometry are a benchmark budget, not a target to replicate hundreds of times. No multi-level LOD framework is added without target-hardware evidence. The full 20-fish high-detail cost is measured below; a later accepted production conversion should consider a consistent lower-detail school variant if hardware profiling justifies it.

## Loader and integration architecture

`AssetRegistry` restricts IDs to bundled paths and declares expected nodes, scale and rig contracts. `AssetLoader` coalesces duplicate in-flight loads, publishes loading/ready/error status, validates decoded scenes and hands out lightweight hierarchy/skeleton leases sharing geometry/material/maps. Unique decoded resources and ImageBitmaps are owned by the cache. Disposal retires entries; live leases delay destruction until the last release. Failed loads are not cached as success and can be retried. Missing models/required decoded maps trigger a logged error and a visible, playable procedural fallback rather than an empty scene.

The optional skeleton path uses `SkeletonUtils.clone`; the chromis uses morph animation and independent fin nodes. Tests verify independent morph/bone state while retaining shared heavy resources. `AuthoredSchool` creates eight instanced primitives for 20 chromis, using native per-instance morph textures. It refreshes animated bounds, reuses instance buffers and does not regenerate geometry or textures per frame.

The normal application gains only a one-time optional world/state configuration callback, an owned presentation lifecycle and a scoped structural-collider replacement method. Without a presentation these hooks do no scene/asset work. No fish/player/audio/settings source logic is retuned. Presentation disposal precedes aquarium disposal. `benchmark.html` is a separate dev entry emitted only by explicit `build:benchmark`; it has a labelled loading/comparison panel and the normal Enter/escape/WASD controls. Normal `build` does not emit that page or import the GLTF/showcase modules. Local assets remain bundled for offline use.

## Lighting and composition

The showcase retains ACES/sRGB and blue-green exponential fog, reduces hemisphere intensity **2.6 → 0.95**, uses a warm directional key **3.5**, cool fill **0.55**, and exposure **1.13** rather than 1.35. A focused **1024² PCF shadow** adds coral/nearby-rock contact and self-shadow cues. It is a limited presentation study, not the future whole-aquarium lighting overhaul. No full-scene postprocessing is added. Comparison restores original intensities/direction/exposure and disables the shadow pass.

Captures retain existing sand, support rock, some marine vegetation, background fish and water depth. Controlled animal portraits use a known existing fish ID at a disclosed presentation pose; the before and after use exactly the same position/camera. This pose is restored before the locomotion sequence. Wider layouts are intentionally not filled with more objects. Surrounding rocks, the other species, ornaments and vegetation remain Pass 011 and can still look like placeholders. That mismatch is a visible limitation, not hidden behind a claim that the whole reef is upgraded.

## Matched visual evidence

| View              | Pass 011 assets / original light                                | Authored assets / original light                                          | Authored assets / showcase light                              |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| chromis-close     | [before](screenshots/v0.2-pass012/chromis-close-before.png)     | [assets-only](screenshots/v0.2-pass012/chromis-close-assets-only.png)     | [after](screenshots/v0.2-pass012/chromis-close-after.png)     |
| chromis-side      | [before](screenshots/v0.2-pass012/chromis-side-before.png)      | [assets-only](screenshots/v0.2-pass012/chromis-side-assets-only.png)      | [after](screenshots/v0.2-pass012/chromis-side-after.png)      |
| coral-close       | [before](screenshots/v0.2-pass012/coral-close-before.png)       | [assets-only](screenshots/v0.2-pass012/coral-close-assets-only.png)       | [after](screenshots/v0.2-pass012/coral-close-after.png)       |
| reef-composition  | [before](screenshots/v0.2-pass012/reef-composition-before.png)  | [assets-only](screenshots/v0.2-pass012/reef-composition-assets-only.png)  | [after](screenshots/v0.2-pass012/reef-composition-after.png)  |
| swimming-distance | [before](screenshots/v0.2-pass012/swimming-distance-before.png) | [assets-only](screenshots/v0.2-pass012/swimming-distance-assets-only.png) | [after](screenshots/v0.2-pass012/swimming-distance-after.png) |
| full-aquarium     | [before](screenshots/v0.2-pass012/full-aquarium-before.png)     | [assets-only](screenshots/v0.2-pass012/full-aquarium-assets-only.png)     | [after](screenshots/v0.2-pass012/full-aquarium-after.png)     |

[Swimming still](screenshots/v0.2-pass012/chromis-swimming.png). The marked development panel is visible in captures; it is excluded from the normal game.

The `assets-only` images retain the original lighting, separating model/material changes from the final light study. Fixed camera coordinates and draw/triangle counts are retained in [the raw report](benchmarks/v0.2-pass012/visual.json). Portraits are controlled visual fixtures; they are not claims about natural home-region behavior. First-person camera volumes are checked against real collision. The [swimming clip](screenshots/v0.2-pass012/swimming.webm) follows an actual simulated chromis with fixed-step body/fin morphs and turning. Its 80 frames represent 1/30-second simulation increments, encoded at 30 FPS; software rendering throughput is not claimed as hardware frame rate.

## Measurements and budgets

At **1100×750 / DPR 1**, with identical camera/pose per comparison:

| Controlled isolated submission |        Old |         New |
| ------------------------------ | ---------: | ----------: |
| school: draws / triangles      | 6 / 18,120 | 8 / 253,720 |
| coral: draws / triangles       |  2 / 2,398 |  2 / 82,416 |

| Camera        | Before draws / triangles | Assets-only draws / triangles | With showcase light/shadows draws / triangles |
| ------------- | -----------------------: | ----------------------------: | --------------------------------------------: |
| chromis-close |            105 / 205,288 |                 107 / 440,888 |                                 118 / 704,548 |
| coral-close   |            164 / 230,736 |                 166 / 546,354 |                                 177 / 810,014 |
| full-aquarium |            209 / 258,068 |                 211 / 493,668 |                                 222 / 757,328 |

The full-view visible primary submission rises from 258,068 to 493,668 triangles; enabling the focused shadow study increases total submitted work to 757,328 triangles. Shadow passes are included in those counters. This is a substantial cost and a reason to keep the benchmark opt-in until target-device profiling, not a claim that all content should use this density. The modest draw increase preserves continuous skin animation rather than sacrificing it to an old rigid rig.

The 20-fish authored family owns **510,388 geometry typed-array bytes**, 5 material objects and 4 map textures; estimated RGBA8+mips map storage is **5.59 MB**. The colony including hidden source collision geometry owns **2,680,236 geometry typed-array bytes**, 2 material objects and 3 map textures; estimated RGBA8+mips map storage is **4.19 MB**.

The two first model requests are coalesced to one each. Measured page-to-ready is **6,532 ms**, including initial application work and local decode. The complete school pose/morph/bounds update is **0.0665 ms mean / 0.0600 median / 0.0950 p95 / 0.1700 p99** over 160 batches of twenty updates. These are CPU diagnostics excluding rendering.

The twelve-sample software render/finish timing is **132.74 / 6.90 / 1,524.20 / 1,524.20 ms** mean/median/p95/p99, including a large submission outlier after switching rendering modes. Eleven rAF intervals are **1,469.65 / 1,500 / 1,599.90 / 1,599.90 ms**. Such small samples, shader/driver work and browser scheduling do not establish stable percentiles or hardware GPU cost. Use a longer warmed hardware capture before accepting a production budget.

The before views use the original asset presentation in the same warmed application, after both GLBs are cached; GPU allocation counters in those comparisons are not a cold original-only memory baseline. Unique decoded asset geometry/maps are measured separately. Geometry values count typed arrays and indices, not driver overhead. Texture values estimate RGBA8 plus mips, not actual VRAM; morph textures and shadow targets are additional allocations. Load time is page-to-ready including application construction/local fetch/decode, not isolated network latency or a promise about every browser.

Pass 011's historical normal overview was **210 draws / 258,148 triangles**, with 178 geometries / 42 materials and 139 hulls; JS **730.86 kB / 195.90 kB gzip**. Its material limitations are the reference being challenged, not a visual target. The normal aquarium still uses the same roster and geometry. Build results and the new whole-scene costs are recorded below. The cloud uses Chromium/SwiftShader, so render/finish submission and rAF intervals are diagnostics only. Hardware GPU cost and a 16.7 ms frame target require MacBook Air profiling. No smooth-hardware-FPS assertion is made.

| Build                                       | JavaScript |      gzip | Result                                 |
| ------------------------------------------- | ---------: | --------: | -------------------------------------- |
| Normal production entry                     |  731.35 kB | 196.02 kB | Pass; 0.49 / 0.12 kB above Pass 011    |
| Explicit benchmark shared application chunk |  761.60 kB | 203.51 kB | Pass                                   |
| Explicit benchmark entry chunk              |   57.28 kB |  17.59 kB | Pass; plus a 0.08 kB normal-entry stub |

Both builds retain the existing >500 kB chunk advisory. CSS remains 6.33 / 2.20 kB. Normal `dist/benchmark.html` is absent; the normal application imports no loader/showcase entry and requests no GLB. The explicit benchmark production build loads both locally bundled GLBs/embedded maps successfully, preserves 40 fish, runs real controls/comparison and returns GPU counts to zero on disposal. No external runtime asset service is required.

## Automated and browser validation

| Check                                                  | Result                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm run build`                                        | Pass                                                                                                |
| `npm run build:benchmark`                              | Pass                                                                                                |
| `npm run typecheck`                                    | Pass                                                                                                |
| `npm run lint`                                         | Pass; ESLint + Prettier                                                                             |
| `npm run test -- --maxWorkers=2 --no-file-parallelism` | **291 tests / 30 files pass**, 69.55 seconds; serial file scheduling, unchanged assertions/timeouts |
| `npm run test:stress`                                  | **4 checks pass**, 51.93 seconds                                                                    |
| `python3 tools/art/inspect_assets.py`                  | Pass; actual GLB/accessors/images/convex point sets                                                 |
| `git diff --check`                                     | Pass                                                                                                |

The requested two-worker command was also executed; a repeat hit three existing five-second timeouts. The complete retained serial-file run includes all 291 tests with the same worker cap and timeouts. Source, tests and assertions are not excluded to obtain a pass.

Coverage includes cached coalescing, retry, invalid assets, pending-owner disposal, live-lease cleanup, shared textures, independent optional skeletons/morphs, real GLB hashes/containers/embedded images, required node/UV/normal/scale/rig contracts, morph animation, pause/reduced motion, finite matrices, exact-once instance/morph-buffer disposal and exact collider-array restoration. The independent Python inspector reads actual binary accessors and decodes the PNGs. Browser GLTFLoader verifies real model/material/image parsing and WebGL shaders rather than a mocked loader.

The [showcase report](benchmarks/v0.2-pass012/visual.json) passes with zero console errors/warnings, **40 fish / 20 authored chromis**, native W swimming, safe camera volumes, strict convex-plane containment (maximum violation 3.55×10⁻¹⁵), pause equality, finite reduced-motion poses, a missing-model procedural fallback and two complete reload/dispose cycles. The simulated showcase safety run records **zero fish corrections**. All 80 locomotion frames are retained in the encoded clip. Renderer cleanup is **177 geometries / 14 textures → 0 / 0**, with audio closed. Temporary hull geometry is never uploaded; decoded collision input remains cache-owned until disposal.

Both [normal production](benchmarks/v0.2-pass012/production.json) and [explicit benchmark production](benchmarks/v0.2-pass012/production-benchmark.json) smoke tests pass. [Normal aquarium after integration](screenshots/v0.2-pass012/normal-normal-aquarium.png), [normal production swimming](screenshots/v0.2-pass012/production-swimming.png), [built showcase](screenshots/v0.2-pass012/production-benchmark-benchmark-production.png).

The [normal 40/60-fish profile](benchmarks/v0.2-pass012/normal.json) passes steady/dense CPU scenarios, temporary 60-fish drawing and two renderer/audio recreations with zero errors/warnings. The ordinary inventory is still **178 geometries / 42 materials / 139 hulls**, the exact six-species 40-fish roster, and **19 audio nodes / three buffers / three loops**.

The [native controls/audio lifecycle](benchmarks/v0.2-pass012/lifecycle.json) passes actual Enter/pointer lock, camera-directed depth, held-input clearing, pause/resume, mute/volume, settings persistence, controlled visibility and unsupported-audio fallback. Thirty simulated minutes complete **54,000 fixed steps** with **zero corrections**, one context, stable 19 persistent nodes, three buffers and three loops. Forced-GC heap observations are 0 min: 15,956,548 bytes, 5 min: 16,417,836 bytes, 15 min: 16,598,188 bytes, 30 min: 16,651,796 bytes. These are accelerated state/ownership observations rather than real-time GPU/listening or universal leak proofs. The [stress report](benchmarks/v0.2-pass012/stress.json) retains all 5/15/30-minute ordinary-ecosystem checks and exact 30/60/120 FPS simulation equality.

During development, browser assertions caught an obstructing development panel, an early entry-handler/input race and invalid DCC collision faces. The panel layout/input acknowledgement and exact runtime hull rebuild were corrected; the retained report was generated afterward without relaxing the strict camera/convex/containment assertions.

The source fish/vegetation/anchored/ornament/audio/swimming/settings regressions remain intact. The five/fifteen/thirty-minute stress scenarios retain fixed-step determinism and full containment/activity/ownership checks. A repeated two-worker run encountered unchanged five-second timeouts in three pre-existing CPU-heavy tests; the complete suite is rerun with serial file execution and the same worker cap/assertions/timeouts. No test is skipped, excluded or weakened. Generated `dist-benchmark` is excluded from source lint/format exactly like ordinary `dist`; this does not exclude source/tests.

## Rendered quality assessment — candidate, not accepted

| Gate                                    | Evidence / assessment                                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromis silhouette and major fins       | Recognizable compressed body, forked tail and distinct median/paired fins in matched side/oblique views; human proportion approval pending.                                                                |
| Eye/gill/mouth and surface detail       | Clearly more inspection detail than the original smooth asset. Scale relief was reduced after an early overly embossed render. Final material softness and gill-line subtlety remain review items.         |
| Flexible natural animation              | Continuous skin/median morphs and independent pectorals are visible in the simulated locomotion sequence; subjective naturalness is not certified by a finite-matrix test.                                 |
| Coral branching and fine surface        | Fused major junctions, more growth decisions and recessed cups are visible. The scaffold/tip/corallite regularity still reads as scripted in places; professional organic polish is not declared complete. |
| Attachment and reusable ownership       | Base is embedded at the existing reef support; one colony and one shared 20-fish family are used. Accurate hull extraction and lifecycle checks pass.                                                      |
| Underwater depth and coherent materials | Quieter fill and contact shadows increase form separation, but surrounding old rock/plate assets remain visibly coarse. Whole-environment quality is incomplete.                                           |
| Efficient production target             | Costs are measured and materially higher. No target-Mac FPS or final LOD decision is claimed.                                                                                                              |

## Remaining limitations and quality decision

- **Visual gates remain unaccepted.** Technical validity does not prove professional high-fidelity art. The candidates are substantially more detailed but retain scripted topology/paint decisions. Coral branching/tip transitions/corallite regularity and fish material/fin softness need direct human art review, with further Blender sculpt/paint work where the evidence is insufficient.
- The rest of the aquarium remains the rejected Pass 011 art. This isolated study does not make smooth convex boulders or older coral/ornaments final-quality assets.
- Tint and scale variations are modest; this pass does not provide a full per-individual painted-pattern library. The natural species remains blue-green rather than twenty different colorways.
- Transparent membranes remain sorted per primitive batch, with possible overlap limitations. No blanket guarantee covers every school/camera configuration.
- Fine corallites are visual tissue detail. Branch hulls are a simplified convex union and are validated as convex; this is not per-triangle soft-tissue collision or a biological skeleton model.
- Cloud software render intervals, small timing samples and accelerated soaks cannot establish target-device performance, Safari compatibility, real-time memory stability or subjective comfort. Target hardware may require a lower-detail shared school mesh and better texture compression.
- No release/tag/automatic merge. Do not begin Pass 013 until the user accepts a convincing asset/material/lighting standard and measured hardware budget. If the current coral still reads as constructed rods or the fish as patterned plastic to the reviewer, the visual benchmark is not passed; keep the pipeline and evidence, then refine the art rather than relabelling it final.

## Manual macOS acceptance — pending

Run both normal and explicit benchmark production builds on the target MacBook Air. Record model, OS/browser versions, viewport/DPR, power mode and mean/median/p95/p99 frame times, load behavior, memory trend and 15–30-minute comfort. Compare matched views with original and assets-only modes. No item below is checked by automated file/geometry tests.

### Fish

- [ ] New chromis looks substantially better than before.
- [ ] Fish silhouette and proportions are convincing.
- [ ] Fins are detailed and natural.
- [ ] Eyes and surface markings are recognizable.
- [ ] Fish looks good at close range.
- [ ] Swimming animation feels fluid.
- [ ] Fish integrates naturally with the school.

### Coral

- [ ] Coral geometry is detailed and organic.
- [ ] Surface texture is convincing.
- [ ] Coral has appropriate color and roughness.
- [ ] Coral looks attached to the reef.
- [ ] Close-up coral quality is substantially improved.

### Lighting and atmosphere

- [ ] Water lighting feels more natural.
- [ ] The scene has a stronger sense of depth.
- [ ] Objects no longer look uniformly flat.
- [ ] Materials respond convincingly to underwater light.
- [ ] The aquarium feels more immersive.

### Performance and compatibility

- [ ] Asset loading is reliable.
- [ ] No missing models or textures.
- [ ] No severe transparency glitches.
- [ ] Frame rate remains comfortable.
- [ ] Existing swimming and fish behavior remain unchanged.
- [ ] Audio continues working.
- [ ] The normal aquarium remains playable.

Also review the detailed fish/coral/environment quality gates from the brief: every major fin, eye/gill detail, natural scale relief, flexible animation, asymmetric growth, convincing calyces/roughness, reusable assets, coherent palette, foreground/midground/background, no severe transparency and relaxing close-range exploration. User acceptance, not successful GLB parsing, decides whether these candidates become the standard for Pass 013.
