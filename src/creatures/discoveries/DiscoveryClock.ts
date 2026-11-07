import { PlantClock } from '../../environment/PlantAnimation';
/** Fixed active-time state, smoothly sampled at render cadence; optional motion settles in place. */
export class DiscoveryClock {
  time = 0;
  previousTime = 0;
  readonly motion = new PlantClock();
  private previousMotion = 0;
  private accumulator = 0;
  get alpha(): number {
    return Math.max(0, Math.min(1, this.accumulator * 30));
  }
  get sample(): number {
    return (
      this.previousMotion +
      (this.motion.time - this.previousMotion) * this.alpha
    );
  }
  advance(dt: number, active: boolean, reduced: boolean): number {
    if (!active || !Number.isFinite(dt) || dt <= 0) return 0;
    this.accumulator += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accumulator + 1e-10 >= 1 / 30) {
      this.previousTime = this.time;
      this.time += 1 / 30;
      this.previousMotion = this.motion.time;
      this.motion.update(1 / 30, true, reduced);
      this.accumulator -= 1 / 30;
      steps++;
    }
    return steps / 30;
  }
}
