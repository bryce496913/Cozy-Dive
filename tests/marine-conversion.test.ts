import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { FISH_SPECIES, fishPopulation } from '../src/fish/FishSpecies';
import { FishGeometry } from '../src/fish/FishGeometry';
import { FishSimulation } from '../src/fish/FishMovement';
import { spawnFish } from '../src/fish/FishSpawner';
import { safeFishPosition, clearFishRoute } from '../src/fish/FishHabitat';
import { AQUARIUM } from '../src/config/world';
import { PLANT_SPECIES } from '../src/environment/PlantSpecies';
import { reefSurfaceHeight } from '../src/environment/MarineHabitat';

describe('tropical marine identity', () => {
  it('replaces the active roster with exactly 40 marine fish and a temporary 60-fish stress registry', () => {
    expect(FISH_SPECIES.map((s) => [s.id, s.count])).toEqual([
      ['blue-green-chromis', 20],
      ['pajama-cardinalfish', 6],
      ['firefish-goby', 6],
      ['yellow-assessor', 4],
      ['royal-gramma', 2],
      ['ocellaris-clownfish', 3],
    ]);
    expect(fishPopulation('dense').reduce((n, s) => n + s.count, 0)).toBe(61);
    expect(new Set(FISH_SPECIES.map((s) => s.marking)).size).toBe(6);
  });
  it.each(FISH_SPECIES)(
    'builds a shared dimensional $name silhouette with bounded fins and facial detail',
    (species) => {
      const template = new FishGeometry(species),
        visual = template.create(1),
        point = new THREE.Vector3();
      try {
        visual.root.updateMatrixWorld(true);
        let maximum = 0;
        visual.root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const p = o.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
              point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
              maximum = Math.max(maximum, point.length());
            }
          }
        });
        expect(maximum).toBeLessThanOrEqual(
          species.length * (species.radiusFactor ?? 0.56) + 1e-4,
        );
        expect(template.geometries.size).toBe(5);
        expect(template.materials.size).toBe(2);
        expect(visual.tail.children).toHaveLength(1);
        expect(visual.leftPectoral.geometry).toBe(
          visual.rightPectoral.geometry,
        );
        if (species.id === 'firefish-goby') {
          const fins = [...template.geometries][2];
          fins.computeBoundingBox();
          expect(fins.boundingBox!.max.y).toBeGreaterThan(species.height * 2.5);
        }
        if (species.id === 'pajama-cardinalfish') {
          const tint = new THREE.Color(species.secondaryAccent!);
          let spots = 0;
          for (const g of template.geometries) {
            const c = g.attributes.color,
              p = g.attributes.position,
              n = g.attributes.normal;
            for (let i = 0; i < c.count; i++) {
              if (
                Math.abs(c.getX(i) - tint.r) +
                  Math.abs(c.getY(i) - tint.g) +
                  Math.abs(c.getZ(i) - tint.b) <
                1e-5
              ) {
                spots++;
                expect(n.getZ(i) * p.getZ(i)).toBeGreaterThan(0);
              }
            }
          }
          expect(spots).toBeGreaterThan(100);
        }
      } finally {
        template.dispose();
      }
    },
  );
  it('keeps biological categories, attached living colonies and all seven safe marine anchor kinds', () => {
    const a = new Aquarium();
    try {
      expect(PLANT_SPECIES.map((s) => s.id)).toEqual([
        'turtle-grass',
        'caulerpa',
        'red-macroalgae',
        'halimeda',
        'soft-coral',
        'sea-fan',
      ]);
      expect(PLANT_SPECIES.filter((s) => s.category === 'coral')).toHaveLength(
        2,
      );
      expect(
        a.hardscape.formations.filter((f) => f.role === 'stony-coral'),
      ).toHaveLength(6);
      expect(
        a.hardscape.formations.filter((f) => f.role === 'ornament'),
      ).toHaveLength(3);
      for (const f of a.hardscape.formations.filter(
        (f) => f.role === 'stony-coral',
      )) {
        const heights = a.rockColliders
          .map((r) => reefSurfaceHeight(r, f.position.x, f.position.z))
          .filter((y): y is number => y !== undefined);
        expect(
          heights.some((y) => Math.abs(y - 0.025 - f.position.y) < 1e-5),
        ).toBe(true);
        expect(f.mesh.children).toHaveLength(1);
      }
      for (const p of a.plants.placements.filter(
        (p) => p.species.category === 'coral',
      )) {
        expect(p.position.y).toBeGreaterThan(0.3);
        expect(Math.hypot(p.normal.x, p.normal.y, p.normal.z)).toBeCloseTo(1);
      }
      const h = a.fish.simulation.habitat;
      expect([...new Set(h.interests!.map((p) => p.kind))]).toEqual(
        expect.arrayContaining([
          'open-reef',
          'seagrass-meadow',
          'sandy-floor',
          'sheltered-crevice',
          'reef-face',
          'coral-edge',
          'shaded-overhang',
        ]),
      );
      const reef = h.interests!.filter(
        (p) =>
          p.anchorId?.startsWith('reef-') ||
          p.anchorId?.startsWith('overhang-'),
      );
      expect(reef.length).toBeGreaterThan(10);
      for (const p of reef)
        expect(
          safeFishPosition(
            p.position,
            p.kind === 'shaded-overhang' ? 0.5 : 0.65,
            h,
          ),
        ).toBe(true);
      for (const f of a.fish.simulation.fish.filter(
        (f) => f.species.homeRadius,
      )) {
        expect(f.shelter).toBeDefined();
        expect(safeFishPosition(f.shelter!, f.radius + 0.15, h)).toBe(true);
      }
    } finally {
      a.dispose();
    }
  });
  it('lets shy firefish retreat toward safe shelter without teleporting, then recover', () => {
    const home = { x: 0, y: 3, z: -3 },
      s = FISH_SPECIES[2],
      habitat = {
        bounds: AQUARIUM,
        rocks: [],
        interests: [
          {
            kind: 'sheltered-crevice' as const,
            position: home,
            normal: { x: 0, y: 0, z: 1 },
          },
        ],
      };
    const f = spawnFish(habitat, [{ ...s, count: 1 }], 38147, {
      x: 15,
      y: 10,
      z: 10,
    })[0];
    Object.assign(f.position, { x: 2, y: 3, z: -3 });
    Object.assign(f.previousPosition, f.position);
    f.yaw = f.previousYaw = Math.PI;
    f.pitch = f.previousPitch = 0;
    expect(clearFishRoute(f.position, home, f.radius, habitat)).toBe(true);
    const sim = new FishSimulation([f], habitat);
    let peak = 0;
    for (let i = 0; i < 90; i++) {
      const p = { ...f.position };
      sim.advance(1 / 30, true, {
        position: { x: 3, y: 3, z: -3 },
        velocity: { x: -2, y: 0, z: 0 },
        active: true,
      });
      peak = Math.max(peak, f.reaction.scatter);
      expect(
        Math.hypot(f.position.x - p.x, f.position.y - p.y, f.position.z - p.z),
      ).toBeLessThan(0.07);
      expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(
      Math.hypot(
        f.position.x - home.x,
        f.position.y - home.y,
        f.position.z - home.z,
      ),
    ).toBeLessThan(2);
    for (let i = 0; i < 1800; i++) sim.advance(1 / 30, true);
    expect(f.reaction.scatter).toBeLessThan(0.01);
    expect(f.corrections).toBe(0);
  });
});
