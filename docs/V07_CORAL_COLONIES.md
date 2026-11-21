# V0.7 organic branching coral and reef composition (Pass 077)

The three branching corals were one shared frame: a 1.25 m vertical trunk forking into a 1.8 m "Y" on a flat disc foot, with ball-shaped junctions. In the outer reef they are scaled up to 1.9×, which made pillars about 3.4 m tall that repeated across the reef. This pass replaces them with three naturally grown colony forms.

**Unchanged:**

- the reef layout and the coral population;
- every other library asset (126 nodes, byte-identical geometry);
- habitat anchors and instancing.

## Colony archetypes

| Colony              | Archetype                    | Form                                                                                    | Size (w × h × d)    |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | ------------------- |
| `Coral_Branching_0` | spreading (staghorn) thicket | five primaries splay out from one foot; secondaries fork off at 30–50° and curve upward | 1.5 × 1.2 × 1.45 m  |
| `Coral_Branching_1` | asymmetric corymbose head    | two short stems fork into a dense canopy whose tips reach a dome leaning to one side    | 1.25 × 1.1 × 0.9 m  |
| `Coral_Branching_2` | tabular, digitate            | a flared stalk under near-horizontal arms and branchlets, crowded with upright digits   | 1.65 × 0.65 × 1.6 m |

**Silhouettes:** `docs/screenshots/v07-pass077/colony-silhouettes.jpg` (plain background, side view, before and after) and `colony-shaded.jpg` (three-quarter view).

## How they are made

Sources: `tools/art/pass077/colony.py`, called by `branching_coral()` in `tools/art/pass014/reef_geometry.py`, built by `tools/art/pass014/build.py` (Blender 5.1) and compressed by `tools/art/pass017/compress.mjs`.

1. **Structure.** The five primaries of each colony are defined once, in `src/config/coralColonies.ts`. The tank builds its colliders from them, and they reach the Blender library through `baseline.json`. Only the branching formations' parts were refreshed there (origins, rocks, plants and the other corals are unchanged).
2. **Growth.** An archetype rule grows secondaries, tertiaries and digits on the primaries. Every branch tapers continuously toward its growing tip (radius 74 mm at a primary's base, 12–16 mm at the tips).
3. **Fusion.** Every branch segment is a tapered capsule in a signed distance field. An exponential smooth union fillets each junction, so branches leave their parent as continuous tissue and the colony grows out of one lumpy encrusting foot sunk into the substrate. The field is polygonised with marching cubes (6.5 mm cells).
4. **Blender reduction.** Blender's Decimate (collapse) modifier reduces the dense surface to a near level (30k triangles of tissue) and a distance level (10k) of the same silhouette, so distant colonies stay stable.
5. **Detail.** Budding radial corallites (near level only) and pale axial corallites capping every growing tip (`_Tips`).
6. **Colour.** Pass 015's palette is kept: darker, older bases, paler growing tips, and canopy and cavity occlusion toward the interior.

## Colliders and navigation

Each colony still has five convex colliders, now following the new primaries (tapered capsules 0.09 → 0.045 m).

- **Tank:** `HardscapeSystem` builds the colliders from the shared config. Each primary still draws exactly one random number, so the placement of every other formation, rock and plant is unchanged (verified: all non-branching baseline data is identical).
- **Footprint:** the colliders stay inside the tank's reserved 0.95 m formation footprint.
- **Outer reef:** every branching colony's colliders are checked to stay clear of the sand gully, the tunnel mouth and the kelp cleft.

**Tests:** existing collision, passage, fish placement and habitat tests pass unchanged.

## Composition

The layout was reviewed but not regenerated.

The problem was the shape, not the placement:

- the three branching templates repeated one tall, vertical tree;
- at outer-reef scales of 1.1–1.9× that tree towered over the massive and plate corals.

The new forms give the reef three scales of structure:

- large flat tables and broad thickets;
- medium heads;
- the existing massive and plate colonies.

Branching colonies now sit in the same height band as their neighbours, instead of rising 3 m above them.

**Tank catalog:** the "Branching coral" item takes the thicket's proportions (0.97 × 0.75 × 0.93). The `branching-tall` item is relabelled "Branching coral head" (0.96 × 0.85 × 0.7); its id is kept so saved tanks still load.

## Cost

**Library, per colony (triangles), before → after:**

| Colony | Near            | Distance        | Tips          |
| ------ | --------------- | --------------- | ------------- |
| 0      | 52,391 → 36,810 | 18,661 → 10,000 | 3,051 → 1,449 |
| 1      | 45,871 → 37,859 | 17,051 → 9,999  | 2,652 → 1,539 |
| 2      | 50,083 → 37,829 | 18,053 → 9,999  | 2,886 → 9,876 |

The shipped GLB goes from 6.15 MB to 5.90 MB. Textures and materials are unchanged.

**Browser baseline** (`validation/v07/baseline.mjs`, `COZY_OUTER=1`, SwiftShader), before → after:

| View                  | Draws     | Triangles     |
| --------------------- | --------- | ------------- |
| Tank, swimming        | 145 → 144 | 1.08 → 1.06 M |
| Tank, medium          | 110 → 97  | 0.92 → 0.84 M |
| Tank, branching close | 119 → 106 | 1.13 → 1.03 M |
| Outer reef top        | 118       | 3.93 → 3.68 M |
| Outer coral close     | 118       | 4.12 → 3.85 M |
| Outer wall lip        | 120 → 116 | 4.25 → 3.99 M |

## Validation

- **`tests/coral-colonies.test.ts` (new, 6 tests):**
  - three distinct archetypes;
  - no near-vertical primary taller than 0.55 m, and colonies broader than they are tall;
  - tank colliders built from the config, inside the reserved footprint;
  - per-colony budgets and the distance-level ratio;
  - grounding (an encrusting foot below the origin);
  - outer-reef colonies clear of the gully, mouth and cleft.
- **Affected suites:** coral, reef, collision, passage, outer reef, habitat, fish placement and tank catalog tests pass (20 files, 180 tests).
- **Checks:** typecheck, lint and build pass.
- **Captures:** matched tank and outer-reef views in `docs/screenshots/v07-pass077/`. No full-game test was run.

## Limitations

- **Tabular colony vs plate coral:** the tabular colony reads close to the existing plate corals from a distance. It is distinguished by its digits close up.
- **Corallites:** they are geometry on the near level only. Far colonies rely on colour and silhouette.
- **Tank seating:** on steeply domed rocks the encrusting foot can sit below the rock surface, so only the stems emerge from it.
- **Overlap:** neighbouring colonies on the same outer-reef rock may overlap slightly, as the layout was not regenerated.
- **Captures:** SwiftShader stills. Motion, lighting and look on the MacBook Air need the user's in-game check.
