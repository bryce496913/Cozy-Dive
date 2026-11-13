import { AQUARIUM, type Vec3 } from '../../config/world';
import type { BabyDefinition } from '../../config/babies';
import type { ConvexCollider } from '../../player/collision';
import { ColliderGrid } from '../../player/terrainCollision';

export interface BabyNeighbour {
  readonly position: Readonly<Vec3>;
  readonly radius: number;
}
export interface BabyHabitat {
  readonly solids: readonly ConvexCollider[];
  /** Maximum rendered sand height over the square footprint, including its boundary. */
  readonly floor: (x: number, z: number, radius: number) => number;
}
const STEP = 0.75,
  NX = 45,
  NY = 18,
  NZ = 33;
const COUNT = NX * NY * NZ;
const X0 = -16.5,
  Y0 = 0.35,
  Z0 = -12;
const point = (): Vec3 => ({ x: 0, y: 0, z: 0 });
/** Lazy free-cell cache and swept 26-neighbour A*. All search/path buffers are reused. */
export class BabyNavigation {
  readonly path = new Float64Array(COUNT * 3);
  length = 0;
  private grid: ColliderGrid;
  private readonly nearby: ConvexCollider[] = [];
  private readonly free = new Uint8Array(COUNT);
  private readonly visited = new Uint32Array(COUNT);
  private readonly closed = new Uint32Array(COUNT);
  private readonly parent = new Int32Array(COUNT);
  private readonly cost = new Float64Array(COUNT);
  private readonly heap = new Int32Array(COUNT);
  private readonly heapIndex = new Int32Array(COUNT);
  private readonly priority = new Float64Array(COUNT);
  private heapLength = 0;
  private epoch = 0;
  private readonly a = point();
  private readonly b = point();
  constructor(
    readonly body: BabyDefinition,
    readonly habitat: BabyHabitat,
  ) {
    this.grid = new ColliderGrid(habitat.solids, 2);
  }
  invalidate() {
    this.grid = new ColliderGrid(this.habitat.solids, 2);
    this.free.fill(0);
    this.length = 0;
  }
  safe(
    x: number,
    y: number,
    z: number,
    height = this.body.halfHeight,
  ): boolean {
    const h = this.body.radius,
      q = AQUARIUM,
      margin = q.clearance;
    if (
      !Number.isFinite(x + y + z) ||
      x < q.min.x + margin + h ||
      x > q.max.x - margin - h ||
      z < q.min.z + margin + h ||
      z > q.max.z - margin - h ||
      y > q.max.y - margin - height ||
      y < this.habitat.floor(x, z, h) + height + 0.02
    )
      return false;
    this.grid.query(x, z, h + 0.1, this.nearby);
    for (const c of this.nearby) {
      if (
        x + h < c.min.x ||
        x - h > c.max.x ||
        y + height < c.min.y ||
        y - height > c.max.y ||
        z + h < c.min.z ||
        z - h > c.max.z
      )
        continue;
      let inside = true;
      for (const p of c.planes) {
        const pad =
          h * (Math.abs(p.x) + Math.abs(p.z)) + height * Math.abs(p.y) + 0.025;
        if (p.x * x + p.y * y + p.z * z > p.offset + pad) {
          inside = false;
          break;
        }
      }
      if (inside) return false;
    }
    return true;
  }
  clear(
    from: Readonly<Vec3>,
    to: Readonly<Vec3>,
    height = this.body.halfHeight,
  ): boolean {
    if (!this.safe(to.x, to.y, to.z, height)) return false;
    const h = this.body.radius,
      dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z;
    // A maximum over the whole swept floor rectangle is conservative, including sand ripples.
    if (
      Math.min(from.y, to.y) <
      this.habitat.floor(
        (from.x + to.x) / 2,
        (from.z + to.z) / 2,
        h + Math.max(Math.abs(dx), Math.abs(dz)) / 2,
      ) +
        height +
        0.02 -
        1e-9
    )
      return false;
    this.grid.query(
      (from.x + to.x) / 2,
      (from.z + to.z) / 2,
      h + Math.hypot(dx, dz) / 2 + 0.1,
      this.nearby,
    );
    for (const c of this.nearby) {
      if (
        Math.max(from.x, to.x) + h < c.min.x ||
        Math.min(from.x, to.x) - h > c.max.x ||
        Math.max(from.y, to.y) + height < c.min.y ||
        Math.min(from.y, to.y) - height > c.max.y ||
        Math.max(from.z, to.z) + h < c.min.z ||
        Math.min(from.z, to.z) - h > c.max.z
      )
        continue;
      let lo = 0,
        hi = 1,
        miss = false;
      for (const p of c.planes) {
        const pad =
          h * (Math.abs(p.x) + Math.abs(p.z)) + height * Math.abs(p.y) + 0.025;
        const gap = p.offset + pad - p.x * from.x - p.y * from.y - p.z * from.z,
          speed = p.x * dx + p.y * dy + p.z * dz;
        if (Math.abs(speed) < 1e-10) {
          if (gap < 0) {
            miss = true;
            break;
          }
        } else if (speed > 0) hi = Math.min(hi, gap / speed);
        else lo = Math.max(lo, gap / speed);
        if (lo > hi) {
          miss = true;
          break;
        }
      }
      if (!miss) return false;
    }
    return true;
  }
  private at(id: number, out: Vec3) {
    out.x = X0 + (id % NX) * STEP;
    out.y = Y0 + (Math.floor(id / NX) % NY) * STEP;
    out.z = Z0 + Math.floor(id / (NX * NY)) * STEP;
  }
  private isFree(id: number): boolean {
    if (!this.free[id]) {
      this.at(id, this.a);
      this.free[id] = this.safe(this.a.x, this.a.y, this.a.z) ? 1 : 2;
    }
    return this.free[id] === 1;
  }
  /** Nearest valid point, never clamping an animal through an obstacle. Event-time only. */
  nearest(
    target: Readonly<Vec3>,
    out: Vec3,
    avoid?: Readonly<Vec3>,
    occupied?: readonly BabyNeighbour[],
  ): boolean {
    let best = -1,
      distance = Infinity;
    for (let id = 0; id < COUNT; id++) {
      this.at(id, this.b);
      const d =
        (this.b.x - target.x) ** 2 +
        (this.b.y - target.y) ** 2 +
        (this.b.z - target.z) ** 2;
      if (
        d >= distance ||
        (avoid &&
          Math.hypot(
            this.b.x - avoid.x,
            this.b.y - avoid.y,
            this.b.z - avoid.z,
          ) <
            1.3 + this.body.radius) ||
        !this.isFree(id)
      )
        continue;
      let busy = false;
      if (occupied)
        for (const other of occupied)
          if (
            Math.hypot(
              this.b.x - other.position.x,
              this.b.y - other.position.y,
              this.b.z - other.position.z,
            ) <
            this.body.radius + other.radius + 0.25
          ) {
            busy = true;
            break;
          }
      if (busy) continue;
      distance = d;
      best = id;
    }
    if (best < 0) return false;
    this.at(best, out);
    return true;
  }
  private nearestId(p: Readonly<Vec3>, requireConnection: boolean): number {
    let best = -1,
      distance = Infinity;
    for (let id = 0; id < COUNT; id++) {
      this.at(id, this.b);
      const d =
        (this.b.x - p.x) ** 2 + (this.b.y - p.y) ** 2 + (this.b.z - p.z) ** 2;
      if (
        d >= distance ||
        !this.isFree(id) ||
        (requireConnection && !this.clear(p, this.b))
      )
        continue;
      best = id;
      distance = d;
    }
    return best;
  }
  private swap(i: number, j: number) {
    const a = this.heap[i],
      b = this.heap[j];
    this.heap[i] = b;
    this.heap[j] = a;
    this.heapIndex[a] = j;
    this.heapIndex[b] = i;
  }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.priority[this.heap[p]] <= this.priority[this.heap[i]]) break;
      this.swap(p, i);
      i = p;
    }
  }
  private push(id: number) {
    const i = this.heapLength++;
    this.heap[i] = id;
    this.heapIndex[id] = i;
    this.up(i);
  }
  private pop(): number {
    const result = this.heap[0],
      last = this.heap[--this.heapLength];
    if (this.heapLength) {
      this.heap[0] = last;
      this.heapIndex[last] = 0;
      let i = 0;
      while (true) {
        let j = i * 2 + 1;
        if (j >= this.heapLength) break;
        if (
          j + 1 < this.heapLength &&
          this.priority[this.heap[j + 1]] < this.priority[this.heap[j]]
        )
          j++;
        if (this.priority[this.heap[i]] <= this.priority[this.heap[j]]) break;
        this.swap(i, j);
        i = j;
      }
    }
    return result;
  }
  /** Write a connected path into the retained path buffer. No allocations on re-planning. */
  route(from: Readonly<Vec3>, target: Readonly<Vec3>): boolean {
    this.length = 0;
    const start = this.nearestId(from, true),
      goal = this.nearestId(target, false);
    if (start < 0 || goal < 0) return false;
    this.epoch = (this.epoch + 1) >>> 0 || 1;
    if (this.epoch === 1) {
      this.visited.fill(0);
      this.closed.fill(0);
    }
    const epoch = this.epoch;
    this.heapLength = 0;
    this.visited[start] = epoch;
    this.cost[start] = 0;
    this.parent[start] = -1;
    this.priority[start] = 0;
    this.push(start);
    const gx = goal % NX,
      gy = Math.floor(goal / NX) % NY,
      gz = Math.floor(goal / (NX * NY));
    while (this.heapLength) {
      const id = this.pop();
      this.closed[id] = epoch;
      if (id === goal) {
        let n = 0,
          k = id;
        while (k >= 0 && n < COUNT) {
          this.path[n++] = k;
          k = this.parent[k];
        }
        // Reverse node ids before expanding them (expansion otherwise overwrites unread ids).
        for (let i = 0; i < n / 2; i++) {
          const v = this.path[i];
          this.path[i] = this.path[n - 1 - i];
          this.path[n - 1 - i] = v;
        }
        for (let i = n - 1; i >= 0; i--) {
          this.at(this.path[i], this.a);
          this.path[i * 3] = this.a.x;
          this.path[i * 3 + 1] = this.a.y;
          this.path[i * 3 + 2] = this.a.z;
        }
        this.length = n;
        return true;
      }
      const x = id % NX,
        y = Math.floor(id / NX) % NY,
        z = Math.floor(id / (NX * NY));
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (
              !(dx || dy || dz) ||
              x + dx < 0 ||
              x + dx >= NX ||
              y + dy < 0 ||
              y + dy >= NY ||
              z + dz < 0 ||
              z + dz >= NZ
            )
              continue;
            const next = id + dx + dy * NX + dz * NX * NY;
            if (this.closed[next] === epoch || !this.isFree(next)) continue;
            const cost = this.cost[id] + Math.hypot(dx, dy, dz);
            if (this.visited[next] === epoch && cost >= this.cost[next])
              continue;
            this.at(id, this.a);
            this.at(next, this.b);
            if (!this.clear(this.a, this.b)) continue;
            const fresh = this.visited[next] !== epoch;
            this.visited[next] = epoch;
            this.cost[next] = cost;
            this.parent[next] = id;
            this.priority[next] =
              cost + Math.hypot(gx - x - dx, gy - y - dy, gz - z - dz);
            if (fresh) this.push(next);
            else this.up(this.heapIndex[next]);
          }
    }
    return false;
  }
}
