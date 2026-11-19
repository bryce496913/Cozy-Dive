import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import type { ConvexCollider } from '../../player/collision';
import { rockCollider } from '../rockCollider';

/**
 * A vertical rock shaft (the sinkhole between the kelp forest and the wreck's cavern): its rough
 * rock lining, seen from inside, and a ring of solid wedges around it so the swimmer stays in it.
 */
export interface ShaftShape {
  readonly x: number;
  readonly z: number;
  /** The open radius (m); the rock lining lies just beyond it. */
  readonly radius: number;
  readonly top: number;
  readonly bottom: number;
}

/** Rock lining (open at both ends), lumpy, shaded by `shade(y)` (0 black … 1 lit rock). */
export function shaftLining(
  s: ShaftShape,
  shade: (y: number) => number,
  seed = 1,
): THREE.BufferGeometry {
  const rings = Math.max(2, Math.ceil((s.top - s.bottom) / 0.45)),
    g = new THREE.CylinderGeometry(1, 1, s.top - s.bottom, 32, rings, true),
    p = g.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      y = p.getY(i) + (s.top + s.bottom) / 2,
      a = Math.atan2(z, x),
      // Always outside the open radius: ledges, bulges and cracks in the rock.
      r =
        s.radius +
        0.12 +
        0.14 * (1 + Math.sin(a * 5 + y * 0.7 + seed)) +
        0.08 * (1 + Math.sin(a * 13 - y * 1.9 + seed * 2)),
      k = shade(y) * (0.8 + 0.2 * Math.sin(a * 7 + y * 2.3));
    p.setXYZ(i, s.x + x * r, y, s.z + z * r);
    c[i * 3] = 0.34 * k;
    c[i * 3 + 1] = 0.31 * k;
    c[i * 3 + 2] = 0.27 * k;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Solid wedges of rock around the shaft, from `bottom` to `top`, `thickness` m thick. */
export function shaftColliders(
  s: ShaftShape,
  thickness: number,
  segments = 16,
): ConvexCollider[] {
  const out: ConvexCollider[] = [],
    identity = new THREE.Matrix4(),
    // A little overlap between wedges, so no seam can be squeezed through.
    step = (Math.PI * 2) / segments,
    over = step * 0.08,
    r0 = s.radius,
    r1 = s.radius + thickness;
  for (let i = 0; i < segments; i++) {
    const a0 = i * step - over,
      a1 = (i + 1) * step + over,
      points: THREE.Vector3[] = [];
    for (const a of [a0, a1])
      for (const r of [r0 / Math.cos(step / 2 + over), r1])
        for (const y of [s.bottom, s.top])
          points.push(
            new THREE.Vector3(s.x + Math.cos(a) * r, y, s.z + Math.sin(a) * r),
          );
    const hull = new ConvexGeometry(points);
    out.push(rockCollider(hull, identity));
    hull.dispose();
  }
  return out;
}
