import { REGRESSION_FISH_SPECIES as FISH_SPECIES } from './fixtures/regressionSpecies';
import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { spawnFish, populationCount } from './fixtures/originalFish';
import { FISH_STEERING } from '../src/fish/FishSpecies';

const openHabitat = { bounds: AQUARIUM, rocks: [] };
describe('species and seeded spawning', () => {
  it('retains historical steering calibration roles with valid movement, shape, and population parameters', () => {
    expect(FISH_SPECIES.map((s) => s.id)).toEqual([
      'blue-green-chromis',
      'pajama-cardinalfish',
      'royal-gramma',
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

import * as THREE from 'three';
import { rockCollider } from '../src/environment/rockCollider';
import { FishSimulation } from '../src/fish/FishMovement';
it('chooses a clear initial heading without changing seeded positions or random choices', () => {
  const species = [
    {
      ...FISH_SPECIES[0],
      count: 1,
      region: { x: 0, y: 4, z: 0 },
      spread: { x: 1, y: 0.5, z: 1 },
    },
  ];
  const open = spawnFish(openHabitat, species)[0];
  const geometry = new THREE.BoxGeometry(0.1, 3, 3);
  const matrix = new THREE.Matrix4().makeRotationY(open.yaw);
  matrix.setPosition(
    open.position.x + Math.cos(open.yaw) * (open.radius + 0.12),
    open.position.y,
    open.position.z - Math.sin(open.yaw) * (open.radius + 0.12),
  );
  const habitat = { ...openHabitat, rocks: [rockCollider(geometry, matrix)] };
  geometry.dispose();
  const blocked = spawnFish(habitat, species)[0];
  expect(blocked.position).toEqual(open.position);
  expect(blocked.yaw).not.toBe(open.yaw);
  expect(blocked.phase).toBe(open.phase);
  expect(blocked.randomState).toBe(open.randomState);
  expect(open.speed).toBeGreaterThan(0);
  expect(blocked.speed).toBe(open.speed);
  expect(
    Math.hypot(blocked.velocity.x, blocked.velocity.y, blocked.velocity.z),
  ).toBeCloseTo(blocked.speed, 12);
  const sim = new FishSimulation([blocked], habitat);
  for (let i = 0; i < 60; i++) sim.advance(1 / 30, true);
  expect(blocked.corrections).toBe(0);
  expect(safeFishPosition(blocked.position, blocked.radius, habitat)).toBe(
    true,
  );
});
