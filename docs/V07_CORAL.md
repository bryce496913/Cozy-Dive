# V0.7 coral and reef ecosystem art (Pass 069)

Corals and reef growth move toward naturally grown forms.

**Unchanged:**

- the reef layout, placements and passages;
- the structural colliders and habitat anchors (same capsules, same counts);
- instancing and shared materials.

**Reproducible sources:**

- **Reef library:** `tools/art/pass014/reef_geometry.py` (seeded numpy construction), built in Blender by `tools/art/pass014/build.py`. Rebuilt with:

  ```bash
  python3 tools/art/pass014/build.py
  ```

  ```bash
  node tools/art/pass017/compress.mjs public/assets/models
  ```

- **Code-built growth:** the wreck, cave and ice modules in `src/environment/`.

## Inventory

| Form                         | Where                     | Source                    | Pass 069                                                                                                                                              |
| ---------------------------- | ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branching (Acropora) ×3      | tank, outer reef, catalog | reef library              | Encrusting foot; tissue collars at the branch base and at every bud                                                                                   |
| Massive brain ×2, Porites ×1 | tank, outer reef          | reef library              | **Rebuilt:** one grown colony surface (was one ball per lobe)                                                                                         |
| Plate / table ×3             | tank, outer reef, catalog | reef library              | Buttressed trunk flaring into an encrusting foot (was a stalk on a flat disc)                                                                         |
| Soft coral ×3, sea fan ×3    | tank, outer reef          | reef library              | Reviewed: continuous, kept                                                                                                                            |
| Acropora benchmark           | style benchmark           | `acropora.glb` (Pass 062) | Reviewed: kept                                                                                                                                        |
| Wreck growth                 | shipwreck                 | `WreckGrowth.ts`          | Soft-coral polyps are now fleshy catkins (were loose spheres); barrel sponge 44 segments                                                              |
| Cave encrusting life         | sea cave                  | `CaveEncrusting.ts`       | Smooth (creased) shading: sponge cushions, tube sponges, sea squirts                                                                                  |
| Ice garden                   | under the ice             | `IceGarden.ts`            | **Rebuilt** soft coral: a flaring trunk with curving branches swelling into polyp clubs (was cylinders tipped with spheres); glass sponge 36 segments |
| Kelp, wreck fans, hydroids   | kelp forest, wreck        | code                      | Reviewed: kept                                                                                                                                        |

**Gallery:** `node validation/v07/small.mjs` with `COZY_SET=coral` renders every coral and growth form with consistent framing.

## How the rebuilt corals work

- **Massive corals:** rays from the colony's core meet the union of its structural lobe hulls, and gaps between lobes fill as smooth saddles. The lobes therefore stay gentle bulges of one dome.
  - The meandering brain valleys and the cellular Porites hummocks are carved over that single surface. A slow colour drift is added across the colony.
  - The underside tucks into the substrate, and the base is clamped to the collider floor (tested), so colonies sit on their rock.
  - Same budget: one level-6 surface (81,920 triangles; Porites level-5, 20,480). The distance level is one level-4 surface (5,120).
- **Branching corals:**
  - every primary flares into the base with fused collars;
  - each budding branch swells where it leaves its parent;
  - an irregular encrusting foot climbs the trunks.

  Collars stay out of the distance level (tested: the far level is under 55 % of the near).

- **Plate corals:** the trunk radius flares exponentially toward its foot, which grows into a low, irregular encrusting skirt.

## Cost

From the browser baseline harness (`validation/v07/baseline.mjs`, `COZY_OUTER=1`), before → after:

| View                  | Draws    | Triangles     |
| --------------------- | -------- | ------------- |
| Tank, swimming        | 145      | 1.08 → 1.08 M |
| Tank, massive close   | 100 → 92 | 0.91 → 0.91 M |
| Tank, branching close | 119      | 1.12 → 1.13 M |
| Outer reef top        | 118      | 3.85 → 3.93 M |
| Outer coral close     | 118      | 4.03 → 4.12 M |
| Outer wall lip        | 116      | 4.17 → 4.25 M |

The reef library grows from 682k to 711k triangles in the file and from 6.11 MB to 6.15 MB. Textures and materials are unchanged.

## Validation

- **`tests/coral-overhaul.test.ts` (new, 18 tests):**
  - massive budgets and distance levels;
  - collider counts for all nine reef corals;
  - branching distance-level ratio;
  - massive colonies reaching their collider floor;
  - code-built growth shaded smoothly.
- **Full suite:** 93 files and 951 tests pass, including the existing reef placement, collision, asset, LOD and disposal tests. Typecheck, lint and build pass.
- **Captures:** before/after reef scenes and gallery comparisons are in `docs/screenshots/v07-pass069/`.

## Limitations

- **Branching silhouette:** the corals still rise from one or two tall trunks, because their structural capsules (colliders and habitat anchors) define the primaries. A true low, spreading staghorn thicket would need new capsules and a placement and collision review.
- **Massive outlines:** they still follow their two to four lobe capsules, though as one surface.
- **No new variants:** each species keeps its three variants. Variety on the reef comes from placement rotation, scale and tint, as before.
- **Colour:** the coral maps (Pass 015) and the reef's lighting response are unchanged. The tissue-colour drift on massive colonies is the only colour change.
- **LOD:** pop-in behaviour is unchanged. Plate and soft corals still have no distance level.
- **Captures:** SwiftShader stills.
