const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Active time only; each seeded cycle lasts 25–45 seconds. No catch-up after pause. */
export class ChestClock {
  time = 0;
  cycle = 0;
  duration = 32;
  openings = 0;
  private seed = 8187;
  angleAt(time: number): number {
    if (time < 8) return 0;
    if (time < 12) return smooth((time - 8) / 4) * 1.12;
    if (time < 16) return 1.12;
    if (time < 21) return (1 - smooth((time - 16) / 5)) * 1.12;
    return 0;
  }
  get angle(): number {
    return this.angleAt(this.time);
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    blocked = false,
  ): boolean {
    if (!active || reduced || blocked || !Number.isFinite(dt) || dt <= 0)
      return false;
    const before = this.time;
    this.time += Math.min(dt, 0.1);
    const opened = before < 10 && this.time >= 10;
    if (opened) this.openings++;
    if (this.time >= this.duration) {
      this.time -= this.duration;
      this.cycle++;
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      this.duration = 25 + (this.seed / 4294967296) * 20;
    }
    return opened;
  }
}
