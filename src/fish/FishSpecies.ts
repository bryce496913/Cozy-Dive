import type { BehaviorTuning } from './FishBehaviorTypes';
import type { Vec3 } from '../config/world';

export type SpeciesId =
  | 'neon-tetra'
  | 'harlequin-rasbora'
  | 'honey-gourami'
  | 'endlers-livebearer'
  | 'chili-rasbora';
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
  readonly behavior: BehaviorTuning;
  readonly diver: DiverTuning;
  readonly length: number;
  readonly height: number;
  readonly width: number;
  readonly color: number;
  readonly backColor: number;
  readonly finColor: number;
  readonly marking:
    | 'neon-stripes'
    | 'rear-wedge'
    | 'none'
    | 'endler-patches'
    | 'lateral-stripe';
  readonly radiusFactor?: number;
  readonly detail?: 'medium' | 'small';
  readonly substrateOffset?: readonly [number, number];
  readonly burst?: {
    readonly interval: readonly [number, number];
    readonly duration: readonly [number, number];
    readonly speed: number;
    readonly acceleration: number;
  };
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
export const ORIGINAL_FISH_SPECIES: readonly FishSpecies[] = [
  {
    id: 'neon-tetra',
    name: 'Neon tetra',
    count: 8,
    behavior: {
      interval: [32, 64],
      weights: [0.65, 0.08, 0.22, 0.05],
      duration: [7, 12],
      restDuration: [3, 6],
      restSpeed: 0.3,
      socialRetention: 0.9,
      recoverySeconds: 5,
    },
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
    behavior: {
      interval: [28, 60],
      weights: [0.45, 0.22, 0.25, 0.08],
      duration: [10, 17],
      restDuration: [5, 9],
      restSpeed: 0.22,
      socialRetention: 0.7,
      recoverySeconds: 7,
    },
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
    behavior: {
      interval: [20, 42],
      weights: [0.3, 0.3, 0.2, 0.2],
      duration: [15, 24],
      restDuration: [10, 18],
      restSpeed: 0.16,
      socialRetention: 1,
      recoverySeconds: 10,
    },
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
export const FISH_SPECIES: readonly FishSpecies[] = [
  ...ORIGINAL_FISH_SPECIES,
  {
    ...ORIGINAL_FISH_SPECIES[0],
    id: 'endlers-livebearer',
    name: "Endler's livebearer",
    count: 4,
    length: 0.45,
    height: 0.12,
    width: 0.095,
    color: 0x9baf87,
    backColor: 0x526d55,
    finColor: 0xb1a06d,
    marking: 'endler-patches',
    accentColor: 0xd58c39,
    secondaryAccent: 0x438c83,
    detail: 'medium',
    speed: 0.48,
    maxSpeed: 0.9,
    acceleration: 0.45,
    turnRate: 1.65,
    depth: [5, 10.5],
    region: { x: 2.3, y: 7.8, z: 1 },
    spread: { x: 4, y: 1.8, z: 4 },
    profile: [0.07, 0.18, 0.58, 0.9, 1, 0.8, 0.4, 0.035],
    schooling: {
      ...ORIGINAL_FISH_SPECIES[2].schooling,
      spacing: 0.35,
      separationRange: 0.8,
    },
    behavior: {
      ...ORIGINAL_FISH_SPECIES[0].behavior,
      interval: [24, 52],
      weights: [0.7, 0.06, 0.15, 0.09],
      socialRetention: 1,
    },
    burst: {
      interval: [8, 15],
      duration: [0.45, 0.8],
      speed: 0.82,
      acceleration: 0.8,
    },
    diver: {
      ...ORIGINAL_FISH_SPECIES[0].diver,
      awarenessRadius: 3.8,
      escapeSpeed: 1.2,
    },
  },
  {
    ...ORIGINAL_FISH_SPECIES[0],
    id: 'chili-rasbora',
    name: 'Chili rasbora',
    count: 20,
    length: 0.24,
    height: 0.062,
    width: 0.046,
    color: 0xba5836,
    backColor: 0x783a2d,
    finColor: 0xbd9275,
    marking: 'lateral-stripe',
    accentColor: 0x293332,
    detail: 'small',
    speed: 0.45,
    maxSpeed: 1.15,
    acceleration: 0.5,
    turnRate: 2.1,
    depth: [5.2, 9.5],
    region: { x: 0, y: 7.2, z: -3 },
    spread: { x: 2.2, y: 0.85, z: 2.4 },
    profile: [0.045, 0.15, 0.48, 0.85, 1, 0.73, 0.32, 0.02],
    tailHz: 4.8,
    tailAngle: 0.32,
    schooling: {
      enabled: true,
      spacing: 0.13,
      separationRange: 0.6,
      separationWeight: 3,
      alignmentRadius: 3.6,
      alignmentWeight: 1.65,
      cohesionRadius: 8.5,
      cohesionWeight: 1.4,
      reconnectRadius: 13,
      maxNeighbors: 12,
      wanderWeight: 0.18,
    },
    behavior: {
      ...ORIGINAL_FISH_SPECIES[0].behavior,
      interval: [42, 78],
      weights: [0.8, 0.025, 0.16, 0.015],
      duration: [5, 9],
      restDuration: [2, 4],
      socialRetention: 0.95,
    },
    burst: {
      interval: [5, 11],
      duration: [0.4, 0.8],
      speed: 1.05,
      acceleration: 1.6,
    },
    diver: {
      ...ORIGINAL_FISH_SPECIES[0].diver,
      awarenessRadius: 4.4,
      sensitivity: 1,
      escapeSpeed: 1.45,
      reactionAcceleration: 1.8,
      turnMultiplier: 1.5,
      recoverySeconds: 4,
    },
  },
];
export function fishPopulation(
  count: 16 | 20 | 40 | 60,
): readonly FishSpecies[] {
  if (count === 16) return ORIGINAL_FISH_SPECIES;
  if (count === 20) return FISH_SPECIES.slice(0, 4);
  if (count === 40) return FISH_SPECIES;
  return FISH_SPECIES.map((s) =>
    s.id === 'chili-rasbora'
      ? { ...s, count: 40, spread: { x: 2.8, y: 1, z: 3 } }
      : s,
  );
}
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
