import { describe, expect, it } from 'vitest';
import {
  coralGeometry,
  coralMotion,
  type CoralFamily,
} from '../src/environment/shared/CoralLibrary';

const FAMILIES: readonly CoralFamily[] = [
  'branching',
  'massive',
  'brain',
  'plate',
  'fan',
  'soft',
];

function triangles(family: CoralFamily, detail: 0 | 1): number {
  const geometry = coralGeometry({ family, seed: 22022, detail });
  const count =
    geometry.index?.count ?? geometry.getAttribute('position').count;
  geometry.dispose();
  return count / 3;
}

describe('Pass 022 shared low-poly coral library', () => {
  it.each(FAMILIES)(
    'builds deterministic, finite, rooted %s coral',
    (family) => {
      const a = coralGeometry({ family, seed: 1907 }),
        b = coralGeometry({ family, seed: 1907 }),
        position = a.getAttribute('position'),
        copy = b.getAttribute('position');
      expect(Array.from(position.array)).toEqual(Array.from(copy.array));
      expect(a.getAttribute('normal').count).toBe(position.count);
      expect(a.getAttribute('color').count).toBe(position.count);
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      a.computeBoundingBox();
      expect(a.boundingBox!.min.y).toBeLessThanOrEqual(0.08);
      expect(a.boundingBox!.max.y).toBeGreaterThan(0.45);
      expect(a.boundingBox!.max.x - a.boundingBox!.min.x).toBeGreaterThan(0.35);
      a.dispose();
      b.dispose();
    },
  );

  it('keeps recognizable family silhouettes and cheaper distance tiers', () => {
    const signatures = new Set<string>();
    for (const family of FAMILIES) {
      const geometry = coralGeometry({ family, seed: 71 });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!,
        position = geometry.getAttribute('position'),
        checksum = Array.from(position.array)
          .reduce(
            (sum, value, index) => sum + Number(value) * ((index % 17) + 1),
            0,
          )
          .toFixed(3);
      signatures.add(
        [
          (box.max.x - box.min.x).toFixed(2),
          (box.max.y - box.min.y).toFixed(2),
          position.count,
          checksum,
        ].join(':'),
      );
      expect(triangles(family, 0)).toBeLessThanOrEqual(triangles(family, 1));
      expect(triangles(family, 1)).toBeLessThan(1800);
      geometry.dispose();
    }
    expect(signatures.size).toBe(FAMILIES.length);
  });

  it('anchors flexible coral bases and increases motion toward their tips', () => {
    const geometry = coralMotion(
        coralGeometry({ family: 'soft', seed: 88 }),
        0.06,
        0.55,
      ),
      position = geometry.getAttribute('position'),
      motion = geometry.getAttribute('plantMotion');
    let lowest = Infinity,
      lowestMotion = Infinity,
      highest = -Infinity,
      highestMotion = -Infinity;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i),
        flex = motion.getX(i);
      if (y < lowest) {
        lowest = y;
        lowestMotion = flex;
      }
      if (y > highest) {
        highest = y;
        highestMotion = flex;
      }
    }
    expect(lowestMotion).toBeCloseTo(0, 6);
    expect(highestMotion).toBeCloseTo(0.06, 3);
    geometry.dispose();
  });
});
