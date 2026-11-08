import { it, expect, vi } from 'vitest';
import { AssetLoader } from '../src/assets/AssetLoader';
import { AuthoredSchool } from '../src/benchmark/AuthoredSchool';
import { FishSystem } from '../src/fish/FishSystem';
import { AQUARIUM } from '../src/config/world';
import { assetFixture } from './fixtures/assetFixture';
it('animates the shared authored morph rig without changing simulation, pauses exactly, and frees instance resources once', async () => {
  const asset = assetFixture(),
    loader = new AssetLoader(async () => asset),
    fish = new FishSystem({ bounds: AQUARIUM, rocks: [] }),
    leases = await Promise.all(
      Array.from({ length: 20 }, () => loader.acquire('chromis')),
    ),
    school = new AuthoredSchool(fish, leases);
  try {
    const before = JSON.stringify(fish.simulation.fish);
    school.update();
    expect(JSON.stringify(fish.simulation.fish)).toBe(before);
    expect(school.meshes.every((m) => m.count === 20)).toBe(true);
    const texture = school.meshes[0].morphTexture!,
      spy = vi.spyOn(texture, 'dispose');
    const pixels = texture.source.data.data;
    if (!pixels) throw Error('Morph texture missing pixels');
    const initial = Array.from(pixels);
    for (let i = 0; i < 60; i++) {
      fish.update(1 / 30, true, false);
      school.update();
    }
    expect(Array.from(pixels)).not.toEqual(initial);
    const paused = school.meshes.map((m) => Array.from(m.instanceMatrix.array));
    const phase = Array.from(pixels);
    fish.update(3600, false, false);
    school.update();
    expect(
      school.meshes.map((m) => Array.from(m.instanceMatrix.array)),
    ).toEqual(paused);
    expect(Array.from(pixels)).toEqual(phase);
    fish.update(1 / 30, true, true);
    school.update();
    expect(
      school.meshes.every((m) => m.instanceMatrix.array.every(Number.isFinite)),
    ).toBe(true);
    school.dispose();
    school.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    school.dispose();
    fish.dispose();
    loader.dispose();
  }
});
it('replaces only benchmark collision components and restores the original shared array and order', async () => {
  const { Aquarium } = await import('../src/environment/Aquarium');
  const q = new Aquarium();
  try {
    const shared = q.collision.colliders,
      original = [...shared],
      removed = q.hardscape.formations[0].colliders,
      replacement = [
        { planes: removed[0].planes, min: removed[0].min, max: removed[0].max },
      ];
    q.replacePresentationColliders(removed, replacement);
    expect(q.collision.colliders).toBe(shared);
    expect(q.fish.simulation.habitat.rocks).toBe(shared);
    expect(shared).toContain(replacement[0]);
    removed.forEach((c) => expect(shared).not.toContain(c));
    q.replacePresentationColliders(replacement, removed);
    expect(shared).toEqual(original);
  } finally {
    q.dispose();
  }
});

it('builds outward runtime hulls from decoded collider points regardless of exported face winding', async () => {
  const THREE = await import('three'),
    { assetColliders } = await import('../src/assets/AssetCollision'),
    { CollisionWorld } = await import('../src/player/collision');
  const root = new THREE.Group(),
    geometry = new THREE.BoxGeometry(1, 2, 1);
  const index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    index.setX(i, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  const material = new THREE.MeshBasicMaterial(),
    mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'COLLIDER_Test';
  root.position.set(7, 3, -2);
  root.add(mesh);
  try {
    const hulls = assetColliders(root),
      world = new CollisionWorld(hulls, AQUARIUM);
    expect(hulls).toHaveLength(1);
    expect(world.contains(hulls[0], 7, 3, -2)).toBe(true);
    expect(world.contains(hulls[0], 9, 3, -2)).toBe(false);
    expect(mesh.visible).toBe(false);
  } finally {
    geometry.dispose();
    material.dispose();
  }
});
