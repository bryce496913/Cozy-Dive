import { OUTER } from '../config/passage';
import type { Vec3 } from '../config/world';

/**
 * v0.6 Pass 042: a school of great barracuda that now and then comes in from the deep blue
 * beyond the outer reef's glass and circles there, a slowly turning column of silver, before
 * drifting away again. Pure (no rendering), allocation-free per frame, deterministic for a seed.
 *
 * It is not there when the swimmer arrives. Every so often (a check every few minutes) there is a
 * small chance it comes: it drifts in from far out (always lost in the haze there), circles for a
 * couple of minutes, then drifts back out. Nothing is counted or scored.
 */
export const BARRACUDA = {
  count: 40,
  /** The column: its rings' radii (m), its height (m), and how fast each fish swims (m/s). */
  radius: [3, 5.4] as const,
  height: 4.5,
  speed: 1.3,
  /** Where it circles: its centre this far beyond the glass (m), at one of these x and heights. */
  out: 10.5,
  spots: [
    { x: -14, y: 1.5 },
    { x: -3, y: 4 },
    { x: 7, y: 0 },
    { x: 16, y: 3 },
  ],
  /** It comes in from, and goes back out to, this far beyond the glass (m), drifting (m/s). */
  hidden: 36,
  drift: 0.9,
  /** First check after arriving, then between checks (s); the chance it comes at each. */
  first: [25, 90] as const,
  every: [120, 220] as const,
  chance: 0.3,
  /** How long it circles once there (s). */
  stay: [110, 190] as const,
  /** Strokes per second, and how hard. */
  strokeHz: 1.4,
  stroke: 0.7,
} as const satisfies CirclingConfig;

/**
 * v0.6 Pass 043: the shape of any school that comes in from the blue and circles beyond the glass
 * (the barracuda's column, the bigeye trevally's ball). `ball` gathers it into a sphere rather
 * than a column.
 */
export interface CirclingConfig {
  readonly count: number;
  readonly radius: readonly [number, number];
  readonly height: number;
  readonly speed: number;
  readonly out: number;
  readonly spots: readonly { readonly x: number; readonly y: number }[];
  readonly hidden: number;
  readonly drift: number;
  readonly first: readonly [number, number];
  readonly every: readonly [number, number];
  readonly chance: number;
  readonly stay: readonly [number, number];
  readonly strokeHz: number;
  readonly stroke: number;
  readonly ball?: boolean;
}

export type BarracudaState = 'away' | 'arriving' | 'circling' | 'leaving';

/** One fish's pose: where it is, its heading (0 faces +x, positive towards -z) and its stroke. */
export interface BarracudaPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  effort: number;
}

export class CirclingVisit {
  state: BarracudaState = 'away';
  /** The column's centre (updated in place; far out in the haze while away). */
  readonly centre: Vec3;
  private wait = 0;
  private time = 0;
  private seed: number;

  constructor(
    readonly config: CirclingConfig,
    seed: number,
  ) {
    this.seed = seed >>> 0;
    this.centre = { x: 0, y: 0, z: this.hiddenZ() };
    this.arrive();
  }
  hiddenZ(): number {
    return OUTER.glass.z - this.config.hidden;
  }
  circleZ(): number {
    return OUTER.glass.z - this.config.out;
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private between(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }
  /** The swimmer has (re-)entered the outer reef: the school is away, its first chance to come. */
  arrive(): void {
    this.state = 'away';
    this.centre.z = this.hiddenZ();
    this.wait = this.between(this.config.first);
  }
  /** Whether any of it may be in view. */
  get present(): boolean {
    return this.state !== 'away';
  }
  /** Bring it in now (for a check, or a harness). */
  come(): void {
    const spot =
      this.config.spots[Math.floor(this.random() * this.config.spots.length)];
    this.state = 'arriving';
    this.centre.x = spot.x;
    this.centre.y = spot.y;
    this.centre.z = this.hiddenZ();
  }
  update(dt: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const c = this.centre;
    if (this.state === 'away') {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.random() < this.config.chance) this.come();
        else this.wait = this.between(this.config.every);
      }
    } else if (this.state === 'arriving') {
      c.z = Math.min(this.circleZ(), c.z + this.config.drift * dt);
      if (c.z >= this.circleZ()) {
        this.state = 'circling';
        this.wait = this.between(this.config.stay);
      }
    } else if (this.state === 'circling') {
      this.wait -= dt;
      if (this.wait <= 0) this.state = 'leaving';
    } else {
      c.z -= this.config.drift * dt;
      if (c.z <= this.hiddenZ()) {
        c.z = this.hiddenZ();
        this.state = 'away';
        this.wait = this.between(this.config.every);
      }
    }
  }
  /** Fish `i`'s pose in the circling column now (written into `out`). */
  pose(i: number, out: BarracudaPose): BarracudaPose {
    const b = this.config,
      h1 = fract(Math.sin(i * 12.9898) * 43758.5453),
      h2 = fract(Math.sin(i * 78.233) * 12345.678),
      // A ball: rings narrower towards its top and bottom.
      lift = h2 - 0.5,
      shape = b.ball ? Math.sqrt(Math.max(0.05, 1 - 4 * lift * lift)) : 1,
      r = (b.radius[0] + (b.radius[1] - b.radius[0]) * h1) * shape,
      a = (i / b.count) * Math.PI * 2 * 3.1 + (b.speed / r) * this.time,
      c = this.centre;
    out.x = c.x + Math.cos(a) * r;
    out.y = c.y + lift * b.height + 0.25 * Math.sin(a * 2 + i);
    out.z = c.z + Math.sin(a) * r;
    // Swimming round with increasing angle: its velocity is along (-sin a, 0, cos a).
    out.yaw = Math.atan2(-Math.cos(a), -Math.sin(a));
    out.effort = Math.sin(this.time * b.strokeHz * Math.PI * 2 + i * 2.39);
    return out;
  }
}
/** The barracuda's own visit (Pass 042). */
export class BarracudaVisit extends CirclingVisit {
  constructor(seed = 42013) {
    super(BARRACUDA, seed);
  }
  static hiddenZ(): number {
    return OUTER.glass.z - BARRACUDA.hidden;
  }
  static circleZ(): number {
    return OUTER.glass.z - BARRACUDA.out;
  }
}
const fract = (x: number): number => x - Math.floor(x);
