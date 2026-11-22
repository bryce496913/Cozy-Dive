# V0.8 Pass 087: Final Artistic Integration

Base: main after Pass 086. Scope: bring every environment's materials and lighting to one
Crafted Stylized Realism standard, the approved Pass 082 tank benchmark, while keeping each world's
identity:

- warm aquarium;
- blue reef;
- green-gold kelp;
- murky shipwreck;
- dark cave;
- cold Antarctic water.

No new rendering features, areas, creatures or gameplay. No bloom, particles, extra fog or colour
grading. No geometry changed.

## Standard gallery

`validation/v08/standard-gallery.sh` renders the same 18 views on every run: three per world
(wide, mid and close), from normal swimming viewpoints, at fixed simulation time:

| World            | Views                                                   |
| ---------------- | ------------------------------------------------------- |
| Tank (benchmark) | `aqua-overview`, `aqua-left-bank`, `aqua-attach-close`  |
| Outer reef       | `outer-reef-wide`, `outer-reef-top`, `outer-rock-close` |
| Kelp forest      | `kelp-forest-wide`, `kelp-forest`, `kelp-rocks-close`   |
| Shipwreck        | `wreck-overview`, `wreck-broadside`, `wreck-hull-close` |
| Sea cave         | `cave-cavern`, `cave-sunbeam`, `cave-wall-close`        |
| Under the ice    | `ice-open-water`, `ice-seabed-wide`, `ice-seabed-close` |

It drives the existing harnesses (`validation/v07/baseline.mjs` and `worlds.mjs`), which now take
a `COZY_VIEWS` filter. The "before" set was rendered from a clean export of main on a separate dev
server. Galleries: `docs/screenshots/v08-pass087/` (before on the left, Pass 087 on the right).

## 1. Audit against the benchmark (before)

The benchmark tank shows matte, relieved rock (roughness about 0.9, normal relief visible at
swimming distance), warm key over cool fill, and a clear value separation between seabed, rock and
life.

| World      | Material quality                                                                                  | Surface response                               | Colour and value balance                                         | Lighting and depth                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Outer reef | Pass 085 variants hold up close                                                                   | Fine                                           | Blue identity right                                              | Midground rock and coral flattened into blue cut-outs: high flat ambient (1.25) left little modelling once the murk took the colour |
| Kelp       | Boulder relief averaged out                                                                       | Fine grain (1.1/m) unreadable under the canopy | Dark rock, little value range                                    | Boulders read as smooth blobs                                                                                                       |
| Shipwreck  | Pass 086 plating holds up                                                                         | Fine                                           | Colonies kept reef-bright instance colours: stickers in the murk | Murk right                                                                                                                          |
| Sea cave   | Pass 079/086 limestone holds up                                                                   | Fine                                           | Fine                                                             | Fine; carved boulders read low-poly at close range (geometry, out of scope)                                                         |
| Under ice  | The last glossy, plastic surface (roughness 0.38, strong blue glow); relief was sparse veins only | Sheen carried the form, not light              | Ice and seabed shared one near-white value range                 | Bergs had nothing to stand out against                                                                                              |

The creatures (Pass 084) sit well in every world's water. Their matte denticle, smooth and fur skins
match the environments' roughness range, so no creature change was needed.

## 2. Adjustments

| World      | Change                                                                                                           | Why                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Under ice  | 'Ice': roughness 0.38 → 0.5, emissive 0.28 → 0.18, normal 0.35 → 0.6; 'Ice detail' (brinicles, icicles) to match | Weathered, frosted ice scatters; the key light and relief model the form instead of the sheen                                         |
| Under ice  | Ice surface relief (`HabitatSurface('ice')`): shallow melt dimples under the veins                               | Worn-ice micro-relief, not glass                                                                                                      |
| Under ice  | Seabed tinted a step darker, cool grey-blue (0xc6ced6)                                                           | Value separation between the bergs and the seabed                                                                                     |
| Shipwreck  | Colony material tinted grey-green (0xa9b5a8)                                                                     | Colonies keep their hue but sit in the steel's light and value range                                                                  |
| Kelp       | Rock grain 1.1 → 0.6 repeats/m, normal 0.8 → 1.0                                                                 | Relief readable at swimming distance under the canopy                                                                                 |
| Outer reef | Hemisphere 1.25 → 1.0, key 2.4 → 2.8                                                                             | Forms model through the murk, as the tank's Pass 064 rig does; the fog (a pinned playtest value guarding against pop-in) is unchanged |

The tank, cave, creatures and every fog density are unchanged.

## 3. Result

PASS087_RESULT

## 4. Validation

PASS087_VALIDATION

## 5. Remaining visual issues, ranked

PASS087_ISSUES
