import type { BehaviorTuning } from './FishBehaviorTypes';
import type { Vec3 } from '../config/world';

export type SpeciesId =
  | 'blue-green-chromis'
  | 'pajama-cardinalfish'
  | 'royal-gramma'
  | 'yellow-assessor'
  | 'firefish-goby'
  | 'ocellaris-clownfish';
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
    'chromis' | 'cardinal' | 'firefish' | 'assessor' | 'gramma' | 'clownfish';
  readonly inspectionPreference?: 'tall' | 'broad';
  readonly habitatKinds?: readonly import('./FishHabitat').HabitatKind[];
  readonly homeRadius?: number;
  readonly hostAnchorId?: string;
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
const independent: SchoolingTuning = {
  enabled: false,
  spacing: 0.45,
  separationRange: 1.1,
  separationWeight: 2.8,
  alignmentRadius: 0,
  alignmentWeight: 0,
  cohesionRadius: 0,
  cohesionWeight: 0,
  reconnectRadius: 0,
  maxNeighbors: 0,
  wanderWeight: 1,
};
const calm: BehaviorTuning = {
  interval: [24, 52],
  weights: [0.35, 0.3, 0.3, 0.05],
  duration: [9, 17],
  restDuration: [5, 12],
  restSpeed: 0.2,
  socialRetention: 1,
  recoverySeconds: 8,
};
const response: DiverTuning = {
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
};
export const FISH_SPECIES: readonly FishSpecies[] = [
  {
    id: 'blue-green-chromis',
    name: 'Blue-green chromis',
    count: 20,
    radiusFactor: 0.62,
    length: 0.46,
    height: 0.19,
    width: 0.09,
    color: 0x65b9be,
    backColor: 0x327b9e,
    finColor: 0x73bcb9,
    marking: 'chromis',
    accentColor: 0x71c9be,
    roundedFins: false,
    detail: 'small',
    profile: [0.06, 0.23, 0.72, 1, 0.96, 0.78, 0.47, 0.025],
    speed: 0.45,
    maxSpeed: 1.15,
    acceleration: 0.5,
    turnRate: 2.1,
    depth: [4.5, 9.5],
    region: { x: 0, y: 7.2, z: -3 },
    spread: { x: 2.2, y: 0.85, z: 2.4 },
    wanderSeconds: [5, 10],
    tailHz: 4.5,
    tailAngle: 0.3,
    schooling: {
      enabled: true,
      spacing: 0.18,
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
      ...calm,
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
      ...response,
      awarenessRadius: 4.4,
      escapeSpeed: 1.45,
      reactionAcceleration: 1.8,
      turnMultiplier: 1.5,
      recoverySeconds: 4,
    },
  },
  {
    id: 'pajama-cardinalfish',
    name: 'Pajama cardinalfish',
    count: 6,
    length: 0.62,
    height: 0.34,
    width: 0.125,
    radiusFactor: 0.7,
    color: 0xd1c5a0,
    backColor: 0x9e9a79,
    finColor: 0xd4bd81,
    marking: 'cardinal',
    accentColor: 0x282f32,
    secondaryAccent: 0x995555,
    roundedFins: false,
    detail: 'medium',
    profile: [0.07, 0.3, 0.78, 1, 1, 0.86, 0.6, 0.05],
    speed: 0.3,
    maxSpeed: 0.58,
    acceleration: 0.22,
    turnRate: 0.9,
    depth: [2.8, 6.6],
    region: { x: 3.5, y: 4.8, z: -2 },
    spread: { x: 3, y: 1.2, z: 3 },
    wanderSeconds: [9, 17],
    tailHz: 2.0,
    tailAngle: 0.21,
    schooling: {
      ...independent,
      enabled: true,
      spacing: 0.75,
      alignmentRadius: 5.5,
      alignmentWeight: 0.65,
      cohesionRadius: 8,
      cohesionWeight: 0.55,
      reconnectRadius: 12,
      maxNeighbors: 5,
      wanderWeight: 0.7,
    },
    behavior: { ...calm, weights: [0.3, 0.4, 0.25, 0.05] },
    diver: {
      ...response,
      sensitivity: 0.75,
      escapeSpeed: 1.0,
      reactionAcceleration: 0.7,
    },
  },
  {
    id: 'firefish-goby',
    name: 'Firefish goby',
    count: 6,
    length: 0.85,
    height: 0.13,
    width: 0.11,
    radiusFactor: 0.6,
    color: 0xe2d9bd,
    backColor: 0xb8b6a5,
    finColor: 0xc4675c,
    marking: 'firefish',
    accentColor: 0xbd4e57,
    roundedFins: false,
    detail: 'medium',
    profile: [0.055, 0.24, 0.58, 0.83, 0.98, 1, 0.69, 0.055],
    speed: 0.25,
    maxSpeed: 0.85,
    acceleration: 0.3,
    turnRate: 1.6,
    depth: [1.5, 5.5],
    region: { x: -7, y: 3.4, z: -2 },
    spread: { x: 4, y: 1.3, z: 5 },
    wanderSeconds: [7, 14],
    tailHz: 2.8,
    tailAngle: 0.22,
    schooling: independent,
    behavior: { ...calm, weights: [0.3, 0.4, 0.28, 0.02], recoverySeconds: 10 },
    diver: {
      ...response,
      awarenessRadius: 5,
      sensitivity: 1.15,
      escapeSpeed: 1.65,
      reactionAcceleration: 1.7,
      recoverySeconds: 7,
    },
    habitatKinds: ['sheltered-crevice', 'reef-face'],
    homeRadius: 3,
  },
  {
    id: 'yellow-assessor',
    name: 'Yellow assessor',
    count: 4,
    length: 0.64,
    height: 0.23,
    width: 0.14,
    color: 0xd9b953,
    backColor: 0x9b8f40,
    finColor: 0xc8af59,
    marking: 'assessor',
    accentColor: 0xe1c969,
    roundedFins: true,
    detail: 'medium',
    profile: [0.08, 0.36, 0.8, 1, 0.95, 0.83, 0.55, 0.05],
    speed: 0.24,
    maxSpeed: 0.45,
    acceleration: 0.17,
    turnRate: 0.75,
    depth: [1.3, 5.5],
    region: { x: 8, y: 3, z: 1 },
    spread: { x: 4, y: 1.3, z: 5 },
    wanderSeconds: [9, 17],
    tailHz: 1.9,
    tailAngle: 0.2,
    schooling: independent,
    behavior: { ...calm, weights: [0.35, 0.3, 0.33, 0.02] },
    diver: {
      ...response,
      sensitivity: 0.65,
      escapeSpeed: 0.8,
      reactionAcceleration: 0.6,
    },
    habitatKinds: ['shaded-overhang', 'reef-face'],
    homeRadius: 3,
  },
  {
    id: 'royal-gramma',
    name: 'Royal gramma',
    count: 2,
    length: 0.72,
    height: 0.24,
    width: 0.15,
    color: 0x9566ad,
    backColor: 0x5a4d82,
    finColor: 0x9677a7,
    marking: 'gramma',
    accentColor: 0xd8b350,
    roundedFins: true,
    detail: 'medium',
    profile: [0.06, 0.3, 0.7, 0.94, 1, 0.86, 0.58, 0.04],
    speed: 0.22,
    maxSpeed: 0.42,
    acceleration: 0.16,
    turnRate: 0.85,
    depth: [1.3, 5.5],
    region: { x: -9, y: 3, z: 0 },
    spread: { x: 4, y: 1.2, z: 5 },
    wanderSeconds: [8, 16],
    tailHz: 2.1,
    tailAngle: 0.21,
    schooling: independent,
    behavior: { ...calm, weights: [0.25, 0.35, 0.38, 0.02] },
    diver: {
      ...response,
      sensitivity: 0.75,
      escapeSpeed: 0.9,
      reactionAcceleration: 0.65,
    },
    habitatKinds: ['sheltered-crevice', 'reef-face', 'coral-edge'],
    homeRadius: 2.7,
  },
  {
    id: 'ocellaris-clownfish',
    name: 'Ocellaris clownfish',
    count: 2,
    length: 0.68,
    height: 0.32,
    width: 0.16,
    radiusFactor: 0.64,
    color: 0xe16e30,
    backColor: 0xa14f24,
    finColor: 0xd77635,
    marking: 'clownfish',
    accentColor: 0xe7e2c9,
    roundedFins: true,
    detail: 'medium',
    profile: [0.055, 0.25, 0.6, 0.88, 1, 1, 0.85, 0.1],
    speed: 0.32,
    maxSpeed: 0.62,
    acceleration: 0.35,
    turnRate: 2.6,
    depth: [1.4, 8.5],
    region: { x: -7, y: 4.8, z: 3 },
    spread: { x: 1, y: 0.4, z: 1 },
    wanderSeconds: [4, 8],
    tailHz: 2.5,
    tailAngle: 0.24,
    schooling: {
      ...independent,
      separationRange: 1.15,
      separationWeight: 3.5,
      spacing: 0.3,
    },
    behavior: {
      ...calm,
      interval: [6, 12],
      weights: [0.25, 0.65, 0.1, 0],
      restSpeed: 0.1,
      recoverySeconds: 5,
    },
    diver: {
      ...response,
      awarenessRadius: 3.5,
      comfortRadius: 1.8,
      sensitivity: 0.8,
      escapeSpeed: 0.8,
      reactionAcceleration: 0.8,
      steeringWeight: 3.5,
    },
    hostAnchorId: 'anemone-host',
    homeRadius: 3,
  },
];
export function fishPopulation(count: 40 | 60): readonly FishSpecies[] {
  return count === 40
    ? FISH_SPECIES
    : FISH_SPECIES.map((s) =>
        s.id === 'blue-green-chromis'
          ? { ...s, count: 40, spread: { x: 3.2, y: 1.2, z: 3.2 } }
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
