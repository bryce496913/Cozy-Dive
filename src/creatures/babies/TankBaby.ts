import type { Vec3 } from '../../config/world';
import type { BabyDefinition } from '../../config/babies';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  BabyNavigation,
  type BabyNeighbour,
  type BabyHabitat,
} from './BabyNavigation';
const DT = 1 / 30;
const v = (): Vec3 => ({ x: 0, y: 0, z: 0 });
/** A small, fixed-step resident. Rendering, wall clocks, random sources and DOM stay outside. */
export class TankBaby {
  readonly position = v();
  readonly velocity = v();
  readonly navigation: BabyNavigation;
  readonly radius: number;
  yaw = 0;
  effort = 0;
  opacity = 0;
  returning = false;
  resting = false;
  time = 0;
  replans = 0;
  private accumulator = 0;
  private ticks = 0;
  private goalIndex = 0;
  private cursor = 0;
  private retry = 0;
  private restUntil = 0;
  private nextRest = 30;
  private settling = false;
  private lifting = false;
  private readonly goal = v();
  private readonly target = v();
  private readonly next = v();
  private readonly spawn = v();
  constructor(
    readonly definition: BabyDefinition,
    habitat: BabyHabitat,
    eye: Readonly<Vec3>,
    occupied?: readonly BabyNeighbour[],
  ) {
    this.radius = definition.radius;
    this.navigation = new BabyNavigation(definition, habitat);
    this.spawn.x = eye.x + 1.7;
    this.spawn.y = eye.y + 0.3;
    this.spawn.z = eye.z - 0.7;
    if (!this.navigation.nearest(this.spawn, this.position, eye, occupied))
      throw Error('No open water for a little visitor');
    this.setGoal();
    this.plan();
  }
  get halfHeight(): number {
    return this.settling || this.lifting ? 0.045 : this.definition.halfHeight;
  }
  get finished(): boolean {
    return this.returning && this.opacity <= 0;
  }
  private setGoal() {
    const a = (this.goalIndex * Math.PI) / 4,
      id = this.definition.id;
    if (id === 'blacktip-reef-shark') {
      this.goal.x = Math.cos(a) * 2.2;
      this.goal.z = -1 + Math.sin(a) * 7;
      this.goal.y = 4.85 + 0.35 * Math.sin(a * 2);
    } else if (id === 'spotted-eagle-ray') {
      this.goal.x = Math.cos(a) * 1.7;
      this.goal.z = -0.5 + Math.sin(a) * 7;
      this.goal.y = 0.35;
    } else {
      this.goal.x = Math.cos(a) * 8;
      this.goal.z = Math.sin(a) * 5;
      this.goal.y = this.goalIndex % 8 === 3 ? 10.1 : 4.85 + Math.sin(a) * 1.5;
    }
  }
  private plan() {
    this.replans++;
    this.cursor = 0;
    this.retry = 1;
    return this.navigation.route(this.position, this.goal);
  }
  replan() {
    this.navigation.invalidate();
    this.plan();
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player?: PlayerPresence,
    others?: readonly TankBaby[],
  ) {
    if (!active || !Number.isFinite(dt) || dt <= 0 || this.finished) return;
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-10 >= DT) {
      this.accumulator = Math.max(0, this.accumulator - DT);
      this.step(reducedMotion, player, others);
    }
  }
  private step(
    reduced: boolean,
    player?: PlayerPresence,
    others?: readonly TankBaby[],
  ) {
    this.time = ++this.ticks * DT;
    this.opacity = Math.max(
      0,
      Math.min(1, this.opacity + ((this.returning ? -1 : 1) * DT) / 1.2),
    );
    if (this.returning && !this.opacity) return;
    const d = this.definition,
      p = this.position;
    const playerDistance = player?.active
      ? Math.hypot(
          p.x - player.position.x,
          p.y - player.position.y,
          p.z - player.position.z,
        )
      : Infinity;
    // Settle flat only after the wings are neutral. Take off flat before strokes resume.
    if (d.id === 'spotted-eagle-ray') {
      if (
        !this.settling &&
        !this.lifting &&
        this.time >= this.nextRest &&
        p.y < 0.85 &&
        playerDistance > 3
      ) {
        this.settling = true;
        this.restUntil = this.time + 6;
        this.nextRest = this.time + 80;
      }
      if (
        this.settling &&
        (this.time >= this.restUntil || playerDistance < 2.4)
      ) {
        this.settling = false;
        this.lifting = true;
        this.resting = false;
      }
      if (this.settling || this.lifting) {
        this.effort = 0;
        this.velocity.x = this.velocity.y = this.velocity.z = 0;
        const floor = this.navigation.habitat.floor(p.x, p.z, d.radius),
          target = this.lifting
            ? Math.max(0.35, floor + d.halfHeight + 0.12)
            : floor + 0.045 + 0.020001;
        this.next.x = p.x;
        this.next.z = p.z;
        this.next.y =
          p.y + Math.max(-0.12 * DT, Math.min(0.12 * DT, target - p.y));
        if (this.navigation.clear(p, this.next, 0.045)) p.y = this.next.y;
        this.resting = this.settling && Math.abs(p.y - target) < 0.005;
        if (this.lifting && Math.abs(p.y - target) < 0.005) {
          this.lifting = false;
          this.plan();
        }
        return;
      }
    }
    const glide = d.id !== 'blacktip-reef-shark' && this.time % 9 > 5;
    this.effort = glide
      ? 0
      : Math.sin(this.time * Math.PI * 2 * d.strokeHz) * (reduced ? 0.3 : 0.75);
    this.retry -= DT;
    const nav = this.navigation;
    if (!nav.length) {
      if (this.retry <= 0) {
        this.goalIndex++;
        this.setGoal();
        this.plan();
      }
      this.velocity.x = this.velocity.y = this.velocity.z = 0;
      return;
    }
    // Pull the string across visible path nodes, preserving swept body clearance.
    while (this.cursor < nav.length - 1) {
      const i = (this.cursor + 1) * 3;
      this.target.x = nav.path[i];
      this.target.y = nav.path[i + 1];
      this.target.z = nav.path[i + 2];
      if (!nav.clear(p, this.target)) break;
      this.cursor++;
    }
    const index = this.cursor * 3;
    this.target.x = nav.path[index];
    this.target.y = nav.path[index + 1];
    this.target.z = nav.path[index + 2];
    let dx = this.target.x - p.x,
      dy = this.target.y - p.y,
      dz = this.target.z - p.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.12) {
      if (this.cursor === nav.length - 1) {
        this.goalIndex++;
        this.setGoal();
        this.plan();
      } else this.cursor++;
      return;
    }
    dx /= distance;
    dy /= distance;
    dz /= distance;
    // Ease up and to one stable side, beginning ahead of the swimmer's current velocity.
    if (player?.active) {
      const px = player.position.x + player.velocity.x * 0.7,
        py = player.position.y + player.velocity.y * 0.7,
        pz = player.position.z + player.velocity.z * 0.7;
      const ax = p.x - px,
        ay = p.y - py,
        az = p.z - pz,
        r = Math.hypot(ax, ay, az),
        comfort = 2.1 + d.radius;
      if (r < comfort) {
        const weight = (1 - r / comfort) * 3,
          side = d.id === 'spotted-eagle-ray' ? -1 : 1;
        dx += (ax / Math.max(0.1, r)) * weight - dz * weight * side * 0.5;
        dz += (az / Math.max(0.1, r)) * weight + dx * weight * side * 0.5;
        dy += Math.max(0.25, ay / Math.max(0.1, r)) * weight;
      }
    }
    if (others)
      for (const other of others) {
        if (other === this) continue;
        const ax = p.x - other.position.x,
          ay = p.y - other.position.y,
          az = p.z - other.position.z,
          r = Math.hypot(ax, ay, az),
          comfort = d.radius + other.radius + 0.65;
        if (r < comfort) {
          const w = (1 - r / comfort) * 2;
          dx += (ax / Math.max(0.05, r)) * w;
          dy += (ay / Math.max(0.05, r)) * w;
          dz += (az / Math.max(0.05, r)) * w;
        }
      }
    const size = Math.max(1e-9, Math.hypot(dx, dy, dz)),
      speed = Math.min(d.speed * (reduced ? 0.85 : 1), distance / DT),
      blend = 1 - Math.exp(-2 * DT);
    this.velocity.x += ((dx / size) * speed - this.velocity.x) * blend;
    this.velocity.y += ((dy / size) * speed - this.velocity.y) * blend;
    this.velocity.z += ((dz / size) * speed - this.velocity.z) * blend;
    this.next.x = p.x + this.velocity.x * DT;
    this.next.y = p.y + this.velocity.y * DT;
    this.next.z = p.z + this.velocity.z * DT;
    if (!nav.clear(p, this.next)) {
      // Face a clear path rather than pushing the reef or accumulating blocked velocity.
      this.velocity.x = this.velocity.y = this.velocity.z = 0;
      if (this.retry <= 0) this.plan();
      return;
    }
    // Once inside the comfort envelope, do not step closer to a stationary swimmer.
    if (
      player?.active &&
      playerDistance < 1.2 + d.radius &&
      Math.hypot(
        this.next.x - player.position.x,
        this.next.y - player.position.y,
        this.next.z - player.position.z,
      ) < playerDistance
    )
      return;
    p.x = this.next.x;
    p.y = this.next.y;
    p.z = this.next.z;
    const yaw = Math.atan2(-this.velocity.z, this.velocity.x),
      turn = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += turn * (1 - Math.exp(-2.5 * DT));
  }
}
