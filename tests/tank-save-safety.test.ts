import { describe, expect, it } from 'vitest';
import { TANK_BABIES } from '../src/config/babies';
import {
  KEPT_CAP,
  NO_KEPT,
  TANK_ITEMS,
  TANK_KEY,
  TankCatalog,
  keptEntries,
  loadTankState,
  saveTank,
  type TankItem,
} from '../src/catalog/catalog';

/**
 * v0.6 Pass 050 (v0.4/v0.5 acceptance): a save is never quietly emptied. Additions or babies the
 * tank cannot show this visit (not unlocked, no longer fitting) are written back unchanged, and a
 * save from a newer version is left alone.
 */
const everything = [
  ...TANK_ITEMS.map((i) => ({ id: i.sighting, first: '' })),
  ...TANK_BABIES.map((b) => ({ id: b.sighting, first: '' })),
];
const context = { keepOut: [], routes: [], surface: () => 0 };
const boulder: TankItem = {
  id: 'tank-a',
  kind: 'boulder',
  position: { x: 9, y: 0, z: 8 },
  rotation: 0,
};
const coral: TankItem = {
  id: 'tank-b',
  kind: TANK_ITEMS.find((i) => i.kind !== 'boulder')!.kind,
  position: { x: -9, y: 0, z: 8 },
  rotation: 0,
};
const babies = TANK_BABIES.map((b) => b.id);
function store(initial: unknown) {
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

describe('v0.4/v0.5 acceptance: saves are never quietly emptied', () => {
  it('keeps additions and babies that are not unlocked this visit, through an edit', () => {
    const s = store({ version: 2, items: [boulder, coral], babies });
    // The sightings were lost (cleared or corrupt): nothing can be shown.
    const loaded = loadTankState(s, [], context);
    expect(loaded).toEqual({ items: [], babies: [] });
    const kept = keptEntries(s, loaded);
    expect(kept.items).toEqual([boulder, coral]);
    expect(kept.babies).toEqual(babies);
    // An edit and save in this visit...
    expect(saveTank(s, [], [], kept)).toBe(true);
    // ...and once the sightings are back, the whole tank returns.
    expect(loadTankState(s, everything, context)).toEqual({
      items: [boulder, coral],
      babies,
    });
  });

  it('keeps only what was not loaded, and new additions come first without duplicates', () => {
    const boulderOnly = everything.filter(
      (e) =>
        e.id === TANK_ITEMS.find((i) => i.kind === 'boulder')!.sighting ||
        TANK_BABIES.some((b) => b.sighting === e.id),
    );
    const s = store({ version: 2, items: [boulder, coral], babies });
    const loaded = loadTankState(s, boulderOnly, context);
    expect(loaded.items).toEqual([boulder]);
    const kept = keptEntries(s, loaded);
    expect(kept.items).toEqual([coral]);
    expect(kept.babies).toEqual([]);
    const moved = { ...boulder, position: { x: 8, y: 0, z: 8 } };
    expect(saveTank(s, [moved], loaded.babies, kept)).toBe(true);
    expect(s.saved).toEqual({
      version: 3,
      fish: {},
      items: [moved, coral],
      babies,
    });
  });

  it('migrates a version 1 save the same way', () => {
    const s = store({ version: 1, items: [boulder, coral] });
    const loaded = loadTankState(s, [], context),
      kept = keptEntries(s, loaded);
    expect(kept.items).toEqual([boulder, coral]);
    expect(saveTank(s, [], [], kept)).toBe(true);
    expect((s.saved as { version: number }).version).toBe(3);
    expect(loadTankState(s, everything, context).items).toEqual([
      boulder,
      coral,
    ]);
  });

  it('never overwrites a save from a newer version', () => {
    const newer = { version: 4, items: [boulder], babies, fish: ['x'] };
    const s = store(newer);
    const loaded = loadTankState(s, everything, context),
      kept = keptEntries(s, loaded);
    expect(kept.newer).toBe(true);
    expect(saveTank(s, [coral], [], kept)).toBe(false);
    expect(s.saved).toEqual(newer);
  });

  it('ignores junk, keeps a bounded number, and tolerates broken storage', () => {
    const junk = [
      null,
      7,
      'tank-a',
      { id: 'not-a-tank-id' },
      { id: 'tank-UPPER' },
      { id: 'tank-a' },
      { id: 'tank-a' },
    ];
    const many = Array.from({ length: KEPT_CAP + 10 }, (_, i) => ({
      id: `tank-${i}`,
    }));
    const s = store({
      version: 2,
      items: [...junk, ...many],
      babies: ['nope', 3, babies[0], babies[0]],
    });
    const kept = keptEntries(s, { items: [], babies: [] });
    expect(kept.items[0]).toEqual({ id: 'tank-a' });
    expect(kept.items).toHaveLength(KEPT_CAP);
    expect(kept.babies).toEqual([babies[0]]);
    for (const raw of ['{', 'null', '[]', '{"version":"2"}'])
      expect(
        keptEntries(
          { getItem: () => raw, setItem: () => undefined },
          { items: [], babies: [] },
        ),
      ).toEqual(NO_KEPT);
    const broken = {
      getItem: (): string | null => {
        throw Error('blocked');
      },
      setItem: () => {
        throw Error('blocked');
      },
    };
    expect(keptEntries(broken, { items: [], babies: [] })).toEqual(NO_KEPT);
    expect(saveTank(broken, [boulder], [], NO_KEPT)).toBe(false);
  });

  it('restoring the tank clears additions and babies, and a reset model saves empty', () => {
    const s = store({ version: 2, items: [boulder], babies });
    const loaded = loadTankState(s, everything, context);
    const model = new TankCatalog(loaded.items, context, loaded.babies);
    model.reset();
    // The editor drops kept entries on restore, so nothing comes back.
    expect(saveTank(s, model.items, model.babies, NO_KEPT)).toBe(true);
    expect(loadTankState(s, everything, context)).toEqual({
      items: [],
      babies: [],
    });
  });
});
