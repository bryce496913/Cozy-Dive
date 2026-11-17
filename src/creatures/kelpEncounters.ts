import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishPose } from '../environment/outer/PosedFish';
import {
  createSwim,
  face,
  Seeded,
  swimTo,
  turnTo,
  type Swim,
} from './reefEncounters';

/**
 * v0.6 Pass 044: scripted life in the kelp forest. Pure (no rendering), allocation-free per
 * frame, deterministic for a seed; each writes a `FishPose` the runtime draws.
 *
 *   - `SeaOtter`: floats on its back at the surface among the kelp, now and then diving for an
 *     urchin and bringing it back up;
 *   - `ShySeal`: a harbour seal that watches the swimmer from a distance and keeps it;
 *   - `RareCruise`: now and then a giant sea bass drifts in from out of sight, cruises slowly past
 *     the swimmer, and leaves;
 *   - `GullDive`: now and then a gull plunges in from the surface, swims down to peck at the sand
 *     near the swimmer, and swims back up.
 */

/** Where these animals may go: the ground (with rocks) beneath, the surface, and the walls. */
export interface KelpLimits {
  readonly ground: (x: number, z: number, radius: number) => number;
  readonly surface: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}
function inside(l: KelpLimits, a: Vec3, clear = 1): void {
  a.x = Math.max(l.minX, Math.min(l.maxX, a.x));
  a.z = Math.max(l.minZ, Math.min(l.maxZ, a.z));
  a.y = Math.min(l.surface - 1, Math.max(l.ground(a.x, a.z, 1) + clear, a.y));
}
const dist = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ------------------------------------------------------------------ sea otter

export const OTTER = {
  /** Floats here (centre, drift radius), this far below the surface (m). */
  home: { x: -6, z: -30, r: 5 },
  float: 0.25,
  /** Seconds floating between dives, and its diving and surfacing speeds (m/s). */
  rest: [40, 80] as const,
  dive: 1.3,
  /** Seconds at the bottom with an urchin. */
  forage: [4, 8] as const,
} as const;
export type OtterMood = 'float' | 'dive' | 'forage' | 'rise';

export class SeaOtter {
  readonly swim: Swim;
  mood: OtterMood = 'float';
  private wait: number;
  private time = 0;
  private target = 0;
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: KelpLimits,
    private readonly urchins: readonly Readonly<Vec3>[],
    seed = 44011,
    /** Where it floats (centre, drift radius): over open water, where it can be seen from below. */
    private readonly home: {
      readonly x: number;
      readonly z: number;
      readonly r: number;
    } = OTTER.home,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    pose.position.x = home.x;
    pose.position.y = limits.surface - OTTER.float;
    pose.position.z = home.z;
    pose.roll = Math.PI;
    this.wait = this.rand.between(OTTER.rest);
  }
  get pose(): FishPose {
    return this.swim.pose;
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const p = this.swim.pose,
      a = this.aim,
      top = this.limits.surface - OTTER.float;
    if (this.mood === 'float') {
      // Drifting slowly on its back, turning, sculling now and then with its tail.
      const h = this.home,
        t = this.time * 0.02;
      a.x = h.x + Math.cos(t) * h.r;
      a.z = h.z + Math.sin(t * 1.3) * h.r;
      p.position.x += (a.x - p.position.x) * dt * 0.05;
      p.position.z += (a.z - p.position.z) * dt * 0.05;
      p.position.y = top + 0.05 * Math.sin(this.time * 0.8);
      p.yaw += dt * 0.03;
      p.roll += (Math.PI - p.roll) * dt;
      p.pitch = 0.08 * Math.sin(this.time * 0.5);
      p.effort =
        0.3 *
        Math.sin(this.time * 1.2) *
        Math.max(0, Math.sin(this.time * 0.15));
      this.wait -= dt;
      if (this.wait <= 0 && this.urchins.length) {
        // Off to fetch an urchin, near enough to where it floats.
        let best = 0,
          d = Infinity;
        for (let i = 0; i < 6; i++) {
          const k = Math.floor(this.rand.next() * this.urchins.length),
            u = this.urchins[k],
            e = Math.hypot(u.x - p.position.x, u.z - p.position.z);
          if (e < d) {
            d = e;
            best = k;
          }
        }
        this.target = best;
        this.mood = 'dive';
      }
    } else if (this.mood === 'dive') {
      const u = this.urchins[this.target];
      p.roll += (0 - p.roll) * Math.min(1, dt * 2);
      if (
        swimTo(this.swim, u.x, u.y + 0.35, u.z, OTTER.dive, dt, 1.4, 1.5) < 0.4
      ) {
        this.mood = 'forage';
        this.wait = this.rand.between(OTTER.forage);
      }
    } else if (this.mood === 'forage') {
      this.wait -= dt;
      p.pitch += (-0.6 - p.pitch) * dt * 2;
      p.effort = 0.2 * Math.sin(this.time * 4);
      if (this.wait <= 0) this.mood = 'rise';
    } else {
      if (
        swimTo(
          this.swim,
          p.position.x,
          top,
          p.position.z,
          OTTER.dive,
          dt,
          1.4,
          1.5,
        ) < 0.3
      ) {
        this.mood = 'float';
        this.wait = this.rand.between(OTTER.rest);
        this.swim.v.x = this.swim.v.y = this.swim.v.z = 0;
      }
      if (p.position.y > top - 2)
        p.roll += (Math.PI - p.roll) * Math.min(1, dt * 1.5);
    }
  }
}

// ------------------------------------------------------------------ harbour seal

export const SEAL = {
  /** Roams a slow loop (centre, radii, height). */
  roam: { x: 6, z: -40, rx: 10, rz: 12, y: 8, speed: 0.9, rate: 0.035 },
  /** Watches the swimmer from `watch` m when they come within `notice` m; backs off inside `shy`. */
  notice: 12,
  watch: 7,
  shy: 5,
  stay: [8, 16] as const,
  rest: [30, 60] as const,
} as const;
export type SealMood = 'roam' | 'watch' | 'leave';

export class ShySeal {
  readonly swim: Swim;
  mood: SealMood = 'roam';
  private angle = 0;
  private moodTime = 0;
  private stay = 0;
  private rest = 10;
  private time = 0;
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: KelpLimits,
    seed = 44021,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    this.angle = this.rand.next() * Math.PI * 2;
    this.roamAim();
    Object.assign(pose.position, this.aim);
  }
  get pose(): FishPose {
    return this.swim.pose;
  }
  private roamAim(): void {
    const r = SEAL.roam,
      a = this.aim;
    a.x = r.x + Math.cos(this.angle) * r.rx;
    a.z = r.z + Math.sin(this.angle) * r.rz;
    a.y = r.y + 2 * Math.sin(this.time * 0.1);
    inside(this.limits, a, 1.5);
  }
  update(dt: number, player: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.moodTime += dt;
    this.rest = Math.max(0, this.rest - dt);
    const p = this.swim.pose.position,
      e = player.position,
      d = dist(p, e);
    if (this.mood === 'roam') {
      if (player.active && this.rest <= 0 && d < SEAL.notice) {
        this.mood = 'watch';
        this.moodTime = 0;
        this.stay = this.rand.between(SEAL.stay);
      }
    } else if (this.mood === 'watch') {
      if (!player.active || this.moodTime > this.stay) {
        this.mood = 'leave';
        this.moodTime = 0;
      }
    } else if (this.moodTime > 10) {
      this.mood = 'roam';
      this.rest = this.rand.between(SEAL.rest);
    }
    let speed: number = SEAL.roam.speed;
    if (this.mood === 'watch') {
      // Hold off at `watch` m on its own side of the swimmer; faster if they come too close.
      const dx = p.x - e.x,
        dz = p.z - e.z,
        l = Math.hypot(dx, dz) || 1,
        a = this.aim;
      a.x = e.x + (dx / l) * SEAL.watch;
      a.z = e.z + (dz / l) * SEAL.watch;
      a.y = e.y + 0.5;
      inside(this.limits, a, 1.5);
      speed = d < SEAL.shy ? 2.2 : 0.5;
    } else {
      this.angle += SEAL.roam.rate * dt * (this.mood === 'leave' ? 2.5 : 1);
      this.roamAim();
      if (this.mood === 'leave') speed = 1.6;
    }
    swimTo(this.swim, this.aim.x, this.aim.y, this.aim.z, speed, dt, 0.9, 1.5);
    if (this.mood === 'watch' && d >= SEAL.shy)
      // Head turned to the swimmer, watching.
      turnTo(this.swim, Math.atan2(-(e.z - p.z), e.x - p.x), dt, 1.2);
  }
}

// ------------------------------------------------------------------ a rare cruise past the swimmer

export const SEA_BASS = {
  /** It appears at least `hidden` m from the swimmer (lost in the green), and leaves as far. */
  hidden: 20,
  /** Passes about `pass` m from the swimmer, slowly (m/s), at about their height. */
  pass: 5,
  speed: 0.45,
  first: [60, 150] as const,
  every: [150, 280] as const,
  chance: 0.3,
} as const;
export type CruiseMood = 'away' | 'coming' | 'passing' | 'going';

export class RareCruise {
  readonly swim: Swim;
  mood: CruiseMood = 'away';
  private wait: number;
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly out: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: KelpLimits,
    seed = 44031,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    this.wait = this.rand.between(SEA_BASS.first);
  }
  get present(): boolean {
    return this.mood !== 'away';
  }
  /** A point in the forest at least `hidden` m from `e`, if one is found. */
  private farFrom(e: Readonly<Vec3>, out: Vec3): boolean {
    const l = this.limits;
    for (let i = 0; i < 24; i++) {
      out.x = l.minX + this.rand.next() * (l.maxX - l.minX);
      out.z = l.minZ + this.rand.next() * (l.maxZ - l.minZ);
      out.y = e.y;
      inside(l, out, 1.5);
      if (dist(out, e) > SEA_BASS.hidden) return true;
    }
    return false;
  }
  /** Bring it now (for a harness). */
  begin(player: PlayerPresence): boolean {
    if (!this.farFrom(player.position, this.swim.pose.position)) return false;
    this.mood = 'coming';
    this.swim.v.x = this.swim.v.y = this.swim.v.z = 0;
    return true;
  }
  update(dt: number, player: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const p = this.swim.pose.position,
      e = player.position,
      a = this.aim;
    if (this.mood === 'away') {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (!(
          player.active &&
          this.rand.next() < SEA_BASS.chance &&
          this.begin(player)
        ))
          this.wait = this.rand.between(SEA_BASS.every);
      }
      return;
    }
    if (this.mood === 'coming') {
      // Towards a spot beside the swimmer.
      const dx = p.x - e.x,
        dz = p.z - e.z,
        l = Math.hypot(dx, dz) || 1;
      a.x = e.x - (dz / l) * SEA_BASS.pass;
      a.z = e.z + (dx / l) * SEA_BASS.pass;
      a.y = e.y;
      inside(this.limits, a, 1.2);
      if (dist(p, a) < 2 || dist(p, e) < SEA_BASS.pass + 1) {
        this.mood = 'passing';
        // On past, out the other side.
        if (!this.farFrom(e, this.out)) Object.assign(this.out, a);
      }
    } else Object.assign(a, this.out);
    swimTo(this.swim, a.x, a.y, a.z, SEA_BASS.speed, dt, 0.6, 0.8);
    if (this.mood === 'passing' && dist(p, e) > SEA_BASS.pass + 6)
      this.mood = 'going';
    if (
      this.mood === 'going' &&
      (dist(p, e) > SEA_BASS.hidden || dist(p, a) < 1)
    ) {
      this.mood = 'away';
      this.wait = this.rand.between(SEA_BASS.every);
    }
  }
}

// ------------------------------------------------------------------ a gull's dive

export const GULL = {
  /** Plunges from this high above the surface (m) at `plunge` m/s, then swims at `paddle`. */
  above: 1.5,
  plunge: 3,
  paddle: 0.9,
  climb: 1.4,
  /** Lands this far from the swimmer (m) to peck at the sand: pecks and seconds between. */
  near: [5, 8] as const,
  pecks: [3, 5] as const,
  every: 1.1,
  first: [40, 100] as const,
  again: [100, 200] as const,
  chance: 0.35,
} as const;
export type GullMood = 'away' | 'plunge' | 'down' | 'peck' | 'up';

export class GullDive {
  readonly swim: Swim;
  mood: GullMood = 'away';
  /** This frame's peck (a puff of sand), if any. */
  pecked = false;
  readonly peckAt: Vec3 = { x: 0, y: 0, z: 0 };
  private wait: number;
  private pecks = 0;
  private clock = 0;
  private readonly spot: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: KelpLimits,
    seed = 44041,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    pose.position.y = limits.surface + 5;
    this.wait = this.rand.between(GULL.first);
  }
  get present(): boolean {
    return this.mood !== 'away';
  }
  /** Begin a dive now, near the swimmer (for a harness). */
  begin(e: Readonly<Vec3>): void {
    const a = this.rand.next() * Math.PI * 2,
      r = this.rand.between(GULL.near),
      s = this.spot,
      l = this.limits;
    s.x = e.x + Math.cos(a) * r;
    s.z = e.z + Math.sin(a) * r;
    s.y = 0;
    inside(l, s, 0);
    s.y = l.ground(s.x, s.z, 0.2);
    const p = this.swim.pose.position;
    p.x = s.x + 3;
    p.y = l.surface + GULL.above;
    p.z = s.z + 1;
    this.mood = 'plunge';
    this.swim.v.x = this.swim.v.z = 0;
    this.swim.v.y = -GULL.plunge;
  }
  update(dt: number, player: PlayerPresence): void {
    this.pecked = false;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const p = this.swim.pose,
      s = this.spot,
      top = this.limits.surface;
    switch (this.mood) {
      case 'away':
        this.wait -= dt;
        if (this.wait <= 0) {
          if (player.active && this.rand.next() < GULL.chance)
            this.begin(player.position);
          else this.wait = this.rand.between(GULL.again);
        }
        return;
      case 'plunge':
        // Wings folded, straight in, slowing in the water.
        p.position.y += this.swim.v.y * dt;
        p.position.x += (s.x - p.position.x) * dt * 0.3;
        p.position.z += (s.z - p.position.z) * dt * 0.3;
        // Slowing in the water, but still going down.
        if (p.position.y < top)
          this.swim.v.y = Math.min(-0.8, this.swim.v.y * Math.exp(-2.5 * dt));
        p.pitch = -1.3;
        p.effort = 0;
        if (p.position.y < top - 1.5) this.mood = 'down';
        return;
      case 'down':
        if (
          swimTo(this.swim, s.x, s.y + 0.25, s.z, GULL.paddle, dt, 1.8, 1.8) <
          0.3
        ) {
          this.mood = 'peck';
          this.pecks = Math.round(this.rand.between(GULL.pecks));
          this.clock = 0;
        }
        p.effort *= 0.35;
        return;
      case 'peck': {
        this.clock += dt;
        const t = this.clock % GULL.every;
        p.pitch +=
          (-0.9 + 0.4 * Math.sin((t / GULL.every) * Math.PI * 2) - p.pitch) *
          Math.min(1, dt * 6);
        p.effort = 0.1 * Math.sin(this.clock * 6);
        if (t < dt && this.clock > dt) {
          this.pecked = true;
          this.peckAt.x = p.position.x + Math.cos(p.yaw) * 0.2;
          this.peckAt.y = s.y;
          this.peckAt.z = p.position.z - Math.sin(p.yaw) * 0.2;
          if (--this.pecks <= 0) this.mood = 'up';
        }
        return;
      }
      case 'up':
        swimTo(this.swim, s.x - 2, top + 2, s.z - 1, GULL.climb, dt, 2.2, 1.5);
        p.effort *= 0.35;
        face(this.swim, 0, 2.2);
        if (p.position.y > top + 0.5) {
          this.mood = 'away';
          this.wait = this.rand.between(GULL.again);
          p.position.y = top + 5;
        }
        return;
    }
  }
}
