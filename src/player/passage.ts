import {
  CREVICE,
  CREVICE_FRAME,
  PASSAGE,
  TUNNEL_FRAME,
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
export type WaterWorldId = 'aquarium' | 'outer';

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

/** The frame a world's end of the passage uses. */
export const passageFrame = (world: WaterWorldId): PassageFrame =>
  world === 'aquarium' ? CREVICE_FRAME : TUNNEL_FRAME;

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
  if (world === 'aquarium' && !inChannel(p)) {
    // Outside the channel only its mouth area darkens slightly as it fills the view.
    return 0;
  }
  const frame = passageFrame(world),
    d = Math.abs(depthPast(frame, p)),
    t = Math.max(0, 1 - d / PASSAGE.darkReach);
  return PASSAGE.darkPeak * t * t * (3 - 2 * t);
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
