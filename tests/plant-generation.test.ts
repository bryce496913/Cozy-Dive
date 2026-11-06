import { AQUARIUM } from '../src/config/world';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { samplePlantBend } from '../src/environment/PlantAnimation';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  PLANT_SPECIES,
  PLANT_TEMPLATES,
} from '../src/environment/PlantSpecies';
import { createPlantGeometry } from '../src/environment/PlantGeometry';
import { PlantSystem } from '../src/environment/PlantSystem';
import { Aquarium } from '../src/environment/Aquarium';
import { insideRock, safeFishPosition } from '../src/fish/FishHabitat';
import { selectBehaviorTarget } from '../src/fish/FishBehavior';
import { spawnFish } from '../src/fish/FishSpawner';
import { FishSimulation } from '../src/fish/FishMovement';

describe('procedural plant templates', () => {
  it('registers all five distinct freshwater families', () => {
    expect(PLANT_SPECIES.map((s) => s.id)).toEqual([
      'vallisneria',
      'amazon-sword',
      'java-fern',
      'anubias',
      'dwarf-hairgrass',
    ]);
    expect(PLANT_SPECIES.reduce((n, s) => n + s.count, 0)).toBe(65);
  });
  it.each(PLANT_SPECIES)(
    'builds deterministic finite curved geometry for $name',
    (species) => {
      const a = createPlantGeometry(species, 291),
        b = createPlantGeometry(species, 291),
        c = createPlantGeometry(species, 292);
      try {
        expect(Array.from(a.attributes.position.array)).toEqual(
          Array.from(b.attributes.position.array),
        );
        expect(Array.from(a.attributes.position.array)).not.toEqual(
          Array.from(c.attributes.position.array),
        );
        const p = a.attributes.position,
          n = a.attributes.normal,
          m = a.attributes.plantMotion;
        let maxY = 0,
          bases = 0,
          tips = 0;
        for (let i = 0; i < p.count; i++) {
          expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
          expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
          maxY = Math.max(maxY, p.getY(i));
          if (m.getX(i) === 0) bases++;
          if (m.getX(i) > species.sway * 0.9) tips++;
          expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThan(
            species.reach + species.width * 0.5 + 0.1,
          );
        }
        expect(maxY).toBeGreaterThan(0.5);
        expect(maxY).toBeLessThanOrEqual(1);
        expect(bases).toBeGreaterThan(10);
        expect(tips).toBeGreaterThan(10);
        expect(a.index!.count).toBeGreaterThan(200);
      } finally {
        a.dispose();
        b.dispose();
        c.dispose();
      }
    },
  );
  it('reuses instanced buffers and disposes every resource exactly once', () => {
    const system = new PlantSystem([]);
    const resources = [...system.geometries, system.material],
      spies = resources.map((r) => vi.spyOn(r, 'dispose'));
    const batches = system.root.children;
    expect(batches.length).toBeLessThanOrEqual(
      PLANT_SPECIES.length * PLANT_TEMPLATES,
    );
    expect(batches.every((b) => b instanceof THREE.InstancedMesh)).toBe(true);
    const attributes = system.geometries.map(
      (g) => g.attributes.position.array,
    );
    const contents = attributes.map((a) => Array.from(a));
    for (let i = 0; i < 600; i++) system.update(1 / 60, true, false);
    expect(system.geometries.map((g) => g.attributes.position.array)).toEqual(
      attributes,
    );
    expect(
      system.geometries.map((g) => Array.from(g.attributes.position.array)),
    ).toEqual(contents);
    system.dispose();
    system.dispose();
    system.update(1, true, false);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(system.root.children).toHaveLength(0);
  });
});
it.each([
  [48193, 1],
  [48193, 2],
  [1729, 1],
  [9271, 1],
])(
  'keeps static and bent plant vertices outside rocks at seed %i / density %i',
  (seed, density) => {
    const aquarium = new Aquarium();
    try {
      const q = new PlantSystem(aquarium.collision.colliders, density, seed),
        point = new THREE.Vector3(),
        matrix = new THREE.Matrix4();
      let intersections = 0;
      const bend = { x: 0, y: 0, z: 0 };
      for (const mesh of q.root.children) {
        if (!(mesh instanceof THREE.InstancedMesh)) continue;
        const positions = mesh.geometry.attributes.position;
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix);
          const box = mesh.geometry
            .boundingBox!.clone()
            .applyMatrix4(matrix)
            .expandByScalar(0.4);
          const nearby = aquarium.collision.colliders.filter(
            (r) =>
              r.max.x >= box.min.x &&
              r.min.x <= box.max.x &&
              r.max.y >= box.min.y &&
              r.min.y <= box.max.y &&
              r.max.z >= box.min.z &&
              r.min.z <= box.max.z,
          );
          const scale = Math.hypot(
            matrix.elements[0],
            matrix.elements[1],
            matrix.elements[2],
          );
          if (!nearby.length) continue;
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
            const motion = mesh.geometry.attributes.plantMotion;
            for (const time of [0, 9, 45]) {
              samplePlantBend(
                time,
                matrix.elements[12],
                matrix.elements[14],
                motion.getY(i),
                motion.getW(i),
                motion.getX(i),
                bend,
              );
              for (const rock of nearby)
                if (
                  insideRock(
                    {
                      x: point.x + bend.x * scale,
                      y: point.y,
                      z: point.z + bend.z * scale,
                    },
                    0.015,
                    rock,
                  )
                )
                  intersections++;
            }
          }
        }
      }
      expect(intersections).toBe(0);
      expect(aquarium.rockColliders).toHaveLength(34);
      q.dispose();
    } finally {
      aquarium.dispose();
    }
  },
  15000,
);
it('finds a nearby safe inspection region when bounded random trials miss sparse habitat', () => {
  const f = spawnFish(
    {
      bounds: AQUARIUM,
      rocks: [],
    },
    [{ ...FISH_SPECIES[2], count: 1 }],
  )[0];
  Object.assign(f.position, { x: 0, y: 6, z: 0 });
  f.behavior.randomState = 0;
  const point = {
    kind: 'plant' as const,
    position: { x: 2, y: 5, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
  };
  const far = { ...point, position: { x: 99, y: 5, z: 99 } };
  let predicted = 0;
  const randomIndices = [];
  for (let i = 0; i < 24; i++) {
    predicted = (Math.imul(predicted, 1664525) + 1013904223) >>> 0;
    randomIndices.push(Math.floor((predicted / 4294967296) * 151));
    predicted = (Math.imul(predicted, 1664525) + 1013904223) >>> 0;
  }
  expect(randomIndices).not.toContain(0);
  const habitat = {
    bounds: AQUARIUM,
    rocks: [],
    interests: [point, ...Array.from({ length: 150 }, () => far)],
  };
  expect(selectBehaviorTarget(f, habitat, true)).toBe(true);
  expect(f.behavior.randomState).toBe(predicted);
  expect(safeFishPosition(f.behavior.target, f.radius, habitat)).toBe(true);
});
it('exposes matching plant metadata and preserves safe exploration, foraging and scatter near plants', () => {
  const aquarium = new Aquarium();
  try {
    const system = aquarium.plants,
      habitat = aquarium.fish.simulation.habitat;
    expect(system.interests).toHaveLength(65);
    system.interests.forEach((p, i) => {
      const plant = system.placements[i];
      expect(p.vegetation?.species).toBe(plant.species.id);
      expect(p.vegetation?.region).toBe(plant.region);
      expect(p.vegetation?.height).toBe(plant.height);
      expect(
        Math.hypot(
          p.position.x - plant.position.x,
          p.position.z - plant.position.z,
        ),
      ).toBeLessThan(plant.radius);
      expect(p.position.y).toBeLessThan(plant.position.y + plant.height);
      expect(safeFishPosition(p.position, 0.1, habitat)).toBe(true);
    });
    let successes = 0;
    const sim = new FishSimulation(spawnFish(habitat), habitat);
    for (const f of sim.fish)
      for (let i = 0; i < 20; i++)
        if (selectBehaviorTarget(f, habitat, true)) {
          successes++;
          expect(
            safeFishPosition(f.behavior.target, f.radius + 0.1, habitat),
          ).toBe(true);
        }
    expect(successes).toBeGreaterThan(5);
    const f = sim.fish[14],
      plant = system.placements.find((p) => p.species.broadLeaves)!;
    Object.assign(f.position, {
      x: plant.position.x,
      y: plant.height + f.radius + 1,
      z: plant.position.z,
    });
    Object.assign(f.behavior, {
      activity: 'foraging',
      elapsed: 0,
      duration: 20,
    });
    Object.assign(f.behavior.target, f.position);
    for (let i = 0; i < 60; i++)
      sim.advance(1 / 30, true, {
        position: { x: f.position.x - 0.5, y: f.position.y, z: f.position.z },
        velocity: { x: 2, y: 0, z: 0 },
        active: true,
      });
    expect(f.behavior.activity).toBe('recovering');
    expect(f.reaction.scatter).toBeGreaterThan(0.1);
    expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
  } finally {
    aquarium.dispose();
  }
});
