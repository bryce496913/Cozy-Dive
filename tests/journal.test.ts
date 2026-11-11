import { describe, expect, it } from 'vitest';
import {
  JOURNAL_KEY,
  SIGHTING,
  SightingTracker,
  loadJournal,
  recordSighting,
  saveJournal,
  type JournalStore,
  type SightCandidate,
} from '../src/discovery/journal';

const memory = (): JournalStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};
const ray = (id: string, x: number, z: number): SightCandidate => ({
  id,
  label: id,
  position: { x, y: 0, z },
  radius: 1,
});
const eye = { x: 0, y: 0, z: 0 },
  ahead = { x: 0, y: 0, z: -1 };

describe('Pass 023 sightings journal', () => {
  it('saves and loads sightings, keeping the first date', () => {
    const store = memory();
    expect(loadJournal(store)).toEqual([]);
    let seen = recordSighting(
      [],
      'species:eagle-ray',
      new Date('2026-11-11T10:00:00Z'),
    );
    seen = recordSighting(
      seen,
      'species:eagle-ray',
      new Date('2026-12-01T10:00:00Z'),
    );
    expect(seen).toHaveLength(1);
    expect(saveJournal(store, seen)).toBe(true);
    expect(loadJournal(store)).toEqual([
      { id: 'species:eagle-ray', first: '2026-11-11T10:00:00.000Z' },
    ]);
  });
  it('tolerates absent, corrupt, partly bad and unavailable storage', () => {
    const store = memory();
    store.data.set(JOURNAL_KEY, '{not json');
    expect(loadJournal(store)).toEqual([]);
    store.data.set(JOURNAL_KEY, JSON.stringify({ seen: 'x' }));
    expect(loadJournal(store)).toEqual([]);
    store.data.set(
      JOURNAL_KEY,
      JSON.stringify({
        seen: [
          { id: 'species:turtle', first: '2026-11-11T00:00:00.000Z' },
          { id: 'BAD ID' },
          { id: 'species:turtle', first: '2027-01-01T00:00:00.000Z' },
          { id: 'feature:cliff', first: 'not a date' },
          null,
        ],
      }),
    );
    expect(loadJournal(store)).toEqual([
      { id: 'species:turtle', first: '2026-11-11T00:00:00.000Z' },
      { id: 'feature:cliff', first: new Date(0).toISOString() },
    ]);
    const broken: JournalStore = {
      getItem: () => {
        throw Error('denied');
      },
      setItem: () => {
        throw Error('denied');
      },
    };
    expect(loadJournal(broken)).toEqual([]);
    expect(saveJournal(broken, [])).toBe(false);
    expect(recordSighting([], 'Not Valid!', new Date())).toEqual([]);
  });
  it('counts something as seen only after it stays near and in view for a moment', () => {
    const t = new SightingTracker([]),
      near = ray('species:eagle-ray', 0, -4);
    let found = null,
      time = 0;
    while (!found && time < 5) {
      found = t.update([near], eye, ahead, 1 / 60);
      time += 1 / 60;
    }
    expect(found?.id).toBe('species:eagle-ray');
    expect(time).toBeCloseTo(SIGHTING.dwell, 1);
    // Reported once only.
    for (let i = 0; i < 300; i++)
      expect(t.update([near], eye, ahead, 1 / 60)).toBeNull();
    expect(t.has('species:eagle-ray')).toBe(true);
  });
  it('ignores things too far, behind, or only glimpsed, and skips what was already seen', () => {
    const far = ray('species:far', 0, -(SIGHTING.distance + 5)),
      behind = ray('species:behind', 0, 3),
      t = new SightingTracker([
        { id: 'species:known', first: new Date(0).toISOString() },
      ]),
      known = ray('species:known', 0, -3);
    for (let i = 0; i < 600; i++)
      expect(t.update([far, behind, known], eye, ahead, 1 / 60)).toBeNull();
    // Brief glances (half the dwell, then away) do not add up quickly.
    const glance = ray('species:glance', 0, -3),
      away = { x: 0, y: 0, z: 1 },
      g = new SightingTracker([]);
    let found = null;
    for (let k = 0; k < 4 && !found; k++) {
      for (let i = 0; i < 40; i++)
        found ??= g.update([glance], eye, ahead, 1 / 60);
      for (let i = 0; i < 120; i++)
        found ??= g.update([glance], eye, away, 1 / 60);
    }
    expect(found).toBeNull();
    expect(t.update([], eye, ahead, 0)).toBeNull();
  });
});
