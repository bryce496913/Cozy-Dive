import { OUTER } from '../config/passage';
import {
  VISITING,
  WALL_VISITOR_IDS,
  type WallVisitorId,
} from '../config/visitors';
import type { Vec3 } from '../config/world';
import type { CruiseRoute } from './cruising';

/**
 * v0.6 Pass 033: when and in what order the outer reef's wall visitors come. Pure (no rendering)
 * and allocation-free per frame, so it is tested without WebGL.
 */

/** A small seeded generator (mulberry32): the same visit always brings the same order. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The order the visitors come in on visit number `visit`. The first is the next one along the
 * base order each visit, so two visits in a row never open with the same animal; the rest follow
 * in an order shuffled from the visit's number.
 */
export function visitorOrder(visit: number): WallVisitorId[] {
  const n = WALL_VISITOR_IDS.length,
    v = Number.isFinite(visit) ? Math.max(0, Math.floor(visit)) : 0,
    first = WALL_VISITOR_IDS[v % n],
    rest = WALL_VISITOR_IDS.filter((id) => id !== first),
    random = seeded(v * 7919 + 17);
  for (let i = rest.length - 1; i > 0; i--) {
    const k = Math.floor(random() * (i + 1));
    [rest[i], rest[k]] = [rest[k], rest[i]];
  }
  return [first, ...rest];
}

/** How many visitors are due after `edgeTime` seconds at the edge. */
export function visitorsDue(
  edgeTime: number,
  count: number = WALL_VISITOR_IDS.length,
): number {
  if (!(edgeTime >= VISITING.first)) return 0;
  return Math.min(
    count,
    1 + Math.floor((edgeTime - VISITING.first) / VISITING.interval),
  );
}

/** Whether the swimmer is at the wall's edge: near the lip, within the reef's swimmable width. */
export function atWallEdge(p: Readonly<Vec3>): boolean {
  const r = OUTER.reach;
  return (
    p.z < OUTER.dropOff.start + VISITING.near &&
    Math.abs(p.x) <= r.halfWidth + r.side
  );
}

/**
 * Where along `route` a visitor should start so that it is out of sight now and soon swims past
 * the eye: `lead` m before the route's closest point to the eye, and further back still until it
 * is at least `hidden` m away. Every point of the route closer than that is skipped, so it never
 * appears within sight.
 */
export function entryDistance(
  route: CruiseRoute,
  eye: Readonly<Vec3>,
  scratch: Vec3,
  lead: number = VISITING.lead,
  hidden: number = VISITING.hidden,
  step = 1,
): number {
  const far = (d: number) => {
    route.at(d, scratch);
    return Math.hypot(scratch.x - eye.x, scratch.y - eye.y, scratch.z - eye.z);
  };
  let closest = 0,
    best = Infinity;
  for (let d = 0; d < route.length; d += step) {
    const e = far(d);
    if (e < best) {
      best = e;
      closest = d;
    }
  }
  let d = closest - lead;
  for (let i = 0; i * step < route.length && far(d) < hidden; i++) d -= step;
  return ((d % route.length) + route.length) % route.length;
}

/** The visit counter's storage (local storage, or a stand-in in tests). */
export interface VisitStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
/** The number of the next visit, 0 if none is stored (or storage is corrupt or unavailable). */
export function loadVisits(store: VisitStore): number {
  try {
    const n = Number(store.getItem(VISITING.storageKey));
    return Number.isSafeInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
/** Store the number of the next visit; false if storage is unavailable. */
export function saveVisits(store: VisitStore, next: number): boolean {
  try {
    store.setItem(VISITING.storageKey, String(Math.max(0, Math.floor(next))));
    return true;
  } catch {
    return false;
  }
}
