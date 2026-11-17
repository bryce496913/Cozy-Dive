import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { creatureStroke } from '../creatureStroke';
import type { FishPose } from './PosedFish';

/**
 * v0.6 Pass 043: one authored creature (a `Body` with `Stroke_Left` / `Stroke_Right` morphs and a
 * `Body_LOD1`) drawn at a scripted pose and scale: the great white, the ocean sunfish. Its full
 * model close by, its light one further away. The model belongs to the lease.
 */
export class SoloCreature {
  readonly root = new THREE.Group();
  readonly ready: Promise<boolean>;
  private lease?: AssetLease;
  private near?: THREE.Mesh;
  private far?: THREE.Mesh;
  private keys = { left: 0, right: 1 };
  private isNear = true;
  private readonly eye = new THREE.Vector3();
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    private readonly asset: AssetId,
    readonly pose: FishPose,
    scale: number,
    name: string,
    /** Beyond this distance (m) it is drawn with its light model. */
    private readonly detail = 18,
    /** v0.6 Pass 047: a colour multiplied into its own (the Weddell seal's darker coat). */
    private readonly tint?: number,
  ) {
    this.root.name = name;
    this.root.rotation.order = 'YZX';
    this.root.scale.setScalar(scale);
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    try {
      const lease = await this.loader.acquire(this.asset);
      if (this.disposed) {
        lease.release();
        return false;
      }
      this.lease = lease;
      const near = lease.model.getObjectByName('Body'),
        far = lease.model.getObjectByName('Body_LOD1');
      if (!(near instanceof THREE.Mesh) || !(far instanceof THREE.Mesh))
        throw Error(`${this.asset}: Body and Body_LOD1 must be meshes`);
      this.near = near;
      this.far = far;
      const k = near.morphTargetDictionary ?? {};
      this.keys = { left: k.Stroke_Left ?? 0, right: k.Stroke_Right ?? 1 };
      if (this.tint !== undefined)
        for (const mesh of [near, far])
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            const own = mesh.material.clone();
            own.color.multiply(new THREE.Color(this.tint));
            this.tinted.push(own);
            mesh.material = own;
          }
      this.root.add(lease.model);
      this.update();
      return true;
    } catch (error) {
      if (!this.disposed)
        console.error(
          `Cozy Diver: ${this.root.name} could not be loaded.`,
          error,
        );
      this.release();
      return false;
    }
  }
  update(camera?: THREE.Camera): void {
    if (this.disposed || !this.near || !this.far) return;
    const p = this.pose;
    this.root.position.set(p.position.x, p.position.y, p.position.z);
    this.root.rotation.set(p.roll, p.yaw, p.pitch);
    if (camera) {
      camera.getWorldPosition(this.eye);
      const d = this.root.position.distanceTo(this.eye);
      this.isNear = d < this.detail * (this.isNear ? 1.1 : 1);
    }
    this.near.visible = this.isNear;
    this.far.visible = !this.isNear;
    creatureStroke(this.near, this.keys, p.effort);
    creatureStroke(this.far, this.keys, p.effort);
  }
  private readonly tinted: THREE.Material[] = [];
  private release(): void {
    this.tinted.forEach((m) => m.dispose());
    this.tinted.length = 0;
    this.lease?.release();
    this.lease = undefined;
    this.loader.evictUnused(this.asset);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.root.removeFromParent();
    this.root.clear();
  }
}
