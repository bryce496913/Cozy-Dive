import type { FootprintBox } from '../config/office';

/**
 * v0.3 Pass 020: calm first-person walking in the office. Pure and frame-rate independent:
 * horizontal only (eye height is fixed), input relative to yaw (forward is -z, positive yaw
 * looks left), combined input normalised, velocity eased toward the target pace, long frame gaps
 * capped, and the body circle slides along room walls and furniture footprints.
 */
export interface WalkState {
  readonly position: { x: number; y: number; z: number };
  readonly velocity: { x: number; z: number };
}
export interface WalkInput {
  readonly forward: number;
  readonly right: number;
}
export interface WalkWorld {
  readonly min: { readonly x: number; readonly z: number };
  readonly max: { readonly x: number; readonly z: number };
  readonly obstacles: readonly FootprintBox[];
  readonly radius: number;
}
export interface WalkTuning {
  readonly speed: number;
  readonly response: number;
  readonly maxFrameDelta: number;
}

export function createWalkState(spawn: {
  x: number;
  y: number;
  z: number;
}): WalkState {
  return { position: { ...spawn }, velocity: { x: 0, z: 0 } };
}

/** Push a circle out of an axis-aligned footprint; returns true when it moved. */
function pushOut(
  p: { x: number; z: number },
  v: { x: number; z: number },
  b: FootprintBox,
  r: number,
): void {
  const cx = Math.max(b.min.x, Math.min(p.x, b.max.x)),
    cz = Math.max(b.min.z, Math.min(p.z, b.max.z)),
    dx = p.x - cx,
    dz = p.z - cz,
    d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  let nx: number, nz: number, depth: number;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    nz = dz / d;
    depth = r - d;
  } else {
    // Centre inside the footprint: leave through the nearest side.
    const left = p.x - b.min.x,
      right = b.max.x - p.x,
      back = p.z - b.min.z,
      front = b.max.z - p.z,
      m = Math.min(left, right, back, front);
    [nx, nz] =
      m === left
        ? [-1, 0]
        : m === right
          ? [1, 0]
          : m === back
            ? [0, -1]
            : [0, 1];
    depth = m + r;
  }
  p.x += nx * depth;
  p.z += nz * depth;
  const into = v.x * nx + v.z * nz;
  if (into < 0) {
    v.x -= into * nx;
    v.z -= into * nz;
  }
}

/** Advance one frame. `yaw` is the camera yaw (radians, positive looks left). */
export function stepWalking(
  state: WalkState,
  input: WalkInput,
  yaw: number,
  dt: number,
  tuning: WalkTuning,
  world: WalkWorld,
): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, tuning.maxFrameDelta);
  const length = Math.hypot(input.forward, input.right),
    f = length > 1 ? input.forward / length : input.forward,
    s = length > 1 ? input.right / length : input.right;
  // Forward is -z at yaw 0; positive yaw turns left (towards -x).
  const sin = Math.sin(yaw),
    cos = Math.cos(yaw),
    tx = (-sin * f + cos * s) * tuning.speed,
    tz = (-cos * f - sin * s) * tuning.speed,
    blend = -Math.expm1(-tuning.response * dt);
  const v = state.velocity,
    p = state.position;
  v.x += (tx - v.x) * blend;
  v.z += (tz - v.z) * blend;
  if (length === 0 && Math.hypot(v.x, v.z) < 1e-3) v.x = v.z = 0;
  // Sub-step so a fast frame cannot tunnel through a thin piece of furniture.
  const steps = Math.max(
    1,
    Math.ceil((Math.hypot(v.x, v.z) * dt) / (world.radius * 0.5)),
  );
  for (let i = 0; i < steps; i++) {
    p.x += (v.x * dt) / steps;
    p.z += (v.z * dt) / steps;
    // Neighbouring footprints and walls can push back and forth: relax a few times so the body
    // settles outside their union (pockets narrower than the body simply cannot be entered).
    for (let pass = 0; pass < 6; pass++) {
      for (const b of world.obstacles) pushOut(p, v, b, world.radius);
      const lowX = world.min.x + world.radius,
        highX = world.max.x - world.radius,
        lowZ = world.min.z + world.radius,
        highZ = world.max.z - world.radius;
      if (p.x < lowX || p.x > highX) {
        p.x = Math.max(lowX, Math.min(highX, p.x));
        v.x = 0;
      }
      if (p.z < lowZ || p.z > highZ) {
        p.z = Math.max(lowZ, Math.min(highZ, p.z));
        v.z = 0;
      }
    }
  }
}

/** Clear held motion (pause, lock loss, focus loss). */
export function stopWalking(state: WalkState): void {
  state.velocity.x = state.velocity.z = 0;
}
