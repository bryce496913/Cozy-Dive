import { OUTER } from '../config/passage';
import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishPose } from '../environment/outer/PosedFish';

/**
 * v0.6 Pass 043: scripted life on and beyond the outer reef. Pure (no rendering), allocation-free
 * per frame, deterministic for a seed. Each writes `FishPose`s that `PosedFish` (or a single
 * authored creature) draws.
 *
 *   - `ParrotGrazers`: parrotfish going from coral to coral, biting at each (a puff of sand);
 *   - `CuriousWrasse`: a big humphead wrasse that roams and now and then comes for a look;
 *   - `CleaningEncounter`: very rarely, longfin bannerfish gather at one spot beyond the glass (the
 *     sign), an ocean sunfish rises from the deep to be cleaned for a few minutes, then sinks;
 *   - `RarePass`: now and then a great white swims the length of the glass, close by it.
 */

/** A small, seeded random source. */
export class Seeded {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  between(r: readonly [number, number]): number {
    return r[0] + this.next() * (r[1] - r[0]);
  }
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** A swimmer's motion: its pose, velocity and stroke phase. */
export interface Swim {
  readonly pose: FishPose;
  readonly v: Vec3;
  phase: number;
}
export const createSwim = (pose: FishPose): Swim => ({
  pose,
  v: { x: 0, y: 0, z: 0 },
  phase: 0,
});

/**
 * Steer towards (tx, ty, tz) at up to `speed` m/s (slowing on arrival), face along the motion
 * and beat the tail with it. Returns the distance left.
 */
export function swimTo(
  s: Swim,
  tx: number,
  ty: number,
  tz: number,
  speed: number,
  dt: number,
  strokeHz = 1.6,
  response = 2,
): number {
  const p = s.pose.position;
  let dx = tx - p.x,
    dy = ty - p.y,
    dz = tz - p.z;
  const d = Math.hypot(dx, dy, dz) || 1e-6,
    want = Math.min(speed, d * 0.8),
    k = ease(response, dt);
  dx = (dx / d) * want;
  dy = (dy / d) * want;
  dz = (dz / d) * want;
  s.v.x += (dx - s.v.x) * k;
  s.v.y += (dy - s.v.y) * k;
  s.v.z += (dz - s.v.z) * k;
  p.x += s.v.x * dt;
  p.y += s.v.y * dt;
  p.z += s.v.z * dt;
  face(s, dt, strokeHz);
  return d;
}
/** Face along the velocity (if moving) and beat the tail in proportion to speed. */
export function face(s: Swim, dt: number, strokeHz = 1.6, turn = 3): void {
  const v = s.v,
    h = Math.hypot(v.x, v.z),
    speed = Math.hypot(h, v.y);
  if (h > 0.03) {
    const change = wrap(Math.atan2(-v.z, v.x) - s.pose.yaw);
    s.pose.yaw = wrap(s.pose.yaw + change * ease(turn, dt));
    s.pose.roll += (-change * 0.5 - s.pose.roll) * ease(2, dt);
  }
  s.pose.pitch +=
    (Math.atan2(v.y, Math.max(h, 0.05)) * 0.7 - s.pose.pitch) * ease(turn, dt);
  s.phase =
    (s.phase + Math.PI * 2 * strokeHz * dt * (0.4 + speed)) % (Math.PI * 2);
  s.pose.effort = Math.sin(s.phase) * Math.min(1, 0.25 + speed);
  s.pose.fins = Math.sin(s.phase * 0.7 + 1);
}
/** Turn to face a heading (radians) while hovering. */
export function turnTo(s: Swim, yaw: number, dt: number, rate = 1.5): void {
  s.pose.yaw = wrap(s.pose.yaw + wrap(yaw - s.pose.yaw) * ease(rate, dt));
}

// ------------------------------------------------------------------ parrotfish

export const PARROT = {
  count: 4,
  speed: 0.55,
  /** Bites per coral, seconds between them, and hovering height above the coral (m). */
  bites: [3, 6] as const,
  every: 1.3,
  above: 0.45,
  /** Moves on to another coral within this distance (m); shies from a swimmer this close. */
  range: 14,
  shy: 1.8,
} as const;

type GrazeState = 'swim' | 'graze';
interface Grazer {
  readonly swim: Swim;
  state: GrazeState;
  coral: number;
  bites: number;
  clock: number;
}

/** Parrotfish grazing on the reef's corals; `bites` lists this frame's bites (sand puffs). */
export class ParrotGrazers {
  readonly poses: FishPose[];
  readonly bites: Vec3[] = [];
  bitCount = 0;
  private readonly grazers: Grazer[] = [];
  private readonly rand: Seeded;

  constructor(
    private readonly corals: readonly Readonly<Vec3>[],
    makePose: () => FishPose,
    seed = 43011,
  ) {
    this.rand = new Seeded(seed);
    this.poses = [];
    for (let i = 0; i < PARROT.count; i++) {
      const pose = makePose(),
        coral = corals.length
          ? Math.floor(this.rand.next() * corals.length)
          : 0,
        c = corals[coral] ?? { x: 0, y: 2, z: -40 };
      pose.position.x = c.x + 1.5;
      pose.position.y = c.y + 1.2;
      pose.position.z = c.z;
      this.poses.push(pose);
      this.grazers.push({
        swim: createSwim(pose),
        state: 'swim',
        coral,
        bites: 0,
        clock: this.rand.next() * 2,
      });
    }
    for (let i = 0; i < 8; i++) this.bites.push({ x: 0, y: 0, z: 0 });
  }
  private nextCoral(g: Grazer, avoid?: Readonly<Vec3>): void {
    const here = this.corals[g.coral];
    for (let tries = 0; tries < 12; tries++) {
      const k = Math.floor(this.rand.next() * this.corals.length),
        c = this.corals[k];
      if (k === g.coral) continue;
      if (here && Math.hypot(c.x - here.x, c.z - here.z) > PARROT.range)
        continue;
      if (avoid && Math.hypot(c.x - avoid.x, c.z - avoid.z) < 4) continue;
      g.coral = k;
      break;
    }
    g.state = 'swim';
  }
  update(dt: number, player?: PlayerPresence): void {
    this.bitCount = 0;
    if (!(dt > 0) || !this.corals.length) return;
    dt = Math.min(dt, 0.1);
    for (const g of this.grazers) {
      const c = this.corals[g.coral],
        p = g.swim.pose.position;
      if (
        player?.active &&
        Math.hypot(
          player.position.x - p.x,
          player.position.y - p.y,
          player.position.z - p.z,
        ) < PARROT.shy &&
        g.state === 'graze'
      )
        this.nextCoral(g, player.position);
      if (g.state === 'swim') {
        const d = swimTo(
          g.swim,
          c.x,
          c.y + PARROT.above,
          c.z,
          PARROT.speed,
          dt,
          1.4,
        );
        if (d < 0.35) {
          g.state = 'graze';
          g.bites = Math.round(this.rand.between(PARROT.bites));
          g.clock = 0;
        }
      } else {
        // Hovering nose-down over the coral, lunging in to bite now and then.
        g.clock += dt;
        const t = g.clock % PARROT.every,
          lunge = Math.sin(Math.min(1, t / 0.35) * Math.PI);
        g.swim.v.x = g.swim.v.y = g.swim.v.z = 0;
        p.y += (c.y + PARROT.above - 0.18 * lunge - p.y) * ease(6, dt);
        g.swim.pose.pitch += (-0.55 - g.swim.pose.pitch) * ease(3, dt);
        g.swim.pose.effort = 0.25 * Math.sin(g.clock * 5);
        g.swim.pose.fins = Math.sin(g.clock * 4);
        if (t < dt && g.clock > dt) {
          if (this.bitCount < this.bites.length) {
            const b = this.bites[this.bitCount++];
            b.x = c.x + Math.cos(g.swim.pose.yaw) * 0.15;
            b.y = c.y;
            b.z = c.z - Math.sin(g.swim.pose.yaw) * 0.15;
          }
          if (--g.bites <= 0) this.nextCoral(g);
        }
      }
    }
  }
}

// ------------------------------------------------------------------ humphead wrasse

export const WRASSE = {
  /** Roams a slow loop (centre, radii, height above the reef), cruising at `speed` m/s. */
  roam: { x: -2, z: -45, rx: 14, rz: 7, y: 4.5, speed: 0.55, rate: 0.03 },
  /** Notices the swimmer within `notice` m; looks from `look` m for a while (s); then rests (s). */
  notice: 12,
  look: 3,
  stay: [10, 16] as const,
  rest: [60, 100] as const,
} as const;
export type WrasseMood = 'roam' | 'approach' | 'look' | 'leave';
/** Where it may swim: inside the tank's glass, above the reef. */
export interface WrasseLimits {
  readonly ground: (x: number, z: number, radius: number) => number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly top: number;
}

export class CuriousWrasse {
  readonly swim: Swim;
  mood: WrasseMood = 'roam';
  private angle = 0;
  private time = 0;
  private moodTime = 0;
  private stay = 0;
  private rest = 0;
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: WrasseLimits,
    seed = 43021,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    this.angle = this.rand.next() * Math.PI * 2;
    this.roamAim(this.aim);
    Object.assign(pose.position, this.aim);
    this.rest = 20;
  }
  get pose(): FishPose {
    return this.swim.pose;
  }
  private roamAim(a: Vec3): void {
    const r = WRASSE.roam;
    a.x = r.x + Math.cos(this.angle) * r.rx;
    a.z = r.z + Math.sin(this.angle) * r.rz;
    a.y = r.y;
    this.inside(a);
  }
  private inside(a: Vec3): void {
    const l = this.limits;
    a.x = Math.max(l.minX, Math.min(l.maxX, a.x));
    a.z = Math.max(l.minZ, Math.min(l.maxZ, a.z));
    a.y = Math.min(l.top, Math.max(l.ground(a.x, a.z, 1.4) + 1.2, a.y));
  }
  private setMood(m: WrasseMood): void {
    this.mood = m;
    this.moodTime = 0;
  }
  update(dt: number, player: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.moodTime += dt;
    this.rest = Math.max(0, this.rest - dt);
    const p = this.swim.pose.position,
      e = player.position,
      toEye = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z),
      a = this.aim;
    if (this.mood === 'roam') {
      if (player.active && this.rest <= 0 && toEye < WRASSE.notice) {
        this.setMood('approach');
        this.stay = this.rand.between(WRASSE.stay);
      }
    } else if (this.mood === 'approach') {
      if (!player.active || this.moodTime > 25) this.setMood('leave');
      else if (
        toEye < WRASSE.look + 1.5 ||
        Math.hypot(a.x - p.x, a.y - p.y, a.z - p.z) < 1
      )
        this.setMood('look');
    } else if (this.mood === 'look') {
      if (!player.active || this.moodTime > this.stay) this.setMood('leave');
    } else if (this.moodTime > 8) {
      this.setMood('roam');
      this.rest = this.rand.between(WRASSE.rest);
    }
    let speed: number = WRASSE.roam.speed;
    if (this.mood === 'roam' || this.mood === 'leave') {
      this.angle += WRASSE.roam.rate * dt * (this.mood === 'leave' ? 2 : 1);
      this.roamAim(a);
    } else {
      // A spot `look` m from the swimmer, on its side of them, a little below eye level.
      const dx = p.x - e.x,
        dz = p.z - e.z,
        l = Math.hypot(dx, dz) || 1;
      a.x = e.x + (dx / l) * WRASSE.look;
      a.z = e.z + (dz / l) * WRASSE.look;
      a.y = e.y - 0.3 + 0.2 * Math.sin(this.time * 0.5);
      this.inside(a);
      speed = this.mood === 'approach' ? 0.8 : 0.25;
    }
    swimTo(this.swim, a.x, a.y, a.z, speed, dt, 0.9, 1.2);
    if (this.mood === 'look')
      // Turned side-on, one eye on the swimmer.
      turnTo(this.swim, Math.atan2(-(e.z - p.z), e.x - p.x) + 1.2, dt, 1);
  }
}

// ------------------------------------------------------------------ the cleaning encounter

export const CLEANING = {
  /** Where the bannerfish wait: beyond the glass by this much (m), at x and y. */
  station: { x: 6, y: -1.5, out: 3 },
  bannerfish: 12,
  /** The sunfish hovers this far beyond the station (m), and rises from (and sinks to) `deep`. */
  sunfishOut: 1.8,
  deep: -42,
  /** Seconds: the first check, then between checks, and the chance each time (very rare). */
  first: [120, 240] as const,
  every: [240, 420] as const,
  chance: 0.15,
  /** Seconds the bannerfish gather first (the sign), the sunfish rises, is cleaned, and sinks. */
  gather: 45,
  rise: 40,
  clean: [150, 210] as const,
  sink: 40,
  /** Its tilt while being cleaned (radians), and its size (m long). */
  tilt: 0.35,
} as const;
export type CleaningState =
  'idle' | 'gathering' | 'rising' | 'cleaning' | 'sinking';

export class CleaningEncounter {
  state: CleaningState = 'idle';
  readonly bannerfish: Swim[];
  readonly sunfish: Swim;
  readonly station: Vec3;
  private wait = 0;
  private clock = 0;
  private time = 0;
  private cleanFor = 0;
  private readonly rand: Seeded;

  constructor(makePose: () => FishPose, seed = 43031) {
    this.rand = new Seeded(seed);
    const s = CLEANING.station;
    this.station = { x: s.x, y: s.y, z: OUTER.glass.z - s.out };
    this.bannerfish = Array.from({ length: CLEANING.bannerfish }, (_, i) => {
      const sw = createSwim(makePose());
      this.home(i, 0, sw.pose.position);
      return sw;
    });
    this.sunfish = createSwim(makePose());
    Object.assign(this.sunfish.pose.position, this.sunfishAt(CLEANING.deep));
    this.arrive();
  }
  /** The swimmer has (re-)entered the outer reef: nothing is happening; its first check waits. */
  arrive(): void {
    this.state = 'idle';
    this.wait = this.rand.between(CLEANING.first);
    Object.assign(this.sunfish.pose.position, this.sunfishAt(CLEANING.deep));
  }
  get sunfishPresent(): boolean {
    return (
      this.state === 'rising' ||
      this.state === 'cleaning' ||
      this.state === 'sinking'
    );
  }
  /** Begin now (for a harness): the bannerfish start to gather. */
  begin(): void {
    this.state = 'gathering';
    this.clock = 0;
  }
  private sunfishAt(y: number): Vec3 {
    return {
      x: this.station.x + 0.4,
      y,
      z: this.station.z - CLEANING.sunfishOut,
    };
  }
  /** Bannerfish `i`'s loose home while idle: in pairs, spread along the glass round the station. */
  private home(i: number, t: number, out: Vec3): Vec3 {
    const pair = Math.floor(i / 2),
      side = i % 2 ? 0.5 : -0.5,
      pairs = Math.ceil(CLEANING.bannerfish / 2),
      x0 = this.station.x + (pair - (pairs - 1) / 2) * 3.2;
    out.x = x0 + 1.4 * Math.sin(t * 0.07 + pair * 1.9) + side;
    out.y = this.station.y + 1.6 * Math.sin(t * 0.05 + pair * 2.7) + side * 0.3;
    out.z = this.station.z - 1.2 + 0.9 * Math.sin(t * 0.06 + pair) + side * 0.2;
    return out;
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.clock += dt;
    const st = this.station,
      sun = this.sunfish,
      sp = sun.pose.position;
    switch (this.state) {
      case 'idle':
        this.wait -= dt;
        if (this.wait <= 0) {
          if (this.rand.next() < CLEANING.chance) this.begin();
          else this.wait = this.rand.between(CLEANING.every);
        }
        break;
      case 'gathering':
        if (this.clock > CLEANING.gather) {
          this.state = 'rising';
          this.clock = 0;
        }
        break;
      case 'rising': {
        const k = Math.min(1, this.clock / CLEANING.rise),
          e = k * k * (3 - 2 * k),
          to = this.sunfishAt(CLEANING.deep + (st.y - CLEANING.deep) * e);
        sp.x = to.x;
        sp.z = to.z;
        sun.v.y = (to.y - sp.y) / dt;
        sp.y = to.y;
        if (k >= 1) {
          this.state = 'cleaning';
          this.clock = 0;
          this.cleanFor = this.rand.between(CLEANING.clean);
        }
        break;
      }
      case 'cleaning':
        sp.x = st.x + 0.4 + 0.25 * Math.sin(this.time * 0.08);
        sp.y = st.y + 0.15 * Math.sin(this.time * 0.11);
        sun.v.y = 0;
        if (this.clock > this.cleanFor) {
          this.state = 'sinking';
          this.clock = 0;
        }
        break;
      case 'sinking': {
        const k = Math.min(1, this.clock / CLEANING.sink),
          e = k * k * (3 - 2 * k);
        sp.y = st.y + (CLEANING.deep - st.y) * e;
        if (k >= 1) {
          this.state = 'idle';
          this.wait = this.rand.between(CLEANING.every);
        }
        break;
      }
    }
    // The sunfish: side-on to the glass, tilted while it is cleaned, its tall fins beating slowly.
    const tilt = this.state === 'cleaning' ? CLEANING.tilt : 0.1;
    sun.pose.yaw = 0;
    sun.pose.pitch =
      this.state === 'rising' ? 0.5 : this.state === 'sinking' ? -0.5 : 0;
    sun.pose.roll += (tilt - sun.pose.roll) * ease(0.5, dt);
    sun.phase = (sun.phase + Math.PI * 2 * 0.35 * dt) % (Math.PI * 2);
    sun.pose.effort =
      Math.sin(sun.phase) * (this.state === 'cleaning' ? 0.5 : 0.9);
    // The bannerfish.
    const scratch = this.target;
    this.bannerfish.forEach((b, i) => {
      let speed = 0.35;
      if (this.state === 'idle' || this.state === 'sinking')
        this.home(i, this.time, scratch);
      else if (this.state === 'gathering' || this.state === 'rising') {
        // Schooled tight at the station, milling slowly: the sign.
        const a = (i / CLEANING.bannerfish) * Math.PI * 2 + this.time * 0.25;
        scratch.x = st.x + Math.cos(a) * 0.7;
        scratch.y = st.y + 0.3 * Math.sin(a * 2 + i);
        scratch.z = st.z + Math.sin(a) * 0.5;
        speed = 0.6;
      } else {
        // Picking at the sunfish's sides: darting in to its skin and out again.
        const a = i * 2.39,
          pick = 0.5 + 0.5 * Math.sin(this.time * 0.9 + i * 1.7),
          r = 0.35 + 0.55 * Math.abs(Math.sin(a)),
          side = i % 2 ? 1 : -1;
        scratch.x = sp.x + Math.cos(a) * r;
        scratch.y = sp.y + Math.sin(a) * r * 1.3;
        scratch.z = sp.z + side * (0.18 + 0.45 * pick);
        speed = 0.7;
      }
      swimTo(b, scratch.x, scratch.y, scratch.z, speed, dt, 1.8, 2.5);
      // Keep them beyond the glass.
      b.pose.position.z = Math.min(b.pose.position.z, OUTER.glass.z - 0.8);
    });
  }
  private readonly target: Vec3 = { x: 0, y: 0, z: 0 };
}

// ------------------------------------------------------------------ a rare close pass

export const GREAT_WHITE = {
  /** Its length (m: the authored 3 m model scaled), body radius, and cruising speed (m/s). */
  scale: 1.9,
  radius: 1.3,
  speed: 1.5,
  /** Its near side passes this far beyond the glass (m), at a height in this range. */
  gap: 1.4,
  heights: [-3, 3] as const,
  /** Starts and ends this far along the glass beyond its side panes (m): out of sight. */
  beyond: 32,
  first: [90, 200] as const,
  every: [180, 320] as const,
  chance: 0.25,
} as const;

export class RarePass {
  passing = false;
  readonly swim: Swim;
  private wait = 0;
  private dir = 1;
  private y = 0;
  private time = 0;
  private readonly rand: Seeded;
  constructor(pose: FishPose, seed = 43041) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    this.arrive();
  }
  get end(): number {
    return OUTER.glass.halfWidth + GREAT_WHITE.beyond;
  }
  laneZ(): number {
    return OUTER.glass.z - GREAT_WHITE.gap - GREAT_WHITE.radius;
  }
  arrive(): void {
    this.passing = false;
    this.wait = this.rand.between(GREAT_WHITE.first);
    this.swim.pose.position.x = -this.end;
    this.swim.pose.position.z = this.laneZ() - 20;
  }
  /** Start a pass now (for a harness). */
  begin(): void {
    this.passing = true;
    this.dir = this.rand.next() < 0.5 ? 1 : -1;
    this.y = this.rand.between(GREAT_WHITE.heights);
    const p = this.swim.pose.position;
    p.x = -this.dir * this.end;
    p.y = this.y;
    p.z = this.laneZ();
    this.swim.pose.yaw = this.dir > 0 ? 0 : Math.PI;
    this.swim.v.x = this.dir * GREAT_WHITE.speed;
    this.swim.v.y = this.swim.v.z = 0;
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (!this.passing) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.rand.next() < GREAT_WHITE.chance) this.begin();
        else this.wait = this.rand.between(GREAT_WHITE.every);
      }
      return;
    }
    const p = this.swim.pose.position,
      // A slow, sinuous line along the glass, never closer than its lane.
      tz = this.laneZ() - 0.8 * (0.5 + 0.5 * Math.sin(p.x * 0.07)),
      ty = this.y + 0.6 * Math.sin(p.x * 0.05);
    swimTo(
      this.swim,
      p.x + this.dir * 6,
      ty,
      tz,
      GREAT_WHITE.speed,
      dt,
      0.55,
      1,
    );
    if (Math.abs(p.x) > this.end && Math.sign(p.x) === this.dir) {
      this.passing = false;
      this.wait = this.rand.between(GREAT_WHITE.every);
    }
  }
}
