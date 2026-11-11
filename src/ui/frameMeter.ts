/**
 * v0.3 Pass 022: frame-time statistics for the optional readout. Records real frame intervals in
 * a fixed ring (no per-frame allocation) and summarises them twice a second: mean frame time,
 * frame rate and the 95th-percentile frame time (the occasional hitches a mean hides).
 */
export const FRAME_METER = {
  /** Frames kept (about two seconds at 60 fps). */
  window: 120,
  /** Seconds between summaries. */
  interval: 0.5,
  /** Intervals longer than this are pauses or hidden tabs, not frames (ms). */
  maxFrame: 1000,
} as const;
export interface FrameSummary {
  meanMs: number;
  fps: number;
  p95Ms: number;
}
export class FrameMeter {
  private readonly samples = new Float64Array(FRAME_METER.window);
  private readonly sorted = new Float64Array(FRAME_METER.window);
  private count = 0;
  private next = 0;
  private sinceSummary = 0;
  private latest: FrameSummary | null = null;
  /** Record one frame interval (ms). Returns a fresh summary when one is due, else null. */
  record(ms: number): FrameSummary | null {
    if (!Number.isFinite(ms) || ms <= 0 || ms > FRAME_METER.maxFrame)
      return null;
    this.samples[this.next] = ms;
    this.next = (this.next + 1) % FRAME_METER.window;
    this.count = Math.min(this.count + 1, FRAME_METER.window);
    this.sinceSummary += ms / 1000;
    if (this.sinceSummary < FRAME_METER.interval) return null;
    this.sinceSummary = 0;
    return this.summarise();
  }
  /** The most recent summary, if any. */
  get summary(): FrameSummary | null {
    return this.latest;
  }
  reset(): void {
    this.count = 0;
    this.next = 0;
    this.sinceSummary = 0;
    this.latest = null;
  }
  private summarise(): FrameSummary {
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      total += this.samples[i];
      this.sorted[i] = this.samples[i];
    }
    const view = this.sorted.subarray(0, this.count);
    view.sort();
    const meanMs = total / this.count,
      p95Ms = view[Math.min(this.count - 1, Math.ceil(this.count * 0.95) - 1)];
    this.latest = { meanMs, fps: 1000 / meanMs, p95Ms };
    return this.latest;
  }
}
/** The readout text, e.g. "16.7 ms · 60 fps · p95 18.2 ms". */
export function formatFrameSummary(s: FrameSummary): string {
  return `${s.meanMs.toFixed(1)} ms · ${Math.round(s.fps)} fps · p95 ${s.p95Ms.toFixed(1)} ms`;
}
