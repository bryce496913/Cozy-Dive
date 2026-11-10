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
/**
 * Pass 019 playtests slowed swimming twice: v3 stores speeds at 60% of the v1 scale. Older saves
 * are migrated on first load, keeping their place on the slider.
 */
export const SETTINGS_KEY = 'cozy-diver.settings.v3';
/** Earlier keys, newest first, with the factor that maps their speed onto the current scale. */
export const LEGACY_SETTINGS = [
  { key: 'cozy-diver.settings.v2', speedScale: 0.75 },
  { key: 'cozy-diver.settings.v1', speedScale: 0.6 },
] as const;
/**
 * Default 2.8 -> 1.68 m/s and maximum 5 -> 3 m/s relative to v1. The slider grid (0.06 m/s
 * steps from 0.6) is exactly the original 0.1 grid from 1 m/s scaled by 0.6.
 */
export const SWIM_SPEED = {
  min: 0.6,
  max: 3,
  step: 0.06,
  default: 1.68,
} as const;
export const DEFAULT_SETTINGS: Settings = {
  swimmingFeel: 'natural',
  sensitivity: 1,
  speed: SWIM_SPEED.default,
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
    speed: numberInRange(
      data.speed,
      SWIM_SPEED.min,
      SWIM_SPEED.max,
      DEFAULT_SETTINGS.speed,
    ),
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
    if (saved) return validateSettings(JSON.parse(saved));
    for (const { key, speedScale } of LEGACY_SETTINGS) {
      const legacy = store.getItem(key);
      if (legacy) return migrateLegacy(JSON.parse(legacy), speedScale);
    }
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  } catch {
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  }
}
/** Older settings keep every preference; the swim speed keeps its place on the slower scale. */
function migrateLegacy(value: unknown, speedScale: number): Settings {
  const data =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const speed =
    typeof data.speed === 'number' && Number.isFinite(data.speed)
      ? Number((data.speed * speedScale).toFixed(4))
      : undefined;
  return validateSettings({ ...data, speed });
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
