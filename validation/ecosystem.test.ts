import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { FishSimulation } from '../src/fish/FishMovement';
import { spawnFish } from '../src/fish/FishSpawner';
import { fishPopulation } from '../src/fish/FishSpecies';
import { safeFishPosition } from '../src/fish/FishHabitat';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { createSwimState, integrateSwimming } from '../src/player/swimming';
import { AudioEvents } from '../src/audio/AudioEvents';
import { swimmingGain, AUDIO } from '../src/audio/AudioTuning';
import { tropicalSnapshot } from './TropicalAudit';
import { PlantClock } from '../src/environment/PlantAnimation';

const reports: unknown[] = [];
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
};
afterAll(() => {
  const file = process.env.COZY_REPORT || '/tmp/cozy-ecosystem-stress.json';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(reports, null, 2));
});

it.each([
  { minutes: 5, count: 60 },
  { minutes: 15, count: 40 },
  { minutes: 30, count: 40 },
] as const)(
  'keeps the actual ecosystem stable for $minutes minutes with $count fish',
  ({ minutes, count }) => {
    const aquarium = new Aquarium();
    try {
      const habitat = aquarium.fish.simulation.habitat;
      const sim = new FishSimulation(
        spawnFish(habitat, fishPopulation(count)),
        habitat,
      );
      const state = createSwimState(SPAWN),
        tuning = { speed: 2.8, feel: 'natural' as const, reducedMotion: false };
      const direction = { x: 0, y: 0, z: 0 },
        still = { x: 0, y: 0, z: 0 },
        plants = new PlantClock(),
        events = new AudioEvents(11);
      const travel = sim.fish.map(() => 0),
        states = sim.fish.map(() => new Set<string>()),
        last = sim.fish.map((f) => ({ ...f.position }));
      const initial = tropicalSnapshot(aquarium),
        morayStates = new Set<string>(),
        snapshots: ReturnType<typeof tropicalSnapshot>[] = [];
      const timings: number[] = [],
        collision: number[] = [];
      let eventCount = 0,
        voice = 0,
        maximumScatter = 0,
        minimumTravel = Infinity;
      for (let frame = 0; frame < minutes * 60 * 30; frame++) {
        const time = frame / 30;
        // Interleave pause/hidden/mute gates without adding missed simulation time.
        if (frame % 900 === 0) {
          const before = { steps: sim.steps, time: plants.time };
          sim.advance(3600, false);
          plants.update(3600, false, false);
          expect(events.advance(3600, false)).toBeUndefined();
          expect({ steps: sim.steps, time: plants.time }).toEqual(before);
          const paused = tropicalSnapshot(aquarium);
          aquarium.ornaments.update(3600, false, false);
          aquarium.anchoredLife.update(3600, false, false);
          expect(tropicalSnapshot(aquarium)).toEqual(paused);
          events.resume();
          voice = 0;
        }
        const moving = time % 60 >= 30;
        direction.x = Math.sin(time * 0.11);
        direction.y = Math.sin(time * 0.07) * 0.3;
        direction.z = -Math.cos(time * 0.11);
        const length = Math.hypot(direction.x, direction.y, direction.z);
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;
        const start = performance.now();
        integrateSwimming(
          state,
          moving ? direction : still,
          1 / 30,
          tuning,
          AQUARIUM,
          aquarium.collision,
        );
        if (frame % 30 === 0) collision.push(performance.now() - start);
        const target = sim.fish.find(
          (f) => f.species.id === 'blue-green-chromis',
        )!;
        const disturbance = time % 90 >= 60 && time % 90 < 65;
        const player = disturbance
          ? {
              position: {
                x: target.position.x - 1.2,
                y: target.position.y,
                z: target.position.z,
              },
              velocity: { x: time % 180 < 90 ? 0.2 : 3, y: 0, z: 0 },
              active: true,
            }
          : {
              position: state.position,
              velocity: state.velocity,
              active: moving,
            };
        const step = performance.now();
        aquarium.ornaments.update(
          1 / 30,
          true,
          time % 120 > 110,
          player,
          sim.fish,
        );
        aquarium.anchoredLife.update(1 / 30, true, time % 120 > 110, player);
        sim.advance(1 / 30, true, player);
        if (frame % 30 === 0) timings.push(performance.now() - step);
        plants.update(1 / 30, true, time % 120 > 110);
        voice = Math.max(0, voice - 1 / 30);
        const event = events.advance(1 / 30, time % 120 < 100, voice === 0);
        if (event) {
          eventCount++;
          voice = event.duration;
        }
        sim.fish.forEach((f, i) => {
          travel[i] += Math.hypot(
            f.position.x - last[i].x,
            f.position.y - last[i].y,
            f.position.z - last[i].z,
          );
          Object.assign(last[i], f.position);
        });
        if (frame % 30 === 0) {
          expect(sim.fish).toHaveLength(count);
          expect(swimmingGain(state, tuning)).toBeGreaterThanOrEqual(0);
          expect(swimmingGain(state, tuning)).toBeLessThanOrEqual(
            AUDIO.swimmingCeiling,
          );
          expect(Number.isFinite(plants.time)).toBe(true);
          for (const axis of ['x', 'y', 'z'] as const) {
            expect(state.position[axis]).toBeGreaterThanOrEqual(
              AQUARIUM.min[axis] + AQUARIUM.clearance - 1e-8,
            );
            expect(state.position[axis]).toBeLessThanOrEqual(
              AQUARIUM.max[axis] - AQUARIUM.clearance + 1e-8,
            );
          }
          expect(
            aquarium.collision.colliders.some((c) =>
              aquarium.collision.contains(
                c,
                state.position.x,
                state.position.y,
                state.position.z,
              ),
            ),
          ).toBe(false);
          sim.fish.forEach((f, i) => {
            expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
            expect(
              [
                f.speed,
                f.yaw,
                f.pitch,
                f.velocity.x,
                f.velocity.y,
                f.velocity.z,
              ].every(Number.isFinite),
            ).toBe(true);
            states[i].add(f.behavior.activity);
            maximumScatter = Math.max(maximumScatter, f.reaction.scatter);
          });
        }
        if ((frame + 1) % 900 === 0) {
          const snapshot = tropicalSnapshot(aquarium);
          expect(snapshot.population).toEqual(initial.population);
          expect(snapshot.geometries).toBe(initial.geometries);
          expect(snapshot.materials).toBe(initial.materials);
          expect(snapshot.finite).toBe(true);
          expect(snapshot.hiddenAnimals).toBe(7);
          expect(snapshot.hulls).toBe(139);
          expect(snapshot.seahorseDistance).toBeLessThan(0.13);
          expect(snapshot.frogfishDistance).toBeLessThan(0.11);
          expect(snapshot.bubblesInside).toBe(true);
          expect(snapshot.chest.active).toBeLessThanOrEqual(18);
          expect(snapshot.chest.drawn).toBeLessThanOrEqual(18);
          expect(snapshot.chest.bursts).toBeLessThanOrEqual(
            snapshot.chest.openings,
          );
          expect(snapshot.clocks.every(Number.isFinite)).toBe(true);
          expect(snapshot.moray.extension).toBeGreaterThanOrEqual(0);
          expect(snapshot.moray.extension).toBeLessThanOrEqual(1);
          expect(Number.isFinite(snapshot.moray.elapsed)).toBe(true);
          for (const animal of snapshot.nudibranchs) {
            expect(animal.distance).toBeLessThan(0.1);
            expect(animal.surfaceDistance).toBeCloseTo(0.006, 6);
          }
          expect([
            'hidden',
            'peeking',
            'resting',
            'emerging',
            'retreating',
          ]).toContain(snapshot.moray.state);
          morayStates.add(snapshot.moray.state);
          snapshots.push(snapshot);
          minimumTravel = Math.min(minimumTravel, ...travel);
          expect(Math.min(...travel)).toBeGreaterThan(0.2);
          travel.fill(0);
        }
      }
      expect(sim.steps).toBe(minutes * 60 * 30);
      expect(sim.fish.every((f) => f.corrections === 0)).toBe(true);
      expect(morayStates.size).toBeGreaterThan(2);
      expect(aquarium.ornaments.chest.cycle).toBeGreaterThan(2);
      expect(aquarium.ornaments.bubbles.bursts).toBeGreaterThan(2);
      expect(eventCount).toBeGreaterThan(0);
      expect(eventCount).toBeLessThan((minutes * 60) / 28 + 1);
      expect(maximumScatter).toBeGreaterThan(0.2);
      expect(states.every((s) => s.size > 1)).toBe(true);
      reports.push({
        minutes,
        count,
        anchoredCheckpoints: snapshots,
        morayStates: [...morayStates],
        seed: 38147,
        stepMs: summary(timings),
        swimmingCollisionFrameMs: summary(collision),
        corrections: sim.fish
          .map((f) => ({ id: f.id, count: f.corrections }))
          .filter((f) => f.count),
        minimum30SecondTravel: minimumTravel,
        eventCount,
        maximumScatter,
        activities: [...new Set(states.flatMap((s) => [...s]))],
      });
    } finally {
      aquarium.dispose();
    }
  },
);

it('keeps the full real-habitat simulation identical across 30/60/120 render schedules', () => {
  const aquarium = new Aquarium();
  try {
    const habitat = aquarium.fish.simulation.habitat;
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(habitat), habitat);
      for (let i = 0; i < fps * 30; i++)
        sim.advance(1 / fps, true, {
          position: SPAWN,
          velocity: { x: 0, y: 0, z: 0 },
          active: true,
        });
      return sim.fish;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  } finally {
    aquarium.dispose();
  }
});
