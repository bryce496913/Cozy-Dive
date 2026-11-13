import { it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TankBabies } from '../src/environment/TankBabies';
import { TANK_BABIES } from '../src/config/babies';
import type { AssetLease } from '../src/assets/AssetLoader';
import type { FishHabitat } from '../src/fish/FishHabitat';
import { AQUARIUM } from '../src/config/world';
function fixture() {
  const model = new THREE.Group(),
    geometry = new THREE.BoxGeometry(1, 0.1, 0.1),
    material = new THREE.MeshStandardMaterial();
  const near = new THREE.Mesh(geometry, material),
    far = new THREE.Mesh(geometry, material);
  near.name = 'Body';
  far.name = 'Body_LOD1';
  model.add(near, far);
  const lease: AssetLease = {
    model,
    animations: [],
    release: vi.fn(() => model.removeFromParent()),
  };
  return { lease, near, far, geometry, material };
}
const habitat = { solids: [], floor: () => 0 };
const eye = { x: 0, y: 4.6, z: 9 };
it('owns opacity materials only; fades, uses far levels in the miniature, and disposes once', async () => {
  const fixtures = TANK_BABIES.map(fixture),
    loader = {
      acquire: vi.fn(
        async () => fixtures[loader.acquire.mock.calls.length - 1].lease,
      ),
      evictUnused: vi.fn(),
    },
    fish: FishHabitat = { bounds: AQUARIUM, rocks: [] };
  const b = new TankBabies(loader, habitat, fish),
    camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 5, 9);
  b.set(
    TANK_BABIES.map((d) => d.id),
    eye,
  );
  await b.ready;
  expect(b.animals).toHaveLength(3);
  expect(fish.residents).toBe(b.animals);
  const materials = fixtures.map((f) => vi.spyOn(f.near.material, 'dispose')),
    geometries = fixtures.map((f) => vi.spyOn(f.geometry, 'dispose'));
  for (let i = 0; i < 60; i++) b.update(1 / 30, true, false, undefined, camera);
  expect(b.animals.every((a) => a.opacity === 1)).toBe(true);
  const paused = b.animals.map((a) => ({
    ...a.position,
    opacity: a.opacity,
    time: a.time,
  }));
  b.update(1, false, true, undefined, camera);
  expect(
    b.animals.map((a) => ({ ...a.position, opacity: a.opacity, time: a.time })),
  ).toEqual(paused);
  camera.position.set(0, 20, 45);
  camera.updateMatrixWorld();
  b.update(0, false, false, undefined, camera);
  expect(b.nearCount).toBe(0);
  expect(fixtures.every((f) => f.far.visible && !f.near.visible)).toBe(true);
  b.set([TANK_BABIES[0].id, TANK_BABIES[2].id], eye);
  for (let i = 0; i < 60; i++) b.update(1 / 30, true, false, undefined, camera);
  expect(b.animals).toHaveLength(2);
  expect(fixtures[1].lease.release).toHaveBeenCalledTimes(1);
  b.dispose();
  b.dispose();
  expect(fish.residents).toBeUndefined();
  for (let i = 0; i < 3; i++) {
    expect(fixtures[i].lease.release).toHaveBeenCalledTimes(1);
    expect(materials[i]).toHaveBeenCalledTimes(1);
    expect(geometries[i]).not.toHaveBeenCalled();
    fixtures[i].geometry.dispose();
    fixtures[i].material.dispose();
  }
  expect(loader.evictUnused).toHaveBeenCalledTimes(3);
});
it('reverses a return without duplicate leases and resets immediately while paused', async () => {
  const f = fixture(),
    loader = { acquire: vi.fn(async () => f.lease), evictUnused: vi.fn() },
    fish: FishHabitat = { bounds: AQUARIUM, rocks: [] },
    b = new TankBabies(loader, habitat, fish),
    camera = new THREE.Camera(),
    id = TANK_BABIES[0].id;
  b.set([id], eye);
  await b.ready;
  for (let i = 0; i < 20; i++) b.update(1 / 30, true, false, undefined, camera);
  b.set([], eye);
  b.update(1 / 30, true, false, undefined, camera);
  b.set([id], eye);
  await b.ready;
  expect(loader.acquire).toHaveBeenCalledTimes(1);
  expect(b.animals).toHaveLength(1);
  expect(b.animals[0].returning).toBe(false);
  b.clear();
  expect(b.animals).toEqual([]);
  expect(b.empty).toBe(true);
  b.dispose();
  expect(f.lease.release).toHaveBeenCalledTimes(1);
  f.geometry.dispose();
  f.material.dispose();
});
it('releases a late asynchronous lease after disposal, with no actor or material ownership', async () => {
  const f = fixture();
  let finish: (l: AssetLease) => void = () => {};
  const loader = {
      acquire: vi.fn(
        () =>
          new Promise<AssetLease>((r) => {
            finish = r;
          }),
      ),
      evictUnused: vi.fn(),
    },
    fish: FishHabitat = { bounds: AQUARIUM, rocks: [] },
    b = new TankBabies(loader, habitat, fish);
  b.set([TANK_BABIES[0].id], eye);
  b.dispose();
  finish(f.lease);
  await b.ready;
  expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(loader.evictUnused).toHaveBeenCalledTimes(1);
  expect(b.animals).toEqual([]);
  expect(b.root.children).toEqual([]);
  f.geometry.dispose();
  f.material.dispose();
});
it('tolerates failed loading without publishing a phantom body', async () => {
  const error = vi.fn(),
    loader = {
      acquire: vi.fn(async () => {
        throw Error('offline');
      }),
      evictUnused: vi.fn(),
    },
    b = new TankBabies(loader, habitat, { bounds: AQUARIUM, rocks: [] }, error);
  b.set([TANK_BABIES[0].id], eye);
  await b.ready;
  expect(error).toHaveBeenCalledTimes(1);
  expect(b.animals).toEqual([]);
  b.dispose();
});
