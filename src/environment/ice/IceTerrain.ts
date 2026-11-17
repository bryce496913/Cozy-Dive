import { ICE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { easeFactor } from '../outer/OuterTerrain';

/**
 * v0.6 Pass 046: the seabed under the ice and its soft limits. Pure.
 */
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seabed height (m) at (x, z): gravel and silt in low swells, banking up under the icebergs. */
export function iceFloor(x: number, z: number): number {
  const w = ICE.walls;
  return (
    0.35 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.07) +
    0.18 * Math.sin(x * 0.6 + 1.3) * Math.sin(z * 0.5) +
    2.2 * smooth(w.x - 7, w.x + 1, Math.abs(x)) +
    2.2 * smooth(-(w.farZ + 7), -(w.farZ - 1), -z) +
    // A little rise to the rock wall the tunnel comes through.
    1.2 *
      smooth(ICE.tunnel.wallZ - 5, ICE.tunnel.wallZ, z) *
      smooth(2.5, 6, Math.abs(x))
  );
}

/** Whether `p` is in the tunnel or just out of it (no soft limits there). */
export function inIceTunnelReach(p: Readonly<Vec3>): boolean {
  const t = ICE.tunnel;
  return p.z > t.wallZ - 1.5 && Math.hypot(p.x, p.y - t.y) < t.radius + 0.4;
}

/**
 * Soft limits: swimming towards an iceberg, the far end, the rock wall or the ice above eases off
 * to a hover, short of it (outward movement only, scaled in place).
 */
export function easeInIce(p: Readonly<Vec3>, dir: Vec3): Vec3 {
  if (inIceTunnelReach(p)) return dir;
  const e = ICE.ease,
    w = ICE.walls;
  if (dir.x * p.x > 0)
    dir.x *= easeFactor(Math.abs(p.x) - (w.x - e.inset), e.band);
  if (dir.z < 0) dir.z *= easeFactor(w.farZ + e.inset - p.z, e.band);
  if (dir.z > 0)
    dir.z *= easeFactor(p.z - (ICE.tunnel.wallZ - e.inset), e.band);
  if (dir.y > 0) dir.y *= easeFactor(p.y - (ICE.ceiling - e.up), e.band);
  return dir;
}
