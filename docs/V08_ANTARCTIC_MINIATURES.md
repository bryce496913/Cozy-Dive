# V0.8 Pass 105 — Antarctic's Three Rare Miniature Discoveries

Base: merged Pass 104, main `28296ea` (PR #158). Three persistent, repeatable encounters in the existing Antarctic habitat. Ice holes, tunnel geometry, passage navigation, dense fog, lighting and existing large-animal behaviour are unchanged.

## Identity audit and saved collections

The existing `species:sea-angel` and `species:giant-isopod` records already belonged to Antarctica. Their earlier procedural forms did not specify scientific identities. This pass upgrades those same records to **Clione antarctica** and **Glyptonotus antarcticus**, replacing their live procedural populations and preserving sighting IDs, tank keys, first-seen dates and album orders 0 and 16. It does not introduce a second generic sea angel or a second isopod. Other related animals (sea butterflies, salps, jellyfish, sea spiders and benthic fauna) retain their records.

**Tritoniella belli** receives the new `species:tritoniella-belli` record at order 32. All three are rare Antarctic cards and collectible after discovery. The Antarctic page grows from 32 to **33** slots, a net increase of one because two existing entries are upgraded. The canonical registry contains 102 species. Existing polar-bear order 31 remains stable.

## Artwork and anatomy

| Species                 | Canonical mesh            | Habitat and movement                                                                                                                                                                                                      |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clione antarctica       | `Clione_Antarctica`       | An unshelled, tapered transparent trunk, paired broad parapodia, bilobed head and muted orange internal structures. Slow wing bending and confined gentle drift beneath the ice, away from breathing holes.               |
| Tritoniella belli       | `Tritoniella_Belli`       | Pale soft foot and mantle, broad oral veil, sheathed rhinophores and short weakly branching marginal processes. Slow body/appendage flex and centimetre-scale exploration at existing soft-coral margins.                 |
| Glyptonotus antarcticus | `Glyptonotus_Antarcticus` | Connected flattened trunk, overlapping seven pereonal plates, smaller pleon and terminal shield, eyes, antennae, uropods and seven pairs of articulated walking legs. Gentle alternate stepping near existing dropstones. |

The request's branching structures are interpreted using species references: Tritoniella has short, unbranched or weakly branched marginal processes, rather than the large dendritic gills of many other tritoniids. The approved species is retained.

References used for original anatomical artwork:

- [Smithsonian Ocean: Angels of the Sea](https://ocean.si.edu/ocean-life/invertebrates/angels-sea) — gymnosome wings, translucent skin, visible orange internal organs, Clione antarctica identity.
- [WoRMS: Tritoniella belli](https://www.marinespecies.org/aphia.php?id=197498&p=taxdetails), [Sea Slug Forum photographs and diet](https://seaslugforum.net/showall/tritbell), and [Tritoniidae reassessment](https://pmc.ncbi.nlm.nih.gov/articles/PMC7679014/) — pale mantle, Southern Ocean identity, short weakly branching marginal processes and soft-coral association.
- [Natural History Museum isopod description](https://isopods.nhm.org/pdfs/20567/20567-001.pdf) and [Australian Antarctic Division benthic identification guide](https://www.antarctica.gov.au/site/assets/files/61366/himi_invertebrate_identification_guide1.pdf) — armored body, appendages and seven walking-leg pairs.

No reference photographs or third-party model assets ship. Models are original CC0 Blender artwork, with a modest aquarium-world readability scale (sea angel approximately 13 cm including tentacles; slug 18 cm; isopod 33 cm including antennae). These are stylized display scales, not claims about typical adult sizes.

## Shared asset and lifecycle

- Authoring source: `tools/art/pass105/ice-minis.blend`.
- Reproducible geometry and morph rigs: `tools/art/pass105/ice_minis.py`.
- Canonical runtime asset: `public/assets/models/creatures/ice-minis.glb`.
- Draco finishing and checksum inventory: `tools/art/pass105/compress.mjs`.

```bash
BLENDER_USER_CONFIG=/tmp/cozy-pass105-blender blender -b --python tools/art/pass105/ice_minis.py
node tools/art/pass105/compress.mjs
```

Three meshes, three materials, 19,968 triangles; about 267 KiB compressed, with vertex colours and no textures. The sea angel's material is blended at native opacity 0.57, without emission; depth writes are disabled for both wild and collection presentation. No glow light or halo is introduced. The other animals are opaque. All share the exact same named geometry and two anatomical morphs in the wild, album and aquarium. Collection presentation normalizes framing and preserves native material opacity during fades.

`IceMinis` owns one asset lease, three material clones and CPU-only cropped occlusion geometry. Missing, incomplete and late libraries expose no phantom sightings and release their lease. Dispose is idempotent. It never disposes source habitat or shared asset geometry. Animation is deterministic, uses seconds, freezes when paused and returns to a stable pose for reduced motion.

Placement seats benthic animals on the actual rendered seabed, checks a padded movement footprint against existing growth, and checks observation positions against navigation colliders. Existing dropstone-relative icefish resting beds and breathing-hole margins are reserved. Exact rendered surfaces block discovery rays; broad merged scenery bounding boxes are not treated as filled habitat. Nearby instanced growth is represented by CPU wrappers only, adding no scene draws. Legacy isopod random-number draws are retained so subsequent salp/jelly locations stay stable. The old procedural geometry helpers remain available to the historical shape library but no longer produce live sea angel/isopod sightings.

## Validation

Focused commands and measured browser results are recorded below after completion. No complete world traversal or full-game stress run is part of this pass.

Commands run from the repository root:

```bash
npm run format
npm run build
npm run typecheck
npm run lint
npm run test -- tests/ice-minis.test.ts tests/under-ice.test.ts tests/ice-life.test.ts tests/ice-rare.test.ts tests/ambient-collection.test.ts tests/collection-registry.test.ts tests/collection-audit.test.ts tests/album-pages.test.ts tests/tank-collection.test.ts tests/tank-save-safety.test.ts tests/asset-production.test.ts tests/asset-validation.test.ts tests/fish-lod-compression.test.ts --maxWorkers=1 --hookTimeout=30000 --testTimeout=30000
COZY_URL=http://127.0.0.1:5176 COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass105-final node validation/ice-minis.mjs
```

The 13 focused suites passed **157/157 tests** in 83.12 seconds. These include authored/fallback placement, exported poses versus solid rock, reachable observation points, occlusion through the seabed, dwell discoveries, pause/reduced-motion and frame-rate consistency, incomplete/late asset release, retained legacy IDs, save round trips, album/tank equality, native sea-angel translucency and non-emissive materials, inventory checksums, production asset standards and compressed size budgets.

Production build and standalone typecheck passed. Vite retained its existing warning about chunks larger than 500 kB. The final lint result and aquarium-clearance follow-up are recorded below.

The localized Chromium/SwiftShader check reached scene readiness, found all three species, awarded all three sightings and confirmed pause/reduced motion. Existing wildlife was ready; the approved fog density stayed **0.13**. The ice tunnel/arch/collar/glow objects remained present. After disposal, asset leases, renderer geometries and textures were all **zero**, with no browser errors.

| Local view  | Baseline calls | With miniature | Additional triangles |
| ----------- | -------------: | -------------: | -------------------: |
| Sea angel   |             75 |             76 |                3,304 |
| Tritoniella |             58 |             59 |                4,208 |
| Isopod      |             56 |             57 |               12,456 |

These are frozen-view hidden/visible comparisons of the final miniatures, not whole-pass speed benchmarks. Existing procedural sea angel/isopod draw meshes have also been removed. Screenshots and raw measurements: [localized report](screenshots/v08-pass105/report.json), [under-ice sea angel](screenshots/v08-pass105/angel-habitat.png), [coral margin](screenshots/v08-pass105/slug-habitat.png), [dropstone margin](screenshots/v08-pass105/isopod-habitat.png), and the three collection-model images alongside them. Visual review led to front-face-only rendering of the sea angel's closed shell to avoid doubled translucent opacity; no emission was added.

This is a localized rendering and discovery check in a software renderer. It makes no claim about hardware frame rates, complete passage traversal or full-game retention/performance testing.

The upright sea angel also received explicit aquarium half-height clearance (0.075 m), verified against the normalized shared-model bounds. After this adjustment:

```bash
npm run test -- tests/ice-minis.test.ts tests/ambient-collection.test.ts tests/tank-babies.test.ts --maxWorkers=1 --hookTimeout=30000 --testTimeout=30000
npm run typecheck
```

All **24/24 tests across three suites passed** (25.30 seconds), including tank navigation and the new shared-model height assertion. Typecheck and lint passed. An unused no-op update method was removed from the now-static algae owner during lint cleanup.
