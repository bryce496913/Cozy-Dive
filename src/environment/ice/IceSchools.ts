import { ICE } from '../../config/passage';
import type { FishHabitat } from '../../fish/FishHabitat';
import { FISH_SPECIES, type FishSpecies } from '../../fish/FishSpecies';
import { iceFloor } from './IceTerrain';

/**
 * v0.6 Pass 052 (playtest: "there are no creatures"): fish schooling in mid-water under the ice,
 * where the swimmer is, on the ordinary fish simulation (drawn on the chromis rig in silver, as
 * the other worlds' recoloured schools are).
 *   - Antarctic silverfish: one big, shimmering school wheeling through the open water.
 */
export const ICE_SCHOOLS = {
  silverfish: { count: 110, x: 2, y: 7, z: -34, size: 1.15 },
} as const;

/** The open water the schools may use: inside the icebergs, above the seabed, below the ice. */
export function iceHabitat(): FishHabitat {
  const w = ICE.walls;
  return {
    bounds: {
      min: { x: -w.x + 4, y: 2, z: w.farZ + 4 },
      max: { x: w.x - 4, y: ICE.ceiling - 3, z: ICE.tunnel.wallZ - 4 },
      clearance: 0.4,
    },
    rocks: [],
    substrateHeight: iceFloor,
  };
}

export function iceSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!,
    s = ICE_SCHOOLS.silverfish,
    silver = 0xc3d3dc,
    k = s.size;
  return [
    {
      ...chromis,
      id: 'antarctic-silverfish',
      name: 'Antarctic silverfish',
      count: s.count,
      length: chromis.length * k,
      height: chromis.height * k * 0.8,
      width: chromis.width * k,
      color: silver,
      backColor: 0x6f8592,
      finColor: silver,
      accentColor: silver,
      schooling: {
        ...chromis.schooling,
        enabled: true,
        cohesionWeight: chromis.schooling.cohesionWeight * 1.3,
        alignmentWeight: chromis.schooling.alignmentWeight * 1.3,
      },
      speed: chromis.speed * 1.1,
      region: { x: s.x, y: s.y, z: s.z },
      spread: { x: 5, y: 2, z: 5 },
      depth: [3.5, ICE.ceiling - 4],
      individualScale: undefined,
      habitatKinds: undefined,
      substrateOffset: undefined,
    },
  ];
}
