/**
 * V0.7 Pass 064: per-world water, light and atmosphere profiles.
 *
 * One profile per water world. Every world keeps the same rig shape (hemisphere sky, directional
 * sun, directional fill), so all worlds share compiled shader programs (programs are keyed by light
 * counts). Tuning a world means editing its profile here:
 *
 *   water / fogDensity  the water colour (background and fog) and FogExp2 density. The shared
 *                       fog shader (`rendering/deepFog.ts`) derives spectral absorption from the
 *                       water colour itself (channels the water lacks fade first), and preserves
 *                       each world's half-visibility distance.
 *   hemisphere          ambient sky/ground light. Lower values give forms more modelling.
 *   sun                 the warm key from the surface: the light that shapes curvature.
 *   fill                a cool rim/fill from behind that separates silhouettes from the water.
 *   shafts              light shafts from the surface (soft layered beams; null = none).
 *   caustics            moving surface-light patterns on shallow sand (null = none). They fade
 *                       with depth below `fullAbove` to nothing at `noneBelow` and with distance;
 *                       they freeze when reduced motion is on.
 *
 * Exposure and tone mapping are shared by every world (`TANK_LIGHTING.exposure`, ACES): brightness
 * differences between worlds come from these rigs, so a world switch never jumps exposure.
 */
import { TANK_LIGHTING } from './tankLighting';
import { CAVE, ICE, KELP, OUTER } from './passage';
import { WRECK } from './wreck';

export type WaterWorldId = 'tank' | 'outer' | 'kelp' | 'wreck' | 'cave' | 'ice';
export type Vec3Tuple = readonly [number, number, number];

export interface LightSpec {
  readonly color: number;
  readonly intensity: number;
  readonly position: Vec3Tuple;
}
export interface ShaftSpec {
  /** Peak additive brightness of each beam layer at the top. */
  readonly intensity: number;
  readonly tint: Vec3Tuple;
}
export interface CausticSpec {
  /** Light redistributed at full strength, as a fraction of the sun (0.3-0.6 reads as restrained). */
  readonly strength: number;
  /** Pattern cells per metre. */
  readonly scale: number;
  /** Drift speed (pattern units per second). */
  readonly speed: number;
  /** World height (m) at and above which caustics are full strength. */
  readonly fullAbove: number;
  /** World height (m) below which there are none. */
  readonly noneBelow: number;
  /** Eye distance (m) beyond which they fade out (avoids shimmer). */
  readonly fadeDistance: number;
  readonly color: number;
}
export interface WaterProfile {
  readonly label: string;
  readonly water: number;
  readonly fogDensity: number;
  readonly hemisphere: {
    readonly sky: number;
    readonly ground: number;
    readonly intensity: number;
  };
  readonly sun: LightSpec;
  readonly fill: LightSpec;
  readonly shafts: ShaftSpec | null;
  readonly caustics: CausticSpec | null;
}

export const WATER_PROFILES: Readonly<Record<WaterWorldId, WaterProfile>> = {
  tank: {
    label: 'Tropical aquarium',
    water: TANK_LIGHTING.background,
    fogDensity: TANK_LIGHTING.fogDensity,
    hemisphere: TANK_LIGHTING.hemisphere,
    sun: TANK_LIGHTING.sun,
    fill: TANK_LIGHTING.fill,
    shafts: { intensity: 0.014, tint: [0.86, 1, 0.9] },
    caustics: {
      strength: 0.55,
      scale: 0.28,
      speed: 0.32,
      fullAbove: 0,
      noneBelow: -3,
      fadeDistance: 16,
      color: 0xfff4dc,
    },
  },
  outer: {
    label: 'Outer reef',
    water: 0x1d5d76,
    fogDensity: OUTER.fog,
    // V0.8 Pass 087 (consistency audit: midground rock and coral flattened into blue cut-outs):
    // less flat ambient (was 1.25) and a stronger key (was 2.4) model the reef's forms through
    // the murk, as the tank's Pass 064 rig does. The murk itself (`OUTER.fog`) is unchanged.
    hemisphere: { sky: 0x9fd6e0, ground: 0x3d5a4e, intensity: 1.0 },
    sun: { color: 0xfff1d2, intensity: 2.8, position: [-20, 60, -40] },
    fill: { color: 0x75ced0, intensity: 0.5, position: [30, 20, 40] },
    shafts: { intensity: 0.012, tint: [0.82, 1, 0.92] },
    caustics: {
      strength: 0.45,
      scale: 0.22,
      speed: 0.28,
      fullAbove: 1,
      noneBelow: -6,
      fadeDistance: 18,
      color: 0xfff4dc,
    },
  },
  kelp: {
    label: 'Kelp forest',
    water: KELP.water,
    fogDensity: KELP.fog,
    hemisphere: { sky: 0xd8f0c8, ground: 0x3a4630, intensity: 1.35 },
    sun: { color: 0xfff0c6, intensity: 2.3, position: [-15, 60, -30] },
    fill: { color: 0x8fd0aa, intensity: 0.45, position: [25, 15, 30] },
    shafts: null, // KelpLight's own swaying beams (same shared beam builder)
    caustics: {
      strength: 0.35,
      scale: 0.2,
      speed: 0.22,
      fullAbove: 2,
      noneBelow: -4,
      fadeDistance: 14,
      color: 0xf6ffd8,
    },
  },
  wreck: {
    label: 'Shipwreck',
    water: WRECK.water,
    fogDensity: WRECK.fog,
    hemisphere: { sky: 0x9fc8c4, ground: 0x161c1c, intensity: 0.9 },
    sun: { color: 0xd8eee6, intensity: 0.7, position: [4, 60, -20] },
    fill: { color: 0x3f7f86, intensity: 0.35, position: [-20, 10, 30] },
    shafts: null, // too deep for surface shafts; the mystery is the point
    caustics: null,
  },
  cave: {
    label: 'Sea cave',
    water: CAVE.water,
    fogDensity: CAVE.fog,
    hemisphere: { sky: 0x8fc4c4, ground: 0x6a6452, intensity: 1.1 },
    sun: {
      color: 0xfff0cf,
      intensity: 1.7,
      position: [CAVE.skylight.x + 6, 60, CAVE.skylight.z - 4],
    },
    fill: { color: 0x6aaabb, intensity: 0.35, position: [-20, 10, 30] },
    shafts: null, // the skylight's own sunbeam and light pool
    caustics: null,
  },
  ice: {
    label: 'Under the ice',
    water: ICE.water,
    fogDensity: ICE.fog,
    hemisphere: { sky: 0xdff2ff, ground: 0x2a3442, intensity: 1.25 },
    sun: { color: 0xf2f6ff, intensity: 1.5, position: [-10, 60, -20] },
    fill: { color: 0x6fa8d8, intensity: 0.45, position: [20, 10, 30] },
    shafts: { intensity: 0.03, tint: [0.84, 0.94, 1] },
    caustics: null, // sea ice diffuses the light; no surface ripples to focus it
  },
};
