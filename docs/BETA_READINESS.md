# Public beta readiness (Pass 060, toward v0.8)

**Status: release-candidate documentation and fixes, not a release.** Nothing has been deployed, tagged or merged. The beta needs the owner's approval of the open decisions below and a real-device playthrough.

## 1. Where things stand

| Area                      | Source                                                                  | State                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.6 full world           | [ACCEPTANCE_V06.md](ACCEPTANCE_V06.md)                                  | Acceptance-ready; **not formally accepted** (waiting on the Mac Chrome and Safari playthrough). No critical or major defects                                         |
| Onboarding                | [ONBOARDING.md](ONBOARDING.md)                                          | Two described choices, "Welcome back", a one-time swim hint; 8 browser scenarios pass. The human first-time playtest has not been run                                |
| Browsers                  | [BROWSER_SUPPORT.md](BROWSER_SUPPORT.md)                                | Chromium and Chrome 153 tested (software rendering). **Safari, Firefox and Edge not tested here**; manual steps written                                              |
| Accessibility and comfort | [ACCESSIBILITY.md](ACCESSIBILITY.md)                                    | Keyboard walkthrough passes; contrast 7.6–10.8:1; field of view, invert look, reduced motion. VoiceOver and motion-comfort reviews need a person                     |
| Mobile                    | [MOBILE_FEASIBILITY.md](MOBILE_FEASIBILITY.md)                          | **Not supported** for swimming. Touch-only devices get a clear message. Tablets with a mouse or trackpad expected to work, untested                                  |
| Performance               | [PERFORMANCE_V06.md](PERFORMANCE_V06.md)                                | Passage stalls reduced (720 → about 60–130 ms in software); Lighter graphics option. **No real-GPU numbers yet**                                                     |
| Saves                     | `tests/save-compatibility.test.ts`, `validation/beta-smoke.mjs`         | v0.5 and v0.6 profiles load intact; a real update (beta.1 → beta.2) keeps everything                                                                                 |
| Licensing                 | `public/assets/LICENSE.txt`, `manifest.json`, `third-party-notices.txt` | All 46 models original, CC0-1.0. three.js (MIT), Draco and Basis (Apache-2.0) notices ship with the build. **The code itself has no licence yet** (owner's decision) |

## 2. Changes in this pass

- **Updates never serve stale models.** Model requests carry the build's version (`?v=`), so long-lived caches are safe. The version comes from `package.json`, or from `COZY_VERSION` for staging builds.
- **Calm recovery from a crash.** If anything throws inside the frame loop, the page releases the mouse, goes quiet, and says: "Something went wrong and the water stopped. Your tank, sightings and settings are saved. Reload to dive back in." It offers a Reload button. Before, the picture froze with the mouse still captured.
- **Beta feedback, optional and private.** Settings → Beta feedback:
  - a short thank-you;
  - a box showing only the version, browser, graphics and window size, filled when opened;
  - a Copy button, and a link to the feedback form.
    Nothing is sent automatically, and nothing saved (tank, sightings) is included. The form address is set at build time (`VITE_FEEDBACK_URL`). An optional GitHub issue form is included (`.github/ISSUE_TEMPLATE/beta-feedback.yml`).
- **Build line.** Settings shows "Cozy Diver <version> · beta · Notices", so testers can say what they tested. Notices links to the shipped third-party licences.
- **Save compatibility** tested as whole profiles across versions, plus a real-browser update test.
- **Deployment guide** ([DEPLOYMENT.md](DEPLOYMENT.md)): build, cache headers, sub-path hosting, staged deployment and rollback.

## 3. Release-blocker checklist

A release candidate ships only if every line holds. Any failure seen in the beta means **rollback** ([DEPLOYMENT.md § Rollback](DEPLOYMENT.md#rollback)).

| Area                 | Blocker if…                                                                                                                               | How it is checked                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Crashes              | Any page error during the full journey; the page freezes without the recovery message                                                     | `acceptance.mjs` (no page errors); unit tests; the manual checklist                           |
| Rendering            | Black or missing world, missing models, wrong textures, flicker that does not settle                                                      | `production.mjs`, `beta-smoke.mjs`, `visual-tour.mjs`; Mac playthrough                        |
| Controls             | Cannot capture the mouse, swim, look, pause (Esc) or resume; keys stuck after pause; Settings unusable by keyboard                        | `onboarding.mjs`, `keyboard.mjs`, `compat.mjs`                                                |
| Passages             | Any world unreachable; any return path broken; stuck in a passage; passing through walls, glass or ice                                    | `acceptance.mjs` (every passage both ways, backtracking, paused passage)                      |
| Saves                | Preferences, tank, sightings or onboarding lost or reset by an update, a reload or one damaged key                                        | `save-compatibility.test.ts`, `beta-smoke.mjs` (before/after an update)                       |
| Performance          | On a 2020-or-newer laptop: frame time persistently over 33 ms (under 30 fps) in any world on Lighter, or a freeze over 1 s while swimming | **Real hardware only**: Settings → Show frame time; `perf-profile.mjs` with `COZY_HARDWARE=1` |
| Memory               | GPU or tab memory that keeps growing across repeated journeys                                                                             | `acceptance.mjs` (retention budget, no growth); Chrome Task Manager over 30 min               |
| Third-party requests | Any request to another origin at runtime                                                                                                  | `beta-smoke.mjs` (`foreign` must be empty)                                                    |
| Calm                 | Anything that rushes or nags (pop-ups, timers, prompts that will not go away), sudden loud sound, flashing                                | Manual playthrough; [ACCESSIBILITY.md](ACCESSIBILITY.md)                                      |

## 4. Release-candidate results (this pass)

All runs: Chromium 153 on SwiftShader (software rendering), in a Linux container.

| Check                                                 | Result                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`, `typecheck`, `test`, `build`          | Clean; **734 unit tests pass**, including the new save-compatibility and release tests                                                                                                                                                                            |
| Production build                                      | `dist/` 36 MB. A first visit downloads about 16 MB (office and tank); all five worlds come to about 34 MB                                                                                                                                                         |
| `validation/production.mjs` (production build)        | Pass: built assets load, the preview doesn't capture the mouse, Enter and pointer lock, swimming changes depth, Escape pauses, volume persists. No errors or warnings                                                                                             |
| `validation/beta-smoke.mjs`, before → after an update | Pass, both phases. Build `0.8.0-beta.1`: dive in, set preferences. Rebuilt as `0.8.0-beta.2`, same browser profile: preferences and onboarding kept, "Welcome back", every model re-requested with `?v=0.8.0-beta.2`. **No third-party requests** in either phase |
| `validation/acceptance.mjs` (full world, twice)       | **65 of 65**, no page errors. Every passage both ways, backtracking, a paused passage, reduced motion, the tank, preferences and journal after a reload. GPU memory after release 480 geometries / 153 textures, identical both journeys                          |
| `validation/onboarding.mjs`                           | 8 of 8 scenarios                                                                                                                                                                                                                                                  |
| `validation/compat.mjs`                               | 6 of 6 scenarios on Chromium and on Google Chrome (Firefox and WebKit not available here)                                                                                                                                                                         |
| `validation/keyboard.mjs`                             | Pass: focus rings, panels keep focus, Settings fully reachable, including the new Beta feedback                                                                                                                                                                   |
| Crash recovery (fault injected in the frame loop)     | The calm message shows ("The water has stopped… all is saved"), the mouse is released, Reload is focused, the journal is intact, no stray page errors. Screenshot: `docs/screenshots/v0.8-pass060/crash-recovery.jpg`                                             |
| Licences                                              | All 46 models listed in the manifest as original CC0-1.0, none unlisted. Third-party notices ship in the build                                                                                                                                                    |

The production and update smoke tests and the acceptance run used this pass's code just before the last fix, which tidies the error screen and lays out short windows. The onboarding, compatibility, keyboard and crash checks ran after it.

**Not done here, and needed before a public beta:** real hardware (Mac Chrome and Safari, frame time, memory over 30 minutes); Firefox and Edge; a first-time player's playtest; a VoiceOver pass. **No release-blocking bug is known**, but performance on real GPUs is unverified, and that is the main risk.

## 5. Needs owner approval before any beta

1. **Formal v0.6 acceptance:** the Mac Chrome and Safari playthrough in [ACCEPTANCE_V06.md](ACCEPTANCE_V06.md) §4. Real-GPU frame time is the main unknown.
2. **The beta version number.** The build is `0.6.0-rc.22`. The roadmap's v0.7 (polish) has not been run as its own milestone. Choose whether this beta is `0.8.0-beta.1` (set with `COZY_VERSION` or in `package.json`) or waits for v0.7.
3. **The feedback route.** The default link is the GitHub issue form, which needs a GitHub account, and the repository must be public for testers to reach it. For a public beta, provide an account-free form URL (`VITE_FEEDBACK_URL`), or approve the GitHub route.
4. **A code licence.** The repository has no `LICENSE` for the source code. All art is CC0, and third-party notices are covered. Choose one (or "all rights reserved") before the code is public.
5. **The host and URL:** which static host, the domain or sub-path, and who can deploy and roll back.
6. **Mobile:** confirm the beta is desktop-only (recommended), with touch-only devices shown the explanation.
7. **Merging:** #92 (Pass 059), then this PR.
