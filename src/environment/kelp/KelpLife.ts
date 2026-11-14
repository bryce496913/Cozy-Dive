import { KELP } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { CruiseGroup } from '../outer/OuterCreatures';
import type { Obstacles } from '../../creatures/cruising';
import type { FishHabitat, HabitatInterest } from '../../fish/FishHabitat';
import { FISH_SPECIES, type FishSpecies } from '../../fish/FishSpecies';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import type { Boulder } from './KelpEnvironment';
import { kelpFloor, laneCentre } from './KelpTerrain';

/**
 * v0.6 Pass 032: the kelp forest's life. Garibaldi (the chromis rig in solid orange, about twice
 * its size) keep near the boulders in small loose groups, each fish minding its own patch; bat
 * rays (the eagle ray's model, tinted dark) glide in a loose line along the sandy lane. Pure.
 */
export const KELP_LIFE = {
  /** Garibaldi: how many groups, and fish per group. */
  groups: 5,
  perGroup: 4,
  /** How much bigger than a chromis (body length). */
  size: 2.1,
  orange: 0xff6a12,
  /** The bat rays' dark back (multiplied into the eagle ray's colours). */
  rayTint: 0x5b5a54,
} as const;

/** The boulders the garibaldi gather around: spread through the forest, nearest the exit first. */
export function garibaldiHomes(boulders: readonly Boulder[]): Boulder[] {
  const sorted = [...boulders].sort((a, b) => b.z - a.z),
    homes: Boulder[] = [];
  for (const b of sorted) {
    if (homes.length >= KELP_LIFE.groups) break;
    if (b.size < 2.4) continue;
    if (homes.some((h) => Math.hypot(h.x - b.x, h.z - b.z) < 12)) continue;
    homes.push(b);
  }
  return homes;
}
/** Garibaldi species entries, one per home boulder (pure). */
export function kelpSpecies(boulders: readonly Boulder[]): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!,
    k = KELP_LIFE.size;
  return garibaldiHomes(boulders).map((b) => {
    const top = b.y + b.height * 0.75;
    return {
      ...chromis,
      id: 'garibaldi',
      name: 'Garibaldi',
      count: KELP_LIFE.perGroup,
      length: chromis.length * k,
      height: chromis.height * k,
      width: chromis.width * k,
      color: KELP_LIFE.orange,
      backColor: KELP_LIFE.orange,
      finColor: KELP_LIFE.orange,
      accentColor: KELP_LIFE.orange,
      // Garibaldi keep their own patch: no schooling, slow and bold.
      schooling: { ...chromis.schooling, enabled: false },
      speed: chromis.speed * 0.8,
      region: { x: b.x, y: top + 1, z: b.z },
      spread: { x: b.size + 1.5, y: 1.2, z: b.size + 1.5 },
      depth: [top - 0.4, top + 2.8],
      individualScale: undefined,
    };
  });
}

/** Coarse boxes the garibaldi steer around: each boulder, and the wall behind the forest. */
export function kelpFishRocks(boulders: readonly Boulder[]): ConvexCollider[] {
  const b = KELP.bounds;
  return [
    ...boulders.map((r) =>
      boxCollider(
        [r.x - r.size * 0.45, r.y - 1, r.z - r.size * 0.45],
        [r.x + r.size * 0.45, r.y + r.height * 0.75, r.z + r.size * 0.45],
      ),
    ),
    boxCollider(
      [b.min.x - 1, b.min.y - 1, KELP.tunnel.wallZ - 1],
      [b.max.x + 1, b.max.y + 1, b.max.z + 1],
    ),
  ];
}
/** The garibaldi's habitat: the forest's bounds, boulders and seabed. */
export function kelpHabitat(boulders: readonly Boulder[]): FishHabitat {
  const up: Vec3 = { x: 0, y: 1, z: 0 },
    interests: HabitatInterest[] = [];
  for (const r of boulders)
    interests.push(
      {
        kind: 'reef-face',
        position: { x: r.x, y: r.y + r.height * 0.6, z: r.z },
        normal: up,
      },
      {
        kind: 'sheltered-crevice',
        position: { x: r.x + r.size * 0.5, y: r.y + 0.4, z: r.z },
        normal: up,
      },
    );
  return {
    bounds: KELP.bounds,
    rocks: kelpFishRocks(boulders),
    interests,
    substrateHeight: kelpFloor,
    floorHeight: kelpFloor,
  };
}

/** The highest thing near each point (seabed and boulders), on a 1 m grid built once. */
export function kelpObstacles(boulders: readonly Boulder[]): Obstacles {
  const b = KELP.bounds,
    nx = Math.ceil(b.max.x - b.min.x) + 1,
    nz = Math.ceil(b.max.z - b.min.z) + 1,
    tops = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++)
      tops[k * nx + i] = kelpFloor(b.min.x + i, b.min.z + k);
  for (const r of boulders) {
    const reach = r.size * 0.55,
      top = r.y + r.height * 0.85;
    for (
      let k = Math.max(0, Math.floor(r.z - reach - b.min.z));
      k <= Math.min(nz - 1, Math.ceil(r.z + reach - b.min.z));
      k++
    )
      for (
        let i = Math.max(0, Math.floor(r.x - reach - b.min.x));
        i <= Math.min(nx - 1, Math.ceil(r.x + reach - b.min.x));
        i++
      )
        if (tops[k * nx + i] < top) tops[k * nx + i] = top;
  }
  return (x, z, radius) => {
    let top = -Infinity;
    const i0 = Math.max(0, Math.floor(x - radius - b.min.x)),
      i1 = Math.min(nx - 1, Math.ceil(x + radius - b.min.x)),
      k0 = Math.max(0, Math.floor(z - radius - b.min.z)),
      k1 = Math.min(nz - 1, Math.ceil(z + radius - b.min.z));
    for (let k = k0; k <= k1; k++)
      for (let i = i0; i <= i1; i++) top = Math.max(top, tops[k * nx + i]);
    return Number.isFinite(top) ? top : kelpFloor(x, z);
  };
}

/** A long loop down the sandy lane and back up its other side, low over the sand. */
function laneLoop(
  z0: number,
  z1: number,
  side: number,
  y: number,
  n = 14,
): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2,
      z = (z0 + z1) / 2 + ((z0 - z1) / 2) * Math.cos(a),
      x = laneCentre(z) + side * Math.sin(a);
    return { x, y, z };
  });
}
/** Bat rays: a loose line of three along the lane, and one alone, further down the forest. */
export const KELP_CRUISERS: readonly CruiseGroup[] = [
  {
    species: 'bat-ray',
    waypoints: laneLoop(-16, -74, 2.2, 1.4),
    members: [
      { start: 0, side: 0, up: 0, phase: 0 },
      { start: -6, side: 0.8, up: 0.5, phase: 1.9 },
      { start: -12, side: -0.6, up: 0.9, phase: 3.6 },
    ],
    tint: KELP_LIFE.rayTint,
  },
  {
    species: 'bat-ray',
    scale: 1.1,
    waypoints: laneLoop(-30, -80, 2.8, 2.2),
    members: [{ start: 40, side: 0, up: 0, phase: 4.4 }],
    tint: KELP_LIFE.rayTint,
  },
];
