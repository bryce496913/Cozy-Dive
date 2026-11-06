import type {
  PlantSpeciesId,
  HabitatRegionId,
} from '../environment/PlantSpecies';
import type { Bounds, Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';

export interface HabitatInterest {
  readonly kind:
    | 'plant'
    | 'rock-edge'
    | 'open-water'
    | 'hardscape-edge'
    | 'substrate'
    | 'grass-edge';
  readonly position: Readonly<Vec3>;
  readonly normal: Readonly<Vec3>;
  readonly vegetation?: {
    readonly species: PlantSpeciesId;
    readonly region: HabitatRegionId;
    readonly height: number;
    readonly broadLeaves: boolean;
  };
}

/** Shared read-only environment data; never invokes the player's collision solver. */
export interface FishHabitat {
  readonly bounds: Bounds;
  readonly rocks: readonly ConvexCollider[];
  readonly interests?: readonly HabitatInterest[];
  readonly substrateHeight?: (x: number, z: number) => number;
}
export function insideRock(
  p: Vec3,
  radius: number,
  rock: ConvexCollider,
): boolean {
  if (
    p.x < rock.min.x - radius * 2 ||
    p.x > rock.max.x + radius * 2 ||
    p.y < rock.min.y - radius * 2 ||
    p.y > rock.max.y + radius * 2 ||
    p.z < rock.min.z - radius * 2 ||
    p.z > rock.max.z + radius * 2
  )
    return false;
  for (const plane of rock.planes)
    if (plane.x * p.x + plane.y * p.y + plane.z * p.z >= plane.offset + radius)
      return false;
  return true;
}
export function safeFishPosition(
  p: Vec3,
  radius: number,
  habitat: FishHabitat,
): boolean {
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    !Number.isFinite(p.z) ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    return false;
  const b = habitat.bounds;
  if (
    p.x < b.min.x + radius ||
    p.x > b.max.x - radius ||
    p.y < b.min.y + radius ||
    p.y > b.max.y - radius ||
    p.z < b.min.z + radius ||
    p.z > b.max.z - radius
  )
    return false;
  for (const rock of habitat.rocks)
    if (insideRock(p, radius, rock)) return false;
  return true;
}

/** Conservative straight-route test through expanded convex hulls; bounded by the static habitat. */
export function clearFishRoute(
  from: Readonly<Vec3>,
  to: Readonly<Vec3>,
  radius: number,
  habitat: FishHabitat,
): boolean {
  if (!safeFishPosition(to, radius, habitat)) return false;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  for (const rock of habitat.rocks) {
    if (
      Math.max(from.x, to.x) < rock.min.x - radius ||
      Math.min(from.x, to.x) > rock.max.x + radius ||
      Math.max(from.y, to.y) < rock.min.y - radius ||
      Math.min(from.y, to.y) > rock.max.y + radius ||
      Math.max(from.z, to.z) < rock.min.z - radius ||
      Math.min(from.z, to.z) > rock.max.z + radius
    )
      continue;
    let enter = 0,
      exit = 1,
      miss = false;
    for (const plane of rock.planes) {
      const distance =
        plane.x * from.x +
        plane.y * from.y +
        plane.z * from.z -
        plane.offset -
        radius;
      const delta = plane.x * dx + plane.y * dy + plane.z * dz;
      if (Math.abs(delta) < 1e-10) {
        if (distance > 0) {
          miss = true;
          break;
        }
      } else if (delta < 0) enter = Math.max(enter, -distance / delta);
      else exit = Math.min(exit, -distance / delta);
      if (enter > exit) {
        miss = true;
        break;
      }
    }
    if (!miss && enter <= exit) return false;
  }
  return true;
}
