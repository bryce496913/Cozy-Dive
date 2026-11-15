import {
  CAVE,
  CAVE_FRAME,
  GROTTO,
  GROTTO_FRAME,
  grottoToTank,
  CLEFT,
  CLEFT_FRAME,
  CREVICE,
  CREVICE_FRAME,
  KELP,
  KELP_FRAME,
  PASSAGE,
  TUNNEL_FRAME,
  cleftToTank,
  type PassageFrame,
} from '../config/passage';
import type { Vec3 } from '../config/world';

/**
 * v0.4 Pass 023: the passage between the tank's hidden crevice and the outer waters' tunnel.
 *
 * The two ends are rigid copies of each other: the tunnel begins where the channel's threshold
 * is, turned to the tunnel's heading, with at least the channel's cross-section. Crossing the
 * threshold maps the swimmer's position, velocity and look across exactly, so control never
 * stops and nothing jumps; the darkness, which peaks at the threshold on both sides, hides the
 * change of world. Pure (no allocation in the per-frame paths).
 */
export type WaterWorldId = 'aquarium' | 'outer' | 'kelp' | 'cave';

/** Heading (camera yaw) that looks along a horizontal direction: forward = (-sin, -cos). */
export const headingOf = (d: { x: number; z: number }): number =>
  Math.atan2(-d.x, -d.z);

/** Signed distance past a frame's threshold, along its forward direction. */
export function depthPast(frame: PassageFrame, p: Vec3): number {
  return (
    (p.x - frame.origin.x) * frame.forward.x +
    (p.z - frame.origin.z) * frame.forward.z
  );
}

/** Rotate a horizontal vector by a yaw change (positive turns left, as the camera does). */
function rotate(v: Vec3, turn: number, out: Vec3): Vec3 {
  const c = Math.cos(turn),
    s = Math.sin(turn),
    x = v.x,
    z = v.z;
  out.x = c * x + s * z;
  out.y = v.y;
  out.z = -s * x + c * z;
  return out;
}
const scratch: Vec3 = { x: 0, y: 0, z: 0 };

/** The yaw change from one frame to the other. */
export function frameTurn(from: PassageFrame, to: PassageFrame): number {
  return headingOf(to.forward) - headingOf(from.forward);
}
/** Map a point from one frame into the other (in place into `out`). */
export function mapPoint(
  p: Vec3,
  from: PassageFrame,
  to: PassageFrame,
  out: Vec3,
): Vec3 {
  scratch.x = p.x - from.origin.x;
  scratch.y = p.y - from.origin.y;
  scratch.z = p.z - from.origin.z;
  rotate(scratch, frameTurn(from, to), out);
  out.x += to.origin.x;
  out.y += to.origin.y;
  out.z += to.origin.z;
  return out;
}
/** Map a direction or velocity (rotation only). */
export function mapVector(
  v: Vec3,
  from: PassageFrame,
  to: PassageFrame,
  out: Vec3,
): Vec3 {
  return rotate(v, frameTurn(from, to), out);
}

/** The frame a world's end of the tank passage uses (the kelp forest's and cave's are their own). */
export const passageFrame = (world: WaterWorldId): PassageFrame =>
  world === 'aquarium'
    ? CREVICE_FRAME
    : world === 'kelp'
      ? KELP_FRAME
      : world === 'cave'
        ? CAVE_FRAME
        : TUNNEL_FRAME;

/** Whether `p` is inside the crevice channel's cross-section (for the darkness and the swap). */
export function inChannel(p: Vec3): boolean {
  return (
    p.x <= CREVICE.mouthX + 0.4 &&
    p.x >= CREVICE.endX - 0.3 &&
    Math.abs(p.y - CREVICE.centre.y) <= CREVICE.halfHeight + 0.2 &&
    Math.abs(p.z - CREVICE.centre.z) <= CREVICE.halfDepth + 0.2
  );
}

/**
 * Which world the swimmer should be in after this frame: in the tank, past the threshold inside
 * the channel (when the outer waters are ready); in the outer waters, back out of the tunnel's
 * start. Hysteresis keeps a swimmer hovering at the threshold from flickering between worlds.
 */
export function passageTarget(
  world: WaterWorldId,
  p: Vec3,
  outerReady: boolean,
): WaterWorldId {
  if (world === 'aquarium')
    return outerReady &&
      inChannel(p) &&
      depthPast(CREVICE_FRAME, p) > PASSAGE.hysteresis
      ? 'outer'
      : 'aquarium';
  return depthPast(TUNNEL_FRAME, p) < -PASSAGE.hysteresis &&
    Math.abs(p.y - TUNNEL_FRAME.origin.y) < 3
    ? 'aquarium'
    : 'outer';
}

/**
 * Darkness over the view (0..PASSAGE.darkPeak): it deepens towards the threshold and clears again
 * past it, identically on both sides, so the world change happens at its darkest.
 */
export function passageDarkness(world: WaterWorldId, p: Vec3): number {
  if (world === 'aquarium')
    return inChannel(p) ? darkness(CREVICE_FRAME, p) : 0;
  // v0.6 Pass 034: the kelp forest has two as well: its tunnel and the grotto to the sea cave.
  if (world === 'kelp')
    return Math.max(
      inKelpTunnel(p) ? darkness(KELP_FRAME, p) : 0,
      inGrotto(p) ? darkness(GROTTO_FRAME, p) : 0,
    );
  if (world === 'cave') return inCaveTunnel(p) ? darkness(CAVE_FRAME, p) : 0;
  // The outer waters have two: the tunnel from the tank, and the cleft to the kelp forest.
  return Math.max(
    darkness(TUNNEL_FRAME, p),
    inCleft(p) ? darkness(CLEFT_FRAME, p) : 0,
  );
}
function darkness(frame: PassageFrame, p: Vec3): number {
  const d = Math.abs(depthPast(frame, p)),
    t = Math.max(0, 1 - d / PASSAGE.darkReach);
  return PASSAGE.darkPeak * t * t * (3 - 2 * t);
}

const local: Vec3 = { x: 0, y: 0, z: 0 };
/** v0.6 Pass 032: whether `p` (outer waters) is inside the cleft's channel. */
export function inCleft(p: Vec3): boolean {
  return inChannel(cleftToTank(p, local));
}
/** v0.6 Pass 032: whether `p` (kelp forest) is in its tunnel, from its start to the wall. */
export function inKelpTunnel(p: Vec3): boolean {
  const t = KELP.tunnel;
  return (
    p.z <= t.startZ &&
    p.z >= t.wallZ - 0.5 &&
    Math.abs(p.x - KELP_FRAME.origin.x) <= t.radius + 0.3 &&
    Math.abs(p.y - t.y) <= t.radius + 0.3
  );
}
/** v0.6 Pass 034: whether `p` (kelp forest) is inside the grotto's channel. */
export function inGrotto(p: Vec3): boolean {
  return inChannel(grottoToTank(p, local));
}
/** v0.6 Pass 034: whether `p` (sea cave) is in its tunnel, from its start to the cavern. */
export function inCaveTunnel(p: Vec3): boolean {
  const t = CAVE.tunnel;
  return (
    p.z <= t.startZ &&
    p.z >= t.openZ - 0.5 &&
    Math.abs(p.x - CAVE_FRAME.origin.x) <= t.radius + 0.3 &&
    Math.abs(p.y - t.y) <= t.radius + 0.3
  );
}
/** v0.6 Pass 034: distance from the grotto's mouth in the kelp forest (to load the sea cave). */
export function grottoDistance(p: Vec3): number {
  return Math.hypot(
    p.x - (GROTTO.offset.x - CREVICE.mouthX),
    p.y - (CREVICE.centre.y + GROTTO.offset.y),
    p.z - (GROTTO.offset.z - CREVICE.centre.z),
  );
}
/** Distance from the cleft's mouth in the outer waters (for loading and releasing the kelp forest). */
export function cleftDistance(p: Vec3): number {
  return Math.hypot(
    p.x - (CLEFT.offset.x - CREVICE.mouthX),
    p.y - (CREVICE.centre.y + CLEFT.offset.y),
    p.z - (CLEFT.offset.z - CREVICE.centre.z),
  );
}

/** A change of world: the target, and the frames to map position, velocity and look between. */
export interface Crossing {
  readonly target: WaterWorldId;
  readonly from: PassageFrame;
  readonly to: PassageFrame;
}
const TANK_TO_OUTER: Crossing = {
    target: 'outer',
    from: CREVICE_FRAME,
    to: TUNNEL_FRAME,
  },
  OUTER_TO_TANK: Crossing = {
    target: 'aquarium',
    from: TUNNEL_FRAME,
    to: CREVICE_FRAME,
  },
  OUTER_TO_KELP: Crossing = {
    target: 'kelp',
    from: CLEFT_FRAME,
    to: KELP_FRAME,
  },
  KELP_TO_OUTER: Crossing = {
    target: 'outer',
    from: KELP_FRAME,
    to: CLEFT_FRAME,
  },
  KELP_TO_CAVE: Crossing = {
    target: 'cave',
    from: GROTTO_FRAME,
    to: CAVE_FRAME,
  },
  CAVE_TO_KELP: Crossing = {
    target: 'kelp',
    from: CAVE_FRAME,
    to: GROTTO_FRAME,
  };
/**
 * v0.6 Pass 032: whether to change world this frame, and how. The tank and the outer waters are
 * linked by the crevice and tunnel (as before); the outer waters and the kelp forest by the cleft
 * and the kelp tunnel. A world is entered only when it is ready; hysteresis applies both ways.
 */
export function crossing(
  world: WaterWorldId,
  p: Vec3,
  ready: {
    readonly outer: boolean;
    readonly kelp: boolean;
    /** v0.6 Pass 034: the sea cave, beyond the kelp forest's grotto. */
    readonly cave?: boolean;
  },
): Crossing | null {
  if (world === 'aquarium')
    return passageTarget('aquarium', p, ready.outer) === 'outer'
      ? TANK_TO_OUTER
      : null;
  if (world === 'outer') {
    if (passageTarget('outer', p, true) === 'aquarium') return OUTER_TO_TANK;
    return ready.kelp &&
      inCleft(p) &&
      depthPast(CLEFT_FRAME, p) > PASSAGE.hysteresis
      ? OUTER_TO_KELP
      : null;
  }
  if (world === 'cave')
    return depthPast(CAVE_FRAME, p) < -PASSAGE.hysteresis &&
      Math.abs(p.y - CAVE_FRAME.origin.y) < 3
      ? CAVE_TO_KELP
      : null;
  if (
    depthPast(KELP_FRAME, p) < -PASSAGE.hysteresis &&
    Math.abs(p.y - KELP_FRAME.origin.y) < 3
  )
    return KELP_TO_OUTER;
  return ready.cave &&
    inGrotto(p) &&
    depthPast(GROTTO_FRAME, p) > PASSAGE.hysteresis
    ? KELP_TO_CAVE
    : null;
}

/**
 * Where "Return to the tank" puts the swimmer: just outside the crevice mouth, facing out towards
 * the room's right bank, level.
 */
export function returnPose(): {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
} {
  const out = { x: -CREVICE_FRAME.forward.x, z: -CREVICE_FRAME.forward.z };
  return {
    x: CREVICE.mouthX + out.x * PASSAGE.returnGap,
    y: CREVICE.centre.y,
    z: CREVICE.centre.z + out.z * PASSAGE.returnGap,
    yaw: headingOf(out),
    pitch: 0,
  };
}

/** Distance from the crevice mouth (for loading and releasing the outer waters). */
export function mouthDistance(p: Vec3): number {
  return Math.hypot(
    p.x - CREVICE.mouthX,
    p.y - CREVICE.centre.y,
    p.z - CREVICE.centre.z,
  );
}
