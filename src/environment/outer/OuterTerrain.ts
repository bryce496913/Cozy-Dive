import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';

/**
 * v0.4 Pass 024: the outer reef's seabed and its soft edges, as pure functions shared by the
 * terrain mesh, the swimmer's floor, the fish's substrate and the reef layout.
 */
const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Centre of the winding sand channel at depth `z` (x). */
export function channelCentre(z: number): number {
  const c = OUTER.channel;
  return (
    c.amplitude * Math.sin(((z - OUTER.cliffZ) / c.wavelength) * Math.PI * 2)
  );
}
/** 0 outside the channel, 1 on its centreline. */
export function channelWeight(x: number, z: number): number {
  if (z > OUTER.cliffZ + 1) return 0;
  const d = Math.abs(x - channelCentre(z)) / OUTER.channel.halfWidth;
  return 1 - smooth(d);
}
/** How far over the drop-off `z` is (0 on the reef, 1 at the bottom of the wall). */
export function dropWeight(z: number): number {
  const d = OUTER.dropOff;
  return smooth((d.start - z) / (d.start - d.end));
}

/** Seabed height (m) at (x, z). */
export function seabedHeight(x: number, z: number): number {
  // Gentle sandy undulation and a low rise towards the sides of the reef.
  const swell =
      0.35 * Math.sin(x * 0.11 + z * 0.05) +
      0.22 * Math.sin(x * 0.047 - z * 0.083 + 1.3),
    sides = 1.6 * smooth((Math.abs(x) - 38) / 14);
  return (
    OUTER.floorY -
    0.3 +
    swell +
    sides -
    OUTER.channel.depth * channelWeight(x, z) -
    OUTER.dropOff.depth * dropWeight(z)
  );
}

/**
 * The gentle current that turns a swimmer back near the reef's edges (m/s, into `out`). Zero
 * inside the comfortable reef; it grows smoothly over the edge band, always pointing back in.
 */
export function edgeCurrent(p: Vec3, out: Vec3): Vec3 {
  const r = OUTER.reef,
    w = OUTER.edgeWidth,
    k = OUTER.edgeCurrent;
  out.x = k * (smooth((r.minX - p.x) / w) - smooth((p.x - r.maxX) / w));
  out.y = -k * smooth((p.y - r.maxY) / w);
  out.z = k * smooth((r.minZ - p.z) / w);
  return out;
}
