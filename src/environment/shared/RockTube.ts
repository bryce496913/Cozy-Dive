import * as THREE from 'three';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';

/**
 * v0.6 Pass 046: a rough rock tunnel along -z, shared by the sea cave's back tunnel and the tunnel
 * in under the ice: a lumpy tube (vertex-coloured, darkening towards its threshold, where the
 * passage's darkness peaks) and the square duct of colliders that keeps the swimmer in it.
 */
export interface Tube {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Its two ends (z): the open end, and the end by the threshold (or its cap). */
  readonly from: number;
  readonly to: number;
  /** The threshold (z), where it is darkest. */
  readonly dark: number;
}

export function rockTubeGeometry(t: Tube, reach = 3.2): THREE.BufferGeometry {
  const steps = Math.max(8, Math.ceil(Math.abs(t.to - t.from) * 2.5)),
    around = 28,
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = t.from + ((t.to - t.from) * i) / steps,
      past = Math.abs(z - t.dark),
      light = Math.max(0, Math.min(1, (past - 0.4) / (reach + 3)));
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2,
        bump = 0.12 * Math.sin(a * 3 + z * 1.7) * Math.sin(a * 5 - z * 0.9),
        r = t.radius + bump;
      positions.push(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, z);
      const tone =
        (0.07 + 0.3 * light * light) * (0.85 + 0.15 * Math.sin(a * 7 + z));
      colors.push(tone, tone * 0.97, tone * 0.9);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j,
        b = a + around + 1;
      // Faces inwards whichever way the tube runs.
      if (t.to < t.from) indices.push(a, b, a + 1, a + 1, b, b + 1);
      else indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** The duct: walls a little inside the tube's rock (`duct` from its axis, `wall` thick). */
export function rockTubeColliders(
  t: Tube,
  duct = 1.22,
  wall = 0.6,
): ConvexCollider[] {
  const d = duct,
    w = wall,
    z0 = Math.min(t.from, t.to),
    z1 = Math.max(t.from, t.to),
    x = t.x,
    y = t.y;
  return [
    boxCollider([x + d, y - d - w, z0], [x + d + w, y + d + w, z1]),
    boxCollider([x - d - w, y - d - w, z0], [x - d, y + d + w, z1]),
    boxCollider([x - d - w, y + d, z0], [x + d + w, y + d + w, z1]),
    boxCollider([x - d - w, y - d - w, z0], [x + d + w, y - d, z1]),
  ];
}
