import * as THREE from 'three';
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
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.set(colour(p.getY(i), i), i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  out.computeVertexNormals();
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
      g = limestoneGeometry(seed + (i % 8) * 11, i % 3),
      d =
        (1.5 + 0.5 * Math.abs(Math.sin(i * 2.3))) *
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
      cone = new THREE.ConeGeometry(r, len, 6);
    cone.rotateX(Math.PI);
    const rim = t.radius - 0.08;
    cone.translate(
      t.x + Math.cos(a) * rim,
      t.y + Math.sin(a) * rim - len / 2,
      z,
    );
    parts.push(
      plain(cone, (y) => {
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
