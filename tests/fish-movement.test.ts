import { describe, expect, it, vi } from 'vitest';
import { Mesh } from 'three';
import { AQUARIUM } from '../src/config/world';
import { FishSimulation, stepFish } from '../src/fish/FishMovement';
import { spawnFish } from '../src/fish/FishSpawner';
import { FISH_TIMING } from '../src/fish/FishSpecies';
import { angleDifference } from '../src/fish/FishEntity';
import { FishSystem } from '../src/fish/FishSystem';

const habitat = { bounds: AQUARIUM, rocks: [] };
describe('independent fish locomotion', () => {
  it('caps speed, acceleration, and angular turning without sideways translation', () => {
    const fish = spawnFish(habitat);
    let speedRatio = 0,
      accelerationRatio = 0,
      turnRatio = 0,
      headingError = 0,
      displacementRatio = 0,
      finite = true;
    for (let i = 0; i < 1800; i++)
      for (const f of fish) {
        const oldSpeed = f.speed,
          oldYaw = f.yaw,
          oldPitch = f.pitch,
          px = f.position.x,
          py = f.position.y,
          pz = f.position.z;
        stepFish(f, habitat, FISH_TIMING.step);
        speedRatio = Math.max(
          speedRatio,
          f.speed / (f.species.maxSpeed * f.speedFactor),
        );
        accelerationRatio = Math.max(
          accelerationRatio,
          Math.abs(f.speed - oldSpeed) /
            (f.species.acceleration * FISH_TIMING.step),
        );
        turnRatio = Math.max(
          turnRatio,
          Math.hypot(angleDifference(f.yaw, oldYaw), f.pitch - oldPitch) /
            (f.species.turnRate * f.turnFactor * FISH_TIMING.step),
        );
        const length = Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z);
        if (length > 0)
          headingError = Math.max(
            headingError,
            Math.abs(
              f.velocity.x / length - Math.cos(f.yaw) * Math.cos(f.pitch),
            ),
            Math.abs(f.velocity.y / length - Math.sin(f.pitch)),
            Math.abs(
              f.velocity.z / length + Math.sin(f.yaw) * Math.cos(f.pitch),
            ),
          );
        displacementRatio = Math.max(
          displacementRatio,
          Math.hypot(f.position.x - px, f.position.y - py, f.position.z - pz) /
            (f.species.maxSpeed * f.speedFactor * FISH_TIMING.step),
        );
        finite =
          finite &&
          Number.isFinite(f.position.x) &&
          Number.isFinite(f.position.y) &&
          Number.isFinite(f.position.z) &&
          Number.isFinite(f.yaw) &&
          Number.isFinite(f.pitch) &&
          Number.isFinite(f.phase) &&
          Number.isFinite(f.bank);
      }
    expect(speedRatio).toBeLessThanOrEqual(1 + 1e-8);
    expect(accelerationRatio).toBeLessThanOrEqual(1 + 1e-8);
    expect(turnRatio).toBeLessThanOrEqual(1 + 1e-8);
    expect(displacementRatio).toBeLessThanOrEqual(1 + 1e-8);
    expect(headingError).toBeLessThan(1e-8);
    expect(finite).toBe(true);
  });
  it('uses persistent, asynchronous targets rather than per-frame noise or synchronized loops', () => {
    const fish = spawnFish(habitat);
    for (const f of fish) stepFish(f, habitat, FISH_TIMING.step);
    const targets = fish.map((f) => ({ ...f.target }));
    for (let i = 0; i < 30; i++)
      for (const f of fish) stepFish(f, habitat, FISH_TIMING.step);
    expect(
      fish.filter(
        (f, i) => JSON.stringify(f.target) === JSON.stringify(targets[i]),
      ).length,
    ).toBeGreaterThan(12);
    expect(new Set(fish.map((f) => f.targetTime.toFixed(3))).size).toBe(16);
    expect(new Set(fish.map((f) => f.yaw.toFixed(2))).size).toBeGreaterThan(12);
  });
  it('produces the same 30 Hz simulation at 30, 60, and 120 FPS', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(habitat), habitat);
      for (let i = 0; i < fps * 60; i++) sim.advance(1 / fps, true);
      return sim;
    });
    expect(results[0].steps).toBe(1800);
    for (const sim of results.slice(1)) {
      expect(sim.steps).toBe(1800);
      expect(sim.fish).toEqual(results[0].fish);
      expect(sim.alpha).toBeCloseTo(0, 8);
    }
  });
  it('ignores invalid deltas and bounds catch-up after long frames', () => {
    const sim = new FishSimulation(spawnFish(habitat), habitat),
      initial = structuredClone(sim.fish);
    for (const dt of [NaN, Infinity, -1, 0]) sim.advance(dt, true);
    expect(sim.fish).toEqual(initial);
    sim.advance(60, true);
    expect(sim.steps).toBe(FISH_TIMING.maxCatchUp);
    expect(sim.alpha).toBeLessThan(1);
  });
});

describe('fish presentation and lifecycle', () => {
  it('interpolates between fixed states, freezes pose/tail on pause, and resumes without catch-up', () => {
    const system = new FishSystem(habitat);
    try {
      system.update(1 / 20, true, false);
      const f = system.simulation.fish[0],
        visual = system.visuals[0];
      expect(system.simulation.alpha).toBeCloseTo(0.5, 8);
      expect(visual.root.position.x).toBeCloseTo(
        (f.position.x + f.previousPosition.x) / 2,
        8,
      );
      const pose = visual.root.matrix.clone();
      visual.root.updateMatrix();
      pose.copy(visual.root.matrix);
      const tail = visual.tail.rotation.y,
        position = visual.root.position.clone(),
        time = system.simulation.time,
        fish = structuredClone(system.simulation.fish);
      system.update(100, false, false);
      visual.root.updateMatrix();
      expect(visual.root.matrix).toEqual(pose);
      expect(visual.tail.rotation.y).toBe(tail);
      expect(system.simulation.time).toBe(time);
      expect(system.simulation.fish).toEqual(fish);
      system.update(0, true, false);
      expect(visual.root.position).toEqual(position);
      system.update(1 / 60, true, false);
      expect(visual.root.position.distanceTo(position)).toBeLessThan(0.02);
    } finally {
      system.dispose();
    }
  });
  it('keeps essential tail/pectoral movement but removes optional bank with reduced motion', () => {
    const system = new FishSystem(habitat);
    try {
      const tail = system.visuals[0].tail.rotation.y;
      for (let i = 0; i < 20; i++) system.update(1 / 60, true, true);
      expect(system.visuals[0].tail.rotation.y).not.toBe(tail);
      expect(system.visuals[0].root.rotation.x).toBe(0);
    } finally {
      system.dispose();
    }
  });
  it('shares geometry per species and disposes every owned resource exactly once', () => {
    const system = new FishSystem(habitat);
    expect(system.templates).toHaveLength(3);
    expect(system.visuals).toHaveLength(16);
    const bodyA = system.visuals[0].root.children[0],
      bodyB = system.visuals[1].root.children[0];
    if (!(bodyA instanceof Mesh) || !(bodyB instanceof Mesh))
      throw new Error('Missing fish bodies');
    expect(bodyA.geometry).toBe(bodyB.geometry);
    expect(bodyA.material).toBe(bodyB.material);
    const geometries = system.templates.flatMap((t) => [...t.geometries]),
      materials = system.templates.flatMap((t) => [...t.materials]);
    const spies = [...geometries, ...materials].map((resource) =>
      vi.spyOn(resource, 'dispose'),
    );
    const initial = system.simulation.steps;
    system.dispose();
    system.dispose();
    system.update(1, true, false);
    expect(system.root.children).toHaveLength(0);
    expect(system.simulation.steps).toBe(initial);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    // No unique body geometry is allocated by create(): all fish use template resources.
    expect(geometries.length).toBeLessThan(25);
  });
});

it('animates continuously across repeated tail phase wraps', () => {
  const system = new FishSystem(habitat);
  try {
    let tail = system.visuals[0].tail.rotation.y,
      pectoral = system.visuals[0].leftPectoral.rotation.y;
    for (let i = 0; i < 240; i++) {
      system.update(1 / 60, true, false);
      const visual = system.visuals[0];
      expect(Math.abs(visual.tail.rotation.y - tail)).toBeLessThan(0.2);
      expect(Math.abs(visual.leftPectoral.rotation.y - pectoral)).toBeLessThan(
        0.08,
      );
      tail = visual.tail.rotation.y;
      pectoral = visual.leftPectoral.rotation.y;
    }
  } finally {
    system.dispose();
  }
});
