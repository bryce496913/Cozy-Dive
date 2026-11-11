import { COLLISION, type Bounds } from '../config/world';
import {
  CollisionWorld,
  type CollisionState,
  type ConvexCollider,
} from './collision';

/**
 * v0.4 Pass 024: collision for a large world. The outer reef has around a thousand convex hulls;
 * a uniform grid hands the solver only those near each move, and the seabed (a height function)
 * is the floor instead of a flat bound. No allocation per move.
 */
export class ColliderGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly stamp: Uint32Array;
  private frame = 0;
  constructor(
    readonly colliders: readonly ConvexCollider[],
    readonly cell = 8,
  ) {
    this.stamp = new Uint32Array(colliders.length);
    colliders.forEach((c, i) => {
      for (let x = this.index(c.min.x); x <= this.index(c.max.x); x++)
        for (let z = this.index(c.min.z); z <= this.index(c.max.z); z++) {
          const key = this.key(x, z);
          let list = this.cells.get(key);
          if (!list) this.cells.set(key, (list = []));
          list.push(i);
        }
    });
  }
  private index(v: number): number {
    return Math.floor(v / this.cell);
  }
  private key(x: number, z: number): number {
    return (x + 4096) * 8192 + (z + 4096);
  }
  /** Colliders whose cells touch the square of half-width `radius` around (x, z), into `out`. */
  query(x: number, z: number, radius: number, out: ConvexCollider[]): void {
    out.length = 0;
    this.frame = (this.frame + 1) >>> 0 || 1;
    for (let cx = this.index(x - radius); cx <= this.index(x + radius); cx++)
      for (
        let cz = this.index(z - radius);
        cz <= this.index(z + radius);
        cz++
      ) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const i of list)
          if (this.stamp[i] !== this.frame) {
            this.stamp[i] = this.frame;
            out.push(this.colliders[i]);
          }
      }
  }
}

export class TerrainCollisionWorld extends CollisionWorld {
  private readonly nearby: ConvexCollider[];
  constructor(
    private readonly grid: ColliderGrid,
    bounds: Bounds,
    private readonly floor: (x: number, z: number) => number,
  ) {
    const nearby: ConvexCollider[] = [];
    super(nearby, bounds);
    this.nearby = nearby;
  }
  override move(
    state: CollisionState,
    fromX: number,
    fromY: number,
    fromZ: number,
  ): void {
    const p = state.position,
      reach =
        Math.hypot(p.x - fromX, p.z - fromZ) / 2 + COLLISION.playerRadius + 1;
    this.grid.query((p.x + fromX) / 2, (p.z + fromZ) / 2, reach, this.nearby);
    super.move(state, fromX, fromY, fromZ);
    const ground = this.floor(p.x, p.z) + this.bounds.clearance;
    if (p.y < ground) {
      p.y = ground;
      if (state.velocity.y < 0) state.velocity.y = 0;
    }
  }
}
