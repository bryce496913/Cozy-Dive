import { miniatureGrowth } from '../src/config/babies';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TANK_BABIES } from '../src/config/babies';
import { TANK_FISH } from '../src/config/tankFish';
import { SIGHTS } from '../src/discovery/sights';
import {
  TankCatalog,
  TANK_ITEMS,
  loadTankState,
  loadTankFish,
  saveTank,
} from '../src/catalog/catalog';
import { unlockedFish } from '../src/catalog/fishCatalog';
import { acquireCollectionArt } from '../src/environment/TankCollectionArt';
import { TankBaby } from '../src/creatures/babies/TankBaby';

const seen = SIGHTS.map((s) => ({ ...s, first: '' }));
const context = { keepOut: [], routes: [], surface: () => 0 };

describe('the home tank collects every discovery', () => {
  it('offers every discovered species and grows room with the collection', () => {
    const offered = new Set([
      ...TANK_FISH.map((f) => f.sighting),
      ...TANK_BABIES.map((b) => b.sighting),
      ...TANK_ITEMS.map((i) => i.sighting),
    ]);
    for (const sight of SIGHTS.filter((s) => !s.id.startsWith('place:')))
      expect(offered.has(sight.id), sight.label).toBe(true);
    expect(new Set(TANK_BABIES.map((b) => b.id)).size).toBe(TANK_BABIES.length);
    const collection = new TankCatalog([], context);
    for (const fish of unlockedFish(seen))
      expect(collection.addFish(fish.species, seen).ok, fish.label).toBe(true);
    for (const creature of TANK_BABIES)
      expect(collection.addBaby(creature.id, seen), creature.label).toBe(true);
    expect(collection.babies).toHaveLength(TANK_BABIES.length);
    expect(Object.keys(collection.fish)).toHaveLength(TANK_FISH.length);
    let raw = '';
    const store = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    expect(
      saveTank(store, [], collection.babies, undefined, collection.fish),
    ).toBe(true);
    expect(loadTankState(store, seen, context).babies).toEqual(
      collection.babies,
    );
    expect(loadTankFish(store, seen)).toEqual(collection.fish);
  });

  it('builds every procedural discovery at a small size and disposes it once', async () => {
    const loader = {
      acquire: vi.fn(() => {
        throw Error('Procedural creatures need no asset lease');
      }),
      evictUnused: vi.fn(),
    };
    for (const definition of TANK_BABIES.filter((b) => b.shape)) {
      const art = await acquireCollectionArt(definition, loader);
      art.update(1, 0.5, 3);
      art.far.visible = false;
      const size = new THREE.Box3()
        .setFromObject(art.model)
        .getSize(new THREE.Vector3());
      // V0.8 Pass 096: the colossal squid is a large miniature, at twice its old size.
      expect(Math.max(size.x, size.y, size.z), definition.label).toBeLessThan(
        0.45 * miniatureGrowth(definition.id),
      );
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      art.model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      const disposed = [...geometries, ...materials].map((resource) => {
        const call = vi.fn();
        resource.addEventListener('dispose', call);
        return call;
      });
      art.dispose();
      art.dispose();
      for (const call of disposed) expect(call).toHaveBeenCalledTimes(1);
    }
    expect(loader.acquire).not.toHaveBeenCalled();
  });

  it('keeps collected sponges and corals planted while allowing their return', () => {
    const definition = TANK_BABIES.find((b) => b.id === 'glass-sponge')!;
    const baby = new TankBaby(
      definition,
      { solids: [], floor: () => 0 },
      { x: 0, y: 4, z: 0 },
    );
    const position = { ...baby.position };
    for (let i = 0; i < 300; i++) baby.update(1 / 30, true, false);
    expect(baby.position).toEqual(position);
    expect(baby.opacity).toBe(1);
    baby.returning = true;
    for (let i = 0; i < 60; i++) baby.update(1 / 30, true, false);
    expect(baby.finished).toBe(true);
  });
});
