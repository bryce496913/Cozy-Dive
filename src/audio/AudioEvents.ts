import { AUDIO } from './AudioTuning';
export interface WaterEvent {
  location: number;
  kind: 'bubbles' | 'water';
  duration: number;
  strength: number;
}
/** Active-time countdown: no wall-clock backlog and never more than one event per update. */
export class AudioEvents {
  private seed: number;
  private remaining: number;
  private last = -1;
  constructor(
    private readonly locations: number,
    seed = 55091,
  ) {
    this.seed = seed;
    this.remaining = this.range(...AUDIO.firstEvent);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private range(min: number, max: number): number {
    return min + (max - min) * this.random();
  }
  resume(): void {
    this.remaining = Math.max(this.remaining, AUDIO.resumeQuiet);
  }
  advance(
    dt: number,
    active: boolean,
    voiceFree = true,
  ): WaterEvent | undefined {
    if (!active || !this.locations || !Number.isFinite(dt) || dt <= 0) return;
    this.remaining -= Math.min(dt, 0.1);
    if (this.remaining > 0 || !voiceFree) return;
    this.remaining = this.range(...AUDIO.eventInterval);
    let location = Math.floor(
      this.random() *
        (this.locations - (this.last >= 0 && this.locations > 1 ? 1 : 0)),
    );
    if (this.locations > 1 && this.last >= 0 && location >= this.last)
      location++;
    this.last = location;
    return {
      location,
      kind: this.random() < 0.4 ? 'bubbles' : 'water',
      duration: this.range(1.6, 2.8),
      strength: this.range(0.65, 1),
    };
  }
}
