import { it, expect } from 'vitest';
import { AQUARIUM } from '../src/config/world';
import { clearResidentStep, type FishHabitat } from '../src/fish/FishHabitat';
import { spawnFish } from './fixtures/originalFish';
import { stepFish } from '../src/fish/FishMovement';
it('keeps swept fish personal space, allowing recovery and removing the guard with the visitor', () => {
  const h: FishHabitat = {
    bounds: AQUARIUM,
    rocks: [],
    residents: [{ position: { x: 0, y: 5, z: 0 }, radius: 0.6 }],
  };
  expect(
    clearResidentStep({ x: -2, y: 5, z: 0 }, { x: 2, y: 5, z: 0 }, 0.2, h),
  ).toBe(false);
  expect(
    clearResidentStep({ x: 0.5, y: 5, z: 0 }, { x: 0.6, y: 5, z: 0 }, 0.2, h),
  ).toBe(true);
  expect(
    clearResidentStep({ x: 0.5, y: 5, z: 0 }, { x: 0.4, y: 5, z: 0 }, 0.2, h),
  ).toBe(false);
  const f = spawnFish(h)[0];
  Object.assign(f.position, { x: -2, y: 5, z: 0 });
  Object.assign(f.target, { x: 8, y: 5, z: 0 });
  f.targetTime = 100;
  f.yaw = 0;
  f.pitch = 0;
  f.behavior.weight = 0;
  let closest = Infinity;
  for (let i = 0; i < 1200; i++) {
    stepFish(f, h, 1 / 30);
    closest = Math.min(
      closest,
      Math.hypot(f.position.x, f.position.y - 5, f.position.z),
    );
  }
  expect(closest).toBeGreaterThanOrEqual(f.radius + 0.6 + 0.2 - 1e-9);
  h.residents = undefined;
  expect(
    clearResidentStep({ x: -2, y: 5, z: 0 }, { x: 2, y: 5, z: 0 }, 0.2, h),
  ).toBe(true);
});
