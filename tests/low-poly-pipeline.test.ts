import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  addPose,
  colorRegions,
  fin,
  forkedBranch,
  mirrored,
  polyhedron,
  profileBody,
  taperedCurve,
} from '../src/geometry/lowPoly/geometry';
import { LowPolyResources } from '../src/rendering/lowPoly/resources';
import {
  createPrototype,
  prototypeGeometry,
  prototypeIds,
} from '../validation/low-poly/prototypes';

function volume(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position'),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, g.index?.getX(i) ?? i);
    b.fromBufferAttribute(p, g.index?.getX(i + 1) ?? i + 1);
    c.fromBufferAttribute(p, g.index?.getX(i + 2) ?? i + 2);
    expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(
      1e-16,
    );
    v += a.dot(b.cross(c)) / 6;
  }
  return v;
}
function valid(g: THREE.BufferGeometry): void {
  const p = g.getAttribute('position');
  expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
  expect(
    Array.from(g.getAttribute('normal').array).every(Number.isFinite),
  ).toBe(true);
  if (g.index)
    for (const i of g.index.array) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(p.count);
    }
  expect(g.boundingSphere?.radius).toBeGreaterThan(0);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++)
    expect(g.boundingBox?.containsPoint(v.fromBufferAttribute(p, i))).toBe(
      true,
    );
  expect(volume(g)).toBeGreaterThan(0);
}
const body = () =>
  profileBody([
    { x: -1, width: 0.1, height: 0.2 },
    { x: 0, width: 0.4, height: 0.6, lowerHeight: 0.2 },
    { x: 1, width: 0.05, height: 0.1 },
  ]);
describe('low-poly authored geometry', () => {
  it('produces finite outward body, fin, mirrored fin, transported curve and connected fork', () => {
    const f = fin(
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      [0.1, 0.02, 0.02],
      2,
    );
    const models = [
      body(),
      f,
      mirrored(f, 'z'),
      taperedCurve(
        [
          [0, 0, 0],
          [0, 1, 0],
          [0.2, 2, 0.2],
        ],
        [0.2, 0.15, 0.03],
      ),
      forkedBranch(),
    ];
    for (const g of models) {
      valid(g);
      g.dispose();
    }
  });
  it('has a closed manifold fork without internal caps or T junctions', () => {
    const g = forkedBranch(),
      edges = new Map<string, number[]>(),
      idx = g.index!;
    for (let i = 0; i < idx.count; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = idx.getX(i + j),
          b = idx.getX(i + ((j + 1) % 3)),
          key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const directions = edges.get(key) ?? [];
        directions.push(a < b ? 1 : -1);
        edges.set(key, directions);
      }
    for (const directions of edges.values())
      expect(directions.sort()).toEqual([-1, 1]);
    g.dispose();
  });
  it('rejects invalid profiles, nonfinite data, degenerate outlines and reversing curves', () => {
    expect(() =>
      profileBody([
        { x: 0, width: 0, height: 1 },
        { x: 1, width: 1, height: 1 },
      ]),
    ).toThrow();
    expect(() =>
      profileBody([
        { x: 0, width: 1, height: 1 },
        { x: 0, width: 1, height: 1 },
      ]),
    ).toThrow();
    expect(() =>
      fin(
        [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        [1, 1, 1],
      ),
    ).toThrow();
    expect(() =>
      taperedCurve(
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 0, 0],
        ],
        [1, 1, 1],
      ),
    ).toThrow();
    expect(() =>
      taperedCurve(
        [
          [0, 0, 0],
          [NaN, 1, 0],
        ],
        [1, 1],
      ),
    ).toThrow();
  });
  it('rejects coplanar hulls and keeps curve/fin attachment roots fixed during articulated poses', () => {
    expect(() =>
      polyhedron([
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ]),
    ).toThrow();
    const curve = taperedCurve(
      [
        [0, 0, 0],
        [0, 0.5, 0],
        [0.1, 1, 0],
        [0.3, 1.5, 0.1],
      ],
      [0.1, 0.08, 0.05, 0.02],
    );
    addPose(curve, 'tentacle', (p, o) => {
      o.z += Math.sin(p.y * 2) * p.y * 0.1;
    });
    const appendage = fin(
      [
        [0, -0.1],
        [0.7, -0.25],
        [1, 0],
        [0.7, 0.25],
        [0, 0.1],
      ],
      [0.04, 0.02, 0.01, 0.02, 0.04],
      2,
    );
    addPose(appendage, 'fin', (p, o) => {
      const a = p.x * 0.3;
      o.y = p.y * Math.cos(a) - p.z * Math.sin(a);
      o.z = p.y * Math.sin(a) + p.z * Math.cos(a);
    });
    for (const [g, axis] of [
      [curve, 'y'],
      [appendage, 'x'],
    ] as const) {
      valid(g);
      const p = g.getAttribute('position'),
        pose = g.morphAttributes.position![0];
      for (let i = 0; i < p.count; i++)
        if ((axis === 'y' ? p.getY(i) : p.getX(i)) === 0)
          expect([pose.getX(i), pose.getY(i), pose.getZ(i)]).toEqual([0, 0, 0]);
      g.dispose();
    }
  });
  it('varies coherent rock planes deterministically', () => {
    const points: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const a = polyhedron(points, 7),
      b = polyhedron(points, 7),
      c = polyhedron(points, 8);
    expect(a.getAttribute('position').array).toEqual(
      b.getAttribute('position').array,
    );
    expect(a.getAttribute('position').array).not.toEqual(
      c.getAttribute('position').array,
    );
    [a, b, c].forEach((g) => {
      valid(g);
      g.dispose();
    });
  });
  it('assigns deliberate face colors/groups and preserves source ownership', () => {
    const source = body(),
      g = colorRegions(source, ['#ffffff', '#000000'], (p) =>
        p.y > 0 ? 0 : 1,
      ),
      colors = g.getAttribute('color');
    expect(source.getAttribute('color')).toBeUndefined();
    for (let i = 0; i < colors.count; i += 3)
      expect([colors.getX(i), colors.getX(i + 1), colors.getX(i + 2)]).toEqual(
        Array(3).fill(colors.getX(i)),
      );
    expect(g.groups.reduce((n, v) => n + v.count, 0)).toBe(colors.count);
    expect(() => colorRegions(source, ['white'], () => 2)).toThrow();
    g.dispose();
    source.dispose();
  });
  it.each(prototypeIds)(
    '%s retains bounds and coincident vertices through each complete pose',
    (id) => {
      const g = prototypeGeometry(id);
      valid(g);
      const p = g.getAttribute('position'),
        v = new THREE.Vector3();
      for (const pose of g.morphAttributes.position ?? []) {
        const same = new Map<string, string>();
        for (let i = 0; i < p.count; i++) {
          const key = `${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
          v.set(
            p.getX(i) + pose.getX(i),
            p.getY(i) + pose.getY(i),
            p.getZ(i) + pose.getZ(i),
          );
          expect(
            g.boundingBox!.clone().expandByScalar(1e-6).containsPoint(v),
          ).toBe(true);
          const value = v.toArray().join(',');
          if (same.has(key)) expect(value).toBe(same.get(key));
          same.set(key, value);
          if (id === 'plant' && p.getY(i) === 0) expect(v.x).toBe(p.getX(i));
        }
      }
      const limit = { fish: 600, ray: 900, coral: 1000, rock: 250, plant: 500 }[
        id
      ];
      expect((g.index?.count ?? p.count) / 3).toBeLessThanOrEqual(limit);
      g.dispose();
    },
  );
  it('rejects duplicate/nonfinite poses without modifying installed targets', () => {
    const g = body();
    addPose(g, 'bend', (p, o) => {
      o.z += p.x * p.x * 0.2;
    });
    expect(() => addPose(g, 'bend', () => {})).toThrow();
    expect(() =>
      addPose(g, 'bad', (_, o) => {
        o.x = Infinity;
      }),
    ).toThrow();
    expect(g.morphAttributes.position).toHaveLength(1);
    g.dispose();
  });
});
describe('generated resource ownership', () => {
  it('shares geometry/materials and releases exactly once, including retirement with live owners', () => {
    const pool = new LowPolyResources(),
      a = createPrototype(pool, 'fish'),
      b = createPrototype(pool, 'fish');
    expect(a.mesh.geometry).toBe(b.mesh.geometry);
    expect(a.mesh.material).toBe(b.mesh.material);
    const gd = vi.spyOn(a.mesh.geometry, 'dispose'),
      md = vi.spyOn(a.mesh.material, 'dispose');
    a.update(1);
    expect(a.mesh.morphTargetInfluences).not.toEqual(
      b.mesh.morphTargetInfluences,
    );
    a.dispose();
    a.dispose();
    expect(gd).not.toHaveBeenCalled();
    pool.dispose();
    expect(() => createPrototype(pool, 'fish')).toThrow();
    b.dispose();
    expect(gd).toHaveBeenCalledTimes(1);
    expect(md).toHaveBeenCalledTimes(1);
    expect(pool.counts).toEqual({ geometries: 0, materials: 0 });
  });
  it('keeps cache keys/material roles distinct and uses inexpensive fog-compatible surfaces', () => {
    const pool = new LowPolyResources();
    const a = pool.material({ role: 'body', color: '#ffffff' }),
      b = pool.material({ role: 'body', color: 0xffffff }),
      c = pool.material({ role: 'metal' }),
      d = pool.material({ role: 'translucent' });
    expect(a.value).toBe(b.value);
    expect(c.value).not.toBe(a.value);
    expect(a.value.fog).toBe(true);
    expect(a.value.flatShading).toBe(true);
    expect(a.value.map).toBeNull();
    expect(d.value.depthWrite).toBe(false);
    expect(() => pool.material({ role: 'body', opacity: 0.4 })).toThrow();
    [a, b, c, d].forEach((l) => l.release());
    pool.dispose();
  });
  it('supports existing instancing and repeated lifecycle without retained entries', () => {
    const pool = new LowPolyResources();
    for (let i = 0; i < 20; i++) {
      const a = createPrototype(pool, 'plant');
      const instances = new THREE.InstancedMesh(
        a.mesh.geometry,
        a.mesh.material,
        3,
      );
      expect(instances.geometry).toBe(a.mesh.geometry);
      instances.dispose();
      a.update(1, true);
      expect(a.mesh.morphTargetInfluences).toEqual([0, 0]);
      a.dispose();
      expect(pool.counts.geometries).toBe(0);
    }
    pool.dispose();
  });
});
