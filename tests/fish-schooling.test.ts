import { describe, expect, it } from 'vitest';
import { AQUARIUM, type Vec3 } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { FishSchooling } from '../src/fish/FishSchooling';
import { FISH_SPECIES, type SchoolingTuning } from '../src/fish/FishSpecies';
import { FishSimulation, stepFish } from '../src/fish/FishMovement';
import { spawnFish } from '../src/fish/FishSpawner';
import { safeFishPosition, type FishHabitat } from '../src/fish/FishHabitat';
import { angleDifference, type FishEntity } from '../src/fish/FishEntity';
import type { ConvexCollider } from '../src/player/collision';

const open: FishHabitat = { bounds: AQUARIUM, rocks: [] };
const magnitude = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
function individual(
  index: number,
  id: number,
  x: number,
  z = 0,
  yaw = 0,
  overrides: Partial<SchoolingTuning> = {},
): FishEntity {
  const s = FISH_SPECIES[index];
  const f = spawnFish(
    open,
    [{ ...s, count: 1, schooling: { ...s.schooling, ...overrides } }],
    38147 + id,
  )[0];
  const position = { x, y: 5, z };
  return {
    ...f,
    id,
    position,
    previousPosition: { ...position },
    target: { x: x + 8 * Math.cos(yaw), y: 5, z: z - 8 * Math.sin(yaw) },
    yaw,
    previousYaw: yaw,
    pitch: 0,
    previousPitch: 0,
    targetTime: 100,
    velocity: { x: Math.cos(yaw) * f.speed, y: 0, z: -Math.sin(yaw) * f.speed },
  };
}
function evaluate(fish: FishEntity[]): FishSchooling {
  const schooling = new FishSchooling(fish);
  schooling.calculate();
  return schooling;
}
function metrics(fish: readonly FishEntity[]) {
  let x = 0,
    y = 0,
    z = 0,
    hx = 0,
    hy = 0,
    hz = 0;
  for (const f of fish) {
    x += f.position.x;
    y += f.position.y;
    z += f.position.z;
    hx += Math.cos(f.yaw) * Math.cos(f.pitch);
    hy += Math.sin(f.pitch);
    hz -= Math.sin(f.yaw) * Math.cos(f.pitch);
  }
  x /= fish.length;
  y /= fish.length;
  z /= fish.length;
  return {
    spread: Math.sqrt(
      fish.reduce(
        (sum, f) =>
          sum +
          (f.position.x - x) ** 2 +
          (f.position.y - y) ** 2 +
          (f.position.z - z) ** 2,
        0,
      ) / fish.length,
    ),
    alignment: Math.hypot(hx, hy, hz) / fish.length,
  };
}
const rock: ConvexCollider = {
  min: { x: -1, y: 2, z: -1 },
  max: { x: 1, y: 7, z: 1 },
  planes: [
    { x: 1, y: 0, z: 0, offset: 1 },
    { x: -1, y: 0, z: 0, offset: 1 },
    { x: 0, y: 1, z: 0, offset: 7 },
    { x: 0, y: -1, z: 0, offset: -2 },
    { x: 0, y: 0, z: 1, offset: 1 },
    { x: 0, y: 0, z: -1, offset: 1 },
  ],
};

describe('personal space across species', () => {
  it('increases smooth separation as distance decreases and accounts for body size', () => {
    const a = individual(0, 0, 0),
      b = individual(0, 1, 1.8);
    const far = magnitude(evaluate([a, b]).forFish(a).separation);
    b.position.x = 1.3;
    const near = magnitude(evaluate([a, b]).forFish(a).separation);
    expect(near).toBeGreaterThan(far);
    expect(evaluate([a, b]).forFish(a).separation.x).toBeLessThan(0);
    const larger = { ...b, radius: b.radius * 1.6 };
    expect(
      magnitude(evaluate([a, larger]).forFish(a).separation),
    ).toBeGreaterThan(near);
    const before = magnitude(evaluate([a, b]).forFish(a).separation);
    b.position.x += 0.001;
    expect(
      Math.abs(magnitude(evaluate([a, b]).forFish(a).separation) - before),
    ).toBeLessThan(0.01);
  });
  it('separates different species without cross-species alignment or cohesion', () => {
    const a = individual(0, 0, 0),
      b = individual(2, 1, 1);
    const s = evaluate([a, b]);
    expect(s.forFish(a).separation.x).toBeLessThan(0);
    expect(s.forFish(b).separation.x).toBeGreaterThan(0);
    for (const f of [a, b]) {
      expect(magnitude(s.forFish(f).alignment)).toBe(0);
      expect(magnitude(s.forFish(f).cohesion)).toBe(0);
    }
  });
  it.each([0, 1e-12, 0.0001])(
    'handles coincident or nearly coincident bodies at distance %s without invalid forces',
    (distance) => {
      const a = individual(0, 4, 0),
        b = individual(0, 7, distance);
      const s = evaluate([a, b]),
        af = s.forFish(a).separation,
        bf = s.forFish(b).separation;
      expect(Number.isFinite(magnitude(af))).toBe(true);
      expect(Number.isFinite(magnitude(bf))).toBe(true);
      expect(af.x * bf.x + af.y * bf.y + af.z * bf.z).toBeLessThan(0);
      expect(magnitude(af)).toBeLessThanOrEqual(
        a.species.schooling.separationWeight + 1e-8,
      );
    },
  );
  it('redirects a close head-on encounter using ordinary capped turns, not position corrections', () => {
    const a = individual(0, 0, -0.9, 0, 0, { enabled: false }),
      b = individual(0, 1, 0.9, 0, Math.PI, { enabled: false });
    const sim = new FishSimulation([a, b], open);
    let minimum = Infinity,
      maxSideways = 0;
    for (let i = 0; i < 180; i++) {
      const oldYaw = a.yaw,
        oldPitch = a.pitch,
        oldSpeed = a.speed,
        previous = { ...a.position };
      sim.advance(1 / 30, true);
      expect(
        Math.hypot(angleDifference(a.yaw, oldYaw), a.pitch - oldPitch),
      ).toBeLessThanOrEqual((a.species.turnRate * a.turnFactor) / 30 + 1e-8);
      expect(Math.abs(a.speed - oldSpeed)).toBeLessThanOrEqual(
        a.species.acceleration / 30 + 1e-8,
      );
      expect(
        Math.hypot(
          a.position.x - previous.x,
          a.position.y - previous.y,
          a.position.z - previous.z,
        ),
      ).toBeLessThan(0.04);
      minimum = Math.min(
        minimum,
        Math.hypot(
          a.position.x - b.position.x,
          a.position.y - b.position.y,
          a.position.z - b.position.z,
        ),
      );
      maxSideways = Math.max(maxSideways, Math.abs(a.position.z));
    }
    expect(minimum).toBeGreaterThan(a.radius + b.radius);
    expect(maxSideways).toBeGreaterThan(0.3);
  });
});

describe('species-local social steering', () => {
  it('aligns only nearby members of the same species, gradually', () => {
    const a = individual(0, 0, 0, 0, 0, {
        separationWeight: 0,
        cohesionWeight: 0,
      }),
      b = individual(0, 1, 0, -2, Math.PI / 2);
    const s = evaluate([a, b]);
    expect(s.forFish(a).alignment.z).toBeLessThan(-0.1);
    stepFish(a, open, 1 / 30, s.forFish(a));
    expect(a.yaw).toBeGreaterThan(0);
    expect(a.yaw).toBeLessThan(0.06);
    b.position.z = -20;
    const distant = evaluate([a, b]).forFish(a);
    expect(magnitude(distant.alignment)).toBe(0);
    expect(magnitude(distant.cohesion)).toBe(0);
    expect(distant.wander).toBe(1);
  });
  it('allows independent headings and targets even while alignment is active', () => {
    const a = individual(0, 0, -1),
      b = individual(0, 1, 1, 0, Math.PI / 2);
    const sim = new FishSimulation([a, b], open);
    const targetA = { ...a.target },
      targetB = { ...b.target };
    sim.advance(1 / 30, true);
    expect(Math.abs(angleDifference(a.yaw, b.yaw))).toBeGreaterThan(1);
    expect(a.target).toEqual(targetA);
    expect(b.target).toEqual(targetB);
    expect(a.phase).not.toBe(b.phase);
  });
  it('uses gentle cohesion outside comfortable spacing and leaves a local spacing dead zone', () => {
    const a = individual(0, 0, -2, 0, 0, {
        separationWeight: 0,
        alignmentWeight: 0,
      }),
      b = individual(0, 1, 2);
    const s = evaluate([a, b]);
    expect(s.forFish(a).cohesion.x).toBeGreaterThan(0);
    expect(s.forFish(b).cohesion.x).toBeLessThan(0);
    expect(magnitude(s.forFish(a).cohesion)).toBeLessThanOrEqual(
      a.species.schooling.cohesionWeight * 1.1,
    );
    b.position.x = a.position.x + 0.8;
    expect(magnitude(evaluate([a, b]).forFish(a).cohesion)).toBe(0);
  });
  it('gives a straggler a finite, local reconnection influence without tethering distant fish', () => {
    const a = individual(0, 0, -8),
      b = individual(0, 1, 0);
    let result = evaluate([a, b]).forFish(a);
    expect(result.cohesion.x).toBeGreaterThan(0);
    expect(result.wander).toBeGreaterThan(0.3);
    a.position.x = -13;
    result = evaluate([a, b]).forFish(a);
    expect(magnitude(result.cohesion)).toBe(0);
    expect(result.wander).toBe(1);
  });
  it('keeps gouramis independent and bounds the schooling neighbor count', () => {
    const gouramis = [individual(2, 40, 0), individual(2, 41, 2)];
    const school = evaluate(gouramis);
    for (const f of gouramis) {
      const out = school.forFish(f);
      expect(out.neighbors).toBe(0);
      expect(magnitude(out.alignment) + magnitude(out.cohesion)).toBe(0);
      expect(out.wander).toBe(1);
    }
    const population = spawnFish(open);
    const all = evaluate(population);
    for (const f of population)
      expect(all.forFish(f).neighbors).toBeLessThanOrEqual(
        f.species.schooling.maxNeighbors,
      );
  });
});

describe('snapshot determinism, timing, and lifecycle', () => {
  it('uses the same immutable step snapshot regardless of fish update ordering', () => {
    const initial = spawnFish(open),
      a = new FishSimulation(structuredClone(initial), open),
      b = new FishSimulation(structuredClone(initial).reverse(), open);
    for (let i = 0; i < 600; i++) {
      a.advance(1 / 30, true);
      b.fish.reverse();
      b.advance(1 / 30, true);
    }
    expect([...b.fish].sort((a, b) => a.id - b.id)).toEqual(a.fish);
    for (const f of a.fish) {
      const other = b.fish.find((other) => other.id === f.id)!;
      expect(b.schooling.forFish(other)).toEqual(a.schooling.forFish(f));
    }
  });
  it('does not change a computed neighbor influence when another fish advances', () => {
    const a = individual(0, 0, 0),
      b = individual(0, 1, 2);
    const s = evaluate([a, b]),
      before = structuredClone(s.forFish(b));
    stepFish(a, open, 1 / 30, s.forFish(a));
    expect(s.forFish(b)).toEqual(before);
  });
  it('reproduces the same seeded school at 30, 60, and 120 FPS and freezes its cache on pause', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(open), open);
      for (let i = 0; i < fps * 30; i++) sim.advance(1 / fps, true);
      return sim;
    });
    expect(results[1].fish).toEqual(results[0].fish);
    expect(results[2].fish).toEqual(results[0].fish);
    const sim = results[0],
      before = structuredClone(sim.fish),
      cache = sim.fish.map((f) => structuredClone(sim.schooling.forFish(f))),
      time = sim.time;
    sim.advance(600, false);
    expect(sim.fish).toEqual(before);
    expect(sim.time).toBe(time);
    expect(sim.fish.map((f) => sim.schooling.forFish(f))).toEqual(cache);
    sim.advance(0, true);
    expect(sim.fish).toEqual(before);
    sim.advance(1 / 60, true);
    for (let i = 0; i < sim.fish.length; i++)
      expect(
        Math.hypot(
          sim.fish[i].position.x - before[i].position.x,
          sim.fish[i].position.y - before[i].position.y,
          sim.fish[i].position.z - before[i].position.z,
        ),
      ).toBeLessThan(0.04);
  });
});

describe('school formation and safety over time', () => {
  it('forms a cohesive but imperfect tetra school and a looser rasbora group, with personal space', () => {
    const aquarium = new Aquarium();
    try {
      const habitat = { bounds: AQUARIUM, rocks: aquarium.collision.colliders },
        sim = new FishSimulation(spawnFish(habitat), habitat);
      let tetraSpread = 0,
        rasboraSpread = 0,
        tetraAlignment = 0,
        rasboraAlignment = 0,
        samples = 0,
        overlaps = 0,
        pairs = 0;
      for (let i = 0; i < 30 * 300; i++) {
        sim.advance(1 / 30, true);
        if (i % 30 !== 0) continue;
        for (const f of sim.fish) {
          expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
          const force = sim.schooling.forFish(f);
          expect(
            Number.isFinite(
              magnitude(force.separation) +
                magnitude(force.alignment) +
                magnitude(force.cohesion),
            ),
          ).toBe(true);
        }
        for (let j = 0; j < sim.fish.length; j++)
          for (let k = j + 1; k < sim.fish.length; k++) {
            const a = sim.fish[j],
              b = sim.fish[k];
            pairs++;
            if (
              Math.hypot(
                a.position.x - b.position.x,
                a.position.y - b.position.y,
                a.position.z - b.position.z,
              ) <
              a.radius + b.radius
            )
              overlaps++;
          }
        if (i > 30 * 30) {
          const tetra = metrics(
              sim.fish.filter((f) => f.species.id === FISH_SPECIES[0].id),
            ),
            rasbora = metrics(
              sim.fish.filter((f) => f.species.id === FISH_SPECIES[1].id),
            );
          tetraSpread += tetra.spread;
          rasboraSpread += rasbora.spread;
          tetraAlignment += tetra.alignment;
          rasboraAlignment += rasbora.alignment;
          samples++;
        }
      }
      expect(tetraSpread / samples).toBeLessThan(3);
      expect(tetraSpread / samples).toBeGreaterThan(1);
      expect(rasboraSpread / samples).toBeGreaterThan(
        (tetraSpread / samples) * 1.2,
      );
      expect(rasboraSpread / samples).toBeLessThan(5);
      expect(tetraAlignment / samples).toBeGreaterThan(0.8);
      expect(rasboraAlignment / samples).toBeLessThan(tetraAlignment / samples);
      expect(overlaps / pairs).toBeLessThan(0.01);
      expect(new Set(sim.fish.map((f) => f.phase.toFixed(4))).size).toBe(16);
      expect(sim.fish.reduce((sum, f) => sum + f.corrections, 0)).toBe(0);
    } finally {
      aquarium.dispose();
    }
  }, 30000);
  it('can split around a substantial obstacle, make progress, and reconnect without entering it', () => {
    const habitat = { bounds: AQUARIUM, rocks: [rock] };
    const fish = [
      individual(0, 0, -5, -1.4),
      individual(0, 1, -5, 1.4),
      individual(0, 2, -6, -0.5),
      individual(0, 3, -6, 0.5),
    ];
    const sim = new FishSimulation(fish, habitat),
      progress = fish.map((f) => f.position.x);
    let negative = false,
      positive = false,
      rejoined = false;
    for (let i = 0; i < 30 * 80; i++) {
      sim.advance(1 / 30, true);
      for (let j = 0; j < fish.length; j++) {
        const f = fish[j];
        expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
        progress[j] = Math.max(progress[j], f.position.x);
        if (f.position.x > -2 && f.position.x < 2) {
          negative ||= f.position.z < -1.3;
          positive ||= f.position.z > 1.3;
        }
      }
      if (i > 30 * 20 && metrics(fish).spread < 2.5) rejoined = true;
    }
    expect(negative && positive).toBe(true);
    expect(progress.every((x) => x > 2)).toBe(true);
    expect(rejoined).toBe(true);
    expect(fish.reduce((sum, f) => sum + f.corrections, 0)).toBe(0);
  });
  it('prioritizes containment near glass, a corner, and rocks near glass under strong social attraction', () => {
    const nearGlass: ConvexCollider = {
      ...rock,
      min: { x: 14, y: 2, z: 7 },
      max: { x: 17.7, y: 7, z: 10 },
      planes: [
        { x: 1, y: 0, z: 0, offset: 17.7 },
        { x: -1, y: 0, z: 0, offset: -14 },
        { x: 0, y: 1, z: 0, offset: 7 },
        { x: 0, y: -1, z: 0, offset: -2 },
        { x: 0, y: 0, z: 1, offset: 10 },
        { x: 0, y: 0, z: -1, offset: -7 },
      ],
    };
    const habitat = { bounds: AQUARIUM, rocks: [nearGlass] };
    const fish = [
      individual(0, 0, 14, 12.2, -Math.PI / 4),
      individual(0, 1, 15.5, 12.4, -Math.PI / 4),
      individual(0, 2, 16.5, 11.7, -Math.PI / 4),
    ];
    const initial = fish.map((f) => ({ ...f.position })),
      sim = new FishSimulation(fish, habitat);
    let movement = 0;
    for (let i = 0; i < 30 * 90; i++) {
      sim.advance(1 / 30, true);
      if (i % 15 === 0)
        for (const f of fish)
          expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
    }
    for (let i = 0; i < fish.length; i++)
      movement += Math.hypot(
        fish[i].position.x - initial[i].x,
        fish[i].position.y - initial[i].y,
        fish[i].position.z - initial[i].z,
      );
    expect(movement).toBeGreaterThan(6);
    expect(fish.reduce((sum, f) => sum + f.corrections, 0)).toBe(0);
  });
});

it('allows a group to fragment around a narrow channel without pushing members into the rocks', () => {
  const lower: ConvexCollider = {
    min: { x: -1, y: 2, z: -3 },
    max: { x: 1, y: 7, z: -0.8 },
    planes: [
      { x: 1, y: 0, z: 0, offset: 1 },
      { x: -1, y: 0, z: 0, offset: 1 },
      { x: 0, y: 1, z: 0, offset: 7 },
      { x: 0, y: -1, z: 0, offset: -2 },
      { x: 0, y: 0, z: 1, offset: -0.8 },
      { x: 0, y: 0, z: -1, offset: 3 },
    ],
  };
  const upper: ConvexCollider = {
    min: { x: -1, y: 2, z: 0.8 },
    max: { x: 1, y: 7, z: 3 },
    planes: [
      { x: 1, y: 0, z: 0, offset: 1 },
      { x: -1, y: 0, z: 0, offset: 1 },
      { x: 0, y: 1, z: 0, offset: 7 },
      { x: 0, y: -1, z: 0, offset: -2 },
      { x: 0, y: 0, z: 1, offset: 3 },
      { x: 0, y: 0, z: -1, offset: -0.8 },
    ],
  };
  const habitat = { bounds: AQUARIUM, rocks: [lower, upper] },
    fish = [
      individual(0, 0, -5, -0.5),
      individual(0, 1, -5, 0.5),
      individual(0, 2, -6, -1.5),
      individual(0, 3, -6, 1.5),
    ];
  const progress = fish.map((f) => f.position.x),
    sim = new FishSimulation(fish, habitat);
  for (let i = 0; i < 30 * 90; i++) {
    sim.advance(1 / 30, true);
    for (let j = 0; j < fish.length; j++) {
      const f = fish[j];
      expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
      progress[j] = Math.max(progress[j], f.position.x);
    }
  }
  expect(progress.every((x) => x > 2)).toBe(true);
  expect(fish.reduce((sum, f) => sum + f.corrections, 0)).toBe(0);
});

it('keeps vertical obstacle safety authoritative while school members prefer different depths', () => {
  const habitat = { bounds: AQUARIUM, rocks: [rock] },
    a = individual(0, 0, -4, -0.5),
    b = individual(0, 1, -4, 0.5);
  a.position.y = 2.8;
  b.position.y = 7.8;
  a.previousPosition.y = 2.8;
  b.previousPosition.y = 7.8;
  a.target.y = 7;
  b.target.y = 4;
  const sim = new FishSimulation([a, b], habitat);
  let ascent = false,
    descent = false;
  for (let i = 0; i < 30 * 60; i++) {
    sim.advance(1 / 30, true);
    for (const f of [a, b])
      expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
    ascent ||= a.position.y > 4;
    descent ||= b.position.y < 6;
  }
  expect(ascent && descent).toBe(true);
  expect(a.corrections + b.corrections).toBe(0);
});
