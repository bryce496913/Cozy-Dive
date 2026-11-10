import { describe, expect, it } from 'vitest';
import { OFFICE, OFFICE_FOOTPRINTS, TANK } from '../src/config/office';
import {
  createWalkState,
  stepWalking,
  stopWalking,
  type WalkWorld,
} from '../src/player/walking';

const world: WalkWorld = {
  min: OFFICE.room.min,
  max: OFFICE.room.max,
  obstacles: OFFICE_FOOTPRINTS,
  radius: OFFICE.playerRadius,
};
const tuning = {
  speed: OFFICE.walkSpeed,
  response: OFFICE.walkResponse,
  maxFrameDelta: OFFICE.maxFrameDelta,
};
const clear = (p: { x: number; z: number }) =>
  OFFICE_FOOTPRINTS.every((b) => {
    const cx = Math.max(b.min.x, Math.min(p.x, b.max.x)),
      cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
    return Math.hypot(p.x - cx, p.z - cz) >= OFFICE.playerRadius - 1e-6;
  });

describe('Pass 020 office walking', () => {
  it('spawns clear of furniture at eye height and walks forward along -z at yaw 0', () => {
    const s = createWalkState(OFFICE.spawn);
    expect(s.position.y).toBe(OFFICE.eyeHeight);
    expect(clear(s.position)).toBe(true);
    for (let i = 0; i < 60; i++)
      stepWalking(s, { forward: 1, right: 0 }, 0, 1 / 60, tuning, world);
    expect(s.position.z).toBeLessThan(OFFICE.spawn.z - 0.5);
    expect(Math.abs(s.position.x - OFFICE.spawn.x)).toBeLessThan(1e-9);
    expect(s.position.y).toBe(OFFICE.eyeHeight);
  });
  it('turns left with positive yaw and normalises diagonal input', () => {
    const a = createWalkState({ x: 0, y: 1.6, z: 0.8 }),
      b = createWalkState({ x: 0, y: 1.6, z: 0.8 });
    for (let i = 0; i < 120; i++) {
      stepWalking(
        a,
        { forward: 1, right: 0 },
        Math.PI / 2,
        1 / 60,
        tuning,
        world,
      );
      stepWalking(b, { forward: 1, right: 1 }, 0, 1 / 60, tuning, world);
    }
    expect(a.position.x).toBeLessThan(-1);
    expect(Math.hypot(b.velocity.x, b.velocity.z)).toBeLessThanOrEqual(
      OFFICE.walkSpeed + 1e-9,
    );
  });
  it('matches across frame rates and caps long frame gaps', () => {
    const run = (fps: number) => {
      const s = createWalkState({ x: 0, y: 1.6, z: 1 });
      for (let i = 0; i < fps * 2; i++)
        stepWalking(s, { forward: 1, right: 0.4 }, 0.3, 1 / fps, tuning, world);
      return s.position;
    };
    const p30 = run(30),
      p144 = run(144);
    expect(Math.hypot(p30.x - p144.x, p30.z - p144.z)).toBeLessThan(0.02);
    const s = createWalkState({ x: 0, y: 1.6, z: 1 });
    stepWalking(s, { forward: 1, right: 0 }, 0, 5, tuning, world);
    expect(1 - s.position.z).toBeLessThan(OFFICE.walkSpeed * 0.1 + 1e-9);
  });
  it('never enters walls or furniture, sliding along them under sustained input', () => {
    for (const yaw of [0, 0.7, 1.6, 2.4, Math.PI, -0.9, -2.2]) {
      const s = createWalkState(OFFICE.spawn);
      for (let i = 0; i < 60 * 12; i++) {
        stepWalking(
          s,
          { forward: 1, right: i % 240 < 120 ? 0.3 : -0.3 },
          yaw,
          1 / 60,
          tuning,
          world,
        );
        expect(clear(s.position)).toBe(true);
        expect(s.position.x).toBeGreaterThanOrEqual(
          world.min.x + world.radius - 1e-9,
        );
        expect(s.position.x).toBeLessThanOrEqual(
          world.max.x - world.radius + 1e-9,
        );
        expect(s.position.z).toBeGreaterThanOrEqual(
          world.min.z + world.radius - 1e-9,
        );
        expect(s.position.z).toBeLessThanOrEqual(
          world.max.z - world.radius + 1e-9,
        );
      }
    }
  });
  it('comes to rest when input is released or the walk is paused', () => {
    const s = createWalkState({ x: 0, y: 1.6, z: 1 });
    for (let i = 0; i < 60; i++)
      stepWalking(s, { forward: 1, right: 0 }, 0, 1 / 60, tuning, world);
    for (let i = 0; i < 120; i++)
      stepWalking(s, { forward: 0, right: 0 }, 0, 1 / 60, tuning, world);
    expect(s.velocity.x).toBe(0);
    expect(s.velocity.z).toBe(0);
    stepWalking(s, { forward: 1, right: 0 }, 0, 1 / 60, tuning, world);
    stopWalking(s);
    expect(Math.hypot(s.velocity.x, s.velocity.z)).toBe(0);
  });
  it('lays out a tank of roughly one metre on its stand, inside the room', () => {
    expect(TANK.size.x).toBeCloseTo(1, 9);
    expect(TANK.size.y).toBeGreaterThan(0.35);
    // The tank's footprint (rotated a quarter turn) fits on the stand top and inside the walls.
    const half = { x: TANK.size.z / 2, z: TANK.size.x / 2 };
    expect(TANK.position.x - half.x).toBeGreaterThanOrEqual(
      OFFICE.stand.center.x - OFFICE.stand.size.x / 2,
    );
    expect(TANK.position.x + half.x).toBeLessThanOrEqual(OFFICE.room.max.x);
    expect(half.z * 2).toBeLessThanOrEqual(OFFICE.stand.size.z);
    expect(TANK.position.y).toBe(OFFICE.stand.size.y);
  });
});
