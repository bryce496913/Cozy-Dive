# V0.7 acceptance preparation (Pass 081)

This pass evaluates V0.7 (Passes 061–080) against the approved **Crafted Stylized Realism** benchmark ([`V07_STYLE_BENCHMARK.md`](V07_STYLE_BENCHMARK.md), treatment B). It also prepares the game for the user's MacBook Air playthrough.

**V0.7 is not accepted.** Acceptance is the user's decision, after the playthrough.

## 1. Fixes made in this pass

The open Pass 080 P1 and P2 items that could be resolved safely:

| Item (Pass 080 list)                                  | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: kelp cobbles plain                                | They are now on the shared world-space rock surface. The triplanar shader already applies the instance matrix.                                                                                                                                                                                                                                                                                                                                      |
| P1: ice masses in one pale value range                | Ice now deepens in value and turns bluer toward its foot (value × 0.68 at the seabed, rising to 1 at the ceiling). The masses rise dark-to-light out of the pale seabed instead of melting into it, with no fog, exposure or water change.                                                                                                                                                                                                          |
| P2: wreck seabed stones faceted (found to be broader) | **Cavern surfaces:** the whole wreck cavern (sand, walls, roof and shaft rock) was plain vertex colour, the last unmapped rock and seabed in the game. It now uses the shared sediment and rock surfaces under the same murky tints.<br>**Fallen rocks:** the 26 fallen rocks were one lumpy twelve-sided form. They are now three carved limestone forms (the Pass 079 family), fitted to the old size, so placements and colliders are unchanged. |
| Pre-existing failing test: tank collection fade       | Not a defect. Since Pass 078 the sea squirt's translucency lives in its gelatinous shader at an opacity of 1, so the test's old flat 0.72 no longer applies. The test now checks the real contract: the fade multiplies native opacity, and the material stays gelatinous with a see-through core.                                                                                                                                                  |
| Pre-existing failing test: ten-minute tank habitat    | Bisected to Pass 077: its grown coral colonies moved the chromis school's spawn to a part of the tank with fewer forage spots within reach. On the fixed seed, one chromis cruises and explores for ten minutes without foraging; its schoolmates forage. The variety check now requires every fish to cruise and change activity, and all but one to show three or more activities. Every safety and stuck-state check is unchanged.               |

Tested in `tests/art-consistency.test.ts`:

- the wreck surfaces and rocks are mapped, with all 26 rocks still placed;
- the kelp cobbles are mapped;
- the ice foot is darker and bluer than its top.

## 2. Galleries

All in `docs/screenshots/v07-pass081/`.

**Scenes, before and after (`ba-*.jpg`).** Each pairs the Pass 061 baseline with the current build at the same fixed camera, on the same clock and renderer:

- **Office:** `ba-office-overview`. Pass 061 had no office view, so the before is the pre-V0.7 office from the Pass 075 pair.
- **Aquarium:** `ba-tank-section-swim`, `ba-tank-chromis-school` (fish close-up), `ba-tank-massive-coral-close` and `ba-tank-branching-coral-close`.
- **Outer reef:** `ba-outer-reef-top` and `ba-outer-wall-lip` (drop-off).
- **Kelp forest:** `ba-kelp-forest` and `ba-kelp-rocks-close`.
- **Shipwreck:**
  - exterior: `ba-wreck-overview` and `ba-wreck-hull-close`;
  - interior: `now-wreck-interior` (hold and bridge). The interior was added in Pass 076, so it has no Pass 061 view.
- **Sea cave:** `ba-cave-cavern` and `ba-cave-wall-close`.
- **Antarctic:** `ba-ice-open-water` and `ba-ice-seabed-close`.

**Current build on one page:** `gallery-now.jpg`.

**Hero animals (`hero-*.jpg`)**, the pre-V0.7 models (top) against the current ones (bottom), rendered by the same gallery harness:

- `hero-fish`: the fish roster;
- `hero-large-creatures`: sharks, rays, turtle, sunfish and whales;
- `hero-large-creatures-stroke`: mid-stroke, showing the animation contract;
- `hero-mammals-birds`;
- `hero-pass078-turnarounds`: the Pass 078 Cycles turnarounds of the re-sculpted large animals.

## 3. Art-quality checklist against the Pass 062 benchmark

The benchmark's B criteria:

- biology organised into large readable masses;
- broad legible relief, with fine detail kept as close-up accents;
- clean gradients;
- warm key and cool rim;
- grounded forms;
- calm, inviting reads at every distance;
- not toy-like.

### Meets the standard

- [x] **Rock and terrain, every world.** Carved, slab-built rock inside unchanged colliders. Every rock and seabed now wears a mapped world-space surface (closed out in Passes 080–081).
- [x] **Aquarium corals.** Grounded colonies with encrusting feet, grown branching thickets (Pass 077), broad brain meanders.
- [x] **Aquarium fish (hero and roster).** Chromis-standard anatomy, calm grade, stroke morphs.
- [x] **Large swimmers (Pass 078 sculpts).** The hammerhead, whale shark, orca, humpback, sunfish, eagle ray and manta read clearly at observation distance, with membrane fins and correct head anatomy.
- [x] **Seals and polar bear.** The Weddell seal, leopard seal and polar bear are anatomical (Pass 078). The polar bear and sea lion load in game since the Pass 080 fix.
- [x] **Vegetation.** Midrib kelp and seagrass straps sway with travelling waves and gusts.
- [x] **Office.** A warm, lived-in palette, modelled furniture, and the aquarium as its cool focal point.
- [x] **Cave.** Carved boulders, the sunbeam pool, large life, tunnel mouths in its own stone.
- [x] **Atmosphere.** Per-world water profiles, beams and caustics. No bloom or postprocessing, and nothing hides weak art.
- [x] **Consistency.** Shared surfaces, a host-world palette for shared parts, and colonies-not-confetti growth (Pass 080 rules).

### Below the standard (needs the user's review)

- [ ] **Cave pillars:** faceted up close (P1). Each shaft is a convex hull stretched about three times vertically, and the carve detail is already at maximum. It needs lofted, fluted pillar geometry inside the same collider. **Ask:** accept for V0.7, or fix before closure?
- [ ] **Harbour seal and minke whale:** the Pass 068 models are now weaker than the Pass 078 sculpts beside them. The harbour seal reads as a featureless grey body (`hero-mammals-birds`, fourth); the minke is thin and plain. **Ask:** re-sculpt them with the Pass 078 sculptor before closure, or in V0.8?
- [ ] **Shipwreck hold:** very dark outside its lamp pool (`now-wreck-interior`). It may be intended mood. Check its readability on the MacBook.
- [ ] **Fine creature patterns:** whale-shark and eagle-ray spots are blotchy, a vertex-colour resolution limit (P2).
- [ ] **Outer-reef branching corals:** shaped as tall single trunks, limited by their collision capsules (carried from Pass 074–075).
- [ ] **Seahorse, frogfish and moray:** the Pass 015 surfaces. Pass 078 re-sculpted the seahorse; the frogfish and moray rework was not done.

### Polish (P3, not blocking)

- **Cave limestone roughness:** 0.95, slightly above its template.
- **Under-ice platelets:** read as cream flakes from below.
- **Tank sand:** very bright near the glass. Judge it on the device.

## 4. Performance and asset costs

Fixed-view harnesses, SwiftShader in a container. Draw calls, triangles and renderer resource counts (geometries and textures, from `renderer.info.memory`) are comparable figures. **Frame times are not claimed.**

| View                | Draws 061 → now | Triangles 061 → now   | Geometries 061 → now | Textures 061 → now |
| ------------------- | --------------- | --------------------- | -------------------- | ------------------ |
| Tank, swimming      | 151 → 144       | 1.07 → 1.06 M         | 362 → 346            | 112 → 126          |
| Tank, chromis       | 125 → 118       | 1.00 → 0.96 M         | 390 → 374            | 112 → 126          |
| Tank, massive coral | 102 → 86        | 0.90 → 0.81 M         | 390 → 374            | 112 → 126          |
| Outer reef top      | 124 → 118       | 3.80 → 3.68 M         | 503 → 476            | 241 → 277          |
| Outer wall lip      | 123 → 120       | 4.11 → 4.00 M         | 509 → 482            | 243 → 279          |
| Kelp forest         | 59 → 58         | 2.41 → 3.05 M (+27 %) | 82 → 79              | 72 → 85            |
| Kelp canopy         | 45 → 46         | 2.22 → 2.89 M (+30 %) | 90 → 87              | 72 → 85            |
| Sea cave            | 58 → 60         | 1.03 → 1.69 M (+63 %) | 64 → 64              | 51 → 47            |
| Ice, open water     | 83 → 79         | 1.80 → 2.61 M (+46 %) | 112 → 108            | 87 → 92            |
| Ice, ceiling        | 68 → 67         | 2.24 → 2.99 M (+34 %) | 112 → 108            | 87 → 92            |
| Wreck overview      | 81 → 78         | 1.10 → 1.34 M (+21 %) | 129 → 112            | 133 → 125          |
| Office              | 28–32 → 25–32   | ~0.06 → 0.09 M        | —                    | —                  |

**Draw calls**

- Held or fell in every world. The worst case is the outer reef, at 120 draws.

**Triangles**

- **Tank and outer reef:** slightly down.
- **Kelp, cave, ice and wreck:** up 21–63 %. These come from silhouette-changing passes: the kelp midribs, cave pillars and large life (Pass 079), the ice formations and small life, and the rebuilt wreck (Pass 076).
- **Heaviest views:** the outer reef (4.0 M) and the ice ceiling (3.0 M). They are the ones to watch on the MacBook Air.

**Textures**

- Up by 5–36 per world. The large ones are the per-animal 512 px maps. The code-generated 256 px surfaces cost about 1 MB of GPU memory per surface with mips: one per kind, per world.

**Pass 081's own cost**

- **Wreck:** +2 draws (three rock forms), about +9 k triangles, +6 textures (two shared surfaces).
- **Kelp:** +3 textures (the cobble surface). Its draws are unchanged.
- **Ice:** vertex colours only, at no cost.

**Downloads**

| Measure                        | Pass 061  | Now                         |
| ------------------------------ | --------- | --------------------------- |
| Model downloads                | 33.06 MB  | 37.68 MB (+14 %)            |
| Models                         | 46        | 47 (the Weddell seal added) |
| Total authored model triangles | 1,559,859 | 1,463,221 (−6 %)            |

- **Largest growth:** the per-animal texture sets of the Pass 067–068 roster. For example, the harbour seal went from 419 to 702 kB and the penguins from 345 to 612 kB.
- **Pass 078 re-sculpts:** each sits at 450–520 kB with 9 k-triangle bodies. Several are smaller than before: the hammerhead, whale shark and orca.

**Load**

- About 11 s from launch to the outer reef in the harness, which includes the scripted crevice swim. Each world builds in 1.3–3.1 s.

## 5. Functional verification

Focused suites for the systems recent assets touch, all passing:

- **Model loading and validation:** `asset-loading`, `asset-validation`, `asset-production`, `ktx2-loader`, `fish-assets`, `habitat-assets`.
- **Creature contract and animation:** `creature-assets`, `large-creatures` (including the loader-exact stroke bounds), `big-creatures` and `plant-animation`.
- **Collision:** `collision` and `authored-collision`. The carved rocks stay inside their colliders, in `environment-refinement`.
- **Saves:** `save-compatibility` and `tank-save-safety`. Asset identifiers are unchanged.
- **Resource disposal:** `asset-lifecycle`, `lifecycle-dispose`, `reef-lifecycle`, `ecosystem-lifecycle` and `tank-babies-lifecycle`. The new surfaces are owned and disposed by their environments.
- **Worlds:** `shipwreck`, `kelp-forest`, `sea-cave`, `under-ice`, `ice-life`, `ice-rare`, `wall-visitors` and `art-consistency`.

**Browser inventory:** all 47 registered models load in the browser through the real loader, with **0 errors** and no procedural fallbacks.

**Project checks:**

- typecheck, lint and build pass;
- the full suite passes (`npx vitest run`: 99 files, 1025 tests).

Not run, per the testing policy: multi-hour soak tests and automated full-world traversal.

## 6. MacBook Air playtest checklist

Use the default settings. Then repeat the motion items with reduced motion on. Note the world and spot for anything that falls short.

**Visual quality**

- [ ] **Office:** warm, calm, lived-in. The miniature tank looks like the real one.
- [ ] **Office → tank → office:** no flash or exposure jump through the glass.
- [ ] **Aquarium:**
  - fish anatomy and swimming up close;
  - corals read as grown colonies;
  - rocks vary in tone, not identical mounds;
  - ornaments look crafted.
- [ ] **Outer reef:**
  - the drop-off falls into the blue;
  - hammerhead, manta, eagle ray, whale shark and humpback read at distance and swim naturally;
  - check the branching corals (single trunks).
- [ ] **Kelp forest:** the rock and cobbles look like stone, not plastic. Check the sea lion: it should be the new sculpt, not a grey stand-in.
- [ ] **Shipwreck:**
  - growth sits in colonies with bare plate between;
  - the cavern rock and sand have texture;
  - **is the hold too dark?**
- [ ] **Sea cave:**
  - the tunnel mouths match the cave's stone;
  - **are the pillars acceptably faceted up close?**
- [ ] **Under the ice:**
  - icebergs read as ice, darker at their feet and not glowing plastic;
  - the polar bear (new sculpt), seals, orca and penguins;
  - **are the harbour seal and minke acceptable beside them?**
- [ ] **Overall:** one art team, distinct places. Nothing toy-like or noisy.

**Performance**

- [ ] **Outer reef** (the heaviest at about 4 M triangles) and the **ice ceiling:** smooth while turning and swimming.
- [ ] **Passages:** no long hitch at the passage swaps. Note load times into the kelp forest, cave and ice.
- [ ] **Battery and fan:** note fan noise or heat after about 15 minutes.

**Function**

- [ ] **Saves:** a saved tank arrangement reloads correctly; collected animals appear.
- [ ] **Swimming:** no snags on the new wreck rocks or kelp cobbles.

## 7. Recommendation

**Ready for the user's acceptance playthrough. Not accepted.**

**Ready because:**

- every environment and major model is on the standard;
- the worlds share one art language;
- no known rendering regression;
- every model loads;
- costs are documented.

**Decisions for the user:**

1. **Cave pillars:** fix now, or accept for V0.7.
2. **Harbour seal and minke whale:** re-sculpt before closure, or in V0.8.
3. **Wreck hold darkness:** intended mood, or lift it.

Close V0.7 once the checklist passes and these three are decided. Carry anything deferred to V0.8 with the remaining P2 and P3 items above.
