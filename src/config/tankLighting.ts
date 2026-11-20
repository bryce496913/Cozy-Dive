/**
 * The home aquarium's water and light rig. Shared so the V0.7 style benchmark (Pass 062) renders
 * its baseline treatment with exactly the game's values; V0.7 Pass 064 retuned it (see
 * `config/waterProfiles.ts`).
 */
export const TANK_LIGHTING = {
  clearColor: 0x17555b,
  background: 0x225d73,
  /** FogExp2 density of the tank water (`UNDERWATER_HAZE`). */
  fogDensity: 0.026,
  exposure: 1.35,
  // V0.7 Pass 064 (approved B direction): less ambient (was 2.6, which flattened every form into a
  // milky haze), a warmer, stronger key (was 3.2 0xfff1cf) and a cooler rim (was 0.7 0x75ced0).
  hemisphere: { sky: 0xc7ecdf, ground: 0x4a5e50, intensity: 1.9 },
  sun: { color: 0xffe8c4, intensity: 3.8, position: [-7, 18, 7] },
  fill: { color: 0x86d6e0, intensity: 1.0, position: [10, 8, -12] },
} as const;
