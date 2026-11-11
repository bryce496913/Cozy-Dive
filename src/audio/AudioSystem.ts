import type { Vec3 } from '../config/world';
import type { SwimState, SwimTuning } from '../player/swimming';
import type { Settings } from '../ui/settings';
import { AudioEvents } from './AudioEvents';
import { AudioGraph } from './AudioGraph';
import { AUDIO, swimmingGain, unit, volumeGain } from './AudioTuning';

export type AudioStatus = 'ready' | 'blocked' | 'unavailable';
export interface AudioOptions {
  createContext?: () => AudioContext | undefined;
  onStatus?: (status: AudioStatus) => void;
}
const browserContext = (): AudioContext | undefined =>
  typeof globalThis.AudioContext === 'function'
    ? new AudioContext({ latencyHint: 'playback' })
    : undefined;

/** Application-owned, gesture-unlocked audio. No extra frame loop and no gameplay writes. */
export class AudioSystem {
  private context?: AudioContext;
  private graph?: AudioGraph;
  private readonly events: AudioEvents;
  private enabled = true;
  private volume = 0.3;
  private active = false;
  private visible = true;
  private activated = false;
  private failed = false;
  private disposed = false;
  private playing = false;
  private resuming = false;
  private resumeAttempt = 0;
  private resumeTimer?: ReturnType<typeof setTimeout>;
  private controlTime = 0;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private time = 0;
  private status: AudioStatus = 'ready';
  constructor(
    private readonly locations: readonly Readonly<Vec3>[],
    private readonly options: AudioOptions = {},
  ) {
    this.events = new AudioEvents(locations.length);
  }
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
  private report(status: AudioStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.options.onStatus?.(status);
  }
  /** Must be called synchronously from Enter or an explicit unmute click/key. */
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
        this.context = (this.options.createContext ?? browserContext)();
        if (!this.context) {
          this.unavailable();
          return;
        }
        this.graph = new AudioGraph(this.context);
      } catch {
        this.unavailable();
        return;
      }
    }
    // Calling resume here retains transient user activation; pointer-lock callbacks only open the gain gate.
    this.wake(true);
  }
  configure(settings: Pick<Settings, 'audioEnabled' | 'masterVolume'>): void {
    this.enabled = settings.audioEnabled;
    this.volume = unit(settings.masterVolume);
    this.reconcile();
  }
  /** Pass 022: share of the underwater soundscape during a dive's crossfade (1 otherwise). */
  private mix = 1;
  /** Crossfade share (0..1); only reschedules the gain when it moves noticeably. */
  setMix(mix: number): void {
    const m = Math.round(Math.max(0, Math.min(1, mix)) * 20) / 20;
    if (m === this.mix) return;
    this.mix = m;
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
  private wake(gesture = false): void {
    if (!this.context || (this.resuming && !gesture) || this.disposed) return;
    this.clearSuspend();
    this.clearResumeTimer();
    this.resuming = true;
    const attempt = ++this.resumeAttempt;
    // Some autoplay policies leave resume pending instead of rejecting it.
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      if (!this.disposed && this.wanted && this.context?.state !== 'running')
        this.report('blocked');
    }, 1500);
    const finish = (success: boolean): void => {
      if (attempt !== this.resumeAttempt || this.disposed) return;
      this.clearResumeTimer();
      this.resuming = false;
      if (!success || this.context?.state !== 'running') {
        this.report('blocked');
        return;
      }
      this.report('ready');
      this.reconcile(!this.visible);
    };
    try {
      void this.context.resume().then(
        () => finish(true),
        () => finish(false),
      );
    } catch {
      finish(false);
    }
  }
  private reconcile(immediate = false): void {
    if (!this.context || !this.graph || this.disposed) return;
    try {
      this.clearSuspend();
      if (this.wanted) {
        if (this.context.state !== 'running') {
          // A failed autoplay attempt waits for the next explicit user gesture, never a per-frame retry.
          if (this.status !== 'blocked') this.wake();
          return;
        }
        if (!this.playing) {
          this.graph.stopEvent();
          this.events.resume();
          this.playing = true;
        }
        this.graph.fade(volumeGain(this.volume) * this.mix, 0.3);
      } else {
        this.playing = false;
        this.graph.quietSwimming();
        this.graph.fade(0, AUDIO.fadeOut);
        if (immediate) this.suspend();
        else
          this.suspendTimer = setTimeout(() => {
            this.suspendTimer = undefined;
            this.suspend();
          }, AUDIO.suspendDelay);
      }
    } catch {
      this.unavailable();
    }
  }

  private suspend(): void {
    if (!this.context || this.disposed || this.wanted) return;
    try {
      void this.context.suspend().then(
        () => {
          if (this.disposed) return;
          try {
            this.graph?.stopEvent();
          } catch {
            this.unavailable();
            return;
          }
          // A rapid re-entry can race a pending suspend; restore the latest requested state.
          if (this.wanted) this.wake();
        },
        () => {
          if (!this.disposed) this.unavailable();
        },
      );
    } catch {
      this.unavailable();
    }
  }
  update(
    dt: number,
    state: Readonly<SwimState>,
    tuning: Readonly<SwimTuning>,
    yaw: number,
  ): void {
    if (
      !this.wanted ||
      !this.playing ||
      this.context?.state !== 'running' ||
      !this.graph ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    dt = Math.min(dt, 0.1);
    try {
      this.time += dt;
      this.controlTime += dt;
      if (this.controlTime >= 1 / 20) {
        this.controlTime %= 1 / 20;
        this.graph.update(
          this.time,
          swimmingGain(state, tuning),
          state.position,
          yaw,
        );
      }
      const event = this.events.advance(
        dt,
        true,
        this.graph.voices < AUDIO.maxVoices,
      );
      if (event)
        this.graph.play(
          event,
          this.locations[event.location],
          state.position,
          yaw,
        );
    } catch {
      this.unavailable();
    }
  }
  private unavailable(): void {
    this.clearResumeTimer();
    this.failed = true;
    this.playing = false;
    this.clearSuspend();
    this.releaseGraph();
    this.report('unavailable');
  }
  private releaseGraph(): void {
    const graph = this.graph;
    this.graph = undefined;
    try {
      graph?.dispose();
    } catch {
      /* Closing the context also releases a failed graph. */
    }
    this.close();
  }
  private close(): void {
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') {
      try {
        void context.close().catch(() => {});
      } catch {
        /* Audio failure must not affect the aquarium. */
      }
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.clearResumeTimer();
    this.disposed = true;
    this.playing = false;
    this.clearSuspend();
    this.releaseGraph();
  }
}
