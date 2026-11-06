import type { SwimmingFeel } from '../config/world';
export interface Settings {
  swimmingFeel: SwimmingFeel;
  sensitivity: number;
  speed: number;
  reducedMotion: boolean;
  audioEnabled: boolean;
  masterVolume: number;
}
export interface SettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const SETTINGS_KEY = 'cozy-diver.settings.v1';
export const DEFAULT_SETTINGS: Settings = {
  swimmingFeel: 'natural',
  sensitivity: 1,
  speed: 2.8,
  reducedMotion: false,
  audioEnabled: true,
  masterVolume: 0.3,
};
const numberInRange = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
export function validateSettings(value: unknown): Settings {
  const data =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    swimmingFeel:
      data.swimmingFeel === 'relaxed' || data.swimmingFeel === 'responsive'
        ? data.swimmingFeel
        : 'natural',
    sensitivity: numberInRange(
      data.sensitivity,
      0.25,
      2.5,
      DEFAULT_SETTINGS.sensitivity,
    ),
    speed: numberInRange(data.speed, 1, 5, DEFAULT_SETTINGS.speed),
    audioEnabled:
      typeof data.audioEnabled === 'boolean'
        ? data.audioEnabled
        : DEFAULT_SETTINGS.audioEnabled,
    masterVolume: numberInRange(
      data.masterVolume,
      0,
      1,
      DEFAULT_SETTINGS.masterVolume,
    ),
    reducedMotion:
      typeof data.reducedMotion === 'boolean'
        ? data.reducedMotion
        : DEFAULT_SETTINGS.reducedMotion,
  };
}
export function loadSettings(
  store: SettingsStore,
  prefersReducedMotion = false,
): Settings {
  try {
    const saved = store.getItem(SETTINGS_KEY);
    return saved
      ? validateSettings(JSON.parse(saved))
      : { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  } catch {
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  }
}
export function saveSettings(
  store: SettingsStore,
  settings: Settings,
): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(validateSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
