import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { ConvexCollider } from '../player/collision';
import { rockCollider } from '../environment/rockCollider';
import { isCollisionNode } from './AssetValidation';
/** Decode authored collision point sets once; never trust DCC face winding or thin cap triangulation. */
export function assetColliders(
  root: THREE.Object3D,
): readonly ConvexCollider[] {
  root.updateMatrixWorld(true);
  const colliders: ConvexCollider[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !isCollisionNode(object)) return;
    object.visible = false;
    const positions = object.geometry.getAttribute('position'),
      points: THREE.Vector3[] = [];
    for (let i = 0; i < positions.count; i++)
      points.push(new THREE.Vector3().fromBufferAttribute(positions, i));
    if (points.length < 4)
      throw Error('Authored collision needs a closed volume');
    const hull = new ConvexGeometry(points);
    try {
      colliders.push(rockCollider(hull, object.matrixWorld));
    } finally {
      hull.dispose();
    }
  });
  return colliders;
}
