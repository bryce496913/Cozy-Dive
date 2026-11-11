import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import { channelWeight, dropWeight, seabedHeight } from './OuterTerrain';

/**
 * v0.4 Pass 024: where the outer reef's pieces go. Pure and seeded: coral heads (rock mounds
 * crowned with coral, with soft corals and sea fans on their flanks), lone corals on the sand,
 * seagrass meadows beside the channel, rubble and shells, a line of reef along the drop-off and
 * a rocky wall below it, and big low-detail rocks framing the sides. The reef library's pieces
 * are dressed onto these placements at runtime.
 */
export type ReefFamily =
  | 'rock'
  | 'backdrop'
  | 'branching'
  | 'massive'
  | 'plate'
  | 'soft'
  | 'fan'
  | 'grass'
  | 'blade'
  | 'shell'
  | 'rubble';
export interface ReefPlacement {
  readonly family: ReefFamily;
  readonly template: number;
  readonly position: Vec3;
  readonly yaw: number;
  readonly scale: Vec3;
}
/** Library template counts per family. */
export const REEF_TEMPLATES: Readonly<Record<ReefFamily, number>> = {
  rock: 6,
  backdrop: 6,
  branching: 3,
  massive: 3,
  plate: 3,
  soft: 3,
  fan: 3,
  grass: 3,
  blade: 3,
  shell: 3,
  rubble: 2,
};
/** Rock templates are centred and about ±0.85 units in each direction. */
export const ROCK_HALF = 0.85;

export const OUTER_REEF = {
  seed: 23024,
  heads: 11,
  headSpacing: 13,
  /** Keep the open water right below the tunnel mouth clear (x half-width, z extent). */
  mouthClear: { halfWidth: 7, depth: 12 },
  sandCorals: 12,
  meadows: 6,
  bladesPerMeadow: 70,
  debris: 320,
  edgeStep: 5.5,
  backdropStep: 9,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const nearMouth = (x: number, z: number): boolean =>
  Math.abs(x) < OUTER_REEF.mouthClear.halfWidth &&
  z > OUTER.cliffZ - OUTER_REEF.mouthClear.depth;
/** Where reef structure may stand: inside the comfortable reef, off the channel and the mouth. */
export function buildable(x: number, z: number, margin = 0): boolean {
  const r = OUTER.reef;
  return (
    x > r.minX + margin &&
    x < r.maxX - margin &&
    z < OUTER.cliffZ - 2 - margin &&
    z > OUTER.dropOff.start + margin &&
    channelWeight(x, z) < 0.25 &&
    !nearMouth(x, z)
  );
}

/** The coral heads' centres (seabed level), in the order they were placed. */
export interface ReefLayout {
  readonly placements: ReefPlacement[];
  readonly heads: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[];
}
export function outerReefLayout(seed = OUTER_REEF.seed): ReefLayout {
  const rand = random(seed),
    out: ReefPlacement[] = [];
  const range = (a: number, b: number) => a + (b - a) * rand();
  const pick = (n: number) => Math.min(n - 1, Math.floor(rand() * n));
  const add = (
    family: ReefFamily,
    x: number,
    y: number,
    z: number,
    scale: number | Vec3,
    yaw = rand() * Math.PI * 2,
  ) =>
    out.push({
      family,
      template: pick(REEF_TEMPLATES[family]),
      position: { x, y, z },
      yaw,
      scale:
        typeof scale === 'number' ? { x: scale, y: scale, z: scale } : scale,
    });
  /** A rock half-buried in the sand; returns the height of its crown. */
  const rock = (x: number, z: number, size: number, height: number) => {
    const ground = seabedHeight(x, z),
      y = ground + ROCK_HALF * height * 0.4;
    add('rock', x, y, z, { x: size, y: height, z: size * range(0.75, 1.1) });
    return y + ROCK_HALF * height * 0.8;
  };
  // Weighted towards massive colonies (light far level); plates have no far level, so fewer.
  const coral = (x: number, y: number, z: number, scale: number) => {
    const r = rand();
    add(
      r < 0.45 ? 'massive' : r < 0.85 ? 'branching' : 'plate',
      x,
      y,
      z,
      scale,
    );
  };

  // Coral heads.
  const heads: { x: number; z: number }[] = [];
  for (
    let tries = 0;
    heads.length < OUTER_REEF.heads && tries < 2000;
    tries++
  ) {
    const x = range(OUTER.reef.minX + 6, OUTER.reef.maxX - 6),
      z = range(OUTER.dropOff.start + 8, OUTER.cliffZ - 10);
    if (!buildable(x, z, 4)) continue;
    if (
      heads.some((h) => Math.hypot(h.x - x, h.z - z) < OUTER_REEF.headSpacing)
    )
      continue;
    heads.push({ x, z });
  }
  for (const h of heads) {
    const rocks = 3 + pick(3);
    for (let i = 0; i < rocks; i++) {
      const a = (i / rocks) * Math.PI * 2 + range(-0.4, 0.4),
        d = i === 0 ? 0 : range(1.6, 3.2),
        x = h.x + Math.cos(a) * d,
        z = h.z + Math.sin(a) * d,
        size = i === 0 ? range(2.6, 3.4) : range(1.5, 2.5),
        height = size * range(0.7, 1);
      // Outer rocks of a head must also stay off the channel and the tunnel mouth.
      if (i > 0 && !buildable(x, z)) continue;
      const top = rock(x, z, size, height);
      // Crowned with a colony (two on the central rock).
      for (let k = 0; k < (i === 0 ? 2 : 1); k++)
        coral(
          x + range(-0.35, 0.35) * size,
          top - 0.25,
          z + range(-0.35, 0.35) * size,
          range(0.9, 1.6),
        );
      // Low colonies around the rock's foot.
      if (rand() < 0.45) {
        const ba = a + range(-0.5, 0.5),
          br = ROCK_HALF * size * 1.05,
          bx = x + Math.cos(ba) * br,
          bz = z + Math.sin(ba) * br;
        add('massive', bx, seabedHeight(bx, bz), bz, range(0.55, 0.9));
      }
      // Soft corals and fans on the flanks, facing out.
      if (rand() < 0.75) {
        const fa = a + range(-0.6, 0.6),
          r = ROCK_HALF * size * 0.85,
          fx = x + Math.cos(fa) * r,
          fz = z + Math.sin(fa) * r;
        add(
          rand() < 0.5 ? 'soft' : 'fan',
          fx,
          seabedHeight(fx, fz) + ROCK_HALF * height * 0.35,
          fz,
          range(1.0, 1.8),
          -fa + Math.PI / 2,
        );
      }
    }
  }
  // Lone colonies on the sand near the heads.
  for (
    let i = 0, tries = 0;
    i < OUTER_REEF.sandCorals && tries < 2000;
    tries++
  ) {
    const h = heads[pick(heads.length)],
      a = rand() * Math.PI * 2,
      d = range(5, 9),
      x = h.x + Math.cos(a) * d,
      z = h.z + Math.sin(a) * d;
    if (!buildable(x, z, 1)) continue;
    coral(x, seabedHeight(x, z) - 0.1, z, range(0.8, 1.4));
    i++;
  }
  // Seagrass meadows along the channel's banks.
  for (let m = 0; m < OUTER_REEF.meadows; m++) {
    const z = range(OUTER.dropOff.start + 6, OUTER.cliffZ - 14),
      side = m % 2 ? 1 : -1,
      cx =
        Math.sin(
          ((z - OUTER.cliffZ) / OUTER.channel.wavelength) * Math.PI * 2,
        ) *
          OUTER.channel.amplitude +
        side * (OUTER.channel.halfWidth + range(1, 3));
    for (let i = 0; i < OUTER_REEF.bladesPerMeadow; i++) {
      const a = rand() * Math.PI * 2,
        d = Math.sqrt(rand()) * range(2.5, 4),
        x = cx + Math.cos(a) * d,
        bz = z + Math.sin(a) * d * 1.4;
      if (nearMouth(x, bz)) continue;
      const tall = range(0.55, 1.15) * (1 - d / 5);
      add(
        rand() < 0.65 ? 'blade' : 'grass',
        x,
        seabedHeight(x, bz) - 0.05,
        bz,
        { x: 1, y: Math.max(0.3, tall), z: 1 },
      );
    }
  }
  // Rubble and shells across the sand.
  for (let i = 0; i < OUTER_REEF.debris; i++) {
    const x = range(OUTER.reef.minX, OUTER.reef.maxX),
      z = range(OUTER.dropOff.start, OUTER.cliffZ - 2);
    if (nearMouth(x, z)) continue;
    add(
      rand() < 0.55 ? 'shell' : 'rubble',
      x,
      seabedHeight(x, z) + 0.01,
      z,
      range(4, 9),
    );
  }
  // The reef's edge along the drop-off, and the rocky wall below it.
  for (
    let x = OUTER.reef.minX + 2;
    x < OUTER.reef.maxX - 2;
    x += OUTER_REEF.edgeStep
  ) {
    const ex = x + range(-1.5, 1.5),
      ez = OUTER.dropOff.start + range(-2.5, 1),
      size = range(1.6, 3),
      top = rock(ex, ez, size, size * range(0.6, 0.9));
    if (rand() < 0.6) coral(ex, top - 0.2, ez, range(0.9, 1.5));
    const wz = range(OUTER.dropOff.start - 4, OUTER.dropOff.end),
      wsize = range(2.5, 4.5);
    add('rock', ex + range(-2, 2), seabedHeight(ex, wz) + wsize * 0.3, wz, {
      x: wsize,
      y: wsize * range(0.8, 1.2),
      z: wsize,
    });
  }
  // Big, low-detail rocks framing the sides beyond the comfortable reef.
  for (const side of [-1, 1])
    for (
      let z = OUTER.cliffZ - 6;
      z > OUTER.reef.minZ;
      z -= OUTER_REEF.backdropStep
    ) {
      const x = side * range(50, 57),
        bz = z + range(-3, 3),
        size = range(4, 7.5);
      add('backdrop', x, seabedHeight(x, bz) + size * 0.25, bz, {
        x: size,
        y: size * range(0.6, 1),
        z: size,
      });
    }
  return {
    placements: out,
    heads: heads.map((h) => ({ x: h.x, y: seabedHeight(h.x, h.z), z: h.z })),
  };
}

/** Whether `p` is below the drop-off's lip (deep water). */
export const overDropOff = (p: Vec3): boolean => dropWeight(p.z) > 0.5;
