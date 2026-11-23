import type { Vec3 } from '../config/world';

/**
 * v0.6 Pass 052 (playtest: "the sharks getting scared needs a better animation"): how a resting
 * shark is startled and bolts. Pure, deterministic, allocation-free per frame. Shared by the
 * cave's resting whitetips and its sleeping nurse shark.
 *
 * Before, a startled shark began sliding away at once in whatever direction it faced, turning
 * round as it went. Now it moves as a fish does:
 *   1. **flinch**: a C-start. Its body snaps into a hard bend and it pivots sharply away from the
 *      swimmer, lifting its nose off the sand, barely moving forward;
 *   2. **flee**: it straightens with hard, fast tail beats and drives forward along its heading
 *      (never sideways), accelerating to a dash, banking into its turns, nose up as it climbs;
 *   3. **settle**: its beats slow to an easy cruise as it swims to a resting place well away from
 *      the swimmer, gliding in nose-down, its beats fading as it touches down.
 * With reduced motion there is no flinch bend and the beats are gentler.
 */
export const BOLT = {
  /** A swimmer within this many metres startles it (m). */
  scare: 3.2,
  /** Seconds of the flinch, of the dash after it, and the calm (s) before it can startle again. */
  flinch: 0.45,
  flee: 3.2,
  calm: 6,
  /** Dash and cruise speeds (m/s), and how quickly speed follows (s⁻¹), bursting and easing. */
  dash: 2.8,
  cruise: 1.0,
  burst: 5,
  ease: 2,
  /** Turn rates (rad/s): the flinch's snap, while dashing, and while cruising to settle. */
  snap: 7,
  turn: 2.6,
  glide: 1.4,
  /** Swimming height above the sand while it flees or moves (m). */
  swimLift: 1.1,
  /**
   * Tail beats: base rate (Hz), extra per m/s, and the strength while dashing and cruising.
   * V0.8 Pass 097: the shared stroke morph is authored for cruising (its tail throw is about 8%
   * of body length at weight 1), so at 0.95 a dashing shark (nearly two body lengths a second)
   * slid along as a straight rod. The bolt now drives it harder (the morph is a purely sideways
   * displacement, so weights above 1 stay clean), strongest while it is gaining speed, and the
   * whole body sways against the tail.
   */
  beat: 0.8,
  beatPerSpeed: 0.55,
  dashStroke: 2.0,
  cruiseStroke: 1.1,
  /** Extra strength while accelerating (share of the stroke, at full shortfall of speed). */
  thrust: 0.35,
  /** The flinch's C-bend (stroke weight). */
  bend: 1.5,
  /** The body's sway against the tail (radians of heading per unit of stroke). */
  sway: 0.07,
  /** Body pitch and bank limits (radians). */
  pitch: 0.35,
  bank: 0.5,
} as const;

export type BoltMood = 'rest' | 'flinch' | 'flee' | 'settle';
export interface RestSpot {
  readonly x: number;
  readonly z: number;
  /** Heading about +y (0 faces +x). */
  readonly yaw: number;
}
/** What a bolting shark needs to know about its world. */
export interface BoltWorld {
  /** The sand height (m). */
  floor(x: number, z: number): number;
  /** The highest rock or sand within `radius` m (to swim over). */
  over(x: number, z: number, radius: number): number;
  /** Whether it is near a wall; if so, adds a push away from it to `push` (x, z). */
  avoid(p: Readonly<Vec3>, push: { x: number; z: number }): void;
  /** Where to settle: well away from the swimmer (if any). */
  settleAt(eye: Readonly<Vec3> | undefined): RestSpot;
}

export class SharkBolt {
  mood: BoltMood = 'rest';
  readonly position: Vec3;
  yaw: number;
  pitch = 0;
  bank = 0;
  /** Forward speed (m/s), the tail's stroke (-1..1), and seconds in this mood. */
  speed = 0;
  effort = 0;
  /**
   * V0.8 Pass 097: the body's sway against its tail (radians), added to the drawn heading only;
   * the heading it swims along (`yaw`) is unchanged.
   */
  sway = 0;
  moodTime = 0;
  /** Seconds until it can be startled again. */
  calm = 0;
  spot: RestSpot;
  private phase: number;
  private side = 1;
  private readonly start: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly push = { x: 0, z: 0 };

  constructor(
    spot: RestSpot,
    y: number,
    /** Height of its middle above the sand while resting (m). */
    private readonly lift: number,
    phase = 0,
    /**
     * Metres it keeps low after startling before it may rise (it sleeps under a ledge: it must
     * slip out before lifting).
     */
    private readonly holdLow = 0,
  ) {
    this.spot = spot;
    this.position = { x: spot.x, y, z: spot.z };
    this.yaw = spot.yaw;
    this.phase = phase;
  }
  /** Whether it is lying at rest (a getter, so it is read fresh after `update`). */
  get resting(): boolean {
    return this.mood === 'rest';
  }
  /** Startle it, if it is resting and calm and the swimmer is close. True if it bolts. */
  startle(eye: Readonly<Vec3>): boolean {
    const p = this.position;
    if (
      this.mood !== 'rest' ||
      this.calm > 0 ||
      Math.hypot(eye.x - p.x, eye.y - p.y, eye.z - p.z) >= BOLT.scare
    )
      return false;
    this.mood = 'flinch';
    this.moodTime = 0;
    this.speed = 0;
    this.start.x = p.x;
    this.start.y = p.y;
    this.start.z = p.z;
    // Bend towards the side it will turn to: away from the swimmer.
    const want = Math.atan2(-(p.z - eye.z), p.x - eye.x),
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
    this.side = turn >= 0 ? 1 : -1;
    return true;
  }
  /** Send it calmly to `spot` (e.g. home again once the swimmer has gone). */
  goTo(spot: RestSpot): void {
    if (this.mood !== 'rest') return;
    this.spot = spot;
    this.mood = 'settle';
    this.moodTime = 0;
    this.start.x = this.position.x;
    this.start.y = this.position.y;
    this.start.z = this.position.z;
  }
  update(
    dt: number,
    world: BoltWorld,
    reducedMotion: boolean,
    eye?: Readonly<Vec3>,
  ): void {
    if (!(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    this.moodTime += step;
    this.calm = Math.max(0, this.calm - step);
    if (this.mood === 'rest') return;
    const p = this.position;
    // Where it wants to go.
    let ax: number, az: number;
    if (this.mood === 'settle') {
      ax = this.spot.x - p.x;
      az = this.spot.z - p.z;
    } else if (eye) {
      ax = p.x - eye.x;
      az = p.z - eye.z;
    } else {
      ax = Math.cos(this.yaw);
      az = -Math.sin(this.yaw);
    }
    const l0 = Math.hypot(ax, az) || 1;
    this.push.x = ax / l0;
    this.push.z = az / l0;
    world.avoid(p, this.push);
    const want = Math.atan2(-this.push.z, this.push.x),
      turn = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)),
      rate =
        this.mood === 'flinch'
          ? reducedMotion
            ? BOLT.turn
            : BOLT.snap
          : this.mood === 'flee'
            ? BOLT.turn
            : BOLT.glide,
      turned = Math.max(-rate * step, Math.min(rate * step, turn));
    this.yaw += turned;
    // Its speed: almost none in the flinch, a burst to a dash, then an easy cruise.
    const left = Math.hypot(this.spot.x - p.x, this.spot.z - p.z),
      arriving = this.mood === 'settle' && left < 2.5;
    let target: number = BOLT.cruise,
      rateIn: number = BOLT.ease;
    if (this.mood === 'flinch') {
      target = reducedMotion ? BOLT.cruise : 0.3;
      rateIn = BOLT.burst;
    } else if (this.mood === 'flee') {
      target = reducedMotion ? BOLT.cruise : BOLT.dash;
      // Tiring towards the end of the dash.
      if (this.moodTime > BOLT.flee - 1)
        target =
          BOLT.cruise +
          (BOLT.dash - BOLT.cruise) * Math.max(0, BOLT.flee - this.moodTime);
      rateIn = BOLT.burst;
    }
    if (arriving) target *= Math.max(0.12, left / 2.5);
    this.speed += (target - this.speed) * (1 - Math.exp(-rateIn * step));
    // Forward along its heading only.
    p.x += Math.cos(this.yaw) * this.speed * step;
    p.z += -Math.sin(this.yaw) * this.speed * step;
    // Height: low until clear of where it lay (if it must slip out), up off the sand while
    // swimming, gliding down as it arrives.
    const floor = world.floor(p.x, p.z),
      moved = Math.hypot(p.x - this.start.x, p.z - this.start.z),
      low = moved < this.holdLow,
      cruiseHeight = Math.max(
        world.over(p.x, p.z, 0.9) + 0.4,
        floor + BOLT.swimLift,
      ),
      height = arriving
        ? floor + this.lift + (BOLT.swimLift - this.lift) * (left / 2.5)
        : low
          ? floor + this.lift + 0.08
          : this.mood === 'flinch'
            ? this.start.y + 0.15
            : cruiseHeight;
    const climb = (height - p.y) * (1 - Math.exp(-3 * step));
    p.y += climb;
    // Body attitude: nose up as it climbs, down as it glides in; banked into the turn.
    const pitchWant = Math.max(
        -BOLT.pitch,
        Math.min(
          BOLT.pitch,
          Math.atan2(climb / step, Math.max(0.4, this.speed)) * 0.8,
        ),
      ),
      bankWant = reducedMotion
        ? 0
        : Math.max(-BOLT.bank, Math.min(BOLT.bank, -(turned / step) * 0.18));
    this.pitch += (pitchWant - this.pitch) * (1 - Math.exp(-4 * step));
    this.bank += (bankWant - this.bank) * (1 - Math.exp(-5 * step));
    // The tail: a held C-bend in the flinch, then beats quickening with speed.
    if (this.mood === 'flinch') {
      const k = Math.min(1, this.moodTime / BOLT.flinch);
      this.effort = reducedMotion
        ? 0
        : this.side * Math.sin(Math.PI * k) * BOLT.bend;
      this.phase = 0;
    } else {
      // Beats quicken with speed, and are strongest while it is still short of the speed it wants.
      const hz = BOLT.beat + BOLT.beatPerSpeed * this.speed,
        shortfall = Math.max(0, target - this.speed) / Math.max(0.1, target),
        strength =
          (this.mood === 'flee' ? BOLT.dashStroke : BOLT.cruiseStroke) *
          (1 + BOLT.thrust * Math.min(1, shortfall)) *
          (reducedMotion ? 0.6 : 1) *
          (arriving ? Math.max(0.2, left / 2.5) : 1);
      this.phase += hz * Math.PI * 2 * step;
      this.effort = strength * Math.sin(this.phase);
    }
    // The head swings a little against the tail (none with reduced motion).
    this.sway = reducedMotion ? 0 : -BOLT.sway * this.effort;
    // Moods.
    if (this.mood === 'flinch' && this.moodTime >= BOLT.flinch) {
      this.mood = 'flee';
      this.moodTime = 0;
    } else if (this.mood === 'flee' && this.moodTime >= BOLT.flee) {
      this.mood = 'settle';
      this.moodTime = 0;
      this.spot = world.settleAt(eye);
    } else if (arriving && left < 0.3 && this.speed < 0.35) {
      // Settled: lie there, level, and rest.
      this.mood = 'rest';
      this.moodTime = 0;
      this.calm = BOLT.calm;
      p.y = floor + this.lift;
      this.speed = 0;
      this.pitch = 0;
      this.bank = 0;
      this.effort = 0;
      this.sway = 0;
    }
  }
}
