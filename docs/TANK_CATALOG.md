# The tank catalog

Pass 029 starts v0.5 Personalization alongside the v0.4 release candidate. v0.4 remains open for the user's macOS play-through. Corals and plants are the scope here; baby animals are Pass 030.

## Quiet discovery

`src/catalog/catalog.ts` maps journal sightings to six tank items. Only discovered entries appear. Animal sightings are retained in the journal and ignored by this pass. There are no locked slots, completion counts or currencies.

Pause while swimming inside the aquarium and choose **For your tank**. Choose a colony or grass patch to resume with a translucent preview. Aim toward nearby sand or a rock top, press **R** to turn and **F** to place. A dim preview means the location is unsuitable. **Escape** cancels and pauses. Look at an added item within reach (solid scenery blocks targeting) to **G** move or **X** remove it. Moving keeps the original solid and saved until a valid replacement is confirmed. At twenty items, another selection shows only “The tank feels full here”.

## Placement and collision

Pure validation checks finite coordinates, glass clearance, support height and footprint, the full central channel, existing structures and protected creature homes, the crevice/return alley, other additions and swept volumes around the existing physically tested routes. Route construction is shared by the environment and the validation harnesses. The authored rock surface is queried once per placement probe rather than relying only on procedural support hulls.

Each item has a conservative convex box containing its rotated visible footprint and sway margin. On an edit, its old colliders are replaced in the existing shared aquarium collider array; both player collision and fish habitat immediately see the same set. A placement cannot intersect the swimmer or a nearby fish. On restoration, fish initialized in a saved colony's volume are moved to a nearby clear position once, before normal play.

## Art, batching and ownership

`TankDecoration` leases the existing reef library through the aquarium's loader. It normalizes existing authored colonies to small tank-sized pieces, preserves available distance geometry and groups instances by kind/detail. Soft corals, fans and grass use the existing plant shader and its shared clock, including reduced motion. The office renders the same aquarium scene, so additions appear in its miniature without a second scene or asset load.

The editor owns its DOM/listeners and the decoration instance. The decoration owns converted vegetation geometry, preview materials and instance buffers; library geometry/materials remain owned by the shared lease. Disposal and asynchronous completion are guarded. Original aquarium resources remain untouched.

## Saving and reset

`cozy-diver.tank.v1` holds a version and item ids, kinds, positions and rotations. Loading drops malformed, duplicate, unsupported, undiscovered or invalid placements independently. Unavailable storage leaves the editor usable for the visit. Settings offers **Restore the original tank**, followed by explicit confirmation; it clears additions while preserving sightings and preferences.

Conservative clearance can reject visually tempting spaces near homes or narrow rocks. This intentionally keeps the established swimming paths and animal habitats usable. GPU and comfort acceptance still require target-device testing.
