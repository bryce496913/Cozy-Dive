# Cozy Diver art direction — candidate foundation

The target is high-quality stylized realism: a carefully crafted miniature marine reef, believable anatomy, subtle coloration and useful inspection detail. Recognition is necessary but insufficient. The player should see fine detail become meaningful as they approach, rather than discover a larger smooth primitive.

## Shape and surface

Chromis should have a compressed almond-like body, a restrained forehead/snout, narrow peduncle, deeply forked caudal fin, separate dorsal/anal/paired fins, small integrated eyes and a subtle operculum/mouth. Avoid oversized eyes, interchangeable fins, armor-like scales, metallic paint and disconnected parts. Scales should affect roughness and fine normals without looking engraved. Colors move from cool blue-green on the back/flanks toward a pale underside; tint changes remain within one species.

Coral should convey biological growth: asymmetric branching decisions, varied taper, secondary growth, continuous basal contact, pale living tips and recessed axial/radial corallites. Surface cups must join living tissue rather than float beside an erased branch. Avoid cloned cylindrical forks, dead flat cuts, plastic sheen and isolated polka-dot polyps. Muted peach, cream and lavender can coexist with shadowed pink recesses.

Use authored topology and UVs where the silhouette matters, geometry for readable eyes/fin rays/calyx rims, and modest normal/roughness maps for finer relief. A GLB container does not confer quality. Inspect the actual exported glTF, not just Blender's material preview. Blender source and reproducible scripts belong beside the assets.

## Materials and light

Use local PBR base color, normal and roughness/metal channels at an initial 512px. More resolution must earn visible improvement. Keep fish metalness zero and vary roughness deliberately; restrained specular response should reveal curvature without hard chrome highlights. Thin fins may use single-pass blended membranes with depth writing off; review overlap and the two sides of the school. Batch transparency is a known constraint, not a reason to remove anatomy.

Preserve blue-green water and depth falloff. A directional surface key, quieter broad fill and limited contact shadow should separate forms. Do not flatten the reef with excessive ambient illumination/exposure or hide weak assets behind bloom/particles. Keep warm/cool balance coherent across skin, tissue, sand and existing rock. No full-scene postprocessing is authorized by this foundation pass.

## Motion and composition

Retain the accepted locomotion and individual behavior. A continuous body/peduncle/median-fin bend and independent paired fins should communicate effort, gliding and stationary activity. Turning/banking follow simulation poses. Pause must freeze exactly; reduced motion must preserve essential swimming while reducing existing optional motion. A rigid model rotated as a whole is insufficient.

Compose foreground sand/reef/vegetation, a readable animal or coral in the midground, and distinct silhouettes with gentle background falloff. Keep open water; do not conceal insufficient craft with clutter. Review from an actual first-person-sized camera volume, at side, oblique, close and swimming distances.

## Budgets and acceptance

The Pass 012 candidate is an original Blender-authored chromis and Acropora-inspired colony. The user accepted its chromis direction as the reference for Pass 013. See the [matched renders and animation](VALIDATION_V02_PASS_012.md). Pass 013 candidate geometry still requires its own review.

Measure shared draw submissions, triangles, texture/geometry allocations, animation cost, load time and disposal. The first candidate retains 20 instances of one fish asset and one coral; it does not replace the whole reef. Near-camera detail may justify a future measured LOD reduction; do not assume a software-rendered cloud interval predicts MacBook Air FPS. The target reference remains 16.7 ms per hardware frame, with meaningful p95/p99 and long-session checks on the actual device.

For Pass 013, first obtain acceptance of anatomy, scale relief, fin softness, coral density/branch transitions, lighting and material polish. Then use the accepted Blender scene, actual asset budgets and artist review as a contract for the remaining roster. Further sculpting/texture paint and target-device profiling may be needed; test success does not waive that work.

## Pass 013 — authored hero geometry

The accepted Pass 012 chromis direction is the reference: anatomical cross sections, resolved edges, dimensional fins and restrained PBR detail. The default aquarium now applies that workflow to its six ornaments and location-bound hero creatures. Inspection should show construction and silhouette changes: bowed layered wreck planks and frames; broken log knots and an uneven continuous bore; weathered individual arch stones; recessed filter grille, brackets and nozzle; barrel-planked articulated chest lid and hardware; carved asymmetric statue facial planes. Small attached growth belongs to the ornament and follows its scale.

Seahorse torso/head profiles, crown and tapering gripping coil replace uniform primitive reads. Frogfish get fleshy lips, eye hoods, dermal tassels, webbed weight-bearing feet and a branching lure. Moray anatomy has a continuous deforming body/median fin and separate modeled head/jaw/eyes. The anemone has a dimensional pedal/oral disc and 96 varied sinuous tentacles. Clownfish retain the accepted morph workflow with fuller species proportions, white bands/dark margins and a rounded tail. These changes should earn their geometry through visible form, not only smoother subdivisions. Existing unconverted reef/background fish remain outside this pass.

The aquarium keeps its current quiet palette, original lighting, swimming, audio and creature routines. Target-machine visual/performance approval remains the user's review of the unmerged PR; software-rendered Linux captures document candidate appearance and technical compatibility, not macOS acceptance.
