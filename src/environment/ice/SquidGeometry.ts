import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Mantle, paired fins and eight tapering arms in one draw, with two swimming poses. */
export function squidGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const mantle = new THREE.SphereGeometry(1, 24, 16);
  mantle.scale(0.6, 0.5, 1.8);
  mantle.translate(0, 0.2, -1.4);
  parts.push(mantle);
  for (const side of [-1, 1]) {
    const fin = new THREE.SphereGeometry(1, 16, 8);
    fin.scale(0.65, 0.05, 0.7);
    fin.rotateZ(side * 0.15);
    fin.translate(side * 0.55, 0.25, -2.05);
    parts.push(fin);
  }
  for (let arm = 0; arm < 8; arm++) {
    const angle = (arm / 8) * Math.PI * 2;
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12,
        spread = 0.28 + t * 0.65;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * spread,
          Math.sin(angle) * spread * 0.65 + 0.12 * Math.sin(t * 5 + arm),
          t * (arm % 2 ? 2.6 : 3.2),
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.TubeGeometry(curve, 24, 1, 6, false);
    // TubeGeometry's radius is constant; taper each ring about its centreline.
    const vertices = tube.getAttribute('position');
    for (let ring = 0; ring <= 24; ring++) {
      const t = ring / 24,
        centre = curve.getPointAt(t);
      const radius = 0.085 * (1 - t) + 0.009;
      for (let j = 0; j <= 6; j++) {
        const i = ring * 7 + j;
        vertices.setXYZ(
          i,
          centre.x + (vertices.getX(i) - centre.x) * radius,
          centre.y + (vertices.getY(i) - centre.y) * radius,
          centre.z + (vertices.getZ(i) - centre.z) * radius,
        );
      }
    }
    tube.computeVertexNormals();
    parts.push(tube);
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  const base = geometry.getAttribute('position');
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [-1, 1].map((sign) => {
    const delta = new Float32Array(base.count * 3);
    for (let i = 0; i < base.count; i++) {
      const z = base.getZ(i),
        weight = Math.max(0, z) / 3.2;
      delta[i * 3] =
        sign * 0.22 * weight * weight * Math.sin(z * 2 + base.getX(i) * 3);
      delta[i * 3 + 1] = sign * 0.16 * weight * Math.sin(z * 2.3);
    }
    return new THREE.BufferAttribute(delta, 3);
  });
  geometry.computeBoundingSphere();
  return geometry;
}
