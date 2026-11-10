import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { findSeahorseGrip } from '../src/creatures/discoveries/SeahorseGrip';
import { ReefAsset } from '../validation/ReefAsset';

describe('Pass 019 seahorse branch grip on the authored sea fans', () => {
  const reef = new ReefAsset();
  it.each([0, 1, 2])(
    'finds a thin, near-horizontal mid-height branch on Sea_Fan_%i facing the preferred side',
    (template) => {
      const positions = reef.primitive(`Sea_Fan_${template}`).positions,
        height = 1.55,
        toWorld = new THREE.Matrix4().compose(
          new THREE.Vector3(3, 1, -2),
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            0.4,
          ),
          new THREE.Vector3().setScalar(height),
        );
      for (const prefer of [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
      ]) {
        const found = findSeahorseGrip(positions, toWorld, {
          scale: 0.2,
          plantHeight: height,
          prefer: prefer
            .clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4),
        });
        expect(found).toBeDefined();
        const { grip, forward } = found!;
        // Up on a branch (template band 0.45-0.78), away from the trunk.
        const local = grip.clone().applyMatrix4(toWorld.clone().invert());
        expect(local.y).toBeGreaterThanOrEqual(0.44);
        expect(local.y).toBeLessThanOrEqual(0.79);
        expect(Math.abs(local.x)).toBeGreaterThan(0.06);
        // A branch passes through the tail coil.
        let onBranch = false;
        for (let i = 0; i < positions.length && !onBranch; i += 3)
          onBranch =
            Math.hypot(
              positions[i] - local.x,
              positions[i + 1] - local.y,
              positions[i + 2] - local.z,
            ) < 0.02;
        expect(onBranch).toBe(true);
        // Faces out of the fan, on the preferred side.
        expect(forward.y).toBe(0);
        expect(forward.length()).toBeCloseTo(1, 9);
        expect(
          forward.dot(
            prefer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4),
          ),
        ).toBeGreaterThan(0.9);
      }
    },
  );
});
