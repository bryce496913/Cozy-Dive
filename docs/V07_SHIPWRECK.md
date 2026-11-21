# V0.7 shipwreck structure and materials (Pass 076)

The wreck hull read as a flat, dark slab, with growth that seemed to float on it and a stair-stepped breach. This pass rebuilds the hull surface and the wreck's steel materials.

**Unchanged, and tested:**

- the layout and `wreckColliders()`;
- the breach passage, hold navigation and torch behaviour;
- creature routes and growth placement, which uses the same RNG sequence.

## Pipeline

The wreck stays code-built (`src/environment/wreck/ShipwreckModel.ts`) on the `WreckLayout` hull profile. The plating detail is a function of the hull surface, so this pass did not need Blender. A Blender model would have duplicated the layout and the collision source.

## Hull

**Plated shell.** Each side is a smooth-shaded 60 × 360 grid, built from one indexed grid per side. Relief is carved inward only, by `hullInset(y, z)`:

- **Lapped strakes:** 1.15 m tall, each set in about 2 cm toward its lower edge, so every plate row has a raised upper lip.
- **Frame sag:** plates dish slightly between frames spaced 0.7 m apart. This is the "hungry horse" look of old riveted hulls.
- **Butt welds:** a shallow groove every 2.6 m.
- **Dents:** broad deformation.
- **Torn plate:** around the breach, plate curls inward.

**Torn breach.** `breachOpen(z, y)` is a ragged opening with a varying margin and jagged teeth. It always contains the collision rectangle `SHIP.breach`, which replaces the old quad-stepped edge.

**Layered colour.** `hullColour` builds the hull from these layers:

- a faded topside paint over red antifouling below the waterline band;
- a per-plate tone variation;
- dark seam lines with a lighter lip;
- rust bleeding down from seams, rust patches, and heavier rust at the tear;
- a patchy olive growth film;
- a sand line at the keel.

**Attached growth.** Hull growth now sits on the carved surface (`hullX − hullInset`), not on the old envelope.

## Decks, hold and superstructure

`weathered()` now carries the same plate language as the hull, so the decks, hold walls and bridge match the exterior:

- welded seams on a 1.5 m world-space grid;
- rust bleed below horizontal seams;
- the same growth film.

`block()` parts are subdivided into cells of about 0.3 m, so the seams and stains resolve on them.

**Materials.** Without an environment map, metalness only darkens corroded steel, which read as black. Metalness is now 0.05 on the shell (was 0.2) and 0.06 on the steel (was 0.18). The shell's lightness comes from albedo, not emissive or fog changes, so the water stays as murky as before.

## Cost

From `validation/v07/worlds.mjs` with `COZY_WORLDS=wreck`, before → after. Draw calls are unchanged.

| View       | Triangles     | Draws |
| ---------- | ------------- | ----- |
| Overview   | 1.26 → 1.33 M | 76    |
| Deck       | 1.27 → 1.33 M | 75    |
| Hull close | 1.24 → 1.30 M | 48    |
| Bow        | 1.34 → 1.40 M | 70    |
| Stern      | 1.27 → 1.33 M | 77    |
| Broadside  | 1.24 → 1.30 M | 58    |
| Hold       | 1.47 → 1.53 M | 75    |
| Bridge     | 1.28 → 1.34 M | 77    |

No new textures or downloads.

## Validation

- **`tests/shipwreck-overhaul.test.ts` (new):**
  - hull relief is inward-only, and bounded away from the tear;
  - the ragged breach covers the whole collision opening;
  - the tear is irregular.
- **Existing wreck tests:** `tests/shipwreck.test.ts` and `tests/wreck*.test.ts` pass (20 tests in all), covering collision, the hold and the passages.
- **Checks:** typecheck, lint and build pass.
- **Browser smoke (wreck only):** 8 views with 0 errors.
- **Gallery:** matched before/after views in `docs/screenshots/v07-pass076/`: overview, deck, hull close-up, bow, stern, broadside, hold and bridge.

## Limitations

- **Hold:** it stays torch-lit and dark by design, so its plating is only visible close up under the torch.
- **Rivets and welds:** these are colour and shallow relief, not modelled beads. Portholes and hull fittings were not added.
- **Breach edge:** it is still a single-sided cut (no visible plate thickness at the tear).
- **Captures:** SwiftShader stills. The look in murky water on the MacBook Air needs the user's in-game check.
