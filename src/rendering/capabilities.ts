/**
 * v0.6 Pass 056 (cross-browser): what this browser can do, found by trying each feature rather
 * than by browser name. Pure decisions over a small probe, so they can be tested without a browser.
 *
 *   - WebGL 2 is required (three.js draws with it). Without it there is nothing to show: a clear,
 *     calm message instead of an exception from deep inside the renderer.
 *   - Pointer lock is needed to look around with the mouse. Without it the world still loads
 *     behind the start screen, and the message says what is missing.
 *   - Web Audio is optional: without it Cozy Diver is simply silent (the audio systems already
 *     report this on their own).
 *   - Storage is optional: preferences and the tank then last for this visit only.
 */
export interface CapabilityProbe {
  webgl2(): boolean;
  pointerLock(): boolean;
  /** v0.6 Pass 058: a touch screen with no mouse or trackpad at all. */
  touchOnly(): boolean;
  audio(): boolean;
  storage(): boolean;
}
export interface Capabilities {
  webgl2: boolean;
  pointerLock: boolean;
  touchOnly: boolean;
  audio: boolean;
  storage: boolean;
}
/** Each probe that throws counts as unavailable. */
export function detectCapabilities(probe: CapabilityProbe): Capabilities {
  const safe = (test: () => boolean): boolean => {
    try {
      return test();
    } catch {
      return false;
    }
  };
  return {
    webgl2: safe(() => probe.webgl2()),
    pointerLock: safe(() => probe.pointerLock()),
    touchOnly: safe(() => probe.touchOnly()),
    audio: safe(() => probe.audio()),
    storage: safe(() => probe.storage()),
  };
}
export const CAPABILITY_MESSAGES = {
  webgl2:
    'This aquarium needs WebGL 2, which this browser has turned off or does not support. Try a current version of Chrome, Safari, Firefox or Edge, with hardware acceleration enabled.',
  pointerLock:
    'This browser cannot capture the mouse, which Cozy Diver needs for looking around. Try a current desktop version of Chrome, Safari, Firefox or Edge.',
  touch:
    'Cozy Diver needs a mouse or trackpad for now: touch controls are planned. On a tablet, connecting a mouse or trackpad works; otherwise, visit on a computer.',
} as const;
/** The message to show before entry, if any: fatal when nothing can be drawn. */
export function capabilityNotice(
  c: Capabilities,
): { message: string; fatal: boolean } | null {
  if (!c.webgl2) return { message: CAPABILITY_MESSAGES.webgl2, fatal: true };
  // A touch-only device: say so plainly (it is the reason, not the browser).
  if (c.touchOnly) return { message: CAPABILITY_MESSAGES.touch, fatal: false };
  if (!c.pointerLock)
    return { message: CAPABILITY_MESSAGES.pointerLock, fatal: false };
  return null;
}
/** The real browser's probe. The WebGL test context is released at once. */
export function browserProbe(): CapabilityProbe {
  return {
    webgl2: () => {
      const canvas = document.createElement('canvas'),
        gl = canvas.getContext('webgl2');
      if (!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    },
    pointerLock: () =>
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.requestPointerLock === 'function' &&
      'pointerLockElement' in document,
    touchOnly: () =>
      matchMedia('(any-pointer: coarse)').matches &&
      !matchMedia('(any-pointer: fine)').matches,
    audio: () => typeof globalThis.AudioContext === 'function',
    storage: () => {
      const key = 'cozy-diver.probe';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    },
  };
}
