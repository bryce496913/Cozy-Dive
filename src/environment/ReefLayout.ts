import * as THREE from 'three';
import { AQUARIUM, SPAWN } from '../config/world';
import { insideRock } from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';
import type { RockPlacement } from './Aquarium';
import { substrateHeight } from './HabitatRegions';
import type { GrassPatch } from './MeadowSystem';

/** Shared Pass 014 reef presentation tuning. Seeds never consume the accepted layout RNG. */
export const REEF_LAYOUT = {
  seed: 140014,
  /** Texture repeats per world unit for triplanar reef rock. */
  rockTexelScale: 0.85,
  coralTexelScale: 2.2,
  /** Rock level distances: 20k-triangle hero, 5k mid and 1.3k far levels. */
  rockLodDistances: [0, 7, 16] as const,
  /** Hero coral colonies switch to their low level beyond this distance. */
  coralLodDistance: 10,
  sandRepeat: [26, 20] as const,
  /** Central channel half-width kept nearly free of debris. */
  channelHalfWidth: 2.6,
  /** Rear/side glass reliefs: depth <= 0.2 so they stay outside the 0.65 swimming clearance. */
  backdropDepth: 0.2,
  /** Wall-mounted equipment stays visible: no relief within this distance of it along the glass. */
  backdropEquipmentClearance: 2.6,
  /** Real-world 1.5-4 cm shells/rubble relative to ~8 cm aquarium fish (world ~0.5-0.8 units). */
  debrisScale: [
    [3.2, 5.5],
    [3.0, 5.0],
    [3.0, 5.5],
    [1.0, 1.8],
    [1.0, 1.7],
  ] as const,
  understoryPerPatch: 110,
} as const;

export interface DebrisPlacement {
  readonly template: number;
  readonly matrix: THREE.Matrix4;
  readonly position: THREE.Vector3;
  readonly scale: number;
}
export interface DebrisHabitat {
  readonly rocks: readonly RockPlacement[];
  readonly solids: readonly ConvexCollider[];
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Deterministic shells, coral rubble and fine fragments. Most gather where sand meets rock;
 * the open channel and spawn stay nearly clear. Nothing is placed inside structural solids.
 */
export function scatterDebris(
  habitat: DebrisHabitat,
  seed = REEF_LAYOUT.seed,
): DebrisPlacement[] {
  const rand = random(seed),
    out: DebrisPlacement[] = [],
    q = new THREE.Quaternion(),
    e = new THREE.Euler();
  const place = (x: number, z: number, template: number): void => {
    if (
      x < AQUARIUM.min.x + 0.5 ||
      x > AQUARIUM.max.x - 0.5 ||
      z < AQUARIUM.min.z + 0.5 ||
      z > AQUARIUM.max.z - 0.5
    )
      return;
    if (Math.abs(x) < REEF_LAYOUT.channelHalfWidth && rand() > 0.12) return;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 1.5) return;
    const [lo, hi] = REEF_LAYOUT.debrisScale[template];
    const scale = lo + rand() * (hi - lo);
    const y = substrateHeight(x, z) - 0.004 * scale;
    const p = new THREE.Vector3(x, y, z);
    if (habitat.solids.some((s) => insideRock(p, 0.06 * scale, s))) return;
    e.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4);
    q.setFromEuler(e);
    out.push({
      template,
      position: p,
      scale,
      matrix: new THREE.Matrix4().compose(
        p,
        q,
        new THREE.Vector3(scale, scale, scale),
      ),
    });
  };
  for (const rock of habitat.rocks) {
    if (!rock.solid || !rock.collider) continue;
    const c = rock.collider,
      cx = (c.min.x + c.max.x) / 2,
      cz = (c.min.z + c.max.z) / 2,
      rx = (c.max.x - c.min.x) / 2,
      rz = (c.max.z - c.min.z) / 2;
    const count = 6 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2,
        spread = 0.92 + rand() * 0.45;
      place(
        cx + Math.cos(a) * rx * spread,
        cz + Math.sin(a) * rz * spread,
        rand() < 0.55 ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 3),
      );
    }
  }
  for (let i = 0; i < 150; i++)
    place(
      AQUARIUM.min.x + 1 + rand() * (AQUARIUM.max.x - AQUARIUM.min.x - 2),
      AQUARIUM.min.z + 1 + rand() * (AQUARIUM.max.z - AQUARIUM.min.z - 2),
      Math.floor(rand() * 5),
    );
  return out;
}

export interface UnderstoryBlade {
  readonly template: number;
  readonly matrix: THREE.Matrix4;
  readonly tint: number;
  readonly height: number;
}

/** Short centre-weighted blades layered beneath accepted meadows, with ragged edges and gaps. */
export function meadowUnderstory(
  patches: readonly GrassPatch[],
  seed = REEF_LAYOUT.seed,
): UnderstoryBlade[] {
  const rand = random(seed + 7),
    out: UnderstoryBlade[] = [],
    axis = new THREE.Vector3(0, 1, 0),
    q = new THREE.Quaternion(),
    lean = new THREE.Quaternion(),
    tilt = new THREE.Vector3();
  patches.forEach((patch, index) => {
    const gapAngle = rand() * Math.PI * 2;
    for (let i = 0; i < REEF_LAYOUT.understoryPerPatch; i++) {
      const angle = rand() * Math.PI * 2;
      // Squared radius bias concentrates blades in the centre; an angular gap breaks the disc.
      const r =
        patch.radius *
        rand() ** 1.6 *
        (0.82 + 0.18 * Math.sin(angle * 4 + index));
      if (Math.cos(angle - gapAngle) > 0.86 && r > patch.radius * 0.3) continue;
      const x = patch.x + Math.cos(angle) * r,
        z = patch.z + Math.sin(angle) * r * 0.7;
      const height = (0.12 + rand() * 0.3) * (1 - (r / patch.radius) * 0.5);
      q.setFromAxisAngle(axis, rand() * Math.PI * 2);
      tilt.set(rand() - 0.5, 0, rand() - 0.5).normalize();
      lean.setFromAxisAngle(tilt, (rand() - 0.5) * 0.25);
      out.push({
        template: Math.floor(rand() * 3),
        height,
        tint: 0.8 + rand() * 0.25,
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(x, substrateHeight(x, z) - 0.012, z),
          lean.multiply(q),
          new THREE.Vector3(height, height, height),
        ),
      });
    }
  });
  return out;
}

export interface BackdropRock {
  readonly template: number;
  readonly matrix: THREE.Matrix4;
  /** Wall-normal half thickness in world units, always <= backdropDepth / 2. */
  readonly halfDepth: number;
}

/**
 * Flattened low-detail reef rocks layered against the rear and side glass. They create a distant
 * reef silhouette without extending the tank: every relief stays within `backdropDepth` of its wall.
 */
export function backdropRocks(
  keepClear: readonly { x: number; z: number }[] = [],
  seed = REEF_LAYOUT.seed,
): BackdropRock[] {
  const rand = random(seed + 31),
    out: BackdropRock[] = [],
    depth = REEF_LAYOUT.backdropDepth;
  const walls = [
    {
      from: AQUARIUM.min.x + 0.6,
      to: AQUARIUM.max.x - 0.6,
      axis: 'x' as const,
      at: AQUARIUM.min.z,
      inward: 1,
    },
    {
      from: AQUARIUM.min.z + 0.6,
      to: AQUARIUM.max.z - 3.5,
      axis: 'z' as const,
      at: AQUARIUM.min.x,
      inward: 1,
    },
    {
      from: AQUARIUM.min.z + 0.6,
      to: AQUARIUM.max.z - 3.5,
      axis: 'z' as const,
      at: AQUARIUM.max.x,
      inward: -1,
    },
  ];
  walls.forEach((wall, w) => {
    for (const layer of [0, 1]) {
      let t = wall.from + rand() * 0.6;
      while (t < wall.to) {
        const width = (layer ? 1.0 : 1.5) + rand() * (layer ? 1.2 : 1.9);
        const height =
          (layer ? 0.7 : 1.0) +
          rand() *
            (layer ? 1.1 : 1.8) *
            (0.6 + 0.4 * Math.sin(t * 0.35 + w * 2));
        const x = wall.axis === 'x' ? t : wall.at;
        const z = wall.axis === 'x' ? wall.at : t;
        t += width * (0.9 + rand() * 0.5);
        // Measured from the relief's nearest edge along the glass, not its centre.
        if (
          keepClear.some(
            (k) =>
              Math.hypot(k.x - x, k.z - z) - width <
              REEF_LAYOUT.backdropEquipmentClearance,
          )
        )
          continue;
        const halfDepth = depth * (layer ? 0.32 : 0.48);
        const centre = wall.at + wall.inward * halfDepth * 1.02;
        const position =
          wall.axis === 'x'
            ? new THREE.Vector3(x, height * 0.42 * (layer ? 1.5 : 1), centre)
            : new THREE.Vector3(centre, height * 0.42 * (layer ? 1.5 : 1), z);
        // Unit rock templates fit the unit sphere, so the wall-normal scale bounds the depth.
        const scale =
          wall.axis === 'x'
            ? new THREE.Vector3(width, height, halfDepth)
            : new THREE.Vector3(halfDepth, height, width);
        const yaw = rand() < 0.5 ? 0 : Math.PI;
        out.push({
          template: Math.floor(rand() * 6),
          halfDepth,
          matrix: new THREE.Matrix4().compose(
            position,
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(0, 1, 0),
              yaw,
            ),
            scale,
          ),
        });
      }
    }
  });
  return out;
}
