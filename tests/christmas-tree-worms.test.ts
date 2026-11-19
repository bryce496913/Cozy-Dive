import { describe, expect, it } from 'vitest';
import {
  XMAS_WORMS,
  wormOpenness,
} from '../src/environment/outer/ChristmasTreeWorms';

describe('Christmas tree worms', () => {
  it('whisk in quickly when the swimmer comes close', () => {
    expect(wormOpenness(1, XMAS_WORMS.hide - 0.1, XMAS_WORMS.hideTime)).toBe(0);
  });
  it('unfurl slowly once left alone, and stay put in between', () => {
    const half = wormOpenness(
      0,
      XMAS_WORMS.emerge + 1,
      XMAS_WORMS.emergeTime / 2,
    );
    expect(half).toBeCloseTo(0.5, 5);
    const mid = (XMAS_WORMS.hide + XMAS_WORMS.emerge) / 2;
    expect(wormOpenness(0.3, mid, 1)).toBe(0.3);
    expect(wormOpenness(1, XMAS_WORMS.emerge + 1, 1)).toBe(1);
  });
});
