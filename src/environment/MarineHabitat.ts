import { AQUARIUM, type Vec3 } from '../config/world';
import { safeFishPosition, type HabitatInterest } from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';

/** Exact upper convex surface at x/z; excludes caps outside a sloping hull's footprint. */
export function reefSurfaceHeight(
  rock: ConvexCollider,
  x: number,
  z: number,
): number | undefined {
  let y = Infinity;
  for (const p of rock.planes)
    if (p.y > 1e-5) y = Math.min(y, (p.offset - p.x * x - p.z * z) / p.y);
  if (!Number.isFinite(y)) return;
  if (rock.planes.some((p) => p.x * x + p.y * y + p.z * z > p.offset + 1e-5))
    return;
  return y;
}
/** Stable, scene-free anchors are suitable for future location-bound inhabitants too. */
export function marineInterests(
  rocks: readonly ConvexCollider[],
): HabitatInterest[] {
  const habitat = { bounds: AQUARIUM, rocks },
    result: HabitatInterest[] = [];
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i],
      sign = rock.min.x + rock.max.x > 0 ? -1 : 1;
    for (const height of [0.45, 0.8]) {
      const p: Vec3 = {
        x: sign > 0 ? rock.max.x + 0.85 : rock.min.x - 0.85,
        y: Math.max(1.1, rock.min.y + (rock.max.y - rock.min.y) * height),
        z: (rock.min.z + rock.max.z) / 2,
      };
      if (!safeFishPosition(p, 0.65, habitat)) continue;
      result.push({
        kind: height === 0.45 ? 'sheltered-crevice' : 'reef-face',
        position: p,
        normal: { x: sign, y: 0, z: 0 },
        anchorId: `reef-${i}-${height}`,
      });
    }
  }
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i];
    if (rock.max.x - rock.min.x < 0.8) continue;
    for (const offset of [-0.7, 0.7]) {
      const p = {
        x: (rock.min.x + rock.max.x) / 2 + offset,
        y: rock.min.y - 0.55,
        z: (rock.min.z + rock.max.z) / 2,
      };
      if (p.y > 0.8 && safeFishPosition(p, 0.5, habitat))
        result.push({
          kind: 'shaded-overhang',
          position: p,
          normal: { x: 0, y: -1, z: 0 },
          anchorId: `overhang-${i}-${offset}`,
        });
    }
  }
  for (const [x, z] of [
    [0, -9],
    [0, 0],
    [0, 7],
  ])
    result.push({
      kind: 'open-reef',
      position: { x, y: 6, z },
      normal: { x: 0, y: 0, z: 0 },
      anchorId: `water-${z}`,
    });
  result.push({
    kind: 'sandy-floor',
    position: { x: 0, y: 0.8, z: 2 },
    normal: { x: 0, y: 1, z: 0 },
    anchorId: 'sand-channel',
  });
  return result;
}
