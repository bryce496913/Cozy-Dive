import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { AuthoredSchool } from '../../benchmark/AuthoredSchool';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { FishHabitat, HabitatInterest } from '../../fish/FishHabitat';
import {
  FISH_SPECIES,
  type FishSpecies,
  type SpeciesId,
} from '../../fish/FishSpecies';
import { FishSystem } from '../../fish/FishSystem';
import type { ReefLayout } from './OuterReefLayout';

/**
 * v0.4 Pass 024/026: reef fish in the outer waters. Big schools of the tank's own species over
 * the reef top and wall (235 fish, including smaller entrance and wall shoals), swim with the same simulation and authored rigs
 * as in the tank (leased from the tank's fish libraries, so each decodes once). If the rigs
 * cannot load, the simulation's simple fish are shown instead.
 */
const LIBRARY: Readonly<Partial<Record<SpeciesId, AssetId>>> = {
  'blue-green-chromis': 'chromis',
  'pajama-cardinalfish': 'cardinalfish',
  'firefish-goby': 'firefish',
  'yellow-assessor': 'assessor',
  'royal-gramma': 'gramma',
};
/** Outer schools switch to their light rigs at this many body lengths. */
export const OUTER_FISH_DETAIL = 8;
/**
 * Pass 026: where each school gathers over the reef top (x, z), how high above the reef's own
 * tops there, and how many. The big chromis schools cloud over the reef in open water; the
 * smaller species stay low over the coral.
 */
export const OUTER_SCHOOLS: readonly {
  readonly species: SpeciesId;
  readonly at: { readonly x: number; readonly z: number };
  readonly count: number;
  readonly above: number;
  /** Optional water-column centre for wall shoals, lifted if reef clearance requires it. */
  readonly waterLevel?: number;
  readonly spread: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** Swimming depths, relative to the reef's top beneath the school. */
  readonly depth: readonly [number, number];
}[] = [
  {
    species: 'blue-green-chromis',
    at: { x: -9, z: -44 },
    count: 70,
    above: 3.2,
    spread: { x: 6, y: 1.6, z: 5 },
    depth: [1.4, 7],
  },
  {
    species: 'blue-green-chromis',
    at: { x: 13, z: -48 },
    count: 55,
    above: 3,
    spread: { x: 5.5, y: 1.5, z: 4.5 },
    depth: [1.4, 7],
  },
  {
    species: 'pajama-cardinalfish',
    at: { x: -19, z: -51 },
    count: 16,
    above: 1.8,
    spread: { x: 3, y: 0.8, z: 2.5 },
    depth: [0.9, 4],
  },
  {
    species: 'firefish-goby',
    at: { x: 7, z: -38 },
    count: 10,
    above: 1.2,
    spread: { x: 3.5, y: 0.6, z: 3 },
    depth: [0.6, 3],
  },
  {
    species: 'yellow-assessor',
    at: { x: 20, z: -40 },
    count: 10,
    above: 1.4,
    spread: { x: 3.5, y: 0.7, z: 3 },
    depth: [0.6, 3.5],
  },
  {
    species: 'royal-gramma',
    at: { x: -22, z: -40 },
    count: 8,
    above: 1.4,
    spread: { x: 3.5, y: 0.7, z: 3 },
    depth: [0.6, 3.5],
  },
  {
    // A small welcoming cloud beside the gully, clear of the tunnel opening.
    species: 'blue-green-chromis',
    at: { x: -7, z: -37 },
    count: 18,
    above: 3.5,
    spread: { x: 3, y: 1, z: 2 },
    depth: [2, 6],
  },
  {
    // Mid-water life beyond the left wall, rather than more fish crowded onto the reef top.
    species: 'blue-green-chromis',
    at: { x: -16, z: -65 },
    count: 24,
    above: 2.5,
    waterLevel: -3,
    spread: { x: 4, y: 1.2, z: 2 },
    depth: [1, 6],
  },
  {
    species: 'blue-green-chromis',
    at: { x: 16, z: -64 },
    count: 24,
    above: 2.5,
    waterLevel: -1,
    spread: { x: 4, y: 1.2, z: 2 },
    depth: [1, 6],
  },
];

/**
 * The outer species list: the tank's species, retuned per school. `top(x, z, r)` is the highest
 * reef or seabed within `r` of a point (the creatures' obstacle field), so each school floats
 * above the coral beneath it.
 */
export function outerSpecies(
  top: (x: number, z: number, radius: number) => number,
): FishSpecies[] {
  return OUTER_SCHOOLS.map((s) => {
    const base = FISH_SPECIES.find((f) => f.id === s.species)!,
      ground = top(s.at.x, s.at.z, Math.max(s.spread.x, s.spread.z)),
      centre = Math.max(ground + s.above, s.waterLevel ?? -Infinity),
      floor = centre - s.above;
    return {
      ...base,
      count: s.count,
      region: { x: s.at.x, y: centre, z: s.at.z },
      spread: s.spread,
      depth: [floor + s.depth[0], floor + s.depth[1]],
      individualScale: undefined,
    };
  });
}
/** Places fish like to visit, from the reef's layout. */
export function outerInterests(layout: ReefLayout): HabitatInterest[] {
  const up = { x: 0, y: 1, z: 0 },
    out: HabitatInterest[] = [];
  for (const p of layout.placements) {
    if (p.family === 'rock')
      out.push({
        kind: 'reef-face',
        position: {
          x: p.position.x,
          y: p.position.y + 0.5 * p.scale.y,
          z: p.position.z,
        },
        normal: up,
      });
    else if (
      p.family === 'branching' ||
      p.family === 'massive' ||
      p.family === 'plate'
    )
      out.push({ kind: 'coral-edge', position: p.position, normal: up });
  }
  for (const h of layout.heads)
    out.push(
      {
        kind: 'open-reef',
        position: { x: h.x, y: h.y + 6, z: h.z },
        normal: up,
      },
      {
        kind: 'sheltered-crevice',
        position: { x: h.x, y: h.y + 0.8, z: h.z },
        normal: up,
      },
      {
        kind: 'substrate',
        position: { x: h.x + 4, y: h.y, z: h.z },
        normal: up,
      },
    );
  return out;
}

export class OuterSchools {
  readonly root = new THREE.Group();
  readonly fish: FishSystem;
  readonly ready: Promise<boolean>;
  private readonly schools: AuthoredSchool[] = [];
  private leases: AssetLease[] = [];
  private disposed = false;
  constructor(
    habitat: FishHabitat,
    species: readonly FishSpecies[],
    loader: AssetLoader,
  ) {
    this.root.name = 'Outer reef fish';
    this.fish = new FishSystem(habitat, species, 24024);
    this.ready = this.load(loader, species);
  }
  private async load(
    loader: AssetLoader,
    species: readonly FishSpecies[],
  ): Promise<boolean> {
    const ids = [...new Set(species.map((s) => s.id))],
      counts = ids.map(
        (id) =>
          this.fish.simulation.fish.filter((f) => f.species.id === id).length,
      );
    const results = await Promise.allSettled(
      ids.flatMap((id, i) => {
        const asset = LIBRARY[id];
        return asset
          ? Array.from({ length: counts[i] }, () => loader.acquire(asset))
          : [];
      }),
    );
    this.leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    const failed = results.some((r) => r.status === 'rejected');
    if (this.disposed || failed) {
      this.release();
      if (!this.disposed) this.root.add(this.fish.root);
      return false;
    }
    const textures = new Map<string, THREE.Texture>();
    let next = 0;
    ids.forEach((id, i) => {
      if (!LIBRARY[id]) return;
      // Big reef schools: full detail only close by (8 body lengths, the tank uses 14).
      const school = new AuthoredSchool(
        this.fish,
        this.leases.slice(next, next + counts[i]),
        id,
        textures,
        OUTER_FISH_DETAIL,
        // At distance the eyes are sub-pixel: about 0.35k triangles saved per far fish.
        /^Eyes_Gills_Mouth/,
      );
      next += counts[i];
      this.schools.push(school);
      this.root.add(school.root);
    });
    return true;
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    this.fish.update(dt, active, reducedMotion, player);
    for (const school of this.schools) school.update(camera);
  }
  private release(): void {
    this.leases.forEach((l) => l.release());
    this.leases = [];
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.schools.forEach((s) => s.dispose());
    this.schools.length = 0;
    this.release();
    this.fish.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
