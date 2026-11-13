# The tank catalog

Pass 029 starts v0.5 Personalization alongside the v0.4 release candidate. v0.4 remains open for the user's macOS play-through. Pass 030 adds discovered baby animals alongside the corals and plants.

## Quiet discovery

`src/catalog/catalog.ts` maps journal sightings to six tank items. Only discovered entries appear. The three large-animal sightings unlock **Blacktip pup**, **Baby eagle ray** and **Turtle hatchling**. Unseen animals are absent too. There are no locked slots, completion counts or currencies.

Pause while swimming inside the aquarium and choose **For your tank**. Choose a colony or grass patch to resume with a translucent preview. Aim toward nearby sand or a rock top, press **R** to turn and **F** to place. A dim preview means the location is unsuitable. **Escape** cancels and pauses. Look at an added item within reach (solid scenery blocks targeting) to **G** move or **X** remove it. Moving keeps the original solid and saved until a valid replacement is confirmed. At twenty items, another selection shows only “The tank feels full here”.

## Little visitors

Each discovered animal has **Add to the tank** and, once present, **Return it to the sea**. The tank hosts one of each, independently of the twenty decoration places. Adding resumes swimming and fades the visitor into clear water near you, outside fish, other babies, scenery and protected homes. Returning fades it out; presence saves immediately. There is no feeding, growth or anything to maintain.

These are miniature versions of the existing local adult models, with their existing strokes. Neutral sizes in aquarium coordinates are about **0.54 m pup length**, **0.50 m ray disc** (about 0.72 m nose-to-tail), and **0.25 m hatchling shell** (about 0.31 m whole-body length). No new models or juvenile mesh edits were needed. The ray's long tail is included in its collision enclosure.

`creatures/babies/` owns pure fixed-30-Hz simulation and reusable swept A* navigation buffers. The pup follows broad channel loops, the ray descends toward low glides and occasional flat rests, and the hatchling visits the banks with occasional lightward rises. Giving way is gentle, strokes shrink with reduced motion, and pause freezes movement and fades. Sand clearance uses maxima from the actual rendered mesh; rest/take-off keeps the ray flat before strokes resume. Static hulls, the animated chest lid's full sweep, small pebbles, creature homes, glass margins and the crevice/return alley are protected. Edits invalidate paths; placing directly on a visitor is rejected. Fish share the residents' stable positions for steering and swept personal space.

`TankBabies` is lazy: an original tank has no resident owner, model downloads or resident updates. It leases the existing three assets through the aquarium fish loader, owns only hierarchy, simulation buffers and opacity materials, and borrows geometry/textures. The final lease frees an unused model; returning from the outer reef retains models still leased by babies. The office draws those same animals at their far detail levels.

## Placement and collision

Pure validation checks finite coordinates, glass clearance, support height and footprint, the full central channel, existing structures and protected creature homes, the crevice/return alley, other additions and swept volumes around the existing physically tested routes. Route construction is shared by the environment and the validation harnesses. The authored rock surface is queried once per placement probe rather than relying only on procedural support hulls.

Each item has a conservative convex box containing its rotated visible footprint and sway margin. On an edit, its old colliders are replaced in the existing shared aquarium collider array; both player collision and fish habitat immediately see the same set. A placement cannot intersect the swimmer or a nearby fish. On restoration, fish initialized in a saved colony's volume are moved to a nearby clear position once, before normal play.

## Art, batching and ownership

`TankDecoration` leases the existing reef library through the aquarium's loader. It normalizes existing authored colonies to small tank-sized pieces, preserves available distance geometry and groups instances by kind/detail. Soft corals, fans and grass use the existing plant shader and its shared clock, including reduced motion. The office renders the same aquarium scene, so additions appear in its miniature without a second scene or asset load.

The editor owns its DOM/listeners and the decoration instance. The decoration owns converted vegetation geometry, preview materials and instance buffers; library geometry/materials remain owned by the shared lease. Disposal and asynchronous completion are guarded. Original aquarium resources remain untouched.

## Saving and reset

`cozy-diver.tank.v1` now holds version 2, decoration ids/kinds/positions/rotations and baby species ids. Pass 029 version 1 saves migrate without losing decorations. Loading drops malformed, duplicate, unsupported, undiscovered or invalid placements independently. Unavailable storage leaves the editor usable for the visit. Settings offers **Restore the original tank**, followed by explicit confirmation; it clears additions and returns animals to the sea while preserving sightings and preferences. Reset is immediate even while paused; ordinary returns fade on simulation time.

Conservative clearance can reject visually tempting spaces near homes or narrow rocks. This intentionally keeps the established swimming paths and animal habitats usable. GPU and comfort acceptance still require target-device testing.
