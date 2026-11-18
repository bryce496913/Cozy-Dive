import { describe, expect, it } from 'vitest';
import {
  PIXEL_RATIO_CAP,
  pixelRatioFor,
} from '../src/rendering/graphicsDetail';
import { DEFAULT_SETTINGS, validateSettings } from '../src/ui/settings';

describe('graphics detail (Pass 059)', () => {
  it('defaults to full detail, and keeps it unless lighter is chosen', () => {
    expect(DEFAULT_SETTINGS.graphics).toBe('full');
    expect(validateSettings({}).graphics).toBe('full');
    expect(validateSettings({ graphics: 'low' }).graphics).toBe('full');
    expect(validateSettings({ graphics: 'lighter' }).graphics).toBe('lighter');
  });
  it('keeps the full-detail cap as before (1.75) and lighter at 1', () => {
    expect(PIXEL_RATIO_CAP.full).toBe(1.75);
    expect(pixelRatioFor(2, 'full')).toBe(1.75);
    expect(pixelRatioFor(1.25, 'full')).toBe(1.25);
    expect(pixelRatioFor(2, 'lighter')).toBe(1);
    expect(pixelRatioFor(0.5, 'lighter')).toBe(0.5);
  });
  it('treats a missing or broken device pixel ratio as 1', () => {
    expect(pixelRatioFor(NaN, 'full')).toBe(1);
    expect(pixelRatioFor(0, 'full')).toBe(1);
  });
});
