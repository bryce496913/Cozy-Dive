# V0.8 Pass 101 — The outer reef's four rare miniatures

Four small, rare animals now live in the existing outer reef:

- the harlequin shrimp (_Hymenocera picta_), as a pair;
- the ornate ghost pipefish (_Solenostomus paradoxus_);
- the hairy frogfish (_Antennarius striatus_);
- the mimic octopus (_Thaumoctopus mimicus_).

Each is found by looking at it closely. It then appears in the album's Outer Reef section, and you can place it in the aquarium using the same model.

This pass adds no reef area, passage, predator behaviour or gameplay system, and leaves the dense fog untouched. Discovery works at close range instead.

## Models (`tools/art/pass101/reef_minis.py`, Blender 5.1)

The four animals share one model file, `public/assets/models/creatures/reef-minis.glb` (299 KB). Its editable source is `tools/art/pass101/reef-minis.blend`.

| Node               | Anatomy                                                                                                                                                                        | Size         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| `Harlequin_Shrimp` | Cream body with large, dark-edged violet spots. Huge flattened, spotted petal claws held up in front. Leaf-like antennules on eye stalks. Thin walking legs and a tail fan.    | 5 cm         |
| `Ghost_Pipefish`   | Slender body banded red, yellow and white, with a long tubular snout. Large lacy fan fins (pelvic pocket, dorsals, tail) spotted black. Frilly skin filaments.                 | 10 cm        |
| `Hairy_Frogfish`   | Globose striated body covered in about 260 hair-like spinules. Upturned mouth, a lure with a worm-like esca, arm-like pectoral fins with "hands", and pelvic fins it walks on. | 15 cm        |
| `Mimic_Octopus`    | Small head with raised eyes and a mantle sac. Eight long, slender arms banded brown and cream.                                                                                 | 45 cm across |

Model details:

- Each animal has `Stroke_Left` and `Stroke_Right` morphs:
  - shrimp: claw wave and body sway;
  - pipefish: body and fin sway;
  - frogfish: fin step and lure flick;
  - octopus: arm curl.
- The octopus also has `Mimic_Flatfish` (arms swept back together, body flattened) and `Mimic_Lionfish` (arms raised and spread).
- Every pose comes from the same builder with the same seeded randomness, so poses share topology exactly.
- Morph normals are not exported: the bends are small, and leaving them out keeps the shared asset download within its budget.

**Shape-key fix (also applied to Pass 100's `rare-minis.glb`).** Blender starts new shape keys at weight 1, which became the GLB's default morph weights. In play the stroke weights are overwritten every frame, so nothing visible changed. The default pose is still now the true rest pose, and a test checks it.

## Homes (`src/environment/outer/ReefMinis.ts`)

Each animal has one stable home, chosen from the reef's own layout. The home is the nearest suitable piece to a fixed point on the reef top inside the glass. Homes are at least 5 m apart, and the mimic octopus keeps more than 7 m from the day octopus's den. Nothing spawns at random.

- **Harlequin shrimp pair:** on the rock head a plate coral grows from (every plate on this reef stands on a rock), close in under its shelf, with no seagrass screening it. Small, deliberate steps now and then. The claws wave slowly, and the mate is a little out of step.
- **Ghost pipefish:** in front of a sea fan's face, half-way up, hovering head-down and swaying with the fan. It turns side-on to a close diver.
- **Hairy frogfish:** on open sand within about 1 m of rubble. It shuffles slowly on its fins along a short path (under 20 cm) and freezes when the diver is close.
- **Mimic octopus:** on open sand stepping out from a seagrass patch.
  - It is out about four-fifths of the time, on a fixed 66 s cycle: out 52 s, then 14 s in its burrow. Its appearances are regular, so it never needs a rare random encounter.
  - Every 17 s it takes a flatfish or a lionfish posture, alternating, for about 5 s.
  - While in its burrow it cannot be sighted.

**Discovery:** a sighting counts only from within 2.4 m (`reach`) and within 0.4 rad of the middle of the view (`cone`), after the usual 1.5 s look. Nothing counts from across the reef. Corals and sea fans have to be inspected closely.

**Behaviour:**

- Paused, nothing advances.
- With reduced motion they rest in place: no steps, shuffles, postures or burrow cycle.
- Movement is based on elapsed time, so it is the same at any frame rate.
- They are tiny and sit on the sand or hover by a fan, so they need no colliders.

**Loading:** the models load with the reef's other life, through the creature loader and its cache. Until they load, nothing is shown or sightable. If loading fails, the reef is as it was and nothing is lost.

**Viewing spots and open sand:**

- Each home has a viewing spot whose line of sight passes only through open water, checked against the reef's real collision hulls (supplied by the scene). The spot rises in steps if needed but always stays within reach.
- The rocks as drawn are bigger than their hulls. "Open sand" for the frogfish and octopus therefore also means clear of every rock and coral by more than its own drawn size. An early version hid the octopus behind a rock while still counting it as sighted.
- The drawn sand ripples sit about 2 cm above the terrain function, so the sand dwellers rest on the visible sand (`SAND_LIFT`) instead of sinking into it.

## Collection and tank

- **Sightings:** `species:harlequin-shrimp`, `species:ornate-ghost-pipefish`, `species:hairy-frogfish` and `species:mimic-octopus`.
- **Album:** four rare cards appended to the Outer Reef page (30 cards; earlier slots unchanged).
- **Tank miniatures:**
  - each places the same library node;
  - shrimp, frogfish and octopus crawl, and the pipefish hovers as a very slow swimmer;
  - they are not enlarged with the big animals.
- **Tank limit:** 68, still one of each.
- **Saves:** no migration.

## Validation

- **Unit tests** (`tests/reef-minis.test.ts`, 13 tests):
  - microhabitats and seating;
  - stable, inside the reef area, spaced, and clear of the day octopus;
  - sighted only up close and looked at, never from 6 m;
  - the burrow cycle and both postures;
  - not sightable while in the burrow;
  - the same pace at 30, 60 and 120 fps, still with reduced motion, freezing when shy;
  - a failed model load and disposal;
  - the models' scale, rest position, strokes and default weights;
  - album and tank registration.
- **Updated counts:** 90 species and 30 outer-reef cards; the manifest gains a row.
- **Reef-only browser check:** `validation/v08/reef-minis.mjs`. See the PR for results and `docs/screenshots/v08-pass101/` for screenshots.

## Known limitations

- Rendering was checked only on SwiftShader. Real-GPU and laptop performance were not measured.
- The browser check steps the game by hand in 0.1 s ticks, as the existing reef harness does.
