import { describe, expect, it } from 'vitest';
import {
  HoldPatrol,
  WRECK_LIFE,
  wreckHabitat,
  wreckSpecies,
} from '../src/environment/wreck/WreckLife';
import { toShip, wreckShade } from '../src/environment/wreck/WreckLayout';
import { spawnFish } from '../src/fish/FishSpawner';
import { insideRock } from '../src/fish/FishHabitat';

describe('life on the wreck', () => {
  it('the giant sea bass patrols the dark hold, end to end, turning at each end', () => {
    const bass = new HoldPatrol(),
      local = { x: 0, y: 0, z: 0 };
    let fore = 0,
      aft = -100;
    const yaws = new Set<number>();
    for (let i = 0; i < 30 * WRECK_LIFE.bass.lap; i++) {
      bass.update(1 / 30, false);
      const p = bass.pose.position;
      // Always well inside the hold, where it is dark.
      expect(wreckShade(p)).toBe(1);
      toShip(p, local);
      fore = Math.min(fore, local.z);
      aft = Math.max(aft, local.z);
      yaws.add(Math.round(bass.pose.yaw));
    }
    expect(fore).toBeLessThan(WRECK_LIFE.bass.foreZ + 0.3);
    expect(aft).toBeGreaterThan(WRECK_LIFE.bass.aftZ - 0.3);
    // It faces both ways in a lap.
    expect(yaws.has(2)).toBe(true);
    expect(yaws.has(-2)).toBe(true);
  });
  it('the schools start in open water, clear of the ship', () => {
    const habitat = wreckHabitat(),
      fish = spawnFish(habitat, wreckSpecies(), 24024);
    expect(fish.length).toBeGreaterThan(60);
    for (const f of fish)
      for (const rock of habitat.rocks)
        expect(insideRock(f.position, 0.05, rock)).toBe(false);
  });
});
