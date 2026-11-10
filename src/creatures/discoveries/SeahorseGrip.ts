import * as THREE from 'three';

/**
 * Pass 019 playtest: the seahorse clings to a small branch of its sea fan and faces out, instead
 * of hugging the trunk. Sea-fan templates are flat branching lattices in their local x-y plane
 * (normalised so y runs 0-1 over the plant's height). The seahorse's tail coil wraps a stem that
 * runs across its body (its local x), so a good grip is a thin, near-horizontal stretch of branch
 * with open water where the body sits. Pure function: no WebGL, testable on real template data.
 */

/** Seahorse-local points (unscaled) the body occupies; the tail coil is excluded (it wraps the branch). */
const BODY_SAMPLES: readonly (readonly [number, number, number, number])[] = [
  // [x, y, z, radius]
  [0, 0.3, 0, 0.085],
  [0, 0.49, -0.015, 0.085],
  [0, 0.7, -0.11, 0.085],
  [0, 0.9, -0.1, 0.08],
  [0, 1.01, 0.06, 0.07],
  [0, 0.98, 0.2, 0.04],
];
/** Centre of the tail coil in seahorse-local units: the point that sits on the branch. */
export const SEAHORSE_COIL = { y: 0.15, z: 0.16 } as const;

export interface SeahorseGrip {
  /** World position of the gripped branch (the tail-coil centre). */
  readonly grip: THREE.Vector3;
  /** Horizontal world direction the seahorse faces (away from the fan). */
  readonly forward: THREE.Vector3;
}

export interface GripOptions {
  /** Seahorse root scale, in world units per seahorse-local unit. */
  readonly scale: number;
  /** World height of the plant (template y = 1). */
  readonly plantHeight: number;
  /** Preferred world facing (e.g. towards the open channel); horizontal. */
  readonly prefer: THREE.Vector3;
  /** Template height band to search. */
  readonly band?: readonly [number, number];
}

/**
 * Find a grip on a sea-fan template (`positions`, template-local) placed by `toWorld`.
 * Returns undefined when no branch fits.
 */
export function findSeahorseGrip(
  positions: ArrayLike<number>,
  toWorld: THREE.Matrix4,
  options: GripOptions,
): SeahorseGrip | undefined {
  const count = Math.floor(positions.length / 3),
    s = options.scale / options.plantHeight,
    [low, high] = options.band ?? [0.45, 0.78],
    rotation = new THREE.Quaternion(),
    scratch = new THREE.Vector3();
  toWorld.decompose(scratch, rotation, new THREE.Vector3());
  const at = (i: number, out: THREE.Vector3) =>
    out.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  // Coarse spatial hash over the template for neighbourhood queries.
  const cell = 0.03,
    grid = new Map<string, number[]>(),
    key = (x: number, y: number, z: number) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < count; i++) {
    const k = key(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  const near = (c: THREE.Vector3, r: number, visit: (i: number) => void) => {
    const span = Math.ceil(r / cell),
      cx = Math.floor(c.x / cell),
      cy = Math.floor(c.y / cell),
      cz = Math.floor(c.z / cell);
    for (let x = cx - span; x <= cx + span; x++)
      for (let y = cy - span; y <= cy + span; y++)
        for (let z = cz - span; z <= cz + span; z++)
          for (const i of grid.get(`${x},${y},${z}`) ?? []) {
            const dx = positions[i * 3] - c.x,
              dy = positions[i * 3 + 1] - c.y,
              dz = positions[i * 3 + 2] - c.z;
            if (dx * dx + dy * dy + dz * dz <= r * r) visit(i);
          }
  };
  const p = new THREE.Vector3(),
    q = new THREE.Vector3(),
    mean = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    side = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    root = new THREE.Vector3(),
    sample = new THREE.Vector3(),
    worldForward = new THREE.Vector3();
  const prefer = options.prefer.clone().setY(0).normalize();
  let best:
    { score: number; grip: THREE.Vector3; forward: THREE.Vector3 } | undefined;
  for (let i = 0; i < count; i += 5) {
    at(i, p);
    if (p.y < low || p.y > high || Math.abs(p.x) < 0.08) continue;
    // Local branch axis and thickness from the neighbourhood's covariance.
    const neighbours: number[] = [];
    near(p, 0.035, (j) => neighbours.push(j));
    if (neighbours.length < 8) continue;
    mean.set(0, 0, 0);
    for (const j of neighbours) mean.add(at(j, q));
    mean.multiplyScalar(1 / neighbours.length);
    const c = [0, 0, 0, 0, 0, 0]; // xx xy xz yy yz zz
    for (const j of neighbours) {
      at(j, q).sub(mean);
      c[0] += q.x * q.x;
      c[1] += q.x * q.y;
      c[2] += q.x * q.z;
      c[3] += q.y * q.y;
      c[4] += q.y * q.z;
      c[5] += q.z * q.z;
    }
    const m = new THREE.Matrix3()
      .set(c[0], c[1], c[2], c[1], c[3], c[4], c[2], c[4], c[5])
      .multiplyScalar(1 / neighbours.length);
    // Power iteration for the principal direction.
    const axis = new THREE.Vector3(1, 0.2, 0.1).normalize();
    for (let k = 0; k < 24; k++) axis.applyMatrix3(m).normalize();
    // Thin: little spread across the axis; near-horizontal: small vertical component.
    const along = axis.clone().applyMatrix3(m).dot(axis),
      trace =
        c[0] / neighbours.length +
        c[3] / neighbours.length +
        c[5] / neighbours.length,
      across = Math.sqrt(Math.max(0, (trace - along) / 2));
    if (across > 0.012 || Math.abs(axis.y) > 0.55) continue;
    for (const sign of [1, -1]) {
      forward.set(0, 0, sign);
      side.crossVectors(up, forward);
      root
        .copy(mean)
        .addScaledVector(forward, -SEAHORSE_COIL.z * s)
        .addScaledVector(up, -SEAHORSE_COIL.y * s);
      let blocked = false;
      for (const [x, y, z, r] of BODY_SAMPLES) {
        sample
          .copy(root)
          .addScaledVector(side, x * s)
          .addScaledVector(up, y * s)
          .addScaledVector(forward, z * s);
        near(sample, r * s + 0.004, () => (blocked = true));
        if (blocked) break;
      }
      if (blocked) continue;
      worldForward.copy(forward).applyQuaternion(rotation).setY(0);
      if (worldForward.lengthSq() < 1e-6) continue;
      worldForward.normalize();
      const score =
        worldForward.dot(prefer) * 2 -
        Math.abs(mean.y - 0.62) -
        Math.abs(axis.y);
      if (!best || score > best.score)
        best = {
          score,
          grip: mean.clone().applyMatrix4(toWorld),
          forward: worldForward.clone(),
        };
    }
  }
  return best && { grip: best.grip, forward: best.forward };
}
