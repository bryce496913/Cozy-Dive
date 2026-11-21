import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { carveConvexHull, rockShape } from '../RockGeometry';

/**
 * V0.7 Pass 079: big cave boulders seen across the cavern. Their silhouettes were the bare hull;
 * now deep fracture caps and steep joint clefts split each into a few recognisable masses.
 */
const BOULDER_MASSING = {
  cuts: 3,
  cutLow: 0.5,
  clefts: 2,
  cleftDepth: 0.2,
  cleftWidth: 0.16,
} as const;

/**
 * Fractured limestone rather than rounded river stones. The hull is the collider. By default the
 * rendered rock is that hull (tunnel-mouth rubble); with `carved` (V0.7 Pass 079) the rendered
 * rock is carved inside it, with the hull's exact bounds and the hull carried for `rockCollider`,
 * so fitting, placement and collision are unchanged.
 */
export function limestoneGeometry(
  seed: number,
  family: number,
  carved = false,
  detail = 3,
  massing = true,
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
  const hull = new ConvexGeometry(points);
  if (carved) {
    const hullPositions = Array.from(hull.getAttribute('position').array);
    hull.dispose();
    const g = carveConvexHull(
        hullPositions,
        family,
        detail,
        seed * 7 + 13,
        massing ? BOULDER_MASSING : undefined,
      ),
      pos = g.getAttribute('position'),
      carve = g.getAttribute('carve'),
      colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i),
        // Fresh fracture faces read paler; clefts and pits hold shadow and silt.
        tone = Math.max(
          0.5,
          0.8 +
            0.07 * Math.sin(y * 13 + x * 2) +
            0.05 * Math.sin(z * 8 + x * 5) +
            0.06 * y -
            carve.getX(i) * 1.6,
        );
      colors.set([tone, tone * 0.98, tone * 0.91], i * 3);
    }
    g.deleteAttribute('carve');
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeBoundingBox();
    g.userData.collisionHull = hullPositions;
    g.userData.collisionBox = g
      .boundingBox!.min.toArray()
      .concat(g.boundingBox!.max.toArray());
    return g;
  }
  const result = toCreasedNormals(hull, Math.PI / 6);
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
