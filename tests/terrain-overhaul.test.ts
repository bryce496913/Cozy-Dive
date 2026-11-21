import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { describe, expect, it } from 'vitest';
import { createRockGeometry } from '../src/environment/RockGeometry';
import { rockCollider } from '../src/environment/rockCollider';
import { HabitatSurface } from '../src/environment/shared/HabitatSurface';

/** V0.7 Pass 070: carved rocks inside unchanged colliders; varied sediment. */
const SEEDS: [number, number, number][] = [
  [32100, 0, 3],
  [36107, 1, 2],
  [34300, 2, 2],
  [35031, 1, 1],
];

const inside = (c: ReturnType<typeof rockCollider>, p: THREE.Vector3) =>
  c.planes.every(
    (pl) => pl.x * p.x + pl.y * p.y + pl.z * p.z - pl.offset < 1e-6,
  );

describe('V0.7 Pass 070 carved rocks', () => {
  it.each(SEEDS)(
    'rock %i/%i/%i renders inside its convex envelope with exactly the envelope bounds',
    (seed, family, detail) => {
      const g = createRockGeometry(seed, family, detail),
        hull = g.userData.collisionHull as number[];
      expect(hull.length % 9).toBe(0);
      const hullGeometry = new THREE.BufferGeometry();
      hullGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(hull, 3),
      );
      hullGeometry.computeBoundingBox();
      g.computeBoundingBox();
      // Bounds pinned to the hull, so callers that fit rocks to a box scale them exactly as before.
      expect(
        g.boundingBox!.min.distanceTo(hullGeometry.boundingBox!.min),
      ).toBeLessThan(1e-7);
      expect(
        g.boundingBox!.max.distanceTo(hullGeometry.boundingBox!.max),
      ).toBeLessThan(1e-7);
      const collider = rockCollider(g, new THREE.Matrix4()),
        plain = rockCollider(hullGeometry, new THREE.Matrix4());
      // The collider is the envelope itself (same planes as the bare hull).
      expect(collider.planes.length).toBe(plain.planes.length);
      expect(collider.min).toEqual(plain.min);
      expect(collider.max).toEqual(plain.max);
      const p = g.getAttribute('position'),
        v = new THREE.Vector3();
      let carved = 0;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        expect(inside(collider, v)).toBe(true);
        // Measurably carved: many vertices sit well inside the envelope.
        const depth = Math.min(
          ...collider.planes.map(
            (pl) => pl.offset - (pl.x * v.x + pl.y * v.y + pl.z * v.z),
          ),
        );
        if (depth > 0.02) carved++;
      }
      expect(carved / p.count).toBeGreaterThan(0.3);
      hullGeometry.dispose();
      g.dispose();
    },
  );
  it('falls back to the hull of the rendered rock once the geometry is transformed', () => {
    const g = createRockGeometry(32100, 0, 2);
    g.scale(2, 1.5, 0.8);
    g.translate(1, 0, -2);
    const c = rockCollider(g, new THREE.Matrix4()),
      p = g.getAttribute('position'),
      v = new THREE.Vector3(),
      points: THREE.Vector3[] = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      points.push(v.clone());
      expect(inside(c, v)).toBe(true);
    }
    const expected = new ConvexGeometry(points);
    expected.computeBoundingBox();
    expect(c.max.x).toBeCloseTo(expected.boundingBox!.max.x, 6);
    expected.dispose();
    g.dispose();
  });
});

describe('V0.7 Pass 070 sediment', () => {
  it('varies its ripples across the tile instead of repeating identical stripes', () => {
    const s = new HabitatSurface('sediment');
    const mat = s.material({ name: 'test' });
    // Read the generated colour field from the surface's own map.
    const map = (s as unknown as { maps: THREE.DataTexture[] }).maps[0];
    const { data, width } = map.image as { data: Uint8Array; width: number };
    expect(width).toBe(256);
    // Two columns far apart along the ripple direction should differ (no straight stripes).
    let diff = 0;
    for (let y = 0; y < width; y++)
      diff += Math.abs(
        data[(y * width + 10) * 4] - data[(y * width + 138) * 4],
      );
    expect(diff / width).toBeGreaterThan(4);
    mat.dispose();
    s.dispose();
  });
});
