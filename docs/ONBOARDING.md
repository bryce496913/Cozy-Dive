# Instant relaxation and frictionless onboarding (Pass 054)

Goal: from opening the page to calmly swimming, with as few decisions and as little reading as possible, and with every failure explained gently.

## First-visit audit (before this pass)

Walked through by `validation/onboarding.mjs` and by hand in the dev build (Chromium with SwiftShader, so the times are slower than a real GPU):

| Step                     | What the player met                                                                            | Friction                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Page opens               | The start screen at once, over the live tank                                                   | None. The scene streams in behind it.                                                                   |
| Choosing                 | "Enter the Office" (primary) and "Enter the Water" (an outlined secondary button)              | Two similar labels; nothing said what either leads to. Going straight to the water looked like an aside |
| In the office            | A hint after 4 s: "Walk up to the tank and look into it to dive in"                            | Fine; shown until the first dive                                                                        |
| In the water, first time | Nothing. The controls bar lists keys, but how to go up and down is the one non-obvious control | Players had to discover that depth follows where you look                                               |
| Returning                | The same "Your first dive" screen as the very first time, office first                         | Repeat visitors had to choose again, and were greeted as new                                            |
| Pointer lock refused     | "Mouse capture was not granted. Click Enter again, or allow pointer lock in your browser."     | Clear, though it named a button that no longer matched                                                  |
| No WebGL                 | "This aquarium needs WebGL…", both buttons disabled                                            | Clear                                                                                                   |

## What changed

- **Two clear choices on the start screen,** each with one line saying where it leads:
  - **Enter the Office:** walk around the room, then dive into the tank;
  - **Dive In:** go straight into the water (renamed from "Enter the Water", and now a described choice of its own rather than an aside).
- **Keyboard focus from the start.** The primary choice is focused when the page opens (before, nothing was), so Enter alone starts.
- **Returning visits are quicker.** The screen says "Welcome back", and the place you last went is the primary, focused button, so Enter (or one click) takes you straight back.
- **A one-time swim hint.** About a second and a half after first entering the water: "Look up or down and swim to change depth · Esc to pause". It goes after nine seconds, or sooner once you have swum for a couple of seconds, and never shows again.
- **Calm loading.** While the tank is still settling, the start screen says so quietly ("Settling the water…"); the buttons work throughout.
- **Gentler messages.** The pointer-lock message now names the actual buttons.

Everything is stored locally under `cozy-diver.onboarding.v1`, apart from preferences. If storage is absent, corrupt or blocked, every visit is simply treated as a first visit, and nothing breaks.

## Scripted checks

`validation/onboarding.mjs` runs each scenario in its own browser context:

| Scenario            | Checked                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| First visit         | "Your first dive"; both choices offered; Dive In enters the water; the swim hint appears, then swimming clears it; stored state |
| Returning visit     | "Welcome back"; the water is focused; Enter goes straight in; no swim hint                                                      |
| Storage unavailable | Loads and plays as a first visit, no errors                                                                                     |
| Pointer lock denied | A calm message; the start screen stays; the buttons still work                                                                  |
| WebGL unavailable   | A clear message; entry disabled                                                                                                 |
| Mute                | M mutes while swimming, and it is remembered after a reload                                                                     |
| Pause               | Releasing the mouse pauses, "Stay a little longer", focus on the way back                                                       |
| Reload              | Reloading mid-swim returns to a "Welcome back" screen without errors                                                            |

## Results

`validation/onboarding.mjs`, Chromium headless with SwiftShader against the Vite dev server: **all eight scenarios pass, with no page errors.**

| Scenario            | Measured                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First visit         | "Your first dive", focus on Enter the Office. Dive In → water. The hint is absent at 1 s and shown at 2 s; it is gone after 3 s of swimming. Stored `{visited: true, last: "aquarium", swimHint: true}` |
| Returning visit     | "Welcome back", focus on Dive In; Enter goes straight in; no hint in 4 s                                                                                                                                |
| Storage unavailable | `localStorage` throws on access: loads as a first visit, the hint shows, no errors                                                                                                                      |
| Pointer lock denied | "Mouse capture was not granted. Choose Enter the Office or Dive In again…"; the start screen stays and both buttons are enabled                                                                         |
| WebGL unavailable   | "This aquarium needs WebGL…"; both buttons disabled                                                                                                                                                     |
| Mute                | M while swimming mutes; still muted after a reload                                                                                                                                                      |
| Pause               | "Stay a little longer", focus on Return to the Water; Enter resumes in the water                                                                                                                        |
| Reload              | "Welcome back", no errors                                                                                                                                                                               |

### Timings

Wall-clock from navigation, the same machine and dev server, SwiftShader, so only the comparison means anything:

|                                    | Before           | After                                  |
| ---------------------------------- | ---------------- | -------------------------------------- |
| Start screen shown                 | 3.2–3.3 s        | 3.3–3.9 s (warm)                       |
| Tank and office prepared behind it | 8.2–8.5 s        | about 13–15 s under the harness's load |
| Keyboard-ready (a focused choice)  | never (no focus) | as soon as the screen shows            |

The first run after an edit (6.8 s) included Vite recompiling, and is left out. Loading itself is not changed by this pass: the scene was already prepared behind a usable start screen. The later "prepared" times in the harness come from five browser contexts running one after another on a busy machine. Loading speed belongs to Pass 059. No real-GPU or production-build timings were taken here.

### Screenshots

In `docs/screenshots/v0.6-pass054/`:

- `start-before.jpg`, `start-first.jpg`, `start-returning.jpg`: the start screen before, first visit, returning;
- `swim-hint.jpg`, `paused.jpg`, `lock-denied.jpg`, `webgl-failed.jpg`.

## Known limits

- **Pointer lock denial was simulated** by rejecting `requestPointerLock`. Each real browser words its own permission UI differently.
- **The hint's timings are simulated seconds** (frames stepped by hand), not wall-clock.
- **The human playtest below has not been run;** it needs a real first-time player.

## Human playtest script

For someone who has never seen Cozy Diver. Watch quietly and note where they hesitate; do not explain anything unless they are stuck for more than about 30 seconds.

1. Open the page in a fresh private window. Note how long until they choose, and which choice.
2. Ask them to "have a look around". Note whether they find how to go up and down without help.
3. After a few minutes, ask them to stop for a moment (they will need to press Esc or move the mouse out). Note whether pausing felt obvious.
4. Ask them to get back in. Note whether the way back was clear.
5. Ask them to close the tab and open the page again. Note whether the start screen felt familiar and quick.
6. Afterwards, ask: _Was there a moment you felt unsure what to do? Did anything feel like it was rushing you? How relaxed did you feel, from 1 to 5?_

Record: the time to the first choice, the time to the first swim, any hesitation over more than 10 seconds, and their answers.
