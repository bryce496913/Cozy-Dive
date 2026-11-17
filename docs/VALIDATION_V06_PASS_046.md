# v0.6 Pass 046 — Under the ice (`0.6.0-rc.7`)

Date: November 17, 2026. By user request: a new area, an Antarctic under-ice dive. This pass builds the world and its seabed garden; its animals come in Passes 047 (everyday) and 048 (rare). No merge or release is authorized by this note.

## The way in

- **The cave's back tunnel:** a second tunnel leaves the sea cave through its back wall, between the boulders there (x -3, y 3.2). The dome has a rounded hole cut for it, and a rough rock tube runs to a threshold at z -42.
- **Why a tunnel:** the tank's crevice outcrop, which the other passages copy, was too big for the cave's crowded walls.
- **The swap:** past the threshold the swimmer continues in the tunnel under the ice. The darkness is equal either side and their pose carries across (`CAVE_TO_ICE` / `ICE_TO_CAVE`).
- **Loading:** the ice loads within 15 m of the threshold and is released 22 m away after a delay. While the swimmer is under the ice, the cave and kelp forest stay loaded so the way back is seamless.

## The world (`IceEnvironment`, `IceGarden`, `UnderIceScene`)

- **The tank:** the size of the kelp forest, with walls at x ±24 and the far end at z -60.
  - **Near wall:** dark rock, the tunnel opening through it.
  - **Sides and far end:** great faceted blue-white icebergs, rising from below the seabed up through the sea ice. Each block's inner face lies on or beyond the wall line.
  - **Roof:** the underside of the sea ice at y 15, a lumpy pale sheet hung with smaller chunks.
  - **Light:** three breathing holes, each with a short ice chimney, daylight above, and a soft, slowly shimmering shaft of light falling to the seabed.
- **The seabed:** grey gravel and silt in low swells, banking up under the icebergs and brighter under the holes. Dark dropstones lie on it; the larger ones are solid.
- **The garden:**
  - 60 glass sponges (pale vases and barrels, in clumps);
  - 70 soft corals (white, pink and orange);
  - 50 white and pink anemones (on stones and gravel);
  - 60 red and orange sea stars (some very large);
  - 28 feather stars on the stones, swaying in the current.
- **Water and lighting:** cold clear blue water with drifting particles, and the same light kinds as the other worlds, so programs are shared.
- **Soft limits:** the swimmer eases to a hover about 2 m short of the icebergs, the far end, the rock wall and the ice above. Colliders back them up.
- **Sightings:** Under the ice, Glass sponge, Antarctic soft coral, Antarctic anemone, Antarctic sea star and Feather star.

## Checks

- typecheck, lint and build pass.
- `npm run test`: 611 passing. New tests cover:
  - the back tunnel's mouth;
  - the cave ↔ ice crossings (only once the ice is ready, with matching pose);
  - the darkness at each threshold;
  - the swimmer stopping short of both icebergs, the far end and the ice;
  - swimming out of the tunnel into the tank;
  - the garden and its sights;
  - disposal.
- **Browser check:** `validation/under-ice.mjs`, SwiftShader at DPR 0.5. See the PR for the result. Screenshots are in `docs/screenshots/pass046/`.

## Known limitations

- The ice is opaque, lit with a faint blue glow. It is not translucent or refractive, to keep it cheap.
- The breathing holes can't be swum up into; the soft limit keeps the swimmer below the ice.
- The way in is only through the cave. "Return to the tank" works from here as from the other areas.
