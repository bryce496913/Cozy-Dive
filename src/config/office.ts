import { AQUARIUM, type Vec3 } from './world';

/** Standing eye height in the office (m). Playtest: 1.6 m felt too tall, so 20% lower. */
const EYE_HEIGHT = 1.28;

/**
 * v0.4 Pass 027: the glass office (it was a cosy home office in v0.3). A small private office with
 * grey grasscloth walls, porcelain tiles and an acoustic ceiling. Its front (z = room.max.z) is a
 * black-framed glass partition with a closed door, looking out over an open-plan office; the
 * back wall has a tall window, frosted below. A dark L-desk fills the back-left corner, two guest
 * chairs face it, and the aquarium stands against the right wall (x = room.max.x), facing into the
 * room. Metres, y up. Shared by the procedural office, walking, the dive and tests.
 */
export const OFFICE = {
  room: { min: { x: -1.8, y: 0, z: -2.1 }, max: { x: 1.8, y: 2.7, z: 2.1 } },
  /** Walking: eye height, body radius, pace. */
  eyeHeight: EYE_HEIGHT,
  playerRadius: 0.3,
  walkSpeed: 1.25,
  /** Exponential response of walking velocity to input (1/s). */
  walkResponse: 7,
  maxFrameDelta: 0.1,
  /** Just inside the glass door; looking at the aquarium, with the desk to the left. */
  spawn: { x: 0.25, y: EYE_HEIGHT, z: 1.6 },
  spawnYaw: -0.72,
  /** The back window (on z = room.min.z): frosted from the sill up to `frost`, clear above. */
  window: { centerX: 0.85, width: 1.3, sill: 0.25, top: 2.45, frost: 1.95 },
  /** The L-desk: the main top facing the door, and its return along the left wall. */
  desk: { center: { x: -0.7, z: -0.6 }, size: { x: 1.6, y: 0.75, z: 0.7 } },
  deskReturn: {
    center: { x: -1.48, z: -1.52 },
    size: { x: 0.6, y: 0.75, z: 1.12 },
  },
  /** The desk chair (behind the desk) and two guest chairs facing it. */
  chair: { center: { x: -0.6, z: -1.4 }, size: { x: 0.6, z: 0.6 } },
  guestChairs: [
    { x: -1.3, z: 0.05 },
    { x: -0.72, z: 0.05 },
  ],
  guestChairSize: { x: 0.5, z: 0.5 },
  /** Boxes stacked in the back-right corner, under the window's edge. */
  boxes: { center: { x: 1.52, z: -1.82 }, size: { x: 0.5, y: 0.6, z: 0.42 } },
  stand: { center: { x: 1.34, z: 0.6 }, size: { x: 0.88, y: 0.75, z: 1.12 } },
  plants: [] as readonly {
    readonly x: number;
    readonly z: number;
    readonly radius: number;
    readonly height: number;
  }[],
  /** The glass front: the door's span (x) within it, and the frame's profile (m). */
  door: { from: 0.55, to: 1.5, height: 2.15 },
  frame: 0.05,
  /** The open-plan office beyond the glass (seen, never entered). */
  openPlan: { min: { x: -6, z: 2.1 }, max: { x: 6.5, z: 10 }, height: 2.9 },
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
/** The aquarium cabinet's footprint (the dive approaches it; everything else stays clear). */
export const STAND_FOOTPRINT: FootprintBox = box(
  OFFICE.stand.center,
  OFFICE.stand.size,
);
/** Floor footprints the walker cannot enter (furniture and pots). */
export const OFFICE_FOOTPRINTS: readonly FootprintBox[] = [
  box(OFFICE.desk.center, OFFICE.desk.size),
  box(OFFICE.deskReturn.center, OFFICE.deskReturn.size),
  box(OFFICE.chair.center, OFFICE.chair.size),
  ...OFFICE.guestChairs.map((c) => box(c, OFFICE.guestChairSize)),
  box(OFFICE.boxes.center, OFFICE.boxes.size),
  STAND_FOOTPRINT,
  ...OFFICE.plants.map((p) => box(p, { x: p.radius * 2, z: p.radius * 2 })),
];
export const OFFICE_SPAWN: Vec3 = { ...OFFICE.spawn };
