import { GROTTO, KELP } from '../../config/passage';
import type { Vec3 } from '../../config/world';

/**
 * v0.6 Pass 032: the kelp forest's seabed, and its soft edges. Pure and allocation-free, shared by
 * the meshes, collision, fish, creatures and tests.
 */
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** How far (0..1) a point is inside the rays' sandy lane, which winds gently through the forest. */
export function laneWeight(x: number, z: number): number {
  const l = KELP.forest.lane,
    centre = l.x + 3 * Math.sin(z * 0.06);
  return 1 - smooth((Math.abs(x - centre) - l.halfWidth * 0.5) / l.halfWidth);
}
/** Lane centre at z (for the rays' route). */
export const laneCentre = (z: number): number =>
  KELP.forest.lane.x + 3 * Math.sin(z * 0.06);

/** Seabed height (m) at (x, z): rocky swells, a sandy lane, rising to the wall and the sides. */
export function kelpFloor(x: number, z: number): number {
  const swell =
      0.6 * Math.sin(x * 0.13 + z * 0.07) +
      0.45 * Math.sin(x * 0.051 - z * 0.11 + 0.8) +
      0.2 * Math.sin(x * 0.37 + z * 0.29 + 2.1),
    wall = 1.4 * smooth((z - (KELP.tunnel.wallZ - 7)) / 7),
    sides = 3 * smooth((Math.abs(x) - 34) / 12),
    far = 2.5 * smooth((KELP.reach.far - 6 - z) / 14);
  return (
    0.2 +
    swell * (1 - 0.7 * laneWeight(x, z)) -
    0.5 * laneWeight(x, z) +
    wall +
    sides +
    far
  );
}

/** How far swimming has eased off at a limit: 1 inside it, a slow crawl over its band, then 0. */
export function kelpEase(past: number, band: number): number {
  if (past <= 0) return 1;
  if (past < band) return 1 - 0.94 * smooth(past / band);
  return 0.06 * (1 - smooth((past - band) / 2));
}
/**
 * Soft limits, as in the outer waters: near each limit the outward part of the swimming direction
 * eases to a hover instead of meeting a wall. `dir` is changed in place.
 */
export function easeInKelp(p: Vec3, dir: Vec3): Vec3 {
  const r = KELP.reach;
  if (dir.z < 0) dir.z *= kelpEase(r.far - p.z, r.past);
  if (dir.y > 0) dir.y *= kelpEase(p.y - r.up, r.rise);
  if (dir.x * p.x > 0) dir.x *= kelpEase(Math.abs(p.x) - r.halfWidth, r.side);
  return dir;
}

/** v0.6 Pass 034: whether something at (x, z) reaching `reach` m would crowd the grotto. */
export function inGrottoClear(x: number, z: number, reach = 0): boolean {
  const c = GROTTO.clear;
  return x > c.minX - reach && x < c.maxX + reach && z > c.z - reach;
}
