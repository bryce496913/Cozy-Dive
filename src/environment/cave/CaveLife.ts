import { CAVE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { Obstacles } from '../../creatures/cruising';
import type { FishHabitat, HabitatInterest } from '../../fish/FishHabitat';
import { FISH_SPECIES, type FishSpecies } from '../../fish/FishSpecies';
import type { ConvexCollider } from '../../player/collision';
import type { CruiseGroup } from '../outer/OuterCreatures';
import { boxCollider } from '../passage/Crevice';
import { CAVE_ROCKS } from './CaveEnvironment';
import { caveFloor } from './CaveTerrain';

/**
 * v0.6 Pass 034: the sea cave's life. Glassy sweepers (the chromis rig in copper, schooling
 * tightly) hang in the shade near the back; whitetip reef sharks rest on the sand around the pool
 * of light, and one circles slowly; spiny lobsters peer from cracks at the foot of the rocks.
 * Pure layout and tuning.
 */
export const CAVE_LIFE = {
  /** Two schools of sweepers, in the shade at the back left and front right. */
  sweepers: [
    { x: -7.5, y: 3.2, z: -33, count: 26 },
    { x: 9, y: 2.8, z: -20.5, count: 16 },
  ],
  /** How much smaller than a chromis (body length). */
  sweeperSize: 0.75,
  /** Whitetips resting on the sand (heading, radians: 0 faces +x). */
  resting: [
    { x: 1.2, z: -21.2, yaw: 0.6 },
    { x: 8.5, z: -28.5, yaw: 2.5 },
    { x: -1.8, z: -33, yaw: -0.8 },
  ],
} as const;

/** Sweeper species entries, one per school (pure). */
export function caveSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!,
    k = CAVE_LIFE.sweeperSize,
    copper = 0xc98a4e;
  return CAVE_LIFE.sweepers.map((s) => ({
    ...chromis,
    id: 'glassy-sweeper',
    name: 'Glassy sweeper',
    count: s.count,
    length: chromis.length * k,
    height: chromis.height * k * 1.15,
    width: chromis.width * k,
    color: copper,
    backColor: copper,
    finColor: copper,
    accentColor: copper,
    // Sweepers school tightly and drift slowly in the shade.
    schooling: {
      ...chromis.schooling,
      enabled: true,
      spacing: chromis.schooling.spacing * 0.8,
      cohesionWeight: chromis.schooling.cohesionWeight * 1.4,
    },
    speed: chromis.speed * 0.6,
    region: { x: s.x, y: s.y, z: s.z },
    spread: { x: 2.6, y: 1.1, z: 2.6 },
    depth: [s.y - 1.3, s.y + 1.4],
    individualScale: undefined,
  }));
}

/** Coarse boxes the fish steer around: each boulder, and the tunnel's rock. */
export function caveFishRocks(): ConvexCollider[] {
  const t = CAVE.tunnel;
  return [
    ...CAVE_ROCKS.map((r) => {
      const y = caveFloor(r.x, r.z);
      return boxCollider(
        [r.x - r.size * 0.45, y - 1, r.z - r.size * 0.45],
        [r.x + r.size * 0.45, y + r.height * 0.8, r.z + r.size * 0.45],
      );
    }),
    boxCollider(
      [-t.radius - 1, t.y - t.radius - 1, t.openZ - 0.5],
      [t.radius + 1, t.y + t.radius + 1, t.startZ + 1],
    ),
  ];
}
/** The sweepers' habitat: inside the cavern, over its sand, around its rocks. */
export function caveHabitat(): FishHabitat {
  const up: Vec3 = { x: 0, y: 1, z: 0 },
    c = CAVE.chamber,
    interests: HabitatInterest[] = CAVE_ROCKS.map((r) => ({
      kind: 'sheltered-crevice',
      position: { x: r.x, y: caveFloor(r.x, r.z) + r.height * 0.7, z: r.z },
      normal: up,
    }));
  return {
    // The box inside the dome where the fish may go.
    bounds: {
      min: { x: c.x - c.rx * 0.7, y: 0.4, z: c.z - c.rz * 0.7 },
      max: { x: c.x + c.rx * 0.7, y: c.y + c.ry * 0.45, z: c.z + c.rz * 0.6 },
      clearance: 0.3,
    },
    rocks: caveFishRocks(),
    interests,
    substrateHeight: caveFloor,
    floorHeight: caveFloor,
  };
}

/** The highest thing near each point (sand and boulders), for the circling whitetip's route. */
export const caveObstacles: Obstacles = (x, z, radius) => {
  let top = caveFloor(x, z);
  for (const r of CAVE_ROCKS)
    if (Math.hypot(r.x - x, r.z - z) < r.size * 0.55 + radius)
      top = Math.max(top, caveFloor(r.x, r.z) + r.height * 0.85);
  return top;
};

/** One whitetip circling slowly, low over the sand, round the pool of light. */
export const CAVE_CRUISERS: readonly CruiseGroup[] = [
  {
    species: 'whitetip-reef-shark',
    waypoints: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return {
        x: CAVE.skylight.x - 1 + Math.cos(a) * 8,
        y: 1.6 + 0.4 * Math.sin(a * 2),
        z: CAVE.skylight.z - Math.sin(a) * 7,
      };
    }),
    members: [{ start: 0, side: 0, up: 0, phase: 0 }],
  },
];
