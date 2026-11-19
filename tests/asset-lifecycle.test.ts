import { it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AssetLoader } from '../src/assets/AssetLoader';
import { assetFixture } from './fixtures/assetFixture';
it('defers cache destruction until the final live lease and releases shared textures once', async () => {
  const asset = assetFixture(),
    mesh = asset.scene.getObjectByName('Body');
  if (
    !(mesh instanceof THREE.Mesh) ||
    !(mesh.material instanceof THREE.MeshStandardMaterial)
  )
    throw Error('Fixture');
  const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  mesh.material.map = texture;
  mesh.material.normalMap = texture;
  const spies = [
    vi.spyOn(mesh.geometry, 'dispose'),
    vi.spyOn(mesh.material, 'dispose'),
    vi.spyOn(texture, 'dispose'),
  ];
  const loader = new AssetLoader(async () => asset),
    a = await loader.acquire('chromis'),
    b = await loader.acquire('chromis');
  loader.dispose();
  a.release();
  a.release();
  spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  b.release();
  b.release();
  loader.dispose();
  spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
  await expect(loader.acquire('chromis')).rejects.toThrow('disposed');
});
it('cleans an in-flight load on owner disposal without publishing a ready state', async () => {
  const asset = assetFixture(),
    mesh = asset.scene.getObjectByName('Body');
  if (!(mesh instanceof THREE.Mesh)) throw Error('Fixture');
  const spy = vi.spyOn(mesh.geometry, 'dispose'),
    status = vi.fn();
  let finish: (value: typeof asset) => void = () => {
    throw Error('not started');
  };
  const loader = new AssetLoader(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      status,
    ),
    pending = loader.acquire('chromis');
  await Promise.resolve();
  loader.dispose();
  finish(asset);
  await expect(pending).rejects.toThrow('disposed');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(status.mock.calls.map((c) => c[1])).toEqual(['loading']);
});
it('clones optional skeletons without duplicating geometry or sharing bone poses', async () => {
  const asset = assetFixture(),
    old = asset.scene.getObjectByName('Body');
  if (!(old instanceof THREE.Mesh)) throw Error('Fixture');
  const mesh = new THREE.SkinnedMesh(old.geometry, old.material),
    bone = new THREE.Bone(),
    tip = new THREE.Bone();
  bone.name = 'Spine';
  tip.name = 'Tail';
  bone.add(tip);
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone, tip]));
  mesh.name = 'Body';
  old.parent!.add(mesh);
  old.removeFromParent();
  const loader = new AssetLoader(async () => asset),
    a = await loader.acquire('chromis'),
    b = await loader.acquire('chromis');
  const am = a.model.getObjectByName('Body'),
    bm = b.model.getObjectByName('Body');
  if (!(am instanceof THREE.SkinnedMesh) || !(bm instanceof THREE.SkinnedMesh))
    throw Error('Skinned fixture');
  expect(am.geometry).toBe(bm.geometry);
  expect(am.skeleton).not.toBe(bm.skeleton);
  am.skeleton.bones[1].rotation.y = 0.5;
  expect(bm.skeleton.bones[1].rotation.y).toBe(0);
  a.release();
  b.release();
  loader.dispose();
});
it('evicts a library: frees it after its last lease, and decodes it afresh when acquired again', async () => {
  let reads = 0;
  const assets: ReturnType<typeof assetFixture>[] = [];
  const loader = new AssetLoader(async () => {
    reads++;
    const asset = assetFixture();
    assets.push(asset);
    return asset;
  });
  const geometry = () => {
    const mesh = assets[0].scene.getObjectByName('Body');
    if (!(mesh instanceof THREE.Mesh)) throw Error('Fixture');
    return mesh.geometry;
  };
  const a = await loader.acquire('chromis'),
    spy = vi.spyOn(geometry(), 'dispose');
  loader.evict('chromis');
  expect(spy).not.toHaveBeenCalled();
  a.release();
  expect(spy).toHaveBeenCalledTimes(1);
  // Released without eviction: still cached.
  const b = await loader.acquire('chromis');
  expect(reads).toBe(2);
  b.release();
  (await loader.acquire('chromis')).release();
  expect(reads).toBe(2);
  // Evicting with no lease held frees at once; unknown ids are ignored.
  loader.evict('chromis');
  loader.evict('reefShark');
  (await loader.acquire('chromis')).release();
  expect(reads).toBe(3);
  loader.dispose();
});
it('keeps a transient model cached while another world still holds it', async () => {
  const asset = assetFixture(),
    read = vi.fn(async () => asset),
    loader = new AssetLoader(read);
  const a = await loader.acquire('chromis'),
    b = await loader.acquire('chromis');
  a.release();
  loader.evictUnused('chromis');
  const c = await loader.acquire('chromis');
  expect(read).toHaveBeenCalledTimes(1);
  const mesh = asset.scene.getObjectByName('Body');
  if (!(mesh instanceof THREE.Mesh)) throw Error('Fixture');
  const dispose = vi.spyOn(mesh.geometry, 'dispose');
  b.release();
  loader.evictUnused('chromis');
  expect(dispose).not.toHaveBeenCalled();
  c.release();
  loader.evictUnused('chromis');
  expect(dispose).toHaveBeenCalledTimes(1);
  loader.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});
