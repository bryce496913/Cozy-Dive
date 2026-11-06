import { describe, expect, it } from 'vitest';
import { AQUARIUM } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { safeFishPosition, type FishHabitat } from '../src/fish/FishHabitat';
import { FishSimulation, stepFish } from '../src/fish/FishMovement';
import { spawnFish } from './fixtures/originalFish';
import { FISH_TIMING } from '../src/fish/FishSpecies';
import type { ConvexCollider } from '../src/player/collision';

const cube: ConvexCollider = {
  min: { x: -1, y: 2, z: -1 },
  max: { x: 1, y: 7, z: 1 },
  planes: [
    { x: 1, y: 0, z: 0, offset: 1 },
    { x: -1, y: 0, z: 0, offset: 1 },
    { x: 0, y: 1, z: 0, offset: 7 },
    { x: 0, y: -1, z: 0, offset: -2 },
    { x: 0, y: 0, z: 1, offset: 1 },
    { x: 0, y: 0, z: -1, offset: 1 },
  ],
};
const habitat: FishHabitat = { bounds: AQUARIUM, rocks: [cube] };
describe('fish steering and containment', () => {
  it('turns before a head-on rock approach and redirects without entering it', () => {
    const f = spawnFish({ bounds: AQUARIUM, rocks: [] })[0];
    Object.assign(f.position, { x: -4, y: 5, z: 0 });
    Object.assign(f.target, { x: 4, y: 5, z: 0 });
    f.targetTime = 30;
    f.yaw = 0;
    f.pitch = 0;
    f.speed = 0.6;
    let maxZ = 0;
    for (let i = 0; i < 900; i++) {
      stepFish(f, habitat, FISH_TIMING.step);
      expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
      maxZ = Math.max(maxZ, Math.abs(f.position.z));
    }
    expect(maxZ).toBeGreaterThan(1.2);
    expect(f.corrections).toBe(0);
  });
  it.each(['x', 'y', 'z'] as const)(
    'redirects away from both %s walls and escapes corners',
    (axis) => {
      for (const sign of [-1, 1]) {
        const f = spawnFish({ bounds: AQUARIUM, rocks: [] })[0],
          world = { bounds: AQUARIUM, rocks: [] };
        const edge =
          sign < 0
            ? AQUARIUM.min[axis] + f.radius
            : AQUARIUM.max[axis] - f.radius;
        f.position[axis] = edge - sign * 1.7;
        f.target[axis] = edge + sign * 3;
        f.targetTime = 15;
        if (axis === 'x') {
          f.yaw = sign > 0 ? 0 : Math.PI;
          f.pitch = 0;
        }
        if (axis === 'z') {
          f.yaw = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
          f.pitch = 0;
        }
        if (axis === 'y') f.pitch = sign * 0.35;
        for (let i = 0; i < 900; i++) {
          stepFish(f, world, FISH_TIMING.step);
          expect(safeFishPosition(f.position, f.radius, world)).toBe(true);
        }
        expect(Math.abs(f.position[axis] - edge)).toBeGreaterThan(1);
      }
    },
  );
  it('keeps a ten-minute real-aquarium simulation valid and independently moving', () => {
    const aquarium = new Aquarium();
    try {
      const world = { bounds: AQUARIUM, rocks: aquarium.rockColliders },
        sim = new FishSimulation(spawnFish(world), world);
      for (let i = 0; i < 30 * 600; i++) {
        sim.advance(1 / 30, true);
        if (i % 30 === 0)
          for (const f of sim.fish)
            expect(safeFishPosition(f.position, f.radius, world)).toBe(true);
      }
      expect(sim.fish.reduce((sum, f) => sum + f.corrections, 0)).toBe(0);
      for (const f of sim.fish) {
        expect(f.speed).toBeGreaterThan(0.02);
        expect(Number.isFinite(f.yaw)).toBe(true);
      }
    } finally {
      aquarium.dispose();
    }
  }, 30000);
  it('contains an emergency close-wall approach without teleporting', () => {
    const f = spawnFish({ bounds: AQUARIUM, rocks: [] })[0];
    f.position.x = AQUARIUM.max.x - f.radius - 0.00001;
    f.yaw = 0;
    f.pitch = 0;
    const old = { ...f.position };
    stepFish(f, { bounds: AQUARIUM, rocks: [] }, 1 / 30);
    expect(
      safeFishPosition(f.position, f.radius, { bounds: AQUARIUM, rocks: [] }),
    ).toBe(true);
    expect(
      Math.hypot(
        f.position.x - old.x,
        f.position.y - old.y,
        f.position.z - old.z,
      ),
    ).toBeLessThan(0.04);
  });
});

it('turns out of a true glass corner without repeated reversals or safety corrections', () => {
  const world = { bounds: AQUARIUM, rocks: [] },
    f = spawnFish(world)[0];
  Object.assign(f.position, { x: 15.7, y: 5, z: 11.7 });
  Object.assign(f.target, { x: 25, y: 5, z: 25 });
  f.targetTime = 30;
  f.yaw = -Math.PI / 4;
  f.pitch = 0;
  let previousSign = 0,
    reversals = 0,
    cornerSteps = 0;
  for (let i = 0; i < 600; i++) {
    const yaw = f.yaw;
    stepFish(f, world, FISH_TIMING.step);
    expect(safeFishPosition(f.position, f.radius, world)).toBe(true);
    const delta = f.yaw - yaw,
      sign = Math.abs(delta) > 0.001 ? Math.sign(delta) : 0;
    if (f.position.x > 14 && f.position.z > 10) {
      cornerSteps++;
      if (sign && previousSign && sign !== previousSign) reversals++;
      if (sign) previousSign = sign;
    }
  }
  expect(cornerSteps).toBeLessThan(300);
  expect(reversals).toBeLessThan(8);
  expect(f.corrections).toBe(0);
  expect(Math.hypot(f.position.x - 15.7, f.position.z - 11.7)).toBeGreaterThan(
    2,
  );
});
