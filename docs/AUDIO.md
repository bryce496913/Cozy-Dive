# Ambient audio — v0.2 Pass 005B mood refinement

Audio is optional and conveys no gameplay information. The preview stays silent. Enter starts a quiet procedural soundscape after a user gesture; Escape fades it out. Settings contains **Ambient audio** and **Master volume**, initially enabled at **30%**. The top-bar button toggles audio in one click; **M** does the same while swimming. Muting retains the chosen volume. Reduced motion remains independent of audio.

## Ownership and integration

`Application` owns one `AudioSystem`, supplies copies of nine reef-coral/ornament positions once, and passes read-only swimming state, tuning, and camera yaw from its existing frame loop. The subsystem writes no physics, fish, scenery or camera state and owns no animation loop. `AudioSystem` constructs the context lazily. `AudioGraph` owns nodes, sources and three generated mono buffers; `AudioEvents` is a pure seeded active-time countdown. `AudioTuning` contains bounded mix, swimming and relative-position calculations; `WaterTexture` bakes the liquid source material. There are no dependencies, downloads, recordings, worklets or recording permissions.

The three continuous sources share two 16 kHz buffers (11.3 and 17.9 seconds). A third 2.8-second buffer supplies sparse bubble details, for **2,048,000 bytes total**. Source textures combine a very quiet, DC-rejected colored bed with irregular short damped cavity resonances, a weak inharmonic partial and noise excitation. Their 18–44 ms decay constants and 8 ms attacks avoid sustained tones and sharp pops. Ambient resonances wrap across the loop seam; the colored bed warms its filter state from the end of the same circular source. Dedicated detail clusters have wider gaps and play once behind the existing broad event envelope. Buffers are peak-scaled once, without clipping or dynamic compression.

The original broad white-noise buffers sounded like wind in user testing. This revision changes the source material as well as its filtering: less continuous hiss, more brief liquid body, smaller current gain and stereo motion, reduced swimming gain, and a shared 700 Hz low-pass on the final output. Different playback rates and slow small parameter changes reduce repetition; the source material is still finite.

| Layer                | Signal and limits before master gain                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation           | Liquid body; 65 Hz high-pass, 315–365 Hz low-pass, gain .225–.255.                                                                                                                                                                         |
| Current              | Slower liquid texture; 85 Hz high-pass, 240–280 Hz low-pass, gain .012–.024, stereo pan within ±.04.                                                                                                                                       |
| Swimming             | Shared liquid texture; 95 Hz high-pass, 420 Hz low-pass, gain capped at .14. Reads existing physical stroke, thrust and 3D velocity.                                                                                                       |
| Environmental detail | Dedicated soft bubble cluster or distant liquid movement; one temporary source into the existing filter/envelope/distance/pan chain. Low-pass 520→440 Hz for bubbles or 340→290 Hz for water, gain capped at .10. No sustained oscillator. |

Slow ambient modulation uses several independent periods of roughly 134–370 seconds with small amplitudes. There are no sustained oscillator voices, broad stereo sweeps, breathing sounds, music or fish emitters. Mono summation remains useful. Master gain is `.8 × volume^1.35`, giving substantial mix headroom and a gentler low end of the slider.

Swimming intensity uses actual speed rather than key presses alone, so pushing against scenery does not imply fast motion. The existing physical stroke envelope changes its texture, with a bounded contribution from filtered thrust. Coasting drops to at most 12% of the swimming ceiling and diminishes with speed. Resting breathing velocity is excluded. Pitch-directed forward/back swimming uses the same three-axis calculation. No extra stroke clock or Space/Shift action is introduced.

## Scheduling and position

The first detail waits 22–42 active seconds; later details are 28–65 seconds apart. Duration is 1.6–2.8 seconds. One voice is the hard limit, including sounds whose native `ended` callback is delayed. Consecutive events choose different ornaments. No events are queued in advance. Paused, muted, zero-volume and hidden time advance neither the variation clock nor the scheduler; each resume guarantees at least 12 active seconds before a detail. Frame deltas are capped at .1 seconds, so a stalled frame cannot catch up missed events.

Ambient layers are non-positional. Sparse details use the listener position and camera's horizontal right vector to compute modest stereo pan (±.4), smoothed over .25 seconds. This deliberately simple stereo model does not use `AudioListener` or HRTF nodes; pitch needs no update because there is no elevation cue. A smooth distance gain rolls off beyond two world units and reaches zero at 30. Positions use the aquarium's existing coordinates. There are no per-fish emitters or obstruction/reverberation simulation.

## Activation, pause and failure policy

- Initial load and settings changes before first entry create no context.
- Enter calls `resume()` synchronously inside the click handler, before requesting pointer lock. Sources start behind a zero master gain. Only confirmed gameplay with a visible tab and enabled, nonzero preferences opens that gain gate.
- Fade-in uses a .3-second exponential time constant. Volume changes use the same smooth target automation. Mute and Escape target zero with a .06-second time constant; a single cancellable 420 ms timer then suspends the context and releases any event source. New entry cancels the timer. Rapid suspend/resume races reconcile against the latest requested state.
- Hidden tabs suspend immediately and freeze scheduling. Visibility return opens audio only if gameplay remains active; ordinary focus loss exits pointer lock, so normal return requires the Return button. Cached page hides suspend; disposal/hot reload closes the context.
- Rejected or still-pending resume reports a quiet settings status. Pending requests have a 1.5-second status watchdog. A fresh user gesture can retry without creating another context; there is no per-frame retry. Missing APIs or graph initialization failure leave exploration playable in silence.
- `dispose()` is idempotent: cancel timers, stop sources, disconnect owned nodes and close the context. Native `ended` callbacks release temporary voices; all event automation is cleared before reuse.

The continuous graph has **19 nodes**, including three looping buffer sources, plus **at most one** temporary source. Three buffers are generated only at first enabled entry and reused thereafter. Web Audio runs filters/envelopes; the existing application loop submits control targets at at most 20 Hz. Pure scheduling runs once per active frame. Muted/paused contexts stop processing after their fade; hidden contexts stop immediately. No audio assets add to network traffic.

## Settings compatibility

The key stays `cozy-diver.settings.v1`. New fields are `audioEnabled: boolean` and `masterVolume: number` in [0, 1]. Missing or invalid audio fields receive true/.3 while valid previous swimming preferences survive. Finite volumes clamp to the range; non-finite or wrong-type values fall back. Existing malformed/unavailable-storage handling remains intact.

Functional validation, numerical output measurements, known limits and the pending human listening checklist are recorded in [Pass 005B validation and before/after previews](VALIDATION_V02_PASS_005B.md). Browser graphs and peak levels cannot establish perceived naturalness or long-session comfort.
