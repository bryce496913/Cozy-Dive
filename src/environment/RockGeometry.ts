import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import {
  mergeVertices,
  toCreasedNormals,
} from 'three/addons/utils/BufferGeometryUtils.js';

export interface RockTemplates {
  readonly major: readonly THREE.BufferGeometry[];
  readonly pebbles: readonly THREE.BufferGeometry[];
}
/** A small reusable sculpted family. Surface-detail seeds never consume the aquarium layout RNG. */
export function createRockGeometry(
  seed: number,
  family: number,
  detail = 2,
): THREE.BufferGeometry {
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const phase = random() * Math.PI * 2,
    tilt = random() * 0.8 - 0.4;
  const source = new THREE.IcosahedronGeometry(1, detail),
    attribute = source.getAttribute('position');
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < attribute.count; i++) {
    const x = attribute.getX(i),
      y = attribute.getY(i),
      z = attribute.getZ(i);
    const wave =
      Math.sin(x * 3.1 + y * 1.7 + phase) *
      Math.cos(z * 2.7 - y * 1.5 + phase * 0.7);
    const layers = Math.sin(y * 7 + x * 2 + phase) * 0.025;
    const radius = 0.91 + wave * 0.07 + layers;
    const p = new THREE.Vector3(x * radius, y * radius, z * radius);
    if (family === 1) {
      p.y *= 0.75;
      p.x += p.y * tilt;
      p.z *= 0.95;
    }
    if (family === 2) {
      p.x *= 0.9 + 0.07 * Math.sin(y * 3 + phase);
      p.y += x * 0.09;
      p.z *= 0.92;
    }
    // Keep all templates inside the original unit-rock envelope, preserving the open channel.
    if (p.length() > 1) p.normalize();
    points.push(p);
  }
  source.dispose();
  // Displaced points may be concave; explicitly rebuild the convex hull, then render that exact hull.
  const hull = new ConvexGeometry(points);
  hull.deleteAttribute('normal');
  const welded = mergeVertices(hull, 1e-6);
  hull.dispose();
  welded.computeVertexNormals();
  const geometry = toCreasedNormals(
    welded,
    family === 2 ? Math.PI / 7 : Math.PI / 3,
  );
  welded.dispose();
  const positions = geometry.getAttribute('position'),
    colors = new Float32Array(positions.count * 3),
    color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const bands =
      Math.sin(y * 10 + x * 2.4 + phase) * Math.cos(z * 3.5 + phase) * 0.035;
    const mineral = Math.sin(x * 4.5 + z * 3.2 + phase) * 0.045;
    const light = 0.82 + bands + mineral + Math.max(0, y) * 0.08;
    color.setRGB(
      light * (1 + 0.035 * Math.sin(phase)),
      light,
      light * (0.97 + 0.025 * Math.cos(phase)),
    );
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = ['Weathered boulder', 'Sedimentary slab', 'Fractured stone'][
    family
  ];
  return geometry;
}
export function createRockTemplates(seed = 94721): RockTemplates {
  return {
    major: Array.from({ length: 6 }, (_, i) =>
      createRockGeometry(seed + i * 193, Math.floor(i / 2), 2),
    ),
    pebbles: Array.from({ length: 3 }, (_, i) =>
      createRockGeometry(seed + 1709 + i * 127, i, 1),
    ),
  };
}
