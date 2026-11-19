# The tank catalog

Pass 029 starts v0.5 Personalization alongside the v0.4 release candidate. v0.4 remains open for the user's macOS play-through. Pass 030 adds discovered baby animals alongside the corals and plants.

## Quiet discovery

`src/catalog/catalog.ts` maps journal sightings to six tank items. Only discovered entries appear. The three large-animal sightings unlock **Blacktip pup**, **Baby eagle ray** and **Turtle hatchling**. Unseen animals are absent too. There are no locked slots, completion counts or currencies.

Pause while swimming inside the aquarium and choose **For your tank**. Choose a colony or grass patch to resume with a translucent preview. Aim toward nearby sand or a rock top, press **R** to turn and **F** to place. A dim preview means the location is unsuitable. **Escape** cancels and pauses. Look at an added item within reach (solid scenery blocks targeting) to **G** move or **X** remove it. Moving keeps the original solid and saved until a valid replacement is confirmed. At twenty items, another selection shows only “The tank feels full here”.

## Little visitors

Each discovered animal has **Add to the tank** and, once present, **Return it to the sea**. The tank hosts one of each, independently of the twenty decoration places. Adding resumes swimming and fades the visitor into clear water near you, outside fish, other babies, scenery and protected homes. Returning fades it out; presence saves immediately. There is no feeding, growth or anything to maintain.

These are miniature versions of the existing local adult models, with their existing strokes. Neutral sizes in aquarium coordinates are about **0.54 m pup length**, **0.50 m ray disc** (about 0.72 m nose-to-tail), and **0.25 m hatchling shell** (about 0.31 m whole-body length). No new models or juvenile mesh edits were needed. The ray's long tail is included in its collision enclosure.

`creatures/babies/` owns pure fixed-30-Hz simulation and reusable swept A* navigation buffers. Pass 031: finding the start and goal cells searches outward from the point, rather than scanning every cell, and the search advances at most `PLAN_BUDGET` (60) nodes per fixed step while the baby coasts. No single frame pays for a whole route, and behaviour stays identical at any frame rate. The pup follows broad channel loops, the ray descends toward low glides and occasional flat rests, and the hatchling visits the banks with occasional lightward rises. Giving way is gentle, strokes shrink with reduced motion, and pause freezes movement and fades. Sand clearance uses maxima from the actual rendered mesh; rest/take-off keeps the ray flat before strokes resume. Static hulls, the animated chest lid's full sweep, small pebbles, creature homes, glass margins and the crevice/return alley are protected. Edits invalidate paths; placing directly on a visitor is rejected. Fish share the residents' stable positions for steering and swept personal space.

`TankBabies` is lazy: an original tank has no resident owner, model downloads or resident updates. It leases the existing three assets through the aquarium fish loader, owns only hierarchy, simulation buffers and opacity materials, and borrows geometry/textures. The final lease frees an unused model; returning from the outer reef retains models still leased by babies. The office draws those same animals at their far detail levels.

## Placement and collision

Pure validation checks finite coordinates, glass clearance, support height and footprint, the full central channel, existing structures and protected creature homes, the crevice/return alley, other additions and swept volumes around the existing physically tested routes. Route construction is shared by the environment and the validation harnesses. The authored rock surface is queried once per placement probe rather than relying only on procedural support hulls.

Each item has a conservative convex box containing its rotated visible footprint and sway margin. On an edit, its old colliders are replaced in the existing shared aquarium collider array; both player collision and fish habitat immediately see the same set. A placement cannot intersect the swimmer or a nearby fish. On restoration, fish initialized in a saved colony's volume are moved to a nearby clear position once, before normal play.

## Art, batching and ownership

`TankDecoration` leases the existing reef library through the aquarium's loader. It normalizes existing authored colonies to small tank-sized pieces, preserves available distance geometry and groups instances by kind/detail. Soft corals, fans and grass use the existing plant shader and its shared clock, including reduced motion. The office renders the same aquarium scene, so additions appear in its miniature without a second scene or asset load.

The editor owns its DOM/listeners and the decoration instance. The decoration owns converted vegetation geometry, preview materials and instance buffers; library geometry/materials remain owned by the shared lease. Disposal and asynchronous completion are guarded. Original aquarium resources remain untouched.

## Saving and reset

`cozy-diver.tank.v1` now holds version 3 (Pass 051): decoration ids/kinds/positions/rotations, baby species ids and added-fish counts by species. Pass 029 version 1 and Pass 030 version 2 saves migrate without losing anything; they simply have no fish yet. Entries a visit cannot show (not yet seen, or no longer fitting) are kept and written back (Pass 050), and a save from a newer version is never overwritten. Loading drops malformed, duplicate, unsupported, undiscovered or invalid placements independently. Unavailable storage leaves the editor usable for the visit. Settings offers **Restore the original tank**, followed by explicit confirmation; it clears additions and returns animals to the sea while preserving sightings and preferences. Reset is immediate even while paused; ordinary returns fade on simulation time.

Conservative clearance can reject visually tempting spaces near homes or narrow rocks. This intentionally keeps the established swimming paths and animal habitats usable. GPU and comfort acceptance still require target-device testing.

## Pass 051: full aquarium personalization

The catalog is data-driven and grouped. Nothing costs anything and nothing needs looking after: there is no feeding, death, water quality, currency or timer. The only limit is room in the tank.

### Inventory

**Schooling fish** (`src/config/tankFish.ts`). These join the tank's own school of their kind.

| Fish                | Offered                | Most added                   |
| ------------------- | ---------------------- | ---------------------------- |
| Blue-green chromis  | from the start         | 12                           |
| Pajama cardinalfish | from the start         | 6                            |
| Blue tang           | once seen (outer reef) | 3 (a small group of its own) |

**Aquarium fish.** Each keeps a territory of its own.

| Fish                    | Offered                | Most added |
| ----------------------- | ---------------------- | ---------- |
| Firefish                | from the start         | 4          |
| Yellow assessor         | from the start         | 2          |
| Royal gramma            | from the start         | 2          |
| Threadfin butterflyfish | once seen (outer reef) | 2 (pairs)  |
| Moorish idol            | once seen (outer reef) | 2 (pairs)  |

At most **24 added fish** in all (`TANK_FISH_CAP`).

**Little visitors.** Unchanged: blacktip pup, baby eagle ray and turtle hatchling, one of each.

**Plants and corals.**

- **Unlocked by a sighting:** boulder, branching, plate and soft coral, sea fan, seagrass, kelp. Two new variants come with sightings already made: **tall branching coral** (with branching coral) and **tiered plate coral** (with plate coral).
- **From the start**, because they already grow in the tank: **caulerpa**, **halimeda** and **red algae**.

**Rocks and decorations.**

- **Limestone arch:** once the sea cave is seen.
- **From the start:** **reef rock** and **smooth stone**.

All new decorations are nodes of the existing authored reef library: no new assets or downloads. The six tank ornaments (boat, chest, filter and the others) stay unique. They carry named creature homes and effects, so copies would conflict with those homes.

**Not for this tank.** Once seen, these are listed with a gentle reason:

- **The anemone's clownfish family:** already in place.
- **Too big:** parrotfish, humphead wrasse, bigeye trevally and great barracuda.
- **Cool kelp-forest water:** garibaldi, kelp bass, blacksmith and señorita.
- **The dark of a sea cave:** glassy sweeper, soldierfish and flashlight fish.
- **Freezing polar water:** icefish and bald notothen.

### Living fish, not decorations

`TankFish` (`src/environment/TankFish.ts`) gives the added fish one population on the ordinary fish simulation. It uses the same species definitions, habitat, obstacle avoidance, territories, diver reactions and behaviour as the tank's own fish, and the same authored rigs (`AuthoredSchool`). If those rigs cannot load, it falls back to the simple fish.

The tank's home fish are passed to the added population's schooling as one-way **companions** (`FishSchooling`):

- **Schooling:** added chromis and cardinalfish see the home fish as neighbours. They keep apart from them, align with them and close up with them, so they join the existing school.
- **The home fish:** nothing feeds back into their simulation. They move exactly as they did before. A test proves this: the home fish's positions are identical, to the last bit, with and without added fish.
- **Ids:** added fish's ids start after the home fish's.

`TankFish` is created lazily, so an unpersonalized tank pays nothing. It is owned by the underwater scene and updated after the home fish. The office drives that same update for its miniature, so added fish swim there too.

When the counts change, the population is rebuilt (only from the catalog, never per frame):

- **Stale loads:** a rig load that is overtaken by a newer change is discarded, and its leases are released.
- **No room:** if the tank cannot seat a new population, nothing changes, and a calm note says there is no open water just now.

Placement checks and the one-time re-seat after an edit cover both populations.

### Placing and changing

- **Turning:** **R** turns 30° and **Shift+R** turns back.
- **Undo:** **Z** (or **Undo** in the panel) steps back through the last 20 changes: placing, moving, removing, and adding or returning a fish or a visitor.
- **Cancelling:** with a preview showing, **Z** or **Escape** cancels; a cancelled move keeps the original.
- **Adding fish:** adding or returning a fish keeps the panel open, with focus on the same button, so several can be added from the keyboard.
- **Gentle limits:** an unavailable **Add one** is disabled and its reason is read with it, for example "The tank has all the royal gramma it suits."
- **Restore the original tank:** also returns the added fish to the sea and clears Undo. Sightings and settings stay.
