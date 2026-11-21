# V0.7 underwater vegetation and plant motion (Pass 071)

The kelp forest is smoother, more varied and fuller. Kelp and aquarium plants now bend through the water with continuous curvature, in uneven, unsynchronised gusts.

**Unchanged:**

- placements, plant bases and anchoring;
- instanced rendering and GPU animation;
- the swimmer's push through the kelp;
- reduced-motion behaviour.

**Close-up gallery:** `COZY_SET=plants node validation/v07/small.mjs`.

## Audit

| Vegetation                                                                        | Source                                           | Finding                                                                                                                               | Pass 071                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Giant kelp (forest and walls, ~200 plants)                                        | `KelpStalks.ts`                                  | Flat-shaded facets (normals recomputed after de-indexing), flat two-edge strip blades, 4-sided stipes, 3 templates, a near-rigid sway | **Rebuilt**                     |
| Tank kelp patch                                                                   | `kelpPatchGeometry` (from the same template)     | Same faceting                                                                                                                         | Smooth normals                  |
| Turtle grass, meadow blades, Caulerpa, Halimeda, red algae, soft corals, sea fans | reef library and `PlantSystem` / authored plants | Recognisable, species-specific forms, but swaying as rigid units, sharing the same timing                                             | **Motion:** curvature and gusts |

## Kelp

**Geometry**

- **Smooth shading:** normals are computed per part while it is still indexed and kept through the merge, so blades, stipes and bulbs shade smoothly.
- **Blades:**
  - three columns (edge, raised midrib, edge), giving a gentle V cross-section that catches light;
  - a narrow stalk-like base at the bulb;
  - a slow twist along the length and ruffled edges.
- **Stipes and holdfasts:** 6-sided stipes and 5-sided holdfast haptera.
- **Five height templates, up from three:** 14.5 m to the surface, so neighbouring plants rarely repeat.
- **Blade spacing:** blades are spaced slightly further apart (0.34–0.50 m) and are a little wider, keeping the canopy full within budget.

**Motion (vertex shader)**

- **Travelling wave:** the sway travels up the stipe (each height lags the one below), so plants curve rather than lean.
- **Slow uneven gusts:** each plant's own phase swells and eases its sway, so the forest never moves in step.
- **Blade flutter:** blades flutter gently along their length, driven by a per-vertex flex weight. It is zero at holdfast, stipe and bulbs, so bases stay anchored.
- **Unchanged:** the swimmer push. Reduced motion freezes the sway and flutter but still lets plants lean away from the swimmer, as before.

## Aquarium and outer-reef plants

The shared plant shader (`PlantAnimation.ts`) now recovers each vertex's normalised height from the existing motion contract (flex = h² × sway, tilt = 2h × sway), so no data format changes. It uses that height to:

- **Lag the current up the plant:** grass, algae, soft corals and fans bend with continuous curvature.
- **Add slow per-plant gusts:** this breaks up synchronised swaying.

Amplitude never exceeds its previous bound, so culling bounds are unchanged.

## Cost

| View             | Triangles     | Draws     |
| ---------------- | ------------- | --------- |
| Kelp forest      | 2.65 → 3.05 M | 56 → 58   |
| Kelp rocks close | 2.51 → 2.91 M | 42 → 44   |
| Tank (all views) | unchanged     | unchanged |

- **Kelp (+15 % triangles):** the cost is the midrib blades. Two more draws come from the two extra templates.
- **Shader cost:** the plant shader gains a few ALU operations per vertex.
- **Downloads:** no new textures or files.

## Validation

- **`tests/vegetation.test.ts` (new):**
  - five distinct templates;
  - smooth normals;
  - the flex weight is zero at the holdfast and rises along blades;
  - the tank patch keeps normals without the forest-only attribute;
  - reduced motion freezes the sway while the swimmer push still updates;
  - the plant shader recovers height and lags the flow.
- **Full suite:** 95 files pass, including the kelp forest, kelp passage and plant tests, as do typecheck, lint and build.
- **Browser runs:** the kelp forest (3 views) and the aquarium (7 views) render in the browser with no errors.

## For the playtest (approval gate)

- **Kelp forest:** swim through dense groves. Kelp should part around you and spring back. The sway should read as slow, curving and unsynchronised, and blades should flutter softly.
- **Aquarium:** seagrass and algae should bend from the base up in gentle, uneven gusts.
- **Reduced motion:** with it on, the sway stops while kelp still leans away from you.

## Limitations

- **Motion not shown:** the captures are fixed-clock stills (SwiftShader). They show geometry, but the motion itself needs the playtest.
- **No translucency shader:** the kelp keeps its existing warm emissive glow.
- **Library plants unchanged:** turtle grass, Caulerpa, Halimeda and red algae geometry is unchanged; only their motion improved.
- **Fish and vegetation:** fish don't yet react to vegetation beyond their existing habitat rules.
