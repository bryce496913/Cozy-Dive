import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN, SWIMMING } from '../src/config/world';
import {
  clampToBounds,
  integrateSwimming,
  movementDirection,
  type SwimState,
} from '../src/player/swimming';

const tuning = { speed: 2.8, acceleration: 2.4, damping: 1.7 };
const state = (): SwimState => ({
  position: { x: 0, y: 7, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
});
const direction = (forward = 0, right = 0, up = 0, yaw = 0, pitch = 0) =>
  movementDirection({ forward, right, up }, yaw, pitch, { x: 0, y: 0, z: 0 });

describe('camera-relative swimming directions', () => {
  it('moves forward toward -Z and backward toward +Z', () => {
    expect(direction(1)).toEqual({ x: 0, y: 0, z: -1 });
    expect(direction(-1).z).toBe(1);
  });
  it('strafes right and left without reversing camera yaw', () => {
    expect(direction(0, 1).x).toBe(1);
    expect(direction(0, -1).x).toBe(-1);
    expect(direction(1, 0, 0, Math.PI / 2).x).toBeCloseTo(-1);
    expect(direction(0, 1, 0, Math.PI / 2).z).toBeCloseTo(-1);
  });
  it('follows pitch while vertical controls remain world aligned', () => {
    expect(direction(1, 0, 0, 0, Math.PI / 6).y).toBeCloseTo(0.5);
    const vertical = direction(0, 0, 1, 1, 0.5);
    expect(vertical.x).toBeCloseTo(0);
    expect(vertical.y).toBe(1);
    expect(vertical.z).toBeCloseTo(0);
    expect(direction(0, 0, -1).y).toBe(-1);
  });
  it('normalizes diagonals, including combined ascent and forward', () => {
    for (const d of [
      direction(1, 1),
      direction(1, 1, 1),
      direction(1, 0, 1, 0, 0.7),
    ]) {
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
    }
  });
  it('has zero direction with no input', () => {
    expect(direction()).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('water integration', () => {
  it('accelerates gradually toward configured speed', () => {
    const s = state();
    integrateSwimming(s, direction(1), 1 / 60, tuning, AQUARIUM);
    expect(-s.velocity.z).toBeGreaterThan(0);
    expect(-s.velocity.z).toBeLessThan(tuning.speed);
    for (let i = 0; i < 180; i++)
      integrateSwimming(s, direction(1), 1 / 60, tuning, AQUARIUM);
    expect(-s.velocity.z).toBeCloseTo(tuning.speed, 2);
  });
  it('retains momentum and decays naturally with no input', () => {
    const s = state();
    s.velocity.x = 2;
    integrateSwimming(s, direction(), 0.1, tuning, AQUARIUM);
    expect(s.velocity.x).toBeCloseTo(2 * Math.exp(-tuning.damping * 0.1));
    expect(s.position.x).toBeGreaterThan(0);
    expect(s.velocity.x).toBeGreaterThan(0);
  });
  it('gives equivalent position and velocity at 30, 60 and 144 Hz', () => {
    const results = [30, 60, 144].map((fps) => {
      const s = state();
      for (let i = 0; i < fps * 2; i++)
        integrateSwimming(s, direction(1), 1 / fps, tuning, AQUARIUM);
      for (let i = 0; i < fps; i++)
        integrateSwimming(s, direction(), 1 / fps, tuning, AQUARIUM);
      return s;
    });
    for (const s of results.slice(1)) {
      expect(s.position.z).toBeCloseTo(results[0].position.z, 9);
      expect(s.velocity.z).toBeCloseTo(results[0].velocity.z, 9);
    }
  });
  it('caps large frame gaps instead of teleporting', () => {
    const a = state(),
      b = state();
    integrateSwimming(a, direction(1), 10, tuning, AQUARIUM);
    integrateSwimming(
      b,
      direction(1),
      SWIMMING.maxFrameDelta,
      tuning,
      AQUARIUM,
    );
    expect(a).toEqual(b);
  });
  it('ignores invalid and nonpositive deltas', () => {
    const s = state(),
      original = state();
    for (const dt of [0, -1, NaN, Infinity])
      integrateSwimming(s, direction(1), dt, tuning, AQUARIUM);
    expect(s).toEqual(original);
  });
  it('applies speed and acceleration tuning', () => {
    const a = state(),
      b = state();
    integrateSwimming(a, direction(1), 0.1, tuning, AQUARIUM);
    integrateSwimming(
      b,
      direction(1),
      0.1,
      { ...tuning, speed: 5, acceleration: 4 },
      AQUARIUM,
    );
    expect(-b.velocity.z).toBeGreaterThan(-a.velocity.z);
  });
});

describe('aquarium safety', () => {
  it('keeps spawn unchanged and above the highest seabed ripple', () => {
    const s = { position: { ...SPAWN }, velocity: { x: 0, y: 0, z: 0 } };
    clampToBounds(s, AQUARIUM);
    expect(s.position).toEqual(SPAWN);
    expect(SPAWN.y).toBeGreaterThan(AQUARIUM.clearance + 0.06);
  });
  it.each(['x', 'y', 'z'] as const)(
    'clamps both %s boundaries and cancels only outward velocity',
    (axis) => {
      const s = state();
      s.position[axis] = -100;
      s.velocity[axis] = -5;
      clampToBounds(s, AQUARIUM);
      expect(s.position[axis]).toBe(AQUARIUM.min[axis] + AQUARIUM.clearance);
      expect(s.velocity[axis]).toBe(0);
      s.position[axis] = 100;
      s.velocity[axis] = 5;
      clampToBounds(s, AQUARIUM);
      expect(s.position[axis]).toBe(AQUARIUM.max[axis] - AQUARIUM.clearance);
      expect(s.velocity[axis]).toBe(0);
      s.velocity[axis] = -1;
      clampToBounds(s, AQUARIUM);
      expect(s.velocity[axis]).toBe(-1);
    },
  );
  it('cannot swim through the floor, surface or side walls under sustained input', () => {
    for (const d of [
      direction(0, 0, -1),
      direction(0, 0, 1),
      direction(0, 1),
      direction(1),
    ]) {
      const s = state();
      for (let i = 0; i < 1200; i++)
        integrateSwimming(s, d, 1 / 30, tuning, AQUARIUM);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(s.position[axis]).toBeGreaterThanOrEqual(
          AQUARIUM.min[axis] + AQUARIUM.clearance,
        );
        expect(s.position[axis]).toBeLessThanOrEqual(
          AQUARIUM.max[axis] - AQUARIUM.clearance,
        );
      }
    }
  });
});
