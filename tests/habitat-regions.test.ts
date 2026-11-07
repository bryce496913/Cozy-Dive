import { expect, it } from 'vitest';
import {
  generatePlantPlacements,
  plantFootprintClear,
  substrateHeight,
} from '../src/environment/HabitatRegions';
import { Aquarium } from '../src/environment/Aquarium';
import { PlantSystem } from '../src/environment/PlantSystem';
import { AQUARIUM, SPAWN } from '../src/config/world';
it.each([48193, 1729, 9271])(
  'deterministically places varied clustered species inside habitat regions with an open channel at seed %i',
  (seed) => {
    const a = generatePlantPlacements([], seed),
      b = generatePlantPlacements([], seed);
    expect(a).toEqual(b);
    expect(a).toHaveLength(65);
    expect(new Set(a.map((p) => p.height)).size).toBe(65);
    for (const p of a) {
      expect(p.position.y).toBeCloseTo(
        substrateHeight(p.position.x, p.position.z) - 0.012,
      );
      expect(p.region).toBe(p.species.region);
      expect(p.height).toBeGreaterThanOrEqual(p.species.height[0]);
      expect(p.height).toBeLessThanOrEqual(p.species.height[1]);
      expect(Math.abs(p.position.x) - p.radius).toBeGreaterThanOrEqual(3.2);
      expect(
        Math.hypot(p.position.x - SPAWN.x, p.position.z - SPAWN.z),
      ).toBeGreaterThan(p.radius + 3);
      expect(p.position.y + p.height).toBeLessThan(AQUARIUM.max.y);
      expect(plantFootprintClear(p.position.x, p.position.z, p.radius)).toBe(
        true,
      );
    }
  },
);
it('keeps a temporary double-density scenario bounded and pooled without changing rock colliders', () => {
  const a = new Aquarium();
  try {
    const system = new PlantSystem(a.collision.colliders, 2);
    try {
      expect(system.placements).toHaveLength(130);
      expect(system.geometries.length).toBeLessThanOrEqual(18);
      expect(a.rockColliders).toHaveLength(34);
    } finally {
      system.dispose();
    }
  } finally {
    a.dispose();
  }
});
it('rejects invalid and excessive density explicitly', () => {
  for (const density of [0, -1, NaN, Infinity, 4])
    expect(() => generatePlantPlacements([], 1, density)).toThrow();
});
