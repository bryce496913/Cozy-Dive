import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { CollisionPlane, ConvexCollider } from '../player/collision';

/** The convex surface whose faces define the collider. */
function collisionSource(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const hull = geometry.userData.collisionHull as number[] | undefined,
    box = geometry.userData.collisionBox as number[] | undefined;
  if (!hull || !box) return geometry;
  geometry.computeBoundingBox();
  const b = geometry.boundingBox!,
    now = b.min.toArray().concat(b.max.toArray());
  if (now.every((v, i) => Math.abs(v - box[i]) < 1e-9)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
    return g;
  }
  const p = geometry.getAttribute('position'),
    points: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++)
    points.push(new THREE.Vector3().fromBufferAttribute(p, i));
  return new ConvexGeometry(points);
}

/** One-time hull extraction from the same convex vertices and transform used for rendering. */
export function rockCollider(
  geometry: THREE.BufferGeometry,
  transform: THREE.Matrix4,
): ConvexCollider {
  // V0.7 Pass 070: carved rocks render inside their convex envelope, which they carry as plain data.
  // Use it while the geometry is untransformed; after any transform, fall back to the convex hull
  // of the rendered vertices (which still contains the rendered rock).
  const source = collisionSource(geometry);
  const vertices = source.getAttribute('position');
  const index = source.getIndex();
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
  // The bounds are the collision surface's own (the envelope, not the carved rendering inside it).
  source.computeBoundingBox();
  const box = source.boundingBox!.clone().applyMatrix4(transform);
  if (source !== geometry) source.dispose();
  return {
    planes,
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}
