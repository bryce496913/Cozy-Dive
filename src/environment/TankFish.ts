import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../assets/AssetLoader';
import { AuthoredSchool } from '../benchmark/AuthoredSchool';
import {
  fishDefinition,
  guestSpecies,
  type TankFishCounts,
} from '../catalog/fishCatalog';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishEntity } from '../fish/FishEntity';
import type { FishHabitat } from '../fish/FishHabitat';
import type { SpeciesId } from '../fish/FishSpecies';
import { FishSystem } from '../fish/FishSystem';

/** Seed for the added fish's own population (independent of the home fish's stream). */
export const TANK_FISH_SEED = 51051;

/**
 * v0.6 Pass 051: the fish the swimmer has added to the home tank. They are living fish: one
 * population on the ordinary simulation (habitat, obstacles, territories and species behaviour),
 * schooling with the home fish as neighbours so they join existing schools, without ever moving
 * the home fish. They swim as the same authored rigs, or as the simple fish if those cannot load.
 *
 * Owns its simulation, its rig leases and its scene graph. `set()` rebuilds the population when
 * the counts change (only from the catalog, never per frame); stale loads are discarded.
 */
export class TankFish {
  readonly root = new THREE.Group();
  private fish?: FishSystem;
  private schools: AuthoredSchool[] = [];
  private leases: AssetLease[] = [];
  private generation = 0;
  private disposed = false;
  private counts: TankFishCounts = {};
  /** Resolves when the latest population has its rigs (true) or fell back / was replaced (false). */
  ready: Promise<boolean> = Promise.resolve(true);
  constructor(
    private readonly loader: AssetLoader,
    private readonly habitat: FishHabitat,
    private readonly companions: readonly FishEntity[],
    private readonly onProblem: (message: string) => void = () => undefined,
  ) {
    this.root.name = 'Added tank fish';
  }
  /** The added fish's simulated bodies (for placement checks and give-way). */
  get bodies(): readonly FishEntity[] {
    return this.fish?.simulation.fish ?? [];
  }
  get system(): FishSystem | undefined {
    return this.fish;
  }
  /** Rebuild for these counts. Returns false if the tank could not seat them (nothing changes). */
  set(counts: TankFishCounts): boolean {
    if (this.disposed) return false;
    const species = guestSpecies(counts);
    let next: FishSystem | undefined;
    if (species.length)
      try {
        next = new FishSystem(
          this.habitat,
          species,
          TANK_FISH_SEED,
          this.companions,
        );
      } catch {
        this.onProblem('There is no open water for another fish just now.');
        return false;
      }
    this.clear();
    this.counts = { ...counts };
    this.fish = next;
    const generation = ++this.generation;
    this.ready = next ? this.load(next, generation) : Promise.resolve(true);
    return true;
  }
  get current(): TankFishCounts {
    return this.counts;
  }
  private async load(fish: FishSystem, generation: number): Promise<boolean> {
    fish.root.name = 'Added tank fish (simple)';
    const ids = [...new Set(fish.simulation.fish.map((f) => f.species.id))];
    const counts = ids.map(
      (id) => fish.simulation.fish.filter((f) => f.species.id === id).length,
    );
    const results = await Promise.allSettled(
      ids.flatMap((id, i) => {
        const asset = fishDefinition(id)?.asset;
        return asset
          ? Array.from({ length: counts[i] }, () => this.loader.acquire(asset))
          : [];
      }),
    );
    const leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    const stale = this.disposed || generation !== this.generation;
    if (stale || results.some((r) => r.status === 'rejected')) {
      leases.forEach((l) => l.release());
      if (!stale) this.root.add(fish.root);
      return false;
    }
    this.leases = leases;
    const textures = new Map<string, THREE.Texture>();
    let next = 0;
    ids.forEach((id: SpeciesId, i) => {
      const school = new AuthoredSchool(
        fish,
        leases.slice(next, next + counts[i]),
        id,
        textures,
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
    player: PlayerPresence | undefined,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.fish) return;
    this.fish.update(dt, active, reducedMotion, player);
    for (const school of this.schools) school.update(camera);
  }
  private clear(): void {
    this.schools.forEach((s) => s.dispose());
    this.schools = [];
    this.leases.forEach((l) => l.release());
    this.leases = [];
    this.fish?.dispose();
    this.fish = undefined;
    this.root.clear();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.clear();
    this.root.removeFromParent();
  }
}
