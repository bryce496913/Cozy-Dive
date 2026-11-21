# V0.7 — Crafted Stylized Realism: final report (Pass 075)

V0.7 brought every existing creature and environment onto the approved **Crafted Stylized Realism** standard, chosen in Pass 062. It added no new worlds, species or gameplay.

**Status: implemented and awaiting the user's acceptance on the MacBook Air.** V0.7 is not marked accepted until then.

## What changed (Passes 061–075)

| Pass | Area                   | Result                                                                                | Doc                                                 |
| ---- | ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 061  | Baseline               | Fixed-view harnesses and measurements                                                 | [V07_VISUAL_BASELINE](V07_VISUAL_BASELINE.md)       |
| 062  | Style benchmark        | The user chose treatment B, Crafted Stylized Realism                                  | [V07_STYLE_BENCHMARK](V07_STYLE_BENCHMARK.md)       |
| 063  | Art bible and pipeline | Standards, Blender helpers, production checks                                         | [V07_ART_PRODUCTION](V07_ART_PRODUCTION.md)         |
| 064  | Atmosphere             | Per-world spectral fog, beams, caustics, retuned tank                                 | [V07_ATMOSPHERE](V07_ATMOSPHERE.md)                 |
| 065  | Hero fish              | Chromis, clownfish and gramma rebuilt from anatomy                                    | [V07_HERO_FISH](V07_HERO_FISH.md)                   |
| 066  | Fish roster            | The other 15 fish                                                                     | [V07_FISH_ROSTER](V07_FISH_ROSTER.md)               |
| 067  | Large creatures        | 13 sharks, rays, turtle, sunfish, humpback (plus atlas, seam and centring fixes)      | [V07_LARGE_CREATURES](V07_LARGE_CREATURES.md)       |
| 068  | Mammals and birds      | 10 animals authored in Blender; the ice world's code-built stand-ins removed          | [V07_MAMMALS_BIRDS](V07_MAMMALS_BIRDS.md)           |
| 068s | Small life             | Smooth shading everywhere; continuous limbs, arms and shells                          | [V07_SMALL_LIFE](V07_SMALL_LIFE.md)                 |
| 069  | Coral                  | Grown massive colonies, encrusting feet, polyp clubs                                  | [V07_CORAL](V07_CORAL.md)                           |
| 070  | Rocks and seabeds      | Inward-carved rocks inside unchanged colliders; natural ripples                       | [V07_TERRAIN](V07_TERRAIN.md)                       |
| 071  | Vegetation             | Midrib kelp, five templates, curving sway and gusts                                   | [V07_VEGETATION](V07_VEGETATION.md)                 |
| 072  | Ornaments              | Chest, filter, arch and statue polish                                                 | [V07_ORNAMENTS](V07_ORNAMENTS.md)                   |
| 073  | Office                 | A warm, lived-in palette and light; rug, lamp, plant                                  | [V07_OFFICE](V07_OFFICE.md)                         |
| 074  | Integration            | Gallery, audit, checklist, final standards; ice shading fix                           | [V07_VISUAL_INTEGRATION](V07_VISUAL_INTEGRATION.md) |
| 075  | Final                  | Kelp sand on the shared sediment surface; asset and performance report; this document | —                                                   |

**Fixed in Pass 075**

- **Kelp-forest sand:** a P1 item from the Pass 074 checklist. It now uses the shared sediment surface (wandering ripples, grain, grit, world-space triplanar), tinted by its vertex colours, with its caustics kept. The surface is owned and disposed by the kelp environment; triangles and draws are unchanged.

**User feedback**

- No playtest notes were supplied with the Pass 074 merge. The fixes here follow the Pass 074 checklist.

## Before / after gallery

`docs/screenshots/v07-final/` pairs the Pass 061 baseline (left) with the current build (right) at the same fixed viewpoints:

- tank: section and chromis school, massive coral;
- outer reef: top and wall lip;
- kelp forest: forest and rocks;
- wreck overview;
- cave: cavern and wall;
- under the ice: open water and seabed;
- office overview.

Every pass folder (`docs/screenshots/v07-pass0xx/`) holds its own close-ups.

## Performance and asset report

Fixed-view harnesses, SwiftShader, from Pass 061 to now:

| View                   | Draws (061 → now) | Triangles (061 → now) |
| ---------------------- | ----------------- | --------------------- |
| Tank, swimming         | 151 → 145         | 1.07 → 1.08 M         |
| Tank, chromis school   | 125 → 120         | 1.00 → 0.99 M         |
| Outer reef top         | 124 → 118         | 3.80 → 3.93 M         |
| Outer wall lip         | 123 → 116         | 4.11 → 4.25 M         |
| Kelp forest            | 59 → 58           | 2.41 → 3.05 M         |
| Kelp canopy            | 45 → 46           | 2.22 → 2.89 M         |
| Sea cave               | 58 → 57           | 1.03 → 1.18 M         |
| Under the ice, open    | 83 → 81           | 1.80 → 2.44 M         |
| Under the ice, ceiling | 68 → 65           | 2.24 → 2.84 M         |
| Shipwreck              | —                 | 1.26 M                |
| Office                 | 28–32             | ~0.06 M               |

**Draw calls**

- They held or fell in every world. Merging and instancing were preserved throughout.

**Triangles**

- **Tank and outer reef:** about +1–3 %.
- **Kelp:** +27 %, mostly the midrib blades in Pass 071, plus five templates.
- **Ice:** +35 %, mostly Pass 068's small-life detail and Pass 069's coral.
- **Cave:** +15 %.
- Every increase was accepted only where it changes silhouettes, and is recorded per pass.

**Downloads and textures**

- **Model downloads:** 33.1 → 39.1 MB across the same 46 assets.
- **Textures:** per-animal 512 px base, normal and ORM maps for the large creatures and mammals (KTX2: ETC1S colour, UASTC normals). Code-generated surfaces (sediment 256 px, office floor 512 px) add no downloads.
- **Budget tests:** the model budget test is at 38 MB.

**Shaders**

- The kelp and plant sway gained a few ALU operations per vertex.
- The office gained one point light (the desk lamp).
- No new post-processing.

**Loading and unloading**

- Every new material, texture and morph target goes through the existing asset loader and owners.
- The asset-lifecycle, disposal, creature-contract and asset-validation tests pass.

**Duplicated and unused assets**

- **Shipped models:** every shipped GLB is referenced, so none was removed. Asset identifiers are unchanged and saves are unaffected.
- **Draco decoder copies:** the build emits an unused second copy of the Draco decoder (about 1.2 MB in `dist/`). Three's `DRACOLoader` declares default decoder URLs, which Vite bundles, but the game always loads its own `assets/draco/` copy, so players never download it. It is left alone; stubbing it would mean a bundler plugin for no runtime gain.
- **Code-built ice animals:** removed in Pass 068, replaced by authored GLBs.

## Remaining limitations

**P1**

- **Shipwreck hull:** reads as a flat, dark slab.
- **Outer-reef branching corals:** shaped as single trunks, limited by their collision capsules.

**P2**

- **Cave:** the distance boulders and the plain floor under the sunbeam.
- **Ice seabed:** density may hide small animals.
- **Seahorse, frogfish and moray:** due a Blender rework.
- **Office furniture:** shapes are basic.
- **Crustaceans and jellies:** colour-banded joints, and no translucency.

**P3**

- **Sediment tiling:** repeats about every 1.4 m.
- **LOD:** plate and soft corals have no distance level.
- **Polar bear:** neck length, and an Arctic species in an Antarctic world (recorded, not changed).

**Measurement**

- All captures and measurements are SwiftShader in a container. Frame time, warmth and exposure need confirming on the MacBook Air.

## MacBook Air acceptance checklist

Use the default settings, then repeat the motion items with reduced motion on.

- [ ] **Office:** warm and calm. The aquarium is the focal point and its miniature looks right. Walk round the desk and plant; nothing snags.
- [ ] **Dive:** office → glass → tank and back. No jarring flash or exposure jump.
- [ ] **Tank:** fish anatomy and swimming read well up close. Corals look grown and plants bend gently. Ornaments look crafted; open the chest lid. A saved arrangement loads correctly.
- [ ] **Outer reef:** depth falls off into the blue. Sharks, rays, the turtle and the humpback look and move right, and coral colonies sit on their rocks.
- [ ] **Kelp forest:** a dense, curving, unsynchronised sway. Kelp parts round you, and the sand has ripples. Check the sea lion, otter and gull.
- [ ] **Shipwreck:** readable in its murky light.
- [ ] **Sea cave:** the sunbeam, the carved boulders and the crab legs.
- [ ] **Under the ice:** icebergs read as ice, and the seals, penguins, orca and minke look right.
- [ ] **Small life up close:** the brittle star, scallop, urchins and sea butterflies.
- [ ] **Performance:** smooth in every world. Note any world with stutter or long loads.
- [ ] **Reduced motion:** sway and flutter stop, and kelp still leans away from you.

## Recommendation

**Ready for the user's acceptance playthrough.**

- **Consistency:** the standard is applied consistently across every environment.
- **Geometry:** the major placeholder-like geometry is replaced.
- **Atmosphere:** lighting and atmosphere are coherent per world.
- **Budgets:** documented and within reason.
- **Regressions:** no known major visual or gameplay regression; all tests pass.

Accept V0.7 once the checklist passes on the MacBook Air. Schedule the remaining P1 items (the wreck hull and the coral thickets) either as acceptance fixes, if the playthrough flags them, or as early V0.8 polish.
