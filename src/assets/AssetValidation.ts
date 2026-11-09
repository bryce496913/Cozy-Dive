import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
export type LoadedAsset = Pick<GLTF, 'scene' | 'scenes' | 'animations'>;
import { ASSET_REGISTRY, type AssetId } from './AssetRegistry';

export function isCollisionNode(object: THREE.Object3D): boolean {
  return object.name.startsWith('COLLIDER_');
}
export function validateAsset(id: AssetId, asset: LoadedAsset): void {
  const spec = ASSET_REGISTRY[id],
    bounds = new THREE.Box3();
  for (const name of spec.requiredNodes)
    if (!asset.scene.getObjectByName(name))
      throw Error(`${id}: missing node ${name}`);
  let meshes = 0,
    morphs = 0,
    collisionMeshes = 0;
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (isCollisionNode(o) || o.name.startsWith('DYNAMIC_')) {
      collisionMeshes++;
      o.visible = false;
      for (const value of o.geometry.attributes.position.array)
        if (!Number.isFinite(value))
          throw Error(`${id}: invalid collision geometry`);
      return;
    }
    meshes++;
    const g = o.geometry,
      p = g.getAttribute('position'),
      n = g.getAttribute('normal'),
      uv = g.getAttribute('uv');
    if (!p?.count || n?.count !== p.count || uv?.count !== p.count)
      throw Error(`${id}/${o.name}: missing geometry, normals or UVs`);
    for (const attr of [p, n, uv, ...Object.values(g.morphAttributes).flat()])
      for (let i = 0; i < attr.array.length; i++)
        if (!Number.isFinite(attr.array[i]))
          throw Error(`${id}/${o.name}: non-finite attribute`);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!(m instanceof THREE.MeshStandardMaterial))
        throw Error(`${id}: material is not PBR`);
      if (o.name === 'Body' || o.name === 'Living_Tissue')
        for (const texture of [m.map, m.normalMap, m.roughnessMap])
          if (!texture?.image)
            throw Error(`${id}/${o.name}: required PBR texture did not decode`);
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    bounds.union(g.boundingBox!.clone().applyMatrix4(o.matrixWorld));
    if (g.morphAttributes.position?.length) morphs++;
  });
  const size = bounds.getSize(new THREE.Vector3()),
    dimension = Math.max(size.x, size.y, size.z);
  if (
    !meshes ||
    !Number.isFinite(dimension) ||
    dimension < spec.minDimension ||
    dimension > spec.maxDimension
  )
    throw Error(`${id}: invalid authored scale (${dimension})`);
  if (id === 'acropora' && !collisionMeshes)
    throw Error('acropora: missing structural collision');
  if (spec.requireMorphs && morphs < 2)
    throw Error(`${id}: continuous skin/fin morphs missing`);
}
/** Decoded resources have one owner even when referenced by multiple primitives/scenes. */
export function disposeAsset(asset: LoadedAsset): void {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>(),
    images = new Set<ImageBitmap>(),
    skeletons = new Set<THREE.Skeleton>();
  for (const scene of asset.scenes)
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) textures.add(value);
      }
      if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
    });
  skeletons.forEach((s) => s.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => {
    if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap)
      images.add(t.image);
    t.dispose();
  });
  images.forEach((i) => i.close());
}
