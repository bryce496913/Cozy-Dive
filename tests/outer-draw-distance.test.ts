import { describe, expect, it } from 'vitest';
import { OUTER } from '../src/config/passage';
import { OUTER_DETAIL } from '../src/environment/outer/OuterReef';

/**
 * Playtest fix: nothing in the outer reef may appear or vanish where the murk still lets it be
 * seen. Exponential-squared fog lets through exp(-(density × distance)²) of an object's colour.
 */
const seen = (distance: number) => Math.exp(-((OUTER.fog * distance) ** 2));

describe('outer reef draw distance vs the murk', () => {
  it('keeps the murk as it was', () => {
    expect(OUTER.fog).toBe(0.13);
    expect(seen(14)).toBeLessThan(0.05);
  });
  it('changes nothing where the murk can still show it', () => {
    // At the hidden distance the haze lets through about 0.1% of a colour.
    expect(seen(OUTER_DETAIL.hidden)).toBeLessThan(0.002);
    for (const d of [
      OUTER_DETAIL.massive[1],
      OUTER_DETAIL.branching[1],
      OUTER_DETAIL.plate,
      OUTER_DETAIL.plant,
      OUTER_DETAIL.debris,
    ])
      expect(d).toBeGreaterThanOrEqual(OUTER_DETAIL.hidden);
  });
  it('keeps stand-ins drawn well beyond that, where nothing at all shows', () => {
    for (const d of [
      OUTER_DETAIL.drawn,
      OUTER_DETAIL.rock[2],
      OUTER_DETAIL.massive[2],
      OUTER_DETAIL.backdrop,
    ])
      expect(seen(d)).toBeLessThan(1e-4);
  });
  it('sets the camera’s far plane beyond the furthest drawn piece, with room for its size', () => {
    expect(OUTER.viewDistance).toBeGreaterThanOrEqual(
      OUTER_DETAIL.backdrop + 8,
    );
    expect(OUTER.viewDistance).toBeGreaterThanOrEqual(OUTER_DETAIL.drawn + 10);
  });
});
