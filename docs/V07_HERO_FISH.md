# V0.7 hero fish (Pass 065)

The blue-green chromis, ocellaris clownfish and royal gramma are rebuilt from anatomy in the approved Crafted Stylized Realism standard. They set the modelling, texturing and animation standard for the rest of the fish roster.

**Rebuilding a fish**

The source is [`tools/art/pass065/hero_fish.py`](../tools/art/pass065/hero_fish.py), which uses the V0.7 helpers in `tools/art/v07/cozy_art.py`. Run these steps in order:

```bash
python3 tools/art/pass065/hero_fish.py
```

```bash
node tools/art/pass017/compress.mjs public/assets/models
```

```bash
node validation/AssetStandards.ts public/assets/models/fish/chromis.glb
```

```bash
python3 tools/art/inspect_assets.py
```

Neutral turnarounds come from `tools/art/pass065/turnaround.py`. Packed `.blend` sources are saved beside the script.

## What changed

| Area     | Before (accepted Pass 012 rig and its reshapes)         | Pass 065                                                                                                                                                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body     | An elliptical loft. The gramma was a stretched chromis. | Superellipse cross-sections per species: flatter flanks, a narrower back than belly, its own midline, a slim peduncle and a blunt or pointed snout.                                                                                                                                                                                                                                                   |
| Head     | A tube drawn on as the gill line; mouth folds as tubes. | The gill cover is a real step in the skin, bulging back at mid-height. The mouth is a groove.                                                                                                                                                                                                                                                                                                         |
| Eyes     | Spheres stacked on the surface.                         | A carved orbit with a soft brow, and a lens-shaped eye (pupil, iris, skin rim) seated in it, tilted slightly forward.                                                                                                                                                                                                                                                                                 |
| Fins     | Flat zero-thickness fans.                               | Membranes with thickness: thicker at the base, ray ridges, a gentle billow between rays and a closed thin edge. Bases sit inside the body so the fins grow out of it. Per-species caudal shape: forked chromis, rounded clownfish, truncate gramma. Clownfish has a notched dorsal fin.                                                                                                               |
| Textures | Shared chromis maps, retinted.                          | Per-species 512 px base/normal/ORM maps painted in UV space from each point's position on the body. Pigment: chromis countershading; clownfish bars with black margins; gramma violet-to-gold with the eye line. Scale relief is subtle and stops at the gill cover. Roughness varies, with a darker gill groove. Fin maps carry rays, translucency toward the edge and the clownfish's black margin. |
| Stroke   | A plain bend toward the tail.                           | A carangiform S-curve that keeps length: the head counter-swings slightly, and the peduncle and tail bend most. One deformation field moves skin and fins together.                                                                                                                                                                                                                                   |

**Unchanged**

- **The runtime rig contract:** `<Species>_Root`, `Body`, `Median_Fins`, `Eyes_Gills_Mouth`, pivoted `Pectoral_Left`/`Right`, `Stroke_Left`/`Right` morphs, `_LOD1` levels with transferred morphs, and the `SwimPreview` clip.
- **No runtime code changes**, so these behave exactly as before:
  - `AuthoredSchool` instancing (one instanced mesh per part, per-instance morph weights and tints);
  - fish AI and schooling;
  - turning and banking, which follow the simulated heading;
  - the effort-driven stroke.

## Cost

| Fish      | Near triangles (before → after) | Distance triangles (before → after) | File size (compressed) |
| --------- | ------------------------------- | ----------------------------------- | ---------------------- |
| Chromis   | 12,686 → 11,316                 | ~1,763 → 1,956                      | 0.61 → 0.70 MB         |
| Clownfish | 12,686 → 11,448                 | ~1,763 → 1,948                      | 0.47 → 0.69 MB         |
| Gramma    | 12,686 → 11,580                 | ~1,764 → 2,008                      | 0.61 → 0.71 MB         |

- **Draw calls are unchanged:** the parts and materials per fish are the same as before.
- **File sizes grew** because each species now has its own maps (four 512 px KTX2 maps) instead of shared, retinted chromis maps.
- **Distance levels grew slightly:** the eye distance level keeps 30 % of its triangles so it stays within the near level's bounds.

## Validation

- **Production checks:** `validation/AssetStandards.ts` reports no errors and no warnings for all three fish.
- **Tests:** `tests/hero-fish.test.ts` covers the rig contract, budgets (cheaper than the old rig), species length and the production checks. With the fish, asset, tank and style suites, 246 tests pass.
- **Test reference change:** the Pass 016 topology test now compares against the pinned accepted chromis source. The cardinalfish, firefish and assessor are still reshaped from it.
- **In-game captures:** fixed-clock side views of real simulated fish (`COZY_FISH=1` in `validation/v07/baseline.mjs`) and the chromis school view, before and after, in `docs/screenshots/v07-pass065/`.

## Limitations

- **Gramma details:**
  - the black dorsal-fin spot is not modelled;
  - all fins share one fin map, so its pectorals take the gold tone.
- **Remaining roster:** cardinalfish, firefish, assessor and the other species still use the Pass 016 rig. They should be rebuilt on this builder in the roster pass.
- **Software rendering:** captures use SwiftShader stills. Fin translucency overlap in dense schools and motion quality need a short look in the real game.
