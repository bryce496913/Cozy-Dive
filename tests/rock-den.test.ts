import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { carveDen } from '../src/environment/RockDen';

describe('Pass 019 moray den carving', () => {
  it('pits the facing surface around the axis, darkens it, and leaves the rest untouched', () => {
    const source = new THREE.IcosahedronGeometry(1.5, 24),
      toWorld = new THREE.Matrix4().makeTranslation(4, 1, -3),
      mouth = new THREE.Vector3(5.5, 1, -3),
      axis = new THREE.Vector3(1, 0, 0);
    const before = source.getAttribute('position').clone();
    const g = carveDen(source, toWorld, {
      mouth,
      axis,
      radius: 0.3,
      depth: 0.8,
    });
    const p = g.getAttribute('position'),
      c = g.getAttribute('color'),
      w = new THREE.Vector3();
    let deepest = Infinity,
      darkest = 1,
      moved = 0;
    for (let i = 0; i < p.count; i++) {
      w.fromBufferAttribute(p, i).applyMatrix4(toWorld);
      const radial = Math.hypot(w.y - 1, w.z + 3);
      if (radial < 0.15) {
        deepest = Math.min(deepest, w.x);
        darkest = Math.min(darkest, c.getX(i));
      }
      if (
        w.distanceTo(
          new THREE.Vector3()
            .fromBufferAttribute(before, i)
            .applyMatrix4(toWorld),
        ) > 1e-9
      ) {
        moved++;
        expect(radial).toBeLessThan(0.3 * 1.1 + 1e-6);
      }
    }
    // The pit floor sits ~0.8 behind the original surface and is in deep shadow.
    expect(deepest).toBeLessThan(5.5 - 0.7);
    expect(darkest).toBeLessThan(0.2);
    expect(moved).toBeGreaterThan(20);
    // The shared source geometry is unchanged.
    expect(source.getAttribute('position').array).toEqual(before.array);
    g.dispose();
    source.dispose();
  });
});
