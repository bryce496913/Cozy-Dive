# V0.8 Pass 104 — Sea Cave's Four Rare Miniature Discoveries

Base: merged Pass 103, main `2fef4fd`. This pass adds one persistent animal of each approved type to the existing cave. No new habitat, spawning lottery, navigation collider, lighting system or shark behaviour is introduced.

## Approved identities and geographic mixture

| Animal                                             | Identity / canonical model node                         | Recognizable anatomy and behaviour                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stargazer fish                                     | `species:stargazer` / `Stargazer`                       | A broad, flattened, sand-coloured head with upward eyes and mouth, lip fringes and pectoral fins. Normally buried in the existing sand with the eye and mouth region exposed; a gentle emergence and shift occurs on a fixed 90-second cycle. The user specified the common name, so no unapproved species binomial is assigned. |
| Psychedelic frogfish — _Histiophryne psychedelica_ | `species:psychedelic-frogfish` / `Psychedelic_Frogfish` | Flat face, forward-looking eyes, fleshy cheeks and dorsal folds, arm-like pectoral fins and fin-ray fingers. Flowing cream fingerprint markings over peach-brown skin. Slow, short fin-supported steps and hops near existing sheltered rock.                                                                                    |
| Banded coral shrimp — _Stenopus hispidus_          | `species:banded-coral-shrimp` / `Banded_Coral_Shrimp`   | Red-and-white body and limb bands, stalked eyes, tail fan, five leg pairs including three chelate pairs with an enlarged third pair, and two long white antenna pairs. Tiny leg/claw shifts and antenna sweeps beside a narrow existing crack.                                                                                   |
| Wonderpus octopus — _Wunderpus photogenicus_       | `species:wonderpus` / `Wonderpus`                       | Small copper-brown mantle, fixed white spots and arm bars, eight long arms with paired suckers, stalked eyes and conical papillae. Explores the entrance-side sandy margin and briefly conceals itself on a deterministic cycle.                                                                                                 |

**Intentional geography:** this approved roster adds a tropical Indo-Pacific component to the existing geographically mixed sea cave. The frogfish and wonderpus retain their exact approved identities; the widespread tropical banded coral shrimp is not substituted with the existing cleaner shrimp. The generic stargazer remains a separate discovery. This is a deliberate curated mixture rather than a claim that the cave represents a single geographically consistent ecosystem. Album descriptions also acknowledge the mixture.

Published anatomical references informing the original artwork:

- [University of Washington: H. psychedelica](https://www.washington.edu/news/2009/02/26/dna-evidence-is-in-newly-discovered-species-of-fish-dubbed-h-psychedelica-2/) — flat face, forward eyes, individual fingerprint pattern and hopping.
- [Philippine National Museum: Underwater stargazers](https://www.nationalmuseum.gov.ph/2021/12/15/underwater-startgazers/) and [Florida Museum: Stargazer anatomy](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/northern-stargazer/) — burial adaptations and top-facing eyes. These supply family-level anatomy; the artwork is not labelled as the Florida species.
- [WA Museum: Stenopus hispidus](https://museum.wa.gov.au/online-collections/names/Stenopus-hispidus/) and [Animal Diversity Web](https://animaldiversity.org/accounts/Stenopus_hispidus/) — banding, leg anatomy and antenna pairs.
- [Monterey Bay Aquarium: Wunderpus](https://www.montereybayaquarium.org/animals/animals-a-to-z/wunderpus) and [original species description](https://mapress.com/mr/content/v26/2006f/n3p140.htm) — stalked eyes, papillae, long arms, white markings and soft-sediment habitat.

No reference photographs or external model assets ship with the game. Geometry and maps are original CC0 artwork.

## Canonical asset and animation

- Editable Blender source: `tools/art/pass104/cave-minis.blend`.
- Deterministic builders: `tools/art/pass104/cave_minis.py`.
- Original 512-pixel frogfish base, normal and ORM maps: `tools/art/pass104/PsychedelicFrogfish-*.png`.
- Shared runtime library: `public/assets/models/creatures/cave-minis.glb`.
- Export finishing and checksum inventory: `tools/art/pass104/compress.mjs`.

Rebuild from the repository root with Blender 4.3.2:

```bash
BLENDER_USER_CONFIG=/tmp/cozy-pass104-blender blender -b --python tools/art/pass104/cave_minis.py
node tools/art/pass104/compress.mjs
```

The library has four meshes/materials and 23,080 triangles. Draco compresses geometry. The frogfish's fine flowing markings use an original UV map to avoid coarse vertex-colour aliasing at close range; its full base/normal/ORM set follows the existing PBR standard. All maps have full KTX2 mip chains (UASTC normal, ETC1S colour/ORM). The other animals use their authored vertex colours. The shared shipped-model budget grows from 46 to 47 MiB for the four detailed models and maps, following the existing content-budget convention.

All four carry `Stroke_Left` / `Stroke_Right` morphs. Additional keys are `Burrow` / `Shift` for the stargazer, `Step` / `Hop` for the frogfish, and `Burrow` / `Explore` for the wonderpus. Default GLB weights are zero. Habitat, album and tank use the same named meshes and `CaveMiniAnimation` rig; album/tank presentation leaves sand-burial keys unweighted so the complete animal is visible. This changes pose, not identity or anatomy.

Simulation uses seconds, freezes while paused and uses a stable rest pose for reduced motion. Reduced motion leaves the stargazer's eye/mouth cue exposed and the wonderpus above sand. Visibility uses that displayed pose, so a previously concealed wonderpus remains observable after reduced motion is enabled. The shrimp's antennae and distal legs move gently; the wonderpus retains its fixed identifying pattern during arm motion.

## Microhabitats, observation and ownership

`CaveMinis` seats each animal on the actual rendered sand, in both authored-geology and fallback caves. Frogfish and shrimp require a nearby actual rock face/overhang; the wonderpus is near the entrance's sand margin without occupying the passage. Homes are separated by at least 3 m and keep at least 2.8 m horizontally from existing shark resting places, the nurse/swell shark nooks, the turtle bed and the existing octopus den.

The visual review caught the initial frogfish spot being obscured by an existing lobster. Its final home avoids occupied lobster cracks by at least 1.2 m. Stargazer burial was also deepened and aligned to the sampled sand normal to hide the back while retaining its eye/mouth cue. Existing lobsters, rocks and sand geometry were not moved to make those corrections.

Observations require the existing dwell, a direct view within 1.8 m and a 0.42-radian half-angle. Sight points follow burial height. A fully concealed wonderpus cannot be awarded by looking at empty sand; an always-visible buried stargazer can still be observed. Observers below the cave floor are rejected. The Pass 103 exact-triangle CPU visibility helper is reused for existing rock/ledge geometry and nearby static formation/rubble instances. These CPU-only wrappers add no render draw or new collision geometry; motion padding covers changing sight-point heights.

The cave page appends four rare slots after its existing 14 entries. Existing cleaner shrimp, frogfish, octopus and shark identities remain intact. Journal and tank choices round-trip with stable IDs and no save-format change. Tank placements and album cards use the exact canonical GLB nodes. Geometry is shared through one asset lease; cloned materials and local CPU visibility geometry have explicit owners. Incomplete or late loads release their lease without discoverable placeholders, and disposal is idempotent.

## Validation

Validation is limited to targeted cave, shark, model, collection and asset tests plus a short cave-only browser check, as requested. No full-game test, world traversal or broad retention run was performed. Exact commands, final results and retained screenshots follow.

### Commands and results

| Command                                    | Result                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format`                           | Passed; final edited files and reports formatted with Prettier.                                                                                                                                                                                                                                    |
| `npm run build`                            | Passed; existing >500 kB bundle-size advisory remains.                                                                                                                                                                                                                                             |
| `npm run typecheck`                        | Passed.                                                                                                                                                                                                                                                                                            |
| `npm run lint`                             | Passed.                                                                                                                                                                                                                                                                                            |
| Targeted `npm run test` command below      | **10 files / 127 tests passed**, 18.19 s.                                                                                                                                                                                                                                                          |
| Cave-only Chromium/SwiftShader check below | Prepared cave ready, all four actual observations, three resting-shark sightings with successful readiness, approved fog 0.13 unchanged, both return-passage glows present, pause/reduced motion passed. No browser errors. **0 retained GPU geometries, textures or asset leases** after release. |

```bash
npm run test -- \
  tests/cave-minis.test.ts tests/sea-cave.test.ts tests/shark-tail.test.ts \
  tests/asset-validation.test.ts tests/asset-production.test.ts \
  tests/fish-lod-compression.test.ts tests/collection-registry.test.ts \
  tests/collection-audit.test.ts tests/album-pages.test.ts tests/tank-collection.test.ts \
  --maxWorkers=1 --hookTimeout=30000 --testTimeout=30000

# With npm run dev -- --port 5175 already running:
COZY_URL=http://127.0.0.1:5175 \
COZY_PLAYWRIGHT=/tmp/cozy-browser/node_modules/playwright/index.mjs \
COZY_CHROMIUM=/usr/bin/chromium COZY_OUTPUT=/tmp/cozy-pass104-final \
node validation/cave-minis.mjs
```

The ten new miniature tests cover both cave geology paths, reachable views, shelter/crack evidence, occupied-den separation, every exported pose against solid-rock collision, intentional burial with visible eyes, deterministic motion cycles, direct/near observations, sand obstruction, concealed-octopus suppression, reduced-motion observability, pause and frame-rate consistency, failed/late loads, canonical geometry sharing and journal/tank round trips. Existing cave navigation and repeated shark-tail/startle tests are included in the targeted run.

The final self-contained GLB is **721,620 bytes**, with four meshes and **23,080 triangles** plus three compressed 512-pixel frogfish maps. In the checked closeups, only the nearby miniature was submitted:

| View                 | Added draws | Added triangles |
| -------------------- | ----------: | --------------: |
| Stargazer            |           1 |           3,280 |
| Psychedelic frogfish |           1 |           6,980 |
| Banded coral shrimp  |           1 |           2,976 |
| Wonderpus            |           1 |           9,844 |

Four draws is the owner's maximum before normal frustum culling. These workload counts were measured in the local software-renderer check, not extrapolated to hardware frame rates. The only additional render geometry is the four animals. Nearby formation/rubble wrappers used for accurate occlusion are CPU-only and never enter the render scene.

The retained report and eight screenshots in `docs/screenshots/v08-pass104/` show the final homes and canonical model gallery. The gallery shows the complete stargazer and wonderpus for collection inspection; wild burial is an intentional pose using those same meshes. No full-game suite or complete world journey was run.
