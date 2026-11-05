import type { Vec3 } from '../config/world';
import type { FishSpecies } from './FishSpecies';

/** The single authoritative individual state; no Three.js dependency. Local forward is +X. */
export interface FishEntity {
  readonly id: number;
  readonly species: FishSpecies;
  readonly size: number;
  readonly radius: number;
  readonly speedFactor: number;
  readonly turnFactor: number;
  readonly temperament: number;
  position: Vec3;
  previousPosition: Vec3;
  velocity: Vec3;
  target: Vec3;
  yaw: number;
  previousYaw: number;
  pitch: number;
  previousPitch: number;
  speed: number;
  phase: number;
  previousPhase: number;
  bank: number;
  previousBank: number;
  targetTime: number;
  randomState: number;
  age: number;
  corrections: number;
}
export function randomFish(fish: FishEntity): number {
  fish.randomState = (Math.imul(fish.randomState, 1664525) + 1013904223) >>> 0;
  return fish.randomState / 4294967296;
}
export function angleDifference(to: number, from: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
