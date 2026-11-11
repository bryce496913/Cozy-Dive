import type { CollisionWorld } from './collision';
import {
  SWIMMING,
  SWIM_FEELS,
  type SwimmingFeel,
  type Bounds,
  type Vec3,
} from '../config/world';

const AXES = ['x', 'y', 'z'] as const;
const NO_PROPULSION: Vec3 = { x: 0, y: 0, z: 0 };

export interface SwimInput {
  forward: number;
  right: number;
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
  depthChanging: boolean;
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
    breathingTime: SWIMMING.breathingCycle / 4,
    neutralDepth: position.y,
    moving: false,
    breathBlend: 1,
    bodyPitch: 0,
    depthChanging: false,
  };
}
/** Pause propulsion, retaining a resting breath's phase, anchor and small vertical velocity. */
export function resetSwimming(state: SwimState): void {
  state.velocity.x = state.velocity.z = 0;
  state.thrust.x = state.thrust.y = state.thrust.z = 0;
  state.strokeTime = 0;
  if (
    state.depthChanging ||
    Math.abs(state.velocity.y) > SWIMMING.maxRestingResumeSpeed
  ) {
    state.velocity.y = 0;
    state.neutralDepth = state.position.y;
    state.breathBlend = 0;
  }
  state.depthChanging = false;
  state.moving = false;
  // Simulation stops entirely while paused; retained hover state resumes without a phase jump.
}
/** C1 continuous pulse, zero throughout the passive portion; mean = active / 2. */
export function strokeEnvelope(phase: number, active: number): number {
  const wrapped = phase % 1;
  const t = wrapped < 0 ? wrapped + 1 : wrapped;
  return t < active ? Math.sin((Math.PI * t) / active) ** 2 : 0;
}

/** Camera forward is -Z; positive pitch looks up. Strafe is always horizontal. */
export function movementDirection(
  input: SwimInput,
  yaw: number,
  pitch: number,
  out: Vec3,
): Vec3 {
  if (!input.forward && !input.right) {
    out.x = out.y = out.z = 0;
    return out;
  }
  const cp = Math.cos(pitch);
  out.x = -Math.sin(yaw) * cp * input.forward + Math.cos(yaw) * input.right;
  out.y = Math.sin(pitch) * input.forward;
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

/** One force/drag stroke model for all three axes; resting depth is captured after coasting. */
export function integrateSwimming(
  state: SwimState,
  direction: Vec3,
  dt: number,
  tuning: SwimTuning,
  bounds: Bounds,
  collision?: CollisionWorld,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, SWIMMING.maxFrameDelta);
  const feel = SWIM_FEELS[tuning.feel];
  const steps = Math.ceil(dt / SWIMMING.maxStep),
    h = dt / steps;
  const moving = Math.hypot(direction.x, direction.y, direction.z) > 0;
  if (moving && !state.moving) state.strokeTime = 0;
  state.moving = moving;
  const low = bounds.min.y + bounds.clearance,
    high = bounds.max.y - bounds.clearance;
  const intentionalDepth =
    Math.abs(direction.y) > SWIMMING.verticalInputThreshold;
  for (let i = 0; i < steps; i++) {
    const fromX = state.position.x,
      fromY = state.position.y,
      fromZ = state.position.z;
    state.depthChanging =
      intentionalDepth ||
      (state.depthChanging &&
        Math.abs(state.velocity.y) > SWIMMING.coastToHoverSpeed);
    const pulse = moving
      ? strokeEnvelope((state.strokeTime + h / 2) / feel.cycle, feel.active)
      : 0;
    // A steady push: strokes show in the body's sway and sound, never as speed surges.
    const force = moving ? 1 : 0;
    // While held, velocity settles on the swim speed within `cruise` seconds (~95%).
    const cruiseRate = 3 / feel.cruise;
    const blend = -Math.expm1(-feel.response * h);
    state.breathBlend +=
      ((state.depthChanging || tuning.reducedMotion ? 0 : 1) -
        state.breathBlend) *
      -Math.expm1(-SWIMMING.breathingFade * h);
    const breathPhase =
      ((state.breathingTime + h / 2) * 2 * Math.PI) / SWIMMING.breathingCycle;
    const margin = Math.max(
      0,
      Math.min(
        1,
        (state.neutralDepth - low) / SWIMMING.breathingBoundaryMargin,
        (high - state.neutralDepth) / SWIMMING.breathingBoundaryMargin,
      ),
    );
    const buoyancy =
      tuning.reducedMotion || state.depthChanging
        ? 0
        : feel.breathing * Math.sin(breathPhase) * state.breathBlend * margin;
    const hover = state.depthChanging
      ? 0
      : SWIMMING.hoverSpring * (state.neutralDepth - state.position.y) +
        buoyancy;
    for (const axis of AXES) {
      const target = direction[axis] * tuning.speed * feel.drag * force;
      state.thrust[axis] = moving
        ? state.thrust[axis] + (target - state.thrust[axis]) * blend
        : 0;
      const drag =
        axis === 'y' && !state.depthChanging
          ? SWIMMING.hoverDamping
          : feel.drag;
      const terminal = (state.thrust[axis] + (axis === 'y' ? hover : 0)) / drag;
      // Driven axes settle quickly on the swim speed; coasting and hovering keep their drag.
      const rate =
        moving && (axis !== 'y' || state.depthChanging)
          ? Math.max(drag, cruiseRate)
          : drag;
      const decay = Math.exp(-rate * h);
      state.position[axis] +=
        terminal * h + ((state.velocity[axis] - terminal) * (1 - decay)) / rate;
      state.velocity[axis] =
        terminal + (state.velocity[axis] - terminal) * decay;
      if (
        axis !== 'y' &&
        !moving &&
        Math.abs(state.velocity[axis]) < SWIMMING.settleSpeed
      )
        state.velocity[axis] = 0;
    }
    const integratedY = state.position.y;
    if (collision) collision.move(state, fromX, fromY, fromZ);
    clampToBounds(state, bounds);
    if (state.depthChanging)
      state.neutralDepth = Math.max(
        low,
        Math.min(high, state.position.y + state.velocity.y / feel.drag),
      );
    else if (moving && Math.abs(state.position.y - integratedY) > 1e-6) {
      // Sliding along an inclined rock may establish a new depth, never a visual-only offset.
      state.neutralDepth = Math.max(
        low,
        Math.min(high, state.neutralDepth + state.position.y - integratedY),
      );
      if (Math.abs(state.velocity.y) > SWIMMING.coastToHoverSpeed)
        state.depthChanging = true;
    }
    state.neutralDepth = Math.max(low, Math.min(high, state.neutralDepth));
    state.bodyPitch +=
      ((tuning.reducedMotion ? 0 : pulse * SWIMMING.bodyPitch) -
        state.bodyPitch) *
      blend;
    state.strokeTime = (state.strokeTime + h) % feel.cycle;
    state.breathingTime = (state.breathingTime + h) % SWIMMING.breathingCycle;
  }
}

/** Initial preview advances only resting buoyancy; no input, propulsion, or fish clock starts. */
export function advanceHoverPreview(
  state: SwimState,
  dt: number,
  tuning: SwimTuning,
  bounds: Bounds,
  collision?: CollisionWorld,
): void {
  state.velocity.x = state.velocity.z = 0;
  state.thrust.x = state.thrust.y = state.thrust.z = 0;
  state.depthChanging = false;
  integrateSwimming(state, NO_PROPULSION, dt, tuning, bounds, collision);
}
