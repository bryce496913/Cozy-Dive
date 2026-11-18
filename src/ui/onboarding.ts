import type { SettingsStore } from './settings';
import type { ExperienceMode } from './Interface';

/**
 * v0.6 Pass 054 (instant relaxation): what the start screen and the first swim need to know about
 * earlier visits. Local only, stored apart from preferences, and every read and write tolerates
 * absent, corrupt or unavailable storage (then the visit is simply treated as a first one).
 *
 *   - `visited`: the player has entered a space before, so the start screen greets them back;
 *   - `last`: the space they last entered, offered first next time;
 *   - `swimHint`: the one-time "how to change depth" hint has been shown or dismissed.
 */
export const ONBOARDING_KEY = 'cozy-diver.onboarding.v1';
export interface Onboarding {
  visited: boolean;
  last: ExperienceMode;
  swimHint: boolean;
}
export const FIRST_VISIT: Readonly<Onboarding> = {
  visited: false,
  last: 'office',
  swimHint: false,
};

export function parseOnboarding(raw: string | null): Onboarding {
  if (!raw) return { ...FIRST_VISIT };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...FIRST_VISIT };
    const record = data as Record<string, unknown>;
    return {
      visited: record.visited === true,
      last: record.last === 'aquarium' ? 'aquarium' : 'office',
      swimHint: record.swimHint === true,
    };
  } catch {
    return { ...FIRST_VISIT };
  }
}
export function loadOnboarding(store: SettingsStore): Onboarding {
  try {
    return parseOnboarding(store.getItem(ONBOARDING_KEY));
  } catch {
    return { ...FIRST_VISIT };
  }
}
export function saveOnboarding(
  store: SettingsStore,
  state: Onboarding,
): boolean {
  try {
    store.setItem(ONBOARDING_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** The start screen's wording and which choice comes first. */
export interface Welcome {
  eyebrow: string;
  title: string;
  intro: string;
  /** The choice offered first (focused, and the primary button). */
  primary: ExperienceMode;
  /** The start screen's small corner label (v0.6 Pass 057). */
  label: string;
}
export function welcomeFor(state: Onboarding): Welcome {
  return state.visited
    ? {
        eyebrow: 'WELCOME BACK',
        title: 'Back to the <em>water.</em>',
        intro: 'Everything is where you left it.<br>Pick up wherever you like.',
        primary: state.last,
        label: 'WELCOME BACK',
      }
    : {
        eyebrow: 'YOUR FIRST DIVE',
        title: 'Let the world<br>drift <em>away.</em>',
        intro:
          'A quiet room, a little tank, and a whole reef inside it.<br>No rush. No destination. Just you and the water.',
        primary: 'office',
        label: '01 / FIRST DIVE',
      };
}

/**
 * The first swim's hint: how long it waits after entering the water, how long it stays, and how
 * much swimming dismisses it early (seconds of held movement). Shown once, ever.
 */
export const SWIM_HINT = { delay: 1.5, shown: 9, swum: 2.5 } as const;
export interface SwimHint {
  /** Seconds in the water this visit (while not paused). */
  elapsed: number;
  /** Seconds spent actually swimming while it showed. */
  swum: number;
  done: boolean;
}
export function createSwimHint(seen: boolean): SwimHint {
  return { elapsed: 0, swum: 0, done: seen };
}
/**
 * Advance the hint by `dt` seconds; `moving` is whether the swimmer is giving movement input.
 * Returns whether it shows this frame. Once it has shown and gone, `done` stays true.
 */
export function stepSwimHint(
  hint: SwimHint,
  dt: number,
  moving: boolean,
): boolean {
  if (hint.done) return false;
  hint.elapsed += dt;
  if (hint.elapsed < SWIM_HINT.delay) return false;
  if (moving) hint.swum += dt;
  if (
    hint.elapsed >= SWIM_HINT.delay + SWIM_HINT.shown ||
    hint.swum >= SWIM_HINT.swum
  ) {
    hint.done = true;
    return false;
  }
  return true;
}
