import { describe, expect, it } from 'vitest';
import {
  CARDS_PER_PAGE,
  SPREADS,
  firstSpread,
  lastSpread,
  rememberSpread,
  sectionOf,
  turn,
} from '../src/collection/albumPages';
import { DESCRIPTIONS } from '../src/collection/descriptions';
import { ALBUM_SECTIONS, COLLECTION } from '../src/collection/registry';

/** V0.8 Pass 099: the field album's pages. */
describe('album pagination', () => {
  it('opens on a contents spread, then lays every entry out once, in slot order', () => {
    expect(SPREADS[0].kind).toBe('contents');
    const laid = SPREADS.flatMap((s) =>
      s.kind === 'habitat' ? [...s.left, ...s.right] : [],
    );
    expect(laid.map((e) => e.id)).toEqual(COLLECTION.map((e) => e.id));
    for (const s of SPREADS)
      if (s.kind === 'habitat') {
        expect(s.left.length).toBeLessThanOrEqual(CARDS_PER_PAGE);
        expect(s.right.length).toBeLessThanOrEqual(CARDS_PER_PAGE);
        // A spread never mixes habitats.
        for (const e of [...s.left, ...s.right])
          expect(e.section).toBe(s.section);
      }
  });

  it('starts each habitat on its own spread, reachable from its tab', () => {
    for (const section of ALBUM_SECTIONS) {
      const at = firstSpread(section),
        s = SPREADS[at];
      expect(
        s.kind === 'habitat' && s.section === section && s.part === 0,
      ).toBe(true);
      expect(sectionOf(at)).toBe(section);
    }
    // Deterministic: aquarium 1, outer reef 3, kelp 2, wreck 1, cave 2, Antarctic 3, contents 1.
    expect(SPREADS).toHaveLength(13);
  });

  it('turns without wrapping, and remembers the last page for the visit', () => {
    expect(turn(0, -1)).toBe(0);
    expect(turn(SPREADS.length - 1, 1)).toBe(SPREADS.length - 1);
    expect(turn(3, 1)).toBe(4);
    expect(lastSpread()).toBe(0);
    rememberSpread(5);
    expect(lastSpread()).toBe(5);
    rememberSpread(99);
    expect(lastSpread()).toBe(SPREADS.length - 1);
    rememberSpread(0);
  });

  it('has a short nature note for every card', () => {
    for (const e of COLLECTION) {
      const d = DESCRIPTIONS[e.id];
      expect(d, e.id).toBeTruthy();
      expect(d.length, e.id).toBeLessThan(140);
    }
    expect(Object.keys(DESCRIPTIONS).sort()).toEqual(
      COLLECTION.map((e) => e.id).sort(),
    );
  });
});
