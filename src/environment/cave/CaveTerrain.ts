import { CAVE } from '../../config/passage';
import type { Vec3 } from '../../config/world';

/**
 * v0.6 Pass 034: the sea cave's shape. Its cavern is an uneven dome (an ellipsoid with gentle
 * lumps), its floor a sand bed with soft ripples that banks up against the walls. Pure and
 * allocation-free, shared by the meshes, collision, life and tests.
 */
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** How far (fraction) the wall bulges in or out along a unit direction from the cavern's centre. */
export function wallLumps(ux: number, uy: number, uz: number): number {
  return (
    0.07 * Math.sin(ux * 5.1 + uz * 3.3) * Math.sin(uy * 4.2 + ux * 2.1) +
    0.04 * Math.sin(uz * 8.7 - uy * 6.1 + 0.6) +
    0.025 * Math.sin(ux * 13.1 + uy * 11.3 - uz * 9.7)
  );
}

/**
 * How far out towards the wall a point is: 0 at the centre, 1 on the wall (the lumps included).
 * `normal` receives the outward direction there (unit).
 */
export function chamberDepth(p: Readonly<Vec3>, normal?: Vec3): number {
  const c = CAVE.chamber,
    n = c.squareness,
    qx = (p.x - c.x) / c.rx,
    qy = (p.y - c.y) / c.ry,
    qz = (p.z - c.z) / c.rz,
    q = norm(qx, qy, qz);
  if (normal) {
    // The rounded box's outward normal (its gradient).
    const gx = (Math.sign(qx) * Math.abs(qx) ** (n - 1)) / c.rx,
      gy = (Math.sign(qy) * Math.abs(qy) ** (n - 1)) / c.ry,
      gz = (Math.sign(qz) * Math.abs(qz) ** (n - 1)) / c.rz,
      l = Math.hypot(gx, gy, gz) || 1;
    normal.x = gx / l;
    normal.y = gy / l;
    normal.z = gz / l;
  }
  if (q < 1e-9) return 0;
  return q / (1 + wallLumps(qx / q, qy / q, qz / q));
}
/** The rounded box's size measure of a point in the cavern's stretched space (1 on its wall). */
function norm(x: number, y: number, z: number): number {
  const n = CAVE.chamber.squareness;
  return (Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n) ** (1 / n);
}
/** Distance (m) from `p` to the wall, measured towards it from the centre (negative beyond it). */
export function wallDistance(p: Readonly<Vec3>): number {
  const c = CAVE.chamber,
    q = chamberDepth(p),
    r = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
  return q > 1e-9 ? r * (1 / q - 1) : Infinity;
}
/** A point on the wall along the direction (dx, dy, dz) from the centre (in place). */
export function wallPoint(dx: number, dy: number, dz: number, out: Vec3): Vec3 {
  const c = CAVE.chamber,
    sx = dx / c.rx,
    sy = dy / c.ry,
    sz = dz / c.rz,
    l = norm(sx, sy, sz) || 1,
    // Unit size in the cavern's stretched space, and the bulge there.
    k = (1 + wallLumps(sx / l, sy / l, sz / l)) / l;
  out.x = c.x + dx * k;
  out.y = c.y + dy * k;
  out.z = c.z + dz * k;
  return out;
}

/** Whether `p` is within the tunnel's cross-section, from its start to just inside the cavern. */
export function inTunnelReach(p: Readonly<Vec3>): boolean {
  const t = CAVE.tunnel;
  return (
    p.z > t.openZ - 1.2 &&
    Math.abs(p.x) < t.radius + 0.4 &&
    Math.abs(p.y - t.y) < t.radius + 0.4
  );
}

/** Sand height (m) at (x, z): soft ripples and mounds, banking up towards the walls. */
export function caveFloor(x: number, z: number): number {
  const c = CAVE.chamber,
    rim =
      (Math.abs((x - c.x) / c.rx) ** c.squareness +
        Math.abs((z - c.z) / c.rz) ** c.squareness) **
      (1 / c.squareness),
    ripple =
      0.035 * Math.sin(x * 1.3 + z * 0.5) +
      0.25 * Math.sin(x * 0.31 - z * 0.23 + 1.3) +
      0.18 * Math.sin(x * 0.17 + z * 0.41);
  return ripple + 2.2 * smooth((rim - 0.72) / 0.3);
}

/** How far swimming has eased off at a limit: 1 inside it, a slow crawl over its band, then 0. */
export function caveEase(past: number, band: number): number {
  if (past <= 0) return 1;
  if (past < band) return 1 - 0.94 * smooth(past / band);
  return 0.06 * (1 - smooth((past - band) / 2));
}
const normal: Vec3 = { x: 0, y: 0, z: 0 };
/**
 * Soft walls: within `CAVE.ease.inset` of the cavern's wall, the part of the swimming direction
 * towards the wall eases to a hover, stopping a metre short of the rock. The tunnel (sealed by its
 * own colliders) is exempt, so the swimmer can enter and leave by it. `dir` is changed in place.
 */
export function easeInCave(p: Readonly<Vec3>, dir: Vec3): Vec3 {
  if (inTunnelReach(p)) return dir;
  const past = CAVE.ease.inset - wallDistance(p);
  if (past <= 0) return dir;
  chamberDepth(p, normal);
  const out = dir.x * normal.x + dir.y * normal.y + dir.z * normal.z;
  if (out <= 0) return dir;
  const k = out * (1 - caveEase(past, CAVE.ease.band));
  dir.x -= normal.x * k;
  dir.y -= normal.y * k;
  dir.z -= normal.z * k;
  return dir;
}
