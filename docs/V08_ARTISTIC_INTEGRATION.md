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

| World     | Change                                                                                                           | Why                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Under ice | 'Ice': roughness 0.38 → 0.5, emissive 0.28 → 0.18, normal 0.35 → 0.6; 'Ice detail' (brinicles, icicles) to match | Weathered, frosted ice scatters; the key light and relief model the form instead of the sheen |
| Under ice | Ice surface relief (`HabitatSurface('ice')`): shallow melt dimples under the veins                               | Worn-ice micro-relief, not glass                                                              |
| Under ice | Seabed tinted a step darker, cool grey-blue (0xc6ced6)                                                           | Value separation between the bergs and the seabed                                             |
| Shipwreck | Colony material tinted grey-green (0xa9b5a8)                                                                     | Colonies keep their hue but sit in the steel's light and value range                          |
| Kelp      | Rock grain 1.1 → 0.5 repeats/m, normal 0.8 → 1.4                                                                 | Relief readable at swimming distance under the canopy                                         |

The tank, cave, creatures, every fog density and every light rig are unchanged.

**Tried and reverted:** a lighter ambient and stronger key for the outer reef (hemisphere 1.25 →
1.0, key 2.4 → 2.8). In the matched views it changed almost nothing: at midground distances the
murk replaces the lit colour, so the rig cannot recover shape there. The real lever is the murk,
`OUTER.fog` (0.13), which is a pinned playtest decision guarding against pop-in (see issue 1).

## 3. Result

Matched views in `docs/screenshots/v08-pass087/`:

- **Tank and sea cave:** byte-identical image hashes, before and after.
- **Draw calls and triangle counts:** identical in every view (material and colour changes only).

| World      | Result                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Under ice  | Clearest gain. The bergs lost the wet sheen and read as matte, frosted masses lit by the key. The darker, cooler seabed separates them, and the scene keeps its cold, bright identity. |
| Shipwreck  | The colonies keep their hue but now sit in the murk with the steel instead of glowing like stickers; the hull reads as one weathered, colonised surface.                               |
| Kelp       | The near boulders show grain and pores. A modest gain: the boulders still lack the benchmark's colour variation (issue 3).                                                             |
| Outer reef | Unchanged (the trial was reverted).                                                                                                                                                    |

**World identities after the pass:**

- warm, clear aquarium;
- deep-blue reef;
- green-gold kelp;
- murky, grey-green wreck;
- dark limestone cave;
- cold, bright Antarctic water.

**Consistency assessment.** On materials, every surface is now in the benchmark's matte,
relieved family: no glossy, plastic surfaces remain in the environments. The approved reef, the
outer reef up close, the cave and the wreck read as one style. The remaining gaps are mostly
geometry and composition (below), not material response.

## 4. Validation

- **Checks:** typecheck, lint and build pass.
- **Full test suite:** 104 files, 1,062 tests pass.
- **Browser:** the standard gallery rendered all 18 views (6 tank and outer, 12 kelp, wreck, cave
  and ice) with 0 errors, before and after. Kelp was re-captured after its final values.
- **Not run:** no whole-game walkthrough or long-session stress run (out of scope).
- **Not measured:** laptop or cross-browser frame rate. No change here alters GPU cost
  (material constants and one texture's content only).

## 5. Remaining visual issues, ranked

1. **Outer reef midground (high).** At 6-14 m the reef dissolves into flat blue silhouettes. The
   cause is `OUTER.fog` 0.13, a playtest hotfix (about 96% haze by 14 m) pinned by
   `outer-draw-distance.test.ts` to hide detail-level changes. Showing the Pass 085 reef needs a
   decision on lowering it (about 0.11), paired with moving the far detail levels out. It is a
   deliberate value, so it was not changed here.
2. **Kelp blades up close (high).** Seen within a metre (`kelp-rocks-close`), a blade is a flat,
   untextured, faceted yellow card. The blades have no surface map or vein detail, unlike the tank's
   vegetation. A blade material with venation and translucency colour would fix it.
3. **Kelp boulders (medium).** Smooth ovoid geometry with one dark tint: below the benchmark's
   carved, colour-varied rock. They need the Pass 083/085 sculpt-and-paint treatment.
4. **Sea cave carved boulders and pillars (medium).** Pass 079's carved limestone reads low-poly,
   with large flat facets at close range (`cave-wall-close`). Also from Pass 086: the cave walls and
   the seabed under the light shaft were never reworked.
5. **Ice dropstones and outcrops (medium).** Dark, smooth, faceted blobs (the old `rockShape` lump)
   beside the sculpted ice.
6. **Wreck superstructure (low).** Boxy deckhouse and fittings; Pass 086's silt and edge wear are
   subtle at swimming distance.
7. **Cave back-tunnel collar and ice-mouth arch banding (low).** Pass 086 leftovers: a darker
   collar ring inside the cave arch, and striped frost on the ice arch.
8. **Minke whale and sea otter (low).** Still the lofted Pass 068 models (Pass 084 limitation),
   below the refined creatures.
