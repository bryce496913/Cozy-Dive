# V0.7 underwater lighting and atmosphere (Pass 064)

Pass 064 gives every water world one shared lighting and atmosphere system, tuned per world. It follows the approved Crafted Stylized Realism direction: water that reads as a substance with depth, a warm key light, a cool rim light, moderate ambient, and restrained light shafts and caustics. It adds no postprocessing and makes no backend change.

The images below are the user's approval gate. The creature overhaul does not start until these scenes are approved.

## 1. Audit (before)

| Area          | Before                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer      | One shared `WebGLRenderer` for all water worlds. ACES Filmic tone mapping, exposure 1.35, sRGB output.                                                                                |
| Fog           | `FogExp2` per world. A global shader patch (`deepFog.ts`, Pass 026) darkens below y −2. Otherwise one uniform fade to a single colour, which reads as "tinted air".                   |
| Lights        | Hemisphere + sun + fill in every world, with hard-coded values in six scene files. Tank ambient was 2.6, which flattened forms into the milky haze noted by the Pass 061 audit.       |
| Shafts        | **Tank and outer reef:** flat, uniform open cylinders that read as sheets. **Ice:** hard-edged cones with a visible disc on the seabed. **Kelp and cave:** soft layered beams (good). |
| Caustics      | None.                                                                                                                                                                                 |
| Tank glass    | The pale office was drawn through the glass only 28 % toward the water colour, which added to the milky look.                                                                         |
| Office portal | Renders the tank into a transparent target; the background is keyed on alpha.                                                                                                         |

## 2. What changed

**Profiles**

`src/config/waterProfiles.ts` holds one profile per world:

- water colour;
- fog density;
- hemisphere, sun and fill;
- shafts;
- caustics.

Every scene builds its rig with `createLightRig` (`rendering/atmosphere/lightRig.ts`). The rig shape is identical in every world, so shader programs stay shared.

**Water fog** (`rendering/deepFog.ts`, `WATER_FOG`)

- **Spectral absorption:** each colour channel fades faster the less of it the water colour holds, so reds go first with distance and blue-greens last. This is derived from the water colour itself, so it needs no new uniform.
- **Near haze:** a gentle linear term, so close forms sit _in_ the water and the foreground, midground and distance separate gradually.
- **Same visibility:** the density is rescaled so each world's **half-visibility distance is unchanged**. The outer reef's visibility stays exactly as you asked; this is tested.
- **Deep darkening:** kept as it was.

**Light shafts**

- The tank, outer reef and ice now use the shared soft layered beam (`shared/LightBeam.ts`): bright under the surface, fading with depth, soft edges, and no discs on the seabed.
- The beam material now **leaves destination alpha untouched**. Ordinary additive blending would show the beams as red and black streaks in the office's miniature tank, which keys its background on alpha.

**Caustics** (`rendering/atmosphere/Caustics.ts`)

- A bounded addition to the sand material (a three-iteration water-caustic function). The ribbons redistribute light rather than only adding it.
- They fade with depth, distance (no far shimmer) and surface slope.
- They are applied to:
  - the tank sand;
  - the outer reef-top sand;
  - the kelp lane.
- None in the wreck (too deep), cave (it has its own sunbeam pool) or ice (diffusing cover).
- The clock follows simulation time and **freezes under reduced motion**. The beams' existing sway and ice shimmer already respect reduced motion.

**Tank** (approved B direction)

| Light                | Before | After                 |
| -------------------- | ------ | --------------------- |
| Ambient (hemisphere) | 2.6    | 1.9                   |
| Key (sun)            | 3.2    | 3.8, warmer `#FFE8C4` |
| Rim (fill)           | 0.7    | 1.0, cooler `#86D6E0` |

The glass outlook tint changed from 0.28 / 0.9 to 0.5 / 0.78. The office still shows, but no longer washes the tank out.

**Exposure** is global (1.35) on purpose. Brightness differences come from each world's rig, so passing between worlds never causes an exposure jump. Passages also cross darkness.

## 3. Adjustable parameters

| Where              | Parameter                                                                                | Effect                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `waterProfiles.ts` | `water`                                                                                  | Background and fog colour. Also sets the absorption spectrum. |
|                    | `fogDensity`                                                                             | Visibility. The half-veil distance is √ln2 / density.         |
|                    | `hemisphere.intensity` / colours                                                         | Ambient. Lower values give stronger curvature and modelling.  |
|                    | `sun`                                                                                    | Warm key from the surface.                                    |
|                    | `fill`                                                                                   | Cool rim that separates silhouettes from the water.           |
|                    | `shafts.intensity`, `tint`                                                               | Per-layer beam brightness: 0.01–0.03; null for none.          |
|                    | `caustics.strength`, `scale`, `speed`, `fullAbove`, `noneBelow`, `fadeDistance`, `color` | Strength, cell size, drift, depth band and distance fade.     |
| `deepFog.ts`       | `WATER_FOG.nearHaze` (0.3), `absorption` (0.6)                                           | Global substance and spectral shift.                          |
|                    | `DEEP_FOG`                                                                               | Below-depth darkening (unchanged).                            |
| `tankLighting.ts`  | `exposure`                                                                               | Global tone-mapping exposure (shared by all worlds).          |
| `TankOutlook.ts`   | `OUTLOOK.tint`, `light`                                                                  | How watery the office looks through the glass.                |

## 4. Cost

Measured with SwiftShader, so these are counts, not frame times. Tables are in the PR.

**Draw calls and triangles**

- The tank's draw calls are unchanged: the beams went from 7 meshes to 7 meshes.
- The ice gains 3 beam meshes, replacing shafts that were merged geometry.
- The beam triangle count rises slightly: layered cones (32 × 10 × 3 per beam) replace 12-sided single cylinders.
- No new render passes, render targets or postprocessing.

**Shader cost**

- Fog: a few more ALU instructions per fragment in all fogged materials.
- Caustics: three loop iterations of trig per sand fragment, skipped when beyond the fade distance or depth.
- Programs: one extra variant per caustic sand material.

## 5. Limitations

- **Software rendering:** no hardware frame-time measurement was possible. The added shader work needs one profiling check on the target laptop.
- **Mostly still images:** captures are stills on the fixed clock. Caustic motion and beam sway need a short playable look.
- **Cave, wreck and kelp rigs:** their light values are unchanged in this pass. They gain the new fog (absorption and near haze) and the kelp gains caustics. Further per-world retuning should follow your feedback on these scenes.
- **No sun shadow:** the shadow still waits on a hardware measurement, as before.
