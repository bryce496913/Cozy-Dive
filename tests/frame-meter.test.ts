import { describe, expect, it } from 'vitest';
import {
  FRAME_METER,
  FrameMeter,
  formatFrameSummary,
} from '../src/ui/frameMeter';
import {
  DEFAULT_SETTINGS,
  DIVE_HINT_KEY,
  loadDived,
  saveDived,
  validateSettings,
  type SettingsStore,
} from '../src/ui/settings';

describe('Pass 022 frame-time readout', () => {
  it('summarises steady frames twice a second', () => {
    const m = new FrameMeter();
    let summary = null;
    let summaries = 0;
    // A little over two seconds of frames (frame times do not sum exactly to 0.5 s).
    for (let i = 0; i < 126; i++) {
      const s = m.record(1000 / 60);
      if (s) {
        summaries++;
        summary = s;
      }
    }
    expect(summaries).toBe(4);
    expect(summary!.meanMs).toBeCloseTo(16.667, 2);
    expect(summary!.fps).toBeCloseTo(60, 6);
    expect(summary!.p95Ms).toBeCloseTo(16.667, 2);
    expect(formatFrameSummary(summary!)).toBe('16.7 ms · 60 fps · p95 16.7 ms');
  });
  it('exposes hitches in the 95th percentile that the mean hides', () => {
    const m = new FrameMeter();
    let last = null;
    for (let i = 0; i < FRAME_METER.window; i++)
      last = m.record(i % 10 === 0 ? 50 : 16) ?? last;
    expect(last!.meanMs).toBeLessThan(20);
    expect(last!.p95Ms).toBe(50);
  });
  it('ignores pauses and invalid intervals, keeps a bounded window, and resets', () => {
    const m = new FrameMeter();
    for (const bad of [0, -5, NaN, Infinity, 5000])
      expect(m.record(bad)).toBeNull();
    expect(m.summary).toBeNull();
    for (let i = 0; i < 1000; i++) m.record(i < 900 ? 100 : 10);
    // Only the last window (120 frames: 20 of 100 ms, then 100 of 10 ms) counts.
    expect(m.summary!.meanMs).toBeCloseTo((20 * 100 + 100 * 10) / 120, 6);
    m.reset();
    expect(m.summary).toBeNull();
  });
});

describe('Pass 022 preferences and the first-visit hint', () => {
  it('keeps the frame-time readout off by default and tolerates bad values', () => {
    expect(DEFAULT_SETTINGS.frameTime).toBe(false);
    expect(validateSettings({}).frameTime).toBe(false);
    expect(validateSettings({ frameTime: 'yes' }).frameTime).toBe(false);
    expect(validateSettings({ frameTime: true }).frameTime).toBe(true);
  });
  it('remembers the first dive, and treats absent, corrupt or unavailable storage as not yet', () => {
    const data = new Map<string, string>();
    const store: SettingsStore = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    };
    expect(loadDived(store)).toBe(false);
    expect(saveDived(store)).toBe(true);
    expect(loadDived(store)).toBe(true);
    data.set(DIVE_HINT_KEY, 'garbage');
    expect(loadDived(store)).toBe(false);
    const broken: SettingsStore = {
      getItem: () => {
        throw Error('denied');
      },
      setItem: () => {
        throw Error('denied');
      },
    };
    expect(loadDived(broken)).toBe(false);
    expect(saveDived(broken)).toBe(false);
  });
});
