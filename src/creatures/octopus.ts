import type { Vec3 } from '../config/world';
import type { PlayerPresence } from '../fish/FishDiverReaction';

/**
 * v0.6 Pass 043: how an octopus behaves. Pure, allocation-free per frame, deterministic.
 *
 * It lives in a den at the foot of a rock. It sits in the den's mouth, then now and then creeps
 * out over the bottom to one of the rocks nearby, sits there a while, and creeps home. It takes on
 * the colour of what it is on (`blend`: 0 sand, 1 rock). If the swimmer comes close it hurries
 * home and pulls right into its den, flushing dark, and comes out again only once they have gone.
 *
 * v0.6 Pass 052 (playtest: it floated in mid water, then jumped back to its den): it keeps to the
 * floor it is given (the seabed, never the tops of corals or rock hoods), visits the foot of each
 * rock rather than its middle, and eases into and out of its pace.
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
  /**
   * v0.6 Pass 052: how quickly its pace follows the speed it wants (s⁻¹): it gathers itself and
   * jets home over a second or so rather than leaping off at once.
   */
  pace: 2.2,
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

  /** Where it sits by each rock: at the rock's foot, on the side towards the den. */
  private readonly feet: readonly Readonly<Vec3>[];
  constructor(
    readonly den: OctopusDen,
    rocks: readonly Readonly<Vec3>[],
    /** The floor it walks on (the seabed, not the tops of what stands on it). */
    private readonly ground: (x: number, z: number) => number,
    /** Whether (x, z) is on rock (rather than sand). */
    private readonly onRock: (x: number, z: number) => boolean,
    seed = 43051,
  ) {
    this.seed = seed >>> 0;
    this.feet = rocks.map((r) => {
      const dx = den.x - r.x,
        dz = den.z - r.z,
        d = Math.hypot(dx, dz) || 1;
      let x = r.x,
        z = r.z;
      for (let k = 0; k < 40 && onRock(x, z); k++) {
        x += (dx / d) * 0.1;
        z += (dz / d) * 0.1;
      }
      // A little further out, so its arms rest against the rock rather than in it.
      x += (dx / d) * 0.15;
      z += (dz / d) * 0.15;
      return { x, y: ground(x, z), z };
    });
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
  /** Move towards (x, z) at up to `speed`, easing its pace; true once there. */
  private go(x: number, z: number, speed: number, dt: number): boolean {
    const p = this.position,
      dx = x - p.x,
      dz = z - p.z,
      d = Math.hypot(dx, dz),
      // Slow down over the last stretch, so it settles rather than stops dead.
      want = d > 0.05 ? Math.min(speed, 0.15 + d * 1.2) : 0;
    this.speed += (want - this.speed) * (1 - Math.exp(-OCTOPUS.pace * dt));
    if (d > 1e-6) {
      const step = Math.min(d, this.speed * dt);
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
      const want = Math.atan2(dx, dz),
        turn = Math.atan2(
          Math.sin(want - this.heading),
          Math.cos(want - this.heading),
        );
      this.heading += turn * (1 - Math.exp(-4 * dt));
    }
    // On the floor all the way, blending onto its den's floor as it nears it (no step).
    const near = Math.hypot(p.x - this.den.x, p.z - this.den.z),
      k = Math.min(1, Math.max(0, (near - 0.3) / 1.2)),
      floor = this.den.y + (this.ground(p.x, p.z) - this.den.y) * k;
    p.y += (floor - p.y) * (1 - Math.exp(-8 * dt));
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
        if (this.wait <= 0 && this.feet.length) {
          this.target = Math.floor(this.random() * this.feet.length);
          this.mood = 'out';
        }
        break;
      case 'out': {
        const r = this.feet[this.target];
        if (this.go(r.x, r.z, OCTOPUS.creep, dt)) {
          this.mood = 'sit';
          this.wait = this.between(OCTOPUS.sitTime);
        }
        break;
      }
      case 'sit':
        this.speed *= Math.exp(-6 * dt);
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
        this.speed *= Math.exp(-6 * dt);
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
