# V0.8 Pass 095: Playtest Fixes

Base: main after Pass 094. These are the four items from the user's MacBook playthrough. Nothing
else is changed.

- **Gallery:** `docs/screenshots/v08-pass095/`. Each pair shows main against this pass, from the
  same fixed view.
- **New harness views** (`validation/v07/worlds.mjs`):
  - `wreck-stern-close`, `wreck-stern-quarter`;
  - `kelp-north-wall`;
  - `cave-lionfish-side`, `cave-lionfish-front`.

## 1. Kelp-forest sharks: "the texture was strange and almost see-through"

**Not fixed before this pass.** The shark in the screenshots is the kelp forest's **leopard
shark**. It was still the Pass 078 build: Pass 092's fin, marking and seam fixes covered the reef
shark, great white, whale shark, rays and whales, but not this one.

- **Cause:**
  - the pale belly gradient began halfway up the flanks and spread onto the fins, so against the
    sandy-green kelp water the animal looked washed out and translucent;
  - its saddles were thin and faint;
  - a pale ring round each eye read as a hole.
- **Fix:** rebuilt through the Pass 092 pipeline (Taubin-smoothed fins, markings refined in the
  mesh, spine-mapped skin), with a species-true colour scheme:
  - bronze-grey above;
  - pale only beneath;
  - broad black saddles over the back, breaking into bars;
  - black flank spots;
  - dark eyes.

  `tools/art/pass084/creatures.py`'s `eye_paint` now honours its `ring` argument (it ignored it).

- **Asset:** `leopard-shark.glb` 688,704 → 700,844 bytes, 7,896 body triangles (under 8,000),
  same root, material, morphs and size.
- **Not rebuilt:** the nurse shark (cave) and whitetip are also still Pass 078 builds. They were
  not in the screenshots and were left alone.

## 2. Shipwreck: a hole in the back, and the propeller and a fish stuck in the rudder

- **Hole.** Below the counter, each side's lofted plating stopped short of the centreline (the
  row's last station kept part of its breadth), so the stern was open between the two sides.
  Each undercut row now runs fine into the sternpost over its last 1.4 m (`sternRun`). The rows
  at the counter, which already closed, are unchanged. Collision is unchanged, and the run lies
  inside it.
- **Screw and rudder.** The screw blades cut into the rudder's leading edge, and the rudder's top
  floated about 1.5 m under the counter. The rudder now:
  - stands aft of the blades with clearance (`RUDDER`, `SCREW`);
  - has a shorter chord;
  - hangs on a stock that rises into the counter.
- **Fish.** The stern grouper was placed on the centreline, inside the rudder blade. It now hangs
  beside the rudder, still in the shade under the counter.

## 3. Kelp forest: the back wall

- **Cause.** The wall the arrival tunnel opens through was a ring facing away from the forest.
  When Pass 080 gave the kelp rock the shared, front-sided material, the wall was culled from
  inside the forest. Looking back you saw the tunnel's tube floating in open water.
- **Fix:**
  - the ring now faces the forest;
  - the north side gets the same stacked-rock face as the side and far walls, opened round the
    tunnel with its edge snapped onto a circle (no sawtooth);
  - its collider starts just inside the rocky face, as the other walls' do. The tunnel opening
    is the same size.

## 4. Lionfish: a strong redesign

The lionfish was a squashed sphere with thick striped planks for fins. Every pectoral ray
splayed the same way, and every dorsal spine stacked on the centreline, so head-on it was a ball
with two planks and a spike. It is rebuilt in code, in the cave and in the tank collection alike.

- **Body:** a deep, laterally compressed body lofted from a side profile (`lionProfile`): a big
  head, deepest behind it, and a slim tail stalk.
  - **Face:** upturned lips, eyes high on the head with the bars running through them, and long
    banded brow tentacles.
  - **Bars:** maroon and cream, slanting forward on the head.
- **Soft fins:** the dorsal, anal and rounded tail fins are clear, ray-lined and spotted in rows.
  The pelvic fins are spotted too.
- **Spines and fans:**
  - every spine is slim and banded, with a narrow lance-shaped web and a free tip;
  - the pectorals are true fans: every ray from one base, spread across the fan's plane, which
    swings from along the flank (calm) to broadside (alarmed);
  - the dorsal spines lean a little to either side, so the crest reads head-on.
- **Behaviour:** fanning at a close swimmer is unchanged (`LionfishFan`). One shared
  `lionRayPose` poses the rays for the cave (per frame, no allocation) and the tank.
- **Cost:** the same two draws (bodies, rays). The body has more vertices, built once.

## Validation

- **New tests** (`tests/playtest-fixes-095.test.ts`):
  - the kelp north wall faces the forest, with the mouth's edge on its circle;
  - the north-wall collider starts at the face and keeps the tunnel open;
  - the stern rows close;
  - the rudder clears the screw;
  - the grouper clears the rudder;
  - the lionfish body proportions, crest splay and fan spread;
  - the leopard shark is the Pass 092 build.
- **Manifest:** `public/assets/manifest.json` takes the leopard shark's new hash.
- **Full checks:** `npm run typecheck`, `lint`, `build` and `test` (110 files, 1116 tests) pass.
- **Browser:** headless Chromium on SwiftShader, through the game's loader. No real-GPU timing.

## Known limitations

- The nurse shark and whitetip are still Pass 078 builds.
- The rudder is still a plain plate. The stern grouper does not swim.
- The lionfish's bars are per-vertex colour on the lofted body, so they are slightly stepped at
  very close range.
