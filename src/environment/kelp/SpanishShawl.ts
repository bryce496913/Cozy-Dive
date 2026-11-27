import * as THREE from 'three';
import { smoothed } from '../shared/organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * v0.6 Pass 053 (visual consistency): the Spanish shawl nudibranch rebuilt to the creature
 * standard. Same contract as the Pass 044 geometry: facing +z, its foot at y 0, about 7 cm long,
 * vertex-coloured. What it adds over the old ellipsoid and cones:
 *   - a slender, tapering body with a flared foot margin and a pointed tail;
 *   - long purple oral tentacles sweeping out at the front;
 *   - two scarlet, ringed (lamellate) rhinophores;
 *   - dense clusters of fat, curved orange cerata in rows down each side of the back, with paler
 *     tips, overlapping as the real animal's do.
 */
type RGB = readonly [number, number, number];
const BODY: RGB = [0.45, 0.28, 0.78],
  FOOT: RGB = [0.62, 0.48, 0.9],
  RHINO: RGB = [0.8, 0.1, 0.12],
  CERAS: RGB = [0.98, 0.45, 0.08],
  TIP: RGB = [1, 0.75, 0.35];

function coloured(
  g: THREE.BufferGeometry,
  base: RGB,
  tip?: { colour: RGB; from: number; to: number; axis: 'y' | 'z' },
): THREE.BufferGeometry {
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let k = 0;
    if (tip) {
      const a = tip.axis === 'y' ? p.getY(i) : p.getZ(i);
      k = Math.min(1, Math.max(0, (a - tip.from) / (tip.to - tip.from)));
    }
    for (let j = 0; j < 3; j++)
      c[i * 3 + j] = base[j] + ((tip?.colour[j] ?? base[j]) - base[j]) * k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
/** A tapered, curved tube through `points` (radius from `r0` to `r1`). */
function tube(
  points: THREE.Vector3[],
  r0: number,
  r1: number,
  colour: RGB,
  tip?: RGB,
) {
  // Few segments: there are about sixty of these on each of 26 slugs.
  const segments = 4,
    sides = 4,
    curve = new THREE.CatmullRomCurve3(points),
    g = new THREE.TubeGeometry(curve, segments, 1, sides, false),
    p = g.getAttribute('position'),
    count = p.count / (sides + 1);
  // Taper: scale each ring towards its centre point.
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (sides + 1)) / Math.max(1, count - 1),
      centre = curve.getPointAt(Math.min(1, ring)),
      r = r0 + (r1 - r0) * ring;
    p.setXYZ(
      i,
      centre.x + (p.getX(i) - centre.x) * r,
      centre.y + (p.getY(i) - centre.y) * r,
      centre.z + (p.getZ(i) - centre.z) * r,
    );
  }
  const top = Math.max(...points.map((q) => q.y)),
    low = Math.min(...points.map((q) => q.y));
  return coloured(
    g,
    colour,
    tip
      ? { colour: tip, from: low + (top - low) * 0.6, to: top, axis: 'y' }
      : undefined,
  );
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function spanishShawlGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The body: slender, deepest just behind the head, tapering to a pointed tail.
  const body = new THREE.SphereGeometry(1, 14, 8),
    bp = body.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const z = bp.getZ(i),
      tail = z < 0 ? 1 - 0.75 * (-z) ** 1.5 : 1;
    bp.setXYZ(
      i,
      bp.getX(i) * 0.008 * tail,
      bp.getY(i) * 0.006 * tail,
      z * 0.036,
    );
  }
  body.translate(0, 0.007, 0);
  parts.push(coloured(body, BODY));
  // The foot's flared margin, paler, just above the ground.
  const foot = new THREE.SphereGeometry(1, 14, 3);
  foot.scale(0.011, 0.0015, 0.037);
  foot.translate(0, 0.0015, -0.002);
  parts.push(coloured(foot, FOOT));
  for (const side of [-1, 1]) {
    // Long oral tentacles sweeping out and forward.
    parts.push(
      tube(
        [
          v(side * 0.004, 0.005, 0.032),
          v(side * 0.012, 0.006, 0.042),
          v(side * 0.02, 0.004, 0.05),
        ],
        0.0018,
        0.0006,
        BODY,
      ),
    );
    // Scarlet ringed rhinophores, swept slightly back.
    const r = new THREE.CylinderGeometry(0.0008, 0.0022, 0.012, 8, 6),
      rp = r.getAttribute('position');
    for (let i = 0; i < rp.count; i++) {
      const ring = 1 + 0.25 * Math.max(0, Math.sin(rp.getY(i) * 1300));
      rp.setX(i, rp.getX(i) * ring);
      rp.setZ(i, rp.getZ(i) * ring);
    }
    r.rotateX(-0.35);
    r.translate(side * 0.004, 0.019, 0.026);
    parts.push(coloured(r, RHINO));
    // Clusters of cerata down each side of the back: fat, curved, overlapping, tips paler.
    for (let k = 0; k < 7; k++) {
      const z = 0.018 - k * 0.0072,
        // This exact silhouette is also exported in the canonical kelp miniature library.
        // Broad, countable cerata read better than the former forest of hair-like strings.
        count = 2 + (k % 2);
      for (let j = 0; j < count; j++) {
        const out = 0.004 + j * 0.0022,
          len = (0.011 - j * 0.0012) * (1 - k * 0.06),
          base = v(side * out, 0.009, z + j * 0.0008);
        parts.push(
          tube(
            [
              base,
              v(side * (out + len * 0.35), 0.009 + len * 0.7, z - len * 0.1),
              v(side * (out + len * 0.7), 0.009 + len, z - len * 0.25),
            ],
            0.0016,
            0.0007,
            CERAS,
            TIP,
          ),
        );
      }
    }
  }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw Error('Spanish shawl could not be built');
  return g;
}
