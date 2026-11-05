import type { Bounds, Vec3 } from '../config/world';
import type { ConvexCollider } from '../player/collision';

/** Shared read-only environment data; never invokes the player's collision solver. */
export interface FishHabitat {
  readonly bounds: Bounds;
  readonly rocks: readonly ConvexCollider[];
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
