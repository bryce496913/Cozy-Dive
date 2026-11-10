import { AQUARIUM, type Vec3 } from './world';

/**
 * v0.3 Pass 020: the cosy home office that holds the aquarium. Metres, y up. The room spans
 * x -3..3, z -2.5..2.5; the window is on the back wall (z = -2.5), the aquarium against the
 * right wall (x = 3) facing into the room. Shared by the procedural office, walking and tests.
 */
export const OFFICE = {
  room: { min: { x: -3, y: 0, z: -2.5 }, max: { x: 3, y: 2.8, z: 2.5 } },
  /** Walking: eye height, body radius, pace. */
  eyeHeight: 1.6,
  playerRadius: 0.3,
  walkSpeed: 1.25,
  /** Exponential response of walking velocity to input (1/s). */
  walkResponse: 7,
  maxFrameDelta: 0.1,
  spawn: { x: -0.2, y: 1.6, z: 1.55 },
  /** Initial look: towards the window and the aquarium. */
  spawnYaw: -0.55,
  window: { centerX: -0.6, width: 1.7, sill: 0.92, top: 2.25 },
  desk: { center: { x: -0.6, z: -2.1 }, size: { x: 1.6, y: 0.75, z: 0.7 } },
  chair: { center: { x: -0.55, z: -1.45 }, size: { x: 0.55, z: 0.55 } },
  shelf: { center: { x: -2.81, z: -0.3 }, size: { x: 0.36, y: 2, z: 1.7 } },
  stand: { center: { x: 2.55, z: 0 }, size: { x: 0.88, y: 0.75, z: 1.12 } },
  plants: [
    { x: -2.55, z: -2.05, radius: 0.24, height: 1.35 },
    { x: 2.6, z: 1.9, radius: 0.2, height: 0.95 },
  ],
} as const;

/** The aquarium's world units shrink to a roughly one-metre tank (36 units -> 1 m long). */
export const TANK_SCALE = 1 / 36;
/** Tank placement: bottom-centre on the stand top, long axis along the wall, front facing -x. */
export const TANK = {
  position: {
    x: OFFICE.stand.center.x,
    y: OFFICE.stand.size.y,
    z: OFFICE.stand.center.z,
  },
  /** Rotation about y: aquarium +z (its front) faces the room (-x). */
  yaw: -Math.PI / 2,
  size: {
    x: (AQUARIUM.max.x - AQUARIUM.min.x) * TANK_SCALE,
    y: (AQUARIUM.max.y - AQUARIUM.min.y) * TANK_SCALE,
    z: (AQUARIUM.max.z - AQUARIUM.min.z) * TANK_SCALE,
  },
} as const;

export interface FootprintBox {
  readonly min: { readonly x: number; readonly z: number };
  readonly max: { readonly x: number; readonly z: number };
}
const box = (
  c: { x: number; z: number },
  s: { x: number; z: number },
): FootprintBox => ({
  min: { x: c.x - s.x / 2, z: c.z - s.z / 2 },
  max: { x: c.x + s.x / 2, z: c.z + s.z / 2 },
});
/** Floor footprints the walker cannot enter (furniture and pots). */
export const OFFICE_FOOTPRINTS: readonly FootprintBox[] = [
  box(OFFICE.desk.center, OFFICE.desk.size),
  box(OFFICE.chair.center, OFFICE.chair.size),
  box(OFFICE.shelf.center, OFFICE.shelf.size),
  box(OFFICE.stand.center, OFFICE.stand.size),
  ...OFFICE.plants.map((p) => box(p, { x: p.radius * 2, z: p.radius * 2 })),
];
export const OFFICE_SPAWN: Vec3 = { ...OFFICE.spawn };
