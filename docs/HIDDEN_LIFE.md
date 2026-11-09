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

Most time is spent still. Breathing/posture and lure movement are restrained. Every 112 active motion seconds, an eight-second eased walking interval moves between nearby perch points, with alternating small pectoral lifts. Its root stays within 0.10 units of home and spends under 8% of time walking. It ignores distant activity; close proximity only adds a tiny posture response. There is no lunge, prey capture or damage.

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
