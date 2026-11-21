# V0.7 aquarium ornaments (Pass 072)

The six aquarium ornaments get restrained polish in the approved style.

**Unchanged:**

- asset identifiers, node names and the chest lid's pivot and collider;
- placement, scale, rotation, saves and the catalog.

**Source:** `tools/art/pass013/author.py` (Blender). Rebuild in this order: the collider inventory reads raw geometry, so it runs before compression.

```bash
python3 tools/art/pass013/author.py
```

```bash
python3 tools/art/pass013/collision_inventory.py
```

```bash
node tools/art/pass017/compress.mjs public/assets/models
```

**Gallery:** `COZY_SET=ornaments node validation/v07/small.mjs`.

## Inventory

| Object                                                  | Placement          | Pass 072                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Treasure chest (+ moving lid)                           | permanent          | Planks vary slightly in height and set, with worn rounded edges; rivets down every strap; iron corner brackets; barnacles and a coral tuft at one foot. **Lid untouched:** its hinge, thin collider and sweep guard are exact. |
| Filter                                                  | permanent (corner) | Rounder moulded housing and cover (larger bevels), a raised moulding seam, algae tufts on the cover                                                                                                                            |
| Stone archway                                           | permanent          | Weathering now cuts inward along the surface normal with erosion pockets (was a signed offset along one axis)                                                                                                                  |
| Statue                                                  | permanent          | Same weathering; moss cushions on the crown's edges, clear of the nudibranch's home at its centre                                                                                                                              |
| Hollow log, shipwreck ornament                          | permanent          | Reviewed: already continuous, textured forms; kept                                                                                                                                                                             |
| Catalog decorations (corals, plants, rocks, kelp, arch) | player-placed      | From the reef library and kelp: improved in Passes 069–071; unchanged here                                                                                                                                                     |

- **Materials:** wood and stone texture relief is raised (normal strength 0.3 → 0.5).
- **New detail is visual only:** rivets, brackets, barnacles, moss, seam and algae get no colliders.

## Collision and compatibility

- **Collider inventory:** `collisions.json` is regenerated.
  - A rebuild of the unchanged script reproduced the committed colliders within 1.5 cm. Only the subdivided stones differ slightly, from a different Blender version.
  - Stone colliders are built after weathering from the same vertices. Weathering only cuts inward, so they can only shrink, and the log and arch openings and every creature home stay clear (tested).
  - Chest planks move by at most 2 cm.
- **Unchanged identifiers:** the six ornament kinds, node names and `DYNAMIC_ChestLid`.

## Cost

| Asset          | Triangles         | File           |
| -------------- | ----------------- | -------------- |
| reef-props.glb | 100,282 → 107,900 | 1.17 → 1.26 MB |

Draw calls in the tank views are unchanged.

## Validation

- **Tests:** the ornament, authored-collision and playtest-fix suites (24 tests) pass. They cover the chest lid's hinge, sweep and collider, the openings, creature homes and the clear spawn.
- **Full suite:** 95 files and 966 tests pass, including catalog persistence and placement. Typecheck, lint and build pass.
- **Browser runs:** the aquarium views and the office miniature render with no errors.

## Limitations

- **Filter:** still a boxy housing with a slotted intake; it is aquarium equipment, kept recognisable as such.
- **Statue block:** the statue's base block remains a weathered block.
- **Log and shipwreck:** geometry unchanged.
- **Captures:** SwiftShader stills; the chest-lid animation needs a short look in the real game.
