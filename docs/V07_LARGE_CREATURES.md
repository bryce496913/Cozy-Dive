# V0.7 large creatures (Pass 067)

The large animals that pass close to the player are rebuilt to the Crafted Stylized Realism standard on the hero-fish anatomy builder. No animals were added or removed. Paths, encounters, observation, avoidance, geography and behaviour are unchanged: only the GLBs were rebuilt.

**Rebuilding**

The sources are [`tools/art/pass067/creatures.py`](../tools/art/pass067/creatures.py), which holds the family builders, and [`species.py`](../tools/art/pass067/species.py), which holds the per-species proportions and paint. Packed `.blend` sources sit beside them. Run these steps in order:

```bash
python3 tools/art/pass067/creatures.py            # or: creatures.py manta-ray eagle-ray
```

```bash
node tools/art/pass017/compress.mjs public/assets/models
```

```bash
python3 tools/art/inspect_assets.py
```

```bash
node validation/AssetStandards.ts public/assets/models/creatures/manta-ray.glb
```

**Isolated preview**

```bash
COZY_SET=creatures node validation/v07/gallery.mjs
```

This renders the side, three-quarter, top and mid-stroke views of every rebuilt animal under the shared tank rig. To view them in a browser, open `validation/v07/gallery.html?set=creatures` (add `&stroke=1` for the stroke pose).

## Inventory

| Status                    | Assets                                                                                                                                                     | Notes                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuilt (13)              | reef, whitetip, great white, hammerhead, leopard, nurse and whale sharks; barracuda; eagle ray; manta ray; green sea turtle; ocean sunfish; humpback whale | One family builder each: shark, ray, turtle, whale, sunfish.                                                                                             |
| Not rebuilt: polish later | killer whale, minke whale, leopard seal, harbour seal, emperor and Adélie penguins, polar bear                                                             | The ice world draws these procedurally in `IceAnimals.ts`. They were reworked after playtest in #108. Their GLBs are gallery/library copies.             |
| Not rebuilt: deferred     | sea lion, sea otter, western gull                                                                                                                          | Kelp-world surface animals, seen briefly and from below. Their mammal/bird anatomy needs its own builder; deferred to the environment conversion passes. |
| Not creatures             | `anchored-life.glb`, `nudibranchs.glb`                                                                                                                     | Small-life libraries. They belong with the habitat asset pass.                                                                                           |

## What changed

| Area     | Before (Passes 025/033)                                            | Pass 067                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body     | Elliptical lofts, with the same shark shape scaled across species. | Superellipse sections per species: the great white's deep torpedo, the nurse shark's flattened head, the barracuda's long jaw, the hammerhead's cephalofoil, the sunfish's disc, the turtle's domed carapace and the humpback's long jaw line.                                                                                              |
| Fins     | Flat or blocky plates.                                             | Thick membranes with ray ridges, grown out of the body. Fin shapes per family: heterocercal shark tails, swept dorsal fins and horizontal pectorals; pointed swept-back ray wings with a whip tail and manta cephalic lobes; turtle flippers; the humpback's long flippers and notched flukes; the sunfish's tall sculling fins and clavus. |
| Textures | Flat tints.                                                        | One 512 px base/normal/ORM set per animal, painted from anatomy: countershading, whitetip and blacktip tips, whale-shark spots, eagle-ray dots, manta shoulder patches, turtle scutes, humpback throat pleats and tubercles, sunfish blotches.                                                                                              |
| Stroke   | A body bend.                                                       | `Stroke_Left`/`Stroke_Right` morphs per gait: lateral (sharks, barracuda), flap (rays, the wings beat from the root out), flipper (turtle fore and hind), fluke (humpback, vertical), scull (sunfish fins, stiff body). The runtime's `creatureStroke` drives them unchanged.                                                               |

**Unchanged contract**

- Root names are unchanged: `Shark_Root`, `Ray_Root`, `Manta_Root` and so on.
- `Body` is one mesh with one material; `SoloCreature` reads it as a single mesh.
- `Body_LOD1` is the distance level, with its morphs transferred.
- The stroke morph names and the root scale are unchanged.
- **New:** the default morph weights are now 0 (rest pose).

## Cost

| Asset             | Triangles (both levels) | Materials | File (compressed) |
| ----------------- | ----------------------- | --------- | ----------------- |
| reef-shark        | 11,998 → 7,874          | 1 → 1     | 0.54 → 0.72 MB    |
| whitetip-shark    | 11,998 → 7,874          | 1 → 1     | 0.55 → 0.72 MB    |
| great-white-shark | 15,516 → 7,874          | 1 → 1     | 0.65 → 0.70 MB    |
| hammerhead        | 13,066 → 7,874          | 1 → 1     | 0.56 → 0.72 MB    |
| leopard-shark     | 11,636 → 7,877          | 1 → 1     | 0.52 → 0.72 MB    |
| nurse-shark       | 14,472 → 7,866          | 1 → 1     | 0.59 → 0.73 MB    |
| whale-shark       | 12,054 → 7,875          | 1 → 1     | 0.56 → 0.71 MB    |
| barracuda         | 11,678 → 7,878          | 1 → 1     | 0.52 → 0.70 MB    |
| eagle-ray         | 6,096 → 5,339           | 1 → 1     | 0.37 → 0.60 MB    |
| manta-ray         | 7,274 → 5,711           | 1 → 1     | 0.38 → 0.59 MB    |
| sea-turtle        | 9,474 → 7,831           | 1 → 1     | 0.50 → 0.66 MB    |
| ocean-sunfish     | 8,230 → 5,740           | 1 → 1     | 0.35 → 0.64 MB    |
| humpback-whale    | 7,952 → 7,405           | 1 → 1     | 0.40 → 0.64 MB    |

- **Triangles:** in the gallery, the 13 animals draw 82k triangles, down from 122k. Every animal is cheaper.
- **Draw calls are unchanged:** one per animal.
- **Distance levels:** about 1,050 triangles for the sharks and 690–1,080 for the others.
- **Download** grows by about 2.3 MB in total. Each animal now carries its own normal and ORM maps; the extra bytes are mostly the UASTC normal map.

## Validation

- **Production checks:** `validation/AssetStandards.ts` reports no errors for all 13 animals.
  - Decimation had left sliver triangles in the distance level; the builder now removes them.
  - Each animal still reports one standards warning. The checker prints only a count here, so the warning text has not been reviewed yet.
- **Tests:** `tests/large-creatures.test.ts` (new) covers:
  - the root;
  - the single-primitive `Body` and `Body_LOD1`;
  - two stroke morphs with rest weights;
  - budgets and the production checks.

  It passes with the asset, creature, outer-reef, wall-visitor, kelp, cave and wreck suites (144 + 26 tests). Typecheck, lint and build pass.

- **Captures:** before/after captures for each view are in `docs/screenshots/v07-pass067/`. They come from the shipped GLBs under the tank light rig (SwiftShader).

## Separate design issue (not changed)

- **The polar bear is in the Antarctic ice world.** Polar bears live only in the Arctic.
  - It is recorded here and left in place, as this pass may not change distribution.
  - Options for a later decision: replace it with an Antarctic animal (for example a Weddell seal), or reframe the ice world as Arctic.

## Limitations

- **Morph-only animation:** sharks bend along one lateral field, and rays beat their wings symmetrically. There are no jaw, gill or eye movements.
- **Stroke field approximations:**
  - the turtle's fore-flippers stroke up and down without the feathering twist of the real stroke;
  - the humpback's flippers do not move independently of the fluke stroke.
- **Shared ray wing:** the manta and the eagle ray share one wing planform function, so their silhouettes differ only in proportions.
- **Captures:** stills from SwiftShader. In-game motion at real distances needs a short look in the outer reef and the wall dive.
