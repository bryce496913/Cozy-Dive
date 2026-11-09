# v0.2 Pass 015 — Coral & Creature Detail Overhaul

Validation date: November 9, 2026. Candidate `0.2.0-rc.9` for user review. No merge, release or next pass is authorized by this report. Browser evidence comes from Linux Chromium with SwiftShader software rendering; it is not MacBook Air performance.

**Scope agreed with the user:** hard corals, soft corals, sea fans, the host anemone, moray, frogfish, seahorse, nudibranchs and clownfish. Clownfish were reviewed and left unchanged: they already use the accepted Pass 012/013 fish morph workflow. Free-swimming reef fish are the next pass.

## 1. Approach

The Pass 014 rocks and sand succeeded through four things together:

- multi-scale relief;
- continuous object-space colour pattern;
- cavity and underside occlusion in vertex colour;
- fine tileable micro-detail maps.

Pass 015 applies the same recipe:

| Subject               | Before (Pass 014 `main`)                   | Pass 015                                                                                                                                                                              |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branching coral       | Primaries, irregular secondaries and tips  | Bushier, flaring canopy; tubular radial corallites budding along every outer branch; pale tips over a darker shaded interior; corallite-cup maps; distance LOD without the corallites |
| Brain coral           | Broad grooves on smooth lobes              | Level-5 lobes with 8–10 sharp meanders each; raised pale collines over dark green-brown valleys; septa map; level-3 distance LOD                                                      |
| Boulder coral         | Smooth blob                                | Porites-style hummocky lobules with creased valleys; mottled tan / purple-grey patches                                                                                                |
| Plate coral           | Plain cylindrical trunk                    | Gnarled, buttressed, lobed trunk; thicker banded plates; muted rim branchlets; costae map                                                                                             |
| Soft coral / sea fans | Smooth fingers / thin lattice              | More numerous fingers, darker stalks, paler polyp-dense tips; thicker, denser fan network; extended-polyp map                                                                         |
| Host anemone          | Uniform pink tubes                         | Bubble-tip anemone: green-tan tentacles, white sub-terminal band, swollen magenta tips, striped oral disc and red-brown mouth                                                         |
| Moray                 | Procedural sine mottling                   | Continuous honeycomb reticulation from body to head, subtle skin folds, paler belly; leathery pore map                                                                                |
| Frogfish              | Smooth yellow blob                         | Warts (up to 7 mm relief), ochre-orange ground with rust blotches, dark ocelli, pale belly, cavity shading; wart/papilla map                                                          |
| Seahorse              | Smooth olive skin                          | Raised bony rings and tubercles, dark ring seams, irregular saddles, white speckle; bony-plate map                                                                                    |
| Nudibranchs           | Procedural ellipsoids with cylinder cerata | Five authored species (two aeolids, three dorids), one per accepted variant                                                                                                           |

**How the creatures were re-authored.** Each starts from the accepted Pass 013 meshes, pinned as `tools/art/pass015/anchored-life.pass013.glb`; a Blender import/export roundtrip was verified lossless. Behaviour, pivots, controller frames, home selection and animation contracts are untouched:

- **Moray**: the body keeps its GPU centreline parameter (`z = 1 − v`). At runtime, only the procedural colour override is removed.
- **Frogfish**: its sole receives no relief.
- **Nudibranchs**: they follow the existing crawl poses, phases and ripple clock.

## 2. Matched before/after captures

Both columns use the same harness (`validation/creature-overhaul.mjs`), cameras and fixed creature poses: moray extension 0.7, discovery pose time 41/12, paused clocks. "Before" is the merged Pass 014 `main` served from a clean clone; "after" is this branch. Free-swimming fish may differ in the background. Discovery close-ups use each home's own validated view point.

| View            | Before (Pass 014)                                        | After (Pass 015)                                        |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Branching coral | ![](screenshots/v0.2-pass015/branching-coral-before.jpg) | ![](screenshots/v0.2-pass015/branching-coral-after.jpg) |
| Brain coral     | ![](screenshots/v0.2-pass015/brain-coral-before.jpg)     | ![](screenshots/v0.2-pass015/brain-coral-after.jpg)     |
| Boulder coral   | ![](screenshots/v0.2-pass015/boulder-coral-before.jpg)   | ![](screenshots/v0.2-pass015/boulder-coral-after.jpg)   |
| Plate coral     | ![](screenshots/v0.2-pass015/plate-coral-before.jpg)     | ![](screenshots/v0.2-pass015/plate-coral-after.jpg)     |
| Soft coral      | ![](screenshots/v0.2-pass015/soft-coral-before.jpg)      | ![](screenshots/v0.2-pass015/soft-coral-after.jpg)      |
| Sea fan         | ![](screenshots/v0.2-pass015/sea-fan-before.jpg)         | ![](screenshots/v0.2-pass015/sea-fan-after.jpg)         |
| Host anemone    | ![](screenshots/v0.2-pass015/anemone-before.jpg)         | ![](screenshots/v0.2-pass015/anemone-after.jpg)         |
| Clownfish pair  | ![](screenshots/v0.2-pass015/clownfish-before.jpg)       | ![](screenshots/v0.2-pass015/clownfish-after.jpg)       |
| Moray           | ![](screenshots/v0.2-pass015/moray-before.jpg)           | ![](screenshots/v0.2-pass015/moray-after.jpg)           |
| Frogfish        | ![](screenshots/v0.2-pass015/frogfish-before.jpg)        | ![](screenshots/v0.2-pass015/frogfish-after.jpg)        |
| Seahorse        | ![](screenshots/v0.2-pass015/seahorse-before.jpg)        | ![](screenshots/v0.2-pass015/seahorse-after.jpg)        |
| Nudibranch 1    | ![](screenshots/v0.2-pass015/nudibranch-1-before.jpg)    | ![](screenshots/v0.2-pass015/nudibranch-1-after.jpg)    |
| Nudibranch 2    | ![](screenshots/v0.2-pass015/nudibranch-2-before.jpg)    | ![](screenshots/v0.2-pass015/nudibranch-2-after.jpg)    |
| Nudibranch 3    | ![](screenshots/v0.2-pass015/nudibranch-3-before.jpg)    | ![](screenshots/v0.2-pass015/nudibranch-3-after.jpg)    |
| Nudibranch 4    | ![](screenshots/v0.2-pass015/nudibranch-4-before.jpg)    | ![](screenshots/v0.2-pass015/nudibranch-4-after.jpg)    |
| Nudibranch 5    | ![](screenshots/v0.2-pass015/nudibranch-5-before.jpg)    | ![](screenshots/v0.2-pass015/nudibranch-5-after.jpg)    |

**My assessment, pending yours:**

- **Clear gains**: brain and boulder corals, the anemone, frogfish, seahorse, moray and all five nudibranchs.
- **Smaller gains**: branching coral (corallites read at close range).
- **Modest gains**: soft coral, sea fans and plates. Their placement envelopes and thin structural hulls limit how much form can change.
- **Remaining limits**:
  - The frogfish keeps its accepted bulbous silhouette; skin detail changed, not its anatomy.
  - Sea fans still read as thin lines edge-on.

## 3. Budgets (identical cameras, SwiftShader)

| View            | Pass 014 draws / triangles | Pass 015 draws / triangles |
| --------------- | -------------------------: | -------------------------: |
| branching-coral |               69 / 517,293 |               67 / 572,422 |
| brain-coral     |               99 / 712,468 |               99 / 817,453 |
| boulder-coral   |               67 / 484,303 |               65 / 509,318 |
| plate-coral     |               95 / 755,680 |               93 / 791,091 |
| soft-coral      |              106 / 763,848 |              105 / 815,521 |
| sea-fan         |               97 / 697,104 |               97 / 802,089 |
| anemone         |              115 / 862,573 |              115 / 999,236 |
| clownfish       |              115 / 859,861 |              115 / 996,792 |
| moray           |              160 / 908,666 |              160 / 993,161 |
| frogfish        |               77 / 575,068 |               75 / 592,635 |
| seahorse        |               61 / 484,959 |               59 / 551,259 |
| nudibranch-1    |               45 / 400,292 |               44 / 406,670 |
| nudibranch-2    |              110 / 777,894 |              109 / 867,629 |
| nudibranch-3    |               65 / 530,779 |               64 / 559,505 |
| nudibranch-4    |               38 / 315,492 |               38 / 328,470 |
| nudibranch-5    |               36 / 303,652 |               35 / 310,578 |

- **Draws and triangles**: draw calls are unchanged or one fewer. Submitted triangles rise 2–16% per view, and at most about 1.0 M.
- **Hero coral detail**:
  - Brain colonies are 82k triangles each up close and 5k beyond 10 units.
  - Branching colonies are about 45k each up close; beyond 10 units they drop the corallites.
- **GPU uploads**: 54 textures (was 45).
- **CPU submission**: median 1.35 → 1.5 ms (software renderer, diagnostic only).

Downloads for the normal scene, all local, with no compression yet:

| Library                |    Pass 014 |    Pass 015 |
| ---------------------- | ----------: | ----------: |
| reef-environment.glb   |     19.5 MB |     32.0 MB |
| anchored-life.glb      |      4.1 MB |      8.2 MB |
| nudibranchs.glb (new)  |           — |      2.1 MB |
| reef-props + clownfish |      5.1 MB |      5.1 MB |
| **Total**              | **28.8 MB** | **47.5 MB** |

Resident CPU inventory is now 422 geometries / 81 materials / 435 hulls (was 411 / 73 / 435). Collision and the simulation are unchanged.

## 4. Automated validation

| Check                                                     | Result                                                                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` / `npm run build:benchmark`               | Pass                                                                                                                                                                                    |
| `npm run typecheck` / `npm run lint` / `git diff --check` | Pass                                                                                                                                                                                    |
| `npm run test -- --maxWorkers=2 --no-file-parallelism`    | **324 passed / 34 files** (new `creature-assets`: 4)                                                                                                                                    |
| `npm run test:stress`                                     | **10 passed**. Production composition at 5/15/30 minutes: 435 hulls, zero recovery corrections, fish step p95 0.96–1.51 ms, swim+collision p95 0.24–0.26 ms, closest fish to glass 0.55 |
| `python3 tools/art/inspect_assets.py`                     | All seven GLBs pass. The reef library's rock containment checks still pass                                                                                                              |

The new tests check three things:

- **Creature nodes and frames**: every accepted creature node, root offset and frame is preserved.
- **Bounded relief**: authored relief grows no part by more than 1.2 cm, the frogfish sole stays at its accepted underside, and the moray centreline parameter holds within 2 mm.
- **Nudibranch envelopes**: each species matches its variant and stays inside its validated surface-home envelope (radius < 0.285, height < 0.257).

Updated exact counts (measured, not loosened): 422 / 81 inventory; 5 normal and 7 benchmark GLB requests; the reef library size ceiling is 34 MB.

## 5. Browser evidence

All harnesses passed against the default scene: no page errors, no WebGL errors, and no console errors except the deliberate fallback cases.

| Harness                                                 | Result                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creature-overhaul.mjs` (new, before/after)             | 16 matched views on each build; 5 local GLB requests on the branch                                                                                                                              |
| `geometry-overhaul.mjs`                                 | **38,644** sampled seahorse/frogfish vertices with **no intrusions** into structure; 40 fish / 7 hidden / 435 hulls; cleanup 0 / 0; pending-load cleanup 0 / 0; props-library fallback          |
| `ornaments.mjs`, `anchored-life.mjs`, `discoveries.mjs` | Pass (chest, bubbles, all moray states, anemone current, discovery close-ups, pause and reduced motion)                                                                                         |
| `lifecycle.mjs`                                         | Pass. Native pointer lock, WASD, Escape, four pause/resume cycles, settings, visibility and audio. The 30-minute accelerated soak holds 422 / 81 / 435 steady; forced-GC heap is 23.3 → 23.9 MB |
| `integration.mjs`                                       | **Pass.** It now passes because the frogfish approach fix (#22) is on `main`                                                                                                                    |
| `reef-overhaul.mjs` (Pass 014)                          | Pass, including the reef-library fallback (216 hulls plus notice)                                                                                                                               |
| `production.mjs` (`npm run preview`)                    | Pass. 5 GLBs return 200; no errors or warnings. JS is 838.60 kB / 225.37 kB gzip (+1.9 kB)                                                                                                      |
| `visual-benchmark.mjs`, `asset-smoke.mjs`               | Pass (benchmark dev and production build; 7 GLB requests)                                                                                                                                       |

## 6. Known limitations

- **Download size.** The scene download is now about 47.5 MB, with no Draco, meshopt or KTX2 compression. Hardware FPS and memory on the MacBook Air are unmeasured.
- **Shape contracts.** Creature silhouettes are the accepted Pass 013 anatomy plus a few millimetres of relief. Changing body shapes, such as a less bulbous frogfish, would need new rigs and clearance validation.
- **Constrained forms.** Soft corals, fans and plate colonies are constrained by their validated placement envelopes and structural hulls.
- **Not in scope.** Clownfish and the free-swimming reef fish are unchanged.
- **Tooling.** All new sources need Blender 5.1+ (as in Pass 014).

## 7. Manual macOS acceptance checklist

- [ ] Branching, brain, boulder and plate corals read as living colonies close up.
- [ ] Soft corals and sea fans look richer and still sway gently.
- [ ] The anemone reads as a bubble-tip anemone; clownfish behaviour is unchanged.
- [ ] Moray pattern and unfolding look natural; the head and body pattern feel continuous.
- [ ] Frogfish and seahorse skins look detailed; both stay seated or gripping correctly.
- [ ] Each nudibranch is a recognisable, distinct species, crawling smoothly on its surface.
- [ ] Pause and reduced motion freeze or settle all of the above.
- [ ] Loading time and performance stay comfortable on the MacBook Air.

## 8. Recommendations

1. **Pass 016: free-swimming reef fish.** Bring chromis, cardinalfish, firefish, assessors and grammas onto the authored morph workflow, with the same skin recipe. Refresh the clownfish maps at the same time.
2. **Asset compression** (meshopt or Draco geometry, KTX2 textures), measured on the MacBook Air, before adding more content.
3. **The lighting pass.** It should treat these materials as its reference.
