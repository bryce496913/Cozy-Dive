/**
 * The home aquarium's water and light rig (unchanged since v0.3). Shared so the V0.7 style
 * benchmark (Pass 062) can render its baseline treatment with exactly the game's values.
 */
export const TANK_LIGHTING = {
  clearColor: 0x17555b,
  background: 0x225d73,
  /** FogExp2 density of the tank water (`UNDERWATER_HAZE`). */
  fogDensity: 0.026,
  exposure: 1.35,
  hemisphere: { sky: 0xc7f2e0, ground: 0x546b56, intensity: 2.6 },
  sun: { color: 0xfff1cf, intensity: 3.2, position: [-7, 18, 7] },
  fill: { color: 0x75ced0, intensity: 0.7, position: [10, 8, -12] },
} as const;
