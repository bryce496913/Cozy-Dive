import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
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
  private readonly read: (url: string) => Promise<LoadedAsset>;
  /** Pass 017: shipped GLBs are Draco-compressed; the local decoder is created on first use. */
  private draco?: DRACOLoader;
  /** Pass 018: KTX2/Basis textures stay compressed on the GPU; needs the renderer's capabilities. */
  private ktx2?: KTX2Loader;
  constructor(
    read?: (url: string) => Promise<LoadedAsset>,
    private readonly status?: (id: AssetId, state: AssetState) => void,
    private readonly renderer?: THREE.WebGLRenderer,
  ) {
    this.read = read ?? ((url) => this.readLocal(url));
  }
  private readLocal(url: string): Promise<LoadedAsset> {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((request) => {
      if (request.startsWith('blob:') || request.startsWith('data:'))
        return request;
      const resolved = new URL(request, location.href);
      if (resolved.origin !== location.origin)
        throw Error('External runtime asset requests are forbidden');
      return resolved.href;
    });
    if (!this.draco) {
      // Local wasm decoder (public/assets/draco); two workers keep startup decoding brief
      // without competing with the main thread for every core.
      this.draco = new DRACOLoader(manager)
        .setDecoderPath(`${import.meta.env.BASE_URL}assets/draco/`)
        .setWorkerLimit(2);
    }
    const gltf = new GLTFLoader(manager).setDRACOLoader(this.draco);
    if (this.renderer) {
      // Local Basis transcoder (public/assets/basis): picks ASTC / BC7 / BC1-3 / ETC2 per device.
      this.ktx2 ??= new KTX2Loader(manager)
        .setTranscoderPath(`${import.meta.env.BASE_URL}assets/basis/`)
        .setWorkerLimit(2)
        .detectSupport(this.renderer);
      gltf.setKTX2Loader(this.ktx2);
    }
    return gltf.loadAsync(url);
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
    // Pending decodes settle first; the worker pool is released once nothing can use it.
    this.draco?.dispose();
    this.draco = undefined;
    this.ktx2?.dispose();
    this.ktx2 = undefined;
  }
}
