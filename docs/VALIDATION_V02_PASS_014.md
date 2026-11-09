# v0.2 Pass 014 — Reef, Coral & Background Environment Overhaul

Validation date: November 9, 2026. Candidate `0.2.0-rc.8` for user review. No merge, release or next pass is authorized by this report. All browser evidence comes from Linux Chromium with SwiftShader software rendering. It shows correctness, structure and relative scene cost, not MacBook Air frame rate or comfort.

## 1. Baseline environmental audit (Pass 013 `main`)

| Item                 | Baseline                                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structural reef rock | 34 placements of six convex templates (icosahedron detail 2, 172–180 triangles each), four flat tint materials, vertex-colour banding. 55 decorative pebbles as 55 separate meshes (80 triangles each).                                                                             |
| Coral                | 9 `HardscapeSystem` formations (6 living stony colonies on rock, 3 sand ornaments): branching (5 capsule hulls), rounded (4 rock-template lobes) and plate (stem + 3 disc hulls). 366–704 triangles each, plus instanced sphere corallites. 39 exact hulls.                         |
| Vegetation           | 65 clumps/colonies over 18 templates (16 turtle grass, 12 Caulerpa, 12 red algae, 10 Halimeda, 8 soft coral, 7 sea fans). 8 meadows, 1,152 blades.                                                                                                                                  |
| Sand                 | 90×70-segment plane (6,461 vertices), ±6 cm relief, vertex colour only, no texture.                                                                                                                                                                                                 |
| Background           | Glass panels, fog and light beams only; no far-bank structure.                                                                                                                                                                                                                      |
| Collision            | 139 procedural hulls (34 rock + 39 coral + 66 ornament); 216 in the shipped Pass 013 world (authored ornament hulls).                                                                                                                                                               |
| Anchors / homes      | Spawn (0, 4.6, 9). Host anemone on the top of Rock 11 (centre ≈ −7.24, 3.44, 1.09). Moray in the log interior. Seahorse on sea-fan placement 58. Frogfish on the shipwreck. Nudibranchs on the arch (3), statue and shipwreck. Six ornament anchors; 40 fish; 7 hidden discoveries. |
| Lighting (unchanged) | Hemisphere 0xc7f2e0 / 0x546b56 at 2.6; sun 0xfff1cf 3.2 from (−7, 18, 7); fill 0x75ced0 0.7 from (10, 8, −12); FogExp2 0x225d73 0.026; ACES exposure 1.35; DPR capped at 1.75.                                                                                                      |
| Scene CPU inventory  | 268 meshes (67 instanced), 275,566 resident triangles, 175 geometries / 39 materials (procedural only).                                                                                                                                                                             |

**Remaining weaknesses** (visible in every "before" image):

- Rocks are smooth teal-green convex blobs with faceted shading, no texture, cavities or geological structure, and identical-looking banks.
- Corals are primitive stick bouquets, sphere clusters and stacked discs.
- Vegetation reads as uniform green ribbons and sparse sticks.
- The sand is nearly white and featureless.
- The far tank is empty blue.
- Separate objects meet the sand with hard seams.

## 2. New authored rock assets

Six authored silhouettes cover four archetypes: porous limestone (×2), organic outcrop, layered sedimentary (×2) and crevice/overhang. Each is carved inward from the exact accepted hull of the template it replaces:

- **Porous**: solution holes and erosion embayments.
- **Outcrop**: lobes with recesses, ledges and undercuts.
- **Layered**: strata recesses, bedding seams, overhanging lips and planar fracture faces.
- **Crevice/overhang**: two clefts and an undercut.

Upward faces keep a shallow tolerance so attached life stays seated. Each rock has three levels: 20,480 triangles below 7 units, 5,120 below 16 units and 1,280 beyond. Materials are triplanar world-space limestone maps (pores, cavities, strata, coralline and algal film) with per-vertex mineral patches (beige / cool grey / green-grey), darker recesses, lighter fresh fractures and a sand-dusted base. Four tint variants plus the accepted per-placement scale and rotation avoid obvious repetition. The 55 pebbles reuse their transforms as three instanced carved templates (3 draws instead of 55). See the rock-close, crevice and wide views below.

## 3. Coral-family improvements

All nine colonies keep their accepted structural parts and collision; authored geometry follows those parts:

- **Branching (3)**: primaries along the structural capsules, fused junction collars, 7–10 irregular secondary branches each with tertiary forks, lighter axial tips and an encrusting basal plate. Corallite cups come from a normal map.
- **Massive (3)**: lobes carved with maze-like valleys (brain coral ×2) or knobbly lobules (boulder ×1), with tucked undersides and valley/ridge colouring.
- **Plate (3)**: organic trunk and struts carrying tiered plates with scalloped, upturned and ridged rims, growth bands, shaded undersides and short rim branchlets.

Colours are muted peach, lavender, sandy yellow, cream, warm grey and soft green. Rendering uses roughness 0.7–0.9 with no metalness and no emissive.

## 4. Soft coral and sea fan upgrades

- **Finger leather coral (3 templates)**: lobed trunk, irregular fleshy fingers (three growth levels) and polyp-studded rounded tips. Soft-tissue maps add retracted polyp pores.
- **Gorgonians (3)**: holdfast and stout stem, then a gently cupped, six-level branching network joined by anastomoses (purple, orange and mauve). The seahorse grip point on the stem is unchanged.

Motion uses the existing GPU current deformation: the root stays fixed, flex grows toward the tips, each stem gets its own phase (authored phase channel) and pause and reduced motion behave as before. There are no per-object animations.

## 5. Marine vegetation improvements

- **Turtle grass**: 12–15 blades per clump with droop, twist, pale bases and yellowing tips.
- **Caulerpa**: stolons with pinnate fronds.
- **Halimeda**: branching kidney-segment chains, greener at the tips.
- **Red algae**: four-level flattened dichotomous forks.
- **Meadows**: three tapered, curved, twisted blade templates, plus 824 short centre-weighted understory blades with ragged gaps.

All 65 placements are unchanged. Every template is fitted, height band by height band, inside the envelope its placement was validated against.

## 6. Sand and rubble

- **Substrate**: 216×168 segments (36,673 vertices) with ripples, shallow depressions and sand banked against structures, always 0–7 cm above the unchanged `substrateHeight` reference. Contact shading darkens sand near structures, and tileable grain/grit/micro-ripple PBR maps add detail.
- **Debris**: 326 debris pieces (cockle, cowrie and turret shells; two coral-rubble types), 6–11 around each rock base and sparse elsewhere. Fewer than 8% fall in the central channel, and none are inside solids or within 1.5 of spawn. Real-world scale is 1.5–4 cm against roughly 8 cm fish (world 0.08–0.25 units).
- **Structure**: no change to floor collision or swimming limits.

## 7. Background composition

68 flattened low-detail reef rocks (1,280 triangles each, instanced) are layered in two rows against the rear and side glass. Each stays within 0.2 units of its wall, always outside the swimming clearance (0.65), and nowhere within 2.6 units of the wall-mounted filter. The rows are cooler and lighter than the hero rocks, and the existing fog attenuates them. The central channel and open water are untouched, and nothing is placed outside the tank. In every 5/15/30-minute stress scenario, fish stayed at least 0.54 units from the glass (the relief is 0.2 deep).

## 8. Habitat and creature-anchor integration

No anchor, home, interest or placement moved; all are computed from the accepted procedural world, as before:

- **Rock-top seats**: the anemone, 6 living colonies and every rock-top soft coral or fan are ray-cast onto the visible authored surface of their support rock. None float more than 6 cm above it.
- **Ornament-based homes**: discovery homes (frogfish and nudibranch perches on ornaments, the seahorse on the sea-fan stem) and the moray log shelter are unaffected. The 30-minute lifecycle shows the same distances (seahorse 0.001, frogfish 0.067, nudibranch surface 0.006).
- **Pass 013 libraries**: the chest, bubbles, moray states and anemone current pass the ornament, anchored-life and discovery harnesses.

## 9. Collision and navigation

Each reef rock's single convex hull becomes 6–10 authored convex parts (253 in total). These are k-means clusters of the carved surface, reduced to support points. Every part vertex is inside the accepted hull (verified in Python and TypeScript), so open space only grows:

- **Safety**: existing safe positions remain safe, and no invisible wall appears in the channel (checked every 0.5 units at four heights).
- **Fidelity**: visible rock extends past its parts by under 12 cm (half a player radius) where reduced support points cut texture-scale relief.
- **Corals**: collision is unchanged.

Production composition: 435 hulls (Pass 013 ornaments + Pass 014 reef). `setEnabled` restores the shared collider array by identity.

Using the production swimming integrator, all seven discovery approaches were swum in both the reef-only and full production compositions. So were the arch pass-through, the wreck circuit, spawn→channel, and the anemone and moray viewing approaches. The final error was 0.075 units or less.

**Pre-existing, not introduced here:** on `main`, `validation/integration.mjs` fails `Unsafe route frogfish/3`. The conservative 0.65-unit sweep of the frogfish's last approach leg grazes a Pass 013 authored wreck hull. The diver still physically arrives (error 0.074), and the same holds with the reef. It is recorded as a follow-up rather than changed in this pass.

## 10. Before/after screenshots

Each pair was captured in one paused session with an identical camera. "Before" is the shipped Pass 013 world (authored ornaments and creatures, procedural reef); "after" adds the Pass 014 reef. Captured by `validation/reef-overhaul.mjs`.

| View                         | Before (Pass 013)                                         | After (Pass 014)                                         |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Wide aquarium                | ![](screenshots/v0.2-pass014/wide-before.png)             | ![](screenshots/v0.2-pass014/wide-after.png)             |
| Central channel (spawn)      | ![](screenshots/v0.2-pass014/channel-before.png)          | ![](screenshots/v0.2-pass014/channel-after.png)          |
| Large reef rock              | ![](screenshots/v0.2-pass014/rock-close-before.png)       | ![](screenshots/v0.2-pass014/rock-close-after.png)       |
| Crevice / overhang (Rock 23) | ![](screenshots/v0.2-pass014/crevice-before.png)          | ![](screenshots/v0.2-pass014/crevice-after.png)          |
| Branching coral              | ![](screenshots/v0.2-pass014/branching-coral-before.png)  | ![](screenshots/v0.2-pass014/branching-coral-after.png)  |
| Rounded (brain) coral        | ![](screenshots/v0.2-pass014/rounded-coral-before.png)    | ![](screenshots/v0.2-pass014/rounded-coral-after.png)    |
| Plate coral                  | ![](screenshots/v0.2-pass014/plate-coral-before.png)      | ![](screenshots/v0.2-pass014/plate-coral-after.png)      |
| Soft coral                   | ![](screenshots/v0.2-pass014/soft-coral-before.png)       | ![](screenshots/v0.2-pass014/soft-coral-after.png)       |
| Sea fan                      | ![](screenshots/v0.2-pass014/sea-fan-before.png)          | ![](screenshots/v0.2-pass014/sea-fan-after.png)          |
| Seagrass meadow              | ![](screenshots/v0.2-pass014/seagrass-before.png)         | ![](screenshots/v0.2-pass014/seagrass-after.png)         |
| Caulerpa / macroalgae        | ![](screenshots/v0.2-pass014/macroalgae-before.png)       | ![](screenshots/v0.2-pass014/macroalgae-after.png)       |
| Sand and rubble              | ![](screenshots/v0.2-pass014/sand-rubble-before.png)      | ![](screenshots/v0.2-pass014/sand-rubble-after.png)      |
| Shipwreck with reef          | ![](screenshots/v0.2-pass014/shipwreck-reef-before.png)   | ![](screenshots/v0.2-pass014/shipwreck-reef-after.png)   |
| Stone arch                   | ![](screenshots/v0.2-pass014/arch-growth-before.png)      | ![](screenshots/v0.2-pass014/arch-growth-after.png)      |
| Seahorse habitat             | ![](screenshots/v0.2-pass014/seahorse-habitat-before.png) | ![](screenshots/v0.2-pass014/seahorse-habitat-after.png) |
| Anemone habitat              | ![](screenshots/v0.2-pass014/anemone-habitat-before.png)  | ![](screenshots/v0.2-pass014/anemone-habitat-after.png)  |

**Visual gate (my assessment, pending yours):**

- Every view shows clearly different rock structure and material, natural sand, coral morphology, vegetation and background depth. Nothing looks like the previous primitive version.
- **Rock masses still follow the accepted convex footprints.** They are carved, stratified and fractured, but the overall boulder outline and the banks' arrangement are unchanged, because placements, homes and routes were deliberately preserved.
- Rocks lean olive-green under the existing teal lighting; the lighting pass may want to neutralise this.
- Sea fans seen edge-on read as thin lines.
- The "arch with attached marine growth" view shows the reef around the arch; the arch's own growth is the Pass 013 asset and was not re-authored.

## 11. Draw calls and triangles (identical cameras, SwiftShader)

| View             | Pass 013 draws / triangles | Pass 014 draws / triangles |
| ---------------- | -------------------------: | -------------------------: |
| wide             |              197 / 469,074 |              175 / 932,072 |
| channel          |              163 / 452,078 |              148 / 892,427 |
| rock-close       |               92 / 252,626 |              100 / 729,734 |
| crevice          |              107 / 383,288 |              113 / 862,635 |
| branching-coral  |               56 / 176,222 |               71 / 553,933 |
| rounded-coral    |               97 / 292,544 |              101 / 697,156 |
| plate-coral      |               88 / 250,068 |               98 / 766,004 |
| soft-coral       |               99 / 271,978 |              105 / 763,760 |
| sea-fan          |               95 / 292,496 |               99 / 697,108 |
| seagrass         |              125 / 384,354 |              120 / 904,228 |
| macroalgae       |               94 / 266,576 |               99 / 734,138 |
| sand-rubble      |               85 / 224,332 |               93 / 712,978 |
| shipwreck-reef   |              137 / 415,892 |              131 / 824,431 |
| arch-growth      |               52 / 247,102 |               67 / 624,330 |
| seahorse-habitat |               55 / 223,584 |               71 / 557,323 |
| anemone-habitat  |              118 / 380,522 |              117 / 900,821 |

Draw calls stay flat or fall, thanks to instancing and LODs. Submitted triangles roughly double (0.55–0.93 M). In the wide view (triangles by family), the largest contributors are instanced vegetation (204k), Pass 013 anchored life (119k), backdrop rocks (87k), hero rocks at mixed LODs (65k), meadows plus understory (79k), massive and plate corals (20k and 18k each) and debris (about 60k). Instanced batches are whole-batch frustum culled. If target hardware needs it, the first trims would be soft coral and fan templates, Halimeda/red-algae density, and backdrop count.

Diagnostic CPU `render()` submission time over all views (software renderer, warm): median 1.35 → 1.5 ms, p95 4.0 → 6.7 ms. This is not hardware frame time.

## 12. Texture and memory costs

- **GLB**: `reef-environment.glb` is 19.5 MB: 6.9 MB of 18 embedded 512² PNGs plus 12.4 MB of geometry accessors. Pass 013 libraries were 8.8 MB combined.
- **Load**: all four libraries were ready 3.2 s after navigation (dev server, localhost).
- **GPU textures**: 18 maps at 512² RGBA8 with mipmaps ≈ 24 MiB. The three sand maps are cloned for repeat wrapping (one extra upload set, ≈ 4 MiB).
- **GPU disposal**: after reef disposal the renderer returns to the Pass 013 counts (213 geometries / 27 textures). Full scene disposal reaches 0 / 0, including disposal while requests are pending.
- **CPU inventory**: 411 resident geometries / 73 materials (was 373 / 65). Hidden procedural originals remain resident for atomic comparison and fallback.
- **Heap**: forced-GC JS heap over the 30-minute lifecycle soak was 23.1 → 23.6 MB (Pass 013: 19.4 → 20.1 MB).
- **Builds**: production JS is 836.73 kB / 224.84 kB gzip, against Pass 013 `main` at 819.29 kB / 219.32 kB (+17.4 kB / +5.5 kB gzip for the reef runtime, triplanar shader and convex-hull import). `dist/` grows from 18 MB to 43 MB: the 19.5 MB GLB, plus source PNG maps under `public/assets/textures` copied alongside the GLBs. That copying is a pre-existing pattern and a pruning candidate.

Fixed-step simulation (CPU stress, Node, accelerated):

| Composition                         | Minutes / fish | Fish step p95 | Swimming + collision p95 | Corrections | Closest fish to glass |
| ----------------------------------- | -------------: | ------------: | -----------------------: | ----------: | --------------------: |
| Pass 013 shipped (216 hulls)        |         5 / 60 |       1.00 ms |                  0.15 ms |           0 |                  0.71 |
| Pass 013 shipped                    |        30 / 40 |       0.65 ms |                  0.13 ms |           0 |                  0.55 |
| **Pass 014 production (435 hulls)** |         5 / 60 |       1.46 ms |                  0.21 ms |           0 |                  0.77 |
| **Pass 014 production**             |        15 / 40 |       0.95 ms |                  0.25 ms |           0 |                  0.56 |
| **Pass 014 production**             |        30 / 40 |       0.98 ms |                  0.25 ms |           0 |                  0.56 |

Doubling the hull count raises steering and collision cost by about 50%; it stays well under 2 ms per step.

## 13. Automated test results

| Check                                                     | Result                                                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` / `npm run build:benchmark`               | Pass                                                                                                                                                        |
| `npm run typecheck` / `npm run lint` / `git diff --check` | Pass                                                                                                                                                        |
| `npm run test -- --maxWorkers=2 --no-file-parallelism`    | **318 tests / 33 files passed** (was 297 / 31). New: `reef-environment` (17), `reef-lifecycle` (3); one existing asset test now also covers the reef GLB    |
| `npm run test:stress`                                     | **10 passed**: the six existing scenarios unchanged, plus 5/15/30-minute Pass 014 production composition, plus render-schedule equivalence                  |
| `python3 tools/art/inspect_assets.py`                     | All six GLBs inspected. The reef library's rock levels and parts are verified inside the accepted hulls, and per-family budgets are emitted to the manifest |

The new tests cover:

- **Library**: required nodes; finite positions, normals, UVs and colours; LOD ordering; four archetypes; material sidedness; plant normalisation and phase channel; debris scale.
- **Rock collision**: rock levels and parts inside the accepted hulls; visible-to-collision alignment; no added volume; channel free of invisible walls.
- **Routes**: physical swims in the reef-only and full production compositions.
- **Attachment**: rock-top seats on the visible surface; vegetation inside its validated envelopes.
- **Layout**: deterministic debris outside solids; understory inside its meadows; backdrop depth and filter clearance; sand relief bounds and density; triplanar weights.
- **Lifecycle**: swap, toggle and restore with collider identity; idempotent disposal with exactly-once geometry release; load failure and early disposal leave the procedural reef untouched; the plant motion contract is derived from authored templates.

**Harness updates.** Exact-count assertions in the Pass 013 harnesses were updated to the new measured composition, never loosened: 435 hulls, 411 / 73 inventory, 4 GLB requests (6 in the benchmark), and 358 hulls when only the props library is missing.

One time limit was raised: Playwright's 30 s _action_ timeout is now 240 s (configurable via `COZY_ACTION_TIMEOUT`). In SwiftShader, the first frame containing the reef's shader variants takes 77–120 s to compile lazily on the software GPU thread; a warm frame takes 2–6 s. No assertion or measured budget changed.

Two runtime changes reduce that cold start. Triplanar and authored-plant materials share one program each, since their variants are uniforms. The scene is also precompiled behind the loading status: `compileAsync` where `KHR_parallel_shader_compile` exists, otherwise `compile`.

## 14. Browser evidence (Chromium / SwiftShader)

| Harness                                                 | Result                                                                                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reef-overhaul.mjs` (new)                               | Pass. 16 matched pairs, 4 deduplicated local GLB requests, no page or WebGL errors, collider identity restored, disposal back to Pass 013 GPU counts, reef-library fallback keeps 216 hulls and shows the notice |
| `geometry-overhaul.mjs` (Pass 013)                      | Pass. Ten pairs, animation/pause, 32,632 seahorse/frogfish samples clear, inventory 40 / 7 / 435, cleanup 0 / 0, pending-load cleanup 0 / 0, props-library fallback                                              |
| `ornaments.mjs`, `anchored-life.mjs`, `discoveries.mjs` | Pass with the reef enabled by default                                                                                                                                                                            |
| `lifecycle.mjs`                                         | Pass. Native pointer lock, camera-directed WASD, Escape and four pause/resume cycles, settings persistence, visibility, reduced motion and audio; a 30-minute accelerated soak at a stable 411 / 73 / 435        |
| `production.mjs` (`npm run preview`)                    | Pass. 4 GLBs return 200, real Enter/W/Escape/settings, no errors or warnings                                                                                                                                     |
| `visual-benchmark.mjs`, `asset-smoke.mjs`               | Pass (benchmark dev and benchmark production build)                                                                                                                                                              |
| `integration.mjs`                                       | **Fails on `main` already** (`Unsafe route frogfish/3`, see §9); not caused by this pass                                                                                                                         |

No shader compilation errors, WebGL errors, missing textures or console errors were observed. Captures and assertions found no z-fighting or transparency artefacts. Retained reports are in [benchmarks/v0.2-pass014](benchmarks/v0.2-pass014/).

## 15. Known limitations

- **Hardware performance is unmeasured.** Submitted triangles roughly double, and texture memory grows by about 28 MiB. MacBook Air FPS and comfort must be checked by you on the device. SwiftShader cannot establish them.
- **Layout is preserved by design.** Rock footprints, bank arrangement and coral positions are the accepted ones, so reef formations are richer individually but not re-composed into new connected ridges or larger overhangs. That would need new placements and new homes and routes, which was out of scope given the preservation requirements.
- **Collision approximation.** Rock collision approximates carved relief to within 12 cm. Corals keep their accepted structural parts; fine branches, plate rims and vegetation are passable.
- **Download size.** The 19.5 MB library has no Draco, meshopt or KTX2 compression. Original procedural geometry stays resident for fallback and comparison.
- **Sand.** Relief is visual and sits up to 7 cm above the habitat reference; roots and debris are slightly buried rather than floating.
- **Tooling version.** Blender 4.3.2 could not be downloaded in this container. The reef library was built with Blender 5.1.2's Python module; its `.blend` needs Blender 5.1+.
- **Lighting unchanged.** Rocks read somewhat olive under the current teal lighting.
- **Pre-existing harness failure.** `integration.mjs` fails on `main` (see §9).

## 16. Manual macOS acceptance checklist

### Reef rock

- [ ] Rocks no longer resemble smooth low-poly boulders.
- [ ] Rock silhouettes show believable natural variation.
- [ ] Reef surfaces have convincing texture and roughness.
- [ ] Crevices and overhangs feel organic.
- [ ] Rock clusters form cohesive reef structures.
- [ ] Reef formations do not block important swimming routes.

### Hard coral

- [ ] Branching coral looks organic and detailed.
- [ ] Rounded coral has convincing surface morphology.
- [ ] Plate coral looks natural and irregular.
- [ ] Coral colours and materials are believable.
- [ ] Coral appears attached to actual reef surfaces.
- [ ] Close-up coral detail matches the new art standard.

### Soft coral and marine vegetation

- [ ] Soft coral branches look natural.
- [ ] Sea fans have intricate branching detail.
- [ ] Seagrass meadows feel fuller and more organic.
- [ ] Different macroalgae types are recognizable.
- [ ] Plants and soft corals sway gently.
- [ ] No obvious repeated primitive geometry.

### Sand and background

- [ ] Sand has natural contour and texture.
- [ ] Small reef rubble looks appropriately scaled.
- [ ] Sand-to-rock transitions are more believable.
- [ ] Background reefs create a stronger sense of depth.
- [ ] The aquarium still clearly feels like a tank.
- [ ] The central swimming channel remains pleasantly open.

### Gameplay and integration

- [ ] Swimming and buoyancy feel unchanged.
- [ ] Player does not clip through major reef structures.
- [ ] Fish navigate correctly around updated formations.
- [ ] Existing ornaments remain visible and functional.
- [ ] Moray, seahorse and frogfish habitats remain valid.
- [ ] Nudibranchs remain attached to their surfaces.
- [ ] Anemone/clownfish behaviour remains correct.
- [ ] Performance remains comfortable on the MacBook Air.
- [ ] No visible rendering errors or major regressions.

## 17. Recommendations for Pass 015/016

- **Pass 015 (fish and background life).** Convert the remaining procedural fish to the accepted morph workflow. If reef massing should change, plan a deliberate re-composition (connected ridges, larger shaded overhangs) with new homes, routes and validation, rather than editing it piecemeal. Revalidate the frogfish approach leg against authored wreck hulls.
- **Pass 016 (lighting).** Neutralise the olive cast on limestone, add soft contact shadowing and caustics, and tune warm/cool contrast with the new materials as the reference. Re-measure with `reef-overhaul.mjs`.
- **Budgets (after MacBook Air profiling).** Consider KTX2/Basis textures, meshopt geometry, pruning duplicate source PNGs from `dist/`, an additional plant LOD and dropping resident procedural originals once fallback/comparison is no longer needed.
