import * as THREE from 'three';
import { expect, it } from 'vitest';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { ReefAsset } from '../validation/ReefAsset';

// Match the runtime's conservative morph bounds, so authoring changes cannot silently remove an encounter.
it.each([
  'nurseShark',
  'leopardSeal',
  'minkeWhale',
  'killerWhale',
  'polarBear',
] as const)(
  '%s remains inside the loading contract throughout its stroke',
  (id) => {
    const spec = ASSET_REGISTRY[id],
      asset = new ReefAsset(`public/${spec.path}`);
    const bounds = new THREE.Box3();
    for (const name of ['Body', 'Body_LOD1']) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(asset.primitive(name).positions, 3),
      );
      geometry.morphTargetsRelative = true;
      geometry.morphAttributes.position = asset
        .morphPositions(name)
        .map((p) => new THREE.BufferAttribute(p, 3));
      geometry.computeBoundingBox();
      const node = asset.node(name),
        m = new THREE.Matrix4().compose(
          new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
        );
      bounds.union(geometry.boundingBox!.applyMatrix4(m));
      geometry.dispose();
    }
    const size = bounds.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeGreaterThanOrEqual(
      spec.minDimension,
    );
    expect(Math.max(size.x, size.y, size.z)).toBeLessThanOrEqual(
      spec.maxDimension,
    );
  },
);
