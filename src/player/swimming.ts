import { SWIMMING, type Bounds, type Vec3 } from '../config/world';

const AXES = ['x', 'y', 'z'] as const;

export interface SwimInput {
  forward: number;
  right: number;
  up: number;
}
export interface SwimState {
  position: Vec3;
  velocity: Vec3;
}
export interface SwimTuning {
  speed: number;
  acceleration: number;
  damping: number;
}

/** Camera forward is -Z; positive pitch looks up. Vertical keys stay world-aligned. */
export function movementDirection(
  input: SwimInput,
  yaw: number,
  pitch: number,
  out: Vec3,
): Vec3 {
  if (!input.forward && !input.right && !input.up) {
    out.x = out.y = out.z = 0;
    return out;
  }
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp * input.forward + Math.cos(yaw) * input.right;
  out.y = Math.sin(pitch) * input.forward + input.up;
  out.z = -Math.cos(yaw) * cp * input.forward - Math.sin(yaw) * input.right;
  const length = Math.hypot(out.x, out.y, out.z);
  if (length > 1) {
    out.x /= length;
    out.y /= length;
    out.z /= length;
  }
  return out;
}

export function clampToBounds(state: SwimState, bounds: Bounds): void {
  for (const axis of AXES) {
    const low = bounds.min[axis] + bounds.clearance;
    const high = bounds.max[axis] - bounds.clearance;
    state.position[axis] = Math.max(low, Math.min(high, state.position[axis]));
    if (
      (state.position[axis] === low && state.velocity[axis] < 0) ||
      (state.position[axis] === high && state.velocity[axis] > 0)
    )
      state.velocity[axis] = 0;
  }
}

/** Exact integration of dv/dt = rate * (target - v), stable at every frame rate. */
export function integrateSwimming(
  state: SwimState,
  direction: Vec3,
  dt: number,
  tuning: SwimTuning,
  bounds: Bounds,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, SWIMMING.maxFrameDelta);
  const moving = Math.hypot(direction.x, direction.y, direction.z) > 0;
  const rate = moving ? tuning.acceleration : tuning.damping;
  const decay = Math.exp(-rate * dt);
  for (const axis of AXES) {
    const target = direction[axis] * tuning.speed;
    state.position[axis] +=
      target * dt + ((state.velocity[axis] - target) * (1 - decay)) / rate;
    state.velocity[axis] = target + (state.velocity[axis] - target) * decay;
  }
  clampToBounds(state, bounds);
}
