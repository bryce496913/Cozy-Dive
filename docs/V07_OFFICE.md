# V0.7 office environment (Pass 073)

The office moves from a cool, white-and-grey corporate box to a warm, lived-in room that belongs with the underwater worlds. The aquarium stays the focal point.

**Unchanged:**

- the layout and walking collision (apart from one floor plant);
- the dive and surface transition through the glass;
- the miniature aquarium portal.

**Fixed viewpoints:** `node validation/v07/office.mjs` captures five views (spawn, overview, desk, tank, chairs) plus a tank approach.

## What changed

| Area             | Before                                | Pass 073                                                                                                                                                                      |
| ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Floor            | Cool white porcelain tiles            | Warm oak planks: four across each 1.2 m tile, full-length boards with staggered butt joints, flowing grain, rare faint knots, soft seams (`plankFloorTexture`)                |
| Walls            | Cool grey grasscloth, white back wall | Warm greige grasscloth, cream back wall                                                                                                                                       |
| Trim             | Black                                 | Warm charcoal                                                                                                                                                                 |
| Desk             | Near-black wood, white modesty panel  | Walnut top, warm oat panel                                                                                                                                                    |
| Guest chairs     | Saturated blue seats, grey backs      | Muted rust seats, oat backs                                                                                                                                                   |
| Aquarium cabinet | Charcoal                              | Dark walnut (the hood stays black equipment)                                                                                                                                  |
| Lighting         | Bright, cool white throughout         | A warmer, gentler hemisphere and ceiling light; a warm desk-lamp pool; the window daylight kept cool; the tank's aqua light slightly stronger as the room's focal contrast    |
| Props            | None lived-in                         | A muted wool rug (three bordered layers, below the baked contact shadows), a desk lamp with a glowing shade, a stack of books, and a fiddle-leaf fig in the front-left corner |

**Plant collision:** the plant is in `OFFICE.plants`, which feeds walking collision, so you walk round its pot. It sits away from the spawn point and the routes to the desk and tank.

## Cost

| View     | Draws   | Triangles     |
| -------- | ------- | ------------- |
| Spawn    | 28 → 30 | 59.6k → 65.1k |
| Overview | 32      | 61.5k → 66.0k |
| Tank     | 25 → 27 | 58.0k → 64.5k |

- **Draws:** one more merged mesh for the plant, and the room budget test moves from 27 to 28.
- **Lights:** one more point light (the desk lamp).
- **Downloads:** none added. The floor texture is generated at 512 px, like the tiles it replaces.

## Validation

- **Tests:** the office, walking and dive suites (53 tests) pass, including room bounds, the room draw budget, collision and transitions.
- **Full suite:** 95 files and 966 tests pass, as do typecheck, lint and build.
- **Browser runs:** the office viewpoints render with no errors. The baseline run starts in the office, dives through the glass into the tank, and captures the aquarium views with no errors.

## Limitations

- **Furniture shapes:** largely unchanged. It was already built from rounded parts; this pass is palette, materials, light and props.
- **No bookshelf:** the office has none, and none was added.
- **Open-plan office:** beyond the glass it keeps its cooler corporate palette, as a deliberate contrast.
- **Captures:** SwiftShader stills. Warmth and exposure should get a short look on a real GPU.
