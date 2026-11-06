import { describe, expect, it } from 'vitest';
import {
  PlantClock,
  sampleCurrent,
  samplePlantBend,
} from '../src/environment/PlantAnimation';
import { PLANT_SPECIES } from '../src/environment/PlantSpecies';
const vector = () => ({ x: 0, y: 0, z: 0 });
describe('underwater plant animation', () => {
  it('anchors every leaf base and increases bending toward tips', () => {
    for (const s of PLANT_SPECIES) {
      const base = samplePlantBend(4, 5, 3, 1, s.frequency, 0, vector()),
        tip = samplePlantBend(4, 5, 3, 1, s.frequency, s.sway, vector()),
        middle = samplePlantBend(
          4,
          5,
          3,
          1,
          s.frequency,
          s.sway * 0.25,
          vector(),
        );
      expect(base).toEqual(vector());
      expect(Math.hypot(tip.x, tip.z)).toBeGreaterThan(
        Math.hypot(middle.x, middle.z),
      );
      expect(Math.hypot(tip.x, tip.z)).toBeLessThan(s.sway * 1.5);
    }
  });
  it('shares low-frequency current locally with independent leaf phases', () => {
    const a = sampleCurrent(8, 4, 2, vector()),
      b = sampleCurrent(8, 4.1, 2.1, vector());
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.03);
    expect(samplePlantBend(8, 4, 2, 1, 0.6, 0.04, vector())).not.toEqual(
      samplePlantBend(8, 4, 2, 2, 0.6, 0.04, vector()),
    );
  });
  it('keeps long ribbons more flexible than compact broad leaves', () => {
    expect(PLANT_SPECIES[0].sway).toBeGreaterThan(PLANT_SPECIES[1].sway);
    expect(PLANT_SPECIES[1].sway).toBeGreaterThan(PLANT_SPECIES[3].sway);
  });
  it('freezes exactly on pause and ignores invalid time', () => {
    const c = new PlantClock();
    c.update(0.1, true, false);
    const before = { ...c };
    for (const dt of [0, -1, NaN, Infinity]) c.update(dt, true, false);
    c.update(30, false, false);
    expect(c).toEqual(before);
    c.update(1 / 60, true, false);
    expect(c.time - before.time).toBeCloseTo(1 / 60);
  });
  it('stops and resumes current phase smoothly under reduced motion, never resetting the pose', () => {
    const c = new PlantClock();
    for (let i = 0; i < 60; i++) c.update(1 / 60, true, false);
    const time = c.time;
    c.update(1 / 60, true, true);
    expect(c.time).toBeGreaterThanOrEqual(time);
    expect(c.time - time).toBeLessThan(1 / 60);
    for (let i = 0; i < 600; i++) c.update(1 / 60, true, true);
    expect(c.rate).toBe(0);
    const frozen = c.time;
    c.update(0.1, true, true);
    expect(c.time).toBe(frozen);
    c.update(1 / 60, true, false);
    expect(c.time - frozen).toBeLessThan(0.001);
  });
  it('has equivalent clocks and deformation at 30/60/120 FPS including reduced-motion transitions', () => {
    const results = [30, 60, 120].map((fps) => {
      const c = new PlantClock();
      for (let i = 0; i < fps * 12; i++)
        c.update(1 / fps, true, i >= fps * 3 && i < fps * 7);
      return c;
    });
    for (const r of results.slice(1)) {
      expect(r.time).toBeCloseTo(results[0].time, 6);
      expect(r.rate).toBeCloseTo(results[0].rate, 6);
    }
  });
});
