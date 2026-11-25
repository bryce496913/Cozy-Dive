import { smallAnimalMode, smallAnimalShelter } from './SmallAnimalHabitat';
import type { Vec3 } from '../../config/world';
import { miniatureGrowth, type BabyDefinition } from '../../config/babies';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  BabyNavigation,
  type BabyNeighbour,
  type BabyHabitat,
} from './BabyNavigation';
const DT = 1 / 30;
/**
 * Pass 031: nodes of route search per fixed step. A whole search could take several
 * milliseconds on the main thread (a visible hitch every few seconds), so it is spread over
 * steps. Counted in nodes, not time, so behaviour is identical at any frame rate.
 */
export const PLAN_BUDGET = 60;
/** While a route is being found, the current velocity eases off at this rate (1/s). */
const COAST = 1.5;
const v = (): Vec3 => ({ x: 0, y: 0, z: 0 });
/** A small, fixed-step resident. Rendering, wall clocks, random sources and DOM stay outside. */
/**
 * The eagle ray's rest: it settles below this height (m), lying this flat (half-height, m),
 * sinking and rising at this rate (m/s). All grow with the miniature.
 */
const REST = { below: 0.85, half: 0.045, rate: 0.12 } as const;
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
  /**
   * V0.8 Pass 096: the miniature's growth (2 for the large animals), and its flat resting
   * half-height (the eagle ray lies on the sand): both grow with its size.
   */
  private readonly growth: number;
  private readonly restHalf: number;
  private liftExtra = 0;
  private lifting = false;
  private readonly goal = v();
  private readonly target = v();
  private readonly next = v();
  private readonly spawn = v();
  private readonly restsLocally: boolean;
  private readonly smallMode: ReturnType<typeof smallAnimalMode>;
  constructor(
    readonly definition: BabyDefinition,
    habitat: BabyHabitat,
    eye: Readonly<Vec3>,
    occupied?: readonly BabyNeighbour[],
  ) {
    this.restsLocally = /octopus|wonderpus/.test(definition.id);
    this.smallMode = smallAnimalMode(definition);
    this.radius = definition.radius;
    this.growth = miniatureGrowth(definition.id);
    this.restHalf = REST.half * this.growth;
    this.navigation = new BabyNavigation(definition, habitat);
    this.spawn.x = eye.x + 1.7;
    this.spawn.y = eye.y + 0.3;
    this.spawn.z = eye.z - 0.7;
    if (definition.motion === 'crawl' || definition.motion === 'still')
      this.spawn.y =
        habitat.floor(this.spawn.x, this.spawn.z, definition.radius) +
        definition.halfHeight +
        0.2;
    if (this.smallMode && this.smallMode !== 'pelagic') {
      let nearest = Infinity;
      for (const interest of habitat.interests ?? []) {
        const suitable =
          this.smallMode === 'hover'
            ? interest.kind === 'plant' || interest.kind === 'seagrass-meadow'
            : smallAnimalShelter(definition)
              ? /shelter|crevice|overhang|rock|hardscape/.test(interest.kind)
              : /plant|coral|grass|substrate|floor/.test(interest.kind);
        if (!suitable) continue;
        const p = interest.position,
          distance = Math.hypot(p.x - eye.x, p.z - eye.z);
        if (distance >= nearest) continue;
        nearest = distance;
        this.spawn.x = p.x + 0.45;
        this.spawn.z = p.z + 0.45;
        this.spawn.y =
          this.smallMode === 'bottom'
            ? habitat.floor(this.spawn.x, this.spawn.z, definition.radius) +
              definition.halfHeight +
              0.025
            : Math.max(
                p.y + 0.2,
                habitat.floor(this.spawn.x, this.spawn.z, definition.radius) +
                  definition.halfHeight +
                  0.4,
              );
      }
    }
    if (
      !this.navigation.nearest(
        this.spawn,
        this.position,
        eye,
        occupied,
        definition.motion === 'still' || this.smallMode === 'bottom',
      )
    )
      throw Error('No open water for a little visitor');
    if (this.smallMode) {
      this.spawn.x = this.position.x;
      this.spawn.y = this.position.y;
      this.spawn.z = this.position.z;
      return;
    }
    this.setGoal();
    if (definition.motion !== 'still') this.plan();
  }
  get halfHeight(): number {
    return this.settling || this.lifting
      ? this.restHalf
      : this.definition.halfHeight;
  }
  get finished(): boolean {
    return this.returning && this.opacity <= 0;
  }
  private setGoal() {
    const a = (this.goalIndex * Math.PI) / 4,
      id = this.definition.id;
    if (
      this.definition.motion === 'crawl' ||
      this.definition.motion === 'still'
    ) {
      this.goal.x = this.spawn.x + Math.cos(a) * 1.8;
      this.goal.z = this.spawn.z + Math.sin(a) * 1.8;
      this.goal.y =
        this.navigation.habitat.floor(this.goal.x, this.goal.z, this.radius) +
        this.definition.halfHeight +
        0.2;
    } else if (id === 'blacktip-reef-shark') {
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
    this.navigation.begin(this.position, this.goal);
  }
  /** Ease off along the current heading while a route is found, never into anything. */
  private coast() {
    const p = this.position,
      keep = Math.exp(-COAST * DT);
    this.velocity.x *= keep;
    this.velocity.y *= keep;
    this.velocity.z *= keep;
    this.next.x = p.x + this.velocity.x * DT;
    this.next.y = p.y + this.velocity.y * DT;
    this.next.z = p.z + this.velocity.z * DT;
    if (this.navigation.clear(p, this.next)) {
      p.x = this.next.x;
      p.y = this.next.y;
      p.z = this.next.z;
    } else this.velocity.x = this.velocity.y = this.velocity.z = 0;
  }
  replan() {
    this.navigation.invalidate();
    if (!this.smallMode) this.plan();
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
  /** Confined substrate exploration / vegetation hovering; never a 3D grid shortcut over rocks. */
  private stepSmall(
    reduced: boolean,
    player?: PlayerPresence,
    others?: readonly TankBaby[],
  ): void {
    const d = this.definition,
      p = this.position,
      nav = this.navigation;
    this.effort = reduced ? 0 : 0.3 * Math.sin(this.time * 0.8);
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
    if (
      d.motion === 'still' ||
      d.id === 'skeleton-shrimp' ||
      (this.restsLocally && this.time % 50 < 25)
    )
      return;
    const phase = this.time * 0.1 + (this.goalIndex * Math.PI) / 4,
      radius = this.smallMode === 'bottom' ? 0.2 : 0.45;
    this.target.x = this.spawn.x + radius * Math.sin(phase);
    this.target.z = this.spawn.z + radius * (Math.cos(phase) - 1);
    this.target.y =
      this.smallMode === 'bottom'
        ? nav.habitat.floor(this.target.x, this.target.z, d.radius) +
          d.halfHeight +
          0.025
        : this.spawn.y + 0.1 * Math.sin(phase * 0.7);
    const dx = this.target.x - p.x,
      dy = this.target.y - p.y,
      dz = this.target.z - p.z,
      distance = Math.hypot(dx, dy, dz),
      step = Math.min(distance, d.speed * DT * (reduced ? 0.85 : 1));
    if (distance < 1e-8) return;
    this.next.x = p.x + (dx / distance) * step;
    this.next.z = p.z + (dz / distance) * step;
    this.next.y =
      this.smallMode === 'bottom'
        ? nav.habitat.floor(this.next.x, this.next.z, d.radius) +
          d.halfHeight +
          0.025
        : p.y + (dy / distance) * step;
    if (!nav.clear(p, this.next)) return;
    if (
      player?.active &&
      Math.hypot(
        this.next.x - player.position.x,
        this.next.y - player.position.y,
        this.next.z - player.position.z,
      ) <
        1.2 + d.radius
    )
      return;
    if (others)
      for (const other of others)
        if (
          other !== this &&
          Math.hypot(
            this.next.x - other.position.x,
            this.next.y - other.position.y,
            this.next.z - other.position.z,
          ) <
            d.radius + other.radius + 0.1
        )
          return;
    this.velocity.x = (this.next.x - p.x) / DT;
    this.velocity.y = (this.next.y - p.y) / DT;
    this.velocity.z = (this.next.z - p.z) / DT;
    p.x = this.next.x;
    p.y = this.next.y;
    p.z = this.next.z;
    const yaw = Math.atan2(-this.velocity.z, this.velocity.x),
      turn = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += turn * (1 - Math.exp(-2.5 * DT));
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
    if (this.smallMode) {
      this.stepSmall(reduced, player, others);
      return;
    }
    if (d.motion === 'still') {
      this.effort = reduced ? 0 : 0.1 * Math.sin(this.time * 0.8);
      return;
    }
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
        p.y < REST.below * this.growth &&
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
            ? Math.max(0.35, floor + d.halfHeight + 0.12) + this.liftExtra
            : floor + this.restHalf + 0.020001;
        this.next.x = p.x;
        this.next.z = p.z;
        this.next.y =
          p.y +
          Math.max(
            -REST.rate * this.growth * DT,
            Math.min(REST.rate * this.growth * DT, target - p.y),
          );
        if (this.navigation.clear(p, this.next, this.restHalf))
          p.y = this.next.y;
        this.resting = this.settling && Math.abs(p.y - target) < 0.005;
        if (this.lifting && Math.abs(p.y - target) < 0.005) {
          // V0.8 Pass 096: resume stroking only where the whole stroking body is clear (the lift
          // is checked at its flat resting height); otherwise keep rising a little.
          if (this.navigation.safe(p.x, p.y, p.z, d.halfHeight)) {
            this.lifting = false;
            this.liftExtra = 0;
            this.plan();
          } else this.liftExtra += 0.05;
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
    if (nav.planning && nav.advance(PLAN_BUDGET) === 'pending') {
      this.coast();
      return;
    }
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
          side = d.id === 'spotted-eagle-ray' ? -1 : 1,
          // Pass 031: turn the original heading to the side (the second line used the
          // already-updated x, skewing the turn).
          hx = dx,
          hz = dz;
        dx += (ax / Math.max(0.1, r)) * weight - hz * weight * side * 0.5;
        dz += (az / Math.max(0.1, r)) * weight + hx * weight * side * 0.5;
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
