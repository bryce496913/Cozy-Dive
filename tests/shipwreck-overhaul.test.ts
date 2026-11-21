import { describe, expect, it } from 'vitest';
import { breachOpen, hullInset } from '../src/environment/wreck/ShipwreckModel';
import { SHIP } from '../src/environment/wreck/WreckLayout';

/** V0.7 Pass 076: plated hull detail only ever carves inward; the torn breach keeps its passage. */
describe('V0.7 Pass 076 shipwreck hull', () => {
  it('insets plates, seams and dents inward only, by at most a few centimetres away from the tear', () => {
    let max = 0;
    for (let z = -60; z <= -4; z += 0.137)
      for (let y = 0; y <= 6; y += 0.091) {
        const d = hullInset(y, z);
        expect(d).toBeGreaterThanOrEqual(0);
        if (breachOpen(z, y) < -0.7) max = Math.max(max, d);
      }
    expect(max).toBeGreaterThan(0.02);
    expect(max).toBeLessThan(0.2);
  });
  it('opens the ragged breach over the whole collision opening, so the passage stays clear', () => {
    const b = SHIP.breach;
    for (let z = b.foreZ; z <= b.aftZ; z += 0.05)
      for (let y = b.low; y <= b.high; y += 0.05)
        expect(breachOpen(z, y)).toBeGreaterThan(0);
  });
  it('tears irregularly: the open margin varies around the edge', () => {
    const b = SHIP.breach,
      reach: number[] = [];
    for (let z = b.foreZ; z <= b.aftZ; z += 0.1) {
      let y = b.high;
      while (breachOpen(z, y) > 0 && y < b.high + 2) y += 0.01;
      reach.push(y - b.high);
    }
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(0.15);
  });
});
