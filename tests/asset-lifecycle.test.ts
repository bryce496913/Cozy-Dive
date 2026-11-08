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
