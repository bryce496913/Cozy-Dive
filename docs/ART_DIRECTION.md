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

## Pass 014 — reef, coral and background environment

The environment now follows the same slightly stylised realism as the accepted Pass 012 chromis. The rule for reef structure is **carve, don't inflate**: every reef rock is a dense authored surface carved _inward_ from its accepted structural hull, so silhouettes can break up without adding solid volume. Upward faces that carry corals, plants and the host anemone keep a shallow tolerance. Four archetypes are distributed over the six accepted rock silhouettes:

- **Porous reef limestone**: flat-bottomed solution holes, broad erosion embayments and rounded fracture faces.
- **Organic reef outcrop**: lobes left standing between deep recesses, with small ledges and undercuts.
- **Layered sedimentary reef rock**: per-stratum recesses, weathered bedding seams, overhanging lips and planar broken faces.
- **Crevice and overhang**: two narrow clefts and a shaded undercut beneath an upper ledge.

Fine pores, corallite cups, brain ridges and blade striations live in 512² normal/ORM maps, not geometry. Rock colour is warm grey and beige mineral with cool-grey patches, a faint green-grey film on upward faces and sparse muted coralline pink. Recesses are darker, fresh fracture faces are lighter, and a sand-dusted band blends each rock into the substrate. Rocks sample their maps triplanarly in world space, so the 34 non-uniformly scaled placements keep a consistent texel density with no UV seams.

Hard corals follow the exact structural parts their colliders already describe, adding passable growth beyond them:

- **Branching**: primaries follow the structural capsules, with fused collars, irregular secondary and tertiary growth, lighter axial tips and an encrusting basal plate.
- **Massive**: each lobe is carved with maze-like valleys (zero crossings of band-limited noise), or with knobbly lobules for the boulder variant. Lobe undersides are tucked so the colony reads as massed growth, not stacked balls.
- **Plate**: an organic trunk carries struts and tiered plates with scalloped, upturned and ridged rims, concentric growth bands, shaded undersides and short rim branchlets.

The palette is restrained cream, peach, muted pink, sandy yellow, warm grey, lavender, soft green and occasional blue-green.

Soft corals are fleshy, lobed, branching fingers. Gorgonian fans are gently cupped, anastomosing lattices on a stout holdfast. Turtle grass forms 12–15-blade clumps with droop, twist, yellowing tips and pale bases. Caulerpa has stolons with pinnate fronds, Halimeda has segmented calcified chains, and red algae fork dichotomously. Every plant template stays inside the radial envelope its accepted placement validated, and keeps the existing current, pause and reduced-motion contract.

Sand gains ripples, shallow depressions and banking against structures, all above the habitat reference surface. A tileable grain, grit and micro-ripple map adds detail, and pooled shells and coral rubble add scale. Depth comes from flattened low-detail reef rock layered against the rear and side glass (within 0.2 units) and a centre-weighted meadow understory. The tank stays a tank: nothing is placed outside the glass, and the central channel stays open.

Do not hide geometry with fog or darkness, or judge it by triangle counts. Review against the matched renders in [Pass 014 validation](VALIDATION_V02_PASS_014.md).

## Pass 015 — corals and creatures to the reef standard

The Pass 014 rocks and sand set the bar: multi-scale relief, continuous object-space colour and pattern, cavity and underside occlusion, and fine tileable micro-detail maps. Pass 015 applies the same recipe to everything living in the tank.

- **Corals.** Branching colonies bud tubular radial corallites on every outer branch, with pale growing tips over a darker, shaded interior. Brain colonies use double-resolution lobes, so 8–10 sharp meanders cross each lobe, with pale collines and dark green-brown valleys. The boulder colony has Porites-style hummocks with mottled tan and purple patches. Plate colonies get a gnarled, buttressed trunk and banded plates. Soft corals have darker stalks and paler, polyp-dense finger tips, and fans are denser. New maps provide corallite cups and septa, brain septa, plate costae and extended eight-armed polyps.
- **Creatures.** Each is re-authored on its accepted mesh, so pivots, frames and animation contracts are untouched:
  - **Frogfish**: warty, ochre-orange skin with rust blotches, dark ocelli and a pale belly.
  - **Seahorse**: raised bony rings and tubercles, dark seams and saddles, white speckle.
  - **Moray**: subtle skin folds under a continuous honeycomb reticulation that runs from body to head.
  - **Host anemone**: a bubble-tip form, with green-tan tentacles, a white sub-terminal band, swollen magenta tips and a striped oral disc.
- **Nudibranchs.** Five authored species replace the procedural lozenges, one per accepted variant. Aeolids have oral tentacles, lamellate rhinophores and rows of spindle cerata with banded tips. Dorids have a flared, undulating mantle with a contrasting border, raised spots, lamellate rhinophores and a bipinnate gill plume.

Colour stays restrained and natural. Pattern belongs to the animal's form (continuous across joined parts), not to UV islands. Review against the matched captures in [Pass 015 validation](VALIDATION_V02_PASS_015.md).
