import * as THREE from 'three';

export type MaterialRole =
  | 'body'
  | 'fin'
  | 'coral'
  | 'plant'
  | 'rock'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'artificial'
  | 'translucent';
export interface MaterialSpec {
  role: MaterialRole;
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  flatShading?: boolean;
  opacity?: number;
}
export interface Lease<T> {
  readonly value: T;
  release(): void;
}
interface Entry<T> {
  value: T;
  refs: number;
}
/** A small generated-resource scope, not a second GLB loader. Live leases survive scope retirement. */
export class LowPolyResources {
  private geometries = new Map<string, Entry<THREE.BufferGeometry>>();
  private materials = new Map<string, Entry<THREE.MeshStandardMaterial>>();
  private retired = false;

  private acquire<T extends { dispose(): void }>(
    cache: Map<string, Entry<T>>,
    key: string,
    create: () => T,
  ): Lease<T> {
    if (this.retired) throw Error('Low-poly resource scope is retired');
    let entry = cache.get(key);
    if (!entry) {
      entry = { value: create(), refs: 0 };
      cache.set(key, entry);
    }
    entry.refs++;
    const owned = entry;
    let released = false;
    return {
      value: owned.value,
      release: () => {
        if (released) return;
        released = true;
        if (--owned.refs === 0) {
          cache.delete(key);
          owned.value.dispose();
        }
      },
    };
  }
  /** Key must include all shape/palette/pose parameters and a factory version. Treat leased values as immutable. */
  geometry(
    key: string,
    create: () => THREE.BufferGeometry,
  ): Lease<THREE.BufferGeometry> {
    return this.acquire(this.geometries, key, create);
  }
  material(spec: MaterialSpec): Lease<THREE.MeshStandardMaterial> {
    const color = new THREE.Color(spec.color ?? 0xffffff);
    const opacity = spec.opacity ?? (spec.role === 'translucent' ? 0.55 : 1);
    if (!Number.isFinite(opacity) || opacity <= 0 || opacity > 1)
      throw Error('Invalid opacity');
    if (opacity < 1 && spec.role !== 'translucent')
      throw Error('Use the translucent role for transparency');
    const flatShading = spec.flatShading ?? true,
      vertexColors = spec.vertexColors ?? false;
    const key = JSON.stringify([
      spec.role,
      color.r,
      color.g,
      color.b,
      opacity,
      flatShading,
      vertexColors,
    ]);
    return this.acquire(this.materials, key, () => lowPolyMaterial(spec));
  }
  get counts(): { geometries: number; materials: number } {
    return { geometries: this.geometries.size, materials: this.materials.size };
  }
  /** Prevent new acquisitions. Existing owners release normally; never dispose resources still being rendered. */
  dispose(): void {
    this.retired = true;
  }
}

/** Uncached material for owners such as AssetLoader that already manage resource lifetimes. */
export function lowPolyMaterial(
  spec: MaterialSpec,
): THREE.MeshStandardMaterial {
  const opacity = spec.opacity ?? (spec.role === 'translucent' ? 0.55 : 1);
  if (
    !Number.isFinite(opacity) ||
    opacity <= 0 ||
    opacity > 1 ||
    (opacity < 1 && spec.role !== 'translucent')
  )
    throw Error('Invalid opacity');
  return new THREE.MeshStandardMaterial({
    color: spec.color ?? 0xffffff,
    vertexColors: spec.vertexColors ?? false,
    flatShading: spec.flatShading ?? true,
    opacity,
    transparent: opacity < 1,
    depthWrite: opacity === 1,
    roughness: spec.role === 'metal' ? 0.55 : 0.85,
    metalness: spec.role === 'metal' ? 0.25 : 0,
    fog: true,
  });
}
