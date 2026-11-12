import { CRUISING, type CruiseSpecies } from '../config/creatures';
import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';

/**
 * v0.4 Pass 025: how the big creatures cruise. Pure (no rendering) and allocation-free per frame.
 *
 * A creature follows a closed route at a steady speed: a smooth loop through waypoints, lifted to
 * keep its clearance over whatever lies beneath (`Obstacles`). Its place in a group is a fixed
 * lane beside and above the route. Near the swimmer it eases aside, sideways or up but never
 * down or towards them, and drifts back once they have gone. Heading, pitch and bank follow its
 * actual motion through gentle filters, and its swimming stroke is a slow oscillation with
 * optional glides.
 */

/** The highest thing (m) within `radius` of (x, z): seabed, rock or coral. */
export type Obstacles = (x: number, z: number, radius: number) => number;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** Points along a closed Catmull-Rom loop through `waypoints`, about `step` m apart. */
export function sampleLoop(
  waypoints: readonly Vec3[],
  step: number = CRUISING.step,
): Vec3[] {
  const n = waypoints.length,
    out: Vec3[] = [];
  if (n < 3) throw Error('A cruising route needs at least three waypoints');
  for (let i = 0; i < n; i++) {
    const p0 = waypoints[(i - 1 + n) % n],
      p1 = waypoints[i],
      p2 = waypoints[(i + 1) % n],
      p3 = waypoints[(i + 2) % n],
      count = Math.max(
        2,
        Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z) / step),
      );
    for (let k = 0; k < count; k++) {
      const t = k / count,
        t2 = t * t,
        t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      out.push({
        x: at(p0.x, p1.x, p2.x, p3.x),
        y: at(p0.y, p1.y, p2.y, p3.y),
        z: at(p0.z, p1.z, p2.z, p3.z),
      });
    }
  }
  return out;
}

/**
 * Raise a closed sampled route so it keeps `clearance` above the obstacles within `radius` of
 * it, smoothly: the required heights are spread over a window either side (a running maximum),
 * then averaged over the same window. Each point then still clears everything beneath it.
 */
export function liftRoute(
  samples: readonly Vec3[],
  obstacles: Obstacles,
  radius: number,
  clearance: number,
  window: number = CRUISING.liftWindow,
  step: number = CRUISING.step,
): Vec3[] {
  const n = samples.length,
    w = Math.max(0, Math.round(window / step)),
    need = samples.map((p) =>
      Math.max(p.y, obstacles(p.x, p.z, radius) + clearance),
    ),
    spread = need.map((_, i) => {
      let m = -Infinity;
      for (let k = -w; k <= w; k++) m = Math.max(m, need[(i + k + n) % n]);
      return m;
    });
  return samples.map((p, i) => {
    let sum = 0;
    for (let k = -w; k <= w; k++) sum += spread[(i + k + n) % n];
    return { x: p.x, y: sum / (2 * w + 1), z: p.z };
  });
}

/** A closed polyline travelled by distance. */
export class CruiseRoute {
  readonly length: number;
  private readonly xyz: Float64Array;
  private readonly cumulative: Float64Array;
  constructor(samples: readonly Vec3[]) {
    const n = samples.length;
    if (n < 3) throw Error('A cruising route needs at least three points');
    this.xyz = new Float64Array(n * 3);
    this.cumulative = new Float64Array(n + 1);
    samples.forEach((p, i) => {
      this.xyz[i * 3] = p.x;
      this.xyz[i * 3 + 1] = p.y;
      this.xyz[i * 3 + 2] = p.z;
    });
    for (let i = 0; i < n; i++) {
      const a = samples[i],
        b = samples[(i + 1) % n];
      this.cumulative[i + 1] =
        this.cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    this.length = this.cumulative[n];
  }
  /** The point `distance` m along the loop (any distance; it wraps). */
  at(distance: number, out: Vec3): Vec3 {
    const n = this.cumulative.length - 1,
      d = ((distance % this.length) + this.length) % this.length;
    let lo = 0,
      hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] <= d) lo = mid;
      else hi = mid;
    }
    const span = this.cumulative[lo + 1] - this.cumulative[lo],
      t = span > 0 ? (d - this.cumulative[lo]) / span : 0,
      a = lo * 3,
      b = ((lo + 1) % n) * 3;
    out.x = this.xyz[a] + (this.xyz[b] - this.xyz[a]) * t;
    out.y = this.xyz[a + 1] + (this.xyz[b + 1] - this.xyz[a + 1]) * t;
    out.z = this.xyz[a + 2] + (this.xyz[b + 2] - this.xyz[a + 2]) * t;
    return out;
  }
  /** Unit direction of travel at `distance` (central difference over `span` m). */
  direction(distance: number, out: Vec3, span = 1): Vec3 {
    const ax = this.at(distance + span, out).x,
      ay = out.y,
      az = out.z;
    this.at(distance - span, out);
    const dx = ax - out.x,
      dy = ay - out.y,
      dz = az - out.z,
      l = Math.hypot(dx, dy, dz) || 1;
    out.x = dx / l;
    out.y = dy / l;
    out.z = dz / l;
    return out;
  }
}

export interface CruiserPlacement {
  /** Where along the route it starts (m). */
  readonly start: number;
  /** Fixed place in its group: to the right of the route and above it (m). */
  readonly side: number;
  readonly up: number;
  /** Stroke phase offset (radians), so a group does not beat in unison. */
  readonly phase: number;
}

/** One big creature cruising its route. */
export class Cruiser {
  /** Where it is now (updated in place; sightings read it). */
  readonly position: Vec3 = { x: 0, y: 0, z: 0 };
  /** Heading about +Y (0 faces +X, positive turns towards -Z), pitch up, bank (roll). */
  yaw = 0;
  pitch = 0;
  bank = 0;
  /** Current stroke, -1..1: the runtime blends Stroke_Left (+) and Stroke_Right (-). */
  effort = 0;
  /** How far it has moved off its route to give the swimmer room (m). */
  get aside(): number {
    return Math.hypot(this.offset.x, this.offset.y, this.offset.z);
  }
  private distance: number;
  private phase: number;
  private time = 0;
  private readonly offset: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly base: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly tangent: Vec3 = { x: 1, y: 0, z: 0 };
  private readonly previous: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly ahead: Vec3 = { x: 0, y: 0, z: 0 };
  /** The side it moves to while giving way (unit), fixed for each encounter. */
  private readonly away: Vec3 = { x: 0, y: 0, z: 0 };
  private engaged = false;
  constructor(
    readonly species: CruiseSpecies,
    readonly route: CruiseRoute,
    private readonly placement: CruiserPlacement,
  ) {
    this.distance = placement.start;
    this.phase = placement.phase;
    this.place();
    this.previous.x = this.position.x;
    this.previous.y = this.position.y;
    this.previous.z = this.position.z;
    const t = this.tangent;
    this.yaw = Math.atan2(-t.z, t.x);
    this.pitch = this.clampPitch(Math.atan2(t.y, Math.hypot(t.x, t.z)));
  }
  private clampPitch(p: number): number {
    return Math.max(-CRUISING.maxPitch, Math.min(CRUISING.maxPitch, p));
  }
  /** Base point on the route plus the group lane, and the route's direction there. */
  private place(): void {
    const b = this.base,
      t = this.tangent;
    this.route.at(this.distance, b);
    this.route.direction(this.distance, t);
    const h = Math.hypot(t.x, t.z) || 1;
    // Right of the direction of travel (facing +X, right is +Z).
    b.x += (-t.z / h) * this.placement.side;
    b.z += (t.x / h) * this.placement.side;
    b.y += this.placement.up;
    this.position.x = b.x + this.offset.x;
    this.position.y = b.y + this.offset.y;
    this.position.z = b.z + this.offset.z;
  }
  update(dt: number, player?: PlayerPresence, reducedMotion = false): void {
    if (!(dt > 0)) return;
    const s = this.species;
    this.distance += s.speed * dt;
    this.place();
    // Give way: aside from the line of travel, away from the swimmer; up rather than down. The
    // side is chosen once per encounter (so passing the swimmer never flips it), and the route a
    // little ahead counts too, so it starts moving aside before it arrives.
    let tx = 0,
      ty = 0,
      tz = 0;
    if (player?.active) {
      const b = this.base,
        p = player.position,
        t = this.tangent,
        a = this.route.at(
          this.distance + s.speed * CRUISING.lookAhead,
          this.ahead,
        ),
        d = Math.min(
          Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z),
          Math.hypot(a.x - p.x, a.y - p.y, a.z - p.z),
        ),
        strength = smoothstep(0, 1, 1 - d / s.comfort);
      if (strength > 0) {
        const away = this.away;
        if (!this.engaged) {
          this.engaged = true;
          away.x = b.x - p.x;
          away.y = b.y - p.y;
          away.z = b.z - p.z;
        }
        // Keep the chosen side square to the current direction of travel, and never downwards.
        const along = away.x * t.x + away.y * t.y + away.z * t.z;
        let ax = away.x - along * t.x,
          ay = Math.max(0, away.y - along * t.y),
          az = away.z - along * t.z,
          l = Math.hypot(ax, ay, az);
        if (l < 1e-3) {
          // Straight ahead on its line: step to its right.
          const h = Math.hypot(t.x, t.z) || 1;
          ax = -t.z / h;
          ay = 0;
          az = t.x / h;
          l = 1;
        }
        away.x = ax / l;
        away.y = ay / l;
        away.z = az / l;
        const k = s.giveWay * strength;
        tx = away.x * k;
        ty = away.y * k;
        tz = away.z * k;
      } else this.engaged = false;
    } else this.engaged = false;
    const g = approach(CRUISING.giveWayResponse, dt),
      o = this.offset;
    o.x += (tx - o.x) * g;
    o.y += (ty - o.y) * g;
    o.z += (tz - o.z) * g;
    const q = this.position;
    q.x = this.base.x + o.x;
    q.y = this.base.y + o.y;
    q.z = this.base.z + o.z;
    // Face along the actual motion, through gentle filters; bank into turns.
    const vx = q.x - this.previous.x,
      vy = q.y - this.previous.y,
      vz = q.z - this.previous.z,
      h = Math.hypot(vx, vz);
    this.previous.x = q.x;
    this.previous.y = q.y;
    this.previous.z = q.z;
    if (h > 1e-6) {
      const turn = approach(CRUISING.turnResponse, dt),
        change = wrapAngle(Math.atan2(-vz, vx) - this.yaw) * turn;
      this.yaw = wrapAngle(this.yaw + change);
      this.pitch += (this.clampPitch(Math.atan2(vy, h)) - this.pitch) * turn;
      const bankTarget = reducedMotion
        ? 0
        : Math.max(
            -CRUISING.maxBank,
            Math.min(CRUISING.maxBank, -(change / dt) * s.bank),
          );
      this.bank +=
        (bankTarget - this.bank) * approach(CRUISING.bankResponse, dt);
    }
    // Stroke, resting between bouts when it glides.
    this.time += dt;
    this.phase = (this.phase + Math.PI * 2 * s.strokeHz * dt) % (Math.PI * 2);
    let envelope = 1;
    if (s.glide) {
      const c = (this.time / s.glide.period + this.placement.phase / 7) % 1,
        rest = 1 - s.glide.share;
      envelope =
        1 - smoothstep(rest, rest + 0.08, c) * (1 - smoothstep(0.94, 1, c));
    }
    this.effort =
      s.stroke *
      envelope *
      Math.sin(this.phase) *
      (reducedMotion ? CRUISING.reducedStroke : 1);
  }
}
