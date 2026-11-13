import { describe, it, expect } from 'vitest';
import {
  TankCatalog,
  TANK_ITEMS,
  TANK_KEY,
  unlockedItems,
  validPlacement,
  rotatedSize,
  loadTank,
  saveTank,
  itemCollider,
  targetTankItem,
  type PlacementContext,
  type TankItem,
} from '../src/catalog/catalog';
import { CollisionWorld } from '../src/player/collision';
import { AQUARIUM } from '../src/config/world';
const context: PlacementContext = { keepOut: [], routes: [], surface: () => 0 };
const seen = TANK_ITEMS.map((i) => ({
  id: i.sighting,
  first: new Date(0).toISOString(),
}));
const item: TankItem = {
  id: 'tank-a',
  kind: 'sea-fan',
  position: { x: 8, y: 0, z: 5 },
  rotation: 0,
};
const store = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
};
describe('gentle tank catalog', () => {
  it('lists only discovered plants/corals and ignores animal sightings', () => {
    expect(unlockedItems([])).toEqual([]);
    expect(
      unlockedItems([{ id: 'species:green-sea-turtle', first: '' }]),
    ).toEqual([]);
    for (const i of TANK_ITEMS)
      expect(unlockedItems([{ id: i.sighting, first: '' }])).toEqual([i]);
  });
  it('keeps glass, channel, surface, vertical bounds and nonfinite entries clear', () => {
    expect(validPlacement(item, [], context)).toBe(true);
    for (const position of [
      { x: 0, y: 0, z: 5 },
      { x: 17.3, y: 0, z: 5 },
      { x: 8, y: 0, z: 13.3 },
      { x: 8, y: 2, z: 5 },
      { x: NaN, y: 0, z: 5 },
    ])
      expect(validPlacement({ ...item, position }, [], context)).toBe(false);
  });
  it('checks each protected area and the swept route, not only route endpoints', () => {
    for (const name of [
      'crevice',
      'return alley',
      'anemone',
      'moray',
      'discoveries',
      'seahorse',
      'frogfish',
      'shipwreck',
      'arch',
      'filter',
      'spawn',
    ]) {
      const c = {
        ...context,
        keepOut: [
          { name, min: { x: 7, y: -1, z: 4 }, max: { x: 9, y: 2, z: 6 } },
        ],
      };
      expect(validPlacement(item, [], c)).toBe(false);
      expect(
        validPlacement({ ...item, position: { x: 12, y: 0, z: 5 } }, [], c),
      ).toBe(true);
    }
    const c = {
      ...context,
      routes: [
        [
          { x: 4, y: 0.5, z: 5 },
          { x: 12, y: 0.5, z: 5 },
        ],
      ],
    };
    expect(validPlacement(item, [], c)).toBe(false);
    expect(
      validPlacement({ ...item, position: { x: 8, y: 0, z: 8 } }, [], c),
    ).toBe(true);
  });
  it('rotates asymmetric footprints and forbids overlapping additions', () => {
    expect(rotatedSize('sea-fan', Math.PI / 2).z).toBeCloseTo(
      rotatedSize('sea-fan', 0).x,
    );
    expect(validPlacement({ ...item, id: 'tank-b' }, [item], context)).toBe(
      false,
    );
  });
  it('caps additions but permits moving at capacity; cancellation preserves the original', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...item,
      id: `tank-${i}`,
      position: { x: 8, y: 0, z: i * 3 },
    }));
    const model = new TankCatalog(many, context);
    expect(model.begin('boulder')).toBe(false);
    expect(model.move('tank-0')).toBe(true);
    model.turn();
    model.aim({ x: 12, y: 0, z: 5 });
    model.cancel();
    expect(model.items).toEqual(many);
    expect(model.move('tank-0')).toBe(true);
    model.aim({ x: 12, y: 0, z: 5 });
    expect(model.place()).toBe(true);
    expect(model.items).toHaveLength(20);
    model.remove('tank-0');
    expect(model.items).toHaveLength(19);
  });
  it('saves and loads entries individually and drops missing sightings, duplicates and bad entries', () => {
    const s = store();
    expect(saveTank(s, [item])).toBe(true);
    expect(loadTank(s, seen, context)).toEqual([item]);
    expect(loadTank(s, [], context)).toEqual([]);
    s.setItem(
      TANK_KEY,
      JSON.stringify({
        version: 1,
        items: [
          null,
          { ...item, id: 'tank-b', position: { x: 0, y: 0, z: 0 } },
          item,
          item,
          { ...item, id: 'tank-c', kind: 'shark' },
        ],
      }),
    );
    expect(loadTank(s, seen, context)).toEqual([item]);
    s.setItem(TANK_KEY, '{');
    expect(loadTank(s, seen, context)).toEqual([]);
    s.setItem(TANK_KEY, JSON.stringify({ version: 2, items: [item] }));
    expect(loadTank(s, seen, context)).toEqual([]);
  });
  it('survives unavailable storage and restores the original without erasing sightings', () => {
    const broken = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(loadTank(broken, seen, context)).toEqual([]);
    expect(saveTank(broken, [item])).toBe(false);
    const model = new TankCatalog([item], context);
    model.move(item.id);
    model.reset();
    expect(model.items).toEqual([]);
    expect(model.preview).toBeNull();
  });
  it('makes a colony solid to the production swimmer solver', () => {
    const c = itemCollider(item),
      world = new CollisionWorld([c], AQUARIUM);
    expect(world.contains(c, 8, 0.5, 5)).toBe(true);
    const state = {
      position: { x: 6, y: 0.7, z: 5 },
      velocity: { x: 3, y: 0, z: 0 },
    };
    state.position.x = 10;
    world.move(state, 6, 0.7, 5);
    expect(state.position.x).toBeLessThan(c.min.x);
  });
});

it('protects the actual aquarium routes after adding valid colonies', async () => {
  const { Aquarium } = await import('../src/environment/Aquarium');
  const { tankContext } = await import('../src/catalog/TankContext');
  const { integrationRoutes, swimRoute } =
    await import('../validation/SwimRoutes');
  const q = new Aquarium();
  try {
    const c = tankContext(q),
      items: TankItem[] = [];
    for (let z = -8; z < 12 && items.length < 20; z += 1.8)
      for (let x = -15; x <= 15 && items.length < 20; x += 1.8) {
        const i: TankItem = {
          id: `tank-${items.length}`,
          kind: items.length % 2 ? 'seagrass' : 'boulder',
          position: { x, y: c.surface(x, z), z },
          rotation: 0,
        };
        if (validPlacement(i, items, c)) items.push(i);
      }
    expect(items).toHaveLength(20);
    expect(c.routes).toHaveLength(12);
    q.replacePresentationColliders([], items.map(itemCollider));
    for (const points of c.routes)
      expect(swimRoute(q, points).maximumError).toBeLessThan(0.075);
    for (const route of integrationRoutes(q))
      expect(swimRoute(q, route.points).maximumError).toBeLessThan(0.075);
  } finally {
    q.dispose();
  }
}, 20000);

it('owns decoration buffers once and releases a late library lease after disposal', async () => {
  const THREE = await import('three');
  const { TankDecoration } = await import('../src/environment/TankDecoration');
  const { vi } = await import('vitest');
  const model = new THREE.Group(),
    geometry = new THREE.BoxGeometry(),
    material = new THREE.MeshStandardMaterial();
  for (const d of TANK_ITEMS) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = d.node;
    model.add(mesh);
  }
  const release = vi.fn();
  const loader = { acquire: async () => ({ model, release }) };
  const decor = new TankDecoration(
    loader as unknown as import('../src/assets/AssetLoader').AssetLoader,
    material,
  );
  expect(await decor.prepare()).toBe(true);
  decor.rebuild([item]);
  decor.showPreview(item, true);
  decor.update(new THREE.PerspectiveCamera());
  const libraryDispose = vi.spyOn(geometry, 'dispose');
  decor.dispose();
  decor.dispose();
  expect(release).toHaveBeenCalledTimes(1);
  expect(libraryDispose).not.toHaveBeenCalled();
  let resolve!: (value: { model: typeof model; release: () => void }) => void;
  const lateRelease = vi.fn();
  const late = new TankDecoration(
    {
      acquire: () =>
        new Promise((r) => {
          resolve = r;
        }),
    } as unknown as import('../src/assets/AssetLoader').AssetLoader,
    material,
  );
  const pending = late.prepare();
  late.dispose();
  resolve({ model, release: lateRelease });
  expect(await pending).toBe(false);
  late.dispose();
  expect(lateRelease).toHaveBeenCalledTimes(1);
  geometry.dispose();
  material.dispose();
});

it('targets only reachable additions in front of solid scenery', () => {
  const own = itemCollider(item),
    eye = { x: 8, y: 0.5, z: 8 },
    direction = { x: 0, y: 0, z: -1 };
  expect(targetTankItem([item], [own], [own], eye, direction)).toBe(item.id);
  const screen = itemCollider({
    ...item,
    id: 'tank-screen',
    position: { x: 8, y: 0, z: 6.5 },
  });
  expect(
    targetTankItem([item], [own], [screen, own], eye, direction),
  ).toBeUndefined();
  expect(
    targetTankItem([item], [own], [own], { ...eye, z: 12 }, direction),
  ).toBeUndefined();
  expect(
    targetTankItem([item], [own], [own], eye, { x: 0, y: 0, z: 1 }),
  ).toBeUndefined();
});

it('releases an incomplete decoration library and exposes no invisible colliders', async () => {
  const THREE = await import('three');
  const { TankDecoration } = await import('../src/environment/TankDecoration');
  const { vi } = await import('vitest');
  const release = vi.fn(),
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}),
    material = new THREE.MeshStandardMaterial();
  const decor = new TankDecoration(
    {
      acquire: async () => ({ model: new THREE.Group(), release }),
    } as unknown as import('../src/assets/AssetLoader').AssetLoader,
    material,
  );
  try {
    expect(await decor.prepare()).toBe(false);
    expect(decor.colliders).toEqual([]);
    decor.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
    material.dispose();
  }
});
