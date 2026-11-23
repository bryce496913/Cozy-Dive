# V0.8 Pass 097: Cave Resting Shark Tail Animation

Base: main after Pass 096.

**Frames:** `docs/screenshots/v08-pass097/`.

- `dash-close-after.jpg`: a startled whitetip's dash, seen from directly above, after the fix.
- `dash-from-above.jpg`: eight frames of the dash, before against after.

**Harness:** `validation/v08/shark-bolt.html`. It builds the sea cave alone and exposes its resting
sharks, so a startle can be stepped frame by frame and logged or rendered.

## Reproduction and cause

A swimmer was placed 1.5 m from a resting whitetip, and the startle was stepped at 30 fps in the
browser, logging the bolt and the model.

- **Ruled out, each checked:**
  - **Morph naming and indices.** `Body` and `Body_LOD1` carry `Stroke_Left` and `Stroke_Right`
    (indices 0 and 1). The decoded geometry has both targets, about 0.26 m of displacement.
  - **Animation references.** `creatureStroke` writes the weights the bolt computes, frame for
    frame.
  - **Update order.** The rest and bolt branches each write the stroke once per frame. No other
    system touches it.
  - **LOD.** The resting sharks show only `Body`, which is the mesh animated. Nothing switches it.
  - **Orientation.** The stroke displaces the tail end (−x) purely sideways, and the shark swims
    head first (+x).
- **The cause: stroke amplitude against speed.**
  - The shared stroke morph is authored for cruising. At weight 1 it throws the tail about 8% of
    body length.
  - The bolt drove it at most 0.95 while the shark dashed at 2.8 m/s, nearly two body lengths a
    second, with 2.3 Hz beats. Seen from above, the dashing shark was an almost straight rod
    sliding along.
  - The weights were changing; the motion they produced was too small for the speed to read as
    propulsion.

## Fix (`src/creatures/sharkBolt.ts`)

The cave's resting whitetips and its nurse shark share this file.

- **Stronger strokes in the bolt:**
  - dash 0.95 → 2.0;
  - cruise to the new resting place 0.5 → 1.1;
  - the flinch's C-bend 1 → 1.5.

  The morph is a purely sideways displacement, so weights above 1 stay clean (checked in renders
  at the extremes).

- **Coordinated with movement:** beats still quicken with speed (0.8 Hz plus 0.55 Hz per m/s).
  They are now up to 35% stronger while the shark is short of the speed it wants, so the hardest
  beats come as it accelerates. They ease while cruising and fade as it touches down.
- **Body sway:** the head swings against the tail (0.07 rad per unit of stroke). It is added to
  the drawn heading only (`SharkBolt.sway`); the heading it swims along, its banking, obstacle
  avoidance and the flinch, flee and settle path are unchanged.
- **Reduced motion:** there is still no flinch bend and no sway, and the beats are 60% strength.
- **Pause:** nothing advances without simulation time, and the sharks are disposed with the cave,
  as before.
- **On settling:** the stroke, sway, speed, pitch and bank all return to rest, and the breathing
  flex takes over.

## Validation

- **New tests** (`tests/shark-tail.test.ts`):
  - the model shows exactly the bolt's stroke through rest, startle, dash and settle;
  - the dash peaks above 1.5 at 1.8–2.9 Hz;
  - beats ease while settling;
  - four repeated startles each produce full beats (no frozen rig);
  - with reduced motion there is no bend and no sway, and the beats are gentler;
  - nothing moves while paused;
  - beats are strongest while accelerating, and the sway opposes the tail.
- **Full checks:** `npm run typecheck`, `lint`, `build` and `test` (113 files, 1134 tests) pass.
- **Rendering:** browser frames were rendered on SwiftShader, before and after. No full playthrough
  was run.

## Known limitations

- The stroke is the shared authored morph: one bend shape, made stronger. A true travelling wave
  along the body would need new morphs.
- The outer reef's cruising sharks are unchanged (they were not reported).
