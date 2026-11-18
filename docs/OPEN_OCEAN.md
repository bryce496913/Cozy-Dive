# Open-ocean freedom and boundaries (Pass 053)

This pass makes the outer waters feel bigger and freer without making them unbounded. Each world keeps a finite, collision-safe swimming space, and loading is unchanged: one world at a time, prepared through its passage. What changes is how those limits **look and feel**:

- **Natural limits:** walls you can actually reach, rather than invisible stops short of them.
- **The outer reef:** reads as a window onto a much larger ocean.

## Boundary map

| World | Boundary | Before | After | Why |
| --- | --- | --- | --- | --- |
| **Tank** | Glass on all sides | Visible glass | **Unchanged** | The aquarium is meant to feel enclosed and cosy. |
| **Outer reef** | Back, out over the blue | Framed glass window at z −59.4 (posts every 8 m, frame bars); swimmer stopped about 1 m past the lip | **Frameless window, moved 4 m further out (z −63.4)**. It fades in only within a few metres, so from the reef the blue reads as open ocean. Near it, faint reflections show why you stop. | Hanging out over the drop-off is the outer reef's best moment. All the wildlife lanes, encounters and reef-fish bounds are measured from the glass, so they move out with it. |
| | Down the wall | Eased from −6 m | **Eased from −9 m** | Room to drift down the wall into the darkening blue. |
| | Sides | Framed side glass panes at x ±32.5 | **No side glass.** A gentle current eases you to a hover at the reef's flanks (the collision bound is unchanged). | The reef is built out to ±44 m and fades into haze, so the flanks read as more reef rather than a tank wall. |
| | Beyond the haze | Nothing (haze reached full strength by about 15 m) | **Far silhouettes**, described below. | Implies scale beyond what can be swum. |
| | The cliff (behind) | Cliff and tunnel | Unchanged | Natural, and the way home. |
| **Kelp forest** | Side and far rock walls | Easing began 5.5 m short of the walls (an invisible wall in front of visible rock) | **Full speed until about 3 m from the wall**, then a short ease. New solid colliders sit just inside the wall's rocky face, so the rock itself stops you. | You can swim up to the kelp and rock at the edge. |
| **Sea cave** | Its dome | A natural rock enclosure | Unchanged | It is meant to be enclosed. |
| **Under the ice** | Iceberg walls | Easing began 5 m short of the icebergs | **Easing begins 3.6 m short**, and the icebergs' own colliders stop you | You can come right up to the ice. |
| | The sea ice above | Eased from 5.7 m below | Unchanged | Brinicles hang about 2.6 m down; this keeps them clear. |

The far silhouettes in the outer reef:

- **Out in the deep:** seamount pinnacles and a far ridge.
- **To each side:** the reef running on.
- **Passing far out:** a whale, a manta and a school, on long slow paths.

## Design notes

- **The home aquarium keeps its glass.** The contrast is the point: the tank is cosy, and the outer waters are open.
- **The outer reef's window stays, but quietly.** Removing it entirely would leave an invisible wall 2 m from passing sharks and whales. A frameless pane that fades in only as you approach explains the stop when you reach it, without boxing in the view from the reef.
- **Soft limits.** The ease bands are shortened rather than removed. They still slow you before anything solid, but the slowing now begins much closer to what you can see.
- **Silhouettes are cheap and honest.** They are flat, fog-free shapes in a dark shade of the water:
  - two merged meshes, plus three shapes for the passers;
  - a few thousand triangles;
  - no textures or models loaded.

  None is within 16 m of anywhere the swimmer can reach (tested), so they always read as far away.
- **Passages.** The cleft, grotto and back tunnel are unchanged. They already continue the terrain: a crack at the cliff's foot, a grotto in the kelp's wall, and a frosted tunnel at the cave's back.

## Constraints kept

- **Terrain:** no infinite terrain, and no new biomes.
- **Loading:** one world at a time, through the existing passage streaming.
- **Collision:** the collision bounds still enclose every world. In the outer reef the back bound moves out with the glass; nothing else is widened.
- **Return to the tank:** unchanged, and works from every world.
