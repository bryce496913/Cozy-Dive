import { reefSurfaceHeight } from './MarineHabitat';
import { insideRock } from '../fish/FishHabitat';
import { AQUARIUM, SPAWN, type Vec3, type Bounds } from '../config/world';
import type { ConvexCollider } from '../player/collision';
import {
  PLANT_SPECIES,
  PLANT_TEMPLATES,
  type PlantSpecies,
  type HabitatRegionId,
} from './PlantSpecies';
export interface PlantPlacement {
  readonly id: number;
  readonly species: PlantSpecies;
  readonly region: HabitatRegionId;
  readonly position: Readonly<Vec3>;
  readonly normal: Readonly<Vec3>;
  readonly height: number;
  readonly yaw: number;
  readonly template: number;
  readonly tint: number;
  readonly radius: number;
}
export const HABITAT_REGIONS = {
  background: {
    description: 'Tall rear and side vegetation',
    anchors: [
      [-6, -11],
      [6, -11],
      [-16, -7],
      [16, -7],
    ],
  },
  'rocky-bank': {
    description: 'Broad leaves and fronds around rocky banks',
    anchors: [
      [-9, -6],
      [9, -5],
      [-12, 2],
      [12, 3],
      [-7, 5],
      [7, 4],
    ],
  },
  'substrate-edge': {
    description: 'Low grass patches beside open sand',
    anchors: [
      [-4.8, -8],
      [4.8, -6],
      [-5, 1],
      [5, 2],
      [-5, 7],
      [5, 7],
    ],
  },
  'open-channel': {
    description: 'Clear central swimming and viewing space',
    anchors: [],
  },
} as const;
/** Matches the procedural sand surface, so fine roots meet rather than float over the ripples. */
export function substrateHeight(x: number, z: number): number {
  return 0.035 * Math.sin(x * 2.6 + z * 0.65) + 0.025 * Math.sin(z * 4);
}
/** Visual-only sand relief above `substrateHeight`, in [0, SAND_RELIEF_MAX] world units.
 *
 * Ripples, shallow depressions (relief falls to zero) and sand banked against structures.
 * The rendered sand never drops below the habitat reference, so roots, ornaments and debris
 * resting on `substrateHeight` are buried by at most SAND_RELIEF_MAX instead of floating. */
export const SAND_RELIEF_MAX = 0.07;
export function sandRelief(x: number, z: number, contact = 0): number {
  const warp =
    0.35 * Math.sin(x * 0.23 + z * 0.31) + 0.2 * Math.sin(z * 0.17 - x * 0.11);
  const ripple =
    0.5 +
    0.5 *
      Math.sin(
        (x * 0.42 + z * 0.91) * 5.2 + warp * 4 + Math.sin(x * 1.3) * 0.6,
      );
  const fine = 0.5 + 0.5 * Math.sin((x * 1.1 - z * 0.6) * 9.5 + warp * 6);
  const depression =
    Math.min(
      1,
      Math.abs(Math.sin(x * 0.37 + 1.1) * Math.sin(z * 0.43 - 0.6)) * 3.2,
    ) ** 0.6;
  const relief = (ripple * 0.022 + fine * 0.006) * depression;
  return Math.min(
    SAND_RELIEF_MAX,
    relief + Math.max(0, Math.min(1, contact)) * 0.04,
  );
}
export function plantFootprintClear(
  x: number,
  z: number,
  radius: number,
  bounds: Bounds = AQUARIUM,
): boolean {
  if (
    x - radius < bounds.min.x + 0.25 ||
    x + radius > bounds.max.x - 0.25 ||
    z - radius < bounds.min.z + 0.25 ||
    z + radius > bounds.max.z - 0.25
  )
    return false;
  if (Math.abs(x) - radius < 3.2) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < radius + 3) return false;

  return true;
}
export function generatePlantPlacements(
  rocks: readonly ConvexCollider[],
  seed = 48193,
  density = 1,
  fits?: (placement: PlantPlacement) => boolean,
  supports: readonly ConvexCollider[] = rocks,
): readonly PlantPlacement[] {
  if (!Number.isFinite(density) || density <= 0 || density > 3)
    throw new Error('Plant density must be in (0, 3].');
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const placements: PlantPlacement[] = [];
  for (const species of PLANT_SPECIES)
    for (let i = 0; i < Math.round(species.count * density); i++) {
      const height =
        species.height[0] + random() * (species.height[1] - species.height[0]);
      const radius = height * (species.reach + species.width * 0.5 + 0.12),
        yaw = random() * Math.PI * 2,
        template = Math.floor(random() * PLANT_TEMPLATES),
        tint = 0.9 + random() * 0.2;
      let x = 0,
        z = 0,
        placed = false,
        rootY = 0,
        normal: Vec3 = { x: 0, y: 1, z: 0 };
      const anchors = HABITAT_REGIONS[species.region].anchors;
      for (let attempt = 0; attempt < 600; attempt++) {
        const anchor = anchors[Math.floor(random() * anchors.length)];
        x = anchor[0] + (random() + random() - 1) * 3.5;
        z = anchor[1] + (random() + random() - 1) * 3.3;
        if (species.category === 'coral' && supports.length) {
          const rock = supports[Math.floor(random() * supports.length)];
          x = (rock.min.x + rock.max.x) / 2;
          z = (rock.min.z + rock.max.z) / 2;
          const top = reefSurfaceHeight(rock, x, z);
          if (
            top === undefined ||
            rock.max.x - rock.min.x < 0.8 ||
            rock.max.z - rock.min.z < 0.7
          )
            continue;
          const face = rock.planes.reduce((best, p) =>
            Math.abs(p.x * x + p.y * top + p.z * z - p.offset) <
            Math.abs(best.x * x + best.y * top + best.z * z - best.offset)
              ? p
              : best,
          );
          normal = { x: face.x, y: face.y, z: face.z };
          x += normal.x * 0.02;
          z += normal.z * 0.02;
          rootY = top + normal.y * 0.02;
        } else rootY = substrateHeight(x, z) - 0.012;
        if (!plantFootprintClear(x, z, radius)) continue;
        let clear = true;
        // Enclose leaves at successive heights, including their maximum current displacement.
        // Upper leaves can extend above a low rock while the slender base remains beside it.
        for (let sample = 0; sample <= 16 && clear; sample++) {
          const t = sample / 16,
            y = rootY + normal.y * height * t * 0.85;
          const envelope =
            height *
            (species.reach * t ** 1.7 +
              species.width * 0.5 * Math.sin(Math.PI * t) ** 0.6 +
              0.06 +
              species.sway * t * t * 1.5);
          for (const rock of rocks)
            if (
              insideRock(
                {
                  x: x + normal.x * height * t * 0.85,
                  y,
                  z: z + normal.z * height * t * 0.85,
                },
                species.category === 'coral'
                  ? envelope * Math.min(1, t * 3)
                  : envelope,
                rock,
              )
            ) {
              clear = false;
              break;
            }
        }
        if (!clear) continue;

        if (
          placements.some(
            (p) =>
              Math.hypot(p.position.x - x, p.position.z - z) <
              0.28 * (p.radius + radius),
          )
        )
          continue;
        if (
          fits &&
          !fits({
            id: placements.length,
            species,
            region: species.region,
            position: { x, y: rootY, z },
            normal,
            height,
            yaw,
            template,
            tint,
            radius,
          })
        )
          continue;
        placed = true;
        break;
      }
      if (!placed)
        throw new Error(
          `No safe ${species.name} placement; reduce vegetation density.`,
        );
      placements.push({
        id: placements.length,
        species,
        region: species.region,
        position: { x, y: rootY, z },
        normal,
        height,
        yaw,
        template,
        tint,
        radius,
      });
    }
  return placements;
}
