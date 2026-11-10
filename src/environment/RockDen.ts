import * as THREE from 'three';

export interface DenCut {
  /** World point where the hole meets the rock (its collision surface). */
  readonly mouth: THREE.Vector3;
  /** Horizontal unit direction out of the rock. */
  readonly axis: THREE.Vector3;
  readonly radius: number;
  readonly depth: number;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Pass 019: carve a moray den into a copy of a rock's visible surface. Surface vertices facing
 * out of the rock within `radius` of the hole axis are pushed `depth` back along it, forming a
 * pit with steep walls; their vertex colour darkens with depth so the hole reads as shadowed.
 * The collision hull is untouched (the pit lies inside it). Returns a new geometry; the shared
 * template is not modified.
 */
export function carveDen(
  source: THREE.BufferGeometry,
  toWorld: THREE.Matrix4,
  cut: DenCut,
): THREE.BufferGeometry {
  const g = source.clone(),
    position = g.getAttribute('position'),
    normal = g.getAttribute('normal'),
    toLocal = toWorld.clone().invert(),
    normalMatrix = new THREE.Matrix3().getNormalMatrix(toWorld),
    w = new THREE.Vector3(),
    n = new THREE.Vector3(),
    d = new THREE.Vector3();
  let color = g.getAttribute('color');
  if (!color) {
    color = new THREE.Float32BufferAttribute(
      new Float32Array(position.count * 3).fill(1),
      3,
    );
    g.setAttribute('color', color);
  }
  const touched: number[] = [];
  for (let i = 0; i < position.count; i++) {
    w.fromBufferAttribute(position, i).applyMatrix4(toWorld);
    d.subVectors(w, cut.mouth);
    const along = d.dot(cut.axis);
    if (along < -0.6 || along > 0.45) continue;
    const radial = d.addScaledVector(cut.axis, -along).length();
    if (radial > cut.radius * 1.35) continue;
    n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
    if (n.dot(cut.axis) < -0.25) continue;
    const core = 1 - smoothstep(cut.radius * 0.7, cut.radius * 1.1, radial),
      rim = 1 - smoothstep(cut.radius * 1.05, cut.radius * 1.35, radial);
    if (core > 0) {
      w.addScaledVector(cut.axis, -cut.depth * core);
      position.setXYZ(
        i,
        ...(w.applyMatrix4(toLocal).toArray() as [number, number, number]),
      );
    }
    // Deep stone is in shadow; the lip darkens slightly towards the opening.
    const shade = 1 - 0.85 * core - 0.2 * rim * (1 - core);
    color.setXYZ(
      i,
      color.getX(i) * shade,
      color.getY(i) * shade,
      color.getZ(i) * shade,
    );
    touched.push(i);
  }
  // Re-light the carved region only, keeping the authored normals everywhere else.
  const relit = g.clone();
  relit.computeVertexNormals();
  const fresh = relit.getAttribute('normal');
  for (const i of touched)
    normal.setXYZ(i, fresh.getX(i), fresh.getY(i), fresh.getZ(i));
  relit.dispose();
  position.needsUpdate = true;
  normal.needsUpdate = true;
  color.needsUpdate = true;
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}
