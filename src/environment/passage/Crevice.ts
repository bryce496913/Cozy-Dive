import * as THREE from 'three';
import { CREVICE, CREVICE_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { createRockGeometry } from '../RockGeometry';
import { rockCollider } from '../rockCollider';

/**
 * v0.4 Pass 023: the hidden crevice. A rock outcrop against the tank's back glass, built from
 * convex boulders fitted around an open channel. The channel opens on the outcrop's +x side,
 * towards the right bank (out of view from the usual swim start), and runs into darkness: a dark
 * liner inside it fades from the rock's colour at the mouth to black at the threshold, where the
 * swimmer passes into the outer waters. Every boulder is a real convex collider, so the channel is
 * the only way in. The crevice owns and disposes its geometry and materials.
 */
interface BoulderSpec {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly seed: number;
}
const c = CREVICE,
  top = c.centre.y + c.halfHeight,
  front = c.centre.z + c.halfDepth,
  back = c.centre.z - c.halfDepth;
/** Boulders around the channel (box extents; each rock fills its box). */
export const CREVICE_BOULDERS: readonly BoulderSpec[] = [
  // Roof, room-side wall, glass-side wall and the far end cap: these bound the channel.
  { min: [0.75, top, -14], max: [5.4, c.outcrop.maxY, -10.3], seed: 7101 },
  { min: [0.75, -0.3, front], max: [4.8, 2.9, -9.9], seed: 7102 },
  { min: [0.75, -0.3, -14.2], max: [5.2, 2.9, back], seed: 7103 },
  { min: [0.75, -0.3, -13.8], max: [c.endX - 0.05, 3.0, -10.4], seed: 7104 },
  // Shoulders that make it read as one outcrop and keep the crack in shadow.
  { min: [1.2, 3.8, -12.9], max: [4.4, 4.9, -10.6], seed: 7105 },
  { min: [4.9, 2.7, -13.8], max: [5.7, 4.0, -11.4], seed: 7106 },
  // (Kept clear of the seagrass that grows at the mouth, x 5.0, z -11.0.)
  { min: [4.3, -0.2, -10.95], max: [4.85, 1.3, -10.1], seed: 7107 },
];
/** The liner starts this far inside the mouth and ends at the channel's end. */
const LINER_INSET = 0.9;

export class Crevice {
  readonly root = new THREE.Group();
  readonly colliders: readonly ConvexCollider[];
  /** Boulder meshes (the authored reef dresses them in its rock material). */
  readonly rocks: readonly THREE.Mesh[];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;

  constructor() {
    this.root.name = 'Hidden crevice';
    const rock = new THREE.MeshStandardMaterial({
      color: 0x6f7f78,
      roughness: 0.96,
      vertexColors: true,
      metalness: 0,
    });
    this.materials.push(rock);
    const colliders: ConvexCollider[] = [],
      rocks: THREE.Mesh[] = [],
      box = new THREE.Box3(),
      size = new THREE.Vector3(),
      centre = new THREE.Vector3();
    CREVICE_BOULDERS.forEach((spec, i) => {
      const geometry = createRockGeometry(spec.seed, i % 4);
      geometry.computeBoundingBox();
      box.copy(geometry.boundingBox!);
      box.getSize(size);
      box.getCenter(centre);
      const mesh = new THREE.Mesh(geometry, rock);
      mesh.name = `Crevice rock ${i}`;
      mesh.scale.set(
        (spec.max[0] - spec.min[0]) / size.x,
        (spec.max[1] - spec.min[1]) / size.y,
        (spec.max[2] - spec.min[2]) / size.z,
      );
      mesh.position.set(
        (spec.min[0] + spec.max[0]) / 2 - centre.x * mesh.scale.x,
        (spec.min[1] + spec.max[1]) / 2 - centre.y * mesh.scale.y,
        (spec.min[2] + spec.max[2]) / 2 - centre.z * mesh.scale.z,
      );
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      colliders.push(rockCollider(geometry, mesh.matrix));
      this.geometries.push(geometry);
      rocks.push(mesh);
      this.root.add(mesh);
    });
    // Rounded boulders leave gaps where they meet; thin plates just behind the dark liner seal
    // the channel, so its mouth is the only way in or out.
    colliders.push(...channelSeals());
    this.colliders = colliders;
    this.rocks = rocks;
    const liner = new THREE.Mesh(channelLiner(), channelMaterial());
    liner.name = 'Crevice darkness';
    this.geometries.push(liner.geometry);
    this.materials.push(liner.material);
    this.root.add(liner);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}

/** An axis-aligned box as a convex collider. */
export function boxCollider(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): ConvexCollider {
  return {
    planes: [
      { x: 1, y: 0, z: 0, offset: max[0] },
      { x: -1, y: 0, z: 0, offset: -min[0] },
      { x: 0, y: 1, z: 0, offset: max[1] },
      { x: 0, y: -1, z: 0, offset: -min[1] },
      { x: 0, y: 0, z: 1, offset: max[2] },
      { x: 0, y: 0, z: -1, offset: -min[2] },
    ],
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}
/** Plates around the channel: roof, floor, both sides and the far end. */
function channelSeals(): ConvexCollider[] {
  const t = 0.35,
    x0 = CREVICE.endX - t,
    // They stop just inside the mouth (the rocks frame the mouth itself).
    x1 = CREVICE.mouthX - 0.45,
    y0 = CREVICE.centre.y - CREVICE.halfHeight,
    y1 = CREVICE.centre.y + CREVICE.halfHeight,
    z0 = CREVICE.centre.z - CREVICE.halfDepth,
    z1 = CREVICE.centre.z + CREVICE.halfDepth;
  return [
    boxCollider([x0, y1, z0 - t], [x1, y1 + t, z1 + t]),
    boxCollider([x0, y0 - t, z0 - t], [x1, y0, z1 + t]),
    boxCollider([x0, y0 - t, z1], [x1, y1 + t, z1 + t]),
    boxCollider([x0, y0 - t, z0 - t], [x1, y1 + t, z0]),
    boxCollider([x0, y0 - t, z0 - t], [CREVICE.endX, y1 + t, z1 + t]),
  ];
}

/** Darkness of the liner at x (1 = the rock's shade at the mouth, 0 = black). */
export function linerShade(x: number): number {
  const mouth = CREVICE.mouthX - LINER_INSET,
    dark = CREVICE_FRAME.origin.x + 0.4,
    t = Math.max(0, Math.min(1, (x - dark) / (mouth - dark)));
  return t * t;
}

/**
 * The channel's inside, open at the mouth: floor, roof, both side walls and the far end, facing
 * inwards, with vertex colours fading to black towards the threshold.
 */
function channelLiner(): THREE.BufferGeometry {
  const x0 = CREVICE.endX,
    x1 = CREVICE.mouthX - LINER_INSET,
    y0 = CREVICE.centre.y - CREVICE.halfHeight,
    y1 = CREVICE.centre.y + CREVICE.halfHeight,
    z0 = CREVICE.centre.z - CREVICE.halfDepth,
    z1 = CREVICE.centre.z + CREVICE.halfDepth,
    steps = 12;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  // Already in deep shadow at its start, so the opening reads as a dark crack, not a box.
  const shade = [0.035, 0.042, 0.04] as const;
  const vertex = (x: number, y: number, z: number): number => {
    positions.push(x, y, z);
    const k = linerShade(x);
    colors.push(shade[0] * k, shade[1] * k, shade[2] * k);
    return positions.length / 3 - 1;
  };
  // Four long walls, subdivided along x so the fade is smooth.
  const walls: [number, number, number, number][] = [
    [y0, z0, y0, z1], // floor
    [y1, z1, y1, z0], // roof
    [y0, z1, y1, z1], // room side
    [y1, z0, y0, z0], // glass side
  ];
  for (const [ya, za, yb, zb] of walls) {
    const first = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      vertex(x, ya, za);
      vertex(x, yb, zb);
    }
    for (let i = 0; i < steps; i++) {
      const a = first + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const e = [
    vertex(x0, y0, z0),
    vertex(x0, y0, z1),
    vertex(x0, y1, z1),
    vertex(x0, y1, z0),
  ];
  indices.push(e[0], e[1], e[2], e[0], e[2], e[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}
function channelMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  m.name = 'Crevice darkness';
  return m;
}
