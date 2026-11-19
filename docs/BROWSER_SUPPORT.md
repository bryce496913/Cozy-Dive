# Browser support (Pass 056)

Cozy Diver targets current desktop **Chrome, Safari (macOS), Firefox and Edge**. It needs WebGL 2 and the Pointer Lock API. Web Audio and local storage are optional: without them it runs silently, or remembers nothing between visits.

## What depends on the browser

| Feature            | How Cozy Diver uses it                                              | Known differences                                                                                                                                                                        | Handling                                                                                                                 |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **WebGL 2**        | three.js renders with it; required                                  | Safari has had it since 15; it can be off with hardware acceleration disabled                                                                                                            | Detected before anything is built. If missing: a clear message, entry disabled                                           |
| **Pointer lock**   | Look around with the mouse; asked for only on a click               | Chrome returns a promise; Safari and Firefox return nothing (both handled). Safari and Firefox show their own "press Esc" banner. Escape always releases the lock, which pauses the game | Missing API: an explanation on the start screen. Refused: a calm message, and you can try again                          |
| **Mouse movement** | `movementX/Y` as view displacement (never multiplied by frame time) | Firefox and Chrome scale movement differently on some high-DPI displays                                                                                                                  | The sensitivity slider (0.25–2.5×) covers it                                                                             |
| **Web Audio**      | Underwater and office soundscapes, built in code                    | Every browser keeps audio suspended until a click; Safari is strictest                                                                                                                   | Unlocked from the Enter click, M and Settings. Missing: a "silent" note. Blocked: "enter again or toggle audio to retry" |
| **Local storage**  | Preferences, the tank, the journal, visits, onboarding              | Safari private windows, and blocked site data, can throw on access                                                                                                                       | Every read and write is guarded. Settings says "Preferences apply for this visit"                                        |
| **KTX2 textures**  | Basis-compressed textures, transcoded on load (local WASM)          | The GPU decides the target: ASTC on Apple silicon, BC (S3TC and BPTC) on most PCs and Intel Macs, ETC elsewhere                                                                          | `KTX2Loader` picks per GPU; uncompressed fallback                                                                        |
| **Context loss**   | —                                                                   | Any browser can drop the GPU context (driver reset, sleep, too many tabs)                                                                                                                | A calm message with a **Reload** button                                                                                  |
| **Tab hidden**     | —                                                                   | Browsers throttle hidden tabs                                                                                                                                                            | The game lets go of the mouse, pauses, mutes, and caps the frame gap on return                                           |
| **CSS**            | `backdrop-filter`, `svh`/`dvh`, `inset`, `:focus-visible`           | Safari before 18 needs `-webkit-backdrop-filter`; small-viewport units arrived in 2022                                                                                                   | Prefixed, with `vh` fallbacks                                                                                            |

## Changes in this pass

- **Capability detection** (`src/rendering/capabilities.ts`): before building anything, the page tries WebGL 2, pointer lock, Web Audio and storage. It never checks the browser's name.
  - No WebGL 2: a clear message naming it, with entry disabled. Before, a failure from inside the renderer was caught and given a vaguer message.
  - No pointer lock: an explanation on the start screen.
- **Lost graphics context:** the message now comes with a focused **Reload** button.
- **Safari CSS:** `-webkit-backdrop-filter` for Safari before 18, and `vh` fallbacks for `svh` and `dvh`.

## Support matrix

| Browser                     | Engine and version                              | OS, renderer                                     | How tested                                              | Result                                       |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| Chromium (Playwright build) | Chromium 153.0.8010.12, headless                | Linux container; ANGLE on SwiftShader (software) | `validation/compat.mjs`, plus every earlier harness     | **Pass:** all 6 scenarios, no page errors    |
| Google Chrome for Testing   | Chrome 153.0.8010.12 (`/usr/bin/google-chrome`) | Linux container; ANGLE on SwiftShader (software) | `validation/compat.mjs`                                 | **Pass:** all 6 scenarios, no page errors    |
| Safari (macOS)              | WebKit                                          | —                                                | **Not run: no WebKit runtime here**                     | Manual steps below                           |
| Firefox                     | Gecko                                           | —                                                | **Not run: Playwright's Firefox is not installed here** | Manual steps below                           |
| Edge                        | Chromium                                        | —                                                | **Not run** (same engine as Chrome)                     | Expected to match Chrome; manual steps below |

Both builds that ran are the same engine (Chromium 153), on software rendering. They show that the app's own logic handles each situation; they say nothing about Safari, Firefox or real GPUs. The SwiftShader GPU offered ASTC, ETC, S3TC and BPTC, so the KTX2 path ran with all of them available.

### Scenarios (`validation/compat.mjs`, per engine)

| Scenario        | What is checked                                                                                                                                                         | Chromium | Chrome |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| Core            | Start screen; Dive In (pointer lock); swimming with W moves the swimmer; Escape pauses, and resume works; resizing (the canvas follows); hiding the tab pauses the game | Pass     | Pass   |
| Context loss    | `WEBGL_lose_context`: "The graphics connection was interrupted…" with a Reload button; Reload brings back a working start screen                                        | Pass     | Pass   |
| No WebGL 2      | The message names WebGL 2; entry disabled                                                                                                                               | Pass     | Pass   |
| No Web Audio    | Loads and swims; Settings says audio is unavailable                                                                                                                     | Pass     | Pass   |
| No pointer lock | The start screen explains that the browser cannot capture the mouse                                                                                                     | Pass     | Pass   |
| Storage blocked | `localStorage` throws: loads, enters and swims                                                                                                                          | Pass     | Pass   |

Start screens appeared at 3.2 s (Chromium) and 6.9 s (Chrome's first, cold run) against the dev server.

Not covered by automation: real fullscreen (Cozy Diver does not use the Fullscreen API), real background-tab throttling (simulated by forcing `document.hidden`), and sound output (headless).

## Manual test steps (Safari, Firefox, Edge)

On each browser, record the browser version, OS version, Mac or PC model and GPU, then:

1. **Start.** Open the page. The start screen appears; the frosted panels (Settings) are blurred behind.
2. **Capture.** Click Dive In. The browser shows its "press Esc" notice, and the mouse turns the view smoothly. Note whether the turning speed feels like Chrome's; if not, does the sensitivity slider fix it?
3. **Swim.** Use W A S D. Look up or down and swim to change depth.
4. **Audio.** You hear the water within a second or two of entering. Press M: it mutes, and M again restores it. If there is no sound, open Settings and read the audio line.
5. **Pause.** Press Esc: "Stay a little longer". Click Return to the Water: you are back where you were.
6. **Background tab.** Switch to another tab for 30 seconds and come back. The game is paused and was silent while away; resuming does not jump.
7. **Resize.** Resize the window and toggle the browser's own full screen (Ctrl+Cmd+F in Safari, F11 elsewhere). The view fills the window without stretching.
8. **Travel.** Swim through the crack to the outer reef, then on to the kelp forest. Check for missing or black textures, flickering transparency (glass, water, light shafts), and animals moving.
9. **Storage.** Change a setting and reload: it is kept. In a private window, the page still works, and Settings may say preferences apply for this visit.
10. **Graphics loss** (optional). Leave the tab for a long time, or put the Mac to sleep with it open. If the graphics connection is lost, the page says so and offers Reload.

Report anything that differs from Chrome, with a screenshot.

## Known limits

- **Not run here:** Safari, Firefox and Edge, because no runtime for them exists in this environment. Support for them is unproven until the manual steps are run.
- **Software rendering only:** all results so far came from SwiftShader. Real GPUs can differ in precision, transparency sorting and texture formats.
- **Touch:** not supported on mobile or tablets (Pass 058).
