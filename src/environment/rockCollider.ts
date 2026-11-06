import * as THREE from 'three';
import type { CollisionPlane, ConvexCollider } from '../player/collision';

/** One-time hull extraction from the same convex vertices and transform used for rendering. */
export function rockCollider(
  geometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
): ConvexCollider {
  const vertices = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : vertices.count;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const plane = new THREE.Plane();
  const planes: CollisionPlane[] = [];
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(vertices, index ? index.getX(i) : i);
    b.fromBufferAttribute(vertices, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(vertices, index ? index.getX(i + 2) : i + 2);
    plane.setFromCoplanarPoints(a, b, c).applyMatrix4(transform);
    // Convex hull triangulation can contain coplanar faces; retain one support plane per face.
    if (
      !planes.some(
        (p) =>
          p.x * plane.normal.x + p.y * plane.normal.y + p.z * plane.normal.z >
            1 - 1e-8 && Math.abs(p.offset + plane.constant) < 1e-6,
      )
    ) {
      planes.push({
        x: plane.normal.x,
        y: plane.normal.y,
        z: plane.normal.z,
        offset: -plane.constant,
      });
    }
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!.clone().applyMatrix4(transform);
  return {
    planes,
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}
