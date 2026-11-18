import { ICE } from '../config/passage';
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
 * v0.6 Pass 047: everyday life under the ice. Pure (no rendering), allocation-free per frame,
 * deterministic for a seed; each writes `FishPose`s (or positions) that the runtime draws.
 *
 *   - `EmperorDives`: emperor penguins drop in through the breathing holes, streak down in a long
 *     swoop over the seabed trailing bubbles, and shoot back up and out;
 *   - `AdelieGroup`: a little group of Adélie penguins zipping about just under the ice;
 *   - `WeddellSeal`: a big, calm seal hanging near a breathing hole, rising now and then to put its
 *     head up into the hole to breathe, and calling (its trills) every so often;
 *   - `IcefishRest`: icefish resting on the seabed on their fins, hopping now and then to a new spot;
 *   - `Notothens`: small fish tucked under the ice in its hollows, darting and hiding up against it;
 *   - `krillAt` / `driftAt`: the krill swarm, and the drifting sea butterflies and comb jellies.
 * Everything stays inside the tank: above the seabed, below the ice, short of the icebergs.
 */

/** Where the animals may go: the seabed (with stones) beneath, the underside of the ice, the walls. */
export interface IceLimits {
  readonly ground: (x: number, z: number) => number;
  readonly ceiling: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}
export function iceLimits(ground: (x: number, z: number) => number): IceLimits {
  const w = ICE.walls;
  return {
    ground,
    ceiling: ICE.ceiling,
    minX: -w.x + 2.5,
    maxX: w.x - 2.5,
    minZ: w.farZ + 2.5,
    maxZ: ICE.tunnel.wallZ - 2.5,
  };
}
/** Keep `p` inside the tank: `floor` m over the seabed, `roof` m under the ice. */
export function keepInIce(
  l: IceLimits,
  p: Vec3,
  floor = 0.4,
  roof = 0.6,
): void {
  p.x = Math.max(l.minX, Math.min(l.maxX, p.x));
  p.z = Math.max(l.minZ, Math.min(l.maxZ, p.z));
  p.y = Math.max(l.ground(p.x, p.z) + floor, Math.min(l.ceiling - roof, p.y));
}
const dist = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ------------------------------------------------------------------ emperor penguins

export const EMPEROR = {
  // v0.6 Pass 052 (playtest: "there are no creatures"): more of them, diving far more often.
  count: 6,
  /** Seconds between dives (each penguin), and its speeds down and up (m/s). */
  every: [10, 26] as const,
  down: 2.6,
  up: 3.6,
  /** How deep the swoop goes (m over the seabed), and how far it carries (m). */
  low: 1.6,
  reach: 12,
  /** Bubbles trailed per second while diving. */
  bubbles: 14,
} as const;
export type DiveMood = 'away' | 'down' | 'swoop' | 'up';
interface Diver {
  readonly swim: Swim;
  mood: DiveMood;
  wait: number;
  hole: number;
  readonly low: Vec3;
  readonly far: Vec3;
}

export class EmperorDives {
  readonly divers: Diver[] = [];
  /** This frame's bubble points (from the divers' tails), up to `bubbleCount`. */
  readonly bubbles: Vec3[] = Array.from({ length: 4 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  bubbleCount = 0;
  private time = 0;
  private readonly rand: Seeded;
  constructor(
    makePose: () => FishPose,
    private readonly limits: IceLimits,
    seed = 47011,
  ) {
    this.rand = new Seeded(seed);
    for (let i = 0; i < EMPEROR.count; i++) {
      const d: Diver = {
        swim: createSwim(makePose()),
        mood: 'away',
        wait: this.rand.between([8 + i * 20, 30 + i * 25]),
        hole: i % ICE.holes.length,
        low: { x: 0, y: 0, z: 0 },
        far: { x: 0, y: 0, z: 0 },
      };
      this.hide(d);
      this.divers.push(d);
    }
  }
  private hide(d: Diver): void {
    const h = ICE.holes[d.hole],
      p = d.swim.pose.position;
    p.x = h.x;
    p.y = ICE.ceiling + 3;
    p.z = h.z;
  }
  /** Begin a dive now (for a harness). */
  dive(i = 0): void {
    const d = this.divers[i];
    if (!d) return;
    d.mood = 'down';
    const h = ICE.holes[d.hole],
      a = this.rand.next() * Math.PI * 2;
    d.low.x = h.x + Math.cos(a) * 5;
    d.low.z = h.z + Math.sin(a) * 5;
    d.low.y = 0;
    keepInIce(this.limits, d.low, EMPEROR.low, 2);
    d.far.x = d.low.x + Math.cos(a) * EMPEROR.reach;
    d.far.z = d.low.z + Math.sin(a) * EMPEROR.reach;
    d.far.y = d.low.y + 1.5;
    keepInIce(this.limits, d.far, EMPEROR.low, 2);
    this.hide(d);
    d.swim.v.x = d.swim.v.z = 0;
    d.swim.v.y = -EMPEROR.down;
  }
  present(i: number): boolean {
    return this.divers[i]?.mood !== 'away';
  }
  update(dt: number, player?: PlayerPresence): void {
    this.bubbleCount = 0;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.divers.forEach((d, i) => {
      const p = d.swim.pose.position;
      switch (d.mood) {
        case 'away':
          d.wait -= dt;
          if (d.wait <= 0) {
            d.hole = (d.hole + 1 + i) % ICE.holes.length;
            this.dive(i);
          }
          return;
        case 'down':
          if (
            swimTo(
              d.swim,
              d.low.x,
              d.low.y,
              d.low.z,
              EMPEROR.down,
              dt,
              3,
              2.5,
            ) < 1.2
          )
            d.mood = 'swoop';
          break;
        case 'swoop':
          if (
            swimTo(
              d.swim,
              d.far.x,
              d.far.y,
              d.far.z,
              EMPEROR.down * 1.1,
              dt,
              3,
              2,
            ) < 1.2
          )
            d.mood = 'up';
          break;
        case 'up': {
          const h = ICE.holes[d.hole];
          swimTo(d.swim, h.x, ICE.ceiling + 3, h.z, EMPEROR.up, dt, 3.4, 2);
          if (p.y > ICE.ceiling + 2) {
            d.mood = 'away';
            d.wait = this.rand.between(EMPEROR.every);
          }
          break;
        }
      }
      // Give a close swimmer room: veer off and away.
      if (player?.active && dist(player.position, p) < 2.5) {
        const e = player.position,
          l = dist(e, p) || 1;
        p.x += ((p.x - e.x) / l) * dt * 1.5;
        p.z += ((p.z - e.z) / l) * dt * 1.5;
      }
      // Below the ice, keep clear of the seabed and walls (in the hole's chimney, of the walls only).
      if (p.y < ICE.ceiling - 0.6) keepInIce(this.limits, p, 0.8, 0.6);
      // A trail of bubbles from its tail.
      if (
        this.bubbleCount < this.bubbles.length &&
        Math.sin(this.time * EMPEROR.bubbles * Math.PI + i) > 0.9
      ) {
        const b = this.bubbles[this.bubbleCount++],
          yaw = d.swim.pose.yaw;
        b.x = p.x - Math.cos(yaw) * 0.5;
        b.y = p.y;
        b.z = p.z + Math.sin(yaw) * 0.5;
      }
    });
  }
}

// ------------------------------------------------------------------ Adélie penguins

export const ADELIE = {
  // v0.6 Pass 052: a bigger group, zipping lower down, where the swimmer is.
  count: 8,
  speed: 2.1,
  depth: [4, 7.5] as const,
} as const;

/** A leader zipping on a looping course just under the ice, the others close behind it. */
export class AdelieGroup {
  readonly swims: Swim[];
  private time = 0;
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  constructor(
    makePose: () => FishPose,
    private readonly limits: IceLimits,
    private readonly centre: { readonly x: number; readonly z: number } = {
      x: 2,
      z: -38,
    },
  ) {
    this.swims = Array.from({ length: ADELIE.count }, (_, i) => {
      const s = createSwim(makePose());
      s.pose.position.x = centre.x + i;
      s.pose.position.y = limits.ceiling - 2;
      s.pose.position.z = centre.z;
      return s;
    });
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const t = this.time * 0.11,
      a = this.aim,
      lead = this.swims[0].pose.position;
    // A looping, figure-of-eight course under the ice, dipping and rising.
    a.x = this.centre.x + 11 * Math.sin(t);
    a.z = this.centre.z + 9 * Math.sin(t * 2);
    a.y =
      this.limits.ceiling -
      (ADELIE.depth[0] +
        (ADELIE.depth[1] - ADELIE.depth[0]) * (0.5 + 0.5 * Math.sin(t * 3)));
    if (player?.active && dist(player.position, lead) < 3.5) {
      // Swerve away from a swimmer in their path.
      a.x += (lead.x - player.position.x) * 2;
      a.z += (lead.z - player.position.z) * 2;
    }
    keepInIce(this.limits, a, 1.5, 1.2);
    swimTo(this.swims[0], a.x, a.y, a.z, ADELIE.speed, dt, 3.4, 2.5);
    for (let i = 1; i < this.swims.length; i++) {
      const ahead = this.swims[i - 1].pose.position,
        side = i % 2 ? 0.6 : -0.6;
      swimTo(
        this.swims[i],
        ahead.x + side * Math.cos(this.time + i),
        ahead.y - 0.15 * i,
        ahead.z + side * Math.sin(this.time + i),
        ADELIE.speed * 1.15,
        dt,
        3.6,
        3,
      );
      keepInIce(this.limits, this.swims[i].pose.position, 1, 0.8);
    }
  }
}

// ------------------------------------------------------------------ Weddell seal

export const WEDDELL = {
  /** Hangs this far under the ice by its hole (m), and drifts round it (m). */
  // v0.6 Pass 052: lower, within sight of a swimmer (was 3 m under the ice).
  hang: 5.5,
  drift: 2.5,
  /** Seconds between breaths, and up in the hole; seconds between calls. */
  breath: [60, 110] as const,
  breathe: 9,
  call: [18, 40] as const,
  /** Keeps at least this far from the swimmer (m). */
  personal: 3,
} as const;
export type SealMood = 'hang' | 'rise' | 'breathe' | 'sink';

export class WeddellSeal {
  readonly swim: Swim;
  mood: SealMood = 'hang';
  /** True on the frame it calls (the runtime plays its trill). */
  called = false;
  private wait: number;
  private callIn: number;
  private time = 0;
  private readonly hole: {
    readonly x: number;
    readonly z: number;
    readonly r: number;
  };
  private readonly rand: Seeded;
  constructor(
    pose: FishPose,
    private readonly limits: IceLimits,
    hole = 0,
    seed = 47021,
  ) {
    this.rand = new Seeded(seed);
    this.hole = ICE.holes[hole];
    this.swim = createSwim(pose);
    pose.position.x = this.hole.x + WEDDELL.drift;
    pose.position.y = limits.ceiling - WEDDELL.hang;
    pose.position.z = this.hole.z;
    this.wait = this.rand.between(WEDDELL.breath);
    this.callIn = this.rand.between([4, 12]);
  }
  get pose(): FishPose {
    return this.swim.pose;
  }
  /** Go up to breathe now (for a harness). */
  breatheNow(): void {
    this.mood = 'rise';
  }
  update(dt: number, player?: PlayerPresence): void {
    this.called = false;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const h = this.hole,
      p = this.swim.pose,
      top = this.limits.ceiling;
    this.callIn -= dt;
    if (this.callIn <= 0 && this.mood !== 'breathe') {
      this.called = true;
      this.callIn = this.rand.between(WEDDELL.call);
    }
    switch (this.mood) {
      case 'hang': {
        // Hanging near its hole, drifting slowly round it, turning lazily.
        const a = this.time * 0.05,
          tx = h.x + Math.cos(a) * WEDDELL.drift,
          tz = h.z + Math.sin(a) * WEDDELL.drift;
        swimTo(
          this.swim,
          tx,
          top - WEDDELL.hang + 0.3 * Math.sin(this.time * 0.2),
          tz,
          0.25,
          dt,
          0.4,
          0.6,
        );
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'rise';
        break;
      }
      case 'rise':
        // Up into the hole, head first.
        if (swimTo(this.swim, h.x, top + 0.4, h.z, 0.8, dt, 0.8, 1.2) < 0.4) {
          this.mood = 'breathe';
          this.wait = WEDDELL.breathe;
        }
        p.pitch += (1.3 - p.pitch) * Math.min(1, dt * 2);
        break;
      case 'breathe':
        this.swim.v.x = this.swim.v.y = this.swim.v.z = 0;
        p.pitch += (1.35 - p.pitch) * Math.min(1, dt * 2);
        p.effort = 0.15 * Math.sin(this.time * 0.9);
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'sink';
        break;
      case 'sink':
        if (
          swimTo(
            this.swim,
            h.x + WEDDELL.drift,
            top - WEDDELL.hang,
            h.z,
            0.6,
            dt,
            0.6,
            1,
          ) < 0.4
        ) {
          this.mood = 'hang';
          this.wait = this.rand.between(WEDDELL.breath);
        }
        break;
    }
    // Calm, but it keeps its distance from a swimmer.
    if (player?.active && this.mood === 'hang') {
      const e = player.position,
        d = dist(e, p.position);
      if (d < WEDDELL.personal && d > 1e-6) {
        p.position.x += ((p.position.x - e.x) / d) * dt * 0.8;
        p.position.z += ((p.position.z - e.z) / d) * dt * 0.8;
        turnTo(
          this.swim,
          Math.atan2(-(e.z - p.position.z), e.x - p.position.x),
          dt,
          0.8,
        );
      }
    }
    if (this.mood !== 'breathe' && this.mood !== 'rise')
      keepInIce(this.limits, p.position, 1, 1.2);
  }
}

// ------------------------------------------------------------------ icefish

export const ICEFISH = {
  // v0.6 Pass 052: twice as many.
  count: 12,
  every: [20, 45] as const,
  hop: [2, 4] as const,
  wary: 2,
} as const;
interface Rester {
  readonly swim: Swim;
  readonly home: Vec3;
  readonly spot: Vec3;
  wait: number;
  moving: boolean;
}

/** Icefish propped on their fins on the seabed, hopping now and then (or from a close swimmer). */
export class IcefishRest {
  readonly fish: Rester[] = [];
  private readonly rand: Seeded;
  constructor(
    makePose: () => FishPose,
    private readonly limits: IceLimits,
    homes: readonly Readonly<Vec3>[],
    seed = 47031,
  ) {
    this.rand = new Seeded(seed);
    for (let i = 0; i < ICEFISH.count && homes.length; i++) {
      const h = homes[i % homes.length],
        s = createSwim(makePose()),
        spot = { x: h.x + i * 0.7, y: 0, z: h.z - i * 0.5 };
      keepInIce(limits, spot, 0.12, 2);
      Object.assign(s.pose.position, spot);
      s.pose.yaw = this.rand.next() * Math.PI * 2;
      this.fish.push({
        swim: s,
        home: { ...h },
        spot,
        wait: this.rand.between(ICEFISH.every),
        moving: false,
      });
    }
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    for (const f of this.fish) {
      const p = f.swim.pose.position,
        near = !!player?.active && dist(player.position, p) < ICEFISH.wary;
      f.wait -= dt;
      if (!f.moving && (f.wait <= 0 || near)) {
        // A short hop to a new spot near home (away from the swimmer if it is close).
        const a =
            near && player
              ? Math.atan2(p.z - player.position.z, p.x - player.position.x)
              : this.rand.next() * Math.PI * 2,
          r = this.rand.between(ICEFISH.hop);
        f.spot.x = (near ? p.x : f.home.x) + Math.cos(a) * r;
        f.spot.z = (near ? p.z : f.home.z) + Math.sin(a) * r;
        f.spot.y = 0;
        keepInIce(this.limits, f.spot, 0.12, 2);
        f.moving = true;
      }
      if (f.moving) {
        const mid = Math.min(1, dist(p, f.spot) / 2);
        if (
          swimTo(
            f.swim,
            f.spot.x,
            f.spot.y + 0.4 * mid,
            f.spot.z,
            near ? 1.4 : 0.7,
            dt,
            2.2,
            3,
          ) < 0.1
        ) {
          f.moving = false;
          f.wait = this.rand.between(ICEFISH.every);
          f.swim.v.x = f.swim.v.y = f.swim.v.z = 0;
        }
      } else {
        // Resting: propped still, only the pectorals fanning slowly.
        f.swim.pose.pitch *= 1 - Math.min(1, dt * 2);
        f.swim.pose.effort = 0;
        f.swim.pose.fins = 0.3 * Math.sin(p.x * 3 + f.wait);
      }
      p.y = Math.max(p.y, this.limits.ground(p.x, p.z) + 0.1);
    }
  }
}

// ------------------------------------------------------------------ bald notothens

// v0.6 Pass 052: more of them.
export const NOTOTHEN = { count: 24, wary: 2.2 } as const;

/** Small fish in the hollows under the ice: hovering, darting, pressing up into the ice when wary. */
export class Notothens {
  readonly swims: Swim[] = [];
  private readonly homes: Vec3[] = [];
  private time = 0;
  private readonly rand: Seeded;
  constructor(
    makePose: () => FishPose,
    private readonly limits: IceLimits,
    seed = 47041,
  ) {
    this.rand = new Seeded(seed);
    for (let i = 0; i < NOTOTHEN.count; i++) {
      const h = {
        x: limits.minX + 3 + this.rand.next() * (limits.maxX - limits.minX - 6),
        y: limits.ceiling - 0.7 - this.rand.next() * 0.6,
        z: limits.minZ + 3 + this.rand.next() * (limits.maxZ - limits.minZ - 6),
      };
      // In loose clusters of a few.
      if (i % 3 && this.homes.length) {
        const prev = this.homes[this.homes.length - 1];
        h.x = prev.x + (this.rand.next() - 0.5) * 2;
        h.z = prev.z + (this.rand.next() - 0.5) * 2;
      }
      this.homes.push(h);
      const s = createSwim(makePose());
      Object.assign(s.pose.position, h);
      this.swims.push(s);
    }
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.swims.forEach((s, i) => {
      const h = this.homes[i],
        p = s.pose.position,
        wary = !!player?.active && dist(player.position, p) < NOTOTHEN.wary,
        t = this.time * 0.4 + i * 1.7;
      const tx =
          h.x +
          0.6 * Math.sin(t) +
          (wary && player ? (p.x - player.position.x) * 0.5 : 0),
        tz =
          h.z +
          0.6 * Math.cos(t * 1.3) +
          (wary && player ? (p.z - player.position.z) * 0.5 : 0),
        ty = wary ? this.limits.ceiling - 0.45 : h.y + 0.15 * Math.sin(t * 2);
      swimTo(s, tx, ty, tz, wary ? 1.2 : 0.25, dt, 2.4, wary ? 4 : 1.5);
      keepInIce(this.limits, p, 2, 0.4);
    });
  }
}

// ------------------------------------------------------------------ krill and drifters

/** Krill `i` of `n` in a swarm centred at `c` at time `t` (written into `out`). */
export function krillAt(
  i: number,
  n: number,
  c: Readonly<Vec3>,
  t: number,
  out: Vec3,
): Vec3 {
  const g = i * 2.399963,
    k = (i + 0.5) / n,
    r = 2.2 * Math.cbrt(k) * (1 + 0.15 * Math.sin(t * 0.7 + i)),
    up = 1 - 2 * k,
    ring = Math.sqrt(Math.max(0, 1 - up * up)),
    spin = t * (0.35 + 0.2 * Math.sin(i));
  out.x = c.x + Math.cos(g + spin) * ring * r;
  out.y = c.y + up * r * 0.6;
  out.z = c.z + Math.sin(g + spin) * ring * r;
  return out;
}
/** A drifting thing `i` (sea butterfly or comb jelly) round `c`, slow and wandering. */
export function driftAt(
  i: number,
  c: Readonly<Vec3>,
  spread: number,
  t: number,
  out: Vec3,
): Vec3 {
  const a = i * 1.618 + t * (0.03 + (i % 5) * 0.006);
  out.x = c.x + Math.cos(a) * spread * (0.4 + 0.6 * ((i * 0.37) % 1));
  out.y = c.y + Math.sin(t * 0.13 + i) * 1.5 + ((i * 0.71) % 1) * 3 - 1.5;
  out.z = c.z + Math.sin(a * 1.3) * spread * (0.4 + 0.6 * ((i * 0.53) % 1));
  return out;
}
