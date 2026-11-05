import type { Vec3 } from '../config/world';
import type { FishEntity } from './FishEntity';

export interface SchoolForces {
  readonly separation: Vec3;
  readonly alignment: Vec3;
  readonly cohesion: Vec3;
  wander: number;
  pressure: number;
  neighbors: number;
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Two-phase, fixed-population neighbor evaluation. Calculate every output before moving anyone.
 * Stable id order makes floating-point accumulation independent of the simulation update order.
 */
export class FishSchooling {
  private readonly order: readonly FishEntity[];
  private readonly forces = new Map<FishEntity, SchoolForces>();
  private readonly neighbors: Int32Array;
  private readonly distances: Float64Array;
  constructor(fish: readonly FishEntity[]) {
    this.order = [...fish].sort((a, b) => a.id - b.id);
    if (new Set(fish.map((f) => f.id)).size !== fish.length)
      throw new Error('Schooling requires unique fish ids.');
    this.neighbors = new Int32Array(fish.length);
    this.distances = new Float64Array(fish.length);
    for (const f of fish)
      this.forces.set(f, {
        separation: { x: 0, y: 0, z: 0 },
        alignment: { x: 0, y: 0, z: 0 },
        cohesion: { x: 0, y: 0, z: 0 },
        wander: 1,
        pressure: 0,
        neighbors: 0,
      });
  }
  forFish(fish: FishEntity): SchoolForces {
    const result = this.forces.get(fish);
    if (!result)
      throw new Error('Fish is not registered in this schooling population.');
    return result;
  }
  calculate(): void {
    for (const fish of this.order) {
      const out = this.forFish(fish),
        config = fish.species.schooling,
        p = fish.position;
      out.separation.x = out.separation.y = out.separation.z = 0;
      out.alignment.x = out.alignment.y = out.alignment.z = 0;
      out.cohesion.x = out.cohesion.y = out.cohesion.z = 0;
      out.wander = 1;
      out.pressure = 0;
      out.neighbors = 0;
      let count = 0;
      for (let j = 0; j < this.order.length; j++) {
        const other = this.order[j];
        if (other === fish) continue;
        let dx = other.position.x - p.x,
          dy = other.position.y - p.y,
          dz = other.position.z - p.z;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const comfort = fish.radius + other.radius + config.spacing;
        const separationRange = comfort + config.separationRange;
        if (
          config.separationWeight > 0 &&
          distanceSquared < separationRange * separationRange
        ) {
          let distance = Math.sqrt(distanceSquared);
          const actualDistance = distance;
          if (distance < 1e-8) {
            // Deterministic antisymmetric fallback for coincident bodies; never consumes RNG.
            const low = Math.min(fish.id, other.id),
              high = Math.max(fish.id, other.id);
            const angle =
              (((Math.imul(low + 1, 73856093) ^
                Math.imul(high + 1, 19349663)) >>>
                0) /
                4294967296) *
              Math.PI *
              2;
            const sign = fish.id < other.id ? 1 : -1;
            dx = Math.cos(angle) * sign;
            dy = 0;
            dz = Math.sin(angle) * sign;
            distance = 1;
          }
          const nx = -dx / distance,
            ny = -dy / distance,
            nz = -dz / distance;
          const closeness = clamp01(
            (separationRange - actualDistance) /
              (config.separationRange + config.spacing),
          );
          const weight = closeness * closeness * config.separationWeight;
          out.separation.x += (nx - nz * 0.3) * weight;
          out.separation.y += ny * weight;
          out.separation.z += (nz + nx * 0.3) * weight;
          const closing = Math.max(
            0,
            -(
              (fish.velocity.x - other.velocity.x) * nx +
              (fish.velocity.y - other.velocity.y) * ny +
              (fish.velocity.z - other.velocity.z) * nz
            ),
          );
          out.pressure = Math.max(
            out.pressure,
            closeness * clamp01(closing / Math.max(0.01, fish.species.speed)),
          );
        }
        if (
          !config.enabled ||
          other.species.id !== fish.species.id ||
          distanceSquared >= config.reconnectRadius ** 2
        )
          continue;
        // Bounded nearest-neighbor insertion. Ties retain stable id order; buffers are reused.
        let at = count;
        while (at > 0 && this.distances[at - 1] > distanceSquared) at--;
        if (at >= config.maxNeighbors) continue;
        const end = Math.min(count, config.maxNeighbors - 1);
        for (let k = end; k > at; k--) {
          this.neighbors[k] = this.neighbors[k - 1];
          this.distances[k] = this.distances[k - 1];
        }
        this.neighbors[at] = j;
        this.distances[at] = distanceSquared;
        count = Math.min(count + 1, config.maxNeighbors);
      }
      const separationLength = Math.hypot(
        out.separation.x,
        out.separation.y,
        out.separation.z,
      );
      if (separationLength > config.separationWeight) {
        const scale = config.separationWeight / separationLength;
        out.separation.x *= scale;
        out.separation.y *= scale;
        out.separation.z *= scale;
      }
      if (!count) continue;
      out.neighbors = count;
      let alignmentWeight = 0,
        presence = 0,
        cx = 0,
        cy = 0,
        cz = 0,
        cohesionWeight = 0,
        meanRadius = 0;
      for (let k = 0; k < count; k++) {
        const other = this.order[this.neighbors[k]],
          d2 = this.distances[k];
        const alignment = clamp01(1 - d2 / config.alignmentRadius ** 2);
        if (alignment > 0) {
          const w = alignment * alignment;
          alignmentWeight += w;
          presence = Math.max(presence, alignment);
          out.alignment.x += Math.cos(other.yaw) * Math.cos(other.pitch) * w;
          out.alignment.y += Math.sin(other.pitch) * w;
          out.alignment.z -= Math.sin(other.yaw) * Math.cos(other.pitch) * w;
        }
        const local = clamp01(1 - d2 / config.cohesionRadius ** 2);
        if (local > 0) {
          const w = local;
          cohesionWeight += w;
          meanRadius += other.radius * w;
          cx += (other.position.x - p.x) * w;
          cy += (other.position.y - p.y) * w;
          cz += (other.position.z - p.z) * w;
          presence = Math.max(presence, local);
        }
      }
      const personality = 0.9 + (0.2 * (fish.temperament - 0.8)) / 0.4;
      if (alignmentWeight > 0) {
        const scale =
          (config.alignmentWeight *
            personality *
            Math.min(1, alignmentWeight)) /
          alignmentWeight;
        out.alignment.x *= scale;
        out.alignment.y *= scale;
        out.alignment.z *= scale;
      }
      if (cohesionWeight > 0) {
        cx /= cohesionWeight;
        cy /= cohesionWeight;
        cz /= cohesionWeight;
        meanRadius /= cohesionWeight;
      } else {
        // A straggler can reconnect to a nearby same-species neighbor, with a smooth finite range.
        const other = this.order[this.neighbors[0]],
          distance = Math.sqrt(this.distances[0]);
        const reconnect = clamp01(
          (config.reconnectRadius - distance) /
            (config.reconnectRadius - config.cohesionRadius),
        );
        cx = (other.position.x - p.x) * reconnect;
        cy = (other.position.y - p.y) * reconnect;
        cz = (other.position.z - p.z) * reconnect;
        meanRadius = other.radius;
        presence = reconnect;
      }
      const distance = Math.hypot(cx, cy, cz),
        spacing = fish.radius + meanRadius + config.spacing;
      if (distance > spacing) {
        const scale =
          (config.cohesionWeight *
            personality *
            clamp01((distance - spacing) / (spacing * 2))) /
          distance;
        out.cohesion.x = cx * scale;
        out.cohesion.y = cy * scale * 0.65;
        out.cohesion.z = cz * scale;
      }
      out.wander = 1 - (1 - config.wanderWeight) * presence;
    }
  }
}
