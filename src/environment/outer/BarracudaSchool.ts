import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import {
  BARRACUDA,
  BarracudaVisit,
  type BarracudaPose,
} from '../../creatures/barracuda';
import type { SightCandidate } from '../../discovery/journal';
import { OUTER_SIGHTS } from '../../discovery/sights';

/**
 * v0.6 Pass 042: the outer reef's barracuda school, drawn as one instanced draw of the authored
 * barracuda's light distance level (it is only ever seen out in the blue, beyond the glass), each
 * fish with its own stroke. Moved by `BarracudaVisit`; hidden entirely while it is away.
 */
export class BarracudaSchool {
  readonly root = new THREE.Group();
  readonly visit = new BarracudaVisit();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  private lease?: AssetLease;
  private mesh?: THREE.InstancedMesh;
  /** A stand-in carrying one fish's morph influences for `setMorphAt`. */
  private stroke?: THREE.Mesh;
  private keys = { left: 0, right: 1 };
  private readonly pose: BarracudaPose = {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    effort: 0,
  };
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YZX');
  private readonly p = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private disposed = false;

  constructor(private readonly loader: AssetLoader) {
    this.root.name = 'Great barracuda';
    this.ready = this.load();
  }
  private async load(): Promise<boolean> {
    try {
      const lease = await this.loader.acquire('barracuda');
      if (this.disposed) {
        lease.release();
        return false;
      }
      this.lease = lease;
      const far = lease.model.getObjectByName('Body_LOD1');
      if (!(far instanceof THREE.Mesh) || Array.isArray(far.material))
        throw Error('barracuda: Body_LOD1 must be a mesh with one material');
      const k = far.morphTargetDictionary ?? {};
      this.keys = { left: k.Stroke_Left ?? 0, right: k.Stroke_Right ?? 1 };
      // The model's geometry and material belong to the lease; only the instancing is ours.
      this.mesh = new THREE.InstancedMesh(
        far.geometry,
        far.material,
        BARRACUDA.count,
      );
      this.mesh.name = 'Great barracuda school';
      this.mesh.frustumCulled = false;
      this.stroke = new THREE.Mesh(far.geometry);
      this.root.add(this.mesh);
      this.sightings.push({
        id: OUTER_SIGHTS.barracuda.id,
        label: OUTER_SIGHTS.barracuda.label,
        position: this.visit.centre,
        // Seen from the glass: the column is about 10 m out, the near fish about 5 m.
        radius: 7,
      });
      this.place(false);
      return true;
    } catch (error) {
      if (!this.disposed)
        console.error('Cozy Diver: the barracuda could not be loaded.', error);
      this.release();
      return false;
    }
  }
  private place(reducedMotion: boolean): void {
    const mesh = this.mesh,
      w = this.stroke?.morphTargetInfluences;
    if (!mesh || !w) return;
    for (let i = 0; i < BARRACUDA.count; i++) {
      const s = this.visit.pose(i, this.pose),
        effort = s.effort * BARRACUDA.stroke * (reducedMotion ? 0.6 : 1);
      this.e.set(0, s.yaw, 0);
      this.q.setFromEuler(this.e);
      this.p.set(s.x, s.y, s.z);
      this.m.compose(this.p, this.q, this.one);
      mesh.setMatrixAt(i, this.m);
      w[this.keys.left] = Math.max(0, effort);
      w[this.keys.right] = Math.max(0, -effort);
      mesh.setMorphAt(i, this.stroke!);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
  }
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !this.mesh) return;
    if (active) this.visit.update(dt);
    this.mesh.visible = this.visit.present;
    if (this.visit.present) this.place(reducedMotion);
  }
  /** The swimmer has entered the outer reef again: the school starts away. */
  arrive(): void {
    this.visit.arrive();
  }
  private release(): void {
    this.mesh?.dispose();
    this.mesh = undefined;
    this.stroke = undefined;
    this.lease?.release();
    this.lease = undefined;
    this.loader.evictUnused('barracuda');
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.root.clear();
    this.release();
  }
}
