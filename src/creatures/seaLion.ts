import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';

/**
 * v0.6 Pass 039: how the kelp forest's sea lion behaves. Pure (no rendering), allocation-free per
 * frame, deterministic for a given seed.
 *
 * It roams the forest on long, easy loops. When the swimmer comes within `notice` m (and it has
 * not just played), it swims over and plays: it circles them a few metres away, swooping up and
 * down, now and then reversing direction or rolling right over, never touching them. After a
 * while it darts off back into the forest at speed, and only comes to play again after a rest.
 * It always keeps clear of the seabed, rocks, walls and surface (`SeaLionLimits`).
 */
export const SEA_LION = {
  /** Roaming: a slow loop around the forest (centre, radii, height and its swell, speed). */
  roam: {
    x: 0,
    // v0.6 Pass 041: fitted to the smaller forest.
    z: -34,
    rx: 13,
    rz: 16,
    y: 7,
    swell: 2.5,
    speed: 1.5,
    rate: 0.04,
  },
  /** Notices the swimmer within this distance (m), and plays for a while (s). */
  notice: 14,
  play: [18, 30] as const,
  /** Then darts off for `leave` s and rests for a while before it may play again (s). */
  leave: 6,
  rest: [25, 45] as const,
  /** Circling: radius range (m), speed (m/s), swoop height (m). */
  circle: { near: 2.8, far: 4.2, speed: 2.6, swoop: 1.4 },
  /** Never closer than this to the swimmer's eye (m). */
  personal: 1.8,
  /** Top speed when darting off (m/s); how quickly velocity follows its aim (s⁻¹). */
  dash: 4.2,
  response: 2.2,
  /** A barrel roll (radians over seconds), every so often while playing. */
  roll: { every: [5, 10] as const, takes: 1.1 },
  /** Strokes per second while cruising and while playing or darting. */
  strokeHz: { cruise: 0.55, play: 1.2 },
  /** Banks into turns by this much (and at most this much). */
  bank: 0.35,
  maxBank: 0.7,
} as const;

export type SeaLionMood = 'roam' | 'approach' | 'play' | 'leave';

/** Where it may go: the highest thing beneath, the water's top, and the forest's walls. */
export interface SeaLionLimits {
  /** Highest seabed, rock or boulder within `radius` of (x, z). */
  readonly ground: (x: number, z: number, radius: number) => number;
  readonly top: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const approach = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class SeaLionSwimmer {
  readonly position: Vec3;
  readonly velocity: Vec3 = { x: 0, y: 0, z: 0 };
  /** Heading about +y (0 faces +x, positive towards -z), pitch up, and roll (bank plus rolls). */
  yaw = 0;
  pitch = 0;
  roll = 0;
  /** Current stroke, -1..1 (the runtime blends Stroke_Left (+) and Stroke_Right (-)). */
  effort = 0;
  mood: SeaLionMood = 'roam';
  private readonly aim: Vec3 = { x: 0, y: 0, z: 0 };
  private roamAngle = 0;
  private circleAngle = 0;
  private circleDir = 1;
  private moodTime = 0;
  private playFor = 0;
  private restLeft = 0;
  private nextRoll = 0;
  private rolling = -1;
  private bank = 0;
  private phase = 0;
  private time = 0;
  private seed: number;

  constructor(
    private readonly limits: SeaLionLimits,
    seed = 39017,
  ) {
    this.seed = seed >>> 0;
    const r = SEA_LION.roam;
    this.roamAngle = this.random() * Math.PI * 2;
    this.position = {
      x: r.x + Math.cos(this.roamAngle) * r.rx,
      y: r.y,
      z: r.z + Math.sin(this.roamAngle) * r.rz,
    };
    this.keepInside(this.position);
    this.nextRoll = this.between(SEA_LION.roll.every);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private between(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }
  /** Move a point inside the limits (clear of the ground and the walls, below the top). */
  private keepInside(p: Vec3): void {
    const l = this.limits;
    p.x = Math.max(l.minX, Math.min(l.maxX, p.x));
    p.z = Math.max(l.minZ, Math.min(l.maxZ, p.z));
    p.y = Math.max(l.ground(p.x, p.z, 1.2) + 1.1, Math.min(l.top, p.y));
  }
  private setMood(mood: SeaLionMood): void {
    this.mood = mood;
    this.moodTime = 0;
  }
  update(dt: number, player: PlayerPresence, reducedMotion = false): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.moodTime += dt;
    this.restLeft = Math.max(0, this.restLeft - dt);
    const s = SEA_LION,
      p = this.position,
      e = player.position,
      toEye = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z);
    // What it feels like doing.
    if (this.mood === 'roam') {
      if (player.active && this.restLeft <= 0 && toEye < s.notice) {
        this.setMood('approach');
        this.playFor = this.between(s.play);
        this.circleAngle = Math.atan2(p.z - e.z, p.x - e.x);
        this.circleDir = this.random() < 0.5 ? 1 : -1;
      }
    } else if (this.mood === 'approach') {
      if (!player.active) this.setMood('roam');
      else if (toEye < s.circle.far + 1.5) this.setMood('play');
      else if (this.moodTime > 15) this.setMood('roam');
    } else if (this.mood === 'play') {
      if (!player.active || this.moodTime > this.playFor) {
        this.setMood('leave');
        this.restLeft = this.between(s.rest);
        // Dart off the way it is facing, out into the forest.
        this.roamAngle = Math.atan2(p.z - s.roam.z, p.x - s.roam.x);
      }
    } else if (this.mood === 'leave' && this.moodTime > s.leave) {
      this.setMood('roam');
    }
    // Where it is aiming, and how fast.
    let speed: number = s.roam.speed;
    const a = this.aim;
    if (this.mood === 'roam' || this.mood === 'leave') {
      this.roamAngle += s.roam.rate * dt * (this.mood === 'leave' ? 3 : 1);
      a.x = s.roam.x + Math.cos(this.roamAngle + 0.6) * s.roam.rx;
      a.z = s.roam.z + Math.sin(this.roamAngle + 0.6) * s.roam.rz;
      a.y = s.roam.y + s.roam.swell * Math.sin(this.time * 0.15);
      if (this.mood === 'leave') speed = s.dash;
    } else {
      const c = s.circle,
        r = c.near + (c.far - c.near) * (0.5 + 0.5 * Math.sin(this.time * 0.4)),
        swoop = reducedMotion ? c.swoop * 0.4 : c.swoop;
      if (this.mood === 'play') {
        this.circleAngle += (this.circleDir * c.speed * dt) / r;
        // Now and then it turns about and circles the other way.
        if (this.random() < dt * 0.04) this.circleDir *= -1;
      }
      a.x = e.x + Math.cos(this.circleAngle) * r;
      a.z = e.z + Math.sin(this.circleAngle) * r;
      a.y =
        e.y + 0.3 + swoop * Math.sin(this.circleAngle * 2 + this.time * 0.3);
      speed = this.mood === 'approach' ? s.dash * 0.8 : c.speed;
    }
    this.keepInside(a);
    // Steer: velocity follows the aim smoothly.
    let dx = a.x - p.x,
      dy = a.y - p.y,
      dz = a.z - p.z;
    const d = Math.hypot(dx, dy, dz) || 1,
      want = Math.min(speed, d * 1.5),
      k = approach(s.response, dt),
      v = this.velocity;
    dx = (dx / d) * want;
    dy = (dy / d) * want;
    dz = (dz / d) * want;
    v.x += (dx - v.x) * k;
    v.y += (dy - v.y) * k;
    v.z += (dz - v.z) * k;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    // Never into the swimmer: slide round them at its personal distance.
    const ox = p.x - e.x,
      oy = p.y - e.y,
      oz = p.z - e.z,
      o = Math.hypot(ox, oy, oz);
    if (player.active && o < s.personal && o > 1e-6) {
      p.x = e.x + (ox / o) * s.personal;
      p.y = e.y + (oy / o) * s.personal;
      p.z = e.z + (oz / o) * s.personal;
    }
    this.keepInside(p);
    // Face along its motion; bank into turns; roll right over now and then while playing.
    const h = Math.hypot(v.x, v.z),
      turn = approach(3, dt);
    if (h > 0.05) {
      const change = wrap(Math.atan2(-v.z, v.x) - this.yaw) * turn;
      this.yaw = wrap(this.yaw + change);
      this.bank +=
        (Math.max(-s.maxBank, Math.min(s.maxBank, (-change / dt) * s.bank)) -
          this.bank) *
        approach(2, dt);
    }
    this.pitch +=
      (Math.atan2(v.y, Math.max(h, 0.05)) * 0.8 - this.pitch) * turn;
    if (this.mood === 'play' && !reducedMotion) {
      if (this.rolling < 0) {
        this.nextRoll -= dt;
        if (this.nextRoll <= 0) this.rolling = 0;
      } else {
        this.rolling += dt / s.roll.takes;
        if (this.rolling >= 1) {
          this.rolling = -1;
          this.nextRoll = this.between(s.roll.every);
        }
      }
    } else this.rolling = -1;
    const t = Math.max(0, this.rolling),
      spin = this.rolling >= 0 ? Math.PI * 2 * t * t * (3 - 2 * t) : 0;
    this.roll = (reducedMotion ? 0 : this.bank) + this.circleDir * spin;
    // Its stroke: quicker while playing or darting, gliding between strokes when cruising.
    const hz = this.mood === 'roam' ? s.strokeHz.cruise : s.strokeHz.play,
      g = Math.max(0, Math.min(1, (Math.sin(this.time * 0.35) - 0.3) / 0.4)),
      glide = this.mood === 'roam' ? 1 - 0.85 * g * g * (3 - 2 * g) : 1;
    this.phase = (this.phase + Math.PI * 2 * hz * dt) % (Math.PI * 2);
    this.effort = Math.sin(this.phase) * glide * (reducedMotion ? 0.6 : 1);
  }
}
