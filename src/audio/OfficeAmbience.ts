import type { Settings } from '../ui/settings';
import type { AudioStatus } from './AudioSystem';

/**
 * v0.3 Pass 020: the office's quiet soundscape, generated procedurally.
 *   - Rain on the window: a soft filtered noise wash with gentle swells, plus sparse droplet taps.
 *   - A distant clock: a muffled tick/tock once a second.
 *   - The aquarium: faint filter bubbling that rises as you walk towards the tank.
 * Gesture-unlocked like the underwater audio, follows the shared mute/volume settings, fades out
 * when paused or hidden, and schedules events ahead of time from `update` (no extra loop).
 */
export const OFFICE_AUDIO = {
  rainLevel: 0.11,
  dropletRate: 5,
  dropletLevel: 0.035,
  clockLevel: 0.028,
  bubbleLevel: 0.05,
  /** Bubbling is full within this distance of the tank (m) and falls off beyond. */
  bubbleNear: 0.9,
  lookahead: 0.25,
  fade: 0.6,
} as const;

/** Gain of the tank's bubbling at a listener distance (m): smooth, bounded, quiet far away. */
export function bubbleGain(distance: number): number {
  const d = Math.max(0, distance - OFFICE_AUDIO.bubbleNear);
  return OFFICE_AUDIO.bubbleLevel / (1 + d * d * 1.6);
}
/** Whole-second clock ticks in (from, to]; alternate ticks are the softer "tock". */
export function clockTicks(
  from: number,
  to: number,
): { time: number; tock: boolean }[] {
  const out: { time: number; tock: boolean }[] = [];
  for (let t = Math.floor(from) + 1; t <= to; t++)
    out.push({ time: t, tock: t % 2 === 1 });
  return out;
}

export interface OfficeAmbienceOptions {
  createContext?: () => AudioContext | undefined;
  onStatus?: (status: AudioStatus) => void;
}

export class OfficeAmbience {
  private context?: AudioContext;
  private master?: GainNode;
  private rain?: GainNode;
  private bubbles?: GainNode;
  private noise?: AudioBuffer;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private enabled = true;
  private volume = 0.3;
  private active = false;
  private visible = true;
  private failed = false;
  private disposed = false;
  private activated = false;
  private blocked = false;
  private resuming = false;
  private resumeAttempt = 0;
  private resumeTimer?: ReturnType<typeof setTimeout>;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private scheduled = 0;
  private seed = 2020;
  constructor(private readonly options: OfficeAmbienceOptions = {}) {}
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  /** Pass 022: share of the office soundscape during a dive's crossfade (1 otherwise). */
  private mix = 1;
  private get wanted(): boolean {
    return (
      this.activated &&
      this.active &&
      this.visible &&
      this.enabled &&
      this.volume > 0 &&
      !this.disposed &&
      !this.failed
    );
  }
  private get level(): number {
    return this.wanted ? this.volume * this.mix : 0;
  }
  /** Crossfade share (0..1); only reschedules the gain when it moves noticeably. */
  setMix(mix: number): void {
    const m = Math.round(Math.max(0, Math.min(1, mix)) * 20) / 20;
    if (m === this.mix) return;
    this.mix = m;
    this.reconcile();
  }
  /** Call from the Enter click or an explicit unmute. */
  unlockFromGesture(): void {
    if (
      this.disposed ||
      this.failed ||
      !this.enabled ||
      this.volume === 0 ||
      !this.visible
    )
      return;
    this.activated = true;
    if (!this.context) {
      try {
        this.context =
          this.options.createContext?.() ??
          (typeof globalThis.AudioContext === 'function'
            ? new AudioContext({ latencyHint: 'playback' })
            : undefined);
      } catch {
        this.context = undefined;
      }
      try {
        if (!this.context) throw Error('Office audio unavailable');
        this.build(this.context);
      } catch {
        this.unavailable();
        return;
      }
    }
    this.wake(true);
  }
  private build(c: AudioContext): void {
    const length = c.sampleRate * 2,
      buffer = c.createBuffer(1, length, c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
    this.noise = buffer;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    // Rain wash: band-limited noise with a slow swell.
    const wash = c.createBufferSource();
    wash.buffer = buffer;
    wash.loop = true;
    const high = c.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 900;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 5200;
    this.rain = c.createGain();
    this.rain.gain.value = OFFICE_AUDIO.rainLevel;
    const swell = c.createOscillator(),
      swellDepth = c.createGain();
    swell.frequency.value = 0.07;
    swellDepth.gain.value = OFFICE_AUDIO.rainLevel * 0.25;
    swell.connect(swellDepth).connect(this.rain.gain);
    wash.connect(high).connect(low).connect(this.rain).connect(this.master);
    // Aquarium bubbling: resonant noise, amplitude set by distance each frame.
    const fizz = c.createBufferSource();
    fizz.buffer = buffer;
    fizz.loop = true;
    fizz.playbackRate.value = 0.7;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 2.5;
    const wobble = c.createOscillator(),
      wobbleDepth = c.createGain();
    wobble.frequency.value = 3.3;
    wobbleDepth.gain.value = 500;
    wobble.connect(wobbleDepth).connect(band.frequency);
    this.bubbles = c.createGain();
    this.bubbles.gain.value = 0;
    fizz.connect(band).connect(this.bubbles).connect(this.master);
    for (const s of [wash, swell, fizz, wobble]) {
      s.start();
      this.sources.push(s);
    }
    this.scheduled = c.currentTime;
  }
  configure(settings: Pick<Settings, 'audioEnabled' | 'masterVolume'>): void {
    this.enabled = settings.audioEnabled;
    this.volume = settings.masterVolume;
    this.reconcile();
  }
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.reconcile();
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.reconcile(!visible);
  }
  private clearSuspend(): void {
    if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
    this.suspendTimer = undefined;
  }
  private clearResumeTimer(): void {
    if (this.resumeTimer !== undefined) clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
  }
  /** Keep user activation on the initial resume; reconcile again after asynchronous state changes. */
  private wake(gesture = false): void {
    const c = this.context;
    if (!c || this.disposed || (this.resuming && !gesture)) return;
    this.clearSuspend();
    this.clearResumeTimer();
    this.resuming = true;
    const attempt = ++this.resumeAttempt;
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      if (!this.disposed && this.wanted && c.state !== 'running') {
        this.blocked = true;
        this.options.onStatus?.('blocked');
      }
    }, 1500);
    const finish = (success: boolean) => {
      if (this.disposed || attempt !== this.resumeAttempt) return;
      this.clearResumeTimer();
      this.resuming = false;
      this.blocked = !success || c.state !== 'running';
      this.options.onStatus?.(this.blocked ? 'blocked' : 'ready');
      this.reconcile(!this.visible);
    };
    try {
      void c.resume().then(
        () => finish(true),
        () => finish(false),
      );
    } catch {
      finish(false);
    }
  }
  private suspend(): void {
    const c = this.context;
    if (!c || this.disposed || this.wanted || c.state === 'closed') return;
    try {
      void c.suspend().then(
        () => {
          if (!this.disposed && this.wanted) this.wake();
        },
        () => {
          if (!this.disposed) this.unavailable();
        },
      );
    } catch {
      this.unavailable();
    }
  }
  private reconcile(immediate = false): void {
    const c = this.context;
    if (!c || !this.master || this.disposed) return;
    try {
      this.clearSuspend();
      if (this.wanted && c.state !== 'running') {
        if (!this.blocked) this.wake();
        return;
      }
      this.master.gain.setTargetAtTime(
        this.level,
        c.currentTime,
        OFFICE_AUDIO.fade / 3,
      );
      this.scheduled = Math.max(this.scheduled, c.currentTime);
      if (!this.wanted) {
        if (immediate) this.suspend();
        else
          this.suspendTimer = setTimeout(() => {
            this.suspendTimer = undefined;
            this.suspend();
          }, OFFICE_AUDIO.fade * 1000);
      }
    } catch {
      this.unavailable();
    }
  }
  /** Schedule taps and ticks ahead and follow the listener's distance to the tank. */
  update(tankDistance: number): void {
    const c = this.context;
    if (
      !c ||
      c.state !== 'running' ||
      !this.noise ||
      !this.master ||
      this.level === 0
    )
      return;
    this.bubbles?.gain.setTargetAtTime(
      bubbleGain(tankDistance),
      c.currentTime,
      0.3,
    );
    const until = c.currentTime + OFFICE_AUDIO.lookahead;
    for (const { time, tock } of clockTicks(this.scheduled, until))
      this.click(
        time,
        tock ? 1350 : 1650,
        OFFICE_AUDIO.clockLevel * (tock ? 0.75 : 1),
        0.035,
        2200,
      );
    let t = this.scheduled;
    while (t < until) {
      t += -Math.log(1 - this.random()) / OFFICE_AUDIO.dropletRate || 0.2;
      if (t < until)
        this.click(
          t,
          2400 + this.random() * 2600,
          OFFICE_AUDIO.dropletLevel * (0.4 + this.random() * 0.6),
          0.02,
          7000,
        );
    }
    this.scheduled = until;
  }
  /** A short filtered noise tap. */
  private click(
    at: number,
    frequency: number,
    level: number,
    length: number,
    cutoff: number,
  ): void {
    const c = this.context!;
    const source = c.createBufferSource();
    source.buffer = this.noise!;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 6;
    const soften = c.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = cutoff;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(soften).connect(gain).connect(this.master!);
    source.start(at, this.random() * 1.5);
    source.stop(at + length + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      soften.disconnect();
      gain.disconnect();
    };
  }
  private unavailable(): void {
    this.failed = true;
    this.dispose();
    this.options.onStatus?.('unavailable');
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearSuspend();
    this.clearResumeTimer();
    for (const s of this.sources)
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    this.sources.length = 0;
    const c = this.context;
    this.context = undefined;
    void c?.close().catch(() => undefined);
  }
}
