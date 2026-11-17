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
  /** Full ocean volume for terrain and wildlife; the swimmer also has a viewing-edge limit. */
  bounds: {
    // Pass 026: deep enough for the wall below the reef's lip.
    min: { x: -60, y: -42, z: -140 },
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
  /**
   * Pass 026: distance fades to dark blue. Exponential fog towards the water colour, which matches the
   * water's horizon, so the blue past the reef's edge deepens with distance.
   */
  // Visibility hotfix: about 96% haze by 14 m, concealing distant detail changes.
  fog: 0.13,
  /** Render range ends deep in the haze; the ocean background stays continuous. */
  viewDistance: 25,
  /** Pass 026: the reef top is built this wide (m); it reaches further than you can swim. */
  reef: { minX: -44, maxX: 44 },
  /**
   * Pass 026: where swimming eases off (m). Outward movement slows smoothly over each band to
   * almost nothing, then stops: `past` beyond the reef's lip out over the blue, below `down` on
   * the wall, beyond `halfWidth` at the sides, and above `up`.
   */
  reach: {
    // v0.6 Pass 036: swimming eases only in the last couple of metres before the side glass.
    halfWidth: 29.5,
    side: 2.5,
    // Ease over the first metre, then settle through the 2 m stop band at the viewing edge.
    past: 1,
    down: -6,
    depth: 7,
    up: 12,
    rise: 5,
    /** The slowest speed (fraction of normal), held until the band's end, then easing to zero. */
    crawl: 0.06,
    stop: 2,
  },
  /**
   * v0.6 Pass 036: the outer reef is a display tank. Its back wall is a great pane of glass just
   * past the reef's lip, where the swimmer stops to watch the big animals pass in the blue
   * beyond; glass panes close its sides. `z` is the back glass, `halfWidth` the side glass (x),
   * and the panes reach from `bottom` (deep down the wall) to `top` (near the surface light).
   * Swimming eases over the last `ease` m before the glass and stops `gap` m from it.
   */
  glass: {
    z: -59.4,
    halfWidth: 32.5,
    bottom: -24,
    top: 18,
    ease: 1.4,
    gap: 0.45,
  },
  /** A narrow sand gully winding from the cliff to the lip; the rest is reef. */
  channel: { amplitude: 3, wavelength: 40, halfWidth: 2.2, depth: 0.5 },
  /** Pass 026: the lip of the wall, close to the tunnel, and the wall falling away into the deep. */
  dropOff: { start: -56, end: -62, depth: 38 },
  /** Beyond the wall's foot the bottom keeps falling away, out of sight in the dark. */
  abyss: { slope: 0.5, depth: 90 },
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
  // Pass 024: the dressed reef takes longer to prepare, so start sooner.
  preload: 15,
  release: 22,
  /** Seconds out of range before releasing (so passing by does not thrash). */
  releaseDelay: 4,
  /** Return to the tank: arrive this far outside the mouth, facing the room. */
  returnGap: 1.4,
  arrivalFade: 0.6,
} as const;

/**
 * v0.6 Pass 032: the second passage. A copy of the tank's crevice stands at the foot of the outer
 * reef's cliff, turned half round so the side that lies against the tank's back glass lies against
 * the cliff, and its mouth faces west, away from the tunnel. Past its threshold the swimmer
 * continues in the kelp forest's tunnel. Tank coordinates map to the outer waters as
 * x' = offset.x - x, y' = y + offset.y, z' = offset.z - z (a half turn about y, then a shift).
 */
export const CLEFT = {
  offset: { x: -9, y: -0.3, z: -44.1 },
  /** Load the kelp forest within this distance of the cleft's mouth; release it beyond the second. */
  preload: 15,
  release: 22,
} as const;
/** A point from the tank's crevice coordinates into the outer waters (in place into `out`). */
export function cleftFromTank(p: Vec3, out: Vec3): Vec3 {
  const x = p.x,
    z = p.z;
  out.x = CLEFT.offset.x - x;
  out.y = p.y + CLEFT.offset.y;
  out.z = CLEFT.offset.z - z;
  return out;
}
/** A point from the outer waters back into the tank's crevice coordinates (the same half turn). */
export function cleftToTank(p: Vec3, out: Vec3): Vec3 {
  const x = p.x,
    z = p.z;
  out.x = CLEFT.offset.x - x;
  out.y = p.y - CLEFT.offset.y;
  out.z = CLEFT.offset.z - z;
  return out;
}
/** The cleft's threshold in the outer waters: the crevice threshold, turned with it. */
export const CLEFT_FRAME: PassageFrame = {
  origin: {
    x: CLEFT.offset.x - CREVICE_FRAME.origin.x,
    y: CREVICE_FRAME.origin.y + CLEFT.offset.y,
    z: CLEFT.offset.z - CREVICE_FRAME.origin.z,
  },
  forward: { x: -CREVICE_FRAME.forward.x, z: -CREVICE_FRAME.forward.z },
};

/**
 * v0.6 Pass 032: the kelp forest. Its tunnel starts at the cleft's threshold (the same cross-section
 * and more) and runs south through a rock wall at `wallZ` into the forest. Metres, y up; the
 * forest floor is near y 0 and the surface far above.
 */
export const KELP = {
  bounds: {
    min: { x: -48, y: -3, z: -100 },
    max: { x: 48, y: 26, z: 4 },
    clearance: 0.65,
  } satisfies Bounds,
  /** The tunnel: start (capped behind), axis height, radius and the wall it opens through. */
  tunnel: { startZ: 1.6, y: 5, radius: 1.45, wallZ: -8 },
  /** The sunlit surface, where the kelp spreads its canopy. */
  surfaceY: 22,
  /** Greener, thicker water than the reef: about 15 m of visibility. */
  fog: 0.055,
  water: 0x3a6f62,
  /**
   * v0.6 Pass 036: the forest is a display tank. Rock walls, fronted by a dense band of kelp,
   * close its sides at x ±`walls.x` and its far end at z `walls.farZ`, from the seabed up past the
   * surface; the tunnel's wall closes the near end.
   */
  // v0.6 Pass 041: a smaller tank, about 48 m wide and 50 m deep.
  walls: { x: 24, farZ: -60 },
  /** Where swimming eases to a hover, short of the walls. */
  reach: {
    halfWidth: 18.5,
    side: 2,
    far: -54.5,
    past: 2,
    up: 17,
    rise: 4,
    down: 0.6,
  },
  /** The kelp grows over rock from the wall to the far edge, leaving a sandy lane for the rays. */
  forest: {
    // v0.6 Pass 036: inside the walls.
    minZ: -57,
    maxZ: -11,
    halfWidth: 21,
    lane: { x: 8, halfWidth: 4.5 },
  },
} as const;
/** The kelp tunnel's start, matching the cleft's threshold. */
export const KELP_FRAME: PassageFrame = {
  origin: { x: 0, y: KELP.tunnel.y, z: 0 },
  forward: { x: 0, z: -1 },
};

/**
 * v0.6 Pass 034: the third passage. Another copy of the tank's crevice stands against the kelp
 * forest's rock wall, east of its tunnel and hidden among the kelp: turned half round, as the
 * cleft is, so its glass side lies against the wall and its mouth faces west. Past its threshold
 * the swimmer continues in the sea cave's tunnel. Tank coordinates map to the kelp forest as
 * x' = offset.x - x, y' = y + offset.y, z' = offset.z - z.
 */
export const GROTTO = {
  // v0.6 Pass 041: moved in with the smaller forest's east wall.
  offset: { x: 21.5, y: 1.2, z: -22.1 },
  /** Load the sea cave within this distance of the grotto's mouth; release it beyond the second. */
  preload: 15,
  release: 22,
  /** Kelp and boulders keep out of this area (the outcrop and the water before its mouth). */
  clear: { minX: 12, maxX: 23.5, z: -14.5 },
} as const;
/** A point from the tank's crevice coordinates into the kelp forest (in place into `out`). */
export function grottoFromTank(p: Vec3, out: Vec3): Vec3 {
  const x = p.x,
    z = p.z;
  out.x = GROTTO.offset.x - x;
  out.y = p.y + GROTTO.offset.y;
  out.z = GROTTO.offset.z - z;
  return out;
}
/** A point from the kelp forest back into the tank's crevice coordinates (the same half turn). */
export function grottoToTank(p: Vec3, out: Vec3): Vec3 {
  const x = p.x,
    z = p.z;
  out.x = GROTTO.offset.x - x;
  out.y = p.y - GROTTO.offset.y;
  out.z = GROTTO.offset.z - z;
  return out;
}
/** The grotto's threshold in the kelp forest: the crevice threshold, turned with it. */
export const GROTTO_FRAME: PassageFrame = {
  origin: {
    x: GROTTO.offset.x - CREVICE_FRAME.origin.x,
    y: CREVICE_FRAME.origin.y + GROTTO.offset.y,
    z: GROTTO.offset.z - CREVICE_FRAME.origin.z,
  },
  forward: { x: -CREVICE_FRAME.forward.x, z: -CREVICE_FRAME.forward.z },
};

/**
 * v0.6 Pass 034: the sea cave. Its tunnel starts at the grotto's threshold and runs south into a
 * dome-shaped limestone cavern, lit from above by a shaft of sunlight through a hole in its roof.
 * Metres, y up; the cave's sand floor is near y 0.
 */
export const CAVE = {
  bounds: {
    min: { x: -22, y: -2, z: -46 },
    max: { x: 22, y: 18, z: 4 },
    clearance: 0.65,
  } satisfies Bounds,
  /** The tunnel: start (capped behind), axis height, radius, and where it opens into the cavern. */
  tunnel: { startZ: 1.6, y: 3, radius: 1.45, openZ: -9.5 },
  /** The cavern: an uneven dome, its centre and radii (m). */
  /**
   * v0.6 Pass 036: tank-sized, and boxy like a tank (a rounded box, `squareness` 2 being an
   * ellipsoid): about 36 m wide, 28 m deep and 12 m from the sand to its rock roof.
   */
  chamber: { x: 0, y: 5, z: -23, rx: 18, ry: 8, rz: 14, squareness: 4 },
  /**
   * Swimming towards the wall eases off from `inset` m away, slows to a crawl over `band` m, then
   * stops within 2 m more: about a metre short of the rock.
   */
  ease: { inset: 4.2, band: 1.2 },
  /** The hole in the roof, and the sunlit water seen through it. */
  skylight: { x: 3.5, z: -27, radius: 2.4 },
  /**
   * v0.6 Pass 046: a second tunnel, through the back wall between the boulders there, to the waters
   * under the ice: its axis (x, y), radius, and where it ends (its threshold, z).
   */
  backTunnel: { x: -3, y: 3.2, radius: 1.45, endZ: -42 },
  /** Dim blue-green water: about 12 m of visibility, darker than the kelp forest. */
  // v0.6 Pass 036: clear enough to see the far walls and the roof all round.
  fog: 0.042,
  water: 0x1a4550,
} as const;
/** v0.6 Pass 046: the threshold at the end of the cave's back tunnel, to the waters under the ice. */
export const ICE_GATE_FRAME: PassageFrame = {
  origin: {
    x: CAVE.backTunnel.x,
    y: CAVE.backTunnel.y,
    z: CAVE.backTunnel.endZ,
  },
  forward: { x: 0, z: -1 },
};

/**
 * v0.6 Pass 046: under the ice, an Antarctic dive, reached through the sea cave's back tunnel. A
 * display tank the size of the kelp forest: icebergs for its side and far walls, a sheet of sea ice
 * for its roof with breathing holes where the light falls through, a rocky near wall that the
 * tunnel opens through, and a pale garden of sponges, soft corals and anemones on the seabed.
 * Metres, y up; the seabed is near y 0.
 */
export const ICE = {
  bounds: {
    min: { x: -28, y: -2, z: -66 },
    max: { x: 28, y: 20, z: 4 },
    clearance: 0.65,
  } satisfies Bounds,
  /** The tunnel: start (capped behind), axis height, radius and the rock wall it opens through. */
  tunnel: { startZ: 1.6, y: 4, radius: 1.45, wallZ: -8 },
  /** Iceberg walls at x ±`x` and the far end at z `farZ`; the underside of the sea ice at `ceiling`. */
  walls: { x: 24, farZ: -60 },
  ceiling: 15,
  /** Breathing holes in the ice: where the light falls through, and the seals come up to breathe. */
  holes: [
    { x: -6, z: -28, r: 2.2 },
    { x: 9, z: -42, r: 1.8 },
    { x: -13, z: -50, r: 1.6 },
  ],
  /**
   * Swimming eases to a hover from `inset` m short of the walls and `up` m below the ice, slowing to
   * a crawl over `band` m, then stopping within 2 m more: about 2 m short of the ice.
   */
  ease: { inset: 5, band: 1.2, up: 5.7 },
  /** Very clear, cold blue water: the far icebergs show faintly at the end of the tank. */
  fog: 0.026,
  water: 0x1d4f78,
} as const;
/** The tunnel's start under the ice, matching the cave's back threshold. */
export const ICE_FRAME: PassageFrame = {
  origin: { x: 0, y: ICE.tunnel.y, z: 0 },
  forward: { x: 0, z: -1 },
};

/** The sea cave tunnel's start, matching the grotto's threshold. */
export const CAVE_FRAME: PassageFrame = {
  origin: { x: 0, y: CAVE.tunnel.y, z: 0 },
  forward: { x: 0, z: -1 },
};
