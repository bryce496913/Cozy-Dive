import * as THREE from 'three';
import { OFFICE } from '../../config/office';

/**
 * v0.3 Pass 022: soft baked contact shadows on the office floor, under furniture and along the
 * base of the walls, so the room sits on its floor. Nothing in the office casts real-time shadows
 * (they would cost a depth pass per light); instead each footprint gets a rounded patch whose
 * vertex alpha fades from the footprint's edge outwards over `spread` metres. Building the fade
 * into rings of vertices keeps its width the same for long and short pieces, needs no texture,
 * and every patch merges into one geometry: a single extra draw call.
 */
export interface ShadowPatch {
  /** Footprint centre and size on the floor (m). */
  readonly center: { readonly x: number; readonly z: number };
  readonly size: { readonly x: number; readonly z: number };
  /** Corner rounding of the footprint (m); half the size makes a disc. */
  readonly round: number;
  /** Darkness under the footprint (alpha, 0..1) and how far it fades out beyond it (m). */
  readonly strength: number;
  readonly spread: number;
}
/** A darkening band along a wall's base, fading into the room. */
export interface WallBand {
  readonly from: { readonly x: number; readonly z: number };
  readonly to: { readonly x: number; readonly z: number };
  /** Unit direction into the room. */
  readonly inward: { readonly x: number; readonly z: number };
  readonly strength: number;
  readonly width: number;
}

export const SHADOW = {
  /** Height above the floor (above the rug too), with a depth offset against z-fighting (m). */
  lift: 0.007,
  /** Warm, dark shadow colour (linear RGB). */
  color: [0.09, 0.06, 0.04] as const,
  /** Alpha at fractions of the spread: a smooth falloff in three steps. */
  falloff: [
    [0, 1],
    [0.3, 0.55],
    [0.65, 0.18],
    [1, 0],
  ] as const,
  /** Segments per rounded corner. */
  cornerSegments: 4,
} as const;

/** The office's shadow layout, from the shared furniture configuration. */
export function officeShadowLayout(): {
  patches: ShadowPatch[];
  walls: WallBand[];
} {
  const o = OFFICE,
    r = o.room;
  const patch = (
    c: { x: number; z: number },
    s: { x: number; z: number },
    strength: number,
    spread: number,
    round = 0.04,
  ): ShadowPatch => ({ center: c, size: s, round, strength, spread });
  const patches: ShadowPatch[] = [
    // The desk stands on legs: a lighter shadow under its whole top.
    patch(o.desk.center, o.desk.size, 0.26, 0.28),
    // The chair's base is smaller than its seat.
    patch(o.chair.center, { x: 0.5, z: 0.5 }, 0.3, 0.16, 0.25),
    patch(o.shelf.center, o.shelf.size, 0.42, 0.14),
    // The tank's cabinet: solid, and heavy.
    patch(o.stand.center, o.stand.size, 0.48, 0.15),
    ...o.plants.map((p) =>
      patch(p, { x: p.radius * 2, z: p.radius * 2 }, 0.42, 0.12, p.radius),
    ),
  ];
  const band = (
    from: { x: number; z: number },
    to: { x: number; z: number },
    inward: { x: number; z: number },
  ): WallBand => ({ from, to, inward, strength: 0.2, width: 0.32 });
  const walls: WallBand[] = [
    band(
      { x: r.min.x, z: r.min.z },
      { x: r.max.x, z: r.min.z },
      { x: 0, z: 1 },
    ),
    band(
      { x: r.min.x, z: r.max.z },
      { x: r.max.x, z: r.max.z },
      { x: 0, z: -1 },
    ),
    band(
      { x: r.min.x, z: r.min.z },
      { x: r.min.x, z: r.max.z },
      { x: 1, z: 0 },
    ),
    band(
      { x: r.max.x, z: r.min.z },
      { x: r.max.x, z: r.max.z },
      { x: -1, z: 0 },
    ),
  ];
  return { patches, walls };
}

/** One merged floor geometry (positions and RGBA colours) for the given layout. */
export function contactShadowGeometry(layout: {
  patches: readonly ShadowPatch[];
  walls: readonly WallBand[];
}): THREE.BufferGeometry {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const [cr, cg, cb] = SHADOW.color;
  const room = OFFICE.room;
  // Patches against a wall end at the wall rather than spilling through it.
  const vertex = (x: number, z: number, alpha: number): number => {
    positions.push(
      Math.max(room.min.x, Math.min(room.max.x, x)),
      SHADOW.lift,
      Math.max(room.min.z, Math.min(room.max.z, z)),
    );
    colors.push(cr, cg, cb, alpha);
    return positions.length / 3 - 1;
  };
  for (const p of layout.patches) {
    const hx = p.size.x / 2,
      hz = p.size.z / 2,
      round = Math.min(p.round, hx, hz),
      n = SHADOW.cornerSegments;
    /** A rounded-rectangle contour grown outward by `grow`, counter-clockwise from +x+z. */
    const contour = (grow: number): [number, number][] => {
      const points: [number, number][] = [],
        corners: [number, number, number][] = [
          [hx - round, hz - round, 0],
          [-(hx - round), hz - round, Math.PI / 2],
          [-(hx - round), -(hz - round), Math.PI],
          [hx - round, -(hz - round), (3 * Math.PI) / 2],
        ];
      for (const [cx, cz, start] of corners)
        for (let k = 0; k <= n; k++) {
          const a = start + (k / n) * (Math.PI / 2);
          points.push([
            p.center.x + cx + Math.cos(a) * (round + grow),
            p.center.z + cz + Math.sin(a) * (round + grow),
          ]);
        }
      return points;
    };
    // Centre fan over the footprint, then rings fading out over the spread.
    const centre = vertex(p.center.x, p.center.z, p.strength);
    let previous = contour(0).map(([x, z]) => vertex(x, z, p.strength));
    for (let i = 0; i < previous.length; i++)
      indices.push(centre, previous[(i + 1) % previous.length], previous[i]);
    for (const [at, level] of SHADOW.falloff.slice(1)) {
      const ring = contour(at * p.spread).map(([x, z]) =>
        vertex(x, z, p.strength * level),
      );
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        indices.push(
          previous[i],
          previous[j],
          ring[j],
          previous[i],
          ring[j],
          ring[i],
        );
      }
      previous = ring;
    }
  }
  for (const w of layout.walls) {
    let previous: [number, number] | undefined;
    for (const [at, level] of SHADOW.falloff) {
      const ox = w.inward.x * at * w.width,
        oz = w.inward.z * at * w.width,
        a = vertex(w.from.x + ox, w.from.z + oz, w.strength * level),
        b = vertex(w.to.x + ox, w.to.z + oz, w.strength * level);
      if (previous) {
        const [pa, pb] = previous;
        indices.push(pa, pb, b, pa, b, a);
      }
      previous = [a, b];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** The material that lays the merged shadows over the floor. */
export function contactShadowMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  material.name = 'Office contact shadows';
  return material;
}
