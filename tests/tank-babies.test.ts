import { Vector3 } from 'three';
import { describe, it, expect } from 'vitest';
import { TANK_BABIES } from '../src/config/babies';
import {
  TankCatalog,
  TANK_KEY,
  TANK_ITEMS,
  loadTankState,
  saveTank,
  unlockedBabies,
  itemCollider,
  validPlacement,
  type TankItem,
} from '../src/catalog/catalog';
import { TankBaby } from '../src/creatures/babies/TankBaby';
import { BabyNavigation } from '../src/creatures/babies/BabyNavigation';
import { boxCollider } from '../src/environment/passage/Crevice';
import { Aquarium } from '../src/environment/Aquarium';
import { tankContext } from '../src/catalog/TankContext';
import { TankBabyHabitat } from '../src/environment/TankBabyHabitat';
import { installAuthoredHulls } from '../validation/AuthoredCollision';
import { installReefHulls } from '../validation/ReefAsset';
import type { Vec3 } from '../src/config/world';
const seen = [
  ...TANK_ITEMS.map((i) => ({ id: i.sighting, first: '' })),
  ...TANK_BABIES.map((b) => ({ id: b.sighting, first: '' })),
];
const context = { keepOut: [], routes: [], surface: () => 0 };
const decoration: TankItem = {
  id: 'tank-a',
  kind: 'boulder',
  position: { x: 9, y: 0, z: 8 },
  rotation: 0,
};
const ids = TANK_BABIES.map((b) => b.id);
function store(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
}
const habitat = { solids: [], floor: () => 0 };
const eye = { x: 0, y: 4.6, z: 9 };
const pose = (b: TankBaby) => ({
  p: { ...b.position },
  v: { ...b.velocity },
  yaw: b.yaw,
  effort: b.effort,
  time: b.time,
  opacity: b.opacity,
  resting: b.resting,
  replans: b.replans,
});
describe('little visitors catalog and migration', () => {
  it('only offers discovered animals, independently of decorations and without duplicates', () => {
    expect(unlockedBabies([])).toEqual([]);
    const m = new TankCatalog(
      Array.from({ length: 20 }, () => decoration),
      context,
    );
    expect(m.addBaby(ids[0], [])).toBe(false);
    for (const id of ids) {
      expect(m.addBaby(id, seen)).toBe(true);
      expect(m.addBaby(id, seen)).toBe(false);
    }
    expect(m.babies).toEqual(ids);
    expect(m.items).toHaveLength(20);
    m.removeBaby(ids[1]);
    expect(m.babies).toEqual([ids[0], ids[2]]);
    m.reset();
    expect(m.babies).toEqual([]);
    expect(m.items).toEqual([]);
  });
  it('migrates version 1, preserves decorations, and saves both in version 2', () => {
    const s = store(
      JSON.stringify({ version: 1, items: [decoration], babies: ids }),
    );
    expect(loadTankState(s, seen, context)).toEqual({
      items: [decoration],
      babies: [],
    });
    expect(saveTank(s, [decoration], ids)).toBe(true);
    expect(JSON.parse(s.getItem()!).version).toBe(2);
    expect(loadTankState(s, seen, context)).toEqual({
      items: [decoration],
      babies: ids,
    });
    expect(loadTankState(s, [], context)).toEqual({ items: [], babies: [] });
  });
  it('independently validates partial, corrupt, duplicate and unavailable data', () => {
    for (const babies of [
      null,
      'shark',
      {},
      [null, 'unknown', ids[0], ids[0], ids[2]],
    ]) {
      const state = loadTankState(
        store(JSON.stringify({ version: 2, items: [decoration], babies })),
        seen,
        context,
      );
      expect(state.items).toEqual([decoration]);
      expect(state.babies).toEqual(
        Array.isArray(babies) ? [ids[0], ids[2]] : [],
      );
    }
    expect(
      loadTankState(
        store(JSON.stringify({ version: 2, items: 'bad', babies: ids })),
        seen,
        context,
      ),
    ).toEqual({ items: [], babies: ids });
    for (const raw of [
      '{',
      'null',
      JSON.stringify({ version: 99, items: [decoration], babies: ids }),
    ])
      expect(loadTankState(store(raw), seen, context)).toEqual({
        items: [],
        babies: [],
      });
    const broken = {
      getItem: () => {
        throw Error();
      },
      setItem: () => {
        throw Error();
      },
    };
    expect(loadTankState(broken, seen, context)).toEqual({
      items: [],
      babies: [],
    });
    expect(saveTank(broken, [], ids)).toBe(false);
    expect(TANK_KEY).toBe('cozy-diver.tank.v1');
  });
});
describe('pure body-aware navigation', () => {
  it('finds valid spawn points around solids, homes, floor and every glass edge', () => {
    const solid = boxCollider([-3, 0, -3], [3, 8, 3]);
    for (const d of TANK_BABIES) {
      const nav = new BabyNavigation(d, { solids: [solid], floor: () => 0.12 });
      for (const p of [
        { x: 0, y: 1, z: 0 },
        { x: 18, y: 14, z: 14 },
        { x: -18, y: -1, z: -14 },
        eye,
      ]) {
        const out = { x: 0, y: 0, z: 0 };
        expect(nav.nearest(p, out, p)).toBe(true);
        expect(nav.safe(out.x, out.y, out.z)).toBe(true);
        expect(
          Math.hypot(out.x - p.x, out.y - p.y, out.z - p.z),
        ).toBeGreaterThan(1.3 + d.radius);
      }
    }
  }, 20000);
  it('plans a swept detour and re-plans when a later addition blocks the path', () => {
    const solids = [boxCollider([-1, 0, -2], [1, 10, 2])],
      nav = new BabyNavigation(TANK_BABIES[0], { solids, floor: () => 0 });
    const from = { x: -5, y: 4.85, z: 0 },
      to = { x: 5, y: 4.85, z: 0 };
    expect(nav.clear(from, to)).toBe(false);
    expect(nav.route(from, to)).toBe(true);
    let previous: Vec3 = from;
    for (let i = 0; i < nav.length; i++) {
      const p = {
        x: nav.path[i * 3],
        y: nav.path[i * 3 + 1],
        z: nav.path[i * 3 + 2],
      };
      expect(nav.clear(previous, p)).toBe(true);
      previous = p;
    }
    const b = new TankBaby(TANK_BABIES[0], { solids, floor: () => 0 }, eye);
    for (let i = 0; i < 600; i++) b.update(1 / 30, true, false);
    const p = { ...b.position },
      before = b.replans;
    solids.push(boxCollider([-1, 0, 3], [1, 9, 5]));
    b.replan();
    expect(b.position).toEqual(p);
    expect(b.replans).toBeGreaterThan(before);
    let moved = 0;
    for (let i = 0; i < 6000; i++) {
      const x = b.position.x,
        z = b.position.z;
      b.update(1 / 30, true, false);
      expect(
        b.navigation.safe(
          b.position.x,
          b.position.y,
          b.position.z,
          b.halfHeight,
        ),
      ).toBe(true);
      moved += Math.hypot(b.position.x - x, b.position.z - z);
    }
    expect(moved).toBeGreaterThan(20);
  }, 20000);
  it('freezes every state on pause, fades on simulation time, and gives a waiting swimmer room', () => {
    const b = new TankBaby(TANK_BABIES[0], habitat, eye),
      control = new TankBaby(TANK_BABIES[0], habitat, eye);
    for (let i = 0; i < 120; i++) {
      b.update(1 / 30, true, false);
      control.update(1 / 30, true, false);
    }
    const paused = pose(b);
    for (let i = 0; i < 120; i++) b.update(1 / 30, false, true);
    expect(pose(b)).toEqual(paused);
    const p = { x: b.position.x + 1.3, y: b.position.y, z: b.position.z };
    const player = {
      position: p,
      velocity: { x: 0, y: 0, z: 0 },
      active: true,
    };
    let closest = Infinity;
    for (let i = 0; i < 1200; i++) {
      b.update(1 / 30, true, false, player);
      control.update(1 / 30, true, false);
      closest = Math.min(
        closest,
        Math.hypot(b.position.x - p.x, b.position.y - p.y, b.position.z - p.z),
      );
    }
    expect(closest).toBeGreaterThan(0.9);
    expect(b.position).not.toEqual(control.position);
    b.returning = true;
    for (let i = 0; i < 60; i++) b.update(1 / 30, true, false);
    expect(b.finished).toBe(true);
  });
  it('keeps all production hulls, homes, sand, additions and crevice clear for 30 minutes at 30/60/120 FPS', () => {
    const q = new Aquarium();
    try {
      installAuthoredHulls(q);
      installReefHulls(q);
      const c = tankContext(q),
        items: TankItem[] = [];
      for (let z = -8; z < 12 && items.length < 20; z += 1.8)
        for (let x = -15; x <= 15 && items.length < 20; x += 1.8) {
          const item: TankItem = {
            id: `tank-${items.length}`,
            kind: 'boulder',
            position: { x, y: c.surface(x, z), z },
            rotation: 0,
          };
          if (validPlacement(item, items, c)) items.push(item);
        }
      expect(items).toHaveLength(20);
      q.replacePresentationColliders([], items.map(itemCollider));
      const chest = q.ornaments.models.find((m) => m.kind === 'chest')!;
      const hinge = chest.hinge!.getWorldPosition(new Vector3());
      const h = new TankBabyHabitat(q, c),
        results: ReturnType<typeof pose>[][] = [];
      let rests = 0;
      for (const fps of [30, 60, 120]) {
        const animals = TANK_BABIES.map((d) => new TankBaby(d, h, eye));
        for (const baby of animals)
          expect(baby.navigation.safe(hinge.x, hinge.y + 1, hinge.z)).toBe(
            false,
          );
        for (let i = 0; i < 1800 * fps; i++)
          for (const b of animals) {
            b.update(1 / fps, true, false, undefined, animals);
            if (i % (fps / 30) === 0) {
              if (
                !b.navigation.safe(
                  b.position.x,
                  b.position.y,
                  b.position.z,
                  b.halfHeight,
                )
              )
                throw Error(`unsafe ${b.definition.id} at ${b.time}`);
              if (b.resting) rests++;
            }
          }
        results.push(animals.map(pose));
        for (const b of animals) {
          expect(b.time).toBeCloseTo(1800, 8);
          expect(b.replans).toBeGreaterThan(5);
        }
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
      expect(rests).toBeGreaterThan(0);
    } finally {
      q.dispose();
    }
  }, 20000);
});

it('keeps reduced-motion strokes smaller and excludes existing swimmers at spawn', () => {
  for (const d of TANK_BABIES) {
    const normal = new TankBaby(d, habitat, eye),
      reduced = new TankBaby(d, habitat, eye);
    let a = 0,
      b = 0;
    for (let i = 0; i < 300; i++) {
      normal.update(1 / 30, true, false);
      reduced.update(1 / 30, true, true);
      a = Math.max(a, Math.abs(normal.effort));
      b = Math.max(b, Math.abs(reduced.effort));
    }
    expect(b).toBeLessThanOrEqual(a * 0.401);
    const occupied = [
      { position: { x: 1.5, y: 4.85, z: 8.25 }, radius: 0.6 },
      { position: { x: 1.5, y: 4.85, z: 7.5 }, radius: 0.6 },
    ];
    const baby = new TankBaby(d, habitat, eye, occupied);
    for (const other of occupied)
      expect(
        Math.hypot(
          baby.position.x - other.position.x,
          baby.position.y - other.position.y,
          baby.position.z - other.position.z,
        ),
      ).toBeGreaterThanOrEqual(d.radius + other.radius + 0.25);
  }
});
