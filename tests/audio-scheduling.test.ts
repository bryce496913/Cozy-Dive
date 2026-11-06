import { waterTexture } from '../src/audio/WaterTexture';
import { describe, expect, it } from 'vitest';
import { AudioEvents } from '../src/audio/AudioEvents';
import {
  AUDIO,
  ambientMix,
  spatialMix,
  volumeGain,
} from '../src/audio/AudioTuning';

describe('sparse environmental sound scheduling', () => {
  const collect = () => {
    const scheduler = new AudioEvents(9),
      events = [];
    for (let i = 0; i < 18000; i++) {
      const event = scheduler.advance(0.1, true);
      if (event) events.push({ ...event, time: (i + 1) / 10 });
    }
    return events;
  };
  it('is reproducible and leaves substantial quiet intervals for 30 minutes', () => {
    const events = collect();
    expect(events).toEqual(collect());
    expect(events.length).toBeGreaterThan(25);
    expect(events.length).toBeLessThan(65);
    expect(events[0].time).toBeGreaterThanOrEqual(22);
    expect(events[0].time).toBeLessThanOrEqual(42.1);
    events.forEach((e, i) => {
      expect(e.location).toBeGreaterThanOrEqual(0);
      expect(e.location).toBeLessThan(9);
      expect(e.duration).toBeGreaterThanOrEqual(1.6);
      expect(e.duration).toBeLessThanOrEqual(2.8);
      expect(e.strength).toBeGreaterThanOrEqual(0.65);
      expect(e.strength).toBeLessThanOrEqual(1);
      if (i) {
        expect(e.location).not.toBe(events[i - 1].location);
        expect(e.time - events[i - 1].time).toBeGreaterThanOrEqual(27.99);
        expect(e.time - events[i - 1].time).toBeLessThan(65.11);
      }
    });
  });
  it('freezes during pause, mute or hidden time, limits voices, and cannot catch up a large gap', () => {
    const a = new AudioEvents(3),
      b = new AudioEvents(3);
    for (let i = 0; i < 500; i++)
      expect(a.advance(3600, false)).toBeUndefined();
    expect(a.advance(3600, true)).toEqual(b.advance(0.1, true));
    for (let i = 0; i < 1000; i++)
      expect(a.advance(0.1, true, false)).toBeUndefined();
    a.resume();
    for (let i = 0; i < 119; i++) expect(a.advance(0.1, true)).toBeUndefined();
    expect(new AudioEvents(0).advance(0.1, true)).toBeUndefined();
  });
});
describe('bounded, smooth procedural parameters', () => {
  it('keeps filters, layer gains and stereo width comfortable throughout a long session', () => {
    const mix = {
      foundation: 0,
      cutoff: 0,
      current: 0,
      currentCutoff: 0,
      pan: 0,
    };
    let previous = { ...ambientMix(0, mix) };
    for (let t = 0; t < 1800; t += 0.5) {
      ambientMix(t, mix);
      expect(Object.values(mix).every(Number.isFinite)).toBe(true);
      expect(mix.foundation).toBeGreaterThan(0.22);
      expect(mix.foundation).toBeLessThan(0.26);
      expect(mix.current).toBeGreaterThan(0.011);
      expect(mix.current).toBeLessThan(0.025);
      expect(mix.cutoff).toBeGreaterThanOrEqual(315);
      expect(mix.cutoff).toBeLessThanOrEqual(365);
      expect(mix.currentCutoff).toBeGreaterThanOrEqual(240);
      expect(mix.currentCutoff).toBeLessThanOrEqual(280);
      expect(Math.abs(mix.pan)).toBeLessThanOrEqual(0.04);
      expect(Math.abs(mix.foundation - previous.foundation)).toBeLessThan(
        0.001,
      );
      expect(Math.abs(mix.cutoff - previous.cutoff)).toBeLessThan(1);
      previous = { ...mix };
    }
    expect(volumeGain(NaN)).toBe(0);
    expect(volumeGain(100)).toBe(AUDIO.masterCeiling);
    expect(volumeGain(0.3)).toBeLessThan(volumeGain(0.5));
  });
  it.each([false, true])(
    'uses deterministic finite, bounded liquid textures (detail=%s)',
    (detail) => {
      const noise = waterTexture(16000, 42, detail);
      expect(noise).toEqual(waterTexture(16000, 42, detail));
      expect(noise).not.toEqual(waterTexture(16000, 43, detail));
      expect(
        Math.abs(noise.reduce((a, b) => a + b, 0) / noise.length),
      ).toBeLessThan(0.02);
      expect(Math.max(...noise)).toBeLessThanOrEqual(0.701);
      expect(Math.min(...noise)).toBeGreaterThanOrEqual(-0.701);
    },
  );
  it('uses world-relative, restrained pan and gentle bounded distance attenuation', () => {
    const out = { pan: 0, gain: 0 },
      origin = { x: 0, y: 0, z: 0 };
    expect(spatialMix(origin, origin, 0, out)).toEqual({ pan: 0, gain: 1 });
    expect(spatialMix({ x: 10, y: 0, z: 0 }, origin, 0, out).pan).toBe(0.4);
    expect(spatialMix({ x: 10, y: 0, z: 0 }, origin, Math.PI, out).pan).toBe(
      -0.4,
    );
    let last = 1;
    for (let d = 0; d < 40; d += 0.25) {
      spatialMix({ x: d, y: 0, z: 0 }, origin, 0, out);
      expect(out.gain).toBeLessThanOrEqual(last);
      expect(out.gain).toBeGreaterThanOrEqual(0);
      expect(last - out.gain).toBeLessThan(0.03);
      last = out.gain;
    }
    expect(out.gain).toBe(0);
  });
});
