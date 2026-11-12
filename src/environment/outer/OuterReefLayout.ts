import { OUTER } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import {
  channelCentre,
  channelWeight,
  dropWeight,
  seabedHeight,
} from './OuterTerrain';

/**
 * v0.4 Pass 024/026: where the outer reef's pieces go. Pure and seeded. Pass 026 makes it a wall
 * dive: a dense reef top between the cliff and the lip (big bommies, then rock and coral almost
 * everywhere, with a narrow sand gully and a little seagrass), a crowded lip, sea fans and soft
 * corals jutting from the wall below it, and big low-detail rocks framing the sides. The reef
 * library's pieces are dressed onto these placements at runtime.
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
  /** Pass 026: big bommies rising from the reef top, at least this far apart (m). */
  heads: 8,
  headSpacing: 9,
  /** Keep the open water right below the tunnel mouth clear (x half-width, z extent). */
  mouthClear: { halfWidth: 5, depth: 5 },
  /** Pass 026: the reef matrix between the bommies: one rock per cell of this size (m). */
  matrixStep: 3.8,
  sandCorals: 30,
  meadows: 3,
  bladesPerMeadow: 45,
  debris: 140,
  /** Rocks along the lip, and the wall's rocks and sea fans per metre of lip. */
  edgeStep: 3,
  wallRows: 3,
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
  // Weighted towards massive colonies (light far levels); Pass 026: fewer branching (heavy far level).
  const coral = (x: number, y: number, z: number, scale: number) => {
    const r = rand();
    add(r < 0.5 ? 'massive' : r < 0.78 ? 'branching' : 'plate', x, y, z, scale);
  };

  /** A rock with its colonies, a coral at its foot and a soft coral or fan on its flank. */
  const outcrop = (
    x: number,
    z: number,
    size: number,
    height: number,
    a: number,
    crowns: number,
    foot: number,
    flank: number,
  ) => {
    const top = rock(x, z, size, height);
    for (let k = 0; k < crowns; k++)
      coral(
        x + range(-0.35, 0.35) * size,
        top - 0.25,
        z + range(-0.35, 0.35) * size,
        range(1.1, 1.9),
      );
    if (rand() < foot) {
      const ba = a + range(-0.5, 0.5),
        br = ROCK_HALF * size * 1.05,
        bx = x + Math.cos(ba) * br,
        bz = z + Math.sin(ba) * br;
      add('massive', bx, seabedHeight(bx, bz), bz, range(0.55, 0.9));
    }
    if (rand() < flank) {
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
  };

  // Bommies: big coral heads rising from the reef top.
  const heads: { x: number; z: number }[] = [];
  for (
    let tries = 0;
    heads.length < OUTER_REEF.heads && tries < 3000;
    tries++
  ) {
    const x = range(OUTER.reef.minX + 5, OUTER.reef.maxX - 5),
      z = range(OUTER.dropOff.start + 4, OUTER.cliffZ - 5);
    if (!buildable(x, z, 2.5)) continue;
    if (
      heads.some((h) => Math.hypot(h.x - x, h.z - z) < OUTER_REEF.headSpacing)
    )
      continue;
    heads.push({ x, z });
  }
  for (const h of heads) {
    const rocks = 4 + pick(3);
    for (let i = 0; i < rocks; i++) {
      const a = (i / rocks) * Math.PI * 2 + range(-0.4, 0.4),
        d = i === 0 ? 0 : range(1.8, 3.2),
        x = h.x + Math.cos(a) * d,
        z = h.z + Math.sin(a) * d,
        size = i === 0 ? range(3.2, 4.2) : range(1.6, 2.6),
        height = size * (i === 0 ? range(0.9, 1.15) : range(0.7, 1));
      // Outer rocks of a head must also stay off the gully and the tunnel mouth.
      if (i > 0 && !buildable(x, z)) continue;
      outcrop(x, z, size, height, a, i === 0 ? 2 : 1, 0.6, 0.85);
    }
  }
  // The reef matrix: rock and coral almost everywhere between the bommies.
  const step = OUTER_REEF.matrixStep;
  for (let gz = OUTER.cliffZ - 2.5; gz > OUTER.dropOff.start; gz -= step)
    for (let gx = OUTER.reef.minX; gx <= OUTER.reef.maxX; gx += step) {
      const x = gx + range(-0.45, 0.45) * step,
        z = gz + range(-0.45, 0.45) * step;
      if (!buildable(x, z, 0.4)) continue;
      if (heads.some((h) => Math.hypot(h.x - x, h.z - z) < 4)) continue;
      // Low rocks, each crowned with coral (two on the larger ones), so coral covers the reef.
      const size = range(1.1, 2.2);
      outcrop(
        x,
        z,
        size,
        size * range(0.4, 0.7),
        rand() * Math.PI * 2,
        size > 2.1 ? 2 : 1,
        0.35,
        0.7,
      );
    }
  // Small colonies in the few sandy gaps.
  for (
    let i = 0, tries = 0;
    i < OUTER_REEF.sandCorals && tries < 2000;
    tries++
  ) {
    const x = range(OUTER.reef.minX, OUTER.reef.maxX),
      z = range(OUTER.dropOff.start + 1, OUTER.cliffZ - 3);
    if (!buildable(x, z, 0.5)) continue;
    coral(x, seabedHeight(x, z) - 0.1, z, range(0.6, 1.1));
    i++;
  }
  // Seagrass along the sand gully's banks.
  for (let m = 0; m < OUTER_REEF.meadows; m++) {
    const z = range(OUTER.dropOff.start + 4, OUTER.cliffZ - 6),
      side = m % 2 ? 1 : -1,
      cx =
        channelCentre(z) + side * (OUTER.channel.halfWidth + range(0.5, 1.5));
    for (let i = 0; i < OUTER_REEF.bladesPerMeadow; i++) {
      const a = rand() * Math.PI * 2,
        d = Math.sqrt(rand()) * range(1.5, 2.5),
        x = cx + Math.cos(a) * d,
        bz = z + Math.sin(a) * d * 1.4;
      if (nearMouth(x, bz)) continue;
      const tall = range(0.55, 1.15) * (1 - d / 4);
      add(
        rand() < 0.65 ? 'blade' : 'grass',
        x,
        seabedHeight(x, bz) - 0.05,
        bz,
        { x: 1, y: Math.max(0.3, tall), z: 1 },
      );
    }
  }
  // Rubble and shells in the gully and the gaps.
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
  // The lip: a crowded edge of rock, colonies and fans facing the blue.
  const lip = OUTER.dropOff.start,
    wall = OUTER.dropOff.end;
  for (
    let x = OUTER.reef.minX + 1;
    x < OUTER.reef.maxX - 1;
    x += OUTER_REEF.edgeStep
  ) {
    const ex = x + range(-1, 1),
      ez = lip + range(-0.5, 1.2),
      size = range(1.8, 3.2),
      top = rock(ex, ez, size, size * range(0.6, 0.95));
    coral(ex, top - 0.2, ez, range(0.9, 1.6));
    if (rand() < 0.7)
      add(
        'fan',
        ex + range(-1, 1),
        top - 0.3,
        ez - ROCK_HALF * size * 0.5,
        range(1.4, 2.2),
        range(-0.3, 0.3),
      );
    // Down the wall: rocks jutting from its face, with sea fans and soft corals facing out.
    for (let row = 0; row < OUTER_REEF.wallRows; row++) {
      const t = (row + range(0.15, 0.85)) / OUTER_REEF.wallRows,
        wz = lip - t * (lip - wall),
        wx = ex + range(-1.5, 1.5),
        wy = seabedHeight(wx, wz),
        wsize = range(2.2, 4);
      add('rock', wx, wy, wz, {
        x: wsize,
        y: wsize * range(0.8, 1.3),
        z: wsize * 0.7,
      });
      add(
        rand() < 0.6 ? 'fan' : 'soft',
        wx + range(-1, 1),
        wy + ROCK_HALF * wsize * 0.4,
        wz - ROCK_HALF * wsize * 0.4,
        range(1.3, 2.4),
        range(-0.4, 0.4),
      );
    }
  }
  // Big, low-detail rocks framing the sides beyond the reef.
  for (const side of [-1, 1])
    for (
      let z = OUTER.cliffZ - 4;
      z > OUTER.dropOff.start - 2;
      z -= OUTER_REEF.backdropStep
    ) {
      const x = side * range(47, 54),
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
