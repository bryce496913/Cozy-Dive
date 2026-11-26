import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

export type Point = readonly [number, number, number];
export interface BodySection {
  /** Longitudinal axis is +X, height +Y, width +Z. */
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly lowerHeight?: number;
  readonly y?: number;
  readonly z?: number;
}
function finite(values: readonly number[]): void {
  if (!values.every(Number.isFinite)) throw Error('Non-finite geometry input');
}
function count(n: number, min: number): void {
  if (!Number.isInteger(n) || n < min)
    throw Error('Invalid geometry resolution');
}
/** Construct caller-supplied outward triangles. The caller owns the result. */
export function surface(
  positions: readonly number[],
  indices: readonly number[],
): THREE.BufferGeometry {
  finite(positions);
  if (
    !positions.length ||
    positions.length % 3 ||
    !indices.length ||
    indices.length % 3 ||
    indices.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= positions.length / 3,
    )
  )
    throw Error('Invalid triangle topology');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex([...indices]);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
/** Join equal-resolution rings. Order as [x, sin(angle), cos(angle)] along +X,
 * or its orientation-preserving rotation. Caps have their own centres. */
export function ringSurface(
  rings: readonly (readonly Point[])[],
  caps = true,
): THREE.BufferGeometry {
  if (rings.length < 2) throw Error('At least two rings required');
  const sides = rings[0].length;
  count(sides, 3);
  if (rings.some((r) => r.length !== sides))
    throw Error('Ring resolutions must agree');
  const p = rings.flatMap((r) => r.flatMap((v) => [...v])),
    index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides),
        c = a + sides,
        d = b + sides;
      index.push(a, c, b, b, c, d);
    }
  if (caps)
    for (const end of [0, rings.length - 1]) {
      const centre = new THREE.Vector3();
      for (const v of rings[end]) centre.add(new THREE.Vector3(...v));
      centre.divideScalar(sides);
      const tip = p.length / 3;
      p.push(centre.x, centre.y, centre.z);
      for (let j = 0; j < sides; j++) {
        const a = end * sides + j,
          b = end * sides + ((j + 1) % sides);
        if (end === 0) index.push(tip, a, b);
        else index.push(tip, b, a);
      }
    }
  return surface(p, index);
}
/** Designed cross sections, not primitive stacking. Positive nonzero end sections create planar lips/caps. */
export function profileBody(
  sections: readonly BodySection[],
  sides = 8,
): THREE.BufferGeometry {
  count(sides, 4);
  if (sections.length < 2) throw Error('Body needs two sections');
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    finite([
      s.x,
      s.width,
      s.height,
      s.lowerHeight ?? s.height,
      s.y ?? 0,
      s.z ?? 0,
    ]);
    if (
      Math.min(s.width, s.height, s.lowerHeight ?? s.height) <= 0 ||
      (i && s.x <= sections[i - 1].x)
    )
      throw Error('Body sections must advance with positive dimensions');
  }
  const g = ringSurface(
    sections.map((s) =>
      Array.from({ length: sides }, (_, j): Point => {
        const a = (j / sides) * Math.PI * 2,
          h = Math.sin(a) >= 0 ? s.height : (s.lowerHeight ?? s.height);
        return [
          s.x,
          (s.y ?? 0) + Math.sin(a) * h,
          (s.z ?? 0) + Math.cos(a) * s.width,
        ];
      }),
    ),
  );
  // Longitudinal UVs, no duplicate seam geometry. Palette/vertex colors need no wrap seam.
  const uv = new Float32Array(g.getAttribute('position').count * 2);
  for (let i = 0; i < sections.length; i++)
    for (let j = 0; j < sides; j++)
      uv.set([i / (sections.length - 1), j / sides], (i * sides + j) * 2);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Outline in X/Z, thickness along Y. Concave outlines are triangulated; no self-intersecting outlines. */
export function fin(
  outline: readonly (readonly [number, number])[],
  thickness: readonly number[],
  subdivisions = 0,
): THREE.BufferGeometry {
  count(subdivisions, 0);
  if (
    subdivisions > 4 ||
    outline.length < 3 ||
    thickness.length !== outline.length
  )
    throw Error('Invalid fin layout');
  finite(outline.flat());
  finite(thickness);
  if (thickness.some((t) => t <= 0))
    throw Error('Fin thickness must be positive');
  const contour = outline.map((v) => new THREE.Vector2(...v)),
    area = THREE.ShapeUtils.area(contour);
  if (Math.abs(area) < 1e-8) throw Error('Degenerate fin outline');
  const tris = THREE.ShapeUtils.triangulateShape(contour, []),
    n = outline.length;
  const p = outline
    .flatMap((v, i) => [v[0], thickness[i] / 2, v[1]])
    .concat(outline.flatMap((v, i) => [v[0], -thickness[i] / 2, v[1]]));
  const idx: number[] = [];
  for (const t of tris) {
    const [a, b, c] = t,
      cross =
        (outline[b][0] - outline[a][0]) * (outline[c][1] - outline[a][1]) -
        (outline[b][1] - outline[a][1]) * (outline[c][0] - outline[a][0]);
    if (cross > 0) idx.push(a, c, b, a + n, b + n, c + n);
    else idx.push(a, b, c, a + n, c + n, b + n);
  }
  for (let a = 0; a < n; a++) {
    const b = (a + 1) % n;
    if (area > 0) idx.push(a, b, b + n, a, b + n, a + n);
    else idx.push(a, b + n, b, a, a + n, b + n);
  }
  // Midpoint subdivision shares vertices across every edge, including thickness boundaries.
  let triangles = idx;
  for (let step = 0; step < subdivisions; step++) {
    const edges = new Map<string, number>(),
      next: number[] = [];
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const old = edges.get(key);
      if (old !== undefined) return old;
      const i = p.length / 3;
      for (let k = 0; k < 3; k++) p.push((p[a * 3 + k] + p[b * 3 + k]) / 2);
      edges.set(key, i);
      return i;
    };
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = triangles.slice(i, i + 3),
        ab = midpoint(a, b),
        bc = midpoint(b, c),
        ca = midpoint(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    triangles = next;
  }
  return surface(p, triangles);
}
/** Mirror rest geometry before adding morphs. Reverses winding instead of requiring DoubleSide. */
export function mirrored(
  g: THREE.BufferGeometry,
  axis: 'x' | 'y' | 'z',
): THREE.BufferGeometry {
  if (Object.keys(g.morphAttributes).length)
    throw Error('Mirror before installing poses');
  const out = g.clone(),
    scale = new THREE.Vector3(1, 1, 1);
  scale[axis] = -1;
  out.scale(scale.x, scale.y, scale.z);
  if (!out.index) {
    out.dispose();
    throw Error('Mirror requires indexed geometry');
  }
  for (let i = 0; i < out.index.count; i += 3) {
    const b = out.index.getX(i + 1);
    out.index.setX(i + 1, out.index.getX(i + 2));
    out.index.setX(i + 2, b);
  }
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Smooth transported frames avoid a world-up seam when a stem/tentacle turns vertically. */
export function taperedCurve(
  points: readonly Point[],
  radii: readonly number[],
  sides = 6,
): THREE.BufferGeometry {
  count(sides, 3);
  if (points.length < 2 || radii.length !== points.length)
    throw Error('Curve section mismatch');
  points.forEach((p) => finite(p));
  finite(radii);
  if (radii.some((r) => r <= 0)) throw Error('Positive radii required');
  const centres = points.map((p) => new THREE.Vector3(...p)),
    tangents = centres.map((p, i) => {
      const d =
        i === centres.length - 1
          ? p.clone().sub(centres[i - 1])
          : centres[i + 1].clone().sub(p);
      if (d.lengthSq() < 1e-12) throw Error('Repeated curve centre');
      return d.normalize();
    });
  const normal = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(tangents[0])) > 0.9) normal.set(0, 0, 1);
  normal.addScaledVector(tangents[0], -normal.dot(tangents[0])).normalize();
  const rings = centres.map((c, i) => {
    if (i) {
      if (tangents[i].dot(tangents[i - 1]) < -0.999)
        throw Error('Curve reverses at a cusp');
      normal.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(tangents[i - 1], tangents[i]),
      );
    }
    const binormal = new THREE.Vector3()
      .crossVectors(tangents[i], normal)
      .normalize();
    return Array.from({ length: sides }, (_, j): Point => {
      const a = (j / sides) * Math.PI * 2,
        v = c
          .clone()
          .addScaledVector(normal, Math.sin(a) * radii[i])
          .addScaledVector(binormal, Math.cos(a) * radii[i]);
      return [v.x, v.y, v.z];
    });
  });
  return ringSurface(rings);
}

/** Purposeful support points define broad convex planes; variation is a bounded global stretch. */
export function polyhedron(
  points: readonly Point[],
  seed = 1,
  variation = 0.08,
): THREE.BufferGeometry {
  if (
    points.length < 4 ||
    !Number.isInteger(seed) ||
    !Number.isFinite(variation) ||
    variation < 0 ||
    variation > 0.25
  )
    throw Error('Invalid polyhedron parameters');
  points.forEach((p) => finite(p));
  const origin = new THREE.Vector3(...points[0]);
  const offsets = points
    .slice(1)
    .map((p) => new THREE.Vector3(...p).sub(origin));
  const axis = offsets.reduce(
    (best, p) => (p.lengthSq() > best.lengthSq() ? p : best),
    new THREE.Vector3(),
  );
  const normal = new THREE.Vector3();
  for (const p of offsets) {
    const candidate = new THREE.Vector3().crossVectors(axis, p);
    if (candidate.lengthSq() > normal.lengthSq()) normal.copy(candidate);
  }
  if (
    normal.lengthSq() === 0 ||
    !offsets.some(
      (p) => Math.abs(p.dot(normal)) > 1e-10 * normal.length() * axis.length(),
    )
  )
    throw Error('Polyhedron needs noncoplanar support points');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const scale = new THREE.Vector3(
    ...(Array.from({ length: 3 }, () => 1 + (random() * 2 - 1) * variation) as [
      number,
      number,
      number,
    ]),
  );
  const g = new ConvexGeometry(
    points.map((p) => new THREE.Vector3(...p).multiply(scale)),
  );
  if (!g.getAttribute('position').count) {
    g.dispose();
    throw Error('Polyhedron needs a 3D volume');
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Assign whole faces to anatomical palette regions, not random triangles. Returns an owned copy. */
export function colorRegions(
  source: THREE.BufferGeometry,
  palette: readonly THREE.ColorRepresentation[],
  region: (centre: THREE.Vector3) => number,
): THREE.BufferGeometry {
  if (!palette.length) throw Error('Palette is empty');
  const g = source.index ? source.toNonIndexed() : source.clone(),
    p = g.getAttribute('position'),
    colors = new Float32Array(p.count * 3),
    centre = new THREE.Vector3(),
    tmp = new THREE.Vector3(),
    values = palette.map((c) => new THREE.Color(c));
  g.clearGroups();
  try {
    for (let i = 0; i < p.count; i += 3) {
      centre.set(0, 0, 0);
      for (let j = 0; j < 3; j++) centre.add(tmp.fromBufferAttribute(p, i + j));
      centre.multiplyScalar(1 / 3);
      const r = region(centre);
      if (!Number.isInteger(r) || !values[r])
        throw Error('Unknown color region');
      for (let j = 0; j < 3; j++) values[r].toArray(colors, (i + j) * 3);
      // Groups expose anatomical boundaries to callers using palette material arrays.
      const last = g.groups[g.groups.length - 1];
      if (last?.materialIndex === r) last.count += 3;
      else g.addGroup(i, 3, r);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  } catch (e) {
    g.dispose();
    throw e;
  }
}

/** Morph poses use position-only transforms so split facet/color vertices stay coincident. */
export function addPose(
  g: THREE.BufferGeometry,
  name: string,
  deform: (rest: THREE.Vector3, out: THREE.Vector3) => void,
): void {
  if (!name || g.morphAttributes.position?.some((a) => a.name === name))
    throw Error('Pose name must be unique');
  if (g.morphAttributes.position?.length && !g.morphTargetsRelative)
    throw Error('Relative poses required');
  const p = g.getAttribute('position'),
    delta = new Float32Array(p.count * 3),
    rest = new THREE.Vector3(),
    out = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    rest.fromBufferAttribute(p, i);
    out.copy(rest);
    deform(rest, out);
    finite([out.x, out.y, out.z]);
    delta[i * 3] = out.x - p.getX(i);
    delta[i * 3 + 1] = out.y - p.getY(i);
    delta[i * 3 + 2] = out.z - p.getZ(i);
  }
  const attribute = new THREE.BufferAttribute(delta, 3);
  attribute.name = name;
  (g.morphAttributes.position ??= []).push(attribute);
  g.morphTargetsRelative = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

/** A continuous Y junction: a six-vertex trunk divides into two four-vertex ports.
 * The ports share their central edge; there are no overlapping closed tubes or internal caps.
 * Deliberately restricted to this authored silhouette, rather than pretending arbitrary tube unions are safe.
 */
export function forkedBranch(
  options: { height?: number; width?: number; spread?: number } = {},
): THREE.BufferGeometry {
  const height = options.height ?? 1.65,
    width = options.width ?? 0.28,
    spread = options.spread ?? 0.99;
  finite([height, width, spread]);
  if (Math.min(height, width, spread) <= 0)
    throw Error('Positive fork dimensions required');
  const p: number[] = [],
    idx: number[] = [];
  const ring = (y: number, radius: number) => {
    const ids: number[] = [];
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [-1, 1],
      [-1, 0],
    ]) {
      ids.push(p.length / 3);
      p.push(x * radius, y, z * radius);
    }
    return ids;
  };
  const join = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      idx.push(a[i], b[i], a[j], a[j], b[i], b[j]);
    }
  };
  const cap = (r: number[], reverse: boolean) => {
    const centre = new THREE.Vector3();
    for (const i of r)
      centre.add(new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
    centre.divideScalar(r.length);
    const tip = p.length / 3;
    p.push(centre.x, centre.y, centre.z);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      if (reverse) idx.push(tip, r[j], r[i]);
      else idx.push(tip, r[i], r[j]);
    }
  };
  const base = ring(0, 0.14),
    middle = ring(0.45, 0.12),
    fork = ring(0.8, 0.13);
  join(base, middle);
  join(middle, fork);
  cap(base, false);
  for (const sign of [-1, 1]) {
    let port =
      sign < 0
        ? [fork[0], fork[1], fork[2], fork[5]]
        : [fork[5], fork[2], fork[3], fork[4]];
    for (const [y, z, r] of [
      [1.05, 0.25, 0.12],
      [1.35, 0.4, 0.085],
      [1.65, 0.47, 0.025],
    ]) {
      const next: number[] = [];
      for (const [x, dz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        next.push(p.length / 3);
        p.push(x * r, y, sign * z + dz * r);
      }
      join(port, next);
      port = next;
    }
    cap(port, true);
  }
  return surface(p, idx).scale(width / 0.28, height / 1.65, spread / 0.99);
}
