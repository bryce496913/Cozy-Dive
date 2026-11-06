import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN, SWIMMING } from '../src/config/world';
import {
  clampToBounds,
  integrateSwimming,
  advanceHoverPreview,
  movementDirection,
  createSwimState,
  resetSwimming,
  strokeEnvelope,
  type SwimTuning,
} from '../src/player/swimming';

const tuning: SwimTuning = {
  speed: 2.8,
  feel: 'natural',
  reducedMotion: false,
};
const state = () => createSwimState({ x: 0, y: 7, z: 0 });
const direction = (forward = 0, right = 0, pitch = 0, yaw = 0) =>
  movementDirection({ forward, right }, yaw, pitch, { x: 0, y: 0, z: 0 });

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
  it('follows pitch with W/S while A/D remain horizontal', () => {
    expect(direction(1, 0, Math.PI / 6).y).toBeCloseTo(0.5);
    expect(direction(-1, 0, Math.PI / 6).y).toBeCloseTo(-0.5);
    expect(direction(1, 0, -Math.PI / 6).y).toBeCloseTo(-0.5);
    expect(direction(-1, 0, -Math.PI / 6).y).toBeCloseTo(0.5);
    expect(direction(0, 1, 1.3).y).toBe(0);
    expect(direction(0, -1, -1.3).y).toBeCloseTo(0);
    expect(Math.hypot(...Object.values(direction(0, 0, 1.3)))).toBe(0);
  });
  it('normalizes diagonals, including combined ascent and forward', () => {
    for (const d of [
      direction(1, 1),
      direction(1, 1, Math.PI / 4),
      direction(1, 1, 0.7),
    ]) {
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
    }
  });
  it('has zero direction with no input', () => {
    expect(direction()).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('water integration', () => {
  it('accelerates gradually to a reasonable rhythmic speed', () => {
    const s = state();
    integrateSwimming(s, direction(1), 1 / 60, tuning, AQUARIUM);
    expect(-s.velocity.z).toBeGreaterThan(0);
    expect(-s.velocity.z).toBeLessThan(tuning.speed);
    for (let i = 0; i < 180; i++)
      integrateSwimming(s, direction(1), 1 / 60, tuning, AQUARIUM);
    expect(-s.velocity.z).toBeGreaterThan(1.5);
    expect(-s.velocity.z).toBeLessThan(4.5);
  });
  it('retains momentum and decays naturally with no input', () => {
    const s = state();
    s.velocity.x = 2;
    integrateSwimming(s, direction(), 0.1, tuning, AQUARIUM);
    expect(s.velocity.x).toBeCloseTo(2 * Math.exp(-1.1 * 0.1));
    expect(s.position.x).toBeGreaterThan(0);
    expect(s.velocity.x).toBeGreaterThan(0);
  });
  it('gives equivalent position and velocity at 30, 60 and 120 Hz', () => {
    const results = [30, 60, 120].map((fps) => {
      const s = state();
      for (let i = 0; i < fps * 2; i++)
        integrateSwimming(s, direction(1), 1 / fps, tuning, AQUARIUM);
      for (let i = 0; i < fps; i++)
        integrateSwimming(s, direction(), 1 / fps, tuning, AQUARIUM);
      return s;
    });
    for (const s of results.slice(1)) {
      expect(s.position.z).toBeCloseTo(results[0].position.z, 5);
      expect(s.velocity.z).toBeCloseTo(results[0].velocity.z, 5);
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
      { ...tuning, speed: 5, feel: 'responsive' },
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
      direction(1, 0, -Math.PI / 2),
      direction(1, 0, Math.PI / 2),
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

const openWater = {
  min: { x: -10000, y: -10000, z: -10000 },
  max: { x: 10000, y: 10000, z: 10000 },
  clearance: 0.65,
};
function simulate(
  s: ReturnType<typeof state>,
  seconds: number,
  d = direction(),
  settings = tuning,
  fps = 60,
  bounds = openWater,
): void {
  for (let i = 0; i < Math.round(seconds * fps); i++)
    integrateSwimming(s, d, 1 / fps, settings, bounds);
}
describe('natural swimming', () => {
  it('has a smooth active stroke and a distinct passive phase', () => {
    expect(strokeEnvelope(0, 0.45)).toBe(0);
    expect(strokeEnvelope(0.225, 0.45)).toBeCloseTo(1);
    expect(strokeEnvelope(0.45, 0.45)).toBe(0);
    expect(strokeEnvelope(0.8, 0.45)).toBe(0);
    expect(strokeEnvelope(1.225, 0.45)).toBeCloseTo(1);
    expect(strokeEnvelope(0.0001, 0.45)).toBeLessThan(0.000001);
    expect(strokeEnvelope(0.4499, 0.45)).toBeLessThan(0.000001);
  });
  it('repeats kicks with recognizable glides and never stops between strokes', () => {
    const s = state();
    simulate(s, 4, direction(1));
    let min = Infinity,
      max = 0,
      maxChange = 0;
    for (let i = 0; i < 132; i++) {
      const previous = -s.velocity.z;
      integrateSwimming(s, direction(1), 1 / 120, tuning, openWater);
      const speed = -s.velocity.z;
      min = Math.min(min, speed);
      max = Math.max(max, speed);
      maxChange = Math.max(maxChange, Math.abs(speed - previous));
    }
    expect(min).toBeGreaterThan(1.5);
    expect(max - min).toBeGreaterThan(0.5);
    expect(maxChange).toBeLessThan(0.12);
    expect(s.strokeTime).toBeCloseTo(0.7, 5);
  });
  it('coasts on release, settles residual velocity, and reverses with weight', () => {
    const s = state();
    simulate(s, 2, direction(1));
    const speed = -s.velocity.z;
    simulate(s, 1 / 60, direction(-1));
    expect(-s.velocity.z).toBeGreaterThan(0);
    expect(Math.abs(-s.velocity.z - speed)).toBeLessThan(0.2);
    simulate(s, 3, direction(-1));
    expect(s.velocity.z).toBeGreaterThan(1);
    const before = s.position.z;
    simulate(s, 0.5);
    expect(s.position.z).toBeGreaterThan(before);
    expect(s.velocity.z).toBeGreaterThan(0);
    expect(s.thrust.z).toBe(0);
    simulate(s, 10);
    expect(s.velocity.z).toBe(0);
  });
  it.each([30, 60, 120])(
    'keeps breathing bounded without cumulative drift for ten minutes at %s Hz',
    (fps) => {
      const s = state();
      let min = 7,
        max = 7;
      for (let i = 0; i < fps * 600; i++) {
        integrateSwimming(s, direction(), 1 / fps, tuning, AQUARIUM);
        min = Math.min(min, s.position.y);
        max = Math.max(max, s.position.y);
      }
      expect(max - min).toBeGreaterThan(0.12);
      expect(max - min).toBeLessThan(0.15);
      const y = s.position.y;
      simulate(s, 5, direction(), tuning, fps, AQUARIUM);
      expect(s.position.y).toBeCloseTo(y, 5);
      expect(s.neutralDepth).toBe(7);
    },
    30000,
  );
  it('matches long mixed swimming and breathing simulations across frame rates', () => {
    const results = [30, 60, 120].map((fps) => {
      const s = state();
      simulate(s, 4, direction(1, 1, Math.PI / 4), tuning, fps);
      simulate(s, 3, direction(-1, -1, Math.PI / 4), tuning, fps);
      simulate(s, 60, direction(), tuning, fps);
      return s;
    });
    for (const s of results.slice(1))
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(s.position[axis]).toBeCloseTo(results[0].position[axis], 4);
        expect(s.velocity[axis]).toBeCloseTo(results[0].velocity[axis], 4);
      }
  });
  it.each([1, -1])(
    'updates hovering depth during intentional vertical movement (%s)',
    (up) => {
      const s = state();
      simulate(s, 2, direction(1, 0, (up * Math.PI) / 2));
      const released = s.position.y,
        target = s.neutralDepth;
      expect((released - 7) * up).toBeGreaterThan(2);
      simulate(s, 20);
      expect(Math.abs(s.position.y - target)).toBeLessThan(0.05);
      expect((s.position.y - released) * up).toBeGreaterThan(0);
    },
  );
  it('suppresses breathing while intentionally changing depth', () => {
    const a = state(),
      b = state();
    simulate(a, 2, direction(1, 0, Math.PI / 4));
    simulate(b, 2, direction(1, 0, Math.PI / 4), {
      ...tuning,
      reducedMotion: true,
    });
    expect(a.position).toEqual(b.position);
    expect(a.velocity).toEqual(b.velocity);
  });
  it('reduced motion keeps propulsion but removes breathing and visual feedback', () => {
    const s = state();
    simulate(s, 30, direction(), { ...tuning, reducedMotion: true });
    expect(s.position.y).toBe(7);
    simulate(s, 3, direction(1), { ...tuning, reducedMotion: true });
    expect(-s.velocity.z).toBeGreaterThan(1);
    expect(s.bodyPitch).toBe(0);
  });
  it.each([0.65, 0.66, 13.34, 13.35])(
    'breathes safely near vertical boundary %s without repeated contact',
    (y) => {
      const s = createSwimState({ x: 17.35, y, z: -13.35 });
      simulate(s, 60, direction(), tuning, 60, AQUARIUM);
      expect(Math.abs(s.position.y - y)).toBeLessThan(0.01);
      expect(s.position.y).toBeGreaterThanOrEqual(0.65);
      expect(s.position.y).toBeLessThanOrEqual(13.35);
    },
  );
  it('constrains repeated combined strokes and permits smooth escape from walls', () => {
    const s = state();
    simulate(s, 60, direction(1, 1, Math.PI / 4), tuning, 60, AQUARIUM);
    expect(s.position.x).toBe(17.35);
    expect(s.position.z).toBe(-13.35);
    expect(s.position.y).toBe(13.35);
    expect(s.velocity).toEqual({ x: 0, y: 0, z: 0 });
    simulate(s, 2, direction(-1, -1, Math.PI / 4), tuning, 60, AQUARIUM);
    expect(s.position.x).toBeLessThan(17);
    expect(s.position.z).toBeGreaterThan(-13);
    expect(s.position.y).toBeLessThan(13);
  });
  it('resets rhythms, forces, and momentum on pause and resumes gently at a boundary', () => {
    const s = state();
    simulate(s, 20, direction(1, 0, Math.PI / 4), tuning, 60, AQUARIUM);
    const position = { ...s.position };
    const bodyPitch = s.bodyPitch;
    const breathingTime = s.breathingTime;
    resetSwimming(s);
    expect(s.position).toEqual(position);
    expect(s.neutralDepth).toBe(position.y);
    expect(s.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(s.thrust).toEqual({ x: 0, y: 0, z: 0 });
    expect(s.breathingTime).toBe(breathingTime);
    expect(s.strokeTime).toBe(0);
    expect(s.bodyPitch).toBe(bodyPitch);
    integrateSwimming(s, direction(), 0, tuning, AQUARIUM);
    expect(s.position).toEqual(position);
    simulate(s, 1 / 60, direction(), tuning, 60, AQUARIUM);
    expect(Math.abs(s.position.y - position.y)).toBeLessThan(0.0001);
  });
  it.each(['relaxed', 'natural', 'responsive'] as const)(
    'keeps the %s preset usable and stable',
    (feel) => {
      const s = state();
      simulate(s, 20, direction(1), { ...tuning, feel });
      expect(-s.velocity.z).toBeGreaterThan(1);
      expect(-s.velocity.z).toBeLessThan(5);
      expect(Math.abs(s.position.y - 7)).toBeLessThan(0.075);
    },
  );
});

describe('initial and resting breathing', () => {
  it.each([30, 60, 120])(
    'has a visible, gentle Natural breath at %s FPS',
    (fps) => {
      const s = state();
      simulate(s, 30, direction(), tuning, fps);
      let min = Infinity,
        max = -Infinity,
        fastest = 0;
      for (let i = 0; i < fps * 10; i++) {
        integrateSwimming(s, direction(), 1 / fps, tuning, AQUARIUM);
        min = Math.min(min, s.position.y);
        max = Math.max(max, s.position.y);
        fastest = Math.max(fastest, Math.abs(s.velocity.y));
      }
      expect(max - min).toBeGreaterThan(0.12);
      expect(max - min).toBeLessThan(0.15);
      expect((min + max) / 2).toBeCloseTo(s.neutralDepth, 5);
      expect(fastest).toBeLessThan(0.1);
    },
  );
  it('keeps preset breathing strength ordered without changing the five-second cycle', () => {
    const amplitudes = (['responsive', 'relaxed', 'natural'] as const).map(
      (feel) => {
        const settings = { ...tuning, feel };
        const s = state();
        simulate(s, 30, direction(), settings);
        let min = Infinity,
          max = -Infinity;
        for (let i = 0; i < 600; i++) {
          integrateSwimming(s, direction(), 1 / 60, settings, AQUARIUM);
          min = Math.min(min, s.position.y);
          max = Math.max(max, s.position.y);
        }
        expect(s.breathingTime).toBeCloseTo(SWIMMING.breathingCycle / 4, 5);
        return max - min;
      },
    );
    expect(amplitudes[0]).toBeLessThan(amplitudes[1]);
    expect(amplitudes[1]).toBeLessThan(amplitudes[2]);
  });
  it.each([30, 60, 120])(
    'transitions from intentional descent to hovering continuously at %s FPS',
    (fps) => {
      const s = state();
      simulate(s, 1, direction(1, 0, -Math.PI / 4), tuning, fps);
      const neutral = s.neutralDepth;
      let previousY = s.position.y,
        previousVelocity = s.velocity.y;
      for (let i = 0; i < fps * 30; i++) {
        integrateSwimming(s, direction(), 1 / fps, tuning, AQUARIUM);
        expect(Math.abs(s.position.y - previousY)).toBeLessThan(0.065);
        expect(Math.abs(s.velocity.y - previousVelocity)).toBeLessThan(0.15);
        previousY = s.position.y;
        previousVelocity = s.velocity.y;
      }
      expect(s.neutralDepth).toBeCloseTo(neutral, 6);
      expect(Math.abs(s.position.y - neutral)).toBeLessThan(0.075);
    },
  );
});

describe('coherent camera-directed three-dimensional propulsion', () => {
  it.each([0.35, 1.2, Math.PI / 2 - 0.00001, Math.PI / 2])(
    'uses the same stroke and average speed at pitch %s',
    (pitch) => {
      const level = state(),
        pitched = state(),
        settings = { ...tuning, reducedMotion: true };
      simulate(level, 3, direction(1), settings);
      simulate(pitched, 3, direction(1, 0, pitch), settings);
      expect(
        Math.hypot(pitched.velocity.x, pitched.velocity.y, pitched.velocity.z),
      ).toBeCloseTo(-level.velocity.z, 7);
      expect(pitched.velocity.y).toBeCloseTo(
        -level.velocity.z * Math.sin(pitch),
        7,
      );
      expect(pitched.position.y - 7).toBeCloseTo(
        -level.position.z * Math.sin(pitch),
        7,
      );
      expect(pitched.strokeTime).toBeCloseTo(level.strokeTime, 7);
    },
  );
  it('has recognizable vertical kicks/glides, coasting, and gradual reversal', () => {
    const s = state(),
      d = direction(1, 0, Math.PI / 2);
    simulate(s, 4, d);
    let min = Infinity,
      max = 0,
      change = 0;
    for (let i = 0; i < 132; i++) {
      const v = s.velocity.y;
      integrateSwimming(s, d, 1 / 120, tuning, openWater);
      min = Math.min(min, s.velocity.y);
      max = Math.max(max, s.velocity.y);
      change = Math.max(change, Math.abs(s.velocity.y - v));
    }
    expect(min).toBeGreaterThan(1.5);
    expect(max - min).toBeGreaterThan(0.5);
    expect(change).toBeLessThan(0.12);
    const released = s.position.y,
      v = s.velocity.y;
    simulate(s, 0.1);
    expect(s.position.y).toBeGreaterThan(released);
    expect(s.velocity.y).toBeLessThan(v);
    expect(s.velocity.y).toBeGreaterThan(0);
    simulate(s, 1 / 60, direction(-1, 0, Math.PI / 2));
    expect(s.velocity.y).toBeGreaterThan(0);
    simulate(s, 3, direction(-1, 0, Math.PI / 2));
    expect(s.velocity.y).toBeLessThan(-1);
  });
  it.each([30, 60, 120])(
    'settles at the coasting depth and resumes bounded breathing at %s FPS',
    (fps) => {
      const s = state();
      simulate(s, 2, direction(1, 0, 0.7), tuning, fps);
      const release = s.position.y,
        target = s.neutralDepth;
      simulate(s, 30, direction(), tuning, fps);
      expect(s.position.y).toBeGreaterThan(release);
      expect(s.neutralDepth).toBeCloseTo(target, 6);
      expect(s.depthChanging).toBe(false);
      expect(s.breathBlend).toBeGreaterThan(0.99);
      expect(Math.abs(s.position.y - target)).toBeLessThan(0.075);
    },
  );
  it('starts preview breathing promptly, preserves hover on entry, and freezes the same state on pause', () => {
    const s = state();
    for (let i = 0; i < 30; i++)
      advanceHoverPreview(s, 1 / 60, tuning, AQUARIUM);
    expect(s.position.y - 7).toBeGreaterThan(0.01);
    expect(s.position.x).toBe(0);
    expect(s.position.z).toBe(0);
    expect(s.moving).toBe(false);
    const before = structuredClone(s);
    resetSwimming(s);
    expect(s.position).toEqual(before.position);
    expect(s.velocity.y).toBe(before.velocity.y);
    expect(s.breathingTime).toBe(before.breathingTime);
    expect(s.neutralDepth).toBe(before.neutralDepth);
    integrateSwimming(s, direction(), 0, tuning, AQUARIUM);
    expect(s.position).toEqual(before.position);
    integrateSwimming(s, direction(), 1 / 60, tuning, AQUARIUM);
    expect(Math.abs(s.position.y - before.position.y)).toBeLessThan(0.002);
  });
  it('does not shift the neutral depth across repeated resting pauses', () => {
    const s = state();
    for (let cycle = 0; cycle < 60; cycle++) {
      simulate(s, 0.7, direction(), tuning, 60, AQUARIUM);
      resetSwimming(s);
    }
    expect(s.neutralDepth).toBe(7);
    expect(Math.abs(s.position.y - 7)).toBeLessThan(0.075);
  });
  it('suppresses preview breathing with reduced motion while preserving pitched propulsion', () => {
    const s = state(),
      settings = { ...tuning, reducedMotion: true };
    for (let i = 0; i < 300; i++)
      advanceHoverPreview(s, 1 / 60, settings, AQUARIUM);
    expect(s.position.y).toBe(7);
    simulate(s, 2, direction(1, 0, 0.8), settings);
    expect(s.position.y).toBeGreaterThan(8);
  });
});
