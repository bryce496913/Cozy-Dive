import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeAmbience, OFFICE_AUDIO } from '../src/audio/OfficeAmbience';
import { DEFAULT_SETTINGS } from '../src/ui/settings';
import { FakeContext } from './fixtures/audioContext';

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
  const audio = new OfficeAmbience({ createContext, onStatus });
  return { context, audio, createContext, onStatus };
}
async function enter(audio: OfficeAmbience) {
  audio.unlockFromGesture();
  audio.setActive(true);
  await flush();
}

describe('office audio suspension and ownership', () => {
  it('keeps preview and muted entry silent; reuses one graph across repeated pauses', async () => {
    const { audio, context, createContext } = setup();
    audio.configure({ ...DEFAULT_SETTINGS, audioEnabled: false });
    audio.unlockFromGesture();
    expect(createContext).not.toHaveBeenCalled();
    audio.configure(DEFAULT_SETTINGS);
    audio.setActive(true);
    expect(createContext).not.toHaveBeenCalled();
    await enter(audio);
    expect(context.state).toBe('running');
    for (let i = 0; i < 4; i++) {
      audio.setActive(false);
      await vi.advanceTimersByTimeAsync(OFFICE_AUDIO.fade * 1000 + 1);
      expect(context.state).toBe('suspended');
      await enter(audio);
      expect(context.state).toBe('running');
    }
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fades pause/mute/zero volume and cancels suspension if wanted again before the fade ends', async () => {
    const { audio, context } = setup();
    await enter(audio);
    const master = context.createGain.mock.results[0].value;
    for (const quiet of [
      () => audio.setActive(false),
      () => audio.configure({ ...DEFAULT_SETTINGS, audioEnabled: false }),
      () => audio.configure({ ...DEFAULT_SETTINGS, masterVolume: 0 }),
    ]) {
      quiet();
      expect(master.gain.value).toBe(0);
      expect(context.state).toBe('running');
      await vi.advanceTimersByTimeAsync(OFFICE_AUDIO.fade * 1000 + 1);
      expect(context.state).toBe('suspended');
      audio.configure(DEFAULT_SETTINGS);
      audio.setActive(true);
      await flush();
      expect(context.state).toBe('running');
    }
    const suspends = context.suspend.mock.calls.length;
    audio.setActive(false);
    await vi.advanceTimersByTimeAsync(100);
    audio.setActive(true);
    await vi.advanceTimersByTimeAsync(OFFICE_AUDIO.fade * 1000 + 1);
    expect(context.suspend).toHaveBeenCalledTimes(suspends);
    audio.setMix(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.state).toBe('running'); // Keep a gesture-unlocked destination ready during a crossfade.
    audio.dispose();
  });
  it('suspends hidden tabs immediately and resumes only while audible', async () => {
    const { audio, context } = setup();
    await enter(audio);
    audio.setVisible(false);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    await flush();
    expect(context.state).toBe('suspended');
    for (let i = 0; i < 50; i++) audio.update(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
    audio.setVisible(true);
    await flush();
    expect(context.state).toBe('running');
    audio.setActive(false);
    audio.setVisible(false);
    await flush();
    audio.setVisible(true);
    await flush();
    expect(context.state).toBe('suspended');
    audio.dispose();
  });
  it('restores the latest wanted state after an asynchronous suspend/re-entry race', async () => {
    const { audio, context } = setup();
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
    await vi.advanceTimersByTimeAsync(OFFICE_AUDIO.fade * 1000 + 1);
    await enter(audio);
    complete();
    await flush();
    await flush();
    expect(context.state).toBe('running');
    audio.dispose();
  });
  it('re-suspends a delayed resume after hiding and clears pending lifecycle work on disposal', async () => {
    const { audio, context } = setup();
    let complete!: () => void;
    context.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = () => {
            context.state = 'running';
            resolve();
          };
        }),
    );
    audio.unlockFromGesture();
    audio.setActive(true);
    audio.setVisible(false);
    await flush();
    complete();
    await flush();
    await flush();
    expect(context.state).toBe('suspended');
    audio.setVisible(true);
    await flush();
    audio.setActive(false);
    audio.dispose();
    audio.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    for (const { value: s } of [
      ...context.createBufferSource.mock.results,
      ...context.createOscillator.mock.results,
    ])
      expect(s.stop).toHaveBeenCalledTimes(1);
  });
  it('contains initialization, autoplay and suspension failures', async () => {
    const broken = setup();
    broken.context.createGain.mockImplementationOnce(() => {
      throw Error('device lost');
    });
    expect(() => broken.audio.unlockFromGesture()).not.toThrow();
    expect(broken.onStatus).toHaveBeenCalledWith('unavailable');
    expect(broken.context.close).toHaveBeenCalledTimes(1);
    const blocked = setup();
    blocked.context.resume.mockRejectedValueOnce(Error('autoplay'));
    await enter(blocked.audio);
    expect(blocked.onStatus).toHaveBeenCalledWith('blocked');
    const attempts = blocked.context.resume.mock.calls.length;
    blocked.audio.setMix(0.5);
    expect(blocked.context.resume).toHaveBeenCalledTimes(attempts);
    await enter(blocked.audio);
    expect(blocked.context.state).toBe('running');
    blocked.context.suspend.mockRejectedValueOnce(Error('device lost'));
    blocked.audio.setVisible(false);
    await flush();
    expect(blocked.onStatus).toHaveBeenCalledWith('unavailable');
    blocked.audio.dispose();
  });
});
