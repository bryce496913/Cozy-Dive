# V0.7 marine mammals, penguins and the gull (Pass 068)

The last large animals not yet on the V0.7 standard are now authored in Blender, like the Pass 067 creatures. They were left out of Pass 067:

- **Ice world:** killer whale, minke whale, leopard seal, emperor and Adélie penguins, polar bear. These were built in code at runtime (`IceAnimals.ts`).
- **Kelp forest:** sea lion, sea otter, western gull, plus the harbour seal, which is also used under the ice.

No animals were added or removed. Paths, encounters, sightings, behaviour and geography are unchanged.

**Rebuilding**

[`tools/art/pass068/mammals.py`](../tools/art/pass068/mammals.py) is the mammal and bird builder, and [`mammal_species.py`](../tools/art/pass068/mammal_species.py) holds the specs. Packed `.blend` sources sit beside them. Run these steps in order:

```bash
python3 tools/art/pass068/mammals.py               # or: mammals.py polar-bear sea-otter
```

```bash
node tools/art/pass017/compress.mjs public/assets/models
```

```bash
python3 tools/art/inspect_assets.py
```

**Isolated preview**

```bash
COZY_SET=mammals node validation/v07/gallery.mjs
```

This renders the side, three-quarter, top and mid-stroke views of the ten animals under the shared tank rig.

## The builder

`mammals.py` extends the Pass 067 creature builder (`tools/art/pass067/creatures.py`) rather than forking it:

- **Body:** the same superellipse loft, atlas and export.
- **New parts:**
  - tapered, capped limb tubes for legs, arms, ears and bills;
  - webbed fans for hind flippers, feet and the gull's tail;
  - wing membranes for penguins and the gull;
  - a configurable falcate dorsal fin for the whales.
- **Atlas slots:** a per-slot colour lets bills, feet and legs differ from the fins.
- **Materials:** fur and feather templates in `tools/art/v07/standards.json` (fur is matte, 0.6–0.9; feathers are satin, 0.4–0.75).
- **Gaits** (`Stroke_Left` / `Stroke_Right`, driven unchanged by the runtime):

| Gait    | Animals          | Stroke                                                                                       |
| ------- | ---------------- | -------------------------------------------------------------------------------------------- |
| fluke   | orca, minke      | Tail stock and flukes beat up and down.                                                      |
| seal    | leopard, harbour | Hind body and hind flippers sweep side to side.                                              |
| sealion | sea lion         | Big fore-flippers sweep down and back (`Stroke_Left`) or up and forward; a slight body sway. |
| penguin | both penguins    | Flippers rotate about the body axis (`Stroke_Left` up); a light tail beat.                   |
| wing    | gull             | Wingbeat about the body axis (`Stroke_Left` up). The rest pose has spread wings, as before.  |
| paddle  | polar bear       | Forelegs swing in alternation; hind legs kick opposite.                                      |
| otter   | sea otter        | Tail and webbed hind feet scull side to side. The runtime still rolls it onto its back.      |

## Runtime change

- **Removed:** `src/environment/ice/IceAnimals.ts` and `src/assets/ProceduralAssets.ts`. `AssetLoader` now decodes every asset from its file.
- **Same contract:** each model keeps its predecessor's root, its single-material `Body`, `Body_LOD1` and stroke morphs, and fits the registry's size bounds. That includes the stroke poses, which the test now checks.
- **Smoke test:** the ice and kelp worlds were built in the browser harness (`validation/v07/worlds.mjs`, `COZY_WORLDS=ice,kelp`). All six views rendered without errors.

## Cost

| Asset           | Triangles, file vs file | File (compressed) |
| --------------- | ----------------------- | ----------------- |
| killer-whale    | 13,844 → 7,469          | 0.55 → 0.64 MB    |
| minke-whale     | 14,026 → 7,468          | 0.56 → 0.64 MB    |
| leopard-seal    | 9,084 → 7,432           | 0.45 → 0.68 MB    |
| harbour-seal    | 8,426 → 7,432           | 0.42 → 0.70 MB    |
| sea-lion        | 8,630 → 7,488           | 0.38 → 0.68 MB    |
| polar-bear      | 9,056 → 6,922           | 0.43 → 0.63 MB    |
| sea-otter       | 16,838 → 6,199          | 0.86 → 0.65 MB    |
| emperor-penguin | 9,270 → 6,177           | 0.35 → 0.61 MB    |
| adelie-penguin  | 9,270 → 6,178           | 0.34 → 0.61 MB    |
| western-gull    | 8,406 → 5,394           | 0.33 → 0.59 MB    |

- **Triangles:** in the gallery, the ten animals as players actually saw them draw 88k triangles before (code-built ice animals, older kelp models) and 59k after. Draw calls are unchanged at one per animal.
- **No build cost on entering the ice:** the code-built ice animals cost CPU time to generate there, but came with no download. They are now ordinary files that load only under the ice.
- **Download budget:** the shipped-models budget test moves from 36 to 38 MB.

## Validation

- **Production checks:** `validation/AssetStandards.ts` reports no errors for all ten animals.
- **Tests:** `tests/large-creatures.test.ts` now covers the ten animals:
  - the contract;
  - rest weights;
  - registry bounds at rest and in both stroke poses;
  - that each stroke really moves part of the animal by at least 4 % of its size.

  `tests/ice-animals.test.ts` tested the removed code-built animals and is replaced by this test. The full suite passes (91 files), as do typecheck, lint and build.

- **Captures:** before/after views are in `docs/screenshots/v07-pass068/`.

## Limitations

- **Polar bear:** the neck could still be longer and the head more defined. Its legs are smooth tubes with paw pads, without toes or claws.
- **Seals and sea lion:**
  - whiskers are not modelled;
  - the sea lion's hind flippers do not rotate forward, as they would on land (it is only seen swimming).
- **Gull:**
  - the wingtip black follows the fin band's free edge, so the trailing edge is also tipped;
  - the red bill spot is not painted.
- **Minke flippers:** the white flipper band is approximated by lighter grey flippers.
- **Captures:** SwiftShader stills. Motion in the game (the gull's wingbeat, the bear's paddle) needs a short look under the ice and in the kelp forest.
- **Polar bear geography:** the polar bear is still in the Antarctic ice world, as recorded in Pass 067; it is left in place.
