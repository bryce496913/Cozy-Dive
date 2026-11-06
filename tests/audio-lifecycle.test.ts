import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSystem } from '../src/audio/AudioSystem';
import { AudioGraph } from '../src/audio/AudioGraph';
import { AUDIO } from '../src/audio/AudioTuning';
import { DEFAULT_SETTINGS } from '../src/ui/settings';
import { createSwimState } from '../src/player/swimming';
import { SPAWN } from '../src/config/world';
import { FakeContext } from './fixtures/audioContext';

const tuning = { speed: 2.8, feel: 'natural' as const, reducedMotion: false };
const locations = [
  { x: 4, y: 1, z: 3 },
  { x: -4, y: 1, z: -3 },
];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const context = new FakeContext(),
    createContext = vi.fn(() => context.api),
    onStatus = vi.fn();
  const audio = new AudioSystem(locations, { createContext, onStatus });
  return { context, audio, createContext, onStatus };
}
async function enter(audio: AudioSystem) {
  audio.unlockFromGesture();
  audio.setActive(true);
  await flush();
}

describe('gesture-gated audio ownership', () => {
  it('keeps preview silent and creates a single context only on a gesture', async () => {
    const { context, audio, createContext } = setup();
    audio.configure(DEFAULT_SETTINGS);
    for (let i = 0; i < 600; i++)
      audio.update(0.1, createSwimState(SPAWN), tuning, 0);
    expect(createContext).not.toHaveBeenCalled();
    audio.unlockFromGesture();
    expect(context.resume).toHaveBeenCalledTimes(1); // Invoked synchronously, before pointer-lock success.
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0);
    await flush();
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0);
    audio.setActive(true);
    await flush();
    expect(context.createGain.mock.results[0].value.gain.value).toBeGreaterThan(
      0,
    );
    for (let i = 0; i < 12; i++) {
      audio.setActive(false);
      await vi.advanceTimersByTimeAsync(AUDIO.suspendDelay + 1);
      expect(context.state).toBe('suspended');
      await enter(audio);
      expect(context.state).toBe('running');
    }
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    expect(context.createBuffer).toHaveBeenCalledTimes(2);
    audio.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fades mute/pause to zero, cancels delayed suspension on rapid resume, and retains volume', async () => {
    const { context, audio } = setup();
    await enter(audio);
    audio.configure({ audioEnabled: true, masterVolume: 0.65 });
    const master = context.createGain.mock.results[0].value;
    const level = master.gain.value;
    audio.configure({ audioEnabled: false, masterVolume: 0.65 });
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      0,
      AUDIO.fadeOut,
    );
    expect(context.suspend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    audio.configure({ audioEnabled: true, masterVolume: 0.65 });
    expect(master.gain.value).toBe(level);
    await vi.advanceTimersByTimeAsync(500);
    expect(context.suspend).not.toHaveBeenCalled();
    audio.configure({ audioEnabled: true, masterVolume: 0 });
    await vi.advanceTimersByTimeAsync(500);
    expect(context.state).toBe('suspended');
    audio.dispose();
  });
  it('suspends hidden tabs immediately and never schedules a backlog', async () => {
    const { context, audio } = setup();
    await enter(audio);
    audio.setVisible(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    await flush();
    const state = createSwimState(SPAWN);
    for (let i = 0; i < 10000; i++) audio.update(3600, state, tuning, 0);
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    audio.setVisible(true);
    await flush();
    audio.update(3600, state, tuning, 0);
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    audio.dispose();
  });
  it('resolves an in-flight suspend/re-entry race using the latest state', async () => {
    const { context, audio } = setup();
    await enter(audio);
    let complete!: () => void;
    context.suspend.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = () => {
            context.state = 'suspended';
            resolve();
          };
        }),
    );
    audio.setActive(false);
    await vi.advanceTimersByTimeAsync(500);
    await enter(audio);
    complete();
    await flush();
    await flush();
    expect(context.state).toBe('running');
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    audio.dispose();
  });
  it('stops and disconnects resources exactly once, even with a pending resume', async () => {
    const { context, audio } = setup();
    await enter(audio);
    audio.setActive(false);
    audio.dispose();
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    for (const { value: source } of context.createBufferSource.mock.results)
      expect(source.stop).toHaveBeenCalledTimes(1);
    for (const node of context.nodes)
      expect(node.disconnect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.suspend).not.toHaveBeenCalled();
    const next = setup();
    let done!: () => void;
    next.context.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          done = resolve;
        }),
    );
    next.audio.unlockFromGesture();
    next.audio.dispose();
    done();
    await flush();
    expect(next.context.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('supports browsers without audio and treats initialization failures as nonfatal', () => {
    vi.useFakeTimers();
    for (const createContext of [
      () => undefined,
      () => {
        throw Error('unsupported');
      },
    ]) {
      const onStatus = vi.fn(),
        audio = new AudioSystem(locations, { createContext, onStatus });
      expect(() => {
        audio.unlockFromGesture();
        audio.setActive(true);
        audio.update(0.1, createSwimState(SPAWN), tuning, 0);
        audio.dispose();
      }).not.toThrow();
      expect(onStatus).toHaveBeenCalledWith('unavailable');
    }
    const broken = setup();
    broken.context.createGain.mockImplementationOnce(() => {
      throw Error('allocation failed');
    });
    broken.audio.unlockFromGesture();
    expect(broken.context.close).toHaveBeenCalledTimes(1);
    broken.audio.dispose();
  });
  it('contains native audio update and suspension failures without affecting callers', async () => {
    const broken = setup();
    await enter(broken.audio);
    // A native graph failure is contained by the subsystem, not the application's frame loop.
    broken.context.createBiquadFilter.mock.results[1].value.frequency.setTargetAtTime.mockImplementationOnce(
      () => {
        throw Error('audio device lost');
      },
    );
    expect(() =>
      broken.audio.update(0.1, createSwimState(SPAWN), tuning, 0),
    ).not.toThrow();
    expect(broken.onStatus).toHaveBeenLastCalledWith('unavailable');
    expect(broken.context.close).toHaveBeenCalledTimes(1);
    broken.audio.dispose();
    const faded = setup();
    await enter(faded.audio);
    faded.context.createGain.mock.results[0].value.gain.setTargetAtTime.mockImplementationOnce(
      () => {
        throw Error('device lost');
      },
    );
    faded.context.createBufferSource.mock.results[0].value.stop.mockImplementationOnce(
      () => {
        throw Error('source already invalid');
      },
    );
    expect(() => faded.audio.setActive(false)).not.toThrow();
    expect(faded.context.close).toHaveBeenCalledTimes(1);
    faded.audio.dispose();
    const paused = setup();
    await enter(paused.audio);
    paused.context.suspend.mockRejectedValueOnce(Error('device lost'));
    paused.audio.setVisible(false);
    await flush();
    expect(paused.onStatus).toHaveBeenLastCalledWith('unavailable');
    paused.audio.dispose();
  });
  it('reports a pending autoplay request and allows another direct gesture to retry', async () => {
    const { context, audio, onStatus } = setup();
    context.resume.mockImplementationOnce(() => new Promise<void>(() => {}));
    await enter(audio);
    await vi.advanceTimersByTimeAsync(1600);
    expect(onStatus).toHaveBeenCalledWith('blocked');
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0);
    audio.unlockFromGesture();
    await flush();
    expect(context.state).toBe('running');
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    expect(onStatus).toHaveBeenLastCalledWith('ready');
    audio.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retries rejected resume only on a new gesture without recreating nodes', async () => {
    const { context, audio, onStatus } = setup();
    context.resume.mockRejectedValueOnce(Error('autoplay'));
    await enter(audio);
    expect(onStatus).toHaveBeenCalledWith('blocked');
    for (let i = 0; i < 100; i++)
      audio.update(0.1, createSwimState(SPAWN), tuning, 0);
    audio.configure(DEFAULT_SETTINGS);
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.unlockFromGesture();
    await flush();
    expect(context.state).toBe('running');
    expect(onStatus).toHaveBeenLastCalledWith('ready');
    expect(context.createBufferSource).toHaveBeenCalledTimes(3);
    audio.dispose();
  });
});

describe('environmental voice ownership', () => {
  it('caps overlapping voices, releases finished sources and reuses the two buffers', () => {
    const context = new FakeContext(),
      graph = new AudioGraph(context.api);
    const event = {
      location: 1,
      kind: 'bubbles' as const,
      duration: 2,
      strength: 0.9,
    };
    graph.play(event, locations[0], SPAWN, 0);
    const source = context.createBufferSource.mock.results[3].value;
    graph.play(event, locations[1], SPAWN, 0);
    expect(graph.voices).toBe(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(4);
    const params = context.createGain.mock.results.flatMap(
      ({ value }) => value.gain.setValueCurveAtTime.mock.calls,
    );
    expect(params).toHaveLength(1);
    const curve = params[0][0];
    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBeCloseTo(0);
    expect(Math.max(...curve)).toBeLessThanOrEqual(AUDIO.eventCeiling);
    source.onended?.();
    expect(graph.voices).toBe(0);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    graph.play({ ...event, kind: 'water' }, locations[1], SPAWN, Math.PI);
    expect(graph.voices).toBe(1);
    expect(context.createBuffer).toHaveBeenCalledTimes(2);
    graph.dispose();
    graph.dispose();
    expect(graph.voices).toBe(0);
    expect(
      context.createBufferSource.mock.results[4].value.stop,
    ).toHaveBeenCalledTimes(1);
  });
});
