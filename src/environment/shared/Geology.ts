import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { isCollisionNode } from '../../assets/AssetValidation';
import type { AssetLoader } from '../../assets/AssetLoader';
import type { AssetLease } from '../../assets/AssetLoader';
import type { ConvexCollider } from '../../player/collision';
import { rockCollider } from '../rockCollider';

/**
 * V0.8 Pass 091: the kelp forest's and sea cave's authored rock (`geology.glb`, tools/art/pass091):
 * six kelp coastal rocks, six cave limestone rocks and two cave pillars, each with its convex
 * collision parts. The environments place a variant into each existing placement's box (the same
 * footprint, height and turn as the code-built rock it replaces), so routes, cracks, habitats and
 * passages are unchanged. Geometry is copied out at build time, so the asset lease is only needed
 * while an environment is being built.
 */
export interface GeologyPiece {
  /** Positions, normals and vertex colours as plain floats, non-indexed (merges with code rock). */
  readonly visual: THREE.BufferGeometry;
  /** Convex collision parts in the piece's local space. */
  readonly hulls: readonly THREE.BufferGeometry[];
}

export class Geology {
  constructor(private readonly model: THREE.Object3D) {}

  has(name: string): boolean {
    return !!this.model.getObjectByName(name);
  }

  /** A fresh copy of the variant `name` (e.g. 'KelpRock_3'); the caller owns and disposes it. */
  piece(name: string): GeologyPiece | null {
    const root = this.model.getObjectByName(`${name}_Root`),
      mesh = this.model.getObjectByName(name);
    if (!root || !(mesh instanceof THREE.Mesh)) return null;
    const hulls: THREE.BufferGeometry[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !isCollisionNode(o)) return;
      const p = o.geometry.getAttribute('position'),
        points: THREE.Vector3[] = [];
      for (let i = 0; i < p.count; i++)
        points.push(new THREE.Vector3().fromBufferAttribute(p, i));
      hulls.push(new ConvexGeometry(points));
    });
    return { visual: plain(mesh.geometry as THREE.BufferGeometry), hulls };
  }
}

/** Plain float position / normal / colour, non-indexed (de-quantizing Draco or normalized data). */
function plain(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = source.index ? source.toNonIndexed() : source.clone();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count,
    out = new THREE.BufferGeometry();
  for (const [name, size] of [
    ['position', 3],
    ['normal', 3],
    ['color', 3],
  ] as const) {
    const a = g.getAttribute(name),
      arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      arr[i * size] = a ? a.getX(i) : 1;
      arr[i * size + 1] = a ? a.getY(i) : 1;
      arr[i * size + 2] = a ? a.getZ(i) : 1;
    }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  g.dispose();
  return out;
}

/** A placement: centre (x, y, z), footprint (w, d), height h, turn about y. */
export interface GeologyPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly yaw: number;
}

/**
 * Fit a variant into a placement's box (as the code rock was: its bounding box scaled to the
 * footprint and height, centred, turned), push its colliders, and return its placed visual mesh.
 */
export function placeGeology(
  piece: GeologyPiece,
  at: GeologyPlacement,
  colliders: ConvexCollider[],
): THREE.BufferGeometry {
  const g = piece.visual;
  g.computeBoundingBox();
  const box = g.boundingBox!,
    size = box.getSize(new THREE.Vector3()),
    centre = box.getCenter(new THREE.Vector3()),
    m = new THREE.Matrix4()
      .compose(
        new THREE.Vector3(at.x, at.y, at.z),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          at.yaw,
        ),
        new THREE.Vector3(at.w / size.x, at.h / size.y, at.d / size.z),
      )
      .multiply(
        new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z),
      );
  for (const hull of piece.hulls) {
    colliders.push(rockCollider(hull, m));
    hull.dispose();
  }
  g.applyMatrix4(m);
  return g;
}

/**
 * How long a world's build waits for its geology (ms) before building with the code rock instead,
 * as it would if the file failed: a stalled download must never hold the world closed.
 */
export const GEOLOGY_WAIT_MS = 6000;

/**
 * Acquire the geology for a world's build; undefined (code rock instead) if it cannot load, or has
 * not loaded within `waitMs`. A lease that arrives after the wait is released at once.
 */
export async function acquireGeology(
  loader: AssetLoader,
  waitMs: number = GEOLOGY_WAIT_MS,
): Promise<AssetLease | undefined> {
  let late = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const lease = loader.acquire('geology').then(
    (l) => {
      if (late) {
        l.release();
        return undefined;
      }
      return l;
    },
    (error: unknown) => {
      console.warn(
        'Cozy Diver: the authored geology could not be loaded; using code rock.',
        error,
      );
      return undefined;
    },
  );
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      late = true;
      console.warn(
        'Cozy Diver: the authored geology is still loading; using code rock.',
      );
      resolve(undefined);
    }, waitMs);
  });
  try {
    return await Promise.race([lease, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
