import { CAVE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { CAVE_LIFE } from './CaveLife';
import { CAVE_ROCKS, type CaveRock } from './CaveEnvironment';
import { caveFloor, wallDistance, wallPoint } from './CaveTerrain';

/**
 * v0.6 Pass 045: where the sea cave's newer life lives (pure layout):
 *   - the moray's crack low in the right-hand wall;
 *   - a rock ledge against the back wall with the nurse shark asleep under it;
 *   - the sleeping turtle's bed on the sand by a boulder near the front;
 *   - the cleaner shrimps' patch on the left-hand wall;
 *   - the octopus's den at the foot of a boulder on the left;
 *   - two lionfish on boulder tops.
 * Everything is kept clear of the resting sharks' places and the pool of light.
 */
const c = CAVE.chamber;
/** A point `k` of the way from the chamber's middle to its wall, in direction `a` (radians), low. */
function onWall(a: number, uy: number, k: number): Vec3 {
  const p = wallPoint(Math.sin(a), uy, Math.cos(a), { x: 0, y: 0, z: 0 });
  const x = c.x + (p.x - c.x) * k,
    z = c.z + (p.z - c.z) * k;
  return { x, y: p.y, z };
}
const inward = (p: Readonly<Vec3>) => {
  const dx = c.x - p.x,
    dz = c.z - p.z,
    l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, y: 0, z: dz / l };
};
/** Step a point in towards the chamber's middle until it is just clear of the rock wall. */
function offWall<T extends Vec3>(p: T, clear = 0.12): T {
  const d = inward(p);
  for (let i = 0; i < 80 && wallDistance(p) < clear; i++) {
    p.x += d.x * 0.05;
    p.z += d.z * 0.05;
  }
  return p;
}
const rock = (x: number, z: number): CaveRock =>
  CAVE_ROCKS.reduce((best, r) =>
    Math.hypot(r.x - x, r.z - z) < Math.hypot(best.x - x, best.z - z)
      ? r
      : best,
  );

export interface CaveNooks {
  readonly moray: { readonly mouth: Vec3; readonly axis: Vec3 };
  readonly ledge: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    /** Heading along the wall (radians about y; 0 faces +x). */
    readonly yaw: number;
    readonly length: number;
    readonly depth: number;
  };
  readonly nurse: { readonly at: Vec3; readonly yaw: number };
  readonly turtle: {
    readonly bed: Vec3;
    readonly yaw: number;
    readonly air: Vec3;
  };
  readonly station: {
    readonly patch: Vec3;
    readonly out: Vec3;
    readonly home: Vec3;
  };
  readonly octopus: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
  };
  readonly octopusRocks: readonly Vec3[];
  readonly lionfish: readonly { readonly at: Vec3; readonly yaw: number }[];
}

export function caveNooks(skylightTop: number): CaveNooks {
  // The moray: low in the right-hand wall, looking into the cave.
  const m = onWall(1.7, -0.22, 0.985),
    mouth = offWall({ x: m.x, y: Math.max(m.y, caveFloor(m.x, m.z) + 0.55), z: m.z }, 0.05);
  // The ledge: against the back wall, right of middle, clear of the boulders there.
  const l = onWall(Math.PI - 0.62, -0.3, 0.9),
    lin = inward(l),
    // Along the wall: the tangent (-in.z, in.x), as a heading (0 faces +x, positive towards -z).
    along = Math.atan2(-lin.x, -lin.z),
    floor = caveFloor(l.x, l.z);
  // The turtle: on the sand beside the boulder at the front right.
  const tr = rock(12, -14.5),
    bed = {
      x: tr.x - 2.2,
      y: caveFloor(tr.x - 2.2, tr.z - 1.6) + 0.25,
      z: tr.z - 1.6,
    };
  // The cleaner shrimps: mid-height on the left-hand wall, the soldierfish waiting nearby.
  const st = onWall(-1.6, -0.05, 0.975),
    out = inward(st),
    patch = offWall({ x: st.x, y: caveFloor(st.x, st.z) + 2.2, z: st.z }, 0.08);
  // The octopus: at the foot of the boulder at the left, on its side away from the middle.
  const or = rock(-14, -26),
    oa = Math.atan2(c.x - or.x, c.z - or.z) + 1.4,
    ox = or.x + Math.sin(oa) * (or.size * 0.52),
    oz = or.z + Math.cos(oa) * (or.size * 0.52);
  const lion = [rock(6.5, -33.5), rock(-4.5, -27)].map((r, i) => ({
    at: { x: r.x, y: caveFloor(r.x, r.z) + r.height * 0.82, z: r.z },
    yaw: i * 2.2 + 0.8,
  }));
  return {
    moray: { mouth, axis: inward(mouth) },
    ledge: {
      x: l.x,
      y: floor + 1.05,
      z: l.z,
      yaw: along,
      length: 3.4,
      depth: 1.8,
    },
    nurse: { at: { x: l.x, y: floor + 0.28, z: l.z }, yaw: along },
    turtle: {
      bed,
      yaw: 2.2,
      air: { x: CAVE.skylight.x, y: skylightTop - 1.2, z: CAVE.skylight.z },
    },
    station: {
      patch,
      out,
      home: {
        x: patch.x + out.x * 3,
        y: patch.y - 0.3,
        z: patch.z + out.z * 3,
      },
    },
    octopus: { x: ox, y: caveFloor(ox, oz), z: oz, yaw: oa },
    octopusRocks: CAVE_ROCKS.filter(
      (r) => r !== or && Math.hypot(r.x - or.x, r.z - or.z) < 9,
    ).map((r) => ({
      x: r.x,
      y: 0,
      z: r.z,
    })),
    lionfish: lion,
  };
}
/** The ledge's colliders: its slab, and the pillar of rock holding up its open end. */
export function ledgeColliders(n: CaveNooks): ConvexCollider[] {
  const L = n.ledge,
    ax = Math.cos(L.yaw),
    az = -Math.sin(L.yaw),
    half = L.length / 2,
    reach = Math.max(Math.abs(ax) * half, Math.abs(az) * half) + L.depth * 0.5;
  return [
    boxCollider(
      [L.x - reach, L.y - 0.15, L.z - reach],
      [L.x + reach, L.y + 0.35, L.z + reach],
    ),
  ];
}
/** The places this pass keeps clear (the resting sharks' places and the pool of light). */
export function nooksClear(n: CaveNooks): boolean {
  const spots = [
    n.turtle.bed,
    n.nurse.at,
    { x: n.octopus.x, y: 0, z: n.octopus.z },
  ];
  for (const s of spots) {
    for (const r of CAVE_LIFE.settle)
      if (Math.hypot(r.x - s.x, r.z - s.z) < 2.5) return false;
    if (
      Math.hypot(s.x - CAVE.skylight.x, s.z - CAVE.skylight.z) <
      CAVE.skylight.radius + 1
    )
      return false;
  }
  return true;
}
