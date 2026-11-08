import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ASSET_REGISTRY, type AssetId } from './AssetRegistry';
import {
  disposeAsset,
  validateAsset,
  type LoadedAsset,
} from './AssetValidation';
export interface AssetLease {
  readonly model: THREE.Object3D;
  readonly animations: readonly THREE.AnimationClip[];
  release(): void;
}
export type AssetState = 'loading' | 'ready' | 'error';
interface Entry {
  promise: Promise<LoadedAsset>;
  refs: number;
  asset?: LoadedAsset;
  retired: boolean;
  freed: boolean;
}
/** One cache owns decoded resources; leases own only cloned hierarchy/skeleton state. */
export class AssetLoader {
  private readonly entries = new Map<AssetId, Entry>();
  private disposed = false;
  constructor(
    private readonly read: (
      url: string,
    ) => Promise<LoadedAsset> = AssetLoader.readLocal,
    private readonly status?: (id: AssetId, state: AssetState) => void,
  ) {}
  private static readLocal(url: string): Promise<LoadedAsset> {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((request) => {
      if (request.startsWith('blob:') || request.startsWith('data:'))
        return request;
      const resolved = new URL(request, location.href);
      if (resolved.origin !== location.origin)
        throw Error('External runtime asset requests are forbidden');
      return resolved.href;
    });
    return new GLTFLoader(manager).loadAsync(url);
  }
  async acquire(id: AssetId): Promise<AssetLease> {
    if (this.disposed) throw Error('Asset cache is disposed');
    let entry = this.entries.get(id);
    if (!entry) {
      this.status?.(id, 'loading');
      const pending = Promise.resolve().then(() =>
        this.read(`${import.meta.env.BASE_URL}${ASSET_REGISTRY[id].path}`),
      );
      entry = { promise: pending, refs: 0, retired: false, freed: false };
      const current = entry;
      current.promise = pending
        .then((asset) => {
          current.asset = asset;
          try {
            validateAsset(id, asset);
          } catch (error) {
            current.retired = true;
            throw error;
          }
          if (!this.disposed) this.status?.(id, 'ready');
          return asset;
        })
        .catch((error: unknown) => {
          current.retired = true;
          if (this.entries.get(id) === current) this.entries.delete(id);
          if (!this.disposed) this.status?.(id, 'error');
          console.error(
            `Cozy Diver: failed to load ${id}; keeping procedural fallback.`,
            error,
          );
          throw error;
        });
      this.entries.set(id, current);
    }
    const current = entry;
    current.refs++;
    const releaseEntry = () => {
      current.refs--;
      this.free(current);
    };
    try {
      const asset = await current.promise;
      if (this.disposed) throw Error('Asset cache disposed while loading');
      const model = clone(asset.scene);
      let released = false;
      return {
        model,
        animations: asset.animations,
        release: () => {
          if (released) return;
          released = true;
          model.removeFromParent();
          model.traverse((o) => {
            if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
          });
          releaseEntry();
        },
      };
    } catch (error) {
      releaseEntry();
      throw error;
    }
  }
  private free(entry: Entry): void {
    if (!entry.retired || entry.refs || !entry.asset || entry.freed) return;
    entry.freed = true;
    disposeAsset(entry.asset);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.retired = true;
      this.free(entry);
    }
    this.entries.clear();
  }
}
