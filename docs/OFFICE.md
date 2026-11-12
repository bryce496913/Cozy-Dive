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
- **Lighting.** No real-time shadows. The spotlight stands in for an area light. Pass 022 adds baked contact shadows (below).

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
  - **Dive in:** standing in front of the glass (at least 15 cm out from it, and no more than 20 cm past either end of it sideways), within 1.6 m, and looking at it. Beside or behind the tank there is no prompt, and from anywhere it is offered the glide stays clear of the furniture (tested).
  - **Return to the office:** within 1.3 m of the surface.
- **Control.** Input is ignored during the glide, and pausing (Escape, or a hidden tab) freezes it in place: the transition, the aquarium's clock and the office's reverse view all stop.
- **Interruptions.** On the pause screen, choosing where the transition was going resumes it from where it stopped. Choosing where it came from cancels it and puts you back exactly where you pressed E, in that space. The walking or swimming state always matches the camera afterwards, so nothing snaps.
- **One aquarium clock.** The aquarium simulates on the same clock whether it is seen in miniature from the office, during the dive or while swimming. It keeps running through transitions, so fish and plants never jump in phase at the switch.
- **Warm shaders.** The surfacing view's shader is compiled during loading; only its plane and render target are created per surfacing, and both are freed when it ends.
- **Audio.** The destination's audio is unlocked by the E key press. Outside transitions, each soundscape is active only in its own space. During any transition (Pass 022) both play, crossfaded by the frame's `water` share: it eases from 0 (office) to 1 (water), is exactly 0.5 at the switch, and moves one way only (tested). Gains are rescheduled only when the share moves by 5%.
- **Reduced motion.** A 0.45 s fade out, a cut, and a 0.45 s fade in. No glide, no bubbles.

## Pass 022 polish

- **Surface where you are.** Surfacing exits through the front glass at the swimmer's own x, kept 3 aquarium units in from either end. You stand 1.05 m out from that point, facing the room, which is clear of furniture for every exit (tested). The rise to the glass is timed by distance: 0.9 s plus 0.05 s per aquarium unit, clamped to 1.1–2.2 s. `DivePath.switchTime` records when the view changes space.
- **Pause-screen switch.** A `'switch'` transition fades out where you are and back in at the other space's remembered pose and look. It is interruptible like the dive. The first entry from the start screen stays a cut, since the overlay already covers the view.
- **Contact shadows** (`environment/office/ContactShadows.ts`).
  - **Shape:** each footprint (desk, chair base, shelf, tank cabinet, plant pots) gets a rounded patch whose vertex alpha fades from the edge outwards over a fixed spread. Four bands do the same along the walls.
  - **Cost:** everything merges into one indexed geometry with one transparent, depth-test-only material, lifted 7 mm with a polygon offset. That is one extra draw call, no texture and no shadow maps.
  - **Containment:** patches against a wall stop at the wall.
- **First-visit hint.** After 4 s walking in the office, while not already at the tank, the prompt shows "Walk up to the tank and look into it to dive in". The first dive stores `cozy-diver.dived.v1`, and the hint never returns. Unavailable or corrupt storage just shows it again.
- **Frame-time readout** (`ui/frameMeter.ts`, Settings → Show frame time, off by default).
  - **Sampling:** real frame intervals go into a fixed 120-frame ring, with no per-frame allocation.
  - **Readout:** twice a second it shows the mean frame time, frame rate and 95th-percentile frame time. Pauses over 1 s are ignored.

## The glass office (v0.4 Pass 027)

The home office is remodelled as a small private office in a modern workplace, loosely based on the user's own. The details are generic: no logos, brand names or real screen content. The room table above describes v0.3; Pass 027 replaces the room itself, while the walking, dive, miniature tank and audio systems are unchanged.

- **The room** (3.6 × 4.2 m, 2.7 m ceiling; `config/office.ts`).
  - **Surfaces:** grey grasscloth side walls, a white back wall, black skirting, grey porcelain tiles and an acoustic tile ceiling with two LED panels.
  - **Glass front:** the front (+z) is a black-framed glass partition with a closed glass door. You cannot leave the room.
  - **Window:** a tall back window, frosted below and clear above, with rain and a brick building opposite.
  - **Furniture:** a dark L-desk with two monitors (dim, generic panels), a keyboard, papers and a small succulent; an executive chair; two blue guest chairs facing the desk; boxes in the corner; and the aquarium on its charcoal cabinet against the right wall, facing into the room.
  - **Small fixtures:** a clock, a light switch, a thermostat, an air-conditioning cassette and a camera dome.
- **The open-plan office** beyond the glass (`buildOpenPlan`), seen but never entered.
  - **Furnishings:** rows of white workstations with monitors and black task chairs, neighbouring glass offices, a filing cabinet with binders, a coat, a snake plant, LED rows and three framed posters (generic art).
  - **Cost:** it is merged per material into 11 meshes under its own group, and a point light lights it.
- **The office from inside the tank** (`rendering/TankOutlook.ts`).
  - **Capture:** once the office has warmed up, `OfficeScene.captureFromTank` renders it into a 128 px cube map with mipmaps. The capture is taken from the tank's centre, with the tank hidden and the cube aligned with the aquarium's axes.
  - **Display:** in the aquarium, a box just outside the glass samples that cube at a soft mip level (1.2), drawn towards the water colour and fogged like the rest of the tank. The office is blurred and watery, clearer through near glass than far glass.
  - **Where it shows:** only in the swimmer's view. The room's miniature of the tank hides it. Normal diving keeps the blue background at the scene switch, then smoothly reveals the capture during underwater settling. The reveal follows active transition time, freezes on pause, and resets on completion or cancellation. Surfacing draws the live reverse view of the office (Pass 021) at the front glass in front of it; reduced-motion entry retains its covered fade.
  - **Cost:** one draw call, one cube target (about 0.5 MB with mipmaps), and a single capture, not one per frame.
- **Draw budget:** the room keeps its 27-mesh budget (tested), and the open-plan office adds at most 11.

### Limits

- **A still picture.** The view from the tank is a still capture: the clock's hands and the rain in it do not move. That is not noticeable through the blur.
- **Distance.** The box sits at the glass, so the office has no parallax as you swim: it reads as far away rather than one to three metres off.
- **Lighting.** The open-plan office is lit by one point light and the hemisphere fill, with no shadows.
