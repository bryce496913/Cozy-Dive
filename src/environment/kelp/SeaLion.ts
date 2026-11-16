import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { KELP } from '../../config/passage';
import { SeaLionSwimmer, type SeaLionLimits } from '../../creatures/seaLion';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { creatureStroke } from '../creatureStroke';

/**
 * v0.6 Pass 039: the kelp forest's California sea lion, drawn with its authored model (leased
 * from the shared fish loader) and moved by `SeaLionSwimmer`: roaming, coming over to circle the
 * swimmer playfully, then darting off. Its full model close by, its light one further away.
 */
export const SEA_LION_DRAW = {
  /** Beyond this distance (m) it is drawn with its light distance level. */
  detail: 14,
  hysteresis: 0.1,
} as const;

export class SeaLion {
  readonly root = new THREE.Group();
  readonly swimmer: SeaLionSwimmer;
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  private lease?: AssetLease;
  private near?: THREE.Mesh;
  private far?: THREE.Mesh;
  private keys = { left: 0, right: 1 };
  private isNear = true;
  private readonly eye = new THREE.Vector3();
  private disposed = false;

  constructor(
    limits: SeaLionLimits,
    private readonly loader: AssetLoader,
  ) {
    this.root.name = 'California sea lion';
    this.root.rotation.order = 'YZX';
    this.swimmer = new SeaLionSwimmer(limits);
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    try {
      const lease = await this.loader.acquire('seaLion');
      if (this.disposed) {
        lease.release();
        return false;
      }
      this.lease = lease;
      const near = lease.model.getObjectByName('Body'),
        far = lease.model.getObjectByName('Body_LOD1');
      if (!(near instanceof THREE.Mesh) || !(far instanceof THREE.Mesh))
        throw Error('seaLion: Body and Body_LOD1 must be meshes');
      this.near = near;
      this.far = far;
      const k = near.morphTargetDictionary ?? {};
      this.keys = { left: k.Stroke_Left ?? 0, right: k.Stroke_Right ?? 1 };
      this.root.add(lease.model);
      this.sightings.push({
        id: KELP_SIGHTS.seaLion.id,
        label: KELP_SIGHTS.seaLion.label,
        position: this.swimmer.position,
        radius: 1.2,
      });
      this.place();
      return true;
    } catch (error) {
      if (!this.disposed)
        console.error('Cozy Diver: the sea lion could not be loaded.', error);
      this.release();
      return false;
    }
  }
  private place(): void {
    const s = this.swimmer;
    this.root.position.set(s.position.x, s.position.y, s.position.z);
    this.root.rotation.set(s.roll, s.yaw, s.pitch);
    if (this.near) creatureStroke(this.near, this.keys, s.effort);
    if (this.far) creatureStroke(this.far, this.keys, s.effort);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.near || !this.far) return;
    if (active) this.swimmer.update(dt, player, reducedMotion);
    camera.getWorldPosition(this.eye);
    const p = this.swimmer.position,
      d = Math.hypot(p.x - this.eye.x, p.y - this.eye.y, p.z - this.eye.z);
    this.isNear =
      d <
      SEA_LION_DRAW.detail * (this.isNear ? 1 + SEA_LION_DRAW.hysteresis : 1);
    this.near.visible = this.isNear;
    this.far.visible = !this.isNear;
    this.place();
  }
  private release(): void {
    this.lease?.release();
    this.lease = undefined;
    this.loader.evictUnused('seaLion');
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.release();
    this.root.removeFromParent();
    this.root.clear();
  }
}

/** The sea lion's limits in the kelp forest: clear of the floor and boulders, inside the walls. */
export function kelpSeaLionLimits(
  ground: (x: number, z: number, radius: number) => number,
): SeaLionLimits {
  const w = KELP.walls;
  return {
    ground,
    top: KELP.surfaceY - 2.5,
    minX: -w.x + 3,
    maxX: w.x - 3,
    minZ: w.farZ + 3,
    maxZ: KELP.tunnel.wallZ - 3,
  };
}
