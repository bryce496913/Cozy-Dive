# V0.7 small and hidden marine life (Pass 068, small life)

Small, hidden, crawling and habitat-bound animals are brought toward the V0.7 standard, so they read as continuous organic forms up close.

**No behaviour changed.** Every builder keeps:

- its function, size, orientation and vertex-attribute contract (non-indexed position, normal and colour, merged and instanced);
- its habitat attachment, collision, sightings and animation.

**Numbering:** the user's brief numbered this Pass 068, the same number as the mammals-and-birds pass (#116). Files use the suffix `small` to keep them apart.

**Close-up gallery**

```bash
node validation/v07/small.mjs        # COZY_ONLY=urchin to filter
```

`validation/v07/small.html` frames every small animal to fill its cell from the same three-quarter and side views, under the tank light rig. It loads the authored libraries through the game's loader and calls the code builders directly.

## What changed

**1. Shading (every code-built small animal).** The builders used to make geometry non-indexed and then recompute normals, which gave every triangle its own flat normal. Spheres became faceted balls, limbs became prisms and shells became fans of flat facets.

The new shared helper `src/environment/shared/organicGeometry.ts` provides `smoothed()`, built on three.js `toCreasedNormals`:

- **Smooth below 75°:** five- and six-sided limbs and spines read round.
- **Crisp above it:** box corners and rims stay sharp.

All colour helpers now use it, and merges keep the normals as they are. Files affected: cave lobster and crab, ice extras, ice critters, ice garden, kelp shapes, Spanish shawl.

**2. Rebuilt as continuous organic geometry.** The shared `organicTube()` builds a tapering, rounded-ended tube along a smooth curve. The shared `polarSheet()` builds a curved shell or fin with interior rings.

| Animal                    | Before                                               | After                                                                                                                                     |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Brittle star (ice)        | Flat disc; arms as chains of 4-sided cylinders       | A soft pentagonal dome; five continuous, tapering, flattened arms that wave and lift at the tips, banded along their length               |
| Antarctic scallop         | A disc with no interior rings (flat), box ears       | Ringed valves showing dome, 18 radial ribs and growth bands; rounded ears; mantle eyes kept                                               |
| Sea pen                   | Box leaves on a cylinder                             | A gently curved rachis; curved, flattened, tapering blades sweeping up                                                                    |
| Sea butterfly             | A string of bead spheres; flat disc wings            | One coiled shell spiral; thin, cupped, fleshy wing-lobes                                                                                  |
| Feather star              | Arms of four stacked 4-sided cylinders; 3-sided pins | Continuous curling arms with pinnules down both sides                                                                                     |
| Cave rock crab            | Legs of stacked cylinders with ball joints           | Each walking leg one tapering surface through hip, knee, ankle and foot, banded at the joints, dark-tipped. The shader gait is unchanged. |
| Purple urchin, ice urchin | 3- and 4-sided spines                                | Rounded spines                                                                                                                            |
| Cave lobster limbs        | 5-sided                                              | 8-sided                                                                                                                                   |

**Benefiting from smooth shading alone:** isopod, sea cucumber, salp, comb jelly, krill, bat star, spiny lobster body and Spanish shawl.

## Cost

Measured in the browser world harness (`validation/v07/worlds.mjs`, fixed views, SwiftShader):

| World         | Triangles before → after | Draws     |
| ------------- | ------------------------ | --------- |
| Under the ice | 1.79 → 2.10 M            | unchanged |
| Kelp forest   | 2.41 → 2.53 M            | unchanged |
| Sea cave      | 1.07 M after             | unchanged |

- **Rebalanced after a first build:** the first version doubled the ice world. The feather star (50 instances), sea pen (45) and scallop (280) were then cut back to what is visible at their size. For example, the feather-star pinnules are small open cones rather than tubes.
- **Cave baseline:** this pass did not capture a separate "before" figure for the cave.
- **Untouched:** no textures, materials or downloads changed.

## Validation

- **`tests/small-life.test.ts` (new):**
  - continuity and taper of the tube helper, and interior rings on the polar sheet;
  - crease shading: spheres smooth, boxes crisp;
  - for 16 builders, the unchanged merge contract and finite positions;
  - for 15 builders (all except krill), smooth shading (area-weighted smoothness above 0.5);
  - authored sizes of the brittle star, scallop and crab.
- **Full checks:** the full suite (92 files, 933 tests), typecheck, lint and build pass.
- **Browser smoke:** the cave, ice and kelp worlds build and render in the world harness with no errors (9 views).

## Inventory: reviewed and left as they are

- **Seahorse, frogfish, moray, anemone** (`anchored-life.glb`, authored in Blender in Pass 015) and the **five nudibranchs** (`nudibranchs.glb`) are already authored, textured models. They are assembled and animated at runtime:
  - the seahorse's tail grip;
  - the frogfish's jaw hinge and lure;
  - the moray's dense code-built head (`MorayHead.ts`, 64×72 stations) and jaw.

  The gallery shows them as stored (parts unassembled), not as posed in game.

- **Moon jelly, octopus, squid, spiny lobster, isopod, cucumber, salp, comb jelly, krill, sponges, soft corals:** already continuous forms; they now shade smoothly too.

## Remaining artistic limitations

- **Seahorse:** coronet, snout and plates are as authored in Pass 015. They need a Blender rework against the V0.7 hero standard: a sharper crown and clearer bony rings.
- **Frogfish:** its skin protrusions (esca, warts) are texture-led. Modelled filaments around the lips would reward close inspection.
- **Moray:** the body is a textured tube; skin folds behind the head and the dorsal-fin junction could be modelled.
- **Crustaceans:** antennae and the lobster's legs are still tapered cylinders, though with more sides. Joints are banded by colour, not modelled as overlapping segments.
- **Translucent animals:** the comb jelly's comb rows, the salp's bands and the jellies' bells keep their existing shading; there is no refraction or iridescence shader.
- **Animation:** unchanged. The brittle star's arms, the sea pen's blades and the feather star's pinnules don't move independently; animals move as whole instances, as before.
- **Captures:** SwiftShader stills.
