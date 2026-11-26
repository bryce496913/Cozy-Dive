import * as THREE from 'three';
import { it, expect } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { insideRock } from '../src/fish/FishHabitat';
import { ReefAsset } from '../validation/ReefAsset';

it('uses the shipped plate hull height instead of invisible procedural towers in the original reef', () => {
  const q = new Aquarium(),
    asset = new ReefAsset();
  try {
    for (const [i, f] of q.hardscape.formations
      .filter((f) => f.kind === 'plate')
      .entries()) {
      const transform = new THREE.Matrix4().makeTranslation(
          f.position.x,
          f.position.y,
          f.position.z,
        ),
        authored = asset.colliders(`Coral_Plate_${i}_Root`, transform),
        p = asset.primitive(`Coral_Plate_${i}`).positions;
      let visualTop = -Infinity;
      for (let k = 1; k < p.length; k += 3)
        visualTop = Math.max(visualTop, p[k]);
      expect(authored).toHaveLength(4);
      expect(
        Math.max(...authored.map((c) => c.max.y)) - f.position.y,
      ).toBeCloseTo(visualTop, 3);
      if (i < 2) {
        const empty = {
          x: f.position.x,
          y: f.position.y + 1.5,
          z: f.position.z,
        };
        expect(f.colliders.some((c) => insideRock(empty, 0, c))).toBe(true);
        expect(authored.some((c) => insideRock(empty, 0, c))).toBe(false);
      }
    }
  } finally {
    q.dispose();
  }
});
