import type { Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';
import type { PlantSpeciesId } from './PlantSpecies';
import { insideAny } from './ReefBenchmark';

const HABITAT_PLANT_MOTION = {
  Grass: { sway: 0.08, frequency: 0.62 },
  GrassShort: { sway: 0.07, frequency: 0.7 },
  Caulerpa: { sway: 0.04, frequency: 0.55 },
  Halimeda: { sway: 0.035, frequency: 0.5 },
  RedAlga: { sway: 0.06, frequency: 0.8 },
} as const;
export type HabitatPlant = keyof typeof HABITAT_PLANT_MOTION;

/**
 * V0.8 Pass 083: the personal aquarium's habitat overhaul. The approved Pass 082 method, applied to
 * every other reef rock: the accepted 28 separate boulders become seven composed formations (two
 * massifs, two terraces, a channel terrace and two satellite outcrops) with composed colonies and
 * clustered, organically curved vegetation, all authored in aquarium space in `reef-habitat.glb`
 * (tools/art/pass083). The accepted rocks, corals and plants stay in the layout and the reef
 * library, so `?reef=original` (or a load failure) restores the accepted tank exactly, and
 * `?reef=benchmark` shows the Pass 082 section alone.
 */
export const REEF_HABITAT = {
  /** Accepted reef rocks the formations replace (their layout names). */
  rocks: [
    'Rock 1',
    'Rock 2',
    'Rock 3',
    'Rock 4',
    'Rock 5',
    'Rock 6',
    'Rock 8',
    'Rock 9',
    'Rock 10',
    'Rock 12',
    'Rock 14',
    'Rock 15',
    'Rock 16',
    'Rock 18',
    'Rock 20',
    'Rock 21',
    'Rock 22',
    'Rock 23',
    'Rock 24',
    'Rock 25',
    'Rock 26',
    'Rock 27',
    'Rock 28',
    'Rock 29',
    'Rock 30',
    'Rock 32',
    'Rock 33',
    'Rock 34',
  ],
  /** Accepted hardscape colonies on those rocks that composed hero colonies replace. */
  corals: [
    { x: -14.9531, y: 1.8304, z: -7.6018 },
    { x: 14.3712, y: 1.5612, z: -0.1204 },
    { x: 10.8945, y: 2.9542, z: -9.4807 },
    { x: 7.9389, y: 2.0718, z: -4.5262 },
  ] as readonly Vec3[],
  /** Formation meshes switch to their middle and far levels beyond these distances (metres). */
  lodDistances: [0, 14, 30] as const,
  /** Plants, rubble and fish interests closer than this inside the new rock are withheld. */
  clearance: 0.05,
  /**
   * Accepted pebbles and loose shells or rubble further than this from any reef rock are withheld:
   * the open sand reads as sand, and the small scatter gathers where reef meets sand.
   */
  scatterReach: 1.3,
  /** The organic templates and their current-driven sway (the shared plant contract). */
  plantMotion: HABITAT_PLANT_MOTION,
  /** Accepted plant species redrawn with the organic templates (placements and interests stay). */
  speciesTemplates: {
    'turtle-grass': 'Grass',
    caulerpa: 'Caulerpa',
    halimeda: 'Halimeda',
    'red-macroalgae': 'RedAlga',
  } as Readonly<Partial<Record<PlantSpeciesId, HabitatPlant>>>,
} as const;

/** Which composed reef the URL asks for: both passes (default), the Pass 082 section, or none. */
export type ReefPresentation = 'habitat' | 'benchmark' | 'original';
export function reefPresentation(search: string): ReefPresentation {
  const value = new URLSearchParams(search).get('reef');
  return value === 'original' || value === 'benchmark' ? value : 'habitat';
}

export function isHabitatRock(name: string): boolean {
  return (REEF_HABITAT.rocks as readonly string[]).includes(name);
}

export function isHabitatCoral(position: Readonly<Vec3>): boolean {
  return REEF_HABITAT.corals.some(
    (c) =>
      Math.hypot(c.x - position.x, c.y - position.y, c.z - position.z) < 0.3,
  );
}

/**
 * Whether a loose pebble, shell or rubble fragment at `p` lies out on open sand, away from every
 * reef rock in `solids` (it is then withheld while the habitat shows).
 */
export function strayScatter(
  p: Readonly<Vec3>,
  solids: readonly ConvexCollider[],
  reach = REEF_HABITAT.scatterReach,
): boolean {
  return !insideAny(p, solids, reach);
}
