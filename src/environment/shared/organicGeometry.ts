import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * V0.7 Pass 068 (small life): shared helpers so code-built small animals read as continuous
 * organic forms rather than assembled primitives.
 *
 * Every small-creature builder merges its parts as non-indexed, vertex-coloured geometry. They used
 * to convert to non-indexed and then recompute normals, which gives every triangle its own flat
 * normal: spheres became faceted balls and limbs became prisms. `smoothed` instead computes
 * creased normals: smooth across gentle bends (bodies, limbs, shells), sharp where the surface
 * truly folds (box edges, rims, cap edges), so hard features stay hard. Merging must then keep the
 * normals as they are.
 */

/** Below this angle between faces (75°) the surface is shaded smooth: five- and six-sided limbs and
 * spines read round. Above it the edge stays crisp: box corners and rims (90°). */
export const CREASE_ANGLE = (Math.PI * 5) / 12;

/**
 * Position-only, non-indexed geometry with creased (smooth where gentle) normals, ready to colour
 * and merge. Disposes `g` when it returns a new geometry.
 */
export function smoothed(
  g: THREE.BufferGeometry,
  crease = CREASE_ANGLE,
): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes))
    if (name !== 'position') g.deleteAttribute(name);
  const out = toCreasedNormals(g, crease);
  if (out !== g) g.dispose();
  return out;
}

/**
 * A continuous, tapering tube along a smooth curve through `points`, with rounded ends: one
 * organic surface for arms, legs, antennae, tentacles and tails (instead of a chain of cylinders
 * with joint spheres). `radius(u)` gives the radius from start (u 0) to end (u 1); `flat` squashes
 * the cross-section vertically (1 = round). Indexed, position only.
 */
export function organicTube(
  points: readonly THREE.Vector3[],
  radius: (u: number) => number,
  segments = 12,
  sides = 7,
  flat = 1,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
      points.map((p) => p.clone()),
      false,
      'centripetal',
    ),
    frames = curve.computeFrenetFrames(segments, false),
    pos: number[] = [],
    idx: number[] = [],
    c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    b = new THREE.Vector3();
  // Keep the flattening in world vertical where the curve allows it.
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, c);
    const t = frames.tangents[i];
    b.crossVectors(t, up);
    if (b.lengthSq() < 1e-8) b.copy(frames.binormals[i]);
    b.normalize();
    n.crossVectors(b, t).normalize();
    const r = Math.max(1e-5, radius(u));
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      pos.push(
        c.x + r * (Math.cos(a) * b.x + Math.sin(a) * n.x * flat),
        c.y + r * (Math.cos(a) * b.y + Math.sin(a) * n.y * flat),
        c.z + r * (Math.cos(a) * b.z + Math.sin(a) * n.z * flat),
      );
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        d = i * sides + ((j + 1) % sides);
      idx.push(a, a + sides, d, d, a + sides, d + sides);
    }
  // Rounded ends: a short cap point a little beyond each end ring.
  const ends: [number, number, THREE.Vector3][] = [
    [0, -1, curve.getPointAt(0)],
    [segments, 1, curve.getPointAt(1)],
  ];
  for (const [ring, dir, at] of ends) {
    const t = frames.tangents[ring],
      r = radius(ring / segments),
      tip = pos.length / 3;
    pos.push(
      at.x + t.x * dir * r * 0.6,
      at.y + t.y * dir * r * 0.6,
      at.z + t.z * dir * r * 0.6,
    );
    for (let j = 0; j < sides; j++) {
      const a = ring * sides + j,
        d = ring * sides + ((j + 1) % sides);
      if (dir < 0) idx.push(a, d, tip);
      else idx.push(a, tip, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/**
 * A curved sheet over a polar grid (shells, wing-lobes, fins): `at(r, a, out)` places the point
 * at normalised radius r (0 centre .. 1 rim) and angle a (from `a0` to `a1`). Rings give the sheet
 * its curvature (a bare circle has none inside its rim). Indexed, position only.
 */
export function polarSheet(
  at: (r: number, a: number, out: THREE.Vector3) => void,
  a0: number,
  a1: number,
  rings = 8,
  segments = 24,
): THREE.BufferGeometry {
  const pos: number[] = [],
    idx: number[] = [],
    p = new THREE.Vector3();
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j <= segments; j++) {
      at(i / rings, a0 + ((a1 - a0) * j) / segments, p);
      pos.push(p.x, p.y, p.z);
    }
  const w = segments + 1;
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const a = i * w + j;
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Multiply a coloured geometry's vertex colours by `k(x, y, z)` (bands, spots, rim shading). */
export function toned(
  g: THREE.BufferGeometry,
  k: (x: number, y: number, z: number) => number,
): THREE.BufferGeometry {
  const p = g.getAttribute('position'),
    c = g.getAttribute('color');
  for (let i = 0; i < p.count; i++) {
    const f = k(p.getX(i), p.getY(i), p.getZ(i));
    c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f);
  }
  return g;
}
