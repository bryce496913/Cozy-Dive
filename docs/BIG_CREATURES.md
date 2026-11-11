# Big creatures and sightings (v0.4 Pass 025)

Pass 025 brings the outer reef's first big animals, and counts what you see out there. Seeing things is the gentle progression agreed for v0.4 and v0.5: what you have seen will unlock for the tank in v0.5. There are no counts, scores or timers, and nothing can be lost.

## The creatures

| Creature            | How many | Where                                                                                  | Size         | Speed    |
| ------------------- | -------- | -------------------------------------------------------------------------------------- | ------------ | -------- |
| Blacktip reef shark | 2        | One cruises a wide loop in mid-water; the other a lower loop dipping over the drop-off | 3.0 m long   | 1.1 m/s  |
| Spotted eagle ray   | 3        | A loose line down the sand channel, out over the deep blue, back over the reef         | 3.0 m across | 0.8 m/s  |
| Green sea turtle    | 1        | Between the coral heads on the western side                                            | 1.3 m long   | 0.45 m/s |

**Calm behaviour.** Each creature follows a smooth closed route at a steady speed:

- **Giving way.** Within its comfort distance of you (7 m for the sharks, 4.5 m for the rays, 3 m for the turtle), it eases aside. It moves sideways or up, never down or towards you, by up to 5.5, 3.5 or 2.5 m. It also watches where its route will be 2.5 s ahead, so it starts moving aside before it arrives. It keeps one side for each encounter, so passing you never makes it swerve back across. Once you have gone, it drifts back to its route.
- **Nothing chases you or flees**, and nothing can hurt you.
- **Motion.** Heading and pitch follow the creature's actual path through gentle filters, and it banks a little into turns (not with reduced motion).
- **Swimming strokes:**
  - the shark's body sweeps side to side;
  - the rays' wings beat, then the rays glide for a while;
  - the turtle's front flippers sweep down and back, then rest.
  - With reduced motion, strokes are 40% smaller.
- **Routes stay clear of the reef.** Each route is a loop through a few waypoints, sampled every 0.5 m. It is then raised wherever the reef or seabed beneath it (within the creature's width) comes within its clearance: 2.4 m for the sharks, 1.3 m for the rays, 1.0 m for the turtle. The raise is spread and averaged over 6 m either side, so routes rise and fall smoothly over coral heads. The height map comes from the reef layout as drawn (colonies seated on their rocks), with each kind of piece's height measured from the library.
- **No collision.** The creatures do not collide with you; they keep their distance instead.

## The models

All three are new, authored from scratch in Blender by `tools/art/pass025/creatures.py`:

- bodies lofted from cross-sections, with fins and flippers built from smoothed outlines;
- painted 512 px base colour, normal and roughness maps;
- each creature is one mesh with one material (fins and eyes included), so it costs one draw call;
- `Stroke_Left` / `Stroke_Right` morph targets are the two ends of its stroke;
- a decimated distance level with the same morphs.

| Model      | Triangles (full / far) | File   | Distance level beyond |
| ---------- | ---------------------- | ------ | --------------------- |
| Reef shark | 10.3k / 1.7k           | 537 kB | 34 m                  |
| Eagle ray  | 5.3k / 0.8k            | 373 kB | 30 m                  |
| Sea turtle | 8.2k / 1.3k            | 502 kB | 20 m                  |

They are leased from the tank's fish loader while the outer reef is loaded, and released with it.

## Sightings

- **What counts as seen.** Something is seen when it stays within 6 m (beyond its own size), near the middle of your view, for 1.5 s in all. Brief glances add up slowly.
- **What can be seen:**
  - the three creatures;
  - six kinds of reef feature: branching, boulder, plate and soft corals, sea fans and seagrass.

  Each reef feature is offered at up to 24 pieces spread through the reef; seeing any one counts.

- **Several pieces share one id.** The tracker keeps one timer per kind, which is in view when any of its pieces is. A kind is never counted twice in a frame, and its out-of-view pieces do not wear down its progress. This fixes a flaw in Pass 023's tracker, which kept one timer per candidate.
- **When something is first seen:**
  - a quiet note fades in near the top of the screen: _New sighting · Spotted eagle ray_;
  - it fades out after about four seconds;
  - the journal is saved on this device.
- **The "Seen" page.** The pause screen offers _Seen in the outer waters_ once anything has been seen, so the hidden passage stays a secret until you find it. The list holds each thing's name and the day you first saw it, oldest first. There are no counts and nothing to complete. It opens and closes from the keyboard (Escape closes it), and only one panel is open at a time.
- **Ids are stable**, such as `species:blacktip-reef-shark` and `coral:sea-fan`. v0.5's catalog unlocks by them. Ids this version does not know stay in the journal but are not listed.

## Modules

| Module                                | Role                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `config/creatures.ts`                 | Species tuning and shared cruising constants.                                                                                 |
| `creatures/cruising.ts`               | Pure: route sampling and lifting, `CruiseRoute`, and `Cruiser` (giving way, heading, bank, strokes). No per-frame allocation. |
| `environment/outer/OuterCreatures.ts` | The obstacle height map, the routes and groups, and the renderer (leases, distance levels, morphs, sighting candidates).      |
| `environment/outer/outerSightings.ts` | The reef's own sight candidates.                                                                                              |
| `discovery/sights.ts`                 | Every sight's id and name; the "Seen" list.                                                                                   |
| `discovery/journal.ts`                | The journal and the tracker (now one timer per kind).                                                                         |
| `ui/Interface.ts`                     | The "New sighting" note and the "Seen" panel.                                                                                 |
