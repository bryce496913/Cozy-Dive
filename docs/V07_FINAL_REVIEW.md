# V0.7 Crafted Stylized Realism: final review (Pass 088)

Base: main after Pass 087. This is a review pass: no game code changed. It compares the current
build with the original Pass 061 baseline at identical viewpoints, uses the approved Pass 082 tank
benchmark as the quality reference, audits every asset family up close, and measures costs.

**V0.7 is not marked complete.** Acceptance is the user's decision, after the playthrough.

## 1. How the evidence was made

`validation/v08/final-review.sh` captures everything below from the current build:

- the real game for the tank and outer reef, through the actual crevice swim;
- the isolated world scenes for kelp, wreck, cave and ice;
- the shipped GLBs, through the game's loader, for every studio.

Settings: SwiftShader, 960×600, DPR 1, fixed simulation clock.

| Gallery   | Contents                                                                                                                                                                                   | Location                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Scenes    | All 22 Pass 061 views. Pass 061 beside now; for the four tank views, the Pass 082 benchmark at the same camera sits between them                                                           | `docs/screenshots/v08-pass088/scenes/` |
| Creatures | 13 animals × side, ¾, head, top and mid-stroke: hammerhead, great white, reef shark, whale shark, eagle ray, manta, turtle, harbour seal, sea lion, polar bear, humpback, minke, sea otter | `…/creatures/`                         |
| Close-ups | Fish roster; corals and reef growth; plants; ornaments; small life (nudibranchs, crustaceans, echinoderms, gelatinous animals, seahorse, frogfish, moray, anemone), each side and ¾        | `…/closeups/`                          |

Earlier per-pass galleries (Passes 082–087) hold the before/after detail for individual changes.

## 2. Verdict by environment

Scored against the Pass 082 benchmark:

- matte, relieved materials;
- biology in large readable masses;
- grounded forms;
- warm key, cool rim;
- calm reads at every distance.

| Environment       | Improvement over Pass 061                       | Meets the Pass 082 benchmark?                                                              | Evidence and notes                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aquarium**      | **Substantial**                                 | **Yes.** It is the benchmark: the rest of the tank (Pass 083) matches the Pass 082 section | Rounded green mounds became carved, porous rock with grounded colonies and clustered vegetation (`tank-section-swim`, `tank-massive-coral-close`). The stacked rounded boundary stones along the back glass are unchanged from Pass 061.                                                                                              |
| **Under the ice** | **Substantial**                                 | **Mostly.** Ice masses yes; seabed rocks no                                                | Sculpted, matte bergs and soft layered shafts replace faceted blocks and hard beam cones (`ice-open-water`). Below standard: the dark dropstones and outcrops (smooth faceted lumps); the breathing-hole rims (a jagged sawtooth crown, unchanged since Pass 061); the under-ice platelets (cream starbursts).                        |
| **Shipwreck**     | **Moderate**                                    | **Partly**                                                                                 | The hull reads weathered and colonised, with the growth integrated. The superstructure is still boxy, and the deck view is sparser and duller than at Pass 061 (`wreck-deck`).                                                                                                                                                        |
| **Kelp forest**   | **Moderate**                                    | **Partly**                                                                                 | Curved, ruffled blades and a new seal sculpt (`kelp-forest`). The boulders are almost unchanged: smooth ovoids with one tint (`kelp-rocks-close`). A blade seen within a metre is a flat, untextured card.                                                                                                                            |
| **Sea cave**      | **Moderate**                                    | **Partly**                                                                                 | Sculpted tunnel arches and cave life. The carved boulders and pillars read low-poly up close, and `cave-wall-close` is now dominated by a faceted pillar. The walls and the seabed under the light shaft were never reworked.                                                                                                         |
| **Outer reef**    | **Better up close; worse at swimming distance** | **Up close yes; at distance no**                                                           | Pass 085's variants are on the standard at close range (`outer-coral-close`). At the Pass 061 swimming views the reef now reads less clearly than the baseline (`outer-reef-top`): the outer murk was raised by a playtest hotfix (`OUTER.fog` 0.13, about 96% haze by 14 m) to hide detail-level changes, and it hides the reef too. |
| **Office**        | Done in Pass 075; not re-reviewed here          | Yes (Pass 081 review)                                                                      | —                                                                                                                                                                                                                                                                                                                                     |

## 3. Asset families

| Family                           | Verdict                                                                         | Objective defects (measurable or visible in the galleries)                                                                                                                                                                        | Subjective notes                                                               |
| -------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Sharks**                       | On standard                                                                     | The thin trailing edges of pectoral and caudal fins are sawtooth-jagged at close range, a voxel staircase from the sculpt (great white, reef shark, whale shark)                                                                  | Hammerhead cephalofoil scalloping is subtle                                    |
| **Rays**                         | On standard                                                                     | Jagged trailing wing edges (manta); polygonal spot markings (eagle ray), a vertex-colour resolution limit                                                                                                                         | —                                                                              |
| **Whale shark**                  | Near standard                                                                   | Spots are angular polygons, the same vertex-colour limit                                                                                                                                                                          | —                                                                              |
| **Turtle**                       | On standard                                                                     | —                                                                                                                                                                                                                                 | —                                                                              |
| **Seals, sea lion**              | On standard                                                                     | —                                                                                                                                                                                                                                 | Sea lion head is a little flat                                                 |
| **Humpback**                     | On standard                                                                     | Pectoral leading-edge tubercles are slightly jagged                                                                                                                                                                               | —                                                                              |
| **Polar bear**                   | Below standard                                                                  | —                                                                                                                                                                                                                                 | Reads as a plush toy: tube-like legs, little head structure                    |
| **Minke whale, sea otter**       | Below standard                                                                  | Still the lofted Pass 068 models. The otter's eyes are flat polygonal patches                                                                                                                                                     | —                                                                              |
| **Fish (21 on the chromis rig)** | Mixed                                                                           | (1) Most species share one rounded body plan, so damsel, tang, parrotfish and grouper have nearly the same silhouette. (2) The skin detail map reads as woven fabric up close; Pass 084 fixed this on the creatures, not the fish | Colour patterns are clean and appealing                                        |
| **Corals (Blender)**             | On standard                                                                     | —                                                                                                                                                                                                                                 | —                                                                              |
| **Code-built reef growth**       | Below standard                                                                  | Tube and barrel sponges are plain cylinders and lathes; encrusting plates are featureless extrusions; several plating corals in the library still stand on mushroom stalks                                                        | Untinted in the studio; they take instance colours in game                     |
| **Plants (Pass 083)**            | On standard                                                                     | —                                                                                                                                                                                                                                 | Halimeda clusters are somewhat blobby                                          |
| **Ornaments**                    | On standard                                                                     | —                                                                                                                                                                                                                                 | Arch blocks slightly regular                                                   |
| **Small life**                   | Mixed                                                                           | —                                                                                                                                                                                                                                 | Nudibranchs and echinoderms are good. The ice sea spider's legs are plain rods |
| **Rocks**                        | Tank, outer and cave arches on standard; kelp boulders and ice dropstones below | See the environments                                                                                                                                                                                                              | —                                                                              |

**Studio artefact, not a defect:** the seahorse's tail and the frogfish's jaw show detached in the
small-life studio. They are separate animated parts, posed at runtime by `AuthoredAquarium.ts` and
`Frogfish.ts`, and the studio shows their raw rest positions. In game they are joined; the frogfish
was checked in the Pass 083 `aqua-frogfish` view. The seahorse was not checked in game here.

## 4. Acceptance criteria

| Criterion                                                        | Status                                                                                                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear, substantial visual improvement over the original baseline | **Met** for the tank, under-ice, creatures and corals. **Moderate** for kelp, wreck and cave. **Not met** for the outer reef at swimming distance (see the fog note). |
| Environments meet the Pass 082 benchmark                         | **Met** in the aquarium. **Partly met** in every other world (section 2).                                                                                             |
| Creatures: convincing anatomy, materials, movement               | **Met** for sharks, rays, turtle, seals and humpback. **Not met** for the polar bear, minke and otter. Fish anatomy is limited by the shared body.                    |
| Procedural placeholder geometry no longer dominant               | **Met** in the tank and ice open water. **Not met** in the kelp boulder fields and the cave close-ups.                                                                |
| Composition feels deliberate                                     | **Met** in the tank, ice and wreck. Weak in the outer reef midground (murk).                                                                                          |
| No major art-related gameplay regressions                        | **Met.** The targeted collision, spawn, loading and scene suites pass, and every gallery view rendered with 0 errors.                                                 |
| Performance appropriate for desktop browsers                     | **Plausible, not measured on hardware.** Draw calls held or fell everywhere, but triangles rose in four worlds (section 5).                                           |

## 5. Performance and resources

Fixed views, SwiftShader. These are counts, not frame times; no hardware GPU was measured.

| View                       | Draws 061 → now | Triangles 061 → now  | Geometries | Textures  | Programs |
| -------------------------- | --------------- | -------------------- | ---------- | --------- | -------- |
| tank-section-swim          | 151 → 147       | 1.07 → 1.28 M (+20%) | 362 → 431  | 112 → 123 | 74 → 77  |
| tank-section-medium        | 113 → 103       | 0.91 → 1.09 M (+20%) | 390 → 459  | 112 → 123 | 79 → 82  |
| tank-massive-coral-close   | 102 → 90        | 0.90 → 0.98 M (+8%)  | 390 → 459  | 112 → 123 | 79 → 82  |
| tank-branching-coral-close | 120 → 106       | 1.11 → 1.22 M (+10%) | 390 → 459  | 112 → 123 | 79 → 82  |
| tank-seagrass-close        | 94 → 94         | 0.92 → 1.12 M (+22%) | 390 → 459  | 112 → 123 | 79 → 82  |
| tank-arch-moray-close      | 98 → 87         | 0.91 → 0.97 M (+7%)  | 390 → 459  | 112 → 123 | 79 → 82  |
| tank-chromis-school        | 125 → 126       | 1.00 → 1.09 M (+10%) | 390 → 459  | 112 → 123 | 79 → 82  |
| outer-reef-top             | 124 → 127       | 3.80 → 2.91 M (−23%) | 503 → 576  | 241 → 274 | 93 → 97  |
| outer-coral-close          | 126 → 117       | 3.98 → 3.01 M (−24%) | 507 → 580  | 241 → 274 | 93 → 97  |
| outer-wall-lip             | 123 → 114       | 4.11 → 3.14 M (−24%) | 509 → 582  | 243 → 276 | 93 → 97  |
| kelp-forest                | 59 → 60         | 2.41 → 3.30 M (+37%) | 82 → 81    | 72 → 85   | 25 → 28  |
| kelp-rocks-close           | 43 → 46         | 2.24 → 3.15 M (+41%) | 85 → 84    | 72 → 85   | 25 → 28  |
| kelp-canopy                | 45 → 48         | 2.22 → 3.13 M (+41%) | 90 → 89    | 72 → 85   | 25 → 28  |
| wreck-overview             | 81 → 79         | 1.10 → 1.39 M (+26%) | 129 → 110  | 133 → 125 | 42 → 41  |
| wreck-deck                 | 79 → 78         | 1.10 → 1.39 M (+27%) | 129 → 110  | 133 → 125 | 42 → 41  |
| wreck-hull-close           | 51 → 51         | 1.07 → 1.36 M (+28%) | 129 → 110  | 133 → 125 | 42 → 41  |
| cave-cavern                | 58 → 61         | 1.03 → 1.70 M (+65%) | 64 → 91    | 51 → 73   | 35 → 37  |
| cave-wall-close            | 54 → 54         | 1.01 → 1.66 M (+64%) | 64 → 91    | 51 → 73   | 35 → 37  |
| cave-sunbeam               | 57 → 59         | 1.01 → 1.67 M (+66%) | 64 → 91    | 51 → 73   | 35 → 37  |
| ice-open-water             | 83 → 79         | 1.80 → 2.84 M (+58%) | 112 → 135  | 87 → 118  | 31 → 34  |
| ice-seabed-close           | 53 → 53         | 1.71 → 2.76 M (+61%) | 112 → 135  | 87 → 118  | 31 → 34  |
| ice-underside              | 68 → 67         | 2.24 → 3.22 M (+44%) | 112 → 135  | 87 → 118  | 31 → 34  |

- **Draw calls:** held or fell in every world; the maximum is 147, in the tank.
- **Triangles:**
  - **Heaviest views:** the kelp forest (3.30 M; Pass 085's blades added geometry where Pass 061 had recommended recovering it), the ice ceiling (3.22 M) and the outer reef (3.14 M). The outer reef fell by a quarter.
  - **Cave:** +65%, from Pass 079 pillars and life and Pass 086 arches.
- **Textures:** up 11–33 per world. The code-built 256 px surfaces are about 1 MB each with mips.
- **Downloads:** 50 models, **45.95 MB** (Pass 061: 46 models, 33.1 MB; Pass 081: 47 models, 37.7 MB).
  - The growth is mostly the sculpted reef sets: `reef-environment` 5.9 MB, `reef-habitat` 5.5 MB, `reef-benchmark` 1.7 MB.
  - Authored triangles total 2.58 M.
  - **Budget headroom:** the packaged download sits at 43.8 MiB against the 44 MiB budget in `fish-lod-compression.test.ts`, so there is almost none left.
- **World builds** (Node, this container): ice 1.1–1.2 s (Pass 086 measurement); the others unchanged.

## 6. Tests and checks

- **Checks:** typecheck, lint and build pass.
- **Targeted asset and scene suites:** 32 files, 413 tests, all passing:
  - `art-consistency`;
  - `asset-lifecycle`, `asset-loading`, `asset-production`, `asset-validation`;
  - `big-creatures`;
  - `coral-colonies`, `coral-overhaul`;
  - `creature-assets`, `creature-refinement`;
  - `fish-assets`, `fish-lod-compression`, `fish-render-bounds`;
  - `habitat-assets`, `hero-fish`;
  - `ice-life`, `kelp-forest`, `large-creatures`, `ornaments`;
  - `outer-draw-distance`, `outer-kelp-overhaul`, `outer-reef`;
  - `reef-benchmark`, `reef-environment`, `reef-habitat`;
  - `remaining-environments`;
  - `sea-cave`, `shipwreck`, `shipwreck-overhaul`;
  - `under-ice`, `vegetation`, `wreck-loading`.
- **Browser smoke:** the review captures were the smoke test. The real game loaded, dived and swam through the crevice into the outer reef; the four isolated worlds built; and the fish, creature, coral, plant, ornament and small-life studios loaded every model through the game's loader. All with **0 page errors**.
- **Not run, per the policy:** no multi-hour stress tests and no automated full-world traversal.

## 7. MacBook Air playtest checklist

Default settings first, then repeat with reduced motion on. Note the world and the spot for anything
that falls short.

**Look**

- [ ] **Tank:** rocks porous and grounded; corals grown, not placed; fish anatomy at close range. Do the stacked back-glass stones look out of place?
- [ ] **Outer reef:** from the crevice and across the reef top, can you see the reef's forms, or only blue shapes? This decides the fog question (decision 1).
- [ ] **Kelp:** do the boulders read as stone? Swim into a blade: is the flat card noticeable?
- [ ] **Wreck:** does the hull read weathered and colonised? Is the deck too bare? Is the hold too dark?
- [ ] **Cave:** are the tunnel arches natural? Are the pillars and boulders acceptably faceted up close?
- [ ] **Ice:** bergs matte and frosted; breathing-hole rims; dropstones. Compare the polar bear, minke and otter with the other animals.
- [ ] **Animals at close range:** shark and ray fin edges (jagged?), whale shark spots, fish skin (fabric?).

**Feel**

- [ ] **Smoothness:** the kelp forest, ice ceiling and outer reef (the heaviest views) while turning and swimming.
- [ ] **Passages:** no long hitch at passage swaps; note the load times.
- [ ] **Heat:** note the fan and heat after about 15 minutes.
- [ ] **Swimming:** no snags on the new arches, ice forms or wreck rocks; collected animals and saved tanks reload.

## 8. Remaining issues, ranked

| #   | Issue                                                                            | Type                                              | Severity                         |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| 1   | Outer reef unreadable at swimming distance (murk hotfix, `OUTER.fog` 0.13)       | Objective (legibility regression versus Pass 061) | High; needs a decision           |
| 2   | Fish share one body plan; fabric-like skin map                                   | Objective                                         | High (fish are always on screen) |
| 3   | Kelp boulders: smooth, one tint; blades flat up close                            | Objective                                         | Medium-high                      |
| 4   | Cave boulders and pillars low-poly up close; walls and shaft seabed not reworked | Objective                                         | Medium                           |
| 5   | Polar bear toy-like; minke and otter still Pass 068 lofts                        | Objective (minke, otter); subjective (bear)       | Medium                           |
| 6   | Ice dropstones and outcrops, breathing-hole sawtooth rims, platelets             | Objective                                         | Medium                           |
| 7   | Jagged fin and wing trailing edges; polygonal spot markings                      | Objective                                         | Medium-low (close range only)    |
| 8   | Code-built reef growth (plain tube and barrel sponges, plate stalks)             | Objective                                         | Medium-low                       |
| 9   | Wreck superstructure boxy; deck sparser since Pass 086/087                       | Objective (boxy); subjective (sparse)             | Low                              |
| 10  | Tank back-glass stacked stones unchanged since Pass 061                          | Objective                                         | Low                              |
| 11  | Download at 43.8 of 44 MiB; kelp the heaviest view at 3.3 M triangles            | Measurement                                       | Watch                            |

## 9. Recommendation

**Do not declare the Crafted Stylized Realism overhaul complete yet.** The improvement is real and
large where most time is spent:

- the aquarium meets the benchmark;
- the ice open water, the sharks, rays, turtle, seals and corals are clearly better.

But the standard is not met evenly. The outer reef reads worse at swimming distance than at
Pass 061, and kelp, cave and wreck are only partly at the benchmark.

**Recommended path:**

1. Run the MacBook Air playthrough with the checklist above.
2. **Decide the outer-reef murk:** keep it, or lower `OUTER.fog` to about 0.11 and move the far
   detail levels out. This is the single change with the largest visible effect.
3. **Decide scope:** close V0.7 with issues 2–11 deferred to V0.8 as listed, or address issues 1–3
   first, then close.

V0.7 stays open until the user approves.
