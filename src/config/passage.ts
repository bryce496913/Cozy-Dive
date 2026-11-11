import type { Bounds, Vec3 } from './world';

/**
 * v0.4 Pass 023: the hidden passage. A crack in a rock outcrop against the tank's back glass leads
 * into a dark channel; past a threshold deep inside it, the swimmer continues in the outer waters'
 * tunnel, which begins with the same cross-section. Shared by the tank, the outer waters, the
 * passage logic and tests.
 */
/** A portal frame: an origin on the channel axis and the direction into the passage. */
export interface PassageFrame {
  readonly origin: Vec3;
  /** Horizontal unit direction pointing deeper into the passage. */
  readonly forward: { readonly x: number; readonly z: number };
}

export const CREVICE = {
  /**
   * The channel runs along -x inside an outcrop in the back-right corner, opening on its +x face
   * into the narrow alley between the right bank's rocks and the back glass. The outcrop stays
   * east of x 0.75, so the central sand channel stays clear along its whole length.
   */
  mouthX: 5.0,
  endX: 1.6,
  centre: { y: 1.6, z: -12.1 },
  /** Channel half-height and half-depth (m, before the swimmer's radius). */
  halfHeight: 1.0,
  halfDepth: 0.95,
  /** Outcrop extent (the rock mass around the channel). */
  outcrop: { minX: 0.75, maxX: 5.7, maxY: 4.3, minZ: -14, maxZ: -10.1 },
} as const;

/** The threshold deep in the channel where the swimmer passes into the outer waters. */
export const CREVICE_FRAME: PassageFrame = {
  origin: { x: 2.6, y: CREVICE.centre.y, z: CREVICE.centre.z },
  forward: { x: -1, z: 0 },
};

export const OUTER = {
  /** The outer waters' swimmable volume. */
  bounds: {
    min: { x: -60, y: 0, z: -130 },
    max: { x: 60, y: 40, z: 3 },
    clearance: 0.65,
  } satisfies Bounds,
  /** Where the tunnel leaves the cliff into open water (z), and the tunnel's radius (m). */
  cliffZ: -30,
  tunnelRadius: 1.45,
  /** Tunnel centreline control points, from its dark start to the cliff. */
  tunnel: [
    { x: 0, y: 9, z: 1.6 },
    { x: 0, y: 9, z: 0 },
    { x: 0.6, y: 8.8, z: -6 },
    { x: 2.4, y: 8.3, z: -12 },
    { x: 1.2, y: 7.6, z: -18 },
    { x: -1.4, y: 7.2, z: -24 },
    { x: -0.6, y: 7, z: -30 },
    { x: 0, y: 7, z: -33 },
  ] as readonly Vec3[],
  /** Sand level and the water surface far above. */
  floorY: 0,
  fog: 0.018,
} as const;

/** The tunnel's start, matching the crevice threshold. */
export const TUNNEL_FRAME: PassageFrame = {
  origin: OUTER.tunnel[1],
  forward: { x: 0, z: -1 },
};

export const PASSAGE = {
  /** Swap only this far past the threshold, either way (hysteresis, m). */
  hysteresis: 0.05,
  /** Darkness peaks at the threshold and clears this far either side of it (m). */
  darkReach: 3.2,
  darkPeak: 0.94,
  /** Load the outer waters within this distance of the mouth; release them beyond the second. */
  preload: 11,
  release: 17,
  /** Seconds out of range before releasing (so passing by does not thrash). */
  releaseDelay: 4,
  /** Return to the tank: arrive this far outside the mouth, facing the room. */
  returnGap: 1.4,
  arrivalFade: 0.6,
} as const;
