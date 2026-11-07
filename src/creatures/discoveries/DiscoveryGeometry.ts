import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Construction-only helpers; merged anatomy shares materials and does not retain temporary meshes. */
export function tint(
  g: THREE.BufferGeometry,
  color: number,
  variation = 0,
): THREE.BufferGeometry {
  const p = g.attributes.position,
    c = new THREE.Color(color),
    base = c.clone(),
    colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const grain =
      1 +
      variation *
        Math.sin(p.getX(i) * 97 + p.getY(i) * 43) *
        Math.cos(p.getZ(i) * 57);
    c.copy(base).multiplyScalar(grain);
    c.toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}
export function mergeParts(
  parts: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const gs = parts.map((g) => (g.index ? g.toNonIndexed() : g)),
    out = mergeGeometries(gs)!;
  parts.forEach((g) => g.dispose());
  gs.forEach((g, i) => {
    if (g !== parts[i]) g.dispose();
  });
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
export function ellipsoid(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: number,
  variation = 0,
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 12, 8);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return tint(g, color, variation);
}
export function tube(
  points: readonly THREE.Vector3[],
  radius: number,
  color: number,
  segments = 10,
): THREE.BufferGeometry {
  return tint(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([...points]),
      segments,
      radius,
      6,
      false,
    ),
    color,
  );
}
export function finGeometry(
  points: readonly THREE.Vector3[],
  color: number,
): THREE.BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  points.forEach((p) => positions.push(p.x, p.y, p.z));
  for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return tint(g, color);
}
