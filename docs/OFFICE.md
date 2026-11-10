# The office (v0.3)

Pass 020 adds the home office that holds the aquarium. It is the default start, and the first step towards the office-to-tank dive (Pass 021).

## Modules

| Module                                    | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/office.ts`                        | Room, furniture, walking and tank dimensions shared by code and tests. The aquarium is scaled by `TANK_SCALE = 1/36` to a 1.0 × 0.39 × 0.78 m tank, on a 0.75 m stand against the right wall, its front facing the room.                                                                                                                                                                                                                                       |
| `environment/office/OfficeTextures.ts`    | Deterministic procedural `DataTexture`s (no canvas, no files): wood, oak floorboards, plaster, rug, clock face, ocean print, rainy garden.                                                                                                                                                                                                                                                                                                                     |
| `environment/office/OfficeEnvironment.ts` | The room, built in code: walls with a window recess, door, desk with laptop, mug, notebooks, lamp and succulent, chair, bookshelf of books and keepsakes, a tall fiddle-leaf plant and a snake plant, stand and tank frame. Static parts are merged per material (vertex colour tint), about 15 draw calls. Owns and disposes its root, geometries, materials and textures. Animates the clock (time of day) and the rain shader (frozen with reduced motion). |
| `player/walking.ts`                       | Pure walking integrator: fixed eye height, yaw-relative input (forward −z, positive yaw left), normalised diagonals, eased velocity, frame gaps capped at 0.1 s, sub-stepping, and circle-versus-footprint sliding against furniture and walls.                                                                                                                                                                                                                |
| `rendering/OfficeScene.ts`                | Office camera and lights: hemisphere fill, a wide soft spot standing in for window daylight, the warm desk lamp, and a faint tank glow. Draws the miniature aquarium (below).                                                                                                                                                                                                                                                                                  |
| `audio/OfficeAmbience.ts`                 | Gesture-unlocked procedural soundscape: rain wash with swells and droplet taps, a once-a-second tick/tock, and tank bubbling scaled by distance. Follows the shared mute and volume settings, and schedules ahead from `update`.                                                                                                                                                                                                                               |
| `app/Application.ts`, `ui/Interface.ts`   | Orchestration only. The start mode is `office` (the benchmark uses `aquarium`). The start screen offers Enter the Office and Enter the Water. The pause screen switches spaces, each keeping its own look direction, and only the current space is heard.                                                                                                                                                                                                      |

## The miniature tank

The aquarium keeps simulating at full scale in its own scene and renderer. Each office frame:

1. **Map the camera.** `miniatureView` maps the office camera into aquarium space: undo the tank transform, then divide by `TANK_SCALE`. Perspective is scale-free, so that camera sees exactly what a one-metre tank would. `tests/office.test.ts` checks that aquarium points project to the same screen position in both views.
2. **Simulate.** `UnderwaterScene.simulate` advances the fish and creatures, choosing fish distance levels for that camera. The camera is tens of aquarium units away, so fish, corals and rocks use their cheap levels.
3. **Render to a texture.** `UnderwaterScene.renderView` renders into a 0.6×-resolution half-float target, with the underwater haze thinned from 0.026 to 0.009, since the eye is outside the water.
4. **Show it through the glass.** The tank's four glass panels sample that target in screen space, with a faint tint and a fresnel sheen. Office objects in front of the tank still occlude it normally.

## Limits

- **Tank interior.** Beyond its walls the aquarium shows its teal background, which reads like the background board of a real tank. The water surface is not visible from above, because the tank has a hood.
- **Lighting.** No shadows. The spotlight stands in for an area light.

## The dive (Pass 021)

`player/dive.ts` plans the dive and the surfacing as eased segments. It is pure and tested in `tests/dive.test.ts`. `Application` samples the plan each frame and renders whichever space the frame reports.

- **Dive.** Three segments:
  1. **Approach** (1.8 s, office): from where you stand to 0.45 m in front of the glass at its mid-height, looking straight in. This is a crouch to tank height.
  2. **Lean** (0.55 s, office): to 0.1 m from the glass.
  3. **Settle** (1.9 s, aquarium): from that same viewpoint, mapped into aquarium space (`officeToAquarium`), to the usual swim start.
- **Why the switch is seamless.** At 0.1 m the whole view is glass, and the glass shows the aquarium rendered from exactly that mapped pose. To make the colours match a direct render too:
  - **Glass:** its tint and sheen fade out over the last half metre (`clarity`).
  - **Background and translucency:** the miniature target keeps the background identifiable (alpha 0). The glass shader un-premultiplies, tone-maps what was drawn and lays it over the untouched background colour, as the screen does.
  - **Contact wash:** a teal wash peaks at the crossing (`DIVE.contactVeil`), with a CSS bubble burst.
  - **Haze:** the underwater haze eases from the outside-view 0.009 to 0.026.
- **Surfacing.** The reverse:
  1. **Rise** in the aquarium to just inside the front glass, near the surface.
  2. **Pass out** through the glass, switching back to the office at the identical viewpoint.
  3. **Stand up** a step back from the tank, facing the room.
- **Prompts.**
  - **Dive in:** within 1.6 m of the tank front and looking at it.
  - **Return to the office:** within 1.3 m of the surface.
- **Control.** Input is ignored during the glide, and pausing freezes it. The pause screen's buttons still cut instantly, and cancel an unfinished dive.
- **Audio.** The destination's audio is unlocked by the E key press. Each soundscape is active only in its own space.
- **Reduced motion.** A 0.45 s fade out, a cut, and a 0.45 s fade in. No glide, no bubbles.
