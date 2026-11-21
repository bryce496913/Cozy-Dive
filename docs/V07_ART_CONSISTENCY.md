# V0.7 final artistic consistency (Pass 080)

This is an integration pass under the approved **Crafted Stylized Realism** standard ([`ART_DIRECTION.md`](ART_DIRECTION.md), benchmark [`V07_STYLE_BENCHMARK.md`](V07_STYLE_BENCHMARK.md)). It reviewed every environment from the fixed V0.7 viewpoints and fixed the places where one world's materials, colour or placement broke from the shared style. Each world keeps its own geography and water.

**Out of scope, deliberately:**

- no global brightness, saturation, exposure, fog or water-profile changes;
- no bloom, particles or added postprocessing;
- no new assets, except two existing creature models re-exported because they were failing to load (below).

## Method

1. **Fixed views, before and after.** The same harnesses and cameras as every V0.7 pass: `validation/v07/office.mjs`, `baseline.mjs` (`COZY_OUTER=1`) and `worlds.mjs`. That is 6 office views, 7 tank views, 3 outer-reef views, and 3 kelp, 8 cave, 8 ice and 8 wreck views. The before set was rendered from a clean copy of `main` on its own dev server, so edits in progress could not leak into it.
2. **Material audit.** `worlds.html` gains `window.materials()`, and `worlds.mjs` writes every world's distinct materials into `worlds.json`. For each material it records roughness, metalness, normal strength, maps, vertex colour and triangle share. These are compared against the template ranges in [`tools/art/v07/standards.json`](../tools/art/v07/standards.json).
3. **Judged against the benchmark** on the eight axes the brief lists: roughness, normal intensity, palette, geometry style, lighting balance, density, scale, and foreground/background separation.

## Audit summary

| Environment       | Consistent with the benchmark                                                                                       | Mismatch found                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office            | Warm oak, walnut and cream palette; restrained gloss (glass and the lid only); the aquarium is its cool focal point | None. The miniature tank inherits the tank-rock tint fix, so office and tank stay one identity                                                                                                                                                     |
| Personal aquarium | Authored corals, plants and fish; triplanar limestone; clear aqua water                                             | **Palette and repetition:** the four rock tints were within a few percent of one white, so under the aqua light every boulder read as the same olive mound                                                                                         |
| Outer reef        | Carved reef rock, colonies, deep-blue falloff, wall silhouettes                                                     | None this pass; unchanged (Pass 077 coral)                                                                                                                                                                                                         |
| Kelp forest       | Stalks, canopy, sediment ripples, dressing                                                                          | **Flat material, geometry style:** the boulders, walls and tunnel had no surface maps at all (plain colour, roughness 0.96). They were the only rock in the game without the shared surface, and read as smooth plastic blobs                      |
| Shipwreck         | Plated hull, corrosion, murky teal light                                                                            | **Procedural regularity:** every growth kind was scattered uniformly over the whole ship, so the flanks read as an even sprinkle of stickers in horizontal bands                                                                                   |
| Sea cave          | Carved limestone boulders, sunbeam pool, encrusting life                                                            | **Palette:** the rocks heaped round both tunnel mouths used the ice world's dark basalt colouring and read as a ring of blue-slate rubble in a pale cave                                                                                           |
| Under the ice     | Cold profile, breathing-hole shafts, rich seabed                                                                    | **Gloss and lighting balance:** the ice was near-glassy (0.22 roughness) with a strong blue self-glow (emissive 0.55). Shadowed faces lifted to the lit ones, so icebergs read as glowing plastic and the far walls matched the near ones in value |
| Large animals     | Pass 078 sculpts read correctly at observation distance                                                             | **Not loading at all:** the sea lion and polar bear failed the loader's size check and showed their old procedural fallbacks in game (below)                                                                                                       |

The material audit found no metallic organics, no normal strengths above the templates, and no other unmapped large surfaces. Glossy materials appear only where gloss is an intended accent: eyes (0.08–0.22), the gelatinous animals, and office glass. Creature skins report metalness 1 because glTF defaults the factor to 1, but their ORM metal channel is 0, so they are effectively dielectric.

## Changes, and why each solves its issue

### 1. Kelp rock onto the shared rock surface

`src/environment/kelp/KelpEnvironment.ts`. The kelp boulders, walls and tunnel now use `HabitatSurface('limestone')`, the world-space triplanar surface (strata, warped grain, pores) that the cave and reef already use.

- **Kept:** the dark, coralline-encrusted tint and vertex mottling.
- **Roughness:** 0.9, inside the limestone template's 0.82–0.92.
- **Grain and relief:** a finer grain for close viewing (`KELP_ROCK_GRAIN`), and the template's full normal strength (0.8), because the default relief nearly vanishes on dark rock under the canopy's dim light.

**Why it works:** the rock now carries the same multi-scale relief as every other rock in the game, so the forest floor reads as one art team's stone rather than untextured blobs. Its geography is untouched: dark kelp-coast rock, not pale reef limestone. See `compare-kelp-rocks-close.jpg`.

### 2. Cave tunnel mouths in the cavern's own stone

`src/environment/shared/RockTube.ts` and `cave/CaveEnvironment.ts`.

- `mouthRocks` takes a base stone colour. Its default is still the ice world's basalt, so the ice tunnel is unchanged.
- The cave passes `CAVE_MOUTH_STONE`, its limestone boulders' tone under the `Cave limestone` tint, for both mouths.
- The back-tunnel collar's tone was raised to match.

**Why it works:** the mouths now belong to the cave they sit in. The residual teal at that distance is the cave's own water fog (atmospheric perspective), and the frost near the ice end is intended. See `compare-cave-back-tunnel.jpg`.

### 3. Ice: worn, wet ice instead of glowing plastic

`ice/IceEnvironment.ts` (`Ice`) and `ice/IceExtras.ts` (`Ice detail`):

- **Roughness:** 0.22 → 0.38, and 0.18 → 0.35 for the detail ice.
- **Self-glow:** emissive intensity 0.55 → 0.28 (0.6 → 0.3 for the detail ice).
- **Metalness:** 0.02 → 0. Ice is a dielectric.

**Why it works:** the glow had been doing the key light's job. With less of it, iceberg shadow sides now fall off and the masses model in light and shade. The softer sheen reads as wet ice rather than glass, and a faint cold translucence remains. This is a material response change, not a global brightness change: the water profile, beams and exposure are untouched. See `compare-ice-open-water.jpg`.

### 4. Wreck growth in colonies, not confetti

`wreck/ShipwreckModel.ts`. Each growth kind now settles in a few patches, about one per 14 colonies (larvae settle near their own kind). On top of that:

- about 30 % of the hull growth crowds the rail edge, where the current runs;
- 15 % stays loose;
- weathered plate shows between the colonies.

Counts, kinds, sizes, palettes and every clearance (hatches, bridge, gear) are unchanged.

**Why it works:** clumped, edge-loving growth is how real wrecks foul, and it gives the eye a hierarchy (busy patches, quiet plate) instead of uniform noise. This is tested with a Clark–Evans nearest-neighbour ratio: the old scatter measured 0.85 (near random), and the colonies measure below 0.8. See `compare-wreck-overview.jpg`.

### 5. Tank rock tints span the rock palette

`AuthoredReef.ts` `ROCK_TINTS`: warm beige, cool grey, pale sand, and a faint coralline pink, all at the same overall value.

**Why it works:** neighbouring boulders now separate by temperature, as the Pass 014 bible describes ("warm grey and beige mineral with cool-grey patches… sparse muted coralline pink"). No rock becomes a colour accent competing with the fish and corals. See `compare-tank-section-medium.jpg`.

### 6. Large animals actually load (bug fix)

The runtime loader measures each model the way three.js does: the rest box, expanded by each stroke morph's delta box, cumulatively. Two Pass 078 models failed that check and quietly fell back to procedural stand-ins:

| Animal     | Measured | Limit | Fix                                                                                                                                                                                                                                            |
| ---------- | -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sea lion   | 2.63 m   | 2.6 m | Re-sculpted at length 1.9 (2.28 m at rest); passes                                                                                                                                                                                             |
| Polar bear | 3.57 m   | 3.1 m | Re-sculpted at 1.9 (2.58 m at rest) with a calmer paddle; the four-leg stroke still sums to 3.57 m, so its registry envelope is 3.6 m. Its runtime scale is fixed (1), so the envelope only gates loading. The same issue was hit in Pass 052B |

`tests/large-creatures.test.ts` now replicates the loader's bounds exactly (the earlier per-stroke test missed both). Every morphed creature is checked, and the browser inventory reports no load errors.

## Performance

Draw calls and triangles are identical before and after in every captured view. For example:

| View           | Draws | Triangles |
| -------------- | ----- | --------- |
| kelp forest    | 58    | 3.05 M    |
| cave cavern    | 60    | 1.69 M    |
| ice open water | 79    | 2.61 M    |
| wreck overview | 76    | 1.33 M    |
| tank swim view | 144   | 1.06 M    |

The kelp rock gains three 256² maps, which are shared with its tunnel. Nothing else allocates.

These are SwiftShader captures. They show rendering and composition, not MacBook Air frame times.

## Gallery

All in `docs/screenshots/v07-pass080/`:

- **`gallery.jpg`:** the final matched views, two per environment (office, aquarium, outer reef, kelp, wreck, cave, ice).
- **`compare-*.jpg`:** before and after, from identical cameras on the fixed clock.

Visual acceptance remains the user's, on the target MacBook Air.

## Prioritised remaining concerns

**P1: visible during ordinary exploration**

1. **Cave pillars read faceted up close.** Each pillar shaft is a convex hull stretched about three times vertically, and the carve detail is already at maximum. It needs dedicated pillar geometry (a lofted, fluted column inside the same collider), not more subdivision.
2. **Ice walls and icebergs stay pale overall.** The gloss and glow are fixed, but the masses still share one value range with the seabed. Vertex-colour depth grading (darker, bluer low and far), or brine-channel and stratification detail in the ice maps, would deepen the hierarchy without fog.
3. **Kelp cobbles** are instanced and so still plain. The shared surface samples world position per mesh, so instanced triplanar sampling needs the instance matrix in the shader.

**P2: noticeable on inspection**

4. **Wreck seabed stones** are low-faceted hulls; they could use the carved limestone or rock family.
5. **Tank sand** is very bright near the glass in the swim view. Check it on the device before touching it: it is the tank's intended bright, clear look.
6. **Fine creature patterns** (whale-shark and eagle-ray spots) are vertex-colour limited (Pass 078).

**P3: polish**

7. **Cave limestone roughness** is 0.95–0.96, just above the 0.82–0.92 template. It reads correctly as dry, dusty stone; align it only if a matched review prefers it.
8. **Under-ice platelets** read as cream flakes from below; check them on the device.
