import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';

/**
 * v0.6 Pass 043: how an octopus behaves. Pure, allocation-free per frame, deterministic.
 *
 * It lives in a den at the foot of a rock. It sits in the den's mouth, then now and then creeps
 * out over the bottom to one of the rocks nearby, sits there a while, and creeps home. It takes on
 * the colour of what it is on (`blend`: 0 sand, 1 rock). If the swimmer comes close it hurries
 * home and pulls right into its den, flushing dark, and comes out again only once they have gone.
 */
export const OCTOPUS = {
  /** Creeping and hurrying speeds (m/s). */
  creep: 0.16,
  hurry: 0.9,
  /** Seconds in the den, and sitting on a rock. */
  denTime: [15, 35] as const,
  sitTime: [10, 25] as const,
  /** It hides when the swimmer is within `wary` m, and comes out once they are beyond `easy` m. */
  wary: 2.6,
  easy: 4.5,
  calm: 6,
  /** How far it pulls into its den (m) while hidden. */
  tuck: 0.55,
  /** How quickly its colour follows what it is on (s⁻¹). */
  colour: 0.8,
} as const;

export type OctopusMood = 'den' | 'out' | 'sit' | 'home' | 'hidden';
export interface OctopusDen {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Heading out of the den's mouth (radians about y; 0 faces +z). */
  readonly yaw: number;
}

export class OctopusMind {
  mood: OctopusMood = 'den';
  readonly position: Vec3;
  /** Heading it faces (radians about y; 0 faces +z), how far into its den (0 out, 1 in), its speed. */
  heading: number;
  tucked = 0;
  speed = 0;
  /** 0 on sand, 1 on rock; and 1 when flushed dark with alarm. */
  blend = 1;
  alarm = 0;
  private target = 0;
  private wait: number;
  private calm = 0;
  private seed: number;

  constructor(
    readonly den: OctopusDen,
    private readonly rocks: readonly Readonly<Vec3>[],
    private readonly ground: (x: number, z: number) => number,
    /** Whether (x, z) is on rock (rather than sand). */
    private readonly onRock: (x: number, z: number) => boolean,
    seed = 43051,
  ) {
    this.seed = seed >>> 0;
    this.position = { x: den.x, y: den.y, z: den.z };
    this.heading = den.yaw;
    this.wait = this.between(OCTOPUS.denTime);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private between(r: readonly [number, number]): number {
    return r[0] + this.random() * (r[1] - r[0]);
  }
  /** Move towards (x, z) at `speed`; true once there. */
  private go(x: number, z: number, speed: number, dt: number): boolean {
    const p = this.position,
      dx = x - p.x,
      dz = z - p.z,
      d = Math.hypot(dx, dz);
    this.speed = d > 0.05 ? speed : 0;
    if (d > 1e-6) {
      const step = Math.min(d, speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      const want = Math.atan2(dx, dz),
        turn = Math.atan2(
          Math.sin(want - this.heading),
          Math.cos(want - this.heading),
        );
      this.heading += turn * (1 - Math.exp(-4 * dt));
    }
    // On the bottom by its den (the den sits on the sand), over rock and sand elsewhere.
    const atDen = Math.hypot(p.x - this.den.x, p.z - this.den.z) < 0.8;
    p.y +=
      ((atDen ? this.den.y : this.ground(p.x, p.z)) - p.y) *
      (1 - Math.exp(-8 * dt));
    return d < 0.08;
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const p = this.position,
      e = player?.position,
      near =
        !!player?.active &&
        !!e &&
        Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < OCTOPUS.wary,
      gone =
        !player?.active ||
        !e ||
        Math.hypot(e.x - this.den.x, e.y - this.den.y, e.z - this.den.z) >
          OCTOPUS.easy;
    if (near && this.mood !== 'hidden') this.mood = 'home';
    switch (this.mood) {
      case 'den':
        this.go(this.den.x, this.den.z, OCTOPUS.creep, dt);
        this.heading += (this.den.yaw - this.heading) * (1 - Math.exp(-2 * dt));
        this.wait -= dt;
        if (this.wait <= 0 && this.rocks.length) {
          this.target = Math.floor(this.random() * this.rocks.length);
          this.mood = 'out';
        }
        break;
      case 'out': {
        const r = this.rocks[this.target];
        if (this.go(r.x, r.z, OCTOPUS.creep, dt)) {
          this.mood = 'sit';
          this.wait = this.between(OCTOPUS.sitTime);
        }
        break;
      }
      case 'sit':
        this.speed = 0;
        this.wait -= dt;
        if (this.wait <= 0) this.mood = 'home';
        break;
      case 'home': {
        const hurry = near || this.alarm > 0.5;
        if (
          this.go(
            this.den.x,
            this.den.z,
            hurry ? OCTOPUS.hurry : OCTOPUS.creep,
            dt,
          )
        ) {
          if (hurry) {
            this.mood = 'hidden';
            this.calm = OCTOPUS.calm;
          } else {
            this.mood = 'den';
            this.wait = this.between(OCTOPUS.denTime);
          }
        }
        break;
      }
      case 'hidden':
        this.speed = 0;
        this.calm = gone ? this.calm - dt : OCTOPUS.calm;
        if (this.calm <= 0) {
          this.mood = 'den';
          this.wait = this.between(OCTOPUS.denTime);
        }
        break;
    }
    const k = 1 - Math.exp(-OCTOPUS.colour * dt);
    this.tucked +=
      ((this.mood === 'hidden' ? 1 : 0) - this.tucked) *
      (1 - Math.exp(-(this.mood === 'hidden' ? 5 : 0.6) * dt));
    this.alarm +=
      ((near || this.mood === 'hidden' ? 1 : 0) - this.alarm) *
      (1 - Math.exp(-(near ? 6 : 0.4) * dt));
    this.blend +=
      ((this.mood === 'den' || this.mood === 'hidden' || this.onRock(p.x, p.z)
        ? 1
        : 0) -
        this.blend) *
      k;
  }
}
