# Accessibility, motion comfort and relaxation (Pass 057)

Cozy Diver should be comfortable for anyone to settle into: no pressure, nothing sudden, and nothing that only works with a mouse, colour or perfect eyesight. This pass audits what was already there, and adds only what was missing. It adds no tutorials, and stays light on settings.

## Audit

| Area                          | Before this pass                                                                                                                                                     | Verdict                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Camera sway and breathing bob | Subtle by default; **Reduced camera motion** removes them (`player/swimming.ts`)                                                                                     | Kept                                 |
| Acceleration and deceleration | Three swimming feels: Relaxed, Natural, Responsive                                                                                                                   | Kept                                 |
| Turning                       | Sensitivity 0.25–2.5×; look smoothing, replaced by direct look with reduced motion                                                                                   | Kept, and **invert look** added      |
| Field of view                 | Fixed (office 66°, water 64°)                                                                                                                                        | **Added a setting** (below)          |
| Particles                     | Marine snow, which stays still with reduced motion                                                                                                                   | Kept                                 |
| Light shafts and flashes      | Slow light shafts that stay still with reduced motion. No flashes or strobing anywhere. The brightest moment is the dive's water-entry wash, a soft fade             | Kept                                 |
| Transition fades              | The dive and surfacing are shorter and calmer with reduced motion, with no bubble burst. Passages darken gently                                                      | Kept                                 |
| Plants                        | Sway, which stays still with reduced motion. Creature behaviour is unchanged, so the world still lives                                                               | Kept                                 |
| Audio                         | Fully optional (a checkbox, M, the mute button). Volume, crossfades and muting all ramp (Web Audio `setTargetAtTime`), so there are no sudden jumps                  | Kept                                 |
| Pause                         | Escape works at any moment, including mid-dive and mid-passage (tested in Passes 021 and 055). Hiding the tab pauses too                                             | Kept                                 |
| Keyboard                      | Every button is a real button with a focus ring. The **Settings and catalog panels let Tab wander behind them**, and Escape only worked while focus was still inside | **Fixed** (below)                    |
| Text                          | Some instructions at 10 px                                                                                                                                           | **Raised** (below)                   |
| Guidance                      | Controls are written out in words with key names, never colour or icons alone. Mute was not listed                                                                   | **M mute added** to the controls bar |
| Start screen                  | The corner label said "01 / First dive" on return visits                                                                                                             | **Fixed**                            |

## Changes

- **Field of view** (Settings): from −8° to +16° around each view's designed angle, shown as "Standard", "+6°" and so on.
  - A wider view helps many people who feel queasy in first-person games.
  - It is applied only when it changes, so it costs nothing per frame (`rendering/fieldOfView.ts`).
- **Invert up and down look** (Settings).
- **Focus stays in open panels** (Settings, Seen in the outer waters, For your tank). Tab and Shift+Tab cycle inside, and Escape closes, returning focus to the button that opened it (`ui/focus.ts`).
- **Readable instructions:**
  - the entry note is now 11.5 px;
  - the controls bar, the greeting and the "saved" note are now 11 px.
    The small uppercase brand labels stay decorative (9 px), and nothing needed is said only there.
- **Controls bar in the water:** now includes **M mute**.
- **Reduced camera motion:** its description now also says transitions are shorter and calmer.

Both new settings are stored with the rest. Missing or invalid values fall back safely to Standard and off.

## Checks

- **Unit tests** (720 in total pass):
  - field-of-view and invert-look validation, rounding and round-tripping (`settings.test.ts`);
  - the field of view applied without accumulating, and only rebuilding the projection when it changes (`field-of-view.test.ts`).
- **`validation/keyboard.mjs`:** Chromium + SwiftShader, keyboard only. It passes:
  - On load, Enter the Office has focus. Tab reaches the brand link, Mute audio, Settings, Enter the Office and Dive In, and **every focused control shows a focus ring**.
  - **Settings:** Enter opens it with focus on the first slider. Tab cycles through all of its controls and stays inside. Arrow keys set the field of view to +10° and Space turns on invert look; both are saved. Escape closes it and returns focus to Settings.
  - **In the water:** Enter on Dive In captures the mouse. The camera's field of view is 74° (64° + 10°), and with invert look on, moving the mouse up looks down. Escape pauses, with focus on Return to the Water.
  - **For your tank:** Enter opens it. Tab reaches its Add buttons, decorations and Close, and stays inside. Escape closes it.
  - **No page errors.**
- **Contrast** (WCAG ratio of text against its backdrop), at 7.6–10.8:1 for every interface text checked:

  | Text                           | Size    | Ratio     |
  | ------------------------------ | ------- | --------- |
  | Intro                          | 14 px   | 9.3       |
  | Entry note                     | 11.5 px | 7.6       |
  | Greeting                       | 11 px   | 9.6       |
  | Controls bar                   | 11 px   | 8.7       |
  | Buttons (primary and outlined) | 13 px   | 10.8      |
  | Mute and Settings              | 11 px   | 10.6–10.8 |
  | Brand labels (decorative)      | 8–9 px  | 8.8–9.6   |

  The text sits over the live 3D scene, so these are measured against the overlay's dark teal, and are **approximate**. Over the brightest part of the lit tank, the vignette and the scrim behind the start screen are what keep it readable; this needs a human check.

Screenshots: `docs/screenshots/v0.6-pass057/` (paused screen, catalog).

## Needs human validation

- **Motion comfort:**
  - Swim for 10 minutes with default settings, then with Reduced camera motion and a wider field of view. Any queasiness? Does either help?
  - Do the passages' darkening and the dive's wash feel calm rather than jarring?
- **Screen reader:** a VoiceOver pass over the start screen, Settings and the catalog. Buttons and sliders are labelled, and live regions announce status, but none of this has been listened to.
- **Contrast over the bright tank:** read every start-screen line on a real display, in a bright room.
- **Audio:** no sudden loud moments when entering, pausing, muting or crossing passages (the ramps are unit-tested, but need ears).
- **Keyboard-only play:** the world itself needs the mouse to look around (pointer lock). A keyboard-only way to turn is not offered. It would be a new control scheme, and belongs with Pass 058's touch controls if wanted.

## Limits

- No fullscreen button. The browser's own full-screen mode works, and adding one did not fit without a new control.
- Captions: there is no speech or story audio to caption. Sightings are shown as text notes already.
