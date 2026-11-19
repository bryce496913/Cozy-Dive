import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { rockShape } from '../RockGeometry';

/** Fractured limestone rather than rounded river stones. The rendered hull is also the collider. */
export function limestoneGeometry(
  seed: number,
  family: number,
): THREE.BufferGeometry {
  const source = rockShape(seed, family, 2),
    vertices = source.getAttribute('position');
  const points: THREE.Vector3[] = [];
  const tilt = Math.sin(seed) * 0.16;
  for (let i = 0; i < vertices.count; i++) {
    let x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i);
    // Two bedding planes and oblique breaks expose broad, irregular angular faces.
    y = Math.max(-0.55 + z * 0.09, Math.min(0.56 + x * tilt, y));
    x = Math.max(-0.72 - y * 0.18, Math.min(0.75 - z * 0.2, x));
    z = Math.min(0.76 + y * 0.12, z);
    points.push(new THREE.Vector3(x, y, z));
  }
  source.dispose();
  const hull = new ConvexGeometry(points),
    result = toCreasedNormals(hull, Math.PI / 6);
  hull.dispose();
  const pos = result.getAttribute('position'),
    colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i);
    const tone =
      0.78 +
      0.08 * Math.sin(y * 13 + x * 2) +
      0.05 * Math.sin(z * 8 + x * 5) +
      0.06 * y;
    colors.set([tone, tone * 0.98, tone * 0.91], i * 3);
  }
  result.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return result;
}
