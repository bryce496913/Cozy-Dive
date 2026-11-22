import type { Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';

/**
 * V0.8 Pass 082: the reference-driven reef benchmark section, the left bank of the central
 * channel. A composed ridge replaces the accepted rocks 7, 11, 13, 19 and 31, a bommie replaces
 * rock 17, and new colonies replace the two hardscape corals that grew on them. Everything is
 * authored in aquarium space in `reef-benchmark.glb` (tools/art/pass082). The accepted rocks and
 * corals stay in the layout and the asset, untouched, so `?reef=original` (or a load failure)
 * restores them exactly.
 */
export const REEF_BENCHMARK = {
  /** Accepted reef rocks the section replaces (their layout names). */
  rocks: ['Rock 7', 'Rock 11', 'Rock 13', 'Rock 19', 'Rock 31', 'Rock 17'],
  /** Accepted hardscape colonies the section replaces (their positions, aquarium metres). */
  corals: [
    { x: -5.5759, y: 2.0985, z: -0.0842 },
    { x: -5.6246, y: 1.2735, z: -5.42 },
  ] as readonly Vec3[],
  /** Rock, coral and soft-coral meshes switch to their distance level beyond this. */
  lodDistance: 14,
  /** Plants, rubble and fish interests closer than this inside the new rock are withheld. */
  clearance: 0.05,
  /** Turtle grass, Halimeda and red algae: the existing current-driven sway, per template. */
  plantMotion: {
    Grass: { sway: 0.075, frequency: 0.65 },
    Halimeda: { sway: 0.035, frequency: 0.5 },
    RedAlga: { sway: 0.06, frequency: 0.8 },
  },
} as const;

export type BenchmarkPlant = keyof typeof REEF_BENCHMARK.plantMotion;

/** True when the URL asks for the accepted section instead of the benchmark (rollback). */
export function benchmarkRequested(search: string): boolean {
  return new URLSearchParams(search).get('reef') !== 'original';
}

export function isBenchmarkRock(name: string): boolean {
  return (REEF_BENCHMARK.rocks as readonly string[]).includes(name);
}

export function isBenchmarkCoral(position: Readonly<Vec3>): boolean {
  return REEF_BENCHMARK.corals.some(
    (c) =>
      Math.hypot(c.x - position.x, c.y - position.y, c.z - position.z) < 0.3,
  );
}

/** Whether `p` lies inside any of `solids`, grown by `margin`. */
export function insideAny(
  p: Readonly<Vec3>,
  solids: readonly ConvexCollider[],
  margin: number,
): boolean {
  return solids.some(
    (s) =>
      p.x > s.min.x - margin &&
      p.x < s.max.x + margin &&
      p.y > s.min.y - margin &&
      p.y < s.max.y + margin &&
      p.z > s.min.z - margin &&
      p.z < s.max.z + margin &&
      s.planes.every(
        (n) => n.x * p.x + n.y * p.y + n.z * p.z <= n.offset + margin,
      ),
  );
}
