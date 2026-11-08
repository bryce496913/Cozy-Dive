import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AssetLoader } from '../src/assets/AssetLoader';
import { assetFixture } from './fixtures/assetFixture';

it('coalesces concurrent loads and shares heavy resources while cloning hierarchy and morph state', async () => {
  const asset = assetFixture(),
    read = vi.fn(async () => asset),
    loader = new AssetLoader(read);
  const [a, b] = await Promise.all([
    loader.acquire('chromis'),
    loader.acquire('chromis'),
  ]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(a.model).not.toBe(b.model);
  const am = a.model.getObjectByName('Body'),
    bm = b.model.getObjectByName('Body');
  expect(am).toBeInstanceOf(THREE.Mesh);
  expect(bm).toBeInstanceOf(THREE.Mesh);
  if (!(am instanceof THREE.Mesh) || !(bm instanceof THREE.Mesh))
    throw Error('Fixture mesh missing');
  expect(am.geometry).toBe(bm.geometry);
  expect(am.material).toBe(bm.material);
  am.morphTargetInfluences![0] = 0.7;
  expect(bm.morphTargetInfluences![0]).toBe(0);
  expect(a.animations).toBe(b.animations);
  a.release();
  b.release();
  loader.dispose();
});
it('reports a load failure, keeps no bad cache entry, and permits an explicit retry', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {}),
    status = vi.fn(),
    asset = assetFixture();
  const read = vi
      .fn()
      .mockRejectedValueOnce(Error('missing'))
      .mockResolvedValueOnce(asset),
    loader = new AssetLoader(read, status);
  try {
    await expect(loader.acquire('chromis')).rejects.toThrow('missing');
    const good = await loader.acquire('chromis');
    expect(read).toHaveBeenCalledTimes(2);
    expect(status.mock.calls.map((c) => c[1])).toEqual([
      'loading',
      'error',
      'loading',
      'ready',
    ]);
    good.release();
  } finally {
    loader.dispose();
    error.mockRestore();
  }
});
it('rejects malformed assets and releases decoded resources instead of returning an empty object', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {}),
    asset = assetFixture(),
    g = asset.scene.getObjectByName('Body');
  if (!(g instanceof THREE.Mesh)) throw Error('Fixture');
  const spy = vi.spyOn(g.geometry, 'dispose');
  asset.scene.remove(asset.scene.children[0]);
  // Retain the invalid scene's owned mesh while omitting its required hierarchy.
  asset.scene.add(g);
  const loader = new AssetLoader(async () => asset);
  try {
    await expect(loader.acquire('chromis')).rejects.toThrow('missing node');
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    loader.dispose();
    error.mockRestore();
  }
});
