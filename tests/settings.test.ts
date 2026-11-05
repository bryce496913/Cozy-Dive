import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
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
      speed: 5,
      sensitivity: 0.25,
      reducedMotion: true,
      swimmingFeel: 'natural',
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
        speed: 3.6,
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
    JSON.stringify({ speed: 3.2, sensitivity: 1.4, reducedMotion: true }),
  );
  expect(loadSettings(store)).toEqual({
    speed: 3.2,
    sensitivity: 1.4,
    reducedMotion: true,
    swimmingFeel: 'natural',
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
