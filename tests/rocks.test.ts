import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Aquarium } from '../src/environment/Aquarium';
import { createRockTemplates } from '../src/environment/RockGeometry';
import { rockCollider } from '../src/environment/rockCollider';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { safeFishPosition } from '../src/fish/FishHabitat';

describe('sculpted convex rock templates', () => {
  it.each([94721, 301, 92847])(
    'has deterministic finite surfaces, smooth unit normals, and exact convex support at seed %s',
    (seed) => {
      const a = createRockTemplates(seed),
        b = createRockTemplates(seed),
        all = [...a.major, ...a.pebbles],
        other = [...b.major, ...b.pebbles];
      try {
        expect(a.major).toHaveLength(6);
        expect(a.pebbles).toHaveLength(3);
        for (let g = 0; g < all.length; g++) {
          const geometry = all[g],
            p = geometry.getAttribute('position'),
            normal = geometry.getAttribute('normal'),
            color = geometry.getAttribute('color');
          expect(Array.from(p.array)).toEqual(
            Array.from(other[g].getAttribute('position').array),
          );
          expect(geometry.boundingBox?.isEmpty()).toBe(false);
          expect(geometry.boundingSphere!.radius).toBeLessThanOrEqual(1.05);
          const hull = rockCollider(geometry, new THREE.Matrix4());
          let maxOutside = -Infinity;
          for (let i = 0; i < p.count; i++) {
            expect(
              Math.hypot(p.getX(i), p.getY(i), p.getZ(i)),
            ).toBeLessThanOrEqual(1.000001);
            const x = p.getX(i),
              y = p.getY(i),
              z = p.getZ(i);
            expect(Number.isFinite(x + y + z)).toBe(true);
            expect(
              Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)),
            ).toBeCloseTo(1, 4);
            expect(color.getX(i)).toBeGreaterThan(0.5);
            for (const plane of hull.planes)
              maxOutside = Math.max(
                maxOutside,
                plane.x * x + plane.y * y + plane.z * z - plane.offset,
              );
          }
          expect(maxOutside).toBeLessThan(1e-6);
          if (g < 6) expect(p.count / 3).toBeGreaterThan(80);
        }
      } finally {
        for (const g of [...all, ...other]) g.dispose();
      }
    },
  );
  it('preserves the recorded placement sequence for all 34 major rocks and 55 pebbles', async () => {
    const aquarium = new Aquarium();
    try {
      const rocks = aquarium.root.children.filter(
        (o): o is THREE.Mesh =>
          o instanceof THREE.Mesh && o.name.startsWith('Rock '),
      );
      expect(rocks).toHaveLength(89);
      const layout = rocks.map((r) =>
        [
          ...r.position.toArray(),
          ...r.scale.toArray(),
          r.rotation.x,
          r.rotation.y,
          r.rotation.z,
        ].map((n) => Number(n.toFixed(8))),
      );
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(layout)),
      );
      const hash = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
      expect(hash).toBe(
        '7e16e45eaba4ba91dfb195589b23475f3b5daa450c68b01298c74b959357998a',
      );
      expect(aquarium.rockColliders).toHaveLength(34);
      expect(
        aquarium.collision.colliders.some((c) =>
          aquarium.collision.contains(c, SPAWN.x, SPAWN.y, SPAWN.z),
        ),
      ).toBe(false);
      const habitat = { bounds: AQUARIUM, rocks: aquarium.collision.colliders };
      for (const f of aquarium.fish.simulation.fish)
        expect(safeFishPosition(f.position, f.radius, habitat)).toBe(true);
    } finally {
      aquarium.dispose();
    }
  });
  it('reuses a modest geometry pool and disposes each rock resource once', () => {
    const aquarium = new Aquarium();
    const rocks = aquarium.root.children.filter(
      (o): o is THREE.Mesh =>
        o instanceof THREE.Mesh && o.name.startsWith('Rock '),
    );
    const geometries = [...new Set(rocks.map((r) => r.geometry))],
      materials = [
        ...new Set(
          rocks.flatMap((r) =>
            Array.isArray(r.material) ? r.material : [r.material],
          ),
        ),
      ];
    expect(geometries).toHaveLength(9);
    expect(materials).toHaveLength(4);
    const spies = [...geometries, ...materials].map((g) =>
      vi.spyOn(g, 'dispose'),
    );
    aquarium.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
