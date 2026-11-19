import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { FishPose } from '../environment/outer/PosedFish';
import {
  createSwim,
  Seeded,
  swimTo,
  turnTo,
  type Swim,
} from './reefEncounters';

/**
 * v0.6 Pass 045: scripted life in the sea cave. Pure, allocation-free per frame, deterministic.
 *
 *   - `SleepingTurtle`: a green turtle asleep on the sand that now and then rises up the sunbeam
 *     to breathe at the hole in the roof, then sinks back to the same spot;
 *   - `CleaningVisit`: now and then a soldierfish comes to the cleaner shrimps' patch on the wall,
 *     hangs still with its mouth open while they climb over it, then swims off;
 *   - `LionfishFan`: a lionfish resting on a rock spreads its fins and raises its spines at a
 *     swimmer who comes close, turning them towards them, and settles again after;
 *   - `blinkOn`: the flashlight fish's light organs, mostly lit, shuttered now and then.
 */

const dist = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ------------------------------------------------------------------ the sleeping turtle

export const TURTLE_NAP = {
  /** Seconds asleep between breaths; seconds at the top; speeds up and down (m/s). */
  sleep: [150, 240] as const,
  breathe: 6,
  rise: 0.6,
  sink: 0.35,
} as const;
export type TurtleMood = 'asleep' | 'rising' | 'breathing' | 'sinking';

export class SleepingTurtle {
  readonly swim: Swim;
  mood: TurtleMood = 'asleep';
  private wait: number;
  private time = 0;
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    /** Where it sleeps (on the sand), its heading there, and where it breathes (under the hole). */
    private readonly bed: Readonly<Vec3>,
    private readonly heading: number,
    private readonly air: Readonly<Vec3>,
    seed = 45011,
  ) {
    this.rand = new Seeded(seed);
    this.swim = createSwim(pose);
    Object.assign(pose.position, bed);
    pose.yaw = heading;
    this.wait = this.rand.between(TURTLE_NAP.sleep);
  }
  get pose(): FishPose {
    return this.swim.pose;
  }
  /** Wake now and go up to breathe (for a harness). */
  wake(): void {
    this.mood = 'rising';
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const p = this.swim.pose;
    switch (this.mood) {
      case 'asleep':
        // Still, but for a slow breath: a slight rise and fall, and a flipper twitch now and then.
        p.position.y = this.bed.y + 0.01 * Math.sin(this.time * 0.4);
        p.effort = 0.06 * Math.max(0, Math.sin(this.time * 0.13)) ** 8;
        p.pitch += (0 - p.pitch) * dt;
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'rising';
        break;
      case 'rising':
        if (
          swimTo(
            this.swim,
            this.air.x,
            this.air.y,
            this.air.z,
            TURTLE_NAP.rise,
            dt,
            0.35,
            0.8,
          ) < 0.5
        ) {
          this.mood = 'breathing';
          this.wait = TURTLE_NAP.breathe;
        }
        break;
      case 'breathing':
        this.swim.v.x = this.swim.v.y = this.swim.v.z = 0;
        p.pitch += (0.5 - p.pitch) * dt;
        p.effort = 0.2 * Math.sin(this.time * 0.8);
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'sinking';
        break;
      case 'sinking':
        if (
          swimTo(
            this.swim,
            this.bed.x,
            this.bed.y,
            this.bed.z,
            TURTLE_NAP.sink,
            dt,
            0.25,
            0.8,
          ) < 0.15
        ) {
          this.mood = 'asleep';
          this.wait = this.rand.between(TURTLE_NAP.sleep);
          this.swim.v.x = this.swim.v.y = this.swim.v.z = 0;
          Object.assign(p.position, this.bed);
        }
        if (dist(p.position, this.bed) < 2)
          turnTo(this.swim, this.heading, dt, 1);
        break;
    }
  }
}

// ------------------------------------------------------------------ the cleaning station

export const CLEANERS = {
  shrimps: 6,
  /** Seconds between visits, being cleaned; the fish hangs this far out from the wall (m). */
  every: [40, 80] as const,
  stay: [10, 16] as const,
  hover: 0.45,
  speed: 0.5,
} as const;
export type CleanMood = 'waiting' | 'coming' | 'cleaning' | 'leaving';

export class CleaningVisit {
  readonly fish: Swim;
  mood: CleanMood = 'waiting';
  /** Each shrimp's position now (on the rock, or on the fish). */
  readonly shrimps: Vec3[];
  private wait: number;
  private time = 0;
  private readonly hover: Vec3;
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    /** The shrimps' patch on the wall, the wall's outward direction there, and where the fish waits. */
    private readonly patch: Readonly<Vec3>,
    private readonly out: Readonly<Vec3>,
    private readonly home: Readonly<Vec3>,
    seed = 45021,
  ) {
    this.rand = new Seeded(seed);
    this.fish = createSwim(pose);
    Object.assign(pose.position, home);
    this.hover = {
      x: patch.x + out.x * CLEANERS.hover,
      y: patch.y + 0.05,
      z: patch.z + out.z * CLEANERS.hover,
    };
    this.shrimps = Array.from({ length: CLEANERS.shrimps }, (_, i) =>
      this.onRock(i, { x: 0, y: 0, z: 0 }),
    );
    this.wait = this.rand.between(CLEANERS.every);
  }
  /** Shrimp `i`'s place on the rock patch (a small cluster, just off the wall). */
  private onRock(i: number, o: Vec3): Vec3 {
    const a = i * 2.4 + this.time * 0.05,
      r = 0.12 + 0.1 * (i % 3);
    // A tangent across the wall (horizontal) and up.
    o.x = this.patch.x - this.out.z * Math.cos(a) * r + this.out.x * 0.03;
    o.y = this.patch.y + Math.sin(a) * r * 0.8;
    o.z = this.patch.z + this.out.x * Math.cos(a) * r + this.out.z * 0.03;
    return o;
  }
  /** Bring a fish now (for a harness). */
  call(): void {
    this.mood = 'coming';
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const f = this.fish,
      p = f.pose.position,
      h = this.hover;
    switch (this.mood) {
      case 'waiting':
        swimTo(
          f,
          this.home.x + 0.6 * Math.sin(this.time * 0.2),
          this.home.y,
          this.home.z + 0.6 * Math.cos(this.time * 0.17),
          0.2,
          dt,
        );
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'coming';
        break;
      case 'coming':
        if (swimTo(f, h.x, h.y, h.z, CLEANERS.speed, dt, 1.4) < 0.12) {
          this.mood = 'cleaning';
          this.wait = this.rand.between(CLEANERS.stay);
        }
        break;
      case 'cleaning':
        // Hanging still, side-on to the wall, head a little down, mouth open to the shrimps.
        f.v.x = f.v.y = f.v.z = 0;
        p.x += (h.x - p.x) * dt;
        p.z += (h.z - p.z) * dt;
        turnTo(f, Math.atan2(this.out.x, this.out.z) + Math.PI / 2, dt, 1.5);
        f.pose.pitch += (-0.3 - f.pose.pitch) * dt;
        f.pose.effort = 0.1 * Math.sin(this.time * 2);
        f.pose.fins = Math.sin(this.time * 3);
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'leaving';
        break;
      case 'leaving':
        if (
          swimTo(
            f,
            this.home.x,
            this.home.y,
            this.home.z,
            CLEANERS.speed,
            dt,
            1.4,
          ) < 0.5
        ) {
          this.mood = 'waiting';
          this.wait = this.rand.between(CLEANERS.every);
        }
        break;
    }
    // The shrimps: on the rock, or climbing over the fish while it is cleaned.
    this.shrimps.forEach((s, i) => {
      const want = this.target(i);
      const k = 1 - Math.exp(-2 * dt);
      s.x += (want.x - s.x) * k;
      s.y += (want.y - s.y) * k;
      s.z += (want.z - s.z) * k;
    });
  }
  private readonly scratch: Vec3 = { x: 0, y: 0, z: 0 };
  private target(i: number): Vec3 {
    if (this.mood !== 'cleaning' || i % 3 === 2)
      return this.onRock(i, this.scratch);
    const p = this.fish.pose.position,
      yaw = this.fish.pose.yaw,
      along = (i % 4) * 0.12 - 0.15 + 0.05 * Math.sin(this.time * 1.3 + i),
      s = this.scratch;
    s.x = p.x + Math.cos(yaw) * along - this.out.x * 0.06;
    s.y = p.y + 0.08 * Math.sin(this.time * 0.9 + i * 2);
    s.z = p.z - Math.sin(yaw) * along - this.out.z * 0.06;
    return s;
  }
}

// ------------------------------------------------------------------ lionfish

export const LIONFISH = {
  /** Fans out when the swimmer is within `wary` m; settles beyond `easy` m. Rates (s⁻¹). */
  wary: 2.6,
  easy: 3.6,
  open: 3,
  close: 0.6,
} as const;

export class LionfishFan {
  /** 0 folded and resting, 1 fully fanned out. */
  spread = 0;
  /** Heading (radians about y; 0 faces +z). */
  heading: number;
  private alarmed = false;
  constructor(
    readonly at: Readonly<Vec3>,
    private readonly rest: number,
  ) {
    this.heading = rest;
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const e = player?.position,
      d = e ? dist(e, this.at) : Infinity;
    if (player?.active && d < LIONFISH.wary) this.alarmed = true;
    else if (!player?.active || d > LIONFISH.easy) this.alarmed = false;
    const target = this.alarmed ? 1 : 0;
    this.spread +=
      (target - this.spread) *
      (1 - Math.exp(-(this.alarmed ? LIONFISH.open : LIONFISH.close) * dt));
    // Turned to face the swimmer while alarmed (spines towards them), back to rest after.
    const want =
        this.alarmed && e
          ? Math.atan2(e.x - this.at.x, e.z - this.at.z)
          : this.rest,
      turn = Math.atan2(
        Math.sin(want - this.heading),
        Math.cos(want - this.heading),
      );
    this.heading += turn * (1 - Math.exp(-(this.alarmed ? 2 : 0.4) * dt));
  }
}

// ------------------------------------------------------------------ flashlight fish

/** Whether fish `i`'s light shows at time `t` (s): lit, but shuttered briefly every few seconds. */
export function blinkOn(i: number, t: number): boolean {
  const period = 2.2 + (i % 5) * 0.55,
    phase = (t + i * 1.37) % period;
  return phase > 0.18 + (i % 3) * 0.06;
}
