import { describe, expect, it } from 'vitest';
import { AQUARIUM } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import {
  updateDiverReaction,
  type PlayerPresence,
} from '../src/fish/FishDiverReaction';
import { angleDifference } from '../src/fish/FishEntity';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { FishSimulation, stepFish } from '../src/fish/FishMovement';
import { spawnFish } from './fixtures/originalFish';
import { REGRESSION_FISH_SPECIES as FISH_SPECIES } from './fixtures/regressionSpecies';
const open = { bounds: AQUARIUM, rocks: [] };
function fixture(index = 0) {
  const f = spawnFish(open, [{ ...FISH_SPECIES[index], count: 1 }])[0];
  Object.assign(f.position, { x: 0, y: 5, z: 0 });
  Object.assign(f.velocity, { x: 0, y: 0, z: 0 });
  return f;
}
function presence(distance: number, speed = 0): PlayerPresence {
  return {
    position: { x: -distance, y: 5, z: 0 },
    velocity: { x: speed, y: 0, z: 0 },
    active: true,
  };
}
describe('diver awareness, scatter and recovery', () => {
  it('leaves distant or inactive fish identical to undisturbed movement', () => {
    for (const p of [presence(20, 4), { ...presence(0.1, 4), active: false }]) {
      const a = fixture(),
        b = fixture();
      for (let i = 0; i < 300; i++) {
        stepFish(a, open, 1 / 30, undefined, p);
        stepFish(b, open, 1 / 30);
      }
      expect(a).toEqual(b);
    }
  });
  it('responds to stationary close presence, strengthens on faster approach, and has calmer gourami tuning', () => {
    const still = fixture(),
      slow = fixture(),
      fast = fixture(),
      calm = fixture(2);
    for (let i = 0; i < 30; i++) {
      updateDiverReaction(still, presence(0.5), 1 / 30);
      updateDiverReaction(slow, presence(1.6, 0.3), 1 / 30);
      updateDiverReaction(fast, presence(1.6, 3), 1 / 30);
      updateDiverReaction(calm, presence(0.5), 1 / 30);
    }
    expect(still.reaction.awareness).toBeGreaterThan(0.7);
    expect(still.reaction.scatter).toBeGreaterThan(0.5);
    expect(fast.reaction.scatter).toBeGreaterThan(slow.reaction.scatter * 2);
    expect(calm.reaction.scatter).toBeLessThan(still.reaction.scatter);
    expect(still.reaction.direction.x).toBeGreaterThan(0.7);
  });
  it('handles exact overlap finitely and recovers smoothly without a state transition', () => {
    const f = fixture();
    for (let i = 0; i < 30; i++) updateDiverReaction(f, presence(0, 3), 1 / 30);
    let last = f.reaction.scatter;
    expect(last).toBeGreaterThan(0.9);
    updateDiverReaction(f, undefined, 1 / 30);
    expect(f.reaction.scatter).toBeGreaterThan(last * 0.95);
    for (let i = 0; i < 1800; i++) {
      last = f.reaction.scatter;
      updateDiverReaction(f, undefined, 1 / 30);
      expect(f.reaction.scatter).toBeLessThanOrEqual(last);
    }
    expect(f.reaction.scatter).toBe(0);
    expect(f.reaction.awareness).toBe(0);
    expect(Object.values(f.reaction.direction).every(Number.isFinite)).toBe(
      true,
    );
  });
  it('caps escape speed, acceleration and angular change while reacting', () => {
    const f = fixture();
    for (let i = 0; i < 900; i++) {
      const speed = f.speed,
        yaw = f.yaw,
        pitch = f.pitch;
      const p = {
        ...presence(0.6, 3),
        position: { x: f.position.x - 0.6, y: f.position.y, z: f.position.z },
      };
      stepFish(f, open, 1 / 30, undefined, p);
      expect(f.speed).toBeLessThanOrEqual(
        Math.max(
          f.species.diver.escapeSpeed,
          f.species.maxSpeed * f.speedFactor,
        ) + 1e-8,
      );
      expect(Math.abs(f.speed - speed)).toBeLessThanOrEqual(
        Math.max(f.species.acceleration, f.species.diver.reactionAcceleration) /
          30 +
          1e-8,
      );
      expect(
        Math.hypot(angleDifference(f.yaw, yaw), f.pitch - pitch),
      ).toBeLessThanOrEqual(
        (f.species.turnRate * f.turnFactor * f.species.diver.turnMultiplier) /
          30 +
          1e-8,
      );
      expect(safeFishPosition(f.position, f.radius, open)).toBe(true);
    }
  });
  it('uses fixed cadence at 30/60/120 FPS and freezes all reaction clocks on pause', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(open), open),
        p = presence(2, 2);
      for (let i = 0; i < fps * 8; i++) sim.advance(1 / fps, true, p);
      const before = structuredClone(sim.fish);
      sim.advance(10, false, p);
      expect(sim.fish).toEqual(before);
      return sim.fish;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it('stays safe during repeated real-rock/glass approaches and resumes ordinary schooling', () => {
    const aquarium = new Aquarium();
    try {
      const habitat = { bounds: AQUARIUM, rocks: aquarium.rockColliders };
      const sim = new FishSimulation(spawnFish(habitat), habitat);
      let maxReaction = 0;
      for (let i = 0; i < 5400; i++) {
        const target = sim.fish[Math.floor(i / 180) % sim.fish.length];
        const p: PlayerPresence = {
          position: {
            x: target.position.x - 0.6,
            y: target.position.y,
            z: target.position.z,
          },
          velocity: { x: 2, y: 0, z: 0 },
          active: true,
        };
        sim.advance(1 / 30, true, i < 2700 ? p : undefined);
        for (const f of sim.fish) {
          expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
          maxReaction = Math.max(maxReaction, f.reaction.scatter);
        }
      }
      expect(maxReaction).toBeGreaterThan(0.8);
      expect(
        sim.fish.every(
          (f) => f.reaction.scatter === 0 && f.reaction.awareness === 0,
        ),
      ).toBe(true);
      expect(sim.fish.every((f) => f.speed > 0.02)).toBe(true);
      expect(sim.fish.reduce((s, f) => s + f.corrections, 0)).toBe(0);
    } finally {
      aquarium.dispose();
    }
  }, 20000);
  it('loosens a nearby tetra school and reconnects through ordinary local steering', () => {
    const fish = spawnFish(open, [FISH_SPECIES[0]]);
    fish.forEach((f, i) => {
      const angle = (i * Math.PI) / 4;
      Object.assign(f.position, {
        x: Math.cos(angle) * 1.4,
        y: 5,
        z: Math.sin(angle) * 1.4,
      });
      Object.assign(f.velocity, { x: 0, y: 0, z: 0 });
    });
    const sim = new FishSimulation(fish, open);
    const spread = () => {
      const cx = fish.reduce((s, f) => s + f.position.x, 0) / fish.length,
        cy = fish.reduce((s, f) => s + f.position.y, 0) / fish.length,
        cz = fish.reduce((s, f) => s + f.position.z, 0) / fish.length;
      return Math.sqrt(
        fish.reduce(
          (s, f) =>
            s +
            (f.position.x - cx) ** 2 +
            (f.position.y - cy) ** 2 +
            (f.position.z - cz) ** 2,
          0,
        ) / fish.length,
      );
    };
    const initial = spread();
    for (let i = 0; i < 120; i++)
      sim.advance(1 / 30, true, {
        position: { x: 0, y: 5, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      });
    const scattered = spread();
    for (let i = 0; i < 1200; i++) sim.advance(1 / 30, true);
    expect(scattered).toBeGreaterThan(initial * 1.3);
    expect(spread()).toBeLessThan(scattered);
    expect(fish.every((f) => f.reaction.awareness < 1e-5)).toBe(true);
  });
});
