# V0.8 Pass 100 — The aquarium's three rare miniatures

This pass adds three small, rare animals to the existing tropical tank:

- the Pikachu nudibranch (_Thecacera pacifica_);
- the leaf sheep (_Costasiella kuroshimae_);
- the candy crab (_Hoplophrys oatesii_).

Each one lives in a fitting part of the tank and is found by looking at it closely. It then appears in the album's Aquarium section, and you can place it in the tank using the same model.

## Models (`tools/art/pass100/rare_minis.py`, Blender 5.1)

The three animals share one model file, `public/assets/models/creatures/rare-minis.glb`. Its editable source is `tools/art/pass100/rare-minis.blend`.

| Node                 | Anatomy                                                                                                                                                                                                                       | Size                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `Pikachu_Nudibranch` | Yellow foot and domed mantle with black and blue speckles. Black-tipped lamellate rhinophores in flared, black-rimmed sheaths. A five-plume branched gill rosette. Two black-tipped extra-branchial papillae. Oral tentacles. | 16 cm                |
| `Leaf_Sheep`         | Pale translucent body. Seven rows of swollen green leaf cerata with pale-blue tips. Long rhinophores, white with a dark band. Two black eyes set close together on a white face.                                              | 9 cm                 |
| `Candy_Crab`         | Pear-shaped pink carapace covered in about 80 white-tipped spines, which mimic the coral's polyps. Rostral horns, eye stalks, slender chelipeds and eight three-segment walking legs.                                         | 6 cm across the body |

Model details:

- Each animal is a single mesh of about 3,000 vertices, with natural colours stored on the vertices. There are no textures, so there is nothing to KTX2-compress.
- Each mesh has two bend morphs, `Stroke_Left` and `Stroke_Right`. On the slugs they ripple the body; on the crab they sway the body and step the legs.
- The wild animal, the album card and the tank miniature all drive these morphs through `creatureStroke`.
- The geometry is Draco-compressed, apart from the morphs. The file is 621 KB.
- Gallery: `docs/screenshots/v08-pass100/models.png` (Blender renders) and the album cards.

## Homes and discovery (`src/creatures/discoveries/RareMinis.ts`)

Each animal has one fixed home, chosen from the tank's own layout in a stable order. Nothing is spawned at random and nothing in the tank is rebuilt.

- **Pikachu nudibranch:** a level face of the reef's rock (`surfaceHome`, an upward normal of at least 0.8), settled onto the authored rock. It crawls a slow 10 × 16 cm loop that stays inside the tested footprint, rippling as it goes.
- **Leaf sheep:** among the runners of one of the tank's Caulerpa patches. These grow on sand, which the composed reef never moves. It grazes: its head dips now and then and it inches along.
- **Candy crab:** clinging to a finger of one of the finger-leather corals.
  - These corals grow on rock, and the composed reef may move them onto its own rock or not draw them at all.
  - So the crab perches on the first of its candidate corals that is actually drawn (`PlantSystem.drawnMatrix`), on the finger point nearest its intended perch.
  - Its viewing spot is computed for where it really ends up.
  - If none of its corals is drawn, it is not shown and cannot be sighted.
  - It holds still and shifts its grip every 26 s.

Spacing and viewing spots:

- Each home keeps at least 1.1 m from the other discoveries (seahorse, frogfish and nudibranchs) and from the other two.
- Each has a clear viewing spot with a route from the spawn (`discoveryView`).

**Discovery is by observation.** Each animal is a sighting candidate with a new optional `reach` of 1.7 m and a view `cone` of 0.38 rad (`SightCandidate.reach` and `cone`). It counts only after the usual 1.5 s look, from close by, with the animal near the middle of the view. It is easy to overlook: nothing counts from across the tank or from the spawn. It is reliably findable: it is always in the same place.

**Behaviour:**

- The diver within 0.75 m makes the nudibranch stop crawling, the leaf sheep stop feeding and the crab crouch.
- Paused, nothing advances.
- With reduced motion they keep still: no crawl, ripple or stepping.
- They are tiny and sit on their surfaces, so they need no colliders. Their footprints are checked against the rock hulls.

**Loading:** the models come from the same loader and cache as the album and tank (`acquire('rareMinis')`).

- Until the file loads, nothing is shown and nothing can be sighted.
- If it fails to load, the tank is unchanged and past sightings stay in the journal.
- Disposal releases the model file exactly once.

## Collection and tank

- **New sightings** (`AQUARIUM_SIGHTS`): `species:pikachu-nudibranch`, `species:leaf-sheep` and `species:candy-crab`.
- **Album:** three new Aquarium-page slots after the moray. Existing slot orders are unchanged. All three are rare and have their own nature notes.
- **Tank miniatures** (`TANK_BABIES`):
  - each places the same library node (`asset: 'rareMinis'`, `nodes: [...]`) as a slow crawler;
  - they are not doubled with the large animals;
  - the save key is the species id, and the tank save stays at version 3.
- **Tank limit:** `BABY_CAP` was 61, one of each animal species. It is now 64, so a full collection still fits one of each.
- **Saves:** no migration is needed. Older saves load unchanged, and unknown ids from newer versions are kept, as before.

## Validation

- **Unit tests** (`tests/rare-minis.test.ts`, 13 tests):
  - microhabitats and spacing;
  - deterministic homes;
  - reachable viewing spots;
  - sighted only up close and looked at directly, and only once shown;
  - the same crawl pace at 30, 60 and 120 fps;
  - pausing for the diver, keeping still under reduced motion, and staying still while the game is paused;
  - a failed model load and disposal;
  - the crab choosing a drawn coral, or hiding when none is drawn;
  - the model's anatomy budget and bend strokes;
  - the album and tank registration.
- **Updated counts:** 86 species (was 83), aquarium page 12 (was 9), and the asset manifest gains a row.
- **In the game** (`validation/v08/rare-minis.mjs`, aquarium only, SwiftShader). See below.

## Known limitations

- Rendering was checked only on SwiftShader. Real-GPU and laptop performance were not measured.
- Under SwiftShader the game advances at most 0.1 s per frame, so the in-game test allows extra real time for the 1.5 s look.
- The crab's coral can only be one the composed reef actually draws. If a future reef change withholds all of them, the crab hides rather than float.
