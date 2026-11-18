import { ICE } from '../config/passage';
import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishPose } from '../environment/outer/PosedFish';
import { keepInIce, type IceLimits } from './iceLife';
import {
  createSwim,
  Seeded,
  swimTo,
  turnTo,
  type Swim,
} from './reefEncounters';

/**
 * v0.6 Pass 048: rare encounters under the ice. Pure (no rendering), allocation-free per frame,
 * deterministic for a seed. A director brings one at a time, now and then, never in the first
 * minute or so, and never the same one twice running:
 *
 *   - a leopard seal comes in from the far haze to look at the swimmer from a few metres, circling
 *     side-on with its head turned to them, then glides away;
 *   - a minke whale drops in through the big breathing hole, makes one long, slow pass across the far
 *     side of the tank, and rises out through it again;
 *   - three killer whales come in through a hole and sweep round the tank together, well away from
 *     the swimmer, then leave the way they came;
 *   - an Antarctic toothfish rises slowly out of the dark far corner, hangs a while, and sinks back;
 *   - a colossal squid's huge eyes glow for a moment, low in the dark at the far end, then are gone;
 *   - a polar bear paddles at a breathing hole (seen from below), dives down for a look round, and
 *     climbs back out (by request: polar bears live only in the Arctic).
 *
 * Each has an entrance (from out of sight, or through a hole in the ice), its behaviour, and a
 * departure; it keeps to the water (above the seabed, below the ice, inside the walls) except where
 * it passes through a hole.
 */
export type RareId =
  | 'leopard-seal'
  | 'minke-whale'
  | 'killer-whales'
  | 'toothfish'
  | 'colossal-squid'
  | 'polar-bear';
export const RARE_IDS: readonly RareId[] = [
  'leopard-seal',
  'minke-whale',
  'killer-whales',
  'toothfish',
  'colossal-squid',
  'polar-bear',
];

export const RARE = {
  /** Seconds before the first can come, and between one leaving and the next coming. */
  // v0.6 Pass 052 (playtest: "there are no creatures"): the first comes sooner, and they come more often.
  first: [25, 55] as const,
  gap: [45, 90] as const,
  /** Nothing appears within this distance of the swimmer (m): out of sight in the far water. */
  hidden: 24,
} as const;

const dist = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const hole = (i: number) => ICE.holes[i % ICE.holes.length];

/** One encounter: begins (if it can, given where the swimmer is), runs, and ends itself. */
export interface Encounter {
  readonly id: RareId;
  readonly active: boolean;
  /** Its animals' poses (one, or the pod's). */
  readonly poses: readonly FishPose[];
  begin(player: Readonly<Vec3>): boolean;
  update(dt: number, player: PlayerPresence, reducedMotion: boolean): void;
  /** Leave now (when the swimmer leaves the area). */
  end(): void;
}

/** A point at least `RARE.hidden` m from the swimmer, in the tank (one of a few far places). */
function farPoint(
  l: IceLimits,
  e: Readonly<Vec3>,
  out: Vec3,
  y: number,
): boolean {
  const corners = [
    [l.minX + 1, l.minZ + 1],
    [l.maxX - 1, l.minZ + 1],
    [l.minX + 1, (l.minZ + l.maxZ) / 2],
    [l.maxX - 1, (l.minZ + l.maxZ) / 2],
  ];
  let best = -1,
    bestD = -Infinity;
  corners.forEach(([x, z], i) => {
    const d = Math.hypot(x - e.x, z - e.z);
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  });
  out.x = corners[best][0];
  out.z = corners[best][1];
  out.y = y;
  keepInIce(l, out, 1.5, 2);
  return bestD >= RARE.hidden;
}

// ------------------------------------------------------------------ leopard seal

export const LEOPARD = {
  look: 4.5,
  stay: [14, 22] as const,
  speed: 1.2,
} as const;
class LeopardSeal implements Encounter {
  readonly id = 'leopard-seal' as const;
  active = false;
  readonly swim: Swim;
  readonly poses: FishPose[];
  private mood: 'come' | 'look' | 'go' = 'come';
  private clock = 0;
  private stay = 0;
  private angle = 0;
  private readonly out: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  constructor(
    pose: FishPose,
    private readonly l: IceLimits,
    private readonly rand: Seeded,
  ) {
    this.swim = createSwim(pose);
    this.poses = [pose];
  }
  begin(e: Readonly<Vec3>): boolean {
    if (!farPoint(this.l, e, this.swim.pose.position, e.y)) return false;
    Object.assign(this.out, this.swim.pose.position);
    this.mood = 'come';
    this.clock = 0;
    this.stay = this.rand.between(LEOPARD.stay);
    this.active = true;
    return true;
  }
  update(dt: number, player: PlayerPresence, reducedMotion: boolean): void {
    if (!this.active) return;
    this.clock += dt;
    const p = this.swim.pose.position,
      e = player.position,
      a = this.aim;
    if (this.mood === 'come') {
      // Towards a spot `look` m from the swimmer, on its own side.
      const dx = p.x - e.x,
        dz = p.z - e.z,
        l = Math.hypot(dx, dz) || 1;
      a.x = e.x + (dx / l) * LEOPARD.look;
      a.z = e.z + (dz / l) * LEOPARD.look;
      a.y = e.y;
      keepInIce(this.l, a, 1.2, 1.5);
      if (
        swimTo(this.swim, a.x, a.y, a.z, LEOPARD.speed, dt, 0.9, 1.4) < 1 ||
        this.clock > 40
      ) {
        this.mood = 'look';
        this.clock = 0;
        this.angle = Math.atan2(p.z - e.z, p.x - e.x);
      }
    } else if (this.mood === 'look') {
      // Circling slowly, side-on, its big head turned to the swimmer; never closer than `look`.
      this.angle += dt * (reducedMotion ? 0.06 : 0.12);
      a.x = e.x + Math.cos(this.angle) * LEOPARD.look;
      a.z = e.z + Math.sin(this.angle) * LEOPARD.look;
      a.y = e.y + 0.3 * Math.sin(this.clock * 0.4);
      keepInIce(this.l, a, 1.2, 1.5);
      swimTo(this.swim, a.x, a.y, a.z, 0.6, dt, 0.6, 1.2);
      turnTo(this.swim, Math.atan2(-(e.z - p.z), e.x - p.x), dt, 1.2);
      if (this.clock > this.stay || !player.active) {
        this.mood = 'go';
        this.clock = 0;
        farPoint(this.l, e, this.out, e.y);
      }
    } else {
      swimTo(
        this.swim,
        this.out.x,
        this.out.y,
        this.out.z,
        LEOPARD.speed * 1.3,
        dt,
        1,
        1.2,
      );
      if (dist(p, e) > RARE.hidden || this.clock > 45) this.end();
    }
    // Never into the swimmer.
    const d = dist(p, e);
    if (player.active && d < LEOPARD.look - 1.5 && d > 1e-6) {
      const k = (LEOPARD.look - 1.5) / d;
      p.x = e.x + (p.x - e.x) * k;
      p.z = e.z + (p.z - e.z) * k;
    }
    keepInIce(this.l, p, 1, 1.2);
  }
  end(): void {
    this.active = false;
  }
}

// ------------------------------------------------------------------ whales through a hole

/** Animals that come down through a breathing hole, make a pass, and leave up through it. */
class ThroughHole implements Encounter {
  active = false;
  readonly swims: Swim[];
  readonly poses: FishPose[];
  private mood: 'down' | 'pass' | 'up' = 'down';
  private clock = 0;
  private hole = 0;
  private readonly path: Vec3[] = [];
  private leg = 0;
  constructor(
    readonly id: RareId,
    makePose: () => FishPose,
    count: number,
    private readonly l: IceLimits,
    private readonly speed: number,
    /** The pass: way-points relative to the far half of the tank (fractions of its size). */
    private readonly route: readonly (readonly [number, number])[],
    private readonly depth: number,
    private readonly gap: number,
  ) {
    this.swims = Array.from({ length: count }, () => createSwim(makePose()));
    this.poses = this.swims.map((s) => s.pose);
    for (const s of this.swims) s.pose.position.y = ICE.ceiling + 6;
    for (let i = 0; i < route.length; i++) this.path.push({ x: 0, y: 0, z: 0 });
  }
  begin(e: Readonly<Vec3>): boolean {
    // The hole furthest from the swimmer, and a pass on the far side of the tank from them.
    let best = 0;
    ICE.holes.forEach((h, i) => {
      if (
        Math.hypot(h.x - e.x, h.z - e.z) >
        Math.hypot(hole(best).x - e.x, hole(best).z - e.z)
      )
        best = i;
    });
    const h = hole(best);
    if (Math.hypot(h.x - e.x, h.z - e.z) < 14) return false;
    this.hole = best;
    const l = this.l,
      farZ = e.z > (l.minZ + l.maxZ) / 2 ? l.minZ : l.maxZ,
      farX = e.x > 0 ? l.minX : l.maxX;
    this.route.forEach(([fx, fz], i) => {
      const p = this.path[i];
      p.x = farX + (0 - farX) * fx * 2;
      p.z = farZ + ((l.minZ + l.maxZ) / 2 - farZ) * fz;
      p.y = l.ceiling - this.depth;
      keepInIce(l, p, 3, 2);
    });
    this.swims.forEach((s, i) => {
      s.pose.position.x = h.x;
      s.pose.position.y = ICE.ceiling + 3 + i * this.gap;
      s.pose.position.z = h.z;
      s.v.x = s.v.y = s.v.z = 0;
    });
    this.mood = 'down';
    this.leg = 0;
    this.clock = 0;
    this.active = true;
    return true;
  }
  update(dt: number, player: PlayerPresence): void {
    if (!this.active) return;
    this.clock += dt;
    const h = hole(this.hole),
      lead = this.swims[0];
    if (this.mood === 'down') {
      if (
        swimTo(
          lead,
          h.x,
          this.l.ceiling - this.depth,
          h.z,
          this.speed * 0.6,
          dt,
          0.4,
          1.2,
        ) < 1
      )
        this.mood = 'pass';
    } else if (this.mood === 'pass') {
      const w = this.path[this.leg];
      if (
        swimTo(lead, w.x, w.y, w.z, this.speed, dt, 0.45, 0.8) < 2.5 &&
        ++this.leg >= this.path.length
      )
        this.mood = 'up';
    } else {
      swimTo(lead, h.x, ICE.ceiling + 4, h.z, this.speed * 0.6, dt, 0.4, 1);
      if (
        this.swims.every((s) => s.pose.position.y > ICE.ceiling + 2) ||
        this.clock > 240
      )
        this.end();
    }
    // The others follow in line, a body length or two behind; near the ice (on the way in or out),
    // straight up or down through the hole, never sideways through the ice.
    for (let i = 1; i < this.swims.length; i++) {
      const me = this.swims[i],
        q = me.pose.position,
        ahead = this.swims[i - 1].pose.position;
      let tx = ahead.x - this.gap * Math.cos(this.swims[i - 1].pose.yaw),
        ty = ahead.y + (i % 2 ? 0.8 : -0.8),
        tz = ahead.z + this.gap * Math.sin(this.swims[i - 1].pose.yaw);
      if (q.y > this.l.ceiling - 1.5 || ty > this.l.ceiling - 1.5) {
        tx = h.x;
        tz = h.z;
        if (this.mood !== 'up') ty = Math.min(ty, this.l.ceiling - this.depth);
      }
      swimTo(me, tx, ty, tz, this.speed * 1.1, dt, 0.45, 1);
      // Inside the ice, held to the hole's column.
      if (q.y > this.l.ceiling - 0.5) {
        const dx = q.x - h.x,
          dz = q.z - h.z,
          r = Math.hypot(dx, dz),
          max = h.r * 0.6;
        if (r > max) {
          q.x = h.x + (dx / r) * max;
          q.z = h.z + (dz / r) * max;
        }
      }
    }
    // The leader too.
    {
      const q = lead.pose.position;
      if (q.y > this.l.ceiling - 0.5) {
        const dx = q.x - h.x,
          dz = q.z - h.z,
          r = Math.hypot(dx, dz),
          max = h.r * 0.6;
        if (r > max) {
          q.x = h.x + (dx / r) * max;
          q.z = h.z + (dz / r) * max;
        }
      }
    }
    // In the water, clear of the seabed and walls, and well away from the swimmer.
    for (const s of this.swims) {
      const q = s.pose.position;
      if (q.y < this.l.ceiling - 1) keepInIce(this.l, q, 2.5, 1.5);
      if (
        player.active &&
        dist(q, player.position) < 8 &&
        q.y < this.l.ceiling - 1
      ) {
        const k = 8 / Math.max(1e-6, dist(q, player.position));
        q.x = player.position.x + (q.x - player.position.x) * k;
        q.z = player.position.z + (q.z - player.position.z) * k;
        keepInIce(this.l, q, 2.5, 1.5);
      }
    }
  }
  end(): void {
    this.active = false;
    for (const s of this.swims) s.pose.position.y = ICE.ceiling + 6;
  }
}

// ------------------------------------------------------------------ toothfish

class Toothfish implements Encounter {
  readonly id = 'toothfish' as const;
  active = false;
  readonly swim: Swim;
  readonly poses: FishPose[];
  private mood: 'rise' | 'hang' | 'sink' = 'rise';
  private clock = 0;
  private readonly low: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly high: Vec3 = { x: 0, y: 0, z: 0 };
  constructor(
    pose: FishPose,
    private readonly l: IceLimits,
  ) {
    this.swim = createSwim(pose);
    this.poses = [pose];
  }
  begin(e: Readonly<Vec3>): boolean {
    if (!farPoint(this.l, e, this.low, 0)) return false;
    this.low.y = this.l.ground(this.low.x, this.low.z) + 0.5;
    this.high.x = this.low.x + (e.x - this.low.x) * 0.35;
    this.high.z = this.low.z + (e.z - this.low.z) * 0.35;
    this.high.y = Math.min(e.y, this.l.ceiling - 3);
    keepInIce(this.l, this.high, 1.5, 2);
    Object.assign(this.swim.pose.position, this.low);
    this.mood = 'rise';
    this.clock = 0;
    this.active = true;
    return true;
  }
  update(dt: number, player: PlayerPresence): void {
    if (!this.active) return;
    this.clock += dt;
    if (this.mood === 'rise') {
      if (
        swimTo(
          this.swim,
          this.high.x,
          this.high.y,
          this.high.z,
          0.35,
          dt,
          0.5,
          0.6,
        ) < 0.6
      ) {
        this.mood = 'hang';
        this.clock = 0;
      }
    } else if (this.mood === 'hang') {
      this.swim.pose.effort = 0.2 * Math.sin(this.clock * 1.2);
      this.swim.pose.fins = Math.sin(this.clock * 0.9);
      turnTo(
        this.swim,
        Math.atan2(
          -(player.position.z - this.swim.pose.position.z),
          player.position.x - this.swim.pose.position.x,
        ),
        dt,
        0.3,
      );
      if (this.clock > 18) this.mood = 'sink';
    } else if (
      swimTo(this.swim, this.low.x, this.low.y, this.low.z, 0.4, dt, 0.5, 0.6) <
      0.5
    )
      this.end();
    keepInIce(this.l, this.swim.pose.position, 0.3, 1.5);
  }
  end(): void {
    this.active = false;
  }
}

// ------------------------------------------------------------------ colossal squid's eyes

/** The eyes glow up low in the dark far end, hold, blink, and fade away. `glow` is 0..1. */
class SquidEyes implements Encounter {
  readonly id = 'colossal-squid' as const;
  active = false;
  readonly poses: FishPose[];
  glow = 0;
  private clock = 0;
  constructor(
    pose: FishPose,
    private readonly l: IceLimits,
  ) {
    this.poses = [pose];
  }
  begin(e: Readonly<Vec3>): boolean {
    const p = this.poses[0].position;
    if (!farPoint(this.l, e, p, 0)) return false;
    p.y = this.l.ground(p.x, p.z) + 1.4;
    this.poses[0].yaw = Math.atan2(-(e.z - p.z), e.x - p.x);
    this.clock = 0;
    this.active = true;
    return true;
  }
  update(dt: number, _player: PlayerPresence, reducedMotion: boolean): void {
    if (!this.active) return;
    this.clock += dt;
    const t = this.clock,
      blink = !reducedMotion && t > 6 && t < 6.25 ? 0 : 1;
    this.glow =
      Math.min(1, t / 4) * Math.max(0, Math.min(1, (14 - t) / 4)) * blink;
    if (t > 14) this.end();
  }
  end(): void {
    this.active = false;
    this.glow = 0;
  }
}

// ------------------------------------------------------------------ polar bear

class PolarBear implements Encounter {
  readonly id = 'polar-bear' as const;
  active = false;
  readonly swim: Swim;
  readonly poses: FishPose[];
  private mood: 'paddle' | 'dive' | 'look' | 'climb' = 'paddle';
  private clock = 0;
  private hole = 0;
  private readonly low: Vec3 = { x: 0, y: 0, z: 0 };
  constructor(
    pose: FishPose,
    private readonly l: IceLimits,
  ) {
    this.swim = createSwim(pose);
    this.poses = [pose];
    pose.position.y = ICE.ceiling + 6;
  }
  begin(e: Readonly<Vec3>): boolean {
    // A hole in view, but not right overhead.
    let pick = -1;
    ICE.holes.forEach((h, i) => {
      const d = Math.hypot(h.x - e.x, h.z - e.z);
      if (d > 8 && d < 22 && pick < 0) pick = i;
    });
    if (pick < 0) return false;
    this.hole = pick;
    const h = hole(pick),
      p = this.swim.pose.position;
    p.x = h.x;
    p.y = ICE.ceiling + 0.35;
    p.z = h.z;
    this.low.x = h.x + (e.x - h.x) * 0.3;
    this.low.z = h.z + (e.z - h.z) * 0.3;
    this.low.y = this.l.ceiling - 5;
    keepInIce(this.l, this.low, 2, 2);
    this.mood = 'paddle';
    this.clock = 0;
    this.active = true;
    return true;
  }
  update(dt: number, player: PlayerPresence, reducedMotion: boolean): void {
    if (!this.active) return;
    this.clock += dt;
    const h = hole(this.hole),
      pose = this.swim.pose;
    if (this.mood === 'paddle') {
      // At the surface in the hole: head up, paws paddling below.
      pose.position.y = ICE.ceiling + 0.35 + 0.05 * Math.sin(this.clock * 1.4);
      pose.pitch = 0.15;
      pose.effort = Math.sin(this.clock * (reducedMotion ? 1.6 : 2.6));
      pose.yaw += dt * 0.15;
      if (this.clock > 16) {
        this.mood = 'dive';
        this.clock = 0;
      }
    } else if (this.mood === 'dive') {
      if (
        swimTo(this.swim, this.low.x, this.low.y, this.low.z, 0.9, dt, 1.4, 1) <
        0.6
      ) {
        this.mood = 'look';
        this.clock = 0;
      }
    } else if (this.mood === 'look') {
      pose.effort = 0.5 * Math.sin(this.clock * 2);
      turnTo(
        this.swim,
        Math.atan2(
          -(player.position.z - pose.position.z),
          player.position.x - pose.position.x,
        ),
        dt,
        0.8,
      );
      if (this.clock > 8) {
        this.mood = 'climb';
        this.clock = 0;
      }
    } else {
      swimTo(this.swim, h.x, ICE.ceiling + 3, h.z, 1, dt, 1.6, 1);
      if (pose.position.y > ICE.ceiling + 2 || this.clock > 60) this.end();
    }
    if (pose.position.y < this.l.ceiling - 1)
      keepInIce(this.l, pose.position, 1.5, 1);
    if (player.active && dist(pose.position, player.position) < 4) {
      const k = 4 / Math.max(1e-6, dist(pose.position, player.position));
      pose.position.x =
        player.position.x + (pose.position.x - player.position.x) * k;
      pose.position.z =
        player.position.z + (pose.position.z - player.position.z) * k;
    }
  }
  end(): void {
    this.active = false;
    this.swim.pose.position.y = ICE.ceiling + 6;
  }
}

// ------------------------------------------------------------------ the director

export class RareDirector {
  readonly encounters: Record<RareId, Encounter>;
  current?: Encounter;
  private wait: number;
  private readonly recent: RareId[] = [];
  private readonly rand: Seeded;
  readonly squid: SquidEyes;
  constructor(makePose: () => FishPose, limits: IceLimits, seed = 48011) {
    this.rand = new Seeded(seed);
    this.squid = new SquidEyes(makePose(), limits);
    this.encounters = {
      'leopard-seal': new LeopardSeal(makePose(), limits, this.rand),
      'minke-whale': new ThroughHole(
        'minke-whale',
        makePose,
        1,
        limits,
        1.6,
        [
          [0.1, 0.2],
          [0.5, 0.05],
          [0.9, 0.2],
        ],
        4.5,
        0,
      ),
      'killer-whales': new ThroughHole(
        'killer-whales',
        makePose,
        3,
        limits,
        2.2,
        [
          [0.15, 0.3],
          [0.5, 0.1],
          [0.85, 0.3],
          [0.5, 0.6],
        ],
        4,
        6,
      ),
      toothfish: new Toothfish(makePose(), limits),
      'colossal-squid': this.squid,
      'polar-bear': new PolarBear(makePose(), limits),
    };
    this.wait = this.rand.between(RARE.first);
  }
  /** The swimmer has come under the ice: whatever was here leaves; the first wait starts again. */
  arrive(): void {
    this.current?.end();
    this.current = undefined;
    this.wait = this.rand.between(RARE.first);
  }
  /** Bring one now, if it can come (for a harness); true if it began. */
  bring(id: RareId, player: Readonly<Vec3>): boolean {
    this.current?.end();
    const e = this.encounters[id];
    if (!e.begin(player)) return false;
    this.current = e;
    this.remember(id);
    return true;
  }
  private remember(id: RareId): void {
    this.recent.push(id);
    if (this.recent.length > 2) this.recent.shift();
  }
  update(dt: number, player: PlayerPresence, reducedMotion: boolean): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    if (this.current) {
      this.current.update(dt, player, reducedMotion);
      if (!this.current.active) {
        this.current = undefined;
        this.wait = this.rand.between(RARE.gap);
      }
      return;
    }
    this.wait -= dt;
    if (this.wait > 0 || !player.active) return;
    // One of those not seen lately, chosen at random; if it cannot come from here, try again soon.
    const choices = RARE_IDS.filter((id) => !this.recent.includes(id)),
      id = choices[Math.floor(this.rand.next() * choices.length)];
    if (this.encounters[id].begin(player.position)) {
      this.current = this.encounters[id];
      this.remember(id);
    } else this.wait = 10;
  }
}
