# V0.7 global visual integration (Pass 074)

An integration and quality-control pass across all seven environments. It adds no content: no new areas, species, interactions or systems.

## Comparison gallery

`docs/screenshots/v07-pass074/` holds two fixed views per environment, captured on the same fixed clock and renderer. `gallery.jpg` combines them.

| Environment       | Views                                      | Draws   | Triangles   |
| ----------------- | ------------------------------------------ | ------- | ----------- |
| Office            | `office-spawn`, `office-tank` (miniature)  | 25–32   | ~62–66k     |
| Personal aquarium | `tank-section-swim`, `tank-chromis-school` | 92–145  | 0.91–1.13 M |
| Outer reef        | `outer-reef-top`, `outer-wall-lip`         | 116–118 | 3.9–4.2 M   |
| Kelp forest       | `kelp-forest`, `kelp-canopy`               | 44–58   | 2.9–3.1 M   |
| Shipwreck         | `wreck-overview`, `wreck-deck`             | 48–76   | 1.24–1.27 M |
| Sea cave          | `cave-cavern`, `cave-sunbeam`              | 52–57   | 1.16–1.18 M |
| Under the ice     | `ice-open-water`, `ice-seabed-close`       | 51–81   | 2.4–2.8 M   |

**Reproduce:** `validation/v07/office.mjs`, `validation/v07/baseline.mjs` (with `COZY_OUTER=1 COZY_OFFICE=1`) and `validation/v07/worlds.mjs`.

## Audit against the art bible

**Shared language (consistent across all worlds)**

- **Organic geometry and smooth shading:** creased normals throughout, from Passes 068–070.
- **Grounding:** rocks carved inside their colliders; corals with encrusting feet.
- **Creatures:** authored with rest-weight morphs and countershaded atlases.
- **Plant motion:** travelling-wave bending with per-plant gusts.
- **Water:** per-world profiles from the Pass 064 spectral fog, beams and caustics.

**Distinct atmospheres (intentionally different)**

- **Office:** warm and lived-in.
- **Aquarium:** bright, clear and aqua.
- **Outer reef:** deep blue, falling off into the blue.
- **Kelp forest:** green-gold, dappled.
- **Wreck:** murky teal, low visibility.
- **Cave:** dark, with a single sunbeam.
- **Under the ice:** cold blue, with breathing-hole shafts.

**Scale:** consistent; the creature and coral sizes from Passes 065–069 are unchanged.

**Exposure:** each world keeps the exposure from its Pass 064 profile, and none clips in the captures.

## Fixed in this pass

1. **Ice world: icebergs, sea ice and dropstones read low-poly.** The ice material forced flat shading, and both the iceberg and dropstone merges recomputed normals after de-indexing. The ice now shades from each lump's own creased normals: crisp fracture planes with smooth, worn faces between. The sea-ice sheet and chimneys get smooth indexed normals. Ice character is preserved, and triangles and draws are unchanged.

## Prioritised visual-issues checklist (remaining)

**P1: most visible**

- [ ] **Shipwreck hull:** reads as a flat, dark slab carrying growth. It needs plating seams, ribs or rust variation and a little more value contrast in its murky light.
- [ ] **Kelp-forest sand:** a plain vertex-coloured field with no ripples or grain. Bring it onto the shared sediment texture, which needs care with the caustics shader.
- [ ] **Outer-reef branching corals:** still rise from tall single trunks, because the structural capsules define the primaries. A spreading thicket needs new capsules and a placement and collision review.

**P2: noticeable on inspection**

- [ ] **Cave:** boulders still show smooth hull silhouettes at distance, and the sunbeam's floor pool is plain sand.
- [ ] **Ice seabed:** dense sponges and clutter. Detail could hide small animals; check sightlines in the playtest.
- [ ] **Seahorse, frogfish, moray (Pass 015 models):** a Blender rework to the hero standard.
- [ ] **Office furniture:** shapes are basic under the new materials; the open-plan office stays cool.
- [ ] **Crustaceans and jellies:** colour-banded joints instead of modelled ones, and no translucency or iridescence shading.

**P3: polish**

- [ ] **Sediment tiling:** the texture repeats about every 1.4 m. A second large-scale sample would break it up.
- [ ] **LOD:** plate and soft corals have no distance level; watch for pop-in.
- [ ] **Polar bear:** neck length. Geographic note: polar bears are an Arctic species placed in an Antarctic world, recorded and not changed.

**Transitions to check in the playtest:** office ↔ tank (glass), tank → outer reef (crevice), outer reef → kelp, kelp → cave (grotto), kelp → ice. Each crosses a deliberate change of water profile; watch for jarring exposure or fog jumps.

## Playtest record (approval gate)

The user performs a broad visual playthrough of the existing game. Record findings here before final optimisation:

| Area | Finding | Priority | Action |
| ---- | ------- | -------- | ------ |
|      |         |          |        |
