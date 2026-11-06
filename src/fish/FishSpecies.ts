import type { Vec3 } from '../config/world';

export type SpeciesId = 'neon-tetra' | 'harlequin-rasbora' | 'honey-gourami';
export interface SchoolingTuning {
  readonly enabled: boolean;
  readonly spacing: number;
  readonly separationRange: number;
  readonly separationWeight: number;
  readonly alignmentRadius: number;
  readonly alignmentWeight: number;
  readonly cohesionRadius: number;
  readonly cohesionWeight: number;
  readonly reconnectRadius: number;
  readonly maxNeighbors: number;
  readonly wanderWeight: number;
}
export interface DiverTuning {
  readonly awarenessRadius: number;
  readonly comfortRadius: number;
  readonly strongRadius: number;
  readonly sensitivity: number;
  readonly escapeSpeed: number;
  readonly reactionAcceleration: number;
  readonly turnMultiplier: number;
  readonly steeringWeight: number;
  readonly awarenessResponse: number;
  readonly scatterResponse: number;
  readonly directionResponse: number;
  readonly recoverySeconds: number;
  readonly approachSpeed: number;
}
export interface FishSpecies {
  readonly id: SpeciesId;
  readonly name: string;
  readonly count: number;
  readonly schooling: SchoolingTuning;
  readonly diver: DiverTuning;
  readonly length: number;
  readonly height: number;
  readonly width: number;
  readonly color: number;
  readonly backColor: number;
  readonly finColor: number;
  readonly marking: 'neon-stripes' | 'rear-wedge' | 'none';
  readonly accentColor: number;
  readonly secondaryAccent?: number;
  readonly roundedFins: boolean;
  readonly speed: number;
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly turnRate: number;
  readonly depth: readonly [number, number];
  readonly region: Vec3;
  readonly spread: Vec3;
  readonly wanderSeconds: readonly [number, number];
  readonly tailHz: number;
  readonly tailAngle: number;
  readonly profile: readonly number[];
}
export const FISH_SPECIES: readonly FishSpecies[] = [
  {
    id: 'neon-tetra',
    name: 'Neon tetra',
    count: 8,
    diver: {
      awarenessRadius: 4.2,
      comfortRadius: 2.2,
      strongRadius: 0.75,
      sensitivity: 1,
      escapeSpeed: 1.55,
      reactionAcceleration: 1.2,
      turnMultiplier: 1.6,
      steeringWeight: 4.8,
      awarenessResponse: 3,
      scatterResponse: 5,
      directionResponse: 4,
      recoverySeconds: 4.5,
      approachSpeed: 2,
    },
    schooling: {
      enabled: true,
      spacing: 0.45,
      separationRange: 1.1,
      separationWeight: 2.8,
      alignmentRadius: 5,
      alignmentWeight: 1.3,
      cohesionRadius: 7,
      cohesionWeight: 0.9,
      reconnectRadius: 11,
      maxNeighbors: 6,
      wanderWeight: 0.45,
    },
    length: 0.58,
    height: 0.17,
    width: 0.12,
    color: 0x9bbdc2,
    backColor: 0x31545d,
    finColor: 0x9cbdb9,
    marking: 'neon-stripes',
    accentColor: 0x169fe6,
    secondaryAccent: 0xc63233,
    roundedFins: false,
    speed: 0.63,
    maxSpeed: 0.88,
    acceleration: 0.36,
    turnRate: 1.35,
    depth: [3.8, 7.1],
    region: { x: -1.8, y: 5.1, z: 0 },
    spread: { x: 3.3, y: 1.2, z: 3.8 },
    wanderSeconds: [5, 10],
    tailHz: 3.3,
    tailAngle: 0.3,
    profile: [0.06, 0.18, 0.56, 0.9, 1, 0.76, 0.4, 0.025],
  },
  {
    id: 'harlequin-rasbora',
    name: 'Harlequin rasbora',
    count: 6,
    diver: {
      awarenessRadius: 3.8,
      comfortRadius: 2,
      strongRadius: 0.8,
      sensitivity: 0.85,
      escapeSpeed: 1.2,
      reactionAcceleration: 0.85,
      turnMultiplier: 1.5,
      steeringWeight: 4.2,
      awarenessResponse: 2.5,
      scatterResponse: 4,
      directionResponse: 3.5,
      recoverySeconds: 5,
      approachSpeed: 2,
    },
    schooling: {
      enabled: true,
      spacing: 0.8,
      separationRange: 1.1,
      separationWeight: 2.4,
      alignmentRadius: 5.5,
      alignmentWeight: 1.0,
      cohesionRadius: 9,
      cohesionWeight: 0.65,
      reconnectRadius: 13,
      maxNeighbors: 5,
      wanderWeight: 0.65,
    },
    length: 0.76,
    height: 0.31,
    width: 0.18,
    color: 0xda8753,
    backColor: 0x705042,
    finColor: 0xb6774b,
    marking: 'rear-wedge',
    accentColor: 0x202c2d,
    roundedFins: false,
    speed: 0.46,
    maxSpeed: 0.65,
    acceleration: 0.26,
    turnRate: 0.85,
    depth: [3.3, 7.4],
    region: { x: 3.4, y: 5.4, z: -2 },
    spread: { x: 3.4, y: 1.4, z: 3.5 },
    wanderSeconds: [7, 13],
    tailHz: 2.5,
    tailAngle: 0.26,
    profile: [0.07, 0.24, 0.76, 1, 0.94, 0.65, 0.34, 0.02],
  },
  {
    id: 'honey-gourami',
    name: 'Honey gourami',
    count: 2,
    diver: {
      awarenessRadius: 2.8,
      comfortRadius: 1.5,
      strongRadius: 0.7,
      sensitivity: 0.55,
      escapeSpeed: 0.65,
      reactionAcceleration: 0.4,
      turnMultiplier: 1.25,
      steeringWeight: 2.8,
      awarenessResponse: 1.8,
      scatterResponse: 3,
      directionResponse: 2.5,
      recoverySeconds: 6,
      approachSpeed: 2,
    },
    schooling: {
      enabled: false,
      spacing: 0.55,
      separationRange: 1.2,
      separationWeight: 2,
      alignmentRadius: 0,
      alignmentWeight: 0,
      cohesionRadius: 0,
      cohesionWeight: 0,
      reconnectRadius: 0,
      maxNeighbors: 0,
      wanderWeight: 1,
    },
    length: 1.05,
    height: 0.6,
    width: 0.28,
    color: 0xdf9b35,
    backColor: 0x8d6c30,
    finColor: 0xc59848,
    marking: 'none',
    accentColor: 0xdf9b35,
    roundedFins: true,
    speed: 0.25,
    maxSpeed: 0.38,
    acceleration: 0.15,
    turnRate: 0.55,
    depth: [5.7, 10.2],
    region: { x: -3, y: 7.5, z: -1 },
    spread: { x: 3, y: 1.2, z: 3.5 },
    wanderSeconds: [9, 17],
    tailHz: 1.5,
    tailAngle: 0.2,
    profile: [0.14, 0.48, 0.85, 1, 0.96, 0.72, 0.4, 0.035],
  },
];
export const FISH_TIMING = { step: 1 / 30, maxCatchUp: 4, seed: 38147 };
export const FISH_STEERING = {
  lookAheadSeconds: 2.2,
  safetyMargin: 0.65,
  avoidanceWeight: 6,
  maxPitch: 0.4,
  targetDistance: 0.85,
  spawnPlayerClearance: 3,
  spawnSeparation: 0.25,
};

export const SCHOOLING_SAFETY = {
  socialFadeDanger: 0.75,
  separationProjectDanger: 0.3,
  separationFade: 0.65,
  closingSpeedReduction: 0.4,
};
