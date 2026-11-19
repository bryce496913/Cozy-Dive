import * as THREE from 'three';

/** Conservative swept radius, including both morph endpoints and child transforms.
 * Built once when the asset arrives; pitch, bank and fluke strokes can never hit the floor.
 */
export function creatureClearance(
  model: THREE.Object3D,
  scale: number,
): number {
  const bounds = new THREE.Box3(),
    box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) {
      box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
      bounds.union(box);
    }
  });
  if (bounds.isEmpty()) return 0;
  return (
    Math.hypot(
      Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
      Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)),
      Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
    ) *
      scale +
    0.3
  );
}
