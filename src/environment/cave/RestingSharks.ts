import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { CRUISE_SPECIES } from '../../config/creatures';
import type { SightCandidate } from '../../discovery/journal';
import { creatureSight } from '../../discovery/sights';
import { creatureStroke } from '../creatureStroke';
import { caveFloor } from './CaveTerrain';

/**
 * v0.6 Pass 034: whitetip reef sharks resting on the cave's sand, as they do by day. Each lies
 * still on its belly, its body flexing very slightly as it breathes. Models are leased from the
 * shared fish loader (the circling whitetip shares the same cache entry).
 */
export const RESTING = {
  /** Height of the model's centre above the sand (m, at the whitetip's scale). */
  lift: 0.15,
  /** The breathing flex: how much of the authored stroke, and how often (per second). */
  stroke: 0.12,
  rate: 0.35,
} as const;

export interface RestSpot {
  readonly x: number;
  readonly z: number;
  /** Heading about +y (0 faces +x, as the cruisers do). */
  readonly yaw: number;
}
interface Rig {
  readonly near: THREE.Mesh;
  readonly far: THREE.Mesh;
  readonly left: number;
  readonly right: number;
  readonly phase: number;
}

export class RestingSharks {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  private leases: AssetLease[] = [];
  private rigs: Rig[] = [];
  private time = 0;
  private disposed = false;

  constructor(
    private readonly spots: readonly RestSpot[],
    private readonly loader: AssetLoader,
  ) {
    this.root.name = 'Resting whitetips';
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    const species = CRUISE_SPECIES['whitetip-reef-shark'],
      results = await Promise.allSettled(
        this.spots.map(() => this.loader.acquire(species.asset)),
      );
    this.leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (this.disposed || failed) {
      if (failed?.status === 'rejected' && !this.disposed)
        console.error(
          'Cozy Diver: the resting sharks could not be loaded.',
          failed.reason,
        );
      this.release();
      return false;
    }
    this.spots.forEach((s, i) => {
      const model = this.leases[i].model,
        near = model.getObjectByName('Body'),
        far = model.getObjectByName('Body_LOD1');
      if (!(near instanceof THREE.Mesh) || !(far instanceof THREE.Mesh))
        throw Error('whitetipShark: Body and Body_LOD1 must be meshes');
      // Lying still, close by: the full model only.
      far.visible = false;
      const root = new THREE.Group();
      root.name = `${species.name} resting`;
      root.scale.setScalar(species.scale);
      root.position.set(s.x, caveFloor(s.x, s.z) + RESTING.lift, s.z);
      root.rotation.set(0, s.yaw, 0);
      root.add(model);
      this.root.add(root);
      const keys = near.morphTargetDictionary ?? {};
      this.rigs.push({
        near,
        far,
        left: keys.Stroke_Left ?? 0,
        right: keys.Stroke_Right ?? 1,
        phase: i * 2.1,
      });
      this.sightings.push({
        id: creatureSight(species.id),
        label: species.name,
        position: { x: s.x, y: root.position.y, z: s.z },
        radius: species.radius + 0.5,
      });
    });
    return true;
  }
  /** A slow breathing flex, on simulation time only (still while paused). */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    const k = reducedMotion ? 0.5 : 1;
    for (const r of this.rigs)
      creatureStroke(
        r.near,
        r,
        RESTING.stroke *
          k *
          Math.sin(this.time * RESTING.rate * Math.PI * 2 + r.phase),
      );
  }
  private release(): void {
    this.leases.forEach((l) => l.release());
    this.leases = [];
    this.loader.evictUnused(CRUISE_SPECIES['whitetip-reef-shark'].asset);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.rigs = [];
    this.release();
    this.root.removeFromParent();
    this.root.clear();
  }
}
