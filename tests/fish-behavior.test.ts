import { describe, expect, it } from 'vitest';
import { AQUARIUM, COLLISION } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import {
  canObserveDiver,
  selectBehaviorTarget,
  updateFishBehavior,
} from '../src/fish/FishBehavior';
import type { FishActivity } from '../src/fish/FishBehaviorTypes';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';
import { angleDifference, type FishEntity } from '../src/fish/FishEntity';
import {
  clearFishRoute,
  safeFishPosition,
  type FishHabitat,
} from '../src/fish/FishHabitat';
import { FishSimulation, stepFish } from '../src/fish/FishMovement';
import { spawnFish } from './fixtures/originalFish';
import { ORIGINAL_FISH_SPECIES as FISH_SPECIES } from '../src/fish/FishSpecies';
import { FishSystem } from './fixtures/originalFish';

const open: FishHabitat = {
  bounds: AQUARIUM,
  rocks: [],
  interests: [
    {
      kind: 'plant',
      position: { x: 2, y: 5, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
    },
  ],
};
function fixture(index = 2): FishEntity {
  const f = spawnFish(open, [{ ...FISH_SPECIES[index], count: 1 }])[0];
  Object.assign(f.position, { x: 0, y: 6, z: 0 });
  Object.assign(f.previousPosition, f.position);
  Object.assign(f.target, { x: 8, y: 6, z: 0 });
  f.targetTime = 100;
  f.yaw = 0;
  f.pitch = 0;
  f.speed = f.species.speed;
  Object.assign(f.velocity, { x: f.speed, y: 0, z: 0 });
  return f;
}
function force(f: FishEntity, activity: FishActivity, duration = 15): void {
  Object.assign(f.behavior, {
    activity,
    elapsed: 0,
    duration,
    arrived: false,
    arrivedTime: 0,
    progressTime: 0,
    bestDistance: Infinity,
  });
  Object.assign(f.behavior.target, f.position);
}
function diver(f: FishEntity, gap: number, speed = 0): PlayerPresence {
  return {
    position: {
      x: f.position.x + f.radius + COLLISION.playerRadius + gap,
      y: f.position.y,
      z: f.position.z,
    },
    velocity: { x: -speed, y: 0, z: 0 },
    active: true,
  };
}
describe('individual behavior scheduling', () => {
  it('initializes independent reproducible traits and quiet, varied cruise intervals without altering the wandering stream', () => {
    const a = spawnFish(open),
      b = spawnFish(open);
    expect(a).toEqual(b);
    expect(a).toHaveLength(16);
    expect(new Set(a.map((f) => f.behavior.duration)).size).toBe(16);
    expect(new Set(a.map((f) => f.behavior.restPreference)).size).toBe(16);
    for (const f of a) {
      expect(f.behavior.activity).toBe('cruising');
      expect(f.behavior.duration).toBeGreaterThan(15);
      expect(f.behavior.duration).toBeLessThan(80);
      const seed = f.randomState;
      f.behavior.elapsed = f.behavior.duration;
      updateFishBehavior(f, open, 1 / 30);
      expect(f.randomState).toBe(seed);
    }
  });
  it('ignores invalid behavior deltas and freezes every intention while paused', () => {
    const f = fixture(),
      before = structuredClone(f);
    for (const dt of [0, -1, NaN, Infinity]) updateFishBehavior(f, open, dt);
    expect(f).toEqual(before);
    const sim = new FishSimulation([f], open);
    sim.advance(2, false);
    expect(f).toEqual(before);
  });
  it('keeps seeded long schedules identical at 30, 60, and 120 FPS and under reversed update order', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(open), open);
      for (let i = 0; i < fps * 150; i++) sim.advance(1 / fps, true);
      return sim.fish;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    const sim = new FishSimulation(spawnFish(open).reverse(), open);
    for (let i = 0; i < 30 * 150; i++) sim.advance(1 / 30, true);
    expect([...sim.fish].reverse()).toEqual(results[0]);
  });
  it('configures active/social tetras, occasional rasbora rests and calmer observant gouramis', () => {
    const [t, r, g] = FISH_SPECIES.map((s) => s.behavior);
    expect(t.interval[0]).toBeGreaterThan(g.interval[0]);
    expect(t.weights[1]).toBeLessThan(r.weights[1]);
    expect(r.weights[1]).toBeLessThan(g.weights[1]);
    expect(t.weights[3]).toBeLessThan(r.weights[3]);
    expect(r.weights[3]).toBeLessThan(g.weights[3]);
    expect(g.restDuration[0]).toBeGreaterThan(r.restDuration[0]);
    expect(t.socialRetention).toBeGreaterThan(r.socialRetention);
  });
});
describe('rest, exploration and foraging intentions', () => {
  it('slows resting gradually, hovers locally with moving fins, then exits safely', () => {
    const system = new FishSystem(open, [{ ...FISH_SPECIES[2], count: 1 }]);
    try {
      const f = system.simulation.fish[0];
      force(f, 'resting', 12);
      const origin = { ...f.position },
        initial = f.speed,
        phase = f.phase;
      system.update(1 / 30, true, false);
      expect(f.speed).toBeLessThan(initial);
      expect(f.speed).toBeGreaterThan(
        initial - f.species.acceleration / 30 - 1e-8,
      );
      for (let i = 0; i < 180; i++) system.update(1 / 30, true, false);
      expect(f.speed).toBeLessThan(initial * 0.4);
      expect(
        Math.hypot(
          f.position.x - origin.x,
          f.position.y - origin.y,
          f.position.z - origin.z,
        ),
      ).toBeLessThan(1.5);
      const tail = system.visuals[0].tail.rotation.y,
        fin = system.visuals[0].leftPectoral.rotation.y;
      for (let i = 0; i < 15; i++) system.update(1 / 30, true, false);
      expect(system.visuals[0].tail.rotation.y).not.toBe(tail);
      expect(system.visuals[0].leftPectoral.rotation.y).not.toBe(fin);
      expect(f.phase).not.toBe(phase);
      for (let i = 0; i < 210; i++) system.update(1 / 30, true, false);
      expect(f.behavior.activity).toBe('cruising');
      expect(safeFishPosition(f.position, f.radius, open)).toBe(true);
    } finally {
      system.dispose();
    }
  });
  it('selects safe surface offsets and rejects a route through solid scenery', () => {
    const f = fixture();
    for (let i = 0; i < 40; i++) {
      expect(selectBehaviorTarget(f, open, true)).toBe(true);
      expect(safeFishPosition(f.behavior.target, f.radius, open)).toBe(true);
      expect(f.behavior.target.y).toBeCloseTo(5 + f.radius + 0.45);
    }
    const aquarium = new Aquarium();
    try {
      const h = aquarium.fish.simulation.habitat;
      const rock = h.rocks[0],
        center = {
          x: (rock.min.x + rock.max.x) / 2,
          y: (rock.min.y + rock.max.y) / 2,
          z: (rock.min.z + rock.max.z) / 2,
        };
      expect(
        clearFishRoute(
          { ...center, x: rock.min.x - 2 },
          { ...center, x: rock.max.x + 2 },
          f.radius,
          h,
        ),
      ).toBe(false);
      expect(
        selectBehaviorTarget(
          f,
          {
            ...open,
            interests: [
              {
                kind: 'plant',
                position: { x: 99, y: 99, z: 99 },
                normal: { x: 0, y: 1, z: 0 },
              },
            ],
          },
          true,
        ),
      ).toBe(false);
      expect(h.interests?.filter((p) => p.kind === 'plant')).toHaveLength(65);
      expect(h.interests?.filter((p) => p.kind === 'rock-edge')).toHaveLength(
        102,
      );
    } finally {
      aquarium.dispose();
    }
  });
  it('reaches a suitable region through normal locomotion rather than target snapping', () => {
    const f = fixture();
    force(f, 'exploring', 24);
    Object.assign(f.behavior.target, { x: 2, y: 6, z: 0 });
    let arrived = false;
    for (let i = 0; i < 700; i++) {
      const before = { ...f.position };
      stepFish(f, open, 1 / 30);
      expect(
        Math.hypot(
          f.position.x - before.x,
          f.position.y - before.y,
          f.position.z - before.z,
        ),
      ).toBeLessThan((f.species.maxSpeed * f.speedFactor) / 30 + 1e-8);
      arrived ||= f.behavior.arrived;
      expect(safeFishPosition(f.position, f.radius, open)).toBe(true);
    }
    expect(arrived).toBe(true);
    expect(f.behavior.activity).toBe('cruising');
  });
  it('abandons invalid or stalled targets instead of repeatedly forcing them', () => {
    const f = fixture();
    force(f, 'exploring');
    Object.assign(f.behavior.target, { x: 99, y: 6, z: 0 });
    updateFishBehavior(f, open, 1 / 30);
    expect(f.behavior.activity).toBe('cruising');
    force(f, 'exploring', 24);
    f.behavior.target.x += 3;
    for (let i = 0; i < 220; i++) updateFishBehavior(f, open, 1 / 30);
    expect(f.behavior.activity).toBe('cruising');
  });
  it('makes only restrained, finite inspection dips and completes foraging', () => {
    const f = fixture();
    force(f, 'foraging', 20);
    f.behavior.arrived = true;
    let min = 0,
      maxStep = 0,
      previous = 0;
    for (let i = 0; i < 180; i++) {
      updateFishBehavior(f, open, 1 / 30);
      min = Math.min(min, f.behavior.gesture);
      maxStep = Math.max(maxStep, Math.abs(f.behavior.gesture - previous));
      previous = f.behavior.gesture;
      expect(Number.isFinite(previous)).toBe(true);
    }
    expect(min).toBeLessThan(-0.02);
    expect(min).toBeGreaterThan(-0.071);
    expect(maxStep).toBeLessThan(0.005);
    expect(f.behavior.activity).toBe('cruising');
  });
  it('suppresses optional inspection pose with reduced motion while essential fins continue', () => {
    const system = new FishSystem(open, [{ ...FISH_SPECIES[2], count: 1 }]);
    try {
      const f = system.simulation.fish[0];
      force(f, 'foraging', 20);
      f.behavior.arrived = true;
      for (let i = 0; i < 30; i++) system.update(1 / 30, true, false);
      const normal = system.visuals[0].root.rotation.z;
      system.update(0, false, true);
      expect(system.visuals[0].root.rotation.z).not.toBe(normal);
      const fin = system.visuals[0].leftPectoral.rotation.y;
      for (let i = 0; i < 10; i++) system.update(1 / 30, true, true);
      expect(system.visuals[0].leftPectoral.rotation.y).not.toBe(fin);
    } finally {
      system.dispose();
    }
  });
});
describe('curiosity and individual caution', () => {
  it('allows only calm, sufficiently distant observation without ignoring recent fear', () => {
    const f = fixture(),
      p = diver(f, 4);
    expect(canObserveDiver(f, p)).toBe(true);
    expect(canObserveDiver(f, diver(f, 1))).toBe(false);
    expect(canObserveDiver(f, diver(f, 4, 2))).toBe(false);
    expect(canObserveDiver(f, { ...p, active: false })).toBe(false);
    f.reaction.scatter = 0.1;
    expect(canObserveDiver(f, p)).toBe(false);
    f.reaction.scatter = 0;
    f.behavior.cooldown = 10;
    expect(canObserveDiver(f, p)).toBe(false);
  });
  it('orients a curious fish without pursuing the diver into its personal space', () => {
    const f = fixture();
    force(f, 'observing', 8);
    f.yaw = Math.PI;
    const p = diver(f, 4);
    const startGap = p.position.x - f.position.x;
    for (let i = 0; i < 210; i++) stepFish(f, open, 1 / 30, undefined, p);
    expect(
      Math.abs(
        angleDifference(
          f.yaw,
          Math.atan2(
            -(p.position.z - f.position.z),
            p.position.x - f.position.x,
          ),
        ),
      ),
    ).toBeLessThan(0.05);
    expect(p.position.x - f.position.x).toBeGreaterThan(
      f.radius + COLLISION.playerRadius + f.species.diver.awarenessRadius,
    );
    expect(p.position.x - f.position.x).toBeGreaterThan(startGap - 0.5);
  });
  it.each(['resting', 'foraging', 'observing', 'exploring'] as const)(
    'interrupts %s with the existing scatter signal and recovers without rapid oscillation',
    (activity) => {
      const f = fixture();
      force(f, activity, 20);
      const p = diver(f, 0.1, 3);
      let transitions = 0,
        last = f.behavior.activity;
      for (let i = 0; i < 300; i++) {
        stepFish(f, open, 1 / 30, undefined, {
          ...p,
          position: { x: f.position.x + 0.5, y: f.position.y, z: f.position.z },
        });
        if (f.behavior.activity !== last) {
          transitions++;
          last = f.behavior.activity;
        }
      }
      expect(f.behavior.activity).toBe('recovering');
      expect(transitions).toBe(1);
      expect(f.reaction.scatter).toBeGreaterThan(0.1);
      expect(f.behavior.cooldown).toBeGreaterThan(0);
      for (let i = 0; i < 1800; i++) stepFish(f, open, 1 / 30);
      expect(f.reaction.scatter).toBe(0);
      expect(f.behavior.activity).not.toBe('recovering');
    },
  );
  it('selects observation more often for gouramis than tetras, with seeded schedules and cooldown', () => {
    const counts = [0, 0, 0];
    for (let species = 0; species < 3; species++)
      for (let seed = 1; seed <= 200; seed++) {
        const f = spawnFish(
          open,
          [{ ...FISH_SPECIES[species], count: 1 }],
          seed,
        )[0];
        Object.assign(f.position, { x: 0, y: 6, z: 0 });
        f.behavior.elapsed = f.behavior.duration;
        const p = diver(f, f.species.diver.awarenessRadius + 1);
        updateFishBehavior(f, open, 1 / 30, p);
        if (f.behavior.activity === 'observing') {
          counts[species]++;
          expect(f.behavior.cooldown).toBeGreaterThan(34);
          expect(f.behavior.duration).toBeGreaterThanOrEqual(5);
          expect(f.behavior.duration).toBeLessThanOrEqual(8);
        }
      }
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
  });
  it('ends observation immediately for a rapid approach even before scatter builds', () => {
    const f = fixture();
    force(f, 'observing');
    updateFishBehavior(f, open, 1 / 30, diver(f, 4, 3));
    expect(f.behavior.activity).toBe('recovering');
    expect(f.behavior.cooldown).toBeGreaterThan(25);
  });
  it('bounds and varies individual recovery durations', () => {
    const fish = spawnFish(open);
    for (const f of fish) {
      f.reaction.scatter = 1;
      updateFishBehavior(f, open, 1 / 30);
      expect(f.behavior.activity).toBe('recovering');
      expect(f.behavior.duration).toBeGreaterThan(
        f.species.behavior.recoverySeconds * 0.7,
      );
      expect(f.behavior.duration).toBeLessThan(
        f.species.behavior.recoverySeconds * 1.4,
      );
    }
    expect(new Set(fish.map((f) => f.behavior.duration)).size).toBe(16);
  });
});

it('keeps a ten-minute real habitat safe, mostly cruising, varied and free of stuck activity states', () => {
  const aquarium = new Aquarium();
  try {
    const habitat = aquarium.fish.simulation.habitat,
      sim = new FishSimulation(spawnFish(habitat), habitat);
    const seen = sim.fish.map(() => new Set<FishActivity>()),
      last = sim.fish.map((f) => f.behavior.activity),
      changes = sim.fish.map(() => 0);
    let cruising = 0,
      total = 0,
      forageArrivals = 0,
      stalls = 0;
    for (let i = 0; i < 18000; i++) {
      sim.advance(1 / 30, true);
      for (let j = 0; j < sim.fish.length; j++) {
        const f = sim.fish[j];
        seen[j].add(f.behavior.activity);
        if (f.behavior.activity !== last[j]) {
          changes[j]++;
          last[j] = f.behavior.activity;
        }
        if (f.behavior.activity === 'cruising') cruising++;
        if (f.behavior.activity === 'foraging' && f.behavior.arrived)
          forageArrivals++;
        total++;
        stalls += Number(f.corrections > 0);
        if (i % 30 === 0) {
          expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
          expect(Object.values(f.velocity).every(Number.isFinite)).toBe(true);
          expect(Number.isFinite(f.behavior.gesture)).toBe(true);
          expect(f.behavior.elapsed).toBeLessThan(81);
        }
      }
    }
    expect(cruising / total).toBeGreaterThan(0.65);
    expect(changes.every((c) => c >= 8 && c < 65)).toBe(true);
    expect(
      seen.every((states) => states.has('cruising') && states.size >= 3),
    ).toBe(true);
    expect(seen[14].has('resting') || seen[15].has('resting')).toBe(true);
    expect(forageArrivals).toBeGreaterThan(30);
    expect(stalls).toBe(0);
  } finally {
    aquarium.dispose();
  }
}, 30000);
