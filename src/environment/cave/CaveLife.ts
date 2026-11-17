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
  /**
   * v0.6 Pass 041: small loose groups of soldierfish hanging in the shade beside the big rocks,
   * and rock crabs picking their way round the rocks' feet (how many, and how much bigger than a
   * chromis the soldierfish are).
   */
  soldiers: [
    { x: -11, y: 2, z: -24.5, count: 9 },
    { x: 11, y: 1.8, z: -30, count: 8 },
    { x: -7.5, y: 1.8, z: -31, count: 7 },
    { x: 10, y: 1.6, z: -16, count: 6 },
  ],
  soldierSize: 1.35,
  crabs: 18,
  /** v0.6 Pass 045: flashlight fish in the darkest corner, at the back on the left. */
  flashlight: { x: -10.5, y: 3, z: -31.5, count: 18 },
  /** Whitetips resting on the sand (heading, radians: 0 faces +x). */
  resting: [
    { x: 1.2, z: -21.2, yaw: 0.6 },
    { x: 8.5, z: -28.5, yaw: 2.5 },
    { x: -1.8, z: -33, yaw: -0.8 },
  ],
  /** v0.6 Pass 041: open sand where a startled whitetip may settle again. */
  settle: [
    { x: 1.2, z: -21.2, yaw: 0.6 },
    { x: 8.5, z: -28.5, yaw: 2.5 },
    { x: -1.8, z: -33, yaw: -0.8 },
    { x: -9, z: -21, yaw: 1.4 },
    { x: 7, z: -19.5, yaw: -2.2 },
    { x: 1.5, z: -28, yaw: 3.0 },
    { x: -10, z: -30.5, yaw: -1.6 },
    { x: 11, z: -22.5, yaw: 0.2 },
  ],
} as const;

/** Sweeper species entries, one per school (pure). */
export function caveSpecies(): FishSpecies[] {
  const chromis = FISH_SPECIES.find((f) => f.id === 'blue-green-chromis')!,
    k = CAVE_LIFE.sweeperSize,
    copper = 0xc98a4e;
  return [
    ...sweeperSpecies(chromis, k, copper),
    ...soldierSpecies(chromis),
    flashlightSpecies(chromis),
  ];
}
/** v0.6 Pass 045: small, dark flashlight fish milling in a loose group in the gloom. */
function flashlightSpecies(chromis: FishSpecies): FishSpecies {
  const f = CAVE_LIFE.flashlight,
    dark = 0x1d2126,
    k = 0.8;
  return {
    ...chromis,
    id: 'flashlight-fish',
    name: 'Flashlight fish',
    count: f.count,
    length: chromis.length * k,
    height: chromis.height * k,
    width: chromis.width * k,
    color: dark,
    backColor: dark,
    finColor: dark,
    accentColor: dark,
    schooling: {
      ...chromis.schooling,
      enabled: true,
      spacing: chromis.schooling.spacing * 1.2,
    },
    speed: chromis.speed * 0.7,
    region: { x: f.x, y: f.y, z: f.z },
    spread: { x: 1.6, y: 0.8, z: 1.4 },
    depth: [f.y - 1, f.y + 1.2],
    individualScale: undefined,
  };
}
/** v0.6 Pass 041: soldierfish, red and deep-bodied, loosely grouped and slow, near the rocks. */
function soldierSpecies(chromis: FishSpecies): FishSpecies[] {
  const k = CAVE_LIFE.soldierSize,
    red = 0xc23a22;
  return CAVE_LIFE.soldiers.map((s) => ({
    ...chromis,
    id: 'soldierfish',
    name: 'Soldierfish',
    count: s.count,
    length: chromis.length * k,
    height: chromis.height * k * 1.1,
    width: chromis.width * k,
    color: red,
    backColor: red,
    finColor: red,
    accentColor: red,
    schooling: {
      ...chromis.schooling,
      enabled: true,
      spacing: chromis.schooling.spacing * 1.6,
      cohesionWeight: chromis.schooling.cohesionWeight * 0.7,
    },
    speed: chromis.speed * 0.45,
    region: { x: s.x, y: s.y, z: s.z },
    spread: { x: 1.8, y: 0.7, z: 1.8 },
    depth: [s.y - 0.9, s.y + 1.1],
    individualScale: undefined,
  }));
}
function sweeperSpecies(
  chromis: FishSpecies,
  k: number,
  copper: number,
): FishSpecies[] {
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
