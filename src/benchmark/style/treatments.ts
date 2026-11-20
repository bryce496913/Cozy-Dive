/**
 * V0.7 Pass 062: the style benchmark's treatments, layout and fixed views (pure data, no WebGL).
 *
 * Two axes are selectable independently so lighting changes can be judged apart from geometry
 * and material changes: `assets` picks the models and their materials, `lighting` the water and
 * light rig. Each axis has the shipped `baseline` and the two candidate directions:
 *   natural  Style A, Natural Realism
 *   crafted  Style B, Crafted Stylized Realism
 * The layout, camera views, FOV, scale rule and sand are shared by every combination.
 */
import { TANK_LIGHTING } from '../../config/tankLighting';

export type Treatment = 'baseline' | 'natural' | 'crafted';
export const TREATMENTS: readonly Treatment[] = [
  'baseline',
  'natural',
  'crafted',
];
export const TREATMENT_LABELS: Readonly<Record<Treatment, string>> = {
  baseline: 'Baseline (shipped)',
  natural: 'A · Natural Realism',
  crafted: 'B · Crafted Stylized Realism',
};

export type Vec3 = readonly [number, number, number];

export interface LightSpec {
  readonly color: number;
  readonly intensity: number;
  readonly position: Vec3;
}
export interface LightingSpec {
  readonly background: number;
  readonly fogDensity: number;
  readonly exposure: number;
  readonly hemisphere: {
    readonly sky: number;
    readonly ground: number;
    readonly intensity: number;
  };
  readonly sun: LightSpec;
  readonly fill: LightSpec;
  /** One soft shadow map from the sun (the only lighting cost the candidates add). */
  readonly shadows: boolean;
}

/**
 * Baseline is the tank rig itself. A: deeper, bluer, more attenuated water with a stronger,
 * neutral sun and low ambient (restrained, high-contrast, grounded). B: clearer, slightly warmer
 * water, a warm key, a cool rim for silhouettes and moderate ambient (idealized clarity).
 */
export const LIGHTING: Readonly<Record<Treatment, LightingSpec>> = {
  baseline: {
    background: TANK_LIGHTING.background,
    fogDensity: TANK_LIGHTING.fogDensity,
    exposure: TANK_LIGHTING.exposure,
    hemisphere: TANK_LIGHTING.hemisphere,
    sun: TANK_LIGHTING.sun,
    fill: TANK_LIGHTING.fill,
    shadows: false,
  },
  natural: {
    background: 0x1b5165,
    fogDensity: 0.036,
    exposure: 1.2,
    hemisphere: { sky: 0xb4dcd8, ground: 0x3c4a3e, intensity: 1.6 },
    sun: { color: 0xfff6e6, intensity: 4.4, position: [-5, 16, 6] },
    fill: { color: 0x5aaebd, intensity: 0.45, position: [8, 6, -10] },
    shadows: true,
  },
  crafted: {
    background: 0x2a6e86,
    fogDensity: 0.02,
    exposure: 1.28,
    hemisphere: { sky: 0xd2f0e6, ground: 0x6a7258, intensity: 2.0 },
    sun: { color: 0xffe6bf, intensity: 3.9, position: [-6, 15, 8] },
    fill: { color: 0x8adbe4, intensity: 1.15, position: [6, 7, -9] },
    shadows: true,
  },
};

export type Subject = 'rock' | 'brain' | 'branching' | 'seagrass';
export type FishSubject = 'chromis' | 'clownfish';

/** Node names per treatment inside its model file. */
export const SUBJECT_NODES: Readonly<
  Record<Treatment, Readonly<Record<Subject, readonly string[]>>>
> = {
  baseline: {
    rock: ['Rock_0'],
    brain: ['Coral_Massive_0'],
    branching: ['Coral_Branching_0', 'Coral_Branching_0_Tips'],
    seagrass: ['Turtle_Grass_0', 'Turtle_Grass_1', 'Turtle_Grass_2'],
  },
  natural: {
    rock: ['Rock'],
    brain: ['Coral_Brain'],
    branching: ['Coral_Branching'],
    seagrass: ['Seagrass_0', 'Seagrass_1', 'Seagrass_2'],
  },
  crafted: {
    rock: ['Rock'],
    brain: ['Coral_Brain'],
    branching: ['Coral_Branching'],
    seagrass: ['Seagrass_0', 'Seagrass_1', 'Seagrass_2'],
  },
};

export interface Placement {
  readonly position: Vec3;
  readonly yaw: number;
  /** Uniform scale applied to the model's largest dimension (metres), see `fitScale`. */
  readonly size: number;
  /** How far the model's lowest point is pressed below the sand (m). */
  readonly sink: number;
  /** Seagrass only: which clump template. */
  readonly template?: number;
}
export interface FishPlacement {
  readonly position: Vec3;
  readonly yaw: number;
  readonly scale: number;
  /** Phase of the tail stroke so the school is not in lockstep. */
  readonly phase: number;
}

/**
 * Every treatment's model is scaled so its largest dimension equals `size`, then grounded by the
 * same `sink`. Identical footprint and burial for every combination, whatever the source scale.
 */
export function fitScale(largestDimension: number, size: number): number {
  if (!(largestDimension > 0)) throw Error('Model has no extent');
  return size / largestDimension;
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function seagrassPatch(): Placement[] {
  const rand = seeded(62062);
  const out: Placement[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rand() * 0.5,
      r = i === 0 ? 0 : 0.25 + rand() * 0.55;
    out.push({
      position: [0.55 + Math.cos(a) * r, 0, 1.15 + Math.sin(a) * r * 0.7],
      yaw: rand() * Math.PI * 2,
      size: 0.55 + rand() * 0.25,
      sink: 0.02,
      template: i % 3,
    });
  }
  return out;
}

export const LAYOUT = {
  rock: { position: [-0.1, 0, -1.3], yaw: 0.35, size: 2.2, sink: 0.16 },
  brain: { position: [-1.75, 0, 0.15], yaw: 0.8, size: 1.15, sink: 0.05 },
  branching: { position: [1.75, 0, -0.55], yaw: 0.2, size: 1.8, sink: 0.08 },
  seagrass: seagrassPatch(),
  chromis: [
    { position: [1.55, 1.9, -0.3], yaw: 2.6, scale: 1, phase: 0 },
    { position: [1.95, 2.15, -0.75], yaw: 2.3, scale: 1, phase: 0.8 },
    { position: [1.2, 2.25, -0.85], yaw: 2.9, scale: 1, phase: 1.7 },
    { position: [2.15, 1.7, 0.05], yaw: 2.5, scale: 1, phase: 2.4 },
    { position: [1.7, 2.5, -0.2], yaw: 2.75, scale: 1, phase: 3.1 },
    { position: [1.35, 1.6, 0.2], yaw: 2.45, scale: 1, phase: 4.0 },
    { position: [2.3, 2.35, -0.5], yaw: 2.2, scale: 1, phase: 4.9 },
  ] satisfies FishPlacement[],
  clownfish: [
    { position: [-1.0, 0.75, 0.95], yaw: -0.55, scale: 0.8, phase: 0.4 },
  ] satisfies FishPlacement[],
} as const satisfies {
  rock: Placement;
  brain: Placement;
  branching: Placement;
  seagrass: readonly Placement[];
  chromis: readonly FishPlacement[];
  clownfish: readonly FishPlacement[];
};

export type ViewId = 'swimming' | 'medium' | 'close-brain' | 'close-staghorn';
export interface View {
  readonly id: ViewId;
  readonly distance: 'swimming' | 'medium' | 'close';
  readonly eye: Vec3;
  readonly target: Vec3;
}
/** The game's underwater camera field of view (UnderwaterScene). */
export const FOV = 64;
export const VIEWS: readonly View[] = [
  {
    id: 'swimming',
    distance: 'swimming',
    eye: [0.6, 2.3, 5.6],
    target: [0.1, 0.7, -0.6],
  },
  {
    id: 'medium',
    distance: 'medium',
    eye: [-0.2, 1.35, 2.9],
    target: [0.0, 0.7, -0.6],
  },
  {
    id: 'close-brain',
    distance: 'close',
    eye: [-0.85, 1.0, 1.75],
    target: [-1.6, 0.45, 0.1],
  },
  {
    id: 'close-staghorn',
    distance: 'close',
    eye: [0.6, 1.75, 1.35],
    target: [1.7, 1.35, -0.5],
  },
];

export interface Selection {
  readonly assets: Treatment;
  readonly lighting: Treatment;
  readonly view: ViewId;
  /** false hides the panel (captures). */
  readonly ui: boolean;
}

function treatment(value: string | null, fallback: Treatment): Treatment {
  return TREATMENTS.find((t) => t === value) ?? fallback;
}

/** `?assets=natural&lighting=baseline&view=medium&ui=0`; unknown values fall back. */
export function parseSelection(search: string): Selection {
  const q = new URLSearchParams(search);
  const assets = treatment(q.get('assets') ?? q.get('style'), 'baseline');
  const view = VIEWS.find((v) => v.id === q.get('view'))?.id ?? 'swimming';
  return {
    assets,
    lighting: treatment(q.get('lighting') ?? q.get('style'), assets),
    view,
    ui: q.get('ui') !== '0',
  };
}

/** Stroke influence for a fish at time t (s): a calm, fixed tail beat (deterministic). */
export function strokeAt(t: number, phase: number): number {
  return Math.sin(t * 2 * Math.PI * 0.9 + phase) * 0.55;
}
