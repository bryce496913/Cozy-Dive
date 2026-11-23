# V0.8 Pass 092: Reef Growth and Remaining Marine Animals

Base: main after Pass 091 (kelp and cave geology). Scope: the Pass 088 final audit's remaining
below-standard items. These are the code-built reef growth and the library plating corals
(Part A), the polar bear (B), the sea otter (C), the minke whale (D), and the fin-edge, marking and
seam defects on the other large animals (E). No new organisms, species or placements. Behaviour,
discovery and the creature contract are unchanged.

- **Gallery:** `docs/screenshots/v08-pass092/`. Every "before" was rendered from a clean export of
  main, through the same harnesses (and the same harness fix, below) as its "after".
  - `creatures/`: studio views (side, three-quarter, head, top) of each affected animal.
  - `water/`: in-water views under the ice, kelp and outer-reef water and light.
  - `growth/`: the reef-growth studio, the in-world views of the wreck, cave and ice, and the
    Blender turnarounds of the new library plates.
- **Sources:**
  - `src/environment/shared/GrowthForms.ts` (code-built growth);
  - `tools/art/pass092/plates.py`, `plates.blend` and `splice_reef.mjs` (library plates);
  - `tools/art/pass092/creatures.py` and `*.blend` (animals).

  The Pass 014, 068, 078 and 084 sources are kept for rollback.

## Part A: Reef growth

### Code-built growth (no download cost)

| Organism (where)                              | Before                                                | After                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barrel sponge (wreck)                         | A lathe; twelve identical cosine ridges               | `vaseSponge`: one closed surface from a foot spread into the steel, up a leaning, lumpy wall with broken, wandering ridges, over a thick rolled lip of uneven height, down a dark atrium       |
| Encrusting sponge (wreck), cushion (cave)     | Squashed hemispheres; pits painted on                 | `encrustingSponge`: lobed crusts, thick at the middle and feathered under the substrate at the margin, with two octaves of relief and raised, volcano-like oscula with dark openings           |
| Tube sponges (cave)                           | Five plain open cylinders standing on bare rock       | Soft, leaning, unevenly lipped tubes with growth constrictions and thick walls, rising together out of one shared encrusting base                                                              |
| Plate coral (wreck)                           | Two flat discs, a mirrored underside, a cylinder foot | `foliosePlate`: seven petal-shaped laminae whorling up out of a low crust. Each is a closed lens, thick at its root and thin at a wavy, pale growing margin, with growth rings                 |
| Glass sponge (ice; the tank's "Glass sponge") | A lathe of one profile                                | A hexactinellid vase: a foot spread into the mud, lumpy, faintly ribbed walls with growth constrictions, an uneven rolled rim and a dark atrium. Its material now takes the vase's vertex tone |
| Ice soft coral                                | Nine-sided clubs ending in open, flaring "trumpets"   | Rounder trunk and clubs (16 sides) that swell and close round at the tip; polyp nodules at a scale the mesh can carry (finer ones aliased into spikes)                                         |

**Materials.** The wreck's growth was one material; it is now three, under the same Pass 087 silt
veil:

| Material      | Roughness | Covers                                                                                     |
| ------------- | --------- | ------------------------------------------------------------------------------------------ |
| Sponge        | 0.98      | Barrel and encrusting sponges (velvety)                                                    |
| Coral tissue  | 0.72      | Soft corals, fans, black, wire and plate corals, feather stars and hydroids (a soft sheen) |
| Mineral crust | 1.0       | The encrusting mats (dead matte)                                                           |

The cave's sponges likewise become velvety (roughness 0.85 → 0.97).

**What stays the same.** Quantities, placements, sizes and draw calls are unchanged: one instanced
draw per kind, as before.

### Library plating corals (`Coral_Plate_0..2` in `reef-environment.glb`)

These were tables: round plates on a trunk with struts, which read as mushrooms. They are used by:

- the tank's visible plate colony (variant 2);
- the placeable "Plate coral" (variant 0) and "Tiered plate coral" (variant 1);
- the outer reef's fallback.

They are re-sculpted in Blender as colonies that grow over a broad, encrusted base of dead coral
rock. Overlapping, cupped laminae whorl up into tiers, each thick at its root and thin at a pale,
wavy margin with growth rings. There is no column anywhere. Vertex colour separates living tissue
from the grey, faintly pink mineral base. The shipped `CoralPlate` material (its KTX2 maps) is kept,
and each colony still carries four convex collision parts.

`splice_reef.mjs` replaces just these three pieces, meshes and colliders, inside the shipped
library. The library shrank by 35 KB.

## Parts B to D: Polar bear, sea otter, minke whale

All three keep their root names, sizes, the single `Body` / `Body_LOD1` material, and the
`Stroke_Left` / `Stroke_Right` morphs with the same motion. The bear paddles; the otter bends from
mid-body (Pass 068's amplitude); the minke beats its flukes.

- **Polar bear:**
  - A long neck carrying a smaller, longer head with a Roman-nosed muzzle bridge.
  - Low shoulders and heavy hindquarters.
  - Fore legs reach forward and down mid-paddle, with the shoulder blade, the point of the elbow,
    a forearm narrowing to the wrist, and a broad, flat paw with five distinct toes.
  - Hind legs trail, with heel and sole.
  - The limb blends are tightened so joints keep their form; this is what made it plush.
  - Fur varies: warmer along the back, cooler on the legs and belly, with soft clumping over the
    Pass 084 fur detail map.
- **Sea otter** (a new sculpt; it was a Pass 068 loft):
  - A long, supple body and a broad, flat-topped head.
  - A blunt muzzle with swollen whisker pads, a chin and a dark nose pad.
  - Small, open ears.
  - Eyes are eyeballs in sockets; there are no flat polygonal patches.
  - Short forelimbs with mitten paws, large webbed hind feet, and a flat paddle tail a third of
    its length.
  - Dark brown, with a grizzled pale face and throat that grade into the neck.
- **Minke whale** (a new sculpt, to the humpback's standard; it was a Pass 068 loft):
  - A slender body tapering to a laterally keeled tail stock.
  - A narrow, pointed V-shaped rostrum with its median ridge, and a splash guard round the paired
    blowholes.
  - A bowed mouth line with the eye just above its corner, and ventral pleats to behind the
    flippers.
  - A tall, falcate dorsal two-thirds back.
  - Slender, pointed flippers carrying the minke's white band.
  - Broad flukes with a median notch and a smooth trailing edge.
  - Black-grey above, white below, with pale shoulder chevrons.

## Part E: Defects on the other large animals

Rebuilt with the same anatomy: whale shark, eagle ray, manta, great white, reef shark and humpback.

| Defect                                    | Cause                                                                            | Correction                                                                                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jagged fin and wing trailing edges        | Marching cubes leaves a voxel staircase on surfaces about a voxel thick          | The raw surface is smoothed (Taubin, which keeps volume), fully on the fins and lightly on the body                                                                                                                                                                |
| Polygonal whale-shark and eagle-ray spots | Vertex colour can only change at a vertex (about 7600 triangles over the body)   | The pattern is baked into a 512 px map on a second, unique UV set, sampled from the same analytic colouring at every texel. The whale shark's lattice is redrawn as it looks on the animal: wavering, broken lines with round spots of differing size between them |
| Manta and minke markings                  | The same, though their patches are large                                         | The mesh is decimated a little lower and the reserve spent splitting only the triangles a colour edge crosses (most contrasting first), with neighbours split too so no T-junction opens during a stroke. New points are projected back onto the sculpted surface  |
| Texture seams                             | The detail map was box-projected, so it seams wherever the dominant axis changes | The body is mapped round its own spine, with one seam along the belly midline. Fins keep planar mapping, so their only seam lies on the thin edge                                                                                                                  |
| Mesh separation in animation              | None was found; the stroke morphs are continuous fields over one mesh            | Splitting keeps the mesh free of T-junctions                                                                                                                                                                                                                       |

## Validation

- **New tests** (`tests/reef-growth-animals.test.ts`):
  - **Barrel and glass sponges:** irregular vases, not lathes (outline ratio above 1.15), with dark
    atria and feet in the substrate.
  - **Encrusting sponges:** lobed, feathered below their substrate, with dark oscula.
  - **Tube sponges:** on a shared base.
  - **Plates, wreck and library:** grown from a broad base, not a stalk. This is a waist test that
    the shipped tables fail (0.19).
  - **All nine animals:** they are Pass 092 builds.
  - **Minke proportions:** its slender proportions are checked.
  - **Whale shark and eagle ray:** markings on their own UV set, with white vertex colour.
  - **Manta:** smaller triangles at its markings (0.82 → 0.66 of the mean edge).
- **Existing suites:** the asset standards, creature contract (root, single material, LOD, morphs
  at rest), coral library, collision, lifecycle and world suites pass.
- **Full checks:** `npm run test`, `typecheck`, `lint` and `build` (see the PR).
- **Browser:** headless Chromium on SwiftShader, through the game's loader and materials:
  - the creature studio;
  - the same animals in the ice, kelp and outer-reef water;
  - the reef-growth studio;
  - the wreck, cave and ice worlds.

  No long stress suites were run.

- **Studio harness fix:** `validation/v07/small.html` showed vertex-toned growth untinted (white).
  It now multiplies the tint by the tone, as the instance colour does in game. Both before and
  after were rendered with it.

## Asset costs

| Asset                                    | Before         | After          |
| ---------------------------------------- | -------------- | -------------- |
| `reef-environment.glb` (three plates)    | 5,904,528 B    | 5,869,100 B    |
| `minke-whale.glb`                        | 644,040 B      | 455,312 B      |
| `sea-otter.glb`                          | 652,344 B      | 638,656 B      |
| `polar-bear.glb`                         | 682,688 B      | 685,632 B      |
| `whale-shark.glb` (markings map)         | 690,720 B      | 858,252 B      |
| `eagle-ray.glb` (markings map)           | 691,844 B      | 872,416 B      |
| Manta, great white, reef shark, humpback | about the same | about the same |
| **All models**                           | 43.87 MiB      | 44.00 MiB      |

- **Budget:** raised from 44 to 45 MiB (`tests/fish-lod-compression.test.ts`). The two baked
  markings maps cost about 0.33 MiB, partly repaid by the leaner minke, otter and plates. 44.00 MiB
  left no headroom.
- **Triangles:** every animal body stays under its 8000-triangle budget, with its 1400-triangle
  distance level.
- **Code-built growth:** more vertices per instance, but the same instance counts and draws.
  Geometry is built once per world.

## Unresolved artistic concerns

- **Bear and otter fur** is still a fine detail map over smooth forms, with no fur cards or shell
  fur. At close range they read as velvety rather than furry.
- **The otter's grizzle** is subtle at swimming distance.
- **Wreck plate laminae** are thin, sharp-edged petals. Up close, the junction between their roots
  and the crust can show.
- **Library plates' base** takes the coral texture's corallite dots, which suits dead coral but is
  not true rock.
- **The tank's plate hardscape fallback.** In `?reef=original`, or if the library fails to load,
  variants 0 and 1 render the new low colonies while their procedural colliders remain the old
  tall tables. That is invisible collision, in fallback only; the default tank shows variant 2,
  whose procedural collision matches.
- **Whale-shark lines** still follow a regular lattice under the warp. Real animals are more
  irregular from one individual to the next.
- **The humpback's tubercles** were smoothed with its fins; they read a little softer than before.
