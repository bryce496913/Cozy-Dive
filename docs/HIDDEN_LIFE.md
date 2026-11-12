# Hidden marine discoveries — Pass 010

`AnchoredLife.hidden` owns **one seahorse, one frogfish and five nudibranchs**. They remain outside the unchanged 40-fish registry. No markers, outlines, notifications, collection state, achievements, discovery order or progress UI are added. Discovery consists of noticing a small, camouflaged animal while exploring its habitat.

## Stable homes and safe observation

Every `DiscoveryHome` extends the existing scene-free creature-anchor contract with a focus point, body-safe viewing location and explicit four-waypoint approach from spawn. Initialization validates the three swept route legs via clear water above the banks and checks an unobstructed viewing ray. These are validation/future-consumer metadata; they are never rendered as guidance.

The seahorse uses a real sea-fan/macroalgae/seagrass placement and a nearby stem grip point. The frogfish favors the wreck. Nudibranchs prefer log/statue/wreck/coral/reef surfaces and use other eligible stone or ornament faces when a preferred surface cannot safely fit the entire crawling envelope. Each surface home references an actual immutable convex component and plane. Moving chest lids are excluded. `OrnamentSystem.surfaceGroups` exposes named groups of existing component references without changing geometry, collision or placement.

The local patch must fit the full foot/path envelope on the selected plane, avoid adjacent solids and have a reachable view. Small crawlers use a circular envelope covering every heading; the larger perch animal uses a rectangular footprint. A minimum separation keeps crawling regions distinct. Positions, IDs, source faces and routes are deterministic across reloads. Hidden does not mean buried in geometry or inaccessible. Homes and views are chosen at construction against the procedural structural hulls, before any authored asset loads. The frogfish's view sits 0.9 units above its focus instead of the default 0.55. At the default height the authored Pass 013 wreck hulls overhang every candidate view, but at 0.9 the view and its three 0.65-unit approach sweeps are clear with procedural, authored-ornament and Pass 014 reef hulls. The home, perch face and behaviour are unchanged, and `tests/authored-collision.test.ts` and `tests/reef-environment.test.ts` run `integrationRoutes` against those composed worlds. Wide/close evidence and technical coordinates appear in [validation](VALIDATION_V02_PASS_010.md), not in the product UI.

## Seahorse

A custom upright torso follows a curved neck into a horse-shaped head and long snout. Bony segment rings, a tapered curled tail, a crown, dimensional eyes, a small dorsal membrane and paired pectoral fins distinguish it from ordinary fish. Muted vegetation-colored skin provides camouflage.

It hovers vertically within a 0.12-unit root region beside its assigned vegetation. A 42-second local cycle alternates quiet grip and gentle floating/repositioning; tail tightening and hover amplitude blend smoothly across the transition. The tail curls around the nearby stem region as a visual grip, not a physics constraint. Fluttering fins use the shared optional-motion phase. A nearby active diver produces a small turn/settle into cover, never darting or pursuit. Tiny transparent fins use single-pass rendering.

## Frogfish

The compact, irregular body has a broad lumpy head, mottled sandy coloration, a large lip-lined mouth, small eyes, limb-like webbed pectoral fins, a stubby caudal fin and a gently moving lure. These are dedicated anatomy, not a recolored free-swimming model.

Most time is spent still. Breathing/posture and lure movement are restrained. The mouth opens and closes: a slow respiratory gulp every 3.2 motion seconds (up to 0.11 rad), and once every 19 seconds a yawn that opens to 0.42 rad over 0.8 s, holds for 0.7 s and closes over 1.3 s. `frogfishGape(time)` is pure and continuous, and `pose` writes it to the `jaw` pivot (a child of the breathing body at `FROGFISH_JAW_HINGE`). It runs on the discovery clock, so it freezes on pause and settles to a still pose with reduced motion like every other discovery motion. Every 112 active motion seconds, an eight-second eased walking interval moves between nearby perch points, with alternating small pectoral lifts. Its root stays within 0.10 units of home and spends under 8% of time walking. It ignores distant activity; close proximity only adds a tiny posture response. There is no lunge, prey capture or damage.

### Lifelike re-author

The authored frogfish was rebuilt from scratch by `tools/art/frogfish/frogfish.py` so it matches the authored fish. The earlier model was a smooth ball with stacked ring lips, a flat mouth disc and a translucent fin pane.

- **Body.** The new body is a lumpy, laterally compressed shape sampled from a smooth union of ellipsoids. It has a steep face, a dorsal hump, fleshy second and third dorsal spines and a short caudal peduncle. Its sole is flat on the rock.
- **Mouth.** The lower jaw is the same skin surface cut by two planes through the hinge axis. Closed, it is seamless with the head (the mouth corners coincide within 2 mm, which a test checks). Open, it rotates like a real jaw and reveals a recessed dark palate, a mouth floor with fine teeth, thick banded lips and a skin fold under the chin.
- **Detail.** Small gold eyes with horizontal pupils sit in warty lids. The illicium (rod) has a tufted esca and grows from the snout. The soft-dorsal, anal and curled caudal fins are opaque and rayed. Elbowed pectoral arms end in webbed hands with fringed fingers, and finger-like pelvic fins sit under the throat. Warts and soft cirri cover the skin.
- **Colour.** Vertex colour carries an ochre ground, rust saddles, pale patches, fine mottling, dark ocelli and a ringed eyespot below the dorsal fin. It sits over the shipped `FrogSkin15` micro-detail maps, and the existing reef-rock camouflage tint still applies.

The procedural fallback (used only when the asset fails to load) splits its lower lip and chin onto the same hinge, so it also opens its mouth. Matched evidence: [perch view before/after](screenshots/frogfish/before-after-perch.png), [close-ups before](screenshots/frogfish/before-close.png) and [after](screenshots/frogfish/after-close.png), and [the mouth opening and closing](screenshots/frogfish/mouth-sequence.png).

## Five nudibranchs

The variants are blue/orange cerata, yellow/purple dorid, pale contrasting-edge dorid, orange/white cerata and soft violet dorid. Each has a soft flattened foot, raised edged mantle, paired rhinophores with small lamellae and either branching cerata or a feathered gill plume. They are small invertebrates rather than colored worms.

All five share one body geometry and two appendage templates through **three instance batches / one material**. Per-instance palettes select natural base, edge and appendage colors. A bounded shader ripple affects soft upper tissue; the flat underside stays attached. Geometry, buffers and materials are never rebuilt during animation.

Each follows a tiny tangent-plane ellipse (0.055 × 0.075 units), roughly nine minutes per circuit. Heading follows the path tangent while the surface normal stays fixed. The 0.285-unit patch envelope includes the body, every heading and optional ripple. There are no global runtime raycasts, pathfinding or open-water swimming. No dramatic player response is added.

## Time, safety and ownership

`DiscoveryClock` uses fixed 30 Hz active updates with render-time interpolation. Deliberate behavior follows slow deterministic schedules; transforms and shader phases sample the same clock. The existing `PlantClock` smoothly settles optional motion for reduced motion, preserving the current pose rather than resetting an animal. Pause stops state, phase and instance updates; long frame gaps cannot produce a backlog. Personal-space responses read player data without writing player state.

The layer adds no collider, force, audio layer, setting or animation loop. Its seven tiny animals cannot be pushed, collected or damaged. The seahorse and frogfish use lightweight transforms; nudibranch motion uses five instance transforms and a scalar uniform. Materials/geometries and instance buffers have explicit idempotent owners and detach before generic scene cleanup.

Appearance remains stylized, including simplified tail attachment, frogfish skin and surface paths. Close viewing and subjective comfort need manual macOS review. The original fish, anemone, moray, vegetation, ornaments, audio and locomotion remain in place.

Pass 011 keeps this production architecture unchanged and adds whole-aquarium validation of clocks, transforms, resource counts, particles and lifecycle across extended sessions. Physical route and explicit browser failure checks complement the earlier per-system safety tests. See [current integration validation](VALIDATION_V02_PASS_011.md); final macOS acceptance remains pending.

## Pass 015 authored nudibranchs and skins

The five nudibranchs keep their homes, crawl paths, phases, variants and ripple, but now render as authored species (see [art direction](ART_DIRECTION.md)). Each authored mesh copies its animal's crawl-pose matrix every frame and stays inside the envelope `surfaceHome` validated: under a 0.285 crawling radius and under the 0.26 height, with 3 mm left for the ripple. The procedural instanced forms remain resident as the fallback. The seahorse and frogfish keep their pivots and homes; their skins are re-authored with rings, tubercles, warts and pattern of at most a few millimetres, and the frogfish sole is untouched. See [Pass 015 validation](VALIDATION_V02_PASS_015.md).

## Pass 019 playtest changes

- **Seahorse:** 20% of its former modelled size (`SEAHORSE_SCALE`; about 0.22 m tall). Geometry stays in its local units and the root carries the scale; the grip offset, safety radius, view target, awareness offset and drift are scaled with it.
  - **Branch grip (second playtest):** once the authored reef loads, `findSeahorseGrip` scans the authored sea-fan template for a thin (under about 2 cm across), near-horizontal stretch of branch at 45–78% of the plant's height and away from the trunk.
  - **Placement:** the tail coil sits on that branch, the body has open water around it, and the horse faces out of the fan towards its discovery view (`Seahorse.rehome`).
  - **Fallback:** with the procedural fallback reef it keeps its original low grip.
- **Frogfish (second playtest):** half its former size (`FROGFISH_SCALE`). It perches on a level reef-rock top instead of the shipwreck.
  - **Home search:** rock tops are rounded hulls of many small faces, so `rockTopHome` tests its footprint against the sampled hull-top height (within 3.5 cm of level, face within about 32° of horizontal) instead of a single face. It faces the open channel.
  - **Seating:** the hull top sits a little above the carved authored stone, so once assets load a short raycast seats it on the visible surface (`Frogfish.settle`, bounded to 25 cm).
  - **Camouflage:** its authored skin is multiplied by a muted olive-beige so it blends into the limestone.
