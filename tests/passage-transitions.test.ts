import { describe, expect, it } from 'vitest';
import {
  CAVE_FRAME,
  CLEFT_FRAME,
  CREVICE_FRAME,
  GROTTO_FRAME,
  ICE_FRAME,
  ICE_GATE_FRAME,
  KELP_FRAME,
  TUNNEL_FRAME,
  type PassageFrame,
} from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import {
  crossing,
  frameTurn,
  mapPoint,
  mapVector,
  type WaterWorldId,
} from '../src/player/passage';

/**
 * v0.6 Pass 050 (v0.4/v0.5 acceptance): every passage carries the swimmer's position, velocity
 * and look across exactly, never bounces them straight back, and returns them to the same place.
 */
const ready = { outer: true, kelp: true, cave: true, ice: true };
const cases: [WaterWorldId, PassageFrame, WaterWorldId][] = [
  ['aquarium', CREVICE_FRAME, 'outer'],
  ['outer', TUNNEL_FRAME, 'aquarium'],
  ['outer', CLEFT_FRAME, 'kelp'],
  ['kelp', KELP_FRAME, 'outer'],
  ['kelp', GROTTO_FRAME, 'cave'],
  ['cave', CAVE_FRAME, 'kelp'],
  ['cave', ICE_GATE_FRAME, 'ice'],
  ['ice', ICE_FRAME, 'cave'],
];

/** Swim from the threshold along ±forward until this world hands over to `target`. */
function firstCrossing(
  world: WaterWorldId,
  frame: PassageFrame,
  target: WaterWorldId,
) {
  for (const sign of [1, -1])
    for (let d = 0; d <= 3; d += 0.01) {
      const p = {
        x: frame.origin.x + sign * d * frame.forward.x,
        y: frame.origin.y,
        z: frame.origin.z + sign * d * frame.forward.z,
      };
      const c = crossing(world, p, ready);
      if (c?.target === target) return { p, c, sign };
    }
  return undefined;
}

describe('v0.4/v0.5 acceptance: every passage hands the swimmer across cleanly', () => {
  for (const [world, frame, target] of cases)
    it(`${world} → ${target}`, () => {
      const found = firstCrossing(world, frame, target);
      expect(
        found,
        `no crossing found from ${world} to ${target}`,
      ).toBeDefined();
      const { p, c, sign } = found!;
      // Crossing happens only a little past the threshold (hysteresis, not a jump).
      expect(
        Math.hypot(p.x - frame.origin.x, p.z - frame.origin.z),
      ).toBeLessThan(1);

      // Position maps across, and the reverse mapping returns the same place.
      const there: Vec3 = { x: 0, y: 0, z: 0 },
        back: Vec3 = { x: 0, y: 0, z: 0 };
      mapPoint(p, c.from, c.to, there);
      mapPoint(there, c.to, c.from, back);
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
      expect(back.z).toBeCloseTo(p.z, 9);

      // Momentum keeps its speed and climb; the look turns by exactly the frames' difference.
      const v = {
          x: 0.7 * sign * frame.forward.x,
          y: 0.2,
          z: 0.7 * sign * frame.forward.z,
        },
        mapped = mapVector(v, c.from, c.to, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(mapped.x, mapped.z)).toBeCloseTo(
        Math.hypot(v.x, v.z),
        9,
      );
      expect(mapped.y).toBe(v.y);
      const turn = frameTurn(c.from, c.to) + frameTurn(c.to, c.from);
      expect(Math.abs(Math.sin(turn))).toBeLessThan(1e-9);

      // Keep swimming the same way: never handed straight back.
      for (let t = 0; t <= 0.6; t += 0.02) {
        const ahead = {
          x: there.x + (mapped.x / 0.7) * t,
          y: there.y,
          z: there.z + (mapped.z / 0.7) * t,
        };
        expect(crossing(target, ahead, ready)?.target).not.toBe(world);
      }
    });

  it('waits for the far world: no crossing while it is not ready', () => {
    const notReady = { outer: false, kelp: false, cave: false, ice: false };
    for (const [world, frame, target] of cases) {
      if (target === 'aquarium' || (world === 'ice' && target === 'cave'))
        continue;
      if (world === 'kelp' && target === 'outer') continue;
      if (world === 'cave' && target === 'kelp') continue;
      const found = firstCrossing(world, frame, target)!;
      expect(crossing(world, found.p, notReady)?.target).not.toBe(target);
    }
  });
});
