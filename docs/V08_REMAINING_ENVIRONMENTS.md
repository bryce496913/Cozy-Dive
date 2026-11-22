# V0.8 Pass 086: Remaining Environment Art Overhaul

Base: main after Pass 085. Scope: the shipwreck, the sea cave and the waters under the ice.
Routes, colliders' roles, the wreck's hold, breach, bridge and torch, every animal and encounter,
and every passage opening are kept. No new species, areas or routes.

Galleries: `docs/screenshots/v08-pass086/` (before on the left, Pass 086 on the right, from the
real game at identical cameras and simulation time: `validation/v07/worlds.mjs` with
`COZY_WORLDS=wreck,cave,ice`). The "before" views were rendered from a clean export of main on a
second dev server, so no edit could reach them. Source renders of the new procedural forms, in
their world's water and light, are in `docs/screenshots/v08-pass086/sources/`
(`validation/v08/forms.html` + `forms.mjs`).

## 1. Audit (before)

| World     | Issue found                                                                                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sea cave  | Both tunnel mouths were a ring of 12-14 randomly rotated boulders round the hole (plus 10 more angular `rockShape` boulders at the entrance): a garland of separate, faceted rocks, plainly assembled                                          |
| Under ice | The tunnel mouth was the same boulder ring in basalt                                                                                                                                                                                           |
| Under ice | Every iceberg wall (26), grounded fragment, ice column and hanging chunk was one carved-rock lump stretched to its size: the sides of the world read as a row of the same faceted block, and the grounded pieces stood on the sand             |
| Shipwreck | Pass 076's plating (strakes, butts, frame sag, seams, rust) holds up; but the colonies sat on bare plate like stickers, each kind scattered by itself, and the superstructure's boxes were evenly painted with no wear at edges or silt on top |

## 2. Sea cave: natural tunnel-mouth geology

`src/environment/shared/MouthArch.ts` sculpts each mouth as one continuous arch of bedded rock
growing out of the wall:

- **Interlocking masses:** a low collar all round the hole, plus six masses set asymmetrically
  (heaviest over one shoulder, a buttress down one side, smaller blocks at the foot). Each has a
  broad, slightly tilted face and steep flanks, and they meet along crisp V-joints.
- **Strata:** uneven beds that recede upward and step out at their base.
- **Weathering:** a few near-vertical fractures across the beds, solution pits and fine wear.
- **Integration with the wall:** the lip rounds over into the tube, hiding the seam where the tube
  meets the dome. The outer edge sinks behind the wall's actual surface, found by bisection on
  `chamberDepth`, so the dome's own rock swallows the silhouette.
- **Colour:** stone by bed, darker in joints and hollows, paler on the proud edges, shading into
  the tunnel's dark at the lip. Silt settles on the entrance's up-facing ledges; a little frost
  settles on the back tunnel's.

Both cave mouths and the ice tunnel mouth use it; the 10 angular entrance boulders are gone. The
old `mouthRocks` is kept (unused) for rollback. The arch adds no collider: like the boulders it
replaces, it is scenery outside the tunnel's duct, and its lip never comes inside the tube's
radius minus 0.14 m (tested).

## 3. Under the ice: sculpted ice

`src/environment/ice/IceForms.ts` sculpts each piece in metres at its own size, by kind (`wall`,
`berg`, `column`, `shard`, `chunk`):

- **Shape and calving:** a rounded-box mass (squareness by kind) with broad lobes and a slight
  lean. Three to five calving planes shear flat, fresh faces off it, coloured clearer and bluer.
- **Surface:** melt scallops (shallow dished hollows in a cellular pattern, about 1.5 m across,
  with crisp rims), and uneven horizontal beds, each stepped by its own amount and coloured
  bubbly white or clear blue. Vertical melt flutes run down the sides.
- **Ice-seabed transition:** grounded pieces flare into a skirt at the foot and have a melt notch
  just above the sediment, so they settle into the seabed rather than standing on it.
- **Translucency-like cues, without a transmission pass:** convex scallop rims and thin edges are
  lighter and cyan; hollows, calving faces and undersides are deeper blue; the foot is darker and
  bluer, where little daylight reaches.
- **Collision:** solid forms carry a `collisionHull` from a coarse copy of the same sculpt,
  expanded 5% so it holds the rendered ice (tested to within 5 cm). This follows the Pass 070
  carved-rock convention: a hull of every rendered vertex took about 0.1 s per form to turn into
  planes.

Vegetation and small organisms were reviewed and left as Pass 079/083 placed them. They are keyed
to the sand lanes, the breathing holes and the dropstones, all unchanged, and the ice-formation
test still holds the algae out of the lanes and holes.

## 4. Shipwreck: weathering and settled growth

In `ShipwreckModel.ts` and `WreckGrowth.ts`:

- **Surface facing:** every steel part's colour now follows its facing. A patchy pale silt
  settles on whatever faces up (decks, tops of the deckhouse and fittings); grime gathers under
  whatever faces down.
- **Edge wear:** the boxes of the superstructure and fittings are worn through to rust at their
  edges and corners, with rust streaks running down from their top edges.
- **Growth sites:** 30 sites, spread along the whole ship, fixed for the build and shared by the
  hull paint, the decks and every growth kind.
- **Encrusting mats:** at each site the plating and decking are painted with mats of coralline
  pink, ochre and turf, with ragged edges. A new instanced kind of low, nodular encrusting mats
  (170, one draw call) lies flush on the plate there.
- **Colonies:** every kind settles round the shared sites, each on its own share of them, so
  sponges, soft corals, fans and black coral mix in the same patches on the mats they grew from.
  Before, each kind scattered by itself. A fifth of each kind stays loose between patches.

The hold, breach, routes, bridge, torch, life and every collider are unchanged.

## 5. Asset and performance report

All procedural; no new runtime assets or downloads. Measured in the fixed views
(`validation/v07/worlds.mjs`, SwiftShader, 1280x800):

| World     | Draw calls (view range) | Triangles in view, before → after        | Build time (Node, one run) |
| --------- | ----------------------- | ---------------------------------------- | -------------------------- |
| Shipwreck | +1 (the mats), 51-80    | 1.31-1.54 M → 1.36-1.59 M (+~0.05 M)     | unchanged in practice      |
| Sea cave  | unchanged, 35-61        | 1.37-1.70 M → 1.37-1.71 M                | unchanged in practice      |
| Under ice | unchanged, 50-101       | 2.26-2.99 M → 2.49-3.22 M (+0.22 M, ~8%) | 1.13 s → 1.11-1.24 s       |

- **Per-piece cost:** an arch is 11.1k triangles. The ice kinds are 5.1k (wall, reduced from 9.7k after the first after-capture showed +0.35 M), 7.2k (berg),
  5.8k (column), 2.0k (shard) and 0.7k (chunk), all merged into the world's existing single ice
  mesh.
- **Build time:** the first wiring doubled the ice world's build time (3.2 s while a capture was
  also running, 2.2 s alone), because the colliders were hulled from every rendered vertex.
  Caching each welded icosphere and the coarse collision hulls brought it back to main's level.
- **Not measured:** laptop or cross-browser frame rate (not tested in this pass).

## 6. Validation

- **Checks:** typecheck, lint and build pass.
- **Full test suite:** 104 files, 1,062 tests pass, including:
  - the cave and ice swim-through-the-tunnel tests;
  - the wreck, cave and ice suites;
  - lifecycle dispose;
  - art consistency (its cave-mouth check now names the arches; the expected mean tone was
    lowered because the arches shade their lip and sunken edge);
  - the new `remaining-environments` test: the arch never narrows the passage, stands proud and
    faces the opening, and is built of distinct masses; every ice kind is within budget and
    finite; the ice collision hull holds the rendered ice; wreck colonies settle round the shared
    sites on mats.
- **Browser:** all 24 fixed views of the three worlds rendered with 0 errors. No whole-game
  walkthrough or long-session stress run (out of scope by request).

## 7. Known limitations

- **Back-tunnel collar:** with the boulders gone, Pass 079's flat rock collar shows as a darker
  ring inside the cave's back-tunnel arch.
- **Ice-mouth arch:** its frosted beds read as dark and pale horizontal bands, more striped than
  natural basalt at the tunnel's approach.
- **Ice materials:** the forms are better modelled than lit. The ice material is unchanged
  (roughness 0.38 with a blue glow), so the near bergs still read somewhat smooth; the scallops
  show mainly at close range.
- **Wreck:** the silt and edge wear on the superstructure are subtle at swimming distance. The
  hull's mats and grouped colonies are the visible change.
- **Not done from the brief:** the cave's wall silhouettes, erosion and fracture layering, and the
  seabed and rock relationships under the central light shaft, were not reworked in this pass.
  The dome, its boulders, pillars and skylight rubble are still Pass 079's carved limestone. The
  pass went to the tunnel-mouth geology, the brief's first cave item.
- **Not changed:** the wreck cavern, and the dropstones and outcrops under the ice.
