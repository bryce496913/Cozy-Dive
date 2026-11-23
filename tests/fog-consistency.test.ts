import { testGeology } from '../validation/geologyModel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DENSE_WATER_FOG } from '../src/config/waterVisibility';
import { CAVE, OUTER } from '../src/config/passage';
import { WRECK } from '../src/config/wreck';
import { WATER_PROFILES } from '../src/config/waterProfiles';
import { waterVeil } from '../src/rendering/deepFog';
import { CaveEnvironment } from '../src/environment/cave/CaveEnvironment';
import { WreckEnvironment } from '../src/environment/wreck/WreckEnvironment';
import { IceEnvironment } from '../src/environment/ice/IceEnvironment';
import {
  PASSAGE_GLOW,
  PassageGlow,
  passageGlowStrength,
} from '../src/environment/shared/PassageGlow';

/** V0.8 Passes 089 and 091: the outer reef's dense murk, shared by the shipwreck, sea cave and ice. */
const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

describe('V0.8 Pass 089 shared dense-water fog', () => {
  it('keeps the outer reef exactly as approved and shares it with the wreck and cave', () => {
    expect(DENSE_WATER_FOG).toBe(0.13);
    expect(OUTER.fog).toBe(DENSE_WATER_FOG);
    for (const id of ['outer', 'wreck', 'cave', 'ice'] as const)
      expect(WATER_PROFILES[id].fogDensity, id).toBe(DENSE_WATER_FOG);
    expect(WRECK.fog).toBe(DENSE_WATER_FOG);
    expect(CAVE.fog).toBe(DENSE_WATER_FOG);
  });

  it('leaves the aquarium and kelp forest in their own clearer water', () => {
    for (const id of ['tank', 'kelp'] as const)
      expect(WATER_PROFILES[id].fogDensity, id).toBeLessThan(DENSE_WATER_FOG);
  });

  it('keeps each world its own water colour (its own tint with distance)', () => {
    const colours = (['outer', 'wreck', 'cave', 'ice'] as const).map(
      (id) => WATER_PROFILES[id].water,
    );
    expect(new Set(colours).size).toBe(4);
    // The same density veils each to the same degree, through its own spectrum.
    const veil = (id: 'outer' | 'wreck' | 'cave' | 'ice') =>
      waterVeil(14, DENSE_WATER_FOG, rgb(WATER_PROFILES[id].water));
    for (const id of ['outer', 'wreck', 'cave', 'ice'] as const)
      expect(Math.min(...veil(id)), id).toBeGreaterThan(0.9);
  });

  it('keeps close range comfortable: forms within 3 m are mostly clear', () => {
    for (const id of ['wreck', 'cave', 'ice'] as const) {
      const near = waterVeil(3, DENSE_WATER_FOG, rgb(WATER_PROFILES[id].water));
      expect(Math.max(...near), id).toBeLessThan(0.3);
    }
    // The wreck's torch reaches past the distance the murk swallows (so it lights what is seen).
    const dark = waterVeil(
      WRECK.torch.distance,
      DENSE_WATER_FOG,
      rgb(WRECK.water),
    );
    expect(Math.min(...dark)).toBeGreaterThan(0.95);
  });
});

describe('V0.8 Pass 089 passage glows', () => {
  it('fades out before the swimmer reaches it, and shows from across the water', () => {
    expect(passageGlowStrength(0)).toBe(0);
    expect(passageGlowStrength(PASSAGE_GLOW.near)).toBe(0);
    expect(passageGlowStrength(PASSAGE_GLOW.far)).toBe(1);
    expect(passageGlowStrength(20)).toBe(1);
    const g = new PassageGlow({
      name: 'test glow',
      at: { x: 0, y: 0, z: 0 },
      facing: { x: 0, y: 0, z: 1 },
      radius: 1,
      tint: [1, 1, 1],
      peak: 0.5,
    });
    const m = g.mesh.material as THREE.MeshBasicMaterial;
    expect(m.fog).toBe(false);
    g.update({ x: 0, y: 0, z: 2 });
    expect(g.mesh.visible).toBe(false);
    g.update({ x: 0, y: 0, z: 15 });
    expect(m.opacity).toBeCloseTo(0.5, 6);
    g.dispose();
  });

  it('marks both cave tunnels, and keeps the sunbeam clear of the murk', () => {
    const cave = new CaveEnvironment(testGeology());
    try {
      for (const name of ['Cave entrance glow', 'Cave back tunnel glow'])
        expect(cave.root.getObjectByName(name), name).toBeDefined();
      for (const name of [
        'Cave light shaft',
        'Cave light pool',
        'Cave skylight',
      ]) {
        const mesh = cave.root.getObjectByName(name) as THREE.Mesh;
        expect(
          (mesh.material as THREE.Material & { fog: boolean }).fog,
          name,
        ).toBe(false);
      }
    } finally {
      cave.dispose();
    }
  });

  it('marks the tunnel home under the ice, and keeps the breathing holes clear of the murk', () => {
    const ice = new IceEnvironment();
    try {
      expect(ice.root.getObjectByName('Ice tunnel glow')).toBeDefined();
      const lit = ice.root.children.filter(
        (o) =>
          o.name === 'Breathing hole light' ||
          o.name === 'Breathing hole daylight',
      ) as THREE.Mesh[];
      expect(lit.length).toBeGreaterThan(0);
      for (const m of lit)
        expect(
          (m.material as THREE.Material & { fog: boolean }).fog,
          m.name,
        ).toBe(false);
    } finally {
      ice.dispose();
    }
  });

  it('marks the shaft home in the wreck', () => {
    const wreck = new WreckEnvironment();
    try {
      const glow = wreck.root.getObjectByName('Wreck shaft glow') as THREE.Mesh;
      expect(glow).toBeDefined();
      wreck.updatePassages({ x: glow.position.x, y: 5, z: glow.position.z });
      expect(glow.visible).toBe(true);
    } finally {
      wreck.dispose();
    }
  });
});
