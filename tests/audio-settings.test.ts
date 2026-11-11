import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  validateSettings,
} from '../src/ui/settings';

describe('audio preferences in existing v1 storage', () => {
  it('migrates old data without resetting swimming choices', () => {
    const previous = {
      speed: 1.6,
      swimmingFeel: 'relaxed',
      sensitivity: 2,
      reducedMotion: true,
    };
    expect(
      loadSettings({ getItem: () => JSON.stringify(previous), setItem() {} }),
    ).toEqual({
      ...previous,
      audioEnabled: true,
      masterVolume: 0.3,
      frameTime: false,
    });
  });
  it('persists mute independently of the chosen volume', () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      audioEnabled: false,
      masterVolume: 0.68,
    };
    expect(saveSettings(store, settings)).toBe(true);
    expect(data.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(store)).toEqual(settings);
    saveSettings(store, { ...settings, audioEnabled: true });
    expect(loadSettings(store).masterVolume).toBe(0.68);
  });
  it('clamps finite volumes and rejects invalid audio fields', () => {
    expect(validateSettings({ masterVolume: -3 }).masterVolume).toBe(0);
    expect(validateSettings({ masterVolume: 3 }).masterVolume).toBe(1);
    for (const masterVolume of [NaN, Infinity, null, '0.5', {}])
      expect(validateSettings({ masterVolume, audioEnabled: 'false' })).toEqual(
        DEFAULT_SETTINGS,
      );
    expect(validateSettings({ reducedMotion: true }).audioEnabled).toBe(true);
  });
  it('recovers silently from malformed or unavailable storage', () => {
    expect(loadSettings({ getItem: () => '{', setItem() {} })).toEqual(
      DEFAULT_SETTINGS,
    );
    const store = {
      getItem() {
        throw Error('denied');
      },
      setItem() {
        throw Error('denied');
      },
    };
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(store, DEFAULT_SETTINGS)).toBe(false);
  });
});
