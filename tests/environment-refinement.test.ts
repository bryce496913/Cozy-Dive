import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { limestoneGeometry } from '../src/environment/shared/LimestoneGeometry';
import { carveConvexHull } from '../src/environment/RockGeometry';
import { rockCollider } from '../src/environment/rockCollider';
import { IceGarden } from '../src/environment/ice/IceGarden';
import {
  backShell,
  contouredCushion,
} from '../src/environment/office/OfficeFurniture';

/** V0.7 Pass 079: secondary environment art, with collision and habitats unchanged. */
describe('V0.7 Pass 079 cave boulders', () => {
  it.each([
    [34100, 0],
    [34113, 1],
    [34126, 2],
  ])(
    'limestone %i/%i carves inside its hull, with the same collider and bounds as before',
    (seed, family) => {
      const plain = limestoneGeometry(seed, family),
        carved = limestoneGeometry(seed, family, true),
        m = new THREE.Matrix4().compose(
          new THREE.Vector3(3, 1, -20),
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            0.7,
          ),
          new THREE.Vector3(2.4, 1.5, 2.1),
        );
      plain.computeBoundingBox();
      carved.computeBoundingBox();
      expect(
        carved.boundingBox!.min.distanceTo(plain.boundingBox!.min),
      ).toBeLessThan(1e-6);
      expect(
        carved.boundingBox!.max.distanceTo(plain.boundingBox!.max),
      ).toBeLessThan(1e-6);
      const a = rockCollider(plain, m),
        b = rockCollider(carved, m);
      expect(b.planes.length).toBe(a.planes.length);
      for (const k of ['x', 'y', 'z'] as const) {
        expect(Math.abs(b.min[k] - a.min[k])).toBeLessThan(1e-5);
        expect(Math.abs(b.max[k] - a.max[k])).toBeLessThan(1e-5);
      }
      // Every rendered vertex lies inside the collider (routes can only get roomier).
      const local = rockCollider(carved, new THREE.Matrix4()),
        p = carved.getAttribute('position'),
        v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        for (const pl of local.planes)
          expect(pl.x * v.x + pl.y * v.y + pl.z * v.z - pl.offset).toBeLessThan(
            1e-5,
          );
      }
      plain.dispose();
      carved.dispose();
    },
  );
  it('cuts deeper into the silhouette with massing than the plain carve', () => {
    const hull = Array.from(
      new THREE.IcosahedronGeometry(1, 1)
        .toNonIndexed()
        .getAttribute('position').array,
    );
    const depth = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      let sum = 0;
      for (let i = 0; i < p.count; i++)
        sum += 1 - new THREE.Vector3().fromBufferAttribute(p, i).length();
      return sum / p.count;
    };
    const plain = carveConvexHull(hull, 0, 3, 7),
      massed = carveConvexHull(hull, 0, 3, 7, {
        cuts: 3,
        cutLow: 0.5,
        clefts: 2,
        cleftDepth: 0.2,
        cleftWidth: 0.16,
      });
    expect(depth(massed)).toBeGreaterThan(depth(plain) * 1.15);
  });
});

describe('V0.7 Pass 079 under-ice garden', () => {
  it('keeps every species and count, gathered into clumps with open sand lanes', () => {
    const g = new IceGarden([]);
    try {
      const counts = Object.fromEntries(
        g.root.children.map((m) => [m.name, (m as THREE.InstancedMesh).count]),
      );
      expect(counts['Glass sponges']).toBe(110);
      expect(counts['Soft corals']).toBe(120);
      expect(counts['Antarctic sea stars']).toBe(110);
      expect(counts['Feather stars']).toBe(50);
      // Sponges and corals keep out of the three sand lanes.
      const lane = (x: number, z: number) =>
        [-12, 0.5, 12].some(
          (base, k) =>
            Math.abs(x - (base + 2.6 * Math.sin(z * 0.11 + k * 1.9))) < 1.6,
        );
      const m = new THREE.Matrix4(),
        p = new THREE.Vector3();
      let inLanes = 0,
        total = 0;
      for (const name of ['Glass sponges', 'Soft corals']) {
        const mesh = g.root.getObjectByName(name) as THREE.InstancedMesh;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          p.setFromMatrixPosition(m);
          if (lane(p.x, p.z)) inLanes++;
          total++;
        }
      }
      expect(inLanes / total).toBeLessThan(0.03);
      expect(g.spots.sponge.length).toBeGreaterThan(0);
    } finally {
      g.dispose();
    }
  });
});

describe('V0.7 Pass 079 office furniture forms', () => {
  it('dishes the cushion top and rolls its front edge, inside its nominal size', () => {
    const g = contouredCushion(0.5, 0.08, 0.48, 0.014, 0.024);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.48 + 1e-6);
    // The top is lower in the middle than near the back edge.
    const p = g.getAttribute('position');
    let centre = -Infinity,
      rear = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) < 0.06 && Math.abs(p.getZ(i)) < 0.06)
        centre = Math.max(centre, p.getY(i));
      if (Math.abs(p.getX(i)) < 0.06 && p.getZ(i) > 0.17)
        rear = Math.max(rear, p.getY(i));
    }
    expect(centre).toBeLessThan(rear - 0.005);
    expect(g.getAttribute('normal')).toBeDefined();
    g.dispose();
  });
  it('bends the back shell round the sitter', () => {
    const g = backShell(0.48, 0.54, 0.055, 0.045, 0.014),
      p = g.getAttribute('position');
    let edge = Infinity,
      middle = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > 0.2) edge = Math.min(edge, p.getZ(i));
      if (Math.abs(p.getX(i)) < 0.02) middle = Math.min(middle, p.getZ(i));
    }
    expect(edge).toBeLessThan(middle - 0.02);
    g.dispose();
  });
});
