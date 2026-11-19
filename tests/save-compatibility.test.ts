import { describe, expect, it } from 'vitest';
import { TANK_BABIES } from '../src/config/babies';
import {
  TANK_ITEMS,
  TANK_KEY,
  loadTankFish,
  loadTankState,
  type TankItem,
} from '../src/catalog/catalog';
import { loadJournal } from '../src/discovery/journal';
import { loadVisits } from '../src/creatures/wallVisitors';
import {
  DEFAULT_SETTINGS,
  DIVE_HINT_KEY,
  SETTINGS_KEY,
  loadDived,
  loadSettings,
} from '../src/ui/settings';
import { ONBOARDING_KEY, loadOnboarding } from '../src/ui/onboarding';
import { diagnostics, versioned } from '../src/config/release';

/**
 * v0.8 Pass 060 (public beta readiness): a player's whole saved profile, as earlier releases
 * wrote it, loads intact in this build. Each key is read on its own, so one damaged key never
 * costs the others. Fixtures are the formats those releases actually wrote.
 */
type Profile = Record<string, string>;
const storeOf = (profile: Profile) => ({
  getItem: (k: string) => profile[k] ?? null,
  setItem: (k: string, v: string) => {
    profile[k] = v;
  },
});
const boulder: TankItem = {
  id: 'tank-a',
  kind: 'boulder',
  position: { x: 9, y: 0, z: 8 },
  rotation: 0,
};
const context = { keepOut: [], routes: [], surface: () => 0 };
const boulderSight = TANK_ITEMS.find((i) => i.kind === 'boulder')!.sighting;
const baby = TANK_BABIES[0];

/** v0.4–v0.5 (tank format 2, settings v2): before fish could be added. */
const v05: Profile = {
  'cozy-diver.settings.v2': JSON.stringify({
    sensitivity: 1.4,
    speed: 2.4,
    reducedMotion: true,
    swimmingFeel: 'relaxed',
    audioEnabled: false,
    masterVolume: 0.5,
  }),
  [TANK_KEY]: JSON.stringify({
    version: 2,
    items: [boulder],
    babies: [baby.id],
  }),
  'cozy-diver.journal.v1': JSON.stringify({
    version: 1,
    seen: [
      { id: boulderSight, first: '2026-03-01T10:00:00Z' },
      { id: baby.sighting, first: '2026-03-02T10:00:00Z' },
    ],
  }),
  'cozy-diver.visits.v1': '4',
  [DIVE_HINT_KEY]: '1',
};
/** v0.6 rc.21 (tank format 3 with fish, settings v3 with comfort options, onboarding). */
const v06: Profile = {
  [SETTINGS_KEY]: JSON.stringify({
    ...DEFAULT_SETTINGS,
    sensitivity: 0.8,
    fieldOfView: 6,
    invertLook: true,
    graphics: 'lighter',
  }),
  [TANK_KEY]: JSON.stringify({
    version: 3,
    items: [boulder],
    babies: [],
    fish: { 'blue-tang': 2 },
  }),
  'cozy-diver.journal.v1': JSON.stringify({
    version: 1,
    seen: [
      { id: boulderSight, first: '2026-11-01T10:00:00Z' },
      { id: 'species:blue-tang', first: '2026-11-02T10:00:00Z' },
    ],
  }),
  [ONBOARDING_KEY]: JSON.stringify({
    visited: true,
    last: 'aquarium',
    swimHint: true,
  }),
};

describe('save compatibility across updates (Pass 060)', () => {
  it('loads a v0.5 profile: settings migrated, tank, babies, journal, visits, hint', () => {
    const s = storeOf({ ...v05 });
    const settings = loadSettings(s, false);
    expect(settings.sensitivity).toBe(1.4);
    expect(settings.reducedMotion).toBe(true);
    expect(settings.swimmingFeel).toBe('relaxed');
    expect(settings.audioEnabled).toBe(false);
    expect(settings.masterVolume).toBe(0.5);
    // v2 speeds are migrated onto the current scale, keeping their place on the slider.
    expect(settings.speed).toBeCloseTo(2.4 * 0.75, 4);
    // Options added since then take their defaults.
    expect(settings.fieldOfView).toBe(0);
    expect(settings.graphics).toBe('full');
    const seen = loadJournal(s);
    expect(seen.map((x) => x.id)).toEqual([boulderSight, baby.sighting]);
    expect(loadTankState(s, seen, context)).toEqual({
      items: [boulder],
      babies: [baby.id],
    });
    expect(loadTankFish(s, seen)).toEqual({});
    expect(loadVisits(s)).toBe(4);
    expect(loadDived(s)).toBe(true);
    // No onboarding key yet: greeted as a first visit, which is harmless.
    expect(loadOnboarding(s).visited).toBe(false);
  });
  it('loads a v0.6 profile unchanged', () => {
    const s = storeOf({ ...v06 });
    const settings = loadSettings(s, false);
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      sensitivity: 0.8,
      fieldOfView: 6,
      invertLook: true,
      graphics: 'lighter',
    });
    const seen = loadJournal(s);
    expect(loadTankState(s, seen, context).items).toEqual([boulder]);
    expect(loadTankFish(s, seen)).toEqual({ 'blue-tang': 2 });
    expect(loadOnboarding(s)).toEqual({
      visited: true,
      last: 'aquarium',
      swimHint: true,
    });
  });
  it('ignores fields a newer build might add, keeping everything it knows', () => {
    const s = storeOf({
      ...v06,
      [SETTINGS_KEY]: JSON.stringify({
        ...JSON.parse(v06[SETTINGS_KEY]),
        someFutureOption: 'yes',
      }),
      [ONBOARDING_KEY]: JSON.stringify({
        visited: true,
        last: 'office',
        swimHint: true,
        future: 1,
      }),
    });
    expect(loadSettings(s, false).fieldOfView).toBe(6);
    expect(loadOnboarding(s).last).toBe('office');
  });
  it('keeps every other key when one is damaged', () => {
    for (const broken of Object.keys(v06)) {
      const profile = { ...v06, [broken]: '{not json' },
        s = storeOf(profile),
        seen = loadJournal(s);
      if (broken !== SETTINGS_KEY)
        expect(loadSettings(s, false).fieldOfView).toBe(6);
      if (broken !== 'cozy-diver.journal.v1') expect(seen.length).toBe(2);
      if (broken !== TANK_KEY && broken !== 'cozy-diver.journal.v1')
        expect(loadTankFish(s, seen)).toEqual({ 'blue-tang': 2 });
      if (broken !== ONBOARDING_KEY)
        expect(loadOnboarding(s).visited).toBe(true);
    }
  });
});

describe('release details (Pass 060)', () => {
  it('stamps asset URLs with the version, so updates are fetched afresh', () => {
    expect(versioned('/assets/models/fish/chromis.glb', '0.8.0-beta.1')).toBe(
      '/assets/models/fish/chromis.glb?v=0.8.0-beta.1',
    );
    expect(versioned('/a.glb?x=1', '1.0')).toBe('/a.glb?x=1&v=1.0');
  });
  it('describes the browser and graphics only, and skips what it does not know', () => {
    const text = diagnostics({
      version: '0.8.0-beta.1',
      userAgent: 'TestBrowser/1',
      renderer: 'TestGPU',
      viewport: [1280, 800],
      pixelRatio: 2,
      frame: null,
    });
    expect(text).toBe(
      'Cozy Diver 0.8.0-beta.1\nBrowser: TestBrowser/1\nGraphics: TestGPU\nWindow: 1280×800 at 2×',
    );
  });
});
