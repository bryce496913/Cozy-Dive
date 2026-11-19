# The kelp forest (v0.6)

Pass 032 starts v0.6 Expanding Oceans with a third water world: a giant kelp forest beyond the outer reef. You reach it the way you reached the reef: through a hidden crack, swimming, without a pause.

## Finding it

A second crevice stands at the foot of the outer reef's cliff, west of the tunnel you arrive by.

- **It is the tank's own crevice:** the same boulders, rock tube, darkness veils and supported overhang. It is turned half round, so the side that lies against the tank's back glass lies against the cliff, and its mouth faces west, away from the tunnel.
- **Hidden but findable:** from the reef top a coral bommie screens it. You find it by swimming along the cliff's foot, or around the outcrop.
- **Built from the tank's crevice** (`environment/outer/OuterCleft.ts`): one `Crevice` placed by a half turn and a shift (`CLEFT.offset`). Its colliders are turned with it: plane normals flip in x and z, and offsets move along them. Its channel test and darkness reuse the tank's by mapping a point back into tank coordinates (`cleftToTank`).
- **The reef keeps its look:** reef pieces that would stand in the cleft are dropped after the reef is generated (`inCleftClear`). The 11 pieces in that spot go, and the rest of the reef, about 1,000 pieces, is identical, including the bommie that screens it. Filtering during generation would have reshuffled the whole reef, because the generator draws extra random numbers only for pieces it places.

## Passages as links

`player/passage.ts` now treats passages as links between worlds. `crossing(world, p, ready)` returns the target world and the two frames to map position, velocity, thrust and look between, or `null`.

- **Tank ↔ outer waters:** the crevice and the tunnel, unchanged.
- **Outer waters ↔ kelp forest:** the cleft's threshold (`CLEFT_FRAME`, deeper runs east) and the kelp tunnel's start (`KELP_FRAME`, deeper runs south into the forest).
- **Common rules:** a world is entered only once it is ready. Hysteresis applies both ways, and the darkness peaks at each threshold, so the change of world is hidden at its darkest. Darkness in the outer waters is the larger of the tunnel's and the cleft's. In each world it applies only inside its own channel.
- **Return to the tank** works from either outer world.

## Loading

The application loads the kelp forest when you come within 15 m of the cleft's mouth in the outer waters, and releases it 4 s after you are 22 m away. It stays while you are in it. The outer waters stay loaded while you are in the kelp forest, so the way back is seamless. Only the world you are in renders.

## The forest (`environment/kelp/`, `rendering/KelpForestScene.ts`)

- **The way in:** a straight tunnel from the threshold through a rock wall, black at its start and lighter towards the exit. Its colliders are a square duct a little inside the rock, capped behind the start. The wall's colliders seal everything else.
- **The ground:** a rocky seabed with gentle swells, rising towards the wall and the edges, with a sandy lane winding through. There are 44 dark, encrusted boulders, merged into one mesh with one exact collider each.
- **Giant kelp** (`KelpStalks`): 150 plants in groves, kept off the lane and the tunnel's exit.
  - **Shape:** each plant is a holdfast with three stipes, hung with long, wavy golden-brown blades and a canopy near the bright surface.
  - **Drawing:** three templates, instanced, one draw each.
  - **Sway:** the whole forest sways slowly in the vertex shader, each plant on its own phase, by height. It advances on simulation time only, so it is still while paused and with reduced motion.
- **The water:** green, with fog for about 15 m of visibility, and the same kinds and number of lights as the tank, so most shader programs are shared.
- **Soft edges:** swimming eases to a hover at the forest's edges and below the surface, as in the outer waters (`easeInKelp`).

## Life

- **Garibaldi:** 20 fish in five groups around the larger boulders, each minding its own patch rather than schooling.
  - **Model:** the chromis rig at about twice the size, with its colour texture replaced by solid orange (`AuthoredSchool`'s new `recolor`). Relief and roughness are kept; eyes, gills and mouth keep their own look.
  - **Not in the tank:** they are a species of their own (`garibaldi`), outside the tank's population.
- **Bat rays:** the eagle ray's model, tinted dark (`CruiseGroup.tint`). Three swim in a loose line, plus one alone, gliding low along the sandy lane. Their routes are lifted over the boulders. `OuterCreatures` takes its route groups as a parameter; the reef passes its own, as before.
- **Shared loading:** both reuse the tank's fish loader, so nothing is decoded twice.

## Discovery

- **New sightings:** giant kelp (`plant:giant-kelp`), garibaldi (`species:garibaldi`) and bat ray (`species:bat-ray`) join the journal and the "Seen" page.
- **Unlock:** seeing the kelp unlocks a **Kelp** stand for the tank. It is three small stalks built in code at unit height, run through the tank's plant conversion and sway like the seagrass and sea fans.
- **Later:** the garibaldi and a bat ray pup are candidates for the tank in a later pass.

## Limits

- **Variety:** the kelp, rock and sand are procedural and simpler than the reef's authored art. The bat ray is a tinted eagle ray (its spots show faintly), not a model of its own.
- **Water:** there are no light shafts, and the surface is a plain bright plane far above.
- **The cleft's look:** it is a copy of the tank's crevice, so the two look alike. That is intended, as kin, but it is not unique.
