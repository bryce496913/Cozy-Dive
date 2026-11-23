import type { Bounds } from './world';
import { DENSE_WATER_FOG } from './waterVisibility';
import type { PassageFrame } from './passage';

/**
 * The shipwreck: a new world, reached down a dark sinkhole hidden in the kelp forest, under a rock ledge. The
 * shaft drops about 16 m, darkening; past its threshold the swimmer continues down the same shaft
 * through the roof of a great, dim flooded cavern, coming out about 10 m above the deck of an old
 * steel freighter lying upright on its sandy floor. The hold (through the deck hatch or a breach
 * in the starboard side) and the bridge (through its door) can be explored; inside them it is dark,
 * and a torch comes on by itself. Metres, y up; the ship lies along z with its bow towards -z.
 */
export const SINKHOLE = {
  /**
   * The hole: tucked against a tall boulder deep in the kelp, off the open lane, half under a rock
   * ledge; its shaft's radius, and how deep its threshold is.
   */
  x: -10.4,
  z: -47.1,
  radius: 1.6,
  threshold: -16,
  /** The shaft's dark bottom (it never needs to be reached), and its rock's thickness. */
  bottom: -21,
  wall: 1.2,
  /** The sand slumps into it: this deep at the shaft's lip (m), over this width (m). */
  funnel: { depth: 0.7, width: 1.4 },
  /** Load the wreck when this near the hole's mouth (m), let it go beyond `release`. */
  preload: 15,
  release: 22,
} as const;

export const WRECK = {
  bounds: {
    // Short of the rock walls (their faces bulge outwards from x ±26, z -1 and -63).
    min: { x: -25.4, y: -2, z: -62.4 },
    max: { x: 25.4, y: 30, z: -1.6 },
    clearance: 0.65,
  } satisfies Bounds,
  /** The cavern: rock walls at x ±`walls.x` and z `walls.nearZ` / `walls.farZ`; its roof. */
  walls: { x: 26, nearZ: -1, farZ: -63 },
  ceiling: 17,
  /** The shaft in the roof: centred over the deck, between the hatch and the bridge. */
  shaft: { x: 0, z: -26.5, threshold: 25, top: 29 },
  /** Soft limits: easing begins `inset` m short of a wall (or `up` under the roof). */
  ease: { inset: 2.5, band: 1.2, up: 1.4 },
  /**
   * V0.8 Pass 089: the outer reef's dense murk (`DENSE_WATER_FOG`), in the wreck's own dark
   * blue-green water: the ship emerges from the gloom as the swimmer approaches. (Was 0.045,
   * about 20 m of visibility.)
   */
  fog: DENSE_WATER_FOG,
  water: 0x12323c,
  /** Inside the wreck: how dark it gets (0..1), and how fast it darkens and clears (per s). */
  darkness: 0.9,
  dim: 1.6,
  /** The swimmer's torch: brightness, reach (m), cone (radians) and its soft edge. */
  torch: { intensity: 9, distance: 18, angle: 0.48, penumbra: 0.55 },
} as const;

/** The kelp forest's end of the passage: the sinkhole's threshold. */
export const SINKHOLE_FRAME: PassageFrame = {
  origin: { x: SINKHOLE.x, y: SINKHOLE.threshold, z: SINKHOLE.z },
  forward: { x: 0, z: -1 },
};
/** The wreck's end: the same threshold, high in the shaft above the cavern's roof. */
export const WRECK_FRAME: PassageFrame = {
  origin: { x: WRECK.shaft.x, y: WRECK.shaft.threshold, z: WRECK.shaft.z },
  forward: { x: 0, z: -1 },
};
