import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { HardscapeSystem } from '../src/environment/HardscapeSystem';
import { MeadowSystem } from '../src/environment/MeadowSystem';
import { substrateHeight } from '../src/environment/HabitatRegions';
import { PLANT_SPECIES } from '../src/environment/PlantSpecies';
import { samplePlantBend } from '../src/environment/PlantAnimation';
import { safeFishPosition, insideRock } from '../src/fish/FishHabitat';
import { spawnFish } from '../src/fish/FishSpawner';
import {
  FISH_SPECIES,
  ORIGINAL_FISH_SPECIES,
  fishPopulation,
} from '../src/fish/FishSpecies';
import { FishSystem } from '../src/fish/FishSystem';
import { FishSimulation } from '../src/fish/FishMovement';
import { angleDifference } from '../src/fish/FishEntity';
import { CollisionWorld } from '../src/player/collision';
const open = { bounds: AQUARIUM, rocks: [], substrateHeight };
describe('five-species population and shared models', () => {
  it('registers all five species and exact 16/20/40/60 population gates', () => {
    expect(FISH_SPECIES.map((s) => s.id)).toEqual([
      'neon-tetra',
      'harlequin-rasbora',
      'honey-gourami',
      'endlers-livebearer',
      'chili-rasbora',
    ]);
    expect(FISH_SPECIES.map((s) => s.count)).toEqual([8, 6, 2, 4, 20]);
    for (const count of [16, 20, 40, 60] as const)
      expect(fishPopulation(count).reduce((n, s) => n + s.count, 0)).toBe(
        count,
      );
    expect(FISH_SPECIES.slice(0, 3)).toEqual(ORIGINAL_FISH_SPECIES);
  });
  it.each([16, 20, 40, 60] as const)(
    'spawns %i fish deterministically with safe bodies, personal space and a loose chili region',
    (count) => {
      const a = new Aquarium();
      try {
        const h = a.fish.simulation.habitat,
          fish = spawnFish(h, fishPopulation(count));
        expect(fish).toHaveLength(count);
        expect(spawnFish(h, fishPopulation(count))).toEqual(fish);
        for (let i = 0; i < fish.length; i++) {
          const f = fish[i];
          expect(safeFishPosition(f.position, f.radius, h)).toBe(true);
          expect(
            Math.hypot(
              f.position.x - SPAWN.x,
              f.position.y - SPAWN.y,
              f.position.z - SPAWN.z,
            ),
          ).toBeGreaterThan(3 + f.radius);
          for (const other of fish.slice(i + 1))
            expect(
              Math.hypot(
                f.position.x - other.position.x,
                f.position.y - other.position.y,
                f.position.z - other.position.z,
              ),
            ).toBeGreaterThan(f.radius + other.radius + 0.25);
        }
        const chilis = fish.filter((f) => f.species.id === 'chili-rasbora');
        if (chilis.length)
          expect(
            Math.max(
              ...chilis.map((f) => Math.hypot(f.position.x, f.position.z + 3)),
            ),
          ).toBeLessThan(4.5);
      } finally {
        a.dispose();
      }
    },
  );
  it('batches the real articulated parts and keeps four distinct Endler markings', () => {
    const system = new FishSystem(open);
    try {
      expect(system.visuals).toHaveLength(40);
      expect(system.batches.length).toBe(5);
      const endler = system.templates.filter(
        (t) => t.species.id === 'endlers-livebearer',
      );
      expect(endler).toHaveLength(4);
      expect(
        new Set(
          endler.map((t) =>
            JSON.stringify(
              Array.from([...t.geometries][0].attributes.position.array),
            ),
          ),
        ).size,
      ).toBe(4);
      const chili = system.batches.find((b) => b.visuals.length === 20)!;
      expect(chili.meshes.length).toBeLessThanOrEqual(8);
      const matrix = new THREE.Matrix4();
      chili.meshes[0].getMatrixAt(0, matrix);
      const before = matrix.clone();
      for (let i = 0; i < 30; i++) system.update(1 / 30, true, false);
      chili.meshes[0].getMatrixAt(0, matrix);
      expect(matrix.equals(before)).toBe(false);
      expect(chili.visuals[0].tail.rotation.y).not.toBe(
        chili.visuals[1].tail.rotation.y,
      );
      const paused = chili.meshes.map((m) =>
        Array.from(m.instanceMatrix.array),
      );
      system.update(0.5, false, false);
      expect(
        chili.meshes.map((m) => Array.from(m.instanceMatrix.array)),
      ).toEqual(paused);
      const resources = system.templates.flatMap((t) => [
          ...t.geometries,
          ...t.materials,
        ]),
        spies = resources.map((r) => vi.spyOn(r, 'dispose'));
      system.dispose();
      system.dispose();
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      system.dispose();
    }
  });
});
describe('darting and school identity', () => {
  it('bounds asynchronous bursts, acceleration, turning and duty cycle without teleporting', () => {
    const fish = spawnFish(open, [
        FISH_SPECIES.find((s) => s.id === 'chili-rasbora')!,
      ]),
      sim = new FishSimulation(fish, open);
    const first = fish.map(() => -1);
    let active = 0,
      samples = 0,
      maxTogether = 0,
      peak = 0;
    for (let step = 0; step < 3600; step++) {
      const previous = fish.map((f) => ({
        speed: f.speed,
        yaw: f.yaw,
        pitch: f.pitch,
        p: { ...f.position },
      }));
      sim.advance(1 / 30, true);
      let together = 0;
      fish.forEach((f, j) => {
        const prev = previous[j];
        if (f.burst.strength > 0.1) {
          active++;
          together++;
          if (first[j] < 0) first[j] = step;
        }
        samples++;
        peak = Math.max(peak, f.speed);
        expect(f.speed).toBeLessThanOrEqual(
          f.species.maxSpeed * f.speedFactor + 1e-8,
        );
        expect(Math.abs(f.speed - prev.speed)).toBeLessThanOrEqual(
          1.6 / 30 + 1e-8,
        );
        expect(
          Math.hypot(angleDifference(f.yaw, prev.yaw), f.pitch - prev.pitch),
        ).toBeLessThanOrEqual((f.species.turnRate * f.turnFactor) / 30 + 1e-8);
        expect(
          Math.hypot(
            f.position.x - prev.p.x,
            f.position.y - prev.p.y,
            f.position.z - prev.p.z,
          ),
        ).toBeLessThanOrEqual((f.species.maxSpeed * f.speedFactor) / 30 + 1e-8);
      });
      maxTogether = Math.max(maxTogether, together);
    }
    expect(first.every((v) => v >= 0)).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(14);
    expect(maxTogether).toBeLessThan(10);
    expect(active / samples).toBeLessThan(0.15);
    expect(peak).toBeGreaterThan(0.65);
  });
  it('retains a larger coherent chili group without leaders or synchronized clocks', () => {
    const config = FISH_SPECIES.find((s) => s.id === 'chili-rasbora')!,
      a = new FishSimulation(spawnFish(open, [config]), open),
      b = new FishSimulation(
        spawnFish(open, [
          {
            ...config,
            schooling: {
              ...config.schooling,
              enabled: false,
              alignmentWeight: 0,
              cohesionWeight: 0,
            },
          },
        ]),
        open,
      );
    const spread = (sim: FishSimulation): number => {
      const fish = sim.fish,
        c = { x: 0, y: 0, z: 0 };
      for (const f of fish) {
        c.x += f.position.x / fish.length;
        c.y += f.position.y / fish.length;
        c.z += f.position.z / fish.length;
      }
      return Math.sqrt(
        fish.reduce(
          (n, f) =>
            n +
            (f.position.x - c.x) ** 2 +
            (f.position.y - c.y) ** 2 +
            (f.position.z - c.z) ** 2,
          0,
        ) / fish.length,
      );
    };
    let school = 0,
      independent = 0;
    for (let i = 0; i < 6000; i++) {
      a.advance(1 / 30, true);
      b.advance(1 / 30, true);
      if (i > 3000 && i % 30 === 0) {
        school += spread(a);
        independent += spread(b);
      }
    }
    expect(school).toBeLessThan(independent * 0.8);
    expect(spread(a)).toBeLessThan(5);
  }, 20000);
  it('lets the chili school scatter and regroup after a close moving diver leaves', () => {
    const sim = new FishSimulation(
        spawnFish(open, [FISH_SPECIES.find((s) => s.id === 'chili-rasbora')!]),
        open,
      ),
      fish = sim.fish;
    const center = () => {
      const c = { x: 0, y: 0, z: 0 };
      for (const f of fish) {
        c.x += f.position.x / fish.length;
        c.y += f.position.y / fish.length;
        c.z += f.position.z / fish.length;
      }
      return c;
    };
    const spread = () => {
      const c = center();
      return Math.sqrt(
        fish.reduce(
          (n, f) =>
            n +
            (f.position.x - c.x) ** 2 +
            (f.position.y - c.y) ** 2 +
            (f.position.z - c.z) ** 2,
          0,
        ) / fish.length,
      );
    };
    for (let i = 0; i < 300; i++) sim.advance(1 / 30, true);
    const before = spread(),
      position = center();
    let peak = before,
      reaction = 0;
    for (let i = 0; i < 150; i++) {
      sim.advance(1 / 30, true, {
        position,
        velocity: { x: 2, y: 0, z: 0 },
        active: true,
      });
      peak = Math.max(peak, spread());
      reaction = Math.max(reaction, ...fish.map((f) => f.reaction.scatter));
    }
    for (let i = 0; i < 1800; i++) sim.advance(1 / 30, true);
    expect(reaction).toBeGreaterThan(0.3);
    expect(peak).toBeGreaterThan(before * 1.1);
    expect(spread()).toBeLessThan(peak);
    expect(fish.every((f) => f.reaction.scatter === 0)).toBe(true);
  });
  it('freezes new burst clocks/poses and agrees at 30/60/120 FPS', () => {
    const results = [30, 60, 120].map((fps) => {
      const sim = new FishSimulation(spawnFish(open), open);
      for (let i = 0; i < fps * 30; i++) sim.advance(1 / fps, true);
      const before = structuredClone(sim.fish);
      sim.advance(10, false);
      expect(sim.fish).toEqual(before);
      return sim.fish;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it.each([20, 40, 60] as const)(
    'keeps %i fish safe and moving for three minutes around actual rocks and ornaments',
    (count) => {
      const a = new Aquarium();
      try {
        const h = a.fish.simulation.habitat,
          sim = new FishSimulation(spawnFish(h, fishPopulation(count)), h),
          start = sim.fish.map((f) => ({ ...f.position }));
        for (let i = 0; i < 5400; i++) {
          let player;
          if (i > 1800 && i < 1950) {
            const f =
              sim.fish.find((f) => f.species.id === 'chili-rasbora') ??
              sim.fish[0];
            player = {
              position: {
                x: f.position.x - 0.5,
                y: f.position.y,
                z: f.position.z,
              },
              velocity: { x: 2, y: 0, z: 0 },
              active: true,
            };
          }
          sim.advance(1 / 30, true, player);
          if (i % 30 === 0)
            for (const f of sim.fish)
              expect(safeFishPosition(f.position, f.radius, h)).toBe(true);
        }
        expect(sim.fish.reduce((n, f) => n + f.corrections, 0)).toBe(0);
        expect(
          sim.fish.every(
            (f, i) =>
              Math.hypot(
                f.position.x - start[i].x,
                f.position.y - start[i].y,
                f.position.z - start[i].z,
              ) > 0.2,
          ),
        ).toBe(true);
      } finally {
        a.dispose();
      }
    },
    30000,
  );
});
describe('hardscape and grass habitat', () => {
  it('builds nine deterministic ornaments with valid convex component support and exact rendered union', () => {
    const a = new Aquarium();
    try {
      const q = a.hardscape,
        b = new HardscapeSystem(a.rockColliders);
      try {
        expect(q.formations.map((f) => f.kind)).toEqual([
          'branching',
          'branching',
          'branching',
          'rounded',
          'rounded',
          'rounded',
          'plate',
          'plate',
          'plate',
        ]);
        expect(q.colliders).toEqual(b.colliders);
        expect(a.rockColliders).toHaveLength(34);
        expect(q.colliders.length).toBeGreaterThan(20);
        const point = new THREE.Vector3();
        for (const f of q.formations) {
          const positions = f.mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).add(f.position);
            expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
            expect(f.colliders.some((c) => insideRock(point, 0.001, c))).toBe(
              true,
            );
          }
          for (const c of f.colliders)
            for (const p of c.planes)
              expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 5);
        }
      } finally {
        b.dispose();
      }
    } finally {
      a.dispose();
    }
  });
  it('blocks swept player motion through substantial plates and permits escape', () => {
    const a = new Aquarium();
    try {
      const f = a.hardscape.formations.find((f) => f.kind === 'plate')!,
        c = f.colliders[1],
        world = new CollisionWorld(f.colliders, AQUARIUM),
        s = {
          position: { x: f.position.x, y: c.max.y + 1, z: f.position.z },
          velocity: { x: 0, y: -5, z: 0 },
        };
      const from = { ...s.position };
      s.position.y -= 2;
      world.move(s, from.x, from.y, from.z);
      expect(s.position.y).toBeGreaterThan(c.max.y);
      expect(
        f.colliders.some((c) =>
          world.contains(c, s.position.x, s.position.y, s.position.z),
        ),
      ).toBe(false);
      // A domed face can retain a small downward tangential component while sliding.
      expect(
        f.colliders.some((c) =>
          c.planes.some(
            (n) =>
              Math.abs(
                n.x * s.position.x +
                  n.y * s.position.y +
                  n.z * s.position.z -
                  n.offset -
                  world.radius,
              ) < 0.002 &&
              n.x * s.velocity.x + n.y * s.velocity.y + n.z * s.velocity.z >=
                -1e-6,
          ),
        ),
      ).toBe(true);
      expect(Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z)).toBeLessThan(
        5,
      );
      const old = s.position.y;
      s.position.y += 0.5;
      s.velocity.y = 1;
      world.move(s, from.x, old, from.z);
      expect(s.position.y).toBeGreaterThan(old);
    } finally {
      a.dispose();
    }
  });
  it('generates organic mixed-height meadows deterministically using three blade batches', () => {
    const a = new Aquarium();
    try {
      const q = a.grass,
        b = new MeadowSystem(a.collision.colliders, a.plants.material);
      try {
        expect(q.patches).toEqual(b.patches);
        expect(q.patches).toHaveLength(8);
        expect(q.geometries).toHaveLength(3);
        expect(q.root.children).toHaveLength(3);
        expect(
          q.root.children.reduce(
            (n, m) => n + (m as THREE.InstancedMesh).count,
            0,
          ),
        ).toBeGreaterThan(960);
        expect(q.interests.every((p) => p.kind === 'grass-edge')).toBe(true);
        for (const patch of q.patches) {
          expect(Math.abs(patch.x) - patch.radius).toBeGreaterThan(3.2);
          expect(patch.blades).toBeGreaterThanOrEqual(120);
        }
        const heights: number[] = [],
          matrix = new THREE.Matrix4();
        for (const child of q.root.children) {
          const mesh = child as THREE.InstancedMesh;
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix);
            heights.push(
              Math.hypot(
                matrix.elements[0],
                matrix.elements[1],
                matrix.elements[2],
              ),
            );
            expect(matrix.elements[13]).toBeCloseTo(
              substrateHeight(matrix.elements[12], matrix.elements[14]) - 0.012,
              5,
            );
          }
        }
        expect(Math.max(...heights)).toBeGreaterThan(1);
        expect(Math.min(...heights)).toBeLessThan(0.25);
      } finally {
        b.dispose();
      }
    } finally {
      a.dispose();
    }
  });
  it('keeps meadow blades and their bent tips clear of all solid formations', () => {
    const a = new Aquarium(),
      point = new THREE.Vector3(),
      matrix = new THREE.Matrix4(),
      bend = { x: 0, y: 0, z: 0 };
    try {
      let intersections = 0;
      for (const child of a.grass.root.children) {
        const mesh = child as THREE.InstancedMesh,
          p = mesh.geometry.attributes.position,
          m = mesh.geometry.attributes.plantMotion;
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix);
          const scale = Math.hypot(
            matrix.elements[0],
            matrix.elements[1],
            matrix.elements[2],
          );
          const box = mesh.geometry
              .boundingBox!.clone()
              .applyMatrix4(matrix)
              .expandByScalar(0.3),
            nearby = a.collision.colliders.filter(
              (c) =>
                c.max.x >= box.min.x &&
                c.min.x <= box.max.x &&
                c.max.y >= box.min.y &&
                c.min.y <= box.max.y &&
                c.max.z >= box.min.z &&
                c.min.z <= box.max.z,
            );
          if (!nearby.length) continue;
          for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i).applyMatrix4(matrix);
            for (const time of [0, 5, 17]) {
              samplePlantBend(
                time,
                matrix.elements[12],
                matrix.elements[14],
                m.getY(i),
                m.getW(i),
                m.getX(i),
                bend,
              );
              for (const c of nearby)
                intersections += Number(
                  insideRock(
                    {
                      x: point.x + bend.x * scale,
                      y: point.y,
                      z: point.z + bend.z * scale,
                    },
                    0.005,
                    c,
                  ),
                );
            }
          }
        }
      }
      expect(intersections).toBe(0);
    } finally {
      a.dispose();
    }
  });
  it('raises flowing-plant tip motion selectively while roots and Anubias remain stable', () => {
    expect(PLANT_SPECIES[0].sway).toBeGreaterThan(0.045);
    expect(PLANT_SPECIES[1].sway).toBeGreaterThan(0.014);
    expect(PLANT_SPECIES[2].sway).toBeGreaterThan(0.025);
    expect(PLANT_SPECIES[3].sway).toBe(0.006);
    expect(PLANT_SPECIES[4].sway).toBeGreaterThan(0.022);
    const out = { x: 0, y: 0, z: 0 };
    for (const s of PLANT_SPECIES) {
      samplePlantBend(4, 3, 2, 1, s.frequency, 0, out);
      expect(Math.hypot(out.x, out.y, out.z)).toBe(0);
    }
  });
  it('releases ornament, meadow and instancing resources exactly once without owning shared plant material', () => {
    const a = new Aquarium(),
      resources = [
        ...a.hardscape.geometries,
        ...a.hardscape.materials,
        ...a.grass.geometries,
      ],
      spies = resources.map((r) => vi.spyOn(r, 'dispose')),
      shared = vi.spyOn(a.plants.material, 'dispose');
    a.grass.dispose();
    a.grass.dispose();
    expect(shared).not.toHaveBeenCalled();
    a.hardscape.dispose();
    a.hardscape.dispose();
    a.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(shared).toHaveBeenCalledTimes(1);
  });
});
