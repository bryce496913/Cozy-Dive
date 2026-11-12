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

/** Pass 026: how far the bottom keeps falling beyond the wall's foot (m). */
function abyssFall(z: number): number {
  const a = OUTER.abyss,
    past = OUTER.dropOff.end - z;
  return past > 0 ? Math.min(a.depth, past * a.slope) : 0;
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
    OUTER.dropOff.depth * dropWeight(z) -
    abyssFall(z)
  );
}

/** How far swimming has eased off at a limit: 1 inside it, `crawl` over its band, then 0. */
export function easeFactor(past: number, band: number): number {
  const r = OUTER.reach;
  if (past <= 0) return 1;
  if (past < band) return 1 - (1 - r.crawl) * smooth(past / band);
  return r.crawl * (1 - smooth((past - band) / r.stop));
}
/**
 * Pass 026: soft limits that slow the swimmer instead of pushing them back. Near each limit the
 * outward part of the swimming direction `dir` is scaled down smoothly (to almost nothing, then
 * nothing); movement along or back from a limit is untouched. `dir` is changed in place.
 */
export function easeAtEdges(p: Vec3, dir: Vec3): Vec3 {
  const r = OUTER.reach,
    lip = OUTER.dropOff.start;
  // Out over the blue, beyond the lip.
  if (dir.z < 0) dir.z *= easeFactor(lip - p.z, r.past);
  // Down the wall.
  if (dir.y < 0) dir.y *= easeFactor(r.down - p.y, r.depth);
  // Up towards the far surface.
  if (dir.y > 0) dir.y *= easeFactor(p.y - r.up, r.rise);
  // The sides of the reef.
  if (dir.x * p.x > 0) dir.x *= easeFactor(Math.abs(p.x) - r.halfWidth, r.side);
  return dir;
}
