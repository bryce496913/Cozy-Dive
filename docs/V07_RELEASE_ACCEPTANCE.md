# V0.7 Release Acceptance (Pass 094)

Base: main after Pass 093. This pass adds no features and changes no art. It reviews Passes 061 to
093, runs focused automated checks, measures rendering and assets, confirms the approved fog, and
prepares the MacBook Air acceptance run.

**V0.7 is not accepted by this pass.** Automated checks cannot accept it. Nothing has been deployed,
released or tagged; `package.json` still reads `0.6.0-rc.25`.

## 1. Status

| Stage                      | Status                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| Implemented                | **Yes**: Passes 061–093 are merged on main                       |
| Automatically tested       | **Yes**: all checks below pass, on SwiftShader (no real GPU)     |
| Awaiting manual acceptance | **Yes**: the MacBook Air checklist (section 7) has not been run  |
| Accepted                   | **No**: needs the user's playthrough and sign-off                |
| Released                   | **No**: no deploy, release, tag or version bump without approval |

## 2. Review of Passes 061–093

| Area                           | Passes                  | Completed                                                                                                                                                                                                                         | Remaining                                                                                                                                                   |
| ------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual foundation              | 061, 063, 074, 080, 087 | Reproducible baseline harnesses and views; art production spec; shared surfaces and palettes; per-world materials and lighting brought to one standard                                                                            | —                                                                                                                                                           |
| Aquarium benchmark             | 062, 082                | Reference-driven reef section (sculpted ridge, hero coral, sponges, vegetation clusters), the standard the rest is judged by                                                                                                      | —                                                                                                                                                           |
| Habitat composition            | 083, 077, 071           | The whole tank rebuilt as sculpted habitat sections; grown branching thickets; curved, clustered vegetation with travelling-wave sway                                                                                             | A few smooth Pass 061 boulders along the back-right glass                                                                                                   |
| Fish anatomy                   | 065, 066, 090           | All 18 species with their own profiles, heads, mouths and pectorals; natural skin and fin materials in place of the fabric-like scale map                                                                                         | —                                                                                                                                                           |
| Large animals                  | 067, 068, 078, 084, 092 | Species sculpts for sharks, rays, turtle, whales, seals; new minke and sea-otter sculpts; polar-bear anatomy; smooth fin edges; baked whale-shark and eagle-ray markings; seam-free body mapping                                  | Fur reads velvety; otter grizzle subtle; regular whale-shark lattice; humpback tubercles softer; ice sea spider has rod legs                                |
| Coral and reef growth          | 069, 077, 092           | Grounded colonies; plating corals without stalks; code-built sponges, crusts and plates grown organically (no lathes)                                                                                                             | Thin wreck plate petals; library plate bases carry corallite texture; fallback-only plate collision for variants 0/1                                        |
| Kelp and cave geology          | 070, 079, 085, 086, 091 | Authored rock (`geology.glb`) for kelp boulders, cave walls, pillars and boulders; kelp blades, stalks, holdfasts and canopy variation; cave mouth and sunbeam floor                                                              | —                                                                                                                                                           |
| Shipwreck and Antarctic polish | 076, 086, 093           | Weathered, colonised hull; dished plating, sills, rails, ladder, wing braces; deck growth rebalanced; ice authored dropstones and outcrops, smooth breathing-hole rims, scalloped shafts, flake platelets, one basalt rock family | Funnel and wheelhouse massing; the deck is the quietest part in the fog; ice rocks reuse the kelp/cave forms; breathing-hole shafts opaque; undercut stones |
| Lighting and fog               | 064, 087, 089, 091      | Per-world water profiles, beams and caustics, no postprocessing; one dense-water fog (0.13) for the outer reef, wreck, cave and ice, each in its own colour; passage glow                                                         | — (approved; see section 5)                                                                                                                                 |
| Asset loading and resources    | 059, 081, 088, 091, 092 | Draco/KTX2 libraries; geology lease with a bounded 6 s wait and late-lease release; download within its 45 MiB budget; no unused shipped assets                                                                                   | Download headroom is 1 MiB                                                                                                                                  |
| Office                         | 073, 079                | Warm, lived-in office with modelled furniture and the tank as its focal point                                                                                                                                                     | —                                                                                                                                                           |

Of the Pass 088 audit's eleven ranked issues:

- **Addressed:** issues 2–8 (Passes 090–093).
- **Resolved by decision:** issue 1, the outer-reef murk. The user kept it, and Pass 089 made it the
  standard for the wreck and cave.
- **Partly addressed:** issue 9, the wreck superstructure. The massing remains.
- **Remains:** issue 10, the tank back-glass boulders.
- **Still watched:** issue 11, the download and the heaviest view.

## 3. Automated checks

All were run on this branch, in this container (4 CPUs, headless Chromium on SwiftShader).

| Check                                | Result                                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                  | Pass (7 s)                                                                                                                                                                                               |
| `npm run lint`                       | Pass (33 s)                                                                                                                                                                                              |
| `npm run build`                      | Pass (8 s). Main bundle 1,549 kB (469 kB gzip); Draco decoder 719 kB                                                                                                                                     |
| `npm run test`                       | Pass: 109 files, 1108 tests (66 s)                                                                                                                                                                       |
| Asset validation                     | In the suite: `asset-validation`, `asset-production`, `creature-assets`, `fish-assets`, `habitat-assets`, LOD and compression budget (`fish-lod-compression`: 44.00 of 45 MiB)                           |
| Save and customization compatibility | In the suite: `save-compatibility`, `tank-save-safety`, `tank-collection`, `tank-catalog`, `settings`, `audio-settings`                                                                                  |
| Collision and passages               | In the suite: `collision`, `authored-collision`, `passage`, `passage-transitions`, `kelp-passage`, `fog-consistency` (passage glow), `lifecycle-dispose`                                                 |
| Production smoke (`production.mjs`)  | **Pass** after a harness fix (below): built assets load, all 12 startup models return 200, no pointer lock on load, Enter and lock, swim, Esc pauses, volume persists after reload; 0 errors, 0 warnings |
| Load budget (`load-budget.mjs`)      | Startup transfer 22.7 MB (models 21.5 MB, decoders 0.75 MB, scripts 0.47 MB). Aquarium prepared in 39–57 s on SwiftShader with other captures running: relative only                                     |
| Rendering captures                   | 17 fixed views in 6 water worlds and 6 office views, through the game's own loader: 0 page errors                                                                                                        |

**Harness fixes** (validation only; no game code changed):

- `validation/production.mjs` expected 10 startup models, the Pass 016 count. Passes 082 and 083
  added `reef-benchmark.glb` and `reef-habitat.glb`, so it failed with 12. Both load with 200; the
  count is now 12.
- `validation/load-budget.mjs` reported 0 model bytes: models now carry a `?v=` cache-busting
  query, so `url.endsWith('.glb')` never matched. It now matches on the path.

**Not run, by policy:** `long-session.mjs`, multi-hour stress, automated full-world traversal,
cross-browser runs and real-GPU timing. See section 7 for what needs a person and real hardware.

## 4. Gallery and performance

### Before and after gallery

`docs/screenshots/v08-pass094/`: 16 matched viewpoints. "Before" is the Pass 061 baseline
(`docs/screenshots/v07-pass061/`); the office "before" was rendered now, from a clean export of the
Pass 061 commit. "After" is main after Pass 093, through the same harnesses (`baseline.mjs`,
`worlds.mjs`, `office.mjs`). Each image's caption names the art change and the pass.

| Environment | Views                            | Close-ups                                                      |
| ----------- | -------------------------------- | -------------------------------------------------------------- |
| Office      | `office-overview`, `office-tank` |                                                                |
| Aquarium    | `tank-section-medium`            | Coral: `tank-massive-coral-close`. Fish: `tank-chromis-school` |
| Outer reef  | `outer-reef-top`                 | Coral: `outer-coral-close`                                     |
| Kelp forest | `kelp-forest`                    | Rock: `kelp-rocks-close`                                       |
| Shipwreck   | `wreck-overview`, `wreck-deck`   | Hull and growth: `wreck-hull-close`                            |
| Sea cave    | `cave-cavern`                    | Rock: `cave-wall-close`                                        |
| Antarctic   | `ice-open-water`                 | Rock: `ice-seabed-close`                                       |

**Fish and large creatures** are not re-captured; the models are unchanged since their last pass:

- fish: `docs/screenshots/v08-pass090/compare/` (four body families, before and after);
- large animals: `docs/screenshots/v08-pass092/creatures/` (nine animals, four angles each) and
  `water/` (in each world's light).

**What the gallery shows plainly:**

- At swimming distance, the approved fog turns the wreck, the cave and the ice into silhouettes,
  with the passage glow, sunbeam and breathing holes as landmarks. This is the approved standard,
  not a defect (section 5).
- The art change is clearest at close range.
- It also shows three of the known issues:
  - the remaining Pass 061 back-glass stones (`tank-chromis-school`);
  - the sea spider's rod legs and a hovering-looking stone (`ice-seabed-close`);
  - a stair-stepped hull breach edge (`wreck-hull-close`).

### Rendering (fixed views, SwiftShader)

These are counts, not frame times. SwiftShader is a CPU rasteriser; its timings say nothing about
a real GPU. **No real GPU and no MacBook Air was measured.**

| View                     | Draws 061 → 088 → now | Triangles (M) 061 → 088 → now | Geometries 088 → now | Textures 088 → now | Programs 088 → now |
| ------------------------ | --------------------- | ----------------------------- | -------------------- | ------------------ | ------------------ |
| tank-section-medium      | 113 → 103 → 103       | 0.91 → 1.09 → 1.09            | 459 → 459            | 123 → 123          | 82 → 83            |
| tank-massive-coral-close | 102 → 90 → 90         | 0.90 → 0.98 → 0.98            | 459 → 459            | 123 → 123          | 82 → 83            |
| tank-chromis-school      | 125 → 126 → 126       | 1.00 → 1.09 → 1.12            | 459 → 459            | 123 → 123          | 82 → 83            |
| outer-reef-top           | 124 → 127 → 125       | 3.80 → 2.91 → 2.90            | 576 → 576            | 274 → 274          | 97 → 99            |
| outer-coral-close        | 126 → 117 → 117       | 3.98 → 3.01 → 3.01            | 580 → 580            | 274 → 274          | 97 → 99            |
| kelp-forest              | 59 → 60 → 60          | 2.41 → 3.30 → 3.40            | 81 → 81              | 85 → 85            | 28 → 29            |
| kelp-rocks-close         | 43 → 46 → 46          | 2.24 → 3.15 → 3.25            | 84 → 84              | 85 → 85            | 28 → 29            |
| kelp-canopy              | 45 → 48 → 48          | 2.22 → 3.13 → 3.23            | 89 → 89              | 85 → 85            | 28 → 29            |
| wreck-overview           | 81 → 79 → 83          | 1.10 → 1.39 → 2.49            | 110 → 112            | 125 → 125          | 41 → 51            |
| wreck-deck               | 79 → 78 → 80          | 1.10 → 1.39 → 2.49            | 110 → 112            | 125 → 125          | 41 → 51            |
| wreck-hull-close         | 51 → 51 → 53          | 1.07 → 1.36 → 2.45            | 110 → 112            | 125 → 125          | 41 → 51            |
| cave-cavern              | 58 → 61 → 63          | 1.03 → 1.70 → 2.11            | 91 → 93              | 73 → 73            | 37 → 39            |
| cave-wall-close          | 54 → 54 → 54          | 1.01 → 1.66 → 2.06            | 91 → 93              | 73 → 73            | 37 → 39            |
| cave-sunbeam             | 57 → 59 → 61          | 1.01 → 1.67 → 2.08            | 91 → 93              | 73 → 73            | 37 → 39            |
| ice-open-water           | 83 → 79 → 79          | 1.80 → 2.84 → 3.61            | 135 → 136            | 118 → 118          | 34 → 36            |
| ice-seabed-close         | 53 → 53 → 53          | 1.71 → 2.76 → 3.53            | 135 → 136            | 118 → 118          | 34 → 36            |
| ice-underside            | 68 → 67 → 67          | 2.24 → 3.22 → 3.99            | 135 → 136            | 118 → 118          | 34 → 36            |
| office-overview          | 32 → — → 32           | 0.06 → — → 0.09               |                      |                    |                    |

- **Draw calls** held at the Pass 088 level everywhere; the maximum is 126, in the tank.
- **Triangles:**
  - **Heaviest view:** `ice-underside` at **3.99 M**. It was 3.22 M at Pass 088, and is now
    heavier than the kelp forest (3.40 M).
  - **Biggest rises since Pass 088:**
    - Wreck +79% (1.39 → 2.49 M). Pass 093 measured 2.50 M before its own changes, so most of
      this came between Passes 089 and 092, chiefly Pass 092's code-built growth (more vertices
      per instance).
    - Ice +27% and cave +24%, from the Pass 091–093 authored geology and growth.
  - **Next step:** these are the first places to look if the MacBook frame time falls short.
- **Shader programs:** the wreck went from 41 to 51 with Pass 092's three growth materials; the
  others rose by 1–2.
- **Textures** are unchanged since Pass 088. Geometry counts rose by at most 2.
- **World build** (in the browser, while the world loads behind its passage): kelp 2.1 s, cave
  2.0 s, ice 2.4 s, wreck 2.5 s on SwiftShader with other captures running.
- **Disposal:** covered by `lifecycle-dispose.test.ts` for every world, including the geology
  lease's release. It was not re-measured in the browser in this pass.

### Assets and budget

- **Download:** 51 models (Pass 088: 50; Pass 091 added `geology.glb`), 44.00 MiB (46.1 MB),
  against the 45 MiB budget in `fish-lod-compression.test.ts`. Headroom is 1.0 MiB.
- **Startup:** only the aquarium's 12 models (21.5 MB) load before the first dive. The other worlds
  load at their passages.
- **Unused assets:** none. Every shipped model is registered and loaded (checked in Pass 093;
  nothing has been added since).

## 5. Fog confirmation (approved requirements, not defects)

| Requirement                                        | Evidence                                                                                                                                                                                                                                                                                     | Status                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| The outer reef keeps its approved density          | `DENSE_WATER_FOG = 0.13` (`src/config/waterVisibility.ts`); `OUTER.fog` is that constant; `fog-consistency.test.ts` pins the value at 0.13                                                                                                                                                   | Confirmed                                                  |
| The shipwreck and sea cave use the same standard   | `WRECK.fog`, `CAVE.fog` and the `wreck` / `cave` water profiles are the same constant (tested). Under the ice also shares it (Pass 091)                                                                                                                                                      | Confirmed                                                  |
| Each environment keeps its own colour and lighting | Four distinct water colours: outer `0x1d5d76`, wreck `0x12323c`, cave `0x1a4550`, ice `0x1d4f78` (tested distinct); each veils above 90% at 14 m through its own spectrum. Lighting is per world and unchanged since Pass 089. The tank (0.026) and kelp (0.055) keep clearer water (tested) | Confirmed                                                  |
| Passages and landmarks stay navigable              | `PassageGlow` marks each passage: it fades out before the swimmer reaches it and shows from across the water. The cave's sunbeam and the ice's breathing holes are kept clear of the murk; forms within 3 m stay mostly clear (all tested). The world views (section 4) show it              | Confirmed (automated); feel on the Air is in the checklist |

Nothing in this pass changes the fog, the lighting or the passages.

## 6. Known issues

None blocks the manual run; each is a candidate for acceptance or a later pass.

| #   | Issue                                                                                                                                                                   | Where             | Type                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------- |
| 1   | A few smooth Pass 061 boulders along the tank's back-right glass                                                                                                        | Aquarium          | Visual                     |
| 2   | Funnel and wheelhouse keep simple massing; no collapsed sections                                                                                                        | Shipwreck         | Visual                     |
| 3   | The deck is the quietest part of the wreck at swimming distance in the fog                                                                                              | Shipwreck         | Subjective                 |
| 4   | The hull breach edge reads stair-stepped at close range (`wreck-hull-close`). Pass 076 made the cut ragged; the cause of the stepping was not investigated in this pass | Shipwreck         | Visual (new observation)   |
| 5   | Ice sea spider has plain rod legs                                                                                                                                       | Antarctic         | Visual                     |
| 6   | Undercut stones read as hovering at fog distance (none floats; tested)                                                                                                  | Antarctic         | Visual                     |
| 7   | Ice rocks reuse the kelp and cave forms, darkened                                                                                                                       | Antarctic         | Visual                     |
| 8   | Breathing-hole shafts are opaque ice                                                                                                                                    | Antarctic         | Visual                     |
| 9   | Bear and otter fur reads velvety; otter grizzle subtle                                                                                                                  | Animals           | Visual                     |
| 10  | Regular whale-shark lattice; softer humpback tubercles                                                                                                                  | Animals           | Visual                     |
| 11  | Thin wreck plate petals; library plate bases carry the corallite texture                                                                                                | Reef growth       | Visual                     |
| 12  | Invisible collision on plates 0/1 in the original-reef fallback only                                                                                                    | Aquarium fallback | Functional (fallback only) |
| 13  | Download headroom 1.0 MiB; heaviest view 3.99 M triangles (ice ceiling)                                                                                                 | Resources         | Watch                      |
| 14  | Measured on SwiftShader only: no frame rate on any real GPU                                                                                                             | Performance       | Unknown until section 7    |
| 15  | `package.json` still reads `0.6.0-rc.25`; a V0.7 version needs a decision                                                                                               | Release           | Release                    |

## 7. MacBook Air manual acceptance checklist

Run the production build (`npm run build`, then `npx vite preview`) in Safari and in Chrome. Use the
default settings (Graphics detail: Full detail). Turn on **Settings → Show frame time** for the
performance items, and record the frame time it shows, not an impression. Note the world and the spot
for anything that falls short.

**Office and aquarium**

- [ ] Office: warm and calm; the tank is the focal point. Walk to the glass: no flash or exposure jump
      when diving in, or when surfacing back into the office.
- [ ] Aquarium: rocks read as porous and grounded; corals as grown colonies. Fish anatomy holds up
      close (chromis school, clownfish, moray in its den).
- [ ] The back-right glass: do the few remaining smooth boulders stand out? (Known issue 1.)
- [ ] Customization: place, move and remove an ornament and a coral; reload the page; the tank and
      collected animals return as left.

**Outer reef**

- [ ] The approved murk: is the reef top legible enough at swimming distance? (Approved; check only
      that it still feels intended on the Air's screen.)
- [ ] Large animals pass at distance and swim naturally; the crevice back to the tank is findable.
- [ ] Frame time while turning over the reef top (one of the heaviest views, about 3 M triangles).

**Kelp forest**

- [ ] Boulders read as stone; blades, stalks and holdfasts look grown. Swim into a blade: is the
      flat card noticeable?
- [ ] Frame time under the canopy (the heaviest view, about 3.3 M triangles).

**Shipwreck**

- [ ] Hull and superstructure read as weathered, colonised steel; the funnel and wheelhouse massing
      (known issue 2). Is the deck still too quiet in the fog (known issue 3)?
- [ ] The torch lights what the murk reveals; the hold is navigable; the shaft home is visible.

**Sea cave**

- [ ] Walls, pillars and boulders read as rock up close; the sunbeam pool is the landmark.
- [ ] Both tunnels are findable from inside the cavern.

**Antarctic**

- [ ] Dropstones and outcrops look grounded (known issue 6: undercut stones at distance); breathing
      holes have smooth rims; platelets read as ice flakes.
- [ ] Polar bear, otter and minke beside the other animals; the fur (known issue: velvety).
- [ ] The tunnel home is findable; frame time looking up at the ice ceiling (about 3.6–4 M
      triangles).

**General**

- [ ] **Pause and resume:** Esc pauses and releases the mouse; clicking resumes with no held keys
      carried over. Repeat in each world.
- [ ] **Reduced motion:** turn on _Reduced camera motion_ (and the system _Reduce motion_); swim
      through two worlds; no bob or sway on the camera.
- [ ] **Audio:** ambient audio crossfades at the passages; _Mute audio_ and _Master volume_ work
      and are remembered after a reload.
- [ ] **Clipping:** swim into rocks, arches, wreck rails and ice forms: no passing through, no
      snags, no camera inside geometry.
- [ ] **Loading:** time each passage swap (tank → outer reef → kelp → cave → ice; kelp → wreck; and back).
      Note any hitch over about one second.
- [ ] **Crashes:** no error panels or reload prompts over a 20-minute session.
- [ ] **Frame drops and heat:** note the frame time in each world, and the fan and heat after about
      15 minutes. If a world drops badly, repeat it with _Graphics detail: Lighter_.

Record results in the table below and return it with the decision.

| World    | Frame time (ms, typical / worst) | Load time (s) | Issues |
| -------- | -------------------------------- | ------------- | ------ |
| Office   |                                  |               |        |
| Aquarium |                                  |               |        |
| Outer    |                                  |               |        |
| Kelp     |                                  |               |        |
| Wreck    |                                  |               |        |
| Cave     |                                  |               |        |
| Ice      |                                  |               |        |

## 8. Recommendation

**Proceed to manual acceptance. Do not release yet.**

- Every V0.7 art item from Passes 061–093 is implemented. The automated checks pass. The fog is as
  approved.
- Nothing measured here can say whether it runs smoothly on a MacBook Air. The heaviest views (ice
  ceiling, kelp, outer reef, wreck) are the risk.

**Next steps:**

1. Run the section 7 checklist on the MacBook Air in Safari and Chrome, and record the frame time
   and load time per world.
2. Decide on the known issues: accept them for V0.7, or schedule them. Issue 4 (breach edge) and
   issue 1 (tank boulders) are the most visible at close range.
3. If the frame time falls short, look first at the wreck's growth and the ice geology (the largest
   rises since Pass 088), before any change to the fog.
4. **On the user's approval only:**
   - mark V0.7 **Accepted**;
   - then choose a version (for example `0.7.0`), bump it, and tag and deploy.

None of these has been done.
