import type { Vec3 } from '../config/world';

export type FishActivity =
  | 'cruising'
  | 'exploring'
  | 'resting'
  | 'foraging'
  | 'observing'
  | 'recovering';
export interface BehaviorTuning {
  readonly interval: readonly [number, number];
  /** Exploring, resting, foraging, observing. Cruising fills the quiet intervals. */
  readonly weights: readonly [number, number, number, number];
  readonly duration: readonly [number, number];
  readonly restDuration: readonly [number, number];
  readonly restSpeed: number;
  readonly socialRetention: number;
  readonly recoverySeconds: number;
}
export interface FishBehavior {
  activity: FishActivity;
  elapsed: number;
  duration: number;
  cooldown: number;
  randomState: number;
  readonly initiative: number;
  readonly restPreference: number;
  readonly curiosity: number;
  readonly recovery: number;
  readonly target: Vec3;
  /** Blended intentions, never authoritative position or velocity. */
  weight: number;
  speed: number;
  social: number;
  gesture: number;
  previousGesture: number;
  arrived: boolean;
  arrivedTime: number;
  progressTime: number;
  bestDistance: number;
}
