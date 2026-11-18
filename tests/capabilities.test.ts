import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_MESSAGES,
  capabilityNotice,
  detectCapabilities,
  type CapabilityProbe,
} from '../src/rendering/capabilities';

const all: CapabilityProbe = {
  webgl2: () => true,
  pointerLock: () => true,
  touchOnly: () => false,
  audio: () => true,
  storage: () => true,
};

describe('browser capabilities (Pass 056)', () => {
  it('reports a full browser as capable, with nothing to say', () => {
    const c = detectCapabilities(all);
    expect(c).toEqual({
      webgl2: true,
      pointerLock: true,
      touchOnly: false,
      audio: true,
      storage: true,
    });
    expect(capabilityNotice(c)).toBeNull();
  });
  it('treats a probe that throws as unavailable', () => {
    const c = detectCapabilities({
      ...all,
      storage: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      audio: () => {
        throw new Error('no');
      },
    });
    expect(c.storage).toBe(false);
    expect(c.audio).toBe(false);
    expect(c.webgl2).toBe(true);
  });
  it('is fatal without WebGL 2, whatever else is missing', () => {
    const n = capabilityNotice(
      detectCapabilities({
        ...all,
        webgl2: () => false,
        pointerLock: () => false,
      }),
    );
    expect(n).toEqual({ message: CAPABILITY_MESSAGES.webgl2, fatal: true });
  });
  it('explains missing pointer lock without stopping the page', () => {
    const n = capabilityNotice(
      detectCapabilities({ ...all, pointerLock: () => false }),
    );
    expect(n).toEqual({
      message: CAPABILITY_MESSAGES.pointerLock,
      fatal: false,
    });
  });
  it('explains a touch-only device plainly (Pass 058)', () => {
    for (const pointerLock of [true, false])
      expect(
        capabilityNotice(
          detectCapabilities({
            ...all,
            touchOnly: () => true,
            pointerLock: () => pointerLock,
          }),
        ),
      ).toEqual({ message: CAPABILITY_MESSAGES.touch, fatal: false });
  });
  it('stays quiet about optional audio and storage', () => {
    expect(
      capabilityNotice(
        detectCapabilities({
          ...all,
          audio: () => false,
          storage: () => false,
        }),
      ),
    ).toBeNull();
  });
});
