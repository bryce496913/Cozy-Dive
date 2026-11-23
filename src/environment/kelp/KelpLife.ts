import { CREATURE_LOOKS } from '../../config/creatureLooks';
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
  rayTint: CREATURE_LOOKS.batRayTint,
} as const;

/** The boulders the garibaldi gather around: spread through the forest, nearest the exit first. */
export function garibaldiHomes(boulders: readonly Boulder[]): Boulder[] {
  const sorted = [...boulders].sort((a, b) => b.z - a.z),
    homes: Boulder[] = [];
  for (const b of sorted) {
    if (homes.length >= KELP_LIFE.groups) break;
    if (b.size < 2.4) continue;
    if (homes.some((h) => Math.hypot(h.x - b.x, h.z - b.z) < 9)) continue;
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

/**
 * v0.6 Pass 035: kelp bass, hanging in loose groups in mid-water among the kelp (the chromis rig
 * in olive brown, a little larger than the garibaldi), drifting slowly together.
 */
export const KELP_BASS = [
  { x: -12, y: 7.5, z: -26, count: 9 },
  { x: 13, y: 9, z: -42, count: 8 },
  { x: -6, y: 6.5, z: -50, count: 7 },
] as const;
export function kelpBassSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!,
    k = 2.5,
    olive = 0x7a6a45;
  return KELP_BASS.map((b) => ({
    ...chromis,
    id: 'kelp-bass',
    name: 'Kelp bass',
    count: b.count,
    length: chromis.length * k,
    height: chromis.height * k * 0.9,
    width: chromis.width * k,
    color: olive,
    backColor: olive,
    finColor: olive,
    accentColor: olive,
    schooling: {
      ...chromis.schooling,
      enabled: true,
      spacing: chromis.schooling.spacing * 2.2,
      separationRange: chromis.schooling.separationRange * 2.2,
    },
    speed: chromis.speed * 0.9,
    region: { x: b.x, y: b.y, z: b.z },
    spread: { x: 5, y: 2.2, z: 5 },
    depth: [b.y - 2.5, b.y + 2.5],
    individualScale: undefined,
  }));
}

/**
 * v0.6 Pass 041: more fish among the kelp. Blacksmith (dark blue-grey damselfish) school in
 * mid-water by the score; señoritas (slender yellow wrasse) weave in loose little groups lower
 * down between the stalks. Both on the chromis rig, recoloured.
 */
export const KELP_SCHOOLS = [
  { id: 'blacksmith', x: 4, y: 10, z: -22, count: 30, size: 1.4, spread: 4.5 },
  {
    id: 'blacksmith',
    x: -12,
    y: 12,
    z: -40,
    count: 26,
    size: 1.4,
    spread: 4.5,
  },
  { id: 'blacksmith', x: 12, y: 13, z: -50, count: 22, size: 1.4, spread: 4 },
  { id: 'senorita', x: -6, y: 3.5, z: -18, count: 8, size: 1.1, spread: 3 },
  { id: 'senorita', x: 15, y: 4, z: -34, count: 8, size: 1.1, spread: 3 },
  { id: 'senorita', x: -15, y: 3.5, z: -48, count: 7, size: 1.1, spread: 3 },
] as const;
export function kelpSchoolSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!;
  return KELP_SCHOOLS.map((g) => {
    const colour = g.id === 'blacksmith' ? 0x3f4d5e : 0xe0b23a,
      slender = g.id === 'senorita';
    return {
      ...chromis,
      id: g.id,
      name: g.id === 'blacksmith' ? 'Blacksmith' : 'Señorita',
      count: g.count,
      length: chromis.length * g.size * (slender ? 1.15 : 1),
      height: chromis.height * g.size * (slender ? 0.6 : 1),
      width: chromis.width * g.size * (slender ? 0.7 : 1),
      color: colour,
      backColor: colour,
      finColor: colour,
      accentColor: colour,
      schooling: {
        ...chromis.schooling,
        enabled: !slender,
        spacing: chromis.schooling.spacing * (slender ? 1 : 1.4),
      },
      speed: chromis.speed * (slender ? 1.3 : 1),
      region: { x: g.x, y: g.y, z: g.z },
      spread: { x: g.spread, y: slender ? 1 : 2, z: g.spread },
      depth: [g.y - (slender ? 1.5 : 3), g.y + (slender ? 1.5 : 3)],
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
  // v0.6 Pass 041: inside the forest's walls (and below its surface).
  const w = KELP.walls;
  return {
    bounds: {
      min: { x: -w.x + 0.8, y: KELP.bounds.min.y, z: w.farZ + 0.8 },
      max: { x: w.x - 0.8, y: KELP.surfaceY - 1, z: KELP.tunnel.wallZ },
      clearance: KELP.bounds.clearance,
    },
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
  // v0.6 Pass 044: leopard sharks, low over the sand along the lane, below the rays.
  {
    species: 'leopard-shark',
    scale: 1.35,
    waypoints: laneLoop(-14, -50, -3, 0.6),
    members: [
      { start: 0, side: 0, up: 0, phase: 0.6 },
      { start: -9, side: 0.6, up: 0.15, phase: 2.4 },
    ],
  },
  {
    species: 'leopard-shark',
    scale: 1.5,
    waypoints: laneLoop(-22, -56, 1.8, 0.65),
    members: [{ start: 25, side: 0, up: 0, phase: 4.1 }],
  },
  {
    species: 'bat-ray',
    waypoints: laneLoop(-16, -52, 2.2, 1.4),
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
    waypoints: laneLoop(-24, -55, 2.6, 2.2),
    members: [{ start: 40, side: 0, up: 0, phase: 4.4 }],
    tint: KELP_LIFE.rayTint,
  },
];
