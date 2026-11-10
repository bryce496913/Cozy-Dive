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
/** Pass 019: v2 stores the slower swim-speed scale; v1 values are migrated on first load. */
export const SETTINGS_KEY = 'cozy-diver.settings.v2';
export const LEGACY_SETTINGS_KEY = 'cozy-diver.settings.v1';
/**
 * Pass 019 playtest: every swim speed is 20% slower than v1 (default 2.8 -> 2.24 m/s, maximum
 * 5 -> 4). The slider grid (0.08 m/s steps from 0.8) is exactly the old 0.1 grid scaled by 0.8.
 */
export const SWIM_SPEED = {
  min: 0.8,
  max: 4,
  step: 0.08,
  default: 2.24,
  legacyScale: 0.8,
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
    const legacy = store.getItem(LEGACY_SETTINGS_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy));
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  } catch {
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  }
}
/** v1 settings keep every preference; the swim speed keeps its place on the slower scale. */
function migrateLegacy(value: unknown): Settings {
  const data =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const speed =
    typeof data.speed === 'number' && Number.isFinite(data.speed)
      ? Number((data.speed * SWIM_SPEED.legacyScale).toFixed(4))
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
