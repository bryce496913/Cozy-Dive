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
/** Distance from the origin along unit `d` to the convex hull given as triangle planes. */
function hullRadius(
  planes: readonly (readonly [number, number, number, number])[],
  dx: number,
  dy: number,
  dz: number,
): number {
  let r = Infinity;
  for (const [nx, ny, nz, off] of planes) {
    const dn = nx * dx + ny * dy + nz * dz;
    if (dn > 1e-9) r = Math.min(r, off / dn);
  }
  return Number.isFinite(r) ? r : 0;
}
/**
 * V0.7 Pass 070: a finer surface on the hull, carved inward: a few fracture planes (flat broken
 * faces with crisp edges), bedding grooves for slabs, solution pits, and fine rounded wear. Returns
 * indexed-then-creased geometry with a `carve` attribute (depth carved, for colouring).
 */
/**
 * V0.7 Pass 079: optional large-scale massing for big boulders seen from afar: extra, deeper
 * fracture caps and a few clefts (great-circle grooves) that split the silhouette into
 * recognisable masses. Still carved only inward.
 */
export interface RockMassing {
  /** Extra fracture caps, and how low they may cut (fraction of the hull radius). */
  readonly cuts: number;
  readonly cutLow: number;
  /** Clefts across the rock, their depth (fraction of the hull radius) and width (radians). */
  readonly clefts: number;
  readonly cleftDepth: number;
  readonly cleftWidth: number;
}
function carvedRock(
  hullPositions: readonly number[],
  family: number,
  detail: number,
  random: () => number,
  phase: number,
  massing?: RockMassing,
): THREE.BufferGeometry {
  const planes: [number, number, number, number][] = [],
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let i = 0; i + 8 < hullPositions.length; i += 9) {
    a.fromArray(hullPositions, i);
    b.fromArray(hullPositions, i + 3);
    c.fromArray(hullPositions, i + 6);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const off = n.dot(a);
    // Hull triangles wind outward; keep the outward-facing support plane either way.
    if (off < 0) planes.push([-n.x, -n.y, -n.z, -off]);
    else planes.push([n.x, n.y, n.z, off]);
  }
  // Fracture planes cutting caps off the rock (more for the fractured family).
  const cuts: [number, number, number, number][] = [];
  const count = family === 2 ? 5 : family === 1 ? 3 : 2;
  for (let k = 0; k < count; k++) {
    const t = random() * Math.PI * 2,
      up = random() * 1.2 - 0.3,
      cx = Math.cos(t) * Math.cos(up),
      cy = Math.sin(up),
      cz = Math.sin(t) * Math.cos(up);
    cuts.push([cx, cy, cz, 0.66 + random() * 0.14]);
  }
  const clefts: [number, number, number][] = [];
  if (massing) {
    for (let k = 0; k < massing.cuts; k++) {
      const t = random() * Math.PI * 2,
        up = random() * 1.4 - 0.4;
      cuts.push([
        Math.cos(t) * Math.cos(up),
        Math.sin(up),
        Math.sin(t) * Math.cos(up),
        massing.cutLow + random() * 0.12,
      ]);
    }
    // Cleft planes through the centre, mostly steep (joints in the bedrock run near vertical).
    for (let k = 0; k < massing.clefts; k++) {
      const t = random() * Math.PI * 2,
        tip = (random() - 0.5) * 0.6;
      clefts.push([Math.cos(t), tip, Math.sin(t)]);
    }
  }
  // Solution pits and cavities: dimples at random points on the surface.
  const pits: [number, number, number, number, number][] = [];
  const pitCount = family === 0 ? 14 : 8;
  for (let k = 0; k < pitCount; k++) {
    const t = random() * Math.PI * 2,
      u = random() * 1.6 - 0.6;
    pits.push([
      Math.cos(t) * Math.sqrt(1 - u * u),
      u,
      Math.sin(t) * Math.sqrt(1 - u * u),
      0.08 + random() * 0.16,
      0.04 + random() * 0.07,
    ]);
  }
  const level = detail <= 1 ? 3 : Math.min(4, detail + 2);
  const source = new THREE.IcosahedronGeometry(1, level);
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const g = mergeVertices(source, 1e-6);
  source.dispose();
  const p = g.getAttribute('position'),
    carve = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i),
      dy = p.getY(i),
      dz = p.getZ(i),
      len = Math.hypot(dx, dy, dz),
      ux = dx / len,
      uy = dy / len,
      uz = dz / len,
      hull = hullRadius(planes, ux, uy, uz);
    let r = hull;
    for (const [cx, cy, cz, h] of cuts) {
      const dn = cx * ux + cy * uy + cz * uz;
      if (dn > 1e-6) r = Math.min(r, (h * hull) / dn);
    }
    const y = uy * r;
    // Bedding: fine horizontal grooves where slab layers weather back.
    if (family === 1)
      r -= 0.028 * Math.pow(0.5 + 0.5 * Math.cos(y * 22 + phase), 10);
    for (const [kx, ky, kz] of clefts) {
      // Angle from the cleft's plane; the groove is deepest low on the rock, closing toward the top.
      const off = Math.asin(
          Math.max(
            -1,
            Math.min(1, (kx * ux + ky * uy + kz * uz) / Math.hypot(kx, ky, kz)),
          ),
        ),
        low = 1 - 0.45 * Math.max(0, uy);
      r -=
        (massing?.cleftDepth ?? 0) *
        hull *
        low *
        Math.exp(-((off / (massing?.cleftWidth ?? 1)) ** 2));
    }
    for (const [px, py, pz, w, depth] of pits) {
      const ang = Math.acos(Math.min(1, px * ux + py * uy + pz * uz));
      r -= depth * Math.exp(-((ang / w) ** 2));
    }
    // Erosion: lumpy mid-scale relief and fine rounded wear (two octaves, never outward).
    const lumps =
      0.5 +
      0.5 *
        Math.sin(ux * 5.3 + uy * 2.1 + phase) *
        Math.sin(uz * 4.7 - uy * 3.3 + phase * 1.7);
    r -=
      0.05 * lumps * lumps +
      0.014 *
        (1 +
          Math.sin(ux * 13 + phase) * Math.sin(uz * 11 - uy * 7 + phase * 0.6));
    r = Math.max(r, hull * 0.55);
    carve[i] = Math.max(0, hull - r) / Math.max(hull, 1e-6);
    p.setXYZ(i, ux * r, uy * r, uz * r);
  }
  g.setAttribute('carve', new THREE.BufferAttribute(carve, 1));
  g.computeVertexNormals();
  // Crisp where fractures fold the surface, smooth over worn rock.
  const out = toCreasedNormals(g, Math.PI / 4);
  g.dispose();
  return withHullBounds(out, hullPositions);
}
/**
 * Callers fit each rock to its bounding box, so the rendered bounds must be exactly the hull's or a
 * carved (slightly smaller) surface would be scaled up, and its collider with it. Append the hull's
 * six extreme points as zero-area triangles: invisible, inside the hull, and they pin the bounds.
 */
function withHullBounds(
  g: THREE.BufferGeometry,
  hullPositions: readonly number[],
): THREE.BufferGeometry {
  const extremes: number[] = [];
  for (let axis = 0; axis < 3; axis++) {
    let lo = 0,
      hi = 0;
    for (let i = 0; i < hullPositions.length; i += 3) {
      if (hullPositions[i + axis] < hullPositions[lo + axis]) lo = i;
      if (hullPositions[i + axis] > hullPositions[hi + axis]) hi = i;
    }
    for (const at of [lo, hi])
      for (let k = 0; k < 3; k++)
        extremes.push(
          hullPositions[at],
          hullPositions[at + 1],
          hullPositions[at + 2],
        );
  }
  const extra = extremes.length / 3,
    out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'carve'] as const) {
    const src = g.getAttribute(name),
      size = src.itemSize,
      data = new Float32Array((src.count + extra) * size);
    data.set(src.array as Float32Array);
    for (let v = 0; v < extra; v++) {
      const x = extremes[v * 3],
        y = extremes[v * 3 + 1],
        z = extremes[v * 3 + 2],
        l = Math.hypot(x, y, z) || 1,
        o = (src.count + v) * size;
      if (name === 'position') data.set([x, y, z], o);
      else if (name === 'normal') data.set([x / l, y / l, z / l], o);
      else data[o] = 0;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  g.dispose();
  return out;
}
/**
 * V0.7 Pass 079: carve the given convex hull (its triangle positions) with the Pass 070 surface,
 * plus optional massing. Returns geometry inside the hull with the hull's exact bounds and a
 * `carve` attribute (0 on the envelope, larger where carved), for callers to colour.
 */
export function carveConvexHull(
  hullPositions: readonly number[],
  family: number,
  detail: number,
  seed: number,
  massing?: RockMassing,
): THREE.BufferGeometry {
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return carvedRock(
    hullPositions,
    family,
    detail,
    random,
    random() * Math.PI * 2,
    massing,
  );
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
  // Displaced points may be concave; explicitly rebuild the convex hull: it is the rock's envelope
  // and its collider.
  const hull = new ConvexGeometry(points);
  const hullPositions = Array.from(hull.getAttribute('position').array);
  hull.dispose();
  // V0.7 Pass 070: the rendered rock is a finer surface projected onto that hull and then carved
  // only inward (it was the bare hull: smooth, inflated). Fractured faces, bedding grooves on
  // slabs, solution pits and rounded wear give it a formed, weathered character, and because
  // carving never pushes outward the rock stays inside its collider and routes never narrow.
  const geometry = carvedRock(hullPositions, family, detail, random, phase);
  const positions = geometry.getAttribute('position'),
    carve = geometry.getAttribute('carve'),
    colors = new Float32Array(positions.count * 3),
    color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const bands =
      Math.sin(y * 10 + x * 2.4 + phase) * Math.cos(z * 3.5 + phase) * 0.035;
    const mineral = Math.sin(x * 4.5 + z * 3.2 + phase) * 0.045;
    // Carved hollows (pits, grooves) hold shadow and silt; fresh fracture faces read paler.
    const hollow = carve.getX(i);
    const light = Math.max(
      0.55,
      0.82 + bands + mineral + Math.max(0, y) * 0.08 - hollow * 2.2,
    );
    color.setRGB(
      light * (1 + 0.035 * Math.sin(phase)),
      light,
      light * (0.97 + 0.025 * Math.cos(phase)),
    );
    color.toArray(colors, i * 3);
  }
  geometry.deleteAttribute('carve');
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  // The exact convex envelope travels with the geometry (plain data, so clones keep it); the
  // collider uses it while the geometry is untransformed (see rockCollider).
  geometry.userData.collisionHull = hullPositions;
  geometry.userData.collisionBox = geometry
    .boundingBox!.min.toArray()
    .concat(geometry.boundingBox!.max.toArray());
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

/**
 * v0.6 Pass 046 review: a copy of a rock shape, generating each (seed, family, detail) only once. Each
 * rock takes 1–2 ms to generate; an area's builds reuse a small set of shapes (varied by scale and
 * turn), so building a world no longer stalls a frame for hundreds of milliseconds. The cache
 * holds plain CPU-side geometry (never uploaded); callers own and dispose their copies.
 */
const shapes = new Map<string, THREE.BufferGeometry>();
export function rockShape(
  seed: number,
  family: number,
  detail = 2,
): THREE.BufferGeometry {
  const key = `${seed}/${family}/${detail}`;
  let shape = shapes.get(key);
  if (!shape) {
    shape = createRockGeometry(seed, family, detail);
    shapes.set(key, shape);
  }
  return shape.clone();
}
