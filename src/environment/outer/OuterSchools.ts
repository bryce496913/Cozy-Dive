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
 * v0.4 Pass 024: reef fish in the outer waters. Bigger schools of the tank's own species, each
 * gathered around one of the reef's coral heads, swim with the same simulation and authored rigs
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
/** Which species gathers at which coral head, how many, and how high above its seabed. */
export const OUTER_SCHOOLS: readonly {
  readonly species: SpeciesId;
  readonly head: number;
  readonly count: number;
  readonly above: number;
  /** Where the school gathers relative to its head (beside it, clear of its rocks). */
  readonly offset: { readonly x: number; readonly z: number };
  readonly spread: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly depth: readonly [number, number];
}[] = [
  {
    species: 'blue-green-chromis',
    head: 0,
    count: 36,
    above: 5,
    offset: { x: 7, z: 2 },
    spread: { x: 5, y: 1.6, z: 5 },
    depth: [2.5, 11],
  },
  {
    species: 'blue-green-chromis',
    head: 3,
    count: 28,
    above: 5,
    offset: { x: -7, z: 1 },
    spread: { x: 4.5, y: 1.4, z: 4.5 },
    depth: [2.5, 11],
  },
  {
    species: 'pajama-cardinalfish',
    head: 5,
    count: 14,
    above: 2.2,
    offset: { x: 5.5, z: -3 },
    spread: { x: 3, y: 1, z: 3 },
    depth: [1, 6],
  },
  {
    species: 'firefish-goby',
    head: 1,
    count: 8,
    above: 1.4,
    offset: { x: -5.5, z: 3 },
    spread: { x: 4, y: 0.8, z: 4 },
    depth: [0.6, 4.5],
  },
  {
    species: 'yellow-assessor',
    head: 2,
    count: 8,
    above: 1.8,
    offset: { x: 5.5, z: 4 },
    spread: { x: 4, y: 1, z: 4 },
    depth: [0.6, 5],
  },
  {
    species: 'royal-gramma',
    head: 4,
    count: 6,
    above: 1.8,
    offset: { x: -5, z: -4 },
    spread: { x: 4, y: 1, z: 4 },
    depth: [0.6, 5],
  },
];

/** The outer species list: the tank's species, retuned per school for the reef's heads. */
export function outerSpecies(heads: ReefLayout['heads']): FishSpecies[] {
  return OUTER_SCHOOLS.map((s) => {
    const base = FISH_SPECIES.find((f) => f.id === s.species)!,
      h = heads[s.head % heads.length];
    return {
      ...base,
      count: s.count,
      region: { x: h.x + s.offset.x, y: h.y + s.above, z: h.z + s.offset.z },
      spread: s.spread,
      depth: [h.y + s.depth[0], h.y + s.depth[1]],
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
