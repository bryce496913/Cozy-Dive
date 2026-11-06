import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { spawnFish, populationCount } from './fixtures/originalFish';
import {
  ORIGINAL_FISH_SPECIES as FISH_SPECIES,
  FISH_STEERING,
} from '../src/fish/FishSpecies';

const openHabitat = { bounds: AQUARIUM, rocks: [] };
describe('species and seeded spawning', () => {
  it('registers distinct freshwater species with valid movement, shape, and population parameters', () => {
    expect(FISH_SPECIES.map((s) => s.id)).toEqual([
      'neon-tetra',
      'harlequin-rasbora',
      'honey-gourami',
    ]);
    expect(FISH_SPECIES.map((s) => s.count)).toEqual([8, 6, 2]);
    expect(populationCount()).toBe(16);
    for (const s of FISH_SPECIES) {
      expect(s.maxSpeed).toBeGreaterThan(s.speed);
      expect(s.acceleration).toBeGreaterThan(0);
      expect(s.turnRate).toBeGreaterThan(0);
      expect(s.depth[1]).toBeGreaterThan(s.depth[0]);
      expect(s.length).toBeGreaterThan(s.height);
      expect(s.height).toBeGreaterThan(s.width);
      expect(s.tailHz).toBeGreaterThan(0);
    }
    expect(FISH_SPECIES[0].speed).toBeGreaterThan(FISH_SPECIES[1].speed);
    expect(FISH_SPECIES[1].speed).toBeGreaterThan(FISH_SPECIES[2].speed);
    expect(FISH_SPECIES[2].height / FISH_SPECIES[2].length).toBeGreaterThan(
      FISH_SPECIES[0].height / FISH_SPECIES[0].length,
    );
  });
  it('creates the right counts with reproducible positions and individual variation', () => {
    const a = spawnFish(openHabitat),
      b = spawnFish(openHabitat);
    expect(a).toEqual(b);
    expect(a).toHaveLength(16);
    for (const s of FISH_SPECIES)
      expect(a.filter((f) => f.species === s)).toHaveLength(s.count);
    expect(new Set(a.map((f) => f.phase)).size).toBe(16);
    expect(new Set(a.map((f) => f.speedFactor)).size).toBe(16);
    expect(spawnFish(openHabitat, FISH_SPECIES, 572)).not.toEqual(a);
  });
  it('uses real rock data and avoids rocks, glass, other spawn bodies, and the starting player', () => {
    const aquarium = new Aquarium();
    try {
      const habitat = { bounds: AQUARIUM, rocks: aquarium.rockColliders };
      const fish = spawnFish(habitat);
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
        expect(f.position.y).toBeGreaterThanOrEqual(f.species.depth[0]);
        expect(f.position.y).toBeLessThanOrEqual(f.species.depth[1]);
        expect(
          Math.hypot(
            f.position.x - SPAWN.x,
            f.position.y - SPAWN.y,
            f.position.z - SPAWN.z,
          ),
        ).toBeGreaterThan(FISH_STEERING.spawnPlayerClearance + f.radius);
        for (const other of fish.slice(i + 1))
          expect(
            Math.hypot(
              f.position.x - other.position.x,
              f.position.y - other.position.y,
              f.position.z - other.position.z,
            ),
          ).toBeGreaterThan(
            f.radius + other.radius + FISH_STEERING.spawnSeparation,
          );
      }
    } finally {
      aquarium.dispose();
    }
  });
  it('supports the temporary 32-fish stress population and rejects invalid/impossible populations', () => {
    expect(
      spawnFish(
        openHabitat,
        FISH_SPECIES.map((s) => ({ ...s, count: s.count * 2 })),
      ),
    ).toHaveLength(32);
    expect(() =>
      spawnFish(openHabitat, [{ ...FISH_SPECIES[0], count: -1 }]),
    ).toThrow(/population/);
    expect(() =>
      spawnFish({
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0.1, y: 0.1, z: 0.1 },
          clearance: 0,
        },
        rocks: [],
      }),
    ).toThrow(/safe spawn/);
  });
});
