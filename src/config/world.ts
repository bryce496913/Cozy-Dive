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
export type SwimmingFeel = 'relaxed' | 'natural' | 'responsive';
export interface FeelTuning {
  cycle: number;
  active: number;
  drag: number;
  response: number;
  rhythm: number;
  breathing: number;
}
/** Pass 019 playtest: breathing buoyancy forces are 60% of their earlier values (calmer idle bob). */
export const SWIM_FEELS: Record<SwimmingFeel, FeelTuning> = {
  relaxed: {
    cycle: 1.4,
    active: 0.35,
    drag: 0.8,
    response: 5,
    rhythm: 0.85,
    breathing: 0.084,
  },
  natural: {
    cycle: 1.1,
    active: 0.45,
    drag: 1.1,
    response: 8,
    rhythm: 0.75,
    breathing: 0.12,
  },
  responsive: {
    cycle: 0.8,
    active: 0.5,
    drag: 1.8,
    response: 12,
    rhythm: 0.3,
    breathing: 0.072,
  },
};
export const SWIMMING = {
  maxFrameDelta: 0.1,
  maxStep: 1 / 240,
  hoverDamping: 2.4,
  coastToHoverSpeed: 0.08,
  maxRestingResumeSpeed: 0.15,
  hoverSpring: 1.6,
  breathingCycle: 5,
  breathingFade: 1.5,
  breathingBoundaryMargin: 0.25,
  verticalInputThreshold: 0.0001,
  settleSpeed: 0.001,
  bodyPitch: 0.0012,
};

export const COLLISION = {
  playerRadius: 0.28,
  skin: 0.00001,
  epsilon: 0.0000001,
  maxContacts: 8,
};
