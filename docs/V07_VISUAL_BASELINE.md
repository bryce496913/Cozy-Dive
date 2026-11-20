# V0.7 visual baseline (Pass 061)

Pass 061 records how the game looks now, before the "Crafted Stylized Realism" art pass begins. It changes nothing in the game: no models, materials, lighting, simulation or behaviour. It adds a reusable benchmark (`validation/v07/`), fixed reference views of every water world, rendering statistics and an asset inventory. From these it ranks what most needs improving, by how often the player sees it during ordinary exploration.

Visual judgements in this document are an audit, not acceptance. The user decides whether the art is good enough.

## 1. Benchmark workflow

There are two harnesses. Both run against the dev server and capture fixed views with no UI.

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

```bash
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-baseline node validation/v07/baseline.mjs
```

```bash
COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-worlds node validation/v07/worlds.mjs
```

| Harness                                     | What it renders                                                                                                                                                                                                                                                                                                                                                                          | Output                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `validation/v07/baseline.mjs`               | The real game from a clean profile. It clicks **Dive In** and captures the seven **tank benchmark section** views. With `COZY_OUTER=1` it also swims the crevice into the outer reef (one passage; the whole run takes about 4 minutes under SwiftShader) for three outer views.                                                                                                         | `*.png`, `baseline.json` |
| `validation/v07/worlds.mjs` + `worlds.html` | A dev-only page that builds `KelpForestScene`, `SeaCaveScene`, `UnderIceScene` and `ShipwreckScene` in isolation, with the game's own renderer settings (ACES, sRGB, pixel ratio 1). It captures three views per world. It then acquires every `ASSET_REGISTRY` model and records its meshes, triangles, LOD triangles, materials, textures, maximum texture size, morphs and file size. | `*.png`, `worlds.json`   |

**Determinism**

- The app's own `requestAnimationFrame` loop is stopped. The harness ticks the game in identical fixed 1/15 s steps: 30 to settle after the dive, then 15 per view (45 per view in `worlds.html`).
- Fish, plants, lights and caustics are in the same state in every run. Fish in the isolated worlds also follow fixed steps.
- The camera is set from an eye point and a look-at point: yaw `atan2(-dx, -dz)`, pitch from the vertical angle, and velocity zeroed.
- The HUD, hints and buttons are hidden for the captures with an injected stylesheet. The game itself is unchanged.

**Environment variables**

| Variable          | Default                 | Meaning                                                             |
| ----------------- | ----------------------- | ------------------------------------------------------------------- |
| `COZY_URL`        | `http://127.0.0.1:5173` | Dev server URL.                                                     |
| `COZY_OUTPUT`     | `/tmp/v07-baseline`     | Output directory.                                                   |
| `COZY_SIZE`       | `960x600`               | Viewport size, `WxH`.                                               |
| `COZY_DPR`        | `1`                     | Device pixel ratio.                                                 |
| `COZY_PLAYWRIGHT` | `playwright`            | Playwright ESM entry.                                               |
| `COZY_CHROMIUM`   | —                       | Chromium executable.                                                |
| `COZY_OUTER`      | —                       | `1` adds the three outer reef views (`baseline.mjs` only).          |
| `COZY_WORLDS`     | all                     | Comma list from `kelp`, `cave`, `ice`, `wreck` (`worlds.mjs` only). |
| `COZY_INVENTORY`  | —                       | `0` skips the asset inventory (`worlds.mjs` only).                  |

**Reproducibility, checked.** Three `baseline.mjs` runs produced byte-identical screenshots for all seven tank views (same SHA-256), with identical draw-call and triangle counts. Pass 062 can therefore compare its after-shots against these hashes and images directly. Any difference reflects the change, not noise.

**Comparing a later pass**

1. Run the same commands on the new branch.
2. Diff the `hash` fields in the JSON. Unchanged hashes mean pixel-identical views.
3. Compare the PNGs side by side with the ones in `docs/screenshots/v07-pass061/`. Those copies are JPEG to save repository space. The hashes refer to the harness's own PNG output.

## 2. The tank benchmark section

The section is the back-left of the home aquarium, around the arch. It holds every requested element in one place:

- authored reef rocks: smooth boulders and a stacked-slab outcrop;
- a massive (brain) coral and a branching coral;
- a sea fan and a leather coral;
- turtle-grass seagrass, Halimeda, Caulerpa and red macroalgae;
- the moray in its den;
- the arch ornament;
- the chromis school, plus other existing tank fish passing through.

Positions are aquarium metres.

| View                         | Distance | Eye              | Look-at          | Shows                                                          |
| ---------------------------- | -------- | ---------------- | ---------------- | -------------------------------------------------------------- |
| `tank-section-swim`          | swimming | 1.5, 3.8, 3.0    | -6.5, 1.4, -5.5  | The whole section as the player first meets it after the dive. |
| `tank-section-medium`        | medium   | -2.6, 2.6, -2.2  | -6.5, 1.3, -6.0  | Rocks, arch, corals and seagrass together.                     |
| `tank-massive-coral-close`   | close    | -4.3, 1.9, -4.2  | -5.6, 1.3, -5.4  | Massive coral, rock surface.                                   |
| `tank-branching-coral-close` | close    | -4.0, 3.0, 1.3   | -5.5, 2.6, -0.2  | Branching coral, stacked slabs.                                |
| `tank-seagrass-close`        | close    | -6.0, 0.95, -0.9 | -7.5, 0.25, -2.8 | Seagrass blades, macroalgae, sand.                             |
| `tank-arch-moray-close`      | close    | -4.8, 1.9, -5.6  | -7.6, 1.1, -8.0  | Arch ornament, moray den.                                      |
| `tank-chromis-school`        | medium   | -1.0, 6.4, 0.6   | -1.8, 6.9, -4.0  | Authored fish (the quality reference), water colour.           |

The isolated world views use the same eye/look-at form. They are listed in `WORLD_VIEWS` in `validation/v07/worlds.mjs`. The outer views are in `OUTER_VIEWS` in `baseline.mjs`.

## 3. Baseline statistics

SwiftShader, 960×600, DPR 1. These are counts, not frame times. SwiftShader is a CPU rasteriser, so it says nothing about GPU speed. Draw calls and triangles are the numbers to compare between passes.

### Tank (real game)

Load to first ready: about 4.1–4.3 s on this container.

| View                       | Draw calls | Triangles | Geometries | Textures | Programs | Hash               |
| -------------------------- | ---------: | --------: | ---------: | -------: | -------: | ------------------ |
| tank-section-swim          |        151 | 1,068,575 |        362 |      112 |       74 | `f7932274fcfc543f` |
| tank-section-medium        |        113 |   907,266 |        390 |      112 |       79 | `0c7c0d58dec4e29f` |
| tank-massive-coral-close   |        102 |   904,772 |        390 |      112 |       79 | `8e051b19ac0e12f5` |
| tank-branching-coral-close |        120 | 1,109,135 |        390 |      112 |       79 | `ee603fb012e7b4dd` |
| tank-seagrass-close        |         94 |   917,024 |        390 |      112 |       79 | `f49f4ffcb74916bd` |
| tank-arch-moray-close      |         98 |   909,888 |        390 |      112 |       79 | `e02b472037739e81` |
| tank-chromis-school        |        125 |   997,720 |        390 |      112 |       79 | `dd78dc8ef9cd3d77` |

Geometry and texture counts include the office, which stays resident while the player is diving.

<!-- OUTER -->

### Other water worlds (isolated scenes)

| View             | Distance | Draw calls | Triangles | Geometries | Textures | Programs | Hash               |
| ---------------- | -------- | ---------: | --------: | ---------: | -------: | -------: | ------------------ |
| kelp-forest      | swimming |         59 | 2,413,102 |         82 |       72 |       25 | `05f4c38507f49386` |
| kelp-rocks-close | close    |         43 | 2,240,060 |         85 |       72 |       25 | `e752f7e1428ba272` |
| kelp-canopy      | medium   |         45 | 2,223,982 |         90 |       72 |       25 | `7aaf48ac7937598d` |
| cave-cavern      | swimming |         58 | 1,033,134 |         64 |       51 |       35 | `6b15371c06f7de8f` |
| cave-wall-close  | close    |         54 | 1,008,788 |         64 |       51 |       35 | `3459ecb1ba4c2a8e` |
| cave-sunbeam     | medium   |         57 | 1,005,826 |         64 |       51 |       35 | `3ba672c29fe5e845` |
| ice-open-water   | swimming |         83 | 1,796,597 |        112 |       87 |       31 | `ade21428d1cf7834` |
| ice-seabed-close | close    |         53 | 1,714,629 |        112 |       87 |       31 | `a769f249659a2cd2` |
| ice-underside    | medium   |         68 | 2,241,303 |        112 |       87 |       31 | `d6a251c5904e7d78` |
| wreck-overview   | swimming |         81 | 1,102,698 |        129 |      133 |       42 | `47d1bfda2deb0286` |
| wreck-deck       | medium   |         79 | 1,100,196 |        129 |      133 |       42 | `1e6113039b83fae9` |
| wreck-hull-close | close    |         51 | 1,067,264 |        129 |      133 |       42 | `1a4de0d43fda54d7` |

**Observations**

- **Kelp and ice carry the most triangles.**
  - Kelp is about 2.2–2.4 M per frame in only 43–59 draws: the instanced stalks and blades are dense.
  - The ice underside view is about 2.2 M.
  - Both are well above the tank (about 0.9–1.1 M).
  - Any added geometry in these two worlds should be paid for by simplifying the kelp blades or the ice ceiling first.
- **The tank has the most draw calls.** It uses about 94–151 draws, against 43–83 in the other worlds. This comes from many separate authored meshes: fish rigs, plants, ornaments and nudibranchs. Batching is the lever there, not triangles.
- **The wreck has the most textures** (133). This comes from the per-species fish and creature maps it shares with the outer reef.

### Asset inventory (46 models, 0 load errors)

| Group                                                                                   | Models | Body triangles |        LOD1 triangles | Textures (max size) |    File size each | Construction                                                                    |
| --------------------------------------------------------------------------------------- | ------ | -------------: | --------------------: | ------------------- | ----------------: | ------------------------------------------------------------------------------- |
| Reef environment (`reef`)                                                               | 1      |        581,441 |               100,805 | 21 (512)            |            6.1 MB | Blender (Pass 014): rocks, massive/branching corals, plants, rubble             |
| Anchored life (`anchored`)                                                              | 1      |        154,012 |                     — | 15 (512)            |            2.4 MB | Blender (Pass 013/015): anemone, fans, leather coral, seahorse, frogfish, moray |
| Reef props (`reefProps`)                                                                | 1      |        100,282 |                     — | 6 (512)             |            1.2 MB | Blender (Pass 013): ornaments, arch                                             |
| Acropora                                                                                | 1      |         82,416 |                     — | 3 (512)             |            0.8 MB | Blender                                                                         |
| Nudibranchs                                                                             | 1      |         32,533 |                     — | 3 (512)             |           0.55 MB | Blender (Pass 015)                                                              |
| Reef fish family (chromis rig)                                                          | 21     |         12,686 |           about 1,760 | 4 (512)             |      0.47–0.62 MB | Blender (Pass 016), shared rig, stroke morphs                                   |
| Big creatures (sharks, rays, turtle, whales, sunfish, otter, sea lion, gull, barracuda) | 15     |   5,256–14,516 |             840–2,322 | 3 (512)             |      0.33–0.86 MB | Blender (Pass 025/033/034/042–045)                                              |
| Ice animals (killer whale, minke, seals, penguins, polar bear)                          | 7      |   5,920–13,824 | **none** (LOD = body) | 3 (**128**)         | — (built in code) | Procedural loft (`IceAnimals.ts`, #108)                                         |

The file sizes in the inventory are on-disk GLBs; the seven procedural ice animals have no file. Total authored model payload is about 30 MB.

## 4. Environment audit

Each element is classified by **quality** (good / fair / weak), **prominence** (how much of ordinary exploration it fills) and **construction** (authored GLB, or procedural code).

### Home aquarium (tank)

| Element                                | Construction                                                      | Prominence                                      | Quality   | Notes                                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reef rocks                             | Authored (`reef`, `Rock_*`, box-projected UVs)                    | **Very high**: the first and largest thing seen | **Weak**  | Smooth, rounded "potato" boulders with no overhangs, ledges or erosion. One outcrop is flat slabs stacked like a cairn. The PBR maps are present, but the forms read as primitives. |
| Massive coral                          | Authored (`Coral_Massive_*`, lobes)                               | High                                            | **Weak**  | The lobes read as one ball sitting on another. There is no skirt into the rock and no contact with the substrate.                                                                   |
| Branching coral                        | Authored (`Coral_Branching_*`)                                    | High                                            | Fair/weak | A dark violet antler with uniform tube thickness and no branch taper or tip colour. It sits dark in the haze.                                                                       |
| Acropora table, sea fan, leather coral | Authored                                                          | Medium                                          | Fair      | Acceptable silhouettes. The fan is crisp.                                                                                                                                           |
| Turtle grass / seagrass meadow         | Authored blade templates, procedural placement (`MeadowSystem`)   | High                                            | **Weak**  | Flat, uniform, saturated green ribbons that look plastic. Blade width and colour do not vary, and there is no tip browning or epiphytes.                                            |
| Halimeda, Caulerpa                     | Authored                                                          | Medium                                          | Weak      | They read as green grape chains.                                                                                                                                                    |
| Red macroalgae                         | Authored                                                          | Low                                             | Weak      | Thin wires.                                                                                                                                                                         |
| Sand                                   | Procedural floor                                                  | **Very high**                                   | Weak      | Bright, flat and almost featureless. Rubble barely shows.                                                                                                                           |
| Arch ornament                          | Authored (`reefProps`)                                            | Medium                                          | Fair      | A good silhouette. It is slightly smooth for a "crafted" look.                                                                                                                      |
| Chromis and the reef fish family       | Authored rig (Pass 016)                                           | High                                            | **Good**  | The quality reference: shaped fins, PBR skin, morph swimming.                                                                                                                       |
| Anemone, nudibranchs, moray, seahorse  | Authored (Pass 015)                                               | Medium                                          | Good      | Keep.                                                                                                                                                                               |
| Water colour and lighting              | `UnderwaterScene` (ACES, three-light rig, fog, flat shaft planes) | **Every frame**                                 | **Weak**  | A milky, low-contrast cyan haze flattens every material at medium distance. The light-shaft planes read as flat sheets. There is little shadowing under rocks, so objects float.    |

### Outer reef

| Element                | Construction                                                | Prominence | Quality   | Notes                                                                          |
| ---------------------- | ----------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------ |
| Wall and reef top      | Procedural terrain + triplanar material with ridges (#108)  | Very high  | Fair      | It reads as rock from a distance; at close range the ridge pattern is regular. |
| Reef-top coral         | Reef library instances (the tank's authored corals, reused) | High       | Weak/fair | It inherits the tank's coral weaknesses and repeats visibly over a large area. |
| Schools, big creatures | Authored                                                    | High       | Good/fair | Fine at the distances they are seen.                                           |
| The blue               | Fog/darkness                                                | High       | Good      | The bottomless feel the user asked for. Keep.                                  |

### Kelp forest

| Element                      | Construction                         | Prominence                      | Quality   | Notes                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------ | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giant kelp stalks and blades | Procedural (`KelpStalks`, instanced) | **Very high**: fills every view | **Weak**  | Faceted, flat-shaded yellow triangles. The blades are stiff paper with no translucency, ruffle or gas-bladder detail. This is also the heaviest geometry in the game (about 2.4 M triangles). |
| Boulders                     | Procedural                           | High                            | **Weak**  | Smooth, dark, featureless domes, the same "potato" problem as the tank.                                                                                                                       |
| Anemones on rocks            | Procedural                           | Medium                          | Weak      | They read as cylinders with spikes.                                                                                                                                                           |
| Urchins, sea stars           | Procedural                           | Medium                          | Fair      | Readable. The urchins are good at distance.                                                                                                                                                   |
| Seabed                       | Procedural                           | High                            | Weak      | Flat beige; pebbles are pasted ellipsoids.                                                                                                                                                    |
| Harbour seal, bat ray        | Authored                             | Medium                          | Fair      | Early Blender models.                                                                                                                                                                         |
| Light                        | `KelpLight`, sun shafts              | High                            | Fair/good | A good mood: green water and one sunbeam.                                                                                                                                                     |

### Sea cave

| Element                          | Construction                | Prominence            | Quality  | Notes                                                                                      |
| -------------------------------- | --------------------------- | --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Boulders                         | Procedural                  | High                  | **Weak** | Rounded and faceted, with flat light-grey tops.                                            |
| Rock ring / arch in the cavern   | Procedural stacked boulders | High: the focal point | **Weak** | A ring of spheres. This is the clearest example of stacked-primitive geometry in the game. |
| Sand ripples                     | Procedural                  | High                  | Good     | Keep.                                                                                      |
| Sunbeam from the opening         | `SeaCaveScene`              | High                  | **Good** | The best light in the game. Keep it as the reference for shafts.                           |
| Encrusting life, crabs, lobsters | Procedural                  | Medium                | Fair     | Small but readable.                                                                        |
| Cave walls (wall-close view)     | Procedural                  | High                  | Weak     | Dark, low-contrast surfaces. The visible beam is a flat translucent band.                  |

### Under the ice

| Element                                          | Construction             | Prominence          | Quality  | Notes                                                                                                                                   |
| ------------------------------------------------ | ------------------------ | ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Glass/barrel sponges                             | Procedural (`IceGarden`) | High                | **Weak** | Faceted vases with visible flat triangle facets and uniform grey-green colour. They look plastic.                                       |
| Ice walls and ceiling                            | Procedural               | **Very high**       | Weak     | Large blocky facets.                                                                                                                    |
| Light shafts                                     | Cone meshes              | High                | **Weak** | Hard-edged cones with visible base discs on the seabed.                                                                                 |
| Soft corals, sea stars, sea spiders              | Procedural               | Medium              | Fair     | Readable. The sea spider legs are straight rods.                                                                                        |
| Seabed                                           | Procedural ripples       | High                | Fair     | Even.                                                                                                                                   |
| Killer whale, minke, seals, penguins, polar bear | Procedural loft (#108)   | Medium (encounters) | Fair     | A big step up from the old blobs. Skin textures are only 128 px, and there is no lower-detail model (the LOD triangles equal the body). |

### Shipwreck

| Element                            | Construction                            | Prominence    | Quality   | Notes                                                                                                                                                           |
| ---------------------------------- | --------------------------------------- | ------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hull, superstructure and deck      | Procedural (`ShipwreckModel`)           | **Very high** | **Weak**  | The superstructure is boxy with flat panels and plain bevels. The deck is flat and clean, with no plating, rot or sediment.                                     |
| Hull growth (corals, fans, plates) | Procedural (`WreckGrowth`, taperedTube) | High          | Fair/weak | Good variety and silhouettes. At close range against the dark hull, pieces read as floating stickers: there is no shared base, encrustation or contact shading. |
| Deck gear                          | Procedural                              | Medium        | Weak      | Simple cylinders and boxes.                                                                                                                                     |
| Fish, groupers, rays, sharks       | Authored                                | High          | Good      | The Yongala life reads well.                                                                                                                                    |
| Water and visibility               | Fog 0.085                               | High          | Good      | The mystery the user asked for. Keep.                                                                                                                           |

## 5. Most visible examples by category

| Category                            | Most visible examples (most visible first)                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitive or stacked geometry       | Cave rock ring; tank stacked-slab outcrop; tank massive coral "ball on ball"; wreck superstructure boxes; kelp and cave boulders.                                                                 |
| Oversimplified anatomy              | Kelp blades (flat paper triangles); ice sea spiders (rod legs); kelp anemones (cylinders); the early Blender seals and sea lion (smooth tubes); procedural ice animals at 128 px skin.            |
| Flat or plastic materials           | Tank seagrass; ice glass sponges; tank sand; kelp seabed; wreck deck.                                                                                                                             |
| Unconvincing plants and corals      | Tank seagrass; Halimeda/Caulerpa grape chains; tank branching coral; red algae wires; wreck growth floating on the hull.                                                                          |
| Repetitive procedural scenery       | Kelp stalk forest (identical silhouettes in rows); outer reef-top coral instances; ice sponge fields; tank and kelp pebble scatter.                                                               |
| Lighting and colour inconsistencies | Tank milky low-contrast haze, set against the high-contrast cave and wreck; flat shaft planes in the tank; hard ice cones with seabed discs; little contact shading under objects in every world. |
| Weak close-up detail                | Tank rock surfaces (smooth at 1 m); kelp boulders; wreck hull and deck; ice sponges at 2 m.                                                                                                       |

## 6. Ranked visual-improvement inventory

Rank = how much of ordinary exploration it affects × how weak it is now. The tank comes first because every session starts there.

| Rank | Item                                                                               | World                             | Construction now                    | Why it ranks here                                          | Suggested pass direction                                                                                                              |
| ---: | ---------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Reef rocks: boulders and the stacked-slab outcrop                                  | Tank (+ outer reef, where reused) | Authored GLB                        | The largest, most-seen surfaces; read as primitives        | Re-sculpt in Blender with eroded, overhanging, layered forms; keep colliders and positions.                                           |
|    2 | Water colour, haze and light shafts                                                | Tank                              | `UnderwaterScene`                   | Affects every frame; flattens every material               | Measured tuning of fog and contrast; replace flat shaft planes with softer volumes (as in the cave) — needs before/after measurement. |
|    3 | Massive and branching corals                                                       | Tank, outer reef                  | Authored GLB                        | Focal points of the section; stacked lobes, uniform antler | New Blender forms with skirts into the substrate, taper and tip colour; keep LOD1.                                                    |
|    4 | Seagrass and macroalgae                                                            | Tank                              | Authored templates + `MeadowSystem` | Large area near the floor; plastic ribbons                 | Varied blade width, curl and colour gradient, epiphyte specks; vary the grape-chain algae.                                            |
|    5 | Sand and substrate                                                                 | Tank, kelp                        | Procedural                          | Fills the lower half of most views                         | Ripple/normal detail and rubble variation like the cave sand; contact darkening under objects.                                        |
|    6 | Giant kelp blades and stalks                                                       | Kelp                              | Procedural, instanced               | Whole world; also the heaviest geometry                    | Rebuild with fewer, better blades (ruffled, translucent, pneumatocysts); recover triangles.                                           |
|    7 | Boulders                                                                           | Kelp, cave                        | Procedural                          | Very common; potato forms                                  | Share an improved rock generator (or the new tank rock set) across worlds.                                                            |
|    8 | Wreck hull, deck and superstructure                                                | Wreck                             | Procedural                          | The whole world is the ship                                | Plating, rivet lines, rust and sediment gradients; break up boxes; give growth a shared encrusted base.                               |
|    9 | Glass sponges, ice walls and light cones                                           | Ice                               | Procedural                          | Fills the ice views                                        | Smooth-shaded sponge walls with lattice texture; soft shaft volumes without base discs; less faceted ice.                             |
|   10 | Cave rock ring                                                                     | Cave                              | Procedural                          | A focal point, but in one world                            | Replace the ring of spheres with a single eroded arch.                                                                                |
|   11 | Outer reef-top coral repetition                                                    | Outer reef                        | Library instances                   | Wide but seen at distance                                  | Follows rank 3, plus more variants per instance.                                                                                      |
|   12 | Early Blender creatures (seals, sea lion, otter, bat ray) and the ice animal skins | Kelp, ice                         | Authored / procedural               | Encounters, not constant                                   | Upgrade the skins (256–512 px) and add LOD1s to the procedural ice animals.                                                           |

## 7. Preserve or adapt

**Preserve as they are (the quality bar)**

- The chromis rig and the 21-species reef fish family (Pass 016): about 12.7 k triangles, four PBR maps, LOD1 at about 1.76 k, and the stroke morphs driving `PosedFish`.
- Anchored life and nudibranchs (Pass 013/015): the anemone, seahorse, frogfish, moray and nudibranch library.
- The acropora table and the arch ornament.
- The cave sunbeam and sand ripples: the lighting reference for the other worlds.
- The kelp light mood, the outer reef's blue darkness and the wreck's limited visibility. The user has asked for these; keep them.

**Adapt, rather than replace**

- **`Triplanar.ts`:** the triplanar rock material with ridge bump. It is the right tool for terrain, but the ridge pattern needs breaking up with a second, irregular frequency.
- **The asset pipeline:** `tools/art/pass014/reef_geometry.py` (rocks, corals and plants as Blender assets with LOD1) and its texture authoring. Rebuild the rock and coral forms in it, rather than writing a new pipeline.
- **`WreckGrowth.ts`:** taperedTube corals and lattice fans. The forms are good; add bases and encrustation.
- **`IceAnimals.ts`:** the loft builder. Keep the body construction, but raise the skin resolution and add a lower-detail model.
- **`MeadowSystem`:** placement and density gradients are good; only the blade templates need work.
- **`HabitatSurface` placement and `validateAsset`:** these keep any new assets consistent (nodes, UVs, PBR maps, dimensions).

**Shader inventory**

- All worlds use the standard `MeshStandardMaterial`/PBR path, the triplanar terrain material, fog and ACES tone mapping. They use no postprocessing.
- The improvement list above does not need a new rendering architecture.
- The only shader work suggested is the shaft volumes (rank 2/9), which must be measured before adoption.

## 8. Limitations

- **Software rendering:**
  - Captures use SwiftShader in a headless container. The numbers are draw calls, triangles and resource counts, not frame times. No hardware GPU was measured.
  - Colours can differ slightly from a hardware GPU. Compare against these images only with the same harness.
- **Isolated worlds:**
  - The kelp, cave, ice and wreck views are built in isolation on `worlds.html`, not reached by swimming. Lighting, fog and life are the worlds' own.
  - The passage approach and the tank-to-world transition are not in these shots.
  - Their fish placement is deterministic for the fixed steps but is not reached through the game's save state.
- **Outer reef:** the outer views need one passage swim. That adds a few minutes of software rendering, so it is opt-in (`COZY_OUTER=1`).
- **Tank only:** the reproducibility check (three identical runs) was done for the tank views. The world harness uses the same fixed-step method.
- **Office:** the office was not audited. V0.7 is about the water worlds.
