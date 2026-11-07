# Aquarium ornaments — Pass 008

`Aquarium` owns `OrnamentSystem`: six procedural objects, six shared muted materials, exact convex structural components, a hinged chest, one fixed bubble pool and twelve local filter particles. The ornaments add 66 structural collision components (139 including the reef). Objects use stable root transforms; only the chest hinge and optional effects move. No remote assets, secondary frame loop, physics dependency, rewards or new creatures are introduced.

| Object             | Construction and collision                                                                  | Named anchor        |
| ------------------ | ------------------------------------------------------------------------------------------- | ------------------- |
| Treasure chest     | Separate wooden walls/base, brass trim/lock, rear hinge and thin moving lid                 | `chest-nearby`      |
| Corner filter      | Wall mounting pads, dark slotted housing, intake and short return; collidable housing/tubes | `filter-corner`     |
| Stone arch         | Nine convex annular wedges plus two supports; broad physically open center                  | `arch-shadow`       |
| Miniature wreck    | Separate hull planks, ribs, keel, broken cabin and leaning mast; open main hull             | `shipwreck-crevice` |
| Hollow driftwood   | Twelve convex annular sectors, uneven bark and sparse algae; two-ended open bore            | `log-interior`      |
| Island-head statue | Faceted long face, brow/nose/lips, carved marks, sparse growth and stable base              | `statue-rear`       |

Placement searches a bounded deterministic grid near the banks, rejecting spawn, center corridor, glass, other objects and existing reef envelopes. The filter mounts in the rear right corner. Floor props meet the highest sampled substrate beneath their footprint. Small ripples can remain visible under portions of a rigid base. Named anchors include validated world positions and unit orientations; each clears a 0.65-unit body envelope. They are habitat metadata, not scripted paths. Future creatures should look up these names rather than copy coordinates.

## Chest and local effects

`ChestClock` uses active seconds: eight seconds closed, four-second eased opening, four-second hold, five-second eased closing, then closed idle. First cycle is 32 seconds; subsequent seeded cycles last 25–45 seconds. Smoothstep keeps velocity continuous at phase boundaries. The lid rotates about the actual rear hinge, not its center.

The lid's thin convex collider updates in place from the same world transform as the rendered lid. Before advancing, the system checks a conservative sweep envelope around the hinge against player and fish bodies. An occupied envelope holds the cycle at its current pose until clear; it never pushes, traps or teleports an occupant. This safety hold can extend a cycle beyond its nominal duration. Fine trim remains cosmetic. Flora placement reserves the complete swept lid envelope without adding an invisible player barrier. Attachment surfaces are supplied separately: living corals attach only to real reef rock/skeletons, never to clearance volumes or moving aquarium equipment.

One short bubble cluster starts during opening. Eighteen preallocated instances share a geometry/material; size, rise speed and slight lateral drift vary deterministically. Delayed bubbles rise and shrink near the surface or expire after a bounded lifetime. No continuous chest emitter or accumulating particle list exists. Twelve very faint particles indicate only the nearby filter outflow; the global plant current is unchanged.

Pause freezes the clock, hinge, bubble age and filter flow. Reduced motion holds the current lid pose and filter flow and clears optional active bubbles; resuming continues without resetting the hinge. Large frame gaps advance at most 0.1 seconds and do not replay missed cycles.

## Quiet audio and ownership

The existing sparse Web Audio scheduler can choose the chest-nearby and filter-corner positions alongside the nine reef emitters. Its 28–65 second interval, one-voice limit, gain, buffers and mix remain unchanged. Audio is deliberately not triggered on every chest cycle and the filter adds no loop or machinery layer.

The subsystem detaches before generic scenery cleanup. It disposes each owned geometry/material, the instance buffer, and local particle resources exactly once. The collision world and fish share the same mutable lid collider object; static structural components remain immutable. No event listeners or timers are owned by ornaments.

See [habitat metadata](HABITAT.md) and [Pass 008 validation](VALIDATION_V02_PASS_008.md) for evidence and pending manual acceptance.

Pass 009 uses the named `log-interior` anchor for a sheltered moray with a validated deformation envelope and soft retreat response. Ornament geometry, openings, chest motion and colliders remain unchanged. See [anchored life](ANCHORED_LIFE.md).

Pass 010 exposes immutable `surfaceGroups` referencing the already generated structural components for habitat consumers. The frogfish and nudibranchs can use those real surfaces without changing ornament geometry, animated lid strategy, colliders or player passage. See [hidden discoveries](HIDDEN_LIFE.md).
