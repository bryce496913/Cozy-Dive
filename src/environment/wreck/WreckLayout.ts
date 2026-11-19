import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { WRECK } from '../../config/wreck';
import type { Vec3 } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockCollider } from '../rockCollider';

/**
 * The shipwreck's shape and spaces (pure but for building hulls): an old steel freighter, upright
 * on the cavern's sand, bow towards -z. Shared by its meshes, its collision and the torch.
 *
 *   - the **hold**, below the deck amidships, entered through the open cargo hatch in the deck or
 *     a rusted breach low in the starboard (+x) side;
 *   - the **bridge**, a deckhouse aft, entered through its door, facing forward.
 * Everywhere else the ship is solid.
 */
export const SHIP = {
  bowZ: -49,
  sternZ: -15,
  /** Where the straight sides run (the hold lies within them). */
  foreZ: -41,
  aftZ: -20,
  half: 4,
  keel: 0.1,
  deck: 6.5,
  /** The deck plating's thickness, and the hull plating's. */
  plate: 0.25,
  shell: 0.22,
  hold: { foreZ: -40, aftZ: -24, floor: 1 },
  hatch: { foreZ: -33, aftZ: -29, half: 1.6, coaming: 0.45 },
  breach: { foreZ: -38, aftZ: -35, low: 1.5, high: 4.2 },
  bridge: {
    foreZ: -22,
    aftZ: -17,
    half: 3,
    top: 9.6,
    wall: 0.2,
    door: { half: 0.75, top: 8.75 },
  },
  funnel: { z: -18.6, radius: 0.85, top: 12.6 },
  mast: { z: -44.5, top: 14.5, radius: 0.16 },
} as const;

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The hull's half-breadth at deck level (m) at z: fine at the bow, full amidships, a squared stern. */
export function hullHalfWidth(z: number): number {
  const s = SHIP;
  if (z <= s.bowZ || z >= s.sternZ) return 0;
  if (z < s.foreZ) {
    const t = (z - s.bowZ) / (s.foreZ - s.bowZ);
    return Math.max(0.2, s.half * Math.pow(Math.sin((t * Math.PI) / 2), 0.75));
  }
  if (z > s.aftZ) {
    const t = (s.sternZ - z) / (s.sternZ - s.aftZ);
    return s.half * (0.72 + 0.28 * Math.sin((t * Math.PI) / 2));
  }
  return s.half;
}

/** The cavern's sandy floor (m): low ripples, a scour beside the hull, banking up to the walls. */
export function wreckFloor(x: number, z: number): number {
  const w = WRECK.walls,
    ripple =
      0.12 * Math.sin(x * 0.9 + z * 0.35) +
      0.25 * Math.sin(x * 0.17 - z * 0.11 + 1.2) +
      0.18 * Math.sin(z * 0.23 + 0.4),
    // Sand heaped against the hull, as the current leaves it.
    heap =
      z > SHIP.bowZ - 2 && z < SHIP.sternZ + 2
        ? 0.6 * (1 - smooth((Math.abs(x) - SHIP.half) / 3))
        : 0,
    sides = 3 * smooth((Math.abs(x) - (w.x - 7)) / 7),
    far = 3 * smooth((w.farZ + 7 - z) / 7),
    near = 2.5 * smooth((z - (w.nearZ - 6)) / 6);
  return ripple + heap + sides + far + near;
}

/** The roof's underside (m) at (x, z): rumpled rock, rising into the shaft's mouth. */
export function wreckRoof(x: number, z: number): number {
  const s = WRECK.shaft,
    d = Math.hypot(x - s.x, z - s.z),
    mouth = 1 - smooth((d - 1.6) / 3);
  return (
    WRECK.ceiling -
    0.35 * Math.abs(Math.sin(x * 0.31 + z * 0.17)) -
    0.25 * Math.sin(x * 0.9) * Math.sin(z * 0.8) +
    0.8 * mouth
  );
}

interface Room {
  readonly min: Vec3;
  readonly max: Vec3;
}
/** The two spaces inside the ship, as the swimmer's centre may occupy them. */
export const WRECK_ROOMS: readonly Room[] = [
  {
    min: { x: -SHIP.half + SHIP.shell, y: SHIP.hold.floor, z: SHIP.hold.foreZ },
    max: { x: SHIP.half - SHIP.shell, y: SHIP.deck, z: SHIP.hold.aftZ },
  },
  {
    min: {
      x: -SHIP.bridge.half + SHIP.bridge.wall,
      y: SHIP.deck + SHIP.plate,
      z: SHIP.bridge.foreZ + SHIP.bridge.wall,
    },
    max: {
      x: SHIP.bridge.half - SHIP.bridge.wall,
      y: SHIP.bridge.top,
      z: SHIP.bridge.aftZ - SHIP.bridge.wall,
    },
  },
];
/**
 * How dark it is at `p` (0 outside … 1 well inside the ship): it deepens over the first metre in
 * from a room's walls and openings, so the torch comes on as the swimmer slips inside.
 */
export function wreckShade(p: Readonly<Vec3>): number {
  let best = 0;
  for (const r of WRECK_ROOMS) {
    const inside = Math.min(
      p.x - r.min.x,
      r.max.x - p.x,
      p.y - r.min.y,
      r.max.y - p.y,
      p.z - r.min.z,
      r.max.z - p.z,
    );
    if (inside > 0) best = Math.max(best, smooth(inside / 0.9));
  }
  return best;
}

/** Crates and drums in the hold: centre, half-sizes (m). */
export const HOLD_CARGO: readonly {
  readonly at: Vec3;
  readonly half: Vec3;
  readonly drum?: boolean;
}[] = [
  { at: { x: -2.6, y: 1.55, z: -38.6 }, half: { x: 0.55, y: 0.55, z: 0.55 } },
  { at: { x: -2.6, y: 2.65, z: -38.6 }, half: { x: 0.5, y: 0.5, z: 0.5 } },
  { at: { x: -1.4, y: 1.5, z: -38.9 }, half: { x: 0.5, y: 0.5, z: 0.6 } },
  { at: { x: 2.4, y: 1.6, z: -26 }, half: { x: 0.6, y: 0.6, z: 0.6 } },
  { at: { x: 2.6, y: 2.7, z: -25.8 }, half: { x: 0.45, y: 0.45, z: 0.45 } },
  {
    at: { x: -2.7, y: 1.45, z: -27.5 },
    half: { x: 0.45, y: 0.45, z: 0.45 },
    drum: true,
  },
  {
    at: { x: -2.75, y: 1.45, z: -26.4 },
    half: { x: 0.45, y: 0.45, z: 0.45 },
    drum: true,
  },
  {
    at: { x: -1.75, y: 1.45, z: -26.9 },
    half: { x: 0.45, y: 0.45, z: 0.45 },
    drum: true,
  },
];

const box = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): ConvexCollider => boxCollider([x0, y0, z0], [x1, y1, z1]);

/** A solid block of the hull between z0 and z1 (bow or stern), from the keel to the deck. */
function hullBlock(z0: number, z1: number): ConvexCollider {
  const points: THREE.Vector3[] = [],
    top = SHIP.deck + SHIP.plate;
  for (let i = 0; i <= 8; i++) {
    const z = z0 + ((z1 - z0) * i) / 8,
      hw = Math.max(0.15, hullHalfWidth(z));
    for (const side of [-1, 1]) {
      points.push(new THREE.Vector3(side * hw, top, z));
      points.push(new THREE.Vector3(side * hw * 0.55, SHIP.keel, z));
    }
  }
  const g = new ConvexGeometry(points),
    c = rockCollider(g, new THREE.Matrix4());
  g.dispose();
  return c;
}

/** Everything solid about the ship. */
export function wreckColliders(): ConvexCollider[] {
  const s = SHIP,
    h = s.half,
    t = s.shell,
    top = s.deck + s.plate,
    hatch = s.hatch,
    br = s.breach,
    bd = s.bridge,
    out: ConvexCollider[] = [];
  // Bow and stern: solid. (The bow block is split, so each piece stays convex and close.)
  out.push(hullBlock(s.bowZ, -45), hullBlock(-45.2, s.foreZ + 0.05));
  out.push(hullBlock(s.aftZ - 0.05, s.sternZ));
  // Amidships: the sides (the starboard one open at the breach), bottom and deck.
  out.push(box(-h - 0.05, s.keel, s.foreZ, -h + t, top, s.aftZ));
  out.push(box(h - t, s.keel, s.foreZ, h + 0.05, top, br.foreZ));
  out.push(box(h - t, s.keel, br.aftZ, h + 0.05, top, s.aftZ));
  out.push(box(h - t, s.keel, br.foreZ, h + 0.05, br.low, br.aftZ));
  out.push(box(h - t, br.high, br.foreZ, h + 0.05, top, br.aftZ));
  out.push(box(-h, s.keel, s.foreZ, h, s.hold.floor, s.aftZ));
  // The bulkheads closing the hold fore and aft (the spaces beyond are sealed).
  out.push(box(-h, s.keel, s.foreZ, h, top, s.hold.foreZ));
  out.push(box(-h, s.keel, s.hold.aftZ, h, top, s.aftZ));
  // The deck around the hatch, and the hatch's coaming.
  const c = s.hatch.coaming;
  out.push(box(-h, s.deck, s.foreZ, h, top, hatch.foreZ));
  out.push(box(-h, s.deck, hatch.aftZ, h, top, s.aftZ));
  out.push(box(-h, s.deck, hatch.foreZ, -hatch.half, top, hatch.aftZ));
  out.push(box(hatch.half, s.deck, hatch.foreZ, h, top, hatch.aftZ));
  out.push(
    box(
      -hatch.half - 0.15,
      top,
      hatch.foreZ - 0.15,
      hatch.half + 0.15,
      top + c,
      hatch.foreZ,
    ),
    box(
      -hatch.half - 0.15,
      top,
      hatch.aftZ,
      hatch.half + 0.15,
      top + c,
      hatch.aftZ + 0.15,
    ),
    box(-hatch.half - 0.15, top, hatch.foreZ, -hatch.half, top + c, hatch.aftZ),
    box(hatch.half, top, hatch.foreZ, hatch.half + 0.15, top + c, hatch.aftZ),
  );
  // The bridge: walls (the front open at its door), roof, and the funnel on top.
  const w = bd.wall,
    d = bd.door;
  out.push(box(-bd.half, top, bd.aftZ - w, bd.half, bd.top, bd.aftZ));
  out.push(box(-bd.half, top, bd.foreZ, -bd.half + w, bd.top, bd.aftZ));
  out.push(box(bd.half - w, top, bd.foreZ, bd.half, bd.top, bd.aftZ));
  out.push(box(-bd.half, top, bd.foreZ, -d.half, bd.top, bd.foreZ + w));
  out.push(box(d.half, top, bd.foreZ, bd.half, bd.top, bd.foreZ + w));
  out.push(box(-d.half, d.top, bd.foreZ, d.half, bd.top, bd.foreZ + w));
  out.push(
    box(
      -bd.half - 0.1,
      bd.top,
      bd.foreZ - 0.1,
      bd.half + 0.1,
      bd.top + 0.22,
      bd.aftZ + 0.1,
    ),
  );
  const f = s.funnel;
  out.push(
    box(-f.radius, bd.top, f.z - f.radius, f.radius, f.top, f.z + f.radius),
  );
  // The wheel's binnacle and the chart table inside the bridge.
  out.push(box(-0.3, top, -20.6, 0.3, top + 1.05, -20.2));
  out.push(box(1.6, top, -18.6, 2.75, top + 0.9, -17.25));
  // The foremast.
  const m = s.mast;
  out.push(
    box(-m.radius, top, m.z - m.radius, m.radius, m.top, m.z + m.radius),
  );
  // The cargo in the hold.
  for (const k of HOLD_CARGO)
    out.push(
      box(
        k.at.x - k.half.x,
        k.at.y - k.half.y,
        k.at.z - k.half.z,
        k.at.x + k.half.x,
        k.at.y + k.half.y,
        k.at.z + k.half.z,
      ),
    );
  return out;
}

/** Soft limits in the cavern: the walls and the roof (but not in the shaft). */
export function easeInWreck(p: Readonly<Vec3>, dir: Vec3): Vec3 {
  const e = WRECK.ease,
    w = WRECK.walls,
    s = WRECK.shaft;
  if (dir.x * p.x > 0) dir.x *= ease(Math.abs(p.x) - (w.x - e.inset), e.band);
  if (dir.z < 0) dir.z *= ease(w.farZ + e.inset - p.z, e.band);
  if (dir.z > 0) dir.z *= ease(p.z - (w.nearZ - e.inset), e.band);
  if (dir.y > 0 && Math.hypot(p.x - s.x, p.z - s.z) > 1.2)
    dir.y *= ease(p.y - (WRECK.ceiling - e.up), e.band);
  return dir;
}
function ease(past: number, band: number): number {
  if (past <= 0) return 1;
  if (past < band) return 1 - 0.94 * smooth(past / band);
  return 0.06 * (1 - smooth((past - band) / 2));
}
