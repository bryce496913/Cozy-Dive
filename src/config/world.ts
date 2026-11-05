export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Bounds {
  min: Vec3;
  max: Vec3;
  clearance: number;
}

export const AQUARIUM: Bounds = {
  min: { x: -18, y: 0, z: -14 },
  max: { x: 18, y: 14, z: 14 },
  clearance: 0.65,
};
export const SPAWN: Vec3 = { x: 0, y: 4.6, z: 9 };
export const SWIMMING = {
  acceleration: 2.4,
  damping: 1.7,
  maxFrameDelta: 0.1,
};
