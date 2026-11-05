import { COLLISION, type Bounds, type Vec3 } from '../config/world';

/** Outward unit normal; solid occupies n·position <= offset. */
export interface CollisionPlane extends Vec3 {
  offset: number;
}
export interface ConvexCollider {
  readonly planes: readonly CollisionPlane[];
  readonly min: Vec3;
  readonly max: Vec3;
}
export interface CollisionState {
  position: Vec3;
  velocity: Vec3;
}
const AXES = ['x', 'y', 'z'] as const;

/** Static convex hulls expanded by a spherical player, with swept sliding contacts. */
export class CollisionWorld {
  private readonly normals = new Float64Array(COLLISION.maxContacts * 3);
  private nx = 0;
  private ny = 0;
  private nz = 0;
  private enter = 0;
  private exit = 0;
  constructor(
    readonly colliders: readonly ConvexCollider[],
    readonly bounds: Bounds,
    readonly radius = COLLISION.playerRadius,
  ) {}

  contains(collider: ConvexCollider, x: number, y: number, z: number): boolean {
    const pad = this.radius * 2;
    if (
      x < collider.min.x - pad ||
      x > collider.max.x + pad ||
      y < collider.min.y - pad ||
      y > collider.max.y + pad ||
      z < collider.min.z - pad ||
      z > collider.max.z + pad
    )
      return false;
    for (const p of collider.planes)
      if (
        p.x * x + p.y * y + p.z * z >=
        p.offset + this.radius - COLLISION.epsilon
      )
        return false;
    return true;
  }

  /** Ray/expanded-convex interval, also used for local overlap recovery. */
  private interval(
    collider: ConvexCollider,
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
  ): boolean {
    let enter = -Infinity,
      exit = Infinity;
    let nx = 0,
      ny = 0,
      nz = 0;
    for (const p of collider.planes) {
      const distance = p.offset + this.radius - (p.x * x + p.y * y + p.z * z);
      const speed = p.x * dx + p.y * dy + p.z * dz;
      if (Math.abs(speed) < 1e-12) {
        if (distance < 0) return false;
      } else if (speed < 0) {
        const t = distance / speed;
        if (t > enter) {
          enter = t;
          nx = p.x;
          ny = p.y;
          nz = p.z;
        }
      } else exit = Math.min(exit, distance / speed);
      if (enter > exit) return false;
    }
    this.enter = enter;
    this.exit = exit;
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    return true;
  }

  /** Starting overlaps only: find the shortest local ray exit from the connected union.
   * Candidates are actual hull normals plus world axes, never an unrelated spawn point.
   */
  private recover(state: CollisionState): void {
    const { x, y, z } = state.position;
    let inside = false;
    for (const c of this.colliders)
      if (this.contains(c, x, y, z)) {
        inside = true;
        break;
      }
    if (!inside) return;
    let best = Infinity,
      bx = 0,
      by = 0,
      bz = 0;
    const tryDirection = (nx: number, ny: number, nz: number): void => {
      let distance = 0;
      // Grow the exit across intersecting hulls; each pass absorbs at least one interval.
      for (let pass = 0; pass <= this.colliders.length; pass++) {
        let next = distance;
        for (const c of this.colliders) {
          if (
            this.interval(c, x, y, z, nx, ny, nz) &&
            this.enter <= distance + COLLISION.skin &&
            this.exit >= 0
          )
            next = Math.max(next, this.exit + COLLISION.skin);
        }
        if (next === distance) break;
        distance = next;
      }
      if (!Number.isFinite(distance) || distance >= best) return;
      const px = x + nx * distance,
        py = y + ny * distance,
        pz = z + nz * distance;
      if (
        px < this.bounds.min.x + this.bounds.clearance ||
        px > this.bounds.max.x - this.bounds.clearance ||
        py < this.bounds.min.y + this.bounds.clearance ||
        py > this.bounds.max.y - this.bounds.clearance ||
        pz < this.bounds.min.z + this.bounds.clearance ||
        pz > this.bounds.max.z - this.bounds.clearance
      )
        return;
      for (const c of this.colliders) if (this.contains(c, px, py, pz)) return;
      best = distance;
      bx = nx;
      by = ny;
      bz = nz;
    };
    for (const c of this.colliders)
      if (this.contains(c, x, y, z))
        for (const p of c.planes) tryDirection(p.x, p.y, p.z);
    tryDirection(1, 0, 0);
    tryDirection(-1, 0, 0);
    tryDirection(0, 1, 0);
    tryDirection(0, -1, 0);
    tryDirection(0, 0, 1);
    tryDirection(0, 0, -1);
    if (best < Infinity) {
      state.position.x += bx * best;
      state.position.y += by * best;
      state.position.z += bz * best;
      const inward =
        state.velocity.x * bx + state.velocity.y * by + state.velocity.z * bz;
      if (inward < 0) {
        state.velocity.x -= bx * inward;
        state.velocity.y -= by * inward;
        state.velocity.z -= bz * inward;
      }
    }
  }

  /** Resolve the integrated displacement, preserving tangential velocity and all swim clocks. */
  move(
    state: CollisionState,
    fromX: number,
    fromY: number,
    fromZ: number,
  ): void {
    let dx = state.position.x - fromX,
      dy = state.position.y - fromY,
      dz = state.position.z - fromZ;
    state.position.x = fromX;
    state.position.y = fromY;
    state.position.z = fromZ;
    // Bounds and scenery participate in the same sweep so sliding cannot push through glass.
    for (const axis of AXES)
      state.position[axis] = Math.max(
        this.bounds.min[axis] + this.bounds.clearance,
        Math.min(
          this.bounds.max[axis] - this.bounds.clearance,
          state.position[axis],
        ),
      );
    this.recover(state);
    let count = 0;
    for (let contact = 0; contact < COLLISION.maxContacts; contact++) {
      const { x, y, z } = state.position;
      let time = 1,
        nx = 0,
        ny = 0,
        nz = 0;
      let hitRock = false;
      for (const axis of AXES) {
        const delta = axis === 'x' ? dx : axis === 'y' ? dy : dz;
        if (!delta) continue;
        const limit =
          delta > 0
            ? this.bounds.max[axis] - this.bounds.clearance
            : this.bounds.min[axis] + this.bounds.clearance;
        const t = (limit - state.position[axis]) / delta;
        if (t >= 0 && t < time) {
          time = t;
          nx = ny = nz = 0;
          const normal = delta > 0 ? -1 : 1;
          if (axis === 'x') nx = normal;
          else if (axis === 'y') ny = normal;
          else nz = normal;
        }
      }
      for (const c of this.colliders) {
        const pad = this.radius * 2 + COLLISION.skin;
        if (
          Math.max(x, x + dx) < c.min.x - pad ||
          Math.min(x, x + dx) > c.max.x + pad ||
          Math.max(y, y + dy) < c.min.y - pad ||
          Math.min(y, y + dy) > c.max.y + pad ||
          Math.max(z, z + dz) < c.min.z - pad ||
          Math.min(z, z + dz) > c.max.z + pad
        )
          continue;
        if (
          this.interval(c, x, y, z, dx, dy, dz) &&
          this.enter >= -COLLISION.epsilon &&
          this.enter < time &&
          this.exit > 0
        ) {
          time = Math.max(0, this.enter);
          nx = this.nx;
          ny = this.ny;
          nz = this.nz;
          hitRock = true;
        }
      }
      state.position.x += dx * time;
      state.position.y += dy * time;
      state.position.z += dz * time;
      if (nx === 0 && ny === 0 && nz === 0) break;
      // An outward skin avoids numerical re-entry; glass itself keeps its exact old clearance.
      if (time > 0 && hitRock) {
        // Sweep already stops on the expanded surface; no permanent position offsets accumulate.
        const back = Math.min(
          time,
          COLLISION.skin / Math.max(1e-12, Math.hypot(dx, dy, dz)),
        );
        state.position.x -= dx * back;
        state.position.y -= dy * back;
        state.position.z -= dz * back;
      }
      dx *= 1 - time;
      dy *= 1 - time;
      dz *= 1 - time;
      this.normals[count * 3] = nx;
      this.normals[count * 3 + 1] = ny;
      this.normals[count * 3 + 2] = nz;
      count++;
      // Reproject against previous contacts so corners/overlaps cannot restore inward motion.
      for (let pass = 0; pass < COLLISION.maxContacts; pass++)
        for (let i = 0; i < count; i++) {
          const ax = this.normals[i * 3],
            ay = this.normals[i * 3 + 1],
            az = this.normals[i * 3 + 2];
          const d = dx * ax + dy * ay + dz * az;
          if (d < 0) {
            dx -= ax * d;
            dy -= ay * d;
            dz -= az * d;
          }
          const v =
            state.velocity.x * ax +
            state.velocity.y * ay +
            state.velocity.z * az;
          if (v < 0) {
            state.velocity.x -= ax * v;
            state.velocity.y -= ay * v;
            state.velocity.z -= az * v;
          }
        }
    }
  }
}
