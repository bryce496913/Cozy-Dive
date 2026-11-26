# Low-poly migration Pass 016 — validation

Base `f3c05f6`; branch `codex/low-poly-pass-016-pipeline`. Shared tools and inspection prototypes only. No shipped species, model library, environment, game renderer, save format, IDs or version changed. [Developer guide](PIPELINE.md).

## Commands and results

| Command                                                                                                    | Result                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format`                                                                                           | Completed repository formatter; subsequent focused formatting applied to new files.                                                                           |
| `npm run typecheck`                                                                                        | Passed on final helper/prototype changes.                                                                                                                     |
| `npx vitest run tests/low-poly-pipeline.test.ts`                                                           | 15 tests passed, 2.03 s.                                                                                                                                      |
| `npm run test`                                                                                             | 126 files / 1,247 tests passed in 415.01 s. The final focused run above covers the added deformation/input guards. Opt-in stress/world traversal was not run. |
| `npm run build`                                                                                            | Passed; Vite build 2.50 s. Existing >500 kB chunk warning.                                                                                                    |
| `npm run lint`                                                                                             | ESLint passed; repository-wide Prettier check completed as recorded in the retained command log.                                                              |
| `npm run dev -- --port 5180`                                                                               | Local Vite inspection server.                                                                                                                                 |
| `PLAYWRIGHT_MODULE=/tmp/cozy-browser/node_modules/playwright/index.mjs node validation/low-poly/smoke.mjs` | Passed Chromium/SwiftShader browser checks and four captures; zero console/page errors.                                                                       |

Focused coverage: finite positions/normals, valid indices and nonzero triangles, positive outward volume, closed/manifold consistently oriented coral junction, deterministic hull variation, rejected degenerate inputs, anatomical face colors/groups, mirrored and subdivided fins, root-preserving fin/tentacle poses, coincident facet vertices during deformation, pose bounds, triangle budgets, cache identity, one-time disposal, live leases during retirement, independent instance weights, reduced motion and repeated lifecycle. Existing instancing accepts the generated buffers; independent instanced animation remains a controller responsibility.

The browser run inspects all four views, pause/resume, OS reduced-motion changes, five release/recreate cycles and complete renderer disposal. It renders actual WebGL morph targets. This isolated inspection does not exercise pointer lock, gameplay, production habitat transitions or existing scene-specific caustics.

## Measured rendering costs

Linux Chromium with forced **SwiftShader software rendering**, 1440×1050 browser viewport, 1440×520 render canvas, DPR 1, one orthographic camera, hemisphere/directional lighting, built-in fog and five specimens. Tests/tooling ran concurrently. These are not real-GPU or MacBook Air results.

| Prototype       | Triangles | Draw calls | Construction/animation                                            |
| --------------- | --------: | ---------: | ----------------------------------------------------------------- |
| Common fish     |       280 |          1 | Asymmetric profile, outlined/mirrored fins, tail/body bend        |
| Ray-like        |       168 |          1 | Wide profile sections, wing undulation and tail bend              |
| Branching coral |        86 |          1 | Continuous manifold fork, static                                  |
| Irregular rock  |        12 |          1 | Authored hull support planes, static                              |
| Aquatic plant   |       448 |          1 | Curved stem, tapered leaves, anchored sway                        |
| Total           |       994 |          5 | Five geometry buffers, four shared materials, two shader programs |

The coral and rock are minimal pipeline exemplars below the provisional art-budget ranges, not final species/environment assets. No quality downgrade is applied at runtime.

Browser readiness was 4,430 ms. A 60-frame sample measured 100 ms median, 200 ms p95, 334.5 ms maximum RAF interval. These include browser scheduling, software rasterization and concurrent test contention; they are **not** GPU draw duration, simulation cost or predicted hardware frame time. Do not use them to claim a game performance improvement.

Live resources: five geometries and four textures (three morph data textures plus Three r187's shared 16×16 DFG lighting LUT). Each of five release cycles returned to zero geometries, zero generated cache entries, zero draw calls and one renderer-owned LUT. Full renderer disposal returned to zero geometries, textures and shader programs. No increasing resource counts were observed; JS heap retention and long-running production transitions were not measured.

Compared with Pass 015: production entry remains exactly **1,635.94 kB / 497.54 kB gzip**. This pass adds no production-entry downloads; prototypes and helpers are unreachable from its imports. No new GLB or image textures are required. Pass 015's inherited aquarium figures (94 calls/897,845 triangles) describe an entire different scene and are not an apples-to-apples benchmark. There was no matched five-prototype scene in that pass. Consequently, no FPS or full-world memory improvement is claimed.

## Evidence

- [Three-quarter](pass016-evidence/three-quarter.png)
- [Side](pass016-evidence/side.png)
- [Front](pass016-evidence/front.png)
- [Top](pass016-evidence/top.png)
- [Raw browser measurements](pass016-evidence/results.json)

Initial development checks caught inward ring winding, missing bounds after palette copying and a degenerate fork cap; all were corrected before the final geometry checks. The first browser harness incorrectly expected Three's renderer-owned LUT to vanish with models and requested a missing favicon; ownership assertions and the inspection favicon were corrected. The final run passes without suppressing console errors.

## Remaining concerns and acceptance

- Prototype silhouettes demonstrate the tools; they are not production model replacements or complete anatomical reference studies. The previously mentioned reference images were not attached, so exact image matching is unverified.
- The Pass 015 semantic inventory remains provisional. Complete each family’s caller/ownership review before replacement passes.
- Imported GLB lease architecture, gameplay, fog and effects are preserved by leaving production imports unchanged. Migrated assets still need localized visual/collision/animation review in their actual habitats.
- Smooth-shaded morph assets need corresponding normal targets; combined/unbounded poses and custom shader displacement need their own conservative bounds. Arbitrary self-intersections are not solved by these construction helpers.
- Actual MacBook Air/Safari appearance and frame timing, transparency sorting, device loss, and long-duration environment transition memory require device testing. No claim of device acceptance, release or deployment.
- The existing production chunk-size warning remains; splitting the game is outside this infrastructure pass and lacks measured justification here.
