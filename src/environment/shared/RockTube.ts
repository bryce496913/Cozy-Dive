import * as THREE from 'three';
import { organicTube } from './organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { limestoneGeometry } from './LimestoneGeometry';

/**
 * v0.6 Pass 046: a rough rock tunnel along -z, shared by the sea cave's back tunnel and the tunnel
 * in under the ice: a lumpy tube (vertex-coloured, darkening towards its threshold, where the
 * passage's darkness peaks) and the square duct of colliders that keeps the swimmer in it.
 */
export interface Tube {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Its two ends (z): the open end, and the end by the threshold (or its cap). */
  readonly from: number;
  readonly to: number;
  /** The threshold (z), where it is darkest. */
  readonly dark: number;
  /**
   * v0.6 Pass 052: frost creeping over the rock, from none at `from` z to full at `to` z (the
   * tunnel to the ice): the rock turns blue-white and glints.
   */
  readonly frost?: { readonly from: number; readonly to: number };
}

export function rockTubeGeometry(t: Tube, reach = 3.2): THREE.BufferGeometry {
  const steps = Math.max(8, Math.ceil(Math.abs(t.to - t.from) * 4)),
    around = 40,
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = t.from + ((t.to - t.from) * i) / steps,
      past = Math.abs(z - t.dark),
      light = Math.max(0, Math.min(1, (past - 0.4) / (reach + 3)));
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2,
        bump = 0.12 * Math.sin(a * 3 + z * 1.7) * Math.sin(a * 5 - z * 0.9),
        r = t.radius + bump + 0.025 * Math.sin(a * 13 - z * 7);
      positions.push(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, z);
      const tone =
        (0.07 + 0.3 * light * light) * (0.85 + 0.15 * Math.sin(a * 7 + z));
      const f = t.frost
          ? Math.max(
              0,
              Math.min(1, (z - t.frost.from) / (t.frost.to - t.frost.from)),
            ) *
            // Frost settles on the upper rock first.
            (0.55 + 0.45 * Math.max(0, Math.sin(a)))
          : 0,
        glint = f * 0.12 * Math.max(0, Math.sin(a * 23 + z * 17)) * light;
      colors.push(
        tone * (1 - 0.15 * f) + glint,
        tone * (1 + 0.1 * f) + glint,
        tone * (1 + 0.6 * f) + glint * 1.2,
      );
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j,
        b = a + around + 1;
      // Faces inwards whichever way the tube runs.
      if (t.to < t.from) indices.push(a, b, a + 1, a + 1, b, b + 1);
      else indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** The duct: walls a little inside the tube's rock (`duct` from its axis, `wall` thick). */
export function rockTubeColliders(
  t: Tube,
  duct = 1.22,
  wall = 0.6,
): ConvexCollider[] {
  const d = duct,
    w = wall,
    z0 = Math.min(t.from, t.to),
    z1 = Math.max(t.from, t.to),
    x = t.x,
    y = t.y;
  return [
    boxCollider([x + d, y - d - w, z0], [x + d + w, y + d + w, z1]),
    boxCollider([x - d - w, y - d - w, z0], [x - d, y + d + w, z1]),
    boxCollider([x - d - w, y + d, z0], [x + d + w, y + d + w, z1]),
    boxCollider([x - d - w, y - d - w, z0], [x + d + w, y - d, z1]),
  ];
}

/** Positions, normals and the given flat colour only (non-indexed), so parts merge. */
function plain(
  g: THREE.BufferGeometry,
  colour: (y: number, i: number) => readonly [number, number, number],
): THREE.BufferGeometry {
  // V0.7 Pass 079: keep smooth normals (computed before de-indexing, or the part's own); they
  // were recomputed per triangle afterwards, which shaded every rock and icicle flat-faceted.
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.set(colour(p.getY(i), i), i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
/**
 * v0.6 Pass 052 (playtest: "the tunnel to the ice needs to be better designed", "the entrance
 * into the ice area needs to be fixed"): boulders heaped round a tunnel's mouth, hiding where its
 * tube meets the rock face; `out` is the side the mouth opens to (+1 or -1 along z). Their tops
 * are frosted by `frost` (0..1). One merged, vertex-coloured geometry.
 */
export function mouthRocks(
  t: Pick<Tube, 'x' | 'y' | 'radius'>,
  z: number,
  out: 1 | -1,
  frost = 0,
  count = 12,
  seed = 52100,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    centre = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // Round the mouth, heavier at the sides and over the top than underneath.
    const a = ((i + 0.16 * Math.sin(i * 2.7)) / count) * Math.PI * 2 + 0.2,
      // V0.7 Pass 079 (playtest: tunnel rocks read faceted): carved inside their hull.
      g = limestoneGeometry(seed + (i % 8) * 11, i % 3, true, 1, false),
      d =
        (1.65 + 0.55 * Math.abs(Math.sin(i * 2.3))) *
        (Math.sin(a) < -0.4 ? 0.7 : 1),
      ring = t.radius + 0.35 + d * 0.3;
    g.computeBoundingBox();
    const box = g.boundingBox!,
      size = box.getSize(new THREE.Vector3());
    box.getCenter(centre);
    e.set(i * 0.7, i * 1.3, i * 0.4);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(
        t.x + Math.cos(a) * ring,
        t.y + Math.sin(a) * ring,
        z + out * (0.02 + 0.09 * Math.sin(i * 1.7)),
      ),
      q,
      new THREE.Vector3(d / size.x, d / size.y, (d * 0.8) / size.z),
    ).multiply(
      new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
    );
    g.applyMatrix4(m);
    parts.push(
      plain(g, (y, k) => {
        const tone = 0.22 + 0.06 * Math.sin(k * 0.37),
          f =
            frost *
            Math.max(
              0,
              Math.min(1, (y - t.y + t.radius * 0.5) / (t.radius * 1.5)),
            );
        return [
          tone * (1 - 0.1 * f) + 0.35 * f,
          tone + 0.4 * f,
          tone * 1.02 + 0.55 * f,
        ];
      }),
    );
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Tunnel mouth rocks could not be built');
  return merged;
}
/**
 * v0.6 Pass 052: icicles hanging from the top of a tunnel (between `from` and `to` z, more towards
 * `to`) or along a rock face's edge: slim, clear blue-white cones of mixed lengths.
 */
export function icicles(
  t: Pick<Tube, 'x' | 'y' | 'radius'>,
  from: number,
  to: number,
  count = 26,
  seed = 52200,
): THREE.BufferGeometry {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    // More of them, and longer, towards the cold end.
    const u = Math.sqrt(rand()),
      z = from + (to - from) * u,
      a = Math.PI / 2 + (rand() - 0.5) * 1.6,
      // Short enough that their tips stay above the swimmer's head in the tunnel.
      len = (0.08 + 0.22 * rand() * rand()) * (0.5 + 0.5 * u),
      r = 0.025 + 0.03 * rand(),
      rim = t.radius - 0.08,
      x0 = t.x + Math.cos(a) * rim,
      y0 = t.y + Math.sin(a) * rim,
      bend = (rand() - 0.5) * len * 0.25,
      phase = rand() * 6.28;
    // V0.7 Pass 079: an icicle as ice grows: a broad root fused to the rock, a slightly crooked
    // body rippled by drip rings, tapering to a fine tip (was a straight six-sided cone).
    const g = organicTube(
      [
        new THREE.Vector3(x0, y0 + r * 0.6, z),
        new THREE.Vector3(x0 + bend * 0.3, y0 - len * 0.35, z + bend * 0.2),
        new THREE.Vector3(x0 + bend, y0 - len, z + bend * 0.5),
      ],
      (v) =>
        r *
          (1.35 - 1.25 * v ** 0.8) *
          (1 + 0.12 * Math.sin(v * 22 + phase) * (1 - v)) +
        0.0015,
      14,
      7,
    );
    parts.push(
      plain(g, (y) => {
        const k = 0.7 + 0.3 * Math.min(1, Math.max(0, (y - t.y) / t.radius));
        return [0.62 * k, 0.8 * k, 0.95 * k];
      }),
    );
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Icicles could not be built');
  return merged;
}

/**
 * V0.7 Pass 079 (playtest: the tunnels' ends read as flat black discs): where a tunnel's drawn
 * tube ends, a short rough throat carries on `depth` m along z (`dir` -1 or +1), narrowing and
 * fading to black, so the passage reads as continuing into darkness. Faces inward.
 */
export function tunnelThroat(
  t: Pick<Tube, 'x' | 'y' | 'radius'>,
  z: number,
  dir: 1 | -1,
  depth = 4,
): THREE.BufferGeometry {
  const rings = 10,
    sides = 28,
    pos: number[] = [],
    col: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings,
      r = (t.radius + 0.25) * (1 - 0.75 * u ** 1.4),
      k = 0.07 * (1 - u) ** 2;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        lump =
          1 + 0.08 * Math.sin(a * 3 + u * 5) + 0.05 * Math.sin(a * 7 - u * 9);
      pos.push(
        t.x + Math.cos(a) * r * lump,
        t.y + Math.sin(a) * r * lump,
        z + dir * depth * u,
      );
      col.push(k, k * 1.02, k * 1.05);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides);
      if (dir < 0) idx.push(a, a + sides, b, b, a + sides, b + sides);
      else idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  // Closed at the far end in black.
  const tip = pos.length / 3;
  pos.push(t.x, t.y, z + dir * depth * 1.02);
  col.push(0, 0, 0);
  for (let j = 0; j < sides; j++) {
    const a = rings * sides + j,
      b = rings * sides + ((j + 1) % sides);
    if (dir < 0) idx.push(a, tip, b);
    else idx.push(a, b, tip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * V0.7 Pass 079: a rough rock collar round a tunnel's mouth where it meets a rock face, covering
 * the stair-stepped edge of the hole cut in the face (the water showed through round the tube).
 * Lies at `z`, facing `out` (+1 or -1 along z).
 */
export function mouthCollar(
  t: Pick<Tube, 'x' | 'y' | 'radius'>,
  z: number,
  out: 1 | -1,
  width = 1.3,
  tone = 0.2,
): THREE.BufferGeometry {
  const rings = 6,
    sides = 48,
    pos: number[] = [],
    col: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings,
      r = t.radius - 0.06 + width * u;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        lump =
          0.12 * Math.sin(a * 5 + u * 3) * Math.sin(a * 3 - u * 4) +
          0.06 * Math.sin(a * 11);
      // Bulging out of the face toward its middle, flush at both edges.
      pos.push(
        t.x + Math.cos(a) * r,
        t.y + Math.sin(a) * r,
        z + out * (0.18 * Math.sin(Math.PI * u) + lump * Math.sin(Math.PI * u)),
      );
      const k = tone * (0.85 + 0.25 * Math.sin(a * 7 + u * 5));
      col.push(k, k, k * 1.03);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides);
      // Wound to face `out` (single-sided materials cull the other side).
      if (out > 0) idx.push(a, a + sides, b, b, a + sides, b + sides);
      else idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
