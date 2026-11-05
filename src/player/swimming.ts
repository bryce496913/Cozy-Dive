import {
  SWIMMING,
  SWIM_FEELS,
  type SwimmingFeel,
  type Bounds,
  type Vec3,
} from '../config/world';

const AXES = ['x', 'y', 'z'] as const;
const HORIZONTAL_AXES = ['x', 'z'] as const;

export interface SwimInput {
  forward: number;
  right: number;
  up: number;
}
export interface SwimState {
  position: Vec3;
  velocity: Vec3;
  strokeTime: number;
  breathingTime: number;
  neutralDepth: number;
  thrust: Vec3;
  moving: boolean;
  breathBlend: number;
  bodyPitch: number;
}
export interface SwimTuning {
  speed: number;
  feel: SwimmingFeel;
  reducedMotion: boolean;
}
export function createSwimState(position: Vec3): SwimState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    thrust: { x: 0, y: 0, z: 0 },
    strokeTime: 0,
    breathingTime: 0,
    neutralDepth: position.y,
    moving: false,
    breathBlend: 0,
    bodyPitch: 0,
  };
}
/** Freeze lifecycle state at the current depth; restart both rhythms gently. */
export function resetSwimming(state: SwimState): void {
  state.velocity.x = state.velocity.y = state.velocity.z = 0;
  state.thrust.x = state.thrust.y = state.thrust.z = 0;
  state.strokeTime = state.breathingTime = state.breathBlend = 0;
  state.neutralDepth = state.position.y;
  state.moving = false;
  // Preserve the visual pitch while paused; the next active step eases it smoothly.
}
/** C1 continuous pulse, zero throughout the passive portion; mean = active / 2. */
export function strokeEnvelope(phase: number, active: number): number {
  const wrapped = phase % 1;
  const t = wrapped < 0 ? wrapped + 1 : wrapped;
  return t < active ? Math.sin((Math.PI * t) / active) ** 2 : 0;
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

export function clampToBounds(
  state: Pick<SwimState, 'position' | 'velocity'>,
  bounds: Bounds,
): void {
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

/** Bounded midpoint force sampling and exact linear drag integration, no frame allocations. */
export function integrateSwimming(
  state: SwimState,
  direction: Vec3,
  dt: number,
  tuning: SwimTuning,
  bounds: Bounds,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, SWIMMING.maxFrameDelta);
  const feel = SWIM_FEELS[tuning.feel];
  const steps = Math.ceil(dt / SWIMMING.maxStep);
  const h = dt / steps;
  const moving = Math.hypot(direction.x, direction.z) > 0;
  if (moving && !state.moving) state.strokeTime = 0;
  state.moving = moving;
  const low = bounds.min.y + bounds.clearance;
  const high = bounds.max.y - bounds.clearance;
  for (let i = 0; i < steps; i++) {
    const phase = (state.strokeTime + h / 2) / feel.cycle;
    const pulse = moving ? strokeEnvelope(phase, feel.active) : 0;
    const force = moving
      ? 1 - feel.rhythm + (feel.rhythm * pulse * 2) / feel.active
      : 0;
    const blend = -Math.expm1(-feel.response * h);
    for (const axis of HORIZONTAL_AXES) {
      const target = direction[axis] * tuning.speed * feel.drag * force;
      // Releasing input cuts propulsion immediately; existing velocity still coasts.
      state.thrust[axis] = moving
        ? state.thrust[axis] + (target - state.thrust[axis]) * blend
        : 0;
      const decay = Math.exp(-feel.drag * h);
      const terminal = state.thrust[axis] / feel.drag;
      state.position[axis] +=
        terminal * h +
        ((state.velocity[axis] - terminal) * (1 - decay)) / feel.drag;
      state.velocity[axis] =
        terminal + (state.velocity[axis] - terminal) * decay;
      if (!moving && Math.abs(state.velocity[axis]) < SWIMMING.settleSpeed)
        state.velocity[axis] = 0;
    }
    const vertical = Math.abs(direction.y) > SWIMMING.verticalInputThreshold;
    state.breathBlend +=
      ((vertical || tuning.reducedMotion ? 0 : 1) - state.breathBlend) *
      -Math.expm1(-SWIMMING.breathingFade * h);
    const breathPhase =
      ((state.breathingTime + h / 2) * 2 * Math.PI) / SWIMMING.breathingCycle;
    // Fade breathing at the limits to avoid repeated contact or a clipped half-cycle drift.
    const margin = Math.max(
      0,
      Math.min(
        1,
        (state.neutralDepth - low) / SWIMMING.breathingBoundaryMargin,
        (high - state.neutralDepth) / SWIMMING.breathingBoundaryMargin,
      ),
    );
    const buoyancy =
      tuning.reducedMotion || vertical
        ? 0
        : feel.breathing * Math.sin(breathPhase) * state.breathBlend * margin;
    const forceY = vertical
      ? direction.y *
        tuning.speed *
        SWIMMING.verticalSpeed *
        SWIMMING.verticalDrag
      : SWIMMING.hoverSpring * (state.neutralDepth - state.position.y) +
        buoyancy;
    const decayY = Math.exp(-SWIMMING.verticalDrag * h);
    const terminalY = forceY / SWIMMING.verticalDrag;
    state.position.y +=
      terminalY * h +
      ((state.velocity.y - terminalY) * (1 - decayY)) / SWIMMING.verticalDrag;
    state.velocity.y = terminalY + (state.velocity.y - terminalY) * decayY;
    if (vertical)
      state.neutralDepth = Math.max(
        low,
        Math.min(
          high,
          state.position.y + state.velocity.y / SWIMMING.verticalDrag,
        ),
      );
    clampToBounds(state, bounds);
    state.neutralDepth = Math.max(low, Math.min(high, state.neutralDepth));
    state.bodyPitch +=
      ((tuning.reducedMotion ? 0 : pulse * SWIMMING.bodyPitch) -
        state.bodyPitch) *
      blend;
    state.strokeTime = (state.strokeTime + h) % feel.cycle;
    state.breathingTime = (state.breathingTime + h) % SWIMMING.breathingCycle;
  }
}
