import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { KELP } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { Obstacles } from '../../creatures/cruising';
import {
  GullDive,
  RareCruise,
  SeaOtter,
  ShySeal,
  type KelpLimits,
} from '../../creatures/kelpEncounters';
import {
  ParrotGrazers,
  type GrazeConfig,
} from '../../creatures/reefEncounters';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { createPose, PosedFish } from '../outer/PosedFish';
import { SandPuffs } from '../outer/SandPuffs';
import { SoloCreature } from '../outer/SoloCreature';
import { KelpCritters } from './KelpCritters';
import { laneCentre } from './KelpTerrain';
import type { Boulder } from './KelpEnvironment';

/**
 * v0.6 Pass 044: the kelp forest's newer life (its leopard sharks swim with the rays):
 *   - a sea otter floating on its back at the surface, diving now and then for an urchin;
 *   - California sheephead picking at the urchins;
 *   - a shy harbour seal that watches the swimmer from a distance;
 *   - now and then a giant sea bass cruising slowly past;
 *   - now and then a gull plunging in to peck at the sand near the swimmer, then leaving;
 *   - Spanish shawl nudibranchs on the boulders and kelp crabs on the stalks.
 * Each part loads on its own and is left out if it cannot. Owns everything it creates.
 */
export const SHEEPHEAD: GrazeConfig = {
  count: 3,
  speed: 0.5,
  bites: [3, 7],
  every: 1.6,
  above: 0.3,
  range: 12,
  shy: 2,
};
const LENGTH = { sheephead: 0.95, seaBass: 2.2 } as const;

export class KelpVisitors {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly otter: SeaOtter;
  readonly seal: ShySeal;
  readonly seaBass: RareCruise;
  readonly gull: GullDive;
  readonly sheephead: ParrotGrazers;
  readonly critters: KelpCritters;
  private readonly puffs = new SandPuffs(0xc8bfa6);
  private otterBody?: SoloCreature;
  private sealBody?: SoloCreature;
  private gullBody?: SoloCreature;
  private bassFish?: PosedFish;
  private sheepFish?: PosedFish;
  private readonly textures = new Map<string, THREE.Texture>();
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    boulders: readonly Boulder[],
    stalks: readonly {
      readonly x: number;
      readonly z: number;
      readonly y: number;
    }[],
    urchins: readonly Readonly<Vec3>[],
    ground: Obstacles,
  ) {
    this.root.name = 'Kelp forest visitors';
    const w = KELP.walls,
      limits: KelpLimits = {
        ground,
        surface: KELP.surfaceY,
        minX: -w.x + 3,
        maxX: w.x - 3,
        minZ: w.farZ + 3,
        maxZ: KELP.tunnel.wallZ - 3,
      };
    // The otter floats over the sandy lane, where the canopy opens and it shows from below.
    this.otter = new SeaOtter(createPose(), limits, urchins, 44011, {
      x: laneCentre(-30),
      z: -30,
      r: 3,
    });
    this.seal = new ShySeal(createPose(), limits);
    this.seaBass = new RareCruise(createPose(), limits);
    this.gull = new GullDive(createPose(), limits);
    this.sheephead = new ParrotGrazers(urchins, createPose, 44061, SHEEPHEAD);
    this.critters = new KelpCritters(boulders, stalks);
    this.root.add(this.puffs.root, this.critters.root);
    this.sightings.push(...this.critters.sightings);
    this.ready = this.load();
  }
  private async lease(id: AssetId, n: number): Promise<AssetLease[]> {
    const all = await Promise.allSettled(
        Array.from({ length: n }, () => this.loader.acquire(id)),
      ),
      ok = all.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (ok.length !== n || this.disposed) {
      ok.forEach((l) => l.release());
      throw Error(`${id} could not be loaded`);
    }
    return ok;
  }
  private async solo(
    id: AssetId,
    pose: ReturnType<typeof createPose>,
    name: string,
  ): Promise<SoloCreature> {
    const body = new SoloCreature(this.loader, id, pose, 1, name, 16);
    if (!(await body.ready)) {
      body.dispose();
      throw Error(`${id} could not be loaded`);
    }
    this.root.add(body.root);
    return body;
  }
  private async part(
    build: () => Promise<void>,
    what: string,
  ): Promise<boolean> {
    try {
      await build();
      return !this.disposed;
    } catch (error) {
      if (!this.disposed)
        console.error(`Cozy Diver: the ${what} could not be loaded.`, error);
      return false;
    }
  }
  private async load(): Promise<boolean> {
    const results = await Promise.all([
      this.part(async () => {
        this.otterBody = await this.solo(
          'seaOtter',
          this.otter.pose,
          'Sea otter',
        );
        this.sightings.push({
          ...KELP_SIGHTS.otter,
          position: this.otter.pose.position,
          // Seen from well below, against the bright surface.
          radius: 5,
        });
      }, 'sea otter'),
      this.part(async () => {
        this.sealBody = await this.solo(
          'harbourSeal',
          this.seal.pose,
          'Harbour seal',
        );
        // Shy: seen from its watching distance.
        this.sightings.push({
          ...KELP_SIGHTS.seal,
          position: this.seal.pose.position,
          radius: 4,
        });
      }, 'harbour seal'),
      this.part(async () => {
        this.gullBody = await this.solo(
          'westernGull',
          this.gull.swim.pose,
          'Western gull',
        );
        this.sightings.push({
          ...KELP_SIGHTS.gull,
          position: this.gull.swim.pose.position,
          radius: 1,
        });
      }, 'gull'),
      this.part(async () => {
        const pose = this.seaBass.swim.pose;
        this.bassFish = new PosedFish(
          await this.lease('giantSeaBass', 1),
          [pose],
          'Giant sea bass',
          LENGTH.seaBass,
          8,
          this.textures,
        );
        this.root.add(this.bassFish.root);
        this.sightings.push({
          ...KELP_SIGHTS.seaBass,
          position: pose.position,
          radius: 1.6,
        });
      }, 'giant sea bass'),
      this.part(async () => {
        const poses = this.sheephead.poses;
        this.sheepFish = new PosedFish(
          await this.lease('sheephead', poses.length),
          poses,
          'California sheephead',
          LENGTH.sheephead,
          10,
          this.textures,
        );
        this.root.add(this.sheepFish.root);
        for (const p of poses)
          this.sightings.push({
            ...KELP_SIGHTS.sheephead,
            position: p.position,
            radius: 0.9,
          });
      }, 'sheephead'),
    ]);
    if (this.disposed) return false;
    this.place(undefined);
    // Shown until the first update, so the warm-up draws and compiles them.
    if (this.gullBody) this.gullBody.root.visible = true;
    if (this.bassFish) this.bassFish.visible = true;
    return results.some(Boolean);
  }
  private place(camera: THREE.Camera | undefined): void {
    this.otterBody?.update(camera);
    this.sealBody?.update(camera);
    if (this.gullBody) {
      this.gullBody.root.visible = this.gull.present;
      this.gullBody.update(camera);
    }
    if (this.bassFish) {
      this.bassFish.visible = this.seaBass.present;
      this.bassFish.update(camera);
    }
    this.sheepFish?.update(camera);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    if (active && dt > 0) {
      this.otter.update(dt);
      this.seal.update(dt, player);
      this.seaBass.update(dt, player);
      this.gull.update(dt, player);
      if (this.gull.pecked && !reducedMotion)
        this.puffs.spawn(
          this.gull.peckAt.x,
          this.gull.peckAt.y,
          this.gull.peckAt.z,
        );
      this.sheephead.update(dt, player);
      if (!reducedMotion)
        for (let i = 0; i < this.sheephead.bitCount; i++) {
          const b = this.sheephead.bites[i];
          this.puffs.spawn(b.x, b.y, b.z);
        }
      this.puffs.update(dt);
    }
    this.critters.update(dt, active, reducedMotion, player);
    this.place(camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.otterBody?.dispose();
    this.sealBody?.dispose();
    this.gullBody?.dispose();
    this.bassFish?.dispose();
    this.sheepFish?.dispose();
    this.critters.dispose();
    this.puffs.dispose();
    this.root.clear();
  }
}
