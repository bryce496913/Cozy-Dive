import { describe, expect, it } from 'vitest';
import {
  ALBUM_SECTIONS,
  COLLECTION,
  albumPage,
  canAddToTank,
  collectionEntry,
  isDiscovered,
  sectionProgress,
} from '../src/collection/registry';
import { SIGHTS } from '../src/discovery/sights';
import {
  JOURNAL_KEY,
  loadJournal,
  type JournalStore,
  type Sighting,
} from '../src/discovery/journal';
import {
  TANK_ITEMS,
  unlockedBabies,
  unlockedItems,
} from '../src/catalog/catalog';
import { unlockedFish } from '../src/catalog/fishCatalog';
import { TANK_BABIES } from '../src/config/babies';
import { TANK_FISH } from '../src/config/tankFish';

/** V0.8 Pass 098: the unified collection registry and habitat progress. */

const seenOf = (...ids: string[]): Sighting[] =>
  ids.map((id) => ({ id, first: '2026-11-01T00:00:00.000Z' }));
const ALL_SEEN = seenOf(...SIGHTS.map((s) => s.id));

describe('collection registry: identities', () => {
  it('gives every discoverable animal exactly one slot, and nothing else a slot', () => {
    const ids = COLLECTION.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const animals = SIGHTS.map((s) => s.id).filter(
      (id) => id.startsWith('species:') || id.startsWith('coral:'),
    );
    for (const id of animals) expect(ids, id).toContain(id);
    // Places and plants stay in the journal, not the album.
    expect(
      ids.filter((id) => id.startsWith('place:') || id.startsWith('plant:')),
    ).toEqual([]);
    // Every slot is a real discovery: a journal sighting, or a home resident.
    for (const e of COLLECTION)
      expect(
        e.discovery === 'home' || SIGHTS.some((s) => s.id === e.id),
        e.id,
      ).toBe(true);
  });

  it('has deterministic pages and counts', () => {
    expect(
      Object.fromEntries(
        ALBUM_SECTIONS.map((s) => [s, sectionProgress(s, []).total]),
      ),
    ).toEqual({
      // V0.8 Pass 100: + the Pikachu nudibranch, leaf sheep and candy crab.
      aquarium: 12,
      // V0.8 Pass 101: + the harlequin shrimp, ghost pipefish, hairy frogfish and mimic octopus.
      'outer-reef': 30,
      'kelp-forest': 14,
      shipwreck: 1,
      'sea-cave': 14,
      antarctic: 32,
    });
    for (const s of ALBUM_SECTIONS) {
      const orders = COLLECTION.filter((e) => e.section === s).map(
        (e) => e.order,
      );
      expect(orders).toEqual(orders.map((_, i) => i));
    }
    // The first and last of each page are pinned, so a reorder is a deliberate change.
    expect(collectionEntry('species:blue-green-chromis')?.order).toBe(0);
    expect(collectionEntry('species:polar-bear')?.order).toBe(31);
  });

  it('places every multi-habitat animal once, on its primary page', () => {
    const multi = COLLECTION.filter((e) => e.alsoIn.length).map((e) => [
      e.id,
      e.section,
      e.alsoIn,
    ]);
    expect(multi).toEqual([
      ['species:moray-eel', 'aquarium', ['sea-cave']],
      ['species:octopus', 'outer-reef', ['sea-cave']],
      ['species:green-sea-turtle', 'outer-reef', ['shipwreck']],
      ['species:blacktip-reef-shark', 'outer-reef', ['shipwreck']],
      ['species:spotted-eagle-ray', 'outer-reef', ['shipwreck']],
      ['species:manta-ray', 'outer-reef', ['shipwreck']],
      ['species:glassy-sweeper', 'sea-cave', ['shipwreck']],
      ['species:whitetip-reef-shark', 'sea-cave', ['shipwreck']],
    ]);
  });

  it('keeps one canonical entry for each species the brief flagged, and no generic duplicates', () => {
    const named = (word: RegExp) =>
      COLLECTION.filter((e) => word.test(e.id) || word.test(e.name));
    expect(named(/spanish/i).map((e) => e.id)).toEqual([
      'species:spanish-shawl',
    ]);
    expect(named(/sea.angel/i).map((e) => e.id)).toEqual(['species:sea-angel']);
    expect(named(/isopod/i).map((e) => e.id)).toEqual(['species:giant-isopod']);
    // The tank's frogfish and (V0.8 Pass 101) the reef's hairy frogfish: two species, once each.
    expect(named(/frogfish/i).map((e) => e.id)).toEqual([
      'species:frogfish',
      'species:hairy-frogfish',
    ]);
    expect(named(/seahorse/i).map((e) => e.id)).toEqual(['species:seahorse']);
    expect(named(/octopus/i).map((e) => e.id)).toEqual([
      'species:octopus',
      'species:mimic-octopus',
    ]);
    // Nudibranchs: the tank's five are generic scenery; the named species are the Spanish shawl
    // and (V0.8 Pass 100) the Pikachu nudibranch, each once.
    expect(named(/nudibranch|spanish/i).map((e) => e.id)).toEqual([
      'species:pikachu-nudibranch',
      'species:spanish-shawl',
    ]);
    expect(named(/leaf.sheep/i).map((e) => e.id)).toEqual([
      'species:leaf-sheep',
    ]);
    expect(named(/candy.crab/i).map((e) => e.id)).toEqual([
      'species:candy-crab',
    ]);
  });

  it('gives every entry a model source, motion and (where it can join) a tank save key', () => {
    for (const e of COLLECTION) {
      expect(e.model, e.id).toBeTruthy();
      expect(e.motion, e.id).toBeTruthy();
      expect(e.name.length, e.id).toBeGreaterThan(2);
    }
    // Animals keep their own names (the tank's "pup" labels are its own).
    expect(collectionEntry('species:blacktip-reef-shark')?.name).toBe(
      'Blacktip reef shark',
    );
    expect(collectionEntry('species:polar-bear')?.rarity).toBe('rare');
    expect(collectionEntry('species:manta-ray')?.rarity).toBe('uncommon');
  });
});

describe('collection registry: discovery and the tank', () => {
  it('starts with only the aquarium residents discovered, and no other progress', () => {
    for (const s of ALBUM_SECTIONS) {
      const p = sectionProgress(s, []);
      // All nine aquarium residents, the moray included, live in the tank from the start.
      expect(p.discovered, s).toBe(s === 'aquarium' ? 9 : 0);
    }
  });

  it('populates the album straight from an existing journal (no migration)', () => {
    const data: Record<string, string> = {
        [JOURNAL_KEY]: JSON.stringify({
          version: 1,
          seen: [
            { id: 'species:bat-ray', first: '2026-02-01T00:00:00.000Z' },
            { id: 'coral:plate', first: '2026-01-01T00:00:00.000Z' },
            { id: 'plant:giant-kelp', first: '2026-01-02T00:00:00.000Z' },
            { id: 'place:sea-cave', first: '2026-01-03T00:00:00.000Z' },
            { id: 'species:moray-eel', first: '2026-03-01T00:00:00.000Z' },
            {
              id: 'species:from-the-future',
              first: '2027-01-01T00:00:00.000Z',
            },
          ],
        }),
      },
      store: JournalStore = {
        getItem: (k) => data[k] ?? null,
        setItem: (k, v) => {
          data[k] = v;
        },
      },
      before = data[JOURNAL_KEY],
      seen = loadJournal(store);
    expect(sectionProgress('kelp-forest', seen).discovered).toBe(1);
    expect(sectionProgress('outer-reef', seen).discovered).toBe(1);
    expect(sectionProgress('aquarium', seen).discovered).toBe(9);
    const bat = albumPage('kelp-forest', seen).find(
      (s) => s.kind === 'discovered',
    );
    expect(bat?.kind === 'discovered' && bat.first).toBe(
      '2026-02-01T00:00:00.000Z',
    );
    // Reading never writes: the journal (unknown ids included) is untouched.
    expect(data[JOURNAL_KEY]).toBe(before);
  });

  it('tells nothing about an unseen slot', () => {
    const page = albumPage('antarctic', []);
    expect(page).toHaveLength(32);
    for (const slot of page) {
      expect(slot.kind).toBe('mystery');
      expect(Object.keys(slot).sort()).toEqual(['kind', 'order']);
    }
  });

  it('allows a creature into the tank exactly as the tank catalog does, never from a mystery slot', () => {
    for (const seen of [
      [],
      seenOf('species:bat-ray', 'coral:plate'),
      ALL_SEEN,
    ]) {
      const babies = new Set(unlockedBabies(seen).map((b) => b.id)),
        fish = new Set(unlockedFish(seen).map((f) => f.species)),
        items = new Set(unlockedItems(seen).map((i) => i.kind));
      for (const e of COLLECTION) {
        const tank = e.tank,
          catalog = !tank
            ? false
            : tank.slot === 'animal'
              ? babies.has(tank.key)
              : tank.slot === 'fish'
                ? fish.has(tank.key)
                : tank.kinds.every((k) => items.has(k));
        expect(canAddToTank(e, seen), e.id).toBe(catalog);
        if (!isDiscovered(e, seen)) expect(canAddToTank(e, seen)).toBe(false);
      }
    }
  });

  it('refers to every existing tank animal, fish and sighted decoration (inhabitants intact)', () => {
    const keys = new Set<string>(
      COLLECTION.flatMap((e): readonly string[] =>
        !e.tank
          ? []
          : e.tank.slot === 'decoration'
            ? e.tank.kinds
            : [e.tank.key],
      ),
    );
    // Every tank animal except the plant-only ice algae is in the album.
    for (const b of TANK_BABIES)
      if (b.id !== 'ice-algae') expect(keys, b.id).toContain(b.id);
    for (const f of TANK_FISH.filter((f) => f.sighting))
      expect(keys, f.species).toContain(f.species);
    for (const i of TANK_ITEMS.filter((i) => i.sighting.startsWith('coral:')))
      expect(keys, i.kind).toContain(i.kind);
  });

  it('fills the whole album when everything has been seen', () => {
    for (const s of ALBUM_SECTIONS) {
      const p = sectionProgress(s, ALL_SEEN);
      expect(p.discovered, s).toBe(p.total);
    }
  });
});
