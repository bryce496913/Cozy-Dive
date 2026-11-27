import type { AssetId } from '../../assets/AssetRegistry';

export type LargeFamily =
  | 'shark'
  | 'ray'
  | 'turtle'
  | 'whale'
  | 'pinniped'
  | 'penguin'
  | 'otter'
  | 'bear'
  | 'sunfish';

export interface LargeCreatureDesign {
  readonly asset: AssetId;
  readonly family: LargeFamily;
  readonly target: number;
  readonly depth: number;
  readonly width: number;
  readonly snout: number;
  readonly tail: number;
  readonly appendage: number;
  readonly palette: readonly [string, string, string, string];
  readonly markings:
    | 'counter'
    | 'blacktips'
    | 'tips'
    | 'spots'
    | 'saddles'
    | 'orca'
    | 'penguin'
    | 'mottled';
}

/** Pass 019's semantic inventory. Each entry is an independent body plan even where animals
 * share a locomotor family. Target is the largest rest-pose dimension in authored metres. */
export const LARGE_CREATURES = {
  reefShark: {
    family: 'shark',
    target: 2.9,
    depth: 0.18,
    width: 0.13,
    snout: 0.08,
    tail: 0.26,
    appendage: 0.22,
    palette: ['#647d82', '#b9c6bd', '#30484e', '#d7d8c8'],
    markings: 'blacktips',
  },
  whitetipShark: {
    family: 'shark',
    target: 2.9,
    depth: 0.16,
    width: 0.12,
    snout: 0.06,
    tail: 0.25,
    appendage: 0.2,
    palette: ['#6f7772', '#c7c5b6', '#343c3b', '#ece6d2'],
    markings: 'tips',
  },
  greatWhite: {
    family: 'shark',
    target: 3.05,
    depth: 0.25,
    width: 0.18,
    snout: 0.13,
    tail: 0.3,
    appendage: 0.24,
    palette: ['#67757a', '#e0ddd0', '#2f3d42', '#f2ead8'],
    markings: 'counter',
  },
  hammerhead: {
    family: 'shark',
    target: 3.05,
    depth: 0.15,
    width: 0.14,
    snout: 0.25,
    tail: 0.28,
    appendage: 0.25,
    palette: ['#6e8582', '#c6c8b8', '#314b4a', '#d9d7c4'],
    markings: 'counter',
  },
  scallopedHammerhead: {
    family: 'shark',
    target: 3.05,
    depth: 0.14,
    width: 0.13,
    snout: 0.23,
    tail: 0.27,
    appendage: 0.2,
    palette: ['#718783', '#c5c8b9', '#344c4a', '#d9d7c4'],
    markings: 'counter',
  },
  leopardShark: {
    family: 'shark',
    target: 1.65,
    depth: 0.13,
    width: 0.1,
    snout: 0.07,
    tail: 0.3,
    appendage: 0.16,
    palette: ['#9a8c69', '#d0c6a8', '#4d493b', '#2f3936'],
    markings: 'saddles',
  },
  nurseShark: {
    family: 'shark',
    target: 2.65,
    depth: 0.14,
    width: 0.17,
    snout: 0.12,
    tail: 0.22,
    appendage: 0.14,
    palette: ['#80745e', '#b9ad8d', '#4d493e', '#d2c29b'],
    markings: 'mottled',
  },
  whaleShark: {
    family: 'shark',
    target: 3.05,
    depth: 0.2,
    width: 0.21,
    snout: 0.19,
    tail: 0.28,
    appendage: 0.18,
    palette: ['#526c73', '#9aa9a1', '#243c44', '#d6d6bd'],
    markings: 'spots',
  },
  eagleRay: {
    family: 'ray',
    target: 4.35,
    depth: 0.08,
    width: 0.46,
    snout: 0.12,
    tail: 0.55,
    appendage: 0.46,
    palette: ['#536b70', '#d3c9ad', '#243d47', '#e5dbbd'],
    markings: 'spots',
  },
  batRay: {
    family: 'ray',
    target: 3.7,
    depth: 0.09,
    width: 0.42,
    snout: 0.06,
    tail: 0.46,
    appendage: 0.43,
    palette: ['#413f3b', '#b8ab91', '#252a29', '#d2c3a1'],
    markings: 'mottled',
  },
  mantaRay: {
    family: 'ray',
    target: 4.8,
    depth: 0.09,
    width: 0.49,
    snout: 0.18,
    tail: 0.3,
    appendage: 0.52,
    palette: ['#354b55', '#d1cbb9', '#182d36', '#eee2ca'],
    markings: 'counter',
  },
  seaTurtle: {
    family: 'turtle',
    target: 2.15,
    depth: 0.22,
    width: 0.31,
    snout: 0.11,
    tail: 0.08,
    appendage: 0.38,
    palette: ['#617257', '#c7b990', '#35483d', '#8e825d'],
    markings: 'mottled',
  },
  sunfish: {
    family: 'sunfish',
    target: 1.85,
    depth: 0.48,
    width: 0.12,
    snout: 0.08,
    tail: 0.06,
    appendage: 0.31,
    palette: ['#74878a', '#b9bbb0', '#3e5559', '#d2cbb7'],
    markings: 'mottled',
  },
  humpbackWhale: {
    family: 'whale',
    target: 3.05,
    depth: 0.24,
    width: 0.2,
    snout: 0.18,
    tail: 0.34,
    appendage: 0.45,
    palette: ['#344b55', '#9ca9a5', '#172d36', '#d4d1bd'],
    markings: 'mottled',
  },
  minkeWhale: {
    family: 'whale',
    target: 3.05,
    depth: 0.21,
    width: 0.17,
    snout: 0.13,
    tail: 0.3,
    appendage: 0.22,
    palette: ['#415962', '#c5c8bd', '#203840', '#e3dfcc'],
    markings: 'counter',
  },
  killerWhale: {
    family: 'whale',
    target: 3.05,
    depth: 0.25,
    width: 0.19,
    snout: 0.13,
    tail: 0.32,
    appendage: 0.24,
    palette: ['#172b31', '#e8e3d5', '#0c1c22', '#b8c2bd'],
    markings: 'orca',
  },
  seaLion: {
    family: 'pinniped',
    target: 2.25,
    depth: 0.24,
    width: 0.2,
    snout: 0.12,
    tail: 0.1,
    appendage: 0.31,
    palette: ['#6d503d', '#aa8866', '#352f29', '#c2a17b'],
    markings: 'counter',
  },
  harbourSeal: {
    family: 'pinniped',
    target: 1.72,
    depth: 0.25,
    width: 0.22,
    snout: 0.08,
    tail: 0.12,
    appendage: 0.18,
    palette: ['#7d837d', '#b7b6aa', '#414b49', '#d0cbb8'],
    markings: 'spots',
  },
  weddellSeal: {
    family: 'pinniped',
    target: 2.8,
    depth: 0.27,
    width: 0.24,
    snout: 0.07,
    tail: 0.12,
    appendage: 0.17,
    palette: ['#77766f', '#b9b4a5', '#3e4748', '#d5cdb8'],
    markings: 'mottled',
  },
  weddellSealPup: {
    family: 'pinniped',
    target: 1.45,
    depth: 0.3,
    width: 0.27,
    snout: 0.06,
    tail: 0.1,
    appendage: 0.15,
    palette: ['#9ba3a6', '#d4d0c3', '#596567', '#eee6d1'],
    markings: 'mottled',
  },
  leopardSeal: {
    family: 'pinniped',
    target: 3.1,
    depth: 0.2,
    width: 0.18,
    snout: 0.12,
    tail: 0.16,
    appendage: 0.18,
    palette: ['#6d7876', '#b7b7aa', '#374746', '#d0c9b4'],
    markings: 'spots',
  },
  emperorPenguin: {
    family: 'penguin',
    target: 1.28,
    depth: 0.34,
    width: 0.25,
    snout: 0.15,
    tail: 0.08,
    appendage: 0.3,
    palette: ['#1d3035', '#e5dfcf', '#d2a34a', '#0d2026'],
    markings: 'penguin',
  },
  adeliePenguin: {
    family: 'penguin',
    target: 0.78,
    depth: 0.37,
    width: 0.27,
    snout: 0.12,
    tail: 0.08,
    appendage: 0.28,
    palette: ['#203238', '#e8e2d3', '#9da3a0', '#102229'],
    markings: 'penguin',
  },
  seaOtter: {
    family: 'otter',
    target: 1.3,
    depth: 0.21,
    width: 0.18,
    snout: 0.09,
    tail: 0.29,
    appendage: 0.13,
    palette: ['#58483a', '#9d8267', '#2d2a26', '#c7ad8b'],
    markings: 'counter',
  },
  polarBear: {
    family: 'bear',
    target: 2.65,
    depth: 0.3,
    width: 0.24,
    snout: 0.13,
    tail: 0.05,
    appendage: 0.2,
    palette: ['#d8d5c7', '#eee9d8', '#aaa99f', '#303a3b'],
    markings: 'mottled',
  },
} as const satisfies Record<string, Omit<LargeCreatureDesign, 'asset'>>;

export type LargeCreatureId = keyof typeof LARGE_CREATURES;
export const LARGE_CREATURE_IDS = Object.keys(
  LARGE_CREATURES,
) as LargeCreatureId[];
export const largeCreatureDesign = (
  id: LargeCreatureId,
): LargeCreatureDesign => ({
  asset: id,
  ...LARGE_CREATURES[id],
});
