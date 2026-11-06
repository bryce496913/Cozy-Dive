# v0.2 Pass 005B — softer underwater mood

November 6, 2026. Based on merged `main` at `cc5d4cf` (Pass 005). The user reported that the first soundscape felt like wind. This pass changes the source material and mix toward softer, muffled liquid texture; audio lifecycle, controls, preferences, scheduling and all gameplay remain unchanged.

## What changed

- Replace broad white-noise loops with baked colored water and irregular, short damped cavity resonances. Small inharmonic/noise components soften their tone; there are no sustained oscillator nodes. Wrapped ambient tails and warmed circular filter state protect loop seams.
- Reduce foundation cutoff from 570–710 to 315–365 Hz; current cutoff from 375–485 to 240–280 Hz. Add a shared 700 Hz low-pass to keep the whole mix enclosed and reduce airy upper frequencies.
- Lower current gain to .012–.024 (previously .025–.065) and pan to ±.04 (previously ±.12). Swimming ceiling falls from .20 to .14. Default master percentage and saved preferences remain unchanged.
- Give rare bubble events their own reusable 2.8-second liquid-cluster buffer, rather than filtering another slice of broadband noise. Keep broad soft envelopes, gentle distance attenuation, one environmental voice, and 28–65 second event intervals.

See [audio architecture](AUDIO.md) for exact parameters and ownership. No recordings, third-party audio or runtime dependencies were added.

## Before/after previews

[Previous ambient mix](audio/v0.2-pass005b/before.ogg) · [Revised ambient mix](audio/v0.2-pass005b/after.ogg)

These are 24-second mono reference renders at the same **30% master setting**, with no volume normalization. They include the actual filters, gain automation and repeating source seams. The after clip is deliberately quieter. Generated PCM was encoded as 32 kb/s Ogg Opus using a local tool for compact documentation; these previews are not loaded by the application. The sounds are entirely generated from repository code, with no third-party source recording. This comparison is for listening feedback, not proof of subjective quality.

## Functional and automated validation

Chromium functional checks passed with the revised graph: silent preview, gesture-started context, real pointer lock and forward swimming, M mute/unmute, sparse source release, persisted settings, four pause/resume cycles, context closure, and playable swimming with AudioContext disabled. No page or console errors occurred. The visibility handler was exercised with controlled hidden state; headless software rendering is not a macOS tab-switch or hardware performance test.

- `npm run test -- --maxWorkers=2`: **217 tests / 19 files passed** (34.38 seconds).
- `npm run build`: passed, 45 modules; existing Vite chunk-size advisory retained.
- `npm run typecheck`: passed.
- `npm run format` and `npm run lint`: passed.

Existing lifecycle coverage checks gesture-only activation, mute/pause fades, pending/rejected resume, hidden tabs, resource ownership and nonfatal audio failure. Texture checks now exercise both looping and dedicated-detail generation, reproducibility, finite/bounded samples and near-zero mean. Long-session parameter bounds reflect the new mix. No gameplay assertion or timeout was relaxed.

## Real Web Audio comparison

Chromium OfflineAudioContext rendered the old and new graphs for 24 seconds at 16 kHz/stereo. RMS excludes the initial two seconds. Movement scenarios deliberately hold swimming gain at each version's maximum; full-overlap includes one full-strength bubble event at the listener. Every sample was finite.

| Scenario                       | Previous RMS dBFS | Revised RMS dBFS | Previous peak | Revised peak |
| ------------------------------ | ----------------: | ---------------: | ------------: | -----------: |
| 30% ambience                   |            -41.72 |           -47.63 |         .0351 |        .0282 |
| 30% maximum movement           |            -39.68 |           -46.49 |         .0432 |        .0370 |
| 100% maximum movement + detail |            -25.56 |           -32.36 |         .2194 |        .1878 |

Windowed FFT measurements (1024 samples, Hann window) show **26.74 dB less 700–3000 Hz energy** in the revised ambience. The upper-to-body energy ratio (700–3000 versus 80–450 Hz) changes from -2.13 to **-26.36 dB**. Body-band energy drops only about 2.5 dB, while total ambience falls 5.91 dB. This checks that the change removes upper hiss rather than merely lowering every frequency equally. All revised scenarios retain substantial digital headroom.

The graph grows from 18 to **19 persistent nodes**, with the same three continuous sources and at most one temporary environmental source. Three buffers total **2,048,000 bytes (~1.95 MiB)**, up 179,200 bytes for the dedicated detail. No extra update loop or high-rate synthesis is added: all texture generation happens at initial context construction, existing control submission stays capped at 20 Hz, and mute/pause/hidden processing behavior is preserved.

Production JavaScript is **674.67 kB / 177.82 kB gzip**, up .55 / .23 kB from Pass 005. The optional documentation previews total about 134 KiB and are excluded from the runtime build. These numerical and functional checks cannot establish perceived realism or listening comfort.

## Listening acceptance

Human listening and macOS hardware checks remain pending. Use the original [macOS checklist](VALIDATION_V02_PASS_005.md#known-limits-and-manual-acceptance), plus:

- [ ] The new foundation feels soft and enclosed rather than windy or airy.
- [ ] The short liquid resonances blend into the background without sounding like beeps, a pump or a continuous bubble machine.
- [ ] Swimming feels like muffled water displacement and remains comfortable when holding W.
- [ ] Occasional bubble details are gentle, sparse and distinct from the surrounding texture.
- [ ] The default 30% mix is audible but unobtrusive on MacBook speakers and headphones; mono remains comfortable.
- [ ] No loop seam, abrupt mute/resume click or irritating repetition appears during a 15–30 minute listen.

The finite textures can still repeat; no claim is made about Safari/Firefox, physical speaker levels or long-session comfort from graph tests alone. PR remains unmerged for user testing.
