import * as THREE from 'three';
import { GelatinousMaterial } from '../src/rendering/Gelatinous';
import { describe, expect, it } from 'vitest';
import { CAVE_SIGHTS, ICE_SIGHTS, OUTER_SIGHTS } from '../src/discovery/sights';
import {
  SightingTracker,
  SIGHTING,
  type SightCandidate,
} from '../src/discovery/journal';
import { TANK_BABIES } from '../src/config/babies';
import { TankCatalog } from '../src/catalog/catalog';
import { TankBaby } from '../src/creatures/babies/TankBaby';
import { CaveEncrusting } from '../src/environment/cave/CaveEncrusting';
import { IceUnderside } from '../src/environment/ice/IceUnderside';
import { ChristmasTreeWorms } from '../src/environment/outer/ChristmasTreeWorms';

const AMBIENT_SIGHTS = [
  CAVE_SIGHTS.encrustingSponge,
  CAVE_SIGHTS.tubeSponge,
  CAVE_SIGHTS.seaSquirt,
  CAVE_SIGHTS.mysid,
  ICE_SIGHTS.iceAlgae,
  ICE_SIGHTS.seaAngel,
  OUTER_SIGHTS.christmasTreeWorm,
];

describe('seven ambient discoveries can come home', () => {
  it('registers real world positions, discovers each kind and unlocks its tank entry', () => {
    const cave = new CaveEncrusting(20),
      ice = new IceUnderside(),
      coral = new THREE.SphereGeometry(1, 20, 12),
      worms = new ChristmasTreeWorms([
        {
          geometry: coral,
          matrices: [new THREE.Matrix4().makeTranslation(0, 1, 0)],
        },
      ]);
    try {
      const candidates = [
        ...cave.sightings,
        ...ice.sightings,
        ...worms.sightings,
      ];
      const model = new TankCatalog([], {
        keepOut: [],
        routes: [],
        surface: () => 0,
      });
      for (const sight of AMBIENT_SIGHTS) {
        const candidate = candidates.find((c) => c.id === sight.id);
        expect(candidate, sight.label).toBeDefined();
        const c = candidate!,
          p = c.position,
          tracker = new SightingTracker([]);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(
          tracker.update(
            [c],
            { x: p.x, y: p.y, z: p.z + 2 },
            { x: 0, y: 0, z: -1 },
            SIGHTING.dwell + 0.1,
          )?.id,
        ).toBe(sight.id);
        const definition = TANK_BABIES.find((b) => b.sighting === sight.id)!;
        expect(definition, sight.label).toBeDefined();
        expect(model.addBaby(definition.id, [])).toBe(false);
        expect(
          model.addBaby(definition.id, [{ id: sight.id, first: '' }]),
        ).toBe(true);
      }
      expect(model.babies).toHaveLength(7);
    } finally {
      cave.dispose();
      ice.dispose();
      worms.dispose();
      coral.dispose();
    }
    expect(cave.sightings).toHaveLength(0);
    expect(ice.sightings).toHaveLength(0);
    expect(worms.sightings).toHaveLength(0);
  });
  it('keeps drifting sight positions aligned with the drawn instances and still when paused', () => {
    const cave = new CaveEncrusting(20),
      ice = new IceUnderside();
    try {
      const matrix = new THREE.Matrix4(),
        position = new THREE.Vector3();
      for (const [owner, id, name] of [
        [cave, CAVE_SIGHTS.mysid.id, 'Mysid swarm'],
        [ice, ICE_SIGHTS.seaAngel.id, 'Sea angels'],
      ] as const) {
        const sight = owner.sightings.find(
          (c) => c.id === id,
        ) as SightCandidate;
        const at = sight.position,
          before = { ...at };
        owner.update(0.1, true, false);
        expect(sight.position).toBe(at);
        expect(at).not.toEqual(before);
        (owner.root.getObjectByName(name) as THREE.InstancedMesh).getMatrixAt(
          0,
          matrix,
        );
        position.setFromMatrixPosition(matrix);
        expect(
          position.distanceTo(new THREE.Vector3(at.x, at.y, at.z)),
        ).toBeLessThan(1e-5);
        const paused = { ...at };
        owner.update(0.1, false, false);
        expect(at).toEqual(paused);
      }
    } finally {
      cave.dispose();
      ice.dispose();
    }
  });
  it('seats thin algae on the floor without stacking stationary collections', () => {
    const d = TANK_BABIES.find((b) => b.id === 'ice-algae')!,
      h = { solids: [], floor: () => 0 },
      eye = { x: 0, y: 4, z: 0 };
    const first = new TankBaby(d, h, eye),
      second = new TankBaby(d, h, eye, [first]);
    expect(first.position.y).toBeCloseTo(0.03);
    expect(second.position.y).toBeCloseTo(0.03);
    expect(
      Math.hypot(
        first.position.x - second.position.x,
        first.position.z - second.position.z,
      ),
    ).toBeGreaterThanOrEqual(first.radius + second.radius + 0.25);
  });
});

it('retains translucent native materials while collection entries fade', async () => {
  const { acquireCollectionArt } =
    await import('../src/environment/TankCollectionArt');
  const loader = {
    acquire: () => Promise.reject(Error('No asset needed')),
    evictUnused: () => {},
  };
  // V0.7 Pass 078: sea squirts use the shared gelatinous material, whose translucency lives in
  // its shader (a see-through core and opaque rim) at an opacity of 1, so a half fade is 0.5 and
  // the material must still be gelatinous. The others keep a flat native opacity.
  for (const [id, alpha] of [
    ['sea-squirt', 1],
    ['sea-angel', 0.8],
    ['ice-algae', 0.6],
  ] as const) {
    const d = TANK_BABIES.find((b) => b.id === id)!,
      art = await acquireCollectionArt(d, loader);
    try {
      art.update(0.5, 0, 0);
      const mesh = art.near as THREE.Mesh,
        material = mesh.material as THREE.Material;
      expect(material.opacity).toBeCloseTo(alpha * 0.5);
      if (id === 'sea-squirt') {
        expect(material).toBeInstanceOf(GelatinousMaterial);
        expect((material as GelatinousMaterial).gel.gelCore.value).toBeLessThan(
          0.5,
        );
      }
    } finally {
      art.dispose();
    }
  }
});
