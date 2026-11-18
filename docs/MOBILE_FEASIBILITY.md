# Mobile and touch: feasibility (Pass 058, Phase A)

**Recommendation:** touch support is feasible for **tablets first**, then phones, but only once two things exist:

1. a touch control scheme that replaces pointer lock;
2. a mobile quality tier, from Pass 059.

This pass makes no attempt at Phase B (touch swimming). It records the blockers, measures what a mobile browser would load, makes the start screen usable and honest on touch screens, and leaves desktop untouched.

## How this was measured

`validation/mobile-probe.mjs` uses **Chromium's device emulation**: viewport, pixel ratio, touch, and a mobile user agent. It runs on SwiftShader against the dev server. This is **not a real device**. It shows layout, input APIs, downloads and memory. It cannot show mobile GPU speed, heat, iOS Safari's memory limits or its WebKit behaviour. **No real phone or tablet was available.**

| Emulated device       | Viewport (CSS px) | DPR   | Start screen shown | Layout                               | JS heap with the tank ready | GPU geometries / textures | Drawing buffer (capped at 1.75×) |
| --------------------- | ----------------- | ----- | ------------------ | ------------------------------------ | --------------------------- | ------------------------- | -------------------------------- |
| iPhone 13             | 390 × 664         | 3     | 3.7 s              | No overflow; both buttons 58 px tall | 181 MB                      | 432 / 113                 | 682 × 1162                       |
| Pixel 7               | 412 × 839         | 2.625 | 3.3 s              | No overflow                          | 165 MB                      | 429 / 113                 | 721 × 1468                       |
| iPad (7th gen)        | 810 × 1080        | 2     | 3.3 s              | No overflow                          | 161 MB                      | 432 / 113                 | 1417 × 1890                      |
| iPad Pro 11 landscape | 1194 × 834        | 2     | 3.4 s              | No overflow                          | 191 MB                      | 432 / 113                 | 2089 × 1459                      |

On every device, **25 MB** was transferred before the start screen, with the tank's models preloaded (dev server, uncompressed transfer). The production build's models are 32 MB on disk:

| Models folder | Size    |
| ------------- | ------- |
| `creatures`   | 13.4 MB |
| `fish`        | 10.7 MB |
| `reef`        | 6.0 MB  |
| `ornaments`   | 1.1 MB  |
| `coral`       | 0.8 MB  |

The JavaScript bundle is 1.4 MB, and the decoders 1.5 MB.

## Findings

### Blockers (must be solved before touch swimming)

1. **No pointer lock on phones.**
   - Looking around depends on the Pointer Lock API. iOS Safari on iPhone has none, and Android Chrome only offers it with a mouse.
   - The whole "engaged or paused" lifecycle is tied to pointer lock: losing the lock pauses and clears input.
   - Touch needs its own engaged state, and a `TouchControls` (in `controls/`) that produces the same `SwimInput` and yaw and pitch.
   - Desktop emulation still exposes the API, so the probe's taps "succeeded"; a real phone would not.
2. **Render budget.**
   - The heaviest views draw 1.0–2.4 M triangles (the kelp forest the most) with 40–190 draw calls (Pass 053 tour), at up to a 1.75× pixel ratio.
   - That is comfortable for laptop GPUs, but beyond what mid-range phones sustain at 30 fps without heat. Recent iPads are likely fine at a lower pixel ratio.
   - A mobile tier needs a lower pixel-ratio cap (about 1.0–1.25), fewer fish per school, nearer far-planes, and the existing LODs biased lower. This is Pass 059's job (its quality options), so that desktop quality is never lowered automatically.
3. **Memory.**
   - About 160–190 MB of JS heap, plus GPU memory that grows with each outer world, up to about 720 geometries and 390 textures under the ice (Pass 055).
   - iOS Safari reloads tabs, or loses the WebGL context, under memory pressure. The context-loss path now offers Reload (Pass 056), but the budgets need measuring on a real iPhone.

### Fixable without blocking

- **First download:** about 25 MB before the start screen, and more per world. That is acceptable on Wi-Fi but heavy on cellular. Options: defer the outer worlds' models until their passage is near (already the case for most), or offer a "lighter download" note on mobile.
- **Audio:** iOS unlocks Web Audio only inside a touch gesture. The existing unlock on Enter or tap and on Settings changes already runs inside the gesture.
- **App switching:** the page already pauses and mutes when hidden (visibility change) and caps the frame gap on return.

### Done in this pass (desktop unchanged)

- **A plain message on touch-only devices**, detected by input capability (no fine pointer), not by device name: "Cozy Diver needs a mouse or trackpad for now: touch controls are planned. On a tablet, connecting a mouse or trackpad works…". The page still loads, so the scene can be seen. Before, phones would have got the generic "cannot capture the mouse" message.
- **Phone layout:** the start screen begins below the header and scrolls, instead of centring up underneath it. The brand no longer wraps; the decorative edition and corner labels hide under 600 px.
- **Tap targets:** on touch screens the header buttons (Mute, Settings, the brand) are at least 44 px.
- **Safe areas:** `viewport-fit=cover`, with the bars padded by `env(safe-area-inset-*)`. On desktop these are 0.
- **Controls bar hidden on touch-only screens**, where W A S D and the mouse mean nothing.

Verified in emulation: desktop shows no message and keeps its sizes (Settings 35 px, header padding 32 px); the iPhone shows the touch message, with Settings at 47 px. Screenshots: `docs/screenshots/v0.6-pass058/`.

## Minimum targets proposed for Phase B

| Target       | Devices                                                                                               | Expectation                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **First**    | iPad (A14 or newer, iPadOS 17+, Safari); Android tablets with Snapdragon 8-series or similar (Chrome) | 30 fps in every world on the mobile tier; landscape and portrait                             |
| **Second**   | iPhone 13 or newer (iOS 17+); recent Pixel and Galaxy phones                                          | 30 fps on the mobile tier in the tank and outer reef; the kelp forest may need a lighter set |
| Not targeted | Older or low-memory phones (under 4 GB RAM)                                                           | The start screen explains; no promise of swimming                                            |

## Proposed touch design (for Phase B)

Kept deliberately simple, with no button combinations:

- **Look:** drag anywhere on the right two-thirds of the screen. Drag distance is a displacement, like the mouse, never scaled by frame time. Sensitivity and invert look apply.
- **Swim:** a soft thumb pad that appears wherever the left thumb lands. Pushing up swims forward along the view, as W does, so you look up or down to change depth. It eases out when released.
- **Actions:** the E prompts ("Dive in", "Return to the office") become tappable chips where the prompt already shows.
- **Pause:** a small pause button in the corner (there is no Escape key), which also shows when the app is switched away.
- **Menus:** Settings, Seen and For your tank are already ordinary buttons and panels. They need only the larger tap targets (done) and a touch placement mode for decorations (tap to place, two buttons to turn).
- **Onboarding:** the one-time swim hint becomes "Drag to look · thumb pad to swim".
- **Code shape:**
  - `controls/TouchControls.ts`, behind the same interface as `SwimControls`;
  - `Application` chooses by capability and stays orchestration only;
  - an "engaged" state replacing `locked` where touch is in use.

## Device and browser test matrix

| Device and browser                                          | Tested                      | Result                                                                            |
| ----------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Chromium emulation: iPhone 13, Pixel 7, iPad 7, iPad Pro 11 | Yes (emulated, SwiftShader) | Layout, message, downloads and memory as above                                    |
| iOS Safari (iPhone)                                         | **No**                      | Expected: the touch message (no pointer lock)                                     |
| iPadOS Safari with a trackpad or mouse                      | **No**                      | Expected to work as on desktop (iPadOS has pointer lock with a pointer); untested |
| iPadOS Safari, touch only                                   | **No**                      | Expected: the touch message                                                       |
| Android Chrome (phone or tablet)                            | **No**                      | Expected: the touch message                                                       |

## Outstanding limits

- No real device was used. Mobile GPU speed, heat and memory limits are unknown.
- WebKit (Safari) was not available here, so the iOS behaviour above is expected, not observed.
- Touch swimming itself is not built. It is Phase B, and needs approval after Pass 059's quality tier.
