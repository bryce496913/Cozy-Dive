import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN, SWIM_FEELS } from '../src/config/world';
import { createSwimState, integrateSwimming } from '../src/player/swimming';
import type { SwimTuning } from '../src/player/swimming';
import { AUDIO, swimmingGain } from '../src/audio/AudioTuning';

describe('audio reads the existing kick-and-glide simulation', () => {
  it.each(['relaxed', 'natural', 'responsive'] as const)(
    'follows %s propulsion, all axes, and the glide without changing state',
    (feel) => {
      const tuning: SwimTuning = { speed: 2.8, feel, reducedMotion: true };
      const space = {
        ...AQUARIUM,
        min: { ...AQUARIUM.min, y: -100 },
        max: { ...AQUARIUM.max, y: 100 },
      };
      const a = createSwimState(SPAWN),
        b = createSwimState(SPAWN);
      const values: number[] = [];
      for (let i = 0; i < 240; i++) {
        integrateSwimming(a, { x: 0, y: 0, z: -1 }, 1 / 60, tuning, space);
        integrateSwimming(b, { x: 0, y: 1, z: 0 }, 1 / 60, tuning, space);
        const before = structuredClone(a),
          value = swimmingGain(a, tuning);
        values.push(value);
        expect(a).toEqual(before);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(AUDIO.swimmingCeiling);
        expect(swimmingGain(b, tuning)).toBeCloseTo(value, 7);
      }
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.04);
      const active = values[values.length - 1];
      for (let i = 0; i < 300; i++)
        integrateSwimming(a, { x: 0, y: 0, z: 0 }, 1 / 60, tuning, space);
      expect(swimmingGain(a, tuning)).toBeLessThan(active * 0.1);
      expect(SWIM_FEELS[feel].cycle).toBeGreaterThan(0);
    },
  );
  it('ignores breathing hover and keeps low-speed swimming quieter', () => {
    const state = createSwimState(SPAWN),
      tuning: SwimTuning = { speed: 1, feel: 'natural', reducedMotion: false };
    for (let i = 0; i < 1200; i++) {
      integrateSwimming(state, { x: 0, y: 0, z: 0 }, 1 / 60, tuning, AQUARIUM);
      expect(swimmingGain(state, tuning)).toBe(0);
    }
    const slow = createSwimState(SPAWN),
      fast = createSwimState(SPAWN);
    let slowEnergy = 0,
      fastEnergy = 0;
    for (let i = 0; i < 120; i++) {
      integrateSwimming(slow, { x: 1, y: 0, z: 0 }, 1 / 60, tuning, AQUARIUM);
      integrateSwimming(
        fast,
        { x: 1, y: 0, z: 0 },
        1 / 60,
        { ...tuning, speed: 5 },
        AQUARIUM,
      );
      slowEnergy += swimmingGain(slow, tuning);
      fastEnergy += swimmingGain(fast, { ...tuning, speed: 5 });
    }
    expect(slowEnergy).toBeLessThan(fastEnergy);
    expect(swimmingGain(slow, { ...tuning, reducedMotion: true })).toBe(
      swimmingGain(slow, tuning),
    );
  });
});
