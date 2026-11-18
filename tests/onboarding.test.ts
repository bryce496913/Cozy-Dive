import { describe, expect, it } from 'vitest';
import {
  FIRST_VISIT,
  ONBOARDING_KEY,
  SWIM_HINT,
  createSwimHint,
  loadOnboarding,
  parseOnboarding,
  saveOnboarding,
  stepSwimHint,
  welcomeFor,
} from '../src/ui/onboarding';
import type { SettingsStore } from '../src/ui/settings';

class MemoryStore implements SettingsStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}
const broken: SettingsStore = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('onboarding state (Pass 054)', () => {
  it('treats absent, corrupt or unavailable storage as a first visit', () => {
    expect(parseOnboarding(null)).toEqual(FIRST_VISIT);
    expect(parseOnboarding('{not json')).toEqual(FIRST_VISIT);
    expect(parseOnboarding('42')).toEqual(FIRST_VISIT);
    expect(parseOnboarding('null')).toEqual(FIRST_VISIT);
    expect(
      parseOnboarding('{"visited":"yes","last":"moon","swimHint":1}'),
    ).toEqual(FIRST_VISIT);
    expect(loadOnboarding(broken)).toEqual(FIRST_VISIT);
    expect(saveOnboarding(broken, FIRST_VISIT)).toBe(false);
  });
  it('round-trips through storage under its own key', () => {
    const store = new MemoryStore();
    const state = { visited: true, last: 'aquarium' as const, swimHint: true };
    expect(saveOnboarding(store, state)).toBe(true);
    expect(store.data.has(ONBOARDING_KEY)).toBe(true);
    expect(loadOnboarding(store)).toEqual(state);
  });
  it('does not share the returned first-visit object', () => {
    const a = loadOnboarding(new MemoryStore());
    a.visited = true;
    expect(FIRST_VISIT.visited).toBe(false);
  });
});

describe('the start screen (Pass 054)', () => {
  it('welcomes a first visit with the office first', () => {
    const w = welcomeFor(FIRST_VISIT);
    expect(w.eyebrow).toBe('YOUR FIRST DIVE');
    expect(w.primary).toBe('office');
  });
  it('welcomes a returning visitor back to where they last went', () => {
    const w = welcomeFor({ visited: true, last: 'aquarium', swimHint: true });
    expect(w.eyebrow).toBe('WELCOME BACK');
    expect(w.primary).toBe('aquarium');
    expect(
      welcomeFor({ visited: true, last: 'office', swimHint: true }).primary,
    ).toBe('office');
  });
});

describe('the first-swim hint (Pass 054)', () => {
  it('never shows once seen', () => {
    const h = createSwimHint(true);
    for (let i = 0; i < 100; i++)
      expect(stepSwimHint(h, 0.1, false)).toBe(false);
  });
  it('waits, shows, then goes for good after its time', () => {
    const h = createSwimHint(false);
    expect(stepSwimHint(h, SWIM_HINT.delay - 0.1, false)).toBe(false);
    expect(stepSwimHint(h, 0.2, false)).toBe(true);
    let shown = 0;
    while (stepSwimHint(h, 0.1, false)) shown += 0.1;
    expect(shown).toBeGreaterThan(SWIM_HINT.shown - 0.5);
    expect(h.done).toBe(true);
    expect(stepSwimHint(h, 0.1, false)).toBe(false);
  });
  it('goes early once the swimmer has been swimming a while', () => {
    const h = createSwimHint(false);
    stepSwimHint(h, SWIM_HINT.delay, false);
    let t = 0;
    while (stepSwimHint(h, 1 / 60, true)) t += 1 / 60;
    expect(t).toBeLessThan(SWIM_HINT.swum + 0.05);
    expect(h.done).toBe(true);
  });
  it('is frame-rate independent', () => {
    const run = (dt: number): number => {
      const h = createSwimHint(false);
      let t = 0,
        shown = 0;
      while (!h.done && t < 30) {
        if (stepSwimHint(h, dt, false)) shown += dt;
        t += dt;
      }
      return shown;
    };
    expect(Math.abs(run(1 / 30) - run(1 / 144))).toBeLessThan(0.1);
  });
});
