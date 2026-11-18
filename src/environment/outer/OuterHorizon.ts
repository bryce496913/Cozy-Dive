import { OUTER } from '../../config/passage';
import {
  Horizon,
  pinnacleGeometry,
  ridgeGeometry,
  type PasserPath,
} from '../shared/Horizon';

/**
 * v0.6 Pass 053 (open-ocean freedom): what lies beyond the outer reef, faintly, in the blue.
 *   - out past the wall: a scatter of seamount pinnacles rising from the deep, and a far ridge;
 *   - to either side: more reef, as low ridges running on along the wall's line, past where
 *     the swimmer eases to a hover;
 *   - passing far out: a whale, a manta and a school, on long slow paths at the edge of sight.
 * Nothing is placed within `clear` m of anywhere the swimmer can go. Pure layout (the `Horizon`
 * draws it).
 */
export const OUTER_HORIZON = {
  /** Nothing nearer than this to the swimmer's reachable space (m). */
  clear: 16,
  /** A dark shade of the blue, and how faint (0..1). */
  colour: 0x0a2f48,
  opacity: 0.2,
} as const;

type Placement = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
};
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function outerHorizon(): {
  silhouettes: {
    geometry: (seed: number) => import('three').BufferGeometry;
    at: Placement[];
  }[];
  passers: PasserPath[];
} {
  const rand = random(53101),
    g = OUTER.glass,
    pinnacles: Placement[] = [],
    ridges: Placement[] = [];
  // Seamount pinnacles out in the deep beyond the wall, at varied distances and heights.
  for (let i = 0; i < 14; i++) {
    const x = -70 + (i / 13) * 140 + (rand() - 0.5) * 8,
      z = g.z - 28 - rand() * 40,
      // From the deep (about 44 m down) to between 12 m below and 4 m above the reef top.
      h = 32 + rand() * 16,
      r = 4 + rand() * 7;
    pinnacles.push({
      x,
      y: -OUTER.dropOff.depth - 6,
      z,
      sx: r,
      sy: h,
      sz: r,
      yaw: rand() * 6.3,
    });
  }
  // A long far ridge across the deep.
  ridges.push({
    x: 0,
    y: -OUTER.dropOff.depth,
    z: g.z - 85,
    sx: 220,
    sy: 24,
    sz: 30,
    yaw: 0,
  });
  // The reef running on to either side, along the wall's line, past the swimmer's reach.
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const x = side * (OUTER.glass.halfWidth + 20 + k * 16);
      ridges.push({
        x,
        y: -1.5,
        z: -44 - k * 4 + (rand() - 0.5) * 6,
        sx: 22,
        sy: 4 + rand() * 3,
        sz: 18 + rand() * 6,
        yaw: Math.PI / 2 + (rand() - 0.5) * 0.4,
      });
    }
  const passers: PasserPath[] = [
    // A whale, far out and slow, the long way round.
    {
      kind: 'whale',
      centre: { x: 0, y: 4, z: g.z - 70 },
      rx: 75,
      rz: 18,
      speed: 0.012,
      scale: 14,
      phase: 0.6,
    },
    // A manta, gliding along a nearer but still distant path.
    {
      kind: 'manta',
      centre: { x: 10, y: -2, z: g.z - 40 },
      rx: 50,
      rz: 8,
      speed: -0.02,
      scale: 5,
      phase: 2.4,
    },
    // A school, out past the side of the reef.
    {
      kind: 'school',
      centre: { x: -60, y: 2, z: -60 },
      rx: 10,
      rz: 14,
      speed: 0.03,
      scale: 9,
      phase: 1.1,
    },
  ];
  return {
    silhouettes: [
      { geometry: pinnacleGeometry, at: pinnacles },
      { geometry: ridgeGeometry, at: ridges },
    ],
    passers,
  };
}

/** The outer reef's horizon, ready to add to its scene. */
export function createOuterHorizon(): Horizon {
  const h = outerHorizon();
  return new Horizon(
    'Outer reef horizon',
    { colour: OUTER_HORIZON.colour, opacity: OUTER_HORIZON.opacity },
    h.silhouettes,
    h.passers,
  );
}
