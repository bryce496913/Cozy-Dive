import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../src/assets/AssetLoader';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import {
  NO_KEPT,
  TANK_ITEMS,
  TANK_KEY,
  TankCatalog,
  TURN_STEP,
  UNDO_DEPTH,
  itemBounds,
  keptEntries,
  loadTankFish,
  loadTankState,
  saveTank,
  validPlacement,
  type TankItem,
} from '../src/catalog/catalog';
import {
  fishRoom,
  fishTotal,
  guestSpecies,
  readFish,
  unlockedFish,
  type TankFishCounts,
} from '../src/catalog/fishCatalog';
import { TANK_BABIES } from '../src/config/babies';
import { AQUARIUM } from '../src/config/world';
import { TANK_FISH, TANK_FISH_CAP } from '../src/config/tankFish';
import { TankFish } from '../src/environment/TankFish';
import { FishSimulation } from '../src/fish/FishMovement';
import type { FishHabitat } from '../src/fish/FishHabitat';
import { spawnFish } from '../src/fish/FishSpawner';
import { FISH_SPECIES, FISH_TIMING } from '../src/fish/FishSpecies';
import { FishSystem } from '../src/fish/FishSystem';
import { assetFixture } from './fixtures/assetFixture';

/** v0.6 Pass 051: full aquarium personalization (fish, decorations, saves, undo). */
const nothing = [] as const;
const everything = [
  ...TANK_ITEMS.filter((i) => i.sighting).map((i) => ({
    id: i.sighting,
    first: '',
  })),
  ...TANK_BABIES.map((b) => ({ id: b.sighting, first: '' })),
  ...TANK_FISH.filter((f) => f.sighting).map((f) => ({
    id: f.sighting!,
    first: '',
  })),
];
const context = { keepOut: [], routes: [], surface: () => 0 };
const habitat: FishHabitat = { bounds: AQUARIUM, rocks: [] };
function store(initial?: unknown) {
  let value: string | null =
    initial === undefined ? null : JSON.stringify(initial);
  return {
    getItem: (key: string) => (key === TANK_KEY ? value : null),
    setItem: (_k: string, v: string) => {
      value = v;
    },
    get saved(): unknown {
      return value === null ? null : JSON.parse(value);
    },
  };
}

describe('Pass 051: the catalog is data-driven and grouped', () => {
  it('separates schooling fish, aquarium fish, visitors, plants and corals, and rocks', () => {
    expect(
      TANK_FISH.filter((f) => f.group === 'schooling').length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      TANK_FISH.filter((f) => f.group === 'individual').length,
    ).toBeGreaterThanOrEqual(3);
    expect(TANK_BABIES.length).toBeGreaterThan(3);
    expect(
      TANK_ITEMS.filter((i) => i.category === 'coral-plant').length,
    ).toBeGreaterThan(8);
    expect(
      TANK_ITEMS.filter((i) => i.category === 'rock-decoration').length,
    ).toBeGreaterThanOrEqual(3);
  });
  it('every offered fish swims as a real species on a registered rig, and none is also unsuited', () => {
    for (const f of TANK_FISH) {
      expect(guestSpecies({ [f.species]: 1 }), f.species).toHaveLength(1);
      expect(ASSET_REGISTRY[f.asset], f.asset).toBeDefined();
      expect(f.max).toBeGreaterThan(0);
    }
    // Playtest: the clownfish, the big reef fish and the kelp and cave fish can all come home, at
    // tank size, alongside flashlight and polar fish.
    for (const species of [
      'ocellaris-clownfish',
      'parrotfish',
      'humphead-wrasse',
      'bigeye-trevally',
      'great-barracuda',
      'garibaldi',
      'kelp-bass',
      'blacksmith',
      'senorita',
      'glassy-sweeper',
      'soldierfish',
    ] as const) {
      expect(
        TANK_FISH.some((f) => f.species === species),
        species,
      ).toBe(true);
      const [s] = guestSpecies({ [species]: 1 });
      expect(s.length, species).toBeLessThanOrEqual(1);
    }
  });
  it('offers the tank’s own species from the start and the outer reef’s once seen', () => {
    const start = unlockedFish(nothing).map((f) => f.species);
    expect(start).toContain('blue-green-chromis');
    expect(start).not.toContain('blue-tang');
    expect(unlockedFish(everything)).toHaveLength(TANK_FISH.length);
    // Playtest: the clownfish is offered from the start; nothing unsuited shows before it is seen.
    expect(start).toContain('ocellaris-clownfish');
  });
});

describe('Pass 051: room for fish (capacity and compatibility)', () => {
  it('caps each species and the total, with a gentle reason, and gates unseen species', () => {
    const m = new TankCatalog([], context);
    for (let i = 0; i < 12; i++)
      expect(m.addFish('blue-green-chromis', nothing).ok).toBe(true);
    const full = m.addFish('blue-green-chromis', nothing);
    expect(full.ok).toBe(false);
    if (!full.ok)
      expect(full.reason).toMatch(/12 blue-green chromis already added/);
    expect(m.addFish('blue-tang', nothing).ok).toBe(false);
    expect(m.addFish('blue-tang', everything).ok).toBe(true);
    expect(m.addFish('ocellaris-clownfish', everything).ok).toBe(true);
    // Fill to the total cap.
    let counts: TankFishCounts = { ...m.fish };
    for (const f of TANK_FISH)
      while (fishRoom(counts, f.species, everything).ok)
        counts = { ...counts, [f.species]: (counts[f.species] ?? 0) + 1 };
    expect(fishTotal(counts)).toBe(TANK_FISH_CAP);
    const room = fishRoom(counts, 'royal-gramma', everything);
    expect(room.ok).toBe(false);
    if (!room.ok && (counts['royal-gramma'] ?? 0) < 2)
      expect(room.reason).toMatch(/Return some/);
  });
  it('reads saved counts safely: clamped, capped, junk ignored, unseen kept for later', () => {
    const { counts, kept } = readFish(
      {
        'blue-green-chromis': 99,
        'royal-gramma': 1.5,
        'yellow-assessor': -2,
        'blue-tang': 2,
        'future-fish': 3,
        BAD: 4,
        'firefish-goby': '3',
      },
      nothing,
    );
    expect(counts).toEqual({ 'blue-green-chromis': 12 });
    expect(kept).toEqual({ 'blue-tang': 2, 'future-fish': 3 });
    for (const raw of [null, 7, 'x', [1, 2]])
      expect(readFish(raw, nothing).counts).toEqual({});
    const many = Object.fromEntries(TANK_FISH.map((f) => [f.species, f.max]));
    expect(fishTotal(readFish(many, everything).counts)).toBe(TANK_FISH_CAP);
  });
});

describe('Pass 051: saves (version 3) and migration', () => {
  const coral: TankItem = {
    id: 'tank-a',
    kind: 'boulder',
    position: { x: 9, y: 0, z: 8 },
    rotation: 0,
  };
  const rock: TankItem = {
    id: 'tank-b',
    kind: 'reef-rock',
    position: { x: -9, y: 0, z: 8 },
    rotation: 0,
  };
  it('saves and reloads fish with the decorations and visitors', () => {
    const s = store();
    const fish = { 'blue-green-chromis': 4, 'royal-gramma': 1 };
    expect(saveTank(s, [coral, rock], [TANK_BABIES[0].id], NO_KEPT, fish)).toBe(
      true,
    );
    expect((s.saved as { version: number }).version).toBe(3);
    expect(loadTankFish(s, everything)).toEqual(fish);
    expect(loadTankState(s, everything, context)).toEqual({
      items: [coral, rock],
      babies: [TANK_BABIES[0].id],
    });
  });
  it('migrates version 1 and 2 saves without losing anything (no fish yet)', () => {
    for (const old of [
      { version: 1, items: [coral] },
      { version: 2, items: [coral], babies: [TANK_BABIES[1].id] },
    ]) {
      const s = store(old);
      const state = loadTankState(s, everything, context);
      expect(state.items).toEqual([coral]);
      expect(loadTankFish(s, everything)).toEqual({});
      expect(
        saveTank(
          s,
          state.items,
          state.babies,
          keptEntries(s, state, everything),
          {},
        ),
      ).toBe(true);
      const saved = s.saved as {
        version: number;
        items: unknown[];
        babies: unknown[];
        fish: unknown;
      };
      expect(saved.version).toBe(3);
      expect(saved.items).toEqual([coral]);
      expect(saved.babies).toEqual(
        old.version === 2 ? [TANK_BABIES[1].id] : [],
      );
      expect(saved.fish).toEqual({});
    }
  });
  it('keeps fish it cannot offer this visit through an edit, and never overwrites a newer save', () => {
    const s = store({
      version: 3,
      items: [],
      babies: [],
      fish: { 'blue-tang': 2, 'blue-green-chromis': 3 },
    });
    const state = loadTankState(s, nothing, context);
    const fish = loadTankFish(s, nothing);
    expect(fish).toEqual({ 'blue-green-chromis': 3 });
    const kept = keptEntries(s, state, nothing);
    expect(saveTank(s, [], [], kept, { 'blue-green-chromis': 4 })).toBe(true);
    expect(loadTankFish(s, everything)).toEqual({
      'blue-tang': 2,
      'blue-green-chromis': 4,
    });
    const newer = { version: 4, items: [], fish: { x: 1 } };
    const n = store(newer);
    expect(
      saveTank(n, [], [], keptEntries(n, { items: [], babies: [] }), {}),
    ).toBe(false);
    expect(n.saved).toEqual(newer);
  });
});

describe('Pass 051: placement, turning and undo', () => {
  it('every decoration can be placed in open sand, with collision enclosing its size', () => {
    for (const d of TANK_ITEMS) {
      const item: TankItem = {
        id: 'tank-x',
        kind: d.kind,
        position: { x: 9, y: 0, z: 8 },
        rotation: 0,
      };
      expect(validPlacement(item, [], context), d.kind).toBe(true);
      const b = itemBounds(item);
      // Collision encloses the item (with a small margin).
      expect(b.max.y - b.min.y).toBeGreaterThanOrEqual(d.height);
      expect(b.max.y - b.min.y).toBeLessThan(d.height + 0.5);
    }
  });
  it('turns both ways in 30° steps and wraps', () => {
    const m = new TankCatalog([], context);
    m.begin('reef-rock', 'tank-r');
    m.turn(-1);
    expect(m.preview!.rotation).toBeCloseTo(Math.PI * 2 - TURN_STEP, 9);
    m.turn(1);
    m.turn(1);
    expect(m.preview!.rotation).toBeCloseTo(TURN_STEP, 9);
  });
  it('undoes placing, moving, removing, fish and visitors, in order, and reset clears it', () => {
    const m = new TankCatalog([], context);
    m.begin('stone', 'tank-s');
    m.aim({ x: 9, y: 0, z: 8 });
    expect(m.place()).toBe(true);
    m.move('tank-s');
    m.aim({ x: 8, y: 0, z: 8 });
    expect(m.place()).toBe(true);
    m.addFish('pajama-cardinalfish', nothing);
    expect(m.addBaby(TANK_BABIES[2].id, everything)).toBe(true);
    m.remove('tank-s');
    expect(m.items).toHaveLength(0);
    expect(m.undo()).toBe(true);
    expect(m.items[0].position.x).toBe(8);
    expect(m.undo()).toBe(true);
    expect(m.babies).toEqual([]);
    expect(m.undo()).toBe(true);
    expect(m.fish).toEqual({});
    expect(m.undo()).toBe(true);
    expect(m.items[0].position.x).toBe(9);
    expect(m.undo()).toBe(true);
    expect(m.items).toEqual([]);
    expect(m.undo()).toBe(false);
    // A cancelled move changes nothing and adds nothing to undo.
    m.begin('stone', 'tank-t');
    m.cancel();
    expect(m.canUndo).toBe(false);
    for (let i = 0; i < UNDO_DEPTH + 5; i++)
      if (!m.addFish('blue-green-chromis', nothing).ok)
        m.removeFish('blue-green-chromis');
    m.reset();
    expect(m.canUndo).toBe(false);
    expect(m.fish).toEqual({});
  });
});

describe('Pass 051: added fish are living fish that join the home schools', () => {
  it('the home fish move exactly as before, whatever is added', () => {
    const run = (withGuests: boolean) => {
      const home = new FishSimulation(
        spawnFish(habitat, FISH_SPECIES, FISH_TIMING.seed),
        habitat,
      );
      const guests = withGuests
        ? new FishSystem(
            habitat,
            guestSpecies({ 'blue-green-chromis': 6, 'royal-gramma': 2 }),
            51051,
            home.fish,
          )
        : undefined;
      for (let i = 0; i < 300; i++) {
        home.advance(1 / 30, true);
        guests?.update(1 / 30, true, false);
      }
      guests?.dispose();
      return home.fish.map((f) => [f.position.x, f.position.y, f.position.z]);
    };
    expect(run(true)).toEqual(run(false));
  });
  it('added chromis school with the home chromis, keep apart from everyone, and stay in the tank', () => {
    const home = new FishSimulation(
      spawnFish(habitat, FISH_SPECIES, FISH_TIMING.seed),
      habitat,
    );
    const guests = new FishSystem(
      habitat,
      guestSpecies({ 'blue-green-chromis': 8 }),
      51051,
      home.fish,
    );
    const ids = new Set(
      [...home.fish, ...guests.simulation.fish].map((f) => f.id),
    );
    expect(ids.size).toBe(home.fish.length + 8);
    let neighbours = 0;
    for (let i = 0; i < 30 * 40; i++) {
      home.advance(1 / 30, true);
      guests.update(1 / 30, true, false);
      if (i > 30 * 20)
        for (const f of guests.simulation.fish)
          neighbours += guests.simulation.schooling.forFish(f).neighbors;
    }
    expect(neighbours / (8 * 30 * 20)).toBeGreaterThan(1);
    const homeChromis = home.fish.filter(
      (f) => f.species.id === 'blue-green-chromis',
    );
    const centre = (list: typeof homeChromis) =>
      list
        .reduce(
          (c, f) =>
            c.add(new THREE.Vector3(f.position.x, f.position.y, f.position.z)),
          new THREE.Vector3(),
        )
        .divideScalar(list.length);
    // The added fish end up with the home school, not off on their own.
    expect(
      centre(guests.simulation.fish).distanceTo(centre(homeChromis)),
    ).toBeLessThan(4);
    for (const f of guests.simulation.fish) {
      for (const k of ['x', 'y', 'z'] as const) {
        expect(f.position[k]).toBeGreaterThan(AQUARIUM.min[k]);
        expect(f.position[k]).toBeLessThan(AQUARIUM.max[k]);
      }
      expect(Number.isFinite(f.velocity.x + f.velocity.y + f.velocity.z)).toBe(
        true,
      );
    }
    guests.dispose();
  });
});

describe('Pass 051: the added fish’s lifecycle', () => {
  const companions = spawnFish(habitat, FISH_SPECIES, FISH_TIMING.seed);
  it('builds the counted fish on authored rigs, rebuilds on change, and releases everything', async () => {
    const loader = new AssetLoader(async () => assetFixture());
    const fish = new TankFish(loader, habitat, companions);
    expect(fish.set({ 'blue-green-chromis': 3 })).toBe(true);
    expect(fish.bodies).toHaveLength(3);
    expect(await fish.ready).toBe(true);
    expect(loader.leased).toBe(3);
    expect(fish.root.children.length).toBeGreaterThan(0);
    // A change made while the previous rigs are still loading discards the stale load.
    fish.set({ 'blue-green-chromis': 5 });
    const stale = fish.ready;
    fish.set({ 'blue-green-chromis': 2 });
    expect(await stale).toBe(false);
    expect(await fish.ready).toBe(true);
    expect(loader.leased).toBe(2);
    expect(fish.bodies).toHaveLength(2);
    fish.set({});
    expect(fish.bodies).toHaveLength(0);
    expect(loader.leased).toBe(0);
    fish.set({ 'blue-green-chromis': 1 });
    await fish.ready;
    const parent = new THREE.Group();
    parent.add(fish.root);
    fish.dispose();
    fish.dispose();
    expect(loader.leased).toBe(0);
    expect(fish.root.parent).toBeNull();
    expect(fish.set({ 'blue-green-chromis': 1 })).toBe(false);
    loader.dispose();
  });
  it('falls back to simple fish if the rigs cannot load, and nothing is leased', async () => {
    const loader = new AssetLoader(async () => {
      throw Error('offline');
    });
    const fish = new TankFish(loader, habitat, companions);
    fish.set({ 'blue-green-chromis': 2 });
    expect(await fish.ready).toBe(false);
    expect(loader.leased).toBe(0);
    expect(fish.root.children).toHaveLength(1);
    fish.dispose();
    loader.dispose();
  });
});
