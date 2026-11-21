/**
 * V0.7 Pass 077: the structural primaries of the three branching coral colonies, in colony
 * metres (origin at the base, +y up). Each primary is one convex collider (a tapered capsule,
 * 0.09 m at its start and 0.045 m at its end); finer growth beyond them is passable. The tank
 * builds its colliders from these, and the Blender reef library grows its colonies along the same
 * primaries (through `tools/art/pass014/baseline.json`), so collision and art agree.
 *
 * Each archetype keeps five primaries (one random draw each, so placement downstream is
 * unchanged) but replaces the old shared 1.8 m single-trunk frame with a natural growth form.
 */
export type ColonySegment = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
];
export interface BranchingColony {
  readonly archetype:
    'spreading-thicket' | 'asymmetric-head' | 'tabular-digitate';
  readonly primaries: readonly ColonySegment[];
}
export const BRANCHING_COLONIES: readonly BranchingColony[] = [
  {
    // Staghorn-like thicket: low, broad, primaries splaying out from one encrusting base.
    archetype: 'spreading-thicket',
    primaries: [
      [
        [0.02, 0.02, 0],
        [0.66, 0.52, 0.12],
      ],
      [
        [-0.02, 0.02, 0.02],
        [-0.6, 0.6, 0.3],
      ],
      [
        [0.02, 0.03, -0.02],
        [0.16, 0.68, -0.62],
      ],
      [
        [-0.02, 0.02, -0.02],
        [-0.4, 0.48, -0.52],
      ],
      [
        [0.02, 0.05, 0.03],
        [0.2, 0.82, 0.55],
      ],
    ],
  },
  {
    // Lopsided corymbose head: two short stems that fork into a canopy leaning to one side.
    archetype: 'asymmetric-head',
    primaries: [
      [
        [0.08, 0, -0.02],
        [0.22, 0.5, 0.02],
      ],
      [
        [-0.08, 0, 0.05],
        [-0.26, 0.42, 0.14],
      ],
      [
        [0.2, 0.46, 0.02],
        [0.6, 0.86, 0.14],
      ],
      [
        [-0.24, 0.4, 0.14],
        [-0.46, 0.76, 0.42],
      ],
      [
        [0.18, 0.44, 0.0],
        [0.3, 0.96, -0.4],
      ],
    ],
  },
  {
    // Tabular colony: a short stalk under near-horizontal arms that carry upright digits.
    archetype: 'tabular-digitate',
    primaries: [
      [
        [0, 0, 0],
        [0.04, 0.36, 0],
      ],
      [
        [0.04, 0.34, 0],
        [0.78, 0.5, 0.1],
      ],
      [
        [0.02, 0.34, 0.02],
        [-0.7, 0.46, 0.26],
      ],
      [
        [0.04, 0.34, -0.02],
        [0.12, 0.48, -0.76],
      ],
      [
        [0.02, 0.34, 0.02],
        [-0.18, 0.52, 0.72],
      ],
    ],
  },
];
