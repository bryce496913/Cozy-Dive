# V0.8 Pass 084: Marine Creature Artistic Refinement

Base: main after Pass 083. Scope: the large animals' models and materials. Behaviour, encounter
systems and the runtime contract (`<Root>` > `Body` + `Body_LOD1`, one material, `Stroke_Left` /
`Stroke_Right` morphs at rest weight 0, the shipped root names and size envelopes) are unchanged,
so every movement system drives the refined models exactly as before.

Source: `tools/art/pass084/creatures.py` (builds on the Pass 078 sculpt method in
`tools/art/pass078/`), Blender sources `tools/art/pass084/*.blend`. Preview harness:
`validation/v08/creatures.html` + `creatures.mjs` (one animal at a time, from its shipped GLB
through the game's loader, in the tank's or another world's water and light: side, three-quarter,
head close-up, top and mid-stroke views). Galleries: `docs/screenshots/v08-pass084/`.

No screenshots were attached to the brief, so the audit below was made from the current asset
gallery (the harness above) under the game's lighting.

## 1. Audit (before)

| Animal                                                                                             | Issue found                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All Pass 078 sculpts (hammerhead, whale shark, rays, whales, sunfish, seals, sea lion, polar bear) | Skin detail maps were sums of integer plane waves: straight directional stripes that tile, reading as brushed fabric under the tank light                                                            |
| Hammerhead                                                                                         | Eyes were spheres hanging off a thin cephalofoil; a step where the slim body met the head; fin roots met the body at a crease; flanks turned white at mid-height, so the shark read white from above |
| Reef, whitetip, great white, leopard and nurse sharks                                              | One lofted body (6,824 triangles each, identical topology) tinted five ways; flat plate fins; no species silhouette                                                                                  |
| Sea turtle                                                                                         | A lofted "barrel": plank-like stripes across the shell, a cylindrical striped head, flat plate flippers                                                                                              |
| Harbour seal                                                                                       | Pass 068's lofted tube: no head form, a dot eye, blade flippers                                                                                                                                      |
| Polar bear                                                                                         | Straight tubular legs ending in ball paws; four ball toes; a toy-like assembly                                                                                                                       |
| Weddell and leopard seals, sea lion                                                                | Fore-flippers met the body at a crease; skin read as fabric                                                                                                                                          |
| Eagle ray, manta                                                                                   | The stroke raised each wing rigidly; no travelling wave                                                                                                                                              |
| Minke whale, sea otter                                                                             | Lofted Pass 068 models; lower priority (not changed in this pass)                                                                                                                                    |

## 2. Corrected anatomy

- **Hammerhead.**
  - **Eyes:** set into thickened lobes at the cephalofoil's tips (painted eye with a pale ring, in a shallow socket on the outer face), not separate spheres hanging off a thin foil.
  - **Head-to-body:** a nape carries the body up and out into the head; the head end of the body is fuller.
  - **Fins:** every fin root is filleted by a wider smooth union (5 cm instead of 2 cm), so no fin meets the body at a crease.
  - **Countershading:** bronze-grey over the back and upper flank, white only beneath; dusky tips by height were dropped, because the low fin roots read as dark patches.
- **Five sharks, each its own body plan.** One parametric sculpt (snout form, girth profile, first and second dorsal, anal, pectoral and pelvic plan, caudal shape) set per species:
  - _grey reef shark_: stocky, rounded snout, black caudal margin;
  - _whitetip reef shark_: slender, broad blunt snout, first dorsal set back, white tips;
  - _great white_: heavy spindle, conical snout, tall triangular dorsal, crescent tail with keels, irregular grey/white line, black pectoral tips;
  - _leopard shark_: small, slender, two near-equal dorsals, long upper lobe, saddles and spots;
  - _nurse shark_: flat broad head, barbels, two rounded dorsals far back, long low upper lobe, uniform tan.

  A test measures that each shark's depth and width profile differs from every other's.

- **Polar bear.**
  - Shoulder blades and haunches carry each limb out of the body.
  - Limb segments are flattened across the body and swell at the biceps, forearm and calf, then narrow to slimmer wrists; no evenly thick tubes.
  - Paws are broad and flat, with five small toes, replacing the ball paws and four ball toes.
  - The chest is deeper and the neck thicker; the skull is flatter, with cheeks and a tapering muzzle.
  - The forelegs reach forward into the paddle stroke.
- **Seals and sea lion.**
  - An upper-arm mass inside the body wall at each fore-flipper root, and a heel where the hind flippers join, so the flippers grow out of the body instead of meeting it at a crease.
  - The **harbour seal** is now sculpted: a plump short body, a round head on a defined neck, a short dog-like muzzle with whisker pads, large dark eyes, short fore-flippers, fanned hind flippers, and a dense spotted and ringed coat.
- **Ring creases.** Every sculpted body was swept along a piecewise-linear spine with piecewise-linear profiles. Each knot left a ring around the body (most visible on the Weddell seal and sea lion). The spine is now a spline and the profiles are monotone cubic curves (except the rays, whose sub-voxel whip tails need the original profiles).
- **Sea turtle, sculpted.**
  - Carapace: a low, heart-shaped dome of grooved scutes (five vertebral, four costal each side), over a flat plastron.
  - Head: blunt, with a horny beak and set-in eyes.
  - Flippers: long curved fore-flippers and short rounded hind flippers.
  - Colour: olive-brown scutes with radiating amber streaks, a pale plastron, and grey-brown scaled skin with pale scale edges.
- **Unchanged anatomy:** whale shark, whales and sunfish passed the anatomy audit and only take the new skin.

## 3. Materials

The Pass 078 detail maps (normal, base, ORM) were sums of integer-frequency plane waves. They tiled as straight stripes that read as brushed fabric under the tank light. They are replaced by band-limited, isotropic noise generated in the frequency domain (seamless by construction), by kind:

| Skin     | Used on                          | Detail                                                                                                                                      |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Denticle | Sharks, rays, whale shark        | A fine, even placoid grain over a soft mottling, matte (roughness 0.64-0.68, which also stopped the top light from washing the backs white) |
| Smooth   | Whales, seals, sea lion, sunfish | Gentle undulation, faint creases, sparse pores                                                                                              |
| Fur      | Polar bear                       | Short, clumped strands, broken at random so no line runs across the map                                                                     |
| Scute    | Sea turtle                       | Leathery fine scales                                                                                                                        |

The coat and markings stay in the vertex colours, so the maps only add restrained surface response. The materials were checked under the tank light and under the outer-reef, under-ice and kelp-forest water and light (`docs/screenshots/v08-pass084/in-water/`).

## 4. Animation

The behaviour code and encounter systems are untouched. The stroke morphs follow each new body:

- the sharks bend laterally from the tail, with the head countering;
- the turtle's fore-flippers beat down and back together, and the hind flippers trail;
- the bear paddles from the shoulders and hips with weights that stretch the hide rather than tear it;
- the seals sweep their hind bodies.

The rays' stroke is now a travelling wave: the beat grows toward the tip, the trailing edge lags, the tip curls, and the wing draws in slightly as it rises so it does not stretch. Their body and tail stay steady (Pass 078 raised the whole wing rigidly). Mid-stroke views are in every gallery (fourth column); none shows tearing or separation.

## 5. Galleries

- `docs/screenshots/v08-pass084/<animal>.jpg`: before (top) and Pass 084 (bottom). Columns are side, three-quarter, head close-up and mid-stroke, from the shipped GLBs through the game's loader, in the tank's water and light.
- `docs/screenshots/v08-pass084/in-water/{outer,ice,kelp}.jpg`: in-engine renders of representative animals in their own world's water and light.

## 6. Asset and performance report

| Measure                                   | Before → Pass 084                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Triangles per animal (Body / Body_LOD1)   | 7,600 / 1,400 for every rebuilt animal, the existing creature budget; the lofted sharks were 6,824 |
| Draw calls, materials                     | Unchanged: one mesh and one material per animal per level                                          |
| Morphs                                    | Unchanged: `Stroke_Left` / `Stroke_Right`, rest weight 0                                           |
| Download (18 rebuilt animals, compressed) | 9.86 → 10.29 MB; the denticle grain compresses less than the stripes it replaced                   |
| Size envelopes                            | All inside their registry limits, including stroke bounds (loader-bounds test)                     |

## 7. Validation

- **Checks:** typecheck, lint and build pass.
- **Targeted tests pass** (12 files, 226 tests):
  - the creature contract, morph and loader-bounds tests (`large-creatures`, `creature-assets`, `big-creatures`);
  - asset validation, loading and compression;
  - art consistency;
  - the ice, kelp, visitor and outer-reef suites;
  - the new `creature-refinement` test: distinct shark plans, the harbour seal's neck and head, the bear's flat paws.
- **Browser:** the isolated creature studio (`validation/v08/creatures.mjs`) loaded and rendered every large animal, under four water profiles, with 0 errors. No whole-game walkthrough.

## 8. Known limitations

- **Not changed:** the minke whale and sea otter are still the lofted Pass 068 models.
- **Polar bear:** improved, but its limbs remain simplified (no individual claws or fur silhouette).
- **Hammerhead:** the cephalofoil's scalloping is subtle at swimming distance.
- **Colour:** every animal is coloured per vertex; markings are as sharp as the mesh density allows.
