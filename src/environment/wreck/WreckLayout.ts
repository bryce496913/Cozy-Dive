import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { WRECK } from '../../config/wreck';
import type { Vec3 } from '../../config/world';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockCollider } from '../rockCollider';

/**
 * The shipwreck's shape and spaces (pure but for building hulls): an old steel freighter settled
 * on the cavern's sand with a slight list to port and her bow a little down. Shared by its meshes,
 * its collision and the torch. Everything here is in the ship's own frame (bow towards -z, keel at
 * y 0.1, centreline x 0); `SHIP_POSE` places that frame in the cavern.
 *
 *   - the **hold**, below the main deck amidships, entered through the open cargo hatch or a rusted
 *     breach low in the starboard (+x) side;
 *   - the **deckhouse** aft, entered through its door, facing forward; the wheelhouse above it,
 *     its wings, the funnel and the boat davits are solid;
 *   - a raised **forecastle** at the bow, with the windlass and the anchors.
 */
export const SHIP = {
  bowZ: -49,
  sternZ: -14.2,
  /** Where the straight sides run (the hold lies within them). */
  foreZ: -41,
  aftZ: -20,
  half: 4,
  keel: 0.1,
  deck: 6.5,
  /** The deck plating's thickness, and the hull plating's. */
  plate: 0.25,
  shell: 0.22,
  /** The solid steel bulwark standing up round the deck's edge (m above the deck). */
  bulwark: 0.95,
  /** The forecastle: a deck raised over the bow, from the stem back to `aftZ`. */
  forecastle: { aftZ: -43.6, rise: 2.2 },
  /** How far the stem rakes forward (m per m of height), and the stern's undercut below the counter. */
  rake: 0.32,
  undercut: 2.6,
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
  /** The wheelhouse on the deckhouse's roof, and its wings out to either side. */
  wheelhouse: { foreZ: -21.5, aftZ: -18.6, half: 2.2, top: 11.9 },
  wings: { half: 4.3, foreZ: -21.3, aftZ: -20.3 },
  funnel: { z: -17.6, rx: 0.7, rz: 0.75, top: 13.6, rake: 0.14 },
  mast: { z: -42.2, top: 15.5, radius: 0.17 },
} as const;

/** How the wreck lies: settled `sink` m into the sand, listing and a little down by the head. */
export const SHIP_LIE = {
  sink: 0.45,
  list: 0.1,
  trim: -0.018,
  pivotZ: -32,
} as const;
/** The ship's frame in the cavern. */
export const SHIP_POSE: THREE.Matrix4 = new THREE.Matrix4()
  .makeTranslation(0, -SHIP_LIE.sink, SHIP_LIE.pivotZ)
  .multiply(
    new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(SHIP_LIE.trim, 0, SHIP_LIE.list, 'ZXY'),
    ),
  )
  .multiply(new THREE.Matrix4().makeTranslation(0, 0, -SHIP_LIE.pivotZ));
const SHIP_INVERSE = SHIP_POSE.clone().invert();
const scratch = new THREE.Vector3();
/** A point in the ship's frame, placed in the cavern (into `out`). */
export function fromShip(p: Readonly<Vec3>, out: Vec3): Vec3 {
  scratch.set(p.x, p.y, p.z).applyMatrix4(SHIP_POSE);
  out.x = scratch.x;
  out.y = scratch.y;
  out.z = scratch.z;
  return out;
}
/** A point in the cavern, in the ship's frame (into `out`). */
export function toShip(p: Readonly<Vec3>, out: Vec3): Vec3 {
  scratch.set(p.x, p.y, p.z).applyMatrix4(SHIP_INVERSE);
  out.x = scratch.x;
  out.y = scratch.y;
  out.z = scratch.z;
  return out;
}

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The hull's half-breadth at deck level (m) at z: fine at the bow, full amidships, a round stern. */
export function hullHalfWidth(z: number): number {
  const s = SHIP;
  if (z <= s.bowZ || z >= s.sternZ) return 0;
  if (z < s.foreZ) {
    const t = (z - s.bowZ) / (s.foreZ - s.bowZ);
    return s.half * Math.pow(Math.sin((t * Math.PI) / 2), 0.75);
  }
  if (z > s.aftZ) {
    // A cruiser stern: drawing in, then rounding off.
    const t = (s.sternZ - z) / (s.sternZ - s.aftZ);
    return s.half * Math.pow(Math.sin((t * Math.PI) / 2), 0.42);
  }
  return s.half;
}
/** The main deck's top. */
export const DECK_TOP = SHIP.deck + SHIP.plate;
/** The top of the deck at z: the forecastle's over the bow, the main deck elsewhere. */
export function deckTopAt(z: number): number {
  return z < SHIP.forecastle.aftZ ? DECK_TOP + SHIP.forecastle.rise : DECK_TOP;
}
/** The top of the hull's side (the bulwark's rail) at z, with a little sheer aft. */
export function railAt(z: number): number {
  return (
    deckTopAt(z) +
    SHIP.bulwark +
    0.35 * smooth((z - SHIP.aftZ) / (SHIP.sternZ - SHIP.aftZ))
  );
}
/**
 * How far out the hull's side is (m) at (z, y): the deck-level breadth, rounded in at the bilge,
 * the stem raked forward and flared above the deck at the bow, the stern cut away below its
 * counter for the rudder and propeller.
 */
export function hullX(z: number, y: number): number {
  const s = SHIP,
    v = Math.max(0, Math.min(1, (y - s.keel) / (DECK_TOP - s.keel))),
    fine = smooth((s.foreZ - z) / (s.foreZ - s.bowZ)),
    aft = smooth((z - s.aftZ) / (s.sternZ - s.aftZ)),
    // The stem leans forward as it rises; the stern's lower body ends short of the counter.
    shifted =
      z + fine * s.rake * (y - s.keel) + aft * s.undercut * (1 - v) * (1 - v),
    breadth = hullHalfWidth(shifted),
    p = 6 - 4.4 * fine,
    section = Math.pow(1 - Math.pow(1 - v, p), 1 / p),
    flare = 1 + 0.1 * fine * Math.max(0, y - DECK_TOP);
  return breadth * section * flare;
}

/** The cavern's sandy floor (m): low ripples, sand heaped against the hull, banking up to the walls. */
export function wreckFloor(x: number, z: number): number {
  const w = WRECK.walls,
    ripple =
      0.12 * Math.sin(x * 0.9 + z * 0.35) +
      0.25 * Math.sin(x * 0.17 - z * 0.11 + 1.2) +
      0.18 * Math.sin(z * 0.23 + 0.4),
    heap =
      z > SHIP.bowZ - 2 && z < SHIP.sternZ + 2
        ? 0.7 * (1 - smooth((Math.abs(x) - SHIP.half) / 3))
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
/** The two spaces inside the ship (its frame), as the swimmer's centre may occupy them. */
export const WRECK_ROOMS: readonly Room[] = [
  {
    min: { x: -SHIP.half + SHIP.shell, y: SHIP.hold.floor, z: SHIP.hold.foreZ },
    max: { x: SHIP.half - SHIP.shell, y: SHIP.deck, z: SHIP.hold.aftZ },
  },
  {
    min: {
      x: -SHIP.bridge.half + SHIP.bridge.wall,
      y: DECK_TOP,
      z: SHIP.bridge.foreZ + SHIP.bridge.wall,
    },
    max: {
      x: SHIP.bridge.half - SHIP.bridge.wall,
      y: SHIP.bridge.top,
      z: SHIP.bridge.aftZ - SHIP.bridge.wall,
    },
  },
];
const local: Vec3 = { x: 0, y: 0, z: 0 };
/**
 * How dark it is at `p` in the cavern (0 outside … 1 well inside the ship): it deepens over the
 * first metre in from a room's walls and openings, so the torch comes on as the swimmer slips in.
 */
export function wreckShade(p: Readonly<Vec3>): number {
  const q = toShip(p, local);
  let best = 0;
  for (const r of WRECK_ROOMS) {
    const inside = Math.min(
      q.x - r.min.x,
      r.max.x - q.x,
      q.y - r.min.y,
      r.max.y - q.y,
      q.z - r.min.z,
      r.max.z - q.z,
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

/** Deck gear (ship's frame): kind, centre and half-sizes, and a yaw. Each is solid. */
export const DECK_GEAR: readonly {
  readonly kind: 'winch' | 'vent' | 'bollard' | 'windlass';
  readonly at: Vec3;
  readonly yaw: number;
}[] = [
  { kind: 'windlass', at: { x: 0, y: DECK_TOP + 2.2, z: -46.2 }, yaw: 0 },
  { kind: 'winch', at: { x: -1.2, y: DECK_TOP, z: -34.6 }, yaw: 0 },
  { kind: 'winch', at: { x: 1.2, y: DECK_TOP, z: -27.4 }, yaw: Math.PI },
  { kind: 'vent', at: { x: -2.6, y: DECK_TOP, z: -36.5 }, yaw: 0.4 },
  { kind: 'vent', at: { x: 2.6, y: DECK_TOP, z: -25.5 }, yaw: Math.PI - 0.5 },
  {
    kind: 'vent',
    at: { x: 2.3, y: SHIP.bridge.top + 0.22, z: -17.6 },
    yaw: 2.6,
  },
  { kind: 'bollard', at: { x: -3.2, y: DECK_TOP, z: -39 }, yaw: 0 },
  { kind: 'bollard', at: { x: 3.2, y: DECK_TOP, z: -39 }, yaw: 0 },
  { kind: 'bollard', at: { x: -3.2, y: DECK_TOP, z: -23 }, yaw: 0 },
  { kind: 'bollard', at: { x: 3.2, y: DECK_TOP, z: -23 }, yaw: 0 },
];
/** Each gear piece's footprint (half-sizes, m) and height. */
export const GEAR_SIZE = {
  winch: { x: 0.7, z: 0.45, h: 0.9 },
  vent: { x: 0.28, z: 0.28, h: 1.6 },
  bollard: { x: 0.18, z: 0.45, h: 0.55 },
  windlass: { x: 1.1, z: 0.5, h: 0.8 },
} as const;
/** The cargo derrick, broken from the mast and lying across the deck: its two ends. */
export const BOOM: {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly radius: number;
} = {
  from: { x: -0.6, y: DECK_TOP + 0.25, z: -41.4 },
  to: { x: 2.4, y: DECK_TOP + 0.7, z: -33.6 },
  radius: 0.16,
};

const box = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): ConvexCollider => boxCollider([x0, y0, z0], [x1, y1, z1]);
/** A convex hull of points as a collider (the ship's frame). */
function hull(points: THREE.Vector3[]): ConvexCollider {
  const g = new ConvexGeometry(points),
    c = rockCollider(g, new THREE.Matrix4());
  g.dispose();
  return c;
}
/** A solid block of the hull between z0 and z1 (bow or stern), from the keel to `top`. */
function hullBlock(z0: number, z1: number, top: number): ConvexCollider {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const z = z0 + ((z1 - z0) * i) / 10;
    for (const y of [SHIP.keel, 1.5, 3.5, DECK_TOP, top]) {
      const x = hullX(z, Math.min(y, top));
      // Only where there is hull (the stem rakes forward, so the bow's lower end stops sooner).
      if (x > 0.05)
        points.push(new THREE.Vector3(x, y, z), new THREE.Vector3(-x, y, z));
    }
  }
  return hull(points);
}
/** A thin wall following the hull's side between z0 and z1, from `y0` up to the rail. */
function bulwark(z0: number, z1: number, side: number): ConvexCollider {
  const points: THREE.Vector3[] = [];
  for (const z of [z0, z1]) {
    const x = side * hullX(z, deckTopAt(z)),
      inward = -side * SHIP.shell;
    for (const y of [deckTopAt(z) - 0.1, railAt(z)])
      points.push(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x + inward, y, z),
      );
  }
  return hull(points);
}
/** A rod between two points as a solid square beam (the derrick). */
function beam(a: Readonly<Vec3>, b: Readonly<Vec3>, r: number): ConvexCollider {
  const points: THREE.Vector3[] = [];
  for (const p of [a, b])
    for (const dx of [-r, r])
      for (const dy of [-r, r])
        for (const dz of [-r, r])
          points.push(new THREE.Vector3(p.x + dx, p.y + dy, p.z + dz));
  return hull(points);
}
/** A collider moved into the cavern by `m` (rigid): planes turned, bounds re-taken. */
function placed(c: ConvexCollider, m: THREE.Matrix4): ConvexCollider {
  const n = new THREE.Vector3(),
    t = new THREE.Vector3().setFromMatrixPosition(m),
    rot = new THREE.Matrix3().setFromMatrix4(m),
    lo = new THREE.Vector3(Infinity, Infinity, Infinity),
    hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity),
    corner = new THREE.Vector3();
  const planes = c.planes.map((p) => {
    n.set(p.x, p.y, p.z).applyMatrix3(rot);
    return { x: n.x, y: n.y, z: n.z, offset: p.offset + n.dot(t) };
  });
  for (const x of [c.min.x, c.max.x])
    for (const y of [c.min.y, c.max.y])
      for (const z of [c.min.z, c.max.z]) {
        corner.set(x, y, z).applyMatrix4(m);
        lo.min(corner);
        hi.max(corner);
      }
  return {
    planes,
    min: { x: lo.x, y: lo.y, z: lo.z },
    max: { x: hi.x, y: hi.y, z: hi.z },
  };
}

/** Everything solid about the ship, placed where she lies in the cavern. */
export function wreckColliders(): ConvexCollider[] {
  const s = SHIP,
    h = s.half,
    t = s.shell,
    top = DECK_TOP,
    hatch = s.hatch,
    br = s.breach,
    bd = s.bridge,
    fc = s.forecastle,
    out: ConvexCollider[] = [];
  // The bow, under its forecastle, and the main deck's forward end; the stern: solid.
  out.push(
    hullBlock(s.bowZ - 3, -46, top + fc.rise),
    hullBlock(-46.2, fc.aftZ, top + fc.rise),
    hullBlock(fc.aftZ - 0.05, s.foreZ + 0.05, top),
    hullBlock(s.aftZ - 0.05, s.sternZ, top),
  );
  // Bulwarks along the bow and stern, a segment at a time; amidships they top the side plating.
  for (const side of [-1, 1]) {
    for (let z = s.bowZ + 0.4; z < s.foreZ; z += 1.2)
      out.push(bulwark(z, Math.min(z + 1.3, s.foreZ + 0.1), side));
    for (let z = s.aftZ - 0.1; z < s.sternZ - 0.6; z += 1.2)
      out.push(bulwark(z, Math.min(z + 1.3, s.sternZ - 0.4), side));
  }
  // Amidships: the sides (the starboard one open at the breach), bottom and deck.
  const rail = railAt(s.foreZ);
  out.push(box(-h - 0.05, s.keel, s.foreZ, -h + t, rail, s.aftZ));
  out.push(box(h - t, s.keel, s.foreZ, h + 0.05, rail, br.foreZ));
  out.push(box(h - t, s.keel, br.aftZ, h + 0.05, rail, s.aftZ));
  out.push(box(h - t, s.keel, br.foreZ, h + 0.05, br.low, br.aftZ));
  out.push(box(h - t, br.high, br.foreZ, h + 0.05, rail, br.aftZ));
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
  // The deckhouse: walls (the front open at its door) and roof.
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
  // The wheelhouse on top, its wings and visor, and the funnel behind it.
  const wh = s.wheelhouse,
    wg = s.wings,
    roof = bd.top + 0.22;
  out.push(box(-wh.half, roof, wh.foreZ, wh.half, wh.top + 0.18, wh.aftZ));
  out.push(box(-wg.half, roof, wg.foreZ, wg.half, roof + 0.12, wg.aftZ));
  const f = s.funnel,
    lean = Math.tan(f.rake) * (f.top - roof);
  out.push(
    hull(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sz) => [
          new THREE.Vector3(sx * f.rx, roof, f.z + sz * f.rz),
          new THREE.Vector3(
            sx * f.rx * 0.95,
            f.top,
            f.z + lean + sz * f.rz * 0.95,
          ),
        ]),
      ),
    ),
  );
  // The binnacle and the chart table inside the deckhouse.
  out.push(box(-0.3, top, -20.6, 0.3, top + 1.05, -20.2));
  out.push(box(1.6, top, -18.6, 2.75, top + 0.9, -17.25));
  // The foremast, the fallen derrick, and the deck gear.
  const m = s.mast;
  out.push(
    box(-m.radius, top, m.z - m.radius, m.radius, m.top, m.z + m.radius),
  );
  out.push(beam(BOOM.from, BOOM.to, BOOM.radius));
  for (const g of DECK_GEAR) {
    const size = GEAR_SIZE[g.kind],
      r = Math.max(size.x, size.z);
    out.push(
      box(
        g.at.x - r,
        g.at.y,
        g.at.z - r,
        g.at.x + r,
        g.at.y + size.h,
        g.at.z + r,
      ),
    );
  }
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
  return out.map((c) => placed(c, SHIP_POSE));
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
