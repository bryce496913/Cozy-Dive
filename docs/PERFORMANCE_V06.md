# Performance, loading and resources (Pass 059)

An optimisation pass, not a quality cut. The accepted look, the wildlife geometry standard and creature behaviour are unchanged by default.

## How it was measured

`validation/perf-profile.mjs` travels the tank → outer reef → kelp forest → sea cave → under the ice with real input. In each world, from a fixed open view, it records:

- 60 frames stepped at 1/30 s, timing the whole tick and the renderer's draw submission separately (simulation = tick − render);
- the meshes that contribute the most triangles in view;
- draw calls, triangles, GPU geometries and textures, and JS heap;
- a CPU profile of 45 back-to-back ticks (Chrome DevTools protocol);
- the longest single frame while crossing each passage (the "entry spike");
- each world's build time.

**All of this is Chromium on SwiftShader (software rendering) in a container.** Simulation times are real JavaScript cost on this machine. They compare well between worlds and before/after, but they are not laptop numbers. Render times include CPU rasterisation, so they say nothing about a GPU. **No real-GPU measurement was possible here; hardware performance remains unverified.**

## Findings, by priority

### 1. Frame spikes when preparing a world (fixed)

Crossing each passage held a single frame for half a second or more. The tracing showed two causes, both in the warm-up that prepares a world before you arrive (`rendering/warmUp.ts`):

- **Wasted programs.** The final warm-up draw went into a 1×1 render target. three.js builds different shader programs for a render target (linear output, no tone mapping) than for the screen. So every warm-up synchronously compiled a second, never-used copy of every program.
- **One-frame uploads.** Every texture and buffer was uploaded in one frame.

What changed:

- The warm-up draw now goes to a 1×1 corner of the screen, so it uses the real programs.
- Uploads and draws are **spread over frames**, each sized to an 8 ms budget from how long the last took.
- The warm-up stops at once if the world is no longer wanted. Before, a disposed world could have its buffers uploaded again.

| Longest frame crossing into… | Before | After (run 1) | After (run 2) |
| ---------------------------- | -----: | ------------: | ------------: |
| Outer reef                   | 723 ms |         37 ms |         60 ms |
| Kelp forest                  | 720 ms |        102 ms |        134 ms |
| Sea cave                     | 494 ms |         48 ms |         56 ms |
| Under the ice                |  55 ms |         56 ms |         58 ms |

Steady-state hovering in the outer reef (600 frames from three views, same script):

|        | Median frame | 95th percentile | Worst frame | Frames over 100 ms | Total stall time |
| ------ | -----------: | --------------: | ----------: | -----------------: | ---------------: |
| Before |      22.2 ms |         74.6 ms |     2834 ms |                 10 |            3.9 s |
| After  |      21.4 ms |         84.1 ms |     1098 ms |                 15 |            2.7 s |

These steady-state numbers are noisy. The remaining stalls are creatures that load on demand, for example the wall visitors, being drawn for the first time. See "Remaining".

### 2. Fish kept in memory after their world (fixed)

The giant sea bass and sheephead (kelp), icefish and notothen (ice), and toothfish (ice rare) were borrowed from the tank's shared asset cache, and never evicted when their world was released. The tank can never keep these species. They are now evicted on release, as the outer reef's big creatures already were. Fish the tank can host stay cached for reuse.

What stays on the GPU after every outer world is released, measured by `validation/acceptance.mjs` over two full journeys:

|                   | Geometries kept | Textures kept |
| ----------------- | --------------: | ------------: |
| Before (Pass 055) |             146 |            60 |
| After             |          **76** |        **28** |

That is about half. Both journeys measured exactly the same, so nothing accumulates, and all 65 acceptance checks pass.

### 3. A lighter graphics option (added; full detail stays the default)

- **Settings → Graphics detail: Full detail (default) or Lighter.**
- **Full detail** is exactly as before: up to 1.75× device pixels.
- **Lighter** draws at 1× device pixels. Filling pixels is the main cost on integrated laptop graphics. On a 2× display that is 800×600 instead of 1400×1050, **67% fewer pixels**, and every model, creature, effect and behaviour stays the same.
- Nothing lowers quality automatically.
- Verified in the browser: the drawing buffer changes at once, and the choice is remembered.

### 4. Where the time goes (measured, not changed)

| World         | Simulation per frame (median) | Draw calls | Triangles in view | Biggest triangle cost                                 |
| ------------- | ----------------------------: | ---------: | ----------------: | ----------------------------------------------------- |
| Tank          |                        2.4 ms |        163 |            0.97 M | Seagrass planes, anemone, leather corals              |
| Outer reef    |                       15.8 ms |        109 |            1.20 M | 263 authored reef fish (0.36 M), corals               |
| Kelp forest   |                        6.5 ms |         56 |            2.34 M | Kelp stalks (1.24 M), urchins (0.26 M), stars (0.2 M) |
| Sea cave      |                        3.4 ms |         51 |            0.90 M | Hanging formations, lobsters, stalagmites             |
| Under the ice |                        4.7 ms |         86 |            1.44 M | Krill (0.17 M), sea stars, scallops, sponges          |

- **The outer reef's simulation is the heaviest.** The CPU profile puts it in its 263 schooling fish: `safeFishPosition` (reef collision), `FishSchooling.calculate` (neighbours), `stepFish`, and three.js matrix updates.
- **The kelp forest draws the most triangles.** Most are the kelp stalks, all instanced, so draw calls stay low (56).
- **World build pieces** each run in their own frame, as Pass 046 arranged. The longest pieces are the cave's environment (272 ms), the ice and rock under the ice (272 ms), the kelp (167 ms) and the outer scene (103 ms).

### Remaining (recommended next, not done here)

- **On-demand creatures:** warm up their models as each one loads (the wall visitors, rare encounters). This removes the remaining steady-state stalls in the outer reef. An attempt to reveal every hidden object during the warm-up was **rejected**: in testing it drove the browser out of memory.
- **Kelp stalks:** a distance level, or per-instance culling of stalks behind the swimmer, could remove most of the 1.24 M triangles. This needs care to keep the sway and silhouette, so it was not attempted without a visual review.
- **Outer reef schooling:** a spatial grid for neighbour search, and a cheaper reef-collision test (`safeFishPosition`) for fish far from the swimmer. Behaviour must stay identical, and there are determinism tests to keep green.
- **Build pieces of about 270 ms** (cave environment, ice and rock): split them further, as Pass 046 did for others.
- **Real-GPU numbers:** run `perf-profile.mjs` with `COZY_HARDWARE=1` on a real laptop, or use the frame-time readout in Settings, before deciding on any of the above.

## Constraints kept

- No new gameplay, creatures or environments.
- No change to the accepted wildlife geometry; no behaviour disabled.
- No new dependencies.
- Full detail stays the default and is never lowered automatically.

## Validation

- **Unit tests:** 728 pass. New ones:
  - the gradual warm-up: every object drawn once across frames; drawn to the screen with the lights in view; layers, culling and camera restored; stops when no longer wanted;
  - graphics detail: default, validation, pixel-ratio caps;
  - typecheck, lint and build are clean.
- **`validation/acceptance.mjs`** (the Pass 055 full journey, twice, the second with reduced motion): **65 of 65**, no page errors. Memory is as in finding 2.
- **`validation/perf-profile.mjs`:** run before, and twice after. Draw calls and triangles are identical in every world, so nothing changed visually. GPU memory per world is unchanged while in it. Simulation medians vary by about ±25% between runs on this machine; this pass did not change simulation, so they are not reported as gains.
- **Graphics detail in the browser:** the drawing buffer goes from 1400×1050 to 800×600 on a 2× display, at once, and is remembered after a reload.
- **Rejected during the pass:** revealing every hidden object in the warm-up. It drove the browser to 12 GB and was reverted before commit. A separate out-of-memory was traced to a measuring script ticking without yielding to the browser; the app itself held steady at about 2.3–2.5 GB in the same run.
- **Not measured: any real GPU.** Hardware performance remains unverified. To measure it:

  ```
  COZY_HARDWARE=1 COZY_HEADFUL=1 node validation/perf-profile.mjs
  ```

  Run it on a laptop, or swim with Settings → Show frame time.
