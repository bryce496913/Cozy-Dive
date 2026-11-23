import { describe, expect, it } from 'vitest';
import { SIGHTS } from '../src/discovery/sights';
import {
  JOURNAL_KEY,
  loadJournal,
  saveJournal,
  type JournalStore,
} from '../src/discovery/journal';
import { TANK_BABIES } from '../src/config/babies';
import { TANK_FISH } from '../src/config/tankFish';
import { CRUISE_SPECIES } from '../src/config/creatures';
import {
  TANK_ITEMS,
  keptEntries,
  NO_KEPT,
  TANK_KEY,
  type TankSave,
} from '../src/catalog/catalog';

/**
 * V0.8 collection-architecture audit (docs/V08_COLLECTION_ARCHITECTURE.md). These pin the facts
 * the unified collection is designed on, so a later pass cannot change an ID, add an unmapped
 * sighting or a new shared model without this audit being revisited.
 */

const EMPTY: TankSave = { items: [], babies: [] };
const memory = (init: Record<string, string> = {}): JournalStore => {
  const data = { ...init };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};

describe('collection audit: identities', () => {
  it('has one stable id per sighting, with the audited counts', () => {
    const ids = SIGHTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const prefix = (p: string) => ids.filter((i) => i.startsWith(p)).length;
    expect({
      species: prefix('species:'),
      coral: prefix('coral:'),
      plant: prefix('plant:'),
      place: prefix('place:'),
    }).toEqual({ species: 86, coral: 5, plant: 3, place: 5 }); // Pass 100: +3 rare minis
  });

  it('lets every species, coral and plant sighting unlock something in the tank', () => {
    const unlocks = new Set<string>([
      ...TANK_BABIES.map((b) => b.sighting),
      ...TANK_FISH.flatMap((f) => (f.sighting ? [f.sighting] : [])),
      ...TANK_ITEMS.flatMap((i) => (i.sighting ? [i.sighting] : [])),
    ]);
    const missing = SIGHTS.map((s) => s.id).filter(
      (id) => !id.startsWith('place:') && !unlocks.has(id),
    );
    expect(missing).toEqual([]);
    // And nothing in the tank unlocks by an id the journal cannot record.
    const known = new Set(SIGHTS.map((s) => s.id));
    expect([...unlocks].filter((id) => !known.has(id))).toEqual([]);
  });

  it('keys tank animals by their species id (the save key equals the sighting suffix)', () => {
    for (const b of TANK_BABIES)
      expect(b.sighting.split(':')[1], b.id).toBe(b.id);
  });

  it('records the giant isopod as the Antarctic animal (never to be repurposed)', () => {
    expect(SIGHTS.find((s) => s.id === 'species:giant-isopod')?.label).toBe(
      'Giant isopod',
    );
  });
});

describe('collection audit: shared models (type A, to be replaced by species models)', () => {
  it('still draws these identities from another species model', () => {
    const cruise = (id: keyof typeof CRUISE_SPECIES) =>
      CRUISE_SPECIES[id].asset;
    expect(cruise('bat-ray')).toBe(cruise('spotted-eagle-ray'));
    expect(cruise('great-hammerhead')).toBe(cruise('scalloped-hammerhead'));
    const baby = (id: string) => TANK_BABIES.find((b) => b.id === id)!;
    expect(baby('swell-shark').asset).toBe(baby('nurse-shark').asset);
    expect(baby('weddell-seal-pup').asset).toBe(baby('harbour-seal').asset);
    const fish = (id: string) => TANK_FISH.find((f) => f.species === id)!;
    expect(fish('queensland-grouper').asset).toBe(fish('giant-sea-bass').asset);
    const onChromis = TANK_FISH.filter(
      (f) => f.asset === 'chromis' && f.species !== 'blue-green-chromis',
    ).map((f) => f.species);
    expect(onChromis.sort()).toEqual(
      [
        'antarctic-silverfish',
        'blacksmith',
        'flashlight-fish',
        'garibaldi',
        'glassy-sweeper',
        'kelp-bass',
        'senorita',
        'soldierfish',
      ].sort(),
    );
    // V0.8 Pass 096: the cleaner wrasse is on its wild rig (the firefish's), in its wild blue.
    expect(fish('cleaner-wrasse').asset).toBe('firefish');
  });
});

describe('collection audit: save compatibility', () => {
  it('keeps journal entries this version does not know (a newer species survives a round trip)', () => {
    const store = memory({
      [JOURNAL_KEY]: JSON.stringify({
        version: 1,
        seen: [
          { id: 'species:bat-ray', first: '2026-01-01T00:00:00.000Z' },
          { id: 'species:not-yet-known', first: '2026-02-01T00:00:00.000Z' },
        ],
      }),
    });
    const seen = loadJournal(store);
    expect(seen.map((s) => s.id)).toContain('species:not-yet-known');
    saveJournal(store, seen);
    expect(loadJournal(store)).toEqual(seen);
  });

  it('refuses to overwrite a tank saved by a newer version', () => {
    const store = memory({
      [TANK_KEY]: JSON.stringify({ version: 99, items: [], babies: [] }),
    });
    const kept = keptEntries(store, EMPTY);
    expect(kept.newer).toBe(true);
    expect(NO_KEPT.newer).toBe(false);
  });

  it('documents the open risk: an unknown tank animal in a same-version save is not kept', () => {
    const store = memory({
      [TANK_KEY]: JSON.stringify({
        version: 3,
        items: [],
        babies: ['blacktip-reef-shark', 'future-rare-species'],
        fish: {},
      }),
    });
    const kept = keptEntries(store, EMPTY);
    expect(kept.babies).toContain('blacktip-reef-shark');
    // New animal kinds must ship with a tank-save version bump (see the report, section 6).
    expect(kept.babies).not.toContain('future-rare-species');
  });
});
