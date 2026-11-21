import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ReefAsset } from '../validation/ReefAsset';
import {
  softCoralGeometry,
  spongeGeometry,
} from '../src/environment/ice/IceGarden';
import { barrelSponge, softCoral } from '../src/environment/wreck/WreckGrowth';
import {
  cushionGeometry,
  squirtClusterGeometry,
  tubeClusterGeometry,
} from '../src/environment/cave/CaveEncrusting';

/** V0.7 Pass 069: grown coral forms, unchanged colliders and budgets, smooth code-built growth. */
const reef = new ReefAsset('public/assets/models/reef/reef-environment.glb');
const doc = reef.doc as unknown as {
  nodes: { name: string; mesh?: number }[];
  meshes: { primitives: { indices: number }[] }[];
  accessors: { count: number }[];
};
const tris = (name: string) => {
  const n = doc.nodes.find((x) => x.name === name);
  if (!n || n.mesh === undefined) return 0;
  return doc.meshes[n.mesh].primitives.reduce(
    (s, p) => s + doc.accessors[p.indices].count / 3,
    0,
  );
};
const colliders = (name: string) =>
  doc.nodes.filter((n) => n.name.startsWith(`COLLIDER_${name}_`)).length;

describe('V0.7 Pass 069 reef library corals', () => {
  it.each([0, 1, 2])(
    'massive coral %i is one grown colony surface within its budget, with its distance level',
    (i) => {
      const near = tris(`Coral_Massive_${i}`),
        far = tris(`Coral_Massive_${i}_LOD1`);
      // One level-6 (Porites level-5) surface: the same budget as the old per-lobe balls.
      expect(near).toBe(i < 2 ? 81920 : 20480);
      expect(far).toBe(5120);
      expect(colliders(`Coral_Massive_${i}`)).toBe(4);
    },
  );
  it.each([0, 1, 2])(
    'branching coral %i keeps its colliders and a much lighter distance level',
    (i) => {
      const near = tris(`Coral_Branching_${i}`),
        far = tris(`Coral_Branching_${i}_LOD1`);
      expect(colliders(`Coral_Branching_${i}`)).toBe(5);
      expect(near).toBeLessThan(60000);
      // Junction collars and corallites stay near-only; the far level is the bare skeleton.
      expect(far).toBeLessThan(near * 0.55);
      expect(tris(`Coral_Branching_${i}_Tips`)).toBeGreaterThan(0);
    },
  );
  it.each([0, 1, 2])('plate coral %i keeps its colliders and budget', (i) => {
    expect(colliders(`Coral_Plate_${i}`)).toBe(4);
    expect(tris(`Coral_Plate_${i}`)).toBeLessThan(24000);
  });
  it('sits the massive colonies on their base (no floating underside)', () => {
    for (const i of [0, 1, 2]) {
      const p = reef.primitive(`Coral_Massive_${i}`).positions;
      let lo = Infinity;
      for (let k = 1; k < p.length; k += 3) lo = Math.min(lo, p[k]);
      // The colony's lowest skin reaches its collider floor.
      const cp = reef.primitive(`COLLIDER_Coral_Massive_${i}_0`).positions;
      let floor = Infinity;
      for (let k = 1; k < cp.length; k += 3) floor = Math.min(floor, cp[k]);
      expect(lo).toBeLessThan(floor + 0.08);
    }
  });
});

describe('V0.7 Pass 069 code-built growth', () => {
  const growth: [string, () => THREE.BufferGeometry][] = [
    ['ice soft coral', softCoralGeometry],
    ['glass sponge', spongeGeometry],
    ['wreck soft coral', () => softCoral()],
    ['barrel sponge', barrelSponge],
    ['cave cushion', cushionGeometry],
    ['cave tubes', tubeClusterGeometry],
    ['sea squirts', squirtClusterGeometry],
  ];
  it.each(growth)(
    '%s is non-indexed with smooth normals and finite positions',
    (_n, build) => {
      const g = build();
      expect(g.index).toBeNull();
      const p = g.getAttribute('position'),
        n = g.getAttribute('normal');
      expect(n.count).toBe(p.count);
      expect((p.array as Float32Array).every(Number.isFinite)).toBe(true);
      // Smooth: most triangles' vertex normals differ from each other (not one flat normal).
      let curved = 0;
      const a = new THREE.Vector3(),
        b = new THREE.Vector3();
      for (let i = 0; i + 2 < n.count; i += 3) {
        a.fromBufferAttribute(n, i);
        b.fromBufferAttribute(n, i + 1);
        if (a.dot(b) < 0.9999) curved++;
      }
      expect(curved / (n.count / 3)).toBeGreaterThan(0.5);
      g.dispose();
    },
  );
  it('grows the ice soft coral as continuous clubs (no loose tip spheres)', () => {
    const g = softCoralGeometry();
    g.computeBoundingBox();
    const size = g.boundingBox!.getSize(new THREE.Vector3());
    // The same unit-height colony.
    expect(size.y).toBeGreaterThan(0.6);
    expect(size.y).toBeLessThan(1.2);
    g.dispose();
  });
});
