import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  LEGACY_SETTINGS,
  SETTINGS_KEY,
  SWIM_SPEED,
  loadSettings,
  saveSettings,
  validateSettings,
  type SettingsStore,
} from '../src/ui/settings';

function memoryStore(): SettingsStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}
describe('settings', () => {
  it('has safe defaults and honors system reduced motion on first visit', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStore(), true).reducedMotion).toBe(true);
  });
  it.each([null, undefined, 'bad', [], 42])(
    'rejects invalid settings %s',
    (value) => {
      expect(validateSettings(value)).toEqual(DEFAULT_SETTINGS);
    },
  );
  it('clamps valid numeric values and rejects non-finite or wrong types', () => {
    expect(
      validateSettings({ speed: 100, sensitivity: -5, reducedMotion: true }),
    ).toEqual({
      speed: 3,
      sensitivity: 0.25,
      reducedMotion: true,
      swimmingFeel: 'natural',
      audioEnabled: true,
      masterVolume: 0.3,
    });
    expect(
      validateSettings({
        speed: NaN,
        sensitivity: Infinity,
        reducedMotion: 'false',
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ speed: '4', sensitivity: null })).toEqual(
      DEFAULT_SETTINGS,
    );
  });
  it('round trips preferences and preserves an explicit reduced-motion choice', () => {
    const store = memoryStore(),
      settings = {
        ...DEFAULT_SETTINGS,
        speed: 2.4,
        sensitivity: 1.25,
        reducedMotion: false,
      };
    expect(saveSettings(store, settings)).toBe(true);
    expect(loadSettings(store, true)).toEqual(settings);
  });
  it('recovers from corrupt JSON', () => {
    const store = memoryStore();
    store.setItem(SETTINGS_KEY, '{broken');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });
  it('works without storage permission', () => {
    const store: SettingsStore = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    expect(loadSettings(store, true)).toEqual({
      ...DEFAULT_SETTINGS,
      reducedMotion: true,
    });
    expect(saveSettings(store, DEFAULT_SETTINGS)).toBe(false);
  });
});

it('migrates old preferences and validates swimming feel', () => {
  const store = memoryStore();
  store.setItem(
    SETTINGS_KEY,
    JSON.stringify({ speed: 2.4, sensitivity: 1.4, reducedMotion: true }),
  );
  expect(loadSettings(store)).toEqual({
    speed: 2.4,
    sensitivity: 1.4,
    reducedMotion: true,
    swimmingFeel: 'natural',
    audioEnabled: true,
    masterVolume: 0.3,
  });
  for (const swimmingFeel of ['relaxed', 'natural', 'responsive'] as const) {
    expect(saveSettings(store, { ...DEFAULT_SETTINGS, swimmingFeel })).toBe(
      true,
    );
    expect(loadSettings(store).swimmingFeel).toBe(swimmingFeel);
  }
  for (const swimmingFeel of [null, 3, 'fast', {}, true])
    expect(validateSettings({ swimmingFeel }).swimmingFeel).toBe('natural');
});
it('swims at 60% of the v1 scale and migrates v1 and v2 saves onto it', () => {
  expect(DEFAULT_SETTINGS.speed).toBeCloseTo(2.8 * 0.6, 10);
  expect(SWIM_SPEED.max).toBeCloseTo(5 * 0.6, 10);
  const [v2, v1] = LEGACY_SETTINGS;
  // v1 (0.1 grid from 1 m/s) and v2 (0.08 grid from 0.8) land exactly on the 0.06 grid.
  for (const [legacy, old, expected] of [
    [v1, 1, 0.6],
    [v1, 2.8, 1.68],
    [v1, 5, 3],
    [v2, 0.8, 0.6],
    [v2, 2.24, 1.68],
    [v2, 4, 3],
  ] as const) {
    const store = memoryStore();
    store.setItem(
      legacy.key,
      JSON.stringify({ speed: old, sensitivity: 1.5, audioEnabled: false }),
    );
    const migrated = loadSettings(store);
    expect(migrated.speed).toBeCloseTo(expected, 10);
    const steps = (migrated.speed - SWIM_SPEED.min) / SWIM_SPEED.step;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
    expect(migrated.sensitivity).toBe(1.5);
    expect(migrated.audioEnabled).toBe(false);
  }
  // The newest legacy key wins, and a current save is never scaled again.
  const both = memoryStore();
  both.setItem(v1.key, JSON.stringify({ speed: 5 }));
  both.setItem(v2.key, JSON.stringify({ speed: 2 }));
  expect(loadSettings(both).speed).toBeCloseTo(1.5, 10);
  saveSettings(both, { ...DEFAULT_SETTINGS, speed: 2.4 });
  expect(loadSettings(both).speed).toBe(2.4);
  expect(both.getItem(SETTINGS_KEY)).not.toBeNull();
});
