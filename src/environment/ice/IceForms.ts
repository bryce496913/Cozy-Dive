import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { ICE } from '../../config/passage';

/**
 * V0.8 Pass 086: sculpted ice. The icebergs, ice walls, grounded fragments and hanging chunks were
 * one carved-rock lump (`rockShape`) stretched to each size, so the sides of the world read as a
 * row of the same faceted block. Each form here is sculpted in metres at its own size, so its
 * features keep their scale whatever its proportions:
 *
 * - a rounded-box mass (squareness by kind) with broad low lobes;
 * - calving faces: a few flat planes sheared off the mass, clean and bluer (fresh ice);
 * - melt scallops: shallow dished hollows in a cellular pattern, about a metre across;
 * - layering: horizontal beds that recede and step out, coloured bubbly white and clear blue;
 * - vertical melt flutes down the sides;
 * - grounded forms flare into a skirt at the foot and have a melt notch above the seabed, so the
 *   ice settles into the sediment rather than standing on it.
 *
 * Translucency cues (no transmission pass): thin, convex scallop rims and edges lighter and
 * cyan, hollows and down-facing undersides deeper blue, the foot darker and bluer where little
 * daylight reaches. Returns non-indexed geometry (position, normal, color) in world space, smooth
 * shaded, ready to merge with the rest of the ice.
 */
export type IceKind = 'wall' | 'berg' | 'column' | 'shard' | 'chunk';

export interface IceFormSpec {
  readonly kind: IceKind;
  /** Full size (m): width (x), height (y) and depth (z) before the yaw. */
  readonly size: readonly [number, number, number];
  /** Where its base centre stands (world, m), and its turn about y. */
  readonly at: readonly [number, number, number];
  readonly yaw: number;
  readonly seed: number;
  /** How blue the ice is (0..1, as `iceColours`'s `deep`). */
  readonly deep: number;
  /** Seabed height under the form, for the foot's skirt and melt notch (omit if not grounded). */
  readonly ground?: number;
  /**
   * Carry a collision hull (`userData.collisionHull`, as the carved rocks do since Pass 070),
   * from a coarse copy of the same sculpt, expanded a little so it contains the rendered
   * surface. A hull of every rendered vertex costs ~0.1 s per form to turn into planes.
   */
  readonly solid?: boolean;
  /** Overrides the kind's subdivision (the collision proxy's coarse copy). */
  readonly detail?: number;
}

/** Subdivision of each kind's icosphere (three's is linear: 20 x (detail + 1)^2 triangles). */
export const ICE_DETAIL: Readonly<Record<IceKind, number>> = {
  wall: 15,
  berg: 18,
  column: 16,
  shard: 9,
  chunk: 5,
};
/** Rounded-box squareness by kind (2 is an ellipsoid). */
const SQUARE: Readonly<Record<IceKind, number>> = {
  wall: 3.6,
  berg: 3,
  column: 2.6,
  shard: 4,
  chunk: 2.4,
};
/** Named sculpt values (m unless noted). */
const SCULPT = {
  scallopCell: 1.5,
  scallopDepth: 0.4,
  bed: [1.1, 2.1] as const,
  bedStep: 0.12,
  fluteDepth: 0.1,
  lobe: 0.09,
  /** How far the form leans over its height (fraction of its width). */
  lean: 0.12,
  skirt: 0.22,
  notchHeight: 0.9,
  notchDepth: 0.18,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A hash of an integer lattice point to [0, 1). */
function hash(x: number, y: number, z: number, s: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13) ^ s, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** The nearest cellular feature's distance (cell units, 0..~1.2): low at a scallop's centre. */
function cellular(x: number, y: number, z: number, s: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  let best = 9;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let c = -1; c <= 1; c++) {
        const cx = ix + a,
          cy = iy + b,
          cz = iz + c,
          dx = cx + hash(cx, cy, cz, s) - x,
          dy = cy + hash(cx, cy, cz, s + 1) - y,
          dz = cz + hash(cx, cy, cz, s + 2) - z,
          d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
      }
  return Math.sqrt(best);
}

interface Plane {
  readonly n: THREE.Vector3;
  readonly d: number;
}

export function iceForm(spec: IceFormSpec): THREE.BufferGeometry {
  const rand = random(spec.seed),
    [sx, sh, sz] = spec.size,
    hx = sx / 2,
    hy = sh / 2,
    hz = sz / 2,
    p = SQUARE[spec.kind],
    g = unitSphere(spec.detail ?? ICE_DETAIL[spec.kind]),
    pos = g.getAttribute('position') as THREE.BufferAttribute,
    count = pos.count,
    feature = new Float32Array(count * 3),
    v = new THREE.Vector3(),
    phase = [rand() * 9, rand() * 9, rand() * 9, rand() * 9],
    seed = Math.floor(rand() * 1e6),
    bed = SCULPT.bed[0] + rand() * (SCULPT.bed[1] - SCULPT.bed[0]),
    bedPhase = rand(),
    leanX = (rand() - 0.5) * 2 * SCULPT.lean,
    leanZ = (rand() - 0.5) * 2 * SCULPT.lean;
  // Calving faces: planes sheared off the mass, mostly steep (sides), some across a top corner.
  const planes: Plane[] = [],
    cuts = spec.kind === 'chunk' ? 3 : spec.kind === 'shard' ? 5 : 4;
  for (let i = 0; i < cuts; i++) {
    const a = rand() * Math.PI * 2,
      tilt = (rand() - 0.3) * 0.9,
      n = new THREE.Vector3(
        Math.cos(a) * Math.cos(tilt),
        Math.sin(tilt),
        Math.sin(a) * Math.cos(tilt),
      ).normalize();
    // Where the plane lies: the support distance of the box along n, pulled in.
    const support =
      Math.abs(n.x) * hx + Math.abs(n.y) * hy + Math.abs(n.z) * hz;
    planes.push({ n, d: support * (0.55 + rand() * 0.2) });
  }
  // Local y runs -hy..hy about the form's centre, which stands hy above its base (`at`).
  const cy = spec.at[1] + hy,
    foot = spec.ground !== undefined ? spec.ground - cy : -Infinity;
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);
    // Rounded box: scale the sphere direction to the superellipsoid's surface.
    const ax = Math.abs(v.x),
      ay = Math.abs(v.y),
      az = Math.abs(v.z),
      k = (ax ** p + ay ** p + az ** p) ** (-1 / p);
    let x = v.x * k * hx,
      y = v.y * k * hy,
      z = v.z * k * hz;
    // Columns and shards taper toward their tops.
    if (spec.kind === 'column') {
      const waist = 1 - 0.32 * Math.sin(Math.PI * (0.5 + (0.5 * y) / hy));
      x *= waist;
      z *= waist;
    } else if (spec.kind === 'shard') {
      const t = 0.5 + (0.5 * y) / hy;
      x *= 1 - 0.45 * t;
      z *= 1 - 0.3 * t;
    }
    // Broad lobes, in proportion to the form, so the masses are not uniform boxes.
    const r = Math.hypot(x, y, z) || 1,
      nx = x / r,
      ny = y / r,
      nz = z / r,
      span = Math.min(sx, sh, sz),
      lobe =
        SCULPT.lobe *
        span *
        (Math.sin(nx * 2.3 + phase[0]) * Math.sin(ny * 1.9 + phase[1]) +
          0.6 * Math.sin(nz * 2.9 + ny * 1.3 + phase[2]));
    x += nx * lobe + leanX * (y / hy) * hx;
    y += ny * lobe * 0.5;
    z += nz * lobe + leanZ * (y / hy) * hz;
    // Calving: clamp onto each plane (flat, clean faces with crisp edges at the grid's scale).
    let calved = 0;
    for (const pl of planes) {
      const over = x * pl.n.x + y * pl.n.y + z * pl.n.z - pl.d;
      if (over > 0) {
        x -= pl.n.x * over;
        y -= pl.n.y * over;
        z -= pl.n.z * over;
        calved = 1;
      }
    }
    // Horizontal direction outward (for side-only sculpting), and how side-facing this is.
    const hr = Math.hypot(x / hx, z / hz) || 1,
      ox = x / hx / hr,
      oz = z / hz / hr,
      side = Math.min(1, Math.hypot(nx, nz) * 1.15),
      wy = cy + y;
    // Melt scallops (weathered surfaces only; calving faces are fresh and smooth).
    const cell = cellular(
        x / SCULPT.scallopCell,
        wy / SCULPT.scallopCell,
        z / SCULPT.scallopCell,
        seed,
      ),
      dish = (1 - Math.min(1, cell)) ** 2 * (1 - 0.8 * calved);
    // Beds: each recedes upward and steps out at its base; flutes run down the sides.
    // Uneven beds (thick and thin), each stepped by its own amount, a few hardly at all: an
    // even stack of equal ledges read as a tiered cake.
    const beds =
        wy / bed +
        bedPhase +
        0.35 * Math.sin(wy * 0.55 + phase[2]) +
        0.05 * Math.sin(x * 0.21 + z * 0.17),
      f = beds - Math.floor(beds),
      strength = hash(Math.floor(beds), 7, 3, seed) ** 1.5,
      step = smooth(0.05, 0.97, f) ** 1.5 * side * strength,
      angle = Math.atan2(oz, ox),
      flute =
        Math.max(
          0,
          Math.sin(
            angle * Math.max(5, Math.round((sx + sz) * 0.55)) + phase[3],
          ),
        ) **
          4 *
        side;
    let inset =
      SCULPT.scallopDepth * dish +
      SCULPT.bedStep * step +
      SCULPT.fluteDepth * flute;
    // Grounded: a skirt flaring into the seabed and a melt notch just above it.
    const above = y - foot;
    if (Number.isFinite(foot)) {
      const flare = SCULPT.skirt * (1 - smooth(0, 1.6, above)),
        notch =
          SCULPT.notchDepth *
          Math.exp(-(((above - SCULPT.notchHeight) / 0.35) ** 2));
      x += ox * flare * hx * 0.25;
      z += oz * flare * hz * 0.25;
      inset += notch * side;
    }
    x -= nx * inset;
    z -= nz * inset;
    y -= ny * inset * 0.4;
    pos.setXYZ(i, x, y, z);
    feature[i * 3] = dish;
    feature[i * 3 + 1] = calved;
    feature[i * 3 + 2] = Math.floor(beds) % 2 === 0 ? 1 : 0;
  }
  g.computeVertexNormals();
  g.rotateY(spec.yaw);
  g.translate(spec.at[0], cy, spec.at[2]);
  paint(g, feature, spec.deep);
  const out = g.toNonIndexed();
  g.dispose();
  if (spec.solid) attachHull(out, spec);
  return out;
}

/** The proxy's subdivision, and how far its hull is pushed out from the form's centre. */
const HULL = { detail: 8, grow: 1.05 } as const;
function attachHull(g: THREE.BufferGeometry, spec: IceFormSpec): void {
  const proxy = iceForm({ ...spec, solid: false, detail: HULL.detail }),
    p = proxy.getAttribute('position'),
    centre = new THREE.Vector3(
      spec.at[0],
      spec.at[1] + spec.size[1] / 2,
      spec.at[2],
    ),
    points: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++)
    points.push(
      new THREE.Vector3()
        .fromBufferAttribute(p, i)
        .sub(centre)
        .multiplyScalar(HULL.grow)
        .add(centre),
    );
  proxy.dispose();
  const hull = new ConvexGeometry(points);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  g.userData.collisionHull = Array.from(hull.getAttribute('position').array);
  g.userData.collisionBox = b.min.toArray().concat(b.max.toArray());
  hull.dispose();
}

/**
 * A welded unit icosphere at `detail`, copied from a cache (welding by position is the costly
 * step, and every form of a kind shares the same sphere).
 */
const spheres = new Map<number, THREE.BufferGeometry>();
function unitSphere(detail: number): THREE.BufferGeometry {
  let s = spheres.get(detail);
  if (!s) {
    const raw = new THREE.IcosahedronGeometry(1, detail);
    s = mergeByPosition(raw);
    raw.dispose();
    spheres.set(detail, s);
  }
  return s.clone();
}
/** An icosphere's vertices welded (three's polyhedra are non-indexed), so it shades smooth. */
function mergeByPosition(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.getAttribute('position'),
    map = new Map<string, number>(),
    verts: number[] = [],
    idx: number[] = [];
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i),
      y = src.getY(i),
      z = src.getZ(i),
      key = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;
    let k = map.get(key);
    if (k === undefined) {
      k = verts.length / 3;
      map.set(key, k);
      verts.push(x, y, z);
    }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(idx);
  return out;
}

/** Ice colour with translucency cues, from the world position, normal and sculpt features. */
function paint(
  g: THREE.BufferGeometry,
  feature: Float32Array,
  deep: number,
): void {
  const pos = g.getAttribute('position'),
    nor = g.getAttribute('normal'),
    col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      ny = nor.getY(i),
      dish = feature[i * 3],
      calved = feature[i * 3 + 1],
      band = feature[i * 3 + 2],
      noise =
        0.5 + 0.5 * Math.sin(x * 1.3 + y * 0.7) * Math.sin(z * 1.1 - y * 0.5),
      // Blue: deeper in hollows, on fresh calving faces, in clear beds and on undersides.
      blue = Math.min(
        1,
        deep * (0.3 + 0.6 * noise) +
          0.4 * dish +
          0.45 * calved +
          0.22 * (1 - band) +
          0.3 * Math.max(0, -ny),
      ),
      // Scallop rims (convex, thin) catch the light like translucent edges.
      rim = (1 - dish) * smooth(0.2, 0.9, 1 - dish) * (1 - calved) * 0.12,
      // Bubbly beds read whiter; basal dirt bands near the seabed; rime under the sea ice.
      bubbles = band * 0.06,
      dirt =
        Math.max(0, 1 - y / 1.6) * Math.max(0, Math.sin(y * 9 + x * 0.6)) ** 4,
      rime = Math.min(1, Math.max(0, (y - (ICE.ceiling - 1.5)) / 1.5)),
      up = Math.max(0, ny) * 0.06,
      r =
        0.86 -
        0.36 * blue +
        rim * 0.7 +
        bubbles +
        up -
        0.35 * dirt +
        0.1 * rime,
      gg = 0.93 - 0.2 * blue + rim + bubbles + up - 0.38 * dirt + 0.06 * rime,
      b =
        0.98 -
        0.04 * blue +
        rim +
        bubbles * 0.6 +
        up -
        0.42 * dirt +
        0.02 * rime,
      // Darker and bluer toward the foot, where less daylight reaches (as `iceColours`).
      lit = 0.66 + 0.34 * Math.min(1, Math.max(0, y / ICE.ceiling));
    col[i * 3] = r * lit;
    col[i * 3 + 1] = gg * lit ** 0.8;
    col[i * 3 + 2] = b * lit ** 0.45;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
