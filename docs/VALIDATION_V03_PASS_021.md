# v0.3 Pass 021 — The Dive

Validation date: November 10, 2026. Candidate `0.3.0-alpha.2` for user review. No merge or release is authorized by this report. Browser evidence is from Linux Chromium with SwiftShader software rendering on localhost. MacBook Air frame time, audio comfort and the look under real GPU lighting are not measured here.

## 1. What was built

- **The prompt.** Walk within 1.6 m of the tank and look at it: **E · Dive in** appears. Near the water's surface (within 1.3 m of the top), **E · Return to the office** appears. Prompts only show while playing (pointer locked) and not during a transition.
- **The dive** (`player/dive.ts`, pure and tested). Press E and the camera glides in front of the tank (1.8 s), leans into the front glass (0.55 s) and, 10 cm from it, switches to the full-size aquarium from the identical mapped viewpoint. It then drifts to the usual swim start (1.9 s) while the haze thickens from the miniature's 0.009 to the underwater 0.026.
  - **Contact:** a soft teal wash peaks (32%) exactly at the crossing and fades on both sides; a burst of bubbles rises as you enter.
  - **Sound:** the office soundscape hands over to the underwater one at the switch.
- **Surfacing.** Press E near the surface: you rise towards the front glass, pass out through it, and stand up in the room 1.05 m from the tank, facing back into the office at 1.6 m eye height, clear of the furniture.
  - **Reverse portal:** while surfacing, the aquarium's front wall shows the office rendered from the swimmer's mapped position (`OfficeScene.renderOutside`). The switch happens 3 cm inside the glass, so the office you see through the glass is the office you step into. Its plane and render target exist only during surfacing and are released when it ends.
- **Reduced motion.** The glide becomes a 0.45 s fade out, a cut and a 0.45 s fade in; there are no bubbles and no reverse portal.
- **Unchanged.** The pause screen still switches spaces instantly. Pointer lock is still only requested by explicit action.

| Moment                              | Capture                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| The prompt in front of the tank     | ![](screenshots/v0.3-pass021/dive-0-prompt.jpg)         |
| Approaching the glass               | ![](screenshots/v0.3-pass021/dive-1-approach.jpg)       |
| Last office frame before the switch | ![](screenshots/v0.3-pass021/dive-switch-before.jpg)    |
| First aquarium frame after it       | ![](screenshots/v0.3-pass021/dive-switch-after.jpg)     |
| Splash                              | ![](screenshots/v0.3-pass021/dive-2-splash.jpg)         |
| Arrived at the swim start           | ![](screenshots/v0.3-pass021/dive-3-arrived.jpg)        |
| Last aquarium frame surfacing       | ![](screenshots/v0.3-pass021/surface-switch-before.jpg) |
| First office frame after it         | ![](screenshots/v0.3-pass021/surface-switch-after.jpg)  |
| Standing in the room                | ![](screenshots/v0.3-pass021/surface-3-standing.jpg)    |

## 2. Measurements (`validation/dive.mjs`, real input)

The harness clicks Enter the Office (real pointer lock), stands in front of the tank, waits for the prompt and presses E. It then steps the animation loop by hand at 60 Hz so the frames on each side of the switch are captured exactly.

| Measure                                                                                              | Result                                                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Dive prompt / surface prompt                                                                         | "E Dive in" / "E Return to the office"                    |
| Dive seam: mean / median per-channel difference (0–255) between the frames either side of the switch | **12.9 / 7**                                              |
| Surface seam, same measure                                                                           | **6.5 / 2** (43.9 before the reverse portal)              |
| Dive end                                                                                             | aquarium, at the swim start                               |
| Swimming after the dive (held W)                                                                     | moved 0.37 m                                              |
| Surface end                                                                                          | office, eye height 1.6 m                                  |
| Reduced-motion dive                                                                                  | 0.9 s fade, ends in the aquarium                          |
| GPU memory before the first dive / after dive, surface, reduced dive and return                      | 403 / 112 → 403 / 112 (geometries / textures)             |
| Console errors                                                                                       | none                                                      |
| JS bundle                                                                                            | 970.30 kB / 274.98 kB gzip (Pass 020: 959.65 / 271.76 kB) |

- **What remains at the dive seam.** The two frames show the same scene from the same pose, but the miniature is drawn at 0.6× resolution, with distance levels of detail, and through the glass shader; the full aquarium is drawn at full resolution with near levels. The contact wash, at its peak on both frames, covers most of the remaining difference. At 60 fps the switch reads as continuous movement.
- **First run of this harness** found that surfacing left one geometry and one texture allocated (403/112 → 404/113). Both are now released when the transition ends.

## 3. Checks

| Check                                                      | Result                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` / `build:benchmark` / `typecheck` / `lint` | Pass                                                                                                                                                                                                                          |
| `npm run test -- --maxWorkers=2`                           | **379 passed**. New: `dive` (6), covering the tank mapping, an identical viewpoint at both switches, contact-wash continuity, smooth steps clear of furniture, the reduced-motion fade, the standing end pose and the prompts |
| `validation/dive.mjs` (new)                                | Pass                                                                                                                                                                                                                          |
| Other browser harnesses, stress suite                      | Not run in this pass                                                                                                                                                                                                          |

## 4. Known limitations

- **SwiftShader only.** Seam numbers and frame stepping were measured in software rendering; the transition at real frame rates on a GPU still needs a look.
- **First surfacing hitch.** The reverse-portal shader is compiled the first time you surface, not during warm-up, so the first surfacing may stutter briefly on a slow machine.
- **Where you surface.** Surfacing always passes out through the middle of the front glass, wherever you were near the surface; the rise there takes 1.7 s.
- **No water surface crossing.** You leave through the front glass (the way you came in), not up through the water surface; the hood hides the surface from the room.
- **Pause screen.** Switching spaces from the pause screen is still an instant cut.
- **Hardware.** MacBook Air frame time and the sound handover are not measured.

## 5. Manual macOS checklist

- [ ] The prompt appears naturally when standing at the tank and looking at it, and not otherwise.
- [ ] The dive feels smooth and inviting, with no visible jump at the glass.
- [ ] The wash and bubbles feel gentle, not flashy.
- [ ] The office sound fading into the underwater sound feels right.
- [ ] Swimming works immediately after arriving.
- [ ] Surfacing from near the top brings you out through the glass with no visible jump, standing comfortably in the room.
- [ ] With reduced motion on, both directions are a short, calm fade.
- [ ] Frame rate stays comfortable through the whole transition, including the first surfacing.
