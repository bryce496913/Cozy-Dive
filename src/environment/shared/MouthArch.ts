import * as THREE from 'three';
import type { Tube } from './RockTube';

/**
 * V0.8 Pass 086: a tunnel mouth's rock, sculpted as one continuous, naturally formed arch rather
 * than boulders heaped round the hole (Pass 052's ring of randomly rotated rocks read as an
 * assembled garland). A few interlocking masses of bedded rock grow out of the face round the
 * hole, each with its own reach and height, meeting along crisp joints; they are stepped by
 * strata, split by a few fractures, pitted by erosion, rounded over at the lip where they turn
 * into the tube and sink back into the face (or the seabed) at their outer edge, so the face's
 * own rock swallows their silhouette. One indexed, smooth-shaded, vertex-coloured grid.
 */
export interface MouthArchOptions {
  /** Where the face is (z) at (x, y); defaults to the plane at the mouth's `z`. */
  readonly face?: (x: number, y: number) => number;
  /** The rock's base colour, and how far its tops are frosted (0..1). */
  readonly stone: readonly [number, number, number];
  readonly frost?: number;
  /** Silt and algae settled on the up-facing ledges (0..1), as in a lit cave mouth. */
  readonly silt?: number;
  /** How far the masses reach out over the face beyond the tube (m) and stand proud of it. */
  readonly reach?: number;
  readonly proud?: number;
  /** The thickness of the rock's beds (m). */
  readonly bed?: number;
  readonly seed: number;
}

/** The arch's grid (around the hole x out from it) and its named shape values. */
export const MOUTH_ARCH = {
  around: 160,
  rings: 30,
  /** How far inside the tube the lip curls back (m in, m deep into the tunnel). */
  lipIn: 0.14,
  lipDeep: 0.7,
  /** How far behind the face the outer edge sinks (m). */
  sink: 0.55,
  } as const;

interface Mass {
  readonly angle: number;
  readonly width: number;
  readonly reach: number;
  readonly proud: number;
  readonly phase: number;
  readonly dip: number;
}
interface Fracture {
  readonly px: number;
  readonly py: number;
  readonly nx: number;
  readonly ny: number;
  readonly depth: number;
}

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The signed angle from `b` to `a`, in (-pi, pi]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * A mass's height over the face at angle `a`, `rr` m out from the tube's wall: rounded over at
 * the lip, broad-shouldered, and falling away to its reach (where it sinks back into the face).
 */
function massHeight(m: Mass, a: number, rr: number, sink: number): number {
  const across = Number.isFinite(m.width)
    ? Math.abs(wrap(a - m.angle)) / m.width
    : 0.25 + 0.2 * Math.sin(a * 2 + m.phase * 6);
  // Steep flanks across the mass, a broad plateau over its middle (continuous, so the outline
  // sinks smoothly into the face instead of stepping at the grid).
  const shoulder = 1 - smooth(0.55, 1, across),
    // Its reach narrows toward the flanks, so masses read as blocks, not a uniform ring.
    reach = m.reach * (0.6 + 0.4 * shoulder),
    u = rr / reach,
    // A nearly flat face over most of its reach, tilted a little, then a steep fall at its edge.
    body =
      u < 0.62
        ? 1 - 0.12 * (u / 0.62) ** 2 + m.dip * (u - 0.3)
        : 0.88 + m.dip * 0.32 - ((u - 0.62) / 0.38) ** 1.4 * (0.88 + sink);
  return Math.max(-sink, m.proud * body * shoulder - sink * (1 - shoulder));
}

export function mouthArch(
  t: Pick<Tube, 'x' | 'y' | 'radius'>,
  z: number,
  out: 1 | -1,
  options: MouthArchOptions,
): THREE.BufferGeometry {
  const A = MOUTH_ARCH,
    rand = random(options.seed),
    reach = options.reach ?? 2.6,
    proud = options.proud ?? 0.8,
    bed = options.bed ?? 0.68,
    frost = options.frost ?? 0,
    silt = options.silt ?? 0,
    face = options.face ?? (() => z),
    stone = options.stone;
  // A low collar all round the hole (so the tube never shows a bare edge), and a few big masses
  // over it, set asymmetrically: heaviest over one shoulder, a buttress down one side and a
  // couple of blocks at the foot, overlapping so the joints between them fall irregularly.
  const masses: Mass[] = [
    {
      angle: 0,
      width: Infinity,
      reach: reach * 0.42,
      proud: proud * 0.38,
      phase: rand(),
      dip: (rand() - 0.5) * 0.2,
    },
  ];
  const lean = rand() < 0.5 ? -1 : 1,
    placed = [
      // shoulder, crown, buttress, far shoulder, foot, foot
      [Math.PI / 2 + lean * 0.75, 1.0, 1.25, 1.15],
      [Math.PI / 2 - lean * 0.35, 0.7, 0.85, 0.8],
      [Math.PI / 2 + lean * 1.9, 0.75, 1.05, 0.95],
      [Math.PI / 2 - lean * 1.35, 0.55, 0.7, 0.6],
      [-Math.PI / 2 + lean * 0.55, 0.6, 0.65, 0.55],
      [-Math.PI / 2 - lean * 0.8, 0.5, 0.55, 0.5],
    ] as const;
  for (const [angle, width, r, h] of placed)
    masses.push({
      angle: angle + (rand() - 0.5) * 0.3,
      width: width * (0.85 + rand() * 0.3),
      reach: reach * r * (0.85 + rand() * 0.3),
      proud: proud * h * (0.85 + rand() * 0.3),
      phase: rand(),
      dip: (rand() - 0.5) * 0.25,
    });
  const fractures: Fracture[] = [];
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2,
      r = t.radius + 0.4 + rand() * reach * 0.6,
      // Mostly near-vertical joints, as in bedded rock.
      dir = Math.PI / 2 + (rand() - 0.5) * 0.9;
    fractures.push({
      px: t.x + Math.cos(a) * r,
      py: t.y + Math.sin(a) * r,
      nx: Math.cos(dir + Math.PI / 2),
      ny: Math.sin(dir + Math.PI / 2),
      depth: 0.08 + rand() * 0.1,
    });
  }

  const cols = A.around + 1,
    count = cols * (A.rings + 1),
    pos = new Float32Array(count * 3),
    lift = new Float32Array(count),
    layer = new Float32Array(count),
    joint = new Float32Array(count),
    rrs = new Float32Array(count),
    outer = reach * 1.3;
  for (let i = 0; i <= A.rings; i++) {
    // Rings packed toward the lip, where the form turns over most sharply.
    const s = i / A.rings,
      rr = -A.lipIn + (outer + A.lipIn) * s ** 1.45;
    for (let j = 0; j <= A.around; j++) {
      const a = (j / A.around) * Math.PI * 2,
        r = t.radius + rr,
        x = t.x + Math.cos(a) * r,
        y = t.y + Math.sin(a) * r;
      // The highest and second-highest mass here: their difference is small along a joint.
      let h1 = -Infinity,
        h2 = -Infinity,
        top: Mass | undefined;
      for (const m of masses) {
        const h = massHeight(m, a, Math.max(0, rr), A.sink);
        if (h > h1) {
          h2 = h1;
          h1 = h;
          top = m;
        } else if (h > h2) h2 = h;
      }
      let h: number;
      const k = i * cols + j;
      if (!top || h1 <= -A.sink) h = -A.sink;
      else {
        // Joints: where two masses meet, a crisp V-groove between them.
        const gap = Number.isFinite(h2)
          ? Math.max(0, 1 - (h1 - h2) / 0.12) * smooth(-0.1, 0.2, h2)
          : 0;
        joint[k] = gap;
        h = h1 - 0.12 * gap;
        // Strata: each bed recedes upward and steps out at its base (small ledges, undercuts).
        const beds = (y + top.dip * (x - t.x)) / bed + top.phase,
          f = beds - Math.floor(beds),
          proudness = smooth(0, 0.35, h);
        h -= 0.15 * smooth(0.04, 0.97, f) ** 1.4 * proudness;
        layer[k] = Math.floor(beds);
        // Fractures and erosion: a few joints across the beds, pits and fine wear.
        for (const fr of fractures) {
          const d = (x - fr.px) * fr.nx + (y - fr.py) * fr.ny;
          h -= fr.depth * Math.exp(-((d / 0.09) ** 2)) * proudness;
        }
        h +=
          0.03 * Math.sin(x * 2.1 + y * 1.3) * Math.sin(y * 1.7 - x * 1.1) +
          0.012 * Math.sin(x * 9.3 - y * 7.1) -
          0.03 * Math.max(0, Math.sin(x * 4.3 + 1.1) * Math.sin(y * 3.9)) ** 6;
        // Sink smoothly back into the face beyond the masses' reach.
        h = Math.max(h, -A.sink);
      }
      // The lip curls back into the tube, hiding where the tube meets the face.
      if (rr < 0) h = h * (1 + rr / A.lipIn) - A.lipDeep * (-rr / A.lipIn) ** 0.7;
      const fz = face(x, y);
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = fz + out * h;
      lift[k] = h;
      rrs[k] = rr;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < A.rings; i++)
    for (let j = 0; j < A.around; j++) {
      const a = i * cols + j,
        b = a + 1;
      // Wound to face `out` (single-sided materials cull the other side).
      if (out > 0) idx.push(a, a + cols, b, b, a + cols, b + cols);
      else idx.push(a, b, a + cols, b, b + cols, a + cols);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Seam: the first and last columns share a place; give them one normal.
  const n = g.getAttribute('normal');
  for (let i = 0; i <= A.rings; i++) {
    const p = i * cols,
      q = p + A.around;
    const nx = n.getX(p) + n.getX(q),
      ny = n.getY(p) + n.getY(q),
      nz = n.getZ(p) + n.getZ(q),
      l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(p, nx / l, ny / l, nz / l);
    n.setXYZ(q, nx / l, ny / l, nz / l);
  }

  // Colour: the stone by bed, darker in joints, fractures and hollows (a cavity term from the
  // grid), paler on the proud edges, shading into the tunnel's dark at the lip; silt or frost
  // settled on the up-facing ledges.
  const col = new Float32Array(count * 3);
  for (let i = 0; i <= A.rings; i++)
    for (let j = 0; j <= A.around; j++) {
      const k = i * cols + j,
        jl = i * cols + (j === 0 ? A.around - 1 : j - 1),
        jr = i * cols + (j === A.around ? 1 : j + 1),
        il = Math.max(0, i - 1) * cols + j,
        ir = Math.min(A.rings, i + 1) * cols + j,
        cavity = Math.max(
          -1,
          Math.min(1, (lift[k] - (lift[jl] + lift[jr] + lift[il] + lift[ir]) / 4) * 9),
        ),
        band = layer[k] % 2 === 0 ? 1.04 : 0.95,
        x = pos[k * 3],
        y = pos[k * 3 + 1],
        mottle = 0.92 + 0.12 * Math.sin(x * 2.3 + y * 1.7) * Math.sin(y * 3.1 - x * 0.9),
        lip = 0.35 + 0.65 * smooth(-0.05, 0.55, rrs[k]),
        sunk = 0.75 + 0.25 * smooth(-A.sink, 0, lift[k]),
        shade =
          band * mottle * lip * sunk * (1 + 0.22 * cavity) * (1 - 0.35 * joint[k]),
        up = Math.max(0, n.getY(k)),
        settle = smooth(0.45, 0.85, up) * smooth(0, 0.1, lift[k] + A.sink * 0.5),
        fr = frost * settle,
        st = silt * settle * (0.6 + 0.4 * Math.sin(x * 1.3 + y * 2.9));
      col[k * 3] = stone[0] * shade * (1 - 0.15 * st) * (1 - 0.1 * fr) + 0.38 * fr;
      col[k * 3 + 1] = stone[1] * shade * (1 + 0.08 * st) + 0.42 * fr;
      col[k * 3 + 2] = stone[2] * shade * (1 - 0.25 * st) + 0.55 * fr;
    }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** The face's z at (x, y) by bisection on a monotone "inside the rock" test along z. */
export function faceByBisection(
  inRock: (x: number, y: number, z: number) => boolean,
  near: number,
  far: number,
): (x: number, y: number) => number {
  return (x, y) => {
    let lo = near,
      hi = far;
    if (inRock(x, y, lo)) return lo;
    if (!inRock(x, y, hi)) return hi;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inRock(x, y, mid)) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
}
